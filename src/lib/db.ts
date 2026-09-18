import { createStore, get, set, del, keys, clear } from 'idb-keyval';
import type { Chat, ChatSummary, Character, Lorebook, Persona, Settings } from '@/types';
import { truncate } from './utils';

const store = createStore('lara-db', 'lara');

const CHARACTERS = 'characters';
const PERSONAS = 'personas';
const LOREBOOKS = 'lorebooks';
const CHAT_INDEX = 'chat-index';
const SETTINGS = 'settings';
const chatKey = (id: string) => `chat:${id}`;

async function read<T>(key: string, fallback: T): Promise<T> {
  try {
    return (await get<T>(key, store)) ?? fallback;
  } catch {
    return fallback;
  }
}

export const db = {
  async loadCharacters(): Promise<Character[]> {
    return read<Character[]>(CHARACTERS, []);
  },
  async saveCharacters(items: Character[]): Promise<void> {
    await set(CHARACTERS, items, store);
  },

  async loadPersonas(): Promise<Persona[]> {
    return read<Persona[]>(PERSONAS, []);
  },
  async savePersonas(items: Persona[]): Promise<void> {
    await set(PERSONAS, items, store);
  },

  async loadLorebooks(): Promise<Lorebook[]> {
    return read<Lorebook[]>(LOREBOOKS, []);
  },
  async saveLorebooks(items: Lorebook[]): Promise<void> {
    await set(LOREBOOKS, items, store);
  },

  async loadChatIndex(): Promise<ChatSummary[]> {
    return read<ChatSummary[]>(CHAT_INDEX, []);
  },
  async saveChatIndex(items: ChatSummary[]): Promise<void> {
    await set(CHAT_INDEX, items, store);
  },

  async loadChat(id: string): Promise<Chat | undefined> {
    return get<Chat>(chatKey(id), store);
  },
  async saveChat(chat: Chat): Promise<void> {
    await set(chatKey(chat.id), chat, store);
  },
  async deleteChat(id: string): Promise<void> {
    await del(chatKey(id), store);
  },
  async loadAllChats(): Promise<Chat[]> {
    const allKeys = await keys(store);
    const chatKeys = allKeys.filter((key): key is string => typeof key === 'string' && key.startsWith('chat:'));
    const chats = await Promise.all(chatKeys.map((key) => get<Chat>(key, store)));
    return chats.filter((chat): chat is Chat => Boolean(chat));
  },

  async loadSettings(): Promise<Partial<Settings> | undefined> {
    return get<Partial<Settings>>(SETTINGS, store);
  },
  async saveSettings(settings: Settings): Promise<void> {
    await set(SETTINGS, settings, store);
  },

  async clearAll(): Promise<void> {
    await clear(store);
  },

  async estimateSize(): Promise<number> {
    if (navigator.storage?.estimate) {
      const estimate = await navigator.storage.estimate();
      return estimate.usage ?? 0;
    }
    return 0;
  },
};

export function summarize(chat: Chat): ChatSummary {
  const last = [...chat.messages].reverse().find((message) => message.swipes[message.swipeIndex]?.trim());
  return {
    id: chat.id,
    characterId: chat.characterId,
    title: chat.title,
    messageCount: chat.messages.length,
    lastMessage: truncate(last?.swipes[last.swipeIndex] ?? '', 120),
    updatedAt: chat.updatedAt,
    createdAt: chat.createdAt,
  };
}
