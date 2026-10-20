@echo off
REM ============================================================
REM  Register Node-RED as a Windows service (auto-start on boot)
REM
REM  Run this from an ADMINISTRATOR command prompt.
REM
REM  Why NSSM: node-red is a plain console program and does not
REM  implement the service control protocol, so `sc create` fails
REM  with error 1053. NSSM is the shim that receives the SCM
REM  commands and manages the node process underneath.
REM
REM  What this script sets up:
REM    - AppDirectory  = <repo>\nr   (so ./data/device.db resolves)
REM    - AppParameters = red.js --settings ... --userDir ...
REM    - stdout/stderr redirected to log files (settings.cjs only
REM      logs to console, which a service has none of)
REM    - restart on exit, so a crash does not take the device down
REM
REM  Usage:  install-service.bat [service-name]
REM ============================================================
REM Note: delayed expansion is deliberately NOT enabled -- it would mangle
REM repository paths containing '!' (e.g. "D:\Projects\!tmp\...").
REM The node lookup below uses "if not defined", which is evaluated at run
REM time and therefore does not need it.
setlocal

set "SERVICE_NAME=%~1"
if not defined SERVICE_NAME set "SERVICE_NAME=SwitchMachineNR"

REM --- locate the repository root ---
set "SCRIPT_DIR=%~dp0"
for %%I in ("%SCRIPT_DIR%..\..") do set "REPO_ROOT=%%~fI"
set "NR_DIR=%REPO_ROOT%\nr"
set "LOG_DIR=%REPO_ROOT%\deploy\windows\logs"

set "NSSM=%SCRIPT_DIR%nssm.exe"

if not exist "%NSSM%" (
  echo [ERROR] nssm.exe not found next to this script.
  exit /b 1
)
if not exist "%NR_DIR%\settings.cjs" (
  echo [ERROR] Cannot find %NR_DIR%\settings.cjs
  exit /b 1
)
if not exist "%REPO_ROOT%\node_modules\node-red\red.js" (
  echo [ERROR] node-red is not installed. Run `pnpm install` in %REPO_ROOT% first.
  exit /b 1
)

REM --- must be administrator ---
REM Query the LocalService hive: reading another account's HKU key needs
REM elevation. Unlike "net session" this does not depend on the Server
REM service running, so it cannot give a false negative.
reg query "HKU\S-1-5-19" >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Administrator privileges are required.
  echo         Right-click "Command Prompt" and choose "Run as administrator".
  exit /b 1
)

REM --- locate node.exe (same lookup order as run-nr.bat) ---
set "NODE_EXE="
if defined SWITCH_MACHINE_NODE set "NODE_EXE=%SWITCH_MACHINE_NODE%"
if not defined NODE_EXE (
  for /f "delims=" %%i in ('where node 2^>nul') do (
    if not defined NODE_EXE set "NODE_EXE=%%i"
  )
)
if not defined NODE_EXE (
  if exist "%ProgramFiles%\nodejs\node.exe" set "NODE_EXE=%ProgramFiles%\nodejs\node.exe"
)
if not defined NODE_EXE (
  if exist "%ProgramFiles(x86)%\nodejs\node.exe" set "NODE_EXE=%ProgramFiles(x86)%\nodejs\node.exe"
)
if not defined NODE_EXE (
  echo [ERROR] node.exe not found.
  echo         Install Node.js, or set SWITCH_MACHINE_NODE to its full path.
  exit /b 1
)

REM --- remove an existing registration so this script is re-runnable ---
"%NSSM%" stop "%SERVICE_NAME%" >nul 2>&1
"%NSSM%" remove "%SERVICE_NAME%" confirm >nul 2>&1

if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"

echo [INFO] Registering service "%SERVICE_NAME%" ...
echo [INFO]   node    : %NODE_EXE%
echo [INFO]   workdir : %NR_DIR%
echo [INFO]   logs    : %LOG_DIR%
echo.

REM --- install ---
REM AppParameters is stored as a single string and re-parsed by Windows when
REM the service starts, so nested quotes are fragile. Instead every path in
REM it is RELATIVE to AppDirectory (set just below), which removes the need
REM for inner quoting entirely -- a repository path containing spaces
REM ("D:\My Projects\...") then works without any escaping.
"%NSSM%" install "%SERVICE_NAME%" "%NODE_EXE%"

REM Paths relative to AppDirectory=<repo>\nr:
REM   ..\node_modules\node-red\red.js  -> the Node-RED entry point
REM   settings.cjs                     -> our settings file
REM   .node-red                        -> userDir, kept inside the repository
"%NSSM%" set "%SERVICE_NAME%" AppParameters "..\node_modules\node-red\red.js --settings settings.cjs --userDir .node-red"

REM --- working directory: this is the one that matters ---
REM flows.json opens SQLite as "./data/device.db"; if the service starts in
REM C:\Windows\System32 the database is created there instead and every
REM device/config lookup comes up empty.
"%NSSM%" set "%SERVICE_NAME%" AppDirectory "%NR_DIR%"

REM --- logging: settings.cjs only writes to console, and a service has none ---
"%NSSM%" set "%SERVICE_NAME%" AppStdout "%LOG_DIR%\node-red.out.log"
"%NSSM%" set "%SERVICE_NAME%" AppStderr "%LOG_DIR%\node-red.err.log"
REM keep the stdout log from growing without bound
"%NSSM%" set "%SERVICE_NAME%" AppRotateFiles 1
"%NSSM%" set "%SERVICE_NAME%" AppRotateBytes 10485760

REM --- restart on failure ---
REM AppExit Default Restart covers unexpected exits (crash, OOM, port taken).
"%NSSM%" set "%SERVICE_NAME%" AppExit Default Restart
"%NSSM%" set "%SERVICE_NAME%" AppRestartDelay 5000

REM --- stop cleanly: red.js handles SIGINT/SIGTERM/SIGBREAK (red.js:552-556) ---
"%NSSM%" set "%SERVICE_NAME%" AppStopMethodConsole 15000

REM --- start type ---
REM AUTO_START: boots with Windows, before anyone logs in.
"%NSSM%" set "%SERVICE_NAME%" Start SERVICE_AUTO_START
"%NSSM%" set "%SERVICE_NAME%" DisplayName "SwitchMachine Node-RED"
"%NSSM%" set "%SERVICE_NAME%" Description "SwitchMachine Node-RED backend (port 1880)"

REM --- run as SYSTEM: true unattended operation, no stored password ---
"%NSSM%" set "%SERVICE_NAME%" ObjectName LocalSystem

echo [INFO] Starting service ...
"%NSSM%" start "%SERVICE_NAME%"

echo.
echo [OK] Service "%SERVICE_NAME%" registered and started.
echo      Start type : Automatic (starts on boot, no login required)
echo      Account    : LocalSystem
echo      Logs       : %LOG_DIR%
echo.
echo      Manage with:
echo        net stop %SERVICE_NAME%      /  net start %SERVICE_NAME%
echo        nssm stop %SERVICE_NAME%    /  nssm start %SERVICE_NAME%
echo.
echo      Uninstall with: uninstall-service.bat

endlocal
