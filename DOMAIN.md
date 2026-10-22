# Domain partacmobil.my.id

Target: satu website. Halaman utama adalah katalog publik. Halaman `kasir.html` adalah sistem kasir dengan login owner/admin. Keduanya memakai database Supabase Rifqy yang sama.

## Status saat persiapan

DNS publik untuk `partacmobil.my.id` masih mengarah ke `103.214.112.181`. GitHub Pages belum memiliki custom domain pada repositori ini. Berkas `CNAME` root belum dipasang agar alamat GitHub yang sudah aktif tetap dapat dibuka sebelum DNS domain siap.

## DNS di IDCloudHost

Masuk portal IDCloudHost, buka domain `partacmobil.my.id`, lalu **DNS Management / DNS Zone Editor** pada pengelola DNS yang aktif. Sesuaikan record A untuk host `@` dengan empat record ini:

| Tipe | Host | Nilai |
| --- | --- | --- |
| A | @ | 185.199.108.153 |
| A | @ | 185.199.109.153 |
| A | @ | 185.199.110.153 |
| A | @ | 185.199.111.153 |
| CNAME | www | sonn19.github.io |

Gunakan TTL default atau 300 jika didukung. Record A `@` lama yang mengarah ke hosting sebelumnya perlu diganti; record MX dan TXT layanan email tidak perlu diubah. Jika host `www` sudah punya record A/CNAME lama, sesuaikan record itu agar tidak bertabrakan. Hindari mengganti nameserver tanpa terlebih dahulu memeriksa penyedia DNS yang aktif.

## GitHub Pages

Setelah DNS siap, buka repositori → **Settings → Pages → Custom domain**, isi `partacmobil.my.id`, lalu Save. GitHub akan membuat berkas root `CNAME` dengan satu baris `partacmobil.my.id`. Setelah pemeriksaan DNS dan sertifikat selesai, aktifkan **Enforce HTTPS**.

## URL konfirmasi Supabase

Pada proyek Rifqy, buka **Authentication → URL Configuration**. Isi Site URL dengan `https://partacmobil.my.id/kasir.html` dan tambahkan URL itu ke Redirect URLs. Selama alamat GitHub masih digunakan, pertahankan juga `https://sonn19.github.io/rifqy-part-ac-mobil/kasir.html` di Redirect URLs.

## Referensi resmi

- [DNS dan custom domain GitHub Pages](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site)
- [Portal IDCloudHost](https://idcloudhost.com/panduan/akses-portal-idcloudhost/)
- [DNS Zone Editor IDCloudHost](https://idcloudhost.com/panduan/cara-edit-dns-zone-domain-idcloudhost/)
