import { en, type TranslationKey } from './en';
import { ru } from './ru';
import type { Language } from '@/types';

const dictionaries: Record<Language, Record<string, string>> = { en, ru };

/** Keys that resolve to `<key>.<plural category>` at call time. */
export type PluralKey = 'chat.messageCount' | 'character.chatsCount' | 'lore.entriesCount';
export type AnyKey = TranslationKey | PluralKey;

const pluralRules: Partial<Record<Language, Intl.PluralRules>> = {};

function selectPlural(lang: Language, count: number): string {
  pluralRules[lang] ??= new Intl.PluralRules(lang === 'ru' ? 'ru-RU' : 'en-US');
  return pluralRules[lang]!.select(count);
}

function interpolate(text: string, vars?: Record<string, string | number>): string {
  if (!vars) return text;
  let result = text;
  for (const [name, value] of Object.entries(vars)) {
    result = result.split(`{${name}}`).join(String(value));
  }
  return result;
}

export function translate(lang: Language, key: AnyKey, vars?: Record<string, string | number>): string {
  const dict = dictionaries[lang] ?? en;
  let text = dict[key] ?? (en as Record<string, string>)[key];

  if (text === undefined && typeof vars?.count === 'number') {
    const category = selectPlural(lang, vars.count);
    text =
      dict[`${key}.${category}`] ??
      dict[`${key}.other`] ??
      (en as Record<string, string>)[`${key}.${category}`] ??
      (en as Record<string, string>)[`${key}.other`];
  }

  return interpolate(text ?? key, vars);
}

export function detectLanguage(): Language {
  if (typeof navigator === 'undefined') return 'en';
  return navigator.language?.toLowerCase().startsWith('ru') ? 'ru' : 'en';
}

export const languageNames: Record<Language, string> = { en: 'English', ru: 'Русский' };
export type { TranslationKey };
