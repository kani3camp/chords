import { parseInput } from '../domain/input';
import type { Song } from './song';
import { validateUrlLength } from './url-limits';

/** URL v1 syntax only: deliberately independent of the form catalog. */
export function readSongUrl(url: string) {
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
  const song: Song = {codes:[], mode:p.get('mode') as Song['mode'],capo:integer('capo'),sourceShift:integer('sourceShift'),shift:integer('shift'),sort:(p.get('sort')??'first') as Song['sort'],title:p.get('title')??'',src:p.get('src')??'', forms:{}};
  return { song, tokens:parseInput(p.get('codes')!), forms:p.has('forms')?parseInput(p.get('forms')!):[] };
}
