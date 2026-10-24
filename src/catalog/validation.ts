import { get as getType } from '@tonaljs/chord-type';
import { identity, mod, parseChord, pattern } from '../domain/chords';
import type { Voicing } from './schema';
export const TUNING = [40, 45, 50, 55, 59, 64];
const intervalSemitones = (i: string): number => {
  const match = i.match(/^(\d+)([PMmAd])$/);
  if (!match) throw new Error(`Unknown interval ${i}`);
  const degree = Number(match[1]); const base = [0, 2, 4, 5, 7, 9, 11][(degree - 1) % 7];
  const perfect = [1, 4, 5].includes((degree - 1) % 7 + 1);
  return mod(base + (match[2] === 'm' ? -1 : match[2] === 'A' ? 1 : match[2] === 'd' ? (perfect ? -1 : -2) : 0));
};
/** Named omissions only: rootless extended voicings and optional perfect fifth. */
export function validateVoicing(name: string, v: Voicing): string[] {
  const errors: string[] = []; const c = parseChord(name);
  if (!c || !c.known) return ['unknown chord quality'];
  if (v.frets.length !== 6 || v.fingers.length !== 6) return ['six strings required'];
  if (v.frets.some(f => !Number.isInteger(f) || f < -1 || f > 24)) errors.push('fret range');
  if (v.fingers.some((f, i) => !Number.isInteger(f) || f < 0 || f > 4 || (v.frets[i] <= 0 ? f !== 0 : f === 0))) errors.push('finger/fret mismatch');
  const midi = v.frets.flatMap((f, i) => f < 0 ? [] : [TUNING[i] + f]);
  if (midi.length < 2) return [...errors, 'insufficient sounding strings'];
  const rel = new Set(midi.map(m => mod(m - c.root)));
  const intervals = getType(c.quality === '' ? 'major' : c.quality).intervals.map(intervalSemitones);
  const allowed = new Set(intervals);
  if (c.bass !== null) allowed.add(mod(c.bass - c.root));
  if ([...rel].some(p => !allowed.has(p))) errors.push('non-chord tone');
  const required = intervals.filter(p => p !== 7 && !(p === 0 && intervals.length >= 4));
  if (required.some(p => !rel.has(p))) errors.push('missing characteristic tone');
  if (intervals.length <= 3 && !rel.has(0)) errors.push('missing triad root');
  if (c.bass !== null && mod(Math.min(...midi)) !== c.bass) errors.push('incorrect slash bass');
  if (pattern(v.frets) !== v.pattern) errors.push('noncanonical pattern');
  const groups = new Map<number, number[]>();
  v.fingers.forEach((f, i) => { if (f) groups.set(f, [...(groups.get(f) ?? []), i]); });
  for (const [finger, strings] of groups) {
    if (strings.length < 2) continue;
    const fret = v.frets[strings[0]];
    if (strings.some(i => v.frets[i] !== fret)) errors.push('same finger at different frets');
    if (!v.barres.some(b => b.finger === finger && b.fret === fret && b.from <= strings[0] && b.to >= strings.at(-1)!)) errors.push('missing barre');
  }
  for (const b of v.barres) {
    if (b.from < 0 || b.to > 5 || b.from >= b.to || b.fret <= 0 || b.finger < 1 || b.finger > 4) errors.push('invalid barre');
    for (let i = b.from; i <= b.to; i++) if (v.frets[i] >= 0 && v.frets[i] < b.fret) errors.push('barre crosses open/lower string');
  }
  const positive = v.frets.filter(f => f > 0);
  if (positive.length && Math.max(...positive) - Math.min(...positive) > 4) errors.push('excessive span');
  return [...new Set(errors)];
}
export function nameFromKey(key: string): string {
  const [root, quality, bass] = key.split('|');
  const names = ['C','Db','D','Eb','E','F','F#','G','Ab','A','Bb','B'];
  return names[Number(root)] + quality + (bass === '' ? '' : `/${names[Number(bass)]}`);
}
export function keyForName(name: string): string { const c = parseChord(name); if (!c) throw new Error(name); return identity(c); }
