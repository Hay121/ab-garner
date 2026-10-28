#!/usr/bin/env python3
"""Menulis web/js/hasil_c.js dari berkas hasil di results/, supaya data di halaman web tidak disalin tangan.

Pemakaian (dari folder proyek):
    python scripts/buat_hasil_js.py --mesin "Intel Core i5-11400H, memori 16 GB, Windows 11"

Dibaca: results/bench.csv dan results/sizes.csv (wajib), results/bench_browser.csv (bila ada), dan dua baris
pertama results/bench_console.txt (versi GMP, gcc, opsi kompilasi, jumlah pengulangan) bila ada.
"""
import argparse
import json
import os
import re

p = argparse.ArgumentParser()
p.add_argument("--mesin", default="laptop uji (isi dengan --mesin)")
p.add_argument("--hasil", default="results")
p.add_argument("--keluaran", default="web/js/hasil_c.js")
a = p.parse_args()

def baca(nama):
    jalur = os.path.join(a.hasil, nama)
    return open(jalur, encoding="utf-8").read() if os.path.exists(jalur) else None

bench, sizes = baca("bench.csv"), baca("sizes.csv")
if not bench or not sizes:
    raise SystemExit("results/bench.csv dan results/sizes.csv harus ada")
konsol = baca("bench_console.txt") or ""
gmp = re.search(r"GMP ([0-9.]+)", konsol)
gcc = re.search(r"gcc ([^;)]+)", konsol)
opsi = re.search(r"opsi ([^)]+)\)", konsol)
ulang = re.search(r"reps=(\d+) inner=(\d+)", konsol)
data = {
    "mesin": a.mesin,
    "gmp": gmp.group(1) if gmp else "tidak dicatat",
    "gcc": (gcc.group(1).strip() + (", " + opsi.group(1).strip() if opsi else "")) if gcc else "tidak dicatat",
    "pengukuran": (f"{ulang.group(1)} pengulangan, masing-masing {ulang.group(2)} pemanggilan, seed 12345"
                   if ulang else "lihat results/bench_console.txt"),
}
with open(a.keluaran, "w", encoding="utf-8") as f:
    f.write("// Dibuat oleh scripts/buat_hasil_js.py dari results/*.csv; jangan disunting tangan.\n")
    f.write("const HASIL_C = {\n")
    for k, v in data.items():
        f.write(f"  {k}: {json.dumps(v, ensure_ascii=False)},\n")
    f.write(f"  bench: {json.dumps(bench)},\n  sizes: {json.dumps(sizes)},\n")
    browser = baca("bench_browser.csv")
    f.write(f"  browser: {json.dumps(browser) if browser else 'null'},\n}};\n")
print(f"{a.keluaran} ditulis ({os.path.getsize(a.keluaran) // 1024} KB)")
