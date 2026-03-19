export interface Mnemonic {
  headline: string;
  body: string;
}

export const MNEMONICS: Record<string, Mnemonic[]> = {
  bubble: [
    {
      headline: "Bubbles float to the surface",
      body: "Each pass, the largest unsorted value 'sinks' to its final position at the end — like sediment settling. Lighter values bubble toward the front. After pass k, the last k elements are permanently sorted.",
    },
    {
      headline: "Shrinking window each lap",
      body: "Think: 'Each lap around the pool, I swim one fewer length.' After pass 1 the last element is done, after pass 2 the last two are done — the unsorted window shrinks by one each time.",
    },
    {
      headline: "O(n²) but early exit on sorted input",
      body: "If no swaps happen in a full pass, the array is already sorted and the algorithm stops. This gives O(n) on nearly-sorted data — bubble sort's hidden strength.",
    },
  ],

  selection: [
    {
      headline: "Trophy ceremony — one award per round",
      body: "Each round, scan the unsorted region and award a trophy (permanent placement) to the smallest value. Only one swap per pass, so write operations are minimal — good when writes are expensive.",
    },
    {
      headline: "SELECT the minimum",
      body: "The name says it: every iteration you SELECT the next smallest element. Point to the start of the unsorted region, scan right, swap the minimum into place.",
    },
    {
      headline: "Never better than O(n²)",
      body: "Unlike bubble sort, selection sort always does n(n−1)/2 comparisons even on sorted input. Think: 'Selection never gets a shortcut — it always checks everything.'",
    },
  ],

  insertion: [
    {
      headline: "Sorting cards in your hand",
      body: "Imagine picking up playing cards one at a time. Each new card slides left past larger cards until it finds its spot. The left portion is always sorted; the right is untouched.",
    },
    {
      headline: "Grows a sorted region left-to-right",
      body: "Think of an expanding bubble: |sorted | unsorted|. The boundary moves right by one each step. You only ever move within the sorted region.",
    },
    {
      headline: "O(n) on nearly-sorted data",
      body: "If the array is almost in order, each card only shifts a little — giving near O(n) performance. This is why Tim Sort uses insertion sort for small runs.",
    },
  ],

  merge: [
    {
      headline: "Divide a messy pile, conquer each half",
      body: "Split a stack of papers in half, keep splitting until each stack has one sheet. Merging two sorted piles is trivial — always take whichever top card is smaller.",
    },
    {
      headline: "Guaranteed O(n log n) — no worst case",
      body: "Think: 'Merge has a marriage certificate — legally guaranteed performance.' Unlike Quick Sort, no pivot choice can cause degradation.",
    },
    {
      headline: "log n levels, n work per level",
      body: "Each halving adds a level (log n levels total). At each level you touch every element exactly once (n work). Total: n × log n. Picture a perfect binary tree.",
    },
  ],

  quick: [
    {
      headline: "Pick a middleman (pivot)",
      body: "The pivot acts as a divider: everything smaller goes left, everything larger goes right, then repeat on both sides. Choose a good pivot and it balances perfectly.",
    },
    {
      headline: "'Quick' means average case",
      body: "The name refers to average-case speed (O(n log n) average), not guaranteed speed. With a bad pivot on sorted input, it degrades to O(n²). Think: quick but cocky.",
    },
    {
      headline: "Partition in-place → low space cost",
      body: "Unlike Merge Sort, Quick Sort rearranges elements in-place. Space is only O(log n) for the recursion stack — no extra array needed.",
    },
  ],

  heap: [
    {
      headline: "Build a tournament bracket, harvest winners",
      body: "Phase 1: heapify — build a max-heap where the largest value is always the root (tournament champion). Phase 2: extract-max — move the root to the end and re-run the tournament.",
    },
    {
      headline: "Heap, then harvest",
      body: "Plant the heap (build), then pluck the root repeatedly (harvest). The tree shrinks by one node each harvest. After n harvests, the array is sorted.",
    },
    {
      headline: "Not cache-friendly = slower in practice",
      body: "Despite guaranteed O(n log n), heap sort's random memory access pattern is cache-unfriendly. Quick Sort is usually faster in practice even though heap sort has a better worst case.",
    },
  ],

  shell: [
    {
      headline: "Insertion sort on caffeine",
      body: "Shell sort runs multiple passes of insertion sort with decreasing gap sizes. Large gaps fix large misplacements cheaply; the final gap-1 pass (plain insertion sort) has almost nothing left to fix.",
    },
    {
      headline: "The gap halves like a bouncing ball",
      body: "Picture a ball dropped from height n: it bounces to n/2, then n/4, then n/8… finally 1. Each bounce is a pass of insertion sort with that gap size.",
    },
    {
      headline: "Named after Donald Shell (1959)",
      body: "One of the first algorithms to beat O(n²) in practice, long before the theory was proven. The right gap sequence is still debated — Ciura's sequence (1, 4, 10, 23, 57…) is empirically best.",
    },
  ],

  counting: [
    {
      headline: "Election tally — no comparisons needed",
      body: "Like counting votes: tally how many times each value appears in a separate count array, then reconstruct the sorted output from the tally. Never compares two elements directly.",
    },
    {
      headline: "k buckets on the counter",
      body: "The 'k' in O(n + k) is the range of input values. If k is small (e.g. ages 0–120), counting sort is blazing fast. If k is huge (e.g. 64-bit integers), it's impractical.",
    },
    {
      headline: "Prefix-sum makes it stable",
      body: "After tallying, compute the prefix sum of counts: each value's count becomes the ending position in the output. Iterating the input right-to-left preserves order — making it stable.",
    },
  ],

  radix: [
    {
      headline: "Sort the postal code digit by digit",
      body: "Sort all numbers by their rightmost digit, then the second-to-last, and so on. Each digit-pass uses stable counting sort so earlier passes aren't destroyed by later ones.",
    },
    {
      headline: "LSD = Least Significant Digit first",
      body: "LSD (Least Significant Digit) radix sort processes digits from right to left. MSD goes left to right. LSD is simpler and iterative; MSD enables early termination.",
    },
    {
      headline: "O(nk) — works best when k is small",
      body: "k is the number of digits. 32-bit integers → k = 10 decimal digits (or 4 bytes if using base 256). Small k with large n makes radix sort beat comparison sorts.",
    },
  ],

  bucket: [
    {
      headline: "Mailroom sorting",
      body: "Like a mail sorter distributing letters into pigeonhole bins by ZIP code prefix: scatter values into buckets by range, sort each small bucket (usually insertion sort), then collect in order.",
    },
    {
      headline: "Uniform distribution = O(n)",
      body: "Bucket sort shines when input is uniformly spread across a range (e.g. random floats 0–1). Every bucket gets ~1 element → each bucket sorts in O(1) → total O(n).",
    },
    {
      headline: "Clumps kill performance",
      body: "If all values land in one bucket, it degrades to whatever sort you use inside the bucket (usually O(n²)). Think: 'buckets work when the mail is spread evenly, not when everyone lives on the same street.'",
    },
  ],

  timsort: [
    {
      headline: "Tim Peters' love child of Merge + Insertion",
      body: "Created by Tim Peters in 2002 for Python. Splits the array into small 'runs' sorted by insertion sort (fast on small arrays), then merges them using merge sort's guaranteed O(n log n).",
    },
    {
      headline: "Exploits natural order in real data",
      body: "Real-world data is rarely random — it often has partially-sorted regions. Tim Sort detects these natural runs and exploits them. Random data gets no benefit; sorted data completes in O(n).",
    },
    {
      headline: "Used in Python, Java, Android, Swift",
      body: "Tim Sort is the default sort in Python's list.sort(), Java's Arrays.sort() for objects, Android, and V8 JavaScript engine. If you've ever called sort(), you've likely used Tim Sort.",
    },
  ],

  logos: [
    {
      headline: "Two golden pivots, not one",
      body: "Where classical quicksort picks a single pivot, Logos Ultra Sort picks two: one at position φ² ≈ 0.382 and one at φ ≈ 0.618 of the range. These irrational offsets are scaled by a per-level chaos factor so no adversarial input can predict both pivot positions simultaneously. The result is three partitions — left, middle, right — settled in one Dutch National Flag pass, dramatically reducing the work on duplicate-heavy data.",
    },
    {
      headline: "Ninther: take the median of three medians",
      body: "A single median-of-3 can still be fooled. Logos Ultra Sort uses a ninther: for each candidate pivot index it takes the median of that index and its two neighbours. This costs three comparisons but raises pivot quality substantially — even in nearly-sorted or adversarial inputs the pivot lands close to the true median, shrinking both partition regions toward equal halves.",
    },
    {
      headline: "Smallest region first, introsort as a safety net",
      body: "After partitioning, the three regions are sorted by size and the two smallest are processed recursively while the largest becomes the next loop iteration (tail-call). Stack depth is bounded to O(log n) regardless of partition quality. A depth counter catches the rare worst case and falls back to the standard library sort — the introsort guarantee that prevents O(n²) no matter what.",
    },
  ],
};
