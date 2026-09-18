import { useDeferredValue, useMemo } from 'react';
import { create } from 'zustand';
import type { BuiltPrompt } from '@/types';
import { buildPrompt } from './prompt';
import { useChats } from '@/store/chats';
import { useLibrary } from '@/store/library';
import { useSettings } from '@/store/settings';

interface DraftState {
  draft: string;
  setDraft(value: string): void;
}

/** The composer draft lives outside the chat so the panel can price it too. */
export const useDraft = create<DraftState>((set) => ({
  draft: '',
  setDraft: (draft) => set({ draft }),
}));

export function useBuiltPrompt(): BuiltPrompt | null {
  const chat = useChats((state) => state.chat);
  const characters = useLibrary((state) => state.characters);
  const personas = useLibrary((state) => state.personas);
  const lorebooks = useLibrary((state) => state.lorebooks);
  const promptSettings = useSettings((state) => state.prompt);
  const language = useSettings((state) => state.language);
  const regexScripts = useSettings((state) => state.regexScripts);
  const promptBlocks = useSettings((state) => state.promptBlocks);
  const activePersonaId = useSettings((state) => state.activePersonaId);
  const draft = useDraft((state) => state.draft);
  const deferredDraft = useDeferredValue(draft);

  return useMemo(() => {
    if (!chat) return null;
    const character = characters.find((item) => item.id === chat.characterId) ?? null;
    const persona = personas.find((item) => item.id === (chat.personaId ?? activePersonaId)) ?? null;
    return buildPrompt({
      chat,
      character,
      persona,
      lorebooks,
      settings: { prompt: promptSettings, language, regexScripts, promptBlocks },
      pendingUserText: deferredDraft,
    });
  }, [
    chat,
    characters,
    personas,
    lorebooks,
    promptSettings,
    language,
    regexScripts,
    promptBlocks,
    activePersonaId,
    deferredDraft,
  ]);
}
