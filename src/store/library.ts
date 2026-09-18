import { create } from 'zustand';
import type { Character, Lorebook, Persona } from '@/types';
import { db } from '@/lib/db';
import { debounce, uid } from '@/lib/utils';

export function createCharacter(partial: Partial<Character> = {}): Character {
  const now = Date.now();
  return {
    id: uid(),
    name: '',
    description: '',
    personality: '',
    scenario: '',
    firstMes: '',
    mesExample: '',
    creatorNotes: '',
    systemPrompt: '',
    postHistoryInstructions: '',
    alternateGreetings: [],
    tags: [],
    creator: '',
    characterVersion: '1.0',
    favorite: false,
    createdAt: now,
    updatedAt: now,
    ...partial,
  };
}

export function createPersona(partial: Partial<Persona> = {}): Persona {
  const now = Date.now();
  return { id: uid(), name: '', description: '', createdAt: now, updatedAt: now, ...partial };
}

export function createLorebook(partial: Partial<Lorebook> = {}): Lorebook {
  const now = Date.now();
  return {
    id: uid(),
    name: '',
    description: '',
    entries: [],
    scanDepth: 4,
    tokenBudget: 1024,
    recursiveScan: false,
    global: false,
    createdAt: now,
    updatedAt: now,
    ...partial,
  };
}

interface LibraryState {
  characters: Character[];
  personas: Persona[];
  lorebooks: Lorebook[];
  hydrated: boolean;
  hydrate(): Promise<void>;
  saveCharacter(character: Character): void;
  deleteCharacter(id: string): void;
  savePersona(persona: Persona): void;
  deletePersona(id: string): void;
  saveLorebook(lorebook: Lorebook): void;
  deleteLorebook(id: string): void;
  importAll(data: { characters?: Character[]; personas?: Persona[]; lorebooks?: Lorebook[] }): void;
}

export const useLibrary = create<LibraryState>((set, get) => {
  const persistCharacters = debounce(() => void db.saveCharacters(get().characters), 250);
  const persistPersonas = debounce(() => void db.savePersonas(get().personas), 250);
  const persistLorebooks = debounce(() => void db.saveLorebooks(get().lorebooks), 250);

  const upsert = <T extends { id: string; updatedAt: number }>(list: T[], item: T): T[] => {
    const next = { ...item, updatedAt: Date.now() };
    const index = list.findIndex((entry) => entry.id === item.id);
    if (index < 0) return [next, ...list];
    const copy = [...list];
    copy[index] = next;
    return copy;
  };

  return {
    characters: [],
    personas: [],
    lorebooks: [],
    hydrated: false,

    async hydrate() {
      const [characters, personas, lorebooks] = await Promise.all([
        db.loadCharacters(),
        db.loadPersonas(),
        db.loadLorebooks(),
      ]);
      set({ characters, personas, lorebooks, hydrated: true });
    },

    saveCharacter(character) {
      set((state) => ({ characters: upsert(state.characters, character) }));
      persistCharacters();
    },
    deleteCharacter(id) {
      set((state) => ({ characters: state.characters.filter((item) => item.id !== id) }));
      persistCharacters();
    },

    savePersona(persona) {
      set((state) => ({ personas: upsert(state.personas, persona) }));
      persistPersonas();
    },
    deletePersona(id) {
      set((state) => ({ personas: state.personas.filter((item) => item.id !== id) }));
      persistPersonas();
    },

    saveLorebook(lorebook) {
      set((state) => ({ lorebooks: upsert(state.lorebooks, lorebook) }));
      persistLorebooks();
    },
    deleteLorebook(id) {
      set((state) => ({ lorebooks: state.lorebooks.filter((item) => item.id !== id) }));
      persistLorebooks();
    },

    importAll(data) {
      const mergeById = <T extends { id: string }>(current: T[], incoming: T[] = []): T[] => {
        const map = new Map(current.map((item) => [item.id, item]));
        for (const item of incoming) map.set(item.id, item);
        return [...map.values()];
      };
      set((state) => ({
        characters: mergeById(state.characters, data.characters),
        personas: mergeById(state.personas, data.personas),
        lorebooks: mergeById(state.lorebooks, data.lorebooks),
      }));
      persistCharacters();
      persistPersonas();
      persistLorebooks();
    },
  };
});
