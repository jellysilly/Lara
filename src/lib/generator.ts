import type { Language } from '@/types';
import type { PromptMessage } from './api';

export type GenTarget = 'character' | 'persona' | 'lorebook';
export type GenLength = 'short' | 'medium' | 'long';

export const CHARACTER_FIELDS = [
  'description',
  'personality',
  'scenario',
  'firstMes',
  'mesExample',
  'alternateGreetings',
  'systemPrompt',
  'tags',
] as const;
export type CharacterField = (typeof CHARACTER_FIELDS)[number];

export interface GenRequest {
  target: GenTarget;
  brief: string;
  sourceText: string;
  sourceTitle: string;
  fields: CharacterField[];
  tone: string;
  length: GenLength;
  language: Language | 'match';
  mature: boolean;
  extra: string;
  entryCount: number;
  /** Rewrite a single field instead of the whole card. */
  onlyField?: string;
  existing?: Record<string, unknown>;
}

const LENGTH_GUIDE: Record<GenLength, string> = {
  short: 'Keep every field tight: 2-4 sentences for prose fields.',
  medium: 'Aim for one rich paragraph per prose field (4-8 sentences).',
  long: 'Write generously: 2-3 paragraphs per prose field, with concrete detail.',
};

const FIELD_GUIDE: Record<CharacterField, string> = {
  description:
    'description — who they are: appearance, background, habits, speech patterns, what they want. Written as reference notes, not prose fiction.',
  personality: 'personality — a compact trait list or short paragraph capturing temperament and flaws.',
  scenario: 'scenario — the situation the roleplay opens in, and why {{user}} is there.',
  firstMes:
    'first_mes — the opening message in the character\'s own voice. Use *asterisks* for actions, plain text for speech. End on something {{user}} can respond to.',
  mesExample:
    'mes_example — 2-3 short example exchanges showing the voice. Use the format: <START>\\n{{user}}: …\\n{{char}}: …',
  alternateGreetings: 'alternate_greetings — 2 further opening messages in different moods or situations.',
  systemPrompt: 'system_prompt — optional extra directions for the model about how to play this character.',
  tags: 'tags — 3-6 short lowercase tags.',
};

function languageLine(language: Language | 'match'): string {
  if (language === 'match') return 'Write in the same language as the source material.';
  return language === 'ru' ? 'Write everything in Russian.' : 'Write everything in English.';
}

function schemaFor(request: GenRequest): string {
  if (request.target === 'persona') {
    return `{
  "name": string,
  "description": string
}`;
  }
  if (request.target === 'lorebook') {
    return `{
  "name": string,
  "description": string,
  "entries": [
    {
      "keys": string[],
      "content": string,
      "comment": string,
      "constant": boolean
    }
  ]
}`;
  }
  const lines: string[] = ['  "name": string'];
  const has = (field: CharacterField) => request.fields.includes(field);
  if (has('description')) lines.push('  "description": string');
  if (has('personality')) lines.push('  "personality": string');
  if (has('scenario')) lines.push('  "scenario": string');
  if (has('firstMes')) lines.push('  "first_mes": string');
  if (has('mesExample')) lines.push('  "mes_example": string');
  if (has('alternateGreetings')) lines.push('  "alternate_greetings": string[]');
  if (has('systemPrompt')) lines.push('  "system_prompt": string');
  if (has('tags')) lines.push('  "tags": string[]');
  return `{\n${lines.join(',\n')}\n}`;
}

export function buildGeneratorMessages(request: GenRequest): PromptMessage[] {
  const rules: string[] = [
    'You are a character-card author for a roleplay frontend. You return JSON and nothing else.',
    languageLine(request.language),
    LENGTH_GUIDE[request.length],
  ];

  if (request.target === 'character') {
    rules.push(
      'Use {{char}} for the character and {{user}} for the human player inside prose fields — never invent a name for the player.',
      'Fields to write:',
      ...request.fields.map((field) => `- ${FIELD_GUIDE[field]}`),
    );
  } else if (request.target === 'persona') {
    rules.push(
      'A persona describes the human player as the character perceives them: name, look, manner, role in the story. Second person or neutral notes, 1-2 paragraphs.',
    );
  } else {
    rules.push(
      `Produce about ${request.entryCount} lorebook entries covering places, factions, people, items, customs and history.`,
      'Each entry: 2-5 trigger keys (nouns and names a player would actually type), 2-5 sentences of content, a short comment naming the entry.',
      'Mark at most one entry as constant: true — a short always-on world summary.',
    );
  }

  if (request.tone.trim()) rules.push(`Tone and style: ${request.tone.trim()}.`);
  rules.push(
    request.mature
      ? 'Mature themes are permitted where the material calls for them. Keep every character an adult.'
      : 'Keep the content suitable for a general audience.',
  );
  if (request.extra.trim()) rules.push(`Additional instructions: ${request.extra.trim()}`);

  rules.push(
    'Never copy long passages verbatim from the source — rewrite in your own words.',
    'Output strictly this JSON shape, with no markdown fence and no commentary:',
    schemaFor(request),
  );

  const userParts: string[] = [];
  if (request.brief.trim()) userParts.push(`Brief:\n${request.brief.trim()}`);
  if (request.sourceText.trim()) {
    userParts.push(
      `Source material${request.sourceTitle ? ` — “${request.sourceTitle}”` : ''}:\n"""\n${request.sourceText.trim()}\n"""`,
    );
  }
  if (request.onlyField) {
    userParts.push(
      `Rewrite only the field "${request.onlyField}". Return the same JSON shape with just that field filled in.`,
    );
    if (request.existing) {
      userParts.push(`Existing card for context:\n${JSON.stringify(request.existing).slice(0, 4000)}`);
    }
  }
  if (!userParts.length) userParts.push('Invent something interesting and unexpected.');

  return [
    { role: 'system', content: rules.join('\n') },
    { role: 'user', content: userParts.join('\n\n') },
  ];
}

/** Models like to wrap JSON in prose or fences — dig the object back out. */
export function parseGeneratorOutput(raw: string): Record<string, unknown> {
  let text = raw.trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) text = fence[1].trim();

  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start >= 0 && end > start) text = text.slice(start, end + 1);

  const attempts = [
    text,
    // trailing commas
    text.replace(/,\s*([}\]])/g, '$1'),
    // unescaped newlines inside strings
    text.replace(/,\s*([}\]])/g, '$1').replace(/([^\\])\n/g, '$1\\n'),
  ];

  for (const attempt of attempts) {
    try {
      const parsed = JSON.parse(attempt);
      if (parsed && typeof parsed === 'object') return parsed as Record<string, unknown>;
    } catch {
      /* try the next repair */
    }
  }
  throw new Error('Could not parse the generated JSON');
}

export const asString = (value: unknown): string => (typeof value === 'string' ? value : '');
export const asStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
