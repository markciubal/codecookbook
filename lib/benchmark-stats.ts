/** Statistical helpers for benchmark aggregation (time samples in ms). */

export type StatMode = "min" | "median" | "mean";

export interface TimeStats {
  minMs: number;
  medianMs: number;
  meanMs: number;
  p95Ms: number;
  stdDevMs: number;
  /** Coefficient of variation (stdDev / mean). Used for the noise badge. */
  noiseCv: number;
  runs: number;
  /** Raw samples when more than one measurement exists. */
  roundTimes?: number[];
}

export function median(sortedAsc: number[]): number {
  if (sortedAsc.length === 0) return 0;
  const mid = Math.floor(sortedAsc.length / 2);
  return sortedAsc.length % 2 === 0
    ? (sortedAsc[mid - 1] + sortedAsc[mid]) / 2
    : sortedAsc[mid];
}

export function percentile(sortedAsc: number[], p: number): number {
  if (sortedAsc.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sortedAsc.length) - 1;
  return sortedAsc[Math.max(0, Math.min(idx, sortedAsc.length - 1))];
}

export function computeTimeStats(times: number[]): TimeStats {
  if (times.length === 0) {
    return { minMs: 0, medianMs: 0, meanMs: 0, p95Ms: 0, stdDevMs: 0, noiseCv: 0, runs: 0 };
  }
  const sorted = [...times].sort((a, b) => a - b);
  const meanMs = times.reduce((s, v) => s + v, 0) / times.length;
  const stdDevMs = times.length < 2
    ? 0
    : Math.sqrt(times.reduce((s, v) => s + (v - meanMs) ** 2, 0) / times.length);
  return {
    minMs: sorted[0],
    medianMs: median(sorted),
    meanMs,
    p95Ms: percentile(sorted, 95),
    stdDevMs,
    noiseCv: meanMs > 0 ? stdDevMs / meanMs : 0,
    runs: times.length,
    roundTimes: times.length > 1 ? [...times] : undefined,
  };
}

/** Pick the primary displayed timing from precomputed stats. */
export function pickStat(stats: TimeStats, mode: StatMode): number {
  switch (mode) {
    case "min": return stats.minMs;
    case "median": return stats.medianMs;
    case "mean": return stats.meanMs;
  }
}

/** Human label for noise CV thresholds. */
export function noiseLabel(cv: number): { label: string; color: string } {
  if (cv <= 0.02) return { label: "low noise", color: "#66bb6a" };
  if (cv <= 0.08) return { label: "moderate", color: "#ffb74d" };
  return { label: "noisy", color: "#ef5350" };
}
