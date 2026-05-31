"use client";

import type { StatMode } from "@/lib/benchmark-stats";

const MODES: { id: StatMode; label: string; title: string }[] = [
  { id: "min", label: "min", title: "Best (minimum) time across rounds" },
  { id: "median", label: "median", title: "Median time — robust central tendency" },
  { id: "mean", label: "mean", title: "Arithmetic mean across rounds" },
];

interface Props {
  value: StatMode;
  onChange: (mode: StatMode) => void;
}

export default function StatModePicker({ value, onChange }: Props) {
  return (
    <div
      className="flex rounded overflow-hidden"
      style={{ border: "1px solid var(--color-border)" }}
      title="Primary timing statistic for curves and rankings"
    >
      {MODES.map(m => (
        <button
          key={m.id}
          type="button"
          onClick={() => onChange(m.id)}
          title={m.title}
          style={{
            padding: "2px 8px",
            fontSize: 10,
            borderRadius: 0,
            cursor: "pointer",
            fontFamily: "monospace",
            background: value === m.id ? "var(--color-accent)" : "var(--color-surface-1)",
            border: "none",
            borderRight: "1px solid var(--color-border)",
            color: value === m.id ? "#fff" : "var(--color-muted)",
            fontWeight: value === m.id ? 600 : 400,
          }}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}
