// The 3D world: renderer, camera rig, sky, ground, epoch worlds, the orrery, the chronal tunnel, post-processing.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { SKY_VERT, SKY_FRAG, GROUND_VERT, GROUND_FRAG, TUNNEL_VERT, TUNNEL_FRAG, POST_FRAG } from './shaders.js';
import { buildEpochWorld } from './epochWorld.js';
import { Orrery } from './orrery.js';
import { STYLES } from '../data/styles.js';
import { EPOCHS } from '../data/epochs.js';

const GROUND_MODE = { disc: 0, grid: 1, tiles: 2, water: 3 };
const lerp = (a, b, t) => a + (b - a) * t;

export class World {
  constructor(canvas) {
    this.canvas = canvas;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.88;
    this.renderer = renderer;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x070a12, 0.012);
    this.camera = new THREE.PerspectiveCamera(58, 1, 0.1, 600);
    this.rig = new THREE.Group(); this.rig.position.set(0, 2.4, 11.5); this.rig.add(this.camera); this.scene.add(this.rig);
    this.look = { yaw: 0, pitch: 0, tyaw: 0, tpitch: 0 };

    // Lights
    this.hemi = new THREE.HemisphereLight(0x8899ff, 0x221133, 0.9); this.scene.add(this.hemi);
    this.key = new THREE.DirectionalLight(0xffffff, 1.4); this.key.position.set(6, 12, 8); this.scene.add(this.key);
    this.p1 = new THREE.PointLight(0xffaa55, 30, 40, 2); this.p1.position.set(6, 5, 2); this.scene.add(this.p1);
    this.p2 = new THREE.PointLight(0x55aaff, 30, 40, 2); this.p2.position.set(-6, 4, -3); this.scene.add(this.p2);

    // Sky
    this.skyMat = new THREE.ShaderMaterial({ vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { uTop: { value: new THREE.Color(0x0a0f22) }, uBottom: { value: new THREE.Color(0x02030a) }, uTime: { value: 0 }, uStars: { value: 1 } } });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(420, 32, 16), this.skyMat); this.scene.add(this.sky);

    // Ground
    this.groundMat = new THREE.ShaderMaterial({ vertexShader: GROUND_VERT, fragmentShader: GROUND_FRAG, fog: false,
      uniforms: { uColor: { value: new THREE.Color(0x111827) }, uAlt: { value: new THREE.Color(0x334) }, uFog: { value: new THREE.Color(0x070a12) }, uMode: { value: 1 }, uTime: { value: 0 }, uBeat: { value: 0 }, uReveal: { value: 0 }, uTravel: { value: 0 } } });
    this.ground = new THREE.Mesh(new THREE.CircleGeometry(90, 64), this.groundMat); this.ground.rotation.x = -Math.PI / 2; this.scene.add(this.ground);

    // Tunnel (surrounds the rig, extends forward)
    this.tunnelMat = new THREE.ShaderMaterial({ vertexShader: TUNNEL_VERT, fragmentShader: TUNNEL_FRAG, side: THREE.BackSide, transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uScroll: { value: 0 }, uSpeed: { value: 0 }, uDoppler: { value: 0 }, uColA: { value: new THREE.Color(0x5577ff) }, uColB: { value: new THREE.Color(0xff5599) }, uOpacity: { value: 0 } } });
    const tg = new THREE.CylinderGeometry(7.5, 7.5, 260, 48, 1, true); tg.rotateX(Math.PI / 2);
    this.tunnel = new THREE.Mesh(tg, this.tunnelMat); this.tunnel.position.set(0, 2.4, 11.5 - 110); this.tunnel.visible = false; this.scene.add(this.tunnel);

    // Streaks
    const N = 260; this.streaks = new THREE.InstancedMesh(new THREE.BoxGeometry(0.03, 0.03, 1), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending, depthWrite: false }), N);
    this.streakData = []; const d = new THREE.Object3D();
    for (let i = 0; i < N; i++) { const a = Math.random() * Math.PI * 2, r = 1.5 + Math.random() * 5.5; const z = -Math.random() * 200; this.streakData.push({ a, r, z, len: 1 + Math.random() * 3 }); d.position.set(Math.cos(a) * r, 2.4 + Math.sin(a) * r, 11.5 + z); d.scale.set(1, 1, 1); d.updateMatrix(); this.streaks.setMatrixAt(i, d.matrix); }
    this.streaks.frustumCulled = false; this.streaks.visible = false; this.scene.add(this.streaks);

    // Orrery
    this.orrery = new Orrery(); this.orrery.group.position.y = 3.0; this.scene.add(this.orrery.group); this.orreryScale = 1.25;

    // Dust particles (ambient)
    const pg = new THREE.BufferGeometry(); const pn = 600; const pp = new Float32Array(pn * 3);
    for (let i = 0; i < pn; i++) { pp[i * 3] = (Math.random() - 0.5) * 40; pp[i * 3 + 1] = Math.random() * 12; pp[i * 3 + 2] = (Math.random() - 0.5) * 40; }
    pg.setAttribute('position', new THREE.BufferAttribute(pp, 3));
    this.dust = new THREE.Points(pg, new THREE.PointsMaterial({ color: 0xffffff, size: 0.06, transparent: true, opacity: 0.45, depthWrite: false })); this.scene.add(this.dust);

    // Epoch world containers
    this.worldGroup = new THREE.Group(); this.scene.add(this.worldGroup);
    this.current = null; this.currentId = null; this.outgoing = null; this.reveal = 0; this.cache = {};
    this.targetColors = { sky: [new THREE.Color(0x0a0f22), new THREE.Color(0x02030a)], fog: new THREE.Color(0x070a12), ground: new THREE.Color(0x111827), alt: new THREE.Color(0x334466), p1: new THREE.Color(0xffaa55), p2: new THREE.Color(0x55aaff) };
    this.groundMode = 1; this.sun = null;

    // Post
    this.composer = new EffectComposer(renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.45, 0.55, 0.86); this.composer.addPass(this.bloom);
    this.post = new ShaderPass({ uniforms: { tDiffuse: { value: null }, uAberration: { value: 0 }, uDoppler: { value: 0 }, uSpeed: { value: 0 }, uGhost: { value: 0 }, uTime: { value: 0 }, uVignette: { value: 0.55 }, uShake: { value: new THREE.Vector2() } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }', fragmentShader: POST_FRAG });
    this.composer.addPass(this.post);
    this.composer.addPass(new OutputPass());

    this.time = 0; this.travel = 0; this.flashT = 0;
    this.resize();
    this._pointer();
  }

  resize() {
    const w = this.canvas.clientWidth || window.innerWidth, h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false); this.composer.setSize(w, h);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  }

  _pointer() {
    let down = false, lx = 0, ly = 0;
    const c = this.canvas;
    c.addEventListener('pointerdown', (e) => { down = true; lx = e.clientX; ly = e.clientY; c.setPointerCapture(e.pointerId); });
    c.addEventListener('pointermove', (e) => { if (!down) return; const dx = e.clientX - lx, dy = e.clientY - ly; lx = e.clientX; ly = e.clientY; this.look.tyaw = THREE.MathUtils.clamp(this.look.tyaw - dx * 0.004, -1.1, 1.1); this.look.tpitch = THREE.MathUtils.clamp(this.look.tpitch - dy * 0.003, -0.35, 0.6); });
    const up = () => { down = false; }; c.addEventListener('pointerup', up); c.addEventListener('pointercancel', up);
  }

  // Switch the visible epoch world (null = the interstice: nothing but sky, ground and the orrery).
  setEpoch(epoch) {
    const id = epoch ? epoch.id : null;
    if (id === this.currentId) return;
    this.currentId = id;
    if (this.current) { this.outgoing = this.current; this.outgoingT = 0; }
    this.current = null; this.reveal = 0;
    if (epoch) {
      const style = STYLES[epoch.id];
      if (!this.cache[id]) { this.cache[id] = buildEpochWorld(style, EPOCHS.indexOf(epoch) + 1); }
      this.current = this.cache[id]; this.current.userData.setReveal(0); this.worldGroup.add(this.current);
      this.targetColors.sky = [new THREE.Color(style.sky[0]), new THREE.Color(style.sky[1])];
      this.targetColors.fog = new THREE.Color(style.fog);
      this.targetColors.ground = new THREE.Color(style.groundColor); this.targetColors.alt = new THREE.Color(style.groundAlt);
      this.targetColors.p1 = new THREE.Color(style.primary); this.targetColors.p2 = new THREE.Color(style.secondary);
      this.groundMode = GROUND_MODE[style.ground] ?? 0;
      this.groundMat.uniforms.uMode.value = this.groundMode;
      this.orrery.group.visible = true;
      if (style.sun && !this.sun) { this.sun = new THREE.Mesh(new THREE.CircleGeometry(14, 48), new THREE.MeshBasicMaterial({ color: 0xff8a3a, transparent: true, opacity: 0.0, fog: false })); this.sun.position.set(0, 10, -70); this.scene.add(this.sun); }
      this.sunTarget = style.sun ? 0.9 : 0;
    } else {
      this.targetColors.sky = [new THREE.Color(0x0a0f22), new THREE.Color(0x02030a)];
      this.targetColors.fog = new THREE.Color(0x070a12); this.targetColors.ground = new THREE.Color(0x0d1220); this.targetColors.alt = new THREE.Color(0x24304d);
      this.targetColors.p1 = new THREE.Color(0x7fd6ff); this.targetColors.p2 = new THREE.Color(0xf2b84b);
      this.groundMode = 1; this.groundMat.uniforms.uMode.value = 1; this.sunTarget = 0;
    }
  }

  lockArtist(artist) { this.orrery.setArtist(artist); }
  releaseLock() { this.orrery.release(); }

  // Year → tunnel colour, interpolated between the surrounding epochs' palettes.
  _tunnelColors(year) {
    let a = EPOCHS[0], b = EPOCHS[EPOCHS.length - 1];
    for (let i = 0; i < EPOCHS.length - 1; i++) { if (year >= EPOCHS[i].center && year <= EPOCHS[i + 1].center) { a = EPOCHS[i]; b = EPOCHS[i + 1]; break; } }
    const t = THREE.MathUtils.clamp((year - a.center) / Math.max(1, b.center - a.center), 0, 1);
    const ca = new THREE.Color(STYLES[a.id].primary), cb = new THREE.Color(STYLES[b.id].primary);
    const sa = new THREE.Color(STYLES[a.id].secondary), sb = new THREE.Color(STYLES[b.id].secondary);
    return [ca.lerp(cb, t), sa.lerp(sb, t)];
  }

  update(dt, s) {
    this.time += dt;
    const t = this.time;
    const ch = s.chronos;
    const r = ch.speedRatio;
    const travelTarget = ch.moving ? Math.min(1, r * 4 + 0.15) : 0;
    this.travel = lerp(this.travel, travelTarget, Math.min(1, dt * (travelTarget > this.travel ? 4 : 1.6)));
    const tr = this.travel;

    // Camera rig
    this.look.yaw = lerp(this.look.yaw, this.look.tyaw, Math.min(1, dt * 6));
    this.look.pitch = lerp(this.look.pitch, this.look.tpitch, Math.min(1, dt * 6));
    const sway = 0.012 * Math.sin(t * 0.7) * (1 - tr);
    const shake = Math.min(1, Math.abs(ch.a) / 70) * 0.012 + r * r * 0.02;
    this.rig.rotation.set(this.look.pitch + sway * 0.5, this.look.yaw + sway, Math.sin(t * 1.3) * 0.004 * (1 + tr));
    this.camera.fov = lerp(this.camera.fov, 58 + r * 30, Math.min(1, dt * 3)); this.camera.updateProjectionMatrix();
    this.post.uniforms.uShake.value.set((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);

    // Colours ease toward the target epoch's palette
    const k = Math.min(1, dt * 1.8);
    this.skyMat.uniforms.uTop.value.lerp(this.targetColors.sky[0], k); this.skyMat.uniforms.uBottom.value.lerp(this.targetColors.sky[1], k);
    this.scene.fog.color.lerp(this.targetColors.fog, k); this.groundMat.uniforms.uFog.value.copy(this.scene.fog.color);
    this.groundMat.uniforms.uColor.value.lerp(this.targetColors.ground, k); this.groundMat.uniforms.uAlt.value.lerp(this.targetColors.alt, k);
    this.p1.color.lerp(this.targetColors.p1, k); this.p2.color.lerp(this.targetColors.p2, k);
    this.hemi.color.copy(this.skyMat.uniforms.uTop.value).lerp(new THREE.Color(0xffffff), 0.3); this.hemi.groundColor.copy(this.groundMat.uniforms.uColor.value);
    this.skyMat.uniforms.uTime.value = t; this.skyMat.uniforms.uStars.value = 1 - tr * 0.8;
    this.groundMat.uniforms.uTime.value = t; this.groundMat.uniforms.uBeat.value = s.beat?.pulse ?? 0; this.groundMat.uniforms.uTravel.value = tr;
    this.p1.position.set(Math.cos(t * 0.3) * 7, 5 + Math.sin(t * 0.5), Math.sin(t * 0.3) * 7);
    this.p2.position.set(Math.cos(t * 0.3 + Math.PI) * 7, 4 + Math.cos(t * 0.4), Math.sin(t * 0.3 + Math.PI) * 7);
    const pulse = s.beat?.pulse ?? 0; this.p1.intensity = (28 + pulse * 25) * (1 - tr); this.p2.intensity = (28 + pulse * 18) * (1 - tr);
    if (this.sun) this.sun.material.opacity = lerp(this.sun.material.opacity, (this.sunTarget || 0) * (1 - tr), k);

    // Epoch world reveal / dissolve
    const wantReveal = tr < 0.35 ? 1 : 0;
    this.reveal = lerp(this.reveal, wantReveal, Math.min(1, dt * (wantReveal ? 1.1 : 3)));
    this.groundMat.uniforms.uReveal.value = Math.max(this.reveal, 0.02) * (1 - tr * 0.9) + 0.05;
    if (this.current) { this.current.userData.setReveal(this.reveal); this.current.userData.animate(dt, s.beat, ch.year); this.current.visible = this.reveal > 0.01; }
    if (this.outgoing) { this.outgoingT += dt; const g = this.outgoing; g.userData.setReveal(Math.max(0, 1 - this.outgoingT * 2.5)); g.userData.animate(dt, s.beat, ch.year); if (this.outgoingT > 0.45) { this.worldGroup.remove(g); this.outgoing = null; } }
    this.worldGroup.visible = tr < 0.95;

    // Orrery
    this.orrery.group.visible = tr < 0.9 && !!s.docked;
    this.orrery.group.scale.setScalar(Math.max(0.001, this.reveal) * (1 - tr) * this.orreryScale);
    this.orrery.update(dt, ch.year, s.beat);

    // Tunnel and streaks
    this.tunnel.visible = tr > 0.02; this.streaks.visible = tr > 0.02;
    const tu = this.tunnelMat.uniforms;
    tu.uTime.value = t; tu.uScroll.value -= ch.v * dt * 0.09; tu.uSpeed.value = r; tu.uDoppler.value = ch.doppler; tu.uOpacity.value = tr;
    const [ca, cb] = this._tunnelColors(ch.year); tu.uColA.value.lerp(ca, Math.min(1, dt * 3)); tu.uColB.value.lerp(cb, Math.min(1, dt * 3));
    this.tunnel.rotation.z += dt * ch.v * 0.0015;
    if (this.streaks.visible) {
      const d = new THREE.Object3D(); const sp = ch.v * dt * 1.2;
      for (let i = 0; i < this.streakData.length; i++) {
        const sd = this.streakData[i]; sd.z += sp; if (sd.z > 10) sd.z -= 200; if (sd.z < -200) sd.z += 200;
        d.position.set(Math.cos(sd.a) * sd.r, 2.4 + Math.sin(sd.a) * sd.r, 11.5 + sd.z); d.scale.set(1, 1, sd.len * (1 + r * 14)); d.updateMatrix(); this.streaks.setMatrixAt(i, d.matrix);
      }
      this.streaks.instanceMatrix.needsUpdate = true; this.streaks.material.opacity = tr * (0.25 + r * 0.6);
    }
    this.dust.rotation.y += dt * 0.02; this.dust.material.opacity = 0.4 * Math.max(0, 1 - tr * 2.5); this.dust.visible = tr < 0.4;

    // Post
    const pu = this.post.uniforms;
    pu.uAberration.value = lerp(pu.uAberration.value, r * 0.5 + Math.min(1, Math.abs(ch.a) / 70) * 0.08 + (s.ghost || 0) * 0.06, Math.min(1, dt * 5));
    pu.uDoppler.value = lerp(pu.uDoppler.value, ch.doppler * 0.9, Math.min(1, dt * 3));
    pu.uSpeed.value = lerp(pu.uSpeed.value, r * tr, Math.min(1, dt * 4));
    pu.uGhost.value = lerp(pu.uGhost.value, (s.ghost || 0) * (1 - tr), Math.min(1, dt * 2));
    pu.uTime.value = t;
    this.bloom.strength = 0.42 + r * 0.8 + pulse * 0.1 + (this.orrery.locked ? 0.2 : 0);

    this.composer.render();
  }
}
