"use client";

import { useState } from "react";
import Link from "next/link";
import { RotateCcw, ChevronRight } from "lucide-react";
import { SORTING_ALGORITHMS } from "@/lib/catalog";

// ─── Decision tree data ────────────────────────────────────────────────────

type TreeNode =
  | { type: "question"; text: string; yes: TreeNode; no: TreeNode }
  | { type: "leaf"; algos: string[]; reasoning: string };

function q(text: string, yes: TreeNode, no: TreeNode): TreeNode {
  return { type: "question", text, yes, no };
}

function leaf(algos: string[], reasoning: string): TreeNode {
  return { type: "leaf", algos, reasoning };
}

const TREE: TreeNode = q(
  "Is your data nearly sorted or already partially ordered?",
  // Nearly sorted = Y
  leaf(
    ["Insertion Sort", "Tim Sort"],
    "Insertion sort runs in O(n) on nearly-sorted data and is cache-friendly. Timsort detects natural runs and merges them, making it excellent for real-world nearly-ordered data."
  ),
  // Nearly sorted = N
  q(
    "Do you need a stable sort (preserve equal-element order)?",
    // Stable = Y
    q(
      "Is memory strictly constrained? (need in-place, O(1) space)",
      // Stable = Y, Memory constrained = Y
      leaf(
        ["Insertion Sort", "Merge Sort"],
        "Insertion sort is truly in-place and stable. An in-place merge sort variant is also stable and uses O(1) auxiliary space, though with higher constant factors."
      ),
      // Stable = Y, Memory = N
      q(
        "Are your keys integers in a known bounded range?",
        // Stable = Y, Memory = N, Bounded = Y
        leaf(
          ["Counting Sort", "Radix Sort"],
          "Counting sort runs in O(n+k) when keys are bounded integers — faster than comparison sorts for small k. Radix sort generalises this digit-by-digit for larger ranges."
        ),
        // Stable = Y, Memory = N, Bounded = N
        leaf(
          ["Merge Sort", "Tim Sort"],
          "Merge sort guarantees O(n log n) in all cases and is stable. Timsort (used by Python and Java) is typically faster in practice due to natural-run detection."
        )
      )
    ),
    // Stable = N
    q(
      "Is memory strictly constrained? (need in-place, O(1) space)",
      // Stable = N, Memory = Y
      q(
        "Is n very small (under a few hundred elements)?",
        // Stable = N, Memory = Y, Small n = Y
        leaf(
          ["Insertion Sort", "Selection Sort"],
          "For small arrays, O(n²) algorithms have negligible wall-clock time and minimal overhead. Insertion sort is adaptive; selection sort minimises writes."
        ),
        // Stable = N, Memory = Y, Small n = N
        leaf(
          ["Heap Sort", "Introsort"],
          "Heap sort is in-place and guarantees O(n log n) worst-case. Introsort combines quicksort with heapsort fallback, giving the speed of quicksort without the O(n²) worst case."
        )
      ),
      // Stable = N, Memory = N
      leaf(
        ["Quick Sort", "Introsort"],
        "Quicksort is the fastest comparison sort in practice due to cache efficiency and low constant factors. Introsort adds a heapsort safety net to avoid O(n²) worst-case inputs."
      )
    )
  )
);

// ─── Helpers ──────────────────────────────────────────────────────────────

function getAlgoEntry(name: string) {
  return SORTING_ALGORITHMS.find(
    (a) => a.name.toLowerCase() === name.toLowerCase() ||
           a.name.replace(" ", "").toLowerCase() === name.replace(" ", "").toLowerCase()
  );
}

const QUESTION_LABELS = ["Q1", "Q2", "Q3", "Q4", "Q5"];

// ─── Component ────────────────────────────────────────────────────────────

export default function AlgorithmPicker() {
  // path = array of booleans: true=yes, false=no
  const [path, setPath] = useState<boolean[]>([]);

  // Traverse tree to current node
  let currentNode: TreeNode = TREE;
  for (const answer of path) {
    if (currentNode.type === "leaf") break;
    currentNode = answer ? currentNode.yes : currentNode.no;
  }

  function handleAnswer(yes: boolean) {
    setPath((p) => [...p, yes]);
  }

  function handleStartOver() {
    setPath([]);
  }

  function handleGoTo(idx: number) {
    setPath((p) => p.slice(0, idx));
  }

  // Reconstruct question text for each step in breadcrumb
  function getQuestionAt(stepIdx: number): string {
    let node: TreeNode = TREE;
    for (let i = 0; i < stepIdx; i++) {
      if (node.type === "leaf") break;
      node = path[i] ? node.yes : node.no;
    }
    if (node.type === "question") return node.text;
    return "";
  }

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
        <h1 className="text-base font-bold" style={{ color: "var(--color-text)" }}>
          Algorithm Picker
        </h1>
        {path.length > 0 && (
          <button
            onClick={handleStartOver}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs border"
            style={{ background: "var(--color-surface-2)", borderColor: "var(--color-border)", color: "var(--color-muted)" }}
          >
            <RotateCcw size={11} />
            Start over
          </button>
        )}
      </div>

      {/* Breadcrumb */}
      {path.length > 0 && (
        <nav className="flex flex-wrap items-center gap-1 mb-5 text-xs" aria-label="Decision path">
          {path.map((ans, i) => {
            const qText = getQuestionAt(i);
            return (
              <span key={i} className="flex items-center gap-1">
                <button
                  onClick={() => handleGoTo(i)}
                  className="px-2 py-0.5 rounded hover:underline"
                  style={{ color: "var(--color-accent)", background: "var(--color-accent-muted)" }}
                  title={qText}
                >
                  {QUESTION_LABELS[i] ?? `Q${i + 1}`}: {ans ? "Yes" : "No"}
                </button>
                {i < path.length - 1 && <ChevronRight size={10} style={{ color: "var(--color-muted)" }} />}
              </span>
            );
          })}
        </nav>
      )}

      {/* Current node */}
      {currentNode.type === "question" ? (
        <div
          className="rounded-2xl border p-6 flex flex-col gap-5"
          style={{ background: "var(--color-surface-1)", borderColor: "var(--color-border)" }}
        >
          <p className="text-[10px] uppercase tracking-widest" style={{ color: "var(--color-muted)" }}>
            {QUESTION_LABELS[path.length] ?? `Q${path.length + 1}`} of up to {QUESTION_LABELS.length}
          </p>
          <h2 className="text-lg font-semibold leading-snug" style={{ color: "var(--color-text)" }}>
            {currentNode.text}
          </h2>
          <div className="flex gap-3">
            <button
              onClick={() => handleAnswer(true)}
              className="flex-1 py-3 rounded-xl text-sm font-bold border-2 transition-colors"
              style={{
                background: "var(--color-accent)",
                borderColor: "var(--color-accent)",
                color: "#fff",
              }}
            >
              Yes
            </button>
            <button
              onClick={() => handleAnswer(false)}
              className="flex-1 py-3 rounded-xl text-sm font-bold border-2 transition-colors"
              style={{
                background: "var(--color-surface-2)",
                borderColor: "var(--color-border)",
                color: "var(--color-text)",
              }}
            >
              No
            </button>
          </div>
        </div>
      ) : (
        // Leaf: recommendation
        <div
          className="rounded-2xl border p-6 flex flex-col gap-4"
          style={{ background: "var(--color-surface-1)", borderColor: "var(--color-border)" }}
        >
          <p className="text-[10px] uppercase tracking-widest" style={{ color: "var(--color-accent)" }}>
            Recommendation
          </p>
          <p className="text-xs leading-relaxed" style={{ color: "var(--color-muted)" }}>
            {currentNode.reasoning}
          </p>

          <div className="flex flex-col gap-3">
            {currentNode.algos.map((algoName) => {
              const entry = getAlgoEntry(algoName);
              return (
                <div
                  key={algoName}
                  className="rounded-xl border p-4 flex flex-col gap-2"
                  style={{ background: "var(--color-surface-2)", borderColor: "var(--color-border)" }}
                >
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <h3 className="text-sm font-bold" style={{ color: "var(--color-text)" }}>
                      {algoName}
                    </h3>
                    {entry && (
                      <Link
                        href={entry.path}
                        className="text-[10px] px-2 py-1 rounded font-medium"
                        style={{ background: "var(--color-accent-muted)", color: "var(--color-accent)" }}
                      >
                        View visualizer →
                      </Link>
                    )}
                  </div>
                  {entry && (
                    <div className="flex gap-3 flex-wrap text-xs font-mono" style={{ color: "var(--color-muted)" }}>
                      <span>Time: <span style={{ color: "var(--color-text)" }}>{entry.time}</span></span>
                      <span>Space: <span style={{ color: "var(--color-text)" }}>{entry.space}</span></span>
                      <span>Stable: <span style={{ color: "var(--color-text)" }}>{entry.stable ? "yes" : "no"}</span></span>
                    </div>
                  )}
                  {entry && (
                    <p className="text-xs" style={{ color: "var(--color-muted)" }}>{entry.blurb}</p>
                  )}
                  {!entry && (
                    <p className="text-xs" style={{ color: "var(--color-muted)" }}>{algoName}</p>
                  )}
                </div>
              );
            })}
          </div>

          <button
            onClick={handleStartOver}
            className="mt-2 flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold self-start"
            style={{ background: "var(--color-surface-3)", color: "var(--color-text)" }}
          >
            <RotateCcw size={11} />
            Start over
          </button>
        </div>
      )}
    </div>
  );
}
