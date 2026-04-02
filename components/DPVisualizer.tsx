"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Play, Pause, SkipBack, SkipForward, RotateCcw, ChevronLeft, ChevronRight } from "lucide-react";
import { getDPSteps } from "@/lib/dp-algorithms";
import type { DPAlgorithm, DPStep } from "@/lib/dp-algorithms";

// ── Meta ──────────────────────────────────────────────────────────────────────

const META: Record<
  DPAlgorithm,
  { name: string; time: string; space: string; description: string }
> = {
  lcs: {
    name: "Longest Common Subsequence",
    time: "O(mn)",
    space: "O(mn)",
    description:
      "Find the longest subsequence present in both strings. A subsequence need not be contiguous. Classic DP with optimal substructure: LCS(s1,s2) = LCS(s1[:-1],s2[:-1])+1 if last chars match, else max(LCS(s1[:-1],s2), LCS(s1,s2[:-1])).",
  },
  "edit-distance": {
    name: "Edit Distance (Levenshtein)",
    time: "O(mn)",
    space: "O(mn)",
    description:
      "Minimum number of single-character edits (insertions, deletions, replacements) to transform one string into another. Used in spell checkers, diff tools, and DNA alignment.",
  },
  knapsack: {
    name: "0/1 Knapsack",
    time: "O(nW)",
    space: "O(nW)",
    description:
      "Given items with weights and values, find the maximum value subset fitting in a knapsack of given capacity. Each item can be taken at most once (0/1 constraint).",
  },
  "coin-change": {
    name: "Coin Change",
    time: "O(amount·coins)",
    space: "O(amount)",
    description:
      "Find the minimum number of coins that sum to a target amount. A 1D DP where dp[a] = min coins to make amount a, built bottom-up from dp[0]=0.",
  },
};

// ── Default inputs per algorithm ──────────────────────────────────────────────

interface LCSInput { s1: string; s2: string }
interface EditDistInput { s1: string; s2: string }
interface KnapsackInput { weights: number[]; values: number[]; capacity: number }
interface CoinChangeInput { coins: number[]; amount: number }

type AlgoInput =
  | { algo: "lcs"; data: LCSInput }
  | { algo: "edit-distance"; data: EditDistInput }
  | { algo: "knapsack"; data: KnapsackInput }
  | { algo: "coin-change"; data: CoinChangeInput };

function defaultInput(algorithm: DPAlgorithm): AlgoInput {
  switch (algorithm) {
    case "lcs":
      return { algo: "lcs", data: { s1: "ABCBDAB", s2: "BDCABA" } };
    case "edit-distance":
      return { algo: "edit-distance", data: { s1: "kitten", s2: "sitting" } };
    case "knapsack":
      return {
        algo: "knapsack",
        data: { weights: [2, 3, 4, 5], values: [3, 4, 5, 6], capacity: 8 },
      };
    case "coin-change":
      return { algo: "coin-change", data: { coins: [1, 5, 10, 25], amount: 41 } };
  }
}

function stepsFromInput(input: AlgoInput): DPStep[] {
  switch (input.algo) {
    case "lcs":
      return getDPSteps("lcs", input.data.s1, input.data.s2);
    case "edit-distance":
      return getDPSteps("edit-distance", input.data.s1, input.data.s2);
    case "knapsack":
      return getDPSteps("knapsack", input.data.weights, input.data.values, input.data.capacity);
    case "coin-change":
      return getDPSteps("coin-change", input.data.coins, input.data.amount);
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  algorithm: DPAlgorithm;
}

export default function DPVisualizer({ algorithm }: Props) {
  const meta = META[algorithm];
  const [input, setInput] = useState<AlgoInput>(() => defaultInput(algorithm));
  const [steps, setSteps] = useState<DPStep[]>(() => stepsFromInput(defaultInput(algorithm)));
  const [stepIdx, setStepIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(200);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Regenerate steps when input changes
  const regenerate = useCallback((inp: AlgoInput) => {
    setIsPlaying(false);
    setSteps(stepsFromInput(inp));
    setStepIdx(0);
  }, []);

  // Playback loop
  useEffect(() => {
    if (!isPlaying) return;
    timerRef.current = setTimeout(() => {
      setStepIdx((prev) => {
        if (prev >= steps.length - 1) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, speed);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isPlaying, stepIdx, steps.length, speed]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      )
        return;
      if (e.key === " ") {
        e.preventDefault();
        setIsPlaying((p) => {
          if (!p && stepIdx >= steps.length - 1) return p;
          return !p;
        });
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        setIsPlaying(false);
        setStepIdx((p) => Math.min(p + 1, steps.length - 1));
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        setIsPlaying(false);
        setStepIdx((p) => Math.max(p - 1, 0));
      } else if (e.key === "r" || e.key === "R") {
        setIsPlaying(false);
        setStepIdx(0);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isPlaying, stepIdx, steps.length]);

  const step = steps[stepIdx];
  if (!step) return null;

  const canBack = stepIdx > 0;
  const canForward = stepIdx < steps.length - 1;
  const isComplete = stepIdx === steps.length - 1 && steps.length > 1;

  // Determine row/col headers
  const rowHeaders = getRowHeaders(algorithm, input);
  const colHeaders = getColHeaders(algorithm, input);

  // Determine backtrack path set for quick lookup
  const backtrackSet = new Set<string>();
  if (step.backtrackPath) {
    for (const [r, c] of step.backtrackPath) {
      backtrackSet.add(`${r},${c}`);
    }
  }

  return (
    <div
      className="flex flex-col h-full overflow-hidden"
      style={{ fontFamily: "var(--font-sans)" }}
    >
      {/* ── Header ── */}
      <div
        className="flex flex-col gap-1 px-5 pt-6 pb-4"
        style={{ borderBottom: "1px solid var(--color-border)" }}
      >
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold">{meta.name}</h1>
          <ComplexityBadge label={`Time: ${meta.time}`} />
          <ComplexityBadge label={`Space: ${meta.space}`} accent />
        </div>
        <p className="text-sm max-w-2xl" style={{ color: "var(--color-muted)" }}>
          {meta.description}
        </p>
      </div>

      {/* ── Body ── */}
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
        {/* Controls row */}
        <div
          className="flex flex-wrap items-center gap-3 px-5 py-3"
          style={{ borderBottom: "1px solid var(--color-border)" }}
        >
          {/* Transport */}
          <div className="flex items-center gap-1">
            <TBtn onClick={() => { setIsPlaying(false); setStepIdx(0); }} disabled={!canBack}>
              <SkipBack size={13} strokeWidth={1.75} />
            </TBtn>
            <TBtn onClick={() => { setIsPlaying(false); setStepIdx((p) => Math.max(0, p - 1)); }} disabled={!canBack}>
              <ChevronLeft size={13} strokeWidth={1.75} />
            </TBtn>
            <TBtn primary onClick={() => setIsPlaying((p) => !p)} disabled={!canForward} style={{ minWidth: 80 }}>
              {isPlaying ? <><Pause size={12} strokeWidth={1.75} /> Pause</> : <><Play size={12} strokeWidth={1.75} /> Play</>}
            </TBtn>
            <TBtn onClick={() => { setIsPlaying(false); setStepIdx((p) => Math.min(steps.length - 1, p + 1)); }} disabled={!canForward}>
              <ChevronRight size={13} strokeWidth={1.75} />
            </TBtn>
            <TBtn onClick={() => { setIsPlaying(false); setStepIdx(steps.length - 1); }} disabled={!canForward}>
              <SkipForward size={13} strokeWidth={1.75} />
            </TBtn>
            <TBtn onClick={() => { setIsPlaying(false); setStepIdx(0); }}>
              <RotateCcw size={12} strokeWidth={1.75} /> Reset
            </TBtn>
          </div>

          {/* Progress scrubber */}
          <input
            type="range"
            min={0}
            max={Math.max(0, steps.length - 1)}
            value={stepIdx}
            onChange={(e) => { setIsPlaying(false); setStepIdx(Number(e.target.value)); }}
            style={{ width: 120, accentColor: "var(--color-accent)", cursor: "pointer" }}
          />

          {/* Speed */}
          <div className="flex items-center gap-2" style={{ borderLeft: "1px solid var(--color-border)", paddingLeft: 12 }}>
            <span className="text-xs" style={{ color: "var(--color-muted)" }}>Slow</span>
            <input
              type="range"
              min={50}
              max={800}
              step={10}
              value={850 - speed}
              onChange={(e) => setSpeed(850 - Number(e.target.value))}
              style={{ width: 80, accentColor: "var(--color-accent)", cursor: "pointer" }}
            />
            <span className="text-xs" style={{ color: "var(--color-muted)" }}>Fast</span>
          </div>

          {/* Step counter */}
          <span className="text-xs font-mono ml-auto" style={{ color: "var(--color-muted)" }}>
            {stepIdx + 1} / {steps.length}
          </span>
        </div>

        {/* Main area */}
        <div className="flex flex-1 min-h-0 gap-0 overflow-hidden">
          {/* Left: table + input editor */}
          <div
            className="flex flex-col flex-1 min-w-0 overflow-auto p-5 gap-5"
            style={{ borderRight: "1px solid var(--color-border)" }}
          >
            {/* DP Table */}
            <div>
              <div className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--color-muted)" }}>
                DP Table
              </div>
              <div style={{ overflowX: "auto" }}>
                <DPTable
                  step={step}
                  rowHeaders={rowHeaders}
                  colHeaders={colHeaders}
                  backtrackSet={backtrackSet}
                  algorithm={algorithm}
                />
              </div>
            </div>

            {/* Backtrack note */}
            {step.isBacktrack && (
              <div
                className="text-xs px-3 py-2 rounded-lg"
                style={{
                  background: "rgba(34,197,94,0.1)",
                  border: "1px solid rgba(34,197,94,0.4)",
                  color: "var(--color-text)",
                }}
              >
                Backtracking phase — tracing the optimal path through the filled table.
              </div>
            )}

            {/* Completion banner */}
            {isComplete && (
              <div
                className="text-xs px-3 py-2 rounded-lg"
                style={{
                  background: "var(--color-accent-muted)",
                  border: "1px solid var(--color-accent)",
                  color: "var(--color-text)",
                }}
              >
                Table fully computed. {step.isBacktrack ? "Optimal path highlighted in green." : "Scroll down to see backtracking."}
              </div>
            )}

            {/* Input Editor */}
            <div>
              <div className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--color-muted)" }}>
                Inputs
              </div>
              <InputEditor
                input={input}
                setInput={setInput}
                onApply={(inp) => { regenerate(inp); }}
              />
            </div>
          </div>

          {/* Right: description panel */}
          <div
            className="flex flex-col gap-4 p-5 shrink-0"
            style={{ width: 280 }}
          >
            {/* Phase indicator */}
            <div>
              <div className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--color-muted)" }}>
                Phase
              </div>
              <div
                className="text-xs px-3 py-1.5 rounded-lg inline-block font-mono"
                style={{
                  background: step.isBacktrack ? "rgba(34,197,94,0.15)" : "var(--color-accent-muted)",
                  color: step.isBacktrack ? "#22c55e" : "var(--color-accent)",
                  border: `1px solid ${step.isBacktrack ? "rgba(34,197,94,0.4)" : "var(--color-accent)"}`,
                }}
              >
                {step.isBacktrack ? "Backtracking" : "Fill Table"}
              </div>
            </div>

            {/* Current cell */}
            {(step.activeI > 0 || step.activeJ > 0) && (
              <div>
                <div className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--color-muted)" }}>
                  Current Cell
                </div>
                <div className="font-mono text-sm" style={{ color: "var(--color-text)" }}>
                  dp[{step.activeI}][{step.activeJ}]
                  {step.table[step.activeI] !== undefined && (
                    <span style={{ color: "var(--color-accent)", marginLeft: 6 }}>
                      = {step.table[step.activeI][step.activeJ] === -1
                        ? "∞"
                        : step.table[step.activeI][step.activeJ]}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Choice badge */}
            {step.choice && (
              <div>
                <div className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--color-muted)" }}>
                  Decision
                </div>
                <ChoiceBadge choice={step.choice} />
              </div>
            )}

            {/* Description */}
            <div className="flex-1">
              <div className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--color-muted)" }}>
                Description
              </div>
              <div
                className="text-xs leading-relaxed rounded-lg px-3 py-3"
                style={{
                  background: "var(--color-surface-2)",
                  border: "1px solid var(--color-border)",
                  color: "var(--color-text)",
                  fontFamily: "var(--font-mono)",
                }}
              >
                {step.description}
              </div>
            </div>

            {/* Legend */}
            <div>
              <div className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--color-muted)" }}>
                Legend
              </div>
              <div className="flex flex-col gap-1.5">
                <LegendItem color="var(--color-surface-2)" border="var(--color-border)" label="Default" />
                <LegendItem color="var(--color-accent)" label="Active cell" textLight />
                <LegendItem color="#22c55e" label="Backtrack path" textLight />
                <LegendItem color="var(--color-surface-3)" label="Header" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── DP Table Renderer ─────────────────────────────────────────────────────────

function DPTable({
  step,
  rowHeaders,
  colHeaders,
  backtrackSet,
  algorithm,
}: {
  step: DPStep;
  rowHeaders: string[];
  colHeaders: string[];
  backtrackSet: Set<string>;
  algorithm: DPAlgorithm;
}) {
  const table = step.table;
  const numRows = table.length;
  const numCols = table[0]?.length ?? 0;

  // Cell sizing — scale down for larger tables
  const maxDim = Math.max(numRows + 1, numCols + 1);
  const cellSize = maxDim <= 10 ? 40 : maxDim <= 16 ? 34 : 28;
  const fontSize = maxDim <= 10 ? 13 : maxDim <= 16 ? 11 : 10;

  const highlightSet = new Set(step.highlight.map(([r, c]) => `${r},${c}`));

  function cellBg(r: number, c: number): string {
    const key = `${r},${c}`;
    if (highlightSet.has(key)) return "var(--color-accent)";
    if (backtrackSet.has(key)) return "#22c55e";
    return "var(--color-surface-2)";
  }

  function cellColor(r: number, c: number): string {
    const key = `${r},${c}`;
    if (highlightSet.has(key) || backtrackSet.has(key)) return "#fff";
    return "var(--color-text)";
  }

  function displayVal(v: number): string {
    if (v === -1) return "∞";
    return String(v);
  }

  // For coin change, the table is 1D wrapped in 2D
  const isCoinChange = algorithm === "coin-change";

  return (
    <div style={{ display: "inline-block", userSelect: "none" }}>
      {/* Col headers */}
      <div style={{ display: "flex" }}>
        {/* Corner cell */}
        <div style={{ width: cellSize, height: cellSize, flexShrink: 0 }} />
        {colHeaders.map((h, ci) => (
          <div
            key={ci}
            style={{
              width: cellSize,
              height: cellSize,
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: fontSize - 1,
              fontFamily: "var(--font-mono)",
              color: "var(--color-muted)",
              background: "var(--color-surface-3)",
              border: "1px solid var(--color-border)",
              borderBottom: "none",
              fontWeight: 600,
            }}
          >
            {h}
          </div>
        ))}
      </div>

      {/* Rows */}
      {table.map((row, ri) => (
        <div key={ri} style={{ display: "flex" }}>
          {/* Row header */}
          <div
            style={{
              width: cellSize,
              height: cellSize,
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: fontSize - 1,
              fontFamily: "var(--font-mono)",
              color: "var(--color-muted)",
              background: "var(--color-surface-3)",
              border: "1px solid var(--color-border)",
              borderRight: "none",
              fontWeight: 600,
            }}
          >
            {rowHeaders[ri] ?? (isCoinChange ? "min" : ri)}
          </div>

          {/* Data cells */}
          {row.map((val, ci) => (
            <div
              key={ci}
              title={`dp[${ri}][${ci}] = ${displayVal(val)}`}
              style={{
                width: cellSize,
                height: cellSize,
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize,
                fontFamily: "var(--font-mono)",
                fontWeight: highlightSet.has(`${ri},${ci}`) || backtrackSet.has(`${ri},${ci}`) ? 700 : 400,
                background: cellBg(ri, ci),
                color: cellColor(ri, ci),
                border: "1px solid var(--color-border)",
                transition: "background 0.15s ease, color 0.15s ease",
                boxShadow: highlightSet.has(`${ri},${ci}`) ? "0 0 0 2px var(--color-accent)" : "none",
              }}
            >
              {displayVal(val)}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ── Header helpers ────────────────────────────────────────────────────────────

function getRowHeaders(algorithm: DPAlgorithm, input: AlgoInput): string[] {
  switch (algorithm) {
    case "lcs":
    case "edit-distance": {
      const s1 = (input.data as LCSInput).s1;
      return ["", ...s1.split("")];
    }
    case "knapsack": {
      const data = input.data as KnapsackInput;
      return ["0", ...data.weights.map((_, i) => `i${i + 1}`)];
    }
    case "coin-change":
      return ["coins"];
  }
}

function getColHeaders(algorithm: DPAlgorithm, input: AlgoInput): string[] {
  switch (algorithm) {
    case "lcs":
    case "edit-distance": {
      const s2 = (input.data as LCSInput).s2;
      return ["", ...s2.split("")];
    }
    case "knapsack": {
      const { capacity } = input.data as KnapsackInput;
      return Array.from({ length: capacity + 1 }, (_, i) => String(i));
    }
    case "coin-change": {
      const { amount } = input.data as CoinChangeInput;
      return Array.from({ length: amount + 1 }, (_, i) => String(i));
    }
  }
}

// ── Input Editor ──────────────────────────────────────────────────────────────

function InputEditor({
  input,
  setInput,
  onApply,
}: {
  input: AlgoInput;
  setInput: (inp: AlgoInput) => void;
  onApply: (inp: AlgoInput) => void;
}) {
  const inputStyle: React.CSSProperties = {
    background: "var(--color-surface-2)",
    border: "1px solid var(--color-border)",
    color: "var(--color-text)",
    borderRadius: 6,
    padding: "4px 8px",
    fontSize: 12,
    fontFamily: "var(--font-mono)",
    outline: "none",
  };

  if (input.algo === "lcs" || input.algo === "edit-distance") {
    const data = input.data as LCSInput;
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <label className="text-xs w-16" style={{ color: "var(--color-muted)" }}>String 1</label>
          <input
            type="text"
            value={data.s1}
            maxLength={12}
            onChange={(e) => setInput({ ...input, data: { ...data, s1: e.target.value.toUpperCase() } } as AlgoInput)}
            style={{ ...inputStyle, width: 120 }}
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs w-16" style={{ color: "var(--color-muted)" }}>String 2</label>
          <input
            type="text"
            value={data.s2}
            maxLength={12}
            onChange={(e) => setInput({ ...input, data: { ...data, s2: e.target.value.toUpperCase() } } as AlgoInput)}
            style={{ ...inputStyle, width: 120 }}
          />
        </div>
        <ApplyBtn onClick={() => onApply(input)} />
      </div>
    );
  }

  if (input.algo === "knapsack") {
    const data = input.data as KnapsackInput;
    const updateItem = (idx: number, field: "weights" | "values", val: number) => {
      const arr = [...data[field]];
      arr[idx] = val;
      setInput({ ...input, data: { ...data, [field]: arr } } as AlgoInput);
    };
    const addItem = () => {
      if (data.weights.length >= 6) return;
      setInput({
        ...input,
        data: { ...data, weights: [...data.weights, 1], values: [...data.values, 1] },
      } as AlgoInput);
    };
    const removeItem = (idx: number) => {
      const ws = data.weights.filter((_, i) => i !== idx);
      const vs = data.values.filter((_, i) => i !== idx);
      setInput({ ...input, data: { ...data, weights: ws, values: vs } } as AlgoInput);
    };
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-4 mb-1">
          <span className="text-xs w-8" style={{ color: "var(--color-muted)" }}>#</span>
          <span className="text-xs w-16" style={{ color: "var(--color-muted)" }}>Weight</span>
          <span className="text-xs w-16" style={{ color: "var(--color-muted)" }}>Value</span>
        </div>
        {data.weights.map((w, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="text-xs w-8 font-mono" style={{ color: "var(--color-muted)" }}>i{i + 1}</span>
            <input
              type="number"
              min={1}
              max={20}
              value={w}
              onChange={(e) => updateItem(i, "weights", Number(e.target.value))}
              style={{ ...inputStyle, width: 60 }}
            />
            <input
              type="number"
              min={1}
              max={50}
              value={data.values[i]}
              onChange={(e) => updateItem(i, "values", Number(e.target.value))}
              style={{ ...inputStyle, width: 60 }}
            />
            <button
              onClick={() => removeItem(i)}
              style={{
                background: "none",
                border: "none",
                color: "var(--color-muted)",
                cursor: "pointer",
                fontSize: 14,
                padding: "0 4px",
              }}
            >
              ×
            </button>
          </div>
        ))}
        {data.weights.length < 6 && (
          <button
            onClick={addItem}
            className="text-xs"
            style={{
              background: "var(--color-surface-3)",
              border: "1px solid var(--color-border)",
              borderRadius: 6,
              padding: "3px 10px",
              color: "var(--color-muted)",
              cursor: "pointer",
              width: "fit-content",
            }}
          >
            + Add item
          </button>
        )}
        <div className="flex items-center gap-2 mt-1">
          <label className="text-xs w-20" style={{ color: "var(--color-muted)" }}>Capacity</label>
          <input
            type="number"
            min={1}
            max={30}
            value={data.capacity}
            onChange={(e) => setInput({ ...input, data: { ...data, capacity: Number(e.target.value) } } as AlgoInput)}
            style={{ ...inputStyle, width: 60 }}
          />
        </div>
        <ApplyBtn onClick={() => onApply(input)} />
      </div>
    );
  }

  if (input.algo === "coin-change") {
    const data = input.data as CoinChangeInput;
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <label className="text-xs w-16" style={{ color: "var(--color-muted)" }}>Coins</label>
          <input
            type="text"
            value={data.coins.join(", ")}
            onChange={(e) => {
              const nums = e.target.value.split(/[\s,]+/).map(Number).filter((n) => !isNaN(n) && n > 0);
              setInput({ ...input, data: { ...data, coins: nums.slice(0, 10) } } as AlgoInput);
            }}
            style={{ ...inputStyle, width: 160 }}
            placeholder="1, 5, 10, 25"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs w-16" style={{ color: "var(--color-muted)" }}>Amount</label>
          <input
            type="number"
            min={1}
            max={100}
            value={data.amount}
            onChange={(e) => setInput({ ...input, data: { ...data, amount: Number(e.target.value) } } as AlgoInput)}
            style={{ ...inputStyle, width: 80 }}
          />
        </div>
        <ApplyBtn onClick={() => onApply(input)} />
      </div>
    );
  }

  return null;
}

// ── Small sub-components ──────────────────────────────────────────────────────

function TBtn({
  children,
  onClick,
  disabled,
  primary,
  style,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  primary?: boolean;
  style?: React.CSSProperties;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      style={{
        background: primary ? "var(--color-accent)" : "var(--color-surface-3)",
        color: primary ? "#fff" : "var(--color-text)",
        border: "1px solid " + (primary ? "var(--color-accent)" : "var(--color-border)"),
        cursor: disabled ? "not-allowed" : "pointer",
        ...style,
      }}
    >
      {children}
    </button>
  );
}

function ApplyBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="text-xs px-3 py-1.5 rounded-lg font-medium mt-1 self-start"
      style={{
        background: "var(--color-accent)",
        color: "#fff",
        border: "none",
        cursor: "pointer",
      }}
    >
      Apply
    </button>
  );
}

function ComplexityBadge({ label, accent }: { label: string; accent?: boolean }) {
  return (
    <span
      className="text-xs font-mono px-2 py-0.5 rounded-full"
      style={{
        background: accent ? "rgba(34,197,94,0.12)" : "rgba(124,106,247,0.15)",
        color: accent ? "#22c55e" : "var(--color-accent)",
      }}
    >
      {label}
    </span>
  );
}

function ChoiceBadge({ choice }: { choice: NonNullable<DPStep["choice"]> }) {
  const colors: Record<string, { bg: string; fg: string }> = {
    match: { bg: "rgba(34,197,94,0.15)", fg: "#22c55e" },
    insert: { bg: "rgba(245,158,11,0.15)", fg: "#d97706" },
    delete: { bg: "rgba(239,68,68,0.15)", fg: "#ef4444" },
    replace: { bg: "rgba(139,92,246,0.15)", fg: "#8b5cf6" },
    take: { bg: "rgba(34,197,94,0.15)", fg: "#22c55e" },
    skip: { bg: "rgba(156,163,175,0.15)", fg: "#9ca3af" },
    coin: { bg: "rgba(245,158,11,0.15)", fg: "#d97706" },
  };
  const { bg, fg } = colors[choice] ?? { bg: "var(--color-surface-3)", fg: "var(--color-text)" };
  return (
    <span
      className="text-xs font-mono px-2 py-1 rounded-lg uppercase tracking-wider font-bold"
      style={{ background: bg, color: fg }}
    >
      {choice}
    </span>
  );
}

function LegendItem({
  color,
  border,
  label,
  textLight,
}: {
  color: string;
  border?: string;
  label: string;
  textLight?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <div
        style={{
          width: 16,
          height: 16,
          borderRadius: 3,
          background: color,
          border: border ? `1px solid ${border}` : "none",
          flexShrink: 0,
        }}
      />
      <span className="text-xs" style={{ color: "var(--color-muted)" }}>
        {label}
      </span>
    </div>
  );
}
