import type { BarState, SortStep, AlgorithmMeta, SortAlgorithm } from "./types";

export function generateArray(size: number, min: number, max: number): number[] {
  return Array.from(
    { length: size },
    () => Math.floor(Math.random() * (max - min + 1)) + min
  );
}

export const ALGORITHM_META: Record<SortAlgorithm, AlgorithmMeta> = {
  bubble: {
    name: "Bubble Sort",
    slug: "bubble",
    timeComplexity: "O(n²)",
    spaceComplexity: "O(1)",
    stable: true,
    description:
      "Repeatedly steps through the list, compares adjacent elements and swaps them if they're in the wrong order. The largest unsorted element bubbles to its correct position each pass.",
    pseudocode: [
      "for i = 0 to n−1:",
      "  for j = 0 to n−i−2:",
      "    if arr[j] > arr[j+1]:",
      "      swap(arr[j], arr[j+1])",
    ],
  },
  selection: {
    name: "Selection Sort",
    slug: "selection",
    timeComplexity: "O(n²)",
    spaceComplexity: "O(1)",
    stable: false,
    description:
      "Divides the array into sorted and unsorted regions. Repeatedly finds the minimum element from the unsorted region and moves it to the end of the sorted region.",
    pseudocode: [
      "for i = 0 to n−1:",
      "  minIdx = i",
      "  for j = i+1 to n−1:",
      "    if arr[j] < arr[minIdx]:",
      "      minIdx = j",
      "  swap(arr[i], arr[minIdx])",
    ],
  },
  insertion: {
    name: "Insertion Sort",
    slug: "insertion",
    timeComplexity: "O(n²)",
    spaceComplexity: "O(1)",
    stable: true,
    description:
      "Builds the sorted array one element at a time by inserting each new element into its correct position among the already-sorted elements.",
    pseudocode: [
      "for i = 1 to n−1:",
      "  key = arr[i]",
      "  j = i − 1",
      "  while j ≥ 0 and arr[j] > key:",
      "    arr[j+1] = arr[j]",
      "    j = j − 1",
      "  arr[j+1] = key",
    ],
  },
  merge: {
    name: "Merge Sort",
    slug: "merge",
    timeComplexity: "O(n log n)",
    spaceComplexity: "O(n)",
    stable: true,
    description: "Divides the array in half recursively, then merges sorted halves. Guarantees O(n log n) in all cases.",
    pseudocode: [
      "mergeSort(arr, l, r):",
      "  if l >= r: return",
      "  mid = (l + r) / 2",
      "  mergeSort(arr, l, mid)",
      "  mergeSort(arr, mid+1, r)",
      "  merge(arr, l, mid, r)",
    ],
  },
  quick: {
    name: "Quick Sort",
    slug: "quick",
    timeComplexity: "O(n log n)",
    spaceComplexity: "O(log n)",
    stable: false,
    description: "Selects a pivot, partitions the array around it, then recurses on both halves. Average O(n log n) with excellent cache performance.",
    pseudocode: [
      "quickSort(arr, lo, hi):",
      "  if lo >= hi: return",
      "  pivot = arr[hi]",
      "  i = lo − 1",
      "  for j = lo to hi−1:",
      "    if arr[j] ≤ pivot: swap arr[++i] and arr[j]",
      "  swap arr[i+1] and arr[hi]",
      "  recurse left and right of pivot",
    ],
  },
  heap: {
    name: "Heap Sort",
    slug: "heap",
    timeComplexity: "O(n log n)",
    spaceComplexity: "O(1)",
    stable: false,
    description: "Builds a max-heap from the array, then repeatedly extracts the max element to produce the sorted output in-place.",
    pseudocode: [
      "buildMaxHeap(arr)",
      "  for i = n/2−1 down to 0: heapify(arr, n, i)",
      "for i = n−1 down to 1:",
      "  swap arr[0] and arr[i]",
      "  heapify(arr, i, 0)",
      "heapify: sift root down to restore heap",
    ],
  },
  shell: {
    name: "Shell Sort",
    slug: "shell",
    timeComplexity: "O(n log² n)",
    spaceComplexity: "O(1)",
    stable: false,
    description: "A generalization of insertion sort that allows swapping of elements far apart. Uses a decreasing gap sequence to progressively sort the array.",
    pseudocode: [
      "gap = n / 2",
      "while gap > 0:",
      "  for i = gap to n−1:",
      "    temp = arr[i]",
      "    j = i",
      "    while j ≥ gap and arr[j−gap] > temp:",
      "      arr[j] = arr[j−gap];  j −= gap",
      "    arr[j] = temp",
      "  gap = gap / 2",
    ],
  },
  counting: {
    name: "Counting Sort",
    slug: "counting",
    timeComplexity: "O(n + k)",
    spaceComplexity: "O(k)",
    stable: true,
    description: "Counts occurrences of each value, computes prefix sums, then places each element at its correct position. Only works for integer keys in a known range.",
    pseudocode: [
      "count[0..k] = 0",
      "for x in arr: count[x]++",
      "for i = 1 to k: count[i] += count[i−1]",
      "for i = n−1 down to 0:",
      "  output[count[arr[i]]−1] = arr[i]",
      "  count[arr[i]]--",
    ],
  },
  radix: {
    name: "Radix Sort",
    slug: "radix",
    timeComplexity: "O(nk)",
    spaceComplexity: "O(n + k)",
    stable: true,
    description: "Sorts integers digit by digit from least significant to most significant, using a stable sort (counting sort) at each digit position.",
    pseudocode: [
      "for exp = 1; max/exp > 0; exp *= 10:",
      "  countingSortByDigit(arr, exp)",
      "  digit = (arr[i] / exp) % 10",
      "  count[digit]++",
      "  rebuild prefix sums",
      "  place elements into output",
    ],
  },
  bucket: {
    name: "Bucket Sort",
    slug: "bucket",
    timeComplexity: "O(n + k)",
    spaceComplexity: "O(n)",
    stable: true,
    description: "Distributes elements into a fixed number of buckets, sorts each bucket (using insertion sort), then concatenates the buckets.",
    pseudocode: [
      "create n empty buckets",
      "for each x in arr:",
      "  bucket[floor(n * x / max)].insert(x)",
      "for each bucket: insertionSort(bucket)",
      "concatenate all buckets into arr",
    ],
  },
  logos: {
    name: "Logos Sort",
    slug: "logos",
    timeComplexity: "O(n log n)",
    spaceComplexity: "O(log n)",
    stable: false,
    description:
      "A φ-pivot, 3-way-partition quicksort variant. Selects the pivot at index ⌊(hi−lo)·φ⌋ using the golden ratio for adversarial resistance, then applies a Dutch National Flag 3-way partition. Elements equal to the pivot are placed in their final position in one pass. Recurses on the smaller partition to keep stack depth O(log n).",
    pseudocode: [
      "if hi − lo < 16: insertionSort(arr, lo, hi)",
      "pivot_idx = lo + ⌊(hi − lo) × φ⌋",
      "lt = lo;  gt = hi;  i = lo",
      "while i ≤ gt:",
      "  if arr[i] < pivot: swap arr[lt] ↔ arr[i]; lt++; i++",
      "  elif arr[i] > pivot: swap arr[i] ↔ arr[gt]; gt--",
      "  else: i++   // equal to pivot",
      "recurse smaller half; tail-call larger half",
    ],
  },
  timsort: {
    name: "Tim Sort",
    slug: "timsort",
    timeComplexity: "O(n log n)",
    spaceComplexity: "O(n)",
    stable: true,
    description: "Hybrid sort combining insertion sort and merge sort. Divides the array into small 'runs' sorted by insertion sort, then merges them bottom-up. Used in Python and Java's standard libraries.",
    pseudocode: [
      "RUN = 32",
      "// Phase 1 – insertion-sort each run",
      "for i = 0 to n, step RUN:",
      "  key = arr[j]",
      "  while arr[j−1] > key: arr[j] = arr[j−1]",
      "  arr[j] = key",
      "// Phase 2 – merge sorted runs",
      "  merge(left, mid, right)",
    ],
  },
};

function makeStates(
  length: number,
  sortedSet: Set<number>,
  overrides: Partial<Record<number, BarState>> = {}
): BarState[] {
  return Array.from({ length }, (_, i) => {
    if (overrides[i] !== undefined) return overrides[i]!;
    return sortedSet.has(i) ? "sorted" : "default";
  });
}

export function getBubbleSortSteps(arr: number[]): SortStep[] {
  const steps: SortStep[] = [];
  const a = [...arr];
  const n = a.length;
  const sorted = new Set<number>();
  let comparisons = 0;
  let swaps = 0;

  for (let i = 0; i < n - 1; i++) {
    for (let j = 0; j < n - i - 1; j++) {
      comparisons++;
      steps.push({
        array: [...a],
        states: makeStates(n, sorted, { [j]: "comparing", [j + 1]: "comparing" }),
        description: `Pass ${i + 1}: comparing ${a[j]} and ${a[j + 1]}`,
        comparisons,
        swaps,
        pseudocodeLine: 2,
      });

      if (a[j] > a[j + 1]) {
        swaps++;
        [a[j], a[j + 1]] = [a[j + 1], a[j]];
        steps.push({
          array: [...a],
          states: makeStates(n, sorted, { [j]: "swapping", [j + 1]: "swapping" }),
          description: `Swapped → ${a[j]} and ${a[j + 1]}`,
          comparisons,
          swaps,
          pseudocodeLine: 3,
        });
      }
    }
    sorted.add(n - 1 - i);
  }
  sorted.add(0);

  steps.push({
    array: [...a],
    states: Array(n).fill("sorted"),
    description: "Array is fully sorted!",
    comparisons,
    swaps,
    pseudocodeLine: -1,
  });

  return steps;
}

export function getSelectionSortSteps(arr: number[]): SortStep[] {
  const steps: SortStep[] = [];
  const a = [...arr];
  const n = a.length;
  const sorted = new Set<number>();
  let comparisons = 0;
  let swaps = 0;

  for (let i = 0; i < n - 1; i++) {
    let minIdx = i;

    steps.push({
      array: [...a],
      states: makeStates(n, sorted, { [i]: "current" }),
      description: `Finding minimum in unsorted region [${i}..${n - 1}]`,
      comparisons,
      swaps,
      pseudocodeLine: 1,
    });

    for (let j = i + 1; j < n; j++) {
      comparisons++;
      steps.push({
        array: [...a],
        states: makeStates(n, sorted, {
          [minIdx]: "minimum",
          [j]: "comparing",
        }),
        description: `Comparing current min ${a[minIdx]} with ${a[j]} at index ${j}`,
        comparisons,
        swaps,
        pseudocodeLine: 3,
      });

      if (a[j] < a[minIdx]) {
        minIdx = j;
        steps.push({
          array: [...a],
          states: makeStates(n, sorted, { [minIdx]: "minimum" }),
          description: `New minimum found: ${a[minIdx]} at index ${minIdx}`,
          comparisons,
          swaps,
          pseudocodeLine: 4,
        });
      }
    }

    if (minIdx !== i) {
      swaps++;
      [a[i], a[minIdx]] = [a[minIdx], a[i]];
      steps.push({
        array: [...a],
        states: makeStates(n, sorted, { [i]: "swapping", [minIdx]: "swapping" }),
        description: `Swapped minimum ${a[i]} into sorted position ${i}`,
        comparisons,
        swaps,
        pseudocodeLine: 5,
      });
    }

    sorted.add(i);
  }
  sorted.add(n - 1);

  steps.push({
    array: [...a],
    states: Array(n).fill("sorted"),
    description: "Array is fully sorted!",
    comparisons,
    swaps,
    pseudocodeLine: -1,
  });

  return steps;
}

export function getInsertionSortSteps(arr: number[]): SortStep[] {
  const steps: SortStep[] = [];
  const a = [...arr];
  const n = a.length;
  let comparisons = 0;
  let swaps = 0;

  const sortedBoundary = (upTo: number): BarState[] =>
    Array.from({ length: n }, (_, i) => (i <= upTo ? "sorted" : "default"));

  steps.push({
    array: [...a],
    states: sortedBoundary(0),
    description: "First element is trivially sorted",
    comparisons,
    swaps,
    pseudocodeLine: -1,
  });

  for (let i = 1; i < n; i++) {
    const key = a[i];
    let j = i - 1;

    steps.push({
      array: [...a],
      states: makeStates(n, new Set(Array.from({ length: i }, (_, k) => k)), {
        [i]: "current",
      }),
      description: `Inserting ${key} into the sorted portion`,
      comparisons,
      swaps,
      pseudocodeLine: 1,
    });

    while (j >= 0 && a[j] > key) {
      comparisons++;
      const partial = new Set(Array.from({ length: i }, (_, k) => k));
      steps.push({
        array: [...a],
        states: makeStates(n, partial, { [j]: "comparing", [j + 1]: "current" }),
        description: `${a[j]} > ${key}, shifting ${a[j]} right`,
        comparisons,
        swaps,
        pseudocodeLine: 3,
      });
      swaps++;
      a[j + 1] = a[j];
      j--;

      steps.push({
        array: [...a],
        states: makeStates(n, new Set(Array.from({ length: i }, (_, k) => k)), {
          [j + 1]: "swapping",
        }),
        description: `Shifted element right to index ${j + 2}`,
        comparisons,
        swaps,
        pseudocodeLine: 4,
      });
    }

    a[j + 1] = key;
    steps.push({
      array: [...a],
      states: sortedBoundary(i),
      description: `Placed ${key} at index ${j + 1}`,
      comparisons,
      swaps,
      pseudocodeLine: 6,
    });
  }

  steps.push({
    array: [...a],
    states: Array(n).fill("sorted"),
    description: "Array is fully sorted!",
    comparisons,
    swaps,
    pseudocodeLine: -1,
  });

  return steps;
}

export function getMergeSortSteps(arr: number[]): SortStep[] {
  const steps: SortStep[] = [];
  const a = [...arr];
  const n = a.length;
  let comparisons = 0;
  let swaps = 0;

  // Bottom-up merge sort
  for (let width = 1; width < n; width *= 2) {
    for (let lo = 0; lo < n; lo += 2 * width) {
      const mid = Math.min(lo + width - 1, n - 1);
      const hi  = Math.min(lo + 2 * width - 1, n - 1);
      if (mid >= hi) continue;

      // Merge a[lo..mid] and a[mid+1..hi]
      const left  = a.slice(lo, mid + 1);
      const right = a.slice(mid + 1, hi + 1);
      let i = 0, j = 0, k = lo;

      while (i < left.length && j < right.length) {
        comparisons++;
        // show comparison step
        const states: BarState[] = a.map((_, idx) => {
          if (idx === lo + i) return "comparing";
          if (idx === mid + 1 + j) return "comparing";
          if (idx >= lo && idx <= hi) return "current";
          return "default";
        });
        steps.push({ array: [...a], states, description: `Merging [${lo}..${mid}] and [${mid+1}..${hi}]: comparing ${left[i]} and ${right[j]}`, comparisons, swaps, pseudocodeLine: 5 });

        if (left[i] <= right[j]) {
          a[k++] = left[i++];
        } else {
          a[k++] = right[j++];
        }
        swaps++;
      }
      while (i < left.length) { a[k++] = left[i++]; swaps++; }
      while (j < right.length) { a[k++] = right[j++]; swaps++; }

      // Show result of this merge
      const mergedStates: BarState[] = a.map((_, idx) => {
        if (idx >= lo && idx <= hi) return "sorted";
        return "default";
      });
      steps.push({ array: [...a], states: mergedStates, description: `Merged subarray [${lo}..${hi}]`, comparisons, swaps, pseudocodeLine: 5 });
    }
  }

  steps.push({ array: [...a], states: Array(n).fill("sorted"), description: "Array is fully sorted!", comparisons, swaps, pseudocodeLine: -1 });
  return steps;
}

export function getQuickSortSteps(arr: number[]): SortStep[] {
  const steps: SortStep[] = [];
  const a = [...arr];
  const n = a.length;
  let comparisons = 0;
  let swaps = 0;
  const sorted = new Set<number>();

  const stack: [number, number][] = [[0, n - 1]];

  while (stack.length > 0) {
    const [lo, hi] = stack.pop()!;
    if (lo >= hi) {
      if (lo === hi) sorted.add(lo);
      continue;
    }

    // Show pivot selection
    const pivotVal = a[hi];
    steps.push({
      array: [...a],
      states: makeStates(n, sorted, { [hi]: "pivot" }),
      description: `Pivot selected: ${pivotVal} at index ${hi}`,
      comparisons, swaps, pseudocodeLine: 2,
    });

    let i = lo - 1;
    for (let j = lo; j < hi; j++) {
      comparisons++;
      steps.push({
        array: [...a],
        states: makeStates(n, sorted, { [hi]: "pivot", [j]: "comparing" }),
        description: `Comparing ${a[j]} with pivot ${pivotVal}`,
        comparisons, swaps, pseudocodeLine: 4,
      });

      if (a[j] <= pivotVal) {
        i++;
        if (i !== j) {
          swaps++;
          [a[i], a[j]] = [a[j], a[i]];
          steps.push({
            array: [...a],
            states: makeStates(n, sorted, { [hi]: "pivot", [i]: "swapping", [j]: "swapping" }),
            description: `Swapped ${a[i]} and ${a[j]} — ${a[j]} ≤ pivot`,
            comparisons, swaps, pseudocodeLine: 5,
          });
        }
      }
    }

    // Place pivot
    const pivotIdx = i + 1;
    [a[pivotIdx], a[hi]] = [a[hi], a[pivotIdx]];
    swaps++;
    sorted.add(pivotIdx);
    steps.push({
      array: [...a],
      states: makeStates(n, sorted, {}),
      description: `Pivot ${a[pivotIdx]} placed at index ${pivotIdx}`,
      comparisons, swaps, pseudocodeLine: 6,
    });

    // Push subproblems
    if (pivotIdx - 1 > lo) stack.push([lo, pivotIdx - 1]);
    else if (lo <= pivotIdx - 1) { for (let x = lo; x <= pivotIdx - 1; x++) sorted.add(x); }
    if (pivotIdx + 1 < hi) stack.push([pivotIdx + 1, hi]);
    else if (pivotIdx + 1 <= hi) { for (let x = pivotIdx + 1; x <= hi; x++) sorted.add(x); }
  }

  // Mark all remaining as sorted
  for (let i = 0; i < n; i++) sorted.add(i);
  steps.push({ array: [...a], states: Array(n).fill("sorted"), description: "Array is fully sorted!", comparisons, swaps, pseudocodeLine: -1 });
  return steps;
}

export function getHeapSortSteps(arr: number[]): SortStep[] {
  const steps: SortStep[] = [];
  const a = [...arr];
  const n = a.length;
  let comparisons = 0;
  let swaps = 0;
  const sorted = new Set<number>();

  function heapify(size: number, root: number) {
    let largest = root;
    const l = 2 * root + 1;
    const r = 2 * root + 2;

    if (l < size) {
      comparisons++;
      steps.push({
        array: [...a],
        states: makeStates(n, sorted, { [largest]: "minimum", [l]: "comparing" }),
        description: `Heapify: comparing ${a[largest]} (root) with left child ${a[l]}`,
        comparisons, swaps, pseudocodeLine: 5,
      });
      if (a[l] > a[largest]) largest = l;
    }
    if (r < size) {
      comparisons++;
      steps.push({
        array: [...a],
        states: makeStates(n, sorted, { [largest]: "minimum", [r]: "comparing" }),
        description: `Heapify: comparing ${a[largest]} with right child ${a[r]}`,
        comparisons, swaps, pseudocodeLine: 5,
      });
      if (a[r] > a[largest]) largest = r;
    }

    if (largest !== root) {
      swaps++;
      [a[root], a[largest]] = [a[largest], a[root]];
      steps.push({
        array: [...a],
        states: makeStates(n, sorted, { [root]: "swapping", [largest]: "swapping" }),
        description: `Heapify: swapped ${a[root]} and ${a[largest]}`,
        comparisons, swaps, pseudocodeLine: 5,
      });
      heapify(size, largest);
    }
  }

  // Build max-heap
  steps.push({ array: [...a], states: makeStates(n, sorted, {}), description: "Building max-heap...", comparisons, swaps, pseudocodeLine: 0 });
  for (let i = Math.floor(n / 2) - 1; i >= 0; i--) {
    heapify(n, i);
  }
  steps.push({ array: [...a], states: makeStates(n, sorted, { [0]: "minimum" }), description: `Max-heap built. Root ${a[0]} is the maximum.`, comparisons, swaps, pseudocodeLine: 1 });

  // Extract max repeatedly
  for (let i = n - 1; i > 0; i--) {
    swaps++;
    [a[0], a[i]] = [a[i], a[0]];
    sorted.add(i);
    steps.push({
      array: [...a],
      states: makeStates(n, sorted, { [0]: "swapping" }),
      description: `Moved max ${a[i]} to sorted position ${i}`,
      comparisons, swaps, pseudocodeLine: 3,
    });
    heapify(i, 0);
  }
  sorted.add(0);

  steps.push({ array: [...a], states: Array(n).fill("sorted"), description: "Array is fully sorted!", comparisons, swaps, pseudocodeLine: -1 });
  return steps;
}

export function getShellSortSteps(arr: number[]): SortStep[] {
  const steps: SortStep[] = [];
  const a = [...arr];
  const n = a.length;
  let comparisons = 0;
  let swaps = 0;

  let gap = Math.floor(n / 2);
  while (gap > 0) {
    steps.push({
      array: [...a],
      states: Array(n).fill("default"),
      description: `Shell Sort: gap = ${gap}`,
      comparisons, swaps, pseudocodeLine: 0,
    });

    for (let i = gap; i < n; i++) {
      const temp = a[i];
      let j = i;

      steps.push({
        array: [...a],
        states: makeStates(n, new Set<number>(), { [i]: "current" }),
        description: `Inserting ${temp} with gap ${gap}`,
        comparisons, swaps, pseudocodeLine: 3,
      });

      while (j >= gap && a[j - gap] > temp) {
        comparisons++;
        steps.push({
          array: [...a],
          states: makeStates(n, new Set<number>(), { [j - gap]: "comparing", [j]: "current" }),
          description: `${a[j - gap]} > ${temp}, shifting ${a[j - gap]} right by ${gap}`,
          comparisons, swaps, pseudocodeLine: 6,
        });
        swaps++;
        a[j] = a[j - gap];
        j -= gap;
        steps.push({
          array: [...a],
          states: makeStates(n, new Set<number>(), { [j]: "swapping" }),
          description: `Shifted element right`,
          comparisons, swaps, pseudocodeLine: 6,
        });
      }
      a[j] = temp;
    }

    gap = Math.floor(gap / 2);
  }

  steps.push({ array: [...a], states: Array(n).fill("sorted"), description: "Array is fully sorted!", comparisons, swaps, pseudocodeLine: -1 });
  return steps;
}

export function getCountingSortSteps(arr: number[]): SortStep[] {
  const steps: SortStep[] = [];
  const a = [...arr];
  const n = a.length;
  let comparisons = 0;
  let swaps = 0;

  const max = Math.max(...a);
  const count = new Array(max + 1).fill(0);

  // Count phase
  for (let i = 0; i < n; i++) {
    count[a[i]]++;
    steps.push({
      array: [...a],
      states: makeStates(n, new Set<number>(), { [i]: "current" }),
      description: `Counting: arr[${i}] = ${a[i]}, count[${a[i]}] = ${count[a[i]]}`,
      comparisons, swaps, pseudocodeLine: 1,
    });
  }

  // Prefix sum phase
  for (let i = 1; i <= max; i++) {
    count[i] += count[i - 1];
  }
  steps.push({
    array: [...a],
    states: Array(n).fill("comparing"),
    description: `Prefix sums computed. Now placing elements.`,
    comparisons, swaps, pseudocodeLine: 2,
  });

  // Placement phase
  const output = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    comparisons++;
    output[count[a[i]] - 1] = a[i];
    count[a[i]]--;
    steps.push({
      array: [...output],
      states: makeStates(n, new Set<number>(), { [count[a[i]]]: "swapping" }),
      description: `Placed ${a[i]} at output position ${count[a[i]]}`,
      comparisons, swaps: ++swaps, pseudocodeLine: 4,
    });
  }

  for (let i = 0; i < n; i++) a[i] = output[i];
  steps.push({ array: [...a], states: Array(n).fill("sorted"), description: "Array is fully sorted!", comparisons, swaps, pseudocodeLine: -1 });
  return steps;
}

export function getRadixSortSteps(arr: number[]): SortStep[] {
  const steps: SortStep[] = [];
  const a = [...arr];
  const n = a.length;
  let comparisons = 0;
  let swaps = 0;

  const max = Math.max(...a);

  for (let exp = 1; Math.floor(max / exp) > 0; exp *= 10) {
    steps.push({
      array: [...a],
      states: Array(n).fill("comparing"),
      description: `Sorting by digit position ${exp} (${exp === 1 ? "ones" : exp === 10 ? "tens" : "hundreds"})`,
      comparisons, swaps, pseudocodeLine: 0,
    });

    const output = new Array(n).fill(0);
    const count = new Array(10).fill(0);

    for (let i = 0; i < n; i++) {
      const d = Math.floor(a[i] / exp) % 10;
      count[d]++;
      steps.push({
        array: [...a],
        states: makeStates(n, new Set<number>(), { [i]: "current" }),
        description: `Digit of ${a[i]} at position ${exp}: ${d}`,
        comparisons, swaps, pseudocodeLine: 2,
      });
    }

    for (let i = 1; i < 10; i++) count[i] += count[i - 1];

    for (let i = n - 1; i >= 0; i--) {
      const d = Math.floor(a[i] / exp) % 10;
      output[count[d] - 1] = a[i];
      count[d]--;
      swaps++;
    }

    for (let i = 0; i < n; i++) a[i] = output[i];
    steps.push({
      array: [...a],
      states: Array(n).fill("swapping"),
      description: `After sorting by digit ${exp}: [${a.join(', ')}]`,
      comparisons, swaps, pseudocodeLine: 5,
    });
  }

  steps.push({ array: [...a], states: Array(n).fill("sorted"), description: "Array is fully sorted!", comparisons, swaps, pseudocodeLine: -1 });
  return steps;
}

export function getBucketSortSteps(arr: number[]): SortStep[] {
  const steps: SortStep[] = [];
  const a = [...arr];
  const n = a.length;
  let comparisons = 0;
  let swaps = 0;

  const max = Math.max(...a) + 1;
  const numBuckets = Math.max(Math.floor(Math.sqrt(n)), 1);
  const buckets: number[][] = Array.from({ length: numBuckets }, () => []);

  // Distribute
  for (let i = 0; i < n; i++) {
    const bi = Math.floor((a[i] / max) * numBuckets);
    const idx = Math.min(bi, numBuckets - 1);
    buckets[idx].push(a[i]);
    steps.push({
      array: [...a],
      states: makeStates(n, new Set<number>(), { [i]: "current" }),
      description: `Placing ${a[i]} into bucket ${idx}`,
      comparisons, swaps, pseudocodeLine: 1,
    });
  }

  steps.push({
    array: [...a],
    states: Array(n).fill("comparing"),
    description: `Elements distributed across ${numBuckets} buckets. Sorting each bucket...`,
    comparisons, swaps, pseudocodeLine: 3,
  });

  // Sort each bucket (insertion sort) and collect
  let writeIdx = 0;
  for (let b = 0; b < numBuckets; b++) {
    const bucket = buckets[b];
    // Insertion sort bucket
    for (let i = 1; i < bucket.length; i++) {
      const key = bucket[i];
      let j = i - 1;
      while (j >= 0 && bucket[j] > key) {
        comparisons++;
        bucket[j + 1] = bucket[j];
        j--;
        swaps++;
      }
      bucket[j + 1] = key;
    }

    // Write back to array
    for (const val of bucket) {
      a[writeIdx] = val;
      steps.push({
        array: [...a],
        states: makeStates(n, new Set(Array.from({ length: writeIdx + 1 }, (_, i) => i)), { [writeIdx]: "swapping" }),
        description: `Placing ${val} from bucket ${b} into position ${writeIdx}`,
        comparisons, swaps, pseudocodeLine: 4,
      });
      writeIdx++;
    }
  }

  steps.push({ array: [...a], states: Array(n).fill("sorted"), description: "Array is fully sorted!", comparisons, swaps, pseudocodeLine: -1 });
  return steps;
}

export function getTimSortSteps(arr: number[]): SortStep[] {
  const steps: SortStep[] = [];
  const a = [...arr];
  const n = a.length;
  let comparisons = 0;
  let swaps = 0;
  const sorted = new Set<number>();

  // Use a small RUN so phases are visible even for short demo arrays
  const RUN = Math.max(2, Math.min(4, Math.ceil(n / 3)));

  // ── Phase 1: insertion-sort each run ──────────────────────────────────────
  for (let start = 0; start < n; start += RUN) {
    const end = Math.min(start + RUN - 1, n - 1);

    steps.push({
      array: [...a],
      states: makeStates(n, sorted,
        Object.fromEntries(Array.from({ length: end - start + 1 }, (_, k) => [start + k, "comparing"]))
      ),
      description: `Phase 1: insertion-sorting run [${start}..${end}]`,
      comparisons, swaps, pseudocodeLine: 2,
    });

    for (let i = start + 1; i <= end; i++) {
      const key = a[i];
      let j = i - 1;

      steps.push({
        array: [...a],
        states: makeStates(n, sorted, { [i]: "current" }),
        description: `Key = ${key}`,
        comparisons, swaps, pseudocodeLine: 3,
      });

      while (j >= start && a[j] > key) {
        comparisons++;
        steps.push({
          array: [...a],
          states: makeStates(n, sorted, { [j]: "comparing", [j + 1]: "swapping" }),
          description: `${a[j]} > ${key}, shift right`,
          comparisons, swaps, pseudocodeLine: 4,
        });
        a[j + 1] = a[j];
        j--;
        swaps++;
      }
      a[j + 1] = key;
      steps.push({
        array: [...a],
        states: makeStates(n, sorted, { [j + 1]: "minimum" }),
        description: `Placed ${key} at index ${j + 1}`,
        comparisons, swaps, pseudocodeLine: 5,
      });
    }

    for (let i = start; i <= end; i++) sorted.add(i);
  }

  // ── Phase 2: merge runs bottom-up ─────────────────────────────────────────
  for (let size = RUN; size < n; size *= 2) {
    steps.push({
      array: [...a],
      states: Array(n).fill("comparing"),
      description: `Phase 2: merging runs of size ${size}`,
      comparisons, swaps, pseudocodeLine: 6,
    });

    for (let left = 0; left < n; left += 2 * size) {
      const mid = Math.min(left + size - 1, n - 1);
      const right = Math.min(left + 2 * size - 1, n - 1);
      if (mid >= right) continue;

      const L = a.slice(left, mid + 1);
      const R = a.slice(mid + 1, right + 1);
      let i = 0, j = 0, k = left;

      while (i < L.length && j < R.length) {
        comparisons++;
        steps.push({
          array: [...a],
          states: makeStates(n, new Set<number>(), {
            [left + i]: "comparing",
            [mid + 1 + j]: "comparing",
          }),
          description: `Merge: comparing ${L[i]} and ${R[j]}`,
          comparisons, swaps, pseudocodeLine: 7,
        });
        if (L[i] <= R[j]) { a[k++] = L[i++]; }
        else { a[k++] = R[j++]; swaps++; }
      }
      while (i < L.length) a[k++] = L[i++];
      while (j < R.length) a[k++] = R[j++];
    }
  }

  steps.push({ array: [...a], states: Array(n).fill("sorted"), description: "Array is fully sorted!", comparisons, swaps, pseudocodeLine: -1 });
  return steps;
}

export function getLogosSortSteps(arr: number[]): SortStep[] {
  const PHI = 0.6180339887498949;
  const BASE = 16;
  const steps: SortStep[] = [];
  const a = [...arr];
  const n = a.length;
  let comparisons = 0;
  let swaps = 0;
  const sorted = new Set<number>();

  function insertionSort(lo: number, hi: number) {
    for (let i = lo + 1; i <= hi; i++) {
      const key = a[i];
      let j = i - 1;
      while (j >= lo && a[j] > key) {
        comparisons++;
        steps.push({
          array: [...a],
          states: makeStates(n, sorted, { [j]: "comparing", [j + 1]: "current" }),
          description: `Insertion: ${a[j]} > ${key}, shift right`,
          comparisons, swaps, pseudocodeLine: 0,
        });
        a[j + 1] = a[j];
        swaps++;
        j--;
      }
      a[j + 1] = key;
    }
    for (let i = lo; i <= hi; i++) sorted.add(i);
  }

  const stack: [number, number][] = [[0, n - 1]];

  while (stack.length > 0) {
    let [lo, hi] = stack.pop()!;

    while (lo < hi) {
      if (hi - lo + 1 <= BASE) {
        insertionSort(lo, hi);
        steps.push({
          array: [...a],
          states: makeStates(n, sorted, {}),
          description: `Subarray [${lo}..${hi}] sorted by insertion sort`,
          comparisons, swaps, pseudocodeLine: 0,
        });
        break;
      }

      const pivotIdx = lo + Math.floor((hi - lo) * PHI);
      const pivot = a[pivotIdx];

      steps.push({
        array: [...a],
        states: makeStates(n, sorted, { [pivotIdx]: "pivot" }),
        description: `φ-pivot at index ${pivotIdx}: value ${pivot}  (lo=${lo}, hi=${hi})`,
        comparisons, swaps, pseudocodeLine: 1,
      });

      let lt = lo, gt = hi, i = lo;
      while (i <= gt) {
        comparisons++;
        if (a[i] < pivot) {
          steps.push({
            array: [...a],
            states: makeStates(n, sorted, { [i]: "comparing", [lt]: "swapping" }),
            description: `${a[i]} < pivot ${pivot} → swap arr[${i}] ↔ arr[${lt}]`,
            comparisons, swaps, pseudocodeLine: 4,
          });
          [a[lt], a[i]] = [a[i], a[lt]];
          swaps++;
          lt++; i++;
        } else if (a[i] > pivot) {
          steps.push({
            array: [...a],
            states: makeStates(n, sorted, { [i]: "comparing", [gt]: "swapping" }),
            description: `${a[i]} > pivot ${pivot} → swap arr[${i}] ↔ arr[${gt}]`,
            comparisons, swaps, pseudocodeLine: 5,
          });
          [a[i], a[gt]] = [a[gt], a[i]];
          swaps++;
          gt--;
        } else {
          steps.push({
            array: [...a],
            states: makeStates(n, sorted, { [i]: "minimum" }),
            description: `${a[i]} = pivot ${pivot} → equal region`,
            comparisons, swaps, pseudocodeLine: 6,
          });
          i++;
        }
      }

      for (let x = lt; x <= gt; x++) sorted.add(x);
      steps.push({
        array: [...a],
        states: makeStates(n, sorted, {}),
        description: `Partitioned: [${lo}..${lt - 1}] < ${pivot} | [${lt}..${gt}] = ${pivot} | [${gt + 1}..${hi}] > ${pivot}`,
        comparisons, swaps, pseudocodeLine: 7,
      });

      const hasLeft  = lo < lt;
      const hasRight = gt + 1 <= hi;
      if (!hasLeft && !hasRight) break;
      if (!hasLeft)  { lo = gt + 1; continue; }
      if (!hasRight) { hi = lt - 1; continue; }

      const leftSize  = lt - 1 - lo;
      const rightSize = hi - gt - 1;
      if (leftSize <= rightSize) {
        stack.push([lo, lt - 1]);
        lo = gt + 1;
      } else {
        stack.push([gt + 1, hi]);
        hi = lt - 1;
      }
    }

    if (lo === hi && !sorted.has(lo)) sorted.add(lo);
  }

  steps.push({
    array: [...a],
    states: Array(n).fill("sorted"),
    description: "Array is fully sorted!",
    comparisons, swaps, pseudocodeLine: -1,
  });
  return steps;
}

export function getSteps(algorithm: SortAlgorithm, arr: number[]): SortStep[] {
  switch (algorithm) {
    case "bubble":
      return getBubbleSortSteps(arr);
    case "selection":
      return getSelectionSortSteps(arr);
    case "insertion":
      return getInsertionSortSteps(arr);
    case "merge":
      return getMergeSortSteps(arr);
    case "quick":
      return getQuickSortSteps(arr);
    case "heap":
      return getHeapSortSteps(arr);
    case "shell":
      return getShellSortSteps(arr);
    case "counting":
      return getCountingSortSteps(arr);
    case "radix":
      return getRadixSortSteps(arr);
    case "bucket":
      return getBucketSortSteps(arr);
    case "timsort":
      return getTimSortSteps(arr);
    case "logos":
      return getLogosSortSteps(arr);
  }
}

export const BAR_COLORS: Record<BarState, string> = {
  default: "var(--color-state-default)",
  comparing: "var(--color-state-compare)",
  swapping: "var(--color-state-swap)",
  sorted: "var(--color-state-sorted)",
  minimum: "var(--color-state-min)",
  current: "var(--color-state-current)",
  pivot: "var(--color-state-pivot)",
};
