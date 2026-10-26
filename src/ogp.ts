import { readSongUrl } from './state/url-syntax';
import { validateSong } from './state/song-fields';

export const SITE_ORIGIN = 'https://chords.kani3camp.com';
export const DEFAULT_TITLE = 'ギターコード一覧｜練習ワークスペース';
export const DEFAULT_DESCRIPTION = '曲のギターコードを、好きな押さえ方で一画面に。登録不要、リンクだけで保存・共有できます。';
export const IMAGE_ALT = 'ギターコード一覧 — 好きな押さえ方で、一画面に。';
export const CARD_IMAGE_PATH = '/og/card.png';
const isNC = (name: string) => /^(N\.C\.|NC)$/.test(name);
const signed = (n: number) => n < 0 ? '−' + Math.abs(n) : n > 0 ? '+' + n : '0';

export type CardImageData = {
  name: string;
  count: number;
  nc: boolean;
  capo: number;
  shift: number;
};
export type SocialMetadata = { title: string; description: string; card?: CardImageData };

function cleanTitle(value: string): string {
  const points = [...value.replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu, '').trim()];
  return points.slice(0, 80).join('') + (points.length > 80 ? '…' : '');
}

export function metadata(url: string): SocialMetadata {
  try {
    const parsed = readSongUrl(url);
    if (!parsed) return { title: DEFAULT_TITLE, description: DEFAULT_DESCRIPTION };
    const { song, tokens, forms } = parsed;
    validateSong(song);
    // Only syntax here. Registration, playing-key membership and conflicts stay in React.
    if ([...tokens, ...forms].some(t => isNC(t.name) && t.form) || forms.some(t => !t.form)) throw new Error('Invalid form syntax');
    const names = new Set(tokens.map(t => t.name));
    const count = [...names].filter(n => !isNC(n)).length;
    const nc = [...names].some(isNC);
    const summary = count ? '使用コード' + count + '種類' + (nc ? ' + N.C.' : '') : 'N.C.のみ';
    const name = cleanTitle(song.title);
    const shift = song.sourceShift + song.shift;
    return {
      title: name ? name + '｜ギターコード一覧' : DEFAULT_TITLE,
      description: summary + '｜' + (song.capo ? 'カポ' + song.capo : 'カポなし') + '｜移調' + signed(shift) + '｜好きな押さえ方でギターコードを一覧表示。',
      card: name ? { name, count, nc, capo: song.capo, shift } : undefined,
    };
  } catch {
    return { title: DEFAULT_TITLE, description: DEFAULT_DESCRIPTION };
  }
}

export function cardImageUrl(data: SocialMetadata): string {
  if (!data.card) return SITE_ORIGIN + '/og.png';
  const { name, count, nc, capo, shift } = data.card;
  const params = new URLSearchParams({ v:'1', t:name, n:String(count), nc:nc ? '1' : '0', c:String(capo), s:String(shift) });
  return SITE_ORIGIN + CARD_IMAGE_PATH + '?' + params;
}

export function readCardImageQuery(url: string): CardImageData | null {
  try {
    const params = new URL(url).searchParams;
    const keys = new Set(['v', 't', 'n', 'nc', 'c', 's']);
    if ([...params.keys()].some(key => !keys.has(key) || params.getAll(key).length !== 1)) return null;
    if ([...keys].some(key => !params.has(key)) || params.get('v') !== '1') return null;
    const raw = params.get('t')!;
    const name = cleanTitle(raw);
    if (!name || raw !== name) return null;
    const integer = (key: string, min: number, max: number) => {
      const value = params.get(key)!;
      if (!/^(0|-?[1-9]\d*)$/.test(value)) return null;
      const n = Number(value);
      return Number.isSafeInteger(n) && n >= min && n <= max ? n : null;
    };
    const count = integer('n', 0, 200);
    const capo = integer('c', 0, 12);
    const shift = integer('s', -48, 48);
    const nc = params.get('nc');
    if (count === null || capo === null || shift === null || (count === 0 && nc !== '1') || !['0', '1'].includes(nc!)) return null;
    return { name, count, nc: nc === '1', capo, shift };
  } catch {
    return null;
  }
}

export const escapeHtml = (s: string) => s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function socialTags(url: string, data: SocialMetadata) {
  const shared = new URL(url);
  shared.protocol = 'https:';
  shared.hash = '';
  const image = cardImageUrl(data);
  const imageAlt = data.card ? data.card.name + '｜ギターコード一覧' : IMAGE_ALT;
  const og = {title:data.title,description:data.description,type:'website',site_name:'ギターコード一覧',locale:'ja_JP',url:shared.href,image,'image:width':'1200','image:height':'630','image:alt':imageAlt};
  const twitter = {card:'summary_large_image',title:data.title,description:data.description,image,'image:alt':imageAlt};
  return Object.entries(og).map(([k,v]) => '<meta property="og:' + k + '" content="' + escapeHtml(v) + '">').join('')
    + Object.entries(twitter).map(([k,v]) => '<meta name="twitter:' + k + '" content="' + escapeHtml(v) + '">').join('');
}
