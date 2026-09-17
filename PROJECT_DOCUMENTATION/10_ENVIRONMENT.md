# 10. Konfigurasi Lingkungan & Variabel (Environment & Variables)

Dokumen ini mendokumentasikan seluruh lingkungan (*environments*), parameter runtime, konfigurasi variabel aplikasi, serta pedoman manajemen rahasia (*secrets management*) pada **Aplikasi Ronda & Jimpitan Warga RT 01 / RW 02 Kelurahan Bener**.

---

## 1. Lingkungan Eksekusi (Environments)

Aplikasi beroperasi di tiga lapisan lingkungan yang terpisah:

| Nama Lingkungan | Deskripsi & Target Platform | Konteks URL / Host |
|---|---|---|
| **Lokal (Development)** | Server lokal komputer pengembang untuk pengujian antarmuka dan debugging logika JavaScript. | `http://localhost:8088/index.html` |
| **Produksi Web (PWA / GitHub Pages)** | Hosting web statis terdistribusi global yang diakses warga melalui browser seluler. | `https://sangkalaid.github.io/Jimpitan-server/` |
| **Native Android (Production APK)** | Lingkungan tertutup WebView container pada sistem operasi Android. | `https://appassets.androidplatform.net/assets/www/index.html` |
| **Cloud Backend (Supabase PostgreSQL)**| Basis data dan server realtime di platform Supabase. | `https://riehidioeftegpkndxok.supabase.co` |

---

## 2. Variabel Konfigurasi Aplikasi

### 2.1 Konfigurasi Klien Supabase (`index.html`)

Konfigurasi ini disematkan pada sisi klien frontend:

| Kunci Variabel | Karakteristik Kunci | Contoh Format Nilai | Peran Fungsional |
|---|---|---|---|
| `SUPABASE_CONFIG.url` | Publik / Aman | `https://<PROJECT_ID>.supabase.co` | Alamat endpoint API gateway Supabase. |
| `SUPABASE_CONFIG.anonKey` | Publik / Publishable | `sb_publishable_...` atau JWT Anon | Kunci anonim untuk otentikasi panggilan PostgREST yang dikontrol oleh kebijakan RLS. |

> [!NOTE]
> Nilai `anonKey` sengaja bersifat *publishable* (dapat dilihat di browser klien). Kunci ini **BUKAN** kunci rahasia (*secret key*), melainkan pengidentifikasi aplikasi. Keamanan data pada Supabase dijamin oleh **Row Level Security (RLS)** pada level PostgreSQL, bukan dengan menyembunyikan anon key.

---

### 2.2 Konfigurasi Lingkungan Android (`android/app/build.gradle`)

| Parameter Build | Nilai Terpasang | Keterangan |
|---|:---:|---|
| `namespace` | `id.kelurahan.bener.ronda` | Penamaan namespace paket Kotlin |
| `applicationId` | `id.kelurahan.bener.ronda` | Identifier unik aplikasi di Android OS |
| `compileSdk` | `34` | Android 14 SDK |
| `minSdk` | `26` | Minimal Android 8.0 Oreo (memastikan dukungan penuh API Biometrik & Notifikasi) |
| `targetSdk` | `34` | Target SDK Android 14 |
| `versionCode` | `241` | Integer kode versi internal (Build 2.4.1) |
| `versionName` | `"2.4.1"` | String versi resmi aplikasi |
| `jvmTarget` | `'1.8'` | Target bytecode compiler Kotlin |

---

### 2.3 Konfigurasi Caching PWA (`sw.js`)

| Variabel Cache | Nilai Aktif | Tujuan |
|---|:---:|---|
| `CACHE_NAME` | `'ronda-rt01-v2.4.1'` | Pengidentifikasi versi cache Service Worker untuk memicu auto-purge cache usang saat rilis baru diterapkan. |
| `ASSETS_TO_CACHE` | `['./', './index.html', ...]`| Daftar aset statis yang wajib disimpan luring ke Cache Storage. |

---

### 2.4 Konfigurasi Server Lokal (`JALANKAN_APLIKASI.bat`)

| Parameter | Nilai Standar | Keterangan |
|---|:---:|---|
| `PORT` | `8088` | Port lokal Python HTTP Server untuk menghindari konflik dengan port web umum (80, 8080, 3000). |

---

## 3. Matriks Manajemen Rahasia (Secrets Management)

Untuk menjamin keamanan proyek saat dikembangkan lebih lanjut oleh Software Architect:

```text
+-----------------------------------+---------------------------------------------------------+
| Jenis Kredensial                  | Aturan Penyimpanan & Penanganan                         |
+-----------------------------------+---------------------------------------------------------+
| Supabase Anon Key                 | Boleh berada di dalam kode klien frontend (index.html). |
+-----------------------------------+---------------------------------------------------------+
| Supabase Service Role Key         | DILARANG KERAS berada di frontend/repositori Git.       |
| (Akses Bypass RLS Penuh)          | Hanya digunakan di lingkungan backend aman (serverless).|
+-----------------------------------+---------------------------------------------------------+
| Android Keystore (.jks)           | Tidak boleh dikomit ke Git. Disimpan di GitHub Secrets  |
| (Tanda Tangan Rilis APK)          | (misal: ANDROID_KEYSTORE_BASE64) untuk build rilis.     |
+-----------------------------------+---------------------------------------------------------+
| GITHUB_TOKEN                      | Dikelola secara otomatis oleh GitHub Actions Runner.     |
+-----------------------------------+---------------------------------------------------------+
```
