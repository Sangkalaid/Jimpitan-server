# Status pemeriksaan Supabase — 16 September 2026

Proyek: riehidioeftegpkndxok (Jimpitan).

Migrasi 202609160001 dan 202609160002 telah dijalankan melalui SQL Editor.
SQL Editor mengembalikan `Success. No rows returned`.

Hasil Security Advisor sesudah migrasi kedua: 0 errors, 6 warnings
(sebelumnya 0 errors, 13 warnings).

Enam fungsi RPC aplikasi telah diverifikasi lewat katalog PostgreSQL:
akses EXECUTE anonim ditolak dan akses authenticated tetap tersedia.
Fungsi jarak menghasilkan 0.00 untuk titik identik, 111194.93 meter untuk
satu derajat bujur di ekuator, dan NULL untuk lintang tidak valid.
Query pemeriksaan tersedia di verify_rpc_security.sql.

Enam warning tersisa adalah `Signed-In Users Can Execute SECURITY DEFINER
Function`. Akses ini dipertahankan karena transaksi memakai RPC dengan
pemeriksaan role/organisasi dan tidak mengizinkan mutasi ledger langsung.
get_auth_user_claims dipakai oleh RLS untuk membaca identitas pengguna aktif.
Warning tidak disembunyikan atau diabaikan di dashboard.

Batas verifikasi: ini menguji izin fungsi dan perhitungan jarak, bukan
pengujian menyeluruh lintas akun/organisasi atau transaksi finansial.
Pemeriksaan isi fungsi mengacu pada migrasi c3_remediated_full_schema.
Integrasi aplikasi masih memerlukan Supabase Auth dan penyesuaian kolom/RPC
agar sesuai dengan skema online; login lokal saat ini belum layak produksi.
