"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Network } from "lucide-react";
import PlaybackControls from "./PlaybackControls";
import {
  getGraphSteps,
  generateRandomGraph,
  GRAPH_ALGO_META,
  UNDIRECTED_NODES,
  UNDIRECTED_EDGES,
  DIRECTED_NODES,
  DIRECTED_EDGES,
} from "@/lib/graph-algorithms";
import type {
  GraphAlgorithm,
  GraphStep,
  GraphNode,
  GraphEdge,
  NodeState,
  EdgeState,
} from "@/lib/graph-algorithms";

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  algorithm: GraphAlgorithm;
}

// ── Color maps ────────────────────────────────────────────────────────────────

const NODE_FILL: Record<NodeState, string> = {
  default:  "var(--color-surface-2)",
  current:  "var(--color-accent)",
  frontier: "var(--color-state-compare)",
  visited:  "var(--color-state-sorted)",
  inMST:    "var(--color-state-sorted)",
};

const NODE_STROKE: Record<NodeState, string> = {
  default:  "var(--color-border)",
  current:  "var(--color-accent)",
  frontier: "var(--color-state-compare)",
  visited:  "var(--color-state-sorted)",
  inMST:    "var(--color-state-sorted)",
};

const NODE_TEXT: Record<NodeState, string> = {
  default:  "var(--color-text)",
  current:  "#fff",
  frontier: "#fff",
  visited:  "#fff",
  inMST:    "#fff",
};

const EDGE_STROKE: Record<EdgeState, string> = {
  default: "var(--color-border)",
  tree:    "var(--color-accent)",
  back:    "var(--color-state-swap)",
  cross:   "var(--color-muted)",
  mst:     "var(--color-state-sorted)",
  relaxed: "var(--color-state-compare)",
};


// ── Source node options ───────────────────────────────────────────────────────

const SOURCE_CAPABLE: GraphAlgorithm[] = ["bfs", "dfs", "dijkstra", "bellman-ford", "prim"];

// ── SVG constants ─────────────────────────────────────────────────────────────

const SVG_W = 600;
const SVG_H = 400;
const NODE_R = 20;

// ── Arrow markers: one per edge × state, sized proportional to weight ────────

const ARROW_STATE_COLOR: Record<EdgeState, string> = {
  default: "var(--color-border)",
  tree:    "var(--color-accent)",
  mst:     "var(--color-state-sorted)",
  relaxed: "var(--color-state-compare)",
  back:    "var(--color-state-swap)",
  cross:   "var(--color-muted)",
};
const ARROW_STATES: EdgeState[] = ["default", "tree", "mst", "relaxed", "back", "cross"];

/** Max arrow tip width at weight ceiling (px, userSpaceOnUse). */
const MAX_ARROW_W = 18;
const MIN_ARROW_W = 5;

function arrowDims(weight: number, maxWeight: number) {
  const scale = weight / maxWeight;
  const w = MIN_ARROW_W + (MAX_ARROW_W - MIN_ARROW_W) * scale;
  const h = w * 0.75;
  return { w, h };
}

function ArrowDefs({ edges, maxWeight }: { edges: GraphEdge[]; maxWeight: number }) {
  return (
    <defs>
      {edges.flatMap((edge) => {
        const { w, h } = arrowDims(edge.weight, maxWeight);
        return ARROW_STATES.map((state) => (
          <marker
            key={`${edge.id}-${state}`}
            id={`arrow-${edge.id}-${state}`}
            markerWidth={w}
            markerHeight={h}
            refX={w}
            refY={h / 2}
            orient="auto"
            markerUnits="userSpaceOnUse"
          >
            <polygon
              points={`0 0, ${w} ${h / 2}, 0 ${h}`}
              fill={ARROW_STATE_COLOR[state]}
              opacity={state === "default" ? 0.65 : 1}
            />
          </marker>
        ));
      })}
    </defs>
  );
}

// ── Compute shortened line endpoints for edges ────────────────────────────────

function shortenLine(
  x1: number, y1: number,
  x2: number, y2: number,
  r: number,
) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  return {
    x1: x1 + ux * r,
    y1: y1 + uy * r,
    x2: x2 - ux * (r + 4), // extra gap for arrowhead
    y2: y2 - uy * (r + 4),
  };
}

// ── Graph SVG rendering ───────────────────────────────────────────────────────

function GraphSVG({
  nodes,
  edges,
  step,
  directed,
  showDistances,
}: {
  nodes: GraphNode[];
  edges: GraphEdge[];
  step: GraphStep;
  directed: boolean;
  showDistances: boolean;
}) {
  const nodeById = new Map(nodes.map((n) => [n.id, n]));

  return (
    <svg
      viewBox={`0 0 ${SVG_W} ${SVG_H}`}
      className="w-full h-full"
      style={{ display: "block" }}
    >
      {(() => {
        const maxWeight = Math.max(...edges.map((e) => e.weight), 1);
        return (<>
          <ArrowDefs edges={edges} maxWeight={maxWeight} />
          {edges.map((edge) => {
          const src = nodeById.get(edge.source)!;
          const tgt = nodeById.get(edge.target)!;
          const state: EdgeState = step.edgeStates[edge.id] ?? "default";
          const stroke = EDGE_STROKE[state];
          // Proportional width: heaviest edge = 25px, all others scaled. Active states get a 20% boost.
          const baseWidth = Math.max(1, (edge.weight / maxWeight) * 25);
          const sw = state === "default" || state === "cross" ? baseWidth : baseWidth * 1.2;
          const mx = (src.x + tgt.x) / 2;
          const my = (src.y + tgt.y) / 2;

          // Shorten by NODE_R so the line endpoint sits at the node's edge;
          // refX=w places the arrowhead tip exactly at that endpoint.
          const { x1, y1, x2, y2 } = directed
            ? shortenLine(src.x, src.y, tgt.x, tgt.y, NODE_R)
            : { x1: src.x, y1: src.y, x2: tgt.x, y2: tgt.y };

          return (
            <g key={edge.id}>
              <line
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={stroke}
                strokeWidth={sw}
                strokeOpacity={state === "default" ? 0.55 : 1}
                markerEnd={directed ? `url(#arrow-${edge.id}-${state})` : undefined}
                style={{ transition: "stroke 0.2s, stroke-width 0.2s" }}
              />
            {/* Weight label */}
            <text
              x={mx}
              y={my - 6}
              textAnchor="middle"
              fontSize={10}
              fontFamily="monospace"
              fill={state !== "default" ? stroke : "var(--color-muted)"}
              style={{ pointerEvents: "none", userSelect: "none" }}
            >
              {edge.weight}
            </text>
            </g>
          );
        })}
        </>);
      })()}

      {/* Nodes */}
      {nodes.map((node) => {
        const state: NodeState = step.nodeStates[node.id] ?? "default";
        const fill = NODE_FILL[state];
        const stroke = NODE_STROKE[state];
        const textColor = NODE_TEXT[state];
        const dist = step.distances[node.id];

        return (
          <g key={node.id}>
            <circle
              cx={node.x}
              cy={node.y}
              r={NODE_R}
              fill={fill}
              stroke={stroke}
              strokeWidth={state === "default" ? 1.5 : 2.5}
              style={{ transition: "fill 0.2s, stroke 0.2s" }}
            />
            <text
              x={node.x}
              y={node.y + 1}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={13}
              fontFamily="monospace"
              fontWeight="bold"
              fill={textColor}
              style={{ pointerEvents: "none", userSelect: "none" }}
            >
              {node.id}
            </text>
            {/* Distance label below node */}
            {showDistances && (
              <text
                x={node.x}
                y={node.y + NODE_R + 12}
                textAnchor="middle"
                fontSize={9}
                fontFamily="monospace"
                fill="var(--color-muted)"
                style={{ pointerEvents: "none", userSelect: "none" }}
              >
                {dist === null ? "∞" : dist}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ── Queue/Panel displays ──────────────────────────────────────────────────────

function QueuePanel({ algorithm, step, nodes }: { algorithm: GraphAlgorithm; step: GraphStep; nodes: GraphNode[] }) {
  const meta = GRAPH_ALGO_META[algorithm];

  if (algorithm === "dijkstra") {
    // Full shortest-path table — one row per node
    const nodeIds = nodes.map((n) => n.id);
    const pqEntries = step.queue.map((s) => {
      const parts = s.split(":");
      return { id: parts[0], dist: Number(parts[1]) };
    }).sort((a, b) => a.dist - b.dist);

    return (
      <div className="flex flex-col gap-3">
        {/* Distance / predecessor table */}
        <div>
          <div className="text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: "var(--color-muted)" }}>
            Shortest-path table
          </div>
          <table className="w-full text-xs font-mono border-collapse">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--color-border)" }}>
                {["Node", "Dist", "Via", "Status"].map((h) => (
                  <th key={h} className="py-1 px-2 text-left font-semibold" style={{ color: "var(--color-muted)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {nodeIds.map((id) => {
                const dist = step.distances[id];
                const via = step.predecessor?.[id] ?? null;
                const state = step.nodeStates[id];
                const isUpdated = step.updatedNodes?.includes(id);
                const isCurrentEdgeTarget = step.currentEdge?.[1] === id;
                const isSettled = state === "visited";
                const isFrontier = state === "frontier";
                const isCurrent = state === "current";

                const rowBg = isUpdated
                  ? "rgba(78,200,120,0.10)"
                  : isCurrentEdgeTarget
                  ? "rgba(124,106,247,0.08)"
                  : "transparent";
                const rowBorder = isUpdated
                  ? "1px solid rgba(78,200,120,0.35)"
                  : isCurrentEdgeTarget
                  ? "1px solid rgba(124,106,247,0.3)"
                  : "transparent";

                const statusLabel = isCurrent ? "current" : isSettled ? "settled" : isFrontier ? "frontier" : "—";
                const statusColor = isCurrent
                  ? "var(--color-accent)"
                  : isSettled
                  ? "var(--color-state-sorted)"
                  : isFrontier
                  ? "var(--color-state-compare)"
                  : "var(--color-muted)";

                return (
                  <tr
                    key={id}
                    style={{ background: rowBg, border: rowBorder, borderRadius: 4, transition: "background 0.2s" }}
                  >
                    <td className="py-1 px-2 font-bold" style={{ color: "var(--color-accent)" }}>{id}</td>
                    <td className="py-1 px-2" style={{ color: dist === null ? "var(--color-muted)" : "var(--color-text)", fontWeight: dist !== null ? 600 : 400 }}>
                      {dist === null ? "∞" : dist}
                      {isUpdated && <span style={{ color: "var(--color-state-sorted)", marginLeft: 4 }}>↓</span>}
                    </td>
                    <td className="py-1 px-2" style={{ color: via ? "var(--color-text)" : "var(--color-muted)" }}>
                      {via ?? "—"}
                    </td>
                    <td className="py-1 px-2" style={{ color: statusColor }}>{statusLabel}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Priority queue */}
        {pqEntries.length > 0 && (
          <div>
            <div className="text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: "var(--color-muted)" }}>
              Priority Queue (min-heap order)
            </div>
            <div className="flex flex-wrap gap-1.5">
              {pqEntries.map(({ id, dist }, i) => (
                <div
                  key={`${id}-${i}`}
                  className="flex items-center gap-1 px-2 py-1 rounded font-mono text-xs"
                  style={{
                    background: i === 0 ? "var(--color-accent-muted)" : "var(--color-surface-3)",
                    border: `1px solid ${i === 0 ? "var(--color-accent)" : "var(--color-border)"}`,
                    color: i === 0 ? "var(--color-accent)" : "var(--color-text)",
                  }}
                >
                  {i === 0 && <span style={{ marginRight: 2 }}>→</span>}
                  <span style={{ fontWeight: 700 }}>{id}</span>
                  <span style={{ color: "var(--color-muted)" }}>:</span>
                  <span>{dist}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (algorithm === "bellman-ford") {
    // Distance table for Bellman-Ford (simpler — no predecessor shown)
    const entries = step.queue.map((s) => {
      const parts = s.split(":");
      return { id: parts[0], dist: parts[1] };
    });
    return (
      <div>
        <div className="text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: "var(--color-muted)" }}>
          {meta.queueLabel}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {entries.map(({ id, dist }) => (
            <div
              key={id}
              className="flex items-center gap-1 px-2 py-1 rounded font-mono text-xs"
              style={{
                background: "var(--color-surface-3)",
                border: "1px solid var(--color-border)",
                color: dist === "∞" ? "var(--color-muted)" : "var(--color-text)",
              }}
            >
              <span style={{ color: "var(--color-accent)", fontWeight: 700 }}>{id}</span>
              <span style={{ color: "var(--color-muted)" }}>:</span>
              <span>{dist}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (algorithm === "kruskal") {
    return (
      <div>
        <div
          className="text-xs font-semibold mb-1.5 uppercase tracking-wide"
          style={{ color: "var(--color-muted)" }}
        >
          {meta.queueLabel}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {step.queue.map((item, i) => {
            // Check if this edge is in MST by looking at edge states
            const edgeKey = item.replace(/\(\d+\)/, "").trim();
            const inMst = Object.entries(step.edgeStates).some(
              ([k, v]) => (k === edgeKey || k === edgeKey.split("-").reverse().join("-")) && v === "mst"
            );
            const rejected = Object.entries(step.edgeStates).some(
              ([k, v]) => (k === edgeKey || k === edgeKey.split("-").reverse().join("-")) && v === "back"
            );
            return (
              <div
                key={i}
                className="px-2 py-1 rounded font-mono text-xs"
                style={{
                  background: inMst
                    ? "rgba(78,124,82,0.15)"
                    : rejected
                    ? "rgba(176,48,32,0.12)"
                    : "var(--color-surface-3)",
                  border: `1px solid ${inMst ? "var(--color-state-sorted)" : rejected ? "var(--color-state-swap)" : "var(--color-border)"}`,
                  color: inMst
                    ? "var(--color-state-sorted)"
                    : rejected
                    ? "var(--color-state-swap)"
                    : "var(--color-muted)",
                }}
              >
                {inMst ? "✓ " : rejected ? "✗ " : ""}{item}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (algorithm === "topo") {
    return (
      <div>
        <div
          className="text-xs font-semibold mb-1.5 uppercase tracking-wide"
          style={{ color: "var(--color-muted)" }}
        >
          {meta.queueLabel}
        </div>
        <div className="flex items-center flex-wrap gap-1.5">
          {step.queue.length === 0 ? (
            <span className="text-xs font-mono" style={{ color: "var(--color-muted)" }}>
              (empty)
            </span>
          ) : (
            step.queue.map((id, i) => (
              <span key={i} className="flex items-center gap-1">
                <span
                  className="px-2.5 py-1 rounded font-mono text-xs font-bold"
                  style={{
                    background: "rgba(78,124,82,0.15)",
                    border: "1px solid var(--color-state-sorted)",
                    color: "var(--color-state-sorted)",
                  }}
                >
                  {id}
                </span>
                {i < step.queue.length - 1 && (
                  <span style={{ color: "var(--color-muted)", fontSize: 12 }}>→</span>
                )}
              </span>
            ))
          )}
        </div>
      </div>
    );
  }

  // BFS queue / DFS stack / Prim frontier
  const isBFS = algorithm === "bfs";
  const isDFS = algorithm === "dfs";
  const isPrim = algorithm === "prim";

  return (
    <div>
      <div
        className="text-xs font-semibold mb-1.5 uppercase tracking-wide"
        style={{ color: "var(--color-muted)" }}
      >
        {meta.queueLabel}
        {isBFS && <span className="ml-2 normal-case font-normal">(front → back)</span>}
        {isDFS && <span className="ml-2 normal-case font-normal">(top → bottom)</span>}
      </div>
      <div className="flex items-center gap-1.5 flex-wrap">
        {step.queue.length === 0 ? (
          <span className="text-xs font-mono" style={{ color: "var(--color-muted)" }}>
            {isBFS ? "Queue empty" : isDFS ? "Stack empty" : "No frontier edges"}
          </span>
        ) : (
          step.queue.map((item, i) => {
            // For prim, items are like "A-B:4", extract node and weight
            const parts = isPrim ? item.split(":") : [item];
            const label = parts[0];
            const weight = parts[1];
            return (
              <div
                key={i}
                className="px-2.5 py-1 rounded font-mono text-xs font-bold"
                style={{
                  background: i === 0
                    ? "var(--color-accent)"
                    : "var(--color-surface-3)",
                  border: `1px solid ${i === 0 ? "var(--color-accent)" : "var(--color-border)"}`,
                  color: i === 0 ? "#fff" : "var(--color-text)",
                }}
              >
                {label}
                {weight && (
                  <span style={{ fontWeight: 400, opacity: 0.8, marginLeft: 2 }}>
                    :{weight}
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ── Legend ────────────────────────────────────────────────────────────────────

function Legend({ algorithm }: { algorithm: GraphAlgorithm }) {
  const isMST = algorithm === "prim" || algorithm === "kruskal";
  const isShortestPath = algorithm === "dijkstra" || algorithm === "bellman-ford";

  const entries: { label: string; color: string; kind?: "edge" }[] = [
    { label: "Unvisited", color: "var(--color-surface-2)" },
    { label: "Current", color: "var(--color-accent)" },
    ...(algorithm === "topo"
      ? []
      : [{ label: algorithm === "bfs" ? "In Queue" : "Frontier", color: "var(--color-state-compare)" }]),
    { label: isMST ? "In MST" : "Visited", color: "var(--color-state-sorted)" },
    ...(isMST ? [{ label: "MST Edge", color: "var(--color-state-sorted)", kind: "edge" as const }] : []),
    ...(isShortestPath ? [{ label: "Relaxed Edge", color: "var(--color-state-compare)", kind: "edge" as const }] : []),
    ...(!isMST && !isShortestPath
      ? [{ label: "Tree Edge", color: "var(--color-accent)", kind: "edge" as const }]
      : []),
  ];

  return (
    <div className="flex flex-wrap gap-3">
      {entries.map(({ label, color, kind }) => (
        <div key={label} className="flex items-center gap-1.5">
          {kind === "edge" ? (
            <div
              style={{
                width: 18,
                height: 3,
                background: color,
                borderRadius: 2,
              }}
            />
          ) : (
            <div
              style={{
                width: 12,
                height: 12,
                borderRadius: "50%",
                background: color,
                border: `1px solid var(--color-border)`,
              }}
            />
          )}
          <span className="text-xs" style={{ color: "var(--color-muted)" }}>
            {label}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Badge ─────────────────────────────────────────────────────────────────────

function Badge({ text, accent }: { text: string; accent?: boolean }) {
  return (
    <span
      className="text-xs font-mono px-2 py-0.5 rounded-full"
      style={{
        background: accent ? "rgba(139,58,42,0.12)" : "var(--color-surface-3)",
        color: accent ? "var(--color-accent)" : "var(--color-muted)",
        border: `1px solid ${accent ? "var(--color-accent)" : "var(--color-border)"}`,
      }}
    >
      {text}
    </span>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function GraphAlgoVisualizer({ algorithm }: Props) {
  const meta = GRAPH_ALGO_META[algorithm];
  const directed = meta.directed;
  const showDistances = algorithm === "dijkstra" || algorithm === "bellman-ford";
  const canPickSource = SOURCE_CAPABLE.includes(algorithm);

  const [customNodes, setCustomNodes] = useState<GraphNode[] | null>(null);
  const [customEdges, setCustomEdges] = useState<GraphEdge[] | null>(null);
  const [sourceNode, setSourceNode] = useState("A");
  const [steps, setSteps] = useState<GraphStep[]>([]);
  const [stepIdx, setStepIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(400);

  const nodes = customNodes ?? (directed ? DIRECTED_NODES : UNDIRECTED_NODES);
  const edges = customEdges ?? (directed ? DIRECTED_EDGES : UNDIRECTED_EDGES);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reset = useCallback(() => {
    setIsPlaying(false);
    const activeNodes = customNodes ?? (directed ? DIRECTED_NODES : UNDIRECTED_NODES);
    const activeEdges = customEdges ?? (directed ? DIRECTED_EDGES : UNDIRECTED_EDGES);
    const s = getGraphSteps(algorithm, sourceNode, activeNodes, activeEdges);
    setSteps(s);
    setStepIdx(0);
  }, [algorithm, sourceNode, customNodes, customEdges, directed]);

  const randomizeGraph = useCallback(() => {
    const { nodes: newNodes, edges: newEdges } = generateRandomGraph(directed);
    setCustomNodes(newNodes);
    setCustomEdges(newEdges);
    setIsPlaying(false);
    setStepIdx(0);
    setSourceNode(newNodes[0].id);
  }, [directed]);

  const resetGraph = useCallback(() => {
    setCustomNodes(null);
    setCustomEdges(null);
    setIsPlaying(false);
    setStepIdx(0);
    setSourceNode("A");
  }, []);

  useEffect(() => {
    reset();
  }, [reset]);

  // Playback
  useEffect(() => {
    if (!isPlaying) return;
    timerRef.current = setTimeout(() => {
      setStepIdx((prev) => {
        if (prev >= steps.length - 1) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, speed);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isPlaying, stepIdx, steps.length, speed]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      )
        return;
      if (e.key === " ") {
        e.preventDefault();
        setIsPlaying((p) => {
          if (!p && stepIdx >= steps.length - 1) return p;
          return !p;
        });
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        setIsPlaying(false);
        setStepIdx((p) => Math.min(p + 1, steps.length - 1));
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        setIsPlaying(false);
        setStepIdx((p) => Math.max(p - 1, 0));
      } else if (e.key === "r" || e.key === "R") {
        reset();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isPlaying, stepIdx, steps.length, reset]);

  const step = steps[stepIdx];
  if (!step) return null;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── Header ── */}
      <div
        className="flex flex-col gap-1 px-5 pt-6 pb-4"
        style={{ borderBottom: "1px solid var(--color-border)" }}
      >
        <div className="flex flex-wrap items-center gap-2">
          <Network
            size={20}
            style={{ color: "var(--color-accent)", flexShrink: 0 }}
            strokeWidth={1.75}
          />
          <h1 className="text-2xl font-bold">{meta.name}</h1>
          <Badge text={meta.time} accent />
          <Badge text={`Space: ${meta.space}`} />
          <Badge text={directed ? "Directed" : "Undirected"} />
        </div>
        <p className="text-sm max-w-xl mt-0.5" style={{ color: "var(--color-muted)" }}>
          {meta.description}
        </p>
      </div>

      {/* ── Body ── */}
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
        <div className="flex-1 flex flex-col px-5 pt-4 pb-4 gap-4 overflow-hidden min-h-0">

          {/* Stats row */}
          <div className="flex flex-wrap gap-6">
            <Stat label="Step" value={`${stepIdx + 1} / ${steps.length}`} />
            <Stat
              label="Comparisons"
              value={step.comparisons}
              color="var(--color-state-compare)"
            />
            <div className="flex items-center gap-2 ml-auto flex-wrap">
              {canPickSource && (
                <>
                  <label
                    className="text-xs"
                    style={{ color: "var(--color-muted)" }}
                    htmlFor="source-select"
                  >
                    Source node:
                  </label>
                  <select
                    id="source-select"
                    value={sourceNode}
                    onChange={(e) => {
                      setSourceNode(e.target.value);
                    }}
                    className="text-xs font-mono rounded px-2 py-1"
                    style={{
                      background: "var(--color-surface-3)",
                      border: "1px solid var(--color-border)",
                      color: "var(--color-text)",
                      cursor: "pointer",
                    }}
                  >
                    {nodes.map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.id}
                      </option>
                    ))}
                  </select>
                </>
              )}
              <button
                onClick={randomizeGraph}
                className="text-xs font-mono rounded px-2 py-1"
                style={{
                  background: "var(--color-surface-3)",
                  border: "1px solid var(--color-border)",
                  color: "var(--color-text)",
                  cursor: "pointer",
                }}
              >
                Randomize Graph
              </button>
              {(customNodes !== null) && (
                <button
                  onClick={resetGraph}
                  className="text-xs font-mono rounded px-2 py-1"
                  style={{
                    background: "var(--color-surface-3)",
                    border: "1px solid var(--color-border)",
                    color: "var(--color-muted)",
                    cursor: "pointer",
                  }}
                >
                  Reset Graph
                </button>
              )}
            </div>
          </div>

          {/* Main layout: graph left, controls right */}
          <div className="flex flex-1 gap-4 min-h-0">
            {/* Graph */}
            <div
              className="rounded-xl flex-1 min-h-0 overflow-hidden flex items-center justify-center"
              style={{
                background: "var(--color-surface-2)",
                border: "1px solid var(--color-border)",
                minWidth: 0,
              }}
            >
              <div className="w-full h-full p-3">
                <GraphSVG
                  nodes={nodes}
                  edges={edges}
                  step={step}
                  directed={directed}
                  showDistances={showDistances}
                />
              </div>
            </div>

            {/* Right column */}
            <div className="flex flex-col gap-4 w-80 shrink-0">
              <Legend algorithm={algorithm} />

              <PlaybackControls
                stepCount={steps.length}
                stepIdx={stepIdx}
                setStepIdx={setStepIdx}
                isPlaying={isPlaying}
                setIsPlaying={setIsPlaying}
                speed={speed}
                setSpeed={setSpeed}
                onReset={reset}
              />

              {/* Queue / stack / priority queue panel */}
              <div
                className="rounded-lg px-4 py-3"
                style={{
                  background: "var(--color-surface-2)",
                  border: "1px solid var(--color-border)",
                }}
              >
                <QueuePanel algorithm={algorithm} step={step} nodes={nodes} />
              </div>

              {/* Step description */}
              <div
                className="rounded-lg px-4 py-3 text-sm flex-1 mt-auto"
                style={{
                  background: "var(--color-surface-2)",
                  border: "1px solid var(--color-border)",
                  color: "var(--color-muted)",
                  minHeight: "3rem",
                }}
              >
                {step.description}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Stat({
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
      <div className="text-xs mb-0.5" style={{ color: "var(--color-muted)" }}>
        {label}
      </div>
      <div
        className="text-xl font-mono font-bold"
        style={{ color: color ?? "var(--color-text)" }}
      >
        {value}
      </div>
    </div>
  );
}
