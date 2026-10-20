@echo off
REM ============================================================
REM  Grant the SYSTEM account write access to the Node-RED
REM  working directories.
REM
REM  Run this from an ADMINISTRATOR command prompt, once, after
REM  installing the service.
REM
REM  Why: the service runs as LocalSystem. If the repository sits
REM  under a user profile folder, SYSTEM can read it but may not be
REM  able to write nr\data (SQLite needs write access to the
REM  database and its journal files) or create the log directory.
REM ============================================================
setlocal enabledelayedexpansion

set "SERVICE_NAME=%~1"
if not defined SERVICE_NAME set "SERVICE_NAME=SwitchMachineNR"

set "SCRIPT_DIR=%~dp0"
for %%I in ("%SCRIPT_DIR%..\..") do set "REPO_ROOT=%%~fI"
set "NR_DIR=%REPO_ROOT%\nr"
set "LOG_DIR=%REPO_ROOT%\deploy\windows\logs"

reg query "HKU\S-1-5-19" >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Administrator privileges are required.
  exit /b 1
)

if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"

echo [INFO] Granting SYSTEM write access ...
icacls "%NR_DIR%" /grant "SYSTEM:(OI)(CI)M" /T /Q
icacls "%LOG_DIR%" /grant "SYSTEM:(OI)(CI)M" /T /Q

echo.
echo [OK] Done. Verify the service account with:
echo       sc qc %SERVICE_NAME%
echo.

endlocal
