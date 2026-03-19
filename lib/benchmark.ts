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
  const PHI = 0.6180339887498949;
  const a = [...input];
  if (a.length <= 1) return a;

  function ins(lo: number, hi: number) {
    for (let i = lo + 1; i <= hi; i++) {
      const key = a[i]; let j = i - 1;
      while (j >= lo && a[j] > key) { a[j + 1] = a[j]; j--; }
      a[j + 1] = key;
    }
  }

  const stack: [number, number][] = [[0, a.length - 1]];
  while (stack.length > 0) {
    let [lo, hi] = stack.pop()!;
    while (lo < hi) {
      if (hi - lo + 1 <= 16) { ins(lo, hi); break; }
      const pivot = a[lo + Math.floor((hi - lo) * PHI)];
      let lt = lo, gt = hi, i = lo;
      while (i <= gt) {
        if (a[i] < pivot)      { [a[lt], a[i]] = [a[i], a[lt]]; lt++; i++; }
        else if (a[i] > pivot) { [a[i], a[gt]] = [a[gt], a[i]]; gt--; }
        else i++;
      }
      const hasL = lo < lt, hasR = gt < hi;
      if (!hasL && !hasR) break;
      if (!hasL) { lo = gt + 1; continue; }
      if (!hasR) { hi = lt - 1; continue; }
      if ((lt - 1 - lo) <= (hi - gt - 1)) { stack.push([lo, lt - 1]); lo = gt + 1; }
      else { stack.push([gt + 1, hi]); hi = lt - 1; }
    }
  }
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
