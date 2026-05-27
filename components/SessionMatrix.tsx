"use client";

import { useMemo } from "react";
import { Swords } from "lucide-react";
import type { SessionLog } from "./SessionCurves";

/*
 * Session-wide head-to-head matrices — one for time, one for space — tallying
 * wins across EVERY (dataType, n) bucket where both algorithms have data. Each
 * cell shows the row's record against the column ("12W–3L") and is tinted by
 * win rate (green when the row dominates, red when it loses, faded when the
 * sample size is too small to read into).
 *
 * Same idea as the per-run PairMatrix in BenchmarkVisualizer, but aggregated
 * over the whole session — so a sort that consistently wins/loses across
 * every type and size shows a saturated row/column, while a "depends on the
 * data" specialist shows a checkerboard.
 */
interface Props {
  log: SessionLog;
  algoNames: Record<string, string>;
  algoColors: Record<string, string>;
}

type PairTally = { wins: number; losses: number; total: number };

export default function SessionMatrix({ log, algoNames, algoColors }: Props) {
  const { algos, timeMx, spaceMx, hasSpaceData } = useMemo(() => {
    // Gather every (dataType, n, algo) → value, indexed by bucket key "dt|n".
    const timeBuckets = new Map<string, Map<string, number>>(); // bucket → algo → meanMs
    const spaceBuckets = new Map<string, Map<string, number>>(); // bucket → algo → meanBytes
    const allAlgos = new Set<string>();
    for (const dt of Object.keys(log)) {
      const algoMap = log[dt] ?? {};
      for (const id of Object.keys(algoMap)) {
        allAlgos.add(id);
        for (const [k, v] of Object.entries(algoMap[id])) {
          const bucket = `${dt}|${k}`;
          if (v.meanTimeMs > 0) {
            if (!timeBuckets.has(bucket)) timeBuckets.set(bucket, new Map());
            timeBuckets.get(bucket)!.set(id, v.meanTimeMs);
          }
          // Space buckets are only meaningful when we actually measured >0
          // aux bytes; an algo that's purely in-place (~0) gets skipped here
          // (its head-to-head record on memory would be a sea of ties).
          if (v.meanSpaceBytes > 0) {
            if (!spaceBuckets.has(bucket)) spaceBuckets.set(bucket, new Map());
            spaceBuckets.get(bucket)!.set(id, v.meanSpaceBytes);
          }
        }
      }
    }

    // Build a pair tally for each (row, col).
    const buildMx = (buckets: Map<string, Map<string, number>>, algos: string[]) => {
      const mx = new Map<string, PairTally>(); // key = "row|col"
      for (const a of algos) for (const b of algos) {
        if (a === b) continue;
        mx.set(`${a}|${b}`, { wins: 0, losses: 0, total: 0 });
      }
      for (const cell of buckets.values()) {
        const entries = [...cell.entries()];
        for (let i = 0; i < entries.length; i++) {
          for (let j = 0; j < entries.length; j++) {
            if (i === j) continue;
            const [a, av] = entries[i];
            const [b, bv] = entries[j];
            const t = mx.get(`${a}|${b}`);
            if (!t) continue;
            t.total++;
            if (av < bv) t.wins++;
            else if (av > bv) t.losses++;
          }
        }
      }
      return mx;
    };

    const algoArr = [...allAlgos];
    const timeMx = buildMx(timeBuckets, algoArr);
    const spaceMx = buildMx(spaceBuckets, algoArr);

    // Rank algos by total wins on the TIME matrix (descending) so dominant
    // sorts sit at the top-left of the grid.
    const totalWinsByAlgo = new Map<string, number>();
    for (const a of algoArr) {
      let w = 0;
      for (const b of algoArr) if (a !== b) w += (timeMx.get(`${a}|${b}`)?.wins ?? 0);
      totalWinsByAlgo.set(a, w);
    }
    const sortedAlgos = algoArr
      .filter(a => (totalWinsByAlgo.get(a) ?? 0) > 0 || algoArr.some(b => b !== a && (timeMx.get(`${b}|${a}`)?.wins ?? 0) > 0))
      .sort((a, b) => (totalWinsByAlgo.get(b) ?? 0) - (totalWinsByAlgo.get(a) ?? 0));

    return {
      algos: sortedAlgos,
      timeMx,
      spaceMx,
      hasSpaceData: spaceBuckets.size > 0,
    };
  }, [log]);

  if (algos.length < 2) return null;

  return (
    <div className="mt-4 rounded-xl overflow-hidden" style={{ border: "1px solid var(--color-border)", background: "var(--color-surface-1)" }}>
      <div className="flex items-center gap-2 px-3 py-2" style={{ borderBottom: "1px solid var(--color-border)", background: "var(--color-surface-2)" }}>
        <Swords size={13} style={{ color: "var(--color-accent)" }} />
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-text)" }}>Head-to-head · session</span>
        <span className="text-[10px]" style={{ color: "var(--color-muted)", fontFamily: "monospace" }}>
          row vs column · wins across every (data type, n) bucket
        </span>
      </div>

      {/* Time on top row, Space on bottom row — always stacked vertically so
          each matrix gets the full panel width. Wider rows let longer algo
          names render without truncation. */}
      <div className="p-3 flex flex-col gap-3">
        <MatrixTable
          title="Time — head-to-head"
          algos={algos}
          mx={timeMx}
          algoNames={algoNames}
          algoColors={algoColors}
          fmtTitle={(r, c, t) => `${r} beat ${c} in ${t.wins} of ${t.total} buckets (${pct(t)}%) on time`}
        />
        {hasSpaceData ? (
          <MatrixTable
            title="Space — head-to-head"
            algos={algos}
            mx={spaceMx}
            algoNames={algoNames}
            algoColors={algoColors}
            fmtTitle={(r, c, t) => `${r} used less aux memory than ${c} in ${t.wins} of ${t.total} buckets (${pct(t)}%)`}
          />
        ) : (
          <div className="rounded-lg p-3 text-[11px]" style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)", color: "var(--color-muted)", fontFamily: "monospace" }}>
            <div className="font-semibold mb-1" style={{ color: "var(--color-text)" }}>Space — head-to-head</div>
            No aux-memory data yet. Once any algo allocates non-zero aux in a recorded run, its space record vs the others appears here.
          </div>
        )}
      </div>
    </div>
  );
}

function pct(t: PairTally): number {
  return t.total > 0 ? Math.round((t.wins / t.total) * 100) : 0;
}

function MatrixTable({
  title, algos, mx, algoNames, algoColors, fmtTitle,
}: {
  title: string;
  algos: string[];
  mx: Map<string, PairTally>;
  algoNames: Record<string, string>;
  algoColors: Record<string, string>;
  fmtTitle: (rowName: string, colName: string, t: PairTally) => string;
}) {
  return (
    <div className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--color-border)", background: "var(--color-surface-2)" }}>
      <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--color-text)", borderBottom: "1px solid var(--color-border)", background: "var(--color-surface-1)" }}>
        {title}
      </div>
      <div className="overflow-x-auto p-2">
        <table style={{ borderCollapse: "separate", borderSpacing: 2, fontFamily: "monospace", fontSize: 9 }}>
          <thead>
            <tr>
              <th />
              {algos.map(c => (
                <th key={c} style={{
                  padding: "0 5px 4px", textAlign: "center", minWidth: 50,
                  color: algoColors[c] ?? "var(--color-muted)",
                  fontWeight: 700, fontSize: 8,
                }}>
                  {(algoNames[c] ?? c).replace(" Sort", "")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {algos.map(r => (
              <tr key={r}>
                <td style={{
                  padding: "0 7px 0 0", textAlign: "right",
                  color: algoColors[r] ?? "var(--color-muted)",
                  fontWeight: 700, fontSize: 8, whiteSpace: "nowrap",
                }}>
                  {(algoNames[r] ?? r).replace(" Sort", "")}
                </td>
                {algos.map(c => {
                  if (r === c) {
                    return (
                      <td key={c} style={{
                        padding: "3px 5px", textAlign: "center",
                        background: "var(--color-surface-1)", borderRadius: 4,
                        color: "var(--color-border)", fontSize: 10,
                      }}>◆</td>
                    );
                  }
                  const t = mx.get(`${r}|${c}`) ?? { wins: 0, losses: 0, total: 0 };
                  if (t.total === 0) {
                    return (
                      <td key={c} style={{
                        padding: "3px 5px", textAlign: "center",
                        background: "transparent", color: "var(--color-muted)", opacity: 0.5,
                      }} title={`No overlapping (data type, n) buckets for ${algoNames[r] ?? r} vs ${algoNames[c] ?? c}`}>
                        —
                      </td>
                    );
                  }
                  // Color by win rate; fade out by sample size so a 1-of-1 row
                  // doesn't shout louder than a 47-of-50.
                  const rate = t.wins / t.total;
                  const sampleWeight = Math.min(1, t.total / 8);  // saturates at 8 buckets
                  const dist = Math.abs(rate - 0.5) * 2;          // 0…1 (how decisive)
                  const intensity = Math.min(0.75, 0.18 + dist * 0.5) * sampleWeight;
                  const bg = rate > 0.5
                    ? `rgba(78,160,90,${intensity})`
                    : rate < 0.5
                      ? `rgba(200,70,70,${intensity})`
                      : "rgba(160,160,160,0.15)";
                  const fg = rate >= 0.5 ? "#0d2e12" : "#2e0a0a";
                  return (
                    <td key={c} style={{
                      padding: "3px 6px", textAlign: "center",
                      background: bg, borderRadius: 4,
                      color: fg, fontWeight: 700, letterSpacing: "0.02em",
                    }} title={fmtTitle(algoNames[r] ?? r, algoNames[c] ?? c, t)}>
                      {t.wins}–{t.losses}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
