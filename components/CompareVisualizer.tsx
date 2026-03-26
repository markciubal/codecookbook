"use client";

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import {
  Play,
  Pause,
  RotateCcw,
  SkipBack,
  SkipForward,
  ChevronLeft,
  ChevronRight,
  Zap,
  Turtle,
  Trophy,
} from "lucide-react";
import { getSteps, generateArray, BAR_COLORS, ALGORITHM_META } from "@/lib/algorithms";
import type { SortAlgorithm, SortStep } from "@/lib/types";

// ── Constants ────────────────────────────────────────────────────────────────

const SPEED_MIN = 5;
const SPEED_MAX = 800;

const MEDAL: Record<number, string> = {
  0: "🥇",
  1: "🥈",
  2: "🥉",
};

// Per-lane accent colours — 6 distinct hues
const LANE_ACCENTS = [
  "#5b9bd5", // blue
  "#e67e22", // orange
  "#2ecc71", // green
  "#e74c3c", // red
  "#9b59b6", // purple
  "#f1c40f", // yellow
];

type ArrayType = "random" | "nearly" | "reverse" | "duplicates";

const ALL_ALGORITHMS: { id: SortAlgorithm; label: string; complexity: string; fast: boolean }[] = [
  { id: "logos",     label: "Logos Sort",    complexity: "O(n log n)", fast: true  },
  { id: "introsort", label: "Introsort",     complexity: "O(n log n)", fast: true  },
  { id: "timsort",   label: "Tim Sort",      complexity: "O(n log n)", fast: true  },
  { id: "merge",     label: "Merge Sort",    complexity: "O(n log n)", fast: true  },
  { id: "quick",     label: "Quick Sort",    complexity: "O(n log n)", fast: true  },
  { id: "heap",      label: "Heap Sort",     complexity: "O(n log n)", fast: true  },
  { id: "shell",     label: "Shell Sort",    complexity: "O(n log² n)",fast: true  },
  { id: "counting",  label: "Counting Sort", complexity: "O(n+k)",     fast: true  },
  { id: "radix",     label: "Radix Sort",    complexity: "O(nk)",      fast: true  },
  { id: "bucket",    label: "Bucket Sort",   complexity: "O(n+k)",     fast: true  },
  { id: "insertion", label: "Insertion Sort",complexity: "O(n²)",      fast: false },
  { id: "selection", label: "Selection Sort",complexity: "O(n²)",      fast: false },
  { id: "bubble",    label: "Bubble Sort",   complexity: "O(n²)",      fast: false },
  { id: "cocktail",  label: "Cocktail Sort", complexity: "O(n²)",      fast: false },
  { id: "comb",      label: "Comb Sort",     complexity: "O(n²)",      fast: false },
  { id: "gnome",     label: "Gnome Sort",    complexity: "O(n²)",      fast: false },
  { id: "pancake",   label: "Pancake Sort",  complexity: "O(n²)",      fast: false },
  { id: "cycle",     label: "Cycle Sort",    complexity: "O(n²)",      fast: false },
  { id: "oddeven",   label: "Odd-Even Sort", complexity: "O(n²)",      fast: false },
];

const DEFAULT_SELECTED: SortAlgorithm[] = ["quick", "merge", "bubble", "insertion"];

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildArray(size: number, type: ArrayType): number[] {
  switch (type) {
    case "random":
      return generateArray(size, 1, 100);
    case "nearly": {
      const arr = Array.from({ length: size }, (_, i) => Math.round((i / (size - 1)) * 99) + 1);
      // swap ~10% of elements
      const swaps = Math.floor(size * 0.1);
      for (let s = 0; s < swaps; s++) {
        const a = Math.floor(Math.random() * size);
        const b = Math.floor(Math.random() * size);
        [arr[a], arr[b]] = [arr[b], arr[a]];
      }
      return arr;
    }
    case "reverse":
      return Array.from({ length: size }, (_, i) => Math.round(((size - 1 - i) / (size - 1)) * 99) + 1);
    case "duplicates": {
      const palette = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
      return Array.from({ length: size }, () => palette[Math.floor(Math.random() * palette.length)]);
    }
  }
}

function sortedPercent(step: SortStep): number {
  const count = step.states.filter((s) => s === "sorted").length;
  return Math.round((count / step.array.length) * 100);
}

/**
 * Find the last step index whose cumulative operation count is <= target.
 * opCounts[i] = steps[i].comparisons + steps[i].swaps — monotonically non-decreasing.
 * Using this as the shared time axis normalises across algorithms that record
 * steps at different granularities (e.g. Merge Sort records fewer steps than
 * Quick Sort for the same number of actual comparisons + swaps).
 */
function findStepForOp(opCounts: number[], target: number): number {
  if (opCounts.length === 0) return 0;
  if (opCounts[0] > target) return 0;
  let lo = 0, hi = opCounts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (opCounts[mid] <= target) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

// ── Mini bar chart for each race lane ───────────────────────────────────────

function MiniBarChart({
  step,
  accent,
}: {
  step: SortStep;
  accent: string;
}) {
  const peak = useMemo(() => Math.max(...step.array, 1), [step.array]);
  const n = step.array.length;

  return (
    <div
      className="flex items-end gap-px"
      style={{ height: 56, flex: "0 0 240px", minWidth: 0 }}
    >
      {step.array.map((val, i) => (
        <div
          key={i}
          style={{
            flex: 1,
            height: `${(val / peak) * 100}%`,
            minWidth: 1,
            maxWidth: n <= 50 ? 6 : n <= 100 ? 3 : 2,
            background: BAR_COLORS[step.states[i]],
            borderRadius: "1px 1px 0 0",
          }}
        />
      ))}
    </div>
  );
}

// ── Single race lane ─────────────────────────────────────────────────────────

function RaceLane({
  label,
  accent,
  step,
  currentOps,
  totalOps,
  finishRank,
  allDone,
}: {
  label: string;
  accent: string;
  step: SortStep;
  currentOps: number;   // min(opIdx, totalOps)
  totalOps: number;     // comparisons+swaps at last step
  finishRank: number | null; // 0-based rank when done, null if not done yet
  allDone: boolean;
}) {
  const pct = sortedPercent(step);
  const done = finishRank !== null;
  const stepPct = totalOps > 0 ? Math.round((currentOps / totalOps) * 100) : 0;

  const isWinner = finishRank === 0;

  return (
    <div
      className="flex items-center gap-3 px-3 py-2 rounded-xl"
      style={{
        background: done && isWinner
          ? `color-mix(in srgb, ${accent} 12%, var(--color-surface-2))`
          : "var(--color-surface-2)",
        border: `1px solid ${done ? accent : "var(--color-border)"}`,
        transition: "border-color 0.3s, background 0.3s",
      }}
    >
      {/* Left: name + rank badge */}
      <div
        className="flex flex-col gap-0.5 shrink-0"
        style={{ width: 110 }}
      >
        <div className="flex items-center gap-1.5">
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: accent,
              flexShrink: 0,
            }}
          />
          <span
            className="text-xs font-semibold leading-tight"
            style={{ color: "var(--color-text)" }}
          >
            {label}
          </span>
        </div>
        {done ? (
          <span
            className="text-xs font-bold leading-tight"
            style={{
              color: finishRank < 3 ? accent : "var(--color-muted)",
              fontFamily: "var(--font-mono)",
            }}
          >
            {MEDAL[finishRank] ?? `${finishRank + 1}th`}{" "}
            {finishRank === 0 ? "Winner!" : `place`}
          </span>
        ) : (
          <span
            className="text-xs leading-tight"
            style={{ color: "var(--color-muted)", fontFamily: "var(--font-mono)" }}
          >
            {pct}% sorted
          </span>
        )}
      </div>

      {/* Mini bar chart */}
      <div className="shrink-0 overflow-hidden rounded" style={{ background: "var(--color-surface-3)", padding: "2px 2px 0" }}>
        <MiniBarChart step={step} accent={accent} />
      </div>

      {/* Progress bar column */}
      <div className="flex flex-col gap-1 flex-1 min-w-0">
        {/* Step progress bar */}
        <div
          className="flex items-center gap-2"
        >
          <div
            className="flex-1 rounded-full overflow-hidden"
            style={{ height: 8, background: "var(--color-surface-3)" }}
          >
            <div
              style={{
                width: `${stepPct}%`,
                height: "100%",
                background: done ? accent : `color-mix(in srgb, ${accent} 70%, transparent)`,
                borderRadius: "inherit",
                transition: "width 0.1s linear",
              }}
            />
          </div>
          <span
            className="text-xs shrink-0"
            style={{
              color: done ? accent : "var(--color-muted)",
              fontFamily: "var(--font-mono)",
              minWidth: 30,
              textAlign: "right",
            }}
          >
            {stepPct}%
          </span>
        </div>
        {/* Op count */}
        <span
          className="text-xs"
          style={{ color: "var(--color-muted)", fontFamily: "var(--font-mono)" }}
        >
          {currentOps.toLocaleString()} / {totalOps.toLocaleString()} ops
        </span>
      </div>

      {/* Right: stats */}
      <div
        className="flex flex-col gap-0.5 text-xs shrink-0"
        style={{ fontFamily: "var(--font-mono)", minWidth: 120, textAlign: "right" }}
      >
        <span style={{ color: "var(--color-state-compare)" }}>
          cmp {step.comparisons.toLocaleString()}
        </span>
        <span style={{ color: "var(--color-state-swap)" }}>
          swp {step.swaps.toLocaleString()}
        </span>
        <span style={{ color: done ? "var(--color-state-sorted)" : "var(--color-muted)" }}>
          {done ? (allDone ? "done" : "finished") : "running"}
        </span>
      </div>
    </div>
  );
}

// ── Algorithm selector checkboxes ────────────────────────────────────────────

function AlgorithmSelector({
  selected,
  onChange,
}: {
  selected: SortAlgorithm[];
  onChange: (ids: SortAlgorithm[]) => void;
}) {
  const toggle = (id: SortAlgorithm) => {
    if (selected.includes(id)) {
      if (selected.length <= 2) return; // minimum 2
      onChange(selected.filter((s) => s !== id));
    } else {
      if (selected.length >= 6) return; // maximum 6
      onChange([...selected, id]);
    }
  };

  const selectFast = () => {
    const fast = ALL_ALGORITHMS.filter((a) => a.fast).map((a) => a.id).slice(0, 6);
    onChange(fast);
  };

  const selectSlow = () => {
    const slow = ALL_ALGORITHMS.filter((a) => !a.fast).map((a) => a.id).slice(0, 6);
    onChange(slow);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-muted)" }}>
          Algorithms (2–6)
        </span>
        <button
          onClick={selectFast}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs"
          style={{
            background: "var(--color-surface-3)",
            border: "1px solid var(--color-border)",
            color: "var(--color-text)",
            cursor: "pointer",
          }}
        >
          <Zap size={10} strokeWidth={2} />
          All fast
        </button>
        <button
          onClick={selectSlow}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs"
          style={{
            background: "var(--color-surface-3)",
            border: "1px solid var(--color-border)",
            color: "var(--color-text)",
            cursor: "pointer",
          }}
        >
          <Turtle size={10} strokeWidth={2} />
          All slow
        </button>
        <span className="text-xs" style={{ color: "var(--color-muted)" }}>
          {selected.length}/6 selected
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {ALL_ALGORITHMS.map(({ id, label, complexity, fast }) => {
          const isSelected = selected.includes(id);
          const accent = isSelected
            ? LANE_ACCENTS[selected.indexOf(id) % LANE_ACCENTS.length]
            : undefined;
          const canAdd = selected.length < 6;
          const canRemove = selected.length > 2;
          const disabled = isSelected ? !canRemove : !canAdd;
          return (
            <button
              key={id}
              onClick={() => toggle(id)}
              disabled={disabled}
              title={complexity}
              className="px-2 py-0.5 rounded text-xs font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                background: isSelected
                  ? `color-mix(in srgb, ${accent} 20%, var(--color-surface-2))`
                  : "var(--color-surface-3)",
                border: `1px solid ${isSelected ? accent! : "var(--color-border)"}`,
                color: isSelected ? accent : "var(--color-muted)",
                cursor: disabled ? "not-allowed" : "pointer",
              }}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Post-race summary ────────────────────────────────────────────────────────

function RaceSummary({
  ranking,
}: {
  ranking: { id: SortAlgorithm; label: string; accent: string; steps: number; comparisons: number; swaps: number }[];
}) {
  return (
    <div
      className="shrink-0 px-5 py-3"
      style={{ borderTop: "1px solid var(--color-border)", background: "var(--color-surface-1)" }}
    >
      <div className="flex items-center gap-2 mb-2">
        <Trophy size={14} style={{ color: "var(--color-accent)" }} strokeWidth={1.75} />
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-muted)" }}>
          Race Results
        </span>
      </div>
      <div className="flex flex-wrap gap-3">
        {ranking.map((r, rank) => (
          <div key={r.id} className="flex items-baseline gap-1.5">
            <span className="text-sm">{MEDAL[rank] ?? `${rank + 1}.`}</span>
            <span className="text-xs font-semibold" style={{ color: r.accent }}>{r.label}</span>
            <span className="text-xs" style={{ color: "var(--color-muted)", fontFamily: "var(--font-mono)" }}>
              {r.steps.toLocaleString()} steps · {r.comparisons.toLocaleString()} cmp · {r.swaps.toLocaleString()} swp
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export default function CompareVisualizer() {
  const [selected, setSelected] = useState<SortAlgorithm[]>(DEFAULT_SELECTED);
  const [size, setSize] = useState(50);
  const [arrayType, setArrayType] = useState<ArrayType>("random");
  const [speed, setSpeed] = useState(150);
  const [isPlaying, setIsPlaying] = useState(false);
  // opIdx is the shared "operations done" counter (comparisons + swaps).
  // Using this instead of raw step count normalises across algorithms that
  // record steps at very different granularities.
  const [opIdx, setOpIdx] = useState(0);

  // The shared base array (same values for all algos)
  const [sharedArray, setSharedArray] = useState<number[]>(() => buildArray(50, "random"));

  // Track finish order: algId -> 0-based rank
  const [finishOrder, setFinishOrder] = useState<Map<SortAlgorithm, number>>(new Map());
  const finishCountRef = useRef(0);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Precompute steps + per-step operation counts for all selected algorithms
  const allAlgData = useMemo(() => {
    return selected.map((id) => {
      const steps = getSteps(id, [...sharedArray]);
      // opCounts[i] = cumulative comparisons+swaps at step i (monotonically non-decreasing)
      const opCounts = steps.map((s) => s.comparisons + s.swaps);
      const totalOps = Math.max(opCounts[opCounts.length - 1] ?? 0, 1);
      return { id, label: ALGORITHM_META[id].name, steps, opCounts, totalOps };
    });
  }, [selected, sharedArray]);

  const maxOps = useMemo(
    () => Math.max(...allAlgData.map((a) => a.totalOps), 1),
    [allAlgData]
  );

  const allDone = opIdx >= maxOps;

  // Reset everything (new array, new race)
  const reset = useCallback(() => {
    setIsPlaying(false);
    if (timerRef.current) clearTimeout(timerRef.current);
    setSharedArray(buildArray(size, arrayType));
    setOpIdx(0);
    setFinishOrder(new Map());
    finishCountRef.current = 0;
  }, [size, arrayType]);

  // When selected algorithms or array params change, reset
  // (but not on every stepIdx change, which would be infinite)
  const prevSelectedRef = useRef<string>(DEFAULT_SELECTED.join(","));
  const prevSizeRef = useRef(50);
  const prevTypeRef = useRef<ArrayType>("random");

  useEffect(() => {
    const selStr = selected.join(",");
    if (
      selStr !== prevSelectedRef.current ||
      size !== prevSizeRef.current ||
      arrayType !== prevTypeRef.current
    ) {
      prevSelectedRef.current = selStr;
      prevSizeRef.current = size;
      prevTypeRef.current = arrayType;
      reset();
    }
  }, [selected, size, arrayType, reset]);

  // Detect when individual algorithms finish to record their rank
  useEffect(() => {
    const newOrder = new Map(finishOrder);
    let changed = false;
    for (const { id, totalOps } of allAlgData) {
      if (!newOrder.has(id) && opIdx >= totalOps) {
        newOrder.set(id, finishCountRef.current);
        finishCountRef.current += 1;
        changed = true;
      }
    }
    if (changed) setFinishOrder(newOrder);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opIdx, allAlgData]);

  // Playback timer
  useEffect(() => {
    if (!isPlaying) return;
    if (allDone) {
      setIsPlaying(false);
      return;
    }
    timerRef.current = setTimeout(() => {
      setOpIdx((prev) => Math.min(prev + 1, maxOps));
    }, speed);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isPlaying, opIdx, allDone, speed, maxOps]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      if (e.code === "Space") {
        e.preventDefault();
        if (!allDone || isPlaying) setIsPlaying((p) => !p);
      } else if (e.code === "ArrowRight") {
        setIsPlaying(false);
        setOpIdx((p) => Math.min(p + 1, maxOps));
      } else if (e.code === "ArrowLeft") {
        setIsPlaying(false);
        setOpIdx((p) => Math.max(0, p - 1));
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [allDone, isPlaying, maxOps]);

  const canStep = !allDone;
  const canBack = opIdx > 0;

  const stepForward = () => {
    setIsPlaying(false);
    setOpIdx((p) => Math.min(p + 1, maxOps));
  };
  const stepBack = () => {
    setIsPlaying(false);
    setOpIdx((p) => Math.max(0, p - 1));
  };

  // Build ranking for summary (sorted by finish order)
  const ranking = useMemo(() => {
    return [...finishOrder.entries()]
      .sort(([, a], [, b]) => a - b)
      .map(([id, rank]) => {
        const algData = allAlgData.find((a) => a.id === id)!;
        const lastStep = algData.steps[algData.steps.length - 1];
        return {
          id,
          label: ALGORITHM_META[id].name,
          accent: LANE_ACCENTS[selected.indexOf(id) % LANE_ACCENTS.length],
          steps: algData.steps.length,
          comparisons: lastStep.comparisons,
          swaps: lastStep.swaps,
          rank,
        };
      });
  }, [finishOrder, allAlgData, selected]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div
        className="flex flex-col gap-1 px-5 pt-4 pb-3 shrink-0"
        style={{ borderBottom: "1px solid var(--color-border)" }}
      >
        <div className="flex items-center gap-2">
          <Trophy size={20} style={{ color: "var(--color-accent)" }} strokeWidth={1.75} />
          <h1 className="text-2xl font-bold">Algorithm Race</h1>
        </div>
        <p className="text-sm" style={{ color: "var(--color-muted)" }}>
          Up to 6 algorithms, one array — watch them race step-by-step on identical input.
        </p>
      </div>

      {/* ── Controls ───────────────────────────────────────────────────────── */}
      <div
        className="flex flex-col gap-2.5 px-5 py-3 shrink-0"
        style={{ borderBottom: "1px solid var(--color-border)", background: "var(--color-surface-1)" }}
      >
        {/* Algorithm selector */}
        <AlgorithmSelector selected={selected} onChange={setSelected} />

        {/* Array controls row */}
        <div className="flex flex-wrap items-center gap-4">
          {/* New Race button */}
          <button
            onClick={reset}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:-translate-y-0.5 hover:brightness-110 active:translate-y-0"
            style={{
              background: "var(--color-accent)",
              color: "#fff",
              border: "2px solid var(--color-accent)",
              cursor: "pointer",
              whiteSpace: "nowrap",
              boxShadow: "0 2px 8px rgba(0,0,0,0.18)",
            }}
          >
            <RotateCcw size={12} strokeWidth={2} />
            New Race
          </button>

          {/* Size */}
          <label className="flex items-center gap-2 text-xs" style={{ color: "var(--color-muted)" }}>
            Size
            <input
              type="range"
              min={10}
              max={200}
              value={size}
              onChange={(e) => setSize(Number(e.target.value))}
              disabled={isPlaying}
              style={{ width: 80 }}
            />
            <span style={{ fontFamily: "var(--font-mono)", color: "var(--color-text)", minWidth: 28 }}>{size}</span>
          </label>

          {/* Array type */}
          <label className="flex items-center gap-2 text-xs" style={{ color: "var(--color-muted)" }}>
            Type
            <select
              value={arrayType}
              onChange={(e) => setArrayType(e.target.value as ArrayType)}
              disabled={isPlaying}
              className="rounded px-1.5 py-0.5 text-xs"
              style={{
                background: "var(--color-surface-2)",
                border: "1px solid var(--color-border)",
                color: "var(--color-text)",
                cursor: "pointer",
              }}
            >
              <option value="random">Random</option>
              <option value="nearly">Nearly Sorted</option>
              <option value="reverse">Reverse Sorted</option>
              <option value="duplicates">Many Duplicates</option>
            </select>
          </label>

          {/* Speed */}
          <label className="flex items-center gap-2 text-xs" style={{ color: "var(--color-muted)" }}>
            Speed
            <input
              type="range"
              min={SPEED_MIN}
              max={SPEED_MAX}
              step={5}
              value={SPEED_MAX + SPEED_MIN - speed}
              onChange={(e) => setSpeed(SPEED_MAX + SPEED_MIN - Number(e.target.value))}
              style={{ width: 80 }}
            />
          </label>

          {/* Transport */}
          <div className="flex items-center gap-1.5">
            <Btn
              onClick={() => { setIsPlaying(false); setOpIdx(0); }}
              disabled={!canBack}
              title="Go to start (Home)"
            >
              <SkipBack size={13} strokeWidth={1.75} />
            </Btn>
            <Btn onClick={stepBack} disabled={!canBack} title="Previous op (←)">
              <ChevronLeft size={13} strokeWidth={1.75} />
            </Btn>
            <Btn
              primary
              onClick={() => setIsPlaying((p) => !p)}
              disabled={!canStep && !isPlaying}
              title="Play/Pause (Space)"
            >
              {isPlaying
                ? <><Pause size={12} strokeWidth={1.75} /> Pause</>
                : <><Play size={12} strokeWidth={1.75} /> Play</>
              }
            </Btn>
            <Btn onClick={stepForward} disabled={!canStep} title="Next op (→)">
              <ChevronRight size={13} strokeWidth={1.75} />
            </Btn>
            <Btn
              onClick={() => { setIsPlaying(false); setOpIdx(maxOps); }}
              disabled={!canStep}
              title="Go to end"
            >
              <SkipForward size={13} strokeWidth={1.75} />
            </Btn>
          </div>

          {/* Op counter */}
          <span
            className="text-xs"
            style={{ color: "var(--color-muted)", fontFamily: "var(--font-mono)" }}
          >
            op {opIdx.toLocaleString()} / {maxOps.toLocaleString()}
          </span>
        </div>

        {/* Global scrubber */}
        <input
          type="range"
          min={0}
          max={maxOps}
          value={opIdx}
          onChange={(e) => {
            setIsPlaying(false);
            setOpIdx(Number(e.target.value));
          }}
          className="w-full"
          style={{ accentColor: "var(--color-accent)" }}
        />
      </div>

      {/* ── Race lanes ─────────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 flex flex-col gap-2 p-4 overflow-y-auto">
        {allAlgData.map(({ id, label, steps, opCounts, totalOps }, laneIdx) => {
          const accent = LANE_ACCENTS[laneIdx % LANE_ACCENTS.length];
          const stepIdx = findStepForOp(opCounts, opIdx);
          const step = steps[stepIdx];
          const currentOps = Math.min(opIdx, totalOps);
          const rank = finishOrder.get(id) ?? null;
          return (
            <RaceLane
              key={id}
              label={label}
              accent={accent}
              step={step}
              currentOps={currentOps}
              totalOps={totalOps}
              finishRank={rank}
              allDone={allDone}
            />
          );
        })}
      </div>

      {/* ── Race summary (shown when all done) ─────────────────────────────── */}
      {allDone && ranking.length === selected.length && (
        <RaceSummary ranking={ranking} />
      )}
    </div>
  );
}

// ── Shared sub-components ────────────────────────────────────────────────────

function Btn({
  children,
  onClick,
  disabled,
  primary,
  title,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  primary?: boolean;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      style={{
        background: primary ? "var(--color-accent)" : "var(--color-surface-3)",
        color: primary ? "#fff" : "var(--color-text)",
        border: "1px solid " + (primary ? "var(--color-accent)" : "var(--color-border)"),
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      {children}
    </button>
  );
}
