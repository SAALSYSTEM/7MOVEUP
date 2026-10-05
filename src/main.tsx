import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";

import App from "./App";
import "./index.css";
import { installViewportRepair } from "./lib/viewport";

installViewportRepair();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Service Worker nur im Produktions-Build (App-Shell offline, autoUpdate).
if (import.meta.env.PROD) {
  registerSW({ immediate: true });
}
