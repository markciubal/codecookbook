"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import CytoscapeBase, { type CytoscapeBaseHandle } from "./CytoscapeBase";
import CodePanel from "./CodePanel";
import CodeModal from "./CodeModal";
import PanelModal from "./PanelModal";
import { Info } from "lucide-react";

const MAX_SIZE = 9;
const NODE_D   = 56; // diameter — equal width & height = circle
const NODE_GAP = 36;

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
  { selector: "node.front",     style: { "background-color": "#22c55e", "border-color": "#22c55e" } },
  { selector: "node.back",      style: { "background-color": "#7c6af7", "border-color": "#7c6af7" } },
  { selector: "node.new",       style: { "background-color": "#f59e0b", "border-color": "#f59e0b" } },
  { selector: "node.dequeuing", style: { "background-color": "#ef4444", "border-color": "#ef4444" } },
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
      width: 50,
      height: 16,
    },
  },
  {
    selector: "edge",
    style: {
      width: 2,
      "line-color": "#2e2e44",
      "target-arrow-color": "#2e2e44",
      "target-arrow-shape": "triangle",
      "curve-style": "straight",
      "arrow-scale": 1.2,
    },
  },
];

function renderQueue(
  cy: ReturnType<CytoscapeBaseHandle["cy"]>,
  queue: number[],
  highlight?: "new" | "dequeuing"
) {
  if (!cy) return;
  cy.batch(() => {
    cy.elements().remove();
    queue.forEach((val, idx) => {
      const isFront = idx === 0;
      const isBack  = idx === queue.length - 1;
      const x = idx * (NODE_D + NODE_GAP);
      let classes = "";
      if (isFront && highlight === "dequeuing") classes = "dequeuing";
      else if (isFront) classes = "front";
      else if (isBack && highlight === "new") classes = "new";
      else if (isBack) classes = "back";

      cy.add({ group: "nodes", data: { id: `q${idx}`, label: String(val) }, position: { x, y: 0 }, classes });

      if (idx > 0) {
        cy.add({ group: "edges", data: { id: `e${idx - 1}`, source: `q${idx - 1}`, target: `q${idx}` } });
      }
    });

    if (queue.length > 0) {
      cy.add({ group: "nodes", data: { id: "lbl-front", label: "front" }, position: { x: 0, y: -NODE_D / 2 - 14 }, classes: "label-node" });
      if (queue.length > 1) {
        cy.add({ group: "nodes", data: { id: "lbl-back", label: "back" }, position: { x: (queue.length - 1) * (NODE_D + NODE_GAP), y: -NODE_D / 2 - 14 }, classes: "label-node" });
      }
    }
    cy.fit(undefined, 40);
  });
}

interface CtxMenu { x: number; y: number; idx: number }

export default function QueueVisualizer() {
  const [queue, setQueue]         = useState<number[]>([12, 5, 38, 7]);
  const [inputVal, setInputVal]   = useState("");
  const [log, setLog]             = useState<string[]>(["Queue initialized with [12, 5, 38, 7]"]);
  const [error, setError]         = useState<string | null>(null);
  const [highlight, setHighlight] = useState<"new" | "dequeuing" | undefined>();
  const [panelTab, setPanelTab]   = useState<"info" | "code">("info");
  const [ctxMenu, setCtxMenu]       = useState<CtxMenu | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [activeMethod, setActiveMethod] = useState<string | null>(null);
  const cyHandle = useRef<CytoscapeBaseHandle>(null);

  const addLog = (msg: string) => setLog((p) => [msg, ...p].slice(0, 20));

  useEffect(() => {
    const t = setTimeout(() => {
      const cy = cyHandle.current?.cy() ?? null;
      renderQueue(cy, queue, highlight);

      if (cy) {
        cy.off("cxttap");
        cy.on("cxttap", "node", (evt) => {
          const nodeId = evt.target.id() as string;
          if (!nodeId.startsWith("q")) return;
          const idx = parseInt(nodeId.slice(1), 10);
          const oe  = evt.originalEvent as MouseEvent;
          setCtxMenu({ x: oe.clientX, y: oe.clientY, idx });
        });
      }
    }, 80);
    return () => clearTimeout(t);
  }, [queue, highlight]);

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

  const enqueue = () => {
    const v = parseInput();
    if (v === null) return;
    if (queue.length >= MAX_SIZE) { setError(`Queue full! Max size is ${MAX_SIZE}`); return; }
    triggerMethod("enqueue");
    setQueue((q) => [...q, v]);
    setHighlight("new");
    addLog(`enqueue(${v}) → size: ${queue.length + 1}`);
    setInputVal("");
  };

  const dequeue = () => {
    if (queue.length === 0) { setError("Queue is empty"); return; }
    setError(null);
    triggerMethod("dequeue");
    const front = queue[0];
    setHighlight("dequeuing");
    addLog(`dequeue() → removed ${front} (front), size: ${queue.length - 1}`);
    setTimeout(() => setQueue((q) => q.slice(1)), 550);
  };

  const peek  = () => {
    if (queue.length === 0) { setError("Queue is empty"); return; }
    setError(null);
    triggerMethod("peek");
    addLog(`peek() → ${queue[0]} (front)`);
  };

  const clear = () => { setQueue([]); addLog("Queue cleared"); setError(null); };

  // Context menu actions
  const ctxDeleteAt = (idx: number) => {
    const val = queue[idx];
    setQueue((q) => q.filter((_, i) => i !== idx));
    addLog(`deleted node at index ${idx} (value: ${val})`);
    setCtxMenu(null);
  };

  const ctxInsertAfter = (idx: number) => {
    const v = parseInt(inputVal, 10);
    if (isNaN(v)) { setError("Enter a value in the input first"); setCtxMenu(null); return; }
    if (queue.length >= MAX_SIZE) { setError(`Queue full! Max size is ${MAX_SIZE}`); setCtxMenu(null); return; }
    setError(null);
    const insertAt = idx + 1;
    setQueue((q) => [...q.slice(0, insertAt), v, ...q.slice(insertAt)]);
    addLog(`inserted ${v} after index ${idx}`);
    setInputVal("");
    setCtxMenu(null);
  };

  const ctxPeekAt = (idx: number) => {
    addLog(`peek at index ${idx} → ${queue[idx]}`);
    setCtxMenu(null);
  };

  const fillPct = Math.round((queue.length / MAX_SIZE) * 100);

  return (
    <div className="flex flex-col min-h-dvh" style={{ background: "var(--color-bg)" }}>
      <div className="px-5 pt-6 pb-4" style={{ borderBottom: "1px solid var(--color-border)" }}>
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <h1 className="text-2xl font-bold">Queue</h1>
          <Pill text="FIFO" green />
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
          First-In-First-Out. Elements enqueue at the back and dequeue from the front. Right-click any node for quick actions.
        </p>
      </div>

      <div className="flex flex-col flex-1">
        <div className="flex-1 px-5 pt-5 pb-4 flex flex-col gap-4">
          <div className="flex flex-wrap gap-6">
            <DStat label="Size"  value={queue.length} />
            <DStat label="Fill"  value={`${fillPct}%`} color="var(--color-accent)" />
            <DStat label="Front" value={queue.length > 0 ? queue[0] : "—"} color="var(--color-state-sorted)" />
            <DStat label="Back"  value={queue.length > 0 ? queue[queue.length - 1] : "—"} color="#a78bfa" />
          </div>

          <div>
            <div className="flex justify-between mb-1">
              <span className="text-xs" style={{ color: "var(--color-muted)" }}>Capacity</span>
              <span className="text-xs font-mono" style={{ color: "var(--color-accent)" }}>
                {queue.length} / {MAX_SIZE} ({fillPct}%)
              </span>
            </div>
            <div className="rounded-full overflow-hidden" style={{ height: 4, background: "var(--color-surface-3)" }}>
              <div className="h-full rounded-full transition-all" style={{
                width: `${fillPct}%`,
                background: fillPct > 80 ? "var(--color-state-swap)" : "var(--color-accent)",
              }} />
            </div>
          </div>

          <CytoscapeBase ref={cyHandle} stylesheet={STYLESHEET} style={{ height: 200 }} />

          <div className="flex flex-wrap gap-4">
            {[
              { label: "front",     color: "var(--color-state-sorted)" },
              { label: "back",      color: "var(--color-accent)" },
              { label: "new",       color: "var(--color-state-compare)" },
              { label: "dequeuing", color: "var(--color-state-swap)" },
            ].map(({ label, color }) => (
              <div key={label} className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full" style={{ background: color }} />
                <span className="text-xs" style={{ color: "var(--color-muted)" }}>{label}</span>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2 items-start">
            <input
              type="number" value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && enqueue()}
              placeholder="Value"
              className="rounded-lg px-3 py-2 text-sm w-28 outline-none"
              style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)", color: "var(--color-text)" }}
            />
            <DBtn onClick={enqueue} primary>Enqueue</DBtn>
            <DBtn onClick={dequeue}>Dequeue</DBtn>
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
            Peek value ({queue[ctxMenu.idx]})
          </CtxItem>
          <CtxItem onClick={() => ctxInsertAfter(ctxMenu.idx)}>
            Insert after (uses input value)
          </CtxItem>
          <CtxItem danger onClick={() => ctxDeleteAt(ctxMenu.idx)}>
            Delete this node
          </CtxItem>
        </ContextMenu>
      )}

      <PanelModal isOpen={isPanelOpen} onClose={() => setIsPanelOpen(false)} title="Queue Info">
        <SidePanel tab={panelTab} setTab={setPanelTab} queue={queue} log={log} />
      </PanelModal>

      <CodeModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        algorithmId="queue"
        activeMethod={activeMethod}
      />
    </div>
  );
}

function SidePanel({ tab, setTab, queue, log }: {
  tab: "info" | "code"; setTab: (t: "info" | "code") => void;
  queue: number[]; log: string[];
}) {
  return (
    <div>
      <TabBar tabs={["info", "code"]} active={tab} onChange={(t) => setTab(t as "info" | "code")} />
      {tab === "code" ? (
        <CodePanel id="queue" />
      ) : (
        <div className="space-y-6">
          <LogBox log={log} />
          <div>
            <SectionLabel>Internal Array</SectionLabel>
            <div className="rounded-lg p-3 text-xs font-mono"
              style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)" }}>
              <div className="mb-1" style={{ color: "var(--color-muted)" }}>front → back</div>
              <div style={{ color: "var(--color-accent)" }}>
                [{queue.length === 0 ? "empty" : queue.join(", ")}]
              </div>
            </div>
          </div>
          <div>
            <SectionLabel>Operations</SectionLabel>
            <OpsTable ops={[
              { op: "enqueue(x)", desc: "Add to back",       time: "O(1)" },
              { op: "dequeue()",  desc: "Remove from front", time: "O(1)" },
              { op: "peek()",     desc: "View front element",time: "O(1)" },
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

function Pill({ text, green }: { text: string; green?: boolean }) {
  return (
    <span className="text-xs font-mono px-2 py-0.5 rounded-full" style={{
      background: green ? "rgba(34,197,94,0.12)" : "rgba(124,106,247,0.15)",
      color: green ? "var(--color-state-sorted)" : "var(--color-accent)",
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
