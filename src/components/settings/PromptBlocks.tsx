import { ArrowDown, ArrowUp, Copy, FileText, Plus, Trash2 } from 'lucide-react';
import type { MessageRole, PromptBlock, PromptBlockPosition } from '@/types';
import { useT } from '@/lib/useT';
import { uid } from '@/lib/utils';
import { estimateTokens } from '@/lib/tokenizer';
import { useSettings } from '@/store/settings';
import { useLibrary } from '@/store/library';
import { useUi } from '@/store/ui';
import { EmptyState, Field, Section, Select, Slider, TextArea, TextInput, ToggleButton } from '@/components/ui/Primitives';

const POSITIONS: PromptBlockPosition[] = [
  'system',
  'after_character',
  'before_history',
  'after_history',
  'at_depth',
];
const ROLES: MessageRole[] = ['system', 'user', 'assistant'];

/** The folded positions become part of the system message, so a role is moot. */
const emitsOwnMessage = (position: PromptBlockPosition) =>
  position !== 'system' && position !== 'after_character';

export function createPromptBlock(partial: Partial<PromptBlock> = {}): PromptBlock {
  return {
    id: uid(),
    name: '',
    content: '',
    enabled: true,
    position: 'system',
    role: 'system',
    depth: 2,
    characterIds: [],
    ...partial,
  };
}

function BlockCard({
  block,
  onChange,
  onDelete,
  onDuplicate,
  onMove,
}: {
  block: PromptBlock;
  onChange: (block: PromptBlock) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onMove: (direction: -1 | 1) => void;
}) {
  const t = useT();
  const characters = useLibrary((state) => state.characters);
  const patch = (value: Partial<PromptBlock>) => onChange({ ...block, ...value });

  return (
    <details className="collapsible" data-off={block.enabled ? undefined : 'true'}>
      <summary>
        <ToggleButton
          checked={block.enabled}
          onChange={(enabled) => patch({ enabled })}
          label={t('blocks.toggle')}
        />
        <span className="truncate" style={{ flex: 1, minWidth: 0 }}>
          {block.name || t('blocks.untitled')}
        </span>
        <span className="chip tiny">{t(`blocks.position.${block.position}` as Parameters<typeof t>[0])}</span>
        <span className="chip tiny">{estimateTokens(block.content)}</span>
      </summary>

      <div className="collapsible-body stack">
        <Field label={t('common.name')}>
          <TextInput value={block.name} onChange={(event) => patch({ name: event.target.value })} />
        </Field>

        <Field label={t('common.content')} hint={t('settings.prompt.macrosHint')}>
          <TextArea
            value={block.content}
            style={{ minHeight: 130 }}
            onChange={(event) => patch({ content: event.target.value })}
          />
        </Field>

        <Field label={t('blocks.position')} hint={t('blocks.positionHint')}>
          <Select
            value={block.position}
            onChange={(event) => patch({ position: event.target.value as PromptBlockPosition })}
          >
            {POSITIONS.map((position) => (
              <option key={position} value={position}>
                {t(`blocks.position.${position}` as Parameters<typeof t>[0])}
              </option>
            ))}
          </Select>
        </Field>

        {emitsOwnMessage(block.position) && (
          <Field label={t('blocks.role')}>
            <Select value={block.role} onChange={(event) => patch({ role: event.target.value as MessageRole })}>
              {ROLES.map((role) => (
                <option key={role} value={role}>
                  {t(`blocks.role.${role}` as Parameters<typeof t>[0])}
                </option>
              ))}
            </Select>
          </Field>
        )}

        {block.position === 'at_depth' && (
          <Slider label={t('blocks.depth')} min={0} max={20} value={block.depth} onChange={(depth) => patch({ depth })} />
        )}

        {characters.length > 0 && (
          <Field label={t('blocks.scope')} hint={block.characterIds.length ? undefined : t('blocks.scopeAll')}>
            <div className="row-wrap">
              {characters.map((character) => {
                const on = block.characterIds.includes(character.id);
                return (
                  <button
                    key={character.id}
                    type="button"
                    className={on ? 'chip chip-accent' : 'chip'}
                    onClick={() =>
                      patch({
                        characterIds: on
                          ? block.characterIds.filter((id) => id !== character.id)
                          : [...block.characterIds, character.id],
                      })
                    }
                  >
                    {character.name || t('common.unnamed')}
                  </button>
                );
              })}
            </div>
          </Field>
        )}

        <div className="row">
          <span className="tiny muted">{block.enabled ? t('blocks.on') : t('blocks.off')}</span>
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

export function PromptBlocks() {
  const t = useT();
  const blocks = useSettings((state) => state.promptBlocks);
  const upsert = useSettings((state) => state.upsertPromptBlock);
  const remove = useSettings((state) => state.removePromptBlock);
  const patch = useSettings((state) => state.patch);
  const askConfirm = useUi((state) => state.askConfirm);

  const move = (id: string, direction: -1 | 1) => {
    const index = blocks.findIndex((block) => block.id === id);
    const next = index + direction;
    if (index < 0 || next < 0 || next >= blocks.length) return;
    const reordered = [...blocks];
    [reordered[index], reordered[next]] = [reordered[next], reordered[index]];
    patch({ promptBlocks: reordered });
  };

  return (
    <Section
      title={t('blocks.title')}
      action={
        <button type="button" className="btn btn-sm btn-primary" onClick={() => upsert(createPromptBlock())}>
          <Plus size={15} />
          {t('blocks.new')}
        </button>
      }
    >
      <p className="tiny muted">{t('blocks.subtitle')}</p>

      {blocks.length === 0 ? (
        <EmptyState
          icon={<FileText size={26} />}
          body={t('blocks.empty')}
          action={
            <button type="button" className="btn btn-sm btn-primary" onClick={() => upsert(createPromptBlock())}>
              <Plus size={15} />
              {t('blocks.new')}
            </button>
          }
        />
      ) : (
        <div className="stack" style={{ gap: 'var(--space-2)' }}>
          {blocks.map((block) => (
            <BlockCard
              key={block.id}
              block={block}
              onChange={upsert}
              onDelete={async () => {
                if (await askConfirm(t('blocks.deleteConfirm'), true)) remove(block.id);
              }}
              onDuplicate={() => upsert({ ...block, id: uid(), name: `${block.name} ✦` })}
              onMove={(direction) => move(block.id, direction)}
            />
          ))}
        </div>
      )}
    </Section>
  );
}
