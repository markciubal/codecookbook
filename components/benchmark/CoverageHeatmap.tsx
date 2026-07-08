"use client";

/**
 * Coverage heatmap for the permutation feature's spread + budget strategies.
 *
 * Renders the (algo × n) grid with cell color encoding sample count or CI
 * tightness depending on `mode`:
 *   - spread:  green saturation = samples / samplesPerCell. Saturated cells
 *              get a red dash overlay; un-probed cells stay neutral.
 *   - budget:  green saturation = 1 - (CI ratio / target). Tight (converged)
 *              cells go solid green; cells still wide stay pale; saturated /
 *              capped cells get an indicator.
 *
 * Hover gives full per-cell stats (samples, mean ± CI, range) in a tooltip.
 *
 * Why a separate component (not inline in BenchmarkVisualizer): the grid
 * rendering is ~80 lines of layout math + tooltip wiring, and we want to be
 * able to drop it into the SessionMatrix / DetailedSessionLog views later
 * without dragging the BenchmarkVisualizer closure along.
 */

import { useState } from "react";
import * as PermStrategy from "@/lib/permutation-strategies";

interface Props {
  grid: PermStrategy.GridCell[];
  mode: "spread" | "budget";
  samplesPerCell: number;
  budgetTargetCI: number;
  budgetMinSamples: number;
  budgetMaxSamples: number;
  algoNames: Record<string, string>;
  algoColors: Record<string, string>;
}

interface HoverState {
  algo: string;
  n: number;
  samples: number;
  mean: number;
  halfWidth: number;
  ratio: number;
  min: number;
  max: number;
  saturated: boolean;
  x: number;
  y: number;
}

function formatMs(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "—";
  if (ms < 1) return `${(ms * 1000).toFixed(0)}µs`;
  if (ms < 100) return `${ms.toFixed(2)}ms`;
  if (ms < 1000) return `${ms.toFixed(1)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function formatN(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}k`;
  return `${n}`;
}

export default function CoverageHeatmap({
  grid,
  mode,
  samplesPerCell,
  budgetTargetCI,
  budgetMinSamples,
  budgetMaxSamples,
  algoNames,
  algoColors,
}: Props) {
  const [hover, setHover] = useState<HoverState | null>(null);

  if (grid.length === 0) {
    return (
      <p className="text-[10px]" style={{ color: "var(--color-muted)", fontFamily: "monospace" }}>
        Grid pending — start the permutation run to build coverage.
      </p>
    );
  }

  // Index by algo + n. Algos in stable order (insertion order from grid).
  const algos: string[] = [];
  const seenAlgos = new Set<string>();
  const ns: number[] = [];
  const seenNs = new Set<number>();
  for (const c of grid) {
    if (!seenAlgos.has(c.algo)) { seenAlgos.add(c.algo); algos.push(c.algo); }
    if (!seenNs.has(c.n))       { seenNs.add(c.n);       ns.push(c.n); }
  }
  ns.sort((a, b) => a - b);

  const cellByKey = new Map<string, PermStrategy.GridCell>();
  for (const c of grid) cellByKey.set(`${c.algo}|${c.n}`, c);

  // Visual sizing: each cell needs to hold a 2-digit sample count at 11px
  // and still leave breathing room around it. Bumped from 32×22 → 36×26 so
  // the count text isn't crowded into the cell border. labelW + headerH
  // also grew proportionally to fit the larger fonts below.
  const cellW = 36;
  const cellH = 26;
  const labelW = 104;
  const headerH = 22;
  const tableW = labelW + ns.length * cellW;
  const tableH = headerH + algos.length * cellH;

  // Color picker per mode. Returns a CSS color string. Pale → vivid as the
  // cell's "quality" improves (more samples / tighter CI).
  function cellFill(c: PermStrategy.GridCell): string {
    if (c.stats.n === 0) return "var(--color-surface-1)";
    let t: number;
    if (mode === "spread") {
      t = Math.min(1, c.stats.n / samplesPerCell);
    } else {
      if (c.stats.n < budgetMinSamples) {
        t = 0.15 + 0.15 * (c.stats.n / budgetMinSamples);
      } else {
        const ratio = PermStrategy.confidenceInterval(c.stats).ratio;
        // ratio at target → t=1; ratio at 4×target → t=0.3.
        const conv = budgetTargetCI / Math.max(ratio, budgetTargetCI);
        t = 0.3 + 0.7 * conv;
      }
    }
    // Green tint with adjustable alpha — surface-aware so cells read on
    // both light + dark themes without conditional CSS.
    return `rgba(56, 142, 60, ${0.15 + 0.6 * t})`;
  }

  // Saturation overlay — red dashes for cells that timed out.
  function isSaturated(c: PermStrategy.GridCell): boolean { return c.saturated; }

  return (
    <div className="flex flex-col gap-1.5" style={{ fontFamily: "monospace", fontSize: 10 }}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--color-muted)" }}>
          Coverage · {mode === "spread" ? `${samplesPerCell} samples/cell` : `±${(budgetTargetCI * 100).toFixed(0)}% CI target, ${budgetMinSamples}–${budgetMaxSamples} samples`}
        </p>
        <p className="text-[9px]" style={{ color: "var(--color-muted)" }}>
          {grid.filter(c => c.stats.n > 0).length}/{grid.length} cells probed
        </p>
      </div>
      <div className="relative" style={{ width: tableW, maxWidth: "100%", overflowX: "auto" }}>
        <svg
          width={tableW}
          height={tableH}
          style={{ display: "block" }}
          onMouseLeave={() => setHover(null)}
        >
          {/* Column headers (n values) */}
          {ns.map((n, i) => (
            <text
              key={`hn-${n}`}
              x={labelW + i * cellW + cellW / 2}
              y={headerH - 6}
              textAnchor="middle"
              fontSize={11}
              fontWeight={600}
              fill="var(--color-muted)"
            >
              {formatN(n)}
            </text>
          ))}
          {/* Rows */}
          {algos.map((a, rowIdx) => {
            const rowY = headerH + rowIdx * cellH;
            return (
              <g key={a}>
                {/* Algo label */}
                <text
                  x={labelW - 6}
                  y={rowY + cellH / 2 + 4}
                  textAnchor="end"
                  fontSize={12}
                  fill={algoColors[a] ?? "var(--color-text)"}
                  fontWeight={700}
                >
                  {(algoNames[a] ?? a).slice(0, 13)}
                </text>
                {ns.map((n, colIdx) => {
                  const c = cellByKey.get(`${a}|${n}`);
                  if (!c) return null;
                  const x = labelW + colIdx * cellW;
                  const fill = cellFill(c);
                  const ci = PermStrategy.confidenceInterval(c.stats);
                  return (
                    <g key={`${a}-${n}`}>
                      <rect
                        x={x + 1}
                        y={rowY + 1}
                        width={cellW - 2}
                        height={cellH - 2}
                        fill={fill}
                        stroke="var(--color-border)"
                        strokeWidth={0.5}
                        onMouseEnter={(e) => setHover({
                          algo: a, n,
                          samples: c.stats.n,
                          mean: c.stats.mean,
                          halfWidth: ci.halfWidth,
                          ratio: ci.ratio,
                          min: c.stats.min,
                          max: c.stats.max,
                          saturated: c.saturated,
                          x: e.clientX, y: e.clientY,
                        })}
                      />
                      {/* Sample count overlay. Bold + larger so the value
                          reads against the green cell fill without needing
                          to hover. text-outline gives a halo so the number
                          stays legible even on the darkest green tier. */}
                      {c.stats.n > 0 && (
                        <text
                          x={x + cellW / 2}
                          y={rowY + cellH / 2 + 4}
                          textAnchor="middle"
                          fontSize={12}
                          fontWeight={700}
                          fill="var(--color-text)"
                          stroke="var(--color-bg)"
                          strokeWidth={2.5}
                          paintOrder="stroke fill"
                          style={{ pointerEvents: "none" }}
                        >
                          {c.stats.n}
                        </text>
                      )}
                      {/* Saturation indicator — diagonal slash for timed-out
                          cells. Sits over the count so the user can see both. */}
                      {isSaturated(c) && (
                        <line
                          x1={x + 2}
                          y1={rowY + cellH - 2}
                          x2={x + cellW - 2}
                          y2={rowY + 2}
                          stroke="var(--color-state-swap)"
                          strokeWidth={1.5}
                          style={{ pointerEvents: "none" }}
                        />
                      )}
                    </g>
                  );
                })}
              </g>
            );
          })}
        </svg>
        {hover && (
          <div
            style={{
              position: "fixed",
              left: hover.x + 12,
              top: hover.y + 12,
              background: "var(--color-surface-3)",
              border: "1px solid var(--color-border)",
              borderRadius: 4,
              padding: "6px 8px",
              fontSize: 10,
              fontFamily: "monospace",
              zIndex: 100,
              pointerEvents: "none",
              minWidth: 180,
              boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
            }}
          >
            <div style={{ fontWeight: 600, color: algoColors[hover.algo] ?? "var(--color-text)" }}>
              {algoNames[hover.algo] ?? hover.algo} · n={formatN(hover.n)}
            </div>
            <div style={{ color: "var(--color-muted)" }}>
              samples: {hover.samples}
              {hover.saturated && <span style={{ color: "var(--color-state-swap)", marginLeft: 6 }}>· saturated</span>}
            </div>
            {hover.samples > 0 && (
              <>
                <div>mean: {formatMs(hover.mean)}</div>
                {hover.samples >= 2 && Number.isFinite(hover.halfWidth) && (
                  <div>± {formatMs(hover.halfWidth)} ({(hover.ratio * 100).toFixed(1)}%)</div>
                )}
                <div style={{ color: "var(--color-muted)" }}>
                  range: {formatMs(hover.min)} – {formatMs(hover.max)}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
