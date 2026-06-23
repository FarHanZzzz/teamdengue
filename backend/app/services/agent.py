"""PrevDengue Response Agent — autonomous decision-support layer.

This goes beyond raw early warning. The agent runs an explicit
perceive -> reason -> prioritise -> plan -> draft -> (await) -> act loop,
using the forecast, SHAP attributions and the live hospital registry as
"tools". It produces:

  * a transparent reasoning trace (what the agent did, step by step),
  * a prioritised, district-level intervention plan (fogging teams, bed-surge
    gaps vs. real hospital capacity, driver-specific recommendations),
  * ready-to-send alert drafts, and
  * an `execute` action that dispatches those alerts directly to the relevant
    District Health Officers AND hospitals.

It is deterministic so it always runs offline; if an LLM key is configured it
could enrich the briefings, but the operational logic stays auditable.
"""
from __future__ import annotations

import math
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.geo import haversine_km
from app.db.models import Alert, District, Hospital, Prediction
from app.services.alerts import _simulate_send
from app.services.llm import llm_available, llm_complete

LEVEL_PRIORITY = {"Critical": 3, "High": 2, "Medium": 1, "Low": 0}


def _weekly_case_estimate(score: float, population: int) -> int:
    return int(score * (population / 100_000) * 32 * 1.2)


def _driver_actions(drivers: list[str]) -> list[str]:
    text = " ".join(drivers).lower()
    actions: list[str] = []
    if "rain" in text:
        actions.append("Larval source reduction — drain standing water in flagged wards (rainfall is a leading driver).")
    if "humid" in text:
        actions.append("Intensify indoor residual spraying — high humidity is prolonging Aedes survival.")
    if "case" in text:
        actions.append("Active case finding & isolation — transmission is already established (autoregressive signal).")
    if "urban" in text or "density" in text:
        actions.append("Concentrate fogging on dense urban wards first.")
    if "temp" in text:
        actions.append("Expect accelerated mosquito breeding cycles — front-load vector control this week.")
    return actions[:3]


def _level_actions(level: str) -> list[str]:
    return {
        "Critical": [
            "Activate district emergency response cell immediately.",
            "Mobilise surge capacity and escalate to DGHS central command.",
            "Deploy 8–12 fogging teams across the district this week.",
        ],
        "High": [
            "Pre-position fogging teams and pre-allocate dengue ward beds.",
            "Issue public media advisories within 48 hours.",
            "Deploy 4–6 fogging teams to highest-density unions.",
        ],
        "Medium": [
            "Prepare fogging equipment and begin awareness messaging.",
            "Verify test-kit and IV-fluid stock levels.",
        ],
    }.get(level, ["Maintain routine surveillance."])


def _fogging_teams(level: str) -> int:
    return {"Critical": 10, "High": 5, "Medium": 2}.get(level, 0)


def _draft_sms(name: str, level: str) -> str:
    return f"PrevDengue ALERT: {name} forecast {level}. Activate vector control & ready dengue beds. prevdengue.app/d/{name.lower()}"[:160]


def _build_plan(db: Session) -> dict:
    preds = (
        db.query(Prediction)
        .filter(Prediction.forecast_week == 1)
        .all()
    )
    districts = {d.id: d for d in db.query(District).all()}
    hospitals_by_district: dict[int, list[Hospital]] = {}
    for h in db.query(Hospital).all():
        hospitals_by_district.setdefault(h.district_id, []).append(h)

    total = len(preds)
    hotspot_preds = [p for p in preds if p.risk_level in ("High", "Critical")]
    n_high = sum(p.risk_level == "High" for p in preds)
    n_crit = sum(p.risk_level == "Critical" for p in preds)

    actions = []
    total_fogging = 0
    total_gap = 0
    total_hospitals = 0
    for p in hotspot_preds:
        d = districts[p.district_id]
        drivers = [s["label"] for s in (p.shap_values or {}).get("top", [])][:4]
        weekly = _weekly_case_estimate(p.risk_score, d.population)
        surge_beds = int(weekly * 0.4)
        hosps = sorted(hospitals_by_district.get(d.id, []), key=lambda h: -h.dengue_beds)
        avail = sum(h.dengue_beds for h in hosps)
        gap = max(0, surge_beds - avail)
        fogging = _fogging_teams(p.risk_level)
        priority = round(p.risk_score * math.log10(max(d.population, 10)), 3)

        total_fogging += fogging
        total_gap += gap
        total_hospitals += len(hosps)

        actions.append({
            "district_id": d.id,
            "district": d.name,
            "division": d.division,
            "risk_level": p.risk_level,
            "risk_score": p.risk_score,
            "priority": priority,
            "drivers": drivers,
            "est_weekly_cases": weekly,
            "surge_beds_needed": surge_beds,
            "dengue_beds_available": avail,
            "bed_gap": gap,
            "fogging_teams": fogging,
            "recommendations": _driver_actions(drivers) + _level_actions(p.risk_level),
            "hospitals": [
                {"id": h.id, "name": h.name, "type": h.type, "dengue_beds": h.dengue_beds,
                 "phone": h.phone, "distance_km": h.dist_from_center_km}
                for h in hosps[:4]
            ],
            "draft_sms": _draft_sms(d.name, p.risk_level),
        })

    actions.sort(key=lambda a: (-LEVEL_PRIORITY[a["risk_level"]], -a["priority"]))

    # ---- reasoning trace (the visible agentic loop) ----
    trace = [
        {"tool": "perceive_forecast",
         "title": "Perceived national forecast",
         "detail": f"Ingested risk predictions for {total} districts. Detected "
                   f"{n_crit} Critical and {n_high} High-risk districts for the next 1–4 weeks."},
        {"tool": "rank_hotspots",
         "title": "Prioritised hotspots",
         "detail": f"Ranked {len(hotspot_preds)} at-risk districts by risk score × population "
                   f"exposure to focus limited resources where they avert the most cases."},
        {"tool": "explain_drivers",
         "title": "Read SHAP drivers",
         "detail": "Queried the model's SHAP attributions per district to tailor interventions "
                   "to the actual environmental drivers (rainfall, humidity, established transmission)."},
        {"tool": "locate_hospitals",
         "title": "Mapped hospital capacity",
         "detail": f"Located {total_hospitals} hospitals across the hotspot districts and summed "
                   f"dengue-ready bed capacity to compute surge gaps."},
        {"tool": "compute_resources",
         "title": "Computed resource plan",
         "detail": f"Recommended {total_fogging} fogging teams in total and flagged an aggregate "
                   f"shortfall of {total_gap:,} dengue beds vs. projected demand."},
        {"tool": "draft_alerts",
         "title": "Drafted targeted alerts",
         "detail": f"Composed {len(actions)} district-specific advisories addressed to District "
                   f"Health Officers and local hospitals. Awaiting human authorisation to dispatch."},
    ]

    headline = (
        f"{n_crit + n_high} districts need intervention this cycle. "
        f"Top priority: {actions[0]['district']} ({actions[0]['risk_level']})." if actions
        else "No districts currently exceed the High-risk threshold. Maintain routine surveillance."
    )

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "headline": headline,
        "stats": {
            "districts_total": total,
            "critical": n_crit,
            "high": n_high,
            "fogging_teams_recommended": total_fogging,
            "bed_gap_total": total_gap,
            "alerts_drafted": len(actions),
        },
        "trace": trace,
        "actions": actions,
    }


def _context_from_plan(plan: dict) -> str:
    s = plan["stats"]
    lines = [
        f"National dengue forecast (next 1-4 weeks): {s['critical']} Critical and {s['high']} High-risk "
        f"districts out of {s['districts_total']}. Aggregate dengue-bed shortfall ~{s['bed_gap_total']} beds; "
        f"{s['fogging_teams_recommended']} fogging teams recommended.",
        "Top at-risk districts:",
    ]
    for a in plan["actions"][:12]:
        lines.append(
            f"- {a['district']} ({a['division']}): {a['risk_level']}, score {int(a['risk_score']*100)}/100, "
            f"~{a['est_weekly_cases']} cases/week, bed gap {a['bed_gap']}, "
            f"key drivers: {', '.join(a['drivers'][:3]) or 'n/a'}."
        )
    lines.append("Districts not listed are below the High-risk threshold (Low/Medium).")
    return "\n".join(lines)


def _forecast_context(db: Session) -> str:
    return _context_from_plan(_build_plan(db))


def generate_action_plan(db: Session) -> dict:
    plan = _build_plan(db)
    plan["llm"] = llm_available()
    if llm_available() and plan["actions"]:
        briefing = llm_complete(
            system=(
                "You are PrevDengue's senior epidemiology advisor for Bangladesh's DGHS. "
                "Write a crisp 3-4 sentence executive briefing for health officials based ONLY on the "
                "data provided: name the top priority districts, the main environmental drivers, the bed "
                "shortfall, and the single most urgent action. Authoritative, no fluff, no markdown."
            ),
            user=_context_from_plan(plan),
            max_tokens=320,
        )
        if briefing:
            plan["briefing"] = briefing
    return plan


# Central government / DGHS national emergency desk (escalation target).
DGHS_RECIPIENT = "DGHS Central Command"
DGHS_EMAIL = "emergency@dghs.gov.bd"


def _needs_escalation(action: dict) -> bool:
    """Escalate to central government when urgency is high or beds fall short."""
    return action["risk_level"] == "Critical" or action["bed_gap"] > 0


def _bed_status(action: dict) -> str:
    if action["bed_gap"] > 0:
        return (f"dengue beds SHORT by {action['bed_gap']:,} "
                f"(have {action['dengue_beds_available']}, need {action['surge_beds_needed']})")
    return f"dengue beds sufficient ({action['dengue_beds_available']}/{action['surge_beds_needed']})"


def _hospital_message(action: dict) -> str:
    """Full advisory for hospitals — names the bed shortfall and the next action."""
    lead = action["recommendations"][0] if action["recommendations"] else "Ready dengue beds and triage."
    return (f"PrevDengue {action['risk_level'].upper()} — {action['district']}: "
            f"~{action['est_weekly_cases']:,} cases/wk projected; {_bed_status(action)}. {lead}")


def _gov_escalation_message(action: dict) -> str:
    """Escalation notice to the central government / DGHS authority."""
    if action["bed_gap"] > 0:
        ask = (f"REQUEST: bed-surge support / inter-district transfer for {action['bed_gap']:,} beds "
               f"and {action['fogging_teams']} fogging teams.")
    else:
        ask = f"REQUEST: {action['fogging_teams']} fogging teams and standby surge support."
    return (f"ESCALATION — {action['district']} ({action['division']}) is {action['risk_level'].upper()}. "
            f"~{action['est_weekly_cases']:,} cases/wk projected; {_bed_status(action)}. {ask}")


def execute_plan(db: Session, district_ids: list[int] | None = None) -> dict:
    """Dispatch the plan to hospitals + DHOs, and escalate urgent / bed-short
    districts to the central government (DGHS) authority (PRD 6.3 + hospital link)."""
    plan = _build_plan(db)
    selected = {a["district_id"]: a for a in plan["actions"]}
    if district_ids:
        selected = {k: v for k, v in selected.items() if k in district_ids}

    hospitals_by_district: dict[int, list[Hospital]] = {}
    for h in db.query(Hospital).all():
        hospitals_by_district.setdefault(h.district_id, []).append(h)

    now = datetime.now(timezone.utc)
    alerts_created = 0
    hospitals_notified = 0
    dghs_escalations = 0
    escalated_districts: list[str] = []

    for did, action in selected.items():
        hosp_body = _hospital_message(action)
        # Notify every hospital in the district directly (with bed-shortfall context).
        for h in hospitals_by_district.get(did, []):
            status = _simulate_send("email", h.email, hosp_body)
            db.add(Alert(
                district_id=did, alert_type="agent", risk_level=action["risk_level"],
                channel="email", recipient=h.email, status=status, message=hosp_body,
                delivered_at=now,
            ))
            hospitals_notified += 1
            alerts_created += 1

        # Notify the District Health Officer by SMS (short form).
        status = _simulate_send("sms", "+8801711000000", action["draft_sms"])
        db.add(Alert(
            district_id=did, alert_type="agent", risk_level=action["risk_level"],
            channel="sms", recipient=f"DHO {action['district']}", status=status,
            message=action["draft_sms"], delivered_at=now,
        ))
        alerts_created += 1

        # Escalate to the central government / DGHS authority when urgent or short on beds.
        if _needs_escalation(action):
            gov_body = _gov_escalation_message(action)
            status = _simulate_send("email", DGHS_EMAIL, gov_body)
            db.add(Alert(
                district_id=did, alert_type="escalation", risk_level=action["risk_level"],
                channel="email", recipient=DGHS_RECIPIENT, status=status, message=gov_body,
                delivered_at=now,
            ))
            alerts_created += 1
            dghs_escalations += 1
            escalated_districts.append(action["district"])

    db.commit()

    return {
        "executed_at": now.isoformat(),
        "districts_actioned": len(selected),
        "hospitals_notified": hospitals_notified,
        "dghs_escalations": dghs_escalations,
        "escalated_districts": escalated_districts,
        "alerts_created": alerts_created,
    }


# ---------------------------------------------------------------------------
# Citizen-facing assistant — plain-language, personalised, bilingual.
# ---------------------------------------------------------------------------

_SITUATION = {
    "Critical": {
        "en": "Dengue risk in {d} is VERY HIGH right now. Disease-carrying mosquitoes are highly active and cases are expected to rise sharply over the next 2–4 weeks. Please protect your household today.",
        "bn": "{d}-এ এখন ডেঙ্গুর ঝুঁকি অত্যন্ত বেশি। ডেঙ্গুবাহী মশা খুব সক্রিয় এবং আগামী ২–৪ সপ্তাহে রোগী দ্রুত বাড়তে পারে। অনুগ্রহ করে আজই আপনার পরিবারকে রক্ষা করুন।",
    },
    "High": {
        "en": "Dengue risk in {d} is HIGH. Cases are climbing in your area. Now is the time to remove mosquito breeding spots and watch for fever.",
        "bn": "{d}-এ ডেঙ্গুর ঝুঁকি বেশি। আপনার এলাকায় রোগী বাড়ছে। এখনই মশার প্রজননস্থল ধ্বংস করুন এবং জ্বরের দিকে খেয়াল রাখুন।",
    },
    "Medium": {
        "en": "Dengue risk in {d} is MODERATE. It's a good time to take simple precautions before risk rises further.",
        "bn": "{d}-এ ডেঙ্গুর ঝুঁকি মাঝারি। ঝুঁকি আরও বাড়ার আগে এখনই সাধারণ সতর্কতা নেওয়া ভালো।",
    },
    "Low": {
        "en": "Dengue risk in {d} is currently LOW. Stay aware, but no urgent action is needed right now.",
        "bn": "{d}-এ এই মুহূর্তে ডেঙ্গুর ঝুঁকি কম। সচেতন থাকুন, তবে এখনই জরুরি কিছু করার দরকার নেই।",
    },
}

_PREVENTION = {
    "en": [
        "Empty and scrub any container that holds water (buckets, flower pots, tyres) twice a week.",
        "Use mosquito repellent and sleep under a net, even during the day.",
        "Wear long sleeves and trousers around dawn and dusk when Aedes mosquitoes bite.",
        "Keep doors and windows screened; cover water-storage tanks.",
    ],
    "bn": [
        "যেসব পাত্রে পানি জমে (বালতি, ফুলের টব, টায়ার) সপ্তাহে দুবার খালি করে পরিষ্কার করুন।",
        "মশা প্রতিরোধক ব্যবহার করুন এবং দিনের বেলাতেও মশারির নিচে ঘুমান।",
        "ভোরে ও সন্ধ্যায় লম্বা হাতা জামা ও ফুলপ্যান্ট পরুন, তখন এডিস মশা কামড়ায়।",
        "দরজা-জানালায় নেট লাগান; পানির ট্যাংক ঢেকে রাখুন।",
    ],
}

_REC = {
    "emergency": {
        "label": {"en": "Emergency", "bn": "জরুরি"},
        "tone": "red",
        "en": "Go to a hospital immediately. Bleeding gums or nose, vomiting blood, or severe belly pain can be signs of severe dengue — this is a medical emergency. Do not wait.",
        "bn": "এখনই হাসপাতালে যান। মাড়ি বা নাক দিয়ে রক্তপাত, রক্ত বমি, বা তীব্র পেটব্যথা মারাত্মক ডেঙ্গুর লক্ষণ হতে পারে — এটি জরুরি অবস্থা। দেরি করবেন না।",
    },
    "soon": {
        "label": {"en": "See a doctor soon", "bn": "শীঘ্রই ডাক্তার দেখান"},
        "tone": "amber",
        "en": "See a doctor within 24 hours and ask for a dengue test (NS1 or CBC). Rest, drink plenty of fluids, and use only paracetamol for fever — avoid ibuprofen and aspirin, which can worsen bleeding.",
        "bn": "২৪ ঘণ্টার মধ্যে ডাক্তার দেখান এবং ডেঙ্গু পরীক্ষা (NS1 বা CBC) করান। বিশ্রাম নিন, প্রচুর তরল পান করুন, জ্বরে শুধু প্যারাসিটামল নিন — ইবুপ্রোফেন ও অ্যাসপিরিন এড়িয়ে চলুন, এতে রক্তপাত বাড়তে পারে।",
    },
    "monitor": {
        "label": {"en": "Monitor at home", "bn": "বাড়িতে পর্যবেক্ষণ"},
        "tone": "emerald",
        "en": "No alarming symptoms right now. Keep monitoring your temperature. If a fever appears and lasts more than two days, get a dengue test. Stay hydrated and rest.",
        "bn": "এখন উদ্বেগজনক কোনো লক্ষণ নেই। তাপমাত্রা খেয়াল রাখুন। দুই দিনের বেশি জ্বর থাকলে ডেঙ্গু পরীক্ষা করান। পর্যাপ্ত পানি পান করুন ও বিশ্রাম নিন।",
    },
}


def _citizen_urgency(symptoms: list[str], level: str) -> str:
    if "bleed" in symptoms:
        return "emergency"
    active = [s for s in symptoms if s != "none"]
    if "fever" in symptoms or len(active) >= 2:
        return "soon"
    if not active and level in ("High", "Critical"):
        return "monitor"
    return "monitor"


def citizen_brief(
    db: Session,
    district_name: str,
    symptoms: list[str] | None = None,
    language: str = "en",
) -> dict:
    symptoms = symptoms or []
    d = db.query(District).filter(District.name == district_name).first()
    if not d:
        return {"error": "Unknown district"}
    pred = (
        db.query(Prediction)
        .filter(Prediction.district_id == d.id, Prediction.forecast_week == 1)
        .first()
    )
    level = pred.risk_level if pred else "Low"
    score = int((pred.risk_score if pred else 0.1) * 100)

    hospitals = db.query(Hospital).filter(Hospital.district_id == d.id).all()
    near = []
    for h in hospitals:
        near.append({
            "id": h.id, "name": h.name, "type": h.type, "dengue_beds": h.dengue_beds,
            "phone": h.phone, "distance_km": haversine_km(d.lat, d.lon, h.lat, h.lon),
        })
    near.sort(key=lambda x: x["distance_km"])
    near = near[:4]

    urgency = _citizen_urgency(symptoms, level)
    rec = _REC[urgency]

    ai_note = None
    if llm_available():
        sym_text = ", ".join(s for s in symptoms if s != "none") or "none reported"
        lang_name = "Bengali" if language == "bn" else "English"
        ai_note = llm_complete(
            system=(
                "You are PrevDengue's warm, reassuring health assistant for ordinary citizens in Bangladesh. "
                f"Reply in {lang_name}, in 2-3 simple sentences a non-expert understands. Explain what the dengue "
                "situation means for this person and the single most important thing to do now. Be calm, not alarming. "
                "If symptoms include bleeding/vomiting blood, stress going to hospital immediately. Standard advice: "
                "paracetamol only, fluids, see a doctor for persistent fever. No markdown, no lists."
            ),
            user=(
                f"District: {d.name}. Current dengue risk: {level} ({score}/100). "
                f"Reported symptoms: {sym_text}. Nearest hospital: "
                f"{near[0]['name'] if near else 'unknown'} ({near[0]['distance_km'] if near else '?'} km)."
            ),
            max_tokens=220,
            temperature=0.5,
        )

    return {
        "ai_note": ai_note,
        "district": d.name,
        "district_bn": d.name_bn,
        "risk_level": level,
        "risk_score": score,
        "situation": {
            "en": _SITUATION[level]["en"].format(d=d.name),
            "bn": _SITUATION[level]["bn"].format(d=d.name_bn),
        },
        "recommendation": {
            "en": rec["en"], "bn": rec["bn"],
            "label": rec["label"], "tone": rec["tone"], "urgency": urgency,
        },
        "prevention": _PREVENTION,
        "nearest": near,
        "nearest_line": {
            "en": (f"Your closest facility is {near[0]['name']}, about {near[0]['distance_km']} km away "
                   f"({near[0]['dengue_beds']} dengue beds)." if near else ""),
            "bn": (f"আপনার নিকটতম স্বাস্থ্যকেন্দ্র {near[0]['name']}, প্রায় {near[0]['distance_km']} কিমি দূরে "
                   f"({near[0]['dengue_beds']}টি ডেঙ্গু শয্যা)।" if near else ""),
        },
    }


def answer_question(db: Session, question: str) -> dict:
    """Lightweight grounded Q&A over the live forecast (deterministic intents)."""
    # ---- LLM-first, grounded in the live forecast ----
    if llm_available():
        try:
            context = _forecast_context(db)
        except Exception:  # noqa: BLE001
            context = ""
        answer = llm_complete(
            system=(
                "You are PrevDengue's AI assistant for dengue early warning in Bangladesh. "
                "Answer in 2-4 short, plain, actionable sentences. Use ONLY the live data provided for "
                "district risk numbers; if a district is not listed, say it is below the High-risk threshold. "
                "For health questions, give safe standard dengue guidance: paracetamol only (never ibuprofen/aspirin), "
                "fluids and rest, see a doctor within 24h of fever, and go to hospital for warning signs "
                "(bleeding, vomiting blood, severe abdominal pain). Reply in the SAME language as the question "
                "(English or Bengali). Do not invent statistics. Plain text only — no markdown, asterisks or bullet symbols."
            ),
            user=f"Live forecast data:\n{context}\n\nUser question: {question}",
            max_tokens=300,
        )
        if answer:
            return {"answer": answer, "model": "openrouter"}

    q = question.lower().strip()

    # ---- general citizen-health intents (no data lookup needed) ----
    if any(w in q for w in ("prevent", "avoid", "protect", "stop mosquito", "breeding")):
        return {"answer": "To prevent dengue: empty and scrub water containers twice a week, "
                "use repellent and sleep under a net (even by day), wear long sleeves at dawn/dusk, "
                "and cover water tanks. Aedes mosquitoes breed in clean, standing water around the home."}
    if any(w in q for w in ("symptom", "sign", "feel")):
        return {"answer": "Common dengue symptoms: high fever (above 39°C), severe headache, pain behind "
                "the eyes, muscle and joint pain, nausea, and rash. WARNING signs needing a hospital now: "
                "bleeding gums/nose, vomiting blood, severe belly pain, or restlessness."}
    if "test" in q:
        return {"answer": "If you have fever for more than 2 days in a high-risk area, get an NS1 antigen "
                "test (early) or a CBC/NS1 combination from any district hospital or diagnostic centre."}
    if any(w in q for w in ("treat", "medicine", "paracetamol", "what to do if fever")):
        return {"answer": "For suspected dengue: rest, drink plenty of fluids, and take ONLY paracetamol "
                "for fever. Avoid ibuprofen and aspirin — they raise bleeding risk. See a doctor within "
                "24 hours and go to a hospital immediately if any warning signs appear."}
    if "what is dengue" in q or ("dengue" in q and "what" in q):
        return {"answer": "Dengue is a viral infection spread by Aedes mosquitoes that bite mainly at dawn "
                "and dusk. Most cases are mild, but severe dengue can be life-threatening, which is why "
                "early testing and avoiding mosquito bites matter."}

    plan = _build_plan(db)
    districts = db.query(District).all()

    # district mention
    for d in districts:
        if d.name.lower() in q:
            pred = (
                db.query(Prediction)
                .filter(Prediction.district_id == d.id, Prediction.forecast_week == 1)
                .first()
            )
            action = next((a for a in plan["actions"] if a["district_id"] == d.id), None)
            if action:
                recs = " ".join(f"• {r}" for r in action["recommendations"][:3])
                return {"answer": f"{d.name} is forecast {action['risk_level']} "
                        f"(score {int(action['risk_score']*100)}/100). Estimated {action['est_weekly_cases']:,} "
                        f"cases/week with a bed gap of {action['bed_gap']:,}. Recommended: {recs}"}
            lvl = pred.risk_level if pred else "Low"
            return {"answer": f"{d.name} is currently {lvl} risk and below the intervention threshold. "
                    f"Maintain routine surveillance."}

    if any(w in q for w in ("worst", "highest", "top", "most at risk", "priority")):
        if plan["actions"]:
            a = plan["actions"][0]
            return {"answer": f"The highest-priority district is {a['district']} ({a['division']}) at "
                    f"{a['risk_level']} risk (score {int(a['risk_score']*100)}/100), with an estimated "
                    f"bed gap of {a['bed_gap']:,}. {a['recommendations'][0] if a['recommendations'] else ''}"}
        return {"answer": "No districts are above the High-risk threshold right now."}

    if "how many" in q or "count" in q:
        s = plan["stats"]
        return {"answer": f"{s['critical']} districts are Critical and {s['high']} are High risk this cycle "
                f"({s['critical'] + s['high']} needing intervention)."}

    if "bed" in q or "capacity" in q or "hospital" in q:
        s = plan["stats"]
        return {"answer": f"Across all hotspot districts the projected dengue-bed shortfall is "
                f"{s['bed_gap_total']:,} beds. I recommend redistributing capacity toward the top-priority districts."}

    # default summary
    return {"answer": plan["headline"] + " Ask me about a specific district, the worst hotspots, "
            "or hospital bed capacity."}
