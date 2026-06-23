import { useEffect, useRef, useState } from "react";
import { endpoints } from "../lib/api";
import Spinner from "../components/Spinner";
import StatCard from "../components/StatCard";

export default function Admin() {
  const [metrics, setMetrics] = useState(null);
  const [uploads, setUploads] = useState([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const fileRef = useRef();

  const load = () => {
    endpoints.modelMetrics().then(setMetrics).catch(() => {});
    endpoints.uploads().then(setUploads).catch(() => {});
  };
  useEffect(load, []);

  const regenerate = async () => {
    setBusy(true);
    setMsg("");
    try {
      const r = await endpoints.generateForecast();
      setMsg(`Forecast regenerated (${r.districts} districts, ${r.alerts_dispatched} alerts) at model ${r.model_version}.`);
    } finally {
      setBusy(false);
    }
  };

  const upload = async (e) => {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    setBusy(true);
    setMsg("");
    try {
      const r = await endpoints.uploadDataset(fd);
      setMsg(`Uploaded ${r.filename} (${r.row_count} rows, status: ${r.processing_status}).`);
      load();
      fileRef.current.value = "";
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl animate-fade-in px-4 py-6 sm:px-6">
      <h1 className="text-2xl font-bold text-slate-900">Admin & Model Operations</h1>
      <p className="text-sm text-slate-500">Model registry, on-demand forecasting, and dataset ingestion (PRD 6.1 / 6.8).</p>

      {msg && <div className="mt-4 rounded-xl bg-brand-50 px-4 py-3 text-sm text-brand-800">{msg}</div>}

      {/* Model metrics */}
      {metrics ? (
        <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="Ensemble AUC" value={metrics.auc_ensemble.toFixed(3)} accent="brand" sub={`v ${metrics.version_tag}`} />
          <StatCard label="XGBoost AUC" value={metrics.auc_xgb.toFixed(3)} accent="emerald" />
          <StatCard label="LightGBM AUC" value={metrics.auc_lgbm.toFixed(3)} accent="emerald" />
          <StatCard label="Training range" value={metrics.training_data_range} accent="slate" sub={metrics.feature_set_version} />
        </div>
      ) : (
        <Spinner label="Loading model metrics…" />
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Forecast control */}
        <div className="card p-5">
          <h2 className="font-bold text-slate-900">Forecast generation</h2>
          <p className="mt-1 text-sm text-slate-500">
            Re-run the ensemble across all 64 districts, refresh predictions, and dispatch escalation alerts.
          </p>
          <button onClick={regenerate} disabled={busy} className="btn-primary mt-4">
            {busy ? "Working…" : "↻ Generate forecast now"}
          </button>
        </div>

        {/* Upload */}
        <div className="card p-5">
          <h2 className="font-bold text-slate-900">Upload surveillance / climate dataset</h2>
          <p className="mt-1 text-sm text-slate-500">CSV ingestion (recorded & queued for processing).</p>
          <form onSubmit={upload} className="mt-4 flex flex-wrap items-center gap-3">
            <input ref={fileRef} type="file" accept=".csv" className="text-sm" />
            <button className="btn-primary" disabled={busy}>Upload</button>
          </form>
        </div>
      </div>

      {/* Uploads table */}
      <div className="card mt-6 overflow-hidden">
        <div className="border-b border-slate-100 p-4">
          <h2 className="font-bold text-slate-900">Uploaded datasets</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2.5">File</th>
              <th className="px-4 py-2.5">Type</th>
              <th className="px-4 py-2.5">Rows</th>
              <th className="px-4 py-2.5">Status</th>
              <th className="px-4 py-2.5">Uploaded by</th>
            </tr>
          </thead>
          <tbody>
            {uploads.map((u) => (
              <tr key={u.id} className="border-t border-slate-100">
                <td className="px-4 py-2.5 font-medium">{u.filename}</td>
                <td className="px-4 py-2.5 text-slate-600">{u.dataset_type}</td>
                <td className="px-4 py-2.5">{u.row_count.toLocaleString()}</td>
                <td className="px-4 py-2.5">
                  <span className="chip bg-slate-100 text-slate-700">{u.processing_status}</span>
                </td>
                <td className="px-4 py-2.5 text-slate-500">{u.uploaded_by}</td>
              </tr>
            ))}
            {uploads.length === 0 && (
              <tr><td colSpan="5" className="px-4 py-6 text-center text-slate-400">No datasets uploaded yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
