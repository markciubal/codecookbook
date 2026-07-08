"use client";

import { useMemo, useState } from "react";
import {
  LayoutDashboard, Grid3X3, Swords, Sparkles, Trophy, ChevronDown,
} from "lucide-react";
import type { DetailedSessionLog } from "@/lib/detailed-session-log";
import { scenarioLabel } from "@/lib/detailed-session-log";
import {
  flattenDetailedLog,
  filterCells,
  computeRankings,
  computePairwiseMatrix,
  detectSpecialists,
  buildMasterGrid,
  listBuckets,
  type AlgoRanking,
} from "@/lib/session-analytics";

type Tab = "overview" | "grid" | "h2h" | "specialists";

interface Props {
  log: DetailedSessionLog;
  runCount: number;
  sessionStartedAt: number | null;
  algoNames: Record<string, string>;
  algoColors: Record<string, string>;
  onClear?: () => void;
}

const DT_OPTIONS = [
  { id: "all", label: "All types" },
  { id: "integer", label: "Integers" },
  { id: "float", label: "Floats" },
  { id: "string", label: "Strings" },
];

const RANK_COLORS: Record<number, string> = {
  1: "#2e7d32",
  2: "#558b2f",
  3: "#9e9d24",
};

function fmtN(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}k`;
  return String(n);
}

function fmtMs(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)}s`;
  if (ms >= 100) return `${ms.toFixed(0)}ms`;
  if (ms >= 10) return `${ms.toFixed(1)}ms`;
  return `${ms.toFixed(2)}ms`;
}

function fmtAge(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m`;
  return `${Math.floor(h / 24)}d ${h % 24}h`;
}

function pct(w: number, t: number): number {
  return t > 0 ? Math.round((w / t) * 100) : 0;
}

export default function SessionCommandCenter({
  log,
  runCount,
  sessionStartedAt,
  algoNames,
  algoColors,
  onClear,
}: Props) {
  const [tab, setTab] = useState<Tab>("overview");
  const [dtFilter, setDtFilter] = useState("all");
  const [scenarioFilter, setScenarioFilter] = useState("all");
  const [metric, setMetric] = useState<"time" | "space">("time");

  const allCells = useMemo(() => flattenDetailedLog(log), [log]);

  const scenarios = useMemo(
    () => [...new Set(allCells.map(c => c.scenario))].sort(),
    [allCells],
  );

  const cells = useMemo(
    () => filterCells(allCells, {
      dt: dtFilter === "all" ? undefined : dtFilter,
      scenario: scenarioFilter === "all" ? undefined : scenarioFilter,
    }),
    [allCells, dtFilter, scenarioFilter],
  );

  const rankings = useMemo(() => computeRankings(cells, metric), [cells, metric]);
  const pairwise = useMemo(() => computePairwiseMatrix(cells, metric), [cells, metric]);
  const specialists = useMemo(
    () => detectSpecialists(cells, scenarioLabel),
    [cells],
  );
  const buckets = useMemo(() => listBuckets(cells), [cells]);
  const gridAlgos = useMemo(() => rankings.map(r => r.id), [rankings]);
  const masterGrid = useMemo(
    () => buildMasterGrid(cells, gridAlgos, buckets, metric),
    [cells, gridAlgos, buckets, metric],
  );

  const totalSamples = useMemo(() => {
    let n = 0;
    for (const c of allCells) n += c.point.runs;
    return n;
  }, [allCells]);

  const hasData = totalSamples > 0 || runCount > 0;
  if (!hasData) return null;

  const generalist = specialists.find(p => p.isGeneralist);
  const topThree = rankings.slice(0, 3);

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "overview", label: "Overview", icon: <LayoutDashboard size={12} /> },
    { id: "grid", label: "Master grid", icon: <Grid3X3 size={12} /> },
    { id: "h2h", label: "Head-to-head", icon: <Swords size={12} /> },
    { id: "specialists", label: "Specialists", icon: <Sparkles size={12} /> },
  ];

  return (
    <div
      className="mt-4 rounded-xl overflow-hidden"
      style={{ border: "1px solid var(--color-border)", background: "var(--color-surface-1)" }}
    >
      {/* Header */}
      <div
        className="flex flex-wrap items-center gap-2 px-3 py-2"
        style={{ borderBottom: "1px solid var(--color-border)", background: "var(--color-surface-2)" }}
      >
        <LayoutDashboard size={13} style={{ color: "var(--color-accent)" }} />
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-text)" }}>
          Command center
        </span>
        <span className="text-[10px]" style={{ color: "var(--color-muted)", fontFamily: "monospace" }}>
          {runCount} runs · {totalSamples} samples · {buckets.length} buckets
          {sessionStartedAt ? ` · ${fmtAge(Date.now() - sessionStartedAt)}` : ""}
        </span>
        <div className="flex-1" />
        {onClear && (
          <button
            type="button"
            onClick={onClear}
            className="text-[10px] px-2 py-0.5 rounded"
            style={{ border: "1px solid var(--color-border)", color: "var(--color-muted)", background: "var(--color-surface-1)" }}
          >
            Clear
          </button>
        )}
      </div>

      {/* Filters + tabs */}
      <div
        className="flex flex-wrap items-center gap-2 px-3 py-2"
        style={{ borderBottom: "1px solid var(--color-border)", background: "var(--color-surface-1)" }}
      >
        <div className="flex gap-1">
          {tabs.map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-semibold uppercase tracking-wide"
              style={{
                background: tab === t.id ? "var(--color-accent)" : "var(--color-surface-2)",
                color: tab === t.id ? "#fff" : "var(--color-muted)",
                border: `1px solid ${tab === t.id ? "var(--color-accent)" : "var(--color-border)"}`,
              }}
            >
              {t.icon}{t.label}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <FilterSelect
          value={dtFilter}
          onChange={setDtFilter}
          options={DT_OPTIONS}
          label="Type"
        />
        <FilterSelect
          value={scenarioFilter}
          onChange={setScenarioFilter}
          options={[
            { id: "all", label: "All scenarios" },
            ...scenarios.map(s => ({ id: s, label: scenarioLabel(s) })),
          ]}
          label="Scenario"
        />
        <FilterSelect
          value={metric}
          onChange={v => setMetric(v as "time" | "space")}
          options={[
            { id: "time", label: "Time" },
            { id: "space", label: "Space" },
          ]}
          label="Metric"
        />
      </div>

      <div className="p-3">
        {tab === "overview" && (
          <OverviewTab
            topThree={topThree}
            generalist={generalist}
            rankings={rankings}
            algoNames={algoNames}
            algoColors={algoColors}
            metric={metric}
          />
        )}
        {tab === "grid" && (
          <MasterGridTab
            buckets={buckets}
            algos={gridAlgos}
            grid={masterGrid}
            algoNames={algoNames}
            algoColors={algoColors}
            metric={metric}
          />
        )}
        {tab === "h2h" && (
          <HeadToHeadTab
            pairwise={pairwise}
            algoNames={algoNames}
            algoColors={algoColors}
            metric={metric}
          />
        )}
        {tab === "specialists" && (
          <SpecialistsTab
            profiles={specialists}
            algoNames={algoNames}
            algoColors={algoColors}
          />
        )}
      </div>
    </div>
  );
}

function FilterSelect({
  value, onChange, options, label,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { id: string; label: string }[];
  label: string;
}) {
  return (
    <label className="flex items-center gap-1 text-[10px]" style={{ color: "var(--color-muted)" }}>
      {label}
      <span className="relative inline-flex items-center">
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          className="appearance-none pl-2 pr-6 py-1 rounded text-[10px] font-mono"
          style={{
            background: "var(--color-surface-2)",
            border: "1px solid var(--color-border)",
            color: "var(--color-text)",
          }}
        >
          {options.map(o => (
            <option key={o.id} value={o.id}>{o.label}</option>
          ))}
        </select>
        <ChevronDown size={10} className="absolute right-1 pointer-events-none" style={{ color: "var(--color-muted)" }} />
      </span>
    </label>
  );
}

function OverviewTab({
  topThree, generalist, rankings, algoNames, algoColors, metric,
}: {
  topThree: AlgoRanking[];
  generalist: ReturnType<typeof detectSpecialists>[number] | undefined;
  rankings: AlgoRanking[];
  algoNames: Record<string, string>;
  algoColors: Record<string, string>;
  metric: "time" | "space";
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
      {/* Podium */}
      <div
        className="rounded-lg p-3 lg:col-span-1"
        style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)" }}
      >
        <p className="text-[10px] uppercase tracking-wider flex items-center gap-1.5 mb-2" style={{ color: "var(--color-muted)" }}>
          <Trophy size={11} style={{ color: "#c9961a" }} /> Overall leaders
        </p>
        {topThree.length === 0 ? (
          <p className="text-[11px]" style={{ color: "var(--color-muted)" }}>Run a benchmark to populate rankings.</p>
        ) : (
          <div className="space-y-2">
            {topThree.map((r, i) => (
              <div key={r.id} className="flex items-center gap-2">
                <span className="text-[10px] font-bold w-4" style={{ color: i === 0 ? "#c9961a" : "var(--color-muted)" }}>
                  {i + 1}
                </span>
                <span className="text-xs font-semibold truncate flex-1" style={{ color: algoColors[r.id] ?? "var(--color-text)" }}>
                  {algoNames[r.id] ?? r.id}
                </span>
                <span className="text-[10px] font-mono" style={{ color: "var(--color-muted)" }}>
                  {r.wins}W · {pct(r.wins, r.buckets)}%
                </span>
              </div>
            ))}
          </div>
        )}
        {generalist && (
          <p className="text-[10px] mt-3 pt-2" style={{ borderTop: "1px solid var(--color-border)", color: "var(--color-muted)" }}>
            <Sparkles size={10} className="inline mr-1" style={{ color: "var(--color-accent)" }} />
            Generalist:{" "}
            <strong style={{ color: algoColors[generalist.algoId] ?? "var(--color-text)" }}>
              {algoNames[generalist.algoId] ?? generalist.algoId}
            </strong>
            {" "}(avg rank {generalist.avgRank.toFixed(2)})
          </p>
        )}
      </div>

      {/* Full ranking table */}
      <div
        className="rounded-lg overflow-hidden lg:col-span-2"
        style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)" }}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-[10px]" style={{ fontFamily: "monospace" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--color-border)", color: "var(--color-muted)" }}>
                <th className="text-left px-2 py-1.5">#</th>
                <th className="text-left px-2 py-1.5">Algorithm</th>
                <th className="text-right px-2 py-1.5">Wins</th>
                <th className="text-right px-2 py-1.5">2nd</th>
                <th className="text-right px-2 py-1.5">3rd</th>
                <th className="text-right px-2 py-1.5">Win%</th>
                <th className="text-right px-2 py-1.5">Avg rank</th>
                <th className="text-right px-2 py-1.5">{metric === "time" ? "Avg time" : "Avg aux"}</th>
              </tr>
            </thead>
            <tbody>
              {rankings.map((r, i) => (
                <tr key={r.id} style={{ borderBottom: "1px solid var(--color-border)" }}>
                  <td className="px-2 py-1" style={{ color: "var(--color-muted)" }}>{i + 1}</td>
                  <td className="px-2 py-1 font-semibold" style={{ color: algoColors[r.id] ?? "var(--color-text)" }}>
                    {algoNames[r.id] ?? r.id}
                  </td>
                  <td className="px-2 py-1 text-right">{r.wins}</td>
                  <td className="px-2 py-1 text-right" style={{ color: "var(--color-muted)" }}>{r.second}</td>
                  <td className="px-2 py-1 text-right" style={{ color: "var(--color-muted)" }}>{r.third}</td>
                  <td className="px-2 py-1 text-right">{pct(r.wins, r.buckets)}%</td>
                  <td className="px-2 py-1 text-right">{r.avgRank === Infinity ? "—" : r.avgRank.toFixed(2)}</td>
                  <td className="px-2 py-1 text-right">
                    {metric === "time"
                      ? (r.avgTimeMs === Infinity ? "—" : fmtMs(r.avgTimeMs))
                      : (r.avgSpaceBytes > 0 ? `${fmtN(r.avgSpaceBytes)}B` : "—")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function MasterGridTab({
  buckets, algos, grid, algoNames, algoColors, metric,
}: {
  buckets: ReturnType<typeof listBuckets>;
  algos: string[];
  grid: ReturnType<typeof buildMasterGrid>;
  algoNames: Record<string, string>;
  algoColors: Record<string, string>;
  metric: "time" | "space";
}) {
  if (buckets.length === 0 || algos.length === 0) {
    return (
      <p className="text-[11px]" style={{ color: "var(--color-muted)" }}>
        No bucket data for the current filters.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <p className="text-[10px] mb-2" style={{ color: "var(--color-muted)" }}>
        Rank per (type · scenario · n) bucket — 1 = fastest{metric === "space" ? " / lowest aux" : ""}. Green = win, yellow = podium.
      </p>
      <table style={{ borderCollapse: "separate", borderSpacing: 2, fontFamily: "monospace", fontSize: 9 }}>
        <thead>
          <tr>
            <th className="text-left px-1" style={{ color: "var(--color-muted)", fontSize: 8 }}>Algo</th>
            {buckets.map(b => (
              <th
                key={b.key}
                className="px-1 pb-1 text-center"
                style={{ color: "var(--color-muted)", fontSize: 7, minWidth: 44, maxWidth: 56 }}
                title={`${b.dt} · ${scenarioLabel(b.scenario)} · n=${fmtN(b.n)}`}
              >
                <div>{b.dt.slice(0, 3)}</div>
                <div>{fmtN(b.n)}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {algos.map(algo => (
            <tr key={algo}>
              <td
                className="pr-2 text-right whitespace-nowrap"
                style={{ color: algoColors[algo] ?? "var(--color-text)", fontWeight: 700, fontSize: 8 }}
              >
                {(algoNames[algo] ?? algo).replace(" Sort", "")}
              </td>
              {buckets.map(b => {
                const cell = grid.get(algo)?.get(b.key);
                const rank = cell?.rank ?? null;
                const bg = rank != null
                  ? (RANK_COLORS[rank] ?? (rank <= 5 ? `rgba(158,157,36,${0.15 + (6 - rank) * 0.05})` : "var(--color-surface-2)"))
                  : "var(--color-surface-2)";
                return (
                  <td
                    key={b.key}
                    className="text-center rounded"
                    style={{
                      padding: "3px 2px",
                      background: rank != null && rank <= 3 ? bg : "var(--color-surface-2)",
                      color: rank === 1 ? "#fff" : rank != null && rank <= 3 ? "#fff" : "var(--color-muted)",
                      border: "1px solid var(--color-border)",
                      fontWeight: rank === 1 ? 700 : 400,
                    }}
                    title={cell?.val != null
                      ? `${algoNames[algo] ?? algo}: rank ${rank ?? "—"}, ${metric === "time" ? fmtMs(cell.val) : fmtN(cell.val) + "B"}`
                      : "No data"}
                  >
                    {rank ?? "·"}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function HeadToHeadTab({
  pairwise, algoNames, algoColors, metric,
}: {
  pairwise: ReturnType<typeof computePairwiseMatrix>;
  algoNames: Record<string, string>;
  algoColors: Record<string, string>;
  metric: "time" | "space";
}) {
  const { algos, get } = pairwise;
  if (algos.length < 2) {
    return (
      <p className="text-[11px]" style={{ color: "var(--color-muted)" }}>
        Need at least two algorithms with overlapping buckets.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <p className="text-[10px] mb-2" style={{ color: "var(--color-muted)" }}>
        Row vs column — wins on {metric} across filtered buckets.
      </p>
      <table style={{ borderCollapse: "separate", borderSpacing: 2, fontFamily: "monospace", fontSize: 9 }}>
        <thead>
          <tr>
            <th />
            {algos.map(c => (
              <th key={c} style={{ padding: "0 5px 4px", color: algoColors[c], fontWeight: 700, fontSize: 8 }}>
                {(algoNames[c] ?? c).replace(" Sort", "")}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {algos.map(r => (
            <tr key={r}>
              <td style={{ padding: "0 7px 0 0", textAlign: "right", color: algoColors[r], fontWeight: 700, fontSize: 8 }}>
                {(algoNames[r] ?? r).replace(" Sort", "")}
              </td>
              {algos.map(c => {
                if (r === c) {
                  return (
                    <td key={c} style={{ padding: "3px 5px", textAlign: "center", background: "var(--color-surface-2)", borderRadius: 4, color: "var(--color-border)" }}>
                      ◆
                    </td>
                  );
                }
                const t = get(r, c);
                const p = pct(t.wins, t.total);
                const hue = p >= 60 ? 120 : p >= 40 ? 60 : 0;
                const sat = t.total >= 3 ? 0.45 : 0.15;
                return (
                  <td
                    key={c}
                    title={`${r} beat ${c} in ${t.wins}/${t.total} buckets (${p}%)`}
                    style={{
                      padding: "3px 5px",
                      textAlign: "center",
                      borderRadius: 4,
                      background: `hsla(${hue}, 50%, 40%, ${sat})`,
                      color: t.total >= 3 ? "var(--color-text)" : "var(--color-muted)",
                      minWidth: 44,
                    }}
                  >
                    {t.total > 0 ? `${t.wins}–${t.losses}` : "—"}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SpecialistsTab({
  profiles, algoNames, algoColors,
}: {
  profiles: ReturnType<typeof detectSpecialists>;
  algoNames: Record<string, string>;
  algoColors: Record<string, string>;
}) {
  const withTags = profiles.filter(p => p.tags.length > 0 || p.isGeneralist);
  if (withTags.length === 0) {
    return (
      <p className="text-[11px]" style={{ color: "var(--color-muted)" }}>
        Not enough data yet to detect specialists. Run more benchmarks across types and scenarios.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {withTags.map(p => (
        <div
          key={p.algoId}
          className="rounded-lg px-3 py-2"
          style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)" }}
        >
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold" style={{ color: algoColors[p.algoId] ?? "var(--color-text)" }}>
              {algoNames[p.algoId] ?? p.algoId}
            </span>
            {p.isGeneralist && (
              <span
                className="text-[9px] px-1.5 py-0.5 rounded uppercase font-bold"
                style={{ background: "var(--color-accent)", color: "#fff" }}
              >
                Generalist
              </span>
            )}
            <span className="text-[10px] font-mono" style={{ color: "var(--color-muted)" }}>
              {pct(Math.round(p.overallWinRate * p.overallBuckets), p.overallBuckets)}% overall · avg rank {p.avgRank === Infinity ? "—" : p.avgRank.toFixed(2)}
            </span>
          </div>
          {p.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {p.tags.map(tag => (
                <span
                  key={tag.id}
                  title={tag.description}
                  className="text-[9px] px-1.5 py-0.5 rounded"
                  style={{
                    background: tag.dominant ? "rgba(46,125,50,0.25)" : "var(--color-surface-1)",
                    border: `1px solid ${tag.dominant ? "#2e7d32" : "var(--color-border)"}`,
                    color: tag.dominant ? "#81c784" : "var(--color-muted)",
                  }}
                >
                  {tag.label} · {pct(tag.wins, tag.total)}%
                </span>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
