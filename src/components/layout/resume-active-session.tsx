import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { workoutRepository } from "@/data";
import { isResumableSession } from "@/domain/active-session";

/**
 * iOS beendet die Home-Bildschirm-App bei längerer Bildschirmsperre gern und startet sie danach
 * frisch auf der Startseite. Läuft dann noch ein Training (vor kurzem begonnen), geht es direkt
 * dorthin zurück – samt gespeicherter Timer. Nur einmal beim App-Start.
 */
export function ResumeActiveSession() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const pathRef = useRef(pathname);
  const checked = useRef(false);

  useEffect(() => {
    pathRef.current = pathname;
  }, [pathname]);

  useEffect(() => {
    if (checked.current) return;
    checked.current = true;
    if (pathRef.current !== "/") return;
    void workoutRepository
      .getActiveSession()
      .then((active) => {
        // nur, wenn man inzwischen nicht selbst woanders hin getippt hat
        if (pathRef.current === "/" && isResumableSession(active, new Date())) navigate(`/training/session/${active.id}`);
      })
      .catch(console.error);
  }, [navigate]);

  return null;
}
