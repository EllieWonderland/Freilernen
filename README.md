# Freilernen

Kleine Web App für Schülerinnen der Klassen 5 und 6: Fach wählen und sehen, welche Themen laut den niedersächsischen Kerncurricula (IGS) dazugehören. Themen lassen sich abhaken, aufbauende Themen sind mit Stufenzahlen verknüpft, und ein Wochenziel mit 5 Stempeln motiviert ohne Pflichtgefühl.

App: https://elliewonderland.github.io/Freilernen/

Status: Mathe (39 Themen), Deutsch (62), Englisch (78), Spanisch (82) und Musik (43) sind fertig. NaWi und Gesellschaftslehre folgen.

## Aufbau

- `index.html`, `style.css`, `app.js`: die App, ohne Build-Schritt
- `data/mathe.json`: Themen eines Fachs (Erklärung, Beispiele, Vorstufen, Quelle)
- `sw.js`, `manifest.webmanifest`: Offline-Nutzung und „Zum Startbildschirm hinzufügen“
- `docs/plan.md`: der ursprüngliche Plan

Häkchen und Stempel werden nur im Browser des jeweiligen Geräts gespeichert (localStorage). In den Einstellungen lassen sie sich als Datei sichern und wiederherstellen.

## Neues Fach hinzufügen

1. `data/<fach>.json` nach dem Muster von `data/mathe.json` anlegen.
2. In `app.js` beim Fach in `FAECHER` die Zeile `datei: "data/<fach>.json"` ergänzen.
3. Die Datei in `sw.js` in `DATEIEN` eintragen und den Cache-Namen hochzählen.
