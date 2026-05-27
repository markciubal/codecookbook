export type BenchmarkScenario = "random" | "nearlySorted" | "reversed" | "duplicates" | "sorted";
export type DataType = "integer" | "float" | "string";

/** Algorithms that cannot sort this data type correctly. */
export const ALGO_INCOMPATIBLE: Record<Exclude<DataType, "integer">, ReadonlySet<string>> = {
  float:  new Set(["radix", "bucket"]),
  // Bitonic pads internally with `Number.POSITIVE_INFINITY` sentinels. JS's
  // mixed number/string `>` is undefined, so the padding doesn't sort to the
  // tail on string input — the CPU bitonic only handles numeric data. The
  // GPU bitonic is int32-only anyway, so this restriction lines up cleanly.
  string: new Set(["counting", "radix", "bucket", "bitonic"]),
};

/** Tunable constants for Logos Sort. */
export interface LogosParams {
  phi:            number;  // primary pivot offset   — default φ⁻¹ ≈ 0.618034
  phi2:           number;  // secondary pivot offset — default φ⁻² ≈ 0.381966
  base:           number;  // insertion-sort threshold (elements) — default 48
  depthMult:      number;  // depth-limit multiplier — default 2  (limit = mult·⌊log₂n⌋ + add)
  depthAdd:       number;  // depth-limit addend     — default 4
  randomScaleMin: number;  // lower bound of per-call jitter scale — default φ⁻¹ ≈ 0.618034
  randomScaleMax: number;  // upper bound of per-call jitter scale — default φ⁻¹ ≈ 0.618034
  countingMult:   number;  // counting-sort trigger: valueRange < n·mult — default 4
}

export const DEFAULT_LOGOS_PARAMS: LogosParams = {
  phi:          0.61803399,
  phi2:         0.38196601,
  base:         48,
  depthMult:    2,
  depthAdd:     4,
  randomScaleMin: 0.61803399,
  randomScaleMax: 0.61803399,
  countingMult: 4,
};

export type ValueDistribution = "uniform" | "normal" | "exponential" | "bimodal";

export interface CustomDistribution {
  preSortedPct: number;  // 0–100: % of elements already in sorted position (prefix sorted)
  duplicatePct: number;  // 0–100: % of elements replaced with duplicates
  // Optional integer-specific knobs:
  uniqueOnly?: boolean;  // if true, guarantee no duplicate values (overrides duplicatePct)
  fullInt32?: boolean;   // if true, draw from the full signed 32-bit range [INT32_MIN, INT32_MAX]
  // Value distribution for the "random" scenario (other scenarios have fixed
  // semantics — sorted/reversed/nearlySorted/duplicates — and ignore this).
  // Defaults to "uniform" (the existing behavior).
  distribution?: ValueDistribution;
}

// 32-bit signed integer bounds — used by the `fullInt32` integer option.
const INT32_MIN = -2_147_483_648;
const INT32_MAX =  2_147_483_647;
const INT32_RANGE = INT32_MAX - INT32_MIN + 1; // 2^32

/**
 * Draw a random integer over the configured range.
 *   • fullInt32 = true  → uniform across the full signed 32-bit range
 *   • fullInt32 = false → uniform in [0, 10000) (the legacy small range)
 *
 * We use two Math.random()s for the 32-bit case because Math.random() only
 * yields 52 bits of precision but distributes them unevenly when multiplied
 * by 2^32 — the two-half approach gives uniform coverage of all 2^32 values.
 */
function randInt(fullInt32: boolean): number {
  if (!fullInt32) return Math.floor(Math.random() * 10_000);
  // High and low 16-bit halves combined via shift, then re-centered to signed.
  const hi = Math.floor(Math.random() * 0x10000);
  const lo = Math.floor(Math.random() * 0x10000);
  // Use a 32-bit unsigned, then map to signed by subtracting 2^31 — uniform.
  const unsigned = (hi * 0x10000 + lo) >>> 0;
  return unsigned + INT32_MIN; // shift into signed range
}

/**
 * Sample a single integer from the requested distribution, mapped onto the
 * active integer range (legacy [0, 10000) or signed 32-bit when fullInt32).
 *
 *   • uniform     — existing behavior (delegates to randInt).
 *   • normal      — Box-Muller; mean = range midpoint, σ = range/6 (~±3σ).
 *   • exponential — λ = 5/range so most mass clusters near the low end.
 *   • bimodal     — two Gaussians centered at 30 % and 70 % of the range.
 *
 * Out-of-range samples are clamped to the range bounds (a small bias at the
 * tails, but keeps the array within the same numeric domain as uniform).
 */
function sampleDist(dist: ValueDistribution, fullInt32: boolean): number {
  if (dist === "uniform") return randInt(fullInt32);
  const lo = fullInt32 ? INT32_MIN : 0;
  const hi = fullInt32 ? INT32_MAX : 9999;
  const range = hi - lo + 1;
  const clamp = (v: number) => v < lo ? lo : v > hi ? hi : Math.round(v);
  // Box-Muller standard normal (one of two outputs).
  const stdNormal = () => {
    let u1 = Math.random(); if (u1 === 0) u1 = 1e-12;
    const u2 = Math.random();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  };
  if (dist === "normal") {
    const mid = lo + range / 2;
    const sigma = range / 6;
    return clamp(mid + stdNormal() * sigma);
  }
  if (dist === "exponential") {
    let u = Math.random(); if (u === 0) u = 1e-12;
    const mean = range / 5;
    return clamp(lo + (-Math.log(u)) * mean);
  }
  // bimodal — pick one of two centers, then a small Gaussian around it.
  const peak = lo + range * (Math.random() < 0.5 ? 0.3 : 0.7);
  const sigmaB = range / 12;
  return clamp(peak + stdNormal() * sigmaB);
}

/**
 * Generate n unique integers using rejection sampling over the chosen range.
 *
 * - For tiny ranges where n approaches the range size, we fall back to
 *   "build the full range, shuffle, take first n" (Fisher–Yates) so the
 *   rejection rate stays bounded.
 * - For very wide ranges (fullInt32), simple rejection is fine because the
 *   range (~4.3 billion) dwarfs any practical n.
 */
function uniqueIntegers(n: number, fullInt32: boolean): number[] {
  const rangeSize = fullInt32 ? INT32_RANGE : 10_000;
  if (n > rangeSize) {
    // Caller asked for more unique values than the range can supply. Cap at
    // range size; the resulting array will be a permutation of the entire range.
    n = rangeSize;
  }
  // Threshold heuristic: when n is more than half the range, materialise the
  // full range and shuffle. Below that, rejection sampling with a Set is faster.
  if (rangeSize <= 65_536 || n > rangeSize / 2) {
    // Materialise the legacy 0..9999 range — only fast for the small case.
    const lo = fullInt32 ? INT32_MIN : 0;
    const pool = Array.from({ length: rangeSize }, (_, i) => lo + i);
    // Fisher-Yates partial shuffle: only randomise the first n positions.
    for (let i = 0; i < n; i++) {
      const j = i + Math.floor(Math.random() * (rangeSize - i));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, n);
  }
  // Rejection sampling — fast when n << rangeSize (the common case for 32-bit).
  const seen = new Set<number>();
  const out: number[] = [];
  while (out.length < n) {
    const v = randInt(fullInt32);
    if (!seen.has(v)) {
      seen.add(v);
      out.push(v);
    }
  }
  return out;
}

export function generateBenchmarkInput(
  n: number,
  scenario: BenchmarkScenario,
  custom?: CustomDistribution,
): number[] {
  const fullInt32 = custom?.fullInt32 === true;
  const uniqueOnly = custom?.uniqueOnly === true;
  let arr: number[];
  switch (scenario) {
    case "random": {
      // Distribution applies only to the random scenario — sorted/reversed/
      // nearlySorted/duplicates have fixed structural semantics that a
      // distribution would obscure. uniqueOnly likewise overrides shape.
      const dist = custom?.distribution ?? "uniform";
      arr = uniqueOnly
        ? uniqueIntegers(n, fullInt32)
        : dist === "uniform"
          ? Array.from({ length: n }, () => randInt(fullInt32))
          : Array.from({ length: n }, () => sampleDist(dist, fullInt32));
      break;
    }
    case "nearlySorted": {
      // "Nearly sorted" needs increasing values regardless of mode. If
      // fullInt32 is requested, stretch the increment to cover the range so
      // values land across the full int32 span instead of clustering at the
      // bottom — preserves the "nearly sorted" property of monotone order.
      const stride = fullInt32 ? Math.max(1, Math.floor(INT32_RANGE / Math.max(n, 1))) : 1;
      const base   = fullInt32 ? INT32_MIN : 1;
      arr = Array.from({ length: n }, (_, i) => base + i * stride);
      const swaps = Math.max(1, Math.floor(n * 0.05));
      for (let i = 0; i < swaps; i++) {
        const indexA = Math.floor(Math.random() * n);
        const indexB = Math.floor(Math.random() * n);
        [arr[indexA], arr[indexB]] = [arr[indexB], arr[indexA]];
      }
      break;
    }
    case "reversed":
      arr = fullInt32
        ? Array.from({ length: n }, (_, i) => INT32_MAX - i)
        : Array.from({ length: n }, (_, i) => n - i);
      break;
    case "duplicates":
      // Duplicate scenario explicitly wants duplicates — uniqueOnly is
      // incompatible; we honour scenario semantics (intentional duplicates)
      // unless uniqueOnly is set, in which case the array becomes all unique
      // in a tight range (loses scenario character but respects the flag).
      if (uniqueOnly) {
        arr = uniqueIntegers(n, fullInt32);
      } else {
        const rangeCeil = fullInt32 ? Math.max(2, Math.ceil(n / 5)) : Math.ceil(n / 5);
        arr = Array.from({ length: n }, () => Math.floor(Math.random() * rangeCeil));
      }
      break;
    case "sorted":
      arr = fullInt32
        ? Array.from({ length: n }, (_, i) => INT32_MIN + i * Math.max(1, Math.floor(INT32_RANGE / Math.max(n, 1))))
        : Array.from({ length: n }, (_, i) => i + 1);
      break;
    default: {
      const dist = custom?.distribution ?? "uniform";
      arr = uniqueOnly
        ? uniqueIntegers(n, fullInt32)
        : dist === "uniform"
          ? Array.from({ length: n }, () => randInt(fullInt32))
          : Array.from({ length: n }, () => sampleDist(dist, fullInt32));
    }
  }

  if (custom) {
    // Apply pre-sorted prefix: sort the first preSortedPct% of elements
    if (custom.preSortedPct > 0) {
      const prefixLen = Math.floor(n * custom.preSortedPct / 100);
      const prefix = arr.slice(0, prefixLen).sort((a, b) => a - b);
      for (let i = 0; i < prefixLen; i++) arr[i] = prefix[i];
    }
    // Apply duplicate injection: replace duplicatePct% of elements with the median value.
    // Skip when uniqueOnly is set — those two options are mutually exclusive
    // and uniqueOnly takes priority.
    if (custom.duplicatePct > 0 && !custom.uniqueOnly) {
      const count = Math.floor(n * custom.duplicatePct / 100);
      const dupVal = arr[Math.floor(n / 2)];
      for (let i = 0; i < count; i++) {
        arr[Math.floor(Math.random() * n)] = dupVal;
      }
    }
  }

  return arr;
}

/** Generate float input: same distribution as integer but with a decimal part. */
export function generateFloatInput(
  n: number,
  scenario: BenchmarkScenario,
  custom?: CustomDistribution,
): number[] {
  return generateBenchmarkInput(n, scenario, custom).map(v => v + Math.random());
}

/** Generate string input: 6-char base-36 strings with the requested distribution. */
export function generateStringInput(n: number, scenario: BenchmarkScenario): string[] {
  const pad = (i: number) => i.toString(36).padStart(6, "0");
  const rand = () => Math.floor(Math.random() * 36 ** 6);
  switch (scenario) {
    case "sorted":
      return Array.from({ length: n }, (_, i) => pad(i));
    case "reversed":
      return Array.from({ length: n }, (_, i) => pad(n - 1 - i));
    case "nearlySorted": {
      const arr = Array.from({ length: n }, (_, i) => pad(i));
      const swaps = Math.max(1, Math.floor(n * 0.05));
      for (let i = 0; i < swaps; i++) {
        const a = Math.floor(Math.random() * n);
        const b = Math.floor(Math.random() * n);
        [arr[a], arr[b]] = [arr[b], arr[a]];
      }
      return arr;
    }
    case "duplicates": {
      const pool = Array.from({ length: Math.max(1, Math.ceil(n / 5)) }, () => pad(rand()));
      return Array.from({ length: n }, () => pool[Math.floor(Math.random() * pool.length)]);
    }
    default:
      return Array.from({ length: n }, () => pad(rand()));
  }
}

// ── Pure sort implementations ─────────────────────────────────────────────────

// ============================================================
// Logos Sort — LogosAdaptive (v3.7.1)
// ------------------------------------------------------------
// Single dispatcher over two compilation-isolated paths (numbers, strings).
// Mutates `arr` and returns it. Each path lives in its own IIFE so V8 compiles
// it as a separate unit — bundling them in one closure drops optimization on
// the string path (5-8x regression on long-string workloads).
//
// Numeric path: asc/desc fast-paths · counting sort · int32 LSD radix ·
//   insertion (+ momentum variant) · natural-run detection with 4-way / 2-way
//   galloping merge · flash sort · float64 LSD radix · dual-pivot introsort
//   with Dutch-flag fallback · heapsort depth-limit fallback.
// String path: asc/desc fast-paths · insertion · multikey quicksort.
// ============================================================
const logosSortNumbers: (arr: number[]) => number[] = (() => {
  const INSERTION_SORT_THRESHOLD = 24;
  const COUNTING_SORT_K          = 4;
  const NEARLY_SORTED_INV_RATIO  = 0.05;
  const MOMENTUM_THRESHOLD       = 50_000;
  const MAX_RUNS_FOR_MERGE       = 32;
  const FLOAT_RADIX_THRESHOLD    = 4096;
  const FLASH_SORT_THRESHOLD     = 4096;
  const FLASH_SAFETY_RATIO       = 0.05;
  const MIN_GALLOP               = 7;
  const INT32_MIN_L = -2147483648, INT32_MAX_L = 2147483647;

  function insertionSort(a: number[], lo: number, hi: number): void {
    for (let i = lo + 1; i <= hi; i++) {
      const k = a[i]; let j = i - 1;
      while (j >= lo && a[j] > k) { a[j + 1] = a[j]; j--; }
      a[j + 1] = k;
    }
  }
  function insertionSortMomentum(a: number[], lo: number, hi: number): void {
    let momentum = 1;
    for (let i = lo + 1; i <= hi; i++) {
      const k = a[i];
      if (a[i - 1] <= k) { momentum = momentum > 1 ? (momentum >>> 1) : 1; continue; }
      let j = i - 1, step = momentum;
      while (step > 1 && (j - step < lo || a[j - step] <= k)) step >>>= 1;
      while (j - step >= lo && a[j - step] > k) { j -= step; step <<= 1; }
      let left = Math.max(lo, j - step); const right = j;
      let lft = left, rgt = right;
      while (lft < rgt) { const mid = (lft + rgt) >>> 1; if (a[mid] > k) rgt = mid; else lft = mid + 1; }
      left = lft;
      const dist = i - left;
      for (let p = i; p > left; p--) a[p] = a[p - 1];
      a[left] = k; momentum = dist;
    }
  }
  function siftDown(a: number[], base: number, root: number, end: number): void {
    for (;;) {
      let big = root;
      const l = 2*root+1, r = l+1;
      if (l < end && a[base+l] > a[base+big]) big = l;
      if (r < end && a[base+r] > a[base+big]) big = r;
      if (big === root) return;
      const t = a[base+root]; a[base+root] = a[base+big]; a[base+big] = t;
      root = big;
    }
  }
  function heapSortLocal(a: number[], lo: number, hi: number): void {
    const len = hi - lo + 1;
    for (let i = (len>>1)-1; i >= 0; i--) siftDown(a, lo, i, len);
    for (let i = len - 1; i > 0; i--) {
      const t = a[lo]; a[lo] = a[lo+i]; a[lo+i] = t;
      siftDown(a, lo, 0, i);
    }
  }
  function sort5(a: number[], i1: number, i2: number, i3: number, i4: number, i5: number): void {
    if (a[i2] < a[i1]) { const t = a[i2]; a[i2] = a[i1]; a[i1] = t; }
    if (a[i3] < a[i2]) { const t = a[i3]; a[i3] = a[i2]; a[i2] = t;
      if (a[i2] < a[i1]) { const u = a[i2]; a[i2] = a[i1]; a[i1] = u; } }
    if (a[i4] < a[i3]) { const t = a[i4]; a[i4] = a[i3]; a[i3] = t;
      if (a[i3] < a[i2]) { const u = a[i3]; a[i3] = a[i2]; a[i2] = u;
        if (a[i2] < a[i1]) { const v = a[i2]; a[i2] = a[i1]; a[i1] = v; } } }
    if (a[i5] < a[i4]) { const t = a[i5]; a[i5] = a[i4]; a[i4] = t;
      if (a[i4] < a[i3]) { const u = a[i4]; a[i4] = a[i3]; a[i3] = u;
        if (a[i3] < a[i2]) { const v = a[i3]; a[i3] = a[i2]; a[i2] = v;
          if (a[i2] < a[i1]) { const w = a[i2]; a[i2] = a[i1]; a[i1] = w; } } } }
  }
  function quicksort(a: number[], lo: number, hi: number, d: number): void {
    while (hi - lo >= INSERTION_SORT_THRESHOLD) {
      if (d === 0) { heapSortLocal(a, lo, hi); return; }
      const len = hi - lo + 1;
      const seventh = (len >> 3) + (len >> 6) + 1;
      const e3 = (lo + hi) >> 1;
      const e2 = e3 - seventh, e4 = e3 + seventh;
      const e1 = e2 - seventh, e5 = e4 + seventh;
      sort5(a, e1, e2, e3, e4, e5);
      if (a[e1] !== a[e2] && a[e2] !== a[e3] && a[e3] !== a[e4] && a[e4] !== a[e5]) {
        const p1 = a[e2], p2 = a[e4];
        a[e2] = a[lo]; a[e4] = a[hi];
        let less = lo + 1, great = hi - 1, k = less;
        while (k <= great) {
          const ak = a[k];
          if (ak < p1) { a[k] = a[less]; a[less++] = ak; }
          else if (ak > p2) {
            while (k < great && a[great] > p2) great--;
            const ag = a[great];
            a[k] = ag; a[great--] = ak;
            if (ag < p1) { a[k] = a[less]; a[less++] = ag; }
          }
          k++;
        }
        a[lo] = a[less - 1]; a[less - 1] = p1;
        a[hi] = a[great + 1]; a[great + 1] = p2;
        d--;
        quicksort(a, lo, less - 2, d);
        quicksort(a, great + 2, hi, d);
        if (p1 === p2) return;
        let mLo = less, mHi = great;
        while (mLo <= mHi && a[mLo] === p1) mLo++;
        while (mLo <= mHi && a[mHi] === p2) mHi--;
        lo = mLo; hi = mHi;
      } else {
        const pv = a[e3];
        let lt = lo, gt = hi, k = lo;
        while (k <= gt) {
          const v = a[k];
          if (v < pv)      { const t = a[lt]; a[lt] = v; a[k] = t; lt++; k++; }
          else if (v > pv) { const t = a[gt]; a[gt] = v; a[k] = t; gt--;       }
          else             { k++; }
        }
        d--;
        if (lt - lo < hi - gt) { quicksort(a, lo, lt - 1, d); lo = gt + 1; }
        else                   { quicksort(a, gt + 1, hi, d); hi = lt - 1; }
      }
    }
    insertionSort(a, lo, hi);
  }
  function lsdRadixInt32(a: number[], n: number): void {
    const BIAS = 0x80000000;
    const src = new Uint32Array(n), dst = new Uint32Array(n);
    for (let i = 0; i < n; i++) src[i] = (a[i] + BIAS) >>> 0;
    const c0 = new Uint32Array(257), c1 = new Uint32Array(257), c2 = new Uint32Array(257), c3 = new Uint32Array(257);
    for (let i = 0; i < n; i++) {
      const v = src[i];
      c0[(v & 0xFF) + 1]++; c1[((v >>> 8) & 0xFF) + 1]++;
      c2[((v >>> 16) & 0xFF) + 1]++; c3[((v >>> 24) & 0xFF) + 1]++;
    }
    for (let b = 1; b < 257; b++) { c0[b]+=c0[b-1]; c1[b]+=c1[b-1]; c2[b]+=c2[b-1]; c3[b]+=c3[b-1]; }
    let from = src, to = dst, tmp = src;
    for (let i = 0; i < n; i++) { const v = from[i]; to[c0[v & 0xFF]++] = v; }
    tmp = from; from = to; to = tmp;
    for (let i = 0; i < n; i++) { const v = from[i]; to[c1[(v >>> 8) & 0xFF]++] = v; }
    tmp = from; from = to; to = tmp;
    for (let i = 0; i < n; i++) { const v = from[i]; to[c2[(v >>> 16) & 0xFF]++] = v; }
    tmp = from; from = to; to = tmp;
    for (let i = 0; i < n; i++) { const v = from[i]; to[c3[(v >>> 24) & 0xFF]++] = v; }
    for (let i = 0; i < n; i++) a[i] = to[i] - BIAS;
  }
  function isFlashSafe(a: number[], n: number, min: number, max: number): boolean {
    const SAMPLE_SIZE = 64;
    const stride = (n / SAMPLE_SIZE) | 0;
    const samples: number[] = new Array(SAMPLE_SIZE);
    for (let i = 0; i < SAMPLE_SIZE; i++) samples[i] = a[i * stride];
    samples.sort((x, y) => x - y);
    return (samples[47] - samples[16]) / (max - min) >= FLASH_SAFETY_RATIO;
  }
  function flashSort(a: number[], n: number, min: number, max: number): void {
    const m = n, scale = (m - 1) / (max - min);
    const counts = new Uint32Array(m + 1);
    for (let i = 0; i < n; i++) { const idx = ((a[i] - min) * scale) | 0; counts[idx + 1]++; }
    for (let i = 1; i <= m; i++) counts[i] += counts[i - 1];
    const scratch = new Float64Array(n);
    for (let i = 0; i < n; i++) { const v = a[i]; const idx = ((v - min) * scale) | 0; scratch[counts[idx]++] = v; }
    for (let i = 0; i < n; i++) a[i] = scratch[i];
    for (let i = 1; i < n; i++) { const k = a[i]; let j = i - 1; while (j >= 0 && a[j] > k) { a[j + 1] = a[j]; j--; } a[j + 1] = k; }
  }
  function lsdRadixFloat64(a: number[], n: number): void {
    const bufA = new Uint32Array(2 * n), bufB = new Uint32Array(2 * n);
    const f64A = new Float64Array(bufA.buffer);
    for (let i = 0; i < n; i++) f64A[i] = a[i];
    for (let i = 0; i < n; i++) {
      const j = 2 * i + 1, hi = bufA[j];
      if (hi & 0x80000000) { bufA[2 * i] = ~bufA[2 * i] >>> 0; bufA[j] = ~hi >>> 0; }
      else                 { bufA[j] = hi ^ 0x80000000; }
    }
    const h0 = new Uint32Array(257), h1 = new Uint32Array(257), h2 = new Uint32Array(257), h3 = new Uint32Array(257);
    const h4 = new Uint32Array(257), h5 = new Uint32Array(257), h6 = new Uint32Array(257), h7 = new Uint32Array(257);
    for (let i = 0; i < n; i++) {
      const lo = bufA[2 * i], hi = bufA[2 * i + 1];
      h0[( lo         & 0xFF) + 1]++; h1[((lo >>>  8) & 0xFF) + 1]++;
      h2[((lo >>> 16) & 0xFF) + 1]++; h3[((lo >>> 24) & 0xFF) + 1]++;
      h4[( hi         & 0xFF) + 1]++; h5[((hi >>>  8) & 0xFF) + 1]++;
      h6[((hi >>> 16) & 0xFF) + 1]++; h7[((hi >>> 24) & 0xFF) + 1]++;
    }
    for (let b = 1; b < 257; b++) {
      h0[b]+=h0[b-1]; h1[b]+=h1[b-1]; h2[b]+=h2[b-1]; h3[b]+=h3[b-1];
      h4[b]+=h4[b-1]; h5[b]+=h5[b-1]; h6[b]+=h6[b-1]; h7[b]+=h7[b-1];
    }
    let from = bufA, to = bufB, tmp = bufA;
    for (let i = 0; i < n; i++) { const lo = from[2*i], hi = from[2*i+1]; const pos = h0[lo & 0xFF]++; to[2*pos] = lo; to[2*pos+1] = hi; }
    tmp = from; from = to; to = tmp;
    for (let i = 0; i < n; i++) { const lo = from[2*i], hi = from[2*i+1]; const pos = h1[(lo >>> 8) & 0xFF]++; to[2*pos] = lo; to[2*pos+1] = hi; }
    tmp = from; from = to; to = tmp;
    for (let i = 0; i < n; i++) { const lo = from[2*i], hi = from[2*i+1]; const pos = h2[(lo >>> 16) & 0xFF]++; to[2*pos] = lo; to[2*pos+1] = hi; }
    tmp = from; from = to; to = tmp;
    for (let i = 0; i < n; i++) { const lo = from[2*i], hi = from[2*i+1]; const pos = h3[(lo >>> 24) & 0xFF]++; to[2*pos] = lo; to[2*pos+1] = hi; }
    tmp = from; from = to; to = tmp;
    for (let i = 0; i < n; i++) { const lo = from[2*i], hi = from[2*i+1]; const pos = h4[hi & 0xFF]++; to[2*pos] = lo; to[2*pos+1] = hi; }
    tmp = from; from = to; to = tmp;
    for (let i = 0; i < n; i++) { const lo = from[2*i], hi = from[2*i+1]; const pos = h5[(hi >>> 8) & 0xFF]++; to[2*pos] = lo; to[2*pos+1] = hi; }
    tmp = from; from = to; to = tmp;
    for (let i = 0; i < n; i++) { const lo = from[2*i], hi = from[2*i+1]; const pos = h6[(hi >>> 16) & 0xFF]++; to[2*pos] = lo; to[2*pos+1] = hi; }
    tmp = from; from = to; to = tmp;
    for (let i = 0; i < n; i++) { const lo = from[2*i], hi = from[2*i+1]; const pos = h7[(hi >>> 24) & 0xFF]++; to[2*pos] = lo; to[2*pos+1] = hi; }
    tmp = from; from = to; to = tmp;
    for (let i = 0; i < n; i++) {
      const j = 2 * i + 1, hi = from[j];
      if (hi & 0x80000000) { from[j] = hi ^ 0x80000000; }
      else                 { from[2 * i] = ~from[2 * i] >>> 0; from[j] = ~hi >>> 0; }
    }
    const finalF64 = new Float64Array(from.buffer);
    for (let i = 0; i < n; i++) a[i] = finalF64[i];
  }
  function detectRunsLimited(a: number[], n: number, maxRuns: number): number[] | null {
    const result: number[] = []; let i = 0;
    while (i < n) {
      let j = i + 1;
      if (j < n) {
        if (a[j] >= a[i]) { while (j < n && a[j] >= a[j - 1]) j++; }
        else { while (j < n && a[j] < a[j - 1]) j++;
          for (let l = i, r = j - 1; l < r; l++, r--) { const t = a[l]; a[l] = a[r]; a[r] = t; } }
      }
      result.push(i, j - 1);
      if ((result.length >> 1) > maxRuns) return null;
      i = j;
    }
    return result;
  }
  function mergeAllRuns(a: number[], n: number, runs: number[]): void {
    const QUADWAY_THRESHOLD = 16;
    const buf: number[] = new Array(n);
    let cur = runs;
    while (cur.length > 2) {
      const next: number[] = [];
      if ((cur.length >> 1) >= QUADWAY_THRESHOLD) {
        for (let k = 0; k < cur.length; k += 8) {
          const numRuns = Math.min(4, (cur.length - k) >> 1);
          if (numRuns === 1) { next.push(cur[k], cur[k + 1]); continue; }
          if (numRuns === 2) { mergeGallop(a, buf, cur[k], cur[k+1], cur[k+2], cur[k+3]); next.push(cur[k], cur[k+3]); continue; }
          if (numRuns === 3) {
            mergeGallop(a, buf, cur[k], cur[k+1], cur[k+2], cur[k+3]);
            mergeGallop(a, buf, cur[k], cur[k+3], cur[k+4], cur[k+5]);
            next.push(cur[k], cur[k+5]); continue;
          }
          merge4WayHybrid(a, buf, cur[k], cur[k+1], cur[k+2], cur[k+3], cur[k+4], cur[k+5], cur[k+6], cur[k+7]);
          next.push(cur[k], cur[k+7]);
        }
      } else {
        for (let k = 0; k < cur.length; k += 4) {
          const a1 = cur[k], b1 = cur[k + 1];
          if (k + 2 >= cur.length) { next.push(a1, b1); continue; }
          mergeGallop(a, buf, a1, b1, cur[k + 2], cur[k + 3]);
          next.push(a1, cur[k + 3]);
        }
      }
      cur = next;
    }
  }
  function merge4WayHybrid(a: number[], buf: number[], a1: number, b1: number, a2: number, b2: number, a3: number, b3: number, a4: number, b4: number): void {
    const INF = Number.POSITIVE_INFINITY;
    let p0=a1,p1=a2,p2=a3,p3=a4; const e0=b1,e1=b2,e2=b3,e3=b4;
    let v0=a[p0],v1=a[p1],v2=a[p2],v3=a[p3]; let w=a1;
    let w0=0,w1=0,w2=0,w3=0;
    while (p0<=e0||p1<=e1||p2<=e2||p3<=e3) {
      const lv=v0<=v1?v0:v1, lw=v0<=v1?0:1, rv=v2<=v3?v2:v3, rw=v2<=v3?2:3;
      const win=lv<=rv?lw:rw, wv=lv<=rv?lv:rv;
      buf[w++]=wv;
      if (win===0) { p0++; v0=p0<=e0?a[p0]:INF; w0++; w1=0; w2=0; w3=0;
        if (w0>=MIN_GALLOP) { const t=v1<v2?(v1<v3?v1:v3):(v2<v3?v2:v3);
          if (t===INF) { while (p0<=e0) buf[w++]=a[p0++]; v0=INF; }
          else { let s=1,j=p0; while (j+s<=e0 && a[j+s-1]<=t) {j+=s;s<<=1;}
            let L=j,R=Math.min(e0+1,j+s); while (L<R){const m=(L+R)>>>1;if(a[m]<=t)L=m+1;else R=m;}
            while (p0<L) buf[w++]=a[p0++]; v0=p0<=e0?a[p0]:INF; } w0=0; } }
      else if (win===1) { p1++; v1=p1<=e1?a[p1]:INF; w1++; w0=0; w2=0; w3=0;
        if (w1>=MIN_GALLOP) { const t=v0<v2?(v0<v3?v0:v3):(v2<v3?v2:v3);
          if (t===INF) { while (p1<=e1) buf[w++]=a[p1++]; v1=INF; }
          else { let s=1,j=p1; while (j+s<=e1 && a[j+s-1]<t) {j+=s;s<<=1;}
            let L=j,R=Math.min(e1+1,j+s); while (L<R){const m=(L+R)>>>1;if(a[m]<t)L=m+1;else R=m;}
            while (p1<L) buf[w++]=a[p1++]; v1=p1<=e1?a[p1]:INF; } w1=0; } }
      else if (win===2) { p2++; v2=p2<=e2?a[p2]:INF; w2++; w0=0; w1=0; w3=0;
        if (w2>=MIN_GALLOP) { const t=v0<v1?(v0<v3?v0:v3):(v1<v3?v1:v3);
          if (t===INF) { while (p2<=e2) buf[w++]=a[p2++]; v2=INF; }
          else { let s=1,j=p2; while (j+s<=e2 && a[j+s-1]<t) {j+=s;s<<=1;}
            let L=j,R=Math.min(e2+1,j+s); while (L<R){const m=(L+R)>>>1;if(a[m]<t)L=m+1;else R=m;}
            while (p2<L) buf[w++]=a[p2++]; v2=p2<=e2?a[p2]:INF; } w2=0; } }
      else { p3++; v3=p3<=e3?a[p3]:INF; w3++; w0=0; w1=0; w2=0;
        if (w3>=MIN_GALLOP) { const t=v0<v1?(v0<v2?v0:v2):(v1<v2?v1:v2);
          if (t===INF) { while (p3<=e3) buf[w++]=a[p3++]; v3=INF; }
          else { let s=1,j=p3; while (j+s<=e3 && a[j+s-1]<t) {j+=s;s<<=1;}
            let L=j,R=Math.min(e3+1,j+s); while (L<R){const m=(L+R)>>>1;if(a[m]<t)L=m+1;else R=m;}
            while (p3<L) buf[w++]=a[p3++]; v3=p3<=e3?a[p3]:INF; } w3=0; } }
    }
    for (let r=a1;r<=b4;r++) a[r]=buf[r];
  }
  function mergeGallop(a: number[], buf: number[], a1: number, b1: number, a2: number, b2: number): void {
    let p=a1,q=a2,w=a1,pW=0,qW=0;
    while (p<=b1 && q<=b2) {
      if (a[p]<=a[q]) {buf[w++]=a[p++];pW++;qW=0;} else {buf[w++]=a[q++];qW++;pW=0;}
      if (pW>=MIN_GALLOP) { const t=a[q]; let s=1,j=p; while (j+s<=b1&&a[j+s-1]<=t){j+=s;s<<=1;}
        let L=j,R=Math.min(b1+1,j+s); while (L<R){const m=(L+R)>>>1;if(a[m]<=t)L=m+1;else R=m;}
        while (p<L) buf[w++]=a[p++]; pW=0; }
      else if (qW>=MIN_GALLOP) { const t=a[p]; let s=1,j=q; while (j+s<=b2&&a[j+s-1]<t){j+=s;s<<=1;}
        let L=j,R=Math.min(b2+1,j+s); while (L<R){const m=(L+R)>>>1;if(a[m]<t)L=m+1;else R=m;}
        while (q<L) buf[w++]=a[q++]; qW=0; }
    }
    while (p<=b1) buf[w++]=a[p++]; while (q<=b2) buf[w++]=a[q++];
    for (let r=a1;r<=b2;r++) a[r]=buf[r];
  }

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
    if (isAscending) return arr;
    if (isDescending) {
      for (let l = 0, r = length - 1; l < r; l++, r--) { const t = arr[l]; arr[l] = arr[r]; arr[r] = t; }
      return arr;
    }
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
    if (length <= INSERTION_SORT_THRESHOLD) { insertionSort(arr, 0, length - 1); return arr; }
    const runs = detectRunsLimited(arr, length, MAX_RUNS_FOR_MERGE);
    if (runs !== null && runs.length > 2) { mergeAllRuns(arr, length, runs); return arr; }
    const sampleSize = Math.min(length, 40);
    const sampleStep = Math.max(1, (length / sampleSize) | 0);
    let inv = 0, comps = 0;
    for (let i = 0; i + sampleStep < length; i += sampleStep) { if (arr[i] > arr[i + sampleStep]) inv++; comps++; }
    if (comps > 0 && inv / comps <= NEARLY_SORTED_INV_RATIO) {
      if (length > MOMENTUM_THRESHOLD) insertionSortMomentum(arr, 0, length - 1);
      else                             insertionSort(arr, 0, length - 1);
      return arr;
    }
    if (length >= FLASH_SORT_THRESHOLD && maxValue > minValue && isFlashSafe(arr, length, minValue, maxValue)) {
      flashSort(arr, length, minValue, maxValue);
      return arr;
    }
    if (length >= FLOAT_RADIX_THRESHOLD) { lsdRadixFloat64(arr, length); return arr; }
    quicksort(arr, 0, length - 1, 2 * (31 - Math.clz32(length)));
    return arr;
  };
})();

const logosSortStrings: (arr: string[]) => string[] = (() => {
  const INSERTION_THRESHOLD_STR = 16;

  function insertionSortStr(a: string[], lo: number, hi: number): void {
    for (let i = lo + 1; i <= hi; i++) {
      const k = a[i]; let j = i - 1;
      while (j >= lo && a[j] > k) { a[j + 1] = a[j]; j--; }
      a[j + 1] = k;
    }
  }
  function multikeyQs(a: string[], lo: number, hi: number, d: number): void {
    while (hi - lo >= INSERTION_THRESHOLD_STR) {
      const mid = (lo + hi) >> 1;
      const c1 = d < a[lo].length  ? a[lo].charCodeAt(d)  : -1;
      const c2 = d < a[mid].length ? a[mid].charCodeAt(d) : -1;
      const c3 = d < a[hi].length  ? a[hi].charCodeAt(d)  : -1;
      const pv = c1 < c2 ? (c2 < c3 ? c2 : (c1 < c3 ? c3 : c1)) : (c1 < c3 ? c1 : (c2 < c3 ? c3 : c2));
      let lt = lo, gt = hi, i = lo;
      while (i <= gt) {
        const s = a[i];
        const c = d < s.length ? s.charCodeAt(d) : -1;
        if      (c < pv) { const t = a[lt]; a[lt] = a[i]; a[i] = t; lt++; i++; }
        else if (c > pv) { const t = a[gt]; a[gt] = a[i]; a[i] = t; gt--;       }
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
    for (let i = 1; i < n; i++) {
      if (isAsc  && arr[i] < arr[i - 1]) isAsc  = false;
      if (isDesc && arr[i] > arr[i - 1]) isDesc = false;
      if (!isAsc && !isDesc) break;
    }
    if (isAsc) return arr;
    if (isDesc) {
      for (let l = 0, r = n - 1; l < r; l++, r--) { const t = arr[l]; arr[l] = arr[r]; arr[r] = t; }
      return arr;
    }
    if (n <= INSERTION_THRESHOLD_STR) { insertionSortStr(arr, 0, n - 1); return arr; }
    multikeyQs(arr, 0, n - 1, 0);
    return arr;
  };
})();

/** Logos Sort (v3.7.1) — dispatches on element type; mutates and returns `arr`. */
function logosSort(input: number[]): number[] {
  if (input.length <= 1) return input;
  return (typeof (input as unknown[])[0] === "string"
    ? logosSortStrings(input as unknown as string[])
    : logosSortNumbers(input)) as number[];
}

function mergeSort(input: number[]): number[] {
  /*
   * Merge Sort — recursive divide and conquer.
   *
   * Divide until trivial, then merge back up.
   *
   * The algorithm splits the array in half until each piece has one element
   * (trivially sorted), then merges pieces back together two at a time.
   * Each merge step is a simple two-pointer walk over two sorted halves.
   *
   * Technical (von Neumann, 1945; Knuth TAOCP Vol. 3 §5.2.4):
   * Divide: split at midpoint recursively until subarrays of size 1 (trivially sorted).
   * Merge: two-pointer merge of sorted halves in O(n) time, preserving order (stable).
   * Recurrence: T(n) = 2T(n/2) + O(n) → T(n) = O(n log n) by Master Theorem, case 2.
   * Guaranteed O(n log n) in all cases — no pivot, no worst case, no escape hatch needed.
   * Space: O(n) for the temporary left-half buffer at each level.
   *
   * Correctness: the merge invariant maintains that k fills a[lo..hi] in sorted order
   * from two sorted halves. When either pointer exhausts its half, the remaining
   * elements of the other are already in order and need no further comparison. □
   */
  const arr = [...input];
  function mergeHalves(lower: number, upper: number) {
    if (upper <= lower) return;
    const midpoint = (lower + upper) >> 1;
    mergeHalves(lower, midpoint); mergeHalves(midpoint + 1, upper);
    const leftHalf = arr.slice(lower, midpoint + 1);
    let leftIndex = 0, rightIndex = midpoint + 1, writeIndex = lower;
    while (leftIndex < leftHalf.length && rightIndex <= upper) arr[writeIndex++] = leftHalf[leftIndex] <= arr[rightIndex] ? leftHalf[leftIndex++] : arr[rightIndex++];
    while (leftIndex < leftHalf.length) arr[writeIndex++] = leftHalf[leftIndex++];
  }
  mergeHalves(0, arr.length - 1);
  return arr;
}

function quickSort(input: number[]): number[] {
  /*
   * Quick Sort — single-pivot partition with median-of-3.
   *
   * Partition around a median-of-3 pivot.
   *
   * Sample the first, middle, and last elements; take their median as the pivot.
   * This eliminates worst-case behavior on already-sorted or reversed input.
   * After one pass, the pivot is in its final position. Recurse on both sides.
   *
   * Technical (Hoare, 1961; Sedgewick 1978 median-of-3):
   * Median-of-3 pivot selection: sort {a[lo], a[mid], a[hi]}, use a[hi] as pivot.
   * This eliminates worst-case behavior on already-sorted or reversed input.
   * Lomuto partition: scan left to right, swap elements ≤ pivot leftward.
   * Recurrence (average): T(n) = 2T(n/2) + O(n) → O(n log n).
   * Worst case: O(n²) if all pivots are extremal — not eliminated, only made unlikely.
   * Space: O(log n) average stack depth; O(n) worst case without tail-call optimization.
   * Not stable: elements equal to the pivot may be reordered relative to each other.
   */
  const arr = [...input];
  function partitionAndRecurse(lower: number, upper: number) {
    if (lower >= upper) return;
    const midpoint = (lower + upper) >> 1;
    if (arr[midpoint] < arr[lower]) [arr[lower], arr[midpoint]] = [arr[midpoint], arr[lower]];
    if (arr[upper] < arr[lower]) [arr[lower], arr[upper]] = [arr[upper], arr[lower]];
    if (arr[upper] < arr[midpoint]) [arr[midpoint], arr[upper]] = [arr[upper], arr[midpoint]];
    const pivot = arr[upper]; let partitionEnd = lower - 1;
    for (let scanIndex = lower; scanIndex < upper; scanIndex++) if (arr[scanIndex] <= pivot) { ++partitionEnd; [arr[partitionEnd], arr[scanIndex]] = [arr[scanIndex], arr[partitionEnd]]; }
    [arr[partitionEnd + 1], arr[upper]] = [arr[upper], arr[partitionEnd + 1]];
    partitionAndRecurse(lower, partitionEnd); partitionAndRecurse(partitionEnd + 2, upper);
  }
  partitionAndRecurse(0, arr.length - 1);
  return arr;
}

function heapSort(input: number[]): number[] {
  /*
   * Heap Sort — max-heap build, then repeated extraction.
   *
   * Build a max-heap, then extract the maximum repeatedly.
   *
   * Phase 1: reshape the array into a max-heap so the largest element is at index 0.
   * Phase 2: swap the root (max) with the last element, shrink the heap, repair.
   * Repeat phase 2 until the heap is empty. The array is sorted in ascending order.
   *
   * Technical (Williams, 1964; Floyd, 1964 heapify):
   * Build phase: sift-down from index ⌊n/2⌋−1 to 0. O(n) total — not O(n log n);
   *   each sift travels at most the height of its subtree, and most nodes are near leaves.
   * Extract phase: swap root (max) with last element, reduce heap size, sift-down root.
   *   n−1 extractions × O(log n) sift = O(n log n).
   * Total: O(n log n) guaranteed in all cases. Space: O(1) — entirely in-place.
   * Not stable: the heap extraction disrupts the original relative order of equal elements.
   *
   * Correctness of sift: at each node i, after sifting, the subtree rooted at i
   * satisfies the max-heap property. The loop invariant is: all nodes below the
   * current sift boundary already satisfy the heap property. □
   */
  const arr = [...input];
  const arraySize = arr.length;
  function sift(size: number, rootIndex: number) {
    let largestIndex = rootIndex; const leftChild = 2 * rootIndex + 1, rightChild = 2 * rootIndex + 2;
    if (leftChild < size && arr[leftChild] > arr[largestIndex]) largestIndex = leftChild;
    if (rightChild < size && arr[rightChild] > arr[largestIndex]) largestIndex = rightChild;
    if (largestIndex !== rootIndex) { [arr[rootIndex], arr[largestIndex]] = [arr[largestIndex], arr[rootIndex]]; sift(size, largestIndex); }
  }
  for (let nodeIndex = (arraySize >> 1) - 1; nodeIndex >= 0; nodeIndex--) sift(arraySize, nodeIndex);
  for (let heapEnd = arraySize - 1; heapEnd > 0; heapEnd--) { [arr[0], arr[heapEnd]] = [arr[heapEnd], arr[0]]; sift(heapEnd, 0); }
  return arr;
}

function shellSort(input: number[]): number[] {
  /*
   * Shell Sort — diminishing-gap insertion sort.
   *
   * Long-distance insertion sort first, then close range.
   *
   * Start with a gap of n/2: elements far apart are insertion-sorted across that
   * distance. Badly-out-of-place elements travel far in one stride instead of
   * crawling one position at a time. Halve the gap and repeat. At gap=1, the
   * final pass is standard insertion sort on a nearly-ordered array — fast.
   *
   * Technical (Shell, 1959; Knuth TAOCP Vol. 3 §5.2.1):
   * Each pass is insertion sort with stride `gap`, treating every gap-th element
   * as a subarray. The final pass (gap=1) is standard insertion sort — O(n²) —
   * but the earlier passes have already reduced inversions dramatically.
   * Gap sequence n/2, n/4, …, 1 gives O(n log² n) in practice (not proven tight).
   * Knuth's sequence 1, 4, 13, 40, … gives O(n^(3/2)); Ciura's (2001) is empirically best.
   * Space: O(1). Not stable.
   *
   * Intuition: a sequence is k-sorted if every element is within k positions of its
   * final location. Each pass produces a tighter k-sorted array. At gap=1, k=1,
   * and insertion sort finishes in O(n) time. □
   */
  const arr = [...input];
  let gap = arr.length >> 1;
  while (gap > 0) {
    for (let i = gap; i < arr.length; i++) {
      const currentValue = arr[i]; let shiftIndex = i;
      while (shiftIndex >= gap && arr[shiftIndex - gap] > currentValue) { arr[shiftIndex] = arr[shiftIndex - gap]; shiftIndex -= gap; }
      arr[shiftIndex] = currentValue;
    }
    gap >>= 1;
  }
  return arr;
}

function countingSort(input: number[]): number[] {
  /*
   * Counting Sort — tally and reconstruct.
   *
   * Count, then reconstruct.
   *
   * Tally how many times each value appears. Then pour them back in ascending
   * order: emit each value exactly count[v] times. No comparisons are made.
   * Every occurrence of every value is accounted for. The output is sorted
   * by construction — not by comparison.
   *
   * Technical (Seward, 1954):
   * Lower bound argument: comparison-based sorting requires Ω(n log n) comparisons
   * because there are n! possible orderings and each comparison eliminates at most half.
   * Counting sort makes zero comparisons between elements — it escapes the model entirely.
   * Cost: O(n + k) where k = max − min. When k = O(n), this is O(n) — linear time.
   * Space: O(k) for the count array.
   *
   * Correctness: count[v] = number of occurrences of value v+mn. The reconstruction
   * iterates v from 0 to k and emits v+mn exactly count[v] times. Every occurrence
   * of every value is emitted. The output is sorted by construction. □
   */
  if (!input.length) return [];
  let minValue = input[0], maxValue = input[0];
  for (const element of input) { if (element < minValue) minValue = element; if (element > maxValue) maxValue = element; }
  const frequency = new Array(maxValue - minValue + 1).fill(0);
  for (const element of input) frequency[element - minValue]++;
  const output: number[] = [];
  frequency.forEach((freq, valueOffset) => { for (let j = 0; j < freq; j++) output.push(valueOffset + minValue); });
  return output;
}

function radixSort(input: number[]): number[] {
  /*
   * Radix Sort — least-significant digit first.
   *
   * Digit-by-digit stable sort, least significant first.
   *
   * Sort by the ones digit (stably), then the tens digit (stably), then hundreds.
   * Stability is what makes this correct: when two elements have the same tens
   * digit, their relative order from the ones-digit pass is preserved.
   * After the final pass, the array is sorted on all digits.
   *
   * Technical (Hollerith, 1887 card sorters; Seward 1954 LSD formalization):
   * LSD (least-significant digit) radix sort: for each digit position exp = 1, 10, 100, …,
   *   distribute elements into 10 buckets by that digit, then concatenate in bucket order.
   *   Each pass is a stable sort on one digit — stability is what makes LSD correct.
   * Cost: O(n · k) where k = number of digit positions = ⌈log₁₀(max)⌉.
   *   For bounded integers (k constant), this is O(n) — linear time.
   * Space: O(n + 10) = O(n) for the bucket arrays.
   *
   * Correctness (by induction on digit position):
   *   After pass i, the array is sorted by the low i digits.
   *   Stability of each pass preserves prior-digit order when higher digits match.
   *   After the final pass, the array is sorted on all digits. □
   *
   * Negative values: shifted to non-negative by subtracting the minimum, then shifted back.
   */
  if (!input.length) return [];
  let arr = [...input];
  const negativeOffset = Math.min(...arr);
  if (negativeOffset < 0) arr = arr.map(element => element - negativeOffset);
  const maxValue = Math.max(...arr);
  for (let exp = 1; Math.floor(maxValue / exp) > 0; exp *= 10) {
    const digitBuckets: number[][] = Array.from({ length: 10 }, () => []);
    for (const element of arr) digitBuckets[Math.floor(element / exp) % 10].push(element);
    arr = digitBuckets.flat();
  }
  return negativeOffset < 0 ? arr.map(element => element + negativeOffset) : arr;
}

function bucketSort(input: number[]): number[] {
  /*
   * Bucket Sort — scatter into regions, sort each, gather.
   *
   * Divide the value range into buckets, sort each, concatenate.
   *
   * Prepare √n buckets, each covering an equal portion of the value range.
   * Place each element in the bucket for its range. Sort each bucket.
   * Concatenate in order. Every element is placed by its value, not by
   * comparison with every other element.
   *
   * Technical (Knuth TAOCP Vol. 3 §5.2.1):
   * √n buckets span equal intervals of [0, max). Each element maps to bucket
   *   ⌊(x / max) × nb⌋, clamped to [0, nb−1].
   * Each bucket is sorted independently — here with Array.prototype.sort (TimSort).
   * Expected cost: O(n + k) when input is uniformly distributed.
   *   Each bucket receives ~√n elements; sorting √n elements costs O(√n log √n).
   *   Total: n × O(√n log √n / n) = O(n + k) on average.
   * Worst case: O(n log n) if all elements fall in one bucket.
   * Space: O(n) for the bucket arrays. Stable if sub-sort is stable.
   */
  if (!input.length) return [];
  const arr = [...input];
  const maxValue = Math.max(...arr) + 1;
  const bucketCount = Math.max(Math.floor(Math.sqrt(arr.length)), 1);
  const buckets: number[][] = Array.from({ length: bucketCount }, () => []);
  for (const element of arr) buckets[Math.min(Math.floor((element / maxValue) * bucketCount), bucketCount - 1)].push(element);
  return buckets.flatMap(bucket => bucket.sort((x, y) => x - y));
}

function insertionSort(input: number[]): number[] {
  /*
   * Insertion Sort — grow a sorted prefix one element at a time.
   *
   * Grow a sorted prefix one element at a time.
   *
   * Start with one element (trivially sorted). Take the next element, walk it
   * left past every element larger than it, and plant it in place.
   * The sorted prefix grows by one each step.
   *
   * Technical (Knuth, TAOCP Vol. 3 §5.2.1):
   * Loop invariant: a[0..i−1] is sorted before step i.
   * Each step shifts elements right until the correct position for a[i] is found.
   * Holds at i=1 trivially (one element). Restored at each step. At i=n: fully sorted. □
   * Best case: O(n) — already-sorted input requires 0 shifts per element.
   * Worst case: O(n²) — reversed input requires i shifts at step i.
   * Adaptive: performance degrades gracefully with disorder.
   * Stable: equal elements are never moved past each other.
   * Space: O(1).
   */
  const arr = [...input];
  for (let i = 1; i < arr.length; i++) {
    const key = arr[i]; let insertAt = i - 1;
    while (insertAt >= 0 && arr[insertAt] > key) { arr[insertAt + 1] = arr[insertAt]; insertAt--; }
    arr[insertAt + 1] = key;
  }
  return arr;
}

function selectionSort(input: number[]): number[] {
  /*
   * Selection Sort — find the minimum, place it, repeat.
   *
   * Find the minimum in the unsorted region, place it at the front.
   *
   * Each pass scans the entire unsorted region to find the smallest element,
   * then places it with one swap. The sorted region grows by one each pass.
   * Exactly n−1 swaps total — optimal when writes are expensive.
   *
   * Technical (Knuth, TAOCP Vol. 3 §5.2.3):
   * Each outer pass i scans a[i..n−1] to find the minimum index m: O(n−i) comparisons.
   * Total comparisons: Σ(n−i) for i=0 to n−2 = n(n−1)/2 = O(n²) — always.
   * Total swaps: at most n−1 — uniquely optimal among O(n²) sorts. Worth noting when
   * swaps are expensive (e.g., large records, external storage).
   * Not stable: the swap can move an equal element ahead of another.
   * Space: O(1).
   */
  const arr = [...input];
  for (let i = 0; i < arr.length - 1; i++) {
    let minIndex = i;
    for (let searchAt = i + 1; searchAt < arr.length; searchAt++) if (arr[searchAt] < arr[minIndex]) minIndex = searchAt;
    if (minIndex !== i) [arr[i], arr[minIndex]] = [arr[minIndex], arr[i]];
  }
  return arr;
}

function bubbleSort(input: number[]): number[] {
  /*
   * Bubble Sort — repeated adjacent swaps until settled.
   *
   * Repeatedly swap adjacent out-of-order elements.
   *
   * Each pass walks the array swapping any adjacent pair that is out of order.
   * The largest unsorted element drifts to its final position each pass,
   * like a bubble rising to the surface.
   *
   * Technical (Knuth, TAOCP Vol. 3 §5.2.2):
   * Each pass i moves the largest unsorted element to position n−1−i.
   * After n−1 passes the array is sorted.
   * Comparisons: n(n−1)/2 = O(n²) always.
   * Swaps: O(n²) worst case (reversed), 0 best case (already sorted).
   * Stable: equal adjacent elements are never swapped (strict > comparison).
   * Space: O(1).
   *
   * Note: early-exit optimization (stop if no swaps in a pass) gives O(n) best case
   * but is not implemented here — this is the canonical textbook form.
   */
  const arr = [...input];
  for (let i = 0; i < arr.length; i++)
    for (let j = 0; j < arr.length - i - 1; j++)
      if (arr[j] > arr[j + 1]) [arr[j], arr[j + 1]] = [arr[j + 1], arr[j]];
  return arr;
}

function cocktailSort(input: number[]): number[] {
  const arr = [...input];
  let lo = 0, hi = arr.length - 1;
  while (lo < hi) {
    for (let i = lo; i < hi; i++) if (arr[i] > arr[i + 1]) [arr[i], arr[i + 1]] = [arr[i + 1], arr[i]];
    hi--;
    for (let i = hi; i > lo; i--) if (arr[i] < arr[i - 1]) [arr[i], arr[i - 1]] = [arr[i - 1], arr[i]];
    lo++;
  }
  return arr;
}

function combSort(input: number[]): number[] {
  const arr = [...input];
  let gap = arr.length;
  let sorted = false;
  while (!sorted) {
    gap = Math.max(1, Math.floor(gap / 1.3));
    sorted = gap === 1;
    for (let i = 0; i + gap < arr.length; i++) {
      if (arr[i] > arr[i + gap]) { [arr[i], arr[i + gap]] = [arr[i + gap], arr[i]]; sorted = false; }
    }
  }
  return arr;
}

function gnomeSort(input: number[]): number[] {
  const arr = [...input];
  let pos = 0;
  while (pos < arr.length) {
    if (pos === 0 || arr[pos] >= arr[pos - 1]) pos++;
    else { [arr[pos], arr[pos - 1]] = [arr[pos - 1], arr[pos]]; pos--; }
  }
  return arr;
}

function pancakeSort(input: number[]): number[] {
  const arr = [...input];
  for (let size = arr.length; size > 1; size--) {
    let maxIdx = 0;
    for (let i = 1; i < size; i++) if (arr[i] > arr[maxIdx]) maxIdx = i;
    if (maxIdx !== size - 1) {
      arr.slice(0, maxIdx + 1).reverse().forEach((v, i) => { arr[i] = v; });
      arr.slice(0, size).reverse().forEach((v, i) => { arr[i] = v; });
    }
  }
  return arr;
}

function cycleSort(input: number[]): number[] {
  const arr = [...input];
  for (let cycleStart = 0; cycleStart < arr.length - 1; cycleStart++) {
    let item = arr[cycleStart];
    let pos = cycleStart;
    for (let i = cycleStart + 1; i < arr.length; i++) if (arr[i] < item) pos++;
    if (pos === cycleStart) continue;
    while (item === arr[pos]) pos++;
    [arr[pos], item] = [item, arr[pos]];
    while (pos !== cycleStart) {
      pos = cycleStart;
      for (let i = cycleStart + 1; i < arr.length; i++) if (arr[i] < item) pos++;
      while (item === arr[pos]) pos++;
      [arr[pos], item] = [item, arr[pos]];
    }
  }
  return arr;
}

function oddEvenSort(input: number[]): number[] {
  const arr = [...input];
  let sorted = false;
  while (!sorted) {
    sorted = true;
    for (let i = 1; i < arr.length - 1; i += 2) if (arr[i] > arr[i + 1]) { [arr[i], arr[i + 1]] = [arr[i + 1], arr[i]]; sorted = false; }
    for (let i = 0; i < arr.length - 1; i += 2) if (arr[i] > arr[i + 1]) { [arr[i], arr[i + 1]] = [arr[i + 1], arr[i]]; sorted = false; }
  }
  return arr;
}

function adaptiveSort(input: number[]): number[] {
  const arr = [...input];
  const n = arr.length;
  if (n <= 1) return arr;

  // Scan: find min/max, check integers, sample inversions
  let minVal = arr[0], maxVal = arr[0], allInt = true, inversions = 0;
  for (let i = 0; i < n; i++) {
    if (arr[i] < minVal) minVal = arr[i];
    if (arr[i] > maxVal) maxVal = arr[i];
    if (!Number.isInteger(arr[i])) allInt = false;
  }
  const sampleSize = Math.min(n, 40);
  const step2 = Math.max(1, Math.floor(n / sampleSize));
  for (let i = 0; i + step2 < n; i += step2) {
    if (arr[i] > arr[i + step2]) inversions++;
  }
  const invRate = inversions / (sampleSize - 1);
  const span = maxVal - minVal + 1;

  // Counting sort shortcut: integers with small value range
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

  // Tiny array or nearly-sorted: use insertion sort
  if (n <= 16 || invRate <= 0.05) { ins(0, n - 1); return arr; }

  // Introsort with heapsort fallback
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
    if (arr[lo] > arr[hi]) [arr[lo], arr[hi]] = [arr[hi], arr[lo]];
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
    const leftSize = i - lo, rightSize = hi - i;
    if (leftSize <= rightSize) { sort(lo, i - 1, depth - 1); sort(i + 1, hi, depth - 1); }
    else { sort(i + 1, hi, depth - 1); sort(lo, i - 1, depth - 1); }
  }
  sort(0, n - 1, maxDepth);
  return arr;
}

/*
 * pdqsort — Pattern-Defeating Quicksort by Orson Peters (2021).
 *
 * Hybrid of introsort + adversarial-resistance heuristics:
 *   • Median-of-3 / pseudomedian-of-9 (Tukey's ninther) pivot selection
 *   • Insertion sort under threshold (24 elements)
 *   • Heapsort fallback once log₂(n) bad partitions occur — O(n log n) guarantee
 *   • Detects already-partitioned subsequences and tries partial insertion sort
 *   • Special-cases equal-to-pivot → groups equals together to break the
 *     "many duplicates" worst case to O(n)
 *   • Shuffles elements on highly unbalanced partitions to defeat adversarial input
 *
 * Worst case: O(n log n)  Best case: O(n) (already sorted)
 * Space: O(log n) recursion stack
 * Stable: NO
 */
function pdqSort(input: number[]): number[] {
  const arr = [...input];
  const INSERTION_SORT_THRESHOLD = 24;
  const NINTHER_THRESHOLD = 128;
  const PARTIAL_INSERTION_SORT_LIMIT = 8;

  function lt(a: number, b: number) { return a < b; }

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

  // Assumes *(begin - 1) ≤ any element in [begin, end) — skips the begin guard.
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

  // Returns false (giving up) if more than PARTIAL_INSERTION_SORT_LIMIT element moves were made.
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
      if (limit > PARTIAL_INSERTION_SORT_LIMIT) return false;
    }
    return true;
  }

  function sort2(a: number, b: number) {
    if (lt(arr[b], arr[a])) { const t = arr[a]; arr[a] = arr[b]; arr[b] = t; }
  }
  function sort3(a: number, b: number, c: number) { sort2(a, b); sort2(b, c); sort2(a, b); }

  // Right partition: elements equal to the pivot go to the right half.
  // Returns [pivotPos, alreadyPartitioned].
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
    const pivotPos = first - 1;
    arr[begin] = arr[pivotPos];
    arr[pivotPos] = pivot;
    return [pivotPos, alreadyPartitioned];
  }

  // Left partition: elements equal to the pivot go to the left — used only when
  // the pivot equals the predecessor (lots-of-duplicates case).
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
    const pivotPos = last;
    arr[begin] = arr[pivotPos];
    arr[pivotPos] = pivot;
    return pivotPos;
  }

  // Heapsort guarantees O(n log n) when the bad-partition budget is exhausted.
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

      if (size < INSERTION_SORT_THRESHOLD) {
        if (leftmost) insertionSort(begin, end);
        else unguardedInsertionSort(begin, end);
        return;
      }

      const s2 = size >> 1;
      if (size > NINTHER_THRESHOLD) {
        // Pseudomedian of 9 (Tukey's ninther): three sort3s plus a final sort3
        // of the three medians, then swap into [begin].
        sort3(begin, begin + s2, end - 1);
        sort3(begin + 1, begin + (s2 - 1), end - 2);
        sort3(begin + 2, begin + (s2 + 1), end - 3);
        sort3(begin + (s2 - 1), begin + s2, begin + (s2 + 1));
        const t = arr[begin]; arr[begin] = arr[begin + s2]; arr[begin + s2] = t;
      } else {
        sort3(begin + s2, begin, end - 1);
      }

      // Equal-element fast path: if the pivot equals its predecessor, the left
      // sub-array is all equal and already sorted — partition equals to the left
      // and recurse only on the right.
      if (!leftmost && !lt(arr[begin - 1], arr[begin])) {
        begin = partitionLeft(begin, end) + 1;
        continue;
      }

      const [pivotPos, alreadyPartitioned] = partitionRight(begin, end);
      const lSize = pivotPos - begin;
      const rSize = end - (pivotPos + 1);
      const highlyUnbalanced = lSize < (size >> 3) || rSize < (size >> 3);

      if (highlyUnbalanced) {
        if (--badAllowed === 0) { heapSortRange(begin, end); return; }

        // Shuffle a few elements to break adversarial patterns.
        if (lSize >= INSERTION_SORT_THRESHOLD) {
          const q = lSize >> 2;
          const t1 = arr[begin]; arr[begin] = arr[begin + q]; arr[begin + q] = t1;
          const t2 = arr[pivotPos - 1]; arr[pivotPos - 1] = arr[pivotPos - q]; arr[pivotPos - q] = t2;
          if (lSize > NINTHER_THRESHOLD) {
            const t3 = arr[begin + 1]; arr[begin + 1] = arr[begin + q + 1]; arr[begin + q + 1] = t3;
            const t4 = arr[begin + 2]; arr[begin + 2] = arr[begin + q + 2]; arr[begin + q + 2] = t4;
            const t5 = arr[pivotPos - 2]; arr[pivotPos - 2] = arr[pivotPos - (q + 1)]; arr[pivotPos - (q + 1)] = t5;
            const t6 = arr[pivotPos - 3]; arr[pivotPos - 3] = arr[pivotPos - (q + 2)]; arr[pivotPos - (q + 2)] = t6;
          }
        }
        if (rSize >= INSERTION_SORT_THRESHOLD) {
          const q = rSize >> 2;
          const t1 = arr[pivotPos + 1]; arr[pivotPos + 1] = arr[pivotPos + 1 + q]; arr[pivotPos + 1 + q] = t1;
          const t2 = arr[end - 1]; arr[end - 1] = arr[end - q]; arr[end - q] = t2;
          if (rSize > NINTHER_THRESHOLD) {
            const t3 = arr[pivotPos + 2]; arr[pivotPos + 2] = arr[pivotPos + 2 + q]; arr[pivotPos + 2 + q] = t3;
            const t4 = arr[pivotPos + 3]; arr[pivotPos + 3] = arr[pivotPos + 3 + q]; arr[pivotPos + 3 + q] = t4;
            const t5 = arr[end - 2]; arr[end - 2] = arr[end - (1 + q)]; arr[end - (1 + q)] = t5;
            const t6 = arr[end - 3]; arr[end - 3] = arr[end - (2 + q)]; arr[end - (2 + q)] = t6;
          }
        }
      } else {
        // Decently balanced + already partitioned + cheap to finish via insertion
        // sort → bail out early. This is the O(n) best case for already-sorted input.
        if (alreadyPartitioned
            && partialInsertionSort(begin, pivotPos)
            && partialInsertionSort(pivotPos + 1, end)) return;
      }

      // Recurse on the left, tail-call on the right (bounded stack depth).
      loop(begin, pivotPos, badAllowed, leftmost);
      begin = pivotPos + 1;
      leftmost = false;
    }
  }

  if (arr.length > 1) loop(0, arr.length, Math.floor(Math.log2(arr.length)), true);
  return arr;
}

function introSort(input: number[]): number[] {
  const arr = [...input];
  const n = arr.length;
  const maxDepth = n <= 1 ? 0 : 2 * Math.floor(Math.log2(n));
  function ins(lo: number, hi: number) {
    for (let i = lo + 1; i <= hi; i++) {
      const k = arr[i]; let j = i - 1;
      while (j >= lo && arr[j] > k) { arr[j + 1] = arr[j]; j--; }
      arr[j + 1] = k;
    }
  }
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
    if (arr[lo] > arr[hi]) [arr[lo], arr[hi]] = [arr[hi], arr[lo]];
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
    sort(lo, i - 1, depth - 1);
    sort(i + 1, hi, depth - 1);
  }
  sort(0, n - 1, maxDepth);
  return arr;
}

function timSortJS(input: number[]): number[] {
  /*
   * TimSort — pure JavaScript implementation.
   *
   * Natural run detection + galloping merge.
   *
   * Scan the array for already-sorted (ascending or descending) "runs".
   * Insertion-sort any run shorter than MIN_RUN (32) up to that length.
   * Push runs onto a stack and merge when the stack invariant is violated:
   *   run[i−2].len ≥ run[i−1].len + run[i].len   AND   run[i−1].len ≥ run[i].len
   * Merge uses a temporary buffer of min(left, right) size — O(n/2) worst case.
   *
   * This matches the algorithm described by Tim Peters (2002) and implemented
   * in CPython and OpenJDK, minus the full gallop-mode acceleration (which adds
   * constant-factor improvement on highly structured data but complicates the code).
   *
   * Technical:
   * MIN_RUN ∈ [32,64] chosen so n/MIN_RUN is a power of two or just below,
   *   keeping the merge tree balanced (Peters 2002, §Analysis).
   * Stack invariant ensures O(log n) stack depth.
   * Worst-case: O(n log n). Best-case: O(n) on already-sorted input.
   * Space: O(n) — temporary merge buffer.
   * Stable: equal elements preserve original relative order.
   */
  const arr = [...input];
  const n = arr.length;
  if (n < 2) return arr;

  // Compute MIN_RUN: find r such that n/2^k is in [32,64)
  function minRunLength(len: number): number {
    let r = 0;
    while (len >= 64) { r |= len & 1; len >>= 1; }
    return len + r;
  }
  const MIN_RUN = minRunLength(n);

  // Binary insertion sort for a[lo..hi] assuming a[lo..start-1] already sorted
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

  // Detect a natural run starting at lo; reverse descending runs in-place.
  // Returns the index just past the end of the run.
  function countRunAndMakeAscending(lo: number, hi: number): number {
    let runHi = lo + 1;
    if (runHi === hi + 1) return runHi;
    if (arr[runHi++] < arr[lo]) {
      // Descending run — extend and reverse
      while (runHi <= hi && arr[runHi] < arr[runHi - 1]) runHi++;
      for (let l = lo, r = runHi - 1; l < r; l++, r--) { const t = arr[l]; arr[l] = arr[r]; arr[r] = t; }
    } else {
      while (runHi <= hi && arr[runHi] >= arr[runHi - 1]) runHi++;
    }
    return runHi;
  }

  // Merge a[lo..mid] with a[mid+1..hi] using a temporary buffer
  function merge(lo: number, mid: number, hi: number): void {
    const leftLen  = mid - lo + 1;
    const rightLen = hi - mid;
    if (leftLen <= rightLen) {
      // Copy left half into temp buffer
      const tmp = arr.slice(lo, mid + 1);
      let i = 0, j = mid + 1, k = lo;
      while (i < leftLen && j <= hi) arr[k++] = tmp[i] <= arr[j] ? tmp[i++] : arr[j++];
      while (i < leftLen) arr[k++] = tmp[i++];
    } else {
      // Copy right half into temp buffer
      const tmp = arr.slice(mid + 1, hi + 1);
      let i = mid, j = rightLen - 1, k = hi;
      while (i >= lo && j >= 0) arr[k--] = arr[i] > tmp[j] ? arr[i--] : tmp[j--];
      while (j >= 0) arr[k--] = tmp[j--];
    }
  }

  // Run stack: each entry is [base, length]
  const runBase: number[] = [];
  const runLen:  number[] = [];

  function pushRun(base: number, len: number): void { runBase.push(base); runLen.push(len); }

  function mergeCollapse(): void {
    while (runBase.length > 1) {
      const n2 = runBase.length - 1;
      if (n2 > 1 && runLen[n2 - 2] <= runLen[n2 - 1] + runLen[n2]) {
        if (runLen[n2 - 2] < runLen[n2]) {
          mergeAt(n2 - 2);
        } else {
          mergeAt(n2 - 1);
        }
      } else if (runLen[n2 - 1] <= runLen[n2]) {
        mergeAt(n2 - 1);
      } else {
        break;
      }
    }
  }

  function mergeForceCollapse(): void {
    while (runBase.length > 1) {
      const n2 = runBase.length - 1;
      mergeAt(n2 > 1 && runLen[n2 - 2] < runLen[n2] ? n2 - 2 : n2 - 1);
    }
  }

  function mergeAt(i: number): void {
    const base1 = runBase[i], len1 = runLen[i];
    const base2 = runBase[i + 1], len2 = runLen[i + 1];
    runLen[i] = len1 + len2;
    runBase.splice(i + 1, 1);
    runLen.splice(i + 1, 1);
    merge(base1, base2 - 1, base2 + len2 - 1);
  }

  // Main loop: scan for runs, extend short ones, push onto stack, merge
  let lo = 0;
  let remaining = n;
  while (remaining > 0) {
    let runLength = countRunAndMakeAscending(lo, lo + remaining - 1) - lo;
    if (runLength < MIN_RUN) {
      const force = Math.min(remaining, MIN_RUN);
      binaryInsert(lo, lo + force - 1, lo + runLength);
      runLength = force;
    }
    pushRun(lo, runLength);
    mergeCollapse();
    lo += runLength;
    remaining -= runLength;
  }
  mergeForceCollapse();
  return arr;
}

/* ── Bitonic Sort ───────────────────────────────────────────────────────────
 * The canonical GPU-friendly sort: a fixed network of (k, j) compare-swap
 * passes whose comparisons depend only on indices, never on data values. That
 * data-independence is what makes it parallelize cleanly on a GPU — every
 * index can run in lockstep with no divergence.
 *
 * On CPU it's O(n log² n) work, worse than O(n log n) comparison sorts. It's
 * included here mainly as the reference companion to the WebGPU bitonic
 * kernel in lib/webgpuSorts.ts; running both lets the user see the
 * V8-vs-GPU speedup directly with the same algorithm on both sides.
 *
 * Bitonic requires a power-of-two length. We pad up internally with
 * +Infinity sentinels (which sort to the high end under `>` comparison),
 * then slice off the tail before returning. The padding cost is real and
 * counted in the timing — same honesty rule as the GPU marshalling buffers. */
function bitonicSort(input: number[]): number[] {
  const n = input.length;
  if (n <= 1) return input.slice();
  // Round up to next power-of-2. For n=10k → 16384 (1.6× work), for n=1M →
  // 1048576 (1.05× work) — overhead shrinks as n grows toward a power-of-2.
  let p = 1;
  while (p < n) p *= 2;
  const arr: number[] = new Array(p);
  for (let i = 0; i < n; i++) arr[i] = input[i];
  for (let i = n; i < p; i++) arr[i] = Number.POSITIVE_INFINITY;
  // Iterative bitonic sort network. Outer k = subsequence-pair size,
  // inner j = compare distance. The direction bit (i & k) flips every k
  // indices so adjacent bitonic subsequences sort in opposite directions —
  // that's the trick that turns concatenated sorted runs into one sorted run.
  for (let k = 2; k <= p; k <<= 1) {
    for (let j = k >> 1; j > 0; j >>= 1) {
      for (let i = 0; i < p; i++) {
        const l = i ^ j;
        if (l > i) {
          const ascending = (i & k) === 0;
          const a = arr[i], b = arr[l];
          if (ascending ? a > b : a < b) { arr[i] = b; arr[l] = a; }
        }
      }
    }
  }
  // Drop the +Infinity padding tail.
  arr.length = n;
  return arr;
}

export const SORT_FNS: Record<string, (arr: number[]) => number[]> = {
  logos:     logosSort,
  adaptive:  adaptiveSort,
  pdqsort:   pdqSort,
  introsort: introSort,
  timsort:   (arr) => [...arr].sort((a, b) => a - b),
  "timsort-js": timSortJS,
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
  cocktail:  cocktailSort,
  comb:      combSort,
  gnome:     gnomeSort,
  pancake:   pancakeSort,
  cycle:     cycleSort,
  oddeven:   oddEvenSort,
  bitonic:   bitonicSort,
};

// ── Per-algorithm variant factories ───────────────────────────────────────────

export type QuickPivot = "first" | "last" | "median3" | "random";
export type ShellGaps  = "shell" | "hibbard" | "sedgewick" | "ciura";

/**
 * Returns a Lomuto-partition quicksort using the selected pivot strategy.
 * All variants are otherwise identical so that pivot choice is the sole variable.
 */
export function makeQuickSort(pivot: QuickPivot): (input: number[]) => number[] {
  return function(input: number[]): number[] {
    const arr = [...input];
    function part(lo: number, hi: number): void {
      if (lo >= hi) return;
      // Move chosen pivot to arr[hi], then run Lomuto partition
      switch (pivot) {
        case "first":
          [arr[lo], arr[hi]] = [arr[hi], arr[lo]];
          break;
        case "last":
          break; // arr[hi] is already the pivot
        case "median3": {
          const mid = (lo + hi) >> 1;
          if (arr[mid] < arr[lo])  [arr[lo],  arr[mid]] = [arr[mid],  arr[lo]];
          if (arr[hi]  < arr[lo])  [arr[lo],  arr[hi]]  = [arr[hi],   arr[lo]];
          if (arr[hi]  < arr[mid]) [arr[mid], arr[hi]]  = [arr[hi],  arr[mid]];
          break;
        }
        case "random": {
          const ri = lo + Math.floor(Math.random() * (hi - lo + 1));
          [arr[ri], arr[hi]] = [arr[hi], arr[ri]];
          break;
        }
      }
      const p = arr[hi];
      let i = lo - 1;
      for (let j = lo; j < hi; j++) {
        if (arr[j] <= p) { ++i; [arr[i], arr[j]] = [arr[j], arr[i]]; }
      }
      [arr[i + 1], arr[hi]] = [arr[hi], arr[i + 1]];
      part(lo, i);
      part(i + 2, hi);
    }
    part(0, arr.length - 1);
    return arr;
  };
}

/**
 * Returns a shell sort using the selected gap sequence.
 * Ciura (2001) is empirically the best; Shell (1959) is the simplest baseline.
 */
export function makeShellSort(gaps: ShellGaps): (input: number[]) => number[] {
  return function(input: number[]): number[] {
    const arr = [...input];
    const n = arr.length;
    let gapSeq: number[];

    switch (gaps) {
      case "shell": {
        gapSeq = [];
        for (let g = n >> 1; g > 0; g >>= 1) gapSeq.push(g);
        break;
      }
      case "hibbard": {
        // 1, 3, 7, 15, 31, … (2^k − 1)
        gapSeq = [];
        for (let k = 1; (1 << k) - 1 < n; k++) gapSeq.unshift((1 << k) - 1);
        break;
      }
      case "sedgewick": {
        // Sedgewick (1986): 1, 5, 19, 41, 109, 209, 505, 929, …
        const known = [1, 5, 19, 41, 109, 209, 505, 929, 2161, 3905, 8929, 16001, 36289, 64769, 146305, 260609, 587521, 1045505];
        gapSeq = known.filter(g => g < n).sort((a, b) => b - a);
        break;
      }
      case "ciura": {
        // Ciura (2001): 1, 4, 10, 23, 57, 132, 301, 701 — empirically optimal
        const base = [1, 4, 10, 23, 57, 132, 301, 701];
        const extended = [...base];
        let g = 701;
        while ((g = Math.round(g * 2.25)) < n) extended.push(g);
        gapSeq = extended.filter(g => g < n).sort((a, b) => b - a);
        break;
      }
    }

    for (const gap of gapSeq) {
      for (let i = gap; i < n; i++) {
        const key = arr[i]; let j = i;
        while (j >= gap && arr[j - gap] > key) { arr[j] = arr[j - gap]; j -= gap; }
        arr[j] = key;
      }
    }
    return arr;
  };
}

// ── Comparison/swap op counter ────────────────────────────────────────────────
// ── Allocation instrumentation ────────────────────────────────────────────────
// Monkey-patches Array prototype methods to count bytes allocated by fn().
// Each JS number is 8 bytes (float64). Captures: slice, concat, flat, flatMap,
// Array.from, and new Array(n) (via the constructor). Does NOT capture spread
// literals ([...x]) since those bypass the Array constructor in V8.
// Restores all originals in a finally block — safe to call from any context.

export function measureAllocBytes(fn: () => void): number {
  let bytes = 0;
  const B = 8;

  const origSlice   = Array.prototype.slice;
  const origConcat  = Array.prototype.concat;
  const origFlat    = (Array.prototype as { flat?: (...a: unknown[]) => unknown[] }).flat;
  const origFlatMap = (Array.prototype as { flatMap?: (...a: unknown[]) => unknown[] }).flatMap;
  const origMap     = Array.prototype.map;
  const origFilter  = Array.prototype.filter;
  const origReduce  = Array.prototype.reduce;
  const origReduceRight = Array.prototype.reduceRight;
  const origSplice  = Array.prototype.splice;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const origToReversed = (Array.prototype as any).toReversed as (() => unknown[]) | undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const origToSorted   = (Array.prototype as any).toSorted   as ((cmp?: (a: unknown, b: unknown) => number) => unknown[]) | undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const origToSpliced  = (Array.prototype as any).toSpliced  as ((...a: unknown[]) => unknown[]) | undefined;
  const origFrom    = Array.from;

  // Patch slice
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (Array.prototype as any).slice = function(...args: Parameters<typeof origSlice>) {
    const r: unknown[] = origSlice.apply(this, args);
    bytes += r.length * B;
    return r;
  };

  // Patch concat
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (Array.prototype as any).concat = function(...args: unknown[]) {
    const r: unknown[] = origConcat.apply(this, args);
    bytes += r.length * B;
    return r;
  };

  // Patch flat
  if (origFlat) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (Array.prototype as any).flat = function(...args: unknown[]) {
      const r: unknown[] = origFlat.apply(this, args);
      bytes += r.length * B;
      return r;
    };
  }

  // Patch flatMap
  if (origFlatMap) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (Array.prototype as any).flatMap = function(...args: unknown[]) {
      const r: unknown[] = origFlatMap.apply(this, args);
      bytes += r.length * B;
      return r;
    };
  }

  // Patch map / filter — both return a new Array. Critical: a sort that does
  // `arr.map(x => f(x))` or `arr.filter(...)` was previously invisible to the
  // counter and would falsely read in-place.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (Array.prototype as any).map = function(...args: Parameters<typeof origMap>) {
    const r: unknown[] = origMap.apply(this, args);
    bytes += r.length * B;
    return r;
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (Array.prototype as any).filter = function(...args: Parameters<typeof origFilter>) {
    const r: unknown[] = origFilter.apply(this, args);
    bytes += r.length * B;
    return r;
  };

  // Patch reduce / reduceRight — only count when the result is itself an
  // array (common pattern: `arr.reduce((acc, x) => [...acc, ...], [])`).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (Array.prototype as any).reduce = function(...args: Parameters<typeof origReduce>) {
    const r = origReduce.apply(this, args);
    if (Array.isArray(r)) bytes += r.length * B;
    return r;
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (Array.prototype as any).reduceRight = function(...args: Parameters<typeof origReduceRight>) {
    const r = origReduceRight.apply(this, args);
    if (Array.isArray(r)) bytes += r.length * B;
    return r;
  };

  // Patch splice — returns a new array of removed elements.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (Array.prototype as any).splice = function(...args: Parameters<typeof origSplice>) {
    const r: unknown[] = origSplice.apply(this, args);
    bytes += r.length * B;
    return r;
  };

  // Patch the ES2023 non-mutating variants — each returns a fresh array.
  if (origToReversed) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (Array.prototype as any).toReversed = function() {
      const r: unknown[] = origToReversed.call(this);
      bytes += r.length * B;
      return r;
    };
  }
  if (origToSorted) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (Array.prototype as any).toSorted = function(cmp?: (a: unknown, b: unknown) => number) {
      const r: unknown[] = origToSorted.call(this, cmp);
      bytes += r.length * B;
      return r;
    };
  }
  if (origToSpliced) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (Array.prototype as any).toSpliced = function(...args: unknown[]) {
      const r: unknown[] = origToSpliced.apply(this, args);
      bytes += r.length * B;
      return r;
    };
  }

  // Patch Array.from
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (Array as any).from = function(...args: Parameters<typeof Array.from>) {
    const r = origFrom.apply(Array, args as Parameters<typeof Array.from>);
    bytes += r.length * B;
    return r;
  };

  // Patch Array constructor to catch new Array(n)
  const OrigArray = globalThis.Array;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function PatchedArray(this: unknown, ...args: unknown[]): unknown[] {
    if (new.target) {
      // new Array(n) or new Array(a, b, ...)
      const r: unknown[] = new OrigArray(...(args as []));
      if (args.length === 1 && typeof args[0] === "number") bytes += (args[0] as number) * B;
      else bytes += r.length * B;
      return r;
    }
    // Array(n) called as function
    const r = OrigArray(...(args as []));
    if (args.length === 1 && typeof args[0] === "number") bytes += (args[0] as number) * B;
    else bytes += r.length * B;
    return r;
  }
  PatchedArray.prototype = OrigArray.prototype;
  PatchedArray.from      = (Array as any).from; // already patched above
  PatchedArray.isArray   = OrigArray.isArray;
  PatchedArray.of        = OrigArray.of;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).Array = PatchedArray;

  // Patch typed-array + ArrayBuffer constructors. Without this, a sort that
  // uses typed-array scratch (LSD radix, flash sort, histograms) is invisible
  // to the Array patches above and would falsely read ~0 aux — masquerading as
  // in-place. We count only the length form `new T(n)`; a view over an existing
  // buffer (`new T(buf)`) shares memory already counted, so we skip it (its
  // first argument is an object, not a number). Internal buffer allocation by
  // `new T(n)` doesn't call the JS ArrayBuffer constructor, so no double-count.
  const TYPED_NAMES = ["Int8Array","Uint8Array","Uint8ClampedArray","Int16Array","Uint16Array","Int32Array","Uint32Array","Float32Array","Float64Array"];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const origTyped: Record<string, any> = {};
  for (const name of TYPED_NAMES) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Orig = (globalThis as any)[name];
    if (typeof Orig !== "function") continue;
    origTyped[name] = Orig;
    function PatchedTyped(this: unknown, ...args: unknown[]) {
      const r = new Orig(...(args as []));
      if (typeof args[0] === "number") bytes += r.byteLength;
      return r;
    }
    PatchedTyped.prototype = Orig.prototype;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any)[name] = PatchedTyped;
  }
  const OrigArrayBuffer = globalThis.ArrayBuffer;
  function PatchedArrayBuffer(this: unknown, ...args: unknown[]) {
    const r = new OrigArrayBuffer(...(args as [number]));
    if (typeof args[0] === "number") bytes += args[0] as number;
    return r;
  }
  PatchedArrayBuffer.prototype = OrigArrayBuffer.prototype;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).ArrayBuffer = PatchedArrayBuffer;

  // Patch Set / Map constructors — sorts sometimes use these for dedup or
  // bucket maps. Count rough size from the iterable's length when present
  // (e.g., `new Set(arr)`); for empty constructors we count 0 and let later
  // adds escape, which is acceptable for the in-place verdict (small overheads
  // remain invisible, big O(n) seeding does not).
  const OrigSet = globalThis.Set;
  function PatchedSet(this: unknown, ...args: unknown[]) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = new (OrigSet as any)(...(args as []));
    const it = args[0] as { length?: number; size?: number } | undefined;
    if (it && typeof it.length === "number") bytes += it.length * B;
    else if (it && typeof it.size === "number") bytes += it.size * B;
    return r;
  }
  PatchedSet.prototype = OrigSet.prototype;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).Set = PatchedSet;

  const OrigMap = globalThis.Map;
  function PatchedMap(this: unknown, ...args: unknown[]) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = new (OrigMap as any)(...(args as []));
    const it = args[0] as { length?: number; size?: number } | undefined;
    if (it && typeof it.length === "number") bytes += it.length * B * 2; // key + value
    else if (it && typeof it.size === "number") bytes += it.size * B * 2;
    return r;
  }
  PatchedMap.prototype = OrigMap.prototype;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).Map = PatchedMap;

  try {
    fn();
  } finally {
    Array.prototype.slice   = origSlice;
    (Array.prototype as any).concat  = origConcat;
    if (origFlat)    (Array.prototype as any).flat    = origFlat;
    if (origFlatMap) (Array.prototype as any).flatMap = origFlatMap;
    (Array.prototype as any).map    = origMap;
    (Array.prototype as any).filter = origFilter;
    (Array.prototype as any).reduce = origReduce;
    (Array.prototype as any).reduceRight = origReduceRight;
    (Array.prototype as any).splice = origSplice;
    if (origToReversed) (Array.prototype as any).toReversed = origToReversed;
    if (origToSorted)   (Array.prototype as any).toSorted   = origToSorted;
    if (origToSpliced)  (Array.prototype as any).toSpliced  = origToSpliced;
    (Array as any).from = origFrom;
    (globalThis as any).Array = OrigArray;
    for (const name of TYPED_NAMES) {
      if (origTyped[name]) (globalThis as any)[name] = origTyped[name];
    }
    (globalThis as any).ArrayBuffer = OrigArrayBuffer;
    (globalThis as any).Set = OrigSet;
    (globalThis as any).Map = OrigMap;
  }

  return bytes;
}

// Runs an instrumented sort and returns op counts.  Do NOT use for timing —
// the counter increments add overhead.  Run on a fresh sample after benchmarking.

export interface SortCounter { comparisons: number; swaps: number; }

export function countSortOps(id: string, input: number[]): SortCounter {
  const arr = [...input];
  const n = arr.length;
  let comparisons = 0, swaps = 0;

  switch (id) {
    case "insertion": {
      for (let i = 1; i < n; i++) {
        const key = arr[i]; let j = i - 1;
        while (j >= 0) {
          comparisons++;
          if (arr[j] > key) { arr[j + 1] = arr[j]; j--; swaps++; }
          else break;
        }
        arr[j + 1] = key;
      }
      break;
    }
    case "bubble": {
      for (let pass = 0; pass < n - 1; pass++) {
        let swapped = false;
        for (let i = 0; i < n - 1 - pass; i++) {
          comparisons++;
          if (arr[i] > arr[i + 1]) { [arr[i], arr[i + 1]] = [arr[i + 1], arr[i]]; swaps++; swapped = true; }
        }
        if (!swapped) break;
      }
      break;
    }
    case "selection": {
      for (let i = 0; i < n - 1; i++) {
        let minIdx = i;
        for (let j = i + 1; j < n; j++) { comparisons++; if (arr[j] < arr[minIdx]) minIdx = j; }
        if (minIdx !== i) { [arr[i], arr[minIdx]] = [arr[minIdx], arr[i]]; swaps++; }
      }
      break;
    }
    case "merge": {
      function mergeCnt(lo: number, hi: number): void {
        if (lo >= hi) return;
        const mid = (lo + hi) >> 1;
        mergeCnt(lo, mid); mergeCnt(mid + 1, hi);
        const left = arr.slice(lo, mid + 1), right = arr.slice(mid + 1, hi + 1);
        let i = 0, j = 0, k = lo;
        while (i < left.length && j < right.length) {
          comparisons++;
          if (left[i] <= right[j]) arr[k++] = left[i++];
          else arr[k++] = right[j++];
          swaps++;
        }
        while (i < left.length) arr[k++] = left[i++];
        while (j < right.length) arr[k++] = right[j++];
      }
      mergeCnt(0, n - 1);
      break;
    }
    case "quick": {
      function quickCnt(lo: number, hi: number): void {
        if (lo >= hi) return;
        const mid = (lo + hi) >> 1;
        if (arr[mid] < arr[lo]) { [arr[lo], arr[mid]] = [arr[mid], arr[lo]]; }
        if (arr[hi]  < arr[lo]) { [arr[lo], arr[hi]]  = [arr[hi],  arr[lo]]; }
        if (arr[hi]  < arr[mid]) { [arr[mid], arr[hi]] = [arr[hi], arr[mid]]; }
        const p = arr[hi]; let i = lo - 1;
        for (let j = lo; j < hi; j++) {
          comparisons++;
          if (arr[j] <= p) { ++i; [arr[i], arr[j]] = [arr[j], arr[i]]; swaps++; }
        }
        [arr[i + 1], arr[hi]] = [arr[hi], arr[i + 1]]; swaps++;
        quickCnt(lo, i); quickCnt(i + 2, hi);
      }
      quickCnt(0, n - 1);
      break;
    }
    case "heap": {
      function siftCnt(size: number, root: number): void {
        while (true) {
          let largest = root;
          const l = 2 * root + 1, r = 2 * root + 2;
          if (l < size) { comparisons++; if (arr[l] > arr[largest]) largest = l; }
          if (r < size) { comparisons++; if (arr[r] > arr[largest]) largest = r; }
          if (largest === root) break;
          [arr[root], arr[largest]] = [arr[largest], arr[root]]; swaps++; root = largest;
        }
      }
      for (let i = Math.floor(n / 2) - 1; i >= 0; i--) siftCnt(n, i);
      for (let i = n - 1; i > 0; i--) { [arr[0], arr[i]] = [arr[i], arr[0]]; swaps++; siftCnt(i, 0); }
      break;
    }
    case "shell": {
      const base = [1, 4, 10, 23, 57, 132, 301, 701];
      const ext = [...base]; let g = 701;
      while ((g = Math.round(g * 2.25)) < n) ext.push(g);
      const gaps = ext.filter(x => x < n).sort((a, b) => b - a);
      for (const gap of (gaps.length ? gaps : [1])) {
        for (let i = gap; i < n; i++) {
          const key = arr[i]; let j = i;
          while (j >= gap) {
            comparisons++;
            if (arr[j - gap] > key) { arr[j] = arr[j - gap]; j -= gap; swaps++; }
            else break;
          }
          arr[j] = key;
        }
      }
      break;
    }
    // logos, timsort, counting, radix, bucket don't expose comparison counts cleanly
  }
  return { comparisons, swaps };
}

// ── Sort step generator (for step-through visualizer) ─────────────────────────
// Yields one step per comparison/swap so the UI can animate at any speed.
// Only call on small arrays (≤ 256) — step count is O(n²) for quadratic sorts.

export type SortStep = {
  arr: number[];
  comparing: number[];   // indices highlighted orange (being compared)
  swapping: number[];    // indices highlighted red (being swapped)
  pivot?: number;        // pivot index, highlighted blue
  sorted: number[];      // indices in final position, highlighted green
  comparisons: number;
  swaps: number;
  done?: boolean;
};

type _StepCtx = { arr: number[]; sorted: Set<number>; comparisons: number; swaps: number };

function _snap(c: _StepCtx, cmp: number[] = [], swp: number[] = [], pivot?: number): SortStep {
  return { arr: [...c.arr], comparing: cmp, swapping: swp, pivot, sorted: [...c.sorted], comparisons: c.comparisons, swaps: c.swaps };
}

function* _insertionGen(c: _StepCtx): Generator<SortStep> {
  const a = c.arr, n = a.length;
  for (let i = 1; i < n; i++) {
    let j = i;
    while (j > 0) {
      c.comparisons++;
      yield _snap(c, [j - 1, j]);
      if (a[j - 1] > a[j]) { [a[j - 1], a[j]] = [a[j], a[j - 1]]; c.swaps++; yield _snap(c, [], [j - 1, j]); j--; }
      else break;
    }
  }
  for (let i = 0; i < n; i++) c.sorted.add(i);
  yield { ..._snap(c), done: true };
}

function* _bubbleGen(c: _StepCtx): Generator<SortStep> {
  const a = c.arr, n = a.length;
  for (let pass = 0; pass < n - 1; pass++) {
    let swapped = false;
    for (let i = 0; i < n - 1 - pass; i++) {
      c.comparisons++;
      yield _snap(c, [i, i + 1]);
      if (a[i] > a[i + 1]) { [a[i], a[i + 1]] = [a[i + 1], a[i]]; c.swaps++; yield _snap(c, [], [i, i + 1]); swapped = true; }
    }
    c.sorted.add(n - 1 - pass);
    if (!swapped) break;
  }
  for (let i = 0; i < n; i++) c.sorted.add(i);
  yield { ..._snap(c), done: true };
}

function* _selectionGen(c: _StepCtx): Generator<SortStep> {
  const a = c.arr, n = a.length;
  for (let i = 0; i < n - 1; i++) {
    let minIdx = i;
    for (let j = i + 1; j < n; j++) {
      c.comparisons++;
      yield _snap(c, [minIdx, j]);
      if (a[j] < a[minIdx]) minIdx = j;
    }
    if (minIdx !== i) { [a[i], a[minIdx]] = [a[minIdx], a[i]]; c.swaps++; yield _snap(c, [], [i, minIdx]); }
    c.sorted.add(i);
  }
  c.sorted.add(n - 1);
  yield { ..._snap(c), done: true };
}

function* _shellGen(c: _StepCtx): Generator<SortStep> {
  const a = c.arr, n = a.length;
  const base = [1, 4, 10, 23, 57, 132, 301, 701];
  const ext = [...base]; let g = 701;
  while ((g = Math.round(g * 2.25)) < n) ext.push(g);
  const gaps = ext.filter(x => x < n).sort((a, b) => b - a);
  for (const gap of (gaps.length ? gaps : [1])) {
    for (let i = gap; i < n; i++) {
      let j = i;
      while (j >= gap) {
        c.comparisons++;
        yield _snap(c, [j - gap, j]);
        if (a[j - gap] > a[j]) { [a[j - gap], a[j]] = [a[j], a[j - gap]]; c.swaps++; yield _snap(c, [], [j - gap, j]); j -= gap; }
        else break;
      }
    }
  }
  for (let i = 0; i < n; i++) c.sorted.add(i);
  yield { ..._snap(c), done: true };
}

function* _mergeGen(c: _StepCtx, lo: number, hi: number): Generator<SortStep> {
  if (lo >= hi) { c.sorted.add(lo); return; }
  const mid = (lo + hi) >> 1;
  yield* _mergeGen(c, lo, mid);
  yield* _mergeGen(c, mid + 1, hi);
  const a = c.arr;
  const left = a.slice(lo, mid + 1), right = a.slice(mid + 1, hi + 1);
  let i = 0, j = 0, k = lo;
  while (i < left.length && j < right.length) {
    c.comparisons++;
    yield _snap(c, [lo + i, mid + 1 + j]);
    if (left[i] <= right[j]) a[k++] = left[i++];
    else a[k++] = right[j++];
    c.swaps++; yield _snap(c, [], [k - 1]);
  }
  while (i < left.length) a[k++] = left[i++];
  while (j < right.length) a[k++] = right[j++];
  for (let x = lo; x <= hi; x++) c.sorted.add(x);
}

function* _quickGen(c: _StepCtx, lo: number, hi: number): Generator<SortStep> {
  if (lo >= hi) { if (lo >= 0 && lo < c.arr.length) c.sorted.add(lo); return; }
  const a = c.arr;
  const mid = (lo + hi) >> 1;
  if (a[mid] < a[lo]) { [a[lo], a[mid]] = [a[mid], a[lo]]; }
  if (a[hi]  < a[lo]) { [a[lo], a[hi]]  = [a[hi],  a[lo]]; }
  if (a[hi]  < a[mid]) { [a[mid], a[hi]] = [a[hi], a[mid]]; }
  const pivotVal = a[hi];
  yield _snap(c, [], [], hi);
  let i = lo - 1;
  for (let j = lo; j < hi; j++) {
    c.comparisons++;
    yield _snap(c, [j, hi], [], hi);
    if (a[j] <= pivotVal) { ++i; if (i !== j) { [a[i], a[j]] = [a[j], a[i]]; c.swaps++; yield _snap(c, [], [i, j], hi); } }
  }
  [a[i + 1], a[hi]] = [a[hi], a[i + 1]]; c.swaps++;
  const pp = i + 1; c.sorted.add(pp);
  yield _snap(c, [], [pp, hi], pp);
  yield* _quickGen(c, lo, pp - 1);
  yield* _quickGen(c, pp + 1, hi);
}

function* _heapGen(c: _StepCtx): Generator<SortStep> {
  const a = c.arr, n = a.length;
  function* _sift(size: number, root: number): Generator<SortStep> {
    while (true) {
      let largest = root;
      const l = 2 * root + 1, r = 2 * root + 2;
      if (l < size) { c.comparisons++; yield _snap(c, [largest, l]); if (a[l] > a[largest]) largest = l; }
      if (r < size) { c.comparisons++; yield _snap(c, [largest, r]); if (a[r] > a[largest]) largest = r; }
      if (largest === root) break;
      [a[root], a[largest]] = [a[largest], a[root]]; c.swaps++; yield _snap(c, [], [root, largest]); root = largest;
    }
  }
  for (let i = Math.floor(n / 2) - 1; i >= 0; i--) yield* _sift(n, i);
  for (let i = n - 1; i > 0; i--) {
    [a[0], a[i]] = [a[i], a[0]]; c.swaps++; yield _snap(c, [], [0, i]); c.sorted.add(i); yield* _sift(i, 0);
  }
  c.sorted.add(0);
  yield { ..._snap(c), done: true };
}

export function* sortSteps(id: string, input: number[]): Generator<SortStep> {
  const arr = [...input];
  const ctx: _StepCtx = { arr, sorted: new Set(), comparisons: 0, swaps: 0 };
  switch (id) {
    case "insertion": yield* _insertionGen(ctx); break;
    case "bubble":    yield* _bubbleGen(ctx);    break;
    case "selection": yield* _selectionGen(ctx); break;
    case "shell":     yield* _shellGen(ctx);     break;
    case "merge":     yield* _mergeGen(ctx, 0, arr.length - 1); for (let i = 0; i < arr.length; i++) ctx.sorted.add(i); yield { ..._snap(ctx), done: true }; break;
    case "quick":     yield* _quickGen(ctx, 0, arr.length - 1); for (let i = 0; i < arr.length; i++) ctx.sorted.add(i); yield { ..._snap(ctx), done: true }; break;
    case "heap":      yield* _heapGen(ctx); break;
    default:
      yield _snap(ctx);
      arr.sort((a, b) => a - b);
      for (let i = 0; i < arr.length; i++) ctx.sorted.add(i);
      yield { ..._snap(ctx), done: true };
  }
}

// ── Adversarial input generator ───────────────────────────────────────────────
// Constructs the worst-case (or near-worst-case) input for a given algorithm.

export function makeAdversarialInput(algoId: string, n: number, pivot: QuickPivot = "last"): number[] {
  switch (algoId) {
    case "insertion":
    case "selection":
    case "bubble":
    case "shell":
      // Reversed array is worst case for all these
      return Array.from({ length: n }, (_, i) => n - i);

    case "quick":
      if (pivot === "first" || pivot === "last") {
        // Sorted array is O(n²) for naive single-pivot with first/last pivot
        return Array.from({ length: n }, (_, i) => i + 1);
      } else if (pivot === "median3") {
        // "Organ pipe" pattern defeats median-of-3: ascending then descending
        return Array.from({ length: n }, (_, i) => i < (n >> 1) ? 2 * i : 2 * (n - i) - 1);
      } else {
        // Random pivot: no effective adversarial input exists
        return Array.from({ length: n }, () => Math.floor(Math.random() * n));
      }

    case "counting":
    case "radix":
      // Large spread maximizes counting-sort's range; radix needs many digits
      return Array.from({ length: n }, (_, i) => i * 100);

    case "bucket":
      // All elements fall into one bucket → degrades to insertion sort
      return Array.from({ length: n }, () => 0.5 + Math.random() * 0.001);

    default:
      // logos, timsort, merge, heap: guaranteed O(n log n) — random is fine
      return Array.from({ length: n }, () => Math.floor(Math.random() * n));
  }
}
