"use client";

import React, { useState, useCallback, useRef } from "react";
import { Play, Square, RotateCcw, Trophy, Zap, ChevronRight } from "lucide-react";
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
// native .sort((a,b)=>a-b) because the comparator callback adds JS↔C++ call
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

// ── Spinner ───────────────────────────────────────────────────────────────────

function Spinner({ value, onChange, min, max, label }: {
  value: number; onChange: (v: number) => void; min: number; max: number; label: string;
}) {
  const dec = () => onChange(Math.max(min, value - 1));
  const inc = () => onChange(Math.min(max, value + 1));
  const btnStyle = (disabled: boolean): React.CSSProperties => ({
    width: 26, height: 28, display: "flex", alignItems: "center", justifyContent: "center",
    background: "none", border: "none", cursor: disabled ? "not-allowed" : "pointer",
    color: disabled ? "var(--color-border)" : "var(--color-muted)", fontSize: 15, lineHeight: 1,
    flexShrink: 0, userSelect: "none",
  });
  return (
    <div style={{
      display: "inline-flex", alignItems: "center",
      border: "1px solid var(--color-border)", borderRadius: 6,
      background: "var(--color-surface-1)", overflow: "hidden",
    }} aria-label={label}>
      <button onClick={dec} disabled={value <= min} style={btnStyle(value <= min)}>−</button>
      <span style={{ minWidth: 32, textAlign: "center", fontSize: 12, fontFamily: "monospace", color: "var(--color-text)", padding: "0 2px" }}>
        {value}
      </span>
      <button onClick={inc} disabled={value >= max} style={btnStyle(value >= max)}>+</button>
    </div>
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────

type Status = "idle" | "running" | "done";

// algoId → array of (n, time) measurements across different input sizes
type CurvePoint = { n: number; timeMs: number; timedOut?: boolean };
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
}: {
  data: CurveData;
  sizes: number[];
  algos: string[];
  highlight?: string | null;
  activeN?: number | null;
  onNChange?: (n: number | null) => void;
}) {
  const VW = 560;
  const VH = 230;
  const pL = 60, pR = 82, pT = 15, pB = 42;
  const iW = VW - pL - pR;
  const iH = VH - pT - pB;

  const xAt = (n: number): number => {
    const idx = sizes.indexOf(n);
    if (idx < 0) return pL;
    return sizes.length === 1 ? pL + iW / 2 : pL + (idx / (sizes.length - 1)) * iW;
  };

  const allTimes = algos.flatMap(id => (data[id] ?? []).map(p => p.timeMs));
  const maxY = Math.max(...allTimes, 0.001);
  const yAt = (v: number) => pT + iH - (v / maxY) * iH;

  const yTicks = [0.25, 0.5, 0.75, 1].map(f => ({ v: maxY * f, y: yAt(maxY * f) }));

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!onNChange || !sizes.length) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * VW;
    let best = sizes[0], bestDist = Infinity;
    sizes.forEach(n => { const d = Math.abs(xAt(n) - x); if (d < bestDist) { bestDist = d; best = n; } });
    onNChange(best);
  };

  // Build sorted bubble data for activeN column
  const bubbles = activeN != null
    ? algos
        .map(id => ({ id, pt: data[id]?.find(p => p.n === activeN) }))
        .filter((x): x is { id: string; pt: CurvePoint } => !!x.pt && !x.pt.timedOut)
        .sort((a, b) => a.pt.timeMs - b.pt.timeMs)
    : [];

  return (
    <svg
      viewBox={`0 0 ${VW} ${VH}`}
      style={{ width: "100%", height: VH, display: "block", cursor: onNChange ? "crosshair" : "default" }}
      aria-label="Performance curve: time vs input size per algorithm"
      onMouseMove={handleMouseMove}
      onMouseLeave={() => onNChange?.(null)}
    >
      {/* horizontal grid + y labels */}
      {yTicks.map(({ v, y }) => (
        <g key={v}>
          <line x1={pL} y1={y} x2={VW - pR} y2={y}
            stroke="var(--color-border)" strokeWidth={0.6} strokeDasharray="3 3" />
          <text x={pL - 5} y={y + 4} textAnchor="end" fontSize={9}
            fill="var(--color-muted)">{fmtTime(v)}</text>
        </g>
      ))}

      {/* axes */}
      <line x1={pL} y1={pT} x2={pL} y2={pT + iH} stroke="var(--color-border)" strokeWidth={0.8} />
      <line x1={pL} y1={pT + iH} x2={VW - pR} y2={pT + iH} stroke="var(--color-border)" strokeWidth={0.8} />

      {/* Big-O reference curves — calibrated to actual data, labeled with predicted values */}
      {sizes.length >= 2 && (() => {
        // Single calibration constant: anchor O(n log n) to the fastest measured
        // time at the smallest valid n, so all curves predict real milliseconds.
        let calibC = 0;
        const calN = sizes.find(n => n >= 2);
        if (calN !== undefined) {
          let fastest = Infinity;
          for (const id of algos) {
            const pt = data[id]?.find(p => p.n === calN && !p.timedOut);
            if (pt && pt.timeMs < fastest) fastest = pt.timeMs;
          }
          if (fastest < Infinity) calibC = fastest / (calN * Math.log2(calN));
        }
        if (calibC <= 0) return null;

        const maxN = sizes[sizes.length - 1];
        const STEPS = 80;

        return BIG_O_REFS.map(ref => {
          const refY = (n: number) =>
            Math.max(pT, pT + iH - (calibC * ref.fn(n) / maxY) * iH);

          const pts: string[] = [];
          for (let i = 0; i <= STEPS; i++) {
            const t = i / STEPS;
            const x = pL + t * iW;
            const fi = t * (sizes.length - 1);
            const lo = Math.floor(fi), hi2 = Math.ceil(fi);
            const ft = fi - lo;
            const n = lo === hi2 ? sizes[lo] : sizes[lo] * Math.pow(sizes[hi2] / sizes[lo], ft);
            pts.push(`${x.toFixed(1)},${refY(n).toFixed(1)}`);
          }

          const predMs   = calibC * ref.fn(maxN);
          const clipped  = predMs > maxY;
          const labelY   = Math.max(pT + 7, Math.min(pT + iH - 14, refY(maxN) - 2));
          const lx       = pL + iW + 5;

          return (
            <g key={ref.id} style={{ pointerEvents: "none" }}>
              <polyline
                points={pts.join(" ")}
                fill="none"
                stroke={ref.color}
                strokeWidth={1.5}
                strokeDasharray="5 3"
                opacity={0.65}
              />
              {/* class label */}
              <text x={lx} y={labelY} textAnchor="start" fontSize={7.5}
                fontFamily="monospace" fill={ref.color} opacity={0.9}>
                {ref.label}
              </text>
              {/* predicted value at largest n */}
              <text x={lx} y={labelY + 9} textAnchor="start" fontSize={7}
                fontFamily="monospace" fill={ref.color} opacity={0.7}>
                {clipped ? "↑ " : ""}{fmtPredicted(predMs)}
              </text>
            </g>
          );
        });
      })()}

      {/* vertical grid + x tick labels */}
      {sizes.map(n => {
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
        return (
          <g key={id} opacity={isHl ? 1 : 0.12} style={{ transition: "opacity 0.2s ease" }}>
            {pts.slice(1).map((p, i) => {
              const prev = pts[i];
              const dashed = prev.timedOut || p.timedOut;
              return (
                <line key={p.n}
                  x1={xAt(prev.n)} y1={yAt(prev.timeMs)}
                  x2={xAt(p.n)}   y2={yAt(p.timeMs)}
                  stroke={color} strokeWidth={sw}
                  strokeDasharray={dashed ? "5 3" : undefined}
                  strokeLinecap="round"
                />
              );
            })}
            {pts.map(p => {
              const cx = xAt(p.n), cy = yAt(p.timeMs);
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
        );
      })}

      {/* data bubbles — rendered last so they float above curves */}
      {bubbles.length > 0 && activeN != null && (() => {
        const cx = xAt(activeN);
        const flipRight = cx > VW * 0.6;
        return (
          <g style={{ pointerEvents: "none" }}>
            {bubbles.map(({ id, pt }, i) => {
              const cy = yAt(pt.timeMs);
              const color = ALGO_COLORS[id] ?? "#888";
              const label = `${ALGO_NAMES[id]}  ${fmtTime(pt.timeMs)}`;
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
                  {/* connector dot */}
                  <circle cx={cx} cy={cy} r={5} fill={color}
                    stroke="var(--color-surface-2)" strokeWidth={2} />
                </g>
              );
            })}
          </g>
        );
      })()}
    </svg>
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

      {/* Measurements: all (n, timeMs) pairs */}
      {currentId !== null && points.length > 0 && (
        <div className="mb-2.5 flex flex-wrap gap-1.5">
          {points.map(p => (
            <span key={p.n} className="text-xs font-mono px-2 py-0.5 rounded"
              style={{ background: "var(--color-surface-3)", border: "1px solid var(--color-border)", color }}>
              n={fmtN(p.n)} · {p.timedOut ? ">10 s" : fmtTime(p.timeMs)}
            </span>
          ))}
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
          // Pick a random scenario from the wheel each round
          const sc = scenarioList[Math.floor(Math.random() * scenarioList.length)];
          const input = generateBenchmarkInput(sz, sc);

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

        if (!acc[id]) acc[id] = [];
        acc[id].push({ n: sz, timeMs: best, timedOut: didTimeout || undefined });
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
            <p style={{ fontSize: 13, fontWeight: 700, color: "var(--color-state-swap)", marginBottom: 8 }}>
              ⚠ Large input warning
            </p>
            <p style={{ fontSize: 12, color: "var(--color-text)", marginBottom: 6, lineHeight: 1.5 }}>
              n = <span style={{ fontFamily: "monospace", fontWeight: 700 }}>{pendingCustomN.toLocaleString()}</span> is above 100,000,000.
            </p>
            <p style={{ fontSize: 12, color: "var(--color-muted)", marginBottom: 20, lineHeight: 1.5 }}>
              Allocating and sorting an array this large may take a very long time or freeze the browser tab. Only Logos Sort and Tim Sort are allowed at this size.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={cancelCustomN}
                style={{
                  padding: "6px 16px", borderRadius: 6, fontSize: 12, fontWeight: 500,
                  background: "var(--color-surface-3)", border: "1px solid var(--color-border)",
                  color: "var(--color-muted)", cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={confirmCustomN}
                style={{
                  padding: "6px 16px", borderRadius: 6, fontSize: 12, fontWeight: 600,
                  background: "var(--color-state-swap)", border: "none",
                  color: "#fff", cursor: "pointer",
                }}
              >
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
          <Zap size={18} style={{ color: "var(--color-accent)" }} strokeWidth={1.75} />
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
                <div className="flex gap-1.5 mt-2 mb-1.5">
                  {([
                    { label: "Small",  sizes: [100, 1_000, 10_000] },
                    { label: "Medium", sizes: [1_000, 10_000, 100_000] },
                    { label: "Large",  sizes: [100_000, 1_000_000, 10_000_000] },
                  ] as const).map(({ label, sizes }) => (
                    <button
                      key={label}
                      onClick={() => setSelectedSizes(new Set(sizes))}
                      style={{
                        padding: "3px 10px", borderRadius: 6, fontSize: 9,
                        fontFamily: "monospace", fontWeight: 500,
                        background: "var(--color-surface-1)",
                        border: "1px solid var(--color-border)",
                        color: "var(--color-muted)", cursor: "pointer",
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <div className="flex flex-wrap gap-1.5 mt-2">
                  {SIZE_BUTTONS.map(({ n }) => {
                    const on = selectedSizes.has(n);
                    const disabled = !UNLIMITED_IDS.has([...selected][0] ?? "") && n > LARGE_THRESHOLD && selected.size > 0 && [...selected].every(id => !UNLIMITED_IDS.has(id));
                    return (
                      <button
                        key={n}
                        onClick={() => on ? removeSize(n) : addSize(n)}
                        disabled={disabled}
                        style={{
                          display: "flex", flexDirection: "column", alignItems: "center",
                          padding: "4px 7px", borderRadius: 6,
                          background: on ? "rgba(139,58,42,0.12)" : "var(--color-surface-1)",
                          border: `1px solid ${on ? "var(--color-accent)" : "var(--color-border)"}`,
                          color: on ? "var(--color-accent)" : "var(--color-muted)",
                          cursor: disabled ? "not-allowed" : "pointer",
                          opacity: disabled ? 0.35 : 1, minWidth: 56,
                        }}
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
                    style={{
                      display: "flex", flexDirection: "column", alignItems: "center",
                      padding: "6px 10px", borderRadius: 6,
                      background: "var(--color-surface-1)",
                      border: "1px solid var(--color-border)",
                      color: "var(--color-muted)",
                      cursor: selectedSizes.size === 0 ? "not-allowed" : "pointer",
                      opacity: selectedSizes.size === 0 ? 0.35 : 1, minWidth: 72,
                    }}
                  >
                    <span style={{ fontSize: 9, fontFamily: "monospace", fontWeight: 500, lineHeight: 1.2 }}>Clear</span>
                  </button>
                </div>

                {/* Custom n input */}
                <form
                  className="flex items-center gap-1.5 mt-2"
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
                  <button type="submit" style={{
                    padding: "4px 10px", fontSize: 11, borderRadius: 6,
                    background: "var(--color-surface-3)", border: "1px solid var(--color-border)",
                    color: "var(--color-muted)", cursor: "pointer",
                  }}>Add</button>
                </form>

                {/* Custom sizes (not in SIZE_BUTTONS) shown as removable chips */}
                {[...selectedSizes].filter(n => !SIZE_BUTTONS.some(b => b.n === n)).sort((a,b)=>a-b).map(n => (
                  <span key={n} className="inline-flex items-center gap-1 mt-1.5 mr-1.5 px-2 py-0.5 rounded text-xs font-mono"
                    style={{ background: "rgba(139,58,42,0.12)", border: "1px solid var(--color-accent)", color: "var(--color-accent)" }}>
                    {n.toLocaleString()}
                    <button onClick={() => removeSize(n)} style={{
                      background: "none", border: "none", cursor: "pointer",
                      color: "var(--color-accent)", fontSize: 13, lineHeight: 1, padding: 0, marginLeft: 2,
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
              <div className="mb-4">
                <button
                  onClick={() => setAdvancedOpen(o => !o)}
                  className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider"
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-muted)", padding: 0 }}
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
              <div className="flex gap-1.5 flex-wrap">
                <button
                  onClick={run}
                  disabled={!canRun}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium disabled:opacity-50"
                  style={{
                    background: "var(--color-accent)",
                    color: "#fff",
                    border: "none",
                    cursor: canRun ? "pointer" : "not-allowed",
                  }}
                >
                  <Play size={11} strokeWidth={2} />
                  {status === "running"
                    ? `${currentAlgo ? ALGO_NAMES[currentAlgo] : "…"} at n=${currentN?.toLocaleString()} (${progress.done}/${progress.total})`
                    : `Run${sortedSizes.length > 1 ? ` · ${sortedSizes.length} sizes` : ""}`}
                </button>

                {status === "running" && (
                  <button
                    onClick={stop}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium"
                    style={{
                      background: "var(--color-state-swap)",
                      color: "#fff",
                      border: "none",
                      cursor: "pointer",
                    }}
                  >
                    <Square size={11} strokeWidth={2} fill="currentColor" /> Stop
                  </button>
                )}

                {status === "done" && (
                  <button
                    onClick={reset}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium"
                    style={{
                      background: "var(--color-surface-3)",
                      border: "1px solid var(--color-border)",
                      color: "var(--color-muted)",
                      cursor: "pointer",
                    }}
                  >
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
                style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)" }}
              >
                {/* Results header */}
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-semibold text-sm" style={{ color: "var(--color-text)" }}>
                      Performance curve
                      {runConfig && (
                        <span className="ml-2 font-mono font-normal text-xs" style={{ color: "var(--color-muted)" }}>
                          {runConfig.scenarios.join(", ")} · {runConfig.rounds} rounds, {runConfig.warmup} discarded
                        </span>
                      )}
                    </p>
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

                {/* Curve chart */}
                {hasCurveData && (
                  <>
                    <CurveChart
                      data={curveDataExt} sizes={chartSizes} algos={chartAlgos}
                      highlight={activeProofAlgo}
                      activeN={hoverN}
                      onNChange={setHoverN}
                    />
                    {/* Big-O reference legend */}
                    <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1" style={{ paddingLeft: 60 }}>
                      {BIG_O_REFS.map(ref => (
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
                    </div>
                  </>
                )}

                {/* Placeholder while first result loads */}
                {!hasCurveData && status === "running" && (
                  <div className="flex items-center justify-center"
                    style={{ height: 230, color: "var(--color-muted)", fontSize: 13 }}>
                    Waiting for first result…
                  </div>
                )}

                {/* Proof slider */}
                {Object.keys(sampleProofs).length > 0 && (
                  <ProofSlider
                    proofs={sampleProofs} algos={chartAlgos}
                    activeAlgo={activeProofAlgo}
                    onSelect={setActiveProofAlgo}
                    revealed={status === "done"}
                    curveData={curveDataExt}
                  />
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
                        {" "}— native .sort() × {TIMSORT_JS_MULTIPLIER}. Pure-JS comparisons avoid the JS↔C++ callback overhead measured in this V8 environment.
                      </p>
                    )}
                  </div>
                )}

                {/* Summary table at largest completed n */}
                {summaryResults.length > 0 && (
                  <div className="mt-4 pt-4" style={{ borderTop: "1px solid var(--color-border)", fontSize: 10 }}>
                    <div className="flex items-center justify-between mb-2.5">
                      <p className="font-semibold uppercase tracking-wider" style={{ color: "var(--color-muted)", fontSize: 9 }}>
                        Rankings at n={largestDone?.toLocaleString()}
                        {chartSizes.length > 1 && (
                          <span style={{ fontWeight: 400, textTransform: "none" }}> (largest completed)</span>
                        )}
                      </p>
                      <div className="flex font-mono shrink-0" style={{ color: "var(--color-muted)", fontSize: 8 }}>
                        <span style={{ width: 56, textAlign: "center", borderLeft: "1px solid var(--color-border)", paddingLeft: 6 }}>time</span>
                        <span style={{ width: 48, textAlign: "center", borderLeft: "1px solid var(--color-border)", paddingLeft: 6 }}>vs best</span>
                        <span style={{ width: 48, textAlign: "center", borderLeft: "1px solid var(--color-border)", paddingLeft: 6 }}>big O</span>
                        <span style={{ width: 48, textAlign: "center", borderLeft: "1px solid var(--color-border)", paddingLeft: 6 }}>space</span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      {tableRows.map((row) => {
                        if (row.kind === "ref") {
                          const barPct = Math.min(100, summarySlowest > 0 ? (row.timeMs / summarySlowest) * 100 : 0);
                          const overScale = row.timeMs > summarySlowest;
                          return (
                            <div key={`ref-${row.label}`} className="flex items-center"
                              style={{ opacity: 0.6 }}>
                              <div className="shrink-0 w-24 flex items-center gap-1.5 pr-2">
                                <span className="font-mono w-3 text-right shrink-0"
                                  style={{ color: "var(--color-muted)" }}>—</span>
                                <span className="font-mono truncate italic"
                                  style={{ color: row.color }}>
                                  {row.label}
                                </span>
                              </div>
                              <div className="flex-1 rounded overflow-hidden"
                                style={{ background: "var(--color-surface-3)", height: 10 }}>
                                <div style={{
                                  width: `${overScale ? 100 : barPct}%`,
                                  height: "100%",
                                  background: row.color,
                                  borderRadius: 3,
                                  minWidth: 3,
                                  opacity: 0.4,
                                  backgroundImage: "repeating-linear-gradient(90deg, transparent, transparent 4px, rgba(0,0,0,0.25) 4px, rgba(0,0,0,0.25) 5px)",
                                }} />
                              </div>
                              <div className="font-mono text-center shrink-0"
                                style={{ width: 56, color: row.color, borderLeft: "1px solid var(--color-border)", paddingLeft: 6 }}>
                                {overScale ? "↑ " : ""}{fmtPredicted(row.timeMs)}
                              </div>
                              <div className="font-mono text-center shrink-0"
                                style={{ width: 48, color: "var(--color-muted)", borderLeft: "1px solid var(--color-border)", paddingLeft: 6 }}>
                                {(row.timeMs / summaryFastest).toFixed(1)}×
                              </div>
                              <div className="font-mono text-center shrink-0"
                                style={{ width: 48, color: "var(--color-muted)", borderLeft: "1px solid var(--color-border)", paddingLeft: 6 }}>theory</div>
                              <div className="font-mono text-center shrink-0"
                                style={{ width: 48, color: "var(--color-muted)", borderLeft: "1px solid var(--color-border)", paddingLeft: 6 }}>—</div>
                            </div>
                          );
                        }
                        const barPct = summarySlowest > 0 ? (row.timeMs / summarySlowest) * 100 : 0;
                        const color = rankColor(row.rank, summaryResults.length);
                        const dotColor = ALGO_COLORS[row.id];
                        return (
                          <div key={row.id} className="flex items-center">
                            <div className="shrink-0 w-24 flex items-center gap-1.5 pr-2">
                              <span className="font-mono w-3 text-right shrink-0" style={{ color }}>
                                {row.rank}
                              </span>
                              <span style={{
                                display: "inline-block", width: 5, height: 5,
                                borderRadius: "50%", background: dotColor, flexShrink: 0,
                              }} />
                              <span className="truncate"
                                style={{ color: "var(--color-text)", fontWeight: row.rank === 1 ? 600 : 400 }}>
                                {ALGO_NAMES[row.id]}
                              </span>
                            </div>
                            <div className="flex-1 rounded overflow-hidden" style={{ background: "var(--color-surface-3)", height: 10 }}>
                              <div style={{
                                width: `${barPct}%`,
                                height: "100%",
                                background: dotColor,
                                borderRadius: 3,
                                minWidth: barPct > 0 ? 3 : 0,
                                transition: "width 0.35s ease",
                                opacity: 0.85,
                              }} />
                            </div>
                            <div className="font-mono text-center shrink-0"
                              style={{ width: 56, color, borderLeft: "1px solid var(--color-border)", paddingLeft: 6 }}>
                              {fmtTime(row.timeMs)}
                            </div>
                            <div className="font-mono text-center shrink-0"
                              style={{ width: 48, color: "var(--color-muted)", borderLeft: "1px solid var(--color-border)", paddingLeft: 6 }}>
                              {row.rank === 1 ? "0" : `${(row.timeMs / summaryFastest).toFixed(1)}×`}
                            </div>
                            <div className="font-mono text-center shrink-0"
                              style={{ width: 48, color: "var(--color-muted)", borderLeft: "1px solid var(--color-border)", paddingLeft: 6 }}>
                              {ALGO_TIME[row.id]?.replace(/^O\(/, "").replace(/\)$/, "").replace(/ log n/g, "logn") ?? "—"}
                            </div>
                            <div className="font-mono text-center shrink-0"
                              style={{ width: 48, color: "var(--color-muted)", borderLeft: "1px solid var(--color-border)", paddingLeft: 6 }}>
                              {ALGO_SPACE[row.id]?.replace(/^O\(/, "").replace(/\)$/, "").replace("log n", "logn") ?? "—"}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div
                className="rounded-xl flex items-center justify-center"
                style={{
                  background: "var(--color-surface-2)",
                  border: "1px solid var(--color-border)",
                  minHeight: 200,
                  color: "var(--color-muted)",
                  fontSize: 13,
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
