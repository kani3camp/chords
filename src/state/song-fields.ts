import type { Song } from './song';
export function validateSong(s: Song) {
  if (!['shape','sound'].includes(s.mode)) throw new Error('入力モードが不正です。');
  if (!['first','name'].includes(s.sort)) throw new Error('並び順が不正です。');
  if (!Number.isInteger(s.capo) || s.capo < 0 || s.capo > 12) throw new Error('カポは0〜12の整数で指定してください。');
  if (![s.shift,s.sourceShift].every(v=>Number.isInteger(v) && Math.abs(v)<=24)) throw new Error('追加移調・元サイト移調はそれぞれ−24〜＋24の整数で指定してください。');
  if (s.src) {
    let url: URL; try { url = new URL(s.src); } catch { throw new Error('出典URLは完全なHTTP(S)のURLで入力してください。'); }
    if (!['https:','http:'].includes(url.protocol) || url.username || url.password) throw new Error('出典URLは認証情報を含まないHTTP(S)のみ使用できます。');
  }
}
