/**
 * Exhaustive probe-context deck for Permutation Run — every data type, scenario,
 * distribution, and integer variant we can generate, plus polymorphic sweeps.
 */
import {
  ALGO_INCOMPATIBLE,
  generateBenchmarkInput,
  generateFloatInput,
  generateStringInput,
  type BenchmarkScenario,
  type CustomDistribution,
  type DataType,
  type ValueDistribution,
} from "./benchmark";
import { scenarioLabel } from "./detailed-session-log";

export const ALL_BENCHMARK_SCENARIOS: BenchmarkScenario[] = [
  "random",
  "nearlySorted",
  "reversed",
  "duplicates",
  "sorted",
  "sawtooth",
  "organPipe",
  "zipfian",
  "dictionary",
  "timestamps",
];

const DISTRIBUTIONS: ValueDistribution[] = [
  "uniform",
  "normal",
  "exponential",
  "bimodal",
  "zipf",
];

const DT_LABEL: Record<DataType, string> = {
  integer: "Int",
  float: "Float",
  string: "String",
};

export interface ChurnProbeContext {
  id: string;
  dataType: DataType;
  scenario: BenchmarkScenario;
  /** When true, one timed sort covers integer + float + string legs. */
  polymorphic?: boolean;
  custom?: CustomDistribution;
  label: string;
}

function ctxId(parts: string[]): string {
  return parts.join("|");
}

function makeLabel(
  dataType: DataType,
  scenario: BenchmarkScenario,
  extras: string[] = [],
): string {
  const base = `${DT_LABEL[dataType]} · ${scenarioLabel(scenario)}`;
  return extras.length > 0 ? `${base} · ${extras.join(" · ")}` : base;
}

/**
 * Permutation Run probe deck aligned with the benchmark UI: one int / float / string
 * context per selected scenario (plus optional polymorphic legs).
 */
export function buildChurnProbeDeck(
  activeScenarios: BenchmarkScenario[],
  options?: { polymorphic?: boolean },
): ChurnProbeContext[] {
  const deck: ChurnProbeContext[] = [];
  for (const scenario of activeScenarios) {
    deck.push({
      id: ctxId(["int", scenario]),
      dataType: "integer",
      scenario,
      label: makeLabel("integer", scenario),
    });
    deck.push({
      id: ctxId(["float", scenario]),
      dataType: "float",
      scenario,
      label: makeLabel("float", scenario),
    });
    deck.push({
      id: ctxId(["string", scenario]),
      dataType: "string",
      scenario,
      label: makeLabel("string", scenario),
    });
    if (options?.polymorphic) {
      deck.push({
        id: ctxId(["poly", scenario]),
        dataType: "integer",
        scenario,
        polymorphic: true,
        label: `Poly int+float+string · ${scenarioLabel(scenario)}`,
      });
    }
  }
  return deck;
}

/** Pick the next context for an algo — prefer dtypes not yet tested at this n step. */
export function pickChurnContextForLevel(
  algoId: string,
  deck: ChurnProbeContext[],
  dtypesTestedAtLevel: Partial<Record<DataType, boolean>>,
  required: DataType[],
  cursor: Record<string, number>,
): ChurnProbeContext {
  const compat = contextsForAlgo(algoId, deck);
  if (compat.length === 0) {
    return deck[0];
  }
  const pending = compat.filter(ctx => {
    if (ctx.polymorphic) {
      return !allChurnDtypesTestedAtLevel(dtypesTestedAtLevel, required);
    }
    return !dtypesTestedAtLevel[ctx.dataType];
  });
  const pool = pending.length > 0 ? pending : compat;
  const idx = (cursor[algoId] ?? 0) % pool.length;
  cursor[algoId] = idx + 1;
  return pool[idx]!;
}

/** Full coverage deck — dtype × scenario × distributions × int variants + poly. */
export function buildChurnCoverageDeck(): ChurnProbeContext[] {
  const deck: ChurnProbeContext[] = [];

  for (const dataType of ["integer", "float", "string"] as DataType[]) {
    for (const scenario of ALL_BENCHMARK_SCENARIOS) {
      if (scenario === "random" && dataType !== "string") {
        for (const distribution of DISTRIBUTIONS) {
          if (dataType === "integer") {
            deck.push({
              id: ctxId(["int", scenario, distribution, "legacy"]),
              dataType,
              scenario,
              custom: { preSortedPct: 0, duplicatePct: 0, distribution },
              label: makeLabel(dataType, scenario, [distribution]),
            });
            deck.push({
              id: ctxId(["int", scenario, distribution, "int32"]),
              dataType,
              scenario,
              custom: { preSortedPct: 0, duplicatePct: 0, distribution, fullInt32: true },
              label: makeLabel(dataType, scenario, [distribution, "int32"]),
            });
            deck.push({
              id: ctxId(["int", scenario, distribution, "unique"]),
              dataType,
              scenario,
              custom: { preSortedPct: 0, duplicatePct: 0, distribution, uniqueOnly: true },
              label: makeLabel(dataType, scenario, [distribution, "unique"]),
            });
          } else {
            deck.push({
              id: ctxId(["float", scenario, distribution]),
              dataType,
              scenario,
              custom: { preSortedPct: 0, duplicatePct: 0, distribution },
              label: makeLabel(dataType, scenario, [distribution]),
            });
          }
        }
        if (dataType === "integer") {
          deck.push({
            id: ctxId(["int", scenario, "presorted50"]),
            dataType,
            scenario,
            custom: { preSortedPct: 50, duplicatePct: 0, distribution: "uniform" },
            label: makeLabel(dataType, scenario, ["50% presorted"]),
          });
          deck.push({
            id: ctxId(["int", scenario, "dup30"]),
            dataType,
            scenario,
            custom: { preSortedPct: 0, duplicatePct: 30, distribution: "uniform" },
            label: makeLabel(dataType, scenario, ["30% duplicates"]),
          });
        } else if (dataType === "float") {
          deck.push({
            id: ctxId(["float", scenario, "presorted50"]),
            dataType,
            scenario,
            custom: { preSortedPct: 50, duplicatePct: 0, distribution: "uniform" },
            label: makeLabel(dataType, scenario, ["50% presorted"]),
          });
          deck.push({
            id: ctxId(["float", scenario, "dup30"]),
            dataType,
            scenario,
            custom: { preSortedPct: 0, duplicatePct: 30, distribution: "uniform" },
            label: makeLabel(dataType, scenario, ["30% duplicates"]),
          });
        }
      } else if (dataType === "integer") {
        deck.push({
          id: ctxId(["int", scenario, "legacy"]),
          dataType,
          scenario,
          label: makeLabel(dataType, scenario),
        });
        deck.push({
          id: ctxId(["int", scenario, "int32"]),
          dataType,
          scenario,
          custom: { preSortedPct: 0, duplicatePct: 0, fullInt32: true },
          label: makeLabel(dataType, scenario, ["int32"]),
        });
      } else {
        deck.push({
          id: ctxId([dataType, scenario]),
          dataType,
          scenario,
          label: makeLabel(dataType, scenario),
        });
      }
    }
  }

  for (const scenario of ALL_BENCHMARK_SCENARIOS) {
    deck.push({
      id: ctxId(["poly", scenario]),
      dataType: "integer",
      scenario,
      polymorphic: true,
      label: `Poly int+float+string · ${scenarioLabel(scenario)}`,
    });
  }

  return deck;
}

/** Algorithms eligible for polymorphic (int+float+string) churn probes. */
export const CHURN_POLY_SAFE = new Set([
  "logos", "merge", "quick", "heap", "insertion", "shell", "selection",
  "bubble", "cocktail", "comb", "gnome", "powersort",
]);

export function isChurnContextCompatible(algoId: string, ctx: ChurnProbeContext): boolean {
  if (ctx.polymorphic) return CHURN_POLY_SAFE.has(algoId);
  if (ctx.dataType !== "integer" && ALGO_INCOMPATIBLE[ctx.dataType]?.has(algoId)) {
    return false;
  }
  return true;
}

export function requiredChurnDtypesForAlgo(
  algoId: string,
  deck: ChurnProbeContext[],
): DataType[] {
  const compat = contextsForAlgo(algoId, deck);
  if (compat.some(c => c.polymorphic)) {
    return ["integer", "float", "string"];
  }
  const seen = new Set<DataType>();
  for (const ctx of compat) {
    if (!ctx.polymorphic) seen.add(ctx.dataType);
  }
  return [...seen];
}

export function markChurnDtypesTested(
  map: Partial<Record<DataType, boolean>>,
  ctx: ChurnProbeContext,
): Partial<Record<DataType, boolean>> {
  if (ctx.polymorphic) {
    return { integer: true, float: true, string: true };
  }
  return { ...map, [ctx.dataType]: true };
}

export function allChurnDtypesTestedAtLevel(
  map: Partial<Record<DataType, boolean>>,
  required: DataType[],
): boolean {
  return required.length > 0 && required.every(dt => map[dt]);
}

export function countChurnDtypesTestedAtLevel(
  map: Partial<Record<DataType, boolean>>,
  required: DataType[],
): number {
  return required.filter(dt => map[dt]).length;
}

export function contextsForAlgo(
  algoId: string,
  deck: ChurnProbeContext[],
): ChurnProbeContext[] {
  return deck.filter(ctx => isChurnContextCompatible(algoId, ctx));
}

export function churnStateKey(algoId: string, contextId: string): string {
  return `${algoId}|${contextId}`;
}

export function parseChurnStateKey(key: string): { algoId: string; contextId: string } {
  const sep = key.indexOf("|");
  if (sep < 0) return { algoId: key, contextId: "" };
  return { algoId: key.slice(0, sep), contextId: key.slice(sep + 1) };
}

/** Round-robin: next compatible context for this algo. */
export function nextChurnContext(
  algoId: string,
  deck: ChurnProbeContext[],
  cursor: Record<string, number>,
): ChurnProbeContext {
  const compatible = contextsForAlgo(algoId, deck);
  if (compatible.length === 0) {
    return deck[0];
  }
  const idx = (cursor[algoId] ?? 0) % compatible.length;
  cursor[algoId] = idx + 1;
  return compatible[idx];
}

export function generateChurnInput(n: number, ctx: ChurnProbeContext): unknown[] {
  if (ctx.polymorphic) {
    return generateBenchmarkInput(n, ctx.scenario, ctx.custom);
  }
  if (ctx.dataType === "string") {
    return generateStringInput(n, ctx.scenario);
  }
  if (ctx.dataType === "float") {
    return generateFloatInput(n, ctx.scenario, ctx.custom);
  }
  return generateBenchmarkInput(n, ctx.scenario, ctx.custom);
}

/** Scenario string stored in session / detailed logs for this probe. */
export function churnLogScenario(ctx: ChurnProbeContext): string {
  if (ctx.polymorphic) return `polymorphic:${ctx.scenario}`;
  return ctx.scenario;
}

/** Data type bucket for session stores (polymorphic → integer primary). */
export function churnLogDataType(ctx: ChurnProbeContext): DataType {
  return ctx.dataType;
}

let cachedDeck: ChurnProbeContext[] | null = null;

export function getChurnCoverageDeck(): ChurnProbeContext[] {
  if (!cachedDeck) cachedDeck = buildChurnCoverageDeck();
  return cachedDeck;
}

export function churnCoverageSummary(deck: ChurnProbeContext[]): {
  contexts: number;
  byType: Record<DataType, number>;
  polymorphic: number;
} {
  const byType: Record<DataType, number> = { integer: 0, float: 0, string: 0 };
  let polymorphic = 0;
  for (const ctx of deck) {
    if (ctx.polymorphic) polymorphic++;
    else byType[ctx.dataType]++;
  }
  return { contexts: deck.length, byType, polymorphic };
}
