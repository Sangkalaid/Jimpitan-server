# Phase 2 - Dashboard & Operational Modules

## Implementasi

1. **Penyederhanaan Profil (Change Log 06)**:
   - Halaman Profil difokuskan hanya pada: Foto Profil, Nama Pengguna, dan Format Wilayah: `RT 01 / RW 02`.
   - Menghilangkan tombol pemasangan aplikasi di layar utama HP dan menu redundan.
   - Menyediakan tombol "Tutup" dan "Keluar dari Akun" (Logout aman, menghapus sesi server, menjaga riwayat akun terakhir).

2. **Pembersihan Header Dashboard (Change Log 07 & 08.1)**:
   - Menghapus ikon pintasan verifikasi akun dari header di sebelah nama/foto.
   - Menghapus teks "Shift Aktif"; header hanya menampilkan tanggal aktif (contoh: 17 September 2026).

3. **Logika & Label Statistik Dashboard (Change Log 08.2 & 08.3)**:
   - Kartu statistik berlabel jelas: **Rumah Terpasang**, **Rumah Kosong**, **Rumah Lunas**.
   - Supabase sebagai single source of truth via snapshot RPC `ronda_data('dashboard')`.
   - Hierarki integritas:
     - Rumah Kosong terpisah dari Rumah Terpasang.
     - Rumah Lunas selalu merupakan bagian dari Rumah Terpasang (`lunas ⊆ pasang`).
     - Saat daftar Terpasang dibuka, rumah lunas tetap tampil dengan status "Lunas", sedangkan belum lunas berstatus "Belum Lunas".
     - Deduplikasi unik berdasarkan ID permanen rumah/titik.

4. **Peta, OpenStreetMap/Leaflet & GPS Check-in (Change Log 09)**:
   - Peta responsif dan memenuhi kontainer layar tanpa terpotong header/bottom bar.
   - Menggunakan pustaka Leaflet dengan tile OpenStreetMap (bebas biaya, tanpa ketergantungan Google Cloud Billing).
   - GPS real-time diambil dari perangkat native (`navigator.geolocation` / Android Location Services) dengan validasi akurasi (`max_accuracy_m`).
   - Mode edit peta terbatas hanya untuk role Master Admin dan Pengurus RT.
   - Tambah titik marking dilakukan dengan mendatangi lokasi fisik, mencatat koordinat perangkat, mengisi nama titik dan deskripsi manual, tersimpan dengan UUID permanen di `ronda.points`.
   - GPS Check-in Jimpitan memvalidasi radius jarak (formula Haversine) dan mencegah check-in ganda di hari yang sama.
   - Perekaman rute patroli (`ronda.routes`) untuk pengurus dengan histori jalur dan timestamp.

5. **Data Regu, Rekap, Pengajuan, Komplain & Hapus Chat (Change Log 10)**:
   - Data Regu Ronda: Pengurus RT dapat mengatur anggota regu per hari (Senin–Minggu); warga hanya melihat jadwal dan anggota regunya sendiri.
   - Rekap Jimpitan: Rekap Harian, Mingguan (Senin–Minggu dengan handling first-time mid-week), dan Bulanan (1–akhir bulan dengan handling first-time mid-month).
   - Pengajuan Pelunasan Jimpitan: Warga dapat mengajukan setor kas di muka, pengurus dapat meninjau (Setujui/Tolak).
   - Komplain Warga: Menggantikan fitur chat. Warga menulis dan mengirim komplain; pengurus dapat membalas dan memperbarui status (*Menunggu*, *Diproses*, *Selesai*).
   - Fitur chat bebas dihapus sepenuhnya dari aplikasi.

## File Terkait

- `operations.js`: Logika operasional dashboard, leaflet map, check-in GPS, regu, rekap, pengajuan, komplain.
- `app-config.js`: Konfigurasi `tileUrl` OpenStreetMap.
- `index.html`: Penyesuaian modal, header, kartu statistik, dan integrasi UI Leaflet.
- `supabase/migrations/202609170002_operations.sql`: Tabel `points`, `checkins`, `teams`, `requests`, `complaints`, `replies`, `routes`, `settings` beserta fungsi RPC aman.
