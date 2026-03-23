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
  cocktail: {
    name: "Cocktail Shaker Sort",
    slug: "cocktail",
    timeComplexity: "O(n²)",
    spaceComplexity: "O(1)",
    stable: true,
    description: "A bidirectional bubble sort that alternates forward and backward passes. Each forward pass bubbles the largest unsorted element right; each backward pass bubbles the smallest left. Eliminates the 'turtle' problem — small values near the end that standard bubble sort moves agonizingly slowly.",
    pseudocode: [
      "left = 0; right = n−1",
      "while left < right:",
      "  for i = left to right−1:",
      "    if arr[i] > arr[i+1]: swap",
      "  right−−",
      "  for i = right downto left+1:",
      "    if arr[i] < arr[i−1]: swap",
      "  left++",
    ],
  },
  comb: {
    name: "Comb Sort",
    slug: "comb",
    timeComplexity: "O(n²)",
    spaceComplexity: "O(1)",
    stable: false,
    description: "Improves bubble sort by comparing elements separated by a shrinking gap (initial gap ≈ n, shrink factor 1.3) rather than only adjacent pairs. Long-range comparisons eliminate large inversions early; the gap shrinks until it reaches 1 at which point it becomes standard bubble sort. Shrink factor 1.3 is empirically optimal — gaps 9 and 10 are traditionally skipped.",
    pseudocode: [
      "gap = n; shrink = 1.3",
      "while not sorted:",
      "  gap = floor(gap / shrink)",
      "  if gap ≤ 1: gap = 1; mark sorted",
      "  for i = 0 to n−gap−1:",
      "    if arr[i] > arr[i+gap]: swap; mark unsorted",
    ],
  },
  gnome: {
    name: "Gnome Sort",
    slug: "gnome",
    timeComplexity: "O(n²)",
    spaceComplexity: "O(1)",
    stable: true,
    description: "The simplest possible sorting algorithm — a single pointer advances if the current pair is in order, or swaps and retreats if not. Named for a Dutch garden gnome sorting flower pots by walking backward until finding the right spot. No nested loops, no auxiliary structures. Online: handles elements appended to the end.",
    pseudocode: [
      "pos = 0",
      "while pos < n:",
      "  if pos == 0 or arr[pos] ≥ arr[pos−1]:",
      "    pos += 1",
      "  else:",
      "    swap(arr[pos], arr[pos−1])",
      "    pos −= 1",
    ],
  },
  pancake: {
    name: "Pancake Sort",
    slug: "pancake",
    timeComplexity: "O(n²)",
    spaceComplexity: "O(1)",
    stable: false,
    description: "The only allowed operation is flip(k) — reversing the prefix arr[0..k]. To place each maximum: scan for it, flip it to position 0, then flip it down to its final position. At most 2(n−1) flips total. Posed by Jacob Goodman in 1975; analyzed by Gates and Papadimitriou in 1979. Dramatic prefix reversals make it the most visually striking simple sort.",
    pseudocode: [
      "for size = n downto 2:",
      "  maxIdx = index of max in arr[0..size−1]",
      "  if maxIdx == size−1: continue",
      "  if maxIdx ≠ 0: flip(arr, maxIdx)",
      "  flip(arr, size−1)",
      "",
      "flip(arr, k): reverse arr[0..k]",
    ],
  },
  cycle: {
    name: "Cycle Sort",
    slug: "cycle",
    timeComplexity: "O(n²)",
    spaceComplexity: "O(1)",
    stable: false,
    description: "Minimizes array writes by exploiting permutation cycle theory. Any permutation decomposes into disjoint cycles; cycle sort traces each cycle and writes each element directly to its correct position exactly once — achieving the theoretical minimum number of writes. Originally published in 1986 in Byte Magazine as 'An Efficient Algorithm for Sorting with Minimal Writing.'",
    pseudocode: [
      "for cycleStart = 0 to n−2:",
      "  item = arr[cycleStart]",
      "  pos = cycleStart + count(arr[i] < item, i > cycleStart)",
      "  if pos == cycleStart: continue",
      "  while item == arr[pos]: pos++",
      "  swap arr[pos] ↔ item",
      "  while pos ≠ cycleStart:",
      "    pos = cycleStart + count(arr[i] < item, i > cycleStart)",
      "    while item == arr[pos]: pos++",
      "    swap arr[pos] ↔ item",
    ],
  },
  oddeven: {
    name: "Odd-Even Sort",
    slug: "oddeven",
    timeComplexity: "O(n²)",
    spaceComplexity: "O(1)",
    stable: true,
    description: "Alternates between two phases — odd phase compares pairs (arr[1],arr[2]), (arr[3],arr[4])..., even phase compares (arr[0],arr[1]), (arr[2],arr[3]).... On parallel hardware each phase runs in O(1), giving O(n) total. Sequentially O(n²). Developed by Habermann in 1972 for systolic array architectures. Also called brick sort for its staggered comparison pattern.",
    pseudocode: [
      "while not sorted:",
      "  sorted = true",
      "  // Odd phase: pairs (1,2),(3,4),(5,6)...",
      "  for i = 1,3,5,... to n−2:",
      "    if arr[i] > arr[i+1]: swap; sorted = false",
      "  // Even phase: pairs (0,1),(2,3),(4,5)...",
      "  for i = 0,2,4,... to n−2:",
      "    if arr[i] > arr[i+1]: swap; sorted = false",
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
 * Bubble sort steps.
 *
 * Each pass lets the largest unsorted element drift to its final position
 * through adjacent swaps. Nothing is carried — everything moves by local contact.
 *
 * Invariant after pass i: the i largest elements occupy a[n-i..n-1], settled.
 * After n−1 passes the array is sorted.
 */
export function getBubbleSortSteps(arr: number[]): SortStep[] {
  const steps: SortStep[] = [];
  const arr2 = [...arr];
  const size = arr2.length;
  const sorted = new Set<number>();
  let comparisons = 0;
  let swaps = 0;

  for (let pass = 0; pass < size - 1; pass++) {
    for (let pairIndex = 0; pairIndex < size - pass - 1; pairIndex++) {
      comparisons++;
      steps.push({
        array: [...arr2],
        states: makeStates(size, sorted, { [pairIndex]: "comparing", [pairIndex + 1]: "comparing" }),
        description: `Pass ${pass + 1}: comparing ${arr2[pairIndex]} and ${arr2[pairIndex + 1]}`,
        comparisons,
        swaps,
        pseudocodeLine: 2,
      });

      if (arr2[pairIndex] > arr2[pairIndex + 1]) {
        swaps++;
        [arr2[pairIndex], arr2[pairIndex + 1]] = [arr2[pairIndex + 1], arr2[pairIndex]];
        steps.push({
          array: [...arr2],
          states: makeStates(size, sorted, { [pairIndex]: "swapping", [pairIndex + 1]: "swapping" }),
          description: `Swapped → ${arr2[pairIndex]} and ${arr2[pairIndex + 1]}`,
          comparisons,
          swaps,
          pseudocodeLine: 3,
        });
      }
    }
    sorted.add(size - 1 - pass);
  }
  sorted.add(0);

  steps.push({
    array: [...arr2],
    states: Array(size).fill("sorted"),
    description: "Array is fully sorted!",
    comparisons,
    swaps,
    pseudocodeLine: -1,
  });

  return steps;
}

/*
 * Selection sort steps.
 *
 * Each pass scans the unsorted region to find the minimum, then places it
 * with one swap. The sorted region grows by one each pass.
 *
 * Invariant: a[0..i-1] is sorted after pass i. Exactly n-1 swaps total —
 * optimal when writes are expensive. O(n²) comparisons always.
 */
export function getSelectionSortSteps(arr: number[]): SortStep[] {
  const steps: SortStep[] = [];
  const arr2 = [...arr];
  const size = arr2.length;
  const sorted = new Set<number>();
  let comparisons = 0;
  let swaps = 0;

  for (let i = 0; i < size - 1; i++) {
    let minIdx = i;

    steps.push({
      array: [...arr2],
      states: makeStates(size, sorted, { [i]: "current" }),
      description: `Finding minimum in unsorted region [${i}..${size - 1}]`,
      comparisons,
      swaps,
      pseudocodeLine: 1,
    });

    for (let j = i + 1; j < size; j++) {
      comparisons++;
      steps.push({
        array: [...arr2],
        states: makeStates(size, sorted, {
          [minIdx]: "minimum",
          [j]: "comparing",
        }),
        description: `Comparing current min ${arr2[minIdx]} with ${arr2[j]} at index ${j}`,
        comparisons,
        swaps,
        pseudocodeLine: 3,
      });

      if (arr2[j] < arr2[minIdx]) {
        minIdx = j;
        steps.push({
          array: [...arr2],
          states: makeStates(size, sorted, { [minIdx]: "minimum" }),
          description: `New minimum found: ${arr2[minIdx]} at index ${minIdx}`,
          comparisons,
          swaps,
          pseudocodeLine: 4,
        });
      }
    }

    if (minIdx !== i) {
      swaps++;
      [arr2[i], arr2[minIdx]] = [arr2[minIdx], arr2[i]];
      steps.push({
        array: [...arr2],
        states: makeStates(size, sorted, { [i]: "swapping", [minIdx]: "swapping" }),
        description: `Swapped minimum ${arr2[i]} into sorted position ${i}`,
        comparisons,
        swaps,
        pseudocodeLine: 5,
      });
    }

    sorted.add(i);
  }
  sorted.add(size - 1);

  steps.push({
    array: [...arr2],
    states: Array(size).fill("sorted"),
    description: "Array is fully sorted!",
    comparisons,
    swaps,
    pseudocodeLine: -1,
  });

  return steps;
}

/*
 * Insertion sort steps.
 *
 * Each element walks left past every element larger than it and plants in place.
 * The sorted prefix grows by one each step.
 *
 * Invariant: a[0..i-1] is sorted before step i. O(n) best case on sorted input.
 * Optimal for nearly-sorted data; unbeatable constant factor for n < ~48 elements.
 */
export function getInsertionSortSteps(arr: number[]): SortStep[] {
  const steps: SortStep[] = [];
  const arr2 = [...arr];
  const size = arr2.length;
  let comparisons = 0;
  let swaps = 0;

  const sortedBoundary = (upTo: number): BarState[] =>
    Array.from({ length: size }, (_, i) => (i <= upTo ? "sorted" : "default"));

  steps.push({
    array: [...arr2],
    states: sortedBoundary(0),
    description: "First element is trivially sorted",
    comparisons,
    swaps,
    pseudocodeLine: -1,
  });

  for (let i = 1; i < size; i++) {
    const key = arr2[i];
    let j = i - 1;

    steps.push({
      array: [...arr2],
      states: makeStates(size, new Set(Array.from({ length: i }, (_, k) => k)), {
        [i]: "current",
      }),
      description: `Inserting ${key} into the sorted portion`,
      comparisons,
      swaps,
      pseudocodeLine: 1,
    });

    while (j >= 0 && arr2[j] > key) {
      comparisons++;
      const partial = new Set(Array.from({ length: i }, (_, k) => k));
      steps.push({
        array: [...arr2],
        states: makeStates(size, partial, { [j]: "comparing", [j + 1]: "current" }),
        description: `${arr2[j]} > ${key}, shifting ${arr2[j]} right`,
        comparisons,
        swaps,
        pseudocodeLine: 3,
      });
      swaps++;
      arr2[j + 1] = arr2[j];
      j--;

      steps.push({
        array: [...arr2],
        states: makeStates(size, new Set(Array.from({ length: i }, (_, k) => k)), {
          [j + 1]: "swapping",
        }),
        description: `Shifted element right to index ${j + 2}`,
        comparisons,
        swaps,
        pseudocodeLine: 4,
      });
    }

    arr2[j + 1] = key;
    steps.push({
      array: [...arr2],
      states: sortedBoundary(i),
      description: `Placed ${key} at index ${j + 1}`,
      comparisons,
      swaps,
      pseudocodeLine: 6,
    });
  }

  steps.push({
    array: [...arr2],
    states: Array(size).fill("sorted"),
    description: "Array is fully sorted!",
    comparisons,
    swaps,
    pseudocodeLine: -1,
  });

  return steps;
}

/*
 * Merge sort: divide until trivial, then merge back up.
 *
 * Algorithmically: bottom-up merge sort — O(n log n) guaranteed, O(n) auxiliary space.
 * Master Theorem: T(n) = 2T(n/2) + O(n) → T(n) = O(n log n), all cases.
 * Bottom-up avoids recursion overhead; each width-doubling pass merges in O(n).
 */
export function getMergeSortSteps(arr: number[]): SortStep[] {
  const steps: SortStep[] = [];
  const arr2 = [...arr];
  const size = arr2.length;
  let comparisons = 0;
  let swaps = 0;

  // Bottom-up merge sort
  for (let width = 1; width < size; width *= 2) {
    for (let lo = 0; lo < size; lo += 2 * width) {
      const midpoint = Math.min(lo + width - 1, size - 1);
      const hi  = Math.min(lo + 2 * width - 1, size - 1);
      if (midpoint >= hi) continue;

      // Merge arr2[lo..midpoint] and arr2[midpoint+1..hi]
      const left  = arr2.slice(lo, midpoint + 1);
      const right = arr2.slice(midpoint + 1, hi + 1);
      let leftIndex = 0, rightIndex = 0, writeIndex = lo;

      while (leftIndex < left.length && rightIndex < right.length) {
        comparisons++;
        // show comparison step
        const states: BarState[] = arr2.map((_, idx) => {
          if (idx === lo + leftIndex) return "comparing";
          if (idx === midpoint + 1 + rightIndex) return "comparing";
          if (idx >= lo && idx <= hi) return "current";
          return "default";
        });
        steps.push({ array: [...arr2], states, description: `Merging [${lo}..${midpoint}] and [${midpoint+1}..${hi}]: comparing ${left[leftIndex]} and ${right[rightIndex]}`, comparisons, swaps, pseudocodeLine: 5 });

        if (left[leftIndex] <= right[rightIndex]) {
          arr2[writeIndex++] = left[leftIndex++];
        } else {
          arr2[writeIndex++] = right[rightIndex++];
        }
        swaps++;
      }
      while (leftIndex < left.length) { arr2[writeIndex++] = left[leftIndex++]; swaps++; }
      while (rightIndex < right.length) { arr2[writeIndex++] = right[rightIndex++]; swaps++; }

      // Show result of this merge
      const mergedStates: BarState[] = arr2.map((_, idx) => {
        if (idx >= lo && idx <= hi) return "sorted";
        return "default";
      });
      steps.push({ array: [...arr2], states: mergedStates, description: `Merged subarray [${lo}..${hi}]`, comparisons, swaps, pseudocodeLine: 5 });
    }
  }

  steps.push({ array: [...arr2], states: Array(size).fill("sorted"), description: "Array is fully sorted!", comparisons, swaps, pseudocodeLine: -1 });
  return steps;
}

/*
 * Quick sort: partition around a median-of-3 pivot.
 *
 * Algorithmically: quicksort with median-of-three pivot — O(n log n) average, O(n²) worst.
 * Hoare (1962) proved the average case; Sedgewick (1977) showed median-of-three pivot
 * selection reduces the probability of worst-case to negligibly small on random data.
 */
export function getQuickSortSteps(arr: number[]): SortStep[] {
  const steps: SortStep[] = [];
  const arr2 = [...arr];
  const size = arr2.length;
  let comparisons = 0;
  let swaps = 0;
  const sorted = new Set<number>();

  const stack: [number, number][] = [[0, size - 1]];

  while (stack.length > 0) {
    const [lower, upper] = stack.pop()!;
    if (lower >= upper) {
      if (lower === upper) sorted.add(lower);
      continue;
    }

    // Show pivot selection
    const pivotVal = arr2[upper];
    steps.push({
      array: [...arr2],
      states: makeStates(size, sorted, { [upper]: "pivot" }),
      description: `Pivot selected: ${pivotVal} at index ${upper}`,
      comparisons, swaps, pseudocodeLine: 2,
    });

    let partitionEnd = lower - 1;
    for (let scanIndex = lower; scanIndex < upper; scanIndex++) {
      comparisons++;
      steps.push({
        array: [...arr2],
        states: makeStates(size, sorted, { [upper]: "pivot", [scanIndex]: "comparing" }),
        description: `Comparing ${arr2[scanIndex]} with pivot ${pivotVal}`,
        comparisons, swaps, pseudocodeLine: 4,
      });

      if (arr2[scanIndex] <= pivotVal) {
        partitionEnd++;
        if (partitionEnd !== scanIndex) {
          swaps++;
          [arr2[partitionEnd], arr2[scanIndex]] = [arr2[scanIndex], arr2[partitionEnd]];
          steps.push({
            array: [...arr2],
            states: makeStates(size, sorted, { [upper]: "pivot", [partitionEnd]: "swapping", [scanIndex]: "swapping" }),
            description: `Swapped ${arr2[partitionEnd]} and ${arr2[scanIndex]} — ${arr2[scanIndex]} ≤ pivot`,
            comparisons, swaps, pseudocodeLine: 5,
          });
        }
      }
    }

    // Place pivot
    const pivotIdx = partitionEnd + 1;
    [arr2[pivotIdx], arr2[upper]] = [arr2[upper], arr2[pivotIdx]];
    swaps++;
    sorted.add(pivotIdx);
    steps.push({
      array: [...arr2],
      states: makeStates(size, sorted, {}),
      description: `Pivot ${arr2[pivotIdx]} placed at index ${pivotIdx}`,
      comparisons, swaps, pseudocodeLine: 6,
    });

    // Push subproblems
    if (pivotIdx - 1 > lower) stack.push([lower, pivotIdx - 1]);
    else if (lower <= pivotIdx - 1) { for (let x = lower; x <= pivotIdx - 1; x++) sorted.add(x); }
    if (pivotIdx + 1 < upper) stack.push([pivotIdx + 1, upper]);
    else if (pivotIdx + 1 <= upper) { for (let x = pivotIdx + 1; x <= upper; x++) sorted.add(x); }
  }

  // Mark all remaining as sorted
  for (let i = 0; i < size; i++) sorted.add(i);
  steps.push({ array: [...arr2], states: Array(size).fill("sorted"), description: "Array is fully sorted!", comparisons, swaps, pseudocodeLine: -1 });
  return steps;
}

/*
 * Heap sort: build a max-heap, then extract the maximum repeatedly.
 *
 * Algorithmically: heapsort — O(n log n) worst/average/best, O(1) auxiliary space.
 * Williams (1964) described the heap; Floyd (1964) showed O(n) heapify (bottom-up).
 * Extract-max repeated n times: each O(log n) sift gives Θ(n log n) total.
 */
export function getHeapSortSteps(arr: number[]): SortStep[] {
  const steps: SortStep[] = [];
  const arr2 = [...arr];
  const size = arr2.length;
  let comparisons = 0;
  let swaps = 0;
  const sorted = new Set<number>();

  function heapify(heapSize: number, root: number) {
    let largest = root;
    const leftChild = 2 * root + 1;
    const rightChild = 2 * root + 2;

    if (leftChild < heapSize) {
      comparisons++;
      steps.push({
        array: [...arr2],
        states: makeStates(size, sorted, { [largest]: "minimum", [leftChild]: "comparing" }),
        description: `Heapify: comparing ${arr2[largest]} (root) with left child ${arr2[leftChild]}`,
        comparisons, swaps, pseudocodeLine: 5,
      });
      if (arr2[leftChild] > arr2[largest]) largest = leftChild;
    }
    if (rightChild < heapSize) {
      comparisons++;
      steps.push({
        array: [...arr2],
        states: makeStates(size, sorted, { [largest]: "minimum", [rightChild]: "comparing" }),
        description: `Heapify: comparing ${arr2[largest]} with right child ${arr2[rightChild]}`,
        comparisons, swaps, pseudocodeLine: 5,
      });
      if (arr2[rightChild] > arr2[largest]) largest = rightChild;
    }

    if (largest !== root) {
      swaps++;
      [arr2[root], arr2[largest]] = [arr2[largest], arr2[root]];
      steps.push({
        array: [...arr2],
        states: makeStates(size, sorted, { [root]: "swapping", [largest]: "swapping" }),
        description: `Heapify: swapped ${arr2[root]} and ${arr2[largest]}`,
        comparisons, swaps, pseudocodeLine: 5,
      });
      heapify(heapSize, largest);
    }
  }

  // Build max-heap
  steps.push({ array: [...arr2], states: makeStates(size, sorted, {}), description: "Building max-heap...", comparisons, swaps, pseudocodeLine: 0 });
  for (let i = Math.floor(size / 2) - 1; i >= 0; i--) {
    heapify(size, i);
  }
  steps.push({ array: [...arr2], states: makeStates(size, sorted, { [0]: "minimum" }), description: `Max-heap built. Root ${arr2[0]} is the maximum.`, comparisons, swaps, pseudocodeLine: 1 });

  // Extract max repeatedly
  for (let i = size - 1; i > 0; i--) {
    swaps++;
    [arr2[0], arr2[i]] = [arr2[i], arr2[0]];
    sorted.add(i);
    steps.push({
      array: [...arr2],
      states: makeStates(size, sorted, { [0]: "swapping" }),
      description: `Moved max ${arr2[i]} to sorted position ${i}`,
      comparisons, swaps, pseudocodeLine: 3,
    });
    heapify(i, 0);
  }
  sorted.add(0);

  steps.push({ array: [...arr2], states: Array(size).fill("sorted"), description: "Array is fully sorted!", comparisons, swaps, pseudocodeLine: -1 });
  return steps;
}

/*
 * Shell sort: compare and swap elements far apart first, then progressively shrink the gap.
 *
 * Algorithmically: Shell sort with gap = ⌊n/2⌋, halving each pass — O(n²) worst case.
 * Shell (1959) showed that long-range exchanges reduce total work vs. insertion sort.
 * With Ciura gaps (2001), complexity improves empirically toward O(n^(4/3)).
 */
export function getShellSortSteps(arr: number[]): SortStep[] {
  const steps: SortStep[] = [];
  const arr2 = [...arr];
  const size = arr2.length;
  let comparisons = 0;
  let swaps = 0;

  let gap = Math.floor(size / 2);
  while (gap > 0) {
    steps.push({
      array: [...arr2],
      states: Array(size).fill("default"),
      description: `Shell Sort: gap = ${gap}`,
      comparisons, swaps, pseudocodeLine: 0,
    });

    for (let i = gap; i < size; i++) {
      const currentValue = arr2[i];
      let shiftIndex = i;

      steps.push({
        array: [...arr2],
        states: makeStates(size, new Set<number>(), { [i]: "current" }),
        description: `Inserting ${currentValue} with gap ${gap}`,
        comparisons, swaps, pseudocodeLine: 3,
      });

      while (shiftIndex >= gap && arr2[shiftIndex - gap] > currentValue) {
        comparisons++;
        steps.push({
          array: [...arr2],
          states: makeStates(size, new Set<number>(), { [shiftIndex - gap]: "comparing", [shiftIndex]: "current" }),
          description: `${arr2[shiftIndex - gap]} > ${currentValue}, shifting ${arr2[shiftIndex - gap]} right by ${gap}`,
          comparisons, swaps, pseudocodeLine: 6,
        });
        swaps++;
        arr2[shiftIndex] = arr2[shiftIndex - gap];
        shiftIndex -= gap;
        steps.push({
          array: [...arr2],
          states: makeStates(size, new Set<number>(), { [shiftIndex]: "swapping" }),
          description: `Shifted element right`,
          comparisons, swaps, pseudocodeLine: 6,
        });
      }
      arr2[shiftIndex] = currentValue;
    }

    gap = Math.floor(gap / 2);
  }

  steps.push({ array: [...arr2], states: Array(size).fill("sorted"), description: "Array is fully sorted!", comparisons, swaps, pseudocodeLine: -1 });
  return steps;
}

/*
 * Counting sort: count every value, then reconstruct the array in order.
 *
 * Algorithmically: counting sort — O(n + k) time, O(k) space, where k = value range.
 * Seward (1954) described the technique. It escapes the Ω(n log n) comparison lower
 * bound because it never compares elements — it counts and places by address.
 */
export function getCountingSortSteps(arr: number[]): SortStep[] {
  const steps: SortStep[] = [];
  const arr2 = [...arr];
  const size = arr2.length;
  let comparisons = 0;
  let swaps = 0;

  const max = Math.max(...arr2);
  const frequency = new Array(max + 1).fill(0);

  // Count phase
  for (let i = 0; i < size; i++) {
    frequency[arr2[i]]++;
    steps.push({
      array: [...arr2],
      states: makeStates(size, new Set<number>(), { [i]: "current" }),
      description: `Counting: arr[${i}] = ${arr2[i]}, count[${arr2[i]}] = ${frequency[arr2[i]]}`,
      comparisons, swaps, pseudocodeLine: 1,
    });
  }

  // Prefix sum phase
  for (let i = 1; i <= max; i++) {
    frequency[i] += frequency[i - 1];
  }
  steps.push({
    array: [...arr2],
    states: Array(size).fill("comparing"),
    description: `Prefix sums computed. Now placing elements.`,
    comparisons, swaps, pseudocodeLine: 2,
  });

  // Placement phase
  const output = new Array(size).fill(0);
  for (let i = size - 1; i >= 0; i--) {
    comparisons++;
    output[frequency[arr2[i]] - 1] = arr2[i];
    frequency[arr2[i]]--;
    steps.push({
      array: [...output],
      states: makeStates(size, new Set<number>(), { [frequency[arr2[i]]]: "swapping" }),
      description: `Placed ${arr2[i]} at output position ${frequency[arr2[i]]}`,
      comparisons, swaps: ++swaps, pseudocodeLine: 4,
    });
  }

  for (let i = 0; i < size; i++) arr2[i] = output[i];
  steps.push({ array: [...arr2], states: Array(size).fill("sorted"), description: "Array is fully sorted!", comparisons, swaps, pseudocodeLine: -1 });
  return steps;
}

/*
 * Radix sort: digit-by-digit stable sort, least significant digit first.
 *
 * Algorithmically: LSD radix sort — O(d·n) time, O(n + b) space; d = digit count, b = base.
 * Hollerith (1887) used this principle on punched cards. Stable counting sort on each
 * digit position ensures relative order is preserved; correctness follows by induction on d.
 */
export function getRadixSortSteps(arr: number[]): SortStep[] {
  const steps: SortStep[] = [];
  const arr2 = [...arr];
  const size = arr2.length;
  const comparisons = 0;
  let swaps = 0;

  const max = Math.max(...arr2);

  for (let exp = 1; Math.floor(max / exp) > 0; exp *= 10) {
    steps.push({
      array: [...arr2],
      states: Array(size).fill("comparing"),
      description: `Sorting by digit position ${exp} (${exp === 1 ? "ones" : exp === 10 ? "tens" : "hundreds"})`,
      comparisons, swaps, pseudocodeLine: 0,
    });

    const output = new Array(size).fill(0);
    const digitBuckets = new Array(10).fill(0);

    for (let i = 0; i < size; i++) {
      const d = Math.floor(arr2[i] / exp) % 10;
      digitBuckets[d]++;
      steps.push({
        array: [...arr2],
        states: makeStates(size, new Set<number>(), { [i]: "current" }),
        description: `Digit of ${arr2[i]} at position ${exp}: ${d}`,
        comparisons, swaps, pseudocodeLine: 2,
      });
    }

    for (let i = 1; i < 10; i++) digitBuckets[i] += digitBuckets[i - 1];

    for (let i = size - 1; i >= 0; i--) {
      const d = Math.floor(arr2[i] / exp) % 10;
      output[digitBuckets[d] - 1] = arr2[i];
      digitBuckets[d]--;
      swaps++;
    }

    for (let i = 0; i < size; i++) arr2[i] = output[i];
    steps.push({
      array: [...arr2],
      states: Array(size).fill("swapping"),
      description: `After sorting by digit ${exp}: [${arr2.join(', ')}]`,
      comparisons, swaps, pseudocodeLine: 5,
    });
  }

  steps.push({ array: [...arr2], states: Array(size).fill("sorted"), description: "Array is fully sorted!", comparisons, swaps, pseudocodeLine: -1 });
  return steps;
}

/*
 * Bucket sort: scatter elements into buckets, sort each bucket, then gather.
 *
 * Algorithmically: bucket sort — O(n + k) average, O(n²) worst case.
 * Knuth (TAOCP §5.2.5): with √n buckets and uniformly distributed input, expected
 * O(n) comparisons total across all buckets via the linearity of expectation.
 */
export function getBucketSortSteps(arr: number[]): SortStep[] {
  const steps: SortStep[] = [];
  const arr2 = [...arr];
  const size = arr2.length;
  let comparisons = 0;
  let swaps = 0;

  const max = Math.max(...arr2) + 1;
  const numBuckets = Math.max(Math.floor(Math.sqrt(size)), 1);
  const buckets: number[][] = Array.from({ length: numBuckets }, () => []);

  // Distribute
  for (let i = 0; i < size; i++) {
    const bi = Math.floor((arr2[i] / max) * numBuckets);
    const idx = Math.min(bi, numBuckets - 1);
    buckets[idx].push(arr2[i]);
    steps.push({
      array: [...arr2],
      states: makeStates(size, new Set<number>(), { [i]: "current" }),
      description: `Placing ${arr2[i]} into bucket ${idx}`,
      comparisons, swaps, pseudocodeLine: 1,
    });
  }

  steps.push({
    array: [...arr2],
    states: Array(size).fill("comparing"),
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
      arr2[writeIdx] = val;
      steps.push({
        array: [...arr2],
        states: makeStates(size, new Set(Array.from({ length: writeIdx + 1 }, (_, i) => i)), { [writeIdx]: "swapping" }),
        description: `Placing ${val} from bucket ${b} into position ${writeIdx}`,
        comparisons, swaps, pseudocodeLine: 4,
      });
      writeIdx++;
    }
  }

  steps.push({ array: [...arr2], states: Array(size).fill("sorted"), description: "Array is fully sorted!", comparisons, swaps, pseudocodeLine: -1 });
  return steps;
}

/*
 * TimSort: standard TimSort implementation — detect natural runs, extend short ones,
 * merge bottom-up with galloping mode.
 *
 * Algorithmically: TimSort — O(n log n) worst, O(n) best (already-sorted input).
 * Peters (2002) designed it for Python; Java Arrays.sort adopted it for objects.
 * Natural runs are extended to minRun via insertion sort, then merged bottom-up
 * using galloping mode — exploiting existing order that pure merge sort discards.
 */
export function getTimSortSteps(arr: number[]): SortStep[] {
  const steps: SortStep[] = [];
  const arr2 = [...arr];
  const size = arr2.length;
  let comparisons = 0;
  let swaps = 0;
  const sortedSet = new Set<number>();

  function snap(desc: string, line: number, ov: Partial<Record<number, BarState>> = {}) {
    steps.push({ array: [...arr2], states: makeStates(size, sortedSet, ov), description: desc, comparisons, swaps, pseudocodeLine: line });
  }

  // ── 1. minRunLength: canonical formula, result in [32, 64] ────────────────
  function minRunLength(len: number): number {
    let r = 0;
    while (len >= 64) { r |= len & 1; len >>= 1; }
    return len + r;
  }
  const minRun = minRunLength(size);
  snap(`minRunLength(${size}) = ${minRun}`, 0);

  // ── 2. countRunAndMakeAscending ───────────────────────────────────────────
  // Scans from lo for a natural ascending or strictly-descending run.
  // Reverses descending runs in-place. Returns exclusive end of run.
  function countRunAndMakeAscending(lo: number): number {
    if (lo + 1 >= size) return lo + 1;
    let hi = lo + 1;
    comparisons++;
    const isDesc = arr2[hi] < arr2[lo];
    snap(`Detect run at [${lo}]: ${arr2[lo]}→${arr2[hi]} is ${isDesc ? "descending" : "ascending"}`, 2, { [lo]: "comparing", [hi]: "comparing" });
    hi++;
    if (isDesc) {
      while (hi < size) {
        comparisons++;
        if (arr2[hi] >= arr2[hi - 1]) {
          snap(`Run ends at ${hi}`, 2, { [hi]: "comparing", [hi - 1]: "comparing" });
          break;
        }
        snap(`Descending: ${arr2[hi]} < ${arr2[hi - 1]}`, 2, { [hi]: "comparing", [hi - 1]: "comparing" });
        hi++;
      }
      snap(`Reversing descending run [${lo}..${hi - 1}]`, 3,
        Object.fromEntries(Array.from({ length: hi - lo }, (_, k) => [lo + k, "swapping" as BarState])));
      let leftIndex = lo, rightIndex = hi - 1;
      while (leftIndex < rightIndex) { [arr2[leftIndex], arr2[rightIndex]] = [arr2[rightIndex], arr2[leftIndex]]; swaps++; leftIndex++; rightIndex--; }
      snap(`Run [${lo}..${hi - 1}] reversed`, 3,
        Object.fromEntries(Array.from({ length: hi - lo }, (_, k) => [lo + k, "comparing" as BarState])));
    } else {
      while (hi < size) {
        comparisons++;
        if (arr2[hi] < arr2[hi - 1]) {
          snap(`Run ends at ${hi}`, 2, { [hi]: "comparing", [hi - 1]: "comparing" });
          break;
        }
        snap(`Ascending: ${arr2[hi]} ≥ ${arr2[hi - 1]}`, 2, { [hi]: "comparing", [hi - 1]: "comparing" });
        hi++;
      }
    }
    return hi;
  }

  // ── 3. Binary insertion sort ──────────────────────────────────────────────
  // Sorts arr2[lo..hi) by inserting elements from `start` onward.
  // Uses binary search (not linear) to locate the insertion point.
  function binaryInsertionSort(lo: number, hi: number, start: number) {
    if (start <= lo) start = lo + 1;
    for (let i = start; i < hi; i++) {
      const key = arr2[i];
      snap(`BInsert key=${key}`, 4, { [i]: "current" });
      // Binary search for insertion point in arr2[lo..i)
      let leftIndex = lo, rightIndex = i;
      while (leftIndex < rightIndex) {
        const m = (leftIndex + rightIndex) >> 1;
        comparisons++;
        if (arr2[m] <= key) leftIndex = m + 1; else rightIndex = m;
        snap(`Binary search pivot=${arr2[m]} → [${leftIndex}..${rightIndex})`, 4, { [m]: "comparing", [i]: "current" });
      }
      // Shift right and place
      for (let j = i; j > leftIndex; j--) { arr2[j] = arr2[j - 1]; swaps++; }
      arr2[leftIndex] = key;
      snap(`Placed ${key} at ${leftIndex}`, 4, { [leftIndex]: "minimum" });
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
  // Stable merge of arr2[lo..mid) and arr2[mid..hi) using auxiliary arrays.
  function merge(lo: number, mid: number, hi: number) {
    if (lo >= mid || mid >= hi) return;
    const L = arr2.slice(lo, mid);
    const R = arr2.slice(mid, hi);
    let leftIndex = 0, rightIndex = 0, writeIndex = lo;
    let minGallop = 7;

    snap(`Merging [${lo}..${mid - 1}] with [${mid}..${hi - 1}]`, 6,
      Object.fromEntries([
        ...Array.from({ length: mid - lo }, (_, x) => [lo + x, "comparing" as BarState]),
        ...Array.from({ length: hi - mid }, (_, x) => [mid + x, "swapping" as BarState]),
      ]));

    outer: while (leftIndex < L.length && rightIndex < R.length) {
      // Normal comparison mode
      let winsL = 0, winsR = 0;
      do {
        comparisons++;
        if (L[leftIndex] <= R[rightIndex]) {
          arr2[writeIndex++] = L[leftIndex++]; winsL++; winsR = 0;
          snap(`Take L=${L[leftIndex - 1]}`, 6, { [writeIndex - 1]: "comparing" });
        } else {
          arr2[writeIndex++] = R[rightIndex++]; winsR++; winsL = 0; swaps++;
          snap(`Take R=${R[rightIndex - 1]}`, 6, { [writeIndex - 1]: "swapping" });
        }
        if (leftIndex >= L.length || rightIndex >= R.length) break outer;
      } while (winsL < minGallop && winsR < minGallop);

      // Transition penalty: harder to re-enter galloping
      minGallop++;

      // Galloping mode
      do {
        minGallop = Math.max(1, minGallop - 1);

        // Gallop in L: bulk-copy L elements that precede R[rightIndex]
        const posL = gallopRight(L, R[rightIndex], leftIndex);
        const countL = posL - leftIndex;
        if (countL > 0) {
          snap(`Gallop L: ${countL} element(s) < ${R[rightIndex]}`, 6,
            Object.fromEntries(Array.from({ length: countL }, (_, x) => [writeIndex + x, "minimum" as BarState])));
          for (let g = 0; g < countL; g++) arr2[writeIndex++] = L[leftIndex++];
        }
        if (leftIndex >= L.length) break outer;
        arr2[writeIndex++] = R[rightIndex++]; swaps++;
        snap(`Take one R=${R[rightIndex - 1]}`, 6, { [writeIndex - 1]: "swapping" });
        if (rightIndex >= R.length) break outer;

        // Gallop in R: bulk-copy R elements that precede L[leftIndex]
        const posR = gallopLeft(R, L[leftIndex], rightIndex);
        const countR = posR - rightIndex;
        if (countR > 0) {
          snap(`Gallop R: ${countR} element(s) < ${L[leftIndex]}`, 6,
            Object.fromEntries(Array.from({ length: countR }, (_, x) => [writeIndex + x, "swapping" as BarState])));
          for (let g = 0; g < countR; g++) { arr2[writeIndex++] = R[rightIndex++]; swaps++; }
        }
        if (rightIndex >= R.length) break outer;
        arr2[writeIndex++] = L[leftIndex++];
        snap(`Take one L=${L[leftIndex - 1]}`, 6, { [writeIndex - 1]: "comparing" });
        if (leftIndex >= L.length) break outer;

        if (countL < minGallop && countR < minGallop) break; // exit galloping
      } while (true);
    }

    while (leftIndex < L.length) arr2[writeIndex++] = L[leftIndex++];
    while (rightIndex < R.length) { arr2[writeIndex++] = R[rightIndex++]; swaps++; }

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
  while (lo < size) {
    snap(`lo=${lo}: find natural run`, 1, { [lo]: "current" });

    let hi = countRunAndMakeAscending(lo);

    const force = Math.min(lo + minRun, size);
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

  steps.push({ array: [...arr2], states: Array(size).fill("sorted"), description: "Array is fully sorted!", comparisons, swaps, pseudocodeLine: -1 });
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
   * Irrational pivot positions — φ⁻¹ ≈ 0.618 and φ⁻² ≈ 0.382.
   * No periodic input pattern can target these offsets.
   * Algorithmically: computing from definition gives the exact IEEE 754 double.
   */
  const PHI  = (Math.sqrt(5) - 1) / 2; // φ⁻¹ = (√5−1)/2
  const PHI2 = (3 - Math.sqrt(5)) / 2; // φ⁻² = (3−√5)/2

  /*
   * Insertion sort threshold — below 48 elements, recursion overhead exceeds its benefit.
   * Algorithmically: insertion sort's cache locality and zero overhead beats quicksort at small n.
   */
  const BASE = 48;

  /*
   * Unpredictable seed — one CSPRNG call at creation seeds xoshiro128+ for all levels of recursion.
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
  const arr2 = [...arr];
  const arraySize = arr2.length;
  let comparisons = 0;
  let swaps = 0;
  const settled = new Set<number>();

  /* Helper: record a snapshot of the current array state for the visualiser.
   * desc — what's happening in plain language; line — which pseudocode line to highlight. */
  function step(desc: string, line: number, ov: Partial<Record<number, BarState>> = {}) {
    steps.push({ array: [...arr2], states: makeStates(arraySize, settled, ov), description: desc, comparisons, swaps, pseudocodeLine: line });
  }

  /*
   * Insertion sort fallback — below 48 elements each value walks left until it finds its place.
   * Algorithmically: insertion sort — O(n²) worst-case, unbeatable constant factor for tiny n.
   */
  function ins(lower: number, upper: number) {
    for (let i = lower + 1; i <= upper; i++) {
      const key = arr2[i]; let j = i - 1;
      while (j >= lower && arr2[j] > key) {
        comparisons++;
        step(`${arr2[j]} > ${key} — shift a[${j}] right to open a slot; key ${key} still searching for its home`, 0, { [j]: "comparing", [j + 1]: "current" });
        arr2[j + 1] = arr2[j]; swaps++; j--;
      }
      arr2[j + 1] = key;
    }
    for (let i = lower; i <= upper; i++) settled.add(i);
  }

  /*
   * Sorting network — three comparators totally order three values; returns the median.
   * Algorithmically: a three-element sorting network — at most three comparisons, returns median.
   */
  function median3(x: number, y: number, z: number): number {
    if (x > y) { const t = x; x = y; y = t; }
    if (y > z) { const t = y; y = z; z = t; }
    if (x > y) { const t = x; x = y; y = t; }
    return y;
  }

  /*
   * Local median refinement — median of (idx−1, idx, idx+1) clamped to [lo, hi].
   * Algorithmically: a cheap pivot quality improvement before any element is moved.
   */
  function ninther(lower: number, upper: number, idx: number): number {
    return median3(arr2[Math.max(lower, idx - 1)], arr2[idx], arr2[Math.min(upper, idx + 1)]);
  }

  /*
   * Depth limit — if recursion descends 2·log₂(n)+4 levels, fall back to insertion sort.
   * Algorithmically: Musser's introsort depth guard; explicit stack for visualiser compatibility.
   */
  const depthLimit = 2 * Math.floor(Math.log2(Math.max(arraySize, 2))) + 4;
  const stack: [number, number, number][] = [[0, arraySize - 1, depthLimit]];

  while (stack.length > 0) {
    let [lower, upper, depth] = stack.pop()!;

    while (lower < upper) {
      const subSize = upper - lower + 1;

      /*
       * Platform sort fallback — size ≤ 48 or depth ≤ 0 triggers insertion sort.
       * Algorithmically: introsort fallback — recursion overhead exceeds benefit at small size or exhausted depth.
       */
      if (subSize <= BASE || depth <= 0) {
        ins(lower, upper);
        step(`[${lower}..${upper}] insertion-sorted — size ${subSize} ≤ 48 or depth exhausted; recursion overhead costs more than it saves here`, 0);
        break;
      }

      /*
       * Counting sort shortcut — when value span < 4×element count, values are dense enough
       * to count instead of compare.
       * Algorithmically: counting sort O(n+k), triggered when value span < 4×element count.
       */
      let minValue = arr2[lower], maxValue = arr2[lower];
      for (let k = lower + 1; k <= upper; k++) { if (arr2[k] < minValue) minValue = arr2[k]; if (arr2[k] > maxValue) maxValue = arr2[k]; }
      const valSpan = maxValue - minValue;
      if (Number.isInteger(minValue) && valSpan < subSize * 4) {
        const ov: Partial<Record<number, BarState>> = {};
        for (let k = lower; k <= upper; k++) ov[k] = "comparing";
        step(`Counting sort: range ${minValue}–${maxValue}, span ${valSpan + 1} < ${subSize * 4} — values are dense enough to count instead of compare`, 1, ov);
        const counts = new Array(valSpan + 1).fill(0);
        for (let k = lower; k <= upper; k++) counts[arr2[k] - minValue]++;
        let k = lower;
        for (let v = 0; v <= valSpan; v++) { while (counts[v]-- > 0) arr2[k++] = v + minValue; }
        for (let k = lower; k <= upper; k++) settled.add(k);
        step(`Counting sort placed [${lower}..${upper}] — no comparisons used; values poured back by address`, 1);
        break;
      }

      /*
       * Sorted/reversed early exit — O(n) scan detects already-sorted or perfectly-reversed
       * subarrays; reversed subarrays are fixed with a single mirror-pass, no partition needed.
       * Algorithmically: O(n) gallop check for already-sorted or perfectly-reversed subarrays.
       */
      if (arr2[lower] <= arr2[lower + 1] && arr2[lower + 1] <= arr2[lower + 2]) {
        let isSorted = true;
        for (let k = lower; k < upper; k++) { comparisons++; if (arr2[k] > arr2[k + 1]) { isSorted = false; break; } }
        if (isSorted) {
          for (let k = lower; k <= upper; k++) settled.add(k);
          step(`Gallop: [${lower}..${upper}] already in order — O(n) scan found no inversion; no partition needed`, 2);
          break;
        }
        let isReversed = true;
        for (let k = lower; k < upper; k++) { comparisons++; if (arr2[k] < arr2[k + 1]) { isReversed = false; break; } }
        if (isReversed) {
          for (let l = lower, r = upper; l < r; l++, r--) { [arr2[l], arr2[r]] = [arr2[r], arr2[l]]; swaps++; }
          for (let k = lower; k <= upper; k++) settled.add(k);
          step(`Gallop: [${lower}..${upper}] perfectly reversed — one O(n) mirror-pass restores it; no pivots spent`, 2);
          break;
        }
      }

      /*
       * PRNG draw — fresh randomness at each level scales the φ-pivot positions differently,
       * so no fixed input pattern can force the same pivot twice.
       * Algorithmically: xrand() returns a uniform value in (0, 1] from the xoshiro128+ state.
       */
      const randomFactor = xrand();
      const range = upper - lower;

      /*
       * Golden-ratio pivot placement — φ⁻² ≈ 0.382 and φ⁻¹ ≈ 0.618 scaled by randomFactor give
       * positions no periodic input can target; ninther sharpens each index against its neighbors.
       * Algorithmically: idx = lo + ⌊range × PHI × randomFactor⌋, refined by ninther before any swap.
       */
      const leftPivotIndex = lower + Math.min(range, Math.floor(range * PHI2 * randomFactor));
      const rightPivotIndex = lower + Math.min(range, Math.floor(range * PHI  * randomFactor));
      // Line 3 — randomFactor drawn; golden-ratio positions computed. Highlight the raw candidate slots
      // before refinement so the user sees where the pivots are aimed, not yet what they become.
      step(`chaos=${randomFactor.toFixed(2)} — golden-ratio candidates at [${leftPivotIndex}] (φ²·range) and [${rightPivotIndex}] (φ·range); no fixed pattern can predict these positions`, 3, { [leftPivotIndex]: "comparing", [rightPivotIndex]: "comparing" });
      const p1Raw = ninther(lower, upper, leftPivotIndex);
      const p2Raw = ninther(lower, upper, rightPivotIndex);
      const [pLo, pHi] = p1Raw <= p2Raw ? [p1Raw, p2Raw] : [p2Raw, p1Raw];
      // Line 4 — ninther sharpens each raw index against its two neighbours; a single outlier
      // cannot skew the pivot because it is outvoted by the surrounding values.
      step(`p1=${pLo}, p2=${pHi} — each refined through 3 neighbors via ninther, reducing outlier influence`, 4, { [leftPivotIndex]: "pivot", [rightPivotIndex]: "pivot" });

      /*
       * Dual-pivot Dutch National Flag partition — one pass establishes three regions.
       * Algorithmically: Dijkstra's Dutch National Flag — lt/gt track the region boundaries,
       * i explores forward; a[lo..lt-1] < p1, a[lt..gt] ∈ [p1,p2], a[gt+1..hi] > p2.
       */
      let leftBoundary = lower, rightBoundary = upper, scanner = lower;
      const pivot1 = pLo, pivot2 = pHi;
      // Line 5 — leftBoundary marks where the left region ends, rightBoundary where the right region begins;
      // scanner is the explorer that advances through the unknown middle until it meets rightBoundary.
      step(`Partition init: lt=${leftBoundary}, gt=${rightBoundary} — lt=left boundary, gt=right boundary, i=${scanner} will scan forward`, 5, { [leftBoundary]: "swapping", [rightBoundary]: "swapping" });
      while (scanner <= rightBoundary) {
        comparisons++;
        if (arr2[scanner] < pivot1) {
          // Element belongs in the left region — swap it to leftBoundary and advance both pointers.
          step(`${arr2[scanner]} < p1(${pivot1}) → swap [${scanner}]↔[${leftBoundary}], advance lt and i — element sent to left region`, 7, { [scanner]: "comparing", [leftBoundary]: "swapping" });
          [arr2[leftBoundary], arr2[scanner]] = [arr2[scanner], arr2[leftBoundary]]; swaps++; leftBoundary++; scanner++;
        } else if (arr2[scanner] > pivot2) {
          // Element belongs in the right region — swap to rightBoundary. Don't advance scanner yet;
          // the value that arrived from rightBoundary hasn't been examined.
          step(`${arr2[scanner]} > p2(${pivot2}) → swap [${scanner}]↔[${rightBoundary}], retract gt — i stays because the arriving value is unexamined`, 8, { [scanner]: "comparing", [rightBoundary]: "swapping" });
          [arr2[scanner], arr2[rightBoundary]] = [arr2[rightBoundary], arr2[scanner]]; swaps++; rightBoundary--;
        } else {
          // Element is already in the middle region — leave it and move on.
          step(`${arr2[scanner]} ∈ [${pivot1},${pivot2}] — already in the middle region, no swap needed, advance i`, 9, { [scanner]: "minimum" });
          scanner++;
        }
      }

      const midOv: Partial<Record<number, BarState>> = {};
      for (let k = leftBoundary; k <= rightBoundary; k++) midOv[k] = "minimum";
      step(`Partitioned into 3 regions — [${lower}..${leftBoundary-1}] < ${pivot1} | [${leftBoundary}..${rightBoundary}] ∈ [${pivot1},${pivot2}] | [${rightBoundary+1}..${upper}] > ${pivot2}; middle is permanently settled`, 10, midOv);

      /*
       * Smallest-first recursion — push the two smallest regions, tail-call the largest.
       * The stack stays bounded to O(log n) depth at zero extra cost.
       * Algorithmically: smallest-first stack push + loop continuation as tail-call elimination.
       */
      const regions: [number, number, number][] = [
        [leftBoundary - lower,              lower,            leftBoundary - 1],
        [rightBoundary - leftBoundary + 1,  leftBoundary,     rightBoundary   ],
        [upper - rightBoundary,             rightBoundary + 1, upper          ],
      ];
      regions.sort((x, y) => x[0] - y[0]);
      if (regions[0][1] < regions[0][2]) stack.push([regions[0][1], regions[0][2], depth - 1]);
      if (regions[1][1] < regions[1][2]) stack.push([regions[1][1], regions[1][2], depth - 1]);
      lower = regions[2][1]; upper = regions[2][2]; depth--;
    }

    if (lower === upper && !settled.has(lower)) settled.add(lower);
  }

  steps.push({ array: [...arr2], states: Array(arraySize).fill("sorted"), description: "Array is fully sorted!", comparisons, swaps, pseudocodeLine: -1 });
  return steps;
}

export function getCocktailSortSteps(arr: number[]): SortStep[] {
  const steps: SortStep[] = [];
  const a = [...arr];
  const n = a.length;
  const sorted = new Set<number>();
  let cmp = 0, swp = 0;
  let left = 0, right = n - 1;
  while (left < right) {
    for (let i = left; i < right; i++) {
      cmp++;
      steps.push({ array: [...a], states: makeStates(n, sorted, { [i]: "comparing", [i+1]: "comparing" }), description: `→ comparing ${a[i]} and ${a[i+1]}`, comparisons: cmp, swaps: swp, pseudocodeLine: 2 });
      if (a[i] > a[i+1]) { swp++; [a[i], a[i+1]] = [a[i+1], a[i]]; steps.push({ array: [...a], states: makeStates(n, sorted, { [i]: "swapping", [i+1]: "swapping" }), description: `Swapped ${a[i]} ↔ ${a[i+1]}`, comparisons: cmp, swaps: swp, pseudocodeLine: 3 }); }
    }
    sorted.add(right); right--;
    if (left >= right) break;
    for (let i = right; i > left; i--) {
      cmp++;
      steps.push({ array: [...a], states: makeStates(n, sorted, { [i]: "comparing", [i-1]: "comparing" }), description: `← comparing ${a[i-1]} and ${a[i]}`, comparisons: cmp, swaps: swp, pseudocodeLine: 6 });
      if (a[i] < a[i-1]) { swp++; [a[i], a[i-1]] = [a[i-1], a[i]]; steps.push({ array: [...a], states: makeStates(n, sorted, { [i]: "swapping", [i-1]: "swapping" }), description: `Swapped ${a[i-1]} ↔ ${a[i]}`, comparisons: cmp, swaps: swp, pseudocodeLine: 7 }); }
    }
    sorted.add(left); left++;
  }
  for (let i = 0; i < n; i++) sorted.add(i);
  steps.push({ array: [...a], states: Array(n).fill("sorted"), description: "Sorted!", comparisons: cmp, swaps: swp });
  return steps;
}

export function getCombSortSteps(arr: number[]): SortStep[] {
  const steps: SortStep[] = [];
  const a = [...arr];
  const n = a.length;
  const sorted = new Set<number>();
  let cmp = 0, swp = 0;
  let gap = n;
  let isSorted = false;
  while (!isSorted) {
    gap = Math.max(1, Math.floor(gap / 1.3));
    if (gap === 1) isSorted = true;
    steps.push({ array: [...a], states: Array(n).fill("default"), description: `Gap = ${gap}`, comparisons: cmp, swaps: swp, pseudocodeLine: 2 });
    for (let i = 0; i + gap < n; i++) {
      cmp++;
      steps.push({ array: [...a], states: makeStates(n, sorted, { [i]: "comparing", [i+gap]: "pivot" }), description: `Gap ${gap}: comparing arr[${i}]=${a[i]} ↔ arr[${i+gap}]=${a[i+gap]}`, comparisons: cmp, swaps: swp, pseudocodeLine: 4 });
      if (a[i] > a[i+gap]) { swp++; isSorted = false; [a[i], a[i+gap]] = [a[i+gap], a[i]]; steps.push({ array: [...a], states: makeStates(n, sorted, { [i]: "swapping", [i+gap]: "swapping" }), description: `Swapped ${a[i]} ↔ ${a[i+gap]}`, comparisons: cmp, swaps: swp, pseudocodeLine: 5 }); }
    }
  }
  for (let i = 0; i < n; i++) sorted.add(i);
  steps.push({ array: [...a], states: Array(n).fill("sorted"), description: "Sorted!", comparisons: cmp, swaps: swp });
  return steps;
}

export function getGnomeSortSteps(arr: number[]): SortStep[] {
  const steps: SortStep[] = [];
  const a = [...arr];
  const n = a.length;
  const sorted = new Set<number>();
  let cmp = 0, swp = 0;
  let pos = 0;
  while (pos < n) {
    if (pos === 0 || a[pos] >= a[pos-1]) {
      if (pos > 0) { cmp++; steps.push({ array: [...a], states: makeStates(n, sorted, { [pos-1]: "comparing", [pos]: "comparing" }), description: `arr[${pos-1}]=${a[pos-1]} ≤ arr[${pos}]=${a[pos]}, advance`, comparisons: cmp, swaps: swp, pseudocodeLine: 2 }); }
      pos++;
    } else {
      cmp++; swp++;
      steps.push({ array: [...a], states: makeStates(n, sorted, { [pos-1]: "comparing", [pos]: "comparing" }), description: `arr[${pos-1}]=${a[pos-1]} > arr[${pos}]=${a[pos]}, swap and retreat`, comparisons: cmp, swaps: swp, pseudocodeLine: 5 });
      [a[pos], a[pos-1]] = [a[pos-1], a[pos]];
      steps.push({ array: [...a], states: makeStates(n, sorted, { [pos-1]: "swapping", [pos]: "swapping" }), description: `Swapped, gnome retreats to ${pos-1}`, comparisons: cmp, swaps: swp, pseudocodeLine: 6 });
      pos--;
    }
  }
  for (let i = 0; i < n; i++) sorted.add(i);
  steps.push({ array: [...a], states: Array(n).fill("sorted"), description: "Sorted!", comparisons: cmp, swaps: swp });
  return steps;
}

export function getPancakeSortSteps(arr: number[]): SortStep[] {
  const steps: SortStep[] = [];
  const a = [...arr];
  const n = a.length;
  const sorted = new Set<number>();
  let cmp = 0, swp = 0;

  function flip(k: number) {
    const flipped: Partial<Record<number,BarState>> = {};
    for (let i = 0; i <= k; i++) flipped[i] = "swapping";
    steps.push({ array: [...a], states: makeStates(n, sorted, flipped), description: `Flipping prefix [0..${k}]`, comparisons: cmp, swaps: swp, pseudocodeLine: 6 });
    let l = 0, r = k;
    while (l < r) { swp++; [a[l], a[r]] = [a[r], a[l]]; l++; r--; }
    steps.push({ array: [...a], states: makeStates(n, sorted, flipped), description: `After flip [0..${k}]`, comparisons: cmp, swaps: swp, pseudocodeLine: 6 });
  }

  for (let size = n; size > 1; size--) {
    let maxIdx = 0;
    for (let i = 1; i < size; i++) { cmp++; steps.push({ array: [...a], states: makeStates(n, sorted, { [maxIdx]: "minimum", [i]: "comparing" }), description: `Find max in [0..${size-1}]: checking arr[${i}]=${a[i]}`, comparisons: cmp, swaps: swp, pseudocodeLine: 1 }); if (a[i] > a[maxIdx]) maxIdx = i; }
    if (maxIdx === size - 1) { sorted.add(size-1); steps.push({ array: [...a], states: makeStates(n, sorted, {}), description: `${a[size-1]} already at position ${size-1}`, comparisons: cmp, swaps: swp, pseudocodeLine: 2 }); continue; }
    if (maxIdx !== 0) flip(maxIdx);
    flip(size - 1);
    sorted.add(size - 1);
  }
  sorted.add(0);
  steps.push({ array: [...a], states: Array(n).fill("sorted"), description: "Sorted!", comparisons: cmp, swaps: swp });
  return steps;
}

export function getCycleSortSteps(arr: number[]): SortStep[] {
  const steps: SortStep[] = [];
  const a = [...arr];
  const n = a.length;
  const sorted = new Set<number>();
  let cmp = 0, swp = 0;

  for (let cycleStart = 0; cycleStart < n - 1; cycleStart++) {
    let item = a[cycleStart];
    steps.push({ array: [...a], states: makeStates(n, sorted, { [cycleStart]: "current" }), description: `Cycle start ${cycleStart}: picked up ${item}`, comparisons: cmp, swaps: swp, pseudocodeLine: 0 });
    let pos = cycleStart;
    for (let i = cycleStart + 1; i < n; i++) { cmp++; steps.push({ array: [...a], states: makeStates(n, sorted, { [cycleStart]: "current", [i]: "comparing" }), description: `Counting elements < ${item}: arr[${i}]=${a[i]}`, comparisons: cmp, swaps: swp, pseudocodeLine: 2 }); if (a[i] < item) pos++; }
    if (pos === cycleStart) { sorted.add(cycleStart); steps.push({ array: [...a], states: makeStates(n, sorted, {}), description: `${item} already in place`, comparisons: cmp, swaps: swp, pseudocodeLine: 3 }); continue; }
    while (item === a[pos]) pos++;
    swp++; [a[pos], item] = [item, a[pos]];
    steps.push({ array: [...a], states: makeStates(n, sorted, { [pos]: "swapping", [cycleStart]: "current" }), description: `Placed ${a[pos]} at pos ${pos}, carrying ${item}`, comparisons: cmp, swaps: swp, pseudocodeLine: 5 });
    while (pos !== cycleStart) {
      pos = cycleStart;
      for (let i = cycleStart + 1; i < n; i++) { cmp++; if (a[i] < item) pos++; }
      while (item === a[pos]) pos++;
      swp++; [a[pos], item] = [item, a[pos]];
      steps.push({ array: [...a], states: makeStates(n, sorted, { [pos]: "swapping", [cycleStart]: "current" }), description: pos === cycleStart ? `Cycle complete at ${cycleStart}` : `Placed ${a[pos]} at pos ${pos}, carrying ${item}`, comparisons: cmp, swaps: swp, pseudocodeLine: 9 });
    }
    sorted.add(cycleStart);
  }
  for (let i = 0; i < n; i++) sorted.add(i);
  steps.push({ array: [...a], states: Array(n).fill("sorted"), description: "Sorted!", comparisons: cmp, swaps: swp });
  return steps;
}

export function getOddEvenSortSteps(arr: number[]): SortStep[] {
  const steps: SortStep[] = [];
  const a = [...arr];
  const n = a.length;
  const sorted = new Set<number>();
  let cmp = 0, swp = 0;
  let isSorted = false;
  while (!isSorted) {
    isSorted = true;
    steps.push({ array: [...a], states: Array(n).fill("default"), description: "Odd phase: comparing pairs (1,2),(3,4)...", comparisons: cmp, swaps: swp, pseudocodeLine: 2 });
    for (let i = 1; i <= n - 2; i += 2) {
      cmp++; steps.push({ array: [...a], states: makeStates(n, sorted, { [i]: "comparing", [i+1]: "comparing" }), description: `Odd: comparing arr[${i}]=${a[i]} ↔ arr[${i+1}]=${a[i+1]}`, comparisons: cmp, swaps: swp, pseudocodeLine: 3 });
      if (a[i] > a[i+1]) { swp++; isSorted = false; [a[i], a[i+1]] = [a[i+1], a[i]]; steps.push({ array: [...a], states: makeStates(n, sorted, { [i]: "swapping", [i+1]: "swapping" }), description: `Swapped ${a[i]} ↔ ${a[i+1]}`, comparisons: cmp, swaps: swp, pseudocodeLine: 4 }); }
    }
    steps.push({ array: [...a], states: Array(n).fill("default"), description: "Even phase: comparing pairs (0,1),(2,3)...", comparisons: cmp, swaps: swp, pseudocodeLine: 6 });
    for (let i = 0; i <= n - 2; i += 2) {
      cmp++; steps.push({ array: [...a], states: makeStates(n, sorted, { [i]: "comparing", [i+1]: "comparing" }), description: `Even: comparing arr[${i}]=${a[i]} ↔ arr[${i+1}]=${a[i+1]}`, comparisons: cmp, swaps: swp, pseudocodeLine: 7 });
      if (a[i] > a[i+1]) { swp++; isSorted = false; [a[i], a[i+1]] = [a[i+1], a[i]]; steps.push({ array: [...a], states: makeStates(n, sorted, { [i]: "swapping", [i+1]: "swapping" }), description: `Swapped ${a[i]} ↔ ${a[i+1]}`, comparisons: cmp, swaps: swp, pseudocodeLine: 8 }); }
    }
  }
  for (let i = 0; i < n; i++) sorted.add(i);
  steps.push({ array: [...a], states: Array(n).fill("sorted"), description: "Sorted!", comparisons: cmp, swaps: swp });
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
    case "cocktail":
      return getCocktailSortSteps(arr);
    case "comb":
      return getCombSortSteps(arr);
    case "gnome":
      return getGnomeSortSteps(arr);
    case "pancake":
      return getPancakeSortSteps(arr);
    case "cycle":
      return getCycleSortSteps(arr);
    case "oddeven":
      return getOddEvenSortSteps(arr);
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
