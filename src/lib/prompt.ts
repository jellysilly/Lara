import type {
  BuiltPrompt,
  Character,
  Chat,
  Lorebook,
  Message,
  MessageRole,
  Persona,
  PromptSection,
  Settings,
} from '@/types';
import { activateLore } from './lorebook';
import { substituteMacros } from './macros';
import { applyRegexScripts } from './regex';
import { estimateTokens } from './tokenizer';

export interface BuildOptions {
  chat: Chat;
  character: Character | null;
  persona: Persona | null;
  lorebooks: Lorebook[];
  settings: Pick<Settings, 'prompt' | 'language' | 'regexScripts'>;
  /** Text the user is about to send, so lore can react to it before it exists. */
  pendingUserText?: string;
  /** Ask the model to write the user's next line instead of the character's. */
  impersonate?: boolean;
  /** Continue the final assistant message rather than starting a new one. */
  continueLast?: boolean;
}

const roleOf = (message: Message): MessageRole => message.role;

function joinBlocks(blocks: (string | undefined | null)[]): string {
  return blocks.map((block) => block?.trim()).filter(Boolean).join('\n\n');
}

function selectMemory(chat: Chat, budget: number): string {
  const entries = chat.memory.filter((entry) => entry.enabled && entry.content.trim());
  if (!entries.length) return '';
  const ordered = [...entries].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return b.updatedAt - a.updatedAt;
  });
  const kept: string[] = [];
  let used = 0;
  for (const entry of ordered) {
    const text = entry.title ? `${entry.title}: ${entry.content}` : entry.content;
    const tokens = estimateTokens(text);
    if (used + tokens > budget && !entry.pinned) continue;
    used += tokens;
    kept.push(text);
  }
  return kept.join('\n');
}

export function buildPrompt(options: BuildOptions): BuiltPrompt {
  const { chat, character, persona, lorebooks, settings, pendingUserText = '' } = options;
  const macroContext = { character, persona, locale: settings.language };
  const expand = (text: string) => substituteMacros(text ?? '', macroContext).trim();

  const scripts = settings.regexScripts ?? [];
  const runRegex = (text: string, target: 'user' | 'assistant' | 'system' | 'worldInfo', depth?: number) =>
    applyRegexScripts(text, scripts, {
      target,
      stage: 'prompt',
      depth,
      characterId: character?.id,
      macros: macroContext,
    });

  const sections: PromptSection[] = [];
  const addSection = (id: string, label: string, text: string) => {
    const tokens = estimateTokens(text);
    if (tokens > 0 && text.trim()) sections.push({ id, label, tokens });
  };

  // ---- lorebook activation -------------------------------------------------
  const activeBooks = lorebooks.filter(
    (book) => book.global || chat.lorebookIds.includes(book.id) || character?.lorebookId === book.id,
  );
  const activated = activateLore(activeBooks, chat.messages, pendingUserText);
  const loreBefore = activated.filter((item) => item.entry.position === 'before_char');
  const loreAfter = activated.filter((item) => item.entry.position === 'after_char');
  const loreAtDepth = activated.filter((item) => item.entry.position === 'at_depth');
  const loreWithNote = activated.filter((item) => item.entry.position === 'author_note');

  // ---- system block --------------------------------------------------------
  const cardPrompt = settings.prompt.useCharacterSystemPrompt ? character?.systemPrompt : '';
  const systemPrompt = expand(cardPrompt?.trim() ? cardPrompt : settings.prompt.systemPrompt);

  const characterBlock = character
    ? joinBlocks([
        character.description && `${character.name}'s description:\n${expand(character.description)}`,
        character.personality && `${character.name}'s personality:\n${expand(character.personality)}`,
        character.scenario && `Scenario:\n${expand(character.scenario)}`,
      ])
    : '';

  const personaBlock = persona?.description?.trim()
    ? `${persona.name || 'The user'}'s persona:\n${expand(persona.description)}`
    : persona?.name
      ? `The user is ${persona.name}.`
      : '';

  const examplesBlock =
    settings.prompt.includeExampleDialogue && character?.mesExample?.trim()
      ? `Example dialogue (style reference, not history):\n${expand(character.mesExample)}`
      : '';

  const memoryBudget = Math.round(settings.prompt.contextSize * settings.prompt.memoryBudget);
  const memoryText = selectMemory(chat, memoryBudget);
  const memoryBlock = memoryText ? `Persistent memory of this story:\n${expand(memoryText)}` : '';

  const loreText = (items: typeof activated) =>
    items.map((item) => runRegex(expand(item.entry.content), 'worldInfo')).join('\n');
  const loreBeforeText = loreText(loreBefore);
  const loreAfterText = loreText(loreAfter);

  const systemContent = joinBlocks([
    systemPrompt,
    loreBeforeText && `World info:\n${loreBeforeText}`,
    characterBlock,
    personaBlock,
    loreAfterText && `World info:\n${loreAfterText}`,
    memoryBlock,
    examplesBlock,
  ]);

  addSection('system', 'tokens.section.system', systemPrompt);
  addSection('lore', 'tokens.section.lore', `${loreBeforeText}\n${loreAfterText}`);
  addSection('character', 'tokens.section.character', characterBlock);
  addSection('persona', 'tokens.section.persona', personaBlock);
  addSection('memory', 'tokens.section.memory', memoryBlock);
  addSection('examples', 'tokens.section.examples', examplesBlock);

  // ---- author's note + depth lore -----------------------------------------
  const noteParts = [
    chat.authorNote.enabled ? expand(chat.authorNote.content) : '',
    loreText(loreWithNote),
  ].filter(Boolean);
  const authorNote = noteParts.join('\n');
  addSection('authorNote', 'tokens.section.authorNote', authorNote);

  const depthLore = loreText(loreAtDepth);

  // ---- history -------------------------------------------------------------
  const reserve = settings.prompt.responseTokens;
  const overheadTokens = estimateTokens(systemContent) + estimateTokens(authorNote) + estimateTokens(depthLore) + 16;
  const postHistory = expand(
    character?.postHistoryInstructions?.trim()
      ? character.postHistoryInstructions
      : settings.prompt.postHistoryInstructions,
  );
  const postHistoryTokens = estimateTokens(postHistory);
  let remaining = settings.prompt.contextSize - reserve - overheadTokens - postHistoryTokens;

  const usable = chat.messages.filter((message) => !message.hidden && (message.swipes[message.swipeIndex] ?? '').trim());
  const history: { role: MessageRole; content: string }[] = [];
  for (let i = usable.length - 1; i >= 0; i--) {
    const message = usable[i];
    const depth = usable.length - 1 - i;
    const content = runRegex(expand(message.swipes[message.swipeIndex] ?? ''), roleOf(message), depth);
    if (!content) continue;
    const cost = estimateTokens(content) + 4;
    if (cost > remaining) break;
    remaining -= cost;
    history.unshift({ role: roleOf(message), content });
  }
  addSection('history', 'tokens.section.history', history.map((item) => item.content).join('\n'));

  // Inject the author's note / depth lore N messages from the end.
  const injections: { role: MessageRole; content: string }[] = [];
  if (authorNote) injections.push({ role: 'system', content: authorNote });
  if (depthLore) injections.push({ role: 'system', content: `World info:\n${depthLore}` });
  if (injections.length) {
    const depth = Math.max(0, Math.min(history.length, chat.authorNote.depth));
    history.splice(history.length - depth, 0, ...injections);
  }

  const messages: { role: MessageRole; content: string }[] = [];
  if (systemContent) messages.push({ role: 'system', content: systemContent });
  messages.push(...history);

  if (options.impersonate) {
    const impersonatePrompt = expand(settings.prompt.impersonatePrompt);
    if (impersonatePrompt) messages.push({ role: 'system', content: impersonatePrompt });
  } else if (postHistory) {
    messages.push({ role: 'system', content: postHistory });
    addSection('jailbreak', 'tokens.section.jailbreak', postHistory);
  }

  if (options.continueLast) {
    messages.push({
      role: 'system',
      content: 'Continue the last message seamlessly. Do not repeat what was already written.',
    });
  }

  const total = messages.reduce((sum, message) => sum + estimateTokens(message.content) + 4, 0);
  return { messages, sections, total };
}

export const DEFAULT_SYSTEM_PROMPT = `You are an imaginative roleplay partner. Stay fully in character as {{char}} and write vivid, grounded prose.

- Write only {{char}}'s words, actions and inner life. Never speak or act for {{user}}.
- Keep continuity with everything established in the scene, the world info and the memory notes.
- Favour concrete sensory detail over summary. Vary sentence rhythm. Avoid repeating phrasings from earlier replies.
- Let scenes breathe: it is fine to end on a gesture, a question or a silence.`;

export const DEFAULT_POST_HISTORY = `Reply as {{char}} only. Do not narrate {{user}}'s thoughts, speech or choices.`;

export const DEFAULT_IMPERSONATE_PROMPT = `Write the next message as {{user}}, in first person, matching their established voice. Write only {{user}}'s message with no commentary.`;

export const DEFAULT_SUMMARY_PROMPT = `Summarise the events of this conversation so far as durable memory notes.

Keep only what matters later: decisions, relationships, promises, injuries, locations, secrets revealed. Write 3-6 short bullet points in the past tense, no preamble, no speculation.`;
