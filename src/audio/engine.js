// Procedural audio: a synthesizer bank, a step sequencer that plays each epoch's signature,
// and the Chronos drive's drone whose pitch follows temporal velocity (Doppler-shifted by direction).
import { MUSIC, SCALES, CHORD_SHAPES } from '../data/music.js';
import { VMAX } from '../engine/chronos.js';

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.enabled = false;
    this.muted = false;
    this.current = null;     // epoch id
    this.signature = null;
    this.step = 0;
    this.bar = 0;
    this.nextTime = 0;
    this.lookahead = 0.12;
    this.timer = null;
    this.beat = { phase: 0, bar: 0, step: 0, pulse: 0, bpm: 120 };
    this.musicLevel = 1;
    this.seed = 1;
    this._lastDecade = null;
  }

  async start() {
    if (this.ctx) { if (this.ctx.state === 'suspended') await this.ctx.resume(); this.enabled = true; return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AC({ latencyHint: 'interactive' });
    const c = this.ctx;
    this.master = c.createGain(); this.master.gain.value = 0.6;
    this.comp = c.createDynamicsCompressor(); this.comp.threshold.value = -18; this.comp.ratio.value = 4; this.comp.knee.value = 12;
    this.master.connect(this.comp).connect(c.destination);

    // Buses
    this.musicBus = c.createGain(); this.musicBus.gain.value = 0.9;
    this.driveBus = c.createGain(); this.driveBus.gain.value = 0;
    this.musicBus.connect(this.master); this.driveBus.connect(this.master);

    // Cheap reverb: two cross-fed delays through a lowpass.
    this.revIn = c.createGain(); this.revIn.gain.value = 0.0;
    const d1 = c.createDelay(1), d2 = c.createDelay(1); d1.delayTime.value = 0.173; d2.delayTime.value = 0.251;
    const fb1 = c.createGain(), fb2 = c.createGain(); fb1.gain.value = 0.42; fb2.gain.value = 0.38;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3200;
    const revOut = c.createGain(); revOut.gain.value = 0.9;
    this.revIn.connect(d1); this.revIn.connect(d2); d1.connect(fb1).connect(d2); d2.connect(fb2).connect(d1);
    d1.connect(lp); d2.connect(lp); lp.connect(revOut).connect(this.musicBus);

    // Slapback
    this.slapIn = c.createGain(); this.slapIn.gain.value = 0;
    const sd = c.createDelay(0.5); sd.delayTime.value = 0.11; const sg = c.createGain(); sg.gain.value = 0.5;
    this.slapIn.connect(sd).connect(sg).connect(this.musicBus);

    // Crackle (vinyl surface noise)
    this.crackle = c.createGain(); this.crackle.gain.value = 0; this.crackle.connect(this.musicBus);
    const nb = this._noiseBuffer(2);
    const ns = c.createBufferSource(); ns.buffer = nb; ns.loop = true;
    const nf = c.createBiquadFilter(); nf.type = 'highpass'; nf.frequency.value = 2500;
    const nsh = c.createWaveShaper(); const curve = new Float32Array(256); for (let i = 0; i < 256; i++) { const x = i / 128 - 1; curve[i] = Math.abs(x) > 0.93 ? x : 0; } nsh.curve = curve;
    ns.connect(nf).connect(nsh).connect(this.crackle); ns.start();

    // Drive drone: two detuned saws + bandpassed noise whoosh
    this.droneOsc1 = c.createOscillator(); this.droneOsc1.type = 'sawtooth';
    this.droneOsc2 = c.createOscillator(); this.droneOsc2.type = 'sawtooth'; this.droneOsc2.detune.value = 7;
    this.droneSub = c.createOscillator(); this.droneSub.type = 'sine';
    this.droneFilter = c.createBiquadFilter(); this.droneFilter.type = 'lowpass'; this.droneFilter.Q.value = 6;
    const dg = c.createGain(); dg.gain.value = 0.18;
    this.droneOsc1.connect(this.droneFilter); this.droneOsc2.connect(this.droneFilter); this.droneSub.connect(dg);
    this.droneFilter.connect(dg); dg.connect(this.driveBus);
    this.droneOsc1.start(); this.droneOsc2.start(); this.droneSub.start();
    const ws = c.createBufferSource(); ws.buffer = nb; ws.loop = true;
    this.whooshFilter = c.createBiquadFilter(); this.whooshFilter.type = 'bandpass'; this.whooshFilter.Q.value = 1.2;
    this.whooshGain = c.createGain(); this.whooshGain.gain.value = 0;
    ws.connect(this.whooshFilter).connect(this.whooshGain).connect(this.driveBus); ws.start();

    this.enabled = true;
    this.timer = setInterval(() => this._schedule(), 25);
  }

  setMuted(m) { this.muted = m; if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.6, this.ctx.currentTime, 0.05); }

  _noiseBuffer(sec) {
    const c = this.ctx, n = Math.floor(c.sampleRate * sec), b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }

  // ------------------------------------------------------------------ epoch music
  setEpoch(id) {
    if (id === this.current) return;
    this.current = id;
    this.signature = id ? MUSIC[id] : null;
    if (this.signature && this.ctx) {
      const s = this.signature;
      this.revIn.gain.setTargetAtTime((s.fx?.reverb ?? 0.3) * 0.6, this.ctx.currentTime, 0.3);
      this.slapIn.gain.setTargetAtTime(s.fx?.slapback ?? 0, this.ctx.currentTime, 0.3);
      this.crackle.gain.setTargetAtTime((s.fx?.crackle ?? 0) * 0.08, this.ctx.currentTime, 0.5);
      this.beat.bpm = s.bpm;
    }
    this.step = 0; this.bar = 0;
    if (this.ctx) this.nextTime = this.ctx.currentTime + 0.05;
  }

  // Music fades out while moving; the drone takes over.
  setMusicLevel(x) { this.musicLevel = x; if (this.musicBus) this.musicBus.gain.setTargetAtTime(0.9 * x, this.ctx.currentTime, 0.15); }

  _schedule() {
    const c = this.ctx; if (!c || !this.signature) return;
    const s = this.signature;
    const spb = 60 / s.bpm;               // seconds per beat
    const sps = spb / 4;                  // per 16th
    while (this.nextTime < c.currentTime + this.lookahead) {
      let t = this.nextTime;
      const i = this.step;
      if (s.swing && i % 2 === 1) t += sps * s.swing;
      if (this.musicLevel > 0.02) this._playStep(i, t, sps, spb);
      this.step = (i + 1) % 16;
      if (this.step === 0) this.bar++;
      this.nextTime += sps;
    }
    // Beat clock for visuals
    const pos = (c.currentTime - (this.nextTime - sps * (this.step === 0 ? 16 : this.step))) / spb;
    this.beat.phase = ((pos % 1) + 1) % 1;
    this.beat.step = this.step; this.beat.bar = this.bar;
  }

  _rng() { this.seed = (this.seed * 1664525 + 1013904223) >>> 0; return this.seed / 4294967296; }

  _hit(pattern, i, prob) {
    if (!pattern) return false;
    const ch = pattern[i];
    if (ch === 'x' || ch === 'o') return prob == null || this._rng() < prob;
    if (prob != null && prob < 1 && this._rng() < (1 - prob) * 0.12) return true; // forecast: unplanned hits
    return false;
  }

  _playStep(i, t, sps, spb) {
    const s = this.signature;
    const prob = s.probabilistic;
    const human = (s.drums?.human || 0) * (this._rng() - 0.5) * 2;
    t += human;
    const d = s.drums || {};
    if (this._hit(d.kick, i, prob)) this.kick(t, s.bass?.voice === '808' ? 'deep' : d.lofi ? 'lofi' : 'normal');
    if (this._hit(d.snare, i, prob)) this.snare(t, d.gated ? 'gated' : d.brush ? 'brush' : d.lofi ? 'lofi' : 'normal');
    if (this._hit(d.clap, i, prob)) this.clap(t);
    if (this._hit(d.hat, i, prob)) this.hat(t, false, d.brush ? 'brush' : d.ride ? 'ride' : 'normal');
    if (this._hit(d.open, i, prob)) this.hat(t, true);
    if (this._hit(d.tamb, i, prob)) this.tamb(t);
    if (this._hit(d.snap, i, prob)) this.snap(t);
    if (this._hit(d.roll, i, prob)) for (let k = 0; k < 4; k++) this.hat(t + k * sps / 4, false, 'normal', 0.5);
    if (this._hit(d.heartbeat, i, prob)) this.kick(t, 'heart');
    if (d.crowd && i % 8 === 0) this.crowd(t, spb * 2);

    // Bass
    const b = s.bass;
    if (b && this._hit(b.pattern, i, prob)) {
      const idx = Math.floor(i / 2) % b.notes.length;
      const note = s.root + (b.octave || 0) * 12 + b.notes[idx];
      this.bass(t, mtof(note), b.voice, sps * 2, b.glide);
    }

    // Chords
    const ch = s.chords;
    if (ch) {
      const every = ch.every || 4;
      const chordIdx = Math.floor(this.bar * (16 / every) / 4 + Math.floor(i / 4) / (every / 4)) % ch.prog.length;
      const [rootOff, shape] = ch.prog[Math.floor((this.bar * 4 + Math.floor(i / 4)) / every) % ch.prog.length];
      const shapeIv = CHORD_SHAPES[shape] || CHORD_SHAPES.M;
      const notes = shapeIv.map((iv) => s.root + 12 + rootOff + iv);
      const onBeat = i % 4 === 0;
      const onChordChange = i % (every * 4) === 0;
      if (ch.arp === 'up16') { const n = notes[i % notes.length]; this.voice(ch.voice, t, mtof(n + 12), sps * 1.5, 0.25); }
      else if (ch.arp === 'wide') { if (i % 2 === 0) { const n = notes[(i / 2) % notes.length] + (i >= 8 ? 12 : 0); this.voice(ch.voice, t + (ch.rubato || 0) * (this._rng() - 0.5), mtof(n), spb * 1.2, 0.3); } }
      else if (ch.arp === 'stab') { if (this._hit(ch.stabPattern, i, prob)) notes.forEach((n) => this.voice(ch.voice, t, mtof(n + 12), sps * 1.6, 0.22)); }
      else if (ch.arp === 'strum') { if (this._hit(ch.strumPattern, i, prob)) notes.forEach((n, k) => this.voice(ch.voice, t + k * 0.012, mtof(n), sps * 3, 0.2)); }
      else if (ch.arp === 'power') { if (this._hit(ch.strumPattern, i, prob)) [notes[0] - 12, notes[0] - 5, notes[0]].forEach((n) => this.voice('distgtr', t, mtof(n), spb * 1.8, 0.35)); }
      else if (ch.arp === 'hold') { if (onChordChange) notes.forEach((n) => this.voice(ch.voice, t, mtof(n + 12), spb * every * (ch.breathe ? 1.0 : 0.95), 0.16)); }
      else if (ch.offbeat) { if (i % 4 === 2) notes.forEach((n) => this.voice(ch.voice, t, mtof(n + 12), sps * 1.5, 0.2)); }
      else if (onBeat && (i % 8 === 0 || ch.every <= 4)) notes.forEach((n) => this.voice(ch.voice, t, mtof(n + 12), spb * 1.5, 0.18));
      this._chordNotes = notes;
    }

    // Lead: generative within the scale
    const L = s.lead;
    if (L && L.style !== 'none') {
      const scale = SCALES[s.scale] || SCALES.minor;
      const dens = L.density * (prob ? 0.9 : 1);
      const base = s.root + 24;
      const pick = () => base + scale[Math.floor(this._rng() * scale.length)] + 12 * Math.floor(this._rng() * 2);
      const rub = (L.rubato || 0) * (this._rng() - 0.5);
      if (L.style === 'arp' && i % 2 === 0 && this._rng() < dens) this.voice(L.voice, t + rub, mtof(pick()), sps * 2, 0.18);
      if (L.style === 'melody' && i % 2 === 0 && this._rng() < dens * 0.6) this.voice(L.voice, t + rub, mtof(pick()), sps * (2 + Math.floor(this._rng() * 4)), 0.2);
      if (L.style === 'solo' && this._rng() < dens * 0.5) this.voice(L.voice, t, mtof(pick()), sps * (1 + Math.floor(this._rng() * 3)), 0.18);
      if (L.style === 'rag' && i % 2 === 1 && this._rng() < dens) this.voice(L.voice, t, mtof(pick()), sps * 1.5, 0.2);
      if (L.style === 'riff' && i % 4 === 0 && this._rng() < dens) [0, 2, 4].forEach((k) => this.voice(L.voice, t + k * sps, mtof(base + scale[(k + Math.floor(this.bar)) % scale.length]), sps * 1.2, 0.2));
      if (L.style === 'scratch' && this._rng() < dens * 0.7) this.scratch(t, sps);
      if (L.style === 'anthem' && i % 8 === 0 && this._rng() < dens) [0, 4, 7].forEach((iv) => this.voice('choir', t, mtof(base + iv), spb * 2, 0.12));
      if (L.style === 'drift' && i === 0 && this._rng() < dens * 2) this.voice('glass', t, mtof(pick()), spb * 8, 0.12);
    }

    if (i % 4 === 0) this.beat.pulse = 1;
  }

  // ------------------------------------------------------------------ voices
  _env(g, t, a, d, s, r, dur, peak = 1) {
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak * s), t + a + d);
    g.gain.setValueAtTime(Math.max(0.0001, peak * s), t + Math.max(a + d, dur));
    g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(a + d, dur) + r);
  }

  _out(node, send = 0.3, slap = 0) {
    node.connect(this.musicBus);
    if (send > 0) { const g = this.ctx.createGain(); g.gain.value = send; node.connect(g).connect(this.revIn); }
    if (slap > 0) { const g = this.ctx.createGain(); g.gain.value = slap; node.connect(g).connect(this.slapIn); }
  }

  voice(kind, t, f, dur, vol = 0.2) {
    const c = this.ctx; if (!c) return;
    const g = c.createGain();
    const stop = (nodes, end) => nodes.forEach((n) => n.stop(end));
    switch (kind) {
      case 'harpsi': { // bright pluck
        const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f;
        const o2 = c.createOscillator(); o2.type = 'square'; o2.frequency.value = f * 2; const g2 = c.createGain(); g2.gain.value = 0.3;
        const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 400;
        o.connect(hp); o2.connect(g2).connect(hp); hp.connect(g); this._out(g, 0.35);
        this._env(g, t, 0.002, 0.25, 0.05, 0.1, Math.min(dur, 0.4), vol * 0.7); o.start(t); o2.start(t); stop([o, o2], t + dur + 0.3); break; }
      case 'piano': case 'rhodes': {
        const o = c.createOscillator(); o.type = kind === 'rhodes' ? 'sine' : 'triangle'; o.frequency.value = f;
        const o2 = c.createOscillator(); o2.type = 'sine'; o2.frequency.value = f * (kind === 'rhodes' ? 4 : 2.001); const g2 = c.createGain(); g2.gain.value = kind === 'rhodes' ? 0.15 : 0.35;
        const o3 = c.createOscillator(); o3.type = 'sine'; o3.frequency.value = f * 3; const g3 = c.createGain(); g3.gain.value = 0.08;
        o.connect(g); o2.connect(g2).connect(g); o3.connect(g3).connect(g); this._out(g, 0.35);
        this._env(g, t, 0.004, 0.6, 0.25, 0.25, dur, vol); o.start(t); o2.start(t); o3.start(t); stop([o, o2, o3], t + dur + 0.6); break; }
      case 'organ': {
        const os = [1, 2, 3, 4].map((h, k) => { const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = f * h; const gg = c.createGain(); gg.gain.value = [0.6, 0.4, 0.2, 0.15][k]; o.connect(gg).connect(g); return o; });
        this._out(g, 0.3); this._env(g, t, 0.02, 0.1, 0.9, 0.08, dur, vol * 0.8); os.forEach((o) => o.start(t)); stop(os, t + dur + 0.3); break; }
      case 'pad': case 'strings': case 'choir': {
        const os = [-7, 0, 7].map((det) => { const o = c.createOscillator(); o.type = kind === 'choir' ? 'triangle' : 'sawtooth'; o.frequency.value = f; o.detune.value = det; return o; });
        const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = kind === 'strings' ? 2200 : 1200; lp.Q.value = 0.7;
        if (kind === 'choir') { const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 1.5; os.forEach((o) => o.connect(bp)); bp.connect(lp); } else os.forEach((o) => o.connect(lp));
        lp.connect(g); this._out(g, 0.6);
        this._env(g, t, Math.min(0.5, dur * 0.3), 0.3, 0.8, 0.6, dur, vol * 0.5); os.forEach((o) => o.start(t)); stop(os, t + dur + 1); break; }
      case 'glass': {
        const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = f;
        const o2 = c.createOscillator(); o2.type = 'sine'; o2.frequency.value = f * 2.5; const g2 = c.createGain(); g2.gain.value = 0.2;
        o.connect(g); o2.connect(g2).connect(g); this._out(g, 0.9); this._env(g, t, 1.2, 1, 0.7, 2, dur, vol * 0.6); o.start(t); o2.start(t); stop([o, o2], t + dur + 2.5); break; }
      case 'horns': case 'trumpet': case 'clarinet': {
        const o = c.createOscillator(); o.type = kind === 'clarinet' ? 'square' : 'sawtooth'; o.frequency.value = f;
        const vib = c.createOscillator(); vib.frequency.value = 5.5; const vg = c.createGain(); vg.gain.value = f * 0.006; vib.connect(vg).connect(o.frequency);
        const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(600, t); lp.frequency.linearRampToValueAtTime(kind === 'clarinet' ? 1800 : 2800, t + 0.05); lp.Q.value = 2;
        o.connect(lp).connect(g); this._out(g, 0.3); this._env(g, t, 0.03, 0.1, 0.8, 0.08, dur, vol * 0.6); o.start(t); vib.start(t); stop([o, vib], t + dur + 0.2); break; }
      case 'guitar': case 'jangle': {
        const o = c.createOscillator(); o.type = kind === 'jangle' ? 'triangle' : 'sawtooth'; o.frequency.value = f;
        const o2 = c.createOscillator(); o2.type = 'square'; o2.frequency.value = f; o2.detune.value = 4; const g2 = c.createGain(); g2.gain.value = 0.3;
        const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(3000, t); lp.frequency.exponentialRampToValueAtTime(700, t + 0.4);
        o.connect(lp); o2.connect(g2).connect(lp); lp.connect(g); this._out(g, 0.25, 0.5); this._env(g, t, 0.003, 0.3, 0.2, 0.15, dur, vol * 0.6); o.start(t); o2.start(t); stop([o, o2], t + dur + 0.3); break; }
      case 'distgtr': {
        const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f;
        const o2 = c.createOscillator(); o2.type = 'sawtooth'; o2.frequency.value = f; o2.detune.value = 9;
        const sh = c.createWaveShaper(); const k = 60; const cur = new Float32Array(1024); for (let i = 0; i < 1024; i++) { const x = i / 512 - 1; cur[i] = ((3 + k) * x * 20 * (Math.PI / 180)) / (Math.PI + k * Math.abs(x)); } sh.curve = cur;
        const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600;
        o.connect(sh); o2.connect(sh); sh.connect(lp).connect(g); this._out(g, 0.2); this._env(g, t, 0.005, 0.2, 0.5, 0.2, dur, vol * 0.35); o.start(t); o2.start(t); stop([o, o2], t + dur + 0.3); break; }
      case 'dx7': case 'bell': {
        const car = c.createOscillator(); car.type = 'sine'; car.frequency.value = f;
        const mod = c.createOscillator(); mod.type = 'sine'; mod.frequency.value = f * (kind === 'bell' ? 3.5 : 2); const mg = c.createGain(); mg.gain.setValueAtTime(f * (kind === 'bell' ? 4 : 2.5), t); mg.gain.exponentialRampToValueAtTime(f * 0.05, t + 0.8);
        mod.connect(mg).connect(car.frequency); car.connect(g); this._out(g, 0.5);
        this._env(g, t, 0.002, 0.5, 0.3, 0.4, dur, vol * 0.6); car.start(t); mod.start(t); stop([car, mod], t + dur + 0.6); break; }
      case 'pluck': case 'synth': case 'saw': {
        const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f;
        const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(f * 6, t); lp.frequency.exponentialRampToValueAtTime(Math.max(120, f * 1.2), t + 0.25); lp.Q.value = 4;
        o.connect(lp).connect(g); this._out(g, 0.25); this._env(g, t, 0.002, 0.2, 0.3, 0.1, dur, vol * 0.6); o.start(t); o.stop(t + dur + 0.2); break; }
      case 'whisper': case 'autotune': case 'chipmunk': {
        const o = c.createOscillator(); o.type = kind === 'chipmunk' ? 'square' : 'triangle'; o.frequency.value = f * (kind === 'chipmunk' ? 2 : 1);
        if (kind === 'autotune') { o.frequency.setValueAtTime(f * 0.94, t); o.frequency.setValueAtTime(f, t + 0.03); }
        const vib = c.createOscillator(); vib.frequency.value = kind === 'chipmunk' ? 7 : 5; const vg = c.createGain(); vg.gain.value = f * (kind === 'whisper' ? 0.004 : 0.012); vib.connect(vg).connect(o.frequency);
        const f1 = c.createBiquadFilter(); f1.type = 'bandpass'; f1.frequency.value = kind === 'whisper' ? 1400 : 1000; f1.Q.value = kind === 'whisper' ? 0.6 : 1.2;
        const breath = c.createBufferSource(); breath.buffer = this._noiseBuffer(0.5); const bg = c.createGain(); bg.gain.value = kind === 'whisper' ? 0.12 : 0.02; const bf = c.createBiquadFilter(); bf.type = 'bandpass'; bf.frequency.value = 3000;
        o.connect(f1).connect(g); breath.connect(bf).connect(bg).connect(g); this._out(g, 0.5);
        this._env(g, t, 0.04, 0.2, 0.7, 0.2, dur, vol * (kind === 'whisper' ? 0.5 : 0.4)); o.start(t); vib.start(t); breath.start(t); stop([o, vib, breath], t + dur + 0.3); break; }
      case 'funkgtr': default: {
        const o = c.createOscillator(); o.type = 'square'; o.frequency.value = f; const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 800;
        o.connect(hp).connect(g); this._out(g, 0.2); this._env(g, t, 0.002, 0.08, 0.1, 0.05, Math.min(dur, 0.12), vol * 0.5); o.start(t); o.stop(t + 0.3); break; }
    }
  }

  bass(t, f, kind, dur, glide) {
    const c = this.ctx; const g = c.createGain();
    if (kind === '808' || kind === 'sub') {
      const o = c.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(glide ? f * 1.5 : f * 2.5, t); o.frequency.exponentialRampToValueAtTime(f, t + (glide ? 0.12 : 0.04));
      const sh = c.createWaveShaper(); const cur = new Float32Array(256); for (let i = 0; i < 256; i++) { const x = i / 128 - 1; cur[i] = Math.tanh(x * 2.2); } sh.curve = cur;
      o.connect(sh).connect(g); g.connect(this.musicBus);
      this._env(g, t, 0.004, 0.35, 0.6, 0.25, kind === '808' ? dur * 2 : dur, 0.55); o.start(t); o.stop(t + dur * 2 + 0.5);
    } else if (kind === 'upright') {
      const o = c.createOscillator(); o.type = 'triangle'; o.frequency.value = f; const o2 = c.createOscillator(); o2.type = 'sine'; o2.frequency.value = f * 0.5; const g2 = c.createGain(); g2.gain.value = 0.5;
      const click = c.createBufferSource(); click.buffer = this._noiseBuffer(0.03); const cg = c.createGain(); cg.gain.value = 0.15;
      o.connect(g); o2.connect(g2).connect(g); click.connect(cg).connect(g); g.connect(this.musicBus);
      this._env(g, t, 0.005, 0.25, 0.3, 0.1, dur * 0.8, 0.5); o.start(t); o2.start(t); click.start(t); o.stop(t + dur + 0.2); o2.stop(t + dur + 0.2);
    } else if (kind === 'saw' || kind === 'synth' || kind === 'pluck') {
      const o = c.createOscillator(); o.type = kind === 'pluck' ? 'triangle' : 'sawtooth'; o.frequency.value = f;
      if (glide) { o.frequency.setValueAtTime(f * 0.8, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.08); }
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(f * 8, t); lp.frequency.exponentialRampToValueAtTime(f * 1.5, t + 0.18); lp.Q.value = 5;
      o.connect(lp).connect(g); g.connect(this.musicBus);
      this._env(g, t, 0.003, 0.15, 0.4, 0.08, dur * 0.9, 0.45); o.start(t); o.stop(t + dur + 0.2);
    } else { // piano / harpsi bass
      this.voice(kind, t, f, dur, 0.35);
    }
  }

  kick(t, kind = 'normal') {
    const c = this.ctx; const o = c.createOscillator(); const g = c.createGain();
    const f0 = kind === 'deep' ? 56 : kind === 'heart' ? 48 : 60;
    o.frequency.setValueAtTime(kind === 'lofi' ? 150 : 180, t); o.frequency.exponentialRampToValueAtTime(f0, t + (kind === 'deep' ? 0.12 : 0.06));
    o.connect(g).connect(this.musicBus);
    const peak = kind === 'heart' ? 0.5 : 0.9; const dec = kind === 'deep' ? 0.6 : kind === 'heart' ? 0.35 : 0.28;
    g.gain.setValueAtTime(peak, t); g.gain.exponentialRampToValueAtTime(0.001, t + dec);
    o.start(t); o.stop(t + dec + 0.05);
    if (kind !== 'heart') { const cl = c.createBufferSource(); cl.buffer = this._noiseBuffer(0.02); const cg = c.createGain(); cg.gain.value = kind === 'lofi' ? 0.15 : 0.08; cl.connect(cg).connect(this.musicBus); cl.start(t); }
  }

  snare(t, kind = 'normal') {
    const c = this.ctx; const n = c.createBufferSource(); n.buffer = this._noiseBuffer(0.4);
    const f = c.createBiquadFilter(); f.type = kind === 'brush' ? 'bandpass' : 'highpass'; f.frequency.value = kind === 'brush' ? 3000 : 1500;
    const g = c.createGain(); n.connect(f).connect(g); this._out(g, kind === 'gated' ? 0.9 : 0.2);
    const dec = kind === 'gated' ? 0.32 : kind === 'brush' ? 0.12 : kind === 'lofi' ? 0.14 : 0.18;
    const peak = kind === 'brush' ? 0.25 : 0.55;
    g.gain.setValueAtTime(peak, t);
    if (kind === 'gated') { g.gain.setValueAtTime(peak, t + dec - 0.02); g.gain.linearRampToValueAtTime(0.001, t + dec); } else g.gain.exponentialRampToValueAtTime(0.001, t + dec);
    n.start(t); n.stop(t + dec + 0.05);
    if (kind !== 'brush') { const o = c.createOscillator(); o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(120, t + 0.08); const og = c.createGain(); og.gain.setValueAtTime(0.35, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.1); o.connect(og).connect(this.musicBus); o.start(t); o.stop(t + 0.12); }
  }

  clap(t) { for (let k = 0; k < 3; k++) { const n = this.ctx.createBufferSource(); n.buffer = this._noiseBuffer(0.1); const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1800; f.Q.value = 1; const g = this.ctx.createGain(); n.connect(f).connect(g); this._out(g, 0.4); g.gain.setValueAtTime(0.35, t + k * 0.01); g.gain.exponentialRampToValueAtTime(0.001, t + k * 0.01 + (k === 2 ? 0.2 : 0.03)); n.start(t + k * 0.01); n.stop(t + 0.4); } }

  hat(t, open = false, kind = 'normal', vol = 1) {
    const c = this.ctx; const n = c.createBufferSource(); n.buffer = this._noiseBuffer(0.3);
    const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = kind === 'ride' ? 5000 : kind === 'brush' ? 4000 : 7000;
    const g = c.createGain(); n.connect(f).connect(g); g.connect(this.musicBus);
    const dec = open ? 0.25 : kind === 'ride' ? 0.18 : kind === 'brush' ? 0.06 : 0.04;
    g.gain.setValueAtTime((kind === 'brush' ? 0.12 : 0.2) * vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dec); n.start(t); n.stop(t + dec + 0.05);
  }

  tamb(t) { const n = this.ctx.createBufferSource(); n.buffer = this._noiseBuffer(0.15); const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 9000; f.Q.value = 2; const g = this.ctx.createGain(); n.connect(f).connect(g); g.connect(this.musicBus); g.gain.setValueAtTime(0.18, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.1); n.start(t); n.stop(t + 0.15); }
  snap(t) { const n = this.ctx.createBufferSource(); n.buffer = this._noiseBuffer(0.05); const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2500; f.Q.value = 3; const g = this.ctx.createGain(); n.connect(f).connect(g); this._out(g, 0.3); g.gain.setValueAtTime(0.4, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.05); n.start(t); n.stop(t + 0.1); }
  scratch(t, sps) { const n = this.ctx.createBufferSource(); n.buffer = this._noiseBuffer(0.1); const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2200; f.Q.value = 4; const g = this.ctx.createGain(); n.connect(f).connect(g); g.connect(this.musicBus); g.gain.setValueAtTime(0.12, t); g.gain.exponentialRampToValueAtTime(0.001, t + sps * 0.8); n.start(t); n.stop(t + sps); }
  crowd(t, dur) { const n = this.ctx.createBufferSource(); n.buffer = this._noiseBuffer(1); n.loop = true; const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 700; f.Q.value = 0.5; const g = this.ctx.createGain(); n.connect(f).connect(g); this._out(g, 0.8); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.05, t + dur * 0.5); g.gain.linearRampToValueAtTime(0.0001, t + dur); n.start(t); n.stop(t + dur + 0.05); }

  // A short burst of an epoch's chord, heard when flying past it at speed: tuning past a station.
  passBy(id, speedRatio) {
    const s = MUSIC[id]; if (!s || !this.ctx) return;
    const t = this.ctx.currentTime + 0.02;
    const [rootOff, shape] = s.chords.prog[0];
    const iv = CHORD_SHAPES[shape] || CHORD_SHAPES.M;
    const rate = 1 + speedRatio * 1.5;
    iv.forEach((x, k) => this.voice(s.chords.voice === 'horns' ? 'horns' : s.chords.voice, t + k * 0.03 / rate, mtof(s.root + 24 + rootOff + x) * (0.5 + speedRatio), 0.35 / rate, 0.22 * (1 - speedRatio * 0.5)));
  }

  // ------------------------------------------------------------------ drive
  updateDrive(ch, dt) {
    if (!this.ctx) return;
    const c = this.ctx, now = c.currentTime;
    const r = ch.speedRatio;
    const dir = Math.sign(ch.v);
    const dopp = 1 + ch.doppler * 0.6;                // future = up, past = down
    const base = 48 * dopp * (1 + r * 2.5);
    this.droneOsc1.frequency.setTargetAtTime(base, now, 0.08);
    this.droneOsc2.frequency.setTargetAtTime(base * 1.005, now, 0.08);
    this.droneSub.frequency.setTargetAtTime(base * 0.5, now, 0.08);
    this.droneFilter.frequency.setTargetAtTime(200 + r * r * 5000 + Math.abs(ch.a) * 8, now, 0.05);
    this.whooshFilter.frequency.setTargetAtTime(300 + r * 4000 * dopp, now, 0.05);
    this.whooshGain.gain.setTargetAtTime(r * 0.35, now, 0.1);
    const lvl = Math.min(1, r * 3) * 0.9 + Math.min(1, Math.abs(ch.a) / 70) * 0.1;
    this.driveBus.gain.setTargetAtTime(lvl, now, 0.1);
    // Odometer click per decade crossed
    const dec = Math.floor(ch.year / 10);
    if (this._lastDecade != null && dec !== this._lastDecade && ch.moving) this.tick(now, r);
    this._lastDecade = dec;
    this.beat.pulse *= Math.exp(-dt * 8);
  }

  tick(t, r) { const o = this.ctx.createOscillator(); o.type = 'square'; o.frequency.value = 1800 + r * 1200; const g = this.ctx.createGain(); g.gain.setValueAtTime(0.05, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.03); o.connect(g).connect(this.master); o.start(t); o.stop(t + 0.04); }

  lockSound() {
    if (!this.ctx) return; const t = this.ctx.currentTime;
    [0, 7, 12, 19].forEach((iv, k) => this.voice('bell', t + k * 0.09, mtof(74 + iv), 1.6, 0.25));
    this.voice('pad', t, mtof(50), 3, 0.25);
  }
  boundarySound() { if (!this.ctx) return; const t = this.ctx.currentTime; this.kick(t, 'deep'); this.voice('distgtr', t, 55, 0.6, 0.3); }
  uiClick() { if (!this.ctx) return; this.tick(this.ctx.currentTime, 0); }
}
