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
echo  [★] LINK RESMI ONLINE (Aktif 24 Jam Nonstop - Komputer Bebas Dimatikan):
echo      https://sangkalaid.github.io/Jimpitan-server/
echo.
echo  [A] Komputer / Laptop ini (Offline / Server Lokal):
echo      - Aplikasi Utama : http://localhost:8088/index.html
echo      - Ruang Pengujian: http://localhost:8088/test_aplikasi_ronda.html
echo      - Panduan QR HP  : http://localhost:8088/buka_di_hp.html
echo.
echo  [B] Akses di HP Warga / Pengurus (Bisa Pakai Kuota / Wi-Fi Mana Saja):
echo      - Langsung Buka : https://sangkalaid.github.io/Jimpitan-server/
echo.
echo  [C] Cara Pasang Jadi Aplikasi di HP:
echo      1. Buka https://sangkalaid.github.io/Jimpitan-server/ di Chrome HP
echo      2. Klik tombol menu titik tiga (⋮) di pojok kanan atas
echo      3. Klik "Tambahkan ke Layar Utama" / "Install Aplikasi"
echo      4. Selesai! Icon Ronda RT 01 akan terpasang di menu utama HP.
echo ====================================================================
echo.
echo Tekan sembarang tombol untuk menutup jendela ini (Server tetap aktif).
pause > nul
