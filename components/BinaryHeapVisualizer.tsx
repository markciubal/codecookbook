"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import CytoscapeBase, { type CytoscapeBaseHandle } from "./CytoscapeBase";
import CodePanel from "./CodePanel";
import CodeModal from "./CodeModal";
import PanelModal from "./PanelModal";
import { Info, Triangle } from "lucide-react";

const MAX_SIZE      = 15;
const NODE_D        = 52;
const LEVEL_HEIGHT  = 90;
const LEVEL_WIDTH_BASE = 520;

const STYLESHEET = [
  {
    selector: "node",
    style: {
      shape: "ellipse",
      width: NODE_D,
      height: NODE_D,
      "background-color": "#3a3a52",
      "border-width": 2,
      "border-color": "#2e2e44",
      label: "data(label)",
      color: "#e2e2f0",
      "font-family": "monospace",
      "font-size": "14px",
      "font-weight": "bold",
      "text-valign": "center",
      "text-halign": "center",
    },
  },
  { selector: "node.root",      style: { "background-color": "#7c6af7", "border-color": "#7c6af7" } },
  { selector: "node.new",       style: { "background-color": "#22c55e", "border-color": "#22c55e" } },
  { selector: "node.swapping",  style: { "background-color": "#ef4444", "border-color": "#ef4444" } },
  { selector: "node.comparing", style: { "background-color": "#f59e0b", "border-color": "#f59e0b" } },
  {
    selector: "edge",
    style: {
      width: 2,
      "line-color": "#4a4a6a",
      "curve-style": "bezier",
      "target-arrow-shape": "none",
    },
  },
];

function getTreePosition(idx: number): { x: number; y: number } {
  if (idx === 0) return { x: 0, y: 0 };
  const level      = Math.floor(Math.log2(idx + 1));
  const levelStart = (1 << level) - 1;
  const posInLevel = idx - levelStart;
  const totalInLevel = 1 << level;
  const spacing    = LEVEL_WIDTH_BASE / totalInLevel;
  const x          = (posInLevel + 0.5) * spacing - LEVEL_WIDTH_BASE / 2;
  const y          = level * LEVEL_HEIGHT;
  return { x, y };
}

function renderHeap(
  cy: ReturnType<CytoscapeBaseHandle["cy"]>,
  heap: number[],
  highlightMap: Record<number, string> = {}
) {
  if (!cy) return;
  cy.batch(() => {
    cy.elements().remove();
    heap.forEach((val, idx) => {
      const pos = getTreePosition(idx);
      const cls = highlightMap[idx] ?? (idx === 0 && heap.length > 0 ? "root" : "");
      cy.add({
        group: "nodes",
        data: { id: `h${idx}`, label: String(val) },
        position: pos,
        classes: cls,
      });
      if (idx > 0) {
        const parent = Math.floor((idx - 1) / 2);
        cy.add({
          group: "edges",
          data: { id: `e${idx}`, source: `h${parent}`, target: `h${idx}` },
        });
      }
    });
    cy.fit(undefined, 30);
  });
}

// ── Pure heap operations ──────────────────────────────────────────────────────

type HeapMode = "min" | "max";

interface AnimStep {
  heap: number[];
  desc: string;
  highlight: Record<number, string>;
  // Heap-sort visualization: each step can carry a parallel "sorted output"
  // array that the user sees building up as roots get extracted.
  sortedOutput?: number[];
}

/**
 * For a min-heap, a parent must be `<=` both children (so we sift up when
 * `parent > child`). For a max-heap, flip the comparison. Returns true when
 * `parent` IS violating the heap property relative to `child` (so we should
 * swap parent and child).
 */
function violates(mode: HeapMode, parentVal: number, childVal: number): boolean {
  return mode === "min" ? parentVal > childVal : parentVal < childVal;
}

/** Picks the "extreme" of three values for sift-down: the smallest for min,
 *  the largest for max. Returns the index of that extreme. */
function pickExtreme(mode: HeapMode, h: number[], a: number, b: number): number {
  if (mode === "min") return h[a] < h[b] ? a : b;
  return h[a] > h[b] ? a : b;
}

function heapInsert(heap: number[], val: number, mode: HeapMode): { heap: number[]; steps: AnimStep[] } {
  const h = [...heap, val];
  const steps: AnimStep[] = [];
  let i = h.length - 1;
  const cmpOp = mode === "min" ? ">" : "<";
  const okOp  = mode === "min" ? "≥" : "≤";
  while (i > 0) {
    const parent = Math.floor((i - 1) / 2);
    if (violates(mode, h[parent], h[i])) {
      steps.push({
        heap: [...h],
        desc: `${h[parent]} ${cmpOp} ${h[i]}: swap with parent`,
        highlight: { [i]: "comparing", [parent]: "comparing" },
      });
      [h[i], h[parent]] = [h[parent], h[i]];
      i = parent;
      steps.push({
        heap: [...h],
        desc: `Swapped — percolating up`,
        highlight: { [i]: "swapping" },
      });
    } else {
      steps.push({
        heap: [...h],
        desc: `${h[i]} ${okOp} parent ${h[parent]}: heap property satisfied`,
        highlight: { [i]: "new" },
      });
      break;
    }
  }
  return { heap: h, steps };
}

/**
 * Extracts the root from the heap. For min-heap that's the smallest value,
 * for max-heap the largest. Returns the new heap (root removed, last leaf
 * promoted and sifted down) plus animation steps.
 */
function heapExtractRoot(heap: number[], mode: HeapMode): { heap: number[]; steps: AnimStep[]; extracted: number | null } {
  if (heap.length === 0) return { heap: [], steps: [], extracted: null };
  const h = [...heap];
  const steps: AnimStep[] = [];
  const extracted = h[0];
  const rootLabel = mode === "min" ? "min" : "max";
  steps.push({ heap: [...h], desc: `Extracting ${rootLabel}: ${extracted}`, highlight: { [0]: "swapping" } });
  h[0] = h[h.length - 1];
  h.pop();
  if (h.length === 0) return { heap: h, steps, extracted };

  let i = 0;
  while (true) {
    const l = 2 * i + 1;
    const r = 2 * i + 2;
    let pick = i;
    if (l < h.length && violates(mode, h[pick], h[l])) pick = l;
    if (r < h.length && violates(mode, h[pick], h[r])) pick = r;
    if (pick === i) {
      steps.push({ heap: [...h], desc: "Heap property restored", highlight: { [i]: "root" } });
      break;
    }
    steps.push({
      heap: [...h],
      desc: `Sifting down: swapping ${h[i]} with ${h[pick]}`,
      highlight: { [i]: "comparing", [pick]: "comparing" },
    });
    [h[i], h[pick]] = [h[pick], h[i]];
    steps.push({ heap: [...h], desc: `Swapped`, highlight: { [i]: "swapping" } });
    i = pick;
  }
  return { heap: h, steps, extracted };
}

function buildHeap(arr: number[], mode: HeapMode): number[] {
  const h = [...arr];
  for (let i = Math.floor(h.length / 2) - 1; i >= 0; i--) {
    let idx = i;
    while (true) {
      const l  = 2 * idx + 1;
      const r  = 2 * idx + 2;
      let pick = idx;
      if (l < h.length && violates(mode, h[pick], h[l])) pick = l;
      if (r < h.length && violates(mode, h[pick], h[r])) pick = r;
      if (pick === idx) break;
      [h[idx], h[pick]] = [h[pick], h[idx]];
      idx = pick;
    }
  }
  return h;
}

/**
 * Full heap-sort animation: repeatedly extract the root, accumulating each
 * extracted value into a separate `sortedOutput` array that the visualizer
 * renders alongside the shrinking heap. For min-heap the result is sorted
 * ascending; for max-heap, descending.
 *
 * Returns the empty final heap, the sorted array, and the merged step list
 * (each extract pass's steps with sortedOutput stamped on every one).
 */
function heapSortSteps(heap: number[], mode: HeapMode): { sorted: number[]; steps: AnimStep[] } {
  const sorted: number[] = [];
  const steps: AnimStep[] = [];
  let working = [...heap];
  // Tag every step with the current `sortedOutput` so the side panel can
  // visibly grow as roots are pulled out.
  steps.push({
    heap: [...working],
    desc: `Heap sort begins: ${mode === "min" ? "ascending" : "descending"} (extract ${mode === "min" ? "min" : "max"}, repeat)`,
    highlight: { [0]: "root" },
    sortedOutput: [...sorted],
  });
  while (working.length > 0) {
    const { heap: next, steps: extractSteps, extracted } = heapExtractRoot(working, mode);
    for (const s of extractSteps) {
      steps.push({ ...s, sortedOutput: [...sorted] });
    }
    if (extracted !== null) sorted.push(extracted);
    // Post-extraction step showing the value moving into the sorted output.
    steps.push({
      heap: [...next],
      desc: `Appended ${extracted} to sorted output`,
      highlight: next.length > 0 ? { [0]: "root" } : {},
      sortedOutput: [...sorted],
    });
    working = next;
  }
  steps.push({
    heap: [],
    desc: `Heap sort complete — ${sorted.length} values in ${mode === "min" ? "ascending" : "descending"} order`,
    highlight: {},
    sortedOutput: [...sorted],
  });
  return { sorted, steps };
}

// ── Interface ────────────────────────────────────────────────────────────────

interface CtxMenu { x: number; y: number; idx: number }

export default function BinaryHeapVisualizer() {
  const [heapMode, setHeapMode]   = useState<HeapMode>("min");
  const [heap, setHeap]           = useState<number[]>(() => buildHeap([3, 8, 5, 15, 10, 12, 7], "min"));
  const [inputVal, setInputVal]   = useState("");
  const [log, setLog]             = useState<string[]>(["Heap initialized"]);
  const [error, setError]         = useState<string | null>(null);
  const [panelTab, setPanelTab]   = useState<"info" | "code">("info");
  const [ctxMenu, setCtxMenu]     = useState<CtxMenu | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [activeMethod, setActiveMethod] = useState<string | null>(null);

  // Sorted output of the most recent heap-sort run. Displayed below the tree
  // while a sort is in progress and afterwards as a "result" strip.
  const [sortedOutput, setSortedOutput] = useState<number[]>([]);

  const [animSteps, setAnimSteps]   = useState<AnimStep[]>([]);
  const [animIdx, setAnimIdx]       = useState(-1);
  const [isAnimating, setIsAnimating] = useState(false);

  const rootLabel = heapMode === "min" ? "Min" : "Max";

  const cyHandle = useRef<CytoscapeBaseHandle>(null);

  const addLog = (msg: string) => setLog((p) => [msg, ...p].slice(0, 20));

  // ── Render effect ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (isAnimating) return; // animation loop controls rendering during animation
    const t = setTimeout(() => {
      const cy = cyHandle.current?.cy() ?? null;
      renderHeap(cy, heap);

      if (cy) {
        cy.off("cxttap");
        cy.on("cxttap", "node", (evt) => {
          const nodeId = evt.target.id() as string;
          if (!nodeId.startsWith("h")) return;
          const idx = parseInt(nodeId.slice(1), 10);
          const oe  = evt.originalEvent as MouseEvent;
          setCtxMenu({ x: oe.clientX, y: oe.clientY, idx });
        });
      }
    }, 80);
    return () => clearTimeout(t);
  }, [heap, isAnimating]);

  // ── Animation step effect ─────────────────────────────────────────────────
  useEffect(() => {
    if (!isAnimating || animIdx < 0 || animIdx >= animSteps.length) {
      if (isAnimating && animIdx >= animSteps.length) {
        setIsAnimating(false);
      }
      return;
    }
    const step = animSteps[animIdx];
    const cy   = cyHandle.current?.cy() ?? null;
    if (cy) renderHeap(cy, step.heap, step.highlight);

    const t = setTimeout(() => setAnimIdx((i) => i + 1), 500);
    return () => clearTimeout(t);
  }, [animIdx, isAnimating, animSteps]);

  // ── Dismiss context menu ──────────────────────────────────────────────────
  useEffect(() => {
    if (!ctxMenu) return;
    const handler = () => setCtxMenu(null);
    window.addEventListener("click", handler);
    return () => window.removeEventListener("click", handler);
  }, [ctxMenu]);

  const triggerMethod = (name: string) => {
    setActiveMethod(name);
    setTimeout(() => setActiveMethod(null), 1800);
  };

  const parseInput = useCallback((): number | null => {
    const v = parseInt(inputVal, 10);
    if (isNaN(v)) { setError("Enter a valid integer"); return null; }
    setError(null);
    return v;
  }, [inputVal]);

  const playAnimation = (
    steps: AnimStep[],
    finalHeap: number[],
    opts?: { finalSortedOutput?: number[] }
  ) => {
    const tail: AnimStep = {
      heap: finalHeap,
      desc: "Done",
      highlight: finalHeap.length > 0 ? { [0]: "root" } : {},
      sortedOutput: opts?.finalSortedOutput,
    };
    setAnimSteps([...steps, tail]);
    setAnimIdx(0);
    setIsAnimating(true);
    setTimeout(() => setHeap(finalHeap), steps.length * 500 + 100);
  };

  // While the animation plays, mirror each step's `sortedOutput` into local
  // state so the strip under the heap grows in lock-step with the cytoscape.
  useEffect(() => {
    if (!isAnimating || animIdx < 0 || animIdx >= animSteps.length) return;
    const so = animSteps[animIdx]?.sortedOutput;
    if (so) setSortedOutput(so);
  }, [animIdx, isAnimating, animSteps]);

  // ── Operations ────────────────────────────────────────────────────────────

  const insert = () => {
    const v = parseInput();
    if (v === null) return;
    if (heap.length >= MAX_SIZE) { setError(`Max size ${MAX_SIZE} reached`); return; }
    setError(null);
    setInputVal("");
    triggerMethod("insert");
    setSortedOutput([]);
    const { heap: newHeap, steps } = heapInsert(heap, v, heapMode);
    addLog(`insert(${v}) → heap size: ${newHeap.length}, ${heapMode}: ${newHeap[0]}`);
    if (steps.length === 0) {
      setHeap(newHeap);
    } else {
      playAnimation(steps, newHeap);
    }
  };

  const extractRoot = () => {
    if (heap.length === 0) { setError("Heap is empty"); return; }
    setError(null);
    triggerMethod(heapMode === "min" ? "extractMin" : "extractMax");
    setSortedOutput([]);
    const root = heap[0];
    const { heap: newHeap, steps } = heapExtractRoot(heap, heapMode);
    addLog(`extract${rootLabel}() → ${root}, new ${heapMode}: ${newHeap.length > 0 ? newHeap[0] : "—"}`);
    if (steps.length === 0) {
      setHeap(newHeap);
    } else {
      playAnimation(steps, newHeap);
    }
  };

  const peekRoot = () => {
    if (heap.length === 0) { setError("Heap is empty"); return; }
    setError(null);
    triggerMethod(heapMode === "min" ? "peekMin" : "peekMax");
    addLog(`peek${rootLabel}() → ${heap[0]} (root)`);
  };

  const heapifyRandom = () => {
    const arr = Array.from({ length: 7 }, () => Math.floor(Math.random() * 99) + 1);
    const h   = buildHeap(arr, heapMode);
    setSortedOutput([]);
    setHeap(h);
    addLog(`Heapified random array: ${heapMode} = ${h[0]}`);
    setError(null);
  };

  const clear = () => {
    setHeap([]);
    setSortedOutput([]);
    addLog("Heap cleared");
    setError(null);
  };

  const sort = () => {
    if (heap.length === 0) { setError("Heap is empty — nothing to sort"); return; }
    setError(null);
    triggerMethod("heapSort");
    const { sorted, steps } = heapSortSteps(heap, heapMode);
    setSortedOutput([]);
    addLog(`heapSort() → ${sorted.length} values (${heapMode === "min" ? "ascending" : "descending"})`);
    playAnimation(steps, [], { finalSortedOutput: sorted });
  };

  // Swap modes — rebuild the heap so the property holds under the new ordering.
  const toggleMode = () => {
    const next: HeapMode = heapMode === "min" ? "max" : "min";
    setHeapMode(next);
    if (heap.length > 0) {
      const rebuilt = buildHeap(heap, next);
      setHeap(rebuilt);
      addLog(`Switched to ${next === "min" ? "Min" : "Max"}-Heap — re-heapified (root = ${rebuilt[0]})`);
    } else {
      addLog(`Switched to ${next === "min" ? "Min" : "Max"}-Heap`);
    }
    setSortedOutput([]);
  };

  // Context menu actions
  const ctxPeekAt = (idx: number) => {
    addLog(`peek at index ${idx} → ${heap[idx]}`);
    setCtxMenu(null);
  };

  const ctxDeleteAt = (idx: number) => {
    const val  = heap[idx];
    const next = heap.filter((_, i) => i !== idx);
    const h    = buildHeap(next, heapMode);
    setHeap(h);
    addLog(`deleted index ${idx} (value: ${val}), re-heapified`);
    setCtxMenu(null);
  };

  return (
    <div className="flex flex-col min-h-dvh" style={{ background: "var(--color-bg)" }}>
      {/* Header */}
      <div className="px-5 pt-6 pb-4" style={{ borderBottom: "1px solid var(--color-border)" }}>
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <Triangle
            size={20}
            style={{
              color: "var(--color-accent)",
              flexShrink: 0,
              // Visually flip the triangle to mirror the heap orientation —
              // base-down for max-heap (largest at apex), apex-up for min-heap.
              transform: heapMode === "max" ? "rotate(180deg)" : "none",
              transition: "transform 0.2s",
            }}
            strokeWidth={1.75}
          />
          <h1 className="text-2xl font-bold">Binary Heap</h1>
          <button
            onClick={toggleMode}
            disabled={isAnimating}
            title="Toggle Min / Max heap"
            className="text-xs font-mono px-2 py-0.5 rounded-full transition-colors"
            style={{
              background: "rgba(167,139,250,0.15)",
              color: "#a78bfa",
              border: "1px solid rgba(167,139,250,0.4)",
              cursor: isAnimating ? "not-allowed" : "pointer",
              opacity: isAnimating ? 0.5 : 1,
            }}
          >
            {heapMode === "min" ? "Min-Heap" : "Max-Heap"} ⇄
          </button>
          <Pill text="O(log n)" />
          <div className="ml-auto flex gap-2">
            <button
              onClick={() => setIsPanelOpen((p) => !p)}
              title="Info"
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-mono transition-colors"
              style={{
                background: isPanelOpen ? "var(--color-accent)" : "var(--color-surface-3)",
                border: "1px solid var(--color-border)",
                color: isPanelOpen ? "#fff" : "var(--color-muted)",
                cursor: "pointer",
              }}
            >
              <Info size={13} strokeWidth={1.75} /> Info
            </button>
            <button
              onClick={() => setIsModalOpen(true)}
              title="View Code"
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-mono transition-colors"
              style={{
                background: isModalOpen ? "var(--color-accent)" : "var(--color-surface-3)",
                border: "1px solid var(--color-border)",
                color: isModalOpen ? "#fff" : "var(--color-accent)",
                cursor: "pointer",
              }}
            >
              {"</>"}
            </button>
          </div>
        </div>
        <p className="text-sm" style={{ color: "var(--color-muted)" }}>
          Complete binary tree satisfying the {heapMode}-heap property: every parent is {heapMode === "min" ? "smaller" : "larger"} than its children. Insert and extract-{heapMode === "min" ? "min" : "max"} both run in O(log n). Heap-sort yields a fully ordered output in O(n log n). Right-click any node for quick actions.
        </p>
      </div>

      <div className="flex flex-col flex-1">
        <div className="flex-1 px-5 pt-5 pb-4 flex flex-col gap-4">
          {/* Stats */}
          <div className="flex flex-wrap gap-6">
            <DStat label="Size"      value={heap.length} />
            <DStat label={`${rootLabel} (Root)`} value={heap.length > 0 ? heap[0] : "—"} color="var(--color-accent)" />
            <DStat label="Max Nodes" value={MAX_SIZE} color="var(--color-muted)" />
            <DStat label="Sorted Out" value={sortedOutput.length || "—"} color="var(--color-state-sorted)" />
          </div>

          {/* Tree */}
          <CytoscapeBase ref={cyHandle} stylesheet={STYLESHEET} style={{ height: 340 }} />

          {/* Array view */}
          <div>
            <div className="text-xs mb-1" style={{ color: "var(--color-muted)" }}>
              Heap Array (index 0 = {heapMode})
            </div>
            <div className="flex flex-wrap gap-1">
              {heap.map((val, i) => (
                <div
                  key={i}
                  className="px-2 py-1 rounded text-xs font-mono"
                  style={{
                    background: "var(--color-surface-2)",
                    border: "1px solid var(--color-border)",
                    color: i === 0 ? "var(--color-accent)" : "var(--color-text)",
                  }}
                >
                  [{i}]={val}
                </div>
              ))}
              {heap.length === 0 && (
                <span style={{ color: "var(--color-muted)" }} className="text-xs">empty</span>
              )}
            </div>
          </div>

          {/* Sorted output — shown only when a heap-sort has produced (or is
              producing) results. Grows in lock-step with the animation. */}
          {sortedOutput.length > 0 && (
            <div>
              <div className="text-xs mb-1 flex items-center gap-2">
                <span style={{ color: "var(--color-muted)" }}>
                  Sorted Output ({heapMode === "min" ? "ascending" : "descending"})
                </span>
                <span
                  className="px-1.5 py-0.5 rounded font-mono"
                  style={{
                    background: "rgba(34,197,94,0.12)",
                    color: "var(--color-state-sorted)",
                    fontSize: 10,
                  }}
                >
                  n={sortedOutput.length}
                </span>
              </div>
              <div className="flex flex-wrap gap-1">
                {sortedOutput.map((val, i) => (
                  <div
                    key={i}
                    className="px-2 py-1 rounded text-xs font-mono"
                    style={{
                      background: "rgba(34,197,94,0.08)",
                      border: "1px solid rgba(34,197,94,0.35)",
                      color: "var(--color-state-sorted)",
                    }}
                  >
                    {val}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Controls */}
          <div className="flex flex-wrap gap-2 items-center">
            <input
              type="number" value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && insert()}
              placeholder="Value"
              className="rounded-lg px-3 py-2 text-sm w-28 outline-none"
              style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)", color: "var(--color-text)" }}
            />
            <DBtn onClick={insert} primary disabled={isAnimating}>Insert</DBtn>
            <DBtn onClick={extractRoot} disabled={isAnimating}>Extract {rootLabel}</DBtn>
            <DBtn onClick={peekRoot} disabled={isAnimating}>Peek {rootLabel}</DBtn>
            <DBtn onClick={sort} disabled={isAnimating || heap.length === 0}>
              Sort ({heapMode === "min" ? "asc" : "desc"})
            </DBtn>
            <DBtn onClick={heapifyRandom} disabled={isAnimating}>Heapify Random</DBtn>
            <DBtn onClick={clear} disabled={isAnimating}>Clear</DBtn>
          </div>

          {/* Animation status */}
          {isAnimating && (
            <div className="text-xs" style={{ color: "var(--color-accent)" }}>
              {animSteps[animIdx]?.desc ?? "Animating..."}
            </div>
          )}

          {error && (
            <div className="rounded-lg px-4 py-2 text-sm"
              style={{ background: "rgba(239,68,68,0.12)", color: "var(--color-state-swap)" }}>
              {error}
            </div>
          )}
        </div>
      </div>

      {/* Context menu */}
      {ctxMenu && (
        <ContextMenu x={ctxMenu.x} y={ctxMenu.y}>
          <CtxItem onClick={() => ctxPeekAt(ctxMenu.idx)}>
            Peek value ({heap[ctxMenu.idx]})
          </CtxItem>
          <CtxItem danger onClick={() => ctxDeleteAt(ctxMenu.idx)}>
            Delete node
          </CtxItem>
        </ContextMenu>
      )}

      <PanelModal isOpen={isPanelOpen} onClose={() => setIsPanelOpen(false)} title={`Binary ${rootLabel}-Heap Info`}>
        <SidePanel tab={panelTab} setTab={setPanelTab} heap={heap} log={log} mode={heapMode} />
      </PanelModal>

      <CodeModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        algorithmId="binary-heap"
        activeMethod={activeMethod}
      />
    </div>
  );
}

function SidePanel({ tab, setTab, heap, log, mode }: {
  tab: "info" | "code"; setTab: (t: "info" | "code") => void;
  heap: number[]; log: string[]; mode: HeapMode;
}) {
  const rootName = mode === "min" ? "min" : "max";
  // Build level display of the heap
  const levels: number[][] = [];
  let i = 0;
  let levelSize = 1;
  while (i < heap.length) {
    levels.push(heap.slice(i, i + levelSize));
    i += levelSize;
    levelSize *= 2;
  }

  return (
    <div>
      <TabBar tabs={["info", "code"]} active={tab} onChange={(t) => setTab(t as "info" | "code")} />
      {tab === "code" ? (
        <CodePanel id="binary-heap" />
      ) : (
        <div className="space-y-6">
          <LogBox log={log} />
          <div>
            <SectionLabel>Heap Properties</SectionLabel>
            <div className="rounded-lg p-3 text-xs font-mono space-y-1"
              style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)" }}>
              {heap.length === 0 ? (
                <div style={{ color: "var(--color-muted)" }}>empty</div>
              ) : (
                levels.map((lvl, li) => (
                  <div key={li}>
                    <span style={{ color: "var(--color-muted)" }}>L{li}: </span>
                    <span style={{ color: li === 0 ? "var(--color-accent)" : "var(--color-text)" }}>
                      {lvl.join("  ")}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
          <div>
            <SectionLabel>Operations</SectionLabel>
            <OpsTable ops={[
              { op: "insert(x)",                  desc: "Add and percolate up",                                  time: "O(log n)" },
              { op: `extract${mode === "min" ? "Min" : "Max"}()`, desc: `Remove ${rootName}, sift down`,         time: "O(log n)" },
              { op: `peek${mode === "min" ? "Min" : "Max"}()`,    desc: `View ${rootName}`,                       time: "O(1)" },
              { op: "heapify()",                  desc: "Build heap from array",                                 time: "O(n)" },
              { op: "heapSort()",                 desc: `Repeated extract → ${mode === "min" ? "ascending" : "descending"} array`, time: "O(n log n)" },
            ]} />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Context menu primitives ───────────────────────────────────────────────────

function ContextMenu({ x, y, children }: { x: number; y: number; children: React.ReactNode }) {
  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        position: "fixed",
        top: y,
        left: x,
        zIndex: 1000,
        background: "var(--color-surface-2)",
        border: "1px solid var(--color-border)",
        borderRadius: 8,
        padding: "4px 0",
        minWidth: 180,
        boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
      }}
    >
      {children}
    </div>
  );
}

function CtxItem({ children, onClick, danger }: { children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left px-4 py-2 text-xs transition-colors"
      style={{
        background: "transparent",
        border: "none",
        color: danger ? "var(--color-state-swap)" : "var(--color-text)",
        cursor: "pointer",
        display: "block",
      }}
      onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "var(--color-surface-3)")}
      onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "transparent")}
    >
      {children}
    </button>
  );
}

// ── Shared primitives ────────────────────────────────────────────────────────

function TabBar({ tabs, active, onChange }: { tabs: string[]; active: string; onChange: (t: string) => void }) {
  return (
    <div className="flex gap-1 mb-5 p-1 rounded-lg" style={{ background: "var(--color-surface-3)" }}>
      {tabs.map((t) => (
        <button key={t} onClick={() => onChange(t)}
          className="flex-1 py-1.5 rounded-md text-xs font-semibold capitalize transition-colors"
          style={{
            background: active === t ? "var(--color-surface-1)" : "transparent",
            color: active === t ? "var(--color-text)" : "var(--color-muted)",
            border: "none", cursor: "pointer",
          }}>
          {t}
        </button>
      ))}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--color-muted)" }}>
      {children}
    </p>
  );
}

function LogBox({ log }: { log: string[] }) {
  return (
    <div>
      <SectionLabel>Operation Log</SectionLabel>
      <div className="rounded-lg p-3 text-xs font-mono space-y-1.5 overflow-y-auto"
        style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)", maxHeight: 160, color: "var(--color-muted)" }}>
        {log.map((entry, i) => (
          <div key={i} style={{ color: i === 0 ? "var(--color-accent)" : undefined }}>
            {i === 0 ? "→ " : "  "}{entry}
          </div>
        ))}
      </div>
    </div>
  );
}

function OpsTable({ ops }: { ops: { op: string; desc: string; time: string }[] }) {
  return (
    <div className="space-y-2">
      {ops.map(({ op, desc, time }) => (
        <div key={op} className="flex items-center justify-between p-2 rounded-lg"
          style={{ background: "var(--color-surface-2)" }}>
          <div>
            <div className="text-xs font-mono" style={{ color: "var(--color-accent)" }}>{op}</div>
            <div className="text-xs" style={{ color: "var(--color-muted)" }}>{desc}</div>
          </div>
          <span className="text-xs font-mono" style={{ color: "var(--color-state-sorted)" }}>{time}</span>
        </div>
      ))}
    </div>
  );
}

function Pill({ text, purple }: { text: string; purple?: boolean }) {
  return (
    <span className="text-xs font-mono px-2 py-0.5 rounded-full" style={{
      background: purple ? "rgba(167,139,250,0.15)" : "rgba(124,106,247,0.15)",
      color: purple ? "#a78bfa" : "var(--color-accent)",
    }}>{text}</span>
  );
}

function DStat({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div>
      <div className="text-xs mb-0.5" style={{ color: "var(--color-muted)" }}>{label}</div>
      <div className="text-xl font-mono font-bold" style={{ color: color ?? "var(--color-text)" }}>{value}</div>
    </div>
  );
}

function DBtn({
  children, onClick, primary, disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  primary?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="px-2.5 py-1 rounded-lg text-xs font-medium transition-colors"
      style={{
        background: primary ? "var(--color-accent)" : "var(--color-surface-3)",
        color: primary ? "#fff" : "var(--color-text)",
        border: "1px solid " + (primary ? "var(--color-accent)" : "var(--color-border)"),
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {children}
    </button>
  );
}
