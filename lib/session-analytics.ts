/**
 * Analytics over DetailedSessionLog — rankings, pairwise W/L, specialist profiles.
 */
import type { SessionPoint } from "./benchmark-store";
import type { DetailedSessionLog } from "./detailed-session-log";

export type FlatCell = {
  dt: string;
  scenario: string;
  algo: string;
  n: number;
  point: SessionPoint;
};

export type PairTally = { wins: number; losses: number; ties: number; total: number };

export type AlgoRanking = {
  id: string;
  wins: number;
  second: number;
  third: number;
  buckets: number;
  avgRank: number;
  avgTimeMs: number;
  avgSpaceBytes: number;
  winRate: number;
};

export type SpecialistTag = {
  id: string;
  label: string;
  description: string;
  winRate: number;
  wins: number;
  total: number;
  dominant: boolean;
};

export type SpecialistProfile = {
  algoId: string;
  overallWinRate: number;
  overallBuckets: number;
  avgRank: number;
  tags: SpecialistTag[];
  isGeneralist: boolean;
};

export type BucketMeta = {
  key: string;
  dt: string;
  scenario: string;
  n: number;
};

export function flattenDetailedLog(log: DetailedSessionLog): FlatCell[] {
  const cells: FlatCell[] = [];
  for (const dt of Object.keys(log)) {
    for (const scenario of Object.keys(log[dt] ?? {})) {
      for (const algo of Object.keys(log[dt]![scenario] ?? {})) {
        for (const nStr of Object.keys(log[dt]![scenario]![algo] ?? {})) {
          const pt = log[dt]![scenario]![algo]![nStr];
          if (!pt || pt.runs <= 0 || pt.meanTimeMs <= 0) continue;
          cells.push({
            dt,
            scenario,
            algo,
            n: Number(nStr),
            point: pt,
          });
        }
      }
    }
  }
  return cells;
}

export function listBuckets(cells: FlatCell[]): BucketMeta[] {
  const seen = new Map<string, BucketMeta>();
  for (const c of cells) {
    const key = `${c.dt}|${c.scenario}|${c.n}`;
    if (!seen.has(key)) {
      seen.set(key, { key, dt: c.dt, scenario: c.scenario, n: c.n });
    }
  }
  return [...seen.values()].sort((a, b) => {
    if (a.dt !== b.dt) return a.dt.localeCompare(b.dt);
    if (a.scenario !== b.scenario) return a.scenario.localeCompare(b.scenario);
    return a.n - b.n;
  });
}

export function filterCells(
  cells: FlatCell[],
  opts: { dt?: string; scenario?: string; minN?: number; maxN?: number },
): FlatCell[] {
  return cells.filter(c => {
    if (opts.dt && c.dt !== opts.dt) return false;
    if (opts.scenario && c.scenario !== opts.scenario) return false;
    if (opts.minN != null && c.n < opts.minN) return false;
    if (opts.maxN != null && c.n > opts.maxN) return false;
    return true;
  });
}

function bucketGroups(cells: FlatCell[]): Map<string, FlatCell[]> {
  const groups = new Map<string, FlatCell[]>();
  for (const c of cells) {
    const key = `${c.dt}|${c.scenario}|${c.n}`;
    const arr = groups.get(key) ?? [];
    arr.push(c);
    groups.set(key, arr);
  }
  return groups;
}

export function computeRankings(cells: FlatCell[], metric: "time" | "space" = "time"): AlgoRanking[] {
  const groups = bucketGroups(cells);
  const algos = [...new Set(cells.map(c => c.algo))];
  const wins = new Map<string, number>();
  const second = new Map<string, number>();
  const third = new Map<string, number>();
  const rankSum = new Map<string, number>();
  const rankCount = new Map<string, number>();
  const timeSum = new Map<string, number>();
  const spaceSum = new Map<string, number>();
  const sampleCount = new Map<string, number>();

  for (const group of groups.values()) {
    const ranked = [...group].sort((a, b) => {
      const av = metric === "space" ? a.point.meanSpaceBytes : a.point.meanTimeMs;
      const bv = metric === "space" ? b.point.meanSpaceBytes : b.point.meanTimeMs;
      return av - bv;
    });
    ranked.forEach((r, i) => {
      rankSum.set(r.algo, (rankSum.get(r.algo) ?? 0) + (i + 1));
      rankCount.set(r.algo, (rankCount.get(r.algo) ?? 0) + 1);
      if (i === 0) wins.set(r.algo, (wins.get(r.algo) ?? 0) + 1);
      if (i === 1) second.set(r.algo, (second.get(r.algo) ?? 0) + 1);
      if (i === 2) third.set(r.algo, (third.get(r.algo) ?? 0) + 1);
    });
    for (const r of group) {
      timeSum.set(r.algo, (timeSum.get(r.algo) ?? 0) + r.point.meanTimeMs);
      spaceSum.set(r.algo, (spaceSum.get(r.algo) ?? 0) + r.point.meanSpaceBytes);
      sampleCount.set(r.algo, (sampleCount.get(r.algo) ?? 0) + 1);
    }
  }

  const totalBuckets = groups.size;
  return algos.map(id => {
    const w = wins.get(id) ?? 0;
    const rc = rankCount.get(id) ?? 0;
    const sc = sampleCount.get(id) ?? 0;
    return {
      id,
      wins: w,
      second: second.get(id) ?? 0,
      third: third.get(id) ?? 0,
      buckets: rc,
      avgRank: rc > 0 ? (rankSum.get(id) ?? 0) / rc : Infinity,
      avgTimeMs: sc > 0 ? (timeSum.get(id) ?? 0) / sc : Infinity,
      avgSpaceBytes: sc > 0 ? (spaceSum.get(id) ?? 0) / sc : 0,
      winRate: totalBuckets > 0 ? w / totalBuckets : 0,
    };
  }).sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    return a.avgRank - b.avgRank;
  });
}

export function computePairwiseMatrix(
  cells: FlatCell[],
  metric: "time" | "space" = "time",
): { algos: string[]; get: (row: string, col: string) => PairTally } {
  const algos = [...new Set(cells.map(c => c.algo))];
  const mx = new Map<string, PairTally>();
  for (const a of algos) {
    for (const b of algos) {
      if (a !== b) mx.set(`${a}|${b}`, { wins: 0, losses: 0, ties: 0, total: 0 });
    }
  }

  for (const group of bucketGroups(cells).values()) {
    const entries = group.map(c => ({
      algo: c.algo,
      val: metric === "space" ? c.point.meanSpaceBytes : c.point.meanTimeMs,
    }));
    for (let i = 0; i < entries.length; i++) {
      for (let j = 0; j < entries.length; j++) {
        if (i === j) continue;
        const t = mx.get(`${entries[i].algo}|${entries[j].algo}`);
        if (!t) continue;
        t.total++;
        if (entries[i].val < entries[j].val) t.wins++;
        else if (entries[i].val > entries[j].val) t.losses++;
        else t.ties++;
      }
    }
  }

  const totalWins = new Map<string, number>();
  for (const a of algos) {
    let w = 0;
    for (const b of algos) if (a !== b) w += mx.get(`${a}|${b}`)?.wins ?? 0;
    totalWins.set(a, w);
  }
  const sortedAlgos = [...algos].sort((a, b) => (totalWins.get(b) ?? 0) - (totalWins.get(a) ?? 0));

  return {
    algos: sortedAlgos,
    get(row: string, col: string) {
      return mx.get(`${row}|${col}`) ?? { wins: 0, losses: 0, ties: 0, total: 0 };
    },
  };
}

function winRateInSlice(cells: FlatCell[], algo: string, metric: "time" | "space"): { wins: number; total: number; rate: number } {
  const groups = bucketGroups(cells);
  let wins = 0;
  let total = 0;
  for (const group of groups.values()) {
    const entry = group.find(c => c.algo === algo);
    if (!entry) continue;
    total++;
    const val = metric === "space" ? entry.point.meanSpaceBytes : entry.point.meanTimeMs;
    const best = Math.min(...group.map(c => metric === "space" ? c.point.meanSpaceBytes : c.point.meanTimeMs));
    if (val <= best) wins++;
  }
  return { wins, total, rate: total > 0 ? wins / total : 0 };
}

const DT_LABELS: Record<string, string> = { integer: "Integers", float: "Floats", string: "Strings" };

export function detectSpecialists(
  cells: FlatCell[],
  scenarioLabel: (id: string) => string,
): SpecialistProfile[] {
  const algos = [...new Set(cells.map(c => c.algo))];
  const overallRankings = computeRankings(cells);
  const generalist = overallRankings.filter(r => r.buckets >= 3).sort((a, b) => a.avgRank - b.avgRank)[0];

  const profiles: SpecialistProfile[] = [];

  for (const algo of algos) {
    const tags: SpecialistTag[] = [];
    const overall = winRateInSlice(cells, algo, "time");

    for (const dt of ["integer", "float", "string"]) {
      const slice = filterCells(cells, { dt });
      if (slice.length === 0) continue;
      const { wins, total, rate } = winRateInSlice(slice, algo, "time");
      if (total >= 2 && rate >= 0.55) {
        tags.push({
          id: `dt:${dt}`,
          label: DT_LABELS[dt] ?? dt,
          description: `Wins ${wins}/${total} buckets on ${DT_LABELS[dt] ?? dt} data`,
          winRate: rate,
          wins,
          total,
          dominant: rate >= 0.75 && total >= 3,
        });
      }
    }

    const scenarios = [...new Set(cells.map(c => c.scenario))];
    for (const sc of scenarios) {
      const slice = filterCells(cells, { scenario: sc });
      if (slice.length === 0) continue;
      const { wins, total, rate } = winRateInSlice(slice, algo, "time");
      if (total >= 2 && rate >= 0.55) {
        tags.push({
          id: `sc:${sc}`,
          label: scenarioLabel(sc),
          description: `Wins ${wins}/${total} buckets on ${scenarioLabel(sc)} inputs`,
          winRate: rate,
          wins,
          total,
          dominant: rate >= 0.75 && total >= 3,
        });
      }
    }

    for (const dt of ["integer", "float", "string"]) {
      for (const sc of scenarios) {
        const slice = filterCells(cells, { dt, scenario: sc });
        if (slice.length === 0) continue;
        const { wins, total, rate } = winRateInSlice(slice, algo, "time");
        if (total >= 2 && rate >= 0.7) {
          tags.push({
            id: `dtsc:${dt}:${sc}`,
            label: `${DT_LABELS[dt] ?? dt} · ${scenarioLabel(sc)}`,
            description: `Wins ${wins}/${total} on ${DT_LABELS[dt] ?? dt} + ${scenarioLabel(sc)}`,
            winRate: rate,
            wins,
            total,
            dominant: rate >= 0.8,
          });
        }
      }
    }

    const largeN = filterCells(cells, { minN: 100_000 });
    if (largeN.length > 0) {
      const { wins, total, rate } = winRateInSlice(largeN, algo, "time");
      if (total >= 2 && rate >= 0.6) {
        tags.push({
          id: "n:large",
          label: "Large n (≥100k)",
          description: `Wins ${wins}/${total} buckets at n ≥ 100k`,
          winRate: rate,
          wins,
          total,
          dominant: rate >= 0.75,
        });
      }
    }

    const smallN = filterCells(cells, { maxN: 10_000 });
    if (smallN.length > 0) {
      const { wins, total, rate } = winRateInSlice(smallN, algo, "time");
      if (total >= 2 && rate >= 0.6) {
        tags.push({
          id: "n:small",
          label: "Small n (≤10k)",
          description: `Wins ${wins}/${total} buckets at n ≤ 10k`,
          winRate: rate,
          wins,
          total,
          dominant: rate >= 0.75,
        });
      }
    }

    const spaceSlice = cells.filter(c => c.point.meanSpaceBytes > 0);
    if (spaceSlice.length > 0) {
      const { wins, total, rate } = winRateInSlice(spaceSlice, algo, "space");
      if (total >= 2 && rate >= 0.6) {
        tags.push({
          id: "space",
          label: "Lowest aux memory",
          description: `Uses least aux memory in ${wins}/${total} measured buckets`,
          winRate: rate,
          wins,
          total,
          dominant: rate >= 0.75,
        });
      }
    }

    tags.sort((a, b) => b.winRate - a.winRate || b.total - a.total);
    const rankEntry = overallRankings.find(r => r.id === algo);
    profiles.push({
      algoId: algo,
      overallWinRate: overall.rate,
      overallBuckets: overall.total,
      avgRank: rankEntry?.avgRank ?? Infinity,
      tags: tags.slice(0, 8),
      isGeneralist: generalist?.id === algo,
    });
  }

  return profiles.sort((a, b) => {
    if (a.isGeneralist !== b.isGeneralist) return a.isGeneralist ? -1 : 1;
    return b.overallWinRate - a.overallWinRate;
  });
}

/** Rank of algo in a single bucket (1 = fastest). null if not present. */
export function rankInBucket(group: FlatCell[], algo: string, metric: "time" | "space"): number | null {
  if (!group.some(c => c.algo === algo)) return null;
  const ranked = [...group].sort((a, b) => {
    const av = metric === "space" ? a.point.meanSpaceBytes : a.point.meanTimeMs;
    const bv = metric === "space" ? b.point.meanSpaceBytes : b.point.meanTimeMs;
    return av - bv;
  });
  const idx = ranked.findIndex(c => c.algo === algo);
  return idx >= 0 ? idx + 1 : null;
}

export function buildMasterGrid(
  cells: FlatCell[],
  algos: string[],
  buckets: BucketMeta[],
  metric: "time" | "space",
): Map<string, Map<string, { rank: number | null; val: number | null }>> {
  const byBucket = bucketGroups(cells);
  const grid = new Map<string, Map<string, { rank: number | null; val: number | null }>>();
  for (const algo of algos) {
    const row = new Map<string, { rank: number | null; val: number | null }>();
    for (const b of buckets) {
      const group = byBucket.get(b.key) ?? [];
      const cell = group.find(c => c.algo === algo);
      const rank = rankInBucket(group, algo, metric);
      row.set(b.key, {
        rank,
        val: cell
          ? (metric === "space" ? cell.point.meanSpaceBytes : cell.point.meanTimeMs)
          : null,
      });
    }
    grid.set(algo, row);
  }
  return grid;
}

export function tallyWinLossByDt(cells: FlatCell[]): Record<string, Record<string, PairTally>> {
  const out: Record<string, Record<string, PairTally>> = {};
  for (const dt of [...new Set(cells.map(c => c.dt))]) {
    const slice = filterCells(cells, { dt });
    const mx = computePairwiseMatrix(slice, "time");
    out[dt] = {};
    for (const a of mx.algos) {
      for (const b of mx.algos) {
        if (a === b) continue;
        if (!out[dt][a]) out[dt][a] = { wins: 0, losses: 0, ties: 0, total: 0 };
        const t = mx.get(a, b);
        out[dt][a].wins += t.wins;
        out[dt][a].losses += t.losses;
        out[dt][a].ties += t.ties;
        out[dt][a].total += t.total;
      }
    }
  }
  return out;
}
