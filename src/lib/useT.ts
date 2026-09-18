import { useCallback } from 'react';
import { translate, type AnyKey } from '@/i18n';
import { useSettings } from '@/store/settings';

export function useT() {
  const language = useSettings((state) => state.language);
  return useCallback(
    (key: AnyKey, vars?: Record<string, string | number>) => translate(language, key, vars),
    [language],
  );
}

export function useLocale() {
  return useSettings((state) => state.language);
}
