# Modulus saling prima yang tidak harus prima

Paket `bin/bench --paket koprima`: konfigurasi sama dengan paket utama, tetapi modulus dipilih rakus dari bilangan ganjil di dekat 2^L + 2^(L/2) yang saling prima. Median dalam mikrodetik; rasio prima / koprima dihitung dari median kedua run (tidak berpasangan).

| L | (k, n) | B-eksak koprima | prima / koprima | B koprima | prima / koprima | A koprima | prima / koprima | setup AB prima (ms) | setup AB koprima (ms) | setup Shamir (ms) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 256 | (3, 5) | 1.05 | 1.06 | 1.35 | 1.06 | 1.02 | 1.04 | 2.24 | 0.03 | 0.46 |
| 256 | (5, 10) | 2.04 | 1.18 | 2.64 | 1.02 | 2.57 | 0.96 | 3.39 | 0.02 | 0.40 |
| 256 | (10, 20) | 5.04 | 1.37 | 5.48 | 1.18 | 7.84 | 1.02 | 7.40 | 0.06 | 0.41 |
| 256 | (20, 40) | 15.6 | 1.28 | 15.1 | 1.27 | 29.7 | 0.99 | 14.3 | 0.19 | 0.40 |
| 256 | (50, 100) | 77.7 | 1.16 | 76.8 | 1.16 | 181.3 | 1.00 | 35.7 | 1.13 | 0.40 |
| 1024 | (3, 5) | 1.37 | 1.05 | 2.43 | 1.01 | 2.69 | 0.99 | 63.7 | 0.01 | 17.2 |
| 1024 | (5, 10) | 2.64 | 1.21 | 4.67 | 1.04 | 8.20 | 0.99 | 153.1 | 0.02 | 17.2 |
| 1024 | (10, 20) | 6.61 | 1.42 | 10.4 | 1.16 | 33.7 | 1.01 | 375.4 | 0.11 | 17.4 |
| 1024 | (20, 40) | 20.5 | 1.42 | 26.6 | 1.23 | 139.6 | 1.01 | 626.2 | 0.36 | 18.5 |
| 1024 | (50, 100) | 110.5 | 1.63 | 117.2 | 1.50 | 892.8 | 1.00 | 1,601 | 2.41 | 17.4 |
| 2048 | (3, 5) | 1.77 | 1.08 | 4.70 | 1.04 | 6.99 | 1.02 | 784.3 | 0.02 | 128.0 |
| 2048 | (5, 10) | 3.53 | 1.15 | 9.34 | 1.02 | 22.5 | 1.00 | 1,584 | 0.05 | 128.2 |
| 2048 | (10, 20) | 8.82 | 1.37 | 21.2 | 1.10 | 98.2 | 1.01 | 2,619 | 0.20 | 140.3 |
| 2048 | (20, 40) | 27.7 | 1.37 | 51.8 | 1.13 | 407.2 | 1.01 | 5,110 | 0.88 | 133.1 |
| 2048 | (50, 100) | 140.6 | 1.62 | 193.1 | 1.37 | 2,613 | 1.01 | 15,822 | 4.88 | 130.0 |

## Asmuth-Bloom tercepat lawan Shamir tercepat dengan modulus saling prima

| L | (k, n) | Asmuth-Bloom tercepat | Shamir tercepat | rasio Shamir / AB | kesimpulan |
| --- | --- | --- | --- | --- | --- |
| 256 | (3, 5) | Usulan A: Garner + tabel | Shamir bilangan kecil | 0.93 [0.92-0.96] | Shamir lebih cepat |
| 256 | (5, 10) | Usulan B + pembagian eksak | Shamir bilangan kecil | 0.81 [0.80-0.83] | Shamir lebih cepat |
| 256 | (10, 20) | Usulan B + pembagian eksak | Shamir bilangan kecil | 0.64 [0.63-0.65] | Shamir lebih cepat |
| 256 | (20, 40) | Usulan B: Garner selisih | Shamir bilangan kecil | 0.64 [0.63-0.64] | Shamir lebih cepat |
| 256 | (50, 100) | Usulan B: Garner selisih | Shamir bilangan kecil | 0.85 [0.83-0.85] | Shamir lebih cepat |
| 1024 | (3, 5) | Usulan B + pembagian eksak | Shamir + pembagian eksak | 1.03 [0.97-1.06] | setara |
| 1024 | (5, 10) | Usulan B + pembagian eksak | Shamir + pembagian eksak | 0.96 [0.95-0.98] | Shamir lebih cepat |
| 1024 | (10, 20) | Usulan B + pembagian eksak | Shamir + pembagian eksak | 0.76 [0.74-0.77] | Shamir lebih cepat |
| 1024 | (20, 40) | Usulan B + pembagian eksak | Shamir bilangan kecil | 0.75 [0.74-0.76] | Shamir lebih cepat |
| 1024 | (50, 100) | Usulan B + pembagian eksak | Shamir bilangan kecil | 0.76 [0.75-0.76] | Shamir lebih cepat |
| 2048 | (3, 5) | Usulan B + pembagian eksak | Shamir + pembagian eksak | 1.09 [1.06-1.11] | Asmuth-Bloom lebih cepat |
| 2048 | (5, 10) | Usulan B + pembagian eksak | Shamir + pembagian eksak | 0.98 [0.98-1.00] | Shamir lebih cepat |
| 2048 | (10, 20) | Usulan B + pembagian eksak | Shamir + pembagian eksak | 0.77 [0.77-0.78] | Shamir lebih cepat |
| 2048 | (20, 40) | Usulan B + pembagian eksak | Shamir + pembagian eksak | 0.78 [0.77-0.80] | Shamir lebih cepat |
| 2048 | (50, 100) | Usulan B + pembagian eksak | Shamir + pembagian eksak | 0.84 [0.82-0.85] | Shamir lebih cepat |

Jumlah konfigurasi: Asmuth-Bloom lebih cepat 1, Shamir lebih cepat 13, setara 1
