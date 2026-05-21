"use client";

import { Play, Pause, SkipBack, SkipForward, ChevronLeft, ChevronRight, RotateCcw, Timer, ChevronDown } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type React from "react";

export const SPEED_MIN = 20;   // fastest ms/step
export const SPEED_MAX = 1200; // slowest ms/step

const FINISH_PRESETS = [
  { label: "1s",  ms: 1_000 },
  { label: "5s",  ms: 5_000 },
  { label: "10s", ms: 10_000 },
  { label: "15s", ms: 15_000 },
  { label: "30s", ms: 30_000 },
  { label: "1m",  ms: 60_000 },
  { label: "5m",  ms: 300_000 },
];

interface Props {
  stepCount: number;
  stepIdx: number;
  setStepIdx: React.Dispatch<React.SetStateAction<number>>;
  isPlaying: boolean;
  setIsPlaying: React.Dispatch<React.SetStateAction<boolean>>;
  speed: number;
  setSpeed: React.Dispatch<React.SetStateAction<number>>;
  onReset: () => void;
  resetLabel?: string;
}

/*
 * Sticky playback bar — always pinned to the bottom of the viewport so the
 * play/pause/scrub/speed controls stay reachable no matter how far the user
 * has scrolled. Mobile-first: full-width bar with a backdrop-blur background;
 * on desktop it centers and maxes out its width.
 *
 * The bar is split into a primary row (scrubber + transport buttons + play —
 * always visible) and an expandable secondary row (speed slider + finish-in
 * presets — toggle to keep the mobile footprint small).
 *
 * A spacer is rendered in the document flow at the original location to
 * reserve the space the fixed bar occupies, so page content doesn't get
 * permanently hidden behind it.
 */
export default function PlaybackControls({
  stepCount,
  stepIdx,
  setStepIdx,
  isPlaying,
  setIsPlaying,
  speed,
  setSpeed,
  onReset,
  resetLabel = "Reset",
}: Props) {
  const canBack    = stepIdx > 0;
  const canForward = stepIdx < stepCount - 1;
  const [expanded, setExpanded] = useState(false);

  // Refs used to measure the bar's actual height and apply matching
  // padding-bottom to the nearest scrolling ancestor of the original render
  // location — so the last bit of page content can always scroll past the
  // fixed bar instead of being permanently hidden behind it.
  const anchorRef = useRef<HTMLDivElement | null>(null);
  const barRef    = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    const anchor = anchorRef.current;
    const bar = barRef.current;
    if (!anchor || !bar) return;

    // Walk up from the anchor until we find an element that actually scrolls
    // vertically. Fall back to documentElement if no overflow-y container is
    // found (e.g. the page just scrolls the window).
    const isScrollable = (el: HTMLElement) => {
      const cs = getComputedStyle(el);
      return /(auto|scroll|overlay)/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 1;
    };
    let scrollParent: HTMLElement | null = anchor.parentElement;
    while (scrollParent && scrollParent !== document.body && !isScrollable(scrollParent)) {
      scrollParent = scrollParent.parentElement;
    }
    const target: HTMLElement = scrollParent ?? document.documentElement;

    // Snapshot the original padding so we can restore exactly on unmount.
    const originalPadding = target.style.paddingBottom;

    // Apply padding equal to the bar's measured height + safe-area inset.
    // ResizeObserver keeps this synced as the bar's height changes (expanding
    // the secondary row, mobile rotation, etc.).
    const apply = () => {
      const h = bar.getBoundingClientRect().height;
      target.style.paddingBottom = `calc(${Math.ceil(h)}px + env(safe-area-inset-bottom, 0px))`;
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(bar);
    window.addEventListener("orientationchange", apply);

    return () => {
      target.style.paddingBottom = originalPadding;
      ro.disconnect();
      window.removeEventListener("orientationchange", apply);
    };
  }, []);
  // Also re-measure when the expanded state flips (height changes) so
  // ResizeObserver doesn't have to wait for a paint.
  useEffect(() => {
    const bar = barRef.current;
    if (!bar) return;
    bar.dispatchEvent(new Event("resize"));
  }, [expanded]);

  return (
    <>
      {/* Invisible anchor — its position in the document tree is what we use
          to find the scrolling ancestor that needs bottom padding. */}
      <div ref={anchorRef} aria-hidden style={{ display: "none" }} />

      <div
        ref={barRef}
        className="print:hidden"
        style={{
          position: "fixed",
          left: 0, right: 0, bottom: 0,
          zIndex: 50,
          paddingBottom: "env(safe-area-inset-bottom, 0)",
          background: "color-mix(in srgb, var(--color-surface-1) 92%, transparent)",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
          borderTop: "1px solid var(--color-border)",
          boxShadow: "0 -8px 24px -10px rgba(0,0,0,0.25)",
        }}
      >
        <div
          style={{
            maxWidth: 960,
            margin: "0 auto",
            padding: "8px 12px",
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          {/* Progress scrubber — always visible, full width */}
          <div className="flex items-center gap-2">
            <span style={{ fontSize: 9, fontFamily: "monospace", color: "var(--color-muted)", whiteSpace: "nowrap", minWidth: 56 }}>
              {stepIdx + 1} / {stepCount || 1}
            </span>
            <input
              type="range"
              min={0}
              max={Math.max(0, stepCount - 1)}
              value={stepIdx}
              onChange={(e) => { setIsPlaying(false); setStepIdx(Number(e.target.value)); }}
              className="w-full"
              style={{ accentColor: "var(--color-accent)", cursor: "pointer", flex: 1 }}
            />
          </div>

          {/* Primary transport row — buttons sized for thumb-tap comfort on mobile */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Btn onClick={() => { setIsPlaying(false); setStepIdx(0); }} disabled={!canBack} title="Restart">
              <SkipBack size={14} strokeWidth={1.75} />
            </Btn>
            <Btn onClick={() => { setIsPlaying(false); setStepIdx((p) => Math.max(0, p - 1)); }} disabled={!canBack} title="Previous step">
              <ChevronLeft size={14} strokeWidth={1.75} />
            </Btn>
            <Btn primary onClick={() => setIsPlaying((p) => !p)} disabled={!canForward} style={{ flex: 1, minWidth: 88, justifyContent: "center" }}>
              {isPlaying
                ? <><Pause size={13} strokeWidth={1.75} /> Pause</>
                : <><Play  size={13} strokeWidth={1.75} /> Play</>}
            </Btn>
            <Btn onClick={() => { setIsPlaying(false); setStepIdx((p) => Math.min(stepCount - 1, p + 1)); }} disabled={!canForward} title="Next step">
              <ChevronRight size={14} strokeWidth={1.75} />
            </Btn>
            <Btn onClick={() => { setIsPlaying(false); setStepIdx(stepCount - 1); }} disabled={!canForward} title="Last step">
              <SkipForward size={14} strokeWidth={1.75} />
            </Btn>
            <Btn onClick={onReset} title={resetLabel}>
              <RotateCcw size={13} strokeWidth={1.75} />
              <span className="hidden sm:inline" style={{ marginLeft: 4 }}>{resetLabel}</span>
            </Btn>
            {/* Expand toggle for the secondary row */}
            <Btn
              onClick={() => setExpanded((e) => !e)}
              title={expanded ? "Hide speed/presets" : "Show speed/presets"}
              style={{ marginLeft: "auto" }}
            >
              <ChevronDown size={13} strokeWidth={1.75}
                style={{ transform: expanded ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
            </Btn>
          </div>

          {/* Secondary row — speed + finish-in presets. Collapsible on small
              screens to keep the bar's footprint minimal until the user wants
              to tune playback speed. */}
          {expanded && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingTop: 4, borderTop: "1px dashed var(--color-border)" }}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs" style={{ color: "var(--color-muted)", whiteSpace: "nowrap" }}>Slow</span>
                <input
                  type="range"
                  min={SPEED_MIN}
                  max={SPEED_MAX}
                  step={10}
                  value={SPEED_MAX + SPEED_MIN - speed}
                  onChange={(e) => setSpeed(SPEED_MAX + SPEED_MIN - Number(e.target.value))}
                  style={{ flex: 1, minWidth: 120, accentColor: "var(--color-accent)", cursor: "pointer" }}
                />
                <span className="text-xs" style={{ color: "var(--color-muted)", whiteSpace: "nowrap" }}>Fast</span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 text-xs" style={{ color: "var(--color-muted)", whiteSpace: "nowrap" }}>
                  <Timer size={12} strokeWidth={1.75} /> Finish in
                </span>
                {FINISH_PRESETS.map(({ label, ms }) => (
                  <button
                    key={label}
                    onClick={() => {
                      const remaining = Math.max(1, stepCount - stepIdx - 1);
                      setSpeed(Math.max(SPEED_MIN, Math.min(SPEED_MAX, Math.round(ms / remaining))));
                      setIsPlaying(true);
                    }}
                    disabled={!canForward}
                    className="px-2 py-0.5 rounded text-xs font-mono transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{
                      background: "var(--color-surface-3)",
                      border: "1px solid var(--color-border)",
                      color: "var(--color-muted)",
                      cursor: "pointer",
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ── Internal Btn ──────────────────────────────────────────────────────────────

function Btn({
  children, onClick, disabled, primary, style, title,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  primary?: boolean;
  style?: React.CSSProperties;
  /** Native browser tooltip on hover — useful when the button shows only an icon */
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      style={{
        background: primary ? "var(--color-accent)" : "var(--color-surface-3)",
        color: primary ? "#fff" : "var(--color-text)",
        border: "1px solid " + (primary ? "var(--color-accent)" : "var(--color-border)"),
        cursor: disabled ? "not-allowed" : "pointer",
        // Mobile-friendly minimum tap size — keeps icon-only buttons easy to hit.
        minHeight: 32, minWidth: 32,
        ...style,
      }}
    >
      {children}
    </button>
  );
}
