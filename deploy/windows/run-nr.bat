@echo off
REM ============================================================
REM  SwitchMachine Node-RED launcher
REM
REM  Starts Node-RED from the nr\ directory. The working
REM  directory matters: flows.json opens SQLite as the
REM  relative path "./data/device.db", so launching from
REM  anywhere else creates an empty database in that folder
REM  and the device/config lists come up blank.
REM
REM  This script is the single source of truth for the
REM  launch command; the Windows service (install-service.bat)
REM  reuses the same arguments.
REM ============================================================
REM Delayed expansion is deliberately NOT enabled: it would mangle
REM repository paths containing '!'.
setlocal

REM --- locate the repository root (this file lives in deploy\windows) ---
set "SCRIPT_DIR=%~dp0"
for %%I in ("%SCRIPT_DIR%..\..") do set "REPO_ROOT=%%~fI"
set "NR_DIR=%REPO_ROOT%\nr"

if not exist "%NR_DIR%\settings.cjs" (
  echo [ERROR] Cannot find %NR_DIR%\settings.cjs
  echo         Repository layout looks wrong.
  exit /b 1
)

REM --- locate node.exe ---
REM Prefer an explicit override, then the PATH, then the usual install dirs.
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

REM --- the project's own node-red, not a globally installed one ---
REM A global install (npm i -g node-red) resolves its palette from its own
REM directory tree and never finds the project's node-red-contrib-modbus /
REM node-red-node-sqlite, so the flows fail to load. Always use the copy
REM inside the repository.
if not exist "%REPO_ROOT%\node_modules\node-red\red.js" (
  echo [ERROR] Project node-red is missing: %REPO_ROOT%\node_modules\node-red
  echo         Run `pnpm install` in %REPO_ROOT% first.
  exit /b 1
)
for /f "usebackq delims=" %%g in (`where node-red 2^>nul`) do (
  echo [WARN] A global 'node-red' is on the PATH: %%g
  echo        This script does NOT use it; it runs the project's copy.
)

REM --- userDir: keep Node-RED's own files inside the repository ---
REM Without this, Node-RED falls back to %%USERPROFILE%%\.node-red, which for
REM the SYSTEM account lands in C:\Windows\System32\config\systemprofile.
set "USER_DIR=%NR_DIR%\.node-red"

REM --- change into nr\ so the relative ./data paths resolve ---
cd /d "%NR_DIR%"

echo [INFO] Node    : %NODE_EXE%
echo [INFO] Repo    : %REPO_ROOT%
echo [INFO] node-red: %REPO_ROOT%\node_modules\node-red\red.js
echo [INFO] Working : %NR_DIR%
echo [INFO] userDir : %USER_DIR%
echo [INFO] Listening on port 1880 ...
echo.

"%NODE_EXE%" "%REPO_ROOT%\node_modules\node-red\red.js" ^
  --settings "%NR_DIR%\settings.cjs" ^
  --userDir "%USER_DIR%"

endlocal
