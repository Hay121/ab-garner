// grafik.js
// Grafik garis log-log dan grafik batang sederhana dengan SVG, tanpa pustaka luar.
// Warna diambil dari variabel CSS (kelas .seri-0 sampai .seri-4) supaya ikut mode gelap.
'use strict';

const SVG_NS = 'http://www.w3.org/2000/svg';

function svgEl(tag, attr, teks) {
  const e = document.createElementNS(SVG_NS, tag);
  for (const k in attr) e.setAttribute(k, attr[k]);
  if (teks !== undefined) e.textContent = teks;
  return e;
}

function labelAngka(v) {
  if (v >= 1) return v.toLocaleString('id-ID', { maximumFractionDigits: 0 });
  return v.toLocaleString('id-ID', { maximumSignificantDigits: 2 });
}

// opsi: { labelX, labelY, satuan, seri: [{ nama, titik: [{ x, y, sd }] }] }
function grafikGaris(wadah, opsi) {
  wadah.innerHTML = '';
  const semua = opsi.seri.flatMap(s => s.titik).filter(t => t.y > 0);
  if (!semua.length) { wadah.textContent = 'Belum ada data untuk digambar.'; return; }

  const W = 680, H = 360, kiri = 64, kanan = 16, atas = 14, bawah = 46;
  const lebar = W - kiri - kanan, tinggi = H - atas - bawah;
  const xs = [...new Set(semua.map(t => t.x))].sort((a, b) => a - b);
  let yMin = Infinity, yMax = 0;
  for (const t of semua) {
    yMin = Math.min(yMin, Math.max(t.lo !== undefined ? t.lo : t.y - (t.sd || 0), t.y * 0.5));
    yMax = Math.max(yMax, t.hi !== undefined ? t.hi : t.y + (t.sd || 0));
  }
  const ex0 = Math.floor(Math.log10(yMin)), ex1 = Math.ceil(Math.log10(yMax));
  const lx0 = Math.log10(xs[0]), lx1 = Math.log10(xs[xs.length - 1]);
  const padX = (lx1 - lx0 || 1) * 0.06;
  const sx = x => kiri + ((Math.log10(x) - (lx0 - padX)) / ((lx1 + padX) - (lx0 - padX))) * lebar;
  const sy = y => atas + tinggi - ((Math.log10(y) - ex0) / ((ex1 - ex0) || 1)) * tinggi;

  const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, class: 'grafik', role: 'img', 'aria-label': opsi.labelY + ' terhadap ' + opsi.labelX });

  // garis bantu dan label sumbu y (per dekade, ditambah 2 dan 5 kalau rentangnya sempit)
  const pengali = (ex1 - ex0) <= 2 ? [1, 2, 5] : [1];
  for (let e = ex0; e <= ex1; e++) {
    for (const p of pengali) {
      const v = p * Math.pow(10, e);
      if (v < Math.pow(10, ex0) || v > Math.pow(10, ex1)) continue;
      const y = sy(v);
      svg.appendChild(svgEl('line', { x1: kiri, x2: W - kanan, y1: y, y2: y, class: p === 1 ? 'bantu' : 'bantu tipis' }));
      svg.appendChild(svgEl('text', { x: kiri - 8, y: y + 4, class: 'label-sumbu', 'text-anchor': 'end' }, labelAngka(v)));
    }
  }
  // label sumbu x di setiap nilai x yang ada
  for (const x of xs) {
    const px = sx(x);
    svg.appendChild(svgEl('line', { x1: px, x2: px, y1: atas, y2: atas + tinggi, class: 'bantu tipis' }));
    svg.appendChild(svgEl('text', { x: px, y: atas + tinggi + 18, class: 'label-sumbu', 'text-anchor': 'middle' }, String(x)));
  }
  svg.appendChild(svgEl('line', { x1: kiri, x2: kiri, y1: atas, y2: atas + tinggi, class: 'sumbu' }));
  svg.appendChild(svgEl('line', { x1: kiri, x2: W - kanan, y1: atas + tinggi, y2: atas + tinggi, class: 'sumbu' }));
  svg.appendChild(svgEl('text', { x: kiri + lebar / 2, y: H - 6, class: 'judul-sumbu', 'text-anchor': 'middle' }, opsi.labelX));
  svg.appendChild(svgEl('text', { x: 14, y: atas + tinggi / 2, class: 'judul-sumbu', 'text-anchor': 'middle',
    transform: `rotate(-90 14 ${atas + tinggi / 2})` }, opsi.labelY));

  opsi.seri.forEach((s, i) => {
    const titik = s.titik.filter(t => t.y > 0).sort((a, b) => a.x - b.x);
    if (!titik.length) return;
    const g = svgEl('g', { class: s.kelas || 'seri-' + i });
    g.appendChild(svgEl('polyline', { points: titik.map(t => `${sx(t.x)},${sy(t.y)}`).join(' '), class: 'garis' }));
    for (const t of titik) {
      if (t.lo !== undefined) {               // batang galat kuartil 1 sampai kuartil 3
        g.appendChild(svgEl('line', { x1: sx(t.x), x2: sx(t.x), y1: sy(Math.max(t.lo, Math.pow(10, ex0))), y2: sy(t.hi), class: 'galat' }));
      } else if (t.sd) {
        const lo = Math.max(t.y - t.sd, Math.pow(10, ex0));
        g.appendChild(svgEl('line', { x1: sx(t.x), x2: sx(t.x), y1: sy(lo), y2: sy(t.y + t.sd), class: 'galat' }));
      }
      const c = svgEl('circle', { cx: sx(t.x), cy: sy(t.y), r: 3.5, class: 'titik' });
      c.appendChild(svgEl('title', {}, `${s.nama}, ${opsi.labelX.split(' ')[0]} = ${t.x}: ${labelAngka(t.y)} ${opsi.satuan || ''}` +
        (t.lo !== undefined ? ` (kuartil ${labelAngka(t.lo)} sampai ${labelAngka(t.hi)})` : t.sd ? ` (sd ${labelAngka(t.sd)})` : '')));
      g.appendChild(c);
    }
    svg.appendChild(g);
  });

  wadah.appendChild(svg);
  const legenda = document.createElement('ul');
  legenda.className = 'legenda';
  opsi.seri.forEach((s, i) => {
    const li = document.createElement('li');
    li.innerHTML = `<svg viewBox="0 0 28 10" class="${s.kelas || 'seri-' + i}" aria-hidden="true"><line x1="1" y1="5" x2="27" y2="5" class="garis"/></svg>`;
    li.appendChild(document.createTextNode(s.nama));
    legenda.appendChild(li);
  });
  wadah.appendChild(legenda);
}

// Histogram 256 nilai rahasia untuk uji sebaran k - 1 share
function grafikBatang(wadah, nilai) {
  wadah.innerHTML = '';
  const W = 680, H = 200, kiri = 34, kanan = 8, atas = 10, bawah = 34;
  const lebar = W - kiri - kanan, tinggi = H - atas - bawah;
  const maks = Math.max(2, ...nilai);
  const lb = lebar / nilai.length;
  const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, class: 'grafik', role: 'img',
    'aria-label': 'banyaknya kandidat y untuk tiap nilai rahasia 0 sampai 255' });
  for (let v = 0; v <= maks; v++) {
    const y = atas + tinggi - (v / maks) * tinggi;
    svg.appendChild(svgEl('line', { x1: kiri, x2: W - kanan, y1: y, y2: y, class: v === 0 ? 'sumbu' : 'bantu' }));
    svg.appendChild(svgEl('text', { x: kiri - 6, y: y + 4, class: 'label-sumbu', 'text-anchor': 'end' }, String(v)));
  }
  nilai.forEach((v, s) => {
    if (!v) return;
    const h = (v / maks) * tinggi;
    const r = svgEl('rect', { x: kiri + s * lb + 0.15, y: atas + tinggi - h, width: Math.max(lb - 0.3, 0.6), height: h,
      class: v >= 2 ? 'batang dua' : 'batang' });
    r.appendChild(svgEl('title', {}, `S = ${s}: ${v} kandidat`));
    svg.appendChild(r);
  });
  for (const s of [0, 64, 128, 192, 255]) {
    svg.appendChild(svgEl('text', { x: kiri + s * lb + lb / 2, y: atas + tinggi + 16, class: 'label-sumbu', 'text-anchor': 'middle' }, String(s)));
  }
  svg.appendChild(svgEl('text', { x: kiri + lebar / 2, y: H - 4, class: 'judul-sumbu', 'text-anchor': 'middle' }, 'nilai rahasia S'));
  wadah.appendChild(svg);
}
