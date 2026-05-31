/**
 * Normalized benchmark store — single source of truth.
 *
 * Every measurement is one row in `runs[]`. Session curves, leaderboards,
 * ghost history, and the live chart are derived via selectors (no duplicate
 * reducers).
 */
import type { DataType } from "./benchmark";
import { computeTimeStats, pickStat, type StatMode, type TimeStats } from "./benchmark-stats";

export type { StatMode, TimeStats };

/** One timed probe or benchmark round. */
export type BenchmarkSample = {
  ts: number;
  dt: DataType;
  algo: string;
  n: number;
  timeMs: number;
  spaceBytes: number;
  timedOut?: boolean;
};

export type SessionPoint = TimeStats & {
  meanSpaceBytes: number;
  /** Rolling mean time (always the arithmetic mean across samples). */
  meanTimeMs: number;
};

/** dataType → algoId → n(string) → aggregated stats */
export type SessionLog = Record<string, Record<string, Record<string, SessionPoint>>>;

export type CurvePoint = {
  n: number;
  timeMs: number;
  meanMs?: number;
  medianMs?: number;
  minMs?: number;
  p95Ms?: number;
  stdDev?: number;
  noiseCv?: number;
  roundTimes?: number[];
  spaceBytes?: number;
  heapDeltaBytes?: number;
  allocBytes?: number;
  timedOut?: boolean;
};

export type CurveData = Record<string, CurvePoint[]>;

export type GhostPoint = { n: number; timeMs: number; meanMs?: number; spaceBytes?: number };
export type GhostRun = { ts: number; points: GhostPoint[] };
export type GhostRuns = Record<string, GhostRun[]>;

export const GHOST_MAX = 100;
export const RUNS_STORAGE_KEY = "codecookbook.runs";
export const SESSION_DATA_FORMAT_V2 = "codecookbook-session-v2";
export const SESSION_DATA_FORMAT_V1 = "codecookbook-session-v1";

type Bucket = { dt: string; algo: string; n: number; times: number[]; spaces: number[]; timedOut: boolean };

function bucketKey(dt: string, algo: string, n: number): string {
  return `${dt}\0${algo}\0${n}`;
}

function gatherBuckets(samples: BenchmarkSample[]): Map<string, Bucket> {
  const buckets = new Map<string, Bucket>();
  for (const s of samples) {
    if (s.timedOut || s.timeMs <= 0) continue;
    const key = bucketKey(s.dt, s.algo, s.n);
    let b = buckets.get(key);
    if (!b) {
      b = { dt: s.dt, algo: s.algo, n: s.n, times: [], spaces: [], timedOut: false };
      buckets.set(key, b);
    }
    b.times.push(s.timeMs);
    b.spaces.push(s.spaceBytes);
  }
  return buckets;
}

function bucketToSessionPoint(b: Bucket): SessionPoint {
  const timeStats = computeTimeStats(b.times);
  const meanSpaceBytes = b.spaces.length > 0
    ? b.spaces.reduce((s, v) => s + v, 0) / b.spaces.length
    : 0;
  return {
    ...timeStats,
    meanTimeMs: timeStats.meanMs,
    meanSpaceBytes,
  };
}

function bucketToCurvePoint(b: Bucket, statMode: StatMode): CurvePoint {
  const stats = computeTimeStats(b.times);
  const spaceBytes = b.spaces.length > 0 ? Math.max(...b.spaces) : 0;
  return {
    n: b.n,
    timeMs: pickStat(stats, statMode),
    meanMs: stats.meanMs,
    medianMs: stats.medianMs,
    minMs: stats.minMs,
    p95Ms: stats.p95Ms,
    stdDev: stats.stdDevMs,
    noiseCv: stats.noiseCv,
    roundTimes: stats.roundTimes,
    spaceBytes,
    allocBytes: spaceBytes,
    timedOut: b.timedOut || undefined,
  };
}

/** Session-wide aggregates — all samples, all runs. */
export function selectSessionLog(samples: BenchmarkSample[]): SessionLog {
  const log: SessionLog = {};
  for (const b of gatherBuckets(samples).values()) {
    if (!log[b.dt]) log[b.dt] = {};
    if (!log[b.dt][b.algo]) log[b.dt][b.algo] = {};
    log[b.dt][b.algo][String(b.n)] = bucketToSessionPoint(b);
  }
  return log;
}

/** Per-algo curves for one run timestamp (live chart) or latest run when ts omitted. */
export function selectCurveData(
  samples: BenchmarkSample[],
  runTs: number | null,
  statMode: StatMode,
): CurveData {
  let pool = samples.filter(s => !s.timedOut && s.timeMs > 0);
  if (runTs != null) pool = pool.filter(s => s.ts === runTs);
  else if (pool.length > 0) {
    const latestTs = Math.max(...pool.map(s => s.ts));
    pool = pool.filter(s => s.ts === latestTs);
  }

  const byAlgo = new Map<string, Map<number, Bucket>>();
  for (const s of pool) {
    if (!byAlgo.has(s.algo)) byAlgo.set(s.algo, new Map());
    const byN = byAlgo.get(s.algo)!;
    let b = byN.get(s.n);
    if (!b) {
      b = { dt: s.dt, algo: s.algo, n: s.n, times: [], spaces: [], timedOut: false };
      byN.set(s.n, b);
    }
    b.times.push(s.timeMs);
    b.spaces.push(s.spaceBytes);
  }

  const out: CurveData = {};
  for (const [algo, byN] of byAlgo) {
    out[algo] = [...byN.values()]
      .map(b => bucketToCurvePoint(b, statMode))
      .sort((a, b) => a.n - b.n);
  }
  return out;
}

/** Historical run polylines — one entry per (algo, ts) batch. */
export function selectGhostRuns(samples: BenchmarkSample[], maxRuns = GHOST_MAX): GhostRuns {
  const byAlgoTs = new Map<string, Map<number, Map<number, { timeMs: number; spaceBytes: number }>>>();
  for (const s of samples) {
    if (s.timedOut || s.timeMs <= 0) continue;
    if (!byAlgoTs.has(s.algo)) byAlgoTs.set(s.algo, new Map());
    const byTs = byAlgoTs.get(s.algo)!;
    if (!byTs.has(s.ts)) byTs.set(s.ts, new Map());
    const byN = byTs.get(s.ts)!;
    const prev = byN.get(s.n);
    if (!prev || s.timeMs < prev.timeMs) {
      byN.set(s.n, { timeMs: s.timeMs, spaceBytes: s.spaceBytes });
    }
  }

  const out: GhostRuns = {};
  for (const [algo, byTs] of byAlgoTs) {
    const runs: GhostRun[] = [];
    for (const [ts, byN] of byTs) {
      const points: GhostPoint[] = [...byN.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([n, p]) => ({ n, timeMs: p.timeMs, spaceBytes: p.spaceBytes }));
      if (points.length > 0) runs.push({ ts, points });
    }
    runs.sort((a, b) => a.ts - b.ts);
    out[algo] = runs.length > maxRuns ? runs.slice(-maxRuns) : runs;
  }
  return out;
}

/** Expand a completed (algo, n) measurement into per-round samples. */
export function samplesFromMeasurement(
  ts: number,
  dt: DataType,
  algo: string,
  n: number,
  opts: {
    roundTimes: number[];
    bestMs: number;
    spaceBytes: number;
    timedOut?: boolean;
  },
): BenchmarkSample[] {
  if (opts.timedOut) {
    return [{ ts, dt, algo, n, timeMs: opts.bestMs, spaceBytes: opts.spaceBytes, timedOut: true }];
  }
  const times = opts.roundTimes.length > 0 ? opts.roundTimes : [opts.bestMs];
  return times.map((timeMs, i) => ({
    ts,
    dt,
    algo,
    n,
    timeMs,
    spaceBytes: i === times.length - 1 ? opts.spaceBytes : 0,
  }));
}

export function appendSamples(prev: BenchmarkSample[], next: BenchmarkSample[]): BenchmarkSample[] {
  if (next.length === 0) return prev;
  return [...prev, ...next];
}

/** v1 export → normalized samples (lossy: session means replicated `runs` times). */
export function migrateV1ToSamples(data: {
  sessionLog?: SessionLog;
  ghostRuns?: GhostRuns;
}): BenchmarkSample[] {
  const samples: BenchmarkSample[] = [];
  const log = data.sessionLog ?? {};
  for (const dt of Object.keys(log)) {
    for (const algo of Object.keys(log[dt] ?? {})) {
      for (const nStr of Object.keys(log[dt]![algo] ?? {})) {
        const pt = log[dt]![algo]![nStr];
        if (!pt) continue;
        const n = Number(nStr);
        const count = Math.max(1, pt.runs ?? 1);
        for (let i = 0; i < count; i++) {
          samples.push({
            ts: 0,
            dt: dt as DataType,
            algo,
            n,
            timeMs: pt.meanTimeMs,
            spaceBytes: pt.meanSpaceBytes,
          });
        }
      }
    }
  }
  if (samples.length > 0) return samples;

  const ghosts = data.ghostRuns ?? {};
  for (const algo of Object.keys(ghosts)) {
    for (const run of ghosts[algo] ?? []) {
      for (const p of run.points) {
        samples.push({
          ts: run.ts,
          dt: "integer",
          algo,
          n: p.n,
          timeMs: p.meanMs ?? p.timeMs,
          spaceBytes: p.spaceBytes ?? 0,
        });
      }
    }
  }
  return samples;
}

export interface ExportedSessionV2 {
  format: typeof SESSION_DATA_FORMAT_V2;
  exportedAt: string;
  runs: BenchmarkSample[];
  runCount?: number;
  sessionStartedAt?: number | null;
}

export function buildSessionExportJson(
  runs: BenchmarkSample[],
  runCount: number,
  sessionStartedAt: number | null,
): string {
  const payload: ExportedSessionV2 = {
    format: SESSION_DATA_FORMAT_V2,
    exportedAt: new Date().toISOString(),
    runs,
    runCount,
    sessionStartedAt,
  };
  return JSON.stringify(payload, null, 2);
}

export function buildSessionCsv(sessionLog: SessionLog): string {
  const rows: string[] = [
    "dataType,algo,n,meanTimeMs,medianTimeMs,minTimeMs,p95TimeMs,stdDevTimeMs,noiseCv,meanSpaceBytes,runs",
  ];
  for (const dt of Object.keys(sessionLog).sort()) {
    for (const algo of Object.keys(sessionLog[dt] ?? {}).sort()) {
      const byN = sessionLog[dt]![algo] ?? {};
      const numericNs = Object.keys(byN).map(Number).filter(Number.isFinite).sort((a, b) => a - b);
      for (const n of numericNs) {
        const pt = byN[String(n)];
        if (!pt) continue;
        rows.push(
          `${dt},${algo},${n},${pt.meanTimeMs},${pt.medianMs},${pt.minMs},${pt.p95Ms},${pt.stdDevMs},${pt.noiseCv},${pt.meanSpaceBytes},${pt.runs}`,
        );
      }
    }
  }
  return rows.join("\n") + "\n";
}

export function parseSessionImport(text: string): {
  ok: true;
  runs: BenchmarkSample[];
  runCount?: number;
  sessionStartedAt?: number | null;
} | { ok: false; error: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    return { ok: false, error: `Not valid JSON (${e instanceof Error ? e.message : "parse error"})` };
  }
  if (typeof parsed !== "object" || parsed == null) {
    return { ok: false, error: "Expected a JSON object at the top level" };
  }
  const obj = parsed as Record<string, unknown>;
  if (obj.format === SESSION_DATA_FORMAT_V2) {
    if (!Array.isArray(obj.runs)) return { ok: false, error: "Missing runs array" };
    return {
      ok: true,
      runs: obj.runs as BenchmarkSample[],
      runCount: typeof obj.runCount === "number" ? obj.runCount : undefined,
      sessionStartedAt: typeof obj.sessionStartedAt === "number" ? obj.sessionStartedAt : null,
    };
  }
  if (obj.format === SESSION_DATA_FORMAT_V1) {
    return {
      ok: true,
      runs: migrateV1ToSamples({
        sessionLog: obj.sessionLog as SessionLog,
        ghostRuns: obj.ghostRuns as GhostRuns,
      }),
    };
  }
  return { ok: false, error: `Unknown format "${String(obj.format)}"` };
}

export function loadRunsFromStorage(): BenchmarkSample[] {
  try {
    const raw = localStorage.getItem(RUNS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as BenchmarkSample[];
      if (Array.isArray(parsed)) return parsed;
    }
  } catch { /* corrupt */ }

  try {
    const sessionRaw = localStorage.getItem("codecookbook.sessionLog");
    const ghostRaw = localStorage.getItem("codecookbook.ghostRuns");
    if (sessionRaw || ghostRaw) {
      return migrateV1ToSamples({
        sessionLog: sessionRaw ? JSON.parse(sessionRaw) : undefined,
        ghostRuns: ghostRaw ? JSON.parse(ghostRaw) : undefined,
      });
    }
  } catch { /* corrupt */ }
  return [];
}

export function persistRuns(runs: BenchmarkSample[]): void {
  try {
    localStorage.setItem(RUNS_STORAGE_KEY, JSON.stringify(runs));
  } catch { /* quota */ }
}
