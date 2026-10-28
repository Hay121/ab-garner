#ifndef SHAMIR_H
#define SHAMIR_H

#include <gmp.h>

/* Baseline: skema Shamir atas Z_p, p = prima pertama setelah 2^L.
   Peserta ke-i (indeks 0..n-1) memegang titik (i+1, f(i+1)). */
typedef struct {
    int      k, n;
    unsigned L;
    mpz_t    p;
    int      batas_eksak;   /* ambang jalur GMP pembagian eksak (bit), hasil kalibrasi */
} sh_params_t;

int  sh_params_init(sh_params_t *s, int k, int n, unsigned L);
void sh_params_clear(sh_params_t *s);
void sh_params_kalibrasi(sh_params_t *s);

void sh_share(const sh_params_t *s, const mpz_t S, mpz_t *shares, gmp_randstate_t st);

/* Lagrange di x = 0 dengan k inversi (versi buku teks) */
void sh_reconstruct_naive(const sh_params_t *s, const int *idx, mpz_srcptr *sh, int k, mpz_t S);
/* Lagrange dengan satu inversi (trik batch Montgomery) */
void sh_reconstruct_batch(const sh_params_t *s, const int *idx, mpz_srcptr *sh, int k, mpz_t S);
/* Lagrange dengan bilangan kecil, pembanding yang dioptimasi setara dengan usulan B:
   pembilang dan penyebut eksak tanpa reduksi, satu inversi per peserta, perkalian lebar
   penuh langsung dijumlahkan, dan reduksi mod p hanya sekali di akhir. */
void sh_reconstruct_small(const sh_params_t *s, const int *idx, mpz_srcptr *sh, int k, mpz_t S);
/* Shamir dengan pembagian eksak (trik yang sama dengan usulan B dengan pembagian eksak):
   y_j * N_j * D_j^-1 mod p dihitung tanpa invers modulo p dan tanpa perkalian lebar penuh. */
void sh_reconstruct_exact(const sh_params_t *s, const int *idx, mpz_srcptr *sh, int k, mpz_t S);

#endif
