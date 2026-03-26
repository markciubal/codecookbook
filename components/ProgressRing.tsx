"use client";

import { useProgress } from "@/hooks/useProgress";

interface Props {
  paths: string[];
  label: string;
  color?: string;
}

export default function ProgressRing({ paths, label, color = "var(--color-accent)" }: Props) {
  const { visited } = useProgress();
  const count = paths.filter((p) => visited.has(p)).length;
  const total = paths.length;
  const pct = total === 0 ? 0 : count / total;

  const r = 14;
  const circ = 2 * Math.PI * r;
  const dash = circ * pct;

  return (
    <div className="flex items-center gap-2">
      <svg width={36} height={36} style={{ flexShrink: 0 }}>
        {/* Track */}
        <circle cx={18} cy={18} r={r} fill="none" stroke="var(--color-border)" strokeWidth={3} />
        {/* Progress */}
        <circle
          cx={18} cy={18} r={r}
          fill="none"
          stroke={color}
          strokeWidth={3}
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          transform="rotate(-90 18 18)"
          style={{ transition: "stroke-dasharray 0.4s ease" }}
        />
        <text
          x={18} y={19}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={8}
          fontWeight={700}
          fill={color}
          fontFamily="monospace"
        >
          {count}/{total}
        </text>
      </svg>
      <span className="text-xs" style={{ color: "var(--color-muted)" }}>
        {count === total && total > 0
          ? <span style={{ color }}>All {label} visited ✓</span>
          : <>{count} of {total} {label} visited</>}
      </span>
    </div>
  );
}
