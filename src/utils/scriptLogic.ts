import type { DialogueTtsPayload, SingleTtsPayload, VoiceName } from '../types/voiceover';

export const VALID_VOICES: ReadonlySet<VoiceName> = new Set([
  'Kore',
  'Puck',
  'Charon',
  'Fenrir',
  'Zephyr',
]);

export const MAX_SCRIPT_CHARS = 4000;
export const MAX_DIALOGUE_TURNS = 24;

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Strips scripted cue tags like <breath>, <laugh>, |mhm| for word counting
 * while tracking pause cues so duration estimation stays realistic.
 */
export function analyzeScript(text: string, wpm = 148): {
  words: number;
  characters: number;
  cueCount: number;
  estimatedSeconds: number;
} {
  const trimmed = text.trim();
  if (!trimmed) {
    return { words: 0, characters: 0, cueCount: 0, estimatedSeconds: 0 };
  }

  const vocalTagMatches = trimmed.match(/<(breath|laugh|gasp)>|\|[a-z]+\|/gi) ?? [];
  const ellipsisMatches = trimmed.match(/\.{3}/g) ?? [];
  const cueCount = vocalTagMatches.length + ellipsisMatches.length;

  const spokenText = trimmed
    .replace(/<(breath|laugh|gasp)>/gi, ' ')
    .replace(/\|([a-z]+)\|/gi, '$1')
    .replace(/\s+/g, ' ')
    .trim();

  const words = spokenText ? spokenText.split(' ').filter(Boolean).length : 0;
  const safeWpm = Math.max(80, Math.min(240, wpm));
  const baseSec = (words / safeWpm) * 60;
  const cueBonusSec = vocalTagMatches.length * 0.45 + ellipsisMatches.length * 0.55;
  const estimatedSeconds = Math.max(1, Math.round((baseSec + cueBonusSec) * 10) / 10);

  return {
    words,
    characters: trimmed.length,
    cueCount,
    estimatedSeconds,
  };
}

/**
 * Formats seconds as MM:SS.d for studio timecode displays.
 */
export function formatTimecode(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return '00:00.0';
  }
  const totalTenths = Math.round(seconds * 10);
  const tenths = totalTenths % 10;
  const totalWholeSeconds = Math.floor(totalTenths / 10);
  const mins = Math.floor(totalWholeSeconds / 60);
  const secs = totalWholeSeconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${tenths}`;
}

/**
 * Formats seconds as HH:MM:SS,mmm for SubRip (.srt) caption export.
 */
export function formatSrtTimestamp(seconds: number): string {
  const safe = Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
  const totalMs = Math.round(safe * 1000);
  const ms = totalMs % 1000;
  const totalSec = Math.floor(totalMs / 1000);
  const secs = totalSec % 60;
  const totalMin = Math.floor(totalSec / 60);
  const mins = totalMin % 60;
  const hours = Math.floor(totalMin / 60);
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
}

/**
 * Splits a voiceover script into sentence-aligned SRT caption cues proportional to word length.
 */
export function buildSrtFromScript(script: string, totalDurationSec: number): string {
  const cleaned = script
    .replace(/<(breath|laugh|gasp)>/gi, '')
    .replace(/\|([a-z]+)\|/gi, '$1')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) {
    return '';
  }

  const safeDuration = Math.max(0.5, Number.isFinite(totalDurationSec) ? totalDurationSec : 1);
  const rawSegments = cleaned
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const segments = rawSegments.length > 0 ? rawSegments : [cleaned];
  const weights = segments.map((seg) => Math.max(1, seg.split(/\s+/).length));
  const totalWeight = weights.reduce((acc, w) => acc + w, 0);

  let cursor = 0;
  const blocks = segments.map((seg, idx) => {
    const share = (weights[idx] / totalWeight) * safeDuration;
    const start = cursor;
    const end = idx === segments.length - 1 ? safeDuration : Math.min(safeDuration, cursor + share);
    cursor = end;
    return `${idx + 1}\n${formatSrtTimestamp(start)} --> ${formatSrtTimestamp(end)}\n${seg}`;
  });

  return `${blocks.join('\n\n')}\n`;
}

/**
 * Inserts a vocal cue token cleanly at a cursor offset inside a script string.
 */
export function insertCueAtCursor(
  script: string,
  cue: string,
  selectionStart: number,
  selectionEnd: number,
): { nextText: string; nextCursor: number } {
  const start = Math.max(0, Math.min(script.length, selectionStart));
  const end = Math.max(start, Math.min(script.length, selectionEnd));
  const before = script.slice(0, start);
  const after = script.slice(end);

  const needsLeadingSpace = before.length > 0 && !/\s$/.test(before);
  const needsTrailingSpace = after.length > 0 && !/^\s/.test(after);
  const insertion = `${needsLeadingSpace ? ' ' : ''}${cue}${needsTrailingSpace ? ' ' : ''}`;
  const nextText = `${before}${insertion}${after}`;
  const nextCursor = before.length + insertion.length;
  return { nextText, nextCursor };
}

export function validateSingleTtsPayload(payload: Partial<SingleTtsPayload>): ValidationResult {
  const text = typeof payload.text === 'string' ? payload.text.trim() : '';
  if (!text) {
    return { valid: false, error: 'Enter a script before generating a voiceover.' };
  }
  if (text.length > MAX_SCRIPT_CHARS) {
    return {
      valid: false,
      error: `Script exceeds the ${MAX_SCRIPT_CHARS.toLocaleString()} character limit.`,
    };
  }
  if (!payload.voiceName || !VALID_VOICES.has(payload.voiceName)) {
    return { valid: false, error: 'Select a valid studio voice.' };
  }
  if (payload.engine && payload.engine !== 'standard' && payload.engine !== 'expressive') {
    return { valid: false, error: 'Invalid TTS engine selected.' };
  }
  return { valid: true };
}

export function validateDialogueTtsPayload(payload: Partial<DialogueTtsPayload>): ValidationResult {
  if (!payload.speakerA || !payload.speakerB) {
    return { valid: false, error: 'Both Speaker A and Speaker B must be configured.' };
  }
  const nameA = payload.speakerA.name?.trim();
  const nameB = payload.speakerB.name?.trim();
  if (!nameA || !nameB) {
    return { valid: false, error: 'Provide names for both speakers.' };
  }
  if (nameA.toLowerCase() === nameB.toLowerCase()) {
    return { valid: false, error: 'Speaker A and Speaker B must have distinct names.' };
  }
  if (!VALID_VOICES.has(payload.speakerA.voiceName) || !VALID_VOICES.has(payload.speakerB.voiceName)) {
    return { valid: false, error: 'Select valid voices for both speakers.' };
  }
  const turns = Array.isArray(payload.turns)
    ? payload.turns.filter((t) => typeof t.text === 'string' && t.text.trim().length > 0)
    : [];
  if (turns.length === 0) {
    return { valid: false, error: 'Add at least one line of dialogue before generating.' };
  }
  if (turns.length > MAX_DIALOGUE_TURNS) {
    return { valid: false, error: `Dialogue cannot exceed ${MAX_DIALOGUE_TURNS} turns.` };
  }
  const totalChars = turns.reduce((sum, t) => sum + t.text.trim().length, 0);
  if (totalChars > MAX_SCRIPT_CHARS) {
    return {
      valid: false,
      error: `Combined dialogue exceeds the ${MAX_SCRIPT_CHARS.toLocaleString()} character limit.`,
    };
  }
  return { valid: true };
}
