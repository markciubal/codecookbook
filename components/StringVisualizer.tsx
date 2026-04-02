"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Search } from "lucide-react";
import PlaybackControls from "./PlaybackControls";
import {
  getStringSteps,
  type StringAlgorithm,
  type StringStep,
  type CharState,
} from "@/lib/string-algorithms";

// ── Constants ─────────────────────────────────────────────────────────────────

const DEFAULT_TEXT = "ABABDABACDABABCABAB";
const DEFAULT_PATTERN = "ABABCABAB";

const CELL_SIZE = 32; // px
const CELL_GAP = 3;   // px
const CELL_STEP = CELL_SIZE + CELL_GAP;

// ── Meta info ─────────────────────────────────────────────────────────────────

const META: Record<
  StringAlgorithm,
  { name: string; time: string; space: string; description: string }
> = {
  kmp: {
    name: "Knuth-Morris-Pratt",
    time: "O(n+m)",
    space: "O(m)",
    description:
      "Builds a failure function to skip redundant comparisons after mismatches.",
  },
  "rabin-karp": {
    name: "Rabin-Karp",
    time: "O(n+m) avg",
    space: "O(1)",
    description:
      "Rolling polynomial hash slides over the text; only verify on hash match.",
  },
  "boyer-moore": {
    name: "Boyer-Moore",
    time: "O(n/m) best",
    space: "O(σ)",
    description:
      "Scans pattern right-to-left and uses bad-character shifts to skip large chunks.",
  },
};

// ── Character state → style ───────────────────────────────────────────────────

function getCharStyle(state: CharState): {
  background: string;
  color: string;
  fontWeight?: string;
  border: string;
} {
  switch (state) {
    case "comparing":
      return {
        background: "var(--color-state-compare)",
        color: "#fff",
        border: "2px solid var(--color-state-compare)",
      };
    case "match":
      return {
        background: "#22c55e",
        color: "#fff",
        border: "2px solid #16a34a",
      };
    case "mismatch":
      return {
        background: "var(--color-state-swap)",
        color: "#fff",
        border: "2px solid var(--color-state-swap)",
      };
    case "skip":
      return {
        background: "var(--color-surface-3)",
        color: "var(--color-muted)",
        border: "2px solid var(--color-border)",
      };
    case "found":
      return {
        background: "var(--color-accent)",
        color: "#fff",
        fontWeight: "700",
        border: "2px solid var(--color-accent)",
      };
    default:
      return {
        background: "var(--color-surface-2)",
        color: "var(--color-text)",
        border: "2px solid var(--color-border)",
      };
  }
}

// ── Char Box ──────────────────────────────────────────────────────────────────

function CharBox({
  char,
  state,
  index,
  showIndex = false,
}: {
  char: string;
  state: CharState;
  index: number;
  showIndex?: boolean;
}) {
  const style = getCharStyle(state);
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
      {showIndex && (
        <span
          style={{
            fontSize: 9,
            color: "var(--color-muted)",
            lineHeight: 1,
            fontFamily: "var(--font-mono)",
          }}
        >
          {index}
        </span>
      )}
      <div
        style={{
          width: CELL_SIZE,
          height: CELL_SIZE,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 4,
          fontFamily: "var(--font-mono)",
          fontSize: 13,
          fontWeight: style.fontWeight ?? "500",
          transition: "background 0.15s, border-color 0.15s",
          flexShrink: 0,
          ...style,
        }}
      >
        {char}
      </div>
    </div>
  );
}

// ── KMP Auxiliary Panel ───────────────────────────────────────────────────────

function KMPPanel({
  step,
  pattern,
}: {
  step: StringStep;
  pattern: string;
}) {
  if (!step.failureTable) return null;

  return (
    <div
      style={{
        background: "var(--color-surface-1)",
        border: "1px solid var(--color-border)",
        borderRadius: 8,
        padding: "12px 16px",
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: "var(--color-muted)",
          marginBottom: 8,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}
      >
        Failure Function Table
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", fontSize: 11, fontFamily: "var(--font-mono)" }}>
          <thead>
            <tr>
              <td
                style={{
                  padding: "2px 6px",
                  color: "var(--color-muted)",
                  fontSize: 10,
                  whiteSpace: "nowrap",
                }}
              >
                idx
              </td>
              {pattern.split("").map((_, i) => (
                <td
                  key={i}
                  style={{
                    padding: "2px 6px",
                    textAlign: "center",
                    color: "var(--color-muted)",
                    minWidth: 28,
                  }}
                >
                  {i}
                </td>
              ))}
            </tr>
            <tr>
              <td
                style={{
                  padding: "2px 6px",
                  color: "var(--color-muted)",
                  fontSize: 10,
                  whiteSpace: "nowrap",
                }}
              >
                pat
              </td>
              {pattern.split("").map((ch, i) => (
                <td key={i} style={{ padding: "2px 6px", textAlign: "center" }}>
                  <span
                    style={{
                      display: "inline-block",
                      width: 22,
                      height: 22,
                      lineHeight: "22px",
                      textAlign: "center",
                      borderRadius: 4,
                      background:
                        step.failureHighlight === i
                          ? "var(--color-state-compare)"
                          : "var(--color-surface-2)",
                      color: step.failureHighlight === i ? "#fff" : "var(--color-text)",
                      border:
                        step.failureHighlight === i
                          ? "1px solid var(--color-state-compare)"
                          : "1px solid var(--color-border)",
                    }}
                  >
                    {ch}
                  </span>
                </td>
              ))}
            </tr>
            <tr>
              <td
                style={{
                  padding: "2px 6px",
                  color: "var(--color-muted)",
                  fontSize: 10,
                  whiteSpace: "nowrap",
                }}
              >
                fail
              </td>
              {step.failureTable.map((val, i) => (
                <td key={i} style={{ padding: "2px 6px", textAlign: "center" }}>
                  <span
                    style={{
                      display: "inline-block",
                      width: 22,
                      height: 22,
                      lineHeight: "22px",
                      textAlign: "center",
                      borderRadius: 4,
                      background:
                        step.failureHighlight === i
                          ? "var(--color-accent-muted)"
                          : "var(--color-surface-3)",
                      color:
                        step.failureHighlight === i
                          ? "var(--color-accent)"
                          : "var(--color-muted)",
                      border:
                        step.failureHighlight === i
                          ? "1px solid var(--color-accent)"
                          : "1px solid var(--color-border)",
                      fontWeight: step.failureHighlight === i ? 700 : 400,
                    }}
                  >
                    {val}
                  </span>
                </td>
              ))}
            </tr>
          </thead>
        </table>
      </div>
    </div>
  );
}

// ── Rabin-Karp Auxiliary Panel ────────────────────────────────────────────────

function RabinKarpPanel({ step }: { step: StringStep }) {
  const { textHash, patternHash, windowStart, windowEnd } = step;

  if (textHash === undefined || patternHash === undefined) return null;

  const hashMatch = textHash === patternHash;

  return (
    <div
      style={{
        background: "var(--color-surface-1)",
        border: "1px solid var(--color-border)",
        borderRadius: 8,
        padding: "12px 16px",
        display: "flex",
        flexWrap: "wrap",
        gap: 16,
        alignItems: "center",
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: "var(--color-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          flexShrink: 0,
        }}
      >
        Hash Comparison
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span style={{ fontSize: 10, color: "var(--color-muted)" }}>
            Window [{windowStart ?? "—"}..{windowEnd ?? "—"}]
          </span>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 13,
              padding: "3px 8px",
              borderRadius: 4,
              background: hashMatch ? "#22c55e20" : "var(--color-surface-2)",
              border: hashMatch ? "1px solid #22c55e" : "1px solid var(--color-border)",
              color: hashMatch ? "#16a34a" : "var(--color-text)",
            }}
          >
            {textHash.toLocaleString()}
          </span>
        </div>

        <span style={{ color: "var(--color-muted)", fontSize: 16, lineHeight: 1 }}>
          {hashMatch ? "=" : "≠"}
        </span>

        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span style={{ fontSize: 10, color: "var(--color-muted)" }}>Pattern hash</span>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 13,
              padding: "3px 8px",
              borderRadius: 4,
              background: hashMatch ? "#22c55e20" : "var(--color-surface-2)",
              border: hashMatch ? "1px solid #22c55e" : "1px solid var(--color-border)",
              color: hashMatch ? "#16a34a" : "var(--color-text)",
            }}
          >
            {patternHash.toLocaleString()}
          </span>
        </div>

        <span
          style={{
            fontSize: 18,
            marginLeft: 4,
            color: hashMatch ? "#22c55e" : "var(--color-state-swap)",
          }}
        >
          {hashMatch ? "✓" : "✗"}
        </span>
      </div>
    </div>
  );
}

// ── Boyer-Moore Auxiliary Panel ───────────────────────────────────────────────

function BoyerMoorePanel({ step }: { step: StringStep }) {
  if (!step.badCharTable) return null;

  const entries = Object.entries(step.badCharTable);

  return (
    <div
      style={{
        background: "var(--color-surface-1)",
        border: "1px solid var(--color-border)",
        borderRadius: 8,
        padding: "12px 16px",
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: "var(--color-muted)",
          marginBottom: 8,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}
      >
        Bad Character Table
        {step.shift !== undefined && (
          <span
            style={{
              marginLeft: 12,
              fontWeight: 700,
              color: "var(--color-accent)",
              fontSize: 12,
            }}
          >
            Shift = {step.shift}
          </span>
        )}
      </div>
      {entries.length === 0 ? (
        <span style={{ color: "var(--color-muted)", fontSize: 12 }}>Building...</span>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {entries.map(([char, idx]) => (
            <div
              key={char}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 2,
              }}
            >
              <span
                style={{
                  display: "inline-block",
                  width: 26,
                  height: 26,
                  lineHeight: "26px",
                  textAlign: "center",
                  borderRadius: 4,
                  background: "var(--color-surface-2)",
                  border: "1px solid var(--color-border)",
                  fontFamily: "var(--font-mono)",
                  fontSize: 12,
                }}
              >
                {char}
              </span>
              <span
                style={{
                  fontSize: 10,
                  color: "var(--color-accent)",
                  fontFamily: "var(--font-mono)",
                  fontWeight: 600,
                }}
              >
                {idx}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Legend ────────────────────────────────────────────────────────────────────

function Legend() {
  const items: { state: CharState; label: string }[] = [
    { state: "default", label: "Default" },
    { state: "comparing", label: "Comparing" },
    { state: "match", label: "Match" },
    { state: "mismatch", label: "Mismatch" },
    { state: "skip", label: "Skip" },
    { state: "found", label: "Found" },
  ];

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
      {items.map(({ state, label }) => {
        const s = getCharStyle(state);
        return (
          <div
            key={state}
            style={{ display: "flex", alignItems: "center", gap: 4 }}
          >
            <div
              style={{
                width: 14,
                height: 14,
                borderRadius: 3,
                background: s.background,
                border: s.border,
                flexShrink: 0,
              }}
            />
            <span style={{ fontSize: 11, color: "var(--color-muted)" }}>{label}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Badge ─────────────────────────────────────────────────────────────────────

function Badge({ text, accent }: { text: string; accent?: boolean }) {
  return (
    <span
      style={{
        padding: "2px 8px",
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 600,
        fontFamily: "var(--font-mono)",
        background: accent ? "var(--color-accent-muted)" : "var(--color-surface-3)",
        color: accent ? "var(--color-accent)" : "var(--color-muted)",
        border: `1px solid ${accent ? "var(--color-accent)" : "var(--color-border)"}`,
      }}
    >
      {text}
    </span>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

interface Props {
  algorithm: StringAlgorithm;
}

export default function StringVisualizer({ algorithm }: Props) {
  const meta = META[algorithm];

  const [text, setText] = useState(DEFAULT_TEXT);
  const [pattern, setPattern] = useState(DEFAULT_PATTERN);
  const [inputText, setInputText] = useState(DEFAULT_TEXT);
  const [inputPattern, setInputPattern] = useState(DEFAULT_PATTERN);
  const [steps, setSteps] = useState<StringStep[]>([]);
  const [stepIdx, setStepIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(500);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const recompute = useCallback(
    (t: string, p: string) => {
      setIsPlaying(false);
      setStepIdx(0);
      const newSteps = getStringSteps(algorithm, t, p);
      setSteps(newSteps);
    },
    [algorithm]
  );

  // Initialize / reinitialize on algorithm change
  useEffect(() => {
    setText(DEFAULT_TEXT);
    setPattern(DEFAULT_PATTERN);
    setInputText(DEFAULT_TEXT);
    setInputPattern(DEFAULT_PATTERN);
    recompute(DEFAULT_TEXT, DEFAULT_PATTERN);
  }, [algorithm]); // eslint-disable-line react-hooks/exhaustive-deps

  // Playback loop
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

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;
      if (e.key === " ") {
        e.preventDefault();
        setIsPlaying((p) => {
          if (!p && stepIdx >= steps.length - 1) return p;
          return !p;
        });
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        setIsPlaying(false);
        setStepIdx((p) => Math.min(p + 1, steps.length - 1));
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        setIsPlaying(false);
        setStepIdx((p) => Math.max(p - 1, 0));
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, stepIdx, steps.length]);

  function handleSearch() {
    const t = inputText.trim().toUpperCase();
    const p = inputPattern.trim().toUpperCase();
    if (!t || !p) return;
    setText(t);
    setPattern(p);
    recompute(t, p);
  }

  function handleReset() {
    setText(DEFAULT_TEXT);
    setPattern(DEFAULT_PATTERN);
    setInputText(DEFAULT_TEXT);
    setInputPattern(DEFAULT_PATTERN);
    recompute(DEFAULT_TEXT, DEFAULT_PATTERN);
  }

  const step = steps[stepIdx];

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflow: "hidden",
      }}
    >
      {/* ── Header ── */}
      <div
        style={{
          padding: "24px 20px 16px",
          borderBottom: "1px solid var(--color-border)",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 8,
            marginBottom: 6,
          }}
        >
          <Search
            size={20}
            strokeWidth={1.75}
            style={{ color: "var(--color-accent)", flexShrink: 0 }}
          />
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>{meta.name}</h1>
          <Badge text={`Time: ${meta.time}`} accent />
          <Badge text={`Space: ${meta.space}`} />
        </div>
        <p style={{ fontSize: 13, color: "var(--color-muted)", margin: 0 }}>
          {meta.description}
        </p>
      </div>

      {/* ── Body ── */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          padding: "20px",
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        {/* ── Input row ── */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: "1 1 240px" }}>
            <label
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "var(--color-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Text
            </label>
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              style={{
                padding: "6px 10px",
                borderRadius: 6,
                border: "1px solid var(--color-border)",
                background: "var(--color-surface-2)",
                color: "var(--color-text)",
                fontFamily: "var(--font-mono)",
                fontSize: 13,
                outline: "none",
              }}
              placeholder="Enter text..."
            />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: "0 1 180px" }}>
            <label
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "var(--color-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Pattern
            </label>
            <input
              type="text"
              value={inputPattern}
              onChange={(e) => setInputPattern(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              style={{
                padding: "6px 10px",
                borderRadius: 6,
                border: "1px solid var(--color-border)",
                background: "var(--color-surface-2)",
                color: "var(--color-text)",
                fontFamily: "var(--font-mono)",
                fontSize: 13,
                outline: "none",
              }}
              placeholder="Pattern..."
            />
          </div>
          <button
            onClick={handleSearch}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "7px 16px",
              borderRadius: 6,
              border: "1px solid var(--color-accent)",
              background: "var(--color-accent)",
              color: "#fff",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            <Search size={13} strokeWidth={2} />
            Search
          </button>
        </div>

        {/* ── Auxiliary panel ── */}
        {step && (
          <>
            {algorithm === "kmp" && <KMPPanel step={step} pattern={pattern} />}
            {algorithm === "rabin-karp" && <RabinKarpPanel step={step} />}
            {algorithm === "boyer-moore" && <BoyerMoorePanel step={step} />}
          </>
        )}

        {/* ── Main visualization ── */}
        {step && (
          <div
            style={{
              background: "var(--color-surface-1)",
              border: "1px solid var(--color-border)",
              borderRadius: 8,
              padding: "16px",
              overflowX: "auto",
            }}
          >
            {/* Step counter */}
            <div
              style={{
                fontSize: 11,
                color: "var(--color-muted)",
                marginBottom: 12,
                fontFamily: "var(--font-mono)",
              }}
            >
              Step {stepIdx + 1} / {steps.length}
            </div>

            {/* Label row */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 12,
                minWidth: "max-content",
              }}
            >
              {/* Text row */}
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: "var(--color-muted)",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  Text
                </span>
                <div style={{ display: "flex", gap: CELL_GAP }}>
                  {text.split("").map((ch, i) => (
                    <CharBox
                      key={i}
                      char={ch}
                      state={step.textStates[i] ?? "default"}
                      index={i}
                      showIndex
                    />
                  ))}
                </div>
              </div>

              {/* Pattern row – offset by patternOffset */}
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: "var(--color-muted)",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  Pattern
                </span>
                <div
                  style={{
                    marginLeft: step.patternOffset * CELL_STEP,
                    display: "flex",
                    gap: CELL_GAP,
                  }}
                >
                  {pattern.split("").map((ch, i) => (
                    <CharBox
                      key={i}
                      char={ch}
                      state={step.patternStates[i] ?? "default"}
                      index={i}
                      showIndex
                    />
                  ))}
                </div>
              </div>

              {/* Window bracket */}
              {(step.windowStart !== undefined || step.patternOffset !== undefined) && (
                <WindowBracket
                  start={step.windowStart ?? step.patternOffset}
                  length={pattern.length}
                  cellStep={CELL_STEP}
                  hasMatch={step.textStates.some((s) => s === "found")}
                />
              )}
            </div>
          </div>
        )}

        {/* ── Description panel ── */}
        {step && (
          <div
            style={{
              background: "var(--color-surface-1)",
              border: "1px solid var(--color-border)",
              borderRadius: 8,
              padding: "12px 16px",
              fontSize: 13,
              lineHeight: 1.6,
              color: "var(--color-text)",
              fontFamily: "var(--font-mono)",
              minHeight: 44,
            }}
          >
            {step.description}
          </div>
        )}

        {/* ── Legend ── */}
        <Legend />

        {/* ── Playback controls ── */}
        <div
          style={{
            background: "var(--color-surface-1)",
            border: "1px solid var(--color-border)",
            borderRadius: 8,
            padding: "14px 16px",
          }}
        >
          <PlaybackControls
            stepCount={steps.length}
            stepIdx={stepIdx}
            setStepIdx={setStepIdx}
            isPlaying={isPlaying}
            setIsPlaying={setIsPlaying}
            speed={speed}
            setSpeed={setSpeed}
            onReset={handleReset}
            resetLabel="Reset"
          />
        </div>
      </div>
    </div>
  );
}

// ── Window Bracket ─────────────────────────────────────────────────────────────

function WindowBracket({
  start,
  length,
  cellStep,
  hasMatch,
}: {
  start: number;
  length: number;
  cellStep: number;
  hasMatch: boolean;
}) {
  const totalWidth = length * cellStep - (cellStep - CELL_SIZE);
  const leftOffset = start * cellStep;

  return (
    <div style={{ position: "relative", height: 6, marginTop: 2 }}>
      <div
        style={{
          position: "absolute",
          left: leftOffset,
          width: totalWidth,
          height: 3,
          borderRadius: 2,
          background: hasMatch
            ? "var(--color-accent)"
            : "var(--color-state-compare)",
          opacity: 0.5,
          transition: "left 0.15s, width 0.15s",
        }}
      />
    </div>
  );
}
