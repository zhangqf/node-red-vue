@echo off
REM ============================================================
REM  Update the SwitchMachine Node-RED service.
REM
REM  Thin wrapper around update.ps1. Everything interesting
REM  lives in the .ps1 -- this file only exists so the
REM  command can be launched without the long
REM  -ExecutionPolicy Bypass incantation.
REM
REM  Usage:
REM    update.bat                 REM restart the service only
REM    update.bat -Pull -Install  REM pull code + reinstall deps + restart
REM    update.bat -Pull           REM pull code + restart
REM    update.bat -Install        REM reinstall deps + restart
REM
REM  Service stop/start needs Administrator, so a UAC prompt
REM  will appear. pnpm/git run as the current user.
REM ============================================================
setlocal

set "SCRIPT_DIR=%~dp0"

REM Switch the console to UTF-8 before PowerShell starts, otherwise the
REM Chinese output of the .ps1 is transcoded through the OEM codepage
REM (936 on a Chinese Windows) and comes out as mojibake. The original
REM codepage is restored at the end.
for /f "tokens=2 delims=:" %%a in ('chcp 2^>nul') do set "OLD_CP=%%a"
chcp 65001 >nul

powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%update.ps1" %*
set "RC=%ERRORLEVEL%"

if defined OLD_CP chcp %OLD_CP% >nul

echo.
if not "%RC%"=="0" echo [FAILED] exit code %RC%
endlocal & exit /b %RC%
