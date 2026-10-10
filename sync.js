'use strict';
/* Gemeinsamer Plan. Zwei Anbieter, derselbe Ablauf:
   1) Artifact-Seite auf claude.ai: db-Funktion (Schreiben je nach Freigabe-Stufe).
   2) Eigene Seite (z. B. GitHub Pages): Firebase Realtime Database über REST/EventSource, Zugriff über Schlüssel im Link (#k=…).
   Dokument: {json, at}. Ohne Anbieter läuft die App rein lokal. */
(function () {
  const pill = $('#sync'), btn = $('#syncBtn'), linkBtn = $('#linkBtn');
  const stat = (txt, cls) => { pill.hidden = false; pill.textContent = txt; pill.className = 'pill ' + (cls || ''); };

  /* ---------- Anbieter: claude.ai db ---------- */
  const claudeAdapter = () => ({
    async init() {
      let db = null, user = null;
      try { db = await claude.use('db'); user = await claude.use('user'); } catch (e) {}
      if (!db) return null;
      let cw = null; try { cw = user && user.can ? await user.can('data.write') : null; } catch (e) {}
      this.doc = db.doc('plans/main');
      return {canWrite: !!user && cw !== false};
    },
    subscribe(cb, err) {
      this.doc.onSnapshot(snap => {
        if (snap.metadata.hasPendingWrites) return;
        const d = snap.exists ? snap.data() : null;
        cb(d && typeof d.json === 'string' ? d.json : null);
      }, err);
    },
    write(json) { return this.doc.set({json, at: Date.now()}); },
  });

  /* ---------- Anbieter: Firebase Realtime Database ---------- */
  const keyFromLink = () => {
    let k = null;
    const m = /[#&]k=([A-Za-z0-9_-]{20,})/.exec(location.hash);
    if (m) { k = m[1]; try { localStorage.setItem('seg-lager-key', k); } catch (e) {} history.replaceState(null, '', location.pathname + location.search + '#k=' + k); }
    else { try { k = localStorage.getItem('seg-lager-key'); } catch (e) {} }
    return k;
  };
  const rtdbAdapter = (base, key) => ({
    url: base.replace(/\/+$/, '') + '/plans/' + key + '.json',
    async init() { return {canWrite: true}; },
    subscribe(cb, err) {
      const es = new EventSource(this.url);
      const handle = e => {
        let m; try { m = JSON.parse(e.data); } catch (x) { return; }
        if (!m || m.path !== '/') return; // wir schreiben immer das ganze Dokument
        cb(m.data && typeof m.data.json === 'string' ? m.data.json : null);
      };
      es.addEventListener('put', handle); es.addEventListener('patch', handle);
      es.onerror = () => err({code: 'unavailable'});
      es.onopen = () => this.onopen && this.onopen();
    },
    async write(json) {
      const r = await fetch(this.url, {method: 'PUT', headers: {'Content-Type': 'text/plain'}, body: JSON.stringify({json, at: Date.now()})});
      if (!r.ok) { const e = new Error('http ' + r.status); e.code = r.status === 401 || r.status === 403 ? 'invalid_argument' : 'unavailable'; throw e; }
    },
  });

  /* ---------- gemeinsamer Ablauf ---------- */
  let ad = null, lastJson = null, writing = false, again = false, canWrite = false, first = true, shared = false;
  const okTxt = () => canWrite ? 'Gemeinsamer Plan · gespeichert' : 'Gemeinsamer Plan · nur Ansicht';

  async function push() {
    if (!ad || !canWrite) return;
    if (writing) { again = true; return; }
    const json = JSON.stringify(S);
    if (json === lastJson) return;
    writing = true; stat('Speichert …');
    try { await ad.write(json); lastJson = json; stat(okTxt(), 'okk'); }
    catch (e) {
      if (e && e.code === 'invalid_argument') { canWrite = false; RO = true; applyRO(); stat('Gemeinsamer Plan · kein Schreibrecht', 'err'); }
      else stat('Speichern fehlgeschlagen – wird erneut versucht', 'err');
    }
    writing = false;
    if (again) { again = false; push(); }
  }
  window.onPlanChanged = () => { if (lastJson !== null) push(); };

  function applyRemote(json) {
    let s; try { s = JSON.parse(json); } catch (e) { return; }
    S = normalizeState(s); lastJson = json;
    hist = [JSON.stringify(S)]; hIdx = 0;
    if (sel && !findSel()) sel = null;
    if (selCell && !findItem(selCell.id)) selCell = null;
    if (solo && !(solo.type === 'group' ? grpOf(solo.id) : findItem(solo.id))) solo = null;
    if (first) { first = false; fit(); }
    buildRoomTab(); refresh({rebuild: true, room: true});
  }

  async function start(adapter) {
    ad = adapter;
    const info = await ad.init();
    if (!info) { stat('Nur auf diesem Gerät gespeichert'); return; }
    canWrite = info.canWrite; RO = !canWrite; applyRO();
    btn.onclick = async () => { btn.hidden = true; lastJson = ''; await push(); };
    ad.subscribe(json => {
      if (json === null) {
        shared = false;
        if (canWrite) { stat('Noch nicht geteilt', 'warn'); btn.hidden = false; } else stat('Noch kein gemeinsamer Plan', 'warn');
        return;
      }
      shared = true; btn.hidden = true;
      if (json === lastJson) { stat(okTxt(), canWrite ? 'okk' : ''); return; }
      if (canWrite && lastJson !== null && JSON.stringify(S) !== lastJson) return; // eigene ungespeicherte Änderung hat Vorrang
      applyRemote(json); stat(okTxt(), canWrite ? 'okk' : '');
    }, () => stat('Verbindung unterbrochen – versucht erneut …', 'warn'));
  }

  if (window.claude && claude.use) { start(claudeAdapter()); return; }
  const cfg = window.SEG_CONFIG || {};
  if (cfg.dbUrl) {
    const key = keyFromLink();
    if (!key) { stat('Kein Zugangsschlüssel – bitte den vollständigen Link öffnen', 'warn'); return; }
    linkBtn.hidden = false;
    linkBtn.onclick = () => {
      const url = location.href.split('#')[0] + '#k=' + key;
      const done = () => { linkBtn.textContent = 'Kopiert ✓'; setTimeout(() => { linkBtn.textContent = 'Link kopieren'; }, 1500); };
      (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).then(done).catch(() => { prompt('Link zum Teilen:', url); });
    };
    start(rtdbAdapter(cfg.dbUrl, key));
  }
})();
