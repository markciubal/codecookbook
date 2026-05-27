"use client";

import { useMemo } from "react";
import { Activity } from "lucide-react";
import type { SessionLog } from "./SessionCurves";

/*
 * Empirical Big-O fit per algorithm across the session.
 *
 * For each algo we gather every (n, meanTimeMs) point recorded across all
 * data types and fit log10(time) = k·log10(n) + b via plain least-squares.
 * The empirical exponent k is then compared against a theoretical exponent
 * derived from the algorithm's documented Big-O class. If the empirical
 * value drifts more than ~0.2 from the theoretical, we flag it — useful as
 * a sanity check that the implementation behaves like its complexity class
 * claims (e.g., a "O(n log n)" sort reading n^1.4 is suspicious).
 */
interface Props {
  log: SessionLog;
  algoNames: Record<string, string>;
  algoColors: Record<string, string>;
  /** ALGO_TIME from the parent — id → "O(n log n)" / "O(n²)" / etc. */
  algoTime: Record<string, string>;
}

export default function SessionBigO({ log, algoNames, algoColors, algoTime }: Props) {
  const rows = useMemo(() => {
    // Gather all (n, t) points per algo across every data type in the log.
    const byAlgo = new Map<string, { n: number; t: number }[]>();
    for (const dt of Object.keys(log)) {
      for (const id of Object.keys(log[dt] ?? {})) {
        const pts = byAlgo.get(id) ?? [];
        for (const [k, v] of Object.entries(log[dt][id] ?? {})) {
          const n = Number(k);
          if (n > 0 && v.meanTimeMs > 0) pts.push({ n, t: v.meanTimeMs });
        }
        byAlgo.set(id, pts);
      }
    }

    const out: { id: string; k: number | null; theoretical: number; theoreticalLabel: string; samples: number; diverges: boolean }[] = [];
    for (const [id, pts] of byAlgo.entries()) {
      const theoreticalLabel = algoTime[id] ?? "—";
      const theoretical = theoreticalSlope(theoreticalLabel);
      // Need ≥ 3 distinct n values for a fit to be meaningful.
      const distinctN = new Set(pts.map(p => p.n));
      if (distinctN.size < 3) {
        out.push({ id, k: null, theoretical, theoreticalLabel, samples: pts.length, diverges: false });
        continue;
      }
      const k = logLogSlope(pts);
      const diverges = Math.abs(k - theoretical) > 0.2;
      out.push({ id, k, theoretical, theoreticalLabel, samples: pts.length, diverges });
    }

    // Sort: those with a fit first (by slope ascending — closer to O(n) on top),
    // then the rest by sample count desc.
    return out.sort((a, b) => {
      const af = a.k != null, bf = b.k != null;
      if (af !== bf) return af ? -1 : 1;
      if (af && bf) return (a.k as number) - (b.k as number);
      return b.samples - a.samples;
    });
  }, [log, algoTime]);

  if (rows.length === 0) return null;

  return (
    <div
      className="mt-4 rounded-xl overflow-hidden"
      style={{ border: "1px solid var(--color-border)", background: "var(--color-surface-1)" }}
    >
      <div className="flex items-center gap-2 px-3 py-2" style={{ borderBottom: "1px solid var(--color-border)", background: "var(--color-surface-2)" }}>
        <Activity size={13} style={{ color: "var(--color-accent)" }} />
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-text)" }}>Empirical Big-O</span>
        <span className="text-[10px]" style={{ color: "var(--color-muted)", fontFamily: "monospace" }}>
          log-log fit across the session · flags when measured drift exceeds 0.2 from theoretical
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-3 gap-y-1 p-3">
        {rows.map(r => (
          <div
            key={r.id}
            className="flex items-center gap-1.5 rounded px-1.5 py-1"
            style={{
              background: r.diverges ? "rgba(239,83,80,0.10)" : "transparent",
              border: `1px solid ${r.diverges ? "rgba(239,83,80,0.35)" : "transparent"}`,
            }}
            title={
              r.k != null
                ? `${algoNames[r.id] ?? r.id}: empirical n^${r.k.toFixed(2)} vs theoretical ${r.theoreticalLabel} (≈ n^${r.theoretical.toFixed(2)})${r.diverges ? " — drift > 0.2, worth a look" : ""} · ${r.samples} samples`
                : `${algoNames[r.id] ?? r.id}: need ≥ 3 distinct n values to fit (${r.samples} samples so far)`
            }
          >
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: algoColors[r.id] ?? "#888", flexShrink: 0 }} />
            <span className="text-[11px] truncate" style={{ color: "var(--color-text)", flex: 1, minWidth: 0 }}>
              {algoNames[r.id] ?? r.id}
            </span>
            <span className="text-[10px] font-mono shrink-0" style={{ color: r.diverges ? "#ef5350" : "var(--color-accent)" }}>
              {r.k != null ? `n^${r.k.toFixed(2)}` : "—"}
            </span>
            <span className="text-[9px] font-mono shrink-0" style={{ color: "var(--color-muted)" }}>
              vs {r.theoreticalLabel.replace(/^O\(/, "").replace(/\)$/, "")}
            </span>
            {r.diverges && <span className="text-[10px]" style={{ color: "#ef5350" }} title="Measured slope drifts > 0.2 from theoretical">⚠</span>}
            {r.k != null && !r.diverges && <span className="text-[10px]" style={{ color: "#22c55e" }} title="Measured slope is within 0.2 of theoretical">✓</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

/* Plain least-squares log-log fit. Returns the slope k of log10(t) = k·log10(n) + b. */
function logLogSlope(pts: { n: number; t: number }[]): number {
  const xs = pts.map(p => Math.log10(p.n));
  const ys = pts.map(p => Math.log10(p.t));
  const n = xs.length;
  const xMean = xs.reduce((s, v) => s + v, 0) / n;
  const yMean = ys.reduce((s, v) => s + v, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - xMean;
    num += dx * (ys[i] - yMean);
    den += dx * dx;
  }
  return den === 0 ? 0 : num / den;
}

/* Map a textual Big-O class to an approximate log-log slope. Standard
 * conventions for typical n ranges in the benchmark; "O(n log n)" reads
 * around 1.1 in practice, "O(n log² n)" around 1.2, etc. */
function theoreticalSlope(bigO: string): number {
  if (!bigO) return 1.0;
  const norm = bigO.replace(/\s+/g, " ").trim();
  if (norm === "O(1)") return 0;
  if (norm === "O(log n)" || norm === "O(log log n)") return 0.05;
  if (norm === "O(k)") return 0;
  if (norm.includes("n log² n") || norm.includes("n log^2 n")) return 1.2;
  if (norm.includes("n log n")) return 1.1;
  if (norm === "O(n²)" || norm === "O(n^2)") return 2.0;
  if (norm === "O(nk)" || norm === "O(n+k)" || norm === "O(n)") return 1.0;
  return 1.0;
}
