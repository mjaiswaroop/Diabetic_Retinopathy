@echo off
TITLE RetinaScan Pro - Medical Workstation Launcher
COLOR 0A

echo =====================================================================
echo           RETINASCAN PRO: CLINICAL AI TRIAGE WORKSTATION
echo =====================================================================
echo.
echo [1/3] Checking environment and launching PyTorch AI Engine (Port 8000)...
start "RetinaScan Backend (FastAPI / PyTorch :8000)" cmd /k "cd /d %~dp0backend && python direct_server.py"

echo [2/3] Waiting for AI model weights to initialize...
timeout /t 3 /nobreak >nul

echo [3/3] Launching Next.js Frontend Application (Port 3005)...
start "RetinaScan Frontend (Next.js :3005)" cmd /k "cd /d %~dp0frontend && npm run start"

echo.
echo =====================================================================
echo  System is running!
echo   - Web Application: http://localhost:3005
echo   - Backend Docs:    http://localhost:8000/docs
echo =====================================================================
echo.
echo Opening RetinaScan Pro in your browser...
timeout /t 2 /nobreak >nul
start http://localhost:3005

