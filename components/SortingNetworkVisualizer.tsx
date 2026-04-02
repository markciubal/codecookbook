"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Play, Pause, SkipBack, SkipForward, RotateCcw } from "lucide-react";
import {
  getBitonicNetworkSteps,
  getOddEvenMergeNetworkSteps,
  type NetworkAlgorithm,
  type NetworkStep,
  type NetworkComparator,
} from "@/lib/sorting-network";

interface Props {
  algorithm: NetworkAlgorithm;
}

const SPEED_MIN = 50;
const SPEED_MAX = 1200;

export default function SortingNetworkVisualizer({ algorithm }: Props) {
  const [n, setN] = useState(8);
  const [steps, setSteps] = useState<NetworkStep[]>([]);
  const [comparators, setComparators] = useState<NetworkComparator[]>([]);
  const [stepIdx, setStepIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(400);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const generate = useCallback(() => {
    const result =
      algorithm === "bitonic"
        ? getBitonicNetworkSteps(n)
        : getOddEvenMergeNetworkSteps(n);
    setComparators(result.comparators);
    setSteps(result.steps);
    setStepIdx(0);
    setIsPlaying(false);
  }, [algorithm, n]);

  useEffect(() => {
    generate();
  }, [generate]);

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

  const currentStep = steps[stepIdx];

  // SVG layout
  const SVG_W = 860;
  const SVG_H = 60 + n * 48;
  const WIRE_PADDING_L = 60;
  const WIRE_PADDING_R = 40;
  const WIRE_TOP = 40;
  const WIRE_SPACING = 48;
  const WIRE_LENGTH = SVG_W - WIRE_PADDING_L - WIRE_PADDING_R;

  const maxLayer = comparators.length > 0 ? Math.max(...comparators.map((c) => c.layer)) : 0;
  const layerCount = maxLayer + 1;
  const layerWidth = WIRE_LENGTH / (layerCount + 1);

  function wireY(wire: number): number {
    return WIRE_TOP + wire * WIRE_SPACING;
  }

  function layerX(layer: number): number {
    return WIRE_PADDING_L + (layer + 1) * layerWidth;
  }

  // Determine state of each comparator up to current step
  const compStates = new Map<string, "pending" | "active" | "swapped" | "done">();
  for (const comp of comparators) {
    compStates.set(`${comp.a}-${comp.b}-${comp.layer}`, "pending");
  }
  for (let i = 0; i <= stepIdx && i < steps.length; i++) {
    const s = steps[i];
    const key = `${s.comparatorA}-${s.comparatorB}-${s.layer}`;
    if (i === stepIdx) {
      compStates.set(key, s.swapped ? "swapped" : "active");
    } else {
      compStates.set(key, "done");
    }
  }

  // Bar chart values
  const barValues = currentStep ? currentStep.values : steps[0]?.values ?? [];
  const maxBar = Math.max(...barValues, 1);

  const BAR_H = 80;
  const BAR_W = Math.min(36, (SVG_W - 40) / n - 2);
  const BAR_GAP = (SVG_W - 40) / n;

  const algoLabel = algorithm === "bitonic" ? "Bitonic Sort" : "Odd-Even Merge Sort";

  return (
    <div
      style={{
        padding: "24px",
        maxWidth: 920,
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
          Sorting Networks — {algoLabel}
        </h1>
        <p style={{ fontSize: 12, color: "var(--color-muted)" }}>
          Fixed wiring of comparators. Vertical lines connect two wires; a swap occurs if the top wire has a larger value.
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
        {/* N selector */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginRight: 8 }}>
          <span style={{ fontSize: 12, color: "var(--color-muted)" }}>n =</span>
          {[4, 8, 16].map((val) => (
            <button
              key={val}
              onClick={() => {
                setN(val);
              }}
              style={{
                padding: "2px 10px",
                borderRadius: 6,
                fontSize: 12,
                background: n === val ? "var(--color-accent)" : "var(--color-surface-3)",
                color: n === val ? "#fff" : "var(--color-text)",
                border: "1px solid " + (n === val ? "var(--color-accent)" : "var(--color-border)"),
                cursor: "pointer",
              }}
            >
              {val}
            </button>
          ))}
        </div>

        {/* Step back */}
        <CtrlBtn
          onClick={() => { setIsPlaying(false); setStepIdx((p) => Math.max(0, p - 1)); }}
          disabled={stepIdx === 0}
        >
          <SkipBack size={13} strokeWidth={1.75} />
        </CtrlBtn>

        {/* Play/Pause */}
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

        {/* Step forward */}
        <CtrlBtn
          onClick={() => { setIsPlaying(false); setStepIdx((p) => Math.min(steps.length - 1, p + 1)); }}
          disabled={stepIdx >= steps.length - 1}
        >
          <SkipForward size={13} strokeWidth={1.75} />
        </CtrlBtn>

        {/* Reset */}
        <CtrlBtn onClick={generate}>
          <RotateCcw size={13} strokeWidth={1.75} /> New Array
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

        {/* Progress */}
        <span
          style={{
            marginLeft: "auto",
            fontSize: 11,
            color: "var(--color-muted)",
            fontFamily: "var(--font-mono)",
          }}
        >
          step {stepIdx + 1} / {steps.length}
        </span>
      </div>

      {/* Network SVG */}
      <div
        style={{
          background: "var(--color-surface-1)",
          border: "1px solid var(--color-border)",
          borderRadius: 8,
          overflow: "auto",
          marginBottom: 16,
        }}
      >
        <svg
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          style={{ width: "100%", minWidth: 400, display: "block" }}
        >
          {/* Layer separator lines */}
          {Array.from({ length: layerCount }, (_, l) => {
            const x = layerX(l);
            return (
              <line
                key={`sep-${l}`}
                x1={x - layerWidth / 2}
                y1={WIRE_TOP - 20}
                x2={x - layerWidth / 2}
                y2={SVG_H - 10}
                stroke="var(--color-border)"
                strokeWidth={0.5}
                strokeDasharray="3,4"
              />
            );
          })}

          {/* Horizontal wires */}
          {Array.from({ length: n }, (_, i) => (
            <g key={`wire-${i}`}>
              <line
                x1={WIRE_PADDING_L - 10}
                y1={wireY(i)}
                x2={SVG_W - WIRE_PADDING_R + 10}
                y2={wireY(i)}
                stroke="var(--color-border)"
                strokeWidth={1.5}
              />
              {/* Wire label (index) */}
              <text
                x={WIRE_PADDING_L - 16}
                y={wireY(i) + 4}
                textAnchor="end"
                fontSize={11}
                fill="var(--color-muted)"
              >
                {i}
              </text>
            </g>
          ))}

          {/* Comparators */}
          {comparators.map((comp, idx) => {
            const key = `${comp.a}-${comp.b}-${comp.layer}`;
            const state = compStates.get(key) ?? "pending";

            let strokeColor = "var(--color-border)";
            let circleColor = "var(--color-border)";

            if (state === "active") {
              strokeColor = "var(--color-accent)";
              circleColor = "var(--color-accent)";
            } else if (state === "swapped") {
              strokeColor = "var(--color-state-swap)";
              circleColor = "var(--color-state-swap)";
            } else if (state === "done") {
              strokeColor = "var(--color-state-sorted)";
              circleColor = "var(--color-state-sorted)";
            }

            const x = layerX(comp.layer);
            const y1 = wireY(Math.min(comp.a, comp.b));
            const y2 = wireY(Math.max(comp.a, comp.b));
            const opacity = state === "pending" ? 0.3 : 1;

            return (
              <g key={`comp-${idx}`} opacity={opacity}>
                <line
                  x1={x}
                  y1={y1}
                  x2={x}
                  y2={y2}
                  stroke={strokeColor}
                  strokeWidth={state === "active" || state === "swapped" ? 3 : 2}
                />
                <circle cx={x} cy={y1} r={5} fill={circleColor} />
                <circle cx={x} cy={y2} r={5} fill={circleColor} />
              </g>
            );
          })}

          {/* Current values on wires (at right side) */}
          {barValues.map((val, i) => (
            <text
              key={`val-${i}`}
              x={SVG_W - WIRE_PADDING_R + 14}
              y={wireY(i) + 4}
              textAnchor="start"
              fontSize={11}
              fontWeight={600}
              fill={
                currentStep && (i === currentStep.comparatorA || i === currentStep.comparatorB)
                  ? "var(--color-accent)"
                  : "var(--color-text)"
              }
            >
              {val}
            </text>
          ))}
        </svg>
      </div>

      {/* Bar chart */}
      <div
        style={{
          background: "var(--color-surface-1)",
          border: "1px solid var(--color-border)",
          borderRadius: 8,
          padding: "12px 16px",
          marginBottom: 16,
        }}
      >
        <div style={{ fontSize: 11, color: "var(--color-muted)", marginBottom: 8 }}>
          Current array state
        </div>
        <svg viewBox={`0 0 ${SVG_W} ${BAR_H + 24}`} style={{ width: "100%", display: "block" }}>
          {barValues.map((val, i) => {
            const barHeight = (val / maxBar) * BAR_H;
            const x = 20 + i * BAR_GAP + (BAR_GAP - BAR_W) / 2;
            const y = BAR_H - barHeight;

            let color = "var(--color-state-default)";
            if (currentStep) {
              if (i === currentStep.comparatorA || i === currentStep.comparatorB) {
                color = currentStep.swapped
                  ? "var(--color-state-swap)"
                  : "var(--color-accent)";
              } else if (stepIdx === steps.length - 1) {
                color = "var(--color-state-sorted)";
              }
            }

            return (
              <g key={`bar-${i}`}>
                <rect x={x} y={y} width={BAR_W} height={barHeight} fill={color} rx={2} />
                <text
                  x={x + BAR_W / 2}
                  y={BAR_H + 14}
                  textAnchor="middle"
                  fontSize={10}
                  fill="var(--color-muted)"
                >
                  {val}
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
        }}
      >
        <span style={{ color: "var(--color-muted)", marginRight: 8 }}>→</span>
        {currentStep?.description ?? "Press Play to start"}
      </div>

      {/* Legend */}
      <div
        style={{
          display: "flex",
          gap: 16,
          marginTop: 12,
          fontSize: 11,
          color: "var(--color-muted)",
        }}
      >
        {[
          { color: "var(--color-accent)", label: "Active (no swap)" },
          { color: "var(--color-state-swap)", label: "Swapped" },
          { color: "var(--color-state-sorted)", label: "Completed" },
          { color: "var(--color-border)", label: "Pending", opacity: 0.3 },
        ].map(({ color, label, opacity }) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div
              style={{
                width: 12,
                height: 12,
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
