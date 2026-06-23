export default function StatCard({ label, value, sub, accent = "slate", icon }) {
  const ring = {
    slate: "from-slate-50 to-white border-slate-100",
    emerald: "from-emerald-50 to-white border-emerald-100",
    amber: "from-amber-50 to-white border-amber-100",
    orange: "from-orange-50 to-white border-orange-100",
    red: "from-red-50 to-white border-red-100",
    brand: "from-brand-50 to-white border-brand-100",
  }[accent];
  const text = {
    slate: "text-slate-700", emerald: "text-emerald-600", amber: "text-amber-600",
    orange: "text-orange-600", red: "text-red-600", brand: "text-brand-700",
  }[accent];
  return (
    <div className={`rounded-2xl border bg-gradient-to-b ${ring} p-5 shadow-card`}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
        {icon && <span className="text-lg opacity-70">{icon}</span>}
      </div>
      <p className={`mt-2 text-3xl font-bold ${text}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
    </div>
  );
}
