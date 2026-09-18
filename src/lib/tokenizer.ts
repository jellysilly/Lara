/**
 * Token estimation without shipping a 2 MB BPE table.
 *
 * Every code point is weighted by script — Latin text packs ~3.7 characters
 * into a token, Cyrillic ~2.2, CJK about one. The result is then scaled by a
 * calibration factor that is nudged towards reality whenever a provider
 * reports real usage numbers, so the meter converges on the model you use.
 */

const CALIBRATION_KEY = 'lara.tokenizer.calibration';
const MESSAGE_OVERHEAD = 4;

let calibration = readCalibration();

function readCalibration(): number {
  try {
    const stored = Number(localStorage.getItem(CALIBRATION_KEY));
    return Number.isFinite(stored) && stored > 0.4 && stored < 2.5 ? stored : 1;
  } catch {
    return 1;
  }
}

function weightOf(code: number): number {
  // ASCII letters
  if ((code >= 0x41 && code <= 0x5a) || (code >= 0x61 && code <= 0x7a)) return 0.27;
  // digits
  if (code >= 0x30 && code <= 0x39) return 0.4;
  // whitespace — usually folded into the following token
  if (code === 0x20 || code === 0x09) return 0.04;
  if (code === 0x0a || code === 0x0d) return 0.35;
  // Latin-1 supplement + Latin extended
  if (code >= 0xc0 && code <= 0x24f) return 0.45;
  // Greek + Cyrillic
  if (code >= 0x370 && code <= 0x4ff) return 0.45;
  // Hebrew / Arabic
  if (code >= 0x590 && code <= 0x6ff) return 0.5;
  // CJK, Hiragana, Katakana, Hangul
  if (code >= 0x3040 && code <= 0xd7af) return 1;
  if (code >= 0xf900 && code <= 0xfaff) return 1;
  // emoji and other astral plane symbols
  if (code > 0xffff) return 2;
  // punctuation and everything else
  return 0.42;
}

const cache = new Map<string, number>();
let cachedCalibration = calibration;

function measure(text: string): number {
  let total = 0;
  for (const char of text) {
    total += weightOf(char.codePointAt(0) ?? 0);
  }
  return Math.max(1, Math.round(total * calibration));
}

export function estimateTokens(text: string): number {
  if (!text) return 0;
  // Short strings are cheaper to measure than to hash into a map.
  if (text.length < 240) return measure(text);

  if (cachedCalibration !== calibration) {
    cache.clear();
    cachedCalibration = calibration;
  }
  const hit = cache.get(text);
  if (hit !== undefined) return hit;

  const result = measure(text);
  if (cache.size > 500) cache.clear();
  cache.set(text, result);
  return result;
}

export function estimateMessageTokens(messages: { role: string; content: string }[]): number {
  return messages.reduce((sum, message) => sum + estimateTokens(message.content) + MESSAGE_OVERHEAD, 0);
}

/** Pulls the estimate towards a provider-reported count (exponential moving average). */
export function calibrate(estimated: number, actual: number): void {
  if (!estimated || !actual || actual < 20) return;
  const ratio = (actual / estimated) * calibration;
  if (!Number.isFinite(ratio) || ratio < 0.4 || ratio > 2.5) return;
  calibration = calibration * 0.85 + ratio * 0.15;
  try {
    localStorage.setItem(CALIBRATION_KEY, String(calibration));
  } catch {
    /* private mode — keep the in-memory value */
  }
}

export function getCalibration(): number {
  return calibration;
}

export function resetCalibration(): void {
  calibration = 1;
  try {
    localStorage.removeItem(CALIBRATION_KEY);
  } catch {
    /* ignore */
  }
}
