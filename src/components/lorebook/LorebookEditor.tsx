import { useMemo, useState } from 'react';
import { Download, Plus, Trash2, Zap } from 'lucide-react';
import type { LoreEntry, Lorebook } from '@/types';
import { useT } from '@/lib/useT';
import { downloadFile, splitList, uid } from '@/lib/utils';
import { emptyEntry, activateLore } from '@/lib/lorebook';
import { estimateTokens } from '@/lib/tokenizer';
import { createLorebook, useLibrary } from '@/store/library';
import { useUi } from '@/store/ui';
import { Modal } from '@/components/ui/Modal';
import { Field, Section, Select, Slider, Switch, TextArea, TextInput } from '@/components/ui/Primitives';

function EntryCard({
  entry,
  onChange,
  onDelete,
  matched,
}: {
  entry: LoreEntry;
  onChange: (entry: LoreEntry) => void;
  onDelete: () => void;
  matched: boolean;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const patch = (value: Partial<LoreEntry>) => onChange({ ...entry, ...value });

  return (
    <details className="collapsible" open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary>
        <span className="truncate" style={{ flex: 1, minWidth: 0 }}>
          {entry.comment || entry.keys[0] || t('lore.untitledEntry')}
        </span>
        {matched && (
          <span className="chip tiny chip-accent">
            <Zap size={10} />
          </span>
        )}
        {entry.constant && <span className="chip tiny">{t('lore.constant')}</span>}
        <span className="chip tiny">{estimateTokens(entry.content)}</span>
      </summary>

      <div className="collapsible-body stack">
        <Field label={t('lore.comment')}>
          <TextInput value={entry.comment} onChange={(event) => patch({ comment: event.target.value })} />
        </Field>

        <Field label={t('lore.keys')} hint={t('lore.keysHint')}>
          <TextInput value={entry.keys.join(', ')} onChange={(event) => patch({ keys: splitList(event.target.value) })} />
        </Field>

        <Field label={t('common.content')}>
          <TextArea
            value={entry.content}
            style={{ minHeight: 120 }}
            onChange={(event) => patch({ content: event.target.value })}
          />
        </Field>

        <details className="collapsible">
          <summary>{t('common.advanced')}</summary>
          <div className="collapsible-body stack">
            <Field label={t('lore.secondaryKeys')}>
              <TextInput
                value={entry.secondaryKeys.join(', ')}
                onChange={(event) => patch({ secondaryKeys: splitList(event.target.value) })}
              />
            </Field>
            <div className="grid-2">
              <Field label={t('lore.logic')}>
                <Select value={entry.logic} onChange={(event) => patch({ logic: event.target.value as LoreEntry['logic'] })}>
                  <option value="and_any">{t('lore.logic.and_any')}</option>
                  <option value="and_all">{t('lore.logic.and_all')}</option>
                  <option value="not_any">{t('lore.logic.not_any')}</option>
                  <option value="not_all">{t('lore.logic.not_all')}</option>
                </Select>
              </Field>
              <Field label={t('lore.position')}>
                <Select
                  value={entry.position}
                  onChange={(event) => patch({ position: event.target.value as LoreEntry['position'] })}
                >
                  <option value="before_char">{t('lore.position.before_char')}</option>
                  <option value="after_char">{t('lore.position.after_char')}</option>
                  <option value="at_depth">{t('lore.position.at_depth')}</option>
                  <option value="author_note">{t('lore.position.author_note')}</option>
                </Select>
              </Field>
            </div>
            <div className="grid-2">
              <Slider label={t('lore.order')} min={0} max={1000} step={10} value={entry.order} onChange={(order) => patch({ order })} />
              <Slider
                label={t('lore.probability')}
                min={0}
                max={100}
                value={entry.probability}
                onChange={(probability) => patch({ probability })}
                format={(value) => `${value}%`}
              />
            </div>
            {entry.position === 'at_depth' && (
              <Slider label={t('lore.depth')} min={0} max={20} value={entry.depth} onChange={(depth) => patch({ depth })} />
            )}
            <Switch checked={entry.constant} onChange={(constant) => patch({ constant })} label={t('lore.constant')} />
            <Switch
              checked={entry.caseSensitive}
              onChange={(caseSensitive) => patch({ caseSensitive })}
              label={t('lore.caseSensitive')}
            />
            <Switch
              checked={entry.matchWholeWords}
              onChange={(matchWholeWords) => patch({ matchWholeWords })}
              label={t('lore.wholeWords')}
            />
            <Switch checked={entry.recursive} onChange={(recursive) => patch({ recursive })} label={t('lore.recursive')} />
          </div>
        </details>

        <div className="row">
          <Switch checked={entry.enabled} onChange={(enabled) => patch({ enabled })} label={t('common.enabled')} />
          <span className="spacer" />
          <button type="button" className="btn btn-sm btn-danger" onClick={onDelete}>
            <Trash2 size={15} />
            {t('common.delete')}
          </button>
        </div>
      </div>
    </details>
  );
}

export function LorebookEditor({ id, onClose }: { id: string | 'new'; onClose: () => void }) {
  const t = useT();
  const lorebooks = useLibrary((state) => state.lorebooks);
  const saveLorebook = useLibrary((state) => state.saveLorebook);
  const toast = useUi((state) => state.toast);

  const [draft, setDraft] = useState<Lorebook>(
    () => (id === 'new' ? createLorebook() : lorebooks.find((item) => item.id === id) ?? createLorebook()),
  );
  const [testText, setTestText] = useState('');

  const patch = (value: Partial<Lorebook>) => setDraft((current) => ({ ...current, ...value }));

  const matchedIds = useMemo(() => {
    if (!testText.trim()) return new Set<string>();
    const activated = activateLore([{ ...draft, entries: draft.entries.map((entry) => ({ ...entry, probability: 100 })) }], [], testText);
    return new Set(activated.map((item) => item.entry.id));
  }, [draft, testText]);

  const totalTokens = draft.entries
    .filter((entry) => entry.enabled)
    .reduce((sum, entry) => sum + estimateTokens(entry.content), 0);

  return (
    <Modal
      open
      wide
      title={draft.name || t('lore.new')}
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => {
              downloadFile(JSON.stringify(draft, null, 2), `${draft.name || 'lorebook'}.json`, 'application/json');
              toast(t('toast.exported'), 'success');
            }}
          >
            <Download size={15} />
            <span className="desktop-only">{t('common.export')}</span>
          </button>
          <span className="spacer" />
          <button type="button" className="btn" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              saveLorebook({ ...draft, name: draft.name.trim() || t('common.unnamed') });
              toast(t('toast.saved'), 'success');
              onClose();
            }}
          >
            {t('common.save')}
          </button>
        </>
      }
    >
      <div className="grid-2">
        <Field label={t('common.name')}>
          <TextInput value={draft.name} autoFocus onChange={(event) => patch({ name: event.target.value })} />
        </Field>
        <Field label={t('common.description')}>
          <TextInput value={draft.description} onChange={(event) => patch({ description: event.target.value })} />
        </Field>
      </div>

      <Section title={t('common.advanced')}>
        <div className="grid-2">
          <Slider
            label={t('lore.scanDepth')}
            min={1}
            max={30}
            value={draft.scanDepth}
            onChange={(scanDepth) => patch({ scanDepth })}
            hint={t('lore.scanDepthHint')}
          />
          <Slider
            label={t('lore.tokenBudget')}
            min={128}
            max={8192}
            step={128}
            value={draft.tokenBudget}
            onChange={(tokenBudget) => patch({ tokenBudget })}
          />
        </div>
        <Switch
          checked={draft.recursiveScan}
          onChange={(recursiveScan) => patch({ recursiveScan })}
          label={t('lore.recursiveScan')}
        />
        <Switch checked={draft.global} onChange={(global) => patch({ global })} label={t('lore.global')} />
      </Section>

      <Section
        title={`${t('lore.entries')} · ${draft.entries.length} · ${totalTokens} ${t('common.tokens')}`}
        action={
          <button
            type="button"
            className="btn btn-sm btn-primary"
            onClick={() => patch({ entries: [{ ...emptyEntry(), id: uid() }, ...draft.entries] })}
          >
            <Plus size={15} />
            {t('lore.newEntry')}
          </button>
        }
      >
        <Field label={t('lore.testKeys')} hint={t('lore.testHint')}>
          <TextInput value={testText} onChange={(event) => setTestText(event.target.value)} />
        </Field>
        {testText.trim() && <p className="tiny muted">{t('lore.matched', { count: matchedIds.size })}</p>}

        <div className="stack" style={{ gap: 'var(--space-2)' }}>
          {draft.entries.map((entry) => (
            <EntryCard
              key={entry.id}
              entry={entry}
              matched={matchedIds.has(entry.id)}
              onChange={(next) =>
                patch({ entries: draft.entries.map((item) => (item.id === next.id ? next : item)) })
              }
              onDelete={() => patch({ entries: draft.entries.filter((item) => item.id !== entry.id) })}
            />
          ))}
          {!draft.entries.length && <p className="tiny muted">{t('lore.entryEmpty')}</p>}
        </div>
      </Section>
    </Modal>
  );
}
