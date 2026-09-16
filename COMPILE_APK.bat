@echo off
chcp 65001 > nul
title Kompilasi APK - Aplikasi Ronda dan Jimpitan Warga RT 01
color 0A

echo ====================================================================
echo        KOMPILASI APK ANDROID - RONDA DAN JIMPITAN WARGA RT 01
echo                 Kelurahan Bener - Siap Pakai
echo ====================================================================
echo.

:: 1. Sinkronisasi aset web terbaru ke wrapper Android
echo [1/3] Menyinkronkan aset web terbaru ke wrapper Android...
if not exist "%~dp0android\app\src\main\assets\www" mkdir "%~dp0android\app\src\main\assets\www"
copy /y "%~dp0index.html" "%~dp0android\app\src\main\assets\www\index.html" > nul
copy /y "%~dp0manifest.json" "%~dp0android\app\src\main\assets\www\manifest.json" > nul
copy /y "%~dp0sw.js" "%~dp0android\app\src\main\assets\www\sw.js" > nul
copy /y "%~dp0favicon.ico" "%~dp0android\app\src\main\assets\www\favicon.ico" > nul
if not exist "%~dp0android\app\src\main\assets\www\icons" mkdir "%~dp0android\app\src\main\assets\www\icons"
copy /y "%~dp0icons\*.*" "%~dp0android\app\src\main\assets\www\icons\" > nul
echo [OK] Aset web berhasil disinkronkan ke android/app/src/main/assets/www!
echo.

:: 2. Cek Lingkungan Java dan Android SDK
echo [2/3] Memeriksa compiler Java dan Android SDK...
set JAVA_FOUND=0
where java >nul 2>nul
if %errorlevel% equ 0 set JAVA_FOUND=1
if defined JAVA_HOME if exist "%JAVA_HOME%\bin\java.exe" set JAVA_FOUND=1

if "%JAVA_FOUND%"=="1" (
    echo [OK] Lingkungan Java terdeteksi. Menjalankan kompilasi Gradle...
    echo.
    echo --------------------------------------------------------------------
    pushd "%~dp0android"
    call gradlew.bat assembleDebug
    popd
    echo --------------------------------------------------------------------
    echo.
    if exist "%~dp0android\app\build\outputs\apk\debug\app-debug.apk" (
        echo ====================================================================
        echo                 [SUKSES] FILE APK BERHASIL DIBUAT!
        echo ====================================================================
        echo  Lokasi File APK:
        echo  %~dp0android\app\build\outputs\apk\debug\app-debug.apk
        echo.
        echo  Cara Memasang di HP Warga:
        echo  1. Kirim file "app-debug.apk" melalui WhatsApp atau kabel data ke HP.
        echo  2. Buka file APK di HP Android, pilih "Install" / "Pasang".
        echo  3. Buka aplikasi Ronda RT 01. Siap digunakan!
        echo ====================================================================
        echo.
        explorer /select,"%~dp0android\app\build\outputs\apk\debug\app-debug.apk"
        goto END
    )
)

echo ====================================================================
echo      OPSI 1: COMPILE OTOMATIS DI CLOUD GITHUB ACTIONS (TERBAIK)
echo ====================================================================
echo  Anda TIDAK PERLU memasang Java JDK atau Android Studio di komputer!
echo  Server GitHub Actions sudah dikonfigurasi untuk compile APK secara otomatis:
echo.
echo  Langkah Mudah:
echo  1. Buka halaman GitHub di browser:
echo     https://github.com/Sangkalaid/Jimpitan-server/actions
echo  2. Klik workflow: 'Build Android APK'
echo  3. Klik tombol 'Run workflow' -^> 'Run workflow'
echo  4. Tunggu ~2 menit hingga selesai bercentang hijau.
echo  5. Klik hasil build, lalu unduh file 'Ronda-RT01-app-debug.zip'.
echo     File APK langsung siap dipasang ke HP warga!
echo.
echo ====================================================================
echo      OPSI 2: KOMPILASI APK LOKAL DENGAN ANDROID STUDIO
echo ====================================================================
echo  1. Buka aplikasi Android Studio di komputer Anda.
echo  2. Klik "Open" dan pilih folder:
echo     "%~dp0android"
echo  3. Tunggu proses sinkronisasi Gradle selesai (otomatis).
echo  4. Klik menu atas: "Build" -^> "Build Bundle(s) / APK(s)" -^> "Build APK(s)".
echo  5. Selesai! Klik "locate" pada notifikasi pop-up untuk mengambil file APK.
echo.
echo ====================================================================
echo  OPSI 3 (INSTAN): LANGSUNG PAKAI DI HP TANPA COMPILE APK
echo ====================================================================
echo  Aplikasi ini adalah Progressive Web App (PWA) resmi berstandar native.
echo  Warga dan Pengurus RT dapat langsung memasang aplikasi ke layar utama HP
echo  dalam 5 detik tanpa perlu compile APK:
echo.
echo  1. Buka di Chrome HP: https://sangkalaid.github.io/Jimpitan-server/
echo  2. Ketuk titik tiga di pojok kanan atas Chrome HP
echo  3. Pilih "Tambahkan ke Layar Utama" / "Install Aplikasi"
echo  4. Ikon resmi Ronda RT 01 langsung terpasang di HP dan aktif fullscreen!
echo ====================================================================

:END
echo.
echo Tekan sembarang tombol untuk menutup jendela ini.
pause > nul