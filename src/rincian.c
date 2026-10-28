/* Rincian usulan B: waktu per tahap dan ukuran bilangan antara (saran S5).
   bin/rincian [--reps 30] [--inner 50] [--seed 12345] [--out results/rincian.csv]
   Kolom keluaran: L,k,n,besaran,nilai. Semua nilai adalah median antarpengulangan.
     waktu per rekonstruksi (us): t_horner_s, t_hasilkali_D, t_invers, t_kali_reduksi, t_horner_2L,
                                  t_jumlah_tahap, t_ab_diff (fungsi asli, tanpa timer per tahap)
     ukuran (bit): bit_modulus, bit_s_maks, bit_D_maks, bit_D_akhir, bit_penyebut_shamir_maks
     jalur pembagian eksak (persen langkah): jalur_word, jalur_mpz, jalur_lama
   Setiap tahap diukur dengan timer sendiri, jadi t_jumlah_tahap sedikit lebih besar daripada
   t_ab_diff karena biaya timer ikut terhitung; bacalah sebagai porsi, bukan angka mutlak.
   Modulus untuk setiap (k, n) adalah n prima pertama dari himpunan n = 100, yang sama persis
   dengan modulus bin/bench karena keduanya prima berurutan dari 2^L + 2^(L/2). */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <gmp.h>
#include "util.h"
#include "crt.h"
#include "ab.h"

static int banding(const void *a, const void *b)
{
    double x = *(const double *)a, y = *(const double *)b;
    return (x > y) - (x < y);
}
static double median(double *v, int n)
{
    qsort(v, n, sizeof(double), banding);
    return n % 2 ? v[n / 2] : 0.5 * (v[n / 2 - 1] + v[n / 2]);
}

enum { T_HORNER, T_D, T_INV, T_KALI, T_2L, N_TAHAP };
static const char *nama_tahap[N_TAHAP] = { "t_horner_s", "t_hasilkali_D", "t_invers", "t_kali_reduksi", "t_horner_2L" };

/* usulan B (sama dengan crt_garner_diff + Horner modulo 2^L di ab.c) dengan timer per tahap */
static void b_terinstrumen(const ab_params_t *p, const int *sidx, mpz_srcptr *r, int k, mpz_t S,
                           mpz_t *v, double *t, size_t *bs, size_t *bD, size_t *bDakhir)
{
    mpz_t s, D, u, tmp;
    mpz_inits(s, D, u, tmp, NULL);
    mpz_mod(v[0], r[0], p->m[sidx[0]]);
    for (int j = 1; j < k; j++) {
        mpz_srcptr mj = p->m[sidx[j]];
        long oj = p->off[sidx[j]];
        double a = now_us();
        mpz_set(s, v[j - 1]);
        for (int b = j - 2; b >= 0; b--) { mpz_mul_si(s, s, p->off[sidx[b]] - oj); mpz_add(s, s, v[b]); }
        double b1 = now_us();
        mpz_set_si(D, 1);
        for (int b = 0; b < j; b++) mpz_mul_si(D, D, p->off[sidx[b]] - oj);
        double b2 = now_us();
        size_t ds = mpz_sizeinbase(s, 2), dd = mpz_sizeinbase(D, 2);
        if (ds > *bs) *bs = ds;
        if (dd > *bD) *bD = dd;
        if (j == k - 1) *bDakhir = dd;
        mpz_mod(D, D, mj);
        mpz_invert(D, D, mj);
        double b3 = now_us();
        mpz_sub(u, r[j], s);
        mpz_mod(u, u, mj);
        mpz_mul(u, u, D);
        mpz_mod(v[j], u, mj);
        double b4 = now_us();
        t[T_HORNER] += b1 - a; t[T_D] += b2 - b1; t[T_INV] += b3 - b2; t[T_KALI] += b4 - b3;
    }
    double c = now_us();
    mpz_set(S, v[k - 1]);
    for (int j = k - 2; j >= 0; j--) {
        mpz_mul_si(tmp, S, p->low_off[sidx[j]]);
        mpz_mul_2exp(S, S, p->low_shift);
        mpz_add(S, S, tmp);
        mpz_add(S, S, v[j]);
        mpz_fdiv_r_2exp(S, S, p->L);
    }
    mpz_fdiv_r_2exp(S, S, p->L);
    t[T_2L] += now_us() - c;
    mpz_clears(s, D, u, tmp, NULL);
}

static int banding_int(const void *a, const void *b) { return *(const int *)a - *(const int *)b; }

int main(int argc, char **argv)
{
    int reps = 30, inner = 50;
    unsigned long seed = 12345;
    const char *out = NULL;
    int koprima = 0;
    for (int i = 1; i < argc; i++) {
        if (!strcmp(argv[i], "--reps") && i + 1 < argc) reps = atoi(argv[++i]);
        else if (!strcmp(argv[i], "--inner") && i + 1 < argc) inner = atoi(argv[++i]);
        else if (!strcmp(argv[i], "--seed") && i + 1 < argc) seed = strtoul(argv[++i], NULL, 10);
        else if (!strcmp(argv[i], "--out") && i + 1 < argc) out = argv[++i];
        else if (!strcmp(argv[i], "--koprima")) koprima = 1;
        else { fprintf(stderr, "argumen tidak dikenal: %s\n", argv[i]); return 1; }
    }
    if (!out) out = koprima ? "results/rincian_koprima.csv" : "results/rincian.csv";
    FILE *f = fopen(out, "w");
    if (!f) { fprintf(stderr, "tidak bisa membuka %s\n", out); return 1; }
    fprintf(f, "L,k,n,besaran,nilai\n");
    gmp_randstate_t st;
    rng_init(st, seed);
    xrng_t xr;
    xrng_seed(&xr, seed);

    static const unsigned Ls[3] = {256, 1024, 2048};
    static const int cfg[5][2] = { {3, 5}, {5, 10}, {10, 20}, {20, 40}, {50, 100} };
    enum { B_S, B_D, B_DAKHIR, B_SH, N_UKUR };
    printf("Rincian usulan B, modulus %s (median %d pengulangan x %d pemanggilan)\n", koprima ? "saling prima" : "prima berurutan", reps, inner);
    for (int li = 0; li < 3; li++) {
        unsigned L = Ls[li];
        ab_params_t ab;
        if ((koprima ? ab_params_init_koprima(&ab, 50, 100, L) : ab_params_init(&ab, 50, 100, L)) != 0) { printf("gagal membangkitkan parameter\n"); continue; }
        ab_params_kalibrasi(&ab);
        printf("L=%u: ambang jalur GMP %d bit\n", L, ab.batas_eksak);
        for (int c = 0; c < 5; c++) {
            int k = cfg[c][0], n = cfg[c][1];
            ab_params_set_k(&ab, k);
            double *tw = malloc(sizeof(double) * (N_TAHAP + 2) * reps);
            double *uk = malloc(sizeof(double) * N_UKUR * reps);
            double *jl = malloc(sizeof(double) * 3 * reps);
            mpz_t S, R, *sh = malloc(sizeof(mpz_t) * 100), *v = malloc(sizeof(mpz_t) * k);
            mpz_inits(S, R, NULL);
            for (int i = 0; i < 100; i++) mpz_init(sh[i]);
            for (int j = 0; j < k; j++) mpz_init(v[j]);
            int *idx = malloc(sizeof(int) * k);
            mpz_srcptr *sub = malloc(sizeof(mpz_srcptr) * k);
            mpz_t den, t1, t2, ad;
            mpz_inits(den, t1, t2, ad, NULL);
            for (int rep = 0; rep < reps; rep++) {
                mpz_urandomb(S, st, L);
                ab_share(&ab, S, sh, st);
                xrng_pick_subset(&xr, n, k, idx);                 /* hanya n peserta pertama */
                qsort(idx, k, sizeof(int), banding_int);
                for (int j = 0; j < k; j++) sub[j] = sh[idx[j]];
                double t[N_TAHAP] = {0};
                size_t bs = 0, bD = 0, bDa = 0;
                for (int i = 0; i < inner; i++) b_terinstrumen(&ab, idx, sub, k, R, v, t, &bs, &bD, &bDa);
                if (mpz_cmp(R, S) != 0) { printf("SALAH: rincian L=%u k=%d\n", L, k); return 1; }
                double jumlah = 0;
                for (int q = 0; q < N_TAHAP; q++) { tw[q * reps + rep] = t[q] / inner; jumlah += t[q] / inner; }
                tw[N_TAHAP * reps + rep] = jumlah;
                double t0 = now_us();
                for (int i = 0; i < inner; i++) ab_reconstruct_diff(&ab, idx, sub, k, R);
                tw[(N_TAHAP + 1) * reps + rep] = (now_us() - t0) / inner;
                uk[B_S * reps + rep] = (double)bs;
                uk[B_D * reps + rep] = (double)bD;
                uk[B_DAKHIR * reps + rep] = (double)bDa;
                size_t bsh = 0;                                     /* penyebut Shamir, x = indeks + 1 */
                for (int j = 0; j < k; j++) {
                    mpz_set_ui(den, 1);
                    for (int l = 0; l < k; l++) if (l != j) mpz_mul_si(den, den, (long)idx[l] - (long)idx[j]);
                    size_t b = mpz_sizeinbase(den, 2);
                    if (b > bsh) bsh = b;
                }
                uk[B_SH * reps + rep] = (double)bsh;
                unsigned long sebelum[3] = { crt_jalur_hitung[0], crt_jalur_hitung[1], crt_jalur_hitung[2] };
                ab_reconstruct_diff_exact(&ab, idx, sub, k, R);
                double langkah = k > 1 ? k - 1 : 1;
                for (int q = 0; q < 3; q++) jl[q * reps + rep] = 100.0 * (crt_jalur_hitung[q] - sebelum[q]) / langkah;
            }
            double nilai[N_TAHAP + 2];
            for (int q = 0; q < N_TAHAP + 2; q++) nilai[q] = median(tw + q * reps, reps);
            for (int q = 0; q < N_TAHAP; q++) fprintf(f, "%u,%d,%d,%s,%.4f\n", L, k, n, nama_tahap[q], nilai[q]);
            fprintf(f, "%u,%d,%d,t_jumlah_tahap,%.4f\n%u,%d,%d,t_ab_diff,%.4f\n", L, k, n, nilai[N_TAHAP], L, k, n, nilai[N_TAHAP + 1]);
            static const char *nama_uk[N_UKUR] = { "bit_s_maks", "bit_D_maks", "bit_D_akhir", "bit_penyebut_shamir_maks" };
            fprintf(f, "%u,%d,%d,bit_modulus,%zu\n", L, k, n, mpz_sizeinbase(ab.m[0], 2));
            double u[N_UKUR];
            for (int q = 0; q < N_UKUR; q++) { u[q] = median(uk + q * reps, reps); fprintf(f, "%u,%d,%d,%s,%.0f\n", L, k, n, nama_uk[q], u[q]); }
            static const char *nama_jl[3] = { "jalur_word", "jalur_mpz", "jalur_lama" };
            double pj[3];
            for (int q = 0; q < 3; q++) { pj[q] = median(jl + q * reps, reps); fprintf(f, "%u,%d,%d,%s,%.1f\n", L, k, n, nama_jl[q], pj[q]); }
            printf("L=%4u (%2d,%3d): tahap Horner %.0f%%, D %.0f%%, invers %.0f%%, kali+reduksi %.0f%%, Horner 2^L %.0f%%;"
                   " bit s %.0f, D %.0f (modulus %zu), penyebut Shamir %.0f; jalur word/mpz/lama %.0f/%.0f/%.0f%%\n",
                   L, k, n, 100 * nilai[T_HORNER] / nilai[N_TAHAP], 100 * nilai[T_D] / nilai[N_TAHAP],
                   100 * nilai[T_INV] / nilai[N_TAHAP], 100 * nilai[T_KALI] / nilai[N_TAHAP], 100 * nilai[T_2L] / nilai[N_TAHAP],
                   u[B_S], u[B_D], mpz_sizeinbase(ab.m[0], 2), u[B_SH], pj[0], pj[1], pj[2]);
            fflush(f);
            for (int i = 0; i < 100; i++) mpz_clear(sh[i]);
            for (int j = 0; j < k; j++) mpz_clear(v[j]);
            mpz_clears(S, R, den, t1, t2, ad, NULL);
            free(sh); free(v); free(idx); free(sub); free(tw); free(uk); free(jl);
        }
        ab_params_clear(&ab);
    }
    fclose(f);
    gmp_randclear(st);
    printf("hasil: %s\n", out);
    return 0;
}
