"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Lock } from "lucide-react";
import { useLevel } from "@/hooks/useLevel";
import type { Level } from "@/lib/level";

// ─── Types ────────────────────────────────────────────────────────────────────

type Explanation = {
  invariant: string;
  intuition: string;
  proof: string;
  counterexample?: string;
};

type Props = {
  algorithm: string;
  level?: Level;
};

// ─── Explanation data ─────────────────────────────────────────────────────────

const EXPLANATIONS: Record<string, Explanation> = {
  bubble: {
    invariant:
      "After pass i, the i largest elements occupy their final sorted positions at the end of the array.",
    intuition:
      "Each pass scans the unsorted prefix and 'bubbles' the largest remaining element to its correct position by repeatedly swapping adjacent out-of-order pairs. Because each pass reduces the unsorted region by one, after n-1 passes every element is in place.",
    proof:
      "Claim: after pass k (0-indexed), arr[n-k-1..n-1] is sorted and contains the k+1 largest elements. Base: pass 0 puts arr[n-1] = max. Inductive step: pass k+1 operates only on arr[0..n-k-2]; by the inner loop, arr[n-k-2] = max of that sub-array, and arr[n-k-2..n-1] is sorted by IH.",
    counterexample:
      "If you never swap adjacent elements (e.g. you compare non-adjacent), the invariant breaks — larger elements can skip over their correct positions and the array may not be fully sorted.",
  },
  selection: {
    invariant:
      "After i iterations, the first i positions contain the i smallest elements in sorted order, and they will never move again.",
    intuition:
      "Each pass finds the minimum of the unsorted suffix and swaps it to the front of that suffix. The sorted prefix grows by one each round, and because we always place the true minimum next, the prefix is always correct.",
    proof:
      "Invariant: arr[0..i-1] = sorted i smallest. Base: trivially true for i=0. Step: in pass i we find m = min(arr[i..n-1]) and swap arr[i]↔arr[m]. Since arr[0..i-1] holds the i smallest and m is the smallest of the rest, arr[0..i] holds the i+1 smallest in sorted order.",
    counterexample:
      "If you stop after k < n-1 iterations, the remaining n-k elements are unsorted even though elements 0..k-1 are correct.",
  },
  insertion: {
    invariant:
      "After processing element i, the sub-array arr[0..i] is sorted (but does not yet contain the i globally smallest elements — just the first i+1 elements of the input in sorted order).",
    intuition:
      "Think of sorting a hand of playing cards: you pick up each new card and slide it left until it's in the right place among the cards already sorted. The left portion is always a sorted copy of everything seen so far.",
    proof:
      "Invariant: arr[0..i] is sorted. Base: i=0, trivially sorted. Step: given arr[0..i] sorted, we take key=arr[i+1] and shift all arr[j] > key one step right. The resulting gap is exactly where key belongs to maintain sorted order, so arr[0..i+1] is sorted.",
    counterexample:
      "If you stop the inner shift loop too early (e.g. wrong comparison direction), key may land in the wrong spot, breaking the sorted-prefix invariant for all subsequent insertions.",
  },
  merge: {
    invariant:
      "merge(L, R) produces a sorted array containing exactly the elements of L and R, given that L and R are each already sorted.",
    intuition:
      "Divide the array in half recursively until you reach single-element sub-arrays (trivially sorted). Then merge pairs of sorted halves bottom-up: at each merge step you always pick the smaller of the two front elements, guaranteeing the output is sorted.",
    proof:
      "Correctness of merge: by induction on |L|+|R|. If either is empty the result is the other (sorted). Otherwise compare fronts: prepend the smaller, then merge the remaining. By IH the tail is sorted, and prepending the minimum maintains sorted order. Correctness of merge_sort follows by structural induction on array length.",
    counterexample:
      "If you merge without comparing (e.g. just concatenate), the output is not sorted even if L and R are. The comparison step is essential to interleave the two sorted sequences correctly.",
  },
  quick: {
    invariant:
      "After partitioning around pivot p, every element to p's left is ≤ p and every element to p's right is ≥ p. Pivot p is in its final sorted position.",
    intuition:
      "Choose a pivot, rearrange so that smaller elements are on the left and larger on the right, then recurse on each side independently. The pivot never needs to move again — each recursive call works only within its own sub-array.",
    proof:
      "Partition correctness (Lomuto): maintain i = last index where arr ≤ pivot. For each j, if arr[j] ≤ pivot, swap arr[j] with arr[i+1] and increment i. After the loop arr[0..i] ≤ pivot < arr[i+2..n-1], so swapping pivot to i+1 puts it in its final position. Recursion on independent partitions gives the full sort by induction.",
    counterexample:
      "If the partition step is incorrect and the pivot ends up in a position where elements on one side are not all ≤ or ≥ pivot, then the recursive sub-problems receive corrupted input and the result is unsorted.",
  },
  heap: {
    invariant:
      "During extraction phase, arr[0..k-1] is a valid max-heap and arr[k..n-1] is sorted in ascending order, with all elements in arr[k..n-1] being ≥ all elements in arr[0..k-1].",
    intuition:
      "First build a max-heap so the largest element is always at the root. Then repeatedly swap the root (maximum) with the last heap element, shrink the heap boundary by one, and sift the new root down to restore the heap property. This extracts elements in decreasing order into the sorted suffix.",
    proof:
      "Heapify (sift-down) maintains the heap property by comparing a node with its children and swapping with the larger child if needed, repeating until no violation remains. Build-heap is correct because heapifying from the bottom up ensures every subtree satisfies the heap property before its parent is processed.",
    counterexample:
      "If you skip the heapify step after swapping in the extraction phase, the new root may not be the maximum of the remaining heap, so the next extraction could return the wrong element.",
  },
  "binary-search": {
    invariant:
      "At every step, if the target exists in arr, it lies within arr[lo..hi].",
    intuition:
      "Because the array is sorted, comparing arr[mid] with the target immediately tells you which half to discard. Each iteration halves the search space, so the answer (or confirmation of absence) is found in O(log n) steps.",
    proof:
      "Invariant: target ∈ arr[lo..hi] or target is absent. If arr[mid] == target, done. If arr[mid] < target, all of arr[lo..mid] are too small so set lo = mid+1, preserving the invariant. Symmetrically for arr[mid] > target. When lo > hi the search space is empty, confirming absence. Termination: hi-lo strictly decreases each iteration.",
    counterexample:
      "If the array is not sorted, the invariant fails immediately: discarding the left half because arr[mid] < target is invalid because a smaller target could exist anywhere in the left half.",
  },
  bfs: {
    invariant:
      "Every node at distance d from source is discovered before any node at distance d+1. When a node is dequeued its shortest-path distance is finalized.",
    intuition:
      "Using a FIFO queue ensures you process all neighbors of the start before their neighbors, and so on layer by layer. This layer-by-layer expansion means the first time you reach a node is always via the fewest edges.",
    proof:
      "By induction on distance d: base d=0 (source) is enqueued first. Nodes at distance d are enqueued only when their parent at distance d-1 is dequeued. Because the queue is FIFO, all distance-d nodes are dequeued before any distance-(d+1) node is dequeued. So the first time a node is discovered, it is reached via a shortest path.",
    counterexample:
      "Using a LIFO stack instead of a queue gives DFS, which does not guarantee shortest paths — you may reach a node via a longer path before the shortest one is explored.",
  },
  dfs: {
    invariant:
      "When DFS visits a node, all nodes reachable only through that node (in the DFS tree) will be fully explored before DFS returns to the node's parent.",
    intuition:
      "DFS dives as deep as possible along one path before backtracking. The call stack naturally models the current path from source to the current node. Every node is visited exactly once, ensuring O(V+E) time.",
    proof:
      "By the DFS white/gray/black coloring argument: a node is gray (on stack) while its sub-tree is being explored. It becomes black only after all descendants are black. This guarantees the DFS tree captures all reachable nodes and the parenthesis theorem holds for start/finish timestamps.",
    counterexample:
      "Without a visited set, DFS can loop forever on graphs with cycles, never terminating.",
  },
  dijkstra: {
    invariant:
      "When a node u is extracted from the priority queue, dist[u] is the true shortest-path distance from the source to u.",
    intuition:
      "Dijkstra greedily finalizes the nearest unvisited node at each step. Because all edge weights are non-negative, the shortest path to the extracted node can never be improved later by going through a farther node first.",
    proof:
      "Suppose u is extracted with dist[u] = d and there exists a shorter path. That path must at some point leave the settled set through some node w. But dist[w] ≥ dist[u] = d (w was not extracted before u), and since all weights are ≥ 0, any path through w has distance ≥ dist[w] ≥ d. Contradiction.",
    counterexample:
      "With negative edge weights the greedy argument fails: settling u early is wrong because a negative edge encountered later could produce a shorter path to u. This is why Bellman-Ford is needed for negative weights.",
  },
  lcs: {
    invariant:
      "dp[i][j] = length of the Longest Common Subsequence of the first i characters of s1 and first j characters of s2.",
    intuition:
      "Either the last characters match (contributing +1 to the LCS), or they don't (take the best of excluding one character from either string). Build the table bottom-up so each sub-problem is solved once.",
    proof:
      "Optimal substructure: if s1[i]==s2[j], LCS(i,j) = 1+LCS(i-1,j-1) because any common subsequence including both last chars reduces to matching the prefixes. If s1[i]!=s2[j], LCS(i,j) = max(LCS(i-1,j), LCS(i,j-1)) because the last char of at least one string is not in the LCS.",
    counterexample:
      "A greedy approach (always match the earliest common character) fails: for s1='ABCBDAB' and s2='BDCABA' a greedy strategy may miss a longer valid subsequence found via DP.",
  },
  "edit-distance": {
    invariant:
      "dp[i][j] = minimum number of single-character edits (insert, delete, replace) to transform s1[0..i-1] into s2[0..j-1].",
    intuition:
      "If the last characters match, no operation is needed and the cost is dp[i-1][j-1]. Otherwise consider all three operations: delete from s1, insert into s1 (= delete from s2), or replace — and take the minimum.",
    proof:
      "Optimal substructure: any edit sequence between prefixes corresponds to a valid edit sequence for subproblems. Replacing s1[i] with s2[j] reduces to editing s1[0..i-1]→s2[0..j-1]. Deleting s1[i] reduces to s1[0..i-1]→s2[0..j]. Inserting s2[j] reduces to s1[0..i]→s2[0..j-1]. Taking the min over these choices is correct by induction.",
    counterexample:
      "Without all three operations the recurrence is incomplete — for example, omitting 'replace' forces two operations (delete + insert) where one suffices, yielding a suboptimal solution.",
  },
};

// ─── Lock guard helper ────────────────────────────────────────────────────────

function LevelLock({ requiredLevel }: { requiredLevel: Level }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "8px 12px",
        borderRadius: 8,
        background: "var(--color-surface-2)",
        border: "1px solid var(--color-border)",
        color: "var(--color-muted)",
        fontSize: 12,
      }}
    >
      <Lock size={12} />
      <span>
        Unlock at{" "}
        <strong style={{ textTransform: "capitalize" }}>{requiredLevel}</strong>{" "}
        level
      </span>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function WhyItWorks({ algorithm }: Props) {
  const [open, setOpen] = useState(false);
  const { level, has } = useLevel();

  const data = EXPLANATIONS[algorithm];
  if (!data) return null;

  const showProof        = has("advanced");
  const showCounterexamp = has("intermediate");

  return (
    <div
      style={{
        borderRadius: 12,
        border: "1px solid var(--color-border)",
        background: "var(--color-surface-1)",
        overflow: "hidden",
      }}
    >
      {/* Header / toggle */}
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 16px",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          color: "var(--color-text)",
          fontWeight: 600,
          fontSize: 13,
          textAlign: "left",
        }}
      >
        <span>Why does this work?</span>
        {open ? (
          <ChevronUp size={16} style={{ color: "var(--color-muted)" }} />
        ) : (
          <ChevronDown size={16} style={{ color: "var(--color-muted)" }} />
        )}
      </button>

      {/* Expanded content */}
      {open && (
        <div
          style={{
            padding: "0 16px 16px",
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          {/* Invariant callout */}
          <div
            style={{
              padding: "12px 14px",
              borderRadius: 8,
              background: "var(--color-accent-muted)",
              borderLeft: "3px solid var(--color-accent)",
            }}
          >
            <p
              style={{
                fontSize: 11,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.07em",
                color: "var(--color-accent)",
                marginBottom: 6,
              }}
            >
              Key Invariant
            </p>
            <p
              style={{
                fontSize: 13,
                color: "var(--color-text)",
                lineHeight: 1.55,
              }}
            >
              {data.invariant}
            </p>
          </div>

          {/* Intuition */}
          <div>
            <p
              style={{
                fontSize: 11,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.07em",
                color: "var(--color-muted)",
                marginBottom: 6,
              }}
            >
              Intuition
            </p>
            <p
              style={{
                fontSize: 13,
                color: "var(--color-text)",
                lineHeight: 1.6,
              }}
            >
              {data.intuition}
            </p>
          </div>

          {/* Proof sketch — advanced+ */}
          <div>
            <p
              style={{
                fontSize: 11,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.07em",
                color: "var(--color-muted)",
                marginBottom: 6,
              }}
            >
              Proof Sketch
            </p>
            {showProof ? (
              <p
                style={{
                  fontSize: 12,
                  color: "var(--color-text)",
                  lineHeight: 1.6,
                  fontFamily: "var(--font-mono)",
                }}
              >
                {data.proof}
              </p>
            ) : (
              <LevelLock requiredLevel="advanced" />
            )}
          </div>

          {/* Counterexample — intermediate+ */}
          {data.counterexample && (
            <div>
              <p
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.07em",
                  color: "var(--color-muted)",
                  marginBottom: 6,
                }}
              >
                If Violated
              </p>
              {showCounterexamp ? (
                <div
                  style={{
                    padding: "10px 14px",
                    borderRadius: 8,
                    background: "rgba(176,48,32,0.07)",
                    borderLeft: "3px solid var(--color-state-swap)",
                    fontSize: 13,
                    color: "var(--color-text)",
                    lineHeight: 1.55,
                  }}
                >
                  {data.counterexample}
                </div>
              ) : (
                <LevelLock requiredLevel="intermediate" />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
