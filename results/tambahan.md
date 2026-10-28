# Eksperimen tambahan

Median (mikrodetik). Rasio memakai pasangan per pengulangan.

## n tetap = 100

| L | (k, n) | Usulan B: Garner selisih | Usulan B + pembagian eksak | Usulan A: Garner + tabel | Garner dengan inversi | Asmuth-Bloom klasik | Shamir biasa | Shamir batch | Shamir bilangan kecil | Shamir + pembagian eksak |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 256 | (3, 100) | 1.47 | 1.15 | 1.07 | 1.82 | 2.18 | 1.69 | 2.76 | 1.02 | 1.13 |
| 256 | (5, 100) | 2.82 | 2.64 | 2.69 | 3.47 | 4.71 | 3.58 | 5.32 | 1.75 | 1.97 |
| 256 | (10, 100) | 6.68 | 7.34 | 8.14 | 9.88 | 14.3 | 9.89 | 13.4 | 3.69 | 5.42 |
| 256 | (20, 100) | 19.7 | 20.9 | 29.6 | 32.3 | 50.5 | 33.0 | 37.0 | 11.7 | 16.6 |
| 256 | (50, 100) | 88.5 | 90.8 | 177.2 | 166.0 | 260.1 | 186.4 | 200.6 | 65.6 | 77.3 |
| 2048 | (3, 100) | 4.82 | 2.09 | 7.09 | 9.98 | 18.5 | 6.62 | 11.4 | 4.06 | 2.14 |
| 2048 | (5, 100) | 9.64 | 4.40 | 22.7 | 31.9 | 57.1 | 14.0 | 20.7 | 6.38 | 3.62 |
| 2048 | (10, 100) | 23.7 | 13.5 | 98.7 | 137.1 | 252.3 | 33.4 | 49.6 | 12.1 | 8.44 |
| 2048 | (20, 100) | 59.7 | 40.4 | 408.5 | 557.2 | 1,021 | 87.9 | 128.2 | 31.3 | 26.5 |
| 2048 | (50, 100) | 272.1 | 237.5 | 2,951 | 4,006 | 7,235 | 391.0 | 514.0 | 129.4 | 124.1 |

Pengaruh n: median pada n = 100 dibagi median pada konfigurasi paket utama dengan k yang sama.

| L | k | Usulan B: Garner selisih | Usulan B + pembagian eksak | Usulan A: Garner + tabel | Garner dengan inversi | Asmuth-Bloom klasik | Shamir biasa | Shamir batch | Shamir bilangan kecil | Shamir + pembagian eksak |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 256 | 3 | 1.03 | 1.02 | 1.00 | 1.11 | 1.05 | 1.12 | 1.10 | 1.07 | 1.13 |
| 256 | 5 | 1.05 | 1.09 | 1.09 | 1.01 | 1.04 | 1.12 | 1.06 | 1.06 | 1.08 |
| 256 | 10 | 1.04 | 1.07 | 1.01 | 1.04 | 1.04 | 1.03 | 1.00 | 1.11 | 1.50 |
| 256 | 20 | 1.03 | 1.05 | 1.01 | 1.02 | 1.00 | 1.05 | 0.99 | 1.20 | 1.23 |
| 256 | 50 | 1.00 | 1.00 | 0.98 | 1.01 | 1.00 | 0.99 | 0.99 | 1.01 | 0.99 |
| 2048 | 3 | 0.98 | 1.09 | 1.00 | 0.98 | 0.98 | 1.70 | 1.43 | 0.99 | 1.09 |
| 2048 | 5 | 1.01 | 1.08 | 1.01 | 1.01 | 1.01 | 1.32 | 1.07 | 1.02 | 1.03 |
| 2048 | 10 | 1.02 | 1.12 | 1.00 | 1.01 | 1.01 | 1.01 | 1.02 | 1.03 | 1.22 |
| 2048 | 20 | 1.02 | 1.06 | 0.99 | 1.00 | 1.01 | 1.04 | 1.03 | 1.13 | 1.22 |
| 2048 | 50 | 1.03 | 1.04 | 1.12 | 1.12 | 1.09 | 1.05 | 1.04 | 1.07 | 1.03 |

Asmuth-Bloom tercepat lawan Shamir tercepat:

| L | (k, n) | AB tercepat | Shamir tercepat | rasio Shamir / AB | kesimpulan |
| --- | --- | --- | --- | --- | --- |
| 256 | (3, 100) | Usulan A: Garner + tabel | Shamir bilangan kecil | 0.95 [0.93-0.99] | Shamir lebih cepat |
| 256 | (5, 100) | Usulan B + pembagian eksak | Shamir bilangan kecil | 0.66 [0.65-0.68] | Shamir lebih cepat |
| 256 | (10, 100) | Usulan B: Garner selisih | Shamir bilangan kecil | 0.55 [0.54-0.56] | Shamir lebih cepat |
| 256 | (20, 100) | Usulan B: Garner selisih | Shamir bilangan kecil | 0.59 [0.58-0.60] | Shamir lebih cepat |
| 256 | (50, 100) | Usulan B: Garner selisih | Shamir bilangan kecil | 0.75 [0.73-0.76] | Shamir lebih cepat |
| 2048 | (3, 100) | Usulan B + pembagian eksak | Shamir + pembagian eksak | 1.07 [1.01-1.14] | Asmuth-Bloom lebih cepat |
| 2048 | (5, 100) | Usulan B + pembagian eksak | Shamir + pembagian eksak | 0.82 [0.79-0.86] | Shamir lebih cepat |
| 2048 | (10, 100) | Usulan B + pembagian eksak | Shamir + pembagian eksak | 0.63 [0.61-0.64] | Shamir lebih cepat |
| 2048 | (20, 100) | Usulan B + pembagian eksak | Shamir + pembagian eksak | 0.65 [0.64-0.66] | Shamir lebih cepat |
| 2048 | (50, 100) | Usulan B + pembagian eksak | Shamir + pembagian eksak | 0.52 [0.51-0.53] | Shamir lebih cepat |

## k = n (semua peserta wajib hadir)

| L | (k, n) | Usulan B: Garner selisih | Usulan B + pembagian eksak | Usulan A: Garner + tabel | Garner dengan inversi | Asmuth-Bloom klasik | Shamir biasa | Shamir batch | Shamir bilangan kecil | Shamir + pembagian eksak |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 256 | (3, 3) | 1.44 | 1.11 | 0.97 | 1.56 | 2.04 | 1.49 | 2.45 | 0.92 | 0.95 |
| 256 | (5, 5) | 2.49 | 2.23 | 2.21 | 3.13 | 4.05 | 2.78 | 4.69 | 1.38 | 1.50 |
| 256 | (10, 10) | 5.84 | 5.95 | 7.69 | 8.83 | 13.0 | 8.82 | 12.3 | 2.94 | 3.17 |
| 2048 | (3, 3) | 4.77 | 1.84 | 6.96 | 9.93 | 18.5 | 3.66 | 7.50 | 3.35 | 1.62 |
| 2048 | (5, 5) | 9.48 | 4.28 | 22.3 | 31.3 | 55.8 | 7.32 | 16.1 | 5.99 | 3.17 |
| 2048 | (10, 10) | 23.0 | 12.3 | 98.1 | 134.7 | 248.6 | 25.5 | 40.9 | 11.2 | 6.53 |

Asmuth-Bloom tercepat lawan Shamir tercepat:

| L | (k, n) | AB tercepat | Shamir tercepat | rasio Shamir / AB | kesimpulan |
| --- | --- | --- | --- | --- | --- |
| 256 | (3, 3) | Usulan A: Garner + tabel | Shamir bilangan kecil | 0.94 [0.93-0.95] | Shamir lebih cepat |
| 256 | (5, 5) | Usulan A: Garner + tabel | Shamir bilangan kecil | 0.62 [0.62-0.63] | Shamir lebih cepat |
| 256 | (10, 10) | Usulan B: Garner selisih | Shamir bilangan kecil | 0.50 [0.50-0.51] | Shamir lebih cepat |
| 2048 | (3, 3) | Usulan B + pembagian eksak | Shamir + pembagian eksak | 0.88 [0.85-0.92] | Shamir lebih cepat |
| 2048 | (5, 5) | Usulan B + pembagian eksak | Shamir + pembagian eksak | 0.74 [0.72-0.75] | Shamir lebih cepat |
| 2048 | (10, 10) | Usulan B + pembagian eksak | Shamir + pembagian eksak | 0.53 [0.52-0.54] | Shamir lebih cepat |

## L lebih rapat

| L | (k, n) | Usulan B: Garner selisih | Usulan B + pembagian eksak | Usulan A: Garner + tabel | Garner dengan inversi | Asmuth-Bloom klasik | Shamir biasa | Shamir batch | Shamir bilangan kecil | Shamir + pembagian eksak |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 512 | (3, 5) | 1.67 | 1.19 | 1.32 | 2.07 | 3.09 | 1.79 | 2.87 | 1.17 | 1.09 |
| 512 | (10, 20) | 7.75 | 7.39 | 13.2 | 17.1 | 28.7 | 10.9 | 15.3 | 3.55 | 3.69 |
| 768 | (3, 5) | 2.07 | 1.34 | 1.95 | 2.95 | 4.87 | 1.96 | 3.63 | 1.49 | 1.21 |
| 768 | (10, 20) | 9.75 | 8.37 | 22.1 | 29.3 | 54.2 | 13.3 | 19.1 | 4.50 | 4.39 |
| 1536 | (3, 5) | 3.47 | 1.62 | 4.65 | 6.87 | 12.2 | 3.32 | 6.73 | 2.85 | 1.73 |
| 1536 | (10, 20) | 16.7 | 10.3 | 63.9 | 87.3 | 154.4 | 23.4 | 34.6 | 8.20 | 5.61 |
| 3072 | (3, 5) | 8.00 | 2.22 | 12.8 | 17.9 | 34.8 | 11.1 | 17.8 | 6.86 | 2.43 |
| 3072 | (10, 20) | 39.6 | 15.1 | 188.0 | 267.1 | 495.3 | 54.4 | 82.6 | 18.8 | 8.46 |

Asmuth-Bloom tercepat lawan Shamir tercepat:

| L | (k, n) | AB tercepat | Shamir tercepat | rasio Shamir / AB | kesimpulan |
| --- | --- | --- | --- | --- | --- |
| 512 | (3, 5) | Usulan B + pembagian eksak | Shamir + pembagian eksak | 0.91 [0.86-0.94] | Shamir lebih cepat |
| 512 | (10, 20) | Usulan B + pembagian eksak | Shamir bilangan kecil | 0.48 [0.48-0.49] | Shamir lebih cepat |
| 768 | (3, 5) | Usulan B + pembagian eksak | Shamir + pembagian eksak | 0.91 [0.86-0.95] | Shamir lebih cepat |
| 768 | (10, 20) | Usulan B + pembagian eksak | Shamir + pembagian eksak | 0.52 [0.50-0.53] | Shamir lebih cepat |
| 1536 | (3, 5) | Usulan B + pembagian eksak | Shamir + pembagian eksak | 1.06 [0.98-1.08] | setara |
| 1536 | (10, 20) | Usulan B + pembagian eksak | Shamir + pembagian eksak | 0.54 [0.54-0.55] | Shamir lebih cepat |
| 3072 | (3, 5) | Usulan B + pembagian eksak | Shamir + pembagian eksak | 1.08 [1.02-1.12] | Asmuth-Bloom lebih cepat |
| 3072 | (10, 20) | Usulan B + pembagian eksak | Shamir + pembagian eksak | 0.56 [0.55-0.57] | Shamir lebih cepat |

## data dingin (satu pemanggilan, cache dibersihkan)

| L | (k, n) | Usulan B: Garner selisih | Usulan B + pembagian eksak | Usulan A: Garner + tabel | Garner dengan inversi | Asmuth-Bloom klasik | Shamir biasa | Shamir batch | Shamir bilangan kecil | Shamir + pembagian eksak |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 256 | (3, 5) | 11.8 | 9.85 | 8.60 | 12.6 | 14.1 | 11.0 | 12.7 | 9.55 | 8.25 |
| 256 | (10, 20) | 26.8 | 29.4 | 29.7 | 33.2 | 39.6 | 26.7 | 37.7 | 15.3 | 15.5 |
| 2048 | (3, 5) | 16.1 | 12.6 | 17.2 | 24.0 | 33.4 | 16.2 | 22.7 | 13.6 | 9.90 |
| 2048 | (10, 20) | 39.5 | 29.8 | 122.5 | 162.2 | 280.7 | 46.8 | 65.4 | 23.8 | 17.3 |

Urutan metode dari tercepat, dingin lawan hangat (paket utama, konfigurasi sama).

| L | (k, n) | dingin | hangat |
| --- | --- | --- | --- |
| 256 | (3, 5) | Shamir + pembagian eksak; Usulan A: Garner + tabel; Shamir bilangan kecil; Usulan B + pembagian eksak; Shamir biasa; Usulan B: Garner selisih; Garner dengan inversi; Shamir batch; Asmuth-Bloom klasik | Shamir bilangan kecil; Shamir + pembagian eksak; Usulan A: Garner + tabel; Usulan B + pembagian eksak; Usulan B: Garner selisih; Shamir biasa; Garner dengan inversi; Asmuth-Bloom klasik; Shamir batch |
| 256 | (10, 20) | Shamir bilangan kecil; Shamir + pembagian eksak; Shamir biasa; Usulan B: Garner selisih; Usulan B + pembagian eksak; Usulan A: Garner + tabel; Garner dengan inversi; Shamir batch; Asmuth-Bloom klasik | Shamir bilangan kecil; Shamir + pembagian eksak; Usulan B: Garner selisih; Usulan B + pembagian eksak; Usulan A: Garner + tabel; Garner dengan inversi; Shamir biasa; Shamir batch; Asmuth-Bloom klasik |
| 2048 | (3, 5) | Shamir + pembagian eksak; Usulan B + pembagian eksak; Shamir bilangan kecil; Usulan B: Garner selisih; Shamir biasa; Usulan A: Garner + tabel; Shamir batch; Garner dengan inversi; Asmuth-Bloom klasik | Usulan B + pembagian eksak; Shamir + pembagian eksak; Shamir biasa; Shamir bilangan kecil; Usulan B: Garner selisih; Usulan A: Garner + tabel; Shamir batch; Garner dengan inversi; Asmuth-Bloom klasik |
| 2048 | (10, 20) | Shamir + pembagian eksak; Shamir bilangan kecil; Usulan B + pembagian eksak; Usulan B: Garner selisih; Shamir biasa; Shamir batch; Usulan A: Garner + tabel; Garner dengan inversi; Asmuth-Bloom klasik | Shamir + pembagian eksak; Shamir bilangan kecil; Usulan B + pembagian eksak; Usulan B: Garner selisih; Shamir biasa; Shamir batch; Usulan A: Garner + tabel; Garner dengan inversi; Asmuth-Bloom klasik |

Asmuth-Bloom tercepat lawan Shamir tercepat:

| L | (k, n) | AB tercepat | Shamir tercepat | rasio Shamir / AB | kesimpulan |
| --- | --- | --- | --- | --- | --- |
| 256 | (3, 5) | Usulan A: Garner + tabel | Shamir + pembagian eksak | 0.98 [0.93-1.04] | setara |
| 256 | (10, 20) | Usulan B: Garner selisih | Shamir bilangan kecil | 0.58 [0.56-0.60] | Shamir lebih cepat |
| 2048 | (3, 5) | Usulan B + pembagian eksak | Shamir + pembagian eksak | 0.79 [0.75-0.82] | Shamir lebih cepat |
| 2048 | (10, 20) | Usulan B + pembagian eksak | Shamir + pembagian eksak | 0.56 [0.53-0.58] | Shamir lebih cepat |

