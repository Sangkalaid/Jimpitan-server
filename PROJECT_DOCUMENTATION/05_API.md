# 05. Spesifikasi API & Kontrak Data (API Specifications)

Dokumen ini mendokumentasikan seluruh kontrak antarmuka pemrograman aplikasi (API), baik antarmuka jaringan HTTP/REST Supabase, saluran WebSocket Realtime, maupun antarmuka jembatan perangkat keras (*Native Android Bridge*).

---

## 1. REST API Supabase (PostgREST Gateway)

Seluruh panggilan REST diarahkan ke host Supabase Cloud:
- **Base URL**: `https://riehidioeftegpkndxok.supabase.co/rest/v1`
- **Header Standar**:
  ```http
  apikey: <SUPABASE_ANON_KEY>
  Authorization: Bearer <SUPABASE_ANON_KEY>
  Content-Type: application/json
  Prefer: return=representation
  ```

---

### 1.1 Endpoint Rumah Warga (`/houses`)

#### A. Mengambil Seluruh Rumah Warga
- **Metode**: `GET`
- **Path**: `/houses?select=*&order=id.asc`
- **Response `200 OK`**:
```json
[
  {
    "id": 1,
    "no_rumah": "No. 01",
    "nama_warga": "Bambang Pamungkas",
    "phone": "081234567890",
    "gang": "Gang Mawar",
    "status_jimpitan": "pasang",
    "nominal": 500,
    "waktu_terakhir": "21:30 WIB",
    "last_location": {
      "latitude": -7.778512,
      "longitude": 110.354201,
      "accuracy": 3
    }
  }
]
```

#### B. Menambahkan Rumah Warga Baru (Hasil Persetujuan RT)
- **Metode**: `POST`
- **Path**: `/houses`
- **Request Body**:
```json
{
  "no_rumah": "No. 17",
  "nama_warga": "Budi Santoso",
  "phone": "081388991234",
  "gang": "Gang Dahlia",
  "status_jimpitan": "pasang",
  "nominal": 500,
  "waktu_terakhir": "Baru saja"
}
```
- **Response `201 Created`**: Mengembalikan objek data rumah yang baru terdaftar.

#### C. Memperbarui Status Jimpitan Rumah
- **Metode**: `PATCH`
- **Path**: `/houses?no_rumah=eq.No.%2001`
- **Request Body**:
```json
{
  "status_jimpitan": "kosong",
  "waktu_terakhir": "22:45 WIB"
}
```
- **Response `200 OK`**: Status rumah diperbarui menjadi kosong/pasang.

---

### 1.2 Endpoint Pendaftaran Warga (`/residents`)

#### A. Mengambil Daftar Pengajuan Warga
- **Metode**: `GET`
- **Path**: `/residents?select=*&order=id.desc`
- **Response `200 OK`**:
```json
[
  {
    "id": "c1f7b029-4d61-41f3-8b74-123456789abc",
    "nama": "Hendro Utomo",
    "phone": "081299001122",
    "status_hunian": "Rumah Pribadi",
    "pin": "123456",
    "status_verifikasi": "pending",
    "created_at": "2026-09-17T10:15:00Z"
  }
]
```

#### B. Mengajukan Pendaftaran Akun Warga Baru
- **Metode**: `POST`
- **Path**: `/residents`
- **Request Body**:
```json
{
  "nama": "Siti Rahayu",
  "phone": "081377889900",
  "status_hunian": "Kontrak",
  "pin": "654321",
  "status_verifikasi": "pending"
}
```
- **Response `201 Created`**: Konfirmasi permohonan masuk ke antrean verifikasi RT.

#### C. Memperbarui Keputusan Verifikasi RT (Setujui / Tolak)
- **Metode**: `PATCH`
- **Path**: `/residents?phone=eq.081377889900`
- **Request Body**:
```json
{
  "status_verifikasi": "approved"
}
```
- **Response `200 OK`**: Mengembalikan objek pemohon dengan status terbaru.

---

### 1.3 Endpoint Audit Transaksi Kas (`/jimpitan_transactions`)

#### A. Mencatat Transaksi Setoran Kas
- **Metode**: `POST`
- **Path**: `/jimpitan_transactions`
- **Request Body**:
```json
{
  "no_rumah": "No. 05",
  "nama_warga": "Budi Santoso",
  "status": "pasang",
  "nominal": 500,
  "recorded_by": "BAPAK BAMBANG"
}
```
- **Response `201 Created`**: Catatan jurnal kas tersimpan di buku besar audit.

---

## 2. API Remote Procedure Call (RPC PostgreSQL)

Endpoint RPC dieksekusi melalui sub-jalur `/rest/v1/rpc/<function_name>`.

### 2.1 Kalkulasi Jarak Haversine
- **Path**: `POST /rest/v1/rpc/calculate_haversine_distance_meters`
- **Request Body**:
```json
{
  "lat1": -7.778500,
  "lon1": 110.354200,
  "lat2": -7.778550,
  "lon2": 110.354250
}
```
- **Response `200 OK`**:
```json
7.82
```

### 2.2 Pencatatan Transaksi Koleksi Jimpitan Terverifikasi
- **Path**: `POST /rest/v1/rpc/create_collection_transaction`
- **Header Wajib**: `Authorization: Bearer <USER_JWT>`
- **Request Body**:
```json
{
  "p_session_id": "9a38f712-8812-4c6e-8ff5-b9b2d87e0291",
  "p_house_no": "No. 08",
  "p_house_id": "3e4f71a0-1234-5678-9abc-def012345678",
  "p_collector_id": "7b8c9d0e-1111-2222-3333-444455556666",
  "p_status": "pasang",
  "p_amount": 500,
  "p_recorded_at": "2026-09-17T22:30:00Z",
  "p_latitude": -7.778510,
  "p_longitude": 110.354210,
  "p_accuracy": 3.2
}
```
- **Response `200 OK`**: ID transaksi yang berhasil dibuat dalam format UUID.

---

## 3. Saluran WebSocket Supabase Realtime

- **URL Koneksi**: `wss://riehidioeftegpkndxok.supabase.co/realtime/v1/websocket?apikey=<SUPABASE_ANON_KEY>&vsn=1.0.0`
- **Protokol**: Phoenix Channel Wire Protocol.
- **Topik Saluran**: `realtime:ronda-realtime-sync`

### Alur Pesan Masuk (Event Inbound):
Ketika terjadi perubahan pada PostgreSQL:
```json
{
  "topic": "realtime:ronda-realtime-sync",
  "event": "postgres_changes",
  "payload": {
    "schema": "public",
    "table": "houses",
    "commit_timestamp": "2026-09-17T22:31:00Z",
    "eventType": "UPDATE",
    "new": { "id": 8, "status_jimpitan": "pasang", "waktu_terakhir": "22:30 WIB" },
    "old": { "id": 8 }
  }
}
```
Klien web menangkap event ini dan langsung mengeksekusi `fetchSupabaseData()`.

---

## 4. Antarmuka Jembatan Android Native (`AndroidBridge`)

Ketika aplikasi berjalan di dalam container WebView Android, objek native `window.AndroidBridge` diinjeksi ke global runtime JavaScript:

| Nama Metode JavaScript | Tipe Parameter | Return | Deskripsi Operasional |
|---|---|---|---|
| `vibrate(milliseconds)` | `Long` (durasi getar, cth: 40) | `void` | Memicu motor getar haptic ponsel |
| `authenticateBiometric()` | *None* | `void` | Membuka prompt dialog sidik jari OS Android |
| `shareWhatsApp(phone, msg)`| `String, String` | `void` | Mengirim pesan langsung via aplikasi WhatsApp |
| `shareReport(text)` | `String` (teks laporan) | `void` | Membuka Android Share Sheet pemilih aplikasi |
| `showToast(message)` | `String` (isi notifikasi) | `void` | Menampilkan pesan Toast abu-abu native di layar bawah |
| `sendNotification(title, msg)` | `String, String` | `void` | Menerbitkan notifikasi lokal pada status bar ponsel |
| `exitApp()` | *None* | `void` | Menghentikan activity dan menutup aplikasi secara tuntas |
