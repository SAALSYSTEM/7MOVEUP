import { Salad, Sparkles } from "lucide-react";

import { useApp } from "@/app/app-context";
import { AppHeader, PageTitle } from "@/components/layout/app-header";
import { Page } from "@/components/layout/page";

/** V1: bewusst nur Coming Soon – keine Fake-Funktion, keine Dummy-Werte. */
export function FoodPage() {
  const { t } = useApp();
  return (
    <Page>
      <AppHeader left={<PageTitle>{t("food.title")}</PageTitle>} />
      <section className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[#101012] px-6 py-12 text-center">
        <div aria-hidden className="pointer-events-none absolute left-1/2 top-6 h-48 w-48 -translate-x-1/2 rounded-full bg-accent/12 blur-3xl" />
        <div className="relative mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-[24px] border border-white/10 bg-card text-accent">
          <Salad size={36} strokeWidth={1.8} aria-hidden />
        </div>
        <span className="relative inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-accent-light">
          <Sparkles size={12} aria-hidden /> {t("food.badge")}
        </span>
        <h2 className="relative mx-auto mt-5 max-w-sm text-balance text-[32px] font-black uppercase leading-[1.04] tracking-[-0.04em]">
          {t("food.headline")}
        </h2>
        <p className="relative mx-auto mt-4 max-w-xs text-sm leading-relaxed text-muted">{t("food.text")}</p>
      </section>
    </Page>
  );
}
