# 7MOVEUP – Marketingvideo

Kurzes App-Video (ca. 30 s) für Reels, TikTok, Shorts und WhatsApp, gebaut aus der **echten, aktuellen 7MOVEUP-App**. Kein Voiceover; jede Aussage steht als Text im Bild, der Ton ergänzt nur.

| Datei | Inhalt |
| --- | --- |
| `output/7moveup-app-video-9x16.mp4` | **Primärvideo**, 1080×1920, Deutsch |
| `output/7moveup-app-video-9x16-en.mp4` | 1080×1920, Englisch |
| `output/7moveup-app-video-16x9.mp4` | 1920×1080, Deutsch |
| `output/7moveup-app-video-16x9-en.mp4` | 1920×1080, Englisch |
| `output/*.jpg` | Poster/Thumbnail je Video (auch als Frame 0 eingebrannt) |
| `output/share-copy.txt`, `output/share-copy-en.txt` | Begleittext zum Posten |

Storyboard: [`STORYBOARD.md`](STORYBOARD.md) · Texte: [`SCRIPT_DE.md`](SCRIPT_DE.md), [`SCRIPT_EN.md`](SCRIPT_EN.md)

## Neu rendern

Voraussetzungen: Node.js 22+, `ffmpeg` im `PATH`, Abhängigkeiten der App im Repo-Root installiert (`npm install` dort).

```bash
cd marketing-video
npm install
npx playwright install chromium   # einmalig: Browser für die Aufnahme
npm run render                    # alle Sprachen + Formate → output/
```

Weitere Varianten:

```bash
node src/render.mjs --lang de --format 9x16   # nur das Primärvideo
node src/render.mjs --no-music                 # nur Effekte (Timer-Töne, Klicks), keine Musik
node src/render.mjs --stills --lang de         # nur Kontrollbilder nach work/de/stills/
node src/render.mjs --skip-build --skip-capture  # Komposition neu, App-Aufnahme wiederverwenden
```

Dauer: etwa 1–2 Minuten pro App-Aufnahme und einige Minuten pro gerendertem Format.

## So funktioniert es

```
npm run build (App, Basis "/")
      │
      ▼
Pass 1  src/capture-app.mjs   echte App in Headless-Chromium, virtuelle Uhr angehalten
                              → Demo-Daten über den echten Import
                              → Szenen Frame für Frame (390×844 @2x), Taps/Töne protokolliert
      │  work/<lang>/app/*.jpg + events.json
      ▼
Pass 2  src/composition.html/js   Handy-Rahmen, Untertitel, Tap-Kreise, Hervorhebungen, Logo-Finale
                              → jeder Frame = reine Funktion der Zeit, Screenshot je Frame → ffmpeg
      ▼
Ton     src/audio.mjs         synthetisch: Musikbett + App-identische Timer-Töne + leise Klicks
      ▼
Final   ffmpeg               Poster wählen, als Frame 0 einbrennen, Ton muxen → output/
```

**Warum eine virtuelle Uhr?** Die App animiert mit Framer Motion, hat Timer und die Wortschleife. Mit Playwrights Uhr (`clock.install` + `pauseAt`) vergeht App-Zeit nur, wenn das Skript sie vorspult – exakt 1/30 s pro Frame. Dadurch sind Animationen und Pieptöne bildgenau und das Ergebnis ist bei jedem Lauf identisch. Für die Aufnahme werden zwei Dinge nur in der Testumgebung umgestellt: Framer Motion animiert per `requestAnimationFrame` statt Web Animations API (gleiche Kurven), und 150-ms-CSS-Farbübergänge sind aus. Die App selbst wird nicht verändert.

## Anpassen

| Was | Wo |
| --- | --- |
| Texte, Szenenzeiten, Poster-Zeitpunkt, URL im Finale | `src/config.mjs` |
| Demo-Daten (Pläne, Historie, Notiz) | `src/demo-data.mjs` |
| Ablauf in der App (Taps, Tippen, Scrollen) | `src/capture-app.mjs` |
| Layout 9:16 / 16:9, Animationen der Overlays | `src/composition.js` |
| Musik/Effekte, Lautstärken | `src/audio.mjs` |

Eine eigene Musik kann später einfach darunter gelegt werden, z. B.:

```bash
ffmpeg -i output/7moveup-app-video-9x16.mp4 -i musik.mp3 -map 0:v -map 1:a -c:v copy -shortest mit-musik.mp4
```

## Referenz: brag

Aufbau, Timing-Regeln und Auslieferung (Poster als Frame 0, `share-copy.txt`) orientieren sich an [`brag`](https://github.com/SAALSYSTEM/brag) – genauer an dessen schlanker Variante `brag-slim`, die das Video ohne Hyperframes mit vorhandenen Werkzeugen baut. Aus brag wurden keine Dateien kopiert; Musik und Effekte sind hier eigens synthetisiert (die Lizenz der brag-Musik ist dort ausdrücklich noch offen).

Schrift: Inter (SIL Open Font License) aus den App-Abhängigkeiten. Logo: `brand/7moveup-logo-source.png` unverändert.
