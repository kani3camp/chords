import { readSongUrl } from './state/url-syntax';
import { validateSong } from './state/song-fields';

export const SITE_ORIGIN = 'https://chords.kani3camp.com';
export const DEFAULT_TITLE = 'ギターコード一覧｜練習ワークスペース';
export const DEFAULT_DESCRIPTION = '曲のギターコードを、好きな押さえ方で一画面に。登録不要、リンクだけで保存・共有できます。';
export const IMAGE_ALT = 'ギターコード一覧 — 好きな押さえ方で、一画面に。';
const isNC = (name: string) => /^(N\.C\.|NC)$/.test(name);
const signed = (n: number) => n < 0 ? `−${Math.abs(n)}` : n > 0 ? `+${n}` : '0';

export function metadata(url: string) {
  try {
    const parsed = readSongUrl(url);
    if (!parsed) return { title:DEFAULT_TITLE, description:DEFAULT_DESCRIPTION };
    const { song, tokens, forms } = parsed;
    validateSong(song);
    // Only syntax here. Registration, playing-key membership and conflicts stay in React.
    if ([...tokens, ...forms].some(t => isNC(t.name) && t.form) || forms.some(t => !t.form)) throw new Error('Invalid form syntax');
    const names = new Set(tokens.map(t => t.name));
    const count = [...names].filter(n => !isNC(n)).length;
    const nc = [...names].some(isNC);
    const summary = count ? `使用コード${count}種類${nc ? ' + N.C.' : ''}` : 'N.C.のみ';
    // Strip control/format characters without changing the original song or URL.
    const points = [...song.title.replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu, '').trim()];
    const title = points.slice(0,80).join('') + (points.length > 80 ? '…' : '');
    return {
      title: title ? `${title}｜ギターコード一覧` : DEFAULT_TITLE,
      description: `${summary}｜${song.capo ? `カポ${song.capo}` : 'カポなし'}｜移調${signed(song.sourceShift + song.shift)}｜好きな押さえ方でギターコードを一覧表示。`,
    };
  } catch {
    return { title:DEFAULT_TITLE, description:DEFAULT_DESCRIPTION };
  }
}

export const escapeHtml = (s: string) => s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function socialTags(url: string, data: ReturnType<typeof metadata>) {
  const shared = new URL(url);
  shared.protocol = 'https:';
  shared.hash = '';
  const image = `${SITE_ORIGIN}/og.png`;
  const og = {title:data.title,description:data.description,type:'website',site_name:'ギターコード一覧',locale:'ja_JP',url:shared.href,image,'image:width':'1200','image:height':'630','image:alt':IMAGE_ALT};
  const twitter = {card:'summary_large_image',title:data.title,description:data.description,image,'image:alt':IMAGE_ALT};
  return Object.entries(og).map(([k,v]) => `<meta property="og:${k}" content="${escapeHtml(v)}">`).join('')
    + Object.entries(twitter).map(([k,v]) => `<meta name="twitter:${k}" content="${escapeHtml(v)}">`).join('');
}
