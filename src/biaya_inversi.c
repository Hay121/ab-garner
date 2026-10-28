/* Mengukur biaya tiga operasi GMP yang menentukan hasil perbandingan dengan Shamir:
   perkalian modular, inversi bilangan acak selebar p, dan inversi penyebut Lagrange.
   Penyebut yang dipakai milik peserta ke-5 dari 10 peserta berkoordinat 1..10:
   (1-5)(2-5)(3-5)(4-5)(6-5)...(10-5) = 2880. Dipakai untuk Bab 6.2 makalah.

   Pakai: ./bin/biaya_inversi */
#include <stdio.h>
#include <gmp.h>
#include "util.h"

enum { OP_KALI, OP_INV_ACAK, OP_INV_PENYEBUT };

#define JUMLAH_POOL 16

/* Jumlah ulangan digandakan sampai satu pengukuran >= 200 ms, lalu diambil
   yang tercepat dari tiga pengukuran supaya gangguan sesaat tidak ikut terhitung. */
static double ukur(int op, mpz_t *pool, const mpz_t b, const mpz_t penyebut, const mpz_t p)
{
    mpz_t r;
    mpz_init(r);
    double terbaik = 1e30;
    for (int ulangi = 0; ulangi < 3; ulangi++) {
        long ulang = 64;
        for (;;) {
            double t0 = now_us();
            for (long i = 0; i < ulang; i++) {
                if (op == OP_KALI) {
                    mpz_mul(r, pool[i % JUMLAH_POOL], b);
                    mpz_mod(r, r, p);
                } else if (op == OP_INV_ACAK) {
                    mpz_invert(r, pool[i % JUMLAH_POOL], p);
                } else {
                    mpz_invert(r, penyebut, p);
                }
            }
            double dt = now_us() - t0;
            if (dt >= 200000.0 || ulang >= (1L << 26)) {
                if (dt / ulang < terbaik) terbaik = dt / ulang;
                break;
            }
            ulang *= 2;
        }
    }
    mpz_clear(r);
    return terbaik;
}

int main(void)
{
    const unsigned Ls[3] = {256, 1024, 2048};
    gmp_randstate_t st;
    rng_init(st, 12345);
    mpz_t p, b, penyebut, pool[JUMLAH_POOL];
    mpz_inits(p, b, penyebut, NULL);
    for (int i = 0; i < JUMLAH_POOL; i++) mpz_init(pool[i]);

    /* penyebut Lagrange peserta x = 5 dari koordinat 1..10 */
    long nilai = 1;
    for (long x = 1; x <= 10; x++)
        if (x != 5) nilai *= (x - 5);

    printf("Biaya operasi dasar GMP %s, mikrodetik per operasi (tercepat dari 3 pengukuran)\n", gmp_version);
    printf("penyebut Lagrange = (1-5)(2-5)(3-5)(4-5)(6-5)...(10-5) = %ld\n\n", nilai);
    printf("%-6s %12s %14s %18s %14s %18s\n", "L", "perkalian", "inversi acak", "inversi penyebut",
           "acak/kali", "penyebut/kali");
    for (int li = 0; li < 3; li++) {
        unsigned L = Ls[li];
        mpz_set_ui(p, 0);
        mpz_setbit(p, L);
        mpz_nextprime(p, p);                   /* prima yang sama dengan Shamir di bench */
        for (int i = 0; i < JUMLAH_POOL; i++) mpz_urandomm(pool[i], st, p);
        mpz_urandomm(b, st, p);
        mpz_set_si(penyebut, nilai);
        mpz_mod(penyebut, penyebut, p);

        double kali = ukur(OP_KALI, pool, b, penyebut, p);
        double acak = ukur(OP_INV_ACAK, pool, b, penyebut, p);
        double kecil = ukur(OP_INV_PENYEBUT, pool, b, penyebut, p);
        printf("%-6u %12.3f %14.3f %18.3f %14.1f %18.2f\n", L, kali, acak, kecil, acak / kali, kecil / kali);
    }

    for (int i = 0; i < JUMLAH_POOL; i++) mpz_clear(pool[i]);
    mpz_clears(p, b, penyebut, NULL);
    gmp_randclear(st);
    return 0;
}
