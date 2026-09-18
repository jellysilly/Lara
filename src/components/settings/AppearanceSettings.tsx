import type { CSSProperties } from 'react';
import { Check, Moon, Sun, SunMoon } from 'lucide-react';
import type { AvatarMode, ChatStyle, ColorMode, ThemeName } from '@/types';
import { useT } from '@/lib/useT';
import { renderMarkdown } from '@/lib/markdown';
import { useSettings } from '@/store/settings';
import { Section, Segmented, Slider, Switch } from '@/components/ui/Primitives';
import { Avatar } from '@/components/ui/Avatar';

const THEME_SWATCHES: Record<ThemeName, string[]> = {
  lagoon: ['#6DD3F7', '#7AB4F9', '#BBEBFB', '#E6F4F4'],
  seafoam: ['#91AD6C', '#E1F492', '#F9E280', '#F8F9D7'],
  coral: ['#F98787', '#FCE7E3', '#FCF8D2', '#FFFEF3'],
};

function PreviewMessage({ role, name, text }: { role: 'user' | 'assistant'; name: string; text: string }) {
  return (
    <article className="msg" data-role={role}>
      <Avatar className="msg-avatar" name={name} size={undefined} />
      <div className="msg-body">
        <header className="msg-head">
          <span className="msg-name">{name}</span>
        </header>
        <div className="msg-content" dangerouslySetInnerHTML={{ __html: renderMarkdown(text) }} />
      </div>
    </article>
  );
}

export function AppearanceSettings() {
  const t = useT();
  const appearance = useSettings((state) => state.appearance);
  const patchAppearance = useSettings((state) => state.patchAppearance);

  return (
    <>
      <Section title={t('settings.appearance.theme')}>
        <div className="theme-grid">
          {(Object.keys(THEME_SWATCHES) as ThemeName[]).map((theme) => (
            <button
              key={theme}
              type="button"
              className="theme-card"
              data-active={appearance.theme === theme}
              onClick={() => patchAppearance({ theme })}
            >
              <span className="theme-swatches">
                {THEME_SWATCHES[theme].map((color) => (
                  <span key={color} style={{ background: color }} />
                ))}
              </span>
              <span className="row" style={{ gap: 6 }}>
                <span className="small" style={{ fontWeight: 600 }}>
                  {t(`settings.appearance.theme.${theme}` as Parameters<typeof t>[0])}
                </span>
                {appearance.theme === theme && <Check size={14} />}
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
      </Section>

      <Section title={t('settings.appearance.preview')}>
        <div
          className="chat preview-chat"
          data-style={appearance.chatStyle}
          data-avatars={appearance.avatarMode}
          style={
            {
              '--avatar-size': `${appearance.avatarSize}px`,
              '--msg-gap': `${appearance.messageGap}px`,
              fontSize: `${appearance.fontSize}px`,
              fontFamily: appearance.serifBody ? 'var(--font-serif)' : 'var(--font-ui)',
            } as CSSProperties
          }
        >
          <div className="messages-inner">
            <PreviewMessage
              role="assistant"
              name="Marin"
              text="*She leans on the rail, salt drying white along her forearms.* “The tide turns in an hour. You coming, or are you just here for the view?”"
            />
            <PreviewMessage role="user" name="You" text="“Both, if that's allowed.”" />
          </div>
        </div>

        <Segmented
          label={t('settings.appearance.chatStyle')}
          value={appearance.chatStyle}
          onChange={(chatStyle: ChatStyle) => patchAppearance({ chatStyle })}
          options={[
            { value: 'flat', label: t('settings.appearance.chatStyle.flat') },
            { value: 'bubble', label: t('settings.appearance.chatStyle.bubble') },
          ]}
        />

        <Segmented
          label={t('settings.appearance.avatarMode')}
          value={appearance.avatarMode}
          onChange={(avatarMode: AvatarMode) => patchAppearance({ avatarMode })}
          options={[
            { value: 'messenger', label: t('settings.appearance.avatarMode.messenger') },
            { value: 'above', label: t('settings.appearance.avatarMode.above') },
            { value: 'none', label: t('settings.appearance.avatarMode.none') },
          ]}
        />

        {appearance.avatarMode !== 'none' && (
          <>
            <Slider
              label={t('settings.appearance.avatarSize')}
              min={24}
              max={96}
              value={appearance.avatarSize}
              onChange={(avatarSize) => patchAppearance({ avatarSize })}
              unit="px"
            />
            <Segmented
              label={t('settings.appearance.avatarShape')}
              value={appearance.avatarShape}
              onChange={(avatarShape) => patchAppearance({ avatarShape })}
              options={[
                { value: 'circle', label: t('settings.appearance.avatarShape.circle') },
                { value: 'rounded', label: t('settings.appearance.avatarShape.rounded') },
                { value: 'square', label: t('settings.appearance.avatarShape.square') },
              ]}
            />
          </>
        )}
      </Section>

      <Section title={t('common.advanced')}>
        <Slider
          label={t('settings.appearance.fontSize')}
          min={13}
          max={22}
          value={appearance.fontSize}
          onChange={(fontSize) => patchAppearance({ fontSize })}
          unit="px"
        />
        <Slider
          label={t('settings.appearance.chatWidth')}
          min={520}
          max={1280}
          step={20}
          value={appearance.chatWidth}
          onChange={(chatWidth) => patchAppearance({ chatWidth })}
          unit="px"
        />
        <Slider
          label={t('settings.appearance.messageGap')}
          min={4}
          max={40}
          value={appearance.messageGap}
          onChange={(messageGap) => patchAppearance({ messageGap })}
          unit="px"
        />
        <Switch
          checked={appearance.serifBody}
          onChange={(serifBody) => patchAppearance({ serifBody })}
          label={t('settings.appearance.serif')}
        />
        <Switch
          checked={appearance.animations}
          onChange={(animations) => patchAppearance({ animations })}
          label={t('settings.appearance.animations')}
        />
        <Switch
          checked={appearance.waves}
          onChange={(waves) => patchAppearance({ waves })}
          label={t('settings.appearance.waves')}
        />
        <Switch
          checked={appearance.blur}
          onChange={(blur) => patchAppearance({ blur })}
          label={t('settings.appearance.blur')}
        />
      </Section>
    </>
  );
}
