/**
 * iOS-Viewport-Reparatur (vor allem iOS 26, Home-Bildschirm-App):
 * Schließt sich die Tastatur – oder verschwindet ein fokussiertes Eingabefeld beim Seitenwechsel
 * einfach aus dem DOM –, bleiben fixierte Elemente wie die Bottom-Navigation teils nach oben
 * verschoben, bis man scrollt (WebKit-Bug 297779). Gegenmittel:
 * 1. vor dem Verlassen einer Seite den Fokus lösen, damit die Tastatur regulär schließt,
 * 2. danach einen minimalen Scroll auslösen – iOS berechnet fixierte Elemente dann neu.
 */
import { isIOS } from "@/lib/device";

const EDITABLE = "input, textarea, select, [contenteditable='true']";

function editableFocused() {
  const el = document.activeElement;
  return el instanceof HTMLElement && el.matches(EDITABLE);
}

/** Tastatur schließen, indem das fokussierte Eingabefeld den Fokus abgibt. */
export function dismissKeyboard() {
  const el = document.activeElement;
  if (el instanceof HTMLElement && el.matches(EDITABLE)) el.blur();
}

/** iOS zwingen, fixierte Elemente neu zu positionieren (1 px hin und zurück). */
function nudgeViewport() {
  if (editableFocused()) return; // Tastatur offen → nicht eingreifen
  const y = window.scrollY;
  window.scrollTo(0, y > 0 ? y - 1 : y + 1);
  window.scrollTo(0, y);
}

/** Reparatur kurz nach einem Seitenwechsel bzw. Schließen der Tastatur; liefert eine Aufräumfunktion. */
export function scheduleViewportRepair(): () => void {
  if (typeof window === "undefined" || !isIOS()) return () => {};
  const timers = [window.setTimeout(nudgeViewport, 80), window.setTimeout(nudgeViewport, 400)];
  return () => timers.forEach((id) => window.clearTimeout(id));
}

let installed = false;

/** Einmal beim Start: nach jedem Schließen der Tastatur reparieren (nur iOS). */
export function installViewportRepair() {
  if (installed || typeof window === "undefined" || !isIOS()) return;
  installed = true;
  document.addEventListener("focusout", (event) => {
    if (event.target instanceof HTMLElement && event.target.matches(EDITABLE)) scheduleViewportRepair();
  });
  window.visualViewport?.addEventListener("resize", () => {
    if (!editableFocused()) scheduleViewportRepair();
  });
}
