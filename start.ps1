# RetinaScan Pro 1-Click Startup Script for PowerShell
Write-Host "=====================================================================" -ForegroundColor Cyan
Write-Host "          RETINASCAN PRO: CLINICAL AI TRIAGE WORKSTATION             " -ForegroundColor Green
Write-Host "=====================================================================" -ForegroundColor Cyan

$scriptRoot = $PSScriptRoot

Write-Host "`n[1/3] Starting PyTorch AI Inference Engine (Port 8000)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$scriptRoot\backend'; python direct_server.py"

Start-Sleep -Seconds 3

Write-Host "[2/3] Starting Next.js Production Web Application (Port 3005)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$scriptRoot\frontend'; npm run start"

Start-Sleep -Seconds 2

Write-Host "[3/3] Opening Workstation in your default browser..." -ForegroundColor Green
Start-Process "http://localhost:3005"

Write-Host "`nServices launched successfully:" -ForegroundColor Cyan
Write-Host " - Frontend: http://localhost:3005" -ForegroundColor White
Write-Host " - Backend:  http://localhost:8000/docs`n" -ForegroundColor White

