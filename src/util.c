#ifndef _WIN32
#define _POSIX_C_SOURCE 200809L   /* clock_gettime di bawah -std=c11 */
#endif
#include "util.h"
#include <math.h>
#include <stdlib.h>

#ifdef _WIN32
#include <windows.h>
#else
#include <time.h>
#endif

void rng_init(gmp_randstate_t st, unsigned long seed)
{
    gmp_randinit_mt(st);
    gmp_randseed_ui(st, seed);
}

void xrng_seed(xrng_t *r, uint64_t seed)
{
    r->s = seed ? seed : 0x9E3779B97F4A7C15ULL;
}

uint64_t xrng_next(xrng_t *r)
{
    uint64_t x = r->s;
    x ^= x << 13;
    x ^= x >> 7;
    x ^= x << 17;
    r->s = x;
    return x;
}

void xrng_pick_subset(xrng_t *r, int n, int k, int *out)
{
    /* Fisher-Yates parsial lalu urutkan k elemen pertama */
    int *pool = malloc(sizeof(int) * n);
    for (int i = 0; i < n; i++) pool[i] = i;
    for (int i = 0; i < k; i++) {
        int j = i + (int)(xrng_next(r) % (uint64_t)(n - i));
        int tmp = pool[i]; pool[i] = pool[j]; pool[j] = tmp;
    }
    for (int i = 0; i < k; i++) out[i] = pool[i];
    free(pool);
    /* insertion sort, k kecil */
    for (int i = 1; i < k; i++) {
        int v = out[i], j = i - 1;
        while (j >= 0 && out[j] > v) { out[j + 1] = out[j]; j--; }
        out[j + 1] = v;
    }
}

void xrng_shuffle(xrng_t *r, int *a, int len)
{
    for (int i = len - 1; i > 0; i--) {
        int j = (int)(xrng_next(r) % (uint64_t)(i + 1));
        int tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
}

double now_us(void)
{
#ifdef _WIN32
    static LARGE_INTEGER freq;
    LARGE_INTEGER c;
    if (freq.QuadPart == 0) QueryPerformanceFrequency(&freq);
    QueryPerformanceCounter(&c);
    return (double)c.QuadPart * 1e6 / (double)freq.QuadPart;
#else
    struct timespec ts;
    clock_gettime(CLOCK_MONOTONIC, &ts);
    return (double)ts.tv_sec * 1e6 + (double)ts.tv_nsec / 1e3;
#endif
}

void mean_sd(const double *v, int cnt, double *mean, double *sd)
{
    double s = 0.0;
    for (int i = 0; i < cnt; i++) s += v[i];
    *mean = cnt ? s / cnt : 0.0;
    double ss = 0.0;
    for (int i = 0; i < cnt; i++) ss += (v[i] - *mean) * (v[i] - *mean);
    *sd = cnt > 1 ? sqrt(ss / (cnt - 1)) : 0.0;
}
