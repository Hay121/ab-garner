/* Uji kebenaran: bagi lalu rekonstruksi harus kembali ke rahasia semula
   untuk banyak kasus acak, kasus tepi, dan semua himpunan bagian pada n kecil.
   Dijalankan: bin/test [seed]  */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <gmp.h>
#include "util.h"
#include "ab.h"
#include "shamir.h"
#include <math.h>

static long checks = 0, fails = 0;

static int pakai_koprima = 0;   /* 1: modulus saling prima yang tidak harus prima */

static void check(int ok, const char *what, unsigned L, int k, int n)
{
    checks++;
    if (!ok) {
        fails++;
        printf("  GAGAL: %s (L=%u k=%d n=%d)\n", what, L, k, n);
    }
}

/* himpunan bagian berikutnya dalam urutan leksikografis; 0 jika sudah habis */
static int next_comb(int *c, int k, int n)
{
    int i = k - 1;
    while (i >= 0 && c[i] == n - k + i) i--;
    if (i < 0) return 0;
    c[i]++;
    for (int j = i + 1; j < k; j++) c[j] = c[j - 1] + 1;
    return 1;
}

static void run_config(unsigned L, int k, int n, int n_secrets, int n_subsets,
                       gmp_randstate_t st, xrng_t *xr)
{
    ab_params_t ab;
    sh_params_t sh;
    if ((pakai_koprima ? ab_params_init_koprima(&ab, k, n, L) : ab_params_init(&ab, k, n, L)) != 0) {
        printf("  GAGAL: pembangkitan parameter (L=%u k=%d n=%d)\n", L, k, n);
        fails++;
        return;
    }
    check(ab_check_condition(&ab), "syarat Asmuth-Bloom", L, k, n);
    check(ab.diff_ok, "selisih modulus muat dalam long", L, k, n);
    check((int)mpz_sizeinbase(ab.m[n - 1], 2) == (int)L + 1, "ukuran share L+1 bit", L, k, n);
    sh_params_init(&sh, k, n, L);

    mpz_t S, R;
    mpz_inits(S, R, NULL);
    mpz_t *absh = malloc(sizeof(mpz_t) * n);
    mpz_t *shsh = malloc(sizeof(mpz_t) * n);
    for (int i = 0; i < n; i++) { mpz_init(absh[i]); mpz_init(shsh[i]); }
    int *idx = malloc(sizeof(int) * k);
    mpz_srcptr *sub_ab = malloc(sizeof(mpz_srcptr) * k);
    mpz_srcptr *sub_sh = malloc(sizeof(mpz_srcptr) * k);

    /* enumerasi semua subset kalau jumlahnya kecil */
    /* C(n, k) lewat min(k, n - k), berhenti begitu melewati 300 supaya tidak meluap (n = 100, k = 50) */
    long ncomb = 1;
    int kk = k < n - k ? k : n - k;
    for (int i = 0; i < kk && ncomb <= 300; i++) ncomb = ncomb * (n - i) / (i + 1);
    int enumerate = ncomb <= 300;

    for (int t = 0; t < n_secrets; t++) {
        if (t == 0) mpz_set_ui(S, 0);                       /* kasus tepi */
        else if (t == 1) mpz_set_ui(S, 1);
        else if (t == 2) { mpz_set(S, ab.m0); mpz_sub_ui(S, S, 1); }
        else mpz_urandomb(S, st, L);

        ab_share(&ab, S, absh, st);
        sh_share(&sh, S, shsh, st);
        for (int i = 0; i < n; i++)
            check(mpz_cmp(absh[i], ab.m[i]) < 0, "share < modulus", L, k, n);

        int subsets = enumerate ? (int)ncomb : n_subsets;
        for (int i = 0; i < k; i++) idx[i] = i;
        for (int u = 0; u < subsets; u++) {
            if (enumerate) { if (u > 0 && !next_comb(idx, k, n)) break; }
            else xrng_pick_subset(xr, n, k, idx);
            xrng_shuffle(xr, idx, k);                       /* urutan sembarang */
            for (int j = 0; j < k; j++) { sub_ab[j] = absh[idx[j]]; sub_sh[j] = shsh[idx[j]]; }

            ab_reconstruct_diff(&ab, idx, sub_ab, k, R);
            check(mpz_cmp(R, S) == 0, "usulan B: Garner selisih kecil", L, k, n);
            ab_reconstruct_diff_exact(&ab, idx, sub_ab, k, R);
            check(mpz_cmp(R, S) == 0, "usulan B dengan pembagian eksak", L, k, n);
            ab_reconstruct_table(&ab, idx, sub_ab, k, R);
            check(mpz_cmp(R, S) == 0, "usulan A: Garner + tabel", L, k, n);
            ab_reconstruct_garner(&ab, idx, sub_ab, k, R);
            check(mpz_cmp(R, S) == 0, "Garner dengan inversi", L, k, n);
            ab_reconstruct_classic(&ab, idx, sub_ab, k, R);
            check(mpz_cmp(R, S) == 0, "Asmuth-Bloom klasik", L, k, n);
            sh_reconstruct_naive(&sh, idx, sub_sh, k, R);
            check(mpz_cmp(R, S) == 0, "Shamir biasa", L, k, n);
            sh_reconstruct_batch(&sh, idx, sub_sh, k, R);
            check(mpz_cmp(R, S) == 0, "Shamir batch", L, k, n);
            sh_reconstruct_small(&sh, idx, sub_sh, k, R);
            check(mpz_cmp(R, S) == 0, "Shamir bilangan kecil", L, k, n);
            sh_reconstruct_exact(&sh, idx, sub_sh, k, R);
            check(mpz_cmp(R, S) == 0, "Shamir dengan pembagian eksak", L, k, n);
            if (enumerate) { /* kembalikan urutan untuk next_comb */
                for (int a = 1; a < k; a++) { int v = idx[a], b = a - 1;
                    while (b >= 0 && idx[b] > v) { idx[b + 1] = idx[b]; b--; } idx[b + 1] = v; }
            }
        }

        /* uji negatif 1: k-1 share tidak boleh memberi rahasia yang benar */
        if (t >= 3) {
            xrng_pick_subset(xr, n, k, idx);
            for (int j = 0; j < k; j++) { sub_ab[j] = absh[idx[j]]; sub_sh[j] = shsh[idx[j]]; }
            ab_reconstruct_table(&ab, idx, sub_ab, k - 1, R);
            check(mpz_cmp(R, S) != 0, "k-1 share (usulan A) menghasilkan rahasia", L, k, n);
            ab_reconstruct_diff(&ab, idx, sub_ab, k - 1, R);
            check(mpz_cmp(R, S) != 0, "k-1 share (usulan B) menghasilkan rahasia", L, k, n);
            sh_reconstruct_batch(&sh, idx, sub_sh, k - 1, R);
            check(mpz_cmp(R, S) != 0, "k-1 share (Shamir) menghasilkan rahasia", L, k, n);
            sh_reconstruct_small(&sh, idx, sub_sh, k - 1, R);
            check(mpz_cmp(R, S) != 0, "k-1 share (Shamir bilangan kecil) menghasilkan rahasia", L, k, n);
            ab_reconstruct_diff_exact(&ab, idx, sub_ab, k - 1, R);
            check(mpz_cmp(R, S) != 0, "k-1 share (usulan B eksak) menghasilkan rahasia", L, k, n);
            sh_reconstruct_exact(&sh, idx, sub_sh, k - 1, R);
            check(mpz_cmp(R, S) != 0, "k-1 share (Shamir eksak) menghasilkan rahasia", L, k, n);

            /* uji negatif 2: satu share dirusak, hasil harus salah (tidak ada deteksi) */
            mpz_t bad; mpz_init(bad);
            mpz_add_ui(bad, absh[idx[0]], 1);
            mpz_mod(bad, bad, ab.m[idx[0]]);
            sub_ab[0] = bad;
            ab_reconstruct_table(&ab, idx, sub_ab, k, R);
            check(mpz_cmp(R, S) != 0, "share rusak tetap memberi rahasia", L, k, n);
            ab_reconstruct_diff(&ab, idx, sub_ab, k, R);
            check(mpz_cmp(R, S) != 0, "share rusak tetap memberi rahasia (usulan B)", L, k, n);
            ab_reconstruct_diff_exact(&ab, idx, sub_ab, k, R);
            check(mpz_cmp(R, S) != 0, "share rusak tetap memberi rahasia (usulan B eksak)", L, k, n);
            mpz_clear(bad);
        }
    }

    for (int i = 0; i < n; i++) { mpz_clear(absh[i]); mpz_clear(shsh[i]); }
    free(absh); free(shsh); free(idx); free(sub_ab); free(sub_sh);
    mpz_clears(S, R, NULL);
    ab_params_clear(&ab);
    sh_params_clear(&sh);
}

/* Uji kebocoran skala kecil untuk semua pasangan peserta.
   Parameter mainan: m0 = 2^8, modulus 307 311 313 317 331, k = 3, n = 5.
   y = S + A*m0 dengan 0 <= A < cnt = floor(Mk/m0), jadi kandidat y dihitung sampai cnt*m0.
   Dua share memberi y mod Q (Q = hasil kali modulus keduanya). Untuk setiap nilai rahasia dihitung
   berapa kandidat y yang cocok, lalu jarak statistik ke sebaran seragam. Rumus pembanding:
   cnt/Q = 1 + eps, jarak = eps(1 - eps)/(1 + eps). */
static void leakage_demo(gmp_randstate_t st)
{
    static const unsigned long mods[5] = {307, 311, 313, 317, 331};
    ab_params_t ab;
    if (ab_params_init_explicit(&ab, 3, 5, 8, mods) != 0) { fails++; return; }

    mpz_t S, y0, Q, cand, batas, cnt;
    mpz_inits(S, y0, Q, cand, batas, cnt, NULL);
    mpz_t sh[5];
    for (int i = 0; i < 5; i++) mpz_init(sh[i]);
    mpz_urandomb(S, st, 8);
    ab_share(&ab, S, sh, st);
    mpz_fdiv_q(cnt, ab.Mk, ab.m0);
    mpz_mul(batas, cnt, ab.m0);
    gmp_printf("  rahasia S = %Zd; y < floor(Mk/m0)*m0 = %Zd\n", S, batas);

    double d_maks = 0;
    int a_maks = 0, b_maks = 1;
    for (int a = 0; a < 5; a++) {
        for (int b = a + 1; b < 5; b++) {
            mpz_srcptr sub[2] = {sh[a], sh[b]};
            mpz_srcptr mm[2] = {ab.m[a], ab.m[b]};
            crt_garner_inv(y0, mm, sub, 2);          /* y mod Q */
            mpz_mul(Q, ab.m[a], ab.m[b]);
            long count[256] = {0}, total = 0, distinct = 0;
            for (mpz_set(cand, y0); mpz_cmp(cand, batas) < 0; mpz_add(cand, cand, Q)) {
                count[mpz_fdiv_ui(cand, 256)]++;
                total++;
            }
            double jarak = 0;
            for (int s = 0; s < 256; s++) {
                if (count[s]) distinct++;
                jarak += fabs((double)count[s] / (double)total - 1.0 / 256.0);
            }
            jarak /= 2;
            double eps = mpz_get_d(cnt) / mpz_get_d(Q) - 1.0;
            printf("  peserta %d dan %d: %ld kandidat y, %ld dari 256 nilai rahasia mungkin, "
                   "jarak statistik %.4f (rumus %.4f)\n", a + 1, b + 1, total, distinct, jarak,
                   eps * (1 - eps) / (1 + eps));
            check(distinct == 256, "k-1 share mengeliminasi sebagian nilai rahasia", 8, 3, 5);
            if (jarak > d_maks) { d_maks = jarak; a_maks = a; b_maks = b; }
        }
    }
    printf("  jarak statistik terbesar %.4f (peserta %d dan %d)\n", d_maks, a_maks + 1, b_maks + 1);

    for (int i = 0; i < 5; i++) mpz_clear(sh[i]);
    mpz_clears(S, y0, Q, cand, batas, cnt, NULL);
    ab_params_clear(&ab);
}

int main(int argc, char **argv)
{
    unsigned long seed = argc > 1 ? strtoul(argv[1], NULL, 10) : 12345;
    gmp_randstate_t st;
    rng_init(st, seed);
    xrng_t xr;
    xrng_seed(&xr, seed);

    struct { unsigned L; int k, n, secrets, subsets; } cfg[] = {
        { 64,   2,  3, 20, 0 },
        { 64,   3,  5, 20, 0 },
        { 64,   5, 10, 20, 0 },
        { 64,   5,  5, 10, 0 },     /* k = n */
        { 256,  3,  5, 20, 0 },
        { 256,  5, 10, 20, 0 },
        { 256, 10, 20, 10, 30 },
        { 256, 20, 40,  6, 20 },
        { 2048, 3,  5, 10, 0 },
        { 2048, 10, 20, 4, 10 },
        { 1024, 5,  10, 10, 0 },    /* ukuran yang dipakai benchmark */
        { 1024, 10, 10, 4, 0 },     /* k = n pada ukuran sungguhan */
        { 256,  50, 100, 2, 4 },    /* k besar: hasil kali selisih D melampaui modulus */
        { 1024, 50, 100, 1, 2 },
    };
    int ncfg = (int)(sizeof(cfg) / sizeof(cfg[0]));

    printf("Uji kebenaran, seed %lu\n", seed);
    for (int c = 0; c < ncfg; c++) {
        long before = fails;
        printf("L=%u k=%d n=%d ...\n", cfg[c].L, cfg[c].k, cfg[c].n);
        run_config(cfg[c].L, cfg[c].k, cfg[c].n, cfg[c].secrets, cfg[c].subsets, st, &xr);
        printf("  %s\n", fails == before ? "lulus" : "ADA KEGAGALAN");
    }
    /* modulus saling prima yang tidak harus prima: semua metode harus tetap benar */
    pakai_koprima = 1;
    static const struct { unsigned L; int k, n, secrets, subsets; } kop[] = {
        { 64, 3, 5, 20, 0 }, { 256, 3, 5, 10, 0 }, { 256, 10, 20, 4, 10 }, { 256, 50, 100, 2, 4 },
        { 1024, 10, 10, 4, 0 }, { 2048, 10, 20, 2, 6 },
    };
    for (size_t c = 0; c < sizeof kop / sizeof kop[0]; c++) {
        printf("modulus saling prima: L=%u, k=%d, n=%d\n", kop[c].L, kop[c].k, kop[c].n);
        run_config(kop[c].L, kop[c].k, kop[c].n, kop[c].secrets, kop[c].subsets, st, &xr);
    }
    pakai_koprima = 0;

    printf("Uji kebocoran skala kecil (semua pasangan peserta):\n");
    leakage_demo(st);

    /* ketiga jalur pembagian eksak harus benar-benar terlewati oleh uji di atas */
    printf("Jalur pembagian eksak: satu word %lu kali, mpz %lu kali, cara lama %lu kali\n",
           crt_jalur_hitung[0], crt_jalur_hitung[1], crt_jalur_hitung[2]);
#ifndef UJI_JALUR_PAKSA   /* varian test-jalur sengaja mematikan sebagian jalur */
    check(crt_jalur_hitung[0] > 0 && crt_jalur_hitung[1] > 0 && crt_jalur_hitung[2] > 0,
          "ada jalur pembagian eksak yang tidak teruji", 0, 0, 0);
#endif

    printf("\nTotal pemeriksaan: %ld, gagal: %ld\n", checks, fails);
    gmp_randclear(st);
    return fails ? 1 : 0;
}
