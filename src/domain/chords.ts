import { get as getType } from '@tonaljs/chord-type';

export const NOTES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
export const mod = (n: number) => ((n % 12) + 12) % 12;
const NATURAL: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const aliases: Record<string, string> = { M: '', major: '', minor: 'm', M7: 'maj7', M79:'maj9', maj79:'maj9', '7b59':'9b5', 'Δ7': 'maj7', 'Δ': 'maj7', sus: 'sus4', 'm7-5': 'm7b5', 'ø': 'm7b5', 'ø7': 'm7b5', '°': 'dim', '°7': 'dim7', '+': 'aug', '69': '6/9', 'm69': 'm6/9', mmaj7: 'mMaj7', mmaj9: 'mMaj9', mmaj11: 'mMaj11', aug7: '7#5', aug9: '9#5' };
export type ParsedChord = { raw: string; root: number; quality: string; bass: number | null; known: boolean };
export const normalizeSymbols = (s: string) => s.replace(/[♯＃]/g, '#').replace(/[♭ｂ]/g, 'b');
export function pc(note: string): number {
  const m = normalizeSymbols(note).match(/^([A-G])([#b]?)$/);
  if (!m) throw new Error(`音名「${note}」が不正です。`);
  return mod(NATURAL[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0));
}
export function parseChord(raw: string): ParsedChord | null {
  const s = normalizeSymbols(raw);
  if (/^(N\.C\.|NC)$/i.test(s)) return null;
  const m = s.match(/^([A-G][#b]?)(.*)$/);
  if (!m) return null;
  let suffix = m[2]; let bass: number | null = null;
  const b = suffix.match(/\/([A-G][#b]?)$/);
  if (b) { bass = pc(b[1]); suffix = suffix.slice(0, -b[0].length); }
  const flat = suffix.replace(/[()]/g, '').replace(/,/g, '');
  const quality = aliases[flat] ?? flat;
  const type = getType(quality === '' ? 'major' : quality);
  return { raw, root: pc(m[1]), quality, bass, known: !type.empty };
}
export function identity(c: ParsedChord): string { return `${c.root}|${c.quality}|${c.bass ?? ''}`; }
export function canonicalName(c: ParsedChord): string { return NOTES[c.root] + c.quality + (c.bass === null ? '' : `/${NOTES[c.bass]}`); }
export function transpose(raw: string, semitones: number): string {
  if (mod(semitones) === 0) return raw;
  const s = normalizeSymbols(raw);
  const m = s.match(/^([A-G][#b]?)(.*)$/);
  if (!m) return raw;
  return NOTES[mod(pc(m[1]) + semitones)] + m[2].replace(/\/([A-G][#b]?)$/, (_, n: string) => `/${NOTES[mod(pc(n) + semitones)]}`);
}
export function shifted(raw: string, delta: number): ParsedChord | null { return parseChord(transpose(raw, delta)); }
export const pretty = (raw: string) => raw.replace(/#/g, '♯').replace(/b/g, '♭');

export { splitTokens, parsePattern, pattern, parseInput, type Token } from './input';
