"use client";

import React, { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { Play, Square, RotateCcw, Trophy, LineChart, ChevronRight, Lock, Unlock, Volume2, Settings } from "lucide-react";
import { generateBenchmarkInput, SORT_FNS, makeQuickSort, makeShellSort, makeLogosSort, countSortOps, sortSteps, makeAdversarialInput, DEFAULT_LOGOS_PARAMS, type LogosParams, type BenchmarkScenario, type CustomDistribution, type QuickPivot, type ShellGaps, type SortStep } from "@/lib/benchmark";
import { getLogosSortSteps } from "@/lib/algorithms";
import { useLevel } from "@/hooks/useLevel";

// ── Static config ─────────────────────────────────────────────────────────────

const SLOW_IDS = new Set(["insertion", "selection", "bubble", "cocktail", "comb", "gnome", "pancake", "cycle", "oddeven"]);
const SLOW_THRESHOLD = 5_000;
// Only Logos Sort and Tim Sort are allowed above 5 M elements
const UNLIMITED_IDS = new Set(["logos", "logos-custom", "timsort"]);
const LARGE_THRESHOLD = 5_000_000;

// Algorithms with practical upper bounds above SLOW_THRESHOLD but below LARGE_THRESHOLD
const MEDIUM_LIMITS: Record<string, { threshold: number; reason: string }> = {
  shell:    { threshold: 2_000_000, reason: "Large gap strides cause cache thrashing above 2M — use Tim/Logos instead" },
  counting: { threshold: 1_000_000, reason: "Needs an O(k) count array; for random data k ≈ n, so memory explodes above 1M" },
  radix:    { threshold: 1_000_000, reason: "Multiple O(n) auxiliary arrays per digit pass — memory-heavy above 1M" },
  bucket:   { threshold: 500_000,   reason: "Worst-case O(n²) when buckets fill unevenly; unreliable above 500k on non-uniform data" },
};
const TIMEOUT_MS = 10_000;

const ALGO_GROUPS = [
  {
    label: "O(n log n)",
    items: [
      { id: "logos",     name: "Logos Sort",  href: "/sorting/logos" },
      { id: "introsort", name: "Introsort",    href: "/sorting/introsort" },
      { id: "timsort",   name: "Tim Sort",     href: "/sorting/timsort" },
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
  logos: "Logos Sort", "logos-custom": "Logos (custom)",
  introsort: "Introsort",
  timsort: "Tim Sort",   merge: "Merge Sort",
  quick: "Quick Sort", heap: "Heap Sort",      shell: "Shell Sort",
  counting: "Counting Sort", radix: "Radix Sort", bucket: "Bucket Sort",
  insertion: "Insertion Sort", selection: "Selection Sort", bubble: "Bubble Sort",
  cocktail: "Cocktail Sort", comb: "Comb Sort", gnome: "Gnome Sort",
  pancake: "Pancake Sort", cycle: "Cycle Sort", oddeven: "Odd-Even Sort",
  "timsort-js": "TimSort (JS est.)",
};

// Measured in this V8 environment: pure-JS TimSort runs in 0.57× the time of
// native .sort((a,b)=>a-b) because the comparator callback adds JS <=> C++ call
// overhead on every comparison. Emulating "non-native" TimSort = multiply by 0.57.
const TIMSORT_JS_MULTIPLIER = 0.57;

const ALGO_COLORS: Record<string, string> = {
  logos:          "#000000",
  "logos-custom": "#555555",
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
};

const ALGO_SPACE: Record<string, string> = {
  logos:          "O(log n)",
  "logos-custom": "O(log n)",
  introsort:      "O(log n)",
  timsort:        "O(n)",
  "timsort-js":   "O(n)",
  merge:     "O(n)",
  quick:     "O(log n)",
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
  pancake:   "O(1)",
  cycle:     "O(1)",
  oddeven:   "O(1)",
};

const ALGO_TIME: Record<string, string> = {
  logos:          "O(n log n)",
  "logos-custom": "O(n log n)",
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
};

// true = stable, false = unstable, null = not applicable
const ALGO_STABLE: Record<string, boolean> = {
  logos:          false,
  "logos-custom": false,
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
};

// true = can sort a stream, false = needs full input
const ALGO_ONLINE: Record<string, boolean> = {
  logos:          false,
  "logos-custom": false,
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
};

// Rank for sorting by complexity class (lower = better)
const BIG_O_RANK: Record<string, number> = {
  "O(1)":           0,
  "O(log n)":       1,
  "O(k)":           2,
  "O(n+k)":         3,
  "O(n)":           4,
  "O(nk)":          5,
  "O(n log n)":     6,
  "O(n log n) avg": 6,
  "O(n log² n)":    7,
  "O(n²)":          8,
};

const BIG_O_REFS = [
  { id: "logn",  label: "O(log n)",   fn: (n: number) => Math.log2(Math.max(n, 2)),        frac: 0.10, color: "#4db6ac" },
  { id: "n",     label: "O(n)",       fn: (n: number) => n,                                frac: 0.25, color: "#64b5f6" },
  { id: "nlogn", label: "O(n log n)", fn: (n: number) => n * Math.log2(Math.max(n, 2)),    frac: 0.48, color: "#ffb74d" },
  { id: "n2",    label: "O(n²)",      fn: (n: number) => n * n,                            frac: 0.78, color: "#ef9a9a" },
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

// ── Theoretical space estimation ──────────────────────────────────────────────
// Used when performance.memory is unavailable or returns 0 (its common lazy-
// update behavior means the before/after diff is often 0 for fast sorts).
// Values are in bytes and match the algorithm's known O() space class.
function theoreticalSpaceBytes(id: string, n: number): number {
  const space = ALGO_SPACE[id] ?? "";
  if (space === "O(1)")     return 200;                                   // tiny constant overhead
  if (space === "O(log n)") return Math.ceil(Math.log2(Math.max(n, 2))) * 64; // ~64 B per stack frame
  if (space === "O(n)")     return n * 8;                                 // one float64 copy
  if (space.startsWith("O(n")) return n * 8;                             // O(n+k), O(nk) → ≈ n
  if (space.startsWith("O(k")) return Math.min(n, 1_000_000) * 4;       // O(k) bounded counter table
  return n * 8;
}

const RANK_COLORS = ["#c9961a", "#888", "#b06830"];

function rankColor(rank: number, total: number): string {
  if (rank <= 3) return RANK_COLORS[rank - 1];
  if (rank === total) return "var(--color-state-swap)";
  return "var(--color-muted)";
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
] as const;

// ── Run history (localStorage) ────────────────────────────────────────────────
const HISTORY_KEY = "cc_bench_history_v1";
const HISTORY_MAX = 8;

interface HistoryEntry {
  id: string;
  label: string;
  timestamp: number;
  algos: string[];
  results: Record<string, { n: number; timeMs: number; spaceBytes?: number }[]>;
}

function loadHistory(): HistoryEntry[] {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]"); } catch { return []; }
}
function saveHistory(entries: HistoryEntry[]): void {
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(0, HISTORY_MAX))); } catch { /* quota */ }
}

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
    case "logos-custom":
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
  const [showSurface, setShowSurface] = useState(true);
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
    const logNs = raw.map(p => Math.log10(p.n));
    const logTs = raw.map(p => Math.log10(p.t));
    const logSs = raw.map(p => Math.log10(p.s));
    const ranges = {
      n: [Math.min(...logNs), Math.max(...logNs)] as [number, number],
      t: [Math.min(...logTs), Math.max(...logTs)] as [number, number],
      s: [Math.min(...logSs), Math.max(...logSs)] as [number, number],
    };
    const nr = (v: number, [lo, hi]: [number, number]) => hi > lo ? (v - lo) / (hi - lo) : 0.5;

    // Log-log fit per algorithm → cumulative work integral ∫₀ⁿ f(n) dn = a·nᵇ⁺¹/(b+1)
    const fitMap: Record<string, { a: number; b: number } | null> = {};
    for (const id of algos) {
      const pts = raw.filter(p => p.id === id && p.t > 0 && p.n > 1);
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

    const pts3d: Chart3DPoint[] = raw.map(p => {
      const fit = fitMap[p.id];
      const work = (fit && fit.b > -1) ? fit.a * Math.pow(p.n, fit.b + 1) / (fit.b + 1) : undefined;
      return { ...p, x: nr(Math.log10(p.n), ranges.n), y: nr(Math.log10(p.t), ranges.t), z: nr(Math.log10(p.s), ranges.s), work };
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
    const edges: [number,number,number,number,number,number][] = [
      [0,0,0,1,0,0],[0,0,0,0,1,0],[0,0,0,0,0,1],
      [1,0,0,1,1,0],[1,0,0,1,0,1],[0,1,0,1,1,0],
      [0,1,0,0,1,1],[1,1,0,1,1,1],[0,0,1,1,0,1],
      [0,0,1,0,1,1],[1,0,1,1,1,1],[0,1,1,1,1,1],
    ];
    ctx.strokeStyle = "rgba(128,128,128,0.15)"; ctx.lineWidth = 0.5;
    for (const [x0,y0,z0,x1,y1,z1] of edges) {
      const [ax,ay] = pr(x0,y0,z0); const [bx,by] = pr(x1,y1,z1);
      ctx.beginPath(); ctx.moveTo(ax,ay); ctx.lineTo(bx,by); ctx.stroke();
    }

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

    // ── Axes with arrowheads + labels ─────────────────────────────────────────
    const axesDef: [number,number,number,number,number,number,string,string][] = [
      [0,0,0,1,0,0,"#64b5f6","n (size)"],
      [0,0,0,0,1,0,"#ffb74d","time"],
      [0,0,0,0,0,1,"#81c784","space"],
    ];
    for (const [x0,y0,z0,x1,y1,z1,color,label] of axesDef) {
      const [ax,ay] = pr(x0,y0,z0); const [bx,by] = pr(x1,y1,z1);
      ctx.strokeStyle = color; ctx.lineWidth = 1.8;
      ctx.beginPath(); ctx.moveTo(ax,ay); ctx.lineTo(bx,by); ctx.stroke();
      const ang = Math.atan2(by-ay, bx-ax);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(bx - 9*Math.cos(ang-0.4), by - 9*Math.sin(ang-0.4));
      ctx.lineTo(bx - 9*Math.cos(ang+0.4), by - 9*Math.sin(ang+0.4));
      ctx.fill();
      ctx.font = "bold 9px monospace"; ctx.fillText(label, bx + 5, by + 3);
    }

    // Axis tick labels
    ctx.font = "7px monospace";
    const TICKS = 4;
    for (let i = 0; i <= TICKS; i++) {
      const t = i / TICKS;
      const [nx,ny] = pr(t,0,0);
      ctx.fillStyle = "#64b5f6";
      ctx.fillText(fmtN(Math.pow(10, ranges.n[0] + t*(ranges.n[1]-ranges.n[0]))), nx-6, ny+11);
      const [tx2,ty2] = pr(0,t,0);
      ctx.fillStyle = "#ffb74d";
      ctx.fillText(fmtTime(Math.pow(10, ranges.t[0] + t*(ranges.t[1]-ranges.t[0]))), tx2-34, ty2+3);
      const [sx2,sy2] = pr(0,0,t);
      ctx.fillStyle = "#81c784";
      ctx.fillText(fmtBytes(Math.pow(10, ranges.s[0] + t*(ranges.s[1]-ranges.s[0]))), sx2+5, sy2+3);
    }

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
    if (tool === "orbit")
      dragRef.current = { startX: e.clientX, startY: e.clientY, startRx: rotX, startRy: rotY };
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
  const onWheel   = (e: React.WheelEvent) => {
    e.preventDefault();
    setZoom(z => Math.max(0.3, Math.min(4, z * (1 - e.deltaY * 0.0008))));
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
          { id: "orbit"  , label: "⟳ Orbit",   title: "Drag to orbit · scroll to zoom" },
          { id: "measure", label: "⊕ Measure",  title: "Hover over a point to inspect its n / time / space values" },
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
        <span style={{ fontSize: 8, color: "var(--color-muted)", marginLeft: "auto", fontFamily: "monospace" }}>
          X=n · Y=time · Z=space (log₁₀) · dot size &amp; ring = ∫f dn cumulative work
        </span>
      </div>
      <canvas
        ref={canvasRef} width={800} height={307}
        style={{ width: "100%", height: "auto", aspectRatio: "800 / 307", display: "block", touchAction: "none",
          cursor: tool === "orbit" ? "grab" : tool === "measure" ? (hoverInfo ? "pointer" : "crosshair") : "default" }}
        onMouseDown={onMouseDown} onMouseMove={onMouseMove}
        onMouseUp={onMouseUp} onMouseLeave={() => { dragRef.current = null; setHoverInfo(null); }}
        onWheel={onWheel}
      />
      {/* Curtain hint */}
      {showSurface && (
        <p style={{ fontSize: 8, color: "var(--color-muted)", fontFamily: "monospace", marginTop: 4 }}>
          curtains drop to the time-axis floor · rings on the floor = ∫f dn (larger = more cumulative work) · use ⊕ Measure to inspect any point
        </p>
      )}
    </div>
  );
}

// ── Mathematical properties panel ──────────────────────────────────────────────
// Shows fitted equation, derivative (marginal cost), and cumulative work integral per algorithm.

function MathPanel({
  data, algos, mode,
}: {
  data: Record<string, { n: number; timeMs: number; spaceBytes?: number; timedOut?: boolean }[]>;
  algos: string[];
  mode: "time" | "space";
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
      ? pts.filter(p => p.timeMs > 0).map(p => ({ n: p.n, val: p.timeMs }))
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
            <div key={id} style={{ background: "var(--color-surface-1)", borderRadius: 6, border: "1px solid var(--color-border)", overflow: "hidden" }}>
              <button onClick={() => toggle(id)} style={{
                width: "100%", display: "flex", alignItems: "center", gap: 6,
                padding: "5px 8px", background: "none", border: "none", cursor: "pointer", textAlign: "left",
              }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: dotColor, flexShrink: 0 }} />
                <span style={{ fontSize: 10, fontWeight: 600, color: "var(--color-text)", flex: 1 }}>{ALGO_NAMES[id]}</span>
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
type CurvePoint = {
  n: number;
  timeMs: number;       // best post-warmup round (used for ranking)
  meanMs?: number;      // mean of post-warmup rounds
  stdDev?: number;      // std dev of post-warmup rounds (for error bands)
  spaceBytes?: number;
  timedOut?: boolean;
};
type CurveData = Record<string, CurvePoint[]>;

interface SummaryResult {
  id: string;
  timeMs: number;
  rank: number;
}

// ── Curve chart ───────────────────────────────────────────────────────────────

function CurveChart({
  data,
  sizes,
  algos,
  highlight,
  activeN,
  onNChange,
  mode = "time",
}: {
  data: CurveData;
  sizes: number[];
  algos: string[];
  highlight?: string | null;
  activeN?: number | null;
  onNChange?: (n: number | null) => void;
  mode?: "time" | "space" | "ratio" | "space-ratio";
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

  // Reset zoom state when locking
  useEffect(() => { if (locked) { setYZoom(1); setXRange(null); } }, [locked]);
  // Reset x-range when the available sizes change
  useEffect(() => { setXRange(null); }, [sizes]);

  // Non-passive wheel listener so we can prevent page scroll while zooming
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (locked || interactMode !== "zoom") return;
      e.preventDefault();
      setYZoom(prev => Math.max(0.05, Math.min(1, prev * (e.deltaY > 0 ? 1.18 : 1 / 1.18))));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [locked, interactMode]);

  const VW = 600;
  const VH = 230;
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

  const getValue = (p: CurvePoint) =>
    mode === "space"       ? (p.spaceBytes ?? 0) :
    mode === "ratio"       ? (p.n > 1 ? p.timeMs / (p.n * Math.log2(p.n)) : 0) :
    mode === "space-ratio" ? (p.n > 1 ? (p.spaceBytes ?? 0) / (p.n * Math.log2(p.n)) : 0) :
    p.timeMs;
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
  const yAt       = (v: number) => pT + iH - (v / maxY) * iH;

  const yTicks = [0.25, 0.5, 0.75, 1].map(f => ({ v: maxY * f, y: yAt(maxY * f) }));

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

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const svgX = getSvgX(e);
    if (locked) {
      if (onNChange && visSizes.length) onNChange(snapToSize(svgX));
      return;
    }
    if (dragStart !== null) {
      setDragCur(svgX);
      if (interactMode === "zoom") setDragCurY(getSvgY(e));
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

  // Build sorted bubble data for activeN column
  const bubbles = activeN != null && visSizes.includes(activeN)
    ? algos
        .map(id => ({ id, pt: data[id]?.find(p => p.n === activeN) }))
        .filter((x): x is { id: string; pt: CurvePoint } => !!x.pt && !x.pt.timedOut)
        .sort((a, b) => getValue(a.pt) - getValue(b.pt))
    : [];

  // Estimated bubbles for projected sizes (expanded mode)
  const projBubbles = expanded && activeN != null && projSizes.includes(activeN)
    ? algos
        .flatMap(id => {
          const fit = extraFits.get(id);
          if (!fit) return [];
          const v = fit.k * fit.fn(activeN);
          if (!isFinite(v) || v <= 0) return [];
          return [{ id, v }];
        })
        .sort((a, b) => a.v - b.v)
    : [];

  // Calibration constant for Big-O reference curves — shared between static labels and tooltip bubbles
  const bigOCalibC = (() => {
    const calN = visSizes.find(n => n >= 2);
    if (!calN) return 0;
    if (mode === "space") {
      let largest = 0;
      for (const id of algos) {
        const v = data[id]?.find(p => p.n === calN)?.spaceBytes ?? 0;
        if (v > largest) largest = v;
      }
      return largest > 0 ? largest / calN : 8;
    }
    let fastest = Infinity;
    for (const id of algos) {
      const pt = data[id]?.find(p => p.n === calN && !p.timedOut);
      if (pt && pt.timeMs < fastest) fastest = pt.timeMs;
    }
    return fastest < Infinity ? fastest / (calN * Math.log2(calN)) : 0;
  })();

  const bigORefs = mode === "space" ? SPACE_BIG_O_REFS : BIG_O_REFS;

  // Big-O tooltip bubbles shown at the hover crosshair (not in ratio mode — axis is already normalised)
  const bigOBubbles = activeN != null && bigOCalibC > 0 && mode !== "ratio"
    ? [...bigORefs]
        .map(ref => ({ ref, v: bigOCalibC * ref.fn(activeN) }))
        .filter(x => isFinite(x.v) && x.v > 0)
        .sort((a, b) => a.v - b.v)
    : [];

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
      </div>
    <svg
      ref={svgRef}
      viewBox={`0 0 ${VW} ${VH}`}
      style={{ width: "100%", height: "auto", aspectRatio: `${VW} / ${VH}`, display: "block", cursor: locked ? (onNChange ? "crosshair" : "default") : "crosshair" }}
      aria-label={mode === "space" ? "Space usage vs input size per algorithm" : "Performance curve: time vs input size per algorithm"}
      onMouseMove={handleMouseMove}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => { onNChange?.(null); clearDrag(); }}
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

      {/* Big-O reference curves — calibrated to actual data, labeled with predicted values */}
      {mode !== "ratio" && mode !== "space-ratio" && visSizes.length >= 1 && bigOCalibC > 0 && (() => {
        const maxN  = visSizes[visSizes.length - 1];
        const STEPS = 80;
        const lx    = pL + iW + extraZoneW + 5;

        const refY = (fn: (n: number) => number, n: number) =>
          Math.max(pT, pT + iH - (bigOCalibC * fn(n) / maxY) * iH);

        // Compute natural label positions then spread them so they don't overlap
        const MIN_LABEL_GAP = 24; // 3 lines × ~8px
        const naturalY = bigORefs.map(ref =>
          Math.max(pT + 7, Math.min(pT + iH - 23, refY(ref.fn, maxN) - 2))
        );
        // Sort indices top-to-bottom (ascending y = higher on screen)
        const order = [...bigORefs.keys()].sort((a, b) => naturalY[a] - naturalY[b]);
        const spacedY = [...naturalY];
        // Push labels down if too close
        for (let i = 1; i < order.length; i++) {
          const prev = order[i - 1], curr = order[i];
          if (spacedY[curr] < spacedY[prev] + MIN_LABEL_GAP)
            spacedY[curr] = spacedY[prev] + MIN_LABEL_GAP;
        }
        // Pull labels back up if they overflow the bottom
        for (let i = order.length - 1; i >= 0; i--) {
          const curr = order[i];
          if (spacedY[curr] > pT + iH - 23) spacedY[curr] = pT + iH - 23;
          if (i > 0) {
            const prev = order[i - 1];
            if (spacedY[prev] > spacedY[curr] - MIN_LABEL_GAP)
              spacedY[prev] = spacedY[curr] - MIN_LABEL_GAP;
          }
        }

        return bigORefs.map((ref, ri) => {
          const pts: string[] = [];
          for (let i = 0; i <= STEPS; i++) {
            const t = i / STEPS;
            const x = pL + t * iW;
            const fi = t * (visSizes.length - 1);
            const lo = Math.floor(fi), hi2 = Math.ceil(fi);
            const ft = fi - lo;
            const n = lo === hi2 ? visSizes[lo] : visSizes[lo] * Math.pow(visSizes[hi2] / visSizes[lo], ft);
            pts.push(`${x.toFixed(1)},${refY(ref.fn, n).toFixed(1)}`);
          }

          const predMs  = bigOCalibC * ref.fn(maxN);
          const clipped = predMs > maxY;
          const labelY  = spacedY[ri];

          return (
            <g key={ref.id} style={{ pointerEvents: "none" }}>
              <polyline
                points={pts.join(" ")}
                fill="none"
                stroke={ref.color}
                strokeWidth={1.5}
                strokeDasharray="5 3"
                opacity={ref.id === "logn" || ref.id === "1" ? 0.9 : 0.65}
                clipPath="url(#inner-plot-clip)"
              />
              {/* connector tick from right edge of plot to the label */}
              <line
                x1={pL + iW + extraZoneW} y1={Math.max(pT, Math.min(pT + iH, refY(ref.fn, maxN)))}
                x2={lx - 2}               y2={labelY + 8}
                stroke={ref.color} strokeWidth={0.5} opacity={0.35}
                style={{ pointerEvents: "none" }}
              />
              {/* class label */}
              <text x={lx} y={labelY} textAnchor="start" fontSize={7.5}
                fontFamily="monospace" fill={ref.color} opacity={0.9}>
                {ref.label}
              </text>
              {/* input size at which the prediction applies */}
              <text x={lx} y={labelY + 9} textAnchor="start" fontSize={7}
                fontFamily="monospace" fill={ref.color} opacity={0.7}>
                n={fmtN(maxN)}
              </text>
              {/* predicted value at largest n */}
              <text x={lx} y={labelY + 17} textAnchor="start" fontSize={7}
                fontFamily="monospace" fill={ref.color} opacity={0.7}>
                {clipped ? "↑ " : ""}{mode === "space" ? fmtBytes(predMs) : fmtPredicted(predMs)}
              </text>
            </g>
          );
        });
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
        fill="var(--color-muted)" fontStyle="italic">input size (n)</text>

      {/* y-axis title — rotated */}
      <text
        x={0} y={0}
        transform={`translate(9, ${pT + iH / 2}) rotate(-90)`}
        textAnchor="middle" fontSize={8}
        fill="var(--color-muted)" fontStyle="italic" fontFamily="monospace"
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

      {/* hover crosshair */}
      {activeN != null && (() => {
        const x = xAt(activeN);
        return (
          <g style={{ pointerEvents: "none" }}>
            <line x1={x} y1={pT} x2={x} y2={pT + iH}
              stroke="var(--color-text)" strokeWidth={1} strokeDasharray="3 3" opacity={0.3} />
          </g>
        );
      })()}

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
                    const isActive = activeN === pp.n;
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
                const isActive = activeN != null && p.n === activeN;
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
      {bubbles.length > 0 && activeN != null && (() => {
        const cx = xAt(activeN);
        const flipRight = cx > VW * 0.6;
        return (
          <g style={{ pointerEvents: "none" }}>
            {bubbles.map(({ id, pt }, i) => {
              const cy = yAt(getValue(pt));
              const color = ALGO_COLORS[id] ?? "#888";
              const label = `${ALGO_NAMES[id]}  ${mode === "space" ? fmtBytes(pt.spaceBytes ?? 0) : fmtTime(pt.timeMs)}`;
              const bw = label.length * 5.6 + 10;
              const bh = 16;
              const bx = flipRight ? cx - bw - 10 : cx + 10;
              const by = cy - bh / 2;
              // nudge bubbles that would overlap
              const nudge = i * 0;
              return (
                <g key={id} transform={`translate(0,${nudge})`}>
                  <rect x={bx} y={by} width={bw} height={bh} rx={4}
                    fill={color} opacity={0.93} />
                  <text x={bx + 5} y={by + 11} fontSize={9.5} fontWeight={700}
                    fill="#fff" style={{ letterSpacing: "0.01em" }}>
                    {label}
                  </text>
                  {/* connector dot — positioned at getValue(pt) */}
                  <circle cx={cx} cy={yAt(getValue(pt))} r={5} fill={color}
                    stroke="var(--color-surface-2)" strokeWidth={2} />
                </g>
              );
            })}
          </g>
        );
      })()}
      {/* Estimated bubbles for projected sizes */}
      {projBubbles.length > 0 && activeN != null && (() => {
        const cx = xAt(activeN);
        const flipRight = cx > VW * 0.6;
        return (
          <g style={{ pointerEvents: "none" }}>
            {projBubbles.map(({ id, v }) => {
              const cy = Math.max(pT + 8, Math.min(pT + iH - 8, yAt(v)));
              const color = ALGO_COLORS[id] ?? "#888";
              const label = `${ALGO_NAMES[id]}  ~est: ${fmtY(v)}`;
              const bw = label.length * 5.6 + 10;
              const bh = 16;
              const bx = flipRight ? cx - bw - 10 : cx + 10;
              const by = cy - bh / 2;
              return (
                <g key={id}>
                  <rect x={bx} y={by} width={bw} height={bh} rx={4}
                    fill={color} opacity={0.7}
                    stroke={color} strokeWidth={1} strokeDasharray="3 2" />
                  <text x={bx + 5} y={by + 11} fontSize={9.5} fontWeight={700}
                    fill="#fff" style={{ letterSpacing: "0.01em" }}>
                    {label}
                  </text>
                  <circle cx={cx} cy={cy} r={4.5}
                    fill="var(--color-surface-2)" stroke={color} strokeWidth={2} />
                </g>
              );
            })}
          </g>
        );
      })()}

      {/* Big-O reference curve tooltip bubbles at the hover crosshair */}
      {bigOBubbles.length > 0 && activeN != null && (() => {
        const cx = xAt(activeN);
        const flipRight = cx > VW * 0.55;
        const BH = 15, SWATCH_W = 14, GAP = 3, PAD = 5;
        const MIN_BUB_GAP = BH + 2;

        // Compute natural y positions and spread vertically to avoid overlap
        const naturalCy = bigOBubbles.map(({ v }) =>
          Math.max(pT + BH / 2 + 2, Math.min(pT + iH - BH / 2 - 2, yAt(v)))
        );
        const spreadCy = [...naturalCy];
        for (let i = 1; i < spreadCy.length; i++)
          if (spreadCy[i] < spreadCy[i - 1] + MIN_BUB_GAP)
            spreadCy[i] = spreadCy[i - 1] + MIN_BUB_GAP;
        for (let i = spreadCy.length - 1; i >= 1; i--) {
          if (spreadCy[i] > pT + iH - BH / 2 - 2) spreadCy[i] = pT + iH - BH / 2 - 2;
          if (spreadCy[i - 1] > spreadCy[i] - MIN_BUB_GAP)
            spreadCy[i - 1] = spreadCy[i] - MIN_BUB_GAP;
        }

        return (
          <g style={{ pointerEvents: "none" }}>
            {bigOBubbles.map(({ ref, v }, i) => {
              const cy = spreadCy[i];
              const valueStr = mode === "space" ? fmtBytes(v) : fmtPredicted(v);
              const labelStr = `${ref.label}  ${valueStr}`;
              const bw = SWATCH_W + GAP + labelStr.length * 5.1 + PAD * 2;
              const bx = flipRight ? cx - bw - 10 : cx + 10;
              const by = cy - BH / 2;
              return (
                <g key={ref.id}>
                  {/* bubble */}
                  <rect x={bx} y={by} width={bw} height={BH} rx={3}
                    fill="var(--color-surface-2)" opacity={0.93}
                    stroke={ref.color} strokeWidth={1} strokeDasharray="4 2" />
                  {/* legend color swatch — dashed line matching the curve style */}
                  <line
                    x1={bx + PAD} y1={by + BH / 2}
                    x2={bx + PAD + SWATCH_W} y2={by + BH / 2}
                    stroke={ref.color} strokeWidth={1.5} strokeDasharray="4 3" />
                  {/* label text */}
                  <text
                    x={bx + PAD + SWATCH_W + GAP} y={by + BH - 4}
                    fontSize={8.5} fontFamily="monospace" fontWeight={600}
                    fill={ref.color}>
                    {labelStr}
                  </text>
                  {/* connector dot on the reference curve */}
                  <circle cx={cx} cy={naturalCy[i]} r={3}
                    fill="var(--color-surface-2)" stroke={ref.color} strokeWidth={1.5} />
                </g>
              );
            })}
          </g>
        );
      })()}

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
            <span className="text-xs" style={{ color: "var(--color-muted)" }}>
              {ALGO_NAMES[id]}
            </span>
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
  proofs: Record<string, { before: number[]; after: number[]; n: number }>;
  algos: string[];
  activeAlgo: string | null;
  onSelect: (id: string | null) => void;
  revealed: boolean;
  curveData: CurveData;
}) {
  const available = algos.filter(id => proofs[id]);
  if (!available.length) return null;

  // idx === -1 means "overview" slide (all algorithms)
  const idx = activeAlgo === null ? -1 : available.indexOf(activeAlgo);
  const currentId = idx >= 0 ? available[idx] : null;
  const proof = currentId ? proofs[currentId] : null;
  const color = currentId ? (ALGO_COLORS[currentId] ?? "#888") : "var(--color-muted)";
  const max = proof ? Math.max(...proof.before, ...proof.after, 1) : 1;
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

  const tokenStyle = (v: number, forceColor = false): React.CSSProperties => {
    const base: React.CSSProperties = {
      display: "inline-block", fontSize: 10, fontFamily: "monospace",
      padding: "2px 5px", borderRadius: 4,
      transition: "background-color 0.5s ease, color 0.35s ease, border-color 0.5s ease",
    };
    if (!forceColor && !revealed) {
      return { ...base, background: "var(--color-surface-3)", color: "var(--color-muted)", border: "1px solid var(--color-border)" };
    }
    const hue = Math.round(220 - (v / max) * 185);
    return { ...base, background: `hsl(${hue},72%,40%)`, color: "#fff", border: `1px solid hsl(${hue},72%,57%)` };
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
            const best = pts.filter(p => !p.timedOut).sort((a, b) => a.timeMs - b.timeMs)[0];
            return (
              <button key={id} onClick={() => onSelect(id)}
                className="text-xs font-mono px-2 py-0.5 rounded text-left"
                style={{
                  background: "var(--color-surface-3)",
                  border: `1px solid ${ALGO_COLORS[id] ?? "var(--color-border)"}`,
                  color: ALGO_COLORS[id] ?? "var(--color-muted)",
                  cursor: "pointer",
                }}>
                {ALGO_NAMES[id]}{best ? ` · ${fmtTime(best.timeMs)} @ n=${fmtN(best.n)}` : ""}
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
              style={{ background: "var(--color-surface-3)", border: "1px solid var(--color-border)", color: "var(--color-muted)" }}>
              space <span style={currentId === "logos" ? { fontWeight: "bold", fontSize: "calc(1em * 1.1618)" } : undefined}>{ALGO_SPACE[currentId]}</span>
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
            const spaceB     = (p.spaceBytes != null && p.spaceBytes > 0) ? p.spaceBytes : theoreticalSpaceBytes(currentId, p.n);
            const isMeasured = p.spaceBytes != null && p.spaceBytes > 0;
            const canDl      = spaceB < 1_048_576;
            const handleDl   = () => {
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
                  n={fmtN(p.n)} · {p.timedOut ? ">10 s" : fmtTime(p.timeMs)}
                </span>
                <span style={{ fontSize: 8, color: "var(--color-muted)", marginTop: 3, fontFamily: "monospace", display: "flex", alignItems: "center", gap: 4 }}>
                  <span title="Time complexity">{ALGO_TIME[currentId] ?? "—"}</span>
                  <span style={{ opacity: 0.4 }}>·</span>
                  <span title={isMeasured ? "Measured heap diff" : "Theoretical estimate"}>{fmtBytes(spaceB)}{!isMeasured && " est."}</span>
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
                <span key={i} style={{ ...tokenStyle(v), transitionDelay: `${i * 18}ms` }}>{v.toLocaleString()}</span>
              ))}
            </span>
          </div>
          {revealed && (
            <div className="flex items-start gap-2">
              <span className="text-xs font-mono shrink-0 mt-0.5" style={{ color: "var(--color-muted)", width: 54 }}>sorted</span>
              <span className="inline-flex flex-wrap gap-1">
                {proof.after.map((v, i) => (
                  <span key={i} style={tokenStyle(v, true)}>{v.toLocaleString()}</span>
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
  id, steps, benchData, isActive, rank, loop, maxSpaceBytes, maxTotalSteps, onStop, pulseEnabled, onTogglePulse,
}: {
  id: string;
  steps: SortStep[] | null;
  benchData: { n: number; timeMs: number; spaceBytes?: number; timedOut?: boolean }[] | null;
  isActive: boolean;
  rank: number | null;
  loop?: boolean;
  maxSpaceBytes?: number;
  maxTotalSteps?: number;
  onStop?: () => void;
  pulseEnabled?: boolean;
  onTogglePulse?: () => void;
}) {
  const [stepIdx, setStepIdx] = useState(0);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!steps || steps.length === 0) return;
    setStepIdx(0);
    setPlaying(true);
  }, [steps]);

  // Restart loop when benchmark is running
  useEffect(() => {
    if (loop && steps && steps.length > 0) {
      setStepIdx(0);
      setPlaying(true);
    }
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
      border: `1px solid ${isActive ? color : "var(--color-border)"}`,
      borderRadius: 7,
      padding: "8px 10px",
      transition: "border-color 0.2s",
    }}>
      {/* Name row */}
      <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 5 }}>
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: color, display: "inline-block", flexShrink: 0 }} />
        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--color-text)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {ALGO_NAMES[id] ?? id}
        </span>
        {rank !== null && rank <= 3 && (
          <span style={{ fontSize: 13, lineHeight: 1, flexShrink: 0 }} title={`#${rank}`}>
            {PLACE_EMOJI[rank]}
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
        {bestPoint && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 3, flexShrink: 0 }}>
            <span style={{ fontSize: 8, fontFamily: "monospace", color, whiteSpace: "nowrap" }}>
              {fmtTime(bestPoint.timeMs)} @ n={fmtN(bestPoint.n)}
            </span>
            {(() => {
              const spaceBytes = bestPoint.spaceBytes ?? 0;
              const maxSB = maxSpaceBytes ?? spaceBytes;
              if (!spaceBytes || !maxSB) return null;
              const fillDiameter = Math.max(1, (spaceBytes / maxSB) * 20);
              const label = spaceBytes >= 1_048_576 ? `${(spaceBytes / 1_048_576).toFixed(1)} MB` : spaceBytes >= 1024 ? `${(spaceBytes / 1024).toFixed(1)} KB` : `${spaceBytes} B`;
              const pulseDuration = Math.max(150, Math.min(5000, bestPoint.timeMs));
              return (
                <>
                  <span
                    title={pulseEnabled ? "Click to pause pulse" : "Click to resume pulse"}
                    onClick={onTogglePulse}
                    style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 1, flexShrink: 0, cursor: "pointer" }}
                  >
                    <span style={{ position: "relative", width: 20, height: 20, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                      <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "var(--color-surface-3)", border: "1px solid var(--color-border)" }} />
                      <span style={{ position: "relative", width: fillDiameter, height: fillDiameter, borderRadius: "50%", background: color, display: "block", ...(pulseEnabled ? { animationName: "cc-pulse", animationDuration: `${pulseDuration}ms`, animationTimingFunction: "ease-in-out", animationIterationCount: "infinite" } : {}) }} />
                    </span>
                    <span style={{ fontSize: 7, fontFamily: "monospace", color: "var(--color-muted)", whiteSpace: "nowrap", lineHeight: 1 }}>{label}</span>
                  </span>
                  <button
                    title={`Hear sort speed (${fmtTime(bestPoint.timeMs)})`}
                    onClick={e => { e.stopPropagation(); playBeep(bestPoint.timeMs); }}
                    style={{ background: "none", border: "none", cursor: "pointer", padding: "0 1px", color: "var(--color-muted)", display: "inline-flex", alignItems: "center", flexShrink: 0, position: "relative", top: -3 }}
                  >
                    <Volume2 size={10} strokeWidth={1.5} />
                  </button>
                </>
              );
            })()}
          </span>
        )}
      </div>

      {/* Property badges */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 2, marginBottom: 6 }}>
        {ALGO_TIME[id] && (
          <span style={{ fontSize: 7, fontFamily: "monospace", padding: "1px 3px", borderRadius: 3,
            background: "var(--color-surface-3)", border: `1px solid ${color}55`, color }}>
            {ALGO_TIME[id]}
          </span>
        )}
        {ALGO_SPACE[id] && (
          <span style={{ fontSize: 7, fontFamily: "monospace", padding: "1px 3px", borderRadius: 3,
            background: "var(--color-surface-3)", border: "1px solid var(--color-border)", color: "var(--color-muted)" }}>
            {ALGO_SPACE[id]}
          </span>
        )}
        {ALGO_STABLE[id] !== undefined && (
          <span style={{ fontSize: 7, fontFamily: "monospace", padding: "1px 3px", borderRadius: 3,
            background: "var(--color-surface-3)", border: "1px solid var(--color-border)", color: "var(--color-muted)" }}>
            {ALGO_STABLE[id] ? "stable" : "unstable"}
          </span>
        )}
        {ALGO_ONLINE[id] !== undefined && (
          <span style={{ fontSize: 7, fontFamily: "monospace", padding: "1px 3px", borderRadius: 3,
            background: "var(--color-surface-3)", border: "1px solid var(--color-border)", color: "var(--color-muted)" }}>
            {ALGO_ONLINE[id] ? "online" : "offline"}
          </span>
        )}
      </div>

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

// ── Component ─────────────────────────────────────────────────────────────────

export default function BenchmarkVisualizer() {
  const { has } = useLevel();
  const [pulseEnabled, setPulseEnabled] = useState<boolean>(() => {
    try { return localStorage.getItem("cc-pulse") !== "off"; } catch { return true; }
  });
  const [logosParams, setLogosParams] = useState<LogosParams>(DEFAULT_LOGOS_PARAMS);
  const [logosSettingsOpen, setLogosSettingsOpen] = useState(false);
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
  const [rounds, setRounds] = useState(3);
  const [warmup, setWarmup] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(
    new Set(["logos", "timsort"])
  );

  const [status, setStatus] = useState<Status>("idle");
  const [curveData, setCurveData] = useState<CurveData>({});
  const [currentN, setCurrentN] = useState<number | null>(null);
  const [currentAlgo, setCurrentAlgo] = useState<string | null>(null);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [runConfig, setRunConfig] = useState<{
    sizes: number[]; scenarios: BenchmarkScenario[]; rounds: number; warmup: number; algos: string[];
  } | null>(null);
  const [sampleProofs, setSampleProofs] = useState<Record<string, { before: number[]; after: number[]; n: number }>>({});
  const [activeProofAlgo, setActiveProofAlgo] = useState<string | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [hoverN, setHoverN] = useState<number | null>(null);
  const [hoverBigO, setHoverBigO] = useState<{ id: string; type: "time" | "space" } | null>(null);
  type SortCol = "name" | "speed" | "time" | "tvsb" | "tbigo" | "fit" | "space" | "svsb" | "sbigo";
  const [sortCol, setSortCol] = useState<SortCol>("time");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [chartMode, setChartMode] = useState<"time" | "space" | "ratio" | "space-ratio" | "3d" | "memory">("time");
  const [miniCardSort, setMiniCardSort] = useState<"space" | "time">("space");
  const [customInput, setCustomInput] = useState("");
  const [pendingCustomN, setPendingCustomN] = useState<number | null>(null);
  const [customPreSorted, setCustomPreSorted] = useState(0);
  const [customDuplicates, setCustomDuplicates] = useState(0);
  const [quickPivot, setQuickPivot] = useState<QuickPivot>("median3");
  const [shellGaps, setShellGaps] = useState<ShellGaps>("ciura");
  const [shareState, setShareState] = useState<"idle" | "copied">("idle");
  const [opCounts, setOpCounts] = useState<Record<string, { comparisons: number; swaps: number }>>({});
  const [runHistory, setRunHistory] = useState<HistoryEntry[]>(() => {
    if (typeof window === "undefined") return [];
    return loadHistory();
  });
  const [historyOpen, setHistoryOpen] = useState(false);
  const [overlayHistory, setOverlayHistory] = useState<HistoryEntry | null>(null);
  const [prerunSteps, setPrerunSteps] = useState<Record<string, SortStep[]>>({});
  const [progressLocked, setProgressLocked] = useState(true);
  const stopRef = useRef(false);
  const excludedRef = useRef<Set<string>>(new Set());
  const algoSleepResolveRef = useRef<(() => void) | null>(null);
  const algoSleepTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Lock chart cursor to the n currently being benchmarked
  useEffect(() => {
    if (progressLocked && status === "running" && currentN !== null) {
      setHoverN(currentN);
    }
  }, [currentN, progressLocked, status]);

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
    if (rounds !== 3) params.set("rounds", String(rounds));
    if (warmup !== 1) params.set("warmup", String(warmup));
    if (quickPivot !== "median3") params.set("pivot", quickPivot);
    if (shellGaps !== "ciura") params.set("gaps", shellGaps);
    if (customPreSorted !== 0) params.set("preSorted", String(customPreSorted));
    if (customDuplicates !== 0) params.set("dups", String(customDuplicates));
    const q = params.toString();
    window.history.replaceState(null, "", q ? "?" + q : window.location.pathname);
  }, [selected, selectedSizes, scenarios, rounds, warmup, quickPivot, shellGaps, customPreSorted, customDuplicates]);

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

  const exportCSV = () => {
    const rows: (string | number)[][] = [
      ["algo", "n", "timeMs_best", "timeMs_mean", "timeMs_stdDev", "spaceBytes", "timedOut", "scenarios"],
    ];
    for (const [id, pts] of Object.entries(curveDataExt)) {
      if (id === "timsort-js") continue; // derived — skip to avoid duplication
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
  const canRun = activeAlgos.length > 0 && selectedSizes.size > 0 && scenarios.size > 0 && status !== "running";

  const run = useCallback(async () => {
    const maxSz = selectedSizes.size > 0 ? Math.max(...selectedSizes) : 0;
    // Mirror slowDisabled exactly so the run list matches the checked-off checkboxes.
    const algos = [...selected].filter(id =>
      !(SLOW_IDS.has(id) && maxSz > SLOW_THRESHOLD) &&
      !(MEDIUM_LIMITS[id] !== undefined && maxSz > MEDIUM_LIMITS[id].threshold) &&
      !(!UNLIMITED_IDS.has(id) && maxSz > LARGE_THRESHOLD)
    );
    // Auto-inject logos-custom alongside logos whenever params differ from defaults.
    const paramsChanged = (Object.keys(DEFAULT_LOGOS_PARAMS) as (keyof typeof DEFAULT_LOGOS_PARAMS)[])
      .some(k => logosParams[k] !== DEFAULT_LOGOS_PARAMS[k]);
    if (paramsChanged && algos.includes("logos") && !algos.includes("logos-custom")) {
      algos.splice(algos.indexOf("logos") + 1, 0, "logos-custom");
    }
    const scenarioList = [...scenarios] as BenchmarkScenario[];
    if (!algos.length || !selectedSizes.size || !scenarioList.length) return;

    const sizes = [...selectedSizes].sort((a, b) => a - b);
    const total = sizes.length * algos.length;

    stopRef.current = false;
    excludedRef.current = new Set();
    setStatus("running");
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
      const fn = id === "quick"         ? makeQuickSort(quickPivot) :
                 id === "shell"         ? makeShellSort(shellGaps) :
                 id === "logos-custom"  ? makeLogosSort(logosParams) :
                 id === "logos"         ? makeLogosSort(DEFAULT_LOGOS_PARAMS) :
                 SORT_FNS[id];
      const stepsArr: SortStep[] = [];
      if (id === "logos" || id === "logos-custom") {
        const params = id === "logos-custom" ? logosParams : DEFAULT_LOGOS_PARAMS;
        for (const s of getLogosSortSteps([...prerunArr], params)) {
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
      } else {
        for (const s of sortSteps(id, [...prerunArr])) { stepsArr.push(s); if (stepsArr.length > 50_000) break; }
      }
      prerunStepsAcc[id] = stepsArr;
      const pCopy = [...prerunArr];
      const pt0 = performance.now();
      fn(pCopy);
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
      const customDist: CustomDistribution | undefined =
        customPreSorted > 0 || customDuplicates > 0
          ? { preSortedPct: customPreSorted, duplicatePct: customDuplicates }
          : undefined;
      // Build weighted pool: "sorted" appears once, all others three times — so it's rare in the mix.
      const weightedScenarios = scenarioList.flatMap(sc => sc === "sorted" ? [sc] : [sc, sc, sc]);
      const roundInputs = Array.from({ length: rounds }, () => {
        const sc = weightedScenarios[Math.floor(Math.random() * weightedScenarios.length)];
        return generateBenchmarkInput(sz, sc, customDist);
      });

      for (const id of algos) {
        if (stopRef.current) break;
        if (timedOutAlgos.has(id) || excludedRef.current.has(id)) { done++; setProgress({ done, total }); continue; }
        setCurrentAlgo(id);
        await new Promise<void>(resolve => {
          algoSleepResolveRef.current = resolve;
          algoSleepTimerRef.current = setTimeout(() => { resolve(); algoSleepResolveRef.current = null; algoSleepTimerRef.current = null; }, 0);
        });
        if (excludedRef.current.has(id)) { done++; setProgress({ done, total }); continue; }

        const fn = id === "quick"        ? makeQuickSort(quickPivot) :
                   id === "shell"        ? makeShellSort(shellGaps) :
                   id === "logos-custom" ? makeLogosSort(logosParams) :
                   id === "logos"        ? makeLogosSort(DEFAULT_LOGOS_PARAMS) :
                   SORT_FNS[id];
        let best = Infinity;
        let didTimeout = false;
        let lastElapsed = 0;
        const postWarmupTimes: number[] = [];

        for (let r = 0; r < rounds && !didTimeout; r++) {
          const input = roundInputs[r];

          // Capture per-algo proof on first encounter
          if (!capturedAlgos.has(id)) {
            const SAMPLE = 20;
            const step = Math.max(1, Math.floor(input.length / SAMPLE));
            const before = Array.from({ length: SAMPLE }, (_, i) => input[i * step]);
            const sorted = fn([...input]);
            const after = Array.from({ length: SAMPLE }, (_, i) => sorted[i * step]);
            setSampleProofs(prev => prev[id] ? prev : { ...prev, [id]: { before, after, n: sz } });
            capturedAlgos.add(id);
          }

          const copy = [...input];
          const t0 = performance.now();
          fn(copy);
          lastElapsed = performance.now() - t0;

          if (lastElapsed >= TIMEOUT_MS) { didTimeout = true; best = lastElapsed; break; }
          if (r >= warmup) {
            best = Math.min(best, lastElapsed);
            postWarmupTimes.push(lastElapsed);
          }
        }

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
        // performance.memory updates lazily so the diff is often 0 for fast sorts;
        // fall back to theoretical bytes in that case so the chart always has data.
        let spaceBytes: number;
        if (!didTimeout) {
          const perfMem = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
          let measured = 0;
          if (perfMem) {
            const spaceInput = generateBenchmarkInput(sz, scenarioList[0], customDist);
            const m0 = perfMem.usedJSHeapSize;
            fn(spaceInput);
            const m1 = perfMem.usedJSHeapSize;
            measured = Math.max(0, m1 - m0);
          }
          spaceBytes = measured > 0 ? measured : theoreticalSpaceBytes(id, sz);
        } else {
          spaceBytes = theoreticalSpaceBytes(id, sz);
        }

        if (!acc[id]) acc[id] = [];
        acc[id].push({ n: sz, timeMs: best, meanMs, stdDev, spaceBytes, timedOut: didTimeout || undefined });
        if (didTimeout) timedOutAlgos.add(id);

        done++;
        setCurveData(Object.fromEntries(Object.entries(acc).map(([k, v]) => [k, [...v]])));
        setProgress({ done, total });
        await new Promise<void>(r => setTimeout(r, 0));
      }
    }

    setCurrentN(null);
    setCurrentAlgo(null);
    setStatus("done");

    // ── Post-benchmark: count comparisons/swaps on a small fixed sample ──────
    // Run on n=2000 (large enough to be representative, small enough to be instant)
    const COUNT_N = 2_000;
    const countSample = generateBenchmarkInput(COUNT_N, "random");
    const counts: Record<string, { comparisons: number; swaps: number }> = {};
    for (const id of algos) {
      const c = countSortOps(id, countSample);
      if (c.comparisons > 0 || c.swaps > 0) counts[id] = c;
    }
    setOpCounts(counts);

    // ── Save run to history ────────────────────────────────────────────────────
    const snapshotAcc = acc;
    const entry: HistoryEntry = {
      id: Date.now().toString(),
      label: `${algos.map(id => ALGO_NAMES[id] ?? id).join(", ")} · ${scenarioList.join("/")} · n≤${fmtN(sizes[sizes.length-1])}`,
      timestamp: Date.now(),
      algos,
      results: Object.fromEntries(
        Object.entries(snapshotAcc).map(([id, pts]) => [id, pts.map(p => ({ n: p.n, timeMs: p.timeMs, spaceBytes: p.spaceBytes }))])
      ),
    };
    setRunHistory(prev => {
      const next = [entry, ...prev].slice(0, HISTORY_MAX);
      saveHistory(next);
      return next;
    });
  }, [selected, selectedSizes, scenarios, rounds, warmup, customPreSorted, customDuplicates, quickPivot, shellGaps, logosParams]); // eslint-disable-line react-hooks/exhaustive-deps

  const stop = () => { stopRef.current = true; };

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
    setOpCounts({});
  };

  const chartAlgosBase = runConfig?.algos ?? activeAlgos;
  // Inject the JS-emulation entry alongside native timsort whenever it's present
  const chartAlgos = chartAlgosBase.includes("timsort")
    ? [...chartAlgosBase, "timsort-js"]
    : chartAlgosBase;
  const chartSizes = runConfig?.sizes ?? sortedSizes;

  // Derive timsort-js curve by scaling native timsort measurements
  const curveDataExt: CurveData = React.useMemo(() => {
    if (!curveData["timsort"]) return curveData;
    return {
      ...curveData,
      "timsort-js": curveData["timsort"].map(p => ({
        ...p,
        timeMs: p.timeMs * TIMSORT_JS_MULTIPLIER,
        meanMs: p.meanMs != null ? p.meanMs * TIMSORT_JS_MULTIPLIER : undefined,
        stdDev: p.stdDev != null ? p.stdDev * TIMSORT_JS_MULTIPLIER : undefined,
      })),
    };
  }, [curveData]);

  // Summary table: rankings at the largest completed n
  const completedNs = new Set(
    Object.values(curveData).flatMap(pts => pts.map(p => p.n))
  );
  const largestDone = completedNs.size > 0 ? Math.max(...completedNs) : null;
  const summaryResults: SummaryResult[] = largestDone !== null
    ? chartAlgos
        .filter(id => id !== "timsort-js" && curveDataExt[id]?.some(p => p.n === largestDone && !p.timedOut))
        .map(id => ({
          id,
          timeMs: curveDataExt[id]!.find(p => p.n === largestDone)!.timeMs,
        }))
        .sort((a, b) => a.timeMs - b.timeMs)
        .map((r, i) => ({ ...r, rank: i + 1 }))
    : [];

  const summarySpaceResults: SummaryResult[] = largestDone !== null
    ? chartAlgos
        .filter(id => id !== "timsort-js" && curveDataExt[id]?.some(p => p.n === largestDone && !p.timedOut))
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
      if (pt && pt.timeMs < fastest) fastest = pt.timeMs;
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
    <div className="flex flex-col h-full overflow-hidden" style={{ position: "relative" }}>

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
      {/* Header */}
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

      {/* Body: single scroll on mobile, 50/50 split on desktop */}
      <div className="flex-1 overflow-y-auto lg:overflow-hidden flex flex-col lg:flex-row pb-20 lg:pb-0">

        {/* ── Left pane: config ── */}
        <div
          className="lg:w-1/2 lg:overflow-y-auto border-b lg:border-b-0 lg:border-r"
          style={{ borderColor: "var(--color-border)" }}
        >
          <div className="px-5 py-4">
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
                <div className="print:hidden flex gap-1.5 mt-2 mb-1.5">
                  {([
                    { label: "Small",  sizes: [100, 1_000, 10_000] },
                    { label: "Medium", sizes: [1_000, 10_000, 100_000] },
                    { label: "Large",  sizes: [100_000, 1_000_000, 10_000_000] },
                  ] as const).map(({ label, sizes }) => (
                    <button
                      key={label}
                      onClick={() => setSelectedSizes(new Set(sizes))}
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
                    return (
                      <button
                        key={n}
                        onClick={() => on ? removeSize(n) : addSize(n)}
                        disabled={disabled}
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
                      </button>
                    );
                  })}

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
                  {SCENARIO_PRESETS.map(preset => (
                    <button
                      key={preset.label}
                      title={preset.desc}
                      onClick={() => {
                        setSelected(new Set(preset.algos as unknown as string[]));
                        setSelectedSizes(new Set(preset.sizes as unknown as number[]));
                        setScenarios(new Set(preset.scenarios));
                        if (preset.pivot) setQuickPivot(preset.pivot);
                      }}
                      style={{
                        padding: "2px 9px", fontSize: 9, borderRadius: 4, cursor: "pointer",
                        background: "var(--color-surface-1)", border: "1px solid var(--color-border)",
                        color: "var(--color-muted)", whiteSpace: "nowrap",
                      }}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
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
                        <div className="flex flex-wrap gap-1.5">
                          {group.items.map(item => {
                            const disabled = slowDisabled(item.id);
                            const checked = selected.has(item.id) && !disabled;
                            const dotColor = ALGO_COLORS[item.id];
                            return (
                              <label
                                key={item.id}
                                className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs select-none"
                                style={{
                                  background: checked ? "rgba(139,58,42,0.08)" : "var(--color-surface-1)",
                                  border: `1px solid ${checked ? "var(--color-accent)" : "var(--color-border)"}`,
                                  color: disabled ? "var(--color-muted)" : "var(--color-text)",
                                  opacity: disabled ? 0.4 : 1,
                                  cursor: disabled ? "not-allowed" : "pointer",
                                }}
                              >
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
                                {item.name}
                                {item.id === "logos" && (() => {
                                  const hasCustom = (Object.keys(DEFAULT_LOGOS_PARAMS) as (keyof LogosParams)[]).some(k => logosParams[k] !== DEFAULT_LOGOS_PARAMS[k]);
                                  return (
                                    <button
                                      type="button"
                                      onClick={e => { e.preventDefault(); setLogosSettingsOpen(v => !v); }}
                                      title="Customize Logos Sort parameters"
                                      style={{
                                        marginLeft: 4,
                                        background: logosSettingsOpen ? "var(--color-accent-muted)" : hasCustom ? "rgba(85,85,85,0.08)" : "none",
                                        border: `1px solid ${logosSettingsOpen ? "var(--color-accent)" : hasCustom ? "#555555" : "var(--color-border)"}`,
                                        borderRadius: 4,
                                        cursor: "pointer",
                                        padding: "1px 4px",
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: 3,
                                        color: logosSettingsOpen ? "var(--color-accent)" : hasCustom ? "#555555" : "var(--color-muted)",
                                        fontSize: 9,
                                        lineHeight: 1,
                                      }}
                                    >
                                      <Settings size={9} strokeWidth={1.75} />
                                      {hasCustom ? "custom ●" : "custom"}
                                    </button>
                                  );
                                })()}
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {logosSettingsOpen && has("advanced") && (
                  <div className="mt-3 rounded-lg p-3 flex flex-col gap-2.5" style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)" }}>
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold" style={{ color: "var(--color-text)" }}>Logos Sort — parameters</p>
                      <button
                        type="button"
                        onClick={() => setLogosParams(DEFAULT_LOGOS_PARAMS)}
                        style={btn("ghost", { fontSize: 9, padding: "1px 6px", color: "var(--color-muted)", textDecoration: "underline", textDecorationStyle: "dotted" })}
                      >reset defaults</button>
                    </div>
                    {(Object.keys(DEFAULT_LOGOS_PARAMS) as (keyof LogosParams)[]).some(k => logosParams[k] !== DEFAULT_LOGOS_PARAMS[k]) && (
                      <p className="text-[10px] px-2 py-1 rounded" style={{ background: "rgba(85,85,85,0.08)", color: "#555555", border: "1px solid rgba(192,57,43,0.25)" }}>
                        Params differ from defaults — both <strong>Logos Sort</strong> and <strong>Logos (custom)</strong> will run automatically.
                      </p>
                    )}
                    {([
                      { key: "phi",          label: "φ (phi)",           min: 0.05, max: 1.0,  step: 0.001, desc: "Primary pivot offset — φ⁻¹ ≈ 0.618" },
                      { key: "phi2",         label: "φ² (phi2)",         min: 0.05, max: 1.0,  step: 0.001, desc: "Secondary pivot offset — φ⁻² ≈ 0.382" },
                      { key: "base",         label: "Base",              min: 2,    max: 256,  step: 1,     desc: "Insertion sort threshold (elements)" },
                      { key: "depthMult",    label: "Depth multiplier",  min: 1,    max: 6,    step: 0.5,   desc: "Depth limit = mult·⌊log₂n⌋ + add" },
                      { key: "depthAdd",     label: "Depth addend",      min: 0,    max: 16,   step: 1,     desc: "Constant added to depth limit" },
                      { key: "randomScale",  label: "Random scale",      min: 0,    max: 3,    step: 0.05,  desc: "Scales ±randomFactor range (0 = fixed pivots)" },
                      { key: "countingMult", label: "Counting trigger",  min: 1,    max: 32,   step: 1,     desc: "Counting sort when valueRange < n×this" },
                    ] as const).map(({ key, label, min, max, step, desc }) => (
                      <div key={key} className="flex flex-col gap-0.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs" style={{ color: "var(--color-text)" }}>{label}</span>
                          <span className="text-xs font-mono" style={{ color: "var(--color-accent)" }}>{logosParams[key]}</span>
                        </div>
                        <input
                          type="range"
                          min={min} max={max} step={step}
                          value={logosParams[key]}
                          onChange={e => setLogosParams(prev => ({ ...prev, [key]: parseFloat(e.target.value) }))}
                          style={{ accentColor: "var(--color-accent)", width: "100%" }}
                        />
                        <p className="text-[10px]" style={{ color: "var(--color-muted)" }}>{desc}</p>
                      </div>
                    ))}
                  </div>
                )}

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
                    {maxSelectedSize > LARGE_THRESHOLD && (
                      <p className="text-xs" style={{ color: "var(--color-state-swap)" }}>
                        ⚠ Only Logos Sort and Tim Sort run above n={fmtN(LARGE_THRESHOLD)}.
                      </p>
                    )}
                  </div>
                )}
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
                  <div className="mt-3 flex flex-col gap-4">
                    {/* Scenario wheel */}
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--color-muted)" }}>
                        Scenarios <span className="font-normal normal-case" style={{ color: "var(--color-muted)" }}>— one drawn at random per round</span>
                      </p>
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
                    </div>

                    {/* Rounds + Warmup */}
                    <div className="flex flex-wrap items-end gap-5">
                      <div className="flex flex-col gap-1">
                        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-muted)" }}>Rounds</span>
                        <Spinner value={rounds} onChange={setRounds} min={1} max={50} label="Rounds" />
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-muted)" }}>Warmup (discard first)</span>
                        <Spinner value={warmup} onChange={v => setWarmup(Math.min(v, rounds - 1))} min={0} max={Math.max(0, rounds - 1)} label="Warmup" />
                      </div>
                      <span className="text-xs pb-0.5" style={{ color: "var(--color-muted)" }}>
                        {Math.max(0, rounds - warmup)} rounds recorded · best kept
                      </span>
                    </div>

                    {/* Per-algorithm options */}
                    {(selected.has("quick") || selected.has("shell")) && (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--color-muted)" }}>
                          Algorithm options
                        </p>
                        <div className="flex flex-col gap-2">
                          {selected.has("quick") && (
                            <div className="flex items-start gap-3">
                              <span className="text-xs shrink-0 pt-0.5" style={{ color: "var(--color-muted)", width: 128 }}>
                                Quick Sort pivot
                              </span>
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
                              <span className="text-xs shrink-0 pt-0.5" style={{ color: "var(--color-muted)", width: 128 }}>
                                Shell Sort gaps
                              </span>
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
                      </div>
                    )}

                    {/* Custom distribution sliders */}
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--color-muted)" }}>
                        Custom distribution <span className="font-normal normal-case">— layered on top of selected scenarios</span>
                      </p>
                      <div className="flex flex-col gap-2">
                        {([
                          { label: "% pre-sorted prefix", value: customPreSorted, set: setCustomPreSorted },
                          { label: "% duplicate injection", value: customDuplicates, set: setCustomDuplicates },
                        ] as const).map(({ label, value, set }) => (
                          <div key={label} className="flex items-center gap-3">
                            <span className="text-xs font-mono shrink-0" style={{ color: "var(--color-muted)", width: 150 }}>{label}</span>
                            <input
                              type="range" min={0} max={100} step={5} value={value}
                              onChange={e => set(Number(e.target.value))}
                              style={{ flex: 1, accentColor: "var(--color-accent)" }}
                            />
                            <span className="text-xs font-mono shrink-0" style={{ color: "var(--color-text)", width: 32, textAlign: "right" }}>
                              {value}%
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>}

              {/* Buttons */}
              {status !== "running" && (
                <p className="text-xs mb-1.5 print:hidden" style={{ color: "var(--color-muted)" }}>
                  {activeAlgos.length} algo{activeAlgos.length !== 1 ? "s" : ""} · {sortedSizes.length} size{sortedSizes.length !== 1 ? "s" : ""} · {rounds} run{rounds !== 1 ? "s" : ""} · discard {warmup}
                </p>
              )}
              <div className="print:hidden flex gap-1.5">
                <button
                  onClick={run}
                  disabled={!canRun}
                  style={btn("primary", { padding: "4px 12px", flex: 1, justifyContent: "center", opacity: canRun ? 1 : 0.5, cursor: canRun ? "pointer" : "not-allowed" })}
                >
                  <Play size={11} strokeWidth={2} />
                  {status === "running"
                    ? `${currentAlgo ? ALGO_NAMES[currentAlgo] : "…"} at n=${currentN?.toLocaleString()} (${progress.done}/${progress.total})`
                    : "Run"
                  }
                </button>

                {status === "running" && (
                  <button onClick={stop} style={btn("danger", { padding: "4px 12px" })}>
                    <Square size={11} strokeWidth={2} fill="currentColor" /> Stop
                  </button>
                )}

                {status === "done" && (
                  <button onClick={reset} style={btn("secondary", { padding: "4px 12px" })}>
                    <RotateCcw size={11} strokeWidth={1.75} /> Reset
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Right pane: results ── */}
        <div className="lg:w-1/2 lg:overflow-y-auto">
          <div className="px-5 py-4 flex flex-col gap-4">
            {/* Algorithm mini-cards — always visible */}
            {chartAlgosBase.length > 0 && (
              <div
                className="rounded-xl p-3"
                style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)" }}
              >
                <div className="flex items-center justify-between mb-2.5">
                  <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-muted)" }}>
                    Algorithms
                  </p>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs" style={{ color: "var(--color-muted)" }}>Sort by:</span>
                    <div className="flex rounded overflow-hidden" style={{ border: "1px solid var(--color-border)" }}>
                      {(["space", "time"] as const).map(mode => (
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
                          {mode === "space" ? "Space" : "Time"} Big O
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                {(() => {
                  const sortedCards = [...chartAlgosBase].sort((a, b) => {
                    const rankA = BIG_O_RANK[miniCardSort === "space" ? (ALGO_SPACE[a] ?? "") : (ALGO_TIME[a] ?? "")] ?? 99;
                    const rankB = BIG_O_RANK[miniCardSort === "space" ? (ALGO_SPACE[b] ?? "") : (ALGO_TIME[b] ?? "")] ?? 99;
                    return rankA - rankB;
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
                          rank={(miniCardSort === "space" ? summarySpaceResults : summaryResults).find(r => r.id === id)?.rank ?? null}
                          loop={status === "running"}
                          maxSpaceBytes={maxSpaceBytes}
                          maxTotalSteps={maxTotalSteps}
                          onStop={status === "running" ? () => stopAlgo(id) : undefined}
                          pulseEnabled={pulseEnabled}
                          onTogglePulse={togglePulse}
                        />
                      ))}
                    </div>
                  );
                })()}
              </div>
            )}

            {(hasCurveData || status === "running") && (
              <div
                className="rounded-xl p-4"
                style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)", display: "flex", flexDirection: "column" }}
              >
                {/* Results header */}
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-semibold text-sm mb-0.5" style={{ color: "var(--color-text)" }}>
                      {chartMode === "time" ? "Performance curve" : chartMode === "space" ? "Space usage curve" : chartMode === "3d" ? "3D: time × space × n" : "Normalized curve (time / n·log₂n)"}
                    </p>
                    {runConfig && (
                      <div className="flex flex-wrap items-center gap-1.5 mt-1">
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
                    {status === "running" && (
                      <p className="text-xs mt-0.5" style={{ color: "var(--color-muted)" }}>
                        Timing {currentAlgo ? ALGO_NAMES[currentAlgo] : "…"} at n={currentN?.toLocaleString()}…
                        <span className="ml-2 font-mono">({progress.done}/{progress.total})</span>
                      </p>
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
                        onClick={exportCSV}
                        title="Download benchmark data as CSV"
                        style={btn("secondary", { padding: "2px 8px", fontSize: 9 })}
                      >
                        ↓ CSV
                      </button>
                    )}
                  </div>
                </div>

                <div style={{ order: 1 }}>
                {/* Curve chart */}
                {hasCurveData && (
                  <>
                    {/* Time / Space toggle — centered above the chart */}
                    <div className="print:hidden" style={{ display: "flex", justifyContent: "center", marginBottom: 4, marginTop: 15 }}>
                    <div className="flex rounded overflow-hidden" style={{ border: "1px solid var(--color-border)" }}>
                      {([
                        { id: "time",         label: "time",        title: undefined,                                                              minLevel: "basic" },
                        { id: "space",        label: "space",       title: undefined,                                                              minLevel: "advanced" },
                        { id: "ratio",        label: "t / n·log n", title: "Normalize time by n·log₂n — flat = O(n log n)",                       minLevel: "advanced" },
                        { id: "space-ratio",  label: "s / n·log n", title: "Normalize space by n·log₂n — flat = O(n log n) space",                minLevel: "advanced" },
                        { id: "3d",           label: "3D",          title: "Interactive 3D: time × space × n (drag to orbit, scroll to zoom)",    minLevel: "research" },
                        { id: "memory",       label: "Memory",      title: "Peak vs average theoretical memory usage per algorithm",                minLevel: "advanced" },
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
                    </div>{/* end centering wrapper */}

                    {/* 3D chart, memory chart, or 2D curve chart */}
                    {chartMode === "memory" ? (
                      <MemoryChart
                        algos={chartAlgos.filter(id => id !== "timsort-js")}
                        n={largestDone ?? (chartSizes[chartSizes.length - 1] ?? 1000)}
                      />
                    ) : chartMode === "3d" ? (
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

                        {/* Mathematical analysis panel — shown below time and space charts */}
                        {has("research") && (chartMode === "time" || chartMode === "space") && status === "done" && (
                          <MathPanel
                            data={curveDataExt}
                            algos={chartAlgos.filter(id => id !== "timsort-js")}
                            mode={chartMode}
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
                    {chartAlgos.includes("timsort-js") && (
                      <p className="text-xs" style={{ color: "var(--color-muted)" }}>
                        <span style={{ color: ALGO_COLORS["timsort-js"] }}>TimSort (JS est.)</span>
                        {" "}— native .sort() × {TIMSORT_JS_MULTIPLIER}. Pure-JS comparisons avoid the JS {"<=>"} C++ callback overhead measured in this V8 environment.
                      </p>
                    )}
                  </div>
                )}

                </div>{/* end order:1 chart section */}

                <div style={{ order: 2 }}>
                {/* Rankings table at largest completed n */}
                {summaryResults.length > 0 && (() => {
                  const COL = { bl: "1px solid var(--color-border)", pl: 4 } as const;
                  const BAR_W = 40; // each bar column (speed + space) is 40px

                  // Measure name column: longest display name × ~5.5px + rank(14) + dot(5) + gaps(10)
                  const longestName = Math.max(...tableRows.map(r => {
                    if (r.kind === "ref") return r.label.length;
                    if (r.id === "timsort-js") return "TimSort".length;
                    return ALGO_NAMES[r.id]?.length ?? 0;
                  }));
                  const NAME_W = Math.ceil(longestName * 5.5) + 29;

                  const spaceFastest = Math.min(
                    ...summaryResults
                      .map(r => curveDataExt[r.id]?.find(p => p.n === largestDone)?.spaceBytes ?? Infinity)
                      .filter(v => v > 0 && v < Infinity)
                  );
                  const spaceSlowest = Math.max(
                    ...summaryResults
                      .map(r => curveDataExt[r.id]?.find(p => p.n === largestDone)?.spaceBytes ?? 0),
                    1
                  );

                  // Shared cell style helpers — data cols share remaining space evenly via flex:1
                  const cellHd = (i: number): React.CSSProperties => ({
                    flex: 1, textAlign: "center", fontSize: 8, fontFamily: "monospace",
                    color: "var(--color-muted)", borderLeft: i > 0 ? COL.bl : undefined, paddingLeft: i > 0 ? COL.pl : 0,
                  });
                  const cell = (color: string, i: number): React.CSSProperties => ({
                    flex: 1, textAlign: "center", fontFamily: "monospace",
                    color, borderLeft: i > 0 ? COL.bl : undefined, paddingLeft: i > 0 ? COL.pl : 0, overflow: "hidden",
                  });

                  const handleSort = (col: SortCol) => {
                    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
                    else { setSortCol(col); setSortDir("asc"); }
                  };
                  const sortIcon = (col: SortCol) => sortCol === col ? (sortDir === "asc" ? " ↑" : " ↓") : "";
                  const hdBtn = (col: SortCol, i: number): React.CSSProperties => ({
                    ...cellHd(i),
                    cursor: "pointer", userSelect: "none", background: "none", border: "none", padding: 0,
                    color: sortCol === col ? "var(--color-text)" : "var(--color-muted)",
                  });

                  // Precompute per-algo sort keys (space/fit values)
                  const algoSortKeys = new Map(summaryResults.map(r => {
                    const sv = curveDataExt[r.id]?.find(p => p.n === largestDone)?.spaceBytes ?? 0;
                    const sr = sv > 0 && spaceFastest > 0 && spaceFastest < Infinity ? sv / spaceFastest : 0;
                    const tp = (curveDataExt[r.id] ?? []).filter(p => p.timeMs > 0).map(p => ({ n: p.n, val: p.timeMs }));
                    const sp = (curveDataExt[r.id] ?? []).filter(p => (p.spaceBytes ?? 0) > 0).map(p => ({ n: p.n, val: p.spaceBytes! }));
                    const tf = fitLogLog(tp);
                    const sf = fitLogLog(sp);
                    return [r.id, {
                      spaceVal: sv, spaceRatio: sr,
                      tLabel: tf?.label ?? (ALGO_TIME[r.id]?.replace(/^O\(/, "").replace(/\)$/, "").replace(/ log n/g, "logn") ?? ""),
                      sLabel: sf?.label ?? (ALGO_SPACE[r.id]?.replace(/^O\(/, "").replace(/\)$/, "").replace(/ log n/g, "logn") ?? ""),
                      fitK: tf?.k,
                    }];
                  }));

                  const algoName = (id: string) => id === "timsort-js" ? "TimSort (est)" : (ALGO_NAMES[id] ?? "");
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
                    <div className="mt-4 pt-4" style={{ borderTop: "1px solid var(--color-border)", fontSize: 10 }}>
                      {/* Title */}
                      <p className="font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--color-muted)", fontSize: 9 }}>
                        Rankings
                        {largestDone != null && <> · n={largestDone.toLocaleString()}</>}
                        {chartSizes.length > 1 && <span style={{ fontWeight: 400, textTransform: "none" }}> (largest)</span>}
                      </p>

                      {/* Column headers */}
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
                        <div style={{ flex: 1, display: "flex", borderLeft: COL.bl }}>
                          <button style={hdBtn("time", 0)} onClick={() => handleSort("time")}>time{sortIcon("time")}</button>
                          <button style={hdBtn("tvsb", 1)} onClick={() => handleSort("tvsb")}>t vs best{sortIcon("tvsb")}</button>
                          <button style={hdBtn("tbigo", 1)} onClick={() => handleSort("tbigo")}>t big O{sortIcon("tbigo")}</button>
                          <button style={hdBtn("fit", 1)} onClick={() => handleSort("fit")} title="Empirically fitted exponent k (time ∝ nᵏ)">fit nᵏ{sortIcon("fit")}</button>
                          <div style={cell("var(--color-muted)", 1)} title="Comparisons at n=2 000 (instrumented, not timed)">cmps</div>
                          <div style={cell("var(--color-muted)", 1)} title="Swaps/writes at n=2 000 (instrumented, not timed)">swps</div>
                          <div style={cell("var(--color-muted)", 1)} title="Working-set cache level at the largest measured n">cache</div>
                          <button style={hdBtn("space", 1)} onClick={() => handleSort("space")}>space{sortIcon("space")}</button>
                          <button style={hdBtn("svsb", 1)} onClick={() => handleSort("svsb")}>s vs best{sortIcon("svsb")}</button>
                          <button style={hdBtn("sbigo", 1)} onClick={() => handleSort("sbigo")}>s big O{sortIcon("sbigo")}</button>
                        </div>
                      </div>

                      {/* Rows */}
                      <div className="flex flex-col gap-1.5">
                        {/* Timed-out algorithms with fitted-curve estimate */}
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
                                <div style={{ flex: 1, display: "flex", borderLeft: COL.bl }}>
                                  <div style={cell("var(--color-state-swap)", 0)} title={estMs != null ? `Extrapolated from fit on non-timed-out points` : "Not enough data to estimate"}>
                                    {estMs != null ? `~${fmtPredicted(estMs)}` : ">10 s"}
                                  </div>
                                  <div style={cell("var(--color-muted)", 1)}>{estMs != null ? `${(estMs / summaryFastest).toFixed(0)}×` : "—"}</div>
                                  <div style={cell("var(--color-muted)", 1)}>{ALGO_TIME[id]?.replace(/^O\(/, "").replace(/\)$/, "").replace(/ log n/g, "logn") ?? "—"}</div>
                                  <div style={cell("var(--color-muted)", 1)}>{fit?.label ?? "—"}</div>
                                  <div style={cell("var(--color-muted)", 1)}>—</div>
                                  <div style={cell("var(--color-muted)", 1)}>—</div>
                                  <div style={cell("var(--color-muted)", 1)}>—</div>
                                  <div style={cell("var(--color-muted)", 1)}>—</div>
                                  <div style={cell("var(--color-muted)", 1)}>—</div>
                                  <div style={cell("var(--color-muted)", 1)}>{ALGO_SPACE[id]?.replace(/^O\(/, "").replace(/\)$/, "").replace("log n", "logn") ?? "—"}</div>
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
                                    <div style={{
                                      width: `${overScale ? 100 : barPct}%`, height: "100%", borderRadius: 3, minWidth: 3,
                                      background: row.color, opacity: 0.4,
                                      backgroundImage: "repeating-linear-gradient(90deg, transparent, transparent 4px, rgba(0,0,0,0.25) 4px, rgba(0,0,0,0.25) 5px)",
                                    }} />
                                  </div>
                                </div>
                                <div style={{ width: BAR_W, flexShrink: 0, padding: "0 5px", display: "flex", alignItems: "center" }}>
                                  <div style={{ flex: 1, borderRadius: 3, background: "var(--color-surface-3)", height: 8 }} />
                                </div>
                                <div style={{ flex: 1, display: "flex", borderLeft: COL.bl }}>
                                  <div style={cell(row.color, 0)}>{overScale ? "↑" : ""}{fmtPredicted(row.timeMs)}</div>
                                  <div style={cell("var(--color-muted)", 1)}>{(row.timeMs / summaryFastest).toFixed(1)}×</div>
                                  <div style={cell("var(--color-muted)", 1)}>{row.label.replace(/^O\(/, "").replace(/\)$/, "").replace(/ log n/g, "logn")}</div>
                                  <div style={cell("var(--color-muted)", 1)}>—</div>
                                  <div style={cell("var(--color-muted)", 1)}>—</div>
                                  <div style={cell("var(--color-muted)", 1)}>—</div>
                                  <div style={cell("var(--color-muted)", 1)}>—</div>
                                  <div style={cell("var(--color-muted)", 1)}>—</div>
                                  <div style={cell("var(--color-muted)", 1)}>—</div>
                                  <div style={cell("var(--color-muted)", 1)}>—</div>
                                </div>
                              </div>
                            );
                          }

                          const barPct     = summarySlowest > 0 ? (row.timeMs / summarySlowest) * 100 : 0;
                          const rankClr    = rankColor(row.rank, summaryResults.length);
                          const dotColor   = ALGO_COLORS[row.id];
                          const spaceVal   = curveDataExt[row.id]?.find(p => p.n === largestDone)?.spaceBytes;
                          const spaceRatio = spaceVal && spaceFastest > 0 && spaceFastest < Infinity ? spaceVal / spaceFastest : null;
                          const timeStr    = fmtTime(row.timeMs);
                          const spaceStr   = spaceVal != null && spaceVal > 0
                            ? fmtBytes(spaceVal)
                            : (ALGO_SPACE[row.id]?.replace(/^O\(/, "").replace(/\)$/, "").replace("log n", "logn") ?? "—");
                          const spRatioStr = spaceRatio != null ? (spaceRatio < 1.05 ? "—" : `${spaceRatio.toFixed(1)}×`) : "—";
                          const timePts  = (curveDataExt[row.id] ?? []).filter(p => p.timeMs > 0).map(p => ({ n: p.n, val: p.timeMs }));
                          const spacePts = (curveDataExt[row.id] ?? []).filter(p => (p.spaceBytes ?? 0) > 0).map(p => ({ n: p.n, val: p.spaceBytes! }));
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
                            const n        = largestDone;
                            const spaceClz = ALGO_SPACE[row.id] ?? "unknown";

                            // Build space breakdown explanation specific to this n
                            let spaceBreakdown: Record<string, unknown>;
                            if (spaceClz === "O(1)") {
                              spaceBreakdown = {
                                class: "O(1) — constant",
                                explanation: "In-place sort. Uses only a fixed number of scalar variables regardless of n (loop counter, swap temp, pivot). No auxiliary arrays.",
                                constant_overhead_bytes: 200,
                              };
                            } else if (spaceClz === "O(log n)") {
                              const depth = Math.ceil(Math.log2(Math.max(n, 2)));
                              spaceBreakdown = {
                                class: "O(log n) — logarithmic",
                                explanation: `Recursive algorithm. Maximum call stack depth = ⌈log₂(${n})⌉ = ${depth} frames. Each frame holds a constant set of local variables (~64 bytes).`,
                                max_recursion_depth: depth,
                                bytes_per_frame: 64,
                                total_bytes: depth * 64,
                              };
                            } else if (spaceClz === "O(n)") {
                              spaceBreakdown = {
                                class: "O(n) — linear",
                                explanation: `Requires an auxiliary array of n elements for merge operations. ${n.toLocaleString()} elements × 8 bytes (Float64) = ${(n * 8).toLocaleString()} bytes.`,
                                auxiliary_elements: n,
                                bytes_per_element: 8,
                                total_bytes: n * 8,
                              };
                            } else {
                              spaceBreakdown = {
                                class: spaceClz,
                                explanation: "See algorithm documentation.",
                                theoretical_bytes: theoreticalSpaceBytes(row.id, n),
                              };
                            }

                            const sampleCount = Math.min(Math.ceil(n * 0.05), 25);
                            const inputSample = generateBenchmarkInput(sampleCount, "random");
                            const sortedSample = SORT_FNS[row.id]?.([...inputSample]) ?? [...inputSample].sort((a, b) => a - b);

                            const proof = {
                              proof_type: "space_complexity_verification",
                              algorithm: ALGO_NAMES[row.id],
                              n,
                              time_complexity: ALGO_TIME[row.id],
                              space_complexity: spaceClz,
                              space_breakdown: spaceBreakdown,
                              measured_heap_delta_bytes: (spaceVal != null && spaceVal > 0) ? spaceVal : null,
                              theoretical_bytes: theoreticalSpaceBytes(row.id, n),
                              input_sample: {
                                note: `${sampleCount} of ${n.toLocaleString()} elements (${sampleCount === 25 ? "capped at 25" : "5%"}). Same distribution as benchmark inputs: uniform integers in [0, 10 000).`,
                                count: sampleCount,
                                values: inputSample,
                                sorted: sortedSample,
                              },
                              generated_at: new Date().toISOString(),
                            };

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
                                  {row.id === "timsort-js" ? (
                                    <span className="truncate" style={{ color: "var(--color-text)", fontWeight: row.rank === 1 ? 600 : 400 }}>TimSort</span>
                                  ) : (
                                    <span className="truncate" style={{ color: "var(--color-text)", fontWeight: row.rank === 1 ? 600 : 400 }}>{ALGO_NAMES[row.id]}</span>
                                  )}
                                  {row.id === "timsort-js" && (
                                    <span style={{ fontSize: 8, color: "var(--color-muted)", fontWeight: 400 }}>JS estimate</span>
                                  )}
                                  {/* Adversarial input shortcut */}
                                  {has("research") && row.id !== "timsort-js" && largestDone != null && (
                                    <button
                                      title={`Load worst-case input for ${ALGO_NAMES[row.id]}`}
                                      onClick={() => {
                                        const arr = makeAdversarialInput(row.id, Math.min(largestDone, 100));
                                        alert(`Adversarial input for ${ALGO_NAMES[row.id]} (n=${Math.min(largestDone, 100)}):\n[${arr.slice(0,20).join(", ")}${arr.length > 20 ? "..." : ""}]`);
                                      }}
                                      style={{ fontSize: 7, padding: "0px 4px", borderRadius: 2, cursor: "pointer", background: "rgba(239,83,80,0.1)", border: "1px solid rgba(239,83,80,0.25)", color: "#ef5350", marginTop: 1 }}
                                    >⚠ worst</button>
                                  )}
                                </span>
                              </div>
                              <div style={{ width: BAR_W, flexShrink: 0, padding: "0 5px", display: "flex", alignItems: "center" }}>
                                <div style={{ flex: 1, borderRadius: 3, overflow: "hidden", background: "var(--color-surface-3)", height: 8 }}>
                                  <div style={{
                                    width: `${barPct}%`, height: "100%", borderRadius: 3, minWidth: barPct > 0 ? 3 : 0,
                                    background: dotColor, opacity: 0.85, transition: "width 0.35s ease",
                                  }} />
                                </div>
                              </div>
                              <div style={{ width: BAR_W, flexShrink: 0, padding: "0 5px", display: "flex", alignItems: "center" }}>
                                <div style={{ flex: 1, borderRadius: 3, overflow: "hidden", background: "var(--color-surface-3)", height: 8 }}>
                                  <div style={{
                                    width: `${spaceVal ? Math.min(100, (spaceVal / spaceSlowest) * 100) : 0}%`,
                                    height: "100%", borderRadius: 3, minWidth: spaceVal ? 3 : 0,
                                    background: dotColor, opacity: 0.5, transition: "width 0.35s ease",
                                  }} />
                                </div>
                              </div>
                              <div style={{ flex: 1, display: "flex", borderLeft: COL.bl }}>
                                <div style={cell(rankClr, 0)}>{timeStr}</div>
                                <div style={cell("var(--color-muted)", 1)}>{row.rank === 1 ? "—" : `${(row.timeMs / summaryFastest).toFixed(1)}×`}</div>
                                <div
                                  style={{ ...cell("var(--color-text)", 1), opacity: 0.75, cursor: "default" }}
                                  title={ALGO_TIME[row.id]}
                                  onMouseEnter={() => setHoverBigO({ id: row.id, type: "time" })}
                                  onMouseLeave={() => setHoverBigO(null)}
                                >
                                  {isHoverT && tPct !== null ? fmtPct(tPct) : tBigOLabel}
                                </div>
                                <div
                                  style={{ ...cell("var(--color-muted)", 1), opacity: 0.8, cursor: "default" }}
                                  title={timeFit ? `Empirical fit: time ∝ n^${timeFit.k.toFixed(3)} (log-log regression on measured points)` : "Not enough data to fit"}
                                >
                                  {timeFit ? `n${toSup(timeFit.k.toFixed(2))}` : "—"}
                                </div>
                                {/* Comparison/swap counts at n=2000 */}
                                {(() => {
                                  const ops = opCounts[row.id];
                                  const fmtOps = (n: number) => {
                                    const f = (v: number) => v % 1 === 0 ? v.toFixed(0) : v.toPrecision(3).replace(/\.?0+$/, "");
                                    if (n >= 1_000_000_000) return `${f(n / 1_000_000_000)}B`;
                                    if (n >= 1_000_000)     return `${f(n / 1_000_000)}M`;
                                    if (n >= 1_000)         return `${f(n / 1_000)}K`;
                                    return String(n);
                                  };
                                  return (
                                    <>
                                      <div style={cell("var(--color-muted)", 1)} title={ops ? `${ops.comparisons.toLocaleString()} comparisons at n=2,000` : "Only available for insertion/bubble/selection/shell/merge/quick/heap"}>
                                        {ops ? fmtOps(ops.comparisons) : "—"}
                                      </div>
                                      <div style={cell("var(--color-muted)", 1)} title={ops ? `${ops.swaps.toLocaleString()} swaps/writes at n=2,000` : "—"}>
                                        {ops ? fmtOps(ops.swaps) : "—"}
                                      </div>
                                    </>
                                  );
                                })()}
                                {/* Cache level at largestDone */}
                                {(() => {
                                  if (!largestDone) return <div style={cell("var(--color-muted)", 1)}>—</div>;
                                  const cl = cacheLevel(row.id, largestDone);
                                  return (
                                    <div style={cell(cl.color, 1)} title={`Array of ${largestDone.toLocaleString()} × 8B = ${fmtBytes(largestDone * 8)} working set → ${cl.label}`}>
                                      {cl.label}
                                    </div>
                                  );
                                })()}
                                <div style={{ ...cell("var(--color-text)", 1), opacity: 0.75 }} title={ALGO_SPACE[row.id]}>
                                  {canDl && has("research") ? (
                                    <a onClick={handleDl} style={{ color: "var(--color-accent)", cursor: "pointer", textDecoration: "underline", fontFamily: "monospace" }} title={`Download space proof (${fmtBytes(spaceVal ?? 0)})`}>{spaceStr}</a>
                                  ) : spaceStr}
                                </div>
                                <div style={cell("var(--color-muted)", 1)}>{spRatioStr}</div>
                                <div
                                  style={{ ...cell("var(--color-text)", 1), opacity: 0.75, cursor: "default", ...(row.id === "logos" ? { fontWeight: "bold", fontSize: "calc(1em * 1.1618)" } : {}) }}
                                  title={ALGO_SPACE[row.id]}
                                  onMouseEnter={() => setHoverBigO({ id: row.id, type: "space" })}
                                  onMouseLeave={() => setHoverBigO(null)}
                                >
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
                </div>{/* end order:1 rankings section */}
              </div>
            )}

          </div>
        </div>

        {/* ── Run history ────────────────────────────────────────────────────── */}
        {has("research") && runHistory.length > 0 && (
          <div className="mt-6 print:hidden">
            <button
              onClick={() => setHistoryOpen(h => !h)}
              className="flex items-center gap-1 mb-2"
              style={btn("ghost", { padding: 0, fontSize: 9, fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase" })}
            >
              <ChevronRight size={12} style={{ transform: historyOpen ? "rotate(90deg)" : "none", transition: "transform 0.15s ease" }} />
              Run history ({runHistory.length})
            </button>
            {historyOpen && (
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {runHistory.map(entry => {
                  const isOverlay = overlayHistory?.id === entry.id;
                  const date = new Date(entry.timestamp);
                  const timeStr = `${date.getHours().toString().padStart(2,"0")}:${date.getMinutes().toString().padStart(2,"0")}`;
                  return (
                    <div key={entry.id} style={{
                      display: "flex", alignItems: "center", gap: 8,
                      padding: "5px 8px", borderRadius: 5,
                      background: isOverlay ? "rgba(139,58,42,0.08)" : "var(--color-surface-1)",
                      border: `1px solid ${isOverlay ? "var(--color-accent)" : "var(--color-border)"}`,
                    }}>
                      <span style={{ fontSize: 8, fontFamily: "monospace", color: "var(--color-muted)", flexShrink: 0 }}>{timeStr}</span>
                      <span style={{ fontSize: 9, color: "var(--color-text)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{entry.label}</span>
                      <button onClick={() => setOverlayHistory(isOverlay ? null : entry)} style={{
                        padding: "1px 8px", fontSize: 9, borderRadius: 3, cursor: "pointer",
                        background: isOverlay ? "var(--color-accent)" : "var(--color-surface-2)",
                        border: `1px solid ${isOverlay ? "var(--color-accent)" : "var(--color-border)"}`,
                        color: isOverlay ? "#fff" : "var(--color-muted)", flexShrink: 0,
                      }}>
                        {isOverlay ? "✓ overlaid" : "overlay"}
                      </button>
                      <button onClick={() => {
                        setRunHistory(prev => { const next = prev.filter(e => e.id !== entry.id); saveHistory(next); return next; });;
                        if (overlayHistory?.id === entry.id) setOverlayHistory(null);
                      }} style={{
                        padding: "1px 6px", fontSize: 9, borderRadius: 3, cursor: "pointer",
                        background: "none", border: "1px solid var(--color-border)", color: "var(--color-muted)", flexShrink: 0,
                      }}>✕</button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

      </div>

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
          <button onClick={stop} style={btn("danger", { flex: 1, justifyContent: "center", padding: "6px 0" })}>
            <Square size={13} strokeWidth={2} fill="currentColor" /> Stop
          </button>
        ) : (
          <button
            onClick={run}
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
