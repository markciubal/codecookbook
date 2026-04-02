"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Play, Pause, SkipBack, SkipForward, RotateCcw } from "lucide-react";
import {
  getGeoSteps,
  generateRandomPoints,
  type GeoAlgorithm,
  type GeoStep,
  type Point,
} from "@/lib/geometry-algorithms";

interface Props {
  algorithm: GeoAlgorithm;
}

const SPEED_MIN = 50;
const SPEED_MAX = 1200;

const STATE_COLORS: Record<string, string> = {
  default: "var(--color-muted)",
  candidate: "var(--color-state-compare)",
  hull: "var(--color-state-sorted)",
  rejected: "var(--color-state-swap)",
  current: "var(--color-accent)",
};

export default function GeometryVisualizer({ algorithm }: Props) {
  const [points, setPoints] = useState<Point[]>(() => generateRandomPoints(15));
  const [steps, setSteps] = useState<GeoStep[]>([]);
  const [stepIdx, setStepIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(400);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const algoLabel =
    algorithm === "graham-scan" ? "Graham Scan" : "Jarvis March (Gift Wrapping)";

  const buildSteps = useCallback(
    (pts: Point[]) => {
      const s = getGeoSteps(algorithm, pts);
      setSteps(s);
      setStepIdx(0);
      setIsPlaying(false);
    },
    [algorithm]
  );

  useEffect(() => {
    buildSteps(points);
  }, [buildSteps, points]);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!isPlaying) return;
    if (stepIdx >= steps.length - 1) {
      setIsPlaying(false);
      return;
    }
    timerRef.current = setTimeout(() => {
      setStepIdx((p) => p + 1);
    }, speed);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isPlaying, stepIdx, steps.length, speed]);

  const handleNewPoints = () => {
    const count = 10 + Math.floor(Math.random() * 11);
    const newPts = generateRandomPoints(count);
    setPoints(newPts);
  };

  const currentStep: GeoStep | undefined = steps[stepIdx];

  // Build hull polygon path
  function hullPath(hull: number[], pts: Point[]): string {
    if (hull.length < 2) return "";
    const coords = hull.map((i) => pts[i]);
    return (
      coords.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ") + " Z"
    );
  }

  return (
    <div
      style={{
        padding: "24px",
        maxWidth: 760,
        margin: "0 auto",
        fontFamily: "var(--font-mono)",
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1
          style={{
            fontSize: 20,
            fontWeight: 700,
            color: "var(--color-text)",
            marginBottom: 4,
          }}
        >
          Convex Hull — {algoLabel}
        </h1>
        <p style={{ fontSize: 12, color: "var(--color-muted)" }}>
          The convex hull is the smallest convex polygon containing all points.
        </p>
      </div>

      {/* Controls */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          marginBottom: 20,
          padding: "12px 16px",
          background: "var(--color-surface-1)",
          border: "1px solid var(--color-border)",
          borderRadius: 8,
          alignItems: "center",
        }}
      >
        <CtrlBtn
          onClick={() => { setIsPlaying(false); setStepIdx(0); }}
          disabled={stepIdx === 0}
        >
          <SkipBack size={13} strokeWidth={1.75} />
        </CtrlBtn>

        <CtrlBtn
          onClick={() => { setIsPlaying(false); setStepIdx((p) => Math.max(0, p - 1)); }}
          disabled={stepIdx === 0}
        >
          ‹
        </CtrlBtn>

        <CtrlBtn
          primary
          onClick={() => setIsPlaying((p) => !p)}
          disabled={stepIdx >= steps.length - 1}
          style={{ minWidth: 80 }}
        >
          {isPlaying
            ? <><Pause size={13} strokeWidth={1.75} /> Pause</>
            : <><Play size={13} strokeWidth={1.75} /> Play</>}
        </CtrlBtn>

        <CtrlBtn
          onClick={() => { setIsPlaying(false); setStepIdx((p) => Math.min(steps.length - 1, p + 1)); }}
          disabled={stepIdx >= steps.length - 1}
        >
          ›
        </CtrlBtn>

        <CtrlBtn
          onClick={() => { setIsPlaying(false); setStepIdx(steps.length - 1); }}
          disabled={stepIdx >= steps.length - 1}
        >
          <SkipForward size={13} strokeWidth={1.75} />
        </CtrlBtn>

        <CtrlBtn onClick={() => buildSteps(points)}>
          <RotateCcw size={13} strokeWidth={1.75} /> Reset
        </CtrlBtn>

        <CtrlBtn onClick={handleNewPoints}>
          New Points
        </CtrlBtn>

        {/* Speed */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            paddingLeft: 12,
            marginLeft: 4,
            borderLeft: "1px solid var(--color-border)",
          }}
        >
          <span style={{ fontSize: 11, color: "var(--color-muted)" }}>Slow</span>
          <input
            type="range"
            min={SPEED_MIN}
            max={SPEED_MAX}
            step={10}
            value={SPEED_MAX + SPEED_MIN - speed}
            onChange={(e) => setSpeed(SPEED_MAX + SPEED_MIN - Number(e.target.value))}
            style={{ width: 80, accentColor: "var(--color-accent)", cursor: "pointer" }}
          />
          <span style={{ fontSize: 11, color: "var(--color-muted)" }}>Fast</span>
        </div>

        <span
          style={{
            marginLeft: "auto",
            fontSize: 11,
            color: "var(--color-muted)",
          }}
        >
          step {stepIdx + 1} / {steps.length}
        </span>
      </div>

      {/* Canvas */}
      <div
        style={{
          background: "var(--color-surface-1)",
          border: "1px solid var(--color-border)",
          borderRadius: 8,
          marginBottom: 16,
          overflow: "hidden",
        }}
      >
        <svg viewBox="0 0 400 300" style={{ width: "100%", display: "block" }}>
          {/* Hull polygon fill */}
          {currentStep && currentStep.hull.length >= 3 && (
            <path
              d={hullPath(currentStep.hull, points)}
              fill="var(--color-state-sorted)"
              fillOpacity={0.08}
              stroke="none"
            />
          )}

          {/* Hull edges */}
          {currentStep &&
            currentStep.hull.length >= 2 &&
            currentStep.hull.map((idx, i) => {
              const next = currentStep.hull[(i + 1) % currentStep.hull.length];
              if (i === currentStep.hull.length - 1 && currentStep.hull.length < 3) return null;
              return (
                <line
                  key={`hull-edge-${i}`}
                  x1={points[idx].x}
                  y1={points[idx].y}
                  x2={points[next].x}
                  y2={points[next].y}
                  stroke="var(--color-state-sorted)"
                  strokeWidth={2}
                  strokeOpacity={0.8}
                />
              );
            })}

          {/* Current line */}
          {currentStep?.currentLine && (
            <line
              x1={points[currentStep.currentLine[0]].x}
              y1={points[currentStep.currentLine[0]].y}
              x2={points[currentStep.currentLine[1]].x}
              y2={points[currentStep.currentLine[1]].y}
              stroke="var(--color-accent)"
              strokeWidth={1.5}
              strokeDasharray="4,3"
            />
          )}

          {/* Points */}
          {points.map((pt, i) => {
            const state = currentStep?.states[i] ?? "default";
            const color = STATE_COLORS[state] ?? STATE_COLORS.default;
            const r = state === "hull" || state === "current" ? 7 : 5;

            return (
              <g key={`pt-${i}`}>
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={r}
                  fill={color}
                  fillOpacity={state === "rejected" ? 0.35 : 1}
                  stroke={state === "current" ? "var(--color-accent)" : "none"}
                  strokeWidth={2}
                />
                <text
                  x={pt.x + 9}
                  y={pt.y - 6}
                  fontSize={9}
                  fill="var(--color-muted)"
                  style={{ userSelect: "none" }}
                >
                  {i}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Description panel */}
      <div
        style={{
          background: "var(--color-surface-1)",
          border: "1px solid var(--color-border)",
          borderRadius: 8,
          padding: "12px 16px",
          fontSize: 12,
          color: "var(--color-text)",
          minHeight: 44,
          marginBottom: 12,
        }}
      >
        <span style={{ color: "var(--color-muted)", marginRight: 8 }}>→</span>
        {currentStep?.description ?? "Press Play to start"}
      </div>

      {/* Legend */}
      <div style={{ display: "flex", gap: 16, fontSize: 11, color: "var(--color-muted)", flexWrap: "wrap" }}>
        {[
          { color: STATE_COLORS.default, label: "Default" },
          { color: STATE_COLORS.current, label: "Current" },
          { color: STATE_COLORS.candidate, label: "Candidate" },
          { color: STATE_COLORS.hull, label: "Hull" },
          { color: STATE_COLORS.rejected, label: "Rejected", opacity: 0.35 },
        ].map(({ color, label, opacity }) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: color,
                opacity: opacity ?? 1,
              }}
            />
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}

function CtrlBtn({
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
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "4px 10px",
        borderRadius: 6,
        fontSize: 12,
        fontWeight: 500,
        background: primary ? "var(--color-accent)" : "var(--color-surface-3)",
        color: primary ? "#fff" : "var(--color-text)",
        border: "1px solid " + (primary ? "var(--color-accent)" : "var(--color-border)"),
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.45 : 1,
        transition: "opacity 0.15s",
        ...style,
      }}
    >
      {children}
    </button>
  );
}
