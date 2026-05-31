"use client";

import { useEffect, useMemo, useState } from "react";
import type { DataType, SortStep } from "@/lib/benchmark";
import { DT_LABEL, DT_SYMBOL, cssBorderStyle } from "@/lib/dataTypeStyle";
import { labelsAtStep, sampleFingerprint } from "@/lib/preview-labels";

const BAR_COLORS = {
  swap: "#ef5350",
  pivot: "#64b5f6",
  compare: "#ffc000",
  sorted: "#66bb6a",
};

interface Props {
  algoId: string;
  algoName: string;
  color: string;
  steps: SortStep[] | null;
  dataType: DataType;
  /** Raw sample values at sort start (strings for string runs, numeric strings otherwise). */
  initialLabels?: string[] | null;
  /** Loop the animation while the benchmark is running. */
  loop?: boolean;
  /** Smaller layout for the floating running dashboard. */
  compact?: boolean;
}

export default function RunningSortPreview({
  algoId, algoName, color, steps, dataType, initialLabels, loop = true, compact = false,
}: Props) {
  const [stepIdx, setStepIdx] = useState(0);

  useEffect(() => {
    setStepIdx(0);
  }, [algoId, steps, dataType]);

  useEffect(() => {
    if (!loop || !steps || steps.length < 2) return;
    const timer = setInterval(() => {
      setStepIdx(prev => (prev >= steps.length - 1 ? 0 : prev + 1));
    }, compact ? 70 : 90);
    return () => clearInterval(timer);
  }, [loop, steps, compact]);

  const step = steps?.[stepIdx] ?? steps?.[steps.length - 1] ?? null;
  const maxVal = step ? Math.max(...step.arr, 1) : 1;
  const n = step?.arr.length ?? 0;
  const barW = n > 0 ? 100 / n : 0;
  const chartH = compact ? 28 : 40;

  const barLabels = useMemo(() => {
    if (!step || !steps?.length) return [];
    const base = initialLabels ?? step.arr.map(String);
    return labelsAtStep(steps, base, stepIdx, dataType, compact);
  }, [step, steps, stepIdx, dataType, initialLabels, compact]);

  const fingerprint = useMemo(
    () => (initialLabels?.length ? sampleFingerprint(initialLabels) : null),
    [initialLabels],
  );

  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{
        background: "var(--color-surface-1)",
        border: `1px solid color-mix(in srgb, ${color} 35%, var(--color-border))`,
        padding: compact ? "6px 8px" : "8px 10px",
      }}
    >
      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
        <span
          className="rounded-full shrink-0"
          style={{ width: compact ? 6 : 7, height: compact ? 6 : 7, background: color }}
        />
        <span
          className="font-semibold truncate"
          style={{ fontSize: compact ? 10 : 11, color: "var(--color-text)", flex: 1, minWidth: 0 }}
        >
          {algoName}
        </span>
        <span
          className="shrink-0 font-mono px-1.5 py-px rounded"
          title={DT_LABEL[dataType]}
          style={{
            fontSize: compact ? 8 : 9,
            color: "var(--color-muted)",
            border: `1px ${cssBorderStyle(dataType)} var(--color-border)`,
            background: "var(--color-surface-2)",
          }}
        >
          {DT_SYMBOL[dataType]}
        </span>
        <span className="shrink-0 font-mono" style={{ fontSize: compact ? 9 : 10, color: "var(--color-muted)" }}>
          n={n || 10}
          {fingerprint && (
            <span title="Sample fingerprint (djb2 of all values)"> · {fingerprint}</span>
          )}
        </span>
      </div>

      {step ? (
        <>
          <svg
            viewBox={`0 0 100 ${chartH}`}
            preserveAspectRatio="none"
            style={{ width: "100%", height: chartH, display: "block", borderRadius: 4 }}
          >
            {step.arr.map((val, i) => {
              const h = Math.max(2, (val / maxVal) * (chartH - 2));
              const swpSet = new Set(step.swapping);
              const cmpSet = new Set(step.comparing);
              const sortedSet = new Set(step.sorted);
              const fill = swpSet.has(i) ? BAR_COLORS.swap
                : step.pivot === i ? BAR_COLORS.pivot
                : cmpSet.has(i) ? BAR_COLORS.compare
                : sortedSet.has(i) ? BAR_COLORS.sorted
                : color;
              return (
                <rect
                  key={i}
                  x={i * barW + 0.3}
                  y={chartH - h}
                  width={Math.max(0.5, barW - 0.6)}
                  height={h}
                  fill={fill}
                  rx={0.2}
                />
              );
            })}
          </svg>

          {barLabels.length > 0 && (
            <div
              className="grid font-mono leading-none"
              style={{
                gridTemplateColumns: `repeat(${barLabels.length}, minmax(0, 1fr))`,
                gap: 1,
                marginTop: compact ? 3 : 4,
                fontSize: compact ? 7 : 8,
                color: "var(--color-muted)",
                textAlign: "center",
              }}
            >
              {barLabels.map((label, i) => {
                const fullValue = dataType === "string"
                  ? (initialLabels?.[i] ?? label)
                  : dataType === "float"
                    ? String(step.arr[i])
                    : String(Math.round(step.arr[i]));
                return (
                <span
                  key={i}
                  title={fullValue}
                  style={{
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    color: step.swapping.includes(i) ? BAR_COLORS.swap
                      : step.comparing.includes(i) ? BAR_COLORS.compare
                      : step.sorted.includes(i) ? BAR_COLORS.sorted
                      : "var(--color-muted)",
                  }}
                >
                  {label}
                </span>
                );
              })}
            </div>
          )}

          {!compact && (
            <div
              className="mt-1.5 h-0.5 rounded-full overflow-hidden"
              style={{ background: "var(--color-surface-3)" }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${steps && steps.length > 1 ? (stepIdx / (steps.length - 1)) * 100 : 0}%`,
                  background: color,
                  borderRadius: 2,
                  transition: "width 0.08s linear",
                }}
              />
            </div>
          )}
        </>
      ) : (
        <div
          className="italic font-mono text-center py-2"
          style={{ fontSize: compact ? 9 : 10, color: "var(--color-muted)" }}
        >
          Preview loading…
        </div>
      )}
    </div>
  );
}
