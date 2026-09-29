@echo off
setlocal
title HealThaali Website
cd /d "%~dp0"

echo.
echo ==========================================
echo        HealThaali Website
echo ==========================================
echo.

where node >nul 2>nul
if errorlevel 1 goto nonode

if exist node_modules goto start

echo Installing dependencies - this runs once and takes a minute...
echo.
call npm install
if errorlevel 1 goto npmfailed
echo.

:start
echo Shutting down any server an earlier run left on port 4321...
call npm run dev:stop >nul 2>nul
call npm run preview:stop >nul 2>nul
echo.
echo Starting the Astro development server...
echo Open the URL printed below, usually http://localhost:4321
echo Press Ctrl+C in this window to stop it.
echo.
rem  --force replaces a dev server that came back between the checks above,
rem  instead of failing with "Another astro dev server is already running".
call npm run dev:force
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

:done
echo.
echo Development server stopped.
pause
endlocal
