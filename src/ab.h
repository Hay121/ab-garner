#ifndef AB_H
#define AB_H

#include <gmp.h>
#include "crt.h"

/* Parameter skema Asmuth-Bloom dengan m0 = 2^L */
typedef struct {
    int      k, n;
    unsigned L;
    mpz_t    m0;        /* 2^L */
    mpz_t   *m;         /* n modulus prima, terurut naik */
    mpz_t    Mk;        /* m_1 * ... * m_k */
    inv_table_t table;  /* tabel invers berpasangan (usulan A) */
    int      has_table;
    long    *off;       /* m_i - m_1, selisih kecil untuk usulan B */
    long    *low_off;   /* (m_i mod 2^L) - 2^low_shift */
    unsigned low_shift;
    int      diff_ok;   /* 1 kalau semua selisih muat dalam long */
    mpz_srcptr *mall;   /* pointer ke n modulus, disimpan sekali untuk rekonstruksi */
    int      batas_eksak; /* ambang jalur GMP pembagian eksak (bit), hasil kalibrasi */
} ab_params_t;

/* Bangkitkan modulus prima berurutan mulai 2^L + 2^(L/2), cek syarat Asmuth-Bloom,
   bangun tabel. Mengembalikan 0 jika berhasil. */
int  ab_params_init(ab_params_t *p, int k, int n, unsigned L);

/* Versi dengan modulus yang diberikan (untuk demo dan uji kecil). */
int  ab_params_init_explicit(ab_params_t *p, int k, int n, unsigned L,
                             const unsigned long *moduli);

/* Hanya bagian tabel (dipisah supaya waktunya bisa diukur sendiri). */
void ab_build_table(ab_params_t *p);

/* Cek syarat m0 * m_{n-k+2} ... m_n < m_1 ... m_k. 1 = terpenuhi. */
int  ab_check_condition(const ab_params_t *p);

void ab_params_clear(ab_params_t *p);

/* shares[i] = y mod m_i untuk i = 0..n-1 dengan y = S + A*m0, A acak. */
void ab_share(const ab_params_t *p, const mpz_t S, mpz_t *shares, gmp_randstate_t st);

/* Rekonstruksi dari k share. idx[j] indeks global (0..n-1) sembarang urutan,
   sh[j] share milik idx[j]. Hasil ditulis ke S. */
void ab_reconstruct_classic(const ab_params_t *p, const int *idx, mpz_srcptr *sh, int k, mpz_t S);
void ab_reconstruct_garner (const ab_params_t *p, const int *idx, mpz_srcptr *sh, int k, mpz_t S);
void ab_reconstruct_table  (const ab_params_t *p, const int *idx, mpz_srcptr *sh, int k, mpz_t S);
void ab_reconstruct_diff   (const ab_params_t *p, const int *idx, mpz_srcptr *sh, int k, mpz_t S);
/* usulan B dengan pembagian eksak (saran 7.2) */
void ab_reconstruct_diff_exact(const ab_params_t *p, const int *idx, mpz_srcptr *sh, int k, mpz_t S);
/* ganti ambang k tanpa membangkitkan ulang modulus (eksperimen n tetap); -3 bila syarat gagal */
int  ab_params_set_k(ab_params_t *p, int k);
/* modulus saling prima yang tidak harus prima, dipilih rakus dari bilangan ganjil di dekat 2^L + 2^(L/2) */
int  ab_params_init_koprima(ab_params_t *p, int k, int n, unsigned L);
/* ukur ambang jalur GMP pembagian eksak di mesin ini; tanpa kalibrasi dipakai aturan separuh modulus */
void ab_params_kalibrasi(ab_params_t *p);

#endif
