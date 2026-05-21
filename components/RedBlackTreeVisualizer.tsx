"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { TreeDeciduous, RotateCcw, Zap, Search, Dices, ListOrdered } from "lucide-react";
import { StepTreeLayout, StepNav, SidebarSection, StepMessage, TraverseControls, TRAVERSAL_LABELS, type TraversalKind } from "./StepTreeLayout";

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

// ── Traversal steps ───────────────────────────────────────────────────────────

function buildRBTraversalSteps(root: RBNode | null, kind: TraversalKind): RBTStep[] {
  const label = TRAVERSAL_LABELS[kind];
  const base = { highlightEdges: [] as [number, number][], phase: "search" as RBTPhase };
  if (!root) return [{ root: null, highlightNodes: [], description: `${label}: tree is empty.`, ...base }];

  const order: RBNode[] = [];
  if (kind === "bfs") {
    const q: RBNode[] = [root];
    while (q.length) {
      const n = q.shift()!;
      order.push(n);
      if (n.left) q.push(n.left);
      if (n.right) q.push(n.right);
    }
  } else {
    const visit = (n: RBNode | null) => {
      if (!n) return;
      if (kind === "pre") order.push(n);
      visit(n.left);
      if (kind === "in") order.push(n);
      visit(n.right);
      if (kind === "post") order.push(n);
    };
    visit(root);
  }

  const how =
    kind === "bfs" ? "dequeue a node, visit it, enqueue its children — level by level"
    : kind === "pre" ? "visit the node, then recurse left, then right"
    : kind === "in" ? "recurse left, visit the node, then recurse right"
    : "recurse left, then right, then visit the node";

  const steps: RBTStep[] = [{ root: cloneRBTree(root), highlightNodes: [], description: `${label} — ${how}.`, ...base }];
  const visited: number[] = [];
  order.forEach((n, i) => {
    visited.push(n.val);
    steps.push({ root: cloneRBTree(root), highlightNodes: [...visited], description: `${label}: visit ${n.val} (${i + 1}/${order.length})`, ...base });
  });
  const orderStr = order.map((n) => n.val).join(" → ");
  const note = kind === "in" ? " — in-order on a BST yields keys in sorted order." : "";
  steps.push({ root: cloneRBTree(root), highlightNodes: order.map((n) => n.val), description: `${label} complete: ${orderStr}.${note}`, phase: "done", highlightEdges: [] });
  return steps;
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
  key: string;
  val: number | null;   // null for NIL sentinel leaves
  color: "red" | "black";
  nil: boolean;
  x: number;
  y: number;
  parentX: number | null;
  parentY: number | null;
  parentVal: number | null;
}

const RB_R = 22;
const RB_NIL_R = 10;     // NIL sentinels render smaller than real nodes
const RB_LEVEL_H = 80;
const RB_H_GAP = 44;

// Intermediate render tree: every real node, plus a black NIL sentinel in
// place of each missing child. This makes the "every leaf is Black" invariant
// visible, the way textbooks draw red-black trees.
interface RNode {
  id: string;
  val: number | null;
  color: "red" | "black";
  nil: boolean;
  left: RNode | null;
  right: RNode | null;
}

function toRenderTree(node: RBNode | null, side: string, parentVal: number | null): RNode {
  if (!node) {
    return { id: `nil-${parentVal ?? "root"}-${side}`, val: null, color: "black", nil: true, left: null, right: null };
  }
  return {
    id: `n-${node.val}`,
    val: node.val,
    color: node.color,
    nil: false,
    left: toRenderTree(node.left, "L", node.val),
    right: toRenderTree(node.right, "R", node.val),
  };
}

function layoutRB(root: RBNode | null): LayoutRB[] {
  const result: LayoutRB[] = [];
  if (!root) return result;

  const renderRoot = toRenderTree(root, "root", null);

  // Assign x via in-order over the render tree (NIL leaves take real slots, so
  // they never overlap their siblings).
  const xMap = new Map<string, number>();
  let xCounter = 0;
  function inOrder(r: RNode | null): void {
    if (!r) return;
    inOrder(r.left);
    xMap.set(r.id, xCounter++ * RB_H_GAP);
    inOrder(r.right);
  }
  inOrder(renderRoot);

  function assign(r: RNode | null, depth: number, pX: number | null, pY: number | null, pVal: number | null): void {
    if (!r) return;
    const x = xMap.get(r.id)!;
    const y = depth * RB_LEVEL_H;
    result.push({ key: r.id, val: r.val, color: r.color, nil: r.nil, x, y, parentX: pX, parentY: pY, parentVal: pVal });
    assign(r.left, depth + 1, x, y, r.val);
    assign(r.right, depth + 1, x, y, r.val);
  }
  assign(renderRoot, 0, null, null, null);
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

  // Reasonable margin so node strokes, the highlight glow, and the top row
  // never clip against the canvas edges as the tree loads / animates.
  const MARGIN = RB_R + 20;
  const minX = Math.min(...nodes.map((n) => n.x));
  const maxX = Math.max(...nodes.map((n) => n.x));
  const maxY = Math.max(...nodes.map((n) => n.y));
  const offsetX = -minX + MARGIN;
  const offsetY = MARGIN;
  const svgW = Math.max(maxX - minX + MARGIN * 2, 200);
  const svgH = maxY + MARGIN * 2;

  return (
    <svg width="100%" viewBox={`0 0 ${svgW} ${svgH}`} style={{ display: "block", overflow: "visible" }}>
      {/* Edges */}
      {nodes.map((n) => {
        if (n.parentX === null || n.parentY === null || n.parentVal === null) return null;
        const edgeKey = `${n.parentVal}-${n.val}`;
        const isHighlighted = hlEdgeSet.has(edgeKey);
        const childR = n.nil ? RB_NIL_R : RB_R;
        return (
          <line
            key={`e-${n.key}`}
            x1={n.parentX + offsetX}
            y1={n.parentY + offsetY + RB_R}
            x2={n.x + offsetX}
            y2={n.y + offsetY - childR}
            stroke={isHighlighted ? "#f59e0b" : "var(--color-border)"}
            strokeWidth={isHighlighted ? 3 : n.nil ? 1.25 : 2}
            strokeDasharray={n.nil ? "3 2" : undefined}
          />
        );
      })}

      {/* NIL sentinels — small black squares, no value. Drawn under the real
          nodes so the colored keys stay visually dominant. */}
      {nodes.filter((n) => n.nil).map((n) => {
        const cx = n.x + offsetX;
        const cy = n.y + offsetY;
        return (
          <g key={`nil-${n.key}`}>
            <rect
              x={cx - RB_NIL_R} y={cy - RB_NIL_R}
              width={RB_NIL_R * 2} height={RB_NIL_R * 2}
              rx={2}
              fill="#0f172a"
              stroke="#475569"
              strokeWidth={1.25}
            />
            <text
              x={cx} y={cy}
              textAnchor="middle" dominantBaseline="central"
              fontSize={7} fontFamily="monospace" fill="#64748b"
            >
              NIL
            </text>
          </g>
        );
      })}

      {/* Real nodes */}
      {nodes.filter((n) => !n.nil).map((n) => {
        const cx = n.x + offsetX;
        const cy = n.y + offsetY;
        const isHighlighted = n.val !== null && hlNodeSet.has(n.val);

        const fill = n.color === "red" ? "#ef4444" : "#1e293b";
        const stroke = isHighlighted ? "#f59e0b" : n.color === "red" ? "#dc2626" : "#475569";
        const strokeWidth = isHighlighted ? 3.5 : 2;

        // Black nodes render as squares, Red nodes as circles — a shape cue
        // that reads even without color (and in print / grayscale).
        const isBlack = n.color === "black";

        return (
          <g key={`n-${n.key}`}>
            {/* Glow for highlighted — matches the node's shape */}
            {isHighlighted && (
              isBlack
                ? <rect x={cx - RB_R - 6} y={cy - RB_R - 6} width={(RB_R + 6) * 2} height={(RB_R + 6) * 2} rx={4} fill="rgba(245,158,11,0.2)" />
                : <circle cx={cx} cy={cy} r={RB_R + 6} fill="rgba(239,68,68,0.2)" />
            )}
            {isBlack
              ? <rect x={cx - RB_R} y={cy - RB_R} width={RB_R * 2} height={RB_R * 2} rx={3} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />
              : <circle cx={cx} cy={cy} r={RB_R} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />}
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
  const [customList, setCustomList] = useState("");
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

  // Random guided lesson — fresh values, simulated up front to count the
  // recolorings and rotations the fix-up will perform, then led by an
  // instruction telling the learner what to watch for.
  const handleRandomLesson = useCallback(() => {
    const count = 6 + Math.floor(Math.random() * 4); // 6–9 values
    const vals: number[] = [];
    while (vals.length < count) {
      const v = 1 + Math.floor(Math.random() * 99);
      if (!vals.includes(v)) vals.push(v);
    }
    const lessonTree = new RBTree();
    const allSteps: RBTStep[] = [];
    let recolors = 0;
    let rotations = 0;
    for (const v of vals) {
      const s = lessonTree.insert(v);
      for (const st of s) {
        if (st.phase === "recolor") recolors++;
        if (st.phase === "rotate-left" || st.phase === "rotate-right") rotations++;
      }
      allSteps.push(...s);
    }
    const intro =
      `Lesson — insert [${vals.join(", ")}], each new node Red. This run triggers ${recolors} recolor${recolors === 1 ? "" : "s"} and ${rotations} rotation${rotations === 1 ? "" : "s"}. Watch the fix-up cases fire whenever a Red node ends up with a Red parent.`;
    allSteps.unshift({ root: null, highlightNodes: [], highlightEdges: [], description: intro, phase: "insert" });
    tree.root = lessonTree.root;
    startAnimation(allSteps);
    setTreeRoot(cloneRBTree(tree.root));
    setHistory([`Random Lesson: inserted [${vals.join(", ")}]`]);
  }, [tree, startAnimation]);

  const handleTraverse = useCallback((kind: TraversalKind) => {
    startAnimation(buildRBTraversalSteps(tree.root, kind));
    setHistory((h) => [`Traverse: ${TRAVERSAL_LABELS[kind]}`, ...h].slice(0, 20));
  }, [tree, startAnimation]);

  // Build a fresh Red-Black tree from a user-supplied list and play it.
  const handleCustomDemo = useCallback(() => {
    const vals = Array.from(new Set(
      customList.split(/[^0-9-]+/).map((s) => parseInt(s, 10)).filter((n) => !Number.isNaN(n))
    )).slice(0, 31);
    if (vals.length === 0) { setHistory((h) => ["Enter a list, e.g. 10, 20, 30, 15", ...h].slice(0, 20)); return; }
    const listTree = new RBTree();
    const allSteps: RBTStep[] = [];
    let recolors = 0;
    let rotations = 0;
    for (const v of vals) {
      const s = listTree.insert(v);
      for (const st of s) {
        if (st.phase === "recolor") recolors++;
        if (st.phase === "rotate-left" || st.phase === "rotate-right") rotations++;
      }
      allSteps.push(...s);
    }
    allSteps.unshift({
      root: null, highlightNodes: [], highlightEdges: [],
      description: `Custom demo — build a Red-Black tree from [${vals.join(", ")}]: ${recolors} recolor${recolors === 1 ? "" : "s"}, ${rotations} rotation${rotations === 1 ? "" : "s"}.`,
      phase: "insert",
    });
    tree.root = listTree.root;
    startAnimation(allSteps);
    setTreeRoot(cloneRBTree(tree.root));
    setHistory([`Custom demo: [${vals.join(", ")}]`]);
  }, [customList, tree, startAnimation]);

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

  const canvas = (
    <div
      className="rounded-xl overflow-auto h-full flex items-start"
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
  );

  const sidebar = (
    <>
      <StepMessage badge={currentStep ? phaseLabel : undefined} badgeColor={PHASE_COLORS[phase]}>
        {description}
      </StepMessage>

      {/* Controls */}
      <SidebarSection title="Operations">
        <div className="flex flex-col gap-2">
          <div className="flex gap-2 items-center">
            <input
              type="number"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
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
              placeholder="e.g. 15"
              className="rounded-lg px-3 py-2 text-sm flex-1 min-w-0 outline-none"
              style={{ background: "var(--color-surface-3)", border: "1px solid var(--color-border)", color: "var(--color-text)" }}
            />
            <Btn onClick={handleSearch} icon={<Search size={13} />}>Search</Btn>
          </div>
          <div className="flex gap-2 items-center">
            <input
              type="number"
              value={deleteVal}
              onChange={(e) => setDeleteVal(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleDelete(); }}
              placeholder="e.g. 10"
              className="rounded-lg px-3 py-2 text-sm flex-1 min-w-0 outline-none"
              style={{ background: "var(--color-surface-3)", border: "1px solid var(--color-border)", color: "var(--color-text)" }}
            />
            <Btn onClick={handleDelete}>Delete</Btn>
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
            placeholder="10, 20, 30, 15, 25, 5, 1"
            className="rounded-lg px-3 py-2 text-sm w-full outline-none font-mono"
            style={{ background: "var(--color-surface-3)", border: "1px solid var(--color-border)", color: "var(--color-text)" }}
          />
          <Btn onClick={handleCustomDemo} icon={<ListOrdered size={13} />}>Build &amp; demo list</Btn>
        </div>
      </SidebarSection>

      {/* Traversal */}
      <SidebarSection title="Traversal / search order">
        <TraverseControls kinds={["bfs", "pre", "in", "post"]} onTraverse={handleTraverse} disabled={!treeRoot} />
      </SidebarSection>

      {/* Playback */}
      {steps.length > 0 && (
        <SidebarSection title="Playback">
          <StepNav
            stepIdx={stepIdx}
            stepCount={steps.length}
            isPlaying={isPlaying}
            setIsPlaying={setIsPlaying}
            setStepIdx={setStepIdx}
            speed={speed}
            setSpeed={setSpeed}
          />
        </SidebarSection>
      )}

      {/* Invariants */}
      <SidebarSection title="RB Invariants">
        <div className="flex flex-col gap-2">
          {[
            { label: "Root is Black", ok: invariants.rootIsBlack },
            { label: "No consecutive Reds", ok: invariants.noConsecutiveReds },
            { label: "Black heights consistent", ok: invariants.blackHeightConsistent },
          ].map(({ label, ok }) => (
            <div key={label} className="flex items-center gap-2">
              <span className="text-sm font-bold" style={{ color: ok ? "#22c55e" : "#ef4444" }}>
                {ok ? "✓" : "✗"}
              </span>
              <span className="text-xs" style={{ color: ok ? "var(--color-text)" : "#ef4444" }}>
                {label}
              </span>
            </div>
          ))}
          {height > 0 && (
            <div className="text-xs font-mono mt-1" style={{ color: "var(--color-muted)" }}>
              height = <span style={{ color: "#22c55e" }}>{height}</span>
            </div>
          )}
        </div>
      </SidebarSection>

      {/* Legend */}
      <SidebarSection title="Legend">
        <div className="flex flex-col gap-2">
          {[
            { label: "Red node (circle)", bg: "#ef4444", border: "#dc2626", square: false, small: false },
            { label: "Black node (square)", bg: "#1e293b", border: "#475569", square: true, small: false },
            { label: "NIL leaf (black sentinel)", bg: "#0f172a", border: "#475569", square: true, small: true },
            { label: "Highlighted", bg: "#1e293b", border: "#f59e0b", glow: true, square: true, small: false },
          ].map(({ label, bg, border, glow, square, small }) => (
            <div key={label} className="flex items-center gap-2">
              <div
                className={`shrink-0 ${small ? "w-2.5 h-2.5" : "w-4 h-4"} ${square ? "rounded-sm" : "rounded-full"}`}
                style={{ background: bg, border: `${small ? 1.25 : 2}px solid ${border}`, boxShadow: glow ? `0 0 6px ${border}` : undefined }}
              />
              <span className="text-xs" style={{ color: "var(--color-muted)" }}>{label}</span>
            </div>
          ))}
          <div className="flex items-center gap-2">
            <div className="w-4 h-0.5 shrink-0" style={{ background: "#f59e0b" }} />
            <span className="text-xs" style={{ color: "var(--color-muted)" }}>Highlighted edge</span>
          </div>
        </div>
      </SidebarSection>

      {/* Operation log */}
      <SidebarSection title="Operation Log" scroll>
        <div className="flex flex-col gap-1">
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
      </SidebarSection>

      {/* Fix-up case reference */}
      <SidebarSection title="Insert fix-up cases">
        <div className="flex flex-col gap-2">
          {[
            { label: "Case 1 — Uncle Red", trigger: "Parent & uncle both Red", fix: "Recolor parent + uncle Black, grandparent Red. Move z up.", color: "#fb923c" },
            { label: "Case 2 — Uncle Black, zig-zag", trigger: "LR or RL shape with uncle Black", fix: "Rotate parent to straighten → becomes Case 3.", color: "#a78bfa" },
            { label: "Case 3 — Uncle Black, straight", trigger: "LL or RR shape with uncle Black", fix: "Rotate grandparent + swap colors of parent & grandparent.", color: "#38bdf8" },
          ].map(({ label, trigger, fix, color }) => (
            <div key={label} className="rounded-lg p-2.5" style={{ background: "var(--color-surface-3)" }}>
              <div className="text-xs font-mono font-bold mb-1" style={{ color }}>{label}</div>
              <div className="text-xs mb-1" style={{ color: "var(--color-muted)" }}>{trigger}</div>
              <div className="text-xs font-mono" style={{ color: "var(--color-accent)" }}>{fix}</div>
            </div>
          ))}
        </div>
      </SidebarSection>

      {/* Five invariants reference */}
      <SidebarSection title="The 5 Red-Black invariants">
        <div className="flex flex-col gap-1.5">
          {[
            "Every node is Red or Black.",
            "The root is Black.",
            "Every nil leaf is Black.",
            "If a node is Red, both children are Black.",
            "All paths root→nil have equal Black-node count.",
          ].map((inv, i) => (
            <div key={i} className="rounded-lg px-3 py-2 flex gap-2" style={{ background: "var(--color-surface-3)" }}>
              <span className="text-xs font-mono font-bold shrink-0" style={{ color: "var(--color-accent)" }}>{i + 1}.</span>
              <span className="text-xs" style={{ color: "var(--color-muted)" }}>{inv}</span>
            </div>
          ))}
        </div>
      </SidebarSection>
    </>
  );

  return (
    <StepTreeLayout
      icon={<TreeDeciduous size={20} style={{ color: "var(--color-accent)", flexShrink: 0 }} strokeWidth={1.75} />}
      title="Red-Black Tree"
      badges={
        <>
          <span className="text-xs font-mono px-2 py-0.5 rounded-full" style={{ background: "rgba(239,68,68,0.15)", color: "#ef4444" }}>Self-Balancing BST</span>
          <span className="text-xs font-mono px-2 py-0.5 rounded-full" style={{ background: "rgba(167,139,250,0.12)", color: "#a78bfa" }}>O(log n)</span>
          {height > 0 && (
            <span className="text-xs font-mono px-2 py-0.5 rounded-full" style={{ background: "rgba(34,197,94,0.12)", color: "#22c55e" }}>height = {height}</span>
          )}
        </>
      }
      description="A self-balancing BST where each node carries a color bit (Red or Black). Five invariants guarantee O(log n) height. Violations are fixed via recoloring and rotations."
      canvas={canvas}
      sidebar={sidebar}
    />
  );
}
