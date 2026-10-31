import { test as base, expect, type BrowserContext } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const extensionPath = fileURLToPath(new URL('../../dist-extension', import.meta.url));
const test = base.extend<{ extensionContext: BrowserContext }>({
  extensionContext: async ({ playwright }, use) => {
    const context = await playwright.chromium.launchPersistentContext('', {
      channel: 'chromium', headless: true,
      args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
    });
    await use(context);
    await context.close();
  },
});

// Original, lyric-free fixtures reproduce the DOM structure observed on 2026-10-30.
const ufret = `<!doctype html><html lang="ja"><meta charset="utf-8"><title>練習曲</title>
<h1 class="p-detail-head__ttl">練習曲 &amp; + #</h1><a class="p-detail-head__artist">テスト奏者</a>
<input name="key_scrollbar" type="range" min="-9" max="2" value="-2"><input name="key_capo" type="range" min="-5" max="6" value="-3">
<div id="my-chord-data" class="musical-sheet" capo="-2">
<p class="chord"><span><ruby><img><rt>C#</rt></ruby></span><span>歌詞の代わりの文字列</span></p>
<p class="chord"><ruby><rt>C7(b9,#11)</rt></ruby></p><p class="chord"><ruby><rt>Am</rt></ruby></p><p class="chord"><ruby><rt>C#</rt></ruby></p></div>
<div class="musical-sheet d-none"><p class="chord"><ruby><rt>F</rt></ruby></p></div>
<div class="chord"><ruby><rt>B</rt></ruby></div></html>`;
const chordwiki = `<!doctype html><html lang="ja"><meta charset="utf-8"><title>テスト</title>
<div id="key"><select name="key"><option value="0">0</option><option value="2" selected>+2</option></select></div>
<div class="main"><h1 class="title">練習の曲</h1><p class="key">Key: D</p><p class="line comment">Capo: 3 (原曲キーはF)</p>
<p class="line"><span class="chord">Intro</span><span class="chord">D</span><span class="word">歌詞の代わりの文字列</span><span class="chord">A/C♯</span><span class="chord">D</span><span class="chord">(N.C)</span></p></div>
<div class="chord">F</div></html>`;

async function fixture(context: BrowserContext, url: string, html: string) {
  await context.route(url, route => route.fulfill({ contentType: 'text/html; charset=utf-8', body: html }));
  const page = await context.newPage();
  await page.goto(url);
  return page;
}

async function toolbarPopup(context: BrowserContext) {
  const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
  const opened = context.waitForEvent('page');
  // An inactive extension tab runs the real popup without replacing the active song tab.
  await worker.evaluate(() => chrome.tabs.create({ url: chrome.runtime.getURL('popup.html'), active: false }));
  return opened;
}

test('toolbar popup links to the current song even after closing its page panel', async ({ extensionContext: context }) => {
  const page = await fixture(context, 'https://ja.chordwiki.org/wiki/ToolbarTest', chordwiki);
  const pageLink = page.getByRole('link', { name: 'chordsで開く' });
  await expect(pageLink).toHaveAttribute('href', /v=1/);
  const expected = await pageLink.getAttribute('href');
  await page.getByRole('button', { name: 'chordsへのリンクを閉じる' }).click();
  await page.bringToFront();
  const popup = await toolbarPopup(context);
  await expect(popup.getByRole('link', { name: 'この曲をchordsで開く' })).toHaveAttribute('href', expected!);
  await expect(popup.locator('#song-title')).toHaveText('練習の曲');
  await expect(popup.getByRole('status')).toContainText('カポ3');
  await expect(popup.getByRole('link', { name: 'chordsトップを開く' })).toHaveAttribute('href', 'https://chords.kani3camp.com/');
  await page.selectOption('select[name="key"]', '0');
  await page.bringToFront();
  await popup.getByRole('button', { name: '曲を再確認' }).click();
  await expect(popup.getByRole('status')).toContainText('移調0');
});

test('toolbar popup explains unsupported pages without a stale song link', async ({ extensionContext: context }) => {
  const page = await context.newPage();
  await page.goto('about:blank');
  await page.bringToFront();
  const popup = await toolbarPopup(context);
  await expect(popup.getByRole('status')).toContainText('曲ページを開いてください');
  await expect(popup.getByRole('link', { name: 'この曲をchordsで開く' })).not.toHaveAttribute('href');
  await expect(popup.getByRole('link', { name: 'chordsトップを開く' })).toHaveAttribute('href', 'https://chords.kani3camp.com/');
});

test('real extension injects a U-FRET link and opens the app with the same chords', async ({ extensionContext: context }) => {
  const url = 'https://www.ufret.jp/song.php?data=41&tracking=discard';
  const page = await fixture(context, url, ufret);
  const link = page.getByRole('link', { name: 'chordsで開く' });
  await expect(link).toBeVisible();
  const href = (await link.getAttribute('href'))!;
  const params = new URL(href).searchParams;
  expect(params.get('codes')).toBe('C#,C7(b9,#11),Am');
  expect(params.get('capo')).toBe('2');
  expect(params.get('sourceShift')).toBe('3');
  expect(params.get('title')).toBe('練習曲 & + # / テスト奏者');
  expect(params.get('src')).toBe('https://www.ufret.jp/song.php?data=41');
  expect(href).not.toContain(encodeURIComponent('歌詞'));
  await context.route('https://chords.kani3camp.com/**', route => route.fulfill({ status: 302, headers: { location: route.request().url().replace('https://chords.kani3camp.com', 'http://127.0.0.1:4175') } }));
  const popupPromise = page.waitForEvent('popup');
  await link.click();
  const popup = await popupPromise;
  await expect(popup.getByTestId('chord-card')).toHaveCount(3);
  await expect(popup.getByTestId('chord-card').first().getByRole('heading')).toHaveText('C♯');
  await expect(popup.getByLabel('カポ', { exact: true })).toHaveValue('2');
  await expect(popup.getByLabel('合計移調')).toHaveText('+3');
});

test('ChordWiki reads chord elements, capo, and transpose, and follows DOM updates', async ({ extensionContext: context }) => {
  const page = await fixture(context, 'https://chordwiki.org/wiki/Test?key=2', chordwiki);
  const link = page.getByRole('link', { name: 'chordsで開く' });
  await expect(link).toHaveAttribute('href', /codes=D%2CA%2FC%23%2CN.C./);
  let params = new URL((await link.getAttribute('href'))!).searchParams;
  expect(params.get('capo')).toBe('3');
  expect(params.get('sourceShift')).toBe('2');
  await expect(page.getByRole('status')).toContainText('注記など1件を除外');
  await page.selectOption('select[name="key"]', '0');
  await page.locator('.main .chord').nth(1).evaluate(e => { e.textContent = 'E'; });
  await expect(link).toHaveAttribute('href', /codes=E%2CA/);
  params = new URL((await link.getAttribute('href'))!).searchParams;
  expect(params.get('sourceShift')).toBe('0');
  await page.getByRole('button', { name: 'chordsへのリンクを閉じる' }).click();
  await expect(link).toHaveCount(0);
});

test('injects on Japanese ChordWiki and preserves its source URL', async ({ extensionContext: context }) => {
  const url = 'https://ja.chordwiki.org/wiki/%E3%83%95%E3%82%A1%E3%83%BC%E3%83%AB%E3%83%97%E3%83%AC%E3%83%BC%E3%81%AB%E3%81%8F%E3%82%89%E3%82%8A';
  const page = await fixture(context, url, chordwiki);
  const link = page.getByRole('link', { name: 'chordsで開く' });
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute('href', /codes=D%2CA%2FC%23%2CN.C./);
  const params = new URL((await link.getAttribute('href'))!).searchParams;
  expect(params.get('src')).toBe(url);
  expect(params.get('title')).toBe('練習の曲');
  expect(params.get('capo')).toBe('3');
  expect(params.get('sourceShift')).toBe('2');
  const cgi = await fixture(context, 'https://ja.chordwiki.org/wiki.cgi?c=view&t=Test', chordwiki);
  await expect(cgi.getByRole('link', { name: 'chordsで開く' })).toHaveAttribute('href', /v=1/);
  const edit = await fixture(context, 'https://ja.chordwiki.org/wiki.cgi?c=edit&t=Test', chordwiki);
  await expect(edit.locator('#kani3camp-chords-link')).toHaveCount(0);
});

test('waits for lazy-rendered sheets, responds to capo changes, and blocks down tuning', async ({ extensionContext: context }) => {
  const page = await fixture(context, 'https://www.ufret.jp/song.php?data=42', '<html><body><h1>遅延読み込み</h1></body></html>');
  const link = page.getByRole('link', { name: 'chordsで開く' });
  await expect(link).toHaveAttribute('aria-disabled', 'true');
  await page.evaluate(html => { document.body.insertAdjacentHTML('beforeend', html); }, ufret);
  await expect(link).toHaveAttribute('href', /capo=2/);
  await page.locator('input[name="key_scrollbar"]').evaluate((e: HTMLInputElement) => { e.value = '-4'; e.dispatchEvent(new Event('input', { bubbles: true })); });
  await expect(link).toHaveAttribute('href', /capo=4/);
  await page.locator('input[name="key_scrollbar"]').evaluate((e: HTMLInputElement) => { e.value = '1'; e.dispatchEvent(new Event('input', { bubbles: true })); });
  await expect(link).not.toHaveAttribute('href');
  await expect(page.getByRole('status')).toContainText('チューニングには未対応');
});

test('rejects long URLs and unrecognized capo without leaving a stale link', async ({ extensionContext: context }) => {
  const page = await fixture(context, 'https://chordwiki.org/wiki/Test', chordwiki);
  const link = page.getByRole('link', { name: 'chordsで開く' });
  await expect(link).toHaveAttribute('href', /v=1/);
  await page.locator('h1').evaluate(e => { e.textContent = '曲'.repeat(2000); });
  await expect(link).not.toHaveAttribute('href');
  await expect(page.getByRole('status')).toContainText('上限');
  await page.locator('h1').evaluate(e => { e.textContent = '練習曲'; });
  await expect(link).toHaveAttribute('href', /v=1/);
  await page.locator('.comment').evaluate(e => { e.textContent = 'Capo: ?'; });
  await expect(link).not.toHaveAttribute('href');
  await expect(page.getByRole('status')).toContainText('カポ位置を読み取れません');
});

test('does not inject on edit pages matched by the manifest', async ({ extensionContext: context }) => {
  const page = await fixture(context, 'https://chordwiki.org/wiki.cgi?c=edit&t=Test', chordwiki);
  await expect(page.locator('#kani3camp-chords-link')).toHaveCount(0);
});
