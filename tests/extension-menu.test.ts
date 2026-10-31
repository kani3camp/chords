import { afterEach, describe, expect, it, vi } from 'vitest';
import { currentSongLink, SONG_LINK_MESSAGE } from '../extension/messages';

const result = { ok: true, href: 'https://chords.kani3camp.com/?v=1&codes=C%2CG&mode=shape', title: '練習曲', summary: '2コード ／ カポ0 ／ 移調0' };
function mockChrome() {
  const api = {
    tabs: { query: vi.fn().mockResolvedValue([{ id: 42 }]), sendMessage: vi.fn().mockResolvedValue(result), create: vi.fn().mockResolvedValue({}) },
    action: { openPopup: vi.fn().mockResolvedValue(undefined) },
  };
  vi.stubGlobal('chrome', api);
  return api;
}
afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

describe('toolbar song links', () => {
  it('asks only the current tab main frame for its current song', async () => {
    const api = mockChrome();
    expect(await currentSongLink()).toEqual(result);
    expect(api.tabs.query).toHaveBeenCalledWith({ active: true, currentWindow: true });
    expect(api.tabs.sendMessage).toHaveBeenCalledWith(42, SONG_LINK_MESSAGE, { frameId: 0 });
  });

  it('keeps extraction errors and explains tabs without a content script', async () => {
    const api = mockChrome();
    api.tabs.sendMessage.mockResolvedValueOnce({ ok: false, error: 'カポ位置を読み取れません。' });
    expect(await currentSongLink(9)).toEqual({ ok: false, error: 'カポ位置を読み取れません。' });
    expect(api.tabs.query).not.toHaveBeenCalled();
    api.tabs.sendMessage.mockRejectedValueOnce(new Error('No receiving end'));
    expect(await currentSongLink(9)).toMatchObject({ ok: false, error: expect.stringContaining('再読み込み') });
  });

  it('does not open arbitrary URLs from invalid responses', async () => {
    const api = mockChrome();
    for (const href of ['https://evil.example/?v=1&codes=C', 'javascript:alert(1)', 'https://chords.kani3camp.com/?v=1', 'https://user:password@chords.kani3camp.com/?v=1&codes=C']) {
      api.tabs.sendMessage.mockResolvedValueOnce({ ...result, href });
      expect(await currentSongLink(42)).toMatchObject({ ok: false });
    }
  });

  it('registers an action menu and opens the song from the clicked tab', async () => {
    const api = mockChrome();
    let installed = () => {};
    let clicked: (info: { menuItemId: string }, tab?: { id: number }) => void = () => {};
    const create = vi.fn();
    vi.stubGlobal('chrome', {
      ...api,
      runtime: { onInstalled: { addListener: (callback: () => void) => { installed = callback; } } },
      contextMenus: {
        removeAll: (callback: () => void) => callback(), create,
        onClicked: { addListener: (callback: typeof clicked) => { clicked = callback; } },
      },
    });
    await import('../extension/background');
    installed();
    expect(create).toHaveBeenCalledWith({ id: 'chords-open-current-song', title: 'この曲をchordsで開く', contexts: ['action'] });
    clicked({ menuItemId: 'other-menu' }, { id: 5 });
    expect(api.tabs.sendMessage).not.toHaveBeenCalled();
    clicked({ menuItemId: 'chords-open-current-song' }, { id: 5 });
    await vi.waitFor(() => expect(api.tabs.create).toHaveBeenCalledWith({ url: result.href }));
    expect(api.tabs.sendMessage).toHaveBeenCalledWith(5, SONG_LINK_MESSAGE, { frameId: 0 });
    expect(api.tabs.query).not.toHaveBeenCalled();
    api.tabs.sendMessage.mockResolvedValueOnce({ ok: false, error: '譜面の表示待ち' });
    clicked({ menuItemId: 'chords-open-current-song' }, { id: 5 });
    await vi.waitFor(() => expect(api.action.openPopup).toHaveBeenCalledOnce());
    expect(api.tabs.create).toHaveBeenCalledOnce();
  });
});
