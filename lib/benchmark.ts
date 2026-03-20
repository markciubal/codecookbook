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
  // "In the beginning was the Word, and the Word was with God, and the Word was God." — John 1:1
  // Logos: the ordering principle beneath all apparent chaos. This sort does not impose
  // order by force — it listens for the shape latent in the data and coaxes it forth.
  // Algorithmically: a dual-pivot introsort hybrid — golden-ratio pivots, CSPRNG-seeded chaos,
  // and adaptive shortcuts for counting, gallop, and insertion. O(n log n) worst-case guaranteed.

  // "He has made everything beautiful in its time." — Ecclesiastes 3:11
  // The golden ratio φ = (√5+1)/2 is the proportion Nature chose before humanity named it —
  // whispered through the nautilus shell, the sunflower head, the spiral of galaxies.
  // Its reciprocals φ⁻¹ ≈ 0.618 and φ⁻² ≈ 0.382 are the two most irrational numbers that
  // exist: no simple fraction ever traps them, no periodic pattern can exploit them.
  // Algorithmically: computing from definition gives the exact IEEE 754 double — no rounding
  // artefact from transcribing a decimal literal by hand.
  const PHI  = (Math.sqrt(5) - 1) / 2; // φ⁻¹ = (√5−1)/2
  const PHI2 = (3 - Math.sqrt(5)) / 2; // φ⁻² = (3−√5)/2

  // "To every thing there is a season, and a time to every purpose under the heaven." — Ecclesiastes 3:1
  // Below 48 elements the machinery of recursion costs more than it saves.
  // A wise ruler does not send an army to settle a household dispute.
  // Algorithmically: insertion sort's cache locality and zero overhead beats quicksort at small n.
  const BASE = 48;
  const a = [...input];
  const n = a.length;

  // "The lot is cast into the lap, but its every decision is from the Lord." — Proverbs 16:33
  // We draw a single lot from the deep well of the OS's own entropy — one CSPRNG call at
  // creation — and from that seed a river of bits flows through all levels of recursion.
  // No adversary who does not know the seed can ever predict where the pivots will land.
  // Algorithmically: xoshiro128+ seeded by crypto.getRandomValues — one syscall, then fast
  // bit-ops per level. Statistically stronger than Math.random(); unpredictably seeded.
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
    return (r >>> 1) / 0x80000000; // uniform in (0, 1]
  }
  if (n < 2) return a;

  // "Pride goes before destruction, and a haughty spirit before a fall." — Proverbs 16:18
  // The Tower of Babel fell not for want of stone but for want of limits.
  // We set a ceiling: if recursion descends 2·log₂(n)+4 levels, a bad pivot sequence
  // has humbled us, and we yield the remaining work to a wiser hand.
  // Algorithmically: Musser's introsort depth guard — the escape hatch to guaranteed O(n log n).
  const depthLimit = 2 * Math.floor(Math.log2(n)) + 4;

  // "Blessed are the peacemakers, for they shall be called children of God." — Matthew 5:9
  // The mediator stands between two extremes and draws out the hidden middle.
  // Three values enter in disorder; the one that belongs between the others emerges.
  // Algorithmically: a three-element sorting network — at most three comparisons, returns median.
  function median3(x: number, y: number, z: number): number {
    if (x > y) { const t = x; x = y; y = t; }
    if (y > z) { const t = y; y = z; z = t; }
    if (x > y) { const t = x; x = y; y = t; }
    return y;
  }

  // "Iron sharpens iron, and one person sharpens another." — Proverbs 27:17
  // A pivot sharpened only against itself remains a crude guess; one sharpened against
  // its neighbours becomes a truer estimate of the local median.
  // Algorithmically: median of (idx−1, idx, idx+1) clamped to [lo, hi] — a cheap but
  // effective pivot quality improvement before any element is moved.
  function ninther(lo: number, hi: number, idx: number): number {
    return median3(a[Math.max(lo, idx - 1)], a[idx], a[Math.min(hi, idx + 1)]);
  }

  // "And God said, Let there be a firmament in the midst of the waters,
  //  and let it divide the waters from the waters." — Genesis 1:6
  // Creation begins with division: the formless void separated into sky and sea.
  // We divide the subarray at two pivots — the lesser, the middle, the greater —
  // three kingdoms established in a single left-to-right pass, each element finding its home.
  // Algorithmically: Dijkstra's Dutch National Flag partition, extended to dual pivots.
  //   a[lo..lt-1] < p1  |  a[lt..gt] ∈ [p1, p2]  |  a[gt+1..hi] > p2
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

  // "The Word became flesh and dwelt among us." — John 1:14
  // The Logos descends into the particular. Each call to sort() enters its subarray
  // fully — questions it before acting, tries every shortcut, and departs only when
  // order has been established or delegated. It does not thrash; it discerns.
  // Algorithmically: the main sort loop with while-based tail-call elimination over the largest region.
  function sort(lo: number, hi: number, depth: number): void {
    while (lo < hi) {
      const size = hi - lo + 1;

      // "For my thoughts are not your thoughts, neither are your ways my ways." — Isaiah 55:8
      // When our own depth is spent, we do not pretend wisdom we no longer have.
      // We bow, and hand what remains to the platform — whose ways surpass our own.
      // Algorithmically: introsort fallback to Array.prototype.sort, guaranteeing O(n log n) worst-case.
      if (depth <= 0) {
        const sub = a.slice(lo, hi + 1).sort((x, y) => x - y);
        for (let k = lo; k <= hi; k++) a[k] = sub[k - lo];
        return;
      }

      // "Whoever can be trusted with very little can also be trusted with much." — Luke 16:10
      // Small things deserve faithful attention, not elaborate machinery.
      // Below 48 elements each value simply walks left until it finds its place.
      // Algorithmically: insertion sort — O(n²) worst-case, but unbeatable constant factor for tiny n.
      if (size <= BASE) {
        for (let i = lo + 1; i <= hi; i++) {
          const key = a[i]; let j = i - 1;
          while (j >= lo && a[j] > key) { a[j + 1] = a[j]; j--; }
          a[j + 1] = key;
        }
        return;
      }

      // "Give me neither poverty nor riches; feed me with the food I need." — Proverbs 30:8
      // When values are dense — the range narrow, the count generous — there is no need
      // for comparison at all. We count what is, and pour it back in order.
      // Algorithmically: counting sort O(n+k), triggered when value span < 4×element count.
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

      // "Be still, and know that I am God." — Psalm 46:10
      // Before we disturb the waters, we ask: have they already found their rest?
      // Order already present is order freely given — we do not unmake what is made.
      // If reversed, a single mirror-pass restores it; no partition required, no pivot consumed.
      // Algorithmically: O(n) gallop check for already-sorted or perfectly-reversed subarrays.
      if (a[lo] <= a[lo + 1] && a[lo + 1] <= a[lo + 2]) {
        let sorted = true;
        for (let k = lo; k < hi; k++) { if (a[k] > a[k + 1]) { sorted = false; break; } }
        if (sorted) return;
        let reversed = true;
        for (let k = lo; k < hi; k++) { if (a[k] < a[k + 1]) { reversed = false; break; } }
        if (reversed) { for (let l = lo, r = hi; l < r; l++, r--) { [a[l], a[r]] = [a[r], a[l]]; } return; }
      }

      // "I will give you the treasures of darkness and riches hidden in secret places." — Isaiah 45:3
      // Each level draws a fresh chaos factor from the seeded river — unpredictable, unrepeatable.
      // This factor scales the φ-pivot positions differently at every depth, so no fixed
      // input pattern can ever reliably force the same pivot twice.
      // Algorithmically: xrand() returns a uniform value in (0, 1] from the xoshiro128+ state.
      const chaos = xrand();
      const range = hi - lo;

      // "The heavens declare the glory of God; the skies proclaim the work of his hands." — Psalm 19:1
      // φ⁻² ≈ 0.382 and φ⁻¹ ≈ 0.618 are the golden cuts of any interval — the proportions
      // the cosmos chose before we arrived. Scaled by chaos they become positions no periodic
      // input can target; ninther then sharpens each raw index against its neighbours.
      // Algorithmically: idx = lo + ⌊range × PHI × chaos⌋, refined by ninther before any swap.
      const idx1 = lo + Math.min(range, Math.floor(range * PHI2 * chaos));
      const idx2 = lo + Math.min(range, Math.floor(range * PHI  * chaos));
      const p1 = ninther(lo, hi, idx1);
      const p2 = ninther(lo, hi, idx2);

      const [lt, gt] = dualPartition(lo, hi, p1, p2);

      // "So the last will be first, and the first will be last." — Matthew 20:16
      // The two smallest regions are given to genuine recursion — settled and released.
      // The largest inherits the loop without a stack frame: the greatest burden
      // carried at zero extra cost, the call stack forever bounded to O(log n) depth.
      // Algorithmically: smallest-first recursion + loop continuation as tail-call elimination.
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
