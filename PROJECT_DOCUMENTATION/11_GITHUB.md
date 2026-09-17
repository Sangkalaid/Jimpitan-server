# 11. Integrasi GitHub & Status Version Control (GitHub & CI/CD)

Dokumen ini menyajikan status terkini repositori Git, cabang (*branch*) yang aktif, riwayat commit terbaru, serta perincian alur kerja otomatisasi (*workflow*) GitHub Actions dari **Aplikasi Ronda & Jimpitan Warga RT 01 / RW 02 Kelurahan Bener**.

---

## 1. Metadata Repositori Git

- **Remote URL**: `https://github.com/Sangkalaid/Jimpitan-server.git`
- **Branch Aktif**: `main`
- **Status Sinkronisasi**: Up to date dengan `origin/main` (Working tree clean).
- **Hosting Halaman Publik**: GitHub Pages diaktifkan pada root branch `main` (`https://sangkalaid.github.io/Jimpitan-server/`).

---

## 2. Riwayat Commit Terakhir (Commit Log)

Berikut adalah ringkasan empat commit terakhir pada cabang `main`:

```text
* d210f43 (HEAD -> main, origin/main) feat: finalisasi aplikasi dan otomatisasi build apk via github actions
* ef8e497 Update online link in buka_di_hp guide
* 599612d Update access URL to GitHub Pages
* c08c344 Initial commit: Aplikasi Ronda & Jimpitan Warga RT 01 Kelurahan Bener
```

### Rincian Perubahan Kunci:
1. **`c08c344` (Initial Commit)**:
   - Pembentukan struktur dasar aplikasi ronda, dokumen PRD, aset ikon, service worker PWA, serta wrapper WebView Android awal.
2. **`599612d` & `ef8e497`**:
   - Pembaruan URL akses produksi ke GitHub Pages resmi (`https://sangkalaid.github.io/Jimpitan-server/`) pada panduan `buka_di_hp.html`, skrip peluncur, dan README.
3. **`d210f43` (Finalisasi & Otomatisasi CI/CD)**:
   - Penambahan workflow `.github/workflows/build-apk.yml`.
   - Penyempurnaan `AndroidBridge.kt` dan `MainActivity.kt` dengan penanganan izin dinamis Android 13+ (Tiramisu) dan Android 14.
   - Penyesuaian `COMPILE_APK.bat` dengan opsi build cloud bebas install Java.

---

## 3. Alur Kerja GitHub Actions (`build-apk.yml`)

File konfigurasi workflow berlokasi di `.github/workflows/build-apk.yml`.

### 3.1 Pemicu Eksekusi (Triggers)
- **`push`**: Dijalankan otomatis setiap ada kode baru yang didorong ke branch `main`.
- **`pull_request`**: Dijalankan untuk memvalidasi build sebelum penggabungan kode ke branch `main`.
- **`workflow_dispatch`**: Menyediakan tombol manual trigger pada tab "Actions" di web GitHub.

### 3.2 Diagram Alir Pekerjaan (Job Pipeline)

```text
[ GitHub Push / Pull Request / Manual Trigger ]
                       |
                       v
         +-----------------------------+
         |   Runner: ubuntu-latest     |
         +--------------+--------------+
                        |
                        v
         +-----------------------------+
         | 1. actions/checkout@v4      | -> Mengambil source code
         +--------------+--------------+
                        |
                        v
         +-----------------------------+
         | 2. actions/setup-java@v4    | -> Pasang JDK 17 (Temurin)
         |    (Gradle Cache: Enabled)  |
         +--------------+--------------+
                        |
                        v
         +-----------------------------+
         | 3. chmod +x android/gradlew | -> Berikan izin eksekusi
         +--------------+--------------+
                        |
                        v
         +-----------------------------+
         | 4. ./gradlew assembleDebug  | -> Kompilasi APK Android
         +--------------+--------------+
                        |
                        v
         +-----------------------------+
         | 5. actions/upload-artifact  | -> Unggah Ronda-RT01-app-debug.zip
         |    (Retention: 30 Hari)     |    ke dashboard Artifacts GitHub
         +--------------+--------------+
                        |
                        v (Kondisional: Jika commit berupa Git Tag)
         +-----------------------------+
         | 6. softprops/action-release | -> Buat GitHub Release otomatis
         +-----------------------------+
```

### 3.3 Spesifikasi Artefak Hasil Build
- **Nama Artefak**: `Ronda-RT01-app-debug`
- **File Target**: `android/app/build/outputs/apk/debug/app-debug.apk`
- **Masa Simpan (Retention)**: 30 hari kalender.
