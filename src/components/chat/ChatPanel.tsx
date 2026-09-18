import { useMemo, useState } from 'react';
import {
  BookMarked,
  BookOpen,
  Download,
  GitBranch,
  MessageSquarePlus,
  PieChart,
  Sparkles,
  Trash2,
  VenetianMask,
  X,
} from 'lucide-react';
import { useT, useLocale } from '@/lib/useT';
import { useBuiltPrompt } from '@/lib/usePrompt';
import { downloadFile, formatRelative, truncate } from '@/lib/utils';
import { useChats, messageText } from '@/store/chats';
import { useLibrary } from '@/store/library';
import { useSettings } from '@/store/settings';
import { useUi } from '@/store/ui';
import { Field, Segmented, Select, Slider, TextArea } from '@/components/ui/Primitives';
import { TokenBreakdown, UsageStats } from './TokenMeter';

function Collapsible({ title, icon, children, defaultOpen = false }: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details className="collapsible" open={defaultOpen}>
      <summary>
        {icon}
        <span>{title}</span>
      </summary>
      <div className="collapsible-body">{children}</div>
    </details>
  );
}

export function ChatPanel() {
  const t = useT();
  const locale = useLocale();
  const chat = useChats((state) => state.chat);
  const index = useChats((state) => state.index);
  const { createChat, openChat, deleteChat, patchChat } = useChats.getState();
  const characters = useLibrary((state) => state.characters);
  const personas = useLibrary((state) => state.personas);
  const lorebooks = useLibrary((state) => state.lorebooks);
  const appearance = useSettings((state) => state.appearance);
  const patchAppearance = useSettings((state) => state.patchAppearance);
  const setPanelOpen = useUi((state) => state.setPanelOpen);
  const go = useUi((state) => state.go);
  const askConfirm = useUi((state) => state.askConfirm);
  const prompt = useBuiltPrompt();

  const [filterToCharacter, setFilterToCharacter] = useState(true);

  const character = characters.find((item) => item.id === chat?.characterId) ?? null;
  const visibleChats = useMemo(() => {
    if (!chat || !filterToCharacter) return index;
    return index.filter((item) => item.characterId === chat.characterId);
  }, [index, chat, filterToCharacter]);

  const exportChat = () => {
    if (!chat) return;
    const transcript = chat.messages
      .map((message) => `**${message.name}**\n\n${messageText(message)}`)
      .join('\n\n---\n\n');
    downloadFile(`# ${chat.title}\n\n${transcript}\n`, `${chat.title || 'chat'}.md`, 'text/markdown');
  };

  return (
    <>
      <div className="panel-backdrop" onClick={() => setPanelOpen(false)} aria-hidden />
      <aside className="panel">
        <header className="panel-head">
          <strong className="small truncate">{t('chat.quickSettings')}</strong>
          <span className="spacer" />
          <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={() => setPanelOpen(false)}>
            <X size={17} />
          </button>
        </header>

        <div className="panel-body">
          {character && (
            <button
              type="button"
              className="btn btn-primary btn-block"
              onClick={() => void createChat(character)}
            >
              <MessageSquarePlus size={16} />
              {t('chat.newChat')}
            </button>
          )}

          <Collapsible title={t('chat.chats')} icon={<MessageSquarePlus size={15} />} defaultOpen>
            {character && (
              <Segmented
                value={filterToCharacter ? 'character' : 'all'}
                onChange={(value) => setFilterToCharacter(value === 'character')}
                options={[
                  { value: 'character', label: character.name },
                  { value: 'all', label: t('common.more') },
                ]}
              />
            )}
            <div className="stack" style={{ gap: 6, marginTop: 'var(--space-2)' }}>
              {visibleChats.slice(0, 40).map((item) => (
                <div key={item.id} className="row" style={{ gap: 4 }}>
                  <button
                    type="button"
                    className="list-card"
                    data-active={item.id === chat?.id}
                    onClick={() => void openChat(item.id)}
                  >
                    <span className="list-card-body">
                      <span className="list-card-title truncate">{item.title}</span>
                      <span className="list-card-sub truncate">
                        {item.lastMessage ? truncate(item.lastMessage, 44) : formatRelative(item.updatedAt, locale)}
                      </span>
                    </span>
                    <span className="chip tiny">{item.messageCount}</span>
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-icon btn-sm"
                    aria-label={t('chat.deleteChat')}
                    onClick={async () => {
                      if (await askConfirm(t('chat.deleteChatConfirm'), true)) await deleteChat(item.id);
                    }}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
              {!visibleChats.length && <p className="tiny muted">{t('chat.noChats')}</p>}
            </div>
          </Collapsible>

          {chat && (
            <>
              <Collapsible title={t('tokens.breakdown')} icon={<PieChart size={15} />} defaultOpen>
                <TokenBreakdown prompt={prompt} />
                <hr className="divider" style={{ margin: 'var(--space-3) 0' }} />
                <UsageStats />
              </Collapsible>

              <Collapsible title={t('chat.authorNote')} icon={<Sparkles size={15} />}>
                <div className="stack" style={{ gap: 'var(--space-3)' }}>
                  <TextArea
                    value={chat.authorNote.content}
                    placeholder={t('chat.authorNoteHint')}
                    style={{ minHeight: 78 }}
                    onChange={(event) =>
                      patchChat({ authorNote: { ...chat.authorNote, content: event.target.value } })
                    }
                  />
                  <Slider
                    label={t('chat.authorNoteDepth')}
                    min={0}
                    max={10}
                    value={chat.authorNote.depth}
                    onChange={(depth) => patchChat({ authorNote: { ...chat.authorNote, depth } })}
                  />
                </div>
              </Collapsible>

              <Collapsible title={t('persona.active')} icon={<VenetianMask size={15} />}>
                <Select
                  value={chat.personaId ?? ''}
                  onChange={(event) => patchChat({ personaId: event.target.value || undefined })}
                >
                  <option value="">{t('common.none')}</option>
                  {personas.map((persona) => (
                    <option key={persona.id} value={persona.id}>
                      {persona.name || t('common.unnamed')}
                    </option>
                  ))}
                </Select>
                <button type="button" className="btn btn-ghost btn-sm btn-block" onClick={() => go('personas')} style={{ marginTop: 8 }}>
                  {t('nav.personas')}
                </button>
              </Collapsible>

              <Collapsible title={t('lore.activeInChat')} icon={<BookOpen size={15} />}>
                <div className="stack" style={{ gap: 6 }}>
                  {lorebooks.length === 0 && <p className="tiny muted">{t('lore.empty')}</p>}
                  {lorebooks.map((book) => {
                    const active = chat.lorebookIds.includes(book.id) || book.global;
                    return (
                      <label key={book.id} className="switch">
                        <input
                          type="checkbox"
                          checked={active}
                          disabled={book.global}
                          onChange={(event) =>
                            patchChat({
                              lorebookIds: event.target.checked
                                ? [...chat.lorebookIds, book.id]
                                : chat.lorebookIds.filter((id) => id !== book.id),
                            })
                          }
                        />
                        <span className="switch-track" />
                        <span className="switch-label truncate">
                          {book.name || t('common.unnamed')}
                          {book.global && <span className="chip tiny" style={{ marginLeft: 6 }}>{t('lore.global')}</span>}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </Collapsible>

              <Collapsible title={t('memory.title')} icon={<BookMarked size={15} />}>
                <p className="tiny muted">{t('memory.subtitle')}</p>
                <button type="button" className="btn btn-sm btn-block" onClick={() => go('memory')} style={{ marginTop: 8 }}>
                  {t('memory.title')} · {chat.memory.length}
                </button>
              </Collapsible>
            </>
          )}

          <Collapsible title={t('settings.tab.appearance')} icon={<Sparkles size={15} />}>
            <div className="stack" style={{ gap: 'var(--space-3)' }}>
              <Segmented
                label={t('settings.appearance.chatStyle')}
                value={appearance.chatStyle}
                onChange={(chatStyle) => patchAppearance({ chatStyle })}
                options={[
                  { value: 'flat', label: t('settings.appearance.chatStyle.flat') },
                  { value: 'bubble', label: t('settings.appearance.chatStyle.bubble') },
                ]}
              />
              <Segmented
                label={t('settings.appearance.avatarMode')}
                value={appearance.avatarMode}
                onChange={(avatarMode) => patchAppearance({ avatarMode })}
                options={[
                  { value: 'messenger', label: t('settings.appearance.avatarMode.messenger') },
                  { value: 'above', label: t('settings.appearance.avatarMode.above') },
                  { value: 'none', label: t('settings.appearance.avatarMode.none') },
                ]}
              />
              {appearance.avatarMode !== 'none' && (
                <Slider
                  label={t('settings.appearance.avatarSize')}
                  min={28}
                  max={84}
                  value={appearance.avatarSize}
                  onChange={(avatarSize) => patchAppearance({ avatarSize })}
                  format={(value) => `${value}px`}
                />
              )}
              <Field label={t('common.more')}>
                <button type="button" className="btn btn-sm btn-block" onClick={() => go('settings')}>
                  {t('settings.title')}
                </button>
              </Field>
            </div>
          </Collapsible>

          {chat && (
            <div className="row-wrap">
              <button type="button" className="btn btn-sm" onClick={exportChat}>
                <Download size={15} />
                {t('chat.exportChat')}
              </button>
              {chat.branchedFrom && (
                <span className="chip">
                  <GitBranch size={12} />
                  {t('chat.branch')}
                </span>
              )}
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
