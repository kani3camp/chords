import { validateSong } from './song-fields';
export { validateSong } from './song-fields';
import { canonicalName, identity, parseChord, parseInput, transpose, type Token } from '../domain/chords';
import { candidates, defaultForm, matchVoicing } from '../catalog';
import type { Voicing } from '../catalog/schema';
export type Preferences = Record<string, string>;
export type Song = {
  codes: string[]; mode: 'shape' | 'sound'; capo: number; sourceShift: number; shift: number;
  sort: 'first' | 'name'; title: string; src: string; forms: Record<string, string>;
};
export type Card = { raw: string; playing: string; sounding: string; key: string | null; form?: string; voicing?: Voicing; options: Voicing[]; warning?: string };
export type Conflict = { key: string; values: string[] };
export type Incoming = { song: Song; explicit: Record<string, string[]>; conflicts: Conflict[] };
export const emptySong = (): Song => ({ codes: [], mode:'shape', capo:0, sourceShift:0, shift:0, sort:'first', title:'', src:'', forms:{} });
export function playing(raw: string, s: Song) { return transpose(raw, s.shift - (s.mode === 'sound' ? s.capo : 0)); }
export function keyOf(raw: string, s: Song): string | null { const c = parseChord(playing(raw,s)); return c ? identity(c) : null; }
export function keysOf(s: Song): string[] { return [...new Set(s.codes.flatMap(raw => { const k = keyOf(raw,s); return k ? [k] : []; }))]; }
export function resolve(s: Song, prefs: Preferences, previous: Record<string,string> = {}): Song {
  const forms: Record<string,string> = {};
  for (const k of keysOf(s)) {
    const value = s.forms[k] ?? previous[k] ?? (prefs[k] && matchVoicing(k,prefs[k]) && matchVoicing(k,prefs[k])?.status !== 'invalid' ? prefs[k] : undefined) ?? defaultForm(k);
    if (value !== undefined) forms[k] = value;
  }
  return {...s, forms};
}
export function buildIncoming(tokens: Token[], base: Song, prefs: Preferences, extra: Token[] = [], previous: Record<string,string> = {}): Incoming {
  const song = {...base, codes:[...new Set(tokens.map(t=>t.name))], forms:{}};
  validateSong(song);
  const explicit: Record<string,string[]> = {};
  const add = (key: string | null, form: string) => { if (!key) throw new Error('N.C.に押さえ方は指定できません。'); explicit[key] = [...new Set([...(explicit[key] ?? []),form])]; };
  for (const token of tokens) if (token.form) add(keyOf(token.name,song),token.form);
  for (const token of extra) {
    if (!token.form) throw new Error('formsはコード名@6弦位置の形式で指定してください。');
    const c = parseChord(token.name); const key = c ? identity(c) : null;
    if (!key || !keysOf(song).includes(key)) throw new Error(`formsの「${token.name}」は現在の演奏用コードにありません。`);
    add(key,token.form);
  }
  const conflicts = Object.entries(explicit).filter(([,v])=>v.length>1).map(([key,values])=>({key,values}));
  const forms = Object.fromEntries(Object.entries(explicit).filter(([,v])=>v.length === 1).map(([k,v])=>[k,v[0]]));
  const resolved = resolve({...song,forms},prefs,previous);
  for (const {key} of conflicts) delete resolved.forms[key];
  return {song:resolved,explicit,conflicts};
}
export function fromInput(input: string, base: Song, prefs: Preferences, previous?: Record<string,string>): Incoming {
  return buildIncoming(parseInput(input),base,prefs,[],previous);
}
export function cards(s: Song, conflicts: Conflict[] = []): Card[] {
  const rows = s.codes.map(raw => {
    const name = playing(raw,s); const key = keyOf(raw,s); const options = key ? candidates(key) : [];
    const form = key ? s.forms[key] : undefined; const found = form && key ? matchVoicing(key,form) : undefined;
    let warning: string | undefined;
    if (!key) warning = 'N.C.（音を鳴らさない区間）';
    else if (conflicts.some(c=>c.key===key)) warning = '同じ音のコードに異なる押さえ方が指定されています。確認して選んでください。';
    else if (found?.status === 'invalid') warning = '過去のフォームに誤りが見つかりました。誤ったコード図は表示できません。' + (found.reason ?? '');
    else if (form && !found) warning = 'リンク指定のフォームに未対応です。登録済みの候補にないため、図は表示できません。';
    else if (!found) warning = 'フォーム未収録。このコードの押さえ方はまだ収録されていません。';
    return { raw, playing:name, sounding:transpose(raw,s.shift+(s.mode==='shape'?s.capo:0)),key,form,voicing:warning?undefined:found,options,warning };
  });
  return s.sort === 'name' ? rows.sort((a,b)=>a.playing.localeCompare(b.playing,'en')) : rows;
}
export type Difference = { key: string; name: string; external: string; fallback: string; };
export function differences(incoming: Incoming, prefs: Preferences): Difference[] {
  return Object.entries(incoming.explicit).flatMap(([key,values])=> {
    if (values.length !== 1) return [];
    const external = values[0]; const fallback = prefs[key] ?? defaultForm(key);
    if (!fallback || external === fallback || !matchVoicing(key,external) || matchVoicing(key,external)?.status === 'invalid') return [];
    const raw = incoming.song.codes.find(c=>keyOf(c,incoming.song)===key)!;
    return [{key,name:canonicalName(parseChord(playing(raw,incoming.song))!),external,fallback}];
  });
}
