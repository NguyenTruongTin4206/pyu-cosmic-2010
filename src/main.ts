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
import { TIERS, pickInitialTier, probeGpu } from './scene/quality';
import { createIntro } from './components/intro';
import { createWishPanel } from './components/wishPanel';
import { createMusicPlayer } from './components/musicPlayer';
import { bindControls, setMusicStatus } from './components/controls';
import { hideToast, toast } from './components/toast';

const gpu = probeGpu();
const startTier = pickInitialTier(gpu);
document.body.classList.toggle('lite', startTier >= 2 || isLowEnd()); // máy yếu / Zalo: giao diện nhẹ hơn
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
  if (mode === 'fallback') return;
  mode = 'fallback'; kit?.stop(); document.body.classList.add('fallback-mode'); buildFallback();
  if (document.body.classList.contains('explore')) showFallback();
}

// ---- Khởi tạo vũ trụ 3D ----
function init3D(): boolean {
  if (!gpu.ok) return false;
  try {
    const cfg = TIERS[startTier];
    const k = createScene(canvas, startTier), sf = createStarfield(cfg.particles, k.camera), cs = createCosmos(cfg.earthTex);
    kit = k; starfield = sf; cosmos = cs; sf.setLevel(startTier);
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

    // Tự đổi chất lượng (do thấy giật, hoặc người xem bấm nút)
    k.onTier((tier, reason) => {
      sf.setLevel(tier); updateQualityButton(tier);
      if (reason === 'auto') toast(`Máy hơi chậm nên đã tự giảm chất lượng hình ảnh (${TIERS[tier].name}) để mượt hơn.`, 4500);
      else if (reason === 'manual') toast(`Chất lượng hình ảnh: ${TIERS[tier].name}`);
    });
    updateQualityButton(k.tier);

    // Mất WebGL (hay gặp khi GPU quá tải hoặc trên điện thoại/Zalo): chờ khôi phục, quá 8 giây mới chuyển sang bản dự phòng
    let lostTimer = 0;
    k.onContext((state) => {
      window.clearTimeout(lostTimer);
      if (state === 'lost') {
        toast('Đang khôi phục hình ảnh…', 0);
        lostTimer = window.setTimeout(() => { toFallback(); toast('Thiết bị không hiển thị được 3D nên chuyển sang chế độ danh sách.', 6000); }, 8000);
      } else toast('Đã khôi phục. Hình ảnh được giảm nhẹ để ổn định hơn.', 4500);
    });
    k.onFatal(() => { toFallback(); toast('Hiển thị 3D gặp sự cố nên chuyển sang chế độ danh sách.', 6000); });

    k.controls.enabled = false; k.start();
    return true;
  } catch (err) {
    console.error('Không khởi tạo được WebGL:', err);
    interaction?.dispose(); starfield?.dispose(); cosmos?.dispose(); kit?.dispose();
    kit = null; starfield = null; cosmos = null; interaction = null; return false;
  }
}

function updateQualityButton(tier: number): void {
  const b = $('qualityBtn'), name = TIERS[tier].name;
  b.title = `Chất lượng hình ảnh: ${name} (bấm để đổi)`; b.setAttribute('aria-label', `Chất lượng hình ảnh: ${name}. Bấm để đổi`);
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
bindControls({
  music, onRestart: restart,
  onAutoRotate: (on) => { if (kit) kit.controls.autoRotate = on; },
  onQuality: () => { if (kit) kit.setTier((kit.tier + 1) % TIERS.length, { persist: true, reason: 'manual' }); },
});

// ---- Bảng chẩn đoán: thêm ?debug vào cuối link để xem FPS, mức chất lượng, tên GPU ----
if (new URLSearchParams(window.location.search).has('debug')) {
  const box = $('debug'); box.hidden = false;
  window.setInterval(() => {
    const s = kit?.stats();
    box.textContent = [`GPU: ${gpu.renderer}${gpu.software ? ' (phần mềm!)' : ''}`, `Chế độ: ${mode}`,
      s ? `Mức: ${TIERS[s.tier].name} | FPS ~${Math.round(s.fps)} | PR ${s.pixelRatio} | Bloom ${s.bloom ? 'bật' : 'tắt'} | Mất WebGL: ${s.contextLosses}` : 'Không có 3D'].join('\n');
  }, 500);
}

// ---- Quay lại trang bằng nút Back / chuyển app (bfcache): đừng huỷ cảnh, chỉ tạm dừng rồi chạy lại ----
window.addEventListener('pagehide', (e) => {
  if (e.persisted) { kit?.stop(); return; }
  interaction?.dispose(); starfield?.dispose(); cosmos?.dispose(); kit?.dispose(); music.dispose();
});
window.addEventListener('pageshow', (e) => { if (e.persisted && mode === '3d') { hideToast(); kit?.start(); } });
