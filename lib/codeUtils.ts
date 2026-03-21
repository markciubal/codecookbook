import type { Language } from "./annotatedCode";

// ── Sorting: map pseudocode line → code line highlights ──────────────────────

/**
 * Patterns that identify the code lines corresponding to each pseudocode step.
 * Each entry is an array of substrings — a code line is highlighted if it
 * contains ANY of them.  Keep patterns specific enough to avoid false positives.
 */
const SORT_PATTERNS: Record<string, Record<number, string[]>> = {
  bubble: {
    2: ["arr[j] > arr[j + 1]", "arr[j] > arr[j+1]", "v[j] > v[j + 1]", "v[j] > v[j+1]"],
    3: [
      "arr.swap(j",
      "std::swap",
      "swap(&arr[j]",
      "= [arr[j + 1], arr[j]]",
      "arr[j], arr[j + 1] = arr[j + 1]",
      "arr[j], arr[j+1] = arr[j+1]",
      "int tmp",
      "= tmp;",
      "tmp      <- v[j]",   // R swap temp variable
    ],
  },
  selection: {
    1: ["minIdx = i", "min_idx = i", "min_idx <- i"],
    3: ["arr[j] < arr[minIdx]", "arr[j] < arr[min_idx]", "v[j] < v[minIdx]", "v[j] < v[min_idx]", "v[j] < v[min_idx]"],
    4: ["minIdx = j", "min_idx = j", "min_idx <- j"],
    5: [
      "arr[i], arr[minIdx]",
      "arr[i], arr[min_idx]",
      "std::swap(v[i]",
      "swap(&arr[i]",
      "arr.swap(i,",
      "arr[i]     = arr[minIdx]",
      "arr[minIdx] = tmp",
      "tmp          <- v[i]",   // R swap for selection sort
    ],
  },
  insertion: {
    1: ["const key = arr[i]", "key = arr[i]", "let key", "key = v[i]", "key <- v[i]"],
    3: ["arr[j] > key", "arr[j - 1] > key", "v[j] > key", "arr[j] > key", "v[j] > key"],
    4: ["arr[j + 1] = arr[j]", "arr[j+1] = arr[j]", "v[j + 1] = v[j]", "arr[j] = arr[j - 1]", "v[j + 1] <- v[j]"],
    6: ["arr[j + 1] = key", "arr[j+1] = key", "v[j + 1] = key", "arr[j] = key;", "v[j + 1] <- key"],
  },
  merge: {
    // All merge steps highlight the two-pointer comparison and copy-back lines
    5: [
      "result[i] <= result[j]",  // TS/JS/Java annotated (bottom-up)
      "arr[i] <= arr[j]",        // C/C++ annotated
      "temp[k++]",               // any language with scratch buffer
      "temp[k] =",               // Rust/Go annotated
      "merge(", "left[i]", "right[j]", // older / recursive style
    ],
  },
  quick: {
    2: [
      "pivot = arr[hi]", "pivot = arr[arr.length",  // legacy patterns
      "pivot = a[high]", "const pivot = a",          // annotated TS/JS
      "pivot = a[hi]", "pivot := a[hi]",             // Go/Rust annotated
      "int pivot = arr[hi]",                         // C annotated
      "pivot_val", "pivotVal",
      "pivot <- v[hi]",                              // R annotated
    ],
    4: ["arr[j] <=", "arr[j] <= pivot", "a[j] <= pivot", "v[j] <= pivot"],
    5: [
      "swap(arr[i",                   // C legacy
      "[arr[i + 1], arr[j]]",         // TS legacy
      "[a[i], a[j]] =",               // TS/JS annotated
      "a[i], a[j] = a[j], a[i]",     // Python/Go annotated
      "a.swap(i, j)",                 // Rust annotated
      "a[i] = a[j]",                  // Java/C++ annotated (tmp swap)
      "tmp  <- v[i]",                 // R swap into left partition
    ],
    6: [
      "arr[pivotIndex]", "pivotIndex = i + 1", "pivot_index",  // legacy
      "a[i + 1], a[high]",            // TS/JS annotated
      "a[i + 1], a[high] = a[high]",  // Python annotated
      "swap(&arr[i + 1], &arr[hi])",  // C annotated
      "a.swap(i, hi)",                // Rust annotated
      "a[i], a[hi] = a[hi]",         // Go annotated
      "tmp       <- v[i + 1L]",       // R place pivot at final position
    ],
  },
  heap: {
    0: [
      "buildMaxHeap", "build_max_heap", "buildHeap",  // legacy
      "for (let i = Math.floor(n / 2)",               // TS/JS annotated build loop
      "for (int i = n / 2",                           // Java/C/C++ annotated
      "for i in range(n // 2",                        // Python annotated
      "for i := n/2",                                 // Go annotated
      "for i in (0..n / 2)",                          // Rust annotated
      "for (i in seq(n %/%",                          // R annotated build loop
    ],
    1: ["heapify(", "siftDown(", "sift_down(", "v <- heapify("],
    3: [
      "arr[0], arr[i]",                               // TS/JS/C annotated (includes both)
      "arr.swap(0",                                   // Rust
      "swap(&arr[0]",                                 // C legacy
      "[arr[0], arr[i]] =",                           // TS/JS annotated
      "arr[0], arr[i] = arr[i]",                      // Python
      "arr[0], arr[i] = arr[i], arr[0]",             // Python annotated
      "std::swap(arr[0]",                             // C++
      "tmp  <- v[1L]; v[1L] <- v[i]",                // R swap root with last
    ],
    5: ["largest = left", "largest = right", "largest =", "largest <- left", "largest <- right"],
  },
  shell: {
    0: ["gap = Math.floor", "gap = n / 2", "gap /= 2", "for gap :=", "let mut gap", "gap <- n %/%"],
    3: ["temp = arr[i]", "key = arr[i]", "const temp = arr", "let temp = arr", "temp <- v[i]"],
    6: ["arr[j] = arr[j - gap]", "arr[j - gap]", "v[j] <- v[j - gap]"],
  },
  counting: {
    1: [
      "count[arr[i]]++", "count[a[i]]++", "count[x]++",  // legacy
      "count[val - min]++",   // TS/JS annotated
      "count[val - lo] += 1", // Python annotated
      "count[v - min]++",     // Java/C/C++ annotated
      "count[(v - lo)",       // Rust annotated
      "count[val - lo + 1L]", // R annotated
    ],
    2: ["count[i] += count[i - 1]", "count[i] +=", "count[i] <- count[i] + count[i - 1L]"],
    4: [
      "output[count[arr[i]] - 1]", "output[count[a[i]]",  // legacy
      "count[arr[i] - min] - 1",   // TS/JS annotated
      "count[val - lo] - 1",       // Python annotated
      "count[arr[i] - min]--",     // any language decrement after
      "count[bucket] -= 1",        // Rust annotated
      "pos           <- count[bucket]",  // R annotated placement
    ],
  },
  radix: {
    0: [
      "for (let exp", "exp *= 10",  // TS/JS (covers both while and for)
      "for exp in", "let exp = 1",
      "exp <- 1L",                  // R annotated
    ],
    2: [
      "Math.floor(a[i] / exp) % 10", "Math.floor(arr[i] / exp)", "/ exp) % 10",
      "digit = Math.floor",          // TS/JS annotated
      "digit = (arr[i] / exp)",      // Python/Go annotated
      "digit          <- (val %/%",  // R annotated
    ],
    5: [
      "for (let i = 0; i < n; i++) arr[i]", "for i in range(n): arr[i]",  // legacy
      "result = countingSort(",    // TS/JS annotated outer copy-back
      "output[count[digit]",       // any language placement step
      "v   <- counting_sort_digit(",  // R annotated outer call
    ],
  },
  bucket: {
    1: ["buckets[", "bucket_idx", "bucketIdx", "buckets.push", "bucket_index", "buckets[[idx]]"],
    3: ["for (let b = 0", "for b in range", "for bucket in", "for b :=", "for (b in buckets)"],
    4: ["concat", "extend", "a[writeIdx]", "result.push", "arr[write", "result <- c(result,"],
  },
  timsort: {
    2: [
      "i += RUN", "i += run",             // TS/JS/Java/C/C++ outer Phase-1 loop
      "range(0, n, RUN)", "range(0, n, run)",  // Python
      "i = 0; i < n; i += RUN",           // C/C++
      "for i := 0; i < n",                // Go
      "insertionSort(a, i,",              // TS/JS call inside Phase-1 loop
      "insertionSort(arr, i,",            // alternate TS/Java
      "v <- insertion_sort_run(",         // R annotated Phase-1 call
    ],
    3: [
      "const key = arr", "key = arr[j]", "key = a[j]",
      "temp = arr[j",
      "let key =", "let temp =",
      "key <- v[i]",                      // R insertion sort within tim_sort
    ],
    4: [
      "arr[j + 1] = arr[j]", "arr[j+1] = arr[j]",  // TS/JS/Java shift
      "a[j + 1] = a[j]",                            // TS/JS inner
      "arr[j] = arr[j - 1]",                        // Java/C alternate
      "arr[k + 1] = arr[k]",                        // C/C++
      "v[j + 1L] <- v[j]",                          // R shift right
    ],
    5: [
      "arr[j + 1] = key", "arr[j+1] = key",  // TS/JS/Java place key
      "a[j + 1] = key",                       // TS/JS inner
      "arr[k + 1] = key",                     // C/C++
      "v[j + 1L] <- key",                     // R place key
    ],
    6: [
      "size < n; size *= 2", "size *= 2",  // TS/JS/Java/C Phase-2 outer loop
      "while size < n", "while (size < n)",
      "size = RUN; size < n",
      "while (size < n)",                   // R Phase-2 outer loop
    ],
    7: [
      "l[i] <= r[j]",           // TS/JS/Java merge comparison
      "left[i] <= right[j]",    // alternate naming
      "l[i] <= r[j]",           // Python
      "merge(a, left",          // TS/JS merge call
      "merge(arr, left",        // Java/C merge call
      "l[i] <= r[j] {",         // Rust/Go
      "left_arr[i] <= right_arr[j]",  // R merge comparison
    ],
  },
  logos: {
    // Line 0 — insertion sort fallback (size ≤ 48 or depth gone)
    0: [
      "size <= 48",           // if-guard
      "a[j+1] = a[j]",       // shift element right during insertion
      "a[j+1] = key",        // place the key in its sorted position
      "size <= 48L",          // R if-guard
      "a[j + 1L] <<- a[j]",  // R shift element right
      "a[j + 1L] <<- key",   // R place key
    ],
    // Line 1 — counting sort shortcut (dense integers, range < 4×size)
    1: [
      "span < size * 4",     // trigger condition
      "counts[a[k]-mn]++",   // tally each value
      "a[k++] = v + mn",     // pour values back in order
      "span < size * 4L",    // R trigger condition
      "counts[a[k] - mn + 1L]",  // R tally each value
    ],
    // Line 2 — gallop check (already sorted or reversed)
    2: [
      "a[lo] <= a[lo+1]",              // prefix ascending check
      "let sorted = true",             // scanning for sorted
      "[a[l], a[r]] = [a[r], a[l]]",  // O(n) in-place reversal
      "a[lo] <= a[lo + 1L]",          // R prefix ascending check
      "sorted <- all(",                // R scanning for sorted
      "a[lo:hi] <<- rev(",            // R in-place reversal
    ],
    // Line 3 — chaos draw + golden-ratio index candidates
    3: [
      "chaos = Math.abs",   // derive chaos factor from PRNG
      "PHI2 * chaos",       // φ² golden cut position
      "PHI  * chaos",       // φ¹ golden cut position
      "idx1 =",             // first candidate index
      "idx2 =",             // second candidate index
      "chaos <- abs(",      // R chaos factor
      "idx1 <- lo +",       // R first candidate index
      "idx2 <- lo +",       // R second candidate index
    ],
    // Line 4 — ninther pivot refinement
    4: [
      "const p1 = ninther",  // smooth first pivot against neighbours
      "const p2 = ninther",  // smooth second pivot against neighbours
      "ninther(lo",          // any ninther call
      "p1   <- ninther(",    // R first ninther call
      "p2   <- ninther(",    // R second ninther call
    ],
    // Line 5 — partition pointer initialisation
    5: [
      "let lt = lo, gt = hi",  // pointer init inside dualPartition
      "dualPartition(",        // call site
      "lt <- lo; gt <- hi",   // R pointer init
      "bounds <- dual_partition(",  // R call site
    ],
    // Line 6 — dual-pointer scan loop
    6: [
      "while (i <= gt)",  // the scanning loop condition
      "while (i <= gt)",  // R scanning loop condition
    ],
    // Line 7 — element < p1: send left
    7: [
      "a[i] < p1",            // comparison
      "[a[lt], a[i]] = ",     // swap with left boundary
      "lt++; i++",            // advance both pointers
      "if (a[i] < p1)",       // R comparison
      "t <- a[lt]; a[lt] <<- a[i]; a[i] <<- t",  // R swap with left boundary
    ],
    // Line 8 — element > p2: send right
    8: [
      "a[i] > p2",            // comparison
      "[a[i], a[gt]] = ",     // swap with right boundary
      "gt--",                 // retract right boundary (i stays)
      "} else if (a[i] > p2)",  // R comparison
      "t <- a[i]; a[i] <<- a[gt]; a[gt] <<- t",  // R swap with right boundary
    ],
    // Line 9 — element in [p1,p2]: already in place, just advance
    9: [
      "else                 { i++; }",  // middle-region no-op branch
      "i <- i + 1L",                    // R middle-region advance
    ],
    // Line 10 — size-ranked recursion + tail continuation
    10: [
      "regions.sort(",         // rank regions by size
      "sort(regions[0]",       // recurse into smallest
      "lo = regions[2]",       // tail-call largest (no stack frame)
      "regions <- regions[order_]",  // R rank regions
      "sort_rec(regions[[1L]]",      // R recurse smallest
      "lo    <- regions[[3L]]",      // R tail-call largest
    ],
  },
};

/**
 * Returns the set of 0-based line indices to highlight in the actual code
 * for the given algorithm + pseudocode step.
 */
export function getSortHighlightLines(
  algorithmId: string,
  pseudocodeLine: number | undefined,
  code: string,
): Set<number> {
  if (pseudocodeLine === undefined || pseudocodeLine < 0) return new Set();
  const patterns = SORT_PATTERNS[algorithmId]?.[pseudocodeLine];
  if (!patterns || patterns.length === 0) return new Set();

  const lines = code.split("\n");
  const result = new Set<number>();
  lines.forEach((line, i) => {
    if (patterns.some((p) => line.includes(p))) result.add(i);
  });
  return result;
}

// ── DS: find method line range ────────────────────────────────────────────────

/** Converts a camelCase/PascalCase method name to the language-specific variant. */
function resolveMethodName(name: string, language: Language): string {
  if (language === "python") {
    // camelCase → snake_case
    return name.replace(/([A-Z])/g, (_, c) => `_${c.toLowerCase()}`);
  }
  if (language === "go") {
    // camelCase → PascalCase (first letter upper)
    return name.charAt(0).toUpperCase() + name.slice(1);
  }
  return name;
}

/**
 * Finds the start and end (0-based, inclusive) line indices of a named method
 * in the given code string.  Works for brace-delimited languages and Python.
 */
export function getMethodLineRange(
  code: string,
  methodName: string,
  language: Language,
): { start: number; end: number } | null {
  const name = resolveMethodName(methodName, language);
  const lines = code.split("\n");

  if (language === "python") {
    return getPythonMethodRange(lines, name);
  }
  return getBraceMethodRange(lines, name);
}

function getBraceMethodRange(
  lines: string[],
  name: string,
): { start: number; end: number } | null {
  // Regex: method name followed by ( — but NOT preceded by . (not a call)
  const pattern = new RegExp(`(?<![.\\w])${escapeRegex(name)}\\s*[<(]`);

  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trimStart();
    // Skip comment lines
    if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("#")) continue;
    if (pattern.test(lines[i])) {
      start = i;
      break;
    }
  }
  if (start === -1) return null;

  // Brace-count to find end of method body
  let depth = 0;
  let bodyStarted = false;
  for (let i = start; i < lines.length; i++) {
    for (const ch of lines[i]) {
      if (ch === "{") { depth++; bodyStarted = true; }
      if (ch === "}") depth--;
    }
    if (bodyStarted && depth <= 0) {
      return { start, end: i };
    }
  }
  // Fallback: return to end of file
  return { start, end: lines.length - 1 };
}

function getPythonMethodRange(
  lines: string[],
  name: string,
): { start: number; end: number } | null {
  const defPattern = new RegExp(`^\\s*def\\s+${escapeRegex(name)}\\s*\\(`);
  let start = -1;
  let defIndent = 0;

  for (let i = 0; i < lines.length; i++) {
    if (defPattern.test(lines[i])) {
      start = i;
      defIndent = lines[i].length - lines[i].trimStart().length;
      break;
    }
  }
  if (start === -1) return null;

  let end = start;
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === "") { end = i; continue; } // blank lines count
    const indent = line.length - line.trimStart().length;
    if (indent <= defIndent) break; // back to outer scope
    end = i;
  }
  return { start, end };
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
