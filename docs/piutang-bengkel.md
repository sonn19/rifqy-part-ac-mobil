# Modul Piutang Bengkel — rancangan implementasi

Status: **belum aktif di produksi**. Jangan menerima bon melalui checkout yang sekarang: API `rifqy.write('checkout')` masih mewajibkan `paid >= total`.

## Aturan bisnis
- Pelanggan wajib terdaftar sebagai `Bengkel` untuk transaksi bon.
- Satu saldo bon per bengkel, nota tetap individual dan immutable.
- Pembayaran sebagian dan pelunasan disimpan sebagai transaksi pembayaran terpisah, bukan mengubah total nota.
- Pembayaran bon gabungan dialokasikan ke nota tertua (FIFO), kecuali admin memilih pembayaran nota baru secara eksplisit.
- Stok dikurangi sekali saat nota diterbitkan, tidak saat pelunasan.
- Idempotency key wajib untuk checkout, pembayaran, dan retur agar retry tidak menggandakan transaksi.
- Piutang = jumlah tagihan nota bon - alokasi pembayaran - kredit retur; jangan menghitung omzet berdasarkan uang masuk dua kali.
- Piutang dan riwayat pembayaran hanya terlihat oleh owner/admin terverifikasi. Harga beli dan laba hanya owner.
- Ongkir dan diskon harus diverifikasi server. Validasi harga, stok, saldo pembayaran, dan kredit dalam transaksi database dengan locking.
- Simpan jatuh tempo per nota, batas kredit opsional per bengkel; pengecualian kredit memerlukan owner.
- Pembayaran tidak boleh negatif atau melebihi piutang kecuali ada alur saldo titipan yang dirancang khusus.
- Tidak boleh menghapus pembayaran/nota; koreksi melalui reversal dengan audit trail.

## Rencana skema
1. Tambahkan `customer_id`, `discount`, `due_date` pada `rifqy.orders`; pertahankan data lama.
2. Buat `rifqy.credit_payments` dengan ID idempoten, customer_id, amount, method, paid_at, actor, note.
3. Buat `rifqy.credit_allocations` (payment_id, order_id, amount), unik per pasangan, dengan pemeriksaan jumlah alokasi dan saldo nota.
4. Tambahkan `credit_limit` pada pelanggan bengkel (default tanpa batas atau 0 sesuai keputusan owner).
5. Perluas RPC terautentikasi `rifqy.write` untuk checkout bon, pembayaran bon, dan koreksi, serta `rifqy.state` untuk saldo/riwayat.
6. Tambahkan layar kasir cash/bon/DP, kartu piutang bengkel, pembayaran gabungan, dan laporan umur piutang.
7. Uji transaksi penuh, pembayaran sebagian, alokasi FIFO, duplikasi retry, stok negatif, akses admin/owner, serta transaksi konkuren.

## Catatan integrasi
`cloud.js` saat ini mengirim checkout tanpa shipping/discount, sedangkan `app.js` sudah menghitung penyesuaian tersebut. Perbaiki keduanya bersama API sebelum mengaktifkan checkout bon.
