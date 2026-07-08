/**
 * Four-dimensional session store: dataType → scenario → algo → n → stats.
 * Powers the Command Center; legacy SessionLog (3-level) remains for older panels.
 */
import type { DataType, BenchmarkScenario } from "./benchmark";
import type { SessionLog, SessionPoint } from "./benchmark-store";

export type DetailedSessionLog = Record<
  string,
  Record<string, Record<string, Record<string, SessionPoint>>>
>;

export const SCENARIO_MIXED = "mixed";
export const SCENARIO_LEGACY = "legacy";

export const SCENARIO_LABELS: Record<string, string> = {
  [SCENARIO_MIXED]: "Mixed scenarios",
  [SCENARIO_LEGACY]: "Legacy (pre-scenario)",
  random: "Random",
  nearlySorted: "Nearly sorted",
  reversed: "Reversed",
  duplicates: "Duplicates",
  sorted: "Sorted",
  sawtooth: "Sawtooth",
  organPipe: "Organ pipe",
  zipfian: "Zipfian",
  dictionary: "Dictionary",
  timestamps: "Timestamps",
  adversarial: "Adversarial",
};

/** Human label for permutation-run / detailed-log scenario ids (includes polymorphic: prefix). */
export function scenarioLabel(id: string): string {
  if (id.startsWith("polymorphic:")) {
    return `Poly · ${SCENARIO_LABELS[id.slice("polymorphic:".length)] ?? id.slice("polymorphic:".length)}`;
  }
  return SCENARIO_LABELS[id] ?? id;
}

export function emptyDetailedLog(): DetailedSessionLog {
  return {};
}

function defaultPoint(): SessionPoint {
  return {
    meanTimeMs: 0,
    meanSpaceBytes: 0,
    meanMs: 0,
    minMs: 0,
    medianMs: 0,
    p95Ms: 0,
    stdDevMs: 0,
    noiseCv: 0,
    runs: 0,
  };
}

/** Rolling mean merge for one (dt, scenario, algo, n) cell. */
export function mergeSessionPoint(
  existing: SessionPoint | undefined,
  timeMs: number,
  spaceBytes: number,
): SessionPoint {
  const prev = existing ?? defaultPoint();
  const runs = prev.runs + 1;
  const meanTimeMs = (prev.meanTimeMs * prev.runs + timeMs) / runs;
  const meanSpaceBytes = (prev.meanSpaceBytes * prev.runs + spaceBytes) / runs;
  return {
    ...prev,
    runs,
    meanTimeMs,
    meanMs: meanTimeMs,
    meanSpaceBytes,
    minMs: prev.runs === 0 ? timeMs : Math.min(prev.minMs, timeMs),
    medianMs: meanTimeMs,
    p95Ms: Math.max(prev.p95Ms, timeMs),
  };
}

export function appendDetailedSample(
  prev: DetailedSessionLog,
  sample: {
    dt: DataType;
    scenario: string;
    algo: string;
    n: number;
    timeMs: number;
    spaceBytes: number;
  },
): DetailedSessionLog {
  if (sample.timeMs <= 0) return prev;
  const next: DetailedSessionLog = { ...prev };
  const dtMap = { ...(next[sample.dt] ?? {}) };
  const scMap = { ...(dtMap[sample.scenario] ?? {}) };
  const algoMap = { ...(scMap[sample.algo] ?? {}) };
  const key = String(sample.n);
  algoMap[key] = mergeSessionPoint(algoMap[key], sample.timeMs, sample.spaceBytes);
  scMap[sample.algo] = algoMap;
  dtMap[sample.scenario] = scMap;
  next[sample.dt] = dtMap;
  return next;
}

export function appendDetailedSamples(
  prev: DetailedSessionLog,
  samples: Array<{
    dt: DataType;
    scenario: string;
    algo: string;
    n: number;
    timeMs: number;
    spaceBytes: number;
  }>,
): DetailedSessionLog {
  let log = prev;
  for (const s of samples) log = appendDetailedSample(log, s);
  return log;
}

/** Migrate flat 3-level sessionLog → detailed with legacy scenario bucket. */
export function migrateFlatSessionLog(flat: SessionLog): DetailedSessionLog {
  const out: DetailedSessionLog = {};
  for (const dt of Object.keys(flat)) {
    for (const algo of Object.keys(flat[dt] ?? {})) {
      for (const nStr of Object.keys(flat[dt]![algo] ?? {})) {
        const pt = flat[dt]![algo]![nStr];
        if (!pt) continue;
        if (!out[dt]) out[dt] = {};
        if (!out[dt][SCENARIO_LEGACY]) out[dt][SCENARIO_LEGACY] = {};
        if (!out[dt][SCENARIO_LEGACY][algo]) out[dt][SCENARIO_LEGACY][algo] = {};
        out[dt][SCENARIO_LEGACY][algo][nStr] = pt;
      }
    }
  }
  return out;
}

export function resolveScenarioForRun(scenarios: BenchmarkScenario[]): string {
  if (scenarios.length === 1) return scenarios[0];
  return SCENARIO_MIXED;
}

export const DETAILED_SESSION_STORAGE_KEY = "codecookbook.detailedSessionLog";

export function loadDetailedSessionLog(flatFallback?: SessionLog): DetailedSessionLog {
  try {
    const raw = localStorage.getItem(DETAILED_SESSION_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DetailedSessionLog;
      if (parsed && typeof parsed === "object") return parsed;
    }
  } catch { /* corrupt */ }
  if (flatFallback && Object.keys(flatFallback).length > 0) {
    return migrateFlatSessionLog(flatFallback);
  }
  return emptyDetailedLog();
}

export function persistDetailedSessionLog(log: DetailedSessionLog): void {
  try {
    localStorage.setItem(DETAILED_SESSION_STORAGE_KEY, JSON.stringify(log));
  } catch { /* quota */ }
}
