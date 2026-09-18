import type { GenerationPreset, MessageRole, PromptBlock, PromptBlockPosition, PromptSettings } from '@/types';
import { uid } from './utils';

export type PresetKind = 'chat' | 'text' | 'lara';

export class PresetFormatError extends Error {
  constructor(readonly code: 'instruct' | 'context' | 'unreadable') {
    super(code);
    this.name = 'PresetFormatError';
  }
}

export interface ImportedPreset {
  preset: GenerationPreset;
  /** Prompt fields the file carried, if any — applying them is the caller's call. */
  prompt: Partial<PromptSettings>;
  /** The preset's own prompt blocks, as toggles. */
  blocks: PromptBlock[];
  model?: string;
  kind: PresetKind;
  /** Sampler names the file sets that Lara has no equivalent for. */
  unsupported: string[];
}

type Raw = Record<string, unknown>;

const number = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;
const text = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() ? value : undefined;
const list = (value: unknown): string[] | undefined =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : undefined;

function basePreset(name: string): GenerationPreset {
  return {
    id: uid(),
    name,
    temperature: 0.9,
    topP: 1,
    topK: 0,
    maxTokens: 512,
    presencePenalty: 0,
    frequencyPenalty: 0,
    stop: [],
    streaming: true,
  };
}

/**
 * Samplers SillyTavern backends expose that a chat-completion frontend cannot
 * pass on. Reported rather than silently dropped.
 */
const UNSUPPORTED_SAMPLERS: Record<string, string> = {
  min_p: 'min_p',
  top_a: 'top_a',
  typical_p: 'typical_p',
  typical: 'typical_p',
  tfs: 'tail-free sampling',
  rep_pen: 'repetition penalty',
  repetition_penalty: 'repetition penalty',
  rep_pen_range: 'repetition penalty range',
  rep_pen_slope: 'repetition penalty slope',
  no_repeat_ngram_size: 'no-repeat n-gram',
  mirostat_mode: 'mirostat',
  smoothing_factor: 'smoothing',
  dry_multiplier: 'DRY',
  xtc_threshold: 'XTC',
  encoder_rep_pen: 'encoder repetition penalty',
  guidance_scale: 'CFG scale',
  epsilon_cutoff: 'epsilon cutoff',
  eta_cutoff: 'eta cutoff',
  banned_tokens: 'banned tokens',
  logit_bias: 'logit bias',
};

/** A sampler counts as "set" only when it is off its neutral default. */
const NEUTRAL: Record<string, number> = {
  min_p: 0,
  top_a: 0,
  typical_p: 1,
  typical: 1,
  tfs: 1,
  rep_pen: 1,
  repetition_penalty: 1,
  rep_pen_slope: 0,
  no_repeat_ngram_size: 0,
  mirostat_mode: 0,
  smoothing_factor: 0,
  dry_multiplier: 0,
  xtc_threshold: 0,
  encoder_rep_pen: 1,
  guidance_scale: 1,
  epsilon_cutoff: 0,
  eta_cutoff: 0,
};

function collectUnsupported(raw: Raw): string[] {
  const found = new Set<string>();
  for (const [key, label] of Object.entries(UNSUPPORTED_SAMPLERS)) {
    const value = raw[key];
    if (value === undefined || value === null) continue;
    if (typeof value === 'number') {
      if (NEUTRAL[key] !== undefined && value === NEUTRAL[key]) continue;
      if (NEUTRAL[key] === undefined && value === 0) continue;
    } else if (typeof value === 'string' && !value.trim()) {
      continue;
    } else if (Array.isArray(value) && !value.length) {
      continue;
    } else if (typeof value === 'object' && !Object.keys(value as object).length) {
      continue;
    }
    found.add(label);
  }
  return [...found];
}

// ---------------------------------------------------------------------------
// Chat completion presets (SillyTavern "Chat Completion" / openai_settings)
// ---------------------------------------------------------------------------

interface StPrompt {
  identifier?: string;
  name?: string;
  content?: string;
  role?: string;
  /** Placeholders SillyTavern fills in itself — Lara assembles those already. */
  marker?: boolean;
  system_prompt?: boolean;
  injection_position?: number;
  injection_depth?: number;
}

/** Markers that mean everything after them sits past the character block. */
const CHARACTER_MARKERS = new Set([
  'charDescription',
  'charPersonality',
  'scenario',
  'personaDescription',
  'dialogueExamples',
]);

interface StPromptOrder {
  character_id?: number;
  order?: { identifier?: string; enabled?: boolean }[];
}

function readChatPreset(raw: Raw, name: string): ImportedPreset {
  const preset = basePreset(text(raw.name) ?? name);
  preset.temperature = number(raw.temperature) ?? preset.temperature;
  preset.topP = number(raw.top_p) ?? preset.topP;
  preset.topK = number(raw.top_k) ?? preset.topK;
  preset.maxTokens = number(raw.openai_max_tokens) ?? number(raw.max_tokens) ?? preset.maxTokens;
  preset.presencePenalty = number(raw.presence_penalty) ?? preset.presencePenalty;
  preset.frequencyPenalty = number(raw.frequency_penalty) ?? preset.frequencyPenalty;
  preset.streaming = typeof raw.stream_openai === 'boolean' ? raw.stream_openai : preset.streaming;
  preset.stop = list(raw.stop_sequence) ?? list(raw.custom_stop_strings) ?? [];

  const prompts = Array.isArray(raw.prompts) ? (raw.prompts as StPrompt[]) : [];
  const orders = Array.isArray(raw.prompt_order) ? (raw.prompt_order as StPromptOrder[]) : [];
  // 100001 is SillyTavern's id for the default (non character specific) order.
  const order = orders.find((entry) => entry.character_id === 100001) ?? orders[0];

  const enabled = new Map<string, boolean>();
  for (const entry of order?.order ?? []) {
    if (entry.identifier) enabled.set(entry.identifier, entry.enabled !== false);
  }

  const byIdentifier = new Map<string, StPrompt>();
  for (const prompt of prompts) {
    if (prompt.identifier) byIdentifier.set(prompt.identifier, prompt);
  }

  const sequence: StPrompt[] = order?.order?.length
    ? order.order
        .map((entry) => (entry.identifier ? byIdentifier.get(entry.identifier) : undefined))
        .filter((prompt): prompt is StPrompt => Boolean(prompt))
    : prompts;

  let main = '';
  let jailbreak = '';
  const blocks: PromptBlock[] = [];

  // Markers stand in for the character card, history and world info, which Lara
  // assembles itself — but their place in the order still says where the
  // blocks around them belong.
  let stage: PromptBlockPosition = 'system';

  for (const prompt of sequence) {
    if (prompt.marker || !prompt.content) {
      if (prompt.identifier && CHARACTER_MARKERS.has(prompt.identifier) && stage === 'system') {
        stage = 'after_character';
      } else if (prompt.identifier === 'chatHistory') {
        stage = 'after_history';
      }
      continue;
    }

    const content = text(prompt.content);
    if (!content) continue;

    if (prompt.identifier === 'main') {
      main = content;
      continue;
    }
    if (prompt.identifier === 'jailbreak') {
      jailbreak = content;
      continue;
    }

    const role: MessageRole =
      prompt.role === 'user' || prompt.role === 'assistant' ? prompt.role : 'system';

    blocks.push({
      id: uid(),
      name: prompt.name || prompt.identifier || 'Prompt',
      content,
      enabled: prompt.identifier ? enabled.get(prompt.identifier) !== false : true,
      position: prompt.injection_position === 1 ? 'at_depth' : stage,
      role,
      depth: number(prompt.injection_depth) ?? 4,
      characterIds: [],
    });
  }

  const prompt: Partial<PromptSettings> = {};
  if (main) prompt.systemPrompt = main;
  if (jailbreak) prompt.postHistoryInstructions = jailbreak;
  const impersonation = text(raw.impersonation_prompt);
  if (impersonation) prompt.impersonatePrompt = impersonation;
  const context = number(raw.openai_max_context);
  if (context) prompt.contextSize = context;
  if (preset.maxTokens) prompt.responseTokens = preset.maxTokens;

  return {
    preset,
    prompt,
    blocks,
    model: text(raw.openai_model) ?? text(raw.claude_model) ?? text(raw.custom_model),
    kind: 'chat',
    unsupported: collectUnsupported(raw),
  };
}

// ---------------------------------------------------------------------------
// Text completion presets (KoboldAI / text-generation-webui style)
// ---------------------------------------------------------------------------

function readTextPreset(raw: Raw, name: string): ImportedPreset {
  const preset = basePreset(text(raw.name) ?? name);
  preset.temperature = number(raw.temp) ?? number(raw.temperature) ?? preset.temperature;
  preset.topP = number(raw.top_p) ?? preset.topP;
  preset.topK = number(raw.top_k) ?? preset.topK;
  preset.presencePenalty = number(raw.presence_penalty) ?? preset.presencePenalty;
  preset.frequencyPenalty = number(raw.frequency_penalty) ?? preset.frequencyPenalty;
  preset.stop = list(raw.stopping_strings) ?? list(raw.stop_sequence) ?? list(raw.stop) ?? [];
  preset.streaming = typeof raw.streaming === 'boolean' ? raw.streaming : preset.streaming;

  const genamt = number(raw.genamt);
  const maxLength = number(raw.max_length);
  const maxContext = number(raw.max_context);

  preset.maxTokens = genamt ?? maxLength ?? preset.maxTokens;

  const prompt: Partial<PromptSettings> = {};
  // Kobold presets overload max_length: it is the context when a separate
  // generate amount is present, and the response length when it is not.
  const context = maxContext ?? (genamt && maxLength && maxLength > genamt * 2 ? maxLength : undefined);
  if (context) prompt.contextSize = context;
  if (preset.maxTokens) prompt.responseTokens = preset.maxTokens;

  return { preset, prompt, blocks: [], kind: 'text', unsupported: collectUnsupported(raw) };
}

// ---------------------------------------------------------------------------

function readLaraPreset(raw: Raw, name: string): ImportedPreset {
  const preset = basePreset(text(raw.name) ?? name);
  preset.temperature = number(raw.temperature) ?? preset.temperature;
  preset.topP = number(raw.topP) ?? preset.topP;
  preset.topK = number(raw.topK) ?? preset.topK;
  preset.maxTokens = number(raw.maxTokens) ?? preset.maxTokens;
  preset.presencePenalty = number(raw.presencePenalty) ?? preset.presencePenalty;
  preset.frequencyPenalty = number(raw.frequencyPenalty) ?? preset.frequencyPenalty;
  preset.stop = list(raw.stop) ?? [];
  preset.streaming = typeof raw.streaming === 'boolean' ? raw.streaming : preset.streaming;
  return { preset, prompt: {}, blocks: [], kind: 'lara', unsupported: [] };
}

/**
 * Reads a preset file. SillyTavern chat-completion and text-completion presets
 * are both accepted, as is Lara's own export. Instruct and context templates
 * are rejected with a code the UI can explain — they describe text formatting
 * that a chat-completion frontend does not apply.
 */
export function parsePresetFile(rawText: string, fallbackName: string): ImportedPreset {
  let data: unknown;
  try {
    data = JSON.parse(rawText);
  } catch {
    throw new PresetFormatError('unreadable');
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new PresetFormatError('unreadable');
  const raw = data as Raw;

  if ('input_sequence' in raw || 'output_sequence' in raw || 'system_sequence' in raw) {
    throw new PresetFormatError('instruct');
  }
  if ('story_string' in raw || 'chat_start' in raw) {
    throw new PresetFormatError('context');
  }

  if (raw.format === 'lara-preset' || 'maxTokens' in raw || 'topP' in raw) {
    return readLaraPreset(raw, fallbackName);
  }
  if ('chat_completion_source' in raw || Array.isArray(raw.prompts) || 'openai_max_tokens' in raw) {
    return readChatPreset(raw, fallbackName);
  }
  if ('temp' in raw || 'genamt' in raw || 'rep_pen' in raw || 'max_length' in raw || 'stopping_strings' in raw) {
    return readTextPreset(raw, fallbackName);
  }
  if ('temperature' in raw || 'top_p' in raw) {
    return readTextPreset(raw, fallbackName);
  }
  throw new PresetFormatError('unreadable');
}

/** Exports in Lara's shape plus the aliases SillyTavern reads back. */
export function serializePreset(preset: GenerationPreset): string {
  return JSON.stringify(
    {
      format: 'lara-preset',
      name: preset.name,
      temperature: preset.temperature,
      topP: preset.topP,
      topK: preset.topK,
      maxTokens: preset.maxTokens,
      presencePenalty: preset.presencePenalty,
      frequencyPenalty: preset.frequencyPenalty,
      stop: preset.stop,
      streaming: preset.streaming,

      temp: preset.temperature,
      top_p: preset.topP,
      top_k: preset.topK,
      genamt: preset.maxTokens,
      presence_penalty: preset.presencePenalty,
      frequency_penalty: preset.frequencyPenalty,
      stopping_strings: preset.stop,
    },
    null,
    2,
  );
}
