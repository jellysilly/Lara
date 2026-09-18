export type UUID = string;

export type Provider = 'openai' | 'anthropic' | 'google' | 'custom';

export interface ApiProfile {
  id: UUID;
  name: string;
  provider: Provider;
  baseUrl: string;
  apiKey: string;
  model: string;
  /** Advertised context window, used by the token meter. */
  contextSize: number;
  extraHeaders: Record<string, string>;
}

export interface GenerationPreset {
  id: UUID;
  name: string;
  temperature: number;
  topP: number;
  topK: number;
  maxTokens: number;
  presencePenalty: number;
  frequencyPenalty: number;
  stop: string[];
  streaming: boolean;
}

export type LorePosition = 'before_char' | 'after_char' | 'at_depth' | 'author_note';
export type LoreLogic = 'and_any' | 'and_all' | 'not_any' | 'not_all';

export interface LoreEntry {
  id: UUID;
  keys: string[];
  secondaryKeys: string[];
  content: string;
  comment: string;
  enabled: boolean;
  /** Always injected, no keyword scan. */
  constant: boolean;
  caseSensitive: boolean;
  matchWholeWords: boolean;
  logic: LoreLogic;
  order: number;
  probability: number;
  position: LorePosition;
  depth: number;
  /** Allows this entry to be triggered by other entries' content. */
  recursive: boolean;
}

export interface Lorebook {
  id: UUID;
  name: string;
  description: string;
  entries: LoreEntry[];
  scanDepth: number;
  tokenBudget: number;
  recursiveScan: boolean;
  /** Active in every chat, not only where linked. */
  global: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface Character {
  id: UUID;
  name: string;
  avatar?: string;
  description: string;
  personality: string;
  scenario: string;
  firstMes: string;
  mesExample: string;
  creatorNotes: string;
  systemPrompt: string;
  postHistoryInstructions: string;
  alternateGreetings: string[];
  tags: string[];
  creator: string;
  characterVersion: string;
  lorebookId?: UUID;
  favorite: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface Persona {
  id: UUID;
  name: string;
  avatar?: string;
  description: string;
  createdAt: number;
  updatedAt: number;
}

export type MessageRole = 'user' | 'assistant' | 'system';

export interface TokenUsage {
  prompt: number;
  completion: number;
}

export interface Message {
  id: UUID;
  role: MessageRole;
  name: string;
  avatar?: string;
  swipes: string[];
  swipeIndex: number;
  createdAt: number;
  updatedAt: number;
  usage?: TokenUsage;
  /** Kept in the transcript but excluded from the prompt. */
  hidden?: boolean;
  /** Marks the opening message so regenerating offers greetings instead. */
  isGreeting?: boolean;
}

export interface MemoryEntry {
  id: UUID;
  title: string;
  content: string;
  /** Pinned entries survive trimming when the memory budget is exceeded. */
  pinned: boolean;
  enabled: boolean;
  source: 'manual' | 'auto';
  createdAt: number;
  updatedAt: number;
  /** Index of the last message covered by an auto summary. */
  coveredUpTo?: number;
}

export interface AuthorNote {
  content: string;
  depth: number;
  enabled: boolean;
}

export interface Chat {
  id: UUID;
  characterId: UUID;
  personaId?: UUID;
  title: string;
  messages: Message[];
  memory: MemoryEntry[];
  authorNote: AuthorNote;
  lorebookIds: UUID[];
  usage: TokenUsage;
  createdAt: number;
  updatedAt: number;
  branchedFrom?: { chatId: UUID; messageIndex: number };
}

export interface ChatSummary {
  id: UUID;
  characterId: UUID;
  title: string;
  messageCount: number;
  lastMessage: string;
  updatedAt: number;
  createdAt: number;
}

export type ThemeName = 'lagoon' | 'seafoam' | 'coral';
export type ColorMode = 'light' | 'dark' | 'auto';
export type ChatStyle = 'flat' | 'bubble';
export type AvatarMode = 'messenger' | 'above' | 'none';
export type Language = 'en' | 'ru';

export type RegexTarget = 'user' | 'assistant' | 'system' | 'worldInfo';
/** display = what you read, prompt = what the model reads, store = rewritten on save. */
export type RegexStage = 'display' | 'prompt' | 'store';

export interface RegexScript {
  id: UUID;
  name: string;
  enabled: boolean;
  /** A bare pattern or the `/pattern/flags` form. */
  find: string;
  replace: string;
  /** Substrings stripped out of the match before it is substituted back. */
  trimStrings: string[];
  targets: RegexTarget[];
  stages: RegexStage[];
  /** Depth window, counted from the newest message (0). Null means unbounded. */
  minDepth: number | null;
  maxDepth: number | null;
  runOnEdit: boolean;
  /** Empty means every character. */
  characterIds: UUID[];
}

export interface AppearanceSettings {
  theme: ThemeName;
  mode: ColorMode;
  chatStyle: ChatStyle;
  avatarMode: AvatarMode;
  avatarSize: number;
  avatarShape: 'circle' | 'rounded' | 'square';
  fontSize: number;
  chatWidth: number;
  messageGap: number;
  animations: boolean;
  waves: boolean;
  blur: boolean;
  serifBody: boolean;
}

export interface PromptSettings {
  systemPrompt: string;
  postHistoryInstructions: string;
  impersonatePrompt: string;
  summaryPrompt: string;
  /** Tokens reserved for the reply inside the context budget. */
  responseTokens: number;
  contextSize: number;
  /** Share of the context the memory book may take, 0..1. */
  memoryBudget: number;
  includeExampleDialogue: boolean;
  trimSentences: boolean;
  autoSummary: boolean;
  autoSummaryInterval: number;
  useCharacterSystemPrompt: boolean;
}

export interface GeneratorDefaults {
  language: Language | 'match';
  length: 'short' | 'medium' | 'long';
  tone: string;
  allowMature: boolean;
  entryCount: number;
}

export interface Settings {
  language: Language;
  appearance: AppearanceSettings;
  prompt: PromptSettings;
  generator: GeneratorDefaults;
  apiProfiles: ApiProfile[];
  activeApiProfileId?: UUID;
  presets: GenerationPreset[];
  activePresetId?: UUID;
  regexScripts: RegexScript[];
  activePersonaId?: UUID;
  corsProxy: string;
  /** Cumulative token counters across the whole app. */
  totalUsage: TokenUsage;
  /** Optional hard ceiling the user is budgeting against. */
  tokenAllowance: number;
  onboarded: boolean;
}

export interface PromptSection {
  id: string;
  label: string;
  tokens: number;
}

export interface BuiltPrompt {
  messages: { role: MessageRole; content: string }[];
  sections: PromptSection[];
  total: number;
}
