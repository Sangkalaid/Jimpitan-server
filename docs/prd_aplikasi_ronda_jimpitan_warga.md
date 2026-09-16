# Product Requirement Document (PRD) & Project Brief
## Aplikasi Ronda & Jimpitan Warga (RT 01 / RW 02 Kelurahan Bener)

**Versi Dokumen:** 1.0.0  
**Tanggal:** September 2024  
**Status:** Disetujui / Baseline Perancangan UI/UX  
**Target Platform:** Mobile App (Android / Responsive Web 390px) & Web Pengurus RT  

---

## 1. Ringkasan Eksekutif & Latar Belakang (Executive Summary)

Aplikasi **Ronda & Jimpitan Warga** dirancang untuk mendigitalkan dan menertibkan tata kelola keamanan lingkungan malam (ronda/siskamling) serta tradisi pengumpulan kas mikro harian/mingguan (**jimpitan**) di tingkat rukun tetangga, khususnya **RT 01 / RW 02 Kelurahan Bener**.

Selama ini, proses pencatatan kehadiran petugas ronda malam, verifikasi iuran jimpitan koin per rumah, dan pengawasan rute patroli masih mengandalkan buku catatan fisik manual yang rentan hilang, rusak, atau kurang transparan. Aplikasi ini hadir sebagai solusi terpadu mobile-first yang mudah digunakan oleh seluruh lapisan warga, mulai dari pemuda hingga warga lansia, serta pengurus RT.

---

## 2. Tujuan Proyek & Indikator Kunci (Goals & Success Metrics)

### 2.1 Tujuan Utama (Objectives)
1. **Transparansi Kas Jimpitan:** Memastikan setiap koin jimpitan (nominal standar Rp 500/hari atau variatif) tercatat *real-time* dan transparan hingga 100% verifikasi per rumah warga (48 rumah target).
2. **Disiplin Patroli Ronda:** Menyediakan pemantauan rute patroli per sektor (Gang Mawar, Gang Dahlia, Gang Melati) dengan visualisasi titik pos kamling dan checkpoint status.
3. **Aksesibilitas & Inklusivitas:** Antarmuka ramah pengguna lokal dan lansia, memenuhi kualifikasi standar **WCAG 2.1 Level AA** (kontras jelas, touch target minimal 44×44px, dukungan screen reader/ARIA).
4. **Kecepatan Administrasi Pengurus RT:** Alur persetujuan pendaftaran warga baru dan rekapitulasi laporan kas selesai dalam 1 sentuhan (*one-tap approval*).

### 2.2 Key Performance Indicators (KPIs)
- **Tingkat Kepatuhan Jimpitan:** Target 95–100% rumah terpantau status pasang/kosong/lunas setiap putaran ronda malam.
- **Waktu Verifikasi Warga Baru:** Kurang dari 24 jam sejak pengajuan akun warga via aplikasi.
- **Tingkat Adopsi Warga:** > 85% kepala keluarga di RT 01 terdaftar dan memantau transparansi kas berkala.
- **Akurasi Patroli:** 3 rute gang patroli malam selesai dalam estimasi ~38 menit patroli terkontrol.

---

## 3. Persona Pengguna & Alur Peran (User Personas)

| Profil Persona | Tanggung Jawab & Kebutuhan Utama | Fitur Kunci |
|---|---|---|
| **Warga Biasa** | Memantau kas jimpitan rumah tangga, melihat jadwal ronda giliran diri/keluarga, mengajukan izin berhalangan ronda, melihat transparansi kas RT. | - Dashboard saldo jimpitan rumah<br>- Riwayat pembayaran & status pasang koin<br>- Formulir pengajuan izin/tukar jadwal ronda<br>- Info kontak posko & darurat |
| **Petugas Ronda (Piket Malam)** | Bertugas patroli malam, mengambil jimpitan koin di kotak depan rumah warga, mencentang checkpoint gang, melapor kendala. | - Checklist jimpitan per gang (Gang Mawar, Dahlia, Melati)<br>- Peta rute patroli interaktif dengan penanda titik<br>- Tombol kirim laporan patroli & rekap kas malam |
| **Pengurus RT (Ketua & Bendahara)** | Memverifikasi pendaftaran warga baru, mengelola pembagian regu ronda (Regu A-G), audit kas bulanan, broadcast pengumuman. | - Bottom sheet verifikasi warga baru (*Setujui/Tolak*)<br>- Dashboard ringkasan status harian (Pasang, Kosong, Lunas)<br>- Manajemen rute & jadwal pos kamling<br>- Rekapitulasi kas dan ekspor laporan |

---

## 4. Arsitektur Informasi & Spesifikasi Layar (Screen Specifications)

### 4.1 Layar 1: Opening / Splash Screen Beranimasi
- **Fungsi:** Pembuka aplikasi dengan identitas visual khas Kelurahan Bener RT 01.
- **Elemen:**
  - Animasi senter visual & radar patroli malam.
  - Progres inisialisasi sistem (`role="progressbar"` dan dukungan `prefers-reduced-motion`).
  - Tombol lewati cepat (*Skip Intro*) dengan touch target aman (≥ 44px).
  - Skema warna: *Royal Blue* (#1B7BC9 - #0F172A) & aksen hijau emerald.

### 4.2 Layar 2: Autentikasi (Layar Login & Registrasi Akun)
- **Fungsi:** Pintu gerbang otentikasi peran ganda (Warga vs Pengurus RT).
- **Elemen UI:**
  - Tab switcher peran: **Warga** vs **Pengurus RT** (semantik `role="tablist"` & `role="tab"`).
  - Form field WhatsApp / ID Anggota (dukungan `autocomplete="tel"`, `inputmode="numeric"`).
  - Form field PIN 6-digit dengan ikon toggle intip/sembunyikan sandi.
  - Checkbox "Ingat Saya" & opsi "Lupa PIN?".
  - Tombol aksi utama "Masuk Aplikasi" & Opsi Biometrik (Sidik Jari).
  - Tautan "Daftar Akun Baru" yang memicu modal registrasi formulir warga.

### 4.3 Layar 3: Dashboard Ronda - Tampilan Petugas Ronda & Warga
- **Fungsi:** Ringkasan giliran ronda, status kotak jimpitan malam ini, serta pelaporan patroli.
- **Elemen UI:**
  - Status bar tanggal & kartu ringkasan koin (Pasang: 48, Kosong: 0, Lunas: 48 / Rp 24.000).
  - Tombol menu cepat berikon: **Peta Rute**, **Data Regu**, **Rekap**, **Pengajuan Izin**.
  - Kartu progres aktivitas ronda harian (*Semua Jimpitan Sudah Diambil - 48/48 Rumah*).
  - Tombol aksi utama "Kirim Laporan" patroli.
  - Navigasi bawah (Bottom Navigation): *Beranda, Utilitas/Peta, Rekap, Profil*.

### 4.4 Layar 4: Dashboard Pengurus RT & Verifikasi Warga Baru
- **Fungsi:** Kendali penuh pengurus untuk memvalidasi pemohon warga dan memantau keteraturan lingkungan.
- **Elemen UI:**
  - Profil Ketua RT aktif (Bpk. Bambang) & periode jabatan.
  - Kartu metrik interaktif: **Pasang (48 Terpasang)**, **Kosong (0 Kosong / Nihil)**, **Lunas (Rp 24.000 Terkumpul)**.
  - Bottom-sheet dialog: **Verifikasi Pendaftaran Warga Baru** dengan daftar pemohon (Budi Santoso, Siti Rahayu, Hendro Utomo) dilengkapi tombol "Setujui" & "Tolak" instan.
  - Pemantau jadwal ronda malam regu piket aktif.

### 4.5 Layar 5: Modal Peta Rute Patroli & Checkpoint Lingkungan
- **Fungsi:** Tinjauan spasial rute pos kamling dan sebaran rumah per gang.
- **Elemen UI:**
  - Indikator total jarak (1.25 km), status rute (100% Selesai), dan waktu patroli (~38 Menit).
  - Visual peta topologi gang pemukiman dengan pin marker lokasi petugas aktif & rumah warga.
  - Legenda titik status non-ketergantungan warna (ikon centang, silang, dan dot penanda).
  - Checkpoint rute: *Sektor 1: Gang Mawar (16 Rumah)*, *Sektor 2: Gang Dahlia (16 Rumah)*, *Sektor 3: Gang Melati (16 Rumah)*.
  - Tombol integrasi "Google Maps" & "Tutup Peta".

---

## 5. Pedoman Desain & Identitas Visual (Design System)

- **Nama Desain:** *Ronda & Jimpitan Warga*
- **Palet Warna Utama:**
  - `Primary (Royal Blue)`: `#1B7BC9` / `#1565A0` (Wibawa, ketertiban, keamanan)
  - `Background & Surface`: `#F8F9FF` & `#FFFFFF` (Kebersihan kontras)
  - `Success / Pasang`: `#10B981` / Emerald (Kotak terisi koin, verifikasi lunas)
  - `Warning / Belum Selesai`: `#F59E0B` / Amber (Menunggu konfirmasi)
  - `Destructive / Kosong`: `#EF4444` / Rose (Kotak jimpitan kosong / tolak)
  - `Text Hierarchy`: `#0F172A` (Heading 1/2), `#334155` (Body), `#475569` (Subjudul WCAG compliant)
- **Tipografi:** Plus Jakarta Sans (Modern, tegas, dan mudah dibaca pada layar kecil).
- **Prinsip Tombol & Sudut:** Rounded-2xl (16px) untuk card container, Rounded-xl (12px) untuk button & input form. Target sentuh minimal: 44×44px.

---

## 6. Persyaratan Non-Fungsional (Non-Functional Requirements)

1. **Aksesibilitas (Accessibility / WCAG 2.1 AA):**
   - Wajib melampirkan keterkaitan `<label for="...">` dan input `<input id="...">`.
   - Seluruh tombol kontrol dan ikon navigasi memiliki `aria-label` deskriptif.
   - Rasio kontras teks reguler terhadap latar belakang minimal 4.5:1.
2. **Kinerja & Responsivitas:**
   - Ukuran layar dioptimalkan secara presisi untuk resolusi mobile portrait standar (390px × 844px).
   - Animasi interaktif transisi modal dan toast di bawah 300ms dengan akselerasi hardware CSS GPU.
3. **Keandalan Offline-First (Future Scope):**
   - Pencatatan checklist jimpitan dapat disimpan lokal (*local storage / PWA cache*) saat petugas ronda berada di sudut gang dengan sinyal seluler lemah.

---

## 7. Roadmap Implementasi & Tahapan Pengembangan

- **Fase 1 (Selesai):** Pembuatan Design System, High-Fidelity UI Screens (Opening, Login, Dashboard Warga, Dashboard Pengurus, Verifikasi Pendaftaran, Peta Rute Patroli), serta Audit Aksesibilitas WCAG.
- **Fase 2 (Berikutnya):** Integrasi backend API notifikasi WhatsApp gateway (konfirmasi otomatis warga baru dan rekap laporan posko).
- **Fase 3:** Fitur Panic Button / Kentongan Darurat (SOS) dengan peringatan suara pos kamling dan live broadcast ke seluruh perangkat warga RT 01.
