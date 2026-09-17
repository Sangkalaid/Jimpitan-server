# 12. Daftar Masalah yang Diketahui & Rencana Pengembangan (Known Bugs & TODO)

Dokumen ini menginventarisasi batasan teknis saat ini (*technical debt*), potensi kerentanan/masalah yang diketahui (*known issues*), serta peta jalan fitur (*feature backlog / TODO*) untuk dijadikan acuan bagi Software Architect dalam merancang arsitektur rilis masa depan.

---

## 1. Masalah yang Diketahui & Batasan Teknis (Known Issues & Technical Debt)

### 1.1 Autentikasi Klien & Penyimpanan PIN Polos (Plaintext PIN)
- **Kondisi Saat Ini**: Validasi PIN 6 digit pendaftaran warga saat ini dievaluasi di sisi klien peramban dan disimpan dalam kolom teks polos pada tabel `residents` serta `localStorage`.
- **Dampak Teknis**: Jika basis data diakses pihak yang tidak berwenang, kombinasi nomor telepon dan PIN warga dapat terlihat.
- **Rekomendasi Arsitek**: Migrasikan ke **Supabase Auth Resmi** menggunakan Phone OTP (One-Time Password) via WhatsApp, atau gunakan fungsi hash kriptografi (misal: `crypt()` / `pgcrypto` bcrypt) di tingkat database PostgreSQL.

### 1.2 Sinkronisasi Luring Dua Arah (Offline Mutation Queue)
- **Kondisi Saat Ini**: Aplikasi menerapkan penyimpanan luring melalui `localStorage`. Namun, jika petugas mencatat jimpitan di area tanpa sinyal seluler (*blank spot*), data tersimpan di gawai lokal tetapi mutasi ke Supabase Cloud dapat gagal tanpa antrean coba lagi (*retry queue*) otomatis.
- **Dampak Teknis**: Potensi selisih data sementara antara gawai petugas ronda dengan dashboard pengurus RT jika koneksi internet terputus di tengah jalan.
- **Rekomendasi Arsitek**: Terapkan pustaka antrean mutasi luring (seperti IndexedDB + Background Sync API atau arsitektur *Outbox Pattern*) yang otomatis menguras antrean (*flush queue*) saat event `window.addEventListener('online')` terpicu.

### 1.3 Peringatan Supabase Security Advisor (6 Warnings)
- **Kondisi Saat Ini**: Terdapat 6 warning terkontrol berbunyi: `Signed-In Users Can Execute SECURITY DEFINER Function`.
- **Mitigasi**: Warning ini dipertahankan karena fungsi transaksi memeriksa peran secara internal. Namun, disarankan menambahkan validasi eksplisit `auth.uid() IS NOT NULL` dan `pg_temp` security barrier pada skrip migrasi selanjutnya.

### 1.4 Konfigurasi Penandatanganan APK Rilis (Release Signing Keystore)
- **Kondisi Saat Ini**: Alur build saat ini menghasilkan `app-debug.apk` dengan keystore debug bawaan Android SDK.
- **Tindakan Lanjutan**: Untuk distribusi resmi di Google Play Store atau instalasi rilis enterprise, perlu dibuat file Keystore rilis (`ronda-release.jks`) dan didaftarkan pada blok `signingConfigs` di file `android/app/build.gradle`.

---

## 2. Rencana Pengembangan Mendatang (Roadmap & TODO Backlog)

Berdasarkan Product Requirement Document (PRD) dan kebutuhan warga RT 01 Kelurahan Bener:

### 2.1 Fase 2: Integrasi WhatsApp Gateway Webhook
- [ ] **Otomatisasi Konfirmasi Warga Baru**: Mengirim pesan notifikasi WhatsApp otomatis ke nomor pemohon saat statusnya disetujui oleh Ketua RT (*"Selamat! Akun Ronda Anda telah disetujui"*).
- [ ] **Laporan Otomatis Posko**: Penjadwalan Cloud Cron (*Supabase pg_cron / Edge Functions*) untuk mengirim rekapitulasi penutupan shift patroli ke grup WhatsApp RT 01 setiap pukul 04:00 WIB.

### 2.2 Fase 3: Fitur Panic Button / Kentongan Virtual (SOS Darurat)
- [ ] **Tombol Darurat Layar Penuh**: Tombol merah darurat dengan proteksi geser (*slide-to-activate*) untuk mencegah salah tekan.
- [ ] **Pemicu Audio Sirine Kentongan**: Memutar rekaman audio nada kentongan ronda nada titir (tanda bahaya) melalui Web Audio API dan speaker ponsel Android.
- [ ] **Broadcast Realtime Antar-Warga**: Memicu event darurat via Supabase Realtime ke seluruh gawai warga yang sedang terhubung, menampilkan banner lokasi kejadian secara instan.

### 2.3 Peningkatan Ekspor Laporan
- [ ] **Ekspor PDF & Excel Resmi**: Menghasilkan file rekapitulasi kas bulanan dalam format spreadsheet `.xlsx` atau dokumen PDF bertanda tangan digital pengurus RT 01 untuk keperluan pelaporan di musyawarah warga triwulanan.
- [ ] **Grafik Tren Setoran**: Menampilkan visualisasi grafik baris (*line chart*) persentase keaktifan jimpitan warga antar-minggu menggunakan pustaka visualisasi ringan.

### 2.4 Peningkatan Integrasi Perangkat Keras Android
- [ ] **Background Geofencing**: Memicu notifikasi otomatis *"Anda memasuki Gang Melati, silakan periksa kotak No. 33"* saat ponsel petugas mendekati batas wilayah koordinat pos kamling.
