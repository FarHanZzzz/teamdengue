# PrevDengue — one-command setup (Windows / PowerShell)
# Installs all backend + frontend dependencies and prepares the database.
# Usage:  .\setup.ps1      then      .\run.ps1
$ErrorActionPreference = "Stop"
$root = $PSScriptRoot

function Step($msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }

# ---------------- Backend ----------------
Step "Backend: creating Python virtual environment"
Push-Location "$root\backend"
if (-not (Test-Path ".venv")) { python -m venv .venv }
.\.venv\Scripts\python.exe -m pip install --upgrade pip | Out-Null
Step "Backend: installing Python dependencies (this can take a few minutes)"
.\.venv\Scripts\python.exe -m pip install -r requirements.txt

# Build artifacts only if missing — committed data/models make this a fast no-op.
$needData  = -not (Test-Path "data\raw\dengue_weekly.csv")
$needHosp  = -not (Test-Path "data\raw\hospitals.csv")
$needModel = -not (Test-Path "models\xgb_model.joblib")
$needDb    = -not (Test-Path "prevdengue.db")

if ($needData)  { Step "Generating synthetic dataset"; .\.venv\Scripts\python.exe data\generate_data.py }
if ($needData -or $needHosp) { Step "Generating hospital registry"; .\.venv\Scripts\python.exe data\generate_hospitals.py }
if ($needModel) { Step "Training ensemble (XGBoost + LightGBM)"; .\.venv\Scripts\python.exe -m app.ml.train }
if ($needData -or $needModel -or $needDb) { Step "Seeding database"; .\.venv\Scripts\python.exe -m app.db.seed }

if (-not (Test-Path ".env")) {
  Copy-Item ".env.example" ".env"
  Write-Host "  Created backend\.env — add OPENROUTER_API_KEY / GEMINI_API_KEY for live AI (optional; works without)." -ForegroundColor Yellow
}
Pop-Location

# ---------------- Frontend ----------------
Step "Frontend: installing npm dependencies"
Push-Location "$root\frontend"
npm install
if (-not (Test-Path ".env")) { Copy-Item ".env.example" ".env" }
Pop-Location

Write-Host "`nSetup complete." -ForegroundColor Green
Write-Host "Start everything with:  .\run.ps1" -ForegroundColor Green
