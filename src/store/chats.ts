import { create } from 'zustand';
import type { Chat, ChatSummary, Character, MemoryEntry, Message, Persona, TokenUsage } from '@/types';
import { db, summarize as toSummary } from '@/lib/db';
import { debounce, trimToSentence, uid } from '@/lib/utils';
import { buildPrompt } from '@/lib/prompt';
import { complete, ApiError } from '@/lib/api';
import { calibrate, estimateTokens } from '@/lib/tokenizer';
import { substituteMacros } from '@/lib/macros';
import { activePreset, activeProfile, useSettings } from './settings';
import { useLibrary } from './library';

export function createMessage(partial: Partial<Message> & { role: Message['role']; name: string }): Message {
  const now = Date.now();
  return {
    id: uid(),
    swipes: [''],
    swipeIndex: 0,
    createdAt: now,
    updatedAt: now,
    ...partial,
  };
}

export const messageText = (message: Message): string => message.swipes[message.swipeIndex] ?? '';

interface GenerateOptions {
  impersonate?: boolean;
  continueLast?: boolean;
  /** Write into a new swipe of the last assistant message instead of appending. */
  asSwipe?: boolean;
  pendingUserText?: string;
}

interface ChatState {
  index: ChatSummary[];
  chat: Chat | null;
  hydrated: boolean;
  generating: boolean;
  streamingId: string | null;
  error: string | null;

  hydrate(): Promise<void>;
  createChat(character: Character, personaId?: string): Promise<Chat>;
  openChat(id: string): Promise<void>;
  closeChat(): void;
  deleteChat(id: string): Promise<void>;
  renameChat(id: string, title: string): Promise<void>;
  patchChat(patch: Partial<Chat>): void;

  send(text: string): Promise<void>;
  generate(options?: GenerateOptions): Promise<void>;
  stop(): void;
  swipe(messageId: string, direction: 1 | -1): Promise<void>;
  editMessage(messageId: string, text: string): void;
  deleteMessage(messageId: string): void;
  toggleHidden(messageId: string): void;
  branchFrom(messageId: string): Promise<Chat | null>;

  addMemory(entry?: Partial<MemoryEntry>): void;
  updateMemory(id: string, patch: Partial<MemoryEntry>): void;
  deleteMemory(id: string): void;
  summarizeChat(): Promise<void>;
  summarizing: boolean;

  importChats(chats: Chat[]): Promise<void>;
}

let controller: AbortController | null = null;

export const useChats = create<ChatState>((set, get) => {
  const persistChat = debounce(() => {
    const chat = get().chat;
    if (!chat) return;
    void db.saveChat(chat);

    const summary = toSummary(chat);
    const current = get().index;
    const index = (current.some((item) => item.id === chat.id)
      ? current.map((item) => (item.id === chat.id ? summary : item))
      : [summary, ...current]
    ).sort((a, b) => b.updatedAt - a.updatedAt);

    set({ index });
    void db.saveChatIndex(index);
  }, 400);

  const touch = (chat: Chat): Chat => ({ ...chat, updatedAt: Date.now() });

  const mutate = (updater: (chat: Chat) => Chat) => {
    const current = get().chat;
    if (!current) return;
    set({ chat: touch(updater(current)) });
    persistChat();
  };

  const context = () => {
    const settings = useSettings.getState();
    const library = useLibrary.getState();
    const chat = get().chat;
    const character: Character | null = chat
      ? library.characters.find((item) => item.id === chat.characterId) ?? null
      : null;
    const persona: Persona | null =
      library.personas.find((item) => item.id === (chat?.personaId ?? settings.activePersonaId)) ?? null;
    return { settings, library, chat, character, persona };
  };

  const recordUsage = (usage: TokenUsage) => {
    useSettings.getState().addUsage(usage);
    mutate((chat) => ({
      ...chat,
      usage: { prompt: chat.usage.prompt + usage.prompt, completion: chat.usage.completion + usage.completion },
    }));
  };

  return {
    index: [],
    chat: null,
    hydrated: false,
    generating: false,
    streamingId: null,
    error: null,
    summarizing: false,

    async hydrate() {
      const index = await db.loadChatIndex();
      index.sort((a, b) => b.updatedAt - a.updatedAt);
      set({ index, hydrated: true });
    },

    async createChat(character, personaId) {
      const now = Date.now();
      const settings = useSettings.getState();
      const persona = useLibrary
        .getState()
        .personas.find((item) => item.id === (personaId ?? settings.activePersonaId));

      const greetings = [character.firstMes, ...character.alternateGreetings].filter((item) => item?.trim());
      const messages: Message[] = greetings.length
        ? [
            createMessage({
              role: 'assistant',
              name: character.name,
              avatar: character.avatar,
              swipes: greetings.map((greeting) =>
                substituteMacros(greeting, { character, persona, locale: settings.language }),
              ),
              swipeIndex: 0,
              isGreeting: true,
            }),
          ]
        : [];

      const chat: Chat = {
        id: uid(),
        characterId: character.id,
        personaId: personaId ?? settings.activePersonaId,
        title: character.name || 'New chat',
        messages,
        memory: [],
        authorNote: { content: '', depth: 2, enabled: true },
        lorebookIds: character.lorebookId ? [character.lorebookId] : [],
        usage: { prompt: 0, completion: 0 },
        createdAt: now,
        updatedAt: now,
      };

      await db.saveChat(chat);
      const summary = toSummary(chat);
      const index = [summary, ...get().index].sort((a, b) => b.updatedAt - a.updatedAt);
      await db.saveChatIndex(index);
      set({ chat, index, error: null });
      return chat;
    },

    async openChat(id) {
      if (get().chat?.id === id) return;
      const chat = await db.loadChat(id);
      if (chat) set({ chat, error: null });
    },

    closeChat() {
      set({ chat: null });
    },

    async deleteChat(id) {
      await db.deleteChat(id);
      const index = get().index.filter((item) => item.id !== id);
      await db.saveChatIndex(index);
      set({ index, chat: get().chat?.id === id ? null : get().chat });
    },

    async renameChat(id, title) {
      if (get().chat?.id === id) {
        mutate((chat) => ({ ...chat, title }));
        return;
      }
      const chat = await db.loadChat(id);
      if (!chat) return;
      chat.title = title;
      await db.saveChat(chat);
      const index = get().index.map((item) => (item.id === id ? { ...item, title } : item));
      await db.saveChatIndex(index);
      set({ index });
    },

    patchChat(patch) {
      mutate((chat) => ({ ...chat, ...patch }));
    },

    async send(text) {
      const trimmed = text.trim();
      const { chat, persona, settings } = context();
      if (!chat || !trimmed) return;
      const name = persona?.name || 'You';
      mutate((current) => ({
        ...current,
        messages: [
          ...current.messages,
          createMessage({ role: 'user', name, avatar: persona?.avatar, swipes: [trimmed] }),
        ],
      }));
      await get().generate();

      // Optional rolling summary keeps long stories inside the context window.
      const after = get().chat;
      if (settings.prompt.autoSummary && after) {
        const covered = Math.max(0, ...after.memory.map((entry) => entry.coveredUpTo ?? 0));
        if (after.messages.length - covered >= settings.prompt.autoSummaryInterval) {
          void get().summarizeChat();
        }
      }
    },

    async generate(options = {}) {
      const { chat, character, persona, settings, library } = context();
      if (!chat || get().generating) return;
      const profile = activeProfile(settings);
      if (!profile) {
        set({ error: 'no-api' });
        return;
      }
      const preset = activePreset(settings);

      const built = buildPrompt({
        chat,
        character,
        persona,
        lorebooks: library.lorebooks,
        settings,
        impersonate: options.impersonate,
        continueLast: options.continueLast,
        pendingUserText: options.pendingUserText,
      });

      controller = new AbortController();
      set({ generating: true, error: null });

      // Decide where the streamed text lands.
      let targetId: string | null = null;
      let baseText = '';

      if (options.impersonate) {
        targetId = null;
      } else if (options.continueLast) {
        const last = chat.messages[chat.messages.length - 1];
        if (last?.role === 'assistant') {
          targetId = last.id;
          baseText = messageText(last);
        }
      } else if (options.asSwipe) {
        const last = chat.messages[chat.messages.length - 1];
        if (last?.role === 'assistant') {
          targetId = last.id;
          mutate((current) => ({
            ...current,
            messages: current.messages.map((message) =>
              message.id === last.id
                ? { ...message, swipes: [...message.swipes, ''], swipeIndex: message.swipes.length }
                : message,
            ),
          }));
        }
      }

      if (!targetId && !options.impersonate) {
        const message = createMessage({
          role: 'assistant',
          name: character?.name ?? 'Narrator',
          avatar: character?.avatar,
          swipes: [''],
        });
        targetId = message.id;
        mutate((current) => ({ ...current, messages: [...current.messages, message] }));
      }

      set({ streamingId: targetId });

      const writeChunk = (text: string) => {
        if (!targetId) {
          set({ error: null });
          return;
        }
        mutate((current) => ({
          ...current,
          messages: current.messages.map((message) =>
            message.id === targetId
              ? {
                  ...message,
                  swipes: message.swipes.map((swipe, index) => (index === message.swipeIndex ? text : swipe)),
                  updatedAt: Date.now(),
                }
              : message,
          ),
        }));
      };

      let streamed = baseText;
      try {
        const result = await complete({
          profile,
          preset,
          messages: built.messages,
          signal: controller.signal,
          onDelta: (delta) => {
            streamed += delta;
            if (options.impersonate) {
              impersonateListeners.forEach((listener) => listener(streamed));
            } else {
              writeChunk(streamed);
            }
          },
        });

        const finalText = (result.text ? baseText + result.text : streamed).trim();
        const cleaned = settings.prompt.trimSentences && finalText ? trimToSentence(finalText) : finalText;

        if (options.impersonate) {
          impersonateListeners.forEach((listener) => listener(cleaned));
        } else {
          writeChunk(cleaned || streamed);
        }

        const estimatedPrompt = built.total;
        const usage: TokenUsage = result.usage ?? {
          prompt: estimatedPrompt,
          completion: estimateTokens(cleaned),
        };
        if (result.usage?.prompt) calibrate(estimatedPrompt, result.usage.prompt);
        recordUsage(usage);

        if (targetId) {
          mutate((current) => ({
            ...current,
            messages: current.messages.map((message) =>
              message.id === targetId ? { ...message, usage } : message,
            ),
          }));
        }
      } catch (error) {
        const aborted = error instanceof DOMException && error.name === 'AbortError';
        if (!aborted) {
          set({ error: error instanceof ApiError ? error.message : String(error) });
        }
        // Drop an assistant placeholder that never received a single token.
        if (targetId && !streamed.trim()) {
          mutate((current) => {
            const message = current.messages.find((item) => item.id === targetId);
            if (!message) return current;
            if (message.swipes.length > 1) {
              return {
                ...current,
                messages: current.messages.map((item) =>
                  item.id === targetId
                    ? {
                        ...item,
                        swipes: item.swipes.slice(0, -1),
                        swipeIndex: Math.max(0, item.swipes.length - 2),
                      }
                    : item,
                ),
              };
            }
            return { ...current, messages: current.messages.filter((item) => item.id !== targetId) };
          });
        }
      } finally {
        controller = null;
        set({ generating: false, streamingId: null });
        persistChat();
      }
    },

    stop() {
      controller?.abort();
      controller = null;
      set({ generating: false, streamingId: null });
    },

    async swipe(messageId, direction) {
      const chat = get().chat;
      if (!chat) return;
      const message = chat.messages.find((item) => item.id === messageId);
      if (!message) return;
      const next = message.swipeIndex + direction;

      if (next >= message.swipes.length) {
        const isLast = chat.messages[chat.messages.length - 1]?.id === messageId;
        if (!isLast || message.isGreeting) return;
        await get().generate({ asSwipe: true });
        return;
      }
      if (next < 0) return;
      mutate((current) => ({
        ...current,
        messages: current.messages.map((item) => (item.id === messageId ? { ...item, swipeIndex: next } : item)),
      }));
    },

    editMessage(messageId, text) {
      mutate((chat) => ({
        ...chat,
        messages: chat.messages.map((message) =>
          message.id === messageId
            ? {
                ...message,
                swipes: message.swipes.map((swipe, index) => (index === message.swipeIndex ? text : swipe)),
                updatedAt: Date.now(),
              }
            : message,
        ),
      }));
    },

    deleteMessage(messageId) {
      mutate((chat) => ({ ...chat, messages: chat.messages.filter((message) => message.id !== messageId) }));
    },

    toggleHidden(messageId) {
      mutate((chat) => ({
        ...chat,
        messages: chat.messages.map((message) =>
          message.id === messageId ? { ...message, hidden: !message.hidden } : message,
        ),
      }));
    },

    async branchFrom(messageId) {
      const chat = get().chat;
      if (!chat) return null;
      const index = chat.messages.findIndex((message) => message.id === messageId);
      if (index < 0) return null;
      const now = Date.now();
      const branch: Chat = {
        ...structuredClone(chat),
        id: uid(),
        title: `${chat.title} ⑂`,
        messages: chat.messages.slice(0, index + 1).map((message) => ({ ...message, id: uid() })),
        createdAt: now,
        updatedAt: now,
        branchedFrom: { chatId: chat.id, messageIndex: index },
      };
      await db.saveChat(branch);
      const summary = toSummary(branch);
      const nextIndex = [summary, ...get().index].sort((a, b) => b.updatedAt - a.updatedAt);
      await db.saveChatIndex(nextIndex);
      set({ chat: branch, index: nextIndex });
      return branch;
    },

    addMemory(entry) {
      const now = Date.now();
      const memory: MemoryEntry = {
        id: uid(),
        title: '',
        content: '',
        pinned: false,
        enabled: true,
        source: 'manual',
        createdAt: now,
        updatedAt: now,
        ...entry,
      };
      mutate((chat) => ({ ...chat, memory: [memory, ...chat.memory] }));
    },

    updateMemory(id, patch) {
      mutate((chat) => ({
        ...chat,
        memory: chat.memory.map((entry) => (entry.id === id ? { ...entry, ...patch, updatedAt: Date.now() } : entry)),
      }));
    },

    deleteMemory(id) {
      mutate((chat) => ({ ...chat, memory: chat.memory.filter((entry) => entry.id !== id) }));
    },

    async summarizeChat() {
      const { chat, character, persona, settings, library } = context();
      if (!chat || get().summarizing) return;
      const profile = activeProfile(settings);
      if (!profile) {
        set({ error: 'no-api' });
        return;
      }
      set({ summarizing: true });
      try {
        const covered = Math.max(0, ...chat.memory.map((entry) => entry.coveredUpTo ?? 0));
        const slice = chat.messages.slice(Math.max(0, covered - 2));
        const transcript = slice
          .filter((message) => messageText(message).trim())
          .map((message) => `${message.name}: ${messageText(message)}`)
          .join('\n\n')
          .slice(-16000);
        if (!transcript.trim()) return;

        const previous = chat.memory
          .filter((entry) => entry.enabled)
          .map((entry) => entry.content)
          .join('\n')
          .slice(0, 4000);

        const built = buildPrompt({ chat, character, persona, lorebooks: library.lorebooks, settings });
        void built;

        const result = await complete({
          profile,
          preset: { ...activePreset(settings), temperature: 0.4, maxTokens: 400 },
          forceNonStreaming: true,
          messages: [
            { role: 'system', content: substituteMacros(settings.prompt.summaryPrompt, { character, persona }) },
            {
              role: 'user',
              content: `${previous ? `Existing notes:\n${previous}\n\n` : ''}New transcript:\n${transcript}`,
            },
          ],
        });

        const text = result.text.trim();
        if (!text) return;
        recordUsage(result.usage ?? { prompt: estimateTokens(transcript), completion: estimateTokens(text) });

        const now = Date.now();
        mutate((current) => ({
          ...current,
          memory: [
            {
              id: uid(),
              title: `Summary · ${new Date(now).toLocaleDateString()}`,
              content: text,
              pinned: false,
              enabled: true,
              source: 'auto' as const,
              createdAt: now,
              updatedAt: now,
              coveredUpTo: current.messages.length,
            },
            ...current.memory,
          ],
        }));
      } catch (error) {
        set({ error: error instanceof Error ? error.message : String(error) });
      } finally {
        set({ summarizing: false });
      }
    },

    async importChats(chats) {
      for (const chat of chats) await db.saveChat(chat);
      const map = new Map(get().index.map((item) => [item.id, item]));
      for (const chat of chats) map.set(chat.id, toSummary(chat));
      const index = [...map.values()].sort((a, b) => b.updatedAt - a.updatedAt);
      await db.saveChatIndex(index);
      set({ index });
    },
  };
});

// Impersonation streams into the composer rather than into the transcript.
const impersonateListeners = new Set<(text: string) => void>();

export function onImpersonate(listener: (text: string) => void): () => void {
  impersonateListeners.add(listener);
  return () => impersonateListeners.delete(listener);
}
