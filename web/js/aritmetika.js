// aritmetika.js
// Operasi dasar bilangan besar dengan BigInt (bawaan JavaScript sejak ES2020).
// Dipakai bersama oleh demo, uji kebenaran, dan benchmark.
'use strict';

function mod(a, m) {
  const r = a % m;
  return r < 0n ? r + m : r;
}

function bitLen(x) {
  if (x < 0n) x = -x;
  return x === 0n ? 0 : x.toString(2).length;
}

// Invers modular dengan algoritme Euclid yang diperluas (teorema Bezout).
// JavaScript tidak punya fungsi invers bawaan, jadi ini ditulis sendiri.
// `info` opsional, diisi jumlah iterasi untuk ditampilkan di demo.
function modInverse(a, m, info) {
  let r0 = mod(a, m), r1 = m;
  let s0 = 1n, s1 = 0n;
  let iterasi = 0;
  while (r1 !== 0n) {
    const q = r0 / r1;
    let t = r0 - q * r1; r0 = r1; r1 = t;
    t = s0 - q * s1; s0 = s1; s1 = t;
    iterasi++;
  }
  if (r0 !== 1n) throw new Error('tidak punya invers modulo ' + m + ' (gcd = ' + r0 + ')');
  if (info) info.iterasi = iterasi;
  return mod(s0, m);
}

// Eksponensiasi modular biner, sama dengan algoritme di slide Integer Representations
function modPow(b, e, m) {
  let x = 1n;
  let power = mod(b, m);
  while (e > 0n) {
    if (e & 1n) x = (x * power) % m;
    power = (power * power) % m;
    e >>= 1n;
  }
  return x;
}

// Prima kecil sampai 2000: untuk saringan kandidat dan basis Miller-Rabin
const PRIMA_KECIL = (function () {
  const batas = 2000, coret = new Uint8Array(batas + 1), hasil = [];
  for (let i = 2; i <= batas; i++) {
    if (coret[i]) continue;
    hasil.push(i);
    for (let j = i * i; j <= batas; j += i) coret[j] = 1;
  }
  return hasil;
})();

// Uji Miller-Rabin dengan basis 2, 3, 5, ... (n ganjil dan > 2000^2)
function millerRabin(n, putaran) {
  let d = n - 1n, s = 0;
  while ((d & 1n) === 0n) { d >>= 1n; s++; }
  for (let i = 0; i < putaran; i++) {
    let x = modPow(BigInt(PRIMA_KECIL[i]), d, n);
    if (x === 1n || x === n - 1n) continue;
    let komposit = true;
    for (let r = 1; r < s; r++) {
      x = (x * x) % n;
      if (x === n - 1n) { komposit = false; break; }
    }
    if (komposit) return false;
  }
  return true;
}

function isProbablePrime(n, putaran = 20) {
  if (n < 2n) return false;
  for (const p of PRIMA_KECIL) {
    const bp = BigInt(p);
    if (n === bp) return true;
    if (n % bp === 0n) return false;
  }
  if (n < 4000000n) return true;   // tidak habis dibagi prima <= 2000, pasti prima
  return millerRabin(n, putaran);
}

// Prima pertama yang lebih besar dari n (sama dengan mpz_nextprime di GMP)
function nextPrime(n) {
  let c = n + 1n;
  if (c <= 2n) return 2n;
  if ((c & 1n) === 0n) c += 1n;
  if (c < 4000000n) {
    while (!isProbablePrime(c)) c += 2n;
    return c;
  }
  // Saringan inkremental: sisa bagi c terhadap tiap prima kecil disimpan sebagai Number,
  // jadi kandidat yang jelas komposit dibuang tanpa operasi BigInt.
  const prima = PRIMA_KECIL.slice(1);  // tanpa 2, kandidat selalu ganjil
  const sisa = prima.map(p => Number(c % BigInt(p)));
  for (;;) {
    let lolos = true;
    for (let i = 0; i < sisa.length; i++) {
      if (sisa[i] === 0) { lolos = false; break; }
    }
    if (lolos && millerRabin(c, 20)) return c;
    c += 2n;
    for (let i = 0; i < sisa.length; i++) {
      sisa[i] += 2;
      if (sisa[i] >= prima[i]) sisa[i] -= prima[i];
    }
  }
}

// ---------- bilangan acak ----------

// Pembangkit berseed (xorshift32) untuk uji dan benchmark supaya bisa diulang.
// Bukan pembangkit yang aman secara kriptografis.
function buatRng(seed) {
  let s = (seed >>> 0) || 0x9e3779b9;
  return function () {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s;
  };
}

// Sumber acak dari Web Crypto, dipakai demo
function gen32Aman() {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0];
}

// bilangan acak `bits` bit dari pembangkit 32 bit
function acakBit(gen32, bits) {
  const kata = Math.ceil(bits / 32);
  let x = 0n;
  for (let i = 0; i < kata; i++) x = (x << 32n) | BigInt(gen32());
  const lebih = kata * 32 - bits;
  return lebih ? x >> BigInt(lebih) : x;
}

// seragam di [0, batas - 1], dengan metode penolakan
function acakDiBawah(gen32, batas) {
  const b = Math.max(1, bitLen(batas - 1n));
  for (;;) {
    const x = acakBit(gen32, b);
    if (x < batas) return x;
  }
}

// k indeks berbeda dari 0..n-1, terurut naik
function pilihSubset(gen32, n, k) {
  const kumpulan = [];
  for (let i = 0; i < n; i++) kumpulan.push(i);
  for (let i = 0; i < k; i++) {
    const j = i + (gen32() % (n - i));
    const t = kumpulan[i]; kumpulan[i] = kumpulan[j]; kumpulan[j] = t;
  }
  return kumpulan.slice(0, k).sort((a, b) => a - b);
}

function acakUrutan(gen32, arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = gen32() % (i + 1);
    const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
  }
  return arr;
}

// Memberi kesempatan browser memperbarui tampilan di tengah perhitungan panjang.
// MessageChannel dipakai karena setTimeout(0) berulang dibatasi minimal 4 ms.
function jeda() {
  return new Promise(resolve => {
    if (typeof MessageChannel === 'undefined') { setTimeout(resolve, 0); return; }
    const ch = new MessageChannel();
    ch.port1.onmessage = () => { ch.port1.close(); resolve(); };
    ch.port2.postMessage(null);
  });
}
