# Deploying PrevDengue

The app has two parts that deploy separately:

| Part | Host | Why |
|------|------|-----|
| **Frontend** (Vite + React) | **Vercel** | Static site — Vercel's sweet spot |
| **Backend** (FastAPI + ML) | **Render** (free) | Needs Python + XGBoost/LightGBM/SHAP + SQLite, which exceed Vercel's 250 MB serverless limit |

The trained models (`backend/models/*.joblib`) and the seeded database (`backend/prevdengue.db`) are committed, so the backend needs **no training step** — it just installs and runs.

---

## 0. Push to GitHub first

```bash
git add -A
git commit -m "Prepare PrevDengue for deployment"
git push
```

---

## 1. Backend on Render (do this first — you need its URL)

1. Go to https://render.com → **New +** → **Blueprint**.
2. Connect this GitHub repo. Render auto-reads `render.yaml` and creates the `prevdengue-api` service.
3. Click **Apply**. First build takes ~3–5 min (it installs the ML libraries).
4. When live, copy the URL, e.g. `https://prevdengue-api.onrender.com`.
5. Verify it works: open `https://prevdengue-api.onrender.com/health` → should show `{"status":"ok"}`.

> Free Render services sleep after 15 min idle; the first request after that takes ~30–50 s to wake.

**No Blueprint?** You can instead create a **Web Service** manually:
- Root directory: `backend`
- Build command: `pip install -r requirements.txt`
- Start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- Environment variable: `PYTHON_VERSION = 3.12.7`

**Enable real AI (recommended):** add these environment variables on the Render service:
- `OPENROUTER_API_KEY` = your key from https://openrouter.ai/keys (primary)
- `GEMINI_API_KEY` = your key from https://aistudio.google.com/apikey (backup)

The assistant tries OpenRouter's free open-source models first, then automatically falls back to Gemini if OpenRouter is rate-limited or out of tokens. Without any key it still works via the built-in deterministic engine.

---

## 2. Frontend on Vercel

1. Go to https://vercel.com → **Add New… → Project** → import this repo.
2. Set **Root Directory** to `frontend`. Vercel auto-detects Vite (build `npm run build`, output `dist`).
3. Add an **Environment Variable**:
   - `VITE_API_BASE` = your Render URL from step 1 (e.g. `https://prevdengue-api.onrender.com`)
   - ⚠️ No trailing slash, and do **not** add `/api/v1`.
4. Click **Deploy**.

That's it — open the Vercel URL.

---

## Updating later

Both hosts redeploy automatically on every `git push`. If you change `VITE_API_BASE` in Vercel, trigger a redeploy (Vite bakes env vars in at build time).

## CORS

The backend already allows any `*.vercel.app` origin and localhost. For a custom domain, set the `CORS_ORIGINS` env var on Render to a comma-separated list, e.g.
`CORS_ORIGINS=https://prevdengue.com,https://www.prevdengue.com`
