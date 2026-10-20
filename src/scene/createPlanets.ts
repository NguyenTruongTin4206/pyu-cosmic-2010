import * as THREE from 'three';
import { wishes } from '../data/wishes';
import type { Wish } from '../data/wishes';
import { disposeTree, earthTextures, glow, moonTexture, planetTexture } from './textures';

export interface Body {
  wish: Wish; group: THREE.Group; core: THREE.Mesh; mat: THREE.MeshStandardMaterial | THREE.MeshBasicMaterial;
  pick: THREE.Mesh; halo: THREE.Sprite; haloBase: number; radius: number; pos: THREE.Vector3; baseColor: THREE.Color;
  hl: number; hlT: number; dim: number; dimT: number; paused: boolean; spin: number; moons: THREE.Object3D[];
  orbit?: { r: number; speed: number; angle: number }; home?: THREE.Vector3;
}
export interface Cosmos { root: THREE.Group; bodies: Body[]; update: (t: number, dt: number) => void; dispose: () => void }

// Cấu hình quỹ đạo của từng hành tinh (r: bán kính quỹ đạo, tilt: độ nghiêng)
const PLANET_CFG = [
  { r: 15, size: 1.6, tilt: 0.1, speed: 0.12, ring: false, moons: 1 },
  { r: 20, size: 2.2, tilt: -0.25, speed: 0.09, ring: true, moons: 0 },
  { r: 25, size: 1.9, tilt: 0.35, speed: 0.07, ring: false, moons: 2 },
  { r: 30, size: 2.6, tilt: -0.1, speed: 0.055, ring: true, moons: 1 },
  { r: 35, size: 1.7, tilt: 0.5, speed: 0.045, ring: false, moons: 1 },
  { r: 40, size: 2.3, tilt: -0.4, speed: 0.035, ring: false, moons: 2 },
  { r: 45, size: 2.0, tilt: 0.25, speed: 0.03, ring: true, moons: 0 },
];
// Vị trí cố định của các ngôi sao (x, y, z) - rải trong không gian 3D
const STAR_POS: [number, number, number][] = [[-28, 18, -10], [26, -16, 14], [8, 30, -24], [-14, -26, 20], [34, 12, -30], [-36, -6, -26]];

function atmosphere(color: string, r: number): THREE.Mesh {
  return new THREE.Mesh(new THREE.SphereGeometry(r, 32, 24), new THREE.ShaderMaterial({
    uniforms: { c: { value: new THREE.Color(color) } },
    vertexShader: 'varying vec3 n;void main(){n=normalize(normalMatrix*normal);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: 'uniform vec3 c;varying vec3 n;void main(){float i=pow(max(0.0,0.72-dot(n,vec3(0.0,0.0,1.0))),3.0);gl_FragColor=vec4(c,1.0)*i*1.6;}',
    side: THREE.BackSide, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false,
  }));
}

function planet(r: number, color: string, accent: string, seed: number, ring: boolean, emissive: number) {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ map: planetTexture(color, accent, seed), roughness: 0.85, metalness: 0, emissive: new THREE.Color(color), emissiveIntensity: emissive });
  const core = new THREE.Mesh(new THREE.SphereGeometry(r, 40, 28), mat);
  group.add(core, atmosphere(color, r * 1.18));
  if (ring) {
    const rg = new THREE.Mesh(new THREE.RingGeometry(r * 1.5, r * 2.3, 64), new THREE.MeshBasicMaterial({ color: accent, side: THREE.DoubleSide, transparent: true, opacity: 0.45, depthWrite: false }));
    rg.rotation.x = Math.PI / 2.6; group.add(rg);
  }
  return { group, core, mat };
}

function orbitLine(r: number): THREE.LineLoop {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 128; i++) { const a = (i / 128) * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r)); }
  return new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: '#bfb2ff', transparent: true, opacity: 0.16, depthWrite: false }));
}

/** earthSize: độ phân giải ảnh Trái Đất tạo bằng mã (nhỏ hơn = nhẹ và tải nhanh hơn) */
export function createCosmos(earthSize: number): Cosmos {
  const root = new THREE.Group(), bodies: Body[] = [];

  // Trái Đất ở trung tâm (không tương tác): bề mặt, mây, khí quyển và Mặt Trăng đều tạo bằng mã
  const tex = earthTextures(earthSize);
  const earthG = new THREE.Group(); earthG.rotation.z = 0.41; // nghiêng trục 23,4°
  const earth = new THREE.Mesh(new THREE.SphereGeometry(5, 64, 48), new THREE.MeshStandardMaterial({ map: tex.map, roughness: 0.9 }));
  const clouds = new THREE.Mesh(new THREE.SphereGeometry(5.08, 48, 36), new THREE.MeshStandardMaterial({ map: tex.clouds, transparent: true, depthWrite: false, roughness: 1 }));
  earthG.add(earth, clouds, atmosphere('#5aa9ff', 5 * 1.16)); root.add(earthG);
  const cHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow(), color: '#6fb4ff', transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }));
  cHalo.scale.setScalar(22); root.add(cHalo);
  const moonPivot = new THREE.Object3D(); moonPivot.rotation.x = 0.09; root.add(moonPivot);
  const moon = new THREE.Mesh(new THREE.SphereGeometry(1.1, 32, 24), new THREE.MeshStandardMaterial({ map: moonTexture(), roughness: 1 }));
  moon.position.x = 9.5; moonPivot.add(moon);

  function register(w: Wish, parent: THREE.Object3D, group: THREE.Group, core: THREE.Mesh, mat: Body['mat'], radius: number,
    baseColor: THREE.Color, haloScale: number, haloBase: number, extra: Partial<Body>): void {
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow(), color: w.color, transparent: true, opacity: haloBase, blending: THREE.AdditiveBlending, depthWrite: false }));
    halo.scale.setScalar(haloScale); group.add(halo);
    // Vùng bấm vô hình, rộng hơn vật thể để dễ chạm trên điện thoại
    const pick = new THREE.Mesh(new THREE.SphereGeometry(Math.max(radius * 1.5, 2.2), 8, 6), new THREE.MeshBasicMaterial({ visible: false }));
    group.add(pick); group.scale.setScalar(0.0001); parent.add(group);
    bodies.push({ wish: w, group, core, mat, pick, halo, haloBase, radius, pos: new THREE.Vector3(), baseColor, hl: 0, hlT: 0, dim: 0, dimT: 0, paused: false, spin: 0.2, moons: [], ...extra });
  }

  wishes.filter((w) => w.kind === 'planet').forEach((w, i) => {
    const cfg = PLANET_CFG[i % PLANET_CFG.length];
    const tilt = new THREE.Group(); tilt.rotation.x = cfg.tilt; tilt.add(orbitLine(cfg.r)); root.add(tilt);
    const p = planet(cfg.size, w.color, w.accent, i + 11, cfg.ring, 0.1);
    const moons: THREE.Object3D[] = [];
    for (let m = 0; m < cfg.moons; m++) {
      const pivot = new THREE.Object3D(); pivot.rotation.x = 0.4 * m; pivot.userData.speed = 0.8 - m * 0.25;
      const moon = new THREE.Mesh(new THREE.SphereGeometry(cfg.size * 0.22, 16, 12), new THREE.MeshStandardMaterial({ color: '#d8d4ea', roughness: 0.9 }));
      moon.position.x = cfg.size * (2.1 + m * 0.7); pivot.add(moon); p.group.add(pivot); moons.push(pivot);
    }
    register(w, tilt, p.group, p.core, p.mat, cfg.size, new THREE.Color('#ffffff'), cfg.size * 5, 0.25,
      { spin: 0.15 + 0.05 * (i % 3), moons, orbit: { r: cfg.r, speed: cfg.speed, angle: i * ((Math.PI * 2) / 7) } });
  });

  wishes.filter((w) => w.kind === 'star').forEach((w, i) => {
    const [x, y, z] = STAR_POS[i % STAR_POS.length];
    const g = new THREE.Group(); g.position.set(x, y, z);
    const mat = new THREE.MeshBasicMaterial({ color: w.color });
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.9, 1), mat); g.add(core);
    register(w, root, g, core, mat, 0.9, new THREE.Color(w.color), 9, 0.7, { spin: 0.6, home: new THREE.Vector3(x, y, z) });
  });

  return {
    root, bodies,
    update(t, dt) {
      earth.rotation.y += 0.06 * dt; clouds.rotation.y += 0.075 * dt; moonPivot.rotation.y += 0.25 * dt;
      const ease = Math.min(1, dt * 6);
      bodies.forEach((b, i) => {
        if (!b.paused) {
          if (b.orbit) { b.orbit.angle += b.orbit.speed * dt; b.group.position.set(Math.cos(b.orbit.angle) * b.orbit.r, 0, Math.sin(b.orbit.angle) * b.orbit.r); }
          else if (b.home) b.group.position.y = b.home.y + Math.sin(t * 0.6 + i) * 0.7;
        }
        b.core.rotation.y += b.spin * dt;
        b.moons.forEach((m) => { m.rotation.y += (m.userData.speed as number) * dt; });
        b.group.getWorldPosition(b.pos);
        // Làm sáng vật được chọn/rê chuột, giảm sáng các vật còn lại
        b.hl += (b.hlT - b.hl) * ease; b.dim += (b.dimT - b.dim) * ease;
        b.mat.color.copy(b.baseColor).multiplyScalar(1 - b.dim * 0.55);
        if (b.mat instanceof THREE.MeshStandardMaterial) b.mat.emissiveIntensity = 0.1 + b.hl * 0.9;
        b.halo.material.opacity = (b.haloBase + b.hl * 0.5) * (1 - b.dim * 0.6);
      });
    },
    dispose() { disposeTree(root); },
  };
}
