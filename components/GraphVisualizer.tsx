"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import CytoscapeBase, { type CytoscapeBaseHandle } from "./CytoscapeBase";
import CodePanel from "./CodePanel";
import CodeModal from "./CodeModal";
import PanelModal from "./PanelModal";
import { Info } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface GraphData {
  nodes: { id: string; label: string }[];
  edges: { id: string; source: string; target: string }[];
}

// ── Constants ─────────────────────────────────────────────────────────────────

const INITIAL_GRAPH: GraphData = {
  nodes: [
    { id: "A", label: "A" },
    { id: "B", label: "B" },
    { id: "C", label: "C" },
    { id: "D", label: "D" },
    { id: "E", label: "E" },
    { id: "F", label: "F" },
  ],
  edges: [
    { id: "AB", source: "A", target: "B" },
    { id: "AC", source: "A", target: "C" },
    { id: "BD", source: "B", target: "D" },
    { id: "BE", source: "B", target: "E" },
    { id: "CF", source: "C", target: "F" },
  ],
};

const STYLESHEET = [
  {
    selector: "node",
    style: {
      shape: "ellipse",
      width: 48,
      height: 48,
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
  { selector: "node.visited", style: { "background-color": "#7c6af7", "border-color": "#7c6af7" } },
  { selector: "node.current", style: { "background-color": "#22c55e", "border-color": "#22c55e" } },
  { selector: "node.queued",  style: { "background-color": "#f59e0b", "border-color": "#f59e0b" } },
  { selector: "node.start",   style: { "background-color": "#06b6d4", "border-color": "#06b6d4" } },
  {
    selector: "edge",
    style: {
      width: 2,
      "line-color": "#4a4a6a",
      "target-arrow-color": "#4a4a6a",
      "target-arrow-shape": "none",
      "curve-style": "bezier",
    },
  },
  {
    selector: "edge.traversed",
    style: {
      "line-color": "#7c6af7",
      width: 3,
    },
  },
];

// ── Cytoscape helpers ─────────────────────────────────────────────────────────

function applyGraphToCytoscape(
  cy: ReturnType<CytoscapeBaseHandle["cy"]>,
  graph: GraphData,
  nodeClasses: Record<string, string> = {},
  edgeClasses: Set<string> = new Set()
) {
  if (!cy) return;
  cy.batch(() => {
    cy.elements().remove();
    graph.nodes.forEach(({ id, label }) => {
      cy.add({ group: "nodes", data: { id, label }, classes: nodeClasses[id] ?? "" });
    });
    graph.edges.forEach(({ id, source, target }) => {
      cy.add({
        group: "edges",
        data: { id, source, target },
        classes: edgeClasses.has(id) ? "traversed" : "",
      });
    });
    cy.layout({ name: "cose", padding: 40, animate: false } as Parameters<typeof cy.layout>[0]).run();
  });
}

// ── Main component ────────────────────────────────────────────────────────────

export default function GraphVisualizer() {
  const [graph, setGraph]                   = useState<GraphData>(INITIAL_GRAPH);
  const [nodeInput, setNodeInput]           = useState("");
  const [edgeSrc, setEdgeSrc]               = useState("");
  const [edgeDst, setEdgeDst]               = useState("");
  const [startNode, setStartNode]           = useState("A");
  const [log, setLog]                       = useState<string[]>(["Graph initialized with 6 nodes"]);
  const [error, setError]                   = useState<string | null>(null);
  const [panelTab, setPanelTab]             = useState<"info" | "code">("info");
  const [ctxMenu, setCtxMenu]               = useState<{ x: number; y: number; nodeId: string } | null>(null);
  const [isModalOpen, setIsModalOpen]       = useState(false);
  const [isPanelOpen, setIsPanelOpen]       = useState(false);
  const [activeMethod, setActiveMethod]     = useState<string | null>(null);
  const [traversalStatus, setTraversalStatus] = useState<string>("");
  const [isTraversing, setIsTraversing]     = useState(false);
  const cyHandle = useRef<CytoscapeBaseHandle>(null);

  const addLog = (msg: string) => setLog((p) => [msg, ...p].slice(0, 20));

  const triggerMethod = (name: string) => {
    setActiveMethod(name);
    setTimeout(() => setActiveMethod(null), 1800);
  };

  // ── Render graph on change ──────────────────────────────────────────────────

  useEffect(() => {
    const t = setTimeout(() => {
      const cy = cyHandle.current?.cy() ?? null;
      applyGraphToCytoscape(cy, graph);
      if (cy) {
        cy.off("cxttap");
        cy.on("cxttap", "node", (evt) => {
          const nodeId = evt.target.id() as string;
          const oe = evt.originalEvent as MouseEvent;
          setCtxMenu({ x: oe.clientX, y: oe.clientY, nodeId });
        });
      }
    }, 80);
    return () => clearTimeout(t);
  }, [graph]);

  // ── Dismiss context menu on outside click ───────────────────────────────────

  useEffect(() => {
    if (!ctxMenu) return;
    const handler = () => setCtxMenu(null);
    window.addEventListener("click", handler);
    return () => window.removeEventListener("click", handler);
  }, [ctxMenu]);

  // ── Graph operations ────────────────────────────────────────────────────────

  const addNode = () => {
    const label = nodeInput.trim().toUpperCase();
    if (!label) { setError("Enter a node label"); return; }
    if (graph.nodes.some(n => n.id === label)) { setError(`Node ${label} already exists`); return; }
    if (graph.nodes.length >= 12) { setError("Maximum 12 nodes"); return; }
    setError(null);
    setNodeInput("");
    setGraph(g => ({ ...g, nodes: [...g.nodes, { id: label, label }] }));
    addLog(`Added node ${label}`);
  };

  const removeNode = useCallback((overrideLabel?: string) => {
    const label = (overrideLabel ?? nodeInput).trim().toUpperCase();
    if (!label || !graph.nodes.some(n => n.id === label)) { setError(`Node ${label} not found`); return; }
    setError(null);
    if (!overrideLabel) setNodeInput("");
    setGraph(g => ({
      nodes: g.nodes.filter(n => n.id !== label),
      edges: g.edges.filter(e => e.source !== label && e.target !== label),
    }));
    addLog(`Removed node ${label} and its edges`);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph, nodeInput]);

  const addEdge = () => {
    const s = edgeSrc.trim().toUpperCase();
    const d = edgeDst.trim().toUpperCase();
    if (!s || !d) { setError("Enter source and destination nodes"); return; }
    if (s === d) { setError("Self-loops not supported"); return; }
    if (!graph.nodes.some(n => n.id === s)) { setError(`Node ${s} not found`); return; }
    if (!graph.nodes.some(n => n.id === d)) { setError(`Node ${d} not found`); return; }
    const edgeId    = `${s}${d}`;
    const edgeIdRev = `${d}${s}`;
    if (graph.edges.some(e => e.id === edgeId || e.id === edgeIdRev)) { setError("Edge already exists"); return; }
    setError(null);
    setEdgeSrc(""); setEdgeDst("");
    setGraph(g => ({ ...g, edges: [...g.edges, { id: edgeId, source: s, target: d }] }));
    addLog(`Added edge ${s} — ${d}`);
  };

  const removeEdge = () => {
    const s = edgeSrc.trim().toUpperCase();
    const d = edgeDst.trim().toUpperCase();
    const edgeId    = `${s}${d}`;
    const edgeIdRev = `${d}${s}`;
    const found = graph.edges.find(e => e.id === edgeId || e.id === edgeIdRev);
    if (!found) { setError(`Edge ${s}—${d} not found`); return; }
    setError(null);
    setEdgeSrc(""); setEdgeDst("");
    setGraph(g => ({ ...g, edges: g.edges.filter(e => e.id !== found.id) }));
    addLog(`Removed edge ${s}—${d}`);
  };

  const resetGraph = () => {
    setGraph(INITIAL_GRAPH);
    addLog("Graph reset to default");
    setError(null);
  };

  // ── BFS ─────────────────────────────────────────────────────────────────────

  const runBFS = () => {
    if (isTraversing) return;
    if (!graph.nodes.some(n => n.id === startNode)) { setError(`Start node ${startNode} not found`); return; }
    setError(null);
    setIsTraversing(true);
    triggerMethod("bfs");

    // Build adjacency list (undirected)
    const adj: Record<string, string[]> = {};
    graph.nodes.forEach(n => { adj[n.id] = []; });
    graph.edges.forEach(e => {
      adj[e.source].push(e.target);
      adj[e.target].push(e.source);
    });

    // Collect steps
    const visited = new Set<string>();
    const queue: string[] = [startNode];
    visited.add(startNode);
    const steps: Array<{ nodeClasses: Record<string, string>; edgeClasses: Set<string>; desc: string }> = [];
    const traversedEdges = new Set<string>();

    steps.push({
      nodeClasses: { [startNode]: "start" },
      edgeClasses: new Set(),
      desc: `BFS: starting at node ${startNode}`,
    });

    while (queue.length > 0) {
      const current = queue.shift()!;
      const classes: Record<string, string> = { [current]: "current" };
      visited.forEach(v => { if (v !== current) classes[v] = "visited"; });
      queue.forEach(q => { classes[q] = "queued"; });

      steps.push({
        nodeClasses: { ...classes },
        edgeClasses: new Set(traversedEdges),
        desc: `BFS: visiting ${current}`,
      });

      const neighbors = (adj[current] ?? []).sort();
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);

          const edgeId = graph.edges.find(e =>
            (e.source === current && e.target === neighbor) ||
            (e.source === neighbor && e.target === current)
          )?.id;
          if (edgeId) traversedEdges.add(edgeId);

          const nextClasses: Record<string, string> = { [current]: "current" };
          visited.forEach(v => { if (v !== current && v !== neighbor) nextClasses[v] = "visited"; });
          nextClasses[neighbor] = "queued";
          queue.forEach(q => { if (q !== neighbor) nextClasses[q] = "queued"; });

          steps.push({
            nodeClasses: { ...nextClasses },
            edgeClasses: new Set(traversedEdges),
            desc: `BFS: found neighbor ${neighbor}, added to queue`,
          });
        }
      }
    }

    const bfsOrder = [...visited];
    steps.push({
      nodeClasses: Object.fromEntries([...visited].map(v => [v, "visited"])),
      edgeClasses: new Set(traversedEdges),
      desc: `BFS complete: order [${bfsOrder.join(" → ")}]`,
    });

    addLog(`BFS from ${startNode}: [${bfsOrder.join(", ")}]`);

    // Animate steps
    steps.forEach((step, i) => {
      setTimeout(() => {
        const cy = cyHandle.current?.cy() ?? null;
        if (!cy) return;
        cy.nodes().forEach(node => {
          const cls = step.nodeClasses[node.id()] ?? "";
          node.removeClass("visited current queued start").addClass(cls);
        });
        cy.edges().forEach(edge => {
          if (step.edgeClasses.has(edge.id())) edge.addClass("traversed");
          else edge.removeClass("traversed");
        });
        setTraversalStatus(step.desc);
        if (i === steps.length - 1) {
          setTimeout(() => { setIsTraversing(false); setTraversalStatus(""); }, 1000);
        }
      }, i * 600);
    });
  };

  // ── DFS ─────────────────────────────────────────────────────────────────────

  const runDFS = () => {
    if (isTraversing) return;
    if (!graph.nodes.some(n => n.id === startNode)) { setError(`Start node ${startNode} not found`); return; }
    setError(null);
    setIsTraversing(true);
    triggerMethod("dfs");

    const adj: Record<string, string[]> = {};
    graph.nodes.forEach(n => { adj[n.id] = []; });
    graph.edges.forEach(e => {
      adj[e.source].push(e.target);
      adj[e.target].push(e.source);
    });

    const visited = new Set<string>();
    const dfsOrder: string[] = [];
    const steps: Array<{ nodeClasses: Record<string, string>; edgeClasses: Set<string>; desc: string }> = [];
    const traversedEdges = new Set<string>();

    steps.push({
      nodeClasses: { [startNode]: "start" },
      edgeClasses: new Set(),
      desc: `DFS: starting at node ${startNode}`,
    });

    // Iterative DFS
    const stack: Array<{ node: string; parent: string | null }> = [{ node: startNode, parent: null }];

    while (stack.length > 0) {
      const { node: current, parent } = stack.pop()!;
      if (visited.has(current)) continue;

      visited.add(current);
      dfsOrder.push(current);

      if (parent) {
        const edgeId = graph.edges.find(e =>
          (e.source === current && e.target === parent) ||
          (e.source === parent && e.target === current)
        )?.id;
        if (edgeId) traversedEdges.add(edgeId);
      }

      const classes: Record<string, string> = { [current]: "current" };
      visited.forEach(v => { if (v !== current) classes[v] = "visited"; });

      steps.push({
        nodeClasses: { ...classes },
        edgeClasses: new Set(traversedEdges),
        desc: `DFS: visiting ${current}`,
      });

      const neighbors = (adj[current] ?? []).sort().reverse();
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          stack.push({ node: neighbor, parent: current });
        }
      }
    }

    steps.push({
      nodeClasses: Object.fromEntries([...visited].map(v => [v, "visited"])),
      edgeClasses: new Set(traversedEdges),
      desc: `DFS complete: order [${dfsOrder.join(" → ")}]`,
    });

    addLog(`DFS from ${startNode}: [${dfsOrder.join(", ")}]`);

    // Animate steps
    steps.forEach((step, i) => {
      setTimeout(() => {
        const cy = cyHandle.current?.cy() ?? null;
        if (!cy) return;
        cy.nodes().forEach(node => {
          const cls = step.nodeClasses[node.id()] ?? "";
          node.removeClass("visited current queued start").addClass(cls);
        });
        cy.edges().forEach(edge => {
          if (step.edgeClasses.has(edge.id())) edge.addClass("traversed");
          else edge.removeClass("traversed");
        });
        setTraversalStatus(step.desc);
        if (i === steps.length - 1) {
          setTimeout(() => { setIsTraversing(false); setTraversalStatus(""); }, 1000);
        }
      }, i * 600);
    });
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col min-h-dvh" style={{ background: "var(--color-bg)" }}>
      {/* Header */}
      <div className="px-5 pt-6 pb-4" style={{ borderBottom: "1px solid var(--color-border)" }}>
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <h1 className="text-2xl font-bold">Graph</h1>
          <Pill text="Undirected" />
          <Pill text="BFS/DFS" green />
          <div className="ml-auto flex gap-2">
            <button
              onClick={() => setIsPanelOpen(p => !p)}
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
          Vertices connected by edges. Traverse with BFS (level-by-level) or DFS (depth-first). Right-click any node for quick actions.
        </p>
      </div>

      <div className="flex flex-col flex-1">
        <div className="flex-1 px-5 pt-5 pb-4 flex flex-col gap-4">
          {/* Stats */}
          <div className="flex flex-wrap gap-6">
            <DStat label="Nodes" value={graph.nodes.length} />
            <DStat label="Edges" value={graph.edges.length} />
            <DStat label="Start" value={startNode} color="var(--color-accent)" />
          </div>

          {/* Cytoscape canvas */}
          <CytoscapeBase ref={cyHandle} stylesheet={STYLESHEET} style={{ height: 360 }} />

          {/* Color legend */}
          <div className="flex flex-wrap gap-4">
            {[
              { label: "start",           color: "#06b6d4" },
              { label: "current",         color: "#22c55e" },
              { label: "queued/stacked",  color: "#f59e0b" },
              { label: "visited",         color: "#7c6af7" },
              { label: "traversed edge",  color: "#7c6af7" },
            ].map(({ label, color }) => (
              <div key={label} className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full" style={{ background: color }} />
                <span className="text-xs" style={{ color: "var(--color-muted)" }}>{label}</span>
              </div>
            ))}
          </div>

          {/* Traversal status */}
          {traversalStatus && (
            <div
              className="rounded-lg px-4 py-3 text-sm"
              style={{ background: "var(--color-surface-2)", color: "var(--color-accent)" }}
            >
              {traversalStatus}
            </div>
          )}

          {/* Controls */}
          <div className="flex flex-col gap-3">
            {/* Row 1: Node operations */}
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-xs font-medium w-14 shrink-0" style={{ color: "var(--color-muted)" }}>Node</span>
              <input
                type="text"
                value={nodeInput}
                onChange={(e) => setNodeInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") addNode(); }}
                placeholder="Label (A-Z)"
                className="rounded-lg px-3 py-2 text-sm w-28 outline-none uppercase"
                style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)", color: "var(--color-text)" }}
              />
              <DBtn onClick={addNode} primary>Add Node</DBtn>
              <DBtn onClick={() => removeNode()}>Remove Node</DBtn>
            </div>

            {/* Row 2: Edge operations */}
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-xs font-medium w-14 shrink-0" style={{ color: "var(--color-muted)" }}>Edge</span>
              <input
                type="text"
                value={edgeSrc}
                onChange={(e) => setEdgeSrc(e.target.value)}
                placeholder="From"
                className="rounded-lg px-3 py-2 text-sm w-20 outline-none uppercase"
                style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)", color: "var(--color-text)" }}
              />
              <span style={{ color: "var(--color-muted)" }}>—</span>
              <input
                type="text"
                value={edgeDst}
                onChange={(e) => setEdgeDst(e.target.value)}
                placeholder="To"
                className="rounded-lg px-3 py-2 text-sm w-20 outline-none uppercase"
                style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)", color: "var(--color-text)" }}
              />
              <DBtn onClick={addEdge}>Add Edge</DBtn>
              <DBtn onClick={removeEdge}>Remove Edge</DBtn>
            </div>

            {/* Row 3: Traversal */}
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-xs font-medium w-14 shrink-0" style={{ color: "var(--color-muted)" }}>Start</span>
              <input
                type="text"
                value={startNode}
                onChange={(e) => setStartNode(e.target.value.toUpperCase())}
                placeholder="Start"
                className="rounded-lg px-3 py-2 text-sm w-20 outline-none uppercase"
                style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)", color: "var(--color-accent)" }}
              />
              <DBtn onClick={runBFS} primary disabled={isTraversing}>BFS</DBtn>
              <DBtn onClick={runDFS} disabled={isTraversing}>DFS</DBtn>
              <DBtn onClick={resetGraph}>Reset</DBtn>
            </div>
          </div>

          {/* Error */}
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
          <CtxItem onClick={() => { setStartNode(ctxMenu.nodeId); setCtxMenu(null); }}>
            Set as start node
          </CtxItem>
          <CtxItem danger onClick={() => { removeNode(ctxMenu.nodeId); setCtxMenu(null); }}>
            Remove node
          </CtxItem>
        </ContextMenu>
      )}

      <PanelModal isOpen={isPanelOpen} onClose={() => setIsPanelOpen(false)} title="Graph Info">
        <SidePanel tab={panelTab} setTab={setPanelTab} log={log} graph={graph} />
      </PanelModal>

      <CodeModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        algorithmId="graph"
        activeMethod={activeMethod}
      />
    </div>
  );
}

// ── SidePanel ─────────────────────────────────────────────────────────────────

function SidePanel({
  tab, setTab, log, graph,
}: {
  tab: "info" | "code";
  setTab: (t: "info" | "code") => void;
  log: string[];
  graph: GraphData;
}) {
  return (
    <div>
      <TabBar tabs={["info", "code"]} active={tab} onChange={(t) => setTab(t as "info" | "code")} />
      {tab === "code" ? (
        <CodePanel id="graph" />
      ) : (
        <div className="space-y-6">
          <LogBox log={log} />
          <div>
            <SectionLabel>Adjacency List</SectionLabel>
            <div
              className="rounded-lg p-3 text-xs font-mono space-y-1"
              style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)" }}
            >
              {graph.nodes.map(n => {
                const neighbors = graph.edges
                  .filter(e => e.source === n.id || e.target === n.id)
                  .map(e => e.source === n.id ? e.target : e.source)
                  .sort();
                return (
                  <div key={n.id}>
                    <span style={{ color: "var(--color-accent)" }}>{n.id}</span>
                    <span style={{ color: "var(--color-muted)" }}> → [{neighbors.join(", ")}]</span>
                  </div>
                );
              })}
            </div>
          </div>
          <div>
            <SectionLabel>Operations</SectionLabel>
            <OpsTable ops={[
              { op: "BFS",       desc: "Breadth-first search", time: "O(V+E)" },
              { op: "DFS",       desc: "Depth-first search",   time: "O(V+E)" },
              { op: "add node",  desc: "Add vertex",           time: "O(1)" },
              { op: "add edge",  desc: "Add edge",             time: "O(1)" },
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

function CtxItem({
  children, onClick, danger,
}: {
  children: React.ReactNode; onClick: () => void; danger?: boolean;
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
      onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "var(--color-surface-3)")}
      onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "transparent")}
    >
      {children}
    </button>
  );
}

// ── Shared primitives ─────────────────────────────────────────────────────────

function TabBar({ tabs, active, onChange }: { tabs: string[]; active: string; onChange: (t: string) => void }) {
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
    <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--color-muted)" }}>
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

function Pill({ text, green }: { text: string; green?: boolean }) {
  return (
    <span
      className="text-xs font-mono px-2 py-0.5 rounded-full"
      style={{
        background: green ? "rgba(34,197,94,0.12)" : "rgba(124,106,247,0.15)",
        color: green ? "var(--color-state-sorted)" : "var(--color-accent)",
      }}
    >
      {text}
    </span>
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
      className="px-3 py-2 rounded-lg text-sm font-medium transition-colors"
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
