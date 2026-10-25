// HUD, dossier panel, timeline console, throttle, overlays.
import { EPOCHS, HISTORICAL, FORECASTS, AXES, YEAR_MIN, YEAR_MAX, PRESENT, OUTCOME_MATRIX } from '../data/epochs.js';
import { pendulumStrip, forecastChart } from './charts.js';
import { forecastVector, pendulum, describeDirection } from '../data/forecast.js';
import { VMAX, AMAX } from '../engine/chronos.js';

const $ = (sel, root = document) => root.querySelector(sel);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Timeline scale: piecewise linear so the dense modern era gets room.
const SEG = [[YEAR_MIN, 0], [1880, 0.2], [PRESENT, 0.8], [YEAR_MAX, 1]];
export function yearToX(y) {
  for (let i = 0; i < SEG.length - 1; i++) { const [a, pa] = SEG[i], [b, pb] = SEG[i + 1]; if (y <= b) return pa + ((y - a) / (b - a)) * (pb - pa); }
  return 1;
}
export function xToYear(x) {
  for (let i = 0; i < SEG.length - 1; i++) { const [a, pa] = SEG[i], [b, pb] = SEG[i + 1]; if (x <= pb) return a + ((x - pa) / (pb - pa)) * (b - a); }
  return YEAR_MAX;
}

export class UI {
  constructor(handlers) {
    this.h = handlers;
    this.els = {
      intro: $('#intro'), engage: $('#engage'), engageQuiet: $('#engageQuiet'),
      odo: $('#odometer'), frac: $('#odoFrac'), era: $('#odoEra'),
      rv: $('#rv'), rg: $('#rg'), rd: $('#rd'), re: $('#re'), rc: $('#rc'), mode: $('#modeBadge'), eta: $('#eta'), dir: $('#dirArrow'),
      dock: $('#dock'), dockBody: $('#dockBody'), dockHandle: $('#dockHandle'),
      flash: $('#flash'), flashSub: $('#flashSub'), toast: $('#toast'),
      timeline: $('#timeline'), track: $('#tlTrack'), needle: $('#tlNeedle'), tlLabel: $('#tlLabel'), markers: $('#tlMarkers'), ticks: $('#tlTicks'),
      throttle: $('#throttle'), knob: $('#throttleKnob'), brake: $('#brakeBtn'), dockBtn: $('#dockBtn'), stopBtn: $('#stopBtn'),
      sound: $('#soundBtn'), theory: $('#theoryBtn'), help: $('#helpBtn'), full: $('#fullBtn'), theoryModal: $('#theory'), helpModal: $('#help'),
      prevBtn: $('#prevEpoch'), nextBtn: $('#nextEpoch'),
    };
    this.digits = [];
    this.selectedArtist = null;
    this.panelOpen = true;
    this.shownId = undefined;
    this._buildOdometer();
    this._buildTimeline();
    this._bindThrottle();
    this._bindButtons();
    this._buildTheory();
  }

  // ------------------------------------------------------------- odometer
  _buildOdometer() {
    const o = this.els.odo; o.innerHTML = '';
    for (let k = 0; k < 4; k++) {
      const col = document.createElement('div'); col.className = 'odo-col';
      const strip = document.createElement('div'); strip.className = 'odo-strip';
      for (let d = 0; d <= 10; d++) { const s = document.createElement('span'); s.textContent = d % 10; strip.appendChild(s); }
      col.appendChild(strip); o.appendChild(col); this.digits.push(strip);
    }
  }
  _setOdometer(year) {
    const y = Math.max(0, year);
    const f0 = y - Math.floor(y);
    const intY = Math.floor(y);
    for (let k = 0; k < 4; k++) {
      const p = Math.pow(10, k);
      const val = Math.floor(intY / p) % 10;
      // lower digits all 9 → this digit rolls with the fraction
      let lowerNine = true; for (let j = 0; j < k; j++) if (Math.floor(intY / Math.pow(10, j)) % 10 !== 9) { lowerNine = false; break; }
      const pos = val + (lowerNine ? f0 : 0);
      this.digits[3 - k].style.transform = `translateY(${(-pos * 100) / 11}%)`;
    }
    this.els.frac.textContent = '.' + Math.floor(f0 * 10);
  }

  // ------------------------------------------------------------- timeline
  _buildTimeline() {
    const m = this.els.markers; m.innerHTML = '';
    for (const e of EPOCHS) {
      const b = document.createElement('button'); b.className = 'tl-mark' + (e.forecast ? ' forecast' : '') + (EPOCHS.indexOf(e) % 2 ? ' row2' : ''); b.style.left = `${yearToX(e.center) * 100}%`;
      b.innerHTML = `<span class="tl-dot"></span><span class="tl-name">${esc(e.short)}</span>`; b.title = `${e.name} (${e.span[0]}–${e.span[1]})`; b.dataset.id = e.id;
      b.addEventListener('click', (ev) => { ev.stopPropagation(); this.h.onGoTo(e.center); this.h.onClick?.(); });
      m.appendChild(b);
    }
    const now = document.createElement('div'); now.className = 'tl-now'; now.style.left = `${yearToX(PRESENT) * 100}%`; now.innerHTML = '<span>now</span>'; m.appendChild(now);
    const t = this.els.ticks; t.innerHTML = '';
    for (let y = 1700; y <= 2080; y += y < 1880 ? 50 : y < 2026 ? 10 : 20) { const s = document.createElement('span'); s.style.left = `${yearToX(y) * 100}%`; s.textContent = y % 50 === 0 || y >= 2026 ? y : ''; s.className = 'tl-tick' + (y % 50 === 0 ? ' major' : '') + (y % 100 === 0 ? ' century' : ''); t.appendChild(s); }
    // scrub: click/drag on the track sets an autopilot target
    const tr = this.els.track; let scrubbing = false;
    const toYear = (ev) => { const r = tr.getBoundingClientRect(); return xToYear(Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width))); };
    tr.addEventListener('pointerdown', (ev) => { scrubbing = true; tr.setPointerCapture(ev.pointerId); this.els.tlLabel.hidden = false; this._scrubShow(toYear(ev)); });
    tr.addEventListener('pointermove', (ev) => { if (!scrubbing) { this.els.tlLabel.hidden = false; this._scrubShow(toYear(ev)); return; } this._scrubShow(toYear(ev)); });
    tr.addEventListener('pointerup', (ev) => { if (!scrubbing) return; scrubbing = false; this.h.onGoTo(toYear(ev)); this.h.onClick?.(); });
    tr.addEventListener('pointerleave', () => { if (!scrubbing) this.els.tlLabel.hidden = true; });
  }
  _scrubShow(y) { const l = this.els.tlLabel; l.style.left = `${yearToX(y) * 100}%`; l.textContent = `→ ${Math.round(y)}`; }

  // ------------------------------------------------------------- throttle
  _bindThrottle() {
    const tr = this.els.throttle, knob = this.els.knob; let active = false;
    const setFrom = (ev) => { const r = tr.getBoundingClientRect(); const u = Math.max(-1, Math.min(1, ((ev.clientX - r.left) / r.width) * 2 - 1)); this._thrustVisual(u); this.h.onThrust(Math.abs(u) < 0.08 ? 0 : u); };
    tr.addEventListener('pointerdown', (ev) => { active = true; tr.setPointerCapture(ev.pointerId); setFrom(ev); });
    tr.addEventListener('pointermove', (ev) => { if (active) setFrom(ev); });
    const release = () => { if (!active) return; active = false; this._thrustVisual(0); this.h.onThrust(0); };
    tr.addEventListener('pointerup', release); tr.addEventListener('pointercancel', release);
    this.els.brake.addEventListener('click', () => { this.h.onBrake(); this.h.onClick?.(); });
    this.els.dockBtn.addEventListener('click', () => { this.h.onDock(); this.h.onClick?.(); });
    this.els.stopBtn.addEventListener('click', () => { this.h.onStop(); this.h.onClick?.(); });
  }
  _thrustVisual(u) { this.els.knob.style.left = `${50 + u * 50}%`; this.els.throttle.classList.toggle('active', Math.abs(u) > 0.05); this.els.throttle.style.setProperty('--u', u); }
  setThrustVisual(u) { this._thrustVisual(u); }

  // ------------------------------------------------------------- buttons
  _bindButtons() {
    this.els.engage.addEventListener('click', () => this.h.onEngage(true));
    this.els.engageQuiet.addEventListener('click', () => this.h.onEngage(false));
    this.els.sound.addEventListener('click', () => this.h.onToggleSound());
    this.els.theory.addEventListener('click', () => { this.els.theoryModal.hidden = false; this.h.onClick?.(); });
    this.els.help.addEventListener('click', () => { this.els.helpModal.hidden = false; this.h.onClick?.(); });
    this.els.full.addEventListener('click', () => { const el = document.documentElement; if (document.fullscreenElement) document.exitFullscreen?.(); else el.requestFullscreen?.().catch(() => {}); });
    document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => { b.closest('.overlay').hidden = true; }));
    this.els.dockHandle.addEventListener('click', () => { this.panelOpen = !this.panelOpen; this.els.dock.classList.toggle('collapsed', !this.panelOpen); });
    this.els.prevBtn.addEventListener('click', () => this.h.onStep(-1));
    this.els.nextBtn.addEventListener('click', () => this.h.onStep(1));
  }
  hideIntro() { this.els.intro.classList.add('gone'); setTimeout(() => { this.els.intro.hidden = true; }, 900); }
  setSound(on) { this.els.sound.setAttribute('aria-pressed', String(on)); this.els.sound.textContent = on ? 'Sound on' : 'Sound off'; }
  closeOverlays() { document.querySelectorAll('.overlay:not(#intro)').forEach((o) => { o.hidden = true; }); }

  // ------------------------------------------------------------- per-frame
  update(s) {
    const ch = s.chronos;
    this._setOdometer(ch.year);
    this.els.rv.textContent = Math.abs(ch.v).toFixed(1);
    this.els.rg.textContent = ch.gamma.toFixed(3);
    this.els.rd.textContent = (ch.doppler >= 0 ? '+' : '−') + Math.abs(ch.doppler).toFixed(2);
    this.els.re.textContent = Math.min(999, ch.energy).toFixed(1);
    this.els.rc.textContent = Math.round(ch.coherence * 100) + '%';
    this.els.dir.textContent = ch.v > 0.3 ? '▶ future' : ch.v < -0.3 ? '◀ past' : '● rest';
    this.els.dir.className = 'dir ' + (ch.v > 0.3 ? 'fut' : ch.v < -0.3 ? 'past' : '');
    const modeText = ch.mode === 'autopilot' ? 'AUTOPILOT' : ch.mode === 'manual' ? (ch._braking ? 'BRAKING' : 'MANUAL') : s.docked ? 'DOCKED' : 'ADRIFT';
    if (this.els.mode.textContent !== modeText) { this.els.mode.textContent = modeText; this.els.mode.dataset.mode = modeText.toLowerCase(); }
    this.els.eta.textContent = ch.eta != null ? `→ ${Math.round(ch.target)} · ETA ${ch.eta.toFixed(1)} s` : '';
    this.els.needle.style.left = `${yearToX(ch.year) * 100}%`;
    document.body.classList.toggle('moving', ch.moving);
    document.body.style.setProperty('--speed', ch.speedRatio.toFixed(3));
    this.els.dockBtn.disabled = !(s.nearest && s.nearest.distance > 0.5 && !ch.moving) && ch.mode !== 'manual';
    this.els.stopBtn.hidden = ch.mode !== 'autopilot';
    if (ch.mode === 'autopilot') { const u = ch.a / AMAX; this._thrustVisual(Math.max(-1, Math.min(1, u))); }
  }

  flash(epoch, v) {
    const f = this.els.flash; f.textContent = epoch.name; this.els.flashSub.textContent = `${epoch.span[0]}–${epoch.span[1]} · passing at ${Math.abs(v).toFixed(0)} yr/s`;
    f.parentElement.classList.remove('show'); void f.parentElement.offsetWidth; f.parentElement.classList.add('show');
  }
  toast(msg, ms = 2600) { const t = this.els.toast; t.textContent = msg; t.hidden = false; t.classList.remove('show'); void t.offsetWidth; t.classList.add('show'); clearTimeout(this._tt); this._tt = setTimeout(() => { t.hidden = true; }, ms); }

  // ------------------------------------------------------------- dossier panel
  showEpoch(epoch, prev) {
    if (this.shownId === epoch.id) return;
    this.shownId = epoch.id; this.selectedArtist = null;
    document.querySelectorAll('.tl-mark').forEach((b) => b.classList.toggle('here', b.dataset.id === epoch.id));
    this.els.dock.classList.remove('hidden');
    this.els.dockBody.scrollTop = 0;
    this.els.dockBody.innerHTML = epoch.forecast ? this._forecastHTML(epoch) : this._epochHTML(epoch, prev);
    if (epoch.forecast) this._wireForecast(epoch); else this._wireCases(epoch);
  }

  showInterstice(year, before, after) {
    const id = 'void' + Math.round(year / 5);
    if (this.shownId === id) return;
    this.shownId = id; this.selectedArtist = null;
    document.querySelectorAll('.tl-mark').forEach((b) => b.classList.remove('here'));
    this.els.dock.classList.remove('hidden');
    const y = Math.round(year);
    this.els.dockBody.innerHTML = `
      <p class="eyebrow">Interstice · ${y}</p>
      <h2 class="display">Between epochs</h2>
      <p class="lede serif">The drive finds no stable resonance at ${y}. Music was happening, people were brilliant, but no documented Kairos lock in this archive sits here.</p>
      <div class="void-nav">
        ${before ? `<button class="btn ghost" data-go="${before.center}">◀ ${esc(before.name)} <small>${before.center}</small></button>` : ''}
        ${after ? `<button class="btn ghost" data-go="${after.center}">${esc(after.name)} ▶ <small>${after.center}</small></button>` : ''}
      </div>
      <p class="fine">Tip: thrust is bounded at ${AMAX} yr/s² and top speed at ${VMAX} yr/s. The autopilot plans a brake point; manual flight needs you to brake before the target or you will overshoot.</p>`;
    this.els.dockBody.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => { this.h.onGoTo(+b.dataset.go); this.h.onClick?.(); }));
  }

  hidePanel() { this.els.dock.classList.add('hidden'); this.shownId = undefined; }

  _fitBars(fit) {
    const row = (k, label) => `<div class="fit-row"><span class="fit-k">${label}</span><span class="fit-track"><span class="fit-bar ${k}" style="width:${Math.round(fit[k] * 100)}%"></span></span><span class="fit-v mono">${Math.round(fit[k] * 100)}</span></div>`;
    return `<div class="fit">${row('skill', 'Skill')}${row('env', 'Environment')}${row('need', 'Need')}</div>`;
  }

  _epochHTML(e, prev) {
    const cases = e.artists.map((a, i) => `
      <button class="case" data-i="${i}" aria-expanded="false">
        <span class="case-top"><span class="case-name">${esc(a.name)}</span><span class="case-year mono">${a.year}</span></span>
        <span class="case-head">${esc(a.headline)}</span>
        ${this._fitBars(a.fit)}
        <span class="chip ${a.status}">${a.status === 'locked' ? 'Kairos lock' : a.status === 'deferred' ? 'Lock deferred' : 'Partial lock'}</span>
      </button>
      <div class="case-detail" data-d="${i}" hidden>
        <dl>
          <dt class="k-skill">Skill</dt><dd>${esc(a.skill)}</dd>
          <dt class="k-env">Environment</dt><dd>${esc(a.environment)}</dd>
          <dt class="k-need">What the culture needed</dt><dd>${esc(a.need)}</dd>
        </dl>
        <p class="kairos serif">${esc(a.kairos)}</p>
        ${a.note ? `<p class="note">${esc(a.note)}</p>` : ''}
        <p class="fine">${esc(a.place)}</p>
      </div>`).join('');
    return `
      <p class="eyebrow">Epoch · ${e.span[0]}–${e.span[1]}</p>
      <h2 class="display">${esc(e.name)}</h2>
      <p class="lede">${esc(e.tagline)}</p>
      <section><h3>What the culture needed</h3><p class="serif need">${esc(e.need)}</p></section>
      <section><h3>What the environment made possible</h3><ul class="env">${e.environment.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></section>
      <section><h3>Kairos cases <span class="hint">select one to align the orrery</span></h3><div class="cases">${cases}</div></section>
      <section><h3>The need pendulum</h3>${pendulumStrip({ current: e.axes, previous: prev?.axes || null, currentLabel: e.short, previousLabel: prev ? prev.short : 'previous' })}<p class="fine">Where this epoch's cultural need sat on five bipolar axes, against the epoch before it. Editorial scores, used by the forecast model.</p></section>`;
  }

  _wireCases(e) {
    const body = this.els.dockBody;
    body.querySelectorAll('.case').forEach((btn) => btn.addEventListener('click', () => {
      const i = +btn.dataset.i; const open = btn.getAttribute('aria-expanded') === 'true';
      body.querySelectorAll('.case').forEach((b) => b.setAttribute('aria-expanded', 'false'));
      body.querySelectorAll('.case-detail').forEach((d) => { d.hidden = true; });
      if (open) { this.selectedArtist = null; this.h.onSelectArtist(null); return; }
      btn.setAttribute('aria-expanded', 'true'); body.querySelector(`.case-detail[data-d="${i}"]`).hidden = false;
      this.selectedArtist = e.artists[i]; this.h.onSelectArtist(e.artists[i]);
      btn.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }));
  }

  _forecastHTML(e) {
    const fv = forecastVector(e.center);
    const cur = {}, bands = {}; for (const ax of AXES) { cur[ax.key] = fv[ax.key].value; bands[ax.key] = fv[ax.key].band; }
    const conf = Math.round(e.confidence * 100);
    const dirs = AXES.map((ax) => { const d = describeDirection(ax.key, e.center); return `<li><b>${esc(ax.neg)} ↔ ${esc(ax.pos)}</b>: ${d.strength === 'near the center' ? 'near the center' : `${d.strength} toward ${esc(d.value >= 0 ? ax.pos : ax.neg)}`}, moving toward ${esc(d.toward)}.</li>`; }).join('');
    return `
      <p class="eyebrow forecast">Forecast · +${e.horizon} ${e.horizon === 1 ? 'year' : 'years'} · ${e.center}</p>
      <h2 class="display">${esc(e.name)}</h2>
      <p class="lede">${esc(e.tagline)}</p>
      <div class="conf"><span class="conf-k">Confidence</span><span class="conf-track"><span class="conf-bar" style="width:${conf}%"></span></span><span class="mono">${conf}%</span></div>
      <section><h3>What the culture will need</h3><p class="serif need">${esc(e.need)}</p></section>
      <section><h3>The environment</h3><ul class="env">${e.environment.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></section>
      <section><h3>Skills that will be rewarded</h3><ul class="env">${e.skills.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></section>
      <section><h3>Who locks</h3><ul class="env arch">${e.archetypes.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></section>
      <section><h3>The pendulum model says</h3>
        ${pendulumStrip({ current: cur, bands, currentLabel: `model, ${e.center}` })}
        <ul class="dirs">${dirs}</ul>
        <div class="axis-chips">${AXES.map((ax, i) => `<button class="chip-btn ${i === 0 ? 'on' : ''}" data-axis="${ax.key}">${esc(ax.pos)}</button>`).join('')}</div>
        <div id="fchart"></div>
        <p class="fine">This is a toy: a sinusoid fitted to fourteen hand-scored epochs, extrapolated with a widening error cone. The written forecast above is an analyst's reading that uses the model as one input. Where they disagree, trust neither very much. Past ${Math.round(pendulum().sincerity.period * 1.5 + PRESENT)} the cone covers the whole axis, which is the model admitting it does not know.</p>
      </section>`;
  }

  _wireForecast(e) {
    const body = this.els.dockBody; const chart = body.querySelector('#fchart');
    const draw = (key) => forecastChart(chart, key, e.center);
    draw('sincerity');
    body.querySelectorAll('.chip-btn').forEach((b) => b.addEventListener('click', () => { body.querySelectorAll('.chip-btn').forEach((x) => x.classList.remove('on')); b.classList.add('on'); draw(b.dataset.axis); }));
  }

  // ------------------------------------------------------------- theory modal
  _buildTheory() {
    const m = pendulum();
    const rows = OUTCOME_MATRIX.map((r) => `<tr><td>${r.skill ? '●' : '○'}</td><td>${r.env ? '●' : '○'}</td><td>${r.need ? '●' : '○'}</td><td>${esc(r.outcome)}</td><td class="muted">${esc(r.example)}</td></tr>`).join('');
    const periods = AXES.map((ax) => `<tr><td>${esc(ax.neg)} ↔ ${esc(ax.pos)}</td><td class="mono">${m[ax.key].period.toFixed(0)} yr</td><td class="mono">${m[ax.key].amplitude.toFixed(2)}</td><td class="mono">${Math.round(m[ax.key].nextTurn)}</td></tr>`).join('');
    $('#theoryBody').innerHTML = `
      <p class="eyebrow">Theory</p>
      <h2 class="display">Chronos and Kairos</h2>
      <p>The Greeks had two words for time. <b>Chronos</b> is the time you travel through: sequential, measurable, the kind this drive pushes against. <b>Kairos</b> is the opportune moment: the instant when the thing you can do is the thing the world is ready for. This machine moves through Chronos to find Kairos.</p>
      <h3>The lock condition</h3>
      <p>Every artist in this archive who "made it" did so when three independent quantities crossed their thresholds at the same time:</p>
      <ul class="env">
        <li><b class="k-skill">Skill</b>: the specific capability the moment calls for. Not a conservatory grade. For the Sex Pistols it was attitude; for Caruso it was a voice shaped for a horn.</li>
        <li><b class="k-env">Environment</b>: the technology, the business, the city, the gatekeepers, and who the system is willing to let through. Microphones, race records, MTV, SoundScan, Spotify, TikTok.</li>
        <li><b class="k-need">Cultural need</b>: what a population was hungry for right then. Joy eleven weeks after Dallas. Sincerity after a decade of gloss. A whisper in an earbud.</li>
      </ul>
      <p>The lock is a <em>conjunction</em>, not a sum. Two out of three does not give you two thirds of a career. The outcome table shows what each missing term produces.</p>
      <div class="table-wrap"><table class="matrix"><thead><tr><th class="k-skill">Skill</th><th class="k-env">Env</th><th class="k-need">Need</th><th>Outcome</th><th>Example</th></tr></thead><tbody>${rows}</tbody></table></div>
      <h3>Why the window is short</h3>
      <p>The three terms move on different clocks. Skill accumulates slowly over years. Environment changes in steps when a technology or a gate opens. Need swings like a pendulum with a period of roughly a generation, because each cohort wants the opposite of what its older siblings had. The orrery in the scene shows this: a slow ring, a stepping ring, an oscillating ring. They align briefly.</p>
      <h3>The pendulum model</h3>
      <p>Each epoch is scored on five bipolar axes. A sinusoid is fitted per axis to those scores with a period search, then extrapolated with an error cone. Fitted parameters:</p>
      <div class="table-wrap"><table class="matrix"><thead><tr><th>Axis</th><th>Period</th><th>Amplitude</th><th>Next turn</th></tr></thead><tbody>${periods}</tbody></table></div>
      <h3>What this leaves out</h3>
      <ul class="env">
        <li>Survivorship: the archive only contains locks that happened. For every entry there were thousands with two out of three.</li>
        <li>Hindsight: "the culture needed it" is easy to say afterwards. The forecast tabs are the honest test of whether the idea predicts anything.</li>
        <li>Luck, properly defined, is the two terms you do not control. Skill is the one you do. The strategy that follows is unglamorous: build the skill, move toward the environment, and still be there when the need swings around.</li>
      </ul>
      <h3>How the drive works</h3>
      <p>The ship has a position in time, a temporal velocity (years of history per second of your time) and a bounded acceleration of ${AMAX} yr/s², with a drag that rises with speed toward an asymptote of ${VMAX} yr/s. You cannot stop instantly. The autopilot plans a bang-bang trajectory with a damped final approach. The instruments are dressed as relativistic readouts: <b>γ</b> is the dilation factor at your fraction of top speed, <b>Doppler</b> is signed by direction (blue toward the future, red toward the past) and shifts both the tunnel colour and the engine pitch, <b>coherence</b> falls with acceleration and speed, and <b>strain</b> integrates how violently you have been pushing through time.</p>`;
  }
}
