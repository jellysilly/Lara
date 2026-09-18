import { useMemo, useState } from 'react';
import { AlertTriangle, ArrowDown, ArrowUp, Copy, Download, Plus, Regex, Replace, Trash2, Upload } from 'lucide-react';
import type { RegexScript, RegexStage, RegexTarget } from '@/types';
import { useT } from '@/lib/useT';
import { downloadFile, pickFile, readAsText, splitList, uid } from '@/lib/utils';
import { applyRegexScripts, createRegexScript, parseRegexFile, regexError } from '@/lib/regex';
import { useSettings } from '@/store/settings';
import { useLibrary } from '@/store/library';
import { useUi } from '@/store/ui';
import { EmptyState, Field, Section, Switch, TextArea, TextInput } from '@/components/ui/Primitives';

const TARGETS: RegexTarget[] = ['user', 'assistant', 'system', 'worldInfo'];
const STAGES: RegexStage[] = ['display', 'prompt', 'store'];

const SAMPLE = `*She tips her head.* "Ninety years the light has burned."

<thinking>The user wants a number.</thinking>`;

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

function ScriptCard({
  script,
  onChange,
  onDelete,
  onDuplicate,
  onMove,
}: {
  script: RegexScript;
  onChange: (script: RegexScript) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onMove: (direction: -1 | 1) => void;
}) {
  const t = useT();
  const characters = useLibrary((state) => state.characters);
  const patch = (value: Partial<RegexScript>) => onChange({ ...script, ...value });
  const invalid = regexError(script.find);

  return (
    <details className="collapsible">
      <summary>
        <Replace size={14} />
        <span className="truncate" style={{ flex: 1, minWidth: 0 }}>
          {script.name || t('regex.untitled')}
        </span>
        {invalid && (
          <span className="chip tiny" style={{ color: 'var(--danger)' }}>
            <AlertTriangle size={10} />
          </span>
        )}
        {!script.enabled && <span className="chip tiny">{t('regex.disabled')}</span>}
      </summary>

      <div className="collapsible-body stack">
        <Field label={t('common.name')}>
          <TextInput value={script.name} onChange={(event) => patch({ name: event.target.value })} />
        </Field>

        <Field label={t('regex.find')} hint={invalid ? t('regex.invalid') : t('regex.findHint')}>
          <TextInput
            value={script.find}
            spellCheck={false}
            placeholder="/<thinking>[\\s\\S]*?<\\/thinking>/g"
            style={{ fontFamily: 'var(--font-mono)', borderColor: invalid ? 'var(--danger)' : undefined }}
            onChange={(event) => patch({ find: event.target.value })}
          />
        </Field>

        <Field label={t('regex.replace')} hint={t('regex.replaceHint')}>
          <TextArea
            value={script.replace}
            spellCheck={false}
            style={{ minHeight: 64, fontFamily: 'var(--font-mono)' }}
            onChange={(event) => patch({ replace: event.target.value })}
          />
        </Field>

        <Field label={t('regex.trim')} hint={t('regex.trimHint')}>
          <TextInput
            value={script.trimStrings.join(', ')}
            onChange={(event) => patch({ trimStrings: splitList(event.target.value) })}
          />
        </Field>

        <Field label={t('regex.targets')}>
          <div className="row-wrap">
            {TARGETS.map((target) => (
              <button
                key={target}
                type="button"
                className={script.targets.includes(target) ? 'chip chip-accent' : 'chip'}
                onClick={() => patch({ targets: toggle(script.targets, target) })}
              >
                {t(`regex.target.${target}` as Parameters<typeof t>[0])}
              </button>
            ))}
          </div>
        </Field>

        <Field label={t('regex.stages')} hint={t('regex.stagesHint')}>
          <div className="row-wrap">
            {STAGES.map((stage) => (
              <button
                key={stage}
                type="button"
                className={script.stages.includes(stage) ? 'chip chip-accent' : 'chip'}
                onClick={() => patch({ stages: toggle(script.stages, stage) })}
              >
                {t(`regex.stage.${stage}` as Parameters<typeof t>[0])}
              </button>
            ))}
          </div>
        </Field>

        <Field label={t('regex.depth')} hint={t('regex.depthHint')}>
          <div className="row">
            <TextInput
              type="number"
              min={0}
              placeholder={t('regex.minDepth')}
              value={script.minDepth ?? ''}
              onChange={(event) => patch({ minDepth: event.target.value === '' ? null : Number(event.target.value) })}
            />
            <TextInput
              type="number"
              min={0}
              placeholder={t('regex.maxDepth')}
              value={script.maxDepth ?? ''}
              onChange={(event) => patch({ maxDepth: event.target.value === '' ? null : Number(event.target.value) })}
            />
          </div>
        </Field>

        {characters.length > 0 && (
          <Field label={t('regex.scope')} hint={script.characterIds.length ? undefined : t('regex.scopeAll')}>
            <div className="row-wrap">
              {characters.map((character) => (
                <button
                  key={character.id}
                  type="button"
                  className={script.characterIds.includes(character.id) ? 'chip chip-accent' : 'chip'}
                  onClick={() => patch({ characterIds: toggle(script.characterIds, character.id) })}
                >
                  {character.name || t('common.unnamed')}
                </button>
              ))}
            </div>
          </Field>
        )}

        <Switch
          checked={script.runOnEdit}
          onChange={(runOnEdit) => patch({ runOnEdit })}
          label={t('regex.runOnEdit')}
        />

        <div className="row">
          <Switch checked={script.enabled} onChange={(enabled) => patch({ enabled })} label={t('common.enabled')} />
          <span className="spacer" />
          <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={() => onMove(-1)} aria-label={t('regex.order')}>
            <ArrowUp size={15} />
          </button>
          <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={() => onMove(1)} aria-label={t('regex.order')}>
            <ArrowDown size={15} />
          </button>
          <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={onDuplicate} aria-label={t('common.duplicate')}>
            <Copy size={15} />
          </button>
          <button type="button" className="btn btn-sm btn-danger" onClick={onDelete} aria-label={t('common.delete')}>
            <Trash2 size={15} />
          </button>
        </div>
      </div>
    </details>
  );
}

export function RegexSettings() {
  const t = useT();
  const scripts = useSettings((state) => state.regexScripts);
  const patch = useSettings((state) => state.patch);
  const upsert = useSettings((state) => state.upsertRegexScript);
  const remove = useSettings((state) => state.removeRegexScript);
  const addMany = useSettings((state) => state.addRegexScripts);
  const toast = useUi((state) => state.toast);
  const askConfirm = useUi((state) => state.askConfirm);

  const [sample, setSample] = useState(SAMPLE);

  const preview = useMemo(
    () =>
      applyRegexScripts(sample, scripts, {
        target: 'assistant',
        stage: 'display',
        depth: 0,
      }),
    [sample, scripts],
  );

  const move = (id: string, direction: -1 | 1) => {
    const index = scripts.findIndex((script) => script.id === id);
    const next = index + direction;
    if (index < 0 || next < 0 || next >= scripts.length) return;
    const reordered = [...scripts];
    [reordered[index], reordered[next]] = [reordered[next], reordered[index]];
    patch({ regexScripts: reordered });
  };

  const importScripts = async () => {
    const file = await pickFile('.json,application/json');
    if (!file) return;
    try {
      const imported = parseRegexFile(await readAsText(file));
      addMany(imported);
      toast(t('regex.imported'), 'success');
    } catch {
      toast(t('toast.error'), 'error');
    }
  };

  return (
    <>
      <Section
        title={t('regex.title')}
        action={
          <div className="row">
            <button type="button" className="btn btn-sm" onClick={() => void importScripts()}>
              <Upload size={15} />
            </button>
            <button
              type="button"
              className="btn btn-sm"
              disabled={!scripts.length}
              onClick={() => {
                downloadFile(JSON.stringify(scripts, null, 2), 'lara-regex.json');
                toast(t('toast.exported'), 'success');
              }}
            >
              <Download size={15} />
            </button>
            <button type="button" className="btn btn-sm btn-primary" onClick={() => upsert(createRegexScript())}>
              <Plus size={15} />
              {t('regex.new')}
            </button>
          </div>
        }
      >
        <p className="tiny muted">{t('regex.subtitle')}</p>

        {scripts.length === 0 ? (
          <EmptyState
            icon={<Regex size={26} />}
            body={t('regex.empty')}
            action={
              <div className="row-wrap" style={{ justifyContent: 'center' }}>
                <button type="button" className="btn btn-sm btn-primary" onClick={() => upsert(createRegexScript())}>
                  <Plus size={15} />
                  {t('regex.new')}
                </button>
                <button type="button" className="btn btn-sm" onClick={() => void importScripts()}>
                  <Upload size={15} />
                  {t('common.import')}
                </button>
              </div>
            }
          />
        ) : (
          <div className="stack" style={{ gap: 'var(--space-2)' }}>
            {scripts.map((script) => (
              <ScriptCard
                key={script.id}
                script={script}
                onChange={upsert}
                onDelete={async () => {
                  if (await askConfirm(t('regex.deleteConfirm'), true)) remove(script.id);
                }}
                onDuplicate={() => upsert({ ...script, id: uid(), name: `${script.name} ✦` })}
                onMove={(direction) => move(script.id, direction)}
              />
            ))}
          </div>
        )}

        <p className="tiny muted">{t('regex.importHint')}</p>
      </Section>

      <Section title={t('regex.tester')}>
        <Field label={t('regex.testerInput')}>
          <TextArea
            value={sample}
            spellCheck={false}
            style={{ minHeight: 110, fontFamily: 'var(--font-mono)', fontSize: '0.84rem' }}
            onChange={(event) => setSample(event.target.value)}
          />
        </Field>
        <Field label={t('regex.testerOutput')}>
          <pre className="regex-output">{preview || '—'}</pre>
        </Field>
      </Section>
    </>
  );
}
