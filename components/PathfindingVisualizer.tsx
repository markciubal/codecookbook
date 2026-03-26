"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Navigation,
  Shuffle,
  Eraser,
  MapPin,
  Flag,
  BrickWall,
} from "lucide-react";
import {
  getPathSteps,
  type CellState,
  type Grid,
  type PathStep,
  type PathAlgorithm,
} from "@/lib/pathfinding";

// ── constants ─────────────────────────────────────────────────────────────────

const SPEED_MIN = 10;
const SPEED_MAX = 600;

const ALGO_LABELS: Record<PathAlgorithm, string> = {
  bfs: "BFS",
  dfs: "DFS",
  dijkstra: "Dijkstra",
  astar: "A*",
};

const ALGO_DESCRIPTIONS: Record<PathAlgorithm, string> = {
  bfs: "Breadth-First Search — explores layer by layer, guarantees shortest path on unweighted grids.",
  dfs: "Depth-First Search — dives deep before backtracking, does not guarantee shortest path.",
  dijkstra:
    "Dijkstra's Algorithm — shortest-path with a priority queue. All weights are 1 here, so identical to BFS.",
  astar:
    "A* — guides search with Manhattan heuristic, typically visits fewer cells than Dijkstra.",
};

// ── cell colour map ───────────────────────────────────────────────────────────

function getCellBg(state: CellState): string {
  switch (state) {
    case "empty":
      return "var(--color-surface-2)";
    case "wall":
      return "rgba(var(--color-text-raw, 220,220,220), 0.80)";
    case "start":
      return "#22c55e";
    case "end":
      return "#ef4444";
    case "visited":
      return "color-mix(in srgb, var(--color-accent) 30%, transparent)";
    case "frontier":
      return "color-mix(in srgb, var(--color-accent) 70%, transparent)";
    case "path":
      return "#fbbf24";
  }
}

// Fallback for browsers without color-mix (use inline opacity trick)
function getCellStyle(state: CellState): React.CSSProperties {
  const base: React.CSSProperties = {
    boxSizing: "border-box",
    border: "1px solid var(--color-border)",
    transition: "background-color 0.07s ease",
    cursor: "pointer",
  };

  if (state === "wall") {
    return { ...base, background: "var(--color-text)", opacity: 0.8 };
  }
  if (state === "visited") {
    return { ...base, background: "var(--color-accent)", opacity: 0.3 };
  }
  if (state === "frontier") {
    return { ...base, background: "var(--color-accent)", opacity: 0.7 };
  }
  return { ...base, background: getCellBg(state), opacity: 1 };
}

// ── helpers ───────────────────────────────────────────────────────────────────

function makeEmptyGrid(rows: number, cols: number): Grid {
  return Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => "empty" as CellState)
  );
}

function cloneGrid(grid: Grid): Grid {
  return grid.map((row) => [...row]);
}

/** Merge base grid with a PathStep overlay to get display states */
function mergeGridWithStep(
  base: Grid,
  step: PathStep | null,
  startCell: [number, number] | null,
  endCell: [number, number] | null,
  cols: number
): CellState[][] {
  if (!step) return base;

  const pathSet = new Set(step.path);

  return base.map((row, r) =>
    row.map((cell, c) => {
      // Start/end always show on top (unless wall)
      if (cell === "wall") return "wall";

      if (startCell && r === startCell[0] && c === startCell[1]) return "start";
      if (endCell && r === endCell[0] && c === endCell[1]) return "end";

      const idx = r * cols + c;

      if (pathSet.has(idx)) return "path";
      if (step.frontier.has(idx)) return "frontier";
      if (step.visited.has(idx)) return "visited";

      return cell;
    })
  );
}

/** Recursive division maze — fills grid with walls then carves passages */
function generateMaze(rows: number, cols: number): Grid {
  const grid = makeEmptyGrid(rows, cols);

  function carve(
    rStart: number,
    rEnd: number,
    cStart: number,
    cEnd: number,
    horizontal: boolean
  ) {
    if (rEnd - rStart < 2 || cEnd - cStart < 2) return;

    if (horizontal) {
      // Draw a horizontal wall with a gap
      const wallRow =
        rStart + 1 + Math.floor(Math.random() * Math.floor((rEnd - rStart) / 2)) * 2;
      const gapCol =
        cStart + Math.floor(Math.random() * Math.floor((cEnd - cStart + 1)));
      for (let c = cStart; c <= cEnd; c++) {
        if (c !== gapCol) grid[wallRow][c] = "wall";
      }
      carve(rStart, wallRow - 1, cStart, cEnd, !horizontal);
      carve(wallRow + 1, rEnd, cStart, cEnd, !horizontal);
    } else {
      const wallCol =
        cStart + 1 + Math.floor(Math.random() * Math.floor((cEnd - cStart) / 2)) * 2;
      const gapRow =
        rStart + Math.floor(Math.random() * Math.floor((rEnd - rStart + 1)));
      for (let r = rStart; r <= rEnd; r++) {
        if (r !== gapRow) grid[r][wallCol] = "wall";
      }
      carve(rStart, rEnd, cStart, wallCol - 1, !horizontal);
      carve(rStart, rEnd, wallCol + 1, cEnd, !horizontal);
    }
  }

  carve(0, rows - 1, 0, cols - 1, rows < cols);
  return grid;
}

/** 20% random wall fill */
function generateRandomWalls(rows: number, cols: number): Grid {
  return Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () =>
      Math.random() < 0.2 ? ("wall" as CellState) : ("empty" as CellState)
    )
  );
}

// ── draw-mode types ───────────────────────────────────────────────────────────

type DrawMode = "wall" | "erase" | "start" | "end";

// ── main component ────────────────────────────────────────────────────────────

export default function PathfindingVisualizer() {
  const ROWS = 20;
  const COLS = 35;

  const [grid, setGrid] = useState<Grid>(() => makeEmptyGrid(ROWS, COLS));
  const [startCell, setStartCell] = useState<[number, number] | null>([
    Math.floor(ROWS / 2),
    3,
  ]);
  const [endCell, setEndCell] = useState<[number, number] | null>([
    Math.floor(ROWS / 2),
    COLS - 4,
  ]);
  const [algo, setAlgo] = useState<PathAlgorithm>("astar");
  const [steps, setSteps] = useState<PathStep[]>([]);
  const [stepIdx, setStepIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(80);
  const [drawMode, setDrawMode] = useState<DrawMode>("wall");
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasRun, setHasRun] = useState(false);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── derived display grid ────────────────────────────────────────────────────

  const currentStep = hasRun ? steps[stepIdx] ?? null : null;
  const displayGrid = mergeGridWithStep(grid, currentStep, startCell, endCell, COLS);

  // ── playback ────────────────────────────────────────────────────────────────

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

  // ── run algorithm ───────────────────────────────────────────────────────────

  const runAlgo = useCallback(() => {
    if (!startCell || !endCell) return;
    const newSteps = getPathSteps(
      algo,
      grid,
      startCell[0],
      startCell[1],
      endCell[0],
      endCell[1]
    );
    setSteps(newSteps);
    setStepIdx(0);
    setIsPlaying(false);
    setHasRun(true);
  }, [algo, grid, startCell, endCell]);

  // ── reset ───────────────────────────────────────────────────────────────────

  const reset = useCallback(() => {
    setIsPlaying(false);
    setSteps([]);
    setStepIdx(0);
    setHasRun(false);
  }, []);

  const clearWalls = useCallback(() => {
    reset();
    setGrid(makeEmptyGrid(ROWS, COLS));
  }, [reset]);

  // ── cell interaction ────────────────────────────────────────────────────────

  const applyCell = useCallback(
    (row: number, col: number) => {
      // If the algo has run, reset visual state when editing
      if (hasRun) reset();

      if (drawMode === "start") {
        setStartCell([row, col]);
        // Remove wall if present
        setGrid((g) => {
          const next = cloneGrid(g);
          if (next[row][col] === "wall") next[row][col] = "empty";
          return next;
        });
        return;
      }
      if (drawMode === "end") {
        setEndCell([row, col]);
        setGrid((g) => {
          const next = cloneGrid(g);
          if (next[row][col] === "wall") next[row][col] = "empty";
          return next;
        });
        return;
      }

      setGrid((g) => {
        const next = cloneGrid(g);
        // Don't overwrite start/end cells with walls
        if (startCell && row === startCell[0] && col === startCell[1]) return next;
        if (endCell && row === endCell[0] && col === endCell[1]) return next;
        next[row][col] = drawMode === "wall" ? "wall" : "empty";
        return next;
      });
    },
    [drawMode, startCell, endCell, hasRun, reset]
  );

  const handleMouseDown = useCallback(
    (row: number, col: number) => {
      setIsDrawing(true);
      applyCell(row, col);
    },
    [applyCell]
  );

  const handleMouseEnter = useCallback(
    (row: number, col: number) => {
      if (!isDrawing) return;
      applyCell(row, col);
    },
    [isDrawing, applyCell]
  );

  const handleMouseUp = useCallback(() => {
    setIsDrawing(false);
  }, []);

  // Touch support
  const handleTouchStart = useCallback(
    (e: React.TouchEvent, row: number, col: number) => {
      e.preventDefault();
      setIsDrawing(true);
      applyCell(row, col);
    },
    [applyCell]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      e.preventDefault();
      if (!isDrawing) return;
      const touch = e.touches[0];
      const el = document.elementFromPoint(touch.clientX, touch.clientY);
      if (!el) return;
      const r = el.getAttribute("data-row");
      const c = el.getAttribute("data-col");
      if (r !== null && c !== null) applyCell(Number(r), Number(c));
    },
    [isDrawing, applyCell]
  );

  // Global mouseup so drag isn't stuck
  useEffect(() => {
    const up = () => setIsDrawing(false);
    window.addEventListener("mouseup", up);
    return () => window.removeEventListener("mouseup", up);
  }, []);

  // ── keyboard shortcuts ──────────────────────────────────────────────────────

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;
      if (e.key === " ") {
        e.preventDefault();
        if (!hasRun) {
          runAlgo();
          setTimeout(() => setIsPlaying(true), 50);
        } else {
          setIsPlaying((p) => {
            if (!p && stepIdx >= steps.length - 1) return p;
            return !p;
          });
        }
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
  }, [hasRun, runAlgo, stepIdx, steps.length, reset]);

  // ── legend items ────────────────────────────────────────────────────────────

  const LEGEND: { state: CellState; label: string }[] = [
    { state: "start", label: "Start" },
    { state: "end", label: "End" },
    { state: "wall", label: "Wall" },
    { state: "frontier", label: "Frontier" },
    { state: "visited", label: "Visited" },
    { state: "path", label: "Path" },
  ];

  const canBack = stepIdx > 0;
  const canForward = stepIdx < steps.length - 1;
  const isComplete = hasRun && steps.length > 0 && stepIdx === steps.length - 1;

  return (
    <div
      className="flex flex-col gap-4"
      onMouseUp={handleMouseUp}
      onTouchEnd={() => setIsDrawing(false)}
      onTouchMove={handleTouchMove}
    >
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div
        className="flex flex-col gap-1 pb-4"
        style={{ borderBottom: "1px solid var(--color-border)" }}
      >
        <div className="flex flex-wrap items-center gap-2">
          <Navigation
            size={20}
            style={{ color: "var(--color-accent)", flexShrink: 0 }}
            strokeWidth={1.75}
          />
          <h1 className="text-2xl font-bold">Path Finding</h1>
        </div>
        <p className="text-sm max-w-2xl" style={{ color: "var(--color-muted)" }}>
          {ALGO_DESCRIPTIONS[algo]}
        </p>
      </div>

      {/* ── Algorithm selector ─────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--color-muted)" }}>
          Algorithm
        </span>
        {(Object.keys(ALGO_LABELS) as PathAlgorithm[]).map((a) => (
          <button
            key={a}
            onClick={() => { setAlgo(a); reset(); }}
            className="px-3 py-1 rounded-lg text-sm font-medium transition-colors"
            style={{
              background:
                algo === a ? "var(--color-accent)" : "var(--color-surface-3)",
              color: algo === a ? "#fff" : "var(--color-text)",
              border:
                "1px solid " +
                (algo === a ? "var(--color-accent)" : "var(--color-border)"),
              cursor: "pointer",
            }}
          >
            {ALGO_LABELS[a]}
          </button>
        ))}
      </div>

      {/* ── Draw mode selector ─────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--color-muted)" }}>
          Draw
        </span>
        {(
          [
            { mode: "wall" as DrawMode, label: "Wall", Icon: BrickWall },
            { mode: "erase" as DrawMode, label: "Erase", Icon: Eraser },
            { mode: "start" as DrawMode, label: "Start", Icon: MapPin },
            { mode: "end" as DrawMode, label: "End", Icon: Flag },
          ] as { mode: DrawMode; label: string; Icon: React.ElementType }[]
        ).map(({ mode, label, Icon }) => (
          <button
            key={mode}
            onClick={() => setDrawMode(mode)}
            className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-sm font-medium transition-colors"
            style={{
              background:
                drawMode === mode
                  ? "var(--color-accent)"
                  : "var(--color-surface-3)",
              color: drawMode === mode ? "#fff" : "var(--color-text)",
              border:
                "1px solid " +
                (drawMode === mode
                  ? "var(--color-accent)"
                  : "var(--color-border)"),
              cursor: "pointer",
            }}
          >
            <Icon size={13} strokeWidth={1.75} />
            {label}
          </button>
        ))}

        {/* Utility buttons */}
        <div
          className="ml-2 pl-3 flex gap-2"
          style={{ borderLeft: "1px solid var(--color-border)" }}
        >
          <button
            onClick={clearWalls}
            className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-sm font-medium"
            style={{
              background: "var(--color-surface-3)",
              border: "1px solid var(--color-border)",
              color: "var(--color-text)",
              cursor: "pointer",
            }}
          >
            <Eraser size={13} strokeWidth={1.75} /> Clear walls
          </button>
          <button
            onClick={() => {
              reset();
              setGrid(generateMaze(ROWS, COLS));
            }}
            className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-sm font-medium"
            style={{
              background: "var(--color-surface-3)",
              border: "1px solid var(--color-border)",
              color: "var(--color-text)",
              cursor: "pointer",
            }}
          >
            <Shuffle size={13} strokeWidth={1.75} /> Maze
          </button>
          <button
            onClick={() => {
              reset();
              const rw = generateRandomWalls(ROWS, COLS);
              // Ensure start/end are clear
              if (startCell) rw[startCell[0]][startCell[1]] = "empty";
              if (endCell) rw[endCell[0]][endCell[1]] = "empty";
              setGrid(rw);
            }}
            className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-sm font-medium"
            style={{
              background: "var(--color-surface-3)",
              border: "1px solid var(--color-border)",
              color: "var(--color-text)",
              cursor: "pointer",
            }}
          >
            <Shuffle size={13} strokeWidth={1.75} /> Random walls
          </button>
        </div>
      </div>

      {/* ── Grid ───────────────────────────────────────────────────────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${COLS}, 1fr)`,
          gap: 1,
          background: "var(--color-border)",
          borderRadius: 8,
          overflow: "hidden",
          border: "1px solid var(--color-border)",
          userSelect: "none",
          WebkitUserSelect: "none",
          touchAction: "none",
        }}
      >
        {displayGrid.map((row, r) =>
          row.map((cellState, c) => (
            <div
              key={`${r}-${c}`}
              data-row={r}
              data-col={c}
              style={{
                ...getCellStyle(cellState),
                // 22px on desktop, 14px on small screens via clamp
                height: "clamp(14px, 2.2vw, 22px)",
              }}
              onMouseDown={() => handleMouseDown(r, c)}
              onMouseEnter={() => handleMouseEnter(r, c)}
              onTouchStart={(e) => handleTouchStart(e, r, c)}
              aria-label={`Cell ${r},${c}: ${cellState}`}
            />
          ))
        )}
      </div>

      {/* ── Playback controls + step info ──────────────────────────────── */}
      <div
        className="flex flex-col gap-3 p-4 rounded-xl"
        style={{
          background: "var(--color-surface-2)",
          border: "1px solid var(--color-border)",
        }}
      >
        {/* Run / playback row */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Run button */}
          <button
            onClick={() => {
              runAlgo();
              setTimeout(() => setIsPlaying(true), 20);
            }}
            disabled={!startCell || !endCell}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: "var(--color-accent)",
              color: "#fff",
              border: "1px solid var(--color-accent)",
              cursor: "pointer",
            }}
          >
            <Navigation size={13} strokeWidth={1.75} /> Run {ALGO_LABELS[algo]}
          </button>

          {/* Transport */}
          <CtrlBtn
            onClick={() => { setIsPlaying(false); setStepIdx(0); }}
            disabled={!canBack}
          >
            <SkipBack size={14} strokeWidth={1.75} />
          </CtrlBtn>
          <CtrlBtn
            onClick={() => { setIsPlaying(false); setStepIdx((p) => Math.max(0, p - 1)); }}
            disabled={!canBack}
          >
            <ChevronLeft size={14} strokeWidth={1.75} />
          </CtrlBtn>
          <CtrlBtn
            primary
            onClick={() => setIsPlaying((p) => !p)}
            disabled={!hasRun || !canForward}
            style={{ minWidth: 80 }}
          >
            {isPlaying
              ? <><Pause size={13} strokeWidth={1.75} /> Pause</>
              : <><Play size={13} strokeWidth={1.75} /> Play</>}
          </CtrlBtn>
          <CtrlBtn
            onClick={() => { setIsPlaying(false); setStepIdx((p) => Math.min(steps.length - 1, p + 1)); }}
            disabled={!canForward}
          >
            <ChevronRight size={14} strokeWidth={1.75} />
          </CtrlBtn>
          <CtrlBtn
            onClick={() => { setIsPlaying(false); setStepIdx(steps.length - 1); }}
            disabled={!canForward}
          >
            <SkipForward size={14} strokeWidth={1.75} />
          </CtrlBtn>
          <CtrlBtn onClick={reset}>
            <RotateCcw size={13} strokeWidth={1.75} /> Reset
          </CtrlBtn>

          {/* Speed slider */}
          <div
            className="flex items-center gap-2 pl-3 ml-1"
            style={{ borderLeft: "1px solid var(--color-border)" }}
          >
            <span className="text-xs" style={{ color: "var(--color-muted)", whiteSpace: "nowrap" }}>Slow</span>
            <input
              type="range"
              min={SPEED_MIN}
              max={SPEED_MAX}
              step={10}
              value={SPEED_MAX + SPEED_MIN - speed}
              onChange={(e) =>
                setSpeed(SPEED_MAX + SPEED_MIN - Number(e.target.value))
              }
              style={{
                width: 80,
                accentColor: "var(--color-accent)",
                cursor: "pointer",
              }}
            />
            <span className="text-xs" style={{ color: "var(--color-muted)", whiteSpace: "nowrap" }}>Fast</span>
          </div>
        </div>

        {/* Progress scrubber */}
        {hasRun && (
          <input
            type="range"
            min={0}
            max={Math.max(0, steps.length - 1)}
            value={stepIdx}
            onChange={(e) => {
              setIsPlaying(false);
              setStepIdx(Number(e.target.value));
            }}
            className="w-full"
            style={{ accentColor: "var(--color-accent)", cursor: "pointer" }}
          />
        )}

        {/* Step counter + description */}
        <div className="flex flex-wrap items-center gap-4">
          {hasRun && (
            <span
              className="text-xs font-mono shrink-0"
              style={{ color: "var(--color-muted)" }}
            >
              Step {stepIdx + 1} / {steps.length}
            </span>
          )}
          {currentStep && (
            <span className="text-sm" style={{ color: "var(--color-muted)" }}>
              {currentStep.description}
            </span>
          )}
          {!hasRun && (
            <span className="text-sm" style={{ color: "var(--color-muted)" }}>
              Draw walls, set start / end, then click{" "}
              <strong style={{ color: "var(--color-accent)" }}>Run</strong> or
              press <kbd className="px-1 rounded text-xs" style={{ background: "var(--color-surface-3)", border: "1px solid var(--color-border)" }}>Space</kbd>.
            </span>
          )}
        </div>

        {/* Completion banner */}
        {isComplete && currentStep && (
          <div
            className="text-sm px-3 py-2 rounded-lg"
            style={{
              background: currentStep.found
                ? "rgba(34,197,94,0.10)"
                : "rgba(239,68,68,0.10)",
              border:
                "1px solid " +
                (currentStep.found ? "#22c55e" : "#ef4444"),
              color: "var(--color-text)",
            }}
          >
            {currentStep.found
              ? `Path found! ${currentStep.path.length} cells long. ${currentStep.visited.size} cells visited.`
              : "No path exists between start and end."}
          </div>
        )}
      </div>

      {/* ── Legend ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-4">
        {LEGEND.map(({ state, label }) => (
          <div key={state} className="flex items-center gap-1.5">
            <div
              style={{
                width: 14,
                height: 14,
                borderRadius: 3,
                background: getCellBg(state),
                opacity: state === "wall" ? 0.8 : state === "visited" ? 0.5 : 1,
                border: "1px solid var(--color-border)",
                flexShrink: 0,
              }}
            />
            <span
              className="text-xs"
              style={{ color: "var(--color-muted)" }}
            >
              {label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── CtrlBtn ───────────────────────────────────────────────────────────────────

function CtrlBtn({
  children,
  onClick,
  disabled,
  primary,
  style,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  primary?: boolean;
  style?: React.CSSProperties;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      style={{
        background: primary ? "var(--color-accent)" : "var(--color-surface-3)",
        color: primary ? "#fff" : "var(--color-text)",
        border:
          "1px solid " +
          (primary ? "var(--color-accent)" : "var(--color-border)"),
        cursor: disabled ? "not-allowed" : "pointer",
        ...style,
      }}
    >
      {children}
    </button>
  );
}
