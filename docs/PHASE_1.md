# Phase 1 - Foundation

## Implementasi

- Autentikasi server melalui RPC Supabase `ronda_auth`; PIN bcrypt cost 12, token acak 256-bit, hash token di database, sesi 7 hari.
- Registrasi pending, verifikasi hanya pengurus, pemberian peran hanya Master Admin. Pilihan peran di login tidak lagi menjadi otorisasi.
- Lima kegagalan PIN mengunci percobaan 15 menit. Penggantian perangkat memerlukan PIN dan membatalkan semua sesi/perizinan biometrik perangkat lama.
- Master Admin awal dibuat oleh migration dengan nomor yang diminta. Akun lama diarsipkan tanpa menyalin PIN plaintext. Tidak ada akun lokal yang dipercaya.
- Android menggunakan Keystore AES-GCM untuk sesi dan kunci terikat BiometricPrompt CryptoObject untuk kredensial biometrik terpisah, berlaku 90 hari. Sidik jari tidak disimpan aplikasi.
- Logout membatalkan sesi server dan mempertahankan identitas akun terakhir. Foto disimpan di Supabase dan cache identitas diperbarui.
- Opening dihapus saat integrasi frontend. Safe area, formulir scroll dan pesan kesalahan ramah pengguna diterapkan.

## File

`app.js`, `app.css`, `app-config.js`, `index.html`, `android/app/src/main/java/id/kelurahan/bener/ronda/{SecureStore,AndroidBridge,MainActivity}.kt`, `supabase/migrations/202609170001_foundation.sql`.

## Arsitektur Dan Migrasi

Proyek semula tidak menggunakan Supabase Auth untuk login. Implementasi memakai sesi opaque milik aplikasi yang diverifikasi setiap RPC di PostgreSQL Supabase, bukan JWT Supabase Auth. Tabel berada di schema privat `ronda`, RLS aktif tanpa policy akses langsung; hanya dua RPC SECURITY DEFINER yang mengizinkan operasi tervalidasi. Publishable key tidak memberi akses tabel privat. Integrasi pihak lain yang memerlukan `auth.uid()` tidak menggunakan sesi ini.

Migration bersifat transaksional. Tabel lama dipertahankan; akses klien ke registrasi lama dicabut. Jangan menjalankan migration dua kali. Jalankan sesuai urutan timestamp setelah mengambil backup dan memeriksa schema live.

## Pengujian

Jalankan `pnpm install --frozen-lockfile`, `pnpm build`, `pnpm test`, `pnpm test:ui`. Jalankan aplikasi dengan `pnpm start` lalu buka `http://127.0.0.1:8088`.

Uji nomor tidak terdaftar, PIN salah, registrasi pending, verifikasi Master Admin, login warga, peran admin, pergantian perangkat, logout, pemulihan sesi dan Ganti Akun. Tes biometrik membutuhkan Android fisik dengan biometrik kuat terdaftar.

Bug awal yang ditutup: PIN sembarang diterima, peran dipilih klien, cek persetujuan menyetujui akun sendiri, pendaftaran sukses sebelum penyimpanan server, PIN plaintext tersimpan lokal, logout tidak mencabut sesi.

Status penerapan live, build, dan keterbatasan akhir dicatat di `FINAL_RELEASE.md`. Commit: `phase-1-foundation-core-system`.
