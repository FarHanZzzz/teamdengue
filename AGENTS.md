# AGENTS.md — PrevDengue

Guidance for AI coding agents and new collaborators working in this repo.
For the full technical report see **`DOCUMENTATION.md`**.

## What this is
PrevDengue: an ML-powered dengue **prediction + early-warning + community-response**
platform for Bangladesh. Two apps:
- **`backend/`** — FastAPI + ML (XGBoost/LightGBM, SHAP), SQLAlchemy, SQLite. Serves `/api/v1/*`.
- **`frontend/`** — React + Vite + Tailwind + Leaflet SPA.

## Prerequisites
- **Python 3.12+** (3.12 recommended) and **Node.js 18+** with npm.

## Setup (one command)
From the repo root:
- **Windows:** `./setup.ps1`
- **macOS/Linux:** `chmod +x setup.sh run.sh && ./setup.sh`

This creates the Python venv, installs all backend + frontend dependencies, and
generates data/models/DB **only if missing** (the repo commits trained models +
a seeded `prevdengue.db`, so this is usually fast).

## Run (one command)
- **Windows:** `./run.ps1`
- **macOS/Linux:** `./run.sh`

Then open:
- Web app → **http://localhost:5173**
- API docs → **http://127.0.0.1:8000/docs**

Stop with Ctrl+C (the run script stops the backend too).

## Manual commands (if not using the scripts)
```bash
# Backend (from backend/)
python -m venv .venv
.venv/bin/python -m pip install -r requirements.txt      # Windows: .\.venv\Scripts\python.exe
.venv/bin/python -m app.db.seed                          # rebuild DB from data/models
.venv/bin/python -m uvicorn app.main:app --reload --port 8000

# Full data pipeline (only needed if data/ or models/ are missing)
.venv/bin/python data/generate_data.py
.venv/bin/python data/generate_hospitals.py
.venv/bin/python -m app.ml.train

# Frontend (from frontend/)
npm install
npm run dev        # dev server
npm run build      # production build (also the lint/typecheck gate)
```

## Environment variables
- **Backend** (`backend/.env`, gitignored — copy from `.env.example`):
  - `OPENROUTER_API_KEY`, `GEMINI_API_KEY` — optional. Enable live LLM responses
    for the AI agent & assistant. Without them, a deterministic engine is used, so
    everything still runs. **Never commit real keys.**
- **Frontend** (`frontend/.env`): `VITE_API_BASE` — backend URL (default `http://127.0.0.1:8000`).

## Project map
```
backend/app/
  api/        REST routers: public, auth, agent, community, alerts, admin, reports
  ml/         features.py, train.py, forecast.py (SHAP)
  services/   agent.py (agentic loop), llm.py (OpenRouter→Gemini fallback), alerts.py
  db/         models.py (ORM), seed.py
  core/       config.py, geo.py
backend/data/ generate_data.py, generate_hospitals.py, raw/*.csv, bd_districts.geojson
frontend/src/
  pages/      Home, Dashboard, Agent, Community, Citizen, DistrictDetail, Hospital, Alerts, Admin, Login
  context/    AuthContext, I18nContext, AgentContext
  components/ Layout, ChoroplethMap, RiskBadge, ...
  lib/        api.js (axios client + endpoints)
```

## Conventions
- **Roles**: `citizen`, `dho`, `hospital_admin`, `dghs_admin`. Citizen-facing pages
  (`/citizen`, `/community`) are public; official pages require sign-in; write
  actions are admin-only and enforced server-side (`app/api/deps.py`).
- **Verify changes**: run `npm run build` (frontend) and check the API boots
  (`/health` returns `{"status":"ok"}`). Re-seed with `python -m app.db.seed`
  after changing DB models.
- **Do not commit secrets** (`backend/.env`) or build artifacts (`node_modules/`, `.venv/`, `dist/`).
- **Keep docs current**: after any meaningful change, add a new entry to the
  Changelog in `DOCUMENTATION.md` (newest first) and bump its "Last updated" header.

## Deployment
Frontend → Vercel (root `frontend`), backend → Render (`render.yaml`). See `DEPLOY.md`.
