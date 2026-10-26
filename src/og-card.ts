import { readCardImageQuery, type CardImageData } from './ogp';

// Cloudflare Images rasterizes text server-side. Pin the OFL font release for
// Japanese glyph coverage. Font failures fall back to the pre-existing og.png.
const FONT_URL = 'https://cdn.jsdelivr.net/npm/@fontsource/noto-sans-jp@5.3.1/files/noto-sans-jp-japanese-700-normal.woff2';
const CREAM_PIXEL = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP49vnNfwAJjQPVxSFGJQAAAABJRU5ErkJggg==';
const CACHE_CONTROL = 'public, max-age=86400, s-maxage=86400';

interface ImageHandle {
  transform(options: { width: number; height: number; fit: 'squeeze' }): ImageHandle;
  draw(overlay: ImageHandle, options: { left: number; top: number }): ImageHandle;
  output(options: { format: 'image/png' }): Promise<{ response(options?: { headers: HeadersInit }): Response }>;
}
interface ImagesBinding {
  input(stream: ReadableStream<Uint8Array>): ImageHandle;
  text(content: string, options: { font: { url: string }; color: string; size: number }): ImageHandle;
}
export type CardEnv = {
  ASSETS: { fetch(request: Request): Promise<Response> };
  IMAGES?: ImagesBinding;
};

const glyphUnits = (value: string) => [...value].reduce((width, character) =>
  width + (/^[\x00-\x7f]$/.test(character) ? (/[ ilI.'!,]/.test(character) ? 0.3 : 0.57) : 1), 0);

/** Keep all text inside the left side of the original 1200x630 cover. */
export function titleLayout(name: string): { lines: string[]; size: number } {
  const width = glyphUnits(name);
  const size = width <= 10 ? 60 : width <= 24 ? 46 : 36;
  const maxUnits = size === 60 ? 10 : size === 46 ? 13.4 : 17;
  const lines: string[] = [];
  let line = '';
  let units = 0;
  const chars = [...name];
  for (const char of chars) {
    const weight = glyphUnits(char);
    if (line && units + weight > maxUnits) {
      lines.push(line.trimEnd());
      line = '';
      units = 0;
      if (lines.length === 2) break;
    }
    line += char;
    units += weight;
  }
  if (lines.length < 2 && line) lines.push(line.trimEnd());
  if (lines.length === 0) lines.push(' ');
  if (chars.length > [...lines.join('')].length) {
    const last = lines.length - 1;
    let remaining = lines[last];
    while (remaining && glyphUnits(remaining + '…') > maxUnits) remaining = [...remaining].slice(0, -1).join('');
    lines[last] = remaining + '…';
  }
  return { lines, size };
}

export function cardSummary(card: CardImageData): string {
  const count = card.count ? '使用コード' + card.count + '種類' + (card.nc ? ' + N.C.' : '') : 'N.C.のみ';
  return count + '  ｜  ' + (card.capo ? 'カポ' + card.capo : 'カポなし')
    + '  ｜  移調' + (card.shift > 0 ? '+' : card.shift < 0 ? '−' : '') + Math.abs(card.shift);
}

async function staticFallback(request: Request, env: CardEnv): Promise<Response> {
  const resource = new URL('/og.png', request.url);
  const asset = await env.ASSETS.fetch(new Request(resource, { method: request.method }));
  const headers = new Headers(asset.headers);
  // A transient image-rendering failure should not be cached as this song's card.
  headers.set('Cache-Control', 'no-store');
  return new Response(request.method === 'HEAD' ? null : asset.body, { status: asset.status, headers });
}

export async function renderCardImage(request: Request, env: CardEnv): Promise<Response> {
  const card = readCardImageQuery(request.url);
  if (!card || !env.IMAGES) return staticFallback(request, env);
  if (request.method === 'HEAD') {
    return new Response(null, { status: 200, headers: { 'Content-Type': 'image/png', 'Cache-Control': CACHE_CONTROL } });
  }
  try {
    const base = await env.ASSETS.fetch(new Request(new URL('/og.png', request.url)));
    if (!base.ok || !base.body) throw new Error('Missing original OG asset');
    const pixel = Uint8Array.from(atob(CREAM_PIXEL), character => character.charCodeAt(0));
    const cover = env.IMAGES.input(new Blob([pixel]).stream()).transform({ width: 740, height: 267, fit: 'squeeze' });
    let image = env.IMAGES.input(base.body).draw(cover, { left: 43, top: 190 });
    const text = (value: string, size: number, color: string) =>
      env.IMAGES!.text(value, { font: { url: FONT_URL }, size, color });
    const { lines, size } = titleLayout(card.name);
    const firstTop = lines.length === 1 ? 240 : 204;
    for (const [index, line] of lines.entries()) {
      image = image.draw(text(line, size, '#1c211e'), { left: 64, top: firstTop + index * (size + 15) });
    }
    image = image.draw(text(cardSummary(card), 24, '#5a615c'), { left: 64, top: 402 });
    const result = await image.output({ format: 'image/png' });
    return result.response({ headers: { 'Cache-Control': CACHE_CONTROL, 'X-Content-Type-Options': 'nosniff' } });
  } catch {
    // Font network errors, Images quota (9422) and image processing failures.
    return staticFallback(request, env);
  }
}
