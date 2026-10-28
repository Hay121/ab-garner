// uji.js
// Padanan test.c untuk implementasi browser, ditambah pencocokan angka
// dengan program C dan uji sebaran k - 1 share pada parameter kecil.
'use strict';

const NAMA_METODE = {
  ab_diff: 'Usulan B: Garner selisih kecil',
  ab_table: 'Usulan A: Garner + tabel',
  ab_garner_inv: 'Garner dengan inversi',
  ab_classic: 'Asmuth–Bloom klasik',
  shamir_naive: 'Shamir biasa',
  shamir_batch: 'Shamir batch',
  shamir_small: 'Shamir bilangan kecil',
};

// kombinasi berikutnya dalam urutan leksikografis; false kalau sudah habis
function kombinasiBerikut(c, k, n) {
  let i = k - 1;
  while (i >= 0 && c[i] === n - k + i) i--;
  if (i < 0) return false;
  c[i]++;
  for (let j = i + 1; j < k; j++) c[j] = c[j - 1] + 1;
  return true;
}

function jumlahKombinasi(n, k) {
  let c = 1;
  for (let i = 0; i < k; i++) c = c * (n - i) / (i + 1);
  return Math.round(c);
}

// Semua rekonstruksi untuk satu himpunan peserta. idx boleh tidak terurut.
function semuaRekonstruksi(ab, tabel, sp, idx, shAB, shSh) {
  return {
    ab_diff: rekonstruksiSelisih(ab, idx, shAB),
    ab_table: rekonstruksiTabel(ab, tabel, idx, shAB),
    ab_garner_inv: rekonstruksiGarnerInv(ab, idx, shAB),
    ab_classic: rekonstruksiKlasik(ab, idx, shAB),
    shamir_naive: rekonstruksiShamirBiasa(sp, idx, shSh),
    shamir_batch: rekonstruksiShamirBatch(sp, idx, shSh),
    shamir_small: rekonstruksiShamirKecil(sp, idx, shSh),
  };
}

async function ujiKebenaran(seed, lapor) {
  const gen = buatRng(seed);
  // konfigurasi mengikuti test.c; untuk n besar dipakai subset acak
  const daftar = [
    { L: 16, k: 2, n: 3, rahasia: 20, semua: true },
    { L: 32, k: 3, n: 5, rahasia: 20, semua: true },
    { L: 64, k: 5, n: 10, rahasia: 10, semua: true },
    { L: 64, k: 5, n: 5, rahasia: 10, semua: true },
    { L: 256, k: 3, n: 5, rahasia: 20, semua: true },
    { L: 256, k: 5, n: 10, rahasia: 10, semua: true },
    { L: 256, k: 10, n: 20, rahasia: 10, subset: 30 },
    { L: 256, k: 20, n: 40, rahasia: 6, subset: 20 },
    { L: 1024, k: 3, n: 5, rahasia: 10, semua: true },
    { L: 1024, k: 10, n: 20, rahasia: 4, subset: 10 },
    { L: 2048, k: 3, n: 5, rahasia: 10, semua: true },
    { L: 2048, k: 10, n: 20, rahasia: 4, subset: 10 },
  ];
  let total = 0, gagal = 0;
  const cek = (ok, apa, c) => {
    total++;
    if (!ok) { gagal++; lapor.log(`  GAGAL: ${apa} (L=${c.L} k=${c.k} n=${c.n})`); }
  };

  for (const c of daftar) {
    const gagalSebelum = gagal;
    lapor.progres(`L=${c.L} k=${c.k} n=${c.n} ...`);
    await jeda();
    const { ab } = await bangkitkanAB(c.L, c.k, c.n);
    const tabel = bangunTabel(ab.m);
    const sp = await bangkitkanShamir(c.L, c.k, c.n);
    cek(syaratAB(ab.m0, ab.m, c.k).ok, 'syarat Asmuth-Bloom', c);
    cek(bitLen(ab.m[c.n - 1]) === c.L + 1, 'ukuran share L+1 bit', c);

    for (let t = 0; t < c.rahasia; t++) {
      let S;
      if (t === 0) S = 0n;                       // kasus tepi
      else if (t === 1) S = 1n;
      else if (t === 2) S = ab.m0 - 1n;
      else S = acakBit(gen, c.L);

      const bAB = bagiAB(ab, S, gen), bSh = bagiShamir(sp, S, gen);
      bAB.share.forEach((s, i) => cek(s < ab.m[i], 'share < modulus', c));

      const kumpulan = [];
      if (c.semua) {
        const kom = [];
        for (let i = 0; i < c.k; i++) kom.push(i);
        do { kumpulan.push(kom.slice()); } while (kombinasiBerikut(kom, c.k, c.n));
      } else {
        for (let u = 0; u < c.subset; u++) kumpulan.push(pilihSubset(gen, c.n, c.k));
      }
      for (const kom of kumpulan) {
        const idx = acakUrutan(gen, kom.slice());   // urutan sembarang
        const hasil = semuaRekonstruksi(ab, tabel, sp, idx, idx.map(i => bAB.share[i]), idx.map(i => bSh.share[i]));
        for (const nama in hasil) cek(hasil[nama] === S, NAMA_METODE[nama], c);
      }

      // uji negatif, hanya untuk L >= 64 agar peluang kebetulan sama bisa diabaikan
      if (t >= 3 && c.L >= 64) {
        const idx = pilihSubset(gen, c.n, c.k);
        const kurang = idx.slice(0, c.k - 1);
        cek(rekonstruksiTabel(ab, tabel, kurang, kurang.map(i => bAB.share[i])) !== S,
            'k-1 share (usulan A) menghasilkan rahasia', c);
        cek(rekonstruksiSelisih(ab, kurang, kurang.map(i => bAB.share[i])) !== S,
            'k-1 share (usulan B) menghasilkan rahasia', c);
        cek(rekonstruksiShamirBatch(sp, kurang, kurang.map(i => bSh.share[i])) !== S,
            'k-1 share (Shamir) menghasilkan rahasia', c);
        cek(rekonstruksiShamirKecil(sp, kurang, kurang.map(i => bSh.share[i])) !== S,
            'k-1 share (Shamir bilangan kecil) menghasilkan rahasia', c);
        const rusak = idx.map(i => bAB.share[i]);
        rusak[0] = (rusak[0] + 1n) % ab.m[idx[0]];
        cek(rekonstruksiTabel(ab, tabel, idx, rusak) !== S, 'share rusak tetap memberi rahasia', c);
        cek(rekonstruksiSelisih(ab, idx, rusak) !== S, 'share rusak tetap memberi rahasia (usulan B)', c);
      }
      await jeda();
    }
    lapor.log(`L=${c.L} k=${c.k} n=${c.n}: ${gagal === gagalSebelum ? 'lulus' : 'ADA KEGAGALAN'}`);
  }
  return { total, gagal };
}

// ---------- pencocokan dengan program C ----------

function barisCek(nama, harapan, hasil) {
  return { nama, harapan: String(harapan), hasil: String(hasil), sama: String(harapan) === String(hasil) };
}

// Angka contoh Bab 3.8 (sama dengan keluaran bin/demo)
function cekContohMakalah() {
  const baris = [];
  const ab = abContohMakalah();
  const tabel = bangunTabel(ab.m);
  const harapanTabel = [[0, 1, 24], [0, 2, 27], [0, 3, 29], [1, 2, 15], [1, 3, 23], [2, 3, 6]];
  const isiTabel = harapanTabel.map(([i, j]) => tabel[i * 4 + j]).join(', ');
  baris.push(barisCek('Tabel invers c12, c13, c14, c23, c24, c34', harapanTabel.map(h => h[2]).join(', '), isiTabel));

  const b = bagiAB(ab, 11n, null, 321n);
  baris.push(barisCek('y = 11 + 321 · 16', 5147, b.y));
  baris.push(barisCek('Share peserta 1 sampai 4', '18, 14, 1, 4', b.share.join(', ')));

  for (const idx of [[0, 1, 3], [1, 2, 3]]) {
    const nama = idx.map(i => i + 1).join(', ');
    const log = logBaru();
    const S = rekonstruksiTabel(ab, tabel, idx, idx.map(i => b.share[i]), log);
    baris.push(barisCek(`Garner + tabel, peserta ${nama}: y dan S`, '5147, 11', `${log.y}, ${S}`));
  }
  const harapanB = { '0,1,3': '18, 20, 7 → 11', '1,2,3': '14, 22, 5 → 11' };
  for (const idx of [[0, 1, 3], [1, 2, 3]]) {
    const log = logBaru();
    const S = rekonstruksiSelisih(ab, idx, idx.map(i => b.share[i]), log);
    baris.push(barisCek(`Garner selisih kecil (usulan B), peserta ${idx.map(i => i + 1).join(', ')}: digit v dan S`,
      harapanB[idx.join(',')], `${log.langkahB.map(l => l.v).join(', ')} → ${S}`));
  }
  const logK = logBaru();
  const Sk = rekonstruksiKlasik(ab, [0, 1, 3], [0, 1, 3].map(i => b.share[i]), logK);
  baris.push(barisCek('Rumus klasik peserta 1, 2, 4: jumlah, M, S', '424690, 24679, 11', `${logK.jumlah}, ${logK.M}, ${Sk}`));
  const Sg = rekonstruksiGarnerInv(ab, [0, 1, 3], [0, 1, 3].map(i => b.share[i]));
  baris.push(barisCek('Garner dengan inversi, peserta 1, 2, 4', 11, Sg));

  const sp = buatShamir(4, 3, 4, nextPrime(16n));
  const bs = bagiShamir(sp, 11n, null, [5n, 3n]);
  baris.push(barisCek('Shamir p = 17, f(x) = 11 + 5x + 3x²: share', '2, 16, 2, 11', bs.share.join(', ')));
  const idx = [0, 1, 3], shs = idx.map(i => bs.share[i]);
  baris.push(barisCek('Shamir biasa dan batch, peserta 1, 2, 4', '11, 11',
    `${rekonstruksiShamirBiasa(sp, idx, shs)}, ${rekonstruksiShamirBatch(sp, idx, shs)}`));
  return baris;
}

function ringkasBesar(x) {
  const h = x.toString(16);
  return h.length <= 16 ? '0x' + h : '0x' + h.slice(0, 8) + '…' + h.slice(-6);
}

// Cari ulang beberapa modulus pertama di browser lalu bandingkan dengan hasil ekspor program C
async function cekModulus(L, jumlah) {
  const tertanam = modulusTertanam(L, jumlah);
  if (!tertanam) return [barisCek(`Modulus L = ${L}`, 'tersedia', 'tidak ada di modulus.js')];
  const dicari = [];
  let c = (1n << BigInt(L)) + (1n << BigInt(L / 2));
  for (let i = 0; i < jumlah; i++) {
    c = nextPrime(c);
    dicari.push(c);
    await jeda();
  }
  const cocok = dicari.filter((m, i) => m === tertanam[i]).length;
  const baris = [{
    nama: `${jumlah} modulus pertama L = ${L} (dicari ulang di browser)`,
    harapan: `${ringkasBesar(tertanam[0])} dst.`,
    hasil: `${cocok} dari ${jumlah} sama`,
    sama: cocok === jumlah,
  }];
  const p = nextPrime(1n << BigInt(L));
  baris.push(barisCek(`Prima Shamir L = ${L}`, ringkasBesar(primaShamirTertanam(L)), ringkasBesar(p)));
  return baris;
}

// ---------- sebaran nilai rahasia dari k - 1 share ----------

// parameter kecil yang sama dengan leakage_demo di test.c
const PARAM_SEBARAN = { L: 8, k: 3, m: [307n, 311n, 313n, 317n, 331n] };

function hitungSebaran(S, pilihan, gen32) {
  const ab = buatAB(PARAM_SEBARAN.L, PARAM_SEBARAN.k, PARAM_SEBARAN.m.length, PARAM_SEBARAN.m);
  const b = bagiAB(ab, S, gen32);
  const [i1, i2] = pilihan.slice().sort((a, c) => a - c);
  const mm = [ab.m[i1], ab.m[i2]];
  const y0 = crtGarnerInv(mm, [b.share[i1], b.share[i2]]);
  const beta = mm[0] * mm[1];
  const hitung = new Array(256).fill(0);
  let kandidat = 0;
  for (let y = y0; y < ab.Mk; y += beta) {
    hitung[Number(y % 256n)]++;
    kandidat++;
  }
  const muncul = hitung.filter(h => h > 0);
  return {
    hitung, kandidat, beta, Mk: ab.Mk, y: b.y,
    mungkin: muncul.length,
    min: Math.min(...hitung), max: Math.max(...hitung),
    dua: hitung.filter(h => h === 2).length,
  };
}
