// Kairos Engine: wires the Chronos drive, the 3D world, the audio engine and the HUD together.
import { Chronos, VMAX } from './engine/chronos.js';
import { World } from './scene/world.js';
import { AudioEngine } from './audio/engine.js';
import { UI } from './ui/ui.js';
import { EPOCHS, HISTORICAL, epochAt, YEAR_MIN, YEAR_MAX, PRESENT } from './data/epochs.js';
import { STYLES } from './data/styles.js';
import { detectLang, setLang, onLangChange, t } from './i18n/index.js';

const DOCK_RANGE = 5; // years from an epoch's span within which we count as "there"

function boot() {
  setLang(detectLang(), { persist: false });
  const canvas = document.getElementById('gl');
  const chronos = new Chronos(PRESENT);
  const audio = new AudioEngine();
  let world = null;
  let soundOn = false;
  let started = false;

  const state = { chronos, docked: null, nearest: null, beat: audio.beat, ghost: 0 };
  let lastYear = chronos.year;
  let lastBoundary = 0;
  let prevDocked = null;
  let keys = { left: false, right: false };
  let keyThrust = 0;

  const neighbours = (year) => {
    let before = null, after = null;
    for (const e of EPOCHS) { if (e.center < year) before = e; if (e.center > year && !after) after = e; }
    return { before, after };
  };

  const ui = new UI({
    onGoTo: (y) => { chronos.goTo(y); },
    onThrust: (u) => { chronos.setThrust(u); },
    onBrake: () => chronos.brake(),
    onDock: () => { const { epoch } = epochAt(chronos.year); chronos.goTo(epoch.center); },
    onStop: () => chronos.stop(),
    onStep: (dir) => { const i = EPOCHS.findIndex((e) => e.center > chronos.year + 0.01); let target; if (dir > 0) target = i >= 0 ? EPOCHS[i] : EPOCHS[EPOCHS.length - 1]; else { const j = EPOCHS.findIndex((e) => e.center >= chronos.year - 0.01); target = j > 0 ? EPOCHS[j - 1] : j === -1 ? EPOCHS[EPOCHS.length - 1] : EPOCHS[0]; } chronos.goTo(target.center); audio.uiClick(); },
    onSelectArtist: (a) => { if (!world) return; if (a) { world.lockArtist(a); } else world.releaseLock(); },
    onToggleSound: async () => { if (!audio.ctx) { await audio.start(); } soundOn = !soundOn; audio.setMuted(!soundOn); ui.setSound(soundOn); },
    onEngage: async (withSound) => {
      if (started) return; started = true;
      if (withSound) { try { await audio.start(); soundOn = true; audio.setMuted(false); } catch (e) { soundOn = false; } }
      ui.setSound(soundOn); ui.hideIntro();
      if (!world) init3D();
      // A short opening manoeuvre: fall back into the present and dock.
      chronos.year = PRESENT + 14; chronos.v = -40; chronos.goTo(PRESENT - 3);
    },
    onClick: () => audio.uiClick(),
  });

  function init3D() {
    try {
      world = new World(canvas);
      world.orrery.onLocked = (strength) => { if (strength > 0.5) audio.lockSound(); ui.toast(strength > 0.75 ? t('toast.lock.full') : strength > 0.4 ? t('toast.lock.partial') : t('toast.lock.none')); };
    } catch (e) {
      console.error(e);
      document.getElementById('noGL').hidden = false;
    }
  }

  onLangChange(() => ui.relocalize());

  // Keyboard
  window.addEventListener('keydown', (e) => {
    if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
    switch (e.key) {
      case 'ArrowRight': case 'd': case 'D': keys.right = true; e.preventDefault(); break;
      case 'ArrowLeft': case 'a': case 'A': keys.left = true; e.preventDefault(); break;
      case ' ': chronos.brake(); e.preventDefault(); break;
      case 'Enter': { const { epoch } = epochAt(chronos.year); chronos.goTo(epoch.center); break; }
      case 'Escape': ui.closeOverlays(); if (chronos.mode === 'autopilot') chronos.stop(); break;
      case ']': ui.h.onStep(1); break;
      case '[': ui.h.onStep(-1); break;
      case 'm': case 'M': ui.h.onToggleSound(); break;
      case '?': case 'h': case 'H': document.getElementById('help').hidden = false; break;
      case 't': case 'T': document.getElementById('theory').hidden = false; break;
    }
  });
  window.addEventListener('keyup', (e) => { if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keys.right = false; if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') keys.left = false; });
  canvas.addEventListener('wheel', (e) => { e.preventDefault(); const dv = Math.sign(e.deltaY) * -Math.min(12, Math.abs(e.deltaY) * 0.08); chronos.v = Math.max(-VMAX, Math.min(VMAX, chronos.v + dv)); chronos.mode = 'manual'; chronos.target = null; }, { passive: false });
  window.addEventListener('resize', () => world && world.resize());

  // Main loop
  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    const rawDt = (now - last) / 1000; last = now;
    const dt = Math.min(0.1, rawDt);           // for visual smoothing
    if (!started) { return; }

    // Held keys act as a throttle with a ramp
    const want = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    if (want !== 0 || Math.abs(keyThrust) > 0.01) {
      keyThrust += (want - keyThrust) * Math.min(1, dt * 6);
      if (Math.abs(keyThrust) < 0.01) keyThrust = 0;
      chronos.setThrust(keyThrust); ui.setThrustVisual(keyThrust);
    }

    chronos.update(Math.min(1, rawDt));      // physics catches up in fixed sub-steps

    // Docking detection
    const near = epochAt(chronos.year); state.nearest = near;
    const docked = (!chronos.moving && chronos.mode === 'docked' && near.distance <= DOCK_RANGE) ? near.epoch : null;
    if (docked !== state.docked) {
      state.docked = docked;
      if (world) world.setEpoch(docked);
      audio.setEpoch(docked ? docked.id : null);
      if (docked) {
        const idx = EPOCHS.indexOf(docked); const prev = idx > 0 ? EPOCHS[idx - 1] : null;
        ui.showEpoch(docked, prev && !prev.forecast ? prev : null);
        state.ghost = docked.forecast ? 1 - (STYLES[docked.id].ghost ?? 1) : 0;
        prevDocked = docked;
      } else {
        state.ghost = 0;
        if (!chronos.moving && chronos.mode === 'docked') { const { before, after } = neighbours(chronos.year); ui.showInterstice(chronos.year, before, after); }
      }
    } else if (!docked && !chronos.moving && chronos.mode === 'docked') {
      const { before, after } = neighbours(chronos.year); ui.showInterstice(chronos.year, before, after);
    }
    if (chronos.moving && chronos.speedRatio > 0.08) ui.hidePanel();

    // Passing epochs at speed: a flash and a burst of their music
    if (Math.abs(chronos.v) > 10) {
      const lo = Math.min(lastYear, chronos.year), hi = Math.max(lastYear, chronos.year);
      for (const e of EPOCHS) if (e.center > lo && e.center <= hi) { ui.flash(e, chronos.v); audio.passBy(e.id, chronos.speedRatio); }
    }
    lastYear = chronos.year;

    if (chronos.boundaryHit && chronos.boundaryHit !== lastBoundary) {
      lastBoundary = chronos.boundaryHit; audio.boundarySound();
      ui.toast(chronos.year <= YEAR_MIN + 0.01 ? t('toast.boundary.past', { year: YEAR_MIN }) : t('toast.boundary.future', { year: YEAR_MAX }));
    }

    // Music ducks while moving; the drive drone rises
    audio.setMusicLevel && audio.ctx && audio.setMusicLevel(Math.max(0, 1 - Math.min(1, chronos.speedRatio * 5)));
    audio.updateDrive(chronos, dt);

    ui.update(state);
    if (world) world.update(dt, state);
  }
  requestAnimationFrame(frame);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
