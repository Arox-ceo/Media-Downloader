# Cara memasang

1. Ekstrak ZIP ini.
2. Upload seluruh isinya ke repository GitHub, termasuk folder `public`, `.github`, dan file backend.
3. Buka Settings → Pages → pilih GitHub Actions.
4. Buka Actions, jalankan "Publish website to GitHub Pages", tunggu selesai.
5. Buka link hasil deployment. Tampilan web sudah bisa diakses orang lain.

## Agar YouTube, Instagram, Pinterest bisa download

GitHub Pages hanya menjalankan tampilan. Backend harus berjalan di server/komputer yang bisa diakses lewat HTTPS. Proyek ini belum mempunyai alamat backend publik.

- Isi alamat backend di `public/config.js`.
- Pada backend, isi `FRONTEND_ORIGIN` dengan origin GitHub Pages, misalnya `https://namaakun.github.io` (tanpa nama repository).
- Simpan dan deploy ulang. Cari tulisan "Video service connected".

TikTok memakai layanan TikWM dari web sebelumnya; ketersediaannya bergantung layanan tersebut.

## Yang didukung

- YouTube: video dan Shorts, pilihan video atau MP3.
- TikTok: video, audio, foto.
- Instagram: Reel/post video publik.
- Pinterest: Pin video.

Foto Instagram/Pinterest, akun privat, login, dan live belum didukung. Ini bukan layanan tanpa batas; dua proses video sekaligus dan maksimum sepuluh job yang disimpan.

## Hasil pengujian versi ini

- Tes otomatis validasi link, CORS untuk GitHub Pages, sesi terpisah dan akses file: lolos.
- UI satu kolom dan pencarian video YouTube: berhasil di browser lokal.
- Metadata Pinterest dan download satu video Pinterest: berhasil; hasil 5.196.022 byte.
- Akses file dari sesi pengunjung lain: ditolak (404).
- Download Instagram, TikTok, Docker hosting, dan deployment GitHub Pages belum diuji end-to-end pada versi ini.

Panduan teknis lengkap ada di README.md. Jangan menganggap upload ZIP ke GitHub akan langsung menyalakan backend.
