# Peta Arsitektur & Alur Proyek (Project Map)

Dokumen ini menyajikan peta komprehensif dari **Aplikasi Ronda & Jimpitan Warga RT 01 / RW 02 Kelurahan Bener** menggunakan visualisasi diagram Mermaid untuk memfasilitasi audit menyeluruh oleh Software Architect.

---

## 1. Peta Struktur Proyek (Project Structure Map)

```mermaid
graph TD
    Root["Aplikasi Ronda & Jimpitan (Root)"]
    
    subgraph Frontend_PWA ["Frontend Web & PWA Layer"]
        IndexHtml["index.html<br/>(SPA UI, Logic & Supabase JS)"]
        SW["sw.js<br/>(Service Worker Offline Cache)"]
        Manifest["manifest.json<br/>(PWA Web Manifest)"]
        BukaHp["buka_di_hp.html<br/>(Panduan Onboarding & QR)"]
        TestWorkbench["test_aplikasi_ronda.html<br/>(Workbench & Device Simulator)"]
        Icons["icons/<br/>(Asset Ikon & QR Code)"]
    end

    subgraph Native_Android ["Native Android Wrapper"]
        MainActivity["MainActivity.kt<br/>(WebView, Biometrics, Back Button)"]
        AndroidBridge["AndroidBridge.kt<br/>(JavascriptInterface Bridge)"]
        AssetLoader["WebViewAssetLoader<br/>(assets/www/ Sandboxing)"]
        ManifestXML["AndroidManifest.xml<br/>(Permissions & Intents)"]
        GradleBuild["build.gradle & gradlew<br/>(Build Automation)"]
    end

    subgraph Cloud_Backend ["Supabase Cloud Backend"]
        HousesTbl["public.houses<br/>(Status Jimpitan & Koordinat)"]
        ResidentsTbl["public.residents<br/>(Pendaftaran Warga Baru)"]
        TransactionsTbl["public.jimpitan_transactions<br/>(Audit Ledger Kas)"]
        PostgreSQL_RPC["PostgreSQL RPCs<br/>(Haversine, Transaksi Koleksi)"]
        ReportingViews["Security Invoker Views<br/>(Ledger & Progress Patroli)"]
        RealtimeChannel["Realtime WebSocket<br/>(postgres_changes Feed)"]
    end

    subgraph Automation_CI ["Build & CI/CD Scripts"]
        RunBat["JALANKAN_APLIKASI.bat<br/>(Local Python Server 8088)"]
        CompileBat["COMPILE_APK.bat<br/>(Sync Web Assets & Compile)"]
        GitHubActions[".github/workflows/build-apk.yml<br/>(Cloud APK Builder)"]
    end

    Root --> Frontend_PWA
    Root --> Native_Android
    Root --> Cloud_Backend
    Root --> Automation_CI
```

---

## 2. Hubungan Antar Modul (Module Relationship Map)

```mermaid
graph LR
    subgraph UI_Layer ["Presentasi & Antarmuka Pengguna"]
        DOM["DOM Engine (index.html)"]
        Tailwind["Tailwind CSS + Custom Animation"]
        Modals["11 Bottom-Sheet Modals"]
    end

    subgraph Core_Engine ["Logika Aplikasi & State Lokal"]
        State["Reactive State (houseData, pendingVerif, currentUser)"]
        LocalStorage[("Browser LocalStorage")]
        AndroidSys["AndroidSystem Helper Object"]
    end

    subgraph Hardware_Bridge ["Lapisan Native Android"]
        Bridge["@JavascriptInterface AndroidBridge"]
        Biometrics["BiometricPrompt (Fingerprint)"]
        Haptic["Vibrator / VibratorManager"]
        Notify["NotificationManager"]
        Share["Android Intent (WhatsApp / Chooser)"]
    end

    subgraph Remote_Cloud ["Supabase Backend Layer"]
        SupaClient["@supabase/supabase-js v2"]
        PostgREST["PostgREST HTTP Gateway"]
        WS["Realtime Channel WebSocket"]
    end

    DOM --> State
    Modals --> State
    State <--> LocalStorage
    DOM --> AndroidSys
    AndroidSys <--> Bridge
    Bridge --> Biometrics
    Bridge --> Haptic
    Bridge --> Notify
    Bridge --> Share
    State <--> SupaClient
    SupaClient <--> PostgREST
    SupaClient <--> WS
```

---

## 3. Alur Autentikasi & Login (Login Flow)

```mermaid
sequenceDiagram
    autonumber
    actor Pengguna as Warga / Pengurus
    participant LoginUI as Screen Login
    participant BiometricHW as Sensor Sidik Jari (Android)
    participant LocalMem as State & LocalStorage
    participant Dashboard as Screen Dashboard

    Pengguna->>LoginUI: Buka aplikasi & pilih Tab Peran (Warga / Pengurus)
    alt Opsi A: Login Manual (PIN)
        Pengguna->>LoginUI: Input Nomor WhatsApp & PIN 6 Digit
        Pengguna->>LoginUI: Klik "Masuk Aplikasi"
    else Opsi B: Login Biometrik
        Pengguna->>LoginUI: Ketuk tombol "Sidik Jari"
        LoginUI->>BiometricHW: authenticateBiometric()
        BiometricHW-->>LoginUI: onAuthenticationSucceeded()
    end

    LoginUI->>LocalMem: Evaluasi kredensial pengguna
    alt Jika Peran Warga & Status "Pending"
        LocalMem-->>LoginUI: Status akun belum disetujui Ketua RT
        LoginUI-->>Pengguna: Tampilkan Toast Peringatan (Akses Ditahan)
    else Jika Kredensial Valid
        LocalMem->>LocalMem: Simpan sesi (ronda_current_user)
        LoginUI->>Dashboard: navigateToScreen('screenDashboard')
        Dashboard-->>Pengguna: Tampilkan Dashboard sesuai peran
    end
```

---

## 4. Alur Kerja Dashboard (Dashboard Lifecycle Flow)

```mermaid
flowchart TD
    Start([Pengguna Masuk Dashboard]) --> InitRender[renderAllDashboardComponents]
    
    InitRender --> LiveClock[Perbarui Jam Berjalan & Tanggal Shift]
    InitRender --> MetricCards[Hitung & Render Kartu: Pasang, Kosong, Lunas]
    InitRender --> ChecklistProgress[Hitung Progres Checklist Rumah Selesai / Belum]
    InitRender --> RoleAdaptation{Periksa currentUser.role}
    
    RoleAdaptation -- "pengurus" --> RenderRT[Tampilkan Tombol Verifikasi Warga Baru & Badge RT]
    RoleAdaptation -- "warga" --> RenderWarga[Tampilkan Tombol Pengajuan Warga & Badge Warga]
    
    RenderRT --> UserAction{Aksi Pengguna}
    RenderWarga --> UserAction
    
    UserAction --> |Klik Kartu Metrik| OpenStatModal[Buka statDetailModal & Filter Rumah]
    UserAction --> |Klik Peta Rute| OpenRouteModal[Buka routeMapModal SVG 3 Gang]
    UserAction --> |Klik Catat Jimpitan| OpenJimpitanModal[Buka jimpitanModal & Baca GPS]
    UserAction --> |Klik Kirim Laporan| OpenShareModal[Buka shareReportModal Format WA]
    UserAction --> |Klik Rekap Kas| OpenRekapModal[Buka rekapModal Harian/Mingguan/Bulanan]
    UserAction --> |Klik Profil| OpenProfileModal[Buka profileModal Ganti Foto/Logout]
```

---

## 5. Alur Pengguna: Warga Biasa (User / Warga Flow)

```mermaid
flowchart TD
    WargaStart([Warga Baru Mengakses Aplikasi]) --> RegForm[Buka modalRegister 'Daftar Akun Baru']
    RegForm --> InputData[Isi Nama, No. WhatsApp, Status Hunian, Buat PIN 6 Digit]
    InputData --> SubmitReg[Klik 'Daftar Akun']
    
    SubmitReg --> LocalSave[Simpan ke pendingVerifList lokal]
    SubmitReg --> CloudSave[Kirim POST ke tabel Supabase 'residents']
    CloudSave --> WaitingState[Status: Menunggu Persetujuan Ketua RT]
    
    WaitingState --> ApprovedState{Apakah Ketua RT Menyetujui?}
    ApprovedState -- Tidak / Ditolak --> RejectedNotice[Notifikasi Pendaftaran Ditolak]
    ApprovedState -- Ya / Disetujui --> LoginReady[Akun Aktif & Rumah Terdaftar Otomatis]
    
    LoginReady --> LoginDashboard[Masuk ke Dashboard Warga]
    LoginDashboard --> ViewStatus[Pantau Status Jimpitan Kotak Rumah Sendiri]
    LoginDashboard --> ViewSchedule[Cek Jadwal Giliran Ronda Malam Regu A-G]
    LoginDashboard --> SubmitPay[Ajukan Pelunasan Kas di Muka via pengajuanModal]
```

---

## 6. Alur Pengguna: Pengurus RT (Admin / Pengurus Flow)

```mermaid
flowchart TD
    RTStart([Pengurus RT Login]) --> DashboardRT[Masuk Dashboard Pengurus RT]
    DashboardRT --> BadgeCheck{Ada Notifikasi Warga Baru?}
    
    BadgeCheck -- Ada --> OpenVerif[Buka verifAkunModal]
    OpenVerif --> ReviewApplicant[Tinjau Nama, Status Rumah, dan No. Telepon]
    ReviewApplicant --> Decide{Keputusan Pengurus}
    
    Decide -- "Tolak" --> MarkReject[Update status 'rejected' di Supabase & Lokal]
    Decide -- "Setujui" --> MarkApprove[Update status 'approved' di Supabase & Lokal]
    MarkApprove --> AutoRegisterHouse[Generate Entri Rumah Baru di tabel 'houses']
    AutoRegisterHouse --> AssignGang[Alokasikan ke Gang Mawar/Dahlia/Melati]
    
    BadgeCheck -- Tidak Ada --> FieldPatrol[Pemantauan Patroli Ronda Malam]
    FieldPatrol --> AuditCash[Buka rekapModal Audit Setoran Harian/Bulanan]
    AuditCash --> BroadcastWA[Generate Format Laporan & Share ke Grup WhatsApp]
```

---

## 7. Alur Sinkronisasi Supabase (Cloud Synchronization Flow)

```mermaid
sequenceDiagram
    autonumber
    participant AppA as Klien Petugas Ronda (Ponsel A)
    participant SupaCloud as Supabase Database (PostgreSQL)
    participant RealtimeEngine as Supabase Realtime WebSocket
    participant AppB as Klien Ketua RT (Ponsel B)

    AppA->>AppA: Petugas mencatat Jimpitan No. 05 = Pasang (GPS valid)
    AppA->>AppA: Simpan ke LocalStorage lokal
    AppA->>SupaCloud: PATCH /houses?no_rumah=eq.No.05 (status_jimpitan: pasang)
    AppA->>SupaCloud: POST /jimpitan_transactions (nominal: 500, recorded_by: Bpk. Bambang)
    SupaCloud-->>AppA: 200 OK (Konfirmasi Tersimpan)
    
    Note over SupaCloud,RealtimeEngine: PostgreSQL WAL memancarkan event UPDATE
    SupaCloud->>RealtimeEngine: Emit change on table 'houses'
    RealtimeEngine-->>AppB: Broadcast message (topic: ronda-realtime-sync)
    AppB->>AppB: Tangkap event 'postgres_changes'
    AppB->>SupaCloud: fetchSupabaseData() (Ambil data terbaru)
    SupaCloud-->>AppB: Kembalikan daftar rumah terbaru
    AppB->>AppB: Re-render kartu metrik kas secara instan tanpa reload layar!
```

---

## 8. Relasi Entitas Basis Data (Database ERD Flow)

```mermaid
erDiagram
    HOUSES ||--o{ JIMPITAN_TRANSACTIONS : "menghasilkan"
    RESIDENTS ||--o| HOUSES : "diverifikasi menjadi"

    HOUSES {
        bigint id PK "Identifier rumah"
        varchar no_rumah UK "Penomoran unik fisik rumah"
        varchar nama_warga "Nama penanggung jawab"
        varchar phone "Nomor WhatsApp"
        varchar gang "Sektor: Mawar, Dahlia, Melati"
        varchar status_jimpitan "'pasang' | 'kosong'"
        integer nominal "Nominal koin (standar 500)"
        varchar waktu_terakhir "Timestamp string pencatatan"
        jsonb last_location "Metadata GPS (lat, lon, acc)"
        timestamptz updated_at "Waktu pembaruan sistem"
    }

    RESIDENTS {
        uuid id PK "Identifier unik pemohon"
        varchar nama "Nama lengkap pendaftar"
        varchar phone UK "Nomor WhatsApp akun"
        varchar status_hunian "Pribadi / Kontrak / Kos"
        varchar pin "PIN keamanan 6 digit"
        varchar status_verifikasi "'pending' | 'approved' | 'rejected'"
        timestamptz created_at "Waktu pengajuan"
    }

    JIMPITAN_TRANSACTIONS {
        uuid id PK "ID audit transaksi"
        varchar no_rumah "Nomor rumah terkait"
        varchar nama_warga "Nama warga"
        varchar status "'pasang' | 'kosong' | 'lunas'"
        integer nominal "Nilai setoran kas masuk"
        varchar recorded_by "Petugas pencatat"
        timestamptz created_at "Waktu transaksi"
    }
```

---

## 9. Alur Pemanggilan API & Native Bridge (API & Bridge Interaction Flow)

```mermaid
sequenceDiagram
    autonumber
    participant UI as Antarmuka Web (JavaScript)
    participant Bridge as AndroidBridge Native (Kotlin)
    participant AndroidOS as Sistem Operasi Android
    participant PostgREST as Supabase API Gateway

    Note over UI,AndroidOS: Interaksi 1: Getar Haptic Tombol
    UI->>Bridge: window.AndroidBridge.vibrate(40)
    Bridge->>AndroidOS: Vibrator.vibrate(OneShot 40ms)
    AndroidOS-->>Pengguna: Getaran Fisik Gawai

    Note over UI,AndroidOS: Interaksi 2: Permintaan Koordinat Lokasi GPS
    UI->>AndroidOS: navigator.geolocation.getCurrentPosition()
    AndroidOS->>Bridge: WebChromeClient.onGeolocationPermissionsShowPrompt()
    Bridge->>AndroidOS: Cek izin ACCESS_FINE_LOCATION
    AndroidOS-->>UI: Kembalikan Latitude, Longitude, Accuracy

    Note over UI,PostgREST: Interaksi 3: Penyimpanan Data ke Cloud
    UI->>PostgREST: POST /jimpitan_transactions (Payload Kas + GPS)
    PostgREST-->>UI: 201 Created

    Note over UI,AndroidOS: Interaksi 4: Berbagi Laporan ke WhatsApp
    UI->>Bridge: window.AndroidBridge.shareWhatsApp("", reportText)
    Bridge->>AndroidOS: startActivity(Intent.ACTION_VIEW com.whatsapp)
    AndroidOS-->>Pengguna: Aplikasi WhatsApp Terbuka dengan Format Siap Kirim
```
