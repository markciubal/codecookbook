"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Zap, Info, MousePointer2, GripVertical, Network } from "lucide-react";
import PlaybackControls from "./PlaybackControls";
import CytoscapeBase, { type CytoscapeBaseHandle } from "./CytoscapeBase";
import CodePanel from "./CodePanel";
import CodeModal from "./CodeModal";
import PanelModal from "./PanelModal";

// ── Types ─────────────────────────────────────────────────────────────────────

interface GraphData {
  nodes: { id: string; label: string }[];
  edges: { id: string; source: string; target: string; weight?: number }[];
}

type TraversalStep = {
  nodeClasses: Record<string, string>;
  edgeClasses: Set<string>;
  desc: string;
};

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

const INITIAL_WEIGHTED_GRAPH: GraphData = {
  nodes: [
    { id: "A", label: "A" },
    { id: "B", label: "B" },
    { id: "C", label: "C" },
    { id: "D", label: "D" },
    { id: "E", label: "E" },
    { id: "F", label: "F" },
  ],
  edges: [
    { id: "AB", source: "A", target: "B", weight: 4 },
    { id: "AC", source: "A", target: "C", weight: 2 },
    { id: "BC", source: "B", target: "C", weight: 1 },
    { id: "BD", source: "B", target: "D", weight: 5 },
    { id: "CE", source: "C", target: "E", weight: 8 },
    { id: "DE", source: "D", target: "E", weight: 2 },
    { id: "DF", source: "D", target: "F", weight: 6 },
    { id: "EF", source: "E", target: "F", weight: 3 },
  ],
};

function buildRandomGraph(weighted = false, minNodes = 4, maxNodes = 8, maxExtra = 3): GraphData {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const nodeCount = Math.floor(Math.random() * (maxNodes - minNodes + 1)) + minNodes;
  const nodeIds = Array.from({ length: nodeCount }, (_, i) => letters[i]);
  const nodes = nodeIds.map(id => ({ id, label: id }));
  const edges: GraphData["edges"] = [];
  const shuffled = [...nodeIds].sort(() => Math.random() - 0.5);
  for (let i = 1; i < shuffled.length; i++) {
    const src = shuffled[Math.floor(Math.random() * i)];
    const dst = shuffled[i];
    const id = src < dst ? src + dst : dst + src;
    const weight = Math.floor(Math.random() * 9) + 1;
    edges.push({ id, source: src, target: dst, ...(weighted ? { weight } : {}) });
  }
  const extra = Math.floor(Math.random() * (maxExtra + 1));
  for (let i = 0; i < extra; i++) {
    const src = nodeIds[Math.floor(Math.random() * nodeIds.length)];
    const dst = nodeIds[Math.floor(Math.random() * nodeIds.length)];
    if (src === dst) continue;
    const id = src < dst ? src + dst : dst + src;
    if (edges.find(e => e.id === id)) continue;
    const weight = Math.floor(Math.random() * 9) + 1;
    edges.push({ id, source: src, target: dst, ...(weighted ? { weight } : {}) });
  }
  return { nodes, edges };
}

const INITIAL_LARGE_WEIGHTED_GRAPH: GraphData = {
  nodes: "ABCDEFGHIJ".split("").map(id => ({ id, label: id })),
  edges: [
    { id: "AB", source: "A", target: "B", weight: 3 },
    { id: "AC", source: "A", target: "C", weight: 7 },
    { id: "AD", source: "A", target: "D", weight: 2 },
    { id: "BC", source: "B", target: "C", weight: 1 },
    { id: "BE", source: "B", target: "E", weight: 5 },
    { id: "CD", source: "C", target: "D", weight: 4 },
    { id: "CF", source: "C", target: "F", weight: 6 },
    { id: "DE", source: "D", target: "E", weight: 8 },
    { id: "DG", source: "D", target: "G", weight: 3 },
    { id: "EF", source: "E", target: "F", weight: 2 },
    { id: "EH", source: "E", target: "H", weight: 7 },
    { id: "FI", source: "F", target: "I", weight: 4 },
    { id: "GH", source: "G", target: "H", weight: 5 },
    { id: "HI", source: "H", target: "I", weight: 1 },
    { id: "IJ", source: "I", target: "J", weight: 6 },
    { id: "GJ", source: "G", target: "J", weight: 9 },
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
      width: "data(lineWidth)",
      "line-color": "#4a4a6a",
      "target-arrow-color": "#4a4a6a",
      "target-arrow-shape": "none",
      "curve-style": "bezier",
      "line-cap": "round",
      label: "data(weight)",
      "font-size": "11px",
      "font-family": "monospace",
      color: "#888",
      "text-background-opacity": 1,
      "text-background-color": "#faf8f3",
      "text-background-padding": "2px",
    },
  },
  { selector: "edge.traversed", style: { "line-color": "#7c6af7", width: "data(lineWidth)" } },
  { selector: "edge.shortest",  style: { "line-color": "#22c55e", width: "data(lineWidth)" } },
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
    graph.edges.forEach(({ id, source, target, weight }) => {
      const lineWidth = weight != null ? 1.5 + (weight - 1) * (5.5 / 8) : 2;
      cy.add({
        group: "edges",
        data: { id, source, target, weight: weight != null ? weight : "", lineWidth },
        classes: edgeClasses.has(id) ? "traversed" : "",
      });
    });
    cy.layout({ name: "cose", padding: 40, animate: false } as Parameters<typeof cy.layout>[0]).run();
  });
}

function applyTraversalStep(
  cy: ReturnType<CytoscapeBaseHandle["cy"]>,
  step: TraversalStep
) {
  if (!cy) return;
  cy.batch(() => {
    cy.nodes().forEach(node => {
      const cls = step.nodeClasses[node.id()] ?? "";
      node.removeClass("visited current queued start").addClass(cls);
    });
    cy.edges().forEach(edge => {
      edge.removeClass("traversed shortest");
      if (step.edgeClasses.has(edge.id())) edge.addClass("traversed");
    });
  });
}

// ── Main component ────────────────────────────────────────────────────────────

export default function GraphVisualizer() {
  const [graph, setGraph]               = useState<GraphData>(() => buildRandomGraph(false, 2, 4, 0));
  const [advancedLevel, setAdvancedLevel] = useState<0 | 1 | 2>(0);
  const advancedMode = advancedLevel >= 1;
  const [advancedMenuOpen, setAdvancedMenuOpen] = useState(false);
  const advancedMenuRef = useRef<HTMLDivElement>(null);
  const [layoutRepulsion, setLayoutRepulsion] = useState(2000);
  const [layoutEdgeLen, setLayoutEdgeLen]     = useState(80);
  const [layoutGravity, setLayoutGravity]     = useState(25);
  const [nodeInput, setNodeInput]       = useState("");
  const [edgeSrc, setEdgeSrc]           = useState("");
  const [edgeDst, setEdgeDst]           = useState("");
  const [edgeWeight, setEdgeWeight]     = useState("1");
  const [startNode, setStartNode]       = useState("A");
  const [log, setLog]                   = useState<string[]>([`Graph initialized with ${graph.nodes.length} nodes`]);
  const [error, setError]               = useState<string | null>(null);
  const [panelTab, setPanelTab]         = useState<"info" | "code">("info");
  const [ctxMenu, setCtxMenu]           = useState<{ x: number; y: number; nodeId: string } | null>(null);
  const [isModalOpen, setIsModalOpen]     = useState(false);
  const [isPanelOpen, setIsPanelOpen]     = useState(false);
  const [isInteractOpen, setIsInteractOpen] = useState(false);
  const [interactPos, setInteractPos] = useState<{ x: number; y: number } | null>(null);
  const interactRef = useRef<HTMLDivElement>(null);
  const interactDragOrigin = useRef<{ mx: number; my: number; px: number; py: number } | null>(null);
  const [activeMethod, setActiveMethod] = useState<string | null>(null);

  // Traversal playback state
  const [traversalSteps, setTraversalSteps]     = useState<TraversalStep[]>([]);
  const [traversalIdx, setTraversalIdx]         = useState(0);
  const [traversalPlaying, setTraversalPlaying] = useState(false);
  const [traversalSpeed, setTraversalSpeed]     = useState(600);

  const [interactionEnabled, setInteractionEnabled] = useState(false);

  const cyHandle = useRef<CytoscapeBaseHandle>(null);
  const isMounted = useRef(false);
  const [cyReady, setCyReady] = useState(false);

  const addLog = (msg: string) => setLog((p) => [msg, ...p].slice(0, 20));

  const triggerMethod = (name: string) => {
    setActiveMethod(name);
    setTimeout(() => setActiveMethod(null), 1800);
  };

  const clearTraversal = () => {
    setTraversalSteps([]);
    setTraversalIdx(0);
    setTraversalPlaying(false);
  };

  // Switch graph when advanced level changes (skip initial mount — preserve random graph)
  useEffect(() => {
    if (!isMounted.current) { isMounted.current = true; return; }
    if (advancedLevel === 0) { setGraph(buildRandomGraph(false, 2, 4, 0)); addLog("Standard mode: random graph loaded"); }
    else if (advancedLevel === 1) { setGraph(buildRandomGraph(true, 3, 5, 0)); addLog("Less Advanced: small weighted graph loaded"); }
    else { setGraph(INITIAL_LARGE_WEIGHTED_GRAPH); addLog("More Advanced: large weighted graph loaded"); }
    clearTraversal();
    setStartNode("A");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [advancedLevel]);

  // ── Render graph on change ──────────────────────────────────────────────────

  useEffect(() => {
    if (!cyReady) return;
    const cy = cyHandle.current?.cy() ?? null;
    applyGraphToCytoscape(cy, graph);
    clearTraversal();
    if (cy) {
      cy.off("cxttap");
      cy.on("cxttap", "node", (evt) => {
        const nodeId = evt.target.id() as string;
        const oe = evt.originalEvent as MouseEvent;
        setCtxMenu({ x: oe.clientX, y: oe.clientY, nodeId });
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph, cyReady]);

  // ── Apply traversal step to cytoscape ──────────────────────────────────────

  useEffect(() => {
    if (traversalSteps.length === 0) return;
    const step = traversalSteps[traversalIdx];
    if (!step) return;
    const cy = cyHandle.current?.cy() ?? null;
    applyTraversalStep(cy, step);
  }, [traversalIdx, traversalSteps]);

  // ── Auto-play loop ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (!traversalPlaying) return;
    if (traversalIdx >= traversalSteps.length - 1) {
      setTraversalPlaying(false);
      return;
    }
    const t = setTimeout(() => setTraversalIdx((p) => p + 1), traversalSpeed);
    return () => clearTimeout(t);
  }, [traversalPlaying, traversalIdx, traversalSteps.length, traversalSpeed]);

  // Reset cytoscape highlighting when traversal is cleared
  useEffect(() => {
    if (traversalSteps.length > 0) return;
    const cy = cyHandle.current?.cy() ?? null;
    if (!cy) return;
    cy.nodes().forEach(n => { n.removeClass("visited current queued start"); });
    cy.edges().forEach(e => { e.removeClass("traversed shortest"); });
  }, [traversalSteps.length]);

  // Toggle Cytoscape user interaction (pan/zoom/drag)
  useEffect(() => {
    const cy = cyHandle.current?.cy() ?? null;
    if (!cy) return;
    cy.userZoomingEnabled(interactionEnabled);
    cy.userPanningEnabled(interactionEnabled);
    cy.autoungrabify(!interactionEnabled);
  }, [interactionEnabled]);

  // ── Dismiss advanced menu on outside click ───────────────────────────────────

  useEffect(() => {
    if (!advancedMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (advancedMenuRef.current && !advancedMenuRef.current.contains(e.target as Node)) {
        setAdvancedMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [advancedMenuOpen]);

  // ── Dismiss interact popover on outside click ────────────────────────────────

  useEffect(() => {
    if (!isInteractOpen) return;
    const handler = (e: MouseEvent) => {
      if (interactRef.current && !interactRef.current.contains(e.target as Node)) {
        setIsInteractOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isInteractOpen]);

  // ── Dismiss context menu ────────────────────────────────────────────────────

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
    const w = advancedMode ? (parseInt(edgeWeight, 10) || 1) : undefined;
    setGraph(g => ({ ...g, edges: [...g.edges, { id: edgeId, source: s, target: d, weight: w }] }));
    addLog(`Added edge ${s}—${d}${w != null ? ` (weight ${w})` : ""}`);
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
    if (advancedLevel === 2) setGraph(INITIAL_LARGE_WEIGHTED_GRAPH);
    else if (advancedLevel === 1) setGraph(INITIAL_WEIGHTED_GRAPH);
    else setGraph(INITIAL_GRAPH);
    addLog("Graph reset to default");
    setError(null);
  };

  const runForceLayout = useCallback(() => {
    const cy = cyHandle.current?.cy() ?? null;
    if (!cy) return;
    cy.layout({
      name: "cose",
      animate: true,
      animationDuration: 500,
      nodeRepulsion: () => layoutRepulsion,
      idealEdgeLength: () => layoutEdgeLen,
      gravity: layoutGravity / 100,
      padding: 40,
    } as Parameters<typeof cy.layout>[0]).run();
    addLog(`Force layout: repulsion=${layoutRepulsion} edgeLen=${layoutEdgeLen} gravity=${layoutGravity}`);
  }, [layoutRepulsion, layoutEdgeLen, layoutGravity]);

  const openInteract = () => {
    if (!isInteractOpen && interactPos === null) {
      const rect = interactRef.current?.getBoundingClientRect();
      if (rect) {
        setInteractPos({ x: Math.max(8, rect.right - 500), y: rect.bottom + 8 });
      }
    }
    setIsInteractOpen(p => !p);
  };

  const startInteractDrag = (e: React.MouseEvent) => {
    if (!interactPos) return;
    e.preventDefault();
    interactDragOrigin.current = { mx: e.clientX, my: e.clientY, px: interactPos.x, py: interactPos.y };
    const onMove = (me: MouseEvent) => {
      if (!interactDragOrigin.current) return;
      setInteractPos({
        x: interactDragOrigin.current.px + me.clientX - interactDragOrigin.current.mx,
        y: interactDragOrigin.current.py + me.clientY - interactDragOrigin.current.my,
      });
    };
    const onUp = () => {
      interactDragOrigin.current = null;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  const randomizeGraph = () => {
    clearTraversal();
    const g = advancedLevel === 1
      ? buildRandomGraph(true, 3, 5, 0)
      : buildRandomGraph(advancedMode, 2, 4, 0);
    setGraph(g);
    setStartNode(g.nodes[0].id);
    addLog(`Randomized graph with ${g.nodes.length} nodes`);
    setError(null);
  };

  // ── Traversal builders ──────────────────────────────────────────────────────

  const buildBFSSteps = (): TraversalStep[] => {
    const adj: Record<string, string[]> = {};
    graph.nodes.forEach(n => { adj[n.id] = []; });
    graph.edges.forEach(e => {
      adj[e.source].push(e.target);
      adj[e.target].push(e.source);
    });

    const visited = new Set<string>();
    const queue: string[] = [startNode];
    visited.add(startNode);
    const steps: TraversalStep[] = [];
    const traversedEdges = new Set<string>();

    steps.push({ nodeClasses: { [startNode]: "start" }, edgeClasses: new Set(), desc: `BFS: starting at node ${startNode}` });

    while (queue.length > 0) {
      const current = queue.shift()!;
      const classes: Record<string, string> = { [current]: "current" };
      visited.forEach(v => { if (v !== current) classes[v] = "visited"; });
      queue.forEach(q => { classes[q] = "queued"; });
      steps.push({ nodeClasses: { ...classes }, edgeClasses: new Set(traversedEdges), desc: `BFS: visiting ${current}` });

      for (const neighbor of (adj[current] ?? []).sort()) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
          const edgeId = graph.edges.find(e =>
            (e.source === current && e.target === neighbor) || (e.source === neighbor && e.target === current)
          )?.id;
          if (edgeId) traversedEdges.add(edgeId);
          const nc: Record<string, string> = { [current]: "current" };
          visited.forEach(v => { if (v !== current && v !== neighbor) nc[v] = "visited"; });
          nc[neighbor] = "queued";
          queue.forEach(q => { if (q !== neighbor) nc[q] = "queued"; });
          steps.push({ nodeClasses: { ...nc }, edgeClasses: new Set(traversedEdges), desc: `BFS: found neighbor ${neighbor}, added to queue` });
        }
      }
    }

    const bfsOrder = [...visited];
    steps.push({
      nodeClasses: Object.fromEntries([...visited].map(v => [v, "visited"])),
      edgeClasses: new Set(traversedEdges),
      desc: `BFS complete: [${bfsOrder.join(" → ")}]`,
    });
    addLog(`BFS from ${startNode}: [${bfsOrder.join(", ")}]`);
    return steps;
  };

  const buildDFSSteps = (): TraversalStep[] => {
    const adj: Record<string, string[]> = {};
    graph.nodes.forEach(n => { adj[n.id] = []; });
    graph.edges.forEach(e => {
      adj[e.source].push(e.target);
      adj[e.target].push(e.source);
    });

    const visited = new Set<string>();
    const dfsOrder: string[] = [];
    const steps: TraversalStep[] = [];
    const traversedEdges = new Set<string>();

    steps.push({ nodeClasses: { [startNode]: "start" }, edgeClasses: new Set(), desc: `DFS: starting at node ${startNode}` });

    const stack: Array<{ node: string; parent: string | null }> = [{ node: startNode, parent: null }];
    while (stack.length > 0) {
      const { node: current, parent } = stack.pop()!;
      if (visited.has(current)) continue;
      visited.add(current);
      dfsOrder.push(current);
      if (parent) {
        const edgeId = graph.edges.find(e =>
          (e.source === current && e.target === parent) || (e.source === parent && e.target === current)
        )?.id;
        if (edgeId) traversedEdges.add(edgeId);
      }
      const classes: Record<string, string> = { [current]: "current" };
      visited.forEach(v => { if (v !== current) classes[v] = "visited"; });
      steps.push({ nodeClasses: { ...classes }, edgeClasses: new Set(traversedEdges), desc: `DFS: visiting ${current}` });
      for (const neighbor of (adj[current] ?? []).sort().reverse()) {
        if (!visited.has(neighbor)) stack.push({ node: neighbor, parent: current });
      }
    }

    steps.push({
      nodeClasses: Object.fromEntries([...visited].map(v => [v, "visited"])),
      edgeClasses: new Set(traversedEdges),
      desc: `DFS complete: [${dfsOrder.join(" → ")}]`,
    });
    addLog(`DFS from ${startNode}: [${dfsOrder.join(", ")}]`);
    return steps;
  };

  const buildDijkstraSteps = (): TraversalStep[] => {
    const dist: Record<string, number> = {};
    const prev: Record<string, string | null> = {};
    const finalized = new Set<string>();
    const treeEdges = new Set<string>();

    graph.nodes.forEach(n => { dist[n.id] = Infinity; prev[n.id] = null; });
    dist[startNode] = 0;

    const nodeClasses = (current: string | null): Record<string, string> => {
      const cls: Record<string, string> = {};
      graph.nodes.forEach(n => {
        if (finalized.has(n.id)) cls[n.id] = "visited";
        else if (dist[n.id] < Infinity) cls[n.id] = "queued";
      });
      if (current) cls[current] = "current";
      cls[startNode] = cls[startNode] === "current" ? "current" : (finalized.has(startNode) ? "visited" : "start");
      return cls;
    };

    const steps: TraversalStep[] = [];
    steps.push({ nodeClasses: { [startNode]: "start" }, edgeClasses: new Set(), desc: `Dijkstra: start at ${startNode}, dist = 0` });

    while (finalized.size < graph.nodes.length) {
      let u: string | null = null;
      let minDist = Infinity;
      graph.nodes.forEach(n => {
        if (!finalized.has(n.id) && dist[n.id] < minDist) { minDist = dist[n.id]; u = n.id; }
      });
      if (!u) break;

      finalized.add(u);
      steps.push({ nodeClasses: nodeClasses(u), edgeClasses: new Set(treeEdges), desc: `Dijkstra: finalized ${u} (dist = ${dist[u]})` });

      for (const edge of graph.edges) {
        const v = edge.source === u ? edge.target : edge.target === u ? edge.source : null;
        if (!v || finalized.has(v)) continue;
        const w = edge.weight ?? 1;
        const newDist = dist[u] + w;
        if (newDist < dist[v]) {
          const oldPrev = prev[v];
          if (oldPrev) {
            const oldEdge = graph.edges.find(e =>
              (e.source === oldPrev && e.target === v) || (e.source === v && e.target === oldPrev)
            );
            if (oldEdge) treeEdges.delete(oldEdge.id);
          }
          dist[v] = newDist;
          prev[v] = u;
          treeEdges.add(edge.id);
          steps.push({ nodeClasses: nodeClasses(u), edgeClasses: new Set(treeEdges), desc: `Dijkstra: relaxed ${u}→${v} (w=${w}), dist[${v}] = ${newDist}` });
        }
      }
    }

    const distStr = graph.nodes.filter(n => dist[n.id] < Infinity).map(n => `${n.id}:${dist[n.id]}`).join("  ");
    steps.push({
      nodeClasses: Object.fromEntries(graph.nodes.filter(n => finalized.has(n.id)).map(n => [n.id, n.id === startNode ? "start" : "visited"])),
      edgeClasses: new Set(treeEdges),
      desc: `Dijkstra complete — ${distStr}`,
    });
    addLog(`Dijkstra from ${startNode}: ${distStr}`);
    return steps;
  };

  const startTraversal = (steps: TraversalStep[], method: string) => {
    if (!graph.nodes.some(n => n.id === startNode)) { setError(`Start node ${startNode} not found`); return; }
    setError(null);
    triggerMethod(method);
    setTraversalSteps(steps);
    setTraversalIdx(0);
    setTraversalPlaying(true);
  };



  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: "var(--color-bg)" }}>
      {/* Header */}
      <div className="shrink-0 px-5 pt-6 pb-4" style={{ borderBottom: "1px solid var(--color-border)" }}>
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <Network size={20} style={{ color: "var(--color-accent)", flexShrink: 0 }} strokeWidth={1.75} />
          <h1 className="text-2xl font-bold">Graph</h1>
          <Pill text="Undirected" />
          {advancedMode && <Pill text="Weighted" amber />}
          <Pill text={advancedMode ? "BFS/DFS/Dijkstra" : "BFS/DFS"} green />
          <div className="ml-auto flex gap-2">
            {/* Advanced level picker */}
            <div ref={advancedMenuRef} style={{ position: "relative" }}>
              <button
                onClick={() => setAdvancedMenuOpen(p => !p)}
                title="Advanced mode"
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-mono transition-colors"
                style={{
                  background: advancedLevel > 0 ? "var(--color-accent)" : "var(--color-surface-3)",
                  border: "1px solid var(--color-border)",
                  color: advancedLevel > 0 ? "#fff" : "var(--color-muted)",
                  cursor: "pointer",
                }}
              >
                <Zap size={13} strokeWidth={1.75} />
                {advancedLevel === 0 ? "Advanced" : advancedLevel === 1 ? "Less Advanced" : "More Advanced"}
              </button>
              {advancedMenuOpen && (
                <div style={{
                  position: "absolute",
                  top: "calc(100% + 6px)",
                  right: 0,
                  zIndex: 60,
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                  background: "var(--color-surface-1)",
                  border: "1px solid var(--color-border)",
                  borderRadius: 10,
                  padding: 6,
                  boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
                  minWidth: 160,
                }}>
                  {advancedLevel > 0 && (
                    <button
                      onClick={() => { setAdvancedLevel(0); setAdvancedMenuOpen(false); }}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-mono transition-colors text-left"
                      style={{ background: "var(--color-surface-3)", border: "1px solid var(--color-border)", color: "var(--color-muted)", cursor: "pointer" }}
                    >
                      Standard
                    </button>
                  )}
                  <button
                    onClick={() => { setAdvancedLevel(1); setAdvancedMenuOpen(false); }}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-mono transition-colors text-left"
                    style={{
                      background: advancedLevel === 1 ? "var(--color-accent)" : "var(--color-surface-3)",
                      border: "1px solid var(--color-border)",
                      color: advancedLevel === 1 ? "#fff" : "var(--color-muted)",
                      cursor: "pointer",
                    }}
                  >
                    <Zap size={11} strokeWidth={1.75} /> Less Advanced
                  </button>
                  <button
                    onClick={() => { setAdvancedLevel(2); setAdvancedMenuOpen(false); }}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-mono transition-colors text-left"
                    style={{
                      background: advancedLevel === 2 ? "var(--color-accent)" : "var(--color-surface-3)",
                      border: "1px solid var(--color-border)",
                      color: advancedLevel === 2 ? "#fff" : "var(--color-muted)",
                      cursor: "pointer",
                    }}
                  >
                    <Zap size={11} strokeWidth={1.75} /><Zap size={11} strokeWidth={1.75} /> More Advanced
                  </button>
                </div>
              )}
            </div>
            {/* Interact popover */}
            <div ref={interactRef}>
              <button
                onClick={openInteract}
                title="Interact — add/remove nodes & edges, run traversals"
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-mono transition-colors"
                style={{
                  background: isInteractOpen ? "var(--color-accent)" : "var(--color-surface-3)",
                  border: "1px solid var(--color-border)",
                  color: isInteractOpen ? "#fff" : "var(--color-muted)",
                  cursor: "pointer",
                }}
              >
                <MousePointer2 size={13} strokeWidth={1.75} /> Interact
              </button>
              {isInteractOpen && interactPos && (
                <div
                  style={{
                    position: "fixed",
                    left: interactPos.x,
                    top: interactPos.y,
                    zIndex: 50,
                    minWidth: 480,
                    background: "var(--color-surface-1)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 12,
                    boxShadow: "0 8px 32px rgba(0,0,0,0.14)",
                  }}
                >
                  {/* Drag handle */}
                  <div
                    onMouseDown={startInteractDrag}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "7px 12px",
                      borderBottom: "1px solid var(--color-border)",
                      cursor: "grab",
                      userSelect: "none",
                      borderRadius: "12px 12px 0 0",
                      background: "var(--color-surface-2)",
                    }}
                  >
                    <GripVertical size={13} strokeWidth={1.75} style={{ color: "var(--color-muted)" }} />
                    <span className="text-xs font-mono" style={{ color: "var(--color-muted)" }}>Interact</span>
                  </div>
                  <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
                  {/* Node section */}
                  <div className="flex flex-col gap-1.5">
                    <span className="text-xs font-medium" style={{ color: "var(--color-muted)" }}>Node</span>
                    <div className="flex gap-2 items-center">
                      <input
                        type="text"
                        value={nodeInput}
                        onChange={(e) => setNodeInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") addNode(); }}
                        placeholder="Label (A-Z)"
                        className="rounded-lg px-3 py-2 text-sm w-28 outline-none uppercase"
                        style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)", color: "var(--color-text)" }}
                      />
                    </div>
                    <div className="flex gap-2">
                      <DBtn onClick={addNode} primary>Add Node</DBtn>
                      <DBtn onClick={() => removeNode()}>Remove Node</DBtn>
                    </div>
                  </div>

                  {/* Edge section */}
                  <div className="flex flex-col gap-1.5">
                    <span className="text-xs font-medium" style={{ color: "var(--color-muted)" }}>Edge</span>
                    <div className="flex gap-2 items-center">
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
                      {advancedMode && (
                        <input
                          type="number"
                          value={edgeWeight}
                          onChange={(e) => setEdgeWeight(e.target.value)}
                          placeholder="Weight"
                          min={1}
                          className="rounded-lg px-3 py-2 text-sm w-20 outline-none"
                          style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)", color: "var(--color-accent)" }}
                        />
                      )}
                    </div>
                    <div className="flex gap-2">
                      <DBtn onClick={addEdge}>Add Edge</DBtn>
                      <DBtn onClick={removeEdge}>Remove Edge</DBtn>
                    </div>
                  </div>

                  {/* Traversal section */}
                  <div className="flex flex-col gap-1.5">
                    <span className="text-xs font-medium" style={{ color: "var(--color-muted)" }}>Traversal</span>
                    <div className="flex gap-2 items-center">
                      <input
                        type="text"
                        value={startNode}
                        onChange={(e) => setStartNode(e.target.value.toUpperCase())}
                        placeholder="Start"
                        className="rounded-lg px-3 py-2 text-sm w-20 outline-none uppercase"
                        style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)", color: "var(--color-accent)" }}
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <DBtn onClick={() => startTraversal(buildBFSSteps(), "bfs")} primary disabled={traversalPlaying}>BFS</DBtn>
                      <DBtn onClick={() => startTraversal(buildDFSSteps(), "dfs")} disabled={traversalPlaying}>DFS</DBtn>
                      {advancedMode && (
                        <DBtn onClick={() => startTraversal(buildDijkstraSteps(), "dijkstra")} disabled={traversalPlaying}>
                          <Zap size={13} strokeWidth={1.75} /> Dijkstra
                        </DBtn>
                      )}
                      <DBtn onClick={randomizeGraph}>Randomize</DBtn>
                      <DBtn onClick={resetGraph}>Reset</DBtn>
                    </div>
                  </div>

                  {/* Force layout controls — More Advanced only */}
                  {advancedLevel === 2 && (
                    <div className="flex flex-col gap-1.5">
                      <span className="text-xs font-medium" style={{ color: "var(--color-muted)" }}>Force Layout</span>
                      <div className="flex flex-col gap-2 rounded-lg p-3" style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)" }}>
                        <label className="flex items-center justify-between gap-3">
                          <span className="text-xs w-28 shrink-0" style={{ color: "var(--color-muted)" }}>Repulsion <span className="font-mono">{layoutRepulsion}</span></span>
                          <input type="range" min={200} max={8000} step={100} value={layoutRepulsion}
                            onChange={e => setLayoutRepulsion(Number(e.target.value))}
                            className="flex-1" style={{ accentColor: "var(--color-accent)", cursor: "pointer" }} />
                        </label>
                        <label className="flex items-center justify-between gap-3">
                          <span className="text-xs w-28 shrink-0" style={{ color: "var(--color-muted)" }}>Edge length <span className="font-mono">{layoutEdgeLen}</span></span>
                          <input type="range" min={20} max={200} step={5} value={layoutEdgeLen}
                            onChange={e => setLayoutEdgeLen(Number(e.target.value))}
                            className="flex-1" style={{ accentColor: "var(--color-accent)", cursor: "pointer" }} />
                        </label>
                        <label className="flex items-center justify-between gap-3">
                          <span className="text-xs w-28 shrink-0" style={{ color: "var(--color-muted)" }}>Gravity <span className="font-mono">{layoutGravity}</span></span>
                          <input type="range" min={0} max={100} step={1} value={layoutGravity}
                            onChange={e => setLayoutGravity(Number(e.target.value))}
                            className="flex-1" style={{ accentColor: "var(--color-accent)", cursor: "pointer" }} />
                        </label>
                        <div>
                          <DBtn onClick={runForceLayout} primary>Re-run Layout</DBtn>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Error */}
                  {error && (
                    <div className="rounded-lg px-4 py-2 text-sm"
                      style={{ background: "rgba(239,68,68,0.12)", color: "var(--color-state-swap)" }}>
                      {error}
                    </div>
                  )}
                  </div>
                </div>
              )}
            </div>
            <button
              onClick={() => setIsPanelOpen(p => !p)}
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
          {advancedMode
            ? "Weighted undirected graph. Run Dijkstra's algorithm to find shortest paths from the start node."
            : "Vertices connected by edges. Traverse with BFS (level-by-level) or DFS (depth-first). Right-click any node for quick actions."}
        </p>
      </div>

      <div className="flex-1 min-h-0 px-5 pt-5 pb-4 flex flex-col gap-4 overflow-hidden">
          {/* Stats */}
          <div className="shrink-0 flex flex-wrap gap-6">
            <DStat label="Nodes" value={graph.nodes.length} />
            <DStat label="Edges" value={graph.edges.length} />
            <DStat label="Start" value={startNode} color="var(--color-accent)" />
          </div>

          {/* Cytoscape canvas */}
          <div className="flex-1 min-h-0" style={{ position: "relative" }}>
            <CytoscapeBase ref={cyHandle} stylesheet={STYLESHEET} style={{ height: "100%" }} onReady={() => setCyReady(true)} />
            <button
              onClick={() => setInteractionEnabled(p => !p)}
              title={interactionEnabled ? "Lock graph" : "Allow drag / pan / zoom"}
              style={{
                position: "absolute",
                bottom: 10,
                right: 10,
                padding: "4px 10px",
                borderRadius: 8,
                fontSize: 11,
                fontFamily: "monospace",
                background: interactionEnabled ? "var(--color-accent)" : "var(--color-surface-3)",
                color: interactionEnabled ? "#fff" : "var(--color-muted)",
                border: "1px solid " + (interactionEnabled ? "var(--color-accent)" : "var(--color-border)"),
                cursor: "pointer",
                opacity: 0.85,
              }}
            >
              {interactionEnabled ? "🔓 Interactive" : "🔒 Locked"}
            </button>
          </div>

          {/* Color legend */}
          <div className="shrink-0 flex flex-wrap gap-4">
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

          {/* Traversal playback — shown once a traversal has been started */}
          {traversalSteps.length > 0 && (
            <div className="shrink-0 flex flex-col gap-2">
              <div
                className="rounded-lg px-4 py-3 text-sm"
                style={{ background: "var(--color-surface-2)", color: "var(--color-accent)", minHeight: "2.5rem" }}
              >
                {traversalSteps[traversalIdx]?.desc ?? ""}
              </div>
              <PlaybackControls
                stepCount={traversalSteps.length}
                stepIdx={traversalIdx}
                setStepIdx={setTraversalIdx}
                isPlaying={traversalPlaying}
                setIsPlaying={setTraversalPlaying}
                speed={traversalSpeed}
                setSpeed={setTraversalSpeed}
                onReset={clearTraversal}
                resetLabel="Clear"
              />
            </div>
          )}

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
        <SidePanel tab={panelTab} setTab={setPanelTab} log={log} graph={graph} advancedMode={advancedMode} />
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
  tab, setTab, log, graph, advancedMode,
}: {
  tab: "info" | "code";
  setTab: (t: "info" | "code") => void;
  log: string[];
  graph: GraphData;
  advancedMode: boolean;
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
                  .map(e => {
                    const neighbor = e.source === n.id ? e.target : e.source;
                    return advancedMode && e.weight != null ? `${neighbor}(${e.weight})` : neighbor;
                  })
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
              ...(advancedMode ? [{ op: "Dijkstra", desc: "Shortest paths (weighted)", time: "O(V²)" }] : []),
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

function Pill({ text, green, amber }: { text: string; green?: boolean; amber?: boolean }) {
  const bg = green ? "rgba(34,197,94,0.12)" : amber ? "rgba(245,158,11,0.15)" : "rgba(124,106,247,0.15)";
  const fg = green ? "var(--color-state-sorted)" : amber ? "var(--color-state-current)" : "var(--color-accent)";
  return (
    <span className="text-xs font-mono px-2 py-0.5 rounded-full" style={{ background: bg, color: fg }}>
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
  children, onClick, primary, disabled, style,
}: {
  children: React.ReactNode;
  onClick: () => void;
  primary?: boolean;
  disabled?: boolean;
  style?: React.CSSProperties;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors"
      style={{
        background: primary ? "var(--color-accent)" : "var(--color-surface-3)",
        color: primary ? "#fff" : "var(--color-text)",
        border: "1px solid " + (primary ? "var(--color-accent)" : "var(--color-border)"),
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        ...style,
      }}
    >
      {children}
    </button>
  );
}
