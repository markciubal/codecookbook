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

/*
 * Language comment syntax.
 *
 * Each language has one idiomatic style for inline comments. This function
 * returns the correctly-prefixed comment string. C is the odd one — it uses
 * block comment syntax even for single lines because // is not standard C89.
 */
export function lc(lang: Language, text: string): string {
  if (lang === "python") return `# ${text}`;
  if (lang === "r")      return `# ${text}`;
  if (lang === "c")      return `/* ${text} */`;
  return `// ${text}`;
}

// ── Derived helpers ───────────────────────────────────────────────────────────

/*
 * Stats footer.
 *
 * Produces a single comment line summarising the algorithm's complexity,
 * e.g. `// Time: O(n²)  Space: O(1)  Stable: YES`.
 *
 * Python and R use their own boolean spellings (True/TRUE); everything else
 * uses YES/NO. The comment prefix comes from lc() so the style is consistent.
 */
export function statsLine(
  lang: Language,
  time: string,
  space: string,
  stable: boolean,
): string {
  // Python conventionally writes True/False; R writes TRUE/FALSE; other languages YES/NO
  const stableStr = lang === "python"
    ? (stable ? "True" : "False")
    : lang === "r"
      ? (stable ? "TRUE" : "FALSE")
      : (stable ? "YES" : "NO");
  return lc(lang, `Time: ${time}  Space: ${space}  Stable: ${stableStr}`);
}

/*
 * Section divider.
 *
 * Produces a visual break comment, e.g. `// ── demo ──`.
 * Used to separate the algorithm implementation from the demo block in
 * annotated code samples.
 */
export function sectionDivider(lang: Language, label: string): string {
  return lc(lang, `── ${label} ──`);
}

/*
 * Run command footer.
 *
 * Produces the final comment line telling the reader how to execute the file,
 * e.g. `// Run: npx ts-node solution.ts`. The command comes from LANGUAGE_META
 * so every language has one consistent, correct invocation.
 */
export function runLine(lang: Language): string {
  return lc(lang, `Run: ${LANGUAGE_META[lang].runCmd}`);
}

// ── Function name generation ──────────────────────────────────────────────────

/*
 * Idiomatic function name.
 *
 * Each language has a naming convention for functions. This function returns
 * the correctly-cased sort function name for the given algorithm and language.
 *
 *   camelCase  → TypeScript, JavaScript, Java, C++   (bubbleSort)
 *   snake_case → Python, C, Rust, R                   (bubble_sort)
 *   PascalCase → Go                                   (BubbleSort)
 *
 * "timsort" is a special case — the base word is "tim" so the result is
 * timSort, not timsortSort.
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
    case "r":
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
