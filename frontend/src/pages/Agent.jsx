import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { endpoints } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import RiskBadge from "../components/RiskBadge";
import Spinner from "../components/Spinner";
import { RISK_HEX } from "../lib/risk";

const TOOL_ICON = {
  perceive_forecast: "🛰️",
  rank_hotspots: "📊",
  explain_drivers: "🧠",
  locate_hospitals: "🏥",
  compute_resources: "🧮",
  draft_alerts: "✉️",
};

function ReasoningTrace({ steps, revealed }) {
  return (
    <ol className="relative ml-3 border-l-2 border-slate-200">
      {steps.map((s, i) => {
        const on = i < revealed;
        return (
          <li key={i} className="mb-4 ml-5">
            <span
              className={`absolute -left-[13px] grid h-6 w-6 place-items-center rounded-full text-xs transition ${
                on ? "bg-brand-600 text-white" : "bg-slate-200 text-slate-400"
              }`}
            >
              {on ? "✓" : i + 1}
            </span>
            <div className={`transition ${on ? "opacity-100" : "opacity-40"}`}>
              <p className="text-sm font-semibold text-slate-800">
                {TOOL_ICON[s.tool] || "•"} {s.title}
              </p>
              <p className="text-xs text-slate-500">{s.detail}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function ActionCard({ a, rank, onDispatch, isAdmin, busy }) {
  const nav = useNavigate();
  const coverage = a.surge_beds_needed
    ? Math.min(100, Math.round((a.dengue_beds_available / a.surge_beds_needed) * 100))
    : 100;
  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-slate-900 text-sm font-bold text-white">
            {rank}
          </span>
          <div>
            <button onClick={() => nav(`/district/${a.district_id}`)} className="text-lg font-bold text-slate-900 hover:text-brand-700">
              {a.district}
            </button>
            <p className="text-xs text-slate-500">{a.division} · ~{a.est_weekly_cases.toLocaleString()} cases/wk projected</p>
          </div>
        </div>
        <RiskBadge level={a.risk_level} score={a.risk_score} />
      </div>

      {/* drivers */}
      {a.drivers.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {a.drivers.map((d) => (
            <span key={d} className="chip bg-slate-100 text-slate-600">{d}</span>
          ))}
        </div>
      )}

      {/* bed capacity */}
      <div className="mt-4 rounded-xl bg-slate-50 p-3">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-slate-700">Dengue-bed coverage</span>
          <span className={a.bed_gap > 0 ? "font-bold text-red-600" : "font-bold text-emerald-600"}>
            {a.dengue_beds_available} / {a.surge_beds_needed} beds {a.bed_gap > 0 ? `· short ${a.bed_gap}` : "· sufficient"}
          </span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
          <div className="h-full rounded-full" style={{ width: `${coverage}%`, background: coverage >= 100 ? "#27AE60" : coverage >= 60 ? "#F1C40F" : "#C0392B" }} />
        </div>
      </div>

      {/* recommendations */}
      <ul className="mt-3 space-y-1.5">
        {a.recommendations.slice(0, 4).map((r, i) => (
          <li key={i} className="flex gap-2 text-sm text-slate-600">
            <span className="mt-0.5 text-brand-600">▸</span>{r}
          </li>
        ))}
      </ul>

      {/* hospitals + actions */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
        <div className="text-xs text-slate-500">
          <span className="font-semibold text-slate-700">🏥 {a.hospitals.length} hospitals</span> ·{" "}
          {a.hospitals.map((h) => h.name.replace(a.district, "").trim()).slice(0, 2).join(", ")}…
          · {a.fogging_teams} fogging teams
        </div>
        {isAdmin && (
          <button onClick={() => onDispatch([a.district_id])} disabled={busy} className="btn-primary px-3 py-1.5 text-xs">
            ✉ Dispatch to {a.district}
          </button>
        )}
      </div>
    </div>
  );
}

export default function Agent() {
  const { isAdmin } = useAuth();
  const [plan, setPlan] = useState(null);
  const [revealed, setRevealed] = useState(0);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");
  const [question, setQuestion] = useState("");
  const [chat, setChat] = useState([]);
  const [asking, setAsking] = useState(false);
  const revealTimer = useRef();

  const run = () => {
    setPlan(null);
    setRevealed(0);
    endpoints.agentPlan().then((p) => {
      setPlan(p);
      // animate the reasoning trace
      let i = 0;
      clearInterval(revealTimer.current);
      revealTimer.current = setInterval(() => {
        i += 1;
        setRevealed(i);
        if (i >= p.trace.length) clearInterval(revealTimer.current);
      }, 450);
    });
  };

  useEffect(() => {
    run();
    return () => clearInterval(revealTimer.current);
  }, []);

  const dispatch = async (ids) => {
    setBusy(true);
    setToast("");
    try {
      const r = await endpoints.agentExecute(ids);
      setToast(`Agent dispatched ${r.alerts_created} advisories — ${r.hospitals_notified} hospitals + DHOs across ${r.districts_actioned} district(s).`);
      setTimeout(() => setToast(""), 5000);
    } finally {
      setBusy(false);
    }
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

  return (
    <div className="mx-auto max-w-7xl animate-fade-in px-4 py-6 sm:px-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-brand-600">Autonomous decision support</p>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 text-white">✦</span>
            PrevDengue Response Agent
          </h1>
          <p className="text-sm text-slate-500">
            Doesn't just warn — it reasons over the forecast, locates hospital capacity, and drafts a ready-to-dispatch response plan.
          </p>
        </div>
        <button onClick={run} className="btn-outline">↻ Re-run agent</button>
      </div>

      {!plan ? (
        <Spinner label="Agent is analysing the national forecast…" />
      ) : (
        <>
          {toast && <div className="mt-4 rounded-xl bg-brand-50 px-4 py-3 text-sm font-medium text-brand-800">{toast}</div>}

          {/* Headline + dispatch all */}
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-ink-900 p-5 text-white">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-600 text-lg">✦</span>
              <div>
                <p className="font-semibold">{plan.headline}</p>
                {plan.briefing && (
                  <p className="mt-2 text-sm leading-relaxed text-slate-300">{plan.briefing}</p>
                )}
                {plan.llm && (
                  <span className="mt-2 inline-block rounded bg-brand-600/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-300">
                    ✦ AI briefing
                  </span>
                )}
              </div>
            </div>
            {isAdmin && plan.actions.length > 0 && (
              <button onClick={() => dispatch(null)} disabled={busy} className="btn bg-white px-4 py-2 text-brand-700 hover:bg-brand-50">
                {busy ? "Dispatching…" : `⚡ Execute full plan (${plan.actions.length})`}
              </button>
            )}
          </div>

          {/* Stats */}
          <div className="mt-5 grid grid-cols-2 gap-4 lg:grid-cols-5">
            {[
              { l: "Critical", v: plan.stats.critical, c: "text-red-600" },
              { l: "High", v: plan.stats.high, c: "text-orange-600" },
              { l: "Fogging teams", v: plan.stats.fogging_teams_recommended, c: "text-brand-700" },
              { l: "Bed gap", v: plan.stats.bed_gap_total.toLocaleString(), c: "text-red-600" },
              { l: "Alerts drafted", v: plan.stats.alerts_drafted, c: "text-slate-700" },
            ].map((s) => (
              <div key={s.l} className="card p-4 text-center">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{s.l}</p>
                <p className={`mt-1 text-2xl font-bold ${s.c}`}>{s.v}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-3">
            {/* Reasoning trace + ask */}
            <div className="space-y-6">
              <div className="card p-5">
                <h2 className="mb-3 font-bold text-slate-900">Agent reasoning</h2>
                <ReasoningTrace steps={plan.trace} revealed={revealed} />
              </div>

              <div className="card p-5">
                <h2 className="font-bold text-slate-900">Ask the agent</h2>
                <p className="text-xs text-slate-500">Grounded in the live forecast.</p>
                <div className="scroll-thin mt-3 max-h-56 space-y-2 overflow-y-auto">
                  {chat.length === 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {["What's the worst district?", "How many critical?", "Bed capacity?"].map((s) => (
                        <button key={s} onClick={() => setQuestion(s)} className="chip bg-slate-100 text-slate-600 hover:bg-slate-200">{s}</button>
                      ))}
                    </div>
                  )}
                  {chat.map((m, i) => (
                    <div key={i} className={`rounded-xl px-3 py-2 text-sm ${m.role === "user" ? "ml-6 bg-brand-600 text-white" : "mr-6 bg-slate-100 text-slate-700"}`}>
                      {m.text}
                    </div>
                  ))}
                  {asking && <div className="mr-6 rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-400">thinking…</div>}
                </div>
                <form onSubmit={ask} className="mt-3 flex gap-2">
                  <input className="input" placeholder="Ask about a district…" value={question} onChange={(e) => setQuestion(e.target.value)} />
                  <button className="btn-primary px-4">Ask</button>
                </form>
              </div>
            </div>

            {/* Action plan */}
            <div className="space-y-4 lg:col-span-2">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-slate-900">Recommended intervention plan</h2>
                <span className="text-xs text-slate-500">Prioritised by risk × exposure</span>
              </div>
              {plan.actions.length === 0 && (
                <div className="card p-8 text-center text-slate-400">No districts require intervention this cycle.</div>
              )}
              {plan.actions.slice(0, 12).map((a, i) => (
                <ActionCard key={a.district_id} a={a} rank={i + 1} onDispatch={dispatch} isAdmin={isAdmin} busy={busy} />
              ))}
              {plan.actions.length > 12 && (
                <p className="text-center text-xs text-slate-400">+ {plan.actions.length - 12} more districts in the full plan</p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
