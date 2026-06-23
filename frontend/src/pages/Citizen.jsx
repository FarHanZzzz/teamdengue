import { useEffect, useRef, useState } from "react";
import { endpoints } from "../lib/api";
import { useI18n } from "../context/I18nContext";
import RiskBadge from "../components/RiskBadge";
import { RISK_HEX } from "../lib/risk";

const TONE = {
  red: "border-red-200 bg-red-50 text-red-800",
  amber: "border-amber-200 bg-amber-50 text-amber-800",
  emerald: "border-emerald-200 bg-emerald-50 text-emerald-800",
};

export default function Citizen() {
  const { t, lang, isBn } = useI18n();
  const L = (obj) => (obj ? (lang === "bn" ? obj.bn : obj.en) : "");

  const [districts, setDistricts] = useState([]);
  const [selected, setSelected] = useState("");
  const [brief, setBrief] = useState(null);
  const [loading, setLoading] = useState(false);
  const [symptoms, setSymptoms] = useState([]);
  const [checked, setChecked] = useState(false);

  const [evaluating, setEvaluating] = useState(false);
  const resultRef = useRef();

  const [chat, setChat] = useState([]);
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const chatEnd = useRef();

  useEffect(() => {
    endpoints.districts().then(setDistricts).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selected) return;
    setLoading(true);
    setChecked(false);
    setSymptoms([]);
    endpoints
      .agentCitizen(selected, [], lang)
      .then(setBrief)
      .catch(() => setBrief(null))
      .finally(() => setLoading(false));
  }, [selected, lang]);

  useEffect(() => {
    chatEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat, asking]);

  const SYMPTOMS = [
    { id: "bleed", label: t("symptom_bleed") },
    { id: "fever", label: t("symptom_fever") },
    { id: "rash", label: t("symptom_rash") },
    { id: "pain", label: t("symptom_pain") },
    { id: "none", label: t("symptom_none"), none: true },
  ];

  const toggle = (s) => {
    setChecked(false);
    if (s.none) return setSymptoms(["none"]);
    setSymptoms((prev) => {
      const next = prev.filter((x) => x !== "none");
      return next.includes(s.id) ? next.filter((x) => x !== s.id) : [...next, s.id];
    });
  };

  const evaluate = () => {
    if (!symptoms.length || evaluating) return;
    setEvaluating(true);
    endpoints
      .agentCitizen(selected, symptoms, lang)
      .then((b) => {
        setBrief(b);
        setChecked(true);
        requestAnimationFrame(() =>
          resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
        );
      })
      .catch(() => {})
      .finally(() => setEvaluating(false));
  };

  const ask = async (e) => {
    e.preventDefault();
    if (!question.trim()) return;
    const q = question;
    setQuestion("");
    setChat((c) => [...c, { role: "user", text: q }]);
    setAsking(true);
    try {
      const r = await endpoints.agentAsk(q);
      setChat((c) => [...c, { role: "agent", text: r.answer }]);
    } finally {
      setAsking(false);
    }
  };

  const suggestions = isBn
    ? ["আমার এলাকায় কী অবস্থা?", "কীভাবে ডেঙ্গু প্রতিরোধ করব?", "ডেঙ্গুর লক্ষণ কী?"]
    : ["What's the situation in my area?", "How do I prevent dengue?", "What are the symptoms?"];

  return (
    <div className={`mx-auto max-w-5xl animate-fade-in px-4 py-8 sm:px-6 ${isBn ? "font-bn" : ""}`}>
      {/* Intro */}
      <div className="text-center">
        <span className="chip bg-brand-50 text-brand-700">{isBn ? "এআই স্বাস্থ্য সহকারী" : "AI Health Assistant"}</span>
        <h1 className="mt-3 text-3xl font-extrabold text-slate-900">{t("citizen_title")}</h1>
        <p className="mt-2 text-slate-500">
          {isBn
            ? "আপনার জেলা বেছে নিন — সহকারী সহজ ভাষায় বলবে এখন কী করতে হবে।"
            : "Pick your district — the assistant explains, in plain language, exactly what to do."}
        </p>
      </div>

      {/* Step 1: district */}
      <div className="mx-auto mt-6 max-w-xl">
        <label className="mb-1 block text-sm font-semibold text-slate-700">
          <span className="mr-2 rounded bg-slate-900 px-1.5 py-0.5 text-[10px] text-white">1</span>
          {t("citizen_select")}
        </label>
        <select className="input text-base" value={selected} onChange={(e) => setSelected(e.target.value)}>
          <option value="">— {t("citizen_select")} —</option>
          {districts.map((d) => (
            <option key={d.id} value={d.name}>
              {lang === "bn" ? d.name_bn : d.name} ({d.division})
            </option>
          ))}
        </select>
      </div>

      {loading && <p className="mt-8 text-center text-slate-400">{isBn ? "লোড হচ্ছে…" : "Loading…"}</p>}

      {brief && !loading && (
        <div className="mt-8 space-y-6">
          {/* Assistant situation card — the centerpiece */}
          <div ref={resultRef} className="card overflow-hidden scroll-mt-20">
            <div
              className="flex items-start gap-4 p-5"
              style={{ background: `linear-gradient(90deg, ${RISK_HEX[brief.risk_level]}14, transparent)` }}
            >
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-600 text-lg text-white">✦</span>
              <div className="flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-bold text-slate-900">
                    {isBn ? "প্রিভডেঙ্গু সহকারী" : "PrevDengue Assistant"}
                  </p>
                  <RiskBadge level={brief.risk_level} score={brief.risk_score / 100} />
                </div>
                <p className="mt-2 text-[15px] leading-relaxed text-slate-700">{brief.ai_note || L(brief.situation)}</p>
                {brief.ai_note && (
                  <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-brand-500">
                    ✦ {isBn ? "এআই দ্বারা তৈরি" : "AI-generated"}
                  </p>
                )}
                {brief.nearest_line && (
                  <p className="mt-2 text-sm font-medium text-brand-700">📍 {L(brief.nearest_line)}</p>
                )}
              </div>
            </div>

            {/* personalised recommendation */}
            <div className={`m-5 mt-0 rounded-xl border p-4 transition ${TONE[brief.recommendation.tone]} ${checked ? "ring-2 ring-offset-2 ring-brand-400" : ""}`}>
              <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide">
                {checked ? (isBn ? "আপনার লক্ষণ অনুযায়ী পরামর্শ" : "Recommendation for your symptoms") : (isBn ? "সাধারণ পরামর্শ" : "General guidance")}
                <span className="rounded-full bg-white/60 px-2 py-0.5">{L(brief.recommendation.label)}</span>
              </p>
              <p className="mt-1.5 text-sm leading-relaxed">{L(brief.recommendation)}</p>
            </div>
          </div>

          {/* Step 2 + chat */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Symptom checker */}
            <div className="card p-6">
              <h2 className="text-lg font-bold text-slate-900">
                <span className="mr-2 rounded bg-slate-900 px-1.5 py-0.5 text-[10px] text-white">2</span>
                {t("citizen_symptom")}
              </h2>
              <p className="mt-1 text-sm text-slate-500">{t("symptom_q")}</p>
              <div className="mt-3 space-y-2">
                {SYMPTOMS.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => toggle(s)}
                    className={`flex w-full items-center gap-3 rounded-xl border px-4 py-2.5 text-left text-sm transition ${
                      symptoms.includes(s.id)
                        ? "border-brand-500 bg-brand-50 text-brand-800"
                        : "border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <span className={`grid h-5 w-5 place-items-center rounded-md border ${
                      symptoms.includes(s.id) ? "border-brand-600 bg-brand-600 text-white" : "border-slate-300"
                    }`}>
                      {symptoms.includes(s.id) ? "✓" : ""}
                    </span>
                    {s.label}
                  </button>
                ))}
              </div>
              <button
                onClick={evaluate}
                disabled={!symptoms.length || evaluating}
                className="btn-primary mt-4 flex w-full items-center justify-center gap-2 disabled:opacity-60"
              >
                {evaluating && (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                )}
                {evaluating ? (isBn ? "পরামর্শ তৈরি হচ্ছে…" : "Getting recommendation…") : t("symptom_check")}
              </button>
              {checked && !evaluating ? (
                <p className="mt-2 flex items-center justify-center gap-1 text-center text-[11px] font-medium text-brand-600">
                  ✓ {isBn ? "পরামর্শ উপরে দেখানো হয়েছে ↑" : "Recommendation updated above ↑"}
                </p>
              ) : (
                <p className="mt-2 text-center text-[11px] text-slate-400">
                  {isBn ? "উত্তর উপরে সহকারীর কার্ডে দেখানো হবে।" : "Your answer appears in the assistant card above."}
                </p>
              )}
            </div>

            {/* Chat assistant */}
            <div className="card flex flex-col p-6">
              <h2 className="text-lg font-bold text-slate-900">
                {isBn ? "সহকারীকে জিজ্ঞাসা করুন" : "Ask the assistant"}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {isBn ? "ডেঙ্গু, লক্ষণ বা প্রতিরোধ নিয়ে যেকোনো প্রশ্ন।" : "Any question about dengue, symptoms or prevention."}
              </p>
              <div className="scroll-thin mt-3 flex-1 space-y-2 overflow-y-auto" style={{ maxHeight: 220 }}>
                {chat.length === 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {suggestions.map((s) => (
                      <button key={s} onClick={() => setQuestion(s)} className="chip bg-slate-100 text-slate-600 hover:bg-slate-200">
                        {s}
                      </button>
                    ))}
                  </div>
                )}
                {chat.map((m, i) => (
                  <div key={i} className={`rounded-xl px-3 py-2 text-sm ${m.role === "user" ? "ml-6 bg-brand-600 text-white" : "mr-6 bg-slate-100 text-slate-700"}`}>
                    {m.text}
                  </div>
                ))}
                {asking && <div className="mr-6 rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-400">{isBn ? "ভাবছি…" : "thinking…"}</div>}
                <div ref={chatEnd} />
              </div>
              <form onSubmit={ask} className="mt-3 flex gap-2">
                <input className="input" placeholder={isBn ? "প্রশ্ন লিখুন…" : "Type a question…"} value={question} onChange={(e) => setQuestion(e.target.value)} />
                <button className="btn-primary px-4">{isBn ? "পাঠান" : "Ask"}</button>
              </form>
            </div>
          </div>

          {/* Prevention */}
          <div className="card p-6">
            <h2 className="text-lg font-bold text-slate-900">{isBn ? "প্রতিরোধে করণীয়" : "How to protect yourself"}</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {(lang === "bn" ? brief.prevention.bn : brief.prevention.en).map((p, i) => (
                <div key={i} className="flex gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3 text-sm text-slate-700">
                  <span className="text-brand-600">✓</span>{p}
                </div>
              ))}
            </div>
          </div>

          {/* Nearest facilities */}
          <div className="card p-6">
            <h2 className="text-lg font-bold text-slate-900">{t("nearest")}</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {brief.nearest.map((f, i) => (
                <div key={f.id} className={`rounded-xl border p-4 ${i === 0 ? "border-brand-200 bg-brand-50" : "border-slate-100 bg-slate-50"}`}>
                  {i === 0 && <p className="mb-1 text-[10px] font-bold uppercase text-brand-600">{isBn ? "নিকটতম" : "Closest"}</p>}
                  <p className="font-semibold text-slate-800">{f.name}</p>
                  <p className="text-xs text-slate-500">{f.type}</p>
                  <div className="mt-2 flex items-center justify-between text-xs">
                    <span className="font-bold text-brand-700">{f.distance_km} km</span>
                    <span className="text-slate-500">{f.dengue_beds} {isBn ? "ডেঙ্গু শয্যা" : "dengue beds"}</span>
                  </div>
                  <a href={`tel:${f.phone}`} className="mt-2 block text-xs font-medium text-brand-700 hover:underline">
                    ☎ {f.phone}
                  </a>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
