/* Demo: contoh hitungan manual dari makalah (Bab 3.8) dengan angka kecil.
   m0 = 16, modulus 23 29 31 37, k = 3, n = 4, S = 11, A = 321, y = 5147. */
#include <stdio.h>
#include <gmp.h>
#include "ab.h"
#include "shamir.h"

static long modp(long a, long m) { long r = a % m; return r < 0 ? r + m : r; }

static void garner_steps(const ab_params_t *p, const int *idx, int k, const long *res)
{
    int n = p->n;
    long v[16];
    printf("  peserta");
    for (int j = 0; j < k; j++) printf(" %d", idx[j] + 1);
    printf(" hadir; modulus");
    for (int j = 0; j < k; j++) printf(" %lu", mpz_get_ui(p->m[idx[j]]));
    printf("; residu");
    for (int j = 0; j < k; j++) printf(" %ld", res[j]);
    printf("\n");

    v[0] = res[0];
    printf("  v1 = %ld\n", v[0]);
    for (int j = 1; j < k; j++) {
        long mj = (long)mpz_get_ui(p->m[idx[j]]);
        long t = res[j];
        printf("  v%d = ", j + 1);
        for (int a = 0; a < j; a++) {
            long c = (long)mpz_get_ui(p->table.inv[idx[a] * n + idx[j]]);
            long t2 = modp((t - v[a]) * c, mj);
            printf("((%ld - %ld) * c_%d%d=%ld) mod %ld = %ld%s", t, v[a], idx[a] + 1, idx[j] + 1,
                   c, mj, t2, a + 1 < j ? "; lalu " : "\n");
            t = t2;
        }
        v[j] = t;
    }
    long y = v[k - 1];
    for (int j = k - 2; j >= 0; j--) y = y * (long)mpz_get_ui(p->m[idx[j]]) + v[j];
    printf("  Horner: y = %ld, rahasia = y mod %lu = %ld\n", y, mpz_get_ui(p->m0), y % (long)mpz_get_ui(p->m0));
}

/* Langkah usulan B: perkalian dengan modulus diganti selisih kecil m_b - m_j */
static void diff_steps(const ab_params_t *p, const int *idx, int k, const long *res)
{
    long v[16], m[16];
    for (int j = 0; j < k; j++) m[j] = (long)mpz_get_ui(p->m[idx[j]]);
    printf("  peserta");
    for (int j = 0; j < k; j++) printf(" %d", idx[j] + 1);
    printf(" hadir; modulus");
    for (int j = 0; j < k; j++) printf(" %ld", m[j]);
    v[0] = res[0] % m[0];
    printf("\n  v1 = %ld\n", v[0]);
    for (int j = 1; j < k; j++) {
        long s = v[j - 1], D = 1;
        for (int b = j - 2; b >= 0; b--) s = s * (m[b] - m[j]) + v[b];
        for (int b = 0; b < j; b++) D *= (m[b] - m[j]);
        long Dm = modp(D, m[j]), inv = 0;
        for (long c = 1; c < m[j]; c++) if ((Dm * c) % m[j] == 1) { inv = c; break; }
        v[j] = modp(modp(res[j] - s, m[j]) * inv, m[j]);
        printf("  v%d: s = %ld, D = %ld = %ld mod %ld, D^-1 = %ld, v%d = ((%ld - (%ld)) * %ld) mod %ld = %ld\n",
               j + 1, s, D, Dm, m[j], inv, j + 1, res[j], s, inv, m[j], v[j]);
    }
    long m0 = (long)mpz_get_ui(p->m0), S = v[k - 1];
    printf("  y mod %ld: S = %ld", m0, S);
    for (int j = k - 2; j >= 0; j--) {
        long mb = m[j] % m0;
        S = (S * mb + v[j]) % m0;
        printf(" -> (S*%ld + %ld) mod %ld = %ld", mb, v[j], m0, S);
    }
    printf("\n  rahasia = %ld\n", S);
}

int main(void)
{
    static const unsigned long mods[4] = {23, 29, 31, 37};
    ab_params_t p;
    if (ab_params_init_explicit(&p, 3, 4, 4, mods) != 0) return 1;

    printf("Parameter: m0 = %lu, modulus 23 29 31 37, k = 3, n = 4\n", mpz_get_ui(p.m0));
    gmp_printf("Syarat: 16*31*37 = %d < 23*29*31 = %Zd\n", 16 * 31 * 37, p.Mk);

    /* share dibuat manual dengan A = 321 supaya sama dengan makalah */
    long S = 11, A = 321, y = S + A * 16;
    long sh[4];
    for (int i = 0; i < 4; i++) sh[i] = y % (long)mods[i];
    printf("S = %ld, A = %ld, y = %ld; share:", S, A, y);
    for (int i = 0; i < 4; i++) printf(" (%d, %ld)", i + 1, sh[i]);
    printf("\n\nTabel invers berpasangan c_ij = m_i^-1 mod m_j:\n");
    for (int i = 0; i < 4; i++)
        for (int j = i + 1; j < 4; j++)
            gmp_printf("  c_%d%d = %Zd\n", i + 1, j + 1, p.table.inv[i * 4 + j]);

    printf("\nRekonstruksi Garner + tabel (usulan A):\n");
    int idxA[3] = {0, 1, 3}; long resA[3] = {sh[0], sh[1], sh[3]};
    garner_steps(&p, idxA, 3, resA);
    int idxB[3] = {1, 2, 3}; long resB[3] = {sh[1], sh[2], sh[3]};
    garner_steps(&p, idxB, 3, resB);

    /* pemeriksaan silang dengan fungsi pustaka */
    mpz_t s0, s1, s3, R;
    mpz_init_set_ui(s0, sh[0]); mpz_init_set_ui(s1, sh[1]); mpz_init_set_ui(s3, sh[3]); mpz_init(R);
    mpz_srcptr sub[3] = {s0, s1, s3};
    ab_reconstruct_table(&p, idxA, sub, 3, R);
    gmp_printf("  fungsi ab_reconstruct_table  -> %Zd\n", R);
    ab_reconstruct_garner(&p, idxA, sub, 3, R);
    gmp_printf("  fungsi ab_reconstruct_garner -> %Zd\n", R);
    ab_reconstruct_classic(&p, idxA, sub, 3, R);
    gmp_printf("  fungsi ab_reconstruct_classic-> %Zd\n", R);

    printf("\nRekonstruksi Garner selisih kecil (usulan B):\n");
    diff_steps(&p, idxA, 3, resA);
    diff_steps(&p, idxB, 3, resB);
    ab_reconstruct_diff(&p, idxA, sub, 3, R);
    gmp_printf("  fungsi ab_reconstruct_diff   -> %Zd\n", R);

    printf("\nRumus CRT klasik untuk peserta 1, 2, 4 (M = 23*29*37 = 24679):\n");
    long M = 23 * 29 * 37, Ms[3] = {29 * 37, 23 * 37, 23 * 29}, ms[3] = {23, 29, 37};
    long sum = 0;
    for (int j = 0; j < 3; j++) {
        long t = Ms[j] % ms[j], inv = 0;
        for (long c = 1; c < ms[j]; c++) if ((t * c) % ms[j] == 1) { inv = c; break; }
        printf("  M_%d = %ld, M_%d mod %ld = %ld, invers = %ld, suku = %ld*%ld*%ld = %ld\n",
               j + 1, Ms[j], j + 1, ms[j], t, inv, resA[j], Ms[j], inv, resA[j] * Ms[j] * inv);
        sum += resA[j] * Ms[j] * inv;
    }
    printf("  jumlah = %ld, mod %ld = %ld, rahasia = %ld\n", sum, M, sum % M, (sum % M) % 16);

    printf("\nPembanding Shamir dengan p = 17, f(x) = 11 + 5x + 3x^2:\n");
    sh_params_t s;
    sh_params_init(&s, 3, 4, 4);                /* p = prima pertama setelah 16 = 17 */
    long f[4];
    for (int i = 0; i < 4; i++) { long x = i + 1; f[i] = (11 + 5 * x + 3 * x * x) % 17; }
    printf("  share:");
    for (int i = 0; i < 4; i++) printf(" (%d, %ld)", i + 1, f[i]);
    printf("\n  dari peserta 1, 2, 4: lambda_1 = 8/3 = 14, lambda_2 = 4/(-2) = 15, lambda_4 = 2/6 = 6 (mod 17)\n");
    printf("  S = 2*14 + 16*15 + 11*6 = 334 mod 17 = %d\n", 334 % 17);
    mpz_t t0, t1, t3;
    mpz_init_set_ui(t0, f[0]); mpz_init_set_ui(t1, f[1]); mpz_init_set_ui(t3, f[3]);
    mpz_srcptr subs[3] = {t0, t1, t3};
    sh_reconstruct_batch(&s, idxA, subs, 3, R);
    gmp_printf("  fungsi sh_reconstruct_batch  -> %Zd\n", R);

    mpz_clears(s0, s1, s3, R, t0, t1, t3, NULL);
    sh_params_clear(&s);
    ab_params_clear(&p);
    return 0;
}
