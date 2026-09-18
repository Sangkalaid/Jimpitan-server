# Aplikasi Ronda & Jimpitan Warga RT 01 / RW 02
Dukuh Bener

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
- `docs/`: Dokumen spesifikasi dan kebutuhan produk (PRD).
- `supabase/`: Konfigurasi migrasi database dan verifikasi keamanan RPC.
- `android/`: Proyek wrapper WebView Android Studio lengkap dengan Gradle Wrapper.
- `JALANKAN_APLIKASI.bat`: Skrip peluncur server lokal dan browser (Port 8088).
- `COMPILE_APK.bat`: Skrip otomatisasi sinkronisasi aset dan kompilasi APK Android.

## Cara Menggunakan & Menjalankan

1. **Aplikasi Lokal / Web:**
   Jalankan `JALANKAN_APLIKASI.bat`, lalu buka alamat lokal yang ditampilkan.
2. **Aplikasi Online (Langsung Pasang di HP tanpa Compile):**
   Buka `https://sangkalaid.github.io/Jimpitan-server/` di Chrome HP, ketuk menu titik tiga (⋮) lalu pilih **"Tambahkan ke Layar Utama" / "Install Aplikasi"**.
3. **Kompilasi File APK Android:**
   - **Opsi 1 (Cloud GitHub Actions - Paling Praktis & Bebas Install Apapun):**
     Cukup push perubahan ke GitHub atau buka tab **Actions** di repositori GitHub, pilih **Build Android APK**, lalu klik **Run workflow**. File APK siap pakai (`app-debug.apk`) akan langsung otomatis tersedia untuk diunduh di bagian **Artifacts**.
   - **Opsi 2 (Skrip Otomatis Komputer):** Klik ganda `COMPILE_APK.bat`. Jika Java JDK terpasang, APK debug langsung dihasilkan di `android/app/build/outputs/apk/debug/app-debug.apk`.
   - **Opsi 3 (Android Studio):** Buka folder `android/` di Android Studio, tunggu sync selesai, lalu klik menu **Build > Build Bundle(s) / APK(s) > Build APK(s)**.

## Catatan Produksi

- Versi saat ini: **2.4.1**.
- Izin lokasi baru diminta saat pencatatan GPS digunakan; izin notifikasi saat notifikasi pertama dikirim.
- Wrapper Android hanya memberi bridge native kepada halaman aplikasi lokal dan membuka tautan luar di aplikasi browser terkait.
- Autentikasi pengurus dan kebijakan Row Level Security Supabase tetap harus dikonfigurasi di backend sebelum dipakai dengan data warga sungguhan. Jangan gunakan PIN contoh atau kebijakan tabel publik untuk produksi.

