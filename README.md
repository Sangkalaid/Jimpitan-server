# Aplikasi Ronda & Jimpitan Warga RT 01 / RW 02
Kelurahan Bener

Aplikasi Web Progressive (PWA) untuk monitoring dan pencatatan kegiatan ronda malam, rekapitulasi dana jimpitan warga, jadwal regu ronda, dan pelaporan otomatis berbasis web & cloud.

## Fitur Utama
- **Monitoring Jimpitan**: Pencatatan status jimpitan per rumah (Pasang / Kosong).
- **Rekapitulasi Keuangan**: Perhitungan otomatis setoran harian, mingguan, dan bulanan.
- **Jadwal & Regu Ronda**: Informasi giliran jaga malam dan kontak darurat warga.
- **Sinkronisasi Cloud**: Terintegrasi dengan database Supabase secara realtime.
- **PWA (Progressive Web App)**: Dapat dipasang langsung di layar utama smartphone tanpa install APK manual.
- **Format Laporan WhatsApp**: Fitur generate pesan rekap untuk dibagikan langsung ke grup WhatsApp warga.

## Struktur File
- `index.html`: Aplikasi utama (Frontend UI & Logic).
- `sw.js`: Service Worker untuk caching dan mode offline PWA.
- `manifest.json`: Konfigurasi PWA untuk instalasi di Android / iOS.
- `buka_di_hp.html`: Halaman panduan akses cepat & QR Code untuk smartphone.
- `test_aplikasi_ronda.html`: Ruang pengujian unit & integrasi fitur.
- `android/`: Proyek wrapper WebView Android Studio.
