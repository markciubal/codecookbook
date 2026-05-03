/* eslint-disable no-restricted-globals */
/// <reference lib="webworker" />

import {
  SORT_FNS, generateBenchmarkInput, makeQuickSort, makeShellSort, makeLogosSort,
  makeAdversarialInput, DEFAULT_LOGOS_PARAMS,
  type BenchmarkScenario, type QuickPivot, type ShellGaps, type LogosParams, type CustomDistribution,
} from "./benchmark";

export interface WorkerRequest {
  runId: string;
  algoId: string;
  n: number;
  /** Pre-generated input arrays (one per post-warmup round) */
  inputs: number[][];
  warmup: number;
  quickPivot?: QuickPivot;
  shellGaps?: ShellGaps;
  logosParams?: LogosParams;
  adversarialInput?: number[];
  /** Serialised custom sort function string, e.g. "(arr) => { arr.sort((a,b)=>a-b); }" */
  customFnStr?: string;
}

export interface WorkerResponse {
  runId: string;
  algoId: string;
  n: number;
  timeMs: number;
  meanMs: number;
  stdDev: number;
  roundTimes?: number[];
  timedOut: boolean;
  error?: string;
}

(self as DedicatedWorkerGlobalScope).onmessage = (e: MessageEvent<WorkerRequest>) => {
  const { runId, algoId, n, inputs, warmup, quickPivot, shellGaps, logosParams, adversarialInput, customFnStr } = e.data;

  let fn: ((arr: number[]) => number[] | void) | null = null;

  if (customFnStr) {
    try {
      fn = new Function("return (" + customFnStr + ")")() as (arr: number[]) => void;
    } catch (err) {
      (self as DedicatedWorkerGlobalScope).postMessage({
        runId, algoId, n, timeMs: 0, meanMs: 0, stdDev: 0, timedOut: false,
        error: String(err),
      } satisfies WorkerResponse);
      return;
    }
  } else if (algoId === "quick" && quickPivot) {
    fn = makeQuickSort(quickPivot);
  } else if (algoId === "shell" && shellGaps) {
    fn = makeShellSort(shellGaps);
  } else if (logosParams) {
    fn = makeLogosSort(logosParams);
  } else {
    fn = SORT_FNS[algoId] ?? null;
  }

  if (!fn) {
    (self as DedicatedWorkerGlobalScope).postMessage({
      runId, algoId, n, timeMs: 0, meanMs: 0, stdDev: 0, timedOut: false, error: "Unknown algo",
    } satisfies WorkerResponse);
    return;
  }

  const safeFn = fn;
  const allInputs = adversarialInput ? [...inputs, adversarialInput] : inputs;
  const totalRounds = allInputs.length;
  const TIMEOUT_MS = 10_000;
  const start = performance.now();
  const postWarmupTimes: number[] = [];
  let best = Infinity;
  let didTimeout = false;
  let lastElapsed = 0;

  for (let r = 0; r < totalRounds; r++) {
    if (performance.now() - start > TIMEOUT_MS) { didTimeout = true; break; }
    const copy = allInputs[r].slice();
    const t0 = performance.now();
    safeFn(copy);
    lastElapsed = performance.now() - t0;
    if (lastElapsed >= TIMEOUT_MS) { didTimeout = true; best = lastElapsed; break; }
    if (r >= warmup) {
      best = Math.min(best, lastElapsed);
      postWarmupTimes.push(lastElapsed);
    }
  }

  if (best === Infinity && !didTimeout) { best = lastElapsed; postWarmupTimes.push(lastElapsed); }

  let meanMs = 0, stdDev = 0;
  if (postWarmupTimes.length > 0) {
    meanMs = postWarmupTimes.reduce((s, v) => s + v, 0) / postWarmupTimes.length;
    if (postWarmupTimes.length > 1) {
      const variance = postWarmupTimes.reduce((s, v) => s + (v - meanMs) ** 2, 0) / postWarmupTimes.length;
      stdDev = Math.sqrt(variance);
    }
  }

  (self as DedicatedWorkerGlobalScope).postMessage({
    runId, algoId, n,
    timeMs: best === Infinity ? (postWarmupTimes[0] ?? 0) : best,
    meanMs, stdDev,
    roundTimes: postWarmupTimes.length > 1 ? postWarmupTimes : undefined,
    timedOut: didTimeout,
  } satisfies WorkerResponse);
};

export {};
