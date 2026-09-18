import type { LoreEntry, Lorebook, Message } from '@/types';
import { escapeRegExp } from './utils';
import { estimateTokens } from './tokenizer';

export interface ActivatedEntry {
  entry: LoreEntry;
  book: Lorebook;
  tokens: number;
}

function matchesKey(haystack: string, key: string, entry: LoreEntry): boolean {
  if (!key) return false;
  const text = entry.caseSensitive ? haystack : haystack.toLowerCase();
  const needle = entry.caseSensitive ? key : key.toLowerCase();
  if (!entry.matchWholeWords) return text.includes(needle);
  // \b does not work for Cyrillic in every engine, so bound on non-letters instead.
  const pattern = new RegExp(`(^|[^\\p{L}\\p{N}_])${escapeRegExp(needle)}([^\\p{L}\\p{N}_]|$)`, 'u');
  return pattern.test(text);
}

function primaryMatches(text: string, entry: LoreEntry): boolean {
  return entry.keys.some((key) => matchesKey(text, key, entry));
}

function secondaryMatches(text: string, entry: LoreEntry): boolean {
  if (!entry.secondaryKeys.length) return true;
  const hits = entry.secondaryKeys.map((key) => matchesKey(text, key, entry));
  switch (entry.logic) {
    case 'and_all':
      return hits.every(Boolean);
    case 'not_any':
      return !hits.some(Boolean);
    case 'not_all':
      return !hits.every(Boolean);
    case 'and_any':
    default:
      return hits.some(Boolean);
  }
}

/**
 * Runs the keyword scan over the most recent messages and returns the entries
 * that should be injected, ordered and clipped to the token budget.
 */
export function activateLore(
  books: Lorebook[],
  messages: Message[],
  extraText = '',
): ActivatedEntry[] {
  const active = books.filter((book) => book.entries.some((entry) => entry.enabled));
  if (!active.length) return [];

  const maxScanDepth = Math.max(...active.map((book) => book.scanDepth || 4));
  const recent = messages
    .filter((message) => !message.hidden)
    .slice(-Math.max(1, maxScanDepth))
    .map((message) => message.swipes[message.swipeIndex] ?? '')
    .join('\n');

  const candidates: ActivatedEntry[] = [];
  const seen = new Set<string>();
  let scanText = `${recent}\n${extraText}`;

  const collect = (allowRecursiveOnly: boolean) => {
    for (const book of active) {
      const depthSlice = messages
        .filter((message) => !message.hidden)
        .slice(-Math.max(1, book.scanDepth || 4))
        .map((message) => message.swipes[message.swipeIndex] ?? '')
        .join('\n');
      const bookText = allowRecursiveOnly ? scanText : `${depthSlice}\n${extraText}`;

      for (const entry of book.entries) {
        if (!entry.enabled || seen.has(entry.id)) continue;
        if (allowRecursiveOnly && !entry.recursive) continue;
        const triggered = entry.constant || (primaryMatches(bookText, entry) && secondaryMatches(bookText, entry));
        if (!triggered) continue;
        if (entry.probability < 100 && Math.random() * 100 > entry.probability) continue;
        seen.add(entry.id);
        candidates.push({ entry, book, tokens: estimateTokens(entry.content) });
      }
    }
  };

  collect(false);

  // Recursive pass: entries just pulled in can mention keys of other entries.
  const recursiveBooks = active.filter((book) => book.recursiveScan);
  if (recursiveBooks.length) {
    for (let pass = 0; pass < 3; pass++) {
      const before = candidates.length;
      scanText = `${recent}\n${extraText}\n${candidates.map((item) => item.entry.content).join('\n')}`;
      collect(true);
      if (candidates.length === before) break;
    }
  }

  candidates.sort((a, b) => b.entry.order - a.entry.order || a.entry.content.localeCompare(b.entry.content));

  const budget = Math.max(...active.map((book) => book.tokenBudget || 1024));
  const kept: ActivatedEntry[] = [];
  let used = 0;
  for (const candidate of candidates) {
    if (used + candidate.tokens > budget) continue;
    used += candidate.tokens;
    kept.push(candidate);
  }
  return kept;
}

export function emptyEntry(overrides: Partial<LoreEntry> = {}): Omit<LoreEntry, 'id'> {
  return {
    keys: [],
    secondaryKeys: [],
    content: '',
    comment: '',
    enabled: true,
    constant: false,
    caseSensitive: false,
    matchWholeWords: true,
    logic: 'and_any',
    order: 100,
    probability: 100,
    position: 'before_char',
    depth: 4,
    recursive: false,
    ...overrides,
  };
}
