import './style.css';
import gsap from 'gsap';
import * as THREE from 'three';
import { wishes } from './data/wishes';
import { $, dur, isLowEnd } from './utils';
import { createScene } from './scene/createScene';
import type { SceneKit } from './scene/createScene';
import { createStarfield } from './scene/createStarfield';
import type { Starfield } from './scene/createStarfield';
import { createCosmos } from './scene/createPlanets';
import type { Cosmos } from './scene/createPlanets';
import { createInteraction } from './scene/interaction';
import type { Interaction } from './scene/interaction';
import { createIntro } from './components/intro';
import { createWishPanel } from './components/wishPanel';
import { createMusicPlayer } from './components/musicPlayer';
import { bindControls, setMusicStatus } from './components/controls';

document.body.classList.toggle('lite', isLowEnd()); // máy yếu / Zalo: giao diện nhẹ hơn
const canvas = $<HTMLCanvasElement>('scene');
let kit: SceneKit | null = null, cosmos: Cosmos | null = null, starfield: Starfield | null = null, interaction: Interaction | null = null;
let mode: '3d' | 'fallback' = '3d';

const panel = createWishPanel(() => interaction?.select(null));
const music = createMusicPlayer(setMusicStatus);

// ---- Bản dự phòng (CSS) khi không có WebGL ----
function buildFallback(): void {
  const grid = $('fallbackGrid'); if (grid.childElementCount) return;
  wishes.forEach((w) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = `fb ${w.kind}`; b.style.setProperty('--c', w.color);
    b.innerHTML = '<i></i><span></span>'; (b.querySelector('span') as HTMLElement).textContent = w.name;
    b.addEventListener('click', () => panel.open(w)); grid.appendChild(b);
  });
}
function showFallback(): void { $('fallback').hidden = false; }
function toFallback(): void {
  mode = 'fallback'; kit?.stop(); document.body.classList.add('fallback-mode'); buildFallback();
}

function webglOk(): boolean {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; }
}

// ---- Khởi tạo vũ trụ 3D ----
function init3D(): boolean {
  if (!webglOk()) return false;
  try {
    const k = createScene(canvas), sf = createStarfield(k.low, k.camera), cs = createCosmos(k.low);
    kit = k; starfield = sf; cosmos = cs;
    k.scene.add(sf.group, cs.root);
    interaction = createInteraction({ canvas, camera: k.camera, controls: k.controls, scene: k.scene, bodies: cs.bodies, tooltip: $('tooltip'),
      onSelect: (b) => { if (b) panel.open(b.wish); else panel.close(); } });
    const tmp = new THREE.Vector3();
    k.onFrame((t, dt) => {
      sf.update(t, dt); cs.update(t, dt);
      // Không cho camera xuyên qua thiên thể
      cs.bodies.forEach((b) => {
        const min = b.radius * b.group.scale.x + 1.5; tmp.copy(k.camera.position).sub(b.pos);
        if (tmp.length() < min) k.camera.position.copy(b.pos).add(tmp.setLength(min));
      });
    });
    // Mất WebGL (hay gặp trên điện thoại/Zalo): chờ khôi phục, quá 5 giây mới chuyển sang bản dự phòng
    let lostTimer = 0;
    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault(); k.stop();
      lostTimer = window.setTimeout(() => { toFallback(); if (document.body.classList.contains('explore')) showFallback(); }, 5000);
    });
    canvas.addEventListener('webglcontextrestored', () => { window.clearTimeout(lostTimer); k.start(); });
    k.controls.enabled = false; k.start();
    return true;
  } catch (err) {
    console.error('Không khởi tạo được WebGL:', err); kit?.dispose(); kit = null; return false;
  }
}

// ---- Luồng: màn hình mở đầu -> khám phá ----
function enter(): void {
  void music.play(); // gọi NGAY trong lúc bấm nút để Zalo/Safari/Chrome cho phép tự phát nhạc (lặp vô hạn)
  intro.hide(); document.body.classList.add('explore');
  $('hud').hidden = false; $('dock').hidden = false;
  gsap.fromTo(['#hud', '#dock'], { autoAlpha: 0 }, { autoAlpha: 1, duration: dur(1), delay: dur(1.2) });
  if (mode === 'fallback' || !kit || !cosmos || !interaction) { showFallback(); return; }
  const k = kit, cs = cosmos, ia = interaction;
  const end = k.camera.position.clone().normalize().multiplyScalar(window.innerWidth / window.innerHeight < 1 ? 84 : 72);
  gsap.to(k.camera.position, { x: end.x, y: end.y, z: end.z, duration: dur(3.2), ease: 'power3.inOut',
    onComplete: () => { k.controls.enabled = true; ia.setActive(true); } });
  cs.bodies.forEach((b, i) => gsap.to(b.group.scale, { x: 1, y: 1, z: 1, duration: dur(1.2), delay: dur(0.8 + i * 0.12), ease: 'back.out(1.6)', overwrite: true }));
}

function restart(): void {
  panel.close(); interaction?.select(null); interaction?.setActive(false);
  document.body.classList.remove('explore'); $('hud').hidden = true; $('dock').hidden = true; $('fallback').hidden = true;
  if (kit && cosmos && mode === '3d') {
    const k = kit, end = k.camera.position.clone().normalize().multiplyScalar(20);
    k.controls.enabled = false;
    gsap.to(k.camera.position, { x: end.x, y: end.y, z: end.z, duration: dur(2), ease: 'power2.inOut' });
    cosmos.bodies.forEach((b) => gsap.to(b.group.scale, { x: 0.0001, y: 0.0001, z: 0.0001, duration: dur(0.6), overwrite: true }));
  }
  intro.show();
}

if (!init3D()) toFallback();
const intro = createIntro(enter);
bindControls({ music, onAutoRotate: (on) => { if (kit) kit.controls.autoRotate = on; }, onRestart: restart });

window.addEventListener('pagehide', () => { interaction?.dispose(); starfield?.dispose(); cosmos?.dispose(); kit?.dispose(); music.dispose(); });
