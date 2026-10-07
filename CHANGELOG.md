# Changelog

Alle nennenswerten Änderungen an 7MOVEUP. Neueste oben.

## 1.7.1 – 2026-10-07

- **Messkarte wie die Trainingszeile:** Ist die geplante Anzahl erfasst, steht der Name durchgestrichen mit grünem Haken rechts – ohne „Erfassen“-Knopf, genau wie ein erledigtes Training. Offene Karten behalten den Knopf. Ein Tipp auf die erledigte Zeile erlaubt weiterhin eine zusätzliche Messung.

## 1.7.0 – 2026-10-07

- **Fortschritt neu geordnet:** Oben stehen **Messwerte | Plan | Erfassen**, direkt darunter der Link „Meine erfassten Werte“. Die Fortschrittsanalyse (3 Kacheln, Messwert, 30 Tage / 365 Tage / Gesamt, Linienchart, Entwicklung, Ø / Min / Max) bleibt, wo sie war. Solange noch keine Messung existiert, steht dort die kurze Erklärung „So funktioniert’s“.
- **Messwerte** (Katalog, Reihenfolge, eigene Werte, Einheiten) und **Plan** (Messpläne) sind eigene Seiten mit Zurück-Knopf. **Erfassen** zeigt oben die für heute geplanten Messungen und darunter „Freie Messung“.
- **Messpläne:** beliebig viele, je mit Name, Messwerten, Wochentagen und Messungen pro Tag (1–5, nur Richtwert). Auf Heute, Erfassen und im Kalender erscheint **eine Karte pro Plan** („Blutdruck · 3× geplant · bereits 2“) mit dem Knopf „Erfassen“. Mehr Messungen als geplant sind jederzeit möglich. Eine freie Messung hakt nie einen Plan ab.
- **Meine erfassten Werte:** alle Messungen, neueste zuerst, Filter Jahr/Monat/Tag, in 10er-Schritten geladen („Weitere laden“), Antippen = bearbeiten oder löschen. Blutdruck als „118 / 72 mmHg · Puls 64“.
- **Mehrere Messungen am Tag:** Der Linienchart zeigt pro Tag einen Punkt (Tagesdurchschnitt, Tooltip „Ø 118,7 mmHg · 3 Messungen“); Kacheln, Entwicklung, Ø, Min und Max rechnen mit den Tageswerten. Die Einzelmessungen bleiben unverändert gespeichert. Für Blutdruck (oben/unten) gibt es unter dem Chart eine **Verteilung** aller Einzelmessungen in 10er-Klassen.
- **Blutdruck und Puls im Katalog:** Blutdruck oben (sys.), unten (dia.) in mmHg und Puls in bpm, zunächst inaktiv. Keine Bewertung. Messungen haben ein optionales Notizfeld.
- **Bisherige Messtage** werden automatisch zum Plan „Körperwerte“ (1× täglich, bisherige Werte). Neue Messwerte gehören erst dazu, wenn du sie im Plan anhakst. Messungen und Backups bleiben erhalten; ältere Backups lassen sich importieren.

## 1.6.1 – 2026-10-07

- **Video-Hinweis:** Vor dem Abspielen steht jetzt ausdrücklich, dass der YouTube-Player (Google) erst beim Tippen geladen wird und dabei Daten an YouTube übertragen werden.

## 1.6.0 – 2026-10-06

- **„Neu hier?“-Seite:** kurze Erklärung in vier Schritten, der Hinweis „Deine Daten liegen nur auf diesem Handy“ mit Backup-Knopf (Tipp: einmal pro Woche, in iCloud Drive ablegen), Anleitung zum Installieren für iPhone (Safari) **und Android (Chrome)** und Tipps. Auf Heute erscheint für neue Nutzer (noch kein Training) eine einmalige, wegtippbare Karte; dauerhaft erreichbar unter Mehr → „Neu hier? Kurz erklärt“.
- **Scrollen auf iOS:** Die Viewport-Reparatur (kleiner 1-px-Scroll nach Seitenwechsel) greift nicht mehr ein, wenn man schon scrollt – das konnte das Wischen ruckeln lassen.

## 1.5.0 – 2026-10-06

- **Equipment sichtbar:** Das Equipment der Übung steht jetzt in der grauen Zeile unter dem Namen – in „Training bearbeiten“, in der Übungsliste und im Training („Kurzhanteln, Hantelbank“, bei mehr als zwei Geräten „+1“). „Körpergewicht“ allein wird nicht angezeigt.

## 1.4.0 – 2026-10-06

- **Notizen & Videos im Plan-Editor:** Jede Übung in „Training bearbeiten“ hat den i-Button wie im Training. Notiz und Video-Links lassen sich schon am Vortag ansehen und bearbeiten, ohne das Training zu starten. Die Notiz gilt weiter für die Übung in allen Plänen und Trainings.

## 1.3.1 – 2026-10-06

- **Ton iPhone:** Pieptöne (Pause, Zeitübung, „Ton testen“) sind auch bei Lautlos-Schalter hörbar (`navigator.audioSession = playback`); Musik anderer Apps pausiert dabei kurz.

## 1.3.0 – 2026-10-05

Körperwerte, neue Navigation, eigene Geräte. Auf dem Handy getestet (Preview `feature-koerperwerte`).

### Neu

- **Körperwerte erfassen:** Gewicht, Körperfett, Wasser, Muskel (kg), Knochen, kcal (Waage), BMI, Bauchumfang als Standard; Muskel (%), Hüfte, Brust, Oberarm, Oberschenkel zuschaltbar; eigene Messwerte mit Name, Einheit und Schrittweite.
- **Schnellerfassung:** letzter Wert als grauer Vorschlag (✓ übernimmt), −/+ und direkte Eingabe, Datum und optionale Uhrzeit. Gespeichert wird nur Bestätigtes; erneutes Erfassen am selben Tag ergänzt die vorhandene Messung.
- **Messwerte verwalten** (Fortschritt → Messwerte): aktivieren/deaktivieren, sortieren, eigene Werte anlegen/bearbeiten, Messtage, Einheiten.
- **Messtage:** an gewählten Wochentagen zeigt Heute „Körperwerte erfassen“.
- **Fortschritt:** drei Kacheln (Gewicht, Körperfett, Muskel), Analyse mit 30 Tage · 365 Tage · Gesamt, eigenes Liniendiagramm, Entwicklung (bzw. „Zu wenige Werte“), Ø · Min · Max.
- **Metrisch/Imperial** (Mehr bzw. Messwerte): Anzeige in kg/cm oder lb/in; gespeichert wird immer metrisch und ungerundet.
- **Kalender:** Körperwerte erscheinen wie ein Training: weißer Punkt im Raster an jedem Messtag und an Tagen mit Messung (Vergangenheit, heute, Zukunft). Unter dem Raster steht pro Tag eine einzige Liste – grüner Haken = erledigt, gelber leerer Kreis = offen; „Körperwerte erfassen“ mit Pfeil öffnet die Erfassung (auch zum Nachtragen). Keine Überschriften „Geplant“/„Abgeschlossen“.
- **Geräte:** neue Standardgeräte Langhantel, Kraftmaschine, Kabelzug, Klimmzugstange, Widerstandsband. Eigene Geräte lassen sich bei eigenen Übungen einmal anlegen und sind danach überall wählbar und im Übungsfilter; gleiche Namen (auch zu Standardgeräten) werden erkannt.
- **Backup-Datum:** Mehr → Daten zeigt „Letztes Backup: vor X Tagen“ / „Noch kein Backup erstellt“; Heute zeigt unten eine kleine Zeile, hervorgehoben mit „Backup erstellen“ ab 7 Tagen und neuen Daten.

### Geändert

- **Navigation:** Heute · Training · Fortschritt · Essen · Mehr. Übungen sind ein Tab in Training; der Kalender öffnet sich über „Kalender öffnen“ auf Heute (eigene Seite `/calendar`).
- **Ein Plan:** Eine Vorlage zu übernehmen ersetzt nach Rückfrage den aktuellen Plan (alle Trainingstage). Absolvierte Trainings bleiben unverändert.
- **Heute vereinfacht:** heute fällig (Trainings + Messtag, „x von y erledigt“), „Als Nächstes“, Woche kompakt. „Letztes Training“ entfällt.
- **Schnellerfassung ohne Vorwert:** Eingabefeld deutlich sichtbar („Wert eingeben“), − / + setzen den Cursor ins Feld; Fortschritt-Kacheln ohne Wert öffnen direkt die Erfassung.
- **Übungsfilter:** zeigt nur Geräte, für die es Übungen gibt (inkl. eigener Geräte).
- **Backup-Format Version 2:** enthält Körperwerte, Messwert-Einstellungen, Einheit und eigene Geräte. Backups der Version 1 lassen sich weiterhin importieren.

### Daten

- IndexedDB Version 2: nur neue Tabellen `bodySettings` und `measurements`. Bestehende Trainingsdaten werden nicht verändert.

## 1.2.0 – 2026-10-05

- Zeit-, Cardio- und Pausen-Timer überstehen Bildschirmsperre und App-Neustart (Endzeit wird im offenen Training gespeichert; abgelaufene Sätze werden mit voller Zeit abgehakt).
- Start auf Heute springt in ein offenes Training, das vor höchstens 6 Stunden begann.
- Cardio-Karte mit Timer-Button.
- Heute: „Erledigt“ erst, wenn alle geplanten Trainings fertig sind, sonst „x von y erledigt“.

## 1.1.2 – 2026-10-05

- i-Button bei jeder Übung im Training: Notiz und Video-Links ansehen/bearbeiten, ohne das Training zu verlassen.
- iOS: Bottom-Navigation verrutscht nach Tastatur/Seitenwechsel nicht mehr.

## 1.1.1 – 2026-10-05

- iOS: Pausen-Countdown piept zuverlässig nach Sperre/App-Wechsel; Bildschirm bleibt während des Trainings an; Haptik beim Abhaken.

## 1.1.0 – 2026-10-04

- Tagesspruch Wort für Wort, Profil-Chip, Abdeckung über der Navigation.
- Deployment über Cloudflare Workers.

## 1.0.0 – 2026-10-04

- Erste Version: lokale Fitness-PWA mit Plänen, Vorlagen, Training, Übungsbibliothek, Kalender, Backup (DE/EN).
