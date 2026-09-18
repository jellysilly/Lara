import { useEffect } from 'react';
import { useTheme } from '@/lib/useTheme';
import { useSettings } from '@/store/settings';
import { useLibrary } from '@/store/library';
import { useChats } from '@/store/chats';
import { useUi } from '@/store/ui';
import { NavDrawerBackdrop, Ocean, Rail, TabBar } from '@/components/layout/Shell';
import { ChatView } from '@/components/chat/ChatView';
import { ChatPanel } from '@/components/chat/ChatPanel';
import { CharactersPage } from '@/components/characters/CharactersPage';
import { PersonasPage } from '@/components/personas/PersonasPage';
import { LorebooksPage } from '@/components/lorebook/LorebooksPage';
import { MemoryPage } from '@/components/memory/MemoryPage';
import { GeneratorPage } from '@/components/generator/GeneratorPage';
import { SettingsPage } from '@/components/settings/SettingsPage';
import { ConfirmHost, Toasts } from '@/components/ui/Overlays';
import { Onboarding } from '@/components/layout/Onboarding';

function Routes() {
  const route = useUi((state) => state.route);
  switch (route) {
    case 'characters':
      return <CharactersPage />;
    case 'personas':
      return <PersonasPage />;
    case 'lorebooks':
      return <LorebooksPage />;
    case 'memory':
      return <MemoryPage />;
    case 'generator':
      return <GeneratorPage />;
    case 'settings':
      return <SettingsPage />;
    case 'chat':
    default:
      return <ChatView />;
  }
}

export default function App() {
  useTheme();

  const hydrated = useSettings((state) => state.hydrated);
  const route = useUi((state) => state.route);
  const panelOpen = useUi((state) => state.panelOpen);
  const setPanelOpen = useUi((state) => state.setPanelOpen);

  useEffect(() => {
    void useSettings.getState().hydrate();
    void useLibrary.getState().hydrate();
    void useChats.getState().hydrate();
  }, []);

  // Open the chat side panel by default on roomy screens.
  useEffect(() => {
    if (window.innerWidth >= 1280) setPanelOpen(true);
  }, [setPanelOpen]);

  const showPanel = panelOpen && route === 'chat';

  return (
    <>
      <Ocean />
      <div className="shell" data-panel={showPanel ? 'open' : 'closed'}>
        <Rail />
        <main className="content">{hydrated ? <Routes /> : <div className="center-note">…</div>}</main>
        {showPanel && <ChatPanel />}
      </div>

      <TabBar />
      <NavDrawerBackdrop />
      <Toasts />
      <ConfirmHost />
      <Onboarding />
    </>
  );
}
