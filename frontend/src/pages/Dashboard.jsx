import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import ChoroplethMap from "../components/ChoroplethMap";
import RiskBadge from "../components/RiskBadge";
import StatCard from "../components/StatCard";
import Spinner from "../components/Spinner";
import { endpoints, reportUrls } from "../lib/api";
import { RISK_HEX, RISK_LEVELS, trendArrow } from "../lib/risk";
import { useAuth } from "../context/AuthContext";

const WEEKS = [
  { i: 0, label: "Now" },
  { i: 1, label: "+1 wk" },
  { i: 2, label: "+2 wk" },
  { i: 3, label: "+3 wk" },
];

export default function Dashboard() {
  const nav = useNavigate();
  const { isAdmin } = useAuth();
  const [forecasts, setForecasts] = useState(null);
  const [geojson, setGeojson] = useState(null);
  const [summary, setSummary] = useState(null);
  const [week, setWeek] = useState(0);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All");
  const [selected, setSelected] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [hospitals, setHospitals] = useState([]);
  const [showHospitals, setShowHospitals] = useState(false);

  const load = () => {
    Promise.all([endpoints.forecasts(), endpoints.summary()]).then(([f, s]) => {
      setForecasts(f);
      setSummary(s);
    });
  };

  useEffect(() => {
    load();
    endpoints.geojson().then(setGeojson).catch(() => {});
    endpoints.hospitals().then(setHospitals).catch(() => {});
  }, []);

  const riskByName = useMemo(() => {
    const map = {};
    forecasts?.districts.forEach((d) => {
      map[d.name] = {
        id: d.id, name: d.name, lat: d.lat, lon: d.lon,
        risk_level: d.risk_level, risk_score: d.risk_score, trajectory: d.trajectory,
      };
    });
    return map;
  }, [forecasts]);

  const levelAt = (d) => (week ? d.trajectory[week].risk_level : d.risk_level);
  const scoreAt = (d) => (week ? d.trajectory[week].risk_score : d.risk_score);

  const sorted = useMemo(
    () => (forecasts?.districts ? [...forecasts.districts].sort((a, b) => scoreAt(b) - scoreAt(a)) : []),
    [forecasts, week]
  );

  const hotspots = useMemo(
    () => sorted.filter((d) => ["High", "Critical"].includes(levelAt(d))).slice(0, 6),
    [sorted, week]
  );

  const rows = useMemo(() => {
    let list = sorted;
    if (query) list = list.filter((d) => d.name.toLowerCase().includes(query.toLowerCase()));
    if (filter !== "All") list = list.filter((d) => levelAt(d) === filter);
    return list;
  }, [sorted, query, filter, week]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await endpoints.generateForecast();
      load();
    } finally {
      setGenerating(false);
    }
  };

  if (!forecasts || !summary) return <Spinner label="Loading national forecast…" />;

  const lc = summary.level_counts;
  const horizonLabel = week === 0 ? "this week" : `${week} week${week > 1 ? "s" : ""} ahead`;

  return (
    <div className="mx-auto max-w-7xl animate-fade-in px-4 py-6 sm:px-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-brand-600">
            Forecast · {horizonLabel}
          </p>
          <h1 className="text-2xl font-bold text-slate-900">Predicted Dengue Outbreak Risk</h1>
          <p className="text-sm text-slate-500">
            All 64 districts · {summary.at_risk} at High/Critical risk · model {summary.model?.version} (AUC {summary.model?.auc_ensemble?.toFixed(2)})
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={reportUrls.national} className="btn-outline" target="_blank" rel="noreferrer">⬇ PDF</a>
          <a href={reportUrls.csv} className="btn-outline" target="_blank" rel="noreferrer">⬇ CSV</a>
          {isAdmin && (
            <button onClick={handleGenerate} disabled={generating} className="btn-primary">
              {generating ? "Generating…" : "↻ Regenerate"}
            </button>
          )}
        </div>
      </div>

      {/* Hotspots — the clear "where" answer */}
      <div className="mt-5 rounded-2xl border border-orange-100 bg-gradient-to-br from-orange-50/70 to-white p-4">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-bold text-slate-800">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
            </span>
            Predicted hotspots ({horizonLabel})
          </h2>
          <span className="text-xs text-slate-500">Districts most likely to see an outbreak</span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
          {hotspots.length === 0 && (
            <p className="col-span-full py-2 text-sm text-slate-400">No High/Critical districts for this horizon.</p>
          )}
          {hotspots.map((d, i) => (
            <button
              key={d.id}
              onClick={() => nav(`/district/${d.id}`)}
              className="rounded-xl border border-slate-100 bg-white p-3 text-left shadow-card transition hover:-translate-y-0.5 hover:shadow-soft"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400">#{i + 1}</span>
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: RISK_HEX[levelAt(d)] }} />
              </div>
              <p className="mt-1 truncate font-bold text-slate-800">{d.name}</p>
              <p className="text-xs text-slate-500">{d.division}</p>
              <p className="mt-1 text-lg font-extrabold" style={{ color: RISK_HEX[levelAt(d)] }}>
                {Math.round(scoreAt(d) * 100)}<span className="text-xs font-medium text-slate-400">/100</span>
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Summary cards */}
      <div className="mt-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Low risk" value={lc.Low} accent="emerald" icon="●" />
        <StatCard label="Medium risk" value={lc.Medium} accent="amber" icon="▲" />
        <StatCard label="High risk" value={lc.High} accent="orange" icon="◆" />
        <StatCard label="Critical risk" value={lc.Critical} accent="red" icon="✖" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* Map */}
        <div className="lg:col-span-2">
          <div className="card overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-500">Horizon:</span>
                <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
                  {WEEKS.map((w) => (
                    <button
                      key={w.i}
                      onClick={() => setWeek(w.i)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                        week === w.i ? "bg-white text-brand-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
                      }`}
                    >
                      {w.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2.5 text-xs text-slate-600">
                {RISK_LEVELS.map((l) => (
                  <span key={l} className="flex items-center gap-1">
                    <span className="h-3 w-3 rounded" style={{ background: RISK_HEX[l] }} />
                    {l}
                  </span>
                ))}
                <button
                  onClick={() => setShowHospitals((s) => !s)}
                  className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 font-semibold transition ${
                    showHospitals ? "border-blue-300 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-500 hover:bg-slate-50"
                  }`}
                >
                  <span className="h-2.5 w-2.5 rounded-full bg-blue-500" /> Hospitals
                </button>
              </div>
            </div>
            <div style={{ height: 560 }}>
              <ChoroplethMap
                geojson={geojson}
                riskByName={riskByName}
                week={week}
                selected={selected}
                hospitals={showHospitals ? hospitals : []}
                onSelect={(name) => {
                  setSelected(name);
                  const id = riskByName[name]?.id;
                  if (id) nav(`/district/${id}`);
                }}
              />
            </div>
            <p className="border-t border-slate-100 px-4 py-2 text-[11px] text-slate-400">
              Labeled dots = critical hotspots · blue dots = hospitals ({hospitals.length}) · click any district for its forecast & SHAP drivers.
            </p>
          </div>
        </div>

        {/* District list */}
        <div className="card flex flex-col" style={{ maxHeight: 632 }}>
          <div className="border-b border-slate-100 p-4">
            <h2 className="font-bold text-slate-900">All districts</h2>
            <input
              className="input mt-3"
              placeholder="Search district…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <div className="mt-3 flex flex-wrap gap-1">
              {["All", ...RISK_LEVELS].map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                    filter === f ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
          <div className="scroll-thin flex-1 overflow-y-auto p-2">
            {rows.map((d) => {
              const tr = trendArrow(d.trajectory);
              return (
                <button
                  key={d.id}
                  onClick={() => nav(`/district/${d.id}`)}
                  className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left hover:bg-slate-50"
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-800">
                      {d.name} <span className={`text-sm ${tr.cls}`} title={tr.dir}>{tr.symbol}</span>
                    </p>
                    <p className="text-xs text-slate-500">{d.division}</p>
                  </div>
                  <RiskBadge level={levelAt(d)} score={scoreAt(d)} size="sm" />
                </button>
              );
            })}
            {rows.length === 0 && <p className="p-6 text-center text-sm text-slate-400">No districts match.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
