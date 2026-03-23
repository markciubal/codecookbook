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

interface Props {
  algorithm: SortAlgorithm;
}


export default function SortingVisualizer({ algorithm }: Props) {
  const meta = ALGORITHM_META[algorithm];

  const [size, setSize] = useState(28);
  const [maxVal, setMaxVal] = useState(100);
  const [speed, setSpeed] = useState(220); // ms per step
  const [steps, setSteps] = useState<SortStep[]>([]);
  const [stepIdx, setStepIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [isMnemonicOpen, setIsMnemonicOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Generate array and compute steps
  const reset = useCallback(() => {
    setIsPlaying(false);
    const arr = generateArray(size, 1, maxVal);
    const s = getSteps(algorithm, arr);
    setSteps(s);
    setStepIdx(0);
  }, [size, maxVal, algorithm]);

  useEffect(() => {
    reset();
  }, [reset]);

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

  const step = steps[stepIdx];
  if (!step) return null;

  const peak = Math.max(...step.array, 1);
  const sortedCount = step.states.filter((s) => s === "sorted").length;
  const sortedPct = Math.round((sortedCount / step.array.length) * 100);


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
        <p className="text-sm max-w-xl" style={{ color: "var(--color-muted)" }}>
          {meta.description}
        </p>
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

      <PanelModal isOpen={isMnemonicOpen} onClose={() => setIsMnemonicOpen(false)} title="Mnemonic Devices">
        <MnemonicPanel algorithm={algorithm} />
      </PanelModal>

      <PanelModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} title="Settings">
        <SettingsPanel
          size={size} setSize={setSize}
          maxVal={maxVal} setMaxVal={setMaxVal}
          onNewArray={reset}
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
  pseudocode,
  isPlaying,
  algorithmId,
}: {
  size: number; setSize: (n: number) => void;
  maxVal: number; setMaxVal: (n: number) => void;
  onNewArray: () => void;
  pseudocode: string[];
  isPlaying: boolean;
  algorithmId: string;
}) {
  const [tab, setTab] = useState<"settings" | "code">("settings");

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
          <Slider label="Array size" badge={String(size)} min={5} max={512} value={size} onChange={setSize} disabled={isPlaying} />
          <Slider label="Max value" badge={String(maxVal)} min={10} max={512} value={maxVal} onChange={setMaxVal} disabled={isPlaying} />
          <button
            onClick={onNewArray}
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

