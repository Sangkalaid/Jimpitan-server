# 01. Struktur Proyek (Project Structure)

Dokumen ini menyajikan peta struktur direktori dan file lengkap dari **Aplikasi Ronda & Jimpitan Warga RT 01 / RW 02 Kelurahan Bener**, disiapkan khusus sebagai referensi audit teknis oleh Software Architect.

---

## 1. Pohon Direktori (Directory Tree)

```text
f:\ronda 2\
│
├── .github\
│   └── workflows\
│       └── build-apk.yml              # CI/CD GitHub Actions: Kompilasi APK Android otomatis
│
├── android\                            # Native Android Wrapper Project (Kotlin + Gradle)
│   ├── app\
│   │   ├── build.gradle               # Konfigurasi modul aplikasi (SDK, dependency, tasks)
│   │   ├── proguard-rules.pro         # Aturan ProGuard untuk obfuscation & bridge preservation
│   │   └── src\
│   │       └── main\
│   │           ├── AndroidManifest.xml # Deklarasi permission, activity, intent, dan tema
│   │           ├── assets\
│   │           │   └── www\           # Salinan aset web untuk eksekusi WebView luring
│   │           │       ├── favicon.ico
│   │           │       ├── index.html
│   │           │       ├── manifest.json
│   │           │       ├── sw.js
│   │           │       └── icons\
│   │           ├── java\id\kelurahan\bener\ronda\
│   │           │   ├── AndroidBridge.kt # JavascriptInterface bridge ke fitur hardware Android
│   │           │   └── MainActivity.kt  # Root Activity, WebView, BiometricPrompt, Back Button
│   │           └── res\
│   │               ├── drawable\
│   │               │   └── app_icon.xml # Vektor ikon aplikasi
│   │               ├── values\
│   │               │   ├── colors.xml   # Palet warna native Android
│   │               │   ├── strings.xml  # String resource (nama aplikasi, prompt biometrik)
│   │               │   └── styles.xml   # Tema window tanpa action bar (fullscreen)
│   │               └── xml\
│   │                   ├── backup_rules.xml
│   │                   └── data_extraction_rules.xml
│   ├── gradle\
│   │   └── wrapper\
│   │       ├── gradle-wrapper.jar      # Binary runtime wrapper Gradle
│   │       └── gradle-wrapper.properties # Gradle distribution URL (v8.2)
│   ├── build.gradle                    # Konfigurasi build tingkat proyek (AGP 8.2.2, Kotlin 1.9.22)
│   ├── gradle.properties               # JVM memory configuration untuk compiler Gradle
│   ├── gradlew                         # Script eksekusi Gradle untuk Linux / macOS
│   ├── gradlew.bat                     # Script eksekusi Gradle untuk Windows
│   └── settings.gradle                 # Pengaturan repositori dependensi Maven/Google
│
├── docs\
│   └── prd_aplikasi_ronda_jimpitan_warga.md # Product Requirement Document (PRD) & Design System
│
├── icons\                              # Aset visual branding PWA dan shortcut layar utama
│   ├── apple-touch-icon.png           # Ikon shortcut iOS Safari (180x180)
│   ├── icon-192.png                   # Ikon PWA standar Android (192x192)
│   ├── icon-512.png                   # Ikon splash screen resolusi tinggi (512x512)
│   └── qr_akses_hp.png                # QR Code cepat untuk memindai URL produksi via ponsel
│
├── supabase\                           # Skrip database PostgreSQL, migrasi, dan audit keamanan
│   ├── migrations\
│   │   ├── 202609160001_fix_security_invoker_views.sql # Mengaktifkan security_invoker pada view
│   │   └── 202609160002_harden_rpc_permissions.sql    # Menutup izin eksekusi anonim pada RPC
│   ├── SECURITY_STATUS.md             # Catatan audit keamanan database (0 errors, 6 warnings)
│   └── verify_rpc_security.sql        # Skrip verifikasi hak akses RPC dan formula Haversine
│
├── .gitignore                          # Aturan pengecualian file version control Git
├── buka_di_hp.html                     # Halaman panduan instalasi PWA di smartphone tanpa APK
├── COMPILE_APK.bat                     # Otomatisasi Windows: sinkronkan aset web & build APK Gradle
├── favicon.ico                         # Favicon browser tab aplikasi
├── index.html                          # Inti aplikasi web (Frontend SPA, Logic, Style, Supabase Client)
├── JALANKAN_APLIKASI.bat               # Otomatisasi Windows: menjalankan server lokal Python port 8088
├── manifest.json                       # Konfigurasi standar W3C Web App Manifest (PWA)
├── README.md                           # Dokumentasi umum pengembang & cara pengoperasian
├── sw.js                               # Service Worker: caching offline-first (Cache API)
└── test_aplikasi_ronda.html            # Workbench pengujian mandiri dengan simulator iPhone 390px
```

---

## 2. Penjelasan Rinci Setiap Komponen Direktori

### 2.1 Direktori Root (`/`)

Direktori root memegang peran ganda: sebagai **Web Single Page Application (SPA)** siap saji yang dapat langsung dideploy ke web server statis (seperti GitHub Pages), sekaligus sebagai sumber aset hulu (*upstream source*) bagi proyek Android.

| File / Modul | Peran & Tanggung Jawab Teknis |
|---|---|
| `index.html` | Titik masuk utama aplikasi (SPA 2.932 baris). Mengintegrasikan HTML5 semantik, styling responsif Tailwind CSS via CDN, ikon Phosphor & Material Symbols, state management berbasis reaktif lokal, integrasi Supabase JS SDK v2, dan koneksi ke hardware Android via bridge. |
| `sw.js` | Service Worker PWA dengan nama cache `ronda-rt01-v2.4.1`. Menerapkan strategi caching *Stale-While-Revalidate* untuk aset lokal inti (`index.html`, `manifest.json`, ikon) dan *Network-First* dengan fallback luring. Otomatis mengabaikan request non-GET dan panggilan API Supabase. |
| `manifest.json` | Deklarasi metadata Progressive Web App (PWA). Mengatur mode tampilan `standalone` (fullscreen tanpa bilah URL browser), orientasi `portrait`, skema warna primer `#0f4c81`, serta icon pack resolusi multi-skala (192px, 512px, Apple Touch). |
| `buka_di_hp.html` | Portal panduan orientasi bagi warga dan pengurus RT. Menyediakan QR Code dinamis dan panduan 5 langkah menginstal PWA ke layar utama ponsel melalui Chrome Android. |
| `test_aplikasi_ronda.html` | Testbed interaktif untuk simulasi lingkungan mobile (resolusi iPhone 390×844px). Dilengkapi Dynamic Island notch, switch status peran instan (Pengurus vs Warga), monitor getar haptic, simulator biometrik, GPS posko, dan indikator status sinkronisasi Supabase. |
| `JALANKAN_APLIKASI.bat` | Skrip batch Windows untuk kenyamanan pengembang lokal. Memeriksa ketersediaan port 8088, meluncurkan server lokal ringan berbasis `python -m http.server 8088`, dan membuka peramban secara otomatis. |
| `COMPILE_APK.bat` | Skrip batch Windows untuk kompilasi APK lokal. Melakukan sinkronisasi otomatis file `index.html`, `manifest.json`, `sw.js`, `favicon.ico`, dan `icons/` ke dalam folder `android/app/src/main/assets/www/`, kemudian memanggil `gradlew.bat assembleDebug`. |
| `README.md` | Dokumentasi ringkas tingkat repositori mengenai ringkasan fitur, cara menjalankan di lokal, URL hosting produksi, opsi build APK, dan catatan kepatuhan produksi. |

---

### 2.2 Direktori `.github/workflows/`

Mengelola integrasi berkelanjutan (CI) berbasis cloud tanpa mengharuskan pengembang memasang Android SDK di komputer lokal:

- **`build-apk.yml`**:
  - **Triggers**: Event `push` ke branch `main`, `pull_request` ke `main`, serta `workflow_dispatch` (tombol manual trigger dari GitHub Web UI).
  - **Runner**: `ubuntu-latest`.
  - **Setup**: Memasang JDK 17 (distribusi Eclipse Temurin) dengan caching dependensi Gradle aktif.
  - **Compilation**: Menjalankan `./gradlew assembleDebug --stacktrace` pada subdirektori `android/`.
  - **Artifact**: Mengunggah APK debug yang dihasilkan (`app-debug.apk`) ke GitHub Actions Artifacts dengan masa retensi 30 hari, dinamai `Ronda-RT01-app-debug`.
  - **Release Pipeline**: Otomatis membuat GitHub Release jika commit memiliki penanda Git Tag (`refs/tags/*`).

---

### 2.3 Direktori `android/`

Merupakan proyek native Android lengkap yang dibangun dengan arsitektur **Hybrid WebView Container**:

- **`android/app/src/main/java/id/kelurahan/bener/ronda/`**:
  - **`MainActivity.kt`**: Subclass `AppCompatActivity`. Menggunakan `androidx.webkit.WebViewAssetLoader` untuk memuat file dari lokal assets dengan skema URL aman `https://appassets.androidplatform.net/assets/www/index.html`. Mengelola izin runtime (kamera/file chooser via `registerForActivityResult`, izin lokasi GPS `ACCESS_FINE_LOCATION`, izin notifikasi `POST_NOTIFICATIONS`), inisialisasi `BiometricPrompt`, dan intercept tombol fisik Android Back untuk navigasi modal web.
  - **`AndroidBridge.kt`**: Kelas perantara dengan anotasi `@JavascriptInterface`. Menyediakan antarmuka komunikasi 2 arah antara JavaScript di WebView dan API native sistem operasi Android:
    1. `vibrate(milliseconds: Long)`: Umpan balik haptic getar via `Vibrator` / `VibratorManager`.
    2. `authenticateBiometric()`: Memanggil dialog autentikasi sidik jari bawaan OS Android.
    3. `shareWhatsApp(phoneNumber: String, message: String)`: Intent langsung ke paket `com.whatsapp`.
    4. `shareReport(text: String)`: Android Chooser umum untuk berbagi teks laporan ronda.
    5. `showToast(message: String)`: Menampilkan toast native Android.
    6. `sendNotification(title: String, message: String)`: Menerbitkan notifikasi lokal melalui `NotificationChannel`.
    7. `exitApp()`: Menutup aplikasi.
- **`android/app/src/main/assets/www/`**:
  - Bundel aset web luring yang dimasukkan ke dalam biner APK saat proses kompilasi.
- **`android/app/build.gradle`**:
  - `compileSdk: 34`, `minSdk: 26` (Android 8.0 Oreo), `targetSdk: 34` (Android 14).
  - Mengatur `versionCode: 241` dan `versionName: "2.4.1"`.
  - Mengatur task kustom `syncWebAssets` tipe `Copy` yang otomatis berjalan sebelum tahap `preBuild`.

---

### 2.4 Direktori `supabase/`

Berisi seluruh konfigurasi database cloud PostgreSQL, migrasi keamanan, dan dokumen audit:

- **`migrations/202609160001_fix_security_invoker_views.sql`**: Mengubah opsi tiga view pelaporan keuangan dan operasional (`view_official_cash_ledger`, `view_operational_session_progress`, `view_active_session_houses`) menjadi `security_invoker = true`. Mencabut izin dari role `public` dan `anon`, serta memberikan izin `select` hanya kepada role `authenticated`.
- **`migrations/202609160002_harden_rpc_permissions.sql`**: Mengamankan enam fungsi Remote Procedure Call (RPC) aplikasi dengan mencabut izin `EXECUTE` dari role `anon` dan `public`, lalu memberikannya hanya kepada role `authenticated`. Mengunci `search_path = pg_catalog` pada fungsi kalkulasi jarak `calculate_haversine_distance_meters`.
- **`SECURITY_STATUS.md`**: Ringkasan status audit Supabase Security Advisor untuk proyek `riehidioeftegpkndxok`. Mencatat keberhasilan pengurangan warning dari 13 menjadi 6 warning yang terkontrol (terkait SECURITY DEFINER internal).
- **`verify_rpc_security.sql`**: Query verifikasi otomatis pasca-migrasi untuk memastikan RPC terlindungi dan fungsi spasial berjalan dengan tepat.

---

### 2.5 Direktori `docs/`

- **`prd_aplikasi_ronda_jimpitan_warga.md`**: Dokumen persyaratan produk resmi (PRD) versi 1.0.0. Menguraikan latar belakang lingkungan RT 01 Kelurahan Bener, persona pengguna (Warga, Petugas Ronda, Pengurus RT), standar aksesibilitas WCAG 2.1 Level AA, spesifikasi palet warna dan tipografi, serta peta jalan fitur mendatang (Panic Button SOS dan WhatsApp Gateway).

---

### 2.6 Direktori `icons/`

Berisi aset citra PNG dan vektor untuk branding PWA, ikon aplikasi Android, dan penunjang onboarding warga.
