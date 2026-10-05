import { useEffect } from "react";
import { useLocation } from "react-router-dom";

import { scheduleViewportRepair } from "@/lib/viewport";

/** Bei jedem Seitenwechsel nach oben – und auf iOS fixierte Elemente (Navigation) neu ausrichten. */
export function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
    return scheduleViewportRepair();
  }, [pathname]);
  return null;
}
