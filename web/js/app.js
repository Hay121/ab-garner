// app.js
// Antarmuka halaman: perpindahan tab, demo, uji, benchmark, dan pembaca hasil program C.
'use strict';

const $ = id => document.getElementById(id);

const LABEL = {
  ab_diff: 'Usulan B: Garner selisih kecil',
  ab_table: 'Usulan A: Garner + tabel',
  ab_garner_inv: 'Garner dengan inversi',
  ab_classic: 'Asmuth–Bloom klasik',
  shamir_naive: 'Shamir biasa',
  shamir_batch: 'Shamir batch',
  shamir_small: 'Shamir bilangan kecil',
  ab_diff_exact: 'Usulan B + pembagian eksak',
  shamir_exact: 'Shamir + pembagian eksak',
  ab_share: 'Asmuth–Bloom',
  shamir_share: 'Shamir',
};

function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

let tampilLengkap = false;

// bilangan sampai 64 bit ditulis desimal, yang lebih besar diringkas dalam heksadesimal
function fmt(x) {
  if (typeof x !== 'bigint') return String(x);
  const negatif = x < 0n;
  const a = negatif ? -x : x;
  let s;
  if (a < (1n << 64n)) s = a.toString();
  else if (tampilLengkap) s = '0x' + a.toString(16);
  else {
    const h = a.toString(16);
    s = `0x${h.slice(0, 8)}…${h.slice(-6)} (${bitLen(a)} bit)`;
  }
  return (negatif ? '−' : '') + s;
}

function fmtPendek(x) {
  return x < 1000000n ? x.toString() : '0x' + x.toString(16).slice(0, 5) + '…';
}

function fmtInput(x) {
  return x < (1n << 64n) ? x.toString() : '0x' + x.toString(16);
}

// indeks bawah dua angka: c14, atau c3,12 kalau salah satunya dua digit
function indeks(i, j) {
  return (i >= 10 || j >= 10) ? `${i},${j}` : `${i}${j}`;
}

function setStatus(id, teks, jenis) {
  const el = $(id);
  el.textContent = teks;
  el.className = 'status' + (jenis ? ' ' + jenis : '');
}

function angkaId(x, d) {
  return x.toLocaleString('id-ID', { minimumFractionDigits: d, maximumFractionDigits: d });
}

function fmtUs(us) {
  return angkaId(us, us >= 1000 ? 0 : us >= 10 ? 1 : 2);
}

function lencana(ok) {
  return ok ? '<span class="lencana ok">sama</span>' : '<span class="lencana salah">berbeda</span>';
}

// ===================== tab =====================

const DAFTAR_TAB = ['demo', 'uji', 'benchmark', 'hasil', 'tentang'];
const sumberDemo = () => (document.querySelector('input[name="demo-sumber"]:checked') || { value: 'contoh' }).value;

const kurangiGerak = () => !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);

// Halaman sekarang satu gulungan panjang; bagian aktif ditandai oleh aturAdegan().
function bukaTab() {}

// ===================== pembuka, identitas, tema =====================

function renderDindingDigit() {
  const wadah = $('dinding-digit');
  if (!wadah || typeof OFFSET_MODULUS === 'undefined' || !OFFSET_MODULUS[256]) return;
  const n = 5;
  const dasar = (1n << 256n) + (1n << 128n);
  const m = OFFSET_MODULUS[256].slice(0, n).map(o => dasar + BigInt(o));
  const teks = m.map(x => x.toString());
  const pj = teks[0].length;
  let p = 0;
  while (p < pj && teks.every(t => t.length === pj && t[p] === teks[0][p])) p++;
  const kelompokkan = t => {
    let html = '';
    for (let a = 0; a < pj; ) {
      const b = a === 0 ? (pj % 3 || 3) : a + 3;
      let g = '';
      for (let i = a; i < b; ) {
        const sama = i < p;
        let j = i;
        while (j < b && (j < p) === sama) j++;
        g += `<span class="${sama ? 'sama' : 'beda'}">${t.slice(i, j)}</span>`;
        i = j;
      }
      html += `<span class="grup">${g}</span>`;
      a = b;
    }
    return html;
  };
  wadah.innerHTML = teks.map((t, i) => `<div class="dinding-baris"><span class="dinding-label">m<sub>${i + 1}</sub></span>` +
    `<span class="dinding-angka">${kelompokkan(t)}</span>` +
    `<span class="dinding-selisih">+${angkaId(Number(m[i] - m[0]), 0)}</span></div>`).join('');
  $('dinding-ket').innerHTML = `Lima modulus untuk rahasia 256 bit, sama persis dengan yang dipakai program C. Setiap modulus ` +
    `${pj} digit, dan ${p} digit pertamanya sama. Karena itu m<sub>b</sub> ≡ m<sub>b</sub> − m<sub>j</sub> (mod m<sub>j</sub>), ` +
    `dengan selisih yang di sini paling besar ${angkaId(Number(m[n - 1] - m[0]), 0)}.`;
  // di layar sempit, tampilkan ujung kanan (ekor yang berbeda), bukan awalan yang sama
  const keKanan = () => { wadah.scrollLeft = wadah.scrollWidth; };
  requestAnimationFrame(keKanan);
  window.addEventListener('resize', keKanan);
  const isi = (id, v) => { if ($(id)) $(id).textContent = v; };
  isi('cerita-digit', pj);
  isi('cerita-sama', p);
  isi('cerita-selisih', angkaId(Number(m[n - 1] - m[0]), 0));
}

// Kalimat hasil mengikuti data: percepatan terhadap Asmuth-Bloom klasik, lalu hasil apa adanya
// terhadap Shamir yang dioptimasi setara (bila datanya sudah ada).
function renderKalimatHasil(st) {
  const rk = [];
  for (const L of st.Ls) for (const [k, n] of st.konf) {
    const r = rasioBerpasangan(st, 'ab_classic', 'ab_diff', L, k, n);
    if (r) rk.push(r.med);
  }
  if (!rk.length) return;
  let teks = `Pada laptop uji, usulan B <span class="angka">${angkaId(Math.min(...rk), 1)}–${angkaId(Math.max(...rk), 1)}</span> ` +
    'kali lebih cepat daripada rekonstruksi <span class="utuh">Asmuth–Bloom</span> klasik.';
  if (st.metode.includes('shamir_small') || st.metode.includes('shamir_exact')) {
    const c = { ab: 0, setara: 0, shamir: 0 };
    for (const L of st.Ls) for (const [k, n] of st.konf) { const v = abLawanShamir(st, L, k, n); if (v) c[v.putusan]++; }
    const bagian = [];
    if (c.shamir) bagian.push(`Shamir lebih cepat pada ${c.shamir} konfigurasi`);
    if (c.ab) bagian.push(`<span class="utuh">Asmuth–Bloom</span> lebih cepat pada ${c.ab} konfigurasi`);
    if (c.setara) bagian.push(`keduanya setara pada ${c.setara} konfigurasi`);
    const gabung = bagian.length > 1 ? bagian.slice(0, -1).join(', ') + ', dan ' + bagian[bagian.length - 1] : bagian[0];
    teks += ` Terhadap Shamir yang dioptimasi setara, ${gabung}` +
      (c.ab ? '.' : '; <span class="utuh">Asmuth–Bloom</span> tidak lebih cepat pada konfigurasi mana pun.');
  } else {
    teks += ' Perbandingan dengan Shamir yang dioptimasi setara menunggu hasil benchmark terbaru.';
  }
  $('kalimat-hasil').innerHTML = teks;
  $('kalimat-hasil').hidden = false;
}

function terapkanIdentitas() {
  const I = typeof IDENTITAS === 'undefined' ? {} : IDENTITAS;
  const bersih = s => String(s || '').trim();
  const kelompok = bersih(I.kelompok), univ = bersih(I.universitas), prodi = bersih(I.prodi), dosen = bersih(I.dosen);
  const mk = bersih(I.mataKuliah) || 'Matematika Diskrit 2';
  const tahun = bersih(I.tahun);
  const anggota = (I.anggota || []).map(bersih).filter(Boolean);
  $('id-matkul').textContent = `Team Based Project ${mk}`;
  const kanan = [kelompok, univ].filter(Boolean).join(', ');
  $('id-kelompok').textContent = kanan;
  $('id-kelompok').hidden = !kanan;
  $('id-kaki').textContent = [kelompok, mk, univ, tahun].filter(Boolean).join(', ') +
    '. Alat demonstrasi, tidak untuk mengamankan kunci sungguhan.';
  const el = $('id-penyusun');
  el.hidden = !anggota.length;
  if (!anggota.length) return;
  const daftar = anggota.length > 1 ? `${anggota.slice(0, -1).join(', ')}, dan ${anggota[anggota.length - 1]}` : anggota[0];
  el.textContent = `Disusun oleh ${daftar}` + (prodi ? `, Program Studi ${prodi}` : '') + (univ ? `, ${univ}` : '') +
    (tahun ? `, ${tahun}` : '') + '.' + (dosen ? ` Dosen pengampu: ${dosen}.` : '');
}


// ===================== demo =====================

const demo = {
  contoh: true, ab: null, tabel: null, sp: null, info: null,
  S: null, bagian: null, shamir: null,
  hadir: new Set(), rusak: new Set(), sibuk: false,
};

function aturInputDemo() {
  const contoh = sumberDemo() === 'contoh';
  for (const id of ['demo-L', 'demo-k', 'demo-n', 'demo-bangkit']) $(id).disabled = contoh;
  $('demo-A-tetap').disabled = !contoh;
  $('demo-A-tetap').checked = contoh;
  $('demo-A-tetap').closest('label').hidden = !contoh;   // A = 321 hanya berlaku untuk contoh makalah
  if (contoh) $('demo-S').value = '11';
}

async function demoSiapkan() {
  if (demo.sibuk) return;
  demo.sibuk = true;
  try {
    if (sumberDemo() === 'contoh') {
      demo.contoh = true;
      demo.ab = abContohMakalah();
      demo.sp = buatShamir(4, 3, 4, 17n);
      demo.info = { sumber: 'contoh hitungan manual Bab 3.8', margin: null };
    } else {
      const L = Number($('demo-L').value);
      const k = Number($('demo-k').value), n = Number($('demo-n').value);
      if (!(Number.isInteger(k) && Number.isInteger(n) && k >= 2 && k <= 10 && n >= k && n <= 20)) {
        setStatus('demo-status-param', 'Pilih 2 ≤ k ≤ 10 dan k ≤ n ≤ 20.', 'salah');
        return;
      }
      setStatus('demo-status-param', 'Menyiapkan modulus...');
      await jeda();
      const hasil = await bangkitkanAB(L, k, n, (i, total) =>
        setStatus('demo-status-param', `Mencari bilangan prima ${L + 1} bit: ${i} dari ${total}`));
      demo.contoh = false;
      demo.ab = hasil.ab;
      demo.info = { sumber: hasil.sumber, margin: hasil.margin };
      demo.sp = await bangkitkanShamir(L, k, n);
      $('demo-S').value = fmtInput(acakBit(gen32Aman, L));
    }
    setStatus('demo-status-param', 'Membangun tabel invers...');
    await jeda();
    const t0 = performance.now();
    demo.tabel = bangunTabel(demo.ab.m);
    demo.info.msTabel = performance.now() - t0;
    setStatus('demo-status-param', '');
    renderParameter();
    demoBagi();
  } catch (e) {
    setStatus('demo-status-param', 'Gagal: ' + e.message, 'salah');
  } finally {
    demo.sibuk = false;
  }
}

function renderParameter() {
  const { ab, info } = demo;
  const s = syaratAB(ab.m0, ab.m, ab.k);
  let h = `<p class="rumus">L = ${ab.L} bit, m<sub>0</sub> = 2<sup>${ab.L}</sup> = <span class="angka">${esc(fmt(ab.m0))}</span>,
    k = ${ab.k}, n = ${ab.n}</p>`;
  h += `<p class="catatan">Sumber modulus: ${esc(info.sumber)}`;
  if (info.margin !== null) h += `, bilangan prima berurutan setelah 2<sup>${ab.L}</sup> + 2<sup>${info.margin}</sup>`;
  h += '.</p>';
  h += '<div class="gulir"><table class="tabel"><thead><tr><th>Peserta i</th><th>Modulus m<sub>i</sub></th>' +
       '<th class="kanan">Bit</th><th class="kanan">Selisih m<sub>i</sub> − m<sub>1</sub></th></tr></thead><tbody>';
  ab.m.forEach((mi, i) => {
    h += `<tr><td>${i + 1}</td><td class="angka">${esc(fmt(mi))}</td><td class="kanan">${bitLen(mi)}</td>
      <td class="kanan angka">${esc(fmt(ab.off[i]))}</td></tr>`;
  });
  h += '</tbody></table></div>';
  const kiriSuku = ab.k === 2 ? `m<sub>${ab.n}</sub>` : `m<sub>${ab.n - ab.k + 2}</sub> ⋯ m<sub>${ab.n}</sub>`;
  h += `<div class="kotak ${s.ok ? 'ok' : 'salah'}">
    <p>Syarat Asmuth–Bloom: m<sub>0</sub> · ${kiriSuku} &lt; m<sub>1</sub> ⋯ m<sub>${ab.k}</sub></p>
    <p class="angka">kiri&nbsp; = ${esc(fmt(s.kiri))}<br>kanan = ${esc(fmt(s.kanan))}</p>
    <p>${s.ok ? 'Terpenuhi' : 'Tidak terpenuhi'}; kanan − kiri = <span class="angka">${esc(fmt(s.kanan - s.kiri))}</span>.
      Syarat ini menjaga kerahasiaan. Kebenaran rekonstruksi cukup membutuhkan y &lt; M<sub>k</sub> dan modulus yang saling prima.</p>
  </div>`;
  $('demo-param').innerHTML = h;
  $('demo-tabel-info').textContent = `${ab.n * (ab.n - 1) / 2} entri, dibangun dalam ${angkaId(info.msTabel, 1)} ms. ` +
    'Inversinya murah karena modulus berdekatan: m_j − m_i kecil, sehingga algoritme Euclid selesai dalam beberapa langkah.';
}

function renderTabelInvers(dipakai) {
  const { ab, tabel } = demo;
  const n = ab.n;
  let h = '<table class="tabel matriks"><thead><tr><th>i \\ j</th>';
  for (let j = 1; j < n; j++) h += `<th>${j + 1}</th>`;
  h += '</tr></thead><tbody>';
  for (let i = 0; i < n - 1; i++) {
    h += `<tr><th>${i + 1}</th>`;
    for (let j = 1; j < n; j++) {
      if (j <= i) { h += '<td class="kosong"></td>'; continue; }
      const c = tabel[i * n + j];
      const kelas = dipakai.has(`${i}-${j}`) ? ' class="dipakai"' : '';
      h += `<td${kelas} title="c${indeks(i + 1, j + 1)} = ${c}">${esc(fmtPendek(c))}</td>`;
    }
    h += '</tr>';
  }
  $('demo-tabel').innerHTML = h + '</tbody></table>';
}

function demoBagi() {
  if (!demo.ab) return;
  const teks = $('demo-S').value.trim();
  let S;
  try {
    if (!teks) throw new Error('kosong');
    S = BigInt(teks);
  } catch (e) {
    setStatus('demo-status-share', 'Rahasia harus bilangan bulat, desimal atau heksadesimal berawalan 0x.', 'salah');
    return;
  }
  if (S < 0n || S >= demo.ab.m0) {
    setStatus('demo-status-share', `Rahasia harus di antara 0 dan 2^${demo.ab.L} − 1.`, 'salah');
    return;
  }
  setStatus('demo-status-share', '');
  demo.S = S;
  const pakaiA = demo.contoh && $('demo-A-tetap').checked;
  demo.bagian = bagiAB(demo.ab, S, gen32Aman, pakaiA ? 321n : undefined);
  // pada contoh makalah dengan S = 11, polinom Shamir dibuat sama dengan bin/demo: f(x) = 11 + 5x + 3x^2
  const koef = (demo.contoh && S === 11n) ? [5n, 3n] : null;
  demo.shamir = bagiShamir(demo.sp, S, gen32Aman, koef);
  demo.rusak.clear();
  demo.hadir = new Set(demo.contoh ? [0, 1, 3] : [...Array(demo.ab.k).keys()]);
  renderShare();
  demoRekonstruksi();
}

function shareDipakai(i) {
  const s = demo.bagian.share[i];
  return demo.rusak.has(i) ? (s + 1n) % demo.ab.m[i] : s;
}

function shareShamirDipakai(i) {
  const s = demo.shamir.share[i];
  return demo.rusak.has(i) ? (s + 1n) % demo.sp.p : s;
}

function kartuHtml(i) {
  return `<div class="kartu" data-i="${i}">
    <button type="button" class="share-pilih" data-i="${i}">
      <span class="kartu-dalam">
        <span class="kartu-muka kartu-belakang" aria-hidden="true">
          <span class="kartu-bingkai"></span><span class="kartu-lambang">${i + 1}</span>
          <span class="kartu-kaki">Peserta ${i + 1}</span>
        </span>
        <span class="kartu-muka kartu-depan">
          <span class="share-judul">Peserta ${i + 1}</span>
          <span class="kartu-share"><span class="kartu-ket">share</span><span class="angka"></span></span>
          <span class="kartu-mod"><span class="kartu-ket">modulus</span><span class="angka">${esc(fmtPendek(demo.ab.m[i]))}</span></span>
          <span class="kartu-selisih">selisih <span class="angka">+${esc(fmtPendek(demo.ab.off[i]))}</span></span>
        </span>
      </span>
    </button>
    <button type="button" class="share-rusak" data-i="${i}">rusak</button>
  </div>`;
}

function renderShare() {
  const { ab, bagian } = demo;
  $('demo-y').innerHTML = `<dl class="nilai-besar">
      <div><dt>A ${demo.contoh && $('demo-A-tetap').checked ? '(seperti di makalah)' : '(dipilih acak)'}</dt>
        <dd class="angka">${esc(fmt(bagian.A))}</dd></div>
      <div><dt>y = S + A·m<sub>0</sub></dt><dd class="angka">${esc(fmt(bagian.y))}</dd></div>
    </dl>
    <p class="catatan">y selalu kurang dari M<sub>k</sub> = m<sub>1</sub> ⋯ m<sub>${ab.k}</sub>, sehingga k share sudah cukup
      untuk menemukannya kembali.</p>`;
  const meja = $('demo-share');
  const kunci = `${ab.n}|${ab.m[0]}|${bagian.y}`;
  if (meja.dataset.kunci !== kunci) {
    meja.dataset.kunci = kunci;
    meja.innerHTML = Array.from({ length: ab.n }, (_, i) => kartuHtml(i)).join('');
  }
  for (let i = 0; i < ab.n; i++) {
    const hadir = demo.hadir.has(i), rusak = demo.rusak.has(i);
    const k = meja.querySelector(`.kartu[data-i="${i}"]`);
    k.classList.toggle('terbuka', hadir);
    k.classList.toggle('rusak', rusak);
    const pilih = k.querySelector('.share-pilih');
    pilih.setAttribute('aria-pressed', String(hadir));
    pilih.setAttribute('aria-label', `Peserta ${i + 1}, ${hadir ? 'hadir' : 'tidak hadir'}`);
    const nilai = k.querySelector('.kartu-share .angka');
    nilai.textContent = fmtPendek(shareDipakai(i));
    nilai.classList.toggle('panjang', nilai.textContent.length > 6);
    const tr = k.querySelector('.share-rusak');
    tr.setAttribute('aria-pressed', String(rusak));
    tr.textContent = rusak ? 'rusak (+1)' : 'rusak';
  }
}

function demoRekonstruksi() {
  const { ab, tabel, sp } = demo;
  const idx = [...demo.hadir].sort((a, b) => a - b);
  if (!idx.length) {
    $('demo-hadir').textContent = 'Belum ada peserta yang dipilih. Klik kartu peserta di atas.';
    for (const id of ['demo-ringkasan', 'demo-pemutar', 'demo-banding', 'demo-langkah-selisih', 'demo-langkah-garner', 'demo-langkah-klasik', 'demo-shamir'])
      $(id).innerHTML = '';
    renderTabelInvers(new Set());
    return;
  }
  $('demo-hadir').textContent = `Peserta hadir: ${idx.map(i => i + 1).join(', ')} (${idx.length} share, ambang k = ${ab.k}).`;
  const shAB = idx.map(i => shareDipakai(i));
  const shSh = idx.map(i => shareShamirDipakai(i));
  const daftar = [
    ['ab_diff', log => rekonstruksiSelisih(ab, idx, shAB, log)],
    ['ab_table', log => rekonstruksiTabel(ab, tabel, idx, shAB, log)],
    ['ab_garner_inv', log => rekonstruksiGarnerInv(ab, idx, shAB, log)],
    ['ab_classic', log => rekonstruksiKlasik(ab, idx, shAB, log)],
    ['shamir_naive', log => rekonstruksiShamirBiasa(sp, idx, shSh, log)],
    ['shamir_batch', log => rekonstruksiShamirBatch(sp, idx, shSh, log)],
    ['shamir_small', log => rekonstruksiShamirKecil(sp, idx, shSh, log)],
  ];
  const hasil = daftar.map(([nama, fn]) => {
    const log = logBaru();
    return { nama, S: fn(log), log };
  });
  renderRingkasanDemo(idx, hasil[0]);
  renderBandingDemo(hasil);
  renderLangkahSelisih(hasil[0]);
  renderPemutar(idx, hasil[0]);
  renderLangkahGarner(hasil[1]);
  renderLangkahKlasik(idx, hasil[3]);
  renderShamirDemo();
  const dipakai = new Set();
  for (let j = 1; j < idx.length; j++)
    for (let a = 0; a < j; a++) dipakai.add(`${idx[a]}-${idx[j]}`);
  renderTabelInvers(dipakai);
}

function renderRingkasanDemo(idx, h) {
  const ab = demo.ab;
  const ok = h.S === demo.S;
  const adaRusak = idx.some(i => demo.rusak.has(i));
  let html = `<p class="hasil-utama">Rahasia hasil usulan B: <span class="angka">${esc(fmt(h.S))}</span> ${lencana(ok)}
    <span class="redup">(rahasia asli ${esc(fmt(demo.S))})</span></p>`;
  const catatan = [];
  if (idx.length < ab.k)
    catatan.push(['info', `Hanya ${idx.length} dari ${ab.k} share. Hasil yang salah memang diharapkan, karena k − 1 share tidak cukup untuk menentukan y.`]);
  if (adaRusak)
    catatan.push(['salah', 'Ada share yang dirusak. Hasilnya salah dan tidak ada peringatan apa pun, karena skema ini tidak memverifikasi share (batasan pada Bab 1.5 makalah).']);
  if (idx.length > ab.k && !adaRusak)
    catatan.push(['info', `${idx.length} share dipakai, lebih dari k = ${ab.k}. CRT dengan modulus tambahan tetap menghasilkan y yang sama.`]);
  if (ok && idx.length >= ab.k && !adaRusak)
    catatan.push(['ok', `Usulan B memakai ${h.log.mulModular} perkalian modular lebar penuh dan ${h.log.inv} inversi atas hasil kali selisih, yang tetap kecil selama k · log<sub>2</sub>(selisih) jauh di bawah L ` +
      `(${h.log.iterasi} iterasi Euclid); selebihnya hanya perkalian dengan selisih modulus yang kecil.`]);
  for (const [jenis, t] of catatan) html += `<div class="kotak ${jenis}"><p>${t}</p></div>`;
  $('demo-ringkasan').innerHTML = html;
}

function renderBandingDemo(hasil) {
  let h = '<thead><tr><th>Metode</th><th>Hasil S</th><th>Status</th><th class="kanan">Inversi</th>' +
    '<th class="kanan">Iterasi Euclid</th><th class="kanan">Perkalian modular</th><th class="kanan">Perkalian kecil</th>' +
    '<th class="kanan">Operasi bilangan besar</th><th class="kanan">Bit terbesar</th></tr></thead><tbody>';
  for (const r of hasil) {
    h += `<tr${r.nama === 'ab_diff' ? ' class="usulan"' : ''}><td>${LABEL[r.nama]}</td>
      <td class="angka">${esc(fmt(r.S))}</td><td>${lencana(r.S === demo.S)}</td>
      <td class="kanan">${r.log.inv}</td><td class="kanan">${r.log.iterasi}</td><td class="kanan">${r.log.mulModular}</td>
      <td class="kanan">${r.log.mulKecil}</td><td class="kanan">${r.log.opBesar}</td><td class="kanan">${r.log.bitMaks}</td></tr>`;
  }
  $('demo-banding').innerHTML = h + '</tbody>';
}

function renderLangkahSelisih(h) {
  const ab = demo.ab, log = h.log;
  let html = '<div class="gulir"><table class="tabel langkah"><thead><tr><th>j</th><th>Peserta</th><th>m</th>' +
    '<th>Selisih m<sub>b</sub> − m<sub>j</sub></th><th>s = x mod m (Horner dengan selisih)</th>' +
    '<th>D = hasil kali selisih</th><th>D<sup>−1</sup> mod m</th><th>v<sub>j</sub></th></tr></thead><tbody>';
  log.langkahB.forEach((l, j) => {
    if (j === 0) {
      html += `<tr><td>1</td><td>${l.peserta + 1}</td><td class="angka">${esc(fmt(l.m))}</td><td>–</td><td>–</td>
        <td>–</td><td>–</td><td class="angka">${esc(fmt(l.v))}</td></tr>`;
      return;
    }
    html += `<tr><td>${j + 1}</td><td>${l.peserta + 1}</td><td class="angka">${esc(fmt(l.m))}</td>
      <td class="angka">${l.selisih.map(d => esc(fmt(d))).join(', ')}</td><td class="angka">${esc(fmt(l.s))}</td>
      <td class="angka">${esc(fmt(l.D))}</td><td class="angka">${esc(fmt(l.inv))}</td><td class="angka">${esc(fmt(l.v))}</td></tr>`;
  });
  html += '</tbody></table></div>';
  html += `<p class="catatan">Tiap baris hanya mengalikan dengan selisih modulus yang kecil, lalu memakai satu inversi
    bilangan kecil dan satu perkalian modular. Bagian akhir langsung menghitung y mod 2<sup>${ab.L}</sup>; karena
    m mod 2<sup>${ab.L}</sup> = 2<sup>h</sup> + e, perkaliannya cukup geser bit ditambah perkalian dengan bilangan kecil.</p>`;
  const L = log.langkahB;
  let horner = `S = v<sub>${L.length}</sub> = ${esc(fmt(L[L.length - 1].v))}`;
  for (const s of log.hornerB)
    horner += `<br>S = (${esc(fmt(s.lama))} · ${esc(fmt(s.mb))} + ${esc(fmt(s.v))}) mod 2<sup>${ab.L}</sup> = ${esc(fmt(s.S))}`;
  html += `<p class="rumus angka">${horner}</p>`;
  html += `<p class="rumus">Rahasia S = <span class="angka">${esc(fmt(h.S))}</span></p>`;
  $('demo-langkah-selisih').innerHTML = html;
}

function renderLangkahGarner(h) {
  const ab = demo.ab, log = h.log;
  let html = '<div class="gulir"><table class="tabel langkah"><thead><tr><th>j</th><th>Peserta</th><th>m</th><th>r</th>' +
    '<th>Perhitungan</th><th>v<sub>j</sub></th></tr></thead><tbody>';
  log.langkah.forEach((l, j) => {
    let hitung;
    if (j === 0) {
      hitung = '<span class="baris-langkah">v<sub>1</sub> = r mod m</span>';
    } else {
      hitung = l.sub.map(s => {
        const c = `c<sub>${indeks(s.ia + 1, l.peserta + 1)}</sub>`;
        return `<span class="baris-langkah">t = ((${esc(fmt(s.tLama))} − ${esc(fmt(s.va))}) · ${c}) mod m = ${esc(fmt(s.t))}
          <span class="redup">[${c} = ${esc(fmt(s.c))}]</span></span>`;
      }).join('');
    }
    html += `<tr><td>${j + 1}</td><td>${l.peserta + 1}</td><td class="angka">${esc(fmt(l.m))}</td>
      <td class="angka">${esc(fmt(l.r))}</td><td class="angka">${hitung}</td><td class="angka">${esc(fmt(l.v))}</td></tr>`;
  });
  html += '</tbody></table></div>';

  // digit mixed radix, dari yang paling berbobot
  const L = log.langkah;
  html += '<p class="catatan">Hasilnya adalah y dalam representasi mixed radix: setiap digit v<sub>j</sub> lebih kecil dari ' +
    'modulus peserta ke-j yang hadir, dan bobotnya adalah hasil kali modulus peserta sebelumnya.</p><div class="mixed-radix">';
  for (let j = L.length - 1; j >= 0; j--) {
    const bobot = j === 0 ? '× 1' : '× ' + L.slice(0, j).map(l => `m<sub>${l.peserta + 1}</sub>`).join('·');
    html += `<div class="digit"><span class="isi">${esc(fmt(L[j].v))}</span><span class="bobot">v<sub>${j + 1}</sub> ${bobot}</span></div>`;
  }
  html += '</div>';

  let horner = `y = v<sub>${L.length}</sub> = ${esc(fmt(L[L.length - 1].v))}`;
  for (const s of log.horner) horner += `<br>y = ${esc(fmt(s.xLama))} · ${esc(fmt(s.m))} + ${esc(fmt(s.v))} = ${esc(fmt(s.x))}`;
  html += `<p class="rumus angka">${horner}</p>`;
  html += `<p class="rumus">S = y mod 2<sup>${ab.L}</sup>, yaitu ${ab.L} bit terendah dari y = <span class="angka">${esc(fmt(h.S))}</span></p>`;
  $('demo-langkah-garner').innerHTML = html;
}

function renderLangkahKlasik(idx, h) {
  const ab = demo.ab, log = h.log;
  let html = `<p class="rumus angka">M = ${idx.map(i => `m<sub>${i + 1}</sub>`).join(' · ')} = ${esc(fmt(log.M))}</p>`;
  html += '<div class="gulir"><table class="tabel langkah"><thead><tr><th>Peserta</th><th>m<sub>j</sub></th>' +
    '<th>M<sub>j</sub> = M / m<sub>j</sub></th><th>M<sub>j</sub> mod m<sub>j</sub></th><th>y<sub>j</sub> (invers)</th>' +
    '<th class="kanan">Iterasi Euclid</th><th>r<sub>j</sub> · M<sub>j</sub> · y<sub>j</sub></th></tr></thead><tbody>';
  log.langkah.forEach((l, j) => {
    html += `<tr><td>${idx[j] + 1}</td><td class="angka">${esc(fmt(l.m))}</td><td class="angka">${esc(fmt(l.Mj))}</td>
      <td class="angka">${esc(fmt(l.t))}</td><td class="angka">${esc(fmt(l.y))}</td><td class="kanan">${l.iterasi}</td>
      <td class="angka">${esc(fmt(l.suku))}</td></tr>`;
  });
  html += '</tbody></table></div>';
  html += `<p class="rumus angka">jumlah = ${esc(fmt(log.jumlah))}<br>y = jumlah mod M = ${esc(fmt(log.y))}<br>
    S = y mod 2<sup>${ab.L}</sup> = ${esc(fmt(h.S))}</p>`;
  html += `<p class="catatan">Rumus ini membutuhkan ${log.inv} inversi (${log.iterasi} iterasi Euclid) dan bilangan antara
    sampai ${log.bitMaks} bit.</p>`;
  $('demo-langkah-klasik').innerHTML = html;
}

function renderShamirDemo() {
  const { sp, shamir } = demo;
  const suku = shamir.koef.map((a, j) => j === 0 ? esc(fmt(a)) : `${esc(fmt(a))}·x${j > 1 ? `<sup>${j}</sup>` : ''}`);
  let html = `<p class="rumus">p = <span class="angka">${esc(fmt(sp.p))}</span>, bilangan prima pertama setelah 2<sup>${sp.L}</sup><br>
    f(x) = <span class="angka">${suku.join(' + ')}</span> (mod p), rahasianya f(0)</p>`;
  html += '<div class="gulir"><table class="tabel"><thead><tr><th>Peserta</th><th>x</th><th>f(x)</th><th>Keterangan</th></tr></thead><tbody>';
  shamir.share.forEach((f, i) => {
    const ket = [demo.hadir.has(i) ? 'hadir' : '', demo.rusak.has(i) ? 'rusak (+1)' : ''].filter(Boolean).join(', ');
    html += `<tr><td>${i + 1}</td><td>${i + 1}</td><td class="angka">${esc(fmt(shareShamirDipakai(i)))}</td><td>${ket}</td></tr>`;
  });
  html += '</tbody></table></div>';
  html += '<p class="catatan">Penyebut koefisien Lagrange adalah hasil kali selisih koordinat (x<sub>l</sub> − x<sub>j</sub>) dengan ' +
    'x ≤ n, jadi bilangannya kecil. Karena itu inversi pada Shamir biasa selesai dalam sedikit iterasi Euclid, seperti ' +
    'terlihat di tabel perbandingan.</p>';
  $('demo-shamir').innerHTML = html;
}

// ===================== uji =====================

function renderCocok(baris) {
  let h = '<thead><tr><th>Pemeriksaan</th><th>Program C</th><th>Browser</th><th>Status</th></tr></thead><tbody>';
  for (const b of baris)
    h += `<tr><td>${esc(b.nama)}</td><td class="angka">${esc(b.harapan)}</td><td class="angka">${esc(b.hasil)}</td><td>${lencana(b.sama)}</td></tr>`;
  $('uji-cocok-tabel').innerHTML = h + '</tbody>';
}

async function ujiCocok() {
  const tombol = $('uji-cocok');
  tombol.disabled = true;
  try {
    const baris = cekContohMakalah();
    renderCocok(baris);
    const Ls = [256, 1024];
    if ($('uji-cocok-2048').checked) Ls.push(2048);
    for (const L of Ls) {
      setStatus('uji-cocok-status', `Mencari ulang 5 modulus pertama untuk L = ${L} di browser...`);
      await jeda();
      baris.push(...await cekModulus(L, 5));
      renderCocok(baris);
    }
    const sama = baris.filter(b => b.sama).length;
    setStatus('uji-cocok-status', `${sama} dari ${baris.length} pemeriksaan sama dengan program C.`,
              sama === baris.length ? 'ok' : 'salah');
  } catch (e) {
    setStatus('uji-cocok-status', 'Gagal: ' + e.message, 'salah');
  } finally {
    tombol.disabled = false;
  }
}

async function ujiAcak() {
  const tombol = $('uji-mulai');
  tombol.disabled = true;
  $('uji-log').textContent = '';
  const seed = Number($('uji-seed').value) || 12345;
  const t0 = performance.now();
  try {
    const hasil = await ujiKebenaran(seed, {
      log: t => { $('uji-log').textContent += t + '\n'; },
      progres: t => setStatus('uji-status', 'Menguji ' + t),
    });
    const detik = (performance.now() - t0) / 1000;
    $('uji-log').textContent += `\nTotal pemeriksaan: ${hasil.total}, gagal: ${hasil.gagal}\n`;
    setStatus('uji-status', `Selesai dalam ${angkaId(detik, 1)} detik. Total pemeriksaan: ` +
      `${hasil.total.toLocaleString('id-ID')}, gagal: ${hasil.gagal}.`, hasil.gagal ? 'salah' : 'ok');
  } catch (e) {
    setStatus('uji-status', 'Gagal: ' + e.message, 'salah');
  } finally {
    tombol.disabled = false;
  }
}

function hitungSebaranUI() {
  const S = Number($('seb-S').value);
  if (!Number.isInteger(S) || S < 0 || S > 255) {
    setStatus('seb-status', 'Rahasia harus bilangan bulat 0 sampai 255.', 'salah');
    return;
  }
  const pilihan = [...document.querySelectorAll('input[name="seb-peserta"]:checked')].map(c => Number(c.value));
  if (pilihan.length !== 2) {
    setStatus('seb-status', 'Pilih tepat dua peserta.', 'salah');
    return;
  }
  const r = hitungSebaran(BigInt(S), pilihan, gen32Aman);
  setStatus('seb-status', `Peserta ${pilihan.map(i => i + 1).join(' dan ')}: ${r.kandidat} kandidat y. ` +
    `${r.mungkin} dari 256 nilai rahasia masih mungkin; tiap nilai muncul ${r.min} sampai ${r.max} kali ` +
    `(${r.dua} nilai muncul dua kali).`, r.mungkin === 256 ? 'ok' : 'salah');
  grafikBatang($('seb-grafik'), r.hitung);
}

// ===================== benchmark =====================

let bmBerhenti = false;
let barisBrowser = null;

function isiLingkungan() {
  const ua = navigator.userAgent;
  let browser = 'tidak dikenali';
  const daftar = [[/Edg\/([\d.]+)/, 'Microsoft Edge'], [/OPR\/([\d.]+)/, 'Opera'], [/Firefox\/([\d.]+)/, 'Mozilla Firefox'],
                  [/Chrome\/([\d.]+)/, 'Google Chrome'], [/Version\/([\d.]+).*Safari/, 'Safari']];
  for (const [pola, nama] of daftar) {
    const m = ua.match(pola);
    if (m) { browser = `${nama} ${m[1]}`; break; }
  }
  const isi = [
    ['Browser', browser],
    ['User agent', ua],
    ['Prosesor logis', navigator.hardwareConcurrency || 'tidak diketahui'],
    ['Resolusi timer', `sekitar ${angkaId(estimasiResolusiTimer(), 1)} µs`],
    ['Waktu', new Date().toLocaleString('id-ID')],
  ];
  $('bm-lingkungan').innerHTML = isi.map(([a, b]) => `<dt>${esc(a)}</dt><dd>${esc(b)}</dd>`).join('');
}

function menitDetik(detik) {
  const m = Math.floor(detik / 60), s = Math.round(detik % 60);
  return m ? `${m} menit ${s} detik` : `${s} detik`;
}

async function mulaiBenchmark() {
  const Ls = [...document.querySelectorAll('input[name="bm-L"]:checked')].map(c => Number(c.value));
  const konfigurasi = [...document.querySelectorAll('input[name="bm-kn"]:checked')].map(c => c.value.split(',').map(Number));
  const reps = Number($('bm-reps').value), warmup = Number($('bm-warmup').value);
  const blokMs = Number($('bm-blok').value), seed = Number($('bm-seed').value);
  if (!Ls.length || !konfigurasi.length) {
    setStatus('bm-status', 'Pilih minimal satu ukuran L dan satu konfigurasi (k, n).', 'salah');
    return;
  }
  if (!(Number.isInteger(reps) && reps >= 2 && Number.isInteger(warmup) && warmup >= 0 && blokMs >= 1 && Number.isFinite(seed))) {
    setStatus('bm-status', 'Periksa lagi isian pengulangan (minimal 2), pemanasan, blok, dan seed.', 'salah');
    return;
  }
  bmBerhenti = false;
  $('bm-mulai').disabled = true;
  $('bm-stop').disabled = false;
  $('bm-bar').style.width = '0';
  isiLingkungan();
  const t0 = performance.now();
  let terakhir = 0;
  try {
    const baris = await jalankanBenchmark({ Ls, konfigurasi, reps, warmup, blokMs, seed }, {
      berhenti: () => bmBerhenti,
      progres: (teks, fraksi) => {
        const sekarang = performance.now();
        if (sekarang - terakhir < 100 && fraksi < 1) return;
        terakhir = sekarang;
        $('bm-bar').style.width = (fraksi * 100).toFixed(1) + '%';
        setStatus('bm-status', `${teks}. Berjalan ${menitDetik((sekarang - t0) / 1000)}.`);
      },
    });
    const durasi = menitDetik((performance.now() - t0) / 1000);
    barisBrowser = baris;
    tampilkanHasilBrowser();
    if (bmBerhenti) {
      setStatus('bm-status', `Dihentikan setelah ${durasi}. Hasil di bawah hanya sebagian.`, 'salah');
    } else {
      $('bm-bar').style.width = '100%';
      setStatus('bm-status', `Selesai dalam ${durasi}.`, 'ok');
    }
  } catch (e) {
    setStatus('bm-status', 'Gagal: ' + e.message, 'salah');
  } finally {
    $('bm-mulai').disabled = false;
    $('bm-stop').disabled = true;
  }
}

function tampilkanHasilBrowser() {
  if (!barisBrowser || !barisBrowser.some(b => b.phase === 'reconstruct')) {
    $('bm-hasil').innerHTML = '<p class="kosong">Belum ada hasil yang lengkap.</p>';
    return;
  }
  renderRingkasan($('bm-hasil'), barisBrowser, null);
  $('bm-csv').value = barisKeCsv(barisBrowser);
  $('bm-unduh').disabled = false;
  $('bm-salin').disabled = false;
  renderPerbandingan();
}

// Tabel dan grafik ringkasan; dipakai untuk hasil browser maupun hasil program C
const KELAS_METODE = m => 'm-' + m.replace(/_/g, '-');
const PUTUSAN = { ab: 'Asmuth–Bloom lebih cepat', setara: 'setara', shamir: 'Shamir lebih cepat' };

function selRasio(r) {
  if (!r) return '<td class="kanan">–</td>';
  const kelas = r.lo > 1 ? 'menang' : r.hi < 1 ? 'kalah' : '';
  return `<td class="kanan ${kelas}">${angkaId(r.med, 2)} <span class="redup">[${angkaId(r.lo, 2)}–${angkaId(r.hi, 2)}]</span></td>`;
}

function renderRingkasan(wadah, baris, ukuran) {
  const st = statistik(baris);
  wadah.innerHTML = '';
  const metode = st.metode, pembanding = metode.filter(m => m !== 'ab_diff');
  const adaKeduanya = metode.some(m => METODE_AB.includes(m)) && metode.some(m => METODE_SH.includes(m));
  const mq = s => s ? `${fmtUs(s.med)} <span class="redup">[${fmtUs(s.q1)}–${fmtUs(s.q3)}]</span>` : '–';
  const ms = s => s ? angkaId(s.med / 1000, s.med >= 10000 ? 0 : 2) : '–';
  for (const L of st.Ls) {
    const konf = st.konf.filter(([k, n]) => metode.some(m => st.ambil(m, L, k, n)));
    if (!konf.length) continue;
    const blok = document.createElement('div');
    blok.className = 'blok-L';
    let h = `<h3>Rahasia ${L} bit</h3>`;
    h += '<div class="gulir"><table class="tabel"><caption>Waktu rekonstruksi dalam mikrodetik per operasi: median ' +
      '[kuartil 1–kuartil 3]</caption><thead><tr><th>(k, n)</th>' +
      metode.map(m => `<th class="kanan">${LABEL[m]}</th>`).join('') + '</tr></thead><tbody>';
    for (const [k, n] of konf)
      h += `<tr><td>(${k}, ${n})</td>` + metode.map(m => `<td class="kanan">${mq(st.ambil(m, L, k, n))}</td>`).join('') + '</tr>';
    h += '</tbody></table></div>';
    if (metode.includes('ab_diff')) {
      h += '<div class="gulir"><table class="tabel"><caption>Rasio waktu terhadap usulan B, berpasangan per pengulangan: ' +
        'median [interval kepercayaan 95%]. Lebih dari 1 berarti usulan B lebih cepat.</caption><thead><tr><th>(k, n)</th>' +
        pembanding.map(m => `<th class="kanan">${LABEL[m]}</th>`).join('') + '</tr></thead><tbody>';
      for (const [k, n] of konf)
        h += `<tr><td>(${k}, ${n})</td>` + pembanding.map(m => selRasio(rasioBerpasangan(st, m, 'ab_diff', L, k, n))).join('') + '</tr>';
      h += '</tbody></table></div>';
    }
    if (adaKeduanya) {
      h += '<div class="gulir"><table class="tabel"><caption>Asmuth–Bloom tercepat lawan Shamir tercepat. Rasio = waktu Shamir / ' +
        'waktu Asmuth–Bloom; satu pihak dinyatakan lebih cepat hanya bila seluruh interval kepercayaannya berada di sisi itu.' +
        '</caption><thead><tr><th>(k, n)</th><th>Asmuth–Bloom tercepat</th><th>Shamir tercepat</th><th class="kanan">Rasio</th>' +
        '<th>Kesimpulan</th></tr></thead><tbody>';
      for (const [k, n] of konf) {
        const v = abLawanShamir(st, L, k, n);
        if (v) h += `<tr><td>(${k}, ${n})</td><td>${LABEL[v.a]}</td><td>${LABEL[v.s]}</td>${selRasio(v)}<td>${PUTUSAN[v.putusan]}</td></tr>`;
      }
      h += '</tbody></table></div>';
    }
    blok.innerHTML = h;
    const wadahGrafik = document.createElement('div');
    blok.appendChild(wadahGrafik);
    grafikGaris(wadahGrafik, {
      labelX: 'k (ambang), dengan n = 2k',
      labelY: 'mikrodetik per rekonstruksi (median)',
      satuan: 'µs',
      seri: metode.map(m => ({
        nama: LABEL[m],
        kelas: KELAS_METODE(m),
        titik: konf.map(([k, n]) => {
          const s = st.ambil(m, L, k, n);
          return s ? { x: k, y: s.med, lo: s.q1, hi: s.q3 } : null;
        }).filter(Boolean),
      })),
    });
    if (konf.some(([k, n]) => st.ambil('ab_share', L, k, n))) {
      let h2 = '<div class="gulir"><table class="tabel"><caption>Pembuatan n share (mikrodetik, median [kuartil 1–kuartil 3]) ' +
        'dan setup sekali (milidetik)</caption><thead><tr><th>(k, n)</th><th class="kanan">Share Asmuth–Bloom</th>' +
        '<th class="kanan">Share Shamir</th><th class="kanan">Setup AB, prima + tabel</th><th class="kanan">Tabel invers saja</th>' +
        '<th class="kanan">Setup Shamir</th></tr></thead><tbody>';
      for (const [k, n] of konf)
        h2 += `<tr><td>(${k}, ${n})</td><td class="kanan">${mq(st.ambil('ab_share', L, k, n))}</td>
          <td class="kanan">${mq(st.ambil('shamir_share', L, k, n))}</td><td class="kanan">${ms(st.ambil('ab_setup_total', L, k, n))}</td>
          <td class="kanan">${ms(st.ambil('ab_setup_table', L, k, n))}</td><td class="kanan">${ms(st.ambil('shamir_setup', L, k, n))}</td></tr>`;
      const d = document.createElement('div');
      d.innerHTML = h2 + '</tbody></table></div>';
      blok.appendChild(d);
    }
    wadah.appendChild(blok);
  }
}

// ===================== hasil program C =====================

let dataC = null, dataUkuran = null, barisBrowserBerkas = null;

async function bacaBerkas(input, olah) {
  const f = input.files[0];
  if (!f) return;
  try {
    olah(await f.text());
    setStatus('hasil-status', `${f.name} terbaca.`, 'ok');
  } catch (e) {
    setStatus('hasil-status', `${f.name} tidak bisa dibaca: ${e.message}`, 'salah');
  }
}

function muatHasilBawaan() {
  if (typeof HASIL_C === 'undefined' || !HASIL_C.bench) return;
  dataC = bacaCsvBenchmark(HASIL_C.bench);
  if (HASIL_C.sizes) dataUkuran = bacaCsvUkuran(HASIL_C.sizes);
  if (HASIL_C.browser) barisBrowserBerkas = bacaCsvBenchmark(HASIL_C.browser);
  $('hasil-sumber').textContent = `Diukur di ${HASIL_C.mesin}, dengan GMP ${HASIL_C.gmp} dan gcc ${HASIL_C.gcc}; ` +
    `${HASIL_C.pengukuran}. Hasil lain dapat dimuat di bagian bawah halaman ini.`;
  renderHasilC();
  renderPerbandingan();
  renderKalimatHasil(statistik(dataC));
}

function renderHasilC() {
  if (dataC) { renderRingkasan($('hasil-c'), dataC, dataUkuran); pasangPilihL(); }
}

function renderPerbandingan() {
  const wadah = $('hasil-banding');
  const browser = barisBrowserBerkas || barisBrowser;
  if (!dataC || !browser) return;
  const sc = statistik(dataC), sb = statistik(browser);
  const pembanding = sc.metode.filter(m => m !== 'ab_diff' && sb.metode.includes(m));
  const Ls = sc.Ls.filter(L => sb.Ls.includes(L));
  if (!Ls.length) {
    wadah.innerHTML = '<p class="kosong">Tidak ada ukuran L yang sama pada kedua berkas.</p>';
    return;
  }
  let h = '<p class="catatan">Setiap sel adalah rasio waktu metode terhadap usulan B di lingkungan tersebut, berpasangan per ' +
    'pengulangan (median; interval kepercayaannya ada di keterangan sel). Lebih dari 1 berarti usulan B lebih cepat. ' +
    'Angka mutlak C dan browser tidak dibandingkan.</p>';
  for (const L of Ls) {
    h += `<h3>Rahasia ${L} bit</h3><div class="gulir"><table class="tabel"><thead><tr><th rowspan="2">(k, n)</th>` +
      pembanding.map(m => `<th colspan="2" class="kanan">${LABEL[m]}</th>`).join('') + '</tr><tr>' +
      pembanding.map(() => '<th class="kanan">C</th><th class="kanan">browser</th>').join('') + '</tr></thead><tbody>';
    const konf = sc.konf.filter(([k, n]) => sc.ambil('ab_diff', L, k, n) && sb.ambil('ab_diff', L, k, n));
    for (const [k, n] of konf) {
      h += `<tr><td>(${k}, ${n})</td>`;
      for (const m of pembanding) {
        for (const st of [sc, sb]) {
          const r = rasioBerpasangan(st, m, 'ab_diff', L, k, n);
          h += r ? `<td class="kanan ${r.lo > 1 ? 'menang' : r.hi < 1 ? 'kalah' : ''}" title="interval kepercayaan 95%: ` +
            `${angkaId(r.lo, 2)} sampai ${angkaId(r.hi, 2)}">${angkaId(r.med, 2)}</td>` : '<td class="kanan">–</td>';
        }
      }
      h += '</tr>';
    }
    h += '</tbody></table></div>';
  }
  wadah.innerHTML = h;
}

// ===================== adegan, presentasi, pembuka bergerak =====================

const DAFTAR_ADEGAN = ['awal', 'ide', 'demo', 'hasil', 'uji', 'benchmark', 'tentang'];

function aturAdegan() {
  const tautan = [...document.querySelectorAll('[data-adegan]')];
  const tandai = id => tautan.forEach(a => {
    const aktif = a.dataset.adegan === id;
    a.classList.toggle('aktif', aktif);
    if (aktif) a.setAttribute('aria-current', 'true');
    else a.removeAttribute('aria-current');
  });
  const pengamat = new IntersectionObserver(entri => {
    for (const e of entri) if (e.isIntersecting) tandai(e.target.id);
  }, { rootMargin: '-40% 0px -55% 0px' });
  for (const id of DAFTAR_ADEGAN) if ($(id)) pengamat.observe($(id));
  // navigasi menjadi padat setelah pembuka terlewati
  const nav = document.querySelector('.navigasi');
  new IntersectionObserver(([e]) => nav.classList.toggle('padat', !e.isIntersecting),
    { rootMargin: '-72px 0px 0px 0px' }).observe($('awal'));
}

function aturPresentasi() {
  const tombol = $('tombol-presentasi');
  let aktif = false;
  const atur = v => {
    aktif = v;
    tombol.setAttribute('aria-pressed', String(v));
    tombol.textContent = v ? 'Keluar presentasi' : 'Mode presentasi';
    document.body.classList.toggle('presentasi', v);
  };
  tombol.addEventListener('click', () => atur(!aktif));
  document.addEventListener('keydown', e => {
    if (!aktif || e.target.closest('input, select, textarea')) return;
    if (e.key === 'Escape') { atur(false); return; }
    const maju = ['ArrowRight', 'ArrowDown', 'PageDown', ' '].includes(e.key);
    const mundur = ['ArrowLeft', 'ArrowUp', 'PageUp'].includes(e.key);
    if (!maju && !mundur) return;
    e.preventDefault();
    const adegan = DAFTAR_ADEGAN.map(id => $(id)).filter(Boolean);
    const navH = document.querySelector('.navigasi').offsetHeight;
    let kini = 0;
    adegan.forEach((el, i) => { if (el.getBoundingClientRect().top - navH <= 4) kini = i; });
    const tujuan = adegan[Math.max(0, Math.min(adegan.length - 1, kini + (maju ? 1 : -1)))];
    const atas = tujuan.getBoundingClientRect().top + window.scrollY - (tujuan.id === 'awal' ? 0 : navH);
    window.scrollTo({ top: atas, behavior: kurangiGerak() ? 'auto' : 'smooth' });
  });
}

// Pembuka: contoh Bab 3.8 sebagai empat jam. Rahasia 11 dibungkus menjadi y = 11 + 321 · 16 = 5147, dan setiap
// peserta hanya memegang posisi jarum, yaitu y mod m. Klik jam untuk mengeluarkan atau menghadirkan peserta:
// tiga jarum cukup untuk menemukan y kembali, dua belum.
function crtKecil(r, m) {
  let y = 0, P = 1;
  for (let i = 0; i < m.length; i++) {
    let t = 0;
    while ((y + P * t) % m[i] !== r[i]) t++;
    y += P * t;
    P *= m[i];
  }
  return y;
}

function renderCincinCRT() {
  const svg = $('cincin');
  if (!svg) return;
  const NS = 'http://www.w3.org/2000/svg';
  const el = (tag, atr, teks) => {
    const e = document.createElementNS(NS, tag);
    for (const k in atr) e.setAttribute(k, atr[k]);
    if (teks !== undefined) e.textContent = teks;
    return e;
  };
  const M = [23, 29, 31, 37], Y = 5147, K = 3, MK = 23 * 29 * 31, R = 76;
  const sisa = M.map(m => Y % m);
  const pusat = [[105, 130], [295, 130], [105, 348], [295, 348]];
  const hadir = new Set([0, 1, 2, 3]);
  svg.innerHTML = '<defs><filter id="pendar" x="-60%" y="-60%" width="220%" height="220%">' +
    '<feGaussianBlur stdDeviation="2.6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>';
  const jam = M.map((m, i) => {
    const [cx, cy] = pusat[i];
    const g = el('g', { class: 'jam', tabindex: '0', role: 'button', 'data-i': i });
    g.appendChild(el('text', { x: cx, y: cy - R - 13, class: 'jam-peserta', 'text-anchor': 'middle' }, `Peserta ${i + 1}`));
    g.appendChild(el('circle', { cx, cy, r: R, class: 'jam-lingkar' }));
    for (let t = 0; t < m; t++) {
      const a = 2 * Math.PI * t / m - Math.PI / 2, r1 = t === 0 ? R - 13 : R - 6;
      g.appendChild(el('line', { x1: cx + r1 * Math.cos(a), y1: cy + r1 * Math.sin(a), x2: cx + R * Math.cos(a),
        y2: cy + R * Math.sin(a), class: t === 0 ? 'jam-nol' : 'jam-detik' }));
    }
    const jarum = el('g', { class: 'jam-jarum', filter: 'url(#pendar)' });
    jarum.appendChild(el('line', { x1: cx, y1: cy - 26, x2: cx, y2: cy - (R - 16) }));
    jarum.appendChild(el('circle', { cx, cy: cy - (R - 16), r: 4 }));
    g.appendChild(jarum);
    const angka = el('text', { x: cx, y: cy + 8, class: 'jam-angka', 'text-anchor': 'middle' }, '0');
    g.appendChild(angka);
    g.appendChild(el('text', { x: cx, y: cy + R + 21, class: 'jam-label', 'text-anchor': 'middle' }, `mod ${m}`));
    svg.appendChild(g);
    return { g, m, cx, cy, jarum, angka };
  });
  const status = $('cincin-hitung');
  const putar = (i, sudut) => jam[i].jarum.setAttribute('transform', `rotate(${sudut} ${jam[i].cx} ${jam[i].cy})`);
  const tulis = () => {
    const idx = [...hadir].sort((a, b) => a - b);
    jam.forEach((j, i) => {
      j.g.classList.toggle('absen', !hadir.has(i));
      j.g.setAttribute('aria-pressed', String(hadir.has(i)));
      j.g.setAttribute('aria-label', `Peserta ${i + 1}, mod ${j.m}, ` + (hadir.has(i) ? `hadir, jarum di ${sisa[i]}` : 'tidak hadir'));
    });
    const daftar = idx.map(i => i + 1).join(', ');
    if (idx.length >= K) {
      const y = crtKecil(idx.map(i => sisa[i]), idx.map(i => M[i]));
      status.innerHTML = `Peserta ${daftar} hadir. Dari posisi jarum mereka saja, y = ${angkaId(y, 0)} bisa ditemukan ` +
        `kembali, dan rahasianya y mod 16 = <strong class="sorot">${y % 16}</strong>.`;
    } else if (idx.length === 2) {
      const P = M[idx[0]] * M[idx[1]];
      const x = crtKecil(idx.map(i => sisa[i]), idx.map(i => M[i]));
      const calon = [];
      for (let y = x; y < MK; y += P) calon.push(y);
      const rahasia = new Set(calon.map(y => y % 16)).size;
      status.innerHTML = `Hanya peserta ${daftar}. Masih ada ${calon.length} kemungkinan y, dan ${rahasia} dari 16 nilai ` +
        'rahasia masih mungkin. Kuncinya belum terbuka.';
    } else if (idx.length === 1) {
      status.innerHTML = `Hanya peserta ${daftar}. Satu jarum hampir tidak memberi petunjuk apa pun tentang rahasianya.`;
    } else {
      status.innerHTML = 'Tidak ada peserta. Klik jam untuk menghadirkan peserta.';
    }
  };
  const ganti = i => { if (hadir.has(i)) hadir.delete(i); else hadir.add(i); tulis(); };
  svg.addEventListener('click', e => { const g = e.target.closest('.jam'); if (g) ganti(Number(g.dataset.i)); });
  svg.addEventListener('keydown', e => {
    const g = e.target.closest('.jam');
    if (g && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); ganti(Number(g.dataset.i)); }
  });
  const selesai = () => {
    jam.forEach((j, i) => { putar(i, 360 * sisa[i] / j.m); j.angka.textContent = sisa[i]; });
    tulis();
  };
  let berjalan = false;
  const animasi = () => {
    if (berjalan) return;
    hadir.clear();
    M.forEach((_, i) => hadir.add(i));
    jam.forEach((j, i) => { j.g.classList.remove('absen'); putar(i, 0); j.angka.textContent = '0'; });
    status.innerHTML = 'Rahasia S = 11 dibungkus menjadi y = 11 + 321 × 16 = 5.147. Setiap peserta hanya menerima ' +
      'sisa bagi y terhadap modulusnya, yang ditunjukkan oleh jarum jamnya.';
    if (kurangiGerak()) { selesai(); return; }
    berjalan = true;
    const awal = performance.now() + 1100, lama = 1800, jeda = 170;
    const langkah = ts => {
      let semua = true;
      jam.forEach((j, i) => {
        const p = Math.max(0, Math.min(1, (ts - awal - i * jeda) / lama));
        if (p < 1) semua = false;
        const sudut = (360 + 360 * sisa[i] / j.m) * (1 - Math.pow(1 - p, 3));
        putar(i, sudut);
        j.angka.textContent = Math.min(j.m - 1, Math.floor((sudut % 360) / 360 * j.m + 1e-9));
      });
      if (semua) { berjalan = false; setTimeout(selesai, 500); }
      else requestAnimationFrame(langkah);
    };
    requestAnimationFrame(langkah);
  };
  $('cincin-ulang').addEventListener('click', animasi);
  animasi();
}

// Adegan ide: paragraf yang sedang dibaca menentukan keadaan dinding digit
function aturCerita() {
  const cerita = document.querySelector('.cerita');
  if (!cerita) return;
  const langkah = [...cerita.querySelectorAll('.cerita-langkah li')];
  if (kurangiGerak() || window.matchMedia('(max-width: 50rem)').matches) {
    cerita.dataset.tahap = '4';
    langkah.forEach(l => l.classList.add('aktif'));
    return;
  }
  // panggung menempel satu layar penuh; penjelasan langkah aktif tampil di atas digit
  cerita.classList.add('hidup');
  const ket = $('cerita-keterangan');
  const tampil = li => {
    const n = langkah.indexOf(li) + 1;
    if (cerita.dataset.tahap === li.dataset.tahap && ket.childNodes.length) return;
    langkah.forEach(l => l.classList.toggle('aktif', l === li));
    cerita.dataset.tahap = li.dataset.tahap;
    $('cerita-nomor').textContent = `Langkah ${n} dari ${langkah.length}`;
    $('cerita-lanjut').hidden = n === langkah.length;
    const salinan = li.querySelector('p').cloneNode(true);
    salinan.querySelectorAll('[id]').forEach(x => x.removeAttribute('id'));
    ket.replaceChildren(...salinan.childNodes);
    ket.classList.remove('muncul');
    void ket.offsetWidth;
    ket.classList.add('muncul');
  };
  tampil(langkah[0]);
  const pengamat = new IntersectionObserver(entri => {
    for (const e of entri) if (e.isIntersecting) tampil(e.target);
  }, { rootMargin: '-58% 0px -32% 0px' });
  langkah.forEach(l => pengamat.observe(l));
}

function aturKemajuan() {
  const garis = $('kemajuan');
  if (!garis) return;
  let menunggu = false;
  const perbarui = () => {
    const total = document.documentElement.scrollHeight - window.innerHeight;
    garis.style.transform = `scaleX(${total > 0 ? Math.min(1, window.scrollY / total).toFixed(4) : 0})`;
    menunggu = false;
  };
  window.addEventListener('scroll', () => { if (!menunggu) { menunggu = true; requestAnimationFrame(perbarui); } }, { passive: true });
  perbarui();
}

// Angka kecil yang melayang naik di langit pembuka, seperti kunang-kunang
function aturKunang() {
  const kanvas = $('kunang');
  if (!kanvas || !kanvas.getContext) return;
  const ctx = kanvas.getContext('2d');
  let w = 0, h = 0;
  const ukur = () => {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    w = kanvas.clientWidth; h = kanvas.clientHeight;
    kanvas.width = Math.round(w * dpr); kanvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  ukur();
  window.addEventListener('resize', ukur);
  const acak = (a, b) => a + Math.random() * (b - a);
  const titik = Array.from({ length: 34 }, () => ({
    x: acak(0, 1), y: acak(0, 1), v: acak(0.012, 0.03), fase: acak(0, 6.3),
    d: String(Math.floor(acak(0, 10))), u: acak(10, 15), a: acak(0.18, 0.6),
  }));
  const gambar = dt => {
    ctx.clearRect(0, 0, w, h);
    ctx.shadowColor = 'rgba(255, 190, 120, 0.9)';
    ctx.shadowBlur = 12;
    for (const t of titik) {
      t.y -= t.v * dt; t.fase += dt * 0.7;
      if (t.y < -0.04) { t.y = 1.04; t.x = acak(0, 1); t.d = String(Math.floor(acak(0, 10))); }
      ctx.font = `500 ${t.u}px 'IBM Plex Mono', monospace`;
      const pudar = Math.min(1, Math.max(0, (t.y - 0.06) / 0.2)) * Math.min(1, (1.04 - t.y) / 0.12);   // hilang dekat navigasi
      ctx.fillStyle = `rgba(255, 216, 168, ${(t.a * pudar).toFixed(3)})`;
      ctx.fillText(t.d, t.x * w + Math.sin(t.fase) * 9, t.y * h);
    }
  };
  if (kurangiGerak()) { gambar(0); return; }
  let jalan = false, lalu = 0;
  const putaran = ts => {
    if (!jalan) return;
    gambar(Math.min(0.05, (ts - lalu) / 1000));
    lalu = ts;
    requestAnimationFrame(putaran);
  };
  new IntersectionObserver(([e]) => {
    const tadi = jalan;
    jalan = e.isIntersecting;
    if (jalan && !tadi) { lalu = performance.now(); requestAnimationFrame(putaran); }
  }).observe(kanvas);
}

function aturParalaks() {
  if (kurangiGerak()) return;
  const lapis = [...document.querySelectorAll('[data-paralaks]')];
  let menunggu = false;
  window.addEventListener('scroll', () => {
    if (menunggu) return;
    menunggu = true;
    requestAnimationFrame(() => {
      const y = window.scrollY;
      if (y < window.innerHeight * 1.3)
        for (const l of lapis) l.style.transform = `translateY(${(y * Number(l.dataset.paralaks)).toFixed(1)}px)`;
      menunggu = false;
    });
  }, { passive: true });
}

// ===================== pemutar langkah usulan B =====================

const pemutar = { langkah: [], i: 0, jalan: null };

function renderPemutar(idx, h) {
  const wadah = $('demo-pemutar');
  const L = (h && h.log.langkahB) || [];
  if (!L.length) { wadah.innerHTML = ''; return; }
  const ab = demo.ab;
  const n = x => `<span class="angka">${esc(fmt(x))}</span>`;
  const langkah = [{
    kartu: [idx[0]],
    judul: `Peserta ${L[0].peserta + 1} memulai`,
    isi: `<p>Digit pertama langsung diambil dari share peserta ${L[0].peserta + 1}: v<sub>1</sub> = ${n(L[0].v)}.</p>
      <p class="redup">Belum ada hitungan di langkah ini.</p>`,
  }];
  for (let j = 1; j < L.length; j++) {
    const l = L[j];
    langkah.push({
      kartu: [idx[j]],
      judul: `Peserta ${l.peserta + 1} menyumbang digit ke-${j + 1}`,
      isi: `<p>Yang dibutuhkan hanya selisih modulus peserta sebelumnya terhadap modulus peserta ini (m = ${n(l.m)}):
          ${l.selisih.map(d => `<span class="chip">${esc(fmt(d))}</span>`).join('')}</p>
        <p>Dengan selisih itu, digit-digit sebelumnya diringkas menjadi s = ${n(l.s)}, dan faktor pembaginya
          D = ${n(l.D)} dengan invers ${n(l.inv)}. Selama k · log<sub>2</sub>(selisih) jauh di bawah L,
          semuanya hitungan bilangan kecil.</p>
        <p class="hasil-langkah">Digit baru: v<sub>${j + 1}</sub> = (${esc(fmt(l.r))} − s) × D<sup>−1</sup> mod m = ${n(l.v)}</p>`,
    });
  }
  let horner = `S = v<sub>${L.length}</sub> = ${esc(fmt(L[L.length - 1].v))}`;
  for (const s of h.log.hornerB)
    horner += `<br>S = (${esc(fmt(s.lama))} · ${esc(fmt(s.mb))} + ${esc(fmt(s.v))}) mod 2<sup>${ab.L}</sup> = ${esc(fmt(s.S))}`;
  langkah.push({
    kartu: idx,
    judul: 'Semua digit digabung, kuncinya terbuka',
    isi: `<p>Digit-digit itu langsung digabung modulo 2<sup>${ab.L}</sup>, tanpa pernah membentuk bilangan sebesar hasil
        kali modulus:</p>
      <p class="rumus angka">${horner}</p>
      <p class="kunci-terbuka">Rahasia S = ${n(h.S)} ${lencana(h.S === demo.S)}</p>`,
  });
  pemutar.langkah = langkah;
  pemutar.i = 0;
  hentikanPutar();
  tampilPemutar();
}

function tampilPemutar() {
  const { langkah, i } = pemutar;
  const l = langkah[i];
  if (!l) return;
  $('demo-pemutar').innerHTML = `<div class="pemutar">
    <div class="pemutar-kepala"><p class="pemutar-judul">${l.judul}</p>
      <p class="pemutar-hitung">Langkah ${i + 1} dari ${langkah.length}</p></div>
    <ol class="pemutar-titik" aria-hidden="true">${langkah.map((_, j) =>
      `<li class="${j < i ? 'lewat' : j === i ? 'kini' : ''}"></li>`).join('')}</ol>
    <div class="pemutar-isi muncul" aria-live="polite">${l.isi}</div>
    <div class="pemutar-tombol">
      <button type="button" class="tombol kedua" data-pemutar="-1"${i === 0 ? ' disabled' : ''}>Sebelumnya</button>
      <button type="button" class="tombol" data-pemutar="1"${i === langkah.length - 1 ? ' disabled' : ''}>Langkah berikutnya</button>
      <button type="button" class="tombol kedua" data-pemutar="putar">${pemutar.jalan ? 'Hentikan' : 'Putar otomatis'}</button>
    </div></div>`;
  for (const k of document.querySelectorAll('#demo-share .kartu'))
    k.classList.toggle('sorot', l.kartu.includes(Number(k.dataset.i)));
}

function hentikanPutar() {
  if (pemutar.jalan) clearInterval(pemutar.jalan);
  pemutar.jalan = null;
}

function pasangPemutar() {
  $('demo-pemutar').addEventListener('click', e => {
    const t = e.target.closest('[data-pemutar]');
    if (!t || t.disabled) return;
    const aksi = t.dataset.pemutar;
    if (aksi === 'putar') {
      if (pemutar.jalan) hentikanPutar();
      else {
        if (pemutar.i >= pemutar.langkah.length - 1) pemutar.i = 0;
        pemutar.jalan = setInterval(() => {
          if (pemutar.i >= pemutar.langkah.length - 1) hentikanPutar();
          else pemutar.i++;
          tampilPemutar();
        }, 1900);
      }
    } else {
      hentikanPutar();
      pemutar.i = Math.max(0, Math.min(pemutar.langkah.length - 1, pemutar.i + Number(aksi)));
    }
    tampilPemutar();
    const fokus = $('demo-pemutar').querySelector(`[data-pemutar="${aksi}"]`);
    if (fokus && !fokus.disabled) fokus.focus();
  });
}

// ===================== hasil: satu ukuran rahasia sekali tampil =====================

function pasangPilihL() {
  const wadah = $('hasil-pilih-L');
  const blok = [...$('hasil-c').querySelectorAll('.blok-L')];
  if (blok.length < 2) { wadah.innerHTML = ''; blok.forEach(b => { b.hidden = false; }); return; }
  wadah.innerHTML = blok.map((b, i) =>
    `<button type="button" role="tab" data-i="${i}">${esc(b.querySelector('h3').textContent.replace('Rahasia ', ''))}</button>`).join('');
  const pilih = i => {
    blok.forEach((b, j) => { b.hidden = j !== i; });
    wadah.querySelectorAll('button').forEach((t, j) => t.setAttribute('aria-selected', String(j === i)));
  };
  wadah.onclick = e => { const t = e.target.closest('button'); if (t) pilih(Number(t.dataset.i)); };
  pilih(blok.length - 1);
}

// ===================== peristiwa dan awal =====================

function pasangPeristiwa() {
  window.addEventListener('hashchange', bukaTab);

  for (const r of document.querySelectorAll('input[name="demo-sumber"]'))
    r.addEventListener('change', () => { aturInputDemo(); demoSiapkan(); });
  $('demo-bangkit').addEventListener('click', demoSiapkan);
  $('demo-bagi').addEventListener('click', demoBagi);
  $('demo-S').addEventListener('keydown', e => { if (e.key === 'Enter') demoBagi(); });
  $('demo-acak-S').addEventListener('click', () => {
    if (!demo.ab) return;
    $('demo-S').value = fmtInput(acakBit(gen32Aman, demo.ab.L));
    demoBagi();
  });
  $('demo-lengkap').addEventListener('change', e => {
    tampilLengkap = e.target.checked;
    $('panel-demo').classList.toggle('lengkap', tampilLengkap);
    if (demo.bagian) { renderParameter(); renderShare(); demoRekonstruksi(); }
  });
  $('demo-share').addEventListener('click', e => {
    const tombol = e.target.closest('button');
    if (!tombol) return;
    const i = Number(tombol.dataset.i);
    const pilih = tombol.classList.contains('share-pilih');
    const kumpulan = pilih ? demo.hadir : demo.rusak;
    if (kumpulan.has(i)) kumpulan.delete(i); else kumpulan.add(i);
    renderShare();
    demoRekonstruksi();
    const sel = pilih ? '.share-pilih' : '.share-rusak';
    const baru = $('demo-share').querySelector(`${sel}[data-i="${i}"]`);
    if (baru) baru.focus();
  });

  $('uji-cocok').addEventListener('click', ujiCocok);
  $('uji-mulai').addEventListener('click', ujiAcak);
  $('seb-hitung').addEventListener('click', hitungSebaranUI);

  $('bm-mulai').addEventListener('click', mulaiBenchmark);
  $('bm-stop').addEventListener('click', () => {
    bmBerhenti = true;
    setStatus('bm-status', 'Menghentikan setelah blok yang sedang berjalan...');
  });
  $('bm-unduh').addEventListener('click', () => {
    const blob = new Blob([$('bm-csv').value], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'bench_browser.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  });
  $('bm-salin').addEventListener('click', async () => {
    const ta = $('bm-csv');
    try {
      await navigator.clipboard.writeText(ta.value);
      setStatus('bm-status', 'CSV disalin ke clipboard.', 'ok');
    } catch (e) {
      ta.focus();
      ta.select();
      setStatus('bm-status', 'Teks CSV sudah diblok; tekan Ctrl+C untuk menyalin.');
    }
  });

  $('hasil-csv').addEventListener('change', e => bacaBerkas(e.target, teks => {
    dataC = bacaCsvBenchmark(teks);
    renderHasilC();
    renderPerbandingan();
  }));
  $('hasil-sizes').addEventListener('change', e => bacaBerkas(e.target, teks => {
    dataUkuran = bacaCsvUkuran(teks);
    renderHasilC();
  }));
  $('hasil-browser').addEventListener('change', e => bacaBerkas(e.target, teks => {
    barisBrowserBerkas = bacaCsvBenchmark(teks);
    renderPerbandingan();
  }));
}

function mulai() {
  terapkanIdentitas();
  renderCincinCRT();
  aturKunang();
  aturParalaks();
  renderDindingDigit();
  aturCerita();
  aturKemajuan();
  pasangPeristiwa();
  pasangPemutar();
  aturAdegan();
  aturPresentasi();
  aturInputDemo();
  isiLingkungan();
  muatHasilBawaan();
  demoSiapkan();
}

mulai();
