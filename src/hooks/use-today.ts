import { useEffect, useState } from "react";

/** Aktuelles Datum, das sich um Mitternacht selbst aktualisiert (Tagesspruch, Kalender). */
export function useToday(): Date {
  const [today, setToday] = useState(() => new Date());
  useEffect(() => {
    const next = new Date(today);
    next.setHours(24, 0, 1, 0);
    const id = window.setTimeout(() => setToday(new Date()), next.getTime() - today.getTime());
    return () => window.clearTimeout(id);
  }, [today]);
  return today;
}
