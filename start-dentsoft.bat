@echo off
set PATH=C:\Program Files\nodejs;C:\Users\furkan\AppData\Roaming\npm;%PATH%
cd /d "C:\Users\furkan\OneDrive\Masaüstü\Ozanoğlu Poliklinik\dentsoft"
pm2 start ecosystem.config.js >nul 2>&1
pm2 save >nul 2>&1
