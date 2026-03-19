import type { Language } from "./annotatedCode";

// ── Sorting: map pseudocode line → code line highlights ──────────────────────

/**
 * Patterns that identify the code lines corresponding to each pseudocode step.
 * Each entry is an array of substrings — a code line is highlighted if it
 * contains ANY of them.  Keep patterns specific enough to avoid false positives.
 */
const SORT_PATTERNS: Record<string, Record<number, string[]>> = {
  bubble: {
    2: ["arr[j] > arr[j + 1]", "arr[j] > arr[j+1]", "v[j] > v[j + 1]"],
    3: [
      "arr.swap(j",
      "std::swap",
      "swap(&arr[j]",
      "= [arr[j + 1], arr[j]]",
      "arr[j], arr[j + 1] = arr[j + 1]",
      "arr[j], arr[j+1] = arr[j+1]",
      "int tmp",
      "= tmp;",
    ],
  },
  selection: {
    1: ["minIdx = i", "min_idx = i"],
    3: ["arr[j] < arr[minIdx]", "arr[j] < arr[min_idx]", "v[j] < v[minIdx]", "v[j] < v[min_idx]"],
    4: ["minIdx = j", "min_idx = j"],
    5: [
      "arr[i], arr[minIdx]",
      "arr[i], arr[min_idx]",
      "std::swap(v[i]",
      "swap(&arr[i]",
      "arr.swap(i,",
      "arr[i]     = arr[minIdx]",
      "arr[minIdx] = tmp",
    ],
  },
  insertion: {
    1: ["const key = arr[i]", "key = arr[i]", "let key", "key = v[i]"],
    3: ["arr[j] > key", "arr[j - 1] > key", "v[j] > key", "arr[j] > key"],
    4: ["arr[j + 1] = arr[j]", "arr[j+1] = arr[j]", "v[j + 1] = v[j]", "arr[j] = arr[j - 1]"],
    6: ["arr[j + 1] = key", "arr[j+1] = key", "v[j + 1] = key", "arr[j] = key;"],
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
    ],
    4: ["arr[j] <=", "arr[j] <= pivot", "a[j] <= pivot"],
    5: [
      "swap(arr[i",                   // C legacy
      "[arr[i + 1], arr[j]]",         // TS legacy
      "[a[i], a[j]] =",               // TS/JS annotated
      "a[i], a[j] = a[j], a[i]",     // Python/Go annotated
      "a.swap(i, j)",                 // Rust annotated
      "a[i] = a[j]",                  // Java/C++ annotated (tmp swap)
    ],
    6: [
      "arr[pivotIndex]", "pivotIndex = i + 1", "pivot_index",  // legacy
      "a[i + 1], a[high]",            // TS/JS annotated
      "a[i + 1], a[high] = a[high]",  // Python annotated
      "swap(&arr[i + 1], &arr[hi])",  // C annotated
      "a.swap(i, hi)",                // Rust annotated
      "a[i], a[hi] = a[hi]",         // Go annotated
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
    ],
    1: ["heapify(", "siftDown(", "sift_down("],
    3: [
      "arr[0], arr[i]",                               // TS/JS/C annotated (includes both)
      "arr.swap(0",                                   // Rust
      "swap(&arr[0]",                                 // C legacy
      "[arr[0], arr[i]] =",                           // TS/JS annotated
      "arr[0], arr[i] = arr[i]",                      // Python
      "arr[0], arr[i] = arr[i], arr[0]",             // Python annotated
      "std::swap(arr[0]",                             // C++
    ],
    5: ["largest = left", "largest = right", "largest ="],
  },
  shell: {
    0: ["gap = Math.floor", "gap = n / 2", "gap /= 2", "for gap :=", "let mut gap"],
    3: ["temp = arr[i]", "key = arr[i]", "const temp = arr", "let temp = arr"],
    6: ["arr[j] = arr[j - gap]", "arr[j - gap]"],
  },
  counting: {
    1: [
      "count[arr[i]]++", "count[a[i]]++", "count[x]++",  // legacy
      "count[val - min]++",   // TS/JS annotated
      "count[val - lo] += 1", // Python annotated
      "count[v - min]++",     // Java/C/C++ annotated
      "count[(v - lo)",       // Rust annotated
    ],
    2: ["count[i] += count[i - 1]", "count[i] +="],
    4: [
      "output[count[arr[i]] - 1]", "output[count[a[i]]",  // legacy
      "count[arr[i] - min] - 1",   // TS/JS annotated
      "count[val - lo] - 1",       // Python annotated
      "count[arr[i] - min]--",     // any language decrement after
      "count[bucket] -= 1",        // Rust annotated
    ],
  },
  radix: {
    0: [
      "for (let exp", "exp *= 10",  // TS/JS (covers both while and for)
      "for exp in", "let exp = 1",
    ],
    2: [
      "Math.floor(a[i] / exp) % 10", "Math.floor(arr[i] / exp)", "/ exp) % 10",
      "digit = Math.floor",          // TS/JS annotated
      "digit = (arr[i] / exp)",      // Python/Go annotated
    ],
    5: [
      "for (let i = 0; i < n; i++) arr[i]", "for i in range(n): arr[i]",  // legacy
      "result = countingSort(",    // TS/JS annotated outer copy-back
      "output[count[digit]",       // any language placement step
    ],
  },
  bucket: {
    1: ["buckets[", "bucket_idx", "bucketIdx", "buckets.push", "bucket_index"],
    3: ["for (let b = 0", "for b in range", "for bucket in", "for b :="],
    4: ["concat", "extend", "a[writeIdx]", "result.push", "arr[write"],
  },
  timsort: {
    2: [
      "i += RUN", "i += run",             // TS/JS/Java/C/C++ outer Phase-1 loop
      "range(0, n, RUN)", "range(0, n, run)",  // Python
      "i = 0; i < n; i += RUN",           // C/C++
      "for i := 0; i < n",                // Go
      "insertionSort(a, i,",              // TS/JS call inside Phase-1 loop
      "insertionSort(arr, i,",            // alternate TS/Java
    ],
    3: [
      "const key = arr", "key = arr[j]", "key = a[j]",
      "temp = arr[j",
      "let key =", "let temp =",
    ],
    4: [
      "arr[j + 1] = arr[j]", "arr[j+1] = arr[j]",  // TS/JS/Java shift
      "a[j + 1] = a[j]",                            // TS/JS inner
      "arr[j] = arr[j - 1]",                        // Java/C alternate
      "arr[k + 1] = arr[k]",                        // C/C++
    ],
    5: [
      "arr[j + 1] = key", "arr[j+1] = key",  // TS/JS/Java place key
      "a[j + 1] = key",                       // TS/JS inner
      "arr[k + 1] = key",                     // C/C++
    ],
    6: [
      "size < n; size *= 2", "size *= 2",  // TS/JS/Java/C Phase-2 outer loop
      "while size < n", "while (size < n)",
      "size = RUN; size < n",
    ],
    7: [
      "l[i] <= r[j]",           // TS/JS/Java merge comparison
      "left[i] <= right[j]",    // alternate naming
      "l[i] <= r[j]",           // Python
      "merge(a, left",          // TS/JS merge call
      "merge(arr, left",        // Java/C merge call
      "l[i] <= r[j] {",         // Rust/Go
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
