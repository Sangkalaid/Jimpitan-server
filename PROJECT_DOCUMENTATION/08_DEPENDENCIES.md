# 08. Daftar Dependensi & Pustaka Eksternal (Dependencies & Libraries)

Dokumen ini menginventarisasi seluruh pustaka (*libraries*), kerangka kerja (*frameworks*), plugin, dan alat bantu kompilasi yang digunakan dalam **Aplikasi Ronda & Jimpitan Warga RT 01 / RW 02 Kelurahan Bener**.

---

## 1. Dependensi Frontend Web (CDN & Aset Daring)

Frontend dirancang secara hemat dependensi (*lean-dependency architecture*), memuat pustaka yang teruji langsung dari Content Delivery Network (CDN) terpercaya dengan integritas tinggi:

| Nama Pustaka | Versi | Sumber Distribusi (URL) | Tujuan Penggunaan |
|---|:---:|---|---|
| **Supabase JS Client** | `v2` (terbaru) | `https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2` | Klien resmi Supabase untuk query PostgREST, integrasi WebSocket Realtime, dan RPC call. |
| **Tailwind CSS CDN** | `v3.x` | `https://cdn.tailwindcss.com?plugins=forms,container-queries` | Mesin CSS utilitas untuk styling responsif, tata letak grid/flex, dan palet warna kustom. |
| **Phosphor Icons Web** | `2.1.2` | `https://unpkg.com/@phosphor-icons/web` & jsDelivr | Koleksi ikon antarmuka (Regular, Bold, Fill) untuk tombol tindakan cepat dan kartu metrik. |
| **Material Symbols Outlined** | Terkini | `https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined` | Ikon sistem Google untuk simbol navigasi, sensor biometrik, getar haptic, dan status koneksi. |
| **Google Fonts (Plus Jakarta Sans)**| Google Fonts | `https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400..900` | Tipografi primer modern untuk judul layar dan elemen kartu informasi. |
| **Google Fonts (Inter)** | Google Fonts | `https://fonts.googleapis.com/css2?family=Inter:wght@400..800` | Tipografi sekunder yang dioptimalkan untuk keterbacaan teks kecil dan angka nominal kas. |

---

## 2. Dependensi Proyek Native Android (Gradle Dependencies)

Proyek Android dikelola melalui Android Gradle Plugin (AGP) dan repositori Maven resmi (Google Maven & Maven Central):

### 2.1 Plugin Build (`android/build.gradle` & `app/build.gradle`)
- **Android Gradle Plugin (AGP)**: `com.android.application` versi `8.2.2`
- **Kotlin Android Plugin**: `org.jetbrains.kotlin.android` versi `1.9.22`

### 2.2 Pustaka Runtime Android (`android/app/build.gradle`)

| Dependensi AndroidX / Google | Versi | Tujuan & Peran Fungsional |
|---|:---:|---|
| `androidx.core:core-ktx` | `1.12.0` | Ekstensi Kotlin untuk API inti sistem Android dan kompatibilitas ke belakang (*backward compatibility*). |
| `androidx.appcompat:appcompat` | `1.6.1` | Mendukung kelas dasar `AppCompatActivity` dan pengelolaan daur hidup aplikasi Android. |
| `com.google.android.material:material`| `1.11.0` | Komponen desain Material 3 dari Google untuk konsistensi tema aplikasi. |
| `androidx.activity:activity-ktx` | `1.8.2` | Menyediakan `OnBackPressedDispatcher` dan antarmuka `registerForActivityResult` untuk pemilih file/izin kamera. |
| `androidx.webkit:webkit` | `1.10.0` | Menyediakan komponen `WebViewAssetLoader` untuk memuat aset web lokal secara aman dengan skema `https://appassets.androidplatform.net`. |
| `androidx.biometric:biometric` | `1.2.0-alpha05` | Mengintegrasikan sensor sidik jari perangkat keras melalui dialog standar `BiometricPrompt`. |

---

## 3. Lingkungan Kompilasi & Alat Bantu (Build & Tooling)

| Perangkat Bantu | Versi / Rincian | Peran dalam Proyek |
|---|:---:|---|
| **Gradle Wrapper** | `8.2` | Memastikan kompilasi proyek Android menghasilkan biner identik di semua lingkungan pengembang. |
| **Java Development Kit (JDK)**| `JDK 17` (Eclipse Temurin) | Compiler Java virtual machine target SDK Android 34. |
| **Android SDK** | `compileSdk 34`, `minSdk 26`, `targetSdk 34` | Target lingkungan sistem operasi Android (Mendukung Android 8.0 Oreo hingga Android 14). |
| **Python HTTP Server** | `Python 3.8+` | Melayani web server lokal pengujian melalui skrip `JALANKAN_APLIKASI.bat`. |

---

## 4. Dependensi CI/CD GitHub Actions

Alur otomatisasi kompilasi cloud (`.github/workflows/build-apk.yml`) mengandalkan Actions terverifikasi:
- `actions/checkout@v4`: Mengambil kode sumber dari repositori Git.
- `actions/setup-java@v4`: Memasang lingkungan JDK 17 Temurin dan mengaktifkan cache dependensi Gradle.
- `actions/upload-artifact@v4`: Mengunggah biner `app-debug.apk` hasil kompilasi ke repositori artefak GitHub.
- `softprops/action-gh-release@v2`: Mempublikasikan rilis APK otomatis saat tag versi baru dibuat.
