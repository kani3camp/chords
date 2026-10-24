import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { DEFAULT_DESCRIPTION, DEFAULT_TITLE, SITE_ORIGIN } from '../../src/ogp';
const query = (p: Record<string,string> = {}) => '/?' + new URLSearchParams({v:'1',codes:'C,G',mode:'shape',title:'流星群',...p});
const decode = (s: string) => s.replace(/&quot;/g,'"').replace(/&#(?:39|x27);/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
function meta(html: string, key: string) {
  const values = [...html.matchAll(/<meta\s[^>]*>/g)].filter(m => m[0].includes(`="${key}"`));
  expect(values, key).toHaveLength(1);
  return decode(values[0][0].match(/content="([^"]*)"/)![1]);
}
const title = (html: string) => decode(html.match(/<title>(.*?)<\/title>/s)![1]);

test('AC-68/70/71: raw HTTP has one complete metadata set for every user agent', async ({request}) => {
  const path = query({capo:'1',sourceShift:'-1',shift:'0',src:'https://example.com/private-source'});
  for (const agent of ['Discordbot/2.0','Mozilla/5.0','Twitterbot/1.0']) {
    const response = await request.get(path,{headers:{'User-Agent':agent}});
    expect(response.status()).toBe(200);
    const html = await response.text();
    for (const t of [title(html),meta(html,'og:title'),meta(html,'twitter:title')]) expect(t).toBe('流星群｜ギターコード一覧');
    const description = '使用コード2種類｜カポ1｜移調−1｜好きな押さえ方でギターコードを一覧表示。';
    for (const key of ['description','og:description','twitter:description']) expect(meta(html,key)).toBe(description);
    expect(meta(html,'og:url')).toBe(new URL(path,SITE_ORIGIN).href);
    for (const key of ['og:image','twitter:image']) expect(meta(html,key)).toBe(`${SITE_ORIGIN}/og.png`);
    for (const [key,value] of Object.entries({'og:type':'website','og:site_name':'ギターコード一覧','og:locale':'ja_JP','og:image:width':'1200','og:image:height':'630','twitter:card':'summary_large_image'})) expect(meta(html,key)).toBe(value);
    expect(meta(html,'og:image:alt')).toBe(meta(html,'twitter:image:alt'));
    expect(meta(html,'og:description')).not.toContain('private-source');
  }
});

test('AC-69/70: exact spelling, slash/tension syntax, NC, forms and total shift', async ({request}) => {
  for (const [params,expected] of [
    [{codes:'C,G,C,Db,C#,C7(b9,#11),N.C.'},'使用コード5種類 + N.C.｜カポなし｜移調0'],
    [{codes:'C@x32010,C@x35553,E/G#,C7(b9,#11),NC,N.C.',forms:'C@xxxxxx',sourceShift:'-2',shift:'5',capo:'12',mode:'sound'},'使用コード3種類 + N.C.｜カポ12｜移調+3'],
    [{codes:'N.C.,NC'},'N.C.のみ｜カポなし｜移調0'],
    [{codes:'C',forms:'G@320003'},'使用コード1種類｜カポなし｜移調0'],
  ] as [Record<string,string>,string][]) {
    expect(meta(await (await request.get(query(params))).text(),'og:description')).toContain(expected);
  }
});

test('AC-72: invalid URLs safely return generic HTML', async ({request}) => {
  const invalid = [
    '/', '/?title=ignored', query({v:'2'}), query({codes:''}), '/?v=1&mode=shape', '/?v=1&codes=C',
    query({codes:'C,,G'}), query({codes:'C7(b9,#11'}), query({codes:'lyrics'}),query({mode:'invalid'}),query({sort:'bad'}),
    query({capo:'13'}),query({capo:'-1'}),query({capo:'1.5'}),query({capo:'01'}),query({sourceShift:'25'}),query({shift:'-25'}),
    query()+'&capo=1&capo=2',query()+'&title=other',query()+'&title=%ZZ',query()+'&title=%E3%81',
    query({title:'a'.repeat(7200)}),query({src:'javascript:alert(1)'}),query({src:'https://user:pass@example.com'}),
    query({forms:'C'}),query({forms:'C@123'}),query({forms:'N.C.@xxxxxx'}),query({codes:'NC@xxxxxx'}),
  ];
  for (const path of invalid) {
    const response=await request.get(path);expect(response.status(),path.slice(0,100)).toBe(200);
    const html=await response.text();expect(meta(html,'og:title')).toBe(DEFAULT_TITLE);expect(meta(html,'og:description')).toBe(DEFAULT_DESCRIPTION);
  }
  for (const value of ['', '   ']) {
    const html=await (await request.get(query({title:value}))).text();
    expect(meta(html,'og:title')).toBe(DEFAULT_TITLE);expect(meta(html,'og:description')).toContain('使用コード2種類');
  }
  const omitted=await (await request.get('/?v=1&codes=C,G&mode=shape')).text();
  expect(meta(omitted,'og:title')).toBe(DEFAULT_TITLE);expect(meta(omitted,'og:description')).toContain('使用コード2種類');
});

test('AC-73: escaping, control removal and Unicode code point limit', async ({request}) => {
  const attack = '曲 & "\'><script>alert(1)</script> # 🎸';
  const html = await (await request.get(query({title:attack}))).text();
  expect(meta(html,'og:title')).toBe(`${attack}｜ギターコード一覧`);
  expect(title(html)).toBe(`${attack}｜ギターコード一覧`);
  expect(html).not.toContain('<script>alert(1)</script>');
  expect(html.match(/<script\b/g)).toHaveLength(1);
  const long=await (await request.get(query({title:' \n曲\u0000\u202e'+ '🎸'.repeat(90)}))).text();
  expect(meta(long,'og:title')).toBe('曲'+'🎸'.repeat(79)+'…｜ギターコード一覧');
});

test('AC-74: sequential and conditional requests cannot mix song metadata', async ({request}) => {
  for (const name of ['曲A','曲B','曲A']) {
    const response=await request.get(query({title:name,codes:name==='曲A'?'C':'C,G,Am'}),{headers:{'If-None-Match':'*','If-Modified-Since':new Date().toUTCString(),Range:'bytes=0-200'}});
    expect(response.status()).toBe(200); expect(response.headers()['cache-control']).toBe('no-store');expect(response.headers().etag).toBeUndefined();
    const html=await response.text();expect(meta(html,'og:title')).toBe(`${name}｜ギターコード一覧`);
    expect(meta(html,'og:description')).toContain(`使用コード${name==='曲A'?1:3}種類`);expect(new URL(meta(html,'og:url')).searchParams.get('title')).toBe(name);
  }
  const head=await request.head(query());expect(head.status()).toBe(200);expect(await head.body()).toHaveLength(0);
});

test('AC-71/75: PNG dimensions, assets, SPA and security headers', async ({request}) => {
  const config=JSON.parse(readFileSync('wrangler.jsonc','utf8'));
  expect(config.assets.run_worker_first).toEqual(['/']);
  expect(config.assets.not_found_handling).toBe('single-page-application');
  const png=await request.get('/og.png');expect(png.status()).toBe(200);expect(png.headers()['content-type']).toContain('image/png');
  const bytes=await png.body();expect(bytes.subarray(0,8).toString('hex')).toBe('89504e470d0a1a0a');expect(bytes.readUInt32BE(16)).toBe(1200);expect(bytes.readUInt32BE(20)).toBe(630);
  const root=await request.get(query());const html=await root.text();
  for (const path of ['/favicon.svg','/url-v1.md','/third-party-notices.txt',...Array.from(html.matchAll(/(?:src|href)="(\/assets\/[^" ]+)"/g),m=>m[1])]) {
    const asset=await request.get(path);expect(asset.status()).toBe(200);
    if(path.startsWith('/assets/')) expect(asset.headers()['cache-control']).toContain('immutable');
    expect(asset.headers()['referrer-policy']).toBe('no-referrer');
  }
  for(const response of [root,await request.get('/practice')]) {
    expect(response.status()).toBe(200);expect(response.headers()['referrer-policy']).toBe('no-referrer');
    expect(response.headers()['content-security-policy']).toContain("script-src 'self'");expect(response.headers()['x-content-type-options']).toBe('nosniff');expect(response.headers()['x-frame-options']).toBe('DENY');
  }
});

test('AC-67/74: Worker HTML boots and retains URL v1 state', async ({browser,baseURL}) => {
  const page=await browser.newPage();
  const path=query({title:'流星群',codes:'C,G',forms:'C@x32010',capo:'1',sourceShift:'-1',shift:'0'});
  await page.goto(new URL(path,baseURL).href);
  await expect(page.getByRole('heading',{level:1})).toHaveText('流星群');await expect(page).toHaveTitle('流星群｜ギターコード一覧');
  await expect(page.locator('.chord-card')).toHaveCount(2);
  const restored=new URL(page.url());expect(restored.searchParams.get('capo')).toBe('1');expect(restored.searchParams.get('sourceShift')).toBe('-1');expect(restored.searchParams.get('forms')).toContain('C@x32010');
  await page.reload();await expect(page.getByRole('heading',{level:1})).toHaveText('流星群');await page.close();
});
