"use client";

import React, { useState, useRef, useEffect } from "react";
import { Lock, Unlock } from "lucide-react";
import type { CurveData, CurvePoint, GhostRuns } from "@/lib/benchmark-store";
import { noiseLabel } from "@/lib/benchmark-stats";
import { fmtN, fmtTime, fmtBytes, fmtPredicted } from "./formatters";
import { fitLogLog, BIG_O_REFS, SPACE_BIG_O_REFS, buildEulerLogYTicks, toSup, type FitResult } from "./fit-log-log";
import { chartBtn, CHART_SLOW_IDS, CHART_SLOW_THRESHOLD } from "./chart-ui";

export default function CurveChart({
  data,
  sizes,
  algos,
  algoNames,
  algoColors,
  highlight,
  activeN,
  onNChange,
  mode = "time",
  onExportReady,
  advanced = false,
  ghostRuns,
  ghostMode = false,
}: {
  data: CurveData;
  sizes: number[];
  algos: string[];
  algoNames: Record<string, string>;
  algoColors: Record<string, string>;
  highlight?: string | null;
  activeN?: number | null;
  onNChange?: (n: number | null) => void;
  mode?: "time" | "space" | "ratio" | "space-ratio";
  onExportReady?: (fn: () => void) => void;
  advanced?: boolean;
  /** Per-algo history of prior runs. Drawn underneath the active curve when
   *  ghostMode is true, faded by recency (newest = bright, oldest = dim). */
  ghostRuns?: GhostRuns;
  ghostMode?: boolean;
}) {
  const [locked, setLocked] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [interactMode, setInteractMode] = useState<"brush" | "zoom">("brush");
  const [yZoom, setYZoom] = useState(1.0);           // <1 = zoomed in on y (lower ceiling)
  const [xRange, setXRange] = useState<[number, number] | null>(null); // size indices
  const [dragStart,  setDragStart]  = useState<number | null>(null);
  const [dragCur,    setDragCur]    = useState<number | null>(null);
  const [dragStartY, setDragStartY] = useState<number | null>(null);
  const [dragCurY,   setDragCurY]   = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [pinnedN, setPinnedN] = useState<number | null>(null);
  const [yLogScale, setYLogScale] = useState(false);
  const [showBigORefs, setShowBigORefs] = useState(true);

  // Expose PNG export to parent
  useEffect(() => {
    if (!onExportReady) return;
    onExportReady(() => {
      const svg = svgRef.current;
      if (!svg) return;
      const computed = getComputedStyle(document.documentElement);
      let s = new XMLSerializer().serializeToString(svg);
      s = s.replace(/var\(--([^)]+)\)/g, (_, name) =>
        computed.getPropertyValue(`--${name.trim()}`).trim() || "#000"
      );
      if (!s) return;
      const scale = 2;
      const canvas = document.createElement("canvas");
      canvas.width = VW * scale;
      canvas.height = VH * scale;
      const ctx = canvas.getContext("2d")!;
      ctx.scale(scale, scale);
      const blob = new Blob([s], { type: "image/svg+xml" });
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, VW, VH);
        URL.revokeObjectURL(url);
        const a = document.createElement("a");
        a.href = canvas.toDataURL("image/png");
        a.download = `benchmark-${mode}.png`;
        a.click();
      };
      img.src = url;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onExportReady]);

  // Reset zoom state when locking
  useEffect(() => { if (locked) { setYZoom(1); setXRange(null); } }, [locked]);
  // Reset x-range when the available sizes change
  useEffect(() => { setXRange(null); }, [sizes]);

  // Non-passive wheel listener — always active, zooms X axis centered on cursor.
  // Ctrl+wheel zooms Y axis instead.
  // Constants VW=600, pL=60, iW=418 are inlined to avoid ordering issues.
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (sizes.length < 2) return;
      e.preventDefault();
      if (!e.ctrlKey) {
        setYZoom(prev => Math.max(0.05, Math.min(1, prev * (e.deltaY > 0 ? 1.18 : 1 / 1.18))));
        return;
      }
      const rect = el.getBoundingClientRect();
      const svgX = (e.clientX - rect.left) * (600 / rect.width);
      const curLo = xRange ? xRange[0] : 0;
      const curHi = xRange ? xRange[1] : sizes.length - 1;
      const curSpan = curHi - curLo;
      const frac = Math.max(0, Math.min(1, (svgX - 60) / 418));
      const factor = e.deltaY > 0 ? 1.35 : 1 / 1.35;
      const newSpan = Math.max(1, Math.min(sizes.length - 1, curSpan * factor));
      const center = curLo + frac * curSpan;
      let newLo = Math.round(center - frac * newSpan);
      let newHi = newLo + Math.round(newSpan);
      if (newLo < 0) { newLo = 0; newHi = Math.min(sizes.length - 1, Math.round(newSpan)); }
      if (newHi >= sizes.length) { newHi = sizes.length - 1; newLo = Math.max(0, newHi - Math.round(newSpan)); }
      if (newLo <= 0 && newHi >= sizes.length - 1) setXRange(null);
      else setXRange([newLo, newHi]);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [sizes, xRange]);

  const VW = 600;
  const VH = 360;
  const pL = 60, pR = 122, pT = 15, pB = 42;
  // Extrapolation zone: 36px (non-expanded) — collapses when expanded since projSizes fill iW
  const extraZoneW = expanded ? 0 : 36;
  const iW = VW - pL - pR;
  const iH = VH - pT - pB;

  const visSizes = xRange ? sizes.slice(xRange[0], xRange[1] + 1) : sizes;

  // Projected sizes: 10 steps from 10× to 100× the last measured n (shown when expanded)
  const _globalLastN = (() => {
    let mx = 0;
    for (const id of algos) {
      const pts = (data[id] ?? []).filter(p => visSizes.includes(p.n) && !p.timedOut);
      if (pts.length) mx = Math.max(mx, Math.max(...pts.map(p => p.n)));
    }
    return mx || (visSizes[visSizes.length - 1] ?? 1000);
  })();
  const projSizes = expanded
    ? Array.from({ length: 10 }, (_, i) => _globalLastN * (i + 1) * 10)
    : [];
  const displaySizes = expanded ? [...visSizes, ...projSizes] : visSizes;

  const xAt = (n: number): number => {
    const idx = displaySizes.indexOf(n);
    if (idx < 0) return pL;
    return displaySizes.length === 1 ? pL + iW / 2 : pL + (idx / (displaySizes.length - 1)) * iW;
  };

  const getTime = (p: CurvePoint) => p.timeMs;
  const getValue = (p: CurvePoint) =>
    mode === "space"       ? (p.spaceBytes ?? 0) :
    mode === "ratio"       ? (p.n > 1 ? getTime(p) / (p.n * Math.log2(p.n)) : 0) :
    mode === "space-ratio" ? (p.n > 1 ? (p.spaceBytes ?? 0) / (p.n * Math.log2(p.n)) : 0) :
    getTime(p);
  const fmtY =
    mode === "space" ? fmtBytes :
    mode === "ratio" ? (v: number) => {
      const ns = v * 1e6;
      if (ns >= 1000) return `${(ns / 1000).toFixed(1)}µs`;
      if (ns >= 0.1)  return `${ns.toFixed(ns >= 10 ? 0 : 1)}ns`;
      return `${(ns * 1000).toFixed(0)}ps`;
    } :
    mode === "space-ratio" ? (v: number) => {
      if (v >= 1)    return `${v.toFixed(1)}B`;
      if (v >= 0.01) return `${(v * 1000).toFixed(0)}mB`;
      return `${(v * 1e6).toFixed(0)}µB`;
    } :
    fmtTime;

  // Pre-compute one fit per algo — reused for y-scale extension and tail drawing.
  // Avoids calling fitLogLog twice per algo per render.
  const extraFits = new Map<string, FitResult | null>(
    algos.map(id => {
      const vp = (data[id] ?? [])
        .filter(p => visSizes.includes(p.n) && !p.timedOut && getValue(p) > 0)
        .sort((a, b) => a.n - b.n);
      const fit = vp.length >= 2
        ? fitLogLog(vp.map(p => ({ n: p.n, val: getValue(p) })))
        : null;
      return [id, fit] as [string, FitResult | null];
    })
  );

  // Include capped extrapolated endpoints so the y-axis actually accommodates the projections.
  // Cap at 4× measured max to prevent O(n²) tails from collapsing the rest of the chart.
  const measuredValues = algos.flatMap(id => (data[id] ?? []).filter(p => visSizes.includes(p.n)).map(getValue));
  const measuredMax    = Math.max(...measuredValues, mode === "space" ? 1 : 0.001);
  const extrapValues: number[] = [];
  for (const id of algos) {
    const fit = extraFits.get(id);
    if (!fit) continue;
    const vp = (data[id] ?? []).filter(p => visSizes.includes(p.n) && !p.timedOut && getValue(p) > 0).sort((a, b) => a.n - b.n);
    if (vp.length < 2) continue;
    if (expanded) {
      // Include all valid projected values — y-axis scales to fit them
      for (const pn of projSizes) {
        const ev = fit.k * fit.fn(pn);
        if (isFinite(ev) && ev > 0) extrapValues.push(ev);
      }
    } else {
      const lastN = vp[vp.length - 1].n;
      const ev    = fit.k * fit.fn(lastN * 4);
      if (isFinite(ev) && ev > 0 && ev <= measuredMax * 4) extrapValues.push(ev);
    }
  }

  const allValues = [...measuredValues, ...extrapValues];
  const rawMaxY   = Math.max(...allValues, mode === "space" ? 1 : 0.001);
  const maxY      = rawMaxY * yZoom;
  const minPosY   = Math.max(1e-9, Math.min(...allValues.filter(v => v > 0), rawMaxY));
  const logMinY   = Math.log10(minPosY * 0.5);
  const logMaxY   = Math.log10(maxY);
  const yAt = (v: number): number => {
    if (!yLogScale || v <= 0) return pT + iH - (v / maxY) * iH;
    const lv = Math.log10(Math.max(v, minPosY * 0.1));
    return pT + iH - ((lv - logMinY) / (logMaxY - logMinY)) * iH;
  };

  // Build y-axis ticks — log: decade ticks; linear: 4 evenly spaced
  const yTicks: { v: number; y: number }[] = yLogScale
    ? (() => {
        const ticks: { v: number; y: number }[] = [];
        for (let e = Math.floor(logMinY); e <= Math.ceil(logMaxY); e++) {
          const v = Math.pow(10, e);
          const y = yAt(v);
          if (y >= pT - 2 && y <= pT + iH + 2) ticks.push({ v, y });
        }
        return ticks;
      })()
    : [0.25, 0.5, 0.75, 1].map(f => ({ v: maxY * f, y: yAt(maxY * f) }));

  const eulerYTicks = yLogScale
    ? buildEulerLogYTicks(minPosY * 0.5, maxY, yAt, pT, pT + iH)
    : [];

  const getSvgX = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return ((e.clientX - rect.left) / rect.width) * VW;
  };

  const getSvgY = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return ((e.clientY - rect.top) / rect.height) * VH;
  };

  const snapToSize = (svgX: number) => {
    let best = displaySizes[0], bestDist = Infinity;
    displaySizes.forEach(n => { const d = Math.abs(xAt(n) - svgX); if (d < bestDist) { bestDist = d; best = n; } });
    return best;
  };

  // Effective active n: pinned overrides hover
  const effectiveN = pinnedN ?? activeN;

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const svgX = getSvgX(e);
    if (locked) {
      if (!pinnedN && onNChange && visSizes.length) onNChange(snapToSize(svgX));
      return;
    }
    if (dragStart !== null) {
      setDragCur(svgX);
      if (interactMode === "zoom") setDragCurY(getSvgY(e));
    }
  };

  const handleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!locked) return;
    const svgX = getSvgX(e);
    const n = snapToSize(svgX);
    if (pinnedN === n) {
      setPinnedN(null);
      if (onNChange && visSizes.length) onNChange(n);
    } else {
      setPinnedN(n);
    }
  };

  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if (locked) return;
    e.preventDefault();
    const x = getSvgX(e);
    setDragStart(x); setDragCur(x);
    if (interactMode === "zoom") {
      const y = getSvgY(e);
      setDragStartY(y); setDragCurY(y);
    }
  };

  const clearDrag = () => {
    setDragStart(null); setDragCur(null);
    setDragStartY(null); setDragCurY(null);
  };

  const applyXZoom = (x0: number, x1: number) => {
    if (x1 - x0 <= 8) return;
    const baseStart = xRange?.[0] ?? 0;
    const baseLen   = xRange ? xRange[1] - xRange[0] : sizes.length - 1;
    const f0 = Math.max(0, (x0 - pL) / iW);
    const f1 = Math.min(1, (x1 - pL) / iW);
    const i0 = baseStart + Math.round(f0 * baseLen);
    const i1 = baseStart + Math.round(f1 * baseLen);
    if (i1 > i0) setXRange([i0, Math.min(i1, sizes.length - 1)]);
  };

  const handleMouseUp = () => {
    if (locked || dragStart === null || dragCur === null) { clearDrag(); return; }
    const x0 = Math.min(dragStart, dragCur);
    const x1 = Math.max(dragStart, dragCur);
    if (interactMode === "brush") {
      applyXZoom(x0, x1);
    } else if (dragStartY !== null && dragCurY !== null) {
      // box zoom: zoom x-range + y-range to the selected rectangle
      applyXZoom(x0, x1);
      const y0 = Math.min(dragStartY, dragCurY);
      const y1 = Math.max(dragStartY, dragCurY);
      if (y1 - y0 > 8) {
        // y0 is visually higher = larger value; clamp to data area
        const topVal = Math.max(0, (pT + iH - y0) / iH * maxY);
        if (topVal > 0) setYZoom(prev => Math.max(0.05, (topVal / rawMaxY) * prev));
      }
    }
    clearDrag();
  };

  const selRect = dragStart !== null && dragCur !== null
    ? {
        x: Math.max(pL, Math.min(dragStart, dragCur)),
        w: Math.min(Math.abs(dragCur - dragStart), iW),
        y: interactMode === "zoom" && dragStartY !== null && dragCurY !== null
          ? Math.max(pT, Math.min(dragStartY, dragCurY)) : pT,
        h: interactMode === "zoom" && dragStartY !== null && dragCurY !== null
          ? Math.min(Math.abs(dragCurY - dragStartY), iH) : iH,
      }
    : null;

  const isZoomed = yZoom < 0.99 || xRange !== null;

  // Build sorted bubble data for effectiveN column
  const bubbles = effectiveN != null && visSizes.includes(effectiveN)
    ? algos
        .map(id => ({ id, pt: data[id]?.find(p => p.n === effectiveN) }))
        .filter((x): x is { id: string; pt: CurvePoint } => !!x.pt && !x.pt.timedOut)
        .sort((a, b) => getValue(a.pt) - getValue(b.pt))
    : [];

  // Estimated bubbles for projected sizes (expanded mode)
  const projBubbles = expanded && effectiveN != null && projSizes.includes(effectiveN)
    ? algos
        .flatMap(id => {
          const fit = extraFits.get(id);
          if (!fit) return [];
          const v = fit.k * fit.fn(effectiveN);
          if (!isFinite(v) || v <= 0) return [];
          return [{ id, v }];
        })
        .sort((a, b) => a.v - b.v)
    : [];

  const bigORefs = mode === "space" ? SPACE_BIG_O_REFS : BIG_O_REFS;

  // Per-reference calibration constants — each curve independently fitted to the geometric
  // mean of all measured data, so every complexity class is visible at the right scale.
  // c_i = exp( mean_over_all_pts( log(measured / f_i(n)) ) )
  const bigOCalibMap = (() => {
    const map = new Map<string, number>();
    const allPts: { n: number; v: number }[] = [];
    for (const id of algos) {
      for (const p of (data[id] ?? [])) {
        if (p.timedOut || !visSizes.includes(p.n)) continue;
        const v = mode === "space" ? (p.spaceBytes ?? 0) : (p.meanMs ?? p.timeMs);
        if (v > 0) allPts.push({ n: p.n, v });
      }
    }
    for (const ref of bigORefs) {
      if (!allPts.length) { map.set(ref.id, 0); continue; }
      let logSum = 0, count = 0;
      for (const { n, v } of allPts) {
        const fn = ref.fn(n);
        if (fn > 0) { logSum += Math.log(v / fn); count++; }
      }
      map.set(ref.id, count > 0 ? Math.exp(logSum / count) : 0);
    }
    return map;
  })();
  const bigOCalibC = [...bigOCalibMap.values()].find(v => v > 0) ?? 0; // kept for condition checks

const overlayBtnBase: React.CSSProperties = chartBtn("secondary", {
    fontSize: 9, padding: "2px 5px", borderRadius: 4, background: "var(--color-surface-2)",
  });

  return (
    <div style={{ position: "relative", userSelect: "none" }}>
      <div className="print:hidden" style={{ position: "absolute", top: 20, left: `calc(${(pL / VW * 100).toFixed(2)}% + 10px)`, zIndex: 2, display: "flex", flexDirection: "row", alignItems: "center", gap: 4 }}>
        {/* Lock toggle */}
        <button
          onClick={() => setLocked(l => !l)}
          style={{ ...overlayBtnBase, color: locked ? "var(--color-muted)" : "var(--color-accent)", border: `1px solid ${locked ? "var(--color-border)" : "var(--color-accent)"}` }}
          title={locked ? "Unlock to enable interactions" : "Lock chart"}
        >
          {locked ? <Lock size={8} /> : <Unlock size={8} />}
          {locked ? "locked" : "unlocked"}
        </button>
        {/* Expand toggle — shows 10 projected sizes at 10–100× last measured n */}
        <button
          onClick={() => setExpanded(e => !e)}
          style={{ ...overlayBtnBase, color: expanded ? "var(--color-accent)" : "var(--color-muted)", border: `1px solid ${expanded ? "var(--color-accent)" : "var(--color-border)"}` }}
          title={expanded ? "Collapse to measured range" : "Project 10–100× beyond last measured n"}
        >
          {expanded ? "collapse" : "expand"}
        </button>
        {/* Mode toggle + reset — to the right of lock button when unlocked */}
        {!locked && (
          <>
            <div style={{ display: "flex", borderRadius: 4, overflow: "hidden", border: "1px solid var(--color-border)" }}>
              {(["brush", "zoom"] as const).map(m => (
                <button
                  key={m}
                  onClick={() => setInteractMode(m)}
                  style={chartBtn(interactMode === m ? "primary" : "ghost", {
                    fontSize: 9, padding: "2px 6px", borderRadius: 0,
                    background: interactMode === m ? "var(--color-accent)" : "var(--color-surface-2)",
                  })}
                  title={m === "brush" ? "Drag to select x-range and zoom in" : "Drag or scroll to zoom y-axis"}
                >
                  {m}
                </button>
              ))}
            </div>
            {isZoomed && (
              <button onClick={() => { setYZoom(1); setXRange(null); }} style={{ ...overlayBtnBase, color: "var(--color-muted)" }}>
                reset
              </button>
            )}
          </>
        )}
        {/* Big-O reference overlay toggle */}
        {mode !== "ratio" && mode !== "space-ratio" && (
          <button
            onClick={() => setShowBigORefs(v => !v)}
            style={{ ...overlayBtnBase, color: showBigORefs ? "var(--color-accent)" : "var(--color-muted)", border: `1px solid ${showBigORefs ? "var(--color-accent)" : "var(--color-border)"}` }}
            title={showBigORefs ? "Hide complexity reference curves" : "Show complexity reference curves (O(n), O(n log n), O(n log²n), O(n²))"}
          >
            O(·)
          </button>
        )}
        {/* Log/linear Y toggle */}
        <button
          onClick={() => setYLogScale(v => !v)}
          style={{ ...overlayBtnBase, color: yLogScale ? "var(--color-accent)" : "var(--color-muted)", border: `1px solid ${yLogScale ? "var(--color-accent)" : "var(--color-border)"}` }}
          title={yLogScale ? "Switch to linear Y scale (hides e, e²… grid)" : "Switch to log Y scale — adds Euler e^k reference lines"}
        >
          {yLogScale ? "log" : "lin"}
        </button>
        {/* Pinned crosshair indicator */}
        {pinnedN != null && (
          <button
            onClick={() => setPinnedN(null)}
            style={{ ...overlayBtnBase, color: "var(--color-accent)", border: "1px solid var(--color-accent)" }}
            title="Click to unpin crosshair"
          >
            📌 n={fmtN(pinnedN)}
          </button>
        )}
      </div>
    <svg
      ref={svgRef}
      viewBox={`0 0 ${VW} ${VH}`}
      style={{ width: "100%", height: "auto", aspectRatio: `${VW} / ${VH}`, display: "block", cursor: locked ? "crosshair" : "crosshair" }}
      aria-label={mode === "space" ? "Space usage vs input size per algorithm" : "Performance curve: time vs input size per algorithm"}
      onMouseMove={handleMouseMove}
      onClick={handleClick}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => { if (!pinnedN) onNChange?.(null); clearDrag(); }}
    >
      <defs>
        <clipPath id="inner-plot-clip">
          <rect x={pL} y={pT} width={iW} height={iH} />
        </clipPath>
      </defs>
      {/* horizontal grid + y labels */}
      {yTicks.map(({ v, y }) => (
        <g key={`y10-${v}`}>
          <line x1={pL} y1={y} x2={VW - pR} y2={y}
            stroke="var(--color-border)" strokeWidth={0.6} strokeDasharray="3 3" />
          <text x={pL - 5} y={y + 4} textAnchor="end" fontSize={9}
            fill="var(--color-muted)">{fmtY(v)}</text>
        </g>
      ))}

      {/* Euler's number grid — e, e², e³… when log-y is active (natural-log decades). */}
      {eulerYTicks.map(({ v, y, label }) => (
        <g key={`ye-${label}-${v}`} style={{ pointerEvents: "none" }}>
          <line x1={pL} y1={y} x2={VW - pR} y2={y}
            stroke="#4db6ac" strokeWidth={0.5} strokeDasharray="2 4" opacity={0.45}
            clipPath="url(#inner-plot-clip)" />
          <text x={VW - pR + 3} y={y + 3} textAnchor="start" fontSize={7}
            fontFamily="monospace" fill="#4db6ac" opacity={0.85}>
            {label}
          </text>
          <text x={pL - 5} y={y + 3} textAnchor="end" fontSize={7}
            fontFamily="monospace" fill="#4db6ac" opacity={0.7}>
            {fmtY(v)}
          </text>
        </g>
      ))}

      {/* ── Worst-case zone shading ── */}
      {mode === "time" && (() => {
        const slowAlgos = algos.filter(id => CHART_SLOW_IDS.has(id));
        if (slowAlgos.length === 0 || visSizes.length < 2) return null;
        const threshN = visSizes.find(n => n >= CHART_SLOW_THRESHOLD) ?? visSizes[visSizes.length - 1];
        const x0 = xAt(threshN);
        const x1 = pL + iW;
        if (x1 - x0 < 4) return null;
        return (
          <g style={{ pointerEvents: "none" }}>
            <rect x={x0} y={pT} width={x1 - x0} height={iH}
              fill="rgba(239,68,68,0.06)" clipPath="url(#inner-plot-clip)" />
            <text x={Math.max(x0 + 2, (x0 + x1) / 2)} y={pT + 10} textAnchor="middle" fontSize={7.5}
              fontFamily="monospace" fill="rgba(239,68,68,0.5)" style={{ pointerEvents: "none" }}>
              O(n²) slow zone
            </text>
          </g>
        );
      })()}
      {/* Best-case zone: very small n where even O(n²) is fine */}
      {mode === "time" && visSizes.length >= 2 && (() => {
        const fastBound = visSizes.find(n => n >= 1000) ?? visSizes[visSizes.length - 1];
        const x1 = xAt(fastBound);
        if (x1 - pL < 4) return null;
        return (
          <g style={{ pointerEvents: "none" }}>
            <rect x={pL} y={pT} width={x1 - pL} height={iH}
              fill="rgba(78,124,82,0.05)" clipPath="url(#inner-plot-clip)" />
            <text x={pL + (x1 - pL) / 2} y={pT + 10} textAnchor="middle" fontSize={7.5}
              fontFamily="monospace" fill="rgba(78,124,82,0.4)" style={{ pointerEvents: "none" }}>
              all algos fast
            </text>
          </g>
        );
      })()}

      {/* axes */}
      <line x1={pL} y1={pT} x2={pL} y2={pT + iH} stroke="var(--color-border)" strokeWidth={0.8} />
      <line x1={pL} y1={pT + iH} x2={VW - pR} y2={pT + iH} stroke="var(--color-border)" strokeWidth={0.8} />

      {/* Big-O reference curves + LEFT-anchored ref labels.
          Labels reflect the hovered N (effectiveN) when set, otherwise show
          the projection at the largest measured N. */}
      {showBigORefs && mode !== "ratio" && mode !== "space-ratio" && visSizes.length >= 1 && bigOCalibC > 0 && (() => {
        const maxN  = visSizes[visSizes.length - 1];
        // labelN: what N the left labels report. Tracks the hovered/pinned N when present.
        const labelN = effectiveN ?? maxN;
        const isHovered = effectiveN != null;
        const STEPS = 80;
        // Anchor labels to the LEFT edge of the plot area (just inside)
        const lx    = pL + 6;

        const refY = (refId: string, fn: (n: number) => number, n: number) => {
          const c = bigOCalibMap.get(refId) ?? 0;
          return Math.max(pT, pT + iH - (c * fn(n) / maxY) * iH);
        };

        // Build pool of ONLY Big-O reference labels.
        // Sort descending by value so slowest (n²) is at top, fastest (log n) at bottom —
        // matches the visual order of the curves themselves.
        const pool = bigORefs
          .map((ref, ri) => ({ ri, ref, v: (bigOCalibMap.get(ref.id) ?? 0) * ref.fn(labelN) }))
          .filter(item => isFinite(item.v) && item.v > 0)
          .sort((a, b) => b.v - a.v);

        const labelTop    = pT + 6;
        const labelBottom = pT + iH - 12;
        const total       = pool.length;
        const step        = total > 1 ? (labelBottom - labelTop) / (total - 1) : 0;
        // index 0 (slowest) → top; index n-1 (fastest) → bottom
        const assignedY   = pool.map((_, rank) => labelTop + rank * step);

        // Draw ref curve polylines first (background layer)
        const refPolylines = bigORefs.map(ref => {
          const pts: string[] = [];
          for (let i = 0; i <= STEPS; i++) {
            const t = i / STEPS;
            const x = pL + t * iW;
            const fi = t * (visSizes.length - 1);
            const lo = Math.floor(fi), hi2 = Math.ceil(fi);
            const ft = fi - lo;
            const n  = lo === hi2 ? visSizes[lo] : visSizes[lo] * Math.pow(visSizes[hi2] / visSizes[lo], ft);
            pts.push(`${x.toFixed(1)},${refY(ref.id, ref.fn, n).toFixed(1)}`);
          }
          return (
            <polyline key={`refline-${ref.id}`}
              points={pts.join(" ")}
              fill="none"
              stroke={ref.color}
              strokeWidth={1.5}
              strokeDasharray="5 3"
              opacity={ref.id === "logn" || ref.id === "1" ? 0.9 : 0.65}
              clipPath="url(#inner-plot-clip)"
              style={{ pointerEvents: "none" }}
            />
          );
        });

        // Draw left-anchored ref labels: dashed swatch + "O(n²)  14.3s @ n=1M"
        // When hovering, accent the labels (brighter opacity) to signal they're live.
        const labels = pool.map((item, rank) => {
          const labelY = assignedY[rank];
          const ref    = item.ref;
          const predMs = item.v;
          const clipped = predMs > maxY;
          const valStr = mode === "space" ? fmtBytes(predMs) : fmtPredicted(predMs);
          return (
            <g key={`refl-${ref.id}`} style={{ pointerEvents: "none" }}>
              {/* dashed-line swatch in the ref's color */}
              <line x1={lx} y1={labelY - 2} x2={lx + 12} y2={labelY - 2}
                stroke={ref.color} strokeWidth={1.5} strokeDasharray="4 3" opacity={0.9} />
              <text x={lx + 16} y={labelY} textAnchor="start" fontSize={8}
                fontFamily="monospace" fill={ref.color} opacity={0.95} fontWeight={600}>
                {ref.label}
              </text>
              <text x={lx + 16} y={labelY + 8} textAnchor="start" fontSize={7}
                fontFamily="monospace" fill={ref.color} opacity={isHovered ? 0.95 : 0.65}
                fontWeight={isHovered ? 600 : 400}>
                {clipped ? "↑ " : ""}{valStr} @ n={fmtN(labelN)}
              </text>
            </g>
          );
        });

        return <>{refPolylines}{labels}</>;
      })()}

      {/* Separator — between measured data and projection zone */}
      {visSizes.length >= 2 && (() => {
        const sepX = expanded ? xAt(visSizes[visSizes.length - 1]) : pL + iW;
        return (
          <line
            x1={sepX} y1={pT} x2={sepX} y2={pT + iH}
            stroke="var(--color-border)" strokeWidth={0.8} strokeDasharray="3 3" opacity={0.6}
            style={{ pointerEvents: "none" }}
          />
        );
      })()}

      {/* vertical grid + x tick labels (measured) */}
      {(() => {
        const tickEvery = expanded ? 1 : Math.max(1, Math.ceil(visSizes.length / 5));
        return visSizes.map((n, i) => {
          const x = xAt(n);
          const showLabel = i % tickEvery === 0 || i === visSizes.length - 1;
          return (
            <g key={n}>
              <line x1={x} y1={pT} x2={x} y2={pT + iH}
                stroke="var(--color-border)" strokeWidth={0.4} strokeDasharray="2 5" opacity={0.5} />
              {showLabel && (
                <text x={x} y={VH - pB + 14} textAnchor="middle" fontSize={9}
                  fill="var(--color-muted)">{fmtN(n)}</text>
              )}
            </g>
          );
        });
      })()}
      {/* x label at end of extrapolation zone (non-expanded only) */}
      {!expanded && visSizes.length >= 1 && (() => {
        const lastN = visSizes[visSizes.length - 1];
        const x = pL + iW + extraZoneW;
        return (
          <text key="extrap-end" x={x} y={VH - pB + 14} textAnchor="middle" fontSize={8}
            fill="var(--color-muted)" opacity={0.5}>{fmtN(lastN * 4)}</text>
        );
      })()}
      {/* x tick labels for projected sizes (every other one to avoid clutter) */}
      {expanded && projSizes.map((n, i) => {
        if (i % 2 !== 0) return null; // show every other
        const x = xAt(n);
        return (
          <g key={`proj-${n}`}>
            <line x1={x} y1={pT} x2={x} y2={pT + iH}
              stroke="var(--color-border)" strokeWidth={0.3} strokeDasharray="2 6" opacity={0.3} />
            <text x={x} y={VH - pB + 14} textAnchor="middle" fontSize={7.5}
              fill="var(--color-muted)" opacity={0.6}>{fmtN(n)}</text>
          </g>
        );
      })}

      {/* x-axis label */}
      <text x={pL + iW / 2} y={VH - 3} textAnchor="middle" fontSize={9}
        fill="#ef5350" fontStyle="italic">input size (n)</text>

      {/* y-axis title — rotated */}
      <text
        x={0} y={0}
        transform={`translate(9, ${pT + iH / 2}) rotate(-90)`}
        textAnchor="middle" fontSize={8}
        fill={mode === "space" || mode === "space-ratio" ? "#64b5f6" : "#66bb6a"} fontStyle="italic" fontFamily="monospace"
      >
        {mode === "ratio" ? "t / (n · log₂n)" : mode === "space" ? "memory" : "time"}
      </text>

      {/* Crossover annotations — n where algo A's fitted curve overtakes algo B */}
      {mode !== "ratio" && mode !== "space-ratio" && (() => {
        const ids = algos.filter(id => extraFits.get(id) != null);
        if (ids.length < 2) return null;
        const annotations: { n: number; idA: string; idB: string }[] = [];
        for (let ai = 0; ai < ids.length; ai++) {
          for (let bi = ai + 1; bi < ids.length; bi++) {
            const idA = ids[ai], idB = ids[bi];
            const fA = extraFits.get(idA)!, fB = extraFits.get(idB)!;
            if (!fA || !fB) continue;
            // Crossover: a1·n^b1 = a2·n^b2  →  n = (a2/a1)^(1/(b1−b2))
            const db = fA.exp - fB.exp;
            if (Math.abs(db) < 0.01) continue; // parallel — no crossover
            const crossN = Math.pow(fB.k / fA.k, 1 / db);
            const minN = Math.min(...visSizes), maxN = Math.max(...displaySizes) * 2;
            if (!isFinite(crossN) || crossN <= minN || crossN > maxN) continue;
            // Verify actual ordering flips (handles coefficient direction)
            const preA = fA.k * fA.fn(crossN * 0.5), preB = fB.k * fB.fn(crossN * 0.5);
            const postA = fA.k * fA.fn(crossN * 2), postB = fB.k * fB.fn(crossN * 2);
            if (!((preA < preB && postA > postB) || (preA > preB && postA < postB))) continue;
            annotations.push({ n: crossN, idA, idB });
          }
        }
        return annotations.map(({ n, idA, idB }) => {
          const x = xAt(n);
          if (x < pL || x > pL + iW + extraZoneW) return null;
          const colA = algoColors[idA] ?? "#888", colB = algoColors[idB] ?? "#888";
          return (
            <g key={`cross-${idA}-${idB}`} style={{ pointerEvents: "none" }}>
              <line x1={x} y1={pT + 4} x2={x} y2={pT + iH}
                stroke="rgba(255,255,255,0.18)" strokeWidth={1} strokeDasharray="3 4" />
              {/* X marker */}
              <text x={x} y={pT + 2} textAnchor="middle" fontSize={7.5} fontFamily="monospace"
                fill="rgba(255,255,255,0.55)">✕</text>
              {/* Tooltip on the bottom axis */}
              <text x={x} y={pT + iH + 8} textAnchor="middle" fontSize={6.5} fontFamily="monospace"
                fill={colA} opacity={0.8}>{algoNames[idA]?.split(" ")[0]}</text>
              <text x={x} y={pT + iH + 15} textAnchor="middle" fontSize={6.5} fontFamily="monospace"
                fill="rgba(255,255,255,0.3)">⇄</text>
              <text x={x} y={pT + iH + 22} textAnchor="middle" fontSize={6.5} fontFamily="monospace"
                fill={colB} opacity={0.8}>{algoNames[idB]?.split(" ")[0]}</text>
            </g>
          );
        });
      })()}

      {/* hover / pinned crosshair */}
      {effectiveN != null && (() => {
        const x = xAt(effectiveN);
        return (
          <g style={{ pointerEvents: "none" }}>
            <line x1={x} y1={pT} x2={x} y2={pT + iH}
              stroke={pinnedN != null ? "var(--color-accent)" : "var(--color-text)"}
              strokeWidth={pinnedN != null ? 1.5 : 1} strokeDasharray="3 3"
              opacity={pinnedN != null ? 0.6 : 0.3} />
            {pinnedN != null && (
              <text x={x + 4} y={pT + 9} fontSize={7} fontFamily="monospace"
                fill="var(--color-accent)" opacity={0.8}>📌</text>
            )}
          </g>
        );
      })()}

      {/* Ghost runs — past benchmark results plotted as faded polylines so the
          user can compare against historical timings. Rendered first so the
          active curves overlap them. Opacity scales by recency: oldest ≈ 0.05,
          newest ≈ 0.30. Only the relevant mode is rendered (time vs space). */}
      {ghostMode && ghostRuns && (
        <g style={{ pointerEvents: "none" }} clipPath="url(#inner-plot-clip)">
          {algos.flatMap(id => {
            const runs = ghostRuns[id];
            if (!runs || runs.length === 0) return [];
            const color = algoColors[id] ?? "#888";
            const isHl  = !highlight || highlight === id;
            const total = runs.length;
            return runs.map((run, idx) => {
              // idx=0 is the oldest, idx=total-1 is the newest.
              // Linear fade from 90% (newest) down toward 5% (oldest), spread
              // evenly across the stored runs so the relative ordering is
              // visually obvious even at the full GHOST_MAX of 100 entries.
              const ageFactor = (idx + 1) / total; // 1/n .. 1
              const opacity = (0.05 + 0.85 * ageFactor) * (isHl ? 1 : 0.25);
              // Build the polyline using the ghost run's (n, value) points.
              const sorted = [...run.points].sort((a, b) => a.n - b.n);
              const pts: string[] = [];
              for (const p of sorted) {
                const val = mode === "space"       ? (p.spaceBytes ?? 0)
                          : mode === "ratio"       ? (p.n > 1 ? (p.meanMs ?? p.timeMs) / (p.n * Math.log2(p.n)) : 0)
                          : mode === "space-ratio" ? (p.n > 1 ? (p.spaceBytes ?? 0) / (p.n * Math.log2(p.n)) : 0)
                          : (p.meanMs ?? p.timeMs);
                if (val <= 0) continue;
                pts.push(`${xAt(p.n).toFixed(1)},${yAt(val).toFixed(1)}`);
              }
              if (pts.length < 2) return null;
              return (
                <polyline
                  key={`ghost-${id}-${run.ts}`}
                  points={pts.join(" ")}
                  fill="none"
                  stroke={color}
                  strokeWidth={1}
                  strokeDasharray="2 2"
                  opacity={opacity}
                />
              );
            });
          })}
        </g>
      )}

      {/* variance error bands — rendered before curves so lines draw on top */}
      {algos.map(id => {
        const pts = [...(data[id] ?? [])].sort((a, b) => a.n - b.n).filter(p => !p.timedOut && p.meanMs != null && p.stdDev != null && p.stdDev > 0);
        if (pts.length < 2) return null;
        const color = algoColors[id] ?? "#888";
        const isHl = !highlight || highlight === id;
        const upper = pts.map(p => `${xAt(p.n).toFixed(1)},${Math.max(pT, yAt(p.meanMs! - p.stdDev!)).toFixed(1)}`);
        const lower = [...pts].reverse().map(p => `${xAt(p.n).toFixed(1)},${Math.min(pT + iH, yAt(p.meanMs! + p.stdDev!)).toFixed(1)}`);
        return (
          <polygon key={`band-${id}`}
            points={[...upper, ...lower].join(" ")}
            fill={color} opacity={isHl ? 0.10 : 0.03}
            style={{ pointerEvents: "none", transition: "opacity 0.2s ease" }}
            clipPath="url(#inner-plot-clip)"
          />
        );
      })}

      {/* stdDev error bar whiskers — vertical lines with horizontal end caps */}
      {algos.map(id => {
        const pts = [...(data[id] ?? [])].sort((a, b) => a.n - b.n)
          .filter(p => !p.timedOut && p.stdDev != null && p.stdDev > 0 && p.meanMs != null);
        if (pts.length === 0) return null;
        const color = algoColors[id] ?? "#888";
        const isHl = !highlight || highlight === id;
        return (
          <g key={`errbar-${id}`} opacity={isHl ? 0.55 : 0.1} clipPath="url(#inner-plot-clip)" style={{ pointerEvents: "none" }}>
            {pts.map(p => {
              const cx = xAt(p.n);
              const yTop = Math.max(pT, yAt(p.meanMs! - p.stdDev!));
              const yBot = Math.min(pT + iH, yAt(p.meanMs! + p.stdDev!));
              const capW = 3;
              return (
                <g key={p.n}>
                  <line x1={cx} y1={yTop} x2={cx} y2={yBot} stroke={color} strokeWidth={1.2} />
                  <line x1={cx - capW} y1={yTop} x2={cx + capW} y2={yTop} stroke={color} strokeWidth={1.2} />
                  <line x1={cx - capW} y1={yBot} x2={cx + capW} y2={yBot} stroke={color} strokeWidth={1.2} />
                </g>
              );
            })}
          </g>
        );
      })}

      {/* variance timeline — individual round dots, one per (n, round) */}
      {algos.map(id => {
        const pts = [...(data[id] ?? [])].sort((a, b) => a.n - b.n)
          .filter(p => !p.timedOut && p.roundTimes && p.roundTimes.length > 1);
        if (pts.length === 0) return null;
        const color = algoColors[id] ?? "#888";
        const isHl = !highlight || highlight === id;
        return (
          <g key={`rounds-${id}`} opacity={isHl ? 1 : 0.15} clipPath="url(#inner-plot-clip)" style={{ pointerEvents: "none" }}>
            {pts.flatMap(p =>
              p.roundTimes!.map((t, ri) => {
                const cx = xAt(p.n);
                const cy = Math.max(pT, Math.min(pT + iH, yAt(mode === "ratio" ? (p.n > 1 ? t / (p.n * Math.log2(p.n)) : 0) : t)));
                const isBest = t === p.timeMs;
                return (
                  <circle
                    key={`${p.n}-${ri}`}
                    cx={cx} cy={cy}
                    r={isBest ? 3 : 2}
                    fill={isBest ? color : "none"}
                    stroke={color}
                    strokeWidth={isBest ? 0 : 0.8}
                    opacity={isBest ? 0.9 : 0.45}
                  />
                );
              })
            )}
          </g>
        );
      })}

      {/* curves + dots */}
      {algos.map(id => {
        const pts = [...(data[id] ?? [])].sort((a, b) => a.n - b.n);
        if (!pts.length) return null;
        const color = algoColors[id] ?? "#888";
        const isHl = !highlight || highlight === id;
        const sw = isHl && highlight ? 2.5 : 1.75;

        // ── Extrapolation tail / projected curve ────────────────────────────
        const validPts = pts.filter(p => !p.timedOut && getValue(p) > 0);
        let extraTail: React.ReactNode = null;

        if (validPts.length >= 2 && visSizes.length >= 2) {
          const fit = extraFits.get(id);
          if (fit) {
            // log rate: empirical power-law exponent from data; fitted: same from fit shape
            const firstPt = validPts[0];
            const lastPt  = validPts[validPts.length - 1];
            const lnRatio = Math.log(lastPt.n / firstPt.n);
            const actualLogRate = lnRatio > 0
              ? Math.log(getValue(lastPt) / getValue(firstPt)) / lnRatio
              : 0;
            const fittedLogRate = lnRatio > 0 && fit.fn(firstPt.n) > 0
              ? Math.log(fit.fn(lastPt.n) / fit.fn(firstPt.n)) / lnRatio
              : 0;
            const tailOp = Math.max(0, Math.min(1, actualLogRate > 0 ? 1 : 0));
            const tailLabel = `n${toSup(actualLogRate.toFixed(2))}`;

            if (expanded && projSizes.length > 0) {
              // ── Expanded mode: draw projected curve using actual projSizes x positions ──
              const lastValidPt = validPts[validPts.length - 1];
              const connX = xAt(lastValidPt.n);
              const connY = Math.max(pT, Math.min(pT + iH, yAt(getValue(lastValidPt))));

              const projPts = projSizes.map(pn => {
                const v = fit.k * fit.fn(pn);
                const y = isFinite(v) && v > 0
                  ? Math.max(pT, Math.min(pT + iH, yAt(v)))
                  : null;
                return { n: pn, v, x: xAt(pn), y };
              });
              const validProj = projPts.filter((p): p is typeof p & { y: number } => p.y !== null);

              // Build segment list starting from the last measured point
              const segPts = [{ x: connX, y: connY }, ...validProj];

              extraTail = (
                <g style={{ pointerEvents: "none" }}>
                  {segPts.slice(1).map((pt, i) => (
                    <line key={i}
                      x1={segPts[i].x} y1={segPts[i].y}
                      x2={pt.x}        y2={pt.y}
                      stroke={color} strokeWidth={1.1}
                      strokeDasharray="4 3"
                      opacity={tailOp}
                      strokeLinecap="round"
                    />
                  ))}
                  {validProj.map((pp, i) => {
                    const isActive = effectiveN === pp.n;
                    return (
                    <g key={i}>
                      <circle cx={pp.x} cy={pp.y} r={isActive ? 4.5 : 3}
                        fill="var(--color-surface-2)"
                        stroke={color} strokeWidth={isActive ? 1.8 : 1.2}
                        opacity={tailOp + 0.1}
                        style={{ transition: "r 0.1s ease" }}
                      />
                      {/* value label every other point */}
                      {i % 2 === 1 && (
                        <text x={pp.x} y={pp.y - 5} textAnchor="middle"
                          fontSize={6} fontFamily="monospace"
                          fill={color} opacity={Math.min(1, tailOp + 0.2)}
                        >
                          {fmtY(pp.v)}
                        </text>
                      )}
                    </g>
                  );
                  })}
                  {/* rate badge at last projected point */}
                  {validProj.length > 0 && (() => {
                    const last = validProj[validProj.length - 1];
                    return (
                      <text x={last.x} y={last.y - 7} textAnchor="middle"
                        fontSize={6.5} fontFamily="monospace"
                        fill={color} opacity={Math.min(1, tailOp + 0.2)}
                      >
                        {tailLabel}
                      </text>
                    );
                  })()}
                </g>
              );
            } else if (!expanded) {
              // ── Non-expanded mode: narrow 4× extrapolation zone tail ──
              const lastN   = validPts[validPts.length - 1].n;
              const lastVal = getValue(validPts[validPts.length - 1]);
              const x0      = pL + iW;
              const x1      = pL + iW + extraZoneW;
              const STEPS   = 16;
              const tpts: string[] = [`${x0.toFixed(1)},${yAt(lastVal).toFixed(1)}`];
              for (let s = 1; s <= STEPS; s++) {
                const t  = s / STEPS;
                const n  = lastN * Math.pow(4, t);
                const v  = fit.k * fit.fn(n);
                const ex = x0 + t * (x1 - x0);
                const ey = Math.max(pT, Math.min(pT + iH, yAt(v)));
                tpts.push(`${ex.toFixed(1)},${ey.toFixed(1)}`);
              }
              const endV = fit.k * fit.fn(lastN * 4);
              const endY = Math.max(pT + 4, Math.min(pT + iH - 4, yAt(endV)));
              extraTail = (
                <g style={{ pointerEvents: "none" }}>
                  <polyline points={tpts.join(" ")} fill="none"
                    stroke={color} strokeWidth={1.1} strokeDasharray="2 2" opacity={tailOp} />
                  <text x={x1 - 1} y={endY - 3} textAnchor="end"
                    fontSize={6.5} fontFamily="monospace"
                    fill={color} opacity={Math.min(1, tailOp + 0.15)}
                  >
                    {tailLabel}
                  </text>
                </g>
              );
            }
          }
        }

        return (
          <g key={id} opacity={isHl ? 1 : 0.12} style={{ transition: "opacity 0.2s ease" }}>
            <g clipPath="url(#inner-plot-clip)">
              {pts.slice(1).map((p, i) => {
                const prev = pts[i];
                const dashed = prev.timedOut || p.timedOut;
                return (
                  <line key={p.n}
                    x1={xAt(prev.n)} y1={yAt(getValue(prev))}
                    x2={xAt(p.n)}   y2={yAt(getValue(p))}
                    stroke={color} strokeWidth={sw}
                    strokeDasharray={dashed ? "5 3" : undefined}
                    strokeLinecap="round"
                  />
                );
              })}
              {pts.map(p => {
                const cx = xAt(p.n), cy = yAt(getValue(p));
                const isActive = effectiveN != null && p.n === effectiveN;
                if (p.timedOut) {
                  const r = 4;
                  return (
                    <g key={p.n}>
                      <circle cx={cx} cy={cy} r={r + 1.5}
                        fill="var(--color-surface-2)" stroke={color} strokeWidth={1.5} />
                      <line x1={cx - r + 1} y1={cy - r + 1} x2={cx + r - 1} y2={cy + r - 1}
                        stroke={color} strokeWidth={1.5} strokeLinecap="round" />
                      <line x1={cx + r - 1} y1={cy - r + 1} x2={cx - r + 1} y2={cy + r - 1}
                        stroke={color} strokeWidth={1.5} strokeLinecap="round" />
                    </g>
                  );
                }
                return (
                  <circle key={p.n} cx={cx} cy={cy}
                    r={isActive ? 5 : 3.5}
                    fill={color}
                    stroke="var(--color-surface-2)"
                    strokeWidth={isActive ? 2 : 1.5}
                    style={{ transition: "r 0.1s ease" }}
                  />
                );
              })}
            </g>
            {extraTail}
          </g>
        );
      })}

      {/* data bubbles — rendered last so they float above curves */}
      {bubbles.length > 0 && effectiveN != null && (() => {
        const cx = xAt(effectiveN);
        const PAD = 10;
        const n = bubbles.length;
        const sorted = [...bubbles].sort((a, b) => yAt(getValue(a.pt)) - yAt(getValue(b.pt)));
        const maxPerCol = Math.max(1, Math.floor(iH / 11));
        const useColumns = n > maxPerCol;

        if (useColumns) {
          // Horizontal column layout: actual measurements extend RIGHT from crosshair
          const BH = 10, fs = 7, COL_W = 105;
          const goRight = cx <= VW * 0.65;
          return (
            <g style={{ pointerEvents: "none" }}>
              {sorted.map(({ id, pt }, i) => {
                const col = Math.floor(i / maxPerCol);
                const posInCol = i % maxPerCol;
                const colSize = Math.min(maxPerCol, n - col * maxPerCol);
                const dotCy = yAt(getValue(pt));
                const labelCy = colSize <= 1 ? pT + iH / 2
                  : pT + 5 + (iH - 10) * posInCol / (colSize - 1);
                const color = algoColors[id] ?? "#888";
                const tVal = mode === "space" ? fmtBytes(pt.spaceBytes ?? 0) : fmtTime(pt.timeMs);
                const stdStr = mode !== "space" && pt.stdDev != null ? ` ±${fmtTime(pt.stdDev)}` : "";
                const p95Str = mode !== "space" && pt.p95Ms != null ? ` · p95 ${fmtTime(pt.p95Ms)}` : "";
                const noise = mode !== "space" && pt.noiseCv != null && pt.noiseCv > 0 ? noiseLabel(pt.noiseCv) : null;
                const label = `${algoNames[id]}  ${tVal}${stdStr}${p95Str}${noise ? ` · ${noise.label}` : ""}`;
                const bw = label.length * (fs * 0.58) + PAD;
                const bx = goRight ? cx + 10 + col * COL_W : cx - 10 - (col + 1) * COL_W;
                const by = labelCy - BH / 2;
                return (
                  <g key={id}>
                    <line x1={cx} y1={dotCy} x2={goRight ? bx : bx + bw}
                      y2={labelCy} stroke={color} strokeWidth={0.7} opacity={0.35} />
                    <rect x={bx} y={by} width={bw} height={BH} rx={2} fill={color} opacity={0.93} />
                    <text x={bx + 3} y={by + BH - 2} fontSize={fs} fontWeight={700}
                      fill="#fff" style={{ letterSpacing: "0.01em" }}>
                      {algoNames[id]}  {tVal}{stdStr && <tspan opacity={0.75} fontWeight={400}>{stdStr}</tspan>}
                    </text>
                    <circle cx={cx} cy={dotCy} r={4} fill={color}
                      stroke="var(--color-surface-2)" strokeWidth={1.5} />
                  </g>
                );
              })}
            </g>
          );
        }

        // Vertical spread
        const BH = Math.max(10, Math.min(16, n <= 1 ? 16 : Math.floor((iH - (n - 1)) / n)));
        const fs = BH >= 14 ? 9.5 : BH >= 12 ? 8.5 : 7;
        const flipRight = cx > VW * 0.6;
        const spreadCy = sorted.map((_, i) =>
          n === 1 ? pT + iH / 2 : pT + BH / 2 + (iH - BH) * i / (n - 1)
        );
        return (
          <g style={{ pointerEvents: "none" }}>
            {sorted.map(({ id, pt }, i) => {
              const dotCy = yAt(getValue(pt));
              const labelCy = spreadCy[i];
              const color = algoColors[id] ?? "#888";
              const tVal = mode === "space" ? fmtBytes(pt.spaceBytes ?? 0) : fmtTime(pt.timeMs);
              const stdStr = mode !== "space" && pt.stdDev != null ? ` ±${fmtTime(pt.stdDev)}` : "";
              const p95Str = mode !== "space" && pt.p95Ms != null ? ` · p95 ${fmtTime(pt.p95Ms)}` : "";
              const noise = mode !== "space" && pt.noiseCv != null && pt.noiseCv > 0 ? noiseLabel(pt.noiseCv) : null;
              const label = `${algoNames[id]}  ${tVal}${stdStr}${p95Str}${noise ? ` · ${noise.label}` : ""}`;
              const bw = label.length * (fs * 0.58) + PAD;
              const bx = flipRight ? cx - bw - 10 : cx + 10;
              const by = labelCy - BH / 2;
              return (
                <g key={id}>
                  <line x1={cx} y1={dotCy} x2={flipRight ? bx + bw : bx}
                    y2={labelCy} stroke={color} strokeWidth={0.8} opacity={0.35} />
                  <rect x={bx} y={by} width={bw} height={BH} rx={3}
                    fill={color} opacity={0.93} />
                  <text x={bx + 4} y={by + BH - 3} fontSize={fs} fontWeight={700}
                    fill="#fff" style={{ letterSpacing: "0.01em" }}>
                    {algoNames[id]}  {tVal}{stdStr && <tspan opacity={0.75} fontWeight={400}>{stdStr}</tspan>}
                  </text>
                  <circle cx={cx} cy={dotCy} r={4} fill={color}
                    stroke="var(--color-surface-2)" strokeWidth={1.5} />
                </g>
              );
            })}
          </g>
        );
      })()}
      {/* Estimated bubbles for projected sizes */}
      {projBubbles.length > 0 && effectiveN != null && (() => {
        const cx = xAt(effectiveN);
        const PAD = 10;
        const sorted = [...projBubbles].sort((a, b) => yAt(a.v) - yAt(b.v));
        const n = sorted.length;
        const maxPerCol = Math.max(1, Math.floor(iH / 11));
        const useColumns = n > maxPerCol;

        if (useColumns) {
          const BH = 10, fs = 7, COL_W = 105;
          const goRight = cx <= VW * 0.65;
          return (
            <g style={{ pointerEvents: "none" }}>
              {sorted.map(({ id, v }, i) => {
                const col = Math.floor(i / maxPerCol);
                const posInCol = i % maxPerCol;
                const colSize = Math.min(maxPerCol, n - col * maxPerCol);
                const dotCy = Math.max(pT + 8, Math.min(pT + iH - 8, yAt(v)));
                const labelCy = colSize <= 1 ? pT + iH / 2
                  : pT + 5 + (iH - 10) * posInCol / (colSize - 1);
                const color = algoColors[id] ?? "#888";
                const label = `${algoNames[id]}  ~est: ${fmtY(v)}`;
                const bw = label.length * (fs * 0.58) + PAD;
                const bx = goRight ? cx + 10 + col * COL_W : cx - 10 - (col + 1) * COL_W;
                const by = labelCy - BH / 2;
                return (
                  <g key={id}>
                    <line x1={cx} y1={dotCy} x2={goRight ? bx : bx + bw}
                      y2={labelCy} stroke={color} strokeWidth={0.7} opacity={0.4} />
                    <rect x={bx} y={by} width={bw} height={BH} rx={2}
                      fill={color} opacity={0.7} stroke={color} strokeWidth={1} strokeDasharray="3 2" />
                    <text x={bx + 3} y={by + BH - 2} fontSize={fs} fontWeight={700}
                      fill="#fff" style={{ letterSpacing: "0.01em" }}>
                      {label}
                    </text>
                    <circle cx={cx} cy={dotCy} r={4.5}
                      fill="var(--color-surface-2)" stroke={color} strokeWidth={2} />
                  </g>
                );
              })}
            </g>
          );
        }

        const BH = Math.max(10, Math.min(16, n <= 1 ? 16 : Math.floor((iH - (n - 1)) / n)));
        const fs = BH >= 14 ? 9.5 : BH >= 12 ? 8.5 : 7;
        const flipRight = cx > VW * 0.6;
        const spreadCy = sorted.map((_, i) =>
          n === 1 ? pT + iH / 2 : pT + BH / 2 + (iH - BH) * i / (n - 1)
        );
        return (
          <g style={{ pointerEvents: "none" }}>
            {sorted.map(({ id, v }, i) => {
              const dotCy = Math.max(pT + 8, Math.min(pT + iH - 8, yAt(v)));
              const labelCy = spreadCy[i];
              const color = algoColors[id] ?? "#888";
              const label = `${algoNames[id]}  ~est: ${fmtY(v)}`;
              const bw = label.length * (fs * 0.58) + PAD;
              const bx = flipRight ? cx - bw - 10 : cx + 10;
              const by = labelCy - BH / 2;
              return (
                <g key={id}>
                  <line x1={cx} y1={dotCy} x2={flipRight ? bx + bw : bx}
                    y2={labelCy} stroke={color} strokeWidth={0.8} opacity={0.4} />
                  <rect x={bx} y={by} width={bw} height={BH} rx={3}
                    fill={color} opacity={0.7}
                    stroke={color} strokeWidth={1} strokeDasharray="3 2" />
                  <text x={bx + 4} y={by + BH - 3} fontSize={fs} fontWeight={700}
                    fill="#fff" style={{ letterSpacing: "0.01em" }}>
                    {label}
                  </text>
                  <circle cx={cx} cy={dotCy} r={4.5}
                    fill="var(--color-surface-2)" stroke={color} strokeWidth={2} />
                </g>
              );
            })}
          </g>
        );
      })()}

      {/* Big-O hover bubbles removed — left-side reference labels are the
          single source of truth for projected Big-O values. */}

      {/* Selection rect (brush = full height, zoom = box) */}
      {selRect && (
        <rect x={selRect.x} y={selRect.y} width={selRect.w} height={selRect.h}
          fill="var(--color-accent)" opacity={0.12}
          stroke="var(--color-accent)" strokeWidth={1}
          style={{ pointerEvents: "none" }} />
      )}
    </svg>
    </div>
  );
}
