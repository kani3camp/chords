import { parseInput } from '../src/domain/input';
import { validateSong } from '../src/state/song-fields';
import { validateUrlLength } from '../src/state/url-limits';

export type ExtractedSong = {
  codes: string[];
  title: string;
  src: string;
  capo: number;
  sourceShift: number;
  skipped: string[];
};

export function sourceSite(url: URL): 'ufret' | 'chordwiki' | null {
  if (url.protocol !== 'https:') return null;
  if (['ufret.jp', 'www.ufret.jp'].includes(url.hostname) && url.pathname === '/song.php' && /^\d+$/.test(url.searchParams.get('data') ?? '')) return 'ufret';
  if (!['chordwiki.org', 'ja.chordwiki.org'].includes(url.hostname)) return null;
  if (/^\/wiki\/.+/.test(url.pathname)) return 'chordwiki';
  if (url.pathname === '/wiki.cgi' && url.searchParams.get('t') && ['', 'view'].includes(url.searchParams.get('c') ?? '')) return 'chordwiki';
  return null;
}

export function normalizeChord(text: string): string | null {
  let name = text.trim().replace(/\s+/g, '').replace(/[♯＃]/g, '#').replace(/[♭ｂ]/g, 'b');
  if (name.startsWith('(') && name.endsWith(')')) name = name.slice(1, -1);
  if (/^N\.?C\.?$/i.test(name)) name = 'N.C.';
  try {
    const tokens = parseInput(name);
    return tokens.length === 1 && tokens[0].form === undefined ? tokens[0].name : null;
  } catch { return null; }
}

function integer(value: string | null | undefined, fallback: number, min: number, max: number): number {
  if (value == null) return fallback;
  const number = Number(value);
  if (!/^[+-]?\d+$/.test(value) || !Number.isInteger(number) || number < min || number > max) throw new Error('カポ・移調の設定を読み取れません。元サイトの設定を確認してください。');
  return number;
}

function cleanText(value: string | null | undefined) { return (value ?? '').replace(/\s+/g, ' ').trim(); }

/** Read only dedicated chord elements; never scan lyrics or page scripts. */
export function extractSong(doc: Document, url: URL): ExtractedSong | null {
  const site = sourceSite(url);
  if (!site) return null;
  let nodes: Element[];
  let title: string;
  let capo: number;
  let sourceShift: number;
  if (site === 'ufret') {
    const sheet = [...doc.querySelectorAll<HTMLElement>('.musical-sheet')].find(e => !e.hidden && !e.classList.contains('d-none') && e.style.display !== 'none');
    nodes = sheet ? [...sheet.querySelectorAll('.chord rt')] : [];
    title = [cleanText(doc.querySelector('h1')?.textContent), cleanText(doc.querySelector('.p-detail-head__artist')?.textContent)].filter(Boolean).join(' / ');
    const setting = doc.querySelector<HTMLInputElement>('input[name="key_scrollbar"]');
    // U-FRET stores both slider values with the opposite sign of their labels.
    const rawCapo = integer(setting?.value ?? sheet?.getAttribute('capo'), 0, -12, 2);
    if (rawCapo > 0) throw new Error('半音下げ・全音下げチューニングには未対応です。標準チューニングを選んでください。');
    capo = -rawCapo;
    sourceShift = -integer(doc.querySelector<HTMLInputElement>('input[name="key_capo"]')?.value, 0, -24, 24);
  } else {
    nodes = [...doc.querySelectorAll('.main .chord')];
    title = cleanText(doc.querySelector('.main h1, h1.title')?.textContent) || url.searchParams.get('t') || decodeURIComponent(url.pathname.slice('/wiki/'.length));
    sourceShift = integer(doc.querySelector<HTMLSelectElement>('select[name="key"]')?.value ?? url.searchParams.get('key'), 0, -24, 24);
    const capoLines = [...doc.querySelectorAll('.main p.key, .main p.comment')].map(e => cleanText(e.textContent)).filter(t => /capo|カポ/i.test(t));
    const positions = capoLines.map(line => {
      if (/\bcapo\s*[:：=]?\s*(?:none|なし)|カポ\s*[:：=]?\s*なし/i.test(line)) return 0;
      const match = line.match(/(?:\bcapo|カポ)\s*[:：=]?\s*(\d+)(?!\d)/i);
      if (!match) throw new Error('カポ位置を読み取れません。元サイトの表記を確認してください。');
      return integer(match[1], 0, 0, 12);
    });
    if (new Set(positions).size > 1) throw new Error('複数のカポ位置が記載されています。カポ位置を統一してから開いてください。');
    capo = positions[0] ?? 0;
  }
  const codes = new Set<string>();
  const skipped = new Set<string>();
  for (const node of nodes) {
    const raw = cleanText(node.textContent);
    if (!raw) continue;
    const name = normalizeChord(raw);
    if (name) codes.add(name);
    else skipped.add(raw);
  }
  // Retain only public song/view identifiers, not tracking or session parameters.
  const src = new URL(url.origin + url.pathname);
  for (const key of site === 'ufret' ? ['data'] : ['c', 't', 'key', 'symbol']) {
    const value = url.searchParams.get(key);
    if (value !== null) src.searchParams.set(key, value);
  }
  return { codes: [...codes], title, src: src.href, capo, sourceShift, skipped: [...skipped] };
}

export function songLink(song: ExtractedSong): string {
  if (!song.codes.length) throw new Error('コードの表示を待っています。譜面が表示されない場合はページを再読み込みしてください。');
  // Reuse the public input and URL guards, without loading the form catalog.
  for (const name of song.codes) {
    if (normalizeChord(name) !== name) throw new Error('コード名を読み取れません。');
  }
  validateSong({ ...song, mode: 'shape', shift: 0, sort: 'first', forms: {} });
  const url = new URL('https://chords.kani3camp.com/');
  url.search = new URLSearchParams({
    v: '1', codes: song.codes.join(','), mode: 'shape', capo: String(song.capo),
    sourceShift: String(song.sourceShift), shift: '0', sort: 'first', title: song.title, src: song.src,
  }).toString();
  validateUrlLength(url.href);
  return url.href;
}
