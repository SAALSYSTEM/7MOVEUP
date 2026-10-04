/**
 * Zentrale Video-Konfiguration: Timeline, Texte, Formate.
 * Alle Zeiten in Sekunden Videozeit, 30 fps.
 */

export const FPS = 30;
export const DURATION = 30;

/** Virtuelles „Jetzt“ der Aufnahme: Montag, 9. Nov. 2026, abends.
 *  An diesem Tag wählt die App den Spruch SMALL STEPS BIG PROGRESS
 *  und „Tag 1 – Push“ ist für heute geplant. */
export const DEMO_NOW = "2026-11-09T18:05:00+01:00";

export const SCENES = [
  { id: "hook", start: 0, end: 6.6 },
  { id: "session", start: 6.6, end: 10.8 },
  { id: "timer", start: 10.8, end: 15.0 },
  { id: "plans", start: 15.0, end: 18.2 },
  { id: "exercises", start: 18.2, end: 21.0 },
  { id: "notes", start: 21.0, end: 24.2 },
  { id: "data", start: 24.2, end: 27.0 },
  { id: "finale", start: 27.0, end: 30.0 },
];

/** Szenenwechsel ohne Abblende im Handy (die App wechselt dort selbst den Screen) */
export const CONTINUOUS_CUTS = ["session", "notes"];

/** Wann der Claim im Hook erscheint */
export const HOOK_CLAIM_AT = 4.9;

/** Untertitel. *…* = orange hervorgehoben, \n = Zeilenumbruch. */
export const CAPTIONS = {
  de: {
    hook: "YOUR WORKOUT.\n*YOUR WAY.*",
    session: "Merkt sich\n*dein letztes Training.*",
    timer: "Timer für\n*Zeitübungen.*",
    plans: "Erstelle deinen\n*eigenen Trainingsplan.*",
    exercises: "Auswählen. Hinzufügen.\n*Trainieren.*",
    notes: "Deine Notizen.\n*Deine Technik.*",
    data: "Kein Account.\n*Deine Daten bleiben bei dir.*",
  },
  en: {
    hook: "YOUR WORKOUT.\n*YOUR WAY.*",
    session: "Remembers\n*your last workout.*",
    timer: "A timer for\n*timed sets.*",
    plans: "Build your\n*own workouts.*",
    exercises: "Choose. Add.\n*Train.*",
    notes: "Your notes.\n*Your technique.*",
    data: "No account.\n*Your data stays with you.*",
  },
};

export const FINALE = {
  wordmark: "7MOVEUP",
  tagline: "MOVE. TRACK. *PROGRESS.*",
  /** optional, z. B. "7moveup.com" – leer lassen, solange die Domain nicht feststeht */
  url: "",
};

export const FORMATS = {
  "9x16": { width: 1080, height: 1920 },
  "16x9": { width: 1920, height: 1080 },
};

/** Poster/Thumbnail: stärkster ruhiger Moment (PROGRESS + Claim stehen) */
export const POSTER_AT = 5.9;

export function sceneAt(t) {
  return SCENES.find((s) => t >= s.start && t < s.end) ?? SCENES.at(-1);
}
