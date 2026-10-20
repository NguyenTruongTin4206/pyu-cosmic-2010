import * as THREE from 'three';
import gsap from 'gsap';
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { Body } from './createPlanets';
import { softDot } from './textures';
import { dur } from '../utils';

interface Opts {
  canvas: HTMLCanvasElement; camera: THREE.Camera; controls: OrbitControls; scene: THREE.Scene;
  bodies: Body[]; tooltip: HTMLElement; onSelect: (b: Body | null) => void;
}
export interface Interaction { select: (b: Body | null) => void; setActive: (on: boolean) => void; dispose: () => void }

export function createInteraction(o: Opts): Interaction {
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  const byPick = new Map<THREE.Object3D, Body>(o.bodies.map((b) => [b.pick, b]));
  const picks = o.bodies.map((b) => b.pick);
  let active = false, selected: Body | null = null, hover: Body | null = null, wasAuto = false;
  let down: { x: number; y: number; t: number } | null = null;

  function pick(x: number, y: number): Body | null {
    const r = o.canvas.getBoundingClientRect();
    ndc.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, o.camera);
    const h = ray.intersectObjects(picks, false)[0];
    return h ? byPick.get(h.object) ?? null : null;
  }

  function setHover(b: Body | null, x = 0, y = 0): void {
    if (b !== hover) {
      if (hover && hover !== selected) hover.hlT = 0;
      hover = b; if (b && b !== selected) b.hlT = 0.6;
      o.canvas.style.cursor = b ? 'pointer' : 'grab';
    }
    o.tooltip.hidden = !b;
    if (b) { o.tooltip.textContent = b.wish.name; o.tooltip.style.transform = `translate(${x + 14}px,${y + 14}px)`; }
  }

  // Hạt sáng lan tỏa quanh thiên thể được chọn (tự dọn dẹp sau khi xong)
  function burst(b: Body): void {
    const n = 36, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const v = new THREE.Vector3().randomDirection(); pos.set([v.x, v.y, v.z], i * 3); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ color: b.wish.color, size: 0.5, map: softDot(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    const p = new THREE.Points(geo, mat); p.position.copy(b.pos); p.scale.setScalar(b.radius * 0.8); o.scene.add(p);
    const s = b.radius * 4;
    gsap.to(p.scale, { x: s, y: s, z: s, duration: dur(1.1), ease: 'power2.out' });
    gsap.to(mat, { opacity: 0, duration: dur(1.1), onComplete: () => { o.scene.remove(p); geo.dispose(); mat.dispose(); } });
  }

  function select(b: Body | null): void {
    if (b === selected) return;
    if (selected) selected.paused = false;
    selected = b;
    o.bodies.forEach((x) => { x.hlT = x === b ? 1 : 0; x.dimT = b && x !== b ? 1 : 0; });
    if (b) {
      b.paused = true; burst(b); wasAuto = o.controls.autoRotate || wasAuto; o.controls.autoRotate = false;
      const to = new THREE.Vector3().copy(b.pos).multiplyScalar(0.5); // dịch nhẹ về phía thiên thể
      gsap.to(o.controls.target, { x: to.x, y: to.y, z: to.z, duration: dur(1.2), ease: 'power2.inOut', overwrite: true });
    } else {
      o.controls.autoRotate = wasAuto; wasAuto = false;
      gsap.to(o.controls.target, { x: 0, y: 0, z: 0, duration: dur(1.2), ease: 'power2.inOut', overwrite: true });
    }
    o.onSelect(b);
  }

  // Phân biệt click và kéo bằng ngưỡng di chuyển
  const onDown = (e: PointerEvent): void => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; };
  const onUp = (e: PointerEvent): void => {
    if (!active || !down) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y), took = performance.now() - down.t; down = null;
    if (moved > 6 || took > 600) return;
    const b = pick(e.clientX, e.clientY); if (b) select(b);
  };
  const onMove = (e: PointerEvent): void => { if (active && e.pointerType === 'mouse' && e.buttons === 0) setHover(pick(e.clientX, e.clientY), e.clientX, e.clientY); };
  const onLeave = (): void => setHover(null);
  const onCancel = (): void => { down = null; }; // hệ thống ngắt thao tác chạm (cuộc gọi, vuốt cạnh màn hình...)

  o.canvas.addEventListener('pointerdown', onDown); o.canvas.addEventListener('pointerup', onUp);
  o.canvas.addEventListener('pointermove', onMove); o.canvas.addEventListener('pointerleave', onLeave); o.canvas.addEventListener('pointercancel', onCancel);

  return {
    select, setActive(on) { active = on; if (!on) setHover(null); },
    dispose() {
      o.canvas.removeEventListener('pointerdown', onDown); o.canvas.removeEventListener('pointerup', onUp);
      o.canvas.removeEventListener('pointermove', onMove); o.canvas.removeEventListener('pointerleave', onLeave); o.canvas.removeEventListener('pointercancel', onCancel);
      gsap.killTweensOf(o.controls.target);
    },
  };
}
