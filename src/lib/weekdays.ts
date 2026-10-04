import type { Weekday } from "@/domain/types";
import type { Translate } from "@/i18n";

export const WEEKDAYS: Weekday[] = [1, 2, 3, 4, 5, 6, 7];

export function exerciseCountLabel(t: Translate, count: number) {
  return count === 1 ? t("home.exerciseCountOne") : t("home.exerciseCount", { count });
}
