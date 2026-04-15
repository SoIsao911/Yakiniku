@echo off
title FoamCore OS v2.0 Server
echo.
echo  ========================================
echo   FoamCore OS v2.0 - Local Server
echo   http://localhost:8080
echo  ========================================
echo.
echo  Browser will open automatically.
echo  Keep this window open while using.
echo  Press Ctrl+C to stop.
echo.
where python >nul 2>nul
if %errorlevel%==0 (
    start http://localhost:8080/FoamCoreOS_v2.0.html
    python -m http.server 8080
    goto :end
)
where python3 >nul 2>nul
if %errorlevel%==0 (
    start http://localhost:8080/FoamCoreOS_v2.0.html
    python3 -m http.server 8080
    goto :end
)
echo  Using PowerShell server...
start http://localhost:8080/FoamCoreOS_v2.0.html
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0server.ps1"
:end
pause
