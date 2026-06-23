# PrevDengue — Technical Report & Project Documentation

> **Living document.** This report is updated after each iteration of the codebase.
> See the [Changelog](#13-changelog--iteration-log) at the bottom for the iteration history.

| | |
|---|---|
| **Project** | PrevDengue — ML-powered dengue outbreak prediction, early warning & community response system for Bangladesh |
| **Last updated** | 2026-06-24 |
| **Document version** | v1.0 (iteration 12) |
| **Status** | Active development / demo build |

---

## Table of Contents
1. [Overview](#1-overview)
2. [Problem & Motivation](#2-problem--motivation)
3. [System Architecture](#3-system-architecture)
4. [Technology Stack](#4-technology-stack)
5. [Machine Learning Pipeline](#5-machine-learning-pipeline)
6. [Agentic AI Layer](#6-agentic-ai-layer)
7. [Community Response System](#7-community-response-system)
8. [Data Model](#8-data-model)
9. [REST API Reference](#9-rest-api-reference)
10. [Frontend Application](#10-frontend-application)
11. [Authentication & Access Control](#11-authentication--access-control)
12. [Deployment](#12-deployment)
13. [Changelog / Iteration Log](#13-changelog--iteration-log)
14. [Roadmap](#14-roadmap)

---

## 1. Overview

PrevDengue is an end-to-end decision-support platform that helps Bangladesh move from *reactive* to *pre-emptive* dengue management. It does three things that, together, distinguish it from a typical early-warning dashboard:

1. **Predicts** district- and ward-level dengue risk 1–4 weeks ahead using an explainable ML ensemble.
2. **Decides & plans** via an autonomous AI agent that turns forecasts into prioritized, resource-aware intervention plans and dispatches them.
3. **Mobilizes** the community — citizens, ward volunteers, and commissioners — to act on the ground, modeled on the WHO/Khulna "Healthy City" ward-committee approach.

It serves four user groups: **citizens**, **District Health Officers (DHO)**, **hospital administrators**, and **DGHS administrators**.

---

## 2. Problem & Motivation

Bangladesh's 2023 dengue season was the worst on record — **321,179 cases** and **1,705 deaths**, with all **64 districts** affected simultaneously, 63% of cases outside Dhaka, and **67.4% of deaths within one day** of hospital admission. District health systems received no advance warning. PrevDengue closes that gap by forecasting risk early enough to deploy fogging teams, pre-allocate hospital beds, issue advisories, and organize community clean-ups.

**Research alignment.** The modeling approach mirrors the peer-reviewed state of the art for Bangladesh (e.g. *Journal of Tropical Medicine* — "Explainable AI for predicting dengue outbreaks in Bangladesh using eco-climatic triggers": XGBoost + LightGBM + SHAP, 2000–2023, AUC 0.89). PrevDengue extends that academic work into an operational system with agentic action and community mobilization.

---

## 3. System Architecture

```
┌─────────────────────────────┐         ┌──────────────────────────────────────┐
│        Frontend (Vite)      │  HTTPS  │            Backend (FastAPI)           │
│  React SPA · Tailwind ·     │ ──────► │  REST API  /api/v1/*                   │
│  Leaflet · Recharts · i18n  │ ◄────── │                                        │
│  Hosted on Vercel           │  JSON   │  ┌──────────┐  ┌────────────────────┐ │
└─────────────────────────────┘         │  │ ML core  │  │ Agentic AI service │ │
                                         │  │ XGB+LGBM │  │ perceive→plan→act  │ │
                                         │  │ + SHAP   │  │ OpenRouter→Gemini  │ │
                                         │  └──────────┘  └────────────────────┘ │
                                         │  ┌──────────────────────────────────┐ │
                                         │  │ SQLAlchemy ORM → SQLite / Postgres│ │
                                         │  └──────────────────────────────────┘ │
                                         │  Hosted on Render                      │
                                         └──────────────────────────────────────┘
```

- **Stateless API** over a relational store; ML models are pre-trained artifacts (`.joblib`) loaded on demand.
- **LLM calls** are outbound to OpenRouter (primary) and Google Gemini (backup), with a deterministic fallback so the system never fails closed.

---

## 4. Technology Stack

### Backend
- **FastAPI** + **Uvicorn** — REST API & ASGI server
- **SQLAlchemy 2.0** — ORM (SQLite locally, Postgres/Supabase in production)
- **Pandas / NumPy** — data engineering
- **scikit-learn, XGBoost, LightGBM** — modeling
- **SHAP** — model explainability
- **ReportLab** — PDF report generation
- **httpx** — LLM provider calls (OpenRouter, Gemini)
- **APScheduler** — scheduled tasks (alert summaries)

### Frontend
- **React 18 + Vite** — SPA
- **Tailwind CSS** — styling (custom brand/risk palette, Inter + Noto Sans Bengali fonts)
- **React Router** — routing & route guards
- **React-Leaflet / Leaflet** — choropleth & marker maps
- **Recharts** — trend charts
- **Axios** — API client (bearer-token interceptor)

### Infrastructure
- **Vercel** (frontend) · **Render** (backend) · GitHub (CI source)

---

## 5. Machine Learning Pipeline

### 5.1 Data
Synthetic but epidemiologically calibrated weekly data for all 64 districts, 2000–2023:
- `climate_weekly.csv` — temperature, humidity, rainfall
- `dengue_weekly.csv` — confirmed cases & deaths (calibrated to real 2023 totals)
- `districts.csv` — centroids, area, population, density, urban %, agri-land %

### 5.2 Feature Engineering (`app/ml/features.py`)
14 features (`feature_set_version: fs-1.0`):

| Group | Features |
|---|---|
| Climate (lagged) | `mean_temp_t1`, `mean_temp_t2`, `mean_humidity`, `humidity_flag`, `total_rainfall`, `rainfall_4wk_rolling` |
| Socio-demographic / landscape | `pop_density`, `urban_proportion`, `agri_land_pct` |
| Autoregressive (case history) | `cases_t1`, `cases_t2`, `cases_4wk_avg` |
| Seasonality | `week_of_year`, `year` |

- **Target**: forward 4-week risk via logistic transform of future case load.
- **Risk tiers**: Low / Medium / High / Critical, thresholds `0.26 / 0.51 / 0.76` (configurable).

### 5.3 Models (`app/ml/train.py`)
- **XGBoost + LightGBM ensemble**, chronological split (train 2000–2021, test 2022–2023).
- **Current metrics** (synthetic data — real-world target ≈ 0.89 AUC per literature):

| Metric | Value |
|---|---|
| AUC (XGBoost) | 0.970 |
| AUC (LightGBM) | 0.984 |
| AUC (Ensemble) | 0.980 |
| MAE (Ensemble) | 0.133 |
| Train / Test rows | 73,344 / 6,400 |

### 5.4 Forecast & Explainability (`app/ml/forecast.py`)
- Generates 1–4 week risk trajectories for all districts.
- **SHAP** computes the top-5 feature contributors per district (shown in the dashboard and used by the AI agent).

---

## 6. Agentic AI Layer

The **PrevDengue Response Agent** (`app/services/agent.py`) is the differentiator: it doesn't just warn, it reasons and acts via an explicit, auditable loop.

### 6.1 Loop (perceive → reason → plan → act)
1. **perceive_forecast** — ingest national forecast (Critical/High counts).
2. **rank_hotspots** — prioritize districts by risk × population exposure.
3. **explain_drivers** — read SHAP drivers per district.
4. **locate_hospitals** — map hospital capacity, compute dengue-bed gaps.
5. **compute_resources** — fogging teams, bed shortfalls, driver-specific actions.
6. **draft_alerts** — compose targeted advisories, await authorization.

Each step is returned as a **reasoning trace** rendered live in the UI.

### 6.2 LLM Providers (`app/services/llm.py`)
Multi-provider fallback chain — first success wins; deterministic engine if all fail:
1. **OpenRouter** (primary) — free open-source models, tried in order:
   `openai/gpt-oss-120b:free` → `nvidia/nemotron-3-super-120b-a12b:free` → `qwen/qwen3-next-80b-a3b-instruct:free` → `meta-llama/llama-3.3-70b-instruct:free` → `google/gemma-4-31b-it:free` → `openai/gpt-oss-20b:free` → `nousresearch/hermes-3-llama-3.1-405b:free`
2. **Gemini** (backup, used on token/rate-limit) — `gemini-2.5-flash` → `gemini-flash-latest` → `gemini-2.0-flash` (with `thinkingBudget: 0` to prevent truncation).
3. **Deterministic engine** — rule-based briefings & answers.

Configured via `OPENROUTER_API_KEY` / `GEMINI_API_KEY` (env only, never committed).

### 6.3 Agent Capabilities
- **Action plan** with executive briefing (LLM), per-district recommendations, bed-gap bars.
- **Execute / dispatch** advisories to DHOs + hospitals (admin only).
- **Grounded Q&A** chat (officials and citizens), answers tied to live forecast data.
- **Citizen brief** — personalized, bilingual, symptom-aware guidance.
- **Frontend caching** — agent state is global (`AgentContext`), preloaded in the background for officials, cached in `localStorage`, and the reasoning trace animates only once per session.

---

## 7. Community Response System

Modeled on the WHO/Khulna ward-committee approach: **city → wards → community → workers → dispatch → action**.

- **Wards** — 296 sub-district areas (8 per metro, 4 elsewhere) with per-ward risk, estimated affected population, and breeding-site counts.
- **Community workers** — any citizen can join a ward as volunteer or commissioner ("every citizen a potential worker").
- **Dispatch** — super-admin sends a field task (title, instructions, **exact map pin**, **location photo**, priority) to a ward; it auto-posts an announcement to that ward's chat.
- **Tasks feed** — workers see tasks, tap **Navigate** (native maps deep-link), and progress them: *pending → en route → completed* (responders recorded).
- **Community chat** — per-ward feed with resident messages and admin/commissioner announcements.
- **Mobile-first** — segmented tabs (Areas / Tasks / Chat / Dispatch), bottom-sheet join modal, large tap targets.

---

## 8. Data Model

Key tables (`app/db/models.py`):

| Table | Purpose |
|---|---|
| `districts` | 64 districts: geo, population, density, landscape |
| `predictions` | Forecasts per district & horizon week, risk + SHAP |
| `hospitals` | 240 facilities: type, coords, beds, dengue-ready beds, contact |
| `wards` | 296 community areas: risk, est. affected, breeding sites |
| `community_workers` | Residents who joined a ward |
| `dispatches` | Field tasks (location, image, status) |
| `chat_messages` | Per-ward community feed |
| `alerts` | Dispatched email/SMS alert log |
| `alert_recipients` | DHO/hospital contacts per district |
| `users` | Accounts & roles |
| `model_versions` | Model registry |
| `uploaded_datasets` | Surveillance/climate upload metadata |
| `audit_logs` | Admin action audit trail |

---

## 9. REST API Reference

Base path: `/api/v1`. Auth via `Authorization: Bearer <user-id>` (demo) → Supabase JWT (prod).

### Public / data
- `GET /summary` · `GET /forecasts` · `GET /districts` · `GET /districts/geojson`
- `GET /districts/{id}/forecast` · `GET /districts/{id}/history`
- `GET /hospitals` · `GET /hospitals/near?lat&lon&limit`
- `GET /metrics` (model metrics) · `POST /citizen/risk`

### Agent
- `GET /agent/plan` · `POST /agent/execute` (admin) · `POST /agent/ask` · `POST /agent/citizen`

### Community
- `GET /wards` · `GET /wards/{id}`
- `POST /community/join` · `GET /community/workers`
- `POST /dispatch` (admin) · `GET /dispatch` · `PATCH /dispatch/{id}`
- `GET /chat` · `POST /chat` · `POST /community/upload` (admin, image)

### Auth / admin / reports
- `POST /auth/login` · `GET /auth/me` · `GET /auth/demo-accounts`
- `POST /admin/generate` (admin) · `POST /admin/upload` (admin)
- `GET /alerts` (admin) · `POST /alerts/send` (admin)
- `GET /reports/national.pdf` · `GET /reports/district/{id}.pdf` · `GET /reports/export.csv`

Static: `GET /uploads/*` (community location photos). Health: `GET /health`.

---

## 10. Frontend Application

| Route | Page | Access |
|---|---|---|
| `/` | Home (marketing + crisis stats + differentiator) | Public |
| `/citizen` | Citizen Portal (AI assistant, symptom checker, nearest hospitals) | Public |
| `/community` | Community Response (areas, tasks, chat, dispatch) | Public (dispatch = admin) |
| `/dashboard` | National dashboard (choropleth, watchlist, forecast toggle) | Officials |
| `/agent` | AI Response Agent console | Officials |
| `/district/:id` | District detail (trajectory, SHAP, history) | Officials |
| `/hospital` | Hospital surge planner | Officials |
| `/alerts` | Alert management | Admin |
| `/admin` | Model metrics & dataset upload | Admin |
| `/login` | Demo sign-in | Public |

- **Bilingual** (English / বাংলা) via `I18nContext`.
- **Global contexts**: `AuthContext`, `I18nContext`, `AgentContext` (cached agent state).

---

## 11. Authentication & Access Control

- **Roles**: `citizen`, `dho`, `hospital_admin`, `dghs_admin`.
- **Citizen-facing features need no sign-in** — Citizen Portal & Community are open; a "Sign in" button is available for officials.
- **Official features require sign-in** — Dashboard, AI Agent, District detail, Hospital (gated to `dho`/`hospital_admin`/`dghs_admin`).
- **Admin-only** — Alerts, Admin, and all write actions (forecast regen, alert send, agent execute, community dispatch, image upload) are enforced **server-side** via `require_admin`.
- Non-permitted signed-in users are redirected to `/citizen`; guests to `/login`.

---

## 12. Deployment

- **Frontend → Vercel**: root `frontend`, Vite auto-detected, SPA rewrites in `vercel.json`. Set env `VITE_API_BASE` to the backend URL.
- **Backend → Render**: `render.yaml` blueprint (Python 3.12.7), pre-trained models + seeded SQLite committed (no training at deploy). Set secrets `OPENROUTER_API_KEY`, `GEMINI_API_KEY`. A `Dockerfile` is also provided for Railway/Fly.
- **CORS** auto-allows `*.vercel.app` and localhost.
- See **`DEPLOY.md`** for step-by-step instructions.

**Known limits (demo tier)**: Render free instances sleep after 15 min idle (~30–50s cold start); community image uploads use ephemeral disk (reset on redeploy — move to Supabase/S3 for persistence).

---

## 13. Changelog / Iteration Log

> Newest first. Each entry corresponds to one development iteration.

### Iteration 12 — 2026-06-24 — Collaborator onboarding scripts
- Added one-command `setup` + `run` scripts for Windows (`setup.ps1`, `run.ps1`) and macOS/Linux (`setup.sh`, `run.sh`): create venv, install backend + frontend deps, build data/models/DB only if missing, copy `.env` from examples, then start API (8000) + web (5173) together.
- Added `AGENTS.md` so a collaborator's AI agent can understand and run the project (prereqs, commands, project map, conventions, deploy pointers).
- Updated `README.md` Quick start to the scripted flow (manual steps kept as a fallback) and refreshed `backend/setup.ps1` to also generate the hospital registry.

### Iteration 11 — 2026-06-24 — Role-based access control
- Citizen Portal & Community made public (no sign-in); official features gated behind sign-in; admin sees all.
- Fixed redirect loop; non-permitted users routed to `/citizen`.
- Agent background preload restricted to officials.

### Iteration 10 — 2026-06-24 — Persistent / background agent
- Added `AgentContext`: global agent state, background preload, `localStorage` cache, once-per-session trace animation, "Updated at" indicator.

### Iteration 9 — 2026-06-24 — Community Response System
- New `Ward`, `CommunityWorker`, `Dispatch`, `ChatMessage` models; 296 seeded wards.
- Community API (wards, join, dispatch, chat, image upload) + static `/uploads` mount.
- Mobile-first Community page (Areas / Tasks / Chat / Dispatch); ward hotspot map.

### Iteration 8 — 2026-06-24 — Research alignment (no code)
- Reviewed Wiley + 4 Bangladesh ML studies; produced optimization roadmap (hybrid SARIMAX ensemble, LIME, eco-climatic suitability features, validation rigor).

### Iteration 7 — 2026-06-24 — Gemini backup provider
- Added Gemini as automatic fallback after OpenRouter; `thinkingBudget: 0` fix; current free-model slugs.

### Iteration 6 — 2026-06-24 — OpenRouter LLM integration
- `llm.py` multi-model fallback chain; LLM-powered agent briefings, grounded chat, citizen notes; deterministic fallback.

### Iteration 5 — 2026-06-24 — Vercel/Render deploy scaffolding
- `.gitignore`, `vercel.json`, `render.yaml`, `Dockerfile`, `DEPLOY.md`; configurable `VITE_API_BASE` + CORS.

### Iteration 4 — 2026-06-24 — Citizen portal AI overhaul
- Rebuilt as guided AI assistant: plain-language situation, AI recommendations, dynamic nearest hospitals (haversine), bilingual chat.

### Iteration 3 — 2026-06-24 — Agentic AI + hospitals + dispatch
- Response Agent (plan/execute/ask); 240-hospital registry with real distances; hospital markers on map; admin dispatch to hospitals.

### Iteration 2 — 2026-06-23 — UX fixes
- Map hotspot clarity, working resource checklist, interactive alert cards, decluttered dashboard.

### Iteration 1 — 2026-06-23 — Initial build
- ML pipeline, synthetic data, dashboard, citizen portal, alerts, reports, RBAC scaffolding, bilingual UI.

---

## 14. Roadmap

- **Modeling**: hybrid SARIMAX/Prophet ensemble member; LIME local explanations; eco-climatic suitability index; train/test-gap + confidence-interval reporting.
- **Real data**: integrate DGHS surveillance + BMD climate feeds (pipeline already structured for it).
- **Community**: live polling/auto-refresh for chat & tasks; worker leaderboard; push notifications.
- **Infra**: persistent object storage (Supabase/S3) for uploads; Postgres + PostGIS in production; harden read endpoints behind auth.

---

*Maintained alongside the codebase. Update the [Changelog](#13-changelog--iteration-log) and "Last updated" header on every iteration.*
