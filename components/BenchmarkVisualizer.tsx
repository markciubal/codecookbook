"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import { Play, Square, RotateCcw, Trophy, LineChart, ChevronRight, Lock, Unlock } from "lucide-react";
import { generateBenchmarkInput, SORT_FNS, type BenchmarkScenario } from "@/lib/benchmark";

// ── Static config ─────────────────────────────────────────────────────────────

const SLOW_IDS = new Set(["insertion", "selection", "bubble"]);
const SLOW_THRESHOLD = 5_000;
// Only Logos Sort and Tim Sort are allowed above 5 M elements
const UNLIMITED_IDS = new Set(["logos", "timsort"]);
const LARGE_THRESHOLD = 5_000_000;
const TIMEOUT_MS = 10_000;

const ALGO_GROUPS = [
  {
    label: "O(n log n)",
    items: [
      { id: "logos",   name: "Logos Sort",     href: "/sorting/logos" },
      { id: "timsort", name: "Tim Sort",        href: "/sorting/timsort" },
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
    ],
  },
] as const;

const ALGO_NAMES: Record<string, string> = {
  logos: "Logos Sort", timsort: "Tim Sort",   merge: "Merge Sort",
  quick: "Quick Sort", heap: "Heap Sort",      shell: "Shell Sort",
  counting: "Counting Sort", radix: "Radix Sort", bucket: "Bucket Sort",
  insertion: "Insertion Sort", selection: "Selection Sort", bubble: "Bubble Sort",
  "timsort-js": "TimSort (JS est.)",
};

// Measured in this V8 environment: pure-JS TimSort runs in 0.57× the time of
// native .sort((a,b)=>a-b) because the comparator callback adds JS <=> C++ call
// overhead on every comparison. Emulating "non-native" TimSort = multiply by 0.57.
const TIMSORT_JS_MULTIPLIER = 0.57;

const ALGO_COLORS: Record<string, string> = {
  logos:          "#e07b39",
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
};

const ALGO_SPACE: Record<string, string> = {
  logos:          "O(log n)",
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
};

const ALGO_TIME: Record<string, string> = {
  logos:          "O(n log n)",
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
};

// true = stable, false = unstable, null = not applicable
const ALGO_STABLE: Record<string, boolean> = {
  logos:          false,
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
};

// true = can sort a stream, false = needs full input
const ALGO_ONLINE: Record<string, boolean> = {
  logos:          false,
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
  k: number;
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

  return { label, k: a, fn, pctAt: (n, measured) => { const p = a * fn(n); return p === 0 ? 0 : ((measured - p) / p) * 100; } };
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

const SCENARIO_OPTIONS: { id: BenchmarkScenario; label: string; desc: string }[] = [
  { id: "random",       label: "Random",         desc: "average case" },
  { id: "nearlySorted", label: "Nearly sorted",  desc: "Timsort's home turf" },
  { id: "reversed",     label: "Reversed",       desc: "worst case for naive quicksort" },
  { id: "duplicates",   label: "Many duplicates", desc: "stress-tests three-way partition" },
];

// ── Theoretical space estimation ──────────────────────────────────────────────
// Used when performance.memory is unavailable or returns 0 (its common lazy-
// update behaviour means the before/after diff is often 0 for fast sorts).
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
  if (n >= 1_000_000) return `${+(n / 1_000_000).toPrecision(3).replace(/\.?0+$/, "")}M`;
  if (n >= 1_000)     return `${+(n / 1_000).toPrecision(3).replace(/\.?0+$/, "")}k`;
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

// ── Types ─────────────────────────────────────────────────────────────────────

type Status = "idle" | "running" | "done";

// algoId → array of (n, time, space) measurements across different input sizes
type CurvePoint = { n: number; timeMs: number; spaceBytes?: number; timedOut?: boolean };
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
  mode?: "time" | "space";
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

  const getValue = (p: CurvePoint) => mode === "space" ? (p.spaceBytes ?? 0) : p.timeMs;
  const fmtY     = mode === "space" ? fmtBytes : fmtTime;

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
      {/* horizontal grid + y labels */}
      {yTicks.map(({ v, y }) => (
        <g key={v}>
          <line x1={pL} y1={y} x2={VW - pR} y2={y}
            stroke="var(--color-border)" strokeWidth={0.6} strokeDasharray="3 3" />
          <text x={pL - 5} y={y + 4} textAnchor="end" fontSize={9}
            fill="var(--color-muted)">{fmtY(v)}</text>
        </g>
      ))}

      {/* axes */}
      <line x1={pL} y1={pT} x2={pL} y2={pT + iH} stroke="var(--color-border)" strokeWidth={0.8} />
      <line x1={pL} y1={pT + iH} x2={VW - pR} y2={pT + iH} stroke="var(--color-border)" strokeWidth={0.8} />

      {/* Big-O reference curves — calibrated to actual data, labeled with predicted values */}
      {visSizes.length >= 1 && (() => {
        let calibC = 0;
        const calN = visSizes.find(n => n >= 2);
        if (calN !== undefined) {
          if (mode === "space") {
            // Anchor O(n) to the largest space value at the smallest valid n.
            // Fall back to 8 bytes/element (one float64 copy) when no measured
            // data is available — keeps reference lines visible at all times.
            let largest = 0;
            for (const id of algos) {
              const pt = data[id]?.find(p => p.n === calN);
              const v = pt?.spaceBytes ?? 0;
              if (v > largest) largest = v;
            }
            calibC = largest > 0 ? largest / calN : 8;
          } else {
            // Anchor O(n log n) to the fastest measured time at the smallest valid n
            let fastest = Infinity;
            for (const id of algos) {
              const pt = data[id]?.find(p => p.n === calN && !p.timedOut);
              if (pt && pt.timeMs < fastest) fastest = pt.timeMs;
            }
            if (fastest < Infinity) calibC = fastest / (calN * Math.log2(calN));
          }
        }
        if (calibC <= 0) return null; // time mode only — space always has calibC

        const refs = mode === "space" ? SPACE_BIG_O_REFS : BIG_O_REFS;
        const maxN = visSizes[visSizes.length - 1];
        const STEPS = 80;

        return refs.map(ref => {
          const refY = (n: number) =>
            Math.max(pT, pT + iH - (calibC * ref.fn(n) / maxY) * iH);

          const pts: string[] = [];
          for (let i = 0; i <= STEPS; i++) {
            const t = i / STEPS;
            const x = pL + t * iW;
            const fi = t * (visSizes.length - 1);
            const lo = Math.floor(fi), hi2 = Math.ceil(fi);
            const ft = fi - lo;
            const n = lo === hi2 ? visSizes[lo] : visSizes[lo] * Math.pow(visSizes[hi2] / visSizes[lo], ft);
            pts.push(`${x.toFixed(1)},${refY(n).toFixed(1)}`);
          }

          const predMs   = calibC * ref.fn(maxN);
          const clipped  = predMs > maxY;
          const labelY   = Math.max(pT + 7, Math.min(pT + iH - 14, refY(maxN) - 2));
          const lx       = pL + iW + extraZoneW + 5;

          return (
            <g key={ref.id} style={{ pointerEvents: "none" }}>
              <polyline
                points={pts.join(" ")}
                fill="none"
                stroke={ref.color}
                strokeWidth={1.5}
                strokeDasharray="5 3"
                opacity={ref.id === "logn" || ref.id === "1" ? 0.9 : 0.65}
              />
              {/* class label */}
              <text x={lx} y={labelY} textAnchor="start" fontSize={7.5}
                fontFamily="monospace" fill={ref.color} opacity={0.9}>
                {ref.label}
              </text>
              {/* predicted value at largest n */}
              <text x={lx} y={labelY + 9} textAnchor="start" fontSize={7}
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
      {visSizes.map(n => {
        const x = xAt(n);
        return (
          <g key={n}>
            <line x1={x} y1={pT} x2={x} y2={pT + iH}
              stroke="var(--color-border)" strokeWidth={0.4} strokeDasharray="2 5" opacity={0.5} />
            <text x={x} y={VH - pB + 14} textAnchor="middle" fontSize={9}
              fill="var(--color-muted)">{fmtN(n)}</text>
          </g>
        );
      })}
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
              space {ALGO_SPACE[currentId]}
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

// ── Component ─────────────────────────────────────────────────────────────────

export default function BenchmarkVisualizer() {
  const [selectedSizes, setSelectedSizes] = useState<Set<number>>(
    new Set([10_000, 100_000, 1_000_000])
  );
  const [scenarios, setScenarios] = useState<Set<BenchmarkScenario>>(
    new Set(["random", "nearlySorted", "reversed", "duplicates"] as BenchmarkScenario[])
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
  type SortCol = "name" | "speed" | "time" | "tvsb" | "tbigo" | "space" | "svsb" | "sbigo";
  const [sortCol, setSortCol] = useState<SortCol>("time");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [chartMode, setChartMode] = useState<"time" | "space">("time");
  const [customInput, setCustomInput] = useState("");
  const [pendingCustomN, setPendingCustomN] = useState<number | null>(null);
  const stopRef = useRef(false);

  // Slow algos are disabled if the largest selected size exceeds the threshold
  const maxSelectedSize = selectedSizes.size > 0 ? Math.max(...selectedSizes) : 0;
  const slowDisabled = (id: string) =>
    (SLOW_IDS.has(id) && maxSelectedSize > SLOW_THRESHOLD) ||
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
  const canRun = activeAlgos.length > 0 && selectedSizes.size > 0 && scenarios.size > 0 && status !== "running";

  const run = useCallback(async () => {
    const maxSz = selectedSizes.size > 0 ? Math.max(...selectedSizes) : 0;
    const algos = [...selected].filter(id => !(SLOW_IDS.has(id) && maxSz > SLOW_THRESHOLD));
    const scenarioList = [...scenarios] as BenchmarkScenario[];
    if (!algos.length || !selectedSizes.size || !scenarioList.length) return;

    const sizes = [...selectedSizes].sort((a, b) => a - b);
    const total = sizes.length * algos.length;

    stopRef.current = false;
    setStatus("running");
    setCurveData({});
    setSampleProofs({});
    setActiveProofAlgo(null);
    setHoverN(null);
    setProgress({ done: 0, total });
    setRunConfig({ sizes, scenarios: scenarioList, rounds, warmup, algos });

    let done = 0;
    const acc: CurveData = {};
    const timedOutAlgos = new Set<string>();
    const capturedAlgos = new Set<string>();

    for (const sz of sizes) {
      if (stopRef.current) break;
      setCurrentN(sz);

      // Generate inputs once per size so every algorithm sorts the exact same data each round
      const roundInputs = Array.from({ length: rounds }, () => {
        const sc = scenarioList[Math.floor(Math.random() * scenarioList.length)];
        return generateBenchmarkInput(sz, sc);
      });

      for (const id of algos) {
        if (stopRef.current) break;
        if (timedOutAlgos.has(id)) { done++; setProgress({ done, total }); continue; }
        setCurrentAlgo(id);
        await new Promise<void>(r => setTimeout(r, 0));

        const fn = SORT_FNS[id];
        let best = Infinity;
        let didTimeout = false;
        let lastElapsed = 0;

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
          if (r >= warmup) best = Math.min(best, lastElapsed);
        }

        // Edge case: all rounds were warmup — use the last timing
        if (best === Infinity && !didTimeout) best = lastElapsed;

        // Space measurement — fresh input, separate pass so it doesn't skew timing.
        // performance.memory updates lazily so the diff is often 0 for fast sorts;
        // fall back to theoretical bytes in that case so the chart always has data.
        let spaceBytes: number;
        if (!didTimeout) {
          const perfMem = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
          let measured = 0;
          if (perfMem) {
            const spaceInput = generateBenchmarkInput(sz, scenarioList[0]);
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
        acc[id].push({ n: sz, timeMs: best, spaceBytes, timedOut: didTimeout || undefined });
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
  }, [selected, selectedSizes, scenarios, rounds, warmup]); // eslint-disable-line react-hooks/exhaustive-deps

  const stop = () => { stopRef.current = true; };

  const reset = () => {
    stopRef.current = true;
    setStatus("idle");
    setCurveData({});
    setSampleProofs({});
    setActiveProofAlgo(null);
    setHoverN(null);
    setCurrentN(null);
    setCurrentAlgo(null);
    setRunConfig(null);
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
        .filter(id => curveDataExt[id]?.some(p => p.n === largestDone && !p.timedOut))
        .map(id => ({
          id,
          timeMs: curveDataExt[id]!.find(p => p.n === largestDone)!.timeMs,
        }))
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
      <div className="flex-1 overflow-y-auto lg:overflow-hidden flex flex-col lg:flex-row">

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

              {/* Algorithm checkboxes */}
              <div className="mb-4">
                <p className="text-xs font-semibold uppercase tracking-wider mb-2.5" style={{ color: "var(--color-muted)" }}>
                  Algorithms
                </p>
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
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {maxSelectedSize > SLOW_THRESHOLD && (
                  <p className="mt-2.5 text-xs" style={{ color: "var(--color-state-swap)" }}>
                    ⚠ O(n²) algorithms disabled above n={SLOW_THRESHOLD.toLocaleString()}.
                    {maxSelectedSize > LARGE_THRESHOLD && (
                      <> Only Logos Sort and Tim Sort run above n={fmtN(LARGE_THRESHOLD)}.</>
                    )}
                  </p>
                )}
              </div>

              {/* Advanced */}
              <div className="print:hidden mb-4">
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
                  </div>
                )}
              </div>

              {/* Buttons */}
              <div className="print:hidden flex gap-1.5 flex-wrap">
                <button
                  onClick={run}
                  disabled={!canRun}
                  style={btn("primary", { padding: "4px 12px", opacity: canRun ? 1 : 0.5, cursor: canRun ? "pointer" : "not-allowed" })}
                >
                  <Play size={11} strokeWidth={2} />
                  {status === "running"
                    ? `${currentAlgo ? ALGO_NAMES[currentAlgo] : "…"} at n=${currentN?.toLocaleString()} (${progress.done}/${progress.total})`
                    : <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 1 }}>
                        <span>Run</span>
                        <span style={{ fontSize: 9, opacity: 0.8, fontWeight: 400 }}>
                          {activeAlgos.length} algo{activeAlgos.length !== 1 ? "s" : ""} · {sortedSizes.length} size{sortedSizes.length !== 1 ? "s" : ""} · {rounds} run{rounds !== 1 ? "s" : ""} · discard {warmup}
                        </span>
                      </span>
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
          <div className="px-5 py-4">
            {(hasCurveData || status === "running") ? (
              <div
                className="rounded-xl p-4"
                style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)", display: "flex", flexDirection: "column" }}
              >
                {/* Results header */}
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-semibold text-sm mb-0.5" style={{ color: "var(--color-text)" }}>
                      {chartMode === "time" ? "Performance curve" : "Space usage curve"}
                    </p>
                    {runConfig && (
                      <p className="font-mono font-normal text-xs" style={{ color: "var(--color-muted)" }}>
                        {runConfig.scenarios.join(", ")} · {runConfig.rounds} rounds, {runConfig.warmup} discarded
                      </p>
                    )}
                    {status === "running" && (
                      <p className="text-xs mt-0.5" style={{ color: "var(--color-muted)" }}>
                        Timing {currentAlgo ? ALGO_NAMES[currentAlgo] : "…"} at n={currentN?.toLocaleString()}…
                        <span className="ml-2 font-mono">({progress.done}/{progress.total})</span>
                      </p>
                    )}
                  </div>
                  {status === "done" && summaryResults[0] && largestDone && (
                    <div
                      className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold shrink-0"
                      style={{ background: "rgba(201,150,26,0.15)", color: "#c9961a" }}
                    >
                      <Trophy size={11} /> {ALGO_NAMES[summaryResults[0].id]} wins
                    </div>
                  )}
                </div>

                <div style={{ order: 2 }}>
                {/* Curve chart */}
                {hasCurveData && (
                  <>
                    {/* Time / Space toggle — centred above the chart */}
                    <div className="print:hidden" style={{ display: "flex", justifyContent: "center", marginBottom: 4, marginTop: 15 }}>
                    <div className="flex rounded overflow-hidden" style={{ border: "1px solid var(--color-border)" }}>
                      {(["time", "space"] as const).map(m => (
                        <button
                          key={m}
                          onClick={() => setChartMode(m)}
                          style={btn(chartMode === m ? "primary" : "ghost", {
                            padding: "2px 10px", fontSize: 10, borderRadius: 0,
                            background: chartMode === m ? "var(--color-accent)" : "var(--color-surface-1)",
                          })}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                    </div>{/* end centering wrapper */}
                    <CurveChart
                      data={curveDataExt} sizes={chartSizes} algos={chartAlgos}
                      highlight={activeProofAlgo}
                      activeN={hoverN}
                      onNChange={setHoverN}
                      mode={chartMode}
                    />
                    {/* Big-O reference legend */}
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
                {Object.keys(sampleProofs).length > 0 && (
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

                </div>{/* end order:2 chart section */}

                <div style={{ order: 1 }}>
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
                          <button style={hdBtn("space", 1)} onClick={() => handleSort("space")}>space{sortIcon("space")}</button>
                          <button style={hdBtn("svsb", 1)} onClick={() => handleSort("svsb")}>s vs best{sortIcon("svsb")}</button>
                          <button style={hdBtn("sbigo", 1)} onClick={() => handleSort("sbigo")}>s big O{sortIcon("sbigo")}</button>
                        </div>
                      </div>

                      {/* Rows */}
                      <div className="flex flex-col gap-1.5">
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
                                <div style={{ ...cell("var(--color-text)", 1), opacity: 0.75 }} title={ALGO_SPACE[row.id]}>
                                  {canDl ? (
                                    <a onClick={handleDl} style={{ color: "var(--color-accent)", cursor: "pointer", textDecoration: "underline", fontFamily: "monospace" }} title={`Download space proof (${fmtBytes(spaceVal ?? 0)})`}>{spaceStr}</a>
                                  ) : spaceStr}
                                </div>
                                <div style={cell("var(--color-muted)", 1)}>{spRatioStr}</div>
                                <div
                                  style={{ ...cell("var(--color-text)", 1), opacity: 0.75, cursor: "default" }}
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
            ) : (
              <div
                className="rounded-xl flex items-center justify-center"
                style={{
                  background: "var(--color-surface-2)",
                  border: "1px solid var(--color-border)",
                  minHeight: 200,
                  color: "var(--color-muted)",
                  fontSize: 11,
                }}
              >
                Run a benchmark to see the curve.
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
