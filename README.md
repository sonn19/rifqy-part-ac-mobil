# Rifqy Part AC Mobil

Aplikasi kasir dan pengelolaan spare part AC mobil. Tampilan statis HTML/CSS/JavaScript; data toko dan login menggunakan proyek Supabase terpisah.

## Menjalankan dan menghosting

File aplikasi pada root repositori siap dilayani oleh hosting statis atau GitHub Pages. Tidak memerlukan proses build. URL proyek Supabase dan publishable key di `cloud.js` memang bersifat publik. Jangan pernah menambahkan service role/secret key ke folder ini atau Git.

Supabase JS 2.118.0 disertakan dalam `vendor/` dengan versi tetap agar tidak bergantung pada CDN saat aplikasi berjalan. Font memiliki fallback sistem.

## Login pertama

1. Buka aplikasi dan pilih **Pertama kali? Daftar akun**.
2. Gunakan email owner yang sudah diizinkan di `rifqy.members`, lalu tentukan kata sandi sendiri.
3. Verifikasi email melalui email Supabase. Kembali ke aplikasi dan masuk.
4. Data toko online dimulai kosong; data contoh hanya muncul pada **Coba demo tanpa login**.
5. Owner membuka **Akses admin** untuk menambahkan email admin; admin mendaftar dan memverifikasi emailnya sendiri.

Sebelum onboarding admin atau menggunakan pemulihan kata sandi, atur **Authentication → URL Configuration** di Supabase: Site URL = alamat hosting aktif, tambahkan URL tersebut pada Redirect URLs. Tambahkan domain baru saat berpindah hosting. Atur SMTP untuk pengiriman email ke alamat admin/pelanggan di luar email yang diizinkan penyedia email bawaan Supabase. Jangan menonaktifkan konfirmasi email: akses toko bergantung pada identitas email terverifikasi.

## Data dan akses

`database/schema.sql` adalah skrip instalasi untuk database kosong, bukan skrip yang dijalankan ulang pada produksi. Skema telah dipasang di proyek Rifqy. Semua tabel bisnis berada dalam skema `rifqy`, RLS aktif dan akses tabel langsung ditolak. Dua wrapper RPC di `public` berjalan sebagai invoker dan memanggil implementasi privat dengan pemeriksaan akun terverifikasi dan keanggotaan toko pada setiap permintaan.

- Owner: katalog/harga, pelanggan, stok, kasir, laporan harga beli/laba, ekspor cadangan, akses admin.
- Admin: pelanggan, stok, kasir. API tidak mengirim harga beli dan biaya snapshot ke admin.
- Tidak ada login: tidak mendapat akses data bisnis. Mode demo terpisah memakai browser.

Checkout memakai harga dari server, mengunci stok dalam urutan ID stabil, menyimpan snapshot harga beli/jual, menolak stok negatif, mengecek perubahan total, dan memakai ID permintaan untuk mencegah transaksi ganda saat retry. Perubahan stok dan pencatatan transaksi berjalan dalam satu transaksi database.

Data dari perangkat lain diambil melalui **Muat ulang data**. Versi ini belum memakai pembaruan realtime. Ekspor cadangan online tersedia untuk owner; pemulihan cadangan toko online belum tersedia. Cadangan dan data demo tetap dapat dipulihkan di mode demo. Pembayaran Tunai/Transfer/QRIS hanya dicatat; belum terhubung payment gateway.

## Validasi

- `node --check app.js` dan `node --check cloud.js`.
- Uji database dalam transaksi yang di-rollback: checkout harga bengkel, pengurangan stok, snapshot biaya, idempotensi, penambahan stok, penolakan stok negatif, penolakan edit katalog oleh admin, dan penghilangan biaya dari respons admin.
- Pemeriksaan hak akses: anon tidak dapat memanggil RPC; authenticated tidak dapat membaca tabel privat langsung.
- Pemeriksaan UI: halaman login, formulir pendaftaran, mode demo, kasir, penghitungan kembalian, perubahan stok, pencarian, penyimpanan lokal setelah reload.

Pengujian login akun owner sampai berhasil masuk memerlukan pemilik membuat dan memverifikasi akunnya. Tidak ada kata sandi owner yang dibuat atau disimpan oleh pengembang.

## Aktifkan GitHub Pages

Buka **Settings → Pages** pada repositori ini. Pada **Build and deployment**, pilih **Deploy from a branch**, branch **main**, folder **/(root)**, lalu **Save**. Tunggu GitHub menampilkan alamat publikasi berhasil.

Setelah alamat GitHub Pages aktif, atur **Authentication → URL Configuration** pada proyek Supabase Rifqy. Isi **Site URL** dengan alamat lengkap aplikasi (termasuk path repositori bila ada), dan tambahkan alamat yang sama pada **Redirect URLs**. Saat domain sendiri dipasang, tambahkan alamat domain tersebut juga.

Untuk domain sendiri, tentukan nama domain/subdomain terlebih dahulu, lalu atur **Custom domain** pada GitHub Pages dan DNS sesuai petunjuk GitHub. Domain aktif: https://partacmobil.my.id/ (lihat `CNAME`).

Repositori publik hanya berisi kode dan konfigurasi publishable key. Data barang, harga beli, transaksi, akun, dan kata sandi tidak disimpan di GitHub. Binding email owner untuk instalasi baru harus dilakukan secara privat di SQL Editor; email owner tidak ditanam dalam skrip publik. Proyek Supabase Rifqy yang sudah aktif telah memiliki binding owner.

## Katalog publik + kasir dalam satu website

- `index.html`, `catalog.css`, `catalog.js`: katalog yang bisa dibuka tanpa login; pencarian, filter kategori/merek/ketersediaan, pengurutan harga, dan detail barang.
- `kasir.html`, `app.js`, `cloud.js`, `style.css`: sistem owner/admin di alamat yang sama melalui tombol kecil **Login Kasir**.
- Katalog mengambil semua barang dari API `rifqy_catalog`. Hanya kode part, nama, merek, kategori, harga retail, status tersedia/tidak tersedia, dan kecocokan terverifikasi yang dipublikasikan. Jumlah stok persis, lokasi rak, harga beli, harga bengkel, akun, dan transaksi tidak dikirim oleh API publik.
- Database asli tidak diisi contoh produk. Barang yang dimasukkan owner ke katalog kasir tampil di website saat katalog dimuat ulang.
- Untuk instalasi database baru: jalankan `database/schema.sql`, lalu `database/public-catalog.sql`, dan provision email owner secara privat. Pada proyek Rifqy yang aktif, keduanya sudah dipasang.
- Redirect email pendaftaran diarahkan ke `kasir.html`; tambahkan URL lengkap halaman kasir pada daftar Redirect URLs Supabase.
- Konfigurasi domain IDCloudHost ada di [DOMAIN.md](DOMAIN.md).

Validasi tambahan: akses katalog sebagai anon diuji dalam transaksi rollback untuk memastikan harga beli/harga bengkel/stok persis tidak terbuka, kecocokan yang belum diverifikasi tidak dipublikasikan, dan API kasir tetap terlindungi. Uji katalog juga mencakup render, pencarian kode, filter kategori/ketersediaan, pengurutan harga, dan escaping teks produk.

Catatan pengaturan Auth: pemeriksaan Supabase menandai proteksi kata sandi bocor belum aktif. Pengaturan dan panduannya tersedia di [Password strength and leaked password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

## Scan dan label barcode

- Katalog publik dibuat ringkas: cari barang, kategori, filter dan harga retail.
- Saat menambah barang, pilih **Scan kamera** untuk mengisi kode SKU dari barcode kemasan. Formulir lain tetap tersimpan saat kamera dibuka. Barang tanpa barcode dapat memakai **Buat kode sendiri**.
- Tombol **Scan kode** pada katalog publik, daftar barang, dan kasir mencari SKU yang sama; scan di kasir belum otomatis memasukkan barang ke keranjang.
- Tombol **Barcode** pada daftar barang menampilkan ulang kode tersimpan, menyiapkan 1–48 label CODE128, dan mencetak/menyimpan PDF. Harga retail opsional. Uji satu label dengan skala 100% sebelum mencetak banyak.
- Kamera memerlukan HTTPS, izin kamera, dan browser HP yang mendukung getUserMedia. Ada input manual jika kamera tidak tersedia. Frame kamera diproses di perangkat, tidak diunggah.
- Decoder ZXing Browser 0.2.1 dimuat saat scan dibuka. Label memakai JsBarcode 3.12.3. Keduanya disimpan di `vendor/` beserta lisensi MIT. Tidak ada perubahan skema database: barcode memakai SKU yang sudah ada.
- Validasi: pemeriksaan sintaks JS, encode/decode CODE128 dengan tiga kode (termasuk angka 13 digit), input kode, pencarian ulang, pelestarian isian formulir, dan persiapan label dengan harga melalui demo terpisah. Kamera fisik HP dan hasil cetak fisik masih perlu diuji di perangkat pengguna.
