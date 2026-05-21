"use client";

import type React from "react";
import { Play, Pause, SkipForward, SkipBack, RotateCcw } from "lucide-react";

// Animation pace bounds, in milliseconds per step. The slider and the numeric
// input both clamp to this range.
export const SPEED_MIN = 50;
export const SPEED_MAX = 2000;
const clampSpeed = (n: number) => Math.max(SPEED_MIN, Math.min(SPEED_MAX, n));

/*
 * Shared full-viewport shell for the interactive tree / step-through
 * visualizers (AVL, Red-Black, 2-3, Segment Tree, Trie).
 *
 * Layout: a fixed header on top, then a body that fills the rest of the
 * viewport height (h-dvh). The body splits into a large canvas pane on the
 * left and a scrollable sidebar on the right that holds ALL controls plus the
 * details/reference panels. On narrow screens the two panes stack vertically.
 */
export function StepTreeLayout({
  icon,
  title,
  badges,
  description,
  canvas,
  sidebar,
}: {
  icon: React.ReactNode;
  title: string;
  badges?: React.ReactNode;
  description: React.ReactNode;
  canvas: React.ReactNode;
  sidebar: React.ReactNode;
}) {
  return (
    <div className="flex flex-col h-dvh" style={{ background: "var(--color-bg)" }}>
      {/* Header */}
      <div className="px-5 pt-5 pb-3 shrink-0" style={{ borderBottom: "1px solid var(--color-border)" }}>
        <div className="flex flex-wrap items-center gap-2 mb-1">
          {icon}
          <h1 className="text-2xl font-bold">{title}</h1>
          {badges}
        </div>
        <p className="text-sm" style={{ color: "var(--color-muted)" }}>
          {description}
        </p>
      </div>

      {/* Body — canvas left, sidebar right */}
      <div className="flex flex-1 min-h-0 flex-col lg:flex-row">
        <div className="flex-1 min-h-0 overflow-auto p-4">
          {canvas}
        </div>
        <aside
          className="w-full lg:w-[380px] shrink-0 overflow-y-auto p-4 flex flex-col gap-4"
          style={{
            borderLeft: "1px solid var(--color-border)",
            background: "var(--color-surface-1)",
          }}
        >
          {sidebar}
        </aside>
      </div>
    </div>
  );
}

/*
 * Step navigation row — Prev / Play-Pause / Next / Restart + a step counter and
 * a speed slider. Drives any visualizer whose animation is a `steps[]` array
 * indexed by `stepIdx`. Includes a "previous step" control so users can scrub
 * backward as well as forward.
 */
export function StepNav({
  stepIdx,
  stepCount,
  isPlaying,
  setIsPlaying,
  setStepIdx,
  speed,
  setSpeed,
}: {
  stepIdx: number;
  stepCount: number;
  isPlaying: boolean;
  setIsPlaying: (fn: (p: boolean) => boolean) => void;
  setStepIdx: (fn: (p: number) => number) => void;
  speed: number;
  setSpeed: (n: number) => void;
}) {
  if (stepCount === 0) return null;
  const atStart = stepIdx <= 0;
  const atEnd = stepIdx >= stepCount - 1;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2 items-center">
        <StepBtn
          onClick={() => { setIsPlaying(() => false); setStepIdx((p) => Math.max(0, p - 1)); }}
          disabled={atStart}
          icon={<SkipBack size={13} />}
          title="Previous step"
        >
          Prev
        </StepBtn>
        <StepBtn
          onClick={() => setIsPlaying((p) => !p)}
          disabled={atEnd && !isPlaying}
          icon={isPlaying ? <Pause size={13} /> : <Play size={13} />}
          primary
        >
          {isPlaying ? "Pause" : "Play"}
        </StepBtn>
        <StepBtn
          onClick={() => { setIsPlaying(() => false); setStepIdx((p) => Math.min(p + 1, stepCount - 1)); }}
          disabled={atEnd}
          icon={<SkipForward size={13} />}
          title="Next step"
        >
          Next
        </StepBtn>
        <StepBtn
          onClick={() => { setIsPlaying(() => false); setStepIdx(() => 0); }}
          icon={<RotateCcw size={13} />}
          title="Restart"
        >
          Restart
        </StepBtn>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-xs font-mono shrink-0" style={{ color: "var(--color-muted)" }}>
          Step {stepIdx + 1} / {stepCount}
        </span>
        {/* Scrubber — drag to any step, forward or backward */}
        <input
          type="range"
          min={0}
          max={stepCount - 1}
          value={stepIdx}
          onChange={(e) => { setIsPlaying(() => false); setStepIdx(() => Number(e.target.value)); }}
          className="flex-1"
          style={{ accentColor: "var(--color-accent)", cursor: "pointer" }}
        />
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs shrink-0" style={{ color: "var(--color-muted)" }}>Speed</span>
        {/* Slider runs fast → slow left-to-right (inverted: higher position = lower ms). */}
        <input
          type="range"
          min={SPEED_MIN}
          max={SPEED_MAX}
          step={10}
          value={SPEED_MIN + SPEED_MAX - speed}
          onChange={(e) => setSpeed(clampSpeed(SPEED_MIN + SPEED_MAX - Number(e.target.value)))}
          className="flex-1"
          style={{ accentColor: "var(--color-accent)", cursor: "pointer" }}
        />
        {/* Type an exact pace in ms/step. */}
        <input
          type="number"
          min={SPEED_MIN}
          max={SPEED_MAX}
          step={10}
          value={speed}
          onChange={(e) => { const v = Number(e.target.value); if (!Number.isNaN(v)) setSpeed(clampSpeed(v)); }}
          className="w-16 rounded px-2 py-1 text-xs font-mono text-right outline-none shrink-0"
          style={{ background: "var(--color-surface-3)", border: "1px solid var(--color-border)", color: "var(--color-text)" }}
        />
        <span className="text-xs font-mono shrink-0" style={{ color: "var(--color-muted)" }}>ms</span>
      </div>
    </div>
  );
}

/* Boxed panel used for sidebar sections (legend, invariants, log, reference). */
export function SidebarSection({
  title,
  children,
  scroll,
}: {
  title: string;
  children: React.ReactNode;
  scroll?: boolean;
}) {
  return (
    <div
      className="rounded-xl p-4"
      style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)" }}
    >
      <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--color-muted)" }}>
        {title}
      </p>
      <div className={scroll ? "max-h-44 overflow-y-auto" : undefined}>{children}</div>
    </div>
  );
}

/* Status / current-step message bar shown at the top of the sidebar. */
export function StepMessage({
  children,
  badge,
  badgeColor,
}: {
  children: React.ReactNode;
  badge?: string;
  badgeColor?: string;
}) {
  return (
    <div
      className="rounded-lg px-3 py-2.5 text-sm flex items-center gap-2 flex-wrap"
      style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)" }}
    >
      {badge && (
        <span
          className="text-xs font-mono px-2 py-0.5 rounded-full font-bold shrink-0"
          style={{ background: `${badgeColor ?? "var(--color-accent)"}22`, color: badgeColor ?? "var(--color-accent)" }}
        >
          {badge}
        </span>
      )}
      <span style={{ color: "var(--color-accent)" }}>{children}</span>
    </div>
  );
}

/*
 * Traversal controls — a row of buttons that trigger an animated tree walk.
 * `kinds` lists the traversals applicable to a given structure (binary trees
 * support all four; multi-way trees omit the ones that don't apply).
 */
export type TraversalKind = "bfs" | "pre" | "in" | "post";

export const TRAVERSAL_LABELS: Record<TraversalKind, string> = {
  bfs: "BFS (level)",
  pre: "DFS pre-order",
  in: "DFS in-order",
  post: "DFS post-order",
};

export function TraverseControls({
  kinds,
  onTraverse,
  disabled,
}: {
  kinds: TraversalKind[];
  onTraverse: (kind: TraversalKind) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {kinds.map((k) => (
        <StepBtn key={k} onClick={() => onTraverse(k)} disabled={disabled}>
          {TRAVERSAL_LABELS[k]}
        </StepBtn>
      ))}
    </div>
  );
}

export function StepBtn({
  children,
  onClick,
  primary,
  disabled,
  icon,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  primary?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
      style={{
        background: primary ? "var(--color-accent)" : "var(--color-surface-3)",
        color: primary ? "#fff" : disabled ? "var(--color-muted)" : "var(--color-text)",
        border: `1px solid ${primary ? "var(--color-accent)" : "var(--color-border)"}`,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {icon}
      {children}
    </button>
  );
}
