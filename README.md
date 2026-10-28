# Percepatan Rekonstruksi Asmuth–Bloom dengan Algoritme Garner pada Modulus Berdekatan

Program, data hasil, dan halaman web demonstrasi untuk makalah Team Based Project mata kuliah Matematika Diskrit 2,
Fakultas Teknologi Informasi dan Sains Data, Universitas Sebelas Maret, 2026.

Skema pembagian rahasia Asmuth–Bloom membentuk kembali kunci dengan Chinese Remainder Theorem. Program ini
menerapkan tiga modifikasi rekonstruksi tanpa mengubah share (tabel invers berpasangan, Garner dengan selisih
modulus kecil, dan pembagian eksak dengan reduksi Montgomery beradiks hasil kali selisih), pilihan modulus saling
prima yang tidak harus prima, serta pembanding Shamir yang dioptimasi setara.

Hasil pada laptop uji (Intel Core i5-11400H, Windows 11, gcc 16.2.0, GMP 6.3.0; data di folder `results/`):

- Usulan B-eksak 1,39 sampai 15,69 kali lebih cepat daripada Garner dengan inversi dengan modulus prima, dan
  1,56 sampai 24,93 kali dengan modulus saling prima.
- Dengan modulus saling prima, setup Asmuth–Bloom paling lama 4,9 ms, lebih cepat daripada setup Shamir.
- Shamir yang dioptimasi setara tetap lebih cepat pada 13 dari 15 konfigurasi; dengan modulus saling prima,
  Asmuth–Bloom lebih cepat pada L = 2048, k = 3.

## Mulai cepat

Di MSYS2 UCRT64 (Windows) atau Linux, dengan gcc, make, GMP, Python, dan matplotlib:

```
make all
make test      # harus berakhir dengan: Total pemeriksaan: 129669, gagal: 0
make hasil     # semua pengukuran untuk makalah, sekitar 40 sampai 60 menit
```

Halaman web: buka `web/index.html` di browser (tanpa server, tanpa pustaka luar).

## Tim

Keisha Nasywaa Syakira, Ahmad Fahmi Haykal, Unggul Jatu Alfiansyah, Naufal Hafizh Rahman, Diaz Spectral Rabbani.
Dosen pengampu: Shaifudin Zuhdi, M.Cs.

## Lisensi

Kode program: MIT (lihat `LICENSE`). Huruf yang disematkan di `web/fonts.css`: SIL Open Font License 1.1
(lihat `web/LISENSI-HURUF.txt`).

---

# Percepatan rekonstruksi Asmuth-Bloom dengan algoritme Garner pada modulus berdekatan

Program pendukung makalah Team Based Project Matematika Diskrit 2.
Isi: skema Asmuth-Bloom (CRT) dengan tiga cara rekonstruksi, baseline Shamir
dengan dua cara rekonstruksi, uji kebenaran otomatis, dan benchmark yang
menulis hasil mentah ke CSV.

Inti penelitian ada di `src/crt.c` (rumus CRT klasik, Garner dengan inversi,
Garner dengan tabel invers berpasangan, Garner selisih kecil) dan `src/ab.c`.
Semuanya ditulis sendiri. Metode utama adalah usulan B (`crt_garner_diff`,
`ab_reconstruct_diff`): karena modulus berupa prima berurutan, m_b mod m_j = m_b - m_j
kecil, sehingga rekonstruksi cukup memakai perkalian dengan bilangan kecil, satu
inversi bilangan kecil, dan satu perkalian modular per peserta.
Pustaka GMP hanya dipakai untuk aritmetika bilangan besar dasar (tambah, kali,
mod, invers, pembangkitan prima), karena menulis aritmetika 2048 bit dari nol
bukan fokus proyek ini dan akan membuat perbandingan menjadi soal kualitas
aritmetika kami, bukan soal CRT.

## Instalasi (Windows, MSYS2)

1. Pasang MSYS2 dari https://www.msys2.org, lalu buka terminal **UCRT64**.
2. Pasang alat dan pustaka:

       pacman -S --needed mingw-w64-ucrt-x86_64-gcc mingw-w64-ucrt-x86_64-gmp make \
                mingw-w64-ucrt-x86_64-python mingw-w64-ucrt-x86_64-python-matplotlib

3. Masuk ke folder proyek, lalu `make all`. Hasilnya `bin/test.exe`,
   `bin/bench.exe`, `bin/demo.exe`.

Di Linux/WSL: `sudo apt install gcc make libgmp-dev python3-matplotlib`, lalu `make all`.

## Cara menjalankan

    make demo          # contoh hitungan manual dari makalah (angka kecil)
    make test          # uji kebenaran, harus berakhir dengan "gagal: 0"
    make biaya         # biaya perkalian modular dan dua jenis inversi di GMP (Bab 6.2)
    make bench         # benchmark penuh (30 rep x 50 inner) + grafik, 2-5 menit
    make bench-quick   # versi singkat untuk memastikan semuanya jalan

Opsi benchmark lengkap:

    ./bin/bench --reps 30 --inner 50 --warmup 3 --seed 12345 --L 0 --max-n 100 \
                --out results/bench.csv --sizes results/sizes.csv

`--L 256` hanya menjalankan rahasia 256 bit (pilihan: 256, 1024, 2048; 0 = semua).
Satu "rep" adalah rata-rata dari `inner` pemanggilan berurutan pada input yang
sama; ini perlu karena satu rekonstruksi bisa di bawah 1 mikrodetik.
`warmup` pengulangan pertama dibuang. Seed tetap membuat rahasia, share, dan
pilihan subset bisa diulang persis.

Setelah benchmark:

    python scripts/plot_results.py results/bench.csv results/sizes.csv results

menghasilkan `summary.csv`, `summary.md` (tabel siap tempel ke makalah),
`speedup.md` (rasio terhadap metode usulan), `sizes.md`, dan grafik PNG
`recon_L*.png`, `share_L*.png`, `setup_L*.png`.

Saran saat mengukur: colok charger, mode daya "Best performance", tutup
browser dan aplikasi lain, jalankan dua kali dan pakai run kedua.
Catat versi GMP yang tercetak di baris pertama keluaran bench.

## Halaman web

Folder `web/` berisi halaman yang semua perhitungannya berjalan di browser
(JavaScript BigInt), tanpa server dan tanpa internet. Buka dengan klik dua kali
`web/index.html` (disarankan Chrome atau Edge terbaru). Isinya lima tab:

- Demo: parameter, tabel invers, share, langkah rekonstruksi, perbandingan lima metode
- Uji kebenaran: pencocokan dengan program C, uji acak setara test.c, sebaran k - 1 share
- Benchmark browser: eksperimen tambahan, CSV dengan format yang sama dengan bin/bench
- Hasil program C: membaca results/bench.csv dan membandingkan rasio C dengan browser
- Tentang: ringkasan metode dan daftar berkas

`web/js/modulus.js` ditulis oleh program C supaya browser memakai modulus yang
persis sama dengan bin/bench (mencari prima 2049 bit di browser terlalu lambat).
Kalau parameter di program C diubah, tulis ulang dengan `make moduli`.

## Struktur folder

    src/util.c, util.h      pembangkit acak berseed, timer, rata-rata/sd
    src/crt.c, crt.h        INTI: CRT klasik, Garner inversi, Garner + tabel
    src/ab.c, ab.h          skema Asmuth-Bloom: parameter, share, rekonstruksi
    src/shamir.c, shamir.h  baseline Shamir: share, Lagrange biasa, Lagrange batch
    src/test.c              uji kebenaran (kasus acak, tepi, semua subset, uji negatif)
    src/bench.c             benchmark -> results/bench.csv, results/sizes.csv
    src/demo.c              contoh hitungan manual
    src/biaya_inversi.c     biaya perkalian modular, inversi acak, inversi penyebut Lagrange
    src/export_moduli.c     menulis web/js/modulus.js dari program C
    scripts/plot_results.py ringkasan dan grafik
    results/                keluaran (CSV, MD, PNG)
    web/index.html          halaman web; style.css dan js/*.js di folder yang sama

## Metode yang diukur

| nama di CSV     | arti                                                     |
| --------------- | -------------------------------------------------------- |
| ab_diff         | usulan B: Garner selisih kecil, metode utama             |
| ab_table        | usulan A: Garner dengan tabel invers berpasangan, 0 inversi |
| ab_garner_inv   | Garner inkremental, k-1 inversi dihitung saat rekonstruksi |
| ab_classic      | rumus CRT klasik seperti paper Asmuth-Bloom, k inversi   |
| shamir_naive    | Lagrange dengan k inversi                                |
| shamir_batch    | Lagrange dengan 1 inversi (trik Montgomery)              |
| shamir_small    | Lagrange bilangan kecil, dioptimasi setara usulan B      |
| ab_diff_exact   | usulan B dengan pembagian eksak (saran 7.2 makalah)      |
| shamir_exact    | Shamir dengan pembagian eksak, pembanding setara         |
| ab_share        | pembuatan n share Asmuth-Bloom                           |
| shamir_share    | pembuatan n share Shamir                                 |
| *_setup         | pembangkitan parameter, diukur sekali per konfigurasi    |

Kolom CSV: `method,phase,L,k,n,rep,inner,us_per_op` (mikrodetik per operasi).

Identitas kelompok yang tampil di halaman web (nama kelompok, anggota, universitas,
dosen) diisi di `web/js/identitas.js`; bagian yang kosong tidak ditampilkan. Hasil
benchmark program C yang tampil di tab Hasil program C ada di `web/js/hasil_c.js`.

## Versi 2: pembanding setara, statistik, dan analisis tambahan

Perubahan utama dibanding versi sebelumnya:

- Pembanding Shamir yang dioptimasi setara dengan usulan B (`sh_reconstruct_small`), dan pembagian eksak
  untuk usulan B maupun Shamir (`crt_bagi_eksak`, `ab_reconstruct_diff_exact`, `sh_reconstruct_exact`).
  Pembagian eksak punya tiga jalur: satu word (|D| < 2^30, aman untuk `unsigned long` 32 bit di Windows),
  mpz (|D| paling banyak separuh lebar modulus), dan cara lama bila D sudah sebesar modulus.
- `bin/bench` mengacak urutan metode setiap pengulangan dengan pembangkit terpisah (rahasia dan subset tetap
  sama), mencetak median dan kuartil, dan punya paket tambahan: `--paket tambahan` (n tetap, k = n,
  L lebih rapat, data dingin) ke `results/tambahan.csv`.
- `bin/rincian`: waktu usulan B per tahap, ukuran bit s dan D, penyebut Shamir, dan porsi jalur pembagian eksak.
- `bin/keamanan`: nilai eps kebocoran k - 1 share untuk parameter benchmark dan pengaruh margin.
- `bin/test`: metode baru, konfigurasi L = 1024, k = n, dan k = 50, uji kebocoran semua pasangan peserta
  dengan jarak statistik, dan pemeriksaan bahwa ketiga jalur pembagian eksak teruji.
  `make test-jalur` mengulang uji dengan jalur dipaksa; `make test-sanitasi` untuk Linux atau WSL.
- `scripts/plot_results.py`: median [kuartil], rasio berpasangan per pengulangan dengan interval kepercayaan
  95% bootstrap, tabel Asmuth-Bloom tercepat lawan Shamir tercepat (`ab_vs_shamir.md`), dan ringkasan
  `tambahan.md`, `rincian.md`, `keamanan.md`.
- `scripts/buat_hasil_js.py` (`make web MESIN="..."`) menulis `web/js/hasil_c.js` dari `results/`.
- `ab_params_init` tidak lagi memperbesar margin bila syarat gagal, karena margin yang lebih besar menaikkan eps.

Semua pengukuran untuk makalah: `make hasil` (sekitar 15 menit), lalu
`make web MESIN="merek laptop, memori, Windows"`.


## Versi 3: ambang terkalibrasi, modulus saling prima, dan tiga run

- Ambang jalur GMP pada pembagian eksak tidak lagi "separuh panjang modulus", tetapi diukur di mesin yang
  menjalankan (`crt_kalibrasi_eksak`, dipanggil lewat `ab_params_kalibrasi` dan `sh_params_kalibrasi`, di luar
  waktu setup). Ambang hasil kalibrasi dicetak di log dan dicatat di kolom terakhir `sizes.csv`.
- `ab_params_init_koprima`: modulus saling prima yang tidak harus prima, dipilih rakus dari bilangan ganjil
  di dekat 2^L + 2^(L/2) (gcd(B + a, B + b) membagi a - b). Diuji di `bin/test`, diukur dengan
  `bin/bench --paket koprima`, `bin/rincian --koprima`, dan bagian ketiga `bin/keamanan`.
- `bin/bench --inti N` mengunci proses pada core N dengan prioritas tinggi.
- `make hasil` sekarang menjalankan benchmark utama tiga kali secara terpisah (`bench.csv`, `bench_run2.csv`,
  `bench_run3.csv`), paket koprima, dan paket tambahan; `plot_results.py` menulis juga `koprima.md`,
  `stabilitas.md`, dan `rincian_koprima.md`. Lama seluruhnya sekitar 40 sampai 60 menit.
