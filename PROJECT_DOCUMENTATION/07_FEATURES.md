# 07. Katalog Fitur Aplikasi (Application Features)

Dokumen ini merinci seluruh kapabilitas dan fitur fungsional dari **Aplikasi Ronda & Jimpitan Warga RT 01 / RW 02 Kelurahan Bener**.

---

## 1. Modul Inti Operasional Ronda & Jimpitan

### 1.1 Pencatatan Jimpitan Digital (Checklist Rumah)
- **Fungsi**: Petugas ronda malam dapat mencatat status koin jimpitan di kotak depan rumah warga.
- **Pilihan Status**:
  - `Pasang`: Koin jimpitan terpasang di kotak (otomatis menambah kas Rp 500).
  - `Kosong`: Kotak jimpitan kosong / nihil (Rp 0).
- **Audit Timestamp**: Setiap entri langsung mencatat waktu lokal (WIB) saat pemeriksaan berlangsung.
- **Umpan Balik Haptic**: Ponsel bergetar lembut 45ms setiap kali status berhasil disimpan.

### 1.2 Validasi Geotagging GPS Petugas
- **Fungsi**: Memastikan petugas ronda benar-benar berada di depan rumah warga saat mencatat jimpitan.
- **Mekanisme**: Memanfaatkan API Geolocation peramban dan Android Location Service (`ACCESS_FINE_LOCATION`). Koordinat lintang (*latitude*), bujur (*longitude*), dan tingkat akurasi meter disimpan ke dalam payload JSON data rumah.

### 1.3 Rekapitulasi Kas Cerdas Multi-Periode
- **Fungsi**: Perhitungan matematis otomatis tanpa perlu kalkulator manual.
- **Tiga Periode Rekapitulasi**:
  1. *Shift Malam Ini (Harian)*: Jumlah rumah pasang × Rp 500.
  2. *Minggu Ini (7 Hari)*: Akumulasi estimasi perputaran kas mingguan.
  3. *Bulan Ini (Penuh)*: Menghitung total hari dalam bulan berjalan secara otomatis (misal: 30 atau 31 hari) dan mengalikan dengan jumlah rumah terpasang.

### 1.4 Generator Laporan Resmi Format WhatsApp
- **Fungsi**: Mengonversi data rekapitulasi patroli dan kas ke dalam format pesan terstruktur siap kirim lengkap dengan emotikon dan penekanan teks bold WhatsApp.
- **Aksi Pendukung**:
  - *Salin Teks (Clipboard)*: Menyalin draf laporan ke clipboard ponsel.
  - *Kirim Langsung ke WhatsApp*: Membuka aplikasi WhatsApp via Android Intent atau URL Scheme `https://wa.me/` langsung ke grup warga RT 01.

---

## 2. Modul Manajerial Pengurus RT

### 2.1 Verifikasi Warga Baru Sekali Sentuh (*One-Tap Approval*)
- **Fungsi**: Ketua RT dapat meninjau pemohon yang mendaftar melalui aplikasi.
- **Aksi**:
  - *Setujui*: Secara instan membuat rekaman rumah baru pada tabel `houses`, menempatkannya pada gang terkait (Mawar, Dahlia, atau Melati), dan mengaktifkan akun warga.
  - *Tolak*: Menolak permohonan pendaftaran.

### 2.2 Dashboard Metrik Interaktif
- **Tiga Kartu Status Utama**:
  - `Terpasang (Hijau)`: Jumlah rumah yang telah menyetorkan koin malam ini.
  - `Kosong (Merah)`: Rumah yang terlewat atau tidak memasang koin.
  - `Lunas (Biru)`: Rumah yang telah melunasi iuran kas di muka.
- **Pencarian Dinamis**: Mengklik kartu metrik membuka daftar rumah terkait yang dapat disaring dengan kolom pencarian nama warga atau nomor rumah.

---

## 3. Modul Pemetaan & Keamanan Lingkungan

### 3.1 Peta Rute Patroli Interaktif (Vektor SVG)
- **Fungsi**: Menampilkan peta visual topologi pemukiman warga RT 01 tanpa memerlukan lisensi berbayar Google Maps API.
- **Detail Rute**:
  - Sektor 1: Gang Mawar (Rumah No. 01 - 16)
  - Sektor 2: Gang Dahlia (Rumah No. 17 - 32)
  - Sektor 3: Gang Melati (Rumah No. 33 - 48)
  - Parameter Metrik: Total jarak patroli 1,25 km dengan estimasi durasi keliling ~38 menit.
- **Integrasi Eksternal**: Tombol pintasan langsung membuka rute di aplikasi Google Maps asli.

### 3.2 Manajemen Jadwal Regu Ronda & Kontak Darurat
- **Fungsi**: Menampilkan pembagian 7 kelompok jadwal jaga (Regu A sampai Regu G) beserta daftar anggota ronda yang bertugas.
- **Kontak Darurat Terpadu**: Akses cepat tombol telepon ke Pos Kamling RT 01, Bhabinkamtibmas, Babinsa, dan Puskesmas.

---

## 4. Fitur Arsitektur & Perangkat Lunak Modern

### 4.1 Progressive Web App (PWA) & Dukungan Luring
- **Instalasi Mandiri**: Dapat dipasang langsung ke layar utama Android dan iOS tanpa melewati Google Play Store.
- **Service Worker (`sw.js`)**: Mem-cache seluruh shell antarmuka, stylesheet, font, dan ikon aplikasi sehingga aplikasi tetap terbuka meski koneksi internet padam total.
- **Manifest Standar W3C**: Berjalan dalam mode *fullscreen standalone* tanpa bilah navigasi peramban.

### 4.2 Jembatan Perangkat Keras Android (Native Bridge)
- **Sensor Biometrik**: Autentikasi sidik jari perangkat keras menggunakan BiometricPrompt API.
- **Haptic Feedback**: Getaran responsif pada interaksi tombol penting dan pencatatan checkpoint patroli.
- **Push Notification Native**: Pengiriman notifikasi lokal ke status bar ponsel saat ada warga baru disetujui atau shift ronda berakhir.
- **Pemilih Foto Avatar Native**: Akses langsung ke galeri foto Android untuk mengubah foto profil warga.

### 4.3 Sinkronisasi Awan Realtime Supabase
- **Realtime Listener**: Memanfaatkan teknologi WebSocket PostgreSQL Changefeed (`postgres_changes`). Setiap mutasi data di gawai salah satu pengurus otomatis ter-update di gawai pengurus dan warga lainnya dalam hitungan detik.
- **Indikator Koneksi**: Header aplikasi dilengkapi lampu status dinamis (Hijau = Cloud Terhubung, Kuning = Menyinkronkan, Abu-abu = Mode Lokal Luring).

### 4.4 Testbed Mandiri & Simulator Mobile (`test_aplikasi_ronda.html`)
- **Fungsi**: Lingkungan pengujian interaktif untuk mendemonstrasikan perilaku aplikasi pada viewport iPhone 390×844px.
- **Instrumen Pemantau**:
  - Tombol pintas perpindahan peran instan (Mode Ketua RT Bambang vs Mode Warga Budi Santoso).
  - Indikator pemantau getar motor haptic.
  - Monitor Biometrik, GPS posko, WhatsApp Intent, dan status koneksi database cloud.
  - Tombol reset data demo ke kondisi awal bersih (*clean empty state*).
