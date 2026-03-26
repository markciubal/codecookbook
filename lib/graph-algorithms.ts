// ── Types ─────────────────────────────────────────────────────────────────────

export type GraphAlgorithm =
  | "bfs"
  | "dfs"
  | "dijkstra"
  | "bellman-ford"
  | "prim"
  | "kruskal"
  | "topo";

export type NodeState = "default" | "current" | "frontier" | "visited" | "inMST";
export type EdgeState = "default" | "tree" | "back" | "cross" | "mst" | "relaxed";

export type GraphStep = {
  nodeStates: Record<string, NodeState>;
  edgeStates: Record<string, EdgeState>;  // key: "A-B"
  distances: Record<string, number | null>;  // null = infinity
  predecessor?: Record<string, string | null>; // which node we came from (Dijkstra only)
  updatedNodes?: string[];  // nodes whose distance was just updated this step (Dijkstra only)
  currentEdge?: [string, string]; // edge being relaxed this step (Dijkstra only)
  queue: string[];        // current queue/stack/priority queue contents
  description: string;
  comparisons: number;
};

// ── Graph data ─────────────────────────────────────────────────────────────────

export type GraphNode = { id: string; x: number; y: number };
export type GraphEdge = { id: string; source: string; target: string; weight: number };

// Undirected graph (BFS, DFS, Prim, Kruskal)
export const UNDIRECTED_NODES: GraphNode[] = [
  { id: "A", x: 80,  y: 200 },
  { id: "B", x: 200, y: 80  },
  { id: "C", x: 200, y: 320 },
  { id: "D", x: 350, y: 80  },
  { id: "E", x: 350, y: 200 },
  { id: "F", x: 350, y: 320 },
  { id: "G", x: 480, y: 80  },
  { id: "H", x: 480, y: 280 },
];

export const UNDIRECTED_EDGES: GraphEdge[] = [
  { id: "A-B", source: "A", target: "B", weight: 4 },
  { id: "A-C", source: "A", target: "C", weight: 2 },
  { id: "B-D", source: "B", target: "D", weight: 5 },
  { id: "B-E", source: "B", target: "E", weight: 3 },
  { id: "C-E", source: "C", target: "E", weight: 6 },
  { id: "C-F", source: "C", target: "F", weight: 7 },
  { id: "D-G", source: "D", target: "G", weight: 1 },
  { id: "E-G", source: "E", target: "G", weight: 8 },
  { id: "E-H", source: "E", target: "H", weight: 2 },
  { id: "F-H", source: "F", target: "H", weight: 4 },
  { id: "G-H", source: "G", target: "H", weight: 9 },
];

// Directed graph (Dijkstra, Bellman-Ford, Topo Sort)
export const DIRECTED_NODES: GraphNode[] = [
  { id: "A", x: 80,  y: 200 },
  { id: "B", x: 200, y: 80  },
  { id: "C", x: 200, y: 320 },
  { id: "D", x: 350, y: 80  },
  { id: "E", x: 350, y: 200 },
  { id: "F", x: 350, y: 320 },
  { id: "G", x: 480, y: 80  },
  { id: "H", x: 480, y: 280 },
];

// Directed weighted edges — also forms a DAG for topo sort
export const DIRECTED_EDGES: GraphEdge[] = [
  { id: "A-B", source: "A", target: "B", weight: 4 },
  { id: "A-C", source: "A", target: "C", weight: 2 },
  { id: "B-D", source: "B", target: "D", weight: 5 },
  { id: "B-E", source: "B", target: "E", weight: 3 },
  { id: "C-E", source: "C", target: "E", weight: 6 },
  { id: "C-F", source: "C", target: "F", weight: 7 },
  { id: "D-G", source: "D", target: "G", weight: 1 },
  { id: "E-G", source: "E", target: "G", weight: 8 },
  { id: "E-H", source: "E", target: "H", weight: 2 },
  { id: "F-H", source: "F", target: "H", weight: 4 },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function edgeKey(a: string, b: string, directed: boolean): string {
  return directed ? `${a}-${b}` : [a, b].sort().join("-");
}

function getAdjacency(
  nodes: GraphNode[],
  edges: GraphEdge[],
  directed: boolean,
): Map<string, { neighbor: string; weight: number; edgeId: string }[]> {
  const adj = new Map<string, { neighbor: string; weight: number; edgeId: string }[]>();
  for (const n of nodes) adj.set(n.id, []);
  for (const e of edges) {
    adj.get(e.source)!.push({ neighbor: e.target, weight: e.weight, edgeId: e.id });
    if (!directed) {
      adj.get(e.target)!.push({ neighbor: e.source, weight: e.weight, edgeId: e.id });
    }
  }
  return adj;
}

function defaultNodeStates(nodes: GraphNode[]): Record<string, NodeState> {
  const s: Record<string, NodeState> = {};
  for (const n of nodes) s[n.id] = "default";
  return s;
}

function defaultEdgeStates(edges: GraphEdge[]): Record<string, EdgeState> {
  const s: Record<string, EdgeState> = {};
  for (const e of edges) s[e.id] = "default";
  return s;
}

function defaultDistances(
  nodes: GraphNode[],
): Record<string, number | null> {
  const d: Record<string, number | null> = {};
  for (const n of nodes) d[n.id] = null;
  return d;
}

function cloneNodeStates(s: Record<string, NodeState>): Record<string, NodeState> {
  return { ...s };
}
function cloneEdgeStates(s: Record<string, EdgeState>): Record<string, EdgeState> {
  return { ...s };
}
function cloneDists(s: Record<string, number | null>): Record<string, number | null> {
  return { ...s };
}

// ── Random graph generator ─────────────────────────────────────────────────

export function generateRandomGraph(
  directed: boolean,
  nodeCount: number = 8,
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const ids = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".slice(0, nodeCount).split("");

  // Circular layout with slight jitter (seeded by nodeCount so it's deterministic enough)
  const cx = 300, cy = 200, rx = 220, ry = 160;
  const nodes: GraphNode[] = ids.map((id, i) => {
    const angle = (2 * Math.PI * i) / nodeCount;
    // Small fixed jitter per index to give a less perfect circle
    const jx = (i % 3 === 1 ? 18 : i % 3 === 2 ? -14 : 0);
    const jy = (i % 4 === 1 ? -12 : i % 4 === 3 ? 16 : 0);
    return {
      id,
      x: Math.round(cx + rx * Math.cos(angle) + jx),
      y: Math.round(cy + ry * Math.sin(angle) + jy),
    };
  });

  const edges: GraphEdge[] = [];
  const edgeSet = new Set<string>();

  function randWeight() {
    return Math.floor(Math.random() * 12) + 1;
  }

  function addEdge(src: string, tgt: string): void {
    const key = directed ? `${src}-${tgt}` : [src, tgt].sort().join("-");
    if (edgeSet.has(key) || src === tgt) return;
    edgeSet.add(key);
    edges.push({ id: key, source: src, target: tgt, weight: randWeight() });
  }

  if (!directed) {
    // Build a random spanning tree to guarantee connectivity
    const shuffled = [...ids].sort(() => Math.random() - 0.5);
    for (let i = 1; i < shuffled.length; i++) {
      addEdge(shuffled[i - 1], shuffled[i]);
    }
    // Add 4–6 extra random edges
    const extraCount = 4 + Math.floor(Math.random() * 3);
    let attempts = 0;
    while (edges.length < nodeCount - 1 + extraCount && attempts < 100) {
      attempts++;
      const a = ids[Math.floor(Math.random() * ids.length)];
      const b = ids[Math.floor(Math.random() * ids.length)];
      addEdge(a, b);
    }
  } else {
    // DAG: only add edges from lower index to higher index (ensures no cycles)
    // First connect each node to the next to guarantee reachability from node 0
    for (let i = 0; i < nodeCount - 1; i++) {
      addEdge(ids[i], ids[i + 1]);
    }
    // Add extra DAG edges
    const extraCount = 4 + Math.floor(Math.random() * 3);
    let attempts = 0;
    while (edges.length < nodeCount - 1 + extraCount && attempts < 100) {
      attempts++;
      const si = Math.floor(Math.random() * (nodeCount - 1));
      const ti = si + 1 + Math.floor(Math.random() * (nodeCount - 1 - si));
      addEdge(ids[si], ids[ti]);
    }
  }

  return { nodes, edges };
}

// ── BFS ──────────────────────────────────────────────────────────────────────

export function bfsSteps(
  startId: string,
  nodes?: GraphNode[],
  edges?: GraphEdge[],
): GraphStep[] {
  const _nodes = nodes ?? UNDIRECTED_NODES;
  const _edges = edges ?? UNDIRECTED_EDGES;
  const adj = getAdjacency(_nodes, _edges, false);

  const steps: GraphStep[] = [];
  let comparisons = 0;

  const nodeStates = defaultNodeStates(_nodes);
  const edgeStates = defaultEdgeStates(_edges);

  // Initial step
  steps.push({
    nodeStates: cloneNodeStates(nodeStates),
    edgeStates: cloneEdgeStates(edgeStates),
    distances: defaultDistances(_nodes),
    queue: [],
    description: `Starting BFS from node ${startId}. All nodes unvisited.`,
    comparisons,
  });

  const visited = new Set<string>();
  const queue: string[] = [startId];
  visited.add(startId);
  nodeStates[startId] = "frontier";

  steps.push({
    nodeStates: cloneNodeStates(nodeStates),
    edgeStates: cloneEdgeStates(edgeStates),
    distances: defaultDistances(_nodes),
    queue: [...queue],
    description: `Enqueue ${startId}. Queue: [${startId}]`,
    comparisons,
  });

  while (queue.length > 0) {
    const current = queue.shift()!;
    nodeStates[current] = "current";

    steps.push({
      nodeStates: cloneNodeStates(nodeStates),
      edgeStates: cloneEdgeStates(edgeStates),
      distances: defaultDistances(_nodes),
      queue: [...queue],
      description: `Dequeuing ${current}. Exploring its neighbors.`,
      comparisons,
    });

    const neighbors = adj.get(current) ?? [];
    const newNeighbors: string[] = [];

    for (const { neighbor, edgeId } of neighbors) {
      comparisons++;
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push(neighbor);
        nodeStates[neighbor] = "frontier";
        edgeStates[edgeId] = "tree";
        newNeighbors.push(neighbor);
      } else {
        if (edgeStates[edgeId] === "default") edgeStates[edgeId] = "cross";
      }
    }

    nodeStates[current] = "visited";

    steps.push({
      nodeStates: cloneNodeStates(nodeStates),
      edgeStates: cloneEdgeStates(edgeStates),
      distances: defaultDistances(_nodes),
      queue: [...queue],
      description:
        newNeighbors.length > 0
          ? `Visited ${current}. Added neighbors ${newNeighbors.join(", ")} to queue. Queue: [${queue.join(", ")}]`
          : `Visited ${current}. No new neighbors. Queue: [${queue.join(", ") || "empty"}]`,
      comparisons,
    });
  }

  steps.push({
    nodeStates: cloneNodeStates(nodeStates),
    edgeStates: cloneEdgeStates(edgeStates),
    distances: defaultDistances(_nodes),
    queue: [],
    description: "BFS complete. All reachable nodes visited.",
    comparisons,
  });

  return steps;
}

// ── DFS ──────────────────────────────────────────────────────────────────────

export function dfsSteps(
  startId: string,
  nodes?: GraphNode[],
  edges?: GraphEdge[],
): GraphStep[] {
  const _nodes = nodes ?? UNDIRECTED_NODES;
  const _edges = edges ?? UNDIRECTED_EDGES;
  const adj = getAdjacency(_nodes, _edges, false);

  const steps: GraphStep[] = [];
  let comparisons = 0;

  const nodeStates = defaultNodeStates(_nodes);
  const edgeStates = defaultEdgeStates(_edges);

  steps.push({
    nodeStates: cloneNodeStates(nodeStates),
    edgeStates: cloneEdgeStates(edgeStates),
    distances: defaultDistances(_nodes),
    queue: [],
    description: `Starting DFS from node ${startId}. All nodes unvisited.`,
    comparisons,
  });

  const visited = new Set<string>();
  const stack: string[] = [startId];
  nodeStates[startId] = "frontier";

  steps.push({
    nodeStates: cloneNodeStates(nodeStates),
    edgeStates: cloneEdgeStates(edgeStates),
    distances: defaultDistances(_nodes),
    queue: [...stack],
    description: `Push ${startId} onto stack. Stack: [${startId}]`,
    comparisons,
  });

  while (stack.length > 0) {
    const current = stack.pop()!;

    if (visited.has(current)) {
      steps.push({
        nodeStates: cloneNodeStates(nodeStates),
        edgeStates: cloneEdgeStates(edgeStates),
        distances: defaultDistances(_nodes),
        queue: [...stack],
        description: `Pop ${current} — already visited. Skip. Stack: [${stack.join(", ") || "empty"}]`,
        comparisons,
      });
      continue;
    }

    visited.add(current);
    nodeStates[current] = "current";

    steps.push({
      nodeStates: cloneNodeStates(nodeStates),
      edgeStates: cloneEdgeStates(edgeStates),
      distances: defaultDistances(_nodes),
      queue: [...stack],
      description: `Pop ${current} from stack. Mark as current.`,
      comparisons,
    });

    const neighbors = (adj.get(current) ?? []).slice().reverse();
    const pushed: string[] = [];

    for (const { neighbor, edgeId } of neighbors) {
      comparisons++;
      if (!visited.has(neighbor)) {
        stack.push(neighbor);
        nodeStates[neighbor] = "frontier";
        edgeStates[edgeId] = "tree";
        pushed.push(neighbor);
      } else {
        if (edgeStates[edgeId] === "default") edgeStates[edgeId] = "back";
      }
    }

    nodeStates[current] = "visited";

    steps.push({
      nodeStates: cloneNodeStates(nodeStates),
      edgeStates: cloneEdgeStates(edgeStates),
      distances: defaultDistances(_nodes),
      queue: [...stack],
      description:
        pushed.length > 0
          ? `Visited ${current}. Pushed neighbors ${pushed.join(", ")}. Stack: [${stack.join(", ")}]`
          : `Visited ${current}. No unvisited neighbors. Stack: [${stack.join(", ") || "empty"}]`,
      comparisons,
    });
  }

  steps.push({
    nodeStates: cloneNodeStates(nodeStates),
    edgeStates: cloneEdgeStates(edgeStates),
    distances: defaultDistances(_nodes),
    queue: [],
    description: "DFS complete. All reachable nodes visited.",
    comparisons,
  });

  return steps;
}

// ── Dijkstra ─────────────────────────────────────────────────────────────────

export function dijkstraSteps(
  startId: string,
  nodes?: GraphNode[],
  edges?: GraphEdge[],
): GraphStep[] {
  const _nodes = nodes ?? DIRECTED_NODES;
  const _edges = edges ?? DIRECTED_EDGES;
  const adj = getAdjacency(_nodes, _edges, true);

  const steps: GraphStep[] = [];
  let comparisons = 0;

  const nodeStates = defaultNodeStates(_nodes);
  const edgeStates = defaultEdgeStates(_edges);
  const distances = defaultDistances(_nodes);
  const predecessor: Record<string, string | null> = {};
  for (const n of _nodes) predecessor[n.id] = null;
  distances[startId] = 0;

  // Priority queue as sorted array of {id, dist}
  type PQItem = { id: string; dist: number };
  let pq: PQItem[] = [{ id: startId, dist: 0 }];
  const settled = new Set<string>();

  nodeStates[startId] = "frontier";

  steps.push({
    nodeStates: cloneNodeStates(nodeStates),
    edgeStates: cloneEdgeStates(edgeStates),
    distances: cloneDists(distances),
    predecessor: { ...predecessor },
    updatedNodes: [startId],
    queue: pq.map((p) => `${p.id}:${p.dist}`),
    description: `Initialize distances. dist[${startId}]=0, all others=∞. Add ${startId} to priority queue.`,
    comparisons,
  });

  while (pq.length > 0) {
    pq.sort((a, b) => a.dist - b.dist);
    const { id: current, dist: currentDist } = pq.shift()!;

    if (settled.has(current)) continue;
    settled.add(current);
    nodeStates[current] = "current";

    steps.push({
      nodeStates: cloneNodeStates(nodeStates),
      edgeStates: cloneEdgeStates(edgeStates),
      distances: cloneDists(distances),
      predecessor: { ...predecessor },
      updatedNodes: [],
      queue: pq.map((p) => `${p.id}:${p.dist}`),
      description: `Extract min: ${current} (dist=${currentDist}). Settle ${current}. Examining outgoing edges…`,
      comparisons,
    });

    for (const { neighbor, weight, edgeId } of adj.get(current) ?? []) {
      comparisons++;
      if (settled.has(neighbor)) {
        edgeStates[edgeId] = "cross";
        continue;
      }
      const newDist = currentDist + weight;
      const oldDist = distances[neighbor];
      edgeStates[edgeId] = "relaxed";

      if (oldDist === null || newDist < oldDist) {
        distances[neighbor] = newDist;
        predecessor[neighbor] = current;
        nodeStates[neighbor] = "frontier";
        pq.push({ id: neighbor, dist: newDist });

        steps.push({
          nodeStates: cloneNodeStates(nodeStates),
          edgeStates: cloneEdgeStates(edgeStates),
          distances: cloneDists(distances),
          predecessor: { ...predecessor },
          updatedNodes: [neighbor],
          currentEdge: [current, neighbor],
          queue: pq.map((p) => `${p.id}:${p.dist}`),
          description: `Relax ${current}→${neighbor} (w=${weight}): ${currentDist}+${weight}=${newDist} < ${oldDist === null ? "∞" : oldDist}. ✓ Update dist[${neighbor}]=${newDist}, via ${current}.`,
          comparisons,
        });
      } else {
        steps.push({
          nodeStates: cloneNodeStates(nodeStates),
          edgeStates: cloneEdgeStates(edgeStates),
          distances: cloneDists(distances),
          predecessor: { ...predecessor },
          updatedNodes: [],
          currentEdge: [current, neighbor],
          queue: pq.map((p) => `${p.id}:${p.dist}`),
          description: `Check ${current}→${neighbor} (w=${weight}): ${currentDist}+${weight}=${newDist} ≥ ${oldDist}. ✗ No improvement.`,
          comparisons,
        });
      }
    }

    nodeStates[current] = "visited";
    // Mark tree edges
    for (const { neighbor, edgeId } of adj.get(current) ?? []) {
      if (settled.has(neighbor) || nodeStates[neighbor] === "frontier") {
        if (edgeStates[edgeId] === "relaxed") edgeStates[edgeId] = "tree";
      }
    }
  }

  steps.push({
    nodeStates: cloneNodeStates(nodeStates),
    edgeStates: cloneEdgeStates(edgeStates),
    distances: cloneDists(distances),
    predecessor: { ...predecessor },
    updatedNodes: [],
    queue: [],
    description: "Dijkstra complete. All shortest paths from source are settled.",
    comparisons,
  });

  return steps;
}

// ── Bellman-Ford ──────────────────────────────────────────────────────────────

export function bellmanFordSteps(
  startId: string,
  nodes?: GraphNode[],
  edges?: GraphEdge[],
): GraphStep[] {
  const _nodes = nodes ?? DIRECTED_NODES;
  const _edges = edges ?? DIRECTED_EDGES;

  const steps: GraphStep[] = [];
  let comparisons = 0;

  const nodeStates = defaultNodeStates(_nodes);
  const edgeStates = defaultEdgeStates(_edges);
  const distances = defaultDistances(_nodes);
  distances[startId] = 0;
  nodeStates[startId] = "frontier";

  steps.push({
    nodeStates: cloneNodeStates(nodeStates),
    edgeStates: cloneEdgeStates(edgeStates),
    distances: cloneDists(distances),
    queue: _nodes.map((n) => `${n.id}:${distances[n.id] === null ? "∞" : distances[n.id]}`),
    description: `Initialize: dist[${startId}]=0, all others=∞. Will relax all edges ${_nodes.length - 1} times.`,
    comparisons,
  });

  const V = _nodes.length;

  for (let round = 1; round <= V - 1; round++) {
    let anyUpdate = false;

    for (const edge of _edges) {
      comparisons++;
      const { source, target, weight, id: edgeId } = edge;
      const srcDist = distances[source];
      if (srcDist === null) continue;

      const newDist = srcDist + weight;
      const oldDist = distances[target];

      // Reset previous relaxed highlights
      const prevState = edgeStates[edgeId];
      edgeStates[edgeId] = "relaxed";
      nodeStates[source] = "current";

      if (oldDist === null || newDist < oldDist) {
        distances[target] = newDist;
        nodeStates[target] = "frontier";
        anyUpdate = true;

        steps.push({
          nodeStates: cloneNodeStates(nodeStates),
          edgeStates: cloneEdgeStates(edgeStates),
          distances: cloneDists(distances),
          queue: _nodes.map((n) => `${n.id}:${distances[n.id] === null ? "∞" : distances[n.id]}`),
          description: `Round ${round}: Relax edge ${source}→${target}: ${srcDist}+${weight}=${newDist} < ${oldDist === null ? "∞" : oldDist}. Updated dist[${target}]=${newDist}.`,
          comparisons,
        });
      } else {
        steps.push({
          nodeStates: cloneNodeStates(nodeStates),
          edgeStates: cloneEdgeStates(edgeStates),
          distances: cloneDists(distances),
          queue: _nodes.map((n) => `${n.id}:${distances[n.id] === null ? "∞" : distances[n.id]}`),
          description: `Round ${round}: Edge ${source}→${target}: ${srcDist}+${weight}=${newDist} ≥ ${oldDist}. No update.`,
          comparisons,
        });
      }

      edgeStates[edgeId] = prevState === "default" ? "default" : prevState;
      nodeStates[source] = distances[source] !== null ? "visited" : "default";
    }

    if (!anyUpdate) {
      steps.push({
        nodeStates: cloneNodeStates(nodeStates),
        edgeStates: cloneEdgeStates(edgeStates),
        distances: cloneDists(distances),
        queue: _nodes.map((n) => `${n.id}:${distances[n.id] === null ? "∞" : distances[n.id]}`),
        description: `Round ${round}: No distances updated. Early termination — algorithm converged.`,
        comparisons,
      });
      break;
    }
  }

  // Mark all settled nodes
  for (const n of _nodes) {
    if (distances[n.id] !== null) nodeStates[n.id] = "visited";
  }

  steps.push({
    nodeStates: cloneNodeStates(nodeStates),
    edgeStates: cloneEdgeStates(edgeStates),
    distances: cloneDists(distances),
    queue: _nodes.map((n) => `${n.id}:${distances[n.id] === null ? "∞" : distances[n.id]}`),
    description: "Bellman-Ford complete. Final shortest distances computed (no negative cycles detected).",
    comparisons,
  });

  return steps;
}

// ── Prim's MST ────────────────────────────────────────────────────────────────

export function primSteps(
  startId: string,
  nodes?: GraphNode[],
  edges?: GraphEdge[],
): GraphStep[] {
  const _nodes = nodes ?? UNDIRECTED_NODES;
  const _edges = edges ?? UNDIRECTED_EDGES;
  const adj = getAdjacency(_nodes, _edges, false);

  const steps: GraphStep[] = [];
  let comparisons = 0;

  const nodeStates = defaultNodeStates(_nodes);
  const edgeStates = defaultEdgeStates(_edges);
  const distances = defaultDistances(_nodes);
  distances[startId] = 0;
  nodeStates[startId] = "current";

  const inMST = new Set<string>([startId]);
  let mstCost = 0;

  // frontier edges: {source, target, weight, edgeId}
  type FrontierEdge = { source: string; target: string; weight: number; edgeId: string };
  const frontierEdges: FrontierEdge[] = [];

  for (const { neighbor, weight, edgeId } of adj.get(startId) ?? []) {
    frontierEdges.push({ source: startId, target: neighbor, weight, edgeId });
    nodeStates[neighbor] = "frontier";
    distances[neighbor] = weight;
  }

  steps.push({
    nodeStates: cloneNodeStates(nodeStates),
    edgeStates: cloneEdgeStates(edgeStates),
    distances: cloneDists(distances),
    queue: frontierEdges.map((fe) => `${fe.source}-${fe.target}:${fe.weight}`),
    description: `Start Prim's from ${startId}. Mark frontier edges: ${frontierEdges.map((f) => `${f.source}-${f.target}(${f.weight})`).join(", ")}. MST cost: 0.`,
    comparisons,
  });

  while (frontierEdges.length > 0 && inMST.size < _nodes.length) {
    frontierEdges.sort((a, b) => a.weight - b.weight);
    const best = frontierEdges.shift()!;

    comparisons++;
    if (inMST.has(best.target)) {
      edgeStates[best.edgeId] = "cross";
      steps.push({
        nodeStates: cloneNodeStates(nodeStates),
        edgeStates: cloneEdgeStates(edgeStates),
        distances: cloneDists(distances),
        queue: frontierEdges.map((fe) => `${fe.source}-${fe.target}:${fe.weight}`),
        description: `Edge ${best.source}-${best.target} (weight ${best.weight}) already in MST. Skip.`,
        comparisons,
      });
      continue;
    }

    inMST.add(best.target);
    mstCost += best.weight;
    edgeStates[best.edgeId] = "mst";
    nodeStates[best.target] = "inMST";
    nodeStates[best.source] = "inMST";

    steps.push({
      nodeStates: cloneNodeStates(nodeStates),
      edgeStates: cloneEdgeStates(edgeStates),
      distances: cloneDists(distances),
      queue: frontierEdges.map((fe) => `${fe.source}-${fe.target}:${fe.weight}`),
      description: `Add edge ${best.source}-${best.target} (weight ${best.weight}) to MST. MST cost so far: ${mstCost}.`,
      comparisons,
    });

    // Add new frontier edges from the newly added node
    for (const { neighbor, weight, edgeId } of adj.get(best.target) ?? []) {
      comparisons++;
      if (!inMST.has(neighbor)) {
        if (distances[neighbor] === null || weight < (distances[neighbor] ?? Infinity)) {
          distances[neighbor] = weight;
        }
        frontierEdges.push({ source: best.target, target: neighbor, weight, edgeId });
        if (nodeStates[neighbor] === "default") nodeStates[neighbor] = "frontier";
      }
    }

    if (frontierEdges.length > 0) {
      steps.push({
        nodeStates: cloneNodeStates(nodeStates),
        edgeStates: cloneEdgeStates(edgeStates),
        distances: cloneDists(distances),
        queue: frontierEdges.map((fe) => `${fe.source}-${fe.target}:${fe.weight}`),
        description: `Updated frontier. Next cheapest edge: ${frontierEdges.slice().sort((a, b) => a.weight - b.weight)[0]?.source}-${frontierEdges.slice().sort((a, b) => a.weight - b.weight)[0]?.target}.`,
        comparisons,
      });
    }
  }

  steps.push({
    nodeStates: cloneNodeStates(nodeStates),
    edgeStates: cloneEdgeStates(edgeStates),
    distances: cloneDists(distances),
    queue: [],
    description: `Prim's MST complete. Total MST cost: ${mstCost}.`,
    comparisons,
  });

  return steps;
}

// ── Kruskal's MST ─────────────────────────────────────────────────────────────

export function kruskalSteps(
  nodes?: GraphNode[],
  edges?: GraphEdge[],
): GraphStep[] {
  const _nodes = nodes ?? UNDIRECTED_NODES;
  const _edges = edges ?? UNDIRECTED_EDGES;

  const steps: GraphStep[] = [];
  let comparisons = 0;

  const nodeStates = defaultNodeStates(_nodes);
  const edgeStates = defaultEdgeStates(_edges);

  // Union-Find
  const parent: Record<string, string> = {};
  const rank: Record<string, number> = {};
  for (const n of _nodes) { parent[n.id] = n.id; rank[n.id] = 0; }

  function find(x: string): string {
    if (parent[x] !== x) parent[x] = find(parent[x]);
    return parent[x];
  }
  function union(x: string, y: string): boolean {
    const px = find(x), py = find(y);
    if (px === py) return false;
    if (rank[px] < rank[py]) parent[px] = py;
    else if (rank[px] > rank[py]) parent[py] = px;
    else { parent[py] = px; rank[px]++; }
    return true;
  }

  // Sort edges
  const sortedEdges = [..._edges].sort((a, b) => a.weight - b.weight);
  let mstCost = 0;
  const accepted: string[] = [];

  steps.push({
    nodeStates: cloneNodeStates(nodeStates),
    edgeStates: cloneEdgeStates(edgeStates),
    distances: defaultDistances(_nodes),
    queue: sortedEdges.map((e) => `${e.source}-${e.target}(${e.weight})`),
    description: `Kruskal's: Sort all ${_edges.length} edges by weight: ${sortedEdges.map((e) => `${e.source}-${e.target}(${e.weight})`).join(", ")}.`,
    comparisons,
  });

  for (const edge of sortedEdges) {
    comparisons++;
    const { source, target, weight, id: edgeId } = edge;
    edgeStates[edgeId] = "relaxed"; // Considering

    if (union(source, target)) {
      edgeStates[edgeId] = "mst";
      nodeStates[source] = "inMST";
      nodeStates[target] = "inMST";
      mstCost += weight;
      accepted.push(`${source}-${target}`);

      steps.push({
        nodeStates: cloneNodeStates(nodeStates),
        edgeStates: cloneEdgeStates(edgeStates),
        distances: defaultDistances(_nodes),
        queue: sortedEdges.map((e) => `${e.source}-${e.target}(${e.weight})`),
        description: `Consider edge ${source}-${target} (weight ${weight}). Components differ → Accept. MST cost: ${mstCost}. Accepted: [${accepted.join(", ")}].`,
        comparisons,
      });
    } else {
      edgeStates[edgeId] = "back"; // Rejected (would form cycle)

      steps.push({
        nodeStates: cloneNodeStates(nodeStates),
        edgeStates: cloneEdgeStates(edgeStates),
        distances: defaultDistances(_nodes),
        queue: sortedEdges.map((e) => `${e.source}-${e.target}(${e.weight})`),
        description: `Consider edge ${source}-${target} (weight ${weight}). Same component → Reject (would form cycle).`,
        comparisons,
      });
    }
  }

  steps.push({
    nodeStates: cloneNodeStates(nodeStates),
    edgeStates: cloneEdgeStates(edgeStates),
    distances: defaultDistances(_nodes),
    queue: [],
    description: `Kruskal's complete. MST edges: [${accepted.join(", ")}]. Total cost: ${mstCost}.`,
    comparisons,
  });

  return steps;
}

// ── Topological Sort ──────────────────────────────────────────────────────────

export function topoSteps(
  nodes?: GraphNode[],
  edges?: GraphEdge[],
): GraphStep[] {
  const _nodes = nodes ?? DIRECTED_NODES;
  const _edges = edges ?? DIRECTED_EDGES;
  const adj = getAdjacency(_nodes, _edges, true);

  const steps: GraphStep[] = [];
  let comparisons = 0;

  const nodeStates = defaultNodeStates(_nodes);
  const edgeStates = defaultEdgeStates(_edges);

  const visited = new Set<string>();
  const output: string[] = [];

  steps.push({
    nodeStates: cloneNodeStates(nodeStates),
    edgeStates: cloneEdgeStates(edgeStates),
    distances: defaultDistances(_nodes),
    queue: [],
    description: "Starting Topological Sort (DFS-based). Will process all nodes in reverse finish order.",
    comparisons,
  });

  function dfs(node: string): void {
    visited.add(node);
    nodeStates[node] = "current";

    steps.push({
      nodeStates: cloneNodeStates(nodeStates),
      edgeStates: cloneEdgeStates(edgeStates),
      distances: defaultDistances(_nodes),
      queue: [...output],
      description: `Visit ${node}. Exploring its outgoing edges.`,
      comparisons,
    });

    for (const { neighbor, edgeId } of adj.get(node) ?? []) {
      comparisons++;
      if (!visited.has(neighbor)) {
        edgeStates[edgeId] = "tree";
        steps.push({
          nodeStates: cloneNodeStates(nodeStates),
          edgeStates: cloneEdgeStates(edgeStates),
          distances: defaultDistances(_nodes),
          queue: [...output],
          description: `Edge ${node}→${neighbor}: ${neighbor} not visited. Recurse into ${neighbor}.`,
          comparisons,
        });
        dfs(neighbor);
      } else {
        edgeStates[edgeId] = "back";
        steps.push({
          nodeStates: cloneNodeStates(nodeStates),
          edgeStates: cloneEdgeStates(edgeStates),
          distances: defaultDistances(_nodes),
          queue: [...output],
          description: `Edge ${node}→${neighbor}: ${neighbor} already visited. Mark as back/cross edge.`,
          comparisons,
        });
      }
    }

    nodeStates[node] = "visited";
    output.unshift(node);

    steps.push({
      nodeStates: cloneNodeStates(nodeStates),
      edgeStates: cloneEdgeStates(edgeStates),
      distances: defaultDistances(_nodes),
      queue: [...output],
      description: `${node} finished. Prepend to output. Topo order so far: [${output.join(" → ")}].`,
      comparisons,
    });
  }

  // Process nodes in a deterministic order (reversed to get natural topo order)
  const nodeOrder = [..._nodes.map((n) => n.id)].reverse();
  for (const nodeId of nodeOrder) {
    if (!visited.has(nodeId)) {
      steps.push({
        nodeStates: cloneNodeStates(nodeStates),
        edgeStates: cloneEdgeStates(edgeStates),
        distances: defaultDistances(_nodes),
        queue: [...output],
        description: `Start DFS from unvisited node ${nodeId}.`,
        comparisons,
      });
      dfs(nodeId);
    }
  }

  // Mark all nodes as inMST (done) for final display
  for (const n of _nodes) nodeStates[n.id] = "inMST";

  steps.push({
    nodeStates: cloneNodeStates(nodeStates),
    edgeStates: cloneEdgeStates(edgeStates),
    distances: defaultDistances(_nodes),
    queue: [...output],
    description: `Topological Sort complete. Final order: ${output.join(" → ")}.`,
    comparisons,
  });

  return steps;
}

// ── Algorithm Metadata ────────────────────────────────────────────────────────

export type GraphAlgoMeta = {
  name: string;
  time: string;
  space: string;
  description: string;
  directed: boolean;
  queueLabel: string;
};

export const GRAPH_ALGO_META: Record<GraphAlgorithm, GraphAlgoMeta> = {
  bfs: {
    name: "Breadth-First Search",
    time: "O(V+E)",
    space: "O(V)",
    description:
      "BFS explores all neighbors at the current depth before moving deeper. It uses a queue (FIFO) and is guaranteed to find the shortest path in unweighted graphs.",
    directed: false,
    queueLabel: "Queue",
  },
  dfs: {
    name: "Depth-First Search",
    time: "O(V+E)",
    space: "O(V)",
    description:
      "DFS explores as far as possible along each branch before backtracking. Uses a stack (LIFO). Excellent for cycle detection, topological ordering, and finding connected components.",
    directed: false,
    queueLabel: "Stack",
  },
  dijkstra: {
    name: "Dijkstra's Algorithm",
    time: "O((V+E) log V)",
    space: "O(V)",
    description:
      "Finds shortest paths from a source to all vertices in a weighted graph with non-negative edge weights. Uses a min-priority queue and greedy relaxation.",
    directed: true,
    queueLabel: "Priority Queue",
  },
  "bellman-ford": {
    name: "Bellman-Ford",
    time: "O(VE)",
    space: "O(V)",
    description:
      "Computes shortest paths from a source, handling negative edge weights. Relaxes all edges V−1 times. Can detect negative-weight cycles.",
    directed: true,
    queueLabel: "Distance Table",
  },
  prim: {
    name: "Prim's MST",
    time: "O((V+E) log V)",
    space: "O(V)",
    description:
      "Builds a minimum spanning tree by greedily picking the cheapest edge that connects a new vertex to the growing MST. Starts from a seed vertex.",
    directed: false,
    queueLabel: "Frontier Edges",
  },
  kruskal: {
    name: "Kruskal's MST",
    time: "O(E log E)",
    space: "O(V)",
    description:
      "Builds a minimum spanning tree by sorting all edges and greedily adding the cheapest edge that doesn't form a cycle. Uses Union-Find for cycle detection.",
    directed: false,
    queueLabel: "Sorted Edges",
  },
  topo: {
    name: "Topological Sort",
    time: "O(V+E)",
    space: "O(V)",
    description:
      "Produces a linear ordering of vertices in a DAG such that every directed edge u→v places u before v. DFS-based: prepend each node to output when it finishes.",
    directed: true,
    queueLabel: "Output Order",
  },
};

// ── Step generator ────────────────────────────────────────────────────────────

export function getGraphSteps(
  algorithm: GraphAlgorithm,
  startId: string,
  nodes?: GraphNode[],
  edges?: GraphEdge[],
): GraphStep[] {
  switch (algorithm) {
    case "bfs":          return bfsSteps(startId, nodes, edges);
    case "dfs":          return dfsSteps(startId, nodes, edges);
    case "dijkstra":     return dijkstraSteps(startId, nodes, edges);
    case "bellman-ford": return bellmanFordSteps(startId, nodes, edges);
    case "prim":         return primSteps(startId, nodes, edges);
    case "kruskal":      return kruskalSteps(nodes, edges);
    case "topo":         return topoSteps(nodes, edges);
    default:             return bfsSteps(startId, nodes, edges);
  }
}
