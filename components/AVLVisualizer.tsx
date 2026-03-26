"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { GitMerge, Play, Pause, SkipForward, RotateCcw, Zap } from "lucide-react";

// ── AVL data structure ────────────────────────────────────────────────────────

interface AVLNode {
  val: number;
  left: AVLNode | null;
  right: AVLNode | null;
  height: number;
  id: string;
}

let avlCounter = 0;
function makeAVL(val: number): AVLNode {
  return { val, left: null, right: null, height: 1, id: `avl_${avlCounter++}` };
}

function cloneAVL(n: AVLNode | null): AVLNode | null {
  if (!n) return null;
  return { ...n, left: cloneAVL(n.left), right: cloneAVL(n.right) };
}

function height(n: AVLNode | null): number {
  return n ? n.height : 0;
}

function bf(n: AVLNode | null): number {
  return n ? height(n.left) - height(n.right) : 0;
}

function updateHeight(n: AVLNode): AVLNode {
  return { ...n, height: 1 + Math.max(height(n.left), height(n.right)) };
}

function rotateRight(y: AVLNode): AVLNode {
  const x = y.left!;
  const T2 = x.right;
  const newY = updateHeight({ ...y, left: T2 });
  const newX = updateHeight({ ...x, right: newY });
  return newX;
}

function rotateLeft(x: AVLNode): AVLNode {
  const y = x.right!;
  const T2 = y.left;
  const newX = updateHeight({ ...x, right: T2 });
  const newY = updateHeight({ ...y, left: newX });
  return newY;
}

function balance(n: AVLNode): AVLNode {
  const b = bf(n);
  if (b > 1) {
    if (bf(n.left) < 0) {
      // LR
      return rotateRight(updateHeight({ ...n, left: rotateLeft(n.left!) }));
    }
    // LL
    return rotateRight(n);
  }
  if (b < -1) {
    if (bf(n.right) > 0) {
      // RL
      return rotateLeft(updateHeight({ ...n, right: rotateRight(n.right!) }));
    }
    // RR
    return rotateLeft(n);
  }
  return n;
}

function avlInsert(n: AVLNode | null, val: number): AVLNode {
  if (!n) return makeAVL(val);
  if (val < n.val) return balance(updateHeight({ ...n, left: avlInsert(n.left, val) }));
  if (val > n.val) return balance(updateHeight({ ...n, right: avlInsert(n.right, val) }));
  return n;
}

function minNode(n: AVLNode): AVLNode {
  return n.left ? minNode(n.left) : n;
}

function avlDelete(n: AVLNode | null, val: number): AVLNode | null {
  if (!n) return null;
  if (val < n.val) return balance(updateHeight({ ...n, left: avlDelete(n.left, val) }));
  if (val > n.val) return balance(updateHeight({ ...n, right: avlDelete(n.right, val) }));
  if (!n.left) return n.right;
  if (!n.right) return n.left;
  const succ = minNode(n.right);
  return balance(updateHeight({ ...n, val: succ.val, right: avlDelete(n.right, succ.val) }));
}

// ── Determine rotation type ───────────────────────────────────────────────────

function rotationType(n: AVLNode): string | null {
  const b = bf(n);
  if (b > 1) return bf(n.left) < 0 ? "LR rotation" : "LL rotation";
  if (b < -1) return bf(n.right) > 0 ? "RL rotation" : "RR rotation";
  return null;
}

// ── Step types ────────────────────────────────────────────────────────────────

interface AVLStep {
  root: AVLNode | null;
  highlighted: string[];
  rotationType?: string;
  description: string;
}

// ── Insert steps ──────────────────────────────────────────────────────────────

function buildInsertSteps(root: AVLNode | null, val: number): { steps: AVLStep[]; newRoot: AVLNode | null } {
  const steps: AVLStep[] = [];
  steps.push({ root: cloneAVL(root), highlighted: [], description: `Inserting ${val}` });

  // Trace path
  const path: AVLNode[] = [];
  let cur = root;
  while (cur) {
    path.push(cur);
    if (val === cur.val) break;
    cur = val < cur.val ? cur.left : cur.right;
  }

  path.forEach((node, i) => {
    steps.push({
      root: cloneAVL(root),
      highlighted: [node.id],
      description: `${val} ${val < node.val ? "<" : val > node.val ? ">" : "="} ${node.val} — go ${val < node.val ? "left" : val > node.val ? "right" : "duplicate, skip"}`,
    });
  });

  const intermediate = avlInsert(root, val);
  steps.push({ root: cloneAVL(intermediate), highlighted: [], description: `Inserted ${val}, checking balance factors...` });

  // Check if rotation occurred
  function checkBalance(n: AVLNode | null): void {
    if (!n) return;
    const rot = rotationType(n);
    if (rot) {
      steps.push({
        root: cloneAVL(intermediate),
        highlighted: [n.id],
        rotationType: rot,
        description: `Node ${n.val} imbalanced (BF=${bf(n)}) — performing ${rot}`,
      });
    }
    checkBalance(n.left);
    checkBalance(n.right);
  }
  checkBalance(intermediate);

  const newRoot = intermediate;
  steps.push({ root: cloneAVL(newRoot), highlighted: [], description: `Tree balanced. Height = ${height(newRoot)}` });
  return { steps, newRoot };
}

function buildDeleteSteps(root: AVLNode | null, val: number): { steps: AVLStep[]; newRoot: AVLNode | null } {
  const steps: AVLStep[] = [];
  if (!root) {
    steps.push({ root: null, highlighted: [], description: `Tree is empty` });
    return { steps, newRoot: null };
  }

  steps.push({ root: cloneAVL(root), highlighted: [], description: `Deleting ${val}` });

  // Highlight node to delete
  function findNode(n: AVLNode | null): AVLNode | null {
    if (!n) return null;
    if (n.val === val) return n;
    return val < n.val ? findNode(n.left) : findNode(n.right);
  }
  const target = findNode(root);
  if (target) {
    steps.push({ root: cloneAVL(root), highlighted: [target.id], description: `Found node ${val} — removing` });
  } else {
    steps.push({ root: cloneAVL(root), highlighted: [], description: `${val} not found in tree` });
    return { steps, newRoot: root };
  }

  const newRoot = avlDelete(root, val);
  steps.push({ root: cloneAVL(newRoot), highlighted: [], description: `Deleted ${val}, re-balancing...` });
  steps.push({ root: cloneAVL(newRoot), highlighted: [], description: `Tree balanced. Height = ${height(newRoot)}` });
  return { steps, newRoot };
}

// ── SVG Layout ────────────────────────────────────────────────────────────────

interface LayoutAVL {
  id: string;
  val: number;
  bfVal: number;
  x: number;
  y: number;
  parentX: number | null;
  parentY: number | null;
}

const AVL_R = 22;
const AVL_LEVEL_H = 80;
const AVL_H_GAP = 52;

function layoutAVL(root: AVLNode | null): LayoutAVL[] {
  const result: LayoutAVL[] = [];
  if (!root) return result;

  const xMap = new Map<string, number>();
  let xCounter = 0;
  function inOrder(n: AVLNode | null) {
    if (!n) return;
    inOrder(n.left);
    xMap.set(n.id, xCounter++ * AVL_H_GAP);
    inOrder(n.right);
  }
  inOrder(root);

  function assign(n: AVLNode | null, depth: number, pX: number | null, pY: number | null) {
    if (!n) return;
    const x = xMap.get(n.id)!;
    const y = depth * AVL_LEVEL_H;
    result.push({ id: n.id, val: n.val, bfVal: bf(n), x, y, parentX: pX, parentY: pY });
    assign(n.left, depth + 1, x, y);
    assign(n.right, depth + 1, x, y);
  }
  assign(root, 0, null, null);
  return result;
}

// ── SVG Renderer ──────────────────────────────────────────────────────────────

function AVLSVG({
  root,
  highlighted,
  rotLabel,
}: {
  root: AVLNode | null;
  highlighted: string[];
  rotLabel?: string;
}) {
  const nodes = layoutAVL(root);
  if (nodes.length === 0) return (
    <div className="flex items-center justify-center h-32 text-sm" style={{ color: "var(--color-muted)" }}>
      Insert values to build the AVL tree.
    </div>
  );

  const hlSet = new Set(highlighted);
  const minX = Math.min(...nodes.map((n) => n.x));
  const maxX = Math.max(...nodes.map((n) => n.x));
  const maxY = Math.max(...nodes.map((n) => n.y));
  const offsetX = -minX + AVL_R + 12;
  const svgW = maxX - minX + AVL_R * 2 + 24;
  const svgH = maxY + AVL_R * 2 + 32;

  return (
    <svg width="100%" viewBox={`0 0 ${svgW} ${svgH}`} style={{ display: "block", overflow: "visible" }}>
      {/* Edges */}
      {nodes.map((n) => {
        if (n.parentX === null || n.parentY === null) return null;
        return (
          <line
            key={`e-${n.id}`}
            x1={n.parentX + offsetX}
            y1={n.parentY + AVL_R}
            x2={n.x + offsetX}
            y2={n.y - AVL_R}
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
        const bfAbs = Math.abs(n.bfVal);
        const bfOk = bfAbs <= 1;

        const fill = isHighlighted ? "var(--color-accent)" : "var(--color-surface-2)";
        const stroke = isHighlighted ? "var(--color-accent)" : bfOk ? "var(--color-border)" : "#ef4444";

        const bfBg = bfOk ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.25)";
        const bfColor = bfOk ? "#22c55e" : "#ef4444";

        return (
          <g key={n.id}>
            <circle cx={cx} cy={cy} r={AVL_R} fill={fill} stroke={stroke} strokeWidth={2} />
            <text
              x={cx} y={cy}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={13}
              fontWeight="bold"
              fontFamily="monospace"
              fill={isHighlighted ? "#fff" : "var(--color-text)"}
            >
              {n.val}
            </text>
            {/* BF badge */}
            <rect
              x={cx + AVL_R - 2}
              y={cy - AVL_R - 2}
              width={20}
              height={14}
              rx={4}
              fill={bfBg}
              stroke={bfColor}
              strokeWidth={1}
            />
            <text
              x={cx + AVL_R + 8}
              y={cy - AVL_R + 5}
              textAnchor="middle"
              fontSize={8}
              fontWeight="bold"
              fontFamily="monospace"
              fill={bfColor}
            >
              {n.bfVal > 0 ? `+${n.bfVal}` : n.bfVal}
            </text>
          </g>
        );
      })}

      {/* Rotation label overlay */}
      {rotLabel && (
        <text
          x={svgW / 2}
          y={16}
          textAnchor="middle"
          fontSize={13}
          fontWeight="bold"
          fontFamily="monospace"
          fill="#f59e0b"
        >
          {rotLabel}
        </text>
      )}
    </svg>
  );
}

// ── Button ────────────────────────────────────────────────────────────────────

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

export default function AVLVisualizer() {
  const [avlRoot, setAvlRoot] = useState<AVLNode | null>(null);
  const [insertVal, setInsertVal] = useState("");
  const [deleteVal, setDeleteVal] = useState("");
  const [steps, setSteps] = useState<AVLStep[]>([]);
  const [stepIdx, setStepIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(700);
  const [message, setMessage] = useState("Insert values or use Auto-Demo to see rotations.");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const currentStep = steps[stepIdx] ?? null;
  const displayRoot = currentStep ? currentStep.root : avlRoot;
  const highlighted = currentStep ? currentStep.highlighted : [];
  const rotLabel = currentStep?.rotationType;

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

  const startAnimation = useCallback((newSteps: AVLStep[]) => {
    setSteps(newSteps);
    setStepIdx(0);
    setPlaying(false);
    if (newSteps.length > 0) setMessage(newSteps[0].description);
  }, []);

  const handleInsert = useCallback(() => {
    const v = parseInt(insertVal, 10);
    if (isNaN(v)) return;
    const { steps: s, newRoot } = buildInsertSteps(avlRoot, v);
    startAnimation(s);
    setAvlRoot(newRoot);
    setInsertVal("");
  }, [insertVal, avlRoot, startAnimation]);

  const handleDelete = useCallback(() => {
    const v = parseInt(deleteVal, 10);
    if (isNaN(v)) return;
    const { steps: s, newRoot } = buildDeleteSteps(avlRoot, v);
    startAnimation(s);
    setAvlRoot(newRoot);
    setDeleteVal("");
  }, [deleteVal, avlRoot, startAnimation]);

  const handleAutoDemo = useCallback(() => {
    avlCounter = 0;
    const demoVals = [10, 20, 30, 40, 50, 25];
    setMessage("Auto-demo: inserting [10, 20, 30, 40, 50, 25]...");
    let root: AVLNode | null = null;
    const allSteps: AVLStep[] = [];
    for (const v of demoVals) {
      const { steps: s, newRoot } = buildInsertSteps(root, v);
      allSteps.push(...s);
      root = newRoot;
    }
    setAvlRoot(root);
    startAnimation(allSteps);
  }, [startAnimation]);

  const handleReset = useCallback(() => {
    avlCounter = 0;
    setAvlRoot(null);
    setSteps([]);
    setStepIdx(0);
    setPlaying(false);
    setMessage("Tree cleared.");
  }, []);

  return (
    <div className="flex flex-col min-h-dvh" style={{ background: "var(--color-bg)" }}>
      {/* Header */}
      <div className="px-5 pt-6 pb-4" style={{ borderBottom: "1px solid var(--color-border)" }}>
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <GitMerge size={20} style={{ color: "var(--color-accent)", flexShrink: 0 }} strokeWidth={1.75} />
          <h1 className="text-2xl font-bold">AVL Tree</h1>
          <span className="text-xs font-mono px-2 py-0.5 rounded-full" style={{ background: "rgba(124,106,247,0.15)", color: "var(--color-accent)" }}>Self-Balancing BST</span>
          <span className="text-xs font-mono px-2 py-0.5 rounded-full" style={{ background: "rgba(167,139,250,0.12)", color: "#a78bfa" }}>O(log n)</span>
        </div>
        <p className="text-sm" style={{ color: "var(--color-muted)" }}>
          A self-balancing BST where every node&apos;s balance factor (BF = left height − right height) stays within &#123;-1, 0, 1&#125;.
        </p>
      </div>

      <div className="flex-1 px-5 pt-5 pb-4 flex flex-col gap-4">
        {/* Message */}
        <div className="rounded-lg px-4 py-3 text-sm min-h-10" style={{ background: "var(--color-surface-2)", color: "var(--color-accent)" }}>
          {rotLabel ? <span style={{ color: "#f59e0b" }}>{rotLabel} — </span> : null}{message}
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
          <AVLSVG root={displayRoot} highlighted={highlighted} rotLabel={rotLabel} />
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-4">
          {[
            { label: "highlighted node", color: "var(--color-accent)" },
            { label: "BF ∈ {-1,0,1} (ok)", color: "rgba(34,197,94,0.4)", badge: true, badgeColor: "#22c55e" },
            { label: "|BF| > 1 (imbalanced)", color: "rgba(239,68,68,0.2)", badge: true, badgeColor: "#ef4444" },
          ].map(({ label, color, badge, badgeColor }) => (
            <div key={label} className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full" style={{ background: color, border: badge ? `1.5px solid ${badgeColor}` : undefined }} />
              <span className="text-xs" style={{ color: "var(--color-muted)" }}>{label}</span>
            </div>
          ))}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-mono px-1 rounded" style={{ background: "rgba(245,158,11,0.2)", color: "#f59e0b" }}>BF</span>
            <span className="text-xs" style={{ color: "var(--color-muted)" }}>= balance factor badge on each node</span>
          </div>
        </div>

        {/* Insert / Delete controls */}
        <div className="flex flex-wrap gap-4">
          <div className="flex gap-2 items-center">
            <input
              type="number"
              value={insertVal}
              onChange={(e) => setInsertVal(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleInsert(); }}
              placeholder="e.g. 42"
              className="rounded-lg px-3 py-2 text-sm w-24 outline-none"
              style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)", color: "var(--color-text)" }}
            />
            <Btn onClick={handleInsert} primary>Insert</Btn>
          </div>
          <div className="flex gap-2 items-center">
            <input
              type="number"
              value={deleteVal}
              onChange={(e) => setDeleteVal(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleDelete(); }}
              placeholder="e.g. 30"
              className="rounded-lg px-3 py-2 text-sm w-24 outline-none"
              style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)", color: "var(--color-text)" }}
            />
            <Btn onClick={handleDelete}>Delete</Btn>
          </div>
          <Btn onClick={handleAutoDemo} icon={<Zap size={13} />}>Auto-Demo</Btn>
          <Btn onClick={handleReset} icon={<RotateCcw size={13} />}>Clear</Btn>
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
            <Btn
              onClick={() => setStepIdx((p) => Math.min(p + 1, steps.length - 1))}
              disabled={stepIdx >= steps.length - 1}
              icon={<SkipForward size={13} />}
            >
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

        {/* Rotation guide */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--color-muted)" }}>
            Rotation types
          </p>
          <div className="grid grid-cols-2 gap-3" style={{ maxWidth: 480 }}>
            {[
              { type: "LL rotation", trigger: "BF > 1, left-heavy left child", fix: "rotateRight(node)" },
              { type: "RR rotation", trigger: "BF < -1, right-heavy right child", fix: "rotateLeft(node)" },
              { type: "LR rotation", trigger: "BF > 1, right-heavy left child", fix: "rotateLeft(left) → rotateRight(node)" },
              { type: "RL rotation", trigger: "BF < -1, left-heavy right child", fix: "rotateRight(right) → rotateLeft(node)" },
            ].map(({ type, trigger, fix }) => (
              <div key={type} className="rounded-lg p-2.5" style={{ background: "var(--color-surface-2)" }}>
                <div className="text-xs font-mono font-bold" style={{ color: "#f59e0b" }}>{type}</div>
                <div className="text-xs" style={{ color: "var(--color-muted)" }}>{trigger}</div>
                <div className="text-xs font-mono mt-0.5" style={{ color: "var(--color-accent)" }}>{fix}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
