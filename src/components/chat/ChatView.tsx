import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { ArrowDown, MessageSquarePlus, PanelRight, Plus, Settings2, TriangleAlert } from 'lucide-react';
import { useT } from '@/lib/useT';
import { useBuiltPrompt, useDraft } from '@/lib/usePrompt';
import { useChats } from '@/store/chats';
import { useLibrary } from '@/store/library';
import { useSettings } from '@/store/settings';
import { useUi } from '@/store/ui';
import { TopBar } from '@/components/layout/TopBar';
import { Avatar } from '@/components/ui/Avatar';
import { MessageBubble } from './Message';
import { Composer } from './Composer';
import logo from '@/assets/logo.png';

function ChatHero() {
  const t = useT();
  const go = useUi((state) => state.go);
  const characters = useLibrary((state) => state.characters);
  const createChat = useChats((state) => state.createChat);

  return (
    <div className="chat-hero">
      <span className="chat-hero-mark">
        <img src={logo} alt="" />
      </span>
      <div className="stack" style={{ gap: 6 }}>
        <h2>{t('app.name')}</h2>
        <p className="muted small">{t('chat.startHint')}</p>
      </div>

      {characters.length ? (
        <div className="stack" style={{ width: '100%', gap: 'var(--space-2)' }}>
          {characters.slice(0, 5).map((character) => (
            <button key={character.id} type="button" className="list-card" onClick={() => void createChat(character)}>
              <Avatar name={character.name} src={character.avatar} size={40} />
              <span className="list-card-body">
                <span className="list-card-title truncate">{character.name}</span>
                <span className="list-card-sub truncate">{character.creatorNotes || character.tags.join(' · ')}</span>
              </span>
              <MessageSquarePlus size={17} className="muted" />
            </button>
          ))}
          <button type="button" className="btn btn-ghost btn-block" onClick={() => go('characters')}>
            {t('character.title')}
          </button>
        </div>
      ) : (
        <div className="stack" style={{ width: '100%' }}>
          <button type="button" className="btn btn-primary btn-block" onClick={() => go('characters')}>
            <Plus size={16} />
            {t('character.new')}
          </button>
          <button type="button" className="btn btn-block" onClick={() => go('generator')}>
            {t('gen.title')}
          </button>
        </div>
      )}
    </div>
  );
}

export function ChatView() {
  const t = useT();
  const chat = useChats((state) => state.chat);
  const streamingId = useChats((state) => state.streamingId);
  const error = useChats((state) => state.error);
  const generating = useChats((state) => state.generating);
  const characters = useLibrary((state) => state.characters);
  const appearance = useSettings((state) => state.appearance);
  const panelOpen = useUi((state) => state.panelOpen);
  const setPanelOpen = useUi((state) => state.setPanelOpen);
  const go = useUi((state) => state.go);

  const prompt = useBuiltPrompt();
  const setDraft = useDraft((state) => state.setDraft);

  const scrollRef = useRef<HTMLDivElement>(null);
  const [atBottom, setAtBottom] = useState(true);

  const character = useMemo(
    () => characters.find((item) => item.id === chat?.characterId) ?? null,
    [characters, chat?.characterId],
  );

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    const node = scrollRef.current;
    if (!node) return;
    node.scrollTo({ top: node.scrollHeight, behavior });
  }, []);

  const messageCount = chat?.messages.length ?? 0;
  const lastCount = useRef(0);
  useEffect(() => {
    if (messageCount === lastCount.current) return;
    const first = lastCount.current === 0;
    lastCount.current = messageCount;
    if (atBottom) requestAnimationFrame(() => scrollToBottom(first ? 'auto' : 'smooth'));
  }, [messageCount, atBottom, scrollToBottom]);

  // Keep the view pinned to the newest line while tokens stream in.
  const streamedLength = chat?.messages[messageCount - 1]?.swipes[chat.messages[messageCount - 1].swipeIndex]?.length ?? 0;
  useEffect(() => {
    if (generating && atBottom) scrollToBottom('auto');
  }, [streamedLength, generating, atBottom, scrollToBottom]);

  useEffect(() => {
    lastCount.current = 0;
    setAtBottom(true);
    setDraft('');
    requestAnimationFrame(() => scrollToBottom('auto'));
  }, [chat?.id, scrollToBottom, setDraft]);

  const onScroll = () => {
    const node = scrollRef.current;
    if (!node) return;
    setAtBottom(node.scrollHeight - node.scrollTop - node.clientHeight < 90);
  };

  if (!chat) {
    return (
      <>
        <TopBar title={t('nav.chats')}>
          <button
            type="button"
            className="btn btn-ghost btn-icon"
            onClick={() => setPanelOpen(!panelOpen)}
            aria-label={t('chat.chats')}
          >
            <PanelRight size={18} />
          </button>
        </TopBar>
        <div className="scroll-area">
          <ChatHero />
        </div>
      </>
    );
  }

  return (
    <>
      <TopBar title={character?.name || chat.title} subtitle={t('chat.messageCount', { count: messageCount })}>
        <button
          type="button"
          className="btn btn-ghost btn-icon"
          onClick={() => setPanelOpen(!panelOpen)}
          aria-label={t('chat.quickSettings')}
        >
          <Settings2 size={18} />
        </button>
      </TopBar>

      {error && (
        <div className="banner-error">
          <TriangleAlert size={15} />
          <span className="truncate">{error === 'no-api' ? t('chat.noApi') : error}</span>
          <span className="spacer" />
          {error === 'no-api' && (
            <button type="button" className="btn btn-sm" onClick={() => go('settings')}>
              {t('chat.openSettings')}
            </button>
          )}
        </div>
      )}

      <div
        className="chat"
        data-style={appearance.chatStyle}
        data-avatars={appearance.avatarMode}
        style={
          {
            '--avatar-size': `${appearance.avatarSize}px`,
            '--chat-width': `${appearance.chatWidth}px`,
            '--msg-gap': `${appearance.messageGap}px`,
          } as CSSProperties
        }
      >
        <div className="messages" ref={scrollRef} onScroll={onScroll}>
          <div className="messages-inner">
            {messageCount === 0 && <p className="center-note">{t('chat.emptyThread')}</p>}
            {chat.messages.map((message, index) => (
              <MessageBubble
                key={message.id}
                message={message}
                isLast={index === messageCount - 1}
                streaming={streamingId === message.id}
              />
            ))}
          </div>
        </div>

        {!atBottom && (
          <button type="button" className="scroll-down" onClick={() => scrollToBottom()}>
            <ArrowDown size={14} />
            {t('chat.scrollDown')}
          </button>
        )}

        <Composer prompt={prompt} onDraftChange={setDraft} />
      </div>
    </>
  );
}
