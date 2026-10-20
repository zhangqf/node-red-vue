@echo off
REM ============================================================
REM  Remove the SwitchMachine Node-RED Windows service
REM
REM  Run this from an ADMINISTRATOR command prompt.
REM
REM  The service registration and the log files are removed.
REM  The repository (flows.json, data\device.db) is left untouched.
REM ============================================================
setlocal enabledelayedexpansion

set "SERVICE_NAME=%~1"
if not defined SERVICE_NAME set "SERVICE_NAME=SwitchMachineNR"

set "SCRIPT_DIR=%~dp0"
for %%I in ("%SCRIPT_DIR%..\..") do set "REPO_ROOT=%%~fI"
set "LOG_DIR=%REPO_ROOT%\deploy\windows\logs"
set "NSSM=%SCRIPT_DIR%nssm.exe"

if not exist "%NSSM%" (
  echo [ERROR] nssm.exe not found next to this script.
  exit /b 1
)

reg query "HKU\S-1-5-19" >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Administrator privileges are required.
  exit /b 1
)

echo [INFO] Stopping service "%SERVICE_NAME%" ...
"%NSSM%" stop "%SERVICE_NAME%" >nul 2>&1

echo [INFO] Removing service "%SERVICE_NAME%" ...
"%NSSM%" remove "%SERVICE_NAME%" confirm

if exist "%LOG_DIR%" (
  echo [INFO] Removing log directory %LOG_DIR% ...
  rmdir /s /q "%LOG_DIR%"
)

echo.
echo [OK] Service "%SERVICE_NAME%" removed.

endlocal
