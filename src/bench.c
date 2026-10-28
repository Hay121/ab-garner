/* Benchmark: waktu pembuatan share dan rekonstruksi untuk semua metode.
   bin/bench [--paket utama|tambahan] [--reps 30] [--inner 50] [--warmup 3] [--seed 12345]
             [--L 0|256|1024|2048] [--max-n 100] [--out results/bench.csv] [--sizes results/sizes.csv]

   Paket utama (results/bench.csv, format sama dengan versi sebelumnya):
     L = 256, 1024, 2048 dan (k, n) = (3,5) (5,10) (10,20) (20,40) (50,100).
   Paket tambahan (results/tambahan.csv, kolom pertama = nama eksperimen):
     n_tetap   n = 100, k = 3, 5, 10, 20, 50, modulus dibangkitkan sekali per L
     k_sama_n  k = n = 3, 5, 10
     L_rapat   L = 512, 768, 1536, 3072 untuk (3,5) dan (10,20)
     dingin    satu pemanggilan per pengukuran, cache dibersihkan sebelum setiap pemanggilan

   Semua metode memakai rahasia dan subset yang sama dalam satu pengulangan (rancangan berpasangan).
   Urutan metode rekonstruksi diacak setiap pengulangan dengan pembangkit terpisah, sehingga rahasia
   dan subset tetap sama dengan versi sebelumnya. */
#ifdef __linux__
#define _GNU_SOURCE
#include <sched.h>
#endif
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <gmp.h>
#include "util.h"
#include "crt.h"
#include "ab.h"
#include "shamir.h"
#ifdef _WIN32
#include <windows.h>
#endif

#ifndef FLAGS_KOMPILASI
#define FLAGS_KOMPILASI "tidak dicatat"
#endif

enum { OP_AB_SHARE, OP_SH_SHARE,
       OP_DIFF, OP_DIFF_EXACT, OP_TABLE, OP_GARNER_INV, OP_CLASSIC,
       OP_SH_NAIVE, OP_SH_BATCH, OP_SH_SMALL, OP_SH_EXACT, OP_COUNT };
static const char *op_name[OP_COUNT] = {
    "ab_share", "shamir_share",
    "ab_diff", "ab_diff_exact", "ab_table", "ab_garner_inv", "ab_classic",
    "shamir_naive", "shamir_batch", "shamir_small", "shamir_exact"
};
#define OP_REKON_AWAL OP_DIFF
#define N_REKON (OP_COUNT - OP_REKON_AWAL)

typedef struct {
    FILE       *f;
    const char *eksperimen;   /* NULL: format CSV paket utama */
} keluaran_t;

static void tulis(const keluaran_t *o, const char *method, const char *phase, unsigned L, int k, int n,
                  int rep, int inner, double us)
{
    if (o->eksperimen) fprintf(o->f, "%s,", o->eksperimen);
    fprintf(o->f, "%s,%s,%u,%d,%d,%d,%d,%.4f\n", method, phase, L, k, n, rep, inner, us);
}

static void rekonstruksi(int op, const ab_params_t *ab, const sh_params_t *sh, const int *idx,
                         mpz_srcptr *sub_ab, mpz_srcptr *sub_sh, int k, mpz_t R)
{
    switch (op) {
    case OP_DIFF:       ab_reconstruct_diff(ab, idx, sub_ab, k, R); break;
    case OP_DIFF_EXACT: ab_reconstruct_diff_exact(ab, idx, sub_ab, k, R); break;
    case OP_TABLE:      ab_reconstruct_table(ab, idx, sub_ab, k, R); break;
    case OP_GARNER_INV: ab_reconstruct_garner(ab, idx, sub_ab, k, R); break;
    case OP_CLASSIC:    ab_reconstruct_classic(ab, idx, sub_ab, k, R); break;
    case OP_SH_NAIVE:   sh_reconstruct_naive(sh, idx, sub_sh, k, R); break;
    case OP_SH_BATCH:   sh_reconstruct_batch(sh, idx, sub_sh, k, R); break;
    case OP_SH_SMALL:   sh_reconstruct_small(sh, idx, sub_sh, k, R); break;
    case OP_SH_EXACT:   sh_reconstruct_exact(sh, idx, sub_sh, k, R); break;
    }
}

/* tulis ke 24 MB memori supaya data metode berikutnya tidak lagi ada di cache (L3 laptop uji 12 MB) */
static volatile unsigned char *penyapu;
static void bersihkan_cache(void)
{
    const size_t besar = 24u << 20;
    if (!penyapu) penyapu = malloc(besar);
    for (size_t i = 0; i < besar; i += 64) penyapu[i]++;
}

static int banding_double(const void *a, const void *b)
{
    double x = *(const double *)a, y = *(const double *)b;
    return (x > y) - (x < y);
}

/* median dan kuartil 1, 3 (interpolasi linear) */
static void kuartil(const double *v, int n, double *q1, double *med, double *q3)
{
    double *s = malloc(sizeof(double) * n);
    memcpy(s, v, sizeof(double) * n);
    qsort(s, n, sizeof(double), banding_double);
    double posisi[3] = {0.25, 0.5, 0.75}, hasil[3];
    for (int i = 0; i < 3; i++) {
        double h = posisi[i] * (n - 1);
        int a = (int)h;
        double f = h - a;
        hasil[i] = (a + 1 < n) ? s[a] + f * (s[a + 1] - s[a]) : s[a];
    }
    *q1 = hasil[0]; *med = hasil[1]; *q3 = hasil[2];
    free(s);
}

/* satu konfigurasi: reps pengulangan (setelah warmup), semua metode pada rahasia dan subset yang sama.
   dingin = 1: satu pemanggilan per pengukuran dan cache dibersihkan sebelum setiap rekonstruksi. */
static void ukur(const ab_params_t *ab, const sh_params_t *sh, unsigned L, int k, int n,
                 int reps, int inner, int warmup, int dingin,
                 gmp_randstate_t st, xrng_t *xr, xrng_t *xr_urut, const keluaran_t *o)
{
    mpz_t S, R;
    mpz_inits(S, R, NULL);
    mpz_t *absh = malloc(sizeof(mpz_t) * n);
    mpz_t *shsh = malloc(sizeof(mpz_t) * n);
    for (int i = 0; i < n; i++) { mpz_init(absh[i]); mpz_init(shsh[i]); }
    int *idx = malloc(sizeof(int) * k);
    mpz_srcptr *sub_ab = malloc(sizeof(mpz_srcptr) * k);
    mpz_srcptr *sub_sh = malloc(sizeof(mpz_srcptr) * k);
    double *vals = malloc(sizeof(double) * OP_COUNT * reps);
    int urut[N_REKON];
    for (int q = 0; q < N_REKON; q++) urut[q] = OP_REKON_AWAL + q;
    int ulang = dingin ? 1 : inner;

    for (int rep = 0; rep < warmup + reps; rep++) {
        double us[OP_COUNT], t0;
        mpz_urandomb(S, st, L);

        t0 = now_us();
        for (int i = 0; i < inner; i++) ab_share(ab, S, absh, st);
        us[OP_AB_SHARE] = (now_us() - t0) / inner;

        t0 = now_us();
        for (int i = 0; i < inner; i++) sh_share(sh, S, shsh, st);
        us[OP_SH_SHARE] = (now_us() - t0) / inner;

        xrng_pick_subset(xr, n, k, idx);
        for (int j = 0; j < k; j++) { sub_ab[j] = absh[idx[j]]; sub_sh[j] = shsh[idx[j]]; }

        xrng_shuffle(xr_urut, urut, N_REKON);
        for (int q = 0; q < N_REKON; q++) {
            int op = urut[q];
            if (dingin) bersihkan_cache();
            t0 = now_us();
            for (int i = 0; i < ulang; i++) rekonstruksi(op, ab, sh, idx, sub_ab, sub_sh, k, R);
            us[op] = (now_us() - t0) / ulang;
            if (mpz_cmp(R, S) != 0) { printf("SALAH: %s (L=%u k=%d n=%d)\n", op_name[op], L, k, n); exit(1); }
        }

        if (rep < warmup) continue;
        int r = rep - warmup;
        for (int op = 0; op < OP_COUNT; op++) {
            if (dingin && op < OP_REKON_AWAL) continue;      /* waktu share dingin tidak dicatat */
            vals[op * reps + r] = us[op];
            tulis(o, op_name[op], op < OP_REKON_AWAL ? "share" : "reconstruct", L, k, n, r + 1, ulang, us[op]);
        }
    }
    fflush(o->f);

    printf("%-16s %12s %12s %12s   (us per operasi, %d rep x %d pemanggilan)\n",
           "metode", "median", "kuartil 1", "kuartil 3", reps, ulang);
    for (int op = dingin ? OP_REKON_AWAL : 0; op < OP_COUNT; op++) {
        double q1, med, q3;
        kuartil(vals + op * reps, reps, &q1, &med, &q3);
        printf("%-16s %12.3f %12.3f %12.3f\n", op_name[op], med, q1, q3);
    }

    for (int i = 0; i < n; i++) { mpz_clear(absh[i]); mpz_clear(shsh[i]); }
    free(absh); free(shsh); free(idx); free(sub_ab); free(sub_sh); free(vals);
    mpz_clears(S, R, NULL);
}

/* paket utama: parameter dibangkitkan per konfigurasi, setup dan ukuran ikut dicatat */
/* kunci proses pada satu core dan naikkan prioritasnya, supaya penjadwal sistem operasi tidak memindahkan
   benchmark ke core lain di tengah pengukuran */
static void kunci_core(int inti)
{
    if (inti < 0) return;
#ifdef _WIN32
    SetProcessAffinityMask(GetCurrentProcess(), (DWORD_PTR)1 << inti);
    SetPriorityClass(GetCurrentProcess(), HIGH_PRIORITY_CLASS);
    printf("proses dikunci pada core %d dengan prioritas tinggi\n", inti);
#elif defined(__linux__)
    cpu_set_t set;
    CPU_ZERO(&set);
    CPU_SET(inti, &set);
    if (sched_setaffinity(0, sizeof set, &set) == 0) printf("proses dikunci pada core %d\n", inti);
#endif
}

static int pakai_koprima = 0;

static void konfigurasi_utama(unsigned L, int k, int n, int reps, int inner, int warmup,
                              gmp_randstate_t st, xrng_t *xr, xrng_t *xr_urut,
                              const keluaran_t *o, FILE *fsizes)
{
    printf("\n=== L=%u bit, k=%d, n=%d ===\n", L, k, n);
    ab_params_t ab;
    double t0 = now_us();
    if ((pakai_koprima ? ab_params_init_koprima(&ab, k, n, L) : ab_params_init(&ab, k, n, L)) != 0) { printf("gagal membangkitkan parameter\n"); return; }
    double t_ab_setup = now_us() - t0;

    inv_table_t tmp;
    t0 = now_us();
    inv_table_build(&tmp, ab.mall, n);       /* ukur biaya tabel saja */
    double t_table = now_us() - t0;
    size_t table_bytes = inv_table_bytes(&tmp);
    inv_table_clear(&tmp);

    sh_params_t sh;
    t0 = now_us();
    sh_params_init(&sh, k, n, L);
    double t_sh_setup = now_us() - t0;

    double tk = now_us();
    ab_params_kalibrasi(&ab);
    sh_params_kalibrasi(&sh);
    printf("kalibrasi ambang: %.1f ms (tidak termasuk setup)\n", (now_us() - tk) / 1000);
    tulis(o, "ab_setup_total", "setup", L, k, n, 0, 1, t_ab_setup);
    tulis(o, "ab_setup_table", "setup", L, k, n, 0, 1, t_table);
    tulis(o, "shamir_setup", "setup", L, k, n, 0, 1, t_sh_setup);

    size_t ab_bits = mpz_sizeinbase(ab.m[n - 1], 2);
    size_t sh_bits = mpz_sizeinbase(sh.p, 2);
    fprintf(fsizes, "%u,%d,%d,%zu,%zu,%ld,%zu,%d,%d\n", L, k, n, ab_bits, sh_bits, (long)n * (n - 1) / 2, table_bytes, ab.batas_eksak, sh.batas_eksak);
    printf("ambang jalur GMP pembagian eksak (kalibrasi): Asmuth-Bloom %d bit, Shamir %d bit\n", ab.batas_eksak, sh.batas_eksak);
    printf("setup: Asmuth-Bloom %.1f us (tabel %.1f us, %zu entri, %zu byte), Shamir %.1f us\n",
           t_ab_setup, t_table, (size_t)n * (n - 1) / 2, table_bytes, t_sh_setup);
    printf("ukuran share: Asmuth-Bloom %zu bit, Shamir %zu bit\n", ab_bits, sh_bits);

    ukur(&ab, &sh, L, k, n, reps, inner, warmup, 0, st, xr, xr_urut, o);
    ab_params_clear(&ab);
    sh_params_clear(&sh);
}

static void paket_tambahan(gmp_randstate_t st, xrng_t *xr, xrng_t *xr_urut, FILE *f)
{
    const int reps = 20, inner = 30, warmup = 2;
    keluaran_t o = { f, NULL };
    static const unsigned Lp[2] = {256, 2048};

    o.eksperimen = "n_tetap";                    /* n = 100, hanya k yang berubah */
    for (int li = 0; li < 2; li++) {
        ab_params_t ab;
        if (ab_params_init(&ab, 50, 100, Lp[li]) != 0) { printf("gagal membangkitkan parameter\n"); continue; }
        ab_params_kalibrasi(&ab);
        static const int ks[5] = {3, 5, 10, 20, 50};
        for (int c = 0; c < 5; c++) {
            if (ab_params_set_k(&ab, ks[c]) != 0) { printf("syarat gagal untuk k=%d\n", ks[c]); continue; }
            sh_params_t sh;
            sh_params_init(&sh, ks[c], 100, Lp[li]);
            sh_params_kalibrasi(&sh);
            printf("\n=== n tetap: L=%u bit, k=%d, n=100 ===\n", Lp[li], ks[c]);
            ukur(&ab, &sh, Lp[li], ks[c], 100, reps, inner, warmup, 0, st, xr, xr_urut, &o);
            sh_params_clear(&sh);
        }
        ab_params_clear(&ab);
    }

    o.eksperimen = "k_sama_n";                   /* semua peserta wajib hadir */
    for (int li = 0; li < 2; li++) {
        static const int ks[3] = {3, 5, 10};
        for (int c = 0; c < 3; c++) {
            ab_params_t ab;
            sh_params_t sh;
            if (ab_params_init(&ab, ks[c], ks[c], Lp[li]) != 0) continue;
            sh_params_init(&sh, ks[c], ks[c], Lp[li]);
            ab_params_kalibrasi(&ab);
            sh_params_kalibrasi(&sh);
            printf("\n=== k = n: L=%u bit, k=n=%d ===\n", Lp[li], ks[c]);
            ukur(&ab, &sh, Lp[li], ks[c], ks[c], reps, inner, warmup, 0, st, xr, xr_urut, &o);
            ab_params_clear(&ab);
            sh_params_clear(&sh);
        }
    }

    o.eksperimen = "L_rapat";                    /* mencari titik silang antarmetode */
    static const unsigned Lr[4] = {512, 768, 1536, 3072};
    static const int kn[2][2] = { {3, 5}, {10, 20} };
    for (int li = 0; li < 4; li++) {
        for (int c = 0; c < 2; c++) {
            ab_params_t ab;
            sh_params_t sh;
            if (ab_params_init(&ab, kn[c][0], kn[c][1], Lr[li]) != 0) continue;
            sh_params_init(&sh, kn[c][0], kn[c][1], Lr[li]);
            ab_params_kalibrasi(&ab);
            sh_params_kalibrasi(&sh);
            printf("\n=== L rapat: L=%u bit, k=%d, n=%d ===\n", Lr[li], kn[c][0], kn[c][1]);
            ukur(&ab, &sh, Lr[li], kn[c][0], kn[c][1], reps, inner, warmup, 0, st, xr, xr_urut, &o);
            ab_params_clear(&ab);
            sh_params_clear(&sh);
        }
    }

    o.eksperimen = "dingin";                     /* satu pemanggilan, cache dibersihkan */
    for (int li = 0; li < 2; li++) {
        for (int c = 0; c < 2; c++) {
            ab_params_t ab;
            sh_params_t sh;
            if (ab_params_init(&ab, kn[c][0], kn[c][1], Lp[li]) != 0) continue;
            sh_params_init(&sh, kn[c][0], kn[c][1], Lp[li]);
            ab_params_kalibrasi(&ab);
            sh_params_kalibrasi(&sh);
            printf("\n=== data dingin: L=%u bit, k=%d, n=%d ===\n", Lp[li], kn[c][0], kn[c][1]);
            ukur(&ab, &sh, Lp[li], kn[c][0], kn[c][1], 100, 1, 3, 1, st, xr, xr_urut, &o);
            ab_params_clear(&ab);
            sh_params_clear(&sh);
        }
    }
}

int main(int argc, char **argv)
{
    int reps = 30, inner = 50, warmup = 3, max_n = 100, inti = -1;
    unsigned only_L = 0;
    unsigned long seed = 12345;
    const char *paket = "utama";
    const char *out = NULL, *sizes = "results/sizes.csv";

    for (int i = 1; i < argc; i++) {
        if (!strcmp(argv[i], "--paket") && i + 1 < argc) paket = argv[++i];
        else if (!strcmp(argv[i], "--reps") && i + 1 < argc) reps = atoi(argv[++i]);
        else if (!strcmp(argv[i], "--inner") && i + 1 < argc) inner = atoi(argv[++i]);
        else if (!strcmp(argv[i], "--warmup") && i + 1 < argc) warmup = atoi(argv[++i]);
        else if (!strcmp(argv[i], "--seed") && i + 1 < argc) seed = strtoul(argv[++i], NULL, 10);
        else if (!strcmp(argv[i], "--L") && i + 1 < argc) only_L = (unsigned)atoi(argv[++i]);
        else if (!strcmp(argv[i], "--max-n") && i + 1 < argc) max_n = atoi(argv[++i]);
        else if (!strcmp(argv[i], "--inti") && i + 1 < argc) inti = atoi(argv[++i]);
        else if (!strcmp(argv[i], "--out") && i + 1 < argc) out = argv[++i];
        else if (!strcmp(argv[i], "--sizes") && i + 1 < argc) sizes = argv[++i];
        else { fprintf(stderr, "argumen tidak dikenal: %s\n", argv[i]); return 1; }
    }
    int tambahan = !strcmp(paket, "tambahan");
    pakai_koprima = !strcmp(paket, "koprima");
    if (!tambahan && !pakai_koprima && strcmp(paket, "utama")) { fprintf(stderr, "paket harus utama, tambahan, atau koprima\n"); return 1; }
    if (!out) out = tambahan ? "results/tambahan.csv" : (pakai_koprima ? "results/koprima.csv" : "results/bench.csv");
    if (pakai_koprima && !strcmp(sizes, "results/sizes.csv")) sizes = "results/sizes_koprima.csv";
    kunci_core(inti);

    FILE *fcsv = fopen(out, "w");
    if (!fcsv) { fprintf(stderr, "tidak bisa membuka %s (folder results/ ada?)\n", out); return 1; }

    gmp_randstate_t st;
    rng_init(st, seed);
    xrng_t xr, xr_urut;
    xrng_seed(&xr, seed);
    xrng_seed(&xr_urut, seed ^ 0x9E3779B97F4A7C15ULL);   /* pembangkit terpisah untuk urutan metode */

    printf("paket=%s seed=%lu (GMP %s; gcc %s; opsi %s)\n", paket, seed, gmp_version, __VERSION__, FLAGS_KOMPILASI);
    if (tambahan) {
        fprintf(fcsv, "eksperimen,method,phase,L,k,n,rep,inner,us_per_op\n");
        paket_tambahan(st, &xr, &xr_urut, fcsv);
    } else {
        FILE *fsizes = fopen(sizes, "w");
        if (!fsizes) { fprintf(stderr, "tidak bisa membuka %s\n", sizes); return 1; }
        fprintf(fcsv, "%smethod,phase,L,k,n,rep,inner,us_per_op\n", pakai_koprima ? "eksperimen," : "");
        fprintf(fsizes, "L,k,n,ab_share_bits,shamir_share_bits,table_entries,table_bytes,batas_eksak_ab,batas_eksak_sh\n");
        printf("reps=%d inner=%d warmup=%d\n", reps, inner, warmup);
        keluaran_t o = { fcsv, pakai_koprima ? "koprima" : NULL };
        static const unsigned Ls[3] = {256, 1024, 2048};
        static const int cfg[5][2] = { {3, 5}, {5, 10}, {10, 20}, {20, 40}, {50, 100} };
        for (int li = 0; li < 3; li++) {
            if (only_L && Ls[li] != only_L) continue;
            for (int c = 0; c < 5; c++) {
                if (cfg[c][1] > max_n) continue;
                konfigurasi_utama(Ls[li], cfg[c][0], cfg[c][1], reps, inner, warmup, st, &xr, &xr_urut, &o, fsizes);
            }
        }
        fclose(fsizes);
    }
    fclose(fcsv);
    gmp_randclear(st);
    printf("\nhasil mentah: %s\n", out);
    return 0;
}
