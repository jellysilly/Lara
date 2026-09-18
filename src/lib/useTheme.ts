import { useEffect } from 'react';
import { useSettings } from '@/store/settings';

/** Mirrors appearance settings onto the document root as data-* and CSS vars. */
export function useTheme(): void {
  const appearance = useSettings((state) => state.appearance);
  const language = useSettings((state) => state.language);

  useEffect(() => {
    const root = document.documentElement;
    const media = window.matchMedia('(prefers-color-scheme: dark)');

    const applyMode = () => {
      const mode = appearance.mode === 'auto' ? (media.matches ? 'dark' : 'light') : appearance.mode;
      root.dataset.mode = mode;
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) {
        meta.setAttribute('content', getComputedStyle(root).getPropertyValue('--bg').trim() || '#eef7fb');
      }
    };

    root.dataset.theme = appearance.theme;
    root.dataset.animations = appearance.animations ? 'on' : 'off';
    root.dataset.blur = appearance.blur ? 'on' : 'off';
    root.lang = language;
    root.style.setProperty('--font-size', `${appearance.fontSize}px`);
    root.style.setProperty('--font-prose', appearance.serifBody ? 'var(--font-serif)' : 'var(--font-ui)');
    applyMode();

    media.addEventListener('change', applyMode);
    return () => media.removeEventListener('change', applyMode);
  }, [appearance, language]);
}
