# Gemeinsamen Plan einrichten (kostenlos, ohne Konto für die Nutzer)

Alle, die den **vollständigen Link** (mit `#k=…`) haben, können den Plan ansehen und bearbeiten – ohne E-Mail oder Konto.

## 1. Firebase (einmalig, mit Google-Konto)
1. https://console.firebase.google.com → **Projekt hinzufügen** (z. B. `seg-lager-erding`; Google Analytics abschalten).
2. Links **Build → Realtime Database → Datenbank erstellen**. Standort: *Belgien (europe-west1)*. Modus: *Gesperrter Modus* wählen.
3. Reiter **Regeln**: den kompletten Inhalt durch `docs/firebase-rules.json` ersetzen → **Veröffentlichen**.
4. Reiter **Daten**: die **Datenbank-URL** oben kopieren (z. B. `https://seg-lager-erding-default-rtdb.europe-west1.firebasedatabase.app`).
5. Diese URL in `config.js` bei `dbUrl` eintragen und committen.

## 2. Seite veröffentlichen (GitHub Pages)
Repository → **Settings → Pages** → Source: *Deploy from a branch*, Branch `main`, Ordner `/ (root)`.
Die Seite liegt dann unter `https://<benutzer>.github.io/SEG-Lager/`.

## 3. Link verteilen
Den Link mit Schlüssel öffnen, z. B. `https://<benutzer>.github.io/SEG-Lager/#k=DEIN-LANGER-SCHLÜSSEL`.
Beim ersten Öffnen oben **„Diesen Plan teilen“** klicken (lädt den aktuellen Plan hoch). Danach speichert jede Änderung automatisch,
und alle anderen sehen sie nach kurzer Zeit. Mit **„Link kopieren“** lässt sich der vollständige Link jederzeit wieder kopieren.

## Hinweise
- Der Schlüssel im Link ist das Passwort: wer den Link hat, kann bearbeiten. Weitergegebene Links lassen sich nur durch einen neuen Schlüssel sperren
  (neuen Schlüssel im Link verwenden, den Plan wieder teilen, alten Pfad in der Firebase-Konsole unter *Daten → plans* löschen).
- Bei gleichzeitigem Bearbeiten gewinnt die letzte Speicherung.
- Der kostenlose Spark-Tarif (1 GB Speicher, 10 GB Übertragung/Monat) reicht für das Lager deutlich.
