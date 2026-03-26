"use client";

import { useState, useMemo } from "react";
import { ArrowUp, ArrowDown, Printer } from "lucide-react";
import { SORTING_ALGORITHMS, DATA_STRUCTURES, SortingEntry, DSEntry } from "@/lib/catalog";
import Link from "next/link";

// Complexity rank for sorting purposes
const COMPLEXITY_RANK: Record<string, number> = {
  "O(1)": 1,
  "O(log n)": 2,
  "O(m)": 3,
  "O(n)": 4,
  "O(n log n)": 5,
  "O(n log² n)": 6,
  "O(n+k)": 7,
  "O(nk)": 8,
  "O(n+k) avg": 8,
  "O(n²)": 9,
  "O(2ⁿ)": 10,
  // partial matches handled below
};

function complexityRank(s: string): number {
  if (COMPLEXITY_RANK[s] !== undefined) return COMPLEXITY_RANK[s];
  // Handle things like "O(1) avg" or "O(n·m)"
  if (s.includes("O(1)")) return 1;
  if (s.includes("O(log n)")) return 2;
  if (s.includes("O(m)")) return 3;
  if (s.includes("O(n log n)")) return 5;
  if (s.includes("O(n+k)")) return 7;
  if (s.includes("O(nk)")) return 8;
  if (s.includes("O(n²)")) return 9;
  if (s.includes("O(n)")) return 4;
  return 99;
}

type SortCol = "name" | "time" | "space" | "stable" | "online";
type SortDir = "asc" | "desc";

export default function CheatSheetTable() {
  const [query, setQuery] = useState("");
  const [stableOnly, setStableOnly] = useState(false);
  const [onlineOnly, setOnlineOnly] = useState(false);
  const [sortCol, setSortCol] = useState<SortCol>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const [dsSortCol, setDsSortCol] = useState<"name" | "time" | "space">("name");
  const [dsSortDir, setDsSortDir] = useState<SortDir>("asc");

  function handleSortColClick(col: SortCol) {
    if (sortCol === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(col);
      setSortDir("asc");
    }
  }

  function handleDsSortColClick(col: "name" | "time" | "space") {
    if (dsSortCol === col) {
      setDsSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setDsSortCol(col);
      setDsSortDir("asc");
    }
  }

  const filteredAlgos = useMemo(() => {
    let list = [...SORTING_ALGORITHMS];
    if (query) list = list.filter((a) => a.name.toLowerCase().includes(query.toLowerCase()));
    if (stableOnly) list = list.filter((a) => a.stable);
    if (onlineOnly) list = list.filter((a) => a.online);

    list.sort((a, b) => {
      let cmp = 0;
      switch (sortCol) {
        case "name":
          cmp = a.name.localeCompare(b.name);
          break;
        case "time":
          cmp = complexityRank(a.time) - complexityRank(b.time);
          break;
        case "space":
          cmp = complexityRank(a.space) - complexityRank(b.space);
          break;
        case "stable":
          cmp = (a.stable === b.stable ? 0 : a.stable ? -1 : 1);
          break;
        case "online":
          cmp = (a.online === b.online ? 0 : a.online ? -1 : 1);
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [query, stableOnly, onlineOnly, sortCol, sortDir]);

  const filteredDs = useMemo(() => {
    let list = [...DATA_STRUCTURES];
    if (query) list = list.filter((d) => d.name.toLowerCase().includes(query.toLowerCase()));

    list.sort((a, b) => {
      let cmp = 0;
      switch (dsSortCol) {
        case "name":
          cmp = a.name.localeCompare(b.name);
          break;
        case "time":
          cmp = complexityRank(a.time) - complexityRank(b.time);
          break;
        case "space":
          cmp = complexityRank(a.space) - complexityRank(b.space);
          break;
      }
      return dsSortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [query, dsSortCol, dsSortDir]);

  function SortIcon({ col, active, dir }: { col: string; active: boolean; dir: SortDir }) {
    if (!active) return <ArrowUp size={10} style={{ opacity: 0.3, color: "var(--color-muted)" }} />;
    return dir === "asc"
      ? <ArrowUp size={10} style={{ color: "var(--color-accent)" }} />
      : <ArrowDown size={10} style={{ color: "var(--color-accent)" }} />;
  }

  const thStyle = "px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider cursor-pointer select-none whitespace-nowrap";
  const tdStyle = "px-3 py-2 text-xs";

  function BoolBadge({ val }: { val: boolean }) {
    return (
      <span
        className="inline-block px-1.5 py-0.5 rounded text-[10px] font-mono"
        style={{
          background: val ? "var(--color-state-sorted)" : "var(--color-surface-3)",
          color: val ? "#fff" : "var(--color-muted)",
        }}
      >
        {val ? "yes" : "no"}
      </span>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h1 className="text-base font-bold" style={{ color: "var(--color-text)" }}>
          Algorithm & Data Structure Cheat Sheet
        </h1>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium border"
          style={{
            background: "var(--color-surface-2)",
            color: "var(--color-text)",
            borderColor: "var(--color-border)",
          }}
        >
          <Printer size={12} />
          Print
        </button>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 mb-5 p-3 rounded-lg border" style={{ background: "var(--color-surface-1)", borderColor: "var(--color-border)" }}>
        <input
          type="text"
          placeholder="Filter by name…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1 min-w-[160px] px-2.5 py-1.5 rounded border text-xs outline-none"
          style={{
            background: "var(--color-surface-2)",
            borderColor: "var(--color-border)",
            color: "var(--color-text)",
          }}
        />
        <label className="flex items-center gap-1.5 text-xs cursor-pointer" style={{ color: "var(--color-muted)" }}>
          <input
            type="checkbox"
            checked={stableOnly}
            onChange={(e) => setStableOnly(e.target.checked)}
            style={{ accentColor: "var(--color-accent)" }}
          />
          Stable only
        </label>
        <label className="flex items-center gap-1.5 text-xs cursor-pointer" style={{ color: "var(--color-muted)" }}>
          <input
            type="checkbox"
            checked={onlineOnly}
            onChange={(e) => setOnlineOnly(e.target.checked)}
            style={{ accentColor: "var(--color-accent)" }}
          />
          Online only
        </label>
      </div>

      {/* Sorting Algorithms Table */}
      <section className="mb-8">
        <h2 className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--color-muted)" }}>
          Sorting Algorithms
        </h2>
        <div className="w-full overflow-x-auto rounded-lg border" style={{ borderColor: "var(--color-border)" }}>
          <table className="w-full border-collapse">
            <thead>
              <tr style={{ background: "var(--color-surface-2)", borderBottom: "1px solid var(--color-border)" }}>
                {(["name", "time", "space", "stable", "online"] as SortCol[]).map((col) => (
                  <th
                    key={col}
                    className={thStyle}
                    style={{ color: sortCol === col ? "var(--color-accent)" : "var(--color-muted)" }}
                    onClick={() => handleSortColClick(col)}
                  >
                    <span className="inline-flex items-center gap-1">
                      {col === "name" ? "Name" : col === "time" ? "Time" : col === "space" ? "Space" : col === "stable" ? "Stable" : "Online"}
                      <SortIcon col={col} active={sortCol === col} dir={sortDir} />
                    </span>
                  </th>
                ))}
                <th className={thStyle} style={{ color: "var(--color-muted)" }}>Notes</th>
              </tr>
            </thead>
            <tbody>
              {filteredAlgos.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-xs" style={{ color: "var(--color-muted)" }}>
                    No algorithms match the current filter.
                  </td>
                </tr>
              ) : (
                filteredAlgos.map((algo: SortingEntry, i) => (
                  <tr
                    key={algo.path}
                    style={{
                      background: i % 2 === 0 ? "var(--color-surface-1)" : "var(--color-surface-2)",
                      borderBottom: "1px solid var(--color-border)",
                    }}
                  >
                    <td className={tdStyle}>
                      <Link
                        href={algo.path}
                        className="font-medium hover:underline"
                        style={{ color: "var(--color-accent)" }}
                      >
                        {algo.name}
                      </Link>
                    </td>
                    <td className={`${tdStyle} font-mono`} style={{ color: "var(--color-text)" }}>{algo.time}</td>
                    <td className={`${tdStyle} font-mono`} style={{ color: "var(--color-text)" }}>{algo.space}</td>
                    <td className={tdStyle}><BoolBadge val={algo.stable} /></td>
                    <td className={tdStyle}><BoolBadge val={algo.online} /></td>
                    <td className={tdStyle} style={{ color: "var(--color-muted)", maxWidth: 240 }}>{algo.blurb}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Data Structures Table */}
      <section className="mb-8">
        <h2 className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--color-muted)" }}>
          Data Structures
        </h2>
        <div className="w-full overflow-x-auto rounded-lg border" style={{ borderColor: "var(--color-border)" }}>
          <table className="w-full border-collapse">
            <thead>
              <tr style={{ background: "var(--color-surface-2)", borderBottom: "1px solid var(--color-border)" }}>
                {(["name", "time", "space"] as const).map((col) => (
                  <th
                    key={col}
                    className={thStyle}
                    style={{ color: dsSortCol === col ? "var(--color-accent)" : "var(--color-muted)" }}
                    onClick={() => handleDsSortColClick(col)}
                  >
                    <span className="inline-flex items-center gap-1">
                      {col === "name" ? "Name" : col === "time" ? "Time" : "Space"}
                      <SortIcon col={col} active={dsSortCol === col} dir={dsSortDir} />
                    </span>
                  </th>
                ))}
                <th className={thStyle} style={{ color: "var(--color-muted)" }}>Notes</th>
              </tr>
            </thead>
            <tbody>
              {filteredDs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-xs" style={{ color: "var(--color-muted)" }}>
                    No data structures match the current filter.
                  </td>
                </tr>
              ) : (
                filteredDs.map((ds: DSEntry, i) => (
                  <tr
                    key={ds.path}
                    style={{
                      background: i % 2 === 0 ? "var(--color-surface-1)" : "var(--color-surface-2)",
                      borderBottom: "1px solid var(--color-border)",
                    }}
                  >
                    <td className={tdStyle}>
                      <Link
                        href={ds.path}
                        className="font-medium hover:underline"
                        style={{ color: "var(--color-accent)" }}
                      >
                        {ds.name}
                      </Link>
                    </td>
                    <td className={`${tdStyle} font-mono`} style={{ color: "var(--color-text)" }}>{ds.time}</td>
                    <td className={`${tdStyle} font-mono`} style={{ color: "var(--color-text)" }}>{ds.space}</td>
                    <td className={tdStyle} style={{ color: "var(--color-muted)", maxWidth: 300 }}>{ds.blurb}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Footer hint */}
      <footer className="mt-6 pt-4 border-t text-xs text-center" style={{ borderColor: "var(--color-border)", color: "var(--color-muted)" }}>
        Visualizer keyboard shortcuts: <kbd className="px-1 py-0.5 rounded border font-mono" style={{ borderColor: "var(--color-border)", background: "var(--color-surface-2)" }}>Space</kbd> play/pause &nbsp;·&nbsp;
        <kbd className="px-1 py-0.5 rounded border font-mono" style={{ borderColor: "var(--color-border)", background: "var(--color-surface-2)" }}>←</kbd>
        <kbd className="px-1 py-0.5 rounded border font-mono" style={{ borderColor: "var(--color-border)", background: "var(--color-surface-2)" }}>→</kbd> step &nbsp;·&nbsp;
        <kbd className="px-1 py-0.5 rounded border font-mono" style={{ borderColor: "var(--color-border)", background: "var(--color-surface-2)" }}>R</kbd> reset
      </footer>
    </div>
  );
}
