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
const TIMEOUT_MS = 30_000;

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
};

const ALGO_COLORS: Record<string, string> = {
  logos:     "#e07b39",
  timsort:   "#5b9bd5",
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
  const pL = 60, pR = 20, pT = 15, pB = 42;
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
  activeAlgo: string;
  onSelect: (id: string) => void;
  revealed: boolean;
  curveData: CurveData;
}) {
  const available = algos.filter(id => proofs[id]);
  if (!available.length) return null;

  const proof = proofs[activeAlgo] ?? proofs[available[0]];
  const currentId = proofs[activeAlgo] ? activeAlgo : available[0];
  const idx = available.indexOf(currentId);
  const color = ALGO_COLORS[currentId] ?? "#888";
  const max = proof ? Math.max(...proof.before, ...proof.after, 1) : 1;
  const points = curveData[currentId] ?? [];

  const nav = (delta: number) => {
    const next = available[Math.max(0, Math.min(available.length - 1, idx + delta))];
    if (next) onSelect(next);
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

  return (
    <div className="mt-3 pt-3" style={{ borderTop: "1px solid var(--color-border)" }}>
      {/* Header: nav + algo name + dot indicators */}
      <div className="flex items-center gap-2 mb-2">
        <button onClick={() => nav(-1)} disabled={idx <= 0} style={btnStyle(idx <= 0)}>‹</button>
        <span style={{ fontSize: 12, fontWeight: 700, color }}>
          {ALGO_NAMES[currentId] ?? currentId}
        </span>
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
        <button onClick={() => nav(1)} disabled={idx >= available.length - 1} style={btnStyle(idx >= available.length - 1)}>›</button>
        <span className="ml-auto text-xs font-mono" style={{ color: "var(--color-muted)" }}>
          proof from n={proof ? fmtN(proof.n) : "—"}
        </span>
      </div>

      {/* Stats: all measured (n, timeMs) for this algo */}
      {points.length > 0 && (
        <div className="mb-2.5 flex flex-wrap gap-1.5">
          {points.map(p => (
            <span key={p.n} className="text-xs font-mono px-2 py-0.5 rounded"
              style={{ background: "var(--color-surface-3)", border: "1px solid var(--color-border)", color }}>
              n={fmtN(p.n)} · {p.timedOut ? ">30 s" : fmtTime(p.timeMs)}
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
    new Set([100_000, 500_000, 1_000_000])
  );
  const [scenarios, setScenarios] = useState<Set<BenchmarkScenario>>(
    new Set(["random", "nearlySorted", "reversed", "duplicates"] as BenchmarkScenario[])
  );
  const [rounds, setRounds] = useState(5);
  const [warmup, setWarmup] = useState(2);
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
            setActiveProofAlgo(prev => prev ?? id);
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

  // Summary table: rankings at the largest completed n
  const completedNs = new Set(
    Object.values(curveData).flatMap(pts => pts.map(p => p.n))
  );
  const largestDone = completedNs.size > 0 ? Math.max(...completedNs) : null;
  const summaryResults: SummaryResult[] = largestDone !== null
    ? (runConfig?.algos ?? activeAlgos)
        .filter(id => curveData[id]?.some(p => p.n === largestDone && !p.timedOut))
        .map(id => ({
          id,
          timeMs: curveData[id]!.find(p => p.n === largestDone)!.timeMs,
        }))
        .sort((a, b) => a.timeMs - b.timeMs)
        .map((r, i) => ({ ...r, rank: i + 1 }))
    : [];

  const summaryFastest = summaryResults[0]?.timeMs ?? 1;
  const summarySlowest = summaryResults.at(-1)?.timeMs ?? 1;

  const chartAlgos = runConfig?.algos ?? activeAlgos;
  const chartSizes = runConfig?.sizes ?? sortedSizes;
  const hasCurveData = Object.values(curveData).some(pts => pts.length > 0);

  return (
    <div className="flex flex-col h-full overflow-hidden">
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

                <div className="flex flex-wrap gap-1.5 mt-2">
                  {SIZE_BUTTONS.map(({ n, word }) => {
                    const on = selectedSizes.has(n);
                    const disabled = !UNLIMITED_IDS.has([...selected][0] ?? "") && n > LARGE_THRESHOLD && selected.size > 0 && [...selected].every(id => !UNLIMITED_IDS.has(id));
                    return (
                      <button
                        key={n}
                        onClick={() => on ? removeSize(n) : addSize(n)}
                        disabled={disabled}
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          padding: "6px 10px",
                          borderRadius: 6,
                          background: on ? "rgba(139,58,42,0.12)" : "var(--color-surface-1)",
                          border: `1px solid ${on ? "var(--color-accent)" : "var(--color-border)"}`,
                          color: on ? "var(--color-accent)" : "var(--color-muted)",
                          cursor: disabled ? "not-allowed" : "pointer",
                          opacity: disabled ? 0.35 : 1,
                          minWidth: 72,
                        }}
                      >
                        <span style={{ fontSize: 11, fontFamily: "monospace", fontWeight: on ? 700 : 500, lineHeight: 1.2 }}>
                          {n.toLocaleString()}
                        </span>
                        <span style={{ fontSize: 7.5, opacity: 0.65, marginTop: 2, lineHeight: 1.2, textAlign: "center" }}>
                          {word}
                        </span>
                      </button>
                    );
                  })}
                </div>
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
                  <CurveChart
                    data={curveData} sizes={chartSizes} algos={chartAlgos}
                    highlight={activeProofAlgo}
                    activeN={hoverN}
                    onNChange={setHoverN}
                  />
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
                    activeAlgo={activeProofAlgo ?? chartAlgos[0] ?? ""}
                    onSelect={setActiveProofAlgo}
                    revealed={status === "done"}
                    curveData={curveData}
                  />
                )}

                {/* Legend */}
                {hasCurveData && (
                  <div className="mt-2.5 flex flex-col gap-1.5">
                    <Legend algos={chartAlgos} data={curveData} />
                    {Object.values(curveData).some(pts => pts.some(p => p.timedOut)) && (
                      <p className="text-xs" style={{ color: "var(--color-muted)" }}>
                        <span style={{ borderBottom: "1.5px dashed currentColor" }}>– –</span>
                        {" "}dotted line / ✕ = timed out (&gt;30 s); subsequent sizes skipped
                      </p>
                    )}
                  </div>
                )}

                {/* Summary table at largest completed n */}
                {summaryResults.length > 0 && (
                  <div className="mt-4 pt-4" style={{ borderTop: "1px solid var(--color-border)" }}>
                    <p className="text-xs font-semibold uppercase tracking-wider mb-2.5" style={{ color: "var(--color-muted)" }}>
                      Rankings at n={largestDone?.toLocaleString()}
                      {chartSizes.length > 1 && (
                        <span style={{ fontWeight: 400, textTransform: "none" }}> (largest completed)</span>
                      )}
                    </p>
                    <div className="flex flex-col gap-2">
                      {summaryResults.map(r => {
                        const barPct = summarySlowest > 0 ? (r.timeMs / summarySlowest) * 100 : 0;
                        const color = rankColor(r.rank, summaryResults.length);
                        const dotColor = ALGO_COLORS[r.id];
                        return (
                          <div key={r.id} className="flex items-center gap-2.5">
                            <div className="text-xs font-mono w-4 text-right shrink-0" style={{ color }}>
                              {r.rank}
                            </div>
                            <div
                              className="text-xs shrink-0 w-24 truncate flex items-center gap-1.5"
                              style={{ color: "var(--color-text)", fontWeight: r.rank === 1 ? 600 : 400 }}
                            >
                              <span style={{
                                display: "inline-block",
                                width: 6, height: 6,
                                borderRadius: "50%",
                                background: dotColor,
                                flexShrink: 0,
                              }} />
                              {ALGO_NAMES[r.id]}
                            </div>
                            <div className="flex-1 rounded overflow-hidden" style={{ background: "var(--color-surface-3)", height: 14 }}>
                              <div style={{
                                width: `${barPct}%`,
                                height: "100%",
                                background: color,
                                borderRadius: 3,
                                minWidth: barPct > 0 ? 3 : 0,
                                transition: "width 0.35s ease",
                                opacity: 0.85,
                              }} />
                            </div>
                            <div className="text-xs font-mono w-16 text-right shrink-0" style={{ color }}>
                              {fmtTime(r.timeMs)}
                            </div>
                            <div className="text-xs font-mono w-12 text-right shrink-0" style={{ color: "var(--color-muted)" }}>
                              {r.rank === 1 ? "fastest" : `${(r.timeMs / summaryFastest).toFixed(1)}×`}
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
