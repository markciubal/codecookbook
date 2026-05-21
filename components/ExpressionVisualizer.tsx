"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Play, Pause, SkipBack, SkipForward, RotateCcw } from "lucide-react";
import {
  shuntingYardSteps,
  postfixEvalSteps,
  randomInfix,
  randomPostfix,
  type ShuntingStep,
  type PostfixEvalStep,
  type Token,
} from "@/lib/expression-algorithms";

type Algorithm = "shunting-yard" | "postfix-eval";

const DEFAULT_INFIX = "3 + 4 * 2 / ( 1 - 5 ) ^ 2 ^ 3";
const DEFAULT_POSTFIX = "3 4 2 * 1 5 - / +";

const META: Record<Algorithm, { name: string; subtitle: string; defaultInput: string; placeholder: string }> = {
  "shunting-yard": {
    name: "Shunting Yard",
    subtitle: "Infix → Postfix (Dijkstra, 1961). Operator stack + output queue; precedence and associativity decide what to pop and when.",
    defaultInput: DEFAULT_INFIX,
    placeholder: "Enter an infix expression, e.g. 3 + 4 * 2",
  },
  "postfix-eval": {
    name: "Postfix Evaluation (FPE)",
    subtitle: "Postfix (RPN) → result. Single value stack. Number? push. Operator? pop two, apply, push result. The last value left on the stack is the answer.",
    defaultInput: DEFAULT_POSTFIX,
    placeholder: "Enter a postfix expression, e.g. 3 4 2 * +",
  },
};

// ──────────────────────────────────────────────────────────────────────────────
// Visual helpers
// ──────────────────────────────────────────────────────────────────────────────

function TokenChip({ tok, active, dim }: { tok: Token; active: boolean; dim: boolean }) {
  // Color-code by token kind to make structure obvious at a glance.
  const colorFor = (kind: Token["kind"]) =>
    kind === "number"   ? "var(--color-state-sorted)"
  : kind === "operator" ? "var(--color-state-compare)"
  : kind === "lparen"   ? "var(--color-state-pivot)"
  : kind === "rparen"   ? "var(--color-state-pivot)"
  :                       "var(--color-state-swap)";
  const color = colorFor(tok.kind);
  return (
    <span
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        minWidth: 28, padding: "3px 8px",
        fontSize: 13, fontFamily: "monospace", fontWeight: active ? 700 : 500,
        borderRadius: 5,
        background: active ? color : "var(--color-surface-1)",
        color: active ? "#fff" : color,
        border: `1px solid ${active ? color : "var(--color-border)"}`,
        opacity: dim ? 0.4 : 1,
        transition: "background 0.15s, color 0.15s, opacity 0.15s",
      }}
    >
      {tok.value}
    </span>
  );
}

function StackVisual({
  items, label, highlightTop, highlightTopColor,
}: {
  items: string[];
  label: string;
  highlightTop?: boolean;
  highlightTopColor?: string;
}) {
  // Stack bottom is at the start of the array; render bottom→top so the top
  // appears at the visual top of the column.
  return (
    <div style={{
      flex: 1, minWidth: 110,
      padding: "8px 10px",
      borderRadius: 7,
      background: "var(--color-surface-1)",
      border: "1px solid var(--color-border)",
    }}>
      <p style={{ fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--color-muted)", marginBottom: 6 }}>
        {label}
        <span style={{ marginLeft: 6, opacity: 0.6, fontWeight: 400 }}>· depth {items.length}</span>
      </p>
      <div style={{ display: "flex", flexDirection: "column-reverse", gap: 3, minHeight: 44 }}>
        {items.length === 0 && (
          <p style={{ fontSize: 11, color: "var(--color-muted)", fontFamily: "monospace", fontStyle: "italic" }}>(empty)</p>
        )}
        {items.map((v, i) => {
          const isTop = i === items.length - 1;
          return (
            <span
              key={i}
              style={{
                fontSize: 13, fontFamily: "monospace", fontWeight: 700,
                padding: "3px 8px",
                borderRadius: 4,
                background: isTop && highlightTop ? (highlightTopColor ?? "var(--color-accent-muted)") : "var(--color-surface-2)",
                border: `1px solid ${isTop && highlightTop ? "var(--color-accent)" : "var(--color-border)"}`,
                color: isTop && highlightTop ? (highlightTopColor ? "#fff" : "var(--color-accent)") : "var(--color-text)",
                textAlign: "center",
              }}
            >
              {v}
            </span>
          );
        })}
      </div>
      <p style={{ fontSize: 8, color: "var(--color-muted)", textAlign: "center", marginTop: 4, opacity: 0.6, fontFamily: "monospace" }}>
        ↑ top
      </p>
    </div>
  );
}

function Queue({
  items, label, highlightLast, highlightColor,
}: {
  items: string[];
  label: string;
  highlightLast?: boolean;
  highlightColor?: string;
}) {
  return (
    <div style={{
      padding: "8px 10px",
      borderRadius: 7,
      background: "var(--color-surface-1)",
      border: "1px solid var(--color-border)",
    }}>
      <p style={{ fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--color-muted)", marginBottom: 6 }}>
        {label}
        <span style={{ marginLeft: 6, opacity: 0.6, fontWeight: 400 }}>· {items.length} tokens</span>
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, minHeight: 30 }}>
        {items.length === 0 && (
          <p style={{ fontSize: 11, color: "var(--color-muted)", fontFamily: "monospace", fontStyle: "italic" }}>(empty)</p>
        )}
        {items.map((v, i) => {
          const isLast = i === items.length - 1;
          const highlight = isLast && highlightLast;
          return (
            <span
              key={i}
              style={{
                fontSize: 13, fontFamily: "monospace", fontWeight: 600,
                padding: "3px 8px",
                borderRadius: 4,
                background: highlight ? (highlightColor ?? "var(--color-accent-muted)") : "var(--color-surface-2)",
                border: `1px solid ${highlight ? "var(--color-accent)" : "var(--color-border)"}`,
                color: highlight ? "#fff" : "var(--color-text)",
                transition: "background 0.15s, color 0.15s",
              }}
            >
              {v}
            </span>
          );
        })}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Main visualizer
// ──────────────────────────────────────────────────────────────────────────────

export default function ExpressionVisualizer({
  algorithm,
  initialInput,
}: {
  algorithm: Algorithm;
  /** Optional initial input — lets routes pre-fill via ?expr=... query params */
  initialInput?: string;
}) {
  const meta = META[algorithm];
  const [input, setInput] = useState(initialInput ?? meta.defaultInput);
  const [stepIdx, setStepIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(700); // ms per step
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Recompute steps whenever the input or algorithm changes. Memoised so play
  // doesn't re-derive on every interval tick.
  const steps = useMemo(() => {
    if (algorithm === "shunting-yard") return shuntingYardSteps(input);
    return postfixEvalSteps(input);
  }, [input, algorithm]);

  // Auto-clamp stepIdx if input changes and current index is out of range.
  useEffect(() => {
    if (stepIdx >= steps.length) setStepIdx(Math.max(0, steps.length - 1));
  }, [steps.length, stepIdx]);

  // Play loop: schedule the next step after `speed` ms; stop at the end.
  useEffect(() => {
    if (!playing) return;
    if (stepIdx >= steps.length - 1) { setPlaying(false); return; }
    timerRef.current = setTimeout(() => setStepIdx(i => Math.min(i + 1, steps.length - 1)), speed);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [playing, stepIdx, speed, steps.length]);

  const cur = steps[Math.min(stepIdx, steps.length - 1)];
  const isLast = stepIdx >= steps.length - 1;
  const resetAll = useCallback(() => { setPlaying(false); setStepIdx(0); }, []);

  // Reach up to the nearest scrolling ancestor and add bottom padding equal
  // to the fixed playback bar's measured height, so the last items in the
  // page (description card, controls) can always be scrolled into view above
  // the bar instead of being hidden behind it.
  const anchorRef = useRef<HTMLDivElement | null>(null);
  const barRef = useRef<HTMLDivElement | null>(null);
  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    const anchor = anchorRef.current;
    const bar = barRef.current;
    if (!anchor || !bar) return;
    const isScrollable = (el: HTMLElement) => {
      const cs = getComputedStyle(el);
      return /(auto|scroll|overlay)/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 1;
    };
    let scrollParent: HTMLElement | null = anchor.parentElement;
    while (scrollParent && scrollParent !== document.body && !isScrollable(scrollParent)) {
      scrollParent = scrollParent.parentElement;
    }
    const target: HTMLElement = scrollParent ?? document.documentElement;
    const original = target.style.paddingBottom;
    const apply = () => {
      const h = bar.getBoundingClientRect().height;
      target.style.paddingBottom = `calc(${Math.ceil(h)}px + env(safe-area-inset-bottom, 0px))`;
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(bar);
    window.addEventListener("orientationchange", apply);
    return () => {
      target.style.paddingBottom = original;
      ro.disconnect();
      window.removeEventListener("orientationchange", apply);
    };
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: "24px 28px", maxWidth: 980, margin: "0 auto" }}>
      <div className="flex items-center gap-2 mb-1">
        <h1 className="text-xl font-bold" style={{ color: "var(--color-text)" }}>{meta.name}</h1>
      </div>
      <p className="text-xs mb-4" style={{ color: "var(--color-muted)", lineHeight: 1.5 }}>
        {meta.subtitle}
      </p>

      {/* Input ───────────────────────────────────────────────────────────── */}
      <div className="mb-4">
        <label className="text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--color-muted)" }}>
          Input
        </label>
        <div className="flex gap-2 mt-1">
          <input
            type="text"
            value={input}
            onChange={(e) => { setInput(e.target.value); resetAll(); }}
            placeholder={meta.placeholder}
            spellCheck={false}
            style={{
              flex: 1,
              fontFamily: "monospace", fontSize: 13,
              padding: "8px 12px", borderRadius: 6,
              background: "var(--color-surface-1)",
              border: "1px solid var(--color-border)",
              color: "var(--color-text)", outline: "none",
            }}
          />
          {/* Random-example button — builds a fresh expression each click via
              the tree-based generator so the result is always well-formed
              (and, for FPE, exactly one value left on the stack at the end). */}
          <button
            onClick={() => {
              const fresh = algorithm === "shunting-yard" ? randomInfix() : randomPostfix();
              setInput(fresh);
              resetAll();
            }}
            title={algorithm === "shunting-yard"
              ? "Generate a fresh random infix expression"
              : "Generate a fresh well-formed random postfix expression"}
            style={{
              fontSize: 11, fontFamily: "monospace", padding: "4px 12px",
              borderRadius: 6, cursor: "pointer",
              background: "var(--color-accent-muted)",
              border: "1px solid var(--color-accent)",
              color: "var(--color-accent)",
              fontWeight: 600,
            }}
          >
            🎲 random
          </button>
          <button
            onClick={() => { setInput(meta.defaultInput); resetAll(); }}
            title="Reset to the default example"
            style={{
              fontSize: 11, fontFamily: "monospace", padding: "4px 12px",
              borderRadius: 6, cursor: "pointer",
              background: "var(--color-surface-2)",
              border: "1px solid var(--color-border)",
              color: "var(--color-muted)",
            }}
          >
            example
          </button>
        </div>

        {/* Quick action: for shunting yard, offer to copy the postfix into the eval'r's input */}
        {algorithm === "shunting-yard" && isLast && (() => {
          const sy = cur as ShuntingStep;
          if (sy.outputQueue.length === 0) return null;
          const postfix = sy.outputQueue.join(" ");
          return (
            <p className="text-xs mt-2" style={{ color: "var(--color-muted)", fontFamily: "monospace" }}>
              postfix:{" "}
              <a
                href={`/expressions/postfix-eval?expr=${encodeURIComponent(postfix)}`}
                style={{ color: "var(--color-accent)", textDecoration: "underline" }}
              >
                {postfix}
              </a>{" "}
              — click to evaluate it
            </p>
          );
        })()}
      </div>

      {/* Token strip ─────────────────────────────────────────────────────── */}
      <div className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--color-muted)" }}>
          Tokens
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, padding: "8px 10px", borderRadius: 6, background: "var(--color-surface-1)", border: "1px solid var(--color-border)" }}>
          {cur.tokens.length === 0 && (
            <p style={{ fontSize: 11, color: "var(--color-muted)", fontFamily: "monospace", fontStyle: "italic" }}>(no tokens — empty input?)</p>
          )}
          {cur.tokens.map((tok) => {
            const active = tok.idx === cur.currentIdx;
            // Once a token has been processed (its idx < currentIdx, or
            // currentIdx is -1 meaning past the end), dim it slightly.
            const dim = cur.currentIdx === -1
              ? false
              : tok.idx < cur.currentIdx;
            return <TokenChip key={tok.idx} tok={tok} active={active} dim={dim} />;
          })}
        </div>
        <Legend />
      </div>

      {/* Algorithm state — different layout per algorithm */}
      <div className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--color-muted)" }}>
          State
        </p>
        {algorithm === "shunting-yard" ? (
          <ShuntingYardState step={cur as ShuntingStep} />
        ) : (
          <PostfixEvalState step={cur as PostfixEvalStep} />
        )}
      </div>

      {/* Step description */}
      <div style={{
        padding: "10px 12px", borderRadius: 6,
        background: "var(--color-surface-1)", border: "1px solid var(--color-border)",
        marginBottom: 12,
        minHeight: 48,
      }}>
        <p style={{ fontSize: 11, color: "var(--color-muted)", marginBottom: 4, fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          Step {stepIdx + 1} of {steps.length}
        </p>
        <p style={{ fontSize: 13, color: "var(--color-text)", lineHeight: 1.5 }}>
          {cur.description}
        </p>
      </div>

      {/* Invisible anchor — used by the useLayoutEffect above to find the
          nearest scrolling ancestor and add it bottom padding equal to the
          fixed bar's height, so content can scroll past the bar. */}
      <div ref={anchorRef} aria-hidden style={{ display: "none" }} />

      {/* Sticky playback bar — mobile-first overlay pinned to the bottom of
          the viewport. Centers and constrains on desktop, full-width on
          mobile, backdrop-blur so it floats over content without losing
          legibility. */}
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
        <div style={{ maxWidth: 960, margin: "0 auto", padding: "8px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
          {/* Progress bar w/ step counter */}
          <div className="flex items-center gap-2">
            <span style={{ fontSize: 9, fontFamily: "monospace", color: "var(--color-muted)", whiteSpace: "nowrap", minWidth: 56 }}>
              {stepIdx + 1} / {steps.length}
            </span>
            <div style={{ flex: 1, height: 5, background: "var(--color-surface-3)", borderRadius: 3, overflow: "hidden" }}>
              <div style={{
                height: "100%", width: `${((stepIdx + 1) / steps.length) * 100}%`,
                background: "var(--color-accent)", transition: "width 0.2s",
                borderRadius: 3,
              }} />
            </div>
          </div>

          {/* Transport row */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <button onClick={resetAll} title="Restart from step 0" style={ctrlBtn()}>
              <RotateCcw size={12} strokeWidth={2} />
            </button>
            <button onClick={() => { setStepIdx(0); setPlaying(false); }} title="First step" style={ctrlBtn()}>
              <SkipBack size={12} strokeWidth={2} />
            </button>
            <button
              onClick={() => setStepIdx(i => Math.max(0, i - 1))}
              disabled={stepIdx === 0}
              title="Previous step"
              style={ctrlBtn(stepIdx === 0)}
            >
              ◀
            </button>
            <button
              onClick={() => {
                if (isLast) { resetAll(); setPlaying(true); }
                else setPlaying(p => !p);
              }}
              title={playing ? "Pause" : isLast ? "Replay" : "Play"}
              style={{ ...ctrlBtn(), flex: 1, minWidth: 64, fontWeight: 700, color: "#fff", background: "var(--color-accent)", borderColor: "var(--color-accent)", justifyContent: "center" }}
            >
              {playing ? <Pause size={12} strokeWidth={2} /> : <Play size={12} strokeWidth={2} />}
            </button>
            <button
              onClick={() => setStepIdx(i => Math.min(steps.length - 1, i + 1))}
              disabled={isLast}
              title="Next step"
              style={ctrlBtn(isLast)}
            >
              ▶
            </button>
            <button onClick={() => setStepIdx(steps.length - 1)} title="Last step" style={ctrlBtn()}>
              <SkipForward size={12} strokeWidth={2} />
            </button>
            <label className="hidden sm:inline-flex" style={{ marginLeft: "auto", fontSize: 11, fontFamily: "monospace", color: "var(--color-muted)", alignItems: "center", gap: 6 }}>
              speed
              <input
                type="range" min={120} max={1500} step={20}
                value={1620 - speed}
                onChange={(e) => setSpeed(1620 - Number(e.target.value))}
                style={{ accentColor: "var(--color-accent)", cursor: "pointer", width: 110 }}
              />
            </label>
          </div>

          {/* Mobile-only speed row to keep the transport row tap-friendly */}
          <label className="sm:hidden flex items-center gap-2" style={{ fontSize: 10, fontFamily: "monospace", color: "var(--color-muted)" }}>
            <span style={{ whiteSpace: "nowrap" }}>slow</span>
            <input
              type="range" min={120} max={1500} step={20}
              value={1620 - speed}
              onChange={(e) => setSpeed(1620 - Number(e.target.value))}
              style={{ flex: 1, accentColor: "var(--color-accent)", cursor: "pointer" }}
            />
            <span style={{ whiteSpace: "nowrap" }}>fast</span>
          </label>
        </div>
      </div>
    </div>
  );
}

function ctrlBtn(disabled = false): React.CSSProperties {
  return {
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    width: 32, height: 28,
    fontSize: 12, fontFamily: "monospace",
    borderRadius: 5,
    background: "var(--color-surface-2)",
    border: "1px solid var(--color-border)",
    color: disabled ? "var(--color-muted)" : "var(--color-text)",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.4 : 1,
  };
}

function Legend() {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 6, fontSize: 9, fontFamily: "monospace", color: "var(--color-muted)" }}>
      <span style={{ color: "var(--color-state-sorted)" }}>● number</span>
      <span style={{ color: "var(--color-state-compare)" }}>● operator</span>
      <span style={{ color: "var(--color-state-pivot)" }}>● paren</span>
      <span style={{ opacity: 0.5 }}>dim = already processed · solid = current</span>
    </div>
  );
}

// ── Shunting Yard panel ──────────────────────────────────────────────────────
function ShuntingYardState({ step }: { step: ShuntingStep }) {
  return (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
      <StackVisual
        items={step.operatorStack}
        label="Operator stack"
        highlightTop={!!step.pushedToStack}
        highlightTopColor="var(--color-state-compare)"
      />
      <div style={{ flex: 2, minWidth: 200 }}>
        <Queue
          items={step.outputQueue}
          label="Output queue (postfix)"
          highlightLast={!!step.pushedToOutput || !!step.poppedToOutput}
          highlightColor={step.poppedToOutput ? "var(--color-state-compare)" : "var(--color-state-sorted)"}
        />
        {step.done && step.outputQueue.length > 0 && (
          <p style={{ fontSize: 13, fontFamily: "monospace", fontWeight: 700, marginTop: 8, padding: "6px 10px", borderRadius: 5, background: "var(--color-accent-muted)", color: "var(--color-accent)", border: "1px solid var(--color-accent)" }}>
            postfix: {step.outputQueue.join(" ")}
          </p>
        )}
      </div>
    </div>
  );
}

// ── Postfix Evaluator panel ──────────────────────────────────────────────────
function PostfixEvalState({ step }: { step: PostfixEvalStep }) {
  return (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
      <StackVisual
        items={step.valueStack.map((v) => formatNumber(v))}
        label="Value stack"
        highlightTop={step.pushedValue !== undefined}
        highlightTopColor={step.appliedOperator ? "var(--color-state-compare)" : "var(--color-state-sorted)"}
      />
      {step.result !== undefined && (
        <div style={{
          flex: 2, minWidth: 200,
          padding: "16px 18px",
          borderRadius: 7,
          background: "var(--color-accent-muted)",
          border: "1px solid var(--color-accent)",
          display: "flex", flexDirection: "column", justifyContent: "center",
        }}>
          <p style={{ fontSize: 10, color: "var(--color-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
            Result
          </p>
          <p style={{ fontSize: 24, fontWeight: 700, color: "var(--color-accent)", fontFamily: "monospace" }}>
            {formatNumber(step.result)}
          </p>
        </div>
      )}
    </div>
  );
}

// Compact number display: integers as-is, decimals trimmed to a sensible width.
function formatNumber(v: number): string {
  if (Number.isInteger(v)) return v.toString();
  // Trim trailing zeros from toFixed, while capping at 6 fractional digits.
  return Number(v.toFixed(6)).toString();
}
