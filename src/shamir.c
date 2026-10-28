#include "shamir.h"
#include "crt.h"
#include <stdlib.h>
#include <stdio.h>

int sh_params_init(sh_params_t *s, int k, int n, unsigned L)
{
    if (k < 2 || k > n) return -1;
    s->k = k; s->n = n; s->L = L;
    mpz_init(s->p);
    mpz_setbit(s->p, L);
    mpz_nextprime(s->p, s->p);             /* p > 2^L > S, juga p > n */
    s->batas_eksak = -1;                   /* aturan bawaan sampai dikalibrasi */
    return 0;
}

void sh_params_clear(sh_params_t *s)
{
    mpz_clear(s->p);
}

void sh_share(const sh_params_t *s, const mpz_t S, mpz_t *shares, gmp_randstate_t st)
{
    int k = s->k;
    mpz_t *a = malloc(sizeof(mpz_t) * k);
    mpz_init_set(a[0], S);
    for (int j = 1; j < k; j++) {
        mpz_init(a[j]);
        mpz_urandomm(a[j], st, s->p);
    }
    mpz_t f;
    mpz_init(f);
    for (int i = 0; i < s->n; i++) {
        unsigned long x = (unsigned long)i + 1;
        mpz_set(f, a[k - 1]);                /* evaluasi Horner */
        for (int j = k - 2; j >= 0; j--) {
            mpz_mul_ui(f, f, x);
            mpz_add(f, f, a[j]);
            mpz_mod(f, f, s->p);
        }
        mpz_set(shares[i], f);
    }
    mpz_clear(f);
    for (int j = 0; j < k; j++) mpz_clear(a[j]);
    free(a);
}

/* pembilang dan penyebut koefisien Lagrange ke-j, keduanya mod p */
static void lagrange_num_den(const sh_params_t *s, const int *idx, int k, int j,
                             mpz_t num, mpz_t den)
{
    long xj = idx[j] + 1;
    mpz_set_ui(num, 1);
    mpz_set_ui(den, 1);
    for (int l = 0; l < k; l++) {
        if (l == j) continue;
        long xl = idx[l] + 1;
        mpz_mul_ui(num, num, (unsigned long)xl);
        mpz_mod(num, num, s->p);
        mpz_mul_si(den, den, xl - xj);
        mpz_mod(den, den, s->p);
    }
}

void sh_reconstruct_naive(const sh_params_t *s, const int *idx, mpz_srcptr *sh, int k, mpz_t S)
{
    mpz_t num, den, inv, lam;
    mpz_inits(num, den, inv, lam, NULL);
    mpz_set_ui(S, 0);
    for (int j = 0; j < k; j++) {
        lagrange_num_den(s, idx, k, j, num, den);
        if (mpz_invert(inv, den, s->p) == 0) {
            fprintf(stderr, "sh_reconstruct_naive: penyebut nol\n");
            exit(1);
        }
        mpz_mul(lam, num, inv);
        mpz_mod(lam, lam, s->p);
        mpz_addmul(S, sh[j], lam);
        mpz_mod(S, S, s->p);
    }
    mpz_clears(num, den, inv, lam, NULL);
}

void sh_reconstruct_batch(const sh_params_t *s, const int *idx, mpz_srcptr *sh, int k, mpz_t S)
{
    mpz_t *num = malloc(sizeof(mpz_t) * k);
    mpz_t *den = malloc(sizeof(mpz_t) * k);
    mpz_t *pre = malloc(sizeof(mpz_t) * k);
    for (int j = 0; j < k; j++) { mpz_init(num[j]); mpz_init(den[j]); mpz_init(pre[j]); }

    for (int j = 0; j < k; j++) lagrange_num_den(s, idx, k, j, num[j], den[j]);

    /* hasil kali awalan: pre[j] = den_0 ... den_j */
    mpz_set(pre[0], den[0]);
    for (int j = 1; j < k; j++) {
        mpz_mul(pre[j], pre[j - 1], den[j]);
        mpz_mod(pre[j], pre[j], s->p);
    }

    /* satu inversi untuk seluruh penyebut (Montgomery) */
    mpz_t invall, inv, lam;
    mpz_inits(invall, inv, lam, NULL);
    if (mpz_invert(invall, pre[k - 1], s->p) == 0) {
        fprintf(stderr, "sh_reconstruct_batch: penyebut nol\n");
        exit(1);
    }
    mpz_set_ui(S, 0);
    for (int j = k - 1; j >= 0; j--) {
        if (j > 0) {
            mpz_mul(inv, invall, pre[j - 1]);   /* den_j^-1 = invall * pre[j-1] */
            mpz_mod(inv, inv, s->p);
            mpz_mul(invall, invall, den[j]);   /* invall sekarang (den_0...den_{j-1})^-1 */
            mpz_mod(invall, invall, s->p);
        } else {
            mpz_set(inv, invall);
        }
        mpz_mul(lam, num[j], inv);
        mpz_mod(lam, lam, s->p);
        mpz_addmul(S, sh[j], lam);
        mpz_mod(S, S, s->p);
    }

    mpz_clears(invall, inv, lam, NULL);
    for (int j = 0; j < k; j++) { mpz_clear(num[j]); mpz_clear(den[j]); mpz_clear(pre[j]); }
    free(num); free(den); free(pre);
}

/* Lagrange dengan bilangan kecil (pembanding setara usulan B).
   Koordinat x = idx + 1 paling besar n, jadi pembilang N_j = prod_{l != j} x_l dan penyebut
   D_j = prod_{l != j} (x_l - x_j) dihitung eksak tanpa reduksi. Per peserta ada satu inversi
   |D_j| mod p (murah selama (k - 1) log2 n jauh di bawah L), satu perkalian share dengan
   bilangan kecil N_j, dan satu perkalian lebar penuh yang langsung dijumlahkan.
   Reduksi mod p hanya sekali, di akhir. Argumen _ui dan _si paling besar n (aman untuk long 32 bit). */
void sh_reconstruct_small(const sh_params_t *s, const int *idx, mpz_srcptr *sh, int k, mpz_t S)
{
    mpz_t ntot, num, den, inv, t, acc;
    mpz_inits(ntot, num, den, inv, t, acc, NULL);
    mpz_set_ui(ntot, 1);
    for (int l = 0; l < k; l++) mpz_mul_ui(ntot, ntot, (unsigned long)(idx[l] + 1));
    for (int j = 0; j < k; j++) {
        long xj = idx[j] + 1;
        mpz_divexact_ui(num, ntot, (unsigned long)xj);          /* N_j = N_tot / x_j, eksak */
        mpz_set_ui(den, 1);
        for (int l = 0; l < k; l++)
            if (l != j) mpz_mul_si(den, den, (long)(idx[l] + 1) - xj);
        if (mpz_sgn(den) < 0) {                                  /* tanda dipindah ke pembilang */
            mpz_neg(den, den);
            mpz_neg(num, num);
        }
        if (mpz_invert(inv, den, s->p) == 0) {
            fprintf(stderr, "sh_reconstruct_small: penyebut nol\n");
            exit(1);
        }
        mpz_mul(t, sh[j], num);                                  /* L bit x bilangan kecil */
        mpz_addmul(acc, t, inv);                                 /* satu perkalian lebar penuh */
    }
    mpz_mod(S, acc, s->p);                                       /* satu-satunya reduksi */
    mpz_clears(ntot, num, den, inv, t, acc, NULL);
}

void sh_reconstruct_exact(const sh_params_t *s, const int *idx, mpz_srcptr *sh, int k, mpz_t S)
{
    mpz_t ntot, num, den, x, term, acc, t1, t2, ad;
    mpz_inits(ntot, num, den, x, term, acc, t1, t2, ad, NULL);
    mpz_set_ui(ntot, 1);
    for (int l = 0; l < k; l++) mpz_mul_ui(ntot, ntot, (unsigned long)(idx[l] + 1));
    for (int j = 0; j < k; j++) {
        long xj = idx[j] + 1;
        mpz_divexact_ui(num, ntot, (unsigned long)xj);          /* N_j, eksak */
        mpz_set_ui(den, 1);
        for (int l = 0; l < k; l++)
            if (l != j) mpz_mul_si(den, den, (long)(idx[l] + 1) - xj);
        mpz_mul(x, sh[j], num);                                  /* L bit x bilangan kecil */
        mpz_mod(x, x, s->p);                                     /* reduksi murah: L + sedikit bit */
        if (crt_bagi_eksak(term, x, den, s->p, s->batas_eksak, t1, t2, ad) < 0) {
            fprintf(stderr, "sh_reconstruct_exact: penyebut nol\n");
            exit(1);
        }
        mpz_add(acc, acc, term);                                 /* term < p */
    }
    mpz_mod(S, acc, s->p);
    mpz_clears(ntot, num, den, x, term, acc, t1, t2, ad, NULL);
}

void sh_params_kalibrasi(sh_params_t *s)
{
    s->batas_eksak = crt_kalibrasi_eksak(s->p);
}
