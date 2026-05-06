"use client";

import { useEffect, useMemo, useState } from "react";
import type { Question } from "@/lib/learning/types";
import { Check, X, RefreshCw, Shuffle, ChevronRight } from "lucide-react";

interface LessonProps {
  questions: Question[];
  topicName: string;
  randomize?: boolean;
}

type AnswerState =
  | { kind: "unanswered" }
  | { kind: "answered"; correct: boolean };

// Fisher-Yates shuffle (returns new array)
function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// Returns indices in new shuffled order — used so we can shuffle answer choices
// while still recovering the original index for grading.
function shuffleIndices(n: number): number[] {
  return shuffle(Array.from({ length: n }, (_, i) => i));
}

function arraysEqualUnordered(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  const sa = [...a].sort((x, y) => x - y);
  const sb = [...b].sort((x, y) => x - y);
  return sa.every((v, i) => v === sb[i]);
}

function arraysEqualOrdered(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

export default function Lesson({ questions: initial, topicName, randomize = true }: LessonProps) {
  const [order, setOrder] = useState<number[]>(() =>
    randomize ? shuffleIndices(initial.length) : Array.from({ length: initial.length }, (_, i) => i)
  );
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, AnswerState>>({});
  const [shuffleOn, setShuffleOn] = useState(randomize);

  const q = initial[order[idx]];
  const total = initial.length;
  const correctCount = Object.values(answers).filter(a => a.kind === "answered" && a.correct).length;
  const answeredCount = Object.values(answers).filter(a => a.kind === "answered").length;
  const state = answers[q?.id ?? ""] ?? { kind: "unanswered" };

  function recordAnswer(qid: string, correct: boolean) {
    setAnswers(prev => ({ ...prev, [qid]: { kind: "answered", correct } }));
  }

  function next() {
    if (idx + 1 < total) setIdx(idx + 1);
  }

  function prev() {
    if (idx - 1 >= 0) setIdx(idx - 1);
  }

  function reset() {
    setAnswers({});
    setIdx(0);
    setOrder(shuffleOn ? shuffleIndices(initial.length) : Array.from({ length: initial.length }, (_, i) => i));
  }

  function toggleShuffle() {
    const next = !shuffleOn;
    setShuffleOn(next);
    setIdx(0);
    setAnswers({});
    setOrder(next ? shuffleIndices(initial.length) : Array.from({ length: initial.length }, (_, i) => i));
  }

  if (!q) {
    return (
      <div style={{ padding: 24 }}>
        <p style={{ color: "var(--color-muted)", fontFamily: "monospace" }}>
          No questions available for this topic.
        </p>
      </div>
    );
  }

  const finished = answeredCount === total;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Header: progress + score + controls */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{topicName}</h1>
        <span style={{ fontSize: 11, fontFamily: "monospace", color: "var(--color-muted)", flex: 1 }}>
          {idx + 1} of {total} · {correctCount}/{answeredCount || "—"} correct
        </span>
        <button
          onClick={toggleShuffle}
          title={shuffleOn ? "Disable randomized order" : "Randomize question order"}
          style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            fontSize: 11, fontFamily: "monospace", padding: "4px 8px",
            borderRadius: 5, cursor: "pointer",
            background: shuffleOn ? "var(--color-accent-muted)" : "var(--color-surface-2)",
            border: `1px solid ${shuffleOn ? "var(--color-accent)" : "var(--color-border)"}`,
            color: shuffleOn ? "var(--color-accent)" : "var(--color-muted)",
          }}
        >
          <Shuffle size={11} /> Shuffle
        </button>
        <button
          onClick={reset}
          title="Reset progress and re-shuffle"
          style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            fontSize: 11, fontFamily: "monospace", padding: "4px 8px",
            borderRadius: 5, cursor: "pointer",
            background: "var(--color-surface-2)",
            border: "1px solid var(--color-border)",
            color: "var(--color-muted)",
          }}
        >
          <RefreshCw size={11} /> Reset
        </button>
      </div>

      {/* Progress bar */}
      <div style={{ height: 4, background: "var(--color-surface-3)", borderRadius: 2, overflow: "hidden" }}>
        <div style={{
          height: "100%", width: `${(answeredCount / total) * 100}%`,
          background: "var(--color-accent)", transition: "width 0.2s",
        }} />
      </div>

      {/* Question card */}
      <div style={{
        background: "var(--color-surface-1)",
        border: `1px solid ${state.kind === "answered" ? (state.correct ? "rgba(78,160,90,0.55)" : "rgba(239,83,80,0.65)") : "var(--color-border)"}`,
        borderRadius: 8,
        padding: 18,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <span style={{ fontSize: 9, fontFamily: "monospace", color: "var(--color-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            {q.kind.replace("-", " ")}
          </span>
          {q.difficulty && (
            <span style={{
              fontSize: 9, fontFamily: "monospace",
              padding: "1px 5px", borderRadius: 3,
              background: q.difficulty === "easy" ? "rgba(78,160,90,0.18)" : q.difficulty === "medium" ? "rgba(255,183,77,0.18)" : "rgba(239,83,80,0.18)",
              color: q.difficulty === "easy" ? "#7ec88a" : q.difficulty === "medium" ? "#ffb74d" : "#ef9a9a",
              border: `1px solid ${q.difficulty === "easy" ? "rgba(78,160,90,0.4)" : q.difficulty === "medium" ? "rgba(255,183,77,0.4)" : "rgba(239,83,80,0.4)"}`,
            }}>
              {q.difficulty}
            </span>
          )}
        </div>

        <p style={{ fontSize: 14, lineHeight: 1.5, marginBottom: 14, color: "var(--color-text)" }}>
          {q.prompt}
        </p>

        <QuestionBody
          question={q}
          state={state}
          onAnswer={(correct) => recordAnswer(q.id, correct)}
        />

        {/* Feedback + explanation */}
        {state.kind === "answered" && (
          <div style={{
            marginTop: 14, padding: 10, borderRadius: 5,
            background: state.correct ? "rgba(78,160,90,0.10)" : "rgba(239,83,80,0.10)",
            border: `1px solid ${state.correct ? "rgba(78,160,90,0.35)" : "rgba(239,83,80,0.35)"}`,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: q.explanation ? 6 : 0 }}>
              {state.correct
                ? <><Check size={14} style={{ color: "#7ec88a" }} /><span style={{ fontSize: 11, fontWeight: 700, color: "#7ec88a" }}>Correct</span></>
                : <><X size={14} style={{ color: "#ef5350" }} /><span style={{ fontSize: 11, fontWeight: 700, color: "#ef5350" }}>Incorrect</span></>}
            </div>
            {q.explanation && (
              <p style={{ fontSize: 11, lineHeight: 1.5, color: "var(--color-muted)", margin: 0 }}>
                {q.explanation}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Navigation */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <button
          onClick={prev}
          disabled={idx === 0}
          style={{
            fontSize: 11, fontFamily: "monospace", padding: "5px 10px",
            borderRadius: 5, cursor: idx === 0 ? "not-allowed" : "pointer",
            background: "var(--color-surface-2)",
            border: "1px solid var(--color-border)",
            color: "var(--color-muted)",
            opacity: idx === 0 ? 0.4 : 1,
          }}
        >
          ← Previous
        </button>
        <span style={{ fontSize: 11, fontFamily: "monospace", color: "var(--color-muted)" }}>
          {finished ? `🎉 Finished — ${correctCount}/${total}` : ""}
        </span>
        <button
          onClick={next}
          disabled={idx + 1 >= total}
          style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            fontSize: 11, fontFamily: "monospace", padding: "5px 10px",
            borderRadius: 5, cursor: idx + 1 >= total ? "not-allowed" : "pointer",
            background: state.kind === "answered" && idx + 1 < total ? "var(--color-accent)" : "var(--color-surface-2)",
            border: `1px solid ${state.kind === "answered" && idx + 1 < total ? "var(--color-accent)" : "var(--color-border)"}`,
            color: state.kind === "answered" && idx + 1 < total ? "#fff" : "var(--color-muted)",
            opacity: idx + 1 >= total ? 0.4 : 1,
          }}
        >
          Next <ChevronRight size={12} />
        </button>
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────────

function QuestionBody({
  question, state, onAnswer,
}: {
  question: Question;
  state: AnswerState;
  onAnswer: (correct: boolean) => void;
}) {
  const answered = state.kind === "answered";

  switch (question.kind) {
    case "multiple-choice": return (
      <MultipleChoice q={question} answered={answered} onAnswer={onAnswer} />
    );
    case "multi-select": return (
      <MultiSelect q={question} answered={answered} onAnswer={onAnswer} />
    );
    case "true-false": return (
      <TrueFalse q={question} answered={answered} onAnswer={onAnswer} />
    );
    case "fill-blank": return (
      <FillBlank q={question} answered={answered} onAnswer={onAnswer} />
    );
    case "numeric": return (
      <NumericInput q={question} answered={answered} onAnswer={onAnswer} />
    );
    case "ordering": return (
      <Ordering q={question} answered={answered} onAnswer={onAnswer} />
    );
    case "matching": return (
      <Matching q={question} answered={answered} onAnswer={onAnswer} />
    );
  }
}

// ── Multiple Choice ───────────────────────────────────────────────────────────
function MultipleChoice({ q, answered, onAnswer }: { q: Extract<Question, { kind: "multiple-choice" }>; answered: boolean; onAnswer: (c: boolean) => void }) {
  // Shuffle choice order once per question
  const shuffled = useMemo(() => shuffleIndices(q.choices.length), [q.id]);
  const [picked, setPicked] = useState<number | null>(null);

  // Reset selection when question changes
  useEffect(() => { setPicked(null); }, [q.id]);

  const submit = (originalIdx: number) => {
    if (answered) return;
    setPicked(originalIdx);
    onAnswer(originalIdx === q.correctIndex);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {shuffled.map(origIdx => {
        const isCorrect = origIdx === q.correctIndex;
        const isPicked = picked === origIdx;
        const showState = answered && (isPicked || isCorrect);
        return (
          <button
            key={origIdx}
            onClick={() => submit(origIdx)}
            disabled={answered}
            style={{
              textAlign: "left", padding: "8px 12px",
              borderRadius: 5, cursor: answered ? "default" : "pointer",
              background: showState ? (isCorrect ? "rgba(78,160,90,0.18)" : "rgba(239,83,80,0.18)") : "var(--color-surface-2)",
              border: `1px solid ${showState ? (isCorrect ? "rgba(78,160,90,0.55)" : "rgba(239,83,80,0.55)") : "var(--color-border)"}`,
              color: "var(--color-text)",
              fontSize: 12,
              transition: "background 0.15s, border-color 0.15s",
            }}
          >
            {q.choices[origIdx]}
          </button>
        );
      })}
    </div>
  );
}

// ── Multi-Select ──────────────────────────────────────────────────────────────
function MultiSelect({ q, answered, onAnswer }: { q: Extract<Question, { kind: "multi-select" }>; answered: boolean; onAnswer: (c: boolean) => void }) {
  const shuffled = useMemo(() => shuffleIndices(q.choices.length), [q.id]);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  useEffect(() => { setSelected(new Set()); }, [q.id]);

  const toggle = (origIdx: number) => {
    if (answered) return;
    setSelected(prev => {
      const next = new Set(prev);
      next.has(origIdx) ? next.delete(origIdx) : next.add(origIdx);
      return next;
    });
  };

  const submit = () => {
    if (answered) return;
    const correct = arraysEqualUnordered([...selected], q.correctIndices);
    onAnswer(correct);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <p style={{ fontSize: 9, color: "var(--color-muted)", fontFamily: "monospace", margin: 0 }}>
        Select all that apply.
      </p>
      {shuffled.map(origIdx => {
        const isPicked = selected.has(origIdx);
        const isCorrect = q.correctIndices.includes(origIdx);
        const showState = answered;
        return (
          <button
            key={origIdx}
            onClick={() => toggle(origIdx)}
            disabled={answered}
            style={{
              textAlign: "left", padding: "8px 12px",
              borderRadius: 5, cursor: answered ? "default" : "pointer",
              background: showState
                ? (isCorrect ? "rgba(78,160,90,0.18)" : isPicked ? "rgba(239,83,80,0.18)" : "var(--color-surface-2)")
                : (isPicked ? "var(--color-accent-muted)" : "var(--color-surface-2)"),
              border: `1px solid ${showState
                ? (isCorrect ? "rgba(78,160,90,0.55)" : isPicked ? "rgba(239,83,80,0.55)" : "var(--color-border)")
                : (isPicked ? "var(--color-accent)" : "var(--color-border)")}`,
              color: "var(--color-text)",
              fontSize: 12,
              display: "flex", alignItems: "center", gap: 8,
            }}
          >
            <span style={{
              width: 12, height: 12, borderRadius: 2, flexShrink: 0,
              border: `1.5px solid ${isPicked ? "var(--color-accent)" : "var(--color-border)"}`,
              background: isPicked ? "var(--color-accent)" : "transparent",
              display: "inline-flex", alignItems: "center", justifyContent: "center",
            }}>
              {isPicked && <Check size={10} style={{ color: "#fff" }} />}
            </span>
            {q.choices[origIdx]}
          </button>
        );
      })}
      {!answered && (
        <button
          onClick={submit}
          disabled={selected.size === 0}
          style={{
            marginTop: 4, padding: "6px 12px",
            fontSize: 11, fontFamily: "monospace",
            borderRadius: 5, cursor: selected.size === 0 ? "not-allowed" : "pointer",
            background: selected.size === 0 ? "var(--color-surface-2)" : "var(--color-accent)",
            border: `1px solid ${selected.size === 0 ? "var(--color-border)" : "var(--color-accent)"}`,
            color: selected.size === 0 ? "var(--color-muted)" : "#fff",
            alignSelf: "flex-start",
          }}
        >
          Submit
        </button>
      )}
    </div>
  );
}

// ── True/False ────────────────────────────────────────────────────────────────
function TrueFalse({ q, answered, onAnswer }: { q: Extract<Question, { kind: "true-false" }>; answered: boolean; onAnswer: (c: boolean) => void }) {
  const [picked, setPicked] = useState<boolean | null>(null);
  useEffect(() => { setPicked(null); }, [q.id]);

  const submit = (val: boolean) => {
    if (answered) return;
    setPicked(val);
    onAnswer(val === q.correct);
  };

  return (
    <div style={{ display: "flex", gap: 8 }}>
      {[true, false].map(val => {
        const isCorrect = val === q.correct;
        const isPicked = picked === val;
        const showState = answered && (isPicked || isCorrect);
        return (
          <button
            key={String(val)}
            onClick={() => submit(val)}
            disabled={answered}
            style={{
              flex: 1, padding: "10px 16px",
              fontSize: 13, fontWeight: 600,
              borderRadius: 5, cursor: answered ? "default" : "pointer",
              background: showState ? (isCorrect ? "rgba(78,160,90,0.18)" : "rgba(239,83,80,0.18)") : "var(--color-surface-2)",
              border: `1px solid ${showState ? (isCorrect ? "rgba(78,160,90,0.55)" : "rgba(239,83,80,0.55)") : "var(--color-border)"}`,
              color: "var(--color-text)",
            }}
          >
            {val ? "True" : "False"}
          </button>
        );
      })}
    </div>
  );
}

// ── Fill Blank ────────────────────────────────────────────────────────────────
function FillBlank({ q, answered, onAnswer }: { q: Extract<Question, { kind: "fill-blank" }>; answered: boolean; onAnswer: (c: boolean) => void }) {
  const [val, setVal] = useState("");
  useEffect(() => { setVal(""); }, [q.id]);

  const submit = () => {
    if (answered) return;
    const candidate = q.caseSensitive ? val.trim() : val.trim().toLowerCase();
    const accepted = q.accepted.map(a => q.caseSensitive ? a.trim() : a.trim().toLowerCase());
    onAnswer(accepted.includes(candidate));
  };

  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <input
        type="text"
        value={val}
        onChange={e => setVal(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter") submit(); }}
        disabled={answered}
        placeholder="Your answer"
        autoFocus
        style={{
          flex: 1, padding: "8px 12px",
          fontSize: 13, fontFamily: "monospace",
          borderRadius: 5,
          background: "var(--color-surface-2)",
          border: "1px solid var(--color-border)",
          color: "var(--color-text)",
          outline: "none",
        }}
      />
      <button
        onClick={submit}
        disabled={answered || !val.trim()}
        style={{
          padding: "8px 14px",
          fontSize: 11, fontFamily: "monospace",
          borderRadius: 5, cursor: (answered || !val.trim()) ? "not-allowed" : "pointer",
          background: !val.trim() ? "var(--color-surface-2)" : "var(--color-accent)",
          border: `1px solid ${!val.trim() ? "var(--color-border)" : "var(--color-accent)"}`,
          color: !val.trim() ? "var(--color-muted)" : "#fff",
        }}
      >
        Submit
      </button>
      {answered && (
        <span style={{ fontSize: 10, fontFamily: "monospace", color: "var(--color-muted)" }}>
          accepts: {q.accepted.slice(0, 3).join(", ")}{q.accepted.length > 3 ? "…" : ""}
        </span>
      )}
    </div>
  );
}

// ── Numeric ───────────────────────────────────────────────────────────────────
function NumericInput({ q, answered, onAnswer }: { q: Extract<Question, { kind: "numeric" }>; answered: boolean; onAnswer: (c: boolean) => void }) {
  const [val, setVal] = useState("");
  useEffect(() => { setVal(""); }, [q.id]);

  const submit = () => {
    if (answered) return;
    const n = Number(val);
    if (!Number.isFinite(n)) { onAnswer(false); return; }
    const tol = q.tolerance ?? 0;
    onAnswer(Math.abs(n - q.correct) <= tol);
  };

  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <input
        type="number"
        value={val}
        onChange={e => setVal(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter") submit(); }}
        disabled={answered}
        placeholder="Your answer"
        autoFocus
        style={{
          flex: 1, padding: "8px 12px",
          fontSize: 13, fontFamily: "monospace",
          borderRadius: 5,
          background: "var(--color-surface-2)",
          border: "1px solid var(--color-border)",
          color: "var(--color-text)",
          outline: "none",
        }}
      />
      <button
        onClick={submit}
        disabled={answered || !val.trim()}
        style={{
          padding: "8px 14px",
          fontSize: 11, fontFamily: "monospace",
          borderRadius: 5, cursor: (answered || !val.trim()) ? "not-allowed" : "pointer",
          background: !val.trim() ? "var(--color-surface-2)" : "var(--color-accent)",
          border: `1px solid ${!val.trim() ? "var(--color-border)" : "var(--color-accent)"}`,
          color: !val.trim() ? "var(--color-muted)" : "#fff",
        }}
      >
        Submit
      </button>
      {answered && (
        <span style={{ fontSize: 10, fontFamily: "monospace", color: "var(--color-muted)" }}>
          correct: {q.correct}{q.tolerance ? ` ±${q.tolerance}` : ""}
        </span>
      )}
    </div>
  );
}

// ── Ordering ──────────────────────────────────────────────────────────────────
function Ordering({ q, answered, onAnswer }: { q: Extract<Question, { kind: "ordering" }>; answered: boolean; onAnswer: (c: boolean) => void }) {
  // Each item is shown once. User clicks them in the desired order.
  const [picked, setPicked] = useState<number[]>([]);
  useEffect(() => { setPicked([]); }, [q.id]);

  const remaining = q.items.map((_, i) => i).filter(i => !picked.includes(i));

  const select = (i: number) => {
    if (answered) return;
    const next = [...picked, i];
    setPicked(next);
    if (next.length === q.items.length) {
      onAnswer(arraysEqualOrdered(next, q.correctOrder));
    }
  };

  const undo = () => {
    if (answered) return;
    setPicked(p => p.slice(0, -1));
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div>
        <p style={{ fontSize: 9, color: "var(--color-muted)", fontFamily: "monospace", marginBottom: 4 }}>
          Click in order:
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, minHeight: 32, padding: 6,
          background: "var(--color-surface-2)", borderRadius: 5,
          border: "1px solid var(--color-border)" }}>
          {picked.length === 0 && (
            <span style={{ fontSize: 11, color: "var(--color-muted)", fontStyle: "italic", padding: 4 }}>
              (selected items appear here)
            </span>
          )}
          {picked.map((i, pos) => {
            const correct = answered && q.correctOrder[pos] === i;
            const wrong = answered && q.correctOrder[pos] !== i;
            return (
              <span key={`${i}-${pos}`} style={{
                fontSize: 11, fontFamily: "monospace",
                padding: "3px 8px", borderRadius: 4,
                background: correct ? "rgba(78,160,90,0.18)" : wrong ? "rgba(239,83,80,0.18)" : "var(--color-accent-muted)",
                border: `1px solid ${correct ? "rgba(78,160,90,0.55)" : wrong ? "rgba(239,83,80,0.55)" : "var(--color-accent)"}`,
                color: "var(--color-text)",
              }}>
                <span style={{ opacity: 0.6, marginRight: 4 }}>{pos + 1}.</span>{q.items[i]}
              </span>
            );
          })}
        </div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {remaining.map(i => (
          <button
            key={i}
            onClick={() => select(i)}
            disabled={answered}
            style={{
              fontSize: 11, fontFamily: "monospace",
              padding: "5px 10px", borderRadius: 4,
              background: "var(--color-surface-2)",
              border: "1px solid var(--color-border)",
              color: "var(--color-text)",
              cursor: "pointer",
            }}
          >
            {q.items[i]}
          </button>
        ))}
      </div>

      {!answered && picked.length > 0 && (
        <button
          onClick={undo}
          style={{
            alignSelf: "flex-start",
            fontSize: 10, fontFamily: "monospace",
            padding: "3px 8px", borderRadius: 4,
            background: "var(--color-surface-2)",
            border: "1px solid var(--color-border)",
            color: "var(--color-muted)",
            cursor: "pointer",
          }}
        >
          ← Undo
        </button>
      )}

      {answered && (
        <p style={{ fontSize: 10, fontFamily: "monospace", color: "var(--color-muted)" }}>
          correct order: {q.correctOrder.map(i => q.items[i]).join(" → ")}
        </p>
      )}
    </div>
  );
}

// ── Matching ──────────────────────────────────────────────────────────────────
function Matching({ q, answered, onAnswer }: { q: Extract<Question, { kind: "matching" }>; answered: boolean; onAnswer: (c: boolean) => void }) {
  // Right column is shuffled; user picks a right index for each left index
  const rightOrder = useMemo(() => shuffleIndices(q.pairs.length), [q.id]);
  const [matches, setMatches] = useState<Record<number, number>>({});
  useEffect(() => { setMatches({}); }, [q.id]);

  const setMatch = (leftIdx: number, rightIdx: number) => {
    if (answered) return;
    setMatches(prev => ({ ...prev, [leftIdx]: rightIdx }));
  };

  const submit = () => {
    if (answered) return;
    if (Object.keys(matches).length !== q.pairs.length) return;
    const correct = q.pairs.every((_, i) => matches[i] === i);
    onAnswer(correct);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {q.pairs.map((pair, leftIdx) => (
        <div key={leftIdx} style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ flex: 1, fontSize: 12, color: "var(--color-text)" }}>
            {pair.left}
          </span>
          <span style={{ fontSize: 14, color: "var(--color-muted)" }}>↔</span>
          <select
            value={matches[leftIdx] ?? ""}
            onChange={e => setMatch(leftIdx, Number(e.target.value))}
            disabled={answered}
            style={{
              flex: 1, fontSize: 12, padding: "5px 8px",
              borderRadius: 5,
              background: answered ? (matches[leftIdx] === leftIdx ? "rgba(78,160,90,0.18)" : "rgba(239,83,80,0.18)") : "var(--color-surface-2)",
              border: `1px solid ${answered ? (matches[leftIdx] === leftIdx ? "rgba(78,160,90,0.55)" : "rgba(239,83,80,0.55)") : "var(--color-border)"}`,
              color: "var(--color-text)",
            }}
          >
            <option value="" disabled>— pick —</option>
            {rightOrder.map(rightIdx => (
              <option key={rightIdx} value={rightIdx}>{q.pairs[rightIdx].right}</option>
            ))}
          </select>
        </div>
      ))}
      {!answered && (
        <button
          onClick={submit}
          disabled={Object.keys(matches).length !== q.pairs.length}
          style={{
            alignSelf: "flex-start",
            padding: "6px 12px",
            fontSize: 11, fontFamily: "monospace",
            borderRadius: 5,
            background: Object.keys(matches).length !== q.pairs.length ? "var(--color-surface-2)" : "var(--color-accent)",
            border: `1px solid ${Object.keys(matches).length !== q.pairs.length ? "var(--color-border)" : "var(--color-accent)"}`,
            color: Object.keys(matches).length !== q.pairs.length ? "var(--color-muted)" : "#fff",
            cursor: Object.keys(matches).length !== q.pairs.length ? "not-allowed" : "pointer",
          }}
        >
          Submit
        </button>
      )}
    </div>
  );
}
