#include "crt.h"
#include "util.h"
#include <stdlib.h>
#include <stdio.h>

void crt_classic(mpz_t x, mpz_srcptr *m, mpz_srcptr *r, int k)
{
    mpz_t M, Mj, t, y;
    mpz_inits(M, Mj, t, y, NULL);

    mpz_set_ui(M, 1);
    for (int j = 0; j < k; j++) mpz_mul(M, M, m[j]);

    mpz_set_ui(x, 0);
    for (int j = 0; j < k; j++) {
        mpz_divexact(Mj, M, m[j]);        /* M_j = M / m_j */
        mpz_mod(t, Mj, m[j]);
        if (mpz_invert(y, t, m[j]) == 0) {  /* y_j = M_j^-1 mod m_j */
            fprintf(stderr, "crt_classic: modulus tidak saling prima\n");
            exit(1);
        }
        mpz_mul(t, r[j], y);
        mpz_mul(t, t, Mj);                /* r_j * y_j * M_j */
        mpz_add(x, x, t);
    }
    mpz_mod(x, x, M);
    mpz_clears(M, Mj, t, y, NULL);
}

void crt_garner_inv(mpz_t x, mpz_srcptr *m, mpz_srcptr *r, int k)
{
    mpz_t P, C, u, t;
    mpz_inits(P, C, u, t, NULL);

    mpz_mod(x, r[0], m[0]);               /* v_0 */
    mpz_set(P, m[0]);                     /* P = m_0 ... m_{j-1} */
    for (int j = 1; j < k; j++) {
        mpz_mod(t, P, m[j]);
        if (mpz_invert(C, t, m[j]) == 0) {  /* C_j = P^-1 mod m_j, satu inversi per langkah */
            fprintf(stderr, "crt_garner_inv: modulus tidak saling prima\n");
            exit(1);
        }
        mpz_mod(u, x, m[j]);              /* x saat ini direduksi mod m_j */
        mpz_sub(u, r[j], u);
        mpz_mul(u, u, C);
        mpz_mod(u, u, m[j]);              /* v_j = (r_j - x) * C_j mod m_j */
        mpz_addmul(x, u, P);              /* x += v_j * P */
        mpz_mul(P, P, m[j]);
    }
    mpz_clears(P, C, u, t, NULL);
}

void inv_table_build(inv_table_t *t, mpz_srcptr *m_all, int n)
{
    t->n = n;
    t->inv = malloc(sizeof(mpz_t) * (size_t)n * (size_t)n);
    for (int i = 0; i < n; i++) {
        for (int j = i + 1; j < n; j++) {
            mpz_init(t->inv[i * n + j]);
            if (mpz_invert(t->inv[i * n + j], m_all[i], m_all[j]) == 0) {
                fprintf(stderr, "inv_table_build: m[%d] dan m[%d] tidak saling prima\n", i, j);
                exit(1);
            }
        }
    }
}

void inv_table_clear(inv_table_t *t)
{
    int n = t->n;
    for (int i = 0; i < n; i++)
        for (int j = i + 1; j < n; j++)
            mpz_clear(t->inv[i * n + j]);
    free(t->inv);
    t->inv = NULL;
    t->n = 0;
}

size_t inv_table_bytes(const inv_table_t *t)
{
    size_t total = 0;
    int n = t->n;
    for (int i = 0; i < n; i++)
        for (int j = i + 1; j < n; j++)
            total += (size_t)mpz_size(t->inv[i * n + j]) * sizeof(mp_limb_t);
    return total;
}

void crt_garner_table(mpz_t x, mpz_srcptr *m_all, const inv_table_t *t,
                      const int *idx, mpz_srcptr *r, int k)
{
    int n = t->n;
    mpz_t *v = malloc(sizeof(mpz_t) * k);
    mpz_t tmp;
    mpz_init(tmp);
    for (int j = 0; j < k; j++) mpz_init(v[j]);

    /* koefisien mixed radix, rumus Knuth dengan konstanta berpasangan dari tabel */
    mpz_mod(v[0], r[0], m_all[idx[0]]);
    for (int j = 1; j < k; j++) {
        mpz_srcptr mj = m_all[idx[j]];
        mpz_set(tmp, r[j]);
        for (int a = 0; a < j; a++) {
            mpz_sub(tmp, tmp, v[a]);
            mpz_mul(tmp, tmp, t->inv[idx[a] * n + idx[j]]);
            mpz_mod(tmp, tmp, mj);
        }
        mpz_set(v[j], tmp);
    }

    /* gabungkan dengan skema Horner: x = v_0 + m_0 (v_1 + m_1 (v_2 + ...)) */
    mpz_set(x, v[k - 1]);
    for (int j = k - 2; j >= 0; j--) {
        mpz_mul(x, x, m_all[idx[j]]);
        mpz_add(x, x, v[j]);
    }

    for (int j = 0; j < k; j++) mpz_clear(v[j]);
    free(v);
    mpz_clear(tmp);
}

void crt_garner_diff(mpz_t *v, mpz_srcptr *m_all, const long *off, const int *idx, mpz_srcptr *r, int k)
{
    mpz_t s, D, t;
    mpz_inits(s, D, t, NULL);
    mpz_mod(v[0], r[0], m_all[idx[0]]);
    for (int j = 1; j < k; j++) {
        mpz_srcptr mj = m_all[idx[j]];
        long oj = off[idx[j]];
        /* s = (v_1 + m_1(v_2 + ... + m_{j-2} v_{j-1})) mod m_j, dengan m_b diganti m_b - m_j */
        mpz_set(s, v[j - 1]);
        for (int b = j - 2; b >= 0; b--) {
            mpz_mul_si(s, s, off[idx[b]] - oj);
            mpz_add(s, s, v[b]);
        }
        /* D = (m_1 ... m_{j-1}) mod m_j = hasil kali selisih, bilangan kecil */
        mpz_set_si(D, 1);
        for (int b = 0; b < j; b++) mpz_mul_si(D, D, off[idx[b]] - oj);
        mpz_mod(D, D, mj);
        if (mpz_invert(D, D, mj) == 0) {
            fprintf(stderr, "crt_garner_diff: modulus tidak saling prima\n");
            exit(1);
        }
        mpz_sub(t, r[j], s);
        mpz_mod(t, t, mj);
        mpz_mul(t, t, D);
        mpz_mod(v[j], t, mj);                  /* v_j = (r_j - x) * P^-1 mod m_j */
    }
    mpz_clears(s, D, t, NULL);
}

/* ---------- pembagian eksak (saran 7.2) ---------- */

#ifndef CRT_EKSAK_BIT_WORD
#define CRT_EKSAK_BIT_WORD 30       /* 2^30: hasil kali dua bilangan < 2^30 muat di unsigned long long */
#endif
#ifndef CRT_EKSAK_PEMBAGI
#define CRT_EKSAK_PEMBAGI 2         /* jalur mpz bila |D| paling banyak separuh lebar modulus */
#endif

unsigned long crt_jalur_hitung[3];

/* a^-1 mod d untuk d < 2^30 dan gcd(a, d) = 1, dengan Euclid diperluas pada long long */
static unsigned long inv_word(unsigned long a, unsigned long d)
{
    long long r0 = (long long)d, r1 = (long long)(a % d), t0 = 0, t1 = 1;
    while (r1 != 0) {
        long long q = r0 / r1, s;
        s = r0 - q * r1; r0 = r1; r1 = s;
        s = t0 - q * t1; t0 = t1; t1 = s;
    }
    if (r0 != 1) return 0;          /* tidak prima relatif (tidak terjadi untuk modulus sah) */
    if (t0 < 0) t0 += (long long)d;
    return (unsigned long)t0;
}

/* jalur satu word: x' ada di v, d < 2^30 */
static int jalur_word(mpz_t v, mpz_srcptr m, unsigned long d)
{
    unsigned long xr = mpz_fdiv_ui(v, d), mr = mpz_fdiv_ui(m, d);
    unsigned long mi = (d == 1) ? 0 : inv_word(mr, d);
    if (d != 1 && mi == 0) return -1;
    unsigned long q = (unsigned long)(((unsigned long long)((d - xr) % d) * mi) % d);
    mpz_addmul_ui(v, m, q);                     /* x' + q*m, habis dibagi d */
    mpz_divexact_ui(v, v, d);
    return 0;
}

/* jalur GMP: reduksi Montgomery (REDC) dengan radiks ad; x' ada di v */
static int jalur_mpz(mpz_t v, mpz_srcptr m, const mpz_t ad, mpz_t t1, mpz_t t2)
{
    mpz_mod(t1, m, ad);
    if (mpz_invert(t1, t1, ad) == 0) return -1;  /* m^-1 mod d */
    mpz_mod(t2, v, ad);
    mpz_mul(t2, t2, t1);
    mpz_neg(t2, t2);
    mpz_mod(t2, t2, ad);                         /* q = -x' m^-1 mod d */
    mpz_addmul(v, t2, m);
    mpz_divexact(v, v, ad);
    return 0;
}

/* cara lama: invers D modulo m lalu satu perkalian modular */
static int jalur_lama(mpz_t v, const mpz_t x, const mpz_t D, mpz_srcptr m, mpz_t t1, mpz_t t2)
{
    mpz_mod(t1, D, m);
    if (mpz_invert(t1, t1, m) == 0) return -1;
    mpz_mul(t2, x, t1);
    mpz_mod(v, t2, m);
    return 0;
}

int crt_bagi_eksak(mpz_t v, const mpz_t x, const mpz_t D, mpz_srcptr m, int batas_mpz, mpz_t t1, mpz_t t2, mpz_t ad)
{
    size_t bm = mpz_sizeinbase(m, 2);
#ifdef CRT_EKSAK_BATAS_PAKSA
    batas_mpz = CRT_EKSAK_BATAS_PAKSA;
#endif
    if (batas_mpz < 0) batas_mpz = (int)(bm / CRT_EKSAK_PEMBAGI);   /* aturan bawaan */
    mpz_abs(ad, D);
    size_t bd = mpz_sizeinbase(ad, 2);
    if (bd <= CRT_EKSAK_BIT_WORD || (long)bd <= (long)batas_mpz) {
        /* tanda D dipindah ke x: x * D^-1 = (m - x) * |D|^-1 (mod m); x' disimpan di v */
        if (mpz_sgn(D) < 0 && mpz_sgn(x) != 0) mpz_sub(v, m, x);
        else mpz_set(v, x);
        if (bd <= CRT_EKSAK_BIT_WORD) {
            if (jalur_word(v, m, mpz_get_ui(ad)) < 0) return -1;
            crt_jalur_hitung[0]++;
            return 0;
        }
        if (jalur_mpz(v, m, ad, t1, t2) < 0) return -1;
        crt_jalur_hitung[1]++;
        return 1;
    }
    if (jalur_lama(v, x, D, m, t1, t2) < 0) return -1;
    crt_jalur_hitung[2]++;
    return 2;
}

/* Kalibrasi ambang jalur GMP untuk modulus m: untuk pembagi d selebar 32 bit ke atas, ukur waktu jalur GMP
   dan cara lama (masing-masing minimum dari tiga pengukuran), dan kembalikan panjang bit terbesar tempat
   jalur GMP masih lebih cepat. Pengukuran berhenti setelah jalur GMP kalah dua kali berturut-turut. */
static double ukur_jalur(int jalur, mpz_t v, const mpz_t x, const mpz_t D, const mpz_t ad, mpz_srcptr m,
                         mpz_t t1, mpz_t t2, int ulang)
{
    double terbaik = 1e30;
    for (int u = 0; u < 3; u++) {
        double t0 = now_us();
        for (int i = 0; i < ulang; i++) {
            if (jalur) { mpz_set(v, x); jalur_mpz(v, m, ad, t1, t2); }
            else jalur_lama(v, x, D, m, t1, t2);
        }
        double t = (now_us() - t0) / ulang;
        if (t < terbaik) terbaik = t;
    }
    return terbaik;
}

int crt_kalibrasi_eksak(mpz_srcptr m)
{
    size_t bm = mpz_sizeinbase(m, 2);
    size_t langkah = bm <= 512 ? 16 : 32;
    int batas = 0, kalah = 0;
    gmp_randstate_t st;
    gmp_randinit_default(st);
    gmp_randseed_ui(st, 271828);
    mpz_t x, D, v, t1, t2, g;
    mpz_inits(x, D, v, t1, t2, g, NULL);
    for (size_t b = 32; b < bm; b += langkah) {
        do {                                            /* d ganjil b bit yang prima relatif dengan m */
            mpz_urandomb(D, st, b);
            mpz_setbit(D, b - 1);
            mpz_setbit(D, 0);
            mpz_gcd(g, D, m);
        } while (mpz_cmp_ui(g, 1) != 0);
        mpz_urandomm(x, st, m);
        int ulang = bm <= 512 ? 400 : (bm <= 1100 ? 120 : 40);
        double tg = ukur_jalur(1, v, x, D, D, m, t1, t2, ulang);
        double tl = ukur_jalur(0, v, x, D, D, m, t1, t2, ulang);
        if (tg < tl) { batas = (int)b; kalah = 0; }
        else if (++kalah == 2) break;
    }
    mpz_clears(x, D, v, t1, t2, g, NULL);
    gmp_randclear(st);
    return batas;
}

void crt_garner_diff_exact(mpz_t *v, mpz_srcptr *m_all, const long *off, const int *idx, mpz_srcptr *r, int k, int batas_mpz)
{
    mpz_t s, D, t, t1, t2, ad;
    mpz_inits(s, D, t, t1, t2, ad, NULL);
    mpz_mod(v[0], r[0], m_all[idx[0]]);
    for (int j = 1; j < k; j++) {
        mpz_srcptr mj = m_all[idx[j]];
        long oj = off[idx[j]];
        mpz_set(s, v[j - 1]);                           /* sama dengan crt_garner_diff */
        for (int b = j - 2; b >= 0; b--) {
            mpz_mul_si(s, s, off[idx[b]] - oj);
            mpz_add(s, s, v[b]);
        }
        mpz_set_si(D, 1);
        for (int b = 0; b < j; b++) mpz_mul_si(D, D, off[idx[b]] - oj);
        mpz_sub(t, r[j], s);
        mpz_mod(t, t, mj);
        if (crt_bagi_eksak(v[j], t, D, mj, batas_mpz, t1, t2, ad) < 0) {
            fprintf(stderr, "crt_garner_diff_exact: modulus tidak saling prima\n");
            exit(1);
        }
    }
    mpz_clears(s, D, t, t1, t2, ad, NULL);
}
