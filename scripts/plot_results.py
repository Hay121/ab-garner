#!/usr/bin/env python3
"""Ringkasan dan grafik hasil benchmark.

Pemakaian:  python scripts/plot_results.py results/bench.csv results/sizes.csv results

Berkas lain di folder yang sama dengan bench.csv ikut diolah bila ada:
tambahan.csv (bin/bench --paket tambahan), rincian.csv (bin/rincian), keamanan.csv (bin/keamanan).

Statistik: median dengan kuartil 1 dan 3. Rasio dihitung berpasangan per pengulangan, karena dalam
satu pengulangan semua metode memakai rahasia dan subset yang sama; yang dilaporkan median rasio dengan
interval kepercayaan 95% bootstrap (2.000 resampel, seed tetap, jadi hasilnya bisa diulang).
"""
import csv
import os
import random
import statistics as st
import sys
from collections import defaultdict

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.ticker import NullLocator

LABEL = {
    "ab_diff": "Usulan B: Garner selisih",
    "ab_diff_exact": "Usulan B + pembagian eksak",
    "ab_table": "Usulan A: Garner + tabel",
    "ab_garner_inv": "Garner dengan inversi",
    "ab_classic": "Asmuth-Bloom klasik",
    "shamir_naive": "Shamir biasa",
    "shamir_batch": "Shamir batch",
    "shamir_small": "Shamir bilangan kecil",
    "shamir_exact": "Shamir + pembagian eksak",
    "ab_share": "Asmuth-Bloom",
    "shamir_share": "Shamir",
    "ab_setup_total": "Asmuth-Bloom (prima + tabel)",
    "ab_setup_table": "Asmuth-Bloom (tabel saja)",
    "shamir_setup": "Shamir (satu prima)",
}
AB = ["ab_diff", "ab_diff_exact", "ab_table", "ab_garner_inv", "ab_classic"]
SH = ["shamir_naive", "shamir_batch", "shamir_small", "shamir_exact"]
RECON = AB + SH
SHARE = ["ab_share", "shamir_share"]
SETUP = ["ab_setup_total", "ab_setup_table", "shamir_setup"]
DASAR = "ab_diff"
BOOT = 2000


def kuartil(v):
    s = sorted(v)
    n = len(s)

    def q(p):
        h = p * (n - 1)
        a = int(h)
        f = h - a
        return s[a] + f * (s[a + 1] - s[a]) if a + 1 < n else s[a]
    return q(0.25), q(0.5), q(0.75)


def ci_median(r, rng=None):
    """Interval kepercayaan 95% bootstrap untuk median. Setiap sel memakai pembangkit baru dengan seed 12345,
    sehingga angkanya tidak bergantung pada urutan pemrosesan."""
    if len(r) < 2:
        return r[0], r[0]
    rng = random.Random(12345)
    meds = sorted(st.median(rng.choices(r, k=len(r))) for _ in range(BOOT))
    return meds[int(0.025 * BOOT)], meds[int(0.975 * BOOT) - 1]


def baca(path):
    """(eksperimen, metode, fase, L, k, n) -> {rep: us}"""
    data = defaultdict(dict)
    with open(path, newline="") as f:
        for r in csv.DictReader(f):
            kunci = (r.get("eksperimen", ""), r["method"], r["phase"], int(r["L"]), int(r["k"]), int(r["n"]))
            data[kunci][int(r["rep"])] = float(r["us_per_op"])
    return data


def angka(x):
    if x != x:
        return "-"
    if abs(x) >= 1000:
        return f"{x:,.0f}"
    if abs(x) >= 10:
        return f"{x:.1f}"
    return f"{x:.2f}"


def konfigurasi(data, eks="", fase="reconstruct"):
    return sorted({(k[3], k[4], k[5]) for k in data if k[0] == eks and k[2] == fase})


def median_kuartil(data, eks, m, fase, L, k, n):
    v = data.get((eks, m, fase, L, k, n))
    return kuartil(list(v.values())) if v else None


def rasio_berpasangan(data, eks, m, dasar, L, k, n, rng):
    a = data.get((eks, m, "reconstruct", L, k, n))
    b = data.get((eks, dasar, "reconstruct", L, k, n))
    if not a or not b:
        return None
    r = [a[i] / b[i] for i in a if i in b and b[i] > 0]
    if not r:
        return None
    lo, hi = ci_median(r, rng)
    return st.median(r), lo, hi


def tercepat(data, eks, metode, L, k, n):
    ada = [(st.median(data[(eks, m, "reconstruct", L, k, n)].values()), m)
           for m in metode if (eks, m, "reconstruct", L, k, n) in data]
    return min(ada)[1] if ada else None


def tabel(baris_kepala, baris):
    out = ["| " + " | ".join(baris_kepala) + " |", "| " + " | ".join("---" for _ in baris_kepala) + " |"]
    out += ["| " + " | ".join(str(c) for c in b) + " |" for b in baris]
    return out


def ab_lawan_shamir(data, eks, rng):
    """baris tabel: Asmuth-Bloom tercepat lawan Shamir tercepat per konfigurasi"""
    hasil = []
    for (L, k, n) in konfigurasi(data, eks):
        a = tercepat(data, eks, AB, L, k, n)
        s = tercepat(data, eks, SH, L, k, n)
        if not a or not s:
            continue
        r = rasio_berpasangan(data, eks, s, a, L, k, n, rng)
        if not r:
            continue
        med, lo, hi = r
        putusan = "Asmuth-Bloom lebih cepat" if lo > 1 else ("Shamir lebih cepat" if hi < 1 else "setara")
        hasil.append((L, k, n, a, s, med, lo, hi, putusan))
    return hasil


def tulis_ringkasan(data, ukuran, out_dir, rng):
    Ls = sorted({k[3] for k in data if k[0] == ""})
    baris_csv = []
    md = ["# Ringkasan benchmark (mikrodetik per operasi: median [kuartil 1 sampai kuartil 3])", ""]
    for L in Ls:
        for fase, metode in (("reconstruct", RECON), ("share", SHARE), ("setup", SETUP)):
            ada = [m for m in metode if any(k[1] == m and k[3] == L for k in data)]
            if not ada:
                continue
            md += [f"## L = {L} bit, fase {fase}", ""]
            baris = []
            for (L2, k, n) in konfigurasi(data, "", fase):
                if L2 != L:
                    continue
                sel = []
                for m in ada:
                    q = median_kuartil(data, "", m, fase, L, k, n)
                    if q:
                        baris_csv.append((m, fase, L, k, n, q[1], q[0], q[2], len(data[("", m, fase, L, k, n)])))
                        sel.append(angka(q[1]) if fase == "setup" else f"{angka(q[1])} [{angka(q[0])}-{angka(q[2])}]")
                    else:
                        sel.append("-")
                baris.append([f"({k}, {n})"] + sel)
            md += tabel(["(k, n)"] + [LABEL[m] for m in ada], baris) + [""]
    with open(os.path.join(out_dir, "summary.md"), "w") as f:
        f.write("\n".join(md) + "\n")
    with open(os.path.join(out_dir, "summary.csv"), "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["method", "phase", "L", "k", "n", "median_us", "q1_us", "q3_us", "reps"])
        w.writerows(baris_csv)

    md = [f"# Rasio waktu berpasangan terhadap {LABEL[DASAR]}",
          "", "Median rasio per pengulangan [interval kepercayaan 95% bootstrap]. Lebih dari 1 berarti "
          f"{LABEL[DASAR]} lebih cepat.", ""]
    for L in Ls:
        lain = [m for m in RECON if m != DASAR and any(k[1] == m and k[3] == L for k in data)]
        md += [f"## L = {L} bit", ""]
        baris = []
        for (L2, k, n) in konfigurasi(data):
            if L2 != L:
                continue
            sel = []
            for m in lain:
                r = rasio_berpasangan(data, "", m, DASAR, L, k, n, rng)
                sel.append(f"{r[0]:.2f} [{r[1]:.2f}-{r[2]:.2f}]" if r else "-")
            baris.append([f"({k}, {n})"] + sel)
        md += tabel(["(k, n)"] + [LABEL[m] for m in lain], baris) + [""]
        md += [f"Pembuatan share, rasio Shamir / Asmuth-Bloom (L = {L}):", ""]
        baris = []
        for (L2, k, n) in konfigurasi(data, "", "share"):
            if L2 != L:
                continue
            a = data.get(("", "ab_share", "share", L, k, n))
            b = data.get(("", "shamir_share", "share", L, k, n))
            if a and b:
                r = [b[i] / a[i] for i in a if i in b]
                lo, hi = ci_median(r, rng)
                baris.append([f"({k}, {n})", f"{st.median(r):.2f} [{lo:.2f}-{hi:.2f}]"])
        md += tabel(["(k, n)", "rasio"], baris) + [""]
    with open(os.path.join(out_dir, "speedup.md"), "w") as f:
        f.write("\n".join(md) + "\n")

    if any(k[1] == "ab_diff_exact" for k in data):
        md = ["# Rasio waktu berpasangan terhadap " + LABEL["ab_diff_exact"], "",
              "Median rasio per pengulangan [interval kepercayaan 95% bootstrap]. Lebih dari 1 berarti "
              + LABEL["ab_diff_exact"] + " lebih cepat.", ""]
        for L in Ls:
            lain = [m for m in RECON if m != "ab_diff_exact" and any(k[1] == m and k[3] == L for k in data)]
            md += [f"## L = {L} bit", ""]
            baris = []
            for (L2, k, n) in konfigurasi(data):
                if L2 != L:
                    continue
                sel = []
                for m in lain:
                    r = rasio_berpasangan(data, "", m, "ab_diff_exact", L, k, n, rng)
                    sel.append(f"{r[0]:.2f} [{r[1]:.2f}-{r[2]:.2f}]" if r else "-")
                baris.append([f"({k}, {n})"] + sel)
            md += tabel(["(k, n)"] + [LABEL[m] for m in lain], baris) + [""]
        with open(os.path.join(out_dir, "speedup_eksak.md"), "w") as f:
            f.write("\n".join(md) + "\n")

    hasil = ab_lawan_shamir(data, "", rng)
    md = ["# Asmuth-Bloom tercepat lawan Shamir tercepat", "",
          "Metode tercepat dipilih per konfigurasi menurut median. Rasio = waktu Shamir / waktu Asmuth-Bloom, "
          "berpasangan per pengulangan, median [interval kepercayaan 95% bootstrap]. Asmuth-Bloom dinyatakan "
          "lebih cepat hanya bila batas bawah interval di atas 1; Shamir lebih cepat bila batas atas di bawah 1.", ""]
    md += tabel(["L", "(k, n)", "Asmuth-Bloom tercepat", "Shamir tercepat", "rasio Shamir / AB", "kesimpulan"],
                [[L, f"({k}, {n})", LABEL[a], LABEL[s], f"{med:.2f} [{lo:.2f}-{hi:.2f}]", p]
                 for (L, k, n, a, s, med, lo, hi, p) in hasil])
    hitung = defaultdict(int)
    for h in hasil:
        hitung[h[8]] += 1
    md += ["", "Jumlah konfigurasi: " + ", ".join(f"{p} {c}" for p, c in sorted(hitung.items()))]
    with open(os.path.join(out_dir, "ab_vs_shamir.md"), "w") as f:
        f.write("\n".join(md) + "\n")

    if ukuran:
        md = ["# Ukuran share dan tabel", ""]
        md += tabel(["L", "(k, n)", "share Asmuth-Bloom (bit)", "share Shamir (bit)", "entri tabel", "tabel (byte)"],
                    [[r["L"], f"({r['k']}, {r['n']})", r["ab_share_bits"], r["shamir_share_bits"], r["table_entries"],
                      f"{int(r['table_bytes']):,}"] for r in ukuran])
        with open(os.path.join(out_dir, "sizes.md"), "w") as f:
            f.write("\n".join(md) + "\n")
    return hasil


def rapikan_sumbu_x(ax, xs):
    ax.set_xticks(xs)
    ax.set_xticklabels([str(x) for x in xs])
    ax.xaxis.set_minor_locator(NullLocator())


def grafik(data, hasil, out_dir):
    for L in sorted({k[3] for k in data if k[0] == ""}):
        fig, ax = plt.subplots(figsize=(7.5, 4.8))
        ks = []
        for m in RECON:
            pts = []
            for (L2, k, n) in konfigurasi(data):
                q = median_kuartil(data, "", m, "reconstruct", L, k, n) if L2 == L else None
                if q:
                    pts.append((k, q))
            if pts:
                ks = sorted({p[0] for p in pts} | set(ks))
                ax.errorbar([p[0] for p in pts], [p[1][1] for p in pts],
                            yerr=[[p[1][1] - p[1][0] for p in pts], [p[1][2] - p[1][1] for p in pts]],
                            marker="o", capsize=3, label=LABEL[m], linestyle="--" if m in SH else "-")
        ax.set_xscale("log"); ax.set_yscale("log")
        rapikan_sumbu_x(ax, ks)
        ax.set_xlabel("ambang k (n = 2k)"); ax.set_ylabel("waktu rekonstruksi, median (mikrodetik)")
        ax.set_title(f"Rekonstruksi, rahasia {L} bit (batang galat: kuartil 1 sampai 3)")
        ax.grid(True, which="both", alpha=0.3); ax.legend(fontsize=7, ncol=2)
        fig.tight_layout(); fig.savefig(os.path.join(out_dir, f"recon_L{L}.png"), dpi=150); plt.close(fig)

        for fase, metode, nama, judul in (("share", SHARE, "share", "Pembuatan share"),
                                          ("setup", SETUP, "setup", "Pembangkitan parameter")):
            fig, ax = plt.subplots(figsize=(7, 4.5))
            ns = []
            for m in metode:
                pts = []
                for (L2, k, n) in konfigurasi(data, "", fase):
                    q = median_kuartil(data, "", m, fase, L, k, n) if L2 == L else None
                    if q:
                        pts.append((n, q[1] / (1000.0 if fase == "setup" else 1.0)))
                if pts:
                    ns = sorted({p[0] for p in pts} | set(ns))
                    ax.plot([p[0] for p in pts], [p[1] for p in pts], marker="o", label=LABEL[m])
            ax.set_xscale("log"); ax.set_yscale("log")
            rapikan_sumbu_x(ax, ns)
            ax.set_xlabel("jumlah peserta n"); ax.set_ylabel("milidetik" if fase == "setup" else "mikrodetik")
            ax.set_title(f"{judul}, rahasia {L} bit"); ax.grid(True, which="both", alpha=0.3); ax.legend(fontsize=8)
            fig.tight_layout(); fig.savefig(os.path.join(out_dir, f"{nama}_L{L}.png"), dpi=150); plt.close(fig)

    if hasil:
        fig, ax = plt.subplots(figsize=(7.5, 4.5))
        for L in sorted({h[0] for h in hasil}):
            pts = sorted((h[1], h[5], h[6], h[7]) for h in hasil if h[0] == L)
            ax.errorbar([p[0] for p in pts], [p[1] for p in pts],
                        yerr=[[p[1] - p[2] for p in pts], [p[3] - p[1] for p in pts]],
                        marker="o", capsize=3, label=f"L = {L} bit")
        ax.axhline(1.0, color="black", linewidth=1)
        ax.set_xscale("log"); ax.set_yscale("log")
        rapikan_sumbu_x(ax, sorted({h[1] for h in hasil}))
        ax.set_xlabel("ambang k (n = 2k)"); ax.set_ylabel("waktu Shamir tercepat / waktu AB tercepat")
        ax.set_title("Di atas 1: Asmuth-Bloom lebih cepat; di bawah 1: Shamir lebih cepat")
        ax.grid(True, which="both", alpha=0.3); ax.legend(fontsize=8)
        fig.tight_layout(); fig.savefig(os.path.join(out_dir, "ab_vs_shamir.png"), dpi=150); plt.close(fig)


def olah_tambahan(path, data_utama, out_dir, rng):
    t = baca(path)
    md = ["# Eksperimen tambahan", "", "Median (mikrodetik). Rasio memakai pasangan per pengulangan.", ""]
    nama = {"n_tetap": "n tetap = 100", "k_sama_n": "k = n (semua peserta wajib hadir)",
            "L_rapat": "L lebih rapat", "dingin": "data dingin (satu pemanggilan, cache dibersihkan)"}
    for eks in ("n_tetap", "k_sama_n", "L_rapat", "dingin"):
        konf = konfigurasi(t, eks)
        if not konf:
            continue
        ada = [m for m in RECON if any(k[0] == eks and k[1] == m for k in t)]
        md += [f"## {nama[eks]}", ""]
        baris = []
        for (L, k, n) in konf:
            sel = []
            for m in ada:
                q = median_kuartil(t, eks, m, "reconstruct", L, k, n)
                sel.append(angka(q[1]) if q else "-")
            baris.append([L, f"({k}, {n})"] + sel)
        md += tabel(["L", "(k, n)"] + [LABEL[m] for m in ada], baris) + [""]
        if eks == "n_tetap":
            md += ["Pengaruh n: median pada n = 100 dibagi median pada konfigurasi paket utama dengan k yang sama.", ""]
            baris = []
            for (L, k, n) in konf:
                sel = []
                for m in ada:
                    a = median_kuartil(t, eks, m, "reconstruct", L, k, n)
                    n_utama = next((c[2] for c in konfigurasi(data_utama) if c[0] == L and c[1] == k), 2 * k)
                    b = median_kuartil(data_utama, "", m, "reconstruct", L, k, n_utama)
                    sel.append(f"{a[1] / b[1]:.2f}" if a and b else "-")
                baris.append([L, k] + sel)
            md += tabel(["L", "k"] + [LABEL[m] for m in ada], baris) + [""]
        if eks == "dingin":
            md += ["Urutan metode dari tercepat, dingin lawan hangat (paket utama, konfigurasi sama).", ""]
            baris = []
            for (L, k, n) in konf:
                urut = lambda d, e: [LABEL[m] for _, m in sorted(
                    (st.median(d[(e, m, "reconstruct", L, k, n)].values()), m)
                    for m in ada if (e, m, "reconstruct", L, k, n) in d)]
                baris.append([L, f"({k}, {n})", "; ".join(urut(t, eks)), "; ".join(urut(data_utama, ""))])
            md += tabel(["L", "(k, n)", "dingin", "hangat"], baris) + [""]
        hasil = ab_lawan_shamir(t, eks, rng)
        if hasil:
            md += ["Asmuth-Bloom tercepat lawan Shamir tercepat:", ""]
            md += tabel(["L", "(k, n)", "AB tercepat", "Shamir tercepat", "rasio Shamir / AB", "kesimpulan"],
                        [[L, f"({k}, {n})", LABEL[a], LABEL[s], f"{med:.2f} [{lo:.2f}-{hi:.2f}]", p]
                         for (L, k, n, a, s, med, lo, hi, p) in hasil]) + [""]
    with open(os.path.join(out_dir, "tambahan.md"), "w") as f:
        f.write("\n".join(md) + "\n")


def olah_rincian(path, out_dir, berkas="rincian"):
    v = defaultdict(dict)
    with open(path, newline="") as f:
        for r in csv.DictReader(f):
            v[(int(r["L"]), int(r["k"]), int(r["n"]))][r["besaran"]] = float(r["nilai"])
    tahap = ["t_horner_s", "t_hasilkali_D", "t_invers", "t_kali_reduksi", "t_horner_2L"]
    nama = ["Horner s", "hasil kali D", "invers", "kali + reduksi", "Horner 2^L"]
    md = ["# Rincian usulan B", "", "Porsi waktu per tahap (persen dari jumlah tahap), ukuran bilangan antara "
          "(bit, median), dan porsi langkah pada tiap jalur pembagian eksak.", ""]
    baris = []
    for (L, k, n), d in sorted(v.items()):
        tot = d["t_jumlah_tahap"]
        baris.append([L, f"({k}, {n})"] + [f"{100 * d[t] / tot:.0f}%" for t in tahap] +
                     [int(d["bit_modulus"]), int(d["bit_s_maks"]), int(d["bit_D_maks"]), int(d["bit_penyebut_shamir_maks"]),
                      f"{d['jalur_word']:.0f}/{d['jalur_mpz']:.0f}/{d['jalur_lama']:.0f}"])
    md += tabel(["L", "(k, n)"] + nama + ["bit modulus", "bit s maks", "bit D maks", "bit penyebut Shamir",
                                          "jalur word/mpz/lama (%)"], baris)
    with open(os.path.join(out_dir, f"{berkas}.md"), "w") as f:
        f.write("\n".join(md) + "\n")
    for L in sorted({k[0] for k in v}):
        konf = sorted(k for k in v if k[0] == L)
        fig, ax = plt.subplots(figsize=(7, 4.3))
        bawah = [0.0] * len(konf)
        for t, nm in zip(tahap, nama):
            nilai = [v[c][t] for c in konf]
            ax.bar([f"k={c[1]}" for c in konf], nilai, bottom=bawah, label=nm)
            bawah = [b + x for b, x in zip(bawah, nilai)]
        ax.set_yscale("log")
        ax.set_ylabel("mikrodetik per rekonstruksi"); ax.set_title(f"Usulan B per tahap, rahasia {L} bit")
        ax.legend(fontsize=8); ax.grid(True, axis="y", alpha=0.3)
        fig.tight_layout(); fig.savefig(os.path.join(out_dir, f"{berkas}_L{L}.png"), dpi=150); plt.close(fig)


def olah_keamanan(path, out_dir):
    with open(path, newline="") as f:
        rows = list(csv.DictReader(f))
    md = ["# Kebocoran dari k - 1 share", "",
          "cnt/Q = 1 + eps; jarak statistik ke sebaran seragam = eps(1 - eps)/(1 + eps), kira-kira eps. "
          "Nilai yang ditulis adalah log2 eps untuk Q terbesar (eps terkecil) dan Q terkecil (eps terbesar).", "",
          "## Parameter benchmark (margin L/2)", ""]
    md += tabel(["L", "(k, n)", "syarat", "log2 eps terkecil", "log2 eps terbesar"],
                [[r["L"], f"({r['k']}, {r['n']})", "ya" if r["syarat"] == "1" else "tidak", r["log2_eps_min"], r["log2_eps_maks"]]
                 for r in rows if r["bagian"] == "benchmark"])
    if any(r["bagian"] == "koprima" for r in rows):
        md += ["", "## Modulus saling prima yang tidak harus prima (margin L/2)", ""]
        md += tabel(["L", "(k, n)", "syarat", "log2 eps terkecil", "log2 eps terbesar"],
                    [[r["L"], f"({r['k']}, {r['n']})", "ya" if r["syarat"] == "1" else "tidak", r["log2_eps_min"], r["log2_eps_maks"]]
                     for r in rows if r["bagian"] == "koprima"])
    md += ["", "## Pengaruh margin (L = 256)", ""]
    md += tabel(["margin", "(k, n)", "syarat", "log2 eps terkecil", "log2 eps terbesar"],
                [[r["margin"], f"({r['k']}, {r['n']})", "ya" if r["syarat"] == "1" else "tidak", r["log2_eps_min"],
                  r["log2_eps_maks"]] for r in rows if r["bagian"] == "margin"])
    with open(os.path.join(out_dir, "keamanan.md"), "w") as f:
        f.write("\n".join(md) + "\n")
    fig, ax = plt.subplots(figsize=(6.5, 4))
    for k, n in sorted({(int(r["k"]), int(r["n"])) for r in rows if r["bagian"] == "margin"}):
        pts = [(int(r["margin"]), float(r["log2_eps_maks"])) for r in rows
               if r["bagian"] == "margin" and int(r["k"]) == k and r["syarat"] == "1"]
        ax.plot([p[0] for p in pts], [p[1] for p in pts], marker="o", label=f"(k, n) = ({k}, {n})")
    ax.set_xlabel("margin (modulus mulai dari 2^256 + 2^margin)"); ax.set_ylabel("log2 eps")
    ax.set_title("Kebocoran naik seiring margin, rahasia 256 bit"); ax.grid(True, alpha=0.3); ax.legend(fontsize=8)
    fig.tight_layout(); fig.savefig(os.path.join(out_dir, "keamanan_margin.png"), dpi=150); plt.close(fig)


def olah_koprima(path, data_utama, out_dir, rng):
    t = baca(path)
    md = ["# Modulus saling prima yang tidak harus prima", "",
          "Paket `bin/bench --paket koprima`: konfigurasi sama dengan paket utama, tetapi modulus dipilih rakus dari "
          "bilangan ganjil di dekat 2^L + 2^(L/2) yang saling prima. Median dalam mikrodetik; rasio prima / koprima "
          "dihitung dari median kedua run (tidak berpasangan).", ""]
    baris = []
    for (L, k, n) in konfigurasi(t, "koprima"):
        sel = [L, f"({k}, {n})"]
        for m in ("ab_diff_exact", "ab_diff", "ab_table"):
            a = median_kuartil(t, "koprima", m, "reconstruct", L, k, n)
            b = median_kuartil(data_utama, "", m, "reconstruct", L, k, n)
            sel += [angka(a[1]) if a else "-", f"{b[1] / a[1]:.2f}" if a and b else "-"]
        sa = median_kuartil(t, "koprima", "ab_setup_total", "setup", L, k, n)
        sb = median_kuartil(data_utama, "", "ab_setup_total", "setup", L, k, n)
        ss = median_kuartil(t, "koprima", "shamir_setup", "setup", L, k, n)
        sel += [angka(sb[1] / 1000) if sb else "-", angka(sa[1] / 1000) if sa else "-", angka(ss[1] / 1000) if ss else "-"]
        baris.append(sel)
    md += tabel(["L", "(k, n)", "B-eksak koprima", "prima / koprima", "B koprima", "prima / koprima", "A koprima",
                 "prima / koprima", "setup AB prima (ms)", "setup AB koprima (ms)", "setup Shamir (ms)"], baris) + [""]
    hasil = ab_lawan_shamir(t, "koprima", rng)
    md += ["## Asmuth-Bloom tercepat lawan Shamir tercepat dengan modulus saling prima", ""]
    md += tabel(["L", "(k, n)", "Asmuth-Bloom tercepat", "Shamir tercepat", "rasio Shamir / AB", "kesimpulan"],
                [[L, f"({k}, {n})", LABEL[a], LABEL[s], f"{med:.2f} [{lo:.2f}-{hi:.2f}]", p]
                 for (L, k, n, a, s, med, lo, hi, p) in hasil])
    hitung = defaultdict(int)
    for h in hasil:
        hitung[h[8]] += 1
    md += ["", "Jumlah konfigurasi: " + ", ".join(f"{p} {c}" for p, c in sorted(hitung.items()))]
    with open(os.path.join(out_dir, "koprima.md"), "w") as f:
        f.write("\n".join(md) + "\n")


def olah_stabilitas(paths, out_dir, rng):
    runs = [baca(p) for p in paths]
    md = ["# Stabilitas antarrun", "",
          f"{len(runs)} run benchmark utama yang dijalankan terpisah. Setiap sel adalah median rasio berpasangan di dalam run itu.", ""]
    baris = []
    for (L, k, n) in konfigurasi(runs[0]):
        g = [rasio_berpasangan(r, "", "ab_garner_inv", "ab_diff_exact", L, k, n, rng) for r in runs]
        v = [next((h for h in ab_lawan_shamir(r, "", rng) if h[:3] == (L, k, n)), None) for r in runs]
        baris.append([L, f"({k}, {n})", " / ".join(f"{x[0]:.2f}" if x else "-" for x in g),
                      " / ".join(f"{h[5]:.2f}" if h else "-" for h in v), " / ".join(h[8] if h else "-" for h in v)])
    md += tabel(["L", "(k, n)", "Garner dengan inversi / B-eksak (run 1 / 2 / 3)", "Shamir / AB tercepat (run 1 / 2 / 3)", "kesimpulan per run"], baris)
    with open(os.path.join(out_dir, "stabilitas.md"), "w") as f:
        f.write("\n".join(md) + "\n")


def main():
    if len(sys.argv) < 4:
        print(__doc__)
        sys.exit(1)
    bench, sizes, out_dir = sys.argv[1], sys.argv[2], sys.argv[3]
    os.makedirs(out_dir, exist_ok=True)
    rng = random.Random(12345)
    data = baca(bench)
    ukuran = list(csv.DictReader(open(sizes, newline=""))) if os.path.exists(sizes) else []
    hasil = tulis_ringkasan(data, ukuran, out_dir, rng)
    grafik(data, hasil, out_dir)
    folder = os.path.dirname(os.path.abspath(bench))
    dibuat = ["summary.md", "summary.csv", "speedup.md", "speedup_eksak.md", "ab_vs_shamir.md", "sizes.md", "grafik PNG"]
    for nama, fungsi in (("tambahan.csv", lambda p: olah_tambahan(p, data, out_dir, rng)),
                         ("rincian.csv", lambda p: olah_rincian(p, out_dir)),
                         ("rincian_koprima.csv", lambda p: olah_rincian(p, out_dir, "rincian_koprima")),
                         ("koprima.csv", lambda p: olah_koprima(p, data, out_dir, rng)),
                         ("keamanan.csv", lambda p: olah_keamanan(p, out_dir))):
        p = os.path.join(folder, nama)
        if os.path.exists(p):
            fungsi(p)
            dibuat.append(nama.replace(".csv", ".md"))
    lain = [os.path.join(folder, f"bench_run{i}.csv") for i in (2, 3)]
    if all(os.path.exists(p) for p in lain):
        olah_stabilitas([bench] + lain, out_dir, rng)
        dibuat.append("stabilitas.md")
    print("selesai:", ", ".join(dibuat))


if __name__ == "__main__":
    main()
