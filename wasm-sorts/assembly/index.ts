// ============================================================
// CodeCookbook WASM sorts — int32, in-place over linear memory.
// ------------------------------------------------------------
// Compiled with AssemblyScript using --runtime stub so no allocator is
// involved on the hot path. The JS caller hands us (offset, length); we read
// and write through raw load<i32> / store<i32> on the wasm linear memory.
//
// Marshalling cost lives entirely on the JS side: copy the JS array into a
// view of wasm memory, call us, copy back. That copy is what the benchmark's
// "with marshal" timing captures; the time inside this module is the "raw
// kernel" timing.
// ============================================================

@inline
function ld(off: i32): i32 { return load<i32>(off); }
@inline
function st(off: i32, v: i32): void { store<i32>(off, v); }

@inline
function swap(base: i32, a: i32, b: i32): void {
  const ao = base + (a << 2);
  const bo = base + (b << 2);
  const av = ld(ao);
  st(ao, ld(bo));
  st(bo, av);
}

// Insertion sort over a half-open range [lo, hi]. Used standalone AND as the
// small-subarray fallback inside quicksort below the recursion threshold.
function insertionRange(base: i32, lo: i32, hi: i32): void {
  for (let i: i32 = lo + 1; i <= hi; i++) {
    const k = ld(base + (i << 2));
    let j = i - 1;
    while (j >= lo) {
      const v = ld(base + (j << 2));
      if (v <= k) break;
      st(base + ((j + 1) << 2), v);
      j--;
    }
    st(base + ((j + 1) << 2), k);
  }
}

// Public: sort `length` consecutive i32s starting at byte `offset`.
export function insertionSortI32(offset: i32, length: i32): void {
  if (length <= 1) return;
  insertionRange(offset, 0, length - 1);
}

// Hoare-partition quicksort with median-of-3 pivot, switches to insertion
// sort under 16 elements, and tail-loops on the larger side to keep
// recursion depth O(log n).
function quickRange(base: i32, lo: i32, hi: i32): void {
  while (hi - lo > 16) {
    const mid: i32 = (lo + hi) >> 1;
    // Sort the three so the pivot lands at `mid`.
    if (ld(base + (lo << 2)) > ld(base + (mid << 2))) swap(base, lo, mid);
    if (ld(base + (lo << 2)) > ld(base + (hi  << 2))) swap(base, lo, hi);
    if (ld(base + (mid << 2)) > ld(base + (hi << 2))) swap(base, mid, hi);
    const pivot = ld(base + (mid << 2));
    // Hoare partition — converges from both ends.
    let i: i32 = lo - 1;
    let j: i32 = hi + 1;
    while (true) {
      do { i++; } while (ld(base + (i << 2)) < pivot);
      do { j--; } while (ld(base + (j << 2)) > pivot);
      if (i >= j) break;
      swap(base, i, j);
    }
    if (j - lo < hi - j - 1) {
      quickRange(base, lo, j);
      lo = j + 1;
    } else {
      quickRange(base, j + 1, hi);
      hi = j;
    }
  }
  insertionRange(base, lo, hi);
}

export function quickSortI32(offset: i32, length: i32): void {
  if (length > 1) quickRange(offset, 0, length - 1);
}

// ── Logos i32 port (subset of LogosAdaptive v3.7.1) ─────────────────────────
// What's faithful:
//   • Asc / desc fast paths (single O(n) scan + optional reverse).
//   • LSD radix int32 for length ≥ 64 — the path that does the heavy lifting
//     at scale. Four-byte single-walk histogram + four distribute passes,
//     biased so signed ints sort correctly.
//   • Yaroslavskiy dual-pivot 3-way introsort with insertion fallback under
//     24 elements and in-place heapsort fallback at depth 2·log₂(n).
// What's deliberately omitted in this v1 Wasm port:
//   • Counting sort, flash sort, float-radix path (float-only or need a JS-
//     side allocator we don't have).
//   • Natural-runs merge with galloping (its main payoff is for non-radix
//     non-int32 data; for our pure-i32 input, radix preempts it at n ≥ 64
//     and insertion handles n ≤ 24).
//
// Memory layout the caller must guarantee:
//   [dataOffset, dataOffset + length*4)   ← the input/output
//   [scratchOffset, scratchOffset + length*4)  ← swap buffer for radix
//   [scratchOffset + length*4, … + 4·257·4 bytes)  ← four 257-bucket i32 histograms
// The JS wrapper in lib/wasmSorts.ts handles the sizing + memory.grow.

const LOGOS_INSERTION_THRESHOLD: i32 = 24;
const LOGOS_RADIX_THRESHOLD:     i32 = 64;
const LOGOS_HIST_SLOTS:          i32 = 1028;   // 4 × 257

@inline
function logosSwap(base: i32, a: i32, b: i32): void {
  const ao = base + (a << 2);
  const bo = base + (b << 2);
  const av = load<i32>(ao);
  store<i32>(ao, load<i32>(bo));
  store<i32>(bo, av);
}

@inline
function logosSwapIf(base: i32, a: i32, b: i32): void {
  const ao = base + (a << 2);
  const bo = base + (b << 2);
  const av = load<i32>(ao);
  const bv = load<i32>(bo);
  if (bv < av) { store<i32>(ao, bv); store<i32>(bo, av); }
}

// Plain insertion sort over [lo, hi].
function logosInsertion(base: i32, lo: i32, hi: i32): void {
  for (let i: i32 = lo + 1; i <= hi; i++) {
    const ka = base + (i << 2);
    const k = load<i32>(ka);
    let j = i - 1;
    while (j >= lo) {
      const v = load<i32>(base + (j << 2));
      if (v <= k) break;
      store<i32>(base + ((j + 1) << 2), v);
      j--;
    }
    store<i32>(base + ((j + 1) << 2), k);
  }
}

// In-place sift-down on the heap rooted at `root` within range [0, end).
function logosSiftDown(base: i32, lo: i32, root: i32, end: i32): void {
  while (true) {
    let big = root;
    const l = (root << 1) + 1;
    const r = l + 1;
    if (l < end && load<i32>(base + ((lo + l) << 2)) > load<i32>(base + ((lo + big) << 2))) big = l;
    if (r < end && load<i32>(base + ((lo + r) << 2)) > load<i32>(base + ((lo + big) << 2))) big = r;
    if (big === root) return;
    logosSwap(base, lo + root, lo + big);
    root = big;
  }
}

function logosHeapSort(base: i32, lo: i32, hi: i32): void {
  const len = hi - lo + 1;
  for (let i: i32 = (len >> 1) - 1; i >= 0; i--) logosSiftDown(base, lo, i, len);
  for (let i: i32 = len - 1; i > 0; i--) {
    logosSwap(base, lo, lo + i);
    logosSiftDown(base, lo, 0, i);
  }
}

// Sort the values at five indices into ascending order (used to pick pivots).
function logosSort5(base: i32, i1: i32, i2: i32, i3: i32, i4: i32, i5: i32): void {
  logosSwapIf(base, i1, i2);
  logosSwapIf(base, i2, i3); logosSwapIf(base, i1, i2);
  logosSwapIf(base, i3, i4); logosSwapIf(base, i2, i3); logosSwapIf(base, i1, i2);
  logosSwapIf(base, i4, i5); logosSwapIf(base, i3, i4); logosSwapIf(base, i2, i3); logosSwapIf(base, i1, i2);
}

// Yaroslavskiy dual-pivot 3-way introsort with depth-limited heapsort fallback.
function logosQuick(base: i32, lo: i32, hi: i32, depth: i32): void {
  while (hi - lo >= LOGOS_INSERTION_THRESHOLD) {
    if (depth === 0) { logosHeapSort(base, lo, hi); return; }
    const len = hi - lo + 1;
    const seventh = (len >> 3) + (len >> 6) + 1;
    const e3 = (lo + hi) >> 1;
    const e2 = e3 - seventh, e4 = e3 + seventh;
    const e1 = e2 - seventh, e5 = e4 + seventh;
    logosSort5(base, e1, e2, e3, e4, e5);
    const v1 = load<i32>(base + (e1 << 2));
    const v2 = load<i32>(base + (e2 << 2));
    const v3 = load<i32>(base + (e3 << 2));
    const v4 = load<i32>(base + (e4 << 2));
    const v5 = load<i32>(base + (e5 << 2));
    if (v1 != v2 && v2 != v3 && v3 != v4 && v4 != v5) {
      // Distinct pivots: dual-pivot 3-way partition.
      const p1 = v2, p2 = v4;
      store<i32>(base + (e2 << 2), load<i32>(base + (lo << 2)));
      store<i32>(base + (e4 << 2), load<i32>(base + (hi << 2)));
      let less = lo + 1, great = hi - 1, k = less;
      while (k <= great) {
        const ak = load<i32>(base + (k << 2));
        if (ak < p1) {
          store<i32>(base + (k << 2), load<i32>(base + (less << 2)));
          store<i32>(base + (less << 2), ak);
          less++;
        } else if (ak > p2) {
          while (k < great && load<i32>(base + (great << 2)) > p2) great--;
          const ag = load<i32>(base + (great << 2));
          store<i32>(base + (k << 2), ag);
          store<i32>(base + (great << 2), ak);
          great--;
          if (ag < p1) {
            store<i32>(base + (k << 2), load<i32>(base + (less << 2)));
            store<i32>(base + (less << 2), ag);
            less++;
          }
        }
        k++;
      }
      store<i32>(base + (lo << 2), load<i32>(base + ((less - 1) << 2)));
      store<i32>(base + ((less - 1) << 2), p1);
      store<i32>(base + (hi << 2), load<i32>(base + ((great + 1) << 2)));
      store<i32>(base + ((great + 1) << 2), p2);
      depth--;
      logosQuick(base, lo, less - 2, depth);
      logosQuick(base, great + 2, hi, depth);
      if (p1 == p2) return;
      // Strip equal-to-pivot bands off the middle, tail-loop on the remainder.
      let mLo = less, mHi = great;
      while (mLo <= mHi && load<i32>(base + (mLo << 2)) == p1) mLo++;
      while (mLo <= mHi && load<i32>(base + (mHi << 2)) == p2) mHi--;
      lo = mLo; hi = mHi;
    } else {
      // Heavy duplicates near median: single-pivot 3-way partition.
      const pv = v3;
      let lt = lo, gt = hi, k = lo;
      while (k <= gt) {
        const v = load<i32>(base + (k << 2));
        if (v < pv) {
          const ltPtr = base + (lt << 2);
          store<i32>(base + (k << 2), load<i32>(ltPtr));
          store<i32>(ltPtr, v);
          lt++; k++;
        } else if (v > pv) {
          const gtPtr = base + (gt << 2);
          store<i32>(base + (k << 2), load<i32>(gtPtr));
          store<i32>(gtPtr, v);
          gt--;
        } else {
          k++;
        }
      }
      depth--;
      if (lt - lo < hi - gt) { logosQuick(base, lo, lt - 1, depth); lo = gt + 1; }
      else                   { logosQuick(base, gt + 1, hi, depth); hi = lt - 1; }
    }
  }
  logosInsertion(base, lo, hi);
}

// LSD radix sort over signed i32. Caller provides scratch (length*4 bytes)
// immediately followed by 4 × 257 i32 histograms (LOGOS_HIST_SLOTS * 4 bytes).
function logosRadixI32(dataBase: i32, length: i32, scratchBase: i32): void {
  const histBase = scratchBase + (length << 2);
  // Zero all four histograms in one tight loop.
  for (let i: i32 = 0; i < LOGOS_HIST_SLOTS; i++) store<i32>(histBase + (i << 2), 0);
  const c0 = histBase;
  const c1 = histBase + (257 << 2);
  const c2 = histBase + (514 << 2);
  const c3 = histBase + (771 << 2);
  // Single-walk: bias signed → unsigned by flipping the sign bit, count all
  // four byte histograms simultaneously (offset by +1 so prefix-sum gives the
  // exclusive start of each bucket).
  for (let i: i32 = 0; i < length; i++) {
    const off = dataBase + (i << 2);
    const v = load<i32>(off) ^ 0x80000000;
    store<i32>(off, v);
    const p0 = c0 + ((( v         & 0xFF) + 1) << 2);
    const p1 = c1 + ((((v >>>  8) & 0xFF) + 1) << 2);
    const p2 = c2 + ((((v >>> 16) & 0xFF) + 1) << 2);
    const p3 = c3 + ((((v >>> 24) & 0xFF) + 1) << 2);
    store<i32>(p0, load<i32>(p0) + 1);
    store<i32>(p1, load<i32>(p1) + 1);
    store<i32>(p2, load<i32>(p2) + 1);
    store<i32>(p3, load<i32>(p3) + 1);
  }
  // Prefix-sum each histogram so it holds the destination offset per byte.
  for (let b: i32 = 1; b < 257; b++) {
    store<i32>(c0 + (b << 2), load<i32>(c0 + (b << 2)) + load<i32>(c0 + ((b - 1) << 2)));
    store<i32>(c1 + (b << 2), load<i32>(c1 + (b << 2)) + load<i32>(c1 + ((b - 1) << 2)));
    store<i32>(c2 + (b << 2), load<i32>(c2 + (b << 2)) + load<i32>(c2 + ((b - 1) << 2)));
    store<i32>(c3 + (b << 2), load<i32>(c3 + (b << 2)) + load<i32>(c3 + ((b - 1) << 2)));
  }
  // Four distribute passes, ping-ponging between data and scratch.
  let src = dataBase, dst = scratchBase;
  // Pass 0 — byte 0
  for (let i: i32 = 0; i < length; i++) {
    const v = load<i32>(src + (i << 2));
    const ptr = c0 + ((v & 0xFF) << 2);
    const pos = load<i32>(ptr);
    store<i32>(ptr, pos + 1);
    store<i32>(dst + (pos << 2), v);
  }
  let tmp: i32 = src; src = dst; dst = tmp;
  // Pass 1 — byte 1
  for (let i: i32 = 0; i < length; i++) {
    const v = load<i32>(src + (i << 2));
    const ptr = c1 + (((v >>> 8) & 0xFF) << 2);
    const pos = load<i32>(ptr);
    store<i32>(ptr, pos + 1);
    store<i32>(dst + (pos << 2), v);
  }
  tmp = src; src = dst; dst = tmp;
  // Pass 2 — byte 2
  for (let i: i32 = 0; i < length; i++) {
    const v = load<i32>(src + (i << 2));
    const ptr = c2 + (((v >>> 16) & 0xFF) << 2);
    const pos = load<i32>(ptr);
    store<i32>(ptr, pos + 1);
    store<i32>(dst + (pos << 2), v);
  }
  tmp = src; src = dst; dst = tmp;
  // Pass 3 — byte 3
  for (let i: i32 = 0; i < length; i++) {
    const v = load<i32>(src + (i << 2));
    const ptr = c3 + (((v >>> 24) & 0xFF) << 2);
    const pos = load<i32>(ptr);
    store<i32>(ptr, pos + 1);
    store<i32>(dst + (pos << 2), v);
  }
  // Even number of swaps means the final result is back at dataBase. Unbias
  // by flipping the sign bit (XOR is its own inverse). If the caller passed
  // an odd-aligned scratch and the swap chain ended at scratch, copy back.
  tmp = src; src = dst; dst = tmp;
  if (src == dataBase) {
    for (let i: i32 = 0; i < length; i++) {
      const off = dataBase + (i << 2);
      store<i32>(off, load<i32>(off) ^ 0x80000000);
    }
  } else {
    for (let i: i32 = 0; i < length; i++) {
      const v = load<i32>(src + (i << 2)) ^ 0x80000000;
      store<i32>(dataBase + (i << 2), v);
    }
  }
}

// Public Logos dispatcher — int32 only. Caller passes the data buffer offset,
// element count, and a scratch offset (used only when the radix path fires).
export function logosSortI32(dataOffset: i32, length: i32, scratchOffset: i32): void {
  if (length < 2) return;

  // Fast paths: ascending / descending.
  let isAsc = true, isDesc = true;
  for (let i: i32 = 1; i < length; i++) {
    const prev = load<i32>(dataOffset + ((i - 1) << 2));
    const cur  = load<i32>(dataOffset + (i << 2));
    if (isAsc  && cur < prev) isAsc  = false;
    if (isDesc && cur > prev) isDesc = false;
    if (!isAsc && !isDesc) break;
  }
  if (isAsc) return;
  if (isDesc) {
    let l: i32 = 0, r = length - 1;
    while (l < r) { logosSwap(dataOffset, l, r); l++; r--; }
    return;
  }

  if (length <= LOGOS_INSERTION_THRESHOLD) {
    logosInsertion(dataOffset, 0, length - 1);
    return;
  }
  if (length >= LOGOS_RADIX_THRESHOLD) {
    logosRadixI32(dataOffset, length, scratchOffset);
    return;
  }

  // 25..63 elements — small enough for quicksort + insertion fallback.
  // Compute ⌊log₂ length⌋ via a bit-shift loop instead of `clz<T>` so we
  // don't depend on which AssemblyScript version exposes the builtin.
  let log2v: i32 = 0;
  let tmp: i32 = length;
  while (tmp > 1) { tmp >>= 1; log2v++; }
  const depthLimit: i32 = 2 * log2v;
  logosQuick(dataOffset, 0, length - 1, depthLimit);
}
