#ifndef CRT_H
#define CRT_H

#include <gmp.h>

/* Inti penelitian: tiga cara menyelesaikan sistem kongruensi
       x = r[j] (mod m[j]),  j = 0..k-1,  modulus saling prima,
   dengan hasil 0 <= x < m[0]*...*m[k-1].
   Semua ditulis sendiri; GMP hanya dipakai untuk aritmetika dasar
   (tambah, kali, mod, invert). */

/* Rumus CRT klasik: x = sum r_j * M_j * (M_j^-1 mod m_j) mod M.
   Butuh k inversi dan bilangan antara sebesar M. */
void crt_classic(mpz_t x, mpz_srcptr *m, mpz_srcptr *r, int k);

/* Garner inkremental (Menezes dkk. 14.71, varian k-1 inversi):
   C_j = (m_0*...*m_{j-1})^-1 mod m_j dihitung saat dipanggil. */
void crt_garner_inv(mpz_t x, mpz_srcptr *m, mpz_srcptr *r, int k);

/* Tabel invers berpasangan untuk n modulus global:
   inv[i*n + j] = m_i^-1 mod m_j untuk i < j. Entri lain tidak dipakai. */
typedef struct {
    int    n;
    mpz_t *inv;
} inv_table_t;

void inv_table_build(inv_table_t *t, mpz_srcptr *m_all, int n);
void inv_table_clear(inv_table_t *t);
size_t inv_table_bytes(const inv_table_t *t);   /* perkiraan memori entri yang terisi */

/* Garner dengan tabel (usulan). idx[] = indeks global modulus yang dipakai,
   HARUS terurut naik; m_all = semua modulus global; r[j] residu untuk idx[j].
   Tidak ada inversi sama sekali. */
void crt_garner_table(mpz_t x, mpz_srcptr *m_all, const inv_table_t *t,
                      const int *idx, mpz_srcptr *r, int k);

/* Garner untuk modulus berdekatan (usulan B). off[i] = m_all[i] - m_all[0], kecil dan muat
   dalam long. Karena m_b mod m_j = m_b - m_j, setiap perkalian dengan modulus diganti perkalian
   dengan selisih kecil, dan P mod m_j menjadi hasil kali selisih yang inversinya murah.
   Mengisi digit mixed radix v[0..k-1]; idx terurut naik. */
void crt_garner_diff(mpz_t *v, mpz_srcptr *m_all, const long *off, const int *idx, mpz_srcptr *r, int k);

/* Pembagian eksak (saran 7.2 makalah). v = x * D^-1 mod m, untuk 0 <= x < m dan D (boleh negatif)
   yang prima relatif dengan m. Bila |D| kecil, x + q*m dengan q = -x * m^-1 mod |D| habis dibagi |D|,
   dan hasil baginya sudah < m, sehingga tidak perlu invers modulo m maupun perkalian lebar penuh.
   Jalur 0: |D| < 2^CRT_EKSAK_BIT_WORD, hitungan satu word (aman untuk unsigned long 32 bit).
   Jalur 1: bit(|D|) * CRT_EKSAK_PEMBAGI <= bit(m), hitungan mpz.
   Jalur 2: cara lama, invers |D| modulo m lalu satu perkalian modular.
   t1, t2, ad adalah variabel kerja milik pemanggil. Mengembalikan nomor jalur, atau -1 bila
   D tidak prima relatif dengan m. crt_jalur_hitung mencatat berapa kali tiap jalur dipakai. */
int crt_bagi_eksak(mpz_t v, const mpz_t x, const mpz_t D, mpz_srcptr m, int batas_mpz, mpz_t t1, mpz_t t2, mpz_t ad);
/* batas_mpz: panjang bit terbesar pembagi yang masih memakai jalur GMP; negatif berarti aturan bawaan
   (separuh panjang modulus). crt_kalibrasi_eksak mengukur ambang itu untuk modulus m di mesin ini. */
int crt_kalibrasi_eksak(mpz_srcptr m);
extern unsigned long crt_jalur_hitung[3];

/* Usulan B dengan pembagian eksak: sama dengan crt_garner_diff, tetapi digit v_j dihitung
   dengan crt_bagi_eksak, bukan dengan invers dan perkalian modular. */
void crt_garner_diff_exact(mpz_t *v, mpz_srcptr *m_all, const long *off, const int *idx, mpz_srcptr *r, int k, int batas_mpz);

#endif
