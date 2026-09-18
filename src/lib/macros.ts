import type { Character, Persona } from '@/types';

export interface MacroContext {
  character?: Character | null;
  persona?: Persona | null;
  locale?: string;
}

/** Expands the SillyTavern-style {{macros}} used across cards and prompts. */
export function substituteMacros(text: string, context: MacroContext = {}): string {
  if (!text || !text.includes('{{')) return text ?? '';
  const locale = context.locale === 'ru' ? 'ru-RU' : 'en-US';
  const char = context.character?.name ?? 'the character';
  const user = context.persona?.name ?? 'You';

  return text.replace(/\{\{([^{}]+)\}\}/g, (match, rawKey: string) => {
    const [name, ...rest] = rawKey.split(':');
    const key = name.trim().toLowerCase();
    const argument = rest.join(':').trim();

    switch (key) {
      case 'char':
      case 'character':
        return char;
      case 'user':
      case 'persona':
        return user;
      case 'personadescription':
        return context.persona?.description ?? '';
      case 'description':
        return context.character?.description ?? '';
      case 'personality':
        return context.character?.personality ?? '';
      case 'scenario':
        return context.character?.scenario ?? '';
      case 'time':
        return new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(Date.now());
      case 'date':
        return new Intl.DateTimeFormat(locale, { dateStyle: 'long' }).format(Date.now());
      case 'weekday':
        return new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(Date.now());
      case 'random': {
        const options = argument.split(',').map((option) => option.trim()).filter(Boolean);
        return options.length ? options[Math.floor(Math.random() * options.length)] : '';
      }
      case 'roll': {
        const sides = Number(argument.replace(/^d/i, '')) || 20;
        return String(1 + Math.floor(Math.random() * sides));
      }
      case 'newline':
        return '\n';
      case 'trim':
        return '';
      default:
        return match;
    }
  });
}
