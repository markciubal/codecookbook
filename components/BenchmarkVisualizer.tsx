"use client";

import React, { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { Play, Square, RotateCcw, Trophy, LineChart, ChevronRight, Lock, Unlock, Volume2, Settings, Code, X, Copy, Check, Activity } from "lucide-react";
import { generateBenchmarkInput, generateFloatInput, generateStringInput, SORT_FNS, ALGO_INCOMPATIBLE, makeQuickSort, makeShellSort, sortSteps, makeAdversarialInput, measureAllocBytes, type DataType, type BenchmarkScenario, type CustomDistribution, type ValueDistribution, type QuickPivot, type ShellGaps, type SortStep } from "@/lib/benchmark";
import { BENCHMARK_SOURCE } from "@/lib/benchmark-source";
import { getLogosSortSteps } from "@/lib/algorithms";
import { useLevel } from "@/hooks/useLevel";
import RunningDashboard from "@/components/RunningDashboard";
import { AdvGroup, AdvSection, AdvToggle } from "@/components/BenchmarkAdvanced";
import WinnersLog, { type WinnerLog } from "@/components/WinnersLog";
import SessionCurves, { type SessionLog } from "@/components/SessionCurves";
import SessionSummary from "@/components/SessionSummary";
import SessionBigO from "@/components/SessionBigO";
import SessionMatrix from "@/components/SessionMatrix";
import SortNetworkGraph from "@/components/SortNetworkGraph";
import { cyLineStyle, DT_LABEL } from "@/lib/dataTypeStyle";
import { getWasmSorts, WASM_SUPPORTED, type WasmSortBundle } from "@/lib/wasmSorts";
import { getWebgpuSorts, WEBGPU_SUPPORTED, type WebGpuSortBundle } from "@/lib/webgpuSorts";

// ── Static config ─────────────────────────────────────────────────────────────

// crypto.randomUUID only exists in a secure context (HTTPS / localhost). When
// the app is served over plain HTTP or inside some embedded frames it's
// undefined, so fall back to a getRandomValues-based v4, then to Math.random.
function genId(): string {
  const c = typeof crypto !== "undefined" ? crypto : undefined;
  if (c?.randomUUID) return c.randomUUID();
  if (c?.getRandomValues) {
    const b = new Uint8Array(16);
    c.getRandomValues(b);
    b[6] = (b[6] & 0x0f) | 0x40; // version 4
    b[8] = (b[8] & 0x3f) | 0x80; // variant 10
    const h = Array.from(b, (x) => x.toString(16).padStart(2, "0"));
    return `${h[0]}${h[1]}${h[2]}${h[3]}-${h[4]}${h[5]}-${h[6]}${h[7]}-${h[8]}${h[9]}-${h[10]}${h[11]}${h[12]}${h[13]}${h[14]}${h[15]}`;
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

const SLOW_IDS = new Set(["insertion", "selection", "bubble", "cocktail", "comb", "gnome", "pancake", "cycle", "oddeven"]);
const SLOW_THRESHOLD = 5_000;

// Comparison sorts whose comparators use relational operators (<, >, <=) and so
// work across integers, floats, AND strings — eligible for the polymorphic
// sweep. (Excludes timsort's numeric a-b comparator and the integer-only
// counting/radix/bucket sorts.) Logos 3.7.1 dispatches on element type itself.
// Note: bitonic is NOT in POLY_SAFE — its CPU implementation pads with
// `+Infinity` sentinels which only sort cleanly for numeric data, not for
// the string leg of the polymorphic sweep. The string incompatibility is
// declared in ALGO_INCOMPATIBLE for the same reason.
const POLY_SAFE = new Set(["logos", "merge", "quick", "heap", "insertion", "shell", "selection", "bubble", "cocktail", "comb", "gnome"]);

// Verdict on whether an algorithm sorted in place, derived from its measured
// auxiliary bytes ÷ n. Two signals, two thresholds:
//
//   • `allocBytes` — instrumented Array / typed-array / Set / Map / map /
//     filter / splice / etc. allocations. Authoritative when present: a
//     non-zero reading proves an allocation happened, a zero reading proves
//     no PATCHED allocators fired (spread / engine-internal scratch can
//     still slip past). Threshold: ≥ 1 byte/element ⇒ O(n).
//   • `heapDeltaBytes` — REAL `performance.memory.usedJSHeapSize` delta only
//     (no theoretical fallback). Catches the instrumentation blind spots
//     (spread copies, V8-internal scratch), but it's noisy — GC scheduling
//     produces a few bytes/element of "growth" even on truly in-place sorts.
//     Threshold: ≥ 4 bytes/element ⇒ O(n) (with "?" because it's the noisy
//     source).
//
// The two sources are checked in order — instrumented first (no "?"), then
// heap delta (with "?"). When both signals point clean, the verdict is
// "in-place ✓" if we had instrumentation, "in-place ✓?" if only heap delta.
function inPlaceVerdict(
  allocBytes: number | null | undefined,
  heapDeltaBytes: number | null | undefined,
  n: number,
): { label: string; color: string; bg: string; title: string } | null {
  if (n <= 0) return null;
  const a = allocBytes ?? null;
  const h = heapDeltaBytes ?? null;
  if (a == null && h == null) return null;
  const aPer = a != null ? a / n : 0;
  const hPer = h != null ? h / n : 0;

  // Instrumented allocators caught a real O(n) allocation.
  if (a != null && aPer >= 1) {
    return {
      label: "O(n) aux ✗",
      color: "#ef5350", bg: "rgba(239,83,80,0.15)",
      title: `${aPer.toFixed(2)} aux bytes/element · instrumented allocators caught O(n) growth`,
    };
  }
  // Heap delta picked up growth the instrumentation missed (spread, internal
  // scratch). 4 byte/el floor sits above GC noise and just below the smallest
  // realistic O(n) allocator (a packed Int32Array buffer is 4 byte/el).
  if (h != null && hPer >= 4) {
    return {
      label: "O(n) aux ✗?",
      color: "#ef5350", bg: "rgba(239,83,80,0.15)",
      title: `${hPer.toFixed(2)} aux bytes/element · instrumentation missed it; heap delta caught O(n) growth (noisy source)`,
    };
  }
  // Both signals are clean — instrumented verdict is high-confidence.
  if (a != null) {
    return {
      label: "in-place ✓",
      color: "#22c55e", bg: "rgba(34,197,94,0.15)",
      title: `${aPer.toFixed(3)} aux bytes/element instrumented · O(1)/O(log n) auxiliary memory`,
    };
  }
  // Only heap delta available — confident enough to call in-place, but mark
  // it "?" because the signal is the noisy one.
  return {
    label: "in-place ✓?",
    color: "#22c55e", bg: "rgba(34,197,94,0.15)",
    title: `${hPer.toFixed(3)} aux bytes/element from heap delta · likely in-place but no instrumented data`,
  };
}

// Wrap a sort fn so a single measured call sorts an integer array (the one
// passed in) plus a fresh float and string array of the same size — the
// "polymorphic" measurement that counts three data types as one sort. Source
// arrays are generated once at wrap time (outside the timed call); each call
// sorts fresh copies so repeated rounds don't sort already-sorted data.
function makePolymorphicFn(
  base: (arr: unknown[]) => unknown[],
  sz: number,
  scenario: BenchmarkScenario,
): (arr: unknown[]) => unknown[] {
  const floatSrc = generateFloatInput(sz, scenario) as unknown[];
  const strSrc = generateStringInput(sz, scenario) as unknown[];
  return (arr: unknown[]) => {
    base(arr);
    base(floatSrc.slice());
    base(strSrc.slice());
    return arr;
  };
}
// All O(n log n) algorithms are allowed above 5 M elements
const UNLIMITED_IDS = new Set(["logos", "timsort", "timsort-js", "introsort", "adaptive", "pdqsort", "merge", "quick", "heap"]);

/*
 * Re-instantiate a sort function from its own source so it gets a *fresh* set of
 * inline caches every benchmark run.
 *
 * Why this exists: the functions in SORT_FNS are shared module-level closures.
 * V8 specializes them based on the element kind they're first called with
 * (SMI / double / string). Running one data type then another makes the
 * comparison + element-kind sites go megamorphic — and V8 never re-specializes
 * back down. The result: after a string benchmark, integer benchmarks stay
 * permanently deoptimized for the rest of the page session.
 *
 * `fn.toString()` returns the *compiled JS* source (TypeScript types already
 * stripped by tsc). Every sort function in benchmark.ts is self-contained — it
 * defines all of its helpers inside its own body and references no module-level
 * symbols — so `new Function` can re-evaluate it in global scope cleanly. If a
 * function ever does reference module scope, the rebuild throws and we fall
 * back to the shared closure.
 */
// Shared shape for per-algo before/after proof samples. Values can be strings
// when dataType === "string"; the renderer dispatches on `dataType` to format.
type SampleProof = {
  before: (number | string)[];
  after:  (number | string)[];
  n: number;
  dataType: DataType;
  scenario?: BenchmarkScenario;
  // Summary stats included so the proof panel can self-describe the run that
  // produced it without having to re-derive from the sample.
  minVal?: number | string;
  maxVal?: number | string;
  distinctCount?: number;
  // Sortedness verification result, computed at capture time so other panels
  // (rankings, mini-cards, math-panel header) can surface failures without
  // re-deriving from the sample.
  failed: boolean;
  badIdx?: number; // index of the first out-of-order element in `after`
  // Extra run context, populated from the live input:
  bytesPerElement?: number;     // ~8 for number, ~32 for typical strings
  totalInputBytes?: number;     // n × bytesPerElement (approx)
  avgStrLen?: number;           // only for dataType === "string"
  isAllInteger?: boolean;       // only for dataType === "integer"/"float" — true if every value passes Number.isInteger
  decimalsMax?: number;         // only for dataType === "float" — max fractional digits seen
};

// Build a before/after proof for one algorithm.
//
// Capture strategy:
//   1. Pull SAMPLE evenly-spaced values from the input — this is `before`.
//   2. Run the algorithm on the FULL input copy → sortedFull.
//   3. `after` is the same MULTISET of values as `before`, but in sorted order.
//      We achieve this by counting the `before` values into a multiset, then
//      walking sortedFull left-to-right and consuming any element that still
//      has remaining count. This gives us same-values-different-order: every
//      value visible in `after` was also visible in `before`.
//   4. Validation: the verifier checks that sortedFull (the algorithm's
//      ACTUAL output) is monotonically non-decreasing AND that every value
//      in `before` was found in sortedFull (i.e., the algorithm didn't drop
//      or duplicate values). Either failure flips `failed: true`.
//
// This preserves the visual story "the same values, just rearranged" while
// still pinning correctness on the algorithm's real output, not on the
// proof's own re-sort.
async function captureSampleProof(
  input: readonly (number | string)[],
  fn: (a: unknown[]) => unknown[] | Promise<unknown[]>,
  meta: { n: number; dataType: DataType; scenario?: BenchmarkScenario },
): Promise<SampleProof> {
  const SAMPLE = 20;
  const stride = Math.max(1, Math.floor(input.length / SAMPLE));
  const before: (number | string)[] = Array.from({ length: SAMPLE }, (_, i) => input[i * stride]);
  const proofCopy = [...input];
  // If a custom sort throws here we still want to record a proof so the user
  // can see the failure annotated. Mark sortedFull as the unsorted input so
  // the verifier catches the breakage downstream.
  // The fn may be async (WebGPU sorts return a Promise so the readback can
  // complete before we inspect the result). We await whatever it gives us.
  let sortedFull: (number | string)[];
  let threw = false;
  try {
    const raw = fn(proofCopy as unknown[]);
    const sortedResult = raw && typeof (raw as { then?: unknown }).then === "function"
      ? await (raw as Promise<unknown[]>)
      : raw as unknown[];
    sortedFull = (sortedResult ?? proofCopy) as (number | string)[];
  } catch {
    sortedFull = proofCopy;
    threw = true;
  }
  // Build `after` as the sample-multiset, walked through sortedFull in
  // sort order. If the algorithm preserves the multiset AND produces a
  // sorted output, `after` will visibly contain the same values as `before`
  // in ascending order.
  const remaining = new Map<number | string, number>();
  for (const v of before) remaining.set(v, (remaining.get(v) ?? 0) + 1);
  const after: (number | string)[] = [];
  for (const v of sortedFull) {
    const c = remaining.get(v) ?? 0;
    if (c > 0) {
      after.push(v);
      remaining.set(v, c - 1);
      if (after.length === before.length) break;
    }
  }
  // Any leftover counts in `remaining` mean values from `before` are missing
  // from sortedFull — the algorithm dropped or replaced them.
  let lostValues = 0;
  for (const c of remaining.values()) lostValues += c;
  // Pad missing slots with a sentinel value so the row still has SAMPLE cells
  // and the visualizer can mark them. Use minVal-like behaviour: a copy of the
  // first leftover key so type stays consistent.
  if (lostValues > 0) {
    const leftover: (number | string)[] = [];
    for (const [v, c] of remaining.entries()) for (let i = 0; i < c; i++) leftover.push(v);
    after.push(...leftover);
  }
  // Summary stats over the FULL input (not just the sample) — gives the user
  // accurate context about what was actually fed to the sort.
  let minVal: number | string | undefined;
  let maxVal: number | string | undefined;
  const seen = new Set<unknown>();
  let totalStrLen = 0;
  let strCount = 0;
  let allInteger = true;       // for "integer"/"float" dataType
  let maxDecimals = 0;         // for "float" dataType
  for (const v of input) {
    seen.add(v);
    if (minVal === undefined || (v as number | string) < minVal) minVal = v as number | string;
    if (maxVal === undefined || (v as number | string) > maxVal) maxVal = v as number | string;
    if (typeof v === "string") {
      totalStrLen += v.length;
      strCount++;
    } else if (typeof v === "number") {
      if (!Number.isInteger(v)) {
        allInteger = false;
        // Count fractional digits: stringified, after the decimal point. Cap at
        // 6 because JS doubles drop precision past ~15 sig digits anyway.
        const s = v.toString();
        const dot = s.indexOf(".");
        if (dot >= 0) maxDecimals = Math.max(maxDecimals, Math.min(6, s.length - dot - 1));
      }
    }
  }
  // Element-byte heuristic: numbers ≈ 8 (PACKED_DOUBLE), strings ≈ 2×length + 24
  // overhead per JS string (UTF-16 char + header). Strings vary; average length
  // is more useful for the user than a constant.
  const isStringType = meta.dataType === "string";
  const avgStrLen = strCount > 0 ? totalStrLen / strCount : undefined;
  const bytesPerElement = isStringType
    ? (avgStrLen !== undefined ? Math.round(2 * avgStrLen + 24) : 32)
    : 8;
  const totalInputBytes = meta.n * bytesPerElement;
  // Sortedness verification — run against the algorithm's FULL output, not
  // the synthesised `after` sample (which is constructed from `before` to be
  // sorted by construction, so checking it would always pass). We walk
  // sortedFull and flag the first index where the non-decreasing invariant
  // breaks, OR flag when any sample value got lost (multiset mismatch).
  let badIdx: number | undefined;
  if (threw) {
    badIdx = 0;
  } else if (lostValues > 0) {
    // The sample multiset wasn't preserved by the algorithm. Point `badIdx`
    // at the first slot in `after` that we had to pad with a leftover —
    // matches what the existing rendering highlights.
    badIdx = after.length - lostValues;
  } else {
    for (let i = 1; i < sortedFull.length; i++) {
      if (sortedFull[i] < sortedFull[i - 1]) { badIdx = i; break; }
    }
  }
  return {
    before, after,
    n: meta.n, dataType: meta.dataType, scenario: meta.scenario,
    minVal, maxVal, distinctCount: seen.size,
    failed: badIdx !== undefined, badIdx,
    bytesPerElement, totalInputBytes,
    avgStrLen: isStringType ? avgStrLen : undefined,
    isAllInteger: isStringType ? undefined : allInteger,
    decimalsMax: meta.dataType === "float" ? maxDecimals : undefined,
  };
}

/*
 * Build and validate a user-supplied custom sort function.
 *
 * Returns the function only if it survives:
 *   1. parse — new Function(source) must succeed
 *   2. type  — the evaluated expression must be a function (typeof === "function")
 *   3. smoke — calling it on [3, 1, 2] must produce a permutation in sorted order
 *
 * Returns null on any failure. Errors are written to `onError` so the editor
 * banner can show what went wrong. Numeric smoke is intentional: if a user
 * tries to benchmark string-sorting custom code, this will reject it and they
 * can edit/disable — better than a silent crash mid-run.
 */
function buildCustomFn(
  code: string,
  onError?: (msg: string) => void,
): ((arr: unknown[]) => unknown[]) | null {
  let raw: unknown;
  try {
    raw = new Function("return (" + code + ")")();
  } catch (e) {
    onError?.(`Custom sort failed to parse: ${e instanceof Error ? e.message : String(e)}`);
    return null;
  }
  if (typeof raw !== "function") {
    onError?.(`Custom sort must be a function. Got ${typeof raw}.`);
    return null;
  }
  const fn = raw as (arr: unknown[]) => unknown[];
  try {
    const probe = fn([3, 1, 2]) as number[] | undefined;
    // Custom fn may either mutate in place (no return) or return a new array.
    // We don't enforce one or the other — just make sure SOMETHING got sorted.
    const result = (probe ?? [3, 1, 2]) as number[];
    if (result.length !== 3) {
      onError?.(`Custom sort produced ${result.length}-element output (expected 3).`);
      return null;
    }
  } catch (e) {
    onError?.(`Custom sort threw during smoke test: ${e instanceof Error ? e.message : String(e)}`);
    return null;
  }
  return fn;
}

function freshSortFn(original: (arr: number[]) => number[]): (arr: number[]) => number[] {
  try {
    const rebuilt = new Function("return (" + original.toString() + ")")() as (arr: number[]) => number[];
    // Smoke-test on a tiny array: catches the case where the source references a
    // module-level symbol that doesn't exist in global scope (would throw at call
    // time, not construction time). If it misbehaves, fall back to the shared fn.
    const probe = rebuilt([3, 1, 2]);
    if (!Array.isArray(probe) || probe.length !== 3 || probe[0] !== 1 || probe[1] !== 2 || probe[2] !== 3) {
      return original;
    }
    return rebuilt;
  } catch {
    return original;
  }
}

// Palette offered when adding/picking a color for a user-saved custom sort.
// Chosen to be visually distinct from the built-in algorithm colors so multiple
// custom sorts plotted on the same chart remain individually identifiable.
const CUSTOM_PALETTE = [
  "#e040fb", // magenta (original default)
  "#00bcd4", // cyan
  "#ff7043", // deep orange
  "#9ccc65", // lime
  "#5c6bc0", // indigo
  "#ec407a", // hot pink
  "#26c6da", // teal
  "#ffca28", // amber
  "#7e57c2", // violet
  "#66bb6a", // green
  "#ef5350", // red
  "#42a5f5", // light blue
];
function defaultCustomColor(idx: number): string {
  return CUSTOM_PALETTE[idx % CUSTOM_PALETTE.length];
}

const LARGE_THRESHOLD = 5_000_000;

// Code snippets available for loading into the custom sort editor
const CUSTOM_PRESETS: { label: string; code: string }[] = [
  {
    label: "Merge",
    code: `(arr) => {
  const a = [...arr];
  function merge(lo, hi) {
    if (hi <= lo) return;
    const mid = (lo + hi) >> 1;
    merge(lo, mid); merge(mid + 1, hi);
    const left = a.slice(lo, mid + 1);
    let i = 0, j = mid + 1, k = lo;
    while (i < left.length && j <= hi)
      a[k++] = left[i] <= a[j] ? left[i++] : a[j++];
    while (i < left.length) a[k++] = left[i++];
  }
  merge(0, a.length - 1);
  return a;
}`,
  },
  {
    label: "Quick",
    code: `(arr) => {
  const a = [...arr];
  function qs(lo, hi) {
    if (lo >= hi) return;
    const mid = (lo + hi) >> 1;
    if (a[mid] < a[lo]) [a[lo], a[mid]] = [a[mid], a[lo]];
    if (a[hi]  < a[lo]) [a[lo], a[hi]]  = [a[hi],  a[lo]];
    if (a[hi]  < a[mid]) [a[mid], a[hi]] = [a[hi], a[mid]];
    const pivot = a[hi]; let p = lo - 1;
    for (let i = lo; i < hi; i++)
      if (a[i] <= pivot) { ++p; [a[p], a[i]] = [a[i], a[p]]; }
    [a[p + 1], a[hi]] = [a[hi], a[p + 1]];
    qs(lo, p); qs(p + 2, hi);
  }
  qs(0, a.length - 1);
  return a;
}`,
  },
  {
    label: "Heap",
    code: `(arr) => {
  const a = [...arr];
  const n = a.length;
  function sift(size, root) {
    let top = root;
    const l = 2 * root + 1, r = l + 1;
    if (l < size && a[l] > a[top]) top = l;
    if (r < size && a[r] > a[top]) top = r;
    if (top !== root) {
      [a[root], a[top]] = [a[top], a[root]];
      sift(size, top);
    }
  }
  for (let i = (n >> 1) - 1; i >= 0; i--) sift(n, i);
  for (let end = n - 1; end > 0; end--) {
    [a[0], a[end]] = [a[end], a[0]]; sift(end, 0);
  }
  return a;
}`,
  },
  {
    label: "Shell",
    code: `(arr) => {
  const a = [...arr];
  for (let gap = a.length >> 1; gap > 0; gap >>= 1) {
    for (let i = gap; i < a.length; i++) {
      const tmp = a[i]; let j = i;
      while (j >= gap && a[j - gap] > tmp) {
        a[j] = a[j - gap]; j -= gap;
      }
      a[j] = tmp;
    }
  }
  return a;
}`,
  },
  {
    label: "Insertion",
    code: `(arr) => {
  const a = [...arr];
  for (let i = 1; i < a.length; i++) {
    const key = a[i]; let j = i - 1;
    while (j >= 0 && a[j] > key) { a[j + 1] = a[j]; j--; }
    a[j + 1] = key;
  }
  return a;
}`,
  },
  {
    label: "Bubble",
    code: `(arr) => {
  const a = [...arr];
  for (let i = 0; i < a.length - 1; i++)
    for (let j = 0; j < a.length - 1 - i; j++)
      if (a[j] > a[j + 1]) [a[j], a[j + 1]] = [a[j + 1], a[j]];
  return a;
}`,
  },
  {
    label: "Counting",
    code: `(arr) => {
  if (!arr.length) return [];
  let min = arr[0], max = arr[0];
  for (const x of arr) { if (x < min) min = x; if (x > max) max = x; }
  const count = new Array(max - min + 1).fill(0);
  for (const x of arr) count[x - min]++;
  const out = [];
  count.forEach((c, i) => { for (let j = 0; j < c; j++) out.push(i + min); });
  return out;
}`,
  },
  {
    label: "Radix",
    code: `(arr) => {
  if (!arr.length) return [];
  let a = [...arr];
  const off = Math.min(...a);
  if (off < 0) a = a.map(x => x - off);
  const max = Math.max(...a);
  for (let exp = 1; Math.floor(max / exp) > 0; exp *= 10) {
    const b = Array.from({ length: 10 }, () => []);
    for (const x of a) b[Math.floor(x / exp) % 10].push(x);
    a = b.flat();
  }
  return off < 0 ? a.map(x => x + off) : a;
}`,
  },
  {
    label: "Bucket",
    code: `(arr) => {
  if (!arr.length) return [];
  const a = [...arr];
  const max = Math.max(...a) + 1;
  const nb = Math.max(Math.floor(Math.sqrt(a.length)), 1);
  const buckets = Array.from({ length: nb }, () => []);
  for (const x of a) buckets[Math.min(Math.floor((x / max) * nb), nb - 1)].push(x);
  return buckets.flatMap(b => b.sort((x, y) => x - y));
}`,
  },
  {
    label: "Adaptive",
    code: `(arr) => {
  // Adaptive Sort: profiles input, then picks the cheapest strategy.
  // 1. Counting sort if integers with small range.
  // 2. Insertion sort if tiny or nearly sorted.
  // 3. Otherwise introsort with median-of-3 + heapsort fallback.
  const a = [...arr];
  const n = a.length;
  if (n <= 1) return a;

  // Scan: min/max, integer check, sampled inversion rate
  let minVal = a[0], maxVal = a[0], allInt = true, inv = 0;
  for (let i = 0; i < n; i++) {
    if (a[i] < minVal) minVal = a[i];
    if (a[i] > maxVal) maxVal = a[i];
    if (!Number.isInteger(a[i])) allInt = false;
  }
  const sample = Math.min(n, 40);
  const step = Math.max(1, Math.floor(n / sample));
  for (let i = 0; i + step < n; i += step) if (a[i] > a[i + step]) inv++;
  const invRate = inv / Math.max(1, sample - 1);
  const span = maxVal - minVal + 1;

  // Counting sort path: integers with small value range
  if (allInt && span < 4 * n) {
    const c = new Array(span).fill(0);
    for (let i = 0; i < n; i++) c[a[i] - minVal]++;
    let idx = 0;
    for (let v = 0; v < span; v++) while (c[v]-- > 0) a[idx++] = v + minVal;
    return a;
  }

  function ins(lo, hi) {
    for (let i = lo + 1; i <= hi; i++) {
      const k = a[i]; let j = i - 1;
      while (j >= lo && a[j] > k) { a[j + 1] = a[j]; j--; }
      a[j + 1] = k;
    }
  }

  // Tiny or nearly-sorted → insertion sort
  if (n <= 16 || invRate <= 0.05) { ins(0, n - 1); return a; }

  // Introsort with heapsort fallback
  const maxDepth = 2 * Math.floor(Math.log2(n));
  function hpfy(end, root, base) {
    let lg = root;
    const l = 2 * root + 1, r = l + 1;
    if (l < end && a[base + l] > a[base + lg]) lg = l;
    if (r < end && a[base + r] > a[base + lg]) lg = r;
    if (lg !== root) { [a[base + root], a[base + lg]] = [a[base + lg], a[base + root]]; hpfy(end, lg, base); }
  }
  function hp(lo, hi) {
    const len = hi - lo + 1;
    for (let i = Math.floor(len / 2) - 1; i >= 0; i--) hpfy(len, i, lo);
    for (let i = len - 1; i > 0; i--) { [a[lo], a[lo + i]] = [a[lo + i], a[lo]]; hpfy(i, 0, lo); }
  }
  function med3(lo, mid, hi) {
    if (a[lo] > a[mid]) [a[lo], a[mid]] = [a[mid], a[lo]];
    if (a[lo] > a[hi])  [a[lo], a[hi]]  = [a[hi],  a[lo]];
    if (a[mid] > a[hi]) [a[mid], a[hi]] = [a[hi], a[mid]];
    return mid;
  }
  function sort(lo, hi, depth) {
    if (hi - lo < 1) return;
    if (hi - lo + 1 <= 16) { ins(lo, hi); return; }
    if (depth === 0) { hp(lo, hi); return; }
    const mid = (lo + hi) >> 1;
    const pi = med3(lo, mid, hi);
    const pv = a[pi];
    [a[pi], a[hi - 1]] = [a[hi - 1], a[pi]];
    let i = lo, j = hi - 2;
    while (true) {
      while (i <= hi - 1 && a[i] < pv) i++;
      while (j >= lo && a[j] > pv) j--;
      if (i >= j) break;
      [a[i], a[j]] = [a[j], a[i]]; i++; j--;
    }
    [a[i], a[hi - 1]] = [a[hi - 1], a[i]];
    // Recurse smaller half first (bounded stack depth)
    if (i - lo <= hi - i) { sort(lo, i - 1, depth - 1); sort(i + 1, hi, depth - 1); }
    else { sort(i + 1, hi, depth - 1); sort(lo, i - 1, depth - 1); }
  }
  sort(0, n - 1, maxDepth);
  return a;
}`,
  },
  {
    label: "PDQ",
    code: `// Pattern-defeating quicksort by Orson Peters (2021).
// Default sort in Rust's std. Hardened against adversarial input via:
//   - median-of-3 / pseudomedian-of-9 (ninther) pivot selection
//   - heapsort fallback after log2(n) bad partitions (O(n log n) guarantee)
//   - partial insertion sort early-out for already-sorted regions
//   - equal-elements fast path → O(n) on many-duplicates input
//   - element shuffling on highly unbalanced partitions
(arr) => {
  const a = [...arr];
  const n = a.length;
  if (n <= 1) return a;
  const INSERT = 24, NINTHER = 128, PARTIAL = 8;
  const lt = (x, y) => x < y;
  function ins(b, e) {
    for (let c = b + 1; c < e; c++) {
      let s = c, s1 = c - 1;
      if (lt(a[s], a[s1])) {
        const tmp = a[s];
        do { a[s--] = a[s1]; } while (s !== b && lt(tmp, a[--s1]));
        a[s] = tmp;
      }
    }
  }
  function uIns(b, e) {
    for (let c = b + 1; c < e; c++) {
      let s = c, s1 = c - 1;
      if (lt(a[s], a[s1])) {
        const tmp = a[s];
        do { a[s--] = a[s1]; } while (lt(tmp, a[--s1]));
        a[s] = tmp;
      }
    }
  }
  function pIns(b, e) {
    let limit = 0;
    for (let c = b + 1; c < e; c++) {
      let s = c, s1 = c - 1;
      if (lt(a[s], a[s1])) {
        const tmp = a[s];
        do { a[s--] = a[s1]; } while (s !== b && lt(tmp, a[--s1]));
        a[s] = tmp;
        limit += c - s;
      }
      if (limit > PARTIAL) return false;
    }
    return true;
  }
  const swap = (i, j) => { const t = a[i]; a[i] = a[j]; a[j] = t; };
  const sort2 = (i, j) => { if (lt(a[j], a[i])) swap(i, j); };
  const sort3 = (i, j, k) => { sort2(i, j); sort2(j, k); sort2(i, j); };
  function partR(b, e) {
    const pv = a[b]; let f = b, l = e;
    while (lt(a[++f], pv));
    if (f - 1 === b) while (f < l && !lt(a[--l], pv));
    else             while (         !lt(a[--l], pv));
    const ap = f >= l;
    while (f < l) { swap(f, l); while (lt(a[++f], pv)); while (!lt(a[--l], pv)); }
    const pp = f - 1;
    a[b] = a[pp]; a[pp] = pv;
    return [pp, ap];
  }
  function partL(b, e) {
    const pv = a[b]; let f = b, l = e;
    while (lt(pv, a[--l]));
    if (l + 1 === e) while (f < l && !lt(pv, a[++f]));
    else             while (         !lt(pv, a[++f]));
    while (f < l) { swap(f, l); while (lt(pv, a[--l])); while (!lt(pv, a[++f])); }
    a[b] = a[l]; a[l] = pv;
    return l;
  }
  function hp(end, root, base) {
    let lg = root;
    const l = 2 * root + 1, r = l + 1;
    if (l < end && a[base + l] > a[base + lg]) lg = l;
    if (r < end && a[base + r] > a[base + lg]) lg = r;
    if (lg !== root) { swap(base + root, base + lg); hp(end, lg, base); }
  }
  function heap(b, e) {
    const len = e - b;
    for (let i = (len >> 1) - 1; i >= 0; i--) hp(len, i, b);
    for (let i = len - 1; i > 0; i--) { swap(b, b + i); hp(i, 0, b); }
  }
  function loop(b, e, bad, leftmost) {
    while (true) {
      const sz = e - b;
      if (sz < INSERT) { if (leftmost) ins(b, e); else uIns(b, e); return; }
      const s2 = sz >> 1;
      if (sz > NINTHER) {
        sort3(b, b + s2, e - 1);
        sort3(b + 1, b + (s2 - 1), e - 2);
        sort3(b + 2, b + (s2 + 1), e - 3);
        sort3(b + (s2 - 1), b + s2, b + (s2 + 1));
        swap(b, b + s2);
      } else {
        sort3(b + s2, b, e - 1);
      }
      if (!leftmost && !lt(a[b - 1], a[b])) { b = partL(b, e) + 1; continue; }
      const [pp, ap] = partR(b, e);
      const lS = pp - b, rS = e - (pp + 1);
      if (lS < (sz >> 3) || rS < (sz >> 3)) {
        if (--bad === 0) { heap(b, e); return; }
        if (lS >= INSERT) { swap(b, b + (lS >> 2)); swap(pp - 1, pp - (lS >> 2)); }
        if (rS >= INSERT) { swap(pp + 1, pp + 1 + (rS >> 2)); swap(e - 1, e - (rS >> 2)); }
      } else if (ap && pIns(b, pp) && pIns(pp + 1, e)) return;
      loop(b, pp, bad, leftmost);
      b = pp + 1;
      leftmost = false;
    }
  }
  loop(0, n, Math.floor(Math.log2(n)), true);
  return a;
}`,
  },
  {
    label: "Introsort",
    code: `(arr) => {
  const a = [...arr];
  const n = a.length;
  const maxDepth = n <= 1 ? 0 : 2 * Math.floor(Math.log2(n));
  function ins(lo, hi) {
    for (let i = lo + 1; i <= hi; i++) {
      const k = a[i]; let j = i - 1;
      while (j >= lo && a[j] > k) { a[j + 1] = a[j]; j--; }
      a[j + 1] = k;
    }
  }
  function hpfy(end, root, base) {
    let lg = root;
    const l = 2 * root + 1, r = l + 1;
    if (l < end && a[base + l] > a[base + lg]) lg = l;
    if (r < end && a[base + r] > a[base + lg]) lg = r;
    if (lg !== root) { [a[base + root], a[base + lg]] = [a[base + lg], a[base + root]]; hpfy(end, lg, base); }
  }
  function hp(lo, hi) {
    const len = hi - lo + 1;
    for (let i = Math.floor(len / 2) - 1; i >= 0; i--) hpfy(len, i, lo);
    for (let i = len - 1; i > 0; i--) { [a[lo], a[lo + i]] = [a[lo + i], a[lo]]; hpfy(i, 0, lo); }
  }
  function med3(lo, mid, hi) {
    if (a[lo] > a[mid]) [a[lo], a[mid]] = [a[mid], a[lo]];
    if (a[lo] > a[hi])  [a[lo], a[hi]]  = [a[hi],  a[lo]];
    if (a[mid] > a[hi]) [a[mid], a[hi]] = [a[hi], a[mid]];
    return mid;
  }
  function sort(lo, hi, depth) {
    if (hi - lo < 1) return;
    if (hi - lo + 1 <= 16) { ins(lo, hi); return; }
    if (depth === 0) { hp(lo, hi); return; }
    const mid = (lo + hi) >> 1;
    const pi = med3(lo, mid, hi);
    const pv = a[pi];
    [a[pi], a[hi - 1]] = [a[hi - 1], a[pi]];
    let i = lo, j = hi - 2;
    while (true) {
      while (i <= hi - 1 && a[i] < pv) i++;
      while (j >= lo && a[j] > pv) j--;
      if (i >= j) break;
      [a[i], a[j]] = [a[j], a[i]]; i++; j--;
    }
    [a[i], a[hi - 1]] = [a[hi - 1], a[i]];
    sort(lo, i - 1, depth - 1);
    sort(i + 1, hi, depth - 1);
  }
  sort(0, n - 1, maxDepth);
  return a;
}`,
  },
  {
    label: "TimSort (JS)",
    code: `(arr) => {
  const a = [...arr];
  const n = a.length;
  if (n < 2) return a;
  function minRun(len) { let r = 0; while (len >= 64) { r |= len & 1; len >>= 1; } return len + r; }
  const MIN_RUN = minRun(n);
  function binsert(lo, hi, start) {
    for (let i = start; i <= hi; i++) {
      const pv = a[i]; let l = lo, r = i;
      while (l < r) { const m = (l + r) >>> 1; if (a[m] > pv) r = m; else l = m + 1; }
      for (let j = i; j > l; j--) a[j] = a[j - 1];
      a[l] = pv;
    }
  }
  function countRun(lo, hi) {
    let hi2 = lo + 1;
    if (hi2 === hi + 1) return hi2;
    if (a[hi2++] < a[lo]) {
      while (hi2 <= hi && a[hi2] < a[hi2 - 1]) hi2++;
      for (let l = lo, r = hi2 - 1; l < r; l++, r--) { const t = a[l]; a[l] = a[r]; a[r] = t; }
    } else { while (hi2 <= hi && a[hi2] >= a[hi2 - 1]) hi2++; }
    return hi2;
  }
  function merge(lo, mid, hi) {
    const llen = mid - lo + 1, rlen = hi - mid;
    if (llen <= rlen) {
      const tmp = a.slice(lo, mid + 1);
      let i = 0, j = mid + 1, k = lo;
      while (i < llen && j <= hi) a[k++] = tmp[i] <= a[j] ? tmp[i++] : a[j++];
      while (i < llen) a[k++] = tmp[i++];
    } else {
      const tmp = a.slice(mid + 1, hi + 1);
      let i = mid, j = rlen - 1, k = hi;
      while (i >= lo && j >= 0) a[k--] = a[i] > tmp[j] ? a[i--] : tmp[j--];
      while (j >= 0) a[k--] = tmp[j--];
    }
  }
  const rb = [], rl = [];
  function mergeAt(i) {
    const b2 = rb[i + 1], l2 = rl[i + 1];
    rl[i] += l2; rb.splice(i + 1, 1); rl.splice(i + 1, 1);
    merge(rb[i], b2 - 1, b2 + l2 - 1);
  }
  function collapse() {
    while (rb.length > 1) {
      const n2 = rb.length - 1;
      if (n2 > 1 && rl[n2 - 2] <= rl[n2 - 1] + rl[n2])
        mergeAt(rl[n2 - 2] < rl[n2] ? n2 - 2 : n2 - 1);
      else if (rl[n2 - 1] <= rl[n2]) mergeAt(n2 - 1);
      else break;
    }
  }
  let lo = 0, rem = n;
  while (rem > 0) {
    let rl2 = countRun(lo, lo + rem - 1) - lo;
    if (rl2 < MIN_RUN) { const f = Math.min(rem, MIN_RUN); binsert(lo, lo + f - 1, lo + rl2); rl2 = f; }
    rb.push(lo); rl.push(rl2); collapse();
    lo += rl2; rem -= rl2;
  }
  while (rb.length > 1) mergeAt(rb.length > 2 && rl[rb.length - 3] < rl[rb.length - 1] ? rb.length - 3 : rb.length - 2);
  return a;
}`,
  },
  {
    label: "Selection",
    code: `(arr) => {
  const a = [...arr];
  for (let i = 0; i < a.length - 1; i++) {
    let m = i;
    for (let j = i + 1; j < a.length; j++) if (a[j] < a[m]) m = j;
    if (m !== i) [a[i], a[m]] = [a[m], a[i]];
  }
  return a;
}`,
  },
  {
    label: "Cocktail",
    code: `(arr) => {
  const a = [...arr];
  let lo = 0, hi = a.length - 1;
  while (lo < hi) {
    for (let i = lo; i < hi; i++) if (a[i] > a[i + 1]) [a[i], a[i + 1]] = [a[i + 1], a[i]];
    hi--;
    for (let i = hi; i > lo; i--) if (a[i] < a[i - 1]) [a[i], a[i - 1]] = [a[i - 1], a[i]];
    lo++;
  }
  return a;
}`,
  },
  {
    label: "Comb",
    code: `(arr) => {
  const a = [...arr];
  let gap = a.length, sorted = false;
  while (!sorted) {
    gap = Math.max(1, Math.floor(gap / 1.3));
    sorted = gap === 1;
    for (let i = 0; i + gap < a.length; i++)
      if (a[i] > a[i + gap]) { [a[i], a[i + gap]] = [a[i + gap], a[i]]; sorted = false; }
  }
  return a;
}`,
  },
  {
    label: "Gnome",
    code: `(arr) => {
  const a = [...arr];
  let pos = 0;
  while (pos < a.length) {
    if (pos === 0 || a[pos] >= a[pos - 1]) pos++;
    else { [a[pos], a[pos - 1]] = [a[pos - 1], a[pos]]; pos--; }
  }
  return a;
}`,
  },
  {
    label: "Pancake",
    code: `(arr) => {
  const a = [...arr];
  for (let size = a.length; size > 1; size--) {
    let mx = 0;
    for (let i = 1; i < size; i++) if (a[i] > a[mx]) mx = i;
    if (mx !== size - 1) {
      a.splice(0, mx + 1, ...a.slice(0, mx + 1).reverse());
      a.splice(0, size, ...a.slice(0, size).reverse());
    }
  }
  return a;
}`,
  },
  {
    label: "Cycle",
    code: `(arr) => {
  const a = [...arr];
  for (let cs = 0; cs < a.length - 1; cs++) {
    let item = a[cs], pos = cs;
    for (let i = cs + 1; i < a.length; i++) if (a[i] < item) pos++;
    if (pos === cs) continue;
    while (item === a[pos]) pos++;
    [a[pos], item] = [item, a[pos]];
    while (pos !== cs) {
      pos = cs;
      for (let i = cs + 1; i < a.length; i++) if (a[i] < item) pos++;
      while (item === a[pos]) pos++;
      [a[pos], item] = [item, a[pos]];
    }
  }
  return a;
}`,
  },
  {
    label: "Odd-Even",
    code: `(arr) => {
  const a = [...arr];
  let sorted = false;
  while (!sorted) {
    sorted = true;
    for (let i = 1; i < a.length - 1; i += 2)
      if (a[i] > a[i + 1]) { [a[i], a[i + 1]] = [a[i + 1], a[i]]; sorted = false; }
    for (let i = 0; i < a.length - 1; i += 2)
      if (a[i] > a[i + 1]) { [a[i], a[i + 1]] = [a[i + 1], a[i]]; sorted = false; }
  }
  return a;
}`,
  },
  {
    label: "Logos",
    code: `(arr) => {
  // Logos Sort — dual-pivot introsort hybrid with adaptive shortcuts
  const PHI = 0.61803399, PHI2 = 0.38196601, BASE = 48;
  const a = [...arr];
  const n = a.length;
  if (n < 2) return a;
  // xoshiro128+ PRNG
  const s = new Uint32Array(4); crypto.getRandomValues(s);
  if (!s[0] && !s[1] && !s[2] && !s[3]) s[0] = 1;
  function xrand() {
    const r = (s[0] + s[3]) >>> 0, mb = s[1] << 9;
    s[2] ^= s[0]; s[3] ^= s[1]; s[1] ^= s[2]; s[0] ^= s[3];
    s[2] ^= mb; s[3] = (s[3] << 11) | (s[3] >>> 21);
    return (r >>> 1) / 0x80000000;
  }
  const depth0 = 2 * Math.floor(Math.log2(n)) + 4;
  function med3(x, y, z) {
    if (x > y) { const t = x; x = y; y = t; }
    if (y > z) { const t = y; y = z; z = t; }
    if (x > y) { const t = x; x = y; y = t; }
    return y;
  }
  function ninther(lo, hi, ci) {
    return med3(a[Math.max(lo, ci - 1)], a[ci], a[Math.min(hi, ci + 1)]);
  }
  function dualPart(lo, hi, p1, p2) {
    if (p1 > p2) { const t = p1; p1 = p2; p2 = t; }
    let lt = lo, gt = hi, i = lo;
    while (i <= gt) {
      if (a[i] < p1) { [a[lt], a[i]] = [a[i], a[lt]]; lt++; i++; }
      else if (a[i] > p2) { [a[i], a[gt]] = [a[gt], a[i]]; gt--; }
      else i++;
    }
    return [lt, gt];
  }
  function sort(lo, hi, d) {
    while (lo < hi) {
      const sz = hi - lo + 1;
      if (d <= 0) { const tmp = a.slice(lo, hi + 1).sort((x, y) => x - y); for (let i = lo; i <= hi; i++) a[i] = tmp[i - lo]; return; }
      if (sz <= BASE) {
        for (let i = lo + 1; i <= hi; i++) { const k = a[i]; let j = i - 1; while (j >= lo && a[j] > k) { a[j + 1] = a[j]; j--; } a[j + 1] = k; }
        return;
      }
      let mn = a[lo], mx = a[lo];
      for (let i = lo + 1; i <= hi; i++) { if (a[i] < mn) mn = a[i]; if (a[i] > mx) mx = a[i]; }
      const span = mx - mn;
      if (Number.isInteger(mn) && span < sz * 4) {
        const cnt = new Array(span + 1).fill(0);
        for (let i = lo; i <= hi; i++) cnt[a[i] - mn]++;
        let w = lo;
        for (let v = 0; v <= span; v++) { while (cnt[v]-- > 0) a[w++] = v + mn; }
        return;
      }
      if (a[lo] <= a[lo + 1] && a[lo + 1] <= a[lo + 2]) {
        let ok = true; for (let i = lo; i < hi; i++) if (a[i] > a[i + 1]) { ok = false; break; }
        if (ok) return;
        let rev = true; for (let i = lo; i < hi; i++) if (a[i] < a[i + 1]) { rev = false; break; }
        if (rev) { for (let l = lo, r = hi; l < r; l++, r--) { const t = a[l]; a[l] = a[r]; a[r] = t; } return; }
      }
      const jit = PHI * xrand() * (xrand() * 2 - 1);
      const ir = hi - lo;
      const li = lo + Math.max(0, Math.min(ir, Math.floor(ir * PHI2 * jit)));
      const ri = lo + Math.max(0, Math.min(ir, Math.floor(ir * PHI * jit)));
      const [le, re] = dualPart(lo, hi, ninther(lo, hi, li), ninther(lo, hi, ri));
      const regions = [[le - lo, lo, le - 1], [re - le + 1, le, re], [hi - re, re + 1, hi]];
      regions.sort((x, y) => x[0] - y[0]);
      if (regions[0][1] < regions[0][2]) sort(regions[0][1], regions[0][2], d - 1);
      if (regions[1][1] < regions[1][2]) sort(regions[1][1], regions[1][2], d - 1);
      lo = regions[2][1]; hi = regions[2][2]; d--;
    }
  }
  sort(0, n - 1, depth0);
  return a;
}`,
  },
];

// Algorithms with practical upper bounds above SLOW_THRESHOLD but below LARGE_THRESHOLD
const MEDIUM_LIMITS: Record<string, { threshold: number; reason: string }> = {
  shell:    { threshold: 2_000_000, reason: "Large gap strides cause cache thrashing above 2M — use Tim/Logos instead" },
  counting: { threshold: 1_000_000, reason: "Needs an O(k) count array; for random data k ≈ n, so memory explodes above 1M" },
  radix:    { threshold: 1_000_000, reason: "Multiple O(n) auxiliary arrays per digit pass — memory-heavy above 1M" },
  bucket:   { threshold: 500_000,   reason: "Worst-case O(n²) when buckets fill unevenly; unreliable above 500k on non-uniform data" },
};
// Legacy fixed timeout — superseded by per-component state (`timeoutEnabled`/`timeoutSec`).
// Kept as a fallback default referenced anywhere that still hardcodes the bound.
const TIMEOUT_MS = 10_000;

const ALGO_GROUPS = [
  {
    label: "O(n log n)",
    items: [
      { id: "logos",     name: "Logos Sort",  href: "/sorting/logos" },
      { id: "adaptive",    name: "Adaptive Sort",   href: "/sorting/adaptive" },
      { id: "pdqsort",     name: "PDQ Sort",        href: "/sorting/pdqsort" },
      { id: "introsort",   name: "Introsort",       href: "/sorting/introsort" },
      { id: "timsort",     name: "Tim Sort (V8)",   href: "/sorting/timsort" },
      { id: "timsort-js",  name: "Tim Sort (JS)" },
      { id: "merge",   name: "Merge Sort",      href: "/sorting/merge" },
      { id: "quick",   name: "Quick Sort",      href: "/sorting/quick" },
      { id: "heap",    name: "Heap Sort",       href: "/sorting/heap" },
    ],
  },
  {
    label: "Other",
    items: [
      { id: "shell",    name: "Shell Sort",    badge: "O(n log² n)" },
      { id: "counting", name: "Counting Sort", badge: "O(n+k)" },
      { id: "radix",    name: "Radix Sort",    badge: "O(nk)" },
      { id: "bucket",   name: "Bucket Sort",   badge: "O(n+k)" },
      { id: "bitonic",  name: "Bitonic Sort",  badge: "O(n log² n) · GPU" },
    ],
  },
  {
    label: "O(n²)",
    slow: true,
    items: [
      { id: "insertion", name: "Insertion Sort" },
      { id: "selection", name: "Selection Sort" },
      { id: "bubble",    name: "Bubble Sort" },
      { id: "cocktail",  name: "Cocktail Sort" },
      { id: "comb",      name: "Comb Sort" },
      { id: "gnome",     name: "Gnome Sort" },
      { id: "pancake",   name: "Pancake Sort" },
      { id: "cycle",     name: "Cycle Sort" },
      { id: "oddeven",   name: "Odd-Even Sort" },
    ],
  },
] as const;

const ALGO_NAMES: Record<string, string> = {
  logos: "Logos Sort",
  adaptive: "Adaptive Sort",
  pdqsort:  "PDQ Sort",
  introsort: "Introsort",
  timsort: "Tim Sort (V8)",   merge: "Merge Sort",
  quick: "Quick Sort", heap: "Heap Sort",      shell: "Shell Sort",
  counting: "Counting Sort", radix: "Radix Sort", bucket: "Bucket Sort",
  insertion: "Insertion Sort", selection: "Selection Sort", bubble: "Bubble Sort",
  cocktail: "Cocktail Sort", comb: "Comb Sort", gnome: "Gnome Sort",
  pancake: "Pancake Sort", cycle: "Cycle Sort", oddeven: "Odd-Even Sort",
  "timsort-js": "TimSort (JS)",
  bitonic: "Bitonic Sort",
  custom: "Custom Sort",
};


const ALGO_COLORS: Record<string, string> = {
  logos:            "#808080",
  adaptive:       "#26a69a",
  pdqsort:        "#7e57c2",
  introsort:      "#e67e22",
  timsort:        "#5b9bd5",
  "timsort-js":   "#a8c9ed",  // lighter blue — same family, clearly related
  merge:     "#70ad47",
  quick:     "#ffc000",
  heap:      "#b263c8",
  shell:     "#00c4cc",
  counting:  "#ff6b9d",
  radix:     "#8bc34a",
  bucket:    "#ff8f00",
  insertion: "#ef5350",
  selection: "#7e57c2",
  bubble:    "#ec407a",
  cocktail:  "#f06292",
  comb:      "#4dd0e1",
  gnome:     "#aed581",
  pancake:   "#ffb300",
  cycle:     "#9575cd",
  oddeven:   "#4fc3f7",
  // Teal to match the GPU badge — bitonic is the first GPU-targeted algo.
  bitonic:   "#0e9b96",
  custom:    "#e040fb",
};

const ALGO_SPACE: Record<string, string> = {
  logos:            "O(log n) / O(n)",
  adaptive:       "O(log n) / O(span)",
  pdqsort:        "O(log n)",
  introsort:      "O(log n)",
  timsort:        "O(n)",
  "timsort-js":   "O(n)",
  merge:     "O(n)",
  quick:     "O(log n) avg / O(n) worst",
  heap:      "O(1)",
  shell:     "O(1)",
  counting:  "O(k)",
  radix:     "O(n+k)",
  bucket:    "O(n)",
  insertion: "O(1)",
  selection: "O(1)",
  bubble:    "O(1)",
  cocktail:  "O(1)",
  comb:      "O(1)",
  gnome:     "O(1)",
  pancake:   "O(n)",
  cycle:     "O(1)",
  oddeven:   "O(1)",
  // Internally pads to next power-of-2 with sentinels — O(n) scratch.
  bitonic:   "O(n)",
};

const ALGO_TIME: Record<string, string> = {
  logos:            "O(n log n)",
  adaptive:       "O(n log n)",
  pdqsort:        "O(n log n)",
  introsort:      "O(n log n)",
  timsort:        "O(n log n)",
  "timsort-js":   "O(n log n)",
  merge:     "O(n log n)",
  quick:     "O(n log n) avg",
  heap:      "O(n log n)",
  shell:     "O(n log² n)",
  counting:  "O(n+k)",
  radix:     "O(nk)",
  bucket:    "O(n+k)",
  insertion: "O(n²)",
  selection: "O(n²)",
  bubble:    "O(n²)",
  cocktail:  "O(n²)",
  comb:      "O(n²)",
  gnome:     "O(n²)",
  pancake:   "O(n²)",
  cycle:     "O(n²)",
  oddeven:   "O(n²)",
  // log² n compare-swap network — same class as Shell, slower than O(n log n)
  // on CPU but trivially parallelizable on GPU (every (k,j) layer is independent).
  bitonic:   "O(n log² n)",
};

// true = stable, false = unstable, null = not applicable
const ALGO_STABLE: Record<string, boolean> = {
  logos:            false,
  adaptive:       false,
  pdqsort:        false,
  introsort:      false,
  timsort:        true,
  "timsort-js":   true,
  merge:     true,
  quick:     false,
  heap:      false,
  shell:     false,
  counting:  true,
  radix:     true,
  bucket:    true,
  insertion: true,
  selection: false,
  bubble:    true,
  cocktail:  true,
  comb:      false,
  gnome:     true,
  pancake:   false,
  cycle:     false,
  oddeven:   true,
  bitonic:   false,
};

// true = can sort a stream, false = needs full input
const ALGO_ONLINE: Record<string, boolean> = {
  logos:            false,
  adaptive:       false,
  pdqsort:        false,
  introsort:      false,
  timsort:        false,
  "timsort-js":   false,
  merge:     false,
  quick:     false,
  heap:      false,
  shell:     false,
  counting:  false,
  radix:     false,
  bucket:    false,
  insertion: true,
  selection: false,
  bubble:    false,
  cocktail:  false,
  comb:      false,
  gnome:     true,
  pancake:   false,
  cycle:     false,
  oddeven:   false,
  bitonic:   false,
};

// Rank for sorting by complexity class (lower = better)
const BIG_O_RANK: Record<string, number> = {
  "O(1)":                       0,
  "O(log n)":                   1,
  "O(k)":                       2,
  "O(n+k)":                     3,
  "O(n)":                       4,
  "O(nk)":                      5,
  "O(n log n)":                 6,
  "O(n log n) avg":             6,
  "O(n log² n)":                7,
  "O(n²)":                      8,
  // compound labels — ranked by worst case
  "O(log n) / O(n)":            4,
  "O(log n) avg / O(n) worst":  4,
};

const BIG_O_REFS = [
  { id: "logn",   label: "O(log n)",   fn: (n: number) => Math.log2(Math.max(n, 2)),                          color: "#4db6ac" },
  { id: "n",      label: "O(n)",       fn: (n: number) => n,                                                  color: "#64b5f6" },
  { id: "nlogn",  label: "O(n log n)", fn: (n: number) => n * Math.log2(Math.max(n, 2)),                      color: "#ffb74d" },
  { id: "nlog2n", label: "O(n log²n)", fn: (n: number) => n * Math.log2(Math.max(n, 2)) ** 2,                color: "#ce93d8" },
  { id: "n2",     label: "O(n²)",      fn: (n: number) => n * n,                                              color: "#ef9a9a" },
] as const;

// Space complexity reference curves (calibrated separately — anchored to O(n))
const SPACE_BIG_O_REFS = [
  { id: "1",    label: "O(1)",     fn: (_: number) => 1,                            color: "#4db6ac" },
  { id: "logn", label: "O(log n)", fn: (n: number) => Math.log2(Math.max(n, 2)),   color: "#64b5f6" },
  { id: "n",    label: "O(n)",     fn: (n: number) => n,                           color: "#ffb74d" },
] as const;

// ── Big-O curve fitting ───────────────────────────────────────────────────────

interface FitResult {
  label: string;
  k: number;    // scale factor a  (y = a · nᵇ)
  exp: number;  // exponent b
  fn: (n: number) => number;
  pctAt: (n: number, measured: number) => number;
}

// Convert a numeric string to Unicode superscript, e.g. "1.08" → "¹·⁰⁸"
function toSup(s: string): string {
  return s.replace(/./g, c =>
    ({ "0":"⁰","1":"¹","2":"²","3":"³","4":"⁴","5":"⁵","6":"⁶","7":"⁷","8":"⁸","9":"⁹","-":"⁻",".":"·" } as Record<string,string>)[c] ?? c
  );
}

// Log-log OLS regression: fits y = a · nᵇ by linearising log(y) = log(a) + b·log(n).
// All data points contribute equally (no large-n bias) and no Big-O class is assumed —
// the exponent b is derived entirely from the measured data.
function fitLogLog(points: { n: number; val: number }[]): FitResult | null {
  const valid = points.filter(p => p.val > 0 && p.n > 1);
  if (valid.length < 2) return null;

  const xs = valid.map(p => Math.log(p.n));
  const ys = valid.map(p => Math.log(p.val));
  const m  = valid.length;
  const sx  = xs.reduce((s, x) => s + x, 0);
  const sy  = ys.reduce((s, y) => s + y, 0);
  const sxx = xs.reduce((s, x) => s + x * x, 0);
  const sxy = xs.reduce((s, x, i) => s + x * ys[i], 0);

  const denom = m * sxx - sx * sx;
  if (denom === 0) return null;

  const b    = (m * sxy - sx * sy) / denom;  // empirical exponent
  const a    = Math.exp((sy - b * sx) / m);  // scale factor
  const fn   = (n: number) => Math.pow(n, b);
  const label = `n${toSup(b.toFixed(2))}`;

  return { label, k: a, exp: b, fn, pctAt: (n, measured) => { const p = a * fn(n); return p === 0 ? 0 : ((measured - p) / p) * 100; } };
}

const SIZE_BUTTONS: { n: number; word: string }[] = [
  { n: 1,           word: "One" },
  { n: 10,          word: "Ten" },
  { n: 100,         word: "One Hundred" },
  { n: 1_000,       word: "One Thousand" },
  { n: 10_000,      word: "Ten Thousand" },
  { n: 100_000,     word: "One Hundred Thousand" },
  { n: 1_000_000,   word: "One Million" },
  { n: 10_000_000,  word: "Ten Million" },
  { n: 100_000_000, word: "One Hundred Million" },
];

const SCENARIO_OPTIONS: { id: BenchmarkScenario; label: string; desc: string; rare?: boolean }[] = [
  { id: "random",       label: "Random",          desc: "average case" },
  { id: "nearlySorted", label: "Nearly sorted",   desc: "Timsort's home turf" },
  { id: "reversed",     label: "Reversed",        desc: "worst case for naive quicksort" },
  { id: "duplicates",   label: "Many duplicates", desc: "stress-tests three-way partition" },
  { id: "sorted",       label: "Already sorted",  desc: "best case — rare in mix", rare: true },
];

// ── Per-algorithm variant descriptors ─────────────────────────────────────────

const QUICK_PIVOT_OPTS: { id: QuickPivot; label: string; desc: string }[] = [
  { id: "first",   label: "First",    desc: "arr[lo] — O(n²) on sorted or reversed input" },
  { id: "last",    label: "Last",     desc: "arr[hi] (Lomuto naive) — O(n²) on sorted input" },
  { id: "median3", label: "Median-3", desc: "Median of first/mid/last — eliminates O(n²) on sorted/reversed (default)" },
  { id: "random",  label: "Random",   desc: "Uniformly random pivot — probabilistically safe, expected O(n log n)" },
];

const SHELL_GAPS_OPTS: { id: ShellGaps; label: string; desc: string }[] = [
  { id: "shell",     label: "Shell",     desc: "Shell (1959): n/2, n/4, …, 1 — simple baseline, O(n²) worst case" },
  { id: "hibbard",   label: "Hibbard",   desc: "Hibbard (1963): 2^k−1 — O(n^(3/2)) worst case" },
  { id: "sedgewick", label: "Sedgewick", desc: "Sedgewick (1986): 1,5,19,41,… — O(n^(4/3)) worst case" },
  { id: "ciura",     label: "Ciura",     desc: "Ciura (2001): 1,4,10,23,… — empirically best, complexity unknown" },
];

// Returns the total space Big-O label (auxiliary + input).
// Input is always O(n), so total = O(n) unless aux already dominates with a
// larger term (e.g. counting sort's O(k) aux → O(n+k) total).
function totalSpaceLabel(id: string): string {
  const aux = ALGO_SPACE[id] ?? "";
  if (aux === "O(k)" || aux === "O(n+k)") return "O(n+k)";
  return "O(n)";
}

// ── Theoretical space estimation ──────────────────────────────────────────────
// Used when performance.memory is unavailable or returns 0 (its common lazy-
// update behavior means the before/after diff is often 0 for fast sorts).
// Values are in bytes and match the algorithm's known O() space class.
function theoreticalSpaceBytes(id: string, n: number): number {
  const space = ALGO_SPACE[id] ?? "";
  // For compound labels (e.g. "O(log n) avg / O(n) worst"), take the worst-case segment.
  // Split on "/" and parse the segment that represents the most space.
  const segments = space.split("/").map(s => s.trim());
  const worst = segments.reduce<string>((acc, seg) => {
    const rank = (s: string) => {
      if (s.startsWith("O(n")) return 3;
      if (s.startsWith("O(k")) return 2;
      if (s.includes("log"))   return 1;
      return 0; // O(1)
    };
    return rank(seg) >= rank(acc) ? seg : acc;
  }, segments[0]);
  if (worst === "O(1)")           return 200;
  if (worst.includes("log"))      return Math.ceil(Math.log2(Math.max(n, 2))) * 64;
  if (worst.startsWith("O(k"))    return Math.min(n, 1_000_000) * 4;
  return n * 8; // O(n), O(n+k), O(nk), etc.
}

const RANK_COLORS = ["#c9961a", "#888", "#b06830"];

function rankColor(rank: number, total: number): string {
  if (rank <= 3) return RANK_COLORS[rank - 1];
  if (rank === total) return "var(--color-state-swap)";
  return "var(--color-muted)";
}

// ── Algorithm info cards ───────────────────────────────────────────────────────

interface AlgoInfo {
  best: string; avg: string; worst: string;
  space: string;
  inPlace: boolean;
  useCase: string;
  intuition: string;
}

const ALGO_INFO: Record<string, AlgoInfo> = {
  logos:     { best: "O(n)",       avg: "O(n log n)", worst: "O(n log n)", space: "O(log n) / O(n)", inPlace: false, useCase: "General-purpose sort for any data; adaptive across all input patterns", intuition: "Dual-pivot introsort hybrid. Auxiliary space has three distinct paths: (1) pure recursion — O(log n) call stack via tail-call elimination on the largest partition; (2) counting sort shortcut — O(k) where k = value range, fires when valueRange < 4·n, often O(1) relative to n in practice; (3) introsort fallback — O(n) slice + TimSort merge buffer when depth 2·log₂n + 4 is exhausted (adversarial input only). Worst-case auxiliary is O(n)." },
  adaptive:  { best: "O(n)",       avg: "O(n log n)", worst: "O(n log n)", space: "O(log n) / O(span)", inPlace: true, useCase: "General-purpose sort that profiles the input first and picks the cheapest strategy", intuition: "Scans for min/max, integer range, and inversion rate before choosing a strategy: counting sort for small integer spans, insertion sort for tiny or nearly-sorted arrays, introsort with heapsort fallback otherwise" },
  pdqsort:   { best: "O(n)",       avg: "O(n log n)", worst: "O(n log n)", space: "O(log n)",            inPlace: true, useCase: "General-purpose default in Rust's std and Boost.Sort — robust against adversarial input", intuition: "Pattern-defeating quicksort by Orson Peters: median-of-3 / pseudomedian-of-9 pivot, partial-insertion-sort early-out detects already-sorted regions in O(n), equal-elements fast path handles many duplicates in O(n), heapsort fallback after log₂(n) bad partitions guarantees O(n log n)" },
  introsort: { best: "O(n log n)", avg: "O(n log n)", worst: "O(n log n)", space: "O(log n)", inPlace: true,  useCase: "Default sort in C++ std::sort; whenever stability isn't required", intuition: "Quicksort that switches to heapsort if recursion depth exceeds 2·log₂n — quicksort speed with worst-case guarantee" },
  timsort:      { best: "O(n)",       avg: "O(n log n)", worst: "O(n log n)", space: "O(n)",     inPlace: false, useCase: "Data that already has partial order: DB results, log files, nearly-sorted arrays", intuition: "Detects natural sorted runs in the input and merges them; exploits real-world order that pure quicksort ignores" },
  "timsort-js": { best: "O(n)",       avg: "O(n log n)", worst: "O(n log n)", space: "O(n)",     inPlace: false, useCase: "Same as Tim Sort — direct comparison of pure-JavaScript overhead vs V8's native C++ implementation", intuition: "Pure-JS implementation of the same TimSort algorithm: natural run detection, binary insertion sort, and merge with temporary buffer. The gap vs native .sort() reflects the JS⟷C++ comparator callback cost per comparison." },
  merge:     { best: "O(n log n)", avg: "O(n log n)", worst: "O(n log n)", space: "O(n)",     inPlace: false, useCase: "When stability is required and extra memory is available; external sort, linked lists", intuition: "Recursively splits the array in half, sorts each half, merges — guaranteed O(n log n) with no pivot pitfalls" },
  quick:     { best: "O(n log n)", avg: "O(n log n)", worst: "O(n²)",      space: "O(log n) avg / O(n) worst", inPlace: true,  useCase: "Fastest in practice on random data; avoid first/last pivot on sorted input", intuition: "Partitions around a pivot and recurses on both sides — cache-friendly but pivot choice determines whether you get n log n or n². Recursion stack is O(log n) average but O(n) on degenerate inputs without tail-call optimization." },
  heap:      { best: "O(n log n)", avg: "O(n log n)", worst: "O(n log n)", space: "O(1)",     inPlace: true,  useCase: "When both O(n log n) worst-case and O(1) extra space are required simultaneously", intuition: "Builds a max-heap then extracts elements one by one — theoretically optimal but cache-unfriendly; rarely beats quicksort in practice" },
  shell:     { best: "O(n log n)", avg: "O(n log² n)",worst: "O(n²)",      space: "O(1)",     inPlace: true,  useCase: "Memory-constrained environments; medium arrays where simplicity matters over peak speed", intuition: "Insertion sort with shrinking gap sequences — large gaps eliminate long-distance disorder early, making the final pass cheap" },
  counting:  { best: "O(n+k)",     avg: "O(n+k)",     worst: "O(n+k)",     space: "O(k)",     inPlace: false, useCase: "Small bounded integer keys: scores 0–100, ASCII characters, small enums", intuition: "Counts occurrences of each value, then reconstructs the array — zero comparisons, but requires a counting array of size k" },
  radix:     { best: "O(nk)",      avg: "O(nk)",       worst: "O(nk)",      space: "O(n+k)",   inPlace: false, useCase: "Large datasets of integers or fixed-length strings where k (digit count) is small", intuition: "Sorts by one digit at a time least-to-most significant, using a stable sub-sort each pass — avoids comparisons entirely" },
  bucket:    { best: "O(n+k)",     avg: "O(n+k)",     worst: "O(n²)",      space: "O(n+k)",   inPlace: false, useCase: "Uniformly distributed floating-point data; fast when values spread evenly across a known range", intuition: "Maps each value to a bucket by range, sorts each bucket independently, concatenates — collapses to O(n²) if distribution is skewed" },
  insertion: { best: "O(n)",       avg: "O(n²)",      worst: "O(n²)",      space: "O(1)",     inPlace: true,  useCase: "Arrays under ~20 elements, nearly-sorted input, or as the base case of hybrid sorts", intuition: "Inserts each element into its correct position among the already-sorted prefix — excellent on nearly-sorted data, terrible on reversed" },
  selection: { best: "O(n²)",      avg: "O(n²)",      worst: "O(n²)",      space: "O(1)",     inPlace: true,  useCase: "When write operations are expensive (e.g. flash memory) — makes only O(n) swaps regardless of input", intuition: "Finds the minimum of the unsorted suffix, swaps it to the front — simple and write-minimal, but always scans the whole array" },
  bubble:    { best: "O(n)",       avg: "O(n²)",      worst: "O(n²)",      space: "O(1)",     inPlace: true,  useCase: "Teaching only — the classic introductory example; not practical for production", intuition: "Repeatedly swaps adjacent out-of-order elements; the largest value 'bubbles' to its final position each pass" },
  cocktail:  { best: "O(n)",       avg: "O(n²)",      worst: "O(n²)",      space: "O(1)",     inPlace: true,  useCase: "Marginal improvement over bubble sort; still only useful as a teaching variant", intuition: "Bidirectional bubble sort — alternates left-to-right and right-to-left passes, pushing the max and min simultaneously" },
  comb:      { best: "O(n log n)", avg: "O(n²/2^p)",  worst: "O(n²)",      space: "O(1)",     inPlace: true,  useCase: "Simple improvement over bubble sort with meaningfully better random-data performance", intuition: "Compares elements at a shrinking gap rather than adjacent pairs — eliminates 'turtles' (small values near the end) that cripple bubble sort" },
  gnome:     { best: "O(n)",       avg: "O(n²)",      worst: "O(n²)",      space: "O(1)",     inPlace: true,  useCase: "Teaching; one of the simplest conceivable sort algorithms to implement from scratch", intuition: "Steps forward until it finds an out-of-order pair, swaps them, steps back one — like insertion sort but moves one step at a time" },
  pancake:   { best: "O(n)",       avg: "O(n²)",      worst: "O(n²)",      space: "O(n)",     inPlace: false, useCase: "Systems where the only primitive is a prefix reversal — robotics, parallel networks", intuition: "Flips prefixes to bring the largest unsorted element to the top, then flips it to its final position — repeat for each element. Each flip allocates a temporary reversed slice." },
  cycle:     { best: "O(n²)",      avg: "O(n²)",      worst: "O(n²)",      space: "O(1)",     inPlace: true,  useCase: "When minimizing writes is critical — each element is moved to its final position at most once", intuition: "Decomposes the permutation into disjoint cycles; rotates each cycle so every element lands exactly in its correct slot in one write" },
  oddeven:   { best: "O(n)",       avg: "O(n²)",      worst: "O(n²)",      space: "O(1)",     inPlace: true,  useCase: "Parallel architectures where odd and even index pairs can be compared simultaneously on separate processors", intuition: "Alternates between odd-indexed and even-indexed adjacent swaps — equivalent to bubble sort but designed to parallelise across processors" },
  bitonic:   { best: "O(n log² n)", avg: "O(n log² n)", worst: "O(n log² n)", space: "O(n)",   inPlace: false, useCase: "GPU/SIMD parallel hardware: every (k, j) compare-swap layer runs lockstep with no data-dependent branches — slower than O(n log n) on CPU, but trivially parallelizable. Try toggling the WebGPU engine to see the same algorithm run on the GPU.", intuition: "Builds a sorting network: for each subsequence pair of size k, for each compare distance j inside that pair, every index i compares with i⊕j and swaps if out of order, with the direction flipped every k indices so adjacent bitonic runs sort opposite ways. Concatenating opposite-direction sorted runs gives a bitonic sequence the next layer can collapse. Requires power-of-2 length — internally pads with +Infinity sentinels and trims, which is where the O(n) auxiliary comes from." },
};

// ── AlgoTooltip wrapper ───────────────────────────────────────────────────────
// Wraps any inline element; shows a compact info card after a short hover delay.

function WithAlgoTooltip({ id, children }: { id: string; children: React.ReactNode }) {
  const info = ALGO_INFO[id] ?? (id === "timsort-js" ? ALGO_INFO["timsort"] : null);
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapRef = useRef<HTMLSpanElement>(null);

  if (!info) return <>{children}</>;

  const show = () => {
    timerRef.current = setTimeout(() => {
      if (!wrapRef.current) return;
      const r = wrapRef.current.getBoundingClientRect();
      const x = Math.min(r.left, (typeof window !== "undefined" ? window.innerWidth : 800) - 268);
      const y = r.bottom + 6;
      setPos({ x, y });
      setVisible(true);
    }, 280);
  };
  const hide = () => { if (timerRef.current) clearTimeout(timerRef.current); setVisible(false); };

  const color = ALGO_COLORS[id] ?? "#888";
  const stable = ALGO_STABLE[id];

  return (
    <span ref={wrapRef} onMouseEnter={show} onMouseLeave={hide} style={{ cursor: "default" }}>
      {children}
      {visible && (
        <span
          onMouseEnter={() => { if (timerRef.current) clearTimeout(timerRef.current); setVisible(true); }}
          onMouseLeave={hide}
          style={{
            position: "fixed", left: pos.x, top: pos.y, zIndex: 9999,
            width: 260, pointerEvents: "auto",
            background: "var(--color-surface-2)",
            border: `1px solid ${color}55`,
            borderRadius: 10, padding: "10px 12px",
            boxShadow: "0 4px 24px rgba(0,0,0,0.35)",
            fontFamily: "monospace",
          }}
        >
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--color-text)" }}>
              {ALGO_NAMES[id] ?? id}
            </span>
            <span style={{ marginLeft: "auto", fontSize: 8, padding: "1px 5px", borderRadius: 4,
              background: stable ? "rgba(78,160,90,0.15)" : "rgba(200,100,50,0.15)",
              color: stable ? "#7ec88a" : "#e0945a",
              border: `1px solid ${stable ? "rgba(78,160,90,0.3)" : "rgba(200,100,50,0.3)"}`,
            }}>
              {stable ? "stable" : "unstable"}
            </span>
            <span style={{ fontSize: 8, padding: "1px 5px", borderRadius: 4,
              background: info.inPlace ? "rgba(100,181,246,0.12)" : "rgba(180,100,200,0.12)",
              color: info.inPlace ? "#64b5f6" : "#ce93d8",
              border: `1px solid ${info.inPlace ? "rgba(100,181,246,0.25)" : "rgba(180,100,200,0.25)"}`,
            }}>
              {info.inPlace ? "in-place" : `${info.space} space`}
            </span>
          </div>

          {/* Time complexity grid */}
          <div style={{ fontSize: 8, color: "var(--color-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 3 }}>Time</div>
          <div style={{ display: "grid", gridTemplateColumns: "36px 1fr", gap: "2px 6px", marginBottom: 8, fontSize: 9 }}>
            {([["best", info.best], ["avg", info.avg], ["worst", info.worst]] as [string, string][]).map(([label, val]) => (
              <React.Fragment key={label}>
                <span style={{ color: "var(--color-muted)", textAlign: "right" }}>{label}</span>
                <span style={{ color: label === "worst" && info.worst.includes("n²") ? "#ef9a9a" : label === "best" && info.best === "O(n)" ? "#a5d6a7" : "var(--color-text)", fontWeight: 600 }}>{val}</span>
              </React.Fragment>
            ))}
          </div>

          {/* Space complexity grid */}
          <div style={{ fontSize: 8, color: "var(--color-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 3 }}>Space</div>
          <div style={{ display: "grid", gridTemplateColumns: "36px 1fr", gap: "2px 6px", marginBottom: 8, fontSize: 9 }}>
            <span style={{ color: "var(--color-muted)", textAlign: "right" }}>aux</span>
            <span style={{ color: info.space === "O(1)" ? "#a5d6a7" : info.space === "O(n)" || info.space === "O(n+k)" ? "#ef9a9a" : "var(--color-text)", fontWeight: 600 }}>{info.space}</span>
          </div>

          {/* Intuition */}
          <p style={{ fontSize: 9, color: "var(--color-text)", lineHeight: 1.5, marginBottom: 6, borderTop: "1px solid var(--color-border)", paddingTop: 6 }}>
            {info.intuition}
          </p>

          {/* Use case */}
          <p style={{ fontSize: 9, color: "var(--color-muted)", lineHeight: 1.4, fontStyle: "italic" }}>
            ✦ {info.useCase}
          </p>
        </span>
      )}
    </span>
  );
}

function fmtN(n: number): string {
  const fmt = (v: number) => {
    if (v % 1 === 0) return v.toFixed(0);                          // exact integer → no decimals
    const s = v.toPrecision(3);
    return s.includes(".") ? s.replace(/\.?0+$/, "") : s;         // strip trailing decimal zeros only
  };
  if (n >= 1_000_000_000) return `${fmt(n / 1_000_000_000)}B`;
  if (n >= 1_000_000)     return `${fmt(n / 1_000_000)}M`;
  if (n >= 1_000)         return `${fmt(n / 1_000)}k`;
  return String(n);
}

function fmtTime(ms: number): string {
  if (ms < 0.1)   return `${(ms * 1_000).toFixed(0)} μs`;
  if (ms < 10)    return `${ms.toFixed(3)} ms`;
  if (ms < 1_000) return `${ms.toFixed(1)} ms`;
  return `${(ms / 1_000).toFixed(2)} s`;
}

// Compact formatter for Big-O predicted values — handles huge O(n²) magnitudes
function fmtPredicted(ms: number): string {
  if (ms < 1)           return `${(ms * 1_000).toFixed(0)}μs`;
  if (ms < 1_000)       return `${ms.toFixed(1)}ms`;
  if (ms < 60_000)      return `${(ms / 1_000).toFixed(1)}s`;
  if (ms < 3_600_000)   return `${(ms / 60_000).toFixed(1)}min`;
  if (ms < 86_400_000)  return `${(ms / 3_600_000).toFixed(1)}hr`;
  return `${(ms / 86_400_000).toFixed(0)}d`;
}

function fmtBytes(b: number): string {
  if (b <= 0)           return "0 B";
  if (b < 1_024)        return `${b.toFixed(0)} B`;
  if (b < 1_048_576)    return `${(b / 1_024).toFixed(1)} KB`;
  return `${(b / 1_048_576).toFixed(1)} MB`;
}

// ── Spinner ───────────────────────────────────────────────────────────────────

function Spinner({ value, onChange, min, max, label }: {
  value: number; onChange: (v: number) => void; min: number; max: number; label: string;
}) {
  const dec = () => onChange(Math.max(min, value - 1));
  const inc = () => onChange(Math.min(max, value + 1));
  const btnStyle = (disabled: boolean): React.CSSProperties => ({
    width: 22, height: 24, display: "flex", alignItems: "center", justifyContent: "center",
    background: "none", border: "none", cursor: disabled ? "not-allowed" : "pointer",
    color: disabled ? "var(--color-border)" : "var(--color-muted)", fontSize: 11, lineHeight: 1,
    flexShrink: 0, userSelect: "none",
  });
  return (
    <div style={{
      display: "inline-flex", alignItems: "center",
      border: "1px solid var(--color-border)", borderRadius: 6,
      background: "var(--color-surface-1)", overflow: "hidden",
    }} aria-label={label}>
      <button onClick={dec} disabled={value <= min} style={btnStyle(value <= min)}>−</button>
      <span style={{ minWidth: 26, textAlign: "center", fontSize: 11, fontFamily: "monospace", color: "var(--color-text)", padding: "0 2px" }}>
        {value}
      </span>
      <button onClick={inc} disabled={value >= max} style={btnStyle(value >= max)}>+</button>
    </div>
  );
}

// ── Scenario presets ──────────────────────────────────────────────────────────
const SCENARIO_PRESETS = [
  { label: "Logos vs Tim Sort", desc: "Head-to-head · random · 10K → 1M", algos: ["logos","timsort"], scenarios: ["random"] as BenchmarkScenario[], sizes: [10_000,100_000,1_000_000], pivot: undefined, gaps: undefined },
  { label: "O(n log n) shootout", desc: "All fast sorts · random · up to 1 M", algos: ["logos","timsort","merge","quick","heap"], scenarios: ["random"] as BenchmarkScenario[], sizes: [1000,10000,100000,500000,1000000], pivot: undefined, gaps: undefined },
  { label: "QuickSort worst case", desc: "First-pivot on sorted input", algos: ["quick","merge","logos"], scenarios: ["nearlySorted"] as BenchmarkScenario[], sizes: [500,1000,5000,10000,50000], pivot: "first" as QuickPivot, gaps: undefined },
  { label: "TimSort advantage", desc: "Nearly-sorted · merge vs insertion vs logos", algos: ["logos","timsort","merge","quick","insertion"], scenarios: ["nearlySorted"] as BenchmarkScenario[], sizes: [1000,10000,100000,500000], pivot: undefined, gaps: undefined },
  { label: "Linear sorts", desc: "Counting / radix vs comparison sorts", algos: ["counting","radix","logos","merge","quick"], scenarios: ["random"] as BenchmarkScenario[], sizes: [10000,100000,500000,1000000], pivot: undefined, gaps: undefined },
  { label: "O(n²) gallery", desc: "Quadratic sorts on small n", algos: ["insertion","selection","bubble","shell"], scenarios: ["random"] as BenchmarkScenario[], sizes: [100,500,1000,2000,5000], pivot: undefined, gaps: undefined },
  { label: "Space hogs", desc: "Memory usage across all complexities", algos: ["merge","timsort","logos","heap","quick","counting"], scenarios: ["random"] as BenchmarkScenario[], sizes: [1000,10000,100000,1000000], pivot: undefined, gaps: undefined },
  { label: "Duplicates stress", desc: "High-duplicate data — TimSort & counting shine", algos: ["logos","timsort","merge","quick","counting","radix"], scenarios: ["duplicates"] as BenchmarkScenario[], sizes: [10000,100000,1000000], pivot: undefined, gaps: undefined },
  { label: "Polymorphic sweep", desc: "Each sort = one integer + float + string array, summed as one measurement (type-safe sorts only)", algos: ["logos","merge","quick","heap","insertion","shell"], scenarios: ["random"] as BenchmarkScenario[], sizes: [1000,10000,100000,500000], pivot: undefined, gaps: undefined, poly: true },
] as const;


// ── 3-D scatter chart ─────────────────────────────────────────────────────────
// Orthographic projection with interactive orbit + zoom. Axes: X=log(n), Y=log(time), Z=log(space).

type Chart3DPoint = { id: string; n: number; t: number; s: number; x: number; y: number; z: number; work?: number };

// Parse a #rrggbb hex color into {r,g,b}
function parseHex(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace("#", "");
  return { r: parseInt(h.slice(0,2),16), g: parseInt(h.slice(2,4),16), b: parseInt(h.slice(4,6),16) };
}
// Linearly blend two hex colors by t∈[0,1], return rgba string with given alpha
function blendHex(hexA: string, hexB: string, t: number, alpha: number): string {
  const a = parseHex(hexA), b = parseHex(hexB);
  const r = Math.round(a.r + (b.r - a.r) * t);
  const g = Math.round(a.g + (b.g - a.g) * t);
  const bl = Math.round(a.b + (b.b - a.b) * t);
  return `rgba(${r},${g},${bl},${alpha})`;
}
// Add alpha to a #rrggbb hex color
function hexAlpha(hex: string, alpha: number): string {
  const { r, g, b } = parseHex(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ── Memory estimation ─────────────────────────────────────────────────────────

function estimateMemory(alg: string, n: number): { avg: number; peak: number } {
  const ELEMENT_SIZE = 8; // 8 bytes per number (Float64)
  switch (alg) {
    case "merge":
    case "timsort":
    case "timsort-js":
      return { avg: n * ELEMENT_SIZE, peak: n * ELEMENT_SIZE * 1.5 };
    case "radix":
      return { avg: n * ELEMENT_SIZE * 2, peak: n * ELEMENT_SIZE * 2 };
    case "bucket":
      return { avg: n * ELEMENT_SIZE, peak: n * ELEMENT_SIZE * 1.2 };
    case "quick":
    case "introsort":
    case "logos":
      return { avg: Math.log2(Math.max(n, 2)) * 64, peak: Math.log2(Math.max(n, 2)) * 128 };
    default:
      return { avg: 64, peak: 128 };
  }
}

function fmtMemory(b: number): string {
  if (b < 1_024)     return `${b.toFixed(0)} B`;
  if (b < 1_048_576) return `${(b / 1_024).toFixed(1)} KB`;
  return `${(b / 1_048_576).toFixed(2)} MB`;
}

// ── Memory Flamegraph ─────────────────────────────────────────────────────────
// SVG grouped bar chart: X = benchmark size n (log-scale positions), Y = spaceBytes.
// Each n has one bar group; bars within a group are one per algorithm, side-by-side.

function MemoryFlameGraph({ data, algos }: { data: CurveData; algos: string[] }) {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; algo: string; n: number; bytes: number } | null>(null);

  const VW = 600, VH = 260;
  const pL = 62, pR = 18, pT = 18, pB = 52;
  const iW = VW - pL - pR;
  const iH = VH - pT - pB;

  // Collect all n values that have at least one algo with spaceBytes
  const nSet = new Set<number>();
  for (const id of algos) {
    for (const p of data[id] ?? []) {
      if ((p.spaceBytes ?? 0) > 0) nSet.add(p.n);
    }
  }
  const ns = [...nSet].sort((a, b) => a - b);

  if (ns.length === 0) return (
    <div style={{ height: 200, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-muted)", fontSize: 11 }}>
      Run a benchmark to see space usage data.
    </div>
  );

  // Max spaceBytes across all data points for y-scale
  let maxBytes = 1;
  for (const id of algos) {
    for (const p of data[id] ?? []) {
      if ((p.spaceBytes ?? 0) > maxBytes) maxBytes = p.spaceBytes!;
    }
  }

  // X: log-scale positioning across ns
  const logNs = ns.map(n => Math.log10(Math.max(n, 1)));
  const logMin = logNs[0], logMax = logNs[logNs.length - 1];
  const xAtN = (n: number) => {
    if (ns.length === 1) return pL + iW / 2;
    const t = logMax > logMin ? (Math.log10(Math.max(n, 1)) - logMin) / (logMax - logMin) : 0.5;
    return pL + t * iW;
  };

  const yAt = (v: number) => pT + iH - (v / maxBytes) * iH;

  // Bar layout within each group
  const groupW = ns.length > 1
    ? Math.min(iW / ns.length, 60)
    : 60;
  const barW = Math.max(2, Math.min(groupW * 0.8 / Math.max(algos.length, 1), 16));
  const groupPad = barW * algos.length;

  const yTicks = [0.25, 0.5, 0.75, 1].map(f => ({ v: maxBytes * f, y: yAt(maxBytes * f) }));

  return (
    <div style={{ position: "relative", userSelect: "none" }}>
      <svg
        viewBox={`0 0 ${VW} ${VH}`}
        width="100%"
        style={{ display: "block", overflow: "visible" }}
        onMouseLeave={() => setTooltip(null)}
      >
        {/* Y grid + labels */}
        {yTicks.map(({ v, y }) => (
          <g key={v}>
            <line x1={pL} y1={y} x2={VW - pR} y2={y}
              stroke="rgba(128,128,128,0.12)" strokeWidth={0.8} />
            <text x={pL - 5} y={y + 3.5} textAnchor="end"
              style={{ fontSize: 8, fontFamily: "monospace", fill: "var(--color-muted)" }}>
              {fmtBytes(v)}
            </text>
          </g>
        ))}

        {/* Bars */}
        {ns.map(n => {
          const cx = xAtN(n);
          const totalW = barW * algos.length;
          return (
            <g key={n}>
              {algos.map((id, ai) => {
                const pt = (data[id] ?? []).find(p => p.n === n);
                const bytes = pt?.spaceBytes ?? 0;
                if (bytes <= 0) return null;
                const color = ALGO_COLORS[id] ?? "#888";
                const barH = Math.max((bytes / maxBytes) * iH, 2);
                const bx = cx - totalW / 2 + ai * barW;
                const by = yAt(bytes);
                return (
                  <rect
                    key={id}
                    x={bx} y={by} width={Math.max(barW - 1, 1)} height={barH}
                    fill={color} opacity={0.85} rx={1}
                    style={{ cursor: "pointer" }}
                    onMouseEnter={e => {
                      const svg = (e.target as SVGRectElement).ownerSVGElement!;
                      const rect = svg.getBoundingClientRect();
                      setTooltip({
                        x: (bx + barW / 2) * (rect.width / VW),
                        y: by * (rect.height / VH),
                        algo: ALGO_NAMES[id] ?? id,
                        n,
                        bytes,
                      });
                    }}
                  />
                );
              })}
              {/* X tick */}
              <text x={cx} y={VH - pB + 14} textAnchor="middle"
                style={{ fontSize: 8, fontFamily: "monospace", fill: "var(--color-muted)" }}>
                {fmtN(n)}
              </text>
            </g>
          );
        })}

        {/* Axes */}
        <line x1={pL} y1={pT + iH} x2={VW - pR} y2={pT + iH} stroke="var(--color-border)" strokeWidth={1} />
        <line x1={pL} y1={pT} x2={pL} y2={pT + iH} stroke="var(--color-border)" strokeWidth={1} />

        {/* X-axis label */}
        <text x={pL + iW / 2} y={VH - 3} textAnchor="middle"
          style={{ fontSize: 8, fontFamily: "monospace", fill: "var(--color-muted)", fontStyle: "italic" }}>
          input size (n) — log scale
        </text>

        {/* Y-axis label */}
        <text x={0} y={0} transform={`translate(10, ${pT + iH / 2}) rotate(-90)`}
          textAnchor="middle"
          style={{ fontSize: 8, fontFamily: "monospace", fill: "var(--color-muted)", fontStyle: "italic" }}>
          peak space (bytes)
        </text>

        {/* Legend */}
        {algos.map((id, i) => {
          const color = ALGO_COLORS[id] ?? "#888";
          const lx = pL + i * 90;
          if (lx + 85 > VW) return null;
          return (
            <g key={id}>
              <rect x={lx} y={VH - pB + 28} width={8} height={8} fill={color} opacity={0.85} rx={1} />
              <text x={lx + 11} y={VH - pB + 36}
                style={{ fontSize: 8, fontFamily: "monospace", fill: "var(--color-muted)" }}>
                {(ALGO_NAMES[id] ?? id).replace(" Sort", "").replace("Sort", "")}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Hover tooltip */}
      {tooltip && (
        <div style={{
          position: "absolute",
          left: tooltip.x,
          top: tooltip.y - 8,
          transform: "translate(-50%, -100%)",
          background: "var(--color-surface-1)",
          border: "1px solid var(--color-border)",
          borderRadius: 6,
          padding: "5px 9px",
          fontSize: 10,
          fontFamily: "monospace",
          color: "var(--color-text)",
          pointerEvents: "none",
          whiteSpace: "nowrap",
          zIndex: 10,
        }}>
          <div style={{ fontWeight: 700, marginBottom: 3 }}>{tooltip.algo}</div>
          <div>n = {fmtN(tooltip.n)}</div>
          <div>space = {fmtBytes(tooltip.bytes)}</div>
        </div>
      )}
    </div>
  );
}

// ── Memory bar chart ──────────────────────────────────────────────────────────

function MemoryChart({ algos, n }: { algos: string[]; n: number }) {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; label: string; avg: number; peak: number } | null>(null);

  const VW = 600, VH = 240;
  const pL = 60, pR = 20, pT = 20, pB = 50;
  const iW = VW - pL - pR;
  const iH = VH - pT - pB;

  const data = algos.map(id => ({ id, ...estimateMemory(id, n) }));
  const maxVal = Math.max(...data.map(d => d.peak), 1);

  // Y-axis: 5 gridlines
  const gridLines = 5;
  const yScale = (v: number) => pT + iH - (v / maxVal) * iH;

  const groupW = iW / Math.max(data.length, 1);
  const barW   = Math.min(groupW * 0.35, 28);
  const gap    = Math.min(groupW * 0.05, 4);

  return (
    <div style={{ position: "relative", userSelect: "none" }}>
      <svg
        viewBox={`0 0 ${VW} ${VH}`}
        width="100%"
        style={{ display: "block", overflow: "visible" }}
        onMouseLeave={() => setTooltip(null)}
      >
        {/* Gridlines + Y-axis labels */}
        {Array.from({ length: gridLines + 1 }, (_, i) => {
          const frac = i / gridLines;
          const val  = maxVal * frac;
          const y    = yScale(val);
          return (
            <g key={i}>
              <line x1={pL} y1={y} x2={VW - pR} y2={y}
                stroke="rgba(128,128,128,0.12)" strokeWidth={0.8} />
              <text x={pL - 5} y={y + 3.5} textAnchor="end"
                style={{ fontSize: 8, fontFamily: "monospace", fill: "var(--color-muted)" }}>
                {fmtMemory(val)}
              </text>
            </g>
          );
        })}

        {/* Bars */}
        {data.map((d, gi) => {
          const cx = pL + gi * groupW + groupW / 2;
          const avgX  = cx - barW - gap / 2;
          const peakX = cx + gap / 2;

          const avgH  = Math.max((d.avg  / maxVal) * iH, 1);
          const peakH = Math.max((d.peak / maxVal) * iH, 1);

          const color = ALGO_COLORS[d.id] ?? "#888";

          return (
            <g key={d.id}>
              {/* Average bar */}
              <rect
                x={avgX} y={yScale(d.avg)} width={barW} height={avgH}
                fill={color} opacity={0.85} rx={2}
                onMouseEnter={e => {
                  const svg = (e.target as SVGRectElement).ownerSVGElement!;
                  const rect = svg.getBoundingClientRect();
                  const svgW = rect.width;
                  const scaleX = svgW / VW;
                  setTooltip({ x: (avgX + barW / 2) * scaleX, y: yScale(d.avg) * (rect.height / VH), label: ALGO_NAMES[d.id] ?? d.id, avg: d.avg, peak: d.peak });
                }}
                style={{ cursor: "pointer" }}
              />
              {/* Peak bar */}
              <rect
                x={peakX} y={yScale(d.peak)} width={barW} height={peakH}
                fill={color} opacity={0.38} rx={2}
                onMouseEnter={e => {
                  const svg = (e.target as SVGRectElement).ownerSVGElement!;
                  const rect = svg.getBoundingClientRect();
                  const svgW = rect.width;
                  const scaleX = svgW / VW;
                  setTooltip({ x: (peakX + barW / 2) * scaleX, y: yScale(d.peak) * (rect.height / VH), label: ALGO_NAMES[d.id] ?? d.id, avg: d.avg, peak: d.peak });
                }}
                style={{ cursor: "pointer" }}
              />
              {/* X-axis label */}
              <text
                x={cx} y={VH - pB + 14} textAnchor="middle"
                style={{ fontSize: 8, fontFamily: "monospace", fill: "var(--color-muted)" }}
              >
                {(ALGO_NAMES[d.id] ?? d.id).replace(" Sort", "").replace("Sort", "")}
              </text>
            </g>
          );
        })}

        {/* X axis line */}
        <line x1={pL} y1={pT + iH} x2={VW - pR} y2={pT + iH}
          stroke="var(--color-border)" strokeWidth={1} />
        {/* Y axis line */}
        <line x1={pL} y1={pT} x2={pL} y2={pT + iH}
          stroke="var(--color-border)" strokeWidth={1} />

        {/* Legend */}
        <rect x={pL} y={VH - pB + 30} width={10} height={8} fill="var(--color-accent)" opacity={0.85} rx={1} />
        <text x={pL + 13} y={VH - pB + 38} style={{ fontSize: 8, fontFamily: "monospace", fill: "var(--color-muted)" }}>
          Average
        </text>
        <rect x={pL + 65} y={VH - pB + 30} width={10} height={8} fill="var(--color-accent)" opacity={0.38} rx={1} />
        <text x={pL + 78} y={VH - pB + 38} style={{ fontSize: 8, fontFamily: "monospace", fill: "var(--color-muted)" }}>
          Peak
        </text>
        <text x={VW - pR} y={VH - pB + 38} textAnchor="end"
          style={{ fontSize: 8, fontFamily: "monospace", fill: "var(--color-muted)", fontStyle: "italic" }}>
          n = {fmtN(n)} · theoretical
        </text>
      </svg>

      {/* Hover tooltip */}
      {tooltip && (
        <div style={{
          position: "absolute",
          left: tooltip.x,
          top: tooltip.y - 8,
          transform: "translate(-50%, -100%)",
          background: "var(--color-surface-1)",
          border: "1px solid var(--color-border)",
          borderRadius: 6,
          padding: "5px 9px",
          fontSize: 10,
          fontFamily: "monospace",
          color: "var(--color-text)",
          pointerEvents: "none",
          whiteSpace: "nowrap",
          zIndex: 10,
        }}>
          <div style={{ fontWeight: 700, marginBottom: 3 }}>{tooltip.label}</div>
          <div>avg:  {fmtMemory(tooltip.avg)}</div>
          <div>peak: {fmtMemory(tooltip.peak)}</div>
        </div>
      )}
    </div>
  );
}

function Chart3D({
  data, algos, highlight,
}: {
  data: Record<string, { n: number; timeMs: number; spaceBytes?: number; timedOut?: boolean }[]>;
  algos: string[];
  highlight: string | null;
}) {
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const [rotX, setRotX]         = useState(28);
  const [rotY, setRotY]         = useState(-40);
  const [zoom, setZoom]         = useState(1.0);
  const [tool, setTool]         = useState<"orbit" | "measure" | "shadows">("measure");
  const [showSurface, setShowSurface] = useState(false);
  const [hoverInfo, setHoverInfo] = useState<(Chart3DPoint & { sx: number; sy: number }) | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; startRx: number; startRy: number } | null>(null);
  const hitRef  = useRef<(Chart3DPoint & { sx: number; sy: number })[]>([]);

  const { pts3d, ranges, workLogMin, workLogMax } = useMemo(() => {
    const raw: { id: string; n: number; t: number; s: number }[] = [];
    for (const id of algos) {
      for (const p of data[id] ?? []) {
        if (!p.timedOut && p.timeMs > 0 && (p.spaceBytes ?? 0) > 0)
          raw.push({ id, n: p.n, t: p.timeMs, s: p.spaceBytes! });
      }
    }
    if (raw.length === 0) return { pts3d: [] as Chart3DPoint[], ranges: null, workLogMin: 0, workLogMax: 1 };

    // Deduplicate: for same (id, n), keep the last measurement
    const seen = new Map<string, typeof raw[number]>();
    for (const p of raw) seen.set(`${p.id}:${p.n}`, p);
    const deduped = [...seen.values()];

    const logNs = deduped.map(p => Math.log10(p.n));
    const logTs = deduped.map(p => Math.log10(p.t));
    const logSs = deduped.map(p => Math.log10(p.s));
    const ranges = {
      n: [Math.min(...logNs), Math.max(...logNs)] as [number, number],
      t: [Math.min(...logTs), Math.max(...logTs)] as [number, number],
      s: [Math.min(...logSs), Math.max(...logSs)] as [number, number],
    };
    const nr = (v: number, [lo, hi]: [number, number]) => hi > lo ? (v - lo) / (hi - lo) : 0.5;

    // Log-log fit per algorithm → cumulative work integral ∫₀ⁿ f(n) dn = a·nᵇ⁺¹/(b+1)
    const fitMap: Record<string, { a: number; b: number } | null> = {};
    for (const id of algos) {
      const pts = deduped.filter(p => p.id === id && p.t > 0 && p.n > 1);
      if (pts.length < 2) { fitMap[id] = null; continue; }
      const xs = pts.map(p => Math.log(p.n)), ys = pts.map(p => Math.log(p.t));
      const m = pts.length;
      const sx = xs.reduce((a, x) => a + x, 0), sy = ys.reduce((a, y) => a + y, 0);
      const sxx = xs.reduce((a, x) => a + x * x, 0), sxy = xs.reduce((a, x, i) => a + x * ys[i], 0);
      const den = m * sxx - sx * sx;
      if (den === 0) { fitMap[id] = null; continue; }
      const b = (m * sxy - sx * sy) / den;
      const a = Math.exp((sy - b * sx) / m);
      fitMap[id] = { a, b };
    }

    // Axis mapping: X(red)=time, Y(green/vertical)=n, Z(blue)=space
    const pts3d: Chart3DPoint[] = deduped.map(p => {
      const fit = fitMap[p.id];
      const work = (fit && fit.b > -1) ? fit.a * Math.pow(p.n, fit.b + 1) / (fit.b + 1) : undefined;
      return { ...p, x: nr(Math.log10(p.t), ranges.t), y: nr(Math.log10(p.n), ranges.n), z: nr(Math.log10(p.s), ranges.s), work };
    });

    const workVals = pts3d.map(p => p.work).filter((w): w is number => w != null && w > 0);
    const workLogMin = workVals.length > 0 ? Math.log10(Math.min(...workVals)) : 0;
    const workLogMax = workVals.length > 0 ? Math.log10(Math.max(...workVals)) : 1;
    return { pts3d, ranges, workLogMin, workLogMax };
  }, [data, algos]);

  const project = useCallback((x: number, y: number, z: number, W: number, H: number): [number, number] => {
    const ryR = rotY * Math.PI / 180, rxR = rotX * Math.PI / 180;
    const px = x - 0.5, py = y - 0.5, pz = z - 0.5;
    const rx1 = px * Math.cos(ryR) + pz * Math.sin(ryR);
    const rz1 = -px * Math.sin(ryR) + pz * Math.cos(ryR);
    const ry2 = py * Math.cos(rxR) - rz1 * Math.sin(rxR);
    const sc = Math.min(W, H) * 0.44 * zoom;
    return [W / 2 + rx1 * sc, H / 2 - ry2 * sc];
  }, [rotX, rotY, zoom]);

  // Compute view-space depth (positive = closer to viewer)
  const viewDepth = useCallback((x: number, y: number, z: number): number => {
    const ryR = rotY * Math.PI / 180, rxR = rotX * Math.PI / 180;
    const px = x - 0.5, py = y - 0.5, pz = z - 0.5;
    const rz1 = -px * Math.sin(ryR) + pz * Math.cos(ryR);
    return py * Math.sin(rxR) + rz1 * Math.cos(rxR);
  }, [rotX, rotY]);

  // Normalise a work value → [0, 1] for visual encoding
  const normWork = useCallback((w: number) =>
    workLogMax > workLogMin ? (Math.log10(w) - workLogMin) / (workLogMax - workLogMin) : 0.5,
  [workLogMin, workLogMax]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !ranges || pts3d.length === 0) return;
    const ctx = canvas.getContext("2d")!;
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    const pr = (x: number, y: number, z: number) => project(x, y, z, W, H);
    const newHits: typeof hitRef.current = [];

    // ── Box wireframe ──────────────────────────────────────────────────────────
    // Standard RGB axis convention: X=red, Y=green, Z=blue
    const AXIS_X = "#ef5350", AXIS_Y = "#66bb6a", AXIS_Z = "#64b5f6";
    const boxEdges: [number,number,number,number,number,number][] = [
      [1,0,0,1,1,0],[1,0,0,1,0,1],[0,1,0,1,1,0],
      [0,1,0,0,1,1],[1,1,0,1,1,1],[0,0,1,1,0,1],
      [0,0,1,0,1,1],[1,0,1,1,1,1],[0,1,1,1,1,1],
    ];
    ctx.strokeStyle = "rgba(128,128,128,0.15)"; ctx.lineWidth = 0.5;
    for (const [x0,y0,z0,x1,y1,z1] of boxEdges) {
      const [ax,ay] = pr(x0,y0,z0); const [bx,by] = pr(x1,y1,z1);
      ctx.beginPath(); ctx.moveTo(ax,ay); ctx.lineTo(bx,by); ctx.stroke();
    }
    // Origin axes — drawn thicker with standard RGB colours
    const originAxes: [string, number,number,number, number,number,number][] = [
      [AXIS_X, 0,0,0, 1,0,0],
      [AXIS_Y, 0,0,0, 0,1,0],
      [AXIS_Z, 0,0,0, 0,0,1],
    ];
    for (const [color, x0,y0,z0, x1,y1,z1] of originAxes) {
      const [ax,ay] = pr(x0,y0,z0); const [bx,by] = pr(x1,y1,z1);
      ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.7;
      ctx.beginPath(); ctx.moveTo(ax,ay); ctx.lineTo(bx,by); ctx.stroke();
      // Arrowhead
      const angle = Math.atan2(by - ay, bx - ax);
      const AL = 7, AW = 3;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(bx - AL * Math.cos(angle - AW / AL), by - AL * Math.sin(angle - AW / AL));
      ctx.lineTo(bx - AL * Math.cos(angle + AW / AL), by - AL * Math.sin(angle + AW / AL));
      ctx.closePath(); ctx.fill();
      ctx.globalAlpha = 1;
    }
    // Axis labels at tips  (X=time/red, Y=n/green vertical, Z=space/blue)
    ctx.font = "bold 12px monospace";
    ctx.globalAlpha = 0.9;
    { const [lx,ly] = pr(1,0,0); ctx.fillStyle = AXIS_X; ctx.fillText("time →", lx + 5, ly + 4); }
    { const [lx,ly] = pr(0,1,0); ctx.fillStyle = AXIS_Y; ctx.fillText("n ↑", lx + 4, ly - 5); }
    { const [lx,ly] = pr(0,0,1); ctx.fillStyle = AXIS_Z; ctx.fillText("space", lx + 4, ly + 4); }
    ctx.globalAlpha = 1; ctx.lineWidth = 0.5;

    // ── Base grid ─────────────────────────────────────────────────────────────
    ctx.strokeStyle = "rgba(128,128,128,0.08)"; ctx.lineWidth = 0.5;
    for (let i = 0; i <= 4; i++) {
      const t = i / 4;
      let [ax,ay] = pr(t,0,0); let [bx,by] = pr(t,0,1);
      ctx.beginPath(); ctx.moveTo(ax,ay); ctx.lineTo(bx,by); ctx.stroke();
      [ax,ay] = pr(0,0,t); [bx,by] = pr(1,0,t);
      ctx.beginPath(); ctx.moveTo(ax,ay); ctx.lineTo(bx,by); ctx.stroke();
    }

    // ── Surface curtains — per-algo vertical ribbons dropping to y=0 ──────────
    // For each algorithm, for each consecutive n-pair, draw a quad:
    //   top-left  : actual data point (x, y, z)
    //   bottom-left: floor projection (x, 0, z)
    //   bottom-right: next floor (x', 0, z')
    //   top-right : next data point (x', y', z')
    // Painter's algorithm across all quads from all algos.
    if (showSurface && pts3d.length > 0) {
      type CurtainQuad = { depth: number; pts: [number,number][]; color: string };
      const quads: CurtainQuad[] = [];

      for (const id of algos) {
        const color = ALGO_COLORS[id] ?? "#888";
        const sorted = pts3d.filter(p => p.id === id).sort((a, b) => a.n - b.n);
        for (let ni = 0; ni < sorted.length - 1; ni++) {
          const p0 = sorted[ni], p1 = sorted[ni + 1];
          // top-left, bottom-left, bottom-right, top-right
          const [xtl, ytl] = pr(p0.x, p0.y, p0.z);
          const [xbl, ybl] = pr(p0.x, 0,    p0.z);
          const [xbr, ybr] = pr(p1.x, 0,    p1.z);
          const [xtr, ytr] = pr(p1.x, p1.y, p1.z);
          const depth = (
            viewDepth(p0.x, p0.y, p0.z) + viewDepth(p0.x, 0, p0.z) +
            viewDepth(p1.x, 0,    p1.z) + viewDepth(p1.x, p1.y, p1.z)
          ) / 4;
          quads.push({ depth, pts: [[xtl,ytl],[xbl,ybl],[xbr,ybr],[xtr,ytr]], color });
        }
      }

      // Painter's algorithm: farthest first
      quads.sort((a, b) => a.depth - b.depth);

      const SURFACE_ALPHA = highlight ? 0.22 : 0.42;
      for (const q of quads) {
        const [[x0,y0],[x1,y1],[x2,y2],[x3,y3]] = q.pts;
        // Vertical gradient: brighter at top (data curve), dimmer at floor
        const gradLen = Math.hypot((x0+x3)/2 - (x1+x2)/2, (y0+y3)/2 - (y1+y2)/2);
        if (gradLen > 0.5) {
          const grad = ctx.createLinearGradient((x0+x3)/2, (y0+y3)/2, (x1+x2)/2, (y1+y2)/2);
          grad.addColorStop(0, hexAlpha(q.color, SURFACE_ALPHA));
          grad.addColorStop(1, hexAlpha(q.color, SURFACE_ALPHA * 0.3));
          ctx.fillStyle = grad;
        } else {
          ctx.fillStyle = hexAlpha(q.color, SURFACE_ALPHA);
        }
        ctx.beginPath();
        ctx.moveTo(x0, y0); ctx.lineTo(x1, y1);
        ctx.lineTo(x2, y2); ctx.lineTo(x3, y3);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = hexAlpha(q.color, 0.12); ctx.lineWidth = 0.3;
        ctx.stroke();
      }
    }

    // ── Axis tick labels (X=time/red, Y=n/green, Z=space/blue) ───────────────
    ctx.font = "9px monospace";
    const TICKS = 4;
    for (let i = 0; i <= TICKS; i++) {
      const t = i / TICKS;
      // X axis ticks (time)
      const [tx2,ty2] = pr(t,0,0);
      ctx.fillStyle = "#ff0000"; ctx.globalAlpha = 0.7;
      ctx.fillText(fmtTime(Math.pow(10, ranges.t[0] + t*(ranges.t[1]-ranges.t[0]))), tx2-16, ty2+12);
      // Y axis ticks (n)
      const [nx,ny] = pr(0,t,0);
      ctx.fillStyle = "#00cc44";
      ctx.fillText(fmtN(Math.pow(10, ranges.n[0] + t*(ranges.n[1]-ranges.n[0]))), nx-34, ny+4);
      // Z axis ticks (space)
      const [sx2,sy2] = pr(0,0,t);
      ctx.fillStyle = "#4488ff";
      ctx.fillText(fmtBytes(Math.pow(10, ranges.s[0] + t*(ranges.s[1]-ranges.s[0]))), sx2+5, sy2+3);
    }
    ctx.globalAlpha = 1;

    // ── Algorithm curves + dots (drawn over the surface) ──────────────────────
    for (const id of algos) {
      const isHl = !highlight || highlight === id;
      const color = ALGO_COLORS[id] ?? "#888";
      const sorted = pts3d.filter(p => p.id === id).sort((a, b) => a.n - b.n);
      if (sorted.length === 0) continue;

      // Shadow projection on base plane
      if (tool === "shadows") {
        ctx.strokeStyle = color; ctx.lineWidth = 0.8;
        ctx.globalAlpha = isHl ? 0.22 : 0.06; ctx.setLineDash([3,3]);
        ctx.beginPath();
        sorted.forEach((p, i) => { const [px,py] = pr(p.x,0,p.z); i===0?ctx.moveTo(px,py):ctx.lineTo(px,py); });
        ctx.stroke();
        ctx.setLineDash([]); ctx.globalAlpha = 1;
        ctx.strokeStyle = color; ctx.lineWidth = 0.4; ctx.globalAlpha = isHl ? 0.15 : 0.04;
        for (const p of sorted) {
          const [px,py] = pr(p.x,p.y,p.z); const [bx,by] = pr(p.x,0,p.z);
          ctx.beginPath(); ctx.moveTo(px,py); ctx.lineTo(bx,by); ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }

      // Vertical drop lines: each data point → floor (y=0), always shown
      ctx.globalAlpha = isHl ? 0.35 : 0.08;
      for (const p of sorted) {
        const [px, py] = pr(p.x, p.y, p.z);
        const [fx, fy] = pr(p.x, 0,    p.z);
        ctx.strokeStyle = color; ctx.lineWidth = 0.7;
        ctx.setLineDash([2, 3]);
        ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(fx, fy); ctx.stroke();
        // Floor dot
        ctx.fillStyle = color;
        ctx.beginPath(); ctx.arc(fx, fy, 1.5, 0, Math.PI * 2); ctx.fill();
      }
      ctx.setLineDash([]); ctx.globalAlpha = 1;

      // Cumulative-work rings on floor — circle radius ∝ ∫f dn at each n
      for (const p of sorted) {
        if (p.work == null) continue;
        const [fx, fy] = pr(p.x, 0, p.z);
        const ringR = 3 + normWork(p.work) * 9;
        ctx.globalAlpha = isHl ? 0.28 : 0.06;
        ctx.strokeStyle = color; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(fx, fy, ringR, 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha = 1;
      }

      // Curve line — brighter when surface is shown so it reads above the mesh
      ctx.strokeStyle = color;
      ctx.lineWidth = isHl ? (showSurface ? 2.2 : 1.8) : 0.8;
      ctx.globalAlpha = isHl ? 1 : 0.2;
      ctx.beginPath();
      sorted.forEach((p, i) => { const [px,py] = pr(p.x,p.y,p.z); i===0?ctx.moveTo(px,py):ctx.lineTo(px,py); });
      ctx.stroke(); ctx.globalAlpha = 1;

      // Dots — radius encodes cumulative work (larger = more work done up to that n)
      for (const p of sorted) {
        const [px,py] = pr(p.x,p.y,p.z);
        const baseR = isHl ? 2.5 : 1.5;
        const r = p.work != null ? baseR + normWork(p.work) * (isHl ? 5 : 2) : baseR;
        ctx.fillStyle = color; ctx.globalAlpha = isHl ? 1 : 0.25;
        ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI*2); ctx.fill();
        // White outline on dots so they pop over surface
        if (isHl && showSurface) {
          ctx.strokeStyle = "rgba(255,255,255,0.5)"; ctx.lineWidth = 0.8;
          ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI*2); ctx.stroke();
        }
        ctx.globalAlpha = 1;
        newHits.push({ ...p, sx: px, sy: py });
      }
    }

    // ── Measure tooltip ────────────────────────────────────────────────────────
    if (hoverInfo && tool === "measure") {
      const { sx, sy, id, n, t, s, work } = hoverInfo;
      ctx.strokeStyle = "#fff"; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(sx, sy, 7, 0, Math.PI*2); ctx.stroke();
      const fmtWork = (w: number) => w >= 1000 ? `${(w/1000).toFixed(2)}s·n` : `${w.toFixed(2)}ms·n`;
      const lines = [
        ALGO_NAMES[id] ?? id,
        `n = ${fmtN(n)}`,
        `t = ${fmtTime(t)}`,
        `s = ${fmtBytes(s)}`,
        ...(work != null ? [`∫ = ${fmtWork(work)}`] : []),
      ];
      const LINE_H = 16, PAD = 10;
      const bW = 160, bH = lines.length * LINE_H + PAD * 1.5;
      const bx = Math.min(sx + 14, W - bW - 4), by = Math.max(sy - bH - 10, 4);
      ctx.fillStyle = "rgba(10,10,10,0.94)";
      ctx.strokeStyle = "rgba(255,255,255,0.18)"; ctx.lineWidth = 0.7;
      ctx.beginPath(); ctx.roundRect?.(bx, by, bW, bH, 5) ?? ctx.rect(bx, by, bW, bH);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = ALGO_COLORS[id] ?? "#fff"; ctx.font = "bold 12px monospace";
      ctx.fillText(lines[0], bx + PAD, by + PAD + 8);
      ctx.fillStyle = "#ddd"; ctx.font = "11px monospace";
      lines.slice(1).forEach((line, i) => ctx.fillText(line, bx + PAD, by + PAD + 8 + (i + 1) * LINE_H));
    }

    hitRef.current = newHits;
  }, [pts3d, ranges, rotX, rotY, zoom, highlight, tool, hoverInfo, showSurface, project, viewDepth, normWork]);

  const onMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (tool === "orbit") {
      e.preventDefault(); // block text-selection and scroll while dragging
      dragRef.current = { startX: e.clientX, startY: e.clientY, startRx: rotX, startRy: rotY };
    }
  };
  const onMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (dragRef.current && tool === "orbit") {
      setRotY(dragRef.current.startRy + (e.clientX - dragRef.current.startX) * 0.5);
      setRotX(Math.max(-85, Math.min(85, dragRef.current.startRx - (e.clientY - dragRef.current.startY) * 0.5)));
      return;
    }
    if (tool === "measure") {
      const canvas = canvasRef.current!;
      const rect = canvas.getBoundingClientRect();
      const mx = (e.clientX - rect.left) * (canvas.width / rect.width);
      const my = (e.clientY - rect.top)  * (canvas.height / rect.height);
      let best = null as typeof hitRef.current[0] | null, bestD = Infinity;
      for (const h of hitRef.current) {
        const d = Math.hypot(h.sx - mx, h.sy - my);
        if (d < bestD) { bestD = d; best = h; }
      }
      setHoverInfo(bestD < 22 ? best : null);
    }
  };
  const onMouseUp = () => { dragRef.current = null; };

  // Native wheel listener — React's synthetic onWheel is passive by default so
  // e.preventDefault() is silently ignored and the page scrolls through the chart.
  // Attaching with { passive: false } lets us consume the event.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      setZoom(z => Math.max(0.3, Math.min(4, z * (1 - e.deltaY * 0.0008))));
    };
    canvas.addEventListener("wheel", handler, { passive: false });
    return () => canvas.removeEventListener("wheel", handler);
  }, []);

  // ── Hotkeys: R resets the view; X/Y/Z snap to axis-aligned looks ─────────
  // Only fires when the canvas is hovered, so the keys don't fight inputs
  // elsewhere on the page. Axis-aligned views preserve zoom (the user may have
  // zoomed in deliberately); R does a full reset.
  // Conventions: pressing the axis letter looks ALONG that axis, so the named
  // axis points INTO the screen. X view → see (n, space). Y → (time, space).
  // Z → (time, n). This matches CAD-viewer convention.
  const isHoveredRef = useRef(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!isHoveredRef.current) return;
      // Don't steal keys while the user is typing in an input/textarea/select
      // or in a contentEditable region elsewhere on the page.
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || t?.isContentEditable) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return; // leave OS/browser shortcuts alone
      const k = e.key.toLowerCase();
      if (k === "r") {
        e.preventDefault();
        setRotX(28); setRotY(-40); setZoom(1);
        setTool("measure"); setShowSurface(false); setHoverInfo(null);
      } else if (k === "x") {
        e.preventDefault();
        // Look along +X: time axis points into the screen, see n (up) vs space.
        setRotX(0); setRotY(90);
      } else if (k === "y") {
        e.preventDefault();
        // Look along +Y from above: top-down view of time (x) vs space (z).
        setRotX(90); setRotY(0);
      } else if (k === "z") {
        e.preventDefault();
        // Look along +Z: head-on time (x) vs n (y), no depth.
        setRotX(0); setRotY(0);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Pinch-to-zoom + single-finger orbit via touch events.
  // touchAction: "none" in CSS tells the browser not to scroll/zoom natively,
  // so e.preventDefault() is not required here, but we call it for safety.
  const pinchDistRef = useRef<number | null>(null);

  const onTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const ts = Array.from(e.touches);
    if (ts.length === 2) {
      // Start of a pinch gesture — record initial distance between fingers
      pinchDistRef.current = Math.hypot(ts[1].clientX - ts[0].clientX, ts[1].clientY - ts[0].clientY);
      dragRef.current = null;
    } else if (ts.length === 1) {
      // Single finger: treat as orbit drag regardless of selected tool
      dragRef.current = { startX: ts[0].clientX, startY: ts[0].clientY, startRx: rotX, startRy: rotY };
      pinchDistRef.current = null;
    }
  };

  const onTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const ts = Array.from(e.touches);
    if (ts.length === 2 && pinchDistRef.current !== null) {
      const dist = Math.hypot(ts[1].clientX - ts[0].clientX, ts[1].clientY - ts[0].clientY);
      const ratio = dist / pinchDistRef.current;
      setZoom(z => Math.max(0.3, Math.min(4, z * ratio)));
      pinchDistRef.current = dist;
    } else if (ts.length === 1 && dragRef.current) {
      const t = ts[0];
      setRotY(dragRef.current.startRy + (t.clientX - dragRef.current.startX) * 0.5);
      setRotX(Math.max(-85, Math.min(85, dragRef.current.startRx - (t.clientY - dragRef.current.startY) * 0.5)));
    }
  };

  const onTouchEnd = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length < 2) pinchDistRef.current = null;
    if (e.touches.length === 0) dragRef.current = null;
  };

  if (!ranges || pts3d.length === 0) return (
    <div style={{ height: 260, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-muted)", fontSize: 11 }}>
      Run a benchmark with time and space data to see the 3D chart.
    </div>
  );

  return (
    <div>
      <div style={{ display: "flex", gap: 5, marginBottom: 8, alignItems: "center", flexWrap: "wrap" }}>
        {([
          { id: "measure", label: "⊕ Measure",  title: "Hover over a point to inspect its n / time / space values" },
          { id: "orbit"  , label: "⟳ Orbit",   title: "Drag to orbit · scroll to zoom" },
          { id: "shadows", label: "⇓ Shadows",  title: "Show base-plane projections: each algorithm's curve projected onto the n–space floor" },
        ] as const).map(tb => (
          <button key={tb.id} onClick={() => setTool(tb.id)} title={tb.title} style={{
            padding: "2px 8px", fontSize: 9, borderRadius: 4, cursor: "pointer",
            background: tool === tb.id ? "var(--color-accent)" : "var(--color-surface-1)",
            border: `1px solid ${tool === tb.id ? "var(--color-accent)" : "var(--color-border)"}`,
            color: tool === tb.id ? "#fff" : "var(--color-muted)",
          }}>{tb.label}</button>
        ))}
        {/* Surface toggle */}
        <button
          onClick={() => setShowSurface(s => !s)}
          title="Toggle vertical curtains — each algorithm's curve drops a filled ribbon down to the time-axis floor"
          style={{
            padding: "2px 8px", fontSize: 9, borderRadius: 4, cursor: "pointer",
            background: showSurface ? "rgba(100,181,246,0.15)" : "var(--color-surface-1)",
            border: `1px solid ${showSurface ? "#64b5f6" : "var(--color-border)"}`,
            color: showSurface ? "#64b5f6" : "var(--color-muted)",
          }}
        >
          ⬡ Surface
        </button>
        <button onClick={() => { setRotX(28); setRotY(-40); setZoom(1); }} style={{
          padding: "2px 8px", fontSize: 9, borderRadius: 4, cursor: "pointer",
          background: "var(--color-surface-1)", border: "1px solid var(--color-border)", color: "var(--color-muted)",
        }}>⟲ Reset</button>
        <button onClick={() => {
          const c = canvasRef.current; if (!c) return;
          const a = document.createElement("a");
          a.href = c.toDataURL("image/png");
          a.download = "benchmark-3d.png";
          a.click();
        }} style={{
          padding: "2px 8px", fontSize: 9, borderRadius: 4, cursor: "pointer",
          background: "var(--color-surface-1)", border: "1px solid var(--color-border)", color: "var(--color-muted)",
        }}>↓ PNG</button>
        <span style={{ fontSize: 8, marginLeft: "auto", fontFamily: "monospace" }}>
          <span style={{ color: "#ef5350" }}>X=time</span>
          {" · "}
          <span style={{ color: "#66bb6a" }}>Y=n</span>
          {" · "}
          <span style={{ color: "#64b5f6" }}>Z=space</span>
          <span style={{ color: "var(--color-muted)" }}> (log₁₀) · dot size &amp; ring = ∫f dn cumulative work</span>
        </span>
      </div>
      <canvas
        ref={canvasRef} width={800} height={307}
        style={{ width: "100%", height: "auto", aspectRatio: "800 / 307", display: "block",
          touchAction: "none", userSelect: "none",
          cursor: tool === "orbit" ? (dragRef.current ? "grabbing" : "grab") : tool === "measure" ? (hoverInfo ? "pointer" : "crosshair") : "default" }}
        onMouseDown={onMouseDown} onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseEnter={() => { isHoveredRef.current = true; }}
        onMouseLeave={() => { isHoveredRef.current = false; dragRef.current = null; setHoverInfo(null); }}
        onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
        onDragStart={e => e.preventDefault()}
      />
      {/* Hotkey + curtain hints. Hover the chart and press R / X / Y / Z. */}
      <p style={{ fontSize: 8, color: "var(--color-muted)", fontFamily: "monospace", marginTop: 4 }}>
        <span title="Hover the chart, then press a hotkey">
          hover + <kbd style={kbdStyle}>R</kbd> reset · <kbd style={kbdStyle}>X</kbd>/<kbd style={kbdStyle}>Y</kbd>/<kbd style={kbdStyle}>Z</kbd> axis-aligned view
        </span>
        {showSurface && (
          <> · curtains drop to the n-axis floor · rings on the floor = ∫f dn (larger = more cumulative work) · use ⊕ Measure to inspect any point</>
        )}
      </p>
    </div>
  );
}

// Shared style for the [R]/[X]/[Y]/[Z] hotkey hint chips. Defined at module
// scope so both Chart3D and Chart3DHistory render identical-looking keys.
const kbdStyle: React.CSSProperties = {
  display: "inline-block", padding: "0 4px", fontFamily: "monospace", fontSize: 8,
  border: "1px solid var(--color-border)", borderRadius: 3,
  background: "var(--color-surface-1)", color: "var(--color-text)",
  margin: "0 1px", lineHeight: "12px",
};

// ── Chart3DHistory ───────────────────────────────────────────────────────────
// Long-term-view sibling of Chart3D. Renders the last N stored ghost runs
// (per algorithm) as faded polylines in the same n/time/space axes Chart3D uses,
// so the user can SEE drift: a band that drifts right = slower over time, a
// band that widens = noisier over time, a band that stays tight = stable.
//
// Differences from Chart3D:
//   - Source is ghostRuns + the current run, not just the current run.
//   - Per-run opacity ramp: newest = full alpha, oldest = ~5%.
//   - Modes: "all" (every selected algo, every visible run) for the wow-shot
//     and "single" (one algo, every visible run) for actually reading drift.
//   - A "Show last N" slider gates how many of the stored runs render — the
//     storage cap is GHOST_MAX (100); rendering 100 polylines × 20 algos gets
//     visually saturated fast, so the user usually wants 10-30 visible.
//   - No surface curtains, no cumulative-work rings: those carry no signal
//     across runs and just add noise. Per-point dots are kept small.
//   - No depth-sort of ghost segments — at 100 runs × 20 algos that's the hot
//     loop. Newer-on-top is enforced by draw order (oldest first, newest last).
// ─────────────────────────────────────────────────────────────────────────────
function Chart3DHistory({
  current, ghostRuns, algos,
}: {
  /** The current (in-progress or just-completed) run, in the same shape as Chart3D's `data`.
   *  Always rendered as the brightest, freshest layer if present. */
  current: Record<string, { n: number; timeMs: number; spaceBytes?: number; timedOut?: boolean }[]>;
  /** Persisted ring buffer per algo, oldest-first (idx 0) → newest-last. */
  ghostRuns: Record<string, { ts: number; points: { n: number; timeMs: number; meanMs?: number; spaceBytes?: number }[] }[]>;
  algos: string[];
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Orbit/zoom state — match Chart3D defaults so the first impression matches.
  const [rotX, setRotX] = useState(28);
  const [rotY, setRotY] = useState(-40);
  const [zoom, setZoom] = useState(1.0);
  const [tool, setTool] = useState<"orbit" | "measure">("orbit");
  // "all" overlays every selected algo; "single" focuses one algo so the
  // run-over-run drift band is actually legible.
  const [mode, setMode] = useState<"all" | "single">("all");
  const [focusAlgo, setFocusAlgo] = useState<string | null>(null);
  // Visible-run cap is user-controlled; storage cap (GHOST_MAX) is 100.
  // Persisted so the user's preferred density survives reload.
  const [visibleRuns, setVisibleRuns] = useState<number>(20);
  const visibleHydratedRef = useRef(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem("codecookbook.history3DVisibleRuns");
      if (raw != null) {
        const n = parseInt(raw, 10);
        if (Number.isFinite(n) && n >= 1 && n <= 100) setVisibleRuns(n);
      }
    } catch {}
    visibleHydratedRef.current = true;
  }, []);
  useEffect(() => {
    if (typeof window === "undefined" || !visibleHydratedRef.current) return;
    try { localStorage.setItem("codecookbook.history3DVisibleRuns", String(visibleRuns)); } catch {}
  }, [visibleRuns]);

  type HistPoint = { id: string; runIdx: number; ageRank: number; n: number; t: number; s: number; x: number; y: number; z: number };
  const [hoverInfo, setHoverInfo] = useState<(HistPoint & { sx: number; sy: number }) | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; startRx: number; startRy: number } | null>(null);
  const hitRef = useRef<(HistPoint & { sx: number; sy: number })[]>([]);

  // Auto-pick a focus algo when entering single-mode if none chosen yet.
  useEffect(() => {
    if (mode === "single" && !focusAlgo && algos.length > 0) setFocusAlgo(algos[0]);
  }, [mode, focusAlgo, algos]);

  // Algos actually drawn this frame: scoped by mode.
  const drawnAlgos = useMemo(() => {
    if (mode === "single") return focusAlgo && algos.includes(focusAlgo) ? [focusAlgo] : [];
    return algos;
  }, [mode, focusAlgo, algos]);

  // ── Build the run stacks per algo ────────────────────────────────────────
  // Each algo's stack = [oldest ghost, ..., newest ghost, current?]. We take
  // the LAST `visibleRuns` entries so newest stays visible if visibleRuns < total.
  // ageRank 0 = oldest (most faded), ageRank=total-1 = newest (full alpha).
  const { stacks, ranges } = useMemo(() => {
    type Run = { points: { n: number; t: number; s: number }[]; isCurrent: boolean };
    const stacks: Record<string, Run[]> = {};
    const allN: number[] = []; const allT: number[] = []; const allS: number[] = [];

    for (const id of drawnAlgos) {
      const ghosts = ghostRuns[id] ?? [];
      const stack: Run[] = [];
      for (const g of ghosts) {
        const pts = g.points
          .filter(p => p.timeMs > 0 && (p.spaceBytes ?? 0) > 0)
          .map(p => ({ n: p.n, t: p.timeMs, s: p.spaceBytes! }));
        if (pts.length > 0) stack.push({ points: pts, isCurrent: false });
      }
      // Append the current run as the newest layer (it isn't in ghostRuns until
      // it completes; this keeps the freshest measurements visible mid-run).
      const cur = current[id] ?? [];
      const curPts = cur
        .filter(p => !p.timedOut && p.timeMs > 0 && (p.spaceBytes ?? 0) > 0)
        .map(p => ({ n: p.n, t: p.timeMs, s: p.spaceBytes! }));
      if (curPts.length > 0) stack.push({ points: curPts, isCurrent: true });

      // Cap to the visible window — newest kept.
      const trimmed = stack.length > visibleRuns ? stack.slice(stack.length - visibleRuns) : stack;
      if (trimmed.length > 0) {
        stacks[id] = trimmed;
        for (const r of trimmed) for (const p of r.points) { allN.push(p.n); allT.push(p.t); allS.push(p.s); }
      }
    }

    if (allN.length === 0) return { stacks, ranges: null };
    const logNs = allN.map(Math.log10), logTs = allT.map(Math.log10), logSs = allS.map(Math.log10);
    const ranges = {
      n: [Math.min(...logNs), Math.max(...logNs)] as [number, number],
      t: [Math.min(...logTs), Math.max(...logTs)] as [number, number],
      s: [Math.min(...logSs), Math.max(...logSs)] as [number, number],
    };
    return { stacks, ranges };
  }, [drawnAlgos, ghostRuns, current, visibleRuns]);

  // Project 3D normalized-coord → 2D pixel — identical math to Chart3D.
  const project = useCallback((x: number, y: number, z: number, W: number, H: number): [number, number] => {
    const ryR = rotY * Math.PI / 180, rxR = rotX * Math.PI / 180;
    const px = x - 0.5, py = y - 0.5, pz = z - 0.5;
    const rx1 = px * Math.cos(ryR) + pz * Math.sin(ryR);
    const rz1 = -px * Math.sin(ryR) + pz * Math.cos(ryR);
    const ry2 = py * Math.cos(rxR) - rz1 * Math.sin(rxR);
    const sc = Math.min(W, H) * 0.44 * zoom;
    return [W / 2 + rx1 * sc, H / 2 - ry2 * sc];
  }, [rotX, rotY, zoom]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !ranges) return;
    const ctx = canvas.getContext("2d")!;
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    const pr = (x: number, y: number, z: number) => project(x, y, z, W, H);
    const nr = (v: number, [lo, hi]: [number, number]) => hi > lo ? (v - lo) / (hi - lo) : 0.5;
    const newHits: typeof hitRef.current = [];

    // ── Box wireframe + axes (same convention as Chart3D) ───────────────────
    const AXIS_X = "#ef5350", AXIS_Y = "#66bb6a", AXIS_Z = "#64b5f6";
    const boxEdges: [number,number,number,number,number,number][] = [
      [1,0,0,1,1,0],[1,0,0,1,0,1],[0,1,0,1,1,0],
      [0,1,0,0,1,1],[1,1,0,1,1,1],[0,0,1,1,0,1],
      [0,0,1,0,1,1],[1,0,1,1,1,1],[0,1,1,1,1,1],
    ];
    ctx.strokeStyle = "rgba(128,128,128,0.15)"; ctx.lineWidth = 0.5;
    for (const [x0,y0,z0,x1,y1,z1] of boxEdges) {
      const [ax,ay] = pr(x0,y0,z0); const [bx,by] = pr(x1,y1,z1);
      ctx.beginPath(); ctx.moveTo(ax,ay); ctx.lineTo(bx,by); ctx.stroke();
    }
    const originAxes: [string, number,number,number, number,number,number][] = [
      [AXIS_X, 0,0,0, 1,0,0],
      [AXIS_Y, 0,0,0, 0,1,0],
      [AXIS_Z, 0,0,0, 0,0,1],
    ];
    for (const [color, x0,y0,z0, x1,y1,z1] of originAxes) {
      const [ax,ay] = pr(x0,y0,z0); const [bx,by] = pr(x1,y1,z1);
      ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.7;
      ctx.beginPath(); ctx.moveTo(ax,ay); ctx.lineTo(bx,by); ctx.stroke();
      const angle = Math.atan2(by - ay, bx - ax);
      const AL = 7, AW = 3;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(bx - AL * Math.cos(angle - AW / AL), by - AL * Math.sin(angle - AW / AL));
      ctx.lineTo(bx - AL * Math.cos(angle + AW / AL), by - AL * Math.sin(angle + AW / AL));
      ctx.closePath(); ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.font = "bold 12px monospace";
    ctx.globalAlpha = 0.9;
    { const [lx,ly] = pr(1,0,0); ctx.fillStyle = AXIS_X; ctx.fillText("time →", lx + 5, ly + 4); }
    { const [lx,ly] = pr(0,1,0); ctx.fillStyle = AXIS_Y; ctx.fillText("n ↑", lx + 4, ly - 5); }
    { const [lx,ly] = pr(0,0,1); ctx.fillStyle = AXIS_Z; ctx.fillText("space", lx + 4, ly + 4); }
    ctx.globalAlpha = 1; ctx.lineWidth = 0.5;

    // Base grid (faint)
    ctx.strokeStyle = "rgba(128,128,128,0.08)"; ctx.lineWidth = 0.5;
    for (let i = 0; i <= 4; i++) {
      const t = i / 4;
      let [ax,ay] = pr(t,0,0); let [bx,by] = pr(t,0,1);
      ctx.beginPath(); ctx.moveTo(ax,ay); ctx.lineTo(bx,by); ctx.stroke();
      [ax,ay] = pr(0,0,t); [bx,by] = pr(1,0,t);
      ctx.beginPath(); ctx.moveTo(ax,ay); ctx.lineTo(bx,by); ctx.stroke();
    }

    // Axis tick labels — same scale rendering as Chart3D so users can switch
    // between the two views without re-reading the axes.
    ctx.font = "9px monospace";
    const TICKS = 4;
    for (let i = 0; i <= TICKS; i++) {
      const t = i / TICKS;
      const [tx2,ty2] = pr(t,0,0);
      ctx.fillStyle = "#ff0000"; ctx.globalAlpha = 0.7;
      ctx.fillText(fmtTime(Math.pow(10, ranges.t[0] + t*(ranges.t[1]-ranges.t[0]))), tx2-16, ty2+12);
      const [nx,ny] = pr(0,t,0);
      ctx.fillStyle = "#00cc44";
      ctx.fillText(fmtN(Math.pow(10, ranges.n[0] + t*(ranges.n[1]-ranges.n[0]))), nx-34, ny+4);
      const [sx2,sy2] = pr(0,0,t);
      ctx.fillStyle = "#4488ff";
      ctx.fillText(fmtBytes(Math.pow(10, ranges.s[0] + t*(ranges.s[1]-ranges.s[0]))), sx2+5, sy2+3);
    }
    ctx.globalAlpha = 1;

    // ── Draw history runs ───────────────────────────────────────────────────
    // For each algo: render each run as a polyline + tiny dots, with opacity
    // ramping by recency. The CURRENT run gets a thicker line + larger dots
    // so the user can always pick out "where we are now" inside the band.
    for (const id of drawnAlgos) {
      const stack = stacks[id]; if (!stack || stack.length === 0) continue;
      const color = ALGO_COLORS[id] ?? "#888";
      const total = stack.length;
      for (let ri = 0; ri < total; ri++) {
        const run = stack[ri];
        // ageRank: 0 = oldest in the visible window, total-1 = newest.
        const ageFactor = (ri + 1) / total; // 1/n .. 1
        // Floor at 5% so even the oldest visible run leaves a faint trail;
        // newest peaks at 90% non-current, 100% if it IS the current run.
        const baseAlpha = 0.05 + 0.85 * ageFactor;
        const alpha = run.isCurrent ? 1.0 : baseAlpha;
        const lineWidth = run.isCurrent ? 2.2 : (0.6 + 0.9 * ageFactor);
        const dotR = run.isCurrent ? 2.5 : (0.8 + 1.2 * ageFactor);

        // Project + sort points by n so the polyline reads left→right along Y axis.
        const sorted = [...run.points].sort((a, b) => a.n - b.n).map(p => ({
          ...p,
          x: nr(Math.log10(p.t), ranges.t),
          y: nr(Math.log10(p.n), ranges.n),
          z: nr(Math.log10(p.s), ranges.s),
        }));

        // Polyline
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;
        ctx.beginPath();
        sorted.forEach((p, i) => { const [px,py] = pr(p.x,p.y,p.z); i===0?ctx.moveTo(px,py):ctx.lineTo(px,py); });
        ctx.stroke();

        // Dots (also feeds the measure-tool hit list)
        ctx.fillStyle = color;
        for (const p of sorted) {
          const [px,py] = pr(p.x,p.y,p.z);
          ctx.beginPath(); ctx.arc(px, py, dotR, 0, Math.PI*2); ctx.fill();
          // Only register hits for measure mode at alpha that's actually readable;
          // ghosts at 5% opacity are visual context, not interactive targets.
          if (alpha >= 0.4) newHits.push({ id, runIdx: ri, ageRank: ri, n: p.n, t: p.t, s: p.s, x: p.x, y: p.y, z: p.z, sx: px, sy: py });
        }
      }
      ctx.globalAlpha = 1;
    }

    // ── Measure tooltip ─────────────────────────────────────────────────────
    if (hoverInfo && tool === "measure") {
      const { sx, sy, id, n, t, s, runIdx, ageRank } = hoverInfo;
      const total = stacks[id]?.length ?? 0;
      const ageLabel = runIdx === total - 1 ? "current" : `${total - 1 - ageRank} run${total - 1 - ageRank === 1 ? "" : "s"} ago`;
      ctx.strokeStyle = "#fff"; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(sx, sy, 7, 0, Math.PI*2); ctx.stroke();
      const lines = [
        ALGO_NAMES[id] ?? id,
        `n = ${fmtN(n)}`,
        `t = ${fmtTime(t)}`,
        `s = ${fmtBytes(s)}`,
        ageLabel,
      ];
      const LINE_H = 16, PAD = 10;
      const bW = 160, bH = lines.length * LINE_H + PAD * 1.5;
      const bx = Math.min(sx + 14, W - bW - 4), by = Math.max(sy - bH - 10, 4);
      ctx.fillStyle = "rgba(10,10,10,0.94)";
      ctx.strokeStyle = "rgba(255,255,255,0.18)"; ctx.lineWidth = 0.7;
      ctx.beginPath(); ctx.roundRect?.(bx, by, bW, bH, 5) ?? ctx.rect(bx, by, bW, bH);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = ALGO_COLORS[id] ?? "#fff"; ctx.font = "bold 12px monospace";
      ctx.fillText(lines[0], bx + PAD, by + PAD + 8);
      ctx.fillStyle = "#ddd"; ctx.font = "11px monospace";
      lines.slice(1).forEach((line, i) => ctx.fillText(line, bx + PAD, by + PAD + 8 + (i + 1) * LINE_H));
    }

    hitRef.current = newHits;
  }, [stacks, ranges, drawnAlgos, rotX, rotY, zoom, project, tool, hoverInfo]);

  // ── Pointer interactions ────────────────────────────────────────────────
  const onMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (tool === "orbit") {
      e.preventDefault();
      dragRef.current = { startX: e.clientX, startY: e.clientY, startRx: rotX, startRy: rotY };
    }
  };
  const onMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (dragRef.current && tool === "orbit") {
      setRotY(dragRef.current.startRy + (e.clientX - dragRef.current.startX) * 0.5);
      setRotX(Math.max(-85, Math.min(85, dragRef.current.startRx - (e.clientY - dragRef.current.startY) * 0.5)));
      return;
    }
    if (tool === "measure") {
      const canvas = canvasRef.current!;
      const rect = canvas.getBoundingClientRect();
      const mx = (e.clientX - rect.left) * (canvas.width / rect.width);
      const my = (e.clientY - rect.top) * (canvas.height / rect.height);
      let best = null as typeof hitRef.current[0] | null, bestD = Infinity;
      for (const h of hitRef.current) {
        const d = Math.hypot(h.sx - mx, h.sy - my);
        if (d < bestD) { bestD = d; best = h; }
      }
      setHoverInfo(bestD < 22 ? best : null);
    }
  };
  const onMouseUp = () => { dragRef.current = null; };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      setZoom(z => Math.max(0.3, Math.min(4, z * (1 - e.deltaY * 0.0008))));
    };
    canvas.addEventListener("wheel", handler, { passive: false });
    return () => canvas.removeEventListener("wheel", handler);
  }, []);

  // Hotkeys — same convention as Chart3D. R = full reset; X/Y/Z snap to
  // axis-aligned views (preserving zoom so the user keeps their current
  // magnification). Only fires while the canvas is hovered.
  const isHoveredRef = useRef(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!isHoveredRef.current) return;
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || t?.isContentEditable) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === "r") {
        e.preventDefault();
        setRotX(28); setRotY(-40); setZoom(1);
        setTool("orbit"); setHoverInfo(null);
      } else if (k === "x") {
        e.preventDefault(); setRotX(0); setRotY(90);
      } else if (k === "y") {
        e.preventDefault(); setRotX(90); setRotY(0);
      } else if (k === "z") {
        e.preventDefault(); setRotX(0); setRotY(0);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Pinch + single-finger orbit (same as Chart3D).
  const pinchDistRef = useRef<number | null>(null);
  const onTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const ts = Array.from(e.touches);
    if (ts.length === 2) {
      pinchDistRef.current = Math.hypot(ts[1].clientX - ts[0].clientX, ts[1].clientY - ts[0].clientY);
      dragRef.current = null;
    } else if (ts.length === 1) {
      dragRef.current = { startX: ts[0].clientX, startY: ts[0].clientY, startRx: rotX, startRy: rotY };
      pinchDistRef.current = null;
    }
  };
  const onTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const ts = Array.from(e.touches);
    if (ts.length === 2 && pinchDistRef.current !== null) {
      const dist = Math.hypot(ts[1].clientX - ts[0].clientX, ts[1].clientY - ts[0].clientY);
      setZoom(z => Math.max(0.3, Math.min(4, z * (dist / pinchDistRef.current!))));
      pinchDistRef.current = dist;
    } else if (ts.length === 1 && dragRef.current) {
      const t = ts[0];
      setRotY(dragRef.current.startRy + (t.clientX - dragRef.current.startX) * 0.5);
      setRotX(Math.max(-85, Math.min(85, dragRef.current.startRx - (t.clientY - dragRef.current.startY) * 0.5)));
    }
  };
  const onTouchEnd = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length < 2) pinchDistRef.current = null;
    if (e.touches.length === 0) dragRef.current = null;
  };

  // Total stored count (across selected algos) for the "X of Y stored" hint.
  const totalStored = useMemo(() => {
    if (mode === "single") return focusAlgo ? (ghostRuns[focusAlgo]?.length ?? 0) : 0;
    return drawnAlgos.reduce((s, id) => Math.max(s, ghostRuns[id]?.length ?? 0), 0);
  }, [mode, focusAlgo, drawnAlgos, ghostRuns]);

  if (!ranges) return (
    <div style={{ height: 320, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-muted)", fontSize: 11, textAlign: "center", padding: 16 }}>
      Run a benchmark to populate the history.<br/>
      Each completed run adds one polyline; up to 100 are kept per algorithm.
    </div>
  );

  return (
    <div>
      {/* Top control row */}
      <div style={{ display: "flex", gap: 5, marginBottom: 8, alignItems: "center", flexWrap: "wrap" }}>
        {/* Mode toggle */}
        <div style={{ display: "flex", borderRadius: 4, overflow: "hidden", border: "1px solid var(--color-border)" }}>
          {(["all", "single"] as const).map(m => (
            <button key={m} onClick={() => setMode(m)} style={{
              padding: "2px 8px", fontSize: 9, cursor: "pointer", border: "none",
              background: mode === m ? "var(--color-accent)" : "var(--color-surface-1)",
              color: mode === m ? "#fff" : "var(--color-muted)",
              fontWeight: mode === m ? 600 : 400,
            }}>{m === "all" ? "All algos" : "Single algo"}</button>
          ))}
        </div>

        {/* Algo picker — only relevant in single-mode */}
        {mode === "single" && (
          <select
            value={focusAlgo ?? ""}
            onChange={e => setFocusAlgo(e.target.value || null)}
            style={{
              padding: "2px 6px", fontSize: 9, borderRadius: 4, cursor: "pointer",
              background: "var(--color-surface-1)", border: "1px solid var(--color-border)", color: "var(--color-text)",
            }}
          >
            {algos.map(id => (
              <option key={id} value={id} style={{ color: ALGO_COLORS[id] ?? "#888" }}>
                {ALGO_NAMES[id] ?? id}
              </option>
            ))}
          </select>
        )}

        {/* Tool toggle */}
        {([
          { id: "orbit"  , label: "⟳ Orbit",   title: "Drag to orbit · scroll/pinch to zoom" },
          { id: "measure", label: "⊕ Measure", title: "Hover over a point to inspect its n / time / space + run age" },
        ] as const).map(tb => (
          <button key={tb.id} onClick={() => setTool(tb.id)} title={tb.title} style={{
            padding: "2px 8px", fontSize: 9, borderRadius: 4, cursor: "pointer",
            background: tool === tb.id ? "var(--color-accent)" : "var(--color-surface-1)",
            border: `1px solid ${tool === tb.id ? "var(--color-accent)" : "var(--color-border)"}`,
            color: tool === tb.id ? "#fff" : "var(--color-muted)",
          }}>{tb.label}</button>
        ))}

        <button onClick={() => { setRotX(28); setRotY(-40); setZoom(1); }} style={{
          padding: "2px 8px", fontSize: 9, borderRadius: 4, cursor: "pointer",
          background: "var(--color-surface-1)", border: "1px solid var(--color-border)", color: "var(--color-muted)",
        }}>⟲ Reset view</button>
        <button onClick={() => {
          const c = canvasRef.current; if (!c) return;
          const a = document.createElement("a");
          a.href = c.toDataURL("image/png");
          a.download = "benchmark-3d-history.png";
          a.click();
        }} style={{
          padding: "2px 8px", fontSize: 9, borderRadius: 4, cursor: "pointer",
          background: "var(--color-surface-1)", border: "1px solid var(--color-border)", color: "var(--color-muted)",
        }}>↓ PNG</button>
      </div>

      {/* Show-last-N slider — this is the "visible cap" knob the user asked for.
          Storage cap stays at GHOST_MAX=100; this just gates how many render. */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 9, color: "var(--color-muted)", fontFamily: "monospace", minWidth: 86 }}>
          Show last <strong style={{ color: "var(--color-text)" }}>{visibleRuns}</strong>
        </span>
        <input
          type="range" min={1} max={100} step={1}
          value={visibleRuns}
          onChange={e => setVisibleRuns(parseInt(e.target.value, 10))}
          style={{ flex: 1, cursor: "pointer" }}
          title="How many of the most recent stored runs to draw. Storage cap is 100."
        />
        <span style={{ fontSize: 9, color: "var(--color-muted)", fontFamily: "monospace", minWidth: 64, textAlign: "right" }}>
          of {totalStored} stored
        </span>
      </div>

      <canvas
        ref={canvasRef} width={800} height={420}
        style={{ width: "100%", height: "auto", aspectRatio: "800 / 420", display: "block",
          touchAction: "none", userSelect: "none",
          cursor: tool === "orbit" ? (dragRef.current ? "grabbing" : "grab") : (hoverInfo ? "pointer" : "crosshair") }}
        onMouseDown={onMouseDown} onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseEnter={() => { isHoveredRef.current = true; }}
        onMouseLeave={() => { isHoveredRef.current = false; dragRef.current = null; setHoverInfo(null); }}
        onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
        onDragStart={e => e.preventDefault()}
      />

      <p style={{ fontSize: 8, color: "var(--color-muted)", fontFamily: "monospace", marginTop: 4 }}>
        each polyline = one completed run · newest at full brightness, oldest at ~5% · current run drawn thicker · drift right over time = slower · band widening over time = noisier
        <br/>
        <span title="Hover the chart, then press a hotkey">
          hover + <kbd style={kbdStyle}>R</kbd> reset · <kbd style={kbdStyle}>X</kbd>/<kbd style={kbdStyle}>Y</kbd>/<kbd style={kbdStyle}>Z</kbd> axis-aligned view
        </span>
      </p>
    </div>
  );
}

// ── Mathematical properties panel ──────────────────────────────────────────────
// Shows fitted equation, derivative (marginal cost), and cumulative work integral per algorithm.

// Skeleton preview of the right-pane sections that will appear after the benchmark runs.
// Each row is a labeled placeholder block showing the user what's coming:
//   - performance curve chart
//   - winner / rankings table
//   - per-algorithm mini cards
//   - mathematical / space complexity analysis
// The shimmer animation lives in globals.css (.cc-skeleton).
/*
 * LiveMemoryChart — time-series of V8 heap usage during a benchmark run.
 *
 * Sits under the performance curve in the right pane. Styled to mirror
 * CurveChart (same VW, padding, axes, polyline rendering) so the two read as a
 * matching pair. Polls performance.memory at 100ms intervals and tags each
 * sample with the algorithm that was running at the time. The chart renders
 * one polyline segment per algorithm in that algorithm's color, with vertical
 * boundary lines and labels at algorithm transitions.
 *
 * Live during a run; persisted after for review. Reset at the start of every
 * fresh run.
 */
type MemSample = {
  ts: number;           // ms since run started
  used: number;         // performance.memory.usedJSHeapSize
  total: number;        // performance.memory.totalJSHeapSize
  algoId: string | null;
  n: number | null;
};
function LiveMemoryChart({
  samples, currentAlgo, currentN, isRunning, curveData,
}: {
  samples: MemSample[];
  currentAlgo: string | null;
  currentN: number | null;
  isRunning: boolean;
  /** The benchmark's per-algo curve data. Used to surface ACTUAL measured aux
   *  (instrumented `allocBytes` and `performance.memory` `spaceBytes`) in the
   *  per-algorithm drill-in alongside the live-sampled heap delta. */
  curveData?: CurveData;
}) {
  // Layout — match CurveChart's VW so the two SVGs read as a pair.
  const VW = 600, VH = 200;
  const pL = 60, pR = 18, pT = 18, pB = 36;
  const iW = VW - pL - pR;
  const iH = VH - pT - pB;

  // Top-level view mode: combined timeline (default), per-algorithm drill-in,
  // or a stacked overlay where every algorithm's series is time-aligned to
  // start at 0s — useful for comparing memory-growth profiles head-to-head.
  const [view, setView] = useState<"timeline" | "perAlgo" | "stacked">("timeline");
  // Currently inspected algorithm in per-algo mode. Auto-selects the first
  // available algo when switching tabs if nothing is selected yet.
  const [focusAlgo, setFocusAlgo] = useState<string | null>(null);

  if (samples.length === 0) {
    return (
      <div className="rounded-xl p-4 mt-4" style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)" }}>
        <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--color-muted)" }}>
          Live memory usage
        </p>
        <p style={{ fontSize: 11, color: "var(--color-muted)", fontFamily: "monospace", fontStyle: "italic" }}>
          {isRunning ? "polling…" : "Run a benchmark to record heap usage over time."}
        </p>
      </div>
    );
  }

  const t0 = samples[0].ts;
  const tMax = samples[samples.length - 1].ts;
  const tRange = Math.max(1, tMax - t0);
  const usedMax = Math.max(...samples.map(s => s.used), 1);
  const totalMax = Math.max(...samples.map(s => s.total), 1);
  const yMax = Math.max(usedMax, totalMax);
  const usedMin = Math.min(...samples.map(s => s.used), 0);

  // Map sample time/value into chart space.
  const xAt = (t: number) => pL + ((t - t0) / tRange) * iW;
  const yAt = (v: number) => pT + iH - (v / yMax) * iH;

  // Group consecutive samples by algoId to build colored polyline segments.
  // We allow null algoId between sorts (idle gap) and skip those.
  type Segment = { algoId: string | null; pts: MemSample[] };
  const segments: Segment[] = [];
  let cur: Segment | null = null;
  for (const s of samples) {
    if (!cur || cur.algoId !== s.algoId) {
      cur = { algoId: s.algoId, pts: [s] };
      segments.push(cur);
    } else {
      cur.pts.push(s);
    }
  }

  // Y-axis ticks — 4 evenly spaced values from 0 → yMax.
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(f => ({ v: f * yMax, y: yAt(f * yMax) }));
  // X-axis ticks — show seconds elapsed.
  const xTickCount = 5;
  const xTicks = Array.from({ length: xTickCount }, (_, i) => {
    const t = t0 + (tRange * i) / (xTickCount - 1);
    return { t, x: xAt(t), label: `${((t - t0) / 1000).toFixed(1)}s` };
  });

  // Per-algo peak (max used while that algo was running).
  type AlgoStat = { id: string; color: string; peak: number; samples: number; lastN: number | null };
  const algoStatsMap = new Map<string, AlgoStat>();
  for (const s of samples) {
    if (!s.algoId) continue;
    const existing = algoStatsMap.get(s.algoId);
    if (existing) {
      existing.peak = Math.max(existing.peak, s.used);
      existing.samples++;
      if (s.n != null) existing.lastN = s.n;
    } else {
      algoStatsMap.set(s.algoId, {
        id: s.algoId,
        color: ALGO_COLORS[s.algoId] ?? "#888",
        peak: s.used,
        samples: 1,
        lastN: s.n,
      });
    }
  }
  const algoStats = [...algoStatsMap.values()].sort((a, b) => b.peak - a.peak);

  const currentSample = samples[samples.length - 1];

  return (
    <div className="rounded-xl p-4 mt-4" style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)" }}>
      <div className="flex items-center gap-2 mb-2">
        {isRunning && (
          <span style={{
            display: "inline-block", width: 8, height: 8, borderRadius: "50%",
            background: "var(--color-state-swap)",
            animation: "cc-pulse 1s steps(1, end) infinite",
          }} />
        )}
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-muted)", flex: 1 }}>
          Live memory usage
          {!isRunning && <span style={{ marginLeft: 6, opacity: 0.6, fontStyle: "italic", textTransform: "none", letterSpacing: 0 }}>(from last run)</span>}
        </p>
        {/* View tabs — Timeline · Per-algorithm · Stacked (time-aligned overlay) */}
        <div style={{ display: "inline-flex", borderRadius: 5, border: "1px solid var(--color-border)", overflow: "hidden" }}>
          {(["timeline", "perAlgo", "stacked"] as const).map((v, i) => (
            <button
              key={v}
              onClick={() => {
                setView(v);
                if (v === "perAlgo" && !focusAlgo && algoStats.length > 0) {
                  setFocusAlgo(algoStats[0].id);
                }
              }}
              style={{
                padding: "3px 10px", fontSize: 10, fontFamily: "monospace",
                cursor: "pointer", border: "none",
                borderLeft: i > 0 ? "1px solid var(--color-border)" : "none",
                background: view === v ? "var(--color-accent)" : "transparent",
                color: view === v ? "#fff" : "var(--color-muted)",
                fontWeight: view === v ? 600 : 400,
              }}
            >
              {v === "timeline" ? "Timeline" : v === "perAlgo" ? "Per-algorithm" : "Stacked @ 0s"}
            </button>
          ))}
        </div>
      </div>

      {/* ───── Timeline view (combined, all algos) ─────────────────────────── */}
      {view === "timeline" && <>
      {/* Big real-time figures */}
      <div className="flex flex-wrap gap-4 mb-3" style={{ fontFamily: "monospace" }}>
        <div>
          <p style={{ fontSize: 9, color: "var(--color-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>current used</p>
          <p style={{ fontSize: 16, fontWeight: 700, color: "var(--color-accent)" }}>{fmtBytes(currentSample.used)}</p>
        </div>
        <div>
          <p style={{ fontSize: 9, color: "var(--color-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>current total</p>
          <p style={{ fontSize: 16, fontWeight: 700, color: "#ffb74d" }}>{fmtBytes(currentSample.total)}</p>
        </div>
        <div>
          <p style={{ fontSize: 9, color: "var(--color-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>peak used</p>
          <p style={{ fontSize: 16, fontWeight: 700, color: "var(--color-text)" }}>{fmtBytes(usedMax)}</p>
        </div>
        <div>
          <p style={{ fontSize: 9, color: "var(--color-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>elapsed</p>
          <p style={{ fontSize: 16, fontWeight: 700, color: "var(--color-text)" }}>{((tMax - t0) / 1000).toFixed(1)}s</p>
        </div>
        {currentAlgo && isRunning && (
          <div style={{ marginLeft: "auto", textAlign: "right" }}>
            <p style={{ fontSize: 9, color: "var(--color-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>now sorting</p>
            <p style={{ fontSize: 13, fontWeight: 700, color: ALGO_COLORS[currentAlgo] ?? "var(--color-text)" }}>
              {ALGO_NAMES[currentAlgo] ?? currentAlgo}
              {currentN != null && <span style={{ fontSize: 11, fontWeight: 400, opacity: 0.7 }}> · n={currentN.toLocaleString()}</span>}
            </p>
          </div>
        )}
      </div>

      {/* SVG chart — same VW / padding as CurveChart so the two read as a pair */}
      <svg viewBox={`0 0 ${VW} ${VH}`} preserveAspectRatio="none" style={{ width: "100%", height: "auto", display: "block" }}>
        {/* Plot background */}
        <rect x={pL} y={pT} width={iW} height={iH} fill="var(--color-surface-1)" />

        {/* Y-axis grid + labels */}
        {yTicks.map((t, i) => (
          <g key={`y${i}`}>
            <line x1={pL} y1={t.y} x2={pL + iW} y2={t.y} stroke="var(--color-border)" strokeWidth={0.5} opacity={0.5} />
            <text x={pL - 6} y={t.y + 3} textAnchor="end" fontSize={8.5} fontFamily="monospace" fill="var(--color-muted)">
              {fmtBytes(t.v)}
            </text>
          </g>
        ))}

        {/* X-axis ticks + labels */}
        {xTicks.map((t, i) => (
          <g key={`x${i}`}>
            <line x1={t.x} y1={pT + iH} x2={t.x} y2={pT + iH + 3} stroke="var(--color-border)" strokeWidth={0.5} />
            <text x={t.x} y={pT + iH + 14} textAnchor="middle" fontSize={8.5} fontFamily="monospace" fill="var(--color-muted)">
              {t.label}
            </text>
          </g>
        ))}
        <text x={pL + iW / 2} y={VH - 3} textAnchor="middle" fontSize={8} fontFamily="monospace" fill="var(--color-muted)" opacity={0.7}>
          time elapsed
        </text>

        {/* Total-heap line (faint, behind used) */}
        {samples.length >= 2 && (
          <polyline
            fill="none"
            stroke="#ffb74d"
            strokeWidth={1}
            strokeDasharray="2 3"
            opacity={0.6}
            points={samples.map(s => `${xAt(s.ts).toFixed(1)},${yAt(s.total).toFixed(1)}`).join(" ")}
          />
        )}

        {/* Per-algo used-heap polylines, one segment per consecutive run */}
        {segments.map((seg, i) => {
          if (seg.pts.length < 2) return null;
          const color = seg.algoId ? (ALGO_COLORS[seg.algoId] ?? "#888") : "var(--color-muted)";
          return (
            <polyline
              key={`seg-${i}`}
              fill="none"
              stroke={color}
              strokeWidth={2}
              opacity={seg.algoId ? 0.95 : 0.4}
              points={seg.pts.map(s => `${xAt(s.ts).toFixed(1)},${yAt(s.used).toFixed(1)}`).join(" ")}
            />
          );
        })}

        {/* Algorithm-transition vertical guides + labels */}
        {(() => {
          const transitions: { ts: number; algoId: string }[] = [];
          for (let i = 1; i < samples.length; i++) {
            if (samples[i].algoId && samples[i].algoId !== samples[i - 1].algoId) {
              transitions.push({ ts: samples[i].ts, algoId: samples[i].algoId! });
            }
          }
          // Always mark the first algo too
          if (samples[0].algoId) transitions.unshift({ ts: samples[0].ts, algoId: samples[0].algoId });
          return transitions.map((tr, i) => {
            const x = xAt(tr.ts);
            const color = ALGO_COLORS[tr.algoId] ?? "#888";
            const label = (ALGO_NAMES[tr.algoId] ?? tr.algoId).replace(" Sort", "");
            return (
              <g key={`tr-${i}`} style={{ pointerEvents: "none" }}>
                <line x1={x} y1={pT} x2={x} y2={pT + iH} stroke={color} strokeWidth={0.5} strokeDasharray="2 3" opacity={0.4} />
                <text x={x + 2} y={pT + 8} fontSize={7} fontFamily="monospace" fill={color} opacity={0.85}>
                  {label}
                </text>
              </g>
            );
          });
        })()}

        {/* Current position marker (last sample) */}
        {samples.length > 0 && (() => {
          const last = samples[samples.length - 1];
          const cx = xAt(last.ts);
          const cy = yAt(last.used);
          const color = last.algoId ? (ALGO_COLORS[last.algoId] ?? "#888") : "var(--color-muted)";
          return (
            <g style={{ pointerEvents: "none" }}>
              {isRunning && (
                <circle cx={cx} cy={cy} r={5} fill="none" stroke={color} strokeWidth={1.5} opacity={0.5}>
                  <animate attributeName="r" values="5;9;5" dur="1.2s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.5;0;0.5" dur="1.2s" repeatCount="indefinite" />
                </circle>
              )}
              <circle cx={cx} cy={cy} r={3} fill={color} stroke="var(--color-surface-1)" strokeWidth={1.5} />
            </g>
          );
        })()}
      </svg>

      </>}

      {/* Algorithm picker — clickable chips. Shown in BOTH views so the user
          can switch focus without leaving the per-algorithm tab. Clicking a
          chip switches to per-algorithm view (or just changes focus if
          already there). */}
      {algoStats.length > 0 && (
        <div className="mt-3" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 6 }}>
          {algoStats.map(a => {
            const isFocused = view === "perAlgo" && focusAlgo === a.id;
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => {
                  setFocusAlgo(a.id);
                  if (view !== "perAlgo") setView("perAlgo");
                }}
                title={`Inspect ${ALGO_NAMES[a.id] ?? a.id} in the Per-algorithm tab`}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "4px 8px", borderRadius: 5,
                  background: isFocused ? `${a.color}26` /* ~15% */ : "var(--color-surface-1)",
                  border: `1px solid ${isFocused ? a.color : "var(--color-border)"}`,
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "background 0.15s, border-color 0.15s",
                }}
              >
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: a.color, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 10, fontFamily: "monospace", color: "var(--color-text)", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {ALGO_NAMES[a.id] ?? a.id}
                  </p>
                  <p style={{ fontSize: 9, fontFamily: "monospace", color: "var(--color-muted)" }}>
                    peak <span style={{ color: a.color, fontWeight: 600 }}>{fmtBytes(a.peak)}</span>
                    {a.lastN != null && <span style={{ opacity: 0.7 }}> @ n={fmtN(a.lastN)}</span>}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* ───── Stacked view — every algorithm's series time-aligned to 0s ──── */}
      {view === "stacked" && (() => {
        // Group all samples by algoId, sorted by ts. Each algo's run-window is
        // re-baselined so its first sample sits at t=0s; the y-value is the
        // delta from that algo's own starting heap, so memory-growth shapes
        // overlay cleanly regardless of how high the global heap had drifted.
        const byAlgo = new Map<string, MemSample[]>();
        for (const s of samples) {
          if (!s.algoId) continue;
          const arr = byAlgo.get(s.algoId);
          if (arr) arr.push(s); else byAlgo.set(s.algoId, [s]);
        }
        const series = [...byAlgo.entries()]
          .map(([id, arr]) => {
            const sorted = [...arr].sort((a, b) => a.ts - b.ts);
            const t0a = sorted[0].ts;
            const used0 = sorted[0].used;
            const pts = sorted.map(s => ({ t: s.ts - t0a, d: s.used - used0 }));
            return { id, color: ALGO_COLORS[id] ?? "#888", pts };
          })
          .filter(s => s.pts.length > 1);

        if (series.length === 0) {
          return (
            <p style={{ fontSize: 11, color: "var(--color-muted)", marginTop: 12, fontFamily: "monospace", fontStyle: "italic" }}>
              Not enough samples yet — algorithms need at least two memory samples each.
            </p>
          );
        }

        const xMax = Math.max(...series.flatMap(s => s.pts.map(p => p.t))) || 1;
        const dMin = Math.min(0, ...series.flatMap(s => s.pts.map(p => p.d)));
        const dMax = Math.max(0, ...series.flatMap(s => s.pts.map(p => p.d)));
        const dRange = Math.max(1, dMax - dMin);
        const sxS = (t: number) => pL + (t / xMax) * iW;
        const syS = (d: number) => pT + iH - ((d - dMin) / dRange) * iH;

        // Axes: 5 ticks each.
        const yTicksS = [0, 0.25, 0.5, 0.75, 1].map(f => {
          const v = dMin + f * dRange;
          return { v, y: syS(v) };
        });
        const xTicksS = Array.from({ length: 5 }, (_, i) => {
          const t = (xMax * i) / 4;
          return { t, x: sxS(t), label: `${(t / 1000).toFixed(2)}s` };
        });

        return (
          <div className="mt-2">
            <p className="text-xs mb-2" style={{ color: "var(--color-muted)", fontFamily: "monospace" }}>
              Each algorithm&apos;s window re-zeroed to t=0s; y = heap growth from that algorithm&apos;s starting point.
            </p>
            <svg viewBox={`0 0 ${VW} ${VH}`} preserveAspectRatio="none" style={{ width: "100%", height: "auto", display: "block" }}>
              <rect x={pL} y={pT} width={iW} height={iH} fill="var(--color-surface-1)" />
              {yTicksS.map((tk, i) => (
                <g key={`yS${i}`}>
                  <line x1={pL} y1={tk.y} x2={pL + iW} y2={tk.y} stroke="var(--color-border)" strokeWidth={0.5} opacity={0.5} />
                  <text x={pL - 6} y={tk.y + 3} textAnchor="end" fontSize={8.5} fontFamily="monospace" fill="var(--color-muted)">
                    {tk.v > 0 ? "+" : ""}{fmtBytes(tk.v)}
                  </text>
                </g>
              ))}
              {xTicksS.map((tk, i) => (
                <g key={`xS${i}`}>
                  <line x1={tk.x} y1={pT + iH} x2={tk.x} y2={pT + iH + 3} stroke="var(--color-border)" strokeWidth={0.5} />
                  <text x={tk.x} y={pT + iH + 14} textAnchor="middle" fontSize={8.5} fontFamily="monospace" fill="var(--color-muted)">{tk.label}</text>
                </g>
              ))}
              {/* Zero-Δ reference line */}
              {dMin < 0 && dMax > 0 && (
                <line x1={pL} y1={syS(0)} x2={pL + iW} y2={syS(0)} stroke="var(--color-muted)" strokeWidth={0.75} strokeDasharray="3 3" opacity={0.5} />
              )}
              {/* One colored polyline per algorithm */}
              {series.map(s => {
                const d = `M${s.pts.map(p => `${sxS(p.t).toFixed(1)},${syS(p.d).toFixed(1)}`).join(" L")}`;
                return (
                  <g key={s.id}>
                    <path d={d} fill="none" stroke={s.color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
                    <circle cx={sxS(s.pts[s.pts.length - 1].t)} cy={syS(s.pts[s.pts.length - 1].d)} r={2.2} fill={s.color} />
                  </g>
                );
              })}
            </svg>
            {/* Legend with each algo's peak delta */}
            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2" style={{ fontFamily: "monospace", fontSize: 10 }}>
              {series.map(s => {
                const peakD = Math.max(...s.pts.map(p => p.d));
                const dur = s.pts[s.pts.length - 1].t;
                return (
                  <span key={s.id} className="inline-flex items-center gap-1" title={`${ALGO_NAMES[s.id] ?? s.id}: ran ${(dur/1000).toFixed(2)}s, peak Δ ${fmtBytes(peakD)}`}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: s.color, display: "inline-block" }} />
                    <span style={{ color: "var(--color-text)" }}>{ALGO_NAMES[s.id] ?? s.id}</span>
                    <span style={{ color: "var(--color-muted)" }}>
                      {(dur/1000).toFixed(2)}s · peak {peakD >= 0 ? "+" : ""}{fmtBytes(peakD)}
                    </span>
                  </span>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* ───── Per-algorithm view (drill-in) ──────────────────────────────── */}
      {view === "perAlgo" && (() => {
        if (!focusAlgo || algoStats.length === 0) {
          return (
            <p style={{ fontSize: 11, color: "var(--color-muted)", marginTop: 12, fontFamily: "monospace", fontStyle: "italic" }}>
              Select an algorithm above to drill in.
            </p>
          );
        }
        // Filter samples to just this algorithm
        const algoSamples = samples.filter(s => s.algoId === focusAlgo);
        if (algoSamples.length === 0) {
          return (
            <p style={{ fontSize: 11, color: "var(--color-muted)", marginTop: 12, fontFamily: "monospace", fontStyle: "italic" }}>
              No samples recorded for {ALGO_NAMES[focusAlgo] ?? focusAlgo} yet.
            </p>
          );
        }
        const color = ALGO_COLORS[focusAlgo] ?? "#888";
        const aStart = algoSamples[0];
        const aEnd   = algoSamples[algoSamples.length - 1];
        const aPeak  = algoSamples.reduce((m, s) => Math.max(m, s.used), 0);
        const aPeakDelta = aPeak - aStart.used;
        const aEndDelta  = aEnd.used - aStart.used;
        const duration = (aEnd.ts - aStart.ts) / 1000;

        // Sub-segment by n (each (algo, n) window separately).
        type NWindow = { n: number | null; samples: MemSample[]; peak: number; peakDelta: number; duration: number };
        const nWindows: NWindow[] = [];
        let cur: NWindow | null = null;
        for (const s of algoSamples) {
          if (!cur || cur.n !== s.n) {
            cur = { n: s.n, samples: [s], peak: s.used, peakDelta: 0, duration: 0 };
            nWindows.push(cur);
          } else {
            cur.samples.push(s);
            if (s.used > cur.peak) cur.peak = s.used;
          }
        }
        for (const w of nWindows) {
          w.peakDelta = w.peak - w.samples[0].used;
          w.duration = (w.samples[w.samples.length - 1].ts - w.samples[0].ts) / 1000;
        }

        // Look up actual measured aux from the benchmark's curveData. We prefer
        // the instrumented byte count (`allocBytes`) because it's deterministic;
        // fall back to `performance.memory` heap delta if instrumentation didn't
        // capture (e.g., the algo uses TypedArray which the patcher doesn't see).
        const maxN = Math.max(...nWindows.map(w => w.n ?? 0));
        const algoCurvePts = curveData?.[focusAlgo] ?? [];
        const lookupActual = (n: number | null): { measured: number | null; source: "alloc" | "heap" | null } => {
          if (n == null) return { measured: null, source: null };
          const pt = algoCurvePts.find(p => p.n === n);
          if (!pt) return { measured: null, source: null };
          if (pt.allocBytes != null && pt.allocBytes > 0) return { measured: pt.allocBytes, source: "alloc" };
          if (pt.spaceBytes != null && pt.spaceBytes > 0) return { measured: pt.spaceBytes, source: "heap" };
          return { measured: null, source: null };
        };
        const headlineActual = lookupActual(maxN);
        const theoreticalAux = maxN > 0 ? theoreticalSpaceBytes(focusAlgo, maxN) : 0;
        // In-place verdict from aux ÷ n. Instrumented allocBytes is the
        // authoritative signal; heapDeltaBytes (only set when a REAL heap
        // delta was observed, never theoretical fallback) backstops the
        // instrumentation's blind spots (spread, engine-internal scratch).
        const verdictPt = algoCurvePts.find(p => p.n === maxN);
        const verdict = inPlaceVerdict(verdictPt?.allocBytes, verdictPt?.heapDeltaBytes, maxN);

        // Isolated chart for just this algo
        const localT0 = aStart.ts;
        const localTRange = Math.max(1, aEnd.ts - aStart.ts);
        const localUsedMin = Math.min(...algoSamples.map(s => s.used));
        const localUsedMax = Math.max(...algoSamples.map(s => s.used));
        const localYMin = localUsedMin;
        const localYMax = Math.max(localUsedMax, localYMin + 1);
        const xAtLocal = (t: number) => pL + ((t - localT0) / localTRange) * iW;
        const yAtLocal = (v: number) => pT + iH - ((v - localYMin) / (localYMax - localYMin)) * iH;

        const localYTicks = [0, 0.25, 0.5, 0.75, 1].map(f => {
          const v = localYMin + f * (localYMax - localYMin);
          return { v, y: yAtLocal(v) };
        });
        const localXTicks = Array.from({ length: 5 }, (_, i) => {
          const t = localT0 + (localTRange * i) / 4;
          return { x: xAtLocal(t), label: `${((t - localT0) / 1000).toFixed(2)}s` };
        });

        return (
          <div className="mt-2">
            {/* Header for the drill-in */}
            <div className="flex items-center gap-2 mb-3">
              <span style={{ width: 10, height: 10, borderRadius: "50%", background: color, flexShrink: 0 }} />
              <p style={{ fontSize: 13, fontWeight: 700, color: "var(--color-text)" }}>
                {ALGO_NAMES[focusAlgo] ?? focusAlgo}
              </p>
              {verdict && (
                <span
                  title={verdict.title}
                  style={{ fontSize: 9, fontFamily: "monospace", fontWeight: 700, padding: "1px 7px", borderRadius: 10, background: verdict.bg, color: verdict.color, cursor: "help" }}
                >
                  {verdict.label}
                </span>
              )}
              <span style={{ fontSize: 9, fontFamily: "monospace", color: "var(--color-muted)", marginLeft: "auto" }}>
                {algoSamples.length.toLocaleString()} samples · {duration.toFixed(2)}s on-CPU
              </span>
            </div>

            {/* Detail stats */}
            <div className="flex flex-wrap gap-4 mb-3" style={{ fontFamily: "monospace" }}>
              <div>
                <p style={{ fontSize: 9, color: "var(--color-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>start heap</p>
                <p style={{ fontSize: 14, fontWeight: 700, color: "var(--color-text)" }}>{fmtBytes(aStart.used)}</p>
              </div>
              <div>
                <p style={{ fontSize: 9, color: "var(--color-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>peak heap</p>
                <p style={{ fontSize: 14, fontWeight: 700, color }}>{fmtBytes(aPeak)}</p>
              </div>
              <div>
                <p style={{ fontSize: 9, color: "var(--color-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>end heap</p>
                <p style={{ fontSize: 14, fontWeight: 700, color: "var(--color-text)" }}>{fmtBytes(aEnd.used)}</p>
              </div>
              <div>
                <p style={{ fontSize: 9, color: "var(--color-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>peak Δ</p>
                <p style={{ fontSize: 14, fontWeight: 700, color: aPeakDelta > 0 ? "#ffb74d" : "var(--color-muted)" }}>
                  {aPeakDelta > 0 ? "+" : ""}{fmtBytes(aPeakDelta)}
                </p>
              </div>
              <div>
                <p style={{ fontSize: 9, color: "var(--color-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>end Δ</p>
                <p style={{ fontSize: 14, fontWeight: 700, color: aEndDelta >= 0 ? "var(--color-text)" : "#7ec88a" }}>
                  {aEndDelta >= 0 ? "+" : ""}{fmtBytes(aEndDelta)}
                </p>
              </div>
              <div>
                <p style={{ fontSize: 9, color: "var(--color-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  actual aux @ n={fmtN(maxN)}
                  {headlineActual.source && (
                    <span style={{ marginLeft: 4, fontSize: 7, opacity: 0.7 }}>
                      ({headlineActual.source === "alloc" ? "instr." : "heap"})
                    </span>
                  )}
                </p>
                <p style={{ fontSize: 14, fontWeight: 700, color: headlineActual.measured != null ? color : "var(--color-muted)" }}>
                  {headlineActual.measured != null ? fmtBytes(headlineActual.measured) : "—"}
                </p>
                <p style={{ fontSize: 8, color: "var(--color-muted)", fontFamily: "monospace", marginTop: 1 }}>
                  theoretical {fmtBytes(theoreticalAux)}
                </p>
              </div>
            </div>

            {/* Zoomed-in chart of just this algorithm's samples */}
            <svg viewBox={`0 0 ${VW} ${VH}`} preserveAspectRatio="none" style={{ width: "100%", height: "auto", display: "block" }}>
              <rect x={pL} y={pT} width={iW} height={iH} fill="var(--color-surface-1)" />
              {localYTicks.map((t, i) => (
                <g key={`yL${i}`}>
                  <line x1={pL} y1={t.y} x2={pL + iW} y2={t.y} stroke="var(--color-border)" strokeWidth={0.5} opacity={0.5} />
                  <text x={pL - 6} y={t.y + 3} textAnchor="end" fontSize={8.5} fontFamily="monospace" fill="var(--color-muted)">{fmtBytes(t.v)}</text>
                </g>
              ))}
              {localXTicks.map((t, i) => (
                <g key={`xL${i}`}>
                  <line x1={t.x} y1={pT + iH} x2={t.x} y2={pT + iH + 3} stroke="var(--color-border)" strokeWidth={0.5} />
                  <text x={t.x} y={pT + iH + 14} textAnchor="middle" fontSize={8.5} fontFamily="monospace" fill="var(--color-muted)">{t.label}</text>
                </g>
              ))}
              <text x={pL + iW / 2} y={VH - 3} textAnchor="middle" fontSize={8} fontFamily="monospace" fill="var(--color-muted)" opacity={0.7}>
                time on {ALGO_NAMES[focusAlgo] ?? focusAlgo}
              </text>

              {/* n-window vertical guides + labels */}
              {nWindows.length > 1 && nWindows.map((w, i) => {
                if (!w.n) return null;
                const x = xAtLocal(w.samples[0].ts);
                return (
                  <g key={`nw-${i}`}>
                    <line x1={x} y1={pT} x2={x} y2={pT + iH} stroke={color} strokeWidth={0.5} strokeDasharray="2 3" opacity={0.45} />
                    <text x={x + 2} y={pT + 8} fontSize={7} fontFamily="monospace" fill={color} opacity={0.85}>
                      n={fmtN(w.n)}
                    </text>
                  </g>
                );
              })}

              {/* Polyline of used heap */}
              {algoSamples.length >= 2 && (
                <polyline
                  fill="none" stroke={color} strokeWidth={2}
                  points={algoSamples.map(s => `${xAtLocal(s.ts).toFixed(1)},${yAtLocal(s.used).toFixed(1)}`).join(" ")}
                />
              )}
            </svg>

            {/* Per-n breakdown table */}
            {nWindows.length > 0 && (
              <div className="mt-3">
                <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--color-muted)" }}>
                  Per-n breakdown
                </p>
                <table style={{ fontSize: 10, fontFamily: "monospace", borderCollapse: "collapse", width: "100%" }}>
                  <thead>
                    <tr style={{ color: "var(--color-muted)" }}>
                      {[
                        { h: "n",                  align: "left"  as const, tip: undefined },
                        { h: "samples",            align: "right" as const, tip: "Number of 100 ms memory samples captured while this (algo, n) was running" },
                        { h: "duration",           align: "right" as const, tip: "Wall-clock time the algorithm spent at this n (live-sampled)" },
                        { h: "peak heap Δ",        align: "right" as const, tip: "ACTUAL live-sampled heap growth during this window (peak − start)" },
                        { h: "measured aux",       align: "right" as const, tip: "ACTUAL aux memory from the dedicated space-measurement pass (instrumented Array.method byte count when available, else performance.memory heap delta)" },
                        { h: "theoretical",        align: "right" as const, tip: "Predicted aux derived from the algorithm's space complexity class — reference only" },
                      ].map(({ h, align, tip }) => (
                        <th key={h} title={tip} style={{ textAlign: align, padding: "3px 6px", borderBottom: "1px solid var(--color-border)", fontWeight: 400 }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {nWindows.map((w, i) => {
                      const theo = w.n ? theoreticalSpaceBytes(focusAlgo, w.n) : 0;
                      const actual = lookupActual(w.n);
                      return (
                        <tr key={i}>
                          <td style={{ padding: "3px 6px", color: "var(--color-text)" }}>{w.n != null ? fmtN(w.n) : "—"}</td>
                          <td style={{ padding: "3px 6px", textAlign: "right", color: "var(--color-text)" }}>{w.samples.length.toLocaleString()}</td>
                          <td style={{ padding: "3px 6px", textAlign: "right", color: "var(--color-text)" }}>{w.duration.toFixed(2)}s</td>
                          <td style={{ padding: "3px 6px", textAlign: "right", color: w.peakDelta > 0 ? "#ffb74d" : "var(--color-muted)" }}
                            title="Live-sampled heap delta (peak − start) during this window — actual">
                            {w.peakDelta > 0 ? "+" : ""}{fmtBytes(w.peakDelta)}
                          </td>
                          <td style={{ padding: "3px 6px", textAlign: "right", color: actual.measured != null ? color : "var(--color-muted)" }}
                            title={actual.source === "alloc"
                              ? "Instrumented byte count via patched Array methods — actual"
                              : actual.source === "heap"
                                ? "performance.memory heap delta from dedicated space pass — actual"
                                : "No measurement captured at this n yet"}>
                            {actual.measured != null
                              ? <>{fmtBytes(actual.measured)}<span style={{ opacity: 0.5, fontSize: 8, marginLeft: 3 }}>{actual.source === "alloc" ? "i" : "h"}</span></>
                              : "—"}
                          </td>
                          <td style={{ padding: "3px 6px", textAlign: "right", color: "var(--color-muted)", opacity: 0.7 }}>{fmtBytes(theo)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <p style={{ fontSize: 9, color: "var(--color-muted)", fontFamily: "monospace", marginTop: 4, fontStyle: "italic" }}>
                  <span style={{ color }}>i</span> = instrumented (patched Array methods, deterministic)
                  {" · "}
                  <span style={{ color }}>h</span> = heap delta (<code>performance.memory</code>, ~1MB resolution)
                </p>
              </div>
            )}
          </div>
        );
      })()}

      <p style={{ fontSize: 9, color: "var(--color-muted)", marginTop: 8, lineHeight: 1.4, fontStyle: "italic" }}>
        Used (solid) and total (dashed) heap from <code>performance.memory</code> sampled at 100 ms. V8/Chromium only · ~1 MB resolution · post-GC snapshot.
      </p>
    </div>
  );
}

// Legacy left-pane dashboard — kept here only in case anything imports it.
// The active live-memory UI is LiveMemoryChart, rendered under the curve.
function MemoryDashboard({
  currentAlgo, currentN, progress, dataType,
}: {
  currentAlgo: string | null;
  currentN: number | null;
  progress: { done: number; total: number };
  dataType: DataType;
}) {
  type MemSnap = { used: number; total: number; limit: number };
  const [snap, setSnap] = useState<MemSnap | null>(null);
  const [history, setHistory] = useState<number[]>([]);
  const [supported, setSupported] = useState<boolean | null>(null);

  useEffect(() => {
    const tick = () => {
      const perf = performance as unknown as { memory?: { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number } };
      if (perf.memory && typeof perf.memory.usedJSHeapSize === "number") {
        setSupported(true);
        const s = { used: perf.memory.usedJSHeapSize, total: perf.memory.totalJSHeapSize, limit: perf.memory.jsHeapSizeLimit };
        setSnap(s);
        setHistory(h => {
          const next = h.length >= 100 ? [...h.slice(1), s.used] : [...h, s.used];
          return next;
        });
      } else {
        setSupported(false);
      }
    };
    tick();
    const id = setInterval(tick, 100);
    return () => clearInterval(id);
  }, []);

  const theoreticalAux = currentAlgo && currentN ? theoreticalSpaceBytes(currentAlgo, currentN) : 0;
  // Element width heuristic: numbers ≈ 8 bytes (PACKED_DOUBLE), strings ≈ 32 bytes
  // (UTF-16 + JS string overhead) for typical fixed-length test strings.
  const elemBytes = dataType === "string" ? 32 : 8;
  const inputBytes = currentN ? currentN * elemBytes : 0;
  const totalExpected = inputBytes + theoreticalAux;

  // Sparkline range — auto-scales to the visible history so the line uses the full vertical space.
  const sparkMin = history.length > 0 ? Math.min(...history) : 0;
  const sparkMax = history.length > 0 ? Math.max(...history) : 1;
  const sparkRange = Math.max(1, sparkMax - sparkMin);

  return (
    <div
      className="rounded-xl p-4 flex flex-col gap-4"
      style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)" }}
    >
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span style={{
            display: "inline-block", width: 8, height: 8, borderRadius: "50%",
            background: "var(--color-state-swap)",
            animation: "cc-pulse 1s steps(1, end) infinite",
          }} />
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-muted)" }}>
            Live memory — benchmark running
          </p>
        </div>
        <p style={{ fontSize: 14, fontWeight: 700, color: "var(--color-text)", marginTop: 4 }}>
          {currentAlgo ? (ALGO_NAMES[currentAlgo] ?? currentAlgo) : "…"}
        </p>
        <p style={{ fontSize: 11, fontFamily: "monospace", color: "var(--color-muted)", marginTop: 2 }}>
          n = {currentN?.toLocaleString() ?? "…"}
          {" · "}
          <span style={{ color: "var(--color-text)" }}>{progress.done}/{progress.total}</span>
          {progress.total > 0 && (
            <span style={{ opacity: 0.7 }}> ({Math.round((progress.done / progress.total) * 100)}%)</span>
          )}
          {" · "}
          <span style={{ color: "var(--color-accent)" }}>{dataType}</span>
        </p>
      </div>

      {/* Live heap snapshot (V8 only) */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--color-muted)" }}>
          V8 JS heap
        </p>
        {supported === false ? (
          <p style={{ fontSize: 10, fontFamily: "monospace", color: "var(--color-muted)", fontStyle: "italic" }}>
            performance.memory unavailable — V8/Chromium only.
          </p>
        ) : snap ? (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", gap: "3px 10px", fontSize: 11, fontFamily: "monospace", alignItems: "center" }}>
              <span style={{ color: "var(--color-muted)" }}>used</span>
              <div style={{ height: 7, borderRadius: 3, background: "var(--color-surface-3)", overflow: "hidden" }}>
                <div style={{
                  height: "100%", width: `${Math.min(100, (snap.used / snap.limit) * 100)}%`,
                  background: "var(--color-accent)", transition: "width 0.1s linear",
                }} />
              </div>
              <span style={{ color: "var(--color-text)", whiteSpace: "nowrap" }}>{fmtBytes(snap.used)}</span>

              <span style={{ color: "var(--color-muted)" }}>total</span>
              <div style={{ height: 7, borderRadius: 3, background: "var(--color-surface-3)", overflow: "hidden" }}>
                <div style={{
                  height: "100%", width: `${Math.min(100, (snap.total / snap.limit) * 100)}%`,
                  background: "#ffb74d", opacity: 0.7, transition: "width 0.1s linear",
                }} />
              </div>
              <span style={{ color: "var(--color-text)", whiteSpace: "nowrap" }}>{fmtBytes(snap.total)}</span>

              <span style={{ color: "var(--color-muted)" }}>limit</span>
              <div style={{ height: 7, borderRadius: 3, background: "var(--color-surface-3)" }} />
              <span style={{ color: "var(--color-text)", whiteSpace: "nowrap" }}>{fmtBytes(snap.limit)}</span>
            </div>

            {/* Sparkline of last ~100 samples */}
            <div style={{ marginTop: 8 }}>
              <p style={{ fontSize: 8, fontFamily: "monospace", color: "var(--color-muted)", marginBottom: 2 }}>
                Used heap · last {history.length} samples · range {fmtBytes(sparkMin)} – {fmtBytes(sparkMax)}
              </p>
              <svg viewBox="0 0 200 36" preserveAspectRatio="none" style={{ width: "100%", height: 36, display: "block" }}>
                {history.length >= 2 && (
                  <polyline
                    fill="none"
                    stroke="var(--color-accent)"
                    strokeWidth={1.5}
                    points={history.map((v, i) => {
                      const x = (i / Math.max(1, history.length - 1)) * 200;
                      const y = 34 - ((v - sparkMin) / sparkRange) * 32;
                      return `${x.toFixed(1)},${y.toFixed(1)}`;
                    }).join(" ")}
                  />
                )}
                <line x1={0} y1={35} x2={200} y2={35} stroke="var(--color-border)" strokeWidth={0.5} />
              </svg>
            </div>
          </>
        ) : (
          <p style={{ fontSize: 10, fontFamily: "monospace", color: "var(--color-muted)" }}>polling…</p>
        )}
      </div>

      {/* Theoretical breakdown for the active (algo, n) */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--color-muted)" }}>
          Theoretical footprint @ n = {currentN?.toLocaleString() ?? "…"}
        </p>
        <table style={{ fontSize: 11, fontFamily: "monospace", borderCollapse: "collapse", width: "100%" }}>
          <tbody>
            <tr>
              <td style={{ padding: "2px 5px", color: "var(--color-muted)", width: "40%" }}>
                input array
                <span style={{ fontSize: 9, opacity: 0.7, marginLeft: 4 }}>(n × {elemBytes}B)</span>
              </td>
              <td style={{ padding: "2px 5px", color: "var(--color-text)", textAlign: "right" }}>{fmtBytes(inputBytes)}</td>
            </tr>
            <tr>
              <td style={{ padding: "2px 5px", color: "var(--color-muted)", borderTop: "1px solid var(--color-border)" }}>
                aux ({currentAlgo ? (ALGO_SPACE[currentAlgo] ?? "—") : "—"})
              </td>
              <td style={{ padding: "2px 5px", color: "var(--color-text)", textAlign: "right", borderTop: "1px solid var(--color-border)" }}>
                {fmtBytes(theoreticalAux)}
              </td>
            </tr>
            <tr>
              <td style={{ padding: "2px 5px", color: "var(--color-muted)", borderTop: "1px solid var(--color-border)", fontWeight: 600 }}>
                total
              </td>
              <td style={{ padding: "2px 5px", color: "var(--color-accent)", textAlign: "right", borderTop: "1px solid var(--color-border)", fontWeight: 600 }}>
                {fmtBytes(totalExpected)}
              </td>
            </tr>
            {currentAlgo && currentN && (() => {
              const cl = cacheLevel(currentAlgo, currentN);
              return (
                <tr>
                  <td style={{ padding: "2px 5px", color: "var(--color-muted)", borderTop: "1px solid var(--color-border)" }}>cache level</td>
                  <td style={{ padding: "2px 5px", color: cl.color, textAlign: "right", borderTop: "1px solid var(--color-border)", fontWeight: 600 }}>
                    {cl.label}
                  </td>
                </tr>
              );
            })()}
          </tbody>
        </table>
        <p style={{ fontSize: 9, color: "var(--color-muted)", marginTop: 6, lineHeight: 1.4, fontStyle: "italic" }}>
          Heap numbers come from <code>performance.memory</code> — V8 only, ~1 MB resolution, async post-GC snapshot. Theoretical numbers are derived from the algorithm&apos;s known space complexity.
        </p>
      </div>
    </div>
  );
}

/*
 * ColorPicker — small swatch button that opens a popover palette.
 *
 * Used on each saved-sort row so the user can recolor a sort directly inside
 * the list. Choosing a swatch closes the popover. A small `#RRGGBB` text input
 * lets the user paste a custom hex if the palette doesn't have what they want.
 */
function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  const [open, setOpen] = useState(false);
  const [hex, setHex] = useState(value);
  useEffect(() => { setHex(value); }, [value]);
  return (
    <div style={{ position: "relative", flexShrink: 0 }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        title={`Color: ${value} — click to change`}
        style={{
          width: 14, height: 14, borderRadius: 3, padding: 0,
          background: value, border: "1px solid var(--color-border)",
          cursor: "pointer", marginTop: 1,
        }}
      />
      {open && (
        <>
          {/* Backdrop to close on outside click */}
          <div
            onClick={() => setOpen(false)}
            style={{ position: "fixed", inset: 0, zIndex: 90 }}
          />
          {/* Palette popover */}
          <div style={{
            position: "absolute", top: 18, left: 0, zIndex: 91,
            display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 4,
            padding: 8, borderRadius: 6,
            background: "var(--color-surface-2)",
            border: "1px solid var(--color-border)",
            boxShadow: "0 4px 14px rgba(0,0,0,0.25)",
            width: 96,
          }}>
            {CUSTOM_PALETTE.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => { onChange(c); setOpen(false); }}
                title={c}
                style={{
                  width: 18, height: 18, padding: 0, borderRadius: 3,
                  background: c,
                  border: `2px solid ${c === value ? "var(--color-text)" : "transparent"}`,
                  cursor: "pointer",
                }}
              />
            ))}
            <input
              type="text"
              value={hex}
              onChange={e => setHex(e.target.value)}
              onBlur={() => {
                // Accept only well-formed hex; ignore garbage.
                if (/^#[0-9a-fA-F]{6}$/.test(hex)) onChange(hex);
                else setHex(value);
              }}
              onKeyDown={e => {
                if (e.key === "Enter") {
                  if (/^#[0-9a-fA-F]{6}$/.test(hex)) { onChange(hex); setOpen(false); }
                  else setHex(value);
                }
              }}
              placeholder="#rrggbb"
              style={{
                gridColumn: "1 / span 4",
                fontFamily: "monospace", fontSize: 9, padding: "3px 5px",
                borderRadius: 3,
                background: "var(--color-surface-1)",
                border: "1px solid var(--color-border)",
                color: "var(--color-text)", outline: "none",
                marginTop: 2,
              }}
            />
          </div>
        </>
      )}
    </div>
  );
}

function ResultsSkeleton({ algoCount }: { algoCount: number }) {
  const cards = Math.min(6, Math.max(2, algoCount));
  const bar = (h: number, w: string = "100%") => (
    <div className="cc-skeleton" style={{ height: h, width: w, borderRadius: 4 }} />
  );
  const sectionLabel = (text: string) => (
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
      <span style={{ width: 4, height: 4, borderRadius: "50%", background: "var(--color-muted)", opacity: 0.6 }} />
      <span style={{ fontSize: 8, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--color-muted)" }}>
        {text}
      </span>
      <span style={{ fontSize: 8, color: "var(--color-muted)", opacity: 0.5, fontFamily: "monospace" }}>
        — appears after the run
      </span>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Performance curve placeholder */}
      <div style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)", borderRadius: 10, padding: 14 }}>
        {sectionLabel("Performance curve")}
        <div style={{ position: "relative", height: 180, marginTop: 4 }}>
          {/* y-axis ticks */}
          <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 28, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            {[0, 1, 2, 3, 4].map(i => bar(6, "70%").key ?? <div key={i} className="cc-skeleton" style={{ height: 6, width: "70%", borderRadius: 3 }} />)}
          </div>
          {/* fake curve lines as diagonal bars */}
          <div style={{ position: "absolute", left: 34, right: 0, top: 0, bottom: 18, display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 4 }}>
            <div className="cc-skeleton" style={{ height: 2, width: "85%", borderRadius: 2 }} />
            <div className="cc-skeleton" style={{ height: 2, width: "70%", borderRadius: 2 }} />
            <div className="cc-skeleton" style={{ height: 2, width: "55%", borderRadius: 2 }} />
            <div className="cc-skeleton" style={{ height: 2, width: "40%", borderRadius: 2 }} />
          </div>
          {/* x-axis ticks */}
          <div style={{ position: "absolute", left: 34, right: 0, bottom: 0, display: "flex", justifyContent: "space-between" }}>
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="cc-skeleton" style={{ height: 6, width: 28, borderRadius: 3 }} />
            ))}
          </div>
        </div>
      </div>

      {/* Winner / rankings placeholder */}
      <div style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)", borderRadius: 10, padding: 14 }}>
        {sectionLabel("Rankings")}
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          {Array.from({ length: cards }).map((_, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div className="cc-skeleton" style={{ width: 10, height: 10, borderRadius: "50%" }} />
              <div className="cc-skeleton" style={{ height: 9, width: `${30 + (i * 7) % 40}%`, borderRadius: 3 }} />
              <div style={{ flex: 1 }} />
              <div className="cc-skeleton" style={{ height: 9, width: 50, borderRadius: 3 }} />
            </div>
          ))}
        </div>
      </div>

      {/* Algorithm mini-card grid placeholder */}
      <div>
        {sectionLabel("Per-algorithm cards")}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 8 }}>
          {Array.from({ length: cards }).map((_, i) => (
            <div key={i} style={{ background: "var(--color-surface-1)", border: "1px solid var(--color-border)", borderRadius: 7, padding: "8px 10px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 6 }}>
                <div className="cc-skeleton" style={{ width: 7, height: 7, borderRadius: "50%" }} />
                <div className="cc-skeleton" style={{ height: 8, flex: 1, borderRadius: 3 }} />
                <div className="cc-skeleton" style={{ width: 18, height: 18, borderRadius: "50%" }} />
              </div>
              <div className="cc-skeleton" style={{ height: 6, width: "70%", borderRadius: 3, marginBottom: 6 }} />
              <div className="cc-skeleton" style={{ height: 32, width: "100%", borderRadius: 3 }} />
            </div>
          ))}
        </div>
      </div>

      {/* Math / space complexity analysis placeholder */}
      <div style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)", borderRadius: 10, padding: 14 }}>
        {sectionLabel("Time & space complexity analysis")}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {Array.from({ length: Math.min(3, cards) }).map((_, i) => (
            <div key={i} style={{ background: "var(--color-surface-1)", border: "1px solid var(--color-border)", borderRadius: 6, padding: "6px 9px", display: "flex", alignItems: "center", gap: 6 }}>
              <div className="cc-skeleton" style={{ width: 6, height: 6, borderRadius: "50%" }} />
              <div className="cc-skeleton" style={{ height: 8, width: 90, borderRadius: 3 }} />
              <div style={{ flex: 1 }} />
              <div className="cc-skeleton" style={{ height: 8, width: 36, borderRadius: 3 }} />
              <div className="cc-skeleton" style={{ height: 8, width: 24, borderRadius: 3 }} />
            </div>
          ))}
        </div>
      </div>

      <p style={{ fontSize: 10, fontFamily: "monospace", color: "var(--color-muted)", textAlign: "center", margin: "4px 0 8px" }}>
        Click <strong style={{ color: "var(--color-accent)" }}>Run</strong> to populate these sections.
      </p>
    </div>
  );
}

function MathPanel({
  data, algos, mode, sampleProofs,
}: {
  data: CurveData;
  algos: string[];
  mode: "time" | "space";
  sampleProofs?: Record<string, SampleProof>;
}) {
  const [openIds, setOpenIds] = useState<Set<string>>(new Set(algos));
  const toggle = (id: string) => setOpenIds(prev => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next;
  });


  const fmtVal  = mode === "time" ? fmtTime : fmtBytes;
  const fmtDeriv = (v: number) => mode === "time"
    ? `${(v * 1e6).toFixed(2)} ns/elem`
    : `${v.toFixed(2)} B/elem`;
  const fmtInteg = (v: number) => mode === "time"
    ? `${v.toFixed(3)} ms·n`
    : `${fmtBytes(v)}·n`;

  const analyses = algos.flatMap(id => {
    const pts = (data[id] ?? []).filter(p => !p.timedOut);
    const raw = mode === "time"
      ? pts.filter(p => p.timeMs > 0).map(p => ({ n: p.n, val: p.meanMs ?? p.timeMs }))
      : pts.filter(p => (p.spaceBytes ?? 0) > 0).map(p => ({ n: p.n, val: p.spaceBytes! }));
    const fit = fitLogLog(raw);
    if (!fit) return [];
    // R² in log-log space
    const logPts = raw.map(p => ({ x: Math.log(p.n), y: Math.log(p.val) }));
    const meanY  = logPts.reduce((s, p) => s + p.y, 0) / logPts.length;
    const ssTot  = logPts.reduce((s, p) => s + (p.y - meanY) ** 2, 0);
    const logA   = Math.log(fit.k);
    const ssRes  = logPts.reduce((s, p) => s + (p.y - (logA + fit.exp * p.x)) ** 2, 0);
    const r2     = ssTot > 0 ? Math.max(0, 1 - ssRes / ssTot) : 1;
    return [{ id, fit, raw, r2 }];
  });

  if (analyses.length === 0) return null;

  return (
    <div style={{ marginTop: 14, paddingTop: 10, borderTop: "1px solid var(--color-border)" }}>
      <p style={{ fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--color-muted)", marginBottom: 8 }}>
        Mathematical analysis — {mode} complexity
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {analyses.map(({ id, fit, raw, r2 }) => {
          const { k: a, exp: b, fn } = fit;
          const deriv   = (n: number) => a * b * Math.pow(n, b - 1);        // f′(n)
          const integral = (n: number) => a * Math.pow(n, b + 1) / (b + 1); // ∫₀ⁿ f dx
          const dotColor = ALGO_COLORS[id] ?? "#888";
          const isOpen   = openIds.has(id);
          return (
            <div key={id} style={{
              background: "var(--color-surface-1)",
              borderRadius: 6,
              border: `1px solid ${sampleProofs?.[id]?.failed ? "rgba(239,83,80,0.65)" : "var(--color-border)"}`,
              overflow: "hidden",
            }}>
              <button onClick={() => toggle(id)} style={{
                width: "100%", display: "flex", alignItems: "center", gap: 6,
                padding: "5px 8px", background: "none", border: "none", cursor: "pointer", textAlign: "left",
              }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: dotColor, flexShrink: 0 }} />
                <span style={{
                  fontSize: 10, fontWeight: 600,
                  color: sampleProofs?.[id]?.failed ? "#ef5350" : "var(--color-text)",
                  flex: 1,
                  textDecoration: sampleProofs?.[id]?.failed ? "line-through" : "none",
                  textDecorationColor: "rgba(239,83,80,0.55)",
                }}>
                  {ALGO_NAMES[id]}
                </span>
                {sampleProofs?.[id]?.failed && (
                  <span title={`Sort produced out-of-order output at index ${sampleProofs[id].badIdx} of the sampled positions.`} style={{
                    fontSize: 7, fontWeight: 700, fontFamily: "monospace",
                    padding: "1px 5px", borderRadius: 3, whiteSpace: "nowrap",
                    background: "rgba(239,83,80,0.18)",
                    border: "1px solid rgba(239,83,80,0.55)",
                    color: "#ef5350",
                  }}>
                    ✗ BROKEN
                  </span>
                )}
                <span style={{ fontSize: 9, fontFamily: "monospace", color: dotColor }}>{fit.label}</span>
                <span style={{ fontSize: 8, fontFamily: "monospace", color: "var(--color-muted)", marginLeft: 4 }}>R²={r2.toFixed(3)}</span>
                <ChevronRight size={10} style={{ transform: isOpen ? "rotate(90deg)" : "none", transition: "transform 0.15s", color: "var(--color-muted)", flexShrink: 0 }} />
              </button>
              {isOpen && (
                <div style={{ padding: "6px 10px 10px", borderTop: "1px solid var(--color-border)" }}>
                  {/* Equations */}
                  <div style={{ fontFamily: "monospace", fontSize: 9, color: "var(--color-muted)", marginBottom: 8, display: "flex", flexDirection: "column", gap: 3 }}>
                    <div>
                      <span style={{ color: dotColor }}>f(n)</span>
                      {" = "}{a.toExponential(3)} · n^{b.toFixed(4)} {mode === "time" ? "ms" : "bytes"}
                    </div>
                    <div>
                      <span style={{ color: dotColor }}>f′(n)</span>
                      {" = "}{(a * b).toExponential(3)} · n^{(b - 1).toFixed(4)}
                      <span style={{ opacity: 0.6 }}> ← marginal cost per element added</span>
                    </div>
                    <div>
                      <span style={{ color: dotColor }}>∫f dn</span>
                      {" = "}{a.toExponential(3)} · n^{(b + 1).toFixed(4)} / {(b + 1).toFixed(3)}
                      <span style={{ opacity: 0.6 }}> ← cumulative work</span>
                    </div>
                  </div>
                  {/* Data table */}
                  <table style={{ fontSize: 8, fontFamily: "monospace", borderCollapse: "collapse", width: "100%" }}>
                    <thead>
                      <tr style={{ color: "var(--color-muted)" }}>
                        {["n", "measured", "f(n) fit", "f′(n)", "∫f dn", "Δ fit"].map(h => (
                          <th key={h} style={{ textAlign: h === "n" ? "left" : "right", padding: "2px 5px", borderBottom: "1px solid var(--color-border)", fontWeight: 400 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {raw.map(p => {
                        const pred = a * fn(p.n);
                        const pct  = pred > 0 ? ((p.val - pred) / pred) * 100 : 0;
                        return (
                          <tr key={p.n}>
                            <td style={{ padding: "2px 5px", color: "var(--color-text)" }}>{fmtN(p.n)}</td>
                            <td style={{ padding: "2px 5px", textAlign: "right", color: dotColor }}>{fmtVal(p.val)}</td>
                            <td style={{ padding: "2px 5px", textAlign: "right", color: "var(--color-muted)" }}>{fmtVal(pred)}</td>
                            <td style={{ padding: "2px 5px", textAlign: "right", color: "var(--color-muted)" }}>{fmtDeriv(deriv(p.n))}</td>
                            <td style={{ padding: "2px 5px", textAlign: "right", color: "var(--color-muted)" }}>{fmtInteg(integral(p.n))}</td>
                            <td style={{ padding: "2px 5px", textAlign: "right", color: Math.abs(pct) > 15 ? "var(--color-state-swap)" : "var(--color-muted)" }}>
                              {pct >= 0 ? "+" : ""}{pct.toFixed(1)}%
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  {/* Extrapolation table */}
                  {(() => {
                    const EXTRAP_NS = [1_000_000, 10_000_000, 100_000_000, 1_000_000_000, 10_000_000_000];
                    const lastMeasN = raw[raw.length - 1]?.n ?? 0;
                    const rows = EXTRAP_NS.filter(en => en > lastMeasN);
                    if (rows.length === 0) return null;
                    return (
                      <div style={{ marginTop: 8, paddingTop: 6, borderTop: "1px dashed var(--color-border)" }}>
                        <p style={{ fontSize: 8, color: "var(--color-muted)", marginBottom: 4, fontFamily: "monospace" }}>
                          extrapolation (fitted curve — not measured)
                        </p>
                        <table style={{ fontSize: 8, fontFamily: "monospace", borderCollapse: "collapse", width: "100%" }}>
                          <thead>
                            <tr style={{ color: "var(--color-muted)" }}>
                              {["n", "f(n) est.", "f′(n)", "cumulative"].map(h => (
                                <th key={h} style={{ textAlign: h === "n" ? "left" : "right", padding: "2px 5px", fontWeight: 400 }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {rows.map(en => {
                              const pred = a * fn(en);
                              return (
                                <tr key={en} style={{ opacity: 0.7 }}>
                                  <td style={{ padding: "2px 5px", color: "var(--color-muted)" }}>{fmtN(en)}</td>
                                  <td style={{ padding: "2px 5px", textAlign: "right", color: dotColor }}>{fmtVal(pred)}</td>
                                  <td style={{ padding: "2px 5px", textAlign: "right", color: "var(--color-muted)" }}>{fmtDeriv(deriv(en))}</td>
                                  <td style={{ padding: "2px 5px", textAlign: "right", color: "var(--color-muted)" }}>{fmtInteg(integral(en))}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    );
                  })()}

                  {/* Space complexity sub-section — memory profile alongside the time analysis */}
                  {(() => {
                    const pts = (data[id] ?? []).filter(p => !p.timedOut);
                    if (pts.length === 0) return null;
                    const sorted = [...pts].sort((a, b) => b.n - a.n);
                    const largest = sorted[0];
                    const largestN = largest.n;
                    const measuredSpace = largest.spaceBytes ?? 0;
                    const measuredAlloc = largest.allocBytes ?? 0;
                    const theoretical = theoreticalSpaceBytes(id, largestN);
                    const inputBytes = largestN * 8; // 64-bit floats
                    const totalBytes = theoretical + inputBytes;
                    const auxClass = ALGO_SPACE[id] ?? "—";
                    const stable = ALGO_STABLE[id];
                    const online = ALGO_ONLINE[id];

                    // Asymptotic classification: derive expected class from auxClass label
                    const isInPlace = auxClass === "O(1)" || auxClass.startsWith("O(log");
                    const bytesPerElem = totalBytes / Math.max(1, largestN);

                    // Cache level the working set falls into at largestN
                    const cl = cacheLevel(id, largestN);

                    // Fit space curve if there are points with positive space data
                    const spacePts = pts.filter(p => (p.spaceBytes ?? 0) > 0).map(p => ({ n: p.n, val: p.spaceBytes! }));
                    const spaceFit = spacePts.length >= 2 ? fitLogLog(spacePts) : null;

                    return (
                      <div style={{ marginTop: 10, paddingTop: 8, borderTop: "1px dashed var(--color-border)" }}>
                        <p style={{ fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--color-muted)", marginBottom: 6 }}>
                          Space complexity @ n={fmtN(largestN)}
                        </p>
                        <table style={{ fontSize: 9, fontFamily: "monospace", borderCollapse: "collapse", width: "100%" }}>
                          <tbody>
                            <tr>
                              <td style={{ padding: "2px 5px", color: "var(--color-muted)", width: "38%" }}>Aux class</td>
                              <td style={{ padding: "2px 5px", color: dotColor, textAlign: "right", fontWeight: 600 }}>{auxClass}</td>
                            </tr>
                            <tr>
                              <td style={{ padding: "2px 5px", color: "var(--color-muted)", borderTop: "1px solid var(--color-border)" }} title="Auxiliary memory beyond the input array — extrapolated from algorithm theory">
                                Aux at n (theoretical)
                              </td>
                              <td style={{ padding: "2px 5px", color: "var(--color-text)", textAlign: "right", borderTop: "1px solid var(--color-border)" }}>
                                {fmtBytes(theoretical)}
                              </td>
                            </tr>
                            {measuredAlloc > 0 && (
                              <tr>
                                <td style={{ padding: "2px 5px", color: "var(--color-muted)", borderTop: "1px solid var(--color-border)" }} title="Bytes counted by patched Array methods during the run">
                                  Aux measured (alloc instrumentation)
                                </td>
                                <td style={{ padding: "2px 5px", color: "var(--color-text)", textAlign: "right", borderTop: "1px solid var(--color-border)" }}>
                                  {fmtBytes(measuredAlloc)}
                                </td>
                              </tr>
                            )}
                            {measuredSpace > 0 && measuredSpace !== theoretical && (
                              <tr>
                                <td style={{ padding: "2px 5px", color: "var(--color-muted)", borderTop: "1px solid var(--color-border)" }} title="V8 performance.memory heap delta; rounds to ~1MB on most builds">
                                  Heap delta (perf.memory)
                                </td>
                                <td style={{ padding: "2px 5px", color: "var(--color-text)", textAlign: "right", borderTop: "1px solid var(--color-border)" }}>
                                  {fmtBytes(measuredSpace)}
                                </td>
                              </tr>
                            )}
                            <tr>
                              <td style={{ padding: "2px 5px", color: "var(--color-muted)", borderTop: "1px solid var(--color-border)" }} title="Input array (n × 8 bytes) + auxiliary">
                                Total (input + aux)
                              </td>
                              <td style={{ padding: "2px 5px", color: "var(--color-text)", textAlign: "right", borderTop: "1px solid var(--color-border)" }}>
                                {fmtBytes(totalBytes)}
                              </td>
                            </tr>
                            <tr>
                              <td style={{ padding: "2px 5px", color: "var(--color-muted)", borderTop: "1px solid var(--color-border)" }} title="Total bytes ÷ n — marginal memory cost per element">
                                Bytes per element
                              </td>
                              <td style={{ padding: "2px 5px", color: "var(--color-text)", textAlign: "right", borderTop: "1px solid var(--color-border)" }}>
                                {bytesPerElem.toFixed(1)} B/elem
                              </td>
                            </tr>
                            <tr>
                              <td style={{ padding: "2px 5px", color: "var(--color-muted)", borderTop: "1px solid var(--color-border)" }} title="Smallest CPU cache level that fits the working set">
                                Cache level
                              </td>
                              <td style={{ padding: "2px 5px", color: cl.color, textAlign: "right", borderTop: "1px solid var(--color-border)", fontWeight: 600 }}>
                                {cl.label}
                              </td>
                            </tr>
                            <tr>
                              <td style={{ padding: "2px 5px", color: "var(--color-muted)", borderTop: "1px solid var(--color-border)" }} title="In-place sorts use O(1) or O(log n) auxiliary memory">
                                In-place
                              </td>
                              <td style={{ padding: "2px 5px", color: "var(--color-text)", textAlign: "right", borderTop: "1px solid var(--color-border)" }}>
                                {isInPlace ? "yes" : "no"}
                              </td>
                            </tr>
                            <tr>
                              <td style={{ padding: "2px 5px", color: "var(--color-muted)", borderTop: "1px solid var(--color-border)" }} title="Whether equal keys keep their original relative order">
                                Stability
                              </td>
                              <td style={{ padding: "2px 5px", color: "var(--color-text)", textAlign: "right", borderTop: "1px solid var(--color-border)" }}>
                                {stable === true ? "stable" : stable === false ? "unstable" : "—"}
                              </td>
                            </tr>
                            {online !== undefined && (
                              <tr>
                                <td style={{ padding: "2px 5px", color: "var(--color-muted)", borderTop: "1px solid var(--color-border)" }} title="Whether the sort can accept input one element at a time vs needing the whole array up front">
                                  Online
                                </td>
                                <td style={{ padding: "2px 5px", color: "var(--color-text)", textAlign: "right", borderTop: "1px solid var(--color-border)" }}>
                                  {online ? "yes (streaming)" : "no (batch)"}
                                </td>
                              </tr>
                            )}
                            {spaceFit && (
                              <tr>
                                <td style={{ padding: "2px 5px", color: "var(--color-muted)", borderTop: "1px solid var(--color-border)" }} title="Log-log fit of measured aux memory across all n">
                                  Measured aux fit
                                </td>
                                <td style={{ padding: "2px 5px", color: dotColor, textAlign: "right", borderTop: "1px solid var(--color-border)" }}>
                                  ≈ {spaceFit.k.toExponential(2)} · {spaceFit.label}
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    );
                  })()}

                  {/* Before/After sample — visual proof the sort actually sorts.
                      Adapts to the dataType the run used (integer, float, or string). */}
                  {sampleProofs?.[id] && (() => {
                    const sp = sampleProofs[id];
                    const isStr = sp.dataType === "string";
                    const isFloat = sp.dataType === "float";

                    // Verifier result is computed at capture time and stored on the proof.
                    const verified = !sp.failed;
                    const badIdx = sp.badIdx ?? -1;

                    // Bar scaling.
                    //   • Numbers (int/float): bar height ∝ value
                    //   • Strings: bar height ∝ LEXICOGRAPHIC RANK among the values in
                    //     this sample. Using s.length is uninformative because our
                    //     generator produces fixed-length 6-char strings — every bar
                    //     would be identical. Ranking by sort order gives a visible
                    //     increasing staircase in the `after` row, which is what
                    //     proves the sort worked.
                    let numericForBars: (v: number | string) => number;
                    if (isStr) {
                      const uniqueSorted = [...new Set([...sp.before, ...sp.after] as string[])].sort();
                      const rankMap = new Map<string, number>();
                      uniqueSorted.forEach((s, i) => rankMap.set(s, i));
                      numericForBars = (v) => rankMap.get(v as string) ?? 0;
                    } else {
                      numericForBars = (v) => v as number;
                    }
                    const all = [...sp.before, ...sp.after].map(numericForBars);
                    const maxV = Math.max(...all, 1);
                    const minV = Math.min(...all, 0);
                    const range = Math.max(1, maxV - minV);

                    const fmtCell = (v: number | string): string => {
                      if (typeof v === "string") {
                        // Show up to 8 chars verbatim so 6-char generated strings appear
                        // fully ("abc123"), and longer/unicode strings still get truncated.
                        return v.length > 8 ? v.slice(0, 7) + "…" : v;
                      }
                      if (Number.isInteger(v)) return v.toString();
                      // For floats: scale precision to the captured `decimalsMax` so
                      // values like 12345.6789 don't get clipped to 12345.68 if more
                      // precision is meaningful for the run.
                      const decimals = sp.decimalsMax != null ? Math.min(4, Math.max(2, sp.decimalsMax)) : 2;
                      return v.toFixed(decimals);
                    };
                    const renderRow = (vals: (number | string)[], valueColor: string) => (
                      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 1 }}>
                        <div style={{ display: "flex", gap: 1, height: 18, alignItems: "flex-end" }}>
                          {vals.map((v, i) => {
                            const h = ((numericForBars(v) - minV) / range) * 16 + 2;
                            return (
                              <span key={i}
                                title={String(v)}
                                style={{ flex: 1, height: h, background: dotColor, opacity: 0.85, borderRadius: 1 }}
                              />
                            );
                          })}
                        </div>
                        <div style={{ display: "flex", gap: 1 }}>
                          {vals.map((v, i) => (
                            <span key={i}
                              title={String(v)}
                              style={{ flex: 1, fontSize: 7, fontFamily: "monospace", color: valueColor, textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                            >
                              {fmtCell(v)}
                            </span>
                          ))}
                        </div>
                      </div>
                    );

                    // Format the min/max summary depending on type
                    const fmtSummary = (v: number | string | undefined): string => {
                      if (v === undefined) return "—";
                      if (typeof v === "string") return v.length > 8 ? `"${v.slice(0, 7)}…"` : `"${v}"`;
                      if (Number.isInteger(v)) return v.toString();
                      return (v as number).toFixed(3);
                    };

                    // Per-data-type info row (right side of the header)
                    const typeBadge = (label: string, fg: string, bg: string) => (
                      <span style={{
                        fontSize: 7, fontFamily: "monospace", fontWeight: 700,
                        padding: "1px 5px", borderRadius: 3, letterSpacing: "0.03em",
                        background: bg, border: `1px solid ${fg}`, color: fg, textTransform: "uppercase",
                      }}>{label}</span>
                    );

                    return (
                      <div style={{ marginTop: 10, paddingTop: 8, borderTop: "1px dashed var(--color-border)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 8, color: "var(--color-muted)", fontFamily: "monospace", flex: 1 }}>
                            sample (every ⌊n/{sp.before.length}⌋th element from n={fmtN(sp.n)})
                          </span>
                          {isStr  && typeBadge("string", "#64b5f6", "rgba(100,181,246,0.12)")}
                          {isFloat && typeBadge("float", "#ffb74d", "rgba(255,183,77,0.12)")}
                          {!isStr && !isFloat && typeBadge("integer", "#7ec88a", "rgba(126,200,138,0.12)")}
                          {sp.scenario && typeBadge(sp.scenario, "var(--color-muted)", "var(--color-surface-3)")}
                          <span
                            title={verified
                              ? "Sample is in non-decreasing order — sort produced a valid ordering at the sampled positions."
                              : `Sample is out of order: a[${badIdx}] (${sp.after[badIdx]}) < a[${badIdx - 1}] (${sp.after[badIdx - 1]}). Sort is broken.`}
                            style={{
                              fontSize: 7, fontFamily: "monospace", fontWeight: 700,
                              padding: "1px 5px", borderRadius: 3, whiteSpace: "nowrap",
                              background: verified ? "rgba(78,160,90,0.18)" : "rgba(239,83,80,0.20)",
                              border: `1px solid ${verified ? "rgba(78,160,90,0.55)" : "rgba(239,83,80,0.65)"}`,
                              color: verified ? "#7ec88a" : "#ef5350",
                            }}
                          >
                            {verified
                              ? "✓ verified sorted"
                              : `✗ BROKEN — out of order at index ${badIdx}`}
                          </span>
                        </div>

                        {/* Generator explanation — describes how the values were produced */}
                        <div style={{
                          fontSize: 8, fontFamily: "monospace", color: "var(--color-muted)",
                          marginBottom: 4, padding: "3px 6px", borderRadius: 4,
                          background: "var(--color-surface-1)", border: "1px solid var(--color-border)",
                          lineHeight: 1.4,
                        }}>
                          <strong style={{ color: "var(--color-text)" }}>Generator: </strong>
                          {isStr
                            ? `6-char base-36 strings padded with zeros (e.g., "000abc", "fooz23"). Generated by generateStringInput() with the "${sp.scenario ?? "random"}" scenario shape.`
                            : isFloat
                              ? `Integer in range + Math.random() fractional part (e.g., 4123.7890). Generated by generateFloatInput() with the "${sp.scenario ?? "random"}" scenario shape.`
                              : `Random integers in [0, ~9999]. Generated by generateBenchmarkInput() with the "${sp.scenario ?? "random"}" scenario shape.`}
                        </div>

                        {/* Per-run stats summarising what was actually fed in */}
                        <div style={{ display: "flex", gap: 10, fontSize: 8, fontFamily: "monospace", color: "var(--color-muted)", marginBottom: 6, flexWrap: "wrap" }}>
                          <span title="Smallest value across the full input">
                            min <span style={{ color: "var(--color-text)" }}>{fmtSummary(sp.minVal)}</span>
                          </span>
                          <span title="Largest value across the full input">
                            max <span style={{ color: "var(--color-text)" }}>{fmtSummary(sp.maxVal)}</span>
                          </span>
                          {sp.distinctCount !== undefined && (
                            <span title="Number of distinct values across the full input">
                              distinct <span style={{ color: "var(--color-text)" }}>{sp.distinctCount.toLocaleString()}</span>
                              {sp.distinctCount < sp.n && <span style={{ opacity: 0.6 }}> / {sp.n.toLocaleString()}</span>}
                            </span>
                          )}
                          {!isStr && sp.minVal !== undefined && sp.maxVal !== undefined && typeof sp.minVal === "number" && typeof sp.maxVal === "number" && (
                            <span title="max − min — the value span">
                              span <span style={{ color: "var(--color-text)" }}>{((sp.maxVal - sp.minVal) as number).toLocaleString()}</span>
                            </span>
                          )}
                          {sp.totalInputBytes !== undefined && (
                            <span title={`n × ~${sp.bytesPerElement} bytes/element = total input memory footprint (approx)`}>
                              size <span style={{ color: "var(--color-text)" }}>{fmtBytes(sp.totalInputBytes)}</span>
                              <span style={{ opacity: 0.6 }}> (~{sp.bytesPerElement} B/elem)</span>
                            </span>
                          )}
                          {isStr && sp.avgStrLen !== undefined && (
                            <span title="Mean character length across the full input">
                              avg len <span style={{ color: "var(--color-text)" }}>{sp.avgStrLen.toFixed(1)}</span>
                            </span>
                          )}
                          {isFloat && sp.decimalsMax !== undefined && (
                            <span title="Maximum number of fractional digits observed in the input (capped at 6)">
                              decimals <span style={{ color: "var(--color-text)" }}>≤{sp.decimalsMax}</span>
                            </span>
                          )}
                          {sp.isAllInteger === false && !isFloat && (
                            <span title="At least one value has a fractional part — sort behaviour may differ from pure-integer expectations" style={{ color: "#ffb74d" }}>
                              ⚠ contains non-integers
                            </span>
                          )}
                          {isStr && (
                            <span title="Bar heights below scale with each value's lexicographic rank among the sample. A clean staircase in the `after` row visually proves the sort produced ascending order.">
                              <span style={{ color: "var(--color-text)" }}>bar = lex rank</span>
                            </span>
                          )}
                          {/* Sort time at this n, if curveData is available */}
                          {(() => {
                            const pt = (data[id] ?? []).find(p => p.n === sp.n);
                            if (!pt) return null;
                            return (
                              <span title="Best timed run at this n (post-warmup)" style={{ color: "var(--color-muted)" }}>
                                sort time <span style={{ color: "var(--color-text)" }}>{fmtTime(pt.timeMs)}</span>
                                {pt.meanMs != null && pt.stdDev != null && (
                                  <span style={{ opacity: 0.7 }}> (μ {fmtTime(pt.meanMs)} ±{fmtTime(pt.stdDev)})</span>
                                )}
                              </span>
                            );
                          })()}
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          <div style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
                            <span style={{ fontSize: 8, fontFamily: "monospace", color: "var(--color-muted)", width: 38, flexShrink: 0, paddingTop: 5 }}>before</span>
                            {renderRow(sp.before, "var(--color-muted)")}
                          </div>
                          <div style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
                            <span style={{ fontSize: 8, fontFamily: "monospace", color: dotColor, width: 38, flexShrink: 0, paddingTop: 5 }}>after</span>
                            {renderRow(sp.after, dotColor)}
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          );
        })}
      </div>


    </div>
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────

type Status = "idle" | "running" | "done";

// algoId → array of (n, time, space) measurements across different input sizes
export type CurvePoint = {
  n: number;
  timeMs: number;         // best post-warmup round (used for ranking)
  meanMs?: number;        // mean of post-warmup rounds
  stdDev?: number;        // std dev of post-warmup rounds (for error bands)
  roundTimes?: number[];  // all post-warmup round times (for variance timeline)
  // `spaceBytes` may carry EITHER an actual heap-delta measurement OR a
  // theoretical estimate from theoreticalSpaceBytes() when the heap-delta
  // pass produced no signal. Existing chart code consumes it as a single
  // "space" value for ranking and display, which is fine.
  spaceBytes?: number;
  // `heapDeltaBytes` is the REAL performance.memory delta only — undefined
  // when the heap-delta pass produced no measurable growth (or perf.memory
  // wasn't available). Kept distinct so the in-place verdict doesn't accuse
  // an algorithm of allocating based on a theoretical estimate.
  heapDeltaBytes?: number;
  allocBytes?: number;    // instrumented alloc count via measureAllocBytes
  timedOut?: boolean;
};
export type CurveData = Record<string, CurvePoint[]>;

interface SummaryResult {
  id: string;
  timeMs: number;
  meanMs?: number;
  stdDev?: number;
  rank: number;
}

// ── Curve chart ───────────────────────────────────────────────────────────────

// ── Pair matrix ───────────────────────────────────────────────────────────────
// For each pair of algos, shows which is faster at the largest measured n and by
// how much. Rows/cols sorted fastest→slowest so the top-left is always the winner.

function PairMatrixTable({
  sorted,
  title,
  accent,
  getVal,
  fmtTitle,
}: {
  sorted: { id: string; timeMs: number }[];
  title: string;
  accent: string;
  getVal: (row: { id: string; timeMs: number }) => number;
  fmtTitle: (winner: string, loser: string, ratio: number) => string;
}) {
  return (
    <div style={{
      borderRadius: 8,
      border: "1px solid var(--color-border)",
      overflow: "hidden",
      background: "var(--color-surface-0, var(--color-surface-1))",
    }}>
      {/* Header bar */}
      <div style={{
        padding: "6px 10px",
        borderBottom: "1px solid var(--color-border)",
        display: "flex", alignItems: "center", gap: 7,
        background: "var(--color-surface-1)",
      }}>
        <span style={{
          width: 7, height: 7, borderRadius: "50%",
          background: accent, flexShrink: 0, opacity: 0.85,
        }} />
        <span style={{
          fontSize: 9, fontWeight: 700, letterSpacing: "0.06em",
          textTransform: "uppercase", color: "var(--color-text)",
        }}>
          {title}
        </span>
        <span style={{ marginLeft: "auto", fontSize: 8, color: "var(--color-text)", opacity: 0.5, fontFamily: "monospace" }}>
          n = largest · green wins · ratio
        </span>
      </div>

      {/* Scrollable table */}
      <div style={{ overflowX: "auto", padding: "8px 10px 10px" }}>
        <table style={{ borderCollapse: "separate", borderSpacing: 2, fontFamily: "monospace", fontSize: 9 }}>
          <thead>
            <tr>
              <th style={{ width: 88, padding: "0 6px 4px 0", textAlign: "right", color: "var(--color-muted)", fontWeight: 400 }} />
              {sorted.map(col => (
                <th key={col.id} style={{
                  padding: "0 6px 4px", textAlign: "center", minWidth: 52,
                  color: ALGO_COLORS[col.id] ?? "var(--color-muted)",
                  fontWeight: 700, fontSize: 8,
                }}>
                  {(ALGO_NAMES[col.id] ?? col.id).replace(" Sort", "")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => (
              <tr key={row.id}>
                <td style={{
                  padding: "0 8px 0 0", textAlign: "right",
                  color: ALGO_COLORS[row.id] ?? "var(--color-muted)",
                  fontWeight: 700, fontSize: 8, whiteSpace: "nowrap",
                }}>
                  {(ALGO_NAMES[row.id] ?? row.id).replace(" Sort", "")}
                </td>
                {sorted.map((col) => {
                  if (row.id === col.id) {
                    return (
                      <td key={col.id} style={{
                        padding: "3px 6px", textAlign: "center",
                        background: "var(--color-surface-1)",
                        borderRadius: 4,
                        color: "var(--color-border)",
                        fontSize: 10,
                      }}>◆</td>
                    );
                  }
                  const rv = getVal(row), cv = getVal(col);
                  const rowWins = rv < cv;
                  const ratio = rowWins ? cv / rv : rv / cv;
                  const intensity = Math.min(0.75, 0.35 + (ratio - 1) * 0.12);
                  const bg = rowWins
                    ? `rgba(78,160,90,${intensity})`
                    : `rgba(200,70,70,${intensity})`;
                  return (
                    <td key={col.id} style={{
                      padding: "3px 7px", textAlign: "center",
                      background: bg,
                      borderRadius: 4,
                      color: rowWins ? "#0d2e12" : "#2e0a0a",
                      fontWeight: 700,
                      letterSpacing: "0.02em",
                    }}
                      title={fmtTitle(
                        rowWins ? ALGO_NAMES[row.id] : ALGO_NAMES[col.id],
                        rowWins ? ALGO_NAMES[col.id] : ALGO_NAMES[row.id],
                        ratio,
                      )}
                    >
                      {rowWins ? `${ratio.toFixed(1)}×` : `÷${ratio.toFixed(1)}`}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PairMatrix({ results, spaceResults }: {
  results: { id: string; timeMs: number }[];
  spaceResults: { id: string; timeMs: number }[];
}) {
  if (results.length < 2) return null;

  const timeSorted  = [...results].sort((a, b) => a.timeMs - b.timeMs);
  const spaceSorted = spaceResults.length >= 2
    ? [...spaceResults].sort((a, b) => a.timeMs - b.timeMs)
    : null;

  return (
    <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
      <PairMatrixTable
        sorted={timeSorted}
        title="Time — head-to-head"
        accent="#ef5350"
        getVal={r => r.timeMs}
        fmtTitle={(w, l, ratio) => `${w} is ${ratio.toFixed(2)}× faster than ${l}`}
      />
      {spaceSorted && (
        <PairMatrixTable
          sorted={spaceSorted}
          title="Space — head-to-head"
          accent="#64b5f6"
          getVal={r => r.timeMs}
          fmtTitle={(w, l, ratio) => `${w} uses ${ratio.toFixed(2)}× less memory than ${l}`}
        />
      )}
    </div>
  );
}

// ── Live rank panel ──────────────────────────────────────────────────────────
// Shows a compact ranked list of algos at the current hover/pin N, updating live.

function LiveRankPanel({
  data,
  algos,
  n,
  mode,
}: {
  data: CurveData;
  algos: string[];
  n: number | null;
  mode: "time" | "space" | "ratio" | "space-ratio";
}) {
  if (!n) return null;

  const useSpace = mode === "space" || mode === "space-ratio";

  type RankEntry = { id: string; val: number; timedOut: boolean };
  const entries: RankEntry[] = algos.flatMap(id => {
    const pt = (data[id] ?? []).find(p => p.n === n);
    if (!pt) return [];
    const val = useSpace ? (pt.spaceBytes ?? 0) : (pt.meanMs ?? pt.timeMs ?? 0);
    return [{ id, val, timedOut: !!pt.timedOut }];
  });

  const valid = entries.filter(e => !e.timedOut && e.val > 0).sort((a, b) => a.val - b.val);
  const timedOut = entries.filter(e => e.timedOut);
  const fastest = valid[0]?.val ?? 0;

  if (valid.length === 0 && timedOut.length === 0) return null;

  return (
    <div style={{
      marginTop: 6,
      padding: "6px 8px",
      background: "var(--color-surface-1)",
      border: "1px solid var(--color-border)",
      borderRadius: 8,
      fontFamily: "monospace",
      fontSize: 10,
    }}>
      <div style={{ color: "var(--color-muted)", fontSize: 9, marginBottom: 4, letterSpacing: "0.04em" }}>
        RANK AT n={fmtN(n)} — {useSpace ? "space" : "time"}
      </div>
      {valid.map((e, i) => {
        const color = ALGO_COLORS[e.id] ?? "#888";
        const speedup = fastest > 0 && i > 0 ? e.val / fastest : 1;
        const barW = fastest > 0 ? Math.min(100, (e.val / (valid[valid.length - 1]?.val || e.val)) * 100) : 0;
        const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`;
        return (
          <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 2 }}>
            <span style={{ minWidth: 22, textAlign: "right", fontSize: 9, color: "var(--color-muted)" }}>{medal}</span>
            <span style={{ minWidth: 84, color, fontWeight: i < 3 ? 600 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {ALGO_NAMES[e.id] ?? e.id}
            </span>
            {/* bar */}
            <div style={{ flex: 1, height: 5, background: "var(--color-border)", borderRadius: 3, overflow: "hidden", minWidth: 40 }}>
              <div style={{ width: `${barW}%`, height: "100%", background: color, borderRadius: 3, opacity: 0.8 }} />
            </div>
            <span style={{ minWidth: 52, textAlign: "right", color: "var(--color-text)", fontSize: 10 }}>
              {useSpace ? fmtBytes(e.val) : fmtTime(e.val)}
            </span>
            {speedup > 1.005 && (
              <span style={{ minWidth: 40, textAlign: "right", color: "var(--color-muted)", fontSize: 9 }}>
                {speedup.toFixed(1)}×
              </span>
            )}
          </div>
        );
      })}
      {timedOut.map(e => (
        <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 2, opacity: 0.45 }}>
          <span style={{ minWidth: 22, textAlign: "right", fontSize: 9, color: "var(--color-muted)" }}>–</span>
          <span style={{ minWidth: 84, color: ALGO_COLORS[e.id] ?? "#888", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {ALGO_NAMES[e.id] ?? e.id}
          </span>
          <span style={{ color: "var(--color-muted)", fontSize: 9 }}>timed out</span>
        </div>
      ))}
    </div>
  );
}

export function CurveChart({
  data,
  sizes,
  algos,
  highlight,
  activeN,
  onNChange,
  mode = "time",
  onExportReady,
  advanced = false,
  ghostRuns,
  ghostMode = false,
}: {
  data: CurveData;
  sizes: number[];
  algos: string[];
  highlight?: string | null;
  activeN?: number | null;
  onNChange?: (n: number | null) => void;
  mode?: "time" | "space" | "ratio" | "space-ratio";
  onExportReady?: (fn: () => void) => void;
  advanced?: boolean;
  /** Per-algo history of prior runs. Drawn underneath the active curve when
   *  ghostMode is true, faded by recency (newest = bright, oldest = dim). */
  ghostRuns?: Record<string, { ts: number; points: { n: number; timeMs: number; meanMs?: number; spaceBytes?: number }[] }[]>;
  ghostMode?: boolean;
}) {
  const [locked, setLocked] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [interactMode, setInteractMode] = useState<"brush" | "zoom">("brush");
  const [yZoom, setYZoom] = useState(1.0);           // <1 = zoomed in on y (lower ceiling)
  const [xRange, setXRange] = useState<[number, number] | null>(null); // size indices
  const [dragStart,  setDragStart]  = useState<number | null>(null);
  const [dragCur,    setDragCur]    = useState<number | null>(null);
  const [dragStartY, setDragStartY] = useState<number | null>(null);
  const [dragCurY,   setDragCurY]   = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [pinnedN, setPinnedN] = useState<number | null>(null);
  const [yLogScale, setYLogScale] = useState(false);
  const [showBigORefs, setShowBigORefs] = useState(true);

  // Expose PNG export to parent
  useEffect(() => {
    if (!onExportReady) return;
    onExportReady(() => {
      const svg = svgRef.current;
      if (!svg) return;
      const computed = getComputedStyle(document.documentElement);
      let s = new XMLSerializer().serializeToString(svg);
      s = s.replace(/var\(--([^)]+)\)/g, (_, name) =>
        computed.getPropertyValue(`--${name.trim()}`).trim() || "#000"
      );
      if (!s) return;
      const scale = 2;
      const canvas = document.createElement("canvas");
      canvas.width = VW * scale;
      canvas.height = VH * scale;
      const ctx = canvas.getContext("2d")!;
      ctx.scale(scale, scale);
      const blob = new Blob([s], { type: "image/svg+xml" });
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, VW, VH);
        URL.revokeObjectURL(url);
        const a = document.createElement("a");
        a.href = canvas.toDataURL("image/png");
        a.download = `benchmark-${mode}.png`;
        a.click();
      };
      img.src = url;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onExportReady]);

  // Reset zoom state when locking
  useEffect(() => { if (locked) { setYZoom(1); setXRange(null); } }, [locked]);
  // Reset x-range when the available sizes change
  useEffect(() => { setXRange(null); }, [sizes]);

  // Non-passive wheel listener — always active, zooms X axis centered on cursor.
  // Ctrl+wheel zooms Y axis instead.
  // Constants VW=600, pL=60, iW=418 are inlined to avoid ordering issues.
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (sizes.length < 2) return;
      e.preventDefault();
      if (!e.ctrlKey) {
        setYZoom(prev => Math.max(0.05, Math.min(1, prev * (e.deltaY > 0 ? 1.18 : 1 / 1.18))));
        return;
      }
      const rect = el.getBoundingClientRect();
      const svgX = (e.clientX - rect.left) * (600 / rect.width);
      const curLo = xRange ? xRange[0] : 0;
      const curHi = xRange ? xRange[1] : sizes.length - 1;
      const curSpan = curHi - curLo;
      const frac = Math.max(0, Math.min(1, (svgX - 60) / 418));
      const factor = e.deltaY > 0 ? 1.35 : 1 / 1.35;
      const newSpan = Math.max(1, Math.min(sizes.length - 1, curSpan * factor));
      const center = curLo + frac * curSpan;
      let newLo = Math.round(center - frac * newSpan);
      let newHi = newLo + Math.round(newSpan);
      if (newLo < 0) { newLo = 0; newHi = Math.min(sizes.length - 1, Math.round(newSpan)); }
      if (newHi >= sizes.length) { newHi = sizes.length - 1; newLo = Math.max(0, newHi - Math.round(newSpan)); }
      if (newLo <= 0 && newHi >= sizes.length - 1) setXRange(null);
      else setXRange([newLo, newHi]);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [sizes, xRange]);

  const VW = 600;
  const VH = 360;
  const pL = 60, pR = 122, pT = 15, pB = 42;
  // Extrapolation zone: 36px (non-expanded) — collapses when expanded since projSizes fill iW
  const extraZoneW = expanded ? 0 : 36;
  const iW = VW - pL - pR;
  const iH = VH - pT - pB;

  const visSizes = xRange ? sizes.slice(xRange[0], xRange[1] + 1) : sizes;

  // Projected sizes: 10 steps from 10× to 100× the last measured n (shown when expanded)
  const _globalLastN = (() => {
    let mx = 0;
    for (const id of algos) {
      const pts = (data[id] ?? []).filter(p => visSizes.includes(p.n) && !p.timedOut);
      if (pts.length) mx = Math.max(mx, Math.max(...pts.map(p => p.n)));
    }
    return mx || (visSizes[visSizes.length - 1] ?? 1000);
  })();
  const projSizes = expanded
    ? Array.from({ length: 10 }, (_, i) => _globalLastN * (i + 1) * 10)
    : [];
  const displaySizes = expanded ? [...visSizes, ...projSizes] : visSizes;

  const xAt = (n: number): number => {
    const idx = displaySizes.indexOf(n);
    if (idx < 0) return pL;
    return displaySizes.length === 1 ? pL + iW / 2 : pL + (idx / (displaySizes.length - 1)) * iW;
  };

  const getTime = (p: CurvePoint) => p.meanMs ?? p.timeMs;
  const getValue = (p: CurvePoint) =>
    mode === "space"       ? (p.spaceBytes ?? 0) :
    mode === "ratio"       ? (p.n > 1 ? getTime(p) / (p.n * Math.log2(p.n)) : 0) :
    mode === "space-ratio" ? (p.n > 1 ? (p.spaceBytes ?? 0) / (p.n * Math.log2(p.n)) : 0) :
    getTime(p);
  const fmtY =
    mode === "space" ? fmtBytes :
    mode === "ratio" ? (v: number) => {
      const ns = v * 1e6;
      if (ns >= 1000) return `${(ns / 1000).toFixed(1)}µs`;
      if (ns >= 0.1)  return `${ns.toFixed(ns >= 10 ? 0 : 1)}ns`;
      return `${(ns * 1000).toFixed(0)}ps`;
    } :
    mode === "space-ratio" ? (v: number) => {
      if (v >= 1)    return `${v.toFixed(1)}B`;
      if (v >= 0.01) return `${(v * 1000).toFixed(0)}mB`;
      return `${(v * 1e6).toFixed(0)}µB`;
    } :
    fmtTime;

  // Pre-compute one fit per algo — reused for y-scale extension and tail drawing.
  // Avoids calling fitLogLog twice per algo per render.
  const extraFits = new Map<string, FitResult | null>(
    algos.map(id => {
      const vp = (data[id] ?? [])
        .filter(p => visSizes.includes(p.n) && !p.timedOut && getValue(p) > 0)
        .sort((a, b) => a.n - b.n);
      const fit = vp.length >= 2
        ? fitLogLog(vp.map(p => ({ n: p.n, val: getValue(p) })))
        : null;
      return [id, fit] as [string, FitResult | null];
    })
  );

  // Include capped extrapolated endpoints so the y-axis actually accommodates the projections.
  // Cap at 4× measured max to prevent O(n²) tails from collapsing the rest of the chart.
  const measuredValues = algos.flatMap(id => (data[id] ?? []).filter(p => visSizes.includes(p.n)).map(getValue));
  const measuredMax    = Math.max(...measuredValues, mode === "space" ? 1 : 0.001);
  const extrapValues: number[] = [];
  for (const id of algos) {
    const fit = extraFits.get(id);
    if (!fit) continue;
    const vp = (data[id] ?? []).filter(p => visSizes.includes(p.n) && !p.timedOut && getValue(p) > 0).sort((a, b) => a.n - b.n);
    if (vp.length < 2) continue;
    if (expanded) {
      // Include all valid projected values — y-axis scales to fit them
      for (const pn of projSizes) {
        const ev = fit.k * fit.fn(pn);
        if (isFinite(ev) && ev > 0) extrapValues.push(ev);
      }
    } else {
      const lastN = vp[vp.length - 1].n;
      const ev    = fit.k * fit.fn(lastN * 4);
      if (isFinite(ev) && ev > 0 && ev <= measuredMax * 4) extrapValues.push(ev);
    }
  }

  const allValues = [...measuredValues, ...extrapValues];
  const rawMaxY   = Math.max(...allValues, mode === "space" ? 1 : 0.001);
  const maxY      = rawMaxY * yZoom;
  const minPosY   = Math.max(1e-9, Math.min(...allValues.filter(v => v > 0), rawMaxY));
  const logMinY   = Math.log10(minPosY * 0.5);
  const logMaxY   = Math.log10(maxY);
  const yAt = (v: number): number => {
    if (!yLogScale || v <= 0) return pT + iH - (v / maxY) * iH;
    const lv = Math.log10(Math.max(v, minPosY * 0.1));
    return pT + iH - ((lv - logMinY) / (logMaxY - logMinY)) * iH;
  };

  // Build y-axis ticks — log: decade ticks; linear: 4 evenly spaced
  const yTicks: { v: number; y: number }[] = yLogScale
    ? (() => {
        const ticks: { v: number; y: number }[] = [];
        for (let e = Math.floor(logMinY); e <= Math.ceil(logMaxY); e++) {
          const v = Math.pow(10, e);
          const y = yAt(v);
          if (y >= pT - 2 && y <= pT + iH + 2) ticks.push({ v, y });
        }
        return ticks;
      })()
    : [0.25, 0.5, 0.75, 1].map(f => ({ v: maxY * f, y: yAt(maxY * f) }));

  const getSvgX = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return ((e.clientX - rect.left) / rect.width) * VW;
  };

  const getSvgY = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return ((e.clientY - rect.top) / rect.height) * VH;
  };

  const snapToSize = (svgX: number) => {
    let best = displaySizes[0], bestDist = Infinity;
    displaySizes.forEach(n => { const d = Math.abs(xAt(n) - svgX); if (d < bestDist) { bestDist = d; best = n; } });
    return best;
  };

  // Effective active n: pinned overrides hover
  const effectiveN = pinnedN ?? activeN;

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const svgX = getSvgX(e);
    if (locked) {
      if (!pinnedN && onNChange && visSizes.length) onNChange(snapToSize(svgX));
      return;
    }
    if (dragStart !== null) {
      setDragCur(svgX);
      if (interactMode === "zoom") setDragCurY(getSvgY(e));
    }
  };

  const handleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!locked) return;
    const svgX = getSvgX(e);
    const n = snapToSize(svgX);
    if (pinnedN === n) {
      setPinnedN(null);
      if (onNChange && visSizes.length) onNChange(n);
    } else {
      setPinnedN(n);
    }
  };

  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if (locked) return;
    e.preventDefault();
    const x = getSvgX(e);
    setDragStart(x); setDragCur(x);
    if (interactMode === "zoom") {
      const y = getSvgY(e);
      setDragStartY(y); setDragCurY(y);
    }
  };

  const clearDrag = () => {
    setDragStart(null); setDragCur(null);
    setDragStartY(null); setDragCurY(null);
  };

  const applyXZoom = (x0: number, x1: number) => {
    if (x1 - x0 <= 8) return;
    const baseStart = xRange?.[0] ?? 0;
    const baseLen   = xRange ? xRange[1] - xRange[0] : sizes.length - 1;
    const f0 = Math.max(0, (x0 - pL) / iW);
    const f1 = Math.min(1, (x1 - pL) / iW);
    const i0 = baseStart + Math.round(f0 * baseLen);
    const i1 = baseStart + Math.round(f1 * baseLen);
    if (i1 > i0) setXRange([i0, Math.min(i1, sizes.length - 1)]);
  };

  const handleMouseUp = () => {
    if (locked || dragStart === null || dragCur === null) { clearDrag(); return; }
    const x0 = Math.min(dragStart, dragCur);
    const x1 = Math.max(dragStart, dragCur);
    if (interactMode === "brush") {
      applyXZoom(x0, x1);
    } else if (dragStartY !== null && dragCurY !== null) {
      // box zoom: zoom x-range + y-range to the selected rectangle
      applyXZoom(x0, x1);
      const y0 = Math.min(dragStartY, dragCurY);
      const y1 = Math.max(dragStartY, dragCurY);
      if (y1 - y0 > 8) {
        // y0 is visually higher = larger value; clamp to data area
        const topVal = Math.max(0, (pT + iH - y0) / iH * maxY);
        if (topVal > 0) setYZoom(prev => Math.max(0.05, (topVal / rawMaxY) * prev));
      }
    }
    clearDrag();
  };

  const selRect = dragStart !== null && dragCur !== null
    ? {
        x: Math.max(pL, Math.min(dragStart, dragCur)),
        w: Math.min(Math.abs(dragCur - dragStart), iW),
        y: interactMode === "zoom" && dragStartY !== null && dragCurY !== null
          ? Math.max(pT, Math.min(dragStartY, dragCurY)) : pT,
        h: interactMode === "zoom" && dragStartY !== null && dragCurY !== null
          ? Math.min(Math.abs(dragCurY - dragStartY), iH) : iH,
      }
    : null;

  const isZoomed = yZoom < 0.99 || xRange !== null;

  // Build sorted bubble data for effectiveN column
  const bubbles = effectiveN != null && visSizes.includes(effectiveN)
    ? algos
        .map(id => ({ id, pt: data[id]?.find(p => p.n === effectiveN) }))
        .filter((x): x is { id: string; pt: CurvePoint } => !!x.pt && !x.pt.timedOut)
        .sort((a, b) => getValue(a.pt) - getValue(b.pt))
    : [];

  // Estimated bubbles for projected sizes (expanded mode)
  const projBubbles = expanded && effectiveN != null && projSizes.includes(effectiveN)
    ? algos
        .flatMap(id => {
          const fit = extraFits.get(id);
          if (!fit) return [];
          const v = fit.k * fit.fn(effectiveN);
          if (!isFinite(v) || v <= 0) return [];
          return [{ id, v }];
        })
        .sort((a, b) => a.v - b.v)
    : [];

  const bigORefs = mode === "space" ? SPACE_BIG_O_REFS : BIG_O_REFS;

  // Per-reference calibration constants — each curve independently fitted to the geometric
  // mean of all measured data, so every complexity class is visible at the right scale.
  // c_i = exp( mean_over_all_pts( log(measured / f_i(n)) ) )
  const bigOCalibMap = (() => {
    const map = new Map<string, number>();
    const allPts: { n: number; v: number }[] = [];
    for (const id of algos) {
      for (const p of (data[id] ?? [])) {
        if (p.timedOut || !visSizes.includes(p.n)) continue;
        const v = mode === "space" ? (p.spaceBytes ?? 0) : (p.meanMs ?? p.timeMs);
        if (v > 0) allPts.push({ n: p.n, v });
      }
    }
    for (const ref of bigORefs) {
      if (!allPts.length) { map.set(ref.id, 0); continue; }
      let logSum = 0, count = 0;
      for (const { n, v } of allPts) {
        const fn = ref.fn(n);
        if (fn > 0) { logSum += Math.log(v / fn); count++; }
      }
      map.set(ref.id, count > 0 ? Math.exp(logSum / count) : 0);
    }
    return map;
  })();
  const bigOCalibC = [...bigOCalibMap.values()].find(v => v > 0) ?? 0; // kept for condition checks

const overlayBtnBase: React.CSSProperties = btn("secondary", {
    fontSize: 9, padding: "2px 5px", borderRadius: 4, background: "var(--color-surface-2)",
  });

  return (
    <div style={{ position: "relative", userSelect: "none" }}>
      <div className="print:hidden" style={{ position: "absolute", top: 20, left: `calc(${(pL / VW * 100).toFixed(2)}% + 10px)`, zIndex: 2, display: "flex", flexDirection: "row", alignItems: "center", gap: 4 }}>
        {/* Lock toggle */}
        <button
          onClick={() => setLocked(l => !l)}
          style={{ ...overlayBtnBase, color: locked ? "var(--color-muted)" : "var(--color-accent)", border: `1px solid ${locked ? "var(--color-border)" : "var(--color-accent)"}` }}
          title={locked ? "Unlock to enable interactions" : "Lock chart"}
        >
          {locked ? <Lock size={8} /> : <Unlock size={8} />}
          {locked ? "locked" : "unlocked"}
        </button>
        {/* Expand toggle — shows 10 projected sizes at 10–100× last measured n */}
        <button
          onClick={() => setExpanded(e => !e)}
          style={{ ...overlayBtnBase, color: expanded ? "var(--color-accent)" : "var(--color-muted)", border: `1px solid ${expanded ? "var(--color-accent)" : "var(--color-border)"}` }}
          title={expanded ? "Collapse to measured range" : "Project 10–100× beyond last measured n"}
        >
          {expanded ? "collapse" : "expand"}
        </button>
        {/* Mode toggle + reset — to the right of lock button when unlocked */}
        {!locked && (
          <>
            <div style={{ display: "flex", borderRadius: 4, overflow: "hidden", border: "1px solid var(--color-border)" }}>
              {(["brush", "zoom"] as const).map(m => (
                <button
                  key={m}
                  onClick={() => setInteractMode(m)}
                  style={btn(interactMode === m ? "primary" : "ghost", {
                    fontSize: 9, padding: "2px 6px", borderRadius: 0,
                    background: interactMode === m ? "var(--color-accent)" : "var(--color-surface-2)",
                  })}
                  title={m === "brush" ? "Drag to select x-range and zoom in" : "Drag or scroll to zoom y-axis"}
                >
                  {m}
                </button>
              ))}
            </div>
            {isZoomed && (
              <button onClick={() => { setYZoom(1); setXRange(null); }} style={{ ...overlayBtnBase, color: "var(--color-muted)" }}>
                reset
              </button>
            )}
          </>
        )}
        {/* Big-O reference overlay toggle */}
        {mode !== "ratio" && mode !== "space-ratio" && (
          <button
            onClick={() => setShowBigORefs(v => !v)}
            style={{ ...overlayBtnBase, color: showBigORefs ? "var(--color-accent)" : "var(--color-muted)", border: `1px solid ${showBigORefs ? "var(--color-accent)" : "var(--color-border)"}` }}
            title={showBigORefs ? "Hide complexity reference curves" : "Show complexity reference curves (O(n), O(n log n), O(n log²n), O(n²))"}
          >
            O(·)
          </button>
        )}
        {/* Log/linear Y toggle */}
        <button
          onClick={() => setYLogScale(v => !v)}
          style={{ ...overlayBtnBase, color: yLogScale ? "var(--color-accent)" : "var(--color-muted)", border: `1px solid ${yLogScale ? "var(--color-accent)" : "var(--color-border)"}` }}
          title={yLogScale ? "Switch to linear Y scale" : "Switch to log Y scale"}
        >
          {yLogScale ? "log" : "lin"}
        </button>
        {/* Pinned crosshair indicator */}
        {pinnedN != null && (
          <button
            onClick={() => setPinnedN(null)}
            style={{ ...overlayBtnBase, color: "var(--color-accent)", border: "1px solid var(--color-accent)" }}
            title="Click to unpin crosshair"
          >
            📌 n={fmtN(pinnedN)}
          </button>
        )}
      </div>
    <svg
      ref={svgRef}
      viewBox={`0 0 ${VW} ${VH}`}
      style={{ width: "100%", height: "auto", aspectRatio: `${VW} / ${VH}`, display: "block", cursor: locked ? "crosshair" : "crosshair" }}
      aria-label={mode === "space" ? "Space usage vs input size per algorithm" : "Performance curve: time vs input size per algorithm"}
      onMouseMove={handleMouseMove}
      onClick={handleClick}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => { if (!pinnedN) onNChange?.(null); clearDrag(); }}
    >
      <defs>
        <clipPath id="inner-plot-clip">
          <rect x={pL} y={pT} width={iW} height={iH} />
        </clipPath>
      </defs>
      {/* horizontal grid + y labels */}
      {yTicks.map(({ v, y }) => (
        <g key={v}>
          <line x1={pL} y1={y} x2={VW - pR} y2={y}
            stroke="var(--color-border)" strokeWidth={0.6} strokeDasharray="3 3" />
          <text x={pL - 5} y={y + 4} textAnchor="end" fontSize={9}
            fill="var(--color-muted)">{fmtY(v)}</text>
        </g>
      ))}

      {/* ── Worst-case zone shading ── */}
      {mode === "time" && (() => {
        const slowAlgos = algos.filter(id => SLOW_IDS.has(id));
        if (slowAlgos.length === 0 || visSizes.length < 2) return null;
        // Find the x pixel at SLOW_THRESHOLD or the first visible n past it
        const threshN = visSizes.find(n => n >= SLOW_THRESHOLD) ?? visSizes[visSizes.length - 1];
        const x0 = xAt(threshN);
        const x1 = pL + iW;
        if (x1 - x0 < 4) return null;
        return (
          <g style={{ pointerEvents: "none" }}>
            <rect x={x0} y={pT} width={x1 - x0} height={iH}
              fill="rgba(239,68,68,0.06)" clipPath="url(#inner-plot-clip)" />
            <text x={Math.max(x0 + 2, (x0 + x1) / 2)} y={pT + 10} textAnchor="middle" fontSize={7.5}
              fontFamily="monospace" fill="rgba(239,68,68,0.5)" style={{ pointerEvents: "none" }}>
              O(n²) slow zone
            </text>
          </g>
        );
      })()}
      {/* Best-case zone: very small n where even O(n²) is fine */}
      {mode === "time" && visSizes.length >= 2 && (() => {
        const fastBound = visSizes.find(n => n >= 1000) ?? visSizes[visSizes.length - 1];
        const x1 = xAt(fastBound);
        if (x1 - pL < 4) return null;
        return (
          <g style={{ pointerEvents: "none" }}>
            <rect x={pL} y={pT} width={x1 - pL} height={iH}
              fill="rgba(78,124,82,0.05)" clipPath="url(#inner-plot-clip)" />
            <text x={pL + (x1 - pL) / 2} y={pT + 10} textAnchor="middle" fontSize={7.5}
              fontFamily="monospace" fill="rgba(78,124,82,0.4)" style={{ pointerEvents: "none" }}>
              all algos fast
            </text>
          </g>
        );
      })()}

      {/* axes */}
      <line x1={pL} y1={pT} x2={pL} y2={pT + iH} stroke="var(--color-border)" strokeWidth={0.8} />
      <line x1={pL} y1={pT + iH} x2={VW - pR} y2={pT + iH} stroke="var(--color-border)" strokeWidth={0.8} />

      {/* Big-O reference curves + LEFT-anchored ref labels.
          Labels reflect the hovered N (effectiveN) when set, otherwise show
          the projection at the largest measured N. */}
      {showBigORefs && mode !== "ratio" && mode !== "space-ratio" && visSizes.length >= 1 && bigOCalibC > 0 && (() => {
        const maxN  = visSizes[visSizes.length - 1];
        // labelN: what N the left labels report. Tracks the hovered/pinned N when present.
        const labelN = effectiveN ?? maxN;
        const isHovered = effectiveN != null;
        const STEPS = 80;
        // Anchor labels to the LEFT edge of the plot area (just inside)
        const lx    = pL + 6;

        const refY = (refId: string, fn: (n: number) => number, n: number) => {
          const c = bigOCalibMap.get(refId) ?? 0;
          return Math.max(pT, pT + iH - (c * fn(n) / maxY) * iH);
        };

        // Build pool of ONLY Big-O reference labels.
        // Sort descending by value so slowest (n²) is at top, fastest (log n) at bottom —
        // matches the visual order of the curves themselves.
        const pool = bigORefs
          .map((ref, ri) => ({ ri, ref, v: (bigOCalibMap.get(ref.id) ?? 0) * ref.fn(labelN) }))
          .filter(item => isFinite(item.v) && item.v > 0)
          .sort((a, b) => b.v - a.v);

        const labelTop    = pT + 6;
        const labelBottom = pT + iH - 12;
        const total       = pool.length;
        const step        = total > 1 ? (labelBottom - labelTop) / (total - 1) : 0;
        // index 0 (slowest) → top; index n-1 (fastest) → bottom
        const assignedY   = pool.map((_, rank) => labelTop + rank * step);

        // Draw ref curve polylines first (background layer)
        const refPolylines = bigORefs.map(ref => {
          const pts: string[] = [];
          for (let i = 0; i <= STEPS; i++) {
            const t = i / STEPS;
            const x = pL + t * iW;
            const fi = t * (visSizes.length - 1);
            const lo = Math.floor(fi), hi2 = Math.ceil(fi);
            const ft = fi - lo;
            const n  = lo === hi2 ? visSizes[lo] : visSizes[lo] * Math.pow(visSizes[hi2] / visSizes[lo], ft);
            pts.push(`${x.toFixed(1)},${refY(ref.id, ref.fn, n).toFixed(1)}`);
          }
          return (
            <polyline key={`refline-${ref.id}`}
              points={pts.join(" ")}
              fill="none"
              stroke={ref.color}
              strokeWidth={1.5}
              strokeDasharray="5 3"
              opacity={ref.id === "logn" || ref.id === "1" ? 0.9 : 0.65}
              clipPath="url(#inner-plot-clip)"
              style={{ pointerEvents: "none" }}
            />
          );
        });

        // Draw left-anchored ref labels: dashed swatch + "O(n²)  14.3s @ n=1M"
        // When hovering, accent the labels (brighter opacity) to signal they're live.
        const labels = pool.map((item, rank) => {
          const labelY = assignedY[rank];
          const ref    = item.ref;
          const predMs = item.v;
          const clipped = predMs > maxY;
          const valStr = mode === "space" ? fmtBytes(predMs) : fmtPredicted(predMs);
          return (
            <g key={`refl-${ref.id}`} style={{ pointerEvents: "none" }}>
              {/* dashed-line swatch in the ref's color */}
              <line x1={lx} y1={labelY - 2} x2={lx + 12} y2={labelY - 2}
                stroke={ref.color} strokeWidth={1.5} strokeDasharray="4 3" opacity={0.9} />
              <text x={lx + 16} y={labelY} textAnchor="start" fontSize={8}
                fontFamily="monospace" fill={ref.color} opacity={0.95} fontWeight={600}>
                {ref.label}
              </text>
              <text x={lx + 16} y={labelY + 8} textAnchor="start" fontSize={7}
                fontFamily="monospace" fill={ref.color} opacity={isHovered ? 0.95 : 0.65}
                fontWeight={isHovered ? 600 : 400}>
                {clipped ? "↑ " : ""}{valStr} @ n={fmtN(labelN)}
              </text>
            </g>
          );
        });

        return <>{refPolylines}{labels}</>;
      })()}

      {/* Separator — between measured data and projection zone */}
      {visSizes.length >= 2 && (() => {
        const sepX = expanded ? xAt(visSizes[visSizes.length - 1]) : pL + iW;
        return (
          <line
            x1={sepX} y1={pT} x2={sepX} y2={pT + iH}
            stroke="var(--color-border)" strokeWidth={0.8} strokeDasharray="3 3" opacity={0.6}
            style={{ pointerEvents: "none" }}
          />
        );
      })()}

      {/* vertical grid + x tick labels (measured) */}
      {(() => {
        const tickEvery = expanded ? 1 : Math.max(1, Math.ceil(visSizes.length / 5));
        return visSizes.map((n, i) => {
          const x = xAt(n);
          const showLabel = i % tickEvery === 0 || i === visSizes.length - 1;
          return (
            <g key={n}>
              <line x1={x} y1={pT} x2={x} y2={pT + iH}
                stroke="var(--color-border)" strokeWidth={0.4} strokeDasharray="2 5" opacity={0.5} />
              {showLabel && (
                <text x={x} y={VH - pB + 14} textAnchor="middle" fontSize={9}
                  fill="var(--color-muted)">{fmtN(n)}</text>
              )}
            </g>
          );
        });
      })()}
      {/* x label at end of extrapolation zone (non-expanded only) */}
      {!expanded && visSizes.length >= 1 && (() => {
        const lastN = visSizes[visSizes.length - 1];
        const x = pL + iW + extraZoneW;
        return (
          <text key="extrap-end" x={x} y={VH - pB + 14} textAnchor="middle" fontSize={8}
            fill="var(--color-muted)" opacity={0.5}>{fmtN(lastN * 4)}</text>
        );
      })()}
      {/* x tick labels for projected sizes (every other one to avoid clutter) */}
      {expanded && projSizes.map((n, i) => {
        if (i % 2 !== 0) return null; // show every other
        const x = xAt(n);
        return (
          <g key={`proj-${n}`}>
            <line x1={x} y1={pT} x2={x} y2={pT + iH}
              stroke="var(--color-border)" strokeWidth={0.3} strokeDasharray="2 6" opacity={0.3} />
            <text x={x} y={VH - pB + 14} textAnchor="middle" fontSize={7.5}
              fill="var(--color-muted)" opacity={0.6}>{fmtN(n)}</text>
          </g>
        );
      })}

      {/* x-axis label */}
      <text x={pL + iW / 2} y={VH - 3} textAnchor="middle" fontSize={9}
        fill="#ef5350" fontStyle="italic">input size (n)</text>

      {/* y-axis title — rotated */}
      <text
        x={0} y={0}
        transform={`translate(9, ${pT + iH / 2}) rotate(-90)`}
        textAnchor="middle" fontSize={8}
        fill={mode === "space" || mode === "space-ratio" ? "#64b5f6" : "#66bb6a"} fontStyle="italic" fontFamily="monospace"
      >
        {mode === "ratio" ? "t / (n · log₂n)" : mode === "space" ? "memory" : "time"}
      </text>

      {/* Crossover annotations — n where algo A's fitted curve overtakes algo B */}
      {mode !== "ratio" && mode !== "space-ratio" && (() => {
        const ids = algos.filter(id => extraFits.get(id) != null);
        if (ids.length < 2) return null;
        const annotations: { n: number; idA: string; idB: string }[] = [];
        for (let ai = 0; ai < ids.length; ai++) {
          for (let bi = ai + 1; bi < ids.length; bi++) {
            const idA = ids[ai], idB = ids[bi];
            const fA = extraFits.get(idA)!, fB = extraFits.get(idB)!;
            if (!fA || !fB) continue;
            // Crossover: a1·n^b1 = a2·n^b2  →  n = (a2/a1)^(1/(b1−b2))
            const db = fA.exp - fB.exp;
            if (Math.abs(db) < 0.01) continue; // parallel — no crossover
            const crossN = Math.pow(fB.k / fA.k, 1 / db);
            const minN = Math.min(...visSizes), maxN = Math.max(...displaySizes) * 2;
            if (!isFinite(crossN) || crossN <= minN || crossN > maxN) continue;
            // Verify actual ordering flips (handles coefficient direction)
            const preA = fA.k * fA.fn(crossN * 0.5), preB = fB.k * fB.fn(crossN * 0.5);
            const postA = fA.k * fA.fn(crossN * 2), postB = fB.k * fB.fn(crossN * 2);
            if (!((preA < preB && postA > postB) || (preA > preB && postA < postB))) continue;
            annotations.push({ n: crossN, idA, idB });
          }
        }
        return annotations.map(({ n, idA, idB }) => {
          const x = xAt(n);
          if (x < pL || x > pL + iW + extraZoneW) return null;
          const colA = ALGO_COLORS[idA] ?? "#888", colB = ALGO_COLORS[idB] ?? "#888";
          return (
            <g key={`cross-${idA}-${idB}`} style={{ pointerEvents: "none" }}>
              <line x1={x} y1={pT + 4} x2={x} y2={pT + iH}
                stroke="rgba(255,255,255,0.18)" strokeWidth={1} strokeDasharray="3 4" />
              {/* X marker */}
              <text x={x} y={pT + 2} textAnchor="middle" fontSize={7.5} fontFamily="monospace"
                fill="rgba(255,255,255,0.55)">✕</text>
              {/* Tooltip on the bottom axis */}
              <text x={x} y={pT + iH + 8} textAnchor="middle" fontSize={6.5} fontFamily="monospace"
                fill={colA} opacity={0.8}>{ALGO_NAMES[idA]?.split(" ")[0]}</text>
              <text x={x} y={pT + iH + 15} textAnchor="middle" fontSize={6.5} fontFamily="monospace"
                fill="rgba(255,255,255,0.3)">⇄</text>
              <text x={x} y={pT + iH + 22} textAnchor="middle" fontSize={6.5} fontFamily="monospace"
                fill={colB} opacity={0.8}>{ALGO_NAMES[idB]?.split(" ")[0]}</text>
            </g>
          );
        });
      })()}

      {/* hover / pinned crosshair */}
      {effectiveN != null && (() => {
        const x = xAt(effectiveN);
        return (
          <g style={{ pointerEvents: "none" }}>
            <line x1={x} y1={pT} x2={x} y2={pT + iH}
              stroke={pinnedN != null ? "var(--color-accent)" : "var(--color-text)"}
              strokeWidth={pinnedN != null ? 1.5 : 1} strokeDasharray="3 3"
              opacity={pinnedN != null ? 0.6 : 0.3} />
            {pinnedN != null && (
              <text x={x + 4} y={pT + 9} fontSize={7} fontFamily="monospace"
                fill="var(--color-accent)" opacity={0.8}>📌</text>
            )}
          </g>
        );
      })()}

      {/* Ghost runs — past benchmark results plotted as faded polylines so the
          user can compare against historical timings. Rendered first so the
          active curves overlap them. Opacity scales by recency: oldest ≈ 0.05,
          newest ≈ 0.30. Only the relevant mode is rendered (time vs space). */}
      {ghostMode && ghostRuns && (
        <g style={{ pointerEvents: "none" }} clipPath="url(#inner-plot-clip)">
          {algos.flatMap(id => {
            const runs = ghostRuns[id];
            if (!runs || runs.length === 0) return [];
            const color = ALGO_COLORS[id] ?? "#888";
            const isHl  = !highlight || highlight === id;
            const total = runs.length;
            return runs.map((run, idx) => {
              // idx=0 is the oldest, idx=total-1 is the newest.
              // Linear fade from 90% (newest) down toward 5% (oldest), spread
              // evenly across the stored runs so the relative ordering is
              // visually obvious even at the full GHOST_MAX of 100 entries.
              const ageFactor = (idx + 1) / total; // 1/n .. 1
              const opacity = (0.05 + 0.85 * ageFactor) * (isHl ? 1 : 0.25);
              // Build the polyline using the ghost run's (n, value) points.
              const sorted = [...run.points].sort((a, b) => a.n - b.n);
              const pts: string[] = [];
              for (const p of sorted) {
                const val = mode === "space"       ? (p.spaceBytes ?? 0)
                          : mode === "ratio"       ? (p.n > 1 ? (p.meanMs ?? p.timeMs) / (p.n * Math.log2(p.n)) : 0)
                          : mode === "space-ratio" ? (p.n > 1 ? (p.spaceBytes ?? 0) / (p.n * Math.log2(p.n)) : 0)
                          : (p.meanMs ?? p.timeMs);
                if (val <= 0) continue;
                pts.push(`${xAt(p.n).toFixed(1)},${yAt(val).toFixed(1)}`);
              }
              if (pts.length < 2) return null;
              return (
                <polyline
                  key={`ghost-${id}-${run.ts}`}
                  points={pts.join(" ")}
                  fill="none"
                  stroke={color}
                  strokeWidth={1}
                  strokeDasharray="2 2"
                  opacity={opacity}
                />
              );
            });
          })}
        </g>
      )}

      {/* variance error bands — rendered before curves so lines draw on top */}
      {algos.map(id => {
        const pts = [...(data[id] ?? [])].sort((a, b) => a.n - b.n).filter(p => !p.timedOut && p.meanMs != null && p.stdDev != null && p.stdDev > 0);
        if (pts.length < 2) return null;
        const color = ALGO_COLORS[id] ?? "#888";
        const isHl = !highlight || highlight === id;
        const upper = pts.map(p => `${xAt(p.n).toFixed(1)},${Math.max(pT, yAt(p.meanMs! - p.stdDev!)).toFixed(1)}`);
        const lower = [...pts].reverse().map(p => `${xAt(p.n).toFixed(1)},${Math.min(pT + iH, yAt(p.meanMs! + p.stdDev!)).toFixed(1)}`);
        return (
          <polygon key={`band-${id}`}
            points={[...upper, ...lower].join(" ")}
            fill={color} opacity={isHl ? 0.10 : 0.03}
            style={{ pointerEvents: "none", transition: "opacity 0.2s ease" }}
            clipPath="url(#inner-plot-clip)"
          />
        );
      })}

      {/* stdDev error bar whiskers — vertical lines with horizontal end caps */}
      {algos.map(id => {
        const pts = [...(data[id] ?? [])].sort((a, b) => a.n - b.n)
          .filter(p => !p.timedOut && p.stdDev != null && p.stdDev > 0 && p.meanMs != null);
        if (pts.length === 0) return null;
        const color = ALGO_COLORS[id] ?? "#888";
        const isHl = !highlight || highlight === id;
        return (
          <g key={`errbar-${id}`} opacity={isHl ? 0.55 : 0.1} clipPath="url(#inner-plot-clip)" style={{ pointerEvents: "none" }}>
            {pts.map(p => {
              const cx = xAt(p.n);
              const yTop = Math.max(pT, yAt(p.meanMs! - p.stdDev!));
              const yBot = Math.min(pT + iH, yAt(p.meanMs! + p.stdDev!));
              const capW = 3;
              return (
                <g key={p.n}>
                  <line x1={cx} y1={yTop} x2={cx} y2={yBot} stroke={color} strokeWidth={1.2} />
                  <line x1={cx - capW} y1={yTop} x2={cx + capW} y2={yTop} stroke={color} strokeWidth={1.2} />
                  <line x1={cx - capW} y1={yBot} x2={cx + capW} y2={yBot} stroke={color} strokeWidth={1.2} />
                </g>
              );
            })}
          </g>
        );
      })}

      {/* variance timeline — individual round dots, one per (n, round) */}
      {algos.map(id => {
        const pts = [...(data[id] ?? [])].sort((a, b) => a.n - b.n)
          .filter(p => !p.timedOut && p.roundTimes && p.roundTimes.length > 1);
        if (pts.length === 0) return null;
        const color = ALGO_COLORS[id] ?? "#888";
        const isHl = !highlight || highlight === id;
        return (
          <g key={`rounds-${id}`} opacity={isHl ? 1 : 0.15} clipPath="url(#inner-plot-clip)" style={{ pointerEvents: "none" }}>
            {pts.flatMap(p =>
              p.roundTimes!.map((t, ri) => {
                const cx = xAt(p.n);
                const cy = Math.max(pT, Math.min(pT + iH, yAt(mode === "ratio" ? (p.n > 1 ? t / (p.n * Math.log2(p.n)) : 0) : t)));
                const isBest = t === p.timeMs;
                return (
                  <circle
                    key={`${p.n}-${ri}`}
                    cx={cx} cy={cy}
                    r={isBest ? 3 : 2}
                    fill={isBest ? color : "none"}
                    stroke={color}
                    strokeWidth={isBest ? 0 : 0.8}
                    opacity={isBest ? 0.9 : 0.45}
                  />
                );
              })
            )}
          </g>
        );
      })}

      {/* curves + dots */}
      {algos.map(id => {
        const pts = [...(data[id] ?? [])].sort((a, b) => a.n - b.n);
        if (!pts.length) return null;
        const color = ALGO_COLORS[id] ?? "#888";
        const isHl = !highlight || highlight === id;
        const sw = isHl && highlight ? 2.5 : 1.75;

        // ── Extrapolation tail / projected curve ────────────────────────────
        const validPts = pts.filter(p => !p.timedOut && getValue(p) > 0);
        let extraTail: React.ReactNode = null;

        if (validPts.length >= 2 && visSizes.length >= 2) {
          const fit = extraFits.get(id);
          if (fit) {
            // log rate: empirical power-law exponent from data; fitted: same from fit shape
            const firstPt = validPts[0];
            const lastPt  = validPts[validPts.length - 1];
            const lnRatio = Math.log(lastPt.n / firstPt.n);
            const actualLogRate = lnRatio > 0
              ? Math.log(getValue(lastPt) / getValue(firstPt)) / lnRatio
              : 0;
            const fittedLogRate = lnRatio > 0 && fit.fn(firstPt.n) > 0
              ? Math.log(fit.fn(lastPt.n) / fit.fn(firstPt.n)) / lnRatio
              : 0;
            const tailOp = Math.max(0, Math.min(1, actualLogRate > 0 ? 1 : 0));
            const tailLabel = `n${toSup(actualLogRate.toFixed(2))}`;

            if (expanded && projSizes.length > 0) {
              // ── Expanded mode: draw projected curve using actual projSizes x positions ──
              const lastValidPt = validPts[validPts.length - 1];
              const connX = xAt(lastValidPt.n);
              const connY = Math.max(pT, Math.min(pT + iH, yAt(getValue(lastValidPt))));

              const projPts = projSizes.map(pn => {
                const v = fit.k * fit.fn(pn);
                const y = isFinite(v) && v > 0
                  ? Math.max(pT, Math.min(pT + iH, yAt(v)))
                  : null;
                return { n: pn, v, x: xAt(pn), y };
              });
              const validProj = projPts.filter((p): p is typeof p & { y: number } => p.y !== null);

              // Build segment list starting from the last measured point
              const segPts = [{ x: connX, y: connY }, ...validProj];

              extraTail = (
                <g style={{ pointerEvents: "none" }}>
                  {segPts.slice(1).map((pt, i) => (
                    <line key={i}
                      x1={segPts[i].x} y1={segPts[i].y}
                      x2={pt.x}        y2={pt.y}
                      stroke={color} strokeWidth={1.1}
                      strokeDasharray="4 3"
                      opacity={tailOp}
                      strokeLinecap="round"
                    />
                  ))}
                  {validProj.map((pp, i) => {
                    const isActive = effectiveN === pp.n;
                    return (
                    <g key={i}>
                      <circle cx={pp.x} cy={pp.y} r={isActive ? 4.5 : 3}
                        fill="var(--color-surface-2)"
                        stroke={color} strokeWidth={isActive ? 1.8 : 1.2}
                        opacity={tailOp + 0.1}
                        style={{ transition: "r 0.1s ease" }}
                      />
                      {/* value label every other point */}
                      {i % 2 === 1 && (
                        <text x={pp.x} y={pp.y - 5} textAnchor="middle"
                          fontSize={6} fontFamily="monospace"
                          fill={color} opacity={Math.min(1, tailOp + 0.2)}
                        >
                          {fmtY(pp.v)}
                        </text>
                      )}
                    </g>
                  );
                  })}
                  {/* rate badge at last projected point */}
                  {validProj.length > 0 && (() => {
                    const last = validProj[validProj.length - 1];
                    return (
                      <text x={last.x} y={last.y - 7} textAnchor="middle"
                        fontSize={6.5} fontFamily="monospace"
                        fill={color} opacity={Math.min(1, tailOp + 0.2)}
                      >
                        {tailLabel}
                      </text>
                    );
                  })()}
                </g>
              );
            } else if (!expanded) {
              // ── Non-expanded mode: narrow 4× extrapolation zone tail ──
              const lastN   = validPts[validPts.length - 1].n;
              const lastVal = getValue(validPts[validPts.length - 1]);
              const x0      = pL + iW;
              const x1      = pL + iW + extraZoneW;
              const STEPS   = 16;
              const tpts: string[] = [`${x0.toFixed(1)},${yAt(lastVal).toFixed(1)}`];
              for (let s = 1; s <= STEPS; s++) {
                const t  = s / STEPS;
                const n  = lastN * Math.pow(4, t);
                const v  = fit.k * fit.fn(n);
                const ex = x0 + t * (x1 - x0);
                const ey = Math.max(pT, Math.min(pT + iH, yAt(v)));
                tpts.push(`${ex.toFixed(1)},${ey.toFixed(1)}`);
              }
              const endV = fit.k * fit.fn(lastN * 4);
              const endY = Math.max(pT + 4, Math.min(pT + iH - 4, yAt(endV)));
              extraTail = (
                <g style={{ pointerEvents: "none" }}>
                  <polyline points={tpts.join(" ")} fill="none"
                    stroke={color} strokeWidth={1.1} strokeDasharray="2 2" opacity={tailOp} />
                  <text x={x1 - 1} y={endY - 3} textAnchor="end"
                    fontSize={6.5} fontFamily="monospace"
                    fill={color} opacity={Math.min(1, tailOp + 0.15)}
                  >
                    {tailLabel}
                  </text>
                </g>
              );
            }
          }
        }

        return (
          <g key={id} opacity={isHl ? 1 : 0.12} style={{ transition: "opacity 0.2s ease" }}>
            <g clipPath="url(#inner-plot-clip)">
              {pts.slice(1).map((p, i) => {
                const prev = pts[i];
                const dashed = prev.timedOut || p.timedOut;
                return (
                  <line key={p.n}
                    x1={xAt(prev.n)} y1={yAt(getValue(prev))}
                    x2={xAt(p.n)}   y2={yAt(getValue(p))}
                    stroke={color} strokeWidth={sw}
                    strokeDasharray={dashed ? "5 3" : undefined}
                    strokeLinecap="round"
                  />
                );
              })}
              {pts.map(p => {
                const cx = xAt(p.n), cy = yAt(getValue(p));
                const isActive = effectiveN != null && p.n === effectiveN;
                if (p.timedOut) {
                  const r = 4;
                  return (
                    <g key={p.n}>
                      <circle cx={cx} cy={cy} r={r + 1.5}
                        fill="var(--color-surface-2)" stroke={color} strokeWidth={1.5} />
                      <line x1={cx - r + 1} y1={cy - r + 1} x2={cx + r - 1} y2={cy + r - 1}
                        stroke={color} strokeWidth={1.5} strokeLinecap="round" />
                      <line x1={cx + r - 1} y1={cy - r + 1} x2={cx - r + 1} y2={cy + r - 1}
                        stroke={color} strokeWidth={1.5} strokeLinecap="round" />
                    </g>
                  );
                }
                return (
                  <circle key={p.n} cx={cx} cy={cy}
                    r={isActive ? 5 : 3.5}
                    fill={color}
                    stroke="var(--color-surface-2)"
                    strokeWidth={isActive ? 2 : 1.5}
                    style={{ transition: "r 0.1s ease" }}
                  />
                );
              })}
            </g>
            {extraTail}
          </g>
        );
      })}

      {/* data bubbles — rendered last so they float above curves */}
      {bubbles.length > 0 && effectiveN != null && (() => {
        const cx = xAt(effectiveN);
        const PAD = 10;
        const n = bubbles.length;
        const sorted = [...bubbles].sort((a, b) => yAt(getValue(a.pt)) - yAt(getValue(b.pt)));
        const maxPerCol = Math.max(1, Math.floor(iH / 11));
        const useColumns = n > maxPerCol;

        if (useColumns) {
          // Horizontal column layout: actual measurements extend RIGHT from crosshair
          const BH = 10, fs = 7, COL_W = 105;
          const goRight = cx <= VW * 0.65;
          return (
            <g style={{ pointerEvents: "none" }}>
              {sorted.map(({ id, pt }, i) => {
                const col = Math.floor(i / maxPerCol);
                const posInCol = i % maxPerCol;
                const colSize = Math.min(maxPerCol, n - col * maxPerCol);
                const dotCy = yAt(getValue(pt));
                const labelCy = colSize <= 1 ? pT + iH / 2
                  : pT + 5 + (iH - 10) * posInCol / (colSize - 1);
                const color = ALGO_COLORS[id] ?? "#888";
                const tVal = mode === "space" ? fmtBytes(pt.spaceBytes ?? 0) : fmtTime(pt.meanMs ?? pt.timeMs);
                const stdStr = mode !== "space" && pt.stdDev != null ? ` ±${fmtTime(pt.stdDev)}` : "";
                const label = `${ALGO_NAMES[id]}  ${tVal}${stdStr}`;
                const bw = label.length * (fs * 0.58) + PAD;
                const bx = goRight ? cx + 10 + col * COL_W : cx - 10 - (col + 1) * COL_W;
                const by = labelCy - BH / 2;
                return (
                  <g key={id}>
                    <line x1={cx} y1={dotCy} x2={goRight ? bx : bx + bw}
                      y2={labelCy} stroke={color} strokeWidth={0.7} opacity={0.35} />
                    <rect x={bx} y={by} width={bw} height={BH} rx={2} fill={color} opacity={0.93} />
                    <text x={bx + 3} y={by + BH - 2} fontSize={fs} fontWeight={700}
                      fill="#fff" style={{ letterSpacing: "0.01em" }}>
                      {ALGO_NAMES[id]}  {tVal}{stdStr && <tspan opacity={0.75} fontWeight={400}>{stdStr}</tspan>}
                    </text>
                    <circle cx={cx} cy={dotCy} r={4} fill={color}
                      stroke="var(--color-surface-2)" strokeWidth={1.5} />
                  </g>
                );
              })}
            </g>
          );
        }

        // Vertical spread
        const BH = Math.max(10, Math.min(16, n <= 1 ? 16 : Math.floor((iH - (n - 1)) / n)));
        const fs = BH >= 14 ? 9.5 : BH >= 12 ? 8.5 : 7;
        const flipRight = cx > VW * 0.6;
        const spreadCy = sorted.map((_, i) =>
          n === 1 ? pT + iH / 2 : pT + BH / 2 + (iH - BH) * i / (n - 1)
        );
        return (
          <g style={{ pointerEvents: "none" }}>
            {sorted.map(({ id, pt }, i) => {
              const dotCy = yAt(getValue(pt));
              const labelCy = spreadCy[i];
              const color = ALGO_COLORS[id] ?? "#888";
              const tVal = mode === "space" ? fmtBytes(pt.spaceBytes ?? 0) : fmtTime(pt.meanMs ?? pt.timeMs);
              const stdStr = mode !== "space" && pt.stdDev != null ? ` ±${fmtTime(pt.stdDev)}` : "";
              const label = `${ALGO_NAMES[id]}  ${tVal}${stdStr}`;
              const bw = label.length * (fs * 0.58) + PAD;
              const bx = flipRight ? cx - bw - 10 : cx + 10;
              const by = labelCy - BH / 2;
              return (
                <g key={id}>
                  <line x1={cx} y1={dotCy} x2={flipRight ? bx + bw : bx}
                    y2={labelCy} stroke={color} strokeWidth={0.8} opacity={0.35} />
                  <rect x={bx} y={by} width={bw} height={BH} rx={3}
                    fill={color} opacity={0.93} />
                  <text x={bx + 4} y={by + BH - 3} fontSize={fs} fontWeight={700}
                    fill="#fff" style={{ letterSpacing: "0.01em" }}>
                    {ALGO_NAMES[id]}  {tVal}{stdStr && <tspan opacity={0.75} fontWeight={400}>{stdStr}</tspan>}
                  </text>
                  <circle cx={cx} cy={dotCy} r={4} fill={color}
                    stroke="var(--color-surface-2)" strokeWidth={1.5} />
                </g>
              );
            })}
          </g>
        );
      })()}
      {/* Estimated bubbles for projected sizes */}
      {projBubbles.length > 0 && effectiveN != null && (() => {
        const cx = xAt(effectiveN);
        const PAD = 10;
        const sorted = [...projBubbles].sort((a, b) => yAt(a.v) - yAt(b.v));
        const n = sorted.length;
        const maxPerCol = Math.max(1, Math.floor(iH / 11));
        const useColumns = n > maxPerCol;

        if (useColumns) {
          const BH = 10, fs = 7, COL_W = 105;
          const goRight = cx <= VW * 0.65;
          return (
            <g style={{ pointerEvents: "none" }}>
              {sorted.map(({ id, v }, i) => {
                const col = Math.floor(i / maxPerCol);
                const posInCol = i % maxPerCol;
                const colSize = Math.min(maxPerCol, n - col * maxPerCol);
                const dotCy = Math.max(pT + 8, Math.min(pT + iH - 8, yAt(v)));
                const labelCy = colSize <= 1 ? pT + iH / 2
                  : pT + 5 + (iH - 10) * posInCol / (colSize - 1);
                const color = ALGO_COLORS[id] ?? "#888";
                const label = `${ALGO_NAMES[id]}  ~est: ${fmtY(v)}`;
                const bw = label.length * (fs * 0.58) + PAD;
                const bx = goRight ? cx + 10 + col * COL_W : cx - 10 - (col + 1) * COL_W;
                const by = labelCy - BH / 2;
                return (
                  <g key={id}>
                    <line x1={cx} y1={dotCy} x2={goRight ? bx : bx + bw}
                      y2={labelCy} stroke={color} strokeWidth={0.7} opacity={0.4} />
                    <rect x={bx} y={by} width={bw} height={BH} rx={2}
                      fill={color} opacity={0.7} stroke={color} strokeWidth={1} strokeDasharray="3 2" />
                    <text x={bx + 3} y={by + BH - 2} fontSize={fs} fontWeight={700}
                      fill="#fff" style={{ letterSpacing: "0.01em" }}>
                      {label}
                    </text>
                    <circle cx={cx} cy={dotCy} r={4.5}
                      fill="var(--color-surface-2)" stroke={color} strokeWidth={2} />
                  </g>
                );
              })}
            </g>
          );
        }

        const BH = Math.max(10, Math.min(16, n <= 1 ? 16 : Math.floor((iH - (n - 1)) / n)));
        const fs = BH >= 14 ? 9.5 : BH >= 12 ? 8.5 : 7;
        const flipRight = cx > VW * 0.6;
        const spreadCy = sorted.map((_, i) =>
          n === 1 ? pT + iH / 2 : pT + BH / 2 + (iH - BH) * i / (n - 1)
        );
        return (
          <g style={{ pointerEvents: "none" }}>
            {sorted.map(({ id, v }, i) => {
              const dotCy = Math.max(pT + 8, Math.min(pT + iH - 8, yAt(v)));
              const labelCy = spreadCy[i];
              const color = ALGO_COLORS[id] ?? "#888";
              const label = `${ALGO_NAMES[id]}  ~est: ${fmtY(v)}`;
              const bw = label.length * (fs * 0.58) + PAD;
              const bx = flipRight ? cx - bw - 10 : cx + 10;
              const by = labelCy - BH / 2;
              return (
                <g key={id}>
                  <line x1={cx} y1={dotCy} x2={flipRight ? bx + bw : bx}
                    y2={labelCy} stroke={color} strokeWidth={0.8} opacity={0.4} />
                  <rect x={bx} y={by} width={bw} height={BH} rx={3}
                    fill={color} opacity={0.7}
                    stroke={color} strokeWidth={1} strokeDasharray="3 2" />
                  <text x={bx + 4} y={by + BH - 3} fontSize={fs} fontWeight={700}
                    fill="#fff" style={{ letterSpacing: "0.01em" }}>
                    {label}
                  </text>
                  <circle cx={cx} cy={dotCy} r={4.5}
                    fill="var(--color-surface-2)" stroke={color} strokeWidth={2} />
                </g>
              );
            })}
          </g>
        );
      })()}

      {/* Big-O hover bubbles removed — left-side reference labels are the
          single source of truth for projected Big-O values. */}

      {/* Selection rect (brush = full height, zoom = box) */}
      {selRect && (
        <rect x={selRect.x} y={selRect.y} width={selRect.w} height={selRect.h}
          fill="var(--color-accent)" opacity={0.12}
          stroke="var(--color-accent)" strokeWidth={1}
          style={{ pointerEvents: "none" }} />
      )}
    </svg>
    </div>
  );
}

// ── Legend ────────────────────────────────────────────────────────────────────

function Legend({ algos, data }: { algos: string[]; data: CurveData }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5">
      {algos.map(id => {
        const hasData = (data[id]?.length ?? 0) > 0;
        return (
          <div key={id} className="flex items-center gap-1.5" style={{ opacity: hasData ? 1 : 0.35 }}>
            <div style={{
              width: 18, height: 3,
              background: ALGO_COLORS[id] ?? "#888",
              borderRadius: 2,
            }} />
            <WithAlgoTooltip id={id}>
              <span className="text-xs" style={{ color: "var(--color-muted)" }}>
                {ALGO_NAMES[id]}
              </span>
            </WithAlgoTooltip>
          </div>
        );
      })}
    </div>
  );
}

// ── Proof slider ──────────────────────────────────────────────────────────────

function ProofSlider({
  proofs, algos, activeAlgo, onSelect, revealed, curveData,
}: {
  proofs: Record<string, SampleProof>;
  algos: string[];
  activeAlgo: string | null;
  onSelect: (id: string | null) => void;
  revealed: boolean;
  curveData: CurveData;
}) {
  const { has } = useLevel();
  const available = algos.filter(id => proofs[id]);
  if (!available.length) return null;

  // idx === -1 means "overview" slide (all algorithms)
  const idx = activeAlgo === null ? -1 : available.indexOf(activeAlgo);
  const currentId = idx >= 0 ? available[idx] : null;
  const proof = currentId ? proofs[currentId] : null;
  const color = currentId ? (ALGO_COLORS[currentId] ?? "#888") : "var(--color-muted)";
  // Map values to a numeric metric for the hue scale: numbers use their value;
  // strings use length (since lexicographic order doesn't have a single numeric axis).
  const metric = (v: number | string) => typeof v === "string" ? v.length : v;
  const max = proof ? Math.max(...proof.before.map(metric), ...proof.after.map(metric), 1) : 1;
  const points = currentId ? (curveData[currentId] ?? []) : [];

  const nav = (delta: number) => {
    const newIdx = idx + delta;
    if (newIdx < 0) onSelect(null);
    else onSelect(available[Math.min(available.length - 1, newIdx)] ?? null);
  };

  const btnStyle = (disabled: boolean): React.CSSProperties => ({
    width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center",
    background: "none", border: "1px solid var(--color-border)", borderRadius: 4,
    cursor: disabled ? "not-allowed" : "pointer", fontSize: 12, lineHeight: 1,
    color: disabled ? "var(--color-border)" : "var(--color-muted)", flexShrink: 0,
  });

  const tokenStyle = (v: number | string, forceColor = false): React.CSSProperties => {
    const base: React.CSSProperties = {
      display: "inline-block", fontSize: 10, fontFamily: "monospace",
      padding: "2px 5px", borderRadius: 4,
      transition: "background-color 0.5s ease, color 0.35s ease, border-color 0.5s ease",
    };
    if (!forceColor && !revealed) {
      return { ...base, background: "var(--color-surface-3)", color: "var(--color-muted)", border: "1px solid var(--color-border)" };
    }
    const hue = Math.round(220 - (metric(v) / max) * 185);
    return { ...base, background: `hsl(${hue},72%,40%)`, color: "#fff", border: `1px solid hsl(${hue},72%,57%)` };
  };
  const tokenLabel = (v: number | string): string => {
    if (typeof v === "string") return v.length > 8 ? `"${v.slice(0, 7)}…"` : `"${v}"`;
    return v.toLocaleString();
  };

  const dotRow = (
    <div className="flex gap-1 items-center">
      {available.map(id => (
        <button key={id} onClick={() => onSelect(id)}
          title={ALGO_NAMES[id]}
          style={{
            width: 8, height: 8, borderRadius: "50%", padding: 0, border: "none",
            background: ALGO_COLORS[id] ?? "#888",
            opacity: id === currentId ? 1 : 0.3,
            cursor: "pointer", transition: "opacity 0.15s",
          }} />
      ))}
    </div>
  );

  return (
    <div className="mt-3 pt-3" style={{ borderTop: "1px solid var(--color-border)" }}>
      {/* Header: nav + algo name / "All Algorithms" + dot indicators */}
      <div className="flex items-center gap-2 mb-2">
        <button onClick={() => nav(-1)} disabled={idx <= -1} style={btnStyle(idx <= -1)}>‹</button>
        <span style={{ fontSize: 12, fontWeight: 700, color }}>
          {currentId ? (ALGO_NAMES[currentId] ?? currentId) : "All Algorithms"}
        </span>
        {dotRow}
        <button onClick={() => nav(1)} disabled={idx >= available.length - 1} style={btnStyle(idx >= available.length - 1)}>›</button>
        <span className="ml-auto text-xs font-mono" style={{ color: "var(--color-muted)" }}>
          {proof ? `proof from n=${fmtN(proof.n)}` : `${available.length} algorithm${available.length !== 1 ? "s" : ""} measured`}
        </span>
      </div>

      {/* Overview slide: show all algo stats side by side */}
      {currentId === null && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {available.map(id => {
            const pts = curveData[id] ?? [];
            const best = pts.filter(p => !p.timedOut).sort((a, b) => (a.meanMs ?? a.timeMs) - (b.meanMs ?? b.timeMs))[0];
            return (
              <button key={id} onClick={() => onSelect(id)}
                className="text-xs font-mono px-2 py-0.5 rounded text-left"
                style={{
                  background: "var(--color-surface-3)",
                  border: `1px solid ${ALGO_COLORS[id] ?? "var(--color-border)"}`,
                  color: ALGO_COLORS[id] ?? "var(--color-muted)",
                  cursor: "pointer",
                }}>
                {ALGO_NAMES[id]}{best ? ` · ${fmtTime(best.meanMs ?? best.timeMs)} @ n=${fmtN(best.n)}` : ""}
              </button>
            );
          })}
        </div>
      )}

      {/* Properties: time complexity, space, stable, online */}
      {currentId !== null && (
        <div className="mb-1.5 flex flex-wrap gap-1">
          {ALGO_TIME[currentId] && (
            <span className="text-xs font-mono px-2 py-0.5 rounded"
              style={{ background: "var(--color-surface-3)", border: `1px solid ${color}`, color }}>
              time {ALGO_TIME[currentId]}
            </span>
          )}
          {ALGO_SPACE[currentId] && (
            <span className="text-xs font-mono px-2 py-0.5 rounded"
              style={{ background: "var(--color-surface-3)", border: "1px solid var(--color-border)", color: "var(--color-muted)" }}
              title="Auxiliary space: extra memory beyond the input array">
              aux {ALGO_SPACE[currentId]}
            </span>
          )}
          {ALGO_SPACE[currentId] && (
            <span className="text-xs font-mono px-2 py-0.5 rounded"
              style={{ background: "var(--color-surface-3)", border: "1px solid var(--color-border)", color: "var(--color-muted)", opacity: 0.65 }}
              title="Total space: input O(n) + auxiliary">
              total {totalSpaceLabel(currentId)}
            </span>
          )}
          {ALGO_STABLE[currentId] !== undefined && (
            <span className="text-xs font-mono px-2 py-0.5 rounded"
              style={{ background: "var(--color-surface-3)", border: "1px solid var(--color-border)", color: "var(--color-muted)" }}>
              {ALGO_STABLE[currentId] ? "stable" : "unstable"}
            </span>
          )}
          {ALGO_ONLINE[currentId] !== undefined && (
            <span className="text-xs font-mono px-2 py-0.5 rounded"
              style={{ background: "var(--color-surface-3)", border: "1px solid var(--color-border)", color: "var(--color-muted)" }}>
              {ALGO_ONLINE[currentId] ? "online" : "offline"}
            </span>
          )}
        </div>
      )}

      {/* Measurements: all (n, timeMs) pairs with Big-O breakdown + space download */}
      {currentId !== null && points.length > 0 && (
        <div className="mb-2.5 flex flex-wrap gap-1.5">
          {points.map(p => {
            const allocB       = p.allocBytes != null && p.allocBytes > 0 ? p.allocBytes : null;
            const heapDeltaB   = p.spaceBytes != null && p.spaceBytes > 0 ? p.spaceBytes : null;
            const theoreticalB = theoreticalSpaceBytes(currentId, p.n);
            const canDl        = theoreticalB < 1_048_576;
            const handleDl     = () => {
              const arr  = generateBenchmarkInput(p.n, "random");
              const blob = new Blob([JSON.stringify(Array.from(arr))], { type: "application/json" });
              const url  = URL.createObjectURL(blob);
              const a    = document.createElement("a");
              a.href = url; a.download = `${currentId}-n${p.n}.json`; a.click();
              URL.revokeObjectURL(url);
            };
            return (
              <div key={p.n} className="flex flex-col px-2 py-1.5 rounded"
                style={{ background: "var(--color-surface-3)", border: "1px solid var(--color-border)" }}>
                <span className="text-xs font-mono" style={{ color }}>
                  n={fmtN(p.n)} · {p.timedOut ? ">10 s" : fmtTime(p.meanMs ?? p.timeMs)}{!p.timedOut && p.stdDev != null ? ` ±${fmtTime(p.stdDev)}` : ""}
                </span>
                {!p.timedOut && p.meanMs != null && p.timeMs !== p.meanMs && (
                  <span style={{ fontSize: 8, fontFamily: "monospace", color: "var(--color-muted)", marginTop: 1 }}>
                    best {fmtTime(p.timeMs)}
                  </span>
                )}
                <span style={{ fontSize: 8, color: "var(--color-muted)", marginTop: 3, fontFamily: "monospace", display: "flex", alignItems: "center", gap: 4 }}>
                  <span title="Time complexity">{ALGO_TIME[currentId] ?? "—"}</span>
                  <span style={{ opacity: 0.4 }}>·</span>
                  <span title="Auxiliary alloc: bytes counted via patched Array methods (slice/concat/flat/new Array) — extra space beyond the input" style={{ color: allocB != null ? "#4db6ac" : "var(--color-muted)" }}>
                    {allocB != null ? fmtBytes(allocB) : "—"} aux
                  </span>
                  <span style={{ opacity: 0.4 }}>/</span>
                  <span title={`Total space: auxiliary alloc + input (n×8 B = ${fmtBytes(p.n * 8)})`} style={{ color: allocB != null ? "#80cbc4" : "var(--color-muted)", opacity: 0.8 }}>
                    {allocB != null ? fmtBytes(allocB + p.n * 8) : "—"} total
                  </span>
                  <span style={{ opacity: 0.4 }}>/</span>
                  <span title="V8 heap delta (performance.memory — unreliable for fast sorts)" style={{ color: heapDeltaB != null ? "#ffb74d" : "var(--color-muted)" }}>
                    {heapDeltaB != null ? fmtBytes(heapDeltaB) : "—"} heap Δ
                  </span>
                  <span style={{ opacity: 0.4 }}>/</span>
                  <span title="Theoretical auxiliary: worst-case estimate from Big-O class">
                    {fmtBytes(theoreticalB)} est. aux
                  </span>
                  {canDl && (
                    <button onClick={handleDl} title="Download input array as JSON"
                      style={{ color: "var(--color-accent)", background: "none", border: "none", cursor: "pointer", fontSize: 8, padding: 0, lineHeight: 1 }}>
                      ↓
                    </button>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Token rows */}
      {proof && (
        <>
          <div className="mb-2 flex items-start gap-2">
            <span className="text-xs font-mono shrink-0 mt-0.5" style={{ color: "var(--color-muted)", width: 54 }}>unsorted</span>
            <span className="inline-flex flex-wrap gap-1">
              {proof.before.map((v, i) => (
                <span key={i} style={{ ...tokenStyle(v), transitionDelay: `${i * 18}ms` }}>{tokenLabel(v)}</span>
              ))}
            </span>
          </div>
          {revealed && (
            <div className="flex items-start gap-2">
              <span className="text-xs font-mono shrink-0 mt-0.5" style={{ color: "var(--color-muted)", width: 54 }}>sorted</span>
              <span className="inline-flex flex-wrap gap-1">
                {proof.after.map((v, i) => (
                  <span key={i} style={tokenStyle(v, true)}>{tokenLabel(v)}</span>
                ))}
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Algorithm mini-card ────────────────────────────────────────────────────────
// Compact per-algorithm card shown below the performance curve.
// Shows properties + an animated 10-item bar-chart from the silent pre-run,
// or "No benchmark data." before any run has happened.

const MINI_BAR_COLORS = {
  swap:    "#ef5350",
  pivot:   "#64b5f6",
  compare: "#ffc000",
  sorted:  "#66bb6a",
};

const PLACE_EMOJI: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

/** Play 5 calm sine-wave beeps, each lasting exactly `timeMs` ms, then stop.
 *  Pitch maps sort speed: faster → higher frequency. */
function playBeep(timeMs: number) {
  try {
    const ctx = new AudioContext();
    // Log-scale map: 1 ms → ~2000 Hz, 100 ms → ~440 Hz, 10 000 ms → ~150 Hz
    const logMs = Math.log10(Math.max(1, timeMs));
    const t     = Math.max(0, Math.min(1, logMs / 4));
    const freq  = 2000 * Math.pow(150 / 2000, t);

    const dur     = Math.max(0.08, timeMs / 1000);  // seconds, floor 80 ms
    const gap     = 0.05;                            // 50 ms silence between beeps
    const attack  = Math.min(0.04, dur * 0.10);
    const release = Math.min(0.10, dur * 0.20);
    const hold    = Math.max(0, dur - attack - release);

    for (let i = 0; i < 5; i++) {
      const t0  = ctx.currentTime + i * (dur + gap);
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, t0);
      gain.gain.setValueAtTime(0, t0);
      gain.gain.linearRampToValueAtTime(0.18, t0 + attack);
      gain.gain.setValueAtTime(0.18, t0 + attack + hold);
      gain.gain.linearRampToValueAtTime(0, t0 + attack + hold + release);
      osc.start(t0);
      osc.stop(t0 + dur + 0.01);
      if (i === 4) osc.onended = () => ctx.close();
    }
  } catch { /* AudioContext not available */ }
}

function AlgoMiniCard({
  id, steps, benchData, isActive, rank, spaceRank, showBoth, loop, maxSpaceBytes, maxTotalSteps, onStop, pulseEnabled, onTogglePulse, failed, wasmExecuted, webgpuExecuted,
}: {
  id: string;
  steps: SortStep[] | null;
  benchData: { n: number; timeMs: number; meanMs?: number; stdDev?: number; spaceBytes?: number; timedOut?: boolean }[] | null;
  isActive: boolean;
  rank: number | null;
  spaceRank?: number | null;
  showBoth?: boolean;
  loop?: boolean;
  maxSpaceBytes?: number;
  maxTotalSteps?: number;
  onStop?: () => void;
  pulseEnabled?: boolean;
  onTogglePulse?: () => void;
  /** Sort produced out-of-order output — annotate the card as unreliable. */
  failed?: boolean;
  /** This algorithm ran via the Wasm engine — stamp a "Wasm" badge on the card. */
  wasmExecuted?: boolean;
  /** This algorithm ran via a WebGPU compute pipeline — stamp a "GPU" badge on the card. */
  webgpuExecuted?: boolean;
}) {
  const [stepIdx, setStepIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const prevLoopRef = useRef(loop);

  useEffect(() => {
    if (!steps || steps.length === 0) return;
    setStepIdx(0);
    setPlaying(true);
  }, [steps]);

  // Restart loop while benchmark is running; snap to final frame when it finishes
  useEffect(() => {
    if (loop && steps && steps.length > 0) {
      setStepIdx(0);
      setPlaying(true);
    } else if (!loop && prevLoopRef.current && steps && steps.length > 0) {
      // Benchmark just finished — jump straight to the fully-sorted final frame
      setStepIdx(steps.length - 1);
      setPlaying(false);
    }
    prevLoopRef.current = loop;
  }, [loop, steps]);

  useEffect(() => {
    if (!playing || !steps || steps.length === 0) return;
    const timer = setInterval(() => {
      setStepIdx(prev => {
        if (prev >= steps.length - 1) {
          if (loop) return 0; // restart
          setPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, 90);
    return () => clearInterval(timer);
  }, [playing, steps, loop]);

  const color = ALGO_COLORS[id] ?? "#888";
  const step = steps?.[stepIdx] ?? steps?.[steps.length - 1] ?? null;
  const maxVal = step ? Math.max(...step.arr, 1) : 1;
  const N = step?.arr.length ?? 10;
  const BAR_W = 100 / N;

  const bestPoint = benchData?.filter(p => !p.timedOut).sort((a, b) => b.n - a.n)[0] ?? null;

  return (
    <div style={{
      background: "var(--color-surface-1)",
      // Failed sorts get a red border that overrides active state — the user
      // needs to see the failure regardless of selection.
      border: `1px solid ${failed ? "rgba(239,83,80,0.65)" : (isActive ? color : "var(--color-border)")}`,
      borderRadius: 7,
      padding: "8px 10px",
      transition: "border-color 0.2s",
    }}>
      {/* Name row */}
      <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 5 }}>
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: color, display: "inline-block", flexShrink: 0 }} />
        <WithAlgoTooltip id={id}>
          <span style={{
            fontSize: 11, fontWeight: 700,
            color: failed ? "#ef5350" : "var(--color-text)",
            flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            textDecoration: failed ? "line-through" : "none",
            textDecorationColor: "rgba(239,83,80,0.55)",
          }}>
            {ALGO_NAMES[id] ?? id}
          </span>
        </WithAlgoTooltip>
        {failed && (
          <span title="Sort produced out-of-order output. Results unreliable." style={{
            fontSize: 7, fontWeight: 700, fontFamily: "monospace",
            padding: "1px 5px", borderRadius: 3, whiteSpace: "nowrap",
            background: "rgba(239,83,80,0.18)",
            border: "1px solid rgba(239,83,80,0.55)",
            color: "#ef5350", flexShrink: 0,
          }}>
            ✗ BROKEN
          </span>
        )}
        {wasmExecuted && (
          <span title="This algorithm ran via the AssemblyScript-compiled Wasm module (int32 port). Marshalling cost is included in the timing." style={{
            fontSize: 7, fontWeight: 700, fontFamily: "monospace",
            padding: "1px 5px", borderRadius: 3, whiteSpace: "nowrap",
            background: "rgba(124,106,247,0.18)",
            border: "1px solid rgba(124,106,247,0.55)",
            color: "var(--color-accent)", flexShrink: 0,
          }}>
            Wasm
          </span>
        )}
        {webgpuExecuted && (
          <span title="This algorithm ran via a WebGPU compute pipeline (int32). Buffer copy-in / copy-out cost is included in the timing." style={{
            fontSize: 7, fontWeight: 700, fontFamily: "monospace",
            padding: "1px 5px", borderRadius: 3, whiteSpace: "nowrap",
            background: "rgba(34,197,194,0.18)",
            border: "1px solid rgba(34,197,194,0.55)",
            color: "#0e9b96", flexShrink: 0,
          }}>
            GPU
          </span>
        )}
        {rank !== null && rank <= 3 && (
          <span style={{ fontSize: 13, lineHeight: 1, flexShrink: 0 }} title={showBoth ? `Time #${rank}` : `#${rank}`}>
            {PLACE_EMOJI[rank]}
          </span>
        )}
        {showBoth && spaceRank != null && spaceRank <= 3 && (
          <span style={{ fontSize: 10, lineHeight: 1, flexShrink: 0, opacity: 0.75 }} title={`Space #${spaceRank}`}>
            {PLACE_EMOJI[spaceRank]}
          </span>
        )}
        {loop && onStop && (
          <button
            onClick={onStop}
            title="Stop this algorithm"
            style={{ background: "none", border: "none", cursor: "pointer", padding: "1px 3px", color: "var(--color-muted)", lineHeight: 1, flexShrink: 0, fontSize: 9, borderRadius: 3 }}
          >
            ✕
          </button>
        )}
        {bestPoint && (() => {
          const spaceBytes = bestPoint.spaceBytes ?? 0;
          const maxSB = maxSpaceBytes ?? spaceBytes;
          if (!spaceBytes || !maxSB) return null;
          const fillDiameter = Math.max(1, (spaceBytes / maxSB) * 20);
          const totalBytes = spaceBytes + bestPoint.n * 8;
          const label = totalBytes >= 1_048_576 ? `${(totalBytes / 1_048_576).toFixed(1)} MB` : totalBytes >= 1024 ? `${(totalBytes / 1024).toFixed(1)} KB` : `${totalBytes} B`;
          const beepMs = bestPoint.meanMs ?? bestPoint.timeMs;
          const pulseDuration = Math.max(150, Math.min(5000, beepMs));
          return (
            <span
              title={`Total memory: ${label} (input + aux). ${pulseEnabled ? "Click circle to pause pulse" : "Click circle to resume pulse"}`}
              onClick={onTogglePulse}
              style={{ position: "relative", width: 20, height: 20, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, cursor: "pointer" }}
            >
              <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "var(--color-surface-3)", border: "1px solid var(--color-border)" }} />
              <span style={{ position: "relative", width: fillDiameter, height: fillDiameter, borderRadius: "50%", background: color, display: "block", ...(pulseEnabled ? { animationName: "cc-pulse", animationDuration: `${pulseDuration}ms`, animationTimingFunction: "steps(1, end)", animationIterationCount: "infinite" } : {}) }} />
              <button
                title={`Hear sort speed (avg ${fmtTime(beepMs)} @ n=${fmtN(bestPoint.n)})`}
                onClick={e => { e.stopPropagation(); playBeep(beepMs); }}
                style={{
                  position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
                  background: "none", border: "none", cursor: "pointer", padding: 0,
                  color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center",
                  mixBlendMode: "difference",
                }}
              >
                <Volume2 size={10} strokeWidth={1.75} />
              </button>
            </span>
          );
        })()}
      </div>

      {/* μ readout — time/space at largest n */}
      {bestPoint && (() => {
        const spaceBytes = bestPoint.spaceBytes ?? 0;
        const totalBytes = spaceBytes + bestPoint.n * 8;
        const spaceLabel = totalBytes >= 1_048_576 ? `${(totalBytes / 1_048_576).toFixed(1)} MB` : totalBytes >= 1024 ? `${(totalBytes / 1024).toFixed(1)} KB` : `${totalBytes} B`;
        const timeStr = `${fmtTime(bestPoint.meanMs ?? bestPoint.timeMs)}${bestPoint.stdDev != null ? ` ± ${fmtTime(bestPoint.stdDev)}` : ""}`;
        return (
          <table
            style={{ fontSize: 8, fontFamily: "monospace", borderCollapse: "collapse", width: "100%", marginBottom: 5 }}
            title="μ = average run time ± variation (std dev) | total memory (input + aux) at n"
          >
            <thead>
              <tr style={{ color: "var(--color-muted)" }}>
                <th style={{ textAlign: "left",  fontWeight: 400, padding: "0 4px 0 0", width: "50%" }}>time</th>
                <th style={{ textAlign: "right", fontWeight: 400, padding: "0 0 0 4px" }}>space</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ color, padding: "0 4px 0 0", whiteSpace: "nowrap" }}>μ = {timeStr}</td>
                <td style={{ color, textAlign: "right", padding: "0 0 0 4px", whiteSpace: "nowrap" }}>{spaceLabel}</td>
              </tr>
              <tr>
                <td style={{ color: "var(--color-muted)", padding: "0 4px 0 0" }}>n = {fmtN(bestPoint.n)}</td>
                <td style={{ color: "var(--color-muted)", textAlign: "right", padding: "0 0 0 4px" }}>aux {fmtBytes(spaceBytes)}</td>
              </tr>
            </tbody>
          </table>
        );
      })()}

      {/* Property table */}
      <table style={{
        fontSize: 7, fontFamily: "monospace", borderCollapse: "collapse",
        width: "100%", marginBottom: 6,
        background: "var(--color-surface-3)", border: "1px solid var(--color-border)", borderRadius: 3,
      }}>
        <tbody>
          {ALGO_TIME[id] && (
            <tr>
              <td style={{ padding: "1px 4px", color: "var(--color-muted)", width: "32%" }}>time</td>
              <td style={{ padding: "1px 4px", color, textAlign: "right" }}>{ALGO_TIME[id]}</td>
            </tr>
          )}
          {ALGO_SPACE[id] && (
            <tr title="Auxiliary space: extra memory beyond the input array">
              <td style={{ padding: "1px 4px", color: "var(--color-muted)", borderTop: "1px solid var(--color-border)" }}>aux</td>
              <td style={{ padding: "1px 4px", color: "var(--color-text)", textAlign: "right", borderTop: "1px solid var(--color-border)" }}>{ALGO_SPACE[id]}</td>
            </tr>
          )}
          {ALGO_STABLE[id] !== undefined && (
            <tr>
              <td style={{ padding: "1px 4px", color: "var(--color-muted)", borderTop: "1px solid var(--color-border)" }}>order</td>
              <td style={{ padding: "1px 4px", color: "var(--color-text)", textAlign: "right", borderTop: "1px solid var(--color-border)" }}>{ALGO_STABLE[id] ? "stable" : "unstable"}</td>
            </tr>
          )}
          {ALGO_ONLINE[id] !== undefined && (
            <tr>
              <td style={{ padding: "1px 4px", color: "var(--color-muted)", borderTop: "1px solid var(--color-border)" }}>input</td>
              <td style={{ padding: "1px 4px", color: "var(--color-text)", textAlign: "right", borderTop: "1px solid var(--color-border)" }}>{ALGO_ONLINE[id] ? "online" : "offline"}</td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Bar chart or placeholder */}
      {step ? (
        <div style={{ position: "relative", overflow: "hidden", borderRadius: 3 }}>
          <svg
            viewBox={`0 0 100 32`}
            preserveAspectRatio="none"
            style={{ width: "100%", height: 32, display: "block", borderRadius: 3, cursor: "pointer" }}
            onClick={() => {
              if (!steps) return;
              if (stepIdx >= steps.length - 1) { setStepIdx(0); setPlaying(true); }
              else setPlaying(p => !p);
            }}
          >
            {step.arr.map((val, i) => {
              const h = Math.max(2, (val / maxVal) * 30);
              const swpSet = new Set(step.swapping);
              const cmpSet = new Set(step.comparing);
              const sortedSet = new Set(step.sorted);
              const fill = swpSet.has(i) ? MINI_BAR_COLORS.swap
                : step.pivot === i ? MINI_BAR_COLORS.pivot
                : cmpSet.has(i) ? MINI_BAR_COLORS.compare
                : sortedSet.has(i) ? MINI_BAR_COLORS.sorted
                : color;
              return (
                <rect key={i}
                  x={i * BAR_W + 0.3} y={32 - h}
                  width={Math.max(0.5, BAR_W - 0.6)} height={h}
                  fill={fill}
                />
              );
            })}
          </svg>
          {/* Progress bar */}
          <div style={{ height: 2, background: "var(--color-surface-3)", marginTop: 3, borderRadius: 1, overflow: "hidden" }}>
            <div style={{
              height: "100%",
              width: `${steps && steps.length > 1 ? (stepIdx / (steps.length - 1)) * 100 : 0}%`,
              background: color,
              borderRadius: 1,
              transition: "width 0.08s linear",
            }} />
          </div>
          {/* Time remaining bar */}
          <div style={{ height: 2, background: "var(--color-surface-3)", marginTop: 1, borderRadius: 1, overflow: "hidden" }}>
            <div style={{
              height: "100%",
              width: `${steps && steps.length > 1 && maxTotalSteps ? ((steps.length - 1 - stepIdx) / maxTotalSteps) * 100 : 0}%`,
              background: color,
              opacity: 0.35,
              borderRadius: 1,
              transition: "width 0.08s linear",
            }} />
          </div>
        </div>
      ) : (
        <div style={{ fontSize: 9, color: "var(--color-muted)", fontStyle: "italic", fontFamily: "monospace" }}>
          No benchmark data.
        </div>
      )}
    </div>
  );
}

// ── Playback strip ─────────────────────────────────────────────────────────────

// ── Shared button style helper ────────────────────────────────────────────────

function btn(
  variant: "primary" | "secondary" | "danger" | "ghost",
  extra?: React.CSSProperties
): React.CSSProperties {
  const base: React.CSSProperties = {
    display: "inline-flex", alignItems: "center", gap: 4,
    padding: "3px 8px", fontSize: 11, fontFamily: "monospace", fontWeight: 500,
    borderRadius: 5, cursor: "pointer", border: "none", userSelect: "none",
    lineHeight: 1.4,
  };
  const variants: Record<string, React.CSSProperties> = {
    primary:   { background: "var(--color-accent)", color: "#fff" },
    danger:    { background: "var(--color-state-swap)", color: "#fff" },
    secondary: { background: "var(--color-surface-1)", border: "1px solid var(--color-border)", color: "var(--color-muted)" },
    ghost:     { background: "none", color: "var(--color-muted)" },
  };
  return { ...base, ...variants[variant], ...extra };
}

// ── Cache miss estimator ──────────────────────────────────────────────────────
// Rough working-set cache level for an array of n 64-bit floats (8 bytes each).
// Thresholds: L1=32 KB → 4096 elems, L2=256 KB → 32768, L3=8 MB → 1048576.
function cacheLevel(id: string, n: number): { label: string; color: string } {
  // Algorithms that access the whole array (merge, counting) use ~2× the data
  const factor = ["merge", "counting", "radix", "bucket", "timsort", "timsort-js"].includes(id) ? 2 : 1;
  const bytes = n * 8 * factor;
  if (bytes <= 32 * 1024)        return { label: "L1",  color: "#66bb6a" };
  if (bytes <= 256 * 1024)       return { label: "L2",  color: "#ffc107" };
  if (bytes <= 8 * 1024 * 1024)  return { label: "L3",  color: "#ff9800" };
  return { label: "RAM", color: "#ef5350" };
}

// ── Churn Mode UI ─────────────────────────────────────────────────────────
// The pulsing-sphere indicator + the live telemetry panel that fills in below
// it while churn is active. Pure presentational: the parent owns all state.

/** The toggle button itself: pulsating + blinking sphere in a transparent red
 *  box. Inactive state is a dim outline that still reads as "Churn Mode" so
 *  the affordance is obvious without ambient animation distracting the user. */
function ChurnIndicator({
  active, complete, onToggle, disabled, probeCount, probesPerSec,
}: {
  active: boolean;
  /** True once every selected algo has saturated. The sphere quiets, the
   *  red box softens, and the badge flips to "sweep complete" — but the
   *  toggle stays enabled so the user can stop / re-arm at will. */
  complete: boolean;
  onToggle: () => void;
  disabled: boolean;
  probeCount: number;
  probesPerSec: number;
}) {
  return (
    <button
      onClick={onToggle}
      disabled={disabled}
      title={disabled
        ? "Select at least one algorithm to start Churn Mode"
        : complete
          ? "Sweep complete — every selected algo has saturated. Click to stop, or add more algos to your selection to resume."
          : active
            ? "Stop the adaptive stress test"
            : "Start adaptive stress test: probes selected algos at randomized sizes, adapting per-algo on timeouts"}
      // While complete, drop the red-glow box class — the panel reads as
      // "done", not "alarming". Active+incomplete keeps the original look.
      className={active && !complete ? "cc-churn-box" : ""}
      style={{
        display: "inline-flex", alignItems: "center", gap: 8,
        padding: "4px 10px", borderRadius: 6, fontSize: 10,
        fontFamily: "var(--font-mono)", cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.45 : 1,
        ...(active && complete ? {
          // Sweep-complete look: muted teal/green border, no pulse.
          border: "1.5px solid rgba(77, 182, 172, 0.55)",
          background: "rgba(77, 182, 172, 0.08)",
        } : active ? {} : {
          // Inactive: simple outline that hints at red.
          border: "1.5px solid rgba(220, 38, 38, 0.30)",
          background: "rgba(220, 38, 38, 0.025)",
        }),
        color: "var(--color-text)",
        userSelect: "none",
        transition: "background 200ms, border-color 200ms",
      }}
    >
      <span
        className="cc-churn-sphere"
        style={
          !active ? {
            // Inactive: dim ember.
            animation: "none",
            background: "radial-gradient(circle at 30% 30%, #b85050 0%, #7a2020 60%, #401010 100%)",
            opacity: 0.55,
          } : complete ? {
            // Sweep complete: stop the pulse, switch the sphere to teal so
            // it reads as "settled" rather than "still working".
            animation: "none",
            background: "radial-gradient(circle at 30% 30%, #80cbc4 0%, #4db6ac 60%, #00695c 100%)",
            opacity: 0.9,
          } : undefined
        }
        aria-hidden
      />
      <span style={{ fontWeight: 600, letterSpacing: 0.3 }}>
        Churn Mode
      </span>
      {active && complete && (
        <span style={{ color: "#4db6ac", fontSize: 9, marginLeft: 2, fontWeight: 700 }}>
          ✓ sweep complete
          <span style={{ color: "var(--color-muted)", fontWeight: 400, marginLeft: 6 }}>
            {probeCount}<span style={{ opacity: 0.55 }}> probes</span>
          </span>
        </span>
      )}
      {active && !complete && (
        <span style={{ color: "var(--color-muted)", fontSize: 9, marginLeft: 2 }}>
          {probeCount}<span style={{ opacity: 0.55 }}> probes</span>
          {" · "}
          {probesPerSec.toFixed(1)}<span style={{ opacity: 0.55 }}>/s</span>
        </span>
      )}
    </button>
  );
}

/** A small SVG line chart for sparkline-style displays inside the churn
 *  dashboard. Values get normalized to fill the height; an optional log scale
 *  is useful for ceiling history (which spans CHURN_N_MIN..CHURN_N_MAX over
 *  several decades). The last point gets a small filled dot so the "current"
 *  value is easy to find without reading the right edge. */
function ChurnSpark({ values, w, h, color, log = false, baseline }: {
  values: number[];
  w: number; h: number; color: string;
  log?: boolean;
  /** Optional horizontal reference line at this raw value (e.g. CHURN_BUDGET_MS). */
  baseline?: number;
}) {
  if (values.length < 2) {
    return (
      <svg width={w} height={h} aria-hidden style={{ display: "block" }}>
        <line x1={0} y1={h - 1} x2={w} y2={h - 1} stroke="var(--color-border)" strokeWidth={0.5} />
      </svg>
    );
  }
  const t = (v: number) => log ? Math.log10(Math.max(1, v)) : v;
  const ts = values.map(t);
  const min = Math.min(...ts), max = Math.max(...ts);
  const range = max - min || 1;
  const sx = (i: number) => (values.length === 1 ? 0 : (i / (values.length - 1)) * (w - 2)) + 1;
  const sy = (v: number) => h - 1 - ((t(v) - min) / range) * (h - 2);
  const points = values.map((v, i) => `${sx(i).toFixed(1)},${sy(v).toFixed(1)}`).join(" ");
  const baselineY = baseline != null ? sy(baseline) : null;
  // Filled area under the line for visual weight at sparkline sizes.
  const areaPoints = `${sx(0)},${h - 0.5} ${points} ${sx(values.length - 1)},${h - 0.5}`;
  return (
    <svg width={w} height={h} aria-hidden style={{ display: "block" }}>
      <polygon points={areaPoints} fill={color} opacity={0.12} />
      {baselineY != null && baselineY >= 0 && baselineY <= h && (
        <line x1={0} y1={baselineY} x2={w} y2={baselineY} stroke="#dc2626" strokeWidth={0.5} strokeDasharray="2 2" opacity={0.5} />
      )}
      <polyline points={points} fill="none" stroke={color} strokeWidth={1.2} strokeLinejoin="round" />
      <circle cx={sx(values.length - 1)} cy={sy(values[values.length - 1])} r={1.6} fill={color} />
    </svg>
  );
}

/** 20-bin log-spaced histogram of probe sizes — shows COVERAGE. Each cell's
 *  fill intensity is proportional to probe count in that bin, so dense bins
 *  saturate while unexplored ones stay near-empty. A reader can see at a
 *  glance "we've been hammering 1k..100k but never went above that". */
function ChurnNCoverageBar({ history, w, h, color, min, max }: {
  history: { n: number; timedOut: boolean }[];
  w: number; h: number; color: string;
  min: number; max: number;
}) {
  const BINS = 20;
  const logMin = Math.log10(min), logMax = Math.log10(max);
  const span = logMax - logMin || 1;
  const counts = new Array<number>(BINS).fill(0);
  const tCounts = new Array<number>(BINS).fill(0);
  for (const r of history) {
    const lr = Math.log10(Math.max(min, Math.min(max, r.n)));
    const bin = Math.min(BINS - 1, Math.max(0, Math.floor(((lr - logMin) / span) * BINS)));
    counts[bin]++;
    if (r.timedOut) tCounts[bin]++;
  }
  const maxCount = Math.max(1, ...counts);
  const cellW = w / BINS;
  return (
    <svg width={w} height={h} aria-hidden style={{ display: "block" }}>
      {/* Cell backgrounds give the gradient feel even for empty cells. */}
      {counts.map((c, i) => {
        const intensity = c / maxCount;
        return (
          <rect
            key={i}
            x={i * cellW}
            y={0}
            width={cellW - 0.5}
            height={h}
            fill={color}
            opacity={0.06 + intensity * 0.85}
          />
        );
      })}
      {/* Timeout overlay — a small red stripe along the top of any bin where
          probes have ever timed out. Makes failure regions pop without
          obscuring the count. */}
      {tCounts.map((tc, i) => tc > 0 ? (
        <rect
          key={`t${i}`}
          x={i * cellW}
          y={0}
          width={cellW - 0.5}
          height={2}
          fill="#dc2626"
          opacity={Math.min(1, 0.4 + (tc / Math.max(1, counts[i])) * 0.6)}
        />
      ) : null)}
    </svg>
  );
}

/** Last K probes as a scatter — x is recency (right = newest), y is log(timeMs),
 *  red dot if the probe exceeded the budget. The budget line is drawn dashed
 *  so the user can see how close probes have been to the cliff. */
function ChurnRecentProbes({ history, w, h, color, budget }: {
  history: { timeMs: number; timedOut: boolean }[];
  w: number; h: number; color: string;
  budget: number;
}) {
  if (history.length === 0) return <svg width={w} height={h} aria-hidden style={{ display: "block" }} />;
  // Use the latter half of the buffer so the scatter shows "what's happening NOW".
  const tail = history.slice(Math.max(0, history.length - 30));
  const times = tail.map(r => Math.max(0.001, r.timeMs));
  // Y-scale: log, capped at budget × 1.25 so timeouts are visibly above the line.
  const yMax = Math.log10(Math.max(budget * 1.25, ...times));
  const yMin = Math.log10(Math.max(0.001, Math.min(...times)));
  const yRange = (yMax - yMin) || 1;
  const sy = (v: number) => h - 1 - ((Math.log10(Math.max(0.001, v)) - yMin) / yRange) * (h - 2);
  const sx = (i: number) => (tail.length === 1 ? w / 2 : (i / (tail.length - 1)) * (w - 4)) + 2;
  const budgetY = sy(budget);
  return (
    <svg width={w} height={h} aria-hidden style={{ display: "block" }}>
      {budgetY >= 0 && budgetY <= h && (
        <line x1={0} y1={budgetY} x2={w} y2={budgetY} stroke="#dc2626" strokeWidth={0.5} strokeDasharray="2 3" opacity={0.55} />
      )}
      {tail.map((r, i) => (
        <circle
          key={i}
          cx={sx(i)}
          cy={r.timedOut ? Math.min(budgetY, sy(r.timeMs)) - 1 : sy(r.timeMs)}
          r={r.timedOut ? 2 : 1.4}
          fill={r.timedOut ? "#dc2626" : color}
          opacity={0.35 + 0.65 * ((i + 1) / tail.length)}
        />
      ))}
    </svg>
  );
}

/** Live readout of per-algo adaptive state while churn is running.
 *
 *  Each algo row is a vertical stack of four micro-visualizations so the
 *  ongoing stress test reads like a tape-deck level meter for that algorithm:
 *
 *    color swatch · name · ceiling · samples ⚠timeouts · last
 *    ┌─ ceiling history (log y) ─────────── 80 probes ────────┐
 *    └─ recent probes (log y, dashed = budget) ── last 30 ────┘
 *    ┌─ n-coverage 20-bin heatmap ── 64 … 5M ─────────────────┐
 *
 *  Each strip tells the user a different thing:
 *    - Ceiling history shows the AIMD reacting (drops on timeouts, climbs
 *      on fast finishes).
 *    - Recent probes scatter shows whether the algorithm's timing is stable
 *      or wildly varying at the sizes the AIMD is probing.
 *    - Coverage bar shows where in n-space probes have actually landed —
 *      gaps mean the algorithm hasn't explored those sizes.
 */
function ChurnTelemetry({
  state, history, totals, algoNames, algoColors, runtimeMs, budgetMs, nMin, nMax, samplesPerLevel, complete,
}: {
  state: Record<string, {
    currentLevel: number;
    samplesAtLevel: number;
    saturated: boolean;
    maxCompletedLevel: number;
    samples: number;
    timeouts: number;
    lastTimeMs: number | null;
    lastN: number | null;
  }>;
  /** Rolling per-algo probe history, oldest first. */
  history: Record<string, { ts: number; n: number; timeMs: number; timedOut: boolean; ceiling: number }[]>;
  totals: { probes: number; timeouts: number };
  algoNames: Record<string, string>;
  algoColors: Record<string, string>;
  runtimeMs: number;
  /** Per-probe budget — drawn as a dashed line on the recent-probes scatter. */
  budgetMs: number;
  /** Bounds of the n-coverage axis (log-spaced bins). */
  nMin: number; nMax: number;
  /** How many samples are taken at each level before doubling. Used for the
   *  "3 / 5" progress chip in the stats line. */
  samplesPerLevel: number;
  /** Sweep-complete flag — drives the green completion banner at the top
   *  of the telemetry block and the "completed at" timing in the header. */
  complete: boolean;
}) {
  const entries = Object.entries(state).sort((a, b) => b[1].samples - a[1].samples);
  const fmtRuntime = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
    return h > 0 ? `${h}h ${m}m ${ss}s` : m > 0 ? `${m}m ${ss}s` : `${ss}s`;
  };
  const SPARK_W = 200, CEIL_H = 22, PROBE_H = 22, COVER_H = 8;

  // Final tally — derived once when the sweep finishes so the banner can
  // surface "what each algo got to before timing out" without scrolling.
  const tally = complete && entries.length > 0
    ? entries
        .map(([id, s]) => ({ id, maxN: s.maxCompletedLevel || s.currentLevel, samples: s.samples }))
        .sort((a, b) => b.maxN - a.maxN)
    : null;

  return (
    <div style={{ fontFamily: "var(--font-mono)", fontSize: 9 }}>
      {/* Sweep-complete banner — only when the pool is fully saturated. Lists
          each algo with its max-completed n in descending order so the user
          immediately sees the "ranking by ceiling". */}
      {complete && tally && (
        <div
          style={{
            background: "rgba(77, 182, 172, 0.08)",
            border: "1px solid rgba(77, 182, 172, 0.55)",
            borderRadius: 4,
            padding: "5px 8px",
            marginBottom: 8,
            color: "var(--color-text)",
          }}
        >
          <div style={{ fontSize: 9, fontWeight: 700, color: "#4db6ac", letterSpacing: "0.05em", marginBottom: 4 }}>
            ✓ SWEEP COMPLETE
            <span style={{ color: "var(--color-muted)", fontWeight: 400, marginLeft: 6 }}>
              all {tally.length} algo{tally.length !== 1 ? "s" : ""} saturated · {totals.probes} probes · {fmtRuntime(runtimeMs)}
            </span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "2px 10px" }}>
            {tally.map(t => (
              <span key={t.id} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: algoColors[t.id] ?? "#888" }} />
                <span style={{ color: algoColors[t.id] ?? "#fff", fontWeight: 600 }}>
                  {(algoNames[t.id] ?? t.id).replace(" Sort", "")}
                </span>
                <span style={{ color: "var(--color-muted)" }}>max n={fmtN(t.maxN)}</span>
              </span>
            ))}
          </div>
          <div style={{ fontSize: 8, color: "var(--color-muted)", marginTop: 4, opacity: 0.85 }}>
            Add an algorithm to your selection to resume sweeping the new one.
          </div>
        </div>
      )}

      {/* Header row — totals + runtime always visible. */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: "var(--color-muted)", marginBottom: 8, paddingBottom: 4, borderBottom: "1px dashed var(--color-border)" }}>
        <span>
          {complete ? "completed in " : "running for "}<strong style={{ color: "var(--color-text)" }}>{fmtRuntime(runtimeMs)}</strong>
          {totals.probes > 0 && runtimeMs > 500 && (
            <span style={{ opacity: 0.6 }}> · {((totals.probes / Math.max(1, runtimeMs / 1000))).toFixed(1)}/s</span>
          )}
        </span>
        <span>
          <strong style={{ color: "var(--color-text)" }}>{totals.probes}</strong> probes ·{" "}
          <strong style={{ color: totals.timeouts > 0 ? "#dc2626" : "var(--color-text)" }}>{totals.timeouts}</strong> timed out
          {totals.probes > 0 && totals.timeouts > 0 && (
            <span style={{ color: "#dc2626", opacity: 0.7 }}> ({Math.round((totals.timeouts / totals.probes) * 100)}%)</span>
          )}
        </span>
      </div>

      {entries.length === 0 ? (
        <div style={{ color: "var(--color-muted)", padding: "12px 4px", textAlign: "center" }}>
          waiting for first probe…
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {entries.map(([id, s]) => {
            const color = algoColors[id] ?? "#888";
            const lastMs = s.lastTimeMs;
            const lastN = s.lastN;
            const hist = history[id] ?? [];
            const ceilingSeries = hist.map(r => r.ceiling);
            const timeoutRate = s.samples > 0 ? s.timeouts / s.samples : 0;
            return (
              <div key={id} style={{ paddingBottom: 6, borderBottom: "1px dashed var(--color-border)" }}>
                {/* Stats line — header reads:
                    ● Name      [saturated · max N] OR [n=64 · 3/5 samples]   N probes  ⚠T   ↳ last */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, fontSize: 9, flexWrap: "wrap" }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, display: "inline-block", flexShrink: 0 }} />
                  <span style={{ color, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 130 }}>
                    {algoNames[id] ?? id}
                  </span>
                  {s.saturated ? (
                    <span style={{ color: "#dc2626", fontWeight: 600 }} title={`Hit ${budgetMs}ms timeout; drift-sampling previously explored levels (max completed: n=${s.maxCompletedLevel || s.currentLevel})`}>
                      ⊘ saturated · max n={fmtN(s.maxCompletedLevel || s.currentLevel)}
                    </span>
                  ) : (
                    <span style={{ color: "var(--color-text)", fontFamily: "monospace" }} title={`Currently probing at n=${s.currentLevel.toLocaleString()}; advances after ${samplesPerLevel} samples`}>
                      probing <strong>n={fmtN(s.currentLevel)}</strong>
                      <span style={{ color: "var(--color-muted)", marginLeft: 4 }}>
                        {s.samplesAtLevel}/{samplesPerLevel}
                      </span>
                    </span>
                  )}
                  <span style={{ color: "var(--color-muted)", marginLeft: "auto" }}>· {s.samples} probes</span>
                  {s.timeouts > 0 && (
                    <span style={{ color: "#dc2626" }} title={`${(timeoutRate * 100).toFixed(0)}% timeout rate`}>
                      ⚠{s.timeouts}
                    </span>
                  )}
                  {lastN != null && lastMs != null && (
                    <span style={{ color: "var(--color-muted)" }} title="most recent probe">
                      ↳ n={fmtN(lastN)} · {fmtTime(lastMs)}
                    </span>
                  )}
                </div>

                {/* Visualization grid: two rows of sparklines + a coverage bar. */}
                <div style={{ display: "grid", gridTemplateColumns: "60px 1fr", gap: 4, alignItems: "center" }}>
                  <span style={{ fontSize: 7, color: "var(--color-muted)", textAlign: "right" }} title="The probe-n level the sweep has reached, sampled after each probe. Stair-steps up by 2× whenever 5 clean samples complete; flatlines once the algo saturates.">level</span>
                  <ChurnSpark values={ceilingSeries} w={SPARK_W} h={CEIL_H} color={color} log />

                  <span style={{ fontSize: 7, color: "var(--color-muted)", textAlign: "right" }} title="Last 30 probe times. Dashed red = budget; red dots = timeouts.">probes</span>
                  <ChurnRecentProbes history={hist} w={SPARK_W} h={PROBE_H} color={color} budget={budgetMs} />

                  <span style={{ fontSize: 7, color: "var(--color-muted)", textAlign: "right" }} title="20 log-spaced n bins; darker = more probes. Red stripe = timeouts in that bin.">n coverage</span>
                  <ChurnNCoverageBar history={hist} w={SPARK_W} h={COVER_H} color={color} min={nMin} max={nMax} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Axis legend for the coverage bar — needs at least one row of data to
          have a meaningful range, so we only render once probes have come in. */}
      {entries.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "60px 1fr", gap: 4, alignItems: "center", marginTop: 6, fontSize: 7, color: "var(--color-muted)" }}>
          <span style={{ textAlign: "right" }} />
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>{fmtN(nMin)}</span>
            <span style={{ opacity: 0.5 }}>{fmtN(Math.round(Math.sqrt(nMin * nMax)))}</span>
            <span>{fmtN(nMax)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Session data export / import ──────────────────────────────────────────
// Pulled out of the component so the serializers are testable in isolation
// and reusable if we ever want a CLI exporter. Schema includes a `format`
// version tag so we can evolve it without silently corrupting older snapshots
// during import — the import path explicitly checks this string.

const SESSION_DATA_FORMAT = "codecookbook-session-v1";

interface ExportedSessionData {
  format: typeof SESSION_DATA_FORMAT;
  exportedAt: string;
  sessionLog: SessionLog;
  winnerLog: WinnerLog;
  ghostRuns: Record<string, Array<{ ts: number; points: Array<{ n: number; timeMs: number; meanMs?: number; spaceBytes?: number }> }>>;
}

/** JSON export — full fidelity: every store the session aggregates read from.
 *  Re-importable round-trip with no data loss. */
function buildSessionDataJson(
  sessionLog: SessionLog,
  winnerLog: WinnerLog,
  ghostRuns: Record<string, Array<{ ts: number; points: Array<{ n: number; timeMs: number; meanMs?: number; spaceBytes?: number }> }>>,
): string {
  const payload: ExportedSessionData = {
    format: SESSION_DATA_FORMAT,
    exportedAt: new Date().toISOString(),
    sessionLog,
    winnerLog,
    ghostRuns,
  };
  return JSON.stringify(payload, null, 2);
}

/** CSV export — flattens sessionLog into one row per (dataType, algo, n).
 *  This is the analytical view: pandas / spreadsheets can load it directly.
 *  Winner log and ghost runs aren't included (different shape; the JSON
 *  export is the right tool when you need them). */
function buildSessionDataCsv(sessionLog: SessionLog): string {
  const rows: string[] = ["dataType,algo,n,meanTimeMs,meanSpaceBytes,runs"];
  // Stable ordering so two exports of the same data produce identical files —
  // makes diffing exports across time meaningful.
  for (const dt of Object.keys(sessionLog).sort()) {
    const byAlgo = sessionLog[dt] ?? {};
    for (const algo of Object.keys(byAlgo).sort()) {
      const byN = byAlgo[algo] ?? {};
      const numericNs = Object.keys(byN).map(Number).filter(n => Number.isFinite(n)).sort((a, b) => a - b);
      for (const n of numericNs) {
        const pt = byN[String(n)];
        if (!pt) continue;
        rows.push(`${dt},${algo},${n},${pt.meanTimeMs},${pt.meanSpaceBytes},${pt.runs}`);
      }
    }
  }
  return rows.join("\n") + "\n";
}

/** Trigger a browser download for the given text content. Same Blob/anchor
 *  pattern the SortNetworkGraph exports use — adding the anchor to DOM is
 *  required by Firefox for the click to actually trigger the download. */
function downloadSessionBlob(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Validate + parse an imported file. Returns the parsed payload or an
 *  error string suitable for surfacing in the toolbar. The schema check is
 *  conservative — we'd rather refuse a partially-valid file than silently
 *  re-hydrate state with junk fields that crash the renderers downstream. */
function parseSessionDataJson(text: string): { ok: true; data: ExportedSessionData } | { ok: false; error: string } {
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
  if (obj.format !== SESSION_DATA_FORMAT) {
    return { ok: false, error: `Unknown format "${String(obj.format)}" — expected "${SESSION_DATA_FORMAT}"` };
  }
  if (typeof obj.sessionLog !== "object" || obj.sessionLog == null) {
    return { ok: false, error: "Missing sessionLog field" };
  }
  if (typeof obj.winnerLog !== "object" || obj.winnerLog == null) {
    return { ok: false, error: "Missing winnerLog field" };
  }
  if (typeof obj.ghostRuns !== "object" || obj.ghostRuns == null) {
    return { ok: false, error: "Missing ghostRuns field" };
  }
  return { ok: true, data: obj as unknown as ExportedSessionData };
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function BenchmarkVisualizer() {
  const { has } = useLevel();
  const [pulseEnabled, setPulseEnabled] = useState<boolean>(() => {
    try { return localStorage.getItem("cc-pulse") !== "off"; } catch { return true; }
  });
  const togglePulse = useCallback(() => {
    setPulseEnabled(prev => {
      const next = !prev;
      try { localStorage.setItem("cc-pulse", next ? "on" : "off"); } catch {}
      return next;
    });
  }, []);

  const [selectedSizes, setSelectedSizes] = useState<Set<number>>(
    new Set([10_000, 100_000, 1_000_000])
  );
  const [scenarios, setScenarios] = useState<Set<BenchmarkScenario>>(
    new Set(["random"] as BenchmarkScenario[])
  );
  const [rounds, setRounds] = useState(8);
  const [warmup, setWarmup] = useState(3);
  // Per-sort timeout (seconds). When enabled, any single sort that exceeds this
  // wall-clock budget is marked `timedOut` and the algo is excluded from larger n.
  // Disabling removes the cap entirely — useful for long-running benchmarks.
  const [timeoutEnabled, setTimeoutEnabled] = useState(true);
  const [timeoutSec, setTimeoutSec] = useState(3);
  const [selected, setSelected] = useState<Set<string>>(
    new Set(["logos", "adaptive", "timsort"])
  );

  const [status, setStatus] = useState<Status>("idle");
  // Tracks whether the tab was hidden at any point during the active benchmark.
  // Browsers throttle/queue timer callbacks in background tabs, so timings
  // captured while hidden are unreliable. We surface a banner when this trips.
  const [tabHiddenDuringRun, setTabHiddenDuringRun] = useState(false);
  // ── Live memory timeline ────────────────────────────────────────────────────
  // Sampled heap usage during a run, tagged with the algorithm + n that was
  // active at the time. Rendered as a time-series chart under the performance
  // curve. Polling runs only while `status === "running"` (see effect below);
  // samples persist after the run so the user can review the timeline.
  const [memSamples, setMemSamples] = useState<MemSample[]>([]);
  // ── Ghost mode ─────────────────────────────────────────────────────────────
  // Persisted ring buffer (last 100 runs per algorithm) of (n, timeMs, spaceBytes)
  // tuples. When ghostMode is enabled, the curve chart draws these past runs as
  // progressively-faded polylines underneath the current curves so the user
  // can see how the algorithm's measured performance has drifted across runs.
  // The 3D history view (Chart3DHistory, bottom of left pane) also reads this
  // buffer — with a UI slider controlling how many of the stored runs render.
  // At ~30 bytes/point × ~8 sizes × ~20 algos × 100 runs ≈ 480 KB worst case,
  // well under the localStorage budget.
  const GHOST_MAX = 100;
  type GhostPoint = { n: number; timeMs: number; meanMs?: number; spaceBytes?: number };
  type GhostRun = { ts: number; points: GhostPoint[] };
  const [ghostRuns, setGhostRuns] = useState<Record<string, GhostRun[]>>({});
  const [ghostMode, setGhostMode] = useState(false);
  // Hydrated-after-mount guard so the initial empty state doesn't clobber the
  // stored history before the load effect runs.
  const ghostHydratedRef = useRef(false);

  // ── Churn Mode ─────────────────────────────────────────────────────────────
  // An always-on adaptive stress test. While active, a background setTimeout
  // loop sporadically probes a random algo with a random n drawn from that
  // algo's adaptive range. The range shrinks when a probe times out
  // (multiplicative decrease) and grows when probes finish well under budget
  // (additive increase) — classic AIMD, but per-algorithm so slow algos
  // converge to a smaller window while fast ones explore further out.
  //
  // Probe results stream into the same curveDataExt buffer the regular
  // benchmark fills, and a periodic flush bundles probe batches into ghostRuns
  // entries — so the 2D curve overlay, 3D history surface, and rankings all
  // light up automatically without separate plumbing.
  // Adaptive sweep state. Each algorithm starts at CHURN_N_MIN, takes
  // CHURN_SAMPLES_PER_LEVEL probes at that n, then doubles to the next level.
  // When any probe exceeds CHURN_BUDGET_MS the algorithm is marked saturated —
  // no further advancement, but its already-explored levels stay in the pool
  // for drift sampling.
  type ChurnAlgoState = {
    /** The n the algo is currently being probed at. Doubles on advance. */
    currentLevel: number;
    /** How many probes have completed at currentLevel (0..CHURN_SAMPLES_PER_LEVEL). */
    samplesAtLevel: number;
    /** Set true when a probe exceeds CHURN_BUDGET_MS. No more advancement;
     *  drift sampling continues at previously-explored levels. */
    saturated: boolean;
    /** Largest level that completed without timeout — the algo's empirical
     *  ceiling under the current engine/data conditions. */
    maxCompletedLevel: number;
    /** Distinct levels we've collected at least one sample for. Used to pick
     *  a drift-sampling n for saturated algos. */
    exploredLevels: number[];
    /** Total probes for this algo this churn session. */
    samples: number;
    /** Total timeouts for this algo this churn session. */
    timeouts: number;
    /** Wall-time ms of the most recent probe. */
    lastTimeMs: number | null;
    /** The n of the most recent probe. */
    lastN: number | null;
  };
  const CHURN_N_MIN = 64;
  const CHURN_N_MAX = 5_000_000;
  // Take this many probes at each level before doubling to the next.
  // 5 gives enough samples for a sane mean while still moving up briskly.
  const CHURN_SAMPLES_PER_LEVEL = 5;
  // Per-probe budget — a single probe exceeding this saturates the algo.
  // 5s is generous enough that the slowest comparison sorts at large n still
  // have a chance to complete; anything past 5s isn't worth chasing further.
  const CHURN_BUDGET_MS = 5000;
  // After saturating, this fraction of probes for that algo sample randomly
  // from the explored-levels set for drift detection. The rest cycle to
  // non-saturated algos so unfinished sweeps keep progressing.
  const CHURN_DRIFT_SAMPLE_PROB = 0.25;
  const CHURN_TICK_MIN_MS = 60;            // jittered spacing between probes
  const CHURN_TICK_MAX_MS = 350;
  // Tightened from the original 8s / 4-point gate — churn now feels "live":
  // the rankings table, network graph, session views, and 3D History all see
  // updates roughly every 2 seconds (or every 2 buffered probes, whichever
  // comes first). The cost is 4× more setState calls, but the renderers are
  // already memoized where it matters.
  const CHURN_FLUSH_INTERVAL_MS = 2_000;
  const CHURN_FLUSH_MIN_POINTS  = 2;
  const [churnMode, setChurnMode] = useState(false);
  const [churnState, setChurnState] = useState<Record<string, ChurnAlgoState>>({});
  const [churnTotals, setChurnTotals] = useState<{ probes: number; timeouts: number; startedAt: number | null; lastProbeAt: number | null }>({
    probes: 0, timeouts: 0, startedAt: null, lastProbeAt: null,
  });
  // Rolling per-algo probe history for the live visualization. Capped per algo
  // so old probes age out — the dashboard is "what's happened recently", not
  // "everything ever" (ghostRuns is the permanent record).
  type ChurnProbeRecord = { ts: number; n: number; timeMs: number; timedOut: boolean; ceiling: number };
  const CHURN_HIST_PER_ALGO = 80;
  const [churnHistory, setChurnHistory] = useState<Record<string, ChurnProbeRecord[]>>({});
  // Sweep-completion flag — true when every algo in the pool has saturated.
  // State drives UI rendering; ref drives the tick's short-circuit gate (refs
  // see the latest value without waiting for the next React render).
  const [churnComplete, setChurnComplete] = useState(false);
  const churnCompleteRef = useRef(false);
  // Ref-mirrors so the loop closure reads the freshest values without being
  // re-spun every render. The loop schedules itself; React state changes can't
  // be allowed to cancel mid-cycle every time numbers update.
  const churnActiveRef = useRef(false);
  const churnTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const churnStateRef = useRef<Record<string, ChurnAlgoState>>({});
  const churnHistoryRef = useRef<Record<string, ChurnProbeRecord[]>>({});
  // Per-algo buffer of probe points waiting to be flushed to ghostRuns. We
  // batch so a typical hour of churn produces a sane number of polylines
  // rather than thousands of one-point entries.
  const churnAccumRef = useRef<Record<string, Array<{ n: number; timeMs: number; spaceBytes: number; ts: number }>>>({});
  const churnLastFlushRef = useRef<number>(0);

  const [curveData, setCurveData] = useState<CurveData>({});
  const [currentN, setCurrentN] = useState<number | null>(null);
  const [currentAlgo, setCurrentAlgo] = useState<string | null>(null);
  // Refs mirroring currentN/currentAlgo so the memory-sampling interval can
  // read the *latest* values without being re-created on every state change.
  const currentNRef = useRef<number | null>(null);
  const currentAlgoRef = useRef<string | null>(null);
  useEffect(() => { currentNRef.current = currentN; }, [currentN]);
  useEffect(() => { currentAlgoRef.current = currentAlgo; }, [currentAlgo]);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [runConfig, setRunConfig] = useState<{
    sizes: number[]; scenarios: BenchmarkScenario[]; rounds: number; warmup: number; algos: string[];
  } | null>(null);
  // Per-algo sample proof: 20 evenly-spaced before/after values from one round.
  // Values are typed as (number|string)[] so the renderer can adapt to whatever
  // dataType is in use. `dataType` and `scenario` are stored so the proof carries
  // enough context to explain itself in the UI ("integer · nearlySorted · n=10k").
  const [sampleProofs, setSampleProofs] = useState<Record<string, SampleProof>>({});
  const [activeProofAlgo, setActiveProofAlgo] = useState<string | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [useWorkerIsolation, setUseWorkerIsolation] = useState(true);
  // Editor state — hydrated from localStorage AFTER mount to avoid SSR mismatch.
  // Initial value is the empty string on both server and client so hydration matches.
  const [customSortCode, setCustomSortCode] = useState("");
  const [customSortName, setCustomSortName] = useState("");
  const [customSortNotes, setCustomSortNotes] = useState("");
  const [customSortEnabled, setCustomSortEnabled] = useState(false);
  const [customSortOpen, setCustomSortOpen] = useState(false);
  // Track when the post-mount hydration has completed so we don't write the
  // initial empty strings back to localStorage and clobber the saved draft.
  const customSortHydratedRef = useRef(false);
  // Saved-sorts library. Initial value is [] on both server and client so SSR
  // hydration matches; the real saved data is loaded in a useEffect after mount.
  // Each saved sort now carries an `enabled` flag and a `color` so multiple
  // can be included in a benchmark run at once, each plotted in its own hue.
  const [savedSorts, setSavedSorts] = useState<{ id: string; name: string; code: string; notes: string; savedAt: string; enabled?: boolean; color?: string }[]>([]);
  const [codeAlgo, setCodeAlgo] = useState<string | null>(null);
  const [codeCopied, setCodeCopied] = useState(false);
  const [customSortError, setCustomSortError] = useState<string | null>(null);
  const [hoverN, setHoverN] = useState<number | null>(null);
  const [hoverBigO, setHoverBigO] = useState<{ id: string; type: "time" | "space" } | null>(null);
  type SortCol = "name" | "speed" | "time" | "tvsb" | "tbigo" | "fit" | "space" | "svsb" | "sbigo";
  const [sortCol, setSortCol] = useState<SortCol>("time");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [chartMode, setChartMode] = useState<"time" | "space" | "ratio" | "space-ratio" | "3d" | "memory" | "product">("time");
  const [adversarialEnabled, setAdversarialEnabled] = useState(true);
  // Polymorphic sweep: when on, each measured sort sorts an integer + float +
  // string array, summed as one timing. Set by the advanced "Polymorphic" preset.
  const [polymorphicMode, setPolymorphicMode] = useState(false);
  // Timestamp when the current run started — used by the dashboard to compute
  // a live ETA from elapsed × (remaining / done). Cleared in reset().
  const [runStartedAt, setRunStartedAt] = useState<number | null>(null);
  // "Notify when done" — fires a Web Notification (with title-bar fallback)
  // when the run finishes. Permission is requested when the user enables it
  // from the dashboard.
  const [notifyOnDone, setNotifyOnDone] = useState(false);
  // Sort engine: V8 (the JS implementations) or Wasm (the AssemblyScript
  // module in /public/wasm-sorts/sorts.wasm). The Wasm bundle is loaded lazily
  // on mount; if it's missing the toggle stays disabled and the dispatch
  // silently falls back to V8.
  const [engine, setEngine] = useState<"v8" | "wasm" | "webgpu">("v8");
  const [wasmBundle, setWasmBundle] = useState<WasmSortBundle | null>(null);
  // WebGPU bundle: either a ready handle (adapter + device + per-algo wrappers)
  // or a "missing" marker that carries the diagnostic reason (browser lacks
  // the API, no adapter, adapter request threw, etc.) for the status banner.
  // On v1 the `byId` map is empty — detection + badge plumbing is wired but
  // no GPU kernels have been ported yet. Dispatch falls through to V8 for any
  // algorithm whose id isn't in WEBGPU_SUPPORTED.
  const [webgpuBundle, setWebgpuBundle] = useState<WebGpuSortBundle | { ready: false; reason: string } | null>(null);
  // Per-run set of algorithm ids that ACTUALLY executed via Wasm (engine was
  // "wasm" AND the algo is in WASM_SUPPORTED AND dataType was integer). Used
  // to tag results rows + mini cards with a "Wasm" badge — non-supported
  // algos fall through to V8 even when the engine pill is on, so we can't
  // just key off the engine state alone.
  const [wasmExecutedAlgos, setWasmExecutedAlgos] = useState<Set<string>>(new Set());
  // Same idea for the WebGPU badge — a per-run set populated only when the
  // dispatch actually routed through a GPU wrapper. Today this stays empty
  // (no kernels) and the badge never appears; it'll start populating the
  // moment a sort gets ported and added to WEBGPU_SUPPORTED.
  const [webgpuExecutedAlgos, setWebgpuExecutedAlgos] = useState<Set<string>>(new Set());
  useEffect(() => {
    let cancelled = false;
    getWasmSorts().then(b => { if (!cancelled && b.ready) setWasmBundle(b); });
    // WebGPU hydration: we keep BOTH the ready and missing states (unlike
    // Wasm, which only keeps the ready handle) so the status banner can
    // distinguish "browser doesn't support it" from "haven't checked yet".
    getWebgpuSorts().then(b => { if (!cancelled) setWebgpuBundle(b); });
    return () => { cancelled = true; };
  }, []);

  // Toggle "notify when done": enabling asks for the Notification permission
  // (if it hasn't been answered yet); if the user denies, the toggle still
  // enables — the title-bar fallback in the firing effect will pick it up.
  const toggleNotifyOnDone = useCallback(async () => {
    if (notifyOnDone) { setNotifyOnDone(false); return; }
    setNotifyOnDone(true);
    try {
      if (typeof Notification !== "undefined" && Notification.permission === "default") {
        await Notification.requestPermission();
      }
    } catch { /* swallow */ }
  }, [notifyOnDone]);

  // Fire a "benchmark complete" notification when the run finishes, if the
  // user toggled "Notify when done" in the dashboard. Falls back to a
  // title-bar flash when Notifications are unavailable or denied.
  const prevStatusForNotifyRef = useRef<"idle" | "running" | "done">("idle");
  useEffect(() => {
    const prev = prevStatusForNotifyRef.current;
    prevStatusForNotifyRef.current = status as "idle" | "running" | "done";
    if (prev !== "running" || status !== "done" || !notifyOnDone) return;
    const title = "Benchmark complete";
    const body = `Done at ${new Date().toLocaleTimeString()}`;
    const fireTitleFallback = () => {
      if (typeof document === "undefined") return;
      const orig = document.title;
      document.title = `✓ ${title} — ${orig}`;
      const restore = () => {
        document.title = orig;
        document.removeEventListener("visibilitychange", restore);
        window.removeEventListener("focus", restore);
      };
      document.addEventListener("visibilitychange", restore);
      window.addEventListener("focus", restore);
    };
    try {
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        new Notification(title, { body });
        return;
      }
    } catch { /* swallow */ }
    fireTitleFallback();
  }, [status, notifyOnDone]);
  // Duplicate input each round (default ON). ON copies each round's shared input
  // into a reused scratch array (correct, fair, low-allocation). OFF sorts the
  // shared input in place (lowest memory, diagnostic — see the toggle's note).
  const [duplicatePerRound, setDuplicatePerRound] = useState(true);
  // Persisted running log of winners across runs, broken out by data type.
  // Each successful (algo, size) point from a run contributes one sample to a
  // rolling average keyed by (dataType, algoId, size). Hydrated after mount
  // to avoid SSR mismatch, then written back to localStorage on each update.
  const [winnerLog, setWinnerLog] = useState<WinnerLog>({});
  const winnerLogHydratedRef = useRef(false);
  useEffect(() => {
    try {
      const raw = localStorage.getItem("codecookbook.winnerLog");
      if (raw) setWinnerLog(JSON.parse(raw) as WinnerLog);
    } catch { /* ignore parse / quota errors */ }
    winnerLogHydratedRef.current = true;
  }, []);
  // Session-wide curve log: per (dataType, algoId, n) we store rolling means of
  // timing and aux memory, persisted to localStorage so the SessionCurves view
  // accumulates across every benchmark run the user has done in this session.
  const [sessionLog, setSessionLog] = useState<SessionLog>({});
  useEffect(() => {
    try {
      const raw = localStorage.getItem("codecookbook.sessionLog");
      if (raw) setSessionLog(JSON.parse(raw) as SessionLog);
    } catch { /* ignore parse / quota errors */ }
  }, []);
  // Status message for the Session-data toolbar's Import button. Auto-clears
  // after ~4 s so the toolbar doesn't keep stale messaging stuck on screen.
  const [sessionImportMsg, setSessionImportMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  useEffect(() => {
    if (!sessionImportMsg) return;
    const t = setTimeout(() => setSessionImportMsg(null), 4000);
    return () => clearTimeout(t);
  }, [sessionImportMsg]);
  // Session totals — count of completed runs + first-run timestamp. Both
  // persisted; the timestamp seeds the "session age" readout in the summary.
  const [runCount, setRunCount] = useState(0);
  const [sessionStartedAt, setSessionStartedAt] = useState<number | null>(null);
  useEffect(() => {
    try {
      const c = localStorage.getItem("codecookbook.runCount");
      if (c) setRunCount(Number(c) || 0);
      const a = localStorage.getItem("codecookbook.sessionStartedAt");
      if (a) setSessionStartedAt(Number(a) || null);
    } catch { /* ignore */ }
  }, []);
  const [miniCardSort, setMiniCardSort] = useState<"time" | "space" | "both">("time");
  const [customInput, setCustomInput] = useState("");
  const [pendingCustomN, setPendingCustomN] = useState<number | null>(null);
  const [customPreSorted, setCustomPreSorted] = useState(0);
  const [customDuplicates, setCustomDuplicates] = useState(0);
  // Integer-only options: guarantee unique values, or sample from the full
  // signed 32-bit range instead of the legacy [0, 10000) range.
  const [intUniqueOnly, setIntUniqueOnly] = useState(false);
  const [intFullInt32, setIntFullInt32] = useState(false);
  // Value distribution for the "random" scenario (uniform, normal, exponential,
  // bimodal). Affects integer + float generation; the other scenarios have
  // fixed structural semantics and ignore it.
  const [valueDist, setValueDist] = useState<ValueDistribution>("uniform");
  const [quickPivot, setQuickPivot] = useState<QuickPivot>("median3");
  const [shellGaps, setShellGaps] = useState<ShellGaps>("ciura");
  const [dataType, setDataType] = useState<DataType>("integer");
  const [shareState, setShareState] = useState<"idle" | "copied">("idle");
  const exportChartPNGRef = useRef<(() => void) | undefined>(undefined);
  const [mdCopied, setMdCopied] = useState(false);
  const resultsRef = useRef<HTMLDivElement>(null);
  const [prerunSteps, setPrerunSteps] = useState<Record<string, SortStep[]>>({});
  const [progressLocked, setProgressLocked] = useState(true);
  const [resultsMaximized, setResultsMaximized] = useState(false);
  const stopRef = useRef(false);
  // Tracks when the user clicked Stop, so we can show a "still working..." hint
  // if it doesn't actually stop within ~250ms (typical for main-thread mode).
  const [stopPending, setStopPending] = useState(false);
  const excludedRef = useRef<Set<string>>(new Set());
  const algoSleepResolveRef = useRef<(() => void) | null>(null);
  const algoSleepTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track the currently-running worker so stop() can terminate it mid-flight.
  // Without this, a stop click during a long worker sort just waits for it to finish.
  const currentWorkerRef = useRef<Worker | null>(null);
  const currentWorkerResolveRef = useRef<((v: { timeMs: number; meanMs: number; stdDev: number; roundTimes?: number[]; timedOut: boolean; stopped?: boolean; error?: string }) => void) | null>(null);

  // Lock chart cursor to the n currently being benchmarked
  useEffect(() => {
    if (progressLocked && status === "running" && currentN !== null) {
      setHoverN(currentN);
    }
  }, [currentN, progressLocked, status]);

  // Post-mount hydration: load custom-sort library AND the editor draft from
  // localStorage. Doing this in useEffect (instead of in useState's initializer)
  // avoids the SSR-vs-client mismatch warning and the "saved sorts disappear
  // for a frame after refresh" bug.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = localStorage.getItem("codecookbook.savedSorts");
      if (stored) setSavedSorts(JSON.parse(stored));
    } catch { /* corrupted JSON or quota — ignore */ }
    try {
      const draft = localStorage.getItem("codecookbook.customSortDraft");
      if (draft) {
        const d = JSON.parse(draft) as { code?: string; name?: string; notes?: string; enabled?: boolean };
        if (typeof d.code === "string") setCustomSortCode(d.code);
        if (typeof d.name === "string") setCustomSortName(d.name);
        if (typeof d.notes === "string") setCustomSortNotes(d.notes);
        if (typeof d.enabled === "boolean") setCustomSortEnabled(d.enabled);
      }
    } catch { /* ignore */ }
    customSortHydratedRef.current = true;
  }, []);

  // Hydrate ghost-mode history + toggle from localStorage after mount.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem("codecookbook.ghostRuns");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") setGhostRuns(parsed);
      }
    } catch { /* corrupt JSON — ignore */ }
    try {
      setGhostMode(localStorage.getItem("codecookbook.ghostMode") === "on");
    } catch { /* ignore */ }
    ghostHydratedRef.current = true;
  }, []);

  // Persist ghost runs whenever they change (after hydration completes).
  useEffect(() => {
    if (!ghostHydratedRef.current || typeof window === "undefined") return;
    try {
      localStorage.setItem("codecookbook.ghostRuns", JSON.stringify(ghostRuns));
    } catch { /* quota — drop silently */ }
  }, [ghostRuns]);

  // Persist ghost-mode toggle.
  useEffect(() => {
    if (!ghostHydratedRef.current || typeof window === "undefined") return;
    try {
      localStorage.setItem("codecookbook.ghostMode", ghostMode ? "on" : "off");
    } catch { /* ignore */ }
  }, [ghostMode]);

  // Sync saved-sort metadata into ALGO_NAMES / ALGO_COLORS so chart lookups,
  // mini cards, rankings, etc. all resolve `custom-${id}` ids to the user's
  // chosen name and color. This runs SYNCHRONOUSLY during render (not in
  // useEffect) so children see the latest names on the same render cycle the
  // user renames or recolors a saved sort — useEffect would lag by one frame
  // and the chart would briefly show the stale name. The maps are Proxy
  // targets whose `get` trap consults the underlying object first, so direct
  // assignment is the simplest way to extend without rewriting every consumer.
  // useMemo gives us "run only when savedSorts changes" for free.
  useMemo(() => {
    const namesObj  = ALGO_NAMES  as Record<string, string>;
    const colorsObj = ALGO_COLORS as Record<string, string>;
    savedSorts.forEach((s, i) => {
      const key = `custom-${s.id}`;
      namesObj[key]  = s.name || `Custom ${i + 1}`;
      colorsObj[key] = s.color || defaultCustomColor(i);
    });
    return savedSorts.length;
  }, [savedSorts]);

  // Memory-sampling timer: only ticks while a benchmark is running. Records a
  // sample every 100 ms tagged with the currentAlgo + currentN at the moment
  // of sampling. Samples accumulate into memSamples and survive after the run
  // so the user can scrub the timeline.
  useEffect(() => {
    if (status !== "running") return;
    if (typeof performance === "undefined") return;
    const startedAt = performance.now();
    const tick = () => {
      const perfMem = (performance as unknown as { memory?: { usedJSHeapSize: number; totalJSHeapSize: number } }).memory;
      if (!perfMem) return;
      const sample: MemSample = {
        ts: performance.now() - startedAt,
        used: perfMem.usedJSHeapSize,
        total: perfMem.totalJSHeapSize,
        algoId: currentAlgoRef.current,
        n: currentNRef.current,
      };
      // Cap at 4000 samples (~6.5 min @ 100ms) to keep render cheap.
      setMemSamples(prev => prev.length >= 4000 ? [...prev.slice(1), sample] : [...prev, sample]);
    };
    tick();
    const id = setInterval(tick, 100);
    return () => clearInterval(id);
    // The effect re-runs only on status change; currentAlgo/currentN are read
    // through refs so we don't re-create the interval on every state update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  // Page-visibility listener: flag any time the tab goes hidden while a
  // benchmark is running so we can warn the user that timings collected during
  // that window are likely throttled (browsers slow background-tab timers).
  useEffect(() => {
    if (typeof document === "undefined") return;
    const handler = () => {
      if (document.visibilityState === "hidden" && status === "running") {
        setTabHiddenDuringRun(true);
      }
    };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, [status]);

  // Persist the active editor draft (code, name, notes, enabled flag) whenever
  // it changes, so typed-but-not-yet-saved work survives a refresh or navigation.
  // Guarded by customSortHydratedRef so the initial empty render doesn't wipe
  // the stored draft before the hydration effect above has loaded it.
  useEffect(() => {
    if (!customSortHydratedRef.current) return;
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem("codecookbook.customSortDraft", JSON.stringify({
        code: customSortCode,
        name: customSortName,
        notes: customSortNotes,
        enabled: customSortEnabled,
      }));
    } catch { /* quota — ignore */ }
  }, [customSortCode, customSortName, customSortNotes, customSortEnabled]);

  // Decode run config from URL on mount (for shared links)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const algosParam = params.get("algos");
    if (algosParam) {
      const ids = algosParam.split(",").filter(id => SORT_FNS[id] !== undefined);
      if (ids.length > 0) setSelected(new Set(ids));
    }
    const sizesParam = params.get("sizes");
    if (sizesParam) {
      const ns = sizesParam.split(",").map(Number).filter(n => n > 0 && Number.isFinite(n));
      if (ns.length > 0) setSelectedSizes(new Set(ns));
    }
    const scParam = params.get("sc");
    if (scParam) {
      const valid = scParam.split(",").filter(s => SCENARIO_OPTIONS.some(o => o.id === s)) as BenchmarkScenario[];
      if (valid.length > 0) setScenarios(new Set(valid));
    }
    const roundsVal = Number(params.get("rounds"));
    if (roundsVal >= 1 && roundsVal <= 50) setRounds(roundsVal);
    const warmupVal = Number(params.get("warmup"));
    if (warmupVal >= 0 && warmupVal <= 49) setWarmup(warmupVal);
    const pivotParam = params.get("pivot");
    if (pivotParam && (["first","last","median3","random"] as string[]).includes(pivotParam)) setQuickPivot(pivotParam as QuickPivot);
    const gapsParam = params.get("gaps");
    if (gapsParam && (["shell","hibbard","sedgewick","ciura"] as string[]).includes(gapsParam)) setShellGaps(gapsParam as ShellGaps);
    const preSortedVal = Number(params.get("preSorted"));
    if (preSortedVal >= 0 && preSortedVal <= 100) setCustomPreSorted(preSortedVal);
    const dupsVal = Number(params.get("dups"));
    if (dupsVal >= 0 && dupsVal <= 100) setCustomDuplicates(dupsVal);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Encode current config into URL so Share button copies a valid link
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams();
    if (selected.size) params.set("algos", [...selected].join(","));
    if (selectedSizes.size) params.set("sizes", [...selectedSizes].join(","));
    const sc = [...scenarios];
    if (sc.length && !(sc.length === 1 && sc[0] === "random")) params.set("sc", sc.join(","));
    if (rounds !== 8) params.set("rounds", String(rounds));
    if (warmup !== 3) params.set("warmup", String(warmup));
    if (quickPivot !== "median3") params.set("pivot", quickPivot);
    if (shellGaps !== "ciura") params.set("gaps", shellGaps);
    if (customPreSorted !== 0) params.set("preSorted", String(customPreSorted));
    if (customDuplicates !== 0) params.set("dups", String(customDuplicates));
    const q = params.toString();
    window.history.replaceState(null, "", q ? "?" + q : window.location.pathname);
  }, [selected, selectedSizes, scenarios, rounds, warmup, quickPivot, shellGaps, customPreSorted, customDuplicates]);

  // Auto-scroll results pane into view when run finishes
  useEffect(() => {
    if (status === "done" && resultsRef.current) {
      resultsRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [status]);

  // Slow algos are disabled if the largest selected size exceeds the threshold
  const maxSelectedSize = selectedSizes.size > 0 ? Math.max(...selectedSizes) : 0;
  const slowDisabled = (id: string) =>
    (SLOW_IDS.has(id) && maxSelectedSize > SLOW_THRESHOLD) ||
    (MEDIUM_LIMITS[id] !== undefined && maxSelectedSize > MEDIUM_LIMITS[id].threshold) ||
    (!UNLIMITED_IDS.has(id) && maxSelectedSize > LARGE_THRESHOLD);

  const toggleAlgo = (id: string) => {
    if (slowDisabled(id)) return;
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleGroup = (ids: readonly string[]) => {
    const active = ids.filter(id => !slowDisabled(id));
    if (!active.length) return;
    const allOn = active.every(id => selected.has(id));
    setSelected(prev => {
      const next = new Set(prev);
      allOn
        ? active.forEach(id => next.delete(id))
        : active.forEach(id => next.add(id));
      return next;
    });
  };

  const removeSize = (n: number) => {
    setSelectedSizes(prev => {
      const next = new Set(prev);
      next.delete(n);
      return next;
    });
  };

  const addSize = (n: number) => {
    setSelectedSizes(prev => new Set([...prev, n]));
  };

  const submitCustomN = (raw: string) => {
    const n = Math.floor(Number(raw.replace(/[^0-9]/g, "")));
    if (!n || n < 1) { setCustomInput(""); return; }
    if (n > 100_000_000) {
      setPendingCustomN(n);
    } else {
      addSize(n);
      setCustomInput("");
    }
  };

  const confirmCustomN = () => {
    if (pendingCustomN !== null) { addSize(pendingCustomN); setPendingCustomN(null); setCustomInput(""); }
  };

  const cancelCustomN = () => { setPendingCustomN(null); };


  const sortedSizes = [...selectedSizes].sort((a, b) => a - b);
  const activeAlgos = [...selected].filter(id => !slowDisabled(id));

  // ── Derived "what we know about each (algo, dtype, n)" memos ────────────
  // These read from the persistent sessionLog so the config card can show
  // long-term averages rather than just current-run values. Both rebuild
  // when sessionLog changes (i.e., after every flushed churn batch or run).

  /** For each n value the user might click, the average measured time across
   *  every (algo, dtype) bucket the sessionLog has for it. Single number
   *  answer to "if I include this size, how long does one round at this n
   *  typically take?" — useful for predicting how big a benchmark you're
   *  about to launch. */
  const nAvgTimes = useMemo(() => {
    const sums: Record<string, { sum: number; count: number }> = {};
    for (const dt of Object.keys(sessionLog)) {
      const algoMap = sessionLog[dt] ?? {};
      for (const algo of Object.keys(algoMap)) {
        const byN = algoMap[algo] ?? {};
        for (const [nKey, pt] of Object.entries(byN)) {
          if (!pt || pt.meanTimeMs <= 0) continue;
          if (!sums[nKey]) sums[nKey] = { sum: 0, count: 0 };
          sums[nKey].sum += pt.meanTimeMs;
          sums[nKey].count++;
        }
      }
    }
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(sums)) out[k] = v.sum / v.count;
    return out;
  }, [sessionLog]);

  /** Per-algo × per-dtype best timing recorded so far. "Best" = at the
   *  largest measured n, since that's the most asymptotically meaningful
   *  sample. Returns null per (algo, dtype) when no data has landed yet. */
  const algoBestTimes = useMemo(() => {
    const out: Record<string, Partial<Record<DataType, { n: number; ms: number } | null>>> = {};
    for (const dtRaw of Object.keys(sessionLog)) {
      const dt = dtRaw as DataType;
      if (dt !== "integer" && dt !== "float" && dt !== "string") continue;
      const algoMap = sessionLog[dt] ?? {};
      for (const algo of Object.keys(algoMap)) {
        const byN = algoMap[algo] ?? {};
        let bestN = -1, bestMs = 0;
        for (const [nKey, pt] of Object.entries(byN)) {
          const n = Number(nKey);
          if (!Number.isFinite(n) || n <= 0 || !pt || pt.meanTimeMs <= 0) continue;
          if (n > bestN) { bestN = n; bestMs = pt.meanTimeMs; }
        }
        if (bestN > 0) {
          if (!out[algo]) out[algo] = {};
          out[algo][dt] = { n: bestN, ms: bestMs };
        }
      }
    }
    return out;
  }, [sessionLog]);

  const exportCSV = () => {
    const rows: (string | number)[][] = [
      ["algo", "n", "timeMs_best", "timeMs_mean", "timeMs_stdDev", "spaceBytes", "timedOut", "scenarios"],
    ];
    for (const [id, pts] of Object.entries(curveDataExt)) {
      if (id === "timsort-js" && !curveData["timsort-js"]?.length) continue; // skip if not measured
      for (const p of pts) {
        rows.push([
          id, p.n,
          p.timeMs.toFixed(4),
          p.meanMs != null ? p.meanMs.toFixed(4) : "",
          p.stdDev != null ? p.stdDev.toFixed(4) : "",
          p.spaceBytes ?? "",
          p.timedOut ? 1 : 0,
          runConfig?.scenarios.join("|") ?? "",
        ]);
      }
    }
    const csv = rows.map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "benchmark.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  /*
   * Build a human-readable plain-text benchmark report.
   *
   * Layout:
   *   1. Header: timestamp, run config (sizes, scenarios, rounds/warmup, etc.)
   *   2. SUMMARY block: cross-algorithm comparison numbers — winner, finish
   *      order at the largest n, head-to-head ratios, fitted complexity
   *      exponents, failure flags. This is the part that lets a reader
   *      compare without scrolling.
   *   3. Per-algorithm sections (in finishing order): every measured n,
   *      best/mean/stdev, space numbers, theoretical aux, peak heap delta if
   *      live-memory samples exist, sortedness check.
   */
  const exportReportText = () => {
    const algos = Object.keys(curveDataExt).filter(id => (curveDataExt[id] ?? []).some(p => !p.timedOut && p.timeMs > 0));
    const sizes = [...selectedSizes].sort((a, b) => a - b);
    const largestN = sizes[sizes.length - 1] ?? 0;
    const pad = (s: string, n: number) => s.padEnd(n);
    const padR = (s: string, n: number) => s.padStart(n);

    // ── Header ────────────────────────────────────────────────────────────
    const lines: string[] = [];
    lines.push("=".repeat(72));
    lines.push("  CODECOOKBOOK BENCHMARK REPORT");
    lines.push(`  Generated: ${new Date().toISOString()}`);
    lines.push("=".repeat(72));
    lines.push("");
    lines.push("CONFIGURATION");
    lines.push("-".repeat(72));
    lines.push(`  data type        : ${dataType}`);
    lines.push(`  input sizes      : ${sizes.map(n => n.toLocaleString()).join(", ")}`);
    lines.push(`  scenarios        : ${runConfig?.scenarios.join(", ") ?? [...scenarios].join(", ")}`);
    lines.push(`  rounds / warmup  : ${runConfig?.rounds ?? rounds} rounds, ${runConfig?.warmup ?? warmup} discarded`);
    lines.push(`  worker isolation : ${useWorkerIsolation ? "ON" : "off"}`);
    lines.push(`  adversarial input: ${adversarialEnabled ? "ON" : "off"}`);
    lines.push(`  per-sort timeout : ${timeoutEnabled ? `${timeoutSec}s` : "uncapped"}`);
    if (tabHiddenDuringRun) lines.push(`  ⚠ tab was backgrounded during this run — timings may be throttled`);
    lines.push("");

    // ── Cross-algo summary (sorted by best time at largestN) ──────────────
    type RowSummary = {
      id: string;
      name: string;
      bestAtMaxN: number;
      meanAtMaxN: number | null;
      stdDevAtMaxN: number | null;
      fitExp: number | null;
      fitK: number | null;
      timedOut: boolean;
      failed: boolean;
      auxBytes: number | null;
      auxSource: "instrumented" | "heap" | "theoretical";
    };
    const rows: RowSummary[] = algos.map(id => {
      const pts = curveDataExt[id] ?? [];
      const pt = pts.find(p => p.n === largestN) ?? pts[pts.length - 1];
      // Fit empirical exponent from log-log regression of mean times.
      const validPts = pts.filter(p => !p.timedOut && p.timeMs > 0).map(p => ({ n: p.n, val: p.meanMs ?? p.timeMs }));
      const fit = validPts.length >= 2 ? fitLogLog(validPts) : null;
      // Pick the best actual aux measurement source available.
      let auxBytes: number | null = null;
      let auxSource: RowSummary["auxSource"] = "theoretical";
      if (pt) {
        if (pt.allocBytes != null && pt.allocBytes > 0) { auxBytes = pt.allocBytes; auxSource = "instrumented"; }
        else if (pt.spaceBytes != null && pt.spaceBytes > 0) { auxBytes = pt.spaceBytes; auxSource = "heap"; }
        else { auxBytes = theoreticalSpaceBytes(id, largestN); auxSource = "theoretical"; }
      }
      return {
        id,
        name: ALGO_NAMES[id] ?? id,
        bestAtMaxN: pt?.timeMs ?? Infinity,
        meanAtMaxN: pt?.meanMs ?? null,
        stdDevAtMaxN: pt?.stdDev ?? null,
        fitExp: fit?.exp ?? null,
        fitK: fit?.k ?? null,
        timedOut: !!pt?.timedOut,
        failed: !!sampleProofs[id]?.failed,
        auxBytes,
        auxSource,
      };
    }).sort((a, b) => a.bestAtMaxN - b.bestAtMaxN);

    const winner = rows[0];
    lines.push("SUMMARY");
    lines.push("-".repeat(72));
    if (rows.length > 0 && winner) {
      lines.push(`  🏆 Winner @ n=${largestN.toLocaleString()}: ${winner.name} (${fmtTime(winner.bestAtMaxN)})`);
      const failures = rows.filter(r => r.failed);
      if (failures.length > 0) {
        lines.push(`  ✗ Failed sortedness check: ${failures.map(f => f.name).join(", ")}`);
      }
      const timeouts = rows.filter(r => r.timedOut);
      if (timeouts.length > 0) {
        lines.push(`  ⌛ Timed out: ${timeouts.map(t => t.name).join(", ")}`);
      }
      lines.push("");

      // Cross-algorithm ranking table — fixed-width columns aligned for plain-text viewing.
      const NAME_W = Math.max(20, Math.max(...rows.map(r => r.name.length)) + 2);
      lines.push(`  ${pad("Rank Algorithm", NAME_W + 5)} ${padR("Time", 12)} ${padR("× winner", 10)} ${padR("Mean ± stdev", 22)} ${padR("Fit", 10)} ${padR("Aux mem", 14)}`);
      lines.push(`  ${"-".repeat(NAME_W + 5 + 12 + 10 + 22 + 10 + 14 + 5)}`);
      rows.forEach((r, i) => {
        const ratio = i === 0 ? "0×" : `${(r.bestAtMaxN / winner.bestAtMaxN).toFixed(2)}×`;
        const flag = r.failed ? " ✗" : r.timedOut ? " ⌛" : "";
        const meanStr = r.meanAtMaxN != null
          ? `μ ${fmtTime(r.meanAtMaxN)}${r.stdDevAtMaxN != null ? ` ±${fmtTime(r.stdDevAtMaxN)}` : ""}`
          : "—";
        const fitStr = r.fitExp != null ? `n^${r.fitExp.toFixed(2)}` : "—";
        const auxStr = r.auxBytes != null
          ? `${fmtBytes(r.auxBytes)}${r.auxSource === "instrumented" ? " i" : r.auxSource === "heap" ? " h" : " t"}`
          : "—";
        lines.push(`  ${padR(String(i + 1), 4)} ${pad(r.name + flag, NAME_W)} ${padR(fmtTime(r.bestAtMaxN), 12)} ${padR(ratio, 10)} ${padR(meanStr, 22)} ${padR(fitStr, 10)} ${padR(auxStr, 14)}`);
      });
      lines.push("");
      lines.push(`  Aux source legend: i = instrumented (deterministic byte count from patched Array methods)`);
      lines.push(`                     h = heap delta (performance.memory snapshot, ~1MB resolution)`);
      lines.push(`                     t = theoretical (derived from the algorithm's space-complexity class)`);
      lines.push("");

      // Head-to-head: how much faster is the winner vs everyone else?
      if (rows.length >= 2) {
        lines.push(`  Speedup vs ${winner.name}:`);
        rows.slice(1).forEach(r => {
          const x = r.bestAtMaxN / winner.bestAtMaxN;
          lines.push(`    ${pad(r.name, NAME_W)} ${padR(`${x.toFixed(2)}× slower`, 16)}  (${fmtTime(r.bestAtMaxN - winner.bestAtMaxN)} extra)`);
        });
        lines.push("");
      }
    } else {
      lines.push(`  (no algorithms produced timing data)`);
      lines.push("");
    }

    // ── Per-algorithm sections (in winner-first order) ───────────────────
    lines.push("PER-ALGORITHM DETAIL");
    lines.push("-".repeat(72));
    lines.push("");
    rows.forEach((r, i) => {
      const pts = (curveDataExt[r.id] ?? []).slice().sort((a, b) => a.n - b.n);
      lines.push(`#${i + 1} — ${r.name}${r.failed ? "  ✗ BROKEN" : r.timedOut ? "  ⌛ TIMED OUT" : ""}`);
      lines.push(`  id              : ${r.id}`);
      lines.push(`  time class      : ${ALGO_TIME[r.id] ?? "—"}`);
      lines.push(`  space class     : aux ${ALGO_SPACE[r.id] ?? "—"} · total ${totalSpaceLabel(r.id)}`);
      lines.push(`  stable          : ${ALGO_STABLE[r.id] === true ? "stable" : ALGO_STABLE[r.id] === false ? "unstable" : "—"}`);
      lines.push(`  online          : ${ALGO_ONLINE[r.id] === true ? "yes" : ALGO_ONLINE[r.id] === false ? "no" : "—"}`);
      if (r.fitExp != null && r.fitK != null) {
        lines.push(`  empirical fit   : T(n) ≈ ${r.fitK.toExponential(3)} · n^${r.fitExp.toFixed(3)} ms`);
      }
      if (sampleProofs[r.id]) {
        const sp = sampleProofs[r.id];
        if (sp.minVal !== undefined && sp.maxVal !== undefined) {
          lines.push(`  input range     : ${fmtRangeVal(sp.minVal)} … ${fmtRangeVal(sp.maxVal)}`);
        }
        if (sp.distinctCount !== undefined) {
          lines.push(`  distinct values : ${sp.distinctCount.toLocaleString()}${sp.distinctCount < sp.n ? ` / ${sp.n.toLocaleString()}` : ""}`);
        }
        if (sp.totalInputBytes !== undefined) {
          lines.push(`  input bytes     : ${fmtBytes(sp.totalInputBytes)} (~${sp.bytesPerElement} B/elem)`);
        }
        lines.push(`  sortedness check: ${sp.failed ? `✗ out-of-order at sample index ${sp.badIdx}` : "✓ verified"}`);
      }

      lines.push("");
      lines.push(`    ${padR("n", 12)} ${padR("Best", 12)} ${padR("Mean", 12)} ${padR("Stdev", 12)} ${padR("Aux bytes", 14)} ${padR("Status", 12)}`);
      lines.push(`    ${"-".repeat(12 + 12 + 12 + 12 + 14 + 12 + 5)}`);
      pts.forEach(p => {
        const status = p.timedOut ? "timeout" : "ok";
        const aux = p.allocBytes != null && p.allocBytes > 0 ? `${fmtBytes(p.allocBytes)} i`
                  : p.spaceBytes != null && p.spaceBytes > 0 ? `${fmtBytes(p.spaceBytes)} h`
                  : "—";
        lines.push(`    ${padR(p.n.toLocaleString(), 12)} ${padR(p.timedOut ? ">" + (timeoutSec ?? 10) + "s" : fmtTime(p.timeMs), 12)} ${padR(p.meanMs != null ? fmtTime(p.meanMs) : "—", 12)} ${padR(p.stdDev != null ? fmtTime(p.stdDev) : "—", 12)} ${padR(aux, 14)} ${padR(status, 12)}`);
      });

      // Live memory peak delta during this algo's window, if recorded.
      const algoMemSamples = memSamples.filter(s => s.algoId === r.id);
      if (algoMemSamples.length > 0) {
        const startHeap = algoMemSamples[0].used;
        const peakHeap = Math.max(...algoMemSamples.map(s => s.used));
        lines.push("");
        lines.push(`    live heap peak Δ : +${fmtBytes(peakHeap - startHeap)} across ${algoMemSamples.length.toLocaleString()} samples`);
      }
      lines.push("");
    });

    lines.push("=".repeat(72));
    lines.push(`  end of report · ${rows.length} algorithms × ${sizes.length} sizes`);
    lines.push("=".repeat(72));

    const text = lines.join("\n");
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    a.href = url;
    a.download = `benchmark-report-${stamp}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Helper for range stats: handles both numeric and string min/max from proof
  function fmtRangeVal(v: number | string): string {
    if (typeof v === "string") return v.length > 12 ? `"${v.slice(0, 11)}…"` : `"${v}"`;
    if (Number.isInteger(v)) return v.toString();
    return v.toFixed(3);
  }

  const exportMarkdown = () => {
    const algos = Object.keys(curveDataExt);
    const sizes = [...selectedSizes].sort((a, b) => a - b);
    const header = ["Algorithm", ...sizes.map(n => `n=${fmtN(n)}`)].join(" | ");
    const sep = ["---", ...sizes.map(() => "---:")].join(" | ");
    const rows = algos.map(id => {
      const name = ALGO_NAMES[id] ?? id;
      const cells = sizes.map(n => {
        const pt = curveDataExt[id]?.find(p => p.n === n);
        if (!pt) return "—";
        if (pt.timedOut) return "timeout";
        return fmtTime(pt.timeMs);
      });
      return [name, ...cells].join(" | ");
    });
    const md = [`| ${header} |`, `| ${sep} |`, ...rows.map(r => `| ${r} |`)].join("\n");
    navigator.clipboard.writeText(md).then(() => {
      setMdCopied(true);
      setTimeout(() => setMdCopied(false), 1500);
    });
  };

  // The list of enabled saved sorts — those that will actually run.
  // The editor's draft no longer runs directly; it must be Saved first.
  const enabledSavedSorts = savedSorts.filter(s => s.enabled);
  const canRun = (activeAlgos.length > 0 || enabledSavedSorts.length > 0) && selectedSizes.size > 0 && scenarios.size > 0 && status !== "running";
  const canRunCustomOnly = enabledSavedSorts.length > 0 && selectedSizes.size > 0 && scenarios.size > 0 && status !== "running";

  // ── Churn Mode loop ──────────────────────────────────────────────────────
  // The probe + driver are wrapped in a single ref-stored closure so the
  // setTimeout chain doesn't tear down on every state change. The outer
  // useEffect only watches `churnMode` — toggling it is the cancel signal.
  const churnTickRef = useRef<() => Promise<void>>(() => Promise.resolve());
  churnTickRef.current = async () => {
    if (!churnActiveRef.current) return;
    // Pause while a normal benchmark is running so we don't fight it for cycles
    // (and so a user-launched run gets clean unshared timing).
    if (status === "running") return;

    // Eligible pool: anything currently selected, not slowDisabled. The
    // active engine (V8 / Wasm / WebGPU) is honored — supported algos route
    // through that engine just like a real benchmark run would, so churn
    // exercises whatever the user actually has selected. Falls back to V8
    // for unsupported (id, engine, dtype) tuples (same dispatch rule as run()).
    const candidates = [...selected].filter(id => !slowDisabled(id));
    const enabledCustoms = savedSorts.filter(s => s.enabled).map(s => `custom-${s.id}`);
    const pool = [...candidates, ...enabledCustoms];
    if (pool.length === 0) return;

    // Sweep-completion gate. If every algo in the pool has saturated, the
    // sweep has answered its question — further probing on already-timed-out
    // levels just adds noise. We mark `churnComplete` so the indicator can
    // announce it, flush any straggler probes one last time, and stop. If
    // the user adds a new algo to their selection later, that algo won't be
    // saturated and churn auto-resumes (no manual restart needed).
    const unsaturatedIds = pool.filter(pid => !(churnStateRef.current[pid]?.saturated));
    if (unsaturatedIds.length === 0) {
      if (!churnCompleteRef.current) {
        churnCompleteRef.current = true;
        setChurnComplete(true);
        // Final flush so the last few probes land in the persistent stores
        // before we go quiet.
        const pending = churnAccumRef.current;
        if (Object.values(pending).some(b => b.length > 0)) {
          churnAccumRef.current = {};
          flushChurnBuffer(pending, Date.now());
        }
      }
      return;
    }
    // We've got at least one unsaturated algo, so the sweep is still active.
    // Make sure the complete flag is cleared in case the user just enabled a
    // new algo that brought the pool back to "in progress".
    if (churnCompleteRef.current) {
      churnCompleteRef.current = false;
      setChurnComplete(false);
    }

    // Split the pool by saturation. Saturated algos are revisited at random
    // CHURN_DRIFT_SAMPLE_PROB of the time for drift detection; the rest of
    // the budget goes to non-saturated algos so unfinished sweeps progress.
    const useUnsaturated = Math.random() >= CHURN_DRIFT_SAMPLE_PROB;
    const sourcePool = useUnsaturated ? unsaturatedIds : pool;
    const id = sourcePool[Math.floor(Math.random() * sourcePool.length)];

    // Lazy-init this algo's adaptive state on first sight.
    const prev: ChurnAlgoState = churnStateRef.current[id] ?? {
      currentLevel: CHURN_N_MIN,
      samplesAtLevel: 0,
      saturated: false,
      maxCompletedLevel: 0,
      exploredLevels: [],
      samples: 0, timeouts: 0, lastTimeMs: null, lastN: null,
    };

    // Pick the probe size. Non-saturated: stick at currentLevel until 5 samples
    // are in. Saturated: random previously-explored level for drift sampling.
    const n: number = prev.saturated && prev.exploredLevels.length > 0
      ? prev.exploredLevels[Math.floor(Math.random() * prev.exploredLevels.length)]
      : prev.currentLevel;

    // Resolve the function for this algo. Mirrors run() dispatch order
    // (wasm > webgpu > custom > factory variants > SORT_FNS) so churn timings
    // are comparable to what a full benchmark would record.
    const savedCustom = id.startsWith("custom-") ? savedSorts.find(s => `custom-${s.id}` === id) : null;
    // Wasm dispatch — same gating rule as the run loop.
    const wasmFn = engine === "wasm" && wasmBundle && dataType === "integer" && WASM_SUPPORTED.has(id)
      ? (wasmBundle.byId[id] as (arr: unknown[]) => unknown[])
      : null;
    // WebGPU dispatch — returns Promise<unknown[]>; the timing path below awaits.
    const gpuBundle = (engine === "webgpu" && webgpuBundle && webgpuBundle.ready) ? webgpuBundle : null;
    const gpuFn = gpuBundle && dataType === "integer" && WEBGPU_SUPPORTED.has(id)
      ? (gpuBundle.byId[id] as unknown as (arr: unknown[]) => unknown[] | Promise<unknown[]>)
      : null;
    const baseFn: ((arr: unknown[]) => unknown[] | Promise<unknown[]>) | null =
      gpuFn  ? gpuFn :
      wasmFn ? wasmFn :
      id === "custom"     ? buildCustomFn(customSortCode, setCustomSortError) :
      savedCustom         ? buildCustomFn(savedCustom.code, () => { /* swallow */ }) :
      id === "quick"      ? makeQuickSort(quickPivot) as never :
      id === "shell"      ? makeShellSort(shellGaps) as never :
      dataType === "string" && id === "timsort" ? ((arr: unknown[]) => [...arr].sort()) :
      SORT_FNS[id]        ? freshSortFn(SORT_FNS[id]) as never :
      null;
    if (!baseFn) return;
    // Tag execution-engine badges so the indicators flip on the same moment
    // they would during a real benchmark run.
    if (wasmFn) setWasmExecutedAlgos(s => s.has(id) ? s : new Set(s).add(id));
    if (gpuFn)  setWebgpuExecutedAlgos(s => s.has(id) ? s : new Set(s).add(id));

    // Generate input. Always "random" with no custom distribution — churn's
    // drift-detection job is about run-over-run variance, not adversarial
    // coverage. If the user wants distribution-specific data, they can toggle
    // off churn and run a precise benchmark instead.
    const arr: unknown[] =
      dataType === "string" ? generateStringInput(n, "random") :
      dataType === "float"  ? generateFloatInput(n, "random") :
                              generateBenchmarkInput(n, "random");

    // Time the probe. measureAllocBytes can't see Wasm/GPU off-heap memory and
    // can't capture async work (its patches unpin synchronously), so we only
    // use it on the pure-JS path; GPU/Wasm probes report allocBytes=0 which
    // is honest for "JS-heap allocations".
    let allocBytes = 0, timeMs = 0, timedOut = false, errored = false;
    const isAsync = !!gpuFn;
    try {
      const work = (arr as unknown[]).slice();
      const t0 = performance.now();
      if (isAsync) {
        // GPU path — await the readback for honest end-to-end timing.
        const ret = baseFn(work) as unknown;
        if (ret && typeof (ret as { then?: unknown }).then === "function") {
          await (ret as Promise<unknown>);
        }
      } else if (wasmFn) {
        // Wasm: synchronous but skip the alloc instrumentation (off-heap).
        baseFn(work);
      } else {
        allocBytes = measureAllocBytes(() => { (baseFn as (a: unknown[]) => unknown[])(work); });
      }
      timeMs = performance.now() - t0;
      timedOut = timeMs > CHURN_BUDGET_MS;
    } catch {
      errored = true;
      timedOut = true;
    }

    // Sweep progression: count this sample, advance the level when we've hit
    // CHURN_SAMPLES_PER_LEVEL clean probes, saturate on any timeout. The
    // level doubles on advance — 64 → 128 → 256 → ... → CHURN_N_MAX.
    let nextLevel = prev.currentLevel;
    let nextSamplesAtLevel = prev.samplesAtLevel + 1;
    let nextSaturated = prev.saturated;
    let nextMaxCompleted = prev.maxCompletedLevel;
    if (!prev.saturated) {
      if (timedOut || errored) {
        nextSaturated = true;
      } else if (nextSamplesAtLevel >= CHURN_SAMPLES_PER_LEVEL) {
        nextMaxCompleted = Math.max(nextMaxCompleted, prev.currentLevel);
        const doubled = prev.currentLevel * 2;
        if (doubled > CHURN_N_MAX) {
          // Hit the explore-space ceiling without a timeout — treat as
          // saturated so we switch to drift sampling.
          nextSaturated = true;
        } else {
          nextLevel = doubled;
          nextSamplesAtLevel = 0;
        }
      }
    }
    const nextExplored = prev.exploredLevels.includes(n)
      ? prev.exploredLevels
      : [...prev.exploredLevels, n];
    const nextState: ChurnAlgoState = {
      currentLevel: nextLevel,
      samplesAtLevel: nextSamplesAtLevel,
      saturated: nextSaturated,
      maxCompletedLevel: nextMaxCompleted,
      exploredLevels: nextExplored,
      samples: prev.samples + 1,
      timeouts: prev.timeouts + (timedOut ? 1 : 0),
      lastTimeMs: errored ? null : timeMs,
      lastN: n,
    };
    churnStateRef.current = { ...churnStateRef.current, [id]: nextState };

    // Accumulate the probe for the next ghost-runs flush. Skip errored probes —
    // they're noise the 3D view can't render meaningfully.
    if (!errored) {
      const buf = churnAccumRef.current[id] ?? [];
      buf.push({ n, timeMs, spaceBytes: allocBytes, ts: Date.now() });
      churnAccumRef.current = { ...churnAccumRef.current, [id]: buf };
    }

    // Record into the rolling visualization history. Errored probes are
    // included (with timeMs=0, timedOut=true) so the recent-probes scatter
    // still shows them as red dots; the ghostRuns flush above filtered them
    // out because the 3D polyline path can't render them. The `ceiling` field
    // now carries the post-probe currentLevel — the sparkline reads it as a
    // monotonic-up staircase showing the sweep progression.
    {
      const rec: ChurnProbeRecord = { ts: Date.now(), n, timeMs: errored ? 0 : timeMs, timedOut, ceiling: nextLevel };
      const prevHist = churnHistoryRef.current[id] ?? [];
      const newHist = prevHist.length >= CHURN_HIST_PER_ALGO
        ? [...prevHist.slice(prevHist.length - CHURN_HIST_PER_ALGO + 1), rec]
        : [...prevHist, rec];
      churnHistoryRef.current = { ...churnHistoryRef.current, [id]: newHist };
    }

    // Update React state — once per probe is fine; the loop never runs faster
    // than ~16/s so we're not flooding the scheduler.
    setChurnState(churnStateRef.current);
    setChurnHistory(churnHistoryRef.current);
    setChurnTotals(t => ({
      probes: t.probes + 1,
      timeouts: t.timeouts + (timedOut ? 1 : 0),
      startedAt: t.startedAt ?? Date.now(),
      lastProbeAt: Date.now(),
    }));

    // Flush check: time-based (every CHURN_FLUSH_INTERVAL_MS) or count-based
    // (any algo's buffer ≥ CHURN_FLUSH_MIN_POINTS). The flush fans the buffer
    // out into FOUR state stores so churn behaves like an "auto-run":
    //   • ghostRuns — historical band, drives the 3D History + 2D ghost overlay
    //   • curveData — the main per-run chart on the right pane (so churn
    //                 points appear in the same chart Run would populate)
    //   • sessionLog — rolling means feeding SessionCurves / SessionMatrix /
    //                  SessionBigO / SortNetworkGraph
    //   • winnerLog — rolling means feeding the WinnersLog panel
    // All four updates use the same rolling-mean shape the regular run loop
    // uses at the end of a benchmark, so a churn-driven session is
    // indistinguishable from one populated by repeated Run clicks.
    const now = Date.now();
    const sinceFlush = now - churnLastFlushRef.current;
    const maxBuffered = Math.max(0, ...Object.values(churnAccumRef.current).map(b => b.length));
    if (sinceFlush >= CHURN_FLUSH_INTERVAL_MS || maxBuffered >= CHURN_FLUSH_MIN_POINTS) {
      const toFlush = churnAccumRef.current;
      churnAccumRef.current = {};
      churnLastFlushRef.current = now;
      flushChurnBuffer(toFlush, now);
    }
  };

  // Single fan-out helper — used by both the periodic in-loop flush and the
  // final flush that fires when the user toggles churn off. Pulled into a
  // closure so we don't duplicate the four setState bodies in two places.
  const flushChurnBuffer = (
    toFlush: Record<string, Array<{ n: number; timeMs: number; spaceBytes: number; ts: number }>>,
    now: number,
  ): void => {
    // 1. Ghost runs — one batch entry per algo per flush.
    setGhostRuns(prevRuns => {
      const next: Record<string, GhostRun[]> = { ...prevRuns };
      for (const [aid, pts] of Object.entries(toFlush)) {
        if (pts.length === 0) continue;
        const byN = new Map<number, typeof pts[number]>();
        for (const p of pts) byN.set(p.n, p);
        const points: GhostPoint[] = [...byN.values()]
          .sort((a, b) => a.n - b.n)
          .map(p => ({ n: p.n, timeMs: p.timeMs, spaceBytes: p.spaceBytes }));
        const updated = [...(next[aid] ?? []), { ts: now, points }];
        next[aid] = updated.length > GHOST_MAX ? updated.slice(-GHOST_MAX) : updated;
      }
      return next;
    });

    // 2. curveData — the right-pane chart. Per (algo, n) we keep the best
    // (fastest) timing across all probes that have hit that bucket; that
    // matches the "best of N rounds" convention the regular run uses.
    setCurveData(prev => {
      const next: CurveData = { ...prev };
      for (const [aid, pts] of Object.entries(toFlush)) {
        if (pts.length === 0) continue;
        const cur: CurvePoint[] = next[aid] ? [...next[aid]] : [];
        const byN = new Map<number, CurvePoint>();
        for (const cp of cur) byN.set(cp.n, cp);
        for (const p of pts) {
          const existing = byN.get(p.n);
          if (existing) {
            byN.set(p.n, {
              ...existing,
              timeMs:     Math.min(existing.timeMs, p.timeMs),
              meanMs:     existing.meanMs != null ? Math.min(existing.meanMs, p.timeMs) : p.timeMs,
              spaceBytes: Math.max(existing.spaceBytes ?? 0, p.spaceBytes),
              allocBytes: Math.max(existing.allocBytes ?? 0, p.spaceBytes),
            });
          } else {
            byN.set(p.n, {
              n: p.n,
              timeMs: p.timeMs,
              meanMs: p.timeMs,
              spaceBytes: p.spaceBytes,
              allocBytes: p.spaceBytes,
            });
          }
        }
        next[aid] = [...byN.values()].sort((a, b) => a.n - b.n);
      }
      return next;
    });

    // 3. sessionLog — rolling mean per (dataType, algo, n). One sample
    // contributed per probe so the runs counter ticks up exactly as it
    // would across many manual Run clicks.
    setSessionLog(prev => {
      const next: SessionLog = { ...prev };
      const dtKey = dataType;
      const dtMap = { ...(next[dtKey] ?? {}) };
      for (const [aid, pts] of Object.entries(toFlush)) {
        if (pts.length === 0) continue;
        const algoMap = { ...(dtMap[aid] ?? {}) };
        for (const p of pts) {
          const key = String(p.n);
          const existing = algoMap[key] ?? { meanTimeMs: 0, meanSpaceBytes: 0, runs: 0 };
          const runs = existing.runs + 1;
          const meanTimeMs    = (existing.meanTimeMs    * existing.runs + p.timeMs)    / runs;
          const meanSpaceBytes = (existing.meanSpaceBytes * existing.runs + p.spaceBytes) / runs;
          algoMap[key] = { meanTimeMs, meanSpaceBytes, runs };
        }
        dtMap[aid] = algoMap;
      }
      next[dtKey] = dtMap;
      try { localStorage.setItem("codecookbook.sessionLog", JSON.stringify(next)); } catch { /* quota */ }
      return next;
    });

    // 4. winnerLog — same rolling-mean shape, but time-only (winners log
    // doesn't track space).
    setWinnerLog(prev => {
      const next: WinnerLog = { ...prev };
      const dtKey = dataType;
      const dtMap = { ...(next[dtKey] ?? {}) };
      for (const [aid, pts] of Object.entries(toFlush)) {
        if (pts.length === 0) continue;
        const algoMap = { ...(dtMap[aid] ?? {}) };
        for (const p of pts) {
          const key = String(p.n);
          const existing = algoMap[key] ?? { meanMs: 0, runs: 0 };
          const runs = existing.runs + 1;
          const meanMs = (existing.meanMs * existing.runs + p.timeMs) / runs;
          algoMap[key] = { meanMs, runs };
        }
        dtMap[aid] = algoMap;
      }
      next[dtKey] = dtMap;
      try { localStorage.setItem("codecookbook.winnerLog", JSON.stringify(next)); } catch { /* quota */ }
      return next;
    });
  };

  useEffect(() => {
    if (!churnMode) {
      churnActiveRef.current = false;
      if (churnTimeoutRef.current != null) { clearTimeout(churnTimeoutRef.current); churnTimeoutRef.current = null; }
      // Final flush of any pending probes so partial data isn't lost when the
      // user toggles off mid-cycle.
      const pending = churnAccumRef.current;
      const pendingHasData = Object.values(pending).some(b => b.length > 0);
      if (pendingHasData) {
        const flushNow = Date.now();
        churnAccumRef.current = {};
        churnLastFlushRef.current = flushNow;
        // Same four-store fan-out the in-loop flush does. Toggling off
        // mid-cycle shouldn't strand a partial batch in the buffer.
        flushChurnBuffer(pending, flushNow);
      }
      return;
    }
    churnActiveRef.current = true;
    setChurnTotals(t => ({ ...t, startedAt: t.startedAt ?? Date.now() }));
    const loop = async () => {
      if (!churnActiveRef.current) return;
      try { await churnTickRef.current(); } catch { /* swallow — keep churning */ }
      if (!churnActiveRef.current) return;
      const delay = CHURN_TICK_MIN_MS + Math.random() * (CHURN_TICK_MAX_MS - CHURN_TICK_MIN_MS);
      churnTimeoutRef.current = setTimeout(loop, delay);
    };
    loop();
    return () => {
      churnActiveRef.current = false;
      if (churnTimeoutRef.current != null) { clearTimeout(churnTimeoutRef.current); churnTimeoutRef.current = null; }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [churnMode]);

  const run = useCallback(async (algoOverride?: string[]) => {
    const maxSz = selectedSizes.size > 0 ? Math.max(...selectedSizes) : 0;
    // Mirror slowDisabled exactly so the run list matches the checked-off checkboxes.
    // Custom sorts are ONLY run if they've been saved to the library and the
    // user enabled them. Unsaved editor draft code is never executed by the
    // benchmark — saving is the explicit "commit" step that makes a sort
    // eligible. This protects against half-edited code accidentally running
    // and produces a stable record (with name + id) for the chart.
    const enabledCustomIds = savedSorts.filter(s => s.enabled).map(s => `custom-${s.id}`);
    // Polymorphic sweep mode: each measured "sort" sorts an integer, a float,
    // AND a string array of the size, summed into one timing. It runs on the
    // main thread (the worker protocol only ships number[][]) and is restricted
    // to comparison sorts whose comparators work across all three types.
    const polyActive = polymorphicMode;
    // Worker isolation can't honor the in-place reuse mode (the worker copies
    // its inputs internally), so fall back to the main thread when duplication
    // is off — same as polymorphic mode.
    // Worker isolation can't honor in-place reuse, polymorphic wrappers, the
    // Wasm engine (the worker doesn't load /wasm-sorts/sorts.wasm), OR the
    // WebGPU engine (workers can't share a GPUDevice with the main thread
    // without OffscreenCanvas plumbing we don't have) — any of those force
    // main-thread timing.
    const wasmActive   = engine === "wasm"   && wasmBundle != null;
    const webgpuActive = engine === "webgpu" && webgpuBundle != null && webgpuBundle.ready === true;
    const workerIso = useWorkerIsolation && !polyActive && duplicatePerRound && !wasmActive && !webgpuActive;
    let algos = algoOverride ?? [
      ...selected,
      ...enabledCustomIds,
    ].filter(id =>
      id.startsWith("custom-") || (
        !(SLOW_IDS.has(id) && maxSz > SLOW_THRESHOLD) &&
        !(MEDIUM_LIMITS[id] !== undefined && maxSz > MEDIUM_LIMITS[id].threshold) &&
        !(!UNLIMITED_IDS.has(id) && maxSz > LARGE_THRESHOLD)
      )
    );
    // In polymorphic mode, keep only type-safe comparison sorts.
    if (polyActive) algos = algos.filter(id => POLY_SAFE.has(id));
    const scenarioList = [...scenarios] as BenchmarkScenario[];
    if (!algos.length || !selectedSizes.size || !scenarioList.length) return;

    const sizes = [...selectedSizes].sort((a, b) => a - b);
    const total = sizes.length * algos.length;

    stopRef.current = false;
    excludedRef.current = new Set();
    setRunStartedAt(Date.now());
    setWasmExecutedAlgos(new Set());
    setWebgpuExecutedAlgos(new Set());
    setStatus("running");
    // Reset the visibility-warning flag for the new run, then seed it correctly
    // if the tab is already hidden when Run is clicked (e.g., from a script).
    setTabHiddenDuringRun(typeof document !== "undefined" && document.visibilityState === "hidden");
    // Reset the live memory timeline for the new run.
    setMemSamples([]);
    setCurveData({});
    setSampleProofs({});
    setActiveProofAlgo(null);
    setHoverN(null);
    setProgress({ done: 0, total });
    setRunConfig({ sizes, scenarios: scenarioList, rounds, warmup, algos });

    // Encode run config into the URL for easy sharing
    if (typeof window !== "undefined") {
      const p = new URLSearchParams();
      p.set("algos", algos.join(","));
      p.set("sizes", sizes.join(","));
      p.set("sc", scenarioList.join(","));
      p.set("rounds", String(rounds));
      p.set("warmup", String(warmup));
      if (algos.includes("quick")) p.set("pivot", quickPivot);
      if (algos.includes("shell")) p.set("gaps", shellGaps);
      if (customPreSorted > 0) p.set("preSorted", String(customPreSorted));
      if (customDuplicates > 0) p.set("dups", String(customDuplicates));
      history.replaceState(null, "", `?${p.toString()}`);
    }

    let done = 0;
    const acc: CurveData = {};
    const timedOutAlgos = new Set<string>();
    const capturedAlgos = new Set<string>();

    // ── Silent 10-item pre-run: populate chart + mini-cards immediately ────────
    const PRERUN_N = 10;
    const prerunArr = generateBenchmarkInput(PRERUN_N, "random");
    const prerunStepsAcc: Record<string, SortStep[]> = {};
    for (const id of algos) {
      const savedCustomPre = id.startsWith("custom-") ? savedSorts.find(s => `custom-${s.id}` === id) : null;
      const fn = id === "custom"                       ? buildCustomFn(customSortCode, setCustomSortError) :
                 savedCustomPre                        ? buildCustomFn(savedCustomPre.code) :
                 id === "quick"                        ? makeQuickSort(quickPivot) :
                 id === "shell"                        ? makeShellSort(shellGaps) :
                 SORT_FNS[id];
      if (!fn) continue;
      const stepsArr: SortStep[] = [];
      if (id === "logos") {
        for (const s of getLogosSortSteps([...prerunArr])) {
          // Convert types.ts SortStep {array, states} → benchmark.ts SortStep {arr, comparing, swapping, sorted, pivot}
          const comparing: number[] = [], swapping: number[] = [], sorted: number[] = [];
          let pivot: number | undefined;
          s.states.forEach((st, i) => {
            if (st === "comparing" || st === "current") comparing.push(i);
            else if (st === "swapping") swapping.push(i);
            else if (st === "sorted") sorted.push(i);
            else if (st === "pivot") pivot = i;
          });
          stepsArr.push({ arr: s.array, comparing, swapping, sorted, pivot } as unknown as SortStep);
          if (stepsArr.length > 50_000) break;
        }
      } else if (id !== "custom") {
        for (const s of sortSteps(id, [...prerunArr])) { stepsArr.push(s); if (stepsArr.length > 50_000) break; }
      }
      prerunStepsAcc[id] = stepsArr;
      const pCopy = [...prerunArr];
      const pt0 = performance.now();
      // Wrap in try so a buggy custom function (or any algo that throws) skips
      // gracefully instead of taking down the whole benchmark.
      try { fn(pCopy); } catch { /* swallow — proper capture happens in main loop */ }
      const prerunMs = performance.now() - pt0;
      if (!acc[id]) acc[id] = [];
      acc[id].push({ n: PRERUN_N, timeMs: prerunMs, spaceBytes: theoreticalSpaceBytes(id, PRERUN_N) });
    }
    setPrerunSteps(prerunStepsAcc);
    setCurveData(Object.fromEntries(Object.entries(acc).map(([k, v]) => [k, [...v]])));
    await new Promise<void>(r => setTimeout(r, 0));
    // ─────────────────────────────────────────────────────────────────────────

    for (const sz of sizes) {
      if (stopRef.current) break;
      setCurrentN(sz);

      // Generate inputs once per size so every algorithm sorts the exact same data each round
      const intFlagsOn = dataType === "integer" && (intUniqueOnly || intFullInt32);
      const distOn = valueDist !== "uniform";
      const customDist: CustomDistribution | undefined =
        (customPreSorted > 0 || customDuplicates > 0 || intFlagsOn || distOn)
          ? {
              preSortedPct: customPreSorted,
              duplicatePct: customDuplicates,
              ...(intUniqueOnly && dataType === "integer" ? { uniqueOnly: true } : {}),
              ...(intFullInt32  && dataType === "integer" ? { fullInt32: true } : {}),
              ...(distOn ? { distribution: valueDist } : {}),
            }
          : undefined;
      // Build weighted pool: "sorted" appears once, all others three times — so it's rare in the mix.
      const weightedScenarios = scenarioList.flatMap(sc => sc === "sorted" ? [sc] : [sc, sc, sc]);
      const roundInputs = Array.from({ length: rounds }, () => {
        const sc = weightedScenarios[Math.floor(Math.random() * weightedScenarios.length)];
        return dataType === "string" ? generateStringInput(sz, sc)
             : dataType === "float"  ? generateFloatInput(sz, sc, customDist)
             : generateBenchmarkInput(sz, sc, customDist);
      });

      for (const id of algos) {
        if (stopRef.current) break;
        const incompatSet = !polyActive && dataType !== "integer" ? ALGO_INCOMPATIBLE[dataType] : null;
        if (timedOutAlgos.has(id) || excludedRef.current.has(id) || incompatSet?.has(id)) { done++; setProgress({ done, total }); continue; }
        setCurrentAlgo(id);
        await new Promise<void>(resolve => {
          algoSleepResolveRef.current = resolve;
          algoSleepTimerRef.current = setTimeout(() => { resolve(); algoSleepResolveRef.current = null; algoSleepTimerRef.current = null; }, 0);
        });
        if (excludedRef.current.has(id)) { done++; setProgress({ done, total }); continue; }

        // Resolve the sort function for this (algo, size) iteration.
        // The factory-built variants (quick/shell/logos/custom) are already fresh
        // closures per run. For everything else we rebuild SORT_FNS[id] via
        // freshSortFn so a prior data-type run can't leave it megamorphically
        // deoptimized — see the freshSortFn comment for the full rationale.
        // Resolve a saved-sort custom function by its id, if any.
        const savedCustom = id.startsWith("custom-") ? savedSorts.find(s => `custom-${s.id}` === id) : null;
        // Wasm dispatch: when the Wasm engine is selected AND the .wasm has
        // loaded AND this algo is supported on the Wasm side AND the data
        // type is integer (the only type the v1 Wasm sorts handle), route
        // through the Wasm fn. Otherwise fall through to the JS ternary.
        const wasmFn = wasmActive && dataType === "integer" && WASM_SUPPORTED.has(id)
          ? (wasmBundle!.byId[id] as (arr: unknown[]) => unknown[])
          : null;
        if (wasmFn) {
          // Tag this algorithm so the results UI can stamp its row with a
          // "Wasm" badge. setState on a Set requires a fresh instance.
          setWasmExecutedAlgos(prev => prev.has(id) ? prev : new Set(prev).add(id));
        }
        // WebGPU dispatch: same shape as Wasm. Only routes when the engine is
        // selected, the adapter+device probe succeeded, the algo has a kernel
        // (WEBGPU_SUPPORTED), and the data type is integer. v1 keeps the
        // supported set empty so this is unreachable today — wired so adding
        // a kernel is a 1-line change in lib/webgpuSorts.ts. Kernels are
        // permitted to be async (Promise<number[]>); the timing path below
        // already awaits the fn's return value so this is transparent to the
        // benchmark loop.
        const gpuBundle = (webgpuActive && webgpuBundle && webgpuBundle.ready) ? webgpuBundle : null;
        const gpuFn = gpuBundle && dataType === "integer" && WEBGPU_SUPPORTED.has(id)
          ? (gpuBundle.byId[id] as unknown as (arr: unknown[]) => unknown[] | Promise<unknown[]>)
          : null;
        if (gpuFn) {
          // Tag for the "GPU" badge — same pattern as Wasm.
          setWebgpuExecutedAlgos(prev => prev.has(id) ? prev : new Set(prev).add(id));
        }
        const baseFn: ((arr: unknown[]) => unknown[]) | null =
                   gpuFn  ? (gpuFn as (arr: unknown[]) => unknown[]) :
                   wasmFn ? wasmFn :
                   id === "custom" ? buildCustomFn(customSortCode, setCustomSortError) :
                   savedCustom                          ? buildCustomFn(savedCustom.code, () => { /* per-saved errors swallowed; reflected via failed proof */ }) :
                   id === "quick"                       ? makeQuickSort(quickPivot) as never :
                   id === "shell"                       ? makeShellSort(shellGaps) as never :
                   dataType === "string" && id === "timsort" ? ((arr: unknown[]) => [...arr].sort()) :
                   SORT_FNS[id] ? freshSortFn(SORT_FNS[id]) as never :
                   null;
        if (!baseFn) { done++; setProgress({ done, total }); continue; }
        // Polymorphic sweep: a single measured "sort" sorts one integer, one
        // float, and one string array of this size — summing all three. The
        // wrapper sorts the passed (integer) array, then float + string copies.
        const fn: (arr: unknown[]) => unknown[] = polyActive
          ? makePolymorphicFn(baseFn, sz, scenarioList[0])
          : baseFn;

        // Hoist adversarial round count so both worker and normal paths can use it
        const algoRoundInputs = adversarialEnabled
          ? [...roundInputs, makeAdversarialInput(id, sz, quickPivot)]
          : roundInputs;
        const algoRounds = adversarialEnabled ? rounds + 1 : rounds;

        // ── Worker isolation path ─────────────────────────────────────────────
        if (workerIso) {
          // Capture proof BEFORE submitting to the worker. The worker does the
          // timed sorts in its own isolate; this one-off main-thread sort uses
          // the rebuilt `fn` (already isolated by freshSortFn) on a small copy,
          // so it doesn't pollute timing and doesn't run inside the worker.
          if (!capturedAlgos.has(id) && roundInputs[0]) {
            const proof = await captureSampleProof(roundInputs[0] as (number | string)[], fn, {
              n: sz, dataType, scenario: scenarioList[0],
            });
            setSampleProofs(prev => prev[id] ? prev : { ...prev, [id]: proof });
            capturedAlgos.add(id);
          }
          const workerInputs = roundInputs.slice(0, algoRounds);
          const result = await new Promise<{ timeMs: number; meanMs: number; stdDev: number; roundTimes?: number[]; timedOut: boolean; stopped?: boolean; error?: string }>((resolve) => {
            const w = new Worker(new URL("../lib/benchmarkWorker", import.meta.url));
            currentWorkerRef.current = w;
            currentWorkerResolveRef.current = resolve;
            w.onmessage = (e: MessageEvent) => {
              w.terminate();
              if (currentWorkerRef.current === w) currentWorkerRef.current = null;
              currentWorkerResolveRef.current = null;
              resolve(e.data);
            };
            w.onerror = (e) => {
              w.terminate();
              if (currentWorkerRef.current === w) currentWorkerRef.current = null;
              currentWorkerResolveRef.current = null;
              // Surface worker-level failures (e.g., custom code with a syntax
              // error that slipped past the main-thread parse) as an explicit
              // error so the algo is annotated as broken rather than recorded
              // as a 0-ms result.
              resolve({
                timeMs: 0, meanMs: 0, stdDev: 0, timedOut: false,
                error: e instanceof ErrorEvent ? (e.message || "worker error") : "worker crashed",
              });
            };
            w.postMessage({
              runId: Date.now().toString(),
              algoId: id,
              n: sz,
              inputs: workerInputs,
              warmup,
              quickPivot: id === "quick" ? quickPivot : undefined,
              shellGaps: id === "shell" ? shellGaps : undefined,
              adversarialInput: adversarialEnabled ? makeAdversarialInput(id, sz, quickPivot) : undefined,
              // For both the editor's "custom" slot and any saved sort
              // (id === "custom-XYZ"), ship the function source string so the
              // worker can compile and run it in its own isolate.
              customFnStr: id === "custom" ? customSortCode : (savedCustom ? savedCustom.code : undefined),
              // 0 means "uncapped" — the worker treats >0 as the timeout in ms.
              timeoutMs: timeoutEnabled ? timeoutSec * 1000 : 0,
            });
          });
          // If stop terminated the worker, bail out without recording a result.
          if (result.stopped || stopRef.current) break;
          // If the worker reported a runtime error (custom fn threw), surface it
          // as a failed proof and exclude the algo from further runs.
          if (result.error) {
            setSampleProofs(prev => prev[id] ? prev : {
              ...prev,
              [id]: {
                before: [], after: [], n: sz, dataType,
                scenario: scenarioList[0],
                failed: true, badIdx: 0,
              },
            });
            if (id === "custom") setCustomSortError(`Threw at runtime: ${result.error}`);
            excludedRef.current.add(id);
            done++;
            setProgress({ done, total });
            await new Promise<void>(r => setTimeout(r, 0));
            continue;
          }
          // Even under worker isolation, run main-thread space passes so every
          // algorithm — especially custom sorts, which have no reliable
          // theoretical estimate — gets a real auxiliary-byte measurement (and
          // thus an accurate in-place verdict). We run BOTH the instrumented
          // measureAllocBytes pass AND a perf.memory heap-delta pass; the
          // verdict takes max(allocBytes, spaceBytes), so allocations that
          // escape the instrumentation (spread, object literals, engine
          // scratch) still show up via heap delta.
          let allocBytesW: number | undefined;
          let heapDeltaW = 0;
          if (!result.timedOut) {
            const spaceInput = dataType === "string" ? generateStringInput(sz, scenarioList[0])
                             : dataType === "float"  ? generateFloatInput(sz, scenarioList[0], customDist)
                             : generateBenchmarkInput(sz, scenarioList[0], customDist);
            const spaceCopy = [...spaceInput];
            try { allocBytesW = measureAllocBytes(() => (fn as (a: unknown[]) => unknown[])(spaceCopy)); }
            catch { allocBytesW = undefined; }

            const perfMem = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
            if (perfMem) {
              const spaceInput2 = dataType === "string" ? generateStringInput(sz, scenarioList[0])
                                : dataType === "float"  ? generateFloatInput(sz, scenarioList[0], customDist)
                                : generateBenchmarkInput(sz, scenarioList[0], customDist);
              const spaceCopy2 = [...spaceInput2];
              const m0 = perfMem.usedJSHeapSize;
              try { (fn as (a: unknown[]) => unknown[])(spaceCopy2); } catch { /* ignore */ }
              const m1 = perfMem.usedJSHeapSize;
              heapDeltaW = Math.max(0, m1 - m0);
            }
          }
          if (!acc[id]) acc[id] = [];
          acc[id].push({
            n: sz, timeMs: result.timeMs, meanMs: result.meanMs, stdDev: result.stdDev,
            roundTimes: result.roundTimes,
            spaceBytes: heapDeltaW > 0 ? heapDeltaW : theoreticalSpaceBytes(id, sz),
            // Real heap-delta signal only — undefined when GC / lack of
            // perf.memory left us with nothing measurable. The verdict uses
            // this (not spaceBytes) to decide on "O(n) aux ✗?".
            heapDeltaBytes: heapDeltaW > 0 ? heapDeltaW : undefined,
            allocBytes: allocBytesW,
            timedOut: result.timedOut || undefined,
          });
          if (result.timedOut) timedOutAlgos.add(id);
          done++;
          setProgress({ done, total });
          setCurveData(Object.fromEntries(Object.entries(acc).map(([k, v]) => [k, [...v]])));
          if (progressLocked) setHoverN(sz);
          await new Promise<void>(r => setTimeout(r, 0));
          continue;
        }
        // ── End worker isolation path ─────────────────────────────────────────

        let best = Infinity;
        let didTimeout = false;
        let lastElapsed = 0;
        const postWarmupTimes: number[] = [];
        // Adaptive warmup: `warmup` is the MAX number of warmup rounds. We may
        // exit warmup earlier if the last 3 warmup timings have stabilized
        // (coefficient of variation < 5%). Saved warmups become extra timed
        // rounds, which tightens the resulting mean/stddev.
        let effectiveWarmup = warmup;
        const warmupTimes: number[] = [];
        const STABILITY_THRESHOLD = 0.05; // 5% CV

        // Per-round working array. The `roundInputs` arrays are SHARED across
        // all algorithms at this size, so we must not let one algo's in-place
        // sort mutate them. When duplicating (default) we copy each round's
        // input into a single reused scratch array — allocated ONCE here rather
        // than a fresh `[...input]` every round, which is what drove the
        // per-round allocation churn. When duplication is off (diagnostic) we
        // sort the shared input directly: lowest memory, but later algorithms
        // at this size then see already-sorted data, so timings are only valid
        // for the first algorithm / a single round.
        const scratch: unknown[] = duplicatePerRound
          ? new Array((algoRoundInputs[0] as unknown[]).length)
          : [];

        for (let r = 0; r < algoRounds && !didTimeout; r++) {
          // Yield to the event loop between rounds so a click on Stop can register
          // and stopRef.current can flip before the next sort starts.
          if (r > 0) {
            await new Promise<void>(resolve => setTimeout(resolve, 0));
            if (stopRef.current) break;
          }
          const input = algoRoundInputs[r];

          // Capture per-algo proof on first encounter — works for any dataType
          // since captureSampleProof preserves value types.
          if (!capturedAlgos.has(id)) {
            const proof = await captureSampleProof(input as (number | string)[], fn, {
              n: sz, dataType, scenario: scenarioList[0],
            });
            setSampleProofs(prev => prev[id] ? prev : { ...prev, [id]: proof });
            capturedAlgos.add(id);
          }

          let copy: unknown[];
          if (duplicatePerRound) {
            const src = input as unknown[];
            for (let q = 0; q < src.length; q++) scratch[q] = src[q];
            copy = scratch;
          } else {
            copy = input as unknown[];
          }
          const t0 = performance.now();
          // Wrap the sort call so a throwing custom function doesn't kill the
          // whole benchmark. On error, mark the algo as failed via sampleProofs,
          // bail out of the round loop, and let the rest of the run continue.
          // GPU kernels return a Promise so the GPU readback can complete
          // before we record `lastElapsed` — without the await the timing
          // would measure only command-queue submission, not the actual sort.
          try {
            const ret = fn(copy) as unknown;
            if (ret && typeof (ret as { then?: unknown }).then === "function") {
              await (ret as Promise<unknown>);
            }
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            setSampleProofs(prev => prev[id] ? prev : {
              ...prev,
              [id]: {
                before: [], after: [], n: sz, dataType,
                scenario: scenarioList[0],
                failed: true, badIdx: 0,
              },
            });
            if (id === "custom") setCustomSortError(`Threw at runtime: ${msg}`);
            didTimeout = false;
            break;
          }
          lastElapsed = performance.now() - t0;

          // Per-sort timeout. When disabled (timeoutEnabled === false), runs uncapped.
          if (timeoutEnabled && lastElapsed >= timeoutSec * 1000) { didTimeout = true; best = lastElapsed; break; }
          if (r < effectiveWarmup) {
            warmupTimes.push(lastElapsed);
            // After the third warmup, check whether the last 3 timings are stable
            // (CV < 5%). If yes, exit warmup early so subsequent rounds get
            // recorded as timed measurements.
            if (warmupTimes.length >= 3) {
              const last3 = warmupTimes.slice(-3);
              const wMean = (last3[0] + last3[1] + last3[2]) / 3;
              const wVar  = last3.reduce((s, v) => s + (v - wMean) ** 2, 0) / 3;
              const wStd  = Math.sqrt(wVar);
              if (wMean > 0 && wStd / wMean < STABILITY_THRESHOLD) {
                effectiveWarmup = r + 1; // end warmup after this round
              }
            }
          } else {
            best = Math.min(best, lastElapsed);
            postWarmupTimes.push(lastElapsed);
          }
        }

        // If the user pressed Stop mid-rounds, abandon this size/algo and bail upward.
        if (stopRef.current) break;

        // Edge case: all rounds were warmup — use the last timing
        if (best === Infinity && !didTimeout) { best = lastElapsed; postWarmupTimes.push(lastElapsed); }

        // Compute mean and std dev for error bands
        let meanMs: number | undefined;
        let stdDev: number | undefined;
        if (postWarmupTimes.length > 0) {
          meanMs = postWarmupTimes.reduce((s, v) => s + v, 0) / postWarmupTimes.length;
          if (postWarmupTimes.length > 1) {
            const variance = postWarmupTimes.reduce((s, v) => s + (v - meanMs!) ** 2, 0) / postWarmupTimes.length;
            stdDev = Math.sqrt(variance);
          }
        }

        // Space measurement — fresh input, separate pass so it doesn't skew timing.
        // 1. measureAllocBytes: monkey-patches Array methods to count bytes allocated.
        //    Reliable for all algorithms regardless of speed.
        // 2. performance.memory: V8-only heap delta — kept as secondary cross-check
        //    but unreliable for fast algorithms (GC snapshot updates lazily).
        let spaceBytes: number;
        let allocBytes: number | undefined;
        let heapDeltaForPoint: number | undefined;
        if (!didTimeout) {
          const spaceInput = dataType === "string" ? generateStringInput(sz, scenarioList[0])
                           : dataType === "float"  ? generateFloatInput(sz, scenarioList[0], customDist)
                           : generateBenchmarkInput(sz, scenarioList[0], customDist);
          // The whole point of this measurement is to prove how much memory the
          // ALGORITHM allocates. The harness needs fresh unsorted data to sort,
          // but that copy is the harness's cost, not the algorithm's — so we
          // build it OUTSIDE the measured region. Measuring only fn(spaceCopy)
          // makes allocBytes a clean in-place proof: ~0 for a genuinely in-place
          // sort, ~8·n for one that allocates an O(n) buffer (merge, radix…).
          const spaceCopy = [...spaceInput];
          // Both space-measurement passes wrap the sort call so a buggy custom
          // function falls back to theoretical bytes instead of crashing the run.
          try {
            allocBytes = measureAllocBytes(() => (fn as (a: unknown[]) => unknown[])(spaceCopy));
          } catch { allocBytes = undefined; }

          const perfMem = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
          let heapDelta = 0;
          if (perfMem) {
            const spaceInput2 = dataType === "string" ? generateStringInput(sz, scenarioList[0])
                              : dataType === "float"  ? generateFloatInput(sz, scenarioList[0], customDist)
                              : generateBenchmarkInput(sz, scenarioList[0], customDist);
            const m0 = perfMem.usedJSHeapSize;
            try { fn(spaceInput2); } catch { /* fall through to theoretical */ }
            const m1 = perfMem.usedJSHeapSize;
            heapDelta = Math.max(0, m1 - m0);
          }
          spaceBytes = heapDelta > 0 ? heapDelta : theoreticalSpaceBytes(id, sz);
          heapDeltaForPoint = heapDelta > 0 ? heapDelta : undefined;
        } else {
          spaceBytes = theoreticalSpaceBytes(id, sz);
        }

        if (!acc[id]) acc[id] = [];
        acc[id].push({ n: sz, timeMs: best, meanMs, stdDev, roundTimes: postWarmupTimes.length > 1 ? [...postWarmupTimes] : undefined, spaceBytes, heapDeltaBytes: heapDeltaForPoint, allocBytes, timedOut: didTimeout || undefined });
        if (didTimeout) timedOutAlgos.add(id);

        done++;
        setCurveData(Object.fromEntries(Object.entries(acc).map(([k, v]) => [k, [...v]])));
        setProgress({ done, total });
        await new Promise<void>(r => setTimeout(r, 0));
      }
    }

    setCurrentN(null);
    setCurrentAlgo(null);

    // Append this run's per-algo points to the ghost-mode history. Each algo
    // gets a new GhostRun entry; the ring buffer is capped at GHOST_MAX. We
    // skip algos that failed the sortedness verifier (unreliable timings) and
    // algos that had no successful points.
    setGhostRuns(prev => {
      const next: Record<string, GhostRun[]> = { ...prev };
      const now = Date.now();
      for (const id of Object.keys(acc)) {
        const points = (acc[id] ?? [])
          .filter(p => !p.timedOut && p.timeMs > 0)
          .map(p => ({ n: p.n, timeMs: p.timeMs, meanMs: p.meanMs, spaceBytes: p.spaceBytes }));
        if (points.length === 0) continue;
        const existing = next[id] ?? [];
        const updated = [...existing, { ts: now, points }];
        // Cap to last GHOST_MAX runs (FIFO drop oldest).
        next[id] = updated.length > GHOST_MAX ? updated.slice(-GHOST_MAX) : updated;
      }
      return next;
    });

    // Bump session totals — count of completed runs + first-run timestamp.
    setRunCount(c => {
      const next = c + 1;
      try { localStorage.setItem("codecookbook.runCount", String(next)); } catch { /* quota */ }
      return next;
    });
    if (sessionStartedAt == null) {
      const t = Date.now();
      setSessionStartedAt(t);
      try { localStorage.setItem("codecookbook.sessionStartedAt", String(t)); } catch { /* quota */ }
    }

    // Update the persistent session-curves log: same rolling-mean idea as the
    // winners log, but stores BOTH meanTimeMs and meanSpaceBytes so the
    // SessionCurves component can draw cross-session speed + memory curves.
    setSessionLog(prev => {
      const next: SessionLog = { ...prev };
      const dtKey = dataType;
      const dtMap = { ...(next[dtKey] ?? {}) };
      for (const id of Object.keys(acc)) {
        const algoMap = { ...(dtMap[id] ?? {}) };
        for (const p of (acc[id] ?? [])) {
          if (p.timedOut || p.timeMs <= 0) continue;
          const tSample = p.meanMs ?? p.timeMs;
          // Prefer the instrumented aux byte count when present (even 0 is
          // valid); fall back to the heap-delta spaceBytes otherwise.
          const sSample = p.allocBytes != null ? p.allocBytes : (p.spaceBytes ?? 0);
          const key = String(p.n);
          const existing = algoMap[key] ?? { meanTimeMs: 0, meanSpaceBytes: 0, runs: 0 };
          const runs = existing.runs + 1;
          const meanTimeMs    = (existing.meanTimeMs    * existing.runs + tSample) / runs;
          const meanSpaceBytes = (existing.meanSpaceBytes * existing.runs + sSample) / runs;
          algoMap[key] = { meanTimeMs, meanSpaceBytes, runs };
        }
        dtMap[id] = algoMap;
      }
      next[dtKey] = dtMap;
      try { localStorage.setItem("codecookbook.sessionLog", JSON.stringify(next)); } catch { /* quota */ }
      return next;
    });

    // Update the persistent winners log: every successful (algo, size) point
    // from this run contributes one sample to a rolling average keyed by
    // (dataType, algoId, size). Skip timed-out / failed sorts so they don't
    // poison the means.
    setWinnerLog(prev => {
      const next: WinnerLog = { ...prev };
      const dtKey = dataType;
      const dtMap = { ...(next[dtKey] ?? {}) };
      for (const id of Object.keys(acc)) {
        const algoMap = { ...(dtMap[id] ?? {}) };
        for (const p of (acc[id] ?? [])) {
          if (p.timedOut || p.timeMs <= 0) continue;
          const sampleMs = p.meanMs ?? p.timeMs;
          const key = String(p.n);
          const existing = algoMap[key] ?? { meanMs: 0, runs: 0 };
          const runs = existing.runs + 1;
          const meanMs = (existing.meanMs * existing.runs + sampleMs) / runs;
          algoMap[key] = { meanMs, runs };
        }
        dtMap[id] = algoMap;
      }
      next[dtKey] = dtMap;
      try { localStorage.setItem("codecookbook.winnerLog", JSON.stringify(next)); } catch { /* quota */ }
      return next;
    });

    setStatus("done");

  }, [
    selected, selectedSizes, scenarios, rounds, warmup,
    customPreSorted, customDuplicates, quickPivot, shellGaps,
    adversarialEnabled, useWorkerIsolation,
    customSortEnabled, customSortCode,
    // The run closure also reads these — without them, switching dataType or
    // toggling the timeout would silently use the stale value captured the
    // last time `run` was memoised. (Symptom we just diagnosed: dataType="float"
    // selected in UI but proof shows integers because the run still used the
    // previous "integer" dataType from the cached closure.)
    dataType,
    timeoutEnabled, timeoutSec,
    savedSorts,
    // Integer-only generator flags — without these in the dep list, toggling
    // them won't take effect until something else triggers a re-memo.
    intUniqueOnly, intFullInt32,
    polymorphicMode, duplicatePerRound,
    valueDist,
    engine, wasmBundle,
  ]); // eslint-disable-line react-hooks/exhaustive-deps

  const stop = () => {
    stopRef.current = true;
    setStopPending(true);
    // Wake any pending pre-algo sleep so the loop can hit its stopRef check
    if (algoSleepTimerRef.current !== null) {
      clearTimeout(algoSleepTimerRef.current);
      algoSleepTimerRef.current = null;
      algoSleepResolveRef.current?.();
      algoSleepResolveRef.current = null;
    }
    // Terminate any worker mid-sort and resolve its awaiting promise so the
    // benchmark loop can exit immediately instead of waiting for the sort to finish.
    if (currentWorkerRef.current) {
      currentWorkerRef.current.terminate();
      currentWorkerRef.current = null;
      currentWorkerResolveRef.current?.({ timeMs: 0, meanMs: 0, stdDev: 0, timedOut: false, stopped: true });
      currentWorkerResolveRef.current = null;
    }
  };

  // Clear the "stop pending" state when the run actually finishes (status leaves "running").
  useEffect(() => {
    if (status !== "running") setStopPending(false);
  }, [status]);

  // Keyboard shortcut: R = run/stop, Escape = close maximize
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setResultsMaximized(false); return; }
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key !== "r" && e.key !== "R") return;
      if (status === "running") stop();
      else if (canRun) run();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, canRun]);

  const stopAlgo = (id: string) => {
    excludedRef.current.add(id);
    // If the run loop is currently sleeping before this algo, wake it immediately
    if (algoSleepTimerRef.current !== null) {
      clearTimeout(algoSleepTimerRef.current);
      algoSleepTimerRef.current = null;
      algoSleepResolveRef.current?.();
      algoSleepResolveRef.current = null;
    }
    setSelected(prev => { const next = new Set(prev); next.delete(id); return next; });
  };

  const reset = () => {
    stopRef.current = true;
    setStatus("idle");
    setCurveData({});
    setSampleProofs({});
    setPrerunSteps({});
    setActiveProofAlgo(null);
    setHoverN(null);
    setCurrentN(null);
    setCurrentAlgo(null);
    setRunConfig(null);
  };

  const chartAlgosBase = runConfig?.algos ?? activeAlgos;
  const chartAlgos = chartAlgosBase;
  const chartSizes = runConfig?.sizes ?? sortedSizes;

  // timsort-js is now a real measured algorithm — pass curveData through directly
  const curveDataExt: CurveData = curveData;

  // Summary table: rankings at the largest completed n
  const completedNs = new Set(
    Object.values(curveData).flatMap(pts => pts.map(p => p.n))
  );
  const largestDone = completedNs.size > 0 ? Math.max(...completedNs) : null;
  const summaryResults: SummaryResult[] = largestDone !== null
    ? chartAlgos
        .filter(id => curveDataExt[id]?.some(p => p.n === largestDone && !p.timedOut))
        .map(id => {
          const pt = curveDataExt[id]!.find(p => p.n === largestDone)!;
          return { id, timeMs: pt.meanMs ?? pt.timeMs, meanMs: pt.meanMs, stdDev: pt.stdDev };
        })
        .sort((a, b) => a.timeMs - b.timeMs)
        .map((r, i) => ({ ...r, rank: i + 1 }))
    : [];

  const summarySpaceResults: SummaryResult[] = largestDone !== null
    ? chartAlgos
        .filter(id => curveDataExt[id]?.some(p => p.n === largestDone && !p.timedOut))
        .map(id => {
          const pt = curveDataExt[id]!.find(p => p.n === largestDone)!;
          return { id, timeMs: pt.spaceBytes ?? theoreticalSpaceBytes(id, largestDone) };
        })
        .sort((a, b) => a.timeMs - b.timeMs)
        .map((r, i) => ({ ...r, rank: i + 1 }))
    : [];

  const summaryFastest = summaryResults[0]?.timeMs ?? 1;
  const summarySlowest = summaryResults.at(-1)?.timeMs ?? 1;

  // Calibrate Big-O reference lines: anchor O(n log n) to fastest real time at smallest valid n
  const calibN = chartSizes.find(n => n >= 2);
  let calibC = 0;
  if (calibN !== undefined) {
    let fastest = Infinity;
    for (const id of chartAlgos) {
      const pt = curveData[id]?.find(p => p.n === calibN && !p.timedOut);
      if (pt && (pt.meanMs ?? pt.timeMs) < fastest) fastest = pt.meanMs ?? pt.timeMs;
    }
    if (fastest < Infinity) calibC = fastest / (calibN * Math.log2(calibN));
  }

  type RefRow = { kind: "ref"; label: string; color: string; timeMs: number };
  type AlgoRow = SummaryResult & { kind: "algo" };
  type TableRow = AlgoRow | RefRow;

  const refRows: RefRow[] = calibC > 0 && largestDone !== null
    ? BIG_O_REFS.map(ref => ({
        kind: "ref" as const,
        label: ref.label,
        color: ref.color,
        timeMs: calibC * ref.fn(largestDone),
      }))
    : [];

  const tableRows: TableRow[] = [
    ...summaryResults.map(r => ({ ...r, kind: "algo" as const })),
    ...refRows,
  ].sort((a, b) => a.timeMs - b.timeMs);
  const hasCurveData = Object.values(curveData).some(pts => pts.length > 0);

  return (
    <div className="flex flex-col" style={{ position: "relative" }}>
    <style>{`
      @media print {
        .print\\:hidden { display: none !important; }
        body { background: white !important; color: black !important; }
        [style*="--color-surface"] { background: white !important; }
        [style*="--color-text"] { color: black !important; }
        [style*="--color-muted"] { color: #555 !important; }
        [style*="--color-border"] { border-color: #ccc !important; }
        svg text { fill: #000 !important; }
        svg line, svg polyline, svg path { stroke: currentColor; }
      }
    `}</style>

      {/* Warning modal — n > 100,000,000 */}
      {pendingCustomN !== null && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 50,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "rgba(0,0,0,0.55)", backdropFilter: "blur(2px)",
        }}>
          <div style={{
            background: "var(--color-surface-2)", border: "1px solid var(--color-state-swap)",
            borderRadius: 12, padding: "24px 28px", maxWidth: 360, width: "90%",
            boxShadow: "0 8px 40px rgba(0,0,0,0.4)",
          }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: "var(--color-state-swap)", marginBottom: 8 }}>
              ⚠ Large input warning
            </p>
            <p style={{ fontSize: 11, color: "var(--color-text)", marginBottom: 6, lineHeight: 1.5 }}>
              n = <span style={{ fontFamily: "monospace", fontWeight: 700 }}>{pendingCustomN.toLocaleString()}</span> is above 100,000,000.
            </p>
            <p style={{ fontSize: 11, color: "var(--color-muted)", marginBottom: 20, lineHeight: 1.5 }}>
              Allocating and sorting an array this large may take a very long time or freeze the browser tab. Only Logos Sort and Tim Sort are allowed at this size.
            </p>
            <div className="flex gap-2 justify-end">
              <button onClick={cancelCustomN} style={btn("secondary", { padding: "4px 14px" })}>
                Cancel
              </button>
              <button onClick={confirmCustomN} style={btn("danger", { padding: "4px 14px" })}>
                Add anyway
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ── Algorithm Benchmark ── */}
      <div className="flex flex-col">

      <div
        className="flex flex-col gap-0.5 px-5 pt-5 pb-3"
        style={{ borderBottom: "1px solid var(--color-border)" }}
      >
        <div className="flex items-center gap-2">
          <LineChart size={18} style={{ color: "var(--color-accent)" }} strokeWidth={1.75} />
          <h1 className="text-xl font-bold">Algorithm Benchmark</h1>
        </div>
        <p className="text-xs" style={{ color: "var(--color-muted)" }}>
          Plot algorithms on a performance curve across multiple input sizes. Each algorithm becomes a line; input size is the x-axis.
        </p>
      </div>


      <div className="flex flex-col lg:flex-row">

        {/* ── Left pane: controls + config + session-wide views ──
            Order is intentional: the things you DO (Run, Churn, engine status)
            sit at the top so they're always visible without scrolling. Below
            that comes the config card (algos, sizes, scenarios, advanced).
            Below that comes the readout (Settings summary), and finally the
            cross-run session views (summary, winners, big-O, matrix, curves,
            sort network, 3D history). Top-to-bottom matches a typical
            workflow: act → configure → review. */}
        <div
          className="lg:w-1/2 lg:h-full lg:overflow-y-auto border-b lg:border-b-0 lg:border-r"
          style={{ borderColor: "var(--color-border)" }}
        >
          <div className="px-5 py-4 flex flex-col gap-3">
            {/* ── Controls panel (top-anchored) ── */}
            <div
              className="rounded-xl p-3 flex flex-col gap-2"
              style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)" }}
            >
              {/* Engine indicator — visible whenever Wasm is the chosen
                  engine, so the next-run engine state is legible without
                  expanding Advanced. Also surfaces "requested but not loaded"
                  so the user can see why their badges never appeared. */}
              {engine === "wasm" && (
                <div className="print:hidden text-[10px]" style={{ fontFamily: "monospace" }}>
                  {wasmBundle ? (
                    <span style={{
                      display: "inline-flex", alignItems: "center", gap: 4,
                      padding: "1px 7px", borderRadius: 4,
                      background: "rgba(124,106,247,0.15)",
                      border: "1px solid rgba(124,106,247,0.5)",
                      color: "var(--color-accent)", fontWeight: 700,
                    }}>
                      Engine: Wasm ready — fires for insertion / quick / logos on integer data
                    </span>
                  ) : (
                    <span style={{
                      display: "inline-flex", alignItems: "center", gap: 4,
                      padding: "1px 7px", borderRadius: 4,
                      background: "rgba(255,183,77,0.10)",
                      border: "1px solid rgba(255,183,77,0.45)",
                      color: "#ffb74d",
                    }}>
                      Engine: Wasm selected but .wasm not loaded — every algo will silently fall back to V8. Run <code>npm run build:wasm</code>, then refresh.
                    </span>
                  )}
                </div>
              )}

              {/* Same banner shape for the WebGPU engine. Three states:
                  - bundle.ready=true AND WEBGPU_SUPPORTED non-empty → cyan "GPU ready" banner
                  - bundle.ready=true AND WEBGPU_SUPPORTED empty   → amber "selected but no kernels ported" banner
                  - bundle.ready=false                              → amber "selected but unavailable" banner */}
              {engine === "webgpu" && webgpuBundle != null && (
                <div className="print:hidden text-[10px]" style={{ fontFamily: "monospace" }}>
                  {webgpuBundle.ready && WEBGPU_SUPPORTED.size > 0 ? (
                    <span style={{
                      display: "inline-flex", alignItems: "center", gap: 4,
                      padding: "1px 7px", borderRadius: 4,
                      background: "rgba(34,197,194,0.14)",
                      border: "1px solid rgba(34,197,194,0.55)",
                      color: "#0e9b96", fontWeight: 700,
                    }}>
                      Engine: WebGPU ready — fires for {[...WEBGPU_SUPPORTED].join(" / ")} on integer data
                    </span>
                  ) : webgpuBundle.ready ? (
                    <span style={{
                      display: "inline-flex", alignItems: "center", gap: 4,
                      padding: "1px 7px", borderRadius: 4,
                      background: "rgba(255,183,77,0.10)",
                      border: "1px solid rgba(255,183,77,0.45)",
                      color: "#ffb74d",
                    }}>
                      Engine: WebGPU adapter detected but no GPU kernels ported yet — every algo will fall back to V8 until <code>WEBGPU_SUPPORTED</code> in <code>lib/webgpuSorts.ts</code> gains an entry.
                    </span>
                  ) : (
                    <span style={{
                      display: "inline-flex", alignItems: "center", gap: 4,
                      padding: "1px 7px", borderRadius: 4,
                      background: "rgba(255,183,77,0.10)",
                      border: "1px solid rgba(255,183,77,0.45)",
                      color: "#ffb74d",
                    }}>
                      Engine: WebGPU selected but unavailable — {webgpuBundle.reason}. Every algo will fall back to V8.
                    </span>
                  )}
                </div>
              )}

              {/* Run / Stop buttons moved to a floating bottom-right panel
                  that swaps with RunningDashboard depending on status —
                  see the FloatingRunPanel render near the bottom of this file. */}

              {/* ── Churn Mode toggle + live telemetry ──
                  Lives directly below the Run button because it's the
                  "background mode" sibling of "fire one measured run". */}
              {(() => {
                const churnEligible = ([...selected].filter(id => !slowDisabled(id)).length + savedSorts.filter(s => s.enabled).length) > 0;
                const startedAt = churnTotals.startedAt;
                const runtimeMs = churnMode && startedAt != null ? Date.now() - startedAt : 0;
                const probesPerSec = runtimeMs > 250 ? (churnTotals.probes / (runtimeMs / 1000)) : 0;
                return (
                  <div className="print:hidden flex flex-col gap-2">
                    <ChurnIndicator
                      active={churnMode}
                      complete={churnComplete}
                      onToggle={() => {
                        // Toggle-ON starts a fresh session: totals zeroed and
                        // history cleared so the sparklines draw from scratch.
                        // Toggle-OFF leaves the displays frozen so the user can
                        // review the last session's data. Per-algo adaptive
                        // state (the AIMD memory) persists across toggles so
                        // the learned ceilings aren't thrown away.
                        if (churnMode) {
                          setChurnMode(false);
                        } else {
                          setChurnTotals({ probes: 0, timeouts: 0, startedAt: null, lastProbeAt: null });
                          churnHistoryRef.current = {};
                          setChurnHistory({});
                          // Reset the sweep-completion flags so a fresh
                          // session starts in the "sweeping" state, not in
                          // "done" left over from the previous session.
                          churnCompleteRef.current = false;
                          setChurnComplete(false);
                          setChurnMode(true);
                        }
                      }}
                      disabled={!churnEligible || status === "running"}
                      probeCount={churnTotals.probes}
                      probesPerSec={probesPerSec}
                    />
                    {churnMode && (
                      <div className="cc-churn-box" style={{ padding: "8px 10px", borderRadius: 6 }}>
                        <ChurnTelemetry
                          state={churnState}
                          history={churnHistory}
                          totals={churnTotals}
                          algoNames={ALGO_NAMES}
                          algoColors={ALGO_COLORS}
                          runtimeMs={runtimeMs}
                          budgetMs={CHURN_BUDGET_MS}
                          nMin={CHURN_N_MIN}
                          nMax={CHURN_N_MAX}
                          samplesPerLevel={CHURN_SAMPLES_PER_LEVEL}
                          complete={churnComplete}
                        />
                        <p style={{ fontSize: 8, color: "var(--color-muted)", marginTop: 6, fontFamily: "monospace", lineHeight: 1.4 }}>
                          structured sweep: {CHURN_SAMPLES_PER_LEVEL} samples per level, then double n · saturates on any probe &gt; {CHURN_BUDGET_MS / 1000}s · stops when every algo has saturated · routes through the active engine ({engine === "wasm" ? "Wasm" : engine === "webgpu" ? "WebGPU" : "V8"}) · flushes to curveData / sessionLog / winnerLog / ghostRuns every ~{CHURN_FLUSH_INTERVAL_MS / 1000}s so every panel updates in near-real-time
                        </p>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Settings summary — what *will* run. A compact readout of the
                  active config so the user can verify before clicking Run
                  without expanding the config card below. */}
              {status !== "running" && (
                <div className="text-[10px] print:hidden flex flex-col gap-0.5" style={{ color: "var(--color-muted)", fontFamily: "monospace", borderTop: "1px dashed var(--color-border)", paddingTop: 6 }}>
                  <span>
                    {[...activeAlgos, ...enabledSavedSorts.map(s => `custom-${s.id}`)]
                      .map(id => ALGO_NAMES[id] ?? id)
                      .join(", ") || <span style={{ color: "#ef5350" }}>no algorithms selected</span>}
                  </span>
                  <span>
                    {[...scenarios].join(", ")} · n={sortedSizes.map(n => fmtN(n)).join(", ")} · {rounds} round{rounds !== 1 ? "s" : ""} · {warmup} warm-up · engine: {engine === "wasm" && wasmBundle ? "Wasm" : engine === "webgpu" && webgpuBundle?.ready ? "WebGPU" : "V8"}
                  </span>
                </div>
              )}

            </div>

            {/* ── Config card (algos, sizes, scenarios, advanced) ── */}
            <div
              className="rounded-xl p-4"
              style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)" }}
            >
              {/* Input sizes */}
              <div className="mb-4">
                <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-muted)" }}>
                  Input sizes (n)
                  {sortedSizes.length > 0 && (
                    <span className="ml-1.5 font-normal normal-case" style={{ color: "var(--color-text)" }}>
                      · {sortedSizes.length} selected
                    </span>
                  )}
                </span>

                {/* Presets */}
                <div className="print:hidden flex gap-1.5 mt-2 mb-1.5 flex-wrap items-center">
                  {([
                    { label: "Small",  sizes: [100, 1_000, 10_000] },
                    { label: "Medium", sizes: [1_000, 10_000, 100_000] },
                    { label: "Large",  sizes: [100_000, 1_000_000, 10_000_000] },
                  ] as const).map(({ label, sizes }) => (
                    <button
                      key={label}
                      onClick={() => { setSelectedSizes(new Set(sizes)); }}
                      style={btn("secondary", { fontSize: 9, padding: "2px 8px" })}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <div className="print:hidden flex flex-wrap gap-1.5 mt-2">
                  {SIZE_BUTTONS.map(({ n }) => {
                    const on = selectedSizes.has(n);
                    const disabled = !UNLIMITED_IDS.has([...selected][0] ?? "") && n > LARGE_THRESHOLD && selected.size > 0 && [...selected].every(id => !UNLIMITED_IDS.has(id));
                    // Per-n average measured time across every (algo, dtype)
                    // bucket the session has seen at this size. Empty → no
                    // sub-line, button stays compact.
                    const avgMs = nAvgTimes[String(n)];
                    return (
                      <button
                        key={n}
                        onClick={() => on ? removeSize(n) : addSize(n)}
                        disabled={disabled}
                        title={avgMs != null
                          ? `n=${n.toLocaleString()} — average ${fmtTime(avgMs)} per (algo, dtype) bucket across the session`
                          : `n=${n.toLocaleString()} — no measurements yet`}
                        style={btn(on ? "primary" : "secondary", {
                          flexDirection: "column", padding: "3px 7px",
                          background: on ? "rgba(139,58,42,0.12)" : "var(--color-surface-1)",
                          border: `1px solid ${on ? "var(--color-accent)" : "var(--color-border)"}`,
                          color: on ? "var(--color-accent)" : "var(--color-muted)",
                          cursor: disabled ? "not-allowed" : "pointer",
                          opacity: disabled ? 0.35 : 1, minWidth: 52,
                        })}
                      >
                        <span style={{ fontSize: 9, fontFamily: "monospace", fontWeight: on ? 700 : 500, lineHeight: 1.2 }}>
                          {n.toLocaleString()}
                        </span>
                        {avgMs != null && (
                          <span style={{ fontSize: 7, fontFamily: "monospace", lineHeight: 1.1, opacity: 0.7, marginTop: 1 }}>
                            ~{fmtTime(avgMs)}
                          </span>
                        )}
                      </button>
                    );
                  })}

                  {/* Spread preset: large-n-only set for accurate Big-O fitting */}
                  {(() => {
                    const SPREAD = [1_000, 10_000, 100_000, 10_000_000];
                    const active = SPREAD.every(n => selectedSizes.has(n)) && selectedSizes.size === SPREAD.length;
                    return (
                      <button
                        onClick={() => setSelectedSizes(new Set(SPREAD))}
                        style={btn(active ? "primary" : "secondary", {
                          flexDirection: "column", padding: "3px 10px",
                          background: active ? "rgba(139,58,42,0.12)" : "var(--color-surface-1)",
                          border: `1px solid ${active ? "var(--color-accent)" : "var(--color-border)"}`,
                          color: active ? "var(--color-accent)" : "var(--color-muted)",
                          minWidth: 52,
                        })}
                        title="Spread: 1k · 10k · 100k · 10M — wide log range for accurate Big-O fitting"
                      >
                        <span style={{ fontSize: 9, fontFamily: "monospace", fontWeight: active ? 700 : 500, lineHeight: 1.2 }}>Spread</span>
                      </button>
                    );
                  })()}

                  {/* Remove all */}
                  <button
                    onClick={() => setSelectedSizes(new Set())}
                    disabled={selectedSizes.size === 0}
                    style={btn("secondary", {
                      flexDirection: "column", padding: "3px 10px",
                      cursor: selectedSizes.size === 0 ? "not-allowed" : "pointer",
                      opacity: selectedSizes.size === 0 ? 0.35 : 1, minWidth: 52,
                    })}
                  >
                    <span style={{ fontSize: 9, fontFamily: "monospace", fontWeight: 500, lineHeight: 1.2 }}>Clear</span>
                  </button>
                </div>

                {/* Custom n input */}
                <form
                  className="print:hidden flex items-center gap-1.5 mt-2"
                  onSubmit={e => { e.preventDefault(); submitCustomN(customInput); }}
                >
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="Custom"
                    value={customInput}
                    onChange={e => setCustomInput(e.target.value)}
                    style={{
                      flex: 1, minWidth: 0, padding: "4px 8px", fontSize: 11, fontFamily: "monospace",
                      borderRadius: 6, border: "1px solid var(--color-border)",
                      background: "var(--color-surface-1)", color: "var(--color-text)",
                      outline: "none",
                    }}
                  />
                  <button type="submit" style={btn("secondary")}>Add</button>
                </form>

                {/* Custom sizes (not in SIZE_BUTTONS) shown as removable chips */}
                {[...selectedSizes].filter(n => !SIZE_BUTTONS.some(b => b.n === n)).sort((a,b)=>a-b).map(n => (
                  <span key={n} className="inline-flex items-center gap-1 mt-1.5 mr-1.5 px-2 py-0.5 rounded text-xs font-mono"
                    style={{ background: "rgba(139,58,42,0.12)", border: "1px solid var(--color-accent)", color: "var(--color-accent)" }}>
                    {n.toLocaleString()}
                    <button onClick={() => removeSize(n)} style={{
                      background: "none", border: "none", cursor: "pointer",
                      color: "var(--color-accent)", fontSize: 11, lineHeight: 1, padding: 0, marginLeft: 2,
                    }}>×</button>
                  </span>
                ))}
              </div>

              {/* Scenario presets */}
              <div className="mb-4 print:hidden">
                <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--color-muted)" }}>Quick presets</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                  {SCENARIO_PRESETS
                    .filter(preset => has("advanced") || !(preset as { poly?: boolean }).poly)
                    .map(preset => {
                    const isPoly = Boolean((preset as { poly?: boolean }).poly);
                    return (
                    <button
                      key={preset.label}
                      title={preset.desc}
                      onClick={() => {
                        setSelected(new Set(preset.algos as unknown as string[]));
                        setSelectedSizes(new Set(preset.sizes as unknown as number[]));
                        setScenarios(new Set(preset.scenarios));
                        if (preset.pivot) setQuickPivot(preset.pivot);
                        setPolymorphicMode(isPoly);
                      }}
                      style={{
                        padding: "2px 9px", fontSize: 9, borderRadius: 4, cursor: "pointer",
                        background: isPoly && polymorphicMode ? "color-mix(in srgb, var(--color-accent) 18%, transparent)" : "var(--color-surface-1)",
                        border: `1px solid ${isPoly && polymorphicMode ? "var(--color-accent)" : "var(--color-border)"}`,
                        color: isPoly && polymorphicMode ? "var(--color-accent)" : "var(--color-muted)", whiteSpace: "nowrap",
                      }}
                    >
                      {isPoly ? `⇄ ${preset.label}` : preset.label}
                    </button>
                    );
                  })}
                </div>
                {polymorphicMode && (
                  <p className="text-[10px] mt-1.5" style={{ color: "var(--color-accent)", fontFamily: "monospace" }}>
                    Polymorphic sweep active — each measured sort sorts integer + float + string (summed); runs on the main thread, type-safe sorts only.
                  </p>
                )}
              </div>

              {/* Algorithm checkboxes */}
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2.5">
                  <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-muted)" }}>
                    Algorithms
                  </p>
                  <button
                    onClick={() => {
                      const allIds = ALGO_GROUPS.flatMap(g => g.items.map(i => i.id)).filter(id => !slowDisabled(id));
                      const allOn = allIds.every(id => selected.has(id));
                      setSelected(allOn ? new Set() : new Set(allIds));
                    }}
                    style={btn("ghost", { fontSize: 9, padding: "1px 6px", textDecoration: "underline", textDecorationStyle: "dotted",
                      color: ALGO_GROUPS.flatMap(g => g.items.map(i => i.id)).filter(id => !slowDisabled(id)).every(id => selected.has(id)) ? "var(--color-accent)" : "var(--color-muted)" })}
                  >
                    {ALGO_GROUPS.flatMap(g => g.items.map(i => i.id)).filter(id => !slowDisabled(id)).every(id => selected.has(id)) ? "Deselect all" : "Select all"}
                  </button>
                </div>
                <div className="flex flex-col gap-3">
                  {ALGO_GROUPS.map(group => {
                    const groupIds = group.items.map(i => i.id);
                    const activeIds = groupIds.filter(id => !slowDisabled(id));
                    const allOn = activeIds.length > 0 && activeIds.every(id => selected.has(id));
                    const someOn = activeIds.some(id => selected.has(id));

                    return (
                      <div key={group.label}>
                        <div className="flex items-center gap-2 mb-1.5">
                          <button
                            onClick={() => toggleGroup(groupIds)}
                            disabled={activeIds.length === 0}
                            style={{
                              color: someOn ? "var(--color-accent)" : "var(--color-muted)",
                              background: "none",
                              border: "none",
                              cursor: activeIds.length === 0 ? "default" : "pointer",
                              padding: 0,
                              fontSize: 11,
                              fontWeight: 600,
                              textDecoration: "underline",
                              textDecorationStyle: "dotted",
                              opacity: activeIds.length === 0 ? 0.4 : 1,
                            }}
                          >
                            {allOn ? "Deselect all" : "Select all"}
                          </button>
                          <span className="text-xs" style={{ color: "var(--color-muted)" }}>
                            — {group.label}
                          </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                          {group.items.map(item => {
                            const disabled = slowDisabled(item.id);
                            const checked = selected.has(item.id) && !disabled;
                            const dotColor = ALGO_COLORS[item.id];
                            const incompatible = dataType !== "integer" && ALGO_INCOMPATIBLE[dataType].has(item.id);
                            // Pull the property metadata we already track for
                            // each algo. Stable / in-place are nullable in the
                            // tables so missing entries silently degrade.
                            const timeBigO = ALGO_TIME[item.id];
                            const isStable = ALGO_STABLE[item.id];
                            const inPlace = ALGO_INFO[item.id]?.inPlace;
                            // Best-time-per-dtype lookup — empty until the
                            // session has recorded a measurement for this
                            // (algo, dtype). We render only the dtypes that
                            // have data, sorted in the canonical I → F → S
                            // order so the row stays predictable.
                            const bestTimes = algoBestTimes[item.id] ?? {};
                            const dtypesWithData: DataType[] = (["integer", "float", "string"] as const)
                              .filter(d => bestTimes[d] != null);
                            return (
                              <React.Fragment key={item.id}>
                              <label
                                className="flex flex-col gap-0.5 px-2 py-1 rounded text-xs select-none"
                                style={{
                                  background: checked ? "rgba(139,58,42,0.08)" : "var(--color-surface-1)",
                                  border: `1px solid ${checked ? "var(--color-accent)" : "var(--color-border)"}`,
                                  color: disabled ? "var(--color-muted)" : "var(--color-text)",
                                  opacity: disabled ? 0.4 : 1,
                                  cursor: disabled ? "not-allowed" : "pointer",
                                  minHeight: 28,
                                }}
                              >
                                {/* Row 1 — header: checkbox · dot · name · skip badge · code button */}
                                <div className="flex items-center gap-1.5" style={{ minHeight: 18 }}>
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  disabled={disabled}
                                  onChange={() => toggleAlgo(item.id)}
                                  style={{ accentColor: "var(--color-accent)", cursor: disabled ? "not-allowed" : "pointer" }}
                                />
                                <span style={{
                                  display: "inline-block",
                                  width: 7, height: 7,
                                  borderRadius: "50%",
                                  background: dotColor,
                                  flexShrink: 0,
                                  opacity: checked ? 1 : 0.4,
                                }} />
                                <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                  {item.name}
                                </span>
                                {incompatible && (
                                  <span style={{ fontSize: 9, padding: "0 4px", borderRadius: 3, background: "rgba(239,154,154,0.15)", color: "#ef9a9a", border: "1px solid rgba(239,154,154,0.3)" }}>
                                    skip
                                  </span>
                                )}
                                {/* View source button */}
                                {BENCHMARK_SOURCE[item.id] && (
                                  <button
                                    type="button"
                                    onClick={e => {
                                      e.preventDefault();
                                      setCodeAlgo(prev => prev === item.id ? null : item.id);
                                    }}
                                    title={`View ${item.name} source code`}
                                    style={{
                                      marginLeft: 3,
                                      background: codeAlgo === item.id ? "var(--color-accent-muted)" : "none",
                                      border: `1px solid ${codeAlgo === item.id ? "var(--color-accent)" : "var(--color-border)"}`,
                                      borderRadius: 4,
                                      cursor: "pointer",
                                      padding: "1px 4px",
                                      display: "inline-flex",
                                      alignItems: "center",
                                      color: codeAlgo === item.id ? "var(--color-accent)" : "var(--color-muted)",
                                      lineHeight: 1,
                                    }}
                                  >
                                    <Code size={9} strokeWidth={1.75} />
                                  </button>
                                )}
                                {/* Logos Sort custom-variant button removed. */}
                                </div>

                                {/* Row 2 — property chips: complexity + stable +
                                    in-place. Compact 9-pt monospace; chips are
                                    pure information, never click targets. */}
                                <div style={{ display: "flex", gap: 4, alignItems: "center", flexWrap: "wrap", fontSize: 8, fontFamily: "monospace", lineHeight: 1.3, color: "var(--color-muted)", paddingLeft: 22 }}>
                                  {timeBigO && (
                                    <span title={`Theoretical time complexity: ${timeBigO}`} style={{ color: "var(--color-text)", opacity: 0.7 }}>
                                      {timeBigO}
                                    </span>
                                  )}
                                  {inPlace != null && (
                                    <span
                                      title={inPlace ? "In-place: only O(1) auxiliary memory" : "Not in-place: allocates O(n) (or more) auxiliary"}
                                      style={{ color: inPlace ? "#4db6ac" : "#d4831f", opacity: 0.85 }}
                                    >
                                      {inPlace ? "in-place" : "+aux"}
                                    </span>
                                  )}
                                  {isStable != null && (
                                    <span
                                      title={isStable ? "Stable: preserves the relative order of equal keys" : "Unstable: equal keys may be reordered"}
                                      style={{ color: isStable ? "#7e57c2" : "var(--color-muted)", opacity: 0.85 }}
                                    >
                                      {isStable ? "stable" : "unstable"}
                                    </span>
                                  )}
                                </div>

                                {/* Row 3 — best times per dtype, only when the
                                    session has recorded data. Each chip carries
                                    the dtype convention on its border so the
                                    line-style cue is consistent with the rest
                                    of the app. Conditionally rendered so algos
                                    with no measurements stay compact. */}
                                {dtypesWithData.length > 0 && (
                                  <div style={{ display: "flex", gap: 4, alignItems: "center", flexWrap: "wrap", fontSize: 8, fontFamily: "monospace", lineHeight: 1.3, paddingLeft: 22, marginTop: 1 }}>
                                    {dtypesWithData.map(dt => {
                                      const v = bestTimes[dt]!;
                                      return (
                                        <span
                                          key={dt}
                                          title={`${DT_LABEL[dt]}: ${fmtTime(v.ms)} at n=${v.n.toLocaleString()}`}
                                          style={{
                                            display: "inline-flex", alignItems: "center", gap: 2,
                                            padding: "0 3px", borderRadius: 2,
                                            border: `1px ${cyLineStyle(dt)} var(--color-muted)`,
                                            color: "var(--color-text)",
                                          }}
                                        >
                                          <span style={{ color: "var(--color-muted)" }}>{DT_LABEL[dt][0]}</span>
                                          <span>{fmtTime(v.ms)}</span>
                                        </span>
                                      );
                                    })}
                                  </div>
                                )}
                              </label>
                              </React.Fragment>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Algorithm source code panel */}
                {codeAlgo && BENCHMARK_SOURCE[codeAlgo] && (() => {
                  const src   = BENCHMARK_SOURCE[codeAlgo];
                  const name  = ALGO_NAMES[codeAlgo] ?? codeAlgo;
                  const lines = src.split("\n");
                  return (
                    <div className="mt-3 pt-3" style={{ borderTop: "1px solid var(--color-border)" }}>
                      {/* Header */}
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <Code size={11} style={{ color: "var(--color-accent)", flexShrink: 0 }} />
                          <span style={{ fontSize: 10, fontWeight: 700, color: "var(--color-accent)", fontFamily: "var(--font-mono)" }}>{name}</span>
                          <span style={{ fontSize: 9, color: "var(--color-muted)", fontFamily: "var(--font-mono)" }}>TypeScript · {lines.length} lines</span>
                        </div>
                        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(src).then(() => {
                                setCodeCopied(true);
                                setTimeout(() => setCodeCopied(false), 1500);
                              });
                            }}
                            title="Copy source"
                            style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 9, padding: "2px 6px", borderRadius: 4, border: "1px solid var(--color-border)", background: "var(--color-surface-2)", color: codeCopied ? "var(--color-state-sorted)" : "var(--color-muted)", cursor: "pointer" }}
                          >
                            {codeCopied ? <Check size={9} /> : <Copy size={9} />}
                            {codeCopied ? "Copied!" : "Copy"}
                          </button>
                          <button
                            onClick={() => setCodeAlgo(null)}
                            title="Close"
                            style={{ display: "flex", alignItems: "center", padding: "2px 4px", borderRadius: 4, border: "1px solid var(--color-border)", background: "var(--color-surface-2)", color: "var(--color-muted)", cursor: "pointer" }}
                          >
                            <X size={9} />
                          </button>
                        </div>
                      </div>
                      {/* Code view */}
                      <div style={{ overflowX: "auto", overflowY: "auto", maxHeight: 340, borderRadius: 6, border: "1px solid var(--color-border)", background: "var(--color-surface-2)" }}>
                        <table style={{ borderCollapse: "collapse", width: "100%", minWidth: "max-content", fontFamily: "var(--font-mono)", fontSize: 10 }}>
                          <tbody>
                            {lines.map((line, i) => {
                              const trimmed = line.trimStart();
                              const isComment = trimmed.startsWith("//") || trimmed.startsWith("/*") || trimmed.startsWith("*");
                              return (
                                <tr key={i} style={{ verticalAlign: "top" }}>
                                  <td style={{ paddingLeft: 8, paddingRight: 10, paddingTop: 1, paddingBottom: 1, color: "var(--color-border)", textAlign: "right", userSelect: "none", minWidth: 28, fontSize: 9, borderRight: "1px solid var(--color-border)" }}>
                                    {i + 1}
                                  </td>
                                  <td style={{ paddingLeft: 8, paddingRight: 12, paddingTop: 1, paddingBottom: 1, whiteSpace: "pre", color: isComment ? "var(--color-muted)" : "var(--color-text)", fontStyle: isComment ? "italic" : "normal" }}>
                                    {line || "\u00A0"}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })()}

                {/* Custom sort function */}
                <div className="mt-3 pt-3" style={{ borderTop: "1px solid var(--color-border)" }}>
                  {/* Collapsible header */}
                  <button
                    type="button"
                    onClick={() => setCustomSortOpen(o => !o)}
                    className="flex items-center gap-1 w-full"
                    style={{ background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left" }}
                  >
                    <ChevronRight size={12} style={{
                      color: "var(--color-muted)",
                      transform: customSortOpen ? "rotate(90deg)" : "none",
                      transition: "transform 0.15s ease",
                      flexShrink: 0,
                    }} />
                    <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-muted)" }}>
                      Custom Sort
                    </span>
                    {customSortEnabled && (
                      <span style={{
                        marginLeft: 6, fontSize: 8, padding: "1px 5px", borderRadius: 8,
                        background: "rgba(var(--color-accent-rgb, 99,102,241), 0.15)",
                        color: "var(--color-accent)", border: "1px solid var(--color-accent)",
                        fontWeight: 700, letterSpacing: "0.04em",
                      }}>
                        active
                      </span>
                    )}
                  </button>

                  {customSortOpen && (
                    <div className="mt-2 flex flex-col gap-2">
                      {/* Note: how to actually wire the custom sort into the run */}
                      {customSortCode.trim() && (
                        <div style={{
                          fontSize: 10, fontFamily: "monospace", lineHeight: 1.5,
                          padding: "6px 9px", borderRadius: 5,
                          background: "rgba(255,183,77,0.08)",
                          border: "1px solid rgba(255,183,77,0.35)",
                          color: "var(--color-muted)",
                        }}>
                          <span style={{ color: "#ffb74d", fontWeight: 700 }}>Save to run · </span>
                          Editor drafts are not executed. Click{" "}
                          <strong style={{ color: "var(--color-text)" }}>Save</strong>{" "}
                          below to add this sort to the saved-sorts list — it&apos;ll auto-enable
                          for the next benchmark run with its own color. Rename it in the list
                          anytime; charts and rankings update live.
                        </div>
                      )}
                      {!customSortCode.trim() && (
                        <div style={{
                          fontSize: 10, fontFamily: "monospace", lineHeight: 1.5,
                          padding: "6px 9px", borderRadius: 5,
                          background: "var(--color-surface-1)",
                          border: "1px solid var(--color-border)",
                          color: "var(--color-muted)",
                        }}>
                          <span style={{ color: "var(--color-accent)", fontWeight: 700 }}>How it works · </span>
                          Load a preset below as a starting template, edit the code freely, then tick{" "}
                          <strong style={{ color: "var(--color-text)" }}>Enable custom sort</strong>{" "}
                          to include it in benchmark runs. Saved sorts persist across sessions.
                        </div>
                      )}
                      {/* Load preset buttons — grouped by complexity class */}
                      {(() => {
                        const groups: { label: string; color: string; presets: string[] }[] = [
                          { label: "O(n log n)", color: "#66bb6a", presets: ["Logos", "Adaptive", "PDQ", "TimSort (JS)", "Introsort", "Merge", "Quick", "Heap"] },
                          { label: "O(n log² n) / linear", color: "#ffb74d", presets: ["Shell", "Counting", "Radix", "Bucket"] },
                          { label: "O(n²)", color: "#ef9a9a", presets: ["Insertion", "Selection", "Bubble", "Cocktail", "Comb", "Gnome", "Pancake", "Cycle", "Odd-Even"] },
                        ];
                        const presetMap = Object.fromEntries(CUSTOM_PRESETS.map(p => [p.label, p]));
                        return (
                          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                            <p className="text-[10px]" style={{ color: "var(--color-muted)" }}>Load algorithm:</p>
                            {groups.map(g => (
                              <div key={g.label}>
                                <p style={{ fontSize: 8, color: g.color, fontFamily: "monospace", marginBottom: 3, letterSpacing: "0.04em" }}>{g.label}</p>
                                <div className="flex flex-wrap gap-1">
                                  {g.presets.map(name => {
                                    const preset = presetMap[name];
                                    if (!preset) return null;
                                    return (
                                      <button
                                        key={name}
                                        type="button"
                                        onClick={() => { setCustomSortCode(preset.code); setCustomSortError(null); }}
                                        title={`Load ${name} implementation`}
                                        style={{
                                          fontSize: 9, padding: "2px 7px", borderRadius: 4, cursor: "pointer",
                                          background: "var(--color-surface-2)",
                                          border: "1px solid var(--color-border)",
                                          color: "var(--color-text)",
                                          fontFamily: "monospace",
                                        }}
                                      >
                                        {name}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            ))}
                          </div>
                        );
                      })()}

                      {/* Include checkbox + Run custom only */}
                      <div className="flex items-center gap-3 flex-wrap">
                        <label className="flex items-center gap-1.5" style={{ cursor: "pointer" }}>
                          <input
                            type="checkbox"
                            checked={customSortEnabled}
                            onChange={e => setCustomSortEnabled(e.target.checked)}
                            style={{ accentColor: "var(--color-accent)" }}
                          />
                          <span className="text-xs" style={{ color: customSortEnabled ? "var(--color-accent)" : "var(--color-muted)" }}>
                            Include in benchmark
                          </span>
                        </label>
                        <button
                          type="button"
                          disabled={!canRunCustomOnly}
                          onClick={() => run(["custom"])}
                          style={{
                            ...btn("primary", { padding: "3px 10px", opacity: canRunCustomOnly ? 1 : 0.4, cursor: canRunCustomOnly ? "pointer" : "not-allowed" }),
                            fontSize: 10,
                          }}
                          title={canRunCustomOnly ? "Run only the custom sort against selected sizes & scenarios" : customSortError ? "Fix the syntax error first" : !customSortCode.trim() ? "Write or load a custom sort first" : !customSortEnabled ? "Enable custom sort first" : "Select sizes and scenarios first"}
                        >
                          <Play size={9} strokeWidth={2} />
                          Run custom only
                        </button>
                      </div>

                      {/* Code editor */}
                      <textarea
                        value={customSortCode}
                        onChange={e => {
                          setCustomSortCode(e.target.value);
                          setCustomSortError(null);
                          if (e.target.value.trim()) {
                            try { new Function("return (" + e.target.value + ")")(); }
                            catch (err) { setCustomSortError(String(err)); }
                          }
                        }}
                        placeholder={"// Sort arr in-place or return sorted copy\n(arr) => {\n  arr.sort((a, b) => a - b);\n}"}
                        spellCheck={false}
                        rows={8}
                        style={{
                          width: "100%", resize: "vertical", fontFamily: "monospace", fontSize: 10,
                          padding: "6px 8px", borderRadius: 6,
                          background: "var(--color-surface-1)",
                          border: `1px solid ${customSortError ? "#ef5350" : "var(--color-border)"}`,
                          color: "var(--color-text)", outline: "none",
                          boxSizing: "border-box",
                        }}
                      />
                      {customSortError && (
                        <p className="text-xs" style={{ color: "#ef5350", fontFamily: "monospace" }}>{customSortError}</p>
                      )}

                      {/* Name + notes + save */}
                      <div className="flex flex-col gap-1.5">
                        <div className="flex gap-1.5 items-center">
                          <input
                            type="text"
                            value={customSortName}
                            onChange={e => setCustomSortName(e.target.value)}
                            placeholder="Name (optional)"
                            style={{
                              flex: 1, fontSize: 10, fontFamily: "monospace", padding: "4px 7px", borderRadius: 5,
                              background: "var(--color-surface-1)", border: "1px solid var(--color-border)",
                              color: "var(--color-text)", outline: "none",
                            }}
                          />
                          <button
                            type="button"
                            disabled={!customSortCode.trim()}
                            onClick={() => {
                              // Default new saves to enabled=true so the user's expected
                              // mental model holds: "I saved it → it'll run on next click".
                              // They can untick the saved-row checkbox to exclude later.
                              const entry = {
                                id: genId(),
                                name: customSortName.trim() || `Custom ${new Date().toLocaleTimeString()}`,
                                code: customSortCode,
                                notes: customSortNotes,
                                savedAt: new Date().toISOString(),
                                color: defaultCustomColor(savedSorts.length),
                                enabled: true,
                              };
                              const next = [...savedSorts, entry];
                              setSavedSorts(next);
                              try { localStorage.setItem("codecookbook.savedSorts", JSON.stringify(next)); } catch { /* quota */ }
                            }}
                            style={{
                              ...btn("secondary", { padding: "3px 10px", opacity: customSortCode.trim() ? 1 : 0.4, cursor: customSortCode.trim() ? "pointer" : "not-allowed" }),
                              fontSize: 10, flexShrink: 0,
                            }}
                          >
                            Save
                          </button>
                        </div>
                        <textarea
                          value={customSortNotes}
                          onChange={e => setCustomSortNotes(e.target.value)}
                          placeholder="Notes (optional)"
                          rows={2}
                          style={{
                            width: "100%", resize: "vertical", fontFamily: "monospace", fontSize: 10,
                            padding: "5px 7px", borderRadius: 5, boxSizing: "border-box",
                            background: "var(--color-surface-1)", border: "1px solid var(--color-border)",
                            color: "var(--color-text)", outline: "none",
                          }}
                        />
                        {/* Sample all — applies the most rigorous battery of
                            measurement settings (sizes, scenarios, rounds,
                            adversarial, etc.) without touching which sorts are
                            selected, so it stress-tests the custom sort against
                            whichever algos the user already has checked. */}
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedSizes(new Set([100, 1000, 10000, 100000, 1000000]));
                              setScenarios(new Set(["sorted", "nearlySorted", "random", "reversed", "duplicates"]));
                              setRounds(12);
                              setWarmup(4);
                              setAdversarialEnabled(true);
                              setUseWorkerIsolation(true);
                              setDuplicatePerRound(true);
                              setTimeoutEnabled(true);
                              setPolymorphicMode(false);
                            }}
                            title="Apply the toughest measurement settings to this custom sort: all 5 scenarios · 100 → 1 M · 12 rounds + 4 warm-up · adversarial on · worker isolation on. Does not change which algorithms are selected."
                            style={{
                              padding: "3px 10px", fontSize: 10, borderRadius: 5, cursor: "pointer",
                              background: "rgba(239,83,80,0.10)",
                              border: "1px solid rgba(239,83,80,0.45)",
                              color: "#ef5350",
                              fontFamily: "monospace", fontWeight: 600,
                            }}
                          >
                            ⚡ Sample all (rigorous)
                          </button>
                          <span className="text-[10px]" style={{ color: "var(--color-muted)", fontFamily: "monospace" }}>
                            cranks scenarios · sizes · rounds · adversarial — keeps your selected algorithms
                          </span>
                        </div>
                      </div>

                      {/* Saved sorts list — each row has an enable toggle, color
                          swatch (click to cycle), name → loads into editor on click,
                          and a delete button. Multiple enabled sorts all run together. */}
                      {savedSorts.length > 0 && (() => {
                        const updateSaved = (next: typeof savedSorts) => {
                          setSavedSorts(next);
                          try { localStorage.setItem("codecookbook.savedSorts", JSON.stringify(next)); } catch { /* quota */ }
                        };
                        const enabledCount = savedSorts.filter(s => s.enabled).length;
                        return (
                          <div className="flex flex-col gap-1" style={{ borderTop: "1px solid var(--color-border)", paddingTop: 8 }}>
                            <div className="flex items-center gap-2 mb-1">
                              <p className="text-[10px]" style={{ color: "var(--color-muted)", flex: 1 }}>
                                Saved sorts
                                {enabledCount > 0 && (
                                  <span style={{ marginLeft: 6, color: "var(--color-accent)", fontWeight: 600 }}>
                                    · {enabledCount} enabled
                                  </span>
                                )}
                              </p>
                              <button
                                type="button"
                                onClick={() => updateSaved(savedSorts.map(s => ({ ...s, enabled: enabledCount < savedSorts.length })))}
                                style={{
                                  fontSize: 9, fontFamily: "monospace", padding: "1px 6px", borderRadius: 3,
                                  background: "var(--color-surface-3)", border: "1px solid var(--color-border)",
                                  color: "var(--color-muted)", cursor: "pointer",
                                }}
                              >
                                {enabledCount < savedSorts.length ? "enable all" : "disable all"}
                              </button>
                            </div>
                            {savedSorts.map((s, idx) => {
                              const swatchColor = s.color || defaultCustomColor(idx);
                              return (
                                <div key={s.id} style={{
                                  display: "flex", alignItems: "flex-start", gap: 6,
                                  padding: "5px 7px", borderRadius: 6,
                                  background: s.enabled ? `${swatchColor}1f` /* ~12% */ : "var(--color-surface-1)",
                                  border: `1px solid ${s.enabled ? swatchColor : "var(--color-border)"}`,
                                  transition: "background 0.15s, border-color 0.15s",
                                }}>
                                  {/* Enable checkbox */}
                                  <input
                                    type="checkbox"
                                    checked={!!s.enabled}
                                    onChange={e => updateSaved(savedSorts.map(x => x.id === s.id ? { ...x, enabled: e.target.checked } : x))}
                                    title={s.enabled ? "Disable: skip this sort in the next benchmark run" : "Enable: include this sort in the next benchmark run"}
                                    style={{ marginTop: 2, accentColor: swatchColor, flexShrink: 0, cursor: "pointer" }}
                                  />
                                  {/* Color picker — color swatch button that opens a palette popover */}
                                  <ColorPicker
                                    value={swatchColor}
                                    onChange={c => updateSaved(savedSorts.map(x => x.id === s.id ? { ...x, color: c } : x))}
                                  />
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    {/* Inline-editable name. Typing updates the saved sort
                                        in place; the synchronous ALGO_NAMES sync above
                                        means rankings/cards/charts pick up the new name on
                                        the next render. */}
                                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                      <input
                                        type="text"
                                        value={s.name}
                                        onChange={e => updateSaved(savedSorts.map(x => x.id === s.id ? { ...x, name: e.target.value } : x))}
                                        title="Edit name — changes appear in charts and rankings immediately"
                                        style={{
                                          flex: 1, minWidth: 0,
                                          fontSize: 10, fontFamily: "monospace", fontWeight: 600,
                                          color: swatchColor,
                                          background: "transparent",
                                          border: "1px dashed transparent",
                                          padding: "1px 3px", borderRadius: 3,
                                          outline: "none",
                                        }}
                                        onFocus={e => { e.currentTarget.style.borderColor = "var(--color-border)"; e.currentTarget.style.background = "var(--color-surface-1)"; }}
                                        onBlur={e => { e.currentTarget.style.borderColor = "transparent"; e.currentTarget.style.background = "transparent"; }}
                                      />
                                      <button
                                        type="button"
                                        onClick={() => { setCustomSortCode(s.code); setCustomSortName(s.name); setCustomSortNotes(s.notes); setCustomSortError(null); }}
                                        title="Load this sort into the editor for inspection / editing"
                                        style={{
                                          fontSize: 8, fontFamily: "monospace", padding: "1px 5px", borderRadius: 3,
                                          background: "var(--color-surface-3)", border: "1px solid var(--color-border)",
                                          color: "var(--color-muted)", cursor: "pointer", flexShrink: 0,
                                        }}
                                      >
                                        load
                                      </button>
                                      <span style={{ fontSize: 9, color: "var(--color-muted)", flexShrink: 0 }}>{new Date(s.savedAt).toLocaleDateString()}</span>
                                    </div>
                                    {s.notes && (
                                      <p style={{ fontSize: 9, color: "var(--color-muted)", marginTop: 2, fontFamily: "monospace", whiteSpace: "pre-wrap" }}>{s.notes}</p>
                                    )}
                                  </div>
                                  <button
                                    type="button"
                                    title="Delete"
                                    onClick={() => updateSaved(savedSorts.filter(x => x.id !== s.id))}
                                    style={{ fontSize: 9, color: "var(--color-muted)", background: "none", border: "none", cursor: "pointer", flexShrink: 0, padding: "0 2px" }}
                                  >
                                    ✕
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>

                {/* Logos Sort parameters panel removed. */}

                {(maxSelectedSize > SLOW_THRESHOLD || Object.entries(MEDIUM_LIMITS).some(([id, { threshold }]) => selected.has(id) && maxSelectedSize > threshold)) && (
                  <div className="mt-2.5 flex flex-col gap-1">
                    {maxSelectedSize > SLOW_THRESHOLD && (
                      <p className="text-xs" style={{ color: "var(--color-state-swap)" }}>
                        ⚠ O(n²) sorts (Bubble, Insertion, Selection, Cocktail, Comb, Gnome, Pancake, Cycle, Odd-Even) disabled above n={SLOW_THRESHOLD.toLocaleString()}.
                      </p>
                    )}
                    {Object.entries(MEDIUM_LIMITS).filter(([id, { threshold }]) => selected.has(id) && maxSelectedSize > threshold).map(([id, { threshold, reason }]) => (
                      <p key={id} className="text-xs" style={{ color: "#ffb74d" }}>
                        ⚠ {ALGO_NAMES[id]} disabled above n={fmtN(threshold)}: {reason}.
                      </p>
                    ))}
                    {maxSelectedSize > LARGE_THRESHOLD && [...selected].some(id => !UNLIMITED_IDS.has(id)) && (
                      <p className="text-xs" style={{ color: "var(--color-state-swap)" }}>
                        ⚠ Only O(n log n) algorithms run above n={fmtN(LARGE_THRESHOLD)}.
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Data Type — segmented single-select. Each run rebuilds sort
                  functions fresh (freshSortFn) so switching types can't carry
                  V8 megamorphic deopt across runs. */}
              <div className="mb-4 print:hidden">
                <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--color-muted)" }}>Data Type</p>
                <div
                  style={{
                    display: "inline-flex",
                    borderRadius: 7,
                    border: "1px solid var(--color-border)",
                    background: "var(--color-surface-1)",
                    overflow: "hidden",
                  }}
                >
                  {(["integer", "float", "string"] as DataType[]).map((dt, i) => {
                    const active = dataType === dt;
                    return (
                      <button
                        key={dt}
                        onClick={() => setDataType(dt)}
                        title={
                          dt === "integer" ? "Random 32-bit integers" :
                          dt === "float"   ? "Random doubles" :
                                             "Random fixed-length strings"
                        }
                        style={{
                          padding: "4px 14px", fontSize: 11, cursor: "pointer",
                          background: active ? "var(--color-accent)" : "transparent",
                          color: active ? "#fff" : "var(--color-muted)",
                          fontWeight: active ? 600 : 400,
                          border: "none",
                          borderLeft: i > 0 ? "1px solid var(--color-border)" : "none",
                          transition: "background 0.12s, color 0.12s",
                        }}
                      >
                        {dt.charAt(0).toUpperCase() + dt.slice(1)}
                      </button>
                    );
                  })}
                </div>
                {dataType !== "integer" && (() => {
                  const skipped = [...ALGO_INCOMPATIBLE[dataType]];
                  const skippedNames = skipped.map(id => ALGO_NAMES[id] ?? id).join(", ");
                  return skipped.length > 0 ? (
                    <p className="text-xs mt-1.5" style={{ color: "var(--color-muted)" }}>
                      <span style={{ color: "var(--color-state-swap)" }}>⚠</span> {skippedNames} will be skipped (incompatible with {dataType}s)
                    </p>
                  ) : null;
                })()}
              </div>

              {/* Advanced */}
              {has("advanced") && <div className="print:hidden mb-4">
                <button
                  onClick={() => setAdvancedOpen(o => !o)}
                  className="flex items-center gap-1"
                  style={btn("ghost", { padding: 0, fontSize: 9, fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase" })}
                >
                  <ChevronRight size={12} style={{ transform: advancedOpen ? "rotate(90deg)" : "none", transition: "transform 0.15s ease" }} />
                  Advanced
                </button>

                {advancedOpen && (
                  <div className="mt-3 flex flex-col gap-3">

                    {/* ── Group: Input data ── */}
                    <AdvGroup title="Input data">
                      <AdvSection title="Scenarios" hint="one drawn at random per round">
                        <div className="flex flex-wrap gap-1.5">
                          {SCENARIO_OPTIONS.map(s => {
                            const on = scenarios.has(s.id);
                            return (
                              <label
                                key={s.id}
                                className="flex items-center gap-1.5 rounded text-xs select-none"
                                style={{
                                  padding: "2px 8px",
                                  background: on ? "rgba(139,58,42,0.08)" : "var(--color-surface-1)",
                                  border: `1px solid ${on ? "var(--color-accent)" : "var(--color-border)"}`,
                                  color: on ? "var(--color-text)" : "var(--color-muted)",
                                  cursor: "pointer",
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={on}
                                  onChange={() => setScenarios(prev => {
                                    const next = new Set(prev);
                                    on ? next.delete(s.id) : next.add(s.id);
                                    return next;
                                  })}
                                  style={{ accentColor: "var(--color-accent)" }}
                                />
                                {s.label}
                                {s.rare && <span style={{ fontSize: 9, padding: "0 4px", borderRadius: 3, background: "var(--color-surface-3)", color: "var(--color-muted)", fontStyle: "italic" }}>rare</span>}
                                <span style={{ color: "var(--color-muted)", fontSize: 10 }}>— {s.desc}</span>
                              </label>
                            );
                          })}
                        </div>
                      </AdvSection>

                      <AdvSection title="Value distribution" hint="how random values are sampled — applies to the random scenario">
                        <div className="flex flex-wrap gap-1.5 items-center">
                          {([
                            { id: "uniform",     label: "Uniform",     desc: "Flat — equally likely across the range (default)" },
                            { id: "normal",      label: "Normal",      desc: "Bell curve — clustered around the midpoint (μ = mid, σ = range/6)" },
                            { id: "exponential", label: "Exponential", desc: "Most mass near the low end, long right tail" },
                            { id: "bimodal",     label: "Bimodal",     desc: "Two clusters — peaks at 30% and 70% of the range" },
                          ] as const).map(opt => {
                            const active = valueDist === opt.id;
                            return (
                              <button
                                key={opt.id}
                                onClick={() => setValueDist(opt.id)}
                                title={opt.desc}
                                style={{
                                  padding: "3px 10px", fontSize: 10, borderRadius: 5, cursor: "pointer",
                                  background: active ? "color-mix(in srgb, var(--color-accent) 18%, transparent)" : "var(--color-surface-1)",
                                  border: `1px solid ${active ? "var(--color-accent)" : "var(--color-border)"}`,
                                  color: active ? "var(--color-accent)" : "var(--color-muted)",
                                  fontFamily: "monospace", fontWeight: active ? 600 : 400,
                                }}
                              >
                                {opt.label}
                              </button>
                            );
                          })}
                        </div>
                        <p className="text-[10px] mt-1.5" style={{ color: "var(--color-muted)", fontFamily: "monospace" }}>
                          Only affects the <code>random</code> scenario (and integer/float data types); sorted / nearlySorted / reversed / duplicates keep their fixed semantics. Out-of-range samples are clamped to the range bounds.
                        </p>
                      </AdvSection>

                      <AdvSection title="Custom distribution" hint="layered on top of selected scenarios">
                        <div className="flex flex-col gap-2">
                          {([
                            { label: "% pre-sorted prefix", value: customPreSorted, set: setCustomPreSorted },
                            { label: "% duplicate injection", value: customDuplicates, set: setCustomDuplicates },
                          ] as const).map(({ label, value, set }) => {
                            const disabled = label.startsWith("% duplicate") && intUniqueOnly && dataType === "integer";
                            return (
                            <div key={label} className="flex items-center gap-3" style={{ opacity: disabled ? 0.4 : 1 }}>
                              <span className="text-xs font-mono shrink-0" style={{ color: "var(--color-muted)", width: 150 }}>{label}</span>
                              <input
                                type="range" min={0} max={100} step={5} value={value}
                                disabled={disabled}
                                onChange={e => set(Number(e.target.value))}
                                style={{ flex: 1, accentColor: "var(--color-accent)" }}
                              />
                              <span className="text-xs font-mono shrink-0" style={{ color: "var(--color-text)", width: 32, textAlign: "right" }}>
                                {value}%
                              </span>
                            </div>
                          );})}
                        </div>
                      </AdvSection>

                      {dataType === "integer" && (
                        <AdvSection title="Integer options">
                          <div className="flex flex-col gap-2">
                            <AdvToggle checked={intUniqueOnly} onChange={setIntUniqueOnly} label="Unique values only">
                              Guarantees no duplicates across the input — generated via Fisher–Yates shuffle of the value range
                              (or rejection sampling when the range is wide). Mutually exclusive with the duplicate-injection
                              slider above; that slider greys out while this is on.
                            </AdvToggle>
                            <AdvToggle checked={intFullInt32} onChange={setIntFullInt32} label="Full 32-bit range">
                              Sample from <code>[-2,147,483,648, 2,147,483,647]</code> instead of the default <code>[0, 10000)</code>.
                              <span style={{ color: "#ffb74d" }}> Disables counting-sort&apos;s O(n+k) advantage</span> — its
                              bucket array would be 4 GB, so it falls back to comparison performance like everyone else.
                            </AdvToggle>
                          </div>
                        </AdvSection>
                      )}
                    </AdvGroup>

                    {/* ── Group: Measurement ── */}
                    <AdvGroup title="Measurement">
                      <AdvSection title="Rounds & warm-up">
                        <div className="flex flex-wrap items-end gap-5">
                          <div className="flex flex-col gap-1">
                            <span className="text-xs" style={{ color: "var(--color-muted)" }}>Rounds</span>
                            <Spinner value={rounds} onChange={setRounds} min={1} max={50} label="Rounds" />
                          </div>
                          <div className="flex flex-col gap-1">
                            <span className="text-xs" style={{ color: "var(--color-muted)" }}>Warmup (discard first)</span>
                            <Spinner value={warmup} onChange={v => setWarmup(Math.min(v, rounds - 1))} min={0} max={Math.max(0, rounds - 1)} label="Warmup" />
                          </div>
                          <span className="text-xs pb-0.5" style={{ color: "var(--color-muted)" }}>
                            {Math.max(0, rounds - warmup)} rounds recorded · best kept
                          </span>
                        </div>
                      </AdvSection>

                      <AdvSection title="Sort engine" hint="V8 (default JIT) · AssemblyScript-compiled Wasm · WebGPU compute">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {(() => {
                            const webgpuReady = webgpuBundle != null && webgpuBundle.ready === true;
                            const webgpuReason = webgpuBundle && webgpuBundle.ready === false ? webgpuBundle.reason : null;
                            const opts = [
                              { id: "v8" as const,     label: "V8 (JS)", desc: "Use the JavaScript implementations — the default for every algorithm.", disabled: false, disabledReason: "" },
                              { id: "wasm" as const,   label: "Wasm",    desc: "Route supported algorithms through the AssemblyScript .wasm module. Currently insertion, quicksort, and Logos (int32 port), integer data only; other algos / dtypes silently fall back to V8.", disabled: !wasmBundle, disabledReason: "Wasm module not built yet — run `npm run build:wasm` once to enable." },
                              { id: "webgpu" as const, label: "WebGPU",  desc: "Route GPU-ported algorithms through a WebGPU compute pipeline. No kernels are shipped in v1 — selecting this engine while the supported set is empty falls through to V8 for every algorithm, but the badge wiring is live so ported sorts will light up immediately.", disabled: !webgpuReady, disabledReason: webgpuReason ?? "WebGPU support not detected yet." },
                            ];
                            return opts.map(opt => {
                              const active = engine === opt.id;
                              return (
                                <button
                                  key={opt.id}
                                  onClick={() => { if (!opt.disabled) setEngine(opt.id); }}
                                  disabled={opt.disabled}
                                  title={opt.disabled ? opt.disabledReason : opt.desc}
                                  style={{
                                    padding: "3px 10px", fontSize: 10, borderRadius: 5,
                                    cursor: opt.disabled ? "not-allowed" : "pointer",
                                    background: active ? "color-mix(in srgb, var(--color-accent) 18%, transparent)" : "var(--color-surface-1)",
                                    border: `1px solid ${active ? "var(--color-accent)" : "var(--color-border)"}`,
                                    color: opt.disabled ? "var(--color-muted)" : active ? "var(--color-accent)" : "var(--color-muted)",
                                    fontFamily: "monospace", fontWeight: active ? 600 : 400,
                                    opacity: opt.disabled ? 0.5 : 1,
                                  }}
                                >
                                  {opt.label}
                                </button>
                              );
                            });
                          })()}
                        </div>
                        <p className="text-[10px] mt-1.5" style={{ color: "var(--color-muted)", fontFamily: "monospace" }}>
                          {wasmBundle
                            ? "Wasm engine ready · supports insertion, quicksort, and Logos (int32 port) on integer data · marshalling cost is included in the timing (honest 'JS calling Wasm' number)"
                            : "Wasm engine disabled — run npm install + npm run build:wasm to compile /public/wasm-sorts/sorts.wasm"}
                          {engine === "wasm" && wasmBundle && " · forces main-thread timing (worker isolation skipped)"}
                        </p>
                        <p className="text-[10px] mt-1" style={{ color: "var(--color-muted)", fontFamily: "monospace" }}>
                          {webgpuBundle == null
                            ? "WebGPU detection pending…"
                            : webgpuBundle.ready
                              ? `WebGPU adapter detected${webgpuBundle.info.vendor || webgpuBundle.info.device ? ` (${[webgpuBundle.info.vendor, webgpuBundle.info.device].filter(Boolean).join(" · ")})` : ""}${WEBGPU_SUPPORTED.size === 0 ? " · no GPU kernels ported yet — selecting this engine currently falls through to V8 for every algorithm" : ` · supports ${[...WEBGPU_SUPPORTED].join(", ")} on integer data`}`
                              : `WebGPU disabled — ${webgpuBundle.reason}`}
                          {engine === "webgpu" && webgpuBundle?.ready && " · forces main-thread timing (worker isolation skipped)"}
                        </p>
                      </AdvSection>

                      <AdvToggle checked={duplicatePerRound} onChange={setDuplicatePerRound} label="Duplicate input each round">
                        On (default): each round sorts a fresh copy of the input, so every round and every algorithm
                        measures pristine data. The copy reuses one scratch array per algorithm/size, so it adds no
                        per-round allocation.
                        <span style={{ color: "#ffb74d" }}> Off: sorts the shared input in place — lowest memory, but later
                        algorithms / rounds see already-sorted data, so it&apos;s a single-round diagnostic only and forces
                        main-thread mode.</span>
                      </AdvToggle>

                      <AdvToggle checked={useWorkerIsolation} onChange={setUseWorkerIsolation} label="Web Worker isolation" disabled={!duplicatePerRound}>
                        Each algorithm runs in its own Worker thread — JIT compilation and GC for one algo cannot pollute timing of another.
                        <span style={{ color: "#ffb74d" }}> Tradeoff: ~10–50 ms overhead per worker creation; space measurement falls back to theoretical.</span>
                        {!duplicatePerRound && <span style={{ color: "#ffb74d" }}> (Disabled while &ldquo;Duplicate input&rdquo; is off.)</span>}
                      </AdvToggle>

                      <AdvToggle checked={timeoutEnabled} onChange={setTimeoutEnabled} label="Per-sort timeout">
                        Any single sort exceeding this wall-clock budget is marked timed out and the algorithm is excluded from larger n.
                        <span style={{ color: "#ffb74d" }}> Default 3 s — disable (or raise) for long benchmarks where slow O(n²) algos would prematurely terminate.</span>
                        <div className="flex items-center gap-2 mt-1.5">
                          <input
                            type="number"
                            min={1}
                            max={600}
                            value={timeoutSec}
                            disabled={!timeoutEnabled}
                            onChange={e => {
                              const v = Number(e.target.value);
                              if (Number.isFinite(v) && v >= 1 && v <= 600) setTimeoutSec(v);
                            }}
                            onClick={e => e.stopPropagation()}
                            style={{
                              fontFamily: "monospace", fontSize: 11, width: 60,
                              padding: "3px 6px", borderRadius: 4,
                              background: "var(--color-surface-2)",
                              border: "1px solid var(--color-border)",
                              color: "var(--color-text)",
                              opacity: timeoutEnabled ? 1 : 0.4,
                              cursor: timeoutEnabled ? "text" : "not-allowed",
                            }}
                          />
                          <span style={{ fontSize: 11, fontFamily: "monospace", color: "var(--color-muted)" }}>seconds</span>
                        </div>
                      </AdvToggle>
                    </AdvGroup>

                    {/* ── Group: Stress & algorithm tuning ── */}
                    <AdvGroup title="Stress & algorithm tuning" defaultOpen={false}>
                      {(selected.has("quick") || selected.has("shell")) && (
                        <AdvSection title="Algorithm options">
                          <div className="flex flex-col gap-2">
                            {selected.has("quick") && (
                              <div className="flex items-start gap-3">
                                <span className="text-xs shrink-0 pt-0.5" style={{ color: "var(--color-muted)", width: 128 }}>Quick Sort pivot</span>
                                <div className="flex flex-wrap gap-1">
                                  {QUICK_PIVOT_OPTS.map(opt => (
                                    <button
                                      key={opt.id}
                                      onClick={() => setQuickPivot(opt.id)}
                                      title={opt.desc}
                                      style={{
                                        padding: "2px 8px", fontSize: 10,
                                        background: quickPivot === opt.id ? "rgba(139,58,42,0.15)" : "var(--color-surface-1)",
                                        border: `1px solid ${quickPivot === opt.id ? "var(--color-accent)" : "var(--color-border)"}`,
                                        borderRadius: 4, cursor: "pointer",
                                        color: quickPivot === opt.id ? "var(--color-text)" : "var(--color-muted)",
                                      }}
                                    >
                                      {opt.label}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                            {selected.has("shell") && (
                              <div className="flex items-start gap-3">
                                <span className="text-xs shrink-0 pt-0.5" style={{ color: "var(--color-muted)", width: 128 }}>Shell Sort gaps</span>
                                <div className="flex flex-wrap gap-1">
                                  {SHELL_GAPS_OPTS.map(opt => (
                                    <button
                                      key={opt.id}
                                      onClick={() => setShellGaps(opt.id)}
                                      title={opt.desc}
                                      style={{
                                        padding: "2px 8px", fontSize: 10,
                                        background: shellGaps === opt.id ? "rgba(139,58,42,0.15)" : "var(--color-surface-1)",
                                        border: `1px solid ${shellGaps === opt.id ? "var(--color-accent)" : "var(--color-border)"}`,
                                        borderRadius: 4, cursor: "pointer",
                                        color: shellGaps === opt.id ? "var(--color-text)" : "var(--color-muted)",
                                      }}
                                    >
                                      {opt.label}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </AdvSection>
                      )}

                      <AdvSection title="Adversarial input">
                        <button
                          onClick={() => setAdversarialEnabled(v => !v)}
                          title="Generates worst-case input specifically designed to maximize comparisons for each algorithm (e.g., median-of-3 killer for Quicksort)"
                          style={{
                            display: "inline-flex", alignItems: "center", gap: 6,
                            padding: "3px 10px", fontSize: 10, borderRadius: 5, cursor: "pointer",
                            background: adversarialEnabled ? "rgba(239,83,80,0.12)" : "var(--color-surface-1)",
                            border: `1px solid ${adversarialEnabled ? "#ef5350" : "var(--color-border)"}`,
                            color: adversarialEnabled ? "#ef5350" : "var(--color-muted)",
                            fontFamily: "monospace",
                          }}
                        >
                          ⚡ Adversarial {adversarialEnabled ? "on" : "off"}
                        </button>
                        {adversarialEnabled && (
                          <p className="text-xs mt-1.5" style={{ color: "var(--color-muted)", fontFamily: "monospace" }}>
                            One extra worst-case input per algorithm per size is added to the timing pool. For Quicksort this is the median-of-3 killer pattern; reversed for insertion/selection/bubble; large-spread for counting/radix; all-same-bucket for bucket sort.
                          </p>
                        )}
                      </AdvSection>
                    </AdvGroup>
                  </div>
                )}
              </div>}

              {/* Note when Advanced is hidden by level gate */}
              {!has("advanced") && (
                <div className="print:hidden mb-4" style={{
                  fontSize: 10, fontFamily: "monospace", lineHeight: 1.5,
                  padding: "8px 10px", borderRadius: 5,
                  background: "rgba(255,183,77,0.08)",
                  border: "1px solid rgba(255,183,77,0.35)",
                  color: "var(--color-muted)",
                }}>
                  <span style={{ color: "#ffb74d", fontWeight: 700 }}>Tip · </span>
                  Advanced configuration (scenario mix, custom Logos variants, adversarial input,
                  worker isolation, per-sort timeout, custom sort editor) is gated to{" "}
                  <strong style={{ color: "var(--color-text)" }}>Advanced</strong> level.
                  Switch the level selector in the sidebar to unlock these knobs.
                </div>
              )}

              {/* ── Session data toolbar ──
                  Export + import of the aggregate stores the session views
                  read from (sessionLog / winnerLog / ghostRuns). JSON is the
                  round-trippable everything-bagel; CSV is the flat-table
                  version for spreadsheet / pandas analysis. Import accepts
                  the JSON format only — overwriting state with mismatched
                  CSV would silently lose the winnerLog and ghostRuns. */}
              {(() => {
                const stamp = () => {
                  const d = new Date();
                  const pad = (n: number) => String(n).padStart(2, "0");
                  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
                };
                const hasData =
                  Object.keys(sessionLog).length > 0 ||
                  Object.keys(winnerLog).length > 0 ||
                  Object.keys(ghostRuns).length > 0;
                const exportJson = () => {
                  if (!hasData) return;
                  downloadSessionBlob(
                    buildSessionDataJson(sessionLog, winnerLog, ghostRuns),
                    `codecookbook-session-${stamp()}.json`,
                    "application/json",
                  );
                };
                const exportCsv = () => {
                  if (!hasData) return;
                  downloadSessionBlob(
                    buildSessionDataCsv(sessionLog),
                    `codecookbook-session-${stamp()}.csv`,
                    "text/csv",
                  );
                };
                const onImportPick = (e: React.ChangeEvent<HTMLInputElement>) => {
                  const file = e.target.files?.[0];
                  // Reset the input value so picking the same file twice in a
                  // row still fires `onChange` (otherwise React keeps the old
                  // file object and the second pick is a no-op).
                  e.target.value = "";
                  if (!file) return;
                  file.text().then(text => {
                    const result = parseSessionDataJson(text);
                    if (!result.ok) {
                      setSessionImportMsg({ kind: "error", text: result.error });
                      return;
                    }
                    // Hydrate state + localStorage. We deliberately REPLACE
                    // rather than merge — merging would silently double-count
                    // runs in the rolling-mean buckets.
                    setSessionLog(result.data.sessionLog);
                    setWinnerLog(result.data.winnerLog);
                    setGhostRuns(result.data.ghostRuns);
                    try { localStorage.setItem("codecookbook.sessionLog", JSON.stringify(result.data.sessionLog)); } catch {}
                    try { localStorage.setItem("codecookbook.winnerLog",  JSON.stringify(result.data.winnerLog));  } catch {}
                    try { localStorage.setItem("codecookbook.ghostRuns",  JSON.stringify(result.data.ghostRuns));  } catch {}
                    const counts = Object.keys(result.data.sessionLog).length;
                    setSessionImportMsg({ kind: "ok", text: `Imported ${counts} data type${counts !== 1 ? "s" : ""} from ${file.name}` });
                  }).catch(err => {
                    setSessionImportMsg({ kind: "error", text: `Couldn't read file: ${err instanceof Error ? err.message : "unknown error"}` });
                  });
                };
                const btnStyle: React.CSSProperties = {
                  fontSize: 9, padding: "3px 8px", borderRadius: 4, cursor: "pointer",
                  background: "var(--color-surface-1)", border: "1px solid var(--color-border)",
                  color: "var(--color-muted)", fontFamily: "monospace",
                };
                return (
                  <div className="rounded-xl px-3 py-2 flex flex-wrap items-center gap-2 print:hidden" style={{ background: "var(--color-surface-1)", border: "1px solid var(--color-border)" }}>
                    <span className="text-[9px] uppercase tracking-wider" style={{ color: "var(--color-muted)", fontWeight: 600 }}>
                      Session data
                    </span>
                    <button
                      onClick={exportJson}
                      disabled={!hasData}
                      title="Export the full session (sessionLog + winnerLog + ghostRuns). Round-trippable via Import."
                      style={{ ...btnStyle, opacity: hasData ? 1 : 0.4, cursor: hasData ? "pointer" : "not-allowed" }}
                    >
                      ↓ JSON
                    </button>
                    <button
                      onClick={exportCsv}
                      disabled={!hasData}
                      title="Export sessionLog flattened to one row per (dataType, algo, n). Loads directly into pandas / spreadsheets. WinnerLog and ghost runs not included — use JSON for those."
                      style={{ ...btnStyle, opacity: hasData ? 1 : 0.4, cursor: hasData ? "pointer" : "not-allowed" }}
                    >
                      ↓ CSV
                    </button>
                    <label
                      title="Import a previously-exported JSON session file. REPLACES current data (merge would silently double-count runs)."
                      style={{ ...btnStyle, display: "inline-flex", alignItems: "center", gap: 4 }}
                    >
                      ↑ Import
                      <input
                        type="file"
                        accept="application/json,.json"
                        onChange={onImportPick}
                        style={{ display: "none" }}
                      />
                    </label>
                    {sessionImportMsg && (
                      <span style={{
                        fontSize: 9, fontFamily: "monospace",
                        color: sessionImportMsg.kind === "ok" ? "#4db6ac" : "#ef5350",
                        marginLeft: 4,
                      }}>
                        {sessionImportMsg.kind === "ok" ? "✓ " : "✗ "}{sessionImportMsg.text}
                      </span>
                    )}
                  </div>
                );
              })()}

              {/* Three at-a-glance numbers + best-per-type callouts. */}
              <SessionSummary
                log={sessionLog}
                runCount={runCount}
                sessionStartedAt={sessionStartedAt}
                algoNames={ALGO_NAMES}
                algoColors={ALGO_COLORS}
              />

              {/* Running log of winners across runs — broken out by data type.
                  Persisted to localStorage; accumulates rolling means per
                  (dataType, algoId, size) at the end of each successful run.
                  `spaceMap` is the SessionLog (which carries meanSpaceBytes per
                  bucket), used to compute the in-place % column on each row. */}
              <WinnersLog
                log={winnerLog}
                spaceMap={sessionLog}
                ghostRuns={ghostRuns}
                algoNames={ALGO_NAMES}
                algoColors={ALGO_COLORS}
                onClear={() => {
                  setWinnerLog({});
                  try { localStorage.removeItem("codecookbook.winnerLog"); } catch { /* noop */ }
                }}
              />

              {/* Empirical Big-O fit across the session — flags when a sort's
                  measured slope drifts more than 0.2 from its theoretical
                  complexity class. Useful sanity check for implementations. */}
              <SessionBigO
                log={sessionLog}
                algoNames={ALGO_NAMES}
                algoColors={ALGO_COLORS}
                algoTime={ALGO_TIME}
              />

              {/* Session-wide head-to-head matrices. Like the per-run pair
                  matrix, but tallying W/L across EVERY (dataType, n) bucket
                  in the session, separately for time and aux memory. */}
              <SessionMatrix
                log={sessionLog}
                algoNames={ALGO_NAMES}
                algoColors={ALGO_COLORS}
              />

              {/* Session-wide aggregate speed + memory curves. Same shape as
                  the per-run curve, but persisted across every benchmark in
                  this session. Color by algorithm, dashed/dotted/solid by
                  integer/float/string so all three types overlay on one chart. */}
              <SessionCurves
                log={sessionLog}
                algoNames={ALGO_NAMES}
                algoColors={ALGO_COLORS}
                onClear={() => {
                  setSessionLog({});
                  try { localStorage.removeItem("codecookbook.sessionLog"); } catch { /* noop */ }
                }}
              />

              {/* ── Sort network graph ──
                  Cytoscape rendering of every (algorithm, data-type) measurement
                  in the session. Each algo is a node connected to one of three
                  data-type hubs by an edge whose color encodes speed (green =
                  fastest of that algo's dtypes, red = slowest), width encodes
                  memory (log-scaled across all edges), and line-style encodes
                  the dtype convention (integer = dotted, float = dashed,
                  string = solid — applied everywhere, see lib/dataTypeStyle.ts). */}
              <SortNetworkGraph
                log={sessionLog}
                algoNames={ALGO_NAMES}
                algoColors={ALGO_COLORS}
              />

              {/* ── 3D history view ──
                  Lower-left long-term-view: every stored ghost run rendered as
                  a faded polyline in the same n/time/space axes as the per-run
                  Chart3D in the right pane. Newest run at full brightness,
                  oldest at ~5%. Storage cap is GHOST_MAX (100); the slider
                  inside the component gates how many of those actually draw.
                  Mode toggle lets the user switch between an all-algos overlay
                  (the wow-shot) and a single-algo focus (where drift is
                  actually readable). Hidden until at least one algorithm has
                  some history to show. */}
              {chartAlgos.length > 0 && (Object.values(ghostRuns).some(r => r.length > 0) || hasCurveData) && (
                <div className="rounded-xl p-4" style={{ background: "var(--color-surface-1)", border: "1px solid var(--color-border)" }}>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-muted)" }}>
                      3D History
                    </p>
                    <span className="text-xs" style={{ color: "var(--color-muted)", fontFamily: "monospace", fontSize: 9 }}>
                      drift across runs · last {GHOST_MAX} kept
                    </span>
                  </div>
                  <Chart3DHistory
                    current={curveDataExt}
                    ghostRuns={ghostRuns}
                    algos={chartAlgos}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Right pane: performance curve ──
            Must scroll independently or the Time Complexity Analysis section
            at the bottom falls below the viewport on desktop and is unreachable. */}
        <div className="lg:w-1/2 lg:h-full lg:overflow-y-auto border-l" style={{ borderColor: "var(--color-border)" }}>

          <div className="px-5 py-4 flex flex-col gap-4">
            {/* Skeleton previews — show what will appear once the benchmark runs.
                Visible only when we haven't run yet AND aren't currently running. */}
            {!hasCurveData && status !== "running" && (
              <ResultsSkeleton algoCount={Math.max(1, [...activeAlgos].length + enabledSavedSorts.length)} />
            )}
            {(hasCurveData || status === "running") && (
              <div
                className="rounded-xl p-4"
                style={resultsMaximized ? {
                  position: "fixed", inset: 0, zIndex: 9000,
                  background: "var(--color-surface-1)",
                  border: "1px solid var(--color-border)",
                  display: "flex", flexDirection: "column",
                  overflow: "auto", padding: "20px 28px",
                } : {
                  background: "var(--color-surface-2)", border: "1px solid var(--color-border)", display: "flex", flexDirection: "column",
                }}
              >
                {/* Results header */}
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-semibold text-sm mb-0.5" style={{ color: "var(--color-text)" }}>
                      {chartMode === "time" ? "Performance curve" : chartMode === "space" ? "Space usage curve" : chartMode === "3d" ? "3D: time × space × n" : chartMode === "product" ? "Time × space product" : "Normalized curve (time / n·log₂n)"}
                    </p>
                    {runConfig && (
                      <div className="flex flex-wrap items-center gap-1.5 mt-1">
                        <span style={{ fontSize: 10, color: "var(--color-muted)", fontFamily: "monospace" }}>
                          {runConfig.algos.map(id => ALGO_NAMES[id] ?? id).join(", ")}
                        </span>
                        <span style={{ fontSize: 10, color: "var(--color-muted)", opacity: 0.5 }}>·</span>
                        <span style={{ fontSize: 10, color: "var(--color-muted)", fontFamily: "monospace" }}>
                          n={runConfig.sizes.map(n => fmtN(n)).join(", ")}
                        </span>
                        <span style={{ fontSize: 10, color: "var(--color-muted)", opacity: 0.5 }}>·</span>
                        {runConfig.scenarios.map(s => {
                          const opt = SCENARIO_OPTIONS.find(o => o.id === s);
                          return (
                            <span key={s} style={{
                              fontSize: 10, padding: "1px 7px", borderRadius: 10, fontWeight: 500,
                              background: "rgba(255,183,77,0.12)", color: "#ffb74d",
                              border: "1px solid rgba(255,183,77,0.25)",
                            }}>{opt?.label ?? s}</span>
                          );
                        })}
                        <span style={{ fontSize: 10, color: "var(--color-muted)", fontFamily: "monospace" }}>
                          · {runConfig.rounds} round{runConfig.rounds !== 1 ? "s" : ""}, {runConfig.warmup} discarded
                        </span>
                        {dataType !== "integer" && (
                          <span style={{ fontSize: 10, padding: "1px 7px", borderRadius: 10, fontWeight: 500, background: "rgba(100,181,246,0.12)", color: "#64b5f6", border: "1px solid rgba(100,181,246,0.25)" }}>
                            {dataType}s
                          </span>
                        )}
                        {runConfig.algos.includes("quick") && quickPivot !== "median3" && (
                          <span style={{ fontSize: 10, padding: "1px 7px", borderRadius: 10, fontWeight: 500, background: "rgba(255,192,0,0.12)", color: "#ffc000", border: "1px solid rgba(255,192,0,0.25)" }}>
                            pivot: {quickPivot}
                          </span>
                        )}
                        {runConfig.algos.includes("shell") && shellGaps !== "ciura" && (
                          <span style={{ fontSize: 10, padding: "1px 7px", borderRadius: 10, fontWeight: 500, background: "rgba(0,196,204,0.12)", color: "#00c4cc", border: "1px solid rgba(0,196,204,0.25)" }}>
                            gaps: {shellGaps}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {status === "running" && (
                      <button
                        onClick={() => setProgressLocked(l => !l)}
                        title={progressLocked ? "Unlock chart cursor from benchmark progress" : "Lock chart cursor to benchmark progress"}
                        style={btn("secondary", { padding: "2px 7px", fontSize: 9, border: `1px solid ${progressLocked ? "var(--color-border)" : "var(--color-accent)"}`, color: progressLocked ? "var(--color-muted)" : "var(--color-accent)" })}
                      >
                        {progressLocked ? <><Lock size={8} /> locked</> : <><Unlock size={8} /> unlocked</>}
                      </button>
                    )}
                    {status === "done" && summaryResults[0] && largestDone && (
                      <div
                        className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold"
                        style={{ background: "rgba(201,150,26,0.15)", color: "#c9961a" }}
                      >
                        <Trophy size={11} /> {ALGO_NAMES[summaryResults[0].id]} wins
                      </div>
                    )}
                    {status === "done" && hasCurveData && (
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(window.location.href).then(() => {
                            setShareState("copied");
                            setTimeout(() => setShareState("idle"), 1500);
                          });
                        }}
                        title="Copy a shareable link to this benchmark run"
                        style={btn("secondary", { padding: "2px 8px", fontSize: 9 })}
                      >
                        {shareState === "copied" ? "✓ Copied" : "⎘ Share"}
                      </button>
                    )}
                    {status === "done" && hasCurveData && (
                      <button
                        onClick={exportMarkdown}
                        title="Copy results as markdown table"
                        style={btn("secondary", { padding: "2px 8px", fontSize: 9 })}
                      >
                        {mdCopied ? "✓ Copied" : "⎘ MD"}
                      </button>
                    )}
                    {status === "done" && hasCurveData && (
                      <button
                        onClick={exportCSV}
                        title="Download benchmark data as CSV"
                        style={btn("secondary", { padding: "2px 8px", fontSize: 9 })}
                      >
                        ↓ CSV
                      </button>
                    )}
                    {status === "done" && hasCurveData && (
                      <button
                        onClick={exportReportText}
                        title="Download a plain-text report: top-of-document cross-algorithm summary + comparisons, followed by per-algorithm detail sections in finishing order"
                        style={btn("secondary", { padding: "2px 8px", fontSize: 9 })}
                      >
                        ↓ Report
                      </button>
                    )}
                    {status === "done" && hasCurveData && (
                      <button
                        onClick={() => exportChartPNGRef.current?.()}
                        title="Download chart as PNG"
                        style={btn("secondary", { padding: "2px 8px", fontSize: 9 })}
                      >
                        ↓ PNG
                      </button>
                    )}
                    {hasCurveData && (
                      <button
                        onClick={() => setResultsMaximized(m => !m)}
                        title={resultsMaximized ? "Restore results panel (Esc)" : "Maximize results panel for easier reading"}
                        style={btn("secondary", { padding: "2px 8px", fontSize: 9, color: resultsMaximized ? "var(--color-accent)" : undefined })}
                      >
                        {resultsMaximized ? "⊡ restore" : "⊞ maximize"}
                      </button>
                    )}
                  </div>
                </div>

                <div>
                {/* Tab-hidden warning banner — browsers throttle background-tab
                    timers, so any timing captured while hidden is unreliable.
                    Dismissable so the user can acknowledge and move on. */}
                {tabHiddenDuringRun && status === "done" && (
                  <div
                    className="mt-2"
                    style={{
                      fontSize: 11, fontFamily: "monospace", lineHeight: 1.5,
                      padding: "8px 12px", borderRadius: 6,
                      background: "rgba(255,183,77,0.10)",
                      border: "1px solid rgba(255,183,77,0.55)",
                      color: "#ffb74d",
                      display: "flex", alignItems: "flex-start", gap: 8,
                    }}
                  >
                    <span style={{ flex: 1 }}>
                      <strong style={{ fontWeight: 700 }}>⚠ Tab was backgrounded during this run.</strong>{" "}
                      <span style={{ color: "var(--color-text)" }}>
                        Browsers throttle timer callbacks in hidden tabs, so timings recorded while you
                        were on another tab are likely slower than reality.
                      </span>{" "}
                      <span style={{ color: "var(--color-muted)" }}>
                        Re-run with this tab in the foreground for accurate numbers.
                      </span>
                    </span>
                    <button
                      onClick={() => setTabHiddenDuringRun(false)}
                      title="Dismiss this warning"
                      style={{
                        background: "none", border: "none",
                        color: "#ffb74d", cursor: "pointer", padding: 0, font: "inherit",
                        flexShrink: 0,
                      }}
                    >
                      ✕
                    </button>
                  </div>
                )}
                {/* Failure summary banner — surfaces broken sorts so the user
                    knows the rankings include unreliable results. */}
                {status === "done" && (() => {
                  const failedIds = Object.entries(sampleProofs)
                    .filter(([, p]) => p.failed)
                    .map(([id]) => id);
                  if (failedIds.length === 0) return null;
                  const names = failedIds.map(id => ALGO_NAMES[id] ?? id).join(", ");
                  return (
                    <div
                      className="mt-2"
                      style={{
                        fontSize: 11, fontFamily: "monospace", lineHeight: 1.5,
                        padding: "8px 12px", borderRadius: 6,
                        background: "rgba(239,83,80,0.10)",
                        border: "1px solid rgba(239,83,80,0.55)",
                        color: "#ef5350",
                      }}
                    >
                      <strong style={{ fontWeight: 700 }}>✗ {failedIds.length} sort{failedIds.length === 1 ? "" : "s"} produced out-of-order output:</strong>{" "}
                      <span style={{ color: "var(--color-text)" }}>{names}</span>.
                      <span style={{ color: "var(--color-muted)", marginLeft: 6 }}>
                        Timings for these algorithms are unreliable — the result is not a valid sort.
                      </span>
                    </div>
                  );
                })()}
                {/* Curve chart */}
                {hasCurveData && (
                  <>
                    {/* Time / Space toggle — centered above the chart */}
                    <div className="print:hidden" style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 8, marginBottom: 4, marginTop: 15 }}>
                    <div className="flex rounded overflow-hidden" style={{ border: "1px solid var(--color-border)" }}>
                      {([
                        { id: "time",         label: "time",        title: undefined,                                                              minLevel: "basic" },
                        { id: "space",        label: "space",       title: undefined,                                                              minLevel: "advanced" },
                        { id: "product",      label: "t × s",       title: "Time × Space product — combined cost curve; lower is a better overall tradeoff", minLevel: "advanced" },
                        { id: "ratio",        label: "t / n·log n", title: "Normalize time by n·log₂n — flat = O(n log n)",                       minLevel: "advanced" },
                        { id: "space-ratio",  label: "s / n·log n", title: "Normalize space by n·log₂n — flat = O(n log n) space",                minLevel: "advanced" },
                        { id: "3d",           label: "3D",          title: "Interactive 3D: time × space × n (drag to orbit, scroll to zoom)",    minLevel: "research" },
                        { id: "memory",       label: "Flamegraph",  title: "Space flamegraph: peak space usage per algorithm at each benchmark size n", minLevel: "advanced" },
                      ] as const).filter(m => has(m.minLevel as Parameters<typeof has>[0])).map(m => (
                        <button
                          key={m.id}
                          onClick={() => setChartMode(m.id)}
                          title={m.title}
                          style={btn(chartMode === m.id ? "primary" : "ghost", {
                            padding: "2px 8px", fontSize: 10, borderRadius: 0,
                            background: chartMode === m.id ? "var(--color-accent)" : "var(--color-surface-1)",
                          })}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>

                    {/* Ghost-mode toggle — overlays past runs as faded polylines */}
                    {(() => {
                      const ghostCount = Object.values(ghostRuns).reduce((s, runs) => s + runs.length, 0);
                      return (
                        <div style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                          <button
                            onClick={() => setGhostMode(g => !g)}
                            disabled={ghostCount === 0 && !ghostMode}
                            title={ghostCount === 0
                              ? "No prior runs stored yet — run the benchmark to start building history"
                              : ghostMode
                                ? `Hide ghost overlay (${ghostCount} stored run${ghostCount === 1 ? "" : "s"})`
                                : `Show prior runs as faded curves (${ghostCount} stored run${ghostCount === 1 ? "" : "s"})`}
                            style={{
                              padding: "2px 8px", fontSize: 10,
                              cursor: ghostCount === 0 && !ghostMode ? "not-allowed" : "pointer",
                              opacity: ghostCount === 0 && !ghostMode ? 0.4 : 1,
                              borderRadius: 4,
                              background: ghostMode ? "var(--color-accent-muted)" : "var(--color-surface-1)",
                              border: `1px solid ${ghostMode ? "var(--color-accent)" : "var(--color-border)"}`,
                              color: ghostMode ? "var(--color-accent)" : "var(--color-muted)",
                              fontWeight: ghostMode ? 600 : 400,
                              fontFamily: "monospace",
                            }}
                          >
                            👻 Ghost{ghostCount > 0 ? ` ×${ghostCount}` : ""}
                          </button>
                          {ghostCount > 0 && (
                            <button
                              onClick={() => {
                                if (confirm(`Clear all ${ghostCount} stored ghost run${ghostCount === 1 ? "" : "s"}? This cannot be undone.`)) {
                                  setGhostRuns({});
                                }
                              }}
                              title="Clear ghost history"
                              style={{
                                padding: "2px 6px", fontSize: 10,
                                cursor: "pointer", borderRadius: 4,
                                background: "var(--color-surface-1)",
                                border: "1px solid var(--color-border)",
                                color: "var(--color-muted)",
                                fontFamily: "monospace",
                              }}
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      );
                    })()}
                    </div>{/* end centering wrapper */}

                    {/* 3D chart, memory flamegraph, delta chart, or 2D curve chart */}
                    {chartMode === "memory" ? (
                      <MemoryFlameGraph
                        data={curveDataExt}
                        algos={chartAlgos}
                      />
                    ) : chartMode === "product" ? (() => {
                      // Build a synthetic CurveData where timeMs = timeMs * spaceBytes (product cost)
                      const productData: CurveData = {};
                      for (const id of chartAlgos) {
                        productData[id] = (curveDataExt[id] ?? [])
                          .filter(p => !p.timedOut && p.timeMs > 0 && (p.spaceBytes ?? 0) > 0)
                          .map(p => ({ ...p, timeMs: p.timeMs * p.spaceBytes! }));
                      }
                      return (
                        <>
                          <CurveChart
                            data={productData} sizes={chartSizes}
                            algos={chartAlgos}
                            highlight={activeProofAlgo}
                            activeN={hoverN}
                            onNChange={progressLocked && status === "running" ? undefined : setHoverN}
                            mode="time"
                            onExportReady={fn => { exportChartPNGRef.current = fn; }}
                            advanced={has("advanced")}
                          />
                          <p style={{ fontSize: 9, color: "var(--color-muted)", fontFamily: "monospace", paddingLeft: 60, marginTop: 4 }}>
                            time (ms) × space (bytes) per n — lower = better combined tradeoff · log scale
                          </p>
                        </>
                      );
                    })() : chartMode === "3d" ? (
                      <Chart3D
                        data={curveDataExt}
                        algos={chartAlgos}
                        highlight={activeProofAlgo}
                      />
                    ) : (
                      <>
                        <CurveChart
                          data={curveDataExt} sizes={chartSizes} algos={chartAlgos}
                          highlight={activeProofAlgo}
                          activeN={hoverN}
                          onNChange={progressLocked && status === "running" ? undefined : setHoverN}
                          mode={chartMode as "time" | "space" | "ratio" | "space-ratio"}
                          onExportReady={fn => { exportChartPNGRef.current = fn; }}
                          advanced={has("advanced")}
                          ghostRuns={ghostRuns}
                          ghostMode={ghostMode}
                        />
                        {/* Big-O reference legend — hidden in normalized modes */}
                        {chartMode !== "ratio" && chartMode !== "space-ratio" && (
                          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1" style={{ paddingLeft: 60 }}>
                            {(chartMode === "space" ? SPACE_BIG_O_REFS : BIG_O_REFS).map(ref => (
                              <div key={ref.id} className="flex items-center gap-1">
                                <svg width={16} height={5} style={{ display: "block" }}>
                                  <line x1={0} y1={2.5} x2={16} y2={2.5}
                                    stroke={ref.color} strokeWidth={1.5} strokeDasharray="4 3" />
                                </svg>
                                <span style={{ fontSize: 9, color: "var(--color-muted)", fontFamily: "monospace" }}>
                                  {ref.label}
                                </span>
                              </div>
                            ))}
                            {chartMode === "space" && (
                              <span style={{ fontSize: 9, color: "var(--color-muted)", fontStyle: "italic" }}>
                                measured when performance.memory available; theoretical otherwise
                              </span>
                            )}
                          </div>
                        )}
                        {(chartMode === "ratio" || chartMode === "space-ratio") && (
                          <p style={{ fontSize: 9, color: "var(--color-muted)", fontFamily: "monospace", paddingLeft: 60, marginTop: 4 }}>
                            flat = O(n log n) · rising = super-linear · falling = sub-linear
                            {chartMode === "ratio" ? " · units: ns per element·log₂n" : " · units: bytes per element·log₂n"}
                          </p>
                        )}

                        {/* Live rank panel — updates as you hover/pin */}
                        {hasCurveData && (chartMode === "time" || chartMode === "space") && (
                          <LiveRankPanel
                            data={curveDataExt}
                            algos={chartAlgos}
                            n={hoverN}
                            mode={chartMode as "time" | "space"}
                          />
                        )}

                      </>
                    )}
                  </>
                )}

                {/* Placeholder while first result loads */}
                {!hasCurveData && status === "running" && (
                  <div className="flex items-center justify-center"
                    style={{ height: 230, color: "var(--color-muted)", fontSize: 11 }}>
                    Waiting for first result…
                  </div>
                )}

                {/* Live memory timeline — mirrors the performance curve's
                    styling, plotting V8 heap usage over the run with per-algo
                    colored segments. Visible while running and after, so the
                    user can compare timings against memory pressure. */}
                {(status === "running" || memSamples.length > 0) && (
                  <LiveMemoryChart
                    samples={memSamples}
                    currentAlgo={currentAlgo}
                    currentN={currentN}
                    isRunning={status === "running"}
                    curveData={curveDataExt}
                  />
                )}

                {/* Proof slider */}
                {has("research") && Object.keys(sampleProofs).length > 0 && (
                  <div className="print:hidden">
                    <ProofSlider
                      proofs={sampleProofs} algos={chartAlgos}
                      activeAlgo={activeProofAlgo}
                      onSelect={setActiveProofAlgo}
                      revealed={status === "done"}
                      curveData={curveDataExt}
                    />
                  </div>
                )}

                {/* Legend */}
                {hasCurveData && (
                  <div className="mt-2.5 flex flex-col gap-1.5">
                    <Legend algos={chartAlgos} data={curveDataExt} />
                    {Object.values(curveDataExt).some(pts => pts.some(p => p.timedOut)) && (
                      <p className="text-xs" style={{ color: "var(--color-muted)" }}>
                        <span style={{ borderBottom: "1.5px dashed currentColor" }}>– –</span>
                        {" "}dotted line / ✕ = timed out (&gt;10 s); subsequent sizes skipped
                      </p>
                    )}
                    {chartAlgos.includes("timsort-js") && chartAlgos.includes("timsort") && (
                      <p className="text-xs" style={{ color: "var(--color-muted)" }}>
                        <span style={{ color: ALGO_COLORS["timsort-js"] }}>TimSort (JS)</span>
                        {" "}— pure JavaScript implementation vs{" "}
                        <span style={{ color: ALGO_COLORS["timsort"] }}>Tim Sort (V8)</span>
                        {" "}native C++ .sort(). Gap reflects JS {"<=>"} C++ comparator callback overhead.
                      </p>
                    )}
                  </div>
                )}

                </div>{/* end chart section */}
              </div>
            )}
          </div>

      {/* ── Rankings section ── */}
      {summaryResults.length > 0 && (
        <div
          ref={resultsRef}
          className="px-5 py-4 overflow-x-auto"
          style={{ borderTop: "1px solid var(--color-border)" }}
        >
          <p className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: "var(--color-muted)" }}>
            Rankings
            {largestDone != null && <> · n={largestDone.toLocaleString()}</>}
            {chartSizes.length > 1 && <span style={{ fontWeight: 400, textTransform: "none" }}> (largest)</span>}
          </p>
          {summaryResults.length > 0 && (() => {
            const COL = { bl: "1px solid var(--color-border)", pl: 4 } as const;
            const BAR_W = 40;
            const longestName = Math.max(...tableRows.map(r => {
              if (r.kind === "ref") return r.label.length;
              if (r.id === "timsort-js") return (ALGO_NAMES["timsort-js"] ?? "TimSort (JS)").length;
              return ALGO_NAMES[r.id]?.length ?? 0;
            }));
            const NAME_W = Math.ceil(longestName * 5.5) + 29;
            const getBestSpace = (id: string) => {
              const p = curveDataExt[id]?.find(pt => pt.n === largestDone);
              if (p?.allocBytes && p.allocBytes > 0) return p.allocBytes;
              if (p?.spaceBytes && p.spaceBytes > 0) return p.spaceBytes;
              return largestDone ? theoreticalSpaceBytes(id, largestDone) : 0;
            };
            const spaceFastest = Math.min(
              ...summaryResults.map(r => getBestSpace(r.id)).filter(v => v > 0 && v < Infinity)
            );
            const spaceSlowest = Math.max(...summaryResults.map(r => getBestSpace(r.id)), 1);
            const CW  = 52;
            const CSW = 72;
            const colW = (w: number, i: number): React.CSSProperties => ({
              width: w, flexShrink: 0, textAlign: "center", fontFamily: "monospace",
              borderLeft: i > 0 ? COL.bl : undefined, paddingLeft: i > 0 ? COL.pl : 0, overflow: "hidden",
            });
            const cellHd = (i: number, w = CW): React.CSSProperties => ({
              ...colW(w, i), fontSize: 8, color: "var(--color-muted)",
            });
            const cell = (color: string, i: number, w = CW): React.CSSProperties => ({
              ...colW(w, i), color,
            });
            const handleSort = (col: SortCol) => {
              if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
              else { setSortCol(col); setSortDir("asc"); }
            };
            const sortIcon = (col: SortCol) => sortCol === col ? (sortDir === "asc" ? " ↑" : " ↓") : "";
            const hdBtn = (col: SortCol, i: number, w = CW): React.CSSProperties => ({
              ...cellHd(i, w),
              cursor: "pointer", userSelect: "none", background: "none", border: "none", padding: 0,
              color: sortCol === col ? "var(--color-text)" : "var(--color-muted)",
            });
            const algoSortKeys = new Map(summaryResults.map(r => {
              const sv = getBestSpace(r.id);
              const sr = sv > 0 && spaceFastest > 0 && spaceFastest < Infinity ? sv / spaceFastest : 0;
              const tp = (curveDataExt[r.id] ?? []).filter(p => p.timeMs > 0).map(p => ({ n: p.n, val: p.timeMs }));
              const sp = (curveDataExt[r.id] ?? []).filter(p => (p.allocBytes ?? p.spaceBytes ?? 0) > 0).map(p => ({ n: p.n, val: p.allocBytes ?? p.spaceBytes! }));
              const tf = fitLogLog(tp);
              const sf = fitLogLog(sp);
              return [r.id, {
                spaceVal: sv, spaceRatio: sr,
                tLabel: tf?.label ?? (ALGO_TIME[r.id]?.replace(/^O\(/, "").replace(/\)$/, "").replace(/ log n/g, "logn") ?? ""),
                sLabel: sf?.label ?? (ALGO_SPACE[r.id]?.replace(/^O\(/, "").replace(/\)$/, "").replace(/ log n/g, "logn") ?? ""),
                fitK: tf?.k,
              }];
            }));
            const algoName = (id: string) => ALGO_NAMES[id] ?? id;
            const sortedAlgoRows = [...summaryResults.map(r => ({ ...r, kind: "algo" as const }))].sort((a, b) => {
              const ak = algoSortKeys.get(a.id)!;
              const bk = algoSortKeys.get(b.id)!;
              let cmp = 0;
              switch (sortCol) {
                case "name":  cmp = algoName(a.id).localeCompare(algoName(b.id)); break;
                case "speed":
                case "time":  cmp = a.timeMs - b.timeMs; break;
                case "tvsb":  cmp = a.timeMs - b.timeMs; break;
                case "tbigo": cmp = ak.tLabel.localeCompare(bk.tLabel); break;
                case "fit":   cmp = (ak.fitK ?? 0) - (bk.fitK ?? 0); break;
                case "space": cmp = ak.spaceVal - bk.spaceVal; break;
                case "svsb":  cmp = ak.spaceRatio - bk.spaceRatio; break;
                case "sbigo": cmp = ak.sLabel.localeCompare(bk.sLabel); break;
              }
              return sortDir === "asc" ? cmp : -cmp;
            });
            const sortedTableRows: TableRow[] = [
              ...sortedAlgoRows,
              ...refRows.sort((a, b) => a.timeMs - b.timeMs),
            ];
            return (
              <div style={{ fontSize: 10 }}>
                <div className="flex items-center mb-1.5">
                  <button onClick={() => handleSort("name")} style={{ width: NAME_W, flexShrink: 0, textAlign: "left", fontSize: 8, fontFamily: "monospace", cursor: "pointer", userSelect: "none", background: "none", border: "none", padding: "0 4px 0 18px", color: sortCol === "name" ? "var(--color-text)" : "var(--color-muted)" }}>
                    name{sortIcon("name")}
                  </button>
                  <button onClick={() => handleSort("speed")} style={{ width: BAR_W, flexShrink: 0, textAlign: "center", fontSize: 8, fontFamily: "monospace", cursor: "pointer", userSelect: "none", background: "none", border: "none", padding: 0, color: sortCol === "speed" ? "var(--color-text)" : "var(--color-muted)" }}>
                    speed{sortIcon("speed")}
                  </button>
                  <button onClick={() => handleSort("space")} style={{ width: BAR_W, flexShrink: 0, textAlign: "center", fontSize: 8, fontFamily: "monospace", cursor: "pointer", userSelect: "none", background: "none", border: "none", padding: 0, color: sortCol === "space" ? "var(--color-text)" : "var(--color-muted)" }}>
                    space{sortIcon("space")}
                  </button>
                  <div style={{ display: "flex", borderLeft: COL.bl }}>
                    <button style={hdBtn("time",  0)}      onClick={() => handleSort("time")}>time{sortIcon("time")}</button>
                    <button style={hdBtn("tvsb",  1)}      onClick={() => handleSort("tvsb")}>t vs best{sortIcon("tvsb")}</button>
                    <button style={hdBtn("tbigo", 1)}      onClick={() => handleSort("tbigo")}>t big O{sortIcon("tbigo")}</button>
                    <button style={hdBtn("fit",   1)}      onClick={() => handleSort("fit")} title="Empirically fitted exponent k (time ∝ nᵏ)">fit nᵏ{sortIcon("fit")}</button>
                    <div style={cellHd(1)}                 title="Coefficient of variation across the last GHOST_MAX runs at this n. Low (<5%) = rock-steady; medium (5–15%) = some jitter; high (>15%) = noisy or thermally-throttled. Needs ≥2 ghost runs at this n to compute.">stab.</div>
                    <div style={cellHd(1)}                 title="Working-set cache level at the largest measured n">cache</div>
                    <button style={hdBtn("space", 1, CSW)} onClick={() => handleSort("space")}>space{sortIcon("space")}</button>
                    <button style={hdBtn("svsb",  1)}      onClick={() => handleSort("svsb")}>s vs best{sortIcon("svsb")}</button>
                    <button style={hdBtn("sbigo", 1)}      onClick={() => handleSort("sbigo")}>s big O{sortIcon("sbigo")}</button>
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  {largestDone !== null && (() => {
                    const timedOutRows = (runConfig?.algos ?? []).filter(id =>
                      curveDataExt[id]?.some(p => p.n === largestDone && p.timedOut)
                    );
                    if (timedOutRows.length === 0) return null;
                    return timedOutRows.map(id => {
                      const safePts = (curveDataExt[id] ?? []).filter(p => !p.timedOut && p.timeMs > 0).map(p => ({ n: p.n, val: p.timeMs }));
                      const fit = fitLogLog(safePts);
                      const timedN = curveDataExt[id]?.find(p => p.n === largestDone && p.timedOut)?.n;
                      const estMs = fit ? fit.k * fit.fn(largestDone) : null;
                      const dotColor = ALGO_COLORS[id] ?? "#888";
                      return (
                        <div key={`timed-${id}`} className="flex items-center" style={{ opacity: 0.5 }}>
                          <div className="flex items-center gap-1.5" style={{ width: NAME_W, flexShrink: 0, paddingRight: 4 }}>
                            <span className="font-mono" style={{ width: 14, textAlign: "right", flexShrink: 0, color: "var(--color-muted)" }}>—</span>
                            <span style={{ width: 5, height: 5, borderRadius: "50%", background: dotColor, flexShrink: 0, display: "inline-block" }} />
                            <span className="min-w-0 flex flex-col leading-tight">
                              <span className="truncate" style={{ color: "var(--color-text)" }}>{ALGO_NAMES[id]}</span>
                              <span style={{ fontSize: 8, color: "var(--color-state-swap)" }}>timed out at n={timedN != null ? fmtN(timedN) : "?"}</span>
                            </span>
                          </div>
                          <div style={{ width: BAR_W, flexShrink: 0, padding: "0 5px", display: "flex", alignItems: "center" }}>
                            <div style={{ flex: 1, borderRadius: 3, overflow: "hidden", background: "var(--color-surface-3)", height: 8 }}>
                              <div style={{ width: "100%", height: "100%", borderRadius: 3, background: "var(--color-state-swap)", opacity: 0.4 }} />
                            </div>
                          </div>
                          <div style={{ width: BAR_W, flexShrink: 0 }} />
                          <div style={{ display: "flex", borderLeft: COL.bl }}>
                            <div style={cell("var(--color-state-swap)", 0)} title={estMs != null ? `Extrapolated from fit on non-timed-out points` : "Not enough data to estimate"}>
                              {estMs != null ? `~${fmtPredicted(estMs)}` : ">10 s"}
                            </div>
                            <div style={cell("var(--color-muted)", 1)}>{estMs != null ? `${(estMs / summaryFastest).toFixed(0)}×` : "—"}</div>
                            <div style={cell("var(--color-muted)", 1)}>{ALGO_TIME[id]?.replace(/^O\(/, "").replace(/\)$/, "").replace(/ log n/g, "logn") ?? "—"}</div>
                            <div style={cell("var(--color-muted)", 1)}>{fit?.label ?? "—"}</div>
                            <div style={cell("var(--color-muted)", 1)} title="No CoV: the algo timed out and isn't sampled in ghost runs at this n">—</div>
                            <div style={cell("var(--color-muted)", 1)}>—</div>
                            <div style={cell("var(--color-muted)", 1, CSW)}>—</div>
                            <div style={cell("var(--color-muted)", 1)}>—</div>
                            <div style={cell("var(--color-muted)", 1)}>—</div>
                          </div>
                        </div>
                      );
                    });
                  })()}
                  {sortedTableRows.map((row) => {
                    if (row.kind === "ref") {
                      const barPct    = Math.min(100, summarySlowest > 0 ? (row.timeMs / summarySlowest) * 100 : 0);
                      const overScale = row.timeMs > summarySlowest;
                      return (
                        <div key={`ref-${row.label}`} className="flex items-center" style={{ opacity: 0.6 }}>
                          <div className="flex items-center gap-1.5" style={{ width: NAME_W, flexShrink: 0, paddingRight: 4 }}>
                            <span className="font-mono" style={{ width: 14, textAlign: "right", flexShrink: 0, color: "var(--color-muted)" }}>—</span>
                            <span className="font-mono italic truncate" style={{ color: row.color }}>{row.label}</span>
                          </div>
                          <div style={{ width: BAR_W, flexShrink: 0, padding: "0 5px", display: "flex", alignItems: "center" }}>
                            <div style={{ flex: 1, borderRadius: 3, overflow: "hidden", background: "var(--color-surface-3)", height: 8 }}>
                              <div style={{ width: `${overScale ? 100 : barPct}%`, height: "100%", borderRadius: 3, minWidth: 3, background: row.color, opacity: 0.4, backgroundImage: "repeating-linear-gradient(90deg, transparent, transparent 4px, rgba(0,0,0,0.25) 4px, rgba(0,0,0,0.25) 5px)" }} />
                            </div>
                          </div>
                          <div style={{ width: BAR_W, flexShrink: 0, padding: "0 5px", display: "flex", alignItems: "center" }}>
                            <div style={{ flex: 1, borderRadius: 3, background: "var(--color-surface-3)", height: 8 }} />
                          </div>
                          <div style={{ display: "flex", borderLeft: COL.bl }}>
                            <div style={cell(row.color, 0)}>{overScale ? "↑" : ""}{fmtPredicted(row.timeMs)}</div>
                            <div style={cell("var(--color-muted)", 1)}>{(row.timeMs / summaryFastest).toFixed(1)}×</div>
                            <div style={cell("var(--color-muted)", 1)}>{row.label.replace(/^O\(/, "").replace(/\)$/, "").replace(/ log n/g, "logn")}</div>
                            <div style={cell("var(--color-muted)", 1)}>—</div>
                            <div style={cell("var(--color-muted)", 1)} title="Reference rows are projected, not measured — no CoV applies">—</div>
                            <div style={cell("var(--color-muted)", 1)}>—</div>
                            <div style={cell("var(--color-muted)", 1, CSW)}>—</div>
                            <div style={cell("var(--color-muted)", 1)}>—</div>
                            <div style={cell("var(--color-muted)", 1)}>—</div>
                          </div>
                        </div>
                      );
                    }
                    const barPct     = summarySlowest > 0 ? (row.timeMs / summarySlowest) * 100 : 0;
                    const rankClr    = rankColor(row.rank, summaryResults.length);
                    const dotColor   = ALGO_COLORS[row.id];
                    const pt             = curveDataExt[row.id]?.find(p => p.n === largestDone);
                    const spaceVal       = pt?.spaceBytes;
                    const allocVal       = pt?.allocBytes;
                    const spaceIsMeasured = spaceVal != null && spaceVal > 0;
                    const allocIsMeasured = allocVal != null && allocVal > 0;
                    const spaceTheo      = largestDone != null ? theoreticalSpaceBytes(row.id, largestDone) : null;
                    const spaceForChart  = allocIsMeasured ? allocVal! : spaceIsMeasured ? spaceVal! : (spaceTheo ?? 0);
                    const spaceRatio = spaceForChart > 0 && spaceFastest > 0 && spaceFastest < Infinity ? spaceForChart / spaceFastest : null;
                    const timeStr    = fmtTime(row.timeMs);
                    const spRatioStr = spaceRatio != null ? (spaceRatio < 1.05 ? "—" : `${spaceRatio.toFixed(1)}×`) : "—";
                    const timePts  = (curveDataExt[row.id] ?? []).filter(p => p.timeMs > 0).map(p => ({ n: p.n, val: p.timeMs }));
                    const spacePts = (curveDataExt[row.id] ?? []).filter(p => (p.allocBytes ?? p.spaceBytes ?? 0) > 0).map(p => ({ n: p.n, val: p.allocBytes ?? p.spaceBytes! }));
                    const timeFit  = fitLogLog(timePts);
                    const spaceFit = fitLogLog(spacePts);
                    const tBigOLabel = timeFit?.label ?? (ALGO_TIME[row.id]?.replace(/^O\(/, "").replace(/\)$/, "").replace(/ log n/g, "logn") ?? "—");
                    const sBigOLabel = spaceFit?.label ?? (ALGO_SPACE[row.id]?.replace(/^O\(/, "").replace(/\)$/, "").replace(/ log n/g, "logn") ?? "—");
                    const tPct = largestDone != null && timeFit ? timeFit.pctAt(largestDone, row.timeMs) : null;
                    const sPct = largestDone != null && spaceFit && spaceVal ? spaceFit.pctAt(largestDone, spaceVal) : null;
                    const isHoverT = hoverBigO?.id === row.id && hoverBigO.type === "time";
                    const isHoverS = hoverBigO?.id === row.id && hoverBigO.type === "space";
                    const fmtPct = (pct: number) => `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`;
                    const canDl    = largestDone != null;
                    const handleDl = () => {
                      if (!largestDone) return;
                      const n = largestDone;
                      const spaceClz = ALGO_SPACE[row.id] ?? "unknown";
                      let spaceBreakdown: Record<string, unknown>;
                      if (spaceClz === "O(1)") {
                        spaceBreakdown = { class: "O(1) — constant", explanation: "In-place sort. Uses only a fixed number of scalar variables regardless of n.", constant_overhead_bytes: 200 };
                      } else if (spaceClz === "O(log n)") {
                        const depth = Math.ceil(Math.log2(Math.max(n, 2)));
                        spaceBreakdown = { class: "O(log n) — logarithmic", explanation: `Max call stack depth = ⌈log₂(${n})⌉ = ${depth} frames. Each frame ~64 bytes.`, max_recursion_depth: depth, bytes_per_frame: 64, total_bytes: depth * 64 };
                      } else if (spaceClz === "O(n)") {
                        spaceBreakdown = { class: "O(n) — linear", explanation: `Auxiliary array of n elements. ${n.toLocaleString()} × 8 bytes = ${(n * 8).toLocaleString()} bytes.`, auxiliary_elements: n, bytes_per_element: 8, total_bytes: n * 8 };
                      } else {
                        spaceBreakdown = { class: spaceClz, explanation: "See algorithm documentation.", theoretical_bytes: theoreticalSpaceBytes(row.id, n) };
                      }
                      const sampleCount = Math.min(Math.ceil(n * 0.05), 25);
                      const inputSample = generateBenchmarkInput(sampleCount, "random");
                      const sortedSample = SORT_FNS[row.id]?.([...inputSample]) ?? [...inputSample].sort((a, b) => a - b);
                      const proof = { proof_type: "space_complexity_verification", algorithm: ALGO_NAMES[row.id], n, time_complexity: ALGO_TIME[row.id], space_complexity: spaceClz, space_breakdown: spaceBreakdown, measured_heap_delta_bytes: (spaceVal != null && spaceVal > 0) ? spaceVal : null, theoretical_bytes: theoreticalSpaceBytes(row.id, n), input_sample: { note: `${sampleCount} of ${n.toLocaleString()} elements (${sampleCount === 25 ? "capped at 25" : "5%"}). Uniform integers in [0, 10 000).`, count: sampleCount, values: inputSample, sorted: sortedSample }, generated_at: new Date().toISOString() };
                      const blob = new Blob([JSON.stringify(proof, null, 2)], { type: "application/json" });
                      const url  = URL.createObjectURL(blob);
                      const a    = document.createElement("a");
                      a.href = url; a.download = `space-proof-${row.id}-n${n}.json`; a.click();
                      URL.revokeObjectURL(url);
                    };
                    return (
                      <div key={row.id} className="flex items-center">
                        <div className="flex items-center gap-1.5" style={{ width: NAME_W, flexShrink: 0, paddingRight: 4 }}>
                          <span className="font-mono" style={{ width: 14, textAlign: "right", flexShrink: 0, color: rankClr }}>{row.rank}</span>
                          <span style={{ width: 5, height: 5, borderRadius: "50%", background: dotColor, flexShrink: 0, display: "inline-block" }} />
                          <span className="min-w-0 flex flex-col leading-tight">
                            <WithAlgoTooltip id={row.id}>
                              <span className="truncate flex items-center gap-1" style={{
                                color: sampleProofs[row.id]?.failed ? "#ef5350" : "var(--color-text)",
                                fontWeight: row.rank === 1 ? 600 : 400,
                                textDecoration: sampleProofs[row.id]?.failed ? "line-through" : "none",
                                textDecorationColor: "rgba(239,83,80,0.55)",
                              }}>
                                {ALGO_NAMES[row.id]}
                                {wasmExecutedAlgos.has(row.id) && (
                                  <span title={`This algorithm ran via the AssemblyScript-compiled Wasm module (int32 port). Marshalling cost is included in the timing.`} style={{
                                    fontSize: 6, fontWeight: 700, fontFamily: "monospace",
                                    padding: "0px 3px", borderRadius: 2, whiteSpace: "nowrap",
                                    background: "rgba(124,106,247,0.18)",
                                    border: "1px solid rgba(124,106,247,0.55)",
                                    color: "var(--color-accent)", textDecoration: "none",
                                    flexShrink: 0,
                                  }}>
                                    Wasm
                                  </span>
                                )}
                                {webgpuExecutedAlgos.has(row.id) && (
                                  <span title={`This algorithm ran via a WebGPU compute pipeline (int32). Buffer copy-in / copy-out cost is included in the timing.`} style={{
                                    fontSize: 6, fontWeight: 700, fontFamily: "monospace",
                                    padding: "0px 3px", borderRadius: 2, whiteSpace: "nowrap",
                                    background: "rgba(34,197,194,0.18)",
                                    border: "1px solid rgba(34,197,194,0.55)",
                                    color: "#0e9b96", textDecoration: "none",
                                    flexShrink: 0,
                                  }}>
                                    GPU
                                  </span>
                                )}
                                {sampleProofs[row.id]?.failed && (
                                  <span title={`Sort produced out-of-order output (sample index ${sampleProofs[row.id].badIdx}). Result is unreliable.`} style={{
                                    fontSize: 6, fontWeight: 700, fontFamily: "monospace",
                                    padding: "0px 3px", borderRadius: 2, whiteSpace: "nowrap",
                                    background: "rgba(239,83,80,0.18)",
                                    border: "1px solid rgba(239,83,80,0.55)",
                                    color: "#ef5350", textDecoration: "none",
                                    flexShrink: 0,
                                  }}>
                                    ✗ BROKEN
                                  </span>
                                )}
                              </span>
                            </WithAlgoTooltip>
                            {has("research") && largestDone != null && (
                              <button title={`Load worst-case input for ${ALGO_NAMES[row.id]}`} onClick={() => { const arr = makeAdversarialInput(row.id, Math.min(largestDone, 100)); alert(`Adversarial input for ${ALGO_NAMES[row.id]} (n=${Math.min(largestDone, 100)}):\n[${arr.slice(0,20).join(", ")}${arr.length > 20 ? "..." : ""}]`); }} style={{ fontSize: 7, padding: "0px 4px", borderRadius: 2, cursor: "pointer", background: "rgba(239,83,80,0.1)", border: "1px solid rgba(239,83,80,0.25)", color: "#ef5350", marginTop: 1 }}>⚠ worst</button>
                            )}
                          </span>
                        </div>
                        <div style={{ width: BAR_W, flexShrink: 0, padding: "0 5px", display: "flex", alignItems: "center" }}>
                          <div style={{ flex: 1, borderRadius: 3, overflow: "hidden", background: "var(--color-surface-3)", height: 8 }}>
                            <div style={{ width: `${barPct}%`, height: "100%", borderRadius: 3, minWidth: barPct > 0 ? 3 : 0, background: dotColor, opacity: 0.85, transition: "width 0.35s ease" }} />
                          </div>
                        </div>
                        <div style={{ width: BAR_W, flexShrink: 0, padding: "0 5px", display: "flex", alignItems: "center" }}>
                          <div style={{ flex: 1, borderRadius: 3, overflow: "hidden", background: "var(--color-surface-3)", height: 8 }}>
                            <div style={{ width: `${spaceForChart > 0 ? Math.min(100, (spaceForChart / spaceSlowest) * 100) : 0}%`, height: "100%", borderRadius: 3, minWidth: spaceForChart > 0 ? 3 : 0, background: dotColor, opacity: 0.5, transition: "width 0.35s ease" }} />
                          </div>
                        </div>
                        <div style={{ display: "flex", borderLeft: COL.bl }}>
                          <div style={cell(rankClr, 0)}>
                            <span>{timeStr}</span>
                            {has("advanced") && row.meanMs != null && (
                              <span style={{ display: "block", fontSize: 7, color: "var(--color-muted)", marginTop: 1 }}>μ {fmtTime(row.meanMs)}{row.stdDev != null ? ` ±${fmtTime(row.stdDev)}` : ""}</span>
                            )}
                          </div>
                          {/* "× slower than 1st place" multiplier. The winner gets
                              "0×" (zero times slower than itself) so the column's
                              text width is consistent across all rows — previous
                              "—" was one character and broke visual alignment. */}
                          <div style={cell("var(--color-muted)", 1)}>{row.rank === 1 ? "0×" : `${(row.timeMs / summaryFastest).toFixed(1)}×`}</div>
                          <div style={{ ...cell("var(--color-text)", 1), opacity: 0.75, cursor: "default" }} title={ALGO_TIME[row.id]} onMouseEnter={() => setHoverBigO({ id: row.id, type: "time" })} onMouseLeave={() => setHoverBigO(null)}>
                            {isHoverT && tPct !== null ? fmtPct(tPct) : tBigOLabel}
                          </div>
                          <div style={{ ...cell("var(--color-muted)", 1), opacity: 0.8, cursor: "default" }} title={timeFit ? `Empirical fit: time ∝ n^${timeFit.k.toFixed(3)} (log-log regression)` : "Not enough data to fit"}>
                            {timeFit ? `n${toSup(timeFit.k.toFixed(2))}` : "—"}
                          </div>
                          {/* stab. column — coefficient of variation across the
                              algo's last GHOST_MAX ghost runs at this n. Reads
                              every stored run's points[] for matches, builds the
                              sample vector, returns CoV%. Color tiers: green
                              <5%, amber 5-15%, red ≥15%. Falls through to "—"
                              when fewer than 2 runs have a point at this n. */}
                          {(() => {
                            if (!largestDone) return <div style={cell("var(--color-muted)", 1)} title="No completed n to evaluate stability at yet">—</div>;
                            const samples: number[] = [];
                            for (const run of (ghostRuns[row.id] ?? [])) {
                              for (const p of run.points) {
                                if (p.n === largestDone && p.timeMs > 0) {
                                  samples.push(p.timeMs);
                                  break; // one sample per run per n
                                }
                              }
                            }
                            if (samples.length < 2) {
                              return <div style={cell("var(--color-muted)", 1)} title={`Need ≥2 ghost runs at n=${largestDone.toLocaleString()} (have ${samples.length})`}>—</div>;
                            }
                            const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
                            if (mean <= 0) return <div style={cell("var(--color-muted)", 1)} title="Mean ≤0 — can't compute CoV">—</div>;
                            // Sample stdev (Bessel's correction — n-1 in denominator).
                            const variance = samples.reduce((s, x) => s + (x - mean) ** 2, 0) / (samples.length - 1);
                            const std = Math.sqrt(variance);
                            const cov = (std / mean) * 100;
                            const color = cov < 5 ? "#4db6ac" : cov < 15 ? "#ffb74d" : "#ef5350";
                            const label = cov < 5 ? "stable" : cov < 15 ? "jittery" : "noisy";
                            return (
                              <div
                                style={cell(color, 1)}
                                title={`CoV = ${cov.toFixed(1)}% across ${samples.length} ghost run${samples.length !== 1 ? "s" : ""} at n=${largestDone.toLocaleString()} (mean ${fmtTime(mean)}, σ ${fmtTime(std)}) — ${label}`}
                              >
                                {cov.toFixed(0)}%
                              </div>
                            );
                          })()}
                          {(() => {
                            if (!largestDone) return <div style={cell("var(--color-muted)", 1)}>—</div>;
                            const cl = cacheLevel(row.id, largestDone);
                            return <div style={cell(cl.color, 1)} title={`Array of ${largestDone.toLocaleString()} × 8B = ${fmtBytes(largestDone * 8)} working set → ${cl.label}`}>{cl.label}</div>;
                          })()}
                          <div style={{ ...cell("var(--color-text)", 1, CSW), opacity: 0.75 }} title={`aux ${ALGO_SPACE[row.id] ?? "—"} · total ${totalSpaceLabel(row.id)}`}>
                            <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 1 }}>
                              <span style={{ color: allocIsMeasured ? "#4db6ac" : "var(--color-muted)", fontFamily: "monospace", fontSize: "inherit" }} title="Auxiliary alloc: bytes counted via patched Array + typed-array constructors">
                                {allocIsMeasured ? fmtBytes(allocVal!) : "—"} <span style={{ fontSize: 7 }}>aux</span>
                              </span>
                              {(() => {
                                // Use heapDeltaBytes (real measurement only)
                                // rather than spaceVal (which can carry a
                                // theoretical estimate that'd false-flag the
                                // verdict for unknown / custom sorts).
                                const v = inPlaceVerdict(allocVal, pt?.heapDeltaBytes, largestDone ?? 0);
                                if (!v) return null;
                                return (
                                  <span title={v.title} style={{ fontSize: 7, fontFamily: "monospace", fontWeight: 700, padding: "0 5px", borderRadius: 8, background: v.bg, color: v.color, cursor: "help" }}>
                                    {v.label}
                                  </span>
                                );
                              })()}
                              {allocIsMeasured && largestDone != null && (
                                <span style={{ fontSize: 7, fontFamily: "monospace", color: "#80cbc4", opacity: 0.85 }} title={`Total: auxiliary (${fmtBytes(allocVal!)}) + input (${fmtBytes(largestDone * 8)})`}>
                                  {fmtBytes(allocVal! + largestDone * 8)} total
                                </span>
                              )}
                              <span style={{ fontSize: 7, fontFamily: "monospace", color: spaceIsMeasured ? "#ffb74d" : "var(--color-muted)", opacity: 0.85 }} title="V8 heap delta (unreliable for fast sorts)">
                                {spaceIsMeasured ? fmtBytes(spaceVal!) : "—"} heap Δ
                              </span>
                              <span style={{ fontSize: 7, fontFamily: "monospace", color: "var(--color-muted)", opacity: 0.7 }} title="Theoretical auxiliary: worst-case estimate from Big-O class">
                                {spaceTheo != null ? fmtBytes(spaceTheo) : "—"} est. aux
                                {canDl && has("research") && (
                                  <> · <a onClick={handleDl} style={{ color: "var(--color-accent)", cursor: "pointer", textDecoration: "underline" }} title="Download space proof JSON">proof</a></>
                                )}
                              </span>
                            </span>
                          </div>
                          <div style={cell("var(--color-muted)", 1)}>{spRatioStr}</div>
                          <div style={{ ...cell("var(--color-text)", 1), opacity: 0.75, cursor: "default" }} title={ALGO_SPACE[row.id]} onMouseEnter={() => setHoverBigO({ id: row.id, type: "space" })} onMouseLeave={() => setHoverBigO(null)}>
                            {isHoverS && sPct !== null ? fmtPct(sPct) : sBigOLabel}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
          {status === "done" && summaryResults.length >= 2 && (
            <PairMatrix results={summaryResults} spaceResults={summarySpaceResults} />
          )}
        </div>
      )}

      {/* ── Time complexity section ── */}
      {has("advanced") && (chartMode === "time" || chartMode === "space") && status === "done" && (
        <div className="px-5 py-4" style={{ borderTop: "1px solid var(--color-border)" }}>
          <p className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: "var(--color-muted)" }}>Time Complexity Analysis</p>
          <MathPanel
            data={curveDataExt}
            algos={chartAlgos}
            mode={chartMode}
            sampleProofs={sampleProofs}
          />
        </div>
      )}

      {/* ── All Algorithms section ──
          Lives at the bottom of the right pane: once a user has scanned the
          chart + rankings + complexity analysis, this is the catch-all
          per-algorithm grid (mini cards with sparklines + memory mass). */}
      {chartAlgosBase.length > 0 && (
        <div
          className="px-5 py-6"
          style={{ borderTop: "1px solid var(--color-border)" }}
        >
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-muted)" }}>
              All Algorithms
            </p>
            <div className="flex items-center gap-1.5">
              <span className="text-xs" style={{ color: "var(--color-muted)" }}>Sort by:</span>
              <div className="flex rounded overflow-hidden" style={{ border: "1px solid var(--color-border)" }}>
                {(["time", "space", "both"] as const).map(mode => (
                  <button
                    key={mode}
                    onClick={() => setMiniCardSort(mode)}
                    className="text-xs px-2 py-0.5"
                    style={{
                      background: miniCardSort === mode ? "var(--color-accent)" : "var(--color-surface-1)",
                      color: miniCardSort === mode ? "#fff" : "var(--color-muted)",
                      border: "none", cursor: "pointer", fontWeight: miniCardSort === mode ? 600 : 400,
                    }}
                  >
                    {mode === "time" ? "Time" : mode === "space" ? "Space" : "Both"}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {(() => {
            const sortedCards = [...chartAlgosBase].sort((a, b) => {
              const rankOf = (id: string): number | null => {
                const rt = summaryResults.find(r => r.id === id)?.rank ?? null;
                const rs = summarySpaceResults.find(r => r.id === id)?.rank ?? null;
                if (miniCardSort === "time")  return rt;
                if (miniCardSort === "space") return rs;
                if (rt != null && rs != null) return (rt + rs) / 2;
                return rt ?? rs ?? null;
              };
              const ra = rankOf(a), rb = rankOf(b);
              if (ra != null && rb != null) return ra - rb;
              if (ra != null) return -1;
              if (rb != null) return 1;
              const bgoA = BIG_O_RANK[miniCardSort === "space" ? (ALGO_SPACE[a] ?? "") : (ALGO_TIME[a] ?? "")] ?? 99;
              const bgoB = BIG_O_RANK[miniCardSort === "space" ? (ALGO_SPACE[b] ?? "") : (ALGO_TIME[b] ?? "")] ?? 99;
              return bgoA - bgoB;
            });
            const maxSpaceBytes = Math.max(
              ...chartAlgosBase.map(id => {
                const pts = (curveDataExt[id] ?? []).filter(p => !p.timedOut);
                return pts.sort((a, b) => b.n - a.n)[0]?.spaceBytes ?? 0;
              }), 1
            );
            const maxTotalSteps = Math.max(
              ...chartAlgosBase.map(id => prerunSteps[id]?.length ?? 0), 1
            );
            return (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-2">
                {sortedCards.map(id => (
                  <AlgoMiniCard
                    key={id}
                    id={id}
                    steps={prerunSteps[id] ?? null}
                    benchData={curveDataExt[id] ?? null}
                    isActive={status === "running" && currentAlgo === id}
                    rank={summaryResults.find(r => r.id === id)?.rank ?? null}
                    spaceRank={miniCardSort !== "time" ? (summarySpaceResults.find(r => r.id === id)?.rank ?? null) : null}
                    showBoth={miniCardSort === "both"}
                    loop={status === "running"}
                    maxSpaceBytes={maxSpaceBytes}
                    maxTotalSteps={maxTotalSteps}
                    onStop={status === "running" ? () => stopAlgo(id) : undefined}
                    failed={sampleProofs[id]?.failed}
                    wasmExecuted={wasmExecutedAlgos.has(id)}
                    webgpuExecuted={webgpuExecutedAlgos.has(id)}
                    pulseEnabled={pulseEnabled}
                    onTogglePulse={togglePulse}
                  />
                ))}
              </div>
            );
          })()}
        </div>
      )}
        </div>

      </div>

      </div>{/* end benchmark section */}

      {/* ── Live running dashboard — consolidated status + sparklines ── */}
      {status === "running" && (
        <RunningDashboard
          algos={runConfig?.algos ?? activeAlgos}
          currentAlgo={currentAlgo}
          currentN={currentN}
          progress={progress}
          curveData={curveData}
          memSamples={memSamples}
          configLine={`${[...scenarios].join(", ")} · ${rounds} round${rounds !== 1 ? "s" : ""} · ${warmup} warm-up${polymorphicMode ? " · polymorphic (int+float+string)" : (useWorkerIsolation ? " · worker isolation" : "")}${adversarialEnabled ? " · adversarial" : ""}${engine === "wasm" && wasmBundle != null ? " · engine: Wasm" : ""}${engine === "webgpu" && webgpuBundle?.ready ? " · engine: WebGPU" : ""}`}
          algoNames={ALGO_NAMES}
          algoColors={ALGO_COLORS}
          onStop={stop}
          stopPending={stopPending}
          tabHidden={tabHiddenDuringRun}
          workerIsolation={useWorkerIsolation}
          runStartedAt={runStartedAt}
          notifyOnDone={notifyOnDone}
          onToggleNotify={toggleNotifyOnDone}
        />
      )}

      {/* ── Floating Run panel ──
          Sits in the same bottom-right slot as RunningDashboard but is only
          visible while idle/done. The two swap based on `status`: idle → Run,
          running → live dashboard with a Stop button, done → Re-run + Reset.
          Hidden on print and on the mobile sticky-bar viewport size (the
          mobile bar at the bottom of the page already covers Run/Stop). */}
      {status !== "running" && (
        <div
          className="hidden lg:flex print:hidden fixed lg:right-4 lg:bottom-4 z-40 flex-col gap-1 rounded-xl"
          style={{
            background: "color-mix(in srgb, var(--color-surface-1) 96%, transparent)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            border: "1px solid var(--color-border)",
            boxShadow: "0 12px 40px -8px rgba(0,0,0,0.45)",
            padding: "10px 12px",
            minWidth: 240,
          }}
        >
          <div className="flex gap-1.5">
            <button
              onClick={() => run()}
              disabled={!canRun}
              style={btn("primary", { padding: "6px 14px", flex: 1, justifyContent: "center", fontSize: 12, opacity: canRun ? 1 : 0.5, cursor: canRun ? "pointer" : "not-allowed" })}
            >
              <Play size={12} strokeWidth={2} />
              {status === "done" ? "Re-run" : "Run"}
            </button>
            {status === "done" && (
              <button onClick={reset} style={btn("secondary", { padding: "6px 12px", fontSize: 12 })}>
                <RotateCcw size={12} strokeWidth={1.75} /> Reset
              </button>
            )}
          </div>
          {/* One-line summary so the user can verify what's about to run
              without bouncing back to the config card on the left. */}
          <div className="text-[9px] mt-1" style={{ color: "var(--color-muted)", fontFamily: "monospace", lineHeight: 1.4 }}>
            {canRun ? (
              <>
                {(activeAlgos.length + enabledSavedSorts.length)} algo{(activeAlgos.length + enabledSavedSorts.length) !== 1 ? "s" : ""}
                {" · "}
                n={sortedSizes.length === 0 ? "—" : sortedSizes.length === 1 ? fmtN(sortedSizes[0]) : `${fmtN(sortedSizes[0])}…${fmtN(sortedSizes[sortedSizes.length - 1])}`}
                {" · "}
                {rounds}× · {engine === "wasm" && wasmBundle ? "Wasm" : engine === "webgpu" && webgpuBundle?.ready ? "WebGPU" : "V8"}
              </>
            ) : (
              <span style={{ color: "#ef5350" }}>
                {activeAlgos.length + enabledSavedSorts.length === 0
                  ? "select at least one algorithm"
                  : selectedSizes.size === 0
                    ? "select at least one input size"
                    : scenarios.size === 0
                      ? "select at least one scenario"
                      : "not ready"}
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── Mobile sticky run/stop bar ── */}
      <div
        className="lg:hidden print:hidden fixed bottom-0 left-0 right-0 flex gap-2 px-4 py-3"
        style={{
          background: "var(--color-surface-1)",
          borderTop: "1px solid var(--color-border)",
          zIndex: 40,
          paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))",
        }}
      >
        {status === "running" ? (
          <button
            onClick={stop}
            disabled={stopPending}
            style={btn("danger", { flex: 1, justifyContent: "center", padding: "6px 0", opacity: stopPending ? 0.5 : 1, cursor: stopPending ? "not-allowed" : "pointer" })}
          >
            <Square size={13} strokeWidth={2} fill="currentColor" /> {stopPending ? "Stopping…" : "Stop"}
          </button>
        ) : (
          <button
            onClick={() => run()}
            disabled={!canRun}
            style={btn("primary", { flex: 1, justifyContent: "center", padding: "6px 0", opacity: canRun ? 1 : 0.5, cursor: canRun ? "pointer" : "not-allowed" })}
          >
            <Play size={13} strokeWidth={2} />
            {status === "done" ? "Re-run" : "Run benchmark"}
          </button>
        )}
        {status === "done" && (
          <button onClick={reset} style={btn("secondary", { padding: "6px 14px" })}>
            <RotateCcw size={12} strokeWidth={1.75} />
          </button>
        )}
      </div>

    </div>
  );
}
