"use client";

import { useState, useEffect, useRef } from "react";
import CytoscapeBase, { type CytoscapeBaseHandle } from "./CytoscapeBase";
import CodePanel from "./CodePanel";
import CodeModal from "./CodeModal";
import PanelModal from "./PanelModal";
import { Info } from "lucide-react";

const MAX_SIZE = 8;
const NODE_W = 72;
const NODE_H = 56;
const NODE_GAP = 56;

const STYLESHEET = [
  {
    selector: "node",
    style: {
      shape: "ellipse",
      width: NODE_W,
      height: NODE_H,
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
  { selector: "node.head",      style: { "background-color": "#7c6af7", "border-color": "#7c6af7" } },
  { selector: "node.new",       style: { "background-color": "#22c55e", "border-color": "#22c55e" } },
  { selector: "node.deleting",  style: { "background-color": "#ef4444", "border-color": "#ef4444" } },
  { selector: "node.searching", style: { "background-color": "#f59e0b", "border-color": "#f59e0b" } },
  {
    selector: "node.null-node",
    style: {
      shape: "diamond",
      width: 44, height: 44,
      "background-color": "#1c1c27",
      "border-color": "#2e2e44",
      label: "null",
      color: "#8b8ba8",
      "font-size": "11px",
      "font-family": "monospace",
    },
  },
  {
    selector: "node.label-node",
    style: {
      shape: "rectangle",
      "background-color": "transparent",
      "border-width": 0,
      label: "data(label)",
      color: "#8b8ba8",
      "font-size": "11px",
      "font-family": "monospace",
      "text-valign": "center",
      "text-halign": "center",
      width: 50, height: 16,
    },
  },
  {
    selector: "edge",
    style: {
      width: 2,
      "line-color": "#4a4a6a",
      "target-arrow-color": "#4a4a6a",
      "target-arrow-shape": "triangle",
      "curve-style": "straight",
      "arrow-scale": 1.3,
    },
  },
];

interface LLNode { val: number; classes?: string; }

function renderLL(cy: ReturnType<CytoscapeBaseHandle["cy"]>, nodes: LLNode[]) {
  if (!cy) return;
  const stride = NODE_W + NODE_GAP;
  cy.batch(() => {
    cy.elements().remove();
    nodes.forEach((n, idx) => {
      cy.add({ group: "nodes", data: { id: `n${idx}`, label: String(n.val) }, position: { x: idx * stride, y: 0 }, classes: n.classes ?? (idx === 0 ? "head" : "") });
      if (idx > 0) cy.add({ group: "edges", data: { id: `e${idx - 1}`, source: `n${idx - 1}`, target: `n${idx}` } });
    });
    cy.add({ group: "nodes", data: { id: "null-node", label: "null" }, position: { x: nodes.length * stride, y: 0 }, classes: "null-node" });
    if (nodes.length > 0) cy.add({ group: "edges", data: { id: "e-null", source: `n${nodes.length - 1}`, target: "null-node" } });
    if (nodes.length > 0) cy.add({ group: "nodes", data: { id: "lbl-head", label: "head" }, position: { x: 0, y: -NODE_H / 2 - 14 }, classes: "label-node" });
    cy.fit(undefined, 40);
  });
}

interface CtxMenu { x: number; y: number; idx: number }

export default function LinkedListVisualizer() {
  const [nodes, setNodes]         = useState<LLNode[]>([{ val: 10 }, { val: 25 }, { val: 7 }, { val: 42 }]);
  const [inputVal, setInputVal]   = useState("");
  const [indexVal, setIndexVal]   = useState("");
  const [log, setLog]             = useState<string[]>(["List initialized: 10 → 25 → 7 → 42 → null"]);
  const [error, setError]         = useState<string | null>(null);
  const [panelTab, setPanelTab]   = useState<"info" | "code">("info");
  const [ctxMenu, setCtxMenu]           = useState<CtxMenu | null>(null);
  const [isModalOpen, setIsModalOpen]   = useState(false);
  const [isPanelOpen, setIsPanelOpen]   = useState(false);
  const [activeMethod, setActiveMethod] = useState<string | null>(null);
  const cyHandle = useRef<CytoscapeBaseHandle>(null);

  const addLog = (msg: string) => setLog((p) => [msg, ...p].slice(0, 20));

  useEffect(() => {
    const t = setTimeout(() => {
      const cy = cyHandle.current?.cy() ?? null;
      renderLL(cy, nodes);

      if (cy) {
        cy.off("cxttap");
        cy.on("cxttap", "node", (evt) => {
          const nodeId = evt.target.id() as string;
          if (!nodeId.startsWith("n")) return;
          const idx = parseInt(nodeId.slice(1), 10);
          const oe  = evt.originalEvent as MouseEvent;
          setCtxMenu({ x: oe.clientX, y: oe.clientY, idx });
        });
      }
    }, 80);
    return () => clearTimeout(t);
  }, [nodes]);

  useEffect(() => {
    if (!ctxMenu) return;
    const handler = () => setCtxMenu(null);
    window.addEventListener("click", handler);
    return () => window.removeEventListener("click", handler);
  }, [ctxMenu]);

  const parseVal = (): number | null => {
    const v = parseInt(inputVal, 10);
    if (isNaN(v)) { setError("Enter a valid integer value"); return null; }
    return v;
  };

  const parseIndex = (): number | null => {
    const v = parseInt(indexVal, 10);
    if (isNaN(v) || v < 0 || v > nodes.length) { setError(`Index must be 0–${nodes.length}`); return null; }
    return v;
  };

  const clearClasses = (ns: LLNode[]) => ns.map((n) => ({ val: n.val }));

  const triggerMethod = (name: string) => {
    setActiveMethod(name);
    setTimeout(() => setActiveMethod(null), 1800);
  };

  const insertHead = () => {
    const v = parseVal();
    if (v === null) return;
    if (nodes.length >= MAX_SIZE) { setError(`Max size ${MAX_SIZE} reached`); return; }
    setError(null);
    triggerMethod("insertHead");
    const next = [{ val: v, classes: "new" }, ...nodes];
    setNodes(next);
    addLog(`insertHead(${v}) → ${next.map((n) => n.val).join(" → ")} → null`);
    setInputVal("");
    setTimeout(() => setNodes((ns) => clearClasses(ns)), 700);
  };

  const insertTail = () => {
    const v = parseVal();
    if (v === null) return;
    if (nodes.length >= MAX_SIZE) { setError(`Max size ${MAX_SIZE} reached`); return; }
    setError(null);
    triggerMethod("insertTail");
    const next = [...nodes, { val: v, classes: "new" }];
    setNodes(next);
    addLog(`insertTail(${v}) → ${next.map((n) => n.val).join(" → ")} → null`);
    setInputVal("");
    setTimeout(() => setNodes((ns) => clearClasses(ns)), 700);
  };

  const insertAt = () => {
    const v = parseVal();
    const idx = parseIndex();
    if (v === null || idx === null) return;
    if (nodes.length >= MAX_SIZE) { setError(`Max size ${MAX_SIZE} reached`); return; }
    setError(null);
    triggerMethod("insertTail");
    const next = [...nodes];
    next.splice(idx, 0, { val: v, classes: "new" });
    setNodes(next);
    addLog(`insertAt(${v}, ${idx}) → ${next.map((n) => n.val).join(" → ")} → null`);
    setInputVal("");
    setTimeout(() => setNodes((ns) => clearClasses(ns)), 700);
  };

  const deleteHead = () => {
    if (nodes.length === 0) { setError("List is empty"); return; }
    setError(null);
    triggerMethod("deleteHead");
    const head = nodes[0].val;
    setNodes((ns) => [{ val: ns[0].val, classes: "deleting" }, ...ns.slice(1)]);
    addLog(`deleteHead() → removed ${head}`);
    setTimeout(() => setNodes((ns) => ns.slice(1)), 550);
  };

  const deleteTail = () => {
    if (nodes.length === 0) { setError("List is empty"); return; }
    setError(null);
    triggerMethod("deleteTail");
    const tail = nodes[nodes.length - 1].val;
    setNodes((ns) => [...ns.slice(0, -1), { val: ns[ns.length - 1].val, classes: "deleting" }]);
    addLog(`deleteTail() → removed ${tail}`);
    setTimeout(() => setNodes((ns) => ns.slice(0, -1)), 550);
  };

  const deleteAt = () => {
    const idx = parseIndex();
    if (idx === null) return;
    if (idx >= nodes.length) { setError(`Index ${idx} out of bounds`); return; }
    setError(null);
    const val = nodes[idx].val;
    setNodes((ns) => ns.map((n, i) => i === idx ? { val: n.val, classes: "deleting" } : n));
    addLog(`deleteAt(${idx}) → removed ${val}`);
    setTimeout(() => setNodes((ns) => ns.filter((_, i) => i !== idx)), 550);
    setIndexVal("");
  };

  const clear = () => { setNodes([]); addLog("List cleared → null"); setError(null); };

  // Context menu actions
  const ctxDeleteAt = (idx: number) => {
    const val = nodes[idx].val;
    setNodes((ns) => ns.map((n, i) => i === idx ? { val: n.val, classes: "deleting" } : n));
    addLog(`deleteAt(${idx}) → removed ${val}`);
    setTimeout(() => setNodes((ns) => ns.filter((_, i) => i !== idx)), 550);
    setCtxMenu(null);
  };

  const ctxInsertBefore = (idx: number) => {
    const v = parseInt(inputVal, 10);
    if (isNaN(v)) { setError("Enter a value in the input first"); setCtxMenu(null); return; }
    if (nodes.length >= MAX_SIZE) { setError(`Max size ${MAX_SIZE} reached`); setCtxMenu(null); return; }
    setError(null);
    const next = [...nodes];
    next.splice(idx, 0, { val: v, classes: "new" });
    setNodes(next);
    addLog(`insertBefore(${v}, idx=${idx})`);
    setInputVal("");
    setTimeout(() => setNodes((ns) => ns.map((n) => ({ val: n.val }))), 700);
    setCtxMenu(null);
  };

  const ctxInsertAfter = (idx: number) => {
    const v = parseInt(inputVal, 10);
    if (isNaN(v)) { setError("Enter a value in the input first"); setCtxMenu(null); return; }
    if (nodes.length >= MAX_SIZE) { setError(`Max size ${MAX_SIZE} reached`); setCtxMenu(null); return; }
    setError(null);
    const next = [...nodes];
    next.splice(idx + 1, 0, { val: v, classes: "new" });
    setNodes(next);
    addLog(`insertAfter(${v}, idx=${idx})`);
    setInputVal("");
    setTimeout(() => setNodes((ns) => ns.map((n) => ({ val: n.val }))), 700);
    setCtxMenu(null);
  };

  const listStr = nodes.length === 0 ? "null" : nodes.map((n) => n.val).join(" → ") + " → null";

  return (
    <div className="flex flex-col min-h-dvh" style={{ background: "var(--color-bg)" }}>
      <div className="px-5 pt-6 pb-4" style={{ borderBottom: "1px solid var(--color-border)" }}>
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <h1 className="text-2xl font-bold">Linked List</h1>
          <Pill text="Singly" />
          <Pill text="O(n)" blue />
          <div className="ml-auto flex gap-2">
            <button
              onClick={() => setIsPanelOpen((p) => !p)}
              title="Info"
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-mono transition-colors"
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
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-mono transition-colors"
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
          Nodes connected via pointers. Insert and delete at any position without shifting — just rewire the links. Right-click any node for quick actions.
        </p>
      </div>

      <div className="flex flex-col flex-1">
        <div className="flex-1 px-5 pt-5 pb-4 flex flex-col gap-4">
          <div className="flex flex-wrap gap-6">
            <DStat label="Length" value={nodes.length} />
            <DStat label="Head"   value={nodes.length > 0 ? nodes[0].val : "null"} color="var(--color-accent)" />
            <DStat label="Tail"   value={nodes.length > 0 ? nodes[nodes.length - 1].val : "null"} color="#a78bfa" />
          </div>

          <CytoscapeBase ref={cyHandle} stylesheet={STYLESHEET} style={{ height: 200 }} />

          <div className="flex flex-wrap gap-4">
            {[
              { label: "head",     color: "var(--color-accent)" },
              { label: "inserted", color: "var(--color-state-sorted)" },
              { label: "deleting", color: "var(--color-state-swap)" },
            ].map(({ label, color }) => (
              <div key={label} className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full" style={{ background: color }} />
                <span className="text-xs" style={{ color: "var(--color-muted)" }}>{label}</span>
              </div>
            ))}
          </div>

          {/* Controls */}
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-xs font-medium w-14 shrink-0" style={{ color: "var(--color-muted)" }}>Value</span>
              <input type="number" value={inputVal} onChange={(e) => setInputVal(e.target.value)} placeholder="e.g. 42"
                className="rounded-lg px-3 py-2 text-sm w-28 outline-none"
                style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)", color: "var(--color-text)" }} />
              <DBtn onClick={insertHead} primary>Insert Head</DBtn>
              <DBtn onClick={insertTail}>Insert Tail</DBtn>
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-xs font-medium w-14 shrink-0" style={{ color: "var(--color-muted)" }}>Index</span>
              <input type="number" value={indexVal} onChange={(e) => setIndexVal(e.target.value)} placeholder={`0–${nodes.length}`}
                className="rounded-lg px-3 py-2 text-sm w-28 outline-none"
                style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)", color: "var(--color-text)" }} />
              <DBtn onClick={insertAt}>Insert At</DBtn>
              <DBtn onClick={deleteAt}>Delete At</DBtn>
            </div>
            <div className="flex flex-wrap gap-2">
              <DBtn onClick={deleteHead}>Delete Head</DBtn>
              <DBtn onClick={deleteTail}>Delete Tail</DBtn>
              <DBtn onClick={clear}>Clear</DBtn>
            </div>
          </div>

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
          <CtxItem onClick={() => { addLog(`peek at index ${ctxMenu.idx} → ${nodes[ctxMenu.idx]?.val}`); setCtxMenu(null); }}>
            Peek value ({nodes[ctxMenu.idx]?.val})
          </CtxItem>
          <CtxItem onClick={() => ctxInsertBefore(ctxMenu.idx)}>
            Insert before (uses input value)
          </CtxItem>
          <CtxItem onClick={() => ctxInsertAfter(ctxMenu.idx)}>
            Insert after (uses input value)
          </CtxItem>
          <CtxItem danger onClick={() => ctxDeleteAt(ctxMenu.idx)}>
            Delete this node
          </CtxItem>
        </ContextMenu>
      )}

      <PanelModal isOpen={isPanelOpen} onClose={() => setIsPanelOpen(false)} title="Linked List Info">
        <SidePanel tab={panelTab} setTab={setPanelTab} log={log} listStr={listStr} />
      </PanelModal>

      <CodeModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        algorithmId="linked-list"
        activeMethod={activeMethod}
      />
    </div>
  );
}

// ── Context menu primitives ───────────────────────────────────────────────────

function ContextMenu({ x, y, children }: {
  x: number; y: number; children: React.ReactNode;
}) {
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

function SidePanel({ tab, setTab, log, listStr }: {
  tab: "info" | "code"; setTab: (t: "info" | "code") => void;
  log: string[]; listStr: string;
}) {
  return (
    <div>
      <TabBar tabs={["info", "code"]} active={tab} onChange={(t) => setTab(t as "info" | "code")} />
      {tab === "code" ? (
        <CodePanel id="linked-list" />
      ) : (
        <div className="space-y-6">
          <LogBox log={log} />
          <div>
            <SectionLabel>List Representation</SectionLabel>
            <div className="rounded-lg p-3 text-xs font-mono break-all"
              style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)", color: "var(--color-accent)" }}>
              {listStr}
            </div>
          </div>
          <div>
            <SectionLabel>Operations</SectionLabel>
            <OpsTable ops={[
              { op: "insertHead(x)",   desc: "Add at start",       time: "O(1)" },
              { op: "insertTail(x)",   desc: "Add at end",         time: "O(n)" },
              { op: "insertAt(x, i)",  desc: "Add at index i",     time: "O(n)" },
              { op: "deleteHead()",    desc: "Remove first",       time: "O(1)" },
              { op: "deleteTail()",    desc: "Remove last",        time: "O(n)" },
              { op: "deleteAt(i)",     desc: "Remove at index i",  time: "O(n)" },
            ]} />
          </div>
        </div>
      )}
    </div>
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
        style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)", maxHeight: 180, color: "var(--color-muted)" }}>
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

function Pill({ text, blue }: { text: string; blue?: boolean }) {
  return (
    <span className="text-xs font-mono px-2 py-0.5 rounded-full" style={{
      background: blue ? "rgba(124,106,247,0.15)" : "rgba(167,139,250,0.12)",
      color: blue ? "var(--color-accent)" : "#a78bfa",
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

function DBtn({ children, onClick, primary }: { children: React.ReactNode; onClick: () => void; primary?: boolean }) {
  return (
    <button onClick={onClick}
      className="px-3 py-2 rounded-lg text-sm font-medium transition-colors"
      style={{
        background: primary ? "var(--color-accent)" : "var(--color-surface-3)",
        color: primary ? "#fff" : "var(--color-text)",
        border: "1px solid " + (primary ? "var(--color-accent)" : "var(--color-border)"),
        cursor: "pointer",
      }}>
      {children}
    </button>
  );
}
