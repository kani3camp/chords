import { validateUrlLength } from '../src/state/url-limits';

export const SONG_LINK_MESSAGE = 'chords:get-song-link:v1';
export type SongLinkResult = { ok: true; href: string; title: string; summary: string } | { ok: false; error: string };

export async function currentSongLink(tabId?: number): Promise<SongLinkResult> {
  try {
    if (tabId === undefined) {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      tabId = tab?.id;
    }
    if (tabId === undefined) throw new Error('現在のタブを見つけられません。');
    const response: unknown = await chrome.tabs.sendMessage(tabId, SONG_LINK_MESSAGE, { frameId: 0 });
    if (typeof response !== 'object' || response === null || !('ok' in response)) throw new Error('ページから応答がありません。');
    if (response.ok === false && 'error' in response && typeof response.error === 'string') return { ok: false, error: response.error };
    if (response.ok !== true || !('href' in response) || typeof response.href !== 'string' || !('title' in response) || typeof response.title !== 'string' || !('summary' in response) || typeof response.summary !== 'string') throw new Error('ページからの応答を読み取れません。');
    const url = new URL(response.href);
    if (url.origin !== 'https://chords.kani3camp.com' || url.pathname !== '/' || url.username || url.password || url.searchParams.get('v') !== '1' || !url.searchParams.get('codes')) throw new Error('リンク先を確認できません。');
    validateUrlLength(url.href);
    return { ok: true, href: url.href, title: response.title, summary: response.summary };
  } catch {
    return { ok: false, error: 'U-FRETまたはChordWikiの曲ページを開いてください。すでに開いている場合は、ページを再読み込みしてください。' };
  }
}
