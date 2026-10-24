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

/** Top-level ASCII commas only; no dropping, guessing, or lyric extraction. */
export function splitTokens(input: string): string[] {
  if (!input.trim()) throw new Error('コード一覧が空です。');
  if ([...input].some(c=>c.charCodeAt(0)<32||c.charCodeAt(0)===127)) throw new Error('カンマ区切りの1行で入力してください（改行・制御文字は使えません）。');
  const tokens: string[] = []; let depth = 0; let start = 0;
  for (let i = 0; i < input.length; i++) {
    if (input[i] === '(') depth++;
    if (input[i] === ')' && --depth < 0) throw new Error('かっこ「( )」の対応が取れていません。');
    if (input[i] === ',' && depth === 0) { tokens.push(input.slice(start, i).trim()); start = i + 1; }
  }
  if (depth) throw new Error('かっこ「( )」の対応が取れていません。');
  tokens.push(input.slice(start).trim());
  const empty = tokens.findIndex(t => !t);
  if (empty !== -1) throw new Error(`${empty + 1}番目の項目が空です（「,,」など）。`);
  return tokens;
}
export function parsePattern(input: string): number[] {
  const value = input.toLowerCase();
  const parts = value.includes(':') ? value.split(':') : [...value];
  if (parts.length !== 6 || parts.some(p => !/^(x|0|[1-9][0-9]*)$/.test(p))) throw new Error(`押さえ方「${input}」は6弦→1弦の6項目で指定してください。`);
  const frets = parts.map(p => p === 'x' ? -1 : Number(p));
  if (frets.some(f => !Number.isSafeInteger(f))) throw new Error('フレットの値が大きすぎます。');
  return frets;
}
export const pattern = (frets: number[]) => frets.map(f => f < 0 ? 'x' : String(f)).join(frets.some(f => f > 9) ? ':' : '');
export type Token = { name: string; form?: string };
export function parseInput(input: string): Token[] {
  return splitTokens(input).map(t => {
    const at = t.split('@');
    if (at.length > 2 || !at[0].trim()) throw new Error(`「${t}」の @ 指定が不正です。`);
    const name = at[0].trim();
    if (!/^(?:[A-G][A-Za-z0-9#♯＃b♭ｂΔø°+\-(),/]*|N\.C\.|NC)$/.test(name)) throw new Error(`「${name}」をコード名として読み取れません。コード名のみ入力してください。`);
    return { name, ...(at.length === 2 ? { form: pattern(parsePattern(at[1].trim())) } : {}) };
  });
}
