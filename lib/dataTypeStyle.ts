/*
 * Single source of truth for the dtype → line-style symbolic convention.
 *
 * The visual rule, used wherever we overlay multiple data types on one chart
 * or graph:
 *
 *    string  →  SOLID    (continuous → continuous line)
 *    float   →  DASHED   (granular but continuous-ish → broken line)
 *    integer →  DOTTED   (discrete countable → dotted line)
 *
 * The order — solid, dashed, dotted — mirrors the rough "granularity" of the
 * underlying data: a string is a single conceptual value, a float is
 * fine-grained continuous, an integer is the most discrete. Picking the same
 * three values everywhere is the point — once the user learns "dotted = int"
 * on one chart they read it correctly on every other chart.
 *
 * Importers:
 *   - SVG / inline-styled lines:        `svgDash(dt)` → strokeDasharray string
 *     (e.g. "2 3" for integer, undefined for string).
 *   - Cytoscape edges / node borders:   `cyLineStyle(dt)` → "solid" | "dashed" | "dotted"
 *   - CSS border-style:                 `cssBorderStyle(dt)` → "solid" | "dashed" | "dotted"
 *
 * The single-letter label `dtSymbol(dt)` is provided for compact legends.
 */

import type { DataType } from "@/lib/benchmark";

/** Re-export so consumers don't both need this module and `benchmark.ts`. */
export type { DataType };

export const DATA_TYPES: readonly DataType[] = ["integer", "float", "string"] as const;

export const DT_LABEL: Record<DataType, string> = {
  integer: "Integer",
  float:   "Float",
  string:  "String",
};

/** Compact one-letter chip for tight legends ("I" / "F" / "S"). */
export const DT_SYMBOL: Record<DataType, string> = {
  integer: "I",
  float:   "F",
  string:  "S",
};
export function dtSymbol(dt: DataType): string { return DT_SYMBOL[dt]; }

/** Cytoscape's `line-style` and `border-style` properties both accept the
 *  same three string values, so one helper covers both. */
export type CyLineStyle = "solid" | "dashed" | "dotted";
const CY_STYLE: Record<DataType, CyLineStyle> = {
  string:  "solid",
  float:   "dashed",
  integer: "dotted",
};
export function cyLineStyle(dt: DataType): CyLineStyle { return CY_STYLE[dt]; }

/** SVG `stroke-dasharray` strings sized to read cleanly at typical chart line
 *  widths (1–2 px). `undefined` for `string` so callers can spread it without
 *  a conditional: `<line strokeDasharray={svgDash(dt)} />`. */
const SVG_DASH: Record<DataType, string | undefined> = {
  string:  undefined,  // solid — no dasharray attribute
  float:   "5 3",      // medium dash
  integer: "2 3",      // dotted
};
export function svgDash(dt: DataType): string | undefined { return SVG_DASH[dt]; }

/** Plain CSS border-style values — useful for badge borders, node borders in
 *  HTML overlays, etc. */
const CSS_BORDER: Record<DataType, "solid" | "dashed" | "dotted"> = {
  string:  "solid",
  float:   "dashed",
  integer: "dotted",
};
export function cssBorderStyle(dt: DataType): "solid" | "dashed" | "dotted" {
  return CSS_BORDER[dt];
}

/** One-line legend string for tooltips / footer copy. */
export const DT_LEGEND_TEXT =
  "string = solid · float = dashed · integer = dotted";
