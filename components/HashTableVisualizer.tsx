"use client";

import { useState, useEffect, useRef } from "react";
import CodePanel from "./CodePanel";
import CodeModal from "./CodeModal";
import PanelModal from "./PanelModal";
import { Info } from "lucide-react";

const TABLE_SIZE = 11;

function hash(key: number): number {
  return key % TABLE_SIZE;
}

interface HighlightState {
  bucket: number;
  val?: number;
  type: "insert" | "found" | "deleted" | "searching";
}

export default function HashTableVisualizer() {
  const [table, setTable] = useState<number[][]>(() =>
    Array.from({ length: TABLE_SIZE }, () => [])
  );
  const [inputVal, setInputVal] = useState("");
  const [log, setLog] = useState<string[]>(["Hash table initialized (size 11)"]);
  const [error, setError] = useState<string | null>(null);
  const [highlighted, setHighlighted] = useState<HighlightState | null>(null);
  const [panelTab, setPanelTab] = useState<"info" | "code">("info");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [activeMethod, setActiveMethod] = useState<string | null>(null);

  const addLog = (msg: string) => setLog((p) => [msg, ...p].slice(0, 20));

  const triggerMethod = (name: string) => {
    setActiveMethod(name);
    setTimeout(() => setActiveMethod(null), 1800);
  };

  useEffect(() => {
    if (!highlighted) return;
    const t = setTimeout(() => setHighlighted(null), 1200);
    return () => clearTimeout(t);
  }, [highlighted]);

  const insert = () => {
    const v = parseInt(inputVal, 10);
    if (isNaN(v)) { setError("Enter a valid integer"); return; }
    const bucket = hash(v);
    if (table[bucket].includes(v)) { setError(`${v} already exists in bucket ${bucket}`); return; }
    setError(null);
    setInputVal("");
    triggerMethod("insert");
    setHighlighted({ bucket, val: v, type: "insert" });
    setTable((prev) => prev.map((b, i) => i === bucket ? [...b, v] : b));
    addLog(`insert(${v}) → bucket ${bucket} [hash: ${v} % ${TABLE_SIZE} = ${bucket}]`);
  };

  const search = () => {
    const v = parseInt(inputVal, 10);
    if (isNaN(v)) { setError("Enter a valid integer"); return; }
    const bucket = hash(v);
    triggerMethod("search");
    setHighlighted({ bucket, val: v, type: "searching" });
    setTimeout(() => {
      if (table[bucket].includes(v)) {
        setHighlighted({ bucket, val: v, type: "found" });
        addLog(`search(${v}) → FOUND in bucket ${bucket}`);
      } else {
        setHighlighted(null);
        addLog(`search(${v}) → NOT FOUND (bucket ${bucket} searched)`);
        setError(`${v} not found`);
      }
    }, 400);
  };

  const remove = () => {
    const v = parseInt(inputVal, 10);
    if (isNaN(v)) { setError("Enter a valid integer"); return; }
    const bucket = hash(v);
    if (!table[bucket].includes(v)) { setError(`${v} not found`); return; }
    setError(null);
    setInputVal("");
    triggerMethod("delete");
    setHighlighted({ bucket, val: v, type: "deleted" });
    setTable((prev) => prev.map((b, i) => i === bucket ? b.filter((x) => x !== v) : b));
    addLog(`delete(${v}) → removed from bucket ${bucket}`);
  };

  const clear = () => {
    setTable(Array.from({ length: TABLE_SIZE }, () => []));
    addLog("Hash table cleared");
    setError(null);
    setHighlighted(null);
  };

  const totalElements = table.reduce((sum, b) => sum + b.length, 0);
  const loadFactor = (totalElements / TABLE_SIZE).toFixed(2);
  const maxChain = Math.max(...table.map((b) => b.length));

  return (
    <div className="flex flex-col min-h-dvh" style={{ background: "var(--color-bg)" }}>
      {/* Header */}
      <div className="px-5 pt-6 pb-4" style={{ borderBottom: "1px solid var(--color-border)" }}>
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <h1 className="text-2xl font-bold">Hash Table</h1>
          <Pill text="O(1) avg" />
          <Pill text="Chaining" green />
          <div className="ml-auto flex gap-2">
            <button
              onClick={() => setIsPanelOpen((p) => !p)}
              title="Info"
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-mono transition-colors"
              style={{
                background: isPanelOpen ? "var(--color-accent)" : "var(--color-surface-3)",
                border: "1px solid var(--color-border)",
                color: isPanelOpen ? "#fff" : "var(--color-muted)",
                cursor: "pointer",
              }}
            >
              <Info size={13} strokeWidth={1.75} /> Info
            </button>
            <button
              onClick={() => setIsModalOpen(true)}
              title="View Code"
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-mono transition-colors"
              style={{
                background: isModalOpen ? "var(--color-accent)" : "var(--color-surface-3)",
                border: "1px solid var(--color-border)",
                color: isModalOpen ? "#fff" : "var(--color-accent)",
                cursor: "pointer",
              }}
            >{"</>"}</button>
          </div>
        </div>
        <p className="text-sm" style={{ color: "var(--color-muted)" }}>
          Keys are mapped to buckets via a hash function. Collisions are resolved with separate chaining — each bucket holds a linked list of values.
        </p>
      </div>

      <div className="flex flex-col flex-1">
        <div className="flex-1 px-5 pt-5 pb-4 flex flex-col gap-4">
          {/* Stats */}
          <div className="flex flex-wrap gap-6">
            <DStat label="Size" value={totalElements} />
            <DStat label="Load Factor" value={loadFactor} color="var(--color-accent)" />
            <DStat label="Max Chain" value={maxChain} color="#a78bfa" />
          </div>

          {/* Hash table visualization */}
          <div
            className="rounded-xl overflow-hidden"
            style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)" }}
          >
            {Array.from({ length: TABLE_SIZE }, (_, i) => {
              const isHighlighted = highlighted?.bucket === i;
              const highlightColor =
                highlighted?.type === "found" ? "var(--color-state-sorted)"
                : highlighted?.type === "deleted" ? "var(--color-state-swap)"
                : highlighted?.type === "insert" ? "#22c55e"
                : highlighted?.type === "searching" ? "var(--color-state-compare)"
                : undefined;
              return (
                <div
                  key={i}
                  className="flex items-center gap-3 px-4 py-2.5 border-b transition-all"
                  style={{
                    borderColor: "var(--color-border)",
                    background: isHighlighted
                      ? (highlighted?.type === "deleted" ? "rgba(239,68,68,0.08)" : "rgba(124,106,247,0.08)")
                      : "transparent",
                    borderLeft: isHighlighted ? `3px solid ${highlightColor}` : "3px solid transparent",
                  }}
                >
                  {/* Index badge */}
                  <span
                    className="text-xs font-mono w-6 text-right shrink-0"
                    style={{ color: "var(--color-muted)" }}
                  >
                    {i}
                  </span>
                  {/* Divider */}
                  <div className="w-px h-5 shrink-0" style={{ background: "var(--color-border)" }} />
                  {/* Chain */}
                  <div className="flex flex-wrap items-center gap-2 min-h-[28px]">
                    {table[i].length === 0 ? (
                      <span className="text-xs" style={{ color: "var(--color-border)" }}>∅</span>
                    ) : (
                      table[i].map((val, j) => (
                        <div key={j} className="flex items-center gap-1">
                          <span
                            className="px-2 py-0.5 rounded text-xs font-mono font-bold"
                            style={{
                              background:
                                isHighlighted && highlighted?.val === val
                                  ? (highlighted.type === "deleted"
                                    ? "rgba(239,68,68,0.25)"
                                    : "rgba(34,197,94,0.2)")
                                  : "var(--color-surface-3)",
                              color:
                                isHighlighted && highlighted?.val === val
                                  ? highlightColor
                                  : "var(--color-text)",
                              border: `1px solid ${
                                isHighlighted && highlighted?.val === val
                                  ? highlightColor
                                  : "var(--color-border)"
                              }`,
                            }}
                          >
                            {val}
                          </span>
                          {j < table[i].length - 1 && (
                            <span className="text-xs" style={{ color: "var(--color-muted)" }}>→</span>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Controls */}
          <div className="flex flex-wrap gap-2 items-center">
            <input
              type="number"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && insert()}
              placeholder="e.g. 42"
              className="rounded-lg px-3 py-2 text-sm w-28 outline-none"
              style={{
                background: "var(--color-surface-2)",
                border: "1px solid var(--color-border)",
                color: "var(--color-text)",
              }}
            />
            <DBtn onClick={insert} primary>Insert</DBtn>
            <DBtn onClick={search}>Search</DBtn>
            <DBtn onClick={remove}>Delete</DBtn>
            <DBtn onClick={clear}>Clear</DBtn>
          </div>

          {error && (
            <div
              className="rounded-lg px-4 py-2 text-sm"
              style={{ background: "rgba(239,68,68,0.12)", color: "var(--color-state-swap)" }}
            >
              {error}
            </div>
          )}
        </div>
      </div>

      <PanelModal isOpen={isPanelOpen} onClose={() => setIsPanelOpen(false)} title="Hash Table Info">
        <SidePanel tab={panelTab} setTab={setPanelTab} log={log} />
      </PanelModal>

      <CodeModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        algorithmId="hash-table"
        activeMethod={activeMethod}
      />
    </div>
  );
}

// ── Side panel ────────────────────────────────────────────────────────────────

function SidePanel({
  tab,
  setTab,
  log,
}: {
  tab: "info" | "code";
  setTab: (t: "info" | "code") => void;
  log: string[];
}) {
  return (
    <div>
      <TabBar tabs={["info", "code"]} active={tab} onChange={(t) => setTab(t as "info" | "code")} />
      {tab === "code" ? (
        <CodePanel id="hash-table" />
      ) : (
        <div className="space-y-6">
          <LogBox log={log} />
          <div>
            <SectionLabel>Hash Function</SectionLabel>
            <div
              className="rounded-lg p-3 text-sm font-mono"
              style={{
                background: "var(--color-surface-2)",
                border: "1px solid var(--color-border)",
                color: "var(--color-accent)",
              }}
            >
              h(key) = key % 11
            </div>
          </div>
          <div>
            <SectionLabel>Operations</SectionLabel>
            <OpsTable
              ops={[
                { op: "insert(x)", desc: "Add key to chain", time: "O(1) avg" },
                { op: "search(x)", desc: "Find key in chain", time: "O(1) avg" },
                { op: "delete(x)", desc: "Remove key", time: "O(1) avg" },
              ]}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Shared primitives ─────────────────────────────────────────────────────────

function TabBar({
  tabs,
  active,
  onChange,
}: {
  tabs: string[];
  active: string;
  onChange: (t: string) => void;
}) {
  return (
    <div className="flex gap-1 mb-5 p-1 rounded-lg" style={{ background: "var(--color-surface-3)" }}>
      {tabs.map((t) => (
        <button
          key={t}
          onClick={() => onChange(t)}
          className="flex-1 py-1.5 rounded-md text-xs font-semibold capitalize transition-colors"
          style={{
            background: active === t ? "var(--color-surface-1)" : "transparent",
            color: active === t ? "var(--color-text)" : "var(--color-muted)",
            border: "none",
            cursor: "pointer",
          }}
        >
          {t}
        </button>
      ))}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="text-xs font-semibold uppercase tracking-widest mb-3"
      style={{ color: "var(--color-muted)" }}
    >
      {children}
    </p>
  );
}

function LogBox({ log }: { log: string[] }) {
  return (
    <div>
      <SectionLabel>Operation Log</SectionLabel>
      <div
        className="rounded-lg p-3 text-xs font-mono space-y-1.5 overflow-y-auto"
        style={{
          background: "var(--color-surface-2)",
          border: "1px solid var(--color-border)",
          maxHeight: 180,
          color: "var(--color-muted)",
        }}
      >
        {log.map((entry, i) => (
          <div key={i} style={{ color: i === 0 ? "var(--color-accent)" : undefined }}>
            {i === 0 ? "→ " : "  "}
            {entry}
          </div>
        ))}
      </div>
    </div>
  );
}

function OpsTable({ ops }: { ops: { op: string; desc: string; time: string }[] }) {
  return (
    <div className="space-y-2">
      {ops.map(({ op, desc, time }) => (
        <div
          key={op}
          className="flex items-center justify-between p-2 rounded-lg"
          style={{ background: "var(--color-surface-2)" }}
        >
          <div>
            <div className="text-xs font-mono" style={{ color: "var(--color-accent)" }}>{op}</div>
            <div className="text-xs" style={{ color: "var(--color-muted)" }}>{desc}</div>
          </div>
          <span className="text-xs font-mono" style={{ color: "var(--color-state-sorted)" }}>{time}</span>
        </div>
      ))}
    </div>
  );
}

function Pill({ text, green }: { text: string; green?: boolean }) {
  return (
    <span
      className="text-xs font-mono px-2 py-0.5 rounded-full"
      style={{
        background: green ? "rgba(34,197,94,0.15)" : "rgba(167,139,250,0.12)",
        color: green ? "#22c55e" : "#a78bfa",
      }}
    >
      {text}
    </span>
  );
}

function DStat({
  label,
  value,
  color,
}: {
  label: string;
  value: string | number;
  color?: string;
}) {
  return (
    <div>
      <div className="text-xs mb-0.5" style={{ color: "var(--color-muted)" }}>{label}</div>
      <div className="text-xl font-mono font-bold" style={{ color: color ?? "var(--color-text)" }}>
        {value}
      </div>
    </div>
  );
}

function DBtn({
  children,
  onClick,
  primary,
}: {
  children: React.ReactNode;
  onClick: () => void;
  primary?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-2 rounded-lg text-sm font-medium transition-colors"
      style={{
        background: primary ? "var(--color-accent)" : "var(--color-surface-3)",
        color: primary ? "#fff" : "var(--color-text)",
        border: "1px solid " + (primary ? "var(--color-accent)" : "var(--color-border)"),
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}
