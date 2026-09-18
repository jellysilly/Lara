import type { Character, Lorebook, LoreEntry } from '@/types';
import { uid } from './utils';
import { emptyEntry } from './lorebook';

/** Character Card V2 payload as published in the community spec. */
export interface CardV2Data {
  name?: string;
  description?: string;
  personality?: string;
  scenario?: string;
  first_mes?: string;
  mes_example?: string;
  creator_notes?: string;
  system_prompt?: string;
  post_history_instructions?: string;
  alternate_greetings?: string[];
  tags?: string[];
  creator?: string;
  character_version?: string;
  character_book?: CardBook;
  extensions?: Record<string, unknown>;
}

interface CardBook {
  name?: string;
  description?: string;
  scan_depth?: number;
  token_budget?: number;
  recursive_scanning?: boolean;
  entries?: CardBookEntry[];
}

interface CardBookEntry {
  keys?: string[];
  secondary_keys?: string[];
  content?: string;
  comment?: string;
  enabled?: boolean;
  constant?: boolean;
  case_sensitive?: boolean;
  selective?: boolean;
  insertion_order?: number;
  priority?: number;
  position?: string | number;
  extensions?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// base64 helpers that survive non-ASCII card text
// ---------------------------------------------------------------------------

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

// ---------------------------------------------------------------------------
// PNG chunk plumbing
// ---------------------------------------------------------------------------

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

interface PngChunk {
  type: string;
  data: Uint8Array;
}

function readChunks(bytes: Uint8Array): PngChunk[] {
  if (!PNG_SIGNATURE.every((byte, index) => bytes[index] === byte)) {
    throw new Error('Not a PNG file');
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const chunks: PngChunk[] = [];
  let offset = 8;
  while (offset + 8 <= bytes.length) {
    const length = view.getUint32(offset);
    const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
    chunks.push({ type, data: bytes.subarray(offset + 8, offset + 8 + length) });
    offset += 12 + length;
    if (type === 'IEND') break;
  }
  return chunks;
}

function buildChunk(type: string, data: Uint8Array): Uint8Array {
  const typeBytes = new TextEncoder().encode(type);
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  out.set(typeBytes, 4);
  out.set(data, 8);
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

function textChunk(keyword: string, text: string): Uint8Array {
  const encoder = new TextEncoder();
  const keywordBytes = encoder.encode(keyword);
  const textBytes = encoder.encode(text);
  const data = new Uint8Array(keywordBytes.length + 1 + textBytes.length);
  data.set(keywordBytes, 0);
  data[keywordBytes.length] = 0;
  data.set(textBytes, keywordBytes.length + 1);
  return buildChunk('tEXt', data);
}

function parseTextChunk(chunk: PngChunk): { keyword: string; text: string } | null {
  if (chunk.type !== 'tEXt' && chunk.type !== 'iTXt') return null;
  const separator = chunk.data.indexOf(0);
  if (separator < 0) return null;
  const decoder = new TextDecoder();
  const keyword = decoder.decode(chunk.data.subarray(0, separator));
  let start = separator + 1;
  if (chunk.type === 'iTXt') {
    // compression flag, compression method, language tag, translated keyword
    start += 2;
    for (let skipped = 0; skipped < 2 && start < chunk.data.length; skipped++) {
      const next = chunk.data.indexOf(0, start);
      if (next < 0) break;
      start = next + 1;
    }
  }
  return { keyword, text: decoder.decode(chunk.data.subarray(start)) };
}

// ---------------------------------------------------------------------------
// Card <-> Character
// ---------------------------------------------------------------------------

function bookToLorebook(book: CardBook, name: string): Lorebook {
  const entries: LoreEntry[] = (book.entries ?? []).map((entry) => {
    const positionRaw = entry.position ?? entry.extensions?.position;
    const position =
      positionRaw === 'after_char' || positionRaw === 1
        ? 'after_char'
        : positionRaw === 4 || positionRaw === 'at_depth'
          ? 'at_depth'
          : 'before_char';
    return {
      ...emptyEntry(),
      id: uid(),
      keys: entry.keys ?? [],
      secondaryKeys: entry.secondary_keys ?? [],
      content: entry.content ?? '',
      comment: entry.comment ?? '',
      enabled: entry.enabled ?? true,
      constant: entry.constant ?? false,
      caseSensitive: entry.case_sensitive ?? false,
      order: entry.insertion_order ?? entry.priority ?? 100,
      position,
      depth: Number(entry.extensions?.depth ?? 4),
      probability: Number(entry.extensions?.probability ?? 100),
    };
  });
  return {
    id: uid(),
    name: book.name || name,
    description: book.description ?? '',
    entries,
    scanDepth: book.scan_depth ?? 4,
    tokenBudget: book.token_budget ?? 1024,
    recursiveScan: book.recursive_scanning ?? false,
    global: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

function lorebookToBook(lorebook: Lorebook): CardBook {
  return {
    name: lorebook.name,
    description: lorebook.description,
    scan_depth: lorebook.scanDepth,
    token_budget: lorebook.tokenBudget,
    recursive_scanning: lorebook.recursiveScan,
    entries: lorebook.entries.map((entry, index) => ({
      keys: entry.keys,
      secondary_keys: entry.secondaryKeys,
      content: entry.content,
      comment: entry.comment,
      enabled: entry.enabled,
      constant: entry.constant,
      case_sensitive: entry.caseSensitive,
      selective: entry.secondaryKeys.length > 0,
      insertion_order: entry.order,
      id: index,
      position: entry.position === 'after_char' ? 'after_char' : 'before_char',
      extensions: { depth: entry.depth, probability: entry.probability, position: entry.position },
    })),
  };
}

export interface ParsedCard {
  character: Character;
  lorebook?: Lorebook;
}

export function cardToCharacter(data: CardV2Data, avatar?: string): ParsedCard {
  const now = Date.now();
  const character: Character = {
    id: uid(),
    name: data.name?.trim() || 'Unnamed',
    avatar,
    description: data.description ?? '',
    personality: data.personality ?? '',
    scenario: data.scenario ?? '',
    firstMes: data.first_mes ?? '',
    mesExample: data.mes_example ?? '',
    creatorNotes: data.creator_notes ?? '',
    systemPrompt: data.system_prompt ?? '',
    postHistoryInstructions: data.post_history_instructions ?? '',
    alternateGreetings: data.alternate_greetings ?? [],
    tags: data.tags ?? [],
    creator: data.creator ?? '',
    characterVersion: data.character_version ?? '1.0',
    favorite: false,
    createdAt: now,
    updatedAt: now,
  };
  const lorebook = data.character_book?.entries?.length
    ? bookToLorebook(data.character_book, character.name)
    : undefined;
  if (lorebook) character.lorebookId = lorebook.id;
  return { character, lorebook };
}

export function characterToCard(character: Character, lorebook?: Lorebook): { spec: string; spec_version: string; data: CardV2Data } & CardV2Data {
  const data: CardV2Data = {
    name: character.name,
    description: character.description,
    personality: character.personality,
    scenario: character.scenario,
    first_mes: character.firstMes,
    mes_example: character.mesExample,
    creator_notes: character.creatorNotes,
    system_prompt: character.systemPrompt,
    post_history_instructions: character.postHistoryInstructions,
    alternate_greetings: character.alternateGreetings,
    tags: character.tags,
    creator: character.creator,
    character_version: character.characterVersion,
    character_book: lorebook ? lorebookToBook(lorebook) : undefined,
    extensions: {},
  };
  // V1 fields are duplicated at the top level so older tools can still read it.
  return { spec: 'chara_card_v2', spec_version: '2.0', data, ...data };
}

function unwrapCard(raw: unknown): CardV2Data | null {
  if (!raw || typeof raw !== 'object') return null;
  const record = raw as Record<string, unknown>;
  if (record.data && typeof record.data === 'object') return record.data as CardV2Data;
  if (typeof record.name === 'string' || typeof record.description === 'string') return record as CardV2Data;
  return null;
}

/** Reads a character card from a PNG (embedded tEXt) or a plain JSON file. */
export async function readCardFile(file: File): Promise<ParsedCard> {
  const buffer = new Uint8Array(await file.arrayBuffer());
  const isPng = PNG_SIGNATURE.every((byte, index) => buffer[index] === byte);

  if (!isPng) {
    const json = JSON.parse(new TextDecoder().decode(buffer));
    const data = unwrapCard(json);
    if (!data) throw new Error('Unrecognised character card');
    return cardToCharacter(data);
  }

  const chunks = readChunks(buffer);
  let payload: CardV2Data | null = null;
  for (const keyword of ['ccv3', 'chara']) {
    for (const chunk of chunks) {
      const text = parseTextChunk(chunk);
      if (text?.keyword !== keyword) continue;
      try {
        const decoded = new TextDecoder().decode(base64ToBytes(text.text));
        payload = unwrapCard(JSON.parse(decoded));
      } catch {
        /* try the next chunk */
      }
      if (payload) break;
    }
    if (payload) break;
  }
  if (!payload) throw new Error('This PNG has no embedded character card');

  const avatar = `data:image/png;base64,${bytesToBase64(buffer)}`;
  return cardToCharacter(payload, avatar);
}

/** Writes the card JSON into the avatar PNG so it can be shared anywhere. */
export async function writeCardPng(character: Character, lorebook?: Lorebook): Promise<Blob> {
  const card = characterToCard(character, lorebook);
  const json = JSON.stringify(card);
  const encoded = bytesToBase64(new TextEncoder().encode(json));

  const source = character.avatar ?? (await placeholderPng(character.name));
  const pngBytes = await dataUrlToPng(source);
  const chunks = readChunks(pngBytes);

  const parts: Uint8Array[] = [new Uint8Array(PNG_SIGNATURE)];
  let injected = false;
  for (const chunk of chunks) {
    const text = parseTextChunk(chunk);
    // drop any card the source image already carried
    if (text && (text.keyword === 'chara' || text.keyword === 'ccv3')) continue;
    if (!injected && (chunk.type === 'IDAT' || chunk.type === 'IEND')) {
      parts.push(textChunk('chara', encoded));
      injected = true;
    }
    parts.push(buildChunk(chunk.type, chunk.data));
  }
  if (!injected) parts.push(textChunk('chara', encoded));

  const size = parts.reduce((total, part) => total + part.length, 0);
  const out = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return new Blob([out.buffer as ArrayBuffer], { type: 'image/png' });
}

async function dataUrlToPng(dataUrl: string): Promise<Uint8Array> {
  if (dataUrl.startsWith('data:image/png;base64,')) {
    return base64ToBytes(dataUrl.slice('data:image/png;base64,'.length));
  }
  // Re-encode anything that is not already a PNG (webp avatars, remote URLs).
  const image = new Image();
  image.crossOrigin = 'anonymous';
  await new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = () => reject(new Error('Could not read the avatar image'));
    image.src = dataUrl;
  });
  const canvas = document.createElement('canvas');
  canvas.width = image.width || 512;
  canvas.height = image.height || 512;
  canvas.getContext('2d')?.drawImage(image, 0, 0);
  const png = canvas.toDataURL('image/png');
  return base64ToBytes(png.slice('data:image/png;base64,'.length));
}

async function placeholderPng(name: string): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const gradient = ctx.createLinearGradient(0, 0, 512, 512);
    gradient.addColorStop(0, '#7AB4F9');
    gradient.addColorStop(1, '#BBEBFB');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 512, 512);
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.font = '600 180px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText((name[0] ?? '?').toUpperCase(), 256, 266);
  }
  return canvas.toDataURL('image/png');
}
