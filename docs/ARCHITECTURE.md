# 7MOVEUP V1 – Architektur

## Ziel

Lokale mobile-first PWA ohne Backend. Daten zuerst in IndexedDB. UI greift über Repository-Interfaces auf Daten zu, damit später Supabase ergänzt werden kann.

## Schichten

1. **UI** – React Pages + Components
2. **Application Services** – Workouts, Timer, Backup, Motivation
3. **Repositories** – abstrakte Datenzugriffe
4. **Local Adapter** – Dexie/IndexedDB
5. **Future Adapter** – Supabase, noch nicht implementieren

## Routing

- `/` Heute
- `/training` Training mit `Plan | Kalender`
- `/exercises` Übungen
- `/food` Coming Soon
- `/more` Mehr

## Datenpersistenz

IndexedDB speichert:

- Profil
- Einstellungen
- Built-in-/Custom-Übungen
- persönliche Übungsnotizen
- Pläne
- Trainingseinheiten
- Satzdaten/Zeiten
- Kalenderzuordnung

Keine Blob-Videos in V1.

## Backup

Ein Export enthält nur den aktuellen Nutzer. Format versioniert mit `schemaVersion: 1`.

## Supabase später

Die UI soll von lokalen Details entkoppelt sein. Später können Repository-Implementierungen ausgetauscht werden. Mögliche Tabellen: profiles, exercises, exercise_notes, workout_plans, workout_sessions, session_exercises, session_sets, settings.

---

## Umsetzung V1 (Stand Code)

| Schicht | Ort |
| --- | --- |
| UI – Seiten | `src/pages/*` |
| UI – Komponenten | `src/components/{ui,layout,home,training,exercises}` (shadcn-Struktur: `src/components/ui`) |
| Application Services | `src/services/workout-service.ts` (Session starten/abschließen), `src/services/feedback.ts` (Web Audio + Vibration), `src/hooks/use-countdown.ts` (Timer) |
| Domänenlogik (rein, getestet) | `src/domain/*` – Typen, Tagesspruch, Progression, Kalender/Wochenstatistik |
| Repository-Verträge | `src/data/repositories.ts` |
| Local Adapter (Dexie) | `src/data/local/*` |
| Einstiegspunkt der UI in die Daten | `src/data/index.ts` – hier später die Supabase-Implementierung einsetzen |
| Backup-Format (zod) | `src/data/backup.ts` |
| Seed-Daten (unverändert geliefert) | `src/data/seed/*.json`, Mapping in `src/data/seed/index.ts` |
| Texte DE/EN | `src/i18n/de.ts`, `src/i18n/en.ts` |

Die UI importiert nie Dexie. Repositories melden Schreibvorgänge über `src/data/events.ts`; `useData()` lädt daraufhin neu. Eine Supabase-Implementierung muss nur dieselben Interfaces erfüllen und nach Schreibvorgängen `notifyDataChanged()` aufrufen.

### IndexedDB-Tabellen (Dexie, DB `7moveup`, Version 1)

`meta` (aktuelles Profil), `profiles`, `settings`, `customExercises`, `exerciseNotes` (`[profileId+exerciseId]`), `plans`, `sessions`.
Built-in-Übungen liegen nicht in der DB, sondern kommen aus den Seed-Dateien – so können spätere Seed-Updates ohne Migration ausgeliefert werden.

### Entscheidungen

- **Körperregionen/Equipment als stabile Schlüssel** (`chest`, `dumbbells` …) statt deutscher Labels; `Trizeps`/`Bizeps` aus dem Seed werden auf `Arme` gemappt.
- **Ergometer** als 41. Built-in-Übung (`id: ergometer`, Tracking `cardio`): Die 6-Tage-Vorlage hat zwei Ergometer-Tage, die 40 Seed-Übungen enthalten aber keine Cardio-Übung.
- **Vorlagen → Pläne:** Beim Übernehmen entsteht pro Trainingstag ein editierbarer Plan mit vorgeschlagenen Wochentagen (4-Tage: Mo/Di/Do/Fr, 6-Tage: Mo–Sa). Planung gilt ab dem Anlagetag, nicht rückwirkend.
- **Gewicht** wird immer als `weightPerDumbbellKg` gespeichert und bei Kurzhantel-/Kettlebell-Übungen als „kg je Hantel“ angezeigt.
- **Tagesspruch:** feste 10er-Permutation über die lokale Tagesnummer → am selben Tag stabil, am Folgetag garantiert anders, alle 10 Tage jeder Spruch einmal.
- **Progression:** obere Wiederholungszahl in allen geplanten Arbeitssätzen erreicht → „Steigerung möglich“. Plan mit `progressionStepKg` (4-Tage Kraft & Core: 2) zeigt bei Grundübungen (≤ 12 Wdh.) zusätzlich „+2 kg“. Nie automatische Änderung.
- **YouTube** wird erst nach Tippen über `youtube-nocookie.com` eingebettet; der Link „Video öffnen“ ist immer da.
