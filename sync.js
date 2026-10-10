'use strict';
/* Gemeinsamer Plan über die db-Funktion der Artifact-Seite (nur dort verfügbar).
   Dokument plans/main = {json, at}. Schreiben darf nur, wer die Seite bearbeiten darf (Editor/Eigentümer);
   alle anderen sehen den Plan live, aber ohne Änderungsmöglichkeit. */
(function () {
  if (!window.claude || !claude.use) return;
  const pill = $('#sync'), btn = $('#syncBtn');
  const stat = (txt, cls) => { pill.hidden = false; pill.textContent = txt; pill.className = 'pill ' + (cls || ''); };
  let doc = null, lastJson = null, writing = false, again = false, canWrite = false, first = true;

  async function push() {
    if (!doc || !canWrite) return;
    if (writing) { again = true; return; }
    const json = JSON.stringify(S);
    if (json === lastJson) return;
    writing = true; stat('Speichert …');
    try { await doc.set({json, at: Date.now()}); lastJson = json; stat('Gemeinsamer Plan · gespeichert', 'okk'); }
    catch (e) { stat('Speichern fehlgeschlagen', 'err'); }
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

  (async () => {
    let db = null, user = null;
    try { db = await claude.use('db'); user = await claude.use('user'); } catch (e) {}
    if (!db) { stat('Nur auf diesem Gerät gespeichert'); return; }
    canWrite = !!(user && user.canEdit && user.canEdit());
    RO = !canWrite; applyRO();
    doc = db.doc('plans/main');
    btn.onclick = async () => { btn.hidden = true; lastJson = ''; await push(); };
    doc.onSnapshot(snap => {
      if (snap.metadata.hasPendingWrites) return;
      const d = snap.exists ? snap.data() : null;
      if (!d || typeof d.json !== 'string') {
        if (canWrite) { stat('Noch nicht geteilt', 'warn'); btn.hidden = false; }
        else stat('Noch kein gemeinsamer Plan', 'warn');
        return;
      }
      btn.hidden = true;
      if (d.json === lastJson) { stat(canWrite ? 'Gemeinsamer Plan · gespeichert' : 'Gemeinsamer Plan · nur Ansicht', canWrite ? 'okk' : ''); return; }
      if (canWrite && lastJson !== null && JSON.stringify(S) !== lastJson) return; // eigene ungespeicherte Änderung hat Vorrang
      applyRemote(d.json);
      stat(canWrite ? 'Gemeinsamer Plan · gespeichert' : 'Gemeinsamer Plan · nur Ansicht', canWrite ? 'okk' : '');
    }, () => stat('Verbindung zum gemeinsamen Plan verloren', 'err'));
  })();
})();
