import { canonicalName, parseChord } from '../domain/chords';
import { nameFromKey } from '../catalog/validation';
import { buildIncoming, keysOf, validateSong, type Incoming, type Preferences, type Song } from './song';
import { validateUrlLength } from './url-limits';
export { MAX_URL_BYTES, byteLength, validateUrlLength } from './url-limits';
import { readSongUrl } from './url-syntax';
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
  const parsed = readSongUrl(url);
  if (!parsed) return null;
  const incoming = buildIncoming(parsed.tokens,parsed.song,prefs,parsed.forms);
  // Validate keys through the parser, not text substitution of accidentals.
  for (const raw of incoming.song.codes) { const c=parseChord(raw); if(c?.known) canonicalName(c); }
  return incoming;
}
