# Asmuth-Bloom tercepat lawan Shamir tercepat

Metode tercepat dipilih per konfigurasi menurut median. Rasio = waktu Shamir / waktu Asmuth-Bloom, berpasangan per pengulangan, median [interval kepercayaan 95% bootstrap]. Asmuth-Bloom dinyatakan lebih cepat hanya bila batas bawah interval di atas 1; Shamir lebih cepat bila batas atas di bawah 1.

| L | (k, n) | Asmuth-Bloom tercepat | Shamir tercepat | rasio Shamir / AB | kesimpulan |
| --- | --- | --- | --- | --- | --- |
| 256 | (3, 5) | Usulan A: Garner + tabel | Shamir bilangan kecil | 0.90 [0.88-0.93] | Shamir lebih cepat |
| 256 | (5, 10) | Usulan B + pembagian eksak | Shamir bilangan kecil | 0.69 [0.69-0.72] | Shamir lebih cepat |
| 256 | (10, 20) | Usulan B: Garner selisih | Shamir bilangan kecil | 0.52 [0.51-0.52] | Shamir lebih cepat |
| 256 | (20, 40) | Usulan B: Garner selisih | Shamir bilangan kecil | 0.51 [0.50-0.51] | Shamir lebih cepat |
| 256 | (50, 100) | Usulan B: Garner selisih | Shamir bilangan kecil | 0.73 [0.73-0.74] | Shamir lebih cepat |
| 1024 | (3, 5) | Usulan B + pembagian eksak | Shamir + pembagian eksak | 0.99 [0.93-1.02] | setara |
| 1024 | (5, 10) | Usulan B + pembagian eksak | Shamir + pembagian eksak | 0.80 [0.79-0.80] | Shamir lebih cepat |
| 1024 | (10, 20) | Usulan B + pembagian eksak | Shamir + pembagian eksak | 0.54 [0.53-0.55] | Shamir lebih cepat |
| 1024 | (20, 40) | Usulan B + pembagian eksak | Shamir bilangan kecil | 0.53 [0.52-0.54] | Shamir lebih cepat |
| 1024 | (50, 100) | Usulan B: Garner selisih | Shamir bilangan kecil | 0.49 [0.48-0.49] | Shamir lebih cepat |
| 2048 | (3, 5) | Usulan B + pembagian eksak | Shamir + pembagian eksak | 1.03 [0.97-1.05] | setara |
| 2048 | (5, 10) | Usulan B + pembagian eksak | Shamir + pembagian eksak | 0.85 [0.84-0.87] | Shamir lebih cepat |
| 2048 | (10, 20) | Usulan B + pembagian eksak | Shamir + pembagian eksak | 0.58 [0.57-0.58] | Shamir lebih cepat |
| 2048 | (20, 40) | Usulan B + pembagian eksak | Shamir + pembagian eksak | 0.57 [0.56-0.59] | Shamir lebih cepat |
| 2048 | (50, 100) | Usulan B + pembagian eksak | Shamir + pembagian eksak | 0.52 [0.52-0.53] | Shamir lebih cepat |

Jumlah konfigurasi: Shamir lebih cepat 13, setara 2
