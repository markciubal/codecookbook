"use client";

import { useMemo, useState } from "react";
import { Trophy, Hash, Sigma, Type, X } from "lucide-react";
import type { SessionLog, GhostRuns } from "@/lib/benchmark-store";
import type { DetailedSessionLog } from "@/lib/detailed-session-log";
import { scenarioLabel } from "@/lib/detailed-session-log";
import { flattenDetailedLog, type FlatCell } from "@/lib/session-analytics";
import { bucketIsInPlace, catalogInPlace } from "@/lib/in-place-verdict";

/** @deprecated Use SessionLog — kept for import compatibility. */
export type WinnerLogEntry = { meanMs: number; runs: number };
export type WinnerLog = SessionLog;

const DATA_TYPES: { id: string; label: string; icon: React.ReactNode; hint: string }[] = [
  { id: "integer", label: "Integers", icon: <Hash size={12} />, hint: "uniform int / int32 / counting-friendly" },
  { id: "float",   label: "Floats",   icon: <Sigma size={12} />, hint: "uniform double · radix territory" },
  { id: "string",  label: "Strings",  icon: <Type size={12} />, hint: "lex compare · multikey QS territory" },
];

/** @deprecated Use GhostRuns from benchmark-store */
export type GhostRunsForRank = GhostRuns;

interface Props {
  log: SessionLog;
  /** Scenario-aware breakdown; when set, click an algo to expand run details. */
  detailedLog?: DetailedSessionLog;
  algoNames: Record<string, string>;
  algoColors: Record<string, string>;
  onClear: () => void;
  /** Optional ghost-run history; powers the rank-over-time sparkline. */
  ghostRuns?: GhostRuns;
}

export default function WinnersLog({ log, detailedLog, algoNames, algoColors, onClear, ghostRuns }: Props) {
  const [hoverAlgo, setHoverAlgo] = useState<string | null>(null);
  const [selectedAlgo, setSelectedAlgo] = useState<string | null>(null);

  // Rank-over-time per algorithm. The parent stamps all algos in one run with
  // the same Date.now(), so grouping ghostRuns by ts gives one "run" per group.
  // Within each run we rank algos by their mean ms and append the algo's rank
  // (1 = best) to its history. Most-recent rank is the last value in the array.
  const rankHistoryById = useMemo(() => {
    const out: Record<string, number[]> = {};
    if (!ghostRuns) return out;
    const byTs = new Map<number, Map<string, number>>();
    for (const id of Object.keys(ghostRuns)) {
      for (const run of ghostRuns[id]) {
        if (run.points.length === 0) continue;
        const m = run.points.reduce((s, p) => s + (p.meanMs ?? p.timeMs), 0) / run.points.length;
        if (!byTs.has(run.ts)) byTs.set(run.ts, new Map());
        byTs.get(run.ts)!.set(id, m);
      }
    }
    const tss = [...byTs.keys()].sort((a, b) => a - b);
    for (const ts of tss) {
      const ranked = [...byTs.get(ts)!.entries()].sort((a, b) => a[1] - b[1]);
      ranked.forEach(([id], idx) => {
        if (!out[id]) out[id] = [];
        out[id].push(idx + 1);
      });
    }
    return out;
  }, [ghostRuns]);

  const totalRuns = useMemo(() => {
    let max = 0;
    for (const dt of Object.keys(log)) {
      for (const algoMap of Object.values(log[dt] ?? {})) {
        for (const entry of Object.values(algoMap)) {
          if (entry.runs > max) max = entry.runs;
        }
      }
    }
    return max;
  }, [log]);

  const hasAny = totalRuns > 0;

  return (
    <div className="mt-4 rounded-xl overflow-hidden" style={{ border: "1px solid var(--color-border)", background: "var(--color-surface-1)" }}>
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2" style={{ borderBottom: "1px solid var(--color-border)", background: "var(--color-surface-2)" }}>
        <Trophy size={13} style={{ color: "#c9961a" }} />
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-text)" }}>Winners log</span>
        <span className="text-[10px]" style={{ color: "var(--color-muted)", fontFamily: "monospace" }}>
          rolling means · int / float / string · runs + permutation runs
        </span>
        {hasAny && (
          <button
            onClick={onClear}
            className="ml-auto text-[10px]"
            title="Clear the winners log (does not affect saved runs or benchmark settings)"
            style={{ background: "transparent", border: "1px solid var(--color-border)", borderRadius: 4, padding: "2px 7px", color: "var(--color-muted)", cursor: "pointer", fontFamily: "monospace" }}
          >
            Reset
          </button>
        )}
      </div>

      {!hasAny && (
        <p className="px-3 py-4 text-xs" style={{ color: "var(--color-muted)", fontFamily: "monospace", fontStyle: "italic" }}>
          No runs recorded yet. Run a benchmark or start Permutation Run — winners by size accumulate here from session data.
        </p>
      )}

      {hasAny && (
        <div className="grid grid-cols-1 lg:grid-cols-3" style={{ borderTop: "1px solid var(--color-border)" }}>
          {DATA_TYPES.map((dt, i) => (
            <DataTypePanel
              key={dt.id}
              dataType={dt}
              algoMap={log[dt.id] ?? {}}
              detailedLog={detailedLog}
              rankHistoryById={rankHistoryById}
              algoNames={algoNames}
              algoColors={algoColors}
              hoverAlgo={hoverAlgo}
              setHoverAlgo={setHoverAlgo}
              selectedAlgo={selectedAlgo}
              setSelectedAlgo={setSelectedAlgo}
              borderLeft={i > 0}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function DataTypePanel({
  dataType, algoMap, detailedLog, rankHistoryById, algoNames, algoColors,
  hoverAlgo, setHoverAlgo, selectedAlgo, setSelectedAlgo, borderLeft,
}: {
  dataType: { id: string; label: string; icon: React.ReactNode; hint: string };
  algoMap: SessionLog[string];
  detailedLog?: DetailedSessionLog;
  rankHistoryById?: Record<string, number[]>;
  algoNames: Record<string, string>;
  algoColors: Record<string, string>;
  hoverAlgo: string | null;
  setHoverAlgo: (id: string | null) => void;
  selectedAlgo: string | null;
  setSelectedAlgo: (id: string | null) => void;
  borderLeft: boolean;
}) {
  // Derive a normalized view of this dataType's data.
  const analysis = useMemo(() => {
    const algos = Object.keys(algoMap);
    if (algos.length === 0) return null;
    // All sizes seen.
    const sizeSet = new Set<number>();
    for (const algo of algos) {
      for (const k of Object.keys(algoMap[algo])) sizeSet.add(Number(k));
    }
    const sizes = [...sizeSet].sort((a, b) => a - b);

    // Per-algo aggregate: total runs, mean across all sizes (weighted by runs),
    // and totalTimeMs = Σ(meanTimeMs × runs) across every (algo, n) bucket.
    const perAlgo = algos.map(id => {
      let weightedSum = 0, totalRuns = 0;
      const byN: Record<number, import("@/lib/benchmark-store").SessionPoint | undefined> = {};
      for (const sz of sizes) {
        const e = algoMap[id][String(sz)];
        byN[sz] = e;
        if (e) {
          weightedSum += e.meanTimeMs * e.runs;
          totalRuns += e.runs;
        }
      }
      return {
        id, byN, totalRuns,
        avgMs: totalRuns > 0 ? weightedSum / totalRuns : Infinity,
        totalTimeMs: weightedSum,
      };
    });

    // Wins / 2nd / 3rd per size — top-3 algorithms by meanMs at each size.
    // We also track `largestWonN` per algo: the biggest n that algo placed
    // 1st at. That value becomes the primary rank key below — winning at the
    // largest measured n is the most asymptotically meaningful signal, so a
    // sort that wins at n=1M outranks one that wins at n=10k regardless of
    // who has more total wins.
    const winsByAlgo = new Map<string, number>();
    const seconds   = new Map<string, number>();
    const thirds    = new Map<string, number>();
    const largestWonN = new Map<string, number>();
    for (const sz of sizes) {
      const ranked = perAlgo
        .map(a => ({ id: a.id, ms: a.byN[sz]?.meanTimeMs ?? Infinity }))
        .filter(r => Number.isFinite(r.ms))
        .sort((a, b) => a.ms - b.ms);
      if (ranked[0]) {
        winsByAlgo.set(ranked[0].id, (winsByAlgo.get(ranked[0].id) ?? 0) + 1);
        // Track the largest size this algo has won at. Since `sizes` is
        // ascending, the LAST win we see for an algo is its largest — but
        // we use Math.max anyway to be defensive against ordering changes.
        largestWonN.set(ranked[0].id, Math.max(largestWonN.get(ranked[0].id) ?? 0, sz));
      }
      if (ranked[1]) seconds.set(ranked[1].id, (seconds.get(ranked[1].id) ?? 0) + 1);
      if (ranked[2]) thirds .set(ranked[2].id, (thirds .get(ranked[2].id) ?? 0) + 1);
    }

    // Per-size winner list for the table below. Sorted largest-n-first so
    // the most asymptotically meaningful winner is read first; tied with
    // the leaderboard's "largest n is most important" rule.
    const sizesDesc = [...sizes].sort((a, b) => b - a);
    const sizeWinners = sizesDesc.map(sz => {
      let bestId: string | null = null, bestMs = Infinity;
      for (const a of perAlgo) {
        const e = a.byN[sz];
        if (e && e.meanTimeMs < bestMs) { bestMs = e.meanTimeMs; bestId = a.id; }
      }
      return { n: sz, winnerId: bestId, winnerMs: bestMs === Infinity ? null : bestMs };
    });

    // Throughput @ largest n (elements/sec) and in-place track record per algo.
    // In-place ratio: fraction of (algo, n) buckets classified in-place (catalog
    // + < 1 aux byte/element when catalog allows in-place).
    //
    // Also collects the pulse-circle inputs (time + aux memory at the largest
    // recorded n) so each leaderboard row can render the same blinking-mass
    // indicator the per-run mini cards use.
    const extras = new Map<string, { throughput: number | null; inplacePct: number | null; largestN: number; timeAtLargest: number; spaceAtLargest: number }>();
    for (const a of perAlgo) {
      // Throughput at largest size where this algo has data.
      let largest = 0, lastMs = 0;
      for (const sz of sizes) {
        const e = a.byN[sz];
        if (e && sz > largest) { largest = sz; lastMs = e.meanTimeMs; }
      }
      const throughput = largest > 0 && lastMs > 0 ? (largest / lastMs) * 1000 : null;
      let total = 0, inplace = 0;
      for (const sz of sizes) {
        const e = a.byN[sz];
        if (!e || sz <= 0) continue;
        total++;
        if (bucketIsInPlace(a.id, e.meanSpaceBytes, sz)) inplace++;
      }
      const inplacePct = total > 0 ? (inplace / total) * 100 : null;
      const spaceAtLargest = largest > 0 ? (a.byN[largest]?.meanSpaceBytes ?? 0) : 0;
      extras.set(a.id, {
        throughput, inplacePct,
        largestN: largest, timeAtLargest: lastMs, spaceAtLargest,
      });
    }
    // Heaviest memory consumer in this panel — sets the 20px upper bound that
    // every other algo's circle is scaled against. We default to 1 so an
    // empty-memory panel doesn't divide by zero (the circles just stay small).
    const maxSpaceInPanel = Math.max(1, ...[...extras.values()].map(e => e.spaceAtLargest));

    // Ranking — three-level sort with "largest n a win was scored at" as the
    // primary key, because winning at n=1M is genuinely more important than
    // winning at n=10k for any asymptotic claim about an algorithm.
    //
    //   1. largestWonN desc   — won at the biggest size? you lead
    //   2. wins        desc   — across all sizes, who has the most 1sts?
    //   3. avgMs       asc    — run-weighted weighted-mean tiebreaker
    //
    // Algos that never won (largestWonN missing → 0) all share the same
    // primary key value, so they're ordered by wins + avgMs alone — same as
    // the old behaviour for those rows.
    const ranked = [...perAlgo].sort((a, b) => {
      const lb = (largestWonN.get(b.id) ?? 0) - (largestWonN.get(a.id) ?? 0);
      if (lb !== 0) return lb;
      const wb = (winsByAlgo.get(b.id) ?? 0) - (winsByAlgo.get(a.id) ?? 0);
      if (wb !== 0) return wb;
      return a.avgMs - b.avgMs;
    });
    const slowest = Math.max(...perAlgo.map(a => Number.isFinite(a.avgMs) ? a.avgMs : 0), 1);
    const panelTotalTimeMs = perAlgo.reduce((s, a) => s + a.totalTimeMs, 0);
    return {
      sizes, perAlgo, winsByAlgo, seconds, thirds, extras, maxSpaceInPanel,
      sizeWinners, ranked, slowest, panelTotalTimeMs, largestWonN,
    };
  }, [algoMap]);

  const detailedCells = useMemo(() => {
    if (!detailedLog) return [] as FlatCell[];
    return flattenDetailedLog(detailedLog).filter(c => c.dt === dataType.id);
  }, [detailedLog, dataType.id]);

  const toggleSelect = (id: string) => {
    setSelectedAlgo(selectedAlgo === id ? null : id);
  };

  const fmtMs = (v: number) => v < 1 ? `${v.toFixed(2)}ms` : v < 1000 ? `${v.toFixed(1)}ms` : `${(v/1000).toFixed(2)}s`;
  const fmtTotalTime = (ms: number) => {
    if (ms >= 3_600_000) return `${(ms / 3_600_000).toFixed(1)}h`;
    if (ms >= 60_000) return `${(ms / 60_000).toFixed(1)}m`;
    if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
    return `${ms.toFixed(0)}ms`;
  };
  const fmtN = (n: number) => n >= 1e6 ? `${(n/1e6).toFixed(n%1e6 ? 1 : 0)}M` : n >= 1e3 ? `${(n/1e3).toFixed(n%1e3 ? 1 : 0)}k` : String(n);

  return (
    <div
      className="p-3 flex flex-col gap-2"
      style={{ borderLeft: borderLeft ? "1px solid var(--color-border)" : "none" }}
    >
      {/* Panel header */}
      <div className="flex items-center gap-1.5 mb-1">
        <span style={{ color: "var(--color-accent)" }}>{dataType.icon}</span>
        <span className="text-xs font-semibold" style={{ color: "var(--color-text)" }}>{dataType.label}</span>
        <span className="text-[9px] ml-auto" style={{ color: "var(--color-muted)", fontFamily: "monospace" }}>
          {dataType.hint}
        </span>
      </div>

      {!analysis ? (
        <p className="text-[10px] mt-1" style={{ color: "var(--color-muted)", fontFamily: "monospace", fontStyle: "italic" }}>
          No {dataType.label.toLowerCase()} runs recorded yet.
        </p>
      ) : (
        <>
          {/* Leaderboard — wins per algo + avg ms bar */}
          <div className="flex flex-col gap-1">
            {analysis.ranked.slice(0, 8).map((a, rank) => {
              const wins   = analysis.winsByAlgo.get(a.id) ?? 0;
              const second = analysis.seconds  .get(a.id) ?? 0;
              const third  = analysis.thirds   .get(a.id) ?? 0;
              const extra  = analysis.extras   .get(a.id);
              const isHover = hoverAlgo === a.id;
              const isSelected = selectedAlgo === a.id;
              const isFocus = isHover || isSelected;
              const isTop = rank === 0 && wins > 0;
              const color = algoColors[a.id] ?? "#888";
              const pct = Number.isFinite(a.avgMs) && analysis.slowest > 0 ? (a.avgMs / analysis.slowest) * 100 : 0;
              const timeWeightPct = analysis.panelTotalTimeMs > 0
                ? (a.totalTimeMs / analysis.panelTotalTimeMs) * 100
                : 0;
              const fmtThroughput = (eps: number) => eps >= 1e9 ? `${(eps/1e9).toFixed(1)}G/s`
                : eps >= 1e6 ? `${(eps/1e6).toFixed(1)}M/s`
                : eps >= 1e3 ? `${(eps/1e3).toFixed(0)}k/s`
                : `${eps.toFixed(0)}/s`;
              return (
                <button
                  key={a.id}
                  onMouseEnter={() => setHoverAlgo(a.id)}
                  onMouseLeave={() => setHoverAlgo(null)}
                  onClick={() => toggleSelect(a.id)}
                  className="text-left rounded px-1.5 py-1 transition-colors"
                  style={{
                    background: isFocus ? "color-mix(in srgb, var(--color-accent) 14%, transparent)" : "transparent",
                    border: `1px solid ${isSelected ? "var(--color-accent)" : isFocus ? "color-mix(in srgb, var(--color-accent) 40%, transparent)" : "transparent"}`,
                    cursor: "pointer",
                  }}
                  title={`Click for run breakdown · ${algoNames[a.id] ?? a.id} — ${(analysis.largestWonN.get(a.id) ?? 0) > 0 ? `won at largest n=${fmtN(analysis.largestWonN.get(a.id)!)} (primary rank key) · ` : ""}1st×${wins} · 2nd×${second} · 3rd×${third} · ${fmtMs(a.avgMs)} weighted mean · Σ ${fmtTotalTime(a.totalTimeMs)} total time (${timeWeightPct.toFixed(0)}% of panel) across ${a.totalRuns} samples${extra?.throughput != null ? ` · throughput ${fmtThroughput(extra.throughput)} at largest n` : ""}${extra?.inplacePct != null ? ` · in-place ${extra.inplacePct.toFixed(0)}% of buckets` : ""}`}
                >
                  <div className="flex items-center gap-1.5">
                    {isTop && <Trophy size={9} style={{ color: "#c9961a", flexShrink: 0 }} />}
                    {/* Memory-mass / sort-speed indicator — same encoding as
                        the All Algorithms mini cards: a 20px ring, with the
                        filled inner circle's diameter scaled to this algo's
                        aux memory ÷ heaviest aux in the panel, and the pulse
                        period set to the sort's mean ms (clamped 150–5000 ms).
                        Bigger circle = more memory; faster blink = faster sort. */}
                    {(() => {
                      const e = extra;
                      if (!e) return <span style={{ width: 6, height: 6, borderRadius: "50%", background: color, flexShrink: 0 }} />;
                      const fillDiameter = analysis!.maxSpaceInPanel > 0
                        ? Math.max(1, (e.spaceAtLargest / analysis!.maxSpaceInPanel) * 20)
                        : 1;
                      const pulseDuration = e.timeAtLargest > 0
                        ? Math.max(150, Math.min(5000, e.timeAtLargest))
                        : 0;
                      const fmtBytes = (b: number) => b >= 1_048_576 ? `${(b/1_048_576).toFixed(1)}MB`
                        : b >= 1024 ? `${(b/1024).toFixed(1)}KB`
                        : `${Math.round(b)}B`;
                      return (
                        <span
                          title={`${algoNames[a.id] ?? a.id} · n=${e.largestN.toLocaleString()} · aux mass ${fmtBytes(e.spaceAtLargest)}${catalogInPlace(a.id) === false ? " (not in-place)" : e.spaceAtLargest / Math.max(1, e.largestN) < 1 ? " (in-place)" : ""} · pulse @ ${e.timeAtLargest > 0 ? fmtMs(e.timeAtLargest) : "—"}`}
                          style={{
                            position: "relative", width: 20, height: 20,
                            display: "inline-flex", alignItems: "center", justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >
                          {/* Outer ring — sets the "20px max" reference. */}
                          <span style={{
                            position: "absolute", inset: 0, borderRadius: "50%",
                            background: "var(--color-surface-3)",
                            border: "1px solid var(--color-border)",
                          }} />
                          {/* Inner mass — diameter encodes memory used. */}
                          <span style={{
                            position: "absolute",
                            left: "50%",
                            top: "50%",
                            transform: "translate(-50%, -50%)",
                            width: fillDiameter,
                            height: fillDiameter,
                            borderRadius: "50%",
                            background: color,
                            display: "block",
                            ...(pulseDuration > 0 ? {
                              animationName: "cc-pulse",
                              animationDuration: `${pulseDuration}ms`,
                              animationTimingFunction: "steps(1, end)",
                              animationIterationCount: "infinite",
                            } : {}),
                          }} />
                        </span>
                      );
                    })()}
                    <span className="text-[10px] truncate" style={{ color: "var(--color-text)", flex: 1, minWidth: 0 }}>
                      {algoNames[a.id] ?? a.id}
                    </span>
                    <span className="text-[9px] font-mono shrink-0" style={{ color: "#c9961a", minWidth: 22, textAlign: "right" }}>
                      {wins > 0 ? `×${wins}` : ""}
                    </span>
                    <span className="text-[9px] font-mono shrink-0" style={{ color: "var(--color-muted)", minWidth: 48, textAlign: "right" }}>
                      {Number.isFinite(a.avgMs) ? fmtMs(a.avgMs) : "—"}
                    </span>
                    <span
                      className="text-[9px] font-mono shrink-0"
                      style={{ color: "var(--color-muted)", minWidth: 44, textAlign: "right", opacity: 0.85 }}
                      title={`Σ mean×runs = ${fmtTotalTime(a.totalTimeMs)} (${timeWeightPct.toFixed(1)}% of ${dataType.label.toLowerCase()} panel time)`}
                    >
                      {a.totalTimeMs > 0 ? fmtTotalTime(a.totalTimeMs) : "—"}
                    </span>
                  </div>
                  {/* Stats sub-line — podium · throughput · in-place · time weight. */}
                  <div className="flex items-center gap-1.5 mt-0.5" style={{ fontSize: 8, fontFamily: "monospace", color: "var(--color-muted)" }}>
                    <span title="1st / 2nd / 3rd place counts across all recorded sizes">
                      <span style={{ color: "#c9961a" }}>{wins}</span>
                      <span style={{ opacity: 0.6 }}>·</span>
                      <span style={{ color: "#9aa0a6" }}>{second}</span>
                      <span style={{ opacity: 0.6 }}>·</span>
                      <span style={{ color: "#cd7f32" }}>{third}</span>
                    </span>
                    {extra?.throughput != null && (
                      <>
                        <span style={{ opacity: 0.4 }}>·</span>
                        <span title="Throughput at the largest recorded n">
                          {fmtThroughput(extra.throughput)}
                        </span>
                      </>
                    )}
                    {extra?.inplacePct != null && (
                      <>
                        <span style={{ opacity: 0.4 }}>·</span>
                        <span
                          title="Fraction of (algo, n) buckets that measured < 1 aux byte/element"
                          style={{ color: extra.inplacePct >= 90 ? "#22c55e" : extra.inplacePct >= 50 ? "#ffb74d" : "#ef5350" }}
                        >
                          IP {extra.inplacePct.toFixed(0)}%
                        </span>
                      </>
                    )}
                    {a.totalTimeMs > 0 && (
                      <>
                        <span style={{ opacity: 0.4 }}>·</span>
                        <span title={`Share of total measured sort time in this ${dataType.label.toLowerCase()} panel`}>
                          wt {timeWeightPct.toFixed(0)}%
                        </span>
                      </>
                    )}
                    {/* Rank-over-time sparkline, pushed to the right edge. */}
                    {rankHistoryById?.[a.id] && rankHistoryById[a.id].length >= 2 && (
                      <span className="ml-auto inline-flex items-center gap-0.5" title={`Rank over the last ${rankHistoryById[a.id].length} runs (1 = fastest)`}>
                        <span style={{ opacity: 0.55, fontSize: 7 }}>rank</span>
                        <RankSparkline values={rankHistoryById[a.id]} color={color} />
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 h-0.5 rounded-full overflow-hidden" style={{ background: "var(--color-surface-3)" }}>
                    <div className="h-full" style={{ width: `${pct}%`, background: color, opacity: 0.7 }} />
                  </div>
                  {a.totalTimeMs > 0 && (
                    <div
                      className="mt-0.5 h-0.5 rounded-full overflow-hidden relative"
                      style={{ background: "var(--color-surface-3)" }}
                      title={`Time weight: ${timeWeightPct.toFixed(1)}% of panel total (${fmtTotalTime(a.totalTimeMs)})`}
                    >
                      <div
                        className="absolute top-0 bottom-0 w-px"
                        style={{
                          left: `${(100 / Math.E).toFixed(2)}%`,
                          background: "#4db6ac",
                          opacity: 0.55,
                          zIndex: 1,
                        }}
                        title={`1/e ≈ ${(100 / Math.E).toFixed(1)}% — Euler reference`}
                      />
                      <div
                        className="h-full relative"
                        style={{
                          width: `${timeWeightPct}%`,
                          background: color,
                          opacity: 0.35,
                          backgroundImage: "repeating-linear-gradient(90deg, transparent, transparent 3px, rgba(255,255,255,0.15) 3px, rgba(255,255,255,0.15) 4px)",
                        }}
                      />
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {selectedAlgo && analysis.perAlgo.some(a => a.id === selectedAlgo) && (
            <AlgoRunDetails
              algoId={selectedAlgo}
              dataType={dataType}
              algoMap={algoMap[selectedAlgo] ?? {}}
              cells={detailedCells.filter(c => c.algo === selectedAlgo)}
              algoNames={algoNames}
              algoColors={algoColors}
              onClose={() => setSelectedAlgo(null)}
            />
          )}

          {/* Per-size winners — compact list, sorted largest n at top so the
              most asymptotically meaningful winner is read first (matches the
              leaderboard's primary rank key above). */}
          <div className="mt-1 rounded" style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)" }}>
            <div className="px-2 py-1 text-[9px] uppercase tracking-wider flex items-center justify-between" style={{ color: "var(--color-muted)", borderBottom: "1px solid var(--color-border)", fontFamily: "monospace" }}>
              <span>winner by n</span>
              <span title="Sorted by n descending — largest = most important" style={{ opacity: 0.7 }}>n ↓</span>
            </div>
            <div className="flex flex-col">
              {analysis.sizeWinners.map(w => {
                const isHover = hoverAlgo && w.winnerId === hoverAlgo;
                const isSelected = selectedAlgo && w.winnerId === selectedAlgo;
                const color = w.winnerId ? (algoColors[w.winnerId] ?? "#888") : "transparent";
                return (
                  <button
                    type="button"
                    key={w.n}
                    className="flex items-center gap-1.5 px-2 py-0.5 w-full text-left"
                    style={{
                      background: isHover || isSelected ? "color-mix(in srgb, var(--color-accent) 10%, transparent)" : "transparent",
                      fontSize: 10, fontFamily: "monospace",
                      border: "none",
                      cursor: w.winnerId ? "pointer" : "default",
                    }}
                    onMouseEnter={() => w.winnerId && setHoverAlgo(w.winnerId)}
                    onMouseLeave={() => setHoverAlgo(null)}
                    onClick={() => w.winnerId && toggleSelect(w.winnerId)}
                    title={w.winnerId ? `Click for run breakdown · n=${w.n.toLocaleString()} · ${algoNames[w.winnerId] ?? w.winnerId} · ${w.winnerMs != null ? fmtMs(w.winnerMs) : "—"}` : `n=${w.n.toLocaleString()} · no data`}
                  >
                    <span style={{ width: 5, height: 5, borderRadius: "50%", background: color, flexShrink: 0 }} />
                    <span style={{ color: "var(--color-muted)", minWidth: 38 }}>n={fmtN(w.n)}</span>
                    <span style={{ color: "var(--color-text)", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {w.winnerId ? (algoNames[w.winnerId] ?? w.winnerId) : "—"}
                    </span>
                    <span style={{ color: "var(--color-muted)" }}>{w.winnerMs != null ? fmtMs(w.winnerMs) : "—"}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Summary footer */}
          <p className="text-[9px] mt-1" style={{ color: "var(--color-muted)", fontFamily: "monospace" }}>
            {analysis.sizes.length} size{analysis.sizes.length === 1 ? "" : "s"} · {analysis.perAlgo.reduce((s, a) => s + a.totalRuns, 0)} samples
          </p>
        </>
      )}
    </div>
  );
}

function fmtBytes(b: number): string {
  if (b >= 1_048_576) return `${(b / 1_048_576).toFixed(1)} MB`;
  if (b >= 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${Math.round(b)} B`;
}

function fmtMsDetail(v: number): string {
  if (v >= 1000) return `${(v / 1000).toFixed(2)} s`;
  if (v >= 100) return `${v.toFixed(0)} ms`;
  if (v >= 10) return `${v.toFixed(1)} ms`;
  return `${v.toFixed(2)} ms`;
}

function fmtNDetail(n: number): string {
  if (n >= 1_000_000) return `${n.toLocaleString()} (${n >= 1e6 && n % 1e6 === 0 ? `${n / 1e6}M` : `${(n / 1e6).toFixed(1)}M`})`;
  if (n >= 1_000) return `${n.toLocaleString()} (${n >= 1e3 && n % 1e3 === 0 ? `${n / 1e3}k` : `${(n / 1e3).toFixed(1)}k`})`;
  return n.toLocaleString();
}

function fmtTotalTimeDetail(ms: number): string {
  if (ms >= 3_600_000) return `${(ms / 3_600_000).toFixed(2)}h`;
  if (ms >= 60_000) return `${(ms / 60_000).toFixed(1)}m`;
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)}s`;
  return `${ms.toFixed(1)}ms`;
}

/** Expanded breakdown for a selected algorithm — scenario × n buckets. */
function AlgoRunDetails({
  algoId, dataType, algoMap, cells, algoNames, algoColors, onClose,
}: {
  algoId: string;
  dataType: { id: string; label: string };
  algoMap: Record<string, import("@/lib/benchmark-store").SessionPoint | undefined>;
  cells: FlatCell[];
  algoNames: Record<string, string>;
  algoColors: Record<string, string>;
  onClose: () => void;
}) {
  const color = algoColors[algoId] ?? "#888";

  const rows = useMemo(() => {
    if (cells.length > 0) {
      return [...cells].sort((a, b) => {
        if (a.scenario !== b.scenario) return a.scenario.localeCompare(b.scenario);
        return a.n - b.n;
      });
    }
    const fallback: FlatCell[] = [];
    for (const nStr of Object.keys(algoMap)) {
      const pt = algoMap[nStr];
      if (!pt || pt.runs <= 0) continue;
      fallback.push({
        dt: dataType.id,
        scenario: "legacy",
        algo: algoId,
        n: Number(nStr),
        point: pt,
      });
    }
    return fallback.sort((a, b) => a.n - b.n);
  }, [cells, algoMap, dataType.id, algoId]);

  const byScenario = useMemo(() => {
    const map = new Map<string, FlatCell[]>();
    for (const r of rows) {
      const list = map.get(r.scenario) ?? [];
      list.push(r);
      map.set(r.scenario, list);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [rows]);

  const totalSamples = rows.reduce((s, r) => s + r.point.runs, 0);
  const totalTimeMs = rows.reduce((s, r) => s + r.point.meanTimeMs * r.point.runs, 0);

  return (
    <div
      className="rounded mt-1 overflow-hidden"
      style={{ background: "var(--color-surface-2)", border: `1px solid ${color}55` }}
    >
      <div
        className="flex items-center gap-2 px-2 py-1.5"
        style={{ borderBottom: "1px solid var(--color-border)", background: "color-mix(in srgb, var(--color-accent) 6%, transparent)" }}
      >
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
        <span className="text-[10px] font-semibold truncate" style={{ color: "var(--color-text)", flex: 1 }}>
          {algoNames[algoId] ?? algoId}
        </span>
        <span className="text-[9px] font-mono shrink-0" style={{ color: "var(--color-muted)" }}>
          {dataType.label} · {totalSamples} sample{totalSamples !== 1 ? "s" : ""}
          {totalTimeMs > 0 && <> · Σ {fmtTotalTimeDetail(totalTimeMs)}</>}
        </span>
        <button
          type="button"
          onClick={onClose}
          title="Close run details"
          style={{
            background: "transparent", border: "none", padding: 2, cursor: "pointer",
            color: "var(--color-muted)", display: "flex", alignItems: "center",
          }}
        >
          <X size={12} />
        </button>
      </div>

      <div className="max-h-48 overflow-y-auto">
        {byScenario.map(([scenario, scenarioRows]) => (
          <div key={scenario}>
            <div
              className="px-2 py-0.5 text-[9px] uppercase tracking-wider sticky top-0"
              style={{
                color: "var(--color-muted)",
                fontFamily: "monospace",
                background: "var(--color-surface-2)",
                borderBottom: "1px solid var(--color-border)",
              }}
            >
              {scenarioLabel(scenario)}
            </div>
            {scenarioRows.map(r => {
              const pt = r.point;
              const perEl = r.n > 0 ? pt.meanSpaceBytes / r.n : 0;
              const bucketTotalMs = pt.meanTimeMs * pt.runs;
              return (
                <div
                  key={`${scenario}-${r.n}`}
                  className="px-2 py-1 flex flex-col gap-0.5"
                  style={{ fontSize: 9, fontFamily: "monospace", borderBottom: "1px solid color-mix(in srgb, var(--color-border) 50%, transparent)" }}
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <span style={{ color: "var(--color-text)", fontWeight: 600, minWidth: 72 }}>
                      n={fmtNDetail(r.n)}
                    </span>
                    <span style={{ color: color }}>{fmtMsDetail(pt.meanTimeMs)}</span>
                    <span style={{ color: "var(--color-muted)" }}>
                      aux {fmtBytes(pt.meanSpaceBytes)}
                      {bucketIsInPlace(algoId, pt.meanSpaceBytes, r.n) ? " · in-place" : ` · ${perEl.toFixed(1)} B/el`}
                    </span>
                    <span style={{ color: "var(--color-muted)", marginLeft: "auto" }}>
                      {pt.runs} run{pt.runs !== 1 ? "s" : ""}
                      {bucketTotalMs > 0 && <> · Σ {fmtTotalTimeDetail(bucketTotalMs)}</>}
                    </span>
                  </div>
                  {(pt.minMs > 0 || pt.p95Ms > 0 || pt.stdDevMs > 0) && (
                    <div className="flex gap-2 flex-wrap" style={{ color: "var(--color-muted)", fontSize: 8 }}>
                      {pt.minMs > 0 && <span>min {fmtMsDetail(pt.minMs)}</span>}
                      {pt.p95Ms > 0 && pt.p95Ms !== pt.meanTimeMs && <span>p95 {fmtMsDetail(pt.p95Ms)}</span>}
                      {pt.stdDevMs > 0 && <span>σ {fmtMsDetail(pt.stdDevMs)}</span>}
                      {pt.noiseCv > 0 && <span>CV {(pt.noiseCv * 100).toFixed(0)}%</span>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
        {rows.length === 0 && (
          <p className="px-2 py-2 text-[9px] italic" style={{ color: "var(--color-muted)", fontFamily: "monospace" }}>
            No recorded samples for this algorithm yet.
          </p>
        )}
      </div>
    </div>
  );
}

/* Tiny rank-over-time sparkline. Y-axis is rank (1 = best, drawn at the TOP);
   X-axis is run index (oldest left, newest right). Most-recent point dotted. */
function RankSparkline({ values, color }: { values: number[]; color: string }) {
  const W = 36, H = 10, pad = 1.5;
  if (values.length < 2) return null;
  const min = Math.min(...values), max = Math.max(...values);
  const span = Math.max(1, max - min);
  const stepX = (W - pad * 2) / (values.length - 1);
  // Invert y so rank 1 sits at the top of the sparkline.
  const y = (r: number) => pad + ((r - min) / span) * (H - pad * 2);
  const pts = values.map((v, i) => `${(pad + i * stepX).toFixed(1)},${y(v).toFixed(1)}`);
  const last = values[values.length - 1];
  return (
    <svg width={W} height={H} style={{ display: "block" }} preserveAspectRatio="none">
      <path d={`M${pts.join(" L")}`} fill="none" stroke={color} strokeWidth={1.2} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={pad + (values.length - 1) * stepX} cy={y(last)} r={1.6} fill={color} />
    </svg>
  );
}

