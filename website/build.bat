@echo off
setlocal
title HealThaali Production Build
cd /d "%~dp0"

echo.
echo ==========================================
echo       HealThaali Production Build
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
call npm run build
if errorlevel 1 goto buildfailed

echo.
echo BUILD SUCCESSFUL.
echo Static output is in dist\ - upload that folder to any static host.
echo.
pause
exit /b 0

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
echo BUILD FAILED - see the messages above.
echo.
pause
exit /b 1
