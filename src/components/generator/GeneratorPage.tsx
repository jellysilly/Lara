import { useMemo, useState } from 'react';
import { BookOpen, Check, Globe, Link2, Pencil, Sparkles, Square, Trash2, UserRound, Wand2 } from 'lucide-react';
import type { Language } from '@/types';
import {
  CHARACTER_FIELDS,
  buildGeneratorMessages,
  parseGeneratorOutput,
  asString,
  asStringArray,
  type CharacterField,
  type GenRequest,
  type GenTarget,
} from '@/lib/generator';
import { fetchSource } from '@/lib/wiki';
import { complete, ApiError } from '@/lib/api';
import { estimateMessageTokens, estimateTokens } from '@/lib/tokenizer';
import { emptyEntry } from '@/lib/lorebook';
import { uid } from '@/lib/utils';
import { useT } from '@/lib/useT';
import { createCharacter, createLorebook, createPersona, useLibrary } from '@/store/library';
import { activePreset, activeProfile, useSettings } from '@/store/settings';
import { useUi } from '@/store/ui';
import { TopBar } from '@/components/layout/TopBar';
import { Field, Section, Segmented, Select, Slider, Switch, TextArea, TextInput } from '@/components/ui/Primitives';

const FIELD_LABELS: Record<CharacterField, string> = {
  description: 'character.description',
  personality: 'character.personality',
  scenario: 'character.scenario',
  firstMes: 'character.firstMes',
  mesExample: 'character.mesExample',
  alternateGreetings: 'character.altGreetings',
  systemPrompt: 'character.systemPrompt',
  tags: 'common.tags',
};

type Draft = Record<string, unknown>;

export function GeneratorPage() {
  const t = useT();
  const settings = useSettings();
  const generatorDefaults = settings.generator;
  const patchGenerator = useSettings((state) => state.patchGenerator);
  const addUsage = useSettings((state) => state.addUsage);
  const { saveCharacter, savePersona, saveLorebook } = useLibrary.getState();
  const toast = useUi((state) => state.toast);
  const go = useUi((state) => state.go);
  const editCharacter = useUi((state) => state.editCharacter);

  const [target, setTarget] = useState<GenTarget>('character');
  const [sourceMode, setSourceMode] = useState<'brief' | 'wiki'>('brief');
  const [brief, setBrief] = useState('');
  const [url, setUrl] = useState('');
  const [sourceText, setSourceText] = useState('');
  const [sourceTitle, setSourceTitle] = useState('');
  const [fields, setFields] = useState<CharacterField[]>([
    'description',
    'personality',
    'scenario',
    'firstMes',
    'mesExample',
    'tags',
  ]);
  const [extra, setExtra] = useState('');
  const [fetching, setFetching] = useState(false);
  const [running, setRunning] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [controller, setController] = useState<AbortController | null>(null);

  const profile = activeProfile(settings);

  const request: GenRequest = useMemo(
    () => ({
      target,
      brief,
      sourceText,
      sourceTitle,
      fields,
      tone: generatorDefaults.tone,
      length: generatorDefaults.length,
      language: generatorDefaults.language,
      mature: generatorDefaults.allowMature,
      extra,
      entryCount: generatorDefaults.entryCount,
    }),
    [target, brief, sourceText, sourceTitle, fields, generatorDefaults, extra],
  );

  const estimate = useMemo(() => estimateMessageTokens(buildGeneratorMessages(request)), [request]);

  const loadSource = async () => {
    if (!url.trim()) return;
    setFetching(true);
    try {
      const source = await fetchSource(url, settings.corsProxy);
      setSourceText(source.text);
      setSourceTitle(source.title);
      toast(t('gen.fetched', { n: source.text.length, title: source.title }), 'success');
    } catch {
      toast(t('gen.fetchFailed'), 'error');
    } finally {
      setFetching(false);
    }
  };

  const run = async (onlyField?: string) => {
    if (!profile) {
      toast(t('gen.noApi'), 'error');
      go('settings');
      return;
    }
    const abort = new AbortController();
    setController(abort);
    setRunning(true);
    try {
      const messages = buildGeneratorMessages({ ...request, onlyField, existing: draft ?? undefined });
      const result = await complete({
        profile,
        preset: { ...activePreset(settings), maxTokens: target === 'lorebook' ? 3000 : 2000, streaming: false },
        forceNonStreaming: true,
        messages,
        signal: abort.signal,
      });
      addUsage(result.usage ?? { prompt: estimate, completion: estimateTokens(result.text) });

      if (!result.text.trim()) {
        toast(t('gen.emptyResult'), 'error');
        return;
      }
      const parsed = parseGeneratorOutput(result.text);
      setDraft((current) => (onlyField && current ? { ...current, ...parsed } : parsed));
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      const message = error instanceof ApiError ? error.message : t('gen.parseFailed');
      toast(message, 'error');
    } finally {
      setRunning(false);
      setController(null);
    }
  };

  const save = () => {
    if (!draft) return;
    if (target === 'character') {
      const character = createCharacter({
        name: asString(draft.name) || t('common.unnamed'),
        description: asString(draft.description),
        personality: asString(draft.personality),
        scenario: asString(draft.scenario),
        firstMes: asString(draft.first_mes),
        mesExample: asString(draft.mes_example),
        systemPrompt: asString(draft.system_prompt),
        alternateGreetings: asStringArray(draft.alternate_greetings),
        tags: asStringArray(draft.tags),
        creator: 'Lara generator',
      });
      saveCharacter(character);
      toast(t('gen.saved'), 'success');
      setDraft(null);
      editCharacter(character.id);
      go('characters');
      return;
    }

    if (target === 'persona') {
      savePersona(
        createPersona({ name: asString(draft.name) || t('common.unnamed'), description: asString(draft.description) }),
      );
      toast(t('gen.saved'), 'success');
      setDraft(null);
      go('personas');
      return;
    }

    const rawEntries = Array.isArray(draft.entries) ? (draft.entries as Record<string, unknown>[]) : [];
    saveLorebook(
      createLorebook({
        name: asString(draft.name) || t('common.unnamed'),
        description: asString(draft.description),
        entries: rawEntries.map((entry) => ({
          ...emptyEntry(),
          id: uid(),
          keys: asStringArray(entry.keys),
          content: asString(entry.content),
          comment: asString(entry.comment),
          constant: Boolean(entry.constant),
        })),
      }),
    );
    toast(t('gen.saved'), 'success');
    setDraft(null);
    go('lorebooks');
  };

  const targetLabel =
    target === 'character' ? t('gen.target.character') : target === 'persona' ? t('gen.target.persona') : t('gen.target.lorebook');

  return (
    <>
      <TopBar title={t('gen.title')} subtitle={t('gen.estimate', { n: estimate })} />

      <div className="scroll-area">
        <div className="page">
          <div className="page-head">
            <div className="stack" style={{ gap: 4 }}>
              <h2>{t('gen.title')}</h2>
              <p>{t('gen.subtitle')}</p>
            </div>
          </div>

          <Section title={t('gen.target')}>
            <Segmented
              value={target}
              onChange={setTarget}
              options={[
                { value: 'character', label: t('gen.target.character'), icon: <UserRound size={14} /> },
                { value: 'persona', label: t('gen.target.persona'), icon: <Pencil size={14} /> },
                { value: 'lorebook', label: t('gen.target.lorebook'), icon: <BookOpen size={14} /> },
              ]}
            />

            <Segmented
              label={t('gen.source')}
              value={sourceMode}
              onChange={setSourceMode}
              options={[
                { value: 'brief', label: t('gen.source.brief'), icon: <Sparkles size={14} /> },
                { value: 'wiki', label: t('gen.source.wiki'), icon: <Globe size={14} /> },
              ]}
            />

            {sourceMode === 'brief' ? (
              <Field label={t('gen.brief')}>
                <TextArea
                  value={brief}
                  placeholder={t('gen.briefPlaceholder')}
                  style={{ minHeight: 130 }}
                  onChange={(event) => setBrief(event.target.value)}
                />
              </Field>
            ) : (
              <>
                <Field label={t('gen.url')}>
                  <div className="row">
                    <TextInput
                      value={url}
                      placeholder={t('gen.urlPlaceholder')}
                      inputMode="url"
                      onChange={(event) => setUrl(event.target.value)}
                      onKeyDown={(event) => event.key === 'Enter' && void loadSource()}
                    />
                    <button type="button" className="btn" disabled={fetching || !url.trim()} onClick={() => void loadSource()}>
                      <Link2 size={15} />
                      {fetching ? t('gen.fetching') : t('gen.fetch')}
                    </button>
                  </div>
                </Field>

                {sourceText && (
                  <Field
                    label={`${t('gen.sourceText')} · ${sourceText.length}`}
                    hint={t('gen.sourceTextHint')}
                    action={
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => {
                          setSourceText('');
                          setSourceTitle('');
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    }
                  >
                    <TextArea
                      value={sourceText}
                      style={{ minHeight: 160, fontSize: '0.84rem' }}
                      onChange={(event) => setSourceText(event.target.value)}
                    />
                  </Field>
                )}

                <Field label={t('gen.extra')}>
                  <TextArea
                    value={brief}
                    placeholder={t('gen.briefPlaceholder')}
                    style={{ minHeight: 78 }}
                    onChange={(event) => setBrief(event.target.value)}
                  />
                </Field>
              </>
            )}
          </Section>

          <Section title={t('common.advanced')}>
            {target === 'character' && (
              <Field label={t('gen.fields')}>
                <div className="row-wrap">
                  {CHARACTER_FIELDS.map((field) => {
                    const on = fields.includes(field);
                    return (
                      <button
                        key={field}
                        type="button"
                        className={on ? 'chip chip-accent' : 'chip'}
                        onClick={() =>
                          setFields(on ? fields.filter((item) => item !== field) : [...fields, field])
                        }
                      >
                        {on && <Check size={11} />}
                        {t(FIELD_LABELS[field] as Parameters<typeof t>[0])}
                      </button>
                    );
                  })}
                </div>
              </Field>
            )}

            {target === 'lorebook' && (
              <Slider
                label={t('gen.entryCount')}
                min={3}
                max={30}
                value={generatorDefaults.entryCount}
                onChange={(entryCount) => patchGenerator({ entryCount })}
              />
            )}

            <div className="grid-2">
              <Field label={t('gen.tone')}>
                <TextInput
                  value={generatorDefaults.tone}
                  placeholder={t('gen.tonePlaceholder')}
                  onChange={(event) => patchGenerator({ tone: event.target.value })}
                />
              </Field>
              <Field label={t('gen.outputLanguage')}>
                <Select
                  value={generatorDefaults.language}
                  onChange={(event) => patchGenerator({ language: event.target.value as Language | 'match' })}
                >
                  <option value="match">{t('gen.matchSource')}</option>
                  <option value="en">English</option>
                  <option value="ru">Русский</option>
                </Select>
              </Field>
            </div>

            <Segmented
              label={t('gen.length')}
              value={generatorDefaults.length}
              onChange={(length) => patchGenerator({ length })}
              options={[
                { value: 'short', label: t('gen.length.short') },
                { value: 'medium', label: t('gen.length.medium') },
                { value: 'long', label: t('gen.length.long') },
              ]}
            />

            <Field label={t('gen.extra')}>
              <TextArea value={extra} style={{ minHeight: 70 }} onChange={(event) => setExtra(event.target.value)} />
            </Field>

            <Switch
              checked={generatorDefaults.allowMature}
              onChange={(allowMature) => patchGenerator({ allowMature })}
              label={t('gen.mature')}
            />
          </Section>

          <div className="row-wrap">
            {running ? (
              <button type="button" className="btn btn-danger" onClick={() => controller?.abort()}>
                <Square size={15} />
                {t('common.stop')}
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-primary"
                disabled={!brief.trim() && !sourceText.trim()}
                onClick={() => void run()}
              >
                <Wand2 size={16} />
                {t('gen.run')}
              </button>
            )}
            {running && <span className="row small muted"><span className="spinner" />{t('gen.running')}</span>}
            <span className="spacer" />
            <span className="tiny muted">{t('gen.estimate', { n: estimate })}</span>
          </div>

          {draft && (
            <Section
              title={`${t('gen.result')} · ${targetLabel}`}
              action={
                <div className="row">
                  <button type="button" className="btn btn-sm btn-ghost" onClick={() => setDraft(null)}>
                    {t('gen.discard')}
                  </button>
                  <button type="button" className="btn btn-sm btn-primary" onClick={save}>
                    <Check size={15} />
                    {t('gen.saveAs', { target: targetLabel })}
                  </button>
                </div>
              }
            >
              <DraftPreview draft={draft} target={target} onChange={setDraft} onRewrite={(field) => void run(field)} busy={running} />
            </Section>
          )}
        </div>
      </div>
    </>
  );
}

function DraftPreview({
  draft,
  target,
  onChange,
  onRewrite,
  busy,
}: {
  draft: Draft;
  target: GenTarget;
  onChange: (draft: Draft) => void;
  onRewrite: (field: string) => void;
  busy: boolean;
}) {
  const t = useT();

  if (target === 'lorebook') {
    const entries = Array.isArray(draft.entries) ? (draft.entries as Record<string, unknown>[]) : [];
    return (
      <>
        <Field label={t('common.name')}>
          <TextInput value={asString(draft.name)} onChange={(event) => onChange({ ...draft, name: event.target.value })} />
        </Field>
        <p className="tiny muted">{t('lore.entriesCount', { count: entries.length })}</p>
        <div className="stack" style={{ gap: 'var(--space-2)' }}>
          {entries.map((entry, index) => (
            <details className="collapsible" key={index}>
              <summary>
                <span className="truncate">{asString(entry.comment) || asStringArray(entry.keys)[0] || `#${index + 1}`}</span>
                <span className="chip tiny">{asStringArray(entry.keys).length}</span>
              </summary>
              <div className="collapsible-body stack">
                <Field label={t('lore.keys')}>
                  <TextInput
                    value={asStringArray(entry.keys).join(', ')}
                    onChange={(event) => {
                      const next = [...entries];
                      next[index] = { ...entry, keys: event.target.value.split(',').map((item) => item.trim()) };
                      onChange({ ...draft, entries: next });
                    }}
                  />
                </Field>
                <Field label={t('common.content')}>
                  <TextArea
                    value={asString(entry.content)}
                    onChange={(event) => {
                      const next = [...entries];
                      next[index] = { ...entry, content: event.target.value };
                      onChange({ ...draft, entries: next });
                    }}
                  />
                </Field>
              </div>
            </details>
          ))}
        </div>
      </>
    );
  }

  const keys =
    target === 'persona'
      ? (['name', 'description'] as const)
      : (['name', 'description', 'personality', 'scenario', 'first_mes', 'mes_example', 'system_prompt'] as const);

  return (
    <>
      {keys.map((key) => {
        const value = asString(draft[key]);
        if (key !== 'name' && !value) return null;
        return (
          <Field
            key={key}
            label={key}
            action={
              key !== 'name' && (
                <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => onRewrite(key)}>
                  <Wand2 size={13} />
                  {t('gen.regenerateField')}
                </button>
              )
            }
          >
            {key === 'name' ? (
              <TextInput value={value} onChange={(event) => onChange({ ...draft, [key]: event.target.value })} />
            ) : (
              <TextArea
                value={value}
                style={{ minHeight: 120 }}
                onChange={(event) => onChange({ ...draft, [key]: event.target.value })}
              />
            )}
          </Field>
        );
      })}

      {asStringArray(draft.tags).length > 0 && (
        <div className="row-wrap">
          {asStringArray(draft.tags).map((tag) => (
            <span className="chip" key={tag}>
              {tag}
            </span>
          ))}
        </div>
      )}

      {asStringArray(draft.alternate_greetings).length > 0 && (
        <Field label={t('character.altGreetings')}>
          <div className="stack" style={{ gap: 'var(--space-2)' }}>
            {asStringArray(draft.alternate_greetings).map((greeting, index) => (
              <TextArea
                key={index}
                value={greeting}
                style={{ minHeight: 80 }}
                onChange={(event) => {
                  const next = [...asStringArray(draft.alternate_greetings)];
                  next[index] = event.target.value;
                  onChange({ ...draft, alternate_greetings: next });
                }}
              />
            ))}
          </div>
        </Field>
      )}
    </>
  );
}
