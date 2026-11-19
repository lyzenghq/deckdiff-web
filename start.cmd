@echo off
rem SPDX-License-Identifier: GPL-2.0-only
setlocal
cd /d "%~dp0"

rem Node.js is a prerequisite. Do not use runtimes bundled with other apps.
set "NODE_EXE="
for /f "delims=" %%N in ('where.exe node.exe 2^>nul') do if not defined NODE_EXE set "NODE_EXE=%%N"
if not defined NODE_EXE if exist "%ProgramFiles%\nodejs\node.exe" set "NODE_EXE=%ProgramFiles%\nodejs\node.exe"
if not defined NODE_EXE if exist "%LocalAppData%\Programs\nodejs\node.exe" set "NODE_EXE=%LocalAppData%\Programs\nodejs\node.exe"

if not defined NODE_EXE (
  echo Node.js was not found. It must be installed separately.
  echo Install Node.js 22.9.0 or newer from https://nodejs.org/en/download
  echo Then reopen this window and run start.cmd again. See README.md.
  pause
  exit /b 1
)
"%NODE_EXE%" -e "const [major,minor]=process.versions.node.split('.').map(Number);process.exit(major>22||(major===22&&minor>=9)?0:1)"
if errorlevel 1 (
  echo Node.js 22.9.0 or newer is required. Please update Node.js.
  echo Download: https://nodejs.org/en/download
  pause
  exit /b 1
)
echo Using Node.js: %NODE_EXE%
"%NODE_EXE%" --env-file-if-exists=.env server.mjs
pause
