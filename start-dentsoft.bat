@echo off
rem DentSoft bekci betigi: 3001 portu dinlenmiyorsa sunucuyu (PM2 ile) baslatir.
rem Windows acilisinda ve zamanlanmis gorevle 5 dakikada bir calisir.
rem Yol %~dp0 ile bulunur; betikte Turkce karakter YOKTUR (kodlama sorunu olmasin diye).
set "PATH=C:\Program Files\nodejs;%APPDATA%\npm;%PATH%"
cd /d "%~dp0"

powershell -NoProfile -Command "$c = New-Object Net.Sockets.TcpClient; try { $c.Connect('127.0.0.1', 3001); $c.Close(); exit 0 } catch { exit 1 }"
if %errorlevel%==0 exit /b 0

rem Sunucu kapali: eski PM2 kaydini ve bozulabilen gelistirme onbellegini temizle, yeniden baslat.
call pm2 delete dentsoft >nul 2>&1
if exist ".next\dev" rmdir /s /q ".next\dev" >nul 2>&1
if exist ".next-dev" rmdir /s /q ".next-dev" >nul 2>&1
if exist ".next-dev-3001" rmdir /s /q ".next-dev-3001" >nul 2>&1
call pm2 start ecosystem.config.js >nul 2>&1
call pm2 save >nul 2>&1
exit /b 0
