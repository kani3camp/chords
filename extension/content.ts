import { extractSong, songLink, sourceSite } from './extract';
import { SONG_LINK_MESSAGE, type SongLinkResult } from './messages';

// Keep toolbar access available even after the in-page panel has been closed.
chrome.runtime.onMessage.addListener((message: unknown, sender, respond: (result: SongLinkResult) => void) => {
  if (sender.id !== chrome.runtime.id || message !== SONG_LINK_MESSAGE) return;
  try {
    const song = extractSong(document, new URL(location.href));
    if (!song) throw new Error('U-FRETまたはChordWikiの曲ページを開いてください。');
    respond({ ok: true, href: songLink(song), title: song.title, summary: `${song.codes.length}コード ／ カポ${song.capo} ／ 移調${song.sourceShift > 0 ? '+' : ''}${song.sourceShift}` });
  } catch (error) {
    respond({ ok: false, error: error instanceof Error ? error.message : 'コードを読み取れません。' });
  }
});

function mount() {
  if (!sourceSite(new URL(location.href)) || document.getElementById('kani3camp-chords-link')) return;
  const host = document.createElement('div');
  host.id = 'kani3camp-chords-link';
  // Shadow DOM keeps the two sites' styles and our panel independent.
  host.style.cssText = 'all:initial;position:fixed;right:16px;bottom:16px;z-index:2147483647;max-width:calc(100vw - 32px);';
  const shadow = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = `
    :host { color-scheme: light; }
    section { box-sizing:border-box;width:290px;max-width:calc(100vw - 32px);padding:14px 16px;background:#fff;color:#17241e;border:1px solid #c7d8ce;border-radius:12px;box-shadow:0 4px 24px #0002;font:13px/1.6 system-ui,sans-serif; }
    header { display:flex;align-items:center;justify-content:space-between;gap:12px; }
    strong { font-size:14px; }
    button { cursor:pointer;border:0;border-radius:4px;background:transparent;color:#44594d;font:inherit;padding:2px 6px; }
    button:focus-visible,a:focus-visible { outline:3px solid #eba83b;outline-offset:3px; }
    p { margin:6px 0 10px;overflow-wrap:anywhere; }
    a { display:block;text-align:center;padding:8px 12px;border-radius:7px;background:#1b6142;color:#fff;font-weight:700;text-decoration:none; }
    a[aria-disabled="true"] { background:#e3e9e5;color:#536259;cursor:default; }
    [hidden] { display:none; }
  `;
  const panel = document.createElement('section');
  panel.setAttribute('aria-label', 'chordsへのリンク');
  const header = document.createElement('header');
  const label = document.createElement('strong');
  label.textContent = 'ギターコード一覧';
  const close = document.createElement('button');
  close.type = 'button';
  close.textContent = '×';
  close.setAttribute('aria-label', 'chordsへのリンクを閉じる');
  const status = document.createElement('p');
  status.setAttribute('role', 'status');
  const link = document.createElement('a');
  link.setAttribute('role', 'link');
  link.textContent = 'chordsで開く ↗';
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  header.append(label, close);
  panel.append(header, status, link);
  shadow.append(style, panel);
  document.body.append(host);

  function refresh() {
    try {
      const song = extractSong(document, new URL(location.href));
      host.hidden = !song;
      if (!song) return;
      const href = songLink(song);
      if (link.getAttribute('href') !== href) link.href = href;
      link.removeAttribute('aria-disabled');
      const skipped = song.skipped.length ? ` ／ 注記など${song.skipped.length}件を除外` : '';
      const text = `${song.codes.length}コード ／ カポ${song.capo} ／ 移調${song.sourceShift > 0 ? '+' : ''}${song.sourceShift}${skipped}`;
      if (status.textContent !== text) status.textContent = text;
      status.title = song.skipped.length ? `除外: ${song.skipped.map(s => s.slice(0, 60)).join('、').slice(0, 300)}` : '表示中のコードを初出順にまとめます。歌詞はリンクに含めません。';
    } catch (error) {
      link.removeAttribute('href');
      link.setAttribute('aria-disabled', 'true');
      const text = error instanceof Error ? error.message : 'コードを読み取れません。';
      if (status.textContent !== text) status.textContent = text;
      status.removeAttribute('title');
    }
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  function schedule() {
    if (timer !== undefined) return;
    timer = setTimeout(() => { timer = undefined; refresh(); }, 200);
  }
  const roots = '.musical-sheet, .main, #key, .p-detail-head__ttl, .p-detail-head__artist, input[name="key_scrollbar"], input[name="key_capo"]';
  const observer = new MutationObserver(records => {
    if (records.some(record => {
      const parent = record.target instanceof Element ? record.target : record.target.parentElement;
      return parent?.closest(roots) || [...record.addedNodes, ...record.removedNodes].some(node => node instanceof Element && (node.matches(roots) || node.querySelector(roots)));
    })) schedule();
  });
  observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['class', 'style', 'hidden', 'capo', 'value'] });
  document.addEventListener('input', schedule, true);
  document.addEventListener('change', schedule, true);
  window.addEventListener('pageshow', schedule);
  window.addEventListener('popstate', schedule);
  close.addEventListener('click', () => {
    observer.disconnect();
    document.removeEventListener('input', schedule, true);
    document.removeEventListener('change', schedule, true);
    window.removeEventListener('pageshow', schedule);
    window.removeEventListener('popstate', schedule);
    clearTimeout(timer);
    host.remove();
  });
  // Refresh synchronously before following a link, including a middle click.
  for (const event of ['click', 'auxclick']) link.addEventListener(event, e => {
    refresh();
    if (!link.hasAttribute('href')) e.preventDefault();
  });
  refresh();
}

mount();
