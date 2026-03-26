/**
 * Pure pathfinding logic — no React.
 * Exports step-by-step snapshots for BFS, DFS, Dijkstra, and A*.
 */

export type CellState =
  | "empty"
  | "wall"
  | "start"
  | "end"
  | "visited"
  | "frontier"
  | "path";

export type Grid = CellState[][];

export interface PathStep {
  /** Cells that have been fully processed, encoded as row * cols + col */
  visited: Set<number>;
  /** Cells currently in the open set / queue / stack */
  frontier: Set<number>;
  /** Encoded cell indices of the found path (empty until found) */
  path: number[];
  done: boolean;
  found: boolean;
  description: string;
}

export type PathAlgorithm = "bfs" | "dfs" | "dijkstra" | "astar";

// ── helpers ─────────────────────────────────────────────────────────────────

function encode(row: number, col: number, cols: number): number {
  return row * cols + col;
}

function decode(idx: number, cols: number): [number, number] {
  return [Math.floor(idx / cols), idx % cols];
}

const DIRS: [number, number][] = [
  [-1, 0], // up
  [1, 0],  // down
  [0, -1], // left
  [0, 1],  // right
];

function neighbors(
  row: number,
  col: number,
  grid: Grid
): [number, number][] {
  const rows = grid.length;
  const cols = grid[0].length;
  const result: [number, number][] = [];
  for (const [dr, dc] of DIRS) {
    const nr = row + dr;
    const nc = col + dc;
    if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && grid[nr][nc] !== "wall") {
      result.push([nr, nc]);
    }
  }
  return result;
}

function reconstructPath(
  cameFrom: Map<number, number>,
  endIdx: number
): number[] {
  const path: number[] = [];
  let cur = endIdx;
  while (cameFrom.has(cur)) {
    path.unshift(cur);
    cur = cameFrom.get(cur)!;
  }
  path.unshift(cur); // start cell
  return path;
}

function snapVisited(visitedSet: Set<number>): Set<number> {
  return new Set(visitedSet);
}

function snapFrontier(frontierIterable: Iterable<number>): Set<number> {
  return new Set(frontierIterable);
}

// ── BFS ─────────────────────────────────────────────────────────────────────

function bfsSteps(
  grid: Grid,
  startRow: number,
  startCol: number,
  endRow: number,
  endCol: number
): PathStep[] {
  const cols = grid[0].length;
  const startIdx = encode(startRow, startCol, cols);
  const endIdx = encode(endRow, endCol, cols);

  const steps: PathStep[] = [];
  const visited = new Set<number>();
  const cameFrom = new Map<number, number>();
  const queue: number[] = [startIdx];
  const inQueue = new Set<number>([startIdx]);

  steps.push({
    visited: new Set(),
    frontier: new Set([startIdx]),
    path: [],
    done: false,
    found: false,
    description: `BFS: initialised. Start at (${startRow},${startCol}), end at (${endRow},${endCol}).`,
  });

  while (queue.length > 0) {
    const current = queue.shift()!;
    inQueue.delete(current);

    if (visited.has(current)) continue;
    visited.add(current);

    if (current === endIdx) {
      const path = reconstructPath(cameFrom, endIdx);
      steps.push({
        visited: snapVisited(visited),
        frontier: snapFrontier(inQueue),
        path,
        done: true,
        found: true,
        description: `BFS: reached end! Path length ${path.length} cells.`,
      });
      return steps;
    }

    const [row, col] = decode(current, cols);
    for (const [nr, nc] of neighbors(row, col, grid)) {
      const nIdx = encode(nr, nc, cols);
      if (!visited.has(nIdx) && !inQueue.has(nIdx)) {
        cameFrom.set(nIdx, current);
        queue.push(nIdx);
        inQueue.add(nIdx);
      }
    }

    steps.push({
      visited: snapVisited(visited),
      frontier: snapFrontier(inQueue),
      path: [],
      done: false,
      found: false,
      description: `BFS: processed (${row},${col}). Queue size: ${queue.length}.`,
    });
  }

  steps.push({
    visited: snapVisited(visited),
    frontier: new Set(),
    path: [],
    done: true,
    found: false,
    description: "BFS: no path found — end is unreachable.",
  });
  return steps;
}

// ── DFS ─────────────────────────────────────────────────────────────────────

function dfsSteps(
  grid: Grid,
  startRow: number,
  startCol: number,
  endRow: number,
  endCol: number
): PathStep[] {
  const cols = grid[0].length;
  const startIdx = encode(startRow, startCol, cols);
  const endIdx = encode(endRow, endCol, cols);

  const steps: PathStep[] = [];
  const visited = new Set<number>();
  const cameFrom = new Map<number, number>();
  const stack: number[] = [startIdx];

  steps.push({
    visited: new Set(),
    frontier: new Set([startIdx]),
    path: [],
    done: false,
    found: false,
    description: `DFS: initialised. Start at (${startRow},${startCol}), end at (${endRow},${endCol}).`,
  });

  while (stack.length > 0) {
    const current = stack[stack.length - 1];
    stack.pop();

    if (visited.has(current)) continue;
    visited.add(current);

    if (current === endIdx) {
      const path = reconstructPath(cameFrom, endIdx);
      steps.push({
        visited: snapVisited(visited),
        frontier: new Set(stack),
        path,
        done: true,
        found: true,
        description: `DFS: reached end! Path length ${path.length} cells.`,
      });
      return steps;
    }

    const [row, col] = decode(current, cols);
    for (const [nr, nc] of neighbors(row, col, grid)) {
      const nIdx = encode(nr, nc, cols);
      if (!visited.has(nIdx)) {
        cameFrom.set(nIdx, current);
        stack.push(nIdx);
      }
    }

    steps.push({
      visited: snapVisited(visited),
      frontier: new Set(stack.slice(-1)), // show only the top of stack as frontier
      path: [],
      done: false,
      found: false,
      description: `DFS: processed (${row},${col}). Stack depth: ${stack.length}.`,
    });
  }

  steps.push({
    visited: snapVisited(visited),
    frontier: new Set(),
    path: [],
    done: true,
    found: false,
    description: "DFS: no path found — end is unreachable.",
  });
  return steps;
}

// ── Dijkstra ─────────────────────────────────────────────────────────────────
// Simple min-heap via a sorted insertion for small grids (≤ ~1000 cells).
// All edge weights = 1, so behaviour is identical to BFS but implemented
// with a proper priority queue.

class MinHeap {
  private heap: [number, number][] = []; // [cost, cellIdx]

  push(cost: number, idx: number) {
    this.heap.push([cost, idx]);
    this.heap.sort((a, b) => a[0] - b[0]);
  }

  pop(): [number, number] | undefined {
    return this.heap.shift();
  }

  get size() {
    return this.heap.length;
  }

  toIdxSet(): Set<number> {
    return new Set(this.heap.map(([, idx]) => idx));
  }
}

function dijkstraSteps(
  grid: Grid,
  startRow: number,
  startCol: number,
  endRow: number,
  endCol: number
): PathStep[] {
  const cols = grid[0].length;
  const startIdx = encode(startRow, startCol, cols);
  const endIdx = encode(endRow, endCol, cols);

  const steps: PathStep[] = [];
  const dist = new Map<number, number>();
  const visited = new Set<number>();
  const cameFrom = new Map<number, number>();
  const pq = new MinHeap();

  dist.set(startIdx, 0);
  pq.push(0, startIdx);

  steps.push({
    visited: new Set(),
    frontier: new Set([startIdx]),
    path: [],
    done: false,
    found: false,
    description: `Dijkstra: initialised. Start at (${startRow},${startCol}), end at (${endRow},${endCol}).`,
  });

  while (pq.size > 0) {
    const entry = pq.pop()!;
    const [cost, current] = entry;

    if (visited.has(current)) continue;
    visited.add(current);

    if (current === endIdx) {
      const path = reconstructPath(cameFrom, endIdx);
      steps.push({
        visited: snapVisited(visited),
        frontier: pq.toIdxSet(),
        path,
        done: true,
        found: true,
        description: `Dijkstra: reached end! Cost ${cost}, path length ${path.length} cells.`,
      });
      return steps;
    }

    const [row, col] = decode(current, cols);
    for (const [nr, nc] of neighbors(row, col, grid)) {
      const nIdx = encode(nr, nc, cols);
      if (visited.has(nIdx)) continue;
      const newCost = cost + 1;
      if (!dist.has(nIdx) || newCost < dist.get(nIdx)!) {
        dist.set(nIdx, newCost);
        cameFrom.set(nIdx, current);
        pq.push(newCost, nIdx);
      }
    }

    steps.push({
      visited: snapVisited(visited),
      frontier: pq.toIdxSet(),
      path: [],
      done: false,
      found: false,
      description: `Dijkstra: settled (${row},${col}) cost=${cost}. Open set size: ${pq.size}.`,
    });
  }

  steps.push({
    visited: snapVisited(visited),
    frontier: new Set(),
    path: [],
    done: true,
    found: false,
    description: "Dijkstra: no path found — end is unreachable.",
  });
  return steps;
}

// ── A* ───────────────────────────────────────────────────────────────────────

function manhattan(
  row: number,
  col: number,
  endRow: number,
  endCol: number
): number {
  return Math.abs(row - endRow) + Math.abs(col - endCol);
}

function astarSteps(
  grid: Grid,
  startRow: number,
  startCol: number,
  endRow: number,
  endCol: number
): PathStep[] {
  const cols = grid[0].length;
  const startIdx = encode(startRow, startCol, cols);
  const endIdx = encode(endRow, endCol, cols);

  const steps: PathStep[] = [];
  const gScore = new Map<number, number>();
  const visited = new Set<number>();
  const cameFrom = new Map<number, number>();
  const openSet = new MinHeap();

  gScore.set(startIdx, 0);
  const h0 = manhattan(startRow, startCol, endRow, endCol);
  openSet.push(h0, startIdx);

  steps.push({
    visited: new Set(),
    frontier: new Set([startIdx]),
    path: [],
    done: false,
    found: false,
    description: `A*: initialised. h(start)=${h0}. Start at (${startRow},${startCol}), end at (${endRow},${endCol}).`,
  });

  while (openSet.size > 0) {
    const entry = openSet.pop()!;
    const [, current] = entry;

    if (visited.has(current)) continue;
    visited.add(current);

    if (current === endIdx) {
      const path = reconstructPath(cameFrom, endIdx);
      steps.push({
        visited: snapVisited(visited),
        frontier: openSet.toIdxSet(),
        path,
        done: true,
        found: true,
        description: `A*: reached end! Path length ${path.length} cells.`,
      });
      return steps;
    }

    const [row, col] = decode(current, cols);
    const g = gScore.get(current) ?? Infinity;

    for (const [nr, nc] of neighbors(row, col, grid)) {
      const nIdx = encode(nr, nc, cols);
      if (visited.has(nIdx)) continue;
      const tentativeG = g + 1;
      if (!gScore.has(nIdx) || tentativeG < gScore.get(nIdx)!) {
        gScore.set(nIdx, tentativeG);
        cameFrom.set(nIdx, current);
        const f = tentativeG + manhattan(nr, nc, endRow, endCol);
        openSet.push(f, nIdx);
      }
    }

    steps.push({
      visited: snapVisited(visited),
      frontier: openSet.toIdxSet(),
      path: [],
      done: false,
      found: false,
      description: `A*: expanded (${row},${col}) g=${g} h=${manhattan(row, col, endRow, endCol)}. Open set: ${openSet.size}.`,
    });
  }

  steps.push({
    visited: snapVisited(visited),
    frontier: new Set(),
    path: [],
    done: true,
    found: false,
    description: "A*: no path found — end is unreachable.",
  });
  return steps;
}

// ── public entry point ───────────────────────────────────────────────────────

export function getPathSteps(
  algo: PathAlgorithm,
  grid: Grid,
  startRow: number,
  startCol: number,
  endRow: number,
  endCol: number
): PathStep[] {
  switch (algo) {
    case "bfs":
      return bfsSteps(grid, startRow, startCol, endRow, endCol);
    case "dfs":
      return dfsSteps(grid, startRow, startCol, endRow, endCol);
    case "dijkstra":
      return dijkstraSteps(grid, startRow, startCol, endRow, endCol);
    case "astar":
      return astarSteps(grid, startRow, startCol, endRow, endCol);
  }
}
