// Production-only smoke check. Run by GitHub Actions after main quality checks.
// Cloudflare Workers Builds deploys separately, so retry briefly until the
// production edge serves the new per-song image rather than the old static OG.
import { createHash } from 'node:crypto';

const origin = 'https://chords.kani3camp.com';
const title = 'OGP画像確認-' + (process.env.GITHUB_SHA ?? 'manual').slice(0, 8);
const song = new URL(origin + '/');
song.search = new URLSearchParams({ v:'1', codes:'C,G,E/G#', mode:'shape', title }).toString();

const digest = bytes => createHash('sha256').update(bytes).digest('hex');
async function verify() {
  const htmlResponse = await fetch(song, { headers: {'User-Agent':'Discordbot/2.0'}, signal:AbortSignal.timeout(12000) });
  if (!htmlResponse.ok) throw new Error('Song HTML returned ' + htmlResponse.status);
  const html = await htmlResponse.text();
  const match = html.match(/<meta property="og:image" content="([^"]+)"/);
  if (!match) throw new Error('Missing og:image tag');
  const imageUrl = match[1].replaceAll('&amp;', '&');
  const image = new URL(imageUrl);
  if (image.origin !== origin || image.pathname !== '/og/card.png' || image.searchParams.get('t') !== title) {
    throw new Error('Expected this song in the deployed dynamic image URL: ' + image);
  }
  const [dynamicResponse, fallbackResponse] = await Promise.all([
    fetch(image, {signal:AbortSignal.timeout(12000)}),
    fetch(origin + '/og.png', {signal:AbortSignal.timeout(12000)}),
  ]);
  if (!dynamicResponse.ok || !fallbackResponse.ok) throw new Error('Image request failed');
  if (!dynamicResponse.headers.get('content-type')?.includes('image/png')) throw new Error('Dynamic image is not PNG');
  const [dynamic, fallback] = await Promise.all([dynamicResponse.arrayBuffer(),fallbackResponse.arrayBuffer()]);
  const png = new DataView(dynamic);
  const signature = new Uint8Array(dynamic,0,8);
  if (Array.from(signature).join(',') !== '137,80,78,71,13,10,26,10') throw new Error('Bad PNG signature');
  if (png.getUint32(16) !== 1200 || png.getUint32(20) !== 630) throw new Error('Wrong PNG dimensions');
  if (digest(Buffer.from(dynamic)) === digest(Buffer.from(fallback))) {
    throw new Error('Images Binding fell back to the static OG image instead of drawing this song');
  }
  console.log('Production OGP overlay generated for: ' + title + ' (' + dynamic.byteLength + ' bytes)');
}

let error;
for (let attempt = 1; attempt <= 12; attempt++) {
  try {
    await verify();
    process.exit(0);
  } catch (caught) {
    error = caught;
    console.log('Production OGP attempt ' + attempt + '/12: ' + String(caught));
    if (attempt < 12) await new Promise(resolve => setTimeout(resolve, 15000));
  }
}
throw error ?? new Error('Production image smoke check failed');
