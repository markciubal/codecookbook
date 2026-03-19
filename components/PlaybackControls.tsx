"use client";

import { Play, Pause, SkipBack, SkipForward, ChevronLeft, ChevronRight, RotateCcw, Timer } from "lucide-react";
import type React from "react";

export const SPEED_MIN = 20;   // fastest ms/step
export const SPEED_MAX = 1200; // slowest ms/step

const FINISH_PRESETS = [
  { label: "1s",  ms: 1_000 },
  { label: "5s",  ms: 5_000 },
  { label: "10s", ms: 10_000 },
  { label: "15s", ms: 15_000 },
  { label: "30s", ms: 30_000 },
  { label: "1m",  ms: 60_000 },
  { label: "5m",  ms: 300_000 },
];

interface Props {
  stepCount: number;
  stepIdx: number;
  setStepIdx: React.Dispatch<React.SetStateAction<number>>;
  isPlaying: boolean;
  setIsPlaying: React.Dispatch<React.SetStateAction<boolean>>;
  speed: number;
  setSpeed: React.Dispatch<React.SetStateAction<number>>;
  onReset: () => void;
  resetLabel?: string;
}

export default function PlaybackControls({
  stepCount,
  stepIdx,
  setStepIdx,
  isPlaying,
  setIsPlaying,
  speed,
  setSpeed,
  onReset,
  resetLabel = "Reset",
}: Props) {
  const canBack    = stepIdx > 0;
  const canForward = stepIdx < stepCount - 1;

  return (
    <div className="flex flex-col gap-3">
      {/* Progress scrubber */}
      <input
        type="range"
        min={0}
        max={Math.max(0, stepCount - 1)}
        value={stepIdx}
        onChange={(e) => { setIsPlaying(false); setStepIdx(Number(e.target.value)); }}
        className="w-full"
        style={{ accentColor: "var(--color-accent)", cursor: "pointer" }}
      />

      {/* Transport buttons + speed slider */}
      <div className="flex flex-wrap items-center gap-2">
        <Btn onClick={() => { setIsPlaying(false); setStepIdx(0); }} disabled={!canBack}>
          <SkipBack size={14} strokeWidth={1.75} />
        </Btn>
        <Btn onClick={() => { setIsPlaying(false); setStepIdx((p) => Math.max(0, p - 1)); }} disabled={!canBack}>
          <ChevronLeft size={14} strokeWidth={1.75} />
        </Btn>
        <Btn primary onClick={() => setIsPlaying((p) => !p)} disabled={!canForward} style={{ minWidth: 88 }}>
          {isPlaying
            ? <><Pause size={13} strokeWidth={1.75} /> Pause</>
            : <><Play  size={13} strokeWidth={1.75} /> Play</>}
        </Btn>
        <Btn onClick={() => { setIsPlaying(false); setStepIdx((p) => Math.min(stepCount - 1, p + 1)); }} disabled={!canForward}>
          <ChevronRight size={14} strokeWidth={1.75} />
        </Btn>
        <Btn onClick={() => { setIsPlaying(false); setStepIdx(stepCount - 1); }} disabled={!canForward}>
          <SkipForward size={14} strokeWidth={1.75} />
        </Btn>
        <Btn onClick={onReset}>
          <RotateCcw size={13} strokeWidth={1.75} /> {resetLabel}
        </Btn>

        {/* Speed slider */}
        <div
          className="flex items-center gap-2 pl-3 ml-1"
          style={{ borderLeft: "1px solid var(--color-border)" }}
        >
          <span className="text-xs" style={{ color: "var(--color-muted)", whiteSpace: "nowrap" }}>Slow</span>
          <input
            type="range"
            min={SPEED_MIN}
            max={SPEED_MAX}
            step={10}
            value={SPEED_MAX + SPEED_MIN - speed}
            onChange={(e) => setSpeed(SPEED_MAX + SPEED_MIN - Number(e.target.value))}
            style={{ width: 80, accentColor: "var(--color-accent)", cursor: "pointer" }}
          />
          <span className="text-xs" style={{ color: "var(--color-muted)", whiteSpace: "nowrap" }}>Fast</span>
        </div>
      </div>

      {/* Finish-in presets */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1 text-xs" style={{ color: "var(--color-muted)", whiteSpace: "nowrap" }}>
          <Timer size={12} strokeWidth={1.75} /> Finish in
        </span>
        {FINISH_PRESETS.map(({ label, ms }) => (
          <button
            key={label}
            onClick={() => {
              const remaining = Math.max(1, stepCount - stepIdx - 1);
              setSpeed(Math.max(SPEED_MIN, Math.min(SPEED_MAX, Math.round(ms / remaining))));
              setIsPlaying(true);
            }}
            disabled={!canForward}
            className="px-2 py-0.5 rounded text-xs font-mono transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: "var(--color-surface-3)",
              border: "1px solid var(--color-border)",
              color: "var(--color-muted)",
              cursor: "pointer",
            }}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Internal Btn ──────────────────────────────────────────────────────────────

function Btn({
  children, onClick, disabled, primary, style,
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
