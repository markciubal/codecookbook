"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Search, Plus, RotateCcw, Play, Pause, SkipForward } from "lucide-react";

// ── Trie data structure ───────────────────────────────────────────────────────

interface TrieNode {
  char: string;
  children: Map<string, TrieNode>;
  isEnd: boolean;
  id: string;
}

let nodeCounter = 0;
function makeNode(char: string): TrieNode {
  return { char, children: new Map(), isEnd: false, id: `n${nodeCounter++}` };
}

function cloneNode(node: TrieNode): TrieNode {
  const cloned: TrieNode = { ...node, children: new Map() };
  for (const [k, v] of node.children) {
    cloned.children.set(k, cloneNode(v));
  }
  return cloned;
}

function insertWord(root: TrieNode, word: string): TrieNode {
  const newRoot = cloneNode(root);
  let curr = newRoot;
  for (const ch of word) {
    if (!curr.children.has(ch)) {
      curr.children.set(ch, makeNode(ch));
    }
    curr = curr.children.get(ch)!;
  }
  curr.isEnd = true;
  return newRoot;
}

// ── Animation steps ───────────────────────────────────────────────────────────

interface TrieStep {
  trie: TrieNode;
  highlighted: string[];
  message: string;
}

function buildInsertSteps(root: TrieNode, word: string): TrieStep[] {
  const steps: TrieStep[] = [];
  let curr = cloneNode(root);
  steps.push({ trie: cloneNode(curr), highlighted: [curr.id], message: `Inserting "${word}" — start at root` });

  let node = curr;
  for (let i = 0; i < word.length; i++) {
    const ch = word[i];
    if (!node.children.has(ch)) {
      node.children.set(ch, makeNode(ch));
      const child = node.children.get(ch)!;
      steps.push({ trie: cloneNode(curr), highlighted: [child.id], message: `Created new node '${ch}' for character ${i + 1}/${word.length}` });
    } else {
      const child = node.children.get(ch)!;
      steps.push({ trie: cloneNode(curr), highlighted: [child.id], message: `Found existing node '${ch}' for character ${i + 1}/${word.length}` });
    }
    node = node.children.get(ch)!;
  }
  node.isEnd = true;
  steps.push({ trie: cloneNode(curr), highlighted: [node.id], message: `Marked '${word[word.length - 1]}' as end of word "${word}"` });
  return steps;
}

function buildSearchSteps(root: TrieNode, word: string): TrieStep[] {
  const steps: TrieStep[] = [];
  steps.push({ trie: cloneNode(root), highlighted: [root.id], message: `Searching "${word}" — start at root` });

  let node = root;
  for (let i = 0; i < word.length; i++) {
    const ch = word[i];
    if (!node.children.has(ch)) {
      steps.push({ trie: cloneNode(root), highlighted: [], message: `'${ch}' not found — "${word}" NOT in trie` });
      return steps;
    }
    node = node.children.get(ch)!;
    steps.push({ trie: cloneNode(root), highlighted: [node.id], message: `Found '${ch}' (${i + 1}/${word.length})` });
  }
  if (node.isEnd) {
    steps.push({ trie: cloneNode(root), highlighted: [node.id], message: `"${word}" FOUND in trie!` });
  } else {
    steps.push({ trie: cloneNode(root), highlighted: [node.id], message: `"${word}" is a prefix but NOT a complete word` });
  }
  return steps;
}

// ── SVG Layout ────────────────────────────────────────────────────────────────

interface LayoutNodeInfo {
  id: string;
  char: string;
  isEnd: boolean;
  x: number;
  y: number;
  parentId: string | null;
  parentX: number;
  parentY: number;
}

const NODE_R = 18;
const LEVEL_HEIGHT = 70;
const H_GAP = 44;

function countLeaves(node: TrieNode): number {
  if (node.children.size === 0) return 1;
  let sum = 0;
  for (const child of node.children.values()) sum += countLeaves(child);
  return sum;
}

function layoutTrie(root: TrieNode): LayoutNodeInfo[] {
  const result: LayoutNodeInfo[] = [];

  function recurse(
    node: TrieNode,
    level: number,
    xStart: number,
    parentId: string | null,
    parentX: number,
    parentY: number
  ): number {
    const leaves = countLeaves(node);
    const width = leaves * H_GAP;
    const cx = xStart + width / 2;
    const cy = level * LEVEL_HEIGHT + NODE_R + 10;
    result.push({ id: node.id, char: node.char, isEnd: node.isEnd, x: cx, y: cy, parentId, parentX, parentY });

    let offset = xStart;
    for (const child of node.children.values()) {
      const childLeaves = countLeaves(child);
      recurse(child, level + 1, offset, node.id, cx, cy, );
      offset += childLeaves * H_GAP;
    }
    return width;
  }

  recurse(root, 0, 0, null, 0, 0);
  return result;
}

// ── SVG Renderer ──────────────────────────────────────────────────────────────

function TrieSVG({ trie, highlighted }: { trie: TrieNode; highlighted: string[] }) {
  const nodes = layoutTrie(trie);
  if (nodes.length === 0) return null;

  const highlightSet = new Set(highlighted);
  const minX = Math.min(...nodes.map((n) => n.x)) - NODE_R - 10;
  const maxX = Math.max(...nodes.map((n) => n.x)) + NODE_R + 10;
  const maxY = Math.max(...nodes.map((n) => n.y)) + NODE_R + 20;
  const width = Math.max(maxX - minX, 100);
  const offsetX = -minX;

  return (
    <svg
      width="100%"
      viewBox={`0 0 ${width} ${maxY}`}
      style={{ display: "block", overflow: "visible" }}
    >
      {/* Edges */}
      {nodes.map((n) => {
        if (!n.parentId) return null;
        return (
          <line
            key={`e-${n.id}`}
            x1={n.parentX + offsetX}
            y1={n.parentY}
            x2={n.x + offsetX}
            y2={n.y}
            stroke="var(--color-border)"
            strokeWidth={2}
          />
        );
      })}

      {/* Nodes */}
      {nodes.map((n) => {
        const cx = n.x + offsetX;
        const isHighlighted = highlightSet.has(n.id);
        const fill = isHighlighted
          ? "var(--color-accent)"
          : n.isEnd
          ? "rgba(34,197,94,0.25)"
          : "var(--color-surface-2)";
        const stroke = isHighlighted
          ? "var(--color-accent)"
          : n.isEnd
          ? "#22c55e"
          : "var(--color-border)";
        const textColor = isHighlighted ? "#fff" : "var(--color-text)";

        return (
          <g key={n.id}>
            {/* Outer ring for end nodes */}
            {n.isEnd && !isHighlighted && (
              <circle
                cx={cx}
                cy={n.y}
                r={NODE_R + 4}
                fill="none"
                stroke="#22c55e"
                strokeWidth={1.5}
                strokeDasharray="3 2"
              />
            )}
            <circle
              cx={cx}
              cy={n.y}
              r={NODE_R}
              fill={fill}
              stroke={stroke}
              strokeWidth={2}
            />
            <text
              x={cx}
              y={n.y}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={n.char === "·" ? 20 : 14}
              fontWeight="bold"
              fontFamily="monospace"
              fill={textColor}
            >
              {n.char === "" ? "·" : n.char}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ── Controls primitives ───────────────────────────────────────────────────────

function Btn({
  children,
  onClick,
  primary,
  disabled,
  icon,
}: {
  children: React.ReactNode;
  onClick: () => void;
  primary?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
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

// ── Main component ────────────────────────────────────────────────────────────

const PRESET_WORDS = ["apple", "app", "apt", "bat", "ball", "band", "can", "cat"];

function buildInitialTrie(): TrieNode {
  nodeCounter = 0;
  let root = makeNode("");
  for (const w of PRESET_WORDS) root = insertWord(root, w);
  return root;
}

export default function TrieVisualizer() {
  const [trie, setTrie] = useState<TrieNode>(buildInitialTrie);
  const [inputWord, setInputWord] = useState("");
  const [steps, setSteps] = useState<TrieStep[]>([]);
  const [stepIdx, setStepIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(700);
  const [message, setMessage] = useState("Trie pre-populated with preset words. Insert or search!");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const currentStep = steps[stepIdx] ?? null;
  const displayTrie = currentStep ? currentStep.trie : trie;
  const highlighted = currentStep ? currentStep.highlighted : [];

  // Playback
  useEffect(() => {
    if (!playing) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(() => {
      setStepIdx((prev) => {
        if (prev >= steps.length - 1) {
          setPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, speed);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [playing, speed, steps.length]);

  useEffect(() => {
    if (currentStep) setMessage(currentStep.message);
  }, [currentStep]);

  const startAnimation = useCallback((newSteps: TrieStep[]) => {
    setSteps(newSteps);
    setStepIdx(0);
    setPlaying(false);
    if (newSteps.length > 0) setMessage(newSteps[0].message);
  }, []);

  const handleInsert = useCallback(() => {
    const word = inputWord.trim().toLowerCase().replace(/[^a-z]/g, "");
    if (!word) return;
    const newSteps = buildInsertSteps(trie, word);
    startAnimation(newSteps);
    // Apply the insert to the live trie after the animation
    const finalTrie = insertWord(trie, word);
    // We'll commit the change when animation finishes or immediately use steps
    // Commit trie update right away so the final step trie is correct
    setTrie(finalTrie);
    setInputWord("");
  }, [inputWord, trie, startAnimation]);

  const handleSearch = useCallback(() => {
    const word = inputWord.trim().toLowerCase().replace(/[^a-z]/g, "");
    if (!word) return;
    const newSteps = buildSearchSteps(trie, word);
    startAnimation(newSteps);
    setInputWord("");
  }, [inputWord, trie, startAnimation]);

  const handleReset = useCallback(() => {
    nodeCounter = 0;
    const fresh = buildInitialTrie();
    setTrie(fresh);
    setSteps([]);
    setStepIdx(0);
    setPlaying(false);
    setMessage("Reset to preset words.");
  }, []);

  const handleStep = () => {
    if (stepIdx < steps.length - 1) setStepIdx((p) => p + 1);
  };

  return (
    <div className="flex flex-col min-h-dvh" style={{ background: "var(--color-bg)" }}>
      {/* Header */}
      <div className="px-5 pt-6 pb-4" style={{ borderBottom: "1px solid var(--color-border)" }}>
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <Search size={20} style={{ color: "var(--color-accent)", flexShrink: 0 }} strokeWidth={1.75} />
          <h1 className="text-2xl font-bold">Trie</h1>
          <span className="text-xs font-mono px-2 py-0.5 rounded-full" style={{ background: "rgba(124,106,247,0.15)", color: "var(--color-accent)" }}>Prefix Tree</span>
          <span className="text-xs font-mono px-2 py-0.5 rounded-full" style={{ background: "rgba(167,139,250,0.12)", color: "#a78bfa" }}>O(k) search</span>
        </div>
        <p className="text-sm" style={{ color: "var(--color-muted)" }}>
          A tree-shaped data structure for storing strings. Each path from root to an end-node spells a word.
        </p>
      </div>

      <div className="flex-1 px-5 pt-5 pb-4 flex flex-col gap-4">
        {/* Message */}
        <div
          className="rounded-lg px-4 py-3 text-sm min-h-10"
          style={{ background: "var(--color-surface-2)", color: "var(--color-accent)" }}
        >
          {message}
        </div>

        {/* SVG Canvas */}
        <div
          className="rounded-xl overflow-auto"
          style={{
            background: "var(--color-surface-1)",
            border: "1px solid var(--color-border)",
            minHeight: 200,
            padding: "16px 8px",
          }}
        >
          <TrieSVG trie={displayTrie} highlighted={highlighted} />
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-4">
          {[
            { label: "highlighted", color: "var(--color-accent)" },
            { label: "end of word", color: "#22c55e", dashed: true },
            { label: "default", color: "var(--color-surface-3)" },
          ].map(({ label, color, dashed }) => (
            <div key={label} className="flex items-center gap-1.5">
              <div
                className="w-3 h-3 rounded-full"
                style={{
                  background: color,
                  outline: dashed ? "1.5px dashed #22c55e" : undefined,
                  outlineOffset: "2px",
                }}
              />
              <span className="text-xs" style={{ color: "var(--color-muted)" }}>{label}</span>
            </div>
          ))}
        </div>

        {/* Preset words */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--color-muted)" }}>
            Preset words (click to set)
          </p>
          <div className="flex flex-wrap gap-2">
            {PRESET_WORDS.map((w) => (
              <button
                key={w}
                onClick={() => setInputWord(w)}
                className="px-2 py-0.5 rounded-full text-xs font-mono transition-colors"
                style={{
                  background: "var(--color-surface-3)",
                  border: "1px solid var(--color-border)",
                  color: "var(--color-text)",
                  cursor: "pointer",
                }}
              >
                {w}
              </button>
            ))}
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2 items-center">
            <input
              type="text"
              value={inputWord}
              onChange={(e) => setInputWord(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleInsert(); }}
              placeholder="e.g. apple"
              className="rounded-lg px-3 py-2 text-sm w-36 outline-none"
              style={{
                background: "var(--color-surface-2)",
                border: "1px solid var(--color-border)",
                color: "var(--color-text)",
              }}
            />
            <Btn onClick={handleInsert} primary icon={<Plus size={13} />}>Insert</Btn>
            <Btn onClick={handleSearch} icon={<Search size={13} />}>Search</Btn>
            <Btn onClick={handleReset} icon={<RotateCcw size={13} />}>Reset</Btn>
          </div>

          {/* Playback controls */}
          {steps.length > 0 && (
            <div className="flex flex-wrap gap-2 items-center">
              <Btn
                onClick={() => setPlaying((p) => !p)}
                disabled={stepIdx >= steps.length - 1 && !playing}
                icon={playing ? <Pause size={13} /> : <Play size={13} />}
              >
                {playing ? "Pause" : "Play"}
              </Btn>
              <Btn onClick={handleStep} disabled={stepIdx >= steps.length - 1} icon={<SkipForward size={13} />}>
                Step
              </Btn>
              <Btn onClick={() => { setStepIdx(0); setPlaying(false); }} icon={<RotateCcw size={13} />}>
                Restart
              </Btn>
              <span className="text-xs" style={{ color: "var(--color-muted)" }}>
                Step {stepIdx + 1}/{steps.length}
              </span>
              <div className="flex items-center gap-2 ml-2">
                <span className="text-xs" style={{ color: "var(--color-muted)" }}>Speed</span>
                <input
                  type="range"
                  min={150}
                  max={1200}
                  step={50}
                  value={1350 - speed}
                  onChange={(e) => setSpeed(1350 - Number(e.target.value))}
                  className="w-24"
                />
              </div>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="grid grid-cols-2 gap-3 mt-2" style={{ maxWidth: 480 }}>
          {[
            { op: "insert(w)", time: "O(k)", desc: "k = word length" },
            { op: "search(w)", time: "O(k)", desc: "k = word length" },
            { op: "prefix(p)", time: "O(k)", desc: "Check prefix exists" },
            { op: "Space",     time: "O(N·k)", desc: "N words, avg length k" },
          ].map(({ op, time, desc }) => (
            <div key={op} className="rounded-lg p-2.5" style={{ background: "var(--color-surface-2)" }}>
              <div className="text-xs font-mono" style={{ color: "var(--color-accent)" }}>{op}</div>
              <div className="text-xs font-bold" style={{ color: "var(--color-text)" }}>{time}</div>
              <div className="text-xs" style={{ color: "var(--color-muted)" }}>{desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
