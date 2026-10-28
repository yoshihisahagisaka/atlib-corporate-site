@echo off
start "WSC Local UI Server" /b node "%~dp0server.mjs"
timeout /t 1 /nobreak >nul
start "WSC Local UI" "http://127.0.0.1:38152"
