import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { endpoints } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import RiskBadge from "../components/RiskBadge";
import Spinner from "../components/Spinner";

// Rough surge estimate from risk score (demo heuristic).
const estimate = (score, population) => {
  const base = score * (population / 100000) * 32;
  return { low: Math.round(base * 0.7), high: Math.round(base * 1.35) };
};

// Recommended stock per predicted peak weekly cases.
const CHECKLIST = [
  { id: "beds", label: "Dengue ward beds", unit: "beds", per: 0.4 },
  { id: "iv", label: "IV fluid / drip units", unit: "units", per: 2.0 },
  { id: "kits", label: "NS1 / dengue test kits", unit: "kits", per: 1.2 },
  { id: "platelet", label: "Platelet units on standby", unit: "units", per: 0.15 },
];

export default function Hospital() {
  const { user } = useAuth();
  const [forecasts, setForecasts] = useState(null);
  const [districtId, setDistrictId] = useState(null);
  const [checklist, setChecklist] = useState({});

  useEffect(() => {
    endpoints.forecasts().then((f) => {
      setForecasts(f);
      setDistrictId(user?.district_id || f.districts[0]?.id);
    });
  }, [user]);

  const district = useMemo(
    () => forecasts?.districts.find((d) => d.id === districtId),
    [forecasts, districtId]
  );

  // Peak predicted weekly cases across the 4-week horizon -> drives recommendations.
  const peakCases = useMemo(() => {
    if (!district) return 0;
    return Math.max(...district.trajectory.map((p) => estimate(p.risk_score, district.population).high));
  }, [district]);

  // Load / persist checklist per district.
  useEffect(() => {
    if (!districtId) return;
    const saved = localStorage.getItem(`pd_checklist_${districtId}`);
    setChecklist(saved ? JSON.parse(saved) : {});
  }, [districtId]);

  const persist = (next) => {
    if (districtId) localStorage.setItem(`pd_checklist_${districtId}`, JSON.stringify(next));
    setChecklist(next);
  };

  const setValue = (id, val) => {
    const clean = val === "" ? "" : Math.max(0, Math.round(Number(val) || 0));
    persist({ ...checklist, [id]: clean });
  };

  const bump = (id, delta) =>
    persist({ ...checklist, [id]: Math.max(0, Math.round(Number(checklist[id] || 0) + delta)) });

  // Live readiness rollup — recomputes instantly as stock is edited.
  const readiness = useMemo(() => {
    if (!peakCases) return { items: [], overall: 0, gaps: 0 };
    const items = CHECKLIST.map((c) => {
      const recommended = Math.max(1, Math.round(peakCases * c.per));
      const have = Number(checklist[c.id] || 0);
      const pct = Math.min(100, Math.round((have / recommended) * 100));
      const gap = Math.max(0, recommended - have);
      return { ...c, recommended, have, pct, gap };
    });
    const overall = Math.round(items.reduce((s, i) => s + i.pct, 0) / items.length);
    const gaps = items.filter((i) => i.gap > 0).length;
    return { items, overall, gaps };
  }, [peakCases, checklist]);

  const fillRecommended = () =>
    persist(Object.fromEntries(readiness.items.map((i) => [i.id, i.recommended])));
  const clearAll = () => persist({});

  if (!forecasts) return <Spinner label="Loading capacity planner…" />;

  return (
    <div className="mx-auto max-w-6xl animate-fade-in px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Hospital Surge Planner</h1>
          <p className="text-sm text-slate-500">Forward risk & estimated case load for capacity planning.</p>
        </div>
        <select
          className="input w-auto"
          value={districtId || ""}
          onChange={(e) => setDistrictId(Number(e.target.value))}
        >
          {forecasts.districts.map((d) => (
            <option key={d.id} value={d.id}>{d.name} ({d.division})</option>
          ))}
        </select>
      </div>

      {district && (
        <>
          <div className="mt-6 flex flex-wrap items-center gap-4 rounded-2xl bg-ink-900 p-5 text-white">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">District</p>
              <p className="text-2xl font-bold">{district.name}</p>
            </div>
            <RiskBadge level={district.risk_level} score={district.risk_score} />
            <div className="hidden sm:block">
              <p className="text-xs uppercase tracking-wide text-slate-400">Peak est. weekly cases (4 wk)</p>
              <p className="text-xl font-bold text-orange-300">~{peakCases.toLocaleString()}</p>
            </div>
            <Link to={`/district/${district.id}`} className="ml-auto text-sm text-brand-300 hover:underline">
              Full district profile →
            </Link>
          </div>

          {/* Trajectory table */}
          <div className="card mt-6 overflow-hidden">
            <div className="border-b border-slate-100 p-4">
              <h2 className="font-bold text-slate-900">4-week outlook & estimated weekly cases</h2>
              <p className="text-xs text-slate-500">Estimated ranges are model-derived for planning, not exact counts.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Horizon</th>
                    <th className="px-4 py-3">Risk</th>
                    <th className="px-4 py-3">Score</th>
                    <th className="px-4 py-3">Est. weekly cases</th>
                    <th className="px-4 py-3">Suggested action</th>
                  </tr>
                </thead>
                <tbody>
                  {district.trajectory.map((p) => {
                    const est = estimate(p.risk_score, district.population);
                    const action = {
                      Low: "Routine monitoring", Medium: "Prepare fogging & messaging",
                      High: "Pre-allocate beds; deploy fogging", Critical: "Activate surge protocol",
                    }[p.risk_level];
                    return (
                      <tr key={p.week} className="border-t border-slate-100">
                        <td className="px-4 py-3 font-medium">{p.week === 1 ? "Now (W+1)" : `W+${p.week}`}</td>
                        <td className="px-4 py-3"><RiskBadge level={p.risk_level} size="sm" /></td>
                        <td className="px-4 py-3">{Math.round(p.risk_score * 100)}</td>
                        <td className="px-4 py-3 font-semibold text-slate-800">{est.low.toLocaleString()}–{est.high.toLocaleString()}</td>
                        <td className="px-4 py-3 text-slate-600">{action}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Resource checklist with readiness */}
          <div className="card mt-6 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-bold text-slate-900">Resource readiness</h2>
                <p className="max-w-xl text-xs text-slate-500">
                  Recommended levels are sized to the peak predicted surge (~{peakCases.toLocaleString()} cases/wk).
                  Adjust your current stock with the sliders — readiness updates instantly and is saved on this device.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={fillRecommended}
                  className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-700"
                >
                  Mark all ready
                </button>
                <button
                  onClick={clearAll}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                >
                  Reset
                </button>
              </div>
            </div>

            {/* Live overall readiness summary */}
            <div className="mt-4 flex flex-wrap items-center gap-4 rounded-2xl bg-ink-900 p-4 text-white">
              <div
                className="grid h-16 w-16 shrink-0 place-items-center rounded-full transition-all"
                style={{
                  background: `conic-gradient(${
                    readiness.overall >= 100 ? "#10b981" : readiness.overall >= 50 ? "#f59e0b" : "#ef4444"
                  } ${readiness.overall * 3.6}deg, #334155 0deg)`,
                }}
              >
                <div className="grid h-12 w-12 place-items-center rounded-full bg-ink-900 text-sm font-bold">
                  {readiness.overall}%
                </div>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">Overall surge readiness</p>
                <p className="text-lg font-bold">
                  {readiness.overall >= 100
                    ? "Fully stocked for predicted surge"
                    : readiness.gaps > 0
                    ? `${readiness.gaps} resource${readiness.gaps > 1 ? "s" : ""} below target`
                    : "On track"}
                </p>
              </div>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {readiness.items.map((c) => {
                const tone = c.pct >= 100 ? "emerald" : c.pct >= 50 ? "amber" : "red";
                const bar = { emerald: "bg-emerald-500", amber: "bg-amber-500", red: "bg-red-500" }[tone];
                const chip = {
                  emerald: "bg-emerald-100 text-emerald-700",
                  amber: "bg-amber-100 text-amber-700",
                  red: "bg-red-100 text-red-700",
                }[tone];
                const accent = { emerald: "accent-emerald-500", amber: "accent-amber-500", red: "accent-red-500" }[tone];
                const sliderMax = Math.max(c.recommended, Math.round(c.recommended * 1.5), 1);
                const stepSize = Math.max(1, Math.round(c.recommended * 0.05));
                return (
                  <div key={c.id} className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-800">{c.label}</p>
                        <p className="text-xs text-slate-500">
                          Recommended <b>{c.recommended.toLocaleString()}</b> {c.unit}
                          {c.gap > 0 && (
                            <span className="text-red-600"> · short {c.gap.toLocaleString()}</span>
                          )}
                        </p>
                      </div>
                      <span className={`chip ${chip}`}>
                        {c.pct >= 100 ? "Ready" : c.pct >= 50 ? "Partial" : "Low"} · {c.pct}%
                      </span>
                    </div>

                    <div className="mt-3 flex items-center gap-2">
                      <button
                        onClick={() => bump(c.id, -stepSize)}
                        className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-slate-200 bg-white text-lg font-bold text-slate-600 transition hover:bg-slate-100 active:scale-95"
                        aria-label={`Decrease ${c.label}`}
                      >
                        −
                      </button>
                      <input
                        type="number"
                        min="0"
                        className="w-20 rounded-lg border border-slate-200 px-2 py-1.5 text-center text-sm font-semibold"
                        value={checklist[c.id] ?? ""}
                        placeholder="0"
                        onChange={(e) => setValue(c.id, e.target.value)}
                      />
                      <button
                        onClick={() => bump(c.id, stepSize)}
                        className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-slate-200 bg-white text-lg font-bold text-slate-600 transition hover:bg-slate-100 active:scale-95"
                        aria-label={`Increase ${c.label}`}
                      >
                        +
                      </button>
                      <span className="ml-auto text-xs text-slate-400">of {c.recommended.toLocaleString()}</span>
                    </div>

                    <input
                      type="range"
                      min="0"
                      max={sliderMax}
                      step={stepSize}
                      value={Math.min(c.have, sliderMax)}
                      onChange={(e) => setValue(c.id, e.target.value)}
                      className={`mt-3 w-full cursor-pointer ${accent}`}
                    />
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-200">
                      <div className={`h-full rounded-full ${bar} transition-all duration-300`} style={{ width: `${c.pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
