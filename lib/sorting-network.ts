export type NetworkStep = {
  values: number[];
  comparatorA: number;
  comparatorB: number;
  swapped: boolean;
  layer: number;
  description: string;
};

export type NetworkComparator = { a: number; b: number; layer: number };

export type NetworkAlgorithm = "bitonic" | "odd-even-merge";

function randomArray(n: number): number[] {
  const arr = Array.from({ length: n }, (_, i) => i + 1);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ── Bitonic Sort ──────────────────────────────────────────────────────────────

function buildBitonicComparators(n: number): NetworkComparator[] {
  const comparators: NetworkComparator[] = [];
  let layer = 0;

  for (let k = 2; k <= n; k *= 2) {
    for (let j = k / 2; j >= 1; j /= 2) {
      // Each (k, j) pair forms one parallel layer
      const layerComps: NetworkComparator[] = [];
      for (let i = 0; i < n; i++) {
        const l = i ^ j;
        if (l > i) {
          if ((i & k) === 0) {
            layerComps.push({ a: i, b: l, layer });
          } else {
            layerComps.push({ a: l, b: i, layer });
          }
        }
      }
      if (layerComps.length > 0) {
        comparators.push(...layerComps);
        layer++;
      }
    }
  }
  return comparators;
}

export function getBitonicNetworkSteps(
  n: number = 8
): { comparators: NetworkComparator[]; steps: NetworkStep[] } {
  const safeN = [4, 8, 16].includes(n) ? n : 8;
  const comparators = buildBitonicComparators(safeN);
  const values = randomArray(safeN);
  const steps: NetworkStep[] = [];

  for (const comp of comparators) {
    const { a, b, layer } = comp;
    const swapped = values[a] > values[b];
    if (swapped) [values[a], values[b]] = [values[b], values[a]];

    steps.push({
      values: [...values],
      comparatorA: a,
      comparatorB: b,
      swapped,
      layer,
      description: swapped
        ? `Layer ${layer}: Compare wire ${a} (${values[b]}) and wire ${b} (${values[a]}) → swapped`
        : `Layer ${layer}: Compare wire ${a} (${values[a]}) and wire ${b} (${values[b]}) → no swap`,
    });
  }

  return { comparators, steps };
}

// ── Batcher Odd-Even Merge Sort ───────────────────────────────────────────────

function buildOddEvenComparators(n: number): NetworkComparator[] {
  const comparators: NetworkComparator[] = [];
  let layer = 0;

  function oddEvenMerge(lo: number, hi: number, step: number) {
    const diff = step * 2;
    if (diff > hi - lo) {
      comparators.push({ a: lo, b: lo + step, layer });
    } else {
      oddEvenMerge(lo, hi, diff);
      oddEvenMerge(lo + step, hi, diff);
      layer++;
      for (let i = lo + step; i < hi; i += diff) {
        comparators.push({ a: i, b: i + step, layer });
      }
    }
  }

  function sort(lo: number, hi: number) {
    if (hi - lo >= 1) {
      const mid = lo + Math.floor((hi - lo) / 2);
      sort(lo, mid);
      sort(mid + 1, hi);
      layer++;
      oddEvenMerge(lo, hi, 1);
    }
  }

  sort(0, n - 1);
  return comparators;
}

export function getOddEvenMergeNetworkSteps(
  n: number = 8
): { comparators: NetworkComparator[]; steps: NetworkStep[] } {
  const safeN = [4, 8, 16].includes(n) ? n : 8;
  const comparators = buildOddEvenComparators(safeN);
  const values = randomArray(safeN);
  const steps: NetworkStep[] = [];

  for (const comp of comparators) {
    const { a, b, layer } = comp;
    const swapped = values[a] > values[b];
    if (swapped) [values[a], values[b]] = [values[b], values[a]];

    steps.push({
      values: [...values],
      comparatorA: a,
      comparatorB: b,
      swapped,
      layer,
      description: swapped
        ? `Layer ${layer}: Compare wire ${a} (${values[b]}) and wire ${b} (${values[a]}) → swapped`
        : `Layer ${layer}: Compare wire ${a} (${values[a]}) and wire ${b} (${values[b]}) → no swap`,
    });
  }

  return { comparators, steps };
}
