import gsap from 'gsap';
import type { Wish } from '../data/wishes';
import { $, dur } from '../utils';

export interface WishPanel { open: (w: Wish) => void; close: () => void }

/** Chỉ có MỘT bảng duy nhất, tái sử dụng cho mọi lời chúc (không bao giờ chồng nhiều cửa sổ) */
export function createWishPanel(onClose: () => void): WishPanel {
  const el = $('panel'), title = $('panelTitle'), kind = $('panelKind'), wishEl = $('panelWish'), msg = $('panelMsg'), who = $('panelWho');
  const closeBtn = $<HTMLButtonElement>('panelClose');
  let isOpen = false, lastFocus: HTMLElement | null = null;

  function open(w: Wish): void {
    title.textContent = `${w.icon ?? ''} ${w.name}`.trim();
    kind.textContent = w.kind === 'planet' ? 'HÀNH TINH' : 'NGÔI SAO';
    wishEl.textContent = w.wish; msg.textContent = w.message;
    who.hidden = !w.memberName; who.textContent = w.memberName ? `Gửi tới ${w.memberName}` : '';
    el.style.setProperty('--accent', w.color);
    if (!isOpen) {
      isOpen = true; lastFocus = document.activeElement as HTMLElement | null;
      el.hidden = false; document.body.classList.add('panel-open');
      gsap.fromTo(el, { autoAlpha: 0, y: 24, scale: 0.96 }, { autoAlpha: 1, y: 0, scale: 1, duration: dur(0.55), ease: 'power3.out', overwrite: true });
    } else {
      gsap.fromTo(el.querySelectorAll('.pw'), { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: dur(0.4), stagger: 0.06, overwrite: true });
    }
    closeBtn.focus({ preventScroll: true });
  }
  function close(): void {
    if (!isOpen) return;
    isOpen = false; document.body.classList.remove('panel-open');
    gsap.to(el, { autoAlpha: 0, y: 16, duration: dur(0.35), ease: 'power2.in', overwrite: true, onComplete: () => { if (!isOpen) el.hidden = true; } });
    lastFocus?.focus({ preventScroll: true }); onClose();
  }
  closeBtn.addEventListener('click', close);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  return { open, close };
}
