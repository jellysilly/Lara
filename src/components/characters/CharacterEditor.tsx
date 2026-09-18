import { useEffect, useState } from 'react';
import { Download, FileJson, ImagePlus } from 'lucide-react';
import type { Character } from '@/types';
import { useT } from '@/lib/useT';
import { downloadFile, pickFile, resizeImage, splitList } from '@/lib/utils';
import { characterToCard, writeCardPng } from '@/lib/characterCard';
import { useLibrary, createCharacter } from '@/store/library';
import { useUi } from '@/store/ui';
import { Modal } from '@/components/ui/Modal';
import { Avatar } from '@/components/ui/Avatar';
import { Field, Select, TextArea, TextInput } from '@/components/ui/Primitives';
import { OpeningMessages } from './OpeningMessages';

export function CharacterEditor({ id, onClose }: { id: string | 'new'; onClose: () => void }) {
  const t = useT();
  const characters = useLibrary((state) => state.characters);
  const lorebooks = useLibrary((state) => state.lorebooks);
  const saveCharacter = useLibrary((state) => state.saveCharacter);
  const toast = useUi((state) => state.toast);

  const [draft, setDraft] = useState<Character>(() =>
    id === 'new' ? createCharacter() : characters.find((item) => item.id === id) ?? createCharacter(),
  );
  const [tab, setTab] = useState<'core' | 'greetings' | 'prompts' | 'meta'>('core');

  useEffect(() => {
    if (id === 'new') return;
    const found = characters.find((item) => item.id === id);
    if (found) setDraft(found);
    // Only re-seed when switching cards, not on every library write.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const patch = (value: Partial<Character>) => setDraft((current) => ({ ...current, ...value }));

  const save = () => {
    saveCharacter({ ...draft, name: draft.name.trim() || t('common.unnamed') });
    toast(t('toast.saved'), 'success');
    onClose();
  };

  const uploadAvatar = async () => {
    const file = await pickFile('image/*');
    if (!file) return;
    patch({ avatar: await resizeImage(file) });
  };

  const exportPng = async () => {
    try {
      const lorebook = lorebooks.find((book) => book.id === draft.lorebookId);
      const blob = await writeCardPng(draft, lorebook);
      downloadFile(blob, `${draft.name || 'character'}.png`, 'image/png');
      toast(t('toast.exported'), 'success');
    } catch (error) {
      toast(error instanceof Error ? error.message : t('toast.error'), 'error');
    }
  };

  const exportJson = () => {
    const lorebook = lorebooks.find((book) => book.id === draft.lorebookId);
    downloadFile(
      JSON.stringify(characterToCard(draft, lorebook), null, 2),
      `${draft.name || 'character'}.json`,
      'application/json',
    );
    toast(t('toast.exported'), 'success');
  };

  return (
    <Modal
      open
      wide
      title={id === 'new' ? t('character.new') : t('character.edit')}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-sm" onClick={exportPng}>
            <Download size={15} />
            <span className="desktop-only">{t('character.exportPng')}</span>
          </button>
          <button type="button" className="btn btn-sm" onClick={exportJson}>
            <FileJson size={15} />
            <span className="desktop-only">{t('character.exportJson')}</span>
          </button>
          <span className="spacer" />
          <button type="button" className="btn" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="button" className="btn btn-primary" onClick={save}>
            {t('common.save')}
          </button>
        </>
      }
    >
      <div className="row" style={{ gap: 'var(--space-4)' }}>
        <button type="button" onClick={uploadAvatar} title={t('common.avatar')} style={{ position: 'relative' }}>
          <Avatar name={draft.name || '?'} src={draft.avatar} size={84} />
          <span className="avatar-edit">
            <ImagePlus size={15} />
          </span>
        </button>
        <div className="stack" style={{ flex: 1, gap: 'var(--space-2)' }}>
          <Field label={t('character.name')}>
            <TextInput value={draft.name} onChange={(event) => patch({ name: event.target.value })} autoFocus />
          </Field>
          <Field label={t('common.tags')}>
            <TextInput
              value={draft.tags.join(', ')}
              placeholder="fantasy, mentor, slow burn"
              onChange={(event) => patch({ tags: splitList(event.target.value) })}
            />
          </Field>
        </div>
      </div>

      <div className="tabs" role="tablist">
        {(['core', 'greetings', 'prompts', 'meta'] as const).map((key) => (
          <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => setTab(key)}>
            {key === 'core' && t('character.description')}
            {key === 'greetings' && t('greetings.title')}
            {key === 'prompts' && t('settings.tab.prompts')}
            {key === 'meta' && t('common.advanced')}
          </button>
        ))}
      </div>

      {tab === 'core' && (
        <>
          <Field label={t('character.description')}>
            <TextArea
              value={draft.description}
              style={{ minHeight: 170 }}
              onChange={(event) => patch({ description: event.target.value })}
            />
          </Field>
          <Field label={t('character.personality')}>
            <TextArea value={draft.personality} onChange={(event) => patch({ personality: event.target.value })} />
          </Field>
          <Field label={t('character.scenario')}>
            <TextArea value={draft.scenario} onChange={(event) => patch({ scenario: event.target.value })} />
          </Field>
        </>
      )}

      {tab === 'greetings' && (
        <>
          <OpeningMessages
            openings={[draft.firstMes, ...draft.alternateGreetings]}
            onChange={(openings) =>
              patch({ firstMes: openings[0] ?? '', alternateGreetings: openings.slice(1) })
            }
          />

          <Field label={t('character.mesExample')} hint="<START>\n{{user}}: …\n{{char}}: …">
            <TextArea value={draft.mesExample} onChange={(event) => patch({ mesExample: event.target.value })} />
          </Field>
        </>
      )}

      {tab === 'prompts' && (
        <>
          <Field label={t('character.systemPrompt')} hint={t('settings.prompt.macrosHint')}>
            <TextArea value={draft.systemPrompt} onChange={(event) => patch({ systemPrompt: event.target.value })} />
          </Field>
          <Field label={t('character.postHistory')} hint={t('settings.prompt.postHistoryHint')}>
            <TextArea
              value={draft.postHistoryInstructions}
              onChange={(event) => patch({ postHistoryInstructions: event.target.value })}
            />
          </Field>
        </>
      )}

      {tab === 'meta' && (
        <>
          <Field label={t('character.lorebook')}>
            <Select
              value={draft.lorebookId ?? ''}
              onChange={(event) => patch({ lorebookId: event.target.value || undefined })}
            >
              <option value="">{t('common.none')}</option>
              {lorebooks.map((book) => (
                <option key={book.id} value={book.id}>
                  {book.name || t('common.unnamed')}
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid-2">
            <Field label={t('character.creator')}>
              <TextInput value={draft.creator} onChange={(event) => patch({ creator: event.target.value })} />
            </Field>
            <Field label={t('character.version')}>
              <TextInput
                value={draft.characterVersion}
                onChange={(event) => patch({ characterVersion: event.target.value })}
              />
            </Field>
          </div>
          <Field label={t('character.creatorNotes')}>
            <TextArea value={draft.creatorNotes} onChange={(event) => patch({ creatorNotes: event.target.value })} />
          </Field>
        </>
      )}
    </Modal>
  );
}
