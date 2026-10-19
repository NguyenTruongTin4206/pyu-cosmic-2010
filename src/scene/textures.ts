import * as THREE from 'three';

const cache = new Map<string, THREE.CanvasTexture>();
const mk = (w: number, h: number) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

function radial(key: string, stops: [number, string][]): THREE.CanvasTexture {
  const hit = cache.get(key); if (hit) return hit;
  const c = mk(128, 128), x = c.getContext('2d')!;
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  stops.forEach(([o, col]) => g.addColorStop(o, col));
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; cache.set(key, t); return t;
}
export const softDot = () => radial('dot', [[0, 'rgba(255,255,255,1)'], [0.35, 'rgba(255,255,255,.6)'], [1, 'rgba(255,255,255,0)']]);
export const glow = () => radial('glow', [[0, 'rgba(255,255,255,.9)'], [0.25, 'rgba(255,255,255,.35)'], [1, 'rgba(255,255,255,0)']]);

function rng(seed: number) {
  return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** Bề mặt hành tinh tạo bằng mã: dải màu + vết loang, không cần ảnh bên ngoài */
export function planetTexture(base: string, accent: string, seed: number): THREE.CanvasTexture {
  const r = rng(seed), c = mk(512, 256), x = c.getContext('2d')!;
  const g = x.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, accent); g.addColorStop(0.5, base); g.addColorStop(1, accent);
  x.fillStyle = g; x.fillRect(0, 0, 512, 256);
  for (let i = 0; i < 46; i++) {
    x.globalAlpha = 0.06 + r() * 0.14; x.fillStyle = r() > 0.5 ? '#ffffff' : '#1a1030';
    x.fillRect(0, r() * 256, 512, 2 + r() * 10);
  }
  for (let i = 0; i < 24; i++) {
    x.globalAlpha = 0.08; x.fillStyle = r() > 0.5 ? '#ffffff' : '#1a1030';
    x.beginPath(); x.arc(r() * 512, r() * 256, 10 + r() * 40, 0, Math.PI * 2); x.fill();
  }
  x.globalAlpha = 1;
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; return t;
}

/** Giải phóng geometry, material và texture của cả một nhánh cảnh */
export function disposeTree(root: THREE.Object3D): void {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    m.geometry?.dispose();
    const mat = m.material as THREE.Material | THREE.Material[] | undefined;
    (Array.isArray(mat) ? mat : mat ? [mat] : []).forEach((x) => { (x as THREE.MeshBasicMaterial).map?.dispose(); x.dispose(); });
  });
}

// ===== Nhiễu 3D (value noise) để tạo lục địa, mây... không cần ảnh ngoài, không có đường nối =====
function hash3(x: number, y: number, z: number, s: number): number {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 1274126177) ^ Math.imul(s, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967295;
}
function noise3(x: number, y: number, z: number, s: number): number {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), xf = x - xi, yf = y - yi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
  const l = (a: number, b: number, t: number) => a + (b - a) * t;
  return l(l(l(hash3(xi, yi, zi, s), hash3(xi + 1, yi, zi, s), u), l(hash3(xi, yi + 1, zi, s), hash3(xi + 1, yi + 1, zi, s), u), v),
           l(l(hash3(xi, yi, zi + 1, s), hash3(xi + 1, yi, zi + 1, s), u), l(hash3(xi, yi + 1, zi + 1, s), hash3(xi + 1, yi + 1, zi + 1, s), u), v), w);
}
function fbm(x: number, y: number, z: number, s: number, oct: number): number {
  let a = 0.5, f = 1, sum = 0, norm = 0;
  for (let i = 0; i < oct; i++) { sum += a * noise3(x * f, y * f, z * f, s + i); norm += a; a *= 0.5; f *= 2; }
  return sum / norm;
}
const tex = (c: HTMLCanvasElement): THREE.CanvasTexture => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };

/** Trái Đất: đại dương, lục địa xanh, sa mạc, núi tuyết, băng ở hai cực + lớp mây riêng */
export function earthTextures(w: number): { map: THREE.CanvasTexture; clouds: THREE.CanvasTexture } {
  const h = w / 2, mc = mk(w, h), cc = mk(w, h), mx = mc.getContext('2d')!, cx = cc.getContext('2d')!;
  const mi = mx.createImageData(w, h), ci = cx.createImageData(w, h), SEA = 0.56;
  for (let j = 0; j < h; j++) {
    const lat = (0.5 - (j + 0.5) / h) * Math.PI, cl = Math.cos(lat), y = Math.sin(lat);
    for (let i = 0; i < w; i++) {
      const lon = ((i + 0.5) / w) * Math.PI * 2, x = cl * Math.cos(lon), z = cl * Math.sin(lon), k = (j * w + i) * 4;
      const e = fbm(x * 1.6 + 3, y * 1.6, z * 1.6, 1, 5);
      let R: number, G: number, B: number;
      if (Math.abs(y) > 0.88) { R = 236; G = 241; B = 250; }
      else if (e < SEA) { const t = Math.min(1, (SEA - e) * 7); R = 40 - 30 * t; G = 135 - 95 * t; B = 205 - 95 * t; }
      else {
        const m = (e - SEA) * 7, dry = fbm(x * 2.5 + 7, y * 2.5, z * 2.5, 9, 3);
        if (m > 1.15) { R = 232; G = 232; B = 236; }
        else if (dry > 0.57 && m < 0.8) { R = 208; G = 182; B = 112; }
        else { R = 62 + m * 75; G = 142 - m * 35; B = 72 + m * 25; }
      }
      mi.data[k] = R; mi.data[k + 1] = G; mi.data[k + 2] = B; mi.data[k + 3] = 255;
      const c = fbm(x * 2.2 + 11, y * 2.2, z * 2.2, 5, 4);
      ci.data[k] = 255; ci.data[k + 1] = 255; ci.data[k + 2] = 255; ci.data[k + 3] = Math.max(0, Math.min(1, (c - 0.5) * 4.5)) * 225;
    }
  }
  mx.putImageData(mi, 0, 0); cx.putImageData(ci, 0, 0);
  return { map: tex(mc), clouds: tex(cc) };
}

export function moonTexture(): THREE.CanvasTexture {
  const w = 256, h = 128, c = mk(w, h), x = c.getContext('2d')!, im = x.createImageData(w, h);
  for (let j = 0; j < h; j++) {
    const lat = (0.5 - (j + 0.5) / h) * Math.PI, cl = Math.cos(lat), py = Math.sin(lat);
    for (let i = 0; i < w; i++) {
      const lon = ((i + 0.5) / w) * Math.PI * 2, n = fbm(cl * Math.cos(lon) * 3, py * 3, cl * Math.sin(lon) * 3, 21, 4), v = 110 + n * 120, k = (j * w + i) * 4;
      im.data[k] = v; im.data[k + 1] = v; im.data[k + 2] = v - 5; im.data[k + 3] = 255;
    }
  }
  x.putImageData(im, 0, 0); return tex(c);
}

/** Đám mây tinh vân: nhiều vệt loang mờ chồng nhau, có hình dạng không đều */
export function cloudTexture(seed: number): THREE.CanvasTexture {
  const key = 'cloud' + seed, hit = cache.get(key); if (hit) return hit;
  const r = rng(seed * 97), c = mk(256, 256), x = c.getContext('2d')!;
  for (let i = 0; i < 46; i++) {
    const a = r() * 6.283, d = r() * 62, px = 128 + Math.cos(a) * d, py = 128 + Math.sin(a) * d * 0.7, rad = 28 + r() * 38;
    const g = x.createRadialGradient(px, py, 0, px, py, rad);
    g.addColorStop(0, `rgba(255,255,255,${0.05 + r() * 0.12})`); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 256, 256);
  }
  const t = tex(c); cache.set(key, t); return t;
}

/** Ngôi sao lấp lánh 4 cánh */
export function sparkleTexture(): THREE.CanvasTexture {
  const hit = cache.get('spark'); if (hit) return hit;
  const c = mk(64, 64), x = c.getContext('2d')!;
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 12);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  x.globalCompositeOperation = 'lighter';
  const gh = x.createLinearGradient(0, 32, 64, 32), gv = x.createLinearGradient(32, 0, 32, 64);
  [gh, gv].forEach((l) => { l.addColorStop(0, 'rgba(255,255,255,0)'); l.addColorStop(0.5, 'rgba(255,255,255,.95)'); l.addColorStop(1, 'rgba(255,255,255,0)'); });
  x.fillStyle = gh; x.fillRect(0, 31, 64, 2); x.fillStyle = gv; x.fillRect(31, 0, 2, 64);
  const t = tex(c); cache.set('spark', t); return t;
}
