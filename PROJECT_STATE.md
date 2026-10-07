# 7MOVEUP – Projektstand

Stand: Version 1.6.1 (`main`, Cloudflare-Produktion), freigegeben nach dem Test der Preview auf dem Handy. Änderungen: [`CHANGELOG.md`](CHANGELOG.md).

## Grundsätze

- **Local-first:** alle Daten in IndexedDB auf dem Gerät. Kein Account, kein Supabase, keine Server-Datenbank, kein Cloud-Sync.
- **Datensicherung = Backup-Datei** (Mehr → Daten sichern / importieren). Gerätewechsel und Preview-Tests laufen über Export → Import.
- **Bestehende Daten gehen nie verloren:** Schema-Änderungen nur additiv (neue Tabellen, optionale Felder). Alte Backups bleiben importierbar.
- **Kein Overengineering:** eine Lösung pro Aufgabe, keine Archive, keine Statusmodelle, keine großen Bibliotheken.
- Freigabe für `main`, Produktion und Versionsnummer erfolgt erst nach dem Test auf dem Handy.

## Navigation

Feste Bottom-Navigation mit fünf Punkten:

| Punkt | Route(n) | Inhalt |
| --- | --- | --- |
| Heute | `/`, `/calendar` | Motivation, Training starten, heute fällig, als Nächstes, Woche kompakt, „Kalender öffnen“, Backup-Zeile |
| Training | `/training`, `/training/plans/:id`, `/training/session/:id`, `/exercises/…` | Tabs **Plan \| Übungen** – Plan, Vorlagen, Übungsbibliothek |
| Fortschritt | `/progress`, `/progress/metrics` | Körperwerte: 3 Kacheln, Analyse, Messwerte verwalten |
| Essen | `/food` | Coming Soon |
| Mehr | `/more` | Profil, Sprache, Einheiten, Ton/Haptik, Daten (Backup) |

Der Kalender hat keinen eigenen Navigationspunkt; er öffnet sich über „Kalender öffnen“ auf Heute und gehört in der Navigation zu Heute. Alte Links `/training?tab=calendar` leiten auf `/calendar` um.

## Entscheidungen

### Training

- **Genau ein persönlicher Plan** (= alle Trainingstage des Profils, auch selbst angelegte). Dazu beliebig viele Vorlagen.
- **Vorlage übernehmen ersetzt den Plan** nach Rückfrage (nennt die Anzahl der Trainingstage). Absolvierte Trainings bleiben unverändert – sie speichern Planname und Übungen selbst.
- Kein Planarchiv, keine Gültigkeitsdaten, kein Statusmodell.
- **Notizen & Videos** (persönlich, je Übung) sind an drei Stellen erreichbar: Übungsdetail, im Training (i-Button) und im Plan-Editor (i-Button) – überall dasselbe Fenster, dieselbe Notiz.
- Progression nur als Hinweis („Steigerung möglich“, „+2 kg“), nie automatisch.
- **Geräte:** feste Standardliste (Körpergewicht, Kurzhanteln, Langhantel, Kettlebell, Hantelbank, Kraftmaschine, Kabelzug, Klimmzugstange, Widerstandsband, Bauchrolle, Step, Ergometer/Cardio) plus **eigene Geräte**: einmal anlegen (Übung → „Eigenes Gerät“), lokal gespeichert, danach bei allen eigenen Übungen wählbar. Gleiche Namen – auch zu Standardgeräten, deutsch/englisch, Groß-/Kleinschreibung, Umlaute – werden erkannt und das vorhandene Gerät gewählt. Löschen nur, solange keine Übung das Gerät nutzt; Umbenennen gibt es (noch) nicht.
- **Anzeige:** Equipment steht als graue Kurzzeile unter dem Übungsnamen (Plan-Editor, Übungsliste, Training, Detail als Schilder): bis zu zwei Geräte, dann „+N"; „Körpergewicht“ allein wird nicht gezeigt (`equipmentSummary`).
- Der Übungsfilter zeigt nur Geräte, für die es mindestens eine Übung gibt.

### Heute

- Zeigt nur, was jetzt bzw. als Nächstes ansteht: heute geplante Trainings und (am Messtag) „Körperwerte erfassen“, mit „x von y erledigt“.
- „Als Nächstes“ = erster Tag nach heute (bis 14 Tage) mit Training oder Messtag.
- „Letztes Training“ entfällt – Verlauf steht im Kalender.

### Körperwerte

- **Standardwerte:** Gewicht, Körperfett, Wasser, Muskel (kg), Knochen, kcal (Waage), BMI, Bauchumfang – aktiv. Muskel (%), Hüfte, Brust, Oberarm, Oberschenkel – vorhanden, aber zunächst aus.
- **Eigene Messwerte:** Name + freie Einheit + Schrittweite (± 0,1 / 0,5 / 1). Einheit ist nach dem ersten Wert gesperrt; löschen nur, solange es keine Werte gibt. Eigene Werte werden nie umgerechnet.
- Messwerte lassen sich aktivieren/deaktivieren und sortieren; die Reihenfolge gilt für Erfassung und Fortschritt. Deaktivierte Werte mit vorhandenen Daten bleiben auswertbar.
- **BMI** ist ein normaler Messwert (z. B. von der Waage), wird nie berechnet.
- **Muskel kg und Muskel %** sind getrennte Messwerte (nicht umrechenbar).
- **Einheiten:** gespeichert immer in kg / cm / % / kcal, ungerundet. Metrisch/Imperial ist nur Anzeige (kg ↔ lb, cm ↔ in). Schrittweiten: Gewicht 0,1 kg (0,2 lb), Körperfett/Wasser 0,1 %, Umfänge 0,5 cm (0,25 in), kcal 10.
- **Schnellerfassung:** letzter Wert erscheint grau als Vorschlag und wird nie automatisch gespeichert. Gespeichert wird nur, was bestätigt (✓), mit −/+ geändert oder eingetippt wurde. Erster Wert eines Messwerts: leeres Feld. Unplausible Werte → Hinweis, negative/ungültige → nicht speicherbar.
- **Eine Messung pro Tag:** erneutes Erfassen am selben Tag ergänzt/ändert die vorhandene Messung. Lokales Datum (`yyyy-MM-dd`) + optionale Uhrzeit.
- **Messtage:** frei wählbare Wochentage (Standard: keine). Am Messtag zeigt Heute „Körperwerte erfassen“. Im Kalender sind Körperwerte ein Eintrag wie ein Training: weißer Punkt an jedem Messtag und an Tagen mit Messung; in der Tagesliste (eine Liste, offen oben, erledigt unten) gelber leerer Kreis = offen, grüner Haken = erfasst. Pfeil → Erfassung für diesen Tag (heute/vergangen, auch Nachtragen), bei Zukunft ohne Pfeil. Trainings stehen im selben Format; ein absolviertes Training ersetzt seinen offenen Eintrag. „Erfasst“ = mindestens ein Wert an dem Tag.
- Ohne Vorwert ist das Eingabefeld sichtbar leer („Wert eingeben“); − / + setzen dann den Cursor ins Feld. Fortschritt-Kacheln ohne Wert öffnen direkt die Erfassung.

### Fortschritt

- Drei Kacheln (Standard: Gewicht, Körperfett, Muskel) mit Wert, Einheit, Datum der letzten Messung; Antippen wählt den Messwert für die Analyse.
- Ein Analysebereich: Messwert-Auswahl, Zeitraum **30 Tage · 365 Tage · Gesamt** (rollierend: heute + 29 bzw. 364 vorherige lokale Tage).
- Eigenes SVG-Liniendiagramm (keine Chart-Bibliothek), Antippen zeigt Wert und Datum.
- **Entwicklung** = neuester minus erster Wert im Zeitraum; bei weniger als 2 Werten „Zu wenige Werte“. Dazu Ø · Min · Max.
- Zugang zur Verwaltung über „Messwerte“.

### Messpläne und Fortschritt

- Seiten unter Fortschritt: `/progress` (Analyse, unverändert) mit Knöpfen **Messwerte** (`/progress/metrics`) | **Plan** (`/progress/plan`) | **Erfassen** (`/progress/capture`) und Link **Meine erfassten Werte** (`/progress/values`); Unterseiten mit Zurück-Knopf (`SubHeader`).
- `BodySettings.plans` (`MeasurePlan`: id, name, metricKeys?, weekdays, perDay 1–5 als Richtwert). Fehlt `plans` (ältere Daten/Backups), macht `normalizeBodySettings` aus `measureWeekdays` einen Plan `legacy` (Name leer = „Körperwerte“, alle aktiven Werte, 1× täglich). Beim Speichern von Plänen wird `measureWeekdays` mit der Vereinigung der Plantage mitgeschrieben (ältere App-Versionen). Pläne ohne feste Auswahl werden eingefroren, sobald im Katalog etwas aktiviert oder ein eigener Messwert angelegt wird.
- `BodyMeasurement.planId` (nur Herkunft) und `note` (optional, max. 200 Zeichen). Backup bleibt Format 2 (Felder optional).
- `src/domain/measure-plans.ts`: `measureCardsForDate` → eine Karte pro Plan des Wochentags (Messungen mit diesem `planId` am Tag), übrige Messungen als `free`. Freie Messungen füllen nie eine Karte. Heute/Erfassen: `MeasureCardRow`; Kalender: Karte pro Plan + freie Messungen einzeln.
- `MeasurementSheet`: `plan` (Messung aus Plan starten, nur dessen Werte, Tag fest), `measurement` (bearbeiten/löschen) oder weder noch (freie Messung, alle aktiven Werte) – speichert immer eine neue Messung bzw. aktualisiert die übergebene.
- Auswertung: `dailySeries` (Tagesdurchschnitt, `count`) für Chart, Kacheln, Entwicklung, Ø/Min/Max; `histogram` über Einzelmessungen (nur `bp_sys`/`bp_dia`, 10er-Klassen, ab 5 Messungen).
- Meine erfassten Werte: `bodyRepository.getMeasurementsPage({ from, to, limit })` (Index `[profileId+date]`, ein Tag wird nie zerschnitten) und `getMeasurementYearRange()`; „Weitere laden“ erhöht das Limit um 10.
- Katalog: `bp_sys`, `bp_dia` (mmHg), `pulse` (bpm), standardmäßig inaktiv.

### Neu hier?

- Seite `/welcome`: Start in vier Schritten, **Daten liegen nur auf dem Gerät → Backup-Knopf**, Installationsanleitung iPhone (Safari) und Android (Chrome), Tipps.
- Einstieg: einmalige Karte auf Heute für Nutzer ohne Training (verschwindet nach Besuch oder Wegtippen; Merker `localStorage` `7moveup.welcomeSeen`, nicht im Backup) und dauerhaft unter Mehr → Über.

- `nudgeViewport()` (`src/lib/viewport.ts`) überspringt den Scroll-Impuls, wenn `scrollY > 0`.

### Backup-Hinweis

- Mehr → Daten zeigt immer „Letztes Backup: vor X Tagen“ bzw. „Noch kein Backup erstellt“.
- Heute zeigt unten eine kleine Zeile; hervorgehoben („Backup empfohlen · …“ + „Backup erstellen“), wenn seit dem letzten Backup ≥ 7 Tage vergangen sind **und** seitdem neue Daten entstanden sind (ohne Backup: erste Daten ≥ 7 Tage alt).
- Kein Popup, kein Modal, keine tägliche Erinnerung. Neues Gerät ohne Daten: kein Hinweis.
- Das Backup-Datum wird nach erfolgreichem Export gespeichert (nicht bei Abbruch des Teilen-Dialogs). Nach einem Import gilt der Exportzeitpunkt der Datei als letztes Backup.

## Datenmodell

Typen: `src/domain/types.ts`. Jede Zeile gehört zu genau einem Profil (`profileId`).

| Typ | Inhalt |
| --- | --- |
| `Profile` | Anzeigename, Sprache |
| `Settings` | Ton, Haptik, `unitSystem?` (`metric` \| `imperial`, Standard metric), `customEquipment?` (eigene Geräte: `key` = `equip-…`, `name`) |
| `Exercise` | eigene Übungen (Built-ins kommen aus `src/data/seed`); `equipment` = Standard-Schlüssel oder `equip-…` |
| `ExerciseNote` | persönliche Notiz + Video-Links je Übung |
| `WorkoutPlan` | ein Trainingstag des Plans: Übungen, Wochentage, `templateId?` |
| `WorkoutSession` | ein Training mit Sätzen/Zeiten; offenes Training inkl. laufender Timer |
| `BodySettings` | Reihenfolge + aktiv je Messwert (`metrics`), eigene Messwerte (`custom`), `measureWeekdays` |
| `BodyMeasurement` | `date` (lokal), `time?`, `values: { [messwertSchlüssel]: Zahl in Basiseinheit }` |

Schlüssel der Standardwerte sind fest (`weight`, `body_fat`, `body_water`, `muscle_kg`, `muscle_pct`, `bone`, `scale_kcal`, `bmi`, `waist`, `hip`, `chest`, `upper_arm`, `thigh`); eigene beginnen mit `custom-`.

## Lokale Speicherung

IndexedDB-Datenbank `7moveup` über Dexie (`src/data/local/db.ts`):

| Version | Tabellen |
| --- | --- |
| 1 | `meta`, `profiles`, `settings`, `customExercises`, `exerciseNotes`, `plans`, `sessions` |
| 2 | + `bodySettings`, `measurements` (rein additiv – keine Umwandlung bestehender Daten) |

`meta` enthält das aktuelle Profil und `lastBackupAt`.

**Backup-Datei** (`src/data/backup.ts`, zod): `schemaVersion: 2` mit zusätzlich `bodySettings?`, `measurements`, `settings.unitSystem?` und `settings.customEquipment?` (Geräte-Schlüssel an Übungen: Standard oder `equip-…`). Dateien mit `schemaVersion: 1` werden weiterhin importiert (fehlende Felder = leer). Import ersetzt alle Daten des Profils – auch Körperwerte. Version 1.2.0 lehnt Dateien mit Version 2 ab („neuere Version“), statt Daten still zu verlieren.

## Tests

- `npm test` – Vitest: Domänenlogik (Kalender, Progression, Körperwerte, Zeiträume, Statistik, Backup-Hinweis), Backup-Round-Trip v1/v2, Dexie-Upgrade v1 → v2 (fake-indexeddb).
- `npm run build` – Typecheck + Build; `npm run lint` – oxlint.
- End-to-End-Prüfskripte (Playwright) liegen lokal unter `marketing-video/work/` (nicht eingecheckt).

## Nächste Schritte

1. Neue Entwicklungsstufen wieder auf einem Feature-Branch (Cloudflare-Preview), `main` erst nach Freigabe.
2. Marketing-Video neu rendern, wenn der Launch vorbereitet wird (Navigation hat sich geändert).
3. Danach erst weitere Bereiche planen. Bewusst **noch nicht**: Blutdruck, Puls, Ernährung, Barcode, Lebensmitteldatenbank, Fotoanalyse, Blutwerte, Supplemente, Supabase/Accounts/Cloud-Sync, Planarchive, Dashboards.
