# 06. Arsitektur Autentikasi & Otorisasi (Authentication & Authorization)

Dokumen ini menjelaskan mekanisme otentikasi pengguna, manajemen sesi (*session management*), validasi kredensial, integrasi biometrik, serta matriks perizinan (*permission matrix*) pada **Aplikasi Ronda & Jimpitan Warga RT 01 / RW 02 Kelurahan Bener**.

---

## 1. Model Autentikasi Saat Ini (Current Hybrid Model)

Aplikasi saat ini menerapkan model **Client-Assisted Role-Based Authentication** yang dirancang khusus untuk kenyamanan warga di lingkungan rukun tetangga, menghindari hambatan lupa kata sandi yang rumit pada kelompok warga lansia:

```text
[ Pengguna Membuka Aplikasi ]
              |
              v
[ Tab Seleksi Peran di Layar Login ]
  ├── Mode Pengurus RT -> (Input No. HP/ID & PIN 6 Digit)
  └── Mode Warga Biasa  -> (Input No. HP & PIN 6 Digit)
              |
              +---> [ Opsi Tambahan: Tombol Biometrik Sidik Jari ]
              |
              v
[ Evaluasi Kredensial di Client & Memori Lokal ]
  ├── Apakah terdaftar di pendingVerifList?
  │     ├── Status 'pending'  -> Ditolak: Menunggu Verifikasi Ketua RT
  │     ├── Status 'rejected' -> Ditolak: Pendaftaran Ditolak
  │     └── Status 'approved' -> Diizinkan: Sesi Warga Aktif
  └── Mode Pengurus -> Diizinkan: Sesi Pengurus RT Aktif
              |
              v
[ Inisialisasi Objek Sesi currentUser & Persistensi ke LocalStorage ]
              |
              v
[ Navigasi ke screenDashboard dengan Tampilan Berbasis Peran ]
```

---

## 2. Alur Proses Login (Login Flow)

### 2.1 Login Mode Warga
1. Warga memasukkan nomor WhatsApp dan 6 digit PIN.
2. Fungsi `handleLoginSubmit(e)` memeriksa apakah format PIN terdiri dari 6 angka numerik murni (`/^\d{6}$/`).
3. Sistem memeriksa apakah nomor WhatsApp tersebut ada di dalam daftar warga terdaftar (`pendingVerifList`):
   - Jika statusnya `pending`, aplikasi menampilkan toast peringatan: *"Akun Anda masih menunggu verifikasi Ketua RT!"* dan membatalkan login.
   - Jika statusnya disetujui (`approved`) atau akun demo, sesi dibuat dengan peran `warga`.
4. Objek `currentUser` disimpan dengan nama warga terkait dan avatar default.

### 2.2 Login Mode Pengurus RT
1. Pengurus memilih tab *"Pengurus RT"*, memasukkan nomor ID/WhatsApp dan PIN 6 digit pengurus.
2. Sistem menetapkan peran `currentUser.role = 'pengurus'`.
3. Sesi aktif mendapatkan wewenang manajerial penuh (membuka verifikasi warga baru, mengelola pembagian regu, dan audit kas).

### 2.3 Login Menggunakan Sensor Biometrik (Sidik Jari)
Khusus pada ponsel Android yang mendukung sensor fingerprint:
1. Pengguna menekan tombol *"Sidik Jari"* di layar login.
2. JavaScript memanggil fungsi `AndroidSystem.authenticateBiometric()`.
3. Di sisi native Android (`AndroidBridge.kt` & `MainActivity.kt`), sistem memanggil API `androidx.biometric.BiometricPrompt`.
4. Dialog sistem Android muncul meminta sidik jari pengguna.
5. Jika berhasil diverifikasi oleh chip keamanan perangkat (*Hardware Keystore*), callback `onAuthenticationSucceeded` mengevaluasi kode JavaScript:
   ```javascript
   window._biometricCallback(true);
   ```
6. Aplikasi langsung menyelesaikan login otomatis tanpa perlu mengetik PIN.

---

## 3. Struktur & Manajemen Sesi (Session Management)

Sesi pengguna bersifat luring-persisten (*Offline-First Persistent Session*) dan disimpan di dalam `localStorage` peramban dengan kunci `'ronda_current_user'`:

```json
{
  "role": "pengurus",
  "name": "BAPAK BAMBANG",
  "title": "KETUA RT 01 • PENGURUS",
  "phone": "081234567890",
  "avatar": "icons/icon-192.png"
}
```

### Siklus Hidup Sesi (Session Lifecycle):
- **Inisialisasi**: Dimuat saat aplikasi dibuka pertama kali melalui fungsi `readLocalJson('ronda_current_user', defaultUser)`.
- **Pembaruan**: Terjadi saat pengguna mengubah foto avatar profil atau berganti peran.
- **Terminasi (Logout)**: Ketika pengguna menekan tombol *"Keluar"* di dalam `profileModal`, sistem menghapus sesi lokal dan mengembalikan antarmuka ke layar `screenLogin`.

---

## 4. Matriks Hak Akses & Perizinan (Permission Matrix)

Hak akses antarmuka dan operasional dibagi secara tegas antara dua tingkatan peran:

| Fitur / Modul Operasional | Peran `warga` | Peran `pengurus` (RT) | Keterangan Teknis |
|---|:---:|:---:|---|
| Melihat Metrik Jimpitan Harian | Ya | Ya | Status pasang, kosong, dan total kas terkumpul |
| Melihat Peta Rute & Titik Posko | Ya | Ya | Visualisasi topologi SVG 3 gang |
| Melihat Jadwal Regu Ronda Malam | Ya | Ya | Informasi regu piket A sampai G |
| Mencatat Status Jimpitan Rumah (GPS) | Ya | Ya | Dilakukan oleh petugas ronda yang bertugas malam itu |
| Mengajukan Pelunasan Kas Pribadi | Ya | Tidak Perlu | Formulir pengajuan warga |
| Mengakses Modal Verifikasi Akun | **Dibatasi** | **Ya** | Hanya pengurus yang dapat menyetujui/menolak warga |
| Menyetujui/Menolak Warga Baru | **Ditolak** | **Ya** | Memicu pembuatan rekaman rumah baru di `houses` |
| Mengubah Konfigurasi Jadwal Regu | **Ditolak** | **Ya** | Hak prerogatif Ketua RT |
| Mengirim Laporan Resmi WhatsApp | Ya | Ya | Teks laporan menyertakan nama pengirim aktif |
| Mengakses Audit SQL Database | **Ditolak** | **Terbatas** | Dilindungi Row Level Security (RLS) Supabase |

---

## 5. Token Keamanan & Rekomendasi Audit (Security Roadmap)

### Temuan Audit Arsitektur:
1. **Anon Key**: Aplikasi saat ini menggunakan *Supabase Publishable Anon Key* di sisi klien untuk koneksi REST dan Realtime. Kunci ini aman untuk publikasi peramban selama Row Level Security (RLS) aktif dan kebijakan izin tabel diterapkan dengan benar.
2. **Ketiadaan Hash PIN di Sisi Klien**: Penyimpanan PIN pendaftaran saat ini tersimpan sebagai teks biasa pada tabel `residents` dan `localStorage`.

### Rekomendasi Mitigasi untuk Tahap Produksi Lanjutan:
1. **Implementasi Supabase Auth Resmi**:
   - Memigrasikan login warga ke `supabase.auth.signInWithOtp({ phone: phoneNumber })` (mengirimkan One-Time Password 6 digit via WhatsApp/SMS).
   - Pengurus RT menggunakan `supabase.auth.signInWithPassword({ email, password })`.
2. **Klaim JWT & RLS**:
   - Mengisi klaim peran (`app_metadata: { role: 'pengurus' }`) ke dalam JWT token Supabase.
   - Mengaktifkan kebijakan RLS berbasis fungsi `auth.jwt() -> 'app_metadata' ->> 'role'` sehingga operasi mutasi data diblokir langsung di level PostgreSQL jika bukan pengurus yang sah.
