/**
 * Sampling-strategy library for the permutation feature (codebase-internal:
 * Churn Mode). Three strategies:
 *
 *   ladder    — per-algo doubling sweep until timeout (the original).
 *   spread    — explicit (algo, n) grid, Halton-sequence ordering, fixed K
 *               samples per cell. Uniform coverage of the whole space.
 *   budget    — same grid, but sample allocation is driven by per-cell CI:
 *               cells with high variance get more samples, cells that already
 *               meet the CI target stop early. The user picks the precision;
 *               the system picks the budget.
 *
 * Anything in `ladder` is handled inline in BenchmarkVisualizer's tick (it
 * predates this library). This module covers spread + budget — both share
 * the same grid + per-cell state shape, they just differ in cell-picking.
 */

import type { DataType } from "./benchmark";

// ── 2D Halton sequence ──────────────────────────────────────────────────────
// Quasi-random low-discrepancy sequence: every prefix of K draws covers
// [0,1]² more uniformly than uniform random would. We use it to order grid
// cell visits so a partial sweep is still well-spread.
//
// Why Halton over Sobol: Halton's direction-number setup for 2D is one line
// per axis (the van-der-Corput sequence in base b), no precomputed table.
// Sobol gets better discrepancy in higher dimensions but for 2D the
// difference is invisible.

function vanDerCorput(n: number, base: number): number {
  let q = 0;
  let bk = 1 / base;
  while (n > 0) {
    q += (n % base) * bk;
    n = Math.floor(n / base);
    bk /= base;
  }
  return q;
}

export class Halton2D {
  private i = 0;
  /** Return the next sample in [0,1)². Index starts at 1 — Halton(0) is
   *  always (0, 0) which is degenerate. */
  next(): [number, number] {
    this.i++;
    return [vanDerCorput(this.i, 2), vanDerCorput(this.i, 3)];
  }
  reset(): void { this.i = 0; }
}

// ── Welford running statistics ──────────────────────────────────────────────
// Update mean + variance in O(1) per sample without storing the full sample
// array. We DO store the array on each cell too (for bootstrap / display),
// but the running stats let the cell picker react to variance after each
// probe without re-summing.

export interface RunningStats {
  n: number;
  mean: number;
  /** Sum of squared deviations from the running mean. variance = m2/(n-1). */
  m2: number;
  min: number;
  max: number;
}

export function emptyStats(): RunningStats {
  return { n: 0, mean: 0, m2: 0, min: Infinity, max: -Infinity };
}

export function updateStats(s: RunningStats, x: number): RunningStats {
  const n = s.n + 1;
  const delta = x - s.mean;
  const mean = s.mean + delta / n;
  const delta2 = x - mean;
  const m2 = s.m2 + delta * delta2;
  return {
    n, mean, m2,
    min: Math.min(s.min, x),
    max: Math.max(s.max, x),
  };
}

export function stdDev(s: RunningStats): number {
  if (s.n < 2) return 0;
  return Math.sqrt(s.m2 / (s.n - 1));
}

// ── 95% confidence interval ─────────────────────────────────────────────────
// Half-width of the 95% CI on the mean, using a Student-t critical value
// at df = n-1. For n ≥ 30 the t value converges to 1.96 (normal); we
// interpolate for small n via a lookup table.

const T_95: Record<number, number> = {
  1: 12.71, 2: 4.30, 3: 3.18, 4: 2.78, 5: 2.57, 6: 2.45, 7: 2.36, 8: 2.31,
  9: 2.26, 10: 2.23, 11: 2.20, 12: 2.18, 13: 2.16, 14: 2.14, 15: 2.13,
  16: 2.12, 17: 2.11, 18: 2.10, 19: 2.09, 20: 2.09, 21: 2.08, 22: 2.07,
  23: 2.07, 24: 2.06, 25: 2.06, 26: 2.06, 27: 2.05, 28: 2.05, 29: 2.05,
};
const T_INF = 1.96;

function tCrit(df: number): number {
  if (df < 1) return Infinity;
  if (df >= 30) return T_INF;
  return T_95[df] ?? T_INF;
}

export interface ConfidenceInterval {
  mean: number;
  /** ± half-width — `mean ± halfWidth` is the 95% CI on the true mean. */
  halfWidth: number;
  /** halfWidth / mean — relative precision. 0.05 = ±5% of the mean. */
  ratio: number;
}

/** Convenience: build a 95% CI directly from a raw sample array. Used by
 *  the rankings table, which already has `roundTimes` per point. */
export function confidenceIntervalFromSamples(samples: number[]): ConfidenceInterval {
  if (samples.length < 2) {
    return { mean: samples[0] ?? 0, halfWidth: Infinity, ratio: Infinity };
  }
  let s = emptyStats();
  for (const x of samples) s = updateStats(s, x);
  return confidenceInterval(s);
}

export function confidenceInterval(s: RunningStats): ConfidenceInterval {
  if (s.n < 2 || s.mean <= 0) {
    return { mean: s.mean, halfWidth: Infinity, ratio: Infinity };
  }
  const sd = stdDev(s);
  const halfWidth = (tCrit(s.n - 1) * sd) / Math.sqrt(s.n);
  return { mean: s.mean, halfWidth, ratio: halfWidth / s.mean };
}

// ── Grid + cell state ───────────────────────────────────────────────────────

export interface GridCell {
  algo: string;
  dt: DataType;
  /** The n value this cell probes at. Set at grid construction; never moved. */
  n: number;
  stats: RunningStats;
  /** Raw sample array (for export / bootstrap). Same n as stats.n. */
  samples: number[];
  /** True when a probe at this (algo, n) timed out. No further probes will
   *  be issued — the cell stays at whatever sample count it had. */
  saturated: boolean;
}

export interface GridBuildOptions {
  algos: string[];
  /** Number of log-spaced n bins to cover. Ignored when `sizes` is provided. */
  bins?: number;
  /** Lower / upper of the log-spaced sweep. Ignored when `sizes` is provided. */
  nMin?: number;
  nMax?: number;
  /** Explicit n values to use as columns. When set, the grid uses these
   *  exact n's instead of a log-spaced derivation. This matters for h2h /
   *  master-grid analytics: probes have to land in the SAME (dt, scenario,
   *  n) buckets as normal-run data, or the head-to-head pairings can't
   *  tally and the grid looks sparse. Passing the user's selectedSizes
   *  here is almost always what you want. */
  sizes?: number[];
  /** Single dtype the entire grid is for. The benchmark uses one dtype per
   *  session; we build the grid for that one. */
  dt: DataType;
}

/** Geometric (log-spaced) n grid from nMin to nMax. Snaps each value to the
 *  nearest integer; duplicates removed. With nMin=64, nMax=5M, bins=8 you
 *  get roughly: 64, 256, 1k, 4k, 16k, 64k, 256k, 1M, 5M. */
export function buildSizeGrid(nMin: number, nMax: number, bins: number): number[] {
  if (bins < 2 || nMax <= nMin) return [nMin];
  const logLo = Math.log(nMin);
  const logHi = Math.log(nMax);
  const sizes: number[] = [];
  for (let i = 0; i < bins; i++) {
    const t = i / (bins - 1);
    const n = Math.max(2, Math.round(Math.exp(logLo + t * (logHi - logLo))));
    sizes.push(n);
  }
  // Dedup + sort ascending. Round-to-int can collide near nMin.
  return [...new Set(sizes)].sort((a, b) => a - b);
}

export function buildGrid(opts: GridBuildOptions): GridCell[] {
  let sizes: number[];
  if (opts.sizes && opts.sizes.length > 0) {
    sizes = [...new Set(opts.sizes)].sort((a, b) => a - b);
  } else {
    const bins = opts.bins ?? 8;
    sizes = buildSizeGrid(opts.nMin ?? 64, opts.nMax ?? 1_000_000, bins);
  }
  const cells: GridCell[] = [];
  for (const algo of opts.algos) {
    for (const n of sizes) {
      cells.push({
        algo, dt: opts.dt, n,
        stats: emptyStats(),
        samples: [],
        saturated: false,
      });
    }
  }
  return cells;
}

// ── Strategy types ──────────────────────────────────────────────────────────

export type Strategy = "ladder" | "spread" | "budget";

export interface SpreadParams {
  /** Target samples per cell. Once a cell hits this it's "done" and won't
   *  be revisited (saturated cells are also skipped). */
  samplesPerCell: number;
}

export interface BudgetParams {
  /** Target CI ratio — once `halfWidth / mean ≤ targetCI`, the cell is
   *  declared converged and skipped on future ticks. 0.10 = ±10% of mean. */
  targetCI: number;
  /** Minimum samples before convergence can even be checked. Stops a
   *  spuriously-tight 2-sample run from "converging" prematurely. */
  minSamples: number;
  /** Hard cap — if a cell hits this without converging, give up and move
   *  on. Prevents a wildly-noisy cell from soaking the entire budget. */
  maxSamples: number;
}

// ── Cell pickers ────────────────────────────────────────────────────────────

/**
 * Spread strategy: visit the cell with the FEWEST samples that isn't
 * saturated or already at the per-cell cap. Ties broken by a Halton draw
 * mapped onto the cell index.
 *
 * Returns null when every non-saturated cell has met its sample count
 * (sweep complete).
 */
export function pickSpreadCell(
  grid: GridCell[],
  params: SpreadParams,
  halton: Halton2D,
): GridCell | null {
  const eligible = grid.filter(
    c => !c.saturated && c.stats.n < params.samplesPerCell,
  );
  if (eligible.length === 0) return null;
  // Sort by sample-deficit ascending so least-sampled goes first.
  const minN = Math.min(...eligible.map(c => c.stats.n));
  const tier = eligible.filter(c => c.stats.n === minN);
  // Halton-pick within the deficit tier. Same Halton draw advances
  // both axes; we only use the first for cell-index mapping in 1D.
  // (Second component is unused here but reserved for future weighting.)
  const [u] = halton.next();
  return tier[Math.floor(u * tier.length) % tier.length];
}

/**
 * Budget strategy: pick the cell with the highest CI ratio (most uncertain
 * estimate). Skips converged cells and saturated cells; also skips cells
 * that have hit the maxSamples cap.
 *
 * Returns null when every cell is converged, saturated, or capped out.
 */
export function pickBudgetCell(
  grid: GridCell[],
  params: BudgetParams,
  halton: Halton2D,
): GridCell | null {
  const eligible = grid.filter(c => {
    if (c.saturated) return false;
    if (c.stats.n >= params.maxSamples) return false;
    if (c.stats.n >= params.minSamples) {
      const ci = confidenceInterval(c.stats);
      if (ci.ratio <= params.targetCI) return false; // converged
    }
    return true;
  });
  if (eligible.length === 0) return null;
  // Score cells: cells under minSamples get priority by smallest n (so each
  // cell gets a baseline). Above minSamples, prioritize highest CI ratio.
  const underMin = eligible.filter(c => c.stats.n < params.minSamples);
  if (underMin.length > 0) {
    const minN = Math.min(...underMin.map(c => c.stats.n));
    const tier = underMin.filter(c => c.stats.n === minN);
    const [u] = halton.next();
    return tier[Math.floor(u * tier.length) % tier.length];
  }
  // All cells have at least minSamples. Pick highest CI ratio with Halton
  // tie-break (prevents two equally-uncertain cells from forming a cycle).
  const scored = eligible.map(c => ({ c, ratio: confidenceInterval(c.stats).ratio }));
  const maxRatio = Math.max(...scored.map(s => s.ratio));
  const tier = scored.filter(s => Math.abs(s.ratio - maxRatio) < 1e-9).map(s => s.c);
  const [u] = halton.next();
  return tier[Math.floor(u * tier.length) % tier.length];
}

// ── Convergence check (for "sweep complete" detection) ──────────────────────

export function isSpreadComplete(grid: GridCell[], params: SpreadParams): boolean {
  return grid.every(c => c.saturated || c.stats.n >= params.samplesPerCell);
}

export function isBudgetComplete(grid: GridCell[], params: BudgetParams): boolean {
  return grid.every(c => {
    if (c.saturated) return true;
    if (c.stats.n >= params.maxSamples) return true;
    if (c.stats.n >= params.minSamples) {
      return confidenceInterval(c.stats).ratio <= params.targetCI;
    }
    return false;
  });
}

// ── Pair-level stratified bootstrap (for the rankings table) ────────────────
// Quick-and-dirty bootstrap confidence on whether algo A beats algo B at
// a given (dtype, n). Returns the probability that mean(A) < mean(B)
// under the resampling distribution.
//
// Use case: in the rankings table, when two adjacent rows have means within
// a stdev of each other, we run this to ask "are they statistically tied?"
// Result drives a "≈" tie marker between the rows.

export function bootstrapBeats(
  samplesA: number[],
  samplesB: number[],
  iterations = 1000,
): number {
  if (samplesA.length === 0 || samplesB.length === 0) return 0.5;
  let aWins = 0;
  const nA = samplesA.length, nB = samplesB.length;
  for (let i = 0; i < iterations; i++) {
    let sumA = 0, sumB = 0;
    for (let j = 0; j < nA; j++) sumA += samplesA[(Math.random() * nA) | 0];
    for (let j = 0; j < nB; j++) sumB += samplesB[(Math.random() * nB) | 0];
    if (sumA / nA < sumB / nB) aWins++;
  }
  return aWins / iterations;
}
