import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { profileRepository, requestPersistentStorage, settingsRepository } from "@/data";
import { subscribeDataChanges } from "@/data/events";
import type { Language, Profile, Settings } from "@/domain/types";
import { createTranslator, type Translate } from "@/i18n";
import { configureFeedback, unlockAudio } from "@/services/feedback";

type AppContextValue = {
  profile: Profile;
  settings: Settings;
  language: Language;
  t: Translate;
  /** Profilname oder Fallback ICH/ME */
  displayName: string;
};

const AppContext = createContext<AppContextValue | null>(null);

type LoadState =
  | { status: "loading" }
  | { status: "ready"; profile: Profile; settings: Settings }
  | { status: "error"; error: unknown };

export function AppProvider({ children, fallback }: { children: ReactNode; fallback: (state: "loading" | "error") => ReactNode }) {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      Promise.all([profileRepository.getCurrent(), settingsRepository.get()])
        .then(([profile, settings]) => {
          if (!cancelled) setState({ status: "ready", profile, settings });
        })
        .catch((error: unknown) => {
          console.error(error);
          if (!cancelled) setState({ status: "error", error });
        });
    void load();
    void requestPersistentStorage();
    const unsubscribe = subscribeDataChanges(() => void load());
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  // Audio erst nach der ersten Nutzerinteraktion initialisieren (iOS).
  useEffect(() => {
    const unlock = () => unlockAudio();
    window.addEventListener("pointerdown", unlock, { once: true, capture: true });
    window.addEventListener("keydown", unlock, { once: true, capture: true });
    return () => {
      window.removeEventListener("pointerdown", unlock, { capture: true });
      window.removeEventListener("keydown", unlock, { capture: true });
    };
  }, []);

  const value = useMemo<AppContextValue | null>(() => {
    if (state.status !== "ready") return null;
    const { profile, settings } = state;
    const t = createTranslator(profile.language);
    return {
      profile,
      settings,
      language: profile.language,
      t,
      displayName: profile.displayName?.trim() || t("profile.fallback"),
    };
  }, [state]);

  useEffect(() => {
    if (!value) return;
    configureFeedback({ sound: value.settings.soundEnabled, haptics: value.settings.hapticsEnabled });
    document.documentElement.lang = value.language;
  }, [value]);

  if (state.status === "error") return <>{fallback("error")}</>;
  if (!value) return <>{fallback("loading")}</>;
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useApp(): AppContextValue {
  const value = useContext(AppContext);
  if (!value) throw new Error("useApp muss innerhalb von AppProvider verwendet werden");
  return value;
}
