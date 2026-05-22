@echo off
title BiliNote Batch Tool

echo ============================================
echo   BiliNote Batch Tool
echo ============================================
echo.

cd /d "%~dp0"

where python >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python not found, please install Python 3.8+
    echo [Download] https://www.python.org/downloads/
    pause
    exit /b 1
)

pip show flask >nul 2>&1
if %errorlevel% neq 0 (
    echo [INSTALL] Installing dependencies...
    pip install -r requirements.txt
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to install dependencies
        pause
        exit /b 1
    )
    echo.
)

echo [CLEAN] Checking old processes...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":18765.*LISTENING"') do (
    echo [CLEAN] Killing old process PID=%%a
    taskkill /PID %%a /F >nul 2>&1
)
timeout /t 1 /nobreak >nul

echo [START] BiliNote Batch Tool
echo [URL] http://localhost:18765
echo [BiliNote] http://localhost:3015
echo.
echo Press Ctrl+C to stop
echo ============================================

python app.py

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Program exited abnormally
    pause
)
