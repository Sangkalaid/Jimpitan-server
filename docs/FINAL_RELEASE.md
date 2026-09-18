# Final Release Report

Tanggal: 2026-09-18

## Ringkasan

Rilis ini mengubah aplikasi Ronda & Jimpitan menjadi aplikasi berbasis sesi server Supabase dengan modul operasional RT01, peta gratis berbasis Leaflet/OpenStreetMap, biometrik native Android, dan pipeline APK release bertanda tangan melalui GitHub Actions.

## Akses Produksi

- Supabase project: `riehidioeftegpkndxok`
- Akun master awal: WhatsApp `085877672699`, PIN awal `123456`
- Signing APK: GitHub Actions secrets `ANDROID_KEYSTORE_BASE64`, `ANDROID_STORE_PASSWORD`, `ANDROID_KEY_PASSWORD`, `ANDROID_KEY_ALIAS`
- Backup keystore lokal: `C:\Users\rohar\.ronda-signing`

Nilai rahasia tidak ditulis ke repositori.

## Verifikasi Lokal

- `pnpm build`: lulus
- `pnpm check`: lulus
- `pnpm test`: 9 tes server lulus
- `pnpm test:ui`: lulus, menghasilkan screenshot di `test-results/`

Build Android release lokal belum dapat dijalankan karena komputer ini belum memiliki Java/JDK dan Android SDK di PATH. Workflow GitHub memasang JDK 17 dan Android SDK otomatis, lalu menjalankan lint, build release, verifikasi tanda tangan APK, dan upload artifact.

## Catatan Data Lama

Migrasi operasional hanya mengimpor titik rumah RT01 dari tabel `public.houses` dengan pola `HSE-RT01-%`. Data RT lain tidak dimigrasikan ke modul baru. Laporan membaca ledger lama yang sudah `FINALIZED` melalui tabel transaksi lama dan menjumlahkannya bersama catatan baru, sehingga histori kas tetap terlihat tanpa membuat transaksi palsu.

## Peta

Google Maps diganti dengan Leaflet dan tile OpenStreetMap agar tidak membutuhkan billing, kartu, atau API key. Service worker tidak meng-cache tile eksternal sehingga tetap menghormati kebijakan tile OpenStreetMap.

## Cara Mengambil APK

Setelah commit `phase-3-final-production-release` didorong ke `main`, buka workflow GitHub Actions `Build Android APK`, lalu unduh artifact `Ronda-RT01-release`.
