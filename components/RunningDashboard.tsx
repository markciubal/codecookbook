"use client";

import { useEffect, useState } from "react";
import { Square, ChevronDown, ChevronRight, Activity, AlertTriangle, Bell, BellOff } from "lucide-react";

// Minimal shapes — mirror the relevant fields of BenchmarkVisualizer's types.
type CurvePoint = { n: number; timeMs: number; meanMs?: number; timedOut?: boolean };
type CurveData = Record<string, CurvePoint[]>;
type MemSample = { ts: number; used: number; total: number; algoId: string | null; n: number | null };

interface Props {
  algos: string[];
  currentAlgo: string | null;
  currentN: number | null;
  progress: { done: number; total: number };
  curveData: CurveData;
  memSamples: MemSample[];
  configLine: string;
  algoNames: Record<string, string>;
  algoColors: Record<string, string>;
  onStop: () => void;
  stopPending: boolean;
  tabHidden: boolean;
  workerIsolation: boolean;
  /** Wall-clock timestamp when the run started; powers the ETA estimator. */
  runStartedAt: number | null;
  /** Whether the user has armed the "notify when done" toggle. */
  notifyOnDone: boolean;
  /** Toggle handler — the parent owns permission requesting + firing. */
  onToggleNotify: () => void;
}

/*
 * RunningDashboard — a small floating dashboard shown only while a benchmark
 * is running. It is the single, consolidated home for live status: overall
 * progress, per-algorithm state (queued / running / timed-out) with a sparkline
 * of each algorithm's timing curve so far, and a live heap-usage sparkline.
 *
 * Layout: a bottom sheet taking ~1/3 of the viewport height on mobile (sitting
 * above the sticky run bar), and a compact bottom-right panel on desktop.
 */
export default function RunningDashboard({
  algos, currentAlgo, currentN, progress, curveData, memSamples,
  configLine, algoNames, algoColors, onStop, stopPending, tabHidden, workerIsolation,
  runStartedAt, notifyOnDone, onToggleNotify,
}: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;
  const nameOf = (id: string) => algoNames[id] ?? id;
  const colorOf = (id: string) => algoColors[id] ?? "var(--color-accent)";

  // Tick every second so the elapsed-time + remaining-time readouts update
  // smoothly even when no new (algo, size) unit has completed yet.
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);
  void tick; // referenced only to keep React aware we depend on the ticker

  // ETA model: assume each remaining (algo, size) unit costs the running
  // average time per completed unit. Rough — units aren't equal size — but
  // refines as more complete and is the same heuristic most progress bars use.
  const now = Date.now();
  const elapsedMs = runStartedAt != null ? Math.max(0, now - runStartedAt) : 0;
  const remainingUnits = Math.max(0, progress.total - progress.done);
  const avgPerUnit = progress.done > 0 ? elapsedMs / progress.done : 0;
  const remainingMs = progress.done > 0 && remainingUnits > 0 ? avgPerUnit * remainingUnits : null;
  const doneAt = remainingMs != null ? new Date(now + remainingMs) : null;

  const fmtDuration = (ms: number): string => {
    const s = Math.round(ms / 1000);
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60), rs = s % 60;
    if (m < 60) return rs > 0 ? `${m}m ${rs}s` : `${m}m`;
    const h = Math.floor(m / 60), rm = m % 60;
    return rm > 0 ? `${h}h ${rm}m` : `${h}h`;
  };

  // Order: current first, then algos with data, then queued.
  const ordered = [...algos].sort((a, b) => {
    const rank = (id: string) => id === currentAlgo ? 0 : (curveData[id]?.length ? 1 : 2);
    return rank(a) - rank(b);
  });

  const memValues = memSamples.map(s => s.used);

  return (
    <div
      className="fixed left-2 right-2 bottom-[76px] z-50 h-[33vh]
                 lg:left-auto lg:right-4 lg:bottom-4 lg:w-[400px] lg:h-auto lg:max-h-[62vh]
                 flex flex-col rounded-xl overflow-hidden print:hidden"
      style={{
        background: "color-mix(in srgb, var(--color-surface-1) 96%, transparent)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        border: "1px solid var(--color-border)",
        boxShadow: "0 12px 40px -8px rgba(0,0,0,0.45)",
      }}
    >
      {/* Header — progress + stop + collapse */}
      <div className="shrink-0 px-3 pt-2.5 pb-2" style={{ borderBottom: collapsed ? "none" : "1px solid var(--color-border)" }}>
        <div className="flex items-center gap-2">
          <Activity size={14} style={{ color: "var(--color-accent)" }} className="animate-pulse" />
          <span className="text-xs font-semibold" style={{ color: "var(--color-text)" }}>Benchmark running</span>
          <span className="text-xs font-mono ml-auto" style={{ color: "var(--color-muted)" }}>
            {progress.done}/{progress.total} ({pct}%)
          </span>
          <button
            onClick={onToggleNotify}
            title={notifyOnDone
              ? "Notify when done is ON — you'll get a browser notification (or a title-bar flash) when the benchmark finishes. Click to disable."
              : "Click to get a browser notification when the benchmark finishes. Falls back to a title-bar flash if notifications are unavailable."}
            className="inline-flex items-center gap-1 rounded px-1.5 py-0.5"
            style={{
              background: notifyOnDone ? "color-mix(in srgb, var(--color-accent) 18%, transparent)" : "transparent",
              color: notifyOnDone ? "var(--color-accent)" : "var(--color-muted)",
              border: `1px solid ${notifyOnDone ? "var(--color-accent)" : "var(--color-border)"}`,
              cursor: "pointer",
            }}
          >
            {notifyOnDone ? <Bell size={11} /> : <BellOff size={11} />}
          </button>
          <button
            onClick={onStop}
            disabled={stopPending}
            className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-semibold"
            style={{
              background: "rgba(239,68,68,0.15)", color: "#ef4444",
              border: "1px solid rgba(239,68,68,0.4)",
              cursor: stopPending ? "not-allowed" : "pointer", opacity: stopPending ? 0.5 : 1,
            }}
          >
            <Square size={9} fill="currentColor" /> {stopPending ? "Stopping…" : "Stop"}
          </button>
          <button
            onClick={() => setCollapsed(c => !c)}
            title={collapsed ? "Expand" : "Collapse"}
            className="rounded p-0.5"
            style={{ color: "var(--color-muted)", cursor: "pointer" }}
          >
            <ChevronDown size={14} style={{ transform: collapsed ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
          </button>
        </div>
        {/* Progress bar — layered:
            (1) base track,
            (2) accent fill with drifting barber-pole stripes,
            (3) glossy shimmer sweeping across the fill,
            (4) pulsing leading-edge dot showing where work is "live". */}
        <div className="mt-1.5 h-2 rounded-full relative overflow-hidden" style={{ background: "var(--color-surface-3)" }}>
          <div
            className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-500 overflow-hidden"
            style={{
              width: `${pct}%`,
              background: "var(--color-accent)",
              backgroundImage: "repeating-linear-gradient(45deg, rgba(255,255,255,0.18) 0 6px, transparent 6px 12px)",
              backgroundSize: "17px 17px",
              animation: "cc-stripe-drift 1.2s linear infinite",
            }}
          >
            {/* Glossy shimmer — narrow translucent band sliding right. */}
            <div
              className="absolute top-0 bottom-0"
              style={{
                left: 0,
                width: "40%",
                background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.35) 50%, transparent 100%)",
                animation: "cc-shimmer-sweep 2.2s ease-in-out infinite",
              }}
            />
          </div>
          {/* Leading-edge pulse — only while work remains (hidden at 0% and 100%). */}
          {pct > 0 && pct < 100 && (
            <div
              className="absolute top-1/2 pointer-events-none"
              style={{
                left: `${pct}%`,
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "var(--color-accent)",
                boxShadow: "0 0 8px 2px color-mix(in srgb, var(--color-accent) 60%, transparent)",
                transform: "translate(-50%, -50%)",
                animation: "cc-edge-pulse 1s ease-in-out infinite",
              }}
            />
          )}
        </div>
        {/* ETA row — elapsed · remaining · finish time */}
        <div className="mt-1 flex items-center gap-2 text-[10px] font-mono" style={{ color: "var(--color-muted)" }}>
          <span title="Time since the run started">⏱ {fmtDuration(elapsedMs)}</span>
          <span>·</span>
          {remainingMs != null ? (
            <>
              <span style={{ color: "var(--color-accent)" }} title="Estimated remaining — refines as more (algo, size) units complete">
                ≈ {fmtDuration(remainingMs)} left
              </span>
              {doneAt && (
                <span title="Estimated finish time">
                  · done {doneAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </span>
              )}
            </>
          ) : (
            <span style={{ opacity: 0.7 }}>estimating ETA…</span>
          )}
        </div>
        {!collapsed && (
          <div className="mt-1.5 text-xs font-mono truncate" style={{ color: "var(--color-muted)" }}>
            <span style={{ color: currentAlgo ? colorOf(currentAlgo) : "var(--color-muted)", fontWeight: 600 }}>
              {currentAlgo ? nameOf(currentAlgo) : "…"}
            </span>
            {" · "}n={currentN?.toLocaleString() ?? "…"}
          </div>
        )}
        {!collapsed && (
          <div className="mt-0.5 text-[10px] font-mono truncate" style={{ color: "var(--color-muted)", opacity: 0.8 }}>
            {configLine}
          </div>
        )}
      </div>

      {!collapsed && (
        <div className="flex-1 min-h-0 overflow-y-auto px-3 py-2 flex flex-col gap-1.5">
          {/* Warnings */}
          {tabHidden && (
            <Warn>Tab was hidden — background timings may be throttled/unreliable.</Warn>
          )}
          {stopPending && !workerIsolation && (
            <Warn>Stop is delayed — JS can&apos;t interrupt a main-thread sort. Will bail at the next boundary.</Warn>
          )}

          {/* Per-algorithm rows */}
          {ordered.map((id) => {
            const pts = curveData[id] ?? [];
            const isCurrent = id === currentAlgo;
            const timedOut = pts.some(p => p.timedOut);
            const status: "running" | "timeout" | "active" | "queued" =
              isCurrent ? "running" : timedOut ? "timeout" : pts.length ? "active" : "queued";
            const series = pts.map(p => p.meanMs ?? p.timeMs);
            const latest = series.length ? series[series.length - 1] : null;
            return (
              <div
                key={id}
                className="flex items-center gap-2 rounded-lg px-2 py-1"
                style={{
                  background: isCurrent ? "color-mix(in srgb, var(--color-accent) 12%, transparent)" : "var(--color-surface-2)",
                  border: `1px solid ${isCurrent ? "color-mix(in srgb, var(--color-accent) 40%, transparent)" : "var(--color-border)"}`,
                }}
              >
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: colorOf(id) }} />
                <span className="text-xs truncate" style={{ color: "var(--color-text)", minWidth: 0, flex: 1 }}>
                  {nameOf(id)}
                </span>
                <Sparkline values={series} color={colorOf(id)} />
                <span className="text-[10px] font-mono shrink-0 w-14 text-right" style={{ color: "var(--color-muted)" }}>
                  {latest != null ? `${latest < 1 ? latest.toFixed(2) : latest.toFixed(1)}ms` : ""}
                </span>
                <StatusChip status={status} />
              </div>
            );
          })}

          {/* Live heap sparkline */}
          {memValues.length > 1 && (
            <div className="mt-1 rounded-lg px-2 py-1.5" style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)" }}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] uppercase tracking-wider" style={{ color: "var(--color-muted)" }}>Live heap</span>
                <span className="text-[10px] font-mono" style={{ color: "var(--color-muted)" }}>
                  {(memValues[memValues.length - 1] / 1_048_576).toFixed(1)} MB
                </span>
              </div>
              <Sparkline values={memValues} color="#26a69a" width={360} height={28} fill />
            </div>
          )}

          {/* Accordion: simplified combined performance curve (all algos, log-log) */}
          <Accordion title="Performance curve" subtitle="all algorithms · log–log">
            <MiniCurve algos={ordered} curveData={curveData} colorOf={colorOf} />
          </Accordion>
        </div>
      )}
    </div>
  );
}

function Warn({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex items-start gap-1.5 rounded-lg px-2 py-1 text-[10px] leading-snug"
      style={{ background: "rgba(255,183,77,0.10)", border: "1px solid rgba(255,183,77,0.4)", color: "#ffb74d" }}
    >
      <AlertTriangle size={11} className="shrink-0 mt-0.5" />
      <span>{children}</span>
    </div>
  );
}

function StatusChip({ status }: { status: "running" | "timeout" | "active" | "queued" }) {
  const map = {
    running: { label: "running", bg: "color-mix(in srgb, var(--color-accent) 18%, transparent)", fg: "var(--color-accent)" },
    timeout: { label: "timeout", bg: "rgba(239,68,68,0.15)", fg: "#ef4444" },
    active:  { label: "done",    bg: "rgba(34,197,94,0.15)",  fg: "#22c55e" },
    queued:  { label: "queued",  bg: "var(--color-surface-3)", fg: "var(--color-muted)" },
  }[status];
  return (
    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-full shrink-0" style={{ background: map.bg, color: map.fg }}>
      {map.label}
    </span>
  );
}

/* Collapsible section for richer-but-optional data inside the running pane. */
function Accordion({ title, subtitle, children, defaultOpen = false }: {
  title: string; subtitle?: string; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mt-1 rounded-lg overflow-hidden" style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)" }}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-1.5 px-2 py-1.5"
        style={{ background: "transparent", border: "none", cursor: "pointer" }}
      >
        {open ? <ChevronDown size={12} style={{ color: "var(--color-muted)" }} /> : <ChevronRight size={12} style={{ color: "var(--color-muted)" }} />}
        <span className="text-[11px] font-semibold" style={{ color: "var(--color-text)" }}>{title}</span>
        {subtitle && <span className="text-[10px] ml-auto" style={{ color: "var(--color-muted)" }}>{subtitle}</span>}
      </button>
      {open && <div className="px-2 pb-2">{children}</div>}
    </div>
  );
}

/* Simplified multi-series performance curve: time (ms) vs n, both log-scaled,
 * one colored polyline per algorithm. Shares axes across all series. */
function MiniCurve({ algos, curveData, colorOf }: {
  algos: string[];
  curveData: CurveData;
  colorOf: (id: string) => string;
}) {
  const W = 300, H = 130, padL = 30, padR = 6, padT = 8, padB = 18;
  const log10 = (v: number) => Math.log10(Math.max(v, 1e-6));

  // Gather valid (n, time) points per algo.
  const series = algos
    .map(id => ({
      id,
      pts: (curveData[id] ?? [])
        .map(p => ({ n: p.n, t: p.meanMs ?? p.timeMs }))
        .filter(p => p.n > 0 && p.t > 0)
        .sort((a, b) => a.n - b.n),
    }))
    .filter(s => s.pts.length > 0);

  const allN = series.flatMap(s => s.pts.map(p => p.n));
  const allT = series.flatMap(s => s.pts.map(p => p.t));
  if (allN.length < 1) {
    return <div className="text-[10px] py-2 text-center" style={{ color: "var(--color-muted)" }}>No timings yet — results appear as sizes complete.</div>;
  }

  const xMin = log10(Math.min(...allN)), xMax = log10(Math.max(...allN));
  const yMin = log10(Math.min(...allT)), yMax = log10(Math.max(...allT));
  const xSpan = xMax - xMin || 1, ySpan = yMax - yMin || 1;
  const sx = (n: number) => padL + ((log10(n) - xMin) / xSpan) * (W - padL - padR);
  const sy = (t: number) => H - padB - ((log10(t) - yMin) / ySpan) * (H - padT - padB);

  const fmtN = (n: number) => n >= 1e6 ? `${(n / 1e6).toFixed(0)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(0)}k` : `${n}`;
  const fmtT = (t: number) => t >= 1000 ? `${(t / 1000).toFixed(1)}s` : t >= 1 ? `${t.toFixed(0)}ms` : `${t.toFixed(2)}ms`;

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: "block" }} preserveAspectRatio="none">
      {/* Axes */}
      <line x1={padL} y1={padT} x2={padL} y2={H - padB} stroke="var(--color-border)" strokeWidth={1} />
      <line x1={padL} y1={H - padB} x2={W - padR} y2={H - padB} stroke="var(--color-border)" strokeWidth={1} />
      {/* Axis labels (min/max only — keep it simple) */}
      <text x={padL} y={H - padB + 13} fontSize={8} fontFamily="monospace" fill="var(--color-muted)" textAnchor="start">{fmtN(Math.min(...allN))}</text>
      <text x={W - padR} y={H - padB + 13} fontSize={8} fontFamily="monospace" fill="var(--color-muted)" textAnchor="end">{fmtN(Math.max(...allN))}</text>
      <text x={padL - 3} y={H - padB} fontSize={8} fontFamily="monospace" fill="var(--color-muted)" textAnchor="end">{fmtT(Math.min(...allT))}</text>
      <text x={padL - 3} y={padT + 6} fontSize={8} fontFamily="monospace" fill="var(--color-muted)" textAnchor="end">{fmtT(Math.max(...allT))}</text>
      {/* Series */}
      {series.map(s => {
        const color = colorOf(s.id);
        const d = `M${s.pts.map(p => `${sx(p.n).toFixed(1)},${sy(p.t).toFixed(1)}`).join(" L")}`;
        return (
          <g key={s.id}>
            {s.pts.length > 1 && <path d={d} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />}
            {s.pts.map((p, i) => <circle key={i} cx={sx(p.n)} cy={sy(p.t)} r={1.6} fill={color} />)}
          </g>
        );
      })}
    </svg>
  );
}

/* Tiny inline SVG sparkline, normalized to its own min/max. */
function Sparkline({ values, color, width = 64, height = 18, fill = false }: {
  values: number[]; color: string; width?: number; height?: number; fill?: boolean;
}) {
  if (values.length < 2) {
    return <svg width={width} height={height} className="shrink-0" style={{ width, height }} />;
  }
  const min = Math.min(...values), max = Math.max(...values);
  const span = max - min || 1;
  const stepX = width / (values.length - 1);
  const pad = 2;
  const y = (v: number) => height - pad - ((v - min) / span) * (height - pad * 2);
  const pts = values.map((v, i) => `${(i * stepX).toFixed(1)},${y(v).toFixed(1)}`);
  const line = `M${pts.join(" L")}`;
  const area = `${line} L${width},${height} L0,${height} Z`;
  return (
    <svg width={width} height={height} className="shrink-0" style={{ width, height, display: "block" }} preserveAspectRatio="none">
      {fill && <path d={area} fill={color} opacity={0.15} />}
      <path d={line} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={(values.length - 1) * stepX} cy={y(values[values.length - 1])} r={1.8} fill={color} />
    </svg>
  );
}
