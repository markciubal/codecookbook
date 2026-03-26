"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { TreeDeciduous, Play, Pause, SkipForward, RotateCcw, Zap, Search } from "lucide-react";

// ── RB Node ───────────────────────────────────────────────────────────────────

interface RBNode {
  val: number;
  color: "red" | "black";
  left: RBNode | null;
  right: RBNode | null;
  parent: RBNode | null;
}

function makeRBNode(val: number): RBNode {
  return { val, color: "red", left: null, right: null, parent: null };
}

// Deep clone preserving parent pointers
function cloneRBTree(node: RBNode | null, parent: RBNode | null = null): RBNode | null {
  if (!node) return null;
  const cloned: RBNode = { val: node.val, color: node.color, left: null, right: null, parent };
  cloned.left = cloneRBTree(node.left, cloned);
  cloned.right = cloneRBTree(node.right, cloned);
  return cloned;
}

// ── Step type ─────────────────────────────────────────────────────────────────

type RBTPhase = "insert" | "search" | "recolor" | "rotate-left" | "rotate-right" | "done";

interface RBTStep {
  root: RBNode | null;
  highlightNodes: number[];
  highlightEdges: [number, number][];
  description: string;
  phase: RBTPhase;
}

// ── RB Tree operations (mutable, pointer-based) ───────────────────────────────

class RBTree {
  root: RBNode | null = null;

  private isRed(n: RBNode | null): boolean {
    return n !== null && n.color === "red";
  }

  private rotateLeft(x: RBNode): void {
    const y = x.right!;
    x.right = y.left;
    if (y.left) y.left.parent = x;
    y.parent = x.parent;
    if (!x.parent) {
      this.root = y;
    } else if (x === x.parent.left) {
      x.parent.left = y;
    } else {
      x.parent.right = y;
    }
    y.left = x;
    x.parent = y;
  }

  private rotateRight(x: RBNode): void {
    const y = x.left!;
    x.left = y.right;
    if (y.right) y.right.parent = x;
    y.parent = x.parent;
    if (!x.parent) {
      this.root = y;
    } else if (x === x.parent.right) {
      x.parent.right = y;
    } else {
      x.parent.left = y;
    }
    y.right = x;
    x.parent = y;
  }

  insert(val: number): RBTStep[] {
    const steps: RBTStep[] = [];

    // Check duplicate
    if (this.find(this.root, val)) {
      steps.push({
        root: cloneRBTree(this.root),
        highlightNodes: [val],
        highlightEdges: [],
        description: `${val} is already in the tree — duplicates not inserted.`,
        phase: "done",
      });
      return steps;
    }

    steps.push({
      root: cloneRBTree(this.root),
      highlightNodes: [],
      highlightEdges: [],
      description: `Inserting ${val}: standard BST insert, new node starts Red.`,
      phase: "insert",
    });

    // BST insert
    const z = makeRBNode(val);
    let y: RBNode | null = null;
    let x: RBNode | null = this.root;
    const path: number[] = [];

    while (x !== null) {
      path.push(x.val);
      y = x;
      if (z.val < x.val) {
        x = x.left;
      } else {
        x = x.right;
      }
    }

    z.parent = y;
    if (!y) {
      this.root = z;
    } else if (z.val < y.val) {
      y.left = z;
    } else {
      y.right = z;
    }

    steps.push({
      root: cloneRBTree(this.root),
      highlightNodes: [...path, val],
      highlightEdges: [],
      description: `Placed ${val} as Red node after traversing [${path.join(" → ")}].`,
      phase: "insert",
    });

    // Fix-up
    this.insertFixupWithSteps(z, steps);

    // Ensure root is black
    this.root!.color = "black";
    steps.push({
      root: cloneRBTree(this.root),
      highlightNodes: [this.root!.val],
      highlightEdges: [],
      description: `Fix-up complete. Root is set Black. Tree is valid.`,
      phase: "done",
    });

    return steps;
  }

  private insertFixupWithSteps(z: RBNode, steps: RBTStep[]): void {
    while (z.parent && z.parent.color === "red") {
      const parent = z.parent;
      const grandparent = parent.parent;
      if (!grandparent) break;

      if (parent === grandparent.left) {
        const uncle = grandparent.right;

        if (this.isRed(uncle)) {
          // Case 1: Uncle is Red → recolor
          steps.push({
            root: cloneRBTree(this.root),
            highlightNodes: [z.val, parent.val, uncle!.val, grandparent.val],
            highlightEdges: [[grandparent.val, parent.val], [grandparent.val, uncle!.val]],
            description: `Case 1 (Uncle Red): Recolor parent (${parent.val}) and uncle (${uncle!.val}) to Black, grandparent (${grandparent.val}) to Red. Move z up to grandparent.`,
            phase: "recolor",
          });
          parent.color = "black";
          uncle!.color = "black";
          grandparent.color = "red";
          z = grandparent;
        } else {
          if (z === parent.right) {
            // Case 2: Uncle Black, zig-zag (LR) → rotate parent left
            steps.push({
              root: cloneRBTree(this.root),
              highlightNodes: [z.val, parent.val, grandparent.val],
              highlightEdges: [[grandparent.val, parent.val], [parent.val, z.val]],
              description: `Case 2 (Uncle Black, zig-zag LR): Rotate Left at parent (${parent.val}) to straighten into Case 3.`,
              phase: "rotate-left",
            });
            z = parent;
            this.rotateLeft(z);
          }
          // Case 3: Uncle Black, straight (LL) → rotate grandparent right
          const newParent = z.parent!;
          const newGrandparent = newParent.parent!;
          steps.push({
            root: cloneRBTree(this.root),
            highlightNodes: [z.val, newParent.val, newGrandparent.val],
            highlightEdges: [[newGrandparent.val, newParent.val]],
            description: `Case 3 (Uncle Black, straight LL): Recolor parent (${newParent.val}) Black, grandparent (${newGrandparent.val}) Red, then Rotate Right at grandparent.`,
            phase: "rotate-right",
          });
          newParent.color = "black";
          newGrandparent.color = "red";
          this.rotateRight(newGrandparent);
        }
      } else {
        // Mirror: parent is right child of grandparent
        const uncle = grandparent.left;

        if (this.isRed(uncle)) {
          // Case 1 mirror: Uncle is Red → recolor
          steps.push({
            root: cloneRBTree(this.root),
            highlightNodes: [z.val, parent.val, uncle!.val, grandparent.val],
            highlightEdges: [[grandparent.val, parent.val], [grandparent.val, uncle!.val]],
            description: `Case 1 (Uncle Red): Recolor parent (${parent.val}) and uncle (${uncle!.val}) to Black, grandparent (${grandparent.val}) to Red. Move z up to grandparent.`,
            phase: "recolor",
          });
          parent.color = "black";
          uncle!.color = "black";
          grandparent.color = "red";
          z = grandparent;
        } else {
          if (z === parent.left) {
            // Case 2 mirror: Uncle Black, zig-zag (RL) → rotate parent right
            steps.push({
              root: cloneRBTree(this.root),
              highlightNodes: [z.val, parent.val, grandparent.val],
              highlightEdges: [[grandparent.val, parent.val], [parent.val, z.val]],
              description: `Case 2 (Uncle Black, zig-zag RL): Rotate Right at parent (${parent.val}) to straighten into Case 3.`,
              phase: "rotate-right",
            });
            z = parent;
            this.rotateRight(z);
          }
          // Case 3 mirror: Uncle Black, straight (RR) → rotate grandparent left
          const newParent = z.parent!;
          const newGrandparent = newParent.parent!;
          steps.push({
            root: cloneRBTree(this.root),
            highlightNodes: [z.val, newParent.val, newGrandparent.val],
            highlightEdges: [[newGrandparent.val, newParent.val]],
            description: `Case 3 (Uncle Black, straight RR): Recolor parent (${newParent.val}) Black, grandparent (${newGrandparent.val}) Red, then Rotate Left at grandparent.`,
            phase: "rotate-left",
          });
          newParent.color = "black";
          newGrandparent.color = "red";
          this.rotateLeft(newGrandparent);
        }
      }
    }
  }

  private find(node: RBNode | null, val: number): RBNode | null {
    if (!node) return null;
    if (val === node.val) return node;
    return val < node.val ? this.find(node.left, val) : this.find(node.right, val);
  }

  search(val: number): RBTStep[] {
    const steps: RBTStep[] = [];
    steps.push({
      root: cloneRBTree(this.root),
      highlightNodes: [],
      highlightEdges: [],
      description: `Searching for ${val}...`,
      phase: "search",
    });

    let cur = this.root;
    const path: number[] = [];
    while (cur) {
      path.push(cur.val);
      const edges: [number, number][] = path.length > 1 ? [[path[path.length - 2], cur.val]] : [];
      if (cur.val === val) {
        steps.push({
          root: cloneRBTree(this.root),
          highlightNodes: [...path],
          highlightEdges: edges,
          description: `Found ${val}! Path: [${path.join(" → ")}].`,
          phase: "done",
        });
        return steps;
      }
      const dir = val < cur.val ? "left" : "right";
      steps.push({
        root: cloneRBTree(this.root),
        highlightNodes: [...path],
        highlightEdges: edges,
        description: `At ${cur.val}: ${val} ${val < cur.val ? "<" : ">"} ${cur.val} — go ${dir}.`,
        phase: "search",
      });
      cur = val < cur.val ? cur.left : cur.right;
    }
    steps.push({
      root: cloneRBTree(this.root),
      highlightNodes: path,
      highlightEdges: [],
      description: `${val} not found in the tree. Searched path: [${path.join(" → ")}].`,
      phase: "done",
    });
    return steps;
  }

  delete(val: number): RBTStep[] {
    const steps: RBTStep[] = [];
    const target = this.find(this.root, val);
    if (!target) {
      steps.push({
        root: cloneRBTree(this.root),
        highlightNodes: [],
        highlightEdges: [],
        description: `${val} not found — nothing to delete.`,
        phase: "done",
      });
      return steps;
    }

    steps.push({
      root: cloneRBTree(this.root),
      highlightNodes: [val],
      highlightEdges: [],
      description: `Deleting ${val}: found node to remove.`,
      phase: "insert",
    });

    this.rbDelete(target, steps);

    steps.push({
      root: cloneRBTree(this.root),
      highlightNodes: [],
      highlightEdges: [],
      description: `Delete complete. Tree re-balanced and invariants restored.`,
      phase: "done",
    });

    return steps;
  }

  private minimum(node: RBNode): RBNode {
    let cur = node;
    while (cur.left) cur = cur.left;
    return cur;
  }

  private transplant(u: RBNode, v: RBNode | null): void {
    if (!u.parent) {
      this.root = v;
    } else if (u === u.parent.left) {
      u.parent.left = v;
    } else {
      u.parent.right = v;
    }
    if (v) v.parent = u.parent;
  }

  // Sentinel nil node for delete fix-up
  private nil: RBNode = { val: -Infinity, color: "black", left: null, right: null, parent: null };

  private rbDelete(z: RBNode, steps: RBTStep[]): void {
    let y = z;
    let yOrigColor = y.color;
    let x: RBNode;

    if (!z.left) {
      x = z.right ?? this.nil;
      if (!z.right) x.parent = z.parent;
      this.transplant(z, z.right);
    } else if (!z.right) {
      x = z.left;
      this.transplant(z, z.left);
    } else {
      y = this.minimum(z.right);
      yOrigColor = y.color;
      x = y.right ?? this.nil;

      steps.push({
        root: cloneRBTree(this.root),
        highlightNodes: [z.val, y.val],
        highlightEdges: [],
        description: `Node ${z.val} has two children — replacing with in-order successor ${y.val}.`,
        phase: "insert",
      });

      if (y.parent === z) {
        if (x === this.nil) x.parent = y;
      } else {
        if (x === this.nil) x.parent = y.parent;
        this.transplant(y, y.right);
        y.right = z.right;
        if (y.right) y.right.parent = y;
      }
      this.transplant(z, y);
      y.left = z.left;
      if (y.left) y.left.parent = y;
      y.color = z.color;
    }

    if (yOrigColor === "black") {
      this.deleteFixupWithSteps(x, steps);
    }
  }

  private deleteFixupWithSteps(x: RBNode, steps: RBTStep[]): void {
    while (x !== this.root && x.color === "black") {
      const parent = x.parent;
      if (!parent) break;

      if (x === parent.left) {
        let w = parent.right;
        if (!w) break;

        if (w.color === "red") {
          steps.push({
            root: cloneRBTree(this.root),
            highlightNodes: [parent.val, w.val],
            highlightEdges: [[parent.val, w.val]],
            description: `Delete Case 1: Sibling (${w.val}) is Red — recolor and rotate left at parent (${parent.val}).`,
            phase: "rotate-left",
          });
          w.color = "black";
          parent.color = "red";
          this.rotateLeft(parent);
          w = parent.right!;
        }

        if ((!w.left || w.left.color === "black") && (!w.right || w.right.color === "black")) {
          steps.push({
            root: cloneRBTree(this.root),
            highlightNodes: [parent.val, w.val],
            highlightEdges: [[parent.val, w.val]],
            description: `Delete Case 2: Both sibling's children Black — recolor sibling (${w.val}) Red, move up.`,
            phase: "recolor",
          });
          w.color = "red";
          x = parent;
        } else {
          if (!w.right || w.right.color === "black") {
            steps.push({
              root: cloneRBTree(this.root),
              highlightNodes: [w.val],
              highlightEdges: [[parent.val, w.val]],
              description: `Delete Case 3: Sibling's right child Black — recolor sibling's left, rotate right at sibling (${w.val}).`,
              phase: "rotate-right",
            });
            if (w.left) w.left.color = "black";
            w.color = "red";
            this.rotateRight(w);
            w = parent.right!;
          }
          steps.push({
            root: cloneRBTree(this.root),
            highlightNodes: [parent.val, w.val],
            highlightEdges: [[parent.val, w.val]],
            description: `Delete Case 4: Rotate left at parent (${parent.val}), recolor sibling and parent.`,
            phase: "rotate-left",
          });
          w.color = parent.color;
          parent.color = "black";
          if (w.right) w.right.color = "black";
          this.rotateLeft(parent);
          x = this.root!;
        }
      } else {
        // Mirror
        let w = parent.left;
        if (!w) break;

        if (w.color === "red") {
          steps.push({
            root: cloneRBTree(this.root),
            highlightNodes: [parent.val, w.val],
            highlightEdges: [[parent.val, w.val]],
            description: `Delete Case 1 (mirror): Sibling (${w.val}) is Red — recolor and rotate right at parent (${parent.val}).`,
            phase: "rotate-right",
          });
          w.color = "black";
          parent.color = "red";
          this.rotateRight(parent);
          w = parent.left!;
        }

        if ((!w.right || w.right.color === "black") && (!w.left || w.left.color === "black")) {
          steps.push({
            root: cloneRBTree(this.root),
            highlightNodes: [parent.val, w.val],
            highlightEdges: [[parent.val, w.val]],
            description: `Delete Case 2 (mirror): Both sibling's children Black — recolor sibling (${w.val}) Red, move up.`,
            phase: "recolor",
          });
          w.color = "red";
          x = parent;
        } else {
          if (!w.left || w.left.color === "black") {
            steps.push({
              root: cloneRBTree(this.root),
              highlightNodes: [w.val],
              highlightEdges: [[parent.val, w.val]],
              description: `Delete Case 3 (mirror): Sibling's left child Black — rotate left at sibling (${w.val}).`,
              phase: "rotate-left",
            });
            if (w.right) w.right.color = "black";
            w.color = "red";
            this.rotateLeft(w);
            w = parent.left!;
          }
          steps.push({
            root: cloneRBTree(this.root),
            highlightNodes: [parent.val, w.val],
            highlightEdges: [[parent.val, w.val]],
            description: `Delete Case 4 (mirror): Rotate right at parent (${parent.val}), recolor sibling and parent.`,
            phase: "rotate-right",
          });
          w.color = parent.color;
          parent.color = "black";
          if (w.left) w.left.color = "black";
          this.rotateRight(parent);
          x = this.root!;
        }
      }
    }
    x.color = "black";
  }
}

// ── Invariant checker ─────────────────────────────────────────────────────────

interface Invariants {
  rootIsBlack: boolean;
  noConsecutiveReds: boolean;
  blackHeightConsistent: boolean;
}

function checkInvariants(root: RBNode | null): Invariants {
  if (!root) return { rootIsBlack: true, noConsecutiveReds: true, blackHeightConsistent: true };

  const rootIsBlack = root.color === "black";

  let noConsecutiveReds = true;
  function checkReds(n: RBNode | null): void {
    if (!n) return;
    if (n.color === "red") {
      if ((n.left && n.left.color === "red") || (n.right && n.right.color === "red")) {
        noConsecutiveReds = false;
      }
    }
    checkReds(n.left);
    checkReds(n.right);
  }
  checkReds(root);

  let blackHeightConsistent = true;
  function blackHeight(n: RBNode | null): number {
    if (!n) return 1; // nil counts as black
    const lh = blackHeight(n.left);
    const rh = blackHeight(n.right);
    if (lh !== rh) blackHeightConsistent = false;
    return (n.color === "black" ? 1 : 0) + lh;
  }
  blackHeight(root);

  return { rootIsBlack, noConsecutiveReds, blackHeightConsistent };
}

// ── SVG layout ────────────────────────────────────────────────────────────────

interface LayoutRB {
  val: number;
  color: "red" | "black";
  x: number;
  y: number;
  parentX: number | null;
  parentY: number | null;
  parentVal: number | null;
}

const RB_R = 22;
const RB_LEVEL_H = 80;
const RB_H_GAP = 52;

function layoutRB(root: RBNode | null): LayoutRB[] {
  const result: LayoutRB[] = [];
  if (!root) return result;

  // Assign x positions via in-order traversal
  const xMap = new Map<number, number>();
  // We need unique keys — use a path-based key for duplicate protection
  // Since RB trees don't have duplicates, val is unique
  let xCounter = 0;
  function inOrder(n: RBNode | null): void {
    if (!n) return;
    inOrder(n.left);
    xMap.set(n.val, xCounter++ * RB_H_GAP);
    inOrder(n.right);
  }
  inOrder(root);

  function assign(n: RBNode | null, depth: number, pX: number | null, pY: number | null, pVal: number | null): void {
    if (!n) return;
    const x = xMap.get(n.val)!;
    const y = depth * RB_LEVEL_H;
    result.push({ val: n.val, color: n.color, x, y, parentX: pX, parentY: pY, parentVal: pVal });
    assign(n.left, depth + 1, x, y, n.val);
    assign(n.right, depth + 1, x, y, n.val);
  }
  assign(root, 0, null, null, null);
  return result;
}

// ── SVG Renderer ──────────────────────────────────────────────────────────────

function RBSVG({
  root,
  highlightNodes,
  highlightEdges,
  phaseLabel,
}: {
  root: RBNode | null;
  highlightNodes: number[];
  highlightEdges: [number, number][];
  phaseLabel?: string;
}) {
  const nodes = layoutRB(root);

  if (nodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-sm" style={{ color: "var(--color-muted)" }}>
        Insert values to build the Red-Black Tree.
      </div>
    );
  }

  const hlNodeSet = new Set(highlightNodes);
  const hlEdgeSet = new Set(highlightEdges.map(([p, c]) => `${p}-${c}`));

  const minX = Math.min(...nodes.map((n) => n.x));
  const maxX = Math.max(...nodes.map((n) => n.x));
  const maxY = Math.max(...nodes.map((n) => n.y));
  const offsetX = -minX + RB_R + 16;
  const svgW = Math.max(maxX - minX + RB_R * 2 + 32, 200);
  const svgH = maxY + RB_R * 2 + 40;

  return (
    <svg width="100%" viewBox={`0 0 ${svgW} ${svgH}`} style={{ display: "block", overflow: "visible" }}>
      {/* Edges */}
      {nodes.map((n) => {
        if (n.parentX === null || n.parentY === null || n.parentVal === null) return null;
        const edgeKey = `${n.parentVal}-${n.val}`;
        const isHighlighted = hlEdgeSet.has(edgeKey);
        return (
          <line
            key={`e-${n.val}`}
            x1={n.parentX + offsetX}
            y1={n.parentY + RB_R}
            x2={n.x + offsetX}
            y2={n.y - RB_R}
            stroke={isHighlighted ? "#f59e0b" : "var(--color-border)"}
            strokeWidth={isHighlighted ? 3 : 2}
          />
        );
      })}

      {/* Nodes */}
      {nodes.map((n) => {
        const cx = n.x + offsetX;
        const cy = n.y;
        const isHighlighted = hlNodeSet.has(n.val);

        // Node fill colors
        const fillRed = "#ef4444";
        const fillBlack = "#1e293b";
        const fill = n.color === "red" ? fillRed : fillBlack;

        // Stroke: highlighted = golden accent, else subtle border
        const stroke = isHighlighted ? "#f59e0b" : n.color === "red" ? "#dc2626" : "#475569";
        const strokeWidth = isHighlighted ? 3.5 : 2;

        return (
          <g key={`n-${n.val}`}>
            {/* Glow for highlighted */}
            {isHighlighted && (
              <circle cx={cx} cy={cy} r={RB_R + 6} fill={n.color === "red" ? "rgba(239,68,68,0.2)" : "rgba(245,158,11,0.2)"} />
            )}
            <circle cx={cx} cy={cy} r={RB_R} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />
            <text
              x={cx}
              y={cy}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={13}
              fontWeight="bold"
              fontFamily="monospace"
              fill="#ffffff"
            >
              {n.val}
            </text>
          </g>
        );
      })}

      {/* Phase label */}
      {phaseLabel && (
        <text
          x={svgW / 2}
          y={16}
          textAnchor="middle"
          fontSize={12}
          fontWeight="bold"
          fontFamily="monospace"
          fill="#f59e0b"
        >
          {phaseLabel}
        </text>
      )}
    </svg>
  );
}

// ── Phase label helper ────────────────────────────────────────────────────────

const PHASE_LABELS: Record<RBTPhase, string> = {
  insert: "BST Insert",
  search: "Searching",
  recolor: "Recoloring",
  "rotate-left": "Rotate Left",
  "rotate-right": "Rotate Right",
  done: "Done",
};

const PHASE_COLORS: Record<RBTPhase, string> = {
  insert: "#7c6af7",
  search: "#38bdf8",
  recolor: "#fb923c",
  "rotate-left": "#a78bfa",
  "rotate-right": "#a78bfa",
  done: "#22c55e",
};

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

// ── Main component ─────────────────────────────────────────────────────────────

const DEMO_VALS = [10, 20, 30, 15, 25, 5, 1, 7, 35, 40];


export default function RedBlackTreeVisualizer() {
  const [tree] = useState<RBTree>(() => {
    const t = new RBTree();
    for (const v of DEMO_VALS) t.insert(v);
    return t;
  });

  const [treeRoot, setTreeRoot] = useState<RBNode | null>(() => cloneRBTree(tree.root));
  const [steps, setSteps] = useState<RBTStep[]>([]);
  const [stepIdx, setStepIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(700);
  const [inputVal, setInputVal] = useState("");
  const [searchVal, setSearchVal] = useState("");
  const [deleteVal, setDeleteVal] = useState("");
  const [history, setHistory] = useState<string[]>([`Demo: inserted [${DEMO_VALS.join(", ")}]`]);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const currentStep = steps[stepIdx] ?? null;
  const displayRoot = currentStep ? currentStep.root : treeRoot;
  const highlightNodes = currentStep ? currentStep.highlightNodes : [];
  const highlightEdges = currentStep ? currentStep.highlightEdges : [];
  const description = currentStep ? currentStep.description : "Use the controls below to insert, search, or delete nodes.";
  const phase = currentStep ? currentStep.phase : "done";
  const phaseLabel = currentStep ? PHASE_LABELS[phase] : undefined;

  const invariants = checkInvariants(displayRoot);

  // Playback
  useEffect(() => {
    if (!isPlaying) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(() => {
      setStepIdx((prev) => {
        if (prev >= steps.length - 1) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, speed);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isPlaying, speed, steps.length]);

  const startAnimation = useCallback((newSteps: RBTStep[]) => {
    setSteps(newSteps);
    setStepIdx(0);
    setIsPlaying(false);
  }, []);

  const handleInsert = useCallback(() => {
    const v = parseInt(inputVal, 10);
    if (isNaN(v)) return;
    const s = tree.insert(v);
    startAnimation(s);
    setTreeRoot(cloneRBTree(tree.root));
    setHistory((h) => [`Inserted ${v}`, ...h].slice(0, 20));
    setInputVal("");
  }, [inputVal, tree, startAnimation]);

  const handleSearch = useCallback(() => {
    const v = parseInt(searchVal, 10);
    if (isNaN(v)) return;
    const s = tree.search(v);
    startAnimation(s);
    setHistory((h) => [`Searched ${v}`, ...h].slice(0, 20));
    setSearchVal("");
  }, [searchVal, tree, startAnimation]);

  const handleDelete = useCallback(() => {
    const v = parseInt(deleteVal, 10);
    if (isNaN(v)) return;
    const s = tree.delete(v);
    startAnimation(s);
    setTreeRoot(cloneRBTree(tree.root));
    setHistory((h) => [`Deleted ${v}`, ...h].slice(0, 20));
    setDeleteVal("");
  }, [deleteVal, tree, startAnimation]);

  const handleAutoDemo = useCallback(() => {
    // Reset and replay demo insertions with full animation steps
    const demoTree = new RBTree();
    const demoSteps: RBTStep[] = [];
    for (const v of DEMO_VALS) {
      const s = demoTree.insert(v);
      demoSteps.push(...s);
    }
    tree.root = demoTree.root;
    startAnimation(demoSteps);
    setTreeRoot(cloneRBTree(tree.root));
    setHistory([`Auto-Demo: inserted [${DEMO_VALS.join(", ")}]`]);
  }, [tree, startAnimation]);

  const handleReset = useCallback(() => {
    tree.root = null;
    setTreeRoot(null);
    setSteps([]);
    setStepIdx(0);
    setIsPlaying(false);
    setHistory(["Tree cleared."]);
  }, [tree]);

  // Tree height for display
  function treeHeight(n: RBNode | null): number {
    if (!n) return 0;
    return 1 + Math.max(treeHeight(n.left), treeHeight(n.right));
  }

  const height = treeHeight(displayRoot);

  return (
    <div className="flex flex-col min-h-dvh" style={{ background: "var(--color-bg)" }}>
      {/* Header */}
      <div className="px-5 pt-6 pb-4" style={{ borderBottom: "1px solid var(--color-border)" }}>
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <TreeDeciduous size={20} style={{ color: "var(--color-accent)", flexShrink: 0 }} strokeWidth={1.75} />
          <h1 className="text-2xl font-bold">Red-Black Tree</h1>
          <span className="text-xs font-mono px-2 py-0.5 rounded-full" style={{ background: "rgba(239,68,68,0.15)", color: "#ef4444" }}>
            Self-Balancing BST
          </span>
          <span className="text-xs font-mono px-2 py-0.5 rounded-full" style={{ background: "rgba(167,139,250,0.12)", color: "#a78bfa" }}>
            O(log n)
          </span>
          {height > 0 && (
            <span className="text-xs font-mono px-2 py-0.5 rounded-full" style={{ background: "rgba(34,197,94,0.12)", color: "#22c55e" }}>
              height = {height}
            </span>
          )}
        </div>
        <p className="text-sm" style={{ color: "var(--color-muted)" }}>
          A self-balancing BST where each node carries a color bit (Red or Black). Five invariants guarantee
          O(log n) height. Violations are fixed via recoloring and rotations.
        </p>
      </div>

      <div className="flex-1 px-5 pt-5 pb-4 flex flex-col gap-4">
        {/* Status message */}
        <div
          className="rounded-lg px-4 py-3 text-sm min-h-10 flex items-center gap-2"
          style={{ background: "var(--color-surface-2)" }}
        >
          {currentStep && (
            <span
              className="text-xs font-mono px-2 py-0.5 rounded-full font-bold shrink-0"
              style={{ background: `${PHASE_COLORS[phase]}22`, color: PHASE_COLORS[phase] }}
            >
              {phaseLabel}
            </span>
          )}
          <span style={{ color: "var(--color-accent)" }}>{description}</span>
        </div>

        {/* Main layout: SVG + side panels */}
        <div className="flex flex-col xl:flex-row gap-4">
          {/* SVG Canvas */}
          <div
            className="rounded-xl overflow-auto flex-1"
            style={{
              background: "var(--color-surface-1)",
              border: "1px solid var(--color-border)",
              minHeight: 200,
              padding: "16px 8px",
            }}
          >
            <RBSVG
              root={displayRoot}
              highlightNodes={highlightNodes}
              highlightEdges={highlightEdges}
              phaseLabel={phaseLabel}
            />
          </div>

          {/* Right panel */}
          <div className="flex flex-col gap-3 xl:w-64 shrink-0">
            {/* Invariants */}
            <div
              className="rounded-xl p-4"
              style={{ background: "var(--color-surface-1)", border: "1px solid var(--color-border)" }}
            >
              <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--color-muted)" }}>
                RB Invariants
              </p>
              {[
                { label: "Root is Black", ok: invariants.rootIsBlack },
                { label: "No consecutive Reds", ok: invariants.noConsecutiveReds },
                { label: "Black heights consistent", ok: invariants.blackHeightConsistent },
              ].map(({ label, ok }) => (
                <div key={label} className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-bold" style={{ color: ok ? "#22c55e" : "#ef4444" }}>
                    {ok ? "✓" : "✗"}
                  </span>
                  <span className="text-xs" style={{ color: ok ? "var(--color-text)" : "#ef4444" }}>
                    {label}
                  </span>
                </div>
              ))}
            </div>

            {/* Legend */}
            <div
              className="rounded-xl p-4"
              style={{ background: "var(--color-surface-1)", border: "1px solid var(--color-border)" }}
            >
              <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--color-muted)" }}>
                Legend
              </p>
              {[
                { label: "Red node", bg: "#ef4444", border: "#dc2626" },
                { label: "Black node", bg: "#1e293b", border: "#475569" },
                { label: "Highlighted", bg: "#1e293b", border: "#f59e0b", glow: true },
              ].map(({ label, bg, border, glow }) => (
                <div key={label} className="flex items-center gap-2 mb-2">
                  <div
                    className="w-4 h-4 rounded-full shrink-0"
                    style={{
                      background: bg,
                      border: `2px solid ${border}`,
                      boxShadow: glow ? `0 0 6px ${border}` : undefined,
                    }}
                  />
                  <span className="text-xs" style={{ color: "var(--color-muted)" }}>
                    {label}
                  </span>
                </div>
              ))}
              <div className="flex items-center gap-2">
                <div className="w-4 h-0.5 shrink-0" style={{ background: "#f59e0b" }} />
                <span className="text-xs" style={{ color: "var(--color-muted)" }}>Highlighted edge</span>
              </div>
            </div>

            {/* Operation log */}
            <div
              className="rounded-xl p-4 flex-1"
              style={{ background: "var(--color-surface-1)", border: "1px solid var(--color-border)" }}
            >
              <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--color-muted)" }}>
                Operation Log
              </p>
              <div className="flex flex-col gap-1 max-h-40 overflow-y-auto">
                {history.map((h, i) => (
                  <div
                    key={i}
                    className="text-xs font-mono px-2 py-1 rounded"
                    style={{
                      background: i === 0 ? "rgba(124,106,247,0.1)" : "transparent",
                      color: i === 0 ? "var(--color-accent)" : "var(--color-muted)",
                    }}
                  >
                    {h}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap gap-4">
          {/* Insert */}
          <div className="flex gap-2 items-center">
            <input
              type="number"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleInsert(); }}
              placeholder="e.g. 42"
              className="rounded-lg px-3 py-2 text-sm w-24 outline-none"
              style={{
                background: "var(--color-surface-2)",
                border: "1px solid var(--color-border)",
                color: "var(--color-text)",
              }}
            />
            <Btn onClick={handleInsert} primary>Insert</Btn>
          </div>

          {/* Search */}
          <div className="flex gap-2 items-center">
            <input
              type="number"
              value={searchVal}
              onChange={(e) => setSearchVal(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
              placeholder="e.g. 15"
              className="rounded-lg px-3 py-2 text-sm w-24 outline-none"
              style={{
                background: "var(--color-surface-2)",
                border: "1px solid var(--color-border)",
                color: "var(--color-text)",
              }}
            />
            <Btn onClick={handleSearch} icon={<Search size={13} />}>Search</Btn>
          </div>

          {/* Delete */}
          <div className="flex gap-2 items-center">
            <input
              type="number"
              value={deleteVal}
              onChange={(e) => setDeleteVal(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleDelete(); }}
              placeholder="e.g. 10"
              className="rounded-lg px-3 py-2 text-sm w-24 outline-none"
              style={{
                background: "var(--color-surface-2)",
                border: "1px solid var(--color-border)",
                color: "var(--color-text)",
              }}
            />
            <Btn onClick={handleDelete}>Delete</Btn>
          </div>

          <Btn onClick={handleAutoDemo} icon={<Zap size={13} />}>Auto-Demo</Btn>
          <Btn onClick={handleReset} icon={<RotateCcw size={13} />}>Clear</Btn>
        </div>

        {/* Playback controls */}
        {steps.length > 0 && (
          <div className="flex flex-wrap gap-2 items-center">
            <Btn
              onClick={() => setIsPlaying((p) => !p)}
              disabled={stepIdx >= steps.length - 1 && !isPlaying}
              icon={isPlaying ? <Pause size={13} /> : <Play size={13} />}
            >
              {isPlaying ? "Pause" : "Play"}
            </Btn>
            <Btn
              onClick={() => setStepIdx((p) => Math.min(p + 1, steps.length - 1))}
              disabled={stepIdx >= steps.length - 1}
              icon={<SkipForward size={13} />}
            >
              Step
            </Btn>
            <Btn
              onClick={() => { setStepIdx(0); setIsPlaying(false); }}
              icon={<RotateCcw size={13} />}
            >
              Restart
            </Btn>
            <span className="text-xs" style={{ color: "var(--color-muted)" }}>
              Step {stepIdx + 1} / {steps.length}
            </span>
            <div className="flex items-center gap-2 ml-2">
              <span className="text-xs" style={{ color: "var(--color-muted)" }}>Speed</span>
              <input
                type="range"
                min={150}
                max={1200}
                step={50}
                value={1350 - speed}
                onChange={(e) => setSpeed(1350 - Number(e.target.value))}
                className="w-24"
              />
            </div>
          </div>
        )}

        {/* Fix-up case reference */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--color-muted)" }}>
            Insert fix-up cases
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3" style={{ maxWidth: 720 }}>
            {[
              {
                label: "Case 1 — Uncle Red",
                trigger: "Parent & uncle both Red",
                fix: "Recolor parent + uncle Black, grandparent Red. Move z up.",
                color: "#fb923c",
              },
              {
                label: "Case 2 — Uncle Black, zig-zag",
                trigger: "LR or RL shape with uncle Black",
                fix: "Rotate parent to straighten → becomes Case 3.",
                color: "#a78bfa",
              },
              {
                label: "Case 3 — Uncle Black, straight",
                trigger: "LL or RR shape with uncle Black",
                fix: "Rotate grandparent + swap colors of parent & grandparent.",
                color: "#38bdf8",
              },
            ].map(({ label, trigger, fix, color }) => (
              <div key={label} className="rounded-lg p-3" style={{ background: "var(--color-surface-2)" }}>
                <div className="text-xs font-mono font-bold mb-1" style={{ color }}>{label}</div>
                <div className="text-xs mb-1" style={{ color: "var(--color-muted)" }}>{trigger}</div>
                <div className="text-xs font-mono" style={{ color: "var(--color-accent)" }}>{fix}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Five invariants reference */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--color-muted)" }}>
            The 5 Red-Black invariants
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2" style={{ maxWidth: 900 }}>
            {[
              "Every node is Red or Black.",
              "The root is Black.",
              "Every nil leaf is Black.",
              "If a node is Red, both children are Black.",
              "All paths root→nil have equal Black-node count.",
            ].map((inv, i) => (
              <div key={i} className="rounded-lg px-3 py-2 flex gap-2" style={{ background: "var(--color-surface-2)" }}>
                <span className="text-xs font-mono font-bold shrink-0" style={{ color: "var(--color-accent)" }}>
                  {i + 1}.
                </span>
                <span className="text-xs" style={{ color: "var(--color-muted)" }}>{inv}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
