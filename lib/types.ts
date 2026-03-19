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

export type SortAlgorithm = "bubble" | "selection" | "insertion" | "merge" | "quick" | "heap" | "shell" | "counting" | "radix" | "bucket" | "timsort" | "logos";

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
