"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Trophy, Timer, CheckCircle, XCircle, Star } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Category = "time" | "space" | "name" | "property";
type FilterKey = "all" | "sorting" | "ds" | "graphs";

type QuizQuestion = {
  prompt: string;
  category: Category;
  choices: string[];
  correctIndex: number;
  explanation: string;
  tags: string[];
};

// ─── Quiz Data ────────────────────────────────────────────────────────────────

const ALL_QUESTIONS: QuizQuestion[] = [
  // ── Sorting: Time complexity ──────────────────────────────────────────────
  {
    prompt: "What is the average-case time complexity of Bubble Sort?",
    category: "time",
    choices: ["O(n)", "O(n log n)", "O(n²)", "O(log n)"],
    correctIndex: 2,
    explanation: "Bubble Sort compares adjacent elements in nested loops, giving O(n²) on average.",
    tags: ["sorting"],
  },
  {
    prompt: "What is the average-case time complexity of Selection Sort?",
    category: "time",
    choices: ["O(n log n)", "O(n²)", "O(n)", "O(n³)"],
    correctIndex: 1,
    explanation: "Selection Sort always does n(n-1)/2 comparisons regardless of input — O(n²).",
    tags: ["sorting"],
  },
  {
    prompt: "What is the best-case time complexity of Insertion Sort?",
    category: "time",
    choices: ["O(n²)", "O(n log n)", "O(n)", "O(log n)"],
    correctIndex: 2,
    explanation: "On an already-sorted array, Insertion Sort only makes one comparison per element — O(n).",
    tags: ["sorting"],
  },
  {
    prompt: "What is the time complexity of Merge Sort in all cases?",
    category: "time",
    choices: ["O(n²)", "O(n log n)", "O(n)", "O(log n)"],
    correctIndex: 1,
    explanation: "Merge Sort always splits into log n levels and does O(n) work per level — O(n log n) guaranteed.",
    tags: ["sorting", "divide-conquer"],
  },
  {
    prompt: "What is the worst-case time complexity of Quick Sort?",
    category: "time",
    choices: ["O(n log n)", "O(n)", "O(n²)", "O(n³)"],
    correctIndex: 2,
    explanation: "When the pivot is always the min or max (already sorted input), Quick Sort degrades to O(n²).",
    tags: ["sorting", "divide-conquer"],
  },
  {
    prompt: "What is the time complexity of Heap Sort?",
    category: "time",
    choices: ["O(n²)", "O(n log n)", "O(n)", "O(log n)"],
    correctIndex: 1,
    explanation: "Building the heap is O(n) and extracting each of n elements from the heap costs O(log n), giving O(n log n).",
    tags: ["sorting"],
  },
  {
    prompt: "What is the average-case time complexity of Shell Sort?",
    category: "time",
    choices: ["O(n)", "O(n²)", "O(n log² n)", "O(n log n)"],
    correctIndex: 2,
    explanation: "Shell Sort's complexity depends on the gap sequence; with Ciura's gaps it is approximately O(n log² n).",
    tags: ["sorting"],
  },
  {
    prompt: "What is the time complexity of Counting Sort?",
    category: "time",
    choices: ["O(n log n)", "O(n + k)", "O(n²)", "O(k)"],
    correctIndex: 1,
    explanation: "Counting Sort runs in O(n + k) where k is the range of input values.",
    tags: ["sorting"],
  },
  {
    prompt: "What is the time complexity of Radix Sort?",
    category: "time",
    choices: ["O(n log n)", "O(nk)", "O(n²)", "O(n + k)"],
    correctIndex: 1,
    explanation: "Radix Sort processes k digits/passes, each costing O(n), giving O(nk).",
    tags: ["sorting"],
  },
  {
    prompt: "What is the average-case time complexity of Bucket Sort?",
    category: "time",
    choices: ["O(n²)", "O(n log n)", "O(n + k)", "O(n)"],
    correctIndex: 3,
    explanation: "When input is uniformly distributed, Bucket Sort places n elements into n buckets and sorts each in O(1), giving O(n).",
    tags: ["sorting"],
  },
  {
    prompt: "What is the time complexity of Timsort in the worst case?",
    category: "time",
    choices: ["O(n²)", "O(n)", "O(n log n)", "O(log n)"],
    correctIndex: 2,
    explanation: "Timsort (Python's built-in sort) is based on merge sort and guarantees O(n log n) worst case.",
    tags: ["sorting"],
  },
  {
    prompt: "What is the best-case time complexity of Bubble Sort?",
    category: "time",
    choices: ["O(n²)", "O(n log n)", "O(n)", "O(log n)"],
    correctIndex: 2,
    explanation: "With the early-exit optimization, a single pass over an already-sorted array confirms it's sorted in O(n).",
    tags: ["sorting"],
  },
  // ── Sorting: Space complexity ─────────────────────────────────────────────
  {
    prompt: "What is the space complexity of Merge Sort?",
    category: "space",
    choices: ["O(1)", "O(log n)", "O(n)", "O(n log n)"],
    correctIndex: 2,
    explanation: "Merge Sort requires O(n) auxiliary space for the temporary arrays used during merging.",
    tags: ["sorting"],
  },
  {
    prompt: "What is the space complexity of Quick Sort (average case)?",
    category: "space",
    choices: ["O(1)", "O(log n)", "O(n)", "O(n log n)"],
    correctIndex: 1,
    explanation: "Quick Sort uses O(log n) stack space on average for the recursion stack.",
    tags: ["sorting"],
  },
  {
    prompt: "What is the space complexity of Heap Sort?",
    category: "space",
    choices: ["O(n)", "O(log n)", "O(1)", "O(n log n)"],
    correctIndex: 2,
    explanation: "Heap Sort sorts in-place using the input array as a heap — O(1) auxiliary space.",
    tags: ["sorting"],
  },
  {
    prompt: "What is the space complexity of Bubble Sort?",
    category: "space",
    choices: ["O(n)", "O(1)", "O(log n)", "O(n²)"],
    correctIndex: 1,
    explanation: "Bubble Sort only needs a single temp variable for swaps — O(1) auxiliary space.",
    tags: ["sorting"],
  },
  {
    prompt: "What is the space complexity of Counting Sort?",
    category: "space",
    choices: ["O(1)", "O(n)", "O(k)", "O(n + k)"],
    correctIndex: 2,
    explanation: "Counting Sort needs an auxiliary array of size k (the range), so O(k) space.",
    tags: ["sorting"],
  },
  // ── Sorting: Properties ───────────────────────────────────────────────────
  {
    prompt: "Which of these sorting algorithms is stable?",
    category: "property",
    choices: ["Heap Sort", "Quick Sort", "Merge Sort", "Selection Sort"],
    correctIndex: 2,
    explanation: "Merge Sort preserves the relative order of equal elements, making it stable. Heap Sort and Quick Sort are not stable in their standard forms.",
    tags: ["sorting"],
  },
  {
    prompt: "Which sorting algorithm is considered online (can sort a stream)?",
    category: "property",
    choices: ["Merge Sort", "Insertion Sort", "Heap Sort", "Quick Sort"],
    correctIndex: 1,
    explanation: "Insertion Sort is online — each new element can be inserted into the already-sorted prefix immediately.",
    tags: ["sorting"],
  },
  {
    prompt: "Which sort does the fewest writes (O(n) writes total)?",
    category: "property",
    choices: ["Bubble Sort", "Insertion Sort", "Merge Sort", "Selection Sort"],
    correctIndex: 3,
    explanation: "Selection Sort does exactly n swaps (one per pass), making only O(n) writes — useful when write cost is high.",
    tags: ["sorting"],
  },
  {
    prompt: "What does O(n log n) being optimal for comparison-based sorting require?",
    category: "property",
    choices: [
      "The input must be nearly sorted",
      "Every comparison must be binary",
      "The algorithm must use a decision tree model",
      "Elements must be drawn from a bounded range",
    ],
    correctIndex: 2,
    explanation: "The decision-tree argument: any comparison-based sort needs at least log₂(n!) comparisons, which is Θ(n log n).",
    tags: ["sorting"],
  },
  {
    prompt: "Which sorting algorithm does Python's built-in sort use?",
    category: "property",
    choices: ["Merge Sort", "Quick Sort", "Timsort", "Heap Sort"],
    correctIndex: 2,
    explanation: "Python's built-in sort and JavaScript's Array.prototype.sort in V8 both use Timsort, a hybrid of merge and insertion sort.",
    tags: ["sorting"],
  },
  // ── Data Structures ───────────────────────────────────────────────────────
  {
    prompt: "What is the time complexity of push and pop operations on a Stack?",
    category: "time",
    choices: ["O(n)", "O(log n)", "O(1)", "O(n log n)"],
    correctIndex: 2,
    explanation: "Stack push and pop operate on the top only — constant time O(1).",
    tags: ["ds"],
  },
  {
    prompt: "What is the time complexity of enqueue and dequeue on a Queue?",
    category: "time",
    choices: ["O(n)", "O(1)", "O(log n)", "O(n²)"],
    correctIndex: 1,
    explanation: "With a doubly-linked list or circular buffer, enqueue and dequeue are both O(1).",
    tags: ["ds"],
  },
  {
    prompt: "What is the average-case time complexity of search in a Binary Search Tree?",
    category: "time",
    choices: ["O(n)", "O(log n)", "O(1)", "O(n log n)"],
    correctIndex: 1,
    explanation: "In a balanced BST, search halves the search space each step — O(log n). Worst case (degenerate) is O(n).",
    tags: ["ds"],
  },
  {
    prompt: "What is the time complexity of insert/delete in an AVL Tree?",
    category: "time",
    choices: ["O(1)", "O(n)", "O(n log n)", "O(log n)"],
    correctIndex: 3,
    explanation: "AVL trees maintain balance via rotations. Insert and delete require O(log n) time, including rebalancing.",
    tags: ["ds"],
  },
  {
    prompt: "What is the average-case time complexity of search in a Hash Table?",
    category: "time",
    choices: ["O(log n)", "O(n)", "O(1)", "O(n²)"],
    correctIndex: 2,
    explanation: "With a good hash function and low load factor, hash table lookup is O(1) amortized.",
    tags: ["ds"],
  },
  {
    prompt: "What is the time complexity of extracting the minimum from a Min-Heap?",
    category: "time",
    choices: ["O(1)", "O(n)", "O(log n)", "O(n log n)"],
    correctIndex: 2,
    explanation: "After removing the root, the heap property is restored by sifting down — O(log n).",
    tags: ["ds"],
  },
  {
    prompt: "What is the time complexity of inserting a key into a Trie?",
    category: "time",
    choices: ["O(n)", "O(log n)", "O(m)", "O(1)"],
    correctIndex: 2,
    explanation: "Trie insertion visits one node per character of the key — O(m) where m is the key length.",
    tags: ["ds"],
  },
  {
    prompt: "What is the worst-case time complexity of Hash Table search?",
    category: "time",
    choices: ["O(1)", "O(log n)", "O(n)", "O(n²)"],
    correctIndex: 2,
    explanation: "In the worst case (all keys hash to the same bucket), a hash table degrades to O(n) search.",
    tags: ["ds"],
  },
  {
    prompt: "What is the space complexity of a Trie storing n strings of average length m?",
    category: "space",
    choices: ["O(n)", "O(nm)", "O(m)", "O(n log n)"],
    correctIndex: 1,
    explanation: "In the worst case, a Trie stores O(nm) nodes — one per character across all strings.",
    tags: ["ds"],
  },
  {
    prompt: "What is the time complexity of peek (find-min) in a Min-Heap?",
    category: "time",
    choices: ["O(log n)", "O(n)", "O(n log n)", "O(1)"],
    correctIndex: 3,
    explanation: "The minimum is always at the root of a min-heap, so peek is O(1).",
    tags: ["ds"],
  },
  // ── Graphs ────────────────────────────────────────────────────────────────
  {
    prompt: "What is the time complexity of Breadth-First Search (BFS)?",
    category: "time",
    choices: ["O(V²)", "O(V + E)", "O(E log V)", "O(V log V)"],
    correctIndex: 1,
    explanation: "BFS visits each vertex once and processes each edge once — O(V + E).",
    tags: ["graphs"],
  },
  {
    prompt: "What is the time complexity of Depth-First Search (DFS)?",
    category: "time",
    choices: ["O(V²)", "O(V log V)", "O(V + E)", "O(E²)"],
    correctIndex: 2,
    explanation: "DFS visits each vertex and each edge once — O(V + E).",
    tags: ["graphs"],
  },
  {
    prompt: "What is the time complexity of Dijkstra's algorithm with a binary heap?",
    category: "time",
    choices: ["O(V²)", "O(E + V log V)", "O((V + E) log V)", "O(VE)"],
    correctIndex: 2,
    explanation: "With a binary heap, Dijkstra relaxes each edge once (O(E log V)) and extracts each vertex (O(V log V)), giving O((V + E) log V).",
    tags: ["graphs"],
  },
  {
    prompt: "What is the time complexity of Bellman-Ford algorithm?",
    category: "time",
    choices: ["O(V + E)", "O(VE)", "O(V² log V)", "O(E log V)"],
    correctIndex: 1,
    explanation: "Bellman-Ford relaxes all E edges V-1 times — O(VE).",
    tags: ["graphs"],
  },
  {
    prompt: "What is the time complexity of Prim's algorithm with a binary heap?",
    category: "time",
    choices: ["O(V²)", "O(E log V)", "O(VE)", "O(V log V)"],
    correctIndex: 1,
    explanation: "Prim's with a min-heap processes each edge once and updates the heap — O(E log V).",
    tags: ["graphs"],
  },
  {
    prompt: "What is the time complexity of Kruskal's algorithm?",
    category: "time",
    choices: ["O(VE)", "O(V + E)", "O(E log V)", "O(V² log V)"],
    correctIndex: 2,
    explanation: "Kruskal's sorts edges in O(E log E) = O(E log V) and processes them with Union-Find — O(E log V) total.",
    tags: ["graphs"],
  },
  {
    prompt: "What property of Bellman-Ford distinguishes it from Dijkstra?",
    category: "property",
    choices: [
      "It only works on directed graphs",
      "It can handle negative edge weights",
      "It always runs faster",
      "It requires a sorted edge list",
    ],
    correctIndex: 1,
    explanation: "Bellman-Ford can detect and handle negative edge weights (and negative cycles), whereas Dijkstra requires all weights to be non-negative.",
    tags: ["graphs"],
  },
  {
    prompt: "What is BFS used to find in an unweighted graph?",
    category: "property",
    choices: [
      "Minimum spanning tree",
      "Topological order",
      "Shortest path (fewest edges)",
      "Strongly connected components",
    ],
    correctIndex: 2,
    explanation: "BFS explores in layers of increasing edge distance, so it naturally finds the shortest path (by edge count) in an unweighted graph.",
    tags: ["graphs"],
  },
  {
    prompt: "What is the space complexity of BFS on a graph with V vertices and E edges?",
    category: "space",
    choices: ["O(E)", "O(V + E)", "O(V)", "O(1)"],
    correctIndex: 2,
    explanation: "BFS stores the frontier queue which can hold at most O(V) vertices, plus the visited set — O(V) space.",
    tags: ["graphs"],
  },
  {
    prompt: "Which algorithm finds a Minimum Spanning Tree by growing a single tree from a start vertex?",
    category: "name",
    choices: ["Kruskal's", "Dijkstra's", "Prim's", "Bellman-Ford"],
    correctIndex: 2,
    explanation: "Prim's algorithm grows a single MST by repeatedly adding the cheapest edge that connects a new vertex to the current tree.",
    tags: ["graphs"],
  },
  // ── More property / advanced ──────────────────────────────────────────────
  {
    prompt: "Which sorting algorithms have O(n log n) worst-case time complexity?",
    category: "property",
    choices: [
      "Quick Sort and Bubble Sort",
      "Merge Sort and Heap Sort",
      "Insertion Sort and Shell Sort",
      "Counting Sort and Radix Sort",
    ],
    correctIndex: 1,
    explanation: "Both Merge Sort and Heap Sort guarantee O(n log n) in the worst case. Quick Sort degrades to O(n²) without randomization.",
    tags: ["sorting"],
  },
  {
    prompt: "What is the time complexity of building a Binary Heap from n elements?",
    category: "time",
    choices: ["O(n log n)", "O(n)", "O(log n)", "O(n²)"],
    correctIndex: 1,
    explanation: "Heapify (Floyd's algorithm) uses the insight that most nodes are near the leaves, achieving O(n) build time.",
    tags: ["ds"],
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const HIGHSCORE_KEY = "cc-quiz-highscore";

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function getHighScore(): number {
  if (typeof window === "undefined") return 0;
  try {
    return parseInt(localStorage.getItem(HIGHSCORE_KEY) ?? "0", 10) || 0;
  } catch {
    return 0;
  }
}

function setHighScore(score: number) {
  try {
    localStorage.setItem(HIGHSCORE_KEY, String(score));
  } catch {}
}

function starsForScore(pct: number): number {
  if (pct >= 80) return 3;
  if (pct >= 50) return 2;
  return 0;
}

const FILTER_LABELS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "sorting", label: "Sorting" },
  { key: "ds", label: "Data Structures" },
  { key: "graphs", label: "Graphs" },
];

function filterQuestions(filter: FilterKey): QuizQuestion[] {
  if (filter === "all") return ALL_QUESTIONS;
  return ALL_QUESTIONS.filter((q) => q.tags.includes(filter));
}

// ─── Timer bar component ──────────────────────────────────────────────────────

function TimerBar({ remaining, total }: { remaining: number; total: number }) {
  const pct = remaining / total;
  const color =
    pct > 0.5
      ? "var(--color-state-sorted)"
      : pct > 0.25
      ? "#e0a030"
      : "var(--color-state-swap)";

  return (
    <div
      style={{
        width: "100%",
        height: 6,
        borderRadius: 4,
        background: "var(--color-surface-3)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: `${pct * 100}%`,
          height: "100%",
          borderRadius: 4,
          background: color,
          transition: "width 1s linear, background 0.5s ease",
        }}
      />
    </div>
  );
}

// ─── Stars display ────────────────────────────────────────────────────────────

function Stars({ count }: { count: number }) {
  return (
    <div style={{ display: "flex", gap: 4 }}>
      {[0, 1, 2].map((i) => (
        <Star
          key={i}
          size={28}
          strokeWidth={1.5}
          style={{
            color: i < count ? "#e0a030" : "var(--color-border)",
            fill: i < count ? "#e0a030" : "none",
            transition: "color 0.3s ease, fill 0.3s ease",
          }}
        />
      ))}
    </div>
  );
}

// ─── Category breakdown ───────────────────────────────────────────────────────

type CategoryResult = { label: string; correct: number; total: number };

function CategoryBreakdown({ results }: { results: CategoryResult[] }) {
  return (
    <div
      style={{
        width: "100%",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <p
        style={{
          fontSize: 11,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: "var(--color-muted)",
          marginBottom: 4,
        }}
      >
        By Category
      </p>
      {results.map((r) => {
        const pct = r.total === 0 ? 0 : r.correct / r.total;
        return (
          <div key={r.label}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 12,
                marginBottom: 4,
                color: "var(--color-text)",
              }}
            >
              <span>{r.label}</span>
              <span style={{ color: "var(--color-muted)" }}>
                {r.correct}/{r.total}
              </span>
            </div>
            <div
              style={{
                height: 6,
                borderRadius: 4,
                background: "var(--color-surface-3)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${pct * 100}%`,
                  height: "100%",
                  borderRadius: 4,
                  background:
                    pct >= 0.8
                      ? "var(--color-state-sorted)"
                      : pct >= 0.5
                      ? "#e0a030"
                      : "var(--color-state-swap)",
                  transition: "width 0.5s ease",
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

type QuizState = "idle" | "active" | "results";

const TIMER_SECONDS = 20;

export default function ComplexityQuiz() {
  // ── Core state ──────────────────────────────────────────────────────────
  const [quizState, setQuizState] = useState<QuizState>("idle");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [qIndex, setQIndex] = useState(0);

  // ── Answer / feedback state ─────────────────────────────────────────────
  const [selected, setSelected] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);

  // ── Scoring ─────────────────────────────────────────────────────────────
  const [score, setScore] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [streak, setStreak] = useState(0);

  // ── Timer ───────────────────────────────────────────────────────────────
  const [timeLeft, setTimeLeft] = useState(TIMER_SECONDS);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(Date.now());

  // ── High score ──────────────────────────────────────────────────────────
  const [highScore, setHighScoreState] = useState<number>(0);
  const [newHighScore, setNewHighScore] = useState(false);

  // ── Per-question tracking for breakdown ────────────────────────────────
  const [questionResults, setQuestionResults] = useState<
    { q: QuizQuestion; wasCorrect: boolean }[]
  >([]);

  // Load high score on mount
  useEffect(() => {
    setHighScoreState(getHighScore());
  }, []);

  // ── Timer logic ─────────────────────────────────────────────────────────
  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startTimer = useCallback(() => {
    stopTimer();
    setTimeLeft(TIMER_SECONDS);
    startTimeRef.current = Date.now();
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current!);
          timerRef.current = null;
          return 0;
        }
        return t - 1;
      });
    }, 1000);
  }, [stopTimer]);

  // When time runs out, auto-mark wrong
  useEffect(() => {
    if (quizState !== "active" || answered) return;
    if (timeLeft === 0) {
      handleAnswer(-1); // -1 = timed out
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft, answered, quizState]);

  // Cleanup on unmount
  useEffect(() => () => stopTimer(), [stopTimer]);

  // ── Start quiz ───────────────────────────────────────────────────────────
  function startQuiz() {
    const qs = shuffle(filterQuestions(filter));
    setQuestions(qs);
    setQIndex(0);
    setSelected(null);
    setAnswered(false);
    setScore(0);
    setCorrect(0);
    setStreak(0);
    setQuestionResults([]);
    setNewHighScore(false);
    setQuizState("active");
    startTimer();
  }

  // ── Handle answer ────────────────────────────────────────────────────────
  function handleAnswer(choiceIdx: number) {
    if (answered) return;
    stopTimer();
    setSelected(choiceIdx);
    setAnswered(true);

    const q = questions[qIndex];
    const isCorrect = choiceIdx === q.correctIndex;
    const elapsed = (Date.now() - startTimeRef.current) / 1000;
    const bonus = isCorrect && elapsed <= 5 ? 5 : 0;
    const points = isCorrect ? 10 + bonus : 0;

    setScore((s) => s + points);
    setCorrect((c) => c + (isCorrect ? 1 : 0));
    setStreak((s) => (isCorrect ? s + 1 : 0));
    setQuestionResults((prev) => [...prev, { q, wasCorrect: isCorrect }]);
  }

  // ── Advance to next question ──────────────────────────────────────────────
  function next() {
    if (qIndex + 1 >= questions.length) {
      finishQuiz();
    } else {
      setQIndex((i) => i + 1);
      setSelected(null);
      setAnswered(false);
      startTimer();
    }
  }

  // ── Finish quiz ───────────────────────────────────────────────────────────
  function finishQuiz() {
    stopTimer();
    const currentHigh = getHighScore();
    if (score > currentHigh) {
      setHighScore(score);
      setHighScoreState(score);
      setNewHighScore(true);
    }
    setQuizState("results");
  }

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    if (quizState !== "active") return;
    function onKey(e: KeyboardEvent) {
      if (answered) {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          next();
        }
      } else {
        const idx = parseInt(e.key, 10) - 1;
        if (idx >= 0 && idx < 4) handleAnswer(idx);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quizState, answered, qIndex]);

  // ─── Idle state ───────────────────────────────────────────────────────────
  if (quizState === "idle") {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "48px 16px",
          gap: 24,
        }}
      >
        <div style={{ textAlign: "center" }}>
          <Trophy
            size={48}
            style={{ color: "var(--color-accent)", marginBottom: 12 }}
          />
          <h1
            style={{
              fontSize: 28,
              fontWeight: 800,
              color: "var(--color-text)",
              marginBottom: 8,
            }}
          >
            Complexity Quiz
          </h1>
          <p
            style={{
              fontSize: 14,
              color: "var(--color-muted)",
              maxWidth: 420,
              lineHeight: 1.6,
            }}
          >
            Test your knowledge of algorithm complexities. You have{" "}
            {TIMER_SECONDS} seconds per question. Answer fast for a bonus!
          </p>
        </div>

        {/* High score */}
        {highScore > 0 && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 16px",
              borderRadius: 999,
              background: "var(--color-surface-2)",
              border: "1px solid var(--color-border)",
              fontSize: 13,
            }}
          >
            <Trophy size={14} style={{ color: "#e0a030" }} />
            <span style={{ color: "var(--color-muted)" }}>High Score:</span>
            <strong style={{ color: "var(--color-text)" }}>{highScore}</strong>
          </div>
        )}

        {/* Filter buttons */}
        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            justifyContent: "center",
          }}
        >
          {FILTER_LABELS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              style={{
                padding: "6px 16px",
                borderRadius: 999,
                fontSize: 13,
                fontWeight: filter === key ? 700 : 400,
                border: "1px solid var(--color-border)",
                cursor: "pointer",
                background:
                  filter === key
                    ? "var(--color-accent)"
                    : "var(--color-surface-2)",
                color: filter === key ? "#fff" : "var(--color-text)",
                transition: "all 0.15s ease",
              }}
            >
              {label}
              <span
                style={{
                  marginLeft: 6,
                  fontSize: 11,
                  opacity: 0.7,
                }}
              >
                ({filterQuestions(key).length})
              </span>
            </button>
          ))}
        </div>

        <button
          onClick={startQuiz}
          style={{
            padding: "12px 40px",
            borderRadius: 12,
            fontSize: 15,
            fontWeight: 700,
            background: "var(--color-accent)",
            color: "#fff",
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 8,
            letterSpacing: "0.02em",
          }}
        >
          Start Quiz
        </button>

        <p style={{ fontSize: 12, color: "var(--color-muted)" }}>
          Press 1–4 to answer · Space to advance
        </p>
      </div>
    );
  }

  // ─── Results state ────────────────────────────────────────────────────────
  if (quizState === "results") {
    const pct =
      questions.length === 0 ? 0 : Math.round((correct / questions.length) * 100);
    const stars = starsForScore(pct);

    // Build breakdown
    const cats: Record<string, CategoryResult> = {
      Time: { label: "Time Complexity", correct: 0, total: 0 },
      Space: { label: "Space Complexity", correct: 0, total: 0 },
      Properties: { label: "Properties", correct: 0, total: 0 },
    };
    questionResults.forEach(({ q, wasCorrect }) => {
      const key =
        q.category === "time"
          ? "Time"
          : q.category === "space"
          ? "Space"
          : "Properties";
      cats[key].total++;
      if (wasCorrect) cats[key].correct++;
    });
    const catList = Object.values(cats).filter((c) => c.total > 0);

    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "48px 16px",
          gap: 24,
          maxWidth: 600,
          margin: "0 auto",
        }}
      >
        <h2 style={{ fontSize: 22, fontWeight: 800, color: "var(--color-text)" }}>
          Quiz Complete!
        </h2>

        {/* Big score */}
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              fontSize: 56,
              fontWeight: 900,
              color: "var(--color-accent)",
              lineHeight: 1,
              fontFamily: "var(--font-mono)",
            }}
          >
            {correct}
            <span style={{ fontSize: 32, color: "var(--color-muted)" }}>
              {" "}/ {questions.length}
            </span>
          </div>
          <p style={{ color: "var(--color-muted)", fontSize: 14, marginTop: 4 }}>
            {pct}% correct · {score} pts
          </p>
        </div>

        <Stars count={stars} />

        {newHighScore && (
          <div
            style={{
              padding: "8px 20px",
              borderRadius: 999,
              background: "rgba(224,160,48,0.15)",
              border: "1px solid #e0a030",
              color: "#e0a030",
              fontSize: 13,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Trophy size={14} /> New High Score!
          </div>
        )}

        {catList.length > 0 && (
          <div
            style={{
              width: "100%",
              maxWidth: 500,
              padding: 20,
              borderRadius: 12,
              border: "1px solid var(--color-border)",
              background: "var(--color-surface-1)",
            }}
          >
            <CategoryBreakdown results={catList} />
          </div>
        )}

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <button
            onClick={startQuiz}
            style={{
              padding: "10px 28px",
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 700,
              background: "var(--color-accent)",
              color: "#fff",
              border: "none",
              cursor: "pointer",
            }}
          >
            Try Again
          </button>
          <button
            onClick={() => setQuizState("idle")}
            style={{
              padding: "10px 28px",
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 700,
              background: "var(--color-surface-2)",
              color: "var(--color-text)",
              border: "1px solid var(--color-border)",
              cursor: "pointer",
            }}
          >
            Change Filters
          </button>
        </div>
      </div>
    );
  }

  // ─── Active state ─────────────────────────────────────────────────────────
  const q = questions[qIndex];
  if (!q) return null;

  const timedOut = answered && selected === -1;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "32px 16px",
        gap: 20,
      }}
    >
      <div style={{ width: "100%", maxWidth: 600 }}>
        {/* Progress bar */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 12,
            color: "var(--color-muted)",
            marginBottom: 6,
          }}
        >
          <span>
            Question {qIndex + 1} of {questions.length}
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ color: "var(--color-text)", fontWeight: 700 }}>
              {correct}
            </span>
            /{qIndex} correct
            {streak >= 2 && (
              <span
                style={{
                  marginLeft: 8,
                  padding: "1px 8px",
                  borderRadius: 999,
                  background: "rgba(224,160,48,0.15)",
                  color: "#e0a030",
                  fontWeight: 700,
                  fontSize: 11,
                }}
              >
                🔥 {streak}
              </span>
            )}
          </span>
        </div>

        {/* Question progress fill */}
        <div
          style={{
            height: 4,
            borderRadius: 4,
            background: "var(--color-surface-3)",
            overflow: "hidden",
            marginBottom: 16,
          }}
        >
          <div
            style={{
              width: `${((qIndex + 1) / questions.length) * 100}%`,
              height: "100%",
              background: "var(--color-accent)",
              borderRadius: 4,
              transition: "width 0.3s ease",
            }}
          />
        </div>

        {/* Card */}
        <div
          style={{
            borderRadius: 16,
            border: "1px solid var(--color-border)",
            background: "var(--color-surface-1)",
            padding: 24,
            display: "flex",
            flexDirection: "column",
            gap: 20,
          }}
        >
          {/* Timer */}
          <div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 6,
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  textTransform: "uppercase",
                  letterSpacing: "0.07em",
                  color: "var(--color-muted)",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <Timer size={11} />
                Timer
              </span>
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 13,
                  fontWeight: 700,
                  color:
                    timeLeft <= 5
                      ? "var(--color-state-swap)"
                      : timeLeft <= 10
                      ? "#e0a030"
                      : "var(--color-state-sorted)",
                }}
              >
                {timeLeft}s
              </span>
            </div>
            <TimerBar remaining={timeLeft} total={TIMER_SECONDS} />
          </div>

          {/* Question */}
          <div style={{ textAlign: "center" }}>
            <p
              style={{
                fontSize: 10,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: "var(--color-muted)",
                marginBottom: 8,
              }}
            >
              {q.category === "time"
                ? "Time Complexity"
                : q.category === "space"
                ? "Space Complexity"
                : q.category === "name"
                ? "Algorithm Name"
                : "Algorithm Property"}
            </p>
            <h2
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: "var(--color-text)",
                lineHeight: 1.4,
              }}
            >
              {q.prompt}
            </h2>
          </div>

          {/* Answer grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 10,
            }}
          >
            {q.choices.map((choice, i) => {
              let bg = "var(--color-surface-2)";
              let border = "var(--color-border)";
              let color = "var(--color-text)";
              let icon: React.ReactNode = null;

              if (answered) {
                if (i === q.correctIndex) {
                  bg = "rgba(78,124,82,0.15)";
                  border = "var(--color-state-sorted)";
                  color = "var(--color-state-sorted)";
                  icon = <CheckCircle size={14} />;
                } else if (i === selected && i !== q.correctIndex) {
                  bg = "rgba(176,48,32,0.12)";
                  border = "var(--color-state-swap)";
                  color = "var(--color-state-swap)";
                  icon = <XCircle size={14} />;
                } else {
                  color = "var(--color-muted)";
                }
              }

              return (
                <button
                  key={i}
                  onClick={() => !answered && handleAnswer(i)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "10px 14px",
                    borderRadius: 10,
                    border: `1px solid ${border}`,
                    background: bg,
                    color: color,
                    fontSize: 13,
                    fontFamily: "var(--font-mono)",
                    fontWeight: 500,
                    textAlign: "left",
                    cursor: answered ? "default" : "pointer",
                    transition: "background 0.15s, border-color 0.15s",
                  }}
                  onMouseEnter={(e) => {
                    if (!answered)
                      (e.currentTarget as HTMLElement).style.background =
                        "var(--color-surface-3)";
                  }}
                  onMouseLeave={(e) => {
                    if (!answered)
                      (e.currentTarget as HTMLElement).style.background =
                        "var(--color-surface-2)";
                  }}
                >
                  <span
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: "50%",
                      background: "var(--color-surface-3)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 10,
                      fontWeight: 700,
                      flexShrink: 0,
                      color: "var(--color-muted)",
                    }}
                  >
                    {i + 1}
                  </span>
                  {icon}
                  {choice}
                </button>
              );
            })}
          </div>

          {/* Feedback / explanation */}
          {answered && (
            <div
              style={{
                padding: "12px 16px",
                borderRadius: 10,
                background: timedOut
                  ? "rgba(176,48,32,0.08)"
                  : selected === q.correctIndex
                  ? "rgba(78,124,82,0.08)"
                  : "rgba(176,48,32,0.08)",
                border: `1px solid ${
                  timedOut
                    ? "var(--color-state-swap)"
                    : selected === q.correctIndex
                    ? "var(--color-state-sorted)"
                    : "var(--color-state-swap)"
                }`,
                display: "flex",
                flexDirection: "column",
                gap: 4,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontWeight: 700,
                  fontSize: 13,
                  color:
                    !timedOut && selected === q.correctIndex
                      ? "var(--color-state-sorted)"
                      : "var(--color-state-swap)",
                }}
              >
                {!timedOut && selected === q.correctIndex ? (
                  <CheckCircle size={14} />
                ) : (
                  <XCircle size={14} />
                )}
                {timedOut
                  ? "Time's up!"
                  : selected === q.correctIndex
                  ? `Correct! ${(Date.now() - startTimeRef.current) / 1000 <= 5 ? "+5 speed bonus!" : ""}`
                  : "Incorrect"}
              </div>
              <p style={{ fontSize: 12, color: "var(--color-muted)", lineHeight: 1.5 }}>
                {q.explanation}
              </p>
            </div>
          )}

          {/* Next button */}
          {answered && (
            <button
              onClick={next}
              style={{
                padding: "10px 24px",
                borderRadius: 10,
                background: "var(--color-accent)",
                color: "#fff",
                fontWeight: 700,
                fontSize: 14,
                border: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}
            >
              {qIndex + 1 >= questions.length ? "See Results" : "Next"}{" "}
              <kbd
                style={{
                  opacity: 0.6,
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                }}
              >
                Space
              </kbd>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
