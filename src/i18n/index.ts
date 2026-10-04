import type { Exercise, Language, LocalizedText } from "@/domain/types";

import { de, type TranslationKey } from "./de";
import { en } from "./en";

const dictionaries: Record<Language, Record<TranslationKey, string>> = { de, en };

export type TranslateVars = Record<string, string | number>;
export type Translate = (key: TranslationKey, vars?: TranslateVars) => string;

export function createTranslator(language: Language): Translate {
  const dict = dictionaries[language];
  return (key, vars) => {
    const template = dict[key] ?? de[key] ?? key;
    if (!vars) return template;
    return template.replace(/\{(\w+)\}/g, (match, name: string) =>
      name in vars ? String(vars[name]) : match,
    );
  };
}

export function localized(text: LocalizedText, language: Language): string {
  return text[language]?.trim() || text.de || text.en;
}

export function exerciseName(exercise: Pick<Exercise, "name">, language: Language): string {
  return localized(exercise.name, language);
}

export type { TranslationKey };
