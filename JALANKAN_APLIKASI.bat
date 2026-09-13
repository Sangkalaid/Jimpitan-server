@echo off
chcp 65001 > nul
title Aplikasi Ronda & Jimpitan Warga RT 01
color 0B

echo ====================================================================
echo          APLIKASI RONDA & JIMPITAN WARGA RT 01 / RW 02
echo                 Kelurahan Bener - Siap Pakai
echo ====================================================================
echo.

:: Cek apakah server lokal port 8088 sudah aktif
curl -s -o nul http://localhost:8088/index.html
if %errorlevel% neq 0 (
    echo [1/3] Menjalankan server lokal port 8088...
    start /min "" python -m http.server 8088
    timeout /t 2 /nobreak > nul
) else (
    echo [1/3] Server lokal port 8088 sudah aktif!
)

echo [2/3] Membuka aplikasi di browser...
start http://localhost:8088/index.html

echo.
echo ====================================================================
echo                       INFORMASI AKSES
echo ====================================================================
echo  [A] Komputer / Laptop ini:
echo      - Aplikasi Utama : http://localhost:8088/index.html
echo      - Ruang Pengujian: http://localhost:8088/test_aplikasi_ronda.html
echo      - Panduan QR HP  : http://localhost:8088/buka_di_hp.html
echo.
echo  [B] Akses Langsung di HP Android / iPhone (Wi-Fi Yang Sama):
echo      - Alamat URL     : http://192.168.1.21:8088/index.html
echo.
echo  [C] Cara Install Jadi Aplikasi di HP (Tanpa APK):
echo      1. Buka http://192.168.1.21:8088/index.html di Chrome HP
echo      2. Klik tombol menu titik tiga (⋮) di pojok kanan atas
echo      3. Klik "Tambahkan ke Layar Utama" / "Install Aplikasi"
echo      4. Selesai! Icon Ronda RT 01 akan terpasang di layar HP.
echo ====================================================================
echo.
echo Tekan sembarang tombol untuk menutup jendela ini (Server tetap aktif).
pause > nul
