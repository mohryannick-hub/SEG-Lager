'use strict';
/* Regalansicht: Frontansicht eines Regals/Schranks oder einer Gruppe im Seitenfenster.
   Kisten lassen sich per Ziehen zwischen Fächern verschieben, aus dem Pool "Kisten am Boden" einsortieren
   oder zurück in den Pool legen. Maße in cm (SVG-Einheiten), Höhe nach oben. */

var shelfOpen = false;
let shelfScope = 'sel', shelfLast = null, shelfWide = false, sd = null;
const SHELF_GAP = 30, SHELF_TOP = 24;

function openShelf(scope) {
  shelfOpen = true; if (scope) shelfScope = scope;
  $('#shelf').hidden = false; renderShelf();
}
function closeShelf() { shelfOpen = false; $('#shelf').hidden = true; }

function shelfHosts() {
  let hs = [];
  if (shelfScope === 'sel') {
    const o = findSel(), t = o && sel && sel.kind === 'item' ? topOf(o) : null;
    if (t && HOST_TYPES.includes(t.type)) shelfLast = t.id;
    const h = shelfLast && findItem(shelfLast); if (h) hs = [h];
  } else if (shelfScope.type === 'item') {
    const h = findItem(shelfScope.id); if (h) hs = [h];
  } else {
    const g = grpOf(shelfScope.id); if (g) hs = groupItems(g).filter(i => HOST_TYPES.includes(i.type));
  }
  if (hs.length > 1) {
    const xs = hs.map(h => h.x), ys = hs.map(h => h.y), sx = Math.max(...xs) - Math.min(...xs), sy = Math.max(...ys) - Math.min(...ys);
    hs = hs.slice().sort((a, b) => sx >= sy ? a.x - b.x : a.y - b.y);
  }
  return hs;
}
function scopeKey(sc) { return sc === 'sel' ? 'sel' : sc.type + ':' + sc.id; }
function renderScopeSelect() {
  const el = $('#shelfScope'), cur = scopeKey(shelfScope);
  const hostsAll = S.items.filter(i => HOST_TYPES.includes(i.type) && !i.parent);
  let h = `<option value="sel">Gewähltes Regal/Schrank</option>`;
  if (S.groups.length) h += '<optgroup label="Gruppen">' + S.groups.map(g => `<option value="group:${g.id}">${esc(g.name)}</option>`).join('') + '</optgroup>';
  h += '<optgroup label="Einzeln">' + hostsAll.map(i => `<option value="item:${i.id}">${esc(i.name)}</option>`).join('') + '</optgroup>';
  el.innerHTML = h; el.value = cur;
  if (el.value !== cur) { el.value = 'sel'; shelfScope = 'sel'; }
}
const ratioCls = r => r > 1 ? 'r3' : r > 0.85 ? 'r2' : r > 0 ? 'r1' : '';

function renderShelf() {
  if (!shelfOpen) return;
  renderScopeSelect();
  $('#shelf').classList.toggle('wide', shelfWide); $('#shelfWide').textContent = shelfWide ? 'Schmal' : 'Breit';
  const body = $('#shelfBody'), hs = shelfHosts();
  if (!hs.length) {
    body.innerHTML = '<p class="muted">Kein Regal gewählt. Ein Regal oder einen Schrank im Plan anklicken oder oben eine Gruppe wählen.</p>';
  } else {
    const total = hs.reduce((s, h) => s + h.w, 0) + SHELF_GAP * (hs.length - 1), maxH = Math.max(...hs.map(h => h.h));
    const scale = clamp((body.clientWidth - 24) / total, 0.55, 2.2), W = total, H = maxH + SHELF_TOP + 6;
    const yS = y => SHELF_TOP + maxH - y;
    let g = '', X0 = 0;
    hs.forEach(h => {
      const st = ST.items[h.id], P = PROF[h.type];
      g += `<text class="shn" x="${X0 + h.w / 2}" y="14">${esc(h.name)}</text>`;
      g += `<rect class="sframe" x="${X0}" y="${yS(h.h)}" width="${h.w}" height="${h.h}"/>`;
      if (h.type === 'tisch') g += `<rect class="sboard" x="${X0}" y="${yS(h.h)}" width="${h.w}" height="${P.tb}"/>`;
      h.cells.forEach((col, f) => col.forEach((c, l) => {
        const cg = cellGeom(h, f, l), s = st.cells[f][l], chShow = Math.min(cg.ch, 90), ox = X0 + h.w / 2, cx = ox + cg.x0;
        const isCur = selCell && selCell.id === h.id && selCell.f === f && selCell.l === l;
        if (h.type !== 'tisch') g += `<rect class="sboard" x="${cx - P.wt}" y="${yS(cg.y)}" width="${cg.iw + 2 * P.wt}" height="${P.tb}"/>`;
        g += `<rect class="scell ${ratioCls(s.ratio)} ${isCur ? 'cur' : ''}" data-h="${h.id}" data-f="${f}" data-l="${l}" data-ox="${ox}" x="${cx}" y="${yS(cg.y + chShow)}" width="${cg.iw}" height="${chShow}"/>`;
        g += `<text class="sctx" x="${cx + 2}" y="${yS(cg.y + chShow) + 7}">${h.fields > 1 ? 'F' + (f + 1) + ' · ' : ''}E${l + 1} · ${fmt(s.load)}/${fmt(s.max)} kg</text>`;
        st.kids.filter(k => k.parent.f === f && k.parent.l === l).sort((a, b) => a.parent.z - b.parent.z).forEach(k => {
          const [ew] = effDims(k), ks = ST.items[k.id], bx = cx + k.parent.x;
          const fs = clamp((ew * 0.9) / (Math.max(k.name.length, 6) * 0.52), 3.5, 6.5);
          g += `<rect class="sbox ${sel && sel.id === k.id ? 'sel' : ''} ${ST.bad.has(k.id) ? 'bad' : ''} ${k.locked ? 'lock' : ''}" data-box="${k.id}" x="${r1(bx)}" y="${r1(yS(cg.y + k.h))}" width="${ew}" height="${k.h}" fill="${k.color}" fill-opacity=".92"/>`;
          g += `<text class="stxt" style="font-size:${r1(fs)}px" x="${r1(bx + ew / 2)}" y="${r1(yS(cg.y + k.h / 2) - 1)}">${esc(k.name)}</text><text class="stxt" style="font-size:${r1(fs * 0.9)}px;font-weight:500" x="${r1(bx + ew / 2)}" y="${r1(yS(cg.y + k.h / 2) + fs)}">${fmt(ks.total)} kg</text>`;
        });
      }));
      X0 += h.w + SHELF_GAP;
    });
    body.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="${r1(W * scale)}" height="${r1(H * scale)}">${g}</svg>`;
  }
  // Pool: Kisten am Boden
  const pool = S.items.filter(k => k.type === 'kiste' && !k.parent);
  $('#shelfPool').innerHTML = `<h4>Kisten am Boden – in ein Fach ziehen. Hierher ziehen, um eine Kiste aus dem Fach zu nehmen.</h4>` +
    (pool.map(k => `<div class="pcard ${sel && sel.id === k.id ? 'sel' : ''}" data-box="${k.id}"><span class="sw" style="background:${k.color}"></span>${esc(k.name)} <small>${fmt(ST.items[k.id].total)} kg</small></div>`).join('') || '<span class="muted">Keine Kisten am Boden.</span>');
}

/* ---------- Ziehen & Ablegen ---------- */
function hitAt(x, y) {
  const el = document.elementFromPoint(x, y); if (!el) return null;
  const c = el.closest('.scell'); if (c) return {type: 'cell', el: c};
  if (el.closest('#shelfPool')) return {type: 'pool', el: $('#shelfPool')};
  return null;
}
function clearHot() { document.querySelectorAll('#shelf .hot').forEach(n => n.classList.remove('hot')); }
function dropOn(k, hit, e) {
  if (!hit) return false;
  if (hit.type === 'pool') {
    if (!k.parent) return false;
    unplace(k, findItem(k.parent.id)); return true;
  }
  const d = hit.el.dataset, h = findItem(d.h); if (!h) return false;
  const svgEl = hit.el.ownerSVGElement, m = svgEl.getScreenCTM().inverse(), p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m);
  const rot = k.parent ? k.parent.rot : 0;
  placeInCell(k, h, +d.f, +d.l, p.x - (+d.ox), null, rot, e.altKey);
  return true;
}
document.addEventListener('pointerdown', e => {
  const bx = e.target.closest('#shelf [data-box]'); if (!bx || e.button) return;
  const k = findItem(bx.dataset.box); if (!k) return;
  e.preventDefault();
  sd = {id: k.id, sx: e.clientX, sy: e.clientY, moved: false, ghost: null, locked: k.locked};
});
window.addEventListener('pointermove', e => {
  if (!sd) return;
  if (!sd.moved && Math.hypot(e.clientX - sd.sx, e.clientY - sd.sy) < 6) return;
  if (sd.locked) return;
  const k = findItem(sd.id); if (!k) return;
  sd.moved = true;
  if (!sd.ghost) { sd.ghost = document.createElement('div'); sd.ghost.className = 'sghost'; sd.ghost.textContent = k.name; document.body.appendChild(sd.ghost); }
  sd.ghost.style.left = e.clientX + 'px'; sd.ghost.style.top = e.clientY + 'px';
  clearHot();
  const hit = hitAt(e.clientX, e.clientY); if (hit) hit.el.classList.add('hot');
});
window.addEventListener('pointerup', e => {
  if (!sd) return;
  const cur = sd; sd = null;
  if (cur.ghost) cur.ghost.remove();
  clearHot();
  const k = findItem(cur.id); if (!k) return;
  if (!cur.moved) { select({kind: 'item', id: k.id}); return; }
  const hit = hitAt(e.clientX, e.clientY);
  if (dropOn(k, hit, e)) { sel = {kind: 'item', id: k.id}; commit(); refresh({rebuild: true}); }
});
window.addEventListener('pointercancel', () => { if (sd) { if (sd.ghost) sd.ghost.remove(); sd = null; clearHot(); } });

document.addEventListener('click', e => {
  const c = e.target.closest('#shelf .scell'); if (!c) return;
  const h = findItem(c.dataset.h); if (!h) return;
  sel = {kind: 'item', id: h.id}; selCell = {id: h.id, f: +c.dataset.f, l: +c.dataset.l};
  openCells.add(`${h.id}:${c.dataset.f}:${c.dataset.l}`);
  refresh({rebuild: true});
});
$('#shelfBtn').onclick = () => { if (shelfOpen) closeShelf(); else openShelf(shelfScope === 'sel' && !shelfLast && !(sel && sel.kind === 'item' && HOST_TYPES.includes((topOf(findSel()) || {}).type)) ? (S.groups[0] ? {type: 'group', id: S.groups[0].id} : 'sel') : shelfScope); };
$('#shelfClose').onclick = closeShelf;
$('#shelfWide').onclick = () => { shelfWide = !shelfWide; renderShelf(); };
$('#shelfScope').onchange = e => {
  const v = e.target.value; shelfScope = v === 'sel' ? 'sel' : {type: v.split(':')[0], id: v.split(':')[1]};
  renderShelf();
};
window.addEventListener('resize', () => { if (shelfOpen) renderShelf(); });
