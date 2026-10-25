// The Kairos orrery: three rings (Skill, Environment, Need) each carrying a bead.
// Skill accumulates slowly, Environment changes in steps, Need oscillates like a pendulum.
// A lock is when all three beads reach the zenith at once: then a beam fires.
import * as THREE from 'three';

export const KAIROS_COLORS = { skill: 0x9d9bff, env: 0x3fe0b4, need: 0xf6c35a };

export class Orrery {
  constructor() {
    this.group = new THREE.Group();
    this.group.position.set(0, 2.6, 0);
    this.rings = [];
    const specs = [
      { key: 'skill', R: 2.0, tilt: new THREE.Euler(Math.PI / 2, 0, 0), color: KAIROS_COLORS.skill },
      { key: 'env', R: 2.55, tilt: new THREE.Euler(Math.PI / 2 - 0.9, 0.4, 0), color: KAIROS_COLORS.env },
      { key: 'need', R: 3.1, tilt: new THREE.Euler(Math.PI / 2 + 0.75, -0.5, 0.2), color: KAIROS_COLORS.need },
    ];
    for (const s of specs) {
      const holder = new THREE.Group(); holder.rotation.copy(s.tilt);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(s.R, 0.02, 8, 120), new THREE.MeshStandardMaterial({ color: s.color, emissive: s.color, emissiveIntensity: 0.6, roughness: 0.4, metalness: 0.6, transparent: true, opacity: 0.85 }));
      holder.add(ring);
      const bead = new THREE.Mesh(new THREE.SphereGeometry(0.14, 20, 14), new THREE.MeshStandardMaterial({ color: s.color, emissive: s.color, emissiveIntensity: 2.4, roughness: 0.3 }));
      holder.add(bead);
      const trail = new THREE.Mesh(new THREE.TorusGeometry(s.R, 0.045, 8, 80, 0.9), new THREE.MeshBasicMaterial({ color: s.color, transparent: true, opacity: 0.35 }));
      holder.add(trail);
      const light = new THREE.PointLight(s.color, 0, 8, 2); holder.add(light);
      this.group.add(holder);
      // zenith angle: the ring angle whose world y is highest
      holder.updateMatrixWorld(true);
      let bestA = 0, bestY = -Infinity; const v = new THREE.Vector3();
      for (let k = 0; k < 256; k++) { const a = (k / 256) * Math.PI * 2; v.set(Math.cos(a) * s.R, Math.sin(a) * s.R, 0).applyEuler(s.tilt); if (v.y > bestY) { bestY = v.y; bestA = a; } }
      this.rings.push({ ...s, holder, ring, bead, trail, light, angle: Math.random() * Math.PI * 2, target: null, zenith: bestA, fit: 1, vel: 0 });
    }
    // Lock beam + flash ring + core
    this.beam = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.6, 40, 24, 1, true), new THREE.MeshBasicMaterial({ color: 0xfff1c8, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.beam.position.y = 20; this.group.add(this.beam);
    this.flash = new THREE.Mesh(new THREE.RingGeometry(0.4, 0.6, 64), new THREE.MeshBasicMaterial({ color: 0xffe9b0, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.flash.rotation.x = -Math.PI / 2; this.flash.position.y = -2.4; this.group.add(this.flash);
    this.core = new THREE.Mesh(new THREE.SphereGeometry(0.22, 24, 16), new THREE.MeshBasicMaterial({ color: 0xfff7e0, transparent: true, opacity: 0 }));
    this.group.add(this.core);
    this.coreLight = new THREE.PointLight(0xffe2a0, 0, 20, 2); this.group.add(this.coreLight);
    this.locking = false; this.lockT = 0; this.locked = false; this.strength = 0; this.flashT = 0; this.time = 0;
    this.onLocked = null;
    this.idleSpeed = 1;
  }

  setArtist(artist) {
    // Beads head toward the zenith, offset by how much each component was missing.
    this.locking = true; this.locked = false; this.lockT = 0;
    const fit = artist?.fit || { skill: 1, env: 1, need: 1 };
    for (const r of this.rings) {
      r.fit = fit[r.key] ?? 1;
      const miss = (1 - r.fit) * Math.PI; // a missing component sits on the far side
      r.target = r.zenith - miss * (r.key === 'need' ? 1 : -1);
    }
    this.strength = Math.min(fit.skill, fit.env, fit.need) * (fit.skill * fit.env * fit.need);
  }

  release() { this.locking = false; this.locked = false; for (const r of this.rings) r.target = null; }

  update(dt, year, beat) {
    this.time += dt;
    const t = this.time;
    const pulse = beat?.pulse ?? 0;
    for (const r of this.rings) {
      if (r.target != null) {
        // ease toward the target angle along the shortest arc with a bit of overshoot
        let d = ((r.target - r.angle + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
        r.vel += d * 14 * dt - r.vel * 6 * dt;
        r.angle += r.vel * dt;
      } else {
        // idle dynamics
        if (r.key === 'skill') r.angle += dt * 0.35 * this.idleSpeed;
        else if (r.key === 'env') { r.angle += dt * 0.15; if (Math.floor(t * 0.45) !== Math.floor((t - dt) * 0.45)) r.vel = 2.2; r.angle += r.vel * dt; r.vel *= Math.exp(-dt * 5); }
        else r.angle = r.zenith + Math.PI + Math.sin(t * 0.55) * 2.4;
      }
      r.bead.position.set(Math.cos(r.angle) * r.R, Math.sin(r.angle) * r.R, 0);
      r.trail.rotation.z = r.angle - 0.9;
      r.light.position.copy(r.bead.position);
      r.light.intensity = 0.8 + pulse * 1.2;
      const s = 0.8 + r.fit * 0.5 + pulse * 0.2; r.bead.scale.setScalar(s);
      r.holder.rotation.z += dt * 0.02 * (r.key === 'need' ? -1 : 1) * (r.target == null ? 1 : 0);
    }
    if (this.locking) {
      this.lockT += dt;
      const settled = this.rings.every((r) => Math.abs(r.vel) < 0.2 && Math.abs(((r.target - r.angle + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI) < 0.08);
      if ((settled && this.lockT > 0.6) || this.lockT > 2.5) {
        this.locking = false; this.locked = true; this.flashT = 0;
        if (this.onLocked) this.onLocked(this.strength);
      }
    }
    // beam and flash
    const target = this.locked ? this.strength : 0;
    const bm = this.beam.material; bm.opacity += (target * 0.55 - bm.opacity) * Math.min(1, dt * 4);
    this.beam.scale.x = this.beam.scale.z = 0.8 + 0.2 * Math.sin(t * 9) + pulse * 0.3;
    this.core.material.opacity += ((this.locked ? 0.9 : 0) - this.core.material.opacity) * Math.min(1, dt * 4);
    this.core.scale.setScalar(1 + pulse * 0.5 + 0.1 * Math.sin(t * 6));
    const zen = this.rings[0]; const zp = new THREE.Vector3(Math.cos(zen.zenith) * zen.R, Math.sin(zen.zenith) * zen.R, 0).applyEuler(zen.tilt);
    this.core.position.copy(zp); this.coreLight.position.copy(zp); this.beam.position.set(zp.x, zp.y + 20, zp.z);
    this.coreLight.intensity = this.locked ? 6 * this.strength + pulse * 3 : 0;
    if (this.locked) { this.flashT += dt; const f = this.flash; const k = Math.min(1, this.flashT / 1.4); f.scale.setScalar(1 + k * 30); f.material.opacity = (1 - k) * 0.8 * this.strength; }
    else this.flash.material.opacity = 0;
  }
}
