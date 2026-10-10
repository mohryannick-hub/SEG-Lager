'use strict';
/* 3D-Ansicht (three.js r128). Szene: x = Plan-x, z = Plan-y, y = Höhe (alles in cm).
   Objektgruppe: Position (x, 0, y), Drehung um Y = -rot. Lokal: x rechts, z nach vorn (Front), y hoch. */

let T3 = null;
const cam3 = {theta: -0.5, phi: 1.0, dist: 1300, tx: 450, ty: 50, tz: 300};
const noRay = () => {};

function init3D() {
  if (T3) return;
  const canvas = $('#gl');
  const renderer = new THREE.WebGLRenderer({canvas, antialias: true});
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0xe9ecef);
  const camera = new THREE.PerspectiveCamera(45, 1, 5, 30000);
  scene.add(new THREE.AmbientLight(0xffffff, 0.64));
  const dl = new THREE.DirectionalLight(0xffffff, 0.72); dl.position.set(-400, 900, 500); scene.add(dl);
  const dl2 = new THREE.DirectionalLight(0xffffff, 0.28); dl2.position.set(600, 300, -400); scene.add(dl2);
  const world = new THREE.Group(); scene.add(world);
  const ub = new THREE.BoxGeometry(1, 1, 1);
  T3 = {renderer, scene, camera, world, ray: new THREE.Raycaster(), mats: {}, lmats: {}, tex: {}, ub, ue: new THREE.EdgesGeometry(ub), dirty: true, grid: null,
    edgeMat: new THREE.LineBasicMaterial({color: 0x000000, transparent: true, opacity: 0.33}),
    selMat: new THREE.LineBasicMaterial({color: 0xc8102e})};
  const rs = () => {
    const w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); T3.dirty = true;
  };
  if (window.ResizeObserver) new ResizeObserver(rs).observe(canvas); else window.addEventListener('resize', rs);
  rs();
  bindEvents3D();
  const tick = () => {
    requestAnimationFrame(tick);
    if (!T3.dirty || mode !== '3d') return;
    T3.dirty = false; updateCam();
    renderer.render(scene, camera);
  };
  tick();
}
function updateCam() {
  const c = cam3, sp = Math.sin(c.phi);
  T3.camera.position.set(c.tx + c.dist * sp * Math.sin(c.theta), c.ty + c.dist * Math.cos(c.phi), c.tz + c.dist * sp * Math.cos(c.theta));
  T3.camera.lookAt(c.tx, c.ty, c.tz);
}
function zoom3D(f) { cam3.dist = clamp(cam3.dist * f, 80, 8000); if (T3) T3.dirty = true; }
function fit3D() {
  if (!T3) return;
  const R = S.room;
  Object.assign(cam3, {tx: R.w / 2, ty: 40, tz: R.l / 2, dist: Math.max(R.w, R.l) * 1.3 + 250});
  T3.dirty = true;
}
function preset3D(p) {
  if (!T3) return;
  const R = S.room;
  Object.assign(cam3, {tx: R.w / 2, ty: 40, tz: R.l / 2, dist: Math.max(R.w, R.l) * 1.3 + 250});
  if (p === 'top') Object.assign(cam3, {theta: 0, phi: 0.04, dist: Math.max(R.w * 0.62, R.l) * 1.45 + 150});
  else if (p === 'front') Object.assign(cam3, {theta: 0, phi: 1.3});
  else Object.assign(cam3, {theta: -0.5, phi: 1.0});
  T3.dirty = true;
}
function focus3D() {
  const o = findSel(); if (!T3 || !o || sel.kind !== 'item') return;
  const t = topOf(o);
  Object.assign(cam3, {tx: t.x, ty: t.h / 2, tz: t.y, dist: Math.max(t.w, t.d, t.h) * 2.1 + 120});
  T3.dirty = true;
}

/* ---------- Bausteine ---------- */
function shade(col, f) { return '#' + new THREE.Color(col).multiplyScalar(f).getHexString(); }
function mat(color, op) {
  op = op == null ? 1 : op;
  const k = color + '|' + op;
  return T3.mats[k] || (T3.mats[k] = new THREE.MeshLambertMaterial({color, transparent: op < 1, opacity: op, depthWrite: op >= 1}));
}
function lmat(color, op, line) {
  const k = color + '|' + op + '|' + (line ? 'l' : 'm');
  if (!T3.lmats[k]) T3.lmats[k] = line ? new THREE.LineBasicMaterial({color}) : new THREE.MeshBasicMaterial({color, transparent: true, opacity: op, depthWrite: false});
  return T3.lmats[k];
}
function mk(parent, w, h, d, cx, cy, cz, color, op, edges) {
  const m = new THREE.Mesh(T3.ub, mat(color, op));
  m.scale.set(w, h, d); m.position.set(cx, cy, cz);
  if (edges !== false) m.add(new THREE.LineSegments(T3.ue, T3.edgeMat));
  parent.add(m); return m;
}
function wire(parent, w, h, d, cx, cy, cz, material) {
  const l = new THREE.LineSegments(T3.ue, material); l.scale.set(w, h, d); l.position.set(cx, cy, cz); l.raycast = noRay; parent.add(l); return l;
}
function overlay(parent, w, h, d, cx, cy, cz, color, fillOp) {
  wire(parent, w, h, d, cx, cy, cz, lmat(color, 1, true));
  if (fillOp) { const m = new THREE.Mesh(T3.ub, lmat(color, fillOp)); m.scale.set(w, h, d); m.position.set(cx, cy, cz); m.raycast = noRay; parent.add(m); }
}
function labelSprite(text) {
  let t = T3.tex[text];
  if (!t) {
    const c = document.createElement('canvas'); c.width = 320; c.height = 80;
    const x = c.getContext('2d');
    let fs = 38; x.font = `600 ${fs}px system-ui, sans-serif`;
    while (x.measureText(text).width > 290 && fs > 14) { fs -= 2; x.font = `600 ${fs}px system-ui, sans-serif`; }
    x.fillStyle = 'rgba(255,255,255,.88)'; x.fillRect(6, 10, 308, 60);
    x.strokeStyle = 'rgba(0,0,0,.45)'; x.lineWidth = 2; x.strokeRect(6, 10, 308, 60);
    x.fillStyle = '#111'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, 160, 41);
    t = T3.tex[text] = new THREE.CanvasTexture(c);
  }
  const s = new THREE.Sprite(new THREE.SpriteMaterial({map: t, depthTest: false, transparent: true}));
  s.scale.set(96, 24, 1); s.renderOrder = 10; s.raycast = noRay; return s;
}
const isSel = it => sel && sel.kind === 'item' && sel.id === it.id;
const heatOn = () => opt.heat;

/* ---------- Modelle ---------- */
function buildKiste(it, g) {
  const {w, h, d} = it, st = ST.items[it.id];
  const col = heatOn() ? (heatColor(st.ratio) || '#f1f1f1') : it.color;
  mk(g, w, h - 3, d, 0, (h - 3) / 2, 0, col);
  mk(g, w - 2, 3, d - 2, 0, h - 1.5, 0, shade(col, 1.15));
  mk(g, Math.min(16, w * 0.3), 1.2, 2, 0, h - 3, d / 2 + 0.3, shade(col, 0.7), 1, false);
  if (ST.bad.has(it.id)) wire(g, w + 3, h + 3, d + 3, 0, h / 2, 0, lmat('#ff0000', 1, true));
  if (isSel(it)) wire(g, w + 2, h + 2, d + 2, 0, h / 2, 0, T3.selMat);
}
function buildSchrank(it, g) {
  const {w, d, h} = it, P = PROF.schrank, wt = P.wt, tb = P.tb, col = it.color, lh = h / it.levels;
  mk(g, wt, h, d, -w / 2 + wt / 2, h / 2, 0, col); mk(g, wt, h, d, w / 2 - wt / 2, h / 2, 0, col);
  mk(g, w, h, wt, 0, h / 2, -d / 2 + wt / 2, shade(col, 0.88));
  for (let l = 0; l < it.levels; l++) mk(g, w - 2 * wt, tb, d - wt, 0, l * lh + tb / 2, wt / 2, col);
  mk(g, w, tb, d, 0, h - tb / 2, 0, col);
  for (let i = 1; i < it.fields; i++) mk(g, wt, h, d - wt, -w / 2 + i * w / it.fields, h / 2, wt / 2, col);
  const open = $('#g3doors').checked, dc = shade(col, 0.82);
  const leaves = it.doors === 1 ? [[-w / 2, w, 1]] : [[-w / 2, w / 2, 1], [w / 2, w / 2, -1]];
  leaves.forEach(([hx, lw, dir]) => {
    if (open) mk(g, 1.5, h - 3, lw, hx + (dir > 0 ? -0.75 : 0.75), h / 2, d / 2 + lw / 2, dc, 0.95);
    else mk(g, lw, h - 3, 1.5, hx + dir * lw / 2, h / 2, d / 2 + 0.75, dc, 0.55);
  });
}
function buildRegal(it, g) {
  const {w, d, h} = it, post = 5, fw = w / it.fields, lh = h / it.levels;
  for (let i = 0; i <= it.fields; i++) {
    const px = clamp(-w / 2 + i * fw, -w / 2 + post / 2, w / 2 - post / 2);
    [-1, 1].forEach(z => mk(g, post, h, post, px, h / 2, z * (d / 2 - post / 2), '#3d5a8a'));
  }
  for (let f = 0; f < it.fields; f++) for (let l = 0; l < it.levels; l++) {
    const xc = -w / 2 + (f + 0.5) * fw;
    mk(g, fw - post, 4, d - 2, xc, l * lh + 2, 0, '#c9c3b4');
    [-1, 1].forEach(z => mk(g, fw - post, 8, 3, xc, l * lh + 4, z * (d / 2 - 1.5), it.color));
  }
}
function buildRollwagen(it, g) {
  const {w, d, h} = it, base = PROF.rollwagen.base, lh = (h - base) / it.levels, col = it.color;
  for (let l = 0; l < it.levels; l++) mk(g, w, 3, d, 0, base + l * lh + 1.5, 0, col);
  [-1, 1].forEach(sx => [-1, 1].forEach(sz => {
    mk(g, 3, h - base, 3, sx * (w / 2 - 1.5), base + (h - base) / 2, sz * (d / 2 - 1.5), '#6b7280');
    mk(g, 6, 8, 6, sx * (w / 2 - 5), 4, sz * (d / 2 - 5), '#222');
  }));
  mk(g, w - 6, 3, 3, 0, h - 1.5, -d / 2 + 1.5, '#222');
}
function buildTisch(it, g) {
  const {w, d, h} = it;
  mk(g, w, 3, d, 0, h - 1.5, 0, it.color);
  [-1, 1].forEach(sx => [-1, 1].forEach(sz => mk(g, 4, h - 3, 4, sx * (w / 2 - 5), (h - 3) / 2, sz * (d / 2 - 5), '#555')));
}
const BUILD = {schrank: buildSchrank, regal: buildRegal, rollwagen: buildRollwagen, tisch: buildTisch};

function buildItem(it, world) {
  const g = new THREE.Group();
  g.position.set(it.x, 0, it.y); g.rotation.y = -rad(it.rot);
  g.userData.pick = {kind: 'item', id: it.id};
  const st = ST.items[it.id];
  if (it.type === 'kiste') buildKiste(it, g);
  else {
    BUILD[it.type](it, g);
    if (ST.bad.has(it.id) || st.over) wire(g, it.w + 3, it.h + 3, it.d + 3, 0, it.h / 2, 0, lmat('#ff0000', 1, true));
    if (isSel(it) || (sel && sel.kind === 'item' && st.kids.some(k => k.id === sel.id))) wire(g, it.w + 2, it.h + 2, it.d + 2, 0, it.h / 2, 0, isSel(it) ? T3.selMat : lmat('#c8102e', 1, true));
    // Fächer: Auswahl, Lastfarben
    const selHost = isSel(it) || (sel && sel.kind === 'item' && st.kids.some(k => k.id === sel.id));
    if (HOST_TYPES.includes(it.type) && (selHost || heatOn())) {
      it.cells.forEach((col, f) => col.forEach((c, l) => {
        const cg = cellGeom(it, f, l), s = st.cells[f][l], ch = Math.min(cg.ch, 60);
        const isCur = selCell && selCell.id === it.id && selCell.f === f && selCell.l === l;
        const color = s.ratio > 1 ? '#e53935' : s.ratio > 0.85 ? '#fb8c00' : s.load > 0 ? '#43a047' : '#9aa5b1';
        if (heatOn() ? true : selHost) overlay(g, cg.iw, ch, cg.id, cg.x0 + cg.iw / 2, cg.y + ch / 2, cg.z0 + cg.id / 2, isCur ? '#c8102e' : color, isCur ? 0.28 : (heatOn() && s.load > 0 ? 0.2 : 0));
      }));
    }
    // eingestellte Kisten
    st.kids.forEach(k => {
      const cg = cellGeom(it, k.parent.f, k.parent.l), [ew, ed] = effDims(k);
      const kg = new THREE.Group();
      kg.position.set(cg.x0 + k.parent.x + ew / 2, cg.y, cg.z0 + k.parent.z + ed / 2);
      kg.rotation.y = -rad(k.parent.rot);
      kg.userData.pick = {kind: 'item', id: k.id};
      buildKiste(k, kg); g.add(kg);
    });
  }
  world.add(g);
  if ($('#g3labels').checked) {
    const s = labelSprite(it.name); s.position.set(it.x, it.h + 20, it.y); world.add(s);
  }
}

function render3D() {
  if (!T3) init3D();
  const W = T3.world, R = S.room;
  while (W.children.length) W.remove(W.children[0]);
  if (T3.grid) { T3.grid.geometry.dispose(); T3.grid = null; }
  // Boden + Raster
  mk(W, R.w, 2, R.l, R.w / 2, -1, R.l / 2, '#fafaf7', 1, false);
  const pts = [];
  for (let x = 0; x <= R.w; x += 100) pts.push(x, 0.3, 0, x, 0.3, R.l);
  for (let z = 0; z <= R.l; z += 100) pts.push(0, 0.3, z, R.w, 0.3, z);
  const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  T3.grid = new THREE.LineSegments(gg, new THREE.LineBasicMaterial({color: 0xcfd3d9})); T3.grid.raycast = noRay; W.add(T3.grid);
  // Wände mit Türöffnung
  const high = $('#g3walls').checked, wh = high ? Math.max(R.h, 100) : 40, D = S.door;
  const addWall = (wall, a, b, y0, y1) => {
    if (b - a < 0.5 || y1 - y0 < 0.5) return;
    const along = (a + b) / 2, len = b - a, hgt = y1 - y0, op = high ? 0.28 : 1, T = 12, col = '#3a3f45';
    if (wall === 'N') mk(W, len, hgt, T, along, y0 + hgt / 2, -T / 2, col, op);
    else if (wall === 'S') mk(W, len, hgt, T, along, y0 + hgt / 2, R.l + T / 2, col, op);
    else if (wall === 'W') mk(W, T, hgt, len, -T / 2, y0 + hgt / 2, along, col, op);
    else mk(W, T, hgt, len, R.w + T / 2, y0 + hgt / 2, along, col, op);
  };
  ['N', 'S', 'W', 'E'].forEach(wall => {
    const len = (wall === 'N' || wall === 'S') ? R.w : R.l;
    if (wall === D.wall) { addWall(wall, 0, D.offset, 0, wh); addWall(wall, D.offset + D.width, len, 0, wh); addWall(wall, D.offset, D.offset + D.width, DOOR_H, wh); }
    else addWall(wall, 0, len, 0, wh);
  });
  // Schiebetür (geöffnet, vor der Wand)
  const dg = doorGeom(), lc = dg.leaf.reduce((s, p) => [s[0] + p[0] / 4, s[1] + p[1] / 4], [0, 0]), horiz = D.wall === 'N' || D.wall === 'S';
  const leaf = mk(W, horiz ? D.width : LEAF_T, DOOR_H, horiz ? LEAF_T : D.width, lc[0], DOOR_H / 2, lc[1], '#8a5a2b', 0.8);
  leaf.userData.pick = {kind: 'door', id: 'door'};
  // Stützpfeiler
  S.pillars.forEach(p => {
    const m = mk(W, p.w, Math.max(R.h, 100), p.d, p.x + p.w / 2, Math.max(R.h, 100) / 2, p.y + p.d / 2, '#6b7280', high ? 0.55 : 1);
    m.userData.pick = {kind: 'pillar', id: p.id};
    if (sel && sel.kind === 'pillar' && sel.id === p.id) wire(W, p.w + 2, Math.max(R.h, 100) + 2, p.d + 2, p.x + p.w / 2, Math.max(R.h, 100) / 2, p.y + p.d / 2, T3.selMat);
  });
  S.items.filter(i => !i.parent).forEach(it => buildItem(it, W));
  T3.dirty = true;
}

/* ---------- Eingabe ---------- */
function setRay(e) {
  const c = $('#gl'), r = c.getBoundingClientRect();
  T3.ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), T3.camera);
}
function pick3D(e) {
  setRay(e);
  const hits = T3.ray.intersectObjects(T3.world.children, true);
  for (const h of hits) {
    let o = h.object; while (o && !o.userData.pick) o = o.parent;
    if (o) return {pick: o.userData.pick, point: h.point};
  }
  return null;
}
function groundPt(e) {
  setRay(e); const o = T3.ray.ray.origin, d = T3.ray.ray.direction;
  if (d.y >= -1e-6) return null;
  const t = -o.y / d.y; return [o.x + d.x * t, o.z + d.z * t];
}
function dropKiste(k, e, noSnap) {
  setRay(e);
  const o = T3.ray.ray.origin, dr = T3.ray.ray.direction;
  const prev = k.parent ? findItem(k.parent.id) : null, prevRot = k.parent ? k.parent.rot : 0;
  const rot = prevRot, [ew, ed] = rot === 90 ? [k.d, k.w] : [k.w, k.d];
  let best = null;
  if (Math.abs(dr.y) > 1e-6) {
    S.items.filter(h => HOST_TYPES.includes(h.type) && !h.parent).forEach(h => h.cells.forEach((col, f) => col.forEach((c, l) => {
      const g = cellGeom(h, f, l), t = (g.y - o.y) / dr.y; if (t <= 0) return;
      const [lx, lz] = toLocal(h, o.x + dr.x * t, o.z + dr.z * t);
      if (lx < g.x0 - 4 || lx > g.x0 + g.iw + 4 || lz < g.z0 - 4 || lz > g.z0 + g.id + 4) return;
      if (!best || t < best.t) best = {t, h, f, l, g, lx, lz};
    })));
  }
  if (best) {
    const {h, f, l, g} = best;
    const step = noSnap ? 0.5 : (opt.grid || 1);
    const others = S.items.filter(s => s !== k && s.parent && s.parent.id === h.id && s.parent.f === f && s.parent.l === l).map(s => { const [w, d] = effDims(s); return {x: s.parent.x, z: s.parent.z, w, d}; });
    const fix = (v, size, max, edges) => {
      v = clamp(v, 0, Math.max(0, max - size));
      if (!noSnap) { let b = null; [0, max - size, ...edges].forEach(t => { const dl = t - v; if (Math.abs(dl) <= 3 && (b == null || Math.abs(dl) < Math.abs(b))) b = dl; }); v = b != null ? v + b : Math.round(v / step) * step; }
      return clamp(v, 0, Math.max(0, max - size));
    };
    const ex = [], ez = [];
    others.forEach(s => { ex.push(s.x + s.w, s.x - ew); ez.push(s.z + s.d, s.z - ed); });
    k.parent = {id: h.id, f, l, x: r1(fix(best.lx - g.x0 - ew / 2, ew, g.iw, ex)), z: r1(fix(best.lz - g.z0 - ed / 2, ed, g.id, ez)), rot};
  } else {
    const p = groundPt(e); if (!p) return;
    if (k.parent) { k.rot = prev ? (prev.rot + prevRot) % 360 : 0; k.parent = null; }
    moveTo(k, 'item', p[0], p[1], noSnap);
  }
}
let d3 = null;
const ptrs = new Map();
function bindEvents3D() {
  document.querySelectorAll('[data-p3]').forEach(b => { b.onclick = () => preset3D(b.dataset.p3); });
  $('#focus3').onclick = focus3D;
  ['g3doors', 'g3walls', 'g3labels'].forEach(id => { $('#' + id).onchange = () => render3D(); });
  const c = $('#gl'), tip = $('#tip');
  c.addEventListener('contextmenu', e => e.preventDefault());
  c.addEventListener('pointerdown', e => {
    c.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, [e.clientX, e.clientY]);
    tip.hidden = true;
    if (ptrs.size === 2) {
      const [a, b] = [...ptrs.values()];
      d3 = {mode: 'pinch', dist: Math.hypot(a[0] - b[0], a[1] - b[1]), mx: (a[0] + b[0]) / 2, my: (a[1] + b[1]) / 2};
      return;
    }
    const h = (e.button === 2 || e.shiftKey) ? null : pick3D(e);
    if (h) {
      const {kind, id} = h.pick, changed = !sel || sel.kind !== kind || sel.id !== id;
      sel = {kind, id}; if (changed) { selCell = null; refresh({rebuild: true}); }
      const o = findSel();
      d3 = {mode: 'obj', kind, id, moved: false, sx: e.clientX, sy: e.clientY, p0: kind === 'door' ? null : groundPt(e), o0: (kind === 'door' || (kind === 'item' && o.parent)) ? null : [o.x, o.y]};
    } else {
      d3 = {mode: (e.button === 2 || e.button === 1 || e.shiftKey) ? 'pan' : 'orbit', x: e.clientX, y: e.clientY, moved: false};
    }
  });
  c.addEventListener('pointermove', e => {
    if (!ptrs.has(e.pointerId)) { // Hover-Hinweis
      if (d3) return;
      const h = pick3D(e);
      if (h && h.pick.kind === 'item') {
        const it = findItem(h.pick.id), st = ST.items[it.id];
        const lines = []; it.cells.forEach((col, f) => col.forEach((cell, l) => cell.c.filter(r => r.n).forEach(r => lines.push(`${esc(r.n)} · ${fmt(+r.q || 0)} Stk`))));
        tip.innerHTML = `<b>${esc(it.name)}</b><br>${fmt(st.total)} kg${lines.length ? '<br>' + lines.slice(0, 6).join('<br>') + (lines.length > 6 ? '<br>…' : '') : ''}`;
        const r = c.getBoundingClientRect(); tip.style.left = (e.clientX - r.left + 14) + 'px'; tip.style.top = (e.clientY - r.top + 14) + 'px'; tip.hidden = false;
        c.style.cursor = 'grab';
      } else { tip.hidden = true; c.style.cursor = h ? 'pointer' : 'default'; }
      return;
    }
    ptrs.set(e.pointerId, [e.clientX, e.clientY]);
    if (!d3) return;
    if (d3.mode === 'pinch') {
      if (ptrs.size < 2) return;
      const [a, b] = [...ptrs.values()], dist = Math.hypot(a[0] - b[0], a[1] - b[1]), mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
      if (d3.dist > 0 && dist > 0) cam3.dist = clamp(cam3.dist * d3.dist / dist, 80, 8000);
      pan3D(mx - d3.mx, my - d3.my);
      d3.dist = dist; d3.mx = mx; d3.my = my; T3.dirty = true; return;
    }
    if (d3.mode === 'orbit') {
      cam3.theta -= (e.clientX - d3.x) * 0.006; cam3.phi = clamp(cam3.phi - (e.clientY - d3.y) * 0.006, 0.04, 1.55);
      d3.x = e.clientX; d3.y = e.clientY; d3.moved = true; T3.dirty = true; return;
    }
    if (d3.mode === 'pan') { pan3D(e.clientX - d3.x, e.clientY - d3.y); d3.x = e.clientX; d3.y = e.clientY; d3.moved = true; T3.dirty = true; return; }
    // Objekt ziehen
    if (!d3.moved && Math.hypot(e.clientX - d3.sx, e.clientY - d3.sy) < 5) return;
    d3.moved = true;
    const o = findSel(); if (!o) return;
    if (d3.kind === 'door') { const p = groundPt(e); if (p) dragDoor(p); }
    else if (d3.kind === 'item' && o.type === 'kiste') dropKiste(o, e, e.altKey);
    else if (d3.p0 && d3.o0) { const p = groundPt(e); if (p) moveTo(o, d3.kind, d3.o0[0] + p[0] - d3.p0[0], d3.o0[1] + p[1] - d3.p0[1], e.altKey); }
    else return;
    refresh({});
  });
  const up = e => {
    ptrs.delete(e.pointerId);
    if (ptrs.size === 1) { const [x, y] = [...ptrs.values()][0]; d3 = {mode: 'orbit', x, y, moved: true}; return; }
    if (!d3) return;
    if (d3.mode === 'obj' && d3.moved) { commit(); refresh({rebuild: true, room: true}); }
    else if (d3.mode === 'orbit' && !d3.moved) { if (sel) { sel = null; selCell = null; refresh({rebuild: true}); } }
    if (ptrs.size === 0) d3 = null;
  };
  c.addEventListener('pointerup', up); c.addEventListener('pointercancel', up);
  c.addEventListener('pointerleave', () => { tip.hidden = true; });
  c.addEventListener('wheel', e => { e.preventDefault(); zoom3D(e.deltaY > 0 ? 1.1 : 1 / 1.1); }, {passive: false});
  c.addEventListener('dblclick', e => { const h = pick3D(e); if (h && h.pick.kind === 'item') focus3D(); });
}
function pan3D(dx, dy) {
  // Verschiebung in der Bodenebene: rechts = (cosθ, -sinθ), vorwärts = (-sinθ, -cosθ)
  const k = cam3.dist * 0.0016, st = Math.sin(cam3.theta), ct = Math.cos(cam3.theta);
  cam3.tx += -dx * k * ct - dy * k * st;
  cam3.tz += dx * k * st - dy * k * ct;
}
