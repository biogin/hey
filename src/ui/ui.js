// HUD, dossier panel, timeline console, throttle, overlays. All text comes from the i18n layer.
import { EPOCHS, HISTORICAL, YEAR_MIN, YEAR_MAX, PRESENT } from '../data/epochs.js';
import { pendulumStrip, forecastChart } from './charts.js';
import { forecastVector, pendulum, describeDirection, FIT_FROM } from '../data/forecast.js';
import { VMAX, AMAX } from '../engine/chronos.js';
import { t, tAxes, tOutcomes, tEpoch, tEpochs, LANGS, langName, getLang, setLang } from '../i18n/index.js';

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
      prevBtn: $('#prevEpoch'), nextBtn: $('#nextEpoch'), langSel: $('#langSel'), langSelIntro: $('#langSelIntro'),
    };
    this.digits = [];
    this.selectedIndex = -1;
    this.panelOpen = true;
    this.shownId = undefined;
    this.panelState = null;   // what the dossier currently shows, so it can be re-rendered in another language
    this.soundOn = false;
    this._buildOdometer();
    this._buildLangSelects();
    this._buildTimeline();
    this._bindThrottle();
    this._bindButtons();
    this.relocalize();
  }

  // ------------------------------------------------------------- language
  _buildLangSelects() {
    for (const sel of [this.els.langSel, this.els.langSelIntro]) {
      sel.innerHTML = LANGS.map((c) => `<option value="${c}">${esc(langName(c))}</option>`).join('');
      sel.addEventListener('change', () => { setLang(sel.value); this.h.onClick?.(); });
    }
  }

  // Re-render every piece of text in the current language.
  relocalize() {
    document.title = t('app.title');
    for (const sel of [this.els.langSel, this.els.langSelIntro]) { sel.value = getLang(); sel.setAttribute('aria-label', t('btn.language')); sel.title = t('btn.language'); }
    document.querySelectorAll('[data-i18n]').forEach((el) => { el.innerHTML = t(el.dataset.i18n); });
    document.querySelectorAll('[data-i18n-title]').forEach((el) => { el.title = t(el.dataset.i18nTitle); });
    document.querySelectorAll('[data-i18n-aria]').forEach((el) => { el.setAttribute('aria-label', t(el.dataset.i18nAria)); });
    this.setSound(this.soundOn);
    this._buildTimelineMarkers();
    this._buildTheory();
    const ps = this.panelState; this.shownId = undefined;
    if (ps?.type === 'epoch') this.showEpoch(ps.epoch, ps.prev, this.selectedIndex);
    else if (ps?.type === 'void') this.showInterstice(ps.year, ps.before, ps.after);
    if (this.els.mode) this.els.mode.textContent = '';
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
      let lowerNine = true; for (let j = 0; j < k; j++) if (Math.floor(intY / Math.pow(10, j)) % 10 !== 9) { lowerNine = false; break; }
      const pos = val + (lowerNine ? f0 : 0);
      this.digits[3 - k].style.transform = `translateY(${(-pos * 100) / 11}%)`;
    }
    this.els.frac.textContent = '.' + Math.floor(f0 * 10);
  }

  // ------------------------------------------------------------- timeline
  _buildTimelineMarkers() {
    const m = this.els.markers; m.innerHTML = '';
    const here = this.panelState?.type === 'epoch' ? this.panelState.epoch.id : null;
    for (const e of tEpochs()) {
      const idx = EPOCHS.findIndex((x) => x.id === e.id);
      const b = document.createElement('button'); b.className = 'tl-mark' + (e.forecast ? ' forecast' : '') + (idx % 2 ? ' row2' : '') + (e.id === here ? ' here' : ''); b.style.left = `${yearToX(e.center) * 100}%`;
      b.innerHTML = `<span class="tl-dot"></span><span class="tl-name">${esc(e.short)}</span>`; b.title = t('tl.marker', { name: e.name, a: e.span[0], b: e.span[1] }); b.dataset.id = e.id;
      b.addEventListener('click', (ev) => { ev.stopPropagation(); this.h.onGoTo(e.center); this.h.onClick?.(); });
      m.appendChild(b);
    }
    const now = document.createElement('div'); now.className = 'tl-now'; now.style.left = `${yearToX(PRESENT) * 100}%`; now.innerHTML = `<span>${esc(t('tl.now'))}</span>`; m.appendChild(now);
  }
  _buildTimeline() {
    const tk = this.els.ticks; tk.innerHTML = '';
    for (let y = 1700; y <= 2080; y += y < 1880 ? 50 : y < 2026 ? 10 : 20) { const s = document.createElement('span'); s.style.left = `${yearToX(y) * 100}%`; s.textContent = y % 50 === 0 || y >= 2026 ? y : ''; s.className = 'tl-tick' + (y % 50 === 0 ? ' major' : '') + (y % 100 === 0 ? ' century' : ''); tk.appendChild(s); }
    const tr = this.els.track; let scrubbing = false;
    const toYear = (ev) => { const r = tr.getBoundingClientRect(); return xToYear(Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width))); };
    tr.addEventListener('pointerdown', (ev) => { scrubbing = true; tr.setPointerCapture(ev.pointerId); this.els.tlLabel.hidden = false; this._scrubShow(toYear(ev)); });
    tr.addEventListener('pointermove', (ev) => { this.els.tlLabel.hidden = false; this._scrubShow(toYear(ev)); });
    tr.addEventListener('pointerup', (ev) => { if (!scrubbing) return; scrubbing = false; this.h.onGoTo(toYear(ev)); this.h.onClick?.(); });
    tr.addEventListener('pointerleave', () => { if (!scrubbing) this.els.tlLabel.hidden = true; });
  }
  _scrubShow(y) { const l = this.els.tlLabel; l.style.left = `${yearToX(y) * 100}%`; l.textContent = `→ ${Math.round(y)}`; }

  // ------------------------------------------------------------- throttle
  _bindThrottle() {
    const tr = this.els.throttle; let active = false;
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
  setSound(on) { this.soundOn = on; this.els.sound.setAttribute('aria-pressed', String(on)); this.els.sound.textContent = on ? t('btn.soundOn') : t('btn.soundOff'); }
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
    const dirKey = ch.v > 0.3 ? 'dir.future' : ch.v < -0.3 ? 'dir.past' : 'dir.rest';
    const dirText = t(dirKey); if (this.els.dir.textContent !== dirText) { this.els.dir.textContent = dirText; this.els.dir.className = 'dir ' + (ch.v > 0.3 ? 'fut' : ch.v < -0.3 ? 'past' : ''); }
    const modeKey = ch.mode === 'autopilot' ? 'autopilot' : ch.mode === 'manual' ? (ch._braking ? 'braking' : 'manual') : s.docked ? 'docked' : 'adrift';
    const modeText = t('mode.' + modeKey);
    if (this.els.mode.textContent !== modeText) { this.els.mode.textContent = modeText; this.els.mode.dataset.mode = modeKey; }
    this.els.eta.textContent = ch.eta != null ? t('hud.eta', { year: Math.round(ch.target), s: ch.eta.toFixed(1) }) : '';
    this.els.needle.style.left = `${yearToX(ch.year) * 100}%`;
    document.body.classList.toggle('moving', ch.moving);
    document.body.style.setProperty('--speed', ch.speedRatio.toFixed(3));
    this.els.dockBtn.disabled = !(s.nearest && s.nearest.distance > 0.5 && !ch.moving) && ch.mode !== 'manual';
    this.els.stopBtn.hidden = ch.mode !== 'autopilot';
    if (ch.mode === 'autopilot') { const u = ch.a / AMAX; this._thrustVisual(Math.max(-1, Math.min(1, u))); }
  }

  flash(epochBase, v) {
    const epoch = tEpoch(epochBase);
    const f = this.els.flash; f.textContent = epoch.name; this.els.flashSub.textContent = t('flash.sub', { a: epoch.span[0], b: epoch.span[1], v: Math.abs(v).toFixed(0) });
    f.parentElement.classList.remove('show'); void f.parentElement.offsetWidth; f.parentElement.classList.add('show');
  }
  toast(msg, ms = 2600) { const tt = this.els.toast; tt.textContent = msg; tt.hidden = false; tt.classList.remove('show'); void tt.offsetWidth; tt.classList.add('show'); clearTimeout(this._tt); this._tt = setTimeout(() => { tt.hidden = true; }, ms); }

  // ------------------------------------------------------------- dossier panel
  showEpoch(epochBase, prevBase, reselect = -1) {
    if (this.shownId === epochBase.id) return;
    this.shownId = epochBase.id; this.selectedIndex = -1;
    this.panelState = { type: 'epoch', epoch: epochBase, prev: prevBase };
    const epoch = tEpoch(epochBase), prev = prevBase ? tEpoch(prevBase) : null;
    document.querySelectorAll('.tl-mark').forEach((b) => b.classList.toggle('here', b.dataset.id === epoch.id));
    this.els.dock.classList.remove('hidden');
    this.els.dockBody.scrollTop = 0;
    this.els.dockBody.innerHTML = epoch.forecast ? this._forecastHTML(epoch) : this._epochHTML(epoch, prev);
    if (epoch.forecast) this._wireForecast(epoch); else this._wireCases(epochBase);
    if (reselect >= 0 && !epoch.forecast) { const btn = this.els.dockBody.querySelector(`.case[data-i="${reselect}"]`); if (btn) this._openCase(epochBase, btn, false); }
  }

  showInterstice(year, before, after) {
    const id = 'void' + Math.round(year / 5);
    if (this.shownId === id) return;
    this.shownId = id; this.selectedIndex = -1;
    this.panelState = { type: 'void', year, before, after };
    document.querySelectorAll('.tl-mark').forEach((b) => b.classList.remove('here'));
    this.els.dock.classList.remove('hidden');
    const y = Math.round(year);
    const bl = before ? tEpoch(before) : null, al = after ? tEpoch(after) : null;
    this.els.dockBody.innerHTML = `
      <p class="eyebrow">${esc(t('void.eyebrow', { y }))}</p>
      <h2 class="display">${esc(t('void.title'))}</h2>
      <p class="lede serif">${esc(t('void.lede', { y }))}</p>
      <div class="void-nav">
        ${bl ? `<button class="btn ghost" data-go="${bl.center}">◀ ${esc(bl.name)} <small>${bl.center}</small></button>` : ''}
        ${al ? `<button class="btn ghost" data-go="${al.center}">${esc(al.name)} ▶ <small>${al.center}</small></button>` : ''}
      </div>
      <p class="fine">${esc(t('void.tip', { amax: AMAX, vmax: VMAX }))}</p>`;
    this.els.dockBody.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => { this.h.onGoTo(+b.dataset.go); this.h.onClick?.(); }));
  }

  hidePanel() { this.els.dock.classList.add('hidden'); this.shownId = undefined; this.panelState = null; }

  _fitBars(fit) {
    const row = (k, label) => `<div class="fit-row"><span class="fit-k">${esc(label)}</span><span class="fit-track"><span class="fit-bar ${k}" style="width:${Math.round(fit[k] * 100)}%"></span></span><span class="fit-v mono">${Math.round(fit[k] * 100)}</span></div>`;
    return `<div class="fit">${row('skill', t('fit.skill'))}${row('env', t('fit.env'))}${row('need', t('fit.need'))}</div>`;
  }

  _epochHTML(e, prev) {
    const cases = e.artists.map((a, i) => `
      <button class="case" data-i="${i}" aria-expanded="false">
        <span class="case-top"><span class="case-name">${esc(a.name)}</span><span class="case-year mono">${a.year}</span></span>
        <span class="case-head">${esc(a.headline)}</span>
        ${this._fitBars(a.fit)}
        <span class="chip ${a.status}">${esc(t('status.' + a.status))}</span>
      </button>
      <div class="case-detail" data-d="${i}" hidden>
        <dl>
          <dt class="k-skill">${esc(t('case.skill'))}</dt><dd>${esc(a.skill)}</dd>
          <dt class="k-env">${esc(t('case.env'))}</dt><dd>${esc(a.environment)}</dd>
          <dt class="k-need">${esc(t('case.need'))}</dt><dd>${esc(a.need)}</dd>
        </dl>
        <p class="kairos serif">${esc(a.kairos)}</p>
        ${a.note ? `<p class="note">${esc(a.note)}</p>` : ''}
        <p class="fine">${esc(a.place)}</p>
      </div>`).join('');
    return `
      <p class="eyebrow">${esc(t('panel.epoch', { a: e.span[0], b: e.span[1] }))}</p>
      <h2 class="display">${esc(e.name)}</h2>
      <p class="lede">${esc(e.tagline)}</p>
      <section><h3>${esc(t('panel.need'))}</h3><p class="serif need">${esc(e.need)}</p></section>
      <section><h3>${esc(t('panel.env'))}</h3><ul class="env">${e.environment.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></section>
      <section><h3>${esc(t('panel.cases'))} <span class="hint">${esc(t('panel.cases.hint'))}</span></h3><div class="cases">${cases}</div></section>
      <section><h3>${esc(t('panel.pendulum'))}</h3>${pendulumStrip({ current: e.axes, previous: prev?.axes || null, currentLabel: e.short, previousLabel: prev ? prev.short : t('legend.previous') })}<p class="fine">${esc(t('panel.pendulum.fine'))}</p></section>`;
  }

  _openCase(epochBase, btn, scroll = true) {
    const body = this.els.dockBody; const i = +btn.dataset.i;
    body.querySelectorAll('.case').forEach((b) => b.setAttribute('aria-expanded', 'false'));
    body.querySelectorAll('.case-detail').forEach((d) => { d.hidden = true; });
    btn.setAttribute('aria-expanded', 'true'); body.querySelector(`.case-detail[data-d="${i}"]`).hidden = false;
    this.selectedIndex = i; this.h.onSelectArtist(epochBase.artists[i]);
    if (scroll) btn.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  _wireCases(epochBase) {
    const body = this.els.dockBody;
    body.querySelectorAll('.case').forEach((btn) => btn.addEventListener('click', () => {
      const open = btn.getAttribute('aria-expanded') === 'true';
      if (open) { body.querySelectorAll('.case').forEach((b) => b.setAttribute('aria-expanded', 'false')); body.querySelectorAll('.case-detail').forEach((d) => { d.hidden = true; }); this.selectedIndex = -1; this.h.onSelectArtist(null); return; }
      this._openCase(epochBase, btn, true);
    }));
  }

  _forecastHTML(e) {
    const AXES = tAxes();
    const fv = forecastVector(e.center);
    const cur = {}, bands = {}; for (const ax of AXES) { cur[ax.key] = fv[ax.key].value; bands[ax.key] = fv[ax.key].band; }
    const conf = Math.round(e.confidence * 100);
    const dirs = AXES.map((ax) => {
      const d = describeDirection(ax.key, e.center);
      const vars = { neg: esc(ax.neg), pos: esc(ax.pos), pole: esc(d.value >= 0 ? ax.pos : ax.neg), toward: esc(d.towardPos ? ax.pos : ax.neg) };
      return `<li>${t(d.strength === 'center' ? 'fc.dir.center' : d.strength === 'strong' ? 'fc.dir.strong' : 'fc.dir.moderate', vars)}</li>`;
    }).join('');
    const nFit = HISTORICAL.filter((x) => x.center >= FIT_FROM).length;
    return `
      <p class="eyebrow forecast">${esc(t('fc.eyebrow', { n: e.horizon, years: e.horizon === 1 ? t('fc.year') : t('fc.years'), year: e.center }))}</p>
      <h2 class="display">${esc(e.name)}</h2>
      <p class="lede">${esc(e.tagline)}</p>
      <div class="conf"><span class="conf-k">${esc(t('fc.confidence'))}</span><span class="conf-track"><span class="conf-bar" style="width:${conf}%"></span></span><span class="mono">${conf}%</span></div>
      <section><h3>${esc(t('fc.need'))}</h3><p class="serif need">${esc(e.need)}</p></section>
      <section><h3>${esc(t('fc.env'))}</h3><ul class="env">${e.environment.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></section>
      <section><h3>${esc(t('fc.skills'))}</h3><ul class="env">${e.skills.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></section>
      <section><h3>${esc(t('fc.who'))}</h3><ul class="env arch">${e.archetypes.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></section>
      <section><h3>${esc(t('fc.model'))}</h3>
        ${pendulumStrip({ current: cur, bands, currentLabel: t('fc.model.legend', { year: e.center }) })}
        <ul class="dirs">${dirs}</ul>
        <div class="axis-chips">${AXES.map((ax, i) => `<button class="chip-btn ${i === 0 ? 'on' : ''}" data-axis="${ax.key}">${esc(ax.pos)}</button>`).join('')}</div>
        <div id="fchart"></div>
        <p class="fine">${esc(t('fc.fine', { n: nFit, from: FIT_FROM, year: Math.round(pendulum().sincerity.period * 1.5 + PRESENT) }))}</p>
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
    const rows = tOutcomes().map((r) => `<tr><td>${r.skill ? '●' : '○'}</td><td>${r.env ? '●' : '○'}</td><td>${r.need ? '●' : '○'}</td><td>${esc(r.outcome)}</td><td class="muted">${esc(r.example)}</td></tr>`).join('');
    const periods = tAxes().map((ax) => `<tr><td>${esc(ax.neg)} ↔ ${esc(ax.pos)}</td><td class="mono">${m[ax.key].period.toFixed(0)} ${esc(t('theory.yr'))}</td><td class="mono">${m[ax.key].amplitude.toFixed(2)}</td><td class="mono">${Math.round(m[ax.key].nextTurn)}</td></tr>`).join('');
    $('#theoryBody').innerHTML = `
      <p class="eyebrow">${esc(t('theory.eyebrow'))}</p>
      <h2 class="display">${esc(t('theory.title'))}</h2>
      <p>${t('theory.p1')}</p>
      <h3>${esc(t('theory.h.lock'))}</h3>
      <p>${t('theory.p2')}</p>
      <ul class="env"><li>${t('theory.li.skill')}</li><li>${t('theory.li.env')}</li><li>${t('theory.li.need')}</li></ul>
      <p>${t('theory.p3')}</p>
      <div class="table-wrap"><table class="matrix"><thead><tr><th class="k-skill">${esc(t('theory.th.skill'))}</th><th class="k-env">${esc(t('theory.th.env'))}</th><th class="k-need">${esc(t('theory.th.need'))}</th><th>${esc(t('theory.th.outcome'))}</th><th>${esc(t('theory.th.example'))}</th></tr></thead><tbody>${rows}</tbody></table></div>
      <h3>${esc(t('theory.h.window'))}</h3>
      <p>${t('theory.p4')}</p>
      <h3>${esc(t('theory.h.model'))}</h3>
      <p>${t('theory.p5', { from: FIT_FROM })}</p>
      <div class="table-wrap"><table class="matrix"><thead><tr><th>${esc(t('theory.th.axis'))}</th><th>${esc(t('theory.th.period'))}</th><th>${esc(t('theory.th.amp'))}</th><th>${esc(t('theory.th.turn'))}</th></tr></thead><tbody>${periods}</tbody></table></div>
      <h3>${esc(t('theory.h.missing'))}</h3>
      <ul class="env"><li>${t('theory.li.surv')}</li><li>${t('theory.li.hind')}</li><li>${t('theory.li.luck')}</li></ul>
      <h3>${esc(t('theory.h.drive'))}</h3>
      <p>${t('theory.p6', { amax: AMAX, vmax: VMAX })}</p>`;
  }
}
