import { currentSongLink } from './messages';

const title = document.querySelector<HTMLElement>('#song-title')!;
const status = document.querySelector<HTMLElement>('#status')!;
const link = document.querySelector<HTMLAnchorElement>('#song-link')!;
const refresh = document.querySelector<HTMLButtonElement>('#refresh')!;

async function update() {
  refresh.disabled = true;
  link.removeAttribute('href');
  link.setAttribute('aria-disabled', 'true');
  title.textContent = '';
  status.textContent = '現在の曲を確認しています…';
  const result = await currentSongLink();
  if (result.ok) {
    title.textContent = result.title;
    status.textContent = result.summary;
    link.href = result.href;
    link.removeAttribute('aria-disabled');
  } else {
    status.textContent = result.error;
  }
  refresh.disabled = false;
}

refresh.addEventListener('click', () => { void update(); });
link.addEventListener('click', e => { if (!link.hasAttribute('href')) e.preventDefault(); });
void update();
