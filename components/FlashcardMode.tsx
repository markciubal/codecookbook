"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { CheckCircle, XCircle, RotateCcw } from "lucide-react";
import { SORTING_ALGORITHMS, DATA_STRUCTURES, SortingEntry, DSEntry } from "@/lib/catalog";

type CardEntry = SortingEntry | DSEntry;

// All unique complexity strings across all entries
const ALL_COMPLEXITIES = Array.from(
  new Set([
    ...SORTING_ALGORITHMS.map((a) => a.time),
    ...SORTING_ALGORITHMS.map((a) => a.space),
    ...DATA_STRUCTURES.map((d) => d.time),
    ...DATA_STRUCTURES.map((d) => d.space),
  ])
);

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildDeck(): CardEntry[] {
  return shuffle([...SORTING_ALGORITHMS, ...DATA_STRUCTURES]);
}

function getWrongOptions(correct: string, count: number): string[] {
  const others = ALL_COMPLEXITIES.filter((c) => c !== correct);
  return shuffle(others).slice(0, count);
}

function buildOptions(correct: string): string[] {
  const wrong = getWrongOptions(correct, 3);
  return shuffle([correct, ...wrong]);
}

// SVG Score ring
function ScoreRing({ correct, total }: { correct: number; total: number }) {
  const r = 28;
  const circ = 2 * Math.PI * r;
  const pct = total === 0 ? 0 : correct / total;
  const dash = circ * pct;
  const pctDisplay = total === 0 ? 0 : Math.round((correct / total) * 100);

  return (
    <svg width={72} height={72}>
      <circle cx={36} cy={36} r={r} fill="none" stroke="var(--color-border)" strokeWidth={5} />
      <circle
        cx={36} cy={36} r={r}
        fill="none"
        stroke="var(--color-accent)"
        strokeWidth={5}
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        transform="rotate(-90 36 36)"
        style={{ transition: "stroke-dasharray 0.4s ease" }}
      />
      <text
        x={36} y={37}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={13}
        fontWeight={700}
        fill="var(--color-accent)"
        fontFamily="monospace"
      >
        {pctDisplay}%
      </text>
    </svg>
  );
}

export default function FlashcardMode() {
  const [deck, setDeck] = useState<CardEntry[]>(() => buildDeck());
  const [cardIdx, setCardIdx] = useState(0);
  const [phase, setPhase] = useState<"question" | "revealed">("question");
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const [sessionDone, setSessionDone] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [options, setOptions] = useState<string[]>([]);
  const answeredRef = useRef(false);

  const currentCard = deck[cardIdx];

  // Rebuild options whenever card changes
  useEffect(() => {
    if (!currentCard) return;
    answeredRef.current = false;
    setOptions(buildOptions(currentCard.time));
    setSelectedAnswer(null);
  }, [cardIdx, deck]);

  function handleAnswer(option: string) {
    if (phase !== "question" || answeredRef.current) return;
    answeredRef.current = true;
    setSelectedAnswer(option);
    const isCorrect = option === currentCard.time;
    setScore((s) => ({ correct: s.correct + (isCorrect ? 1 : 0), total: s.total + 1 }));
    setPhase("revealed");
  }

  const handleNext = useCallback(() => {
    if (phase !== "revealed") return;
    const nextIdx = cardIdx + 1;
    if (nextIdx >= deck.length) {
      setSessionDone(true);
    } else {
      setCardIdx(nextIdx);
      setPhase("question");
    }
  }, [phase, cardIdx, deck.length]);

  function handleRestart() {
    setDeck(buildDeck());
    setCardIdx(0);
    setPhase("question");
    setScore({ correct: 0, total: 0 });
    setSessionDone(false);
    setSelectedAnswer(null);
    answeredRef.current = false;
  }

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (sessionDone) return;
      if (phase === "question") {
        const idx = parseInt(e.key) - 1;
        if (idx >= 0 && idx < options.length) {
          handleAnswer(options[idx]);
        }
      } else if (phase === "revealed") {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          handleNext();
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, options, sessionDone, handleNext]);

  const progress = deck.length === 0 ? 0 : (cardIdx / deck.length) * 100;

  if (sessionDone) {
    const pct = deck.length === 0 ? 0 : Math.round((score.correct / score.total) * 100);
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 gap-6">
        <h2 className="text-base font-bold" style={{ color: "var(--color-text)" }}>Session Complete!</h2>
        <ScoreRing correct={score.correct} total={score.total} />
        <p className="text-sm" style={{ color: "var(--color-muted)" }}>
          {score.correct} of {score.total} correct ({pct}%)
        </p>
        <button
          onClick={handleRestart}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold"
          style={{ background: "var(--color-accent)", color: "#fff" }}
        >
          <RotateCcw size={13} />
          Play again
        </button>
      </div>
    );
  }

  const isSorting = currentCard.kind === "sorting";
  const isCorrect = selectedAnswer === currentCard.time;

  return (
    <div className="flex flex-col items-center p-4 md:p-8 min-h-[60vh]">
      {/* Progress bar */}
      <div className="w-full max-w-lg mb-4">
        <div className="flex items-center justify-between text-xs mb-1" style={{ color: "var(--color-muted)" }}>
          <span>Card {cardIdx + 1} / {deck.length}</span>
          <span>{score.correct} correct</span>
        </div>
        <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: "var(--color-surface-3)" }}>
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{ width: `${progress}%`, background: "var(--color-accent)" }}
          />
        </div>
      </div>

      {/* Card */}
      <div
        className="w-full max-w-[480px] rounded-2xl border p-6 flex flex-col gap-5"
        style={{ background: "var(--color-surface-1)", borderColor: "var(--color-border)" }}
      >
        {/* Algorithm name */}
        <div className="text-center">
          <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: "var(--color-muted)" }}>
            {isSorting ? "Sorting Algorithm" : "Data Structure"}
          </p>
          <h2 className="text-2xl font-bold leading-tight" style={{ color: "var(--color-text)" }}>
            {currentCard.name}
          </h2>
          <p className="text-xs mt-1" style={{ color: "var(--color-muted)" }}>
            What is the time complexity?
          </p>
        </div>

        {/* Answer buttons */}
        {phase === "question" && (
          <div className="grid grid-cols-2 gap-2">
            {options.map((opt, i) => (
              <button
                key={opt}
                onClick={() => handleAnswer(opt)}
                className="flex items-center gap-2 px-3 py-2.5 rounded-lg border text-xs font-mono font-medium text-left transition-colors"
                style={{
                  background: "var(--color-surface-2)",
                  borderColor: "var(--color-border)",
                  color: "var(--color-text)",
                }}
              >
                <span
                  className="shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold"
                  style={{ background: "var(--color-surface-3)", color: "var(--color-muted)" }}
                >
                  {i + 1}
                </span>
                {opt}
              </button>
            ))}
          </div>
        )}

        {/* Revealed state */}
        {phase === "revealed" && (
          <div className="flex flex-col gap-3">
            {/* Feedback */}
            <div
              className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-semibold"
              style={{
                background: isCorrect ? "rgba(78,124,82,0.15)" : "rgba(176,48,32,0.12)",
                color: isCorrect ? "var(--color-state-sorted)" : "var(--color-state-swap)",
              }}
            >
              {isCorrect ? <CheckCircle size={14} /> : <XCircle size={14} />}
              {isCorrect ? "Correct!" : `Incorrect — answer: ${currentCard.time}`}
            </div>

            {/* Answer choices with highlighting */}
            <div className="grid grid-cols-2 gap-2">
              {options.map((opt) => {
                const isRight = opt === currentCard.time;
                const wasChosen = opt === selectedAnswer;
                let bg = "var(--color-surface-2)";
                let borderColor = "var(--color-border)";
                let color = "var(--color-muted)";
                if (isRight) { bg = "rgba(78,124,82,0.15)"; borderColor = "var(--color-state-sorted)"; color = "var(--color-state-sorted)"; }
                else if (wasChosen && !isRight) { bg = "rgba(176,48,32,0.12)"; borderColor = "var(--color-state-swap)"; color = "var(--color-state-swap)"; }
                return (
                  <div
                    key={opt}
                    className="px-3 py-2.5 rounded-lg border text-xs font-mono"
                    style={{ background: bg, borderColor, color }}
                  >
                    {opt}
                  </div>
                );
              })}
            </div>

            {/* Card info */}
            <div className="rounded-lg p-3 border text-xs space-y-1" style={{ background: "var(--color-surface-2)", borderColor: "var(--color-border)" }}>
              <div className="flex gap-3 flex-wrap">
                <span style={{ color: "var(--color-muted)" }}>Time: <span className="font-mono" style={{ color: "var(--color-text)" }}>{currentCard.time}</span></span>
                <span style={{ color: "var(--color-muted)" }}>Space: <span className="font-mono" style={{ color: "var(--color-text)" }}>{currentCard.space}</span></span>
                {isSorting && (
                  <>
                    <span style={{ color: "var(--color-muted)" }}>Stable: <span style={{ color: "var(--color-text)" }}>{(currentCard as SortingEntry).stable ? "yes" : "no"}</span></span>
                  </>
                )}
              </div>
              <p style={{ color: "var(--color-muted)" }}>{currentCard.blurb}</p>
              <Link href={currentCard.path} className="text-[10px] underline" style={{ color: "var(--color-accent)" }}>
                View visualizer →
              </Link>
            </div>

            <button
              onClick={handleNext}
              className="w-full py-2 rounded-lg text-xs font-semibold"
              style={{ background: "var(--color-accent)", color: "#fff" }}
            >
              {cardIdx + 1 >= deck.length ? "Finish" : "Next"} <kbd className="opacity-60 font-mono text-[9px]">Space</kbd>
            </button>
          </div>
        )}
      </div>

      {/* Keyboard hint */}
      <p className="mt-4 text-[10px]" style={{ color: "var(--color-muted)" }}>
        {phase === "question" ? "Press 1–4 to select an answer" : "Press Space or Enter to continue"}
      </p>
    </div>
  );
}
