export type MusicState = 'idle' | 'loading' | 'playing' | 'paused' | 'error';

export interface MusicPlayer { play: () => Promise<void>; toggle: () => void; setVolume: (v: number) => void; toggleMute: () => boolean; dispose: () => void }

/** Nhạc nền cố định: public/audio/nhac-nen.mp3 - tự phát và lặp vô hạn sau khi người xem bấm "Khám phá" */
export function createMusicPlayer(onStatus: (s: MusicState, msg: string) => void): MusicPlayer {
  const audio = new Audio();
  audio.loop = true; audio.volume = 0.6; audio.preload = 'auto';
  audio.src = `${import.meta.env.BASE_URL}audio/nhac-nen.mp3`; // bắt đầu tải sớm để sẵn sàng khi bấm nút
  const MISSING = 'Chưa có file nhạc nền';
  let want = false, missing = false, wasPlaying = false, armed = false;

  audio.addEventListener('waiting', () => onStatus('loading', 'Đang tải nhạc…'));
  audio.addEventListener('playing', () => onStatus('playing', 'Đang phát'));
  audio.addEventListener('pause', () => { if (!document.hidden && !audio.ended) onStatus('paused', 'Đã tạm dừng'); });
  audio.addEventListener('error', () => { missing = true; onStatus('error', MISSING); });

  // Nếu trình duyệt (Zalo, Safari...) chặn tự phát, nhạc sẽ bật ở lần chạm kế tiếp
  function armUnlock(): void {
    if (armed) return; armed = true;
    const evs = ['pointerdown', 'touchend', 'keydown'];
    const go = (): void => { armed = false; evs.forEach((e) => document.removeEventListener(e, go)); if (want && audio.paused) void audio.play().catch(() => undefined); };
    evs.forEach((e) => document.addEventListener(e, go, { passive: true }));
  }

  async function play(): Promise<void> {
    want = true;
    if (missing) { onStatus('error', MISSING); return; }
    try { await audio.play(); } catch (e) {
      const n = (e as DOMException).name;
      if (n === 'NotAllowedError') { onStatus('paused', 'Chạm vào màn hình để bật nhạc'); armUnlock(); }
      else if (n !== 'AbortError') onStatus('error', MISSING);
    }
  }

  // Tự tắt nhạc khi chuyển sang app khác / khóa màn hình, quay lại thì phát tiếp
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { wasPlaying = !audio.paused; if (wasPlaying) audio.pause(); }
    else { if (wasPlaying && want) void audio.play().catch(() => undefined); wasPlaying = false; }
  });

  return {
    play,
    toggle: () => { if (audio.paused) void play(); else { want = false; audio.pause(); } },
    setVolume: (v) => { audio.volume = Math.min(1, Math.max(0, v)); },
    toggleMute: () => { audio.muted = !audio.muted; return audio.muted; },
    dispose: () => { audio.pause(); audio.removeAttribute('src'); audio.load(); },
  };
}
