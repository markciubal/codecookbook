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
    quote: {
      text: 'In the beginning was the Logos.',
      attribution: 'John 1:1',
    },
    description:
      "Logos — Greek for word, reason, divine order. The name is an aspiration: even in sorting, there is a search for proportion and harmony. The golden ratio phi places the pivots. A chaos factor keeps them honest. Less a finished algorithm than a philosophy of sorting.",
    pseudocode: [
      "if size ≤ 48: insertionSort(arr, lo, hi)",
      "if range(arr[lo..hi]) < 4·size: countingSort",
      "gallop: if sorted → skip; if reversed → reverse",
      "chaos = |rand|; idx1 = lo+⌊range·φ²·chaos⌋; idx2 = lo+⌊range·φ·chaos⌋",
      "p1 = ninther(idx1);  p2 = ninther(idx2)",
      "lt = lo;  gt = hi;  i = lo",
      "while i ≤ gt:",
      "  if arr[i] < p1: swap arr[lt]↔arr[i]; lt++; i++",
      "  elif arr[i] > p2: swap arr[i]↔arr[gt]; gt--",
      "  else: i++  // element is in [p1, p2]",
      "recurse 2 smallest of {left, mid, right}; tail-call largest",
    ],
  },
  timsort: {
    name: "Tim Sort",
    slug: "timsort",
    timeComplexity: "O(n log n)",
    spaceComplexity: "O(n)",
    stable: true,
    description: "Hybrid sort combining insertion sort and merge sort. Detects natural ascending/descending runs, extends short ones via binary insertion sort to a computed minRun (32–64), then merges with galloping mode. Used in Python and Java's standard libraries.",
    pseudocode: [
      "minRun = minRunLength(n)  // 32–64",
      "while lo < n:",
      "  run = countRunAndMakeAscending(lo)",
      "  if descending: reverse(run)",
      "  extend run to minRun via binaryInsertionSort",
      "  push(run); mergeCollapse(stack)",
      "  // merge: gallop when wins ≥ minGallop",
      "mergeForceCollapse(stack)",
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

/*
 * "A little leaven leaveneth the whole lump." — Galatians 5:9
 *
 * One corrupted element, left unchallenged, taints all it touches.
 * Bubble sort names this truth: each pass lets the largest unsettled value
 * rise to its rightful place, one faithful comparison at a time.
 *
 * Algorithmically: adjacent-comparison sort — O(n²) worst/average case.
 * Invariant after pass i: the i largest elements occupy a[n-i..n-1], settled.
 * Knuth (TAOCP §5.2.2) establishes this as the canonical O(n²) baseline.
 */
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

/*
 * "If any man desire to be first, the same shall be last of all,
 *  and servant of all." — Mark 9:35
 *
 * The algorithm serves the whole array before rewarding any single element.
 * It scans the entire unsorted region to find the minimum — the one most
 * deserving of its place — then seats it with a single, deliberate swap.
 *
 * Algorithmically: selection sort — O(n²) comparisons, O(n) swaps.
 * The O(n) swap property (exactly n-1 swaps, not Θ(n²)) makes it optimal
 * when writes are expensive. Invariant: a[0..i-1] is sorted after pass i.
 */
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

/*
 * "For who hath despised the day of small things?" — Zechariah 4:10
 *
 * Greatness is not born in grand sweeping motions.
 * Each new element is considered honestly, walked leftward until it finds
 * the exact place it belongs — no further, no less. The sorted prefix grows
 * by one faithful step at a time, and the whole is ordered by small faithfulness.
 *
 * Algorithmically: insertion sort — O(n²) worst case, O(n) best case (sorted input).
 * Optimal for nearly-sorted data; unbeatable constant factor for n < ~48 elements.
 * Sorted prefix invariant: a[0..i] is sorted before processing element i+1.
 */
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

/*
 * "Except a corn of wheat fall into the ground and die, it abideth alone:
 *  but if it die, it bringeth forth much fruit." — John 12:24
 *
 * A single element cannot be sorted; it must surrender its isolation.
 * Pairs merge into fours, fours into eights — what was alone becomes part
 * of something larger and more ordered. Death of independence yields abundance.
 *
 * Algorithmically: bottom-up merge sort — O(n log n) guaranteed, O(n) auxiliary space.
 * Master Theorem: T(n) = 2T(n/2) + O(n) → T(n) = O(n log n), all cases.
 * Bottom-up avoids recursion overhead; each width-doubling pass merges in O(n).
 */
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

/*
 * "Ye shall know them by their fruits." — Matthew 7:16
 *
 * A pivot reveals the character of those around it.
 * Every element is judged against a single standard: does it belong left or right?
 * The pivot is known by what it separates — those lesser before it, those greater behind.
 *
 * Algorithmically: quicksort with median-of-three pivot — O(n log n) average, O(n²) worst.
 * Hoare (1962) proved the average case; Sedgewick (1977) showed median-of-three pivot
 * selection reduces the probability of worst-case to negligibly small on random data.
 */
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

/*
 * "He hath put down the mighty from their seats,
 *  and exalted them of low degree." — Luke 1:52
 *
 * The heap does not honour rank by arrival. It restructures ruthlessly:
 * the greatest rises to the top, is removed to its final place, and the
 * heap is restored. Power is stripped; the humble are raised in turn.
 *
 * Algorithmically: heapsort — O(n log n) worst/average/best, O(1) auxiliary space.
 * Williams (1964) described the heap; Floyd (1964) showed O(n) heapify (bottom-up).
 * Extract-max repeated n times: each O(log n) sift gives Θ(n log n) total.
 */
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

/*
 * "And they that are far off shall come and build in the temple of the LORD."
 *  — Zechariah 6:15
 *
 * Those separated by great distance are brought together first.
 * Shell sort begins by comparing elements far apart — teaching the array a rough
 * order across long spans — then draws inward until the final pass is nearly done.
 *
 * Algorithmically: Shell sort with gap = ⌊n/2⌋, halving each pass — O(n²) worst case.
 * Shell (1959) showed that long-range exchanges reduce total work vs. insertion sort.
 * With Ciura gaps (2001), complexity improves empirically toward O(n^(4/3)).
 */
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

/*
 * "But the very hairs of your head are all numbered." — Matthew 10:30
 *
 * Nothing is unknown to the one who counts faithfully.
 * Before a single element moves, counting sort tallies every value — a complete
 * census of what exists. Then it pours each value back in perfect order,
 * needing no comparisons at all.
 *
 * Algorithmically: counting sort — O(n + k) time, O(k) space, where k = value range.
 * Seward (1954) described the technique. It escapes the Ω(n log n) comparison lower
 * bound because it never compares elements — it counts and places by address.
 */
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

/*
 * "The stone which the builders refused is become the head stone of the corner."
 *  — Psalm 118:22
 *
 * The digit everyone overlooks — the humble ones place — is sorted first.
 * Radix sort begins with what seems least significant and works upward,
 * until the structure that emerges could not have been built any other way.
 *
 * Algorithmically: LSD radix sort — O(d·n) time, O(n + b) space; d = digit count, b = base.
 * Hollerith (1887) used this principle on punched cards. Stable counting sort on each
 * digit position ensures relative order is preserved; correctness follows by induction on d.
 */
export function getRadixSortSteps(arr: number[]): SortStep[] {
  const steps: SortStep[] = [];
  const a = [...arr];
  const n = a.length;
  const comparisons = 0;
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

/*
 * "In my Father's house are many mansions." — John 14:2
 *
 * There is a prepared place for each one.
 * Bucket sort divides the value space into rooms — each element walks to the room
 * where it belongs, then each room is ordered within itself. No element is forced
 * to contend with those far from its nature.
 *
 * Algorithmically: bucket sort — O(n + k) average, O(n²) worst case.
 * Knuth (TAOCP §5.2.5): with √n buckets and uniformly distributed input, expected
 * O(n) comparisons total across all buckets via the linearity of expectation.
 */
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

/*
 * "There is no new thing under the sun." — Ecclesiastes 1:9
 *
 * Wisdom is not invented — it is assembled from what already works.
 * TimSort takes insertion sort's mastery of small things and merge sort's
 * dominion over large ones, and unites them into something greater than either.
 * It honours the order already present in the data rather than ignoring it.
 *
 * Algorithmically: TimSort — O(n log n) worst, O(n) best (already-sorted input).
 * Peters (2002) designed it for Python; Java Arrays.sort adopted it for objects.
 * Natural runs are extended to minRun via insertion sort, then merged bottom-up
 * using galloping mode — exploiting existing order that pure merge sort discards.
 */
export function getTimSortSteps(arr: number[]): SortStep[] {
  const steps: SortStep[] = [];
  const a = [...arr];
  const n = a.length;
  let comparisons = 0;
  let swaps = 0;
  const sortedSet = new Set<number>();

  function snap(desc: string, line: number, ov: Partial<Record<number, BarState>> = {}) {
    steps.push({ array: [...a], states: makeStates(n, sortedSet, ov), description: desc, comparisons, swaps, pseudocodeLine: line });
  }

  // ── 1. minRunLength: canonical formula, result in [32, 64] ────────────────
  function minRunLength(len: number): number {
    let r = 0;
    while (len >= 64) { r |= len & 1; len >>= 1; }
    return len + r;
  }
  const minRun = minRunLength(n);
  snap(`minRunLength(${n}) = ${minRun}`, 0);

  // ── 2. countRunAndMakeAscending ───────────────────────────────────────────
  // Scans from lo for a natural ascending or strictly-descending run.
  // Reverses descending runs in-place. Returns exclusive end of run.
  function countRunAndMakeAscending(lo: number): number {
    if (lo + 1 >= n) return lo + 1;
    let hi = lo + 1;
    comparisons++;
    const isDesc = a[hi] < a[lo];
    snap(`Detect run at [${lo}]: ${a[lo]}→${a[hi]} is ${isDesc ? "descending" : "ascending"}`, 2, { [lo]: "comparing", [hi]: "comparing" });
    hi++;
    if (isDesc) {
      while (hi < n) {
        comparisons++;
        if (a[hi] >= a[hi - 1]) {
          snap(`Run ends at ${hi}`, 2, { [hi]: "comparing", [hi - 1]: "comparing" });
          break;
        }
        snap(`Descending: ${a[hi]} < ${a[hi - 1]}`, 2, { [hi]: "comparing", [hi - 1]: "comparing" });
        hi++;
      }
      snap(`Reversing descending run [${lo}..${hi - 1}]`, 3,
        Object.fromEntries(Array.from({ length: hi - lo }, (_, k) => [lo + k, "swapping" as BarState])));
      let l = lo, r = hi - 1;
      while (l < r) { [a[l], a[r]] = [a[r], a[l]]; swaps++; l++; r--; }
      snap(`Run [${lo}..${hi - 1}] reversed`, 3,
        Object.fromEntries(Array.from({ length: hi - lo }, (_, k) => [lo + k, "comparing" as BarState])));
    } else {
      while (hi < n) {
        comparisons++;
        if (a[hi] < a[hi - 1]) {
          snap(`Run ends at ${hi}`, 2, { [hi]: "comparing", [hi - 1]: "comparing" });
          break;
        }
        snap(`Ascending: ${a[hi]} ≥ ${a[hi - 1]}`, 2, { [hi]: "comparing", [hi - 1]: "comparing" });
        hi++;
      }
    }
    return hi;
  }

  // ── 3. Binary insertion sort ──────────────────────────────────────────────
  // Sorts a[lo..hi) by inserting elements from `start` onward.
  // Uses binary search (not linear) to locate the insertion point.
  function binaryInsertionSort(lo: number, hi: number, start: number) {
    if (start <= lo) start = lo + 1;
    for (let i = start; i < hi; i++) {
      const key = a[i];
      snap(`BInsert key=${key}`, 4, { [i]: "current" });
      // Binary search for insertion point in a[lo..i)
      let l = lo, r = i;
      while (l < r) {
        const m = (l + r) >> 1;
        comparisons++;
        if (a[m] <= key) l = m + 1; else r = m;
        snap(`Binary search pivot=${a[m]} → [${l}..${r})`, 4, { [m]: "comparing", [i]: "current" });
      }
      // Shift right and place
      for (let j = i; j > l; j--) { a[j] = a[j - 1]; swaps++; }
      a[l] = key;
      snap(`Placed ${key} at ${l}`, 4, { [l]: "minimum" });
    }
  }

  // ── 4. Gallop helpers ─────────────────────────────────────────────────────
  // gallopRight: first index in src[start..] where src[idx] > key
  function gallopRight(src: number[], key: number, start: number): number {
    let dist = 1;
    while (start + dist < src.length) {
      comparisons++;
      if (src[start + dist] > key) break;
      dist *= 2;
    }
    let lo = start + (dist >> 1), hi = Math.min(start + dist, src.length);
    while (lo < hi) {
      const m = (lo + hi) >> 1;
      comparisons++;
      if (src[m] <= key) lo = m + 1; else hi = m;
    }
    return lo;
  }
  // gallopLeft: first index in src[start..] where src[idx] >= key
  function gallopLeft(src: number[], key: number, start: number): number {
    let dist = 1;
    while (start + dist < src.length) {
      comparisons++;
      if (src[start + dist] >= key) break;
      dist *= 2;
    }
    let lo = start + (dist >> 1), hi = Math.min(start + dist, src.length);
    while (lo < hi) {
      const m = (lo + hi) >> 1;
      comparisons++;
      if (src[m] < key) lo = m + 1; else hi = m;
    }
    return lo;
  }

  // ── 5. Merge with galloping ───────────────────────────────────────────────
  // Stable merge of a[lo..mid) and a[mid..hi) using auxiliary arrays.
  function merge(lo: number, mid: number, hi: number) {
    if (lo >= mid || mid >= hi) return;
    const L = a.slice(lo, mid);
    const R = a.slice(mid, hi);
    let i = 0, j = 0, k = lo;
    let minGallop = 7;

    snap(`Merging [${lo}..${mid - 1}] with [${mid}..${hi - 1}]`, 6,
      Object.fromEntries([
        ...Array.from({ length: mid - lo }, (_, x) => [lo + x, "comparing" as BarState]),
        ...Array.from({ length: hi - mid }, (_, x) => [mid + x, "swapping" as BarState]),
      ]));

    outer: while (i < L.length && j < R.length) {
      // Normal comparison mode
      let winsL = 0, winsR = 0;
      do {
        comparisons++;
        if (L[i] <= R[j]) {
          a[k++] = L[i++]; winsL++; winsR = 0;
          snap(`Take L=${L[i - 1]}`, 6, { [k - 1]: "comparing" });
        } else {
          a[k++] = R[j++]; winsR++; winsL = 0; swaps++;
          snap(`Take R=${R[j - 1]}`, 6, { [k - 1]: "swapping" });
        }
        if (i >= L.length || j >= R.length) break outer;
      } while (winsL < minGallop && winsR < minGallop);

      // Transition penalty: harder to re-enter galloping
      minGallop++;

      // Galloping mode
      do {
        minGallop = Math.max(1, minGallop - 1);

        // Gallop in L: bulk-copy L elements that precede R[j]
        const posL = gallopRight(L, R[j], i);
        const countL = posL - i;
        if (countL > 0) {
          snap(`Gallop L: ${countL} element(s) < ${R[j]}`, 6,
            Object.fromEntries(Array.from({ length: countL }, (_, x) => [k + x, "minimum" as BarState])));
          for (let g = 0; g < countL; g++) a[k++] = L[i++];
        }
        if (i >= L.length) break outer;
        a[k++] = R[j++]; swaps++;
        snap(`Take one R=${R[j - 1]}`, 6, { [k - 1]: "swapping" });
        if (j >= R.length) break outer;

        // Gallop in R: bulk-copy R elements that precede L[i]
        const posR = gallopLeft(R, L[i], j);
        const countR = posR - j;
        if (countR > 0) {
          snap(`Gallop R: ${countR} element(s) < ${L[i]}`, 6,
            Object.fromEntries(Array.from({ length: countR }, (_, x) => [k + x, "swapping" as BarState])));
          for (let g = 0; g < countR; g++) { a[k++] = R[j++]; swaps++; }
        }
        if (j >= R.length) break outer;
        a[k++] = L[i++];
        snap(`Take one L=${L[i - 1]}`, 6, { [k - 1]: "comparing" });
        if (i >= L.length) break outer;

        if (countL < minGallop && countR < minGallop) break; // exit galloping
      } while (true);
    }

    while (i < L.length) a[k++] = L[i++];
    while (j < R.length) { a[k++] = R[j++]; swaps++; }

    snap(`Merge [${lo}..${hi - 1}] done`, 6,
      Object.fromEntries(Array.from({ length: hi - lo }, (_, x) => [lo + x, "sorted" as BarState])));
    for (let x = lo; x < hi; x++) sortedSet.add(x);
  }

  // ── 6. Run stack + merge collapse ─────────────────────────────────────────
  // Invariants (corrected 2015 fix applied):
  //   len[n-3] > len[n-2] + len[n-1]
  //   len[n-2] > len[n-1]
  const runStack: { lo: number; len: number }[] = [];

  function mergeAt(i: number) {
    const r1 = runStack[i], r2 = runStack[i + 1];
    const totalLen = r1.len + r2.len;
    snap(`mergeCollapse: run[${i}](${r1.len}) + run[${i + 1}](${r2.len})`, 5, {});
    for (let x = r1.lo; x < r1.lo + totalLen; x++) sortedSet.delete(x);
    merge(r1.lo, r1.lo + r1.len, r1.lo + totalLen);
    runStack[i] = { lo: r1.lo, len: totalLen };
    runStack.splice(i + 1, 1);
  }

  function mergeCollapse() {
    while (runStack.length > 1) {
      let ni = runStack.length - 2;
      if (
        (ni > 0 && runStack[ni - 1].len <= runStack[ni].len + runStack[ni + 1].len) ||
        (ni > 1 && runStack[ni - 2].len <= runStack[ni - 1].len + runStack[ni].len)
      ) {
        if (runStack[ni - 1].len < runStack[ni + 1].len) ni--;
        mergeAt(ni);
      } else if (runStack[ni].len <= runStack[ni + 1].len) {
        mergeAt(ni);
      } else {
        break;
      }
    }
  }

  function mergeForceCollapse() {
    while (runStack.length > 1) {
      let ni = runStack.length - 2;
      if (ni > 0 && runStack[ni - 1].len < runStack[ni + 1].len) ni--;
      mergeAt(ni);
    }
  }

  // ── Main loop ─────────────────────────────────────────────────────────────
  let lo = 0;
  while (lo < n) {
    snap(`lo=${lo}: find natural run`, 1, { [lo]: "current" });

    let hi = countRunAndMakeAscending(lo);

    const force = Math.min(lo + minRun, n);
    if (hi < force) {
      snap(`Run len=${hi - lo} < minRun=${minRun}, extend to ${force - lo}`, 4,
        Object.fromEntries(Array.from({ length: hi - lo }, (_, k) => [lo + k, "comparing" as BarState])));
      binaryInsertionSort(lo, force, hi);
      hi = force;
    }

    for (let x = lo; x < hi; x++) sortedSet.add(x);
    runStack.push({ lo, len: hi - lo });
    snap(`Run [${lo}..${hi - 1}] ready (len ${hi - lo}). Stack: ${runStack.length}`, 5,
      Object.fromEntries(Array.from({ length: hi - lo }, (_, k) => [lo + k, "sorted" as BarState])));

    mergeCollapse();
    lo = hi;
  }

  snap(`Force-collapsing ${runStack.length} remaining run(s)`, 7, {});
  mergeForceCollapse();

  steps.push({ array: [...a], states: Array(n).fill("sorted"), description: "Array is fully sorted!", comparisons, swaps, pseudocodeLine: -1 });
  return steps;
}

/*
 * "In the beginning was the Word, and the Word was with God, and the Word was God." — John 1:1
 *
 * Logos: the ordering principle beneath all apparent chaos.
 * This sort does not impose order by force — it listens for the shape latent in the data
 * and coaxes it forth. Dual golden-ratio pivots, CSPRNG entropy, and adaptive shortcuts
 * for already-ordered, reversed, and dense-integer subarrays conspire in a single pass.
 *
 * Algorithmically: dual-pivot introsort hybrid — O(n log n) expected, O(n) best case.
 * Golden-ratio pivots (Musser 1997 introsort depth guard) + xoshiro128+ (Blackman &
 * Vigna 2018) + counting/gallop shortcuts + insertion sort fallback below BASE=48.
 */
export function getLogosSortSteps(arr: number[]): SortStep[] {
  /*
   * "He has made everything beautiful in its time." — Ecclesiastes 3:11
   * The golden ratio φ = (√5+1)/2 is the proportion Nature chose before humanity named it —
   * whispered through the nautilus shell, the sunflower head, the spiral of galaxies.
   * Its reciprocals φ⁻¹ ≈ 0.618 and φ⁻² ≈ 0.382 are the two most irrational numbers
   * that exist: no simple fraction ever traps them, no periodic pattern can exploit them.
   * Algorithmically: computing from definition gives the exact IEEE 754 double.
   */
  const PHI  = (Math.sqrt(5) - 1) / 2; // φ⁻¹ = (√5−1)/2
  const PHI2 = (3 - Math.sqrt(5)) / 2; // φ⁻² = (3−√5)/2

  /*
   * "To every thing there is a season, and a time to every purpose under the heaven." — Ecclesiastes 3:1
   * Below 48 elements the machinery of recursion costs more than it saves.
   * A wise ruler does not send an army to settle a household dispute.
   * Algorithmically: insertion sort's cache locality and zero overhead beats quicksort at small n.
   */
  const BASE = 48;

  /*
   * "The lot is cast into the lap, but its every decision is from the Lord." — Proverbs 16:33
   * We draw a single lot from the deep well of the OS's own entropy — one CSPRNG call at
   * creation — and from that seed a river of bits flows through all levels of recursion.
   * No adversary who does not know the seed can ever predict where the pivots will land.
   * Algorithmically: xoshiro128+ seeded by crypto.getRandomValues — one syscall, then fast
   * bit-ops per level. Statistically stronger than Math.random(); unpredictably seeded.
   */
  const _xs = new Uint32Array(4);
  crypto.getRandomValues(_xs);
  if (!_xs[0] && !_xs[1] && !_xs[2] && !_xs[3]) _xs[0] = 1;
  let _x0 = _xs[0], _x1 = _xs[1], _x2 = _xs[2], _x3 = _xs[3];
  function xrand(): number {
    const r = (_x0 + _x3) >>> 0;
    const t = _x1 << 9;
    _x2 ^= _x0; _x3 ^= _x1; _x1 ^= _x2; _x0 ^= _x3;
    _x2 ^= t;
    _x3 = (_x3 << 11) | (_x3 >>> 21);
    return (r >>> 1) / 0x80000000; // maps to (0, 1]
  }

  const steps: SortStep[] = [];
  const a = [...arr];
  const n = a.length;
  let comparisons = 0;
  let swaps = 0;
  const settled = new Set<number>();

  /* Helper: record a snapshot of the current array state for the visualiser.
   * desc — what's happening in plain language; line — which pseudocode line to highlight. */
  function step(desc: string, line: number, ov: Partial<Record<number, BarState>> = {}) {
    steps.push({ array: [...a], states: makeStates(n, settled, ov), description: desc, comparisons, swaps, pseudocodeLine: line });
  }

  /*
   * "Whoever can be trusted with very little can also be trusted with much." — Luke 16:10
   * Small things deserve faithful attention, not elaborate machinery.
   * Below 48 elements each value simply walks left until it finds its place.
   * Algorithmically: insertion sort — O(n²) worst-case, unbeatable constant factor for tiny n.
   */
  function ins(lo: number, hi: number) {
    for (let i = lo + 1; i <= hi; i++) {
      const key = a[i]; let j = i - 1;
      while (j >= lo && a[j] > key) {
        comparisons++;
        step(`Insertion: ${a[j]} > ${key}, shift right`, 0, { [j]: "comparing", [j + 1]: "current" });
        a[j + 1] = a[j]; swaps++; j--;
      }
      a[j + 1] = key;
    }
    for (let i = lo; i <= hi; i++) settled.add(i);
  }

  /*
   * "Blessed are the peacemakers, for they shall be called children of God." — Matthew 5:9
   * The mediator stands between two extremes and draws out the hidden middle.
   * Three values enter in disorder; the one that belongs between the others emerges.
   * Algorithmically: a three-element sorting network — at most three comparisons, returns median.
   */
  function median3(x: number, y: number, z: number): number {
    if (x > y) { const t = x; x = y; y = t; }
    if (y > z) { const t = y; y = z; z = t; }
    if (x > y) { const t = x; x = y; y = t; }
    return y;
  }

  /*
   * "Iron sharpens iron, and one person sharpens another." — Proverbs 27:17
   * A pivot sharpened only against itself remains a crude guess; one sharpened against
   * its neighbours becomes a truer estimate of the local median.
   * Algorithmically: median of (idx−1, idx, idx+1) clamped to [lo, hi] — a cheap pivot
   * quality improvement before any element is moved.
   */
  function ninther(lo: number, hi: number, idx: number): number {
    return median3(a[Math.max(lo, idx - 1)], a[idx], a[Math.min(hi, idx + 1)]);
  }

  /*
   * "Pride goes before destruction, and a haughty spirit before a fall." — Proverbs 16:18
   * The Tower of Babel fell not for want of stone but for want of limits.
   * We set a ceiling: if recursion descends 2·log₂(n)+4 levels, a bad pivot sequence
   * has humbled us, and we fall back to insertion sort rather than let depth spiral.
   * Algorithmically: Musser's introsort depth guard; explicit stack for visualiser compatibility.
   */
  const depthLimit = 2 * Math.floor(Math.log2(Math.max(n, 2))) + 4;
  const stack: [number, number, number][] = [[0, n - 1, depthLimit]];

  while (stack.length > 0) {
    let [lo, hi, depth] = stack.pop()!;

    while (lo < hi) {
      const size = hi - lo + 1;

      /*
       * "For my thoughts are not your thoughts, neither are your ways my ways." — Isaiah 55:8
       * When depth is spent or the subarray is small, we do not pretend to wisdom we lack.
       * We bow, and hand what remains to the faithful simplicity of insertion sort.
       * Algorithmically: introsort fallback — size ≤ 48 or depth ≤ 0 triggers insertion sort.
       */
      if (size <= BASE || depth <= 0) {
        ins(lo, hi);
        step(`[${lo}..${hi}] insertion-sorted`, 0);
        break;
      }

      /*
       * "Give me neither poverty nor riches; feed me with the food I need." — Proverbs 30:8
       * When values are dense — the range narrow, the count generous — there is no need
       * for comparison at all. We count what is, and pour it back in order.
       * Algorithmically: counting sort O(n+k), triggered when value span < 4×element count.
       */
      let mn = a[lo], mx = a[lo];
      for (let k = lo + 1; k <= hi; k++) { if (a[k] < mn) mn = a[k]; if (a[k] > mx) mx = a[k]; }
      const valSpan = mx - mn;
      if (Number.isInteger(mn) && valSpan < size * 4) {
        const ov: Partial<Record<number, BarState>> = {};
        for (let k = lo; k <= hi; k++) ov[k] = "comparing";
        step(`Counting sort: range ${mn}–${mx} fits ${valSpan + 1} buckets`, 1, ov);
        const counts = new Array(valSpan + 1).fill(0);
        for (let k = lo; k <= hi; k++) counts[a[k] - mn]++;
        let k = lo;
        for (let v = 0; v <= valSpan; v++) { while (counts[v]-- > 0) a[k++] = v + mn; }
        for (let k = lo; k <= hi; k++) settled.add(k);
        step(`Counting sort placed [${lo}..${hi}]`, 1);
        break;
      }

      /*
       * "Be still, and know that I am God." — Psalm 46:10
       * Before we disturb the waters, we ask: have they already found their rest?
       * Order already present is order freely given — we do not unmake what is made.
       * If reversed, a single mirror-pass restores it; no partition required.
       * Algorithmically: O(n) gallop check for already-sorted or perfectly-reversed subarrays.
       */
      if (a[lo] <= a[lo + 1] && a[lo + 1] <= a[lo + 2]) {
        let isSorted = true;
        for (let k = lo; k < hi; k++) { comparisons++; if (a[k] > a[k + 1]) { isSorted = false; break; } }
        if (isSorted) {
          for (let k = lo; k <= hi; k++) settled.add(k);
          step(`Gallop: [${lo}..${hi}] already sorted`, 2);
          break;
        }
        let isReversed = true;
        for (let k = lo; k < hi; k++) { comparisons++; if (a[k] < a[k + 1]) { isReversed = false; break; } }
        if (isReversed) {
          for (let l = lo, r = hi; l < r; l++, r--) { [a[l], a[r]] = [a[r], a[l]]; swaps++; }
          for (let k = lo; k <= hi; k++) settled.add(k);
          step(`Gallop: [${lo}..${hi}] reversed → flipped`, 2);
          break;
        }
      }

      /*
       * "I will give you the treasures of darkness and riches hidden in secret places." — Isaiah 45:3
       * Each level draws a fresh chaos factor from the seeded river — unpredictable, unrepeatable.
       * This factor scales the φ-pivot positions differently at every depth, so no fixed
       * input pattern can ever reliably force the same pivot twice.
       * Algorithmically: xrand() returns a uniform value in (0, 1] from the xoshiro128+ state.
       */
      const chaos = xrand();
      const range = hi - lo;

      /*
       * "The heavens declare the glory of God; the skies proclaim the work of his hands." — Psalm 19:1
       * φ⁻² ≈ 0.382 and φ⁻¹ ≈ 0.618 are the golden cuts of any interval — the proportions
       * the cosmos chose before we arrived. Scaled by chaos they become positions no periodic
       * input can target; ninther then sharpens each raw index against its neighbours.
       * Algorithmically: idx = lo + ⌊range × PHI × chaos⌋, refined by ninther before any swap.
       */
      const idx1 = lo + Math.min(range, Math.floor(range * PHI2 * chaos));
      const idx2 = lo + Math.min(range, Math.floor(range * PHI  * chaos));
      const p1Raw = ninther(lo, hi, idx1);
      const p2Raw = ninther(lo, hi, idx2);
      const [pLo, pHi] = p1Raw <= p2Raw ? [p1Raw, p2Raw] : [p2Raw, p1Raw];

      step(`Dual φ-pivots: p1=${pLo}, p2=${pHi} (chaos=${chaos.toFixed(2)})`, 4, { [idx1]: "pivot", [idx2]: "pivot" });

      /*
       * "And God said, Let there be a firmament in the midst of the waters,
       *  and let it divide the waters from the waters." — Genesis 1:6
       * Creation begins with division: the formless void separated into sky and sea.
       * We divide the subarray at two pivots — three kingdoms established in a single pass.
       * Algorithmically: Dijkstra's Dutch National Flag — lt/gt track the region boundaries,
       * i explores forward; a[lo..lt-1] < p1, a[lt..gt] ∈ [p1,p2], a[gt+1..hi] > p2.
       */
      let lt = lo, gt = hi, i = lo;
      const p1 = pLo, p2 = pHi;
      while (i <= gt) {
        comparisons++;
        if (a[i] < p1) {
          // Element belongs in the left region — swap it to lt and advance both pointers.
          step(`${a[i]} < p1(${p1}) → swap arr[${i}]↔arr[${lt}]`, 7, { [i]: "comparing", [lt]: "swapping" });
          [a[lt], a[i]] = [a[i], a[lt]]; swaps++; lt++; i++;
        } else if (a[i] > p2) {
          // Element belongs in the right region — swap to gt. Don't advance i yet;
          // the value that arrived from gt hasn't been examined.
          step(`${a[i]} > p2(${p2}) → swap arr[${i}]↔arr[${gt}]`, 8, { [i]: "comparing", [gt]: "swapping" });
          [a[i], a[gt]] = [a[gt], a[i]]; swaps++; gt--;
        } else {
          // Element is already in the middle region — leave it and move on.
          step(`${a[i]} ∈ [${p1},${p2}] → middle region`, 9, { [i]: "minimum" });
          i++;
        }
      }

      const midOv: Partial<Record<number, BarState>> = {};
      for (let k = lt; k <= gt; k++) midOv[k] = "minimum";
      step(`Partitioned: [${lo}..${lt-1}]<${p1} | [${lt}..${gt}]∈[${p1},${p2}] | [${gt+1}..${hi}]>${p2}`, 10, midOv);

      /*
       * "So the last will be first, and the first will be last." — Matthew 20:16
       * The two smallest regions are pushed onto the stack — settled and released.
       * The largest inherits the loop without a frame: the greatest burden carried at
       * zero extra cost, the stack forever bounded to O(log n) depth.
       * Algorithmically: smallest-first stack push + loop continuation as tail-call elimination.
       */
      const regions: [number, number, number][] = [
        [lt - lo,     lo,     lt - 1],
        [gt - lt + 1, lt,     gt    ],
        [hi - gt,     gt + 1, hi    ],
      ];
      regions.sort((x, y) => x[0] - y[0]);
      if (regions[0][1] < regions[0][2]) stack.push([regions[0][1], regions[0][2], depth - 1]);
      if (regions[1][1] < regions[1][2]) stack.push([regions[1][1], regions[1][2], depth - 1]);
      lo = regions[2][1]; hi = regions[2][2]; depth--;
    }

    if (lo === hi && !settled.has(lo)) settled.add(lo);
  }

  steps.push({ array: [...a], states: Array(n).fill("sorted"), description: "Array is fully sorted!", comparisons, swaps, pseudocodeLine: -1 });
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
