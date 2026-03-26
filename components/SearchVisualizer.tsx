"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Search, RotateCcw } from "lucide-react";
import PlaybackControls from "./PlaybackControls";
import {
  generateSortedArray,
  getSearchSteps,
  type SearchAlgorithm,
  type SearchStep,
  type PointerKind,
} from "@/lib/search-algorithms";

// ── Algorithm metadata ────────────────────────────────────────────────────────

const META: Record<
  SearchAlgorithm,
  { name: string; time: string; space: string; desc: string }
> = {
  linear: {
    name: "Linear Search",
    time: "O(n)",
    space: "O(1)",
    desc: "Scans every element left to right until the target is found or the array is exhausted. Simple but slow for large arrays.",
  },
  binary: {
    name: "Binary Search",
    time: "O(log n)",
    space: "O(1)",
    desc: "Halves the search space each step by comparing the target with the middle element. Requires a sorted array.",
  },
  jump: {
    name: "Jump Search",
    time: "O(√n)",
    space: "O(1)",
    desc: "Jumps ahead by √n steps to find a block where the target may lie, then does a linear scan backward within that block.",
  },
  interpolation: {
    name: "Interpolation Search",
    time: "O(log log n)",
    space: "O(1)",
    desc: "Estimates the probable position of the target using a linear interpolation formula — best for uniformly distributed data.",
  },
};

// ── Cell color mapping ────────────────────────────────────────────────────────

function getCellStyle(
  index: number,
  step: SearchStep,
  array: number[]
): { bg: string; fg: string; border: string; opacity: number } {
  const pointer = step.pointers.find((p) => p.index === index);

  if (pointer) {
    if (pointer.kind === "found") {
      return {
        bg: "var(--color-state-sorted)",
        fg: "#fff",
        border: "var(--color-state-sorted)",
        opacity: 1,
      };
    }
    if (pointer.kind === "current" || pointer.kind === "jump") {
      return {
        bg: "var(--color-state-compare)",
        fg: "#fff",
        border: "var(--color-state-compare)",
        opacity: 1,
      };
    }
    if (pointer.kind === "mid") {
      return {
        bg: "var(--color-accent)",
        fg: "#fff",
        border: "var(--color-accent)",
        opacity: 1,
      };
    }
    if (pointer.kind === "left" || pointer.kind === "right") {
      return {
        bg: "var(--color-accent-muted)",
        fg: "var(--color-accent)",
        border: "var(--color-accent)",
        opacity: 1,
      };
    }
  }

  const isHighlighted = step.highlightIndices.includes(index);
  if (isHighlighted) {
    return {
      bg: "var(--color-surface-3)",
      fg: "var(--color-text)",
      border: "var(--color-border)",
      opacity: 1,
    };
  }

  // Excluded / outside search range
  return {
    bg: "var(--color-surface-2)",
    fg: "var(--color-muted)",
    border: "var(--color-surface-3)",
    opacity: 0.45,
  };
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  algorithm: SearchAlgorithm;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function SearchVisualizer({ algorithm }: Props) {
  const meta = META[algorithm];

  const [array, setArray] = useState<number[]>(() => generateSortedArray(16));
  const [target, setTarget] = useState<number>(0);
  const [steps, setSteps] = useState<SearchStep[]>([]);
  const [stepIdx, setStepIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(400);
  const [customInput, setCustomInput] = useState("");

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Compute steps whenever array / target / algorithm change ────────────────
  const recompute = useCallback(
    (arr: number[], tgt: number) => {
      setIsPlaying(false);
      setStepIdx(0);
      setSteps(getSearchSteps(algorithm, arr, tgt));
    },
    [algorithm]
  );

  // Initialise on mount / algorithm change
  useEffect(() => {
    const arr = generateSortedArray(16);
    const tgt = arr[Math.floor(Math.random() * arr.length)];
    setArray(arr);
    setTarget(tgt);
    recompute(arr, tgt);
  }, [algorithm]); // intentionally omit recompute from deps — algorithm triggers it

  // ── Playback loop ───────────────────────────────────────────────────────────
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

  // ── Keyboard shortcuts ──────────────────────────────────────────────────────
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
        handleNewArray();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, stepIdx, steps.length]);

  // ── Handlers ────────────────────────────────────────────────────────────────
  function handleNewArray() {
    const arr = generateSortedArray(16);
    const tgt = arr[Math.floor(Math.random() * arr.length)];
    setArray(arr);
    setTarget(tgt);
    setCustomInput("");
    recompute(arr, tgt);
  }

  function handleTargetChange(val: number) {
    setTarget(val);
    recompute(array, val);
  }

  function handleCustomArray() {
    const nums = customInput
      .split(",")
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !isNaN(n) && n >= 1 && n <= 999);
    if (nums.length < 2) return;
    const sorted = Array.from(new Set(nums)).sort((a, b) => a - b);
    const tgt = sorted[Math.floor(Math.random() * sorted.length)];
    setArray(sorted);
    setTarget(tgt);
    recompute(sorted, tgt);
  }

  function handleReset() {
    setIsPlaying(false);
    setStepIdx(0);
    recompute(array, target);
  }

  const step = steps[stepIdx];
  if (!step) return null;

  const isComplete = stepIdx === steps.length - 1 && steps.length > 1;

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── Header ── */}
      <div
        className="flex flex-col gap-1 px-5 pt-6 pb-4"
        style={{ borderBottom: "1px solid var(--color-border)" }}
      >
        <div className="flex flex-wrap items-center gap-2">
          <Search
            size={20}
            style={{ color: "var(--color-accent)", flexShrink: 0 }}
            strokeWidth={1.75}
          />
          <h1 className="text-2xl font-bold">{meta.name}</h1>
          <Badge text={meta.time} accent />
          <Badge text={`Space: ${meta.space}`} />
        </div>
        <p className="text-sm max-w-2xl" style={{ color: "var(--color-muted)" }}>
          {meta.desc}
        </p>
      </div>

      {/* ── Body ── */}
      <div className="flex flex-col flex-1 min-h-0 overflow-y-auto px-5 pt-5 pb-6 gap-5">
        {/* Stats row */}
        <div className="flex flex-wrap gap-6">
          <Stat label="Step" value={`${stepIdx + 1} / ${steps.length}`} />
          <Stat
            label="Comparisons"
            value={step.comparisons}
            color="var(--color-state-compare)"
          />
          <Stat
            label="Result"
            value={
              !isComplete
                ? "—"
                : step.foundAt !== null
                ? `Found at [${step.foundAt}]`
                : "Not found"
            }
            color={
              !isComplete
                ? undefined
                : step.foundAt !== null
                ? "var(--color-state-sorted)"
                : "var(--color-state-swap)"
            }
          />
        </div>

        {/* Array visualisation */}
        <div
          className="rounded-xl p-4 overflow-x-auto"
          style={{
            background: "var(--color-surface-2)",
            border: "1px solid var(--color-border)",
          }}
        >
          <div className="flex items-end gap-2 min-w-max" style={{ paddingTop: 28 }}>
            {array.map((val, i) => {
              const pointer = step.pointers.find((p) => p.index === i);
              const cellStyle = getCellStyle(i, step, array);
              return (
                <div
                  key={i}
                  className="flex flex-col items-center"
                  style={{ position: "relative" }}
                >
                  {/* Pointer label above cell */}
                  {pointer && (
                    <div
                      className="absolute text-xs font-bold font-mono"
                      style={{
                        top: -24,
                        left: "50%",
                        transform: "translateX(-50%)",
                        color:
                          pointer.kind === "found"
                            ? "var(--color-state-sorted)"
                            : pointer.kind === "current" || pointer.kind === "jump"
                            ? "var(--color-state-compare)"
                            : "var(--color-accent)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {pointer.label}
                    </div>
                  )}
                  {/* Cell box */}
                  <div
                    className="flex items-center justify-center font-mono font-bold text-sm rounded-lg transition-all duration-200"
                    style={{
                      width: 52,
                      height: 52,
                      background: cellStyle.bg,
                      color: cellStyle.fg,
                      border: `2px solid ${cellStyle.border}`,
                      opacity: cellStyle.opacity,
                      transition: "background 0.15s ease, border-color 0.15s ease, opacity 0.15s ease",
                    }}
                  >
                    {val}
                  </div>
                  {/* Index below cell */}
                  <div
                    className="text-xs font-mono mt-1"
                    style={{ color: "var(--color-muted)" }}
                  >
                    {i}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Step description panel */}
        <div
          className="rounded-lg px-4 py-3 text-sm min-h-[3rem] flex items-center"
          style={{
            background: isComplete && step.foundAt !== null
              ? "rgba(78,124,82,0.12)"
              : isComplete
              ? "rgba(176,48,32,0.10)"
              : "var(--color-surface-2)",
            border: `1px solid ${
              isComplete && step.foundAt !== null
                ? "var(--color-state-sorted)"
                : isComplete
                ? "var(--color-state-swap)"
                : "var(--color-border)"
            }`,
            color: "var(--color-text)",
          }}
        >
          <span style={{ fontFamily: "monospace", fontSize: 13, lineHeight: 1.6 }}>
            {step.description}
          </span>
        </div>

        {/* Two-column: controls left, inputs right */}
        <div className="flex flex-wrap gap-5">
          {/* Playback controls */}
          <div
            className="flex-1 min-w-[300px] rounded-xl p-4"
            style={{
              background: "var(--color-surface-2)",
              border: "1px solid var(--color-border)",
            }}
          >
            <PlaybackControls
              stepCount={steps.length}
              stepIdx={stepIdx}
              setStepIdx={setStepIdx}
              isPlaying={isPlaying}
              setIsPlaying={setIsPlaying}
              speed={speed}
              setSpeed={setSpeed}
              onReset={handleReset}
            />
          </div>

          {/* Input controls */}
          <div
            className="flex-1 min-w-[280px] rounded-xl p-4 flex flex-col gap-3"
            style={{
              background: "var(--color-surface-2)",
              border: "1px solid var(--color-border)",
            }}
          >
            {/* Target input */}
            <div className="flex items-center gap-2">
              <label
                className="text-xs font-semibold shrink-0"
                style={{ color: "var(--color-muted)", width: 90 }}
              >
                Search target
              </label>
              <input
                type="number"
                value={target}
                min={1}
                max={999}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10);
                  if (!isNaN(v)) handleTargetChange(v);
                }}
                className="flex-1 px-2 py-1 rounded text-sm font-mono"
                style={{
                  background: "var(--color-surface-3)",
                  border: "1px solid var(--color-border)",
                  color: "var(--color-text)",
                  outline: "none",
                }}
              />
            </div>

            {/* New array button */}
            <button
              onClick={handleNewArray}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
              style={{
                background: "var(--color-surface-3)",
                border: "1px solid var(--color-border)",
                color: "var(--color-text)",
                cursor: "pointer",
              }}
            >
              <RotateCcw size={12} strokeWidth={1.75} /> New random array
            </button>

            {/* Custom array */}
            <div className="flex flex-col gap-1">
              <label
                className="text-xs font-semibold"
                style={{ color: "var(--color-muted)" }}
              >
                Custom array (comma-separated)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={customInput}
                  onChange={(e) => setCustomInput(e.target.value)}
                  placeholder="e.g. 3, 7, 12, 18, 25"
                  className="flex-1 px-2 py-1 rounded text-xs font-mono"
                  style={{
                    background: "var(--color-surface-3)",
                    border: "1px solid var(--color-border)",
                    color: "var(--color-text)",
                    outline: "none",
                  }}
                />
                <button
                  onClick={handleCustomArray}
                  className="px-3 py-1 rounded text-xs font-medium shrink-0"
                  style={{
                    background: "var(--color-accent)",
                    color: "#fff",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  Use
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-4">
          <LegendItem color="var(--color-surface-3)" label="Default" />
          <LegendItem color="var(--color-state-compare)" label="Current / Jump" />
          <LegendItem color="var(--color-accent)" label="Mid / Probe" />
          <LegendItem color="var(--color-accent-muted)" label="Boundary (L/R)" border="var(--color-accent)" />
          <LegendItem color="var(--color-state-sorted)" label="Found" />
          <LegendItem color="var(--color-surface-2)" label="Excluded" faded />
        </div>

        {/* Keyboard hint */}
        <p className="text-xs" style={{ color: "var(--color-muted)" }}>
          Keyboard: <kbd>Space</kbd> play/pause &nbsp;·&nbsp;{" "}
          <kbd>←</kbd> <kbd>→</kbd> step &nbsp;·&nbsp; <kbd>R</kbd> reset
        </p>
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function Stat({
  label,
  value,
  color,
}: {
  label: string;
  value: string | number;
  color?: string;
}) {
  return (
    <div>
      <div className="text-xs mb-0.5" style={{ color: "var(--color-muted)" }}>
        {label}
      </div>
      <div
        className="text-xl font-mono font-bold"
        style={{ color: color ?? "var(--color-text)" }}
      >
        {value}
      </div>
    </div>
  );
}

function Badge({
  text,
  accent,
}: {
  text: string;
  accent?: boolean;
}) {
  return (
    <span
      className="text-xs font-mono px-2 py-0.5 rounded-full"
      style={{
        background: accent ? "rgba(124,106,247,0.15)" : "var(--color-surface-3)",
        color: accent ? "var(--color-accent)" : "var(--color-muted)",
        border: `1px solid ${accent ? "var(--color-accent)" : "var(--color-border)"}`,
      }}
    >
      {text}
    </span>
  );
}

function LegendItem({
  color,
  label,
  border,
  faded,
}: {
  color: string;
  label: string;
  border?: string;
  faded?: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <div
        className="w-4 h-4 rounded"
        style={{
          background: color,
          border: `1.5px solid ${border ?? color}`,
          opacity: faded ? 0.45 : 1,
        }}
      />
      <span className="text-xs" style={{ color: "var(--color-muted)" }}>
        {label}
      </span>
    </div>
  );
}
