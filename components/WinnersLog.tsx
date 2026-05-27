"use client";

import { useMemo, useState } from "react";
import { Trophy, Hash, Sigma, Type } from "lucide-react";

/*
 * Running log of who wins which size, broken out by data type. A measurement
 * is recorded at the END of each benchmark run — every successful (algo, size)
 * point contributes one sample to a rolling average keyed by data type. The
 * "winner" at a size is the algorithm with the lowest mean ms there.
 *
 * Shape: dataType → algoId → size(as string) → { meanMs, runs }.
 *
 * This component is purely presentational. The parent owns the state and
 * passes it in, along with helpers to look up algorithm names + colors.
 */
export type WinnerLogEntry = { meanMs: number; runs: number };
export type WinnerLog = Record<string, Record<string, Record<string, WinnerLogEntry>>>;

const DATA_TYPES: { id: string; label: string; icon: React.ReactNode; hint: string }[] = [
  { id: "integer", label: "Integers", icon: <Hash size={12} />, hint: "uniform int / int32 / counting-friendly" },
  { id: "float",   label: "Floats",   icon: <Sigma size={12} />, hint: "uniform double · radix territory" },
  { id: "string",  label: "Strings",  icon: <Type size={12} />, hint: "lex compare · multikey QS territory" },
];

/** Lightweight shape of the per-algo ghost-run history exposed by the parent.
 *  Each entry is one completed benchmark run; entries with the same `ts` were
 *  recorded in the same run (the parent stamps them all with one Date.now()). */
export type GhostRunsForRank = Record<string, Array<{
  ts: number;
  points: Array<{ n: number; timeMs: number; meanMs?: number }>;
}>>;

interface Props {
  log: WinnerLog;
  algoNames: Record<string, string>;
  algoColors: Record<string, string>;
  onClear: () => void;
  /** Optional per-(dataType, algo, n) mean aux-byte map (from SessionLog),
   *  used to compute the "in-place ✓ %" column on each leaderboard row. */
  spaceMap?: Record<string, Record<string, Record<string, { meanSpaceBytes: number }>>>;
  /** Optional ghost-run history; powers the rank-over-time sparkline. */
  ghostRuns?: GhostRunsForRank;
}

export default function WinnersLog({ log, algoNames, algoColors, onClear, spaceMap, ghostRuns }: Props) {
  // Local UI: which algorithm row is the user hovering / focusing on? Shared
  // across the three panels so you can spot the same sort everywhere at once.
  const [focusAlgo, setFocusAlgo] = useState<string | null>(null);

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
          rolling means across runs · per data type
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
          No runs recorded yet. Run a benchmark and the winners by size will accumulate here.
        </p>
      )}

      {hasAny && (
        <div className="grid grid-cols-1 lg:grid-cols-3" style={{ borderTop: "1px solid var(--color-border)" }}>
          {DATA_TYPES.map((dt, i) => (
            <DataTypePanel
              key={dt.id}
              dataType={dt}
              algoMap={log[dt.id] ?? {}}
              spaceMapForDt={spaceMap?.[dt.id]}
              rankHistoryById={rankHistoryById}
              algoNames={algoNames}
              algoColors={algoColors}
              focusAlgo={focusAlgo}
              setFocusAlgo={setFocusAlgo}
              borderLeft={i > 0}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function DataTypePanel({
  dataType, algoMap, spaceMapForDt, rankHistoryById, algoNames, algoColors, focusAlgo, setFocusAlgo, borderLeft,
}: {
  dataType: { id: string; label: string; icon: React.ReactNode; hint: string };
  algoMap: Record<string, Record<string, WinnerLogEntry>>;
  spaceMapForDt?: Record<string, Record<string, { meanSpaceBytes: number }>>;
  rankHistoryById?: Record<string, number[]>;
  algoNames: Record<string, string>;
  algoColors: Record<string, string>;
  focusAlgo: string | null;
  setFocusAlgo: (id: string | null) => void;
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

    // Per-algo aggregate: total runs, mean across all sizes (weighted by runs).
    const perAlgo = algos.map(id => {
      let weightedSum = 0, totalRuns = 0;
      const byN: Record<number, WinnerLogEntry | undefined> = {};
      for (const sz of sizes) {
        const e = algoMap[id][String(sz)];
        byN[sz] = e;
        if (e) {
          weightedSum += e.meanMs * e.runs;
          totalRuns += e.runs;
        }
      }
      return { id, byN, totalRuns, avgMs: totalRuns > 0 ? weightedSum / totalRuns : Infinity };
    });

    // Wins / 2nd / 3rd per size — top-3 algorithms by meanMs at each size.
    const winsByAlgo = new Map<string, number>();
    const seconds   = new Map<string, number>();
    const thirds    = new Map<string, number>();
    for (const sz of sizes) {
      const ranked = perAlgo
        .map(a => ({ id: a.id, ms: a.byN[sz]?.meanMs ?? Infinity }))
        .filter(r => Number.isFinite(r.ms))
        .sort((a, b) => a.ms - b.ms);
      if (ranked[0]) winsByAlgo.set(ranked[0].id, (winsByAlgo.get(ranked[0].id) ?? 0) + 1);
      if (ranked[1]) seconds  .set(ranked[1].id, (seconds  .get(ranked[1].id) ?? 0) + 1);
      if (ranked[2]) thirds   .set(ranked[2].id, (thirds   .get(ranked[2].id) ?? 0) + 1);
    }

    // Per-size winner list for the table below.
    const sizeWinners = sizes.map(sz => {
      let bestId: string | null = null, bestMs = Infinity;
      for (const a of perAlgo) {
        const e = a.byN[sz];
        if (e && e.meanMs < bestMs) { bestMs = e.meanMs; bestId = a.id; }
      }
      return { n: sz, winnerId: bestId, winnerMs: bestMs === Infinity ? null : bestMs };
    });

    // Throughput @ largest n (elements/sec) and in-place track record per algo.
    // In-place ratio: fraction of (algo, n) buckets where the mean aux memory
    // is < 1 byte/element. Same threshold as the in-place badge.
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
        if (e && sz > largest) { largest = sz; lastMs = e.meanMs; }
      }
      const throughput = largest > 0 && lastMs > 0 ? (largest / lastMs) * 1000 : null;
      // In-place %: count buckets with meanSpaceBytes / n < 1.
      let total = 0, inplace = 0;
      const spaceForAlgo = spaceMapForDt?.[a.id];
      if (spaceForAlgo) {
        for (const [k, v] of Object.entries(spaceForAlgo)) {
          const n = Number(k);
          if (n <= 0) continue;
          total++;
          if (v.meanSpaceBytes / n < 1) inplace++;
        }
      }
      const inplacePct = total > 0 ? (inplace / total) * 100 : null;
      // Pulse-circle inputs: mean memory at the largest recorded n so each row
      // can show its memory "mass" (diameter) relative to the heaviest sort in
      // the panel. lastMs becomes the pulse period — the row literally blinks
      // at the sort's rate.
      const spaceAtLargest = largest > 0 ? (spaceMapForDt?.[a.id]?.[String(largest)]?.meanSpaceBytes ?? 0) : 0;
      extras.set(a.id, {
        throughput, inplacePct,
        largestN: largest, timeAtLargest: lastMs, spaceAtLargest,
      });
    }
    // Heaviest memory consumer in this panel — sets the 20px upper bound that
    // every other algo's circle is scaled against. We default to 1 so an
    // empty-memory panel doesn't divide by zero (the circles just stay small).
    const maxSpaceInPanel = Math.max(1, ...[...extras.values()].map(e => e.spaceAtLargest));

    // Ranking: by wins desc, then by avgMs asc.
    const ranked = [...perAlgo].sort((a, b) => {
      const wb = (winsByAlgo.get(b.id) ?? 0) - (winsByAlgo.get(a.id) ?? 0);
      if (wb !== 0) return wb;
      return a.avgMs - b.avgMs;
    });
    const slowest = Math.max(...perAlgo.map(a => Number.isFinite(a.avgMs) ? a.avgMs : 0), 1);
    return { sizes, perAlgo, winsByAlgo, seconds, thirds, extras, maxSpaceInPanel, sizeWinners, ranked, slowest };
  }, [algoMap, spaceMapForDt]);

  const fmtMs = (v: number) => v < 1 ? `${v.toFixed(2)}ms` : v < 1000 ? `${v.toFixed(1)}ms` : `${(v/1000).toFixed(2)}s`;
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
              const isFocus = focusAlgo === a.id;
              const isTop = rank === 0 && wins > 0;
              const color = algoColors[a.id] ?? "#888";
              const pct = Number.isFinite(a.avgMs) && analysis.slowest > 0 ? (a.avgMs / analysis.slowest) * 100 : 0;
              const fmtThroughput = (eps: number) => eps >= 1e9 ? `${(eps/1e9).toFixed(1)}G/s`
                : eps >= 1e6 ? `${(eps/1e6).toFixed(1)}M/s`
                : eps >= 1e3 ? `${(eps/1e3).toFixed(0)}k/s`
                : `${eps.toFixed(0)}/s`;
              return (
                <button
                  key={a.id}
                  onMouseEnter={() => setFocusAlgo(a.id)}
                  onMouseLeave={() => setFocusAlgo(null)}
                  onClick={() => setFocusAlgo(isFocus ? null : a.id)}
                  className="text-left rounded px-1.5 py-1 transition-colors"
                  style={{
                    background: isFocus ? "color-mix(in srgb, var(--color-accent) 14%, transparent)" : "transparent",
                    border: `1px solid ${isFocus ? "var(--color-accent)" : "transparent"}`,
                    cursor: "pointer",
                  }}
                  title={`${algoNames[a.id] ?? a.id} — 1st×${wins} · 2nd×${second} · 3rd×${third} · ${fmtMs(a.avgMs)} weighted mean across ${a.totalRuns} samples${extra?.throughput != null ? ` · throughput ${fmtThroughput(extra.throughput)} at largest n` : ""}${extra?.inplacePct != null ? ` · in-place ${extra.inplacePct.toFixed(0)}% of buckets` : ""}`}
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
                          title={`${algoNames[a.id] ?? a.id} · n=${e.largestN.toLocaleString()} · aux mass ${e.spaceAtLargest > 0 ? fmtBytes(e.spaceAtLargest) : "~0 (in-place)"} · pulse @ ${e.timeAtLargest > 0 ? fmtMs(e.timeAtLargest) : "—"}`}
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
                            position: "relative",
                            width: fillDiameter, height: fillDiameter,
                            borderRadius: "50%", background: color, display: "block",
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
                  </div>
                  {/* Stats sub-line — podium · throughput · in-place. Only show
                      the slots that actually have data so empty rows stay quiet. */}
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
                </button>
              );
            })}
          </div>

          {/* Per-size winners — compact list */}
          <div className="mt-1 rounded" style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)" }}>
            <div className="px-2 py-1 text-[9px] uppercase tracking-wider" style={{ color: "var(--color-muted)", borderBottom: "1px solid var(--color-border)", fontFamily: "monospace" }}>
              winner by n
            </div>
            <div className="flex flex-col">
              {analysis.sizeWinners.map(w => {
                const isFocus = focusAlgo && w.winnerId === focusAlgo;
                const color = w.winnerId ? (algoColors[w.winnerId] ?? "#888") : "transparent";
                return (
                  <div
                    key={w.n}
                    className="flex items-center gap-1.5 px-2 py-0.5"
                    style={{
                      background: isFocus ? "color-mix(in srgb, var(--color-accent) 10%, transparent)" : "transparent",
                      fontSize: 10, fontFamily: "monospace",
                    }}
                    onMouseEnter={() => w.winnerId && setFocusAlgo(w.winnerId)}
                    onMouseLeave={() => setFocusAlgo(null)}
                    title={w.winnerId ? `n=${w.n.toLocaleString()} · ${algoNames[w.winnerId] ?? w.winnerId} · ${w.winnerMs != null ? fmtMs(w.winnerMs) : "—"}` : `n=${w.n.toLocaleString()} · no data`}
                  >
                    <span style={{ width: 5, height: 5, borderRadius: "50%", background: color, flexShrink: 0 }} />
                    <span style={{ color: "var(--color-muted)", minWidth: 38 }}>n={fmtN(w.n)}</span>
                    <span style={{ color: "var(--color-text)", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {w.winnerId ? (algoNames[w.winnerId] ?? w.winnerId) : "—"}
                    </span>
                    <span style={{ color: "var(--color-muted)" }}>{w.winnerMs != null ? fmtMs(w.winnerMs) : "—"}</span>
                  </div>
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

