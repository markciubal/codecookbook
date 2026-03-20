/**
 * Measures the speedup of V8 native .sort() vs a pure-JS TimSort implementation.
 * Pure-JS TimSort is a faithful port of CPython's listsort (the real TimSort).
 */

// ── Pure-JS TimSort (ported from CPython listsort.txt) ───────────────────────

function timSortJS(arr) {
  const a = [...arr];
  const n = a.length;
  if (n < 2) return a;

  const MIN_MERGE = 32;

  function minRunLength(n) {
    let r = 0;
    while (n >= MIN_MERGE) { r |= n & 1; n >>= 1; }
    return n + r;
  }

  function insertionSort(lo, hi, start) {
    if (start === lo) start++;
    for (; start <= hi; start++) {
      const pivot = a[start];
      let left = lo, right = start;
      while (left < right) {
        const mid = (left + right) >> 1;
        if (pivot < a[mid]) right = mid; else left = mid + 1;
      }
      for (let i = start; i > left; i--) a[i] = a[i - 1];
      a[left] = pivot;
    }
  }

  function countRunAndMakeAscending(lo, hi) {
    let runHi = lo + 1;
    if (runHi === hi) return 1;
    if (a[runHi++] < a[lo]) {
      while (runHi <= hi && a[runHi] < a[runHi - 1]) runHi++;
      let l = lo, r = runHi - 1;
      while (l < r) { const t = a[l]; a[l++] = a[r]; a[r--] = t; }
    } else {
      while (runHi <= hi && a[runHi] >= a[runHi - 1]) runHi++;
    }
    return runHi - lo;
  }

  function merge(lo, mid, hi) {
    const left = a.slice(lo, mid + 1);
    let i = 0, j = mid + 1, k = lo;
    while (i < left.length && j <= hi) {
      if (left[i] <= a[j]) a[k++] = left[i++]; else a[k++] = a[j++];
    }
    while (i < left.length) a[k++] = left[i++];
  }

  const runs = [];
  const minRun = minRunLength(n);
  let remaining = n, lo = 0;

  while (remaining > 0) {
    let runLen = countRunAndMakeAscending(lo, Math.min(lo + remaining - 1, n - 1));
    if (runLen < minRun) {
      const force = Math.min(remaining, minRun);
      insertionSort(lo, lo + force - 1, lo + runLen);
      runLen = force;
    }
    runs.push({ base: lo, len: runLen });
    lo += runLen;
    remaining -= runLen;

    // merge collapse
    while (runs.length > 1) {
      let i = runs.length - 2;
      if (i > 0 && runs[i - 1].len <= runs[i].len + runs[i + 1].len) {
        if (runs[i - 1].len < runs[i + 1].len) i--;
      } else if (runs[i].len <= runs[i + 1].len) {
        // ok
      } else break;
      const r = runs[i + 1];
      const l = runs[i];
      merge(l.base, l.base + l.len - 1, r.base + r.len - 1);
      runs[i] = { base: l.base, len: l.len + r.len };
      runs.splice(i + 1, 1);
    }
  }

  // force merge remaining
  while (runs.length > 1) {
    const r = runs.pop();
    const l = runs[runs.length - 1];
    merge(l.base, l.base + l.len - 1, r.base + r.len - 1);
    runs[runs.length - 1] = { base: l.base, len: l.len + r.len };
  }

  return a;
}

// ── Native .sort() wrapper ───────────────────────────────────────────────────

function timSortNative(arr) {
  return [...arr].sort((a, b) => a - b);
}

// ── Input generators ─────────────────────────────────────────────────────────

function genRandom(n)       { return Array.from({length:n}, ()=>Math.floor(Math.random()*10_000)); }
function genNearlySorted(n) {
  const a = Array.from({length:n}, (_,i)=>i+1);
  const s = Math.max(1, Math.floor(n*0.05));
  for (let i=0;i<s;i++){const x=Math.floor(Math.random()*n),y=Math.floor(Math.random()*n);[a[x],a[y]]=[a[y],a[x]];}
  return a;
}
function genReversed(n)   { return Array.from({length:n}, (_,i)=>n-i); }
function genDuplicates(n) { return Array.from({length:n}, ()=>Math.floor(Math.random()*Math.ceil(n/5))); }

const SCENARIOS = { random: genRandom, nearlySorted: genNearlySorted, reversed: genReversed, duplicates: genDuplicates };

// ── Bench ─────────────────────────────────────────────────────────────────────

const ROUNDS = 7, DISCARD = 2;

function bench(fn, input) {
  let best = Infinity;
  for (let r = 0; r < ROUNDS; r++) {
    const t0 = performance.now();
    fn([...input]);
    const el = performance.now() - t0;
    if (r >= DISCARD) best = Math.min(best, el);
  }
  return best;
}

// ── Correctness ───────────────────────────────────────────────────────────────

const ck = genRandom(1000);
const got = timSortJS(ck), want = timSortNative(ck);
for (let i = 0; i < want.length; i++) {
  if (got[i] !== want[i]) { console.error(`FAIL at ${i}`); process.exit(1); }
}

// ── Run ───────────────────────────────────────────────────────────────────────

const SIZES = [1_000, 10_000, 100_000, 1_000_000];
const SCENARIO_KEYS = ["random", "nearlySorted", "reversed", "duplicates"];

const multipliers = [];

console.log("\n╔══════════════════════════════════════════════════════════════════╗");
console.log("║        Native .sort() vs pure-JS TimSort  (multiplier)          ║");
console.log("╠══════════════════════════════════════════════════════════════════╣");
console.log(`║  ${"n".padEnd(9)} ${"scenario".padEnd(14)} ${"native".padStart(10)} ${"JS impl".padStart(10)} ${"multiplier".padStart(12)}  ║`);
console.log("╠══════════════════════════════════════════════════════════════════╣");

for (const n of SIZES) {
  for (const sc of SCENARIO_KEYS) {
    const input = SCENARIOS[sc](n);
    const tNative = bench(timSortNative, input);
    const tJS     = bench(timSortJS,     input);
    const mult    = tJS / tNative;
    multipliers.push(mult);
    const fmt = ms => ms < 1 ? `${(ms*1000).toFixed(0)}μs` : ms < 1000 ? `${ms.toFixed(2)}ms` : `${(ms/1000).toFixed(2)}s`;
    console.log(`║  ${String(n).padStart(8).padEnd(9)} ${sc.padEnd(14)} ${fmt(tNative).padStart(10)} ${fmt(tJS).padStart(10)} ${`${mult.toFixed(2)}×`.padStart(12)}  ║`);
  }
  console.log("╠══════════════════════════════════════════════════════════════════╣");
}

const avg  = multipliers.reduce((s,v)=>s+v,0) / multipliers.length;
const med  = [...multipliers].sort((a,b)=>a-b)[Math.floor(multipliers.length/2)];
const mn   = Math.min(...multipliers);
const mx   = Math.max(...multipliers);

console.log(`║  ${"avg".padEnd(9)} ${"all scenarios".padEnd(14)} ${"".padStart(10)} ${"".padStart(10)} ${`${avg.toFixed(2)}×`.padStart(12)}  ║`);
console.log(`║  ${"median".padEnd(9)} ${"all scenarios".padEnd(14)} ${"".padStart(10)} ${"".padStart(10)} ${`${med.toFixed(2)}×`.padStart(12)}  ║`);
console.log(`║  ${"range".padEnd(9)} ${"min → max".padEnd(14)} ${"".padStart(10)} ${"".padStart(10)} ${`${mn.toFixed(2)}×–${mx.toFixed(2)}×`.padStart(12)}  ║`);
console.log("╚══════════════════════════════════════════════════════════════════╝\n");
console.log(`Recommended multiplier to use: ${med.toFixed(1)}× (median across all sizes and scenarios)\n`);
