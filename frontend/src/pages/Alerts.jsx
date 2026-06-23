import { useEffect, useMemo, useState } from "react";
import { endpoints } from "../lib/api";
import Spinner from "../components/Spinner";
import RiskBadge from "../components/RiskBadge";

const STATUS_CLASS = {
  delivered: "bg-emerald-100 text-emerald-700",
  sent: "bg-sky-100 text-sky-700",
  pending: "bg-amber-100 text-amber-700",
  failed: "bg-red-100 text-red-700",
};

function FilterCard({ label, value, active, onClick, accent }) {
  const ring = active ? "ring-2 ring-offset-1" : "ring-1";
  const tone = {
    emerald: "from-emerald-50 to-white text-emerald-600 ring-emerald-200",
    brand: "from-brand-50 to-white text-brand-700 ring-brand-200",
    amber: "from-amber-50 to-white text-amber-600 ring-amber-200",
    red: "from-red-50 to-white text-red-600 ring-red-200",
    slate: "from-slate-50 to-white text-slate-700 ring-slate-200",
  }[accent];
  return (
    <button
      onClick={onClick}
      className={`rounded-2xl border-0 bg-gradient-to-b ${tone} ${ring} p-5 text-left shadow-card transition hover:shadow-soft`}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-3xl font-bold">{value}</p>
      <p className="mt-1 text-[11px] text-slate-400">{active ? "Filtering ✓" : "Click to filter"}</p>
    </button>
  );
}

export default function Alerts() {
  const [data, setData] = useState(null);
  const [districts, setDistricts] = useState([]);
  const [forecasts, setForecasts] = useState([]);
  const [picked, setPicked] = useState([]);
  const [message, setMessage] = useState(
    "Heightened dengue risk advisory. Please activate vector control measures."
  );
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState("");
  const [channelFilter, setChannelFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const load = () => endpoints.alerts().then(setData);
  useEffect(() => {
    load();
    endpoints.districts().then(setDistricts);
    endpoints.forecasts().then((f) => setForecasts(f.districts));
  }, []);

  const send = async () => {
    if (!picked.length) return;
    setSending(true);
    try {
      const r = await endpoints.sendAlert({ district_ids: picked, message, risk_level: "High" });
      setToast(`Dispatched ${r.dispatched} alert(s) to ${picked.length} district(s).`);
      setPicked([]);
      load();
      setTimeout(() => setToast(""), 4000);
    } finally {
      setSending(false);
    }
  };

  const selectHotspots = () => {
    const ids = forecasts
      .filter((d) => ["High", "Critical"].includes(d.risk_level))
      .map((d) => d.id);
    setPicked(ids);
  };

  const rows = useMemo(() => {
    if (!data) return [];
    return data.alerts.filter(
      (a) =>
        (channelFilter === "all" || a.channel === channelFilter) &&
        (statusFilter === "all" || a.status === statusFilter)
    );
  }, [data, channelFilter, statusFilter]);

  if (!data) return <Spinner label="Loading alerts…" />;

  const s = data.summary;

  return (
    <div className="mx-auto max-w-7xl animate-fade-in px-4 py-6 sm:px-6">
      <h1 className="text-2xl font-bold text-slate-900">Alerts & Notifications</h1>
      <p className="text-sm text-slate-500">
        Automated escalation alerts + manual advisories (SMS via Twilio, email via Resend — simulated in this build).
      </p>

      {/* Clickable status filter cards */}
      <div className="mt-5 grid grid-cols-2 gap-4 lg:grid-cols-5">
        <FilterCard label="All" value={data.count} accent="slate"
          active={statusFilter === "all"} onClick={() => setStatusFilter("all")} />
        <FilterCard label="Delivered" value={s.delivered || 0} accent="emerald"
          active={statusFilter === "delivered"} onClick={() => setStatusFilter("delivered")} />
        <FilterCard label="Sent" value={s.sent || 0} accent="brand"
          active={statusFilter === "sent"} onClick={() => setStatusFilter("sent")} />
        <FilterCard label="Pending" value={s.pending || 0} accent="amber"
          active={statusFilter === "pending"} onClick={() => setStatusFilter("pending")} />
        <FilterCard label="Failed" value={s.failed || 0} accent="red"
          active={statusFilter === "failed"} onClick={() => setStatusFilter("failed")} />
      </div>

      {toast && (
        <div className="mt-4 rounded-xl bg-brand-50 px-4 py-3 text-sm font-medium text-brand-800">{toast}</div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* Manual sender */}
        <div className="card flex flex-col p-5">
          <h2 className="font-bold text-slate-900">Send manual alert</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            <button onClick={selectHotspots} className="btn-ghost px-3 py-1.5 text-xs">
              Select all High/Critical
            </button>
            <button onClick={() => setPicked([])} className="btn-ghost px-3 py-1.5 text-xs">Clear</button>
          </div>
          <div className="scroll-thin mt-3 max-h-44 overflow-y-auto rounded-xl border border-slate-100 p-2">
            {districts.map((d) => (
              <label key={d.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={picked.includes(d.id)}
                  onChange={(e) =>
                    setPicked((p) => (e.target.checked ? [...p, d.id] : p.filter((x) => x !== d.id)))
                  }
                />
                {d.name}
              </label>
            ))}
          </div>
          <textarea
            className="input mt-3 h-24 resize-none"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
          <button onClick={send} disabled={sending || !picked.length} className="btn-primary mt-3 w-full">
            {sending ? "Dispatching…" : picked.length ? `Dispatch to ${picked.length} district(s)` : "Select districts first"}
          </button>
        </div>

        {/* Log */}
        <div className="card lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 p-4">
            <h2 className="font-bold text-slate-900">
              Alert log <span className="text-sm font-normal text-slate-400">({rows.length})</span>
            </h2>
            <div className="flex gap-1">
              {["all", "email", "sms"].map((c) => (
                <button
                  key={c}
                  onClick={() => setChannelFilter(c)}
                  className={`rounded-lg px-3 py-1 text-xs font-medium ${
                    channelFilter === c ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {c.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          <div className="scroll-thin max-h-[460px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2.5">District</th>
                  <th className="px-4 py-2.5">Level</th>
                  <th className="px-4 py-2.5">Type</th>
                  <th className="px-4 py-2.5">Channel</th>
                  <th className="px-4 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((a) => (
                  <tr key={a.id} className="border-t border-slate-100">
                    <td className="px-4 py-2.5 font-medium">{a.district}</td>
                    <td className="px-4 py-2.5"><RiskBadge level={a.risk_level} size="sm" /></td>
                    <td className="px-4 py-2.5 text-slate-600">{a.alert_type}</td>
                    <td className="px-4 py-2.5 uppercase text-slate-600">{a.channel}</td>
                    <td className="px-4 py-2.5">
                      <span className={`chip ${STATUS_CLASS[a.status] || "bg-slate-100"}`}>{a.status}</span>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr><td colSpan="5" className="px-4 py-8 text-center text-slate-400">No alerts match this filter.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
