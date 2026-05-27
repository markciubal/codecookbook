"use client";

import { useMemo } from "react";
import { Trophy, BarChart2, Sparkles } from "lucide-react";
import type { SessionLog } from "./SessionCurves";

/*
 * Three at-a-glance numbers + one-line callouts that summarize the entire
 * session. Sits above the WinnersLog leaderboards and uses the same persistent
 * SessionLog the curves draw from, so no extra accounting is needed beyond the
 * runCount + first-run-timestamp the parent passes in.
 */
interface Props {
  log: SessionLog;
  runCount: number;
  sessionStartedAt: number | null;
  algoNames: Record<string, string>;
  algoColors: Record<string, string>;
}

const DT_ORDER = ["integer", "float", "string"] as const;
const DT_LABEL: Record<string, string> = { integer: "Integer", float: "Float", string: "String" };

export default function SessionSummary({ log, runCount, sessionStartedAt, algoNames, algoColors }: Props) {
  const stats = useMemo(() => {
    // Totals: samples (= sum of `runs` cells), elements (sum of n × runs).
    let totalSamples = 0;
    let totalElements = 0;
    for (const dt of Object.keys(log)) {
      for (const id of Object.keys(log[dt] ?? {})) {
        for (const [k, v] of Object.entries(log[dt][id] ?? {})) {
          totalSamples += v.runs;
          totalElements += Number(k) * v.runs;
        }
      }
    }

    // Best-of per data type: algo with the most "wins" (lowest meanTimeMs at a
    // given n), summed across the sizes recorded for that data type.
    const bestPerType: Record<string, { id: string; wins: number; totalN: number } | null> = {};
    for (const dt of DT_ORDER) {
      const algoMap = log[dt] ?? {};
      const algos = Object.keys(algoMap);
      if (algos.length === 0) { bestPerType[dt] = null; continue; }
      const sizeSet = new Set<number>();
      for (const id of algos) for (const k of Object.keys(algoMap[id])) sizeSet.add(Number(k));
      const winsByAlgo = new Map<string, number>();
      for (const sz of sizeSet) {
        let best: string | null = null;
        let bestMs = Infinity;
        for (const id of algos) {
          const e = algoMap[id][String(sz)];
          if (e && e.meanTimeMs < bestMs) { bestMs = e.meanTimeMs; best = id; }
        }
        if (best) winsByAlgo.set(best, (winsByAlgo.get(best) ?? 0) + 1);
      }
      const top = [...winsByAlgo.entries()].sort((a, b) => b[1] - a[1])[0];
      bestPerType[dt] = top ? { id: top[0], wins: top[1], totalN: sizeSet.size } : null;
    }

    // Generalist: lowest average rank across every (dataType, n) bucket the
    // algorithm appeared in. We require ≥ 3 samples to be eligible so a single
    // lucky run doesn't crown a generalist.
    const rankAcc = new Map<string, { sum: number; count: number }>();
    for (const dt of Object.keys(log)) {
      const algoMap = log[dt] ?? {};
      const algos = Object.keys(algoMap);
      const sizeSet = new Set<number>();
      for (const id of algos) for (const k of Object.keys(algoMap[id])) sizeSet.add(Number(k));
      for (const sz of sizeSet) {
        const ranked = algos
          .map(id => ({ id, e: algoMap[id][String(sz)] }))
          .filter(x => x.e)
          .sort((a, b) => a.e!.meanTimeMs - b.e!.meanTimeMs);
        ranked.forEach((r, i) => {
          const rec = rankAcc.get(r.id) ?? { sum: 0, count: 0 };
          rec.sum += i + 1;
          rec.count += 1;
          rankAcc.set(r.id, rec);
        });
      }
    }
    const generalist = [...rankAcc.entries()]
      .filter(([, v]) => v.count >= 3)
      .map(([id, v]) => ({ id, avg: v.sum / v.count, n: v.count }))
      .sort((a, b) => a.avg - b.avg)[0] ?? null;

    return { totalSamples, totalElements, bestPerType, generalist };
  }, [log]);

  if (runCount === 0 && stats.totalSamples === 0) return null;

  const ageMs = sessionStartedAt ? Date.now() - sessionStartedAt : 0;
  const fmtAge = (ms: number) => {
    const s = Math.floor(ms / 1000);
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ${m % 60}m`;
    return `${Math.floor(h / 24)}d ${h % 24}h`;
  };
  const fmtN = (n: number) =>
    n >= 1e12 ? `${(n / 1e12).toFixed(2)}T` :
    n >= 1e9  ? `${(n / 1e9 ).toFixed(2)}B` :
    n >= 1e6  ? `${(n / 1e6 ).toFixed(1)}M` :
    n >= 1e3  ? `${(n / 1e3 ).toFixed(1)}k` :
    String(n);

  return (
    <div
      className="mt-4 rounded-xl p-3 grid grid-cols-1 lg:grid-cols-3 gap-3"
      style={{ border: "1px solid var(--color-border)", background: "var(--color-surface-2)" }}
    >
      {/* Activity */}
      <div>
        <p className="text-[10px] uppercase tracking-wider flex items-center gap-1.5" style={{ color: "var(--color-muted)" }}>
          <BarChart2 size={11} /> Activity
        </p>
        <p className="text-xs mt-1.5" style={{ color: "var(--color-text)", fontFamily: "monospace" }}>
          <Big>{runCount}</Big> run{runCount === 1 ? "" : "s"} · <Big>{fmtN(stats.totalSamples)}</Big> sort samples
        </p>
        <p className="text-xs mt-0.5" style={{ color: "var(--color-text)", fontFamily: "monospace" }}>
          <Big>{fmtN(stats.totalElements)}</Big> total elements sorted
        </p>
        {sessionStartedAt != null && (
          <p className="text-[10px] mt-1" style={{ color: "var(--color-muted)", fontFamily: "monospace" }}>
            session age: {fmtAge(ageMs)}
          </p>
        )}
      </div>

      {/* Generalist */}
      <div>
        <p className="text-[10px] uppercase tracking-wider flex items-center gap-1.5" style={{ color: "var(--color-muted)" }}>
          <Sparkles size={11} /> Generalist of the session
        </p>
        {stats.generalist ? (
          <div className="mt-1.5 flex items-center gap-2">
            <Trophy size={11} style={{ color: "#c9961a", flexShrink: 0 }} />
            <span style={{ width: 7, height: 7, borderRadius: 2, background: algoColors[stats.generalist.id] ?? "#888", flexShrink: 0 }} />
            <span className="text-sm font-semibold truncate" style={{ color: "var(--color-text)" }}>
              {algoNames[stats.generalist.id] ?? stats.generalist.id}
            </span>
            <span className="text-[10px] font-mono ml-auto" style={{ color: "var(--color-muted)" }}>
              avg rank {stats.generalist.avg.toFixed(2)} · n={stats.generalist.n}
            </span>
          </div>
        ) : (
          <p className="text-[10px] mt-1.5" style={{ color: "var(--color-muted)", fontStyle: "italic" }}>
            need more cross-bucket data
          </p>
        )}
        <p className="text-[10px] mt-1" style={{ color: "var(--color-muted)" }}>
          lowest average rank across every (data type, n) bucket
        </p>
      </div>

      {/* Best per type */}
      <div>
        <p className="text-[10px] uppercase tracking-wider flex items-center gap-1.5" style={{ color: "var(--color-muted)" }}>
          <Trophy size={11} /> Best for each type
        </p>
        <div className="flex flex-col gap-0.5 mt-1.5">
          {DT_ORDER.map(dt => {
            const b = stats.bestPerType[dt];
            return (
              <p key={dt} className="text-xs" style={{ color: "var(--color-text)", fontFamily: "monospace", display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ color: "var(--color-muted)", minWidth: 56 }}>{DT_LABEL[dt]}:</span>
                {b ? (
                  <>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: algoColors[b.id] ?? "#888", display: "inline-block", flexShrink: 0 }} />
                    <span className="truncate" style={{ color: "var(--color-text)", flex: 1, minWidth: 0 }}>{algoNames[b.id] ?? b.id}</span>
                    <span style={{ color: "var(--color-muted)", fontSize: 9 }}>{b.wins}/{b.totalN}</span>
                  </>
                ) : <span style={{ opacity: 0.5 }}>—</span>}
              </p>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* Small inline emphasis for the big numbers in the totals card. */
function Big({ children }: { children: React.ReactNode }) {
  return <span style={{ color: "var(--color-accent)", fontWeight: 700 }}>{children}</span>;
}
