'use strict';
/* SEG-Lager Planer – alle Maße in cm, Gewichte in kg.
   Koordinaten: x nach rechts, y nach unten, Ursprung = Innenecke oben links.
   Objekte: x/y = Mittelpunkt, rot = Drehung im Uhrzeigersinn, "Front" = untere Kante (lokal +y). */

const LS_KEY = 'seg-lager-v1';

/* ---------- Objekttypen ---------- */
const TYPES = {
  schrank:   {label: 'Metallschrank',   sub: 'Flügeltüren',  w: 100, d: 50, h: 195, fields: 1, levels: 5, maxFach: 60,  maxFeld: 250,  empty: 70, color: '#9db4c6', doors: 2, clearance: 0},
  regal:     {label: 'Schwerlastregal', sub: 'Felder/Fachböden', w: 200, d: 60, h: 200, fields: 2, levels: 4, maxFach: 250, maxFeld: 1000, empty: 90, color: '#e59a63', doors: 0, clearance: 80},
  rollwagen: {label: 'Rollwagen',       sub: 'mehrere Ebenen', w: 80, d: 50, h: 90,  fields: 1, levels: 3, maxFach: 50,  maxFeld: 150,  empty: 25, color: '#e8c95a', doors: 0, clearance: 0},
  kiste:     {label: 'Kiste',           sub: 'Box/Behälter', w: 60,  d: 40, h: 32,  fields: 1, levels: 1, maxFach: 30,  maxFeld: 30,   empty: 2,  color: '#b98a5a', doors: 0, clearance: 0},
  tisch:     {label: 'Tisch',           sub: 'Arbeits-/Packtisch', w: 160, d: 80, h: 75, fields: 1, levels: 1, maxFach: 100, maxFeld: 100, empty: 30, color: '#d8cdb0', doors: 0, clearance: 60},
};
const WALLS = {N: 'Nord (oben)', E: 'Ost (rechts)', S: 'Süd (unten)', W: 'West (links)'};

/* ---------- Zustand ---------- */
let uidN = 1;
const uid = () => 'o' + (uidN++) + Math.random().toString(36).slice(2, 5);
const clone = o => JSON.parse(JSON.stringify(o));

function makeCells(it) {
  const old = it.cells || [];
  it.cells = [];
  for (let f = 0; f < it.fields; f++) {
    it.cells.push([]);
    for (let l = 0; l < it.levels; l++) it.cells[f].push((old[f] && old[f][l]) || {t: '', kg: 0, max: null});
  }
}
function newItem(type, over) {
  const T = TYPES[type];
  const it = Object.assign({id: uid(), type, name: T.label, x: 100, y: 100, w: T.w, d: T.d, h: T.h, rot: 0, color: T.color,
    fields: T.fields, levels: T.levels, maxFach: T.maxFach, maxFeld: T.maxFeld, empty: T.empty, doors: T.doors, clearance: T.clearance}, over || {});
  makeCells(it);
  return it;
}
function defaultState() {
  const s = {
    room: {w: 900, l: 600, h: 280, floorLimit: 500},
    door: {wall: 'S', offset: 60, width: 100, hinge: 'start'},
    pillars: [{id: uid(), x: 300, y: 250, w: 40, d: 40}, {id: uid(), x: 600, y: 250, w: 40, d: 40}],
    items: [],
  };
  const A = (t, o) => s.items.push(newItem(t, o));
  A('schrank', {name: 'Schrank 1', x: 50, y: 25});
  A('schrank', {name: 'Schrank 2', x: 150, y: 25});
  A('schrank', {name: 'Schrank 3', x: 250, y: 25});
  A('rollwagen', {name: 'Rollwagen 1', x: 400, y: 25});
  A('rollwagen', {name: 'Rollwagen 2', x: 490, y: 25});
  A('regal', {name: 'Regal W', x: 30, y: 300, rot: 270});
  A('tisch', {name: 'Packtisch', x: 650, y: 190, rot: 180});
  A('kiste', {name: 'Kiste 1', x: 880, y: 30, rot: 90});
  A('kiste', {name: 'Kiste 2', x: 880, y: 90, rot: 90});
  s.items[0].cells[0][4] = {t: 'Funkgeräte', kg: 12, max: null};
  s.items[5].cells[0][0] = {t: 'Zelt, Heizgerät', kg: 180, max: null};
  return s;
}
function loadState() {
  try { const s = JSON.parse(localStorage.getItem(LS_KEY)); if (s && s.room && s.items) return s; } catch (e) {}
  return null;
}
let S = loadState() || defaultState();
let sel = null;           // {kind:'item'|'pillar'|'door', id}
let view = {x: -60, y: -60, w: 1020, h: 720};
const opt = {grid: 5, zones: true, dims: true, heat: false};
let ST = null;            // Analyseergebnis

/* ---------- Historie ---------- */
let hist = [JSON.stringify(S)], hIdx = 0;
function commit() {
  const s = JSON.stringify(S);
  if (s === hist[hIdx]) return;
  hist = hist.slice(0, hIdx + 1); hist.push(s); hIdx++;
  if (hist.length > 100) { hist.shift(); hIdx--; }
}
function undo(d) {
  const n = hIdx + d; if (n < 0 || n >= hist.length) return;
  hIdx = n; S = JSON.parse(hist[hIdx]);
  if (sel && !findSel()) sel = null;
  refresh({rebuild: true, room: true});
}

/* ---------- Geometrie ---------- */
const rad = d => d * Math.PI / 180;
function toWorld(it, lx, ly) {
  const a = rad(it.rot), c = Math.cos(a), s = Math.sin(a);
  return [it.x + lx * c - ly * s, it.y + lx * s + ly * c];
}
const footprint = it => [[-it.w / 2, -it.d / 2], [it.w / 2, -it.d / 2], [it.w / 2, it.d / 2], [-it.w / 2, it.d / 2]].map(p => toWorld(it, p[0], p[1]));
function frontDepth(it) { return it.type === 'schrank' ? (it.doors === 1 ? it.w : it.w / 2) : (+it.clearance || 0); }
function frontZone(it) {
  const c = frontDepth(it); if (!c) return null;
  const hw = it.w / 2, hd = it.d / 2;
  return [[-hw, hd], [hw, hd], [hw, hd + c], [-hw, hd + c]].map(p => toWorld(it, p[0], p[1]));
}
const pillarPoly = p => [[p.x, p.y], [p.x + p.w, p.y], [p.x + p.w, p.y + p.d], [p.x, p.y + p.d]];
function bbox(poly) {
  const xs = poly.map(p => p[0]), ys = poly.map(p => p[1]);
  return {minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys)};
}
function sat(A, B, eps) {
  for (const P of [A, B]) {
    for (let i = 0; i < P.length; i++) {
      const p = P[i], q = P[(i + 1) % P.length];
      let nx = q[1] - p[1], ny = p[0] - q[0]; const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
      let a0 = 1e9, a1 = -1e9, b0 = 1e9, b1 = -1e9;
      A.forEach(v => { const t = v[0] * nx + v[1] * ny; a0 = Math.min(a0, t); a1 = Math.max(a1, t); });
      B.forEach(v => { const t = v[0] * nx + v[1] * ny; b0 = Math.min(b0, t); b1 = Math.max(b1, t); });
      if (Math.min(a1, b1) - Math.max(a0, b0) <= eps) return false;
    }
  }
  return true;
}
function doorGeom() {
  const R = S.room, D = S.door, W = R.w, L = R.l;
  const defs = {N: [[0, 0], [1, 0], [0, 1]], S: [[0, L], [1, 0], [0, -1]], W: [[0, 0], [0, 1], [1, 0]], E: [[W, 0], [0, 1], [-1, 0]]};
  const [P0, u, n] = defs[D.wall];
  const A = [P0[0] + u[0] * D.offset, P0[1] + u[1] * D.offset];
  const B = [A[0] + u[0] * D.width, A[1] + u[1] * D.width];
  const H = D.hinge === 'start' ? A : B, F = D.hinge === 'start' ? B : A;
  const T = [H[0] + n[0] * D.width, H[1] + n[1] * D.width];
  const v1 = [F[0] - H[0], F[1] - H[1]], v2 = [T[0] - H[0], T[1] - H[1]];
  const sweep = (v1[0] * v2[1] - v1[1] * v2[0]) > 0 ? 1 : 0;
  const zone = [A, B, [B[0] + n[0] * D.width, B[1] + n[1] * D.width], [A[0] + n[0] * D.width, A[1] + n[1] * D.width]];
  return {A, B, H, F, T, sweep, zone, u, n, W, L};
}

/* ---------- Analyse ---------- */
function cellMax(it, c) { return c.max != null && c.max !== '' ? +c.max : it.maxFach; }
function analyze() {
  const R = S.room, out = {items: {}, issues: [], bad: new Set(), totals: {content: 0, total: 0, area: 0}};
  const add = (sev, id, msg) => out.issues.push({sev, id, msg});
  const polys = {}, fronts = {};
  S.items.forEach(it => {
    polys[it.id] = footprint(it); fronts[it.id] = frontZone(it);
    const st = {fieldSum: [], over: false, ratio: 0, content: 0};
    it.cells.forEach((col, f) => {
      let sum = 0;
      col.forEach((c, l) => {
        const kg = +c.kg || 0, mx = cellMax(it, c); sum += kg;
        if (mx > 0) st.ratio = Math.max(st.ratio, kg / mx);
        if (kg > mx) { st.over = true; add('err', it.id, `${it.name}: Fachlast überschritten (Feld ${f + 1}, Ebene ${l + 1}: ${kg} / ${mx} kg)`); }
      });
      st.fieldSum.push(sum); st.content += sum;
      if (it.maxFeld > 0) st.ratio = Math.max(st.ratio, sum / it.maxFeld);
      if (sum > it.maxFeld) { st.over = true; add('err', it.id, `${it.name}: Feldlast überschritten (Feld ${f + 1}: ${sum} / ${it.maxFeld} kg)`); }
    });
    st.total = st.content + (+it.empty || 0);
    st.pressure = st.total / ((it.w * it.d) / 1e4);
    if (R.floorLimit > 0 && st.pressure > R.floorLimit) add('warn', it.id, `${it.name}: Bodenbelastung ${Math.round(st.pressure)} kg/m² > ${R.floorLimit} kg/m²`);
    if (R.h > 0 && it.h > R.h) add('warn', it.id, `${it.name}: Höhe ${it.h} cm > Raumhöhe ${R.h} cm`);
    out.items[it.id] = st;
    out.totals.content += st.content; out.totals.total += st.total; out.totals.area += it.w * it.d;
  });
  const room = [[0, 0], [R.w, 0], [R.w, R.l], [0, R.l]];
  const dz = doorGeom().zone;
  const pil = S.pillars.map(pillarPoly);
  S.items.forEach((it, i) => {
    const bb = bbox(polys[it.id]);
    if (bb.minX < -0.5 || bb.minY < -0.5 || bb.maxX > R.w + 0.5 || bb.maxY > R.l + 0.5) { add('err', it.id, `${it.name}: ragt über die Raumwand hinaus`); out.bad.add(it.id); }
    for (let j = i + 1; j < S.items.length; j++) {
      const o = S.items[j];
      if (sat(polys[it.id], polys[o.id], 0.5)) { add('err', it.id, `${it.name} überschneidet sich mit ${o.name}`); out.bad.add(it.id); out.bad.add(o.id); }
    }
    S.pillars.forEach((p, k) => {
      if (sat(polys[it.id], pil[k], 0.5)) { add('err', it.id, `${it.name} kollidiert mit Stützpfeiler`); out.bad.add(it.id); }
    });
    if (sat(polys[it.id], dz, 0.5)) add('warn', it.id, `${it.name} blockiert den Türschwenkbereich`);
    const fz = fronts[it.id];
    if (fz) {
      let hit = null;
      S.items.forEach(o => { if (o !== it && !hit && sat(fz, polys[o.id], 0.5)) hit = o.name; });
      S.pillars.forEach((p, k) => { if (!hit && sat(fz, pil[k], 0.5)) hit = 'Stützpfeiler'; });
      if (hit) { add('warn', it.id, `${it.name}: Freiraum/Türbereich vorne blockiert durch ${hit}`); out.items[it.id].frontBlocked = true; }
    }
  });
  const rArea = R.w * R.l;
  out.totals.rArea = rArea; out.totals.free = rArea ? 1 - out.totals.area / rArea : 0;
  return out;
}

/* ---------- Hilfen ---------- */
const $ = s => document.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const r1 = n => Math.round(n * 10) / 10;
const fmt = n => (Math.round(n * 10) / 10).toLocaleString('de-DE');
const findItem = id => S.items.find(i => i.id === id);
function findSel() {
  if (!sel) return null;
  if (sel.kind === 'item') return findItem(sel.id);
  if (sel.kind === 'pillar') return S.pillars.find(p => p.id === sel.id);
  if (sel.kind === 'door') return S.door;
  return null;
}
function ratioClass(r) { return r > 1 ? 'err' : r > 0.85 ? 'warn' : ''; }

/* ---------- Formular-Framework ---------- */
const B = {}; let bn = 0;
function formHTML(defs) {
  return defs.map(d => {
    if (d.html) return d.html;
    if (d.h3) return `<h3>${esc(d.h3)}</h3>`;
    const id = 'b' + (++bn); B[id] = d;
    let inp;
    if (d.type === 'select') inp = `<select data-b="${id}">${d.options.map(o => `<option value="${esc(o[0])}">${esc(o[1])}</option>`).join('')}</select>`;
    else if (d.type === 'text') inp = `<input type="text" data-b="${id}">`;
    else if (d.type === 'color') inp = `<input type="color" data-b="${id}">`;
    else inp = `<input type="number" data-b="${id}" ${d.min != null ? `min="${d.min}"` : ''} ${d.max != null ? `max="${d.max}"` : ''} step="${d.step || 1}">`;
    return `<div class="row"><label>${esc(d.label)}${d.unit ? ` <span class="u">(${d.unit})</span>` : ''}</label>${inp}</div>`;
  }).join('');
}
function syncForms() {
  document.querySelectorAll('[data-b]').forEach(el => {
    const d = B[el.dataset.b]; if (!d) return;
    if (document.activeElement !== el) { const v = d.get(); if (el.value !== String(v)) el.value = v; }
  });
  document.querySelectorAll('[data-o]').forEach(el => { const f = OUT[el.dataset.o]; if (f) el.innerHTML = f(); });
  document.querySelectorAll('[data-bar]').forEach(el => {
    const f = BAR[el.dataset.bar]; if (!f) return;
    const r = f(); el.className = 'bar ' + ratioClass(r); el.firstChild.style.width = Math.min(100, r * 100) + '%';
  });
}
let OUT = {}, BAR = {};
document.addEventListener('change', e => {
  const el = e.target.closest('[data-b]'); if (!el) return;
  const d = B[el.dataset.b]; if (!d) return;
  let v = el.value;
  if (d.type === 'number' || !d.type) {
    v = parseFloat(v);
    if (isNaN(v)) { syncForms(); return; }
    if (d.min != null) v = Math.max(d.min, v);
    if (d.max != null) v = Math.min(d.max, v);
  }
  d.set(v); commit(); refresh({rebuild: !!d.rebuild, room: !!d.room});
});

/* ---------- Auswahl, Hinzufügen, Löschen ---------- */
function select(s) { sel = s; refresh({rebuild: true}); }
function addItem(type) {
  const it = newItem(type, {name: nextName(TYPES[type].label)});
  it.x = r1(S.room.w / 2); it.y = r1(S.room.l / 2);
  S.items.push(it); sel = {kind: 'item', id: it.id}; commit(); refresh({rebuild: true});
}
function nextName(base) {
  let n = 1; const names = new Set(S.items.map(i => i.name));
  while (names.has(base + ' ' + n)) n++;
  return base + ' ' + n;
}
function dupSel() {
  if (!sel || sel.kind !== 'item') return;
  const c = clone(findItem(sel.id)); c.id = uid(); c.name += ' (Kopie)'; c.x += 20; c.y += 20;
  S.items.push(c); sel = {kind: 'item', id: c.id}; commit(); refresh({rebuild: true});
}
function delSel() {
  if (!sel) return;
  if (sel.kind === 'item') S.items = S.items.filter(i => i.id !== sel.id);
  else if (sel.kind === 'pillar') S.pillars = S.pillars.filter(p => p.id !== sel.id);
  else return;
  sel = null; commit(); refresh({rebuild: true, room: true});
}
function addPillar() {
  const p = {id: uid(), x: Math.round(S.room.w / 2 - 20), y: Math.round(S.room.l / 2 - 20), w: 40, d: 40};
  S.pillars.push(p); sel = {kind: 'pillar', id: p.id}; commit(); refresh({rebuild: true, room: true});
}

/* ---------- Raum-Tab ---------- */
function buildRoomTab() {
  const R = S.room, D = S.door;
  const num = (label, obj, k, o) => Object.assign({label, type: 'number', get: () => obj()[k], set: v => { obj()[k] = v; }}, o);
  $('#tab-room').innerHTML = formHTML([
    {h3: 'Raummaße (Innenmaß)'},
    num('Breite (links–rechts)', () => S.room, 'w', {unit: 'cm', min: 100, step: 5, room: true}),
    num('Länge (oben–unten)', () => S.room, 'l', {unit: 'cm', min: 100, step: 5, room: true}),
    num('Raumhöhe', () => S.room, 'h', {unit: 'cm', min: 0, step: 5}),
    num('Zul. Bodenlast', () => S.room, 'floorLimit', {unit: 'kg/m²', min: 0, step: 50}),
    {h3: 'Tür'},
    {label: 'Wand', type: 'select', options: Object.entries(WALLS), get: () => S.door.wall, set: v => { S.door.wall = v; }},
    num('Abstand vom Wandanfang', () => S.door, 'offset', {unit: 'cm', min: 0, step: 5}),
    num('Türbreite', () => S.door, 'width', {unit: 'cm', min: 50, step: 5}),
    {label: 'Türband', type: 'select', options: [['start', 'am Wandanfang'], ['end', 'am Wandende']], get: () => S.door.hinge, set: v => { S.door.hinge = v; }},
    {html: '<div class="muted" style="font-size:12px">Wandanfang: Nord/Süd = links, West/Ost = oben. Die Tür kann auch im Plan verschoben werden.</div>'},
    {h3: 'Stützpfeiler'},
    {html: `<div class="btns"><button class="primary small" id="addPillar">+ Pfeiler</button></div><div class="list" id="pillarList"></div>`},
  ]);
  $('#addPillar').onclick = addPillar;
  renderPillarList();
}
function renderPillarList() {
  const el = $('#pillarList'); if (!el) return;
  el.innerHTML = S.pillars.map((p, i) => `<div class="li ${sel && sel.id === p.id ? 'sel' : ''}" data-sel="pillar:${p.id}"><span class="nm">Pfeiler ${i + 1}</span><small>${p.w}×${p.d} cm</small></div>`).join('') || '<div class="muted">Keine Pfeiler.</div>';
}

/* ---------- Objekte-Tab ---------- */
function buildObjectsTab() {
  $('#tab-objects').innerHTML = `<h3>Hinzufügen</h3><div class="pal">${Object.entries(TYPES).map(([k, t]) =>
    `<button data-add="${k}"><span class="sw" style="background:${t.color}"></span><span>${esc(t.label)}</span></button>`).join('')}</div>
    <h3>Im Raum</h3><div class="list" id="objList"></div>`;
}
function renderObjList() {
  const el = $('#objList'); if (!el) return;
  el.innerHTML = S.items.map(it => {
    const st = ST.items[it.id], bad = ST.bad.has(it.id);
    const cls = st.over || bad ? 'err' : (st.frontBlocked ? 'warn' : '');
    return `<div class="li ${sel && sel.id === it.id ? 'sel' : ''}" data-sel="item:${it.id}"><span class="sw" style="background:${it.color}"></span>
      <span class="nm">${esc(it.name)}</span><span class="chip ${cls}">${fmt(st.content)} kg</span></div>`;
  }).join('') || '<div class="muted">Noch keine Objekte.</div>';
}

/* ---------- Übersicht ---------- */
function reportHTML() {
  const T = ST.totals;
  let h = '';
  h += `<div class="kv"><span>Raumfläche</span><b>${fmt(T.rArea / 1e4)} m²</b><span>Belegte Stellfläche</span><b>${fmt(T.area / 1e4)} m² (${Math.round((1 - T.free) * 100)} %)</b><span>Lagergut gesamt</span><b>${fmt(T.content)} kg</b><span>Gesamtgewicht inkl. Möbel</span><b>${fmt(T.total)} kg</b></div>`;
  S.items.forEach(it => {
    const st = ST.items[it.id], rows = [];
    it.cells.forEach((col, f) => col.forEach((c, l) => { if (c.t || +c.kg) rows.push([f, l, c]); }));
    h += `<h2 style="font-size:13px;margin:10px 0 2px">${esc(it.name)} <small class="muted">${esc(TYPES[it.type].label)} · ${it.w}×${it.d}×${it.h} cm · ${fmt(st.content)} kg Inhalt</small></h2>`;
    if (rows.length) {
      h += `<table class="rep"><tr><th>Feld</th><th>Ebene</th><th>Inhalt</th><th>kg</th><th>max</th></tr>` +
        rows.map(([f, l, c]) => `<tr><td>${f + 1}</td><td>${l + 1}</td><td>${esc(c.t)}</td><td class="n">${fmt(+c.kg || 0)}</td><td class="n">${fmt(cellMax(it, c))}</td></tr>`).join('') + '</table>';
    } else h += '<div class="muted" style="font-size:12px">Keine Belegung eingetragen.</div>';
  });
  return h;
}
function renderReport() {
  const iss = ST.issues;
  $('#tab-report').innerHTML = `<h3>Prüfung</h3>` + (iss.length ? iss.map(i => `<div class="issue ${i.sev}" data-sel="item:${i.id}">${esc(i.msg)}</div>`).join('') : '<div class="ok">✓ Keine Probleme gefunden.</div>') +
    `<h3>Belegung</h3>` + reportHTML();
}
function renderStatus() {
  const e = ST.issues.filter(i => i.sev === 'err').length, w = ST.issues.length - e;
  $('#status').innerHTML = (e ? `<span class="pill err">${e} Fehler</span>` : '') + (w ? `<span class="pill warn">${w} Hinweis${w > 1 ? 'e' : ''}</span>` : '') +
    (!e && !w ? '<span class="pill okk">✓ Plan ok</span>' : '') +
    `<span class="pill">${S.items.length} Objekte · ${fmt(ST.totals.content)} kg Lagergut · ${Math.round((1 - ST.totals.free) * 100)} % Fläche belegt</span>`;
}

/* ---------- Inspektor ---------- */
function bboxOf(it) { return bbox(footprint(it)); }
function buildInspector() {
  const el = $('#right'); OUT = {}; BAR = {};
  const o = findSel();
  if (!o) {
    el.innerHTML = `<div class="pad"><h3>Eigenschaften</h3><p class="muted">Ein Objekt im Plan oder in der Liste anklicken, um Position, Maße, Fach- und Feldlasten und den Inhalt zu bearbeiten.</p>
      <p class="muted">Neue Objekte über den Reiter <b>Objekte</b> hinzufügen.</p></div>`;
    return;
  }
  const num = (label, get, set, x) => Object.assign({label, type: 'number', get, set}, x);
  if (sel.kind === 'door') {
    el.innerHTML = `<div class="pad"><h3>Tür</h3><p class="muted">Tür-Einstellungen im Reiter „Raum“ oder per Ziehen im Plan.</p><div class="btns"><button data-go="room">Zum Reiter Raum</button></div></div>`;
    return;
  }
  if (sel.kind === 'pillar') {
    el.innerHTML = `<div class="pad">${formHTML([{h3: 'Stützpfeiler'},
      num('Abstand links', () => o.x, v => { o.x = v; }, {unit: 'cm', step: 5}),
      num('Abstand oben', () => o.y, v => { o.y = v; }, {unit: 'cm', step: 5}),
      num('Breite', () => o.w, v => { o.w = v; }, {unit: 'cm', min: 5, step: 5}),
      num('Tiefe', () => o.d, v => { o.d = v; }, {unit: 'cm', min: 5, step: 5}),
    ])}<div class="btns"><button class="danger" data-act="del">Löschen</button></div></div>`;
    syncForms(); return;
  }
  const it = o, T = TYPES[it.type];
  const setEdge = (axis, v) => { const bb = bboxOf(it); if (axis === 'x') it.x += v - bb.minX; else it.y += v - bb.minY; };
  const defs = [
    {h3: T.label},
    {label: 'Bezeichnung', type: 'text', get: () => it.name, set: v => { it.name = v; }},
    {label: 'Farbe', type: 'color', get: () => it.color, set: v => { it.color = v; }},
    {h3: 'Position'},
    num('Abstand zur linken Wand', () => r1(bboxOf(it).minX), v => setEdge('x', v), {unit: 'cm', step: 1}),
    num('Abstand zur oberen Wand', () => r1(bboxOf(it).minY), v => setEdge('y', v), {unit: 'cm', step: 1}),
    num('Drehung', () => it.rot, v => { it.rot = ((v % 360) + 360) % 360; }, {unit: '°', step: 15}),
    {html: `<div class="muted" style="font-size:12px">Abstand rechts <b data-o="r"></b> · unten <b data-o="b"></b> (Front = dicke Kante)</div><div class="btns"><button data-act="rot">⟳ 90° drehen</button></div>`},
    {h3: 'Maße'},
    num('Breite', () => it.w, v => { it.w = v; }, {unit: 'cm', min: 5, step: 5}),
    num('Tiefe', () => it.d, v => { it.d = v; }, {unit: 'cm', min: 5, step: 5}),
    num('Höhe', () => it.h, v => { it.h = v; }, {unit: 'cm', min: 5, step: 5}),
  ];
  if (it.type === 'schrank') defs.push({label: 'Flügeltüren', type: 'select', options: [[2, '2 Türen'], [1, '1 Tür']], get: () => it.doors, set: v => { it.doors = +v; }});
  else defs.push(num('Freiraum vorne', () => it.clearance, v => { it.clearance = v; }, {unit: 'cm', min: 0, step: 5}));
  defs.push({h3: 'Aufbau & Lastgrenzen'},
    num('Felder (nebeneinander)', () => it.fields, v => { it.fields = Math.round(v); makeCells(it); }, {min: 1, max: 8, rebuild: true}),
    num('Ebenen/Fächer je Feld', () => it.levels, v => { it.levels = Math.round(v); makeCells(it); }, {min: 1, max: 12, rebuild: true}),
    num('Fachlast max.', () => it.maxFach, v => { it.maxFach = v; }, {unit: 'kg', min: 0, step: 5}),
    num('Feldlast max.', () => it.maxFeld, v => { it.maxFeld = v; }, {unit: 'kg', min: 0, step: 10}),
    num('Eigengewicht', () => it.empty, v => { it.empty = v; }, {unit: 'kg', min: 0, step: 5}),
    {html: `<div class="kv"><span>Gewicht gesamt</span><b data-o="tot"></b><span>Bodenbelastung</span><b data-o="pr"></b></div>`},
    {h3: 'Belegung (Inhalt · Gewicht · eigene Fachlast)'});
  // Zellen
  let cells = `<div class="cellgrid" style="grid-template-columns:repeat(${it.fields},minmax(0,1fr))">`;
  for (let l = it.levels - 1; l >= 0; l--) {
    for (let f = 0; f < it.fields; f++) {
      const c = it.cells[f][l];
      const idT = 'b' + (++bn), idK = 'b' + (++bn), idM = 'b' + (++bn);
      B[idT] = {type: 'text', get: () => c.t, set: v => { c.t = v; }};
      B[idK] = {type: 'number', get: () => c.kg, set: v => { c.kg = Math.max(0, v); }};
      B[idM] = {type: 'number', get: () => c.max == null ? '' : c.max, set: v => { c.max = v; }};
      const bid = `c${f}_${l}`; BAR[bid] = () => (+c.kg || 0) / (cellMax(it, c) || 1);
      cells += `<div class="cell"><div class="lv">${it.fields > 1 ? `Feld ${f + 1} · ` : ''}Ebene ${l + 1}</div>
        <input type="text" placeholder="Inhalt" data-b="${idT}"><div class="nums">
        <input type="number" min="0" step="1" title="Gewicht (kg)" placeholder="kg" data-b="${idK}">
        <input type="number" min="0" step="5" title="Fachlast max. (leer = Standard)" placeholder="max ${it.maxFach}" data-b="${idM}"></div>
        <div class="bar" data-bar="${bid}"><i></i></div></div>`;
    }
  }
  cells += '</div><div id="fsums"></div>';
  defs.push({html: cells});
  el.innerHTML = `<div class="pad">${formHTML(defs)}<div class="btns"><button data-act="dup">Duplizieren</button><button class="danger" data-act="del">Löschen</button></div></div>`;
  OUT.r = () => fmt(R_.w - bboxOf(it).maxX) + ' cm';
  OUT.b = () => fmt(R_.l - bboxOf(it).maxY) + ' cm';
  OUT.tot = () => fmt(ST.items[it.id].total) + ' kg';
  OUT.pr = () => { const p = ST.items[it.id].pressure; return `<span class="${p > S.room.floorLimit && S.room.floorLimit ? 'chip err' : ''}">${fmt(p)} kg/m²</span>`; };
  OUT.fsums = () => ST.items[it.id].fieldSum.map((s, f) => `<div class="fieldsum">Feld ${f + 1}: <b class="${s > it.maxFeld ? 'chip err' : ''}">${fmt(s)} / ${fmt(it.maxFeld)} kg</b> Feldlast</div>`).join('');
  syncForms();
}
const R_ = new Proxy({}, {get: (_, k) => S.room[k]});

/* ---------- Plan zeichnen ---------- */
const svg = $('#plan');
function arcPath(it) { /* Türschwenk der Schränke (lokal) */
  const w = it.w, d = it.d, hd = d / 2;
  if (it.doors === 1) return `M${w / 2} ${hd}L${-w / 2} ${hd}L${-w / 2} ${hd + w}A${w} ${w} 0 0 0 ${w / 2} ${hd}Z`;
  const r = w / 2;
  return `M${-w / 2} ${hd}L0 ${hd}A${r} ${r} 0 0 1 ${-w / 2} ${hd + r}Z M${w / 2} ${hd}L0 ${hd}A${r} ${r} 0 0 0 ${w / 2} ${hd + r}Z`;
}
function heatColor(r) { return r > 1 ? '#ef5350' : r > 0.85 ? '#ffb74d' : r > 0.5 ? '#fff176' : r > 0 ? '#aed581' : null; }
function itemSVG(it) {
  const st = ST.items[it.id], bad = ST.bad.has(it.id), w = it.w, d = it.d, hw = w / 2, hd = d / 2;
  const fill = opt.heat ? (heatColor(st.ratio) || '#f1f1f1') : it.color;
  let g = `<g class="item ${bad ? 'bad' : ''} ${st.over ? 'over' : ''}" data-kind="item" data-id="${it.id}" transform="translate(${r1(it.x)} ${r1(it.y)}) rotate(${it.rot})">`;
  g += `<rect class="body" x="${-hw}" y="${-hd}" width="${w}" height="${d}" fill="${fill}"/>`;
  if (it.type === 'schrank') {
    g += `<rect class="deco" x="${-hw + 2}" y="${-hd + 2}" width="${w - 4}" height="${d - 4}"/>`;
    if (it.doors === 2) g += `<line class="deco" x1="0" y1="${-hd + 2}" x2="0" y2="${hd}"/><circle class="decof" cx="-3" cy="${hd - 6}" r="1.6"/><circle class="decof" cx="3" cy="${hd - 6}" r="1.6"/>`;
    else g += `<circle class="decof" cx="${hw - 6}" cy="${hd - 6}" r="1.6"/>`;
  } else if (it.type === 'regal') {
    for (let i = 0; i <= it.fields; i++) { const x = -hw + i * w / it.fields; g += `<rect x="${x - 2.5}" y="${-hd}" width="5" height="${d}" fill="#4a4f55" opacity=".85"/>`; }
    for (let i = 0; i < it.fields; i++) { const x0 = -hw + i * w / it.fields + 2.5, x1 = -hw + (i + 1) * w / it.fields - 2.5; g += `<line class="deco" x1="${x0}" y1="${-hd}" x2="${x1}" y2="${hd}"/><line class="deco" x1="${x1}" y1="${-hd}" x2="${x0}" y2="${hd}"/>`; }
  } else if (it.type === 'rollwagen') {
    [[-hw + 6, -hd + 6], [hw - 6, -hd + 6], [-hw + 6, hd - 6], [hw - 6, hd - 6]].forEach(p => g += `<circle cx="${p[0]}" cy="${p[1]}" r="4" fill="#333"/>`);
    g += `<line x1="${-hw + 8}" y1="${-hd}" x2="${hw - 8}" y2="${-hd}" stroke="#222" stroke-width="3"/>`;
  } else if (it.type === 'kiste') {
    g += `<rect class="deco" x="${-hw + 3}" y="${-hd + 3}" width="${w - 6}" height="${d - 6}" rx="3"/><rect class="deco" x="-8" y="${-hd + 1}" width="16" height="3"/><rect class="deco" x="-8" y="${hd - 4}" width="16" height="3"/>`;
  } else if (it.type === 'tisch') {
    [[-hw + 4, -hd + 4], [hw - 4, -hd + 4], [-hw + 4, hd - 4], [hw - 4, hd - 4]].forEach(p => g += `<rect x="${p[0] - 3}" y="${p[1] - 3}" width="6" height="6" fill="#555"/>`);
  }
  g += `<line class="front" x1="${-hw}" y1="${hd}" x2="${hw}" y2="${hd}"/></g>`;
  // Beschriftung: läuft entlang der Breite, bleibt aber lesbar (nie auf dem Kopf)
  let r = ((it.rot % 180) + 180) % 180; if (r > 90) r -= 180;
  const fs = Math.max(4.5, Math.min(11, (w * 0.92) / (Math.max(it.name.length, 8) * 0.55)));
  const l2 = `${fmt(st.content)} / ${fmt(it.fields * Math.min(it.levels * it.maxFach, it.maxFeld))} kg`;
  g += `<g transform="translate(${r1(it.x)} ${r1(it.y)}) rotate(${r})"><text class="lbl" y="${r1(-fs * 0.45)}" font-size="${r1(fs)}">${esc(it.name)}</text><text class="lbl l2" y="${r1(fs * 0.75)}" font-size="${r1(fs * 0.8)}">${esc(l2)}</text></g>`;
  return g;
}
function zonesSVG() {
  let z = '';
  const dg = doorGeom();
  if (opt.zones) {
    z += `<path class="doorarc" d="M${dg.H[0]} ${dg.H[1]}L${dg.F[0]} ${dg.F[1]}A${S.door.width} ${S.door.width} 0 0 ${dg.sweep} ${dg.T[0]} ${dg.T[1]}Z"/>`;
    S.items.forEach(it => {
      const fz = frontZone(it); if (!fz) return;
      const blocked = ST.items[it.id].frontBlocked;
      if (it.type === 'schrank') z += `<path class="zone ${blocked ? 'bad' : ''}" transform="translate(${r1(it.x)} ${r1(it.y)}) rotate(${it.rot})" d="${arcPath(it)}"/>`;
      else z += `<polygon class="zone ${blocked ? 'bad' : ''}" points="${fz.map(p => r1(p[0]) + ',' + r1(p[1])).join(' ')}"/>`;
    });
  }
  return z;
}
function dimsSVG() {
  const o = findSel(); if (!o || !opt.dims || sel.kind === 'door') return '';
  const bb = sel.kind === 'item' ? bboxOf(o) : bbox(pillarPoly(o));
  const R = S.room, cx = (bb.minX + bb.maxX) / 2, cy = (bb.minY + bb.maxY) / 2;
  let s = '';
  const seg = (x1, y1, x2, y2, v) => { if (v < 0.5) return; s += `<line class="dimline" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/><text class="dimtxt" x="${(x1 + x2) / 2}" y="${(y1 + y2) / 2}">${fmt(v)}</text>`; };
  seg(0, cy, bb.minX, cy, bb.minX); seg(bb.maxX, cy, R.w, cy, R.w - bb.maxX);
  seg(cx, 0, cx, bb.minY, bb.minY); seg(cx, bb.maxY, cx, R.l, R.l - bb.maxY);
  return s;
}
function renderPlan() {
  const R = S.room, dg = doorGeom();
  let h = `<defs><pattern id="g10" width="10" height="10" patternUnits="userSpaceOnUse"><path class="g-minor" d="M10 0H0V10"/></pattern>
    <pattern id="g100" width="100" height="100" patternUnits="userSpaceOnUse"><rect width="100" height="100" fill="url(#g10)"/><path class="g-major" d="M100 0H0V100"/></pattern></defs>`;
  h += `<rect class="floor" x="0" y="0" width="${R.w}" height="${R.l}"/><rect x="0" y="0" width="${R.w}" height="${R.l}" fill="url(#g100)" pointer-events="none"/>`;
  h += zonesSVG();
  S.pillars.forEach(p => h += `<rect class="pillar" data-kind="pillar" data-id="${p.id}" x="${p.x}" y="${p.y}" width="${p.w}" height="${p.d}"/>`);
  S.items.forEach(it => h += itemSVG(it));
  h += `<rect class="wall" x="-6" y="-6" width="${R.w + 12}" height="${R.l + 12}"/>`;
  h += `<line class="doorgap" x1="${dg.A[0]}" y1="${dg.A[1]}" x2="${dg.B[0]}" y2="${dg.B[1]}"/>`;
  h += `<line class="doorleaf" data-kind="door" data-id="door" x1="${dg.H[0]}" y1="${dg.H[1]}" x2="${dg.T[0]}" y2="${dg.T[1]}" style="stroke-linecap:round"/>`;
  h += `<line data-kind="door" data-id="door" x1="${dg.A[0]}" y1="${dg.A[1]}" x2="${dg.B[0]}" y2="${dg.B[1]}" stroke="transparent" stroke-width="22"/>`;
  h += `<text class="roomdim" x="${R.w / 2}" y="-18">${fmt(R.w)} cm</text><text class="roomdim" transform="translate(-18 ${R.l / 2}) rotate(-90)">${fmt(R.l)} cm</text>`;
  const o = findSel();
  if (o && sel.kind !== 'door') {
    const bb = sel.kind === 'item' ? bboxOf(o) : bbox(pillarPoly(o));
    h += `<rect class="selbox" x="${bb.minX - 3}" y="${bb.minY - 3}" width="${bb.maxX - bb.minX + 6}" height="${bb.maxY - bb.minY + 6}"/>`;
  }
  h += dimsSVG();
  svg.innerHTML = h;
  svg.setAttribute('viewBox', `${view.x} ${view.y} ${view.w} ${view.h}`);
}

/* ---------- Interaktion ---------- */
function svgPt(e) {
  const m = svg.getScreenCTM().inverse(), p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m);
  return [p.x, p.y];
}
function snapDelta(bb, ignoreId, thr) {
  const R = S.room, g = opt.grid;
  const tx = [0, R.w], ty = [0, R.l];
  const addBB = b => { tx.push(b.minX, b.maxX); ty.push(b.minY, b.maxY); };
  S.items.forEach(i => { if (i.id !== ignoreId) addBB(bboxOf(i)); });
  S.pillars.forEach(p => { if (p.id !== ignoreId) addBB(bbox(pillarPoly(p))); });
  const axis = (e0, e1, targets) => {
    let best = null;
    [e0, e1].forEach(e => targets.forEach(t => { const dl = t - e; if (Math.abs(dl) <= thr && (best == null || Math.abs(dl) < Math.abs(best))) best = dl; }));
    if (best == null && g) best = Math.round(e0 / g) * g - e0;
    return best || 0;
  };
  return [axis(bb.minX, bb.maxX, tx), axis(bb.minY, bb.maxY, ty)];
}
let drag = null;
svg.addEventListener('pointerdown', e => {
  const t = e.target.closest('[data-kind]');
  const p = svgPt(e);
  svg.setPointerCapture(e.pointerId);
  if (t) {
    const kind = t.dataset.kind, id = t.dataset.id;
    const changedSel = !sel || sel.kind !== kind || sel.id !== id;
    sel = {kind, id};
    const o = findSel();
    drag = {mode: 'move', kind, id, p0: p, o0: kind === 'item' ? [o.x, o.y] : kind === 'pillar' ? [o.x, o.y] : null, moved: false, rebuild: changedSel};
    if (changedSel) { refresh({rebuild: true}); }
  } else {
    drag = {mode: 'pan', px: e.clientX, py: e.clientY, v0: {...view}, a: svg.getScreenCTM().a, moved: false};
    if (sel) { sel = null; refresh({rebuild: true}); }
  }
  svg.classList.add('dragging');
});
svg.addEventListener('pointermove', e => {
  if (!drag) return;
  if (drag.mode === 'pan') {
    view.x = drag.v0.x - (e.clientX - drag.px) / drag.a; view.y = drag.v0.y - (e.clientY - drag.py) / drag.a;
    svg.setAttribute('viewBox', `${view.x} ${view.y} ${view.w} ${view.h}`); drag.moved = true; return;
  }
  const p = svgPt(e), dx = p[0] - drag.p0[0], dy = p[1] - drag.p0[1];
  if (!drag.moved && Math.hypot(dx, dy) < 2) return;
  drag.moved = true;
  const R = S.room;
  if (drag.kind === 'door') {
    const D = S.door, pt = p;
    const dist = {N: pt[1], S: R.l - pt[1], W: pt[0], E: R.w - pt[0]};
    const wall = Object.keys(dist).sort((a, b) => dist[a] - dist[b])[0];
    const along = (wall === 'N' || wall === 'S') ? pt[0] : pt[1], len = (wall === 'N' || wall === 'S') ? R.w : R.l;
    D.wall = wall; D.offset = Math.round(Math.max(0, Math.min(len - D.width, along - D.width / 2)) / 5) * 5;
  } else {
    const o = findSel(); if (!o) return;
    o.x = drag.o0[0] + dx; o.y = drag.o0[1] + dy;
    if (!e.altKey) {
      const bb = drag.kind === 'item' ? bboxOf(o) : bbox(pillarPoly(o));
      const [sx, sy] = snapDelta(bb, o.id, 6); o.x += sx; o.y += sy;
    }
    o.x = r1(o.x); o.y = r1(o.y);
  }
  refresh({});
});
function endDrag() {
  if (!drag) return;
  if (drag.mode === 'move' && drag.moved) commit();
  drag = null; svg.classList.remove('dragging');
  refresh({room: true});
}
svg.addEventListener('pointerup', endDrag);
svg.addEventListener('pointercancel', endDrag);
function zoom(f, cx, cy) {
  if (cx == null) { cx = view.x + view.w / 2; cy = view.y + view.h / 2; }
  view.x = cx - (cx - view.x) * f; view.y = cy - (cy - view.y) * f; view.w *= f; view.h *= f;
  svg.setAttribute('viewBox', `${view.x} ${view.y} ${view.w} ${view.h}`);
}
svg.addEventListener('wheel', e => { e.preventDefault(); const p = svgPt(e); zoom(e.deltaY > 0 ? 1.12 : 1 / 1.12, p[0], p[1]); }, {passive: false});
function fit() {
  const R = S.room, m = 70, r = svg.clientWidth / Math.max(1, svg.clientHeight) || 1.4;
  let w = R.w + 2 * m, h = R.l + 2 * m;
  if (w / h < r) w = h * r; else h = w / r;
  view = {x: R.w / 2 - w / 2, y: R.l / 2 - h / 2, w, h};
  svg.setAttribute('viewBox', `${view.x} ${view.y} ${view.w} ${view.h}`);
}
$('#zoomIn').onclick = () => zoom(1 / 1.25); $('#zoomOut').onclick = () => zoom(1.25); $('#fit').onclick = fit;
$('#grid').onchange = e => { opt.grid = +e.target.value; };
$('#zones').onchange = e => { opt.zones = e.target.checked; renderPlan(); };
$('#dims').onchange = e => { opt.dims = e.target.checked; renderPlan(); };
$('#heat').onchange = e => { opt.heat = e.target.checked; renderPlan(); };

/* Klicks auf Listen/Tabs/Inspector */
document.addEventListener('click', e => {
  const s = e.target.closest('[data-sel]');
  if (s) { const [k, id] = s.dataset.sel.split(':'); select({kind: k, id}); return; }
  const a = e.target.closest('[data-add]'); if (a) { addItem(a.dataset.add); return; }
  const t = e.target.closest('#tabs button'); if (t) { showTab(t.dataset.tab); return; }
  const g = e.target.closest('[data-go]'); if (g) { showTab(g.dataset.go); return; }
  const act = e.target.closest('[data-act]');
  if (act) {
    if (act.dataset.act === 'del') delSel();
    else if (act.dataset.act === 'dup') dupSel();
    else if (act.dataset.act === 'rot') rotSel();
  }
});
function rotSel() {
  const o = findSel(); if (!o || sel.kind !== 'item') return;
  o.rot = (o.rot + 90) % 360; commit(); refresh({});
}
function showTab(name) {
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === name));
  document.querySelectorAll('.tab').forEach(t => t.hidden = t.id !== 'tab-' + name);
}
document.addEventListener('keydown', e => {
  const tag = (e.target.tagName || '').toLowerCase();
  const typing = tag === 'input' || tag === 'select' || tag === 'textarea';
  if ((e.ctrlKey || e.metaKey) && !typing) {
    if (e.key === 'z') { e.preventDefault(); undo(e.shiftKey ? 1 : -1); } else if (e.key === 'y') { e.preventDefault(); undo(1); } else if (e.key === 'd') { e.preventDefault(); dupSel(); }
    return;
  }
  if (typing) return;
  const o = findSel();
  if (e.key === 'Escape') { sel = null; refresh({rebuild: true}); }
  else if (!o) return;
  else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); delSel(); }
  else if (e.key === 'r' || e.key === 'R') rotSel();
  else if (e.key.startsWith('Arrow') && sel.kind !== 'door') {
    e.preventDefault();
    const st = (e.shiftKey ? 10 : 1) * (opt.grid || 1);
    if (e.key === 'ArrowLeft') o.x -= st; if (e.key === 'ArrowRight') o.x += st;
    if (e.key === 'ArrowUp') o.y -= st; if (e.key === 'ArrowDown') o.y += st;
    commit(); refresh({});
  }
});

/* ---------- Kopf-Buttons ---------- */
$('#undo').onclick = () => undo(-1); $('#redo').onclick = () => undo(1);
$('#export').onclick = () => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(S, null, 1)], {type: 'application/json'}));
  a.download = 'seg-lager-plan.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
};
$('#import').onclick = () => $('#file').click();
$('#file').onchange = e => {
  const f = e.target.files[0]; if (!f) return;
  f.text().then(t => {
    const s = JSON.parse(t);
    if (!s.room || !Array.isArray(s.items) || !s.door) throw new Error('format');
    s.pillars = s.pillars || []; s.items.forEach(i => { i.id = i.id || uid(); makeCells(i); });
    S = s; sel = null; commit(); buildRoomTab(); fit(); refresh({rebuild: true, room: true});
  }).catch(() => alert('Datei konnte nicht gelesen werden.')).finally(() => { e.target.value = ''; });
};
$('#reset').onclick = () => {
  const c = confirm('Plan zurücksetzen?\nOK = Beispielplan laden · Abbrechen = nichts ändern');
  if (!c) return;
  const empty = confirm('Mit leerem Raum beginnen?\nOK = leerer Raum · Abbrechen = Beispielplan');
  S = defaultState(); if (empty) { S.items = []; S.pillars = []; }
  sel = null; commit(); buildRoomTab(); fit(); refresh({rebuild: true, room: true});
};
$('#print').onclick = () => {
  const c = svg.cloneNode(true);
  c.querySelectorAll('.selbox,.dimline,.dimtxt').forEach(n => n.remove());
  c.removeAttribute('id'); c.setAttribute('viewBox', `${-40} ${-40} ${S.room.w + 80} ${S.room.l + 80}`);
  $('#printReport').innerHTML = `<h1>SEG-Lager – BRK Bereitschaft Erding</h1><div>${new Date().toLocaleDateString('de-DE')} · Raum ${fmt(S.room.w)} × ${fmt(S.room.l)} cm</div>${c.outerHTML}<h2>Prüfung</h2>` +
    (ST.issues.length ? '<ul>' + ST.issues.map(i => `<li>${esc(i.msg)}</li>`).join('') + '</ul>' : '<p>Keine Probleme.</p>') + '<h2>Belegung</h2>' + reportHTML();
  window.print();
};

/* ---------- Gesamt-Refresh ---------- */
let saveT = null;
function refresh(o) {
  ST = analyze();
  renderPlan(); renderObjList(); renderReport(); renderStatus(); renderPillarList();
  if (o.rebuild) buildInspector(); else syncForms();
  if (o.room) { syncForms(); }
  $('#undo').disabled = hIdx === 0; $('#redo').disabled = hIdx >= hist.length - 1;
  clearTimeout(saveT); saveT = setTimeout(() => { try { localStorage.setItem(LS_KEY, JSON.stringify(S)); } catch (e) {} }, 300);
}

buildRoomTab(); buildObjectsTab();
ST = analyze();
fit(); refresh({rebuild: true, room: true});
window.addEventListener('resize', () => { if (!drag) fit(); });
