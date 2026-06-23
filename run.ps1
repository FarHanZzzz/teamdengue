# PrevDengue — start backend (API) + frontend (web) together (Windows)
# Backend: http://127.0.0.1:8000  ·  Frontend: http://localhost:5173
$ErrorActionPreference = "Stop"
$root = $PSScriptRoot

if (-not (Test-Path "$root\backend\.venv")) {
  Write-Host "Dependencies not installed. Run .\setup.ps1 first." -ForegroundColor Red
  exit 1
}

Write-Host "Starting backend API on http://127.0.0.1:8000 ..." -ForegroundColor Cyan
$backend = Start-Process -PassThru -FilePath "$root\backend\.venv\Scripts\python.exe" `
  -ArgumentList "-m", "uvicorn", "app.main:app", "--reload", "--host", "127.0.0.1", "--port", "8000" `
  -WorkingDirectory "$root\backend"

Start-Sleep -Seconds 3
Write-Host "Starting frontend on http://localhost:5173 ... (Ctrl+C to stop both)" -ForegroundColor Cyan
Push-Location "$root\frontend"
try {
  npm run dev
} finally {
  Write-Host "`nStopping backend..." -ForegroundColor Yellow
  Stop-Process -Id $backend.Id -Force -ErrorAction SilentlyContinue
  Pop-Location
}
