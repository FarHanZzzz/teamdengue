import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { endpoints } from "../lib/api";

const ROLE_META = {
  dghs_admin: { label: "DGHS Administrator", desc: "Full national access, alerts, model & data admin", accent: "bg-brand-600" },
  dho: { label: "District Health Officer", desc: "District forecasts, SHAP, alerts & reports", accent: "bg-orange-500" },
  hospital_admin: { label: "Hospital Administrator", desc: "Surge planning & capacity view", accent: "bg-amber-500" },
  citizen: { label: "Citizen", desc: "Public risk lookup & guidance", accent: "bg-emerald-500" },
};

export default function Login() {
  const nav = useNavigate();
  const { login } = useAuth();
  const [accounts, setAccounts] = useState([]);
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    endpoints.demoAccounts().then(setAccounts).catch(() => {});
  }, []);

  const doLogin = async (mail) => {
    setBusy(true);
    setError("");
    try {
      const u = await login(mail);
      nav(u.role === "hospital_admin" ? "/hospital" : "/dashboard");
    } catch (e) {
      setError(e?.response?.data?.detail || "Login failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto grid max-w-5xl animate-fade-in gap-8 px-4 py-12 sm:px-6 lg:grid-cols-2">
      <div className="card p-8">
        <h1 className="text-2xl font-bold text-slate-900">Sign in</h1>
        <p className="mt-1 text-sm text-slate-500">
          Use a demo account to explore each role. (Demo auth — production uses Supabase Auth + JWT.)
        </p>
        <form
          className="mt-6 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            doLogin(email);
          }}
        >
          <input
            className="input"
            type="email"
            placeholder="you@dghs.gov.bd"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button className="btn-primary w-full" disabled={busy || !email}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </form>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">Demo accounts</h2>
        <div className="space-y-3">
          {accounts.map((a) => {
            const m = ROLE_META[a.role] || {};
            return (
              <button
                key={a.email}
                onClick={() => doLogin(a.email)}
                disabled={busy}
                className="card flex w-full items-center gap-4 p-4 text-left transition hover:shadow-soft"
              >
                <span className={`grid h-10 w-10 place-items-center rounded-xl text-white ${m.accent}`}>
                  {m.label?.[0]}
                </span>
                <div className="flex-1">
                  <p className="font-semibold text-slate-800">{m.label}</p>
                  <p className="text-xs text-slate-500">{m.desc}</p>
                  <p className="mt-0.5 text-[11px] text-slate-400">{a.email}</p>
                </div>
                <span className="text-brand-600">→</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
