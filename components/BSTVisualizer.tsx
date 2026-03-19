"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import CytoscapeBase, { type CytoscapeBaseHandle } from "./CytoscapeBase";
import CodePanel from "./CodePanel";
import CodeModal from "./CodeModal";
import PanelModal from "./PanelModal";
import { Info } from "lucide-react";

const MAX_SIZE = 15;

// ── Tree helpers ──────────────────────────────────────────────────────────────

interface TreeNode {
  val: number;
  left: TreeNode | null;
  right: TreeNode | null;
}

function buildInitialTree(values: number[]): TreeNode | null {
  let r: TreeNode | null = null;
  for (const v of values) r = bstInsertNode(r, v);
  return r;
}

function bstInsertNode(node: TreeNode | null, val: number): TreeNode {
  if (!node) return { val, left: null, right: null };
  if (val < node.val) return { ...node, left: bstInsertNode(node.left, val) };
  if (val > node.val) return { ...node, right: bstInsertNode(node.right, val) };
  return node;
}

function bstDeleteNode(node: TreeNode | null, val: number): TreeNode | null {
  if (!node) return null;
  if (val < node.val) return { ...node, left: bstDeleteNode(node.left, val) };
  if (val > node.val) return { ...node, right: bstDeleteNode(node.right, val) };
  if (!node.left) return node.right;
  if (!node.right) return node.left;
  let succ = node.right;
  while (succ.left) succ = succ.left;
  return { val: succ.val, left: node.left, right: bstDeleteNode(node.right, succ.val) };
}

function countNodes(node: TreeNode | null): number {
  if (!node) return 0;
  return 1 + countNodes(node.left) + countNodes(node.right);
}

function treeHeight(node: TreeNode | null): number {
  if (!node) return 0;
  return 1 + Math.max(treeHeight(node.left), treeHeight(node.right));
}

function treeMin(node: TreeNode | null): number | null {
  if (!node) return null;
  let cur = node;
  while (cur.left) cur = cur.left;
  return cur.val;
}

function treeMax(node: TreeNode | null): number | null {
  if (!node) return null;
  let cur = node;
  while (cur.right) cur = cur.right;
  return cur.val;
}

function inOrderTraversal(node: TreeNode | null): number[] {
  if (!node) return [];
  return [...inOrderTraversal(node.left), node.val, ...inOrderTraversal(node.right)];
}

// ── Cytoscape stylesheet ──────────────────────────────────────────────────────

const STYLESHEET = [
  {
    selector: "node",
    style: {
      shape: "ellipse",
      width: 52,
      height: 52,
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
  { selector: "node.searching", style: { "background-color": "#f59e0b", "border-color": "#f59e0b" } },
  { selector: "node.found",     style: { "background-color": "#22c55e", "border-color": "#22c55e" } },
  { selector: "node.inserting", style: { "background-color": "#22c55e", "border-color": "#22c55e" } },
  { selector: "node.deleting",  style: { "background-color": "#ef4444", "border-color": "#ef4444" } },
  { selector: "node.traversal", style: { "background-color": "#06b6d4", "border-color": "#06b6d4" } },
  {
    selector: "edge",
    style: {
      width: 2,
      "line-color": "#4a4a6a",
      "target-arrow-color": "#4a4a6a",
      "target-arrow-shape": "triangle",
      "curve-style": "bezier",
      "arrow-scale": 1.2,
    },
  },
];

// ── Layout computation ────────────────────────────────────────────────────────

interface LayoutNode {
  node: TreeNode;
  x: number;
  y: number;
  id: string;
}

function computeLayout(root: TreeNode | null): LayoutNode[] {
  const result: LayoutNode[] = [];

  const xMap = new Map<number, number>();
  let xCounter = 0;

  function inOrder(node: TreeNode | null) {
    if (!node) return;
    inOrder(node.left);
    xMap.set(node.val, xCounter++ * 70);
    inOrder(node.right);
  }
  inOrder(root);

  function levelAssign(node: TreeNode | null, level: number) {
    if (!node) return;
    result.push({
      node,
      x: xMap.get(node.val)! - (xCounter - 1) * 35,
      y: level * 90,
      id: `n${node.val}`,
    });
    levelAssign(node.left, level + 1);
    levelAssign(node.right, level + 1);
  }
  levelAssign(root, 0);

  return result;
}

// ── Cytoscape render ──────────────────────────────────────────────────────────

function renderBST(
  cy: ReturnType<CytoscapeBaseHandle["cy"]>,
  root: TreeNode | null,
  highlightMap: Record<string, string> = {}
) {
  if (!cy) return;
  const safeCy = cy;
  const layout = computeLayout(root);

  safeCy.batch(() => {
    safeCy.elements().remove();

    layout.forEach(({ node, x, y, id }) => {
      const isRoot = node === root;
      const cls = highlightMap[id] ?? (isRoot ? "root" : "");
      safeCy.add({
        group: "nodes",
        data: { id, label: String(node.val) },
        position: { x, y },
        classes: cls,
      });
    });

    function addEdges(node: TreeNode | null) {
      if (!node) return;
      if (node.left) {
        safeCy.add({
          group: "edges",
          data: { id: `e${node.val}l`, source: `n${node.val}`, target: `n${node.left.val}` },
        });
        addEdges(node.left);
      }
      if (node.right) {
        safeCy.add({
          group: "edges",
          data: { id: `e${node.val}r`, source: `n${node.val}`, target: `n${node.right.val}` },
        });
        addEdges(node.right);
      }
    }
    addEdges(root);

    safeCy.fit(undefined, 30);
  });
}

// ── Context menu type ─────────────────────────────────────────────────────────

interface CtxMenu {
  x: number;
  y: number;
  val: number;
}

// ── Main component ────────────────────────────────────────────────────────────

export default function BSTVisualizer() {
  const [root, setRoot] = useState<TreeNode | null>(() =>
    buildInitialTree([50, 30, 70, 20, 40, 60, 80])
  );
  const [inputVal, setInputVal] = useState("");
  const [log, setLog] = useState<string[]>(["BST initialized: [50, 30, 70, 20, 40, 60, 80]"]);
  const [error, setError] = useState<string | null>(null);
  const [panelTab, setPanelTab] = useState<"info" | "code">("info");
  const [ctxMenu, setCtxMenu] = useState<CtxMenu | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [activeMethod, setActiveMethod] = useState<string | null>(null);
  const [animHighlight, setAnimHighlight] = useState<Record<string, string>>({});
  const [animStatus, setAnimStatus] = useState<string>("");

  const cyHandle = useRef<CytoscapeBaseHandle>(null);

  const addLog = (msg: string) => setLog((p) => [msg, ...p].slice(0, 20));

  const triggerMethod = (name: string) => {
    setActiveMethod(name);
    setTimeout(() => setActiveMethod(null), 1800);
  };

  // Re-render Cytoscape whenever root or animHighlight changes
  useEffect(() => {
    const t = setTimeout(() => {
      const cy = cyHandle.current?.cy() ?? null;
      renderBST(cy, root, animHighlight);

      if (cy) {
        cy.off("cxttap");
        cy.on("cxttap", "node", (evt) => {
          const nodeId = evt.target.id() as string;
          const val = parseInt(nodeId.slice(1), 10);
          const oe = evt.originalEvent as MouseEvent;
          setCtxMenu({ x: oe.clientX, y: oe.clientY, val });
        });
      }
    }, 80);
    return () => clearTimeout(t);
  }, [root, animHighlight]);

  // Close context menu on outside click
  useEffect(() => {
    if (!ctxMenu) return;
    const handler = () => setCtxMenu(null);
    window.addEventListener("click", handler);
    return () => window.removeEventListener("click", handler);
  }, [ctxMenu]);

  // ── Operations ──────────────────────────────────────────────────────────────

  const search = useCallback(() => {
    const v = parseInt(inputVal, 10);
    if (isNaN(v)) { setError("Enter a valid integer"); return; }
    setError(null);
    triggerMethod("search");

    const path: TreeNode[] = [];
    let curr = root;
    while (curr) {
      path.push(curr);
      if (v === curr.val) break;
      curr = v < curr.val ? curr.left : curr.right;
    }

    if (!root || path.length === 0) {
      addLog(`search(${v}) → NOT FOUND (empty tree)`);
      setError(`${v} not found`);
      return;
    }

    path.forEach((node, i) => {
      setTimeout(() => {
        const isLast = i === path.length - 1;
        const found = isLast && node.val === v;
        setAnimHighlight({ [`n${node.val}`]: found ? "found" : "searching" });
        setAnimStatus(
          found
            ? `Found ${v}!`
            : `Comparing ${v} with ${node.val}: go ${v < node.val ? "left" : "right"}`
        );
        if (isLast) {
          addLog(found ? `search(${v}) → FOUND` : `search(${v}) → NOT FOUND`);
          if (!found) setError(`${v} not found in BST`);
          setTimeout(() => { setAnimHighlight({}); setAnimStatus(""); }, 800);
        }
      }, i * 400);
    });
  }, [inputVal, root]);

  const insert = useCallback(() => {
    const v = parseInt(inputVal, 10);
    if (isNaN(v)) { setError("Enter a valid integer"); return; }
    if (countNodes(root) >= MAX_SIZE) { setError(`Max size ${MAX_SIZE} reached`); return; }
    setError(null);
    setInputVal("");
    triggerMethod("insert");

    const path: TreeNode[] = [];
    let curr = root;
    while (curr) {
      if (v === curr.val) { setError(`${v} already exists`); return; }
      path.push(curr);
      curr = v < curr.val ? curr.left : curr.right;
    }

    path.forEach((node, i) => {
      setTimeout(() => {
        setAnimHighlight({ [`n${node.val}`]: "searching" });
        setAnimStatus(`${v} ${v < node.val ? "<" : ">"} ${node.val}? Go ${v < node.val ? "left" : "right"}`);
      }, i * 400);
    });

    setTimeout(() => {
      const newRoot = bstInsertNode(root, v);
      setRoot(newRoot);
      setAnimHighlight({ [`n${v}`]: "inserting" });
      setAnimStatus(`Inserted ${v}`);
      addLog(`insert(${v}) → tree height: ${treeHeight(newRoot)}`);
      setTimeout(() => { setAnimHighlight({}); setAnimStatus(""); }, 800);
    }, path.length * 400 + 100);
  }, [inputVal, root]);

  const remove = useCallback((overrideVal?: number) => {
    const v = overrideVal !== undefined ? overrideVal : parseInt(inputVal, 10);
    if (isNaN(v)) { setError("Enter a valid integer"); return; }
    setError(null);
    if (overrideVal === undefined) setInputVal("");
    triggerMethod("delete");
    setAnimHighlight({ [`n${v}`]: "deleting" });
    setAnimStatus(`Deleting ${v}...`);
    setTimeout(() => {
      const prevCount = countNodes(root);
      const newRoot = bstDeleteNode(root, v);
      if (countNodes(newRoot) === prevCount) {
        setError(`${v} not found`);
        setAnimHighlight({});
        setAnimStatus("");
        return;
      }
      setRoot(newRoot);
      setAnimHighlight({});
      setAnimStatus("");
      addLog(`delete(${v}) → tree height: ${treeHeight(newRoot)}`);
    }, 500);
  }, [inputVal, root]);

  const inorder = useCallback(() => {
    const values = inOrderTraversal(root);
    if (values.length === 0) { addLog("inorder: [] (empty tree)"); return; }
    triggerMethod("inorder");
    values.forEach((val, i) => {
      setTimeout(() => {
        setAnimHighlight({ [`n${val}`]: "traversal" });
        setAnimStatus(`Inorder: visiting ${val} (${i + 1}/${values.length})`);
        if (i === values.length - 1) {
          addLog(`inorder: [${values.join(", ")}]`);
          setTimeout(() => { setAnimHighlight({}); setAnimStatus(""); }, 600);
        }
      }, i * 350);
    });
  }, [root]);

  const clear = () => {
    setRoot(null);
    addLog("BST cleared");
    setAnimHighlight({});
    setAnimStatus("");
    setError(null);
  };

  const size = countNodes(root);
  const height = treeHeight(root);
  const minVal = treeMin(root);
  const maxVal = treeMax(root);

  return (
    <div className="flex flex-col min-h-dvh" style={{ background: "var(--color-bg)" }}>
      {/* Header */}
      <div className="px-5 pt-6 pb-4" style={{ borderBottom: "1px solid var(--color-border)" }}>
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <h1 className="text-2xl font-bold">Binary Search Tree</h1>
          <Pill text="BST" purple />
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
            >{"</>"}</button>
          </div>
        </div>
        <p className="text-sm" style={{ color: "var(--color-muted)" }}>
          A binary tree where every left child is smaller and every right child is larger than its parent. Right-click any node for quick actions.
        </p>
      </div>

      <div className="flex flex-col flex-1">
        <div className="flex-1 px-5 pt-5 pb-4 flex flex-col gap-4">
          {/* Stats */}
          <div className="flex flex-wrap gap-6">
            <DStat label="Size" value={size} />
            <DStat label="Height" value={height} color="var(--color-accent)" />
            <DStat label="Min" value={minVal ?? "—"} color="#22c55e" />
            <DStat label="Max" value={maxVal ?? "—"} color="#a78bfa" />
          </div>

          {/* Cytoscape canvas */}
          <CytoscapeBase ref={cyHandle} stylesheet={STYLESHEET} style={{ height: 320 }} />

          {/* Legend */}
          <div className="flex flex-wrap gap-4">
            {[
              { label: "root",       color: "#7c6af7" },
              { label: "searching",  color: "#f59e0b" },
              { label: "found / inserted", color: "#22c55e" },
              { label: "deleting",   color: "#ef4444" },
              { label: "traversal",  color: "#06b6d4" },
            ].map(({ label, color }) => (
              <div key={label} className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full" style={{ background: color }} />
                <span className="text-xs" style={{ color: "var(--color-muted)" }}>{label}</span>
              </div>
            ))}
          </div>

          {/* Animation status */}
          {animStatus && (
            <div
              className="rounded-lg px-4 py-3 text-sm"
              style={{ background: "var(--color-surface-2)", color: "var(--color-accent)" }}
            >
              {animStatus}
            </div>
          )}

          {/* Controls */}
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-2 items-center">
              <input
                type="number"
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && insert()}
                placeholder="e.g. 55"
                className="rounded-lg px-3 py-2 text-sm w-28 outline-none"
                style={{
                  background: "var(--color-surface-2)",
                  border: "1px solid var(--color-border)",
                  color: "var(--color-text)",
                }}
              />
              <DBtn onClick={insert} primary>Insert</DBtn>
              <DBtn onClick={search}>Search</DBtn>
              <DBtn onClick={() => remove()}>Delete</DBtn>
            </div>
            <div className="flex flex-wrap gap-2">
              <DBtn onClick={inorder}>Inorder</DBtn>
              <DBtn onClick={clear}>Clear</DBtn>
            </div>
          </div>

          {error && (
            <div
              className="rounded-lg px-4 py-2 text-sm"
              style={{ background: "rgba(239,68,68,0.12)", color: "var(--color-state-swap)" }}
            >
              {error}
            </div>
          )}
        </div>
      </div>

      {/* Context menu */}
      {ctxMenu && (
        <ContextMenu x={ctxMenu.x} y={ctxMenu.y}>
          <CtxItem
            onClick={() => {
              setInputVal(String(ctxMenu.val));
              addLog(`peek: node ${ctxMenu.val}`);
              setCtxMenu(null);
            }}
          >
            Search for this node ({ctxMenu.val})
          </CtxItem>
          <CtxItem
            danger
            onClick={() => {
              setCtxMenu(null);
              remove(ctxMenu.val);
            }}
          >
            Delete this node
          </CtxItem>
        </ContextMenu>
      )}

      <PanelModal isOpen={isPanelOpen} onClose={() => setIsPanelOpen(false)} title="BST Info">
        <SidePanel tab={panelTab} setTab={setPanelTab} log={log} />
      </PanelModal>

      <CodeModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        algorithmId="bst"
        activeMethod={activeMethod}
      />
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
        minWidth: 200,
        boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
      }}
    >
      {children}
    </div>
  );
}

function CtxItem({
  children,
  onClick,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
}) {
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
      onMouseEnter={(e) =>
        ((e.currentTarget as HTMLElement).style.background = "var(--color-surface-3)")
      }
      onMouseLeave={(e) =>
        ((e.currentTarget as HTMLElement).style.background = "transparent")
      }
    >
      {children}
    </button>
  );
}

// ── Side panel ────────────────────────────────────────────────────────────────

function SidePanel({
  tab,
  setTab,
  log,
}: {
  tab: "info" | "code";
  setTab: (t: "info" | "code") => void;
  log: string[];
}) {
  return (
    <div>
      <TabBar tabs={["info", "code"]} active={tab} onChange={(t) => setTab(t as "info" | "code")} />
      {tab === "code" ? (
        <CodePanel id="bst" />
      ) : (
        <div className="space-y-6">
          <LogBox log={log} />
          <div>
            <SectionLabel>BST Property</SectionLabel>
            <div
              className="rounded-lg p-3 text-xs font-mono"
              style={{
                background: "var(--color-surface-2)",
                border: "1px solid var(--color-border)",
                color: "var(--color-accent)",
                lineHeight: 1.6,
              }}
            >
              Left subtree &lt; node &lt; Right subtree
            </div>
          </div>
          <div>
            <SectionLabel>Operations</SectionLabel>
            <OpsTable
              ops={[
                { op: "insert(x)",  desc: "Insert key, maintain BST property",  time: "O(log n)" },
                { op: "search(x)",  desc: "Search by comparing each node",       time: "O(log n)" },
                { op: "delete(x)",  desc: "Remove, rewire with successor",       time: "O(log n)" },
                { op: "inorder()",  desc: "Left → Root → Right (sorted!)",       time: "O(n)" },
              ]}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Shared primitives ─────────────────────────────────────────────────────────

function TabBar({
  tabs,
  active,
  onChange,
}: {
  tabs: string[];
  active: string;
  onChange: (t: string) => void;
}) {
  return (
    <div className="flex gap-1 mb-5 p-1 rounded-lg" style={{ background: "var(--color-surface-3)" }}>
      {tabs.map((t) => (
        <button
          key={t}
          onClick={() => onChange(t)}
          className="flex-1 py-1.5 rounded-md text-xs font-semibold capitalize transition-colors"
          style={{
            background: active === t ? "var(--color-surface-1)" : "transparent",
            color: active === t ? "var(--color-text)" : "var(--color-muted)",
            border: "none",
            cursor: "pointer",
          }}
        >
          {t}
        </button>
      ))}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="text-xs font-semibold uppercase tracking-widest mb-3"
      style={{ color: "var(--color-muted)" }}
    >
      {children}
    </p>
  );
}

function LogBox({ log }: { log: string[] }) {
  return (
    <div>
      <SectionLabel>Operation Log</SectionLabel>
      <div
        className="rounded-lg p-3 text-xs font-mono space-y-1.5 overflow-y-auto"
        style={{
          background: "var(--color-surface-2)",
          border: "1px solid var(--color-border)",
          maxHeight: 180,
          color: "var(--color-muted)",
        }}
      >
        {log.map((entry, i) => (
          <div key={i} style={{ color: i === 0 ? "var(--color-accent)" : undefined }}>
            {i === 0 ? "→ " : "  "}
            {entry}
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
        <div
          key={op}
          className="flex items-center justify-between p-2 rounded-lg"
          style={{ background: "var(--color-surface-2)" }}
        >
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
    <span
      className="text-xs font-mono px-2 py-0.5 rounded-full"
      style={{
        background: purple ? "rgba(124,106,247,0.15)" : "rgba(167,139,250,0.12)",
        color: purple ? "var(--color-accent)" : "#a78bfa",
      }}
    >
      {text}
    </span>
  );
}

function DStat({
  label,
  value,
  color,
}: {
  label: string;
  value: string | number;
  color?: string;
}) {
  return (
    <div>
      <div className="text-xs mb-0.5" style={{ color: "var(--color-muted)" }}>{label}</div>
      <div className="text-xl font-mono font-bold" style={{ color: color ?? "var(--color-text)" }}>
        {value}
      </div>
    </div>
  );
}

function DBtn({
  children,
  onClick,
  primary,
}: {
  children: React.ReactNode;
  onClick: () => void;
  primary?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className="px-2.5 py-1 rounded-lg text-xs font-medium transition-colors"
      style={{
        background: primary ? "var(--color-accent)" : "var(--color-surface-3)",
        color: primary ? "#fff" : "var(--color-text)",
        border: "1px solid " + (primary ? "var(--color-accent)" : "var(--color-border)"),
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}
