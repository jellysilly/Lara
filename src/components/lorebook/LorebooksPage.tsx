import { BookOpen, Globe, Pencil, Plus, Trash2, Upload } from 'lucide-react';
import type { Lorebook } from '@/types';
import { useT } from '@/lib/useT';
import { pickFile, readAsText, uid } from '@/lib/utils';
import { emptyEntry } from '@/lib/lorebook';
import { createLorebook, useLibrary } from '@/store/library';
import { useUi } from '@/store/ui';
import { TopBar } from '@/components/layout/TopBar';
import { EmptyState } from '@/components/ui/Primitives';
import { LorebookEditor } from './LorebookEditor';

/** Accepts our own export as well as SillyTavern world-info JSON. */
function parseLorebookFile(raw: string, fallbackName: string): Lorebook {
  const data = JSON.parse(raw);
  if (Array.isArray(data.entries) && data.entries[0]?.keys) {
    return { ...createLorebook(), ...data, id: uid(), name: data.name || fallbackName };
  }

  const source = data.entries ?? data;
  const entries = Object.values(source as Record<string, Record<string, unknown>>).map((entry) => ({
    ...emptyEntry(),
    id: uid(),
    keys: (entry.key as string[]) ?? (entry.keys as string[]) ?? [],
    secondaryKeys: (entry.keysecondary as string[]) ?? (entry.secondary_keys as string[]) ?? [],
    content: String(entry.content ?? ''),
    comment: String(entry.comment ?? ''),
    enabled: entry.disable === true ? false : (entry.enabled as boolean) ?? true,
    constant: Boolean(entry.constant),
    caseSensitive: Boolean(entry.caseSensitive ?? entry.case_sensitive),
    order: Number(entry.order ?? entry.insertion_order ?? 100),
    probability: Number(entry.probability ?? 100),
  }));

  return { ...createLorebook(), name: data.name || fallbackName, entries };
}

export function LorebooksPage() {
  const t = useT();
  const lorebooks = useLibrary((state) => state.lorebooks);
  const saveLorebook = useLibrary((state) => state.saveLorebook);
  const deleteLorebook = useLibrary((state) => state.deleteLorebook);
  const editingId = useUi((state) => state.editingLorebookId);
  const editLorebook = useUi((state) => state.editLorebook);
  const askConfirm = useUi((state) => state.askConfirm);
  const toast = useUi((state) => state.toast);

  const importBook = async () => {
    const file = await pickFile('.json,application/json');
    if (!file) return;
    try {
      saveLorebook(parseLorebookFile(await readAsText(file), file.name.replace(/\.json$/i, '')));
      toast(t('toast.imported'), 'success');
    } catch {
      toast(t('toast.error'), 'error');
    }
  };

  return (
    <>
      <TopBar title={t('lore.title')} subtitle={`${lorebooks.length}`}>
        <button type="button" className="btn btn-sm" onClick={importBook}>
          <Upload size={15} />
          <span className="desktop-only">{t('common.import')}</span>
        </button>
        <button type="button" className="btn btn-sm btn-primary" onClick={() => editLorebook('new')}>
          <Plus size={15} />
          <span className="desktop-only">{t('lore.new')}</span>
        </button>
      </TopBar>

      <div className="scroll-area">
        <div className="page">
          {lorebooks.length === 0 ? (
            <EmptyState
              icon={<BookOpen size={28} />}
              body={t('lore.empty')}
              action={
                <button type="button" className="btn btn-primary btn-sm" onClick={() => editLorebook('new')}>
                  <Plus size={15} />
                  {t('lore.new')}
                </button>
              }
            />
          ) : (
            <div className="card-grid">
              {lorebooks.map((book) => (
                <article className="char-card" key={book.id}>
                  <button type="button" className="char-card-main" onClick={() => editLorebook(book.id)}>
                    <span className="lore-mark">
                      <BookOpen size={20} />
                    </span>
                    <span className="char-card-body">
                      <span className="list-card-title truncate">{book.name || t('common.unnamed')}</span>
                      <span className="list-card-sub truncate">{book.description || '—'}</span>
                      <span className="row-wrap" style={{ gap: 4, marginTop: 4 }}>
                        <span className="chip tiny">{t('lore.entriesCount', { count: book.entries.length })}</span>
                        {book.global && (
                          <span className="chip tiny chip-accent">
                            <Globe size={11} />
                            {t('lore.global')}
                          </span>
                        )}
                      </span>
                    </span>
                  </button>
                  <div className="char-card-tools">
                    <button type="button" className="msg-tool" onClick={() => editLorebook(book.id)} aria-label={t('common.edit')}>
                      <Pencil size={15} />
                    </button>
                    <button
                      type="button"
                      className="msg-tool"
                      data-danger="true"
                      aria-label={t('common.delete')}
                      onClick={async () => {
                        if (await askConfirm(t('lore.deleteConfirm'), true)) deleteLorebook(book.id);
                      }}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>

      {editingId && <LorebookEditor id={editingId} onClose={() => editLorebook(null)} />}
    </>
  );
}
