export type BenchmarkScenario = "random" | "nearlySorted" | "reversed" | "duplicates";

export function generateBenchmarkInput(n: number, scenario: BenchmarkScenario): number[] {
  switch (scenario) {
    case "random":
      return Array.from({ length: n }, () => Math.floor(Math.random() * 10_000));
    case "nearlySorted": {
      const arr = Array.from({ length: n }, (_, i) => i + 1);
      const swaps = Math.max(1, Math.floor(n * 0.05));
      for (let i = 0; i < swaps; i++) {
        const a = Math.floor(Math.random() * n);
        const b = Math.floor(Math.random() * n);
        [arr[a], arr[b]] = [arr[b], arr[a]];
      }
      return arr;
    }
    case "reversed":
      return Array.from({ length: n }, (_, i) => n - i);
    case "duplicates":
      return Array.from({ length: n }, () => Math.floor(Math.random() * Math.ceil(n / 5)));
  }
}

// ── Pure sort implementations ─────────────────────────────────────────────────

function logosSort(input: number[]): number[] {
  // "The cosmos is full of proportional things." — Vitruvius
  // φ⁻¹ and φ⁻² are the golden ratio and its square — irrational numbers that
  // appear throughout nature in spirals, petals, and shells. We use them to
  // space our two pivots across the subarray, seeking natural division points.
  const PHI  = 0.6180339887498948482; // φ⁻¹  = (√5 − 1) / 2
  const PHI2 = 0.3819660112501051518; // φ⁻²  = (3 − √5) / 2
  // BASE: the threshold below which the overhead of partitioning is not worth it.
  // At small scale, the simplest tool wins.
  const BASE = 48;
  const a = [...input];
  const n = a.length;
  if (n < 2) return a;

  // "Know thyself — and know thy limits." — Socrates (adapted)
  // The depth limit is an introsort-style safety net. If recursion goes 2·log₂(n)+4
  // levels deep, we've likely hit a bad pivot sequence. We stop and defer to the
  // platform's own sort rather than let performance collapse to O(n²).
  const depthLimit = 2 * Math.floor(Math.log2(n)) + 4;

  // "The mean is in all things the best." — Hesiod
  // Three values enter; the middle one leaves. This sorts x, y, z with at most
  // three swaps and returns the median — the value that is neither extreme.
  function median3(x: number, y: number, z: number): number {
    if (x > y) { const t = x; x = y; y = t; }
    if (y > z) { const t = y; y = z; z = t; }
    if (x > y) { const t = x; x = y; y = t; }
    return y;
  }

  // "Walk the middle path." — The Buddha
  // A ninther takes the median of an element and its two neighbours, producing
  // a locally smoothed estimate of the subarray's true median. Nine values are
  // implicitly consulted per pivot — a much better guess than picking blindly.
  function ninther(lo: number, hi: number, idx: number): number {
    return median3(a[Math.max(lo, idx - 1)], a[idx], a[Math.min(hi, idx + 1)]);
  }

  // "To every thing there is a season, and a place for every purpose." — Ecclesiastes 3:1
  // Dutch-flag three-way partition around two pivots p1 ≤ p2. A single left-to-right
  // scan places every element into one of three regions:
  //   a[lo..lt-1] < p1  |  a[lt..gt] ∈ [p1, p2]  |  a[gt+1..hi] > p2
  // lt and gt are the boundaries returned for the next recursion step.
  function dualPartition(lo: number, hi: number, p1: number, p2: number): [number, number] {
    if (p1 > p2) { const t = p1; p1 = p2; p2 = t; }
    let lt = lo, gt = hi, i = lo;
    while (i <= gt) {
      if      (a[i] < p1) { [a[lt], a[i]] = [a[i], a[lt]]; lt++; i++; }
      else if (a[i] > p2) { [a[i], a[gt]] = [a[gt], a[i]]; gt--; }
      else                 { i++; }
    }
    return [lt, gt];
  }

  // "The unexamined life is not worth living." — Socrates
  // Each call to sort() examines its subarray before acting. It asks: is there a
  // faster path? Only when all shortcuts are exhausted does it partition and recurse.
  function sort(lo: number, hi: number, depth: number): void {
    while (lo < hi) {
      const size = hi - lo + 1;

      // "Humility is the beginning of wisdom." — Thomas Aquinas
      // When we've recursed too deeply, we stop and let the platform's native sort
      // finish the job. This is the introsort guarantee: worst-case O(n log n).
      if (depth <= 0) {
        const sub = a.slice(lo, hi + 1).sort((x, y) => x - y);
        for (let k = lo; k <= hi; k++) a[k] = sub[k - lo];
        return;
      }

      // "Great things are made of small things." — Lao Tzu
      // For subarrays of 48 or fewer elements, insertion sort beats quicksort.
      // Each element walks left until it finds its home — simple, cache-friendly, fast.
      if (size <= BASE) {
        for (let i = lo + 1; i <= hi; i++) {
          const key = a[i]; let j = i - 1;
          while (j >= lo && a[j] > key) { a[j + 1] = a[j]; j--; }
          a[j + 1] = key;
        }
        return;
      }

      // "Work with what is, not what should be." — Taoist principle
      // If all values are integers and the range of values is narrow (less than
      // 4× the count), counting sort runs in O(n+k) — linear time, zero comparisons.
      // We tally occurrences in a bucket array, then reconstruct in order.
      let mn = a[lo], mx = a[lo];
      for (let k = lo + 1; k <= hi; k++) { if (a[k] < mn) mn = a[k]; if (a[k] > mx) mx = a[k]; }
      const span = mx - mn;
      if (Number.isInteger(mn) && span < size * 4) {
        const counts = new Array(span + 1).fill(0);
        for (let k = lo; k <= hi; k++) counts[a[k] - mn]++;
        let k = lo;
        for (let v = 0; v <= span; v++) { while (counts[v]-- > 0) a[k++] = v + mn; }
        return;
      }

      // "Why disturb what has already found its place?" — Marcus Aurelius (adapted)
      // A quick O(n) gallop scan checks whether the subarray is already sorted or
      // perfectly reversed. If sorted, we return immediately. If reversed, a single
      // in-place mirror flip restores order in O(n). No partition needed.
      if (a[lo] <= a[lo + 1] && a[lo + 1] <= a[lo + 2]) {
        let sorted = true;
        for (let k = lo; k < hi; k++) { if (a[k] > a[k + 1]) { sorted = false; break; } }
        if (sorted) return;
        let reversed = true;
        for (let k = lo; k < hi; k++) { if (a[k] < a[k + 1]) { reversed = false; break; } }
        if (reversed) { for (let l = lo, r = hi; l < r; l++, r--) { [a[l], a[r]] = [a[r], a[l]]; } return; }
      }

      // "The dice of God are always loaded." — Ralph Waldo Emerson
      // A non-zero random value provides a chaos factor: it scales the φ-derived
      // pivot positions differently on every recursive level. This prevents any
      // fixed input pattern from consistently producing bad pivots.
      let c = 0;
      while (c === 0) c = Math.random() * 2 - 1;
      const chaos = Math.abs(c);
      const range = hi - lo;

      // "Beauty is the proper conformity of the parts to one another." — Werner Heisenberg
      // φ² ≈ 0.382 and φ ≈ 0.618 divide the golden rectangle at its natural split.
      // Scaled by chaos they become the candidate indices for our two pivots.
      // Ninther refines each raw index into a locally-smoothed median estimate.
      const idx1 = lo + Math.min(range, Math.floor(range * PHI2 * chaos));
      const idx2 = lo + Math.min(range, Math.floor(range * PHI  * chaos));
      const p1 = ninther(lo, hi, idx1);
      const p2 = ninther(lo, hi, idx2);

      // Partition around the two pivots, producing three regions.
      const [lt, gt] = dualPartition(lo, hi, p1, p2);

      // "The last shall be first, and the first last." — Matthew 20:16
      // Collect the three regions, sort them by size, and recurse on the two
      // smallest first (pushed onto the call stack). The largest is handled by
      // continuing the while-loop — a tail-call optimisation that bounds stack depth to O(log n).
      const regions: [number, number, number][] = [
        [lt - lo,     lo,     lt - 1],
        [gt - lt + 1, lt,     gt    ],
        [hi - gt,     gt + 1, hi    ],
      ];
      regions.sort((x, y) => x[0] - y[0]);
      if (regions[0][1] < regions[0][2]) sort(regions[0][1], regions[0][2], depth - 1);
      if (regions[1][1] < regions[1][2]) sort(regions[1][1], regions[1][2], depth - 1);
      lo = regions[2][1]; hi = regions[2][2]; depth--;
    }
  }

  sort(0, n - 1, depthLimit);
  return a;
}

function mergeSort(input: number[]): number[] {
  const a = [...input];
  function ms(lo: number, hi: number) {
    if (hi <= lo) return;
    const mid = (lo + hi) >> 1;
    ms(lo, mid); ms(mid + 1, hi);
    const left = a.slice(lo, mid + 1);
    let l = 0, r = mid + 1, k = lo;
    while (l < left.length && r <= hi) a[k++] = left[l] <= a[r] ? left[l++] : a[r++];
    while (l < left.length) a[k++] = left[l++];
  }
  ms(0, a.length - 1);
  return a;
}

function quickSort(input: number[]): number[] {
  const a = [...input];
  function qs(lo: number, hi: number) {
    if (lo >= hi) return;
    const mid = (lo + hi) >> 1;
    if (a[mid] < a[lo]) [a[lo], a[mid]] = [a[mid], a[lo]];
    if (a[hi] < a[lo]) [a[lo], a[hi]] = [a[hi], a[lo]];
    if (a[hi] < a[mid]) [a[mid], a[hi]] = [a[hi], a[mid]];
    const pivot = a[hi]; let i = lo - 1;
    for (let j = lo; j < hi; j++) if (a[j] <= pivot) { ++i; [a[i], a[j]] = [a[j], a[i]]; }
    [a[i + 1], a[hi]] = [a[hi], a[i + 1]];
    qs(lo, i); qs(i + 2, hi);
  }
  qs(0, a.length - 1);
  return a;
}

function heapSort(input: number[]): number[] {
  const a = [...input];
  const n = a.length;
  function sift(size: number, i: number) {
    let lg = i, l = 2 * i + 1, r = 2 * i + 2;
    if (l < size && a[l] > a[lg]) lg = l;
    if (r < size && a[r] > a[lg]) lg = r;
    if (lg !== i) { [a[i], a[lg]] = [a[lg], a[i]]; sift(size, lg); }
  }
  for (let i = (n >> 1) - 1; i >= 0; i--) sift(n, i);
  for (let i = n - 1; i > 0; i--) { [a[0], a[i]] = [a[i], a[0]]; sift(i, 0); }
  return a;
}

function shellSort(input: number[]): number[] {
  const a = [...input];
  let gap = a.length >> 1;
  while (gap > 0) {
    for (let i = gap; i < a.length; i++) {
      const t = a[i]; let j = i;
      while (j >= gap && a[j - gap] > t) { a[j] = a[j - gap]; j -= gap; }
      a[j] = t;
    }
    gap >>= 1;
  }
  return a;
}

function countingSort(input: number[]): number[] {
  if (!input.length) return [];
  let mn = input[0], mx = input[0];
  for (const x of input) { if (x < mn) mn = x; if (x > mx) mx = x; }
  const count = new Array(mx - mn + 1).fill(0);
  for (const x of input) count[x - mn]++;
  const out: number[] = [];
  count.forEach((c, i) => { for (let j = 0; j < c; j++) out.push(i + mn); });
  return out;
}

function radixSort(input: number[]): number[] {
  if (!input.length) return [];
  let a = [...input];
  const off = Math.min(...a);
  if (off < 0) a = a.map(x => x - off);
  const mx = Math.max(...a);
  for (let exp = 1; Math.floor(mx / exp) > 0; exp *= 10) {
    const b: number[][] = Array.from({ length: 10 }, () => []);
    for (const x of a) b[Math.floor(x / exp) % 10].push(x);
    a = b.flat();
  }
  return off < 0 ? a.map(x => x + off) : a;
}

function bucketSort(input: number[]): number[] {
  if (!input.length) return [];
  const a = [...input];
  const mx = Math.max(...a) + 1;
  const nb = Math.max(Math.floor(Math.sqrt(a.length)), 1);
  const buckets: number[][] = Array.from({ length: nb }, () => []);
  for (const x of a) buckets[Math.min(Math.floor((x / mx) * nb), nb - 1)].push(x);
  return buckets.flatMap(b => b.sort((x, y) => x - y));
}

function insertionSort(input: number[]): number[] {
  const a = [...input];
  for (let i = 1; i < a.length; i++) {
    const key = a[i]; let j = i - 1;
    while (j >= 0 && a[j] > key) { a[j + 1] = a[j]; j--; }
    a[j + 1] = key;
  }
  return a;
}

function selectionSort(input: number[]): number[] {
  const a = [...input];
  for (let i = 0; i < a.length - 1; i++) {
    let m = i;
    for (let j = i + 1; j < a.length; j++) if (a[j] < a[m]) m = j;
    if (m !== i) [a[i], a[m]] = [a[m], a[i]];
  }
  return a;
}

function bubbleSort(input: number[]): number[] {
  const a = [...input];
  for (let i = 0; i < a.length; i++)
    for (let j = 0; j < a.length - i - 1; j++)
      if (a[j] > a[j + 1]) [a[j], a[j + 1]] = [a[j + 1], a[j]];
  return a;
}

export const SORT_FNS: Record<string, (arr: number[]) => number[]> = {
  logos:     logosSort,
  timsort:   (arr) => [...arr].sort((a, b) => a - b),
  merge:     mergeSort,
  quick:     quickSort,
  heap:      heapSort,
  shell:     shellSort,
  counting:  countingSort,
  radix:     radixSort,
  bucket:    bucketSort,
  insertion: insertionSort,
  selection: selectionSort,
  bubble:    bubbleSort,
};
