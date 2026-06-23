# PrevDengue

**ML-powered dengue outbreak prediction & early warning system for Bangladesh — all 64 districts.**

PrevDengue forecasts district-level dengue risk **2–4 weeks ahead** using an
XGBoost + LightGBM ensemble with SHAP explainability, exposes a REST API, and
serves a responsive web dashboard, a hospital surge planner, and a bilingual
(English / বাংলা) citizen portal. It implements the
[PrevDengue PRD v1.0](./PrevDengue_PRD_v1.0.docx).

> **Demo build note.** Because validated DGHS surveillance data is not bundled,
> the system ships with a **synthetic but epidemiologically calibrated dataset**
> (2000–2023, weekly, all 64 districts). The simulated 2023 season reproduces the
> real crisis scale (~318k cases, ~1,570 deaths, all 64 districts affected). To
> run with zero external accounts, the database is **SQLite** and SMS/email
> alerts are **simulated & logged** — both are drop-in replaceable with
> Supabase/Postgres, Twilio and Resend.

---

## Architecture

```
teamdengue/
├── backend/                 FastAPI + ML engine (Python)
│   ├── app/
│   │   ├── api/             REST routers (/api/v1/*)
│   │   ├── ml/              feature engineering, training, forecast + SHAP
│   │   ├── db/              SQLAlchemy models + seed
│   │   ├── services/        alert/notification service
│   │   └── core/            config
│   ├── data/                synthetic data generator + raw CSVs + GeoJSON
│   └── models/              trained model artifacts + metadata
└── frontend/                React + Vite + Tailwind + Leaflet + Recharts
    └── src/
        ├── pages/           Home, Dashboard, DistrictDetail, Hospital, Citizen, Alerts, Admin, Login
        ├── components/      Layout, ChoroplethMap, RiskBadge, StatCard, …
        ├── context/         Auth + i18n (EN/বাংলা)
        └── lib/             API client + risk helpers
```

**Stack:** FastAPI · XGBoost · LightGBM · SHAP · scikit-learn · SQLAlchemy
(SQLite) · React 19 · Vite · TailwindCSS · Leaflet · Recharts.

---

## Quick start

**Prerequisites:** Python 3.12+ and Node.js 18+.

### One-command setup & run

From the repo root:

```powershell
# Windows
.\setup.ps1      # installs everything (backend venv + deps, frontend npm, DB)
.\run.ps1        # starts API (8000) + web app (5173) together
```

```bash
# macOS / Linux
chmod +x setup.sh run.sh
./setup.sh
./run.sh
```

Then open **http://localhost:5173** (API docs at **http://127.0.0.1:8000/docs**).

> The repo ships trained models + a seeded database, so `setup` only regenerates
> them if missing — usually a fast install. Optional: add `OPENROUTER_API_KEY` /
> `GEMINI_API_KEY` to `backend/.env` to enable live LLM responses (the AI agent &
> assistant fall back to a deterministic engine without them).

AI agents / new collaborators: see **`AGENTS.md`** for the full run guide and
**`DOCUMENTATION.md`** for the technical report.

<details>
<summary>Manual steps (without the scripts)</summary>

```powershell
# Backend
cd backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe data\generate_data.py
.\.venv\Scripts\python.exe data\generate_hospitals.py
.\.venv\Scripts\python.exe -m app.ml.train
.\.venv\Scripts\python.exe -m app.db.seed
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000

# Frontend (new terminal)
cd frontend
npm install
npm run dev
```
macOS/Linux: use `source .venv/bin/activate` and `python` instead of the `.\.venv\Scripts\python.exe` paths.
</details>

---

## Demo accounts

Sign in (one click) on the **/login** page to explore each role:

| Role | Email | Sees |
|------|-------|------|
| DGHS Administrator | `admin@dghs.gov.bd` | Everything: dashboard, alerts, admin, model metrics |
| District Health Officer | `dho.dhaka@demo.bd` | District forecasts, SHAP, hospital planner |
| Hospital Administrator | `hospital.ctg@demo.bd` | Surge planner |
| Citizen | `citizen@demo.bd` | Public portal |

SHAP explanations and the alerts/admin pages are restricted by role (PRD 6.6).

---

## Key features (mapped to the PRD)

- **Prediction engine (6.1):** XGBoost + LightGBM ensemble, 14 engineered
  features (lagged climate, rolling rainfall, humidity flags, autoregressive
  cases, seasonality). Holdout AUC ≈ **0.98**.
- **SHAP explainability (6.1.3):** top-5 drivers per district, shown as a
  signed bar chart in the district view.
- **Risk scoring (6.2):** continuous score → Low / Medium / High / Critical with
  the PRD colour scheme; configurable thresholds.
- **Alerts (6.3):** auto escalation alerts + manual advisories, multi-channel
  (email/SMS), full delivery log.
- **Dashboard & map (6.4):** interactive Leaflet choropleth of all 64 districts,
  W+1…W+4 toggle, searchable watchlist, summary stats.
- **Citizen portal (6.5):** bilingual EN/বাংলা risk lookup, guidance, symptom
  checker, nearest facilities.
- **RBAC (6.6):** four roles, route + data guards.
- **REST API (6.7):** versioned `/api/v1/*`, OpenAPI docs at `/docs`.
- **Reporting (6.8):** national + district PDF and CSV export.

## Switching to production services

| Concern | Demo | Production (PRD) |
|--------|------|------------------|
| Database | SQLite (`DATABASE_URL`) | Supabase / PostgreSQL + PostGIS |
| Auth | bearer = user id | Supabase Auth + JWT |
| Email | simulated/logged | Resend (`RESEND_API_KEY`) |
| SMS | simulated/logged | Twilio (`TWILIO_*`) + local gateway |

Set the corresponding env vars and `SIMULATE_ALERTS=false`; integration points
are marked in `app/services/alerts.py` and `app/core/config.py`.
