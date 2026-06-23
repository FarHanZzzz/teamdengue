#!/usr/bin/env bash
# PrevDengue — one-command setup (macOS / Linux)
# Installs all backend + frontend dependencies and prepares the database.
# Usage:  ./setup.sh      then      ./run.sh
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

step() { printf "\n==> %s\n" "$1"; }

PY="${PYTHON:-python3}"

# ---------------- Backend ----------------
step "Backend: creating Python virtual environment"
cd "$ROOT/backend"
[ -d .venv ] || "$PY" -m venv .venv
# shellcheck disable=SC1091
source .venv/bin/activate
python -m pip install --upgrade pip >/dev/null
step "Backend: installing Python dependencies (this can take a few minutes)"
pip install -r requirements.txt

needData=0;  [ -f data/raw/dengue_weekly.csv ] || needData=1
needHosp=0;  [ -f data/raw/hospitals.csv ]     || needHosp=1
needModel=0; [ -f models/xgb_model.joblib ]    || needModel=1
needDb=0;    [ -f prevdengue.db ]              || needDb=1

[ "$needData" = 1 ] && { step "Generating synthetic dataset"; python data/generate_data.py; }
{ [ "$needData" = 1 ] || [ "$needHosp" = 1 ]; } && { step "Generating hospital registry"; python data/generate_hospitals.py; }
[ "$needModel" = 1 ] && { step "Training ensemble (XGBoost + LightGBM)"; python -m app.ml.train; }
{ [ "$needData" = 1 ] || [ "$needModel" = 1 ] || [ "$needDb" = 1 ]; } && { step "Seeding database"; python -m app.db.seed; }

if [ ! -f .env ]; then
  cp .env.example .env
  echo "  Created backend/.env — add OPENROUTER_API_KEY / GEMINI_API_KEY for live AI (optional; works without)."
fi
deactivate

# ---------------- Frontend ----------------
step "Frontend: installing npm dependencies"
cd "$ROOT/frontend"
npm install
[ -f .env ] || cp .env.example .env

printf "\nSetup complete.\nStart everything with:  ./run.sh\n"
