"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Network, RotateCcw, Zap, Dices, ListOrdered } from "lucide-react";
import { StepTreeLayout, StepNav, SidebarSection, StepMessage, TraverseControls, TRAVERSAL_LABELS, type TraversalKind } from "./StepTreeLayout";

// ── 2-3 tree data structure ──────────────────────────────────────────────────
//
// A 2-3 tree is a search tree where every internal node is either:
//   • a 2-node — 1 key, 2 children (smaller-than, greater-than)
//   • a 3-node — 2 keys (k1 < k2), 3 children (< k1, between k1..k2, > k2)
// All leaves sit at the *same* depth, so the tree is perfectly height-balanced
// — height = O(log n) without rotations. Balance is maintained by splitting
// overstuffed 4-nodes on the way back up an insertion.

interface TTNode {
  id: string;
  keys: number[];          // 1 or 2 keys (transiently 3 during a split)
  children: TTNode[];      // 0 (leaf) or keys.length+1
}

let ttCounter = 0;
function makeNode(keys: number[], children: TTNode[] = []): TTNode {
  return { id: `tt_${ttCounter++}`, keys: [...keys], children };
}

function cloneTT(n: TTNode | null): TTNode | null {
  if (!n) return null;
  return { id: n.id, keys: [...n.keys], children: n.children.map((c) => cloneTT(c)!) };
}

function isLeaf(n: TTNode): boolean {
  return n.children.length === 0;
}

function ttHeight(n: TTNode | null): number {
  if (!n) return 0;
  return isLeaf(n) ? 1 : 1 + ttHeight(n.children[0]);
}

function ttCount(n: TTNode | null): number {
  if (!n) return 0;
  return n.keys.length + n.children.reduce((s, c) => s + ttCount(c), 0);
}

// Return the index of the child to descend into for `val` inside `n`.
function childIndexFor(n: TTNode, val: number): number {
  for (let i = 0; i < n.keys.length; i++) if (val < n.keys[i]) return i;
  return n.keys.length;
}

function containsKey(n: TTNode, val: number): boolean {
  return n.keys.includes(val);
}

// ── Insertion with bottom-up splits ──────────────────────────────────────────
//
// We descend to a leaf, append the key (turning a 2-node into a 3-node, or a
// 3-node into a temporary 4-node), then split any 4-node we encounter on the
// way back up. Splitting a 4-node promotes its middle key into the parent —
// which itself may become a 4-node, propagating the split. If the root splits,
// the tree grows by exactly one level (the source of perfect balance).

type InsertResult = {
  node: TTNode;
  // If the subtree split, the promoted key + new right sibling that must be
  // absorbed by the caller's parent.
  promoted?: { key: number; right: TTNode };
};

function ttInsertRec(n: TTNode, val: number): InsertResult {
  if (containsKey(n, val)) return { node: n }; // dedupe — 2-3 trees store unique keys

  if (isLeaf(n)) {
    const keys = [...n.keys, val].sort((a, b) => a - b);
    if (keys.length <= 2) {
      return { node: makeNode(keys) };
    }
    // 4-node leaf — split immediately.
    const mid = keys[1];
    return {
      node: makeNode([keys[0]]),
      promoted: { key: mid, right: makeNode([keys[2]]) },
    };
  }

  const i = childIndexFor(n, val);
  const sub = ttInsertRec(n.children[i], val);
  if (!sub.promoted) {
    const newChildren = [...n.children];
    newChildren[i] = sub.node;
    return { node: makeNode(n.keys, newChildren) };
  }

  // Child split — splice the promoted key + new right sibling into this node.
  const newKeys = [...n.keys];
  newKeys.splice(i, 0, sub.promoted.key);
  const newChildren = [...n.children];
  newChildren.splice(i, 1, sub.node, sub.promoted.right);

  if (newKeys.length <= 2) {
    return { node: makeNode(newKeys, newChildren) };
  }
  // 4-node internal — split.
  const mid = newKeys[1];
  const leftNode  = makeNode([newKeys[0]], newChildren.slice(0, 2));
  const rightNode = makeNode([newKeys[2]], newChildren.slice(2));
  return { node: leftNode, promoted: { key: mid, right: rightNode } };
}

function ttInsert(root: TTNode | null, val: number): TTNode {
  if (!root) return makeNode([val]);
  const res = ttInsertRec(root, val);
  if (res.promoted) {
    // Root split — grow a new root that contains the promoted key.
    return makeNode([res.promoted.key], [res.node, res.promoted.right]);
  }
  return res.node;
}

// ── Animation step model ─────────────────────────────────────────────────────

interface TTStep {
  root: TTNode | null;
  // node ids to color in
  highlighted?: string[];
  // node ids whose keys are about to be promoted/split — drawn distinctly
  splitting?: string[];
  description: string;
}

function buildInsertSteps(root: TTNode | null, val: number): { steps: TTStep[]; newRoot: TTNode | null } {
  const steps: TTStep[] = [];
  steps.push({ root: cloneTT(root), description: `Inserting ${val}` });

  // Trace descent for the animation, highlighting nodes as we visit them.
  const path: TTNode[] = [];
  let cur = root;
  while (cur) {
    path.push(cur);
    if (containsKey(cur, val)) {
      steps.push({
        root: cloneTT(root),
        highlighted: [cur.id],
        description: `${val} already in node [${cur.keys.join(", ")}] — skip (duplicates not stored)`,
      });
      return { steps, newRoot: root };
    }
    if (isLeaf(cur)) {
      steps.push({
        root: cloneTT(root),
        highlighted: [cur.id],
        description: `Reached leaf [${cur.keys.join(", ")}] — inserting ${val} here`,
      });
      break;
    }
    const i = childIndexFor(cur, val);
    const cmpDesc = cur.keys
      .map((k, idx) => (idx === 0 ? `${val} ${val < k ? "<" : ">"} ${k}` : `${val} ${val < k ? "<" : ">"} ${k}`))
      .join(", ");
    steps.push({
      root: cloneTT(root),
      highlighted: [cur.id],
      description: `At node [${cur.keys.join(", ")}]: ${cmpDesc} → descend into child ${i + 1}/${cur.children.length}`,
    });
    cur = cur.children[i];
  }

  const newRoot = ttInsert(root, val);
  const heightChanged = ttHeight(newRoot) !== ttHeight(root);

  // Find which nodes along the original descent path were structurally changed
  // (split / had a promoted key inserted) by comparing IDs. Any node whose id
  // no longer appears in the new tree was rebuilt — likely because of a split.
  const newIds = new Set<string>();
  (function collect(n: TTNode | null) {
    if (!n) return;
    newIds.add(n.id);
    n.children.forEach(collect);
  })(newRoot);

  const splitIds = path.filter((p) => !newIds.has(p.id)).map((p) => p.id);
  if (splitIds.length > 0) {
    steps.push({
      root: cloneTT(root),
      splitting: splitIds,
      description: `${splitIds.length} node${splitIds.length === 1 ? "" : "s"} would overflow (>2 keys) — splitting bottom-up, promoting middle keys to parents`,
    });
  }

  if (heightChanged) {
    steps.push({
      root: cloneTT(newRoot),
      description: `Root split — tree grew to height ${ttHeight(newRoot)} (the only way 2-3 trees gain a level — keeps every leaf at the same depth)`,
    });
  } else {
    steps.push({
      root: cloneTT(newRoot),
      description: `Inserted ${val} — height stays ${ttHeight(newRoot)}, leaves still aligned`,
    });
  }

  return { steps, newRoot };
}

// Search — trace a path, return whether the key was found.
function buildSearchSteps(root: TTNode | null, val: number): TTStep[] {
  const steps: TTStep[] = [];
  steps.push({ root: cloneTT(root), description: `Searching for ${val}` });
  if (!root) {
    steps.push({ root: null, description: `Tree is empty — ${val} not found` });
    return steps;
  }
  let cur: TTNode | null = root;
  while (cur) {
    if (containsKey(cur, val)) {
      steps.push({
        root: cloneTT(root),
        highlighted: [cur.id],
        description: `Found ${val} in node [${cur.keys.join(", ")}] — O(log n) hit`,
      });
      return steps;
    }
    if (isLeaf(cur)) {
      steps.push({
        root: cloneTT(root),
        highlighted: [cur.id],
        description: `Leaf [${cur.keys.join(", ")}] reached — ${val} not in tree`,
      });
      return steps;
    }
    const i = childIndexFor(cur, val);
    steps.push({
      root: cloneTT(root),
      highlighted: [cur.id],
      description: `At [${cur.keys.join(", ")}]: ${val} ${i === 0 ? "<" : i === cur.keys.length ? ">" : "between"} ${cur.keys.join(" / ")} — go to child ${i + 1}/${cur.children.length}`,
    });
    cur = cur.children[i];
  }
  return steps;
}

// In-order traversal for the visual "sorted keys" strip.
function inOrderKeys(n: TTNode | null, out: number[] = []): number[] {
  if (!n) return out;
  if (isLeaf(n)) { for (const k of n.keys) out.push(k); return out; }
  for (let i = 0; i < n.children.length; i++) {
    inOrderKeys(n.children[i], out);
    if (i < n.keys.length) out.push(n.keys[i]);
  }
  return out;
}

// ── Traversal steps ───────────────────────────────────────────────────────────
//
// 2-3 trees are multi-way, so "visiting" a node means touching its 1–2 keys.
// In-order interleaves children and keys, which (as in any search tree) emits
// the keys in fully sorted order — the same sequence the in-order strip shows.

function buildTTTraversalSteps(root: TTNode | null, kind: TraversalKind): TTStep[] {
  const label = TRAVERSAL_LABELS[kind];
  if (!root) return [{ root: null, description: `${label}: tree is empty.` }];

  const order: { id: string; text: string }[] = [];
  const nodeText = (n: TTNode) => `[${n.keys.join(", ")}]`;

  if (kind === "bfs") {
    const q: TTNode[] = [root];
    while (q.length) {
      const n = q.shift()!;
      order.push({ id: n.id, text: nodeText(n) });
      for (const c of n.children) q.push(c);
    }
  } else if (kind === "pre") {
    const v = (n: TTNode) => { order.push({ id: n.id, text: nodeText(n) }); n.children.forEach(v); };
    v(root);
  } else if (kind === "post") {
    const v = (n: TTNode) => { n.children.forEach(v); order.push({ id: n.id, text: nodeText(n) }); };
    v(root);
  } else {
    const v = (n: TTNode) => {
      if (isLeaf(n)) { for (const k of n.keys) order.push({ id: n.id, text: String(k) }); return; }
      for (let i = 0; i < n.children.length; i++) {
        v(n.children[i]);
        if (i < n.keys.length) order.push({ id: n.id, text: String(n.keys[i]) });
      }
    };
    v(root);
  }

  const how =
    kind === "bfs" ? "dequeue a node, visit its keys, enqueue its children — level by level"
    : kind === "pre" ? "visit the node's keys, then recurse into each child left-to-right"
    : kind === "in" ? "recurse left, emit a key, recurse, emit the next key … (yields sorted order)"
    : "recurse into all children first, then visit the node's keys";

  const steps: TTStep[] = [{ root: cloneTT(root), description: `${label} — ${how}.` }];
  const visited: string[] = [];
  order.forEach((e, i) => {
    visited.push(e.id);
    steps.push({ root: cloneTT(root), highlighted: [...visited], description: `${label}: visit ${e.text} (${i + 1}/${order.length})` });
  });
  const orderStr = order.map((e) => e.text).join(kind === "in" ? " → " : ", ");
  steps.push({ root: cloneTT(root), highlighted: order.map((e) => e.id), description: `${label} complete: ${orderStr}.` });
  return steps;
}

// ── SVG Layout ───────────────────────────────────────────────────────────────

interface LayoutTT {
  id: string;
  keys: number[];
  x: number;
  y: number;
  edges: { childX: number; childY: number }[];
}

const TT_LEVEL_H = 86;
const TT_KEY_W   = 28;
const TT_PAD_X   = 10;
const TT_H_GAP   = 24;
const TT_NODE_H  = 38;

function nodeWidth(keys: number[]): number {
  return TT_PAD_X * 2 + keys.length * TT_KEY_W + Math.max(0, keys.length - 1) * 4;
}

function layoutTT(root: TTNode | null): LayoutTT[] {
  if (!root) return [];
  // Subtree width = max(self width, sum of child widths + gaps).
  const widthCache = new Map<string, number>();
  function subtreeW(n: TTNode): number {
    if (widthCache.has(n.id)) return widthCache.get(n.id)!;
    const ownW = nodeWidth(n.keys);
    let kidsW = 0;
    if (!isLeaf(n)) {
      kidsW = n.children.reduce((s, c) => s + subtreeW(c), 0) + (n.children.length - 1) * TT_H_GAP;
    }
    const w = Math.max(ownW, kidsW);
    widthCache.set(n.id, w);
    return w;
  }
  subtreeW(root);

  const result: LayoutTT[] = [];
  function place(n: TTNode, depth: number, left: number) {
    const w = subtreeW(n);
    const cx = left + w / 2;
    const y  = depth * TT_LEVEL_H;
    const edges: { childX: number; childY: number }[] = [];
    if (!isLeaf(n)) {
      let cursor = left;
      // Distribute the *extra* horizontal slack evenly between children so the
      // parent stays centered above the gap-padded child row.
      const totalKidsW = n.children.reduce((s, c) => s + subtreeW(c), 0) + (n.children.length - 1) * TT_H_GAP;
      const slack = w - totalKidsW;
      cursor += slack / 2;
      for (const c of n.children) {
        place(c, depth + 1, cursor);
        edges.push({ childX: cursor + subtreeW(c) / 2, childY: y + TT_LEVEL_H });
        cursor += subtreeW(c) + TT_H_GAP;
      }
    }
    result.push({ id: n.id, keys: n.keys, x: cx, y, edges });
  }
  place(root, 0, 0);
  return result;
}

// ── SVG renderer ─────────────────────────────────────────────────────────────

function TTSVG({
  root,
  highlighted = [],
  splitting = [],
}: {
  root: TTNode | null;
  highlighted?: string[];
  splitting?: string[];
}) {
  const nodes = layoutTT(root);
  if (nodes.length === 0) return (
    <div className="flex items-center justify-center h-32 text-sm" style={{ color: "var(--color-muted)" }}>
      Insert values to build the 2-3 tree.
    </div>
  );

  const hl  = new Set(highlighted);
  const spl = new Set(splitting);

  const xs = nodes.flatMap((n) => [n.x - nodeWidth(n.keys) / 2, n.x + nodeWidth(n.keys) / 2]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...nodes.map((n) => n.y));
  const offsetX = -minX + 12;
  const svgW = maxX - minX + 24;
  const svgH = maxY + TT_NODE_H + 24;

  return (
    <svg width="100%" viewBox={`0 0 ${svgW} ${svgH}`} style={{ display: "block", overflow: "visible" }}>
      {nodes.map((n) =>
        n.edges.map((e, i) => (
          <line
            key={`e-${n.id}-${i}`}
            x1={n.x + offsetX}
            y1={n.y + TT_NODE_H / 2}
            x2={e.childX + offsetX}
            y2={e.childY - TT_NODE_H / 2}
            stroke="var(--color-border)"
            strokeWidth={1.75}
          />
        ))
      )}

      {nodes.map((n) => {
        const w = nodeWidth(n.keys);
        const x = n.x + offsetX - w / 2;
        const y = n.y - TT_NODE_H / 2;
        const isHl  = hl.has(n.id);
        const isSpl = spl.has(n.id);
        const fill = isSpl ? "rgba(239,68,68,0.18)" : isHl ? "var(--color-accent)" : "var(--color-surface-2)";
        const stroke = isSpl ? "#ef4444" : isHl ? "var(--color-accent)" : "var(--color-border)";
        const textCol = isHl ? "#fff" : "var(--color-text)";
        const labelKind = n.keys.length === 2 ? "3-node" : "2-node";

        return (
          <g key={n.id}>
            <rect
              x={x} y={y}
              width={w} height={TT_NODE_H}
              rx={9}
              fill={fill}
              stroke={stroke}
              strokeWidth={isSpl ? 2.25 : 1.75}
            />
            {/* key cells with a separator stroke for 3-nodes */}
            {n.keys.map((k, i) => (
              <g key={i}>
                {i > 0 && (
                  <line
                    x1={x + TT_PAD_X + i * TT_KEY_W + (i - 1) * 4 - 2}
                    y1={y + 6}
                    x2={x + TT_PAD_X + i * TT_KEY_W + (i - 1) * 4 - 2}
                    y2={y + TT_NODE_H - 6}
                    stroke={stroke}
                    strokeWidth={1}
                    strokeDasharray="2 2"
                  />
                )}
                <text
                  x={x + TT_PAD_X + i * (TT_KEY_W + 4) + TT_KEY_W / 2}
                  y={y + TT_NODE_H / 2}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={13}
                  fontFamily="monospace"
                  fontWeight="bold"
                  fill={textCol}
                >
                  {k}
                </text>
              </g>
            ))}
            <text
              x={x + w / 2}
              y={y - 4}
              textAnchor="middle"
              fontSize={9}
              fontFamily="monospace"
              fill={isSpl ? "#ef4444" : "var(--color-muted)"}
            >
              {labelKind}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ── Button (small, matches the AVL visualizer style) ─────────────────────────

function Btn({
  children, onClick, primary, disabled, icon,
}: {
  children: React.ReactNode;
  onClick: () => void;
  primary?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
      style={{
        background: primary ? "var(--color-accent)" : "var(--color-surface-3)",
        color: primary ? "#fff" : disabled ? "var(--color-muted)" : "var(--color-text)",
        border: `1px solid ${primary ? "var(--color-accent)" : "var(--color-border)"}`,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {icon}
      {children}
    </button>
  );
}

// ── Main component ──────────────────────────────────────────────────────────

function buildInitialTT(): TTNode | null {
  ttCounter = 0;
  let r: TTNode | null = null;
  for (const v of [10, 20, 5, 15, 25, 30, 35]) r = ttInsert(r, v);
  return r;
}

export default function TwoThreeTreeVisualizer() {
  const [root, setRoot] = useState<TTNode | null>(buildInitialTT);
  const [insertVal, setInsertVal] = useState("");
  const [searchVal, setSearchVal] = useState("");
  const [customList, setCustomList] = useState("");
  const [steps, setSteps] = useState<TTStep[]>([]);
  const [stepIdx, setStepIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(700);
  const [message, setMessage] = useState("Preset tree loaded. Insert/search keys, run a traversal, or try a Random Lesson.");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const currentStep = steps[stepIdx] ?? null;
  const displayRoot = currentStep ? currentStep.root : root;
  const highlighted = currentStep?.highlighted ?? [];
  const splitting   = currentStep?.splitting   ?? [];

  useEffect(() => {
    if (!playing) { if (intervalRef.current) clearInterval(intervalRef.current); return; }
    intervalRef.current = setInterval(() => {
      setStepIdx((prev) => {
        if (prev >= steps.length - 1) { setPlaying(false); return prev; }
        return prev + 1;
      });
    }, speed);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [playing, speed, steps.length]);

  useEffect(() => {
    if (currentStep) setMessage(currentStep.description);
  }, [currentStep]);

  const startAnimation = useCallback((newSteps: TTStep[]) => {
    setSteps(newSteps);
    setStepIdx(0);
    setPlaying(false);
    if (newSteps.length > 0) setMessage(newSteps[0].description);
  }, []);

  const handleInsert = useCallback(() => {
    const v = parseInt(insertVal, 10);
    if (isNaN(v)) return;
    const { steps: s, newRoot } = buildInsertSteps(root, v);
    startAnimation(s);
    setRoot(newRoot);
    setInsertVal("");
  }, [insertVal, root, startAnimation]);

  const handleSearch = useCallback(() => {
    const v = parseInt(searchVal, 10);
    if (isNaN(v)) return;
    const s = buildSearchSteps(root, v);
    startAnimation(s);
    setSearchVal("");
  }, [searchVal, root, startAnimation]);

  const handleAutoDemo = useCallback(() => {
    ttCounter = 0;
    // A sequence chosen to exercise leaf splits and at least one root split.
    const demoVals = [10, 20, 5, 15, 25, 30, 35, 40, 8, 12];
    setMessage(`Auto-demo: inserting [${demoVals.join(", ")}] — watch every split percolate up`);
    let r: TTNode | null = null;
    const allSteps: TTStep[] = [];
    for (const v of demoVals) {
      const { steps: s, newRoot } = buildInsertSteps(r, v);
      allSteps.push(...s);
      r = newRoot;
    }
    setRoot(r);
    startAnimation(allSteps);
  }, [startAnimation]);

  // Random guided lesson — fresh values, simulated up front to count the node
  // splits and how many levels the tree gains, then led by an instruction
  // telling the learner what to watch for.
  const handleRandomLesson = useCallback(() => {
    ttCounter = 0;
    const count = 6 + Math.floor(Math.random() * 5); // 6–10 values
    const vals: number[] = [];
    while (vals.length < count) {
      const v = 1 + Math.floor(Math.random() * 99);
      if (!vals.includes(v)) vals.push(v);
    }
    let r: TTNode | null = null;
    const allSteps: TTStep[] = [];
    let splits = 0;
    for (const v of vals) {
      const { steps: s, newRoot } = buildInsertSteps(r, v);
      for (const st of s) if (st.splitting && st.splitting.length > 0) splits += st.splitting.length;
      allSteps.push(...s);
      r = newRoot;
    }
    const finalH = ttHeight(r);
    const intro =
      `Lesson — insert [${vals.join(", ")}]. This run performs ${splits} node split${splits === 1 ? "" : "s"} and ends at height ${finalH}. Watch a 3-node overflow into a transient 4-node, then split and promote its middle key upward — every leaf stays at the same depth.`;
    allSteps.unshift({ root: null, description: intro });
    setRoot(r);
    startAnimation(allSteps);
  }, [startAnimation]);

  const handleTraverse = useCallback((kind: TraversalKind) => {
    startAnimation(buildTTTraversalSteps(root, kind));
  }, [root, startAnimation]);

  // Build a fresh 2-3 tree from a user-supplied list and play the construction.
  const handleCustomDemo = useCallback(() => {
    ttCounter = 0;
    const vals = Array.from(new Set(
      customList.split(/[^0-9-]+/).map((s) => parseInt(s, 10)).filter((n) => !Number.isNaN(n))
    )).slice(0, 31);
    if (vals.length === 0) { setMessage("Enter a comma-separated list of numbers, e.g. 10, 20, 5, 15, 25"); return; }
    let r: TTNode | null = null;
    const allSteps: TTStep[] = [];
    let splits = 0;
    for (const v of vals) {
      const { steps: s, newRoot } = buildInsertSteps(r, v);
      for (const st of s) if (st.splitting && st.splitting.length > 0) splits += st.splitting.length;
      allSteps.push(...s);
      r = newRoot;
    }
    allSteps.unshift({
      root: null,
      description: `Custom demo — build a 2-3 tree from [${vals.join(", ")}]: ${splits} split${splits === 1 ? "" : "s"}, final height ${ttHeight(r)}.`,
    });
    setRoot(r);
    startAnimation(allSteps);
  }, [customList, startAnimation]);

  const handleReset = useCallback(() => {
    ttCounter = 0;
    setRoot(null);
    setSteps([]);
    setStepIdx(0);
    setPlaying(false);
    setMessage("Tree cleared.");
  }, []);

  const sortedView = inOrderKeys(displayRoot);
  const h          = ttHeight(displayRoot);
  const n          = ttCount(displayRoot);

  const canvas = (
    <div className="flex flex-col gap-3 h-full">
      {/* Stats */}
      <div className="flex flex-wrap gap-6 shrink-0">
        <Stat label="Keys (n)" value={n} />
        <Stat label="Height" value={h} color="var(--color-accent)" />
        <Stat label="Log₂(n)" value={n > 0 ? Math.ceil(Math.log2(n + 1)) : 0} color="var(--color-muted)" />
      </div>

      {/* SVG canvas — fills remaining height */}
      <div
        className="rounded-xl overflow-auto flex-1 min-h-0 flex items-start"
        style={{
          background: "var(--color-surface-1)",
          border: "1px solid var(--color-border)",
          minHeight: 220,
          padding: "20px 8px",
        }}
      >
        <TTSVG root={displayRoot} highlighted={highlighted} splitting={splitting} />
      </div>

      {/* In-order keys strip — proves the tree is a search structure */}
      {sortedView.length > 0 && (
        <div className="shrink-0">
          <div className="text-xs mb-1" style={{ color: "var(--color-muted)" }}>
            In-order traversal (sorted output)
          </div>
          <div className="flex flex-wrap gap-1">
            {sortedView.map((k, i) => (
              <div
                key={i}
                className="px-2 py-1 rounded text-xs font-mono"
                style={{
                  background: "var(--color-surface-2)",
                  border: "1px solid var(--color-border)",
                  color: "var(--color-text)",
                }}
              >
                {k}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const sidebar = (
    <>
      <StepMessage>{message}</StepMessage>

      {/* Controls */}
      <SidebarSection title="Operations">
        <div className="flex flex-col gap-2">
          <div className="flex gap-2 items-center">
            <input
              type="number"
              value={insertVal}
              onChange={(e) => setInsertVal(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleInsert(); }}
              placeholder="e.g. 42"
              className="rounded-lg px-3 py-2 text-sm flex-1 min-w-0 outline-none"
              style={{ background: "var(--color-surface-3)", border: "1px solid var(--color-border)", color: "var(--color-text)" }}
            />
            <Btn onClick={handleInsert} primary>Insert</Btn>
          </div>
          <div className="flex gap-2 items-center">
            <input
              type="number"
              value={searchVal}
              onChange={(e) => setSearchVal(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
              placeholder="e.g. 20"
              className="rounded-lg px-3 py-2 text-sm flex-1 min-w-0 outline-none"
              style={{ background: "var(--color-surface-3)", border: "1px solid var(--color-border)", color: "var(--color-text)" }}
            />
            <Btn onClick={handleSearch}>Search</Btn>
          </div>
          <div className="flex flex-wrap gap-2">
            <Btn onClick={handleRandomLesson} icon={<Dices size={13} />}>Random Lesson</Btn>
            <Btn onClick={handleAutoDemo} icon={<Zap size={13} />}>Auto-Demo</Btn>
            <Btn onClick={handleReset} icon={<RotateCcw size={13} />}>Clear</Btn>
          </div>
        </div>
      </SidebarSection>

      {/* Custom list demo */}
      <SidebarSection title="Custom list demo">
        <div className="flex flex-col gap-2">
          <input
            type="text"
            value={customList}
            onChange={(e) => setCustomList(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleCustomDemo(); }}
            placeholder="10, 20, 5, 15, 25, 30, 35"
            className="rounded-lg px-3 py-2 text-sm w-full outline-none font-mono"
            style={{ background: "var(--color-surface-3)", border: "1px solid var(--color-border)", color: "var(--color-text)" }}
          />
          <Btn onClick={handleCustomDemo} icon={<ListOrdered size={13} />}>Build &amp; demo list</Btn>
        </div>
      </SidebarSection>

      {/* Traversal */}
      <SidebarSection title="Traversal / search order">
        <TraverseControls kinds={["bfs", "pre", "in", "post"]} onTraverse={handleTraverse} disabled={!root} />
      </SidebarSection>

      {/* Step navigation */}
      {steps.length > 0 && (
        <SidebarSection title="Playback">
          <StepNav
            stepIdx={stepIdx}
            stepCount={steps.length}
            isPlaying={playing}
            setIsPlaying={setPlaying}
            setStepIdx={setStepIdx}
            speed={speed}
            setSpeed={setSpeed}
          />
        </SidebarSection>
      )}

      {/* Legend */}
      <SidebarSection title="Legend">
        <div className="flex flex-col gap-2">
          {[
            { label: "highlighted (visiting)", bg: "var(--color-accent)" },
            { label: "splitting (4-node → 2+2)", bg: "rgba(239,68,68,0.2)", border: "#ef4444" },
            { label: "2-node (1 key)",   bg: "var(--color-surface-3)", border: "var(--color-border)" },
            { label: "3-node (2 keys)",  bg: "var(--color-surface-3)", border: "var(--color-border)" },
          ].map(({ label, bg, border }) => (
            <div key={label} className="flex items-center gap-1.5">
              <div className="w-3.5 h-3.5 rounded shrink-0" style={{ background: bg, border: border ? `1.5px solid ${border}` : undefined }} />
              <span className="text-xs" style={{ color: "var(--color-muted)" }}>{label}</span>
            </div>
          ))}
        </div>
      </SidebarSection>

      {/* Rules of insertion */}
      <SidebarSection title="Rules of insertion">
        <div className="flex flex-col gap-2">
          {[
            { rule: "Insert into a 2-node leaf", outcome: "Becomes a 3-node (2 keys, 0 children). No structural change." },
            { rule: "Insert into a 3-node leaf", outcome: "Forms a transient 4-node — split: left + right become 2-nodes, middle key promotes to parent." },
            { rule: "Promotion into a 2-node parent", outcome: "Parent absorbs the new key, becomes a 3-node. Done." },
            { rule: "Promotion into a 3-node parent", outcome: "Parent becomes a transient 4-node — split again, promote upward. Cascades to root if needed." },
            { rule: "Promotion into a 3-node root", outcome: "Root splits — a new root containing only the promoted key is created. Tree height increases by exactly 1." },
            { rule: "All leaves stay at one depth", outcome: "Because splits only ever add levels at the root, every leaf grows in lock-step. Height ≤ log₂(n+1)." },
          ].map(({ rule, outcome }) => (
            <div key={rule} className="rounded-lg p-2.5" style={{ background: "var(--color-surface-3)" }}>
              <div className="text-xs font-mono font-bold" style={{ color: "var(--color-accent)" }}>{rule}</div>
              <div className="text-xs" style={{ color: "var(--color-muted)" }}>{outcome}</div>
            </div>
          ))}
        </div>
      </SidebarSection>

      {/* Complexity */}
      <SidebarSection title="Complexity">
        <div className="grid grid-cols-2 gap-2">
          {[
            { op: "search(k)", t: "O(log n)" },
            { op: "insert(k)", t: "O(log n)" },
            { op: "delete(k)", t: "O(log n)" },
            { op: "in-order", t: "O(n)" },
          ].map(({ op, t }) => (
            <div key={op} className="rounded-lg p-2.5 flex items-center justify-between" style={{ background: "var(--color-surface-3)" }}>
              <span className="text-xs font-mono" style={{ color: "var(--color-accent)" }}>{op}</span>
              <span className="text-xs font-mono" style={{ color: "var(--color-state-sorted)" }}>{t}</span>
            </div>
          ))}
        </div>
      </SidebarSection>
    </>
  );

  return (
    <StepTreeLayout
      icon={<Network size={20} style={{ color: "var(--color-accent)", flexShrink: 0 }} strokeWidth={1.75} />}
      title="2-3 Tree"
      badges={
        <>
          <span className="text-xs font-mono px-2 py-0.5 rounded-full" style={{ background: "rgba(124,106,247,0.15)", color: "var(--color-accent)" }}>Perfectly balanced</span>
          <span className="text-xs font-mono px-2 py-0.5 rounded-full" style={{ background: "rgba(167,139,250,0.12)", color: "#a78bfa" }}>O(log n)</span>
        </>
      }
      description="A B-tree of order 3: every node holds 1 key (2-node) or 2 keys (3-node), and all leaves sit at the same depth. Balance is maintained by splitting any overstuffed 4-node and promoting its middle key — no rotations needed. The tree only grows in height when the root itself splits."
      canvas={canvas}
      sidebar={sidebar}
    />
  );
}

function Stat({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div>
      <div className="text-xs mb-0.5" style={{ color: "var(--color-muted)" }}>{label}</div>
      <div className="text-xl font-mono font-bold" style={{ color: color ?? "var(--color-text)" }}>{value}</div>
    </div>
  );
}
