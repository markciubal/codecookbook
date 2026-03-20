"use client";

import React, { useState, useCallback, useRef } from "react";
import { Play, Square, RotateCcw, Trophy, Zap, X } from "lucide-react";
import { generateBenchmarkInput, SORT_FNS, type BenchmarkScenario } from "@/lib/benchmark";

// ── Static config ─────────────────────────────────────────────────────────────

const SLOW_IDS = new Set(["insertion", "selection", "bubble"]);
const SLOW_THRESHOLD = 5_000;
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

// Standard sizes shown as chips
const CHIP_SIZES = [
  500, 1_000, 2_000, 5_000, 10_000, 25_000, 50_000, 100_000, 250_000, 500_000,
  1_000_000, 2_000_000, 5_000_000, 10_000_000, 25_000_000, 50_000_000,
];

const SIZE_PRESETS = [
  { label: "Quick",      sizes: [1_000, 5_000, 10_000, 50_000] },
  { label: "Full curve", sizes: [1_000, 2_000, 5_000, 10_000, 25_000, 50_000, 100_000] },
  { label: "Large",      sizes: [100_000, 500_000, 1_000_000, 5_000_000, 10_000_000] },
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
}: {
  data: CurveData;
  sizes: number[];  // all sizes in run (sorted)
  algos: string[];  // algo ids to render
}) {
  const VW = 560;
  const VH = 230;
  const pL = 60, pR = 20, pT = 15, pB = 42;
  const iW = VW - pL - pR;
  const iH = VH - pT - pB;

  // x: evenly-spaced ordinal positions keyed by size index
  const xAt = (n: number): number => {
    const idx = sizes.indexOf(n);
    if (idx < 0) return pL;
    return sizes.length === 1 ? pL + iW / 2 : pL + (idx / (sizes.length - 1)) * iW;
  };

  // y: linear scale 0 → maxY
  const allTimes = algos.flatMap(id => (data[id] ?? []).map(p => p.timeMs));
  const maxY = Math.max(...allTimes, 0.001);
  const yAt = (v: number) => pT + iH - (v / maxY) * iH;

  const yTicks = [0.25, 0.5, 0.75, 1].map(f => ({ v: maxY * f, y: yAt(maxY * f) }));

  return (
    <svg
      viewBox={`0 0 ${VW} ${VH}`}
      style={{ width: "100%", height: VH, display: "block" }}
      aria-label="Performance curve: time vs input size per algorithm"
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

      {/* one polyline + dots per algorithm */}
      {algos.map(id => {
        const pts = [...(data[id] ?? [])].sort((a, b) => a.n - b.n);
        if (!pts.length) return null;
        const color = ALGO_COLORS[id] ?? "#888";
        return (
          <g key={id}>
            {/* segments — dashed when either endpoint timed out */}
            {pts.slice(1).map((p, i) => {
              const prev = pts[i];
              const dashed = prev.timedOut || p.timedOut;
              return (
                <line key={p.n}
                  x1={xAt(prev.n)} y1={yAt(prev.timeMs)}
                  x2={xAt(p.n)}   y2={yAt(p.timeMs)}
                  stroke={color} strokeWidth={1.75}
                  strokeDasharray={dashed ? "5 3" : undefined}
                  strokeLinecap="round"
                />
              );
            })}
            {/* dots */}
            {pts.map(p => {
              const cx = xAt(p.n), cy = yAt(p.timeMs);
              const label = `${ALGO_NAMES[id]}: ${p.timedOut ? "timeout (>" : ""}${fmtTime(p.timeMs)}${p.timedOut ? ")" : ""} at n=${p.n.toLocaleString()}`;
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
                    <title>{label}</title>
                  </g>
                );
              }
              return (
                <circle key={p.n} cx={cx} cy={cy} r={3.5}
                  fill={color} stroke="var(--color-surface-2)" strokeWidth={1.5}>
                  <title>{label}</title>
                </circle>
              );
            })}
          </g>
        );
      })}
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

// ── Sample proof ──────────────────────────────────────────────────────────────

function SampleProof({
  proof,
  revealed,
}: {
  proof: { before: number[]; after: number[]; n: number };
  revealed: boolean;
}) {
  const max = Math.max(...proof.before, ...proof.after, 1);

  const tokenStyle = (v: number, forceColor = false): React.CSSProperties => {
    const base: React.CSSProperties = {
      display: "inline-block",
      fontSize: 10,
      fontFamily: "monospace",
      padding: "2px 5px",
      borderRadius: 4,
      transition: "background-color 0.5s ease, color 0.35s ease, border-color 0.5s ease",
    };
    if (!forceColor && !revealed) {
      return { ...base, background: "var(--color-surface-3)", color: "var(--color-muted)", border: "1px solid var(--color-border)" };
    }
    const pct = v / max;
    const hue = Math.round(220 - pct * 185); // blue(220) → orange(35)
    return {
      ...base,
      background: `hsl(${hue}, 72%, 40%)`,
      color: "#fff",
      border: `1px solid hsl(${hue}, 72%, 57%)`,
    };
  };

  return (
    <div className="mt-3 pt-3" style={{ borderTop: "1px solid var(--color-border)" }}>
      <p className="text-xs font-semibold uppercase tracking-wider mb-2.5" style={{ color: "var(--color-muted)" }}>
        Proof of computation · {proof.before.length} values sampled from n={fmtN(proof.n)}
      </p>

      {/* Unsorted row — colors reveal once sort completes */}
      <div className="mb-2 flex items-start gap-2">
        <span className="text-xs font-mono shrink-0 mt-0.5" style={{ color: "var(--color-muted)", width: 54 }}>
          unsorted
        </span>
        <span className="inline-flex flex-wrap gap-1">
          {proof.before.map((v, i) => (
            <span key={i} style={{ ...tokenStyle(v), transitionDelay: `${i * 18}ms` }}>
              {v.toLocaleString()}
            </span>
          ))}
        </span>
      </div>

      {/* Sorted row — appears after reveal */}
      {revealed && (
        <div className="flex items-start gap-2">
          <span className="text-xs font-mono shrink-0 mt-0.5" style={{ color: "var(--color-muted)", width: 54 }}>
            sorted
          </span>
          <span className="inline-flex flex-wrap gap-1">
            {proof.after.map((v, i) => (
              <span key={i} style={tokenStyle(v, true)}>
                {v.toLocaleString()}
              </span>
            ))}
          </span>
        </div>
      )}
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function BenchmarkVisualizer() {
  const [selectedSizes, setSelectedSizes] = useState<Set<number>>(
    new Set([100_000, 500_000, 1_000_000])
  );
  const [sizeInput, setSizeInput] = useState("");
  const [scenario, setScenario] = useState<BenchmarkScenario>("random");
  const [trials, setTrials] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(
    new Set(["logos", "timsort"])
  );

  const [status, setStatus] = useState<Status>("idle");
  const [curveData, setCurveData] = useState<CurveData>({});
  const [currentN, setCurrentN] = useState<number | null>(null);
  const [currentAlgo, setCurrentAlgo] = useState<string | null>(null);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [runConfig, setRunConfig] = useState<{
    sizes: number[]; scenario: string; trials: number; algos: string[];
  } | null>(null);
  const [sampleProof, setSampleProof] = useState<{
    before: number[]; after: number[]; n: number;
  } | null>(null);
  const stopRef = useRef(false);

  // Slow algos are disabled if the largest selected size exceeds the threshold
  const maxSelectedSize = selectedSizes.size > 0 ? Math.max(...selectedSizes) : 0;
  const slowDisabled = (id: string) => SLOW_IDS.has(id) && maxSelectedSize > SLOW_THRESHOLD;

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

  const addCustomSize = () => {
    const v = parseInt(sizeInput);
    if (!isNaN(v) && v >= 1) {
      addSize(v);
      setSizeInput("");
    }
  };

  const applyPreset = (sizes: number[]) => setSelectedSizes(new Set(sizes));

  const sortedSizes = [...selectedSizes].sort((a, b) => a - b);
  const activeAlgos = [...selected].filter(id => !slowDisabled(id));
  const canRun = activeAlgos.length > 0 && selectedSizes.size > 0 && status !== "running";

  const run = useCallback(async () => {
    const maxSz = selectedSizes.size > 0 ? Math.max(...selectedSizes) : 0;
    const algos = [...selected].filter(id => !(SLOW_IDS.has(id) && maxSz > SLOW_THRESHOLD));
    if (!algos.length || !selectedSizes.size) return;

    const sizes = [...selectedSizes].sort((a, b) => a - b);
    const total = sizes.length * algos.length;

    stopRef.current = false;
    setStatus("running");
    setCurveData({});
    setSampleProof(null);
    setProgress({ done: 0, total });
    setRunConfig({ sizes, scenario, trials, algos });

    let done = 0;
    // Use a plain object accumulated locally, push to state after each measurement
    const acc: CurveData = {};
    const timedOutAlgos = new Set<string>();
    let sampleCaptured = false;

    for (const sz of sizes) {
      if (stopRef.current) break;
      setCurrentN(sz);
      const input = generateBenchmarkInput(sz, scenario);

      for (const id of algos) {
        if (stopRef.current) break;
        if (timedOutAlgos.has(id)) { done++; setProgress({ done, total }); continue; }
        setCurrentAlgo(id);
        await new Promise<void>(r => setTimeout(r, 0));

        const fn = SORT_FNS[id];
        let best = Infinity;
        let didTimeout = false;

        // Capture a before/after proof sample from the very first sort run
        if (!sampleCaptured) {
          const SAMPLE = 24;
          const step = Math.max(1, Math.floor(input.length / SAMPLE));
          const before = Array.from({ length: SAMPLE }, (_, i) => input[i * step]);
          const sorted = fn([...input]);
          const after = Array.from({ length: SAMPLE }, (_, i) => sorted[i * step]);
          setSampleProof({ before, after, n: sz });
          sampleCaptured = true;
          // Time this first run separately so it still counts
          const copy = [...input];
          const t0 = performance.now();
          fn(copy);
          best = performance.now() - t0;
          if (best >= TIMEOUT_MS) didTimeout = true;
        }

        if (!didTimeout) {
          for (let t = sampleCaptured && done === 0 ? 1 : 0; t < trials; t++) {
            const copy = [...input];
            const t0 = performance.now();
            fn(copy);
            const elapsed = performance.now() - t0;
            best = Math.min(best, elapsed);
            if (elapsed >= TIMEOUT_MS) { didTimeout = true; best = elapsed; break; }
          }
        }

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
  }, [selected, selectedSizes, scenario, trials]); // eslint-disable-line react-hooks/exhaustive-deps

  const stop = () => { stopRef.current = true; };

  const reset = () => {
    stopRef.current = true;
    setStatus("idle");
    setCurveData({});
    setSampleProof(null);
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
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-muted)" }}>
                    Input sizes (n)
                  </span>
                  <div className="flex gap-1.5">
                    {SIZE_PRESETS.map(p => (
                      <button
                        key={p.label}
                        onClick={() => applyPreset(p.sizes)}
                        className="px-2 py-0.5 rounded text-xs"
                        style={{
                          background: "var(--color-surface-3)",
                          border: "1px solid var(--color-border)",
                          color: "var(--color-muted)",
                          cursor: "pointer",
                        }}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Chip grid */}
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {CHIP_SIZES.map(sz => {
                    const on = selectedSizes.has(sz);
                    return (
                      <button
                        key={sz}
                        onClick={() => on ? removeSize(sz) : addSize(sz)}
                        className="flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-mono"
                        style={{
                          background: on ? "rgba(139,58,42,0.12)" : "var(--color-surface-1)",
                          border: `1px solid ${on ? "var(--color-accent)" : "var(--color-border)"}`,
                          color: on ? "var(--color-accent)" : "var(--color-muted)",
                          fontWeight: on ? 600 : 400,
                          cursor: "pointer",
                        }}
                      >
                        {fmtN(sz)}
                        {on && <X size={8} />}
                      </button>
                    );
                  })}
                  {/* Non-preset custom sizes */}
                  {[...selectedSizes]
                    .filter(sz => !CHIP_SIZES.includes(sz))
                    .sort((a, b) => a - b)
                    .map(sz => (
                      <button
                        key={sz}
                        onClick={() => removeSize(sz)}
                        className="flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-mono"
                        style={{
                          background: "rgba(139,58,42,0.12)",
                          border: "1px solid var(--color-accent)",
                          color: "var(--color-accent)",
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        {sz.toLocaleString()} <X size={8} />
                      </button>
                    ))}
                </div>

                {/* Custom size entry */}
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    placeholder="Custom…"
                    value={sizeInput}
                    onChange={e => setSizeInput(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && addCustomSize()}
                    className="rounded px-2.5 py-1 text-xs font-mono w-28"
                    style={{
                      background: "var(--color-surface-1)",
                      border: "1px solid var(--color-border)",
                      color: "var(--color-text)",
                    }}
                  />
                  <button
                    onClick={addCustomSize}
                    className="px-2.5 py-1 rounded text-xs"
                    style={{
                      background: "var(--color-surface-3)",
                      border: "1px solid var(--color-border)",
                      color: "var(--color-muted)",
                      cursor: "pointer",
                    }}
                  >
                    Add
                  </button>
                  <span className="text-xs" style={{ color: "var(--color-muted)" }}>
                    {sortedSizes.length} size{sortedSizes.length !== 1 ? "s" : ""}
                    {sortedSizes.length > 1 && (
                      <span className="ml-1 font-mono">
                        ({fmtN(sortedSizes[0])}–{fmtN(sortedSizes.at(-1)!)})
                      </span>
                    )}
                  </span>
                </div>
              </div>

              {/* Scenario + Trials */}
              <div className="flex flex-wrap gap-4 mb-4">
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-muted)" }}>
                    Scenario
                  </span>
                  <select
                    value={scenario}
                    onChange={e => setScenario(e.target.value as BenchmarkScenario)}
                    className="rounded px-2.5 py-1 text-xs"
                    style={{
                      background: "var(--color-surface-1)",
                      border: "1px solid var(--color-border)",
                      color: "var(--color-text)",
                    }}
                  >
                    <option value="random">Random</option>
                    <option value="nearlySorted">Nearly Sorted</option>
                    <option value="reversed">Reversed</option>
                    <option value="duplicates">Many Duplicates</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-muted)" }}>
                    Trials (best of)
                  </span>
                  <select
                    value={trials}
                    onChange={e => setTrials(Number(e.target.value))}
                    className="rounded px-2.5 py-1 text-xs"
                    style={{
                      background: "var(--color-surface-1)",
                      border: "1px solid var(--color-border)",
                      color: "var(--color-text)",
                    }}
                  >
                    <option value={1}>1</option>
                    <option value={3}>3</option>
                    <option value={5}>5</option>
                  </select>
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
                    ⚠ O(n²) algorithms are disabled for n &gt; {SLOW_THRESHOLD.toLocaleString()}.
                  </p>
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
                          {runConfig.scenario} · best of {runConfig.trials}
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
                  <CurveChart data={curveData} sizes={chartSizes} algos={chartAlgos} />
                )}

                {/* Placeholder while first result loads */}
                {!hasCurveData && status === "running" && (
                  <div className="flex items-center justify-center"
                    style={{ height: 230, color: "var(--color-muted)", fontSize: 13 }}>
                    Waiting for first result…
                  </div>
                )}

                {/* Sample proof — shown directly under chart */}
                {sampleProof && (
                  <SampleProof proof={sampleProof} revealed={status === "done"} />
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
