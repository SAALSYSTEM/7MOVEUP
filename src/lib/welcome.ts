/**
 * „Neu hier?“-Hinweis auf Heute: wird ausgeblendet, sobald die Seite besucht oder der Hinweis
 * weggetippt wurde. Nur eine Anzeige-Vorliebe → localStorage genügt (nicht Teil des Backups).
 */
const KEY = "7moveup.welcomeSeen";

export function isWelcomeSeen(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function markWelcomeSeen(): void {
  try {
    localStorage.setItem(KEY, "1");
  } catch {
    // ohne Speicher erscheint der Hinweis eben wieder – harmlos
  }
}
