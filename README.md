# 7MOVEUP

Persönliche, mobile-first Fitness-PWA: Tagesmotivation → Training starten → Gewichte/Wiederholungen/Zeiten schnell protokollieren → Fortschritt sehen.
Kein Account, kein Backend – alle Daten liegen lokal im Browser (IndexedDB) des jeweiligen Geräts.

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
    home/         Motivationsanimation
    training/     Kalender, Session-Karte, Timer, Pausen-Timer
    exercises/    Filter, Liste, Video-Embed
  data/           Repository-Verträge, Backup-Schema, Seed, local/ (Dexie)
  domain/         Typen + reine Logik (Tagesspruch, Progression, Kalender)
  hooks/          useData, useCountdown, useToday
  i18n/           de.ts / en.ts
  pages/          Heute, Training, Plan-Editor, Session, Übungen, Essen, Mehr
  services/       Session starten/abschließen, Töne/Vibration
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
  "schemaVersion": 1,
  "exportedAt": "2026-10-04T…",
  "profile": {},
  "customExercises": [],
  "exerciseNotes": [],
  "plans": [],
  "sessions": [],
  "settings": {}
}
```

Import wird mit zod validiert, verlangt eine Bestätigung und ersetzt dann die lokalen Daten. Neuere Schema-Versionen werden abgelehnt.

## Status

- V1 lokal fertig, **noch nicht deployed**. Cloudflare folgt erst nach Freigabe der Vorschau.
- Supabase ist bewusst nicht angebunden; die Repository-Schicht ist dafür vorbereitet.
