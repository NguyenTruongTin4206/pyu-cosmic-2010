import { isLowEnd, safeGet, safeSet } from '../utils';

/**
 * 4 mức chất lượng. Mức càng cao thì càng đẹp nhưng càng nặng.
 * - bloom: hiệu ứng ánh sáng lan tỏa (nặng nhất)
 * - maxPR: tỉ lệ điểm ảnh tối đa
 * - pixels: ngân sách tổng số điểm ảnh, màn hình càng lớn thì ảnh càng được thu nhỏ để không quá tải GPU
 * - particles: hệ số số lượng hạt sao
 * - earthTex: độ phân giải ảnh Trái Đất tạo bằng mã
 */
export interface TierCfg { name: string; bloom: boolean; maxPR: number; pixels: number; particles: number; earthTex: number }
export const TIERS: TierCfg[] = [
  { name: 'Cao', bloom: true, maxPR: 1.5, pixels: 2.8e6, particles: 1, earthTex: 1024 },
  { name: 'Cân bằng', bloom: false, maxPR: 1.25, pixels: 2.0e6, particles: 0.7, earthTex: 768 },
  { name: 'Nhẹ', bloom: false, maxPR: 1, pixels: 1.3e6, particles: 0.5, earthTex: 512 },
  { name: 'Siêu nhẹ', bloom: false, maxPR: 0.75, pixels: 0.8e6, particles: 0.3, earthTex: 384 },
];
export const MAX_TIER = TIERS.length - 1;
export const clampTier = (t: number): number => Math.min(MAX_TIER, Math.max(0, Math.round(t)));

export interface GpuInfo { ok: boolean; software: boolean; renderer: string }

/** Thử tạo WebGL: phân biệt "có GPU thật", "chỉ chạy bằng phần mềm (rất chậm)" và "không có WebGL" */
export function probeGpu(): GpuInfo {
  const attempt = (strict: boolean): { gl: WebGLRenderingContext; canvas: HTMLCanvasElement } | null => {
    try {
      const canvas = document.createElement('canvas');
      const opts = { failIfMajorPerformanceCaveat: strict };
      const gl = (canvas.getContext('webgl2', opts) || canvas.getContext('webgl', opts)) as WebGLRenderingContext | null;
      return gl ? { gl, canvas } : null;
    } catch { return null; }
  };
  const hw = attempt(true), found = hw ?? attempt(false);
  if (!found) return { ok: false, software: false, renderer: 'không có WebGL' };
  let renderer = 'không rõ';
  try {
    const ext = found.gl.getExtension('WEBGL_debug_renderer_info');
    if (ext) renderer = String(found.gl.getParameter(ext.UNMASKED_RENDERER_WEBGL));
  } catch { /* bỏ qua */ }
  // Giải phóng ngay ngữ cảnh dùng để dò, tránh chiếm chỗ (trình duyệt chỉ cho khoảng 16 ngữ cảnh)
  try { found.gl.getExtension('WEBGL_lose_context')?.loseContext(); } catch { /* bỏ qua */ }
  const software = !hw || /swiftshader|llvmpipe|software|basic render/i.test(renderer);
  return { ok: true, software, renderer };
}

// ---- Ghi nhớ mức chất lượng (7 ngày) để lần sau mở không phải "giật" lại từ đầu ----
const KEY = 'pyu-tier-floor', WEEK = 7 * 24 * 3600 * 1000;
export function loadTierFloor(): number {
  const raw = safeGet(KEY); if (!raw) return 0;
  const [t, at] = raw.split('|').map(Number);
  if (!Number.isFinite(t) || !Number.isFinite(at) || Date.now() - at > WEEK) return 0;
  return clampTier(t);
}
export function saveTierFloor(t: number): void { safeSet(KEY, `${clampTier(t)}|${Date.now()}`); }

/** Chọn mức chất lượng khởi đầu: ưu tiên tham số URL, sau đó theo thiết bị và mức đã ghi nhớ */
export function pickInitialTier(gpu: GpuInfo): number {
  const q = new URLSearchParams(window.location.search), forced = q.get('q');
  if (forced !== null && /^[0-3]$/.test(forced)) return Number(forced);
  if (q.has('lite')) return 2;
  if (q.has('hq')) return 0;
  let t = 0;
  if (gpu.software) t = 3;
  else if (isLowEnd()) t = 2;
  else if (/intel|uhd|iris|radeon\(tm\) graphics|vega \d/i.test(gpu.renderer)) t = 1;
  return Math.max(t, loadTierFloor());
}
