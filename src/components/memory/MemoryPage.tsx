import { BookMarked, Pin, PinOff, Plus, RefreshCcw, Trash2, Wand2 } from 'lucide-react';
import { useT, useLocale } from '@/lib/useT';
import { formatRelative } from '@/lib/utils';
import { estimateTokens } from '@/lib/tokenizer';
import { useChats } from '@/store/chats';
import { useLibrary } from '@/store/library';
import { useSettings } from '@/store/settings';
import { useUi } from '@/store/ui';
import { TopBar } from '@/components/layout/TopBar';
import { EmptyState, Field, Section, Slider, Switch, TextArea, TextInput } from '@/components/ui/Primitives';

export function MemoryPage() {
  const t = useT();
  const locale = useLocale();
  const chat = useChats((state) => state.chat);
  const summarizing = useChats((state) => state.summarizing);
  const { addMemory, updateMemory, deleteMemory, summarizeChat } = useChats.getState();
  const characters = useLibrary((state) => state.characters);
  const promptSettings = useSettings((state) => state.prompt);
  const patchPrompt = useSettings((state) => state.patchPrompt);
  const askConfirm = useUi((state) => state.askConfirm);
  const go = useUi((state) => state.go);

  const character = characters.find((item) => item.id === chat?.characterId);
  const budget = Math.round(promptSettings.contextSize * promptSettings.memoryBudget);
  const used = (chat?.memory ?? [])
    .filter((entry) => entry.enabled)
    .reduce((sum, entry) => sum + estimateTokens(`${entry.title} ${entry.content}`), 0);

  if (!chat) {
    return (
      <>
        <TopBar title={t('memory.title')} />
        <div className="scroll-area">
          <div className="page">
            <EmptyState
              icon={<BookMarked size={28} />}
              body={t('memory.noChat')}
              action={
                <button type="button" className="btn btn-sm btn-primary" onClick={() => go('chat')}>
                  {t('nav.chats')}
                </button>
              }
            />
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <TopBar title={t('memory.title')} subtitle={character?.name ?? chat.title}>
        <button
          type="button"
          className="btn btn-sm"
          disabled={summarizing}
          onClick={() => void summarizeChat()}
        >
          {summarizing ? <RefreshCcw size={15} className="spin" /> : <Wand2 size={15} />}
          <span className="desktop-only">{summarizing ? t('memory.summarizing') : t('memory.summarize')}</span>
        </button>
        <button type="button" className="btn btn-sm btn-primary" onClick={() => addMemory()}>
          <Plus size={15} />
          <span className="desktop-only">{t('memory.new')}</span>
        </button>
      </TopBar>

      <div className="scroll-area">
        <div className="page">
          <div className="page-head">
            <div className="stack" style={{ gap: 4 }}>
              <h2>{t('memory.title')}</h2>
              <p>{t('memory.subtitle')}</p>
            </div>
          </div>

          <Section title={`${used} / ${budget} ${t('common.tokens')}`}>
            <div className="meter">
              <span
                style={{
                  width: `${Math.min(100, (used / Math.max(1, budget)) * 100)}%`,
                  background:
                    used > budget ? 'var(--danger)' : 'linear-gradient(90deg, var(--brand-1), var(--brand-2))',
                }}
              />
            </div>
            <Slider
              label={t('memory.budget')}
              min={2}
              max={40}
              value={Math.round(promptSettings.memoryBudget * 100)}
              onChange={(value) => patchPrompt({ memoryBudget: value / 100 })}
              unit="%"
              hint={t('memory.budgetHint')}
            />
            <Switch
              checked={promptSettings.autoSummary}
              onChange={(autoSummary) => patchPrompt({ autoSummary })}
              label={t('memory.autoSummary')}
            />
            {promptSettings.autoSummary && (
              <Slider
                label={t('memory.autoSummaryInterval')}
                min={6}
                max={60}
                step={2}
                value={promptSettings.autoSummaryInterval}
                onChange={(autoSummaryInterval) => patchPrompt({ autoSummaryInterval })}
              />
            )}
          </Section>

          {chat.memory.length === 0 ? (
            <EmptyState
              icon={<BookMarked size={28} />}
              body={t('memory.empty')}
              action={
                <div className="row-wrap" style={{ justifyContent: 'center' }}>
                  <button type="button" className="btn btn-sm btn-primary" onClick={() => addMemory()}>
                    <Plus size={15} />
                    {t('memory.new')}
                  </button>
                  <button type="button" className="btn btn-sm" disabled={summarizing} onClick={() => void summarizeChat()}>
                    <Wand2 size={15} />
                    {t('memory.summarize')}
                  </button>
                </div>
              }
            />
          ) : (
            <div className="stack" style={{ gap: 'var(--space-3)' }}>
              {chat.memory.map((entry) => (
                <article className="section" key={entry.id} style={{ gap: 'var(--space-3)' }}>
                  <div className="row-wrap">
                    <span className="chip tiny">{entry.source === 'auto' ? t('memory.auto') : t('memory.manual')}</span>
                    {entry.coveredUpTo != null && (
                      <span className="chip tiny">{t('memory.coversUpTo', { n: entry.coveredUpTo })}</span>
                    )}
                    <span className="chip tiny">{estimateTokens(entry.content)} {t('common.tokens')}</span>
                    <span className="tiny muted">{formatRelative(entry.updatedAt, locale)}</span>
                    <span className="spacer" />
                    <button
                      type="button"
                      className="msg-tool"
                      aria-label={entry.pinned ? t('memory.unpin') : t('memory.pin')}
                      onClick={() => updateMemory(entry.id, { pinned: !entry.pinned })}
                      style={{ color: entry.pinned ? 'var(--accent-ink)' : undefined }}
                    >
                      {entry.pinned ? <Pin size={15} /> : <PinOff size={15} />}
                    </button>
                    <button
                      type="button"
                      className="msg-tool"
                      data-danger="true"
                      aria-label={t('common.delete')}
                      onClick={async () => {
                        if (await askConfirm(t('memory.deleteConfirm'), true)) deleteMemory(entry.id);
                      }}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>

                  <Field label={t('common.title')}>
                    <TextInput
                      value={entry.title}
                      onChange={(event) => updateMemory(entry.id, { title: event.target.value })}
                    />
                  </Field>
                  <Field label={t('common.content')}>
                    <TextArea
                      value={entry.content}
                      style={{ minHeight: 120 }}
                      onChange={(event) => updateMemory(entry.id, { content: event.target.value })}
                    />
                  </Field>
                  <Switch
                    checked={entry.enabled}
                    onChange={(enabled) => updateMemory(entry.id, { enabled })}
                    label={t('common.enabled')}
                  />
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
