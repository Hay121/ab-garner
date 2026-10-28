/* Kebocoran informasi dari k - 1 share (saran S6).
   y = S + A*m0 dengan 0 <= A < cnt = floor(Mk/m0). Penyerang dengan k - 1 share mengetahui y mod Q,
   Q = hasil kali modulus mereka. Bila cnt/Q = 1 + eps dengan 0 <= eps < 1, setiap nilai rahasia
   cocok dengan 1 atau 2 nilai A, dan jarak statistik sebaran posterior rahasia ke sebaran seragam
   adalah eps(1 - eps)/(1 + eps), kira-kira eps. Q terbesar (k - 1 modulus terbesar) memberi eps
   terkecil; Q terkecil (k - 1 modulus terkecil) memberi eps terbesar.
   Bagian 1: eps untuk parameter benchmark (modulus prima berurutan dari 2^L + 2^(L/2)).
   Bagian 2: eps terhadap margin untuk L = 256, modulus prima berurutan dari 2^L + 2^margin.
   bin/keamanan [--out results/keamanan.csv] */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <gmp.h>

static double log2z(const mpz_t x)                  /* log2 bilangan positif */
{
    long e;
    double d = mpz_get_d_2exp(&e, x);
    return log2(d) + (double)e;
}

/* log2(cnt/Q - 1); mengembalikan 0 dan *ok = 0 bila cnt < Q (syarat gagal) atau cnt >= 2Q */
static double log2_eps(const mpz_t cnt, const mpz_t Q, int *ok)
{
    mpz_t sel, dua;
    mpz_inits(sel, dua, NULL);
    mpz_sub(sel, cnt, Q);
    mpz_mul_2exp(dua, Q, 1);
    double h = 0;
    *ok = mpz_sgn(sel) >= 0 && mpz_cmp(cnt, dua) < 0;
    if (*ok && mpz_sgn(sel) > 0) h = log2z(sel) - log2z(Q);
    else if (*ok) h = -INFINITY;
    mpz_clears(sel, dua, NULL);
    return h;
}

/* n prima berurutan mulai dari 2^L + 2^margin */
static void bangkitkan(mpz_t *m, int n, unsigned L, unsigned margin)
{
    mpz_t awal;
    mpz_init(awal);
    mpz_setbit(awal, L);
    mpz_setbit(awal, margin);
    mpz_nextprime(m[0], awal);
    for (int i = 1; i < n; i++) mpz_nextprime(m[i], m[i - 1]);
    mpz_clear(awal);
}

/* eps terkecil dan terbesar untuk n prima pertama, ambang k; *syarat = syarat Asmuth-Bloom */
static void hitung(mpz_t *m, int k, int n, unsigned L, double *emin, double *emaks, int *syarat)
{
    mpz_t Mk, cnt, Qmaks, Qmin, m0;
    mpz_inits(Mk, cnt, Qmaks, Qmin, m0, NULL);
    mpz_setbit(m0, L);
    mpz_set_ui(Mk, 1);
    for (int i = 0; i < k; i++) mpz_mul(Mk, Mk, m[i]);
    mpz_fdiv_q(cnt, Mk, m0);
    mpz_set_ui(Qmaks, 1);
    for (int i = n - (k - 1); i < n; i++) mpz_mul(Qmaks, Qmaks, m[i]);
    mpz_set_ui(Qmin, 1);
    for (int i = 0; i < k - 1; i++) mpz_mul(Qmin, Qmin, m[i]);
    mpz_t kiri;
    mpz_init(kiri);
    mpz_mul(kiri, m0, Qmaks);
    *syarat = mpz_cmp(kiri, Mk) < 0;
    int ok1, ok2;
    *emin = log2_eps(cnt, Qmaks, &ok1);
    *emaks = log2_eps(cnt, Qmin, &ok2);
    if (!ok1) *emin = NAN;
    if (!ok2) *emaks = NAN;
    mpz_clears(Mk, cnt, Qmaks, Qmin, m0, kiri, NULL);
}

/* n modulus saling prima dipilih rakus dari bilangan ganjil di dekat 2^L + 2^(L/2) (sama dengan ab_params_init_koprima) */
static void bangkitkan_koprima(mpz_t *m, int n, unsigned L)
{
    mpz_t B;
    mpz_init(B);
    mpz_setbit(B, L); mpz_setbit(B, L / 2); mpz_setbit(B, 0);
    unsigned long *o = malloc(sizeof(unsigned long) * n);
    int ada = 0;
    for (unsigned long d = 0; ada < n; d += 2) {
        int cocok = 1;
        mpz_add_ui(m[ada], B, d);
        for (int i = 0; i < ada && cocok; i++)
            if (mpz_gcd_ui(NULL, m[ada], d - o[i]) != 1) cocok = 0;
        if (cocok) o[ada++] = d;
    }
    free(o);
    mpz_clear(B);
}

int main(int argc, char **argv)
{
    const char *out = "results/keamanan.csv";
    for (int i = 1; i < argc; i++) {
        if (!strcmp(argv[i], "--out") && i + 1 < argc) out = argv[++i];
        else { fprintf(stderr, "argumen tidak dikenal: %s\n", argv[i]); return 1; }
    }
    FILE *f = fopen(out, "w");
    if (!f) { fprintf(stderr, "tidak bisa membuka %s\n", out); return 1; }
    fprintf(f, "bagian,L,k,n,margin,syarat,log2_eps_min,log2_eps_maks\n");
    mpz_t *m = malloc(sizeof(mpz_t) * 100);
    for (int i = 0; i < 100; i++) mpz_init(m[i]);

    static const unsigned Ls[3] = {256, 1024, 2048};
    static const int cfg[5][2] = { {3, 5}, {5, 10}, {10, 20}, {20, 40}, {50, 100} };
    printf("Bagian 1: eps untuk parameter benchmark (margin L/2)\n");
    for (int li = 0; li < 3; li++) {
        bangkitkan(m, 100, Ls[li], Ls[li] / 2);
        for (int c = 0; c < 5; c++) {
            double a, b;
            int sy;
            hitung(m, cfg[c][0], cfg[c][1], Ls[li], &a, &b, &sy);
            fprintf(f, "benchmark,%u,%d,%d,%u,%d,%.3f,%.3f\n", Ls[li], cfg[c][0], cfg[c][1], Ls[li] / 2, sy, a, b);
            printf("  L=%4u (%2d,%3d): syarat %s, log2 eps antara %.2f dan %.2f\n", Ls[li], cfg[c][0], cfg[c][1],
                   sy ? "terpenuhi" : "GAGAL", a, b);
        }
    }

    printf("Bagian 2: eps terhadap margin, L = 256\n");
    static const unsigned margins[] = {20, 24, 28, 32, 48, 64, 96, 128, 160, 192, 224, 240};
    static const int kn[2][2] = { {5, 10}, {50, 100} };
    for (size_t g = 0; g < sizeof margins / sizeof margins[0]; g++) {
        bangkitkan(m, 100, 256, margins[g]);
        for (int c = 0; c < 2; c++) {
            double a, b;
            int sy;
            hitung(m, kn[c][0], kn[c][1], 256, &a, &b, &sy);
            fprintf(f, "margin,256,%d,%d,%u,%d,%.3f,%.3f\n", kn[c][0], kn[c][1], margins[g], sy, a, b);
            printf("  margin %3u (%2d,%3d): syarat %s, log2 eps antara %.2f dan %.2f\n", margins[g], kn[c][0], kn[c][1],
                   sy ? "terpenuhi" : "gagal", a, b);
        }
    }
    printf("Bagian 3: eps untuk modulus saling prima yang tidak harus prima\n");
    for (int li = 0; li < 3; li++) {
        bangkitkan_koprima(m, 100, Ls[li]);
        for (int c = 0; c < 5; c++) {
            double a, b;
            int sy;
            hitung(m, cfg[c][0], cfg[c][1], Ls[li], &a, &b, &sy);
            fprintf(f, "koprima,%u,%d,%d,%u,%d,%.3f,%.3f\n", Ls[li], cfg[c][0], cfg[c][1], Ls[li] / 2, sy, a, b);
            printf("  L=%4u (%2d,%3d): syarat %s, log2 eps antara %.2f dan %.2f\n", Ls[li], cfg[c][0], cfg[c][1],
                   sy ? "terpenuhi" : "GAGAL", a, b);
        }
    }
    for (int i = 0; i < 100; i++) mpz_clear(m[i]);
    free(m);
    fclose(f);
    printf("hasil: %s\n", out);
    return 0;
}
