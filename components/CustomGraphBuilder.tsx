"use client";

import { useState, useRef, useCallback } from "react";
import type { GraphNode, GraphEdge } from "@/lib/graph-algorithms";

type Tool = "addNode" | "addEdge" | "delete" | "select";

type Props = {
  nodes: GraphNode[];
  edges: GraphEdge[];
  directed: boolean;
  onApply: (nodes: GraphNode[], edges: GraphEdge[]) => void;
  onClose: () => void;
};

const CANVAS_W = 600;
const CANVAS_H = 420;
const NODE_R = 20;
const NODE_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

function nextId(existing: GraphNode[]): string {
  const used = new Set(existing.map((n) => n.id));
  for (const ch of NODE_LETTERS) {
    if (!used.has(ch)) return ch;
  }
  // fallback: two letters
  for (const a of NODE_LETTERS) {
    for (const b of NODE_LETTERS) {
      const id = a + b;
      if (!used.has(id)) return id;
    }
  }
  return String(existing.length);
}

function edgeId(source: string, target: string) {
  return `${source}-${target}`;
}

function hitTestNode(nodes: GraphNode[], x: number, y: number): GraphNode | null {
  for (const n of nodes) {
    const dx = n.x - x;
    const dy = n.y - y;
    if (Math.sqrt(dx * dx + dy * dy) <= NODE_R) return n;
  }
  return null;
}

function hitTestEdge(
  nodes: GraphNode[],
  edges: GraphEdge[],
  x: number,
  y: number,
): GraphEdge | null {
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  for (const edge of edges) {
    const src = nodeById.get(edge.source);
    const tgt = nodeById.get(edge.target);
    if (!src || !tgt) continue;
    // distance from point to line segment
    const dx = tgt.x - src.x;
    const dy = tgt.y - src.y;
    const len2 = dx * dx + dy * dy;
    if (len2 === 0) continue;
    const t = Math.max(0, Math.min(1, ((x - src.x) * dx + (y - src.y) * dy) / len2));
    const px = src.x + t * dx - x;
    const py = src.y + t * dy - y;
    if (Math.sqrt(px * px + py * py) < 8) return edge;
  }
  return null;
}

export default function CustomGraphBuilder({ nodes: initNodes, edges: initEdges, directed: initDirected, onApply, onClose }: Props) {
  const [nodes, setNodes] = useState<GraphNode[]>(initNodes.map((n) => ({ ...n })));
  const [edges, setEdges] = useState<GraphEdge[]>(initEdges.map((e) => ({ ...e })));
  const [directed, setDirected] = useState(initDirected);
  const [tool, setTool] = useState<Tool>("select");
  const [edgeStart, setEdgeStart] = useState<string | null>(null);
  const [dragging, setDragging] = useState<{ id: string; ox: number; oy: number } | null>(null);
  const [editingEdge, setEditingEdge] = useState<string | null>(null);
  const [editingWeight, setEditingWeight] = useState("");
  const svgRef = useRef<SVGSVGElement>(null);

  function getSVGCoords(e: React.MouseEvent): { x: number; y: number } {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    const scaleX = CANVAS_W / rect.width;
    const scaleY = CANVAS_H / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }

  const handleSVGClick = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (dragging) return;
    const { x, y } = getSVGCoords(e);

    if (tool === "addNode") {
      // Check not on existing node
      if (hitTestNode(nodes, x, y)) return;
      const id = nextId(nodes);
      setNodes((prev) => [...prev, { id, x, y }]);
      return;
    }

    if (tool === "addEdge") {
      const hit = hitTestNode(nodes, x, y);
      if (!hit) {
        setEdgeStart(null);
        return;
      }
      if (!edgeStart) {
        setEdgeStart(hit.id);
        return;
      }
      if (edgeStart === hit.id) {
        setEdgeStart(null);
        return;
      }
      // Add edge if not already there
      const id = edgeId(edgeStart, hit.id);
      const reverseId = edgeId(hit.id, edgeStart);
      const exists = edges.some((edge) => edge.id === id || (!directed && edge.id === reverseId));
      if (!exists) {
        setEdges((prev) => [
          ...prev,
          { id, source: edgeStart, target: hit.id, weight: 1 },
        ]);
      }
      setEdgeStart(null);
      return;
    }

    if (tool === "delete") {
      const hitNode = hitTestNode(nodes, x, y);
      if (hitNode) {
        setNodes((prev) => prev.filter((n) => n.id !== hitNode.id));
        setEdges((prev) =>
          prev.filter((edge) => edge.source !== hitNode.id && edge.target !== hitNode.id)
        );
        return;
      }
      const hitEdge = hitTestEdge(nodes, edges, x, y);
      if (hitEdge) {
        setEdges((prev) => prev.filter((edge) => edge.id !== hitEdge.id));
        return;
      }
      return;
    }

    // select tool: click edge to edit weight
    if (tool === "select") {
      const hitEdge = hitTestEdge(nodes, edges, x, y);
      if (hitEdge) {
        setEditingEdge(hitEdge.id);
        setEditingWeight(String(hitEdge.weight));
        return;
      }
      setEditingEdge(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tool, nodes, edges, edgeStart, directed, dragging]);

  const handleSVGRightClick = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    e.preventDefault();
    const { x, y } = getSVGCoords(e);
    const hitNode = hitTestNode(nodes, x, y);
    if (hitNode) {
      setNodes((prev) => prev.filter((n) => n.id !== hitNode.id));
      setEdges((prev) =>
        prev.filter((edge) => edge.source !== hitNode.id && edge.target !== hitNode.id)
      );
      return;
    }
    const hitEdge = hitTestEdge(nodes, edges, x, y);
    if (hitEdge) {
      setEdges((prev) => prev.filter((edge) => edge.id !== hitEdge.id));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges]);

  const handleMouseDown = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (tool !== "select") return;
    const { x, y } = getSVGCoords(e);
    const hit = hitTestNode(nodes, x, y);
    if (hit) {
      setDragging({ id: hit.id, ox: x - hit.x, oy: y - hit.y });
      e.preventDefault();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tool, nodes]);

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!dragging) return;
    const { x, y } = getSVGCoords(e);
    setNodes((prev) =>
      prev.map((n) =>
        n.id === dragging.id
          ? {
              ...n,
              x: Math.max(NODE_R, Math.min(CANVAS_W - NODE_R, x - dragging.ox)),
              y: Math.max(NODE_R, Math.min(CANVAS_H - NODE_R, y - dragging.oy)),
            }
          : n
      )
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragging]);

  const handleMouseUp = useCallback(() => {
    setDragging(null);
  }, []);

  function commitEdgeWeight() {
    const w = Number(editingWeight);
    if (!isNaN(w) && w > 0 && editingEdge) {
      setEdges((prev) =>
        prev.map((edge) => (edge.id === editingEdge ? { ...edge, weight: w } : edge))
      );
    }
    setEditingEdge(null);
    setEditingWeight("");
  }

  const nodeById = new Map(nodes.map((n) => [n.id, n]));

  const toolBtn = (t: Tool, label: string, title?: string) => (
    <button
      onClick={() => { setTool(t); setEdgeStart(null); setEditingEdge(null); }}
      title={title}
      className="text-xs font-mono rounded px-2 py-1 transition-colors"
      style={{
        background: tool === t ? "var(--color-accent)" : "var(--color-surface-3)",
        border: "1px solid var(--color-border)",
        color: tool === t ? "#fff" : "var(--color-muted)",
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "rgba(0,0,0,0.65)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          background: "var(--color-surface-1)",
          border: "1px solid var(--color-border)",
          borderRadius: 12,
          padding: 20,
          width: 660,
          maxWidth: "95vw",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Title */}
        <div className="flex items-center justify-between">
          <span className="text-base font-bold" style={{ color: "var(--color-text)" }}>
            Edit Graph
          </span>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: "var(--color-muted)",
              fontSize: 18,
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap gap-2 items-center">
          {toolBtn("select", "Select / Drag", "Click edges to edit weight, drag nodes")}
          {toolBtn("addNode", "+ Node", "Click empty space to add node")}
          {toolBtn("addEdge", "+ Edge", "Click two nodes to add edge")}
          {toolBtn("delete", "Delete", "Click node or edge to delete")}
          <span style={{ flex: 1 }} />
          <button
            onClick={() => setDirected((d) => !d)}
            className="text-xs font-mono rounded px-2 py-1 transition-colors"
            style={{
              background: directed ? "rgba(124,106,247,0.15)" : "var(--color-surface-3)",
              border: `1px solid ${directed ? "var(--color-accent)" : "var(--color-border)"}`,
              color: directed ? "var(--color-accent)" : "var(--color-muted)",
              cursor: "pointer",
            }}
          >
            {directed ? "Directed" : "Undirected"}
          </button>
        </div>

        {edgeStart && (
          <div className="text-xs" style={{ color: "var(--color-accent)", fontFamily: "monospace" }}>
            Edge from <strong>{edgeStart}</strong> — now click the target node
          </div>
        )}

        {/* Edge weight editor */}
        {editingEdge && (
          <div className="flex items-center gap-2">
            <span className="text-xs" style={{ color: "var(--color-muted)" }}>
              Edge <strong style={{ color: "var(--color-text)" }}>{editingEdge}</strong> weight:
            </span>
            <input
              autoFocus
              type="number"
              min={1}
              value={editingWeight}
              onChange={(e) => setEditingWeight(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") commitEdgeWeight(); else if (e.key === "Escape") { setEditingEdge(null); } }}
              onBlur={commitEdgeWeight}
              style={{
                width: 64,
                fontSize: 12,
                background: "var(--color-surface-2)",
                border: "1px solid var(--color-accent)",
                borderRadius: 4,
                padding: "2px 6px",
                color: "var(--color-text)",
                outline: "none",
                fontFamily: "monospace",
              }}
            />
          </div>
        )}

        {/* SVG Canvas */}
        <svg
          ref={svgRef}
          viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
          style={{
            width: "100%",
            height: CANVAS_H,
            background: "var(--color-surface-2)",
            borderRadius: 8,
            border: "1px solid var(--color-border)",
            cursor:
              tool === "addNode"
                ? "crosshair"
                : tool === "delete"
                ? "pointer"
                : tool === "addEdge"
                ? "cell"
                : dragging
                ? "grabbing"
                : "grab",
            display: "block",
          }}
          onClick={handleSVGClick}
          onContextMenu={handleSVGRightClick}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <defs>
            <marker
              id="cb-arrow"
              markerWidth={10}
              markerHeight={7}
              refX={10}
              refY={3.5}
              orient="auto"
              markerUnits="userSpaceOnUse"
            >
              <polygon
                points="0 0, 10 3.5, 0 7"
                fill="var(--color-border)"
              />
            </marker>
            <marker
              id="cb-arrow-sel"
              markerWidth={10}
              markerHeight={7}
              refX={10}
              refY={3.5}
              orient="auto"
              markerUnits="userSpaceOnUse"
            >
              <polygon
                points="0 0, 10 3.5, 0 7"
                fill="var(--color-accent)"
              />
            </marker>
          </defs>

          {/* Edges */}
          {edges.map((edge) => {
            const src = nodeById.get(edge.source);
            const tgt = nodeById.get(edge.target);
            if (!src || !tgt) return null;
            const isSelected = editingEdge === edge.id;
            const stroke = isSelected ? "var(--color-accent)" : "var(--color-border)";

            // shorten for directed arrows
            let x1 = src.x, y1 = src.y, x2 = tgt.x, y2 = tgt.y;
            if (directed) {
              const dx = x2 - x1, dy = y2 - y1;
              const len = Math.sqrt(dx * dx + dy * dy) || 1;
              x1 += (dx / len) * NODE_R;
              y1 += (dy / len) * NODE_R;
              x2 -= (dx / len) * (NODE_R + 10);
              y2 -= (dy / len) * (NODE_R + 10);
            }

            const mx = (src.x + tgt.x) / 2;
            const my = (src.y + tgt.y) / 2;

            return (
              <g key={edge.id}>
                <line
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke={stroke}
                  strokeWidth={isSelected ? 2.5 : 1.5}
                  strokeOpacity={0.75}
                  markerEnd={directed ? `url(#cb-arrow${isSelected ? "-sel" : ""})` : undefined}
                />
                <text
                  x={mx}
                  y={my - 6}
                  textAnchor="middle"
                  fontSize={10}
                  fontFamily="monospace"
                  fill={isSelected ? "var(--color-accent)" : "var(--color-muted)"}
                  style={{ pointerEvents: "none", userSelect: "none" }}
                >
                  {edge.weight}
                </text>
              </g>
            );
          })}

          {/* Edge-start highlight */}
          {edgeStart && (() => {
            const n = nodeById.get(edgeStart);
            if (!n) return null;
            return (
              <circle
                cx={n.x}
                cy={n.y}
                r={NODE_R + 4}
                fill="none"
                stroke="var(--color-accent)"
                strokeWidth={2}
                strokeDasharray="4 2"
              />
            );
          })()}

          {/* Nodes */}
          {nodes.map((node) => (
            <g key={node.id}>
              <circle
                cx={node.x}
                cy={node.y}
                r={NODE_R}
                fill="var(--color-surface-1)"
                stroke={edgeStart === node.id ? "var(--color-accent)" : "var(--color-border)"}
                strokeWidth={edgeStart === node.id ? 2.5 : 1.5}
                style={{ cursor: tool === "select" ? "grab" : undefined }}
              />
              <text
                x={node.x}
                y={node.y + 1}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={13}
                fontFamily="monospace"
                fontWeight="bold"
                fill="var(--color-text)"
                style={{ pointerEvents: "none", userSelect: "none" }}
              >
                {node.id}
              </text>
            </g>
          ))}
        </svg>

        <div className="text-xs" style={{ color: "var(--color-muted)" }}>
          Right-click any node or edge to delete. {nodes.length} nodes, {edges.length} edges.
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="text-xs font-mono rounded px-3 py-1.5"
            style={{
              background: "var(--color-surface-3)",
              border: "1px solid var(--color-border)",
              color: "var(--color-muted)",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => onApply(nodes, edges)}
            className="text-xs font-mono rounded px-3 py-1.5 font-semibold"
            style={{
              background: "var(--color-accent)",
              border: "1px solid var(--color-accent)",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
