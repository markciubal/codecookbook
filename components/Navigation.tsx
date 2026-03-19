"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  BookOpen,
  Home,
  BarChart2,
  Database,
  Menu,
  ArrowUpDown,
  Layers,
  Heart,
} from "lucide-react";

const NAV_ITEMS = [
  {
    group: "Sorting Algorithms",
    icon: <BarChart2 size={14} />,
    items: [
      { name: "Bubble Sort",    path: "/sorting/bubble",    badge: "O(n²)" },
      { name: "Selection Sort", path: "/sorting/selection", badge: "O(n²)" },
      { name: "Insertion Sort", path: "/sorting/insertion", badge: "O(n²)" },
      { name: "Merge Sort",     path: "/sorting/merge",     badge: "O(n log n)" },
      { name: "Quick Sort",     path: "/sorting/quick",     badge: "O(n log n)" },
      { name: "Heap Sort",      path: "/sorting/heap",      badge: "O(n log n)" },
      { name: "Shell Sort",     path: "/sorting/shell",     badge: "O(n log² n)" },
      { name: "Counting Sort",  path: "/sorting/counting",  badge: "O(n+k)" },
      { name: "Radix Sort",     path: "/sorting/radix",     badge: "O(nk)" },
      { name: "Bucket Sort",    path: "/sorting/bucket",    badge: "O(n+k)" },
      { name: "Tim Sort",       path: "/sorting/timsort",   badge: "O(n log n)" },
      { name: "Logos Sort",     path: "/sorting/logos",     badge: "O(n log n)" },
      { name: "Benchmark",      path: "/sorting/benchmark", badge: "race" },
    ],
  },
  {
    group: "Data Structures",
    icon: <Layers size={14} />,
    items: [
      { name: "Stack",          path: "/ds/stack",        badge: "LIFO" },
      { name: "Queue",          path: "/ds/queue",        badge: "FIFO" },
      { name: "Deque",          path: "/ds/deque",        badge: "O(1)" },
      { name: "Linked List",    path: "/ds/linked-list",  badge: "O(n)" },
      { name: "Binary Heap",    path: "/ds/binary-heap",  badge: "O(log n)" },
      { name: "Hash Table",     path: "/ds/hash-table",   badge: "O(1) avg" },
      { name: "BST",            path: "/ds/bst",          badge: "O(log n)" },
      { name: "Graph",          path: "/ds/graph",        badge: "O(V+E)" },
    ],
  },
];

function NavItems({
  pathname,
  onClick,
}: {
  pathname: string;
  onClick?: () => void;
}) {
  return (
    <>
      {NAV_ITEMS.map((group) => (
        <div key={group.group} className="mb-5">
          <div className="flex items-center gap-2 mb-2 px-3">
            <div style={{ flex: 1, height: 1, background: "var(--color-border)", opacity: 0.6 }} />
            <div className="flex items-center gap-1.5" style={{ color: "var(--color-muted)" }}>
              {group.icon}
              <p className="text-xs font-semibold uppercase tracking-widest">
                {group.group}
              </p>
            </div>
            <div style={{ flex: 1, height: 1, background: "var(--color-border)", opacity: 0.6 }} />
          </div>
          {group.items.map((item) => {
            const active = pathname === item.path;
            return (
              <Link
                key={item.path}
                href={item.path}
                onClick={onClick}
                className="flex items-center justify-between px-3 py-2 rounded-lg mb-0.5 text-sm transition-colors"
                style={{
                  background: active ? "var(--color-accent-muted)" : "transparent",
                  color: active ? "var(--color-accent)" : "var(--color-muted)",
                  borderLeft: active ? "2px solid var(--color-accent)" : "2px solid transparent",
                  fontWeight: active ? 600 : 400,
                }}
              >
                <span>{item.name}</span>
                <span
                  className="text-xs font-mono px-1.5 py-0.5 rounded"
                  style={{
                    background: "var(--color-surface-3)",
                    color: "var(--color-muted)",
                  }}
                >
                  {item.badge}
                </span>
              </Link>
            );
          })}
        </div>
      ))}
    </>
  );
}

export default function Navigation() {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const sortingActive = pathname.startsWith("/sorting");
  const dsActive = pathname.startsWith("/ds");

  return (
    <>
      {/* ── Desktop sidebar ── */}
      <aside
        className="hidden lg:flex flex-col flex-shrink-0 w-60 h-dvh sticky top-0 overflow-y-auto"
        style={{
          background: "var(--color-surface-1)",
          borderRight: "1px solid var(--color-border)",
        }}
      >
        {/* Brand */}
        <Link href="/" className="flex items-center gap-2.5 px-4 py-5">
          <BookOpen size={22} style={{ color: "var(--color-accent)" }} strokeWidth={1.5} />
          <div>
            <div className="font-bold text-base leading-tight" style={{ color: "var(--color-text)" }}>
              CodeCookbook
            </div>
            <div className="text-xs" style={{ color: "var(--color-muted)" }}>
              Algorithm Visualizer
            </div>
          </div>
        </Link>

        <div className="mx-4 mb-4" style={{ height: 1, background: "var(--color-border)" }} />

        <nav className="flex-1 px-2">
          <NavItems pathname={pathname} />
        </nav>

        <div className="px-4 pb-4 pt-3" style={{ borderTop: "1px solid var(--color-border)" }}>
          <Link
            href="https://www.paypal.com/donate/?hosted_button_id=Q9JCGNQF924WW"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full px-3 py-2 rounded-lg text-sm font-medium transition-all hover:-translate-y-0.5 hover:brightness-110 mb-3"
            style={{
              background: "goldenrod",
              border: "1px solid darkgoldenrod",
              color: "#1a0e00",
            }}
          >
            <Heart size={14} strokeWidth={2} />
            Donate via PayPal
          </Link>
          <p className="text-xs text-center" style={{ color: "var(--color-muted)", lineHeight: 1.7 }}>
            Inspired by{" "}
            <a
              href="http://devincook.com/csc/130/"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "var(--color-accent)", textDecoration: "underline" }}
            >
              Devin Cook
            </a>
            {", "}
            <a
              href="https://visualgo.net"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "var(--color-accent)", textDecoration: "underline" }}
            >
              VisuAlgo
            </a>
            {" & "}
            <a
              href="https://www.youtube.com/@TimoBingmann"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "var(--color-accent)", textDecoration: "underline" }}
            >
              Timo Bingmann
            </a>
          </p>
        </div>
      </aside>

      {/* ── Mobile bottom nav ── */}
      <nav
        className="lg:hidden fixed bottom-0 left-0 right-0 z-50 flex"
        style={{
          background: "var(--color-surface-1)",
          borderTop: "1px solid var(--color-border)",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        <Link
          href="/"
          className="flex-1 flex flex-col items-center gap-1 py-3"
          style={{ color: pathname === "/" ? "var(--color-accent)" : "var(--color-muted)" }}
        >
          <Home size={18} strokeWidth={1.75} />
          <span className="text-xs">Home</span>
        </Link>

        <Link
          href="/sorting/bubble"
          className="flex-1 flex flex-col items-center gap-1 py-3"
          style={{ color: sortingActive ? "var(--color-accent)" : "var(--color-muted)" }}
        >
          <BarChart2 size={18} strokeWidth={1.75} />
          <span className="text-xs">Sorting</span>
        </Link>

        <Link
          href="/ds/stack"
          className="flex-1 flex flex-col items-center gap-1 py-3"
          style={{ color: dsActive ? "var(--color-accent)" : "var(--color-muted)" }}
        >
          <Database size={18} strokeWidth={1.75} />
          <span className="text-xs">Data Str.</span>
        </Link>

        <button
          onClick={() => setDrawerOpen(true)}
          className="flex-1 flex flex-col items-center gap-1 py-3"
          style={{ color: "var(--color-muted)", background: "none", border: "none", cursor: "pointer" }}
        >
          <Menu size={18} strokeWidth={1.75} />
          <span className="text-xs">All</span>
        </button>
      </nav>

      {/* ── Mobile drawer ── */}
      {drawerOpen && (
        <>
          <div
            className="lg:hidden fixed inset-0 z-50"
            style={{ background: "rgba(0,0,0,0.4)" }}
            onClick={() => setDrawerOpen(false)}
          />
          <div
            className="lg:hidden fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl px-4 pt-4 pb-8 overflow-y-auto"
            style={{
              background: "var(--color-surface-1)",
              borderTop: "1px solid var(--color-border)",
              maxHeight: "70dvh",
            }}
          >
            <div className="w-10 h-1 rounded-full mx-auto mb-5" style={{ background: "var(--color-border)" }} />
            <Link
              href="/"
              onClick={() => setDrawerOpen(false)}
              className="flex items-center gap-2 mb-5"
            >
              <BookOpen size={18} style={{ color: "var(--color-accent)" }} strokeWidth={1.5} />
              <span className="font-bold" style={{ color: "var(--color-text)" }}>
                CodeCookbook
              </span>
            </Link>
            <NavItems pathname={pathname} onClick={() => setDrawerOpen(false)} />
            <div className="mt-4 pt-3" style={{ borderTop: "1px solid var(--color-border)" }}>
              <Link
                href="https://www.paypal.com/donate/?hosted_button_id=Q9JCGNQF924WW"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setDrawerOpen(false)}
                className="flex items-center justify-center gap-2 w-full px-3 py-2 rounded-lg text-sm font-medium transition-all hover:brightness-110"
                style={{
                  background: "goldenrod",
                  border: "1px solid darkgoldenrod",
                  color: "#1a0e00",
                }}
              >
                <Heart size={14} strokeWidth={2} />
                Donate via PayPal
              </Link>
            </div>
          </div>
        </>
      )}
    </>
  );
}
