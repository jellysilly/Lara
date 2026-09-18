import { create } from 'zustand';
import type { ApiProfile, GenerationPreset, Settings, TokenUsage } from '@/types';
import { db } from '@/lib/db';
import { uid, debounce } from '@/lib/utils';
import {
  DEFAULT_IMPERSONATE_PROMPT,
  DEFAULT_POST_HISTORY,
  DEFAULT_SUMMARY_PROMPT,
  DEFAULT_SYSTEM_PROMPT,
} from '@/lib/prompt';

export function createPreset(name = 'Balanced'): GenerationPreset {
  return {
    id: uid(),
    name,
    temperature: 0.9,
    topP: 0.95,
    topK: 0,
    maxTokens: 512,
    presencePenalty: 0,
    frequencyPenalty: 0,
    stop: [],
    streaming: true,
  };
}

export function createProfile(name = 'My connection'): ApiProfile {
  return {
    id: uid(),
    name,
    provider: 'openai',
    baseUrl: import.meta.env.VITE_DEFAULT_API_URL ?? '',
    apiKey: '',
    model: '',
    contextSize: 8192,
    extraHeaders: {},
  };
}

const defaultPreset = createPreset();

export const defaultSettings: Settings = {
  language: 'en',
  appearance: {
    theme: 'lagoon',
    mode: 'auto',
    chatStyle: 'bubble',
    avatarMode: 'messenger',
    avatarSize: 44,
    avatarShape: 'circle',
    fontSize: 16,
    chatWidth: 760,
    messageGap: 14,
    animations: true,
    waves: true,
    blur: true,
    serifBody: false,
  },
  prompt: {
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
    postHistoryInstructions: DEFAULT_POST_HISTORY,
    impersonatePrompt: DEFAULT_IMPERSONATE_PROMPT,
    summaryPrompt: DEFAULT_SUMMARY_PROMPT,
    responseTokens: 512,
    contextSize: 8192,
    memoryBudget: 0.12,
    includeExampleDialogue: true,
    trimSentences: true,
    autoSummary: false,
    autoSummaryInterval: 20,
    useCharacterSystemPrompt: true,
  },
  generator: {
    language: 'match',
    length: 'medium',
    tone: '',
    allowMature: false,
    entryCount: 8,
  },
  apiProfiles: [],
  activeApiProfileId: undefined,
  presets: [defaultPreset],
  activePresetId: defaultPreset.id,
  activePersonaId: undefined,
  corsProxy: import.meta.env.VITE_CORS_PROXY ?? '',
  totalUsage: { prompt: 0, completion: 0 },
  tokenAllowance: 0,
  onboarded: false,
};

interface SettingsState extends Settings {
  hydrated: boolean;
  sessionUsage: TokenUsage;
  hydrate(): Promise<void>;
  patch(patch: Partial<Settings>): void;
  patchAppearance(patch: Partial<Settings['appearance']>): void;
  patchPrompt(patch: Partial<Settings['prompt']>): void;
  patchGenerator(patch: Partial<Settings['generator']>): void;
  upsertProfile(profile: ApiProfile): void;
  removeProfile(id: string): void;
  upsertPreset(preset: GenerationPreset): void;
  removePreset(id: string): void;
  addUsage(usage: TokenUsage): void;
  resetUsage(): void;
  replaceAll(settings: Settings): void;
}

function merge(base: Settings, stored: Partial<Settings>): Settings {
  return {
    ...base,
    ...stored,
    appearance: { ...base.appearance, ...stored.appearance },
    prompt: { ...base.prompt, ...stored.prompt },
    generator: { ...base.generator, ...stored.generator },
    totalUsage: { ...base.totalUsage, ...stored.totalUsage },
    presets: stored.presets?.length ? stored.presets : base.presets,
    apiProfiles: stored.apiProfiles ?? base.apiProfiles,
  };
}

export const useSettings = create<SettingsState>((set, get) => {
  const persist = debounce(() => {
    const { hydrated: _hydrated, sessionUsage: _sessionUsage, ...rest } = get();
    const snapshot = Object.fromEntries(
      Object.entries(rest).filter(([, value]) => typeof value !== 'function'),
    ) as unknown as Settings;
    void db.saveSettings(snapshot);
  }, 300);

  const update = (updater: (state: SettingsState) => Partial<SettingsState>) => {
    set(updater as never);
    persist();
  };

  return {
    ...defaultSettings,
    hydrated: false,
    sessionUsage: { prompt: 0, completion: 0 },

    async hydrate() {
      const stored = await db.loadSettings();
      set({ ...(stored ? merge(defaultSettings, stored) : defaultSettings), hydrated: true });
    },

    patch(patch) {
      update(() => patch as Partial<SettingsState>);
    },
    patchAppearance(patch) {
      update((state) => ({ appearance: { ...state.appearance, ...patch } }));
    },
    patchPrompt(patch) {
      update((state) => ({ prompt: { ...state.prompt, ...patch } }));
    },
    patchGenerator(patch) {
      update((state) => ({ generator: { ...state.generator, ...patch } }));
    },

    upsertProfile(profile) {
      update((state) => {
        const exists = state.apiProfiles.some((item) => item.id === profile.id);
        return {
          apiProfiles: exists
            ? state.apiProfiles.map((item) => (item.id === profile.id ? profile : item))
            : [...state.apiProfiles, profile],
          activeApiProfileId: state.activeApiProfileId ?? profile.id,
        };
      });
    },
    removeProfile(id) {
      update((state) => {
        const apiProfiles = state.apiProfiles.filter((item) => item.id !== id);
        return {
          apiProfiles,
          activeApiProfileId: state.activeApiProfileId === id ? apiProfiles[0]?.id : state.activeApiProfileId,
        };
      });
    },

    upsertPreset(preset) {
      update((state) => {
        const exists = state.presets.some((item) => item.id === preset.id);
        return {
          presets: exists ? state.presets.map((item) => (item.id === preset.id ? preset : item)) : [...state.presets, preset],
          activePresetId: state.activePresetId ?? preset.id,
        };
      });
    },
    removePreset(id) {
      update((state) => {
        if (state.presets.length <= 1) return {};
        const presets = state.presets.filter((item) => item.id !== id);
        return { presets, activePresetId: state.activePresetId === id ? presets[0]?.id : state.activePresetId };
      });
    },

    addUsage(usage) {
      update((state) => ({
        totalUsage: {
          prompt: state.totalUsage.prompt + usage.prompt,
          completion: state.totalUsage.completion + usage.completion,
        },
        sessionUsage: {
          prompt: state.sessionUsage.prompt + usage.prompt,
          completion: state.sessionUsage.completion + usage.completion,
        },
      }));
    },
    resetUsage() {
      update(() => ({ totalUsage: { prompt: 0, completion: 0 }, sessionUsage: { prompt: 0, completion: 0 } }));
    },

    replaceAll(settings) {
      update(() => merge(defaultSettings, settings) as Partial<SettingsState>);
    },
  };
});

export function activeProfile(state: Pick<Settings, 'apiProfiles' | 'activeApiProfileId'>): ApiProfile | null {
  return state.apiProfiles.find((profile) => profile.id === state.activeApiProfileId) ?? state.apiProfiles[0] ?? null;
}

export function activePreset(state: Pick<Settings, 'presets' | 'activePresetId'>): GenerationPreset {
  return state.presets.find((preset) => preset.id === state.activePresetId) ?? state.presets[0] ?? defaultPreset;
}
