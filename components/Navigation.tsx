"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  BookOpen,
  BarChart2,
  Layers,
  Heart,
  Menu,
  X,
  Zap,
  Upload,
  GitCompare,
  Wrench,
  Search,
  ScanSearch,
  Network,
  BrainCircuit,
  Type,
  Hexagon,
  Calculator,
  GraduationCap,
} from "lucide-react";
import { BENCHMARK, COMPARE, CUSTOM_SORT, LEARNING, SORTING_ALGORITHMS, DATA_STRUCTURES, TOOLS, SEARCHING_ALGORITHMS, GRAPH_ALGORITHMS, DP_ALGORITHMS, STRING_ALGORITHMS, GEOMETRY_ALGORITHMS, MATH_ALGORITHMS } from "@/lib/catalog";
import AlgoBadge from "@/components/AlgoBadge";
import ThemeToggle from "@/components/ThemeToggle";
import LevelSelector from "@/components/LevelSelector";
import { useProgress } from "@/hooks/useProgress";

const NAV_ITEMS = [
  {
    group: "Sorting Algorithms",
    icon: <BarChart2 size={14} />,
    items: [
      ...SORTING_ALGORITHMS.map((a) => ({
        name: a.name,
        path: a.path,
        badge: a.time,
        time: a.time,
        space: a.space,
        stable: a.stable,
        online: a.online,
      })),
    ],
  },
  {
    group: "Data Structures",
    icon: <Layers size={14} />,
    items: DATA_STRUCTURES.map((d) => ({
      name: d.name,
      path: d.path,
      badge: d.time,
    })),
  },
  {
    group: "Searching",
    icon: <ScanSearch size={14} />,
    items: SEARCHING_ALGORITHMS.map((s) => ({
      name: s.name,
      path: s.path,
      badge: s.time,
    })),
  },
  {
    group: "Graph Algorithms",
    icon: <Network size={14} />,
    items: GRAPH_ALGORITHMS.map((g) => ({
      name: g.name,
      path: g.path,
      badge: g.time,
    })),
  },
  {
    group: "Dynamic Programming",
    icon: <BrainCircuit size={14} />,
    items: DP_ALGORITHMS.map((d) => ({
      name: d.name,
      path: d.path,
      badge: d.time,
    })),
  },
  {
    group: "Strings",
    icon: <Type size={14} />,
    items: STRING_ALGORITHMS.map((s) => ({
      name: s.name,
      path: s.path,
      badge: s.time,
    })),
  },
  {
    group: "Geometry",
    icon: <Hexagon size={14} />,
    items: GEOMETRY_ALGORITHMS.map((g) => ({
      name: g.name,
      path: g.path,
      badge: g.time,
    })),
  },
  {
    group: "Math",
    icon: <Calculator size={14} />,
    items: MATH_ALGORITHMS.map((m) => ({
      name: m.name,
      path: m.path,
      badge: m.time,
    })),
  },
  {
    group: "Tools",
    icon: <Wrench size={14} />,
    items: TOOLS.map((t) => ({
      name: t.name,
      path: t.path,
      badge: "",
    })),
  },
];

type NavItem = { name: string; path: string; badge: string; time?: string; space?: string; stable?: boolean; online?: boolean };

function fuzzyMatch(name: string, query: string): boolean {
  if (!query) return true;
  const n = name.toLowerCase();
  const q = query.toLowerCase();
  if (n.includes(q)) return true;
  // character-order match
  let qi = 0;
  for (let i = 0; i < n.length && qi < q.length; i++) {
    if (n[i] === q[qi]) qi++;
  }
  return qi === q.length;
}

function NavItems({
  pathname,
  onClick,
  query,
}: {
  pathname: string;
  onClick?: () => void;
  query?: string;
}) {
  const { visited } = useProgress();
  const benchmarkActive = pathname === BENCHMARK.path;
  return (
    <>
      {/* Standalone utility links */}
      <div className="flex flex-col gap-1 mb-4">
        <Link
          href={BENCHMARK.path}
          onClick={onClick}
          className="flex items-center gap-2 px-3 py-2 rounded-lg transition-colors"
          style={{
            background: benchmarkActive ? "var(--color-accent-muted)" : "var(--color-surface-2)",
            color: benchmarkActive ? "var(--color-accent)" : "var(--color-text)",
            border: `1px solid ${benchmarkActive ? "var(--color-accent)" : "var(--color-border)"}`,
            borderLeft: `3px solid ${benchmarkActive ? "var(--color-accent)" : "var(--color-border)"}`,
            fontWeight: 600,
          }}
        >
          <Zap size={14} style={{ color: "var(--color-accent)", flexShrink: 0 }} strokeWidth={1.75} />
          <span className="text-sm">{BENCHMARK.name}</span>
        </Link>
        <Link
          href={CUSTOM_SORT.path}
          onClick={onClick}
          className="flex items-center gap-2 px-3 py-2 rounded-lg transition-colors"
          style={{
            background: pathname === CUSTOM_SORT.path ? "var(--color-accent-muted)" : "var(--color-surface-2)",
            color: pathname === CUSTOM_SORT.path ? "var(--color-accent)" : "var(--color-text)",
            border: `1px solid ${pathname === CUSTOM_SORT.path ? "var(--color-accent)" : "var(--color-border)"}`,
            borderLeft: `3px solid ${pathname === CUSTOM_SORT.path ? "var(--color-accent)" : "var(--color-border)"}`,
            fontWeight: 600,
          }}
        >
          <Upload size={14} style={{ color: "var(--color-accent)", flexShrink: 0 }} strokeWidth={1.75} />
          <span className="text-sm">{CUSTOM_SORT.name}</span>
        </Link>
        <Link
          href={COMPARE.path}
          onClick={onClick}
          className="flex items-center gap-2 px-3 py-2 rounded-lg transition-colors"
          style={{
            background: pathname === COMPARE.path ? "var(--color-accent-muted)" : "var(--color-surface-2)",
            color: pathname === COMPARE.path ? "var(--color-accent)" : "var(--color-text)",
            border: `1px solid ${pathname === COMPARE.path ? "var(--color-accent)" : "var(--color-border)"}`,
            borderLeft: `3px solid ${pathname === COMPARE.path ? "var(--color-accent)" : "var(--color-border)"}`,
            fontWeight: 600,
          }}
        >
          <GitCompare size={14} style={{ color: "var(--color-accent)", flexShrink: 0 }} strokeWidth={1.75} />
          <span className="text-sm">{COMPARE.name}</span>
        </Link>
        <Link
          href={LEARNING.path}
          onClick={onClick}
          className="flex items-center gap-2 px-3 py-2 rounded-lg transition-colors"
          style={{
            background: pathname.startsWith(LEARNING.path) ? "var(--color-accent-muted)" : "var(--color-surface-2)",
            color: pathname.startsWith(LEARNING.path) ? "var(--color-accent)" : "var(--color-text)",
            border: `1px solid ${pathname.startsWith(LEARNING.path) ? "var(--color-accent)" : "var(--color-border)"}`,
            borderLeft: `3px solid ${pathname.startsWith(LEARNING.path) ? "var(--color-accent)" : "var(--color-border)"}`,
            fontWeight: 600,
          }}
        >
          <GraduationCap size={14} style={{ color: "var(--color-accent)", flexShrink: 0 }} strokeWidth={1.75} />
          <span className="text-sm">{LEARNING.name}</span>
        </Link>
      </div>

      {NAV_ITEMS.map((group) => {
        const filteredItems = group.items.filter((item: NavItem) => fuzzyMatch(item.name, query ?? ""));
        if (filteredItems.length === 0) return null;
        return (
        <div key={group.group} className="mb-5">
          {/* Group heading */}
          <div className="flex items-center gap-2 mb-2 px-3">
            <div style={{ flex: 1, height: 1, background: "var(--color-border)", opacity: 0.6 }} />
            <div className="flex items-center gap-1.5" style={{ color: "var(--color-muted)" }}>
              {group.icon}
              <p className="text-xs font-semibold uppercase tracking-widest">{group.group}</p>
            </div>
            <div style={{ flex: 1, height: 1, background: "var(--color-border)", opacity: 0.6 }} />
          </div>

          {/* Items */}
          {filteredItems.map((item: NavItem) => {
            const active = pathname === item.path;
            const hasMeta = "stable" in item;
            const isVisited = visited.has(item.path);
            return (
              <Link
                key={item.path}
                href={item.path}
                onClick={onClick}
                className="flex flex-col px-3 py-2 rounded-lg mb-0.5 transition-colors"
                style={{
                  background: active ? "var(--color-accent-muted)" : "transparent",
                  color: active ? "var(--color-accent)" : "var(--color-muted)",
                  borderLeft: active ? "2px solid var(--color-accent)" : "2px solid transparent",
                  fontWeight: active ? 600 : 400,
                }}
              >
                {/* Row 1: name + visited dot + badge (non-sorting items only) */}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm truncate">{item.name}</span>
                  <div className="flex items-center gap-1 shrink-0">
                    {isVisited && !active && (
                      <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--color-accent)", opacity: 0.5, display: "inline-block" }} />
                    )}
                    {!hasMeta && item.badge && (
                      <span
                        className="text-[10px] font-mono px-1.5 py-0.5 rounded"
                        style={{ background: "var(--color-surface-3)", color: "var(--color-muted)" }}
                      >
                        {item.badge}
                      </span>
                    )}
                  </div>
                </div>

                {/* Row 2: time · space · stable · online (sorting only) */}
                {hasMeta && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    <AlgoBadge kind="time"   value={item.time!} />
                    <AlgoBadge kind="space"  value={item.space!} />
                    <AlgoBadge kind="stable" value={item.stable!} />
                    <AlgoBadge kind="online" value={item.online!} />
                  </div>
                )}
              </Link>
            );
          })}
        </div>
        );
      })}
    </>
  );
}

function DonateLink({ onClick }: { onClick?: () => void }) {
  return (
    <Link
      href="https://www.paypal.com/donate/?hosted_button_id=Q9JCGNQF924WW"
      target="_blank"
      rel="noopener noreferrer"
      onClick={onClick}
      className="flex items-center justify-center gap-2 w-full px-3 py-2 rounded-lg text-sm font-medium transition-all hover:-translate-y-0.5 hover:brightness-110"
      style={{ background: "goldenrod", border: "1px solid darkgoldenrod", color: "#1a0e00" }}
    >
      <Heart size={14} strokeWidth={2} />
      Donate via PayPal
    </Link>
  );
}

function SearchBox({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative mx-2 mb-3">
      <Search size={12} strokeWidth={1.75} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--color-muted)", pointerEvents: "none" }} />
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="Search…"
        className="w-full text-xs rounded-lg pl-7 pr-7 py-1.5"
        style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)", color: "var(--color-text)", outline: "none" }}
      />
      {value && (
        <button onClick={() => onChange("")} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--color-muted)", padding: 0, lineHeight: 1, fontSize: 14 }}>×</button>
      )}
    </div>
  );
}

export default function Navigation() {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const close = () => { setDrawerOpen(false); setSearchQuery(""); };

  return (
    <>
      {/* ── Desktop sidebar ── */}
      <aside
        className="hidden lg:flex flex-col flex-shrink-0 w-60 h-dvh sticky top-0 overflow-y-auto"
        style={{ background: "var(--color-surface-1)", borderRight: "1px solid var(--color-border)" }}
      >
        <Link href="/" className="flex items-center gap-2.5 px-4 py-5">
          <BookOpen size={22} style={{ color: "var(--color-accent)" }} strokeWidth={1.5} />
          <div>
            <div className="font-bold text-base leading-tight" style={{ color: "var(--color-text)" }}>
              CodeCookbook
            </div>
            <div className="text-xs" style={{ color: "var(--color-muted)" }}>Algorithm Visualizer</div>
          </div>
        </Link>

        <div className="mx-4 mb-4" style={{ height: 1, background: "var(--color-border)" }} />

        <nav className="flex-1 px-2">
          <SearchBox value={searchQuery} onChange={setSearchQuery} />
          <div className="mx-1 mb-3">
            <LevelSelector />
          </div>
          <NavItems pathname={pathname} query={searchQuery} />
        </nav>

        <div className="px-4 pb-4 pt-3" style={{ borderTop: "1px solid var(--color-border)" }}>
          <DonateLink />
          <div className="mt-2">
            <ThemeToggle />
          </div>
          <p className="text-xs text-center mt-3" style={{ color: "var(--color-muted)", lineHeight: 1.7 }}>
            Inspired by{" "}
            <a href="http://devincook.com/csc/130/" target="_blank" rel="noopener noreferrer"
              style={{ color: "var(--color-accent)", textDecoration: "underline" }}>Devin Cook</a>
            {", "}
            <a href="https://visualgo.net" target="_blank" rel="noopener noreferrer"
              style={{ color: "var(--color-accent)", textDecoration: "underline" }}>VisuAlgo</a>
            {" & "}
            <a href="https://www.youtube.com/@TimoBingmann" target="_blank" rel="noopener noreferrer"
              style={{ color: "var(--color-accent)", textDecoration: "underline" }}>Timo Bingmann</a>
          </p>
        </div>
      </aside>

      {/* ── Mobile top bar (in-flow, not fixed — nothing gets covered) ── */}
      <header
        className="lg:hidden flex items-center justify-between px-4 shrink-0"
        style={{
          height: 48,
          background: "var(--color-surface-1)",
          borderBottom: "1px solid var(--color-border)",
        }}
      >
        <Link href="/" className="flex items-center gap-2" onClick={close}>
          <BookOpen size={18} style={{ color: "var(--color-accent)" }} strokeWidth={1.5} />
          <span className="font-bold text-sm" style={{ color: "var(--color-text)" }}>CodeCookbook</span>
        </Link>
        <button
          onClick={() => setDrawerOpen(true)}
          aria-label="Open menu"
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "var(--color-muted)",
            padding: 6,
          }}
        >
          <Menu size={20} strokeWidth={1.75} />
        </button>
      </header>

      {/* ── Mobile drawer overlay ── */}
      {drawerOpen && (
        <>
          {/* Backdrop */}
          <div
            className="lg:hidden fixed inset-0 z-50"
            style={{ background: "rgba(0,0,0,0.45)" }}
            onClick={close}
          />

          {/* Sheet */}
          <div
            className="lg:hidden fixed inset-y-0 left-0 z-50 flex flex-col overflow-y-auto"
            style={{
              width: "min(280px, 85vw)",
              background: "var(--color-surface-1)",
              borderRight: "1px solid var(--color-border)",
            }}
          >
            {/* Sheet header */}
            <div
              className="flex items-center justify-between px-4 shrink-0"
              style={{ height: 48, borderBottom: "1px solid var(--color-border)" }}
            >
              <Link href="/" onClick={close} className="flex items-center gap-2">
                <BookOpen size={18} style={{ color: "var(--color-accent)" }} strokeWidth={1.5} />
                <span className="font-bold text-sm" style={{ color: "var(--color-text)" }}>CodeCookbook</span>
              </Link>
              <button
                onClick={close}
                aria-label="Close menu"
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-muted)", padding: 6 }}
              >
                <X size={18} strokeWidth={1.75} />
              </button>
            </div>

            {/* Nav items */}
            <nav className="flex-1 px-2 py-3">
              <SearchBox value={searchQuery} onChange={setSearchQuery} />
              <div className="mx-1 mb-3">
                <LevelSelector />
              </div>
              <NavItems pathname={pathname} onClick={close} query={searchQuery} />
            </nav>

            {/* Donate + theme */}
            <div className="px-4 py-4 flex flex-col gap-2" style={{ borderTop: "1px solid var(--color-border)" }}>
              <DonateLink onClick={close} />
              <ThemeToggle />
            </div>
          </div>
        </>
      )}
    </>
  );
}
