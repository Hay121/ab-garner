// benchmark.js
// Padanan bench.c untuk browser. Konfigurasi dan nama metode sama dengan program C,
// sehingga CSV-nya bisa diolah oleh scripts/plot_results.py.
'use strict';

const METODE_REKON = ['ab_diff', 'ab_table', 'ab_garner_inv', 'ab_classic', 'shamir_naive', 'shamir_batch', 'shamir_small'];
const METODE_SHARE = ['ab_share', 'shamir_share'];

// mikrodetik per operasi untuk `ulang` pemanggilan berurutan
function ukurBlok(fn, ulang) {
  const t0 = performance.now();
  for (let i = 0; i < ulang; i++) fn();
  return (performance.now() - t0) * 1000 / ulang;
}

// Resolusi performance.now() di browser sengaja dibatasi (bisa 0,1 ms atau lebih),
// jadi jumlah pemanggilan per blok digandakan sampai satu blok makan waktu >= blokMs.
function kalibrasi(fn, blokMs) {
  let ulang = 1;
  for (;;) {
    const t0 = performance.now();
    for (let i = 0; i < ulang; i++) fn();
    if (performance.now() - t0 >= blokMs || ulang >= (1 << 20)) return ulang;
    ulang *= 2;
  }
}

function estimasiResolusiTimer() {
  let terkecil = Infinity;
  let t0 = performance.now();
  for (let i = 0; i < 30; i++) {
    let t1;
    do { t1 = performance.now(); } while (t1 === t0);
    terkecil = Math.min(terkecil, t1 - t0);
    t0 = t1;
  }
  return terkecil * 1000;   // mikrodetik
}

// opsi: { Ls, konfigurasi: [[k, n], ...], reps, warmup, blokMs, seed }
// lapor: { progres(teks, fraksi), berhenti() }
async function jalankanBenchmark(opsi, lapor) {
  const genLuar = buatRng(opsi.seed);        // rahasia dan pilihan peserta
  const genDalam = buatRng(opsi.seed + 1);   // A dan koefisien polinom di dalam blok ukur
  const baris = [];
  const totalUnit = opsi.Ls.length * opsi.konfigurasi.length * (opsi.warmup + opsi.reps);
  let unit = 0;

  for (const L of opsi.Ls) {
    for (const [k, n] of opsi.konfigurasi) {
      if (lapor.berhenti()) return baris;
      const m = modulusTertanam(L, n);
      if (!m) throw new Error(`modulus L = ${L}, n = ${n} tidak ada di modulus.js`);
      const ab = buatAB(L, k, n, m);
      if (!syaratAB(ab.m0, m, k).ok) throw new Error(`syarat Asmuth-Bloom gagal untuk L = ${L}, (${k}, ${n})`);
      const sp = buatShamir(L, k, n, primaShamirTertanam(L));

      lapor.progres(`L = ${L}, (${k}, ${n}): membangun tabel invers`, unit / totalUnit);
      await jeda();
      const t0 = performance.now();
      const tabel = bangunTabel(m);
      baris.push({ method: 'ab_setup_table', phase: 'setup', L, k, n, rep: 0, inner: 1, us: (performance.now() - t0) * 1000 });

      const ulang = {};
      const total = opsi.warmup + opsi.reps;
      for (let rep = 0; rep < total; rep++) {
        const pemanasan = rep < opsi.warmup;
        const S = acakBit(genLuar, L);
        const idx = pilihSubset(genLuar, n, k);
        let bAB, bSh;
        const hasil = {};

        const fnShare = {
          ab_share: () => { bAB = bagiAB(ab, S, genDalam); },
          shamir_share: () => { bSh = bagiShamir(sp, S, genDalam); },
        };
        for (const nama of METODE_SHARE) {
          if (!(nama in ulang)) ulang[nama] = kalibrasi(fnShare[nama], opsi.blokMs);
          hasil[nama] = ukurBlok(fnShare[nama], ulang[nama]);
        }

        const shAB = idx.map(i => bAB.share[i]);
        const shSh = idx.map(i => bSh.share[i]);
        const fnRekon = {
          ab_diff: () => rekonstruksiSelisih(ab, idx, shAB),
          ab_table: () => rekonstruksiTabel(ab, tabel, idx, shAB),
          ab_garner_inv: () => rekonstruksiGarnerInv(ab, idx, shAB),
          ab_classic: () => rekonstruksiKlasik(ab, idx, shAB),
          shamir_naive: () => rekonstruksiShamirBiasa(sp, idx, shSh),
          shamir_batch: () => rekonstruksiShamirBatch(sp, idx, shSh),
          shamir_small: () => rekonstruksiShamirKecil(sp, idx, shSh),
        };
        for (const nama of METODE_REKON) {
          if (lapor.berhenti()) return baris;
          lapor.progres(`L = ${L}, (${k}, ${n}): ${nama}, pengulangan ${rep + 1} dari ${total}${pemanasan ? ' (pemanasan)' : ''}`,
                        unit / totalUnit);
          if (!(nama in ulang)) ulang[nama] = kalibrasi(fnRekon[nama], opsi.blokMs);
          hasil[nama] = ukurBlok(fnRekon[nama], ulang[nama]);
          if (fnRekon[nama]() !== S) throw new Error('hasil rekonstruksi salah: ' + nama);
          await jeda();
        }
        unit++;
        if (pemanasan) continue;   // pemanasan dibuang
        for (const nama of METODE_SHARE)
          baris.push({ method: nama, phase: 'share', L, k, n, rep: rep - opsi.warmup + 1, inner: ulang[nama], us: hasil[nama] });
        for (const nama of METODE_REKON)
          baris.push({ method: nama, phase: 'reconstruct', L, k, n, rep: rep - opsi.warmup + 1, inner: ulang[nama], us: hasil[nama] });
      }
    }
  }
  lapor.progres('selesai', 1);
  return baris;
}

function barisKeCsv(baris) {
  const kepala = 'method,phase,L,k,n,rep,inner,us_per_op';
  const isi = baris.map(b => [b.method, b.phase, b.L, b.k, b.n, b.rep, b.inner, b.us.toFixed(4)].join(','));
  return [kepala, ...isi].join('\n') + '\n';
}

// Baca CSV benchmark (format program C maupun browser)
function bacaCsvBenchmark(teks) {
  const baris = teks.split(/\r?\n/).filter(b => b.trim() !== '');
  if (!baris.length) throw new Error('berkas kosong');
  const kepala = baris[0].split(',').map(s => s.trim());
  const kolom = ['method', 'phase', 'L', 'k', 'n', 'rep', 'inner', 'us_per_op'];
  const posisi = kolom.map(c => kepala.indexOf(c));
  if (posisi.some(p => p < 0)) throw new Error('kolom tidak lengkap, harusnya: ' + kolom.join(','));
  const hasil = [];
  for (let i = 1; i < baris.length; i++) {
    const s = baris[i].split(',');
    const us = Number(s[posisi[7]]);
    if (!Number.isFinite(us)) continue;
    hasil.push({
      method: s[posisi[0]].trim(), phase: s[posisi[1]].trim(),
      L: Number(s[posisi[2]]), k: Number(s[posisi[3]]), n: Number(s[posisi[4]]),
      rep: Number(s[posisi[5]]), inner: Number(s[posisi[6]]), us,
    });
  }
  if (!hasil.length) throw new Error('tidak ada baris data yang terbaca');
  return hasil;
}

function bacaCsvUkuran(teks) {
  const baris = teks.split(/\r?\n/).filter(b => b.trim() !== '');
  const kepala = baris[0].split(',').map(s => s.trim());
  if (!kepala.includes('ab_share_bits')) throw new Error('bukan berkas sizes.csv');
  return baris.slice(1).map(b => {
    const s = b.split(','), o = {};
    kepala.forEach((c, i) => { o[c] = Number(s[i]); });
    return o;
  });
}

// rata-rata dan simpangan baku sampel per (metode, L, k, n)
// Urutan tampil semua metode yang mungkin ada di data C maupun browser
const URUTAN_METODE = ['ab_diff', 'ab_diff_exact', 'ab_table', 'ab_garner_inv', 'ab_classic',
  'shamir_naive', 'shamir_batch', 'shamir_small', 'shamir_exact'];
const METODE_AB = URUTAN_METODE.slice(0, 5);
const METODE_SH = URUTAN_METODE.slice(5);

function kuartilArr(v) {
  const s = [...v].sort((a, b) => a - b), n = s.length;
  const q = p => { const h = p * (n - 1), a = Math.floor(h), f = h - a; return a + 1 < n ? s[a] + f * (s[a + 1] - s[a]) : s[a]; };
  return [q(0.25), q(0.5), q(0.75)];
}

// median, kuartil, dan nilai per pengulangan (untuk rasio berpasangan) per metode dan konfigurasi
function statistik(baris) {
  const grup = new Map();
  for (const b of baris) {
    const kunci = `${b.method}|${b.L}|${b.k}|${b.n}`;
    if (!grup.has(kunci)) grup.set(kunci, new Map());
    grup.get(kunci).set(b.rep, b.us);
  }
  const stat = new Map();
  for (const [kunci, peta] of grup) {
    const v = [...peta.values()];
    const mean = v.reduce((a, b) => a + b, 0) / v.length;
    const sd = v.length > 1 ? Math.sqrt(v.reduce((a, b) => a + (b - mean) ** 2, 0) / (v.length - 1)) : 0;
    const [q1, med, q3] = kuartilArr(v);
    stat.set(kunci, { mean, sd, cnt: v.length, q1, med, q3, perRep: peta });
  }
  const Ls = [...new Set(baris.map(b => b.L))].sort((a, b) => a - b);
  const konf = [...new Map(baris.map(b => [`${b.k},${b.n}`, [b.k, b.n]])).values()]
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const metode = URUTAN_METODE.filter(m => baris.some(b => b.method === m && b.phase === 'reconstruct'));
  return { Ls, konf, metode, ambil: (m, L, k, n) => stat.get(`${m}|${L}|${k}|${n}`) };
}

// Rasio waktu m / dasar, berpasangan per pengulangan (rahasia dan subset sama), median dengan
// interval kepercayaan 95% bootstrap (1.000 resampel, pembangkit berseed sehingga hasilnya tetap).
function rasioBerpasangan(st, m, dasar, L, k, n) {
  const a = st.ambil(m, L, k, n), b = st.ambil(dasar, L, k, n);
  if (!a || !b) return null;
  const r = [];
  for (const [rep, us] of a.perRep) { const d = b.perRep.get(rep); if (d > 0) r.push(us / d); }
  if (!r.length) return null;
  const med = kuartilArr(r)[1];
  if (r.length < 2) return { med, lo: med, hi: med };
  let x = 12345;
  const acak = () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; };
  const B = 1000, meds = [];
  for (let i = 0; i < B; i++) meds.push(kuartilArr(r.map(() => r[Math.floor(acak() * r.length)]))[1]);
  meds.sort((p, q) => p - q);
  return { med, lo: meds[Math.floor(0.025 * B)], hi: meds[Math.floor(0.975 * B) - 1] };
}

function tercepat(st, daftar, L, k, n) {
  let best = null;
  for (const m of daftar) { const s = st.ambil(m, L, k, n); if (s && (!best || s.med < best.med)) best = { m, med: s.med }; }
  return best ? best.m : null;
}

// Asmuth-Bloom tercepat lawan Shamir tercepat; satu pihak dinyatakan lebih cepat hanya bila
// seluruh interval kepercayaan rasio waktu Shamir / waktu AB berada di sisinya.
function abLawanShamir(st, L, k, n) {
  const a = tercepat(st, METODE_AB, L, k, n), s = tercepat(st, METODE_SH, L, k, n);
  if (!a || !s) return null;
  const r = rasioBerpasangan(st, s, a, L, k, n);
  if (!r) return null;
  return { a, s, ...r, putusan: r.lo > 1 ? 'ab' : r.hi < 1 ? 'shamir' : 'setara' };
}
