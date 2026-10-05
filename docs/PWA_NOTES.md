# PWA Notes

- App shell via `vite-plugin-pwa` precachen.
- IndexedDB bleibt unabhängig vom Service Worker persistent.
- Keine externen Videos precachen.
- YouTube-/Web-Video bleibt Online-Inhalt.
- Timer und Trainingslog sollen ohne Internet funktionieren.
- Web Audio erst nach einem Nutzer-Tap initialisieren.

## iPhone (Home-Bildschirm-App)

- **Ton:** Der AudioContext startet nur in einer echten Interaktion (`touchend`/`click`/`keydown`; `pointerdown` zählt bei Touch nicht). Nach Bildschirmsperre, App-Wechsel oder Anruf steht er auf `interrupted`. Deshalb wird er bei *jeder* Interaktion und bei Rückkehr in die App fortgesetzt, und Töne warten bei Bedarf auf `resume()` (`src/services/feedback.ts`).
- **Lautlos-Modus:** Web-Audio ist auf dem iPhone im Lautlos-Modus stumm. Bewusst so gelassen: `navigator.audioSession.type = "playback"` würde zwar durchklingen, aber Musik aus anderen Apps unterbrechen.
- **Hintergrund:** Bei gesperrtem Bildschirm oder in einer anderen App pausiert iOS die Web-App komplett – kein Ton, keine Haptik. Der Countdown rechnet mit einem Endzeitpunkt und zeigt bei Rückkehr die richtige Zeit. Echte Hintergrund-Alarme bräuchten Push-Benachrichtigungen mit Server (nicht in V1).
- **Bildschirm wach halten:** Während eines offenen Trainings fordert die Session-Seite einen Screen Wake Lock an (Home-Bildschirm-Apps ab iOS 18.4) und erneuert ihn nach Rückkehr bzw. beim nächsten Tippen.
- **Haptik:** `navigator.vibrate` gibt es auf iOS nicht. Ersatz ist die System-Haptik von `<input type="checkbox" switch>` (ab iOS 18). Seit iOS 26.5 nur noch bei einem echten Fingertipp – darum liegt über den Abhaken-Buttons eine unsichtbare Switch-Fläche (`src/components/ui/haptic-tap.tsx`). Countdown-Signale können auf dem iPhone nicht vibrieren.
- iOS Safe Areas im Header und in der Bottom Navigation berücksichtigen.
- Manifest/Icon-Dateien liegen im Starter unter `public/`.
- **Verrutschte Navigation (iOS 26):** Schließt sich die Tastatur – oder verschwindet ein fokussiertes Feld beim Seitenwechsel –, bleiben fixierte Elemente teils nach oben verschoben (WebKit-Bug 297779). Gegenmittel in `src/lib/viewport.ts`: vor dem Verlassen des Trainings den Fokus lösen, nach Tastatur-Schließen und Seitenwechsel einen 1-px-Scroll auslösen (nur iOS).
