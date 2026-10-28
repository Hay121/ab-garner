#include "ab.h"
#include <stdlib.h>
#include <stdio.h>

static void ab_alloc(ab_params_t *p, int k, int n, unsigned L)
{
    p->k = k; p->n = n; p->L = L;
    p->has_table = 0;
    p->off = NULL;
    p->low_off = NULL;
    p->diff_ok = 0;
    p->mall = NULL;
    p->batas_eksak = -1;
    mpz_init(p->m0);
    mpz_init(p->Mk);
    mpz_setbit(p->m0, L);                  /* m0 = 2^L */
    p->m = malloc(sizeof(mpz_t) * n);
    for (int i = 0; i < n; i++) mpz_init(p->m[i]);
}

static void ab_compute_Mk(ab_params_t *p)
{
    mpz_set_ui(p->Mk, 1);
    for (int i = 0; i < p->k; i++) mpz_mul(p->Mk, p->Mk, p->m[i]);
}

int ab_check_condition(const ab_params_t *p)
{
    /* kiri = m0 * (k-1 modulus terbesar), kanan = k modulus terkecil */
    mpz_t left, right;
    mpz_inits(left, right, NULL);
    mpz_set(left, p->m0);
    for (int i = p->n - (p->k - 1); i < p->n; i++) mpz_mul(left, left, p->m[i]);
    mpz_set_ui(right, 1);
    for (int i = 0; i < p->k; i++) mpz_mul(right, right, p->m[i]);
    int ok = mpz_cmp(left, right) < 0;
    mpz_clears(left, right, NULL);
    return ok;
}

void ab_build_table(ab_params_t *p)
{
    mpz_srcptr *mp = malloc(sizeof(mpz_srcptr) * p->n);
    for (int i = 0; i < p->n; i++) mp[i] = p->m[i];
    inv_table_build(&p->table, mp, p->n);
    p->has_table = 1;
    free(mp);
}

/* Data untuk usulan B: selisih tiap modulus terhadap m_1, dan bentuk m_i mod 2^L = 2^h + e_i */
static void ab_prepare_diff(ab_params_t *p)
{
    mpz_t d, low;
    mpz_inits(d, low, NULL);
    p->off = malloc(sizeof(long) * p->n);
    p->low_off = malloc(sizeof(long) * p->n);
    p->diff_ok = 1;
    p->mall = malloc(sizeof(mpz_srcptr) * p->n);
    for (int i = 0; i < p->n; i++) p->mall[i] = p->m[i];
    mpz_fdiv_r_2exp(low, p->m[0], p->L);
    p->low_shift = (unsigned)mpz_sizeinbase(low, 2) - 1;    /* bit tertinggi m_1 mod 2^L */
    for (int i = 0; i < p->n; i++) {
        mpz_sub(d, p->m[i], p->m[0]);
        if (mpz_fits_slong_p(d)) p->off[i] = mpz_get_si(d); else p->diff_ok = 0;
        mpz_fdiv_r_2exp(low, p->m[i], p->L);
        mpz_set_ui(d, 0);
        mpz_setbit(d, p->low_shift);
        mpz_sub(d, low, d);
        if (mpz_fits_slong_p(d)) p->low_off[i] = mpz_get_si(d); else p->diff_ok = 0;
    }
    mpz_clears(d, low, NULL);
}

int ab_params_init(ab_params_t *p, int k, int n, unsigned L)
{
    if (k < 2 || k > n || L < 16) return -1;
    ab_alloc(p, k, n, L);

    /* mulai dari 2^L + 2^(L/2). Margin tidak diperbesar kalau syarat gagal, karena margin yang
       lebih besar menaikkan kebocoran epsilon (lihat bin/keamanan); parameter seperti itu ditolak. */
    for (unsigned margin = L / 2; margin == L / 2; margin++) {
        mpz_t start;
        mpz_init(start);
        mpz_setbit(start, L);
        mpz_setbit(start, margin);
        mpz_nextprime(p->m[0], start);
        for (int i = 1; i < n; i++) mpz_nextprime(p->m[i], p->m[i - 1]);
        mpz_clear(start);

        /* mpz_nextprime bersifat probabilistik; periksa ulang 25 putaran Miller-Rabin */
        for (int i = 0; i < n; i++) {
            if (mpz_probab_prime_p(p->m[i], 25) == 0) {
                fprintf(stderr, "ab_params_init: m[%d] ternyata komposit\n", i);
                ab_params_clear(p);
                return -2;
            }
        }
        if (ab_check_condition(p)) {
            ab_compute_Mk(p);
            ab_build_table(p);
            ab_prepare_diff(p);
                    return 0;
        }
    }
    fprintf(stderr, "ab_params_init: syarat Asmuth-Bloom gagal untuk L=%u, k=%d, n=%d dengan margin L/2\n", L, k, n);
    ab_params_clear(p);
    return -3;
}

int ab_params_init_explicit(ab_params_t *p, int k, int n, unsigned L,
                            const unsigned long *moduli)
{
    ab_alloc(p, k, n, L);
    for (int i = 0; i < n; i++) mpz_set_ui(p->m[i], moduli[i]);
    for (int i = 1; i < n; i++) {
        if (mpz_cmp(p->m[i - 1], p->m[i]) >= 0) {
            fprintf(stderr, "ab_params_init_explicit: modulus harus terurut naik\n");
            ab_params_clear(p);
            return -1;
        }
    }
    if (!ab_check_condition(p)) {
        fprintf(stderr, "ab_params_init_explicit: syarat Asmuth-Bloom tidak terpenuhi\n");
        ab_params_clear(p);
        return -3;
    }
    ab_compute_Mk(p);
    ab_build_table(p);
    ab_prepare_diff(p);
    return 0;
}

void ab_params_clear(ab_params_t *p)
{
    if (p->has_table) inv_table_clear(&p->table);
    free(p->off);
    free(p->low_off);
    free(p->mall);
    p->mall = NULL;
    p->off = NULL;
    p->low_off = NULL;
    for (int i = 0; i < p->n; i++) mpz_clear(p->m[i]);
    free(p->m);
    mpz_clears(p->m0, p->Mk, NULL);
    p->m = NULL;
    p->has_table = 0;
}

void ab_share(const ab_params_t *p, const mpz_t S, mpz_t *shares, gmp_randstate_t st)
{
    mpz_t A, y, cnt;
    mpz_inits(A, y, cnt, NULL);
    mpz_fdiv_q(cnt, p->Mk, p->m0);         /* banyaknya nilai A yang sah: floor(Mk/m0) */
    mpz_urandomm(A, st, cnt);              /* A seragam di [0, cnt-1] */
    mpz_mul(y, A, p->m0);
    mpz_add(y, y, S);                      /* y = S + A*m0 < Mk */
    for (int i = 0; i < p->n; i++) mpz_mod(shares[i], y, p->m[i]);
    mpz_clears(A, y, cnt, NULL);
}

/* urutkan pasangan (idx, share) naik menurut idx; k kecil, insertion sort cukup */
static void sort_subset(const int *idx, mpz_srcptr *sh, int k, int *sidx, mpz_srcptr *ssh)
{
    for (int j = 0; j < k; j++) { sidx[j] = idx[j]; ssh[j] = sh[j]; }
    for (int i = 1; i < k; i++) {
        int vi = sidx[i]; mpz_srcptr vs = ssh[i];
        int j = i - 1;
        while (j >= 0 && sidx[j] > vi) { sidx[j + 1] = sidx[j]; ssh[j + 1] = ssh[j]; j--; }
        sidx[j + 1] = vi; ssh[j + 1] = vs;
    }
}

static void finish(const ab_params_t *p, mpz_t y, mpz_t S)
{
    mpz_fdiv_r_2exp(S, y, p->L);           /* S = y mod 2^L */
}

void ab_reconstruct_classic(const ab_params_t *p, const int *idx, mpz_srcptr *sh, int k, mpz_t S)
{
    int *sidx = malloc(sizeof(int) * k);
    mpz_srcptr *ssh = malloc(sizeof(mpz_srcptr) * k);
    mpz_srcptr *mm  = malloc(sizeof(mpz_srcptr) * k);
    sort_subset(idx, sh, k, sidx, ssh);
    for (int j = 0; j < k; j++) mm[j] = p->m[sidx[j]];
    mpz_t y; mpz_init(y);
    crt_classic(y, mm, ssh, k);
    finish(p, y, S);
    mpz_clear(y);
    free(sidx); free(ssh); free(mm);
}

void ab_reconstruct_garner(const ab_params_t *p, const int *idx, mpz_srcptr *sh, int k, mpz_t S)
{
    int *sidx = malloc(sizeof(int) * k);
    mpz_srcptr *ssh = malloc(sizeof(mpz_srcptr) * k);
    mpz_srcptr *mm  = malloc(sizeof(mpz_srcptr) * k);
    sort_subset(idx, sh, k, sidx, ssh);
    for (int j = 0; j < k; j++) mm[j] = p->m[sidx[j]];
    mpz_t y; mpz_init(y);
    crt_garner_inv(y, mm, ssh, k);
    finish(p, y, S);
    mpz_clear(y);
    free(sidx); free(ssh); free(mm);
}

void ab_reconstruct_table(const ab_params_t *p, const int *idx, mpz_srcptr *sh, int k, mpz_t S)
{
    int *sidx = malloc(sizeof(int) * k);
    mpz_srcptr *ssh = malloc(sizeof(mpz_srcptr) * k);
    sort_subset(idx, sh, k, sidx, ssh);
    mpz_t y; mpz_init(y);
    crt_garner_table(y, p->mall, &p->table, sidx, ssh, k);
    finish(p, y, S);
    mpz_clear(y);
    free(sidx); free(ssh);
}

void ab_reconstruct_diff(const ab_params_t *p, const int *idx, mpz_srcptr *sh, int k, mpz_t S)
{
    if (!p->diff_ok) {                       /* modulus tidak berdekatan: pakai usulan A */
        ab_reconstruct_table(p, idx, sh, k, S);
        return;
    }
    int *sidx = malloc(sizeof(int) * k);
    mpz_srcptr *ssh = malloc(sizeof(mpz_srcptr) * k);
    mpz_t *v = malloc(sizeof(mpz_t) * k);
    mpz_t tmp;
    sort_subset(idx, sh, k, sidx, ssh);
    for (int j = 0; j < k; j++) mpz_init(v[j]);
    mpz_init(tmp);
    crt_garner_diff(v, p->mall, p->off, sidx, ssh, k);

    /* S = y mod 2^L lewat Horner. Karena m_b mod 2^L = 2^h + e_b, mengalikan dengan m_b
       cukup berupa geser h bit ditambah perkalian dengan bilangan kecil e_b. */
    mpz_set(S, v[k - 1]);
    for (int j = k - 2; j >= 0; j--) {
        mpz_mul_si(tmp, S, p->low_off[sidx[j]]);
        mpz_mul_2exp(S, S, p->low_shift);
        mpz_add(S, S, tmp);
        mpz_add(S, S, v[j]);
        mpz_fdiv_r_2exp(S, S, p->L);
    }
    mpz_fdiv_r_2exp(S, S, p->L);
    for (int j = 0; j < k; j++) mpz_clear(v[j]);
    mpz_clear(tmp);
    free(sidx); free(ssh); free(v);
}

int ab_params_set_k(ab_params_t *p, int k)
{
    if (k < 2 || k > p->n) return -1;
    p->k = k;
    if (!ab_check_condition(p)) return -3;
    ab_compute_Mk(p);
    return 0;
}

void ab_reconstruct_diff_exact(const ab_params_t *p, const int *idx, mpz_srcptr *sh, int k, mpz_t S)
{
    if (!p->diff_ok) {                       /* modulus tidak berdekatan: pakai usulan A */
        ab_reconstruct_table(p, idx, sh, k, S);
        return;
    }
    int *sidx = malloc(sizeof(int) * k);
    mpz_srcptr *ssh = malloc(sizeof(mpz_srcptr) * k);
    mpz_t *v = malloc(sizeof(mpz_t) * k);
    mpz_t tmp;
    sort_subset(idx, sh, k, sidx, ssh);
    for (int j = 0; j < k; j++) mpz_init(v[j]);
    mpz_init(tmp);
    crt_garner_diff_exact(v, p->mall, p->off, sidx, ssh, k, p->batas_eksak);
    mpz_set(S, v[k - 1]);                    /* Horner modulo 2^L, sama dengan usulan B */
    for (int j = k - 2; j >= 0; j--) {
        mpz_mul_si(tmp, S, p->low_off[sidx[j]]);
        mpz_mul_2exp(S, S, p->low_shift);
        mpz_add(S, S, tmp);
        mpz_add(S, S, v[j]);
        mpz_fdiv_r_2exp(S, S, p->L);
    }
    mpz_fdiv_r_2exp(S, S, p->L);
    for (int j = 0; j < k; j++) mpz_clear(v[j]);
    mpz_clear(tmp);
    free(sidx); free(ssh); free(v);
}

/* Modulus saling prima yang tidak harus prima: bilangan ganjil B + d dengan B = 2^L + 2^(L/2) + 1 dan
   d = 0, 2, 4, ... dipilih secara rakus bila saling prima dengan semua modulus yang sudah terpilih.
   Karena gcd(B + d, B + o_i) membagi d - o_i, cukup diperiksa gcd(B + d, d - o_i). */
int ab_params_init_koprima(ab_params_t *p, int k, int n, unsigned L)
{
    if (k < 2 || k > n || L < 16) return -1;
    ab_alloc(p, k, n, L);
    mpz_t B, c;
    mpz_inits(B, c, NULL);
    mpz_setbit(B, L);
    mpz_setbit(B, L / 2);
    mpz_setbit(B, 0);
    unsigned long *o = malloc(sizeof(unsigned long) * n);
    int ada = 0;
    for (unsigned long d = 0; ada < n; d += 2) {
        int cocok = 1;
        mpz_add_ui(c, B, d);
        for (int i = 0; i < ada && cocok; i++)
            if (mpz_gcd_ui(NULL, c, d - o[i]) != 1) cocok = 0;
        if (cocok) { mpz_set(p->m[ada], c); o[ada++] = d; }
    }
    free(o);
    mpz_clears(B, c, NULL);
    if (!ab_check_condition(p)) {
        fprintf(stderr, "ab_params_init_koprima: syarat Asmuth-Bloom gagal untuk L=%u, k=%d, n=%d\n", L, k, n);
        ab_params_clear(p);
        return -3;
    }
    ab_compute_Mk(p);
    ab_build_table(p);
    ab_prepare_diff(p);
    return 0;
}

/* kalibrasi ambang jalur GMP pembagian eksak untuk modulus parameter ini (dipanggil terpisah dari setup) */
void ab_params_kalibrasi(ab_params_t *p)
{
    p->batas_eksak = crt_kalibrasi_eksak(p->m[0]);
}
