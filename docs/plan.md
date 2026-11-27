# Plan: Themen-App für Klasse 5 und 6

Stand: 27.11.2026 · Originaldokument: https://claude.ai/artifact/94tMvAYbDTPmT3o5cbMFH8

## Ziel

Die beiden Mädchen wählen ein Fach und sehen eine übersichtliche, kindgerecht formulierte Liste der Themen aus dem Lehrplan. Die Klassenstufe steht nur als Hinweis dabei und lässt sich als Filter nutzen. Die App soll Orientierung geben, keine Lernplattform sein: Sie beantwortet die Frage „Was könnte ich mir als Nächstes ansehen?“. Erste Version bewusst klein, damit sie schnell nutzbar ist.

## Inhaltliche Grundlage

Grundlage sind die niedersächsischen Kerncurricula (KC) für die Integrierte Gesamtschule, veröffentlicht auf dem Bildungsserver NiBiS. Jedes Thema wird kindgerecht formuliert und mit Quelle (Dokument, Seite) gespeichert.

| Fach in der App | Grundlage an der IGS |
| --- | --- |
| Mathe | KC Mathematik |
| Deutsch | KC Deutsch |
| Englisch | KC Englisch |
| Spanisch | KC Spanisch (zweite Fremdsprache, für beide Töchter) |
| NaWi | KC Naturwissenschaften (Biologie, Chemie, Physik gemeinsam) |
| Gesellschaftslehre | KC Gesellschaftslehre (Erdkunde, Geschichte, Politik gemeinsam) |
| Musik | KC Musik |

Politik und Geschichte erscheinen wie an der IGS als ein Fach Gesellschaftslehre, zusammen mit Erdkunde. Innerhalb des Fachs sind die Themen nach Bereichen gruppiert, sodass Erdkunde, Geschichte und Politik trotzdem erkennbar bleiben.

Die KC beschreiben meist, was am Ende von Klasse 6 erreicht sein soll, und trennen 5 und 6 nicht. Ich zeige dann „Klasse 5/6“ und nutze die Stufenzahlen, damit trotzdem sichtbar wird, was früher und was später dran ist.

Die Reihenfolge der Themen (welches Thema auf welchem aufbaut) steht so nicht im KC. Die lege ich fachlich fest und markiere sie als Vorschlag zum Gegenlesen. In Mathe und den Sprachen wird es viele Stufen geben, in Geschichte, Politik und Musik eher wenige.

## Bildschirme und Funktionen

**Hauptbildschirm**

- Oben das Wochenziel: ein Balken mit 5 Stempelfeldern. Die beiden stempeln selbst, wann sie möchten. Am Montag beginnt eine neue Woche. Stempeln und Abhaken sind unabhängig, viele Häkchen füllen also nicht automatisch das Wochenziel.
- Darunter die Fächer als große Kacheln mit Farbe und Symbol. Eine Klassenstufe wird nicht ausgewählt.
- Kein Fortschrittsbalken auf diesem Bildschirm.

**Themenliste eines Fachs**

- Filter oben, frei kombinierbar:
  - Stand: „Alle“, „Das könnte ich mir noch ansehen“, „Das habe ich schon geschafft“
  - Klassenstufe: vorerst „5/6“, später erweiterbar um 7/8 und 9/10
  - Art: „Kleines Einzelthema“ oder „Teil einer Reihe“
- Schnell abhaken: Weil am Anfang vieles schon bekannt sein wird, lassen sich in der Liste mehrere Themen auf einmal als geschafft markieren. Wird ein Thema abgehakt, dessen Vorstufen noch offen sind, zeigt die App diese Vorstufen mit dem Vorschlag „Schau doch mal kurz rein“ und einem Knopf, der direkt dorthin springt. Abgehakt wird dort dann bewusst, nie automatisch.
- Themen gruppiert nach Bereichen, jedes mit Markierung links:

| Situation | Markierung |
| --- | --- |
| Einzelthema, noch nicht bearbeitet | oranger Punkt |
| Einzelthema, geschafft | grüner Punkt mit Häkchen |
| Teil einer Reihe, Vorstufen noch nicht alle geschafft | Stufenzahl auf blauem Grund |
| Teil einer Reihe, Vorstufen geschafft, Thema selbst noch offen | Stufenzahl auf orangem Grund |
| Teil einer Reihe, selbst geschafft | Stufenzahl auf grünem Grund mit Häkchen |

Die Stufenzahl ist die Länge der längsten Kette davor plus eins. Beispiel: Zahlen bis 100 hat keine Vorstufe (Punkt), Addieren ist 2, Malrechnen ist 3. Hat ein Thema zwei Vorstufen, zählt die höhere.

**Themenseite**

- Schnellerklärung in zwei, drei Sätzen.
- Ein bis drei Beispiele.
- Ein oder mehrere passende YouTube Videos als Link.
- „Baut auf“ mit Link zur Vorstufe, und umgekehrt „Darauf baut auf“ mit Link zum nächsten Thema.
- Klassenstufe als kleiner Hinweis, zum Beispiel „oft in Klasse 5/6“.
- Knopf „Geschafft“ zum Abhaken (wieder rückgängig machbar).
- Formulierungen ohne Pflichtton, also „Das könntest du dir ansehen“ statt „Das musst du können“.

**Einstellungen**

- Fortschritt pro Fach als Balken.
- Daten sichern und wiederherstellen (siehe Technik).

## Ehrliche Hinweise

- **Blau statt Rot (entschieden).** Blau wirkt neutral und lässt sich gut von Orange und Grün unterscheiden, auch bei einer Farbsehschwäche. Zusätzlich bekommt „geschafft“ ein Häkchen, damit die Markierung nicht nur an der Farbe hängt.
- **YouTube Links veralten.** Videos werden gelöscht oder umbenannt. Ich wähle Videos von bekannten Bildungskanälen aus, kann sie aber nicht ansehen, nur ihre Beschreibung lesen. Ihr solltet sie vor der Freigabe einmal anschauen. Ob die beiden YouTube auf dem Handy nutzen dürfen, ist eure Entscheidung.
- **Der Inhalt ist die eigentliche Arbeit.** Sieben Fächer ergeben für 5/6 grob geschätzt 150 bis 250 Themen, jedes mit Erklärung, Beispielen und Videos. Das Programm selbst ist schnell gebaut, die Inhalte brauchen mehrere Runden und euer Gegenlesen. Deshalb starte ich mit einem Fach.

## Technik und Ablauf

Eine Web App, die im Handybrowser läuft, sich auf den Startbildschirm legen lässt und danach auch ohne Internet funktioniert. Nur die Videos brauchen Netz. Es gibt keine Konten. Stempel und Häkchen bleiben auf dem jeweiligen Handy.

Das hat einen Haken: Wird der Browserspeicher gelöscht oder das Handy gewechselt, sind die Häkchen weg. Deshalb gibt es in den Einstellungen „Daten sichern“ (eine kleine Datei) und „Wiederherstellen“. Eine automatische Synchronisierung zwischen Geräten würde einen Server brauchen und ist nicht geplant. Veröffentlicht wird die App kostenlos über GitHub Pages aus dem Repository „Freilernen“ im Konto EllieWonderland. Im kostenlosen GitHub Tarif funktioniert Pages nur mit einem öffentlichen Repository. Darin stehen nur Programm und Themen, keine Namen oder Häkchen der beiden.

**Ablauf**

1. KC der IGS lesen und für Mathe eine Themenliste 5/6 mit Stufen und Quellen erstellen. Die bekommst du zum Gegenlesen.
2. App mit Mathe als Musterfach bauen, inklusive Erklärungen, Beispielen und Videos.
3. Die beiden testen auf ihren Handys, wir passen an.
4. Die übrigen Fächer nacheinander ergänzen, jedes erst als Liste zum Gegenlesen.

## Entscheidungen

- Schulform: IGS.
- Fächer: Mathe, Deutsch, Englisch, Spanisch, NaWi, Gesellschaftslehre (mit Erdkunde), Musik.
- Gerät: die eigenen Handys der beiden.
- Auswahl nur nach Fach, Klassenstufe als Hinweis und Filter.
- Stempel setzen die beiden selbst.
- Blau statt Rot für „Vorstufen noch offen“.
- Schnell abhaken mit Vorschlag zur Vorstufe statt automatischem Mitabhaken.
- Veröffentlichung über GitHub Pages, Repository „Freilernen“.
