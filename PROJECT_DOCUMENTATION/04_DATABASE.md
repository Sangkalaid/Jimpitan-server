# 04. Arsitektur Database & Migrasi (Database, Schema & RLS)

Dokumen ini menyajikan spesifikasi lengkap skema database PostgreSQL yang dihosting pada **Supabase Cloud** (Proyek Ref: `riehidioeftegpkndxok`), mencakup definisi tabel, view, fungsi RPC, kebijakan Row Level Security (RLS), riwayat migrasi, dan penyimpanan data.

---

## 1. Skema Tabel Utama (Core Database Tables)

Database dirancang dengan prinsip normalisasi dan integritas transaksi keuangan mikro, terdiri dari tiga tabel operasional utama:

### 1.1 Tabel `public.houses`
Menyimpan data registrasi rumah warga RT 01 Kelurahan Bener, status keterisian koin jimpitan malam ini, dan log lokasi terakhir.

| Nama Kolom | Tipe Data | Constraint / Default | Penjelasan |
|---|---|---|---|
| `id` | `BIGSERIAL` / `INT8` | `PRIMARY KEY` | Identifier unik rumah |
| `no_rumah` | `VARCHAR(30)` | `NOT NULL, UNIQUE` | Penomoran fisik rumah (misal: "No. 01", "No. 12") |
| `nama_warga` | `VARCHAR(150)` | `NOT NULL` | Nama lengkap kepala keluarga / penanggung jawab |
| `phone` | `VARCHAR(25)` | `NULLABLE` | Nomor telepon WhatsApp warga |
| `gang` | `VARCHAR(60)` | `NOT NULL` | Sektor jalan ("Gang Mawar", "Gang Dahlia", "Gang Melati") |
| `status_jimpitan` | `VARCHAR(20)` | `DEFAULT 'pasang'` | Status malam ini: `'pasang'` (terisi) atau `'kosong'` (nihil) |
| `nominal` | `INTEGER` | `DEFAULT 500` | Nilai standar koin jimpitan per malam (Rp 500) |
| `waktu_terakhir` | `VARCHAR(50)` | `NULLABLE` | String waktu pencatatan terakhir (misal: "23:15 WIB") |
| `last_location` | `JSONB` | `NULLABLE` | Metadata koordinat GPS saat dicatat (`latitude`, `longitude`, `accuracy`) |
| `updated_at` | `TIMESTAMPTZ` | `DEFAULT NOW()` | Waktu pembaruan rekaman terakhir |

---

### 1.2 Tabel `public.residents`
Menyimpan permohonan pendaftaran warga baru yang diajukan melalui formulir aplikasi seluler sebelum diverifikasi oleh Ketua RT.

| Nama Kolom | Tipe Data | Constraint / Default | Penjelasan |
|---|---|---|---|
| `id` | `BIGSERIAL` / `UUID` | `PRIMARY KEY` | Identifier unik warga pemohon |
| `nama` | `VARCHAR(150)` | `NOT NULL` | Nama lengkap pemohon |
| `phone` | `VARCHAR(25)` | `NOT NULL, UNIQUE` | Nomor WhatsApp pemohon (kunci identitas login) |
| `status_hunian`| `VARCHAR(50)` | `NOT NULL` | Status tempat tinggal ("Rumah Pribadi", "Kontrak", "Kos") |
| `pin` | `VARCHAR(6)` | `NOT NULL` | Kode PIN keamanan 6 digit |
| `status_verifikasi` | `VARCHAR(20)`| `DEFAULT 'pending'`| Status persetujuan RT: `'pending'`, `'approved'`, atau `'rejected'` |
| `created_at` | `TIMESTAMPTZ` | `DEFAULT NOW()` | Waktu pengajuan pendaftaran |

---

### 1.3 Tabel `public.jimpitan_transactions`
Buku kas (*audit ledger*) yang mencatat setiap peristiwa pengambilan uang koin atau pelunasan kas oleh warga.

| Nama Kolom | Tipe Data | Constraint / Default | Penjelasan |
|---|---|---|---|
| `id` | `UUID` | `PRIMARY KEY, DEFAULT gen_random_uuid()` | ID transaksi finansial |
| `no_rumah` | `VARCHAR(30)` | `NULLABLE` | Nomor rumah terkait (jika berlaku) |
| `nama_warga` | `VARCHAR(150)` | `NOT NULL` | Nama warga yang bersangkutan |
| `status` | `VARCHAR(20)` | `NOT NULL` | Tipe mutasi: `'pasang'`, `'kosong'`, atau `'lunas'` |
| `nominal` | `INTEGER` | `NOT NULL` | Nilai kas masuk (Rp 500 untuk pasang, Rp 0 kosong, nominal bebas lunas) |
| `recorded_by` | `VARCHAR(100)` | `NOT NULL` | Nama petugas ronda atau pengurus yang menginput |
| `created_at` | `TIMESTAMPTZ` | `DEFAULT NOW()` | Timestamp pencatatan transaksi |

---

## 2. Pelaporan & SQL Views (Security Invoker Views)

Aplikasi memiliki tiga view pelaporan yang dikonfigurasi menggunakan opsi `security_invoker = true` (sesuai migrasi `202609160001`), memastikan bahwa hak akses Row Level Security (RLS) pengguna yang memanggil diterapkan secara ketat:

### 2.1 `public.view_official_cash_ledger`
- **Fungsi**: Merekap seluruh mutasi kas masuk per tanggal, total setoran, dan penanggung jawab shift patroli.
- **Konfigurasi Keamanan**:
  - `security_invoker = true`
  - Izin dicabut dari: `public`, `anon`
  - Izin diberikan ke: `authenticated`

### 2.2 `public.view_operational_session_progress`
- **Fungsi**: Memantau progres checklist patroli malam yang sedang berlangsung (jumlah rumah selesai diperiksa vs sisa rumah per gang).
- **Konfigurasi Keamanan**:
  - `security_invoker = true`
  - Hak akses terbatas khusus untuk pengguna terautentikasi (`authenticated`).

### 2.3 `public.view_active_session_houses`
- **Fungsi**: Menyajikan daftar rumah aktif yang wajib dikunjungi selama shift ronda malam ini berlangsung.
- **Konfigurasi Keamanan**:
  - `security_invoker = true`
  - Hak akses terbatas khusus untuk pengguna terautentikasi (`authenticated`).

---

## 3. Fungsi Tersimpan & Remote Procedure Call (RPC)

Database dilengkapi fungsi tersimpan PostgreSQL untuk integritas operasional dan keamanan kalkulasi:

### 3.1 `calculate_haversine_distance_meters(lat1, lon1, lat2, lon2)`
- **Fungsi**: Menghitung jarak spasial lingkaran besar antara titik GPS petugas ronda dengan koordinat target rumah dalam satuan meter.
- **Pengamanan**: Dikunci dengan `SET search_path = pg_catalog` untuk mencegah serangan manipulasi search path. Mengembalikan `NULL` jika nilai lintang/bujur berada di luar batas valid bumi (-90 s.d +90 derajat).

### 3.2 Kumpulan Fungsi Transaksi Finansial (SECURITY DEFINER)
Enam fungsi RPC aplikasi yang dilindungi secara ketat berdasarkan migrasi `202609160002`:
1. `get_auth_user_claims()`: Membaca peran dan identitas pengguna aktif yang login di Supabase Auth untuk evaluasi aturan RLS.
2. `create_collection_transaction(...)`: Mencatat transaksi pengambilan koin jimpitan secara atomik.
3. `void_collection_transaction(uuid, text)`: Membatalkan transaksi salah input dengan alasan pembatalan tertulis.
4. `finalize_patrol_session(uuid, text)`: Mengunci sesi patroli malam dan menutup buku kas shift terkait.
5. `create_reversal_transaction(...)`: Membuat jurnal pembalik kas jimpitan.
6. `create_adjustment_transaction(...)`: Membuat jurnal penyesuaian kas selisih koin.

**Matriks Izin RPC:**
- `anon` / `public`: **DITOLAK (REVOKED)**
- `authenticated`: **DIIZINKAN (GRANTED)**

---

## 4. Riwayat Migrasi (Migration History)

Seluruh perubahan skema dikelola melalui script SQL versi di folder `supabase/migrations/`:

### Migrasi 1: `202609160001_fix_security_invoker_views.sql`
- **Tujuan**: Memperbaiki kerentanan *Security Definer Views* yang ditemukan oleh Supabase Security Advisor.
- **Tindakan**:
  ```sql
  begin;
  alter view public.view_official_cash_ledger set (security_invoker = true);
  alter view public.view_operational_session_progress set (security_invoker = true);
  alter view public.view_active_session_houses set (security_invoker = true);

  revoke all on public.view_official_cash_ledger from public, anon;
  revoke all on public.view_operational_session_progress from public, anon;
  revoke all on public.view_active_session_houses from public, anon;

  grant select on public.view_official_cash_ledger to authenticated;
  grant select on public.view_operational_session_progress to authenticated;
  grant select on public.view_active_session_houses to authenticated;
  commit;
  ```

### Migrasi 2: `202609160002_harden_rpc_permissions.sql`
- **Tujuan**: Menutup celah eksekusi anonim pada fungsi mutasi kas dan memastikan kalkulasi geolokasi aman.
- **Tindakan**:
  ```sql
  begin;
  alter function public.calculate_haversine_distance_meters(numeric,numeric,numeric,numeric)
    set search_path = pg_catalog;

  revoke execute on function public.get_auth_user_claims() from public, anon;
  revoke execute on function public.create_collection_transaction(...) from public, anon;
  revoke execute on function public.void_collection_transaction(...) from public, anon;
  revoke execute on function public.finalize_patrol_session(...) from public, anon;
  revoke execute on function public.create_reversal_transaction(...) from public, anon;
  revoke execute on function public.create_adjustment_transaction(...) from public, anon;

  grant execute on function public.get_auth_user_claims() to authenticated;
  grant execute on function public.create_collection_transaction(...) to authenticated;
  grant execute on function public.void_collection_transaction(...) to authenticated;
  grant execute on function public.finalize_patrol_session(...) to authenticated;
  grant execute on function public.create_reversal_transaction(...) to authenticated;
  grant execute on function public.create_adjustment_transaction(...) to authenticated;
  commit;
  ```

---

## 5. Status Keamanan Database (Security Advisor Audit)

Berdasarkan audit resmi pada file `supabase/SECURITY_STATUS.md`:
- **Errors**: **0 Errors**.
- **Warnings**: **6 Warnings Terkontrol**.
- **Penjelasan 6 Warning**: Peringatan *"Signed-In Users Can Execute SECURITY DEFINER Function"* sengaja dipertahankan karena fungsi-fungsi RPC tersebut memverifikasi peran organisasi di dalam logika prosedural PL/pgSQL dan sengaja tidak mengizinkan pengguna memutasi tabel ledger secara langsung via REST endpoint umum.

---

## 6. Penyimpanan Data (Storage & Persistence Strategy)

1. **Penyimpanan Cloud (Supabase Storage)**:
   - Disiapkan untuk penyimpanan aset bukti foto posko / lampiran audit jika fitur upload diaktifkan.
2. **Penyimpanan Lokal Gawai (Browser LocalStorage)**:
   - `ronda_house_data`: Salinan luring daftar rumah warga untuk mendukung operasional tanpa sinyal internet.
   - `ronda_verif_list`: Antrean pendaftaran warga tertunda di sisi lokal.
   - `ronda_current_user`: Token sesi dan profil pengguna aktif.
   - Foto avatar profil disimpan sementara sebagai *Base64 Data URL* berukuran maksimal 2 MB di sisi peramban.
