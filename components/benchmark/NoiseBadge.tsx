"use client";

import { noiseLabel } from "@/lib/benchmark-stats";

interface Props {
  noiseCv?: number;
  compact?: boolean;
}

/** Small badge for per-point timing spread (coefficient of variation). */
export default function NoiseBadge({ noiseCv, compact }: Props) {
  if (noiseCv == null || noiseCv <= 0 || !Number.isFinite(noiseCv)) return null;
  const { label, color } = noiseLabel(noiseCv);
  return (
    <span
      style={{
        display: "inline-block",
        marginLeft: compact ? 4 : 6,
        padding: compact ? "0 4px" : "1px 5px",
        fontSize: compact ? 7 : 8,
        borderRadius: 3,
        fontFamily: "monospace",
        fontWeight: 600,
        color,
        background: `${color}18`,
        border: `1px solid ${color}55`,
        verticalAlign: "middle",
      }}
      title={`Timing noise CV = ${(noiseCv * 100).toFixed(1)}%`}
    >
      {label}
    </span>
  );
}
