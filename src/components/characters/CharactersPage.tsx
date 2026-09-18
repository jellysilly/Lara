import { useMemo, useState } from 'react';
import { Heart, MessageSquarePlus, Pencil, Plus, Search, Trash2, Upload, UserRound } from 'lucide-react';
import { useT } from '@/lib/useT';
import { pickFile } from '@/lib/utils';
import { readCardFile } from '@/lib/characterCard';
import { useLibrary } from '@/store/library';
import { useChats } from '@/store/chats';
import { useUi } from '@/store/ui';
import { TopBar } from '@/components/layout/TopBar';
import { Avatar } from '@/components/ui/Avatar';
import { EmptyState, TextInput } from '@/components/ui/Primitives';
import { CharacterEditor } from './CharacterEditor';

export function CharactersPage() {
  const t = useT();
  const characters = useLibrary((state) => state.characters);
  const saveCharacter = useLibrary((state) => state.saveCharacter);
  const saveLorebook = useLibrary((state) => state.saveLorebook);
  const deleteCharacter = useLibrary((state) => state.deleteCharacter);
  const chatIndex = useChats((state) => state.index);
  const createChat = useChats((state) => state.createChat);
  const editingId = useUi((state) => state.editingCharacterId);
  const editCharacter = useUi((state) => state.editCharacter);
  const askConfirm = useUi((state) => state.askConfirm);
  const toast = useUi((state) => state.toast);
  const go = useUi((state) => state.go);

  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const list = needle
      ? characters.filter(
          (character) =>
            character.name.toLowerCase().includes(needle) ||
            character.tags.some((tag) => tag.toLowerCase().includes(needle)),
        )
      : characters;
    return [...list].sort((a, b) => Number(b.favorite) - Number(a.favorite) || b.updatedAt - a.updatedAt);
  }, [characters, query]);

  const chatCount = (id: string) => chatIndex.filter((item) => item.characterId === id).length;

  const importCard = async () => {
    const file = await pickFile('.png,.json,image/png,application/json');
    if (!file) return;
    try {
      const { character, lorebook } = await readCardFile(file);
      if (lorebook) saveLorebook(lorebook);
      saveCharacter(character);
      toast(t('character.imported'), 'success');
    } catch (error) {
      toast(error instanceof Error ? error.message : t('character.importFailed'), 'error');
    }
  };

  const startChat = async (id: string) => {
    const character = characters.find((item) => item.id === id);
    if (!character) return;
    await createChat(character);
    go('chat');
  };

  return (
    <>
      <TopBar title={t('character.title')} subtitle={`${characters.length}`}>
        <button type="button" className="btn btn-sm" onClick={importCard}>
          <Upload size={15} />
          <span className="desktop-only">{t('common.import')}</span>
        </button>
        <button type="button" className="btn btn-sm btn-primary" onClick={() => editCharacter('new')}>
          <Plus size={15} />
          <span className="desktop-only">{t('character.new')}</span>
        </button>
      </TopBar>

      <div className="scroll-area">
        <div className="page">
          <div className="search-box">
            <Search size={16} className="muted" />
            <TextInput
              value={query}
              placeholder={t('character.searchPlaceholder')}
              onChange={(event) => setQuery(event.target.value)}
              style={{ border: 'none', background: 'none', padding: 0 }}
            />
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              icon={<UserRound size={28} />}
              body={t('character.empty')}
              action={
                <div className="row-wrap" style={{ justifyContent: 'center' }}>
                  <button type="button" className="btn btn-primary btn-sm" onClick={() => editCharacter('new')}>
                    <Plus size={15} />
                    {t('character.new')}
                  </button>
                  <button type="button" className="btn btn-sm" onClick={importCard}>
                    <Upload size={15} />
                    {t('character.importCard')}
                  </button>
                </div>
              }
            />
          ) : (
            <div className="card-grid">
              {filtered.map((character) => (
                <article className="char-card" key={character.id}>
                  <button
                    type="button"
                    className="char-card-main"
                    onClick={() => void startChat(character.id)}
                    title={t('character.startChat')}
                  >
                    <Avatar name={character.name} src={character.avatar} size={64} />
                    <span className="char-card-body">
                      <span className="list-card-title truncate">{character.name || t('common.unnamed')}</span>
                      <span className="list-card-sub truncate">
                        {character.creatorNotes || character.description || '—'}
                      </span>
                      <span className="row-wrap" style={{ gap: 4, marginTop: 4 }}>
                        {character.tags.slice(0, 3).map((tag) => (
                          <span className="chip tiny" key={tag}>
                            {tag}
                          </span>
                        ))}
                        {chatCount(character.id) > 0 && (
                          <span className="chip tiny chip-accent">
                            {t('character.chatsCount', { count: chatCount(character.id) })}
                          </span>
                        )}
                      </span>
                    </span>
                  </button>

                  <div className="char-card-tools">
                    <button
                      type="button"
                      className="msg-tool"
                      onClick={() => saveCharacter({ ...character, favorite: !character.favorite })}
                      aria-label={t('character.favorite')}
                    >
                      <Heart size={15} fill={character.favorite ? 'currentColor' : 'none'} />
                    </button>
                    <button
                      type="button"
                      className="msg-tool"
                      onClick={() => void startChat(character.id)}
                      aria-label={t('character.startChat')}
                    >
                      <MessageSquarePlus size={15} />
                    </button>
                    <button
                      type="button"
                      className="msg-tool"
                      onClick={() => editCharacter(character.id)}
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
                        if (await askConfirm(t('character.deleteConfirm'), true)) deleteCharacter(character.id);
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

      {editingId && <CharacterEditor id={editingId} onClose={() => editCharacter(null)} />}
    </>
  );
}
