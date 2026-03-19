"use client";

import { useState, useCallback, useRef } from "react";
import { Play, Square, RotateCcw, Trophy, Zap } from "lucide-react";
import { generateBenchmarkInput, SORT_FNS, type BenchmarkScenario } from "@/lib/benchmark";

// ── Static config ─────────────────────────────────────────────────────────────

const SLOW_IDS = new Set(["insertion", "selection", "bubble"]);
const SLOW_THRESHOLD = 5_000;

const ALGO_GROUPS = [
  {
    label: "O(n log n)",
    items: [
      { id: "logos",   name: "Logos Sort",     href: "/sorting/logos" },
      { id: "timsort", name: "Tim Sort",        href: "/sorting/timsort" },
      { id: "merge",   name: "Merge Sort",      href: "/sorting/merge" },
      { id: "quick",   name: "Quick Sort",      href: "/sorting/quick" },
      { id: "heap",    name: "Heap Sort",        href: "/sorting/heap" },
    ],
  },
  {
    label: "Other",
    items: [
      { id: "shell",    name: "Shell Sort",     badge: "O(n log² n)" },
      { id: "counting", name: "Counting Sort",  badge: "O(n+k)" },
      { id: "radix",    name: "Radix Sort",     badge: "O(nk)" },
      { id: "bucket",   name: "Bucket Sort",    badge: "O(n+k)" },
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
  logos: "Logos Sort", timsort: "Tim Sort", merge: "Merge Sort",
  quick: "Quick Sort", heap: "Heap Sort",   shell: "Shell Sort",
  counting: "Counting Sort", radix: "Radix Sort", bucket: "Bucket Sort",
  insertion: "Insertion Sort", selection: "Selection Sort", bubble: "Bubble Sort",
};

const RANK_COLORS = ["#c9961a", "#888", "#b06830"];

function rankColor(rank: number, total: number): string {
  if (rank <= 3) return RANK_COLORS[rank - 1];
  if (rank === total) return "var(--color-state-swap)";
  return "var(--color-muted)";
}

function fmtTime(ms: number): string {
  if (ms < 0.1)   return `${(ms * 1000).toFixed(0)} μs`;
  if (ms < 10)    return `${ms.toFixed(3)} ms`;
  if (ms < 1000)  return `${ms.toFixed(1)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

// ── Types ─────────────────────────────────────────────────────────────────────

type Status = "idle" | "running" | "done";

interface Result {
  id: string;
  timeMs: number;
  rank: number;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function BenchmarkVisualizer() {
  const [n, setN] = useState(10_000);
  const [nInput, setNInput] = useState("10000");
  const [scenario, setScenario] = useState<BenchmarkScenario>("random");
  const [trials, setTrials] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(
    new Set(["logos", "timsort", "merge", "quick", "heap"])
  );

  const [status, setStatus] = useState<Status>("idle");
  const [results, setResults] = useState<Result[]>([]);
  const [currentAlgo, setCurrentAlgo] = useState<string | null>(null);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [runConfig, setRunConfig] = useState<{ n: number; scenario: string; trials: number } | null>(null);
  const stopRef = useRef(false);

  const slowDisabled = (id: string) => SLOW_IDS.has(id) && n > SLOW_THRESHOLD;

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
      allOn ? active.forEach(id => next.delete(id)) : active.forEach(id => next.add(id));
      return next;
    });
  };

  const canRun = [...selected].some(id => !slowDisabled(id)) && status !== "running";

  const run = useCallback(async () => {
    const activeIds = [...selected].filter(id => !slowDisabled(id));
    if (!activeIds.length) return;

    stopRef.current = false;
    setStatus("running");
    setResults([]);
    setProgress({ done: 0, total: activeIds.length });
    setRunConfig({ n, scenario, trials });

    const input = generateBenchmarkInput(n, scenario);
    const partial: Result[] = [];

    for (let a = 0; a < activeIds.length; a++) {
      if (stopRef.current) break;
      const id = activeIds[a];
      setCurrentAlgo(id);
      await new Promise<void>(r => setTimeout(r, 0));

      const fn = SORT_FNS[id];
      let best = Infinity;
      for (let t = 0; t < trials; t++) {
        const copy = [...input];
        const t0 = performance.now();
        fn(copy);
        best = Math.min(best, performance.now() - t0);
      }

      partial.push({ id, timeMs: best, rank: 0 });
      const ranked = [...partial]
        .sort((x, y) => x.timeMs - y.timeMs)
        .map((r, i) => ({ ...r, rank: i + 1 }));
      setResults(ranked);
      setProgress({ done: a + 1, total: activeIds.length });
      await new Promise<void>(r => setTimeout(r, 0));
    }

    setCurrentAlgo(null);
    setStatus("done");
  }, [selected, n, scenario, trials]); // eslint-disable-line react-hooks/exhaustive-deps

  const stop = () => { stopRef.current = true; };

  const reset = () => {
    stopRef.current = true;
    setStatus("idle");
    setResults([]);
    setCurrentAlgo(null);
    setRunConfig(null);
  };

  const slowest = results.length ? Math.max(...results.map(r => r.timeMs)) : 1;
  const fastest = results.length ? results[0].timeMs : 1;

  return (
    <div className="flex flex-col h-dvh overflow-hidden">
      {/* Header */}
      <div
        className="flex flex-col gap-1 px-5 pt-6 pb-4"
        style={{ borderBottom: "1px solid var(--color-border)" }}
      >
        <div className="flex items-center gap-2.5">
          <Zap size={20} style={{ color: "var(--color-accent)" }} strokeWidth={1.75} />
          <h1 className="text-2xl font-bold">Algorithm Benchmark</h1>
        </div>
        <p className="text-sm max-w-xl" style={{ color: "var(--color-muted)" }}>
          Race sorting algorithms head-to-head on real data. Select algorithms, choose input size and scenario, then run.
        </p>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-5 py-5 flex flex-col gap-5 max-w-3xl">

          {/* ── Config card ── */}
          <div
            className="rounded-xl p-5"
            style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)" }}
          >
            {/* Row: n + scenario + trials */}
            <div className="flex flex-wrap gap-5 mb-5">

              {/* n */}
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-muted)" }}>
                  Input size (n)
                </span>
                <input
                  type="number"
                  min={100}
                  max={500_000}
                  value={nInput}
                  onChange={e => {
                    setNInput(e.target.value);
                    const v = parseInt(e.target.value);
                    if (!isNaN(v) && v >= 100) setN(v);
                  }}
                  className="rounded-lg px-3 py-1.5 text-sm font-mono w-28"
                  style={{
                    background: "var(--color-surface-1)",
                    border: "1px solid var(--color-border)",
                    color: "var(--color-text)",
                  }}
                />
                <div className="flex gap-1">
                  {[1_000, 10_000, 50_000, 100_000].map(v => (
                    <button
                      key={v}
                      onClick={() => { setN(v); setNInput(String(v)); }}
                      className="px-2 py-0.5 rounded text-xs font-mono"
                      style={{
                        background: n === v ? "var(--color-accent)" : "var(--color-surface-3)",
                        color: n === v ? "#fff" : "var(--color-muted)",
                        border: "1px solid var(--color-border)",
                        cursor: "pointer",
                      }}
                    >
                      {v >= 1000 ? `${v / 1000}k` : v}
                    </button>
                  ))}
                </div>
              </div>

              {/* Scenario */}
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-muted)" }}>
                  Scenario
                </span>
                <select
                  value={scenario}
                  onChange={e => setScenario(e.target.value as BenchmarkScenario)}
                  className="rounded-lg px-3 py-1.5 text-sm"
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

              {/* Trials */}
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-muted)" }}>
                  Trials (best of)
                </span>
                <select
                  value={trials}
                  onChange={e => setTrials(Number(e.target.value))}
                  className="rounded-lg px-3 py-1.5 text-sm"
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
            <div className="mb-5">
              <p
                className="text-xs font-semibold uppercase tracking-wider mb-3"
                style={{ color: "var(--color-muted)" }}
              >
                Algorithms
              </p>
              <div className="flex flex-col gap-4">
                {ALGO_GROUPS.map(group => {
                  const groupIds = group.items.map(i => i.id);
                  const activeIds = groupIds.filter(id => !slowDisabled(id));
                  const allOn = activeIds.length > 0 && activeIds.every(id => selected.has(id));
                  const someOn = activeIds.some(id => selected.has(id));

                  return (
                    <div key={group.label}>
                      <div className="flex items-center gap-2 mb-2">
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
                      <div className="flex flex-wrap gap-2">
                        {group.items.map(item => {
                          const disabled = slowDisabled(item.id);
                          const checked = selected.has(item.id) && !disabled;
                          return (
                            <label
                              key={item.id}
                              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm select-none"
                              style={{
                                background: checked ? "rgba(139,58,42,0.1)" : "var(--color-surface-1)",
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
                              {item.name}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              {n > SLOW_THRESHOLD && (
                <p className="mt-3 text-xs" style={{ color: "var(--color-state-swap)" }}>
                  ⚠ O(n²) algorithms are disabled for n &gt; {SLOW_THRESHOLD.toLocaleString()} to prevent browser freeze.
                </p>
              )}
            </div>

            {/* Buttons */}
            <div className="flex gap-2">
              <button
                onClick={run}
                disabled={!canRun}
                className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
                style={{
                  background: "var(--color-accent)",
                  color: "#fff",
                  border: "none",
                  cursor: canRun ? "pointer" : "not-allowed",
                }}
              >
                <Play size={13} strokeWidth={2} />
                {status === "running" ? `Running… (${progress.done}/${progress.total})` : "Run Benchmark"}
              </button>

              {status === "running" && (
                <button
                  onClick={stop}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold"
                  style={{
                    background: "var(--color-state-swap)",
                    color: "#fff",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  <Square size={13} strokeWidth={2} fill="currentColor" /> Stop
                </button>
              )}

              {status === "done" && (
                <button
                  onClick={reset}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
                  style={{
                    background: "var(--color-surface-3)",
                    border: "1px solid var(--color-border)",
                    color: "var(--color-muted)",
                    cursor: "pointer",
                  }}
                >
                  <RotateCcw size={13} strokeWidth={1.75} /> Reset
                </button>
              )}
            </div>
          </div>

          {/* ── Results card ── */}
          {(results.length > 0 || status === "running") && (
            <div
              className="rounded-xl p-5"
              style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)" }}
            >
              {/* Results header */}
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="font-semibold text-sm" style={{ color: "var(--color-text)" }}>
                    Results
                    {runConfig && (
                      <span className="ml-2 font-mono font-normal text-xs" style={{ color: "var(--color-muted)" }}>
                        n={runConfig.n.toLocaleString()} · {runConfig.scenario} · best of {runConfig.trials}
                      </span>
                    )}
                  </p>
                  {status === "running" && currentAlgo && (
                    <p className="text-xs mt-0.5" style={{ color: "var(--color-muted)" }}>
                      Timing {ALGO_NAMES[currentAlgo]}…
                    </p>
                  )}
                </div>
                {status === "done" && results[0] && (
                  <div
                    className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold"
                    style={{ background: "rgba(201,150,26,0.15)", color: "#c9961a" }}
                  >
                    <Trophy size={12} /> {ALGO_NAMES[results[0].id]} wins
                  </div>
                )}
              </div>

              {/* Result rows */}
              <div className="flex flex-col gap-2.5">
                {results.map(r => {
                  const barPct = slowest > 0 ? (r.timeMs / slowest) * 100 : 0;
                  const color = rankColor(r.rank, results.length);
                  const isRunning = status === "running" && currentAlgo === r.id;

                  return (
                    <div key={r.id} className="flex items-center gap-3">
                      {/* Rank */}
                      <div
                        className="text-xs font-mono w-4 text-right shrink-0"
                        style={{ color }}
                      >
                        {r.rank}
                      </div>

                      {/* Name */}
                      <div
                        className="text-sm shrink-0 w-28 truncate"
                        style={{ color: isRunning ? "var(--color-accent)" : "var(--color-text)", fontWeight: r.rank === 1 ? 600 : 400 }}
                      >
                        {ALGO_NAMES[r.id]}
                      </div>

                      {/* Bar */}
                      <div
                        className="flex-1 rounded overflow-hidden"
                        style={{ background: "var(--color-surface-3)", height: 18 }}
                      >
                        <div
                          style={{
                            width: `${barPct}%`,
                            height: "100%",
                            background: color,
                            borderRadius: 4,
                            minWidth: barPct > 0 ? 3 : 0,
                            transition: "width 0.35s ease",
                            opacity: 0.85,
                          }}
                        />
                      </div>

                      {/* Time */}
                      <div className="text-xs font-mono w-20 text-right shrink-0" style={{ color }}>
                        {fmtTime(r.timeMs)}
                      </div>

                      {/* Ratio */}
                      <div
                        className="text-xs font-mono w-14 text-right shrink-0"
                        style={{ color: "var(--color-muted)" }}
                      >
                        {r.rank === 1 ? "fastest" : `${(r.timeMs / fastest).toFixed(1)}×`}
                      </div>
                    </div>
                  );
                })}
              </div>

              {status === "running" && (
                <p className="text-xs mt-3" style={{ color: "var(--color-muted)" }}>
                  Results update as each algorithm finishes. Rankings may shift.
                </p>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
