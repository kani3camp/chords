import { currentSongLink } from './messages';

const menuId = 'chords-open-current-song';
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: menuId, title: 'この曲をchordsで開く', contexts: ['action'] });
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== menuId) return;
  void openSong(tab?.id);
});

async function openSong(tabId?: number) {
  const result = await currentSongLink(tabId);
  if (result.ok) {
    await chrome.tabs.create({ url: result.href });
  } else {
    // The popup explains unsupported pages and extraction errors.
    await chrome.action.openPopup();
  }
}
