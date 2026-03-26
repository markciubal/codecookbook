"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { BarChart2, Play, Pause, SkipForward, RotateCcw } from "lucide-react";

// ── Segment Tree data structure ───────────────────────────────────────────────

interface STNode {
  id: string;
  range: [number, number];
  value: number;
  left: STNode | null;
  right: STNode | null;
}

function buildST(arr: number[], l: number, r: number): STNode {
  const id = `st_${l}_${r}`;
  if (l === r) {
    return { id, range: [l, r], value: arr[l], left: null, right: null };
  }
  const mid = Math.floor((l + r) / 2);
  const left = buildST(arr, l, mid);
  const right = buildST(arr, mid + 1, r);
  return { id, range: [l, r], value: left.value + right.value, left, right };
}

function cloneST(node: STNode | null): STNode | null {
  if (!node) return null;
  return { ...node, left: cloneST(node.left), right: cloneST(node.right) };
}

function updateST(node: STNode | null, idx: number, val: number): STNode | null {
  if (!node) return null;
  const n = { ...node };
  if (n.range[0] === n.range[1]) {
    n.value = val;
    return n;
  }
  const mid = Math.floor((n.range[0] + n.range[1]) / 2);
  if (idx <= mid) n.left = updateST(n.left, idx, val);
  else n.right = updateST(n.right, idx, val);
  n.value = (n.left?.value ?? 0) + (n.right?.value ?? 0);
  return n;
}

// ── Step types ────────────────────────────────────────────────────────────────

interface STStep {
  root: STNode | null;
  highlighted: string[];   // queried path
  updated: string[];       // update path
  description: string;
}

// ── Build animation ───────────────────────────────────────────────────────────

function buildBuildSteps(arr: number[]): STStep[] {
  const steps: STStep[] = [];
  const root = buildST(arr, 0, arr.length - 1);

  // Collect all nodes in post-order (bottom-up)
  const order: STNode[] = [];
  function postOrder(n: STNode | null) {
    if (!n) return;
    postOrder(n.left);
    postOrder(n.right);
    order.push(n);
  }
  postOrder(root);

  const revealed = new Set<string>();
  for (const node of order) {
    revealed.add(node.id);
    const desc =
      node.range[0] === node.range[1]
        ? `Leaf [${node.range[0]}] = ${node.value}`
        : `Internal [${node.range[0]},${node.range[1]}] = ${node.value} (sum)`;
    steps.push({ root, highlighted: [node.id], updated: [], description: desc });
  }
  steps.push({ root, highlighted: [], updated: [], description: "Segment tree built!" });
  return steps;
}

function buildQuerySteps(root: STNode | null, l: number, r: number): STStep[] {
  const steps: STStep[] = [];
  if (!root) return steps;

  steps.push({ root, highlighted: [], updated: [], description: `Range sum query [${l}, ${r}]` });

  const visited: string[] = [];

  function query(node: STNode | null) {
    if (!node) return;
    visited.push(node.id);
    const [nl, nr] = node.range;
    if (nl > r || nr < l) {
      steps.push({ root, highlighted: [...visited], updated: [], description: `[${nl},${nr}] out of range [${l},${r}] — skip` });
      visited.pop();
      return;
    }
    if (nl >= l && nr <= r) {
      steps.push({ root, highlighted: [...visited], updated: [], description: `[${nl},${nr}] fully inside [${l},${r}] — add ${node.value}` });
      visited.pop();
      return;
    }
    steps.push({ root, highlighted: [...visited], updated: [], description: `[${nl},${nr}] partially overlaps — recurse` });
    query(node.left);
    query(node.right);
    visited.pop();
  }

  query(root);
  return steps;
}

function buildUpdateSteps(root: STNode | null, idx: number, val: number): STStep[] {
  const steps: STStep[] = [];
  if (!root) return steps;

  steps.push({ root, highlighted: [], updated: [], description: `Point update: index ${idx} → ${val}` });

  const path: string[] = [];

  function findPath(node: STNode | null): boolean {
    if (!node) return false;
    path.push(node.id);
    if (node.range[0] === node.range[1]) {
      steps.push({ root, highlighted: [], updated: [...path], description: `Leaf [${idx}]: ${node.value} → ${val}` });
      return true;
    }
    const mid = Math.floor((node.range[0] + node.range[1]) / 2);
    const found = idx <= mid ? findPath(node.left) : findPath(node.right);
    if (found) {
      steps.push({ root, highlighted: [], updated: [...path], description: `Update [${node.range[0]},${node.range[1]}] sum` });
    }
    return found;
  }

  findPath(root);
  const newRoot = updateST(root, idx, val);
  steps.push({ root: newRoot, highlighted: [], updated: [], description: `Update complete. New sum at root: ${newRoot?.value}` });
  return steps;
}

// ── SVG Layout ────────────────────────────────────────────────────────────────

interface LayoutST {
  id: string;
  range: [number, number];
  value: number;
  x: number;
  y: number;
  parentX: number | null;
  parentY: number | null;
}

const NODE_W = 64;
const NODE_H = 36;
const LEVEL_H = 72;

function layoutST(root: STNode | null): LayoutST[] {
  const result: LayoutST[] = [];
  if (!root) return result;

  // Assign x positions via in-order traversal
  const xMap = new Map<string, number>();
  let xCounter = 0;
  function inOrder(n: STNode | null) {
    if (!n) return;
    inOrder(n.left);
    xMap.set(n.id, xCounter++ * (NODE_W + 12));
    inOrder(n.right);
  }
  inOrder(root);

  // Assign y by depth
  function assign(n: STNode | null, depth: number, pX: number | null, pY: number | null) {
    if (!n) return;
    const x = xMap.get(n.id)!;
    const y = depth * LEVEL_H;
    result.push({ id: n.id, range: n.range, value: n.value, x, y, parentX: pX, parentY: pY });
    assign(n.left, depth + 1, x, y);
    assign(n.right, depth + 1, x, y);
  }
  assign(root, 0, null, null);

  return result;
}

// ── SVG Renderer ──────────────────────────────────────────────────────────────

function SegTreeSVG({
  root,
  highlighted,
  updated,
}: {
  root: STNode | null;
  highlighted: string[];
  updated: string[];
}) {
  const nodes = layoutST(root);
  if (nodes.length === 0) return (
    <div className="flex items-center justify-center h-32 text-sm" style={{ color: "var(--color-muted)" }}>
      Click &quot;Build&quot; to construct the segment tree.
    </div>
  );

  const hlSet = new Set(highlighted);
  const upSet = new Set(updated);

  const minX = Math.min(...nodes.map((n) => n.x));
  const maxX = Math.max(...nodes.map((n) => n.x));
  const maxY = Math.max(...nodes.map((n) => n.y));
  const offsetX = -minX + NODE_W / 2 + 8;
  const svgW = maxX - minX + NODE_W + 16;
  const svgH = maxY + NODE_H + 20;

  return (
    <svg
      width="100%"
      viewBox={`0 0 ${svgW} ${svgH}`}
      style={{ display: "block", overflow: "visible" }}
    >
      {/* Edges */}
      {nodes.map((n) => {
        if (n.parentX === null || n.parentY === null) return null;
        return (
          <line
            key={`e-${n.id}`}
            x1={n.parentX + offsetX}
            y1={n.parentY + NODE_H}
            x2={n.x + offsetX}
            y2={n.y}
            stroke="var(--color-border)"
            strokeWidth={2}
          />
        );
      })}

      {/* Nodes */}
      {nodes.map((n) => {
        const cx = n.x + offsetX;
        const cy = n.y;
        const isHighlighted = hlSet.has(n.id);
        const isUpdated = upSet.has(n.id);
        const isLeaf = n.range[0] === n.range[1];

        let fill = isLeaf ? "var(--color-surface-3)" : "var(--color-surface-2)";
        let stroke = "var(--color-border)";
        if (isHighlighted) { fill = "rgba(124,106,247,0.35)"; stroke = "var(--color-accent)"; }
        if (isUpdated) { fill = "rgba(34,197,94,0.25)"; stroke = "#22c55e"; }

        return (
          <g key={n.id}>
            <rect
              x={cx - NODE_W / 2}
              y={cy}
              width={NODE_W}
              height={NODE_H}
              rx={6}
              fill={fill}
              stroke={stroke}
              strokeWidth={2}
            />
            <text
              x={cx}
              y={cy + 12}
              textAnchor="middle"
              fontSize={9}
              fontFamily="monospace"
              fill="var(--color-muted)"
            >
              [{n.range[0]},{n.range[1]}]
            </text>
            <text
              x={cx}
              y={cy + 26}
              textAnchor="middle"
              fontSize={13}
              fontWeight="bold"
              fontFamily="monospace"
              fill={isHighlighted ? "var(--color-accent)" : isUpdated ? "#22c55e" : "var(--color-text)"}
            >
              {n.value}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ── Button primitive ──────────────────────────────────────────────────────────

function Btn({
  children,
  onClick,
  primary,
  disabled,
  icon,
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

// ── Main component ────────────────────────────────────────────────────────────

const DEFAULT_ARRAY = [4, 2, 7, 1, 5, 3, 8, 6];

export default function SegmentTreeVisualizer() {
  const [arr, setArr] = useState<number[]>(DEFAULT_ARRAY);
  const [root, setRoot] = useState<STNode | null>(null);
  const [steps, setSteps] = useState<STStep[]>([]);
  const [stepIdx, setStepIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(700);
  const [message, setMessage] = useState("Edit the array values, then click Build.");
  const [queryL, setQueryL] = useState("0");
  const [queryR, setQueryR] = useState("3");
  const [updateIdx, setUpdateIdx] = useState("0");
  const [updateVal, setUpdateVal] = useState("10");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const currentStep = steps[stepIdx] ?? null;
  const displayRoot = currentStep ? currentStep.root : root;
  const highlighted = currentStep ? currentStep.highlighted : [];
  const updatedNodes = currentStep ? currentStep.updated : [];

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

  const startAnimation = useCallback((newSteps: STStep[]) => {
    setSteps(newSteps);
    setStepIdx(0);
    setPlaying(false);
    if (newSteps.length > 0) setMessage(newSteps[0].description);
  }, []);

  const handleBuild = useCallback(() => {
    const newRoot = buildST(arr, 0, arr.length - 1);
    setRoot(newRoot);
    const stepsData = buildBuildSteps(arr);
    startAnimation(stepsData);
  }, [arr, startAnimation]);

  const handleQuery = useCallback(() => {
    if (!root) { setMessage("Build the tree first!"); return; }
    const l = parseInt(queryL, 10);
    const r = parseInt(queryR, 10);
    if (isNaN(l) || isNaN(r) || l < 0 || r >= arr.length || l > r) {
      setMessage(`Invalid range. Use 0 to ${arr.length - 1}.`);
      return;
    }
    startAnimation(buildQuerySteps(root, l, r));
  }, [root, queryL, queryR, arr.length, startAnimation]);

  const handleUpdate = useCallback(() => {
    if (!root) { setMessage("Build the tree first!"); return; }
    const idx = parseInt(updateIdx, 10);
    const val = parseInt(updateVal, 10);
    if (isNaN(idx) || isNaN(val) || idx < 0 || idx >= arr.length) {
      setMessage(`Invalid index. Use 0 to ${arr.length - 1}.`);
      return;
    }
    const stepsData = buildUpdateSteps(root, idx, val);
    startAnimation(stepsData);
    // Apply update
    const newArr = [...arr];
    newArr[idx] = val;
    setArr(newArr);
    const newRoot = updateST(root, idx, val);
    setRoot(newRoot);
  }, [root, updateIdx, updateVal, arr, startAnimation]);

  return (
    <div className="flex flex-col min-h-dvh" style={{ background: "var(--color-bg)" }}>
      {/* Header */}
      <div className="px-5 pt-6 pb-4" style={{ borderBottom: "1px solid var(--color-border)" }}>
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <BarChart2 size={20} style={{ color: "var(--color-accent)", flexShrink: 0 }} strokeWidth={1.75} />
          <h1 className="text-2xl font-bold">Segment Tree</h1>
          <span className="text-xs font-mono px-2 py-0.5 rounded-full" style={{ background: "rgba(124,106,247,0.15)", color: "var(--color-accent)" }}>Range Queries</span>
          <span className="text-xs font-mono px-2 py-0.5 rounded-full" style={{ background: "rgba(167,139,250,0.12)", color: "#a78bfa" }}>O(log n)</span>
        </div>
        <p className="text-sm" style={{ color: "var(--color-muted)" }}>
          A binary tree for efficiently answering range sum queries and point updates.
        </p>
      </div>

      <div className="flex-1 px-5 pt-5 pb-4 flex flex-col gap-4">
        {/* Array inputs */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--color-muted)" }}>
            Array values (1–99)
          </p>
          <div className="flex flex-wrap gap-2 items-end">
            {arr.map((v, i) => (
              <div key={i} className="flex flex-col items-center gap-1">
                <span className="text-xs" style={{ color: "var(--color-muted)" }}>[{i}]</span>
                <input
                  type="number"
                  min={1}
                  max={99}
                  value={v}
                  onChange={(e) => {
                    const n = Math.max(1, Math.min(99, parseInt(e.target.value, 10) || 1));
                    const next = [...arr];
                    next[i] = n;
                    setArr(next);
                  }}
                  className="w-12 rounded-lg px-2 py-1.5 text-sm text-center outline-none"
                  style={{
                    background: "var(--color-surface-2)",
                    border: "1px solid var(--color-border)",
                    color: "var(--color-text)",
                  }}
                />
              </div>
            ))}
            <Btn onClick={handleBuild} primary>Build</Btn>
          </div>
        </div>

        {/* Message */}
        <div className="rounded-lg px-4 py-3 text-sm min-h-10" style={{ background: "var(--color-surface-2)", color: "var(--color-accent)" }}>
          {message}
        </div>

        {/* SVG Canvas */}
        <div
          className="rounded-xl overflow-auto"
          style={{
            background: "var(--color-surface-1)",
            border: "1px solid var(--color-border)",
            minHeight: 200,
            padding: "16px 8px",
          }}
        >
          <SegTreeSVG root={displayRoot} highlighted={highlighted} updated={updatedNodes} />
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-4">
          {[
            { label: "queried path", color: "rgba(124,106,247,0.5)", stroke: "var(--color-accent)" },
            { label: "update path", color: "rgba(34,197,94,0.3)", stroke: "#22c55e" },
            { label: "leaf", color: "var(--color-surface-3)", stroke: "var(--color-border)" },
            { label: "internal", color: "var(--color-surface-2)", stroke: "var(--color-border)" },
          ].map(({ label, color, stroke }) => (
            <div key={label} className="flex items-center gap-1.5">
              <div className="w-6 h-3 rounded" style={{ background: color, border: `1.5px solid ${stroke}` }} />
              <span className="text-xs" style={{ color: "var(--color-muted)" }}>{label}</span>
            </div>
          ))}
        </div>

        {/* Query/Update controls */}
        <div className="flex flex-wrap gap-4">
          {/* Query */}
          <div className="flex flex-wrap gap-2 items-end">
            <div className="flex flex-col gap-1">
              <span className="text-xs" style={{ color: "var(--color-muted)" }}>Left index</span>
              <input
                type="number" min={0} max={arr.length - 1} value={queryL}
                onChange={(e) => setQueryL(e.target.value)}
                className="w-16 rounded-lg px-2 py-1.5 text-sm text-center outline-none"
                style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)", color: "var(--color-text)" }}
              />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs" style={{ color: "var(--color-muted)" }}>Right index</span>
              <input
                type="number" min={0} max={arr.length - 1} value={queryR}
                onChange={(e) => setQueryR(e.target.value)}
                className="w-16 rounded-lg px-2 py-1.5 text-sm text-center outline-none"
                style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)", color: "var(--color-text)" }}
              />
            </div>
            <Btn onClick={handleQuery} disabled={!root}>Range Sum Query</Btn>
          </div>

          {/* Update */}
          <div className="flex flex-wrap gap-2 items-end">
            <div className="flex flex-col gap-1">
              <span className="text-xs" style={{ color: "var(--color-muted)" }}>Index</span>
              <input
                type="number" min={0} max={arr.length - 1} value={updateIdx}
                onChange={(e) => setUpdateIdx(e.target.value)}
                className="w-16 rounded-lg px-2 py-1.5 text-sm text-center outline-none"
                style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)", color: "var(--color-text)" }}
              />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs" style={{ color: "var(--color-muted)" }}>New value</span>
              <input
                type="number" min={1} max={99} value={updateVal}
                onChange={(e) => setUpdateVal(e.target.value)}
                className="w-16 rounded-lg px-2 py-1.5 text-sm text-center outline-none"
                style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)", color: "var(--color-text)" }}
              />
            </div>
            <Btn onClick={handleUpdate} disabled={!root}>Point Update</Btn>
          </div>
        </div>

        {/* Playback */}
        {steps.length > 0 && (
          <div className="flex flex-wrap gap-2 items-center">
            <Btn
              onClick={() => setPlaying((p) => !p)}
              disabled={stepIdx >= steps.length - 1 && !playing}
              icon={playing ? <Pause size={13} /> : <Play size={13} />}
            >
              {playing ? "Pause" : "Play"}
            </Btn>
            <Btn onClick={() => setStepIdx((p) => Math.min(p + 1, steps.length - 1))} disabled={stepIdx >= steps.length - 1} icon={<SkipForward size={13} />}>
              Step
            </Btn>
            <Btn onClick={() => { setStepIdx(0); setPlaying(false); }} icon={<RotateCcw size={13} />}>
              Restart
            </Btn>
            <span className="text-xs" style={{ color: "var(--color-muted)" }}>
              Step {stepIdx + 1}/{steps.length}
            </span>
            <div className="flex items-center gap-2 ml-2">
              <span className="text-xs" style={{ color: "var(--color-muted)" }}>Speed</span>
              <input
                type="range" min={150} max={1200} step={50}
                value={1350 - speed}
                onChange={(e) => setSpeed(1350 - Number(e.target.value))}
                className="w-24"
              />
            </div>
          </div>
        )}

        {/* Info table */}
        <div className="grid grid-cols-2 gap-3 mt-2" style={{ maxWidth: 480 }}>
          {[
            { op: "build(arr)",    time: "O(n)",     desc: "Build tree from array" },
            { op: "query(l, r)",   time: "O(log n)", desc: "Range sum query" },
            { op: "update(i, v)",  time: "O(log n)", desc: "Point update" },
            { op: "Space",         time: "O(n)",     desc: "4n nodes in tree" },
          ].map(({ op, time, desc }) => (
            <div key={op} className="rounded-lg p-2.5" style={{ background: "var(--color-surface-2)" }}>
              <div className="text-xs font-mono" style={{ color: "var(--color-accent)" }}>{op}</div>
              <div className="text-xs font-bold" style={{ color: "var(--color-text)" }}>{time}</div>
              <div className="text-xs" style={{ color: "var(--color-muted)" }}>{desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
