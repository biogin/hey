// The cultural pendulum model.
// For each need axis we fit  y(t) = a + b·sin(ωt) + c·cos(ωt)  to the historical epochs,
// searching the period 2π/ω on a grid. Forecasts extrapolate the fitted oscillation and
// carry an uncertainty band that widens with distance from the last observation:
//   σ(Δt) = σ_residual · sqrt(1 + (Δt / P)²)
// Beyond about one period the band covers most of the axis, which is the model's own way of
// saying it no longer knows. This is a toy, and it is labelled as one in the interface.
import { AXES, HISTORICAL, PRESENT } from './epochs.js';

function solve3(A, y) {
  // Least squares for 3 parameters via normal equations (3x3 Cramer's rule).
  const n = A.length;
  const M = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  const v = [0, 0, 0];
  for (let i = 0; i < n; i++) {
    for (let r = 0; r < 3; r++) {
      v[r] += A[i][r] * y[i];
      for (let c = 0; c < 3; c++) M[r][c] += A[i][r] * A[i][c];
    }
  }
  const det = (m) => m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
  const D = det(M);
  if (Math.abs(D) < 1e-12) return [0, 0, 0];
  const col = (k) => M.map((row, i) => row.map((val, j) => (j === k ? v[i] : val)));
  return [det(col(0)) / D, det(col(1)) / D, det(col(2)) / D];
}

export function fitAxis(key) {
  const pts = HISTORICAL.map((e) => ({ t: e.center, y: e.axes[key] }));
  // Weight recent epochs more: the pendulum we care about is the modern one.
  let best = null;
  for (let P = 16; P <= 64; P += 0.5) {
    const w = (2 * Math.PI) / P;
    const A = pts.map((p) => [1, Math.sin(w * p.t), Math.cos(w * p.t)]);
    const [a, b, c] = solve3(A, pts.map((p) => p.y));
    let sse = 0;
    for (const p of pts) { const r = p.y - (a + b * Math.sin(w * p.t) + c * Math.cos(w * p.t)); sse += r * r; }
    if (!best || sse < best.sse) best = { P, a, b, c, sse };
  }
  const sigma = Math.sqrt(best.sse / Math.max(1, pts.length - 3));
  const amp = Math.hypot(best.b, best.c);
  const w = (2 * Math.PI) / best.P;
  const predict = (t) => Math.max(-1, Math.min(1, best.a + best.b * Math.sin(w * t) + best.c * Math.cos(w * t)));
  const band = (t) => { const dt = Math.max(0, t - PRESENT); return Math.min(1.2, sigma * Math.sqrt(1 + (dt / best.P) ** 2)); };
  // Phase: where in the cycle we are at PRESENT, as "years until the next turning point".
  const slope = (t) => w * (best.b * Math.cos(w * t) - best.c * Math.sin(w * t));
  let turn = PRESENT, s0 = Math.sign(slope(PRESENT));
  for (let t = PRESENT; t < PRESENT + best.P; t += 0.25) { if (Math.sign(slope(t)) !== s0) { turn = t; break; } }
  return { key, period: best.P, amplitude: amp, mean: best.a, sigma, predict, band, slope, nextTurn: turn, points: pts };
}

let cache = null;
export function pendulum() {
  if (cache) return cache;
  cache = {};
  for (const ax of AXES) cache[ax.key] = fitAxis(ax.key);
  return cache;
}

export function forecastVector(year) {
  const m = pendulum();
  const out = {};
  for (const ax of AXES) out[ax.key] = { value: m[ax.key].predict(year), band: m[ax.key].band(year) };
  return out;
}

export function describeDirection(key, year) {
  const m = pendulum()[key];
  const ax = AXES.find((a) => a.key === key);
  const v = m.predict(year), s = m.slope(year);
  const toward = s > 0 ? ax.pos : ax.neg;
  const strength = Math.abs(v) > 0.45 ? 'strongly' : Math.abs(v) > 0.2 ? 'moderately' : 'near the center';
  return { value: v, toward, strength, period: m.period, nextTurn: m.nextTurn };
}
