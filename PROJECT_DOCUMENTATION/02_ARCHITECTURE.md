# 02. Arsitektur Sistem (System Architecture)

Dokumen ini menjelaskan arsitektur tingkat tinggi (*High-Level Architecture*) dan rancangan mendalam dari **Aplikasi Ronda & Jimpitan Warga RT 01 / RW 02 Kelurahan Bener**, ditujukan sebagai bahan audit teknis Software Architect.

---

## 1. Ikhtisar Arsitektur (High-Level Overview)

Aplikasi ini menggunakan pola arsitektur **Hybrid Multi-Platform** dengan filosofi desain **Offline-First & Reactive UI**. Sistem ini dirancang agar dapat diakses melalui dua kanal distribusi utama dengan basis kode tunggal (*single source of truth*):
1. **Progressive Web App (PWA) / Web Responsif**: Berjalan langsung di peramban seluler (Chrome/Safari) dan dapat dipasang tanpa toko aplikasi (*zero-install*).
2. **Native Android Wrapper (WebView Container)**: Dibungkus ke dalam file biner APK native (`.apk`) untuk integrasi mendalam dengan kapabilitas perangkat keras Android (Sensor Biometrik, Haptic Feedback, Geolocation berakurasi tinggi, dan Push Notifications).

```text
+-----------------------------------------------------------------------------------+
|                                 CLIENT LAYER                                      |
|                                                                                   |
|  +-----------------------------------+    +------------------------------------+  |
|  |     PWA / Peramban Seluler        |    |       Native Android Wrapper       |  |
|  |   (Chrome / Safari / Firefox)     |    |   (Kotlin + WebViewAssetLoader)    |  |
|  +-----------------+-----------------+    +-----------------+------------------+  |
|                    |                                        |                     |
|                    +--------------------+-------------------+                     |
|                                         |                                         |
|                                         v                                         |
|                      +--------------------------------------+                     |
|                      |         Single Page App (SPA)        |                     |
|                      |   Vanilla JS + Tailwind CSS (390px)  |                     |
|                      +------------------+-------------------+                     |
|                                         |                                         |
+-----------------------------------------|-----------------------------------------+
                                          |
       +----------------------------------+----------------------------------+
       |                                                                     |
       v                                                                     v
+---------------+                                                     +---------------+
|  LOCAL LAYER  |                                                     |  CLOUD LAYER  |
|               |                                                     |               |
| +-----------+ |                                                     | +-----------+ |
| |  Service  | |                                                     | | Supabase  | |
| |  Worker   | | (Cache API: Shell & Icons)                          | | PostgREST | | (CRUD Realtime)
| +-----------+ |                                                     | +-----------+ |
|               |                                                     |               |
| +-----------+ |                                                     | +-----------+ |
| |   Local   | | (Reactive State, JSON Serializer,                   | | Supabase  | | (WebSocket Sync:
| |  Storage  | |  houses, verif_list, user session)                  | | Realtime  | |  houses, residents)
| +-----------+ |                                                     | +-----------+ |
|               |                                                     |               |
| +-----------+ |                                                     | +-----------+ |
| |  Android  | | (BiometricPrompt, Vibrator,                         | | PostgreSQL| | (RLS, Migrations,
| |  Bridge   | |  WhatsApp Intent, Location GPS)                     | | 15+ Core  | |  RPCs, Haversine)
| +-----------+ |                                                     | +-----------+ |
+---------------+                                                     +---------------+
```

---

## 2. Arsitektur Frontend (Presentation & Logic Layer)

### 2.1 Pola Single Page Application (SPA)
Frontend dibangun secara murni (*Vanilla JavaScript ES6+*) tanpa *framework* berat (React/Vue/Angular), menjaga ukuran bundle sangat ramping dan menjamin waktu inisialisasi di bawah 50 milidetik pada ponsel berdaya rendah:
- **Ukuran Layar Standar**: Dioptimalkan secara spesifik untuk resolusi mobile standar **390px × 844px** (viewport-fit cover dengan penanganan `env(safe-area-inset-top)`).
- **Virtual Screen Switching**: Navigasi antarlayar (`screenOpening`, `screenLogin`, `screenDashboard`) diatur menggunakan manipulasi DOM melalui fungsi `navigateToScreen(screenId)`. Layar yang tidak aktif ditandai kelas CSS `hidden` (`display: none !important`), meminimalkan *layout reflow* dan *paint cycle*.
- **Modal & Bottom-Sheet Management**: Seluruh dialog formulir (Pendaftaran Warga, Pencatatan Jimpitan, Rekapitulasi Kas, Peta Rute, Detail Verifikasi) menggunakan kontainer fixed-position `fixed inset-0` dengan efek transisi akselerasi GPU `translate-y` dan *backdrop-blur*.

### 2.2 Reaktif & Pola State Management
Manajemen state aplikasi mengandalkan tiga variabel reaktif utama di memori yang disinkronkan secara konsisten ke penyimpanan lokal (*LocalStorage*):
1. `houseData`: Array objek rumah warga (ID, nomor rumah, nama kepala keluarga, nama gang, status pasang/kosong, nominal kas, koordinat GPS terakhir, dan timestamp pencatatan).
2. `pendingVerifList`: Array permohonan pendaftaran warga baru yang menunggu verifikasi atau telah diputuskan oleh Ketua RT.
3. `currentUser`: Objek sesi pengguna aktif (`role`: `'pengurus'` atau `'warga'`, `name`, `title`, `phone`, `avatar`).

Fungsi inti `persistState()` menjamin serialisasi otomatis setiap ada mutasi data:
```javascript
function persistState() {
  localStorage.setItem('ronda_house_data', JSON.stringify(houseData));
  localStorage.setItem('ronda_verif_list', JSON.stringify(pendingVerifList));
  localStorage.setItem('ronda_current_user', JSON.stringify(currentUser));
}
```

### 2.3 Desain & Aksesibilitas (WCAG 2.1 AA)
- Tipografi menggunakan font modern Google Fonts: **Plus Jakarta Sans** (display) dan **Inter** (antarmuka teks).
- Seluruh elemen kontrol form dan aksi tombol memenuhi ukuran target sentuh minimal **44×44 piksel**.
- Kontras warna teks memenuhi rasio minimal 4.5:1 terhadap latar belakang.

---

## 3. Arsitektur Backend & Cloud (Supabase / PostgreSQL)

Sistem backend mengandalkan platform cloud **Supabase** yang terdistribusi secara global:
- **Project Ref**: `riehidioeftegpkndxok`
- **Instance URL**: `https://riehidioeftegpkndxok.supabase.co`
- **Komunikasi REST API**: Dikelola oleh modul PostgREST bawaan Supabase, mentransformasikan tabel database PostgreSQL secara instan menjadi endpoint RESTful JSON.

### 3.1 Komponen Cloud Backend

```text
+---------------------------------------------------------------------------------+
|                        SUPABASE CLOUD (PostgreSQL 15+)                          |
|                                                                                 |
|  +---------------------------------------------------------------------------+  |
|  |                            PostgREST API Gateway                          |  |
|  |       (Otentikasi Token Bearer / Anon Key & Row Level Security Check)     |  |
|  +-------------------------------------+-------------------------------------+  |
|                                        |                                        |
|         +------------------------------+------------------------------+         |
|         |                                                             |         |
|         v                                                             v         |
|  +--------------+                                              +--------------+ |
|  | Relational   |                                              | PostgreSQL   | |
|  | Tables       |                                              | Stored RPCs  | |
|  | - houses     |                                              | - calculate_ | |
|  | - residents  |                                              |   haversine_ | |
|  | - jimpitan_  |                                              |   distance   | |
|  |   transact.. |                                              | - create_    | |
|  +-------+------+                                              |   collection | |
|          |                                                     +-------+------+ |
|          v                                                             |        |
|  +--------------+                                                      |        |
|  | Reporting    |                                                      |        |
|  | Views        |                                                      |        |
|  | (Security    |                                                      |        |
|  |  Invoker)    |                                                      |        |
|  +-------+------+                                                      |        |
|          |                                                             |        |
|          +-----------------------------+-------------------------------+        |
|                                        |                                        |
|                                        v                                        |
|  +---------------------------------------------------------------------------+  |
|  |                 Realtime Engine (Elixir Broadcast Server)                 |  |
|  |       (Mendengarkan PostgreSQL WAL replication stream & push ke client)   |  |
|  +---------------------------------------------------------------------------+  |
+---------------------------------------------------------------------------------+
```

### 3.2 Realtime Synchronization Flow
Aplikasi web mendaftarkan listener WebSocket menggunakan Supabase JS v2 Client:
```javascript
supabaseClient.channel('ronda-realtime-sync')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'houses' }, () => {
    fetchSupabaseData();
  })
  .on('postgres_changes', { event: '*', schema: 'public', table: 'residents' }, () => {
    fetchSupabaseData();
  })
  .subscribe();
```
Setiap kali petugas ronda mencatat status jimpitan di lapangan atau ada warga baru mendaftar dari gawai lain, database memancarkan event `INSERT`/`UPDATE` melalui WebSocket, memicu `fetchSupabaseData()` dan memperbarui antarmuka pengguna tanpa perlu refresh layar (*live UI re-render*).

---

## 4. Arsitektur Native Android Wrapper

Aplikasi Android dibangun sebagai wadah (*container*) native menggunakan Kotlin dan Android SDK API Level 34.

### 4.1 WebViewAssetLoader (Isolasi Keamanan & Performa)
Daripada memuat aset melalui skema lawas yang tidak aman seperti `file:///android_asset/`, aplikasi menggunakan **`androidx.webkit.WebViewAssetLoader`**.
- File web dimuat melalui domain virtual terisolasi: `https://appassets.androidplatform.net/assets/www/index.html`.
- **Manfaat Keamanan**: Menolak serangan Cross-Site Scripting (XSS) berbasis file lokal, mendukung Content Security Policy (CSP), mencegah pelanggaran Same-Origin Policy (SOP), dan menonaktifkan `allowFileAccess` serta `allowContentAccess`.

### 4.2 Lapisan Jembatan Hardware (AndroidBridge)
Komunikasi dua arah antara JavaScript di WebView dan thread native Android dijembatani oleh kelas `AndroidBridge.kt` dengan injeksi objek `window.AndroidBridge`.

```text
[ JavaScript (index.html) ]
             |
             | AndroidSystem.vibrate(40)
             v
[ window.AndroidBridge.vibrate(40) ]
             |
             | @JavascriptInterface (Thread Background/UI)
             v
[ AndroidBridge.kt ]
             |
             | activity.runOnUiThread { ... }
             v
[ VibratorManager / Vibrator API ] -> [ Perangkat Keras Getar Ponsel ]
```

Fitur native yang didukung meliputi:
1. **BiometricPrompt API**: Memanfaatkan modul `androidx.biometric:biometric:1.2.0-alpha05` untuk autentikasi sidik jari perangkat keras berstandar `BIOMETRIC_STRONG` dan `BIOMETRIC_WEAK`.
2. **Haptic Vibrator**: Mendukung `VibratorManager` modern pada Android 12+ (API 31+) dengan fallback `VibrationEffect.createOneShot` pada Android 8.0+.
3. **Android Hardware Back Button**: Mencegat tombol kembali fisik gawai melalui `OnBackPressedCallback`. Jika terdapat modal atau bottom sheet yang sedang terbuka di web view, tombol kembali akan menutup modal tersebut tanpa keluar dari aplikasi.
4. **Intent Sharing**: Membuka WhatsApp secara langsung (`com.whatsapp`) untuk distribusi laporan patroli ke grup warga, atau fallback ke Android Share Chooser umum.
5. **Geolocation ChromeClient**: Menangani izin lokasi dinamis `ACCESS_FINE_LOCATION` saat petugas ronda menekan tombol "Catat Jimpitan (GPS)".
