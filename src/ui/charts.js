// SVG charts for the dossier panel: the need-pendulum strip and the forecast time series.
import { PRESENT } from '../data/epochs.js';
import { pendulum, FIT_FROM } from '../data/forecast.js';
import { t, tAxes, tAxis } from '../i18n/index.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmt = (v) => (v >= 0 ? '+' : '') + v.toFixed(2);

// Five bipolar rows. `current` and `previous` are axis objects (-1..1); `bands` optional {key: ±}.
export function pendulumStrip({ current, previous, bands, currentLabel = '', previousLabel = '' }) {
  const AXES = tAxes();
  const W = 320, rowH = 34, padL = 74, padR = 74, top = 10;
  const H = top + AXES.length * rowH + 26;
  const cx = padL + (W - padL - padR) / 2, half = (W - padL - padR) / 2;
  const x = (v) => cx + v * half;
  let rows = '';
  AXES.forEach((ax, i) => {
    const y = top + i * rowH + rowH / 2;
    const v = current?.[ax.key] ?? 0;
    const b = bands?.[ax.key];
    const col = v >= 0 ? 'var(--pos)' : 'var(--neg)';
    rows += `<g class="prow" data-axis="${ax.key}">
      <title>${esc(ax.neg)} ↔ ${esc(ax.pos)}: ${fmt(v)}${b != null ? ' ± ' + b.toFixed(2) : ''}${previous ? ' (' + t('chart.previous') + ' ' + fmt(previous[ax.key]) + ')' : ''}</title>
      <line x1="${padL}" x2="${W - padR}" y1="${y}" y2="${y}" stroke="var(--line)" stroke-width="1"/>
      <line x1="${cx}" x2="${cx}" y1="${y - 9}" y2="${y + 9}" stroke="var(--ink-3)" stroke-width="1"/>
      ${b != null ? `<rect x="${Math.min(x(v - b), x(v + b)).toFixed(1)}" y="${y - 7}" width="${Math.abs(x(v + b) - x(v - b)).toFixed(1)}" height="14" fill="${col}" opacity="0.18" rx="2"/>` : ''}
      <rect x="${Math.min(cx, x(v)).toFixed(1)}" y="${y - 4}" width="${Math.max(1.5, Math.abs(x(v) - cx)).toFixed(1)}" height="8" fill="${col}" rx="3"/>
      ${previous ? `<circle cx="${x(previous[ax.key]).toFixed(1)}" cy="${y}" r="4.5" fill="var(--glass)" stroke="var(--ink-2)" stroke-width="1.5"/>` : ''}
      <text x="${padL - 8}" y="${y + 4}" text-anchor="end" class="plabel ${v < 0 ? 'on' : ''}">${esc(ax.neg)}</text>
      <text x="${W - padR + 8}" y="${y + 4}" text-anchor="start" class="plabel ${v >= 0 ? 'on' : ''}">${esc(ax.pos)}</text>
    </g>`;
  });
  const ly = H - 8;
  const legend = `<g class="plegend"><rect x="${padL}" y="${ly - 7}" width="14" height="7" fill="var(--pos)" rx="2"/><text x="${padL + 19}" y="${ly}" class="plabel on">${esc(currentLabel)}</text>${previous ? `<circle cx="${padL + 130}" cy="${ly - 3.5}" r="4" fill="none" stroke="var(--ink-2)" stroke-width="1.5"/><text x="${padL + 139}" y="${ly}" class="plabel">${esc(previousLabel)}</text>` : bands ? `<rect x="${padL + 120}" y="${ly - 7}" width="14" height="7" fill="var(--pos)" opacity="0.25" rx="2"/><text x="${padL + 139}" y="${ly}" class="plabel">${esc(t('chart.band'))}</text>` : ''}</g>`;
  return `<svg class="pendulum" viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="${esc(t('chart.aria.pendulum'))}">${rows}${legend}</svg>`;
}

// Time series of one axis: historical points, fitted pendulum, forecast band, hover crosshair.
export function forecastChart(container, axisKey, highlightYear) {
  const ax = tAxis(axisKey);
  const m = pendulum()[axisKey];
  const W = 340, H = 176, padL = 12, padR = 12, padT = 16, padB = 28;
  const x0 = FIT_FROM - 8, x1 = 2090;
  const X = (yr) => padL + ((yr - x0) / (x1 - x0)) * (W - padL - padR);
  const Y = (v) => padT + ((1 - v) / 2) * (H - padT - padB);
  let curve = '', bandTop = '', bandBot = '';
  for (let yr = x0; yr <= x1; yr += 2) {
    const v = m.predict(yr); const p = `${X(yr).toFixed(1)},${Y(v).toFixed(1)}`;
    curve += (curve ? ' L' : 'M') + p;
    if (yr >= PRESENT) { const b = m.band(yr); bandTop += (bandTop ? ' L' : 'M') + `${X(yr).toFixed(1)},${Y(Math.min(1, v + b)).toFixed(1)}`; bandBot = `L${X(yr).toFixed(1)},${Y(Math.max(-1, v - b)).toFixed(1)} ` + bandBot; }
  }
  const band = `${bandTop} ${bandBot} Z`;
  const pts = m.points.map((p) => `<circle cx="${X(p.t).toFixed(1)}" cy="${Y(p.y).toFixed(1)}" r="4" fill="var(--pos)" stroke="var(--bg)" stroke-width="1.5"><title>${p.t}: ${fmt(p.y)}</title></circle>`).join('');
  const fy = highlightYear ? `<line x1="${X(highlightYear).toFixed(1)}" x2="${X(highlightYear).toFixed(1)}" y1="${padT}" y2="${H - padB}" stroke="var(--kairos)" stroke-dasharray="3 3"/><circle cx="${X(highlightYear).toFixed(1)}" cy="${Y(m.predict(highlightYear)).toFixed(1)}" r="5" fill="var(--kairos)" stroke="var(--bg)" stroke-width="1.5"/>` : '';
  const ticks = [1900, 1950, 2000, 2050, 2090].map((yr) => `<text x="${X(yr).toFixed(1)}" y="${H - 6}" text-anchor="middle" class="plabel">${yr}</text>`).join('');
  container.innerHTML = `<svg class="fchart" viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="${esc(t('chart.aria.forecast', { neg: ax.neg, pos: ax.pos }))}">
    <line x1="${padL}" x2="${W - padR}" y1="${Y(0)}" y2="${Y(0)}" stroke="var(--ink-3)" stroke-width="1"/>
    <line x1="${padL}" x2="${W - padR}" y1="${Y(1)}" y2="${Y(1)}" stroke="var(--line)"/><line x1="${padL}" x2="${W - padR}" y1="${Y(-1)}" y2="${Y(-1)}" stroke="var(--line)"/>
    <text x="${padL + 3}" y="${Y(1) - 3}" text-anchor="start" class="plabel on">▲ ${esc(ax.pos)}</text>
    <text x="${padL + 3}" y="${Y(-1) + 11}" text-anchor="start" class="plabel on">▼ ${esc(ax.neg)}</text>
    <path d="${band}" fill="var(--pos)" opacity="0.16"/>
    <path d="${curve}" fill="none" stroke="var(--ink-2)" stroke-width="2"/>
    <line x1="${X(PRESENT).toFixed(1)}" x2="${X(PRESENT).toFixed(1)}" y1="${padT}" y2="${H - padB}" stroke="var(--chronos)" stroke-width="1" opacity="0.7"/>
    <text x="${X(PRESENT) + 4}" y="${padT + 10}" class="plabel on">${esc(t('chart.now'))}</text>
    ${pts}${fy}${ticks}
    <g class="cross" opacity="0"><line y1="${padT}" y2="${H - padB}" stroke="var(--ink-2)" stroke-dasharray="2 3"/><circle r="4" fill="var(--ink)"/></g>
    <rect class="hit" x="${padL}" y="${padT}" width="${W - padL - padR}" height="${H - padT - padB}" fill="transparent"/>
  </svg>
  <div class="ftip" hidden></div>
  <p class="fcap">${esc(t('chart.caption', { p: m.period.toFixed(0), a: m.amplitude.toFixed(2), s: m.sigma.toFixed(2), y: Math.round(m.nextTurn), from: FIT_FROM }))}</p>`;
  const svg = container.querySelector('svg'), cross = svg.querySelector('.cross'), tip = container.querySelector('.ftip'), hit = svg.querySelector('.hit');
  const move = (e) => {
    const rect = svg.getBoundingClientRect(); const px = ((e.clientX - rect.left) / rect.width) * W;
    const yr = Math.round(x0 + ((px - padL) / (W - padL - padR)) * (x1 - x0));
    if (yr < x0 || yr > x1) return;
    const v = m.predict(yr); const b = yr >= PRESENT ? m.band(yr) : null;
    cross.setAttribute('opacity', '1'); cross.querySelector('line').setAttribute('x1', X(yr)); cross.querySelector('line').setAttribute('x2', X(yr));
    cross.querySelector('circle').setAttribute('cx', X(yr)); cross.querySelector('circle').setAttribute('cy', Y(v));
    tip.hidden = false; tip.textContent = `${yr}: ${fmt(v)}${b != null ? ' ± ' + b.toFixed(2) : ''} (${v >= 0 ? ax.pos : ax.neg})`;
    tip.style.left = `${Math.min(rect.width - 150, Math.max(0, e.clientX - rect.left + 10))}px`;
  };
  hit.addEventListener('pointermove', move); hit.addEventListener('pointerdown', move);
  hit.addEventListener('pointerleave', () => { cross.setAttribute('opacity', '0'); tip.hidden = true; });
}
