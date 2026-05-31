"use client";

import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import type { GhostRuns } from "@/lib/benchmark-store";
import { GHOST_MAX } from "@/lib/benchmark-store";
import { fmtN, fmtTime, fmtBytes } from "./formatters";
import { blendHex, hexAlpha, kbdStyle, project3D } from "./chart3d-utils";

type Chart3DPoint = { id: string; n: number; t: number; s: number; x: number; y: number; z: number; work?: number };

type Curve3DData = Record<string, { n: number; timeMs: number; spaceBytes?: number; timedOut?: boolean }[]>;

export type Chart3DProps =
  | {
      variant?: "live";
      data: Curve3DData;
      algos: string[];
      highlight: string | null;
      algoNames: Record<string, string>;
      algoColors: Record<string, string>;
    }
  | {
      variant: "history";
      current: Curve3DData;
      ghostRuns: GhostRuns;
      algos: string[];
      algoNames: Record<string, string>;
      algoColors: Record<string, string>;
    };

export default function Chart3D(props: Chart3DProps) {
  if (props.variant === "history") {
    return <Chart3DHistoryView {...props} />;
  }
  return <Chart3DLive {...props} />;
}

function Chart3DLive({
  data, algos, highlight, algoNames, algoColors,
}: {
  data: Record<string, { n: number; timeMs: number; spaceBytes?: number; timedOut?: boolean }[]>;
  algos: string[];
  highlight: string | null;
  algoNames: Record<string, string>;
  algoColors: Record<string, string>;
}) {
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const [rotX, setRotX]         = useState(28);
  const [rotY, setRotY]         = useState(-40);
  const [zoom, setZoom]         = useState(1.0);
  const [tool, setTool]         = useState<"orbit" | "measure" | "shadows">("measure");
  const [showSurface, setShowSurface] = useState(false);
  const [hoverInfo, setHoverInfo] = useState<(Chart3DPoint & { sx: number; sy: number }) | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; startRx: number; startRy: number } | null>(null);
  const hitRef  = useRef<(Chart3DPoint & { sx: number; sy: number })[]>([]);

  const { pts3d, ranges, workLogMin, workLogMax } = useMemo(() => {
    const raw: { id: string; n: number; t: number; s: number }[] = [];
    for (const id of algos) {
      for (const p of data[id] ?? []) {
        if (!p.timedOut && p.timeMs > 0 && (p.spaceBytes ?? 0) > 0)
          raw.push({ id, n: p.n, t: p.timeMs, s: p.spaceBytes! });
      }
    }
    if (raw.length === 0) return { pts3d: [] as Chart3DPoint[], ranges: null, workLogMin: 0, workLogMax: 1 };

    // Deduplicate: for same (id, n), keep the last measurement
    const seen = new Map<string, typeof raw[number]>();
    for (const p of raw) seen.set(`${p.id}:${p.n}`, p);
    const deduped = [...seen.values()];

    const logNs = deduped.map(p => Math.log10(p.n));
    const logTs = deduped.map(p => Math.log10(p.t));
    const logSs = deduped.map(p => Math.log10(p.s));
    const ranges = {
      n: [Math.min(...logNs), Math.max(...logNs)] as [number, number],
      t: [Math.min(...logTs), Math.max(...logTs)] as [number, number],
      s: [Math.min(...logSs), Math.max(...logSs)] as [number, number],
    };
    const nr = (v: number, [lo, hi]: [number, number]) => hi > lo ? (v - lo) / (hi - lo) : 0.5;

    // Log-log fit per algorithm → cumulative work integral ∫₀ⁿ f(n) dn = a·nᵇ⁺¹/(b+1)
    const fitMap: Record<string, { a: number; b: number } | null> = {};
    for (const id of algos) {
      const pts = deduped.filter(p => p.id === id && p.t > 0 && p.n > 1);
      if (pts.length < 2) { fitMap[id] = null; continue; }
      const xs = pts.map(p => Math.log(p.n)), ys = pts.map(p => Math.log(p.t));
      const m = pts.length;
      const sx = xs.reduce((a, x) => a + x, 0), sy = ys.reduce((a, y) => a + y, 0);
      const sxx = xs.reduce((a, x) => a + x * x, 0), sxy = xs.reduce((a, x, i) => a + x * ys[i], 0);
      const den = m * sxx - sx * sx;
      if (den === 0) { fitMap[id] = null; continue; }
      const b = (m * sxy - sx * sy) / den;
      const a = Math.exp((sy - b * sx) / m);
      fitMap[id] = { a, b };
    }

    // Axis mapping: X(red)=time, Y(green/vertical)=n, Z(blue)=space
    const pts3d: Chart3DPoint[] = deduped.map(p => {
      const fit = fitMap[p.id];
      const work = (fit && fit.b > -1) ? fit.a * Math.pow(p.n, fit.b + 1) / (fit.b + 1) : undefined;
      return { ...p, x: nr(Math.log10(p.t), ranges.t), y: nr(Math.log10(p.n), ranges.n), z: nr(Math.log10(p.s), ranges.s), work };
    });

    const workVals = pts3d.map(p => p.work).filter((w): w is number => w != null && w > 0);
    const workLogMin = workVals.length > 0 ? Math.log10(Math.min(...workVals)) : 0;
    const workLogMax = workVals.length > 0 ? Math.log10(Math.max(...workVals)) : 1;
    return { pts3d, ranges, workLogMin, workLogMax };
  }, [data, algos]);

  const project = useCallback((x: number, y: number, z: number, W: number, H: number): [number, number] => {
    const ryR = rotY * Math.PI / 180, rxR = rotX * Math.PI / 180;
    const px = x - 0.5, py = y - 0.5, pz = z - 0.5;
    const rx1 = px * Math.cos(ryR) + pz * Math.sin(ryR);
    const rz1 = -px * Math.sin(ryR) + pz * Math.cos(ryR);
    const ry2 = py * Math.cos(rxR) - rz1 * Math.sin(rxR);
    const sc = Math.min(W, H) * 0.44 * zoom;
    return [W / 2 + rx1 * sc, H / 2 - ry2 * sc];
  }, [rotX, rotY, zoom]);

  // Compute view-space depth (positive = closer to viewer)
  const viewDepth = useCallback((x: number, y: number, z: number): number => {
    const ryR = rotY * Math.PI / 180, rxR = rotX * Math.PI / 180;
    const px = x - 0.5, py = y - 0.5, pz = z - 0.5;
    const rz1 = -px * Math.sin(ryR) + pz * Math.cos(ryR);
    return py * Math.sin(rxR) + rz1 * Math.cos(rxR);
  }, [rotX, rotY]);

  // Normalise a work value → [0, 1] for visual encoding
  const normWork = useCallback((w: number) =>
    workLogMax > workLogMin ? (Math.log10(w) - workLogMin) / (workLogMax - workLogMin) : 0.5,
  [workLogMin, workLogMax]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !ranges || pts3d.length === 0) return;
    const ctx = canvas.getContext("2d")!;
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    const pr = (x: number, y: number, z: number) => project(x, y, z, W, H);
    const newHits: typeof hitRef.current = [];

    // ── Box wireframe ──────────────────────────────────────────────────────────
    // Standard RGB axis convention: X=red, Y=green, Z=blue
    const AXIS_X = "#ef5350", AXIS_Y = "#66bb6a", AXIS_Z = "#64b5f6";
    const boxEdges: [number,number,number,number,number,number][] = [
      [1,0,0,1,1,0],[1,0,0,1,0,1],[0,1,0,1,1,0],
      [0,1,0,0,1,1],[1,1,0,1,1,1],[0,0,1,1,0,1],
      [0,0,1,0,1,1],[1,0,1,1,1,1],[0,1,1,1,1,1],
    ];
    ctx.strokeStyle = "rgba(128,128,128,0.15)"; ctx.lineWidth = 0.5;
    for (const [x0,y0,z0,x1,y1,z1] of boxEdges) {
      const [ax,ay] = pr(x0,y0,z0); const [bx,by] = pr(x1,y1,z1);
      ctx.beginPath(); ctx.moveTo(ax,ay); ctx.lineTo(bx,by); ctx.stroke();
    }
    // Origin axes — drawn thicker with standard RGB colours
    const originAxes: [string, number,number,number, number,number,number][] = [
      [AXIS_X, 0,0,0, 1,0,0],
      [AXIS_Y, 0,0,0, 0,1,0],
      [AXIS_Z, 0,0,0, 0,0,1],
    ];
    for (const [color, x0,y0,z0, x1,y1,z1] of originAxes) {
      const [ax,ay] = pr(x0,y0,z0); const [bx,by] = pr(x1,y1,z1);
      ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.7;
      ctx.beginPath(); ctx.moveTo(ax,ay); ctx.lineTo(bx,by); ctx.stroke();
      // Arrowhead
      const angle = Math.atan2(by - ay, bx - ax);
      const AL = 7, AW = 3;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(bx - AL * Math.cos(angle - AW / AL), by - AL * Math.sin(angle - AW / AL));
      ctx.lineTo(bx - AL * Math.cos(angle + AW / AL), by - AL * Math.sin(angle + AW / AL));
      ctx.closePath(); ctx.fill();
      ctx.globalAlpha = 1;
    }
    // Axis labels at tips  (X=time/red, Y=n/green vertical, Z=space/blue)
    ctx.font = "bold 12px monospace";
    ctx.globalAlpha = 0.9;
    { const [lx,ly] = pr(1,0,0); ctx.fillStyle = AXIS_X; ctx.fillText("time →", lx + 5, ly + 4); }
    { const [lx,ly] = pr(0,1,0); ctx.fillStyle = AXIS_Y; ctx.fillText("n ↑", lx + 4, ly - 5); }
    { const [lx,ly] = pr(0,0,1); ctx.fillStyle = AXIS_Z; ctx.fillText("space", lx + 4, ly + 4); }
    ctx.globalAlpha = 1; ctx.lineWidth = 0.5;

    // ── Base grid ─────────────────────────────────────────────────────────────
    ctx.strokeStyle = "rgba(128,128,128,0.08)"; ctx.lineWidth = 0.5;
    for (let i = 0; i <= 4; i++) {
      const t = i / 4;
      let [ax,ay] = pr(t,0,0); let [bx,by] = pr(t,0,1);
      ctx.beginPath(); ctx.moveTo(ax,ay); ctx.lineTo(bx,by); ctx.stroke();
      [ax,ay] = pr(0,0,t); [bx,by] = pr(1,0,t);
      ctx.beginPath(); ctx.moveTo(ax,ay); ctx.lineTo(bx,by); ctx.stroke();
    }

    // ── Surface curtains — per-algo vertical ribbons dropping to y=0 ──────────
    // For each algorithm, for each consecutive n-pair, draw a quad:
    //   top-left  : actual data point (x, y, z)
    //   bottom-left: floor projection (x, 0, z)
    //   bottom-right: next floor (x', 0, z')
    //   top-right : next data point (x', y', z')
    // Painter's algorithm across all quads from all algos.
    if (showSurface && pts3d.length > 0) {
      type CurtainQuad = { depth: number; pts: [number,number][]; color: string };
      const quads: CurtainQuad[] = [];

      for (const id of algos) {
        const color = algoColors[id] ?? "#888";
        const sorted = pts3d.filter(p => p.id === id).sort((a, b) => a.n - b.n);
        for (let ni = 0; ni < sorted.length - 1; ni++) {
          const p0 = sorted[ni], p1 = sorted[ni + 1];
          // top-left, bottom-left, bottom-right, top-right
          const [xtl, ytl] = pr(p0.x, p0.y, p0.z);
          const [xbl, ybl] = pr(p0.x, 0,    p0.z);
          const [xbr, ybr] = pr(p1.x, 0,    p1.z);
          const [xtr, ytr] = pr(p1.x, p1.y, p1.z);
          const depth = (
            viewDepth(p0.x, p0.y, p0.z) + viewDepth(p0.x, 0, p0.z) +
            viewDepth(p1.x, 0,    p1.z) + viewDepth(p1.x, p1.y, p1.z)
          ) / 4;
          quads.push({ depth, pts: [[xtl,ytl],[xbl,ybl],[xbr,ybr],[xtr,ytr]], color });
        }
      }

      // Painter's algorithm: farthest first
      quads.sort((a, b) => a.depth - b.depth);

      const SURFACE_ALPHA = highlight ? 0.22 : 0.42;
      for (const q of quads) {
        const [[x0,y0],[x1,y1],[x2,y2],[x3,y3]] = q.pts;
        // Vertical gradient: brighter at top (data curve), dimmer at floor
        const gradLen = Math.hypot((x0+x3)/2 - (x1+x2)/2, (y0+y3)/2 - (y1+y2)/2);
        if (gradLen > 0.5) {
          const grad = ctx.createLinearGradient((x0+x3)/2, (y0+y3)/2, (x1+x2)/2, (y1+y2)/2);
          grad.addColorStop(0, hexAlpha(q.color, SURFACE_ALPHA));
          grad.addColorStop(1, hexAlpha(q.color, SURFACE_ALPHA * 0.3));
          ctx.fillStyle = grad;
        } else {
          ctx.fillStyle = hexAlpha(q.color, SURFACE_ALPHA);
        }
        ctx.beginPath();
        ctx.moveTo(x0, y0); ctx.lineTo(x1, y1);
        ctx.lineTo(x2, y2); ctx.lineTo(x3, y3);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = hexAlpha(q.color, 0.12); ctx.lineWidth = 0.3;
        ctx.stroke();
      }
    }

    // ── Axis tick labels (X=time/red, Y=n/green, Z=space/blue) ───────────────
    ctx.font = "9px monospace";
    const TICKS = 4;
    for (let i = 0; i <= TICKS; i++) {
      const t = i / TICKS;
      // X axis ticks (time)
      const [tx2,ty2] = pr(t,0,0);
      ctx.fillStyle = "#ff0000"; ctx.globalAlpha = 0.7;
      ctx.fillText(fmtTime(Math.pow(10, ranges.t[0] + t*(ranges.t[1]-ranges.t[0]))), tx2-16, ty2+12);
      // Y axis ticks (n)
      const [nx,ny] = pr(0,t,0);
      ctx.fillStyle = "#00cc44";
      ctx.fillText(fmtN(Math.pow(10, ranges.n[0] + t*(ranges.n[1]-ranges.n[0]))), nx-34, ny+4);
      // Z axis ticks (space)
      const [sx2,sy2] = pr(0,0,t);
      ctx.fillStyle = "#4488ff";
      ctx.fillText(fmtBytes(Math.pow(10, ranges.s[0] + t*(ranges.s[1]-ranges.s[0]))), sx2+5, sy2+3);
    }
    ctx.globalAlpha = 1;

    // ── Algorithm curves + dots (drawn over the surface) ──────────────────────
    for (const id of algos) {
      const isHl = !highlight || highlight === id;
      const color = algoColors[id] ?? "#888";
      const sorted = pts3d.filter(p => p.id === id).sort((a, b) => a.n - b.n);
      if (sorted.length === 0) continue;

      // Shadow projection on base plane
      if (tool === "shadows") {
        ctx.strokeStyle = color; ctx.lineWidth = 0.8;
        ctx.globalAlpha = isHl ? 0.22 : 0.06; ctx.setLineDash([3,3]);
        ctx.beginPath();
        sorted.forEach((p, i) => { const [px,py] = pr(p.x,0,p.z); i===0?ctx.moveTo(px,py):ctx.lineTo(px,py); });
        ctx.stroke();
        ctx.setLineDash([]); ctx.globalAlpha = 1;
        ctx.strokeStyle = color; ctx.lineWidth = 0.4; ctx.globalAlpha = isHl ? 0.15 : 0.04;
        for (const p of sorted) {
          const [px,py] = pr(p.x,p.y,p.z); const [bx,by] = pr(p.x,0,p.z);
          ctx.beginPath(); ctx.moveTo(px,py); ctx.lineTo(bx,by); ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }

      // Vertical drop lines: each data point → floor (y=0), always shown
      ctx.globalAlpha = isHl ? 0.35 : 0.08;
      for (const p of sorted) {
        const [px, py] = pr(p.x, p.y, p.z);
        const [fx, fy] = pr(p.x, 0,    p.z);
        ctx.strokeStyle = color; ctx.lineWidth = 0.7;
        ctx.setLineDash([2, 3]);
        ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(fx, fy); ctx.stroke();
        // Floor dot
        ctx.fillStyle = color;
        ctx.beginPath(); ctx.arc(fx, fy, 1.5, 0, Math.PI * 2); ctx.fill();
      }
      ctx.setLineDash([]); ctx.globalAlpha = 1;

      // Cumulative-work rings on floor — circle radius ∝ ∫f dn at each n
      for (const p of sorted) {
        if (p.work == null) continue;
        const [fx, fy] = pr(p.x, 0, p.z);
        const ringR = 3 + normWork(p.work) * 9;
        ctx.globalAlpha = isHl ? 0.28 : 0.06;
        ctx.strokeStyle = color; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(fx, fy, ringR, 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha = 1;
      }

      // Curve line — brighter when surface is shown so it reads above the mesh
      ctx.strokeStyle = color;
      ctx.lineWidth = isHl ? (showSurface ? 2.2 : 1.8) : 0.8;
      ctx.globalAlpha = isHl ? 1 : 0.2;
      ctx.beginPath();
      sorted.forEach((p, i) => { const [px,py] = pr(p.x,p.y,p.z); i===0?ctx.moveTo(px,py):ctx.lineTo(px,py); });
      ctx.stroke(); ctx.globalAlpha = 1;

      // Dots — radius encodes cumulative work (larger = more work done up to that n)
      for (const p of sorted) {
        const [px,py] = pr(p.x,p.y,p.z);
        const baseR = isHl ? 2.5 : 1.5;
        const r = p.work != null ? baseR + normWork(p.work) * (isHl ? 5 : 2) : baseR;
        ctx.fillStyle = color; ctx.globalAlpha = isHl ? 1 : 0.25;
        ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI*2); ctx.fill();
        // White outline on dots so they pop over surface
        if (isHl && showSurface) {
          ctx.strokeStyle = "rgba(255,255,255,0.5)"; ctx.lineWidth = 0.8;
          ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI*2); ctx.stroke();
        }
        ctx.globalAlpha = 1;
        newHits.push({ ...p, sx: px, sy: py });
      }
    }

    // ── Measure tooltip ────────────────────────────────────────────────────────
    if (hoverInfo && tool === "measure") {
      const { sx, sy, id, n, t, s, work } = hoverInfo;
      ctx.strokeStyle = "#fff"; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(sx, sy, 7, 0, Math.PI*2); ctx.stroke();
      const fmtWork = (w: number) => w >= 1000 ? `${(w/1000).toFixed(2)}s·n` : `${w.toFixed(2)}ms·n`;
      const lines = [
        algoNames[id] ?? id,
        `n = ${fmtN(n)}`,
        `t = ${fmtTime(t)}`,
        `s = ${fmtBytes(s)}`,
        ...(work != null ? [`∫ = ${fmtWork(work)}`] : []),
      ];
      const LINE_H = 16, PAD = 10;
      const bW = 160, bH = lines.length * LINE_H + PAD * 1.5;
      const bx = Math.min(sx + 14, W - bW - 4), by = Math.max(sy - bH - 10, 4);
      ctx.fillStyle = "rgba(10,10,10,0.94)";
      ctx.strokeStyle = "rgba(255,255,255,0.18)"; ctx.lineWidth = 0.7;
      ctx.beginPath(); ctx.roundRect?.(bx, by, bW, bH, 5) ?? ctx.rect(bx, by, bW, bH);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = algoColors[id] ?? "#fff"; ctx.font = "bold 12px monospace";
      ctx.fillText(lines[0], bx + PAD, by + PAD + 8);
      ctx.fillStyle = "#ddd"; ctx.font = "11px monospace";
      lines.slice(1).forEach((line, i) => ctx.fillText(line, bx + PAD, by + PAD + 8 + (i + 1) * LINE_H));
    }

    hitRef.current = newHits;
  }, [pts3d, ranges, rotX, rotY, zoom, highlight, tool, hoverInfo, showSurface, project, viewDepth, normWork]);

  const onMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (tool === "orbit") {
      e.preventDefault(); // block text-selection and scroll while dragging
      dragRef.current = { startX: e.clientX, startY: e.clientY, startRx: rotX, startRy: rotY };
    }
  };
  const onMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (dragRef.current && tool === "orbit") {
      setRotY(dragRef.current.startRy + (e.clientX - dragRef.current.startX) * 0.5);
      setRotX(Math.max(-85, Math.min(85, dragRef.current.startRx - (e.clientY - dragRef.current.startY) * 0.5)));
      return;
    }
    if (tool === "measure") {
      const canvas = canvasRef.current!;
      const rect = canvas.getBoundingClientRect();
      const mx = (e.clientX - rect.left) * (canvas.width / rect.width);
      const my = (e.clientY - rect.top)  * (canvas.height / rect.height);
      let best = null as typeof hitRef.current[0] | null, bestD = Infinity;
      for (const h of hitRef.current) {
        const d = Math.hypot(h.sx - mx, h.sy - my);
        if (d < bestD) { bestD = d; best = h; }
      }
      setHoverInfo(bestD < 22 ? best : null);
    }
  };
  const onMouseUp = () => { dragRef.current = null; };

  // Native wheel listener — React's synthetic onWheel is passive by default so
  // e.preventDefault() is silently ignored and the page scrolls through the chart.
  // Attaching with { passive: false } lets us consume the event.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      setZoom(z => Math.max(0.3, Math.min(4, z * (1 - e.deltaY * 0.0008))));
    };
    canvas.addEventListener("wheel", handler, { passive: false });
    return () => canvas.removeEventListener("wheel", handler);
  }, []);

  // ── Hotkeys: R resets the view; X/Y/Z snap to axis-aligned looks ─────────
  // Only fires when the canvas is hovered, so the keys don't fight inputs
  // elsewhere on the page. Axis-aligned views preserve zoom (the user may have
  // zoomed in deliberately); R does a full reset.
  // Conventions: pressing the axis letter looks ALONG that axis, so the named
  // axis points INTO the screen. X view → see (n, space). Y → (time, space).
  // Z → (time, n). This matches CAD-viewer convention.
  const isHoveredRef = useRef(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!isHoveredRef.current) return;
      // Don't steal keys while the user is typing in an input/textarea/select
      // or in a contentEditable region elsewhere on the page.
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || t?.isContentEditable) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return; // leave OS/browser shortcuts alone
      const k = e.key.toLowerCase();
      if (k === "r") {
        e.preventDefault();
        setRotX(28); setRotY(-40); setZoom(1);
        setTool("measure"); setShowSurface(false); setHoverInfo(null);
      } else if (k === "x") {
        e.preventDefault();
        // Look along +X: time axis points into the screen, see n (up) vs space.
        setRotX(0); setRotY(90);
      } else if (k === "y") {
        e.preventDefault();
        // Look along +Y from above: top-down view of time (x) vs space (z).
        setRotX(90); setRotY(0);
      } else if (k === "z") {
        e.preventDefault();
        // Look along +Z: head-on time (x) vs n (y), no depth.
        setRotX(0); setRotY(0);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Pinch-to-zoom + single-finger orbit via touch events.
  // touchAction: "none" in CSS tells the browser not to scroll/zoom natively,
  // so e.preventDefault() is not required here, but we call it for safety.
  const pinchDistRef = useRef<number | null>(null);

  const onTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const ts = Array.from(e.touches);
    if (ts.length === 2) {
      // Start of a pinch gesture — record initial distance between fingers
      pinchDistRef.current = Math.hypot(ts[1].clientX - ts[0].clientX, ts[1].clientY - ts[0].clientY);
      dragRef.current = null;
    } else if (ts.length === 1) {
      // Single finger: treat as orbit drag regardless of selected tool
      dragRef.current = { startX: ts[0].clientX, startY: ts[0].clientY, startRx: rotX, startRy: rotY };
      pinchDistRef.current = null;
    }
  };

  const onTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const ts = Array.from(e.touches);
    if (ts.length === 2 && pinchDistRef.current !== null) {
      const dist = Math.hypot(ts[1].clientX - ts[0].clientX, ts[1].clientY - ts[0].clientY);
      const ratio = dist / pinchDistRef.current;
      setZoom(z => Math.max(0.3, Math.min(4, z * ratio)));
      pinchDistRef.current = dist;
    } else if (ts.length === 1 && dragRef.current) {
      const t = ts[0];
      setRotY(dragRef.current.startRy + (t.clientX - dragRef.current.startX) * 0.5);
      setRotX(Math.max(-85, Math.min(85, dragRef.current.startRx - (t.clientY - dragRef.current.startY) * 0.5)));
    }
  };

  const onTouchEnd = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length < 2) pinchDistRef.current = null;
    if (e.touches.length === 0) dragRef.current = null;
  };

  if (!ranges || pts3d.length === 0) return (
    <div style={{ height: 260, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-muted)", fontSize: 11 }}>
      Run a benchmark with time and space data to see the 3D chart.
    </div>
  );

  return (
    <div>
      <div style={{ display: "flex", gap: 5, marginBottom: 8, alignItems: "center", flexWrap: "wrap" }}>
        {([
          { id: "measure", label: "⊕ Measure",  title: "Hover over a point to inspect its n / time / space values" },
          { id: "orbit"  , label: "⟳ Orbit",   title: "Drag to orbit · scroll to zoom" },
          { id: "shadows", label: "⇓ Shadows",  title: "Show base-plane projections: each algorithm's curve projected onto the n–space floor" },
        ] as const).map(tb => (
          <button key={tb.id} onClick={() => setTool(tb.id)} title={tb.title} style={{
            padding: "2px 8px", fontSize: 9, borderRadius: 4, cursor: "pointer",
            background: tool === tb.id ? "var(--color-accent)" : "var(--color-surface-1)",
            border: `1px solid ${tool === tb.id ? "var(--color-accent)" : "var(--color-border)"}`,
            color: tool === tb.id ? "#fff" : "var(--color-muted)",
          }}>{tb.label}</button>
        ))}
        {/* Surface toggle */}
        <button
          onClick={() => setShowSurface(s => !s)}
          title="Toggle vertical curtains — each algorithm's curve drops a filled ribbon down to the time-axis floor"
          style={{
            padding: "2px 8px", fontSize: 9, borderRadius: 4, cursor: "pointer",
            background: showSurface ? "rgba(100,181,246,0.15)" : "var(--color-surface-1)",
            border: `1px solid ${showSurface ? "#64b5f6" : "var(--color-border)"}`,
            color: showSurface ? "#64b5f6" : "var(--color-muted)",
          }}
        >
          ⬡ Surface
        </button>
        <button onClick={() => { setRotX(28); setRotY(-40); setZoom(1); }} style={{
          padding: "2px 8px", fontSize: 9, borderRadius: 4, cursor: "pointer",
          background: "var(--color-surface-1)", border: "1px solid var(--color-border)", color: "var(--color-muted)",
        }}>⟲ Reset</button>
        <button onClick={() => {
          const c = canvasRef.current; if (!c) return;
          const a = document.createElement("a");
          a.href = c.toDataURL("image/png");
          a.download = "benchmark-3d.png";
          a.click();
        }} style={{
          padding: "2px 8px", fontSize: 9, borderRadius: 4, cursor: "pointer",
          background: "var(--color-surface-1)", border: "1px solid var(--color-border)", color: "var(--color-muted)",
        }}>↓ PNG</button>
        <span style={{ fontSize: 8, marginLeft: "auto", fontFamily: "monospace" }}>
          <span style={{ color: "#ef5350" }}>X=time</span>
          {" · "}
          <span style={{ color: "#66bb6a" }}>Y=n</span>
          {" · "}
          <span style={{ color: "#64b5f6" }}>Z=space</span>
          <span style={{ color: "var(--color-muted)" }}> (log₁₀) · dot size &amp; ring = ∫f dn cumulative work</span>
        </span>
      </div>
      <canvas
        ref={canvasRef} width={800} height={307}
        style={{ width: "100%", height: "auto", aspectRatio: "800 / 307", display: "block",
          touchAction: "none", userSelect: "none",
          cursor: tool === "orbit" ? (dragRef.current ? "grabbing" : "grab") : tool === "measure" ? (hoverInfo ? "pointer" : "crosshair") : "default" }}
        onMouseDown={onMouseDown} onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseEnter={() => { isHoveredRef.current = true; }}
        onMouseLeave={() => { isHoveredRef.current = false; dragRef.current = null; setHoverInfo(null); }}
        onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
        onDragStart={e => e.preventDefault()}
      />
      {/* Hotkey + curtain hints. Hover the chart and press R / X / Y / Z. */}
      <p style={{ fontSize: 8, color: "var(--color-muted)", fontFamily: "monospace", marginTop: 4 }}>
        <span title="Hover the chart, then press a hotkey">
          hover + <kbd style={kbdStyle}>R</kbd> reset · <kbd style={kbdStyle}>X</kbd>/<kbd style={kbdStyle}>Y</kbd>/<kbd style={kbdStyle}>Z</kbd> axis-aligned view
        </span>
        {showSurface && (
          <> · curtains drop to the n-axis floor · rings on the floor = ∫f dn (larger = more cumulative work) · use ⊕ Measure to inspect any point</>
        )}
      </p>
    </div>
  );
}

function Chart3DHistoryView({
  current, ghostRuns, algos, algoNames, algoColors,
}: {
  /** The current (in-progress or just-completed) run, in the same shape as Chart3D's `data`.
   *  Always rendered as the brightest, freshest layer if present. */
  current: Record<string, { n: number; timeMs: number; spaceBytes?: number; timedOut?: boolean }[]>;
  /** Persisted ring buffer per algo, oldest-first (idx 0) → newest-last. */
  ghostRuns: Record<string, { ts: number; points: { n: number; timeMs: number; meanMs?: number; spaceBytes?: number }[] }[]>;
  algos: string[];
  algoNames: Record<string, string>;
  algoColors: Record<string, string>;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Orbit/zoom state — match Chart3D defaults so the first impression matches.
  const [rotX, setRotX] = useState(28);
  const [rotY, setRotY] = useState(-40);
  const [zoom, setZoom] = useState(1.0);
  const [tool, setTool] = useState<"orbit" | "measure">("orbit");
  // "all" overlays every selected algo; "single" focuses one algo so the
  // run-over-run drift band is actually legible.
  const [mode, setMode] = useState<"all" | "single">("all");
  const [focusAlgo, setFocusAlgo] = useState<string | null>(null);
  // Visible-run cap is user-controlled; storage cap (GHOST_MAX) is 100.
  // Persisted so the user's preferred density survives reload.
  const [visibleRuns, setVisibleRuns] = useState<number>(20);
  const visibleHydratedRef = useRef(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem("codecookbook.history3DVisibleRuns");
      if (raw != null) {
        const n = parseInt(raw, 10);
        if (Number.isFinite(n) && n >= 1 && n <= 100) setVisibleRuns(n);
      }
    } catch {}
    visibleHydratedRef.current = true;
  }, []);
  useEffect(() => {
    if (typeof window === "undefined" || !visibleHydratedRef.current) return;
    try { localStorage.setItem("codecookbook.history3DVisibleRuns", String(visibleRuns)); } catch {}
  }, [visibleRuns]);

  type HistPoint = { id: string; runIdx: number; ageRank: number; n: number; t: number; s: number; x: number; y: number; z: number };
  const [hoverInfo, setHoverInfo] = useState<(HistPoint & { sx: number; sy: number }) | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; startRx: number; startRy: number } | null>(null);
  const hitRef = useRef<(HistPoint & { sx: number; sy: number })[]>([]);

  // Auto-pick a focus algo when entering single-mode if none chosen yet.
  useEffect(() => {
    if (mode === "single" && !focusAlgo && algos.length > 0) setFocusAlgo(algos[0]);
  }, [mode, focusAlgo, algos]);

  // Algos actually drawn this frame: scoped by mode.
  const drawnAlgos = useMemo(() => {
    if (mode === "single") return focusAlgo && algos.includes(focusAlgo) ? [focusAlgo] : [];
    return algos;
  }, [mode, focusAlgo, algos]);

  // ── Build the run stacks per algo ────────────────────────────────────────
  // Each algo's stack = [oldest ghost, ..., newest ghost, current?]. We take
  // the LAST `visibleRuns` entries so newest stays visible if visibleRuns < total.
  // ageRank 0 = oldest (most faded), ageRank=total-1 = newest (full alpha).
  const { stacks, ranges } = useMemo(() => {
    type Run = { points: { n: number; t: number; s: number }[]; isCurrent: boolean };
    const stacks: Record<string, Run[]> = {};
    const allN: number[] = []; const allT: number[] = []; const allS: number[] = [];

    for (const id of drawnAlgos) {
      const ghosts = ghostRuns[id] ?? [];
      const stack: Run[] = [];
      for (const g of ghosts) {
        const pts = g.points
          .filter(p => p.timeMs > 0 && (p.spaceBytes ?? 0) > 0)
          .map(p => ({ n: p.n, t: p.timeMs, s: p.spaceBytes! }));
        if (pts.length > 0) stack.push({ points: pts, isCurrent: false });
      }
      // Append the current run as the newest layer (it isn't in ghostRuns until
      // it completes; this keeps the freshest measurements visible mid-run).
      const cur = current[id] ?? [];
      const curPts = cur
        .filter(p => !p.timedOut && p.timeMs > 0 && (p.spaceBytes ?? 0) > 0)
        .map(p => ({ n: p.n, t: p.timeMs, s: p.spaceBytes! }));
      if (curPts.length > 0) stack.push({ points: curPts, isCurrent: true });

      // Cap to the visible window — newest kept.
      const trimmed = stack.length > visibleRuns ? stack.slice(stack.length - visibleRuns) : stack;
      if (trimmed.length > 0) {
        stacks[id] = trimmed;
        for (const r of trimmed) for (const p of r.points) { allN.push(p.n); allT.push(p.t); allS.push(p.s); }
      }
    }

    if (allN.length === 0) return { stacks, ranges: null };
    const logNs = allN.map(Math.log10), logTs = allT.map(Math.log10), logSs = allS.map(Math.log10);
    const ranges = {
      n: [Math.min(...logNs), Math.max(...logNs)] as [number, number],
      t: [Math.min(...logTs), Math.max(...logTs)] as [number, number],
      s: [Math.min(...logSs), Math.max(...logSs)] as [number, number],
    };
    return { stacks, ranges };
  }, [drawnAlgos, ghostRuns, current, visibleRuns]);

  // Project 3D normalized-coord → 2D pixel — identical math to Chart3D.
  const project = useCallback((x: number, y: number, z: number, W: number, H: number): [number, number] => {
    const ryR = rotY * Math.PI / 180, rxR = rotX * Math.PI / 180;
    const px = x - 0.5, py = y - 0.5, pz = z - 0.5;
    const rx1 = px * Math.cos(ryR) + pz * Math.sin(ryR);
    const rz1 = -px * Math.sin(ryR) + pz * Math.cos(ryR);
    const ry2 = py * Math.cos(rxR) - rz1 * Math.sin(rxR);
    const sc = Math.min(W, H) * 0.44 * zoom;
    return [W / 2 + rx1 * sc, H / 2 - ry2 * sc];
  }, [rotX, rotY, zoom]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !ranges) return;
    const ctx = canvas.getContext("2d")!;
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    const pr = (x: number, y: number, z: number) => project(x, y, z, W, H);
    const nr = (v: number, [lo, hi]: [number, number]) => hi > lo ? (v - lo) / (hi - lo) : 0.5;
    const newHits: typeof hitRef.current = [];

    // ── Box wireframe + axes (same convention as Chart3D) ───────────────────
    const AXIS_X = "#ef5350", AXIS_Y = "#66bb6a", AXIS_Z = "#64b5f6";
    const boxEdges: [number,number,number,number,number,number][] = [
      [1,0,0,1,1,0],[1,0,0,1,0,1],[0,1,0,1,1,0],
      [0,1,0,0,1,1],[1,1,0,1,1,1],[0,0,1,1,0,1],
      [0,0,1,0,1,1],[1,0,1,1,1,1],[0,1,1,1,1,1],
    ];
    ctx.strokeStyle = "rgba(128,128,128,0.15)"; ctx.lineWidth = 0.5;
    for (const [x0,y0,z0,x1,y1,z1] of boxEdges) {
      const [ax,ay] = pr(x0,y0,z0); const [bx,by] = pr(x1,y1,z1);
      ctx.beginPath(); ctx.moveTo(ax,ay); ctx.lineTo(bx,by); ctx.stroke();
    }
    const originAxes: [string, number,number,number, number,number,number][] = [
      [AXIS_X, 0,0,0, 1,0,0],
      [AXIS_Y, 0,0,0, 0,1,0],
      [AXIS_Z, 0,0,0, 0,0,1],
    ];
    for (const [color, x0,y0,z0, x1,y1,z1] of originAxes) {
      const [ax,ay] = pr(x0,y0,z0); const [bx,by] = pr(x1,y1,z1);
      ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.7;
      ctx.beginPath(); ctx.moveTo(ax,ay); ctx.lineTo(bx,by); ctx.stroke();
      const angle = Math.atan2(by - ay, bx - ax);
      const AL = 7, AW = 3;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(bx - AL * Math.cos(angle - AW / AL), by - AL * Math.sin(angle - AW / AL));
      ctx.lineTo(bx - AL * Math.cos(angle + AW / AL), by - AL * Math.sin(angle + AW / AL));
      ctx.closePath(); ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.font = "bold 12px monospace";
    ctx.globalAlpha = 0.9;
    { const [lx,ly] = pr(1,0,0); ctx.fillStyle = AXIS_X; ctx.fillText("time →", lx + 5, ly + 4); }
    { const [lx,ly] = pr(0,1,0); ctx.fillStyle = AXIS_Y; ctx.fillText("n ↑", lx + 4, ly - 5); }
    { const [lx,ly] = pr(0,0,1); ctx.fillStyle = AXIS_Z; ctx.fillText("space", lx + 4, ly + 4); }
    ctx.globalAlpha = 1; ctx.lineWidth = 0.5;

    // Base grid (faint)
    ctx.strokeStyle = "rgba(128,128,128,0.08)"; ctx.lineWidth = 0.5;
    for (let i = 0; i <= 4; i++) {
      const t = i / 4;
      let [ax,ay] = pr(t,0,0); let [bx,by] = pr(t,0,1);
      ctx.beginPath(); ctx.moveTo(ax,ay); ctx.lineTo(bx,by); ctx.stroke();
      [ax,ay] = pr(0,0,t); [bx,by] = pr(1,0,t);
      ctx.beginPath(); ctx.moveTo(ax,ay); ctx.lineTo(bx,by); ctx.stroke();
    }

    // Axis tick labels — same scale rendering as Chart3D so users can switch
    // between the two views without re-reading the axes.
    ctx.font = "9px monospace";
    const TICKS = 4;
    for (let i = 0; i <= TICKS; i++) {
      const t = i / TICKS;
      const [tx2,ty2] = pr(t,0,0);
      ctx.fillStyle = "#ff0000"; ctx.globalAlpha = 0.7;
      ctx.fillText(fmtTime(Math.pow(10, ranges.t[0] + t*(ranges.t[1]-ranges.t[0]))), tx2-16, ty2+12);
      const [nx,ny] = pr(0,t,0);
      ctx.fillStyle = "#00cc44";
      ctx.fillText(fmtN(Math.pow(10, ranges.n[0] + t*(ranges.n[1]-ranges.n[0]))), nx-34, ny+4);
      const [sx2,sy2] = pr(0,0,t);
      ctx.fillStyle = "#4488ff";
      ctx.fillText(fmtBytes(Math.pow(10, ranges.s[0] + t*(ranges.s[1]-ranges.s[0]))), sx2+5, sy2+3);
    }
    ctx.globalAlpha = 1;

    // ── Draw history runs ───────────────────────────────────────────────────
    // For each algo: render each run as a polyline + tiny dots, with opacity
    // ramping by recency. The CURRENT run gets a thicker line + larger dots
    // so the user can always pick out "where we are now" inside the band.
    for (const id of drawnAlgos) {
      const stack = stacks[id]; if (!stack || stack.length === 0) continue;
      const color = algoColors[id] ?? "#888";
      const total = stack.length;
      for (let ri = 0; ri < total; ri++) {
        const run = stack[ri];
        // ageRank: 0 = oldest in the visible window, total-1 = newest.
        const ageFactor = (ri + 1) / total; // 1/n .. 1
        // Floor at 5% so even the oldest visible run leaves a faint trail;
        // newest peaks at 90% non-current, 100% if it IS the current run.
        const baseAlpha = 0.05 + 0.85 * ageFactor;
        const alpha = run.isCurrent ? 1.0 : baseAlpha;
        const lineWidth = run.isCurrent ? 2.2 : (0.6 + 0.9 * ageFactor);
        const dotR = run.isCurrent ? 2.5 : (0.8 + 1.2 * ageFactor);

        // Project + sort points by n so the polyline reads left→right along Y axis.
        const sorted = [...run.points].sort((a, b) => a.n - b.n).map(p => ({
          ...p,
          x: nr(Math.log10(p.t), ranges.t),
          y: nr(Math.log10(p.n), ranges.n),
          z: nr(Math.log10(p.s), ranges.s),
        }));

        // Polyline
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;
        ctx.beginPath();
        sorted.forEach((p, i) => { const [px,py] = pr(p.x,p.y,p.z); i===0?ctx.moveTo(px,py):ctx.lineTo(px,py); });
        ctx.stroke();

        // Dots (also feeds the measure-tool hit list)
        ctx.fillStyle = color;
        for (const p of sorted) {
          const [px,py] = pr(p.x,p.y,p.z);
          ctx.beginPath(); ctx.arc(px, py, dotR, 0, Math.PI*2); ctx.fill();
          // Only register hits for measure mode at alpha that's actually readable;
          // ghosts at 5% opacity are visual context, not interactive targets.
          if (alpha >= 0.4) newHits.push({ id, runIdx: ri, ageRank: ri, n: p.n, t: p.t, s: p.s, x: p.x, y: p.y, z: p.z, sx: px, sy: py });
        }
      }
      ctx.globalAlpha = 1;
    }

    // ── Measure tooltip ─────────────────────────────────────────────────────
    if (hoverInfo && tool === "measure") {
      const { sx, sy, id, n, t, s, runIdx, ageRank } = hoverInfo;
      const total = stacks[id]?.length ?? 0;
      const ageLabel = runIdx === total - 1 ? "current" : `${total - 1 - ageRank} run${total - 1 - ageRank === 1 ? "" : "s"} ago`;
      ctx.strokeStyle = "#fff"; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(sx, sy, 7, 0, Math.PI*2); ctx.stroke();
      const lines = [
        algoNames[id] ?? id,
        `n = ${fmtN(n)}`,
        `t = ${fmtTime(t)}`,
        `s = ${fmtBytes(s)}`,
        ageLabel,
      ];
      const LINE_H = 16, PAD = 10;
      const bW = 160, bH = lines.length * LINE_H + PAD * 1.5;
      const bx = Math.min(sx + 14, W - bW - 4), by = Math.max(sy - bH - 10, 4);
      ctx.fillStyle = "rgba(10,10,10,0.94)";
      ctx.strokeStyle = "rgba(255,255,255,0.18)"; ctx.lineWidth = 0.7;
      ctx.beginPath(); ctx.roundRect?.(bx, by, bW, bH, 5) ?? ctx.rect(bx, by, bW, bH);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = algoColors[id] ?? "#fff"; ctx.font = "bold 12px monospace";
      ctx.fillText(lines[0], bx + PAD, by + PAD + 8);
      ctx.fillStyle = "#ddd"; ctx.font = "11px monospace";
      lines.slice(1).forEach((line, i) => ctx.fillText(line, bx + PAD, by + PAD + 8 + (i + 1) * LINE_H));
    }

    hitRef.current = newHits;
  }, [stacks, ranges, drawnAlgos, rotX, rotY, zoom, project, tool, hoverInfo]);

  // ── Pointer interactions ────────────────────────────────────────────────
  const onMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (tool === "orbit") {
      e.preventDefault();
      dragRef.current = { startX: e.clientX, startY: e.clientY, startRx: rotX, startRy: rotY };
    }
  };
  const onMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (dragRef.current && tool === "orbit") {
      setRotY(dragRef.current.startRy + (e.clientX - dragRef.current.startX) * 0.5);
      setRotX(Math.max(-85, Math.min(85, dragRef.current.startRx - (e.clientY - dragRef.current.startY) * 0.5)));
      return;
    }
    if (tool === "measure") {
      const canvas = canvasRef.current!;
      const rect = canvas.getBoundingClientRect();
      const mx = (e.clientX - rect.left) * (canvas.width / rect.width);
      const my = (e.clientY - rect.top) * (canvas.height / rect.height);
      let best = null as typeof hitRef.current[0] | null, bestD = Infinity;
      for (const h of hitRef.current) {
        const d = Math.hypot(h.sx - mx, h.sy - my);
        if (d < bestD) { bestD = d; best = h; }
      }
      setHoverInfo(bestD < 22 ? best : null);
    }
  };
  const onMouseUp = () => { dragRef.current = null; };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      setZoom(z => Math.max(0.3, Math.min(4, z * (1 - e.deltaY * 0.0008))));
    };
    canvas.addEventListener("wheel", handler, { passive: false });
    return () => canvas.removeEventListener("wheel", handler);
  }, []);

  // Hotkeys — same convention as Chart3D. R = full reset; X/Y/Z snap to
  // axis-aligned views (preserving zoom so the user keeps their current
  // magnification). Only fires while the canvas is hovered.
  const isHoveredRef = useRef(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!isHoveredRef.current) return;
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || t?.isContentEditable) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === "r") {
        e.preventDefault();
        setRotX(28); setRotY(-40); setZoom(1);
        setTool("orbit"); setHoverInfo(null);
      } else if (k === "x") {
        e.preventDefault(); setRotX(0); setRotY(90);
      } else if (k === "y") {
        e.preventDefault(); setRotX(90); setRotY(0);
      } else if (k === "z") {
        e.preventDefault(); setRotX(0); setRotY(0);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Pinch + single-finger orbit (same as Chart3D).
  const pinchDistRef = useRef<number | null>(null);
  const onTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const ts = Array.from(e.touches);
    if (ts.length === 2) {
      pinchDistRef.current = Math.hypot(ts[1].clientX - ts[0].clientX, ts[1].clientY - ts[0].clientY);
      dragRef.current = null;
    } else if (ts.length === 1) {
      dragRef.current = { startX: ts[0].clientX, startY: ts[0].clientY, startRx: rotX, startRy: rotY };
      pinchDistRef.current = null;
    }
  };
  const onTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const ts = Array.from(e.touches);
    if (ts.length === 2 && pinchDistRef.current !== null) {
      const dist = Math.hypot(ts[1].clientX - ts[0].clientX, ts[1].clientY - ts[0].clientY);
      setZoom(z => Math.max(0.3, Math.min(4, z * (dist / pinchDistRef.current!))));
      pinchDistRef.current = dist;
    } else if (ts.length === 1 && dragRef.current) {
      const t = ts[0];
      setRotY(dragRef.current.startRy + (t.clientX - dragRef.current.startX) * 0.5);
      setRotX(Math.max(-85, Math.min(85, dragRef.current.startRx - (t.clientY - dragRef.current.startY) * 0.5)));
    }
  };
  const onTouchEnd = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length < 2) pinchDistRef.current = null;
    if (e.touches.length === 0) dragRef.current = null;
  };

  // Total stored count (across selected algos) for the "X of Y stored" hint.
  const totalStored = useMemo(() => {
    if (mode === "single") return focusAlgo ? (ghostRuns[focusAlgo]?.length ?? 0) : 0;
    return drawnAlgos.reduce((s, id) => Math.max(s, ghostRuns[id]?.length ?? 0), 0);
  }, [mode, focusAlgo, drawnAlgos, ghostRuns]);

  if (!ranges) return (
    <div style={{ height: 320, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-muted)", fontSize: 11, textAlign: "center", padding: 16 }}>
      Run a benchmark to populate the history.<br/>
      Each completed run adds one polyline; up to 100 are kept per algorithm.
    </div>
  );

  return (
    <div>
      {/* Top control row */}
      <div style={{ display: "flex", gap: 5, marginBottom: 8, alignItems: "center", flexWrap: "wrap" }}>
        {/* Mode toggle */}
        <div style={{ display: "flex", borderRadius: 4, overflow: "hidden", border: "1px solid var(--color-border)" }}>
          {(["all", "single"] as const).map(m => (
            <button key={m} onClick={() => setMode(m)} style={{
              padding: "2px 8px", fontSize: 9, cursor: "pointer", border: "none",
              background: mode === m ? "var(--color-accent)" : "var(--color-surface-1)",
              color: mode === m ? "#fff" : "var(--color-muted)",
              fontWeight: mode === m ? 600 : 400,
            }}>{m === "all" ? "All algos" : "Single algo"}</button>
          ))}
        </div>

        {/* Algo picker — only relevant in single-mode */}
        {mode === "single" && (
          <select
            value={focusAlgo ?? ""}
            onChange={e => setFocusAlgo(e.target.value || null)}
            style={{
              padding: "2px 6px", fontSize: 9, borderRadius: 4, cursor: "pointer",
              background: "var(--color-surface-1)", border: "1px solid var(--color-border)", color: "var(--color-text)",
            }}
          >
            {algos.map(id => (
              <option key={id} value={id} style={{ color: algoColors[id] ?? "#888" }}>
                {algoNames[id] ?? id}
              </option>
            ))}
          </select>
        )}

        {/* Tool toggle */}
        {([
          { id: "orbit"  , label: "⟳ Orbit",   title: "Drag to orbit · scroll/pinch to zoom" },
          { id: "measure", label: "⊕ Measure", title: "Hover over a point to inspect its n / time / space + run age" },
        ] as const).map(tb => (
          <button key={tb.id} onClick={() => setTool(tb.id)} title={tb.title} style={{
            padding: "2px 8px", fontSize: 9, borderRadius: 4, cursor: "pointer",
            background: tool === tb.id ? "var(--color-accent)" : "var(--color-surface-1)",
            border: `1px solid ${tool === tb.id ? "var(--color-accent)" : "var(--color-border)"}`,
            color: tool === tb.id ? "#fff" : "var(--color-muted)",
          }}>{tb.label}</button>
        ))}

        <button onClick={() => { setRotX(28); setRotY(-40); setZoom(1); }} style={{
          padding: "2px 8px", fontSize: 9, borderRadius: 4, cursor: "pointer",
          background: "var(--color-surface-1)", border: "1px solid var(--color-border)", color: "var(--color-muted)",
        }}>⟲ Reset view</button>
        <button onClick={() => {
          const c = canvasRef.current; if (!c) return;
          const a = document.createElement("a");
          a.href = c.toDataURL("image/png");
          a.download = "benchmark-3d-history.png";
          a.click();
        }} style={{
          padding: "2px 8px", fontSize: 9, borderRadius: 4, cursor: "pointer",
          background: "var(--color-surface-1)", border: "1px solid var(--color-border)", color: "var(--color-muted)",
        }}>↓ PNG</button>
      </div>

      {/* Show-last-N slider — this is the "visible cap" knob the user asked for.
          Storage cap stays at GHOST_MAX=100; this just gates how many render. */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 9, color: "var(--color-muted)", fontFamily: "monospace", minWidth: 86 }}>
          Show last <strong style={{ color: "var(--color-text)" }}>{visibleRuns}</strong>
        </span>
        <input
          type="range" min={1} max={100} step={1}
          value={visibleRuns}
          onChange={e => setVisibleRuns(parseInt(e.target.value, 10))}
          style={{ flex: 1, cursor: "pointer" }}
          title="How many of the most recent stored runs to draw. Storage cap is 100."
        />
        <span style={{ fontSize: 9, color: "var(--color-muted)", fontFamily: "monospace", minWidth: 64, textAlign: "right" }}>
          of {totalStored} stored
        </span>
      </div>

      <canvas
        ref={canvasRef} width={800} height={420}
        style={{ width: "100%", height: "auto", aspectRatio: "800 / 420", display: "block",
          touchAction: "none", userSelect: "none",
          cursor: tool === "orbit" ? (dragRef.current ? "grabbing" : "grab") : (hoverInfo ? "pointer" : "crosshair") }}
        onMouseDown={onMouseDown} onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseEnter={() => { isHoveredRef.current = true; }}
        onMouseLeave={() => { isHoveredRef.current = false; dragRef.current = null; setHoverInfo(null); }}
        onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
        onDragStart={e => e.preventDefault()}
      />

      <p style={{ fontSize: 8, color: "var(--color-muted)", fontFamily: "monospace", marginTop: 4 }}>
        each polyline = one completed run · newest at full brightness, oldest at ~5% · current run drawn thicker · drift right over time = slower · band widening over time = noisier
        <br/>
        <span title="Hover the chart, then press a hotkey">
          hover + <kbd style={kbdStyle}>R</kbd> reset · <kbd style={kbdStyle}>X</kbd>/<kbd style={kbdStyle}>Y</kbd>/<kbd style={kbdStyle}>Z</kbd> axis-aligned view
        </span>
      </p>
    </div>
  );
}
