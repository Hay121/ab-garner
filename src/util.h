#ifndef UTIL_H
#define UTIL_H

#include <gmp.h>
#include <stdint.h>

/* Pembangkit acak GMP (Mersenne Twister) dengan seed tetap.
   Bukan CSPRNG; dipakai supaya hasil benchmark bisa diulang. */
void rng_init(gmp_randstate_t st, unsigned long seed);

/* Pembangkit acak kecil 64 bit (xorshift) untuk memilih indeks subset,
   juga dengan seed tetap. */
typedef struct { uint64_t s; } xrng_t;
void     xrng_seed(xrng_t *r, uint64_t seed);
uint64_t xrng_next(xrng_t *r);
/* pilih k indeks berbeda dari 0..n-1, hasil terurut naik */
void     xrng_pick_subset(xrng_t *r, int n, int k, int *out);
/* acak urutan array (Fisher-Yates) */
void     xrng_shuffle(xrng_t *r, int *a, int len);

/* Waktu dalam mikrodetik. Windows: QueryPerformanceCounter, lainnya: clock_gettime. */
double now_us(void);

/* Rata-rata dan simpangan baku sampel dari deret nilai */
void mean_sd(const double *v, int cnt, double *mean, double *sd);

#endif
