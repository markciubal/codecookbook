export type BarState =
  | "default"
  | "comparing"
  | "swapping"
  | "sorted"
  | "minimum"
  | "current"
  | "pivot";

export interface SortStep {
  array: number[];
  states: BarState[];
  description: string;
  comparisons: number;
  swaps: number;
  /** 0-based index into ALGORITHM_META[alg].pseudocode. -1 = no highlight. */
  pseudocodeLine?: number;
}

export type SortAlgorithm = "bubble" | "selection" | "insertion" | "merge" | "quick" | "heap" | "shell" | "counting" | "radix" | "bucket" | "timsort" | "logos" | "cocktail" | "comb" | "gnome" | "pancake" | "cycle" | "oddeven" | "introsort";

export interface AlgorithmMeta {
  name: string;
  slug: SortAlgorithm;
  timeComplexity: string;
  spaceComplexity: string;
  stable: boolean;
  description: string;
  pseudocode: string[];
  /** Optional epigraph shown beneath the algorithm name */
  quote?: { text: string; attribution: string };
  /** LeetCode problem URL for practice */
  leetcode?: string;
  /** One-sentence explanation of why this algorithm made the comparisons it did, shown on sort completion */
  comparisonNote?: string;
}

export interface CyNodeDef {
  id: string;
  label: string;
  x: number;
  y: number;
  classes?: string;
}

export interface CyEdgeDef {
  id: string;
  source: string;
  target: string;
  classes?: string;
}

export interface CyStep {
  nodes: CyNodeDef[];
  edges: CyEdgeDef[];
  description: string;
}
