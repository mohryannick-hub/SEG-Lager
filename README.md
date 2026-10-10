# SEG-Lager Planer – BRK Bereitschaft Erding

Statische Web-App (kein Build nötig): `index.html` im Browser öffnen. three.js liegt unter `vendor/`, die App läuft komplett offline.

- Raum mit Maßen, **Schiebetür** (Öffnung, Schieberichtung, Laufweg, freizuhaltender Durchgang) und Stützpfeilern
- Objekte: Metallschrank (Flügeltüren), Schwerlastregal, Rollwagen, Kiste, Tisch
- **2D-Grundriss und 3D-Ansicht** (Umschalter oben im Plan): Ebenen/Fächer sichtbar, Kisten per Ziehen in Fächer stellen, verschieben, Fächer wechseln; alternativ bei der Kiste unter „Standort“ wählen
- Pro Objekt: Position, Drehung, Maße, Felder × Ebenen, Fachlast, Feldlast, Eigengewicht
- **Inhalt für jedes Objekt/Fach**: Bezeichnung, Menge, Gewicht je Stück (Summe wird berechnet); eingestellte Kisten zählen zur Fach-/Feldlast des Wirts
- Prüfung: Fach-/Feldlast, Bodenbelastung, Kollisionen, passt die Kiste ins Fach, blockierte Türen/Freiräume
- **Regalansicht** (Seitenfenster): Frontansicht eines Regals/Schranks oder einer ganzen Gruppe; Kisten per Ziehen zwischen Fächern verschieben, aus dem Pool „Kisten am Boden“ einsortieren oder wieder herausnehmen, Fachauslastung farbig
- **Fixieren**: gesperrte Objekte (Schloss-Symbol) lassen sich weder ziehen noch drehen noch löschen; Inhalt bleibt editierbar
- **Gruppen** für Regale/Schränke, Ein-/Ausblenden einzelner Objekte oder Gruppen, „Nur diese anzeigen“ (Gruppe oder Objekt)
- **Dunkelmodus** (folgt dem System, per Knopf umschaltbar)
- Autosave (localStorage), Undo/Redo, JSON-Export/-Import, Druckansicht mit Packliste

Die Raummaße im Beispielplan (900 × 600 cm) sind Platzhalter.
