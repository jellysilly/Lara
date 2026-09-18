import type { RegexScript, RegexStage, RegexTarget, UUID } from '@/types';
import { substituteMacros, type MacroContext } from './macros';
import { uid } from './utils';

/** Compiled patterns are cached — scripts run on every message on every render. */
const compiled = new Map<string, RegExp | null>();

/** Accepts both a bare pattern and the `/pattern/flags` form people copy around. */
export function compileRegex(find: string): RegExp | null {
  if (!find) return null;
  const cached = compiled.get(find);
  if (cached !== undefined) return cached;

  let pattern = find;
  let flags = 'g';
  const delimited = find.match(/^\/(.+)\/([gimsuy]*)$/s);
  if (delimited) {
    pattern = delimited[1];
    flags = delimited[2] || '';
  }
  // A non-global script would only ever replace the first hit, which is never
  // what people mean when they write a formatting rule.
  if (!flags.includes('g')) flags += 'g';

  let result: RegExp | null = null;
  try {
    result = new RegExp(pattern, flags);
  } catch {
    result = null;
  }
  if (compiled.size > 200) compiled.clear();
  compiled.set(find, result);
  return result;
}

export function regexError(find: string): string | null {
  if (!find.trim()) return null;
  return compileRegex(find) ? null : 'invalid';
}

export interface RegexRunContext {
  target: RegexTarget;
  stage: RegexStage;
  /** 0 is the newest message; used by the depth window. */
  depth?: number;
  characterId?: UUID;
  macros?: MacroContext;
}

function applies(script: RegexScript, context: RegexRunContext): boolean {
  if (!script.enabled) return false;
  if (!script.targets.includes(context.target)) return false;
  if (!script.stages.includes(context.stage)) return false;
  if (script.characterIds.length && (!context.characterId || !script.characterIds.includes(context.characterId))) {
    return false;
  }
  const depth = context.depth;
  if (depth != null) {
    if (script.minDepth != null && depth < script.minDepth) return false;
    if (script.maxDepth != null && depth > script.maxDepth) return false;
  }
  return true;
}

export function runScript(script: RegexScript, text: string, macros?: MacroContext): string {
  const pattern = compileRegex(script.find);
  if (!pattern) return text;

  const replacement = macros ? substituteMacros(script.replace, macros) : script.replace;

  return text.replace(pattern, (...args) => {
    const groups = args.slice(0, -2) as string[];
    let match = groups[0] ?? '';
    for (const trim of script.trimStrings) {
      if (trim) match = match.split(macros ? substituteMacros(trim, macros) : trim).join('');
    }

    return replacement.replace(/\{\{match\}\}|\$(\d{1,2}|&)/g, (token) => {
      if (token === '{{match}}' || token === '$&') return match;
      const index = Number(token.slice(1));
      if (index === 0) return match;
      const group = groups[index];
      if (group === undefined) return '';
      let value = group;
      for (const trim of script.trimStrings) {
        if (trim) value = value.split(trim).join('');
      }
      return value;
    });
  });
}

export function applyRegexScripts(text: string, scripts: RegexScript[], context: RegexRunContext): string {
  if (!text || !scripts.length) return text;
  let result = text;
  for (const script of scripts) {
    if (!applies(script, context)) continue;
    result = runScript(script, result, context.macros);
  }
  return result;
}

export function createRegexScript(partial: Partial<RegexScript> = {}): RegexScript {
  return {
    id: uid(),
    name: '',
    enabled: true,
    find: '',
    replace: '',
    trimStrings: [],
    targets: ['assistant'],
    stages: ['display'],
    minDepth: null,
    maxDepth: null,
    runOnEdit: false,
    characterIds: [],
    ...partial,
  };
}

// ---------------------------------------------------------------------------
// SillyTavern regex script interop
// ---------------------------------------------------------------------------

/** SillyTavern's numeric placement codes. */
const ST_PLACEMENT: Record<number, RegexTarget> = {
  1: 'user',
  2: 'assistant',
  5: 'worldInfo',
};

interface SillyTavernScript {
  id?: string;
  scriptName?: string;
  findRegex?: string;
  replaceString?: string;
  trimStrings?: string[];
  placement?: number[];
  disabled?: boolean;
  markdownOnly?: boolean;
  promptOnly?: boolean;
  runOnEdit?: boolean;
  minDepth?: number | null;
  maxDepth?: number | null;
}

function isSillyTavernScript(value: unknown): value is SillyTavernScript {
  return Boolean(value && typeof value === 'object' && 'findRegex' in (value as object));
}

function fromSillyTavern(raw: SillyTavernScript): RegexScript {
  const targets = (raw.placement ?? [2])
    .map((code) => ST_PLACEMENT[code])
    .filter((target): target is RegexTarget => Boolean(target));

  const stages: RegexStage[] = [];
  if (raw.markdownOnly) stages.push('display');
  if (raw.promptOnly) stages.push('prompt');
  if (!stages.length) stages.push('display', 'prompt');
  if (raw.runOnEdit) stages.push('store');

  return createRegexScript({
    name: raw.scriptName || 'Imported script',
    enabled: !raw.disabled,
    find: raw.findRegex ?? '',
    replace: raw.replaceString ?? '',
    trimStrings: raw.trimStrings ?? [],
    targets: targets.length ? targets : ['assistant'],
    stages,
    minDepth: raw.minDepth ?? null,
    maxDepth: raw.maxDepth ?? null,
    runOnEdit: Boolean(raw.runOnEdit),
  });
}

/** Reads our own export as well as a SillyTavern regex script or a list of them. */
export function parseRegexFile(raw: string): RegexScript[] {
  const data = JSON.parse(raw);
  const items: unknown[] = Array.isArray(data) ? data : [data];

  return items.map((item) => {
    if (isSillyTavernScript(item)) return fromSillyTavern(item);
    const script = item as Partial<RegexScript>;
    if (typeof script.find !== 'string') throw new Error('Unrecognised regex script');
    return createRegexScript({ ...script, id: uid() });
  });
}
