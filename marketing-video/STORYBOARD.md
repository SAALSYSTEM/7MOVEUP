# Storyboard – 7MOVEUP App-Video

**Kernaussage:** Dein eigener Trainingsplan. Deine Übungen. Deine Daten. Kein Account.
**Ton:** ruhig-sportlich, hochwertig, kein „Gym-Bro“. brag-Tonalität am ehesten `app-store` mit `polished`-Zurückhaltung: echte App im Mittelpunkt, kurze Zeilen, weiche Übergänge.
**Formate:** 9:16 (1080×1920, Primär) und 16:9 (1920×1080), 30 fps, 30,0 s.
**Ohne Ton verständlich:** Jede Aussage steht als kurzer Text im Bild, die App-Aktion sieht man (Tap-Kreise, Hervorhebung). Ton ergänzt nur.

## Grundlage: brag (nur gelesen)

Übernommene Prinzipien aus `brag` / `brag-slim`:

| brag-Regel | Umsetzung hier |
| --- | --- |
| Hook in den ersten 2 s | Startseite stark gezoomt, das erste Wort fährt sofort ein |
| „Show the thing“ – echte UI statt Nachbau | Jeder App-Screen ist ein echter Frame der gebauten App |
| Produkt *in use*: Einstieg → Aktion → Ergebnis | Tap auf „Training starten“ führt direkt ins Training, Tap auf die Übung direkt ins Detail |
| Lesbarkeit: ca. 0,3 s pro Wort, schnelle Bewegung statt kurzer Texte | jeder Untertitel steht ≥ 1,8 s ruhig |
| Jede Frame-Zeit ist eine reine Funktion der Zeit | virtuelle Uhr in der App + reine `renderFrame(t)`-Komposition |
| Kein matschiges Crossfade zwischen vollen Screens | kurzes Abblenden über den Hintergrund („dip“) |
| Poster = stärkster ruhiger Frame, als Frame 0 eingebrannt | t = 5,9 s (PROGRESS + Claim) |
| `share-copy.txt` | liegt in `output/` |

## Reihenfolge – bewusst leicht umgestellt

Die inhaltliche Richtung aus dem Auftrag bleibt, die Reihenfolge folgt aber dem Bedienfluss: Der Tap auf „Training starten“ landet direkt im Training (statt zurück in die Planübersicht), und der Tap auf die Übung landet direkt in ihrer Notiz. So wirkt jeder Schnitt wie eine echte Bewegung durch die App.

## Szenen

| # | Zeit | Szene | Was die echte App zeigt | Text (DE / EN) |
|---|---|---|---|---|
| 1 | 0,0–6,6 | **Hook** | Startseite, Tagesspruch Wort für Wort: SMALL → STEPS → BIG → PROGRESS (immer nur ein Wort). Handy startet nah, zoomt bei 4,35 s zurück. PROGRESS bleibt stehen, Tap auf „Training starten“ bei 6,1 s. | ab 4,9 s: **YOUR WORKOUT. YOUR WAY.** |
| 2 | 6,6–10,8 | **Merkt sich alles** | Training „Tag 1 – Push“ öffnet sich: Kurzhantel-Flachbankdrücken, *Letztes Mal 20 kg je Hantel · 10 / 10 / 10 / 10*, Hinweis *Steigerung möglich · +2 kg* (hervorgehoben). Tap auf „22 kg“, dann Satz 1 abhaken → Pausen-Timer startet. | Merkt sich **dein letztes Training.** / Remembers **your last workout.** |
| 3 | 10,8–15,0 | **Timer** | Plank, 40-s-Satz in den letzten Sekunden: 0:04 → 0:03 → 0:02 → 0:01 → 0:00 „Fertig!“ (Ring wird grün). | Timer für **Zeitübungen.** / A timer for **timed sets.** |
| 4 | 15,0–18,2 | **Eigene Pläne** | Training → Plan: Tag 1 – Push, Tag 2 – Beine, Tag 3 – Pull, Tag 4 – Ganzkörper + eigenes „Cardio“. Tap auf „Kalender“: erledigte Tage grün, Kraft orange, Cardio blau. | Erstelle deinen **eigenen Trainingsplan.** / Build your **own workouts.** |
| 5 | 18,2–21,0 | **Übungen** | Bibliothek mit 41 Übungen; Tap „Brust“ → Tap „Kurzhanteln“ → 2 Treffer → Tap auf Kurzhantel-Flachbankdrücken. | Auswählen. Hinzufügen. **Trainieren.** / Choose. Add. **Train.** |
| 6 | 21,0–24,2 | **Notiz + Video** | Übungsdetail: Notiz wird live getippt („Schulterblätter hinten/unten halten.“), gespeichert (Toast), Scroll zum hinterlegten YouTube-Link. | Deine Notizen. **Deine Technik.** / Your notes. **Your technique.** |
| 7 | 24,2–27,0 | **Kein Account** | Mehr → Daten: „Alles liegt nur auf diesem Gerät.“ Tap „Daten sichern“ → Toast „Backup erstellt“, darunter „Daten importieren“. | Kein Account. **Deine Daten bleiben bei dir.** / No account. **Your data stays with you.** |
| 8 | 27,0–30,0 | **Finale** | Handy blendet aus, Logo (Original-Datei `brand/7moveup-logo-source.png`) skaliert weich ein. | **7MOVEUP** · MOVE. TRACK. **PROGRESS.** |

Ernährung kommt nicht vor (V1 = Coming Soon; laut Auftrag höchstens kurz – weggelassen, um unter 30 s zu bleiben).

## Ehrlichkeit der Darstellung

- Alle Screens sind die echte, aktuelle App (Build aus diesem Repo), keine nachgebauten Oberflächen.
- Demo-Daten kommen über die echte Import-Funktion (`src/demo-data.mjs`): Vorlage „4-Tage Kraft & Core“ + eigenes Cardio, zwei Trainingswochen Historie.
- Zeit-Eingriffe, offen benannt:
  - Hook: Wortschleife läuft 1,5-fach, danach steht das Bild bei PROGRESS kurz still (sonst 8 s statt 4,8 s).
  - Timer: Ein 40-s-Satz wird bis 3,6 s Restzeit vorgespult – gezeigt wird nur das Ende.
- Keine Funktion wird gezeigt, die es nicht gibt. Fehlende Funktionen für dieses Video: keine.

## Ton

- Musikbett synthetisch (A-Dur, 112 BPM): im Hook nur Pad, ab dem Training Kick/Bass/Hi-Hat, ab den Plänen Clap, im Finale Akkordschlag und Ausklang.
- Timer-Töne exakt wie in der App (880 Hz kurz, Abschluss 660 + 990 Hz), zeitlich aus der Aufnahme übernommen.
- Leise Klicks auf Taps, sehr leise Tastenklicks beim Tippen, kleiner „Pop“ bei Toasts.
- Keine Stimme. `--no-music` rendert nur die Effekte.
