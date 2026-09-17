# 09. Panduan Menjalankan, Kompilasi & Deployment (Build & Deployment)

Dokumen ini menyediakan instruksi langkah demi langkah (*step-by-step procedures*) untuk menjalankan aplikasi di lingkungan lokal, mengompilasi biner APK Android, dan menyebarkan skema database ke Supabase Cloud.

---

## 1. Cara Menjalankan Aplikasi

Aplikasi web dapat dijalankan melalui beberapa alternatif sesuai kebutuhan pengujian:

### 1.1 Menjalankan di Lingkungan Lokal (Pengembangan)
1. Buka folder root proyek di Windows.
2. Klik ganda file **`JALANKAN_APLIKASI.bat`**.
3. Skrip akan memeriksa ketersediaan port 8088 dan menjalankan web server lokal ringan:
   ```cmd
   python -m http.server 8088
   ```
4. Peramban web otomatis terbuka di alamat:
   - **Aplikasi Utama**: `http://localhost:8088/index.html`
   - **Workbench Pengujian**: `http://localhost:8088/test_aplikasi_ronda.html`
   - **Panduan QR Ponsel**: `http://localhost:8088/buka_di_hp.html`

### 1.2 Mengakses Versi Online Produksi (GitHub Pages)
Aplikasi telah dipublikasikan secara daring dan aktif 24 jam di GitHub Pages:
- **URL Akses**: `https://sangkalaid.github.io/Jimpitan-server/`
- Warga dan pengurus dapat langsung mengakses URL ini dari browser Chrome di ponsel Android atau Safari di iOS.

### 1.3 Memasang Sebagai Aplikasi di Ponsel (Instalasi PWA Cepat)
1. Buka `https://sangkalaid.github.io/Jimpitan-server/` di browser Chrome ponsel.
2. Ketuk ikon menu titik tiga (⋮) di pojok kanan atas.
3. Pilih menu **"Tambahkan ke Layar Utama"** atau **"Install Aplikasi"**.
4. Ketuk **Install**. Ikon resmi *"Ronda RT 01"* akan muncul di laci aplikasi ponsel dan berjalan secara *fullscreen* tanpa bilah URL peramban.

---

## 2. Cara Mengompilasi File APK Android

Terdapat tiga metode untuk menghasilkan biner `app-debug.apk`:

### 2.1 Opsi 1: Kompilasi Otomatis di Cloud (GitHub Actions) — Paling Disarankan
Metode ini tidak memerlukan instalasi Android Studio, Android SDK, maupun Java JDK di komputer lokal:
1. Buka halaman repositori GitHub di peramban:
   `https://github.com/Sangkalaid/Jimpitan-server/actions`
2. Pada panel kiri, pilih workflow **"Build Android APK"**.
3. Klik tombol **"Run workflow"** di sisi kanan, pilih branch `main`, lalu klik tombol hijau **"Run workflow"**.
4. Tunggu ~2 menit hingga proses bertanda centang hijau.
5. Klik judul alur kerja yang selesai, gulir ke bagian **Artifacts**, lalu unduh file zip **`Ronda-RT01-app-debug`**.
6. Ekstrak zip untuk mendapatkan file `app-debug.apk` yang siap dipasang di ponsel warga.

---

### 2.2 Opsi 2: Kompilasi Lokal Menggunakan Skrip Windows (`COMPILE_APK.bat`)
Jika komputer Anda telah terpasang Java JDK 17:
1. Klik ganda file **`COMPILE_APK.bat`**.
2. Skrip akan secara otomatis:
   - Menyinkronkan aset web terbaru (`index.html`, `manifest.json`, `sw.js`, `icons/`) ke folder `android/app/src/main/assets/www/`.
   - Menjalankan Gradle Wrapper:
     ```cmd
     cd android
     call gradlew.bat assembleDebug
     ```
3. File APK hasil kompilasi akan berada di:
   `android/app/build/outputs/apk/debug/app-debug.apk`
4. Windows Explorer otomatis terbuka menyorot file APK tersebut.

---

### 2.3 Opsi 3: Kompilasi Melalui Android Studio
1. Buka program **Android Studio**.
2. Pilih menu **File > Open**, lalu arahkan ke subfolder **`android/`** (`f:\ronda 2\android`).
3. Tunggu proses sinkronisasi Gradle (*Gradle Sync*) selesai mengunduh dependensi.
4. Klik menu atas: **Build > Build Bundle(s) / APK(s) > Build APK(s)**.
5. Setelah selesai, klik teks *"locate"* pada notifikasi pop-up di pojok kanan bawah untuk mengambil file `app-debug.apk`.

---

## 3. Cara Menerapkan Skema Database di Supabase Cloud

Jika Anda ingin mereplikasi backend ke proyek Supabase baru:

### 3.1 Langkah 1: Persiapan Proyek Supabase
1. Masuk ke dashboard [Supabase Console](https://supabase.com/dashboard).
2. Buat proyek baru (*New Project*), tentukan nama proyek (misal: `Jimpitan-RT01`) dan password database.
3. Catat **Project URL** (misal: `https://xxxx.supabase.co`) dan **anon public API key**.

### 3.2 Langkah 2: Menjalankan Skrip Migrasi SQL
1. Masuk ke menu **SQL Editor** pada dashboard proyek Supabase Anda.
2. Jalankan skrip dasar pembuatan tabel `houses`, `residents`, `jimpitan_transactions`, view, dan RPC dari skema inti.
3. Buka file `supabase/migrations/202609160001_fix_security_invoker_views.sql`, salin seluruh kodenya, tempel ke SQL Editor Supabase, lalu klik **Run**.
4. Buka file `supabase/migrations/202609160002_harden_rpc_permissions.sql`, salin seluruh kodenya, tempel ke SQL Editor Supabase, lalu klik **Run**.
5. Untuk memverifikasi keamanan hak akses, buka dan jalankan script `supabase/verify_rpc_security.sql`. Pastikan nilai `anonymous_blocked = true` dan `authenticated_allowed = true`.

### 3.3 Langkah 3: Mengaktifkan Realtime Replication
1. Buka menu **Database > Replication** di dashboard Supabase.
2. Cari tabel **`houses`** dan **`residents`**.
3. Pastikan tombol toggle **Replication (Realtime)** pada kedua tabel tersebut dalam posisi **Enabled (Aktif)**.

### 3.4 Langkah 4: Menghubungkan Frontend ke Proyek Baru
Jika menggunakan instance Supabase berbeda, buka file `index.html` dan perbarui konstanta `SUPABASE_CONFIG` pada baris 1524:
```javascript
const SUPABASE_CONFIG = {
  url: "https://<PROJECT_REF_ANDA>.supabase.co",
  anonKey: "<ANON_PUBLIC_KEY_ANDA>"
};
```
Simpan file dan sinkronkan kembali ke folder `android/app/src/main/assets/www/` sebelum melakukan kompilasi ulang APK.
