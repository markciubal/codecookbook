"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  UploadCloud, FileText, RotateCcw, Play, Pause,
  Download, ArrowLeft, Volume2, VolumeX, ChevronDown,
} from "lucide-react";
import PlaybackControls from "./PlaybackControls";
import { getSteps, BAR_COLORS, ALGORITHM_META } from "@/lib/algorithms";
import type { SortAlgorithm, SortStep } from "@/lib/types";
import { SORTING_ALGORITHMS } from "@/lib/catalog";

// ── Constants ────────────────────────────────────────────────────────────────

const MAX_ELEMENTS = 512;

// ── Types ────────────────────────────────────────────────────────────────────

type Phase = "input" | "running";

interface ParseResult {
  values: number[];          // original parsed floats
  labels: string[];          // string label for each value (original text)
  truncated: boolean;
  totalFound: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function parseNumbers(text: string): ParseResult {
  // Extract all tokens that look like numbers (int or float, optional sign)
  const tokens = text.match(/-?\d+(\.\d+)?/g) ?? [];
  const totalFound = tokens.length;
  const slice = tokens.slice(0, MAX_ELEMENTS);
  return {
    values: slice.map(Number),
    labels: slice,
    truncated: totalFound > MAX_ELEMENTS,
    totalFound,
  };
}

/** Shift + scale values to positive integers in [1, 1000] for bar heights. */
function normalize(values: number[]): number[] {
  if (values.length === 0) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  return values.map((v) => Math.round(((v - min) / range) * 999) + 1);
}

/** Given the final SortStep, map normalized-index order back to original labels. */
function buildSortedLabels(
  finalStep: SortStep,
  labels: string[],
  normalized: number[],
): string[] {
  // We need to map each position in the sorted array back to the original label.
  // The finalStep.array contains normalized values in sorted order.
  // Build a mapping: original index → label by pairing sorted normalized values
  // with the original (normalized, label) pairs, stable-matched by value then order.
  const indexed = normalized.map((v, i) => ({ v, label: labels[i], used: false }));
  return finalStep.array.map((sortedVal) => {
    const match = indexed.find((x) => !x.used && x.v === sortedVal);
    if (match) { match.used = true; return match.label; }
    return String(sortedVal);
  });
}

// ── Main component ────────────────────────────────────────────────────────────

export default function CustomSortVisualizer() {
  const [phase, setPhase]           = useState<Phase>("input");
  const [dragOver, setDragOver]     = useState(false);
  const [inputText, setInputText]   = useState("");
  const [parsed, setParsed]         = useState<ParseResult | null>(null);
  const [algorithm, setAlgorithm]   = useState<SortAlgorithm>("logos");
  const [normalized, setNormalized] = useState<number[]>([]);
  const [steps, setSteps]           = useState<SortStep[]>([]);
  const [stepIdx, setStepIdx]       = useState(0);
  const [isPlaying, setIsPlaying]   = useState(false);
  const [speed, setSpeed]           = useState(220);
  const [isMuted, setIsMuted]       = useState(true);
  const [parseError, setParseError] = useState("");

  const timerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Parse on text change ──────────────────────────────────────────────────
  useEffect(() => {
    if (!inputText.trim()) { setParsed(null); setParseError(""); return; }
    const result = parseNumbers(inputText);
    if (result.values.length === 0) {
      setParsed(null);
      setParseError("No numbers found. Paste comma-separated values or upload a CSV.");
    } else {
      setParsed(result);
      setParseError("");
    }
  }, [inputText]);

  // ── File handling ─────────────────────────────────────────────────────────
  const loadFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => setInputText(e.target?.result as string ?? "");
    reader.readAsText(file);
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) loadFile(file);
  }, [loadFile]);

  const onFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) loadFile(file);
  }, [loadFile]);

  // ── Start sort ────────────────────────────────────────────────────────────
  const startSort = useCallback(() => {
    if (!parsed || parsed.values.length < 2) return;
    const norm = normalize(parsed.values);
    const s = getSteps(algorithm, norm);
    setNormalized(norm);
    setSteps(s);
    setStepIdx(0);
    setIsPlaying(false);
    setPhase("running");
  }, [parsed, algorithm]);

  // ── Playback loop ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isPlaying) return;
    timerRef.current = setTimeout(() => {
      setStepIdx((prev) => {
        if (prev >= steps.length - 1) { setIsPlaying(false); return prev; }
        return prev + 1;
      });
    }, speed);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [isPlaying, stepIdx, steps.length, speed]);

  // ── Sound ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (isMuted || !steps[stepIdx]) return;
    if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
    const ctx = audioCtxRef.current;
    const s = steps[stepIdx];
    const peak = Math.max(...s.array, 1);
    const active = s.array.filter((_, i) =>
      ["comparing","swapping","minimum","pivot","current"].includes(s.states[i])
    );
    if (!active.length) return;
    const freq = 180 + (active[0] / peak) * 880;
    const isSwap = s.states.some((st) => st === "swapping");
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = isSwap ? "sawtooth" : "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.08);
  }, [stepIdx, isMuted, steps]);

  // ── Reset to input ────────────────────────────────────────────────────────
  const backToInput = () => { setPhase("input"); setIsPlaying(false); };

  // ── Download sorted CSV ───────────────────────────────────────────────────
  const downloadSorted = () => {
    if (!steps.length || !parsed) return;
    const finalStep = steps[steps.length - 1];
    const sortedLabels = buildSortedLabels(finalStep, parsed.labels, normalized);
    const csv = sortedLabels.join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "sorted.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER: Input phase
  // ─────────────────────────────────────────────────────────────────────────
  if (phase === "input") {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div
          className="flex flex-col gap-1 px-5 pt-6 pb-4"
          style={{ borderBottom: "1px solid var(--color-border)" }}
        >
          <div className="flex items-center gap-2">
            <UploadCloud size={20} style={{ color: "var(--color-accent)", flexShrink: 0 }} strokeWidth={1.75} />
            <h1 className="text-2xl font-bold">Sort Your Data</h1>
          </div>
          <p className="text-sm max-w-xl" style={{ color: "var(--color-muted)" }}>
            Upload a CSV or paste numbers below. Pick an algorithm and watch it sort live — then download the result.
          </p>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-6">
          <div className="max-w-2xl flex flex-col gap-6">

            {/* Drop zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
              className="rounded-xl flex flex-col items-center justify-center gap-3 py-10 cursor-pointer transition-colors"
              style={{
                border: `2px dashed ${dragOver ? "var(--color-accent)" : "var(--color-border)"}`,
                background: dragOver ? "var(--color-accent-muted)" : "var(--color-surface-2)",
              }}
            >
              <FileText size={32} style={{ color: dragOver ? "var(--color-accent)" : "var(--color-muted)" }} strokeWidth={1.25} />
              <div className="text-sm text-center" style={{ color: "var(--color-muted)" }}>
                <span style={{ color: "var(--color-accent)", fontWeight: 600 }}>Click to upload</span> or drag & drop a CSV
              </div>
              <div className="text-xs" style={{ color: "var(--color-muted)" }}>
                Any CSV or plain text with numbers
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.txt,text/csv,text/plain"
                className="hidden"
                onChange={onFileChange}
              />
            </div>

            {/* Divider */}
            <div className="flex items-center gap-3">
              <div style={{ flex: 1, height: 1, background: "var(--color-border)" }} />
              <span className="text-xs font-mono" style={{ color: "var(--color-muted)" }}>or paste directly</span>
              <div style={{ flex: 1, height: 1, background: "var(--color-border)" }} />
            </div>

            {/* Text area */}
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="e.g.  42, 7, 100, 3.14, 6, -6, 88..."
              rows={6}
              className="w-full rounded-xl px-4 py-3 text-sm font-mono resize-none"
              style={{
                background: "var(--color-surface-2)",
                border: "1px solid var(--color-border)",
                color: "var(--color-text)",
                outline: "none",
              }}
              spellCheck={false}
            />

            {/* Parse feedback */}
            {parseError && (
              <p className="text-sm" style={{ color: "var(--color-state-swap)" }}>{parseError}</p>
            )}
            {parsed && (
              <div
                className="rounded-lg px-4 py-3 text-sm flex flex-wrap gap-x-6 gap-y-1"
                style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)" }}
              >
                <span style={{ color: "var(--color-muted)" }}>
                  Detected <span style={{ color: "var(--color-accent)", fontWeight: 600 }}>{parsed.totalFound}</span> number{parsed.totalFound !== 1 ? "s" : ""}
                  {parsed.truncated && (
                    <span style={{ color: "var(--color-state-compare)" }}> — capped at {MAX_ELEMENTS} for visualization</span>
                  )}
                </span>
                <span className="font-mono text-xs" style={{ color: "var(--color-muted)" }}>
                  Preview: {parsed.labels.slice(0, 8).join(", ")}{parsed.values.length > 8 ? " …" : ""}
                </span>
              </div>
            )}

            {/* Algorithm selector */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium" style={{ color: "var(--color-muted)" }}>Algorithm</label>
              <div className="relative">
                <select
                  value={algorithm}
                  onChange={(e) => setAlgorithm(e.target.value as SortAlgorithm)}
                  className="w-full rounded-xl px-4 py-2.5 text-sm font-mono appearance-none pr-10"
                  style={{
                    background: "var(--color-surface-2)",
                    border: "1px solid var(--color-border)",
                    color: "var(--color-text)",
                    outline: "none",
                    cursor: "pointer",
                  }}
                >
                  {SORTING_ALGORITHMS.map((a) => (
                    <option key={a.path} value={a.path.replace("/sorting/", "")}>
                      {a.name} — {a.time}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={14}
                  strokeWidth={1.75}
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2"
                  style={{ color: "var(--color-muted)" }}
                />
              </div>
            </div>

            {/* Sort button */}
            <button
              onClick={startSort}
              disabled={!parsed || parsed.values.length < 2}
              className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                background: "var(--color-accent)",
                color: "#fff",
                border: "1px solid var(--color-accent)",
                cursor: (!parsed || parsed.values.length < 2) ? "not-allowed" : "pointer",
              }}
            >
              <Play size={14} strokeWidth={2} />
              Sort {parsed ? `${parsed.values.length} values` : ""}
            </button>

          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER: Running / Done phase
  // ─────────────────────────────────────────────────────────────────────────
  const step = steps[stepIdx];
  if (!step) return null;

  const meta = ALGORITHM_META[algorithm];
  const peak = Math.max(...step.array, 1);
  const sortedCount = step.states.filter((s) => s === "sorted").length;
  const sortedPct = Math.round((sortedCount / step.array.length) * 100);
  const isDone = stepIdx >= steps.length - 1;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div
        className="flex flex-col gap-1 px-5 pt-6 pb-4"
        style={{ borderBottom: "1px solid var(--color-border)" }}
      >
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={backToInput}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-mono mr-1 transition-colors"
            style={{
              background: "var(--color-surface-3)",
              border: "1px solid var(--color-border)",
              color: "var(--color-muted)",
              cursor: "pointer",
            }}
          >
            <ArrowLeft size={12} strokeWidth={1.75} /> New data
          </button>
          <h1 className="text-2xl font-bold">Sort Your Data</h1>
          <span
            className="text-xs font-mono px-2 py-0.5 rounded-full"
            style={{ background: "rgba(124,106,247,0.15)", color: "var(--color-accent)" }}
          >
            {meta.name}
          </span>
          <span
            className="text-xs font-mono px-2 py-0.5 rounded-full"
            style={{ background: "rgba(124,106,247,0.15)", color: "var(--color-accent)" }}
          >
            {meta.timeComplexity}
          </span>
          <div className="ml-auto flex gap-2">
            <button
              onClick={() => setIsMuted((p) => !p)}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-mono transition-colors"
              style={{
                background: "var(--color-surface-3)",
                border: "1px solid var(--color-border)",
                color: "var(--color-muted)",
                cursor: "pointer",
              }}
            >
              {isMuted ? <VolumeX size={13} strokeWidth={1.75} /> : <Volume2 size={13} strokeWidth={1.75} />}
              {isMuted ? "Sound off" : "Sound on"}
            </button>
            {isDone && (
              <button
                onClick={downloadSorted}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-mono transition-colors"
                style={{
                  background: "var(--color-state-sorted)",
                  border: "1px solid var(--color-state-sorted)",
                  color: "#fff",
                  cursor: "pointer",
                }}
              >
                <Download size={12} strokeWidth={1.75} /> Download sorted.csv
              </button>
            )}
          </div>
        </div>
        <p className="text-sm max-w-xl" style={{ color: "var(--color-muted)" }}>
          {parsed?.values.length} values{parsed?.truncated ? ` (first ${MAX_ELEMENTS} of ${parsed.totalFound})` : ""} · sorted with {meta.name}
        </p>
      </div>

      {/* Body */}
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
        <div className="flex-1 flex flex-col px-5 pt-5 pb-4 gap-4 overflow-hidden min-h-0">

          {/* Stats row */}
          <div className="flex flex-wrap gap-6">
            <StatBox label="Step"        value={`${stepIdx + 1} / ${steps.length}`} />
            <StatBox label="Comparisons" value={step.comparisons} color="var(--color-state-compare)" />
            <StatBox label="Swaps"       value={step.swaps}       color="var(--color-state-swap)" />
            <StatBox label="Sorted"      value={`${sortedPct}%`}  color="var(--color-state-sorted)" />
            {isDone && (
              <StatBox label="Status" value="Done ✓" color="var(--color-state-sorted)" />
            )}
          </div>

          {/* Two-column layout */}
          <div className="flex flex-1 gap-4 min-h-0">
            {/* Bar chart */}
            <div
              className="rounded-xl flex-1 min-h-0 overflow-hidden"
              style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)" }}
            >
              <div className="w-full h-full flex items-end gap-px p-3" style={{ boxSizing: "border-box" }}>
                {step.array.map((val, i) => (
                  <div
                    key={i}
                    title={parsed?.labels[i] ?? String(val)}
                    style={{
                      flex: 1,
                      height: `${(val / peak) * 100}%`,
                      minWidth: 2,
                      maxWidth: 40,
                      background: BAR_COLORS[step.states[i]],
                      borderRadius: "2px 2px 0 0",
                      transition: "height 0.08s ease, background-color 0.12s ease",
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Right column */}
            <div className="flex flex-col gap-4 w-80 shrink-0">
              {/* Legend */}
              <div className="flex flex-wrap gap-4">
                {(Object.entries(BAR_COLORS) as [string, string][]).map(([state, color]) => (
                  <div key={state} className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-sm" style={{ background: color }} />
                    <span className="text-xs capitalize" style={{ color: "var(--color-muted)" }}>
                      {state === "minimum" ? "curr. min" : state}
                    </span>
                  </div>
                ))}
              </div>

              <PlaybackControls
                stepCount={steps.length}
                stepIdx={stepIdx}
                setStepIdx={setStepIdx}
                isPlaying={isPlaying}
                setIsPlaying={setIsPlaying}
                speed={speed}
                setSpeed={setSpeed}
                onReset={() => {
                  setStepIdx(0);
                  setIsPlaying(false);
                }}
                resetLabel="Restart"
              />

              {/* Step description */}
              <div
                className="rounded-lg px-4 py-3 text-sm min-h-[2.75rem] flex items-center mt-auto"
                style={{ background: "var(--color-surface-2)", color: "var(--color-muted)" }}
              >
                {step.description}
              </div>

              {/* Done panel */}
              {isDone && (
                <div
                  className="rounded-xl px-4 py-4 flex flex-col gap-3"
                  style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)" }}
                >
                  <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--color-state-sorted)" }}>
                    Sort complete
                  </p>
                  <div className="flex flex-col gap-1 text-xs font-mono" style={{ color: "var(--color-muted)" }}>
                    <span>{step.comparisons.toLocaleString()} comparisons</span>
                    <span>{step.swaps.toLocaleString()} swaps</span>
                    <span>{steps.length.toLocaleString()} total steps</span>
                  </div>
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={downloadSorted}
                      className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                      style={{
                        background: "var(--color-state-sorted)",
                        color: "#fff",
                        border: "none",
                        cursor: "pointer",
                      }}
                    >
                      <Download size={12} strokeWidth={1.75} /> Download sorted.csv
                    </button>
                    <button
                      onClick={backToInput}
                      className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                      style={{
                        background: "var(--color-surface-3)",
                        color: "var(--color-muted)",
                        border: "1px solid var(--color-border)",
                        cursor: "pointer",
                      }}
                    >
                      <RotateCcw size={12} strokeWidth={1.75} /> Sort new data
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Stat box ─────────────────────────────────────────────────────────────────

function StatBox({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div>
      <div className="text-xs mb-0.5" style={{ color: "var(--color-muted)" }}>{label}</div>
      <div className="text-xl font-mono font-bold" style={{ color: color ?? "var(--color-text)" }}>{value}</div>
    </div>
  );
}
