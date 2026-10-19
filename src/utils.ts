export const prefersReducedMotion = (): boolean => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
/** Thời lượng hoạt ảnh: gần như bằng 0 nếu người dùng bật "giảm chuyển động" */
export const dur = (s: number): number => (prefersReducedMotion() ? 0.01 : s);
export function $<T extends HTMLElement = HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Thiếu phần tử #${id} trong index.html`);
  return el as T;
}

/** Trình duyệt nhúng trong ứng dụng (Zalo, Facebook, Instagram...) thường yếu và hay bị giới hạn */
export const isInApp = (): boolean => /Zalo|FBAN|FBAV|Instagram|Line\/|MicroMessenger/i.test(navigator.userAgent);
export const isLowEnd = (): boolean => {
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  return window.matchMedia('(pointer: coarse)').matches || (navigator.hardwareConcurrency || 4) <= 4 || (mem !== undefined && mem <= 4) || isInApp();
};
