// Builds an epoch's world from a style descriptor: instanced primitives in arrangements, animated to the beat.
import * as THREE from 'three';

const geoCache = {};
function geometry(shape) {
  if (geoCache[shape]) return geoCache[shape];
  let g;
  switch (shape) {
    case 'box': g = new THREE.BoxGeometry(1, 1, 1); break;
    case 'sphere': g = new THREE.SphereGeometry(0.5, 20, 14); break;
    case 'cylinder': g = new THREE.CylinderGeometry(0.5, 0.5, 1, 20); break;
    case 'cone': g = new THREE.ConeGeometry(0.5, 1, 20, 1, true); break;
    case 'torus': g = new THREE.TorusGeometry(0.5, 0.12, 12, 40); break;
    case 'knot': g = new THREE.TorusKnotGeometry(0.4, 0.12, 80, 10); break;
    case 'ico': g = new THREE.IcosahedronGeometry(0.5, 1); break;
    case 'card': g = new THREE.BoxGeometry(1, 1.6, 0.04); break;
    case 'ring': g = new THREE.RingGeometry(0.2, 0.5, 32); break;
    case 'capsule': g = new THREE.CapsuleGeometry(0.5, 1, 6, 12); break;
    case 'tetra': g = new THREE.TetrahedronGeometry(0.6, 0); break;
    case 'octa': g = new THREE.OctahedronGeometry(0.5, 0); break;
    case 'disc': g = new THREE.CylinderGeometry(0.5, 0.5, 0.03, 36); break;
    case 'bar': g = new THREE.BoxGeometry(1, 1, 1); break;
    default: g = new THREE.BoxGeometry(1, 1, 1);
  }
  geoCache[shape] = g;
  return g;
}

function material(kind, color, opacity = 1, flat = false) {
  const c = new THREE.Color(color);
  let m;
  switch (kind) {
    case 'metal': m = new THREE.MeshStandardMaterial({ color: c, metalness: 0.95, roughness: 0.22, flatShading: flat }); break;
    case 'neon': m = new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 1.25, roughness: 0.6, metalness: 0 }); break;
    case 'glass': m = new THREE.MeshStandardMaterial({ color: c, metalness: 0.3, roughness: 0.08, transparent: true, opacity: Math.min(opacity, 0.45), depthWrite: false }); break;
    case 'wire': m = new THREE.MeshBasicMaterial({ color: c, wireframe: true, transparent: true, opacity: Math.min(opacity, 0.8) }); break;
    default: m = new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, metalness: 0.05, flatShading: flat });
  }
  m.transparent = true;
  m.opacity = Math.min(m.opacity ?? 1, opacity);
  m.userData.baseOpacity = m.opacity;
  m.userData.baseEmissive = m.emissiveIntensity ?? 0;
  return m;
}

function seeded(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

export function buildEpochWorld(style, seed = 1) {
  const group = new THREE.Group();
  const rnd = seeded(seed * 7919 + 13);
  const layers = [];
  const palette = { primary: style.primary, secondary: style.secondary, accent: style.accent };

  style.layers.forEach((L, li) => {
    const geo = geometry(L.shape);
    const mat = material(L.material, palette[L.color], L.opacity ?? 1, L.flat);
    const mesh = new THREE.InstancedMesh(geo, mat, L.count);
    mesh.castShadow = false; mesh.frustumCulled = false;
    const items = [];
    const h0 = L.height ?? 1;
    const mix = L.mixColor ? new THREE.Color(palette[L.mixColor]) : null;
    const base = new THREE.Color(palette[L.color]);
    for (let i = 0; i < L.count; i++) {
      const u = L.count > 1 ? i / L.count : 0;
      const s = L.size[0] + rnd() * 0;
      let pos = new THREE.Vector3(), rot = new THREE.Euler(), scale = new THREE.Vector3(1, 1, 1);
      const sz = L.size;
      switch (L.arrange) {
        case 'ring': { const a = u * Math.PI * 2; pos.set(Math.cos(a) * L.radius, h0, Math.sin(a) * L.radius); rot.set(L.tilt ? L.tilt : 0, -a + (L.faceOut ? Math.PI / 2 : -Math.PI / 2), 0); scale.set(sz[0], sz[1], sz[0]); break; }
        case 'spiral': { const a = u * Math.PI * 4; const r = L.radius * (0.4 + 0.6 * u); pos.set(Math.cos(a) * r, h0 + u * 5, Math.sin(a) * r); rot.set(0, -a + Math.PI / 2, 0); scale.set(sz[0], sz[1], sz[0]); break; }
        case 'grid': { const n = Math.ceil(Math.sqrt(L.count)); const gx = (i % n) / (n - 1) - 0.5, gz = Math.floor(i / n) / (n - 1) - 0.5; pos.set(gx * L.radius * 2, h0 + (L.random ? rnd() * 3 : 0), gz * L.radius * 2 - 2); const s2 = sz[0] + rnd() * (sz[1] - sz[0]); scale.set(s2, s2, s2); break; }
        case 'scatter': { const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * L.radius; pos.set(Math.cos(a) * r, rnd() * h0 * 2 + 0.3, Math.sin(a) * r); const s2 = sz[0] + rnd() * (sz[1] - sz[0]); scale.set(s2, s2, s2); rot.set(rnd() * 6, rnd() * 6, rnd() * 6); break; }
        case 'wall': { const a = Math.PI * 0.15 + u * Math.PI * 0.7 + Math.PI; const tier = i % 3; pos.set(Math.cos(a) * (L.radius + tier * 1.2), h0 + tier * 1.3 + (L.motion === 'scroll' ? rnd() * 6 : 0), Math.sin(a) * (L.radius + tier * 1.2)); rot.set(0, -a - Math.PI / 2, L.tilt || 0); scale.set(sz[0], sz[1], sz[0]); break; }
        case 'pillars': { const a = u * Math.PI * 2 + 0.3; pos.set(Math.cos(a) * L.radius, sz[1] / 2 - 0.5, Math.sin(a) * L.radius); scale.set(sz[0], sz[1], sz[0]); if (L.shape === 'cone') { pos.y = sz[1] / 2; rot.set(Math.PI, 0, 0); } break; }
        case 'orbit': { const a = rnd() * Math.PI * 2, el = (rnd() - 0.5) * 1.2; pos.set(Math.cos(a) * Math.cos(el) * L.radius, h0 + Math.sin(el) * L.radius * 0.5, Math.sin(a) * Math.cos(el) * L.radius); const s2 = sz[0] + rnd() * (sz[1] - sz[0]); scale.set(s2, s2, s2); rot.set(rnd() * 6, rnd() * 6, 0); break; }
        case 'tower': { const col = i % 10, row = Math.floor(i / 10); const a = (col / 10) * Math.PI * 2; pos.set(Math.cos(a) * L.radius, row * 1.9 + rnd() * 0.5, Math.sin(a) * L.radius); rot.set(0, -a - Math.PI / 2, 0); scale.set(sz[1], sz[1], sz[1]); break; }
        case 'halo': { const a = u * Math.PI * 2; const r = L.radius + (i % 3) * 0.6; pos.set(Math.cos(a) * r, h0 + 4 + (i % 3) * 1.5, Math.sin(a) * r); const s2 = sz[0] + rnd() * (sz[1] - sz[0]); scale.set(s2, s2, s2); break; }
      }
      // Keep the camera's sector clear: the rig sits at z ≈ 11.5 looking toward -z.
      if (pos.z > 5 && Math.abs(pos.x) < 5) { pos.z = -pos.z; if (L.arrange === 'ring' || L.arrange === 'wall' || L.arrange === 'pillars') rot.y += Math.PI; }
      if (L.shape === 'card' && L.arrange !== 'tower') scale.set(sz[1] * 0.7, sz[1], 1);
      if (L.shape === 'bar') { scale.set(sz[0], sz[1], sz[0]); if (L.arrange !== 'pillars') pos.y = L.eq ? sz[1] / 2 : h0 + sz[1] / 2 - 1; }
      if (L.shape === 'disc' && L.arrange === 'orbit') rot.set(rnd() * 1.2, rnd() * 6, 0);
      items.push({ pos, rot, scale, phase: rnd() * Math.PI * 2, speed: 0.5 + rnd(), idx: i, seedv: rnd() });
      if (mix) mesh.setColorAt(i, base.clone().lerp(mix, rnd()));
    }
    if (mix) mesh.instanceColor.needsUpdate = true;
    group.add(mesh);
    layers.push({ L, mesh, items, mat });
  });

  // Materialize state
  const dummy = new THREE.Object3D();
  const state = { reveal: 0, time: 0 };
  group.userData.setReveal = (x) => { state.reveal = x; };
  group.userData.ghost = style.ghost ?? 1;

  group.userData.animate = (dt, beat, year) => {
    state.time += dt;
    const t = state.time;
    const rv = state.reveal;
    const ease = rv < 1 ? 1 - Math.pow(1 - rv, 3) : 1;
    const ghost = group.userData.ghost;
    const pulse = beat?.pulse ?? 0;
    const phase = beat?.phase ?? 0;
    for (const { L, mesh, items, mat } of layers) {
      mat.opacity = mat.userData.baseOpacity * Math.min(1, ease * 1.2) * (ghost < 1 ? 0.55 + 0.45 * ghost : 1);
      if (mat.emissiveIntensity !== undefined && mat.userData.baseEmissive) mat.emissiveIntensity = mat.userData.baseEmissive * (0.8 + 0.5 * pulse);
      for (const it of items) {
        const { pos, rot, scale, phase: ph, speed, idx } = it;
        dummy.position.copy(pos);
        dummy.rotation.copy(rot);
        dummy.scale.copy(scale);
        switch (L.motion) {
          case 'spin': dummy.rotation.y += t * speed * 0.8; if (L.shape === 'disc' || L.shape === 'card') dummy.rotation.z += t * speed * 0.3; break;
          case 'bob': dummy.position.y += Math.sin(t * speed * 1.3 + ph) * 0.25; break;
          case 'pulse': { let k; if (L.eq) { k = 0.3 + 0.7 * Math.abs(Math.sin(t * 3 + idx * 0.37)) * (0.6 + pulse); dummy.scale.y = scale.y * k; dummy.position.y = dummy.scale.y / 2; } else if (L.wave) { k = 1 + 0.6 * Math.max(0, Math.sin(t * 2.2 - idx * 0.08)) * (0.5 + pulse); dummy.scale.multiplyScalar(k); } else { k = 1 + 0.25 * pulse * Math.sin(ph) + 0.08 * Math.sin(t * 2 + ph); dummy.scale.multiplyScalar(k); } break; }
          case 'orbit': { const a = t * speed * 0.25 + ph; const r = Math.hypot(pos.x, pos.z); dummy.position.x = Math.cos(a) * r; dummy.position.z = Math.sin(a) * r; dummy.rotation.y += t * 0.5; break; }
          case 'scroll': { const H = L.arrange === 'tower' ? 9.5 : 7; const y = ((pos.y + t * speed * 0.9) % H + H) % H; dummy.position.y = y; break; }
          case 'flicker': { const f = Math.sin(t * (6 + speed * 9) + ph) > (0.3 - pulse * 0.5) ? 1 : 0.35; dummy.scale.multiplyScalar(f); break; }
          case 'sway': dummy.rotation.z += Math.sin(t * 0.6 * speed + ph) * 0.12; dummy.rotation.x += Math.cos(t * 0.5 * speed + ph) * 0.08; break;
        }
        if (ghost < 1) { const j = (1 - ghost) * 0.18; dummy.position.x += Math.sin(t * 7 + ph * 3) * j; dummy.position.y += Math.cos(t * 5.3 + ph) * j; }
        // materialize: rise and grow from the centre outward
        const dist = Math.hypot(pos.x, pos.z) / 14;
        const local = Math.min(1, Math.max(0, (ease * 1.4 - dist)));
        const le = 1 - Math.pow(1 - local, 2);
        dummy.scale.multiplyScalar(le);
        dummy.position.y = dummy.position.y * le + (1 - le) * -1;
        dummy.updateMatrix();
        mesh.setMatrixAt(idx, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
    }
  };
  return group;
}
