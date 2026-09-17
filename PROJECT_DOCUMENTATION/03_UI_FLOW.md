# 03. Alur Antarmuka Pengguna & Navigasi (UI Flow & Navigation)

Dokumen ini memetakan seluruh layar, transisi antarmuka, modal bottom-sheet, serta alur navigasi dari **Aplikasi Ronda & Jimpitan Warga RT 01 / RW 02 Kelurahan Bener**.

---

## 1. Peta Layar Utama (Primary Screens Map)

Aplikasi memiliki tiga layar utama (*screen viewports*) berbasis pertukaran DOM dinamis (`app-screen`), dilengkapi 11 komponen modal/bottom-sheet interaktif:

```text
                               +-----------------------------+
                               |     1. SCREEN OPENING       |
                               |    (Splash Screen 3.2s)     |
                               +--------------+--------------+
                                              |
                   +--------------------------+--------------------------+
                   | (Auto-transition 3.2s / Skip Button)                |
                   v                                                     v
       +-----------------------+                             +-----------------------+
       |   2. SCREEN LOGIN     |<----------------------------|    Testbed Switch     |
       |  (Warga vs Pengurus)  |                             | (test_aplikasi_ronda) |
       +-----------+-----------+                             +-----------------------+
                   |
     +-------------+-------------+
     |                           |
     v (Auth Valid: Warga)       v (Auth Valid: Pengurus RT)
+------------------------------------------------------------------------------------+
|                               3. SCREEN DASHBOARD                                  |
|                                                                                    |
|  [Header Profil] [Status Cloud Sync] [PWA Install] [Logout]                       |
|  [Tanggal & Jam Berjalan Shift Patroli]                                            |
|  [Kartu Metrik: Pasang (Hijau), Kosong (Merah), Lunas (Biru)]                      |
|  [Menu Cepat Berikon: Peta Rute, Data Regu, Rekap Kas, Pengajuan Izin/Verifikasi]  |
|  [Progress Card Patroli & Checklist Rumah Per Gang]                                |
|  [Tombol Aksi Utama: Catat Jimpitan (GPS), Kirim Laporan Patroli]                  |
|  [Bottom Navigation Bar: Beranda, Utilitas, Rekapitulasi, Profil]                  |
+------------------------------------------------------------------------------------+
```

---

## 2. Rincian Spesifikasi Setiap Layar

### 2.1 Layar 1: `screenOpening` (Splash Screen Beranimasi)
- **Tujuan**: Membangun identitas visual RT 01 Kelurahan Bener dan melakukan inisialisasi awal aset lokal.
- **Elemen Antarmuka**:
  - Efek visual animasi radar patroli malam (`pulseGlow`).
  - Efek partikel malam mengambang (`floatParticle`).
  - Bar progres inisialisasi otomatis (`role="progressbar"` berdurasi 2.8 detik).
  - Teks kilau dinamis (*text shimmer*) bertuliskan *"Ronda & Jimpitan Warga"*.
  - Tombol lewati cepat (*Skip Intro*) dengan touch target aman (≥ 44px).
- **Alur Transisi**:
  - Setelah timer 3.200 milidetik selesai (atau tombol "Lewati" diklik), fungsi `navigateToScreen('screenLogin')` dipanggil.

---

### 2.2 Layar 2: `screenLogin` (Autentikasi & Seleksi Peran)
- **Tujuan**: Membedakan hak akses dan antarmuka operasional antara Warga dan Pengurus RT.
- **Elemen Antarmuka**:
  - **Tab Switcher Peran**:
    - Tab `Warga`: Menampilkan form login nomor WhatsApp / ID Warga dengan label *"Masuk Akun Warga"*.
    - Tab `Pengurus RT`: Menampilkan form login Pengurus RT dengan label *"Akses Pengurus RT"*.
  - **Input WhatsApp / ID**: Kolom teks dengan filter regex angka (`inputmode="numeric"`).
  - **Input PIN 6 Digit**: Kolom sandi dengan tombol mata untuk intip/sembunyikan karakter (`togglePinVisibility()`).
  - **Tombol Masuk Aplikasi**: Memvalidasi kredensial pengguna.
  - **Tombol Biometrik Sidik Jari**: Memanggil sensor fingerprint native jika dijalankan di perangkat Android.
  - **Tautan "Daftar Akun Baru"**: Membuka modal pendaftaran warga (`openRegisterModal()`).
  - **Tautan "Lupa PIN?"**: Membuka modal pemulihan PIN warga (`openLupaPinModal()`).

---

### 2.3 Layar 3: `screenDashboard` (Pusat Kendali Operasional)
Antarmuka dashboard bersifat responsif dan beradaptasi secara otomatis (*role-based rendering*) berdasarkan profil `currentUser.role`:

#### A. Adaptasi Mode Pengurus RT (Ketua RT / Bendahara)
- **Badge Header**: Menampilkan nama pejabat (contoh: *"BAPAK BAMBANG - KETUA RT 01 • PENGURUS"*).
- **Menu Aksi Ke-4**: Berubah menjadi ikon tameng *"Verifikasi"* dengan lencana angka dinamis pemohon baru yang belum disetujui.
- **Kartu Utilitas**: Menampilkan daftar warga tertunda persetujuan dengan opsi instan "Setujui" atau "Tolak".

#### B. Adaptasi Mode Warga (Warga Lingkungan Bener)
- **Badge Header**: Menampilkan nama warga dan lokasi gang (contoh: *"BUDI SANTOSO - WARGA RT 01 • GANG MAWAR"*).
- **Menu Aksi Ke-4**: Menampilkan tombol *"Pengajuan"* untuk mengajukan pelunasan jimpitan atau izin ganti jadwal ronda.
- **Status Jimpitan Rumah Pribadi**: Memberikan ringkasan apakah kotak koin jimpitan di rumah pengguna malam ini sudah terpasang atau kosong.

---

## 3. Matriks Alur Modal & Bottom-Sheet

Aplikasi menyediakan 11 modal dengan interaksi transisi lembut (*smooth bottom-sheet transition*):

| ID Modal | Pemicu (*Trigger*) | Isi & Fungsionalitas | Aksi Lanjutan |
|---|---|---|---|
| `modalRegister` | Klik "Daftar Akun Baru" di Login | Formulir input: Nama Lengkap, Nomor WhatsApp, Status Hunian (Pribadi/Kontrak/Kos), Buat PIN 6 digit, dan Konfirmasi PIN. | Menyimpan data ke `pendingVerifList` dan insert ke tabel Supabase `residents`. Menampilkan status "Menunggu Verifikasi". |
| `modalLupaPin` | Klik "Lupa PIN?" di Login | Input nomor WhatsApp terdaftar. | Mencari nomor di daftar warga lokal, menampilkan PIN terdaftar dengan tombol "Gunakan PIN Ini". |
| `verifAkunModal` | Menu Cepat "Verifikasi" (RT) | Daftar pemohon akun baru lengkap dengan inisial avatar, nomor telepon, dan status hunian. | Tombol "Setujui" (otomatis mendaftarkan rumah warga ke `houses`) atau "Tolak". |
| `statDetailModal` | Klik Kartu Metrik (Pasang / Kosong / Lunas) | Daftar rincian rumah warga terfilter sesuai kategori metrik, dilengkapi fitur pencarian dinamis (*search box*). | Menampilkan jam setoran, nama kepala keluarga, dan nomor rumah. |
| `jimpitanModal` | Tombol "Catat Jimpitan (GPS)" | Dropdown pemilihan rumah warga, tombol status "Pasang (Rp 500)" atau "Kosong (Nihil)". | Merekam koordinat GPS gawai, mengupdate status di `houses`, mencatat riwayat transaksi ke `jimpitan_transactions`. |
| `shareReportModal` | Tombol "Kirim Laporan" | Tampilan pratinjau teks format pesan WhatsApp (rekapitulasi rumah pasang, rumah kosong, total kas, tanggal, dan nama petugas ronda). | Tombol "Salin Teks Laporan" (Clipboard) dan tombol "Bagikan ke WhatsApp" (Intent WhatsApp langsung). |
| `rekapModal` | Menu Cepat "Rekap Kas" / Tab Nav Bawah | Tab switcher periode kalkulasi: "Malam Ini (1 Hari)", "Minggu Ini (7 Hari)", dan "Bulan Ini (Penuh)". | Menampilkan akumulasi perkalian nominal koin Rp 500 terhadap jumlah rumah terpasang. |
| `routeMapModal` | Menu Cepat "Peta Rute" | Visualisasi topologi SVG interaktif 3 sektor patroli (Gang Mawar, Gang Dahlia, Gang Melati), jarak 1,25 km, estimasi waktu 38 menit, dan status checkpoint. | Tombol integrasi rute ke Google Maps eksternal. |
| `dataReguModal` | Menu Cepat "Data Regu" | Jadwal pembagian giliran ronda malam (Regu A sampai Regu G) dan nomor kontak darurat pos kamling. | Tombol hubungi petugas aktif. |
| `utilitasModal` | Tab Navigasi Bawah "Utilitas" | Menu manajerial RT: Tambah Data Warga Baru, Ekspor Rekap Bulanan, Verifikasi Pemohon Akun, dan Bersihkan Cache. | Membuka sub-modal verifikasi atau manajemen rumah. |
| `profileModal` | Ikon Avatar Pengguna di Header | Menampilkan profil pengguna aktif, tombol ganti foto profil avatar (memanggil file chooser/kamera ponsel), dan tombol Keluar Akun (*Logout*). | Menutup sesi pengguna dan kembali ke layar `screenLogin`. |

---

## 4. Alur Tombol Fisik Android (Back Button Intercept)

Pada aplikasi native Android, penekanan tombol fisik kembali (*hardware back button*) diatur dengan hierarki prioritas:
1. **Prioritas 1 (Modal Terbuka)**: Jika terdapat modal atau bottom-sheet yang sedang tampil di layar (`.fixed.inset-0.flex`), sistem akan menutup modal tersebut terlebih dahulu.
2. **Prioritas 2 (Di Halaman Dashboard)**: Jika pengguna berada di `screenDashboard`, penekanan tombol kembali akan mengarahkan pengguna kembali ke `screenLogin`.
3. **Prioritas 3 (Di Halaman Login/Opening)**: Jika tidak ada riwayat navigasi peramban WebView tersisa (`!webView.canGoBack()`), aplikasi memanggil `activity.finish()` untuk keluar dari aplikasi secara anggun.
