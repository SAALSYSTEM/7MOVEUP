# 7MOVEUP

Persönliche, mobile-first Fitness-PWA: Tagesmotivation → Training starten → Gewichte/Wiederholungen/Zeiten schnell protokollieren → Körperwerte erfassen → Fortschritt sehen.
Kein Account, kein Backend – alle Daten liegen lokal im Browser (IndexedDB) des jeweiligen Geräts.

Aktueller Stand, Entscheidungen und nächste Schritte: [`PROJECT_STATE.md`](PROJECT_STATE.md) · Änderungen: [`CHANGELOG.md`](CHANGELOG.md)

## Stack

Vite · React 19 · TypeScript · Tailwind CSS 4 · shadcn/ui-Struktur · lucide-react · framer-motion · React Router · Dexie (IndexedDB) · zod · date-fns · vite-plugin-pwa

## Lokal starten

```bash
npm install
npm run dev        # Entwicklungsserver (http://localhost:5173)
```

Vorschau des Produktions-Builds inkl. Service Worker / Offline:

```bash
npm run build
npm run preview    # http://localhost:4173
```

Auf dem iPhone im gleichen WLAN testen: `npm run preview -- --host` und die angezeigte Netzwerk-Adresse öffnen.
Hinweis: Installation als PWA und Service Worker funktionieren nur über `localhost` oder HTTPS – über die LAN-Adresse läuft die App, aber ohne Offline-Modus.

## Skripte

| Befehl | Zweck |
| --- | --- |
| `npm run dev` | Entwicklungsserver |
| `npm run build` | Typecheck (`tsc -b`) + Produktions-Build nach `dist/` |
| `npm run preview` | Build lokal ausliefern |
| `npm run lint` | oxlint |
| `npm test` | Vitest (Domänenlogik, Seed, Backup-Round-Trip mit fake-indexeddb) |

## Struktur

```
src/
  app/            AppProvider (Profil, Einstellungen, Sprache)
  components/
    ui/           shadcn-artige Basis-Komponenten inkl. bottom-nav-bar
    layout/       Header, Seitencontainer
    home/         Motivationsanimation, Backup-Zeile
    training/     Kalender, Session-Karte, Timer, Pausen-Timer, Tabs Plan|Übungen
    body/         Körperwerte: Erfassung, Eingabefeld, Liniendiagramm (SVG)
    exercises/    Filter, Liste, Video-Embed
  data/           Repository-Verträge, Backup-Schema, Seed, local/ (Dexie)
  domain/         Typen + reine Logik (Tagesspruch, Progression, Kalender, Körperwerte, Statistik, Backup-Hinweis)
  hooks/          useData, useCountdown, useToday, useBodyData, useBackup
  i18n/           de.ts / en.ts
  pages/          Heute, Kalender, Training, Plan-Editor, Session, Übungen, Fortschritt, Messwerte, Essen, Mehr
  services/       Session starten/abschließen, Töne/Vibration (iPhone-Besonderheiten: docs/PWA_NOTES.md)
public/icons/     App-Icon, Favicon, Header-Icon (aus brand/)
brand/            verbindliche Logo-Vorlage (1:1, nicht verändern)
docs/             Architektur- und PWA-Notizen
```

Details zu Schichten, Datenmodell und Entscheidungen: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Backup-Format

`Mehr → Daten sichern` exportiert ausschließlich das lokale Profil:

```json
{
  "app": "7MOVEUP",
  "schemaVersion": 2,
  "exportedAt": "2026-10-04T…",
  "profile": {},
  "customExercises": [],
  "exerciseNotes": [],
  "plans": [],
  "sessions": [],
  "settings": {},
  "bodySettings": {},
  "measurements": []
}
```

Import wird mit zod validiert, verlangt eine Bestätigung und ersetzt dann die lokalen Daten (inkl. Körperwerte). Dateien mit `schemaVersion: 1` werden weiterhin importiert; neuere Schema-Versionen werden abgelehnt.

## Deployment

**Cloudflare Workers (Static Assets)** über den GitHub-Import: Jeder Push auf `main` wird von Cloudflare gebaut und ausgerollt.

- Konfiguration: [`wrangler.jsonc`](wrangler.jsonc) – `wrangler deploy` baut selbst (`npm run build`) und lädt `dist/` hoch.
- SPA-Routing: `not_found_handling: "single-page-application"` → Direktaufrufe wie `/training` liefern die App.
- Node-Version für den Cloudflare-Build: `.node-version` (22).
- Lokal mit der Cloudflare-Laufzeit testen: `npx wrangler dev`.
- Feature-Branches: Cloudflare baut sie als Preview-Version (eigene `*.workers.dev`-Adresse), die Produktion bleibt unberührt. Die Preview hat einen eigenen lokalen Speicher – Daten per Backup-Datei mitnehmen.

Die GitHub-Pages-Vorschau (`.github/workflows/deploy-pages.yml`) baut mit `BASE_PATH=/<repo>/` und ist nur eine Test-Spielwiese.

## Status

- Veröffentlicht: 1.3.0 (Cloudflare Workers, `main`) – Körperwerte & neue Navigation, siehe `CHANGELOG.md`.
- Supabase ist bewusst nicht angebunden; die Repository-Schicht ist dafür vorbereitet.
