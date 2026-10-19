import type { MusicPlayer, MusicState } from './musicPlayer';
import { $ } from '../utils';

/** Cập nhật dòng trạng thái và nút phát theo trạng thái nhạc */
export function setMusicStatus(state: MusicState, msg: string): void {
  $('musicStatus').textContent = msg;
  const b = $<HTMLButtonElement>('playBtn'), on = state === 'playing';
  b.textContent = on ? '⏸' : '▶'; b.setAttribute('aria-label', on ? 'Tạm dừng nhạc' : 'Phát nhạc');
}

interface Handlers { music: MusicPlayer; onAutoRotate: (on: boolean) => void; onRestart: () => void }

export function bindControls(h: Handlers): void {
  const auto = $('autoBtn');
  auto.addEventListener('click', () => {
    const on = auto.getAttribute('aria-pressed') !== 'true'; auto.setAttribute('aria-pressed', String(on)); h.onAutoRotate(on);
  });
  $('playBtn').addEventListener('click', () => h.music.toggle());
  $('muteBtn').addEventListener('click', (e) => {
    const btn = e.currentTarget as HTMLElement, m = h.music.toggleMute();
    btn.textContent = m ? '🔇' : '🔊'; btn.setAttribute('aria-label', m ? 'Bật tiếng' : 'Tắt tiếng');
  });
  $<HTMLInputElement>('vol').addEventListener('input', (e) => h.music.setVolume(Number((e.target as HTMLInputElement).value) / 100));

  const help = $('help');
  $('helpBtn').addEventListener('click', () => { help.hidden = !help.hidden; });
  $('helpClose').addEventListener('click', () => { help.hidden = true; });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') help.hidden = true; });
  $('restartBtn').addEventListener('click', h.onRestart);
}
