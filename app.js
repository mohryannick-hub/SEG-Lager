'use strict';
/* SEG-Lager Planer – alle Maße in cm, Gewichte in kg.
   Koordinaten: x nach rechts, y nach unten, Ursprung = Innenecke oben links.
   Objekte: x/y = Mittelpunkt, rot = Drehung im Uhrzeigersinn, "Front" = untere Kante (lokal +y).
   Kisten können in Fächer (Feld/Ebene) von Schränken, Regalen, Rollwagen und Tischen gestellt werden
   (item.parent = {id, f, l, x, z, rot}); x/z = Abstand von der linken/hinteren Innenkante des Fachs. */

const LS_KEY = 'seg-lager-v1';

/* ---------- Objekttypen ---------- */
const TYPES = {
  schrank:   {label: 'Metallschrank',   w: 100, d: 50, h: 195, fields: 1, levels: 5, maxFach: 60,  maxFeld: 250,  empty: 70, color: '#9db4c6', doors: 2, clearance: 0},
  regal:     {label: 'Schwerlastregal', w: 200, d: 60, h: 200, fields: 2, levels: 4, maxFach: 250, maxFeld: 1000, empty: 90, color: '#e59a63', doors: 0, clearance: 80},
  rollwagen: {label: 'Rollwagen',       w: 80,  d: 50, h: 90,  fields: 1, levels: 3, maxFach: 50,  maxFeld: 150,  empty: 25, color: '#e8c95a', doors: 0, clearance: 0},
  kiste:     {label: 'Kiste',           w: 60,  d: 40, h: 32,  fields: 1, levels: 1, maxFach: 30,  maxFeld: 30,   empty: 2,  color: '#b98a5a', doors: 0, clearance: 0},
  tisch:     {label: 'Tisch',           w: 160, d: 80, h: 75,  fields: 1, levels: 1, maxFach: 100, maxFeld: 100, empty: 30, color: '#d8cdb0', doors: 0, clearance: 60},
};
/* Aufbau der Fächer: wt = Wandstärke seitlich/hinten, tb = Bodenstärke, base = Höhe über Boden (Rollen) */
const PROF = {
  schrank:   {wt: 2,   tb: 1.5, base: 0, closed: true},
  regal:     {wt: 3,   tb: 4,   base: 0, closed: false},
  rollwagen: {wt: 1.5, tb: 3,   base: 8, closed: false},
  tisch:     {wt: 0,   tb: 3,   base: 0, closed: false},
  kiste:     {wt: 1.5, tb: 1,   base: 0, closed: false},
};
const WALLS = {N: 'Nord (oben)', E: 'Ost (rechts)', S: 'Süd (unten)', W: 'West (links)'};
const HOST_TYPES = ['schrank', 'regal', 'rollwagen', 'tisch'];

/* ---------- Zustand ---------- */
let uidN = 1;
const uid = () => 'o' + (uidN++) + Math.random().toString(36).slice(2, 5);
const clone = o => JSON.parse(JSON.stringify(o));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function makeCells(it) {
  const old = it.cells || [];
  it.cells = [];
  for (let f = 0; f < it.fields; f++) {
    it.cells.push([]);
    for (let l = 0; l < it.levels; l++) {
      let c = (old[f] && old[f][l]) || {};
      if (!Array.isArray(c.c)) { // altes Format {t, kg}
        c = {max: c.max == null ? null : c.max, c: (c.t || +c.kg) ? [{n: c.t || '', q: 1, kg: +c.kg || 0}] : []};
      }
      it.cells[f].push(c);
    }
  }
}
function newItem(type, over) {
  const T = TYPES[type];
  const it = Object.assign({id: uid(), type, name: T.label, x: 100, y: 100, w: T.w, d: T.d, h: T.h, rot: 0, color: T.color,
    fields: T.fields, levels: T.levels, maxFach: T.maxFach, maxFeld: T.maxFeld, empty: T.empty, doors: T.doors, clearance: T.clearance, parent: null, group: null, hidden: false, locked: false}, over || {});
  makeCells(it);
  return it;
}
function defaultState() {
  const s = {
    room: {w: 900, l: 600, h: 280, floorLimit: 500},
    door: {wall: 'S', offset: 160, width: 100, slide: 'start', clear: 80},
    pillars: [{id: uid(), x: 300, y: 250, w: 40, d: 40}, {id: uid(), x: 600, y: 250, w: 40, d: 40}],
    items: [], groups: [],
  };
  const gid = uid(); s.groups.push({id: gid, name: 'Schränke Nord', hidden: false});
  const A = (t, o) => { const it = newItem(t, o); s.items.push(it); return it; };
  const s1 = A('schrank', {name: 'Schrank 1', x: 50, y: 25, group: gid});
  A('schrank', {name: 'Schrank 2', x: 150, y: 25, group: gid});
  A('schrank', {name: 'Schrank 3', x: 250, y: 25, group: gid});
  A('rollwagen', {name: 'Rollwagen 1', x: 400, y: 25});
  A('rollwagen', {name: 'Rollwagen 2', x: 490, y: 25});
  const reg = A('regal', {name: 'Regal W', x: 30, y: 300, rot: 270});
  A('tisch', {name: 'Packtisch', x: 650, y: 190, rot: 180});
  const k1 = A('kiste', {name: 'Kiste Infusion', x: 880, y: 30, rot: 90});
  const k2 = A('kiste', {name: 'Kiste Schlauchmaterial', x: 880, y: 90, rot: 90});
  const k3 = A('kiste', {name: 'Kiste Verband', parent: {id: reg.id, f: 0, l: 1, x: 10, z: 8, rot: 0}});
  const k4 = A('kiste', {name: 'Kiste Schienen', parent: {id: reg.id, f: 1, l: 1, x: 20, z: 8, rot: 0}});
  s1.cells[0][4].c = [{n: 'Funkgeräte', q: 4, kg: 1.5}, {n: 'Ladeschalen', q: 2, kg: 3}];
  reg.cells[0][0].c = [{n: 'Zelt 6x6 m', q: 1, kg: 120}, {n: 'Heizgerät', q: 2, kg: 30}];
  k1.cells[0][0].c = [{n: 'Infusionslösung 500 ml', q: 12, kg: 0.6}];
  k2.cells[0][0].c = [{n: 'Infusionsbestecke', q: 40, kg: 0.05}];
  k3.cells[0][0].c = [{n: 'Verbandkasten groß', q: 3, kg: 2.5}, {n: 'Rettungsdecken', q: 20, kg: 0.06}];
  k4.cells[0][0].c = [{n: 'Vakuumschienen', q: 4, kg: 2.2}];
  return s;
}
function normalizeState(s) {
  s.room = Object.assign({w: 900, l: 600, h: 280, floorLimit: 500}, s.room);
  const od = s.door || {};
  s.door = Object.assign({wall: 'S', offset: 160, width: 100, slide: 'start', clear: 80}, od);
  if (od.hinge && !od.slide) s.door.slide = od.hinge;
  delete s.door.hinge;
  s.pillars = s.pillars || [];
  s.items = s.items || [];
  s.groups = s.groups || [];
  const gids = new Set(s.groups.map(g => g.id));
  s.door.locked = !!s.door.locked; s.pillars.forEach(p => { p.locked = !!p.locked; });
  s.items.forEach(i => { i.id = i.id || uid(); i.parent = i.parent || null; i.hidden = !!i.hidden; i.locked = !!i.locked; i.group = gids.has(i.group) ? i.group : null; if (i.type === 'kiste' || i.type === 'tisch') { i.fields = 1; i.levels = 1; } makeCells(i); });
  return s;
}
function loadState() {
  try { const s = JSON.parse(localStorage.getItem(LS_KEY)); if (s && s.room && s.items) return normalizeState(s); } catch (e) {}
  return null;
}
let S = loadState() || defaultState();
let sel = null;           // {kind:'item'|'pillar'|'door', id}
let selCell = null;       // {id, f, l} – aufgeklapptes Fach im Inspektor
let mode = '2d';
let solo = null;          // {type:'group'|'item', id} – nur diese anzeigen (nicht gespeichert)
let view = {x: -60, y: -60, w: 1020, h: 720};
const opt = {grid: 5, zones: true, dims: true, heat: false};
const openCells = new Set();
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
function toLocal(it, wx, wy) {
  const a = rad(it.rot), c = Math.cos(a), s = Math.sin(a), dx = wx - it.x, dy = wy - it.y;
  return [dx * c + dy * s, -dx * s + dy * c];
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
/* Schiebetür: Öffnung A–B in der Wand, Flügel läuft innen vor der Wand zur Seite "slide" */
const DOOR_H = 210, LEAF_T = 5, LEAF_GAP = 3;
function doorGeom() {
  const R = S.room, D = S.door, W = R.w, L = R.l;
  const defs = {N: [[0, 0], [1, 0], [0, 1], W], S: [[0, L], [1, 0], [0, -1], W], W: [[0, 0], [0, 1], [1, 0], L], E: [[W, 0], [0, 1], [-1, 0], L]};
  const [P0, u, n, len] = defs[D.wall];
  const at = (a, d) => [P0[0] + u[0] * a + n[0] * d, P0[1] + u[1] * a + n[1] * d];
  const a1 = D.slide === 'start' ? D.offset - D.width : D.offset + D.width, a2 = a1 + D.width;
  return {
    A: at(D.offset, 0), B: at(D.offset + D.width, 0), u, n, len, a1, a2,
    leaf: [at(a1, LEAF_GAP), at(a2, LEAF_GAP), at(a2, LEAF_GAP + LEAF_T), at(a1, LEAF_GAP + LEAF_T)],
    runway: [at(a1, 0), at(a2, 0), at(a2, LEAF_GAP + LEAF_T + 4), at(a1, LEAF_GAP + LEAF_T + 4)],
    zone: [at(D.offset, 0), at(D.offset + D.width, 0), at(D.offset + D.width, D.clear), at(D.offset, D.clear)],
    fits: a1 >= -0.5 && a2 <= len + 0.5,
  };
}

/* ---------- Fächer & Kisten ---------- */
const effDims = it => (it.parent && it.parent.rot === 90) ? [it.d, it.w] : [it.w, it.d];
/* Nutzraum eines Fachs im lokalen Koordinatensystem des Wirts (x rechts, z nach vorn, y hoch) */
function cellGeom(h, f, l) {
  const P = PROF[h.type] || PROF.schrank;
  if (h.type === 'tisch') return {x0: -h.w / 2, z0: -h.d / 2, iw: h.w, id: h.d, y: h.h, ch: 999};
  const fw = h.w / h.fields, lh = (h.h - P.base) / h.levels;
  return {
    x0: -h.w / 2 + f * fw + P.wt, z0: -h.d / 2 + P.wt, iw: fw - 2 * P.wt, id: h.d - 2 * P.wt,
    y: P.base + l * lh + P.tb,
    ch: lh - P.tb - ((P.closed && l === h.levels - 1) ? P.tb : 0),
  };
}
function cellMax(it, c) { return c.max != null && c.max !== '' ? +c.max : it.maxFach; }
const cellOwn = c => c.c.reduce((s, r) => s + (+r.q || 0) * (+r.kg || 0), 0);
function unplace(it, h) {
  const p = it.parent; it.parent = null;
  if (h && p) { const g = cellGeom(h, p.f, p.l), w = toWorld(h, g.x0 + g.iw / 2, h.d / 2 + it.d / 2 + 10); it.x = r1(w[0]); it.y = r1(w[1]); it.rot = h.rot; }
  else { it.x = r1(S.room.w / 2); it.y = r1(S.room.l / 2); }
}
function fixParents() {
  S.items.forEach(it => {
    if (!it.parent) return;
    const h = findItem(it.parent.id);
    if (!h || it.type !== 'kiste' || !HOST_TYPES.includes(h.type) || h.parent) { unplace(it, h && !h.parent ? h : null); return; }
    it.parent.f = clamp(it.parent.f | 0, 0, h.fields - 1);
    it.parent.l = clamp(it.parent.l | 0, 0, h.levels - 1);
    it.parent.rot = it.parent.rot === 90 ? 90 : 0;
    it.parent.x = +it.parent.x || 0; it.parent.z = +it.parent.z || 0;
  });
}
function rectsOverlap(a, b) { // {x,z,w,d}
  return Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 0.5 && Math.min(a.z + a.d, b.z + b.d) - Math.max(a.z, b.z) > 0.5;
}
const prect = k => { const [w, d] = effDims(k); return {x: k.parent.x, z: k.parent.z, w, d}; };
function siblings(it) { return S.items.filter(k => k !== it && k.parent && k.parent.id === it.parent.id && k.parent.f === it.parent.f && k.parent.l === it.parent.l); }
function autoPlace(it) {
  const p = it.parent, h = findItem(p.id), g = cellGeom(h, p.f, p.l), [ew, ed] = effDims(it);
  p.z = Math.max(0, r1((g.id - ed) / 2));
  const others = siblings(it).map(prect);
  for (let x = 0; x <= g.iw - ew + 0.01; x += 1) { p.x = x; if (!others.some(o => rectsOverlap(o, prect(it)))) return; }
  p.x = 0;
}
/* Kiste in Fach setzen. lx/lz = gewünschter Mittelpunkt im Host-Koordinatensystem; lz == null: freie Tiefe automatisch wählen */
function placeInCell(k, h, f, l, lx, lz, rot, noSnap) {
  const g = cellGeom(h, f, l), same = k.parent && k.parent.id === h.id && k.parent.f === f && k.parent.l === l;
  let [ew, ed] = rot === 90 ? [k.d, k.w] : [k.w, k.d];
  if (lz == null && !same && (ew > g.iw + 0.5 || ed > g.id + 0.5) && ed <= g.iw + 0.5 && ew <= g.id + 0.5) { rot = 90; [ew, ed] = [ed, ew]; }
  const step = noSnap ? 0.5 : (opt.grid || 1);
  const others = S.items.filter(s => s !== k && s.parent && s.parent.id === h.id && s.parent.f === f && s.parent.l === l).map(prect);
  const fix = (v, size, max, edges) => {
    v = clamp(v, 0, Math.max(0, max - size));
    if (!noSnap) { let b = null; [0, max - size, ...edges].forEach(t => { const dl = t - v; if (Math.abs(dl) <= 3 && (b == null || Math.abs(dl) < Math.abs(b))) b = dl; }); v = b != null ? v + b : Math.round(v / step) * step; }
    return clamp(v, 0, Math.max(0, max - size));
  };
  const ex = [], ez = [];
  others.forEach(o => { ex.push(o.x + o.w, o.x - ew); ez.push(o.z + o.d, o.z - ed); });
  const x = r1(fix(lx - g.x0 - ew / 2, ew, g.iw, ex));
  let z;
  if (lz != null) z = r1(fix(lz - g.z0 - ed / 2, ed, g.id, ez));
  else {
    const cand = [...(same ? [k.parent.z] : []), (g.id - ed) / 2, 0, g.id - ed].map(v => clamp(r1(v), 0, Math.max(0, g.id - ed)));
    z = cand.find(zz => !others.some(o => rectsOverlap(o, {x, z: zz, w: ew, d: ed})));
    if (z == null) z = cand[0];
  }
  k.parent = {id: h.id, f, l, x, z, rot};
}
function cellLabel(h, f, l) { return `${h.name} · ${h.fields > 1 ? 'Feld ' + (f + 1) + ' · ' : ''}Ebene ${l + 1}`; }

/* ---------- Analyse ---------- */
function analyze() {
  fixParents();
  const R = S.room, out = {items: {}, issues: [], bad: new Set(), totals: {content: 0, total: 0, area: 0}};
  const add = (sev, id, msg) => out.issues.push({sev, id, msg});
  const kids = {};
  S.items.forEach(it => { if (it.parent) (kids[it.parent.id] = kids[it.parent.id] || []).push(it); });
  const calc = it => {
    const st = {cells: [], fieldSum: [], over: false, ratio: 0, content: 0, kids: kids[it.id] || []};
    it.cells.forEach((col, f) => {
      let sum = 0; st.cells.push([]);
      col.forEach((c, l) => {
        const own = cellOwn(c);
        const boxes = st.kids.filter(k => k.parent.f === f && k.parent.l === l).reduce((s, k) => s + out.items[k.id].total, 0);
        const load = own + boxes, mx = cellMax(it, c), ratio = mx > 0 ? load / mx : 0;
        st.cells[f].push({own, boxes, load, max: mx, ratio});
        sum += load; st.ratio = Math.max(st.ratio, ratio);
        if (load > mx + 1e-9) { st.over = true; add('err', it.id, `${it.name}: Fachlast überschritten (${it.fields > 1 ? 'Feld ' + (f + 1) + ', ' : ''}Ebene ${l + 1}: ${fmt(load)} / ${fmt(mx)} kg)`); }
      });
      st.fieldSum.push(sum); st.content += sum;
      if (it.maxFeld > 0) st.ratio = Math.max(st.ratio, sum / it.maxFeld);
      if (sum > it.maxFeld + 1e-9) { st.over = true; add('err', it.id, `${it.name}: Feldlast überschritten (${it.fields > 1 ? 'Feld ' + (f + 1) + ': ' : ''}${fmt(sum)} / ${fmt(it.maxFeld)} kg)`); }
    });
    st.total = st.content + (+it.empty || 0);
    out.items[it.id] = st;
  };
  S.items.filter(i => i.type === 'kiste').forEach(calc);
  S.items.filter(i => i.type !== 'kiste').forEach(calc);

  const top = S.items.filter(i => !i.parent);
  const polys = {}, fronts = {};
  top.forEach(it => {
    const st = out.items[it.id];
    polys[it.id] = footprint(it); fronts[it.id] = frontZone(it);
    st.pressure = st.total / ((it.w * it.d) / 1e4);
    if (R.floorLimit > 0 && st.pressure > R.floorLimit) add('warn', it.id, `${it.name}: Bodenbelastung ${Math.round(st.pressure)} kg/m² > ${R.floorLimit} kg/m²`);
    if (R.h > 0 && it.h > R.h) add('warn', it.id, `${it.name}: Höhe ${it.h} cm > Raumhöhe ${R.h} cm`);
    out.totals.content += st.content; out.totals.total += st.total; out.totals.area += it.w * it.d;
  });
  // Kisten in Fächern: Passung und Überschneidung
  S.items.filter(i => i.parent).forEach(k => {
    const h = findItem(k.parent.id), p = k.parent, g = cellGeom(h, p.f, p.l), [ew, ed] = effDims(k);
    const where = cellLabel(h, p.f, p.l);
    if (ew > g.iw + 0.5 || ed > g.id + 0.5) { add('warn', k.id, `${k.name} ist zu groß für das Fach (${where}: nutzbar ${fmt(g.iw)} × ${fmt(g.id)} cm)`); out.bad.add(k.id); }
    else if (p.x < -0.5 || p.z < -0.5 || p.x + ew > g.iw + 0.5 || p.z + ed > g.id + 0.5) { add('warn', k.id, `${k.name} ragt aus dem Fach (${where})`); out.bad.add(k.id); }
    if (k.h > g.ch + 0.5) { add('warn', k.id, `${k.name} ist zu hoch für das Fach (${where}: ${fmt(g.ch)} cm frei)`); out.bad.add(k.id); }
  });
  S.items.filter(i => i.parent).forEach(k => siblings(k).forEach(o => {
    if (S.items.indexOf(o) > S.items.indexOf(k) && rectsOverlap(prect(k), prect(o))) { add('err', k.id, `${k.name} überschneidet sich mit ${o.name} im Fach`); out.bad.add(k.id); out.bad.add(o.id); }
  }));

  const dg = doorGeom();
  const pil = S.pillars.map(pillarPoly);
  top.forEach((it, i) => {
    const bb = bbox(polys[it.id]);
    if (bb.minX < -0.5 || bb.minY < -0.5 || bb.maxX > R.w + 0.5 || bb.maxY > R.l + 0.5) { add('err', it.id, `${it.name}: ragt über die Raumwand hinaus`); out.bad.add(it.id); }
    for (let j = i + 1; j < top.length; j++) {
      const o = top[j];
      if (sat(polys[it.id], polys[o.id], 0.5)) { add('err', it.id, `${it.name} überschneidet sich mit ${o.name}`); out.bad.add(it.id); out.bad.add(o.id); }
    }
    S.pillars.forEach((p, k) => {
      if (sat(polys[it.id], pil[k], 0.5)) { add('err', it.id, `${it.name} kollidiert mit Stützpfeiler`); out.bad.add(it.id); }
    });
    if (sat(polys[it.id], dg.zone, 0.5)) add('warn', it.id, `${it.name} versperrt den Durchgang an der Tür`);
    if (sat(polys[it.id], dg.runway, 0.5)) add('warn', it.id, `${it.name} steht im Laufweg der Schiebetür`);
    const fz = fronts[it.id];
    if (fz) {
      let hit = null;
      top.forEach(o => { if (o !== it && !hit && sat(fz, polys[o.id], 0.5)) hit = o.name; });
      S.pillars.forEach((p, k) => { if (!hit && sat(fz, pil[k], 0.5)) hit = 'Stützpfeiler'; });
      if (hit) { add('warn', it.id, `${it.name}: Freiraum/Türbereich vorne blockiert durch ${hit}`); out.items[it.id].frontBlocked = true; }
    }
  });
  if (!dg.fits) add('warn', null, 'Schiebetür: neben der Türöffnung ist zu wenig Wand für den geöffneten Flügel.');
  const rArea = R.w * R.l;
  out.totals.rArea = rArea; out.totals.free = rArea ? 1 - out.totals.area / rArea : 0;
  return out;
}

/* ---------- Hilfen ---------- */
const $ = s => document.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const r1 = n => Math.round(n * 10) / 10;
const fmt = n => (Math.round(n * 100) / 100).toLocaleString('de-DE', {maximumFractionDigits: 2});
const findItem = id => S.items.find(i => i.id === id);
function findSel() {
  if (!sel) return null;
  if (sel.kind === 'item') return findItem(sel.id);
  if (sel.kind === 'pillar') return S.pillars.find(p => p.id === sel.id);
  if (sel.kind === 'door') return S.door;
  return null;
}
function ratioClass(r) { return r > 1 ? 'err' : r > 0.85 ? 'warn' : ''; }
const topOf = it => it.parent ? findItem(it.parent.id) : it;
const grpOf = id => S.groups.find(g => g.id === id);
function isHidden(it) {
  const t = topOf(it) || it;
  if (solo) return solo.type === 'group' ? t.group !== solo.id : t.id !== solo.id;
  return !!(t.hidden || (t.group && grpOf(t.group) && grpOf(t.group).hidden));
}
function isLocked(o, kind) { return kind === 'door' ? !!S.door.locked : !!(o && o.locked); }
const IC = (p, w) => `<svg viewBox="0 0 24 24" width="${w || 16}" height="${w || 16}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
const ICONS = {
  eye: IC('<path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/>'),
  eyeoff: IC('<path d="M17.94 17.94A10.9 10.9 0 0 1 12 19C5 19 1 12 1 12a18.5 18.5 0 0 1 5.06-5.94M9.9 4.24A9.1 9.1 0 0 1 12 5c7 0 11 7 11 7a18.5 18.5 0 0 1-2.16 3.19M1 1l22 22"/>'),
  lock: IC('<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>'),
  unlock: IC('<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.5-2"/>'),
  solo: IC('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3"/>'),
  shelf: IC('<rect x="3" y="3" width="18" height="18" rx="1"/><path d="M3 9h18M3 15h18"/>'),
  plus: IC('<path d="M12 5v14M5 12h14"/>'),
  x: IC('<path d="M6 6l12 12M18 6L6 18"/>'),
};
function nextGroupName() { let n = 1; const names = new Set(S.groups.map(g => g.name)); while (names.has('Gruppe ' + n)) n++; return 'Gruppe ' + n; }

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
    else if (d.type === 'check') inp = `<input type="checkbox" data-b="${id}">`;
    else inp = `<input type="number" data-b="${id}" ${d.min != null ? `min="${d.min}"` : ''} ${d.max != null ? `max="${d.max}"` : ''} step="${d.step || 1}">`;
    if (d.disabled) inp = inp.replace('data-b=', 'disabled data-b=');
    return `<div class="row"><label>${esc(d.label)}${d.unit ? ` <span class="u">(${d.unit})</span>` : ''}</label>${inp}</div>`;
  }).join('');
}
function syncForms() {
  document.querySelectorAll('[data-b]').forEach(el => {
    const d = B[el.dataset.b]; if (!d) return;
    if (d.type === 'check') { el.checked = !!d.get(); return; }
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
  if (d.type === 'check') v = el.checked;
  else if (d.type === 'number' || !d.type) {
    if (v === '' && d.nullable) v = null;
    else {
      v = parseFloat(v);
      if (isNaN(v)) { syncForms(); return; }
      if (d.min != null) v = Math.max(d.min, v);
      if (d.max != null) v = Math.min(d.max, v);
    }
  }
  d.set(v); commit(); refresh({rebuild: !!d.rebuild, room: !!d.room});
});
document.addEventListener('toggle', e => {
  const d = e.target; if (!d.dataset || !d.dataset.cell) return;
  const key = d.dataset.cell;
  if (d.open) { openCells.add(key); const [id, f, l] = key.split(':'); selCell = {id, f: +f, l: +l}; } else { openCells.delete(key); if (selCell && key === `${selCell.id}:${selCell.f}:${selCell.l}`) selCell = null; }
  if (mode === '3d') render3D();
}, true);

/* ---------- Auswahl, Hinzufügen, Löschen ---------- */
function select(s) { sel = s; selCell = null; refresh({rebuild: true}); }
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
  const src = findItem(sel.id), c = clone(src); c.id = uid(); c.name += ' (Kopie)'; c.locked = false;
  if (c.parent) { S.items.push(c); autoPlace(c); } else { c.x += 20; c.y += 20; S.items.push(c); }
  sel = {kind: 'item', id: c.id}; commit(); refresh({rebuild: true});
}
function delSel() {
  if (!sel) return;
  const cur = findSel(); if (cur && isLocked(cur, sel.kind)) return;
  if (sel.kind === 'item') {
    const h = findItem(sel.id);
    S.items.filter(k => k.parent && k.parent.id === sel.id).forEach(k => unplace(k, h));
    S.items = S.items.filter(i => i.id !== sel.id);
  } else if (sel.kind === 'pillar') S.pillars = S.pillars.filter(p => p.id !== sel.id);
  else return;
  sel = null; commit(); refresh({rebuild: true, room: true});
}
function addPillar() {
  const p = {id: uid(), x: Math.round(S.room.w / 2 - 20), y: Math.round(S.room.l / 2 - 20), w: 40, d: 40};
  S.pillars.push(p); sel = {kind: 'pillar', id: p.id}; commit(); refresh({rebuild: true, room: true});
}
function rotSel() {
  const o = findSel(); if (!o || sel.kind !== 'item' || o.locked) return;
  if (o.parent) { o.parent.rot = o.parent.rot === 90 ? 0 : 90; autoFit(o); } else o.rot = (o.rot + 90) % 360;
  commit(); refresh({});
}
function autoFit(k) { // Position im Fach nach Drehung wieder in den Nutzraum schieben
  const h = findItem(k.parent.id), g = cellGeom(h, k.parent.f, k.parent.l), [ew, ed] = effDims(k);
  k.parent.x = clamp(k.parent.x, 0, Math.max(0, g.iw - ew)); k.parent.z = clamp(k.parent.z, 0, Math.max(0, g.id - ed));
}
function setLocation(it, v) {
  if (v === 'floor') { if (it.parent) { const h = findItem(it.parent.id); unplace(it, h); } return; }
  const [id, f, l] = v.split('|');
  it.parent = {id, f: +f, l: +l, x: 0, z: 0, rot: it.parent ? it.parent.rot : 0};
  autoPlace(it);
}

/* ---------- Raum-Tab ---------- */
const num = (label, get, set, x) => Object.assign({label, type: 'number', get, set}, x);
function doorDefs() {
  const lk = !!S.door.locked;
  return [
    {label: 'Tür fixiert', type: 'check', get: () => !!S.door.locked, set: v => { S.door.locked = v; }, rebuild: true},
    {label: 'Wand', type: 'select', disabled: lk, options: Object.entries(WALLS), get: () => S.door.wall, set: v => { S.door.wall = v; }},
    num('Abstand vom Wandanfang', () => S.door.offset, v => { S.door.offset = v; }, {unit: 'cm', min: 0, step: 5, disabled: lk}),
    num('Breite der Öffnung', () => S.door.width, v => { S.door.width = v; }, {unit: 'cm', min: 50, step: 5}),
    {label: 'Flügel schiebt sich', type: 'select', options: [['start', 'zum Wandanfang'], ['end', 'zum Wandende']], get: () => S.door.slide, set: v => { S.door.slide = v; }},
    num('Durchgang freihalten', () => S.door.clear, v => { S.door.clear = v; }, {unit: 'cm', min: 0, step: 10}),
  ];
}
function buildRoomTab() {
  $('#tab-room').innerHTML = formHTML([
    {h3: 'Raummaße (Innenmaß)'},
    num('Breite (links–rechts)', () => S.room.w, v => { S.room.w = v; }, {unit: 'cm', min: 100, step: 5, room: true}),
    num('Länge (oben–unten)', () => S.room.l, v => { S.room.l = v; }, {unit: 'cm', min: 100, step: 5, room: true}),
    num('Raumhöhe', () => S.room.h, v => { S.room.h = v; }, {unit: 'cm', min: 0, step: 5}),
    num('Zul. Bodenlast', () => S.room.floorLimit, v => { S.room.floorLimit = v; }, {unit: 'kg/m²', min: 0, step: 50}),
    {h3: 'Schiebetür'},
    ...doorDefs(),
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
    <h3>Im Raum</h3><div class="btns"><button class="small" data-act="gnew">+ Gruppe</button><button class="small" data-act="showall">Alle anzeigen</button></div>
    <div id="objList"></div>`;
}
let objIds = [];
function groupItems(g) { return S.items.filter(i => !i.parent && i.group === g.id); }
function renderObjList() {
  const el = $('#objList'); if (!el) return;
  objIds.forEach(id => delete B[id]); objIds = [];
  const row = (it, sub) => {
    const st = ST.items[it.id], bad = ST.bad.has(it.id), off = isHidden(it);
    const cls = st.over || bad ? 'err' : (st.frontBlocked ? 'warn' : '');
    const where = sub ? `<small>${esc(cellLabel(findItem(it.parent.id), it.parent.f, it.parent.l).split(' · ').slice(1).join(' · '))}</small>` : '';
    return `<div class="li ${sel && sel.id === it.id ? 'sel' : ''} ${off ? 'off' : ''}" style="${sub ? 'margin-left:16px' : ''}" data-sel="item:${it.id}"><span class="sw" style="background:${it.color}"></span>
      <span class="nm">${esc(it.name)}</span>${where}<span class="chip ${cls}">${fmt(st.content)} kg</span>
      ${sub ? '' : `<button class="ib" data-act="ivis" data-id="${it.id}" title="${it.hidden ? 'Einblenden' : 'Ausblenden'}">${it.hidden ? ICONS.eyeoff : ICONS.eye}</button>`}
      <button class="ib ${it.locked ? 'on' : ''}" data-act="ilock" data-id="${it.id}" title="${it.locked ? 'Fixierung lösen' : 'Position fixieren'}">${it.locked ? ICONS.lock : ICONS.unlock}</button></div>`;
  };
  const block = it => row(it, false) + ST.items[it.id].kids.map(k => row(k, true)).join('');
  let h = '';
  S.groups.forEach(g => {
    const mem = groupItems(g), kg = mem.reduce((s, i) => s + ST.items[i.id].total, 0), id = 'b' + (++bn);
    B[id] = {type: 'text', get: () => g.name, set: v => { g.name = v || g.name; }}; objIds.push(id);
    h += `<div class="gh ${g.hidden ? 'off' : ''}"><button class="ib" data-act="gvis" data-g="${g.id}" title="${g.hidden ? 'Gruppe einblenden' : 'Gruppe ausblenden'}">${g.hidden ? ICONS.eyeoff : ICONS.eye}</button>
      <input type="text" data-b="${id}" title="Gruppenname">
      <button class="ib ${solo && solo.type === 'group' && solo.id === g.id ? 'on' : ''}" data-act="gsolo" data-g="${g.id}" title="Nur diese Gruppe anzeigen">${ICONS.solo}</button>
      <button class="ib" data-act="gshelf" data-g="${g.id}" title="Gruppe in der Regalansicht öffnen">${ICONS.shelf}</button>
      <button class="ib" data-act="gadd" data-g="${g.id}" title="Gewähltes Objekt zur Gruppe hinzufügen">${ICONS.plus}</button>
      <button class="ib" data-act="gdel" data-g="${g.id}" title="Gruppe auflösen">${ICONS.x}</button></div>
      <div class="gsum">${mem.length} Objekt${mem.length === 1 ? '' : 'e'} · ${fmt(kg)} kg</div><div class="list" style="margin-top:4px">${mem.map(block).join('') || '<div class="muted" style="font-size:12px">Leer – Objekt wählen und „+“ klicken.</div>'}</div>`;
  });
  const free = S.items.filter(i => !i.parent && !i.group);
  if (S.groups.length && free.length) h += `<div class="gh"><b style="padding:3px 4px">Ohne Gruppe</b></div>`;
  h += `<div class="list" style="margin-top:4px">${free.map(block).join('') || (S.groups.length ? '' : '<div class="muted">Noch keine Objekte.</div>')}</div>`;
  el.innerHTML = h;
}

/* ---------- Übersicht ---------- */
function contentRows(it, f, l) { return it.cells[f][l].c.filter(r => r.n || +r.kg || +r.q); }
function reportHTML() {
  const T = ST.totals;
  let h = '';
  if (S.groups.length) h += '<div class="kv">' + S.groups.map(g => { const m = groupItems(g); return `<span>${esc(g.name)} (${m.length})</span><b>${fmt(m.reduce((a, i) => a + ST.items[i.id].total, 0))} kg</b>`; }).join('') + '</div>';
  h += `<div class="kv"><span>Raumfläche</span><b>${fmt(T.rArea / 1e4)} m²</b><span>Belegte Stellfläche</span><b>${fmt(T.area / 1e4)} m² (${Math.round((1 - T.free) * 100)} %)</b><span>Lagergut gesamt</span><b>${fmt(T.content)} kg</b><span>Gesamtgewicht inkl. Möbel</span><b>${fmt(T.total)} kg</b></div>`;
  S.items.forEach(it => {
    const st = ST.items[it.id], rows = [];
    it.cells.forEach((col, f) => col.forEach((c, l) => {
      contentRows(it, f, l).forEach(r => rows.push(`<tr><td>${f + 1}</td><td>${l + 1}</td><td>${esc(r.n)}</td><td class="n">${fmt(+r.q || 0)}</td><td class="n">${fmt(+r.kg || 0)}</td><td class="n">${fmt((+r.q || 0) * (+r.kg || 0))}</td></tr>`));
      st.kids.filter(k => k.parent.f === f && k.parent.l === l).forEach(k => rows.push(`<tr><td>${f + 1}</td><td>${l + 1}</td><td>▣ ${esc(k.name)} (Kiste)</td><td class="n">1</td><td class="n">${fmt(ST.items[k.id].total)}</td><td class="n">${fmt(ST.items[k.id].total)}</td></tr>`));
    }));
    const loc = it.parent ? ` · in ${esc(cellLabel(findItem(it.parent.id), it.parent.f, it.parent.l))}` : '';
    h += `<h2 style="font-size:13px;margin:10px 0 2px">${esc(it.name)} <small class="muted">${esc(TYPES[it.type].label)}${loc} · ${it.w}×${it.d}×${it.h} cm · ${fmt(st.content)} kg</small></h2>`;
    if (rows.length) h += `<table class="rep"><tr><th>Feld</th><th>Ebene</th><th>Bezeichnung</th><th>Menge</th><th>kg/Stk</th><th>kg</th></tr>${rows.join('')}</table>`;
    else h += '<div class="muted" style="font-size:12px">Keine Belegung eingetragen.</div>';
  });
  return h;
}
function renderReport() {
  const iss = ST.issues;
  $('#tab-report').innerHTML = `<h3>Prüfung</h3>` + (iss.length ? iss.map(i => `<div class="issue ${i.sev}" ${i.id ? `data-sel="item:${i.id}"` : ''}>${esc(i.msg)}</div>`).join('') : '<div class="ok">✓ Keine Probleme gefunden.</div>') +
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
function locOptions() {
  const o = [['floor', 'Boden (frei im Raum)']];
  S.items.filter(h => HOST_TYPES.includes(h.type) && !h.parent).forEach(h => h.cells.forEach((col, f) => col.forEach((c, l) => o.push([`${h.id}|${f}|${l}`, cellLabel(h, f, l)]))));
  return o;
}
function cellBlock(it, f, l) {
  const c = it.cells[f][l], key = `${it.id}:${f}:${l}`, tag = `${f}_${l}`;
  const kids = ST.items[it.id].kids.filter(k => k.parent.f === f && k.parent.l === l);
  OUT['cs' + tag] = () => { const s = ST.items[it.id].cells[f][l]; return `<span class="chip ${ratioClass(s.ratio)}">${fmt(s.load)} / ${fmt(s.max)} kg</span>`; };
  BAR['cb' + tag] = () => ST.items[it.id].cells[f][l].ratio;
  let rows = '';
  c.c.forEach((r, i) => {
    const iN = 'b' + (++bn), iQ = 'b' + (++bn), iK = 'b' + (++bn);
    B[iN] = {type: 'text', get: () => r.n, set: v => { r.n = v; }};
    B[iQ] = {type: 'number', get: () => r.q, set: v => { r.q = Math.max(0, v); }};
    B[iK] = {type: 'number', get: () => r.kg, set: v => { r.kg = Math.max(0, v); }};
    OUT[`rt${tag}_${i}`] = () => fmt((+r.q || 0) * (+r.kg || 0)) + ' kg';
    rows += `<div class="crow"><input type="text" placeholder="Bezeichnung" data-b="${iN}"><button class="small danger" data-act="delc" data-c="${key}:${i}" title="Eintrag löschen">✕</button></div>
      <div class="crow2"><input type="number" min="0" step="1" title="Menge" data-b="${iQ}"><span>Stk ×</span><input type="number" min="0" step="0.05" title="Gewicht je Stück (kg)" data-b="${iK}"><span>kg =</span><b data-o="rt${tag}_${i}"></b></div>`;
  });
  const iM = 'b' + (++bn);
  B[iM] = {type: 'number', nullable: true, min: 0, get: () => c.max == null ? '' : c.max, set: v => { c.max = v; }};
  const title = `${it.fields > 1 ? 'Feld ' + (f + 1) + ' · ' : ''}Ebene ${l + 1}`;
  return `<details class="cd" data-cell="${key}" ${openCells.has(key) ? 'open' : ''}><summary><span>${title}</span><span data-o="cs${tag}"></span></summary>
    <div class="bar" data-bar="cb${tag}"><i></i></div>
    ${rows || '<div class="muted" style="font-size:12px;margin:4px 0">Noch kein Inhalt.</div>'}
    <div class="btns"><button class="small" data-act="addc" data-c="${key}">+ Inhalt</button></div>
    <div class="row"><label>Eigene Fachlast <span class="u">(kg)</span></label><input type="number" min="0" step="5" placeholder="Standard ${it.maxFach}" data-b="${iM}"></div>
    ${kids.length ? `<div class="muted" style="font-size:12px">Kisten in diesem Fach:</div>` + kids.map(k => `<div class="li" data-sel="item:${k.id}"><span class="sw" style="background:${k.color}"></span><span class="nm">${esc(k.name)}</span><span class="chip">${fmt(ST.items[k.id].total)} kg</span></div>`).join('') : ''}
  </details>`;
}
function buildInspector() {
  const el = $('#right'); OUT = {}; BAR = {};
  const o = findSel();
  if (!o) {
    el.innerHTML = `<div class="pad"><h3>Eigenschaften</h3><p class="muted">Ein Objekt im Plan oder in der Liste anklicken, um Position, Maße, Fach- und Feldlasten und den Inhalt zu bearbeiten.</p>
      <p class="muted">Neue Objekte über den Reiter <b>Objekte</b> hinzufügen. Kisten lassen sich in der 3D-Ansicht in Fächer ziehen oder bei der Kiste unter „Standort“ wählen.</p></div>`;
    return;
  }
  if (sel.kind === 'door') {
    el.innerHTML = `<div class="pad">${formHTML([{h3: 'Schiebetür'}, ...doorDefs()])}</div>`;
    syncForms(); return;
  }
  if (sel.kind === 'pillar') {
    el.innerHTML = `<div class="pad">${formHTML([{h3: 'Stützpfeiler'},
      {label: 'Position fixiert', type: 'check', get: () => !!o.locked, set: v => { o.locked = v; }, rebuild: true},
      num('Abstand links', () => o.x, v => { o.x = v; }, {unit: 'cm', step: 5, disabled: !!o.locked}),
      num('Abstand oben', () => o.y, v => { o.y = v; }, {unit: 'cm', step: 5, disabled: !!o.locked}),
      num('Breite', () => o.w, v => { o.w = v; }, {unit: 'cm', min: 5, step: 5}),
      num('Tiefe', () => o.d, v => { o.d = v; }, {unit: 'cm', min: 5, step: 5}),
    ])}<div class="btns"><button class="danger" data-act="del" ${o.locked ? 'disabled' : ''}>Löschen</button></div></div>`;
    syncForms(); return;
  }
  const it = o, T = TYPES[it.type], placed = !!it.parent, lk = !!it.locked;
  const setEdge = (axis, v) => { const bb = bboxOf(it); if (axis === 'x') it.x += v - bb.minX; else it.y += v - bb.minY; };
  const defs = [
    {h3: T.label},
    {label: 'Bezeichnung', type: 'text', get: () => it.name, set: v => { it.name = v; }},
    {label: 'Farbe', type: 'color', get: () => it.color, set: v => { it.color = v; }},
    {label: 'Position fixiert', type: 'check', get: () => it.locked, set: v => { it.locked = v; }, rebuild: true},
  ];
  if (!placed) {
    defs.push({label: 'Gruppe', type: 'select', options: [['', 'Keine'], ...S.groups.map(g => [g.id, g.name])], get: () => it.group || '', set: v => { it.group = v || null; }},
      {label: 'Im Plan anzeigen', type: 'check', get: () => !it.hidden, set: v => { it.hidden = !v; }});
  }
  if (it.type === 'kiste') {
    defs.push({h3: 'Standort'},
      {label: 'Standort', type: 'select', options: locOptions(), rebuild: true, disabled: lk,
        get: () => placed ? `${it.parent.id}|${it.parent.f}|${it.parent.l}` : 'floor', set: v => setLocation(it, v)});
  }
  if (placed) {
    const g = () => { const h = findItem(it.parent.id); return cellGeom(h, it.parent.f, it.parent.l); };
    defs.push(
      num('Abstand von links im Fach', () => r1(it.parent.x), v => { it.parent.x = v; }, {unit: 'cm', step: 1, disabled: lk}),
      num('Abstand von hinten im Fach', () => r1(it.parent.z), v => { it.parent.z = v; }, {unit: 'cm', step: 1, disabled: lk}),
      {label: 'Ausrichtung', type: 'select', disabled: lk, options: [[0, 'längs (Breite = links–rechts)'], [90, 'quer gedreht']], get: () => it.parent.rot, set: v => { it.parent.rot = +v; autoFit(it); }, rebuild: true},
      {html: `<div class="muted" style="font-size:12px">Nutzraum im Fach: <b data-o="cg"></b></div>`});
    OUT.cg = () => { const q = g(); return `${fmt(q.iw)} × ${fmt(q.id)} × ${q.ch > 900 ? '∞' : fmt(q.ch)} cm`; };
  } else {
    defs.push({h3: 'Position'},
      num('Abstand zur linken Wand', () => r1(bboxOf(it).minX), v => setEdge('x', v), {unit: 'cm', step: 1, disabled: lk}),
      num('Abstand zur oberen Wand', () => r1(bboxOf(it).minY), v => setEdge('y', v), {unit: 'cm', step: 1, disabled: lk}),
      num('Drehung', () => it.rot, v => { it.rot = ((v % 360) + 360) % 360; }, {unit: '°', step: 15, disabled: lk}),
      {html: `<div class="muted" style="font-size:12px">Abstand rechts <b data-o="r"></b> · unten <b data-o="b"></b> (Front = dicke Kante)</div>`});
    OUT.r = () => fmt(S.room.w - bboxOf(it).maxX) + ' cm';
    OUT.b = () => fmt(S.room.l - bboxOf(it).maxY) + ' cm';
  }
  defs.push({html: `<div class="btns"><button data-act="rot" ${lk ? 'disabled' : ''}>⟳ 90° drehen</button>${placed ? '' : '<button data-act="isolo">Nur dieses anzeigen</button>'}${(HOST_TYPES.includes(it.type) || placed) ? '<button data-act="shelf">Regalansicht</button>' : ''}</div>`},
    {h3: 'Maße'},
    num('Breite', () => it.w, v => { it.w = v; }, {unit: 'cm', min: 5, step: 5}),
    num('Tiefe', () => it.d, v => { it.d = v; }, {unit: 'cm', min: 5, step: 5}),
    num('Höhe', () => it.h, v => { it.h = v; }, {unit: 'cm', min: 5, step: 5}));
  if (!placed) {
    if (it.type === 'schrank') defs.push({label: 'Flügeltüren', type: 'select', options: [[2, '2 Türen'], [1, '1 Tür']], get: () => it.doors, set: v => { it.doors = +v; }});
    else defs.push(num('Freiraum vorne', () => it.clearance, v => { it.clearance = v; }, {unit: 'cm', min: 0, step: 5}));
  }
  defs.push({h3: 'Aufbau & Lastgrenzen'});
  if (HOST_TYPES.includes(it.type) && it.type !== 'tisch') {
    defs.push(
      num('Felder (nebeneinander)', () => it.fields, v => { it.fields = Math.round(v); makeCells(it); }, {min: 1, max: 8, rebuild: true}),
      num('Ebenen/Fächer je Feld', () => it.levels, v => { it.levels = Math.round(v); makeCells(it); }, {min: 1, max: 12, rebuild: true}));
  }
  const isBox = it.type === 'kiste' || it.type === 'tisch';
  defs.push(
    num(isBox ? 'Max. Beladung' : 'Fachlast max.', () => it.maxFach, v => { it.maxFach = v; if (isBox) it.maxFeld = v; }, {unit: 'kg', min: 0, step: 5}),
    ...(isBox ? [] : [num('Feldlast max.', () => it.maxFeld, v => { it.maxFeld = v; }, {unit: 'kg', min: 0, step: 10})]),
    num('Eigengewicht', () => it.empty, v => { it.empty = v; }, {unit: 'kg', min: 0, step: 1}),
    {html: `<div class="kv"><span>Gewicht gesamt</span><b data-o="tot"></b>${placed ? '' : '<span>Bodenbelastung</span><b data-o="pr"></b>'}</div>`});
  OUT.tot = () => fmt(ST.items[it.id].total) + ' kg';
  OUT.pr = () => { const p = ST.items[it.id].pressure || 0; return `<span class="${p > S.room.floorLimit && S.room.floorLimit ? 'chip err' : ''}">${fmt(p)} kg/m²</span>`; };
  defs.push({h3: 'Inhalt (Bezeichnung · Menge · Gewicht)'});
  let cells = `<div class="cells">`;
  for (let l = it.levels - 1; l >= 0; l--) for (let f = 0; f < it.fields; f++) cells += cellBlock(it, f, l);
  cells += `</div><div id="fsums" data-o="fsums"></div>`;
  OUT.fsums = () => ST.items[it.id].fieldSum.length > 1 ? ST.items[it.id].fieldSum.map((s, f) => `<div class="fieldsum">Feld ${f + 1}: <b class="${s > it.maxFeld ? 'chip err' : ''}">${fmt(s)} / ${fmt(it.maxFeld)} kg</b> Feldlast</div>`).join('') : '';
  defs.push({html: cells});
  el.innerHTML = `<div class="pad">${formHTML(defs)}<div class="btns"><button data-act="dup">Duplizieren</button><button class="danger" data-act="del" ${lk ? 'disabled' : ''}>Löschen</button></div></div>`;
  syncForms();
}

/* ---------- Plan zeichnen (2D) ---------- */
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
  g += `<line class="front" x1="${-hw}" y1="${hd}" x2="${hw}" y2="${hd}"/>`;
  if (it.locked) g += `<g transform="translate(${-hw + 3} ${-hd + 3})"><rect y="4" width="8" height="6" rx="1" fill="#222"/><path d="M1.6 4V2.6a2.4 2.4 0 0 1 4.8 0V4" fill="none" stroke="#222" stroke-width="1.1"/></g>`;
  g += '</g>';
  // Beschriftung: läuft entlang der Breite, bleibt aber lesbar (nie auf dem Kopf)
  let r = ((it.rot % 180) + 180) % 180; if (r > 90) r -= 180;
  const fs = Math.max(4.5, Math.min(11, (w * 0.92) / (Math.max(it.name.length, 8) * 0.55)));
  const nk = st.kids.length;
  const l2 = `${fmt(st.content)} / ${fmt(it.fields * Math.min(it.levels * it.maxFach, it.maxFeld))} kg${nk ? ` · ${nk}▣` : ''}`;
  g += `<g transform="translate(${r1(it.x)} ${r1(it.y)}) rotate(${r})"><text class="lbl" y="${r1(-fs * 0.45)}" font-size="${r1(fs)}">${esc(it.name)}</text><text class="lbl l2" y="${r1(fs * 0.75)}" font-size="${r1(fs * 0.8)}">${esc(l2)}</text></g>`;
  return g;
}
const polyPts = p => p.map(q => r1(q[0]) + ',' + r1(q[1])).join(' ');
function zonesSVG() {
  let z = '';
  if (!opt.zones) return z;
  const dg = doorGeom();
  z += `<polygon class="zone ${ST.issues.some(i => i.msg.endsWith('Durchgang an der Tür')) ? 'bad' : ''}" points="${polyPts(dg.zone)}"/>`;
  S.items.filter(i => !i.parent && !isHidden(i)).forEach(it => {
    const fz = frontZone(it); if (!fz) return;
    const blocked = ST.items[it.id].frontBlocked;
    if (it.type === 'schrank') z += `<path class="zone ${blocked ? 'bad' : ''}" transform="translate(${r1(it.x)} ${r1(it.y)}) rotate(${it.rot})" d="${arcPath(it)}"/>`;
    else z += `<polygon class="zone ${blocked ? 'bad' : ''}" points="${polyPts(fz)}"/>`;
  });
  return z;
}
function groupsSVG() {
  let s = '';
  S.groups.forEach(g => {
    const mem = groupItems(g).filter(i => !isHidden(i)); if (!mem.length) return;
    const bs = mem.map(bboxOf), x0 = Math.min(...bs.map(b => b.minX)) - 6, y0 = Math.min(...bs.map(b => b.minY)) - 6, x1 = Math.max(...bs.map(b => b.maxX)) + 6, y1 = Math.max(...bs.map(b => b.maxY)) + 6;
    s += `<rect class="grp" x="${r1(x0)}" y="${r1(y0)}" width="${r1(x1 - x0)}" height="${r1(y1 - y0)}" rx="6"/><text class="grpt" x="${r1(x0 + 4)}" y="${r1(y0 - 4)}">${esc(g.name)}</text>`;
  });
  return s;
}
function selBB() {
  const o = findSel(); if (!o || sel.kind === 'door' || (sel.kind === 'item' && isHidden(o))) return null;
  if (sel.kind === 'item') return bboxOf(o.parent ? topOf(o) : o);
  return bbox(pillarPoly(o));
}
function dimsSVG() {
  const bb = selBB(); if (!bb || !opt.dims) return '';
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
  h += groupsSVG();
  h += zonesSVG();
  S.pillars.forEach(p => h += `<rect class="pillar" data-kind="pillar" data-id="${p.id}" x="${p.x}" y="${p.y}" width="${p.w}" height="${p.d}"/>`);
  S.items.filter(i => !i.parent && !isHidden(i)).forEach(it => h += itemSVG(it));
  h += `<rect class="wall" x="-6" y="-6" width="${R.w + 12}" height="${R.l + 12}"/>`;
  h += `<line class="doorgap" x1="${dg.A[0]}" y1="${dg.A[1]}" x2="${dg.B[0]}" y2="${dg.B[1]}"/>`;
  h += `<line class="doorclosed" x1="${dg.A[0]}" y1="${dg.A[1]}" x2="${dg.B[0]}" y2="${dg.B[1]}"/>`;
  h += `<polygon class="doorleaf" data-kind="door" data-id="door" points="${polyPts(dg.leaf)}"/>`;
  h += `<line data-kind="door" data-id="door" x1="${dg.A[0]}" y1="${dg.A[1]}" x2="${dg.B[0]}" y2="${dg.B[1]}" stroke="transparent" stroke-width="22"/>`;
  h += `<text class="roomdim" x="${R.w / 2}" y="-18">${fmt(R.w)} cm</text><text class="roomdim" transform="translate(-18 ${R.l / 2}) rotate(-90)">${fmt(R.l)} cm</text>`;
  const bb = selBB();
  if (bb) h += `<rect class="selbox" x="${bb.minX - 3}" y="${bb.minY - 3}" width="${bb.maxX - bb.minX + 6}" height="${bb.maxY - bb.minY + 6}"/>`;
  h += dimsSVG();
  svg.innerHTML = h;
  svg.setAttribute('viewBox', `${view.x} ${view.y} ${view.w} ${view.h}`);
}

/* ---------- Interaktion (2D) ---------- */
function svgPt(e) {
  const m = svg.getScreenCTM().inverse(), p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m);
  return [p.x, p.y];
}
function snapDelta(bb, ignoreId, thr) {
  const R = S.room, g = opt.grid;
  const tx = [0, R.w], ty = [0, R.l];
  const addBB = b => { tx.push(b.minX, b.maxX); ty.push(b.minY, b.maxY); };
  S.items.forEach(i => { if (i.id !== ignoreId && !i.parent) addBB(bboxOf(i)); });
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
    sel = {kind, id}; if (changedSel) selCell = null;
    const o = findSel();
    if (isLocked(o, kind)) drag = {mode: 'pan', px: e.clientX, py: e.clientY, v0: {...view}, a: svg.getScreenCTM().a, moved: false};
    else drag = {mode: 'move', kind, id, p0: p, o0: kind === 'door' ? null : [o.x, o.y], moved: false};
    if (changedSel) refresh({rebuild: true});
  } else {
    drag = {mode: 'pan', px: e.clientX, py: e.clientY, v0: {...view}, a: svg.getScreenCTM().a, moved: false};
    if (sel) { sel = null; selCell = null; refresh({rebuild: true}); }
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
    dragDoor(p);
  } else {
    const o = findSel(); if (!o) return;
    moveTo(o, drag.kind, drag.o0[0] + dx, drag.o0[1] + dy, e.altKey);
  }
  refresh({});
});
function dragDoor(pt) {
  const R = S.room, D = S.door;
  const dist = {N: pt[1], S: R.l - pt[1], W: pt[0], E: R.w - pt[0]};
  const wall = Object.keys(dist).sort((x, y) => dist[x] - dist[y])[0];
  const along = (wall === 'N' || wall === 'S') ? pt[0] : pt[1], len = (wall === 'N' || wall === 'S') ? R.w : R.l;
  D.wall = wall; D.offset = Math.round(Math.max(0, Math.min(len - D.width, along - D.width / 2)) / 5) * 5;
}
function moveTo(o, kind, x, y, noSnap) {
  o.x = x; o.y = y;
  if (!noSnap) {
    const bb = kind === 'item' ? bboxOf(o) : bbox(pillarPoly(o));
    const [sx, sy] = snapDelta(bb, o.id, 6); o.x += sx; o.y += sy;
  }
  o.x = r1(o.x); o.y = r1(o.y);
}
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
  if (mode === '3d') { if (window.fit3D) fit3D(); return; }
  const R = S.room, m = 70, r = svg.clientWidth / Math.max(1, svg.clientHeight) || 1.4;
  let w = R.w + 2 * m, h = R.l + 2 * m;
  if (w / h < r) w = h * r; else h = w / r;
  view = {x: R.w / 2 - w / 2, y: R.l / 2 - h / 2, w, h};
  svg.setAttribute('viewBox', `${view.x} ${view.y} ${view.w} ${view.h}`);
}
$('#zoomIn').onclick = () => mode === '3d' ? zoom3D(1 / 1.25) : zoom(1 / 1.25);
$('#zoomOut').onclick = () => mode === '3d' ? zoom3D(1.25) : zoom(1.25);
$('#fit').onclick = fit;
$('#grid').onchange = e => { opt.grid = +e.target.value; };
$('#zones').onchange = e => { opt.zones = e.target.checked; renderPlan(); };
$('#dims').onchange = e => { opt.dims = e.target.checked; renderPlan(); };
$('#heat').onchange = e => { opt.heat = e.target.checked; refresh({}); };

/* Umschalten 2D/3D */
function setMode(m) {
  if (m === '3d' && !window.THREE) { alert('3D-Ansicht nicht verfügbar (three.js konnte nicht geladen werden).'); return; }
  mode = m;
  document.querySelectorAll('[data-mode]').forEach(b => b.classList.toggle('on', b.dataset.mode === m));
  document.body.classList.toggle('m3d', m === '3d');
  svg.toggleAttribute('hidden', m === '3d'); $('#gl').hidden = m !== '3d';
  if (m === '3d') { init3D(); render3D(); fit3D(); } else { renderPlan(); fit(); }
}
document.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => setMode(b.dataset.mode));

/* Klicks auf Listen/Tabs/Inspector */
function setSolo(v) { solo = v; refresh({rebuild: true}); }
document.addEventListener('click', e => {
  const act = e.target.closest('[data-act]');
  if (act) {
    const k = act.dataset.act, g = act.dataset.g && grpOf(act.dataset.g), it = act.dataset.id && findItem(act.dataset.id);
    const done = () => { commit(); refresh({rebuild: true}); };
    if (k === 'del') delSel(); else if (k === 'dup') dupSel(); else if (k === 'rot') rotSel();
    else if (k === 'ivis' && it) { it.hidden = !it.hidden; done(); }
    else if (k === 'ilock' && it) { it.locked = !it.locked; done(); }
    else if (k === 'shelf') { const o = findSel(); if (o && sel.kind === 'item') { const t = topOf(o); if (t && HOST_TYPES.includes(t.type)) openShelf({type: 'item', id: t.id}); } }
    else if (k === 'gshelf' && g) openShelf({type: 'group', id: g.id});
    else if (k === 'isolo') { const o = findSel(); if (o && sel.kind === 'item') setSolo({type: 'item', id: topOf(o).id}); }
    else if (k === 'gnew') {
      const ng = {id: uid(), name: nextGroupName(), hidden: false}; S.groups.push(ng);
      const o = findSel(); if (o && sel.kind === 'item' && !o.parent) o.group = ng.id;
      done();
    }
    else if (k === 'gvis' && g) { g.hidden = !g.hidden; done(); }
    else if (k === 'gsolo' && g) setSolo(solo && solo.type === 'group' && solo.id === g.id ? null : {type: 'group', id: g.id});
    else if (k === 'gadd' && g) { const o = findSel(); if (o && sel.kind === 'item' && !o.parent) { o.group = g.id; done(); } }
    else if (k === 'gdel' && g) { S.items.forEach(i => { if (i.group === g.id) i.group = null; }); S.groups = S.groups.filter(x => x !== g); if (solo && solo.id === g.id) solo = null; done(); }
    else if (k === 'showall') { solo = null; S.items.forEach(i => { i.hidden = false; }); S.groups.forEach(x => { x.hidden = false; }); done(); }
    else if (k === 'addc' || k === 'delc') {
      const parts = act.dataset.c.split(':'), ci = findItem(parts[0]); if (!ci) return;
      const f = +parts[1], l = +parts[2], c = ci.cells[f][l];
      if (k === 'addc') c.c.push({n: '', q: 1, kg: 0}); else c.c.splice(+parts[3], 1);
      openCells.add(`${ci.id}:${f}:${l}`); commit(); refresh({rebuild: true});
    }
    return;
  }
  const s = e.target.closest('[data-sel]');
  if (s) { const [k, id] = s.dataset.sel.split(':'); select({kind: k, id}); return; }
  const a = e.target.closest('[data-add]'); if (a) { addItem(a.dataset.add); return; }
  const t = e.target.closest('#tabs button'); if (t) { showTab(t.dataset.tab); return; }
  const gg = e.target.closest('[data-go]'); if (gg) { showTab(gg.dataset.go); return; }
});
function renderSolo() {
  const el = $('#soloBar'); if (!el) return;
  el.hidden = !solo;
  if (solo) {
    const n = solo.type === 'group' ? (grpOf(solo.id) || {}).name : (findItem(solo.id) || {}).name;
    el.innerHTML = `Nur angezeigt: <b>${esc(n || '')}</b> <button class="small" data-act="showall">Alle anzeigen</button>`;
  }
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
  if (e.key === 'Escape') { sel = null; selCell = null; refresh({rebuild: true}); }
  else if (!o) return;
  else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); delSel(); }
  else if (e.key === 'r' || e.key === 'R') rotSel();
  else if (e.key.startsWith('Arrow') && sel.kind !== 'door') {
    e.preventDefault();
    const st = (e.shiftKey ? 10 : 1) * (opt.grid || 1);
    const dx = e.key === 'ArrowLeft' ? -st : e.key === 'ArrowRight' ? st : 0, dy = e.key === 'ArrowUp' ? -st : e.key === 'ArrowDown' ? st : 0;
    if (isLocked(o, sel.kind)) return;
    if (o.parent) { o.parent.x += dx; o.parent.z += dy; } else { o.x += dx; o.y += dy; }
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
function importText(t) {
  const s = JSON.parse(t);
  if (!s.room || !Array.isArray(s.items)) throw new Error('format');
  S = normalizeState(s); sel = null; commit(); buildRoomTab(); fit(); refresh({rebuild: true, room: true});
}
$('#file').onchange = e => {
  const f = e.target.files[0]; if (!f) return;
  f.text().then(importText).catch(() => alert('Datei konnte nicht gelesen werden.')).finally(() => { e.target.value = ''; });
};
$('#reset').onclick = () => {
  const c = confirm('Plan zurücksetzen?\nOK = Beispielplan laden · Abbrechen = nichts ändern');
  if (!c) return;
  const empty = confirm('Mit leerem Raum beginnen?\nOK = leerer Raum · Abbrechen = Beispielplan');
  S = defaultState(); if (empty) { S.items = []; S.pillars = []; }
  sel = null; commit(); buildRoomTab(); fit(); refresh({rebuild: true, room: true});
};
$('#print').onclick = () => {
  renderPlan();
  const c = svg.cloneNode(true);
  c.querySelectorAll('.selbox,.dimline,.dimtxt').forEach(n => n.remove());
  c.removeAttribute('id'); c.removeAttribute('hidden'); c.setAttribute('viewBox', `${-40} ${-40} ${S.room.w + 80} ${S.room.l + 80}`);
  $('#printReport').innerHTML = `<h1>SEG-Lager – BRK Bereitschaft Erding</h1><div>${new Date().toLocaleDateString('de-DE')} · Raum ${fmt(S.room.w)} × ${fmt(S.room.l)} cm</div>${c.outerHTML}<h2>Prüfung</h2>` +
    (ST.issues.length ? '<ul>' + ST.issues.map(i => `<li>${esc(i.msg)}</li>`).join('') + '</ul>' : '<p>Keine Probleme.</p>') + '<h2>Belegung</h2>' + reportHTML();
  const th = document.documentElement.getAttribute('data-theme');
  document.documentElement.setAttribute('data-theme', 'light');
  window.print();
  if (th) document.documentElement.setAttribute('data-theme', th); else document.documentElement.removeAttribute('data-theme');
};

/* ---------- Gesamt-Refresh ---------- */
let saveT = null;
function refresh(o) {
  ST = analyze();
  if (mode === '2d') renderPlan();
  renderObjList(); renderReport(); renderStatus(); renderPillarList(); renderSolo();
  if (window.shelfOpen) renderShelf();
  if (o.rebuild) { buildInspector(); buildRoomTab(); }
  syncForms();
  if (mode === '3d' && window.render3D) render3D();
  $('#undo').disabled = hIdx === 0; $('#redo').disabled = hIdx >= hist.length - 1;
  clearTimeout(saveT); saveT = setTimeout(() => { try { localStorage.setItem(LS_KEY, JSON.stringify(S)); } catch (e) {} }, 300);
}

buildRoomTab(); buildObjectsTab();
ST = analyze();
fit(); refresh({rebuild: true, room: true});
window.addEventListener('resize', () => { if (!drag && mode === '2d') fit(); });

/* ---------- Hell/Dunkel ---------- */
const THEME_KEY = 'seg-lager-theme';
function isDark() {
  const t = document.documentElement.getAttribute('data-theme');
  return t ? t === 'dark' : !!(window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
}
function themeChanged() {
  $('#theme').textContent = isDark() ? 'Hell' : 'Dunkel';
  if (mode === '3d' && window.render3D && window.T3) render3D();
}
try { const t = localStorage.getItem(THEME_KEY); if (t === 'dark' || t === 'light') document.documentElement.setAttribute('data-theme', t); } catch (e) {}
$('#theme').onclick = () => {
  const t = isDark() ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', t);
  try { localStorage.setItem(THEME_KEY, t); } catch (e) {}
  themeChanged();
};
if (window.matchMedia) { const mq = matchMedia('(prefers-color-scheme: dark)'); (mq.addEventListener ? mq.addEventListener('change', themeChanged) : mq.addListener && mq.addListener(themeChanged)); }
themeChanged();
