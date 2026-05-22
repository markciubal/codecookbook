// Exact TypeScript source of every algorithm as run during benchmarking.
// Extracted from lib/benchmark.ts — keep in sync when implementations change.

export const BENCHMARK_SOURCE: Record<string, string> = {

  logos: `// Logos Sort — LogosAdaptive (v3.7.1)
// Single dispatcher over two compilation-isolated paths (numbers, strings).
// Mutates \`arr\` and returns it. Each path lives in its own IIFE so V8 compiles
// it as a separate unit — bundling them drops optimization on the string path.
const logosSortNumbers: (arr: number[]) => number[] = (() => {
  const INSERTION_SORT_THRESHOLD = 24, COUNTING_SORT_K = 4;
  const NEARLY_SORTED_INV_RATIO = 0.05, MOMENTUM_THRESHOLD = 50_000;
  const MAX_RUNS_FOR_MERGE = 32, FLOAT_RADIX_THRESHOLD = 4096;
  const FLASH_SORT_THRESHOLD = 4096, FLASH_SAFETY_RATIO = 0.05, MIN_GALLOP = 7;
  const INT32_MIN_L = -2147483648, INT32_MAX_L = 2147483647;

  function insertionSort(a: number[], lo: number, hi: number): void {
    for (let i = lo + 1; i <= hi; i++) {
      const k = a[i]; let j = i - 1;
      while (j >= lo && a[j] > k) { a[j + 1] = a[j]; j--; }
      a[j + 1] = k;
    }
  }
  // momentum insertion (large nearly-sorted), heapsort, dual-pivot quicksort
  // with median-of-5 / Dutch-flag fallback, LSD radix (int32 + float64),
  // flash sort, and natural-run detection with 4-way / 2-way galloping merge.
  // … full bodies elided here for brevity; see lib/benchmark.ts …

  return function(arr: number[]): number[] {
    const length = arr.length;
    let minValue = arr[0], maxValue = arr[0];
    let allIntegers = Number.isInteger(arr[0]);
    let isAscending = true, isDescending = true;
    for (let i = 1; i < length; i++) {
      const v = arr[i];
      if (v < minValue) minValue = v; else if (v > maxValue) maxValue = v;
      if (allIntegers && !Number.isInteger(v)) allIntegers = false;
      if (isAscending  && v < arr[i - 1]) isAscending = false;
      if (isDescending && v > arr[i - 1]) isDescending = false;
    }
    const allInt32 = allIntegers && minValue >= INT32_MIN_L && maxValue <= INT32_MAX_L;
    // 1. Already sorted? Return as-is. Reversed? One mirror pass.
    if (isAscending) return arr;
    if (isDescending) { for (let l = 0, r = length - 1; l < r; l++, r--) { const t = arr[l]; arr[l] = arr[r]; arr[r] = t; } return arr; }
    // 2. Dense integer range → counting sort. Full 32-bit ints → LSD radix.
    if (allIntegers) {
      const span = maxValue - minValue + 1;
      if (span <= COUNTING_SORT_K * length) {
        const buckets = new Uint32Array(span);
        for (let i = 0; i < length; i++) buckets[arr[i] - minValue]++;
        let w = 0;
        for (let v = 0; v < span; v++) { const c = buckets[v], val = v + minValue; for (let j = 0; j < c; j++) arr[w++] = val; }
        return arr;
      }
      if (allInt32 && length >= 64) { lsdRadixInt32(arr, length); return arr; }
    }
    // 3. Tiny input → insertion sort.
    if (length <= INSERTION_SORT_THRESHOLD) { insertionSort(arr, 0, length - 1); return arr; }
    // 4. Few natural runs → galloping merge (TimSort-style).
    const runs = detectRunsLimited(arr, length, MAX_RUNS_FOR_MERGE);
    if (runs !== null && runs.length > 2) { mergeAllRuns(arr, length, runs); return arr; }
    // 5. Nearly sorted (sampled) → insertion / momentum insertion.
    const sampleSize = Math.min(length, 40), sampleStep = Math.max(1, (length / sampleSize) | 0);
    let inv = 0, comps = 0;
    for (let i = 0; i + sampleStep < length; i += sampleStep) { if (arr[i] > arr[i + sampleStep]) inv++; comps++; }
    if (comps > 0 && inv / comps <= NEARLY_SORTED_INV_RATIO) {
      if (length > MOMENTUM_THRESHOLD) insertionSortMomentum(arr, 0, length - 1);
      else                             insertionSort(arr, 0, length - 1);
      return arr;
    }
    // 6. Uniformly distributed floats → flash sort.
    if (length >= FLASH_SORT_THRESHOLD && maxValue > minValue && isFlashSafe(arr, length, minValue, maxValue)) { flashSort(arr, length, minValue, maxValue); return arr; }
    // 7. Large float arrays → float64 LSD radix.
    if (length >= FLOAT_RADIX_THRESHOLD) { lsdRadixFloat64(arr, length); return arr; }
    // 8. General case → dual-pivot introsort (heapsort fallback at depth limit).
    quicksort(arr, 0, length - 1, 2 * (31 - Math.clz32(length)));
    return arr;
  };
})();

const logosSortStrings: (arr: string[]) => string[] = (() => {
  const INSERTION_THRESHOLD_STR = 16;
  function insertionSortStr(a: string[], lo: number, hi: number): void {
    for (let i = lo + 1; i <= hi; i++) { const k = a[i]; let j = i - 1; while (j >= lo && a[j] > k) { a[j + 1] = a[j]; j--; } a[j + 1] = k; }
  }
  // Three-way (multikey) quicksort partitioning on charCodeAt(d); recurses on
  // the equal region at depth d+1. O(n·k) on shared-prefix string sets.
  function multikeyQs(a: string[], lo: number, hi: number, d: number): void {
    while (hi - lo >= INSERTION_THRESHOLD_STR) {
      const mid = (lo + hi) >> 1;
      const c1 = d < a[lo].length ? a[lo].charCodeAt(d) : -1;
      const c2 = d < a[mid].length ? a[mid].charCodeAt(d) : -1;
      const c3 = d < a[hi].length ? a[hi].charCodeAt(d) : -1;
      const pv = c1 < c2 ? (c2 < c3 ? c2 : (c1 < c3 ? c3 : c1)) : (c1 < c3 ? c1 : (c2 < c3 ? c3 : c2));
      let lt = lo, gt = hi, i = lo;
      while (i <= gt) {
        const s = a[i]; const c = d < s.length ? s.charCodeAt(d) : -1;
        if      (c < pv) { const t = a[lt]; a[lt] = a[i]; a[i] = t; lt++; i++; }
        else if (c > pv) { const t = a[gt]; a[gt] = a[i]; a[i] = t; gt--; }
        else             { i++; }
      }
      multikeyQs(a, lo, lt - 1, d);
      if (pv >= 0) multikeyQs(a, lt, gt, d + 1);
      lo = gt + 1;
    }
    insertionSortStr(a, lo, hi);
  }
  return function(arr: string[]): string[] {
    const n = arr.length;
    let isAsc = true, isDesc = true;
    for (let i = 1; i < n; i++) { if (isAsc && arr[i] < arr[i - 1]) isAsc = false; if (isDesc && arr[i] > arr[i - 1]) isDesc = false; if (!isAsc && !isDesc) break; }
    if (isAsc) return arr;
    if (isDesc) { for (let l = 0, r = n - 1; l < r; l++, r--) { const t = arr[l]; arr[l] = arr[r]; arr[r] = t; } return arr; }
    if (n <= INSERTION_THRESHOLD_STR) { insertionSortStr(arr, 0, n - 1); return arr; }
    multikeyQs(arr, 0, n - 1, 0);
    return arr;
  };
})();

// Dispatch on element type; mutates and returns \`arr\`.
function logosSort(input: number[]): number[] {
  if (input.length <= 1) return input;
  return (typeof (input as unknown[])[0] === "string"
    ? logosSortStrings(input as unknown as string[])
    : logosSortNumbers(input)) as number[];
}`,

  timsort: `// Tim Sort (V8) — JavaScript's native Array.prototype.sort()
//
// V8 (Node.js / Chrome) uses TimSort implemented in C++.
// The benchmark wraps it to return a new array (non-destructive):

function timsort(input: number[]): number[] {
  return [...input].sort((a, b) => a - b);
  //     ↑ spread copy   ↑ numeric comparator (required — default is lexicographic)
}

// Note: without (a, b) => a - b, [10, 9, 2] would sort as [10, 2, 9] (string order).
// The (a, b) => a - b comparator is a C++ function call per comparison.`,

  "timsort-js": `function timSortJS(input: number[]): number[] {
  // TimSort (JS) — pure JavaScript implementation.
  // Natural run detection + insertion sort + merge with temp buffer.
  // Same algorithm as V8's native .sort() but entirely in JS.
  // Difference in benchmark times = JS <=> C++ comparator callback overhead.
  const arr = [...input];
  const n = arr.length;
  if (n < 2) return arr;

  // MIN_RUN ∈ [32,64]: chosen so n/MIN_RUN is near a power of two
  function minRunLength(len: number): number {
    let r = 0;
    while (len >= 64) { r |= len & 1; len >>= 1; }
    return len + r;
  }
  const MIN_RUN = minRunLength(n);

  // Binary insertion sort for a[lo..hi], a[lo..start-1] already sorted
  function binaryInsert(lo: number, hi: number, start: number): void {
    for (let i = start; i <= hi; i++) {
      const pivot = arr[i];
      let left = lo, right = i;
      while (left < right) {
        const mid = (left + right) >>> 1;
        if (arr[mid] > pivot) right = mid; else left = mid + 1;
      }
      for (let j = i; j > left; j--) arr[j] = arr[j - 1];
      arr[left] = pivot;
    }
  }

  // Find a natural run starting at lo; reverse descending runs in-place
  function countRunAndMakeAscending(lo: number, hi: number): number {
    let runHi = lo + 1;
    if (runHi === hi + 1) return runHi;
    if (arr[runHi++] < arr[lo]) {
      while (runHi <= hi && arr[runHi] < arr[runHi - 1]) runHi++;
      for (let l = lo, r = runHi - 1; l < r; l++, r--) { const t = arr[l]; arr[l] = arr[r]; arr[r] = t; }
    } else {
      while (runHi <= hi && arr[runHi] >= arr[runHi - 1]) runHi++;
    }
    return runHi;
  }

  // Stable merge of a[lo..mid] with a[mid+1..hi] using a temp buffer
  function merge(lo: number, mid: number, hi: number): void {
    const leftLen = mid - lo + 1, rightLen = hi - mid;
    if (leftLen <= rightLen) {
      const tmp = arr.slice(lo, mid + 1);
      let i = 0, j = mid + 1, k = lo;
      while (i < leftLen && j <= hi) arr[k++] = tmp[i] <= arr[j] ? tmp[i++] : arr[j++];
      while (i < leftLen) arr[k++] = tmp[i++];
    } else {
      const tmp = arr.slice(mid + 1, hi + 1);
      let i = mid, j = rightLen - 1, k = hi;
      while (i >= lo && j >= 0) arr[k--] = arr[i] > tmp[j] ? arr[i--] : tmp[j--];
      while (j >= 0) arr[k--] = tmp[j--];
    }
  }

  // Run stack — each entry is [base, length]
  const runBase: number[] = [], runLen: number[] = [];

  function mergeAt(i: number): void {
    const base2 = runBase[i + 1], len2 = runLen[i + 1];
    runLen[i] += len2;
    runBase.splice(i + 1, 1); runLen.splice(i + 1, 1);
    merge(runBase[i], base2 - 1, base2 + len2 - 1);
  }

  function mergeCollapse(): void {
    while (runBase.length > 1) {
      const n2 = runBase.length - 1;
      if (n2 > 1 && runLen[n2 - 2] <= runLen[n2 - 1] + runLen[n2]) {
        mergeAt(runLen[n2 - 2] < runLen[n2] ? n2 - 2 : n2 - 1);
      } else if (runLen[n2 - 1] <= runLen[n2]) {
        mergeAt(n2 - 1);
      } else break;
    }
  }

  // Main loop: find runs, extend short ones, push, merge
  let lo = 0, remaining = n;
  while (remaining > 0) {
    let runLength = countRunAndMakeAscending(lo, lo + remaining - 1) - lo;
    if (runLength < MIN_RUN) {
      const force = Math.min(remaining, MIN_RUN);
      binaryInsert(lo, lo + force - 1, lo + runLength);
      runLength = force;
    }
    runBase.push(lo); runLen.push(runLength);
    mergeCollapse();
    lo += runLength; remaining -= runLength;
  }
  // Final merge — collapse remaining stack
  while (runBase.length > 1) mergeAt(runBase.length > 2 && runLen[runBase.length - 3] < runLen[runBase.length - 1] ? runBase.length - 3 : runBase.length - 2);
  return arr;
}`,

  adaptive: `function adaptiveSort(input: number[]): number[] {
  // Adaptive Sort — profiles the input first, then picks the cheapest strategy.
  //   1. Counting sort: integers with small value range (O(n + span), O(span) space)
  //   2. Insertion sort: tiny arrays (n ≤ 16) or nearly-sorted (≤5% inversions)
  //   3. Introsort: median-of-3 quicksort + heapsort fallback at depth 2·log₂n
  // O(n log n) worst case (heapsort fallback), O(n) on structured input.
  const arr = [...input];
  const n = arr.length;
  if (n <= 1) return arr;

  // ── Profile pass: min/max, integer check, sampled inversion rate ───────────
  let minVal = arr[0], maxVal = arr[0], allInt = true, inversions = 0;
  for (let i = 0; i < n; i++) {
    if (arr[i] < minVal) minVal = arr[i];
    if (arr[i] > maxVal) maxVal = arr[i];
    if (!Number.isInteger(arr[i])) allInt = false;
  }
  const sampleSize = Math.min(n, 40);
  const stride = Math.max(1, Math.floor(n / sampleSize));
  for (let i = 0; i + stride < n; i += stride) {
    if (arr[i] > arr[i + stride]) inversions++;
  }
  const invRate = inversions / Math.max(1, sampleSize - 1);
  const span = maxVal - minVal + 1;

  // ── Path 1: counting sort for integers with small range ───────────────────
  if (allInt && span < 4 * n) {
    const count = new Array(span).fill(0);
    for (let i = 0; i < n; i++) count[arr[i] - minVal]++;
    let idx = 0;
    for (let v = 0; v < span; v++) {
      while (count[v]-- > 0) arr[idx++] = v + minVal;
    }
    return arr;
  }

  function ins(lo: number, hi: number) {
    for (let i = lo + 1; i <= hi; i++) {
      const k = arr[i]; let j = i - 1;
      while (j >= lo && arr[j] > k) { arr[j + 1] = arr[j]; j--; }
      arr[j + 1] = k;
    }
  }

  // ── Path 2: tiny or nearly-sorted → insertion sort (O(n) on sorted) ───────
  if (n <= 16 || invRate <= 0.05) { ins(0, n - 1); return arr; }

  // ── Path 3: introsort with heapsort fallback ──────────────────────────────
  const maxDepth = 2 * Math.floor(Math.log2(n));
  function hpfy(end: number, root: number, base: number) {
    let lg = root;
    const l = 2 * root + 1, r = 2 * root + 2;
    if (l < end && arr[base + l] > arr[base + lg]) lg = l;
    if (r < end && arr[base + r] > arr[base + lg]) lg = r;
    if (lg !== root) { [arr[base + root], arr[base + lg]] = [arr[base + lg], arr[base + root]]; hpfy(end, lg, base); }
  }
  function hp(lo: number, hi: number) {
    const len = hi - lo + 1;
    for (let i = Math.floor(len / 2) - 1; i >= 0; i--) hpfy(len, i, lo);
    for (let i = len - 1; i > 0; i--) { [arr[lo], arr[lo + i]] = [arr[lo + i], arr[lo]]; hpfy(i, 0, lo); }
  }
  function med3(lo: number, mid: number, hi: number) {
    if (arr[lo] > arr[mid]) [arr[lo], arr[mid]] = [arr[mid], arr[lo]];
    if (arr[lo] > arr[hi])  [arr[lo], arr[hi]]  = [arr[hi],  arr[lo]];
    if (arr[mid] > arr[hi]) [arr[mid], arr[hi]] = [arr[hi], arr[mid]];
    return mid;
  }
  function sort(lo: number, hi: number, depth: number) {
    if (hi - lo < 1) return;
    if (hi - lo + 1 <= 16) { ins(lo, hi); return; }
    if (depth === 0) { hp(lo, hi); return; }
    const mid = (lo + hi) >> 1;
    const pi = med3(lo, mid, hi);
    const pv = arr[pi];
    [arr[pi], arr[hi - 1]] = [arr[hi - 1], arr[pi]];
    let i = lo, j = hi - 2;
    while (true) {
      while (i <= hi - 1 && arr[i] < pv) i++;
      while (j >= lo && arr[j] > pv) j--;
      if (i >= j) break;
      [arr[i], arr[j]] = [arr[j], arr[i]]; i++; j--;
    }
    [arr[i], arr[hi - 1]] = [arr[hi - 1], arr[i]];
    // Recurse smaller half first → O(log n) stack depth bound
    if (i - lo <= hi - i) { sort(lo, i - 1, depth - 1); sort(i + 1, hi, depth - 1); }
    else { sort(i + 1, hi, depth - 1); sort(lo, i - 1, depth - 1); }
  }
  sort(0, n - 1, maxDepth);
  return arr;
}`,

  pdqsort: `function pdqSort(input: number[]): number[] {
  // Pattern-Defeating Quicksort by Orson Peters (2021).
  // Hybrid of introsort + adversarial-resistance heuristics:
  //   • Median-of-3 / pseudomedian-of-9 (Tukey's ninther) pivot selection
  //   • Insertion sort under threshold (24 elements)
  //   • Heapsort fallback once log₂(n) bad partitions occur — O(n log n) guarantee
  //   • Detects already-partitioned subsequences via partial insertion sort
  //     (gives up after 8 element moves)
  //   • Special-cases equal-to-pivot: routes equals to the LEFT partition when
  //     the pivot equals its predecessor, breaking many-duplicates worst case to O(n)
  //   • Shuffles a few elements on highly unbalanced partitions to defeat patterns
  //
  // Worst case: O(n log n)  Best case: O(n) (already sorted)
  // Space: O(log n)  Stable: NO  Used as Rust std and Boost.Sort default.
  const arr = [...input];
  const INSERT = 24, NINTHER = 128, PARTIAL = 8;
  const lt = (a: number, b: number) => a < b;

  function insertionSort(begin: number, end: number) {
    if (begin === end) return;
    for (let cur = begin + 1; cur < end; cur++) {
      let sift = cur, sift1 = cur - 1;
      if (lt(arr[sift], arr[sift1])) {
        const tmp = arr[sift];
        do { arr[sift--] = arr[sift1]; }
        while (sift !== begin && lt(tmp, arr[--sift1]));
        arr[sift] = tmp;
      }
    }
  }
  // Skip the begin guard — caller guarantees *(begin - 1) ≤ any element in [begin, end).
  function unguardedInsertionSort(begin: number, end: number) {
    if (begin === end) return;
    for (let cur = begin + 1; cur < end; cur++) {
      let sift = cur, sift1 = cur - 1;
      if (lt(arr[sift], arr[sift1])) {
        const tmp = arr[sift];
        do { arr[sift--] = arr[sift1]; }
        while (lt(tmp, arr[--sift1]));
        arr[sift] = tmp;
      }
    }
  }
  // Aborts if more than PARTIAL element moves are needed — lets the caller
  // fall back to full quicksort when the input wasn't actually nearly sorted.
  function partialInsertionSort(begin: number, end: number): boolean {
    if (begin === end) return true;
    let limit = 0;
    for (let cur = begin + 1; cur < end; cur++) {
      let sift = cur, sift1 = cur - 1;
      if (lt(arr[sift], arr[sift1])) {
        const tmp = arr[sift];
        do { arr[sift--] = arr[sift1]; }
        while (sift !== begin && lt(tmp, arr[--sift1]));
        arr[sift] = tmp;
        limit += cur - sift;
      }
      if (limit > PARTIAL) return false;
    }
    return true;
  }

  function sort2(a: number, b: number) {
    if (lt(arr[b], arr[a])) { const t = arr[a]; arr[a] = arr[b]; arr[b] = t; }
  }
  function sort3(a: number, b: number, c: number) { sort2(a, b); sort2(b, c); sort2(a, b); }

  // Right partition: equals go to the right half. Returns [pivotPos, alreadyPartitioned].
  function partitionRight(begin: number, end: number): [number, boolean] {
    const pivot = arr[begin];
    let first = begin, last = end;
    while (lt(arr[++first], pivot));
    if (first - 1 === begin) while (first < last && !lt(arr[--last], pivot));
    else                      while (                !lt(arr[--last], pivot));
    const alreadyPartitioned = first >= last;
    while (first < last) {
      const t = arr[first]; arr[first] = arr[last]; arr[last] = t;
      while (lt(arr[++first], pivot));
      while (!lt(arr[--last], pivot));
    }
    const pp = first - 1;
    arr[begin] = arr[pp]; arr[pp] = pivot;
    return [pp, alreadyPartitioned];
  }
  // Left partition (equals go LEFT) — used only when pivot equals its predecessor.
  function partitionLeft(begin: number, end: number): number {
    const pivot = arr[begin];
    let first = begin, last = end;
    while (lt(pivot, arr[--last]));
    if (last + 1 === end) while (first < last && !lt(pivot, arr[++first]));
    else                   while (                !lt(pivot, arr[++first]));
    while (first < last) {
      const t = arr[first]; arr[first] = arr[last]; arr[last] = t;
      while (lt(pivot, arr[--last]));
      while (!lt(pivot, arr[++first]));
    }
    arr[begin] = arr[last]; arr[last] = pivot;
    return last;
  }

  // Heapsort guarantees O(n log n) when bad-partition budget runs out.
  function heapify(end: number, root: number, base: number) {
    let lg = root;
    const l = 2 * root + 1, r = 2 * root + 2;
    if (l < end && arr[base + l] > arr[base + lg]) lg = l;
    if (r < end && arr[base + r] > arr[base + lg]) lg = r;
    if (lg !== root) {
      const t = arr[base + root]; arr[base + root] = arr[base + lg]; arr[base + lg] = t;
      heapify(end, lg, base);
    }
  }
  function heapSortRange(begin: number, end: number) {
    const len = end - begin;
    for (let i = (len >> 1) - 1; i >= 0; i--) heapify(len, i, begin);
    for (let i = len - 1; i > 0; i--) {
      const t = arr[begin]; arr[begin] = arr[begin + i]; arr[begin + i] = t;
      heapify(i, 0, begin);
    }
  }

  function loop(begin: number, end: number, badAllowed: number, leftmost: boolean) {
    while (true) {
      const size = end - begin;
      if (size < INSERT) {
        if (leftmost) insertionSort(begin, end);
        else unguardedInsertionSort(begin, end);
        return;
      }
      const s2 = size >> 1;
      if (size > NINTHER) {
        // Tukey's ninther: pseudomedian of 9 — three sort3s of three indices each,
        // then a final sort3 of those three medians, then swap into [begin].
        sort3(begin, begin + s2, end - 1);
        sort3(begin + 1, begin + (s2 - 1), end - 2);
        sort3(begin + 2, begin + (s2 + 1), end - 3);
        sort3(begin + (s2 - 1), begin + s2, begin + (s2 + 1));
        const t = arr[begin]; arr[begin] = arr[begin + s2]; arr[begin + s2] = t;
      } else {
        sort3(begin + s2, begin, end - 1);
      }

      // Equal-elements fast path: pivot equals predecessor → group all equals to the left.
      if (!leftmost && !lt(arr[begin - 1], arr[begin])) {
        begin = partitionLeft(begin, end) + 1;
        continue;
      }

      const [pivotPos, alreadyPartitioned] = partitionRight(begin, end);
      const lSize = pivotPos - begin;
      const rSize = end - (pivotPos + 1);
      const unbalanced = lSize < (size >> 3) || rSize < (size >> 3);

      if (unbalanced) {
        if (--badAllowed === 0) { heapSortRange(begin, end); return; }
        // Shuffle to defeat patterns
        if (lSize >= INSERT) {
          const q = lSize >> 2;
          const t1 = arr[begin]; arr[begin] = arr[begin + q]; arr[begin + q] = t1;
          const t2 = arr[pivotPos - 1]; arr[pivotPos - 1] = arr[pivotPos - q]; arr[pivotPos - q] = t2;
        }
        if (rSize >= INSERT) {
          const q = rSize >> 2;
          const t1 = arr[pivotPos + 1]; arr[pivotPos + 1] = arr[pivotPos + 1 + q]; arr[pivotPos + 1 + q] = t1;
          const t2 = arr[end - 1]; arr[end - 1] = arr[end - q]; arr[end - q] = t2;
        }
      } else if (alreadyPartitioned
              && partialInsertionSort(begin, pivotPos)
              && partialInsertionSort(pivotPos + 1, end)) {
        return;  // O(n) best case for already-sorted input
      }

      // Recurse left, tail-call right (bounded stack depth).
      loop(begin, pivotPos, badAllowed, leftmost);
      begin = pivotPos + 1;
      leftmost = false;
    }
  }

  if (arr.length > 1) loop(0, arr.length, Math.floor(Math.log2(arr.length)), true);
  return arr;
}`,

  introsort: `function introSort(input: number[]): number[] {
  // Introsort: quicksort with heapsort fallback at depth 2·⌊log₂n⌋.
  // Guarantees O(n log n) worst case, O(log n) stack space.
  const arr = [...input];
  const n = arr.length;
  const maxDepth = n <= 1 ? 0 : 2 * Math.floor(Math.log2(n));

  // Insertion sort for small subarrays
  function ins(lo: number, hi: number) {
    for (let i = lo + 1; i <= hi; i++) {
      const k = arr[i]; let j = i - 1;
      while (j >= lo && arr[j] > k) { arr[j + 1] = arr[j]; j--; }
      arr[j + 1] = k;
    }
  }

  // Heapify (sift-down) for the heapsort fallback
  function hpfy(end: number, root: number, base: number) {
    let lg = root;
    const l = 2 * root + 1, r = 2 * root + 2;
    if (l < end && arr[base + l] > arr[base + lg]) lg = l;
    if (r < end && arr[base + r] > arr[base + lg]) lg = r;
    if (lg !== root) { [arr[base + root], arr[base + lg]] = [arr[base + lg], arr[base + root]]; hpfy(end, lg, base); }
  }

  // In-place heapsort on a[lo..hi]
  function hp(lo: number, hi: number) {
    const len = hi - lo + 1;
    for (let i = Math.floor(len / 2) - 1; i >= 0; i--) hpfy(len, i, lo);
    for (let i = len - 1; i > 0; i--) { [arr[lo], arr[lo + i]] = [arr[lo + i], arr[lo]]; hpfy(i, 0, lo); }
  }

  // Median-of-3 pivot selection
  function med3(lo: number, mid: number, hi: number) {
    if (arr[lo] > arr[mid]) [arr[lo], arr[mid]] = [arr[mid], arr[lo]];
    if (arr[lo] > arr[hi]) [arr[lo], arr[hi]] = [arr[hi], arr[lo]];
    if (arr[mid] > arr[hi]) [arr[mid], arr[hi]] = [arr[hi], arr[mid]];
    return mid;
  }

  function sort(lo: number, hi: number, depth: number) {
    if (hi - lo < 1) return;
    if (hi - lo + 1 <= 16) { ins(lo, hi); return; }  // small → insertion sort
    if (depth === 0) { hp(lo, hi); return; }           // deep → heapsort fallback
    const mid = (lo + hi) >> 1;
    const pi = med3(lo, mid, hi);
    const pv = arr[pi];
    [arr[pi], arr[hi - 1]] = [arr[hi - 1], arr[pi]];
    let i = lo, j = hi - 2;
    while (true) {
      while (i <= hi - 1 && arr[i] < pv) i++;
      while (j >= lo && arr[j] > pv) j--;
      if (i >= j) break;
      [arr[i], arr[j]] = [arr[j], arr[i]]; i++; j--;
    }
    [arr[i], arr[hi - 1]] = [arr[hi - 1], arr[i]];
    sort(lo, i - 1, depth - 1);
    sort(i + 1, hi, depth - 1);
  }

  sort(0, n - 1, maxDepth);
  return arr;
}`,

  merge: `function mergeSort(input: number[]): number[] {
  // Merge Sort — recursive divide and conquer.
  // Divide until trivial (size 1), then merge sorted halves back up.
  // Stable, O(n log n) guaranteed, O(n) space.
  const arr = [...input];

  function mergeHalves(lower: number, upper: number) {
    if (upper <= lower) return;
    const midpoint = (lower + upper) >> 1;
    mergeHalves(lower, midpoint);
    mergeHalves(midpoint + 1, upper);
    // Two-pointer merge into a temporary left-half buffer
    const leftHalf = arr.slice(lower, midpoint + 1);
    let leftIndex = 0, rightIndex = midpoint + 1, writeIndex = lower;
    while (leftIndex < leftHalf.length && rightIndex <= upper)
      arr[writeIndex++] = leftHalf[leftIndex] <= arr[rightIndex]
        ? leftHalf[leftIndex++] : arr[rightIndex++];
    while (leftIndex < leftHalf.length) arr[writeIndex++] = leftHalf[leftIndex++];
  }

  mergeHalves(0, arr.length - 1);
  return arr;
}`,

  quick: `function quickSort(input: number[]): number[] {
  // Quick Sort — single-pivot Lomuto partition with median-of-3.
  // Median-of-3 pivot selection eliminates worst case on sorted/reversed input.
  // Average O(n log n), worst case O(n²), O(log n) space.
  const arr = [...input];

  function partitionAndRecurse(lower: number, upper: number) {
    if (lower >= upper) return;
    // Median-of-3: sort {arr[lo], arr[mid], arr[hi]}, use arr[hi] as pivot
    const midpoint = (lower + upper) >> 1;
    if (arr[midpoint] < arr[lower]) [arr[lower], arr[midpoint]] = [arr[midpoint], arr[lower]];
    if (arr[upper]    < arr[lower]) [arr[lower], arr[upper]]    = [arr[upper],    arr[lower]];
    if (arr[upper]    < arr[midpoint]) [arr[midpoint], arr[upper]] = [arr[upper], arr[midpoint]];
    // Lomuto partition: scan left-to-right, swap elements ≤ pivot leftward
    const pivot = arr[upper];
    let partitionEnd = lower - 1;
    for (let scanIndex = lower; scanIndex < upper; scanIndex++)
      if (arr[scanIndex] <= pivot) { ++partitionEnd; [arr[partitionEnd], arr[scanIndex]] = [arr[scanIndex], arr[partitionEnd]]; }
    [arr[partitionEnd + 1], arr[upper]] = [arr[upper], arr[partitionEnd + 1]];
    partitionAndRecurse(lower, partitionEnd);
    partitionAndRecurse(partitionEnd + 2, upper);
  }

  partitionAndRecurse(0, arr.length - 1);
  return arr;
}`,

  heap: `function heapSort(input: number[]): number[] {
  // Heap Sort — build a max-heap, then extract the maximum repeatedly.
  // O(n log n) guaranteed in all cases, O(1) in-place. Not stable.
  const arr = [...input];
  const arraySize = arr.length;

  // Sift-down: restore heap property at rootIndex within a heap of given size
  function sift(size: number, rootIndex: number) {
    let largestIndex = rootIndex;
    const leftChild  = 2 * rootIndex + 1;
    const rightChild = 2 * rootIndex + 2;
    if (leftChild  < size && arr[leftChild]  > arr[largestIndex]) largestIndex = leftChild;
    if (rightChild < size && arr[rightChild] > arr[largestIndex]) largestIndex = rightChild;
    if (largestIndex !== rootIndex) {
      [arr[rootIndex], arr[largestIndex]] = [arr[largestIndex], arr[rootIndex]];
      sift(size, largestIndex);
    }
  }

  // Phase 1: build max-heap in O(n) (sift from last internal node upward)
  for (let nodeIndex = (arraySize >> 1) - 1; nodeIndex >= 0; nodeIndex--)
    sift(arraySize, nodeIndex);

  // Phase 2: repeatedly swap root (max) with last, shrink heap, repair
  for (let heapEnd = arraySize - 1; heapEnd > 0; heapEnd--) {
    [arr[0], arr[heapEnd]] = [arr[heapEnd], arr[0]];
    sift(heapEnd, 0);
  }
  return arr;
}`,

  shell: `function shellSort(input: number[]): number[] {
  // Shell Sort — diminishing-gap insertion sort.
  // Gap sequence: n/2, n/4, …, 1 (Shell 1959).
  // O(n log² n) in practice. O(1) space. Not stable.
  const arr = [...input];
  let gap = arr.length >> 1;  // start with gap = n/2

  while (gap > 0) {
    // Insertion sort with stride \`gap\`
    for (let i = gap; i < arr.length; i++) {
      const currentValue = arr[i];
      let shiftIndex = i;
      while (shiftIndex >= gap && arr[shiftIndex - gap] > currentValue) {
        arr[shiftIndex] = arr[shiftIndex - gap];
        shiftIndex -= gap;
      }
      arr[shiftIndex] = currentValue;
    }
    gap >>= 1;  // halve the gap each pass
  }
  return arr;
}`,

  counting: `function countingSort(input: number[]): number[] {
  // Counting Sort — tally each value, then reconstruct in order.
  // No element comparisons — escapes the Ω(n log n) lower bound entirely.
  // O(n + k) time and space, where k = max − min. Stable.
  if (!input.length) return [];

  // Find value range
  let minValue = input[0], maxValue = input[0];
  for (const element of input) {
    if (element < minValue) minValue = element;
    if (element > maxValue) maxValue = element;
  }

  // Tally occurrences (offset by minValue to handle negatives)
  const frequency = new Array(maxValue - minValue + 1).fill(0);
  for (const element of input) frequency[element - minValue]++;

  // Reconstruct: emit each value exactly frequency[v] times in ascending order
  const output: number[] = [];
  frequency.forEach((freq, valueOffset) => {
    for (let j = 0; j < freq; j++) output.push(valueOffset + minValue);
  });
  return output;
}`,

  radix: `function radixSort(input: number[]): number[] {
  // Radix Sort — least-significant digit first (LSD), base 10.
  // Stability of each pass is what makes LSD correct.
  // O(n · d) time where d = number of digit positions, O(n) space.
  if (!input.length) return [];

  let arr = [...input];
  // Shift negatives to non-negative range
  const negativeOffset = Math.min(...arr);
  if (negativeOffset < 0) arr = arr.map(element => element - negativeOffset);

  const maxValue = Math.max(...arr);

  // One stable pass per digit position (ones, tens, hundreds, …)
  for (let exp = 1; Math.floor(maxValue / exp) > 0; exp *= 10) {
    const digitBuckets: number[][] = Array.from({ length: 10 }, () => []);
    for (const element of arr) digitBuckets[Math.floor(element / exp) % 10].push(element);
    arr = digitBuckets.flat();
  }

  // Shift back if negatives were present
  return negativeOffset < 0 ? arr.map(element => element + negativeOffset) : arr;
}`,

  bucket: `function bucketSort(input: number[]): number[] {
  // Bucket Sort — scatter into √n equal-width buckets, sort each, concatenate.
  // Expected O(n) on uniformly distributed input. O(n log n) worst case.
  // O(n) space. Stable if sub-sort is stable.
  if (!input.length) return [];

  const arr = [...input];
  const maxValue = Math.max(...arr) + 1;
  const bucketCount = Math.max(Math.floor(Math.sqrt(arr.length)), 1);
  const buckets: number[][] = Array.from({ length: bucketCount }, () => []);

  // Distribute: each element goes to bucket ⌊(x / max) × nb⌋
  for (const element of arr)
    buckets[Math.min(Math.floor((element / maxValue) * bucketCount), bucketCount - 1)].push(element);

  // Sort each bucket and concatenate
  return buckets.flatMap(bucket => bucket.sort((x, y) => x - y));
}`,

  insertion: `function insertionSort(input: number[]): number[] {
  // Insertion Sort — grow a sorted prefix one element at a time.
  // O(n) best case (already sorted), O(n²) worst case (reversed).
  // O(1) space. Stable. Adaptive — fast on nearly-sorted data.
  const arr = [...input];

  for (let i = 1; i < arr.length; i++) {
    const key = arr[i];  // element to insert into sorted prefix a[0..i−1]
    let insertAt = i - 1;
    // Shift elements right until we find the insertion point
    while (insertAt >= 0 && arr[insertAt] > key) {
      arr[insertAt + 1] = arr[insertAt];
      insertAt--;
    }
    arr[insertAt + 1] = key;
  }
  return arr;
}`,

  selection: `function selectionSort(input: number[]): number[] {
  // Selection Sort — find the minimum in the unsorted region, place it, repeat.
  // Always O(n²) comparisons but only O(n) swaps — optimal when writes are costly.
  // O(1) space. Not stable.
  const arr = [...input];

  for (let i = 0; i < arr.length - 1; i++) {
    // Find the minimum index in a[i..n-1]
    let minIndex = i;
    for (let searchAt = i + 1; searchAt < arr.length; searchAt++)
      if (arr[searchAt] < arr[minIndex]) minIndex = searchAt;
    // Swap minimum into position i
    if (minIndex !== i) [arr[i], arr[minIndex]] = [arr[minIndex], arr[i]];
  }
  return arr;
}`,

  bubble: `function bubbleSort(input: number[]): number[] {
  // Bubble Sort — repeatedly swap adjacent out-of-order elements.
  // After pass i, the last i elements are in their final sorted positions.
  // Always O(n²) comparisons and swaps. O(1) space. Stable.
  const arr = [...input];

  for (let i = 0; i < arr.length; i++)
    for (let j = 0; j < arr.length - i - 1; j++)
      if (arr[j] > arr[j + 1]) [arr[j], arr[j + 1]] = [arr[j + 1], arr[j]];

  return arr;
}`,

  cocktail: `function cocktailSort(input: number[]): number[] {
  // Cocktail Shaker Sort — bidirectional bubble sort.
  // Each pass alternates: bubble right (largest to end), then bubble left (smallest to front).
  // Reduces the "turtle problem" of small elements near the end. O(n²), stable.
  const arr = [...input];
  let lo = 0, hi = arr.length - 1;

  while (lo < hi) {
    // Forward pass: largest unsorted element bubbles to arr[hi]
    for (let i = lo; i < hi; i++)
      if (arr[i] > arr[i + 1]) [arr[i], arr[i + 1]] = [arr[i + 1], arr[i]];
    hi--;
    // Backward pass: smallest unsorted element bubbles to arr[lo]
    for (let i = hi; i > lo; i--)
      if (arr[i] < arr[i - 1]) [arr[i], arr[i - 1]] = [arr[i - 1], arr[i]];
    lo++;
  }
  return arr;
}`,

  comb: `function combSort(input: number[]): number[] {
  // Comb Sort — bubble sort with a shrinking gap (gap factor ≈ 1/1.3).
  // Eliminates turtles (small values near the end) by comparing across larger gaps first.
  // Average O(n log n), worst case O(n²). O(1) space. Not stable.
  const arr = [...input];
  let gap = arr.length;
  let sorted = false;

  while (!sorted) {
    gap = Math.max(1, Math.floor(gap / 1.3));  // shrink gap by factor 1.3
    sorted = gap === 1;                          // only possible to be sorted at gap=1
    for (let i = 0; i + gap < arr.length; i++) {
      if (arr[i] > arr[i + gap]) {
        [arr[i], arr[i + gap]] = [arr[i + gap], arr[i]];
        sorted = false;
      }
    }
  }
  return arr;
}`,

  gnome: `function gnomeSort(input: number[]): number[] {
  // Gnome Sort — like insertion sort but moves backward by swapping.
  // Moves to the next element if in order, swaps and steps back if not.
  // O(n²) worst case, O(n) best case. O(1) space. Stable.
  const arr = [...input];
  let pos = 0;

  while (pos < arr.length) {
    if (pos === 0 || arr[pos] >= arr[pos - 1])
      pos++;           // in order: advance
    else {
      [arr[pos], arr[pos - 1]] = [arr[pos - 1], arr[pos]];
      pos--;           // out of order: swap and step back
    }
  }
  return arr;
}`,

  pancake: `function pancakeSort(input: number[]): number[] {
  // Pancake Sort — sort using only prefix reversals ("flips").
  // Each pass: find the maximum in the unsorted prefix, flip it to the front,
  // then flip the entire unsorted prefix to place it at the end.
  // O(n²) time (at most 2(n-1) flips). O(1) space. Not stable.
  const arr = [...input];

  for (let size = arr.length; size > 1; size--) {
    // Find index of maximum element in a[0..size-1]
    let maxIdx = 0;
    for (let i = 1; i < size; i++) if (arr[i] > arr[maxIdx]) maxIdx = i;

    if (maxIdx !== size - 1) {
      // Flip a[0..maxIdx] to bring max to front
      arr.slice(0, maxIdx + 1).reverse().forEach((v, i) => { arr[i] = v; });
      // Flip a[0..size-1] to place max at position size-1
      arr.slice(0, size).reverse().forEach((v, i) => { arr[i] = v; });
    }
  }
  return arr;
}`,

  cycle: `function cycleSort(input: number[]): number[] {
  // Cycle Sort — minimises the number of writes (each element written at most once).
  // For each element, count its correct position and rotate the cycle of displacements.
  // O(n²) time, O(1) space. Optimal write count. Not stable.
  const arr = [...input];

  for (let cycleStart = 0; cycleStart < arr.length - 1; cycleStart++) {
    let item = arr[cycleStart];
    // Find where item belongs: count elements smaller than it
    let pos = cycleStart;
    for (let i = cycleStart + 1; i < arr.length; i++) if (arr[i] < item) pos++;
    if (pos === cycleStart) continue;  // already in place
    // Skip duplicates
    while (item === arr[pos]) pos++;
    [arr[pos], item] = [item, arr[pos]];
    // Rotate the rest of the cycle
    while (pos !== cycleStart) {
      pos = cycleStart;
      for (let i = cycleStart + 1; i < arr.length; i++) if (arr[i] < item) pos++;
      while (item === arr[pos]) pos++;
      [arr[pos], item] = [item, arr[pos]];
    }
  }
  return arr;
}`,

  oddeven: `function oddEvenSort(input: number[]): number[] {
  // Odd-Even Sort (brick sort) — parallel variant of bubble sort.
  // Alternates between comparing (odd, even) and (even, odd) index pairs.
  // Suitable for parallel execution on SIMD hardware. O(n²) sequential.
  // O(1) space. Stable.
  const arr = [...input];
  let sorted = false;

  while (!sorted) {
    sorted = true;
    // Odd-indexed pairs: compare (1,2), (3,4), (5,6), …
    for (let i = 1; i < arr.length - 1; i += 2)
      if (arr[i] > arr[i + 1]) { [arr[i], arr[i + 1]] = [arr[i + 1], arr[i]]; sorted = false; }
    // Even-indexed pairs: compare (0,1), (2,3), (4,5), …
    for (let i = 0; i < arr.length - 1; i += 2)
      if (arr[i] > arr[i + 1]) { [arr[i], arr[i + 1]] = [arr[i + 1], arr[i]]; sorted = false; }
  }
  return arr;
}`,

};

// Algorithms that show this source label in the header
export const BENCHMARK_SOURCE_LABEL: Record<string, string> = {
  logos:     "TypeScript (benchmark.ts)",
  timsort:      "TypeScript (native .sort())",
  "timsort-js": "TypeScript (benchmark.ts)",
  adaptive:  "TypeScript (benchmark.ts)",
  pdqsort:   "TypeScript (benchmark.ts)",
  introsort: "TypeScript (benchmark.ts)",
  merge:     "TypeScript (benchmark.ts)",
  quick:     "TypeScript (benchmark.ts)",
  heap:      "TypeScript (benchmark.ts)",
  shell:     "TypeScript (benchmark.ts)",
  counting:  "TypeScript (benchmark.ts)",
  radix:     "TypeScript (benchmark.ts)",
  bucket:    "TypeScript (benchmark.ts)",
  insertion: "TypeScript (benchmark.ts)",
  selection: "TypeScript (benchmark.ts)",
  bubble:    "TypeScript (benchmark.ts)",
  cocktail:  "TypeScript (benchmark.ts)",
  comb:      "TypeScript (benchmark.ts)",
  gnome:     "TypeScript (benchmark.ts)",
  pancake:   "TypeScript (benchmark.ts)",
  cycle:     "TypeScript (benchmark.ts)",
  oddeven:   "TypeScript (benchmark.ts)",
};
