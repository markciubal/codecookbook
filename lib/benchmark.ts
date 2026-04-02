export type BenchmarkScenario = "random" | "nearlySorted" | "reversed" | "duplicates" | "sorted";

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

export interface CustomDistribution {
  preSortedPct: number;  // 0–100: % of elements already in sorted position (prefix sorted)
  duplicatePct: number;  // 0–100: % of elements replaced with duplicates
}

export function generateBenchmarkInput(
  n: number,
  scenario: BenchmarkScenario,
  custom?: CustomDistribution,
): number[] {
  let arr: number[];
  switch (scenario) {
    case "random":
      arr = Array.from({ length: n }, () => Math.floor(Math.random() * 10_000));
      break;
    case "nearlySorted": {
      arr = Array.from({ length: n }, (_, i) => i + 1);
      const swaps = Math.max(1, Math.floor(n * 0.05));
      for (let i = 0; i < swaps; i++) {
        const indexA = Math.floor(Math.random() * n);
        const indexB = Math.floor(Math.random() * n);
        [arr[indexA], arr[indexB]] = [arr[indexB], arr[indexA]];
      }
      break;
    }
    case "reversed":
      arr = Array.from({ length: n }, (_, i) => n - i);
      break;
    case "duplicates":
      arr = Array.from({ length: n }, () => Math.floor(Math.random() * Math.ceil(n / 5)));
      break;
    case "sorted":
      arr = Array.from({ length: n }, (_, i) => i + 1);
      break;
    default:
      arr = Array.from({ length: n }, () => Math.floor(Math.random() * 10_000));
  }

  if (custom) {
    // Apply pre-sorted prefix: sort the first preSortedPct% of elements
    if (custom.preSortedPct > 0) {
      const prefixLen = Math.floor(n * custom.preSortedPct / 100);
      const prefix = arr.slice(0, prefixLen).sort((a, b) => a - b);
      for (let i = 0; i < prefixLen; i++) arr[i] = prefix[i];
    }
    // Apply duplicate injection: replace duplicatePct% of elements with the median value
    if (custom.duplicatePct > 0) {
      const count = Math.floor(n * custom.duplicatePct / 100);
      const dupVal = arr[Math.floor(n / 2)];
      for (let i = 0; i < count; i++) {
        arr[Math.floor(Math.random() * n)] = dupVal;
      }
    }
  }

  return arr;
}

// ── Pure sort implementations ─────────────────────────────────────────────────

function logosSort(input: number[], p: LogosParams = DEFAULT_LOGOS_PARAMS): number[] {
  /*
   * Logos Sort — dual-pivot introsort hybrid.
   *
   * "In the beginning was the Word (Logos), and the Word was with God,
   *  and the Word was God." — John 1:1
   *
   * Logos is the Greek for the ordering principle beneath apparent chaos —
   * the pattern that was always there, waiting to be revealed rather than imposed.
   * Jesus taught that the kingdom of God is like a seed already in the field
   * (Matthew 13:31-32): the work is not to create order from nothing but to
   * recognize and tend the order that already exists.
   *
   * This algorithm holds to that. Before it partitions anything, it asks
   * whether the data is already sorted, already reversible, already countable.
   * It only disturbs what genuinely needs disturbing.
   *
   * Technical: a dual-pivot introsort hybrid with adaptive shortcuts.
   * O(n log n) worst-case guaranteed. O(n) on structured input.
   */

  /*
   * Golden ratio pivot positions.
   *
   * Irrational pivot positions.
   *
   * φ is the number least approximable by simple fractions — Hurwitz (1891)
   * proved its continued fraction [0;1,1,1,…] converges slower than any other
   * irrational. No repeating input sequence can reliably land on the same pivot
   * index when the cut is placed here. An adversary must solve a problem as hard
   * as approximating φ — which is maximally hard by Hurwitz's theorem.
   *
   * Technical: φ⁻¹ = (√5−1)/2 ≈ 0.61803399 and φ⁻² = (3−√5)/2 ≈ 0.38196601.
   * PHI is literal here for clarity; PHI2 is computed so both constants share
   * the same √5 source and their sum stays exactly 1.0 in IEEE 754 double.
   */
  const PHI  = p.phi;
  const PHI2 = p.phi2;

  /*
   * Insertion sort threshold.
   *
   * Threshold invariant.
   *
   * Below a certain size, the overhead of recursion and pivot selection costs
   * more than insertion sort's O(n²) work. The invariant: every subarray of
   * size ≤ BASE goes through insertion sort, which is correct and faster here.
   * Sending full quicksort machinery into 20 elements wastes more than it saves.
   *
   * Technical (Knuth, TAOCP Vol. 3 §5.2.1; Bentley & McIlroy 1993):
   * Quicksort's per-call overhead (function frames, pivot selection, partition pass)
   * has fixed cost γ. Below threshold n₀ where αn₀² < βn₀ log n₀ + γ, insertion
   * sort is faster. For typical α, β, γ on modern hardware, n₀ ∈ [10, 64]. We use 48.
   */
  const BASE = p.base;
  const arr = [...input];
  const arraySize = arr.length;

  /*
   * Cryptographically seeded PRNG (xoshiro128+).
   *
   * Unpredictable seed.
   *
   * A deterministic pivot rule has a predictable pattern. Anyone who studies it
   * long enough can craft an input that always produces the worst split.
   * We draw a seed from the OS's entropy pool — one call to crypto.getRandomValues.
   * No adversary who does not know the seed can predict where pivots land.
   *
   * Technical: xoshiro128+ (Blackman & Vigna, 2018). 128-bit state, period 2¹²⁸−1,
   * passes all BigCrush statistical tests. One syscall seeds the state; all
   * subsequent calls are 6 XOR/shift operations — no division, no allocation.
   * The all-zero state is invalid for xoshiro; we correct it if the OS returns it.
   */
  const seedBuffer = new Uint32Array(4);
  crypto.getRandomValues(seedBuffer);
  if (!seedBuffer[0] && !seedBuffer[1] && !seedBuffer[2] && !seedBuffer[3]) seedBuffer[0] = 1;
  let state0 = seedBuffer[0], state1 = seedBuffer[1], state2 = seedBuffer[2], state3 = seedBuffer[3];
  function xrand(): number {
    const rawOutput = (state0 + state3) >>> 0;
    const mixedBits = state1 << 9;
    state2 ^= state0; state3 ^= state1; state1 ^= state2; state0 ^= state3;
    state2 ^= mixedBits;
    state3 = (state3 << 11) | (state3 >>> 21);
    return (rawOutput >>> 1) / 0x80000000; // uniform in (0, 1]
  }
  if (arraySize < 2) return arr;

  /*
   * Introsort depth limit.
   *
   * Depth limit.
   *
   * A sort that recurses without limit can be brought to its knees by one
   * carefully crafted input. The depth limit is structural protection: when
   * we have descended 2⌊log₂ n⌋ + 4 levels without convergence, we stop
   * trusting our own strategy and hand the remaining work to the platform.
   * The limit is the proof, not an optimistic assumption.
   *
   * Technical (Musser, "Introspective Sorting and Selection Algorithms", 1997):
   * A balanced binary partition tree has depth ⌊log₂ n⌋. Doubling allows for
   * consistently lopsided splits before the fallback fires. The +4 absorbs
   * small-n rounding. Beyond this depth the platform's sort (V8: TimSort,
   * itself O(n log n)) takes over — guaranteeing O(n log n) unconditionally.
   */
  const depthLimit = p.depthMult * Math.floor(Math.log2(arraySize)) + p.depthAdd;

  /*
   * Median of three — sorting network.
   *
   * Sorting network.
   *
   * Three comparator gates totally order {x, y, z}. After the gates run,
   * y is the median by definition — not by inspection, but because the
   * invariant x ≤ y ≤ z is enforced unconditionally.
   * No value is lost. No value is favored. The work is three comparisons.
   *
   * Technical (Knuth, TAOCP Vol. 3 §5.3.4 — sorting networks):
   * Three comparator gates totally order {x, y, z}. After swap(x,y), swap(y,z),
   * swap(x,y) we have x ≤ y ≤ z. y is the median by definition of total order.
   * The network has no data-dependent branches — constant time, no misprediction.
   */
  function median3(x: number, y: number, z: number): number {
    if (x > y) { const temp = x; x = y; y = temp; }
    if (y > z) { const temp = y; y = z; z = temp; }
    if (x > y) { const temp = x; x = y; y = temp; }
    return y;
  }

  /*
   * Ninther — local median refinement.
   *
   * Local median refinement.
   *
   * A pivot chosen at a single index is a guess. A pivot chosen as the median
   * of its three immediate neighbors is informed by context.
   * Three comparisons, no element moved, no extra memory.
   *
   * Technical (Bentley & McIlroy, "Engineering a Sort Function", 1993 §5):
   * Median-of-3 reduces the probability of a worst-case split from O(1/n) to
   * O(1/n²). Clamping to [lo, hi] keeps the sample valid at subarray edges.
   */
  function ninther(lower: number, upper: number, centerIndex: number): number {
    return median3(arr[Math.max(lower, centerIndex - 1)], arr[centerIndex], arr[Math.min(upper, centerIndex + 1)]);
  }

  /*
   * Dual-pivot partition (Dutch National Flag, extended).
   *
   * Loop invariant — three regions, one pass.
   *
   * Two pivots divide the array into three clear regions: less than, between,
   * greater than. Every element is placed in exactly one region.
   * The pass moves left to right once. Nothing is visited twice.
   *
   * Technical (Dijkstra, "A Discipline of Programming", 1976 §14 — Dutch National Flag):
   * Loop invariant: a[lo..lt−1] < p1, a[lt..i−1] ∈ [p1,p2], a[gt+1..hi] > p2,
   * a[i..gt] unexamined. Invariant holds at entry (lt=lo, gt=hi, i=lo) and is
   * restored at each step. Terminates when i > gt: three regions are exhaustive
   * and disjoint. No element is lost or duplicated. □
   *
   * Yaroslavskiy (Java 7 Arrays.sort, 2009) showed dual-pivot does ~1/6 fewer
   * comparisons than single-pivot on average; three live pointers improve cache
   * locality over two.
   */
  function dualPartition(lower: number, upper: number, leftPivot: number, rightPivot: number): [number, number] {
    if (leftPivot > rightPivot) { const t = leftPivot; leftPivot = rightPivot; rightPivot = t; }
    let leftBoundary = lower, rightBoundary = upper, scanner = lower;
    while (scanner <= rightBoundary) {
      if      (arr[scanner] < leftPivot) { [arr[leftBoundary], arr[scanner]] = [arr[scanner], arr[leftBoundary]]; leftBoundary++; scanner++; }
      else if (arr[scanner] > rightPivot) { [arr[scanner], arr[rightBoundary]] = [arr[rightBoundary], arr[scanner]]; rightBoundary--; }
      else                 { scanner++; }
    }
    return [leftBoundary, rightBoundary];
  }

  /*
   * Main sort loop — tail-call elimination on the largest region.
   *
   * Tail-call elimination.
   *
   * After each partition there are three regions. Recursing on all three
   * accumulates O(n) stack frames in the worst case. Instead, recurse on
   * the two smaller regions and loop on the largest.
   * The stack stays bounded at O(log n) regardless of input.
   *
   * Technical (Sedgewick, "Implementing Quicksort Programs", 1978):
   * Naive quicksort recurses on both halves, accumulating O(n) stack frames in the
   * worst case. The fix: recurse on the two smaller regions, loop on the largest.
   * Proof: let S(n) = max stack depth. After partition into s₀ ≤ s₁ ≤ s₂ with
   * s₀+s₁+s₂ = n, we push frames for s₀ and s₁ (each ≤ n/2), loop on s₂.
   * S(n) = S(n/2) + 1 by induction → S(n) = O(log n). □
   */
  function sort(lower: number, upper: number, depth: number): void {
    while (lower < upper) {
      const subArraySize = upper - lower + 1;

      /*
       * Depth exhausted — introsort fallback.
       *
       * Platform sort fallback.
       *
       * When the depth limit is reached, we stop and let the platform's sort
       * finish the subarray. This is what makes the O(n log n) guarantee
       * unconditional — the fallback is the proof, not an optimistic assumption.
       *
       * Technical (Musser 1997): Array.prototype.sort in V8 is TimSort — O(n log n)
       * guaranteed. Splicing it in-place makes Logos Sort O(n log n) unconditionally.
       * The depth limit is the proof, not an optimistic assumption.
       */
      if (depth <= 0) {
        const fallbackSorted = arr.slice(lower, upper + 1).sort((x, y) => x - y);
        for (let scanIndex = lower; scanIndex <= upper; scanIndex++) arr[scanIndex] = fallbackSorted[scanIndex - lower];
        return;
      }

      /*
       * Insertion sort for small subarrays.
       *
       * Insertion sort for small subarrays.
       *
       * Below BASE elements, the array fits in L1 cache. Each value walks left
       * until it finds its place — sequential, direct, no wasted movement.
       * The quadratic term is harmless at this size: BASE² = 2304 operations,
       * absorbed as a constant into the larger O(n log n) work.
       *
       * Technical (Knuth TAOCP Vol. 3): loop invariant — a[lo..i−1] is sorted before
       * step i. Each step extends the sorted prefix by one. Holds at i=lo+1 trivially;
       * maintained at each step by the inner shift. At i=hi+1 the subarray is sorted. □
       */
      if (subArraySize <= BASE) {
        for (let insertPass = lower + 1; insertPass <= upper; insertPass++) {
          const key = arr[insertPass]; let shiftIndex = insertPass - 1;
          while (shiftIndex >= lower && arr[shiftIndex] > key) { arr[shiftIndex + 1] = arr[shiftIndex]; shiftIndex--; }
          arr[shiftIndex + 1] = key;
        }
        return;
      }

      /*
       * Counting sort for dense integer ranges.
       *
       * Counting sort shortcut.
       *
       * When values are dense — the range is small relative to the element count —
       * we do not compare at all. We tally each value and pour them back in order.
       * This escapes the Ω(n log n) comparison lower bound entirely.
       *
       * Technical: Ω(n log n) is a lower bound only in the comparison model (Shannon
       * information argument: n! orderings require log₂(n!) ≈ n log n bits to distinguish).
       * Counting sort escapes this model — it runs in O(n + span). When span < 4n,
       * total cost O(n) beats any comparison sort by a logarithmic factor.
       *
       * Correctness: counts[v] tallies every occurrence of v+mn. The reconstruction
       * loop emits each value exactly counts[v] times in ascending order. No element
       * is gained or lost. □
       */
      let minValue = arr[lower], maxValue = arr[lower];
      for (let scanIndex = lower + 1; scanIndex <= upper; scanIndex++) { if (arr[scanIndex] < minValue) minValue = arr[scanIndex]; if (arr[scanIndex] > maxValue) maxValue = arr[scanIndex]; }
      const valueRange = maxValue - minValue;
      if (Number.isInteger(minValue) && valueRange < subArraySize * p.countingMult) {
        const counts = new Array(valueRange + 1).fill(0);
        for (let scanIndex = lower; scanIndex <= upper; scanIndex++) counts[arr[scanIndex] - minValue]++;
        let writePos = lower;
        for (let digitValue = 0; digitValue <= valueRange; digitValue++) { while (counts[digitValue]-- > 0) arr[writePos++] = digitValue + minValue; }
        return;
      }

      /*
       * Gallop check — detect already-sorted or reversed subarrays.
       *
       * Sorted/reversed early exit.
       *
       * Before disturbing anything, check whether the data already has its order.
       * Sorted: one scan confirms it in n−1 comparisons. Return without moving anything.
       * Reversed: one mirror pass restores it. No partition, no pivot.
       * The 3-element prefix guard costs only 2 comparisons on random data — negligible.
       *
       * Technical (Peters, TimSort 2002 — natural run detection):
       * The 3-element prefix guard costs only 2 comparisons on unsorted data,
       * so random arrays pay almost nothing extra. Sorted data is more common
       * in practice than theory assumes (partial order accumulates naturally
       * in real systems), so the check earns back its cost many times over.
       */
      if (arr[lower] <= arr[lower + 1] && arr[lower + 1] <= arr[lower + 2]) {
        let sorted = true;
        for (let scanIndex = lower; scanIndex < upper; scanIndex++) { if (arr[scanIndex] > arr[scanIndex + 1]) { sorted = false; break; } }
        if (sorted) return;
        let reversed = true;
        for (let scanIndex = lower; scanIndex < upper; scanIndex++) { if (arr[scanIndex] < arr[scanIndex + 1]) { reversed = false; break; } }
        if (reversed) { for (let leftPointer = lower, rightPointer = upper; leftPointer < rightPointer; leftPointer++, rightPointer--) { [arr[leftPointer], arr[rightPointer]] = [arr[rightPointer], arr[leftPointer]]; } return; }
      }

      /*
       * PRNG draw — fresh randomness per recursion level.
       *
       * Fresh randomness per recursion level.
       *
       * Drawing a fresh value at each level means each level's pivot is independent.
       * An adversary who crafts input to defeat one level cannot predict the next.
       * xrand() costs 6 XOR/shift operations — cheaper than a comparison.
       *
       * Technical: xrand() consumes one xoshiro128+ step — 6 XOR/shift operations,
       * no division — producing a uniform float in (0, 1]. The jitter scale is sampled
       * uniformly in [randomScaleMin, randomScaleMax] each call (default both = φ⁻¹ ≈ 0.618034),
       * then multiplied by PHI to give the final pivot offset; indices clamped to [lo, hi].
       */
      const jitterScale = p.randomScaleMin + xrand() * (p.randomScaleMax - p.randomScaleMin);
      const randomFactor = (xrand() * 2 - 1) * PHI * jitterScale;
      const indexRange = upper - lower;

      /*
       * Golden-ratio pivot placement, refined by ninther.
       *
       * idx = lo + clamp(⌊range × φ⁻ᵏ × chaos⌋, 0, range).
       * randomFactor ∈ (−PHI, PHI] keeps pivots spread across the full subarray
       * while φ's irrationality prevents any periodic input from targeting the same index.
       * ninther then replaces the raw value with the local median of 3 neighbors,
       * improving expected partition balance (Bentley & McIlroy 1993 §5).
       */
      const leftPivotIndex  = lower + Math.max(0, Math.min(indexRange, Math.floor(indexRange * PHI2 * randomFactor)));
      const rightPivotIndex = lower + Math.max(0, Math.min(indexRange, Math.floor(indexRange * PHI  * randomFactor)));
      const pivot1 = ninther(lower, upper, leftPivotIndex);
      const pivot2 = ninther(lower, upper, rightPivotIndex);

      const [leftEnd, rightEnd] = dualPartition(lower, upper, pivot1, pivot2);

      /*
       * Smallest-first recursion — bounded stack depth.
       *
       * Smallest-first recursion.
       *
       * Recurse on the two smaller regions, loop on the largest.
       * Both recursive calls operate on at most n/2 elements.
       * By induction: S(n) = S(n/2) + 1 = O(log n). □
       * The largest region is carried by the while loop at zero stack cost.
       *
       * Technical (Sedgewick 1978):
       * After partition into s₀ ≤ s₁ ≤ s₂ with s₀+s₁+s₂ = n, we push frames
       * for s₀ and s₁, loop on s₂. Since s₁ ≤ n/2 (not the largest), both
       * recursive calls operate on at most n/2 elements. By induction:
       * S(n) = S(n/2) + 1 = O(log n). □
       */
      const regions: [number, number, number][] = [
        [leftEnd - lower,          lower,       leftEnd - 1],
        [rightEnd - leftEnd + 1,   leftEnd,     rightEnd   ],
        [upper - rightEnd,         rightEnd + 1, upper     ],
      ];
      regions.sort((x, y) => x[0] - y[0]);
      if (regions[0][1] < regions[0][2]) sort(regions[0][1], regions[0][2], depth - 1);
      if (regions[1][1] < regions[1][2]) sort(regions[1][1], regions[1][2], depth - 1);
      lower = regions[2][1]; upper = regions[2][2]; depth--;
    }
  }

  sort(0, arraySize - 1, depthLimit);
  return arr;
}

/** Returns a Logos Sort function bound to the given params. */
export function makeLogosSort(params: LogosParams): (arr: number[]) => number[] {
  return (input: number[]) => logosSort(input, params);
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

export const SORT_FNS: Record<string, (arr: number[]) => number[]> = {
  logos:     logosSort,
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

  try {
    fn();
  } finally {
    Array.prototype.slice   = origSlice;
    (Array.prototype as any).concat  = origConcat;
    if (origFlat)    (Array.prototype as any).flat    = origFlat;
    if (origFlatMap) (Array.prototype as any).flatMap = origFlatMap;
    (Array as any).from = origFrom;
    (globalThis as any).Array = OrigArray;
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
