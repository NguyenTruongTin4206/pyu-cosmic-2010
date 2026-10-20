import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import type { Pass } from 'three/examples/jsm/postprocessing/Pass.js';
import { disposeTree } from './textures';
import { isInApp, isLowEnd } from '../utils';
import { TIERS, clampTier, saveTierFloor } from './quality';

export interface SceneStats { fps: number; pixelRatio: number; bloom: boolean; tier: number; contextLosses: number }
export interface TierOptions { persist?: boolean; reason?: 'auto' | 'manual' | 'context' }

export interface SceneKit {
  renderer: THREE.WebGLRenderer; scene: THREE.Scene; camera: THREE.PerspectiveCamera; controls: OrbitControls;
  readonly tier: number;
  setTier: (t: number, o?: TierOptions) => void;
  onTier: (cb: (tier: number, reason: string) => void) => void;
  onContext: (cb: (state: 'lost' | 'restored') => void) => void;
  onFatal: (cb: () => void) => void;
  onFrame: (cb: (t: number, dt: number) => void) => void;
  stats: () => SceneStats;
  start: () => void; stop: () => void; dispose: () => void;
}

export function createScene(canvas: HTMLCanvasElement, startTier: number): SceneKit {
  let tier = clampTier(startTier);
  const cfg = (): (typeof TIERS)[number] => TIERS[tier];

  const renderer = new THREE.WebGLRenderer({
    canvas, antialias: tier <= 1 && !isLowEnd(), stencil: false,
    powerPreference: tier === 0 ? 'high-performance' : 'default',
  });
  renderer.setClearColor(0x050816, 1);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 2000);
  camera.position.set(0, 5, 20);
  scene.add(new THREE.AmbientLight(0x8a7cff, 0.55));
  const sun = new THREE.DirectionalLight(0xfff2dd, 2.4); sun.position.set(30, 25, 40); scene.add(sun);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true; controls.dampingFactor = 0.06; controls.enablePan = false;
  controls.rotateSpeed = 0.6; controls.zoomSpeed = 0.7; controls.minDistance = 16; controls.maxDistance = 95;
  controls.minPolarAngle = 0.15; controls.maxPolarAngle = Math.PI - 0.15; // azimuth không giới hạn -> xoay đủ 360°
  controls.autoRotate = !window.matchMedia('(prefers-reduced-motion: reduce)').matches; controls.autoRotateSpeed = 0.5;

  // ---- Bloom (ánh sáng lan tỏa): chỉ bật ở mức "Cao", bật/tắt được lúc đang chạy ----
  let composer: EffectComposer | null = null, passes: Pass[] = [];
  function setBloom(on: boolean): void {
    if (on === (composer !== null)) return;
    if (on) {
      try {
        const c = new EffectComposer(renderer);
        const list: Pass[] = [new RenderPass(scene, camera), new UnrealBloomPass(new THREE.Vector2(256, 256), 0.55, 0.7, 0.82), new OutputPass()];
        list.forEach((p) => c.addPass(p));
        composer = c; passes = list; lastW = 0; // buộc áp dụng lại kích thước
      } catch (e) { console.warn('Không bật được bloom:', e); composer = null; passes = []; }
    } else {
      passes.forEach((p) => p.dispose()); composer?.dispose(); composer = null; passes = [];
      renderer.setRenderTarget(null);
    }
  }

  // ---- Kích thước: chỉ áp dụng khi THỰC SỰ đổi, và làm ngay trong khung hình để không bị chớp đen ----
  let sizeDirty = true, lastW = 0, lastH = 0, lastPR = 0;
  function applySize(): void {
    sizeDirty = false;
    const w = Math.max(1, window.innerWidth), h = Math.max(1, window.innerHeight), c = cfg();
    let pr = Math.min(window.devicePixelRatio || 1, c.maxPR, Math.sqrt(c.pixels / (w * h)));
    if (isInApp()) pr = Math.min(pr, 1);
    pr = Math.max(0.5, Math.round(pr * 100) / 100);
    if (w === lastW && h === lastH && pr === lastPR) return;
    lastW = w; lastH = h; lastPR = pr; govWarm = Math.max(govWarm, 20);
    renderer.setPixelRatio(pr); renderer.setSize(w, h, false);
    composer?.setPixelRatio(pr); composer?.setSize(w, h);
    camera.aspect = w / h; camera.fov = w / h < 1 ? 70 : 55; camera.updateProjectionMatrix();
  }
  const markDirty = (): void => { sizeDirty = true; };
  window.addEventListener('resize', markDirty); window.addEventListener('orientationchange', markDirty);
  window.visualViewport?.addEventListener('resize', markDirty); // thanh địa chỉ/toolbar của Zalo, Chrome mobile co giãn

  // ---- Đổi mức chất lượng ----
  const tierCbs: ((t: number, r: string) => void)[] = [];
  function setTier(t: number, o: TierOptions = {}): void {
    const next = clampTier(t);
    if (next === tier) return;
    tier = next; setBloom(cfg().bloom); sizeDirty = true; lastW = 0;
    if (o.persist) saveTierFloor(tier);
    tierCbs.forEach((cb) => cb(tier, o.reason ?? 'manual'));
  }
  setBloom(cfg().bloom);

  // ---- Vòng lặp vẽ + tự giảm chất lượng nếu thấy giật (đo liên tục, chỉ giảm, không tăng lại để tránh chớp) ----
  const cbs: ((t: number, dt: number) => void)[] = [], fatalCbs: (() => void)[] = [];
  let raf = 0, t = 0, last = 0, wantRun = false, errors = 0, fps = 60, losses = 0;
  let govFrames = 0, govAcc = 0, govBad = 0, govWarm = 45;
  const resetGov = (): void => { govFrames = 0; govAcc = 0; govBad = 0; govWarm = 45; };

  function govern(rawDt: number): void {
    if (govWarm > 0) { govWarm--; return; }
    if (rawDt > 0.25) return; // bỏ các khung bị ngắt quãng (đổi tab, kéo cửa sổ)
    govAcc += rawDt; govFrames++;
    if (govFrames < 120) return;
    const avg = govAcc / govFrames; fps = 1 / avg; govFrames = 0; govAcc = 0;
    govBad = avg > 0.04 ? govBad + 1 : 0; // dưới ~25 FPS liên tục ~8 giây
    if (govBad >= 2 && tier < TIERS.length - 1) { resetGov(); setTier(tier + 1, { persist: true, reason: 'auto' }); }
  }

  function frame(): void {
    raf = requestAnimationFrame(frame);
    try {
      const now = performance.now(), rawDt = (now - last) / 1000; last = now;
      const dt = Math.min(rawDt, 0.05); t += dt;
      if (sizeDirty) applySize();
      cbs.forEach((cb) => cb(t, dt)); controls.update();
      if (composer) composer.render(dt); else renderer.render(scene, camera);
      govern(rawDt); errors = 0;
    } catch (e) {
      console.error('Lỗi khi vẽ khung hình:', e);
      if (++errors >= 5) { stop(); fatalCbs.forEach((cb) => cb()); }
    }
  }
  function run(): void { if (wantRun && !raf && !document.hidden && !lostNow) { last = performance.now(); resetGov(); frame(); } }
  function start(): void { wantRun = true; run(); }
  function stop(): void { wantRun = false; cancelAnimationFrame(raf); raf = 0; }
  const onVis = (): void => { if (document.hidden) { cancelAnimationFrame(raf); raf = 0; } else run(); };
  document.addEventListener('visibilitychange', onVis); // tạm dừng khi mất tiêu điểm tab

  // ---- Mất / khôi phục WebGL: không bỏ cuộc ngay, khôi phục rồi hạ chất lượng để lần sau không bị lại ----
  let lostNow = false;
  const ctxCbs: ((s: 'lost' | 'restored') => void)[] = [];
  const onLost = (e: Event): void => {
    e.preventDefault(); lostNow = true; losses++; cancelAnimationFrame(raf); raf = 0;
    ctxCbs.forEach((cb) => cb('lost'));
  };
  const onRestored = (): void => {
    lostNow = false; setBloom(false);
    const target = Math.max(tier, losses >= 2 ? 2 : 1);
    if (target !== tier) setTier(target, { persist: true, reason: 'context' }); else saveTierFloor(tier);
    sizeDirty = true; lastW = 0;
    ctxCbs.forEach((cb) => cb('restored')); run();
  };
  canvas.addEventListener('webglcontextlost', onLost); canvas.addEventListener('webglcontextrestored', onRestored);

  return {
    renderer, scene, camera, controls,
    get tier() { return tier; },
    setTier,
    onTier: (cb) => { tierCbs.push(cb); },
    onContext: (cb) => { ctxCbs.push(cb); },
    onFatal: (cb) => { fatalCbs.push(cb); },
    onFrame: (cb) => { cbs.push(cb); },
    stats: () => ({ fps, pixelRatio: lastPR, bloom: composer !== null, tier, contextLosses: losses }),
    start, stop,
    dispose() {
      stop(); document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('resize', markDirty); window.removeEventListener('orientationchange', markDirty);
      window.visualViewport?.removeEventListener('resize', markDirty);
      canvas.removeEventListener('webglcontextlost', onLost); canvas.removeEventListener('webglcontextrestored', onRestored);
      setBloom(false); controls.dispose(); disposeTree(scene); renderer.dispose();
      try { renderer.forceContextLoss(); } catch { /* bỏ qua */ } // trả GPU context cho trình duyệt
    },
  };
}
