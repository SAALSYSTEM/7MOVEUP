import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";

import { AppProvider } from "@/app/app-context";
import { BottomNavBar } from "@/components/ui/bottom-nav-bar";
import { ToastProvider } from "@/components/ui/toast";
import { createTranslator } from "@/i18n";
import { detectBrowserLanguage } from "@/data/local/local-repositories";
import { asset, ROUTER_BASENAME } from "@/lib/asset";
import { ExerciseDetailPage } from "@/pages/exercise-detail-page";
import { ExerciseFormPage } from "@/pages/exercise-form-page";
import { ExercisesPage } from "@/pages/exercises-page";
import { FoodPage } from "@/pages/food-page";
import { HomePage } from "@/pages/home-page";
import { MorePage } from "@/pages/more-page";
import { CalendarPage } from "@/pages/calendar-page";
import { MetricsPage } from "@/pages/metrics-page";
import { PlanEditorPage } from "@/pages/plan-editor-page";
import { ProgressPage } from "@/pages/progress-page";
import { SessionPage } from "@/pages/session-page";
import { TrainingPage } from "@/pages/training-page";
import { WelcomePage } from "@/pages/welcome-page";
import { ResumeActiveSession } from "@/components/layout/resume-active-session";
import { ScrollToTop } from "@/components/layout/scroll-to-top";

/** Routen mit eigener Aktionsleiste unten blenden die Hauptnavigation aus. */
const ROUTES_WITHOUT_NAV = [/^\/training\/session\//, /^\/training\/plans\//, /^\/exercises\/new$/, /^\/exercises\/[^/]+\/edit$/];

function Shell() {
  const location = useLocation();
  const hideNav = ROUTES_WITHOUT_NAV.some((pattern) => pattern.test(location.pathname));

  return (
    <>
      <ScrollToTop />
      <ResumeActiveSession />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/training" element={<TrainingPage />} />
        <Route path="/training/plans/:planId" element={<PlanEditorPage />} />
        <Route path="/training/session/:sessionId" element={<SessionPage />} />
        <Route path="/exercises" element={<ExercisesPage />} />
        <Route path="/exercises/new" element={<ExerciseFormPage />} />
        <Route path="/exercises/:exerciseId" element={<ExerciseDetailPage />} />
        <Route path="/exercises/:exerciseId/edit" element={<ExerciseFormPage />} />
        <Route path="/progress" element={<ProgressPage />} />
        <Route path="/progress/metrics" element={<MetricsPage />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/food" element={<FoodPage />} />
        <Route path="/more" element={<MorePage />} />
        <Route path="/welcome" element={<WelcomePage />} />
        <Route path="*" element={<HomePage />} />
      </Routes>
      {!hideNav && <BottomNavBar />}
    </>
  );
}

function BootScreen({ state }: { state: "loading" | "error" }) {
  const t = createTranslator(detectBrowserLanguage());
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-5 px-8 text-center">
      <img src={asset("icons/app-icon-192.png")} alt="7MOVEUP" width={88} height={88} className="h-22 w-22 rounded-[22px]" />
      {state === "loading" ? (
        <p className="text-sm font-semibold text-muted">{t("app.loading")}</p>
      ) : (
        <>
          <p className="max-w-xs text-sm leading-relaxed text-muted">{t("app.storageError")}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="h-12 rounded-2xl bg-accent px-6 text-sm font-extrabold text-black"
          >
            {t("app.reload")}
          </button>
        </>
      )}
    </main>
  );
}

export default function App() {
  return (
    <AppProvider fallback={(state) => <BootScreen state={state} />}>
      <ToastProvider>
        <BrowserRouter basename={ROUTER_BASENAME}>
          <Shell />
        </BrowserRouter>
      </ToastProvider>
    </AppProvider>
  );
}
