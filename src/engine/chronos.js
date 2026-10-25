// The Chronos drive: temporal kinematics with inertia.
// The ship has a position in time (year), a temporal velocity (years per second of ship time),
// a bounded acceleration, and a mild "chronal drag" that grows with speed. You cannot stop
// instantly; you have to brake. The autopilot plans a bang-bang trajectory with a damped final
// approach, which is what a real controller with a bounded actuator would do.
import { YEAR_MIN, YEAR_MAX } from '../data/epochs.js';

export const VMAX = 180;      // yr/s: the drive's asymptotic speed
export const AMAX = 70;       // yr/s²
const DRAG = 0.35;            // chronal drag coefficient (dimensionless)
const DOCK_V = 0.25;          // yr/s: below this we count as stationary
const DOCK_D = 0.08;          // years

export class Chronos {
  constructor(year = 2026) {
    this.year = year;
    this.v = 0;
    this.a = 0;
    this.thrust = 0;       // commanded, -1..1
    this.target = null;    // autopilot target year
    this.mode = 'docked';  // docked | manual | autopilot
    this.energy = 0;       // integrated |a·v|, a proxy for how violently we have moved through time
    this.odometer = 0;     // total |Δyear| travelled
    this.boundaryHit = 0;  // timestamp of last boundary bounce for UI
    this.restTime = 0;     // seconds at rest
    this.eta = null;
  }

  setThrust(u) {
    this.thrust = Math.max(-1, Math.min(1, u));
    if (Math.abs(this.thrust) > 0.001) { this.mode = 'manual'; this.target = null; }
  }

  brake() {
    // Manual brake: command thrust against motion. Finishes when stationary.
    if (Math.abs(this.v) < DOCK_V) { this.v = 0; this.thrust = 0; return; }
    this.mode = 'manual';
    this.target = null;
    this.thrust = -Math.sign(this.v);
    this._braking = true;
  }

  goTo(year) {
    this.target = Math.max(YEAR_MIN, Math.min(YEAR_MAX, year));
    this.mode = 'autopilot';
    this._braking = false;
  }

  stop() { this.target = null; this.thrust = 0; this.mode = Math.abs(this.v) < DOCK_V ? 'docked' : 'manual'; }

  // Estimated time to reach the target with a bang-bang profile (ignoring drag).
  estimateETA(target = this.target) {
    if (target == null) return null;
    const d = target - this.year, v0 = this.v;
    const dir = Math.sign(d) || 1;
    // Distance needed to brake from current speed, if moving toward the target.
    const vAlong = v0 * dir;
    const tBrakeNow = Math.abs(v0) / AMAX;
    // Simple trapezoid: accelerate to VMAX, cruise, brake. Good enough for a readout.
    const dist = Math.abs(d);
    const tAccel = (VMAX - Math.max(0, vAlong)) / AMAX;
    const dAccel = Math.max(0, vAlong) * tAccel + 0.5 * AMAX * tAccel * tAccel;
    const dBrake = (VMAX * VMAX) / (2 * AMAX);
    if (dAccel + dBrake >= dist) {
      const vPeak = Math.sqrt(Math.max(0, AMAX * dist + 0.5 * Math.max(0, vAlong) ** 2));
      return (vPeak - Math.max(0, vAlong)) / AMAX + vPeak / AMAX + (vAlong < 0 ? tBrakeNow : 0);
    }
    return tAccel + (dist - dAccel - dBrake) / VMAX + VMAX / AMAX + (vAlong < 0 ? tBrakeNow : 0);
  }

  // Fixed sub-steps keep the simulation real-time even when rendering is slow.
  update(dt) {
    let remaining = Math.min(dt, 1.0);
    while (remaining > 0) { const h = Math.min(remaining, 1 / 60); this._step(h); remaining -= h; }
  }

  _step(dt) {
    let u = this.thrust;

    if (this.mode === 'autopilot' && this.target != null) {
      const d = this.target - this.year;
      const absd = Math.abs(d);
      const dir = Math.sign(d) || 1;
      const stopDist = (this.v * this.v) / (2 * AMAX * 0.92); // margin for drag model mismatch
      if (absd < 3 && Math.abs(this.v) < 25) {
        // Final approach: critically damped spring toward the target.
        const k = 9, c = 2 * Math.sqrt(k);
        const aDes = k * d - c * this.v;
        u = Math.max(-1, Math.min(1, aDes / AMAX));
      } else if (Math.sign(this.v) === dir && absd <= stopDist) {
        u = -dir; // brake
      } else {
        u = dir;  // accelerate toward target
      }
      if (absd < DOCK_D && Math.abs(this.v) < DOCK_V) {
        this.year = this.target; this.v = 0; u = 0; this.target = null; this.mode = 'docked';
      }
      this.eta = this.estimateETA();
    } else {
      this.eta = null;
      if (this._braking) {
        if (Math.abs(this.v) < DOCK_V || Math.sign(this.v) !== -Math.sign(this.thrust)) { this.v = 0; this.thrust = 0; u = 0; this._braking = false; }
      }
    }

    // Dynamics
    const drag = DRAG * this.v * Math.abs(this.v) / VMAX;
    this.a = u * AMAX - drag;
    this.v += this.a * dt;
    if (this.v > VMAX) this.v = VMAX;
    if (this.v < -VMAX) this.v = -VMAX;
    const dy = this.v * dt;
    this.year += dy;
    this.odometer += Math.abs(dy);
    this.energy = this.energy * Math.exp(-dt * 0.6) + Math.abs(this.a * this.v) * dt * 0.02;

    // Temporal boundaries: the drive cannot push past the archive (past) or the forecast horizon (future).
    if (this.year < YEAR_MIN) { this.year = YEAR_MIN; this.v = -this.v * 0.35; this.boundaryHit = performance.now(); if (this.mode === 'autopilot') { this.target = null; this.mode = 'manual'; } }
    if (this.year > YEAR_MAX) { this.year = YEAR_MAX; this.v = -this.v * 0.35; this.boundaryHit = performance.now(); if (this.mode === 'autopilot') { this.target = null; this.mode = 'manual'; } }

    // Rest detection for manual mode
    if (this.mode !== 'autopilot') {
      if (Math.abs(this.v) < DOCK_V && Math.abs(u) < 0.01) { this.restTime += dt; if (this.restTime > 0.4) { this.v = 0; this.mode = 'docked'; } }
      else this.restTime = 0;
    }
  }

  // Readouts, dressed as relativistic instruments.
  get speedRatio() { return Math.min(0.999, Math.abs(this.v) / VMAX); }
  get gamma() { return 1 / Math.sqrt(1 - this.speedRatio * this.speedRatio); }
  get doppler() { return this.v / VMAX; } // + toward the future (blue), - toward the past (red)
  get coherence() { return Math.max(0, 1 - 0.35 * Math.abs(this.a) / AMAX - 0.45 * this.speedRatio * this.speedRatio); }
  get moving() { return Math.abs(this.v) > DOCK_V; }
}
