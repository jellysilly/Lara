import { useEffect, type ReactNode } from 'react';
import {
  BookOpen,
  BookMarked,
  Menu,
  MessagesSquare,
  Moon,
  Settings as SettingsIcon,
  X,
  Sparkles,
  Sun,
  SunMoon,
  UserRound,
  VenetianMask,
} from 'lucide-react';
import { useUi, type Route } from '@/store/ui';
import { useChats } from '@/store/chats';
import { useLibrary } from '@/store/library';
import { Avatar } from '@/components/ui/Avatar';
import { useSettings } from '@/store/settings';
import { useT } from '@/lib/useT';
import type { TranslationKey } from '@/i18n';
import logo from '@/assets/logo.png';

interface NavEntry {
  route: Route;
  label: TranslationKey;
  icon: ReactNode;
  badge?: number;
}

export function useNavEntries(): NavEntry[] {
  const chatCount = useChats((state) => state.index.length);
  const characters = useLibrary((state) => state.characters.length);
  const lorebooks = useLibrary((state) => state.lorebooks.length);
  const personas = useLibrary((state) => state.personas.length);

  return [
    { route: 'chat', label: 'nav.chats', icon: <MessagesSquare size={19} />, badge: chatCount },
    { route: 'characters', label: 'nav.characters', icon: <UserRound size={19} />, badge: characters },
    { route: 'personas', label: 'nav.personas', icon: <VenetianMask size={19} />, badge: personas },
    { route: 'lorebooks', label: 'nav.lorebooks', icon: <BookOpen size={19} />, badge: lorebooks },
    { route: 'memory', label: 'nav.memory', icon: <BookMarked size={19} /> },
    { route: 'generator', label: 'nav.generator', icon: <Sparkles size={19} /> },
    { route: 'settings', label: 'nav.settings', icon: <SettingsIcon size={19} /> },
  ];
}

export function Rail() {
  const t = useT();
  const route = useUi((state) => state.route);
  const go = useUi((state) => state.go);
  const navOpen = useUi((state) => state.navOpen);
  const setNavOpen = useUi((state) => state.setNavOpen);
  const entries = useNavEntries();

  return (
    <aside className="rail" data-open={navOpen ? 'true' : 'false'}>
      <div className="brand">
        <span className="brand-mark">
          <img src={logo} alt="" />
        </span>
        <span className="brand-text">
          <span className="brand-name">{t('app.name')}</span>
          <span className="brand-tag truncate">{t('app.tagline')}</span>
        </span>
        <button
          type="button"
          className="btn btn-ghost btn-icon btn-sm mobile-only"
          onClick={() => setNavOpen(false)}
          aria-label={t('common.close')}
        >
          <X size={18} />
        </button>
      </div>

      <nav className="rail-nav">
        {entries.map((entry) => (
          <button
            key={entry.route}
            type="button"
            className="nav-item"
            aria-current={route === entry.route ? 'page' : undefined}
            onClick={() => {
              go(entry.route);
              setNavOpen(false);
            }}
            title={t(entry.label)}
          >
            {entry.icon}
            <span>{t(entry.label)}</span>
            {entry.badge ? <span className="nav-badge">{entry.badge}</span> : null}
          </button>
        ))}
      </nav>

      <div className="rail-footer">
        <ActivePersonaChip />
        <ColorModeButton />
      </div>
    </aside>
  );
}

function ColorModeButton() {
  const t = useT();
  const mode = useSettings((state) => state.appearance.mode);
  const patchAppearance = useSettings((state) => state.patchAppearance);
  const next = mode === 'light' ? 'dark' : mode === 'dark' ? 'auto' : 'light';
  const Icon = mode === 'light' ? Sun : mode === 'dark' ? Moon : SunMoon;

  return (
    <button
      type="button"
      className="btn btn-ghost rail-footer-btn"
      onClick={() => patchAppearance({ mode: next })}
      title={t(`settings.appearance.mode.${mode}` as TranslationKey)}
    >
      <Icon size={18} />
      <span>{t(`settings.appearance.mode.${mode}` as TranslationKey)}</span>
    </button>
  );
}

function ActivePersonaChip() {
  const t = useT();
  const go = useUi((state) => state.go);
  const activeId = useSettings((state) => state.activePersonaId);
  const persona = useLibrary((state) => state.personas.find((item) => item.id === activeId));
  if (!persona) return null;

  return (
    <button type="button" className="btn btn-ghost rail-footer-btn" onClick={() => go('personas')} title={t('persona.active')}>
      <Avatar name={persona.name} src={persona.avatar} size={22} />
      <span className="truncate">{persona.name}</span>
    </button>
  );
}

export function TabBar() {
  const t = useT();
  const route = useUi((state) => state.route);
  const go = useUi((state) => state.go);
  const setNavOpen = useUi((state) => state.setNavOpen);

  const tabs: NavEntry[] = [
    { route: 'chat', label: 'nav.chats', icon: <MessagesSquare size={20} /> },
    { route: 'characters', label: 'nav.characters', icon: <UserRound size={20} /> },
    { route: 'generator', label: 'nav.generator', icon: <Sparkles size={20} /> },
    { route: 'lorebooks', label: 'nav.lorebooks', icon: <BookOpen size={20} /> },
  ];

  return (
    <nav className="tabbar">
      {tabs.map((tab) => (
        <button
          key={tab.route}
          type="button"
          aria-current={route === tab.route ? 'page' : undefined}
          onClick={() => go(tab.route)}
        >
          {tab.icon}
          <span>{t(tab.label)}</span>
        </button>
      ))}
      <button type="button" onClick={() => setNavOpen(true)}>
        <Menu size={20} />
        <span>{t('nav.menu')}</span>
      </button>
    </nav>
  );
}

export function Ocean() {
  const waves = useSettings((state) => state.appearance.waves);
  return (
    <>
      <div className="ocean" aria-hidden />
      {waves && (
        <div className="ocean-waves" aria-hidden>
          <span />
          <span />
          <span />
        </div>
      )}
    </>
  );
}

export function NavDrawerBackdrop() {
  const navOpen = useUi((state) => state.navOpen);
  const setNavOpen = useUi((state) => state.setNavOpen);

  useEffect(() => {
    if (!navOpen) return;
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setNavOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [navOpen, setNavOpen]);

  if (!navOpen) return null;
  return <div className="drawer-backdrop" onClick={() => setNavOpen(false)} aria-hidden />;
}
