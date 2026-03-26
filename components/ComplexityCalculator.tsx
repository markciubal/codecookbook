"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { SORTING_ALGORITHMS, DATA_STRUCTURES } from "@/lib/catalog";

// ─── Big-O definitions ────────────────────────────────────────────────────

type BigOClass = {
  label: string;
  fn: (n: number) => number | null; // null = overflow/impossible
  description: string;
};

const BIG_O_CLASSES: BigOClass[] = [
  { label: "O(1)",      fn: ()  => 1,                   description: "Constant" },
  { label: "O(log n)",  fn: (n) => Math.log2(n),         description: "Logarithmic" },
  { label: "O(n)",      fn: (n) => n,                    description: "Linear" },
  { label: "O(n log n)",fn: (n) => n * Math.log2(n),     description: "Linearithmic" },
  { label: "O(n²)",     fn: (n) => n * n,                description: "Quadratic" },
  { label: "O(n³)",     fn: (n) => n * n * n,            description: "Cubic" },
  { label: "O(2ⁿ)",     fn: (n) => n <= 60 ? Math.pow(2, n) : null, description: "Exponential" },
];

const N_VALUES = [10, 100, 1_000, 10_000, 100_000, 1_000_000];

const OPS_PER_SEC = 1e9; // 10^9 ops/sec

function formatOps(val: number | null): { text: string; tier: "green" | "yellow" | "red" | "gray" } {
  if (val === null || !isFinite(val)) return { text: "∞", tier: "gray" };
  if (val > 1e30) return { text: "∞", tier: "gray" };
  if (val < 1_000_000) return { text: formatNum(val), tier: "green" };
  if (val < 1_000_000_000) return { text: formatNum(val), tier: "yellow" };
  return { text: formatNum(val), tier: "red" };
}

function formatNum(n: number): string {
  if (n < 1000) return Math.round(n).toLocaleString();
  if (n < 1e6) return (n / 1e3).toFixed(1) + "K";
  if (n < 1e9) return (n / 1e6).toFixed(1) + "M";
  if (n < 1e12) return (n / 1e9).toFixed(1) + "B";
  if (n < 1e15) return (n / 1e12).toFixed(1) + "T";
  return n.toExponential(2);
}

function formatTime(ops: number | null): string {
  if (ops === null || !isFinite(ops) || ops > 1e30) return "heat death";
  const secs = ops / OPS_PER_SEC;
  if (secs < 1e-6) return `${(secs * 1e9).toFixed(1)} ns`;
  if (secs < 1e-3) return `${(secs * 1e6).toFixed(1)} µs`;
  if (secs < 1)    return `${(secs * 1e3).toFixed(1)} ms`;
  if (secs < 60)   return `${secs.toFixed(2)} s`;
  if (secs < 3600) return `${(secs / 60).toFixed(1)} min`;
  if (secs < 86400) return `${(secs / 3600).toFixed(1)} hr`;
  if (secs < 3.15e7) return `${(secs / 86400).toFixed(1)} days`;
  if (secs < 3.15e10) return `${(secs / 3.15e7).toFixed(1)} yr`;
  return `${secs.toExponential(1)} s`;
}

const TIER_COLORS: Record<"green" | "yellow" | "red" | "gray", { bg: string; color: string }> = {
  green:  { bg: "rgba(78,124,82,0.13)",  color: "var(--color-state-sorted)" },
  yellow: { bg: "rgba(212,131,31,0.13)", color: "var(--color-state-compare)" },
  red:    { bg: "rgba(176,48,32,0.13)",  color: "var(--color-state-swap)" },
  gray:   { bg: "var(--color-surface-3)", color: "var(--color-muted)" },
};

// Map complexity label → sorted algorithm entries
function algosByComplexity(label: string) {
  const normalise = (s: string) => s.replace(/\s/g, "").toLowerCase();
  const norm = normalise(label);
  const sortingMatches = SORTING_ALGORITHMS.filter((a) => normalise(a.time) === norm || normalise(a.space) === norm);
  const dsMatches = DATA_STRUCTURES.filter((d) => normalise(d.time) === norm || normalise(d.space) === norm);
  return { sortingMatches, dsMatches };
}

// ─── Component ────────────────────────────────────────────────────────────

export default function ComplexityCalculator() {
  const [selectedClass, setSelectedClass] = useState<string>("O(n log n)");
  const [customN, setCustomN] = useState<string>("1000");

  const selectedBigO = BIG_O_CLASSES.find((c) => c.label === selectedClass) ?? BIG_O_CLASSES[3];
  const parsedN = Math.max(1, Math.min(1_000_000_000, parseInt(customN) || 1000));
  const customOps = selectedBigO.fn(parsedN);

  const { sortingMatches, dsMatches } = useMemo(() => algosByComplexity(selectedClass), [selectedClass]);

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <h1 className="text-base font-bold mb-1" style={{ color: "var(--color-text)" }}>
        Complexity Calculator
      </h1>
      <p className="text-xs mb-6" style={{ color: "var(--color-muted)" }}>
        Estimated operation counts for common Big-O classes. Click a row or use the selector below to explore.
      </p>

      {/* Reference table */}
      <section className="mb-8">
        <div className="w-full overflow-x-auto rounded-lg border" style={{ borderColor: "var(--color-border)" }}>
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr style={{ background: "var(--color-surface-2)", borderBottom: "1px solid var(--color-border)" }}>
                <th className="px-3 py-2 text-left font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: "var(--color-muted)" }}>
                  Complexity
                </th>
                <th className="px-3 py-2 text-left font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: "var(--color-muted)" }}>
                  Class
                </th>
                {N_VALUES.map((n) => (
                  <th
                    key={n}
                    className="px-3 py-2 text-right font-semibold uppercase tracking-wider font-mono whitespace-nowrap"
                    style={{ color: "var(--color-muted)" }}
                  >
                    n={formatNum(n)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {BIG_O_CLASSES.map((cls, rowIdx) => {
                const isSelected = cls.label === selectedClass;
                return (
                  <tr
                    key={cls.label}
                    onClick={() => setSelectedClass(cls.label)}
                    className="cursor-pointer transition-colors"
                    style={{
                      background: isSelected
                        ? "var(--color-accent-muted)"
                        : rowIdx % 2 === 0
                        ? "var(--color-surface-1)"
                        : "var(--color-surface-2)",
                      borderBottom: "1px solid var(--color-border)",
                      outline: isSelected ? `2px solid var(--color-accent)` : undefined,
                    }}
                  >
                    <td className="px-3 py-2 font-mono font-bold whitespace-nowrap" style={{ color: isSelected ? "var(--color-accent)" : "var(--color-text)" }}>
                      {cls.label}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap" style={{ color: "var(--color-muted)" }}>
                      {cls.description}
                    </td>
                    {N_VALUES.map((n) => {
                      // Cap exponential at n=30
                      const effectiveN = cls.label === "O(2ⁿ)" && n > 30 ? null : n;
                      const val = effectiveN === null ? null : cls.fn(effectiveN);
                      const { text, tier } = formatOps(val);
                      const { bg, color } = TIER_COLORS[tier];
                      return (
                        <td key={n} className="px-3 py-2 text-right font-mono whitespace-nowrap">
                          <span
                            className="inline-block px-1.5 py-0.5 rounded"
                            style={{ background: bg, color }}
                          >
                            {text}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Color legend */}
        <div className="flex flex-wrap gap-3 mt-2 text-[10px]" style={{ color: "var(--color-muted)" }}>
          <span className="flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-full" style={{ background: TIER_COLORS.green.color }} />
            &lt;1M ops (fast)
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-full" style={{ background: TIER_COLORS.yellow.color }} />
            1M–1B ops (slow)
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-full" style={{ background: TIER_COLORS.red.color }} />
            &gt;1B ops (very slow)
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-full" style={{ background: "var(--color-muted)" }} />
            overflow / ∞
          </span>
        </div>
      </section>

      {/* Interactive section */}
      <section
        className="rounded-xl border p-5 mb-8"
        style={{ background: "var(--color-surface-1)", borderColor: "var(--color-border)" }}
      >
        <h2 className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: "var(--color-muted)" }}>
          Custom Estimate
        </h2>
        <div className="flex flex-wrap gap-4 items-end mb-4">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase tracking-wider" style={{ color: "var(--color-muted)" }}>
              Complexity class
            </label>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="px-2.5 py-1.5 rounded border text-xs font-mono outline-none"
              style={{
                background: "var(--color-surface-2)",
                borderColor: "var(--color-border)",
                color: "var(--color-text)",
              }}
            >
              {BIG_O_CLASSES.map((c) => (
                <option key={c.label} value={c.label}>{c.label}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase tracking-wider" style={{ color: "var(--color-muted)" }}>
              n (input size)
            </label>
            <input
              type="number"
              min={1}
              max={1_000_000_000}
              value={customN}
              onChange={(e) => setCustomN(e.target.value)}
              className="px-2.5 py-1.5 rounded border text-xs font-mono outline-none w-36"
              style={{
                background: "var(--color-surface-2)",
                borderColor: "var(--color-border)",
                color: "var(--color-text)",
              }}
            />
          </div>
        </div>

        {customOps !== null && isFinite(customOps) ? (
          <div className="flex flex-wrap gap-6">
            <div>
              <p className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: "var(--color-muted)" }}>
                Estimated operations
              </p>
              <p className="text-2xl font-bold font-mono" style={{ color: "var(--color-accent)" }}>
                ~{formatNum(customOps)}
              </p>
              <p className="text-xs" style={{ color: "var(--color-muted)" }}>{customOps.toExponential(2)} ops</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: "var(--color-muted)" }}>
                Estimated time @ 10⁹ ops/sec
              </p>
              <p className="text-2xl font-bold font-mono" style={{ color: "var(--color-text)" }}>
                ~{formatTime(customOps)}
              </p>
            </div>
          </div>
        ) : (
          <div>
            <p className="text-sm font-mono" style={{ color: "var(--color-muted)" }}>
              Overflow — this n is too large for {selectedClass}.
            </p>
          </div>
        )}
      </section>

      {/* Algorithms by class */}
      <section className="mb-8">
        <h2 className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--color-muted)" }}>
          Algorithms with time complexity {selectedClass}
        </h2>
        {sortingMatches.length === 0 && dsMatches.length === 0 ? (
          <p className="text-xs" style={{ color: "var(--color-muted)" }}>
            No algorithms in the catalog have time complexity {selectedClass}.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {sortingMatches.map((a) => (
              <Link
                key={a.path}
                href={a.path}
                className="inline-flex flex-col gap-0.5 px-3 py-2 rounded-lg border text-xs"
                style={{
                  background: "var(--color-surface-2)",
                  borderColor: "var(--color-border)",
                  color: "var(--color-text)",
                }}
              >
                <span className="font-medium" style={{ color: "var(--color-accent)" }}>{a.name}</span>
                <span className="font-mono text-[10px]" style={{ color: "var(--color-muted)" }}>sorting · {a.time}</span>
              </Link>
            ))}
            {dsMatches.map((d) => (
              <Link
                key={d.path}
                href={d.path}
                className="inline-flex flex-col gap-0.5 px-3 py-2 rounded-lg border text-xs"
                style={{
                  background: "var(--color-surface-2)",
                  borderColor: "var(--color-border)",
                  color: "var(--color-text)",
                }}
              >
                <span className="font-medium" style={{ color: "var(--color-accent)" }}>{d.name}</span>
                <span className="font-mono text-[10px]" style={{ color: "var(--color-muted)" }}>data structure · {d.time}</span>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Note */}
      <footer className="mt-4 pt-4 border-t text-xs" style={{ borderColor: "var(--color-border)", color: "var(--color-muted)" }}>
        Estimates assume 1 ns per operation (10⁹ ops/sec). Real performance varies by constant factors, cache behavior, and hardware.
      </footer>
    </div>
  );
}
