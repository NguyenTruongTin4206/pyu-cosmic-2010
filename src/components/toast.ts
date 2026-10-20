import { $ } from '../utils';

let timer = 0;
/** Thông báo nhỏ ở giữa màn hình. ms = 0 thì giữ đến khi gọi hideToast() */
export function toast(msg: string, ms = 3200): void {
  const el = $('toast'); el.textContent = msg; el.hidden = false;
  requestAnimationFrame(() => el.classList.add('show'));
  window.clearTimeout(timer);
  if (ms > 0) timer = window.setTimeout(hideToast, ms);
}
export function hideToast(): void {
  const el = $('toast'); window.clearTimeout(timer); el.classList.remove('show');
  timer = window.setTimeout(() => { el.hidden = true; }, 300);
}
