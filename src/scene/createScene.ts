import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { disposeTree } from './textures';
import { isInApp, isLowEnd } from '../utils';

export interface SceneKit {
  renderer: THREE.WebGLRenderer; scene: THREE.Scene; camera: THREE.PerspectiveCamera; controls: OrbitControls; low: boolean;
  onFrame: (cb: (t: number, dt: number) => void) => void; start: () => void; stop: () => void; dispose: () => void;
}

export function createScene(canvas: HTMLCanvasElement): SceneKit {
  // Máy yếu / điện thoại / Zalo: giảm pixel ratio, bỏ khử răng cưa, tắt bloom, giảm số hạt
  const low = isLowEnd();
  let maxPR = isInApp() ? 1 : Math.min(window.devicePixelRatio, low ? 1.25 : 2);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !low, powerPreference: low ? 'default' : 'high-performance' });
  renderer.setClearColor(0x050816, 1);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 2000);
  camera.position.set(0, 5, 20);
  scene.add(new THREE.AmbientLight(0x8a7cff, 0.55));
  const sun = new THREE.DirectionalLight(0xfff2dd, 2.4); sun.position.set(30, 25, 40); scene.add(sun);

  // Hiệu ứng bloom (ánh sáng lan tỏa) - chỉ bật trên máy đủ mạnh, và tự tắt nếu thấy giật
  let composer: EffectComposer | null = null, bloom: UnrealBloomPass | null = null;
  if (!low) {
    try {
      composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 }));
      composer.addPass(new RenderPass(scene, camera));
      bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.55, 0.7, 0.82);
      composer.addPass(bloom); composer.addPass(new OutputPass());
    } catch (e) { console.warn('Không bật được bloom:', e); composer = null; bloom = null; }
  }

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true; controls.dampingFactor = 0.06; controls.enablePan = false;
  controls.rotateSpeed = 0.6; controls.zoomSpeed = 0.7; controls.minDistance = 16; controls.maxDistance = 95;
  controls.minPolarAngle = 0.15; controls.maxPolarAngle = Math.PI - 0.15; // azimuth không giới hạn -> xoay đủ 360°
  controls.autoRotate = !window.matchMedia('(prefers-reduced-motion: reduce)').matches; controls.autoRotateSpeed = 0.5;

  function resize(): void {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setPixelRatio(maxPR); renderer.setSize(w, h, false);
    composer?.setPixelRatio(maxPR); composer?.setSize(w, h);
    camera.aspect = w / h; camera.fov = w / h < 1 ? 70 : 55; camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener('resize', resize); window.addEventListener('orientationchange', resize);
  window.visualViewport?.addEventListener('resize', resize); // thanh địa chỉ/toolbar của Zalo, Chrome mobile co giãn

  const cbs: ((t: number, dt: number) => void)[] = [];
  const clock = new THREE.Clock(); let raf = 0, t = 0, wantRun = false, frames = 0, acc = 0;
  function frame(): void {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.05); t += dt; frames++;
    cbs.forEach((cb) => cb(t, dt)); controls.update();
    if (composer) composer.render(dt); else renderer.render(scene, camera);
    // Đo FPS ~3 giây đầu: nếu dưới ~28 FPS thì tắt bloom và hạ độ phân giải
    if (frames > 60 && frames <= 240) acc += dt;
    if (frames === 240 && acc / 180 > 0.036) {
      if (composer) { composer.dispose(); bloom?.dispose(); composer = null; bloom = null; }
      maxPR = 1; resize();
    }
  }
  function start(): void { wantRun = true; if (!raf && !document.hidden) { clock.getDelta(); frame(); } }
  function stop(): void { wantRun = false; cancelAnimationFrame(raf); raf = 0; }
  const onVis = (): void => { if (document.hidden) { cancelAnimationFrame(raf); raf = 0; } else if (wantRun && !raf) { clock.getDelta(); frame(); } };
  document.addEventListener('visibilitychange', onVis); // tạm dừng khi mất tiêu điểm tab

  return {
    renderer, scene, camera, controls, low, start, stop,
    onFrame: (cb) => { cbs.push(cb); },
    dispose() {
      stop(); document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('resize', resize); window.removeEventListener('orientationchange', resize);
      window.visualViewport?.removeEventListener('resize', resize);
      controls.dispose(); composer?.dispose(); bloom?.dispose(); disposeTree(scene); renderer.dispose();
    },
  };
}
