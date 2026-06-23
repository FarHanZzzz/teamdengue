# One-shot backend setup: venv -> deps -> data -> train -> seed
$ErrorActionPreference = "Stop"
Write-Host "Creating virtual environment..." -ForegroundColor Cyan
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -r requirements.txt

Write-Host "Generating synthetic dataset..." -ForegroundColor Cyan
.\.venv\Scripts\python.exe data\generate_data.py

Write-Host "Training ensemble (XGBoost + LightGBM)..." -ForegroundColor Cyan
.\.venv\Scripts\python.exe -m app.ml.train

Write-Host "Seeding database..." -ForegroundColor Cyan
.\.venv\Scripts\python.exe -m app.db.seed

Write-Host "`nDone. Start the API with:" -ForegroundColor Green
Write-Host "  .\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000"
