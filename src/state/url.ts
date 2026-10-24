import { canonicalName, parseChord, parseInput } from '../domain/chords';
import { nameFromKey } from '../catalog/validation';
import { buildIncoming, emptySong, keysOf, validateSong, type Incoming, type Preferences, type Song } from './song';
export const MAX_URL_BYTES = 7168;
export const byteLength = (url: string) => new TextEncoder().encode(url).length;
export function validateUrlLength(url: string) { if (byteLength(url)>MAX_URL_BYTES) throw new Error(`リンクが上限${MAX_URL_BYTES.toLocaleString()}バイトを超えます（${byteLength(url).toLocaleString()}バイト）。編集全体を確定しませんでした。曲名や出典URLを短くしてください。`); }
export function serialize(s: Song, base: string): string {
  validateSong(s);
  const p = new URLSearchParams();
  p.set('v','1'); p.set('codes',s.codes.join(',')); p.set('mode',s.mode); p.set('capo',String(s.capo));
  p.set('sourceShift',String(s.sourceShift)); p.set('shift',String(s.shift)); p.set('sort',s.sort);
  const forms = keysOf(s).flatMap(k => s.forms[k] !== undefined ? [`${nameFromKey(k)}@${s.forms[k]}`] : []);
  if (forms.length) p.set('forms',forms.join(','));
  if (s.title) p.set('title',s.title);
  if (s.src) p.set('src',s.src);
  const u = new URL(base); u.search = p.toString(); u.hash='';
  const result = u.href; validateUrlLength(result); return result;
}
export function parseUrl(url: string, prefs: Preferences): Incoming | null {
  const u = new URL(url);
  if (!u.search) return null;
  validateUrlLength(url);
  for (const part of u.search.slice(1).split('&')) for (const component of part.split('=')) {
    try { decodeURIComponent(component.replace(/\+/g,' ')); } catch { throw new Error('URLのパーセントエンコードが不正です。'); }
  }
  const p = u.searchParams;
  for (const k of new Set(p.keys())) if (new Set(p.getAll(k)).size>1) throw new Error(`URLの ${k} が重複し、値が競合しています。`);
  if (p.get('v') !== '1') throw new Error('このURLのバージョンに対応していません。v=1を指定してください。');
  if (!p.has('codes') || !p.has('mode')) throw new Error('URLに必須の codes または mode がありません。');
  const integer = (key: string, fallback=0) => {
    const v=p.get(key); if(v===null) return fallback;
    if (!/^-?(0|[1-9][0-9]*)$/.test(v)) throw new Error(`${key} は整数で指定してください。`);
    return Number(v);
  };
  const song: Song = {...emptySong(), mode:p.get('mode') as Song['mode'],capo:integer('capo'),sourceShift:integer('sourceShift'),shift:integer('shift'),sort:(p.get('sort')??'first') as Song['sort'],title:p.get('title')??'',src:p.get('src')??''};
  const incoming = buildIncoming(parseInput(p.get('codes')!),song,prefs,p.has('forms')?parseInput(p.get('forms')!):[]);
  // Validate keys through the parser, not text substitution of accidentals.
  for (const raw of incoming.song.codes) { const c=parseChord(raw); if(c?.known) canonicalName(c); }
  return incoming;
}
