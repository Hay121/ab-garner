/* Ekspor modulus untuk halaman web.
   Mencetak isi web/js/modulus.js: selisih tiap modulus Asmuth-Bloom (n = 100)
   terhadap 2^L + 2^(L/2) dan selisih prima Shamir terhadap 2^L, untuk
   L = 256, 1024, 2048. Modulusnya sama persis dengan yang dipakai bin/bench
   karena dibangkitkan oleh fungsi yang sama (ab_params_init, sh_params_init).
   Browser tidak perlu mencari prima 2049 bit sendiri, yang lambat di JavaScript.

   Pakai: ./bin/export_moduli > web/js/modulus.js   (atau: make moduli) */
#include <stdio.h>
#include <gmp.h>
#include "ab.h"
#include "shamir.h"

int main(void)
{
    const unsigned Ls[3] = {256, 1024, 2048};
    const int n = 100, k = 50;
    unsigned long off_shamir[3];
    mpz_t base, d;
    mpz_inits(base, d, NULL);

    printf("// Dihasilkan oleh bin/export_moduli (program C), jangan diedit manual.\n");
    printf("// modulus ke-i = 2^L + 2^(L/2) + OFFSET_MODULUS[L][i-1]\n");
    printf("// prima Shamir  = 2^L + OFFSET_PRIMA_SHAMIR[L]\n");
    printf("const OFFSET_MODULUS = {\n");
    for (int li = 0; li < 3; li++) {
        unsigned L = Ls[li];
        ab_params_t p;
        if (ab_params_init(&p, k, n, L) != 0) {
            fprintf(stderr, "gagal membangkitkan parameter L=%u\n", L);
            return 1;
        }
        mpz_set_ui(base, 0);
        mpz_setbit(base, L);
        mpz_setbit(base, L / 2);
        printf("  %u: [", L);
        for (int i = 0; i < n; i++) {
            mpz_sub(d, p.m[i], base);
            /* kalau margin sempat diperbesar, selisihnya tidak lagi kecil */
            if (mpz_sgn(d) < 0 || !mpz_fits_ulong_p(d)) {
                fprintf(stderr, "selisih modulus terlalu besar (L=%u, i=%d)\n", L, i);
                return 1;
            }
            if (i > 0) printf(",");
            printf(i % 10 == 0 ? "\n    " : " ");
            printf("%lu", mpz_get_ui(d));
        }
        printf("\n  ],\n");
        ab_params_clear(&p);

        sh_params_t s;
        sh_params_init(&s, k, n, L);
        mpz_set_ui(base, 0);
        mpz_setbit(base, L);
        mpz_sub(d, s.p, base);
        off_shamir[li] = mpz_get_ui(d);
        sh_params_clear(&s);
        fprintf(stderr, "L=%u selesai\n", L);
    }
    printf("};\n");
    printf("const OFFSET_PRIMA_SHAMIR = { 256: %lu, 1024: %lu, 2048: %lu };\n",
           off_shamir[0], off_shamir[1], off_shamir[2]);
    mpz_clears(base, d, NULL);
    return 0;
}
