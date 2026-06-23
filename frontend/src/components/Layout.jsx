import { NavLink, Link, Outlet, useLocation } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../context/I18nContext";

function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2.5">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-600 text-white shadow-sm">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 21s-7-4.35-7-10a7 7 0 1114 0c0 5.65-7 10-7 10z" />
          <circle cx="12" cy="11" r="2.5" />
        </svg>
      </span>
      <div className="leading-tight">
        <p className="font-extrabold text-slate-900">PrevDengue</p>
        <p className="text-[10px] font-medium uppercase tracking-wider text-brand-600">
          Early Warning System
        </p>
      </div>
    </Link>
  );
}

const ROLE_LABEL = {
  citizen: "Citizen",
  dho: "District Health Officer",
  hospital_admin: "Hospital Admin",
  dghs_admin: "DGHS Administrator",
};

export default function Layout() {
  const { user, logout, isAdmin, isOfficial } = useAuth();
  const { t, lang, toggle } = useI18n();
  const [open, setOpen] = useState(false);
  const loc = useLocation();

  const links = [
    // Public / citizen-facing — no sign-in required
    { to: "/citizen", label: t("nav_citizen"), show: true },
    { to: "/community", label: t("nav_community"), show: true },
    // Official + admin features — only after signing in
    { to: "/dashboard", label: t("nav_dashboard"), show: isOfficial },
    { to: "/agent", label: t("nav_agent"), show: isOfficial, badge: "AI" },
    { to: "/hospital", label: t("nav_hospital"), show: isOfficial },
    { to: "/alerts", label: t("nav_alerts"), show: isAdmin },
    { to: "/admin", label: t("nav_admin"), show: isAdmin },
  ].filter((l) => l.show);

  const linkClass = ({ isActive }) =>
    `flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
      isActive ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-100"
    }`;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-[1000] border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Logo />
          <nav className="hidden items-center gap-1 md:flex">
            {links.map((l) => (
              <NavLink key={l.to} to={l.to} className={linkClass}>
                {l.label}
                {l.badge && (
                  <span className="rounded bg-brand-600 px-1.5 py-0.5 text-[9px] font-bold text-white">{l.badge}</span>
                )}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <button
              onClick={toggle}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              title="Switch language"
            >
              {lang === "en" ? "বাংলা" : "EN"}
            </button>
            {user ? (
              <div className="hidden items-center gap-3 sm:flex">
                <div className="text-right leading-tight">
                  <p className="text-sm font-semibold text-slate-800">{user.full_name}</p>
                  <p className="text-[11px] text-slate-500">{ROLE_LABEL[user.role]}</p>
                </div>
                <button onClick={logout} className="btn-ghost px-3 py-1.5">
                  {t("nav_logout")}
                </button>
              </div>
            ) : (
              <Link to="/login" className="btn-primary px-3 py-1.5">
                {t("nav_login")}
              </Link>
            )}
            <button
              className="rounded-lg border border-slate-200 p-2 md:hidden"
              onClick={() => setOpen((o) => !o)}
              aria-label="Menu"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>
        {open && (
          <div className="border-t border-slate-100 bg-white px-4 py-2 md:hidden">
            {links.map((l) => (
              <NavLink key={l.to} to={l.to} className={linkClass} onClick={() => setOpen(false)}>
                <span className="block py-1">{l.label}</span>
              </NavLink>
            ))}
            {user ? (
              <button onClick={logout} className="mt-1 block w-full text-left text-sm text-slate-600">
                {t("nav_logout")} ({user.full_name})
              </button>
            ) : (
              <Link to="/login" className="block py-1 text-sm text-brand-700" onClick={() => setOpen(false)}>
                {t("nav_login")}
              </Link>
            )}
          </div>
        )}
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-5 text-xs text-slate-500 sm:flex-row sm:px-6">
          <p>PrevDengue · ML-powered dengue early warning for Bangladesh · v1.0</p>
          <p>Demo build · synthetic dataset (2000–2023) · for {ROLE_LABEL[user?.role] || "public"} preview</p>
        </div>
      </footer>
    </div>
  );
}
