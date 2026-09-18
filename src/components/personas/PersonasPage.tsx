import { useState } from 'react';
import { Check, ImagePlus, Pencil, Plus, Trash2, VenetianMask } from 'lucide-react';
import type { Persona } from '@/types';
import { useT } from '@/lib/useT';
import { pickFile, resizeImage } from '@/lib/utils';
import { createPersona, useLibrary } from '@/store/library';
import { useSettings } from '@/store/settings';
import { useUi } from '@/store/ui';
import { TopBar } from '@/components/layout/TopBar';
import { Avatar } from '@/components/ui/Avatar';
import { Modal } from '@/components/ui/Modal';
import { EmptyState, Field, TextArea, TextInput } from '@/components/ui/Primitives';

function PersonaEditor({ id, onClose }: { id: string | 'new'; onClose: () => void }) {
  const t = useT();
  const personas = useLibrary((state) => state.personas);
  const savePersona = useLibrary((state) => state.savePersona);
  const [draft, setDraft] = useState<Persona>(
    () => (id === 'new' ? createPersona() : personas.find((item) => item.id === id) ?? createPersona()),
  );

  const patch = (value: Partial<Persona>) => setDraft((current) => ({ ...current, ...value }));

  return (
    <Modal
      open
      title={id === 'new' ? t('persona.new') : t('persona.edit')}
      onClose={onClose}
      footer={
        <>
          <span className="spacer" />
          <button type="button" className="btn" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              savePersona({ ...draft, name: draft.name.trim() || t('common.unnamed') });
              onClose();
            }}
          >
            {t('common.save')}
          </button>
        </>
      }
    >
      <div className="row" style={{ gap: 'var(--space-4)' }}>
        <button
          type="button"
          style={{ position: 'relative' }}
          onClick={async () => {
            const file = await pickFile('image/*');
            if (file) patch({ avatar: await resizeImage(file) });
          }}
        >
          <Avatar name={draft.name || '?'} src={draft.avatar} size={72} />
          <span className="avatar-edit">
            <ImagePlus size={14} />
          </span>
        </button>
        <Field label={t('common.name')}>
          <TextInput value={draft.name} autoFocus onChange={(event) => patch({ name: event.target.value })} />
        </Field>
      </div>

      <Field label={t('persona.description')} hint={t('settings.prompt.macrosHint')}>
        <TextArea
          value={draft.description}
          style={{ minHeight: 170 }}
          onChange={(event) => patch({ description: event.target.value })}
        />
      </Field>
    </Modal>
  );
}

export function PersonasPage() {
  const t = useT();
  const personas = useLibrary((state) => state.personas);
  const deletePersona = useLibrary((state) => state.deletePersona);
  const activePersonaId = useSettings((state) => state.activePersonaId);
  const patch = useSettings((state) => state.patch);
  const editingId = useUi((state) => state.editingPersonaId);
  const editPersona = useUi((state) => state.editPersona);
  const askConfirm = useUi((state) => state.askConfirm);

  return (
    <>
      <TopBar title={t('persona.title')} subtitle={`${personas.length}`}>
        <button type="button" className="btn btn-sm btn-primary" onClick={() => editPersona('new')}>
          <Plus size={15} />
          <span className="desktop-only">{t('persona.new')}</span>
        </button>
      </TopBar>

      <div className="scroll-area">
        <div className="page">
          {personas.length === 0 ? (
            <EmptyState
              icon={<VenetianMask size={28} />}
              body={t('persona.empty')}
              action={
                <button type="button" className="btn btn-primary btn-sm" onClick={() => editPersona('new')}>
                  <Plus size={15} />
                  {t('persona.new')}
                </button>
              }
            />
          ) : (
            <div className="card-grid">
              {personas.map((persona) => {
                const active = persona.id === activePersonaId;
                return (
                  <article className="char-card" key={persona.id}>
                    <button
                      type="button"
                      className="char-card-main"
                      onClick={() => patch({ activePersonaId: active ? undefined : persona.id })}
                    >
                      <Avatar name={persona.name} src={persona.avatar} size={56} />
                      <span className="char-card-body">
                        <span className="list-card-title truncate">{persona.name || t('common.unnamed')}</span>
                        <span className="list-card-sub">{persona.description || '—'}</span>
                        {active && (
                          <span className="chip tiny chip-accent" style={{ marginTop: 6, alignSelf: 'flex-start' }}>
                            <Check size={11} />
                            {t('persona.active')}
                          </span>
                        )}
                      </span>
                    </button>
                    <div className="char-card-tools">
                      <button
                        type="button"
                        className="msg-tool"
                        onClick={() => editPersona(persona.id)}
                        aria-label={t('common.edit')}
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        type="button"
                        className="msg-tool"
                        data-danger="true"
                        aria-label={t('common.delete')}
                        onClick={async () => {
                          if (await askConfirm(t('persona.deleteConfirm'), true)) deletePersona(persona.id);
                        }}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {editingId && <PersonaEditor id={editingId} onClose={() => editPersona(null)} />}
    </>
  );
}
