// ── Types ─────────────────────────────────────────────────────────────────────

export type PointerKind =
  | "current"
  | "left"
  | "right"
  | "mid"
  | "jump"
  | "found"
  | "excluded";

export interface SearchStep {
  pointers: { index: number; kind: PointerKind; label: string }[];
  /** Indices that are highlighted as "active / in-range" */
  highlightIndices: number[];
  /** Plain-English description of what the algorithm is doing */
  description: string;
  comparisons: number;
  done: boolean;
  foundAt: number | null;
}

export type SearchAlgorithm = "linear" | "binary" | "jump" | "interpolation";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Return a fresh sorted array of `n` unique-ish integers in [1, 99]. */
export function generateSortedArray(n: number = 16): number[] {
  const set = new Set<number>();
  while (set.size < n) {
    set.add(Math.floor(Math.random() * 99) + 1);
  }
  return Array.from(set).sort((a, b) => a - b);
}

// ── Algorithm step generators ─────────────────────────────────────────────────

export function linearSearchSteps(arr: number[], target: number): SearchStep[] {
  const steps: SearchStep[] = [];
  let comparisons = 0;

  for (let i = 0; i < arr.length; i++) {
    comparisons++;
    const found = arr[i] === target;
    steps.push({
      pointers: [{ index: i, kind: found ? "found" : "current", label: found ? "found" : "i" }],
      highlightIndices: [i],
      description: found
        ? `arr[${i}] = ${arr[i]} equals target ${target}. Found at index ${i}!`
        : `Comparing arr[${i}] = ${arr[i]} with target ${target}. Not a match — move right.`,
      comparisons,
      done: found,
      foundAt: found ? i : null,
    });
    if (found) return steps;
  }

  // Not found
  steps.push({
    pointers: [],
    highlightIndices: [],
    description: `Scanned all ${arr.length} elements. Target ${target} is not in the array.`,
    comparisons,
    done: true,
    foundAt: null,
  });

  return steps;
}

export function binarySearchSteps(arr: number[], target: number): SearchStep[] {
  const steps: SearchStep[] = [];
  let left = 0;
  let right = arr.length - 1;
  let comparisons = 0;

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    comparisons++;

    const highlightIndices: number[] = [];
    for (let k = left; k <= right; k++) highlightIndices.push(k);

    if (arr[mid] === target) {
      steps.push({
        pointers: [
          { index: left, kind: "left", label: "L" },
          { index: right, kind: "right", label: "R" },
          { index: mid, kind: "found", label: "found" },
        ],
        highlightIndices,
        description: `Mid index ${mid} has value ${arr[mid]}. ${arr[mid]} = ${target} — Found!`,
        comparisons,
        done: true,
        foundAt: mid,
      });
      return steps;
    } else if (arr[mid] < target) {
      steps.push({
        pointers: [
          { index: left, kind: "left", label: "L" },
          { index: right, kind: "right", label: "R" },
          { index: mid, kind: "mid", label: "M" },
        ],
        highlightIndices,
        description: `Mid index ${mid} has value ${arr[mid]}. ${arr[mid]} < ${target} — target is larger, search right half [${mid + 1}..${right}].`,
        comparisons,
        done: false,
        foundAt: null,
      });
      left = mid + 1;
    } else {
      steps.push({
        pointers: [
          { index: left, kind: "left", label: "L" },
          { index: right, kind: "right", label: "R" },
          { index: mid, kind: "mid", label: "M" },
        ],
        highlightIndices,
        description: `Mid index ${mid} has value ${arr[mid]}. ${arr[mid]} > ${target} — target is smaller, search left half [${left}..${mid - 1}].`,
        comparisons,
        done: false,
        foundAt: null,
      });
      right = mid - 1;
    }
  }

  steps.push({
    pointers: [],
    highlightIndices: [],
    description: `Search space exhausted. Target ${target} is not in the array.`,
    comparisons,
    done: true,
    foundAt: null,
  });

  return steps;
}

export function jumpSearchSteps(arr: number[], target: number): SearchStep[] {
  const steps: SearchStep[] = [];
  const n = arr.length;
  const blockSize = Math.floor(Math.sqrt(n));
  let comparisons = 0;

  let prev = 0;
  let step = blockSize;

  // Jump phase
  while (step < n && arr[Math.min(step, n) - 1] < target) {
    comparisons++;
    const jumpIdx = Math.min(step, n) - 1;
    steps.push({
      pointers: [{ index: jumpIdx, kind: "jump", label: `jump` }],
      highlightIndices: Array.from({ length: step - prev }, (_, i) => prev + i),
      description: `Jump to index ${jumpIdx}: arr[${jumpIdx}] = ${arr[jumpIdx]} < ${target}. Jump forward by √${n} ≈ ${blockSize}.`,
      comparisons,
      done: false,
      foundAt: null,
    });
    prev = step;
    step += blockSize;
  }

  // One last comparison that triggered the stop (or initial overshoot)
  const jumpEnd = Math.min(step, n) - 1;
  comparisons++;
  if (arr[jumpEnd] < target) {
    // Jumped past end without finding anything larger
    steps.push({
      pointers: [{ index: jumpEnd, kind: "jump", label: "jump" }],
      highlightIndices: Array.from({ length: jumpEnd - prev + 1 }, (_, i) => prev + i),
      description: `Jumped to end (index ${jumpEnd}), arr[${jumpEnd}] = ${arr[jumpEnd]} < ${target}. Target ${target} is not in the array.`,
      comparisons,
      done: true,
      foundAt: null,
    });
    return steps;
  }

  steps.push({
    pointers: [{ index: jumpEnd, kind: "jump", label: "jump" }],
    highlightIndices: Array.from({ length: jumpEnd - prev + 1 }, (_, i) => prev + i),
    description: `Overshot at index ${jumpEnd}: arr[${jumpEnd}] = ${arr[jumpEnd]} ≥ ${target}. Switch to linear scan backward from index ${jumpEnd}.`,
    comparisons,
    done: false,
    foundAt: null,
  });

  // Linear scan phase
  for (let i = prev; i <= jumpEnd; i++) {
    comparisons++;
    const found = arr[i] === target;
    steps.push({
      pointers: [
        { index: jumpEnd, kind: "right", label: "end" },
        { index: i, kind: found ? "found" : "current", label: found ? "found" : "i" },
      ],
      highlightIndices: [i],
      description: found
        ? `Linear scan: arr[${i}] = ${arr[i]} = ${target}. Found at index ${i}!`
        : `Linear scan: arr[${i}] = ${arr[i]} ≠ ${target}. Move right.`,
      comparisons,
      done: found,
      foundAt: found ? i : null,
    });
    if (found) return steps;
    if (arr[i] > target) break;
  }

  steps.push({
    pointers: [],
    highlightIndices: [],
    description: `Linear scan complete. Target ${target} is not in the array.`,
    comparisons,
    done: true,
    foundAt: null,
  });

  return steps;
}

export function interpolationSearchSteps(arr: number[], target: number): SearchStep[] {
  const steps: SearchStep[] = [];
  let lo = 0;
  let hi = arr.length - 1;
  let comparisons = 0;

  while (lo <= hi && target >= arr[lo] && target <= arr[hi]) {
    if (lo === hi) {
      comparisons++;
      const found = arr[lo] === target;
      steps.push({
        pointers: [{ index: lo, kind: found ? "found" : "current", label: found ? "found" : "i" }],
        highlightIndices: [lo],
        description: found
          ? `Only one element left. arr[${lo}] = ${arr[lo]} = ${target}. Found!`
          : `Only one element left. arr[${lo}] = ${arr[lo]} ≠ ${target}. Not found.`,
        comparisons,
        done: true,
        foundAt: found ? lo : null,
      });
      return steps;
    }

    // Interpolation formula
    const range = arr[hi] - arr[lo];
    const pos = lo + Math.round(((target - arr[lo]) * (hi - lo)) / range);
    const clampedPos = Math.max(lo, Math.min(hi, pos));
    comparisons++;

    const highlightIndices: number[] = [];
    for (let k = lo; k <= hi; k++) highlightIndices.push(k);

    const formula = `pos = ${lo} + ((${target} − ${arr[lo]}) × (${hi} − ${lo})) / (${arr[hi]} − ${arr[lo]}) ≈ ${clampedPos}`;

    if (arr[clampedPos] === target) {
      steps.push({
        pointers: [
          { index: lo, kind: "left", label: "lo" },
          { index: hi, kind: "right", label: "hi" },
          { index: clampedPos, kind: "found", label: "found" },
        ],
        highlightIndices,
        description: `${formula}. arr[${clampedPos}] = ${arr[clampedPos]} = ${target}. Found!`,
        comparisons,
        done: true,
        foundAt: clampedPos,
      });
      return steps;
    } else if (arr[clampedPos] < target) {
      steps.push({
        pointers: [
          { index: lo, kind: "left", label: "lo" },
          { index: hi, kind: "right", label: "hi" },
          { index: clampedPos, kind: "mid", label: "pos" },
        ],
        highlightIndices,
        description: `${formula}. arr[${clampedPos}] = ${arr[clampedPos]} < ${target} — search right: lo → ${clampedPos + 1}.`,
        comparisons,
        done: false,
        foundAt: null,
      });
      lo = clampedPos + 1;
    } else {
      steps.push({
        pointers: [
          { index: lo, kind: "left", label: "lo" },
          { index: hi, kind: "right", label: "hi" },
          { index: clampedPos, kind: "mid", label: "pos" },
        ],
        highlightIndices,
        description: `${formula}. arr[${clampedPos}] = ${arr[clampedPos]} > ${target} — search left: hi → ${clampedPos - 1}.`,
        comparisons,
        done: false,
        foundAt: null,
      });
      hi = clampedPos - 1;
    }
  }

  // Final out-of-range check
  if (lo <= hi) {
    comparisons++;
    const found = arr[lo] === target;
    if (found) {
      steps.push({
        pointers: [{ index: lo, kind: "found", label: "found" }],
        highlightIndices: [lo],
        description: `arr[${lo}] = ${arr[lo]} = ${target}. Found!`,
        comparisons,
        done: true,
        foundAt: lo,
      });
      return steps;
    }
  }

  steps.push({
    pointers: [],
    highlightIndices: [],
    description: `Target ${target} is out of the current search range. Not found.`,
    comparisons,
    done: true,
    foundAt: null,
  });

  return steps;
}

export function getSearchSteps(algorithm: SearchAlgorithm, arr: number[], target: number): SearchStep[] {
  switch (algorithm) {
    case "linear":        return linearSearchSteps(arr, target);
    case "binary":        return binarySearchSteps(arr, target);
    case "jump":          return jumpSearchSteps(arr, target);
    case "interpolation": return interpolationSearchSteps(arr, target);
  }
}
