/**
 * code-helpers.ts
 *
 * Functions for generating language-idiomatic boilerplate in annotatedCode.ts.
 * Import these and call them inside template literals — they run at module
 * evaluation time, so every code entry is built consistently "on build".
 *
 * Usage in annotatedCode.ts:
 *
 *   import { lc, statsLine, sectionDivider, runLine, fnName } from "./code-helpers";
 *
 *   typescript: `function ${fnName("bubble", "typescript")}(arr: number[]): number[] {
 *     ...
 *   }
 *   ${statsLine("typescript", "O(n²)", "O(1)", true)}
 *
 *   ${sectionDivider("typescript", "demo")}
 *   const data = [64, 34, 25, 12, 22, 11, 90];
 *   console.log("Before:", [...data]);
 *   ${fnName("bubble", "typescript")}(data);
 *   console.log("After: ", data);
 *   ${runLine("typescript")}`,
 */

import type { Language } from "./annotatedCode";
import { LANGUAGE_META } from "./annotatedCode";

// ── Comment primitives ────────────────────────────────────────────────────────

/**
 * Single-line comment in the idiomatic style for the given language.
 *   TypeScript / JavaScript / Java / C++ / Rust / Go → // text
 *   Python                                            → # text
 *   C                                                 → /* text *\/
 */
export function lc(lang: Language, text: string): string {
  if (lang === "python") return `# ${text}`;
  if (lang === "c")      return `/* ${text} */`;
  return `// ${text}`;
}

// ── Derived helpers ───────────────────────────────────────────────────────────

/**
 * Standard algorithm stats footer.
 * Produces e.g. `// Time: O(n²)  Space: O(1)  Stable: YES`
 * with the comment style appropriate for the language.
 */
export function statsLine(
  lang: Language,
  time: string,
  space: string,
  stable: boolean,
): string {
  // Python conventionally writes True/False; other languages YES/NO
  const stableStr = lang === "python"
    ? (stable ? "True" : "False")
    : (stable ? "YES" : "NO");
  return lc(lang, `Time: ${time}  Space: ${space}  Stable: ${stableStr}`);
}

/**
 * Section divider, e.g. `// ── demo ──`
 */
export function sectionDivider(lang: Language, label: string): string {
  return lc(lang, `── ${label} ──`);
}

/**
 * Run command footer, e.g. `// Run: npx ts-node solution.ts`
 * Reads the canonical run command from LANGUAGE_META.
 */
export function runLine(lang: Language): string {
  return lc(lang, `Run: ${LANGUAGE_META[lang].runCmd}`);
}

// ── Function name generation ──────────────────────────────────────────────────

/**
 * Returns the idiomatic sort function name for a given algorithm and language.
 *
 * Naming conventions:
 *   TypeScript / JavaScript / Java / C++ → camelCase  bubbleSort, logosSort
 *   Python / C / Rust                    → snake_case  bubble_sort, logos_sort
 *   Go                                   → PascalCase  BubbleSort, LogosSort
 *
 * Special cases:
 *   timsort → timSort (not timsortSort)
 */

// The "base word" before "Sort" — avoids timsortSort
const BASE: Record<string, string> = {
  bubble:    "bubble",
  selection: "selection",
  insertion: "insertion",
  merge:     "merge",
  quick:     "quick",
  heap:      "heap",
  shell:     "shell",
  counting:  "counting",
  radix:     "radix",
  bucket:    "bucket",
  timsort:   "tim",
  logos:     "logos",
};

export function fnName(algo: string, lang: Language): string {
  const base = BASE[algo] ?? algo;

  switch (lang) {
    case "python":
    case "c":
    case "rust":
      return `${base}_sort`;

    case "go":
      return `${base.charAt(0).toUpperCase()}${base.slice(1)}Sort`;

    case "typescript":
    case "javascript":
    case "java":
    case "cpp":
    default:
      return `${base}Sort`;
  }
}
