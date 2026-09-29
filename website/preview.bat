@echo off
setlocal
title HealThaali Preview
cd /d "%~dp0"

echo.
echo ==========================================
echo          HealThaali Preview
echo ==========================================
echo.

where node >nul 2>nul
if errorlevel 1 goto nonode

if exist node_modules goto build

echo Installing dependencies - this runs once and takes a minute...
echo.
call npm install
if errorlevel 1 goto npmfailed
echo.

:build
echo Building the production site first...
echo.
call npm run build
if errorlevel 1 goto buildfailed

echo Shutting down any server an earlier run left on port 4321...
call npm run dev:stop >nul 2>nul
call npm run preview:stop >nul 2>nul
echo.
echo Starting the preview server for dist\ ...
echo Press Ctrl+C in this window to stop it.
echo.
call npm run preview
goto done

:nonode
echo Node.js was not found on PATH.
echo Install a current Node.js LTS release from https://nodejs.org then try again.
echo.
pause
exit /b 1

:npmfailed
echo.
echo Dependency installation failed - see the messages above.
echo.
pause
exit /b 1

:buildfailed
echo.
echo Build failed - not starting the preview server.
echo.
pause
exit /b 1

:done
echo.
echo Preview server stopped.
pause
endlocal
