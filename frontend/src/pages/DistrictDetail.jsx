import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, Cell, XAxis, YAxis,
  Tooltip, CartesianGrid, ComposedChart, Area, ReferenceLine,
} from "recharts";
import RiskBadge from "../components/RiskBadge";
import Spinner from "../components/Spinner";
import { endpoints, reportUrls } from "../lib/api";
import { RISK_HEX } from "../lib/risk";
import { useAuth } from "../context/AuthContext";

export default function DistrictDetail() {
  const { id } = useParams();
  const { isOfficial } = useAuth();
  const [data, setData] = useState(null);
  const [history, setHistory] = useState(null);

  useEffect(() => {
    setData(null);
    setHistory(null);
    endpoints.districtForecast(id).then(setData).catch(() => {});
    endpoints.history(id).then(setHistory).catch(() => {});
  }, [id]);

  const trajData = useMemo(
    () =>
      data?.trajectory.map((p) => ({
        name: p.week === 1 ? "Now" : `W+${p.week}`,
        score: Math.round(p.risk_score * 100),
        level: p.risk_level,
      })) || [],
    [data]
  );

  const shapData = useMemo(
    () =>
      (data?.shap || [])
        .map((s) => ({ label: s.label, value: Math.round(s.value * 1000) / 10, raw: s.value }))
        .sort((a, b) => Math.abs(b.value) - Math.abs(a.value)),
    [data]
  );

  const histData = useMemo(
    () =>
      (history?.series || [])
        .filter((d) => d.year >= 2019)
        .map((d) => ({
          date: d.week_start,
          cases: d.confirmed_cases,
          predicted: Math.round(d.predicted_risk * 100),
          actual: Math.round(d.actual_risk * 100),
        })),
    [history]
  );

  if (!data) return <Spinner label="Loading district…" />;

  return (
    <div className="mx-auto max-w-7xl animate-fade-in px-4 py-6 sm:px-6">
      <Link to="/dashboard" className="text-sm text-brand-700 hover:underline">← Back to dashboard</Link>

      {/* Header */}
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {data.name} <span className="text-lg font-normal text-slate-400">/ {data.division}</span>
          </h1>
          <p className="text-sm text-slate-500">
            Population {data.population.toLocaleString()} · density {Math.round(data.pop_density)}/km²
            · urban {Math.round(data.urban_proportion * 100)}%
          </p>
        </div>
        <div className="flex items-center gap-3">
          <RiskBadge level={data.risk_level} score={data.risk_score} />
          <a href={reportUrls.district(id)} target="_blank" rel="noreferrer" className="btn-outline">
            ⬇ District PDF
          </a>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Forecast trajectory */}
        <div className="card p-5">
          <h2 className="font-bold text-slate-900">4-week risk forecast</h2>
          <p className="text-xs text-slate-500">Predicted outbreak risk score (0–100)</p>
          <div className="mt-4 h-64">
            <ResponsiveContainer>
              <LineChart data={trajData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                <Tooltip />
                <ReferenceLine y={51} stroke="#E67E22" strokeDasharray="4 4" />
                <ReferenceLine y={76} stroke="#C0392B" strokeDasharray="4 4" />
                <Line type="monotone" dataKey="score" stroke="#059669" strokeWidth={3}
                  dot={(props) => {
                    const { cx, cy, payload } = props;
                    return <circle cx={cx} cy={cy} r={5} fill={RISK_HEX[payload.level]} stroke="#fff" strokeWidth={2} />;
                  }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* SHAP */}
        <div className="card p-5">
          <h2 className="font-bold text-slate-900">Why is risk at this level?</h2>
          <p className="text-xs text-slate-500">
            SHAP feature contributions {isOfficial ? "" : "(sign in as a health official to view)"}
          </p>
          {isOfficial && shapData.length > 0 ? (
            <div className="mt-4 h-64">
              <ResponsiveContainer>
                <BarChart data={shapData} layout="vertical" margin={{ left: 30, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="label" width={120} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => `${v > 0 ? "+" : ""}${v}`} />
                  <ReferenceLine x={0} stroke="#94a3b8" />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {shapData.map((d, i) => (
                      <Cell key={i} fill={d.value >= 0 ? "#C0392B" : "#27AE60"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="mt-4 grid h-64 place-items-center rounded-xl bg-slate-50 text-center text-sm text-slate-400">
              {isOfficial ? "No SHAP data." : (
                <span>SHAP explanations are restricted to health officials.<br />
                  <Link to="/login" className="text-brand-700 hover:underline">Sign in →</Link>
                </span>
              )}
            </div>
          )}
          {isOfficial && shapData.length > 0 && (
            <div className="mt-3 flex gap-4 text-xs text-slate-500">
              <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded bg-risk-critical" /> increases risk</span>
              <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded bg-risk-low" /> decreases risk</span>
            </div>
          )}
        </div>
      </div>

      {/* History */}
      <div className="card mt-6 p-5">
        <h2 className="font-bold text-slate-900">Historical cases vs. predicted risk</h2>
        <p className="text-xs text-slate-500">Weekly confirmed cases (bars) with model-predicted risk (line) — 2019 onward</p>
        {history ? (
          <div className="mt-4 h-72">
            <ResponsiveContainer>
              <ComposedChart data={histData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} minTickGap={40} />
                <YAxis yAxisId="l" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="r" orientation="right" domain={[0, 100]} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Area yAxisId="l" type="monotone" dataKey="cases" fill="#cbd5e1" stroke="#94a3b8" name="Cases" />
                <Line yAxisId="r" type="monotone" dataKey="predicted" stroke="#059669" strokeWidth={2} dot={false} name="Predicted risk" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <Spinner label="Loading history…" />
        )}
      </div>
    </div>
  );
}
