// skema.js
// Tiga cara menyelesaikan sistem kongruensi x = r[j] (mod m[j]) serta skema
// Asmuth-Bloom dan Shamir. Nama dan urutan langkah disamakan dengan crt.c,
// ab.c, dan shamir.c pada program C supaya keduanya mudah dibandingkan.
//
// Parameter `log` opsional. Kalau diisi (lihat logBaru), fungsi mencatat jumlah
// operasi dan langkah perhitungan untuk ditampilkan di demo. Benchmark dan uji
// memanggil tanpa log.
'use strict';

function logBaru() {
  return { inv: 0, iterasi: 0, mulModular: 0, mulKecil: 0, opBesar: 0, bitMaks: 0, langkah: [], horner: [] };
}

function catatBit(log, x) {
  const b = bitLen(x);
  if (b > log.bitMaks) log.bitMaks = b;
}

// ---------- tiga cara CRT ----------

// Rumus CRT klasik (konstruksi pada bukti CRT di Rosen): k inversi,
// bilangan antara sebesar M = m_1 ... m_k
function crtKlasik(m, r, log) {
  const k = m.length;
  let M = 1n;
  for (let j = 0; j < k; j++) M *= m[j];
  let x = 0n;
  for (let j = 0; j < k; j++) {
    const Mj = M / m[j];
    const t = Mj % m[j];
    const info = log ? {} : null;
    const y = modInverse(t, m[j], info);
    const suku = r[j] * y * Mj;
    x += suku;
    if (log) {
      log.inv++; log.iterasi += info.iterasi; log.mulModular++; log.opBesar += 3;
      log.langkah.push({ m: m[j], Mj, t, y, iterasi: info.iterasi, suku });
      catatBit(log, x);
    }
  }
  const hasil = x % M;
  if (log) { log.opBesar++; log.M = M; log.jumlah = x; }
  return hasil;
}

// Garner inkremental (Menezes dkk. 14.71): C_j = (m_1 ... m_(j-1))^-1 mod m_j
// dihitung saat rekonstruksi, jadi k - 1 inversi
function crtGarnerInv(m, r, log) {
  const k = m.length;
  let x = mod(r[0], m[0]);
  let P = m[0];
  for (let j = 1; j < k; j++) {
    const info = log ? {} : null;
    const C = modInverse(P % m[j], m[j], info);
    const u = mod((r[j] - x % m[j]) * C, m[j]);
    x += u * P;
    P *= m[j];
    if (log) {
      log.inv++; log.iterasi += info.iterasi; log.mulModular++; log.opBesar += 4;
      catatBit(log, P); catatBit(log, x);
    }
  }
  return x;
}

// Tabel invers berpasangan: tabel[i*n + j] = m_i^-1 mod m_j untuk i < j.
// Dihitung sekali oleh dealer dan boleh publik.
function bangunTabel(m) {
  const n = m.length;
  const tabel = new Array(n * n).fill(null);
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) tabel[i * n + j] = modInverse(m[i], m[j]);
  }
  return tabel;
}

// Garner dengan tabel (metode usulan). idx = indeks global peserta, terurut naik.
// Tidak ada inversi sama sekali, semua konstanta dibaca dari tabel.
function crtGarnerTabel(mAll, tabel, idx, r, log) {
  const n = mAll.length, k = idx.length;
  const v = new Array(k);
  v[0] = mod(r[0], mAll[idx[0]]);
  if (log) log.langkah.push({ peserta: idx[0], m: mAll[idx[0]], r: r[0], sub: [], v: v[0] });
  for (let j = 1; j < k; j++) {
    const mj = mAll[idx[j]];
    let t = r[j];
    const sub = log ? [] : null;
    for (let a = 0; a < j; a++) {
      const c = tabel[idx[a] * n + idx[j]];
      const tLama = t;
      t = mod((t - v[a]) * c, mj);
      if (log) {
        log.mulModular++;
        catatBit(log, (tLama - v[a]) * c);
        sub.push({ ia: idx[a], c, tLama, va: v[a], t });
      }
    }
    v[j] = t;
    if (log) log.langkah.push({ peserta: idx[j], m: mj, r: r[j], sub, v: t });
  }
  // gabungkan dengan skema Horner: x = v_1 + m_1 (v_2 + m_2 (v_3 + ...))
  let x = v[k - 1];
  for (let j = k - 2; j >= 0; j--) {
    const xLama = x;
    x = x * mAll[idx[j]] + v[j];
    if (log) { log.opBesar++; log.horner.push({ xLama, m: mAll[idx[j]], v: v[j], x }); catatBit(log, x); }
  }
  return x;
}

// Garner untuk modulus berdekatan (usulan B). Karena m_b mod m_j = m_b - m_j kecil,
// perkalian dengan modulus diganti perkalian dengan selisih kecil, dan
// P mod m_j menjadi hasil kali selisih yang inversinya murah.
function crtGarnerSelisih(ab, idx, r, log) {
  const k = idx.length;
  const v = new Array(k);
  v[0] = mod(r[0], ab.m[idx[0]]);
  if (log) log.langkahB = [{ peserta: idx[0], m: ab.m[idx[0]], r: r[0], v: v[0] }];
  for (let j = 1; j < k; j++) {
    const mj = ab.m[idx[j]], oj = ab.off[idx[j]];
    let s = v[j - 1];                                   // s = x mod m_j lewat Horner dengan selisih
    for (let b = j - 2; b >= 0; b--) s = s * (ab.off[idx[b]] - oj) + v[b];
    let D = 1n;                                         // D = (m_1 ... m_(j-1)) mod m_j
    for (let b = 0; b < j; b++) D *= ab.off[idx[b]] - oj;
    const info = log ? {} : null;
    const inv = modInverse(D, mj, info);
    v[j] = (mod(r[j] - s, mj) * inv) % mj;
    if (log) {
      log.inv++; log.iterasi += info.iterasi; log.mulModular++; log.mulKecil += 2 * (j - 1);
      catatBit(log, s); catatBit(log, D);
      log.langkahB.push({ peserta: idx[j], m: mj, r: r[j], s, D, inv, v: v[j],
        selisih: idx.slice(0, j).map(i => ab.off[i] - oj) });
    }
  }
  return v;
}

// ---------- Asmuth-Bloom ----------

function buatAB(L, k, n, m) {
  const m0 = 1n << BigInt(L);
  let Mk = 1n;
  for (let i = 0; i < k; i++) Mk *= m[i];
  // untuk usulan B: selisih tiap modulus terhadap m_1, dan m_i mod 2^L = 2^h + e_i
  const mask = m0 - 1n;
  const off = m.map(x => x - m[0]);
  const h = BigInt(bitLen(m[0] & mask) - 1);
  const e = m.map(x => (x & mask) - (1n << h));
  return { L, k, n, m0, m, Mk, off, h, e };
}

// syarat: m0 * (k - 1 modulus terbesar) < (k modulus terkecil)
function syaratAB(m0, m, k) {
  const n = m.length;
  let kiri = m0, kanan = 1n;
  for (let i = n - (k - 1); i < n; i++) kiri *= m[i];
  for (let i = 0; i < k; i++) kanan *= m[i];
  return { kiri, kanan, ok: kiri < kanan };
}

// contoh hitungan manual Bab 3.8 makalah (sama dengan bin/demo)
function abContohMakalah() {
  return buatAB(4, 3, 4, [23n, 29n, 31n, 37n]);
}

// modulus hasil ekspor program C (web/js/modulus.js), null kalau tidak tersedia
function modulusTertanam(L, n) {
  if (typeof OFFSET_MODULUS === 'undefined') return null;
  const off = OFFSET_MODULUS[L];
  if (!off || n > off.length) return null;
  const dasar = (1n << BigInt(L)) + (1n << BigInt(L / 2));
  return off.slice(0, n).map(o => dasar + BigInt(o));
}

function primaShamirTertanam(L) {
  if (typeof OFFSET_PRIMA_SHAMIR === 'undefined' || !(L in OFFSET_PRIMA_SHAMIR)) return null;
  return (1n << BigInt(L)) + BigInt(OFFSET_PRIMA_SHAMIR[L]);
}

// Sama dengan ab_params_init di ab.c: modulus prima berurutan mulai dari
// 2^L + 2^margin, margin = L/2 lalu diperbesar kalau syarat tidak terpenuhi.
async function bangkitkanAB(L, k, n, progres) {
  const m0 = 1n << BigInt(L);
  for (let margin = Math.floor(L / 2); margin < L; margin++) {
    let m = margin === Math.floor(L / 2) ? modulusTertanam(L, n) : null;
    let sumber = 'ekspor program C (web/js/modulus.js)';
    if (!m) {
      sumber = 'dicari di browser';
      m = [];
      let c = m0 + (1n << BigInt(margin));
      for (let i = 0; i < n; i++) {
        c = nextPrime(c);
        m.push(c);
        if (progres) { progres(i + 1, n); await jeda(); }
      }
    }
    if (syaratAB(m0, m, k).ok) return { ab: buatAB(L, k, n, m), margin, sumber };
  }
  throw new Error('syarat Asmuth-Bloom tidak bisa dipenuhi untuk L = ' + L);
}

// share ke-i = y mod m_i, dengan y = S + A*m0 dan A acak di [0, floor(Mk/m0) - 1]
function bagiAB(ab, S, gen32, Atetap) {
  const A = Atetap !== undefined ? Atetap : acakDiBawah(gen32, ab.Mk / ab.m0);
  const y = S + A * ab.m0;
  const share = ab.m.map(mi => y % mi);
  return { A, y, share };
}

// urutkan pasangan (indeks, share) naik menurut indeks
function urutkanSubset(idx, sh) {
  const pasangan = idx.map((i, j) => [i, sh[j]]);
  pasangan.sort((a, b) => a[0] - b[0]);
  return { idx: pasangan.map(p => p[0]), sh: pasangan.map(p => p[1]) };
}

// rahasia = y mod m0; karena m0 = 2^L cukup ambil L bit terendah
function ambilRahasia(ab, y) {
  return y & (ab.m0 - 1n);
}

function rekonstruksiTabel(ab, tabel, idx, sh, log) {
  const u = urutkanSubset(idx, sh);
  const y = crtGarnerTabel(ab.m, tabel, u.idx, u.sh, log);
  if (log) log.y = y;
  return ambilRahasia(ab, y);
}

// Usulan B. Hasil akhir cukup y mod 2^L; karena m_b mod 2^L = 2^h + e_b,
// mengalikan dengan m_b berarti geser h bit ditambah perkalian dengan bilangan kecil e_b.
function rekonstruksiSelisih(ab, idx, sh, log) {
  const u = urutkanSubset(idx, sh);
  const v = crtGarnerSelisih(ab, u.idx, u.sh, log);
  const mask = ab.m0 - 1n;
  let S = v[v.length - 1];
  if (log) log.hornerB = [];
  for (let j = v.length - 2; j >= 0; j--) {
    const lama = S;
    S = ((S << ab.h) + S * ab.e[u.idx[j]] + v[j]) & mask;
    if (log) { log.mulKecil++; log.hornerB.push({ lama, mb: ab.m[u.idx[j]] & mask, v: v[j], S }); }
  }
  return S & mask;
}

function rekonstruksiGarnerInv(ab, idx, sh, log) {
  const u = urutkanSubset(idx, sh);
  const y = crtGarnerInv(u.idx.map(i => ab.m[i]), u.sh, log);
  if (log) log.y = y;
  return ambilRahasia(ab, y);
}

function rekonstruksiKlasik(ab, idx, sh, log) {
  const u = urutkanSubset(idx, sh);
  const y = crtKlasik(u.idx.map(i => ab.m[i]), u.sh, log);
  if (log) log.y = y;
  return ambilRahasia(ab, y);
}

// ---------- Shamir (pembanding) ----------

function buatShamir(L, k, n, p) {
  return { L, k, n, p };
}

async function bangkitkanShamir(L, k, n) {
  const p = primaShamirTertanam(L) || nextPrime(1n << BigInt(L));
  return buatShamir(L, k, n, p);
}

// f(x) = S + a_1 x + ... + a_(k-1) x^(k-1) mod p; peserta ke-i memegang f(i + 1)
function bagiShamir(sp, S, gen32, koefTetap) {
  const k = sp.k, p = sp.p;
  const a = [S];
  for (let j = 1; j < k; j++) a.push(koefTetap ? koefTetap[j - 1] : acakDiBawah(gen32, p));
  const share = [];
  for (let i = 0; i < sp.n; i++) {
    const x = BigInt(i + 1);
    let f = a[k - 1];
    for (let j = k - 2; j >= 0; j--) f = (f * x + a[j]) % p;   // evaluasi Horner
    share.push(f);
  }
  return { koef: a, share };
}

// pembilang dan penyebut koefisien Lagrange ke-j di x = 0
function lagrangeNumDen(sp, idx, j) {
  const p = sp.p, xj = BigInt(idx[j] + 1);
  let num = 1n, den = 1n;
  for (let l = 0; l < idx.length; l++) {
    if (l === j) continue;
    const xl = BigInt(idx[l] + 1);
    num = (num * xl) % p;
    den = mod(den * (xl - xj), p);
  }
  return [num, den];
}

// Lagrange dengan k inversi (versi buku teks)
function rekonstruksiShamirBiasa(sp, idx, sh, log) {
  const p = sp.p, k = idx.length;
  let S = 0n;
  for (let j = 0; j < k; j++) {
    const [num, den] = lagrangeNumDen(sp, idx, j);
    // den = hasil kali selisih koordinat kecil, jadi inversinya selesai dalam sedikit langkah Euclid
    const info = log ? {} : null;
    const lam = (num * modInverse(den, p, info)) % p;
    S = (S + sh[j] * lam) % p;
    if (log) {
      log.inv++; log.iterasi += info.iterasi; log.mulKecil += 2 * (k - 1); log.mulModular += 2;
      catatBit(log, sh[j] * lam);
    }
  }
  return S;
}

// Lagrange dengan satu inversi (trik batch Montgomery)
function rekonstruksiShamirBatch(sp, idx, sh, log) {
  const p = sp.p, k = idx.length;
  const num = new Array(k), den = new Array(k), pre = new Array(k);
  for (let j = 0; j < k; j++) [num[j], den[j]] = lagrangeNumDen(sp, idx, j);
  pre[0] = den[0];
  for (let j = 1; j < k; j++) pre[j] = (pre[j - 1] * den[j]) % p;
  // satu inversi untuk semua penyebut; hasil kalinya sudah selebar p, jadi inversi ini penuh
  const info = log ? {} : null;
  let invAll = modInverse(pre[k - 1], p, info);
  let S = 0n;
  for (let j = k - 1; j >= 0; j--) {
    let inv;
    if (j > 0) {
      inv = (invAll * pre[j - 1]) % p;   // den_j^-1
      invAll = (invAll * den[j]) % p;    // sekarang (den_0 ... den_(j-1))^-1
    } else {
      inv = invAll;
    }
    const lam = (num[j] * inv) % p;
    S = (S + sh[j] * lam) % p;
    if (log) catatBit(log, sh[j] * lam);
  }
  if (log) { log.inv++; log.iterasi += info.iterasi; log.mulKecil += 2 * k * (k - 1); log.mulModular += 5 * k - 3; }
  return S;
}

// Shamir bilangan kecil (pembanding setara usulan B), padanan sh_reconstruct_small di shamir.c:
// pembilang dan penyebut dihitung eksak tanpa reduksi, satu inversi per peserta, perkalian
// lebar penuh langsung dijumlahkan, dan reduksi mod p hanya sekali di akhir.
function rekonstruksiShamirKecil(sp, idx, sh, log) {
  const p = sp.p, k = idx.length;
  const x = idx.map(i => BigInt(i + 1));
  let nTot = 1n;
  for (const v of x) nTot *= v;
  let acc = 0n;
  for (let j = 0; j < k; j++) {
    let num = nTot / x[j];
    let den = 1n;
    for (let l = 0; l < k; l++) if (l !== j) den *= x[l] - x[j];
    if (den < 0n) { den = -den; num = -num; }
    const info = log ? {} : null;
    acc += sh[j] * num * modInverse(den, p, info);
    if (log) {
      log.inv++; log.iterasi += info.iterasi; log.mulKecil += k; log.mulModular++;
      catatBit(log, acc);
    }
  }
  if (log) { log.mulKecil += k; log.opBesar++; }
  return mod(acc, p);
}
