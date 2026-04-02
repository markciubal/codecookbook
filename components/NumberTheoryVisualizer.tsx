"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Play, Pause, SkipBack, SkipForward, RotateCcw } from "lucide-react";
import {
  getSieveSteps,
  getGCDSteps,
  getFastExpSteps,
  type MathAlgorithm,
  type MathStep,
} from "@/lib/number-theory";

interface Props {
  algorithm: MathAlgorithm;
}

const SPEED_MIN = 50;
const SPEED_MAX = 1500;

export default function NumberTheoryVisualizer({ algorithm }: Props) {
  // Input state
  const [sieveLimit, setSieveLimit] = useState(100);
  const [gcdA, setGcdA] = useState(252);
  const [gcdB, setGcdB] = useState(105);
  const [expBase, setExpBase] = useState(2);
  const [expExp, setExpExp] = useState(10);
  const [expMod, setExpMod] = useState(1000);

  const [steps, setSteps] = useState<MathStep[]>([]);
  const [stepIdx, setStepIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(300);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const buildSteps = useCallback(() => {
    let s: MathStep[] = [];
    if (algorithm === "sieve") s = getSieveSteps(sieveLimit);
    else if (algorithm === "gcd") s = getGCDSteps(gcdA, gcdB);
    else if (algorithm === "fast-exp") s = getFastExpSteps(expBase, expExp, expMod);
    setSteps(s);
    setStepIdx(0);
    setIsPlaying(false);
  }, [algorithm, sieveLimit, gcdA, gcdB, expBase, expExp, expMod]);

  useEffect(() => {
    buildSteps();
  }, [buildSteps]);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!isPlaying) return;
    if (stepIdx >= steps.length - 1) {
      setIsPlaying(false);
      return;
    }
    timerRef.current = setTimeout(() => setStepIdx((p) => p + 1), speed);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isPlaying, stepIdx, steps.length, speed]);

  const currentStep: MathStep | undefined = steps[stepIdx];

  const algoLabels: Record<MathAlgorithm, string> = {
    sieve: "Sieve of Eratosthenes",
    gcd: "Euclidean GCD",
    "fast-exp": "Fast Exponentiation",
  };

  return (
    <div
      style={{
        padding: "24px",
        maxWidth: 900,
        margin: "0 auto",
        fontFamily: "var(--font-mono)",
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--color-text)", marginBottom: 4 }}>
          Number Theory — {algoLabels[algorithm]}
        </h1>
        <p style={{ fontSize: 12, color: "var(--color-muted)" }}>
          {algorithm === "sieve" && "Find all primes up to N by iteratively marking composite numbers."}
          {algorithm === "gcd" && "Compute greatest common divisor using the Euclidean algorithm."}
          {algorithm === "fast-exp" && "Compute base^exp mod m in O(log exp) steps using square-and-multiply."}
        </p>
      </div>

      {/* Inputs */}
      <div
        style={{
          background: "var(--color-surface-1)",
          border: "1px solid var(--color-border)",
          borderRadius: 8,
          padding: "12px 16px",
          marginBottom: 16,
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          alignItems: "flex-end",
        }}
      >
        {algorithm === "sieve" && (
          <LabeledInput
            label="limit"
            type="number"
            min={10}
            max={200}
            value={sieveLimit}
            onChange={(v) => setSieveLimit(Math.max(10, Math.min(200, v)))}
          />
        )}
        {algorithm === "gcd" && (
          <>
            <LabeledInput label="a" type="number" min={1} max={999999} value={gcdA} onChange={setGcdA} />
            <LabeledInput label="b" type="number" min={1} max={999999} value={gcdB} onChange={setGcdB} />
          </>
        )}
        {algorithm === "fast-exp" && (
          <>
            <LabeledInput label="base" type="number" min={2} max={100} value={expBase} onChange={setExpBase} />
            <LabeledInput label="exp" type="number" min={1} max={63} value={expExp} onChange={setExpExp} />
            <LabeledInput label="mod" type="number" min={2} max={1000000} value={expMod} onChange={setExpMod} />
          </>
        )}
        <CtrlBtn primary onClick={buildSteps}>
          <RotateCcw size={12} strokeWidth={1.75} /> Recompute
        </CtrlBtn>
      </div>

      {/* Controls */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          marginBottom: 20,
          padding: "12px 16px",
          background: "var(--color-surface-1)",
          border: "1px solid var(--color-border)",
          borderRadius: 8,
          alignItems: "center",
        }}
      >
        <CtrlBtn
          onClick={() => { setIsPlaying(false); setStepIdx(0); }}
          disabled={stepIdx === 0}
        >
          <SkipBack size={13} strokeWidth={1.75} />
        </CtrlBtn>
        <CtrlBtn
          onClick={() => { setIsPlaying(false); setStepIdx((p) => Math.max(0, p - 1)); }}
          disabled={stepIdx === 0}
        >
          ‹
        </CtrlBtn>
        <CtrlBtn
          primary
          onClick={() => setIsPlaying((p) => !p)}
          disabled={stepIdx >= steps.length - 1}
          style={{ minWidth: 80 }}
        >
          {isPlaying
            ? <><Pause size={13} strokeWidth={1.75} /> Pause</>
            : <><Play size={13} strokeWidth={1.75} /> Play</>}
        </CtrlBtn>
        <CtrlBtn
          onClick={() => { setIsPlaying(false); setStepIdx((p) => Math.min(steps.length - 1, p + 1)); }}
          disabled={stepIdx >= steps.length - 1}
        >
          ›
        </CtrlBtn>
        <CtrlBtn
          onClick={() => { setIsPlaying(false); setStepIdx(steps.length - 1); }}
          disabled={stepIdx >= steps.length - 1}
        >
          <SkipForward size={13} strokeWidth={1.75} />
        </CtrlBtn>
        <CtrlBtn onClick={buildSteps}>
          <RotateCcw size={13} strokeWidth={1.75} /> Reset
        </CtrlBtn>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            paddingLeft: 12,
            marginLeft: 4,
            borderLeft: "1px solid var(--color-border)",
          }}
        >
          <span style={{ fontSize: 11, color: "var(--color-muted)" }}>Slow</span>
          <input
            type="range"
            min={SPEED_MIN}
            max={SPEED_MAX}
            step={10}
            value={SPEED_MAX + SPEED_MIN - speed}
            onChange={(e) => setSpeed(SPEED_MAX + SPEED_MIN - Number(e.target.value))}
            style={{ width: 80, accentColor: "var(--color-accent)", cursor: "pointer" }}
          />
          <span style={{ fontSize: 11, color: "var(--color-muted)" }}>Fast</span>
        </div>

        <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--color-muted)" }}>
          step {stepIdx + 1} / {steps.length}
        </span>
      </div>

      {/* Visualization */}
      {algorithm === "sieve" && <SieveViz step={currentStep} limit={sieveLimit} />}
      {algorithm === "gcd" && <GCDViz steps={steps} stepIdx={stepIdx} />}
      {algorithm === "fast-exp" && <FastExpViz steps={steps} stepIdx={stepIdx} expBits={expExp.toString(2).split("").map(Number)} />}

      {/* Description */}
      <div
        style={{
          background: "var(--color-surface-1)",
          border: "1px solid var(--color-border)",
          borderRadius: 8,
          padding: "12px 16px",
          fontSize: 12,
          color: "var(--color-text)",
          minHeight: 44,
          marginTop: 16,
        }}
      >
        <span style={{ color: "var(--color-muted)", marginRight: 8 }}>→</span>
        {currentStep?.description ?? "Press Play to start"}
      </div>
    </div>
  );
}

// ── Sieve Visualization ────────────────────────────────────────────────────────

function SieveViz({ step, limit }: { step: MathStep | undefined; limit: number }) {
  const grid = step?.grid ?? new Array(limit + 1).fill(true);
  const highlight = new Set(step?.highlight ?? []);
  const current = step?.current;

  const COLS = 10;
  const cellSize = 36;

  return (
    <div
      style={{
        background: "var(--color-surface-1)",
        border: "1px solid var(--color-border)",
        borderRadius: 8,
        padding: "16px",
        overflowX: "auto",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${COLS}, ${cellSize}px)`,
          gap: 3,
        }}
      >
        {grid.slice(0, limit + 1).map((isPrime, i) => {
          const isHighlight = highlight.has(i);
          const isCurrent = i === current;

          let bg = "var(--color-surface-3)";
          let textColor = "var(--color-muted)";
          let strikethrough = false;
          let fontWeight: number | string = 400;

          if (isCurrent) {
            bg = "var(--color-accent)";
            textColor = "#fff";
            fontWeight = 700;
          } else if (isHighlight && !isPrime) {
            bg = "var(--color-state-swap)";
            textColor = "#fff";
            strikethrough = true;
          } else if (isHighlight && isPrime) {
            bg = "var(--color-state-sorted)";
            textColor = "#fff";
            fontWeight = 600;
          } else if (!isPrime) {
            bg = "var(--color-surface-2)";
            textColor = "var(--color-border)";
            strikethrough = true;
          } else if (isPrime && i >= 2) {
            bg = "var(--color-state-sorted)";
            textColor = "#fff";
            fontWeight = 600;
          }

          return (
            <div
              key={i}
              style={{
                width: cellSize,
                height: cellSize,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 4,
                background: bg,
                color: textColor,
                fontSize: 11,
                fontWeight,
                textDecoration: strikethrough ? "line-through" : "none",
                transition: "background 0.15s, color 0.15s",
                border: isCurrent ? "2px solid var(--color-accent)" : "1px solid transparent",
              }}
            >
              {i}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div style={{ display: "flex", gap: 16, marginTop: 12, fontSize: 11, color: "var(--color-muted)", flexWrap: "wrap" }}>
        {[
          { color: "var(--color-accent)", label: "Current prime p" },
          { color: "var(--color-state-swap)", label: "Being crossed off" },
          { color: "var(--color-state-sorted)", label: "Prime" },
          { color: "var(--color-surface-2)", label: "Composite" },
        ].map(({ color, label }) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ width: 12, height: 12, borderRadius: 2, background: color }} />
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── GCD Visualization ─────────────────────────────────────────────────────────

function GCDViz({ steps, stepIdx }: { steps: MathStep[]; stepIdx: number }) {
  const currentStep = steps[stepIdx];
  if (!currentStep) return null;

  const vals = currentStep.values ?? [];
  const a = vals.find((v) => v.label === "a")?.value ?? "—";
  const b = vals.find((v) => v.label === "b")?.value ?? "—";
  const rem = vals.find((v) => v.label === "a mod b")?.value;
  const gcdResult = vals.find((v) => v.label === "gcd")?.value;

  // History chain
  const history: string[] = [];
  for (let i = 0; i <= stepIdx; i++) {
    const s = steps[i];
    const sv = s.values ?? [];
    const sa = sv.find((v) => v.label === "a")?.value;
    const sb = sv.find((v) => v.label === "b")?.value;
    const sq = sv.find((v) => v.label === "quotient")?.value;
    const sr = sv.find((v) => v.label === "a mod b")?.value;
    if (sa !== undefined && sb !== undefined && sq !== undefined && sr !== undefined) {
      history.push(`${sa} = ${sq}×${sb} + ${sr}`);
    }
  }

  return (
    <div
      style={{
        background: "var(--color-surface-1)",
        border: "1px solid var(--color-border)",
        borderRadius: 8,
        padding: "20px",
      }}
    >
      {/* Big number display */}
      <div style={{ display: "flex", alignItems: "center", gap: 24, justifyContent: "center", marginBottom: 24 }}>
        <BigNum label="a" value={a} color="var(--color-accent)" />
        <div style={{ fontSize: 28, color: "var(--color-muted)" }}>mod</div>
        <BigNum label="b" value={b} color="var(--color-state-compare)" />
        {rem !== undefined && rem !== "—" && (
          <>
            <div style={{ fontSize: 28, color: "var(--color-muted)" }}>=</div>
            <BigNum
              label="remainder"
              value={rem}
              color={Number(rem) === 0 ? "var(--color-state-sorted)" : "var(--color-state-swap)"}
            />
          </>
        )}
        {gcdResult !== undefined && (
          <>
            <div style={{ fontSize: 28, color: "var(--color-muted)" }}>⇒ gcd =</div>
            <BigNum label="result" value={gcdResult} color="var(--color-state-sorted)" />
          </>
        )}
      </div>

      {/* History chain */}
      {history.length > 0 && (
        <div
          style={{
            borderTop: "1px solid var(--color-border)",
            paddingTop: 12,
          }}
        >
          <div style={{ fontSize: 11, color: "var(--color-muted)", marginBottom: 8 }}>
            History:
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, fontSize: 12 }}>
            {history.map((entry, i) => (
              <span key={i} style={{ color: "var(--color-text)" }}>
                {entry}
                {i < history.length - 1 && (
                  <span style={{ color: "var(--color-muted)", marginLeft: 4 }}>→</span>
                )}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function BigNum({
  label,
  value,
  color,
}: {
  label: string;
  value: number | string;
  color: string;
}) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 11, color: "var(--color-muted)", marginBottom: 4 }}>{label}</div>
      <div
        style={{
          fontSize: 36,
          fontWeight: 700,
          color,
          minWidth: 64,
          padding: "8px 16px",
          background: "var(--color-surface-2)",
          borderRadius: 8,
          border: "1px solid var(--color-border)",
        }}
      >
        {value}
      </div>
    </div>
  );
}

// ── Fast Exp Visualization ────────────────────────────────────────────────────

function FastExpViz({
  steps,
  stepIdx,
  expBits,
}: {
  steps: MathStep[];
  stepIdx: number;
  expBits: number[];
}) {
  const currentStep = steps[stepIdx];
  if (!currentStep) return null;

  // Collect table rows from all steps
  const tableRows: Array<{ bit: string; base: string; result: string; active: boolean }> = [];
  let bitPos = 0;

  for (let i = 0; i < steps.length; i++) {
    const s = steps[i];
    const vals = s.values ?? [];
    const bit = vals.find((v) => v.label === "bit")?.value;
    const base = vals.find((v) => v.label === "current base²" || v.label === "base")?.value;
    const result = vals.find((v) => v.label === "result" || v.label === "result so far")?.value;
    if (bit !== undefined && base !== undefined && result !== undefined) {
      tableRows.push({
        bit: String(bit),
        base: String(base),
        result: String(result),
        active: i === stepIdx,
      });
      bitPos++;
    }
  }

  const currentVals = currentStep.values ?? [];
  const currentResult = currentVals.find((v) => v.label === "result")?.value ?? "—";

  return (
    <div
      style={{
        background: "var(--color-surface-1)",
        border: "1px solid var(--color-border)",
        borderRadius: 8,
        padding: "20px",
      }}
    >
      {/* Binary exponent display */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, color: "var(--color-muted)", marginBottom: 8 }}>
          Exponent in binary (LSB to MSB reading right-to-left):
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {expBits.map((bit, i) => (
            <div
              key={i}
              style={{
                width: 32,
                height: 32,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 4,
                background: bit === 1 ? "var(--color-accent)" : "var(--color-surface-3)",
                color: bit === 1 ? "#fff" : "var(--color-muted)",
                fontSize: 14,
                fontWeight: 700,
                border: "1px solid var(--color-border)",
              }}
            >
              {bit}
            </div>
          ))}
        </div>
      </div>

      {/* Table */}
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: 12,
        }}
      >
        <thead>
          <tr>
            {["bit", "base (running)", "result (running)"].map((h) => (
              <th
                key={h}
                style={{
                  textAlign: "left",
                  padding: "6px 12px",
                  background: "var(--color-surface-2)",
                  color: "var(--color-muted)",
                  borderBottom: "1px solid var(--color-border)",
                  fontWeight: 600,
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tableRows.map((row, i) => (
            <tr
              key={i}
              style={{
                background: row.active
                  ? "var(--color-accent-muted)"
                  : i % 2 === 0
                  ? "var(--color-surface-1)"
                  : "var(--color-surface-2)",
                borderLeft: row.active
                  ? "3px solid var(--color-accent)"
                  : "3px solid transparent",
              }}
            >
              <td
                style={{
                  padding: "6px 12px",
                  color: row.bit === "1" ? "var(--color-accent)" : "var(--color-muted)",
                  fontWeight: row.bit === "1" ? 700 : 400,
                }}
              >
                {row.bit}
              </td>
              <td style={{ padding: "6px 12px", color: "var(--color-text)" }}>{row.base}</td>
              <td
                style={{
                  padding: "6px 12px",
                  color: row.active ? "var(--color-accent)" : "var(--color-text)",
                  fontWeight: row.active ? 700 : 400,
                }}
              >
                {row.result}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Final result */}
      {stepIdx === steps.length - 1 && (
        <div
          style={{
            marginTop: 16,
            padding: "12px 16px",
            background: "var(--color-surface-2)",
            borderRadius: 6,
            border: "1px solid var(--color-state-sorted)",
            fontSize: 14,
            color: "var(--color-state-sorted)",
            fontWeight: 700,
            textAlign: "center",
          }}
        >
          Result = {currentResult}
        </div>
      )}
    </div>
  );
}

// ── Shared helpers ─────────────────────────────────────────────────────────────

function LabeledInput({
  label,
  type,
  min,
  max,
  value,
  onChange,
}: {
  label: string;
  type: string;
  min?: number;
  max?: number;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <label style={{ fontSize: 11, color: "var(--color-muted)" }}>{label}</label>
      <input
        type={type}
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{
          width: 80,
          padding: "4px 8px",
          borderRadius: 6,
          border: "1px solid var(--color-border)",
          background: "var(--color-surface-2)",
          color: "var(--color-text)",
          fontSize: 12,
          fontFamily: "var(--font-mono)",
        }}
      />
    </div>
  );
}

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
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "4px 10px",
        borderRadius: 6,
        fontSize: 12,
        fontWeight: 500,
        background: primary ? "var(--color-accent)" : "var(--color-surface-3)",
        color: primary ? "#fff" : "var(--color-text)",
        border: "1px solid " + (primary ? "var(--color-accent)" : "var(--color-border)"),
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.45 : 1,
        transition: "opacity 0.15s",
        ...style,
      }}
    >
      {children}
    </button>
  );
}
