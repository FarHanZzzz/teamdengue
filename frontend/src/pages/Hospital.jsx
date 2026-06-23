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

  const setValue = (id, val) => {
    setChecklist((prev) => {
      const next = { ...prev, [id]: val };
      localStorage.setItem(`pd_checklist_${districtId}`, JSON.stringify(next));
      return next;
    });
  };

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
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="font-bold text-slate-900">Resource readiness</h2>
                <p className="text-xs text-slate-500">
                  Recommended levels are sized to the peak predicted surge (~{peakCases.toLocaleString()} cases/wk).
                  Enter your current stock — readiness is saved on this device.
                </p>
              </div>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {CHECKLIST.map((c) => {
                const recommended = Math.max(1, Math.round(peakCases * c.per));
                const have = Number(checklist[c.id] || 0);
                const pct = Math.min(100, Math.round((have / recommended) * 100));
                const tone = pct >= 100 ? "emerald" : pct >= 50 ? "amber" : "red";
                const bar = { emerald: "bg-emerald-500", amber: "bg-amber-500", red: "bg-red-500" }[tone];
                const chip = {
                  emerald: "bg-emerald-100 text-emerald-700",
                  amber: "bg-amber-100 text-amber-700",
                  red: "bg-red-100 text-red-700",
                }[tone];
                return (
                  <div key={c.id} className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-800">{c.label}</p>
                        <p className="text-xs text-slate-500">
                          Recommended: <b>{recommended.toLocaleString()}</b> {c.unit}
                        </p>
                      </div>
                      <span className={`chip ${chip}`}>
                        {pct >= 100 ? "Ready" : pct >= 50 ? "Partial" : "Low"} · {pct}%
                      </span>
                    </div>
                    <div className="mt-3 flex items-center gap-3">
                      <input
                        type="number"
                        min="0"
                        className="w-28 rounded-lg border border-slate-200 px-3 py-1.5 text-right text-sm"
                        value={checklist[c.id] ?? ""}
                        placeholder="0"
                        onChange={(e) => setValue(c.id, e.target.value)}
                      />
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200">
                        <div className={`h-full rounded-full ${bar} transition-all`} style={{ width: `${pct}%` }} />
                      </div>
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
