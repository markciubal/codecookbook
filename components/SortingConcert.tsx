"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  generateArray,
  getSteps,
  BAR_COLORS,
  ALGORITHM_META,
} from "@/lib/algorithms";
import type { SortStep } from "@/lib/types";
import type { SortAlgorithm } from "@/lib/types";
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Music,
} from "lucide-react";

// ── Audio helpers ────────────────────────────────────────────────────────────

type OscType = OscillatorType;

function playTone(
  ctx: AudioContext,
  freq: number,
  type: OscType,
  duration: number,
  gain: number,
  startOffset = 0,
) {
  const osc = ctx.createOscillator();
  const gainNode = ctx.createGain();
  osc.connect(gainNode);
  gainNode.connect(ctx.destination);
  osc.type = type;
  osc.frequency.value = freq;
  const t = ctx.currentTime + startOffset;
  gainNode.gain.setValueAtTime(gain, t);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  osc.start(t);
  osc.stop(t + duration);
}

// ── Algorithm sound characters ───────────────────────────────────────────────

interface AlgoSound {
  oscType: OscType;
  minHz: number;
  maxHz: number;
}

const ALGO_SOUNDS: Record<string, AlgoSound> = {
  bubble:    { oscType: "sine",     minHz: 400,  maxHz: 1200 },
  quick:     { oscType: "sawtooth", minHz: 300,  maxHz: 900  },
  merge:     { oscType: "triangle", minHz: 200,  maxHz: 700  },
  insertion: { oscType: "square",   minHz: 150,  maxHz: 500  },
  heap:      { oscType: "sawtooth", minHz: 100,  maxHz: 400  },
  selection: { oscType: "sine",     minHz: 80,   maxHz: 300  },
};

const CONCERT_ALGOS: SortAlgorithm[] = [
  "bubble", "quick", "merge", "insertion", "heap", "selection",
];

const INSTRUMENT_LABELS: Record<string, string> = {
  bubble:    "Sine · High",
  quick:     "Sawtooth · Mid-High",
  merge:     "Triangle · Mid",
  insertion: "Square · Low-Mid",
  heap:      "Sawtooth · Low",
  selection: "Sine · Very Low",
};

// ── Panel sub-component ──────────────────────────────────────────────────────

interface PanelProps {
  algorithmId: SortAlgorithm;
  steps: SortStep[];
  stepIdx: number;
  isMuted: boolean;
  onToggleMute: () => void;
  isDone: boolean;
}

function AlgoPanel({ algorithmId, steps, stepIdx, isMuted, onToggleMute, isDone }: PanelProps) {
  const meta = ALGORITHM_META[algorithmId];
  const step = steps[stepIdx] ?? steps[steps.length - 1];
  if (!step) return null;

  const peak = Math.max(...step.array, 1);

  return (
    <div
      style={{
        background: "var(--color-surface-2)",
        border: "1px solid var(--color-border)",
        borderRadius: 12,
        padding: "14px 14px 10px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        position: "relative",
        opacity: isDone ? 0.75 : 1,
        transition: "opacity 0.3s ease",
      }}
    >
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Music
          size={14}
          strokeWidth={1.75}
          style={{ color: "var(--color-accent)", flexShrink: 0 }}
        />
        <span style={{ fontWeight: 700, fontSize: 13, color: "var(--color-text)", flex: 1 }}>
          {meta.name}
        </span>
        {isDone && (
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              background: "var(--color-state-sorted, #22c55e)",
              color: "#fff",
              borderRadius: 99,
              padding: "1px 7px",
              letterSpacing: "0.04em",
            }}
          >
            DONE
          </span>
        )}
        <button
          onClick={onToggleMute}
          title={isMuted ? "Unmute" : "Mute"}
          style={{
            background: "var(--color-surface-3)",
            border: "1px solid var(--color-border)",
            borderRadius: 6,
            color: "var(--color-muted)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            padding: "2px 5px",
          }}
        >
          {isMuted ? <VolumeX size={11} strokeWidth={1.75} /> : <Volume2 size={11} strokeWidth={1.75} />}
        </button>
      </div>

      {/* Instrument label */}
      <div style={{ fontSize: 10, color: "var(--color-muted)", marginTop: -4 }}>
        {INSTRUMENT_LABELS[algorithmId]}
      </div>

      {/* Mini bar chart */}
      <div
        style={{
          height: 80,
          display: "flex",
          alignItems: "flex-end",
          gap: 1,
          background: "var(--color-surface-1)",
          border: "1px solid var(--color-border)",
          borderRadius: 8,
          padding: "6px 6px 4px",
          boxSizing: "border-box",
          overflow: "hidden",
        }}
      >
        {step.array.map((val, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              height: `${(val / peak) * 100}%`,
              minWidth: 1,
              background: BAR_COLORS[step.states[i]] ?? BAR_COLORS.default,
              borderRadius: "1px 1px 0 0",
              transition: "height 0.06s ease",
            }}
          />
        ))}
      </div>

      {/* Progress bar */}
      <div
        style={{
          height: 3,
          borderRadius: 99,
          background: "var(--color-surface-3)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${steps.length > 1 ? (stepIdx / (steps.length - 1)) * 100 : 100}%`,
            background: "var(--color-accent)",
            borderRadius: 99,
            transition: "width 0.1s linear",
          }}
        />
      </div>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export default function SortingConcert() {
  const [size, setSize] = useState(32);
  const [speed, setSpeed] = useState(180);
  const [isPlaying, setIsPlaying] = useState(false);
  const [masterMuted, setMasterMuted] = useState(true);
  const [perMuted, setPerMuted] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(CONCERT_ALGOS.map((a) => [a, false])),
  );

  const [allSteps, setAllSteps] = useState<Record<string, SortStep[]>>({});
  const [stepIdxs, setStepIdxs] = useState<Record<string, number>>(() =>
    Object.fromEntries(CONCERT_ALGOS.map((a) => [a, 0])),
  );

  const audioCtxRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Generate a shared array, compute steps for all algos
  const newConcert = useCallback(() => {
    setIsPlaying(false);
    const arr = generateArray(size, 1, 100);
    const steps: Record<string, SortStep[]> = {};
    for (const algo of CONCERT_ALGOS) {
      steps[algo] = getSteps(algo, [...arr]);
    }
    setAllSteps(steps);
    setStepIdxs(Object.fromEntries(CONCERT_ALGOS.map((a) => [a, 0])));
  }, [size]);

  useEffect(() => {
    newConcert();
  }, [newConcert]);

  // Max steps across all algorithms (for lockstep)
  const maxSteps = Math.max(
    ...CONCERT_ALGOS.map((a) => allSteps[a]?.length ?? 0),
    1,
  );
  const globalStepIdx = Math.max(...CONCERT_ALGOS.map((a) => stepIdxs[a] ?? 0));
  const allDone = CONCERT_ALGOS.every(
    (a) => stepIdxs[a] >= (allSteps[a]?.length ?? 1) - 1,
  );

  // Playback loop — advance each algo independently (it stops at its own end)
  useEffect(() => {
    if (!isPlaying) return;
    if (allDone) {
      setIsPlaying(false);
      return;
    }
    timerRef.current = setTimeout(() => {
      setStepIdxs((prev) => {
        const next = { ...prev };
        for (const algo of CONCERT_ALGOS) {
          const len = allSteps[algo]?.length ?? 1;
          if (prev[algo] < len - 1) next[algo] = prev[algo] + 1;
        }
        return next;
      });
    }, speed);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isPlaying, stepIdxs, allSteps, speed, allDone]);

  // Sound — play a short tone per active algorithm on each tick
  useEffect(() => {
    if (masterMuted) return;
    if (!isPlaying) return;
    if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
    const ctx = audioCtxRef.current;

    let offset = 0;
    for (const algo of CONCERT_ALGOS) {
      if (perMuted[algo]) continue;
      const steps = allSteps[algo];
      const idx = stepIdxs[algo];
      if (!steps || !steps[idx]) continue;

      const s = steps[idx];
      const peak = Math.max(...s.array, 1);
      const activeVals = s.array.filter((_, i) =>
        s.states[i] === "comparing" ||
        s.states[i] === "swapping" ||
        s.states[i] === "minimum" ||
        s.states[i] === "pivot" ||
        s.states[i] === "current",
      );
      if (activeVals.length === 0) continue;

      const sound = ALGO_SOUNDS[algo];
      const val = activeVals[0];
      const freq = sound.minHz + (val / peak) * (sound.maxHz - sound.minHz);
      playTone(ctx, freq, sound.oscType, 0.09, 0.08, offset);
      offset += 0.005;
    }
  }, [stepIdxs, isPlaying, masterMuted, perMuted, allSteps]);

  const handlePlayPause = () => {
    if (allDone) return;
    if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
    else if (audioCtxRef.current.state === "suspended") {
      audioCtxRef.current.resume();
    }
    setIsPlaying((p) => !p);
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflow: "hidden",
      }}
    >
      {/* ── Header ── */}
      <div
        style={{
          padding: "20px 24px 16px",
          borderBottom: "1px solid var(--color-border)",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Music
            size={20}
            strokeWidth={1.75}
            style={{ color: "var(--color-accent)" }}
          />
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>
            Sound Concert
          </h1>
          <span
            style={{
              fontSize: 11,
              fontFamily: "monospace",
              background: "rgba(124,106,247,0.15)",
              color: "var(--color-accent)",
              borderRadius: 99,
              padding: "2px 9px",
            }}
          >
            6 algorithms
          </span>
        </div>
        <p style={{ margin: 0, fontSize: 13, color: "var(--color-muted)", maxWidth: 560 }}>
          Each algorithm gets its own oscillator type and pitch range. Start them all together and listen to the chaos resolve into order.
        </p>

        {/* Controls row */}
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
          {/* Play / Pause */}
          <button
            onClick={handlePlayPause}
            disabled={allDone}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 16px",
              borderRadius: 8,
              background: "var(--color-accent)",
              border: "none",
              color: "#fff",
              fontWeight: 600,
              fontSize: 13,
              cursor: allDone ? "not-allowed" : "pointer",
              opacity: allDone ? 0.5 : 1,
            }}
          >
            {isPlaying ? <Pause size={14} strokeWidth={2} /> : <Play size={14} strokeWidth={2} />}
            {isPlaying ? "Pause" : "Play"}
          </button>

          {/* New Concert */}
          <button
            onClick={newConcert}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 14px",
              borderRadius: 8,
              background: "var(--color-surface-3)",
              border: "1px solid var(--color-border)",
              color: "var(--color-text)",
              fontWeight: 500,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            <RotateCcw size={13} strokeWidth={1.75} /> New Concert
          </button>

          {/* Master mute */}
          <button
            onClick={() => setMasterMuted((p) => !p)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 12px",
              borderRadius: 8,
              background: "var(--color-surface-3)",
              border: "1px solid var(--color-border)",
              color: "var(--color-muted)",
              fontSize: 12,
              fontFamily: "monospace",
              cursor: "pointer",
            }}
          >
            {masterMuted ? <VolumeX size={13} strokeWidth={1.75} /> : <Volume2 size={13} strokeWidth={1.75} />}
            {masterMuted ? "Sound off" : "Sound on"}
          </button>

          {/* Speed */}
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 12,
              color: "var(--color-muted)",
            }}
          >
            Speed
            <input
              type="range"
              min={30}
              max={600}
              step={10}
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
              disabled={isPlaying}
              style={{ width: 80 }}
            />
            <span style={{ fontFamily: "monospace", color: "var(--color-accent)", minWidth: 42 }}>
              {speed}ms
            </span>
          </label>

          {/* Array size */}
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 12,
              color: "var(--color-muted)",
            }}
          >
            Size
            <input
              type="range"
              min={8}
              max={80}
              step={4}
              value={size}
              onChange={(e) => setSize(Number(e.target.value))}
              disabled={isPlaying}
              style={{ width: 80 }}
            />
            <span style={{ fontFamily: "monospace", color: "var(--color-accent)", minWidth: 28 }}>
              {size}
            </span>
          </label>

          {/* Global progress */}
          <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--color-muted)", fontFamily: "monospace" }}>
            Step {Math.min(globalStepIdx + 1, maxSteps)} / {maxSteps}
          </span>
        </div>
      </div>

      {/* ── Grid of panels ── */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "20px 24px 24px",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: 16,
          }}
        >
          {CONCERT_ALGOS.map((algo) => {
            const steps = allSteps[algo] ?? [];
            const idx = stepIdxs[algo] ?? 0;
            const isDone = steps.length > 1 && idx >= steps.length - 1;
            return (
              <AlgoPanel
                key={algo}
                algorithmId={algo}
                steps={steps}
                stepIdx={idx}
                isMuted={masterMuted || perMuted[algo]}
                onToggleMute={() =>
                  setPerMuted((prev) => ({ ...prev, [algo]: !prev[algo] }))
                }
                isDone={isDone}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
