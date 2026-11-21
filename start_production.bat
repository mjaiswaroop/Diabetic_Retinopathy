@echo off
TITLE RetinaScan Pro - Production Launcher
COLOR 0A

echo =====================================================================
echo           RETINASCAN PRO: CLINICAL AI SCREENING SYSTEM
echo =====================================================================
echo [1/3] Checking environment & dependencies...

REM Check if Python 3.12 is on PATH or at WindowsApps
set PYTHON_EXE=python
where python >nul 2>nul
if %errorlevel% neq 0 (
    set PYTHON_EXE="C:\Program Files\WindowsApps\PythonSoftwareFoundation.Python.3.12_3.12.2800.0_x64__qbz5n2kfra8p0\python3.12.exe"
)

echo [2/3] Launching PyTorch Inference Backend (Port 8000)...
start "RetinaScan Backend (PyTorch ResNet-50 Grad-CAM++)" cmd /k "cd backend && %PYTHON_EXE% direct_server.py"

REM Give backend 4 seconds to load ResNet-50 weights
timeout /t 4 /nobreak >nul

echo [3/3] Launching Next.js Production Cockpit (Port 3005)...
start "RetinaScan Frontend (Next.js Edge Cockpit)" cmd /k "cd frontend && npm run dev -- -p 3005"

echo.
echo =====================================================================
echo  System Started Successfully!
echo  - Frontend Cockpit: http://localhost:3005
echo  - Backend API:      http://localhost:8000
echo  - API Docs:         http://localhost:8000/docs
echo =====================================================================
echo.
pause
