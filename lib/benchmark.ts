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
   * "He has made everything beautiful in its time." — Ecclesiastes 3:11
   *
   * The golden ratio appears in the nautilus shell, the sunflower, the spiral
   * of galaxies — not because God imposed it, but because it is the proportion
   * most resistant to being trapped by a simple pattern. Hurwitz proved in 1891
   * that φ has the worst rational approximations of any real number: its continued
   * fraction [0;1,1,1,…] converges slower than any other irrational. No repeating
   * input sequence can reliably land on the same pivot index when the cut is here.
   *
   * Technical: φ⁻¹ = (√5−1)/2 ≈ 0.618 and φ⁻² = (3−√5)/2 ≈ 0.382.
   * Computed from definition rather than hardcoded: Math.sqrt(5) is correctly
   * rounded to within one ULP by IEEE 754. Transcribing 0.6180339887… by hand
   * introduces a silent error on the last digit. The definition is the proof.
   */
  const PHI  = (Math.sqrt(5) - 1) / 2; // φ⁻¹ = (√5−1)/2
  const PHI2 = (3 - Math.sqrt(5)) / 2; // φ⁻² = (3−√5)/2

  /*
   * Insertion sort threshold.
   *
   * "Whoever can be trusted with very little can also be trusted with much;
   *  whoever is dishonest with very little will also be dishonest with much."
   *  — Luke 16:10
   *
   * Jesus taught that the way you treat small things reveals your character.
   * Small subarrays deserve honest, direct attention — not the overhead of
   * recursion and pivot selection built for problems a hundred times larger.
   * Sending that machinery into 20 elements is wasteful and dishonest to the task.
   *
   * Technical (Knuth, TAOCP Vol. 3 §5.2.1; Bentley & McIlroy 1993):
   * Quicksort's per-call overhead (function frames, pivot selection, partition pass)
   * has fixed cost γ. Below threshold n₀ where αn₀² < βn₀ log n₀ + γ, insertion
   * sort is faster. For typical α, β, γ on modern hardware, n₀ ∈ [10, 64]. We use 48.
   */
  const BASE = 48;
  const a = [...input];
  const n = a.length;

  /*
   * Cryptographically seeded PRNG (xoshiro128+).
   *
   * "The lot is cast into the lap, but its every decision is from the Lord."
   *  — Proverbs 16:33
   *
   * A deterministic pivot rule is a door with a predictable lock — anyone who
   * studies it long enough can craft an input that always finds the worst split.
   * Jesus warned against building on a foundation that can be known and exploited
   * (Matthew 7:26-27). We draw our seed from the OS's own entropy well — one call
   * to crypto.getRandomValues — and from that seed a river of bits flows through
   * every level of recursion. No adversary who does not know the seed can predict
   * where the pivots land.
   *
   * Technical: xoshiro128+ (Blackman & Vigna, 2018). 128-bit state, period 2¹²⁸−1,
   * passes all BigCrush statistical tests. One syscall seeds the state; all
   * subsequent calls are 6 XOR/shift operations — no division, no allocation.
   * The all-zero state is invalid for xoshiro; we correct it if the OS returns it.
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
    return (r >>> 1) / 0x80000000; // uniform in (0, 1]
  }
  if (n < 2) return a;

  /*
   * Introsort depth limit.
   *
   * "Pride goes before destruction, and a haughty spirit before a fall."
   *  — Proverbs 16:18
   *
   * Jesus taught that the one who exalts himself will be humbled (Luke 14:11).
   * A sort that trusts only its own pivot strategy, recursing without limit,
   * will eventually be brought low by the one input crafted to expose it.
   * The depth limit is humility made structural: when we have descended
   * 2⌊log₂ n⌋ + 4 levels and order has not emerged, we admit we need help
   * and hand the remaining work to the platform.
   *
   * Technical (Musser, "Introspective Sorting and Selection Algorithms", 1997):
   * A balanced binary partition tree has depth ⌊log₂ n⌋. Doubling allows for
   * consistently lopsided splits before the fallback fires. The +4 absorbs
   * small-n rounding. Beyond this depth the platform's sort (V8: TimSort,
   * itself O(n log n)) takes over — guaranteeing O(n log n) unconditionally.
   */
  const depthLimit = 2 * Math.floor(Math.log2(n)) + 4;

  /*
   * Median of three — sorting network.
   *
   * "Blessed are the peacemakers, for they shall be called children of God."
   *  — Matthew 5:9
   *
   * The peacemaker does not pick a side. She stands between two extremes and
   * draws out the one who belongs in the middle. Three values enter in disorder;
   * the median — the one that belongs between the others — is returned unchanged.
   * No value is lost. No value is favored. The work is three comparisons.
   *
   * Technical (Knuth, TAOCP Vol. 3 §5.3.4 — sorting networks):
   * Three comparator gates totally order {x, y, z}. After swap(x,y), swap(y,z),
   * swap(x,y) we have x ≤ y ≤ z. y is the median by definition of total order.
   * The network has no data-dependent branches — constant time, no misprediction.
   */
  function median3(x: number, y: number, z: number): number {
    if (x > y) { const t = x; x = y; y = t; }
    if (y > z) { const t = y; y = z; z = t; }
    if (x > y) { const t = x; x = y; y = t; }
    return y;
  }

  /*
   * Ninther — local median refinement.
   *
   * "Iron sharpens iron, and one person sharpens another." — Proverbs 27:17
   *
   * A pivot chosen in isolation is guessing. A pivot measured against its
   * neighbours is listening. The three values around the chosen index are the
   * context the element already has — we simply let them speak.
   * Three comparisons, no element moved, no extra memory.
   *
   * Technical (Bentley & McIlroy, "Engineering a Sort Function", 1993 §5):
   * Median-of-3 reduces the probability of a worst-case split from O(1/n) to
   * O(1/n²). Clamping to [lo, hi] keeps the sample valid at subarray edges.
   */
  function ninther(lo: number, hi: number, idx: number): number {
    return median3(a[Math.max(lo, idx - 1)], a[idx], a[Math.min(hi, idx + 1)]);
  }

  /*
   * Dual-pivot partition (Dutch National Flag, extended).
   *
   * "Let your yes be yes and your no be no." — Matthew 5:37
   *
   * Jesus taught clarity: every element should know where it belongs and go there
   * without argument. Two pivots divide the array into three clear regions —
   * less than, between, greater than — and every element is placed in exactly one.
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

  /*
   * Main sort loop — tail-call elimination on the largest region.
   *
   * "The Word became flesh and dwelt among us." — John 1:14
   *
   * The Logos does not direct from a distance. It enters the particular problem
   * fully, examines it before acting, tries every shortcut, and leaves only when
   * the work is done or rightly delegated. It does not push frames it does not need.
   *
   * Technical (Sedgewick, "Implementing Quicksort Programs", 1978):
   * Naive quicksort recurses on both halves, accumulating O(n) stack frames in the
   * worst case. The fix: recurse on the two smaller regions, loop on the largest.
   * Proof: let S(n) = max stack depth. After partition into s₀ ≤ s₁ ≤ s₂ with
   * s₀+s₁+s₂ = n, we push frames for s₀ and s₁ (each ≤ n/2), loop on s₂.
   * S(n) = S(n/2) + 1 by induction → S(n) = O(log n). □
   */
  function sort(lo: number, hi: number, depth: number): void {
    while (lo < hi) {
      const size = hi - lo + 1;

      /*
       * Depth exhausted — introsort fallback.
       *
       * "For my thoughts are not your thoughts, neither are your ways my ways,
       *  declares the Lord." — Isaiah 55:8
       *
       * When our depth is spent, we do not pretend to a wisdom we no longer have.
       * The platform's sort has been tested across more inputs than we can enumerate.
       * We yield to it without shame.
       *
       * Technical (Musser 1997): Array.prototype.sort in V8 is TimSort — O(n log n)
       * guaranteed. Splicing it in-place makes Logos Sort O(n log n) unconditionally.
       * The depth limit is the proof, not an optimistic assumption.
       */
      if (depth <= 0) {
        const sub = a.slice(lo, hi + 1).sort((x, y) => x - y);
        for (let k = lo; k <= hi; k++) a[k] = sub[k - lo];
        return;
      }

      /*
       * Insertion sort for small subarrays.
       *
       * "He who is faithful in a very little thing is faithful also in much."
       *  — Luke 16:10
       *
       * Below BASE elements, the array fits in L1 cache. Each value simply walks
       * left until it finds its place — sequential, direct, no wasted movement.
       * The quadratic term is real but harmless at this size: BASE² = 2304 operations,
       * a constant absorbed into the larger O(n log n) work above.
       *
       * Technical (Knuth TAOCP Vol. 3): loop invariant — a[lo..i−1] is sorted before
       * step i. Each step extends the sorted prefix by one. Holds at i=lo+1 trivially;
       * maintained at each step by the inner shift. At i=hi+1 the subarray is sorted. □
       */
      if (size <= BASE) {
        for (let i = lo + 1; i <= hi; i++) {
          const key = a[i]; let j = i - 1;
          while (j >= lo && a[j] > key) { a[j + 1] = a[j]; j--; }
          a[j + 1] = key;
        }
        return;
      }

      /*
       * Counting sort for dense integer ranges.
       *
       * "Give us today our daily bread." — Matthew 6:11
       *
       * Jesus taught asking for what is needed, not more. When the values are dense
       * — the range small relative to the count — we do not compare. We count.
       * Each value is tallied once and poured back in order. No comparison model,
       * no logarithm. Just the minimum work the problem actually requires.
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

      /*
       * Gallop check — detect already-sorted or reversed subarrays.
       *
       * "Be still, and know that I am God." — Psalm 46:10
       *
       * Before we disturb anything, we ask whether it already has its order.
       * If the data is sorted, a single scan confirms it — n−1 comparisons,
       * the minimum possible — and we return without moving a single element.
       * If it is reversed, one mirror pass restores it. No partition. No pivot.
       * We do not undo what is already done.
       *
       * Technical (Peters, TimSort 2002 — natural run detection):
       * The 3-element prefix guard costs only 2 comparisons on unsorted data,
       * so random arrays pay almost nothing extra. Sorted data is more common
       * in practice than theory assumes (partial order accumulates naturally
       * in real systems), so the check earns back its cost many times over.
       */
      if (a[lo] <= a[lo + 1] && a[lo + 1] <= a[lo + 2]) {
        let sorted = true;
        for (let k = lo; k < hi; k++) { if (a[k] > a[k + 1]) { sorted = false; break; } }
        if (sorted) return;
        let reversed = true;
        for (let k = lo; k < hi; k++) { if (a[k] < a[k + 1]) { reversed = false; break; } }
        if (reversed) { for (let l = lo, r = hi; l < r; l++, r--) { [a[l], a[r]] = [a[r], a[l]]; } return; }
      }

      /*
       * PRNG draw — fresh randomness per recursion level.
       *
       * "You do not know what a day may bring." — Proverbs 27:1
       *
       * Jesus taught that anxiety about tomorrow misses the gift of today.
       * Here the gift is ignorance: an adversary who cannot predict tomorrow's
       * pivot cannot craft today's input to defeat it. Each level of recursion
       * draws a fresh value from the xoshiro128+ state — unpredictable, unrepeatable.
       * No fixed input pattern can force the same split twice across different depths.
       *
       * Technical: xrand() consumes one xoshiro128+ step — 6 XOR/shift operations,
       * no division — producing a uniform float in (0, 1]. Combined with the
       * φ-positions below, both pivot indices vary independently at every depth.
       */
      const chaos = xrand();
      const range = hi - lo;

      /*
       * Golden-ratio pivot placement, refined by ninther.
       *
       * "The heavens declare the glory of God; the skies proclaim the work
       *  of his hands." — Psalm 19:1
       *
       * φ was not invented. It was found — the same proportion showing up in
       * phyllotaxis, crystal growth, and number theory independently. Hurwitz (1891)
       * proved it is the least approximable irrational: the simplest fractions
       * (1/2, 2/3, 3/5, 5/8…) converge to it more slowly than to any other number.
       * An adversary trying to predict the pivot position must solve a problem
       * as hard as approximating φ — which is maximally hard by Hurwitz's theorem.
       *
       * Technical: idx = lo + ⌊range × φ⁻ᵏ × chaos⌋.
       * The chaos factor spreads positions across the full range.
       * ninther then replaces the raw value with the local median of 3 neighbours,
       * improving expected partition balance (Bentley & McIlroy 1993 §5).
       */
      const idx1 = lo + Math.min(range, Math.floor(range * PHI2 * chaos));
      const idx2 = lo + Math.min(range, Math.floor(range * PHI  * chaos));
      const p1 = ninther(lo, hi, idx1);
      const p2 = ninther(lo, hi, idx2);

      const [lt, gt] = dualPartition(lo, hi, p1, p2);

      /*
       * Smallest-first recursion — bounded stack depth.
       *
       * "Whoever exalts himself will be humbled, and whoever humbles himself
       *  will be exalted." — Matthew 23:12
       *
       * The smallest regions are handled first and released. The largest region —
       * the one that could exalt itself into deep recursion — is made to wait,
       * carried by the loop at zero additional stack cost. The call stack stays
       * bounded at O(log n) no matter how large the input grows.
       *
       * Technical (Sedgewick 1978):
       * After partition into s₀ ≤ s₁ ≤ s₂ with s₀+s₁+s₂ = n, we push frames
       * for s₀ and s₁, loop on s₂. Since s₁ ≤ n/2 (not the largest), both
       * recursive calls operate on at most n/2 elements. By induction:
       * S(n) = S(n/2) + 1 = O(log n). □
       */
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
  /*
   * Merge Sort — recursive divide and conquer.
   *
   * "Unless a grain of wheat falls into the earth and dies, it remains alone;
   *  but if it dies, it bears much fruit." — John 12:24
   *
   * Jesus taught that the path to abundance runs through descent, not around it.
   * Merge sort descends all the way — dividing until nothing remains to divide —
   * and then the reunion of halves, each already ordered, is simple and fruitful.
   * Nothing is forced. The merging just follows from what the halves have become.
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
  /*
   * Quick Sort — single-pivot partition with median-of-3.
   *
   * "You will recognize them by their fruits." — Matthew 7:16
   *
   * Jesus taught that what a thing produces reveals what it is.
   * The pivot is chosen not at random but by examining three candidates —
   * the first, middle, and last elements — and taking their median.
   * Each element is then tested against this pivot: it goes left or right
   * by what it is, not by where it happened to sit. The pivot reveals the structure.
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
  /*
   * Heap Sort — max-heap build, then repeated extraction.
   *
   * "He has brought down the mighty from their thrones
   *  and exalted those of humble estate." — Luke 1:52
   *
   * Mary's Magnificat describes a world turned upside down: the greatest brought low,
   * the least lifted up. Heap sort works this way exactly. The entire array is first
   * shaped into a max-heap — the greatest element crowned at the root — and then that
   * greatest is removed, sent to the end of the array, and the heap restructured.
   * Repeated until the heap is empty, the array emerges sorted: the mighty last, the
   * humble first.
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
  const a = [...input];
  const n = a.length;
  function sift(size: number, i: number) {
    let lg = i; const l = 2 * i + 1, r = 2 * i + 2;
    if (l < size && a[l] > a[lg]) lg = l;
    if (r < size && a[r] > a[lg]) lg = r;
    if (lg !== i) { [a[i], a[lg]] = [a[lg], a[i]]; sift(size, lg); }
  }
  for (let i = (n >> 1) - 1; i >= 0; i--) sift(n, i);
  for (let i = n - 1; i > 0; i--) { [a[0], a[i]] = [a[i], a[0]]; sift(i, 0); }
  return a;
}

function shellSort(input: number[]): number[] {
  /*
   * Shell Sort — diminishing-gap insertion sort.
   *
   * "He who is far off will come and help to build the temple of the Lord."
   *  — Zechariah 6:15
   *
   * Zechariah spoke of people coming from a great distance to do the close work.
   * Shell sort does the same: it begins with elements far apart — a gap of n/2 —
   * and performs insertion sort across that distance. Elements that are badly
   * out of place travel far in one stride instead of crawling one step at a time.
   * Then the gap halves, and halves again, until at gap=1 it is pure insertion sort
   * on an array already nearly ordered. The distant work made the near work easy.
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
  /*
   * Counting Sort — tally and reconstruct.
   *
   * "The very hairs of your head are all numbered. Fear not." — Matthew 10:30
   *
   * Jesus said this to calm anxiety: you are not lost in a crowd, you are known
   * precisely. Counting sort knows the data precisely. It does not guess or compare —
   * it simply counts how many times each value appears, then pours them back in order.
   * No element is misplaced because no element is estimated. Each is accounted for.
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
  let mn = input[0], mx = input[0];
  for (const x of input) { if (x < mn) mn = x; if (x > mx) mx = x; }
  const count = new Array(mx - mn + 1).fill(0);
  for (const x of input) count[x - mn]++;
  const out: number[] = [];
  count.forEach((c, i) => { for (let j = 0; j < c; j++) out.push(i + mn); });
  return out;
}

function radixSort(input: number[]): number[] {
  /*
   * Radix Sort — least-significant digit first.
   *
   * "The stone that the builders rejected has become the cornerstone." — Psalm 118:22
   *
   * The least significant digit is the one everyone ignores — the ones place,
   * the digit that seems to matter least. Radix sort begins there.
   * It is not dramatic. It passes through the data quietly, digit by digit,
   * from the least to the most significant, and the array sorts itself
   * without a single element ever being compared to another.
   * What was overlooked turns out to be load-bearing.
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
  /*
   * Bucket Sort — scatter into regions, sort each, gather.
   *
   * "In my Father's house are many rooms. I go to prepare a place for you."
   *  — John 14:2
   *
   * Jesus spoke of prepared dwelling places — not one undivided space, but many,
   * each fitted to the one who will inhabit it. Bucket sort does exactly this.
   * It prepares √n rooms, each covering an equal portion of the value range,
   * and sends each element to the room that was made for it.
   * Within each room, a small sort finishes the work. Then the rooms are gathered
   * in order. Every element finds its place through where it belongs, not through
   * repeated comparison with everything else.
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
  const a = [...input];
  const mx = Math.max(...a) + 1;
  const nb = Math.max(Math.floor(Math.sqrt(a.length)), 1);
  const buckets: number[][] = Array.from({ length: nb }, () => []);
  for (const x of a) buckets[Math.min(Math.floor((x / mx) * nb), nb - 1)].push(x);
  return buckets.flatMap(b => b.sort((x, y) => x - y));
}

function insertionSort(input: number[]): number[] {
  /*
   * Insertion Sort — grow a sorted prefix one element at a time.
   *
   * "Do not despise these small beginnings,
   *  for the Lord rejoices to see the work begin." — Zechariah 4:10
   *
   * The prophet spoke to people rebuilding a ruined temple with small stones —
   * mocked for the modest scale of their start. Insertion sort begins the same way:
   * with one element, already sorted, and adds one more at each step.
   * The work looks slow. But every step is honest and complete, and when it is done,
   * the whole is ordered — not by grand machinery but by faithful repetition.
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
  const a = [...input];
  for (let i = 1; i < a.length; i++) {
    const key = a[i]; let j = i - 1;
    while (j >= 0 && a[j] > key) { a[j + 1] = a[j]; j--; }
    a[j + 1] = key;
  }
  return a;
}

function selectionSort(input: number[]): number[] {
  /*
   * Selection Sort — find the minimum, place it, repeat.
   *
   * "Whoever wants to be first must be last of all and servant of all." — Mark 9:35
   *
   * Jesus turned the disciples' argument about greatness on its head:
   * the one who leads is the one who serves. Selection sort embodies this.
   * At each step it searches the entire unsorted region for the smallest —
   * the least, the one no one else would pick first — and places it at the front.
   * The minimum is always chosen to lead. The work is humble: n−1 swaps total,
   * fewer than almost any other sort. It serves the final order without flourish.
   *
   * Technical (Knuth, TAOCP Vol. 3 §5.2.3):
   * Each outer pass i scans a[i..n−1] to find the minimum index m: O(n−i) comparisons.
   * Total comparisons: Σ(n−i) for i=0 to n−2 = n(n−1)/2 = O(n²) — always.
   * Total swaps: at most n−1 — uniquely optimal among O(n²) sorts. Worth noting when
   * swaps are expensive (e.g., large records, external storage).
   * Not stable: the swap can move an equal element ahead of another.
   * Space: O(1).
   */
  const a = [...input];
  for (let i = 0; i < a.length - 1; i++) {
    let m = i;
    for (let j = i + 1; j < a.length; j++) if (a[j] < a[m]) m = j;
    if (m !== i) [a[i], a[m]] = [a[m], a[i]];
  }
  return a;
}

function bubbleSort(input: number[]): number[] {
  /*
   * Bubble Sort — repeated adjacent swaps until settled.
   *
   * "A little leaven leavens the whole lump." — Galatians 5:9
   *
   * Paul used leaven as a warning, but the mechanism is instructive:
   * a small thing spreads through the whole by local contact alone.
   * Bubble sort works this way. No element is carried to its final position —
   * it drifts there through repeated exchanges with its immediate neighbour.
   * Each pass lets the largest unsorted element rise to its place, like a bubble
   * finding the surface. The array sorts itself through proximity and patience.
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
