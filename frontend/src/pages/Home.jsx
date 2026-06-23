import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { useI18n } from "../context/I18nContext";
import { endpoints } from "../lib/api";
import heroImg from "../assets/hero.png";

const CRISIS = [
  { n: "321,179", l: "Confirmed cases in 2023", s: "Highest on record since 2000" },
  { n: "1,705", l: "Deaths in 2023", s: "More than the prior 23 years combined" },
  { n: "64 / 64", l: "Districts affected", s: "Nationwide for the first time" },
  { n: "67.4%", l: "Deaths within 1 day", s: "Of hospital admission" },
];

const AUDIENCES = [
  {
    title: "DGHS Administrators",
    body: "A national dashboard with an interactive choropleth map, district trends, configurable alert thresholds, and exportable policy reports.",
    icon: "M3 12l9-9 9 9M5 10v10h14V10",
  },
  {
    title: "Hospital Administrators",
    body: "Forward 4-week risk trajectories and estimated case ranges to plan bed allocation and surge capacity before the wave arrives.",
    icon: "M12 4v16m8-8H4",
  },
  {
    title: "Citizens",
    body: "A simple bilingual portal to check your district's current risk level, get health guidance, and use a quick symptom checker.",
    icon: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14c-4 0-7 2-7 5v1h14v-1c0-3-3-5-7-5z",
  },
];

const STEPS = [
  { t: "Ingest", d: "Weekly climate, demographic, land-use & surveillance data across all 64 districts." },
  { t: "Engineer", d: "Lagged climate, rolling rainfall, humidity flags & autoregressive case features." },
  { t: "Predict", d: "An XGBoost + LightGBM ensemble forecasts district risk 2–4 weeks ahead." },
  { t: "Explain & Alert", d: "SHAP shows why risk is elevated; SMS/email alerts fire on escalation." },
];

export default function Home() {
  const { t } = useI18n();
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    endpoints.summary().then(setSummary).catch(() => {});
  }, []);

  return (
    <div className="animate-fade-in">
      {/* Hero */}
      <section className="relative overflow-hidden bg-ink-900 text-white">
        <div className="absolute inset-0 opacity-30"
          style={{ background: "radial-gradient(60% 60% at 80% 0%, #10b981 0%, transparent 60%), radial-gradient(40% 40% at 0% 100%, #047857 0%, transparent 60%)" }} />
        <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:py-24">
          <div>
            <span className="chip bg-white/10 text-brand-200 ring-1 ring-white/15">
              For Bangladesh · All 64 districts
            </span>
            <h1 className="mt-5 text-4xl font-extrabold leading-tight sm:text-5xl">
              {t("hero_title")}
            </h1>
            <p className="mt-5 max-w-xl text-lg text-slate-300">{t("hero_sub")}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/dashboard" className="btn-primary px-5 py-3 text-base">
                {t("hero_cta_dashboard")}
              </Link>
              <Link to="/agent" className="btn px-5 py-3 text-base bg-white/10 text-white hover:bg-white/20">
                ✦ Meet the AI agent
              </Link>
            </div>
            {summary && (
              <div className="mt-8 flex gap-6 text-sm text-slate-300">
                <span><b className="text-white">{summary.total_districts}</b> districts monitored</span>
                <span><b className="text-orange-300">{summary.at_risk}</b> at High/Critical risk now</span>
                {summary.model?.auc_ensemble && (
                  <span>Model AUC <b className="text-brand-300">{summary.model.auc_ensemble.toFixed(2)}</b></span>
                )}
              </div>
            )}
          </div>
          <div className="relative hidden lg:block">
            <div className="absolute -inset-6 rounded-3xl bg-brand-500/10 blur-2xl" />
            <img src={heroImg} alt="Bangladesh dengue risk map"
              className="relative rounded-3xl border border-white/10 shadow-soft"
              onError={(e) => { e.currentTarget.style.display = "none"; }} />
          </div>
        </div>
      </section>

      {/* Crisis stats */}
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <h2 className="text-center text-sm font-bold uppercase tracking-widest text-slate-500">
          The 2023 dengue crisis in Bangladesh
        </h2>
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {CRISIS.map((c) => (
            <div key={c.l} className="card p-6 text-center">
              <p className="text-3xl font-extrabold text-red-600">{c.n}</p>
              <p className="mt-1 text-sm font-semibold text-slate-800">{c.l}</p>
              <p className="mt-1 text-xs text-slate-500">{c.s}</p>
            </div>
          ))}
        </div>
        <p className="mx-auto mt-6 max-w-3xl text-center text-sm text-slate-500">
          District health systems received no advance warning. PrevDengue closes that gap by
          forecasting risk early enough to deploy fogging teams, pre-allocate beds, and issue advisories.
        </p>
      </section>

      {/* How it works */}
      <section className="bg-white py-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <h2 className="text-2xl font-bold text-slate-900">How PrevDengue works</h2>
          <div className="mt-8 grid gap-5 md:grid-cols-4">
            {STEPS.map((s, i) => (
              <div key={s.t} className="relative rounded-2xl border border-slate-100 bg-slate-50 p-6">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-brand-600 text-sm font-bold text-white">
                  {i + 1}
                </span>
                <h3 className="mt-4 font-semibold text-slate-900">{s.t}</h3>
                <p className="mt-1 text-sm text-slate-600">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Differentiator: agentic AI */}
      <section className="bg-ink-900 py-16 text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <div>
              <span className="chip bg-brand-600/20 text-brand-200 ring-1 ring-brand-400/30">
                What makes PrevDengue different
              </span>
              <h2 className="mt-4 text-3xl font-bold">It doesn't just warn — it decides and acts.</h2>
              <p className="mt-4 text-slate-300">
                Most systems stop at a risk score. PrevDengue adds an autonomous <b className="text-white">Response Agent</b> that
                runs a transparent perceive → reason → plan → act loop: it reads the forecast and SHAP drivers, maps real
                hospital bed capacity, computes resource gaps, and drafts targeted advisories it can dispatch directly to
                District Health Officers and hospitals.
              </p>
              <ul className="mt-5 space-y-2 text-sm text-slate-300">
                <li>✓ Prioritises districts by risk × population exposure</li>
                <li>✓ Computes dengue-bed shortfalls against live hospital capacity</li>
                <li>✓ Recommends fogging teams & driver-specific interventions</li>
                <li>✓ One click to communicate the plan to every hospital in a hotspot</li>
              </ul>
              <Link to="/agent" className="btn-primary mt-7 inline-flex px-5 py-3 text-base">
                ✦ Launch the Response Agent →
              </Link>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <div className="space-y-3 text-sm">
                {[
                  { i: "🛰️", t: "Perceived forecast", d: "64 districts · 9 Critical, 40 High" },
                  { i: "🧠", t: "Read SHAP drivers", d: "Rainfall & humidity leading transmission" },
                  { i: "🏥", t: "Mapped hospital capacity", d: "240 facilities · bed gap computed" },
                  { i: "✉️", t: "Drafted & ready to dispatch", d: "Targeted advisories to DHOs + hospitals" },
                ].map((s) => (
                  <div key={s.t} className="flex items-start gap-3 rounded-xl bg-white/5 p-3">
                    <span className="text-lg">{s.i}</span>
                    <div>
                      <p className="font-semibold text-white">{s.t}</p>
                      <p className="text-xs text-slate-400">{s.d}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Audiences */}
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <h2 className="text-2xl font-bold text-slate-900">Built for three user groups</h2>
        <div className="mt-8 grid gap-6 md:grid-cols-3">
          {AUDIENCES.map((a) => (
            <div key={a.title} className="card p-7">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-50 text-brand-700">
                <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path strokeLinecap="round" strokeLinejoin="round" d={a.icon} />
                </svg>
              </span>
              <h3 className="mt-4 text-lg font-bold text-slate-900">{a.title}</h3>
              <p className="mt-2 text-sm text-slate-600">{a.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-brand-700">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 py-10 sm:flex-row sm:px-6">
          <div>
            <h2 className="text-xl font-bold text-white">See the national risk picture in real time</h2>
            <p className="text-brand-100">Explore the live forecast across all 64 districts.</p>
          </div>
          <Link to="/dashboard" className="btn bg-white px-5 py-3 text-brand-700 hover:bg-brand-50">
            Open dashboard →
          </Link>
        </div>
      </section>
    </div>
  );
}
