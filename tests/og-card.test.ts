import { describe, expect, it } from 'vitest';
import { cardImageUrl, metadata, readCardImageQuery, SITE_ORIGIN } from '../src/ogp';
import { cardSummary, renderCardImage, titleLayout } from '../src/og-card';

const songUrl = (title = '虹色letters') =>
  SITE_ORIGIN + '/?' + new URLSearchParams({ v:'1', codes:'C,E/G#,C,Am7', mode:'shape', capo:'1', sourceShift:'-1', shift:'2', title });

describe('per-song OGP image data', () => {
  it('reuses validated OGP metadata without leaking original score URLs or forms', () => {
    const data = metadata(songUrl());
    const image = cardImageUrl(data);
    const url = new URL(image);
    expect(url.pathname).toBe('/og/card.png');
    expect(url.searchParams.get('t')).toBe('虹色letters');
    expect(url.searchParams.get('n')).toBe('3');
    expect(url.searchParams.get('nc')).toBe('0');
    expect(url.searchParams.get('c')).toBe('1');
    expect(url.searchParams.get('s')).toBe('1');
    expect(url.search).not.toContain('codes');
    expect(readCardImageQuery(image)).toEqual({ name:'虹色letters', count:3, nc:false, capo:1, shift:1 });
  });

  it('uses the brand image when no safe song title can be extracted', () => {
    expect(cardImageUrl(metadata(SITE_ORIGIN))).toBe(SITE_ORIGIN + '/og.png');
    expect(cardImageUrl(metadata(songUrl(' ')))).toBe(SITE_ORIGIN + '/og.png');
    expect(cardImageUrl(metadata(songUrl('<bad>') + '&capo=13'))).toBe(SITE_ORIGIN + '/og.png');
  });

  it('rejects malformed, duplicate, oversized and uncontrolled image inputs', () => {
    const good = cardImageUrl(metadata(songUrl()));
    expect(readCardImageQuery(good)).not.toBeNull();
    for (const suffix of ['&t=duplicate', '&unexpected=1', '&c=13', '&c=-1', '&n=-1', '&n=201', '&s=49', '&nc=2', '&t=%0Ainjected']) {
      expect(readCardImageQuery(good + suffix), suffix).toBeNull();
    }
    expect(readCardImageQuery(SITE_ORIGIN + '/og/card.png')).toBeNull();
    expect(readCardImageQuery(SITE_ORIGIN + '/og/card.png?v=1&t=hello&n=0&nc=0&c=0&s=0')).toBeNull();
    expect(readCardImageQuery(SITE_ORIGIN + '/og/card.png?v=1&t=' + 'A'.repeat(100) + '&n=1&nc=0&c=0&s=0')).toBeNull();
  });

  it('fits Japanese, English and very long titles in at most two lines', () => {
    expect(titleLayout('虹色letters')).toEqual({lines:['虹色letters'],size:60});
    const long = titleLayout('とても長い日本語のギターの曲名'.repeat(9));
    expect(long.size).toBe(36);
    expect(long.lines).toHaveLength(2);
    expect(long.lines.at(-1)).toMatch(/…$/);
    expect(cardSummary({name:'test',count:0,nc:true,capo:0,shift:0})).toContain('N.C.のみ');
    expect(cardSummary({name:'test',count:2,nc:false,capo:1,shift:-2})).toContain('移調−2');
  });
});

class MockHandle {
  constructor(private readonly drawn: Array<{left:number;top:number}>) {}
  transform(_options: {width:number;height:number;fit:'squeeze'}) { return this; }
  draw(_overlay: MockHandle, options: {left:number;top:number}) { this.drawn.push(options); return this; }
  async output(_options: {format:'image/png'}) {
    return { response: ({headers}: {headers?:HeadersInit} = {}) =>
      new Response('mock-png', {headers:{'Content-Type':'image/png', ...Object.fromEntries(new Headers(headers))}}) };
  }
}

describe('per-song PNG endpoint', () => {
  const imageUrl = () => cardImageUrl(metadata(songUrl()));
  function environment(failText = false) {
    const texts: string[] = [];
    const positions: Array<{left:number;top:number}> = [];
    const env = {
      ASSETS: { fetch: async () => new Response('static-png', {headers:{'Content-Type':'image/png'}}) },
      IMAGES: {
        input: (_stream: ReadableStream<Uint8Array>) => new MockHandle(positions),
        text: (value: string, _options: {font:{url:string};color:string;size:number}) => {
          if (failText) throw new Error('Images text unavailable');
          texts.push(value);
          return new MockHandle(positions);
        },
      },
    };
    return {env,texts,positions};
  }

  it('draws a cover, a Japanese song name and count/capo/shift over the original art', async () => {
    const {env,texts,positions} = environment();
    const response = await renderCardImage(new Request(imageUrl()), env);
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toContain('image/png');
    expect(response.headers.get('Cache-Control')).toContain('public');
    expect(texts).toContain('虹色letters');
    expect(texts.find(text => text.includes('使用コード3種類'))).toContain('カポ1');
    expect(positions[0]).toEqual({left:43,top:190});
    expect(positions).toHaveLength(3);
  });

  it('falls back to static PNG on image errors and invalid inputs', async () => {
    const {env} = environment(true);
    for (const path of [imageUrl(), SITE_ORIGIN + '/og/card.png?t=%0Abad']) {
      const response = await renderCardImage(new Request(path), env);
      expect(response.status).toBe(200);
      expect(response.headers.get('Cache-Control')).toBe('no-store');
      expect(await response.text()).toBe('static-png');
    }
  });

  it('does not perform image transformations for HEAD', async () => {
    const {env,texts} = environment();
    const response = await renderCardImage(new Request(imageUrl(), {method:'HEAD'}), env);
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('image/png');
    expect(await response.text()).toBe('');
    expect(texts).toHaveLength(0);
  });
});
