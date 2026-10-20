import * as THREE from 'three';
import { cloudTexture, disposeTree, glow, softDot, sparkleTexture } from './textures';
import { prefersReducedMotion } from '../utils';

const PALETTE = ['#F7F5FF', '#FFE6A0', '#71E8FF', '#FF77C8'].map((c) => new THREE.Color(c));
const rand = (a: number, b: number): number => a + Math.random() * (b - a);
const gauss = (): number => (Math.random() + Math.random() + Math.random() - 1.5) / 0.5; // xấp xỉ phân phối chuẩn
const ADD = THREE.AdditiveBlending;

export interface Starfield { group: THREE.Group; update: (t: number, dt: number) => void; setLevel: (tier: number) => void; dispose: () => void }

function shell(n: number, r0: number, r1: number): THREE.BufferGeometry {
  const pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const r = rand(r0, r1), u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, s = Math.sqrt(1 - u * u);
    pos.set([r * s * Math.cos(a), r * u, r * s * Math.sin(a)], i * 3);
    const c = PALETTE[Math.random() < 0.7 ? 0 : 1 + ((Math.random() * 3) | 0)], k = 0.5 + Math.random() * 0.5;
    col.set([c.r * k, c.g * k, c.b * k], i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}
function pts(geo: THREE.BufferGeometry, size: number, opacity: number): THREE.Points {
  return new THREE.Points(geo, new THREE.PointsMaterial({ size, map: softDot(), vertexColors: true, transparent: true, opacity, depthWrite: false, blending: ADD, sizeAttenuation: true }));
}

/** Dải ngân hà: vòng sao dày, nghiêng, có vệt sáng/tối và quầng mây mờ */
function band(n: number, tx: number, tz: number, tints: string[], seed: number): { tilt: THREE.Group; spin: THREE.Group; clouds: THREE.Sprite[] } {
  const tilt = new THREE.Group(), spin = new THREE.Group(); tilt.rotation.set(tx, 0, tz); tilt.add(spin);
  const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), cs = tints.map((c) => new THREE.Color(c));
  for (let i = 0; i < n;) {
    const a = Math.random() * Math.PI * 2;
    if (Math.random() > 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(a * 2 + seed))) continue;
    const r = 450 + gauss() * 35, y = gauss() * 22, c = cs[(Math.random() * cs.length) | 0], k = 0.35 + Math.random() * 0.65 * (1 - Math.min(1, Math.abs(y) / 60));
    pos.set([Math.cos(a) * r, y, Math.sin(a) * r], i * 3); col.set([c.r * k, c.g * k, c.b * k], i * 3); i++;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  spin.add(pts(g, 3.2, 0.8));
  const clouds: THREE.Sprite[] = [];
  for (let j = 0; j < 14; j++) {
    const a = (j / 14) * Math.PI * 2, m = new THREE.SpriteMaterial({ map: cloudTexture(seed + (j % 3)), color: cs[j % cs.length], transparent: true, opacity: 0.14, depthWrite: false, blending: ADD });
    m.rotation = rand(0, 6.28); const s = new THREE.Sprite(m); s.position.set(Math.cos(a) * 450, 0, Math.sin(a) * 450); s.scale.set(230, 230, 1); spin.add(s); clouds.push(s);
  }
  return { tilt, spin, clouds };
}

/** Thiên hà xoắn ốc ở xa */
function spiral(n: number, R: number, core: string, edge: string, p: [number, number, number], rot: [number, number, number]): { g: THREE.Group; disc: THREE.Points } {
  const g = new THREE.Group(); g.position.set(p[0], p[1], p[2]); g.rotation.set(rot[0], rot[1], rot[2]);
  const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), a0 = new THREE.Color(core), a1 = new THREE.Color(edge), tmp = new THREE.Color();
  for (let i = 0; i < n; i++) {
    const t = Math.pow(Math.random(), 0.7), r = t * R, ang = t * 5.2 + (i % 2) * Math.PI + gauss() * (0.55 - 0.35 * t), y = gauss() * R * 0.025 * (1 - t * 0.5);
    pos.set([Math.cos(ang) * r, y, Math.sin(ang) * r], i * 3);
    tmp.copy(a0).lerp(a1, t); const k = 0.5 + Math.random() * 0.5; col.set([tmp.r * k, tmp.g * k, tmp.b * k], i * 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const disc = pts(geo, 4, 0.85);
  const heart = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow(), color: core, transparent: true, opacity: 0.6, depthWrite: false, blending: ADD }));
  heart.scale.setScalar(R * 0.9); g.add(disc, heart); return { g, disc };
}

interface Meteor { pts: THREE.Points; pos: THREE.BufferAttribute; col: THREE.BufferAttribute; active: boolean; t: number; life: number; head: THREE.Vector3; vel: THREE.Vector3; tint: THREE.Color }
const MN = 18;

/** k: hệ số số lượng hạt (1 = đầy đủ, nhỏ hơn = nhẹ hơn) */
export function createStarfield(k: number, camera: THREE.Camera): Starfield {
  const group = new THREE.Group();

  // 3 lớp sao ở 3 khoảng cách (thị sai), mỗi lớp nhấp nháy theo nhịp riêng
  const specs = [
    { n: 2200 * k, r0: 350, r1: 700, size: 3.5, base: 0.8, speed: 0.9, spin: 0.004 },
    { n: 1200 * k, r0: 160, r1: 350, size: 2.2, base: 0.85, speed: 1.5, spin: 0.008 },
    { n: 450 * k, r0: 70, r1: 160, size: 1.0, base: 0.9, speed: 2.2, spin: 0.014 },
  ];
  const layers = specs.map((s) => { const p = pts(shell(s.n, s.r0, s.r1), s.size, s.base); group.add(p); return { p, ...s }; });
  const dust = pts(shell(300 * k, 8, 70), 0.35, 0.5); group.add(dust);

  // Dải ngân hà (2 dải cắt nhau) và thiên hà xoắn ốc
  const bands = [band(5000 * k, 0.9, 0.3, ['#FF77C8', '#7655F6', '#F7F5FF'], 1), band(3000 * k, -0.5, -0.9, ['#71E8FF', '#7655F6', '#F7F5FF'], 2)];
  bands.forEach((b) => group.add(b.tilt));
  const gals = [spiral(2500 * k, 110, '#FFE6A0', '#FF77C8', [-330, 140, -380], [0.9, 0, 0.4]), spiral(2000 * k, 90, '#F7F5FF', '#71E8FF', [360, -110, 300], [-0.7, 0, -0.3])];
  gals.forEach((x) => group.add(x.g));

  // Sao lấp lánh 4 cánh, mỗi ngôi nhấp nháy riêng
  const sparks = Array.from({ length: Math.round(36 * k) }, () => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: sparkleTexture(), color: PALETTE[(Math.random() * 4) | 0], transparent: true, opacity: 0.8, depthWrite: false, blending: ADD }));
    const r = rand(120, 420), u = Math.random() * 2 - 1, a = Math.random() * 6.283, sn = Math.sqrt(1 - u * u);
    s.position.set(r * sn * Math.cos(a), r * u, r * sn * Math.sin(a)); s.scale.setScalar(rand(8, 18) * (r / 250)); group.add(s);
    return { s, ph: rand(0, 6.28), sp: rand(0.6, 2.2) };
  });

  // Tinh vân "sống": xoay và đổi độ sáng rất chậm
  const neb: [string, number, number, number, number, number, number][] = [
    ['#7655F6', -200, 60, -250, 340, 0.3, 1], ['#FF77C8', 230, -40, -200, 320, 0.22, 2], ['#71E8FF', -60, -120, 260, 360, 0.18, 3],
    ['#7655F6', 120, 150, 220, 300, 0.2, 2], ['#FF77C8', -260, 100, 100, 280, 0.18, 3], ['#71E8FF', 260, 60, 60, 260, 0.16, 1],
    ['#FF77C8', -120, -160, -260, 320, 0.18, 1], ['#7655F6', 300, -120, -120, 300, 0.2, 3], ['#71E8FF', -300, -40, -100, 300, 0.16, 2],
  ];
  const nebs = neb.map(([c, x, y, z, s, o, seed]) => {
    const m = new THREE.SpriteMaterial({ map: cloudTexture(seed), color: c, transparent: true, opacity: o, depthWrite: false, blending: ADD, fog: false });
    m.rotation = rand(0, 6.28); const sp = new THREE.Sprite(m); sp.position.set(x, y, z); sp.scale.set(s, s, 1); group.add(sp);
    return { m, o, spr: sp, sp: rand(0.15, 0.4), ph: rand(0, 6.28), rs: rand(-0.02, 0.02) };
  });

  // Sao băng: đầu sáng + đuôi mờ dần, xuất hiện ngẫu nhiên trong tầm nhìn của camera
  const meteors: Meteor[] = Array.from({ length: 3 }, () => {
    const pa = new THREE.BufferAttribute(new Float32Array(MN * 3), 3), ca = new THREE.BufferAttribute(new Float32Array(MN * 3), 3), g = new THREE.BufferGeometry();
    g.setAttribute('position', pa); g.setAttribute('color', ca);
    const p = new THREE.Points(g, new THREE.PointsMaterial({ size: 2.2, map: softDot(), vertexColors: true, transparent: true, depthWrite: false, blending: ADD }));
    p.frustumCulled = false; p.visible = false; group.add(p);
    return { pts: p, pos: pa, col: ca, active: false, t: 0, life: 1, head: new THREE.Vector3(), vel: new THREE.Vector3(), tint: new THREE.Color() };
  });
  const dir = new THREE.Vector3(), right = new THREE.Vector3(), up = new THREE.Vector3(), reduce = prefersReducedMotion();
  let nextMeteor = 3;
  function spawn(m: Meteor): void {
    camera.getWorldDirection(dir); right.crossVectors(dir, camera.up).normalize(); up.crossVectors(right, dir).normalize();
    const side = Math.random() < 0.5 ? -1 : 1;
    m.head.copy(camera.position).addScaledVector(dir, rand(90, 170)).addScaledVector(right, -side * rand(50, 90)).addScaledVector(up, rand(15, 60));
    m.vel.set(0, 0, 0).addScaledVector(right, side * rand(80, 120)).addScaledVector(up, -rand(20, 50));
    m.tint.set(Math.random() < 0.5 ? '#cfe9ff' : '#ffd6f0'); m.t = 0; m.life = rand(1, 1.6); m.active = true; m.pts.visible = true;
  }
  function stepMeteor(m: Meteor, dt: number): void {
    m.t += dt; const f = m.t / m.life;
    if (f >= 1) { m.active = false; m.pts.visible = false; return; }
    m.head.addScaledVector(m.vel, dt); const fade = Math.sin(Math.PI * f);
    for (let i = 0; i < MN; i++) {
      const q = i / MN, a = (1 - q) * (1 - q) * fade;
      m.pos.setXYZ(i, m.head.x - m.vel.x * q * 0.18, m.head.y - m.vel.y * q * 0.18, m.head.z - m.vel.z * q * 0.18);
      m.col.setXYZ(i, m.tint.r * a, m.tint.g * a, m.tint.b * a);
    }
    m.pos.needsUpdate = true; m.col.needsUpdate = true;
  }

  return {
    group,
    // Mức chất lượng thấp: ẩn bớt các lớp mây/tinh vân khổng lồ (chúng chồng lên nhau, rất tốn GPU)
    setLevel(tier) {
      bands.forEach((b) => b.clouds.forEach((s, i) => { s.visible = tier < 2 || i % (tier >= 3 ? 4 : 2) === 0; }));
      nebs.forEach((n, i) => { n.spr.visible = tier < 2 || i % 3 === 0 || (tier === 2 && i % 3 === 1); });
    },
    update(t, dt) {
      layers.forEach((l) => { l.p.rotation.y += l.spin * dt; (l.p.material as THREE.PointsMaterial).opacity = l.base + Math.sin(t * l.speed) * 0.12; });
      dust.rotation.y += 0.01 * dt; dust.position.y = Math.sin(t * 0.2) * 2;
      bands.forEach((b, i) => { b.spin.rotation.y += (0.003 + i * 0.002) * dt; });
      gals.forEach((x) => { x.disc.rotation.y += 0.01 * dt; });
      sparks.forEach((x) => { x.s.material.opacity = 0.35 + 0.6 * (0.5 + 0.5 * Math.sin(t * x.sp + x.ph)); });
      nebs.forEach((n) => { n.m.rotation += n.rs * dt; n.m.opacity = n.o * (0.8 + 0.2 * Math.sin(t * n.sp + n.ph)); });
      if (!reduce) {
        if (t >= nextMeteor) { const m = meteors.find((x) => !x.active); if (m) spawn(m); nextMeteor = t + rand(3, 7); }
        meteors.forEach((m) => { if (m.active) stepMeteor(m, dt); });
      }
    },
    dispose() { disposeTree(group); },
  };
}
