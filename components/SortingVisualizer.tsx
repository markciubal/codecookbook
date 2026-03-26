"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { RotateCcw, Settings, Volume2, VolumeX, BrainCircuit, BarChart2 } from "lucide-react";
import PlaybackControls from "./PlaybackControls";
import {
  generateArray,
  getSteps,
  BAR_COLORS,
  ALGORITHM_META,
} from "@/lib/algorithms";
import type { SortAlgorithm, SortStep } from "@/lib/types";
import { MNEMONICS } from "@/lib/mnemonics";
import CodePanel from "./CodePanel";
import CodeModal from "./CodeModal";
import PanelModal from "./PanelModal";
import LevelGate from "./LevelGate";
import { useProgress } from "@/hooks/useProgress";
import { ExternalLink } from "lucide-react";
import KeyboardShortcutOverlay, { type ShortcutGroup } from "./KeyboardShortcutOverlay";

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    group: "Playback",
    items: [
      { key: "Space", description: "Play / Pause" },
      { key: "← →", description: "Step backward / forward" },
      { key: "R", description: "Reset & new array" },
    ],
  },
  {
    group: "Navigation",
    items: [
      { key: "?", description: "Toggle this overlay" },
    ],
  },
];

interface Props {
  algorithm: SortAlgorithm;
}


export default function SortingVisualizer({ algorithm }: Props) {
  const meta = ALGORITHM_META[algorithm];
  const { markVisited } = useProgress();

  // Logos Sort needs more elements to show its recursive dual-pivot structure
  const defaultSize = algorithm === "logos" ? 60 : 28;

  // Read size/speed from URL params on first mount (permalink support)
  const [size, setSize] = useState(() => {
    if (typeof window === "undefined") return defaultSize;
    const v = Number(new URLSearchParams(window.location.search).get("size"));
    return v >= 5 && v <= 200 ? v : defaultSize;
  });
  const [maxVal, setMaxVal] = useState(100);
  const [speed, setSpeed] = useState(() => {
    if (typeof window === "undefined") return 220;
    const v = Number(new URLSearchParams(window.location.search).get("speed"));
    return v >= 10 && v <= 2000 ? v : 220;
  });
  const [steps, setSteps] = useState<SortStep[]>([]);
  const [stepIdx, setStepIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [isMnemonicOpen, setIsMnemonicOpen] = useState(false);
  const [isShortcutOpen, setIsShortcutOpen] = useState(false);
  const [customArray, setCustomArray] = useState<number[] | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recCancelRef = useRef(false);

  // ── Canvas recording helpers ──────────────────────────────────────────────

  function drawStepToCanvas(s: typeof steps[0], peakVal: number) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#0f1117";
    ctx.fillRect(0, 0, W, H);
    const n = s.array.length;
    const barW = W / n;
    s.array.forEach((val, i) => {
      const barH = (val / peakVal) * (H - 4);
      ctx.fillStyle = BAR_COLORS[s.states[i]] ?? "#888";
      ctx.fillRect(i * barW, H - barH, Math.max(barW - 1, 1), barH);
    });
  }

  async function startRecording() {
    const canvas = canvasRef.current;
    if (!canvas || steps.length === 0) return;
    if (!window.MediaRecorder) return;

    recCancelRef.current = false;
    setIsRecording(true);
    setIsPlaying(false);

    const stream = canvas.captureStream(30);
    const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
      ? "video/webm;codecs=vp9"
      : "video/webm";
    const recorder = new MediaRecorder(stream, { mimeType });
    recorderRef.current = recorder;
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
    recorder.onstop = () => {
      if (recCancelRef.current) return;
      const blob = new Blob(chunks, { type: "video/webm" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `sort-${algorithm}.webm`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    };

    recorder.start();

    // Replay all steps at ~5 ms each into the canvas
    const peakVal = Math.max(...steps[0].array, 1);
    for (let i = 0; i < steps.length; i++) {
      if (recCancelRef.current) break;
      drawStepToCanvas(steps[i], peakVal);
      await new Promise<void>(res => setTimeout(res, 5));
    }

    recorder.stop();
    setIsRecording(false);
  }

  function cancelRecording() {
    recCancelRef.current = true;
    recorderRef.current?.stop();
    recorderRef.current = null;
    setIsRecording(false);
  }

  // Generate array and compute steps
  const reset = useCallback((overrideArr?: number[]) => {
    setIsPlaying(false);
    const arr = overrideArr ?? customArray ?? generateArray(size, 1, maxVal);
    const s = getSteps(algorithm, arr);
    setSteps(s);
    setStepIdx(0);
  }, [size, maxVal, algorithm, customArray]);

  useEffect(() => {
    reset();
  }, [reset]);

  // Mark this algorithm page as visited
  useEffect(() => {
    markVisited(`/sorting/${algorithm}`);
  }, [algorithm, markVisited]);

  // Sync size+speed into URL so the page is shareable
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams({ size: String(size), speed: String(speed) });
    window.history.replaceState(null, "", "?" + params.toString());
  }, [size, speed]);

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

  // Sound: play a tone for each active bar when step changes
  useEffect(() => {
    if (isMuted || !steps[stepIdx]) return;
    if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
    const ctx = audioCtxRef.current;
    const s = steps[stepIdx];
    const peak = Math.max(...s.array, 1);
    const activeBars = s.array.filter((_, i) =>
      s.states[i] === "comparing" || s.states[i] === "swapping" ||
      s.states[i] === "minimum" || s.states[i] === "pivot" || s.states[i] === "current"
    );
    if (activeBars.length === 0) return;
    const val = activeBars[0];
    const freq = 180 + (val / peak) * 880;
    const isSwap = s.states.some((st) => st === "swapping");
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = isSwap ? "sawtooth" : "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.08);
  }, [stepIdx, isMuted, steps]);

  // Keyboard shortcuts: Space=play/pause, ArrowLeft/Right=step, R=reset
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      if (e.key === " ") {
        e.preventDefault();
        setIsPlaying((p) => {
          if (!p && stepIdx >= steps.length - 1) return p; // already done
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
        reset();
      } else if (e.key === "?") {
        setIsShortcutOpen((p) => !p);
      } else if (e.key === "Escape") {
        setIsShortcutOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isPlaying, stepIdx, steps.length, reset]);

  const step = steps[stepIdx];
  if (!step) return null;

  const peak = Math.max(...step.array, 1);
  const sortedCount = step.states.filter((s) => s === "sorted").length;
  const sortedPct = Math.round((sortedCount / step.array.length) * 100);
  const isComplete = stepIdx === steps.length - 1 && steps.length > 1;


  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── Header ── */}
      <div
        className="flex flex-col gap-1 px-5 pt-6 pb-4"
        style={{ borderBottom: "1px solid var(--color-border)" }}
      >
        <div className="flex flex-wrap items-center gap-2">
          <BarChart2 size={20} style={{ color: "var(--color-accent)", flexShrink: 0 }} strokeWidth={1.75} />
          <h1 className="text-2xl font-bold">{meta.name}</h1>
          <Badge text={meta.timeComplexity} accent />
          <Badge text={meta.stable ? "stable" : "unstable"} color={meta.stable ? "green" : "red"} />
          <div className="ml-auto flex gap-2">
            <button
              onClick={() => setIsMuted((p) => !p)}
              title={isMuted ? "Unmute" : "Mute"}
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
            <button
              onClick={() => setIsShortcutOpen((p) => !p)}
              title="Keyboard Shortcuts (?)"
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-mono transition-colors"
              style={{
                background: isShortcutOpen ? "var(--color-accent)" : "var(--color-surface-3)",
                border: "1px solid var(--color-border)",
                color: isShortcutOpen ? "#fff" : "var(--color-muted)",
                cursor: "pointer",
              }}
            >
              ?
            </button>
            <LevelGate min="intermediate">
              <button
                onClick={() => setIsMnemonicOpen((p) => !p)}
                title="Mnemonic Devices"
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-mono transition-colors"
                style={{
                  background: isMnemonicOpen ? "var(--color-accent)" : "var(--color-surface-3)",
                  border: "1px solid var(--color-border)",
                  color: isMnemonicOpen ? "#fff" : "var(--color-muted)",
                  cursor: "pointer",
                }}
              >
                <BrainCircuit size={13} strokeWidth={1.75} /> Mnemonics
              </button>
              <button
                onClick={() => setIsSettingsOpen((p) => !p)}
                title="Settings"
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-mono transition-colors"
                style={{
                  background: isSettingsOpen ? "var(--color-accent)" : "var(--color-surface-3)",
                  border: "1px solid var(--color-border)",
                  color: isSettingsOpen ? "#fff" : "var(--color-muted)",
                  cursor: "pointer",
                }}
              >
                <Settings size={13} strokeWidth={1.75} /> Settings
              </button>
              <button
                onClick={() => setIsModalOpen(true)}
                title="View Code"
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-mono transition-colors"
                style={{
                  background: isModalOpen ? "var(--color-accent)" : "var(--color-surface-3)",
                  border: "1px solid var(--color-border)",
                  color: isModalOpen ? "#fff" : "var(--color-accent)",
                  cursor: "pointer",
                }}
              >
                {"</>"}
              </button>
            </LevelGate>
            <LevelGate min="advanced">
              <button
                onClick={isRecording ? cancelRecording : startRecording}
                title={isRecording ? "Cancel recording" : "Record animation as WebM video"}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-mono transition-colors"
                style={{
                  background: isRecording ? "var(--color-state-swap)" : "var(--color-surface-3)",
                  border: "1px solid var(--color-border)",
                  color: isRecording ? "#fff" : "var(--color-muted)",
                  cursor: "pointer",
                }}
              >
                {isRecording ? "⏹ Stop" : "⏺ Record"}
              </button>
            </LevelGate>
          </div>
        </div>
        {meta.quote && (
          <div className="flex items-baseline gap-2 mt-0.5">
            <span className="text-sm italic" style={{ color: "var(--color-accent)" }}>
              "{meta.quote.text}"
            </span>
            <span className="text-xs" style={{ color: "var(--color-muted)" }}>
              — {meta.quote.attribution}
            </span>
          </div>
        )}
        <div className="flex items-center gap-3 flex-wrap">
          <p className="text-sm max-w-xl" style={{ color: "var(--color-muted)" }}>
            {meta.description}
          </p>
          {meta.leetcode && (
            <a
              href={meta.leetcode}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-medium shrink-0"
              style={{ color: "var(--color-accent)", textDecoration: "none" }}
            >
              <ExternalLink size={11} strokeWidth={2} />
              Practice on LeetCode
            </a>
          )}
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
        <div className="flex-1 flex flex-col px-5 pt-5 pb-4 gap-4 overflow-hidden min-h-0">
          {/* Stats row */}
          <div className="flex flex-wrap gap-6">
            <Stat label="Step" value={`${stepIdx + 1} / ${steps.length}`} />
            <Stat label="Comparisons" value={step.comparisons} color="var(--color-state-compare)" />
            <Stat label="Swaps" value={step.swaps} color="var(--color-state-swap)" />
            <Stat label="Sorted" value={`${sortedPct}%`} color="var(--color-state-sorted)" />
          </div>

          {/* Completion callout */}
          {isComplete && meta.comparisonNote && (
            <div
              className="text-xs px-3 py-2 rounded-lg"
              style={{
                background: "var(--color-accent-muted)",
                border: "1px solid var(--color-accent)",
                color: "var(--color-text)",
                animation: "fadeIn 0.3s ease",
              }}
            >
              {meta.comparisonNote
                .replace("{comparisons}", String(step.comparisons))
                .replace("{swaps}", String(step.swaps))
                .replace("{n}", String(step.array.length))}
            </div>
          )}

          {/* Two-column layout: bar chart left, controls right */}
          <div className="flex flex-1 gap-4 min-h-0">
            {/* Bar chart */}
            <div
              className="rounded-xl flex-1 min-h-0 overflow-hidden"
              style={{
                background: "var(--color-surface-2)",
                border: "1px solid var(--color-border)",
              }}
            >
              <div
                className="w-full h-full flex items-end gap-px p-3"
                style={{ boxSizing: "border-box" }}
              >
                {step.array.map((val, i) => (
                  <div
                    key={i}
                    title={String(val)}
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

            {/* Right column: legend + controls + step description beneath */}
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
                onReset={reset}
              />

              {/* Step description — slides under the shorter (right) column */}
              <div
                className="rounded-lg px-4 py-3 text-sm min-h-[2.75rem] flex items-center mt-auto"
                style={{ background: "var(--color-surface-2)", color: "var(--color-muted)" }}
              >
                {step.description}
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Hidden canvas used for WebM recording */}
      <canvas
        ref={canvasRef}
        width={600}
        height={300}
        style={{ display: "none" }}
        aria-hidden="true"
      />

      <PanelModal isOpen={isMnemonicOpen} onClose={() => setIsMnemonicOpen(false)} title="Mnemonic Devices">
        <MnemonicPanel algorithm={algorithm} />
      </PanelModal>

      <PanelModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} title="Settings">
        <SettingsPanel
          size={size} setSize={setSize}
          maxVal={maxVal} setMaxVal={setMaxVal}
          onNewArray={reset}
          customArray={customArray}
          setCustomArray={setCustomArray}
          pseudocode={meta.pseudocode}
          isPlaying={isPlaying}
          algorithmId={algorithm}
        />
      </PanelModal>

      <CodeModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        algorithmId={algorithm}
        pseudocode={meta.pseudocode}
        activePseudocodeLine={step.pseudocodeLine}
      />

      <KeyboardShortcutOverlay
        shortcuts={SHORTCUT_GROUPS}
        isOpen={isShortcutOpen}
        onClose={() => setIsShortcutOpen(false)}
      />
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

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
      <div className="text-xs mb-0.5" style={{ color: "var(--color-muted)" }}>{label}</div>
      <div className="text-xl font-mono font-bold" style={{ color: color ?? "var(--color-text)" }}>
        {value}
      </div>
    </div>
  );
}

function Badge({
  text,
  accent,
  color,
}: {
  text: string;
  accent?: boolean;
  color?: "green" | "red";
}) {
  const bg = accent
    ? "rgba(124,106,247,0.15)"
    : color === "green"
    ? "rgba(34,197,94,0.12)"
    : "rgba(239,68,68,0.12)";
  const fg = accent
    ? "var(--color-accent)"
    : color === "green"
    ? "var(--color-state-sorted)"
    : "var(--color-state-swap)";
  return (
    <span
      className="text-xs font-mono px-2 py-0.5 rounded-full"
      style={{ background: bg, color: fg }}
    >
      {text}
    </span>
  );
}

function Slider({
  label,
  badge,
  min,
  max,
  step = 1,
  value,
  onChange,
  disabled,
}: {
  label: string;
  badge: string;
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (n: number) => void;
  disabled?: boolean;
}) {
  return (
    <label className="block mb-5">
      <div className="flex justify-between mb-1.5">
        <span className="text-sm" style={{ color: "var(--color-muted)" }}>{label}</span>
        <span className="text-sm font-mono" style={{ color: "var(--color-accent)" }}>{badge}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        disabled={disabled}
        className="w-full disabled:opacity-40"
      />
    </label>
  );
}

function SettingsPanel({
  size, setSize,
  maxVal, setMaxVal,
  onNewArray,
  customArray, setCustomArray,
  pseudocode,
  isPlaying,
  algorithmId,
}: {
  size: number; setSize: (n: number) => void;
  maxVal: number; setMaxVal: (n: number) => void;
  onNewArray: (arr?: number[]) => void;
  customArray: number[] | null;
  setCustomArray: (arr: number[] | null) => void;
  pseudocode: string[];
  isPlaying: boolean;
  algorithmId: string;
}) {
  const [tab, setTab] = useState<"settings" | "code">("settings");
  const [customInput, setCustomInput] = useState(customArray ? customArray.join(", ") : "");
  const [customError, setCustomError] = useState("");

  function applyCustomArray() {
    const nums = customInput.split(/[\s,]+/).filter(Boolean).map(Number);
    if (nums.some(isNaN) || nums.length < 2) {
      setCustomError("Enter at least 2 valid numbers, e.g. 5, 1, 4, 2, 8");
      return;
    }
    setCustomError("");
    setCustomArray(nums);
    onNewArray(nums);
  }

  function clearCustomArray() {
    setCustomArray(null);
    setCustomInput("");
    setCustomError("");
    onNewArray(undefined);
  }

  return (
    <div>
      {/* Tabs */}
      <div className="flex gap-1 mb-5 p-1 rounded-lg" style={{ background: "var(--color-surface-3)" }}>
        {(["settings", "code"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="flex-1 py-1.5 rounded-md text-xs font-semibold capitalize transition-colors"
            style={{
              background: tab === t ? "var(--color-surface-1)" : "transparent",
              color: tab === t ? "var(--color-text)" : "var(--color-muted)",
              border: "none",
              cursor: "pointer",
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "settings" ? (
        <div>
          {/* Custom array input */}
          <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--color-muted)" }}>
            Custom Array
          </p>
          <input
            type="text"
            value={customInput}
            onChange={e => { setCustomInput(e.target.value); setCustomError(""); }}
            placeholder="e.g. 5, 1, 4, 2, 8"
            disabled={isPlaying}
            className="w-full text-xs rounded-lg px-3 py-2 mb-2 disabled:opacity-40"
            style={{ background: "var(--color-surface-2)", border: `1px solid ${customError ? "var(--color-state-swap)" : "var(--color-border)"}`, color: "var(--color-text)", outline: "none" }}
          />
          {customError && <p className="text-xs mb-2" style={{ color: "var(--color-state-swap)" }}>{customError}</p>}
          <div className="flex gap-2 mb-5">
            <button
              onClick={applyCustomArray}
              disabled={isPlaying || !customInput.trim()}
              className="flex-1 py-1.5 rounded-lg text-xs font-medium disabled:opacity-40 transition-colors"
              style={{ background: "var(--color-accent)", color: "#fff", border: "none", cursor: isPlaying ? "not-allowed" : "pointer" }}
            >
              Use this array
            </button>
            {customArray && (
              <button
                onClick={clearCustomArray}
                disabled={isPlaying}
                className="py-1.5 px-3 rounded-lg text-xs font-medium disabled:opacity-40 transition-colors"
                style={{ background: "var(--color-surface-3)", border: "1px solid var(--color-border)", color: "var(--color-muted)", cursor: isPlaying ? "not-allowed" : "pointer" }}
              >
                Clear
              </button>
            )}
          </div>

          <Slider label="Array size" badge={String(size)} min={5} max={512} value={size} onChange={v => { setCustomArray(null); setCustomInput(""); setSize(v); }} disabled={isPlaying || !!customArray} />
          <Slider label="Max value" badge={String(maxVal)} min={10} max={512} value={maxVal} onChange={setMaxVal} disabled={isPlaying || !!customArray} />
          <button
            onClick={() => { setCustomArray(null); setCustomInput(""); onNewArray(undefined); }}
            disabled={isPlaying}
            className="w-full py-2 rounded-lg text-sm font-medium mb-6 disabled:opacity-40 transition-colors inline-flex items-center justify-center gap-1.5"
            style={{
              background: "var(--color-surface-3)",
              border: "1px solid var(--color-border)",
              color: "var(--color-text)",
              cursor: isPlaying ? "not-allowed" : "pointer",
            }}
          >
            <RotateCcw size={13} strokeWidth={1.75} /> New random array
          </button>

          <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--color-muted)" }}>
            Pseudocode
          </p>
          <div
            className="rounded-lg p-3 text-xs space-y-1 font-mono"
            style={{
              background: "var(--color-surface-2)",
              border: "1px solid var(--color-border)",
              color: "var(--color-muted)",
            }}
          >
            {pseudocode.map((line, i) => (
              <div key={i} className="leading-relaxed">{line}</div>
            ))}
          </div>
        </div>
      ) : (
        <CodePanel id={algorithmId} />
      )}
    </div>
  );
}

function MnemonicPanel({ algorithm }: { algorithm: string }) {
  const items = MNEMONICS[algorithm] ?? [];
  if (items.length === 0) {
    return (
      <p style={{ color: "var(--color-muted)", fontSize: 13 }}>
        No mnemonic devices available for this algorithm yet.
      </p>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {items.map((m, i) => (
        <div
          key={i}
          style={{
            padding: "12px 14px",
            borderRadius: 8,
            background: "var(--color-surface-2)",
            border: "1px solid var(--color-border)",
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: "var(--color-accent)",
              marginBottom: 6,
            }}
          >
            {m.headline}
          </div>
          <div style={{ fontSize: 12, color: "var(--color-muted)", lineHeight: 1.65 }}>
            {m.body}
          </div>
        </div>
      ))}
    </div>
  );
}

