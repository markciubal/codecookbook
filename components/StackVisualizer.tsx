"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import CytoscapeBase, { type CytoscapeBaseHandle } from "./CytoscapeBase";
import CodePanel from "./CodePanel";
import CodeModal from "./CodeModal";
import PanelModal from "./PanelModal";
import { Info } from "lucide-react";

const MAX_SIZE = 12;
const NODE_D   = 56; // diameter — equal width & height makes a circle
const NODE_GAP = 16;

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
  { selector: "node.top",     style: { "background-color": "#7c6af7", "border-color": "#7c6af7" } },
  { selector: "node.new",     style: { "background-color": "#22c55e", "border-color": "#22c55e" } },
  { selector: "node.popping", style: { "background-color": "#ef4444", "border-color": "#ef4444" } },
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
      "text-halign": "left",
      width: 60,
      height: 20,
    },
  },
];

function renderStack(
  cy: ReturnType<CytoscapeBaseHandle["cy"]>,
  stack: number[],
  highlight?: "new" | "popping" | "peek"
) {
  if (!cy) return;
  cy.batch(() => {
    cy.elements().remove();
    stack.forEach((val, idx) => {
      const isTop = idx === stack.length - 1;
      const y = -idx * (NODE_D + NODE_GAP);
      let classes = isTop ? "top" : "";
      if (isTop && highlight === "new")     classes = "new";
      if (isTop && highlight === "popping") classes = "popping";
      cy.add({ group: "nodes", data: { id: `n${idx}`, label: String(val) }, position: { x: 0, y }, classes });
    });
    if (stack.length > 0) {
      const topY = -(stack.length - 1) * (NODE_D + NODE_GAP);
      cy.add({
        group: "nodes",
        data: { id: "lbl-top", label: "← top" },
        position: { x: NODE_D / 2 + 36, y: topY },
        classes: "label-node",
      });
    }
    cy.fit(undefined, 40);
  });
}

interface CtxMenu { x: number; y: number; idx: number }

export default function StackVisualizer() {
  const [stack, setStack]       = useState<number[]>([5, 23, 41, 17]);
  const [inputVal, setInputVal] = useState("");
  const [log, setLog]           = useState<string[]>(["Stack initialized with [5, 23, 41, 17]"]);
  const [error, setError]       = useState<string | null>(null);
  const [highlight, setHighlight] = useState<"new" | "popping" | "peek" | undefined>();
  const [panelTab, setPanelTab] = useState<"info" | "code">("info");
  const [ctxMenu, setCtxMenu]   = useState<CtxMenu | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [activeMethod, setActiveMethod] = useState<string | null>(null);
  const cyHandle = useRef<CytoscapeBaseHandle>(null);

  const addLog = (msg: string) => setLog((p) => [msg, ...p].slice(0, 20));

  useEffect(() => {
    const t = setTimeout(() => {
      const cy = cyHandle.current?.cy() ?? null;
      renderStack(cy, stack, highlight);

      // Register right-click context menu on data nodes
      if (cy) {
        cy.off("cxttap");
        cy.on("cxttap", "node", (evt) => {
          const nodeId = evt.target.id() as string;
          if (!nodeId.startsWith("n")) return; // ignore label-nodes
          const idx = parseInt(nodeId.slice(1), 10);
          const oe  = evt.originalEvent as MouseEvent;
          setCtxMenu({ x: oe.clientX, y: oe.clientY, idx });
        });
      }
    }, 80);
    return () => clearTimeout(t);
  }, [stack, highlight]);

  // Dismiss context menu on outside click
  useEffect(() => {
    if (!ctxMenu) return;
    const handler = () => setCtxMenu(null);
    window.addEventListener("click", handler);
    return () => window.removeEventListener("click", handler);
  }, [ctxMenu]);

  useEffect(() => {
    if (!highlight) return;
    const t = setTimeout(() => setHighlight(undefined), 600);
    return () => clearTimeout(t);
  }, [highlight]);

  const parseInput = useCallback((): number | null => {
    const v = parseInt(inputVal, 10);
    if (isNaN(v)) { setError("Enter a valid integer"); return null; }
    setError(null);
    return v;
  }, [inputVal]);

  const triggerMethod = (name: string) => {
    setActiveMethod(name);
    setTimeout(() => setActiveMethod(null), 1800);
  };

  const push = () => {
    const v = parseInput();
    if (v === null) return;
    if (stack.length >= MAX_SIZE) { setError(`Stack overflow! Max size is ${MAX_SIZE}`); return; }
    triggerMethod("push");
    setStack((s) => [...s, v]);
    setHighlight("new");
    addLog(`push(${v}) → size: ${stack.length + 1}`);
    setInputVal("");
  };

  const pop = () => {
    if (stack.length === 0) { setError("Stack underflow — stack is empty"); return; }
    setError(null);
    triggerMethod("pop");
    const top = stack[stack.length - 1];
    setHighlight("popping");
    addLog(`pop() → removed ${top}, size: ${stack.length - 1}`);
    setTimeout(() => setStack((s) => s.slice(0, -1)), 550);
  };

  const peek = () => {
    if (stack.length === 0) { setError("Stack is empty"); return; }
    setError(null);
    triggerMethod("peek");
    setHighlight("peek");
    addLog(`peek() → ${stack[stack.length - 1]} (top)`);
  };

  const clear = () => { setStack([]); addLog("Stack cleared"); setError(null); };

  // Context menu actions
  const ctxDeleteAt = (idx: number) => {
    const val = stack[idx];
    setStack((s) => s.filter((_, i) => i !== idx));
    addLog(`deleted node at index ${idx} (value: ${val})`);
    setCtxMenu(null);
  };

  const ctxPeekAt = (idx: number) => {
    addLog(`peek at index ${idx} → ${stack[idx]}`);
    setCtxMenu(null);
  };

  const ctxPushAbove = (idx: number) => {
    const v = parseInt(inputVal, 10);
    if (isNaN(v)) { setError("Enter a value in the input first"); setCtxMenu(null); return; }
    if (stack.length >= MAX_SIZE) { setError(`Stack overflow! Max size is ${MAX_SIZE}`); setCtxMenu(null); return; }
    setError(null);
    const insertAt = idx + 1;
    setStack((s) => [...s.slice(0, insertAt), v, ...s.slice(insertAt)]);
    addLog(`inserted ${v} above index ${idx}`);
    setInputVal("");
    setCtxMenu(null);
  };

  const fillPct = Math.round((stack.length / MAX_SIZE) * 100);

  return (
    <div className="flex flex-col min-h-dvh" style={{ background: "var(--color-bg)" }}>
      {/* Header */}
      <div className="px-5 pt-6 pb-4" style={{ borderBottom: "1px solid var(--color-border)" }}>
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <h1 className="text-2xl font-bold">Stack</h1>
          <Pill text="LIFO" purple />
          <Pill text="O(1)" />
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
          Last-In-First-Out. Elements are pushed and popped from the same end (top). Right-click any node for quick actions.
        </p>
      </div>

      <div className="flex flex-col flex-1">
        <div className="flex-1 px-5 pt-5 pb-4 flex flex-col gap-4">
          <div className="flex flex-wrap gap-6">
            <DStat label="Size"  value={stack.length} />
            <DStat label="Fill"  value={`${fillPct}%`} color="var(--color-accent)" />
            <DStat label="Top"   value={stack.length > 0 ? stack[stack.length - 1] : "—"} color="var(--color-state-sorted)" />
            <DStat label="Max"   value={MAX_SIZE} color="var(--color-muted)" />
          </div>

          {/* Capacity bar */}
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-xs" style={{ color: "var(--color-muted)" }}>Capacity</span>
              <span className="text-xs font-mono" style={{ color: "var(--color-accent)" }}>
                {stack.length} / {MAX_SIZE} ({fillPct}%)
              </span>
            </div>
            <div className="rounded-full overflow-hidden" style={{ height: 4, background: "var(--color-surface-3)" }}>
              <div className="h-full rounded-full transition-all" style={{
                width: `${fillPct}%`,
                background: fillPct > 80 ? "var(--color-state-swap)" : "var(--color-accent)",
              }} />
            </div>
          </div>

          <CytoscapeBase ref={cyHandle} stylesheet={STYLESHEET} style={{ height: 340 }} />

          <div className="flex flex-wrap gap-2 items-start">
            <input
              type="number" value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && push()}
              placeholder="Value"
              className="rounded-lg px-3 py-2 text-sm w-28 outline-none"
              style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)", color: "var(--color-text)" }}
            />
            <DBtn onClick={push} primary>Push</DBtn>
            <DBtn onClick={pop}>Pop</DBtn>
            <DBtn onClick={peek}>Peek</DBtn>
            <DBtn onClick={clear}>Clear</DBtn>
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
          <CtxItem onClick={() => ctxPeekAt(ctxMenu.idx)}>
            Peek value ({stack[ctxMenu.idx]})
          </CtxItem>
          <CtxItem onClick={() => ctxPushAbove(ctxMenu.idx)}>
            Insert above (uses input value)
          </CtxItem>
          <CtxItem danger onClick={() => ctxDeleteAt(ctxMenu.idx)}>
            Delete this node
          </CtxItem>
        </ContextMenu>
      )}

      <PanelModal isOpen={isPanelOpen} onClose={() => setIsPanelOpen(false)} title="Stack Info">
        <SidePanel tab={panelTab} setTab={setPanelTab} stack={stack} log={log} />
      </PanelModal>

      <CodeModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        algorithmId="stack"
        activeMethod={activeMethod}
      />
    </div>
  );
}

function SidePanel({
  tab, setTab, stack, log,
}: {
  tab: "info" | "code";
  setTab: (t: "info" | "code") => void;
  stack: number[];
  log: string[];
}) {
  return (
    <div>
      <TabBar tabs={["info", "code"]} active={tab} onChange={(t) => setTab(t as "info" | "code")} />
      {tab === "code" ? (
        <CodePanel id="stack" />
      ) : (
        <div className="space-y-6">
          <LogBox log={log} />

          <div>
            <SectionLabel>Internal Array</SectionLabel>
            <div className="rounded-lg p-3 text-xs font-mono"
              style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)" }}>
              <div className="mb-1" style={{ color: "var(--color-muted)" }}>bottom → top</div>
              <div style={{ color: "var(--color-accent)" }}>
                [{stack.length === 0 ? "empty" : stack.join(", ")}]
              </div>
            </div>
          </div>

          <div>
            <SectionLabel>Operations</SectionLabel>
            <OpsTable ops={[
              { op: "push(x)", desc: "Add to top",         time: "O(1)" },
              { op: "pop()",   desc: "Remove from top",    time: "O(1)" },
              { op: "peek()",  desc: "View top element",   time: "O(1)" },
            ]} />
          </div>
        </div>
      )}
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

function DBtn({ children, onClick, primary }: { children: React.ReactNode; onClick: () => void; primary?: boolean }) {
  return (
    <button onClick={onClick}
      className="px-2.5 py-1 rounded-lg text-xs font-medium transition-colors"
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
