import { useState } from 'react';
import { ArrowRight, Moon, Sun, SunMoon } from 'lucide-react';
import type { ColorMode, Language, ThemeName } from '@/types';
import { useT } from '@/lib/useT';
import { useSettings } from '@/store/settings';
import { useUi } from '@/store/ui';
import { Modal } from '@/components/ui/Modal';
import { Segmented } from '@/components/ui/Primitives';
import logo from '@/assets/logo.png';

const SWATCHES: Record<ThemeName, string[]> = {
  lagoon: ['#6DD3F7', '#7AB4F9', '#BBEBFB', '#E6F4F4'],
  seafoam: ['#91AD6C', '#E1F492', '#F9E280', '#F8F9D7'],
  coral: ['#F98787', '#FCE7E3', '#FCF8D2', '#FFFEF3'],
};

export function Onboarding() {
  const t = useT();
  const hydrated = useSettings((state) => state.hydrated);
  const onboarded = useSettings((state) => state.onboarded);
  const language = useSettings((state) => state.language);
  const appearance = useSettings((state) => state.appearance);
  const patch = useSettings((state) => state.patch);
  const patchAppearance = useSettings((state) => state.patchAppearance);
  const go = useUi((state) => state.go);
  const [dismissed, setDismissed] = useState(false);

  const open = hydrated && !onboarded && !dismissed;

  const finish = (openSettings: boolean) => {
    patch({ onboarded: true });
    setDismissed(true);
    if (openSettings) go('settings');
  };

  return (
    <Modal
      open={open}
      title={t('onboard.welcome')}
      onClose={() => finish(false)}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={() => finish(false)}>
            {t('onboard.skip')}
          </button>
          <span className="spacer" />
          <button type="button" className="btn btn-primary" onClick={() => finish(true)}>
            {t('onboard.start')}
            <ArrowRight size={16} />
          </button>
        </>
      }
    >
      <div className="row" style={{ gap: 'var(--space-4)' }}>
        <span className="brand-mark" style={{ width: 62, height: 62, borderRadius: 18 }}>
          <img src={logo} alt="" />
        </span>
        <p className="small muted" style={{ margin: 0 }}>
          {t('onboard.body')}
        </p>
      </div>

      <Segmented
        label={t('common.language')}
        value={language}
        onChange={(value: Language) => patch({ language: value })}
        options={[
          { value: 'en', label: 'English' },
          { value: 'ru', label: 'Русский' },
        ]}
      />

      <div className="theme-grid">
        {(Object.keys(SWATCHES) as ThemeName[]).map((theme) => (
          <button
            key={theme}
            type="button"
            className="theme-card"
            data-active={appearance.theme === theme}
            onClick={() => patchAppearance({ theme })}
          >
            <span className="theme-swatches">
              {SWATCHES[theme].map((color) => (
                <span key={color} style={{ background: color }} />
              ))}
            </span>
            <span className="small" style={{ fontWeight: 600 }}>
              {t(`settings.appearance.theme.${theme}` as Parameters<typeof t>[0])}
            </span>
          </button>
        ))}
      </div>

      <Segmented
        label={t('settings.appearance.mode')}
        value={appearance.mode}
        onChange={(mode: ColorMode) => patchAppearance({ mode })}
        options={[
          { value: 'light', label: t('settings.appearance.mode.light'), icon: <Sun size={14} /> },
          { value: 'dark', label: t('settings.appearance.mode.dark'), icon: <Moon size={14} /> },
          { value: 'auto', label: t('settings.appearance.mode.auto'), icon: <SunMoon size={14} /> },
        ]}
      />
    </Modal>
  );
}
