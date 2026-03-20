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
} from "lucide-react";

const NAV_ITEMS = [
  {
    group: "Sorting Algorithms",
    icon: <BarChart2 size={14} />,
    items: [
      { name: "Bubble Sort",    path: "/sorting/bubble",    badge: "O(n²)",       stable: true,  online: false },
      { name: "Selection Sort", path: "/sorting/selection", badge: "O(n²)",       stable: false, online: false },
      { name: "Insertion Sort", path: "/sorting/insertion", badge: "O(n²)",       stable: true,  online: true  },
      { name: "Merge Sort",     path: "/sorting/merge",     badge: "O(n log n)",  stable: true,  online: false },
      { name: "Quick Sort",     path: "/sorting/quick",     badge: "O(n log n)",  stable: false, online: false },
      { name: "Heap Sort",      path: "/sorting/heap",      badge: "O(n log n)",  stable: false, online: false },
      { name: "Shell Sort",     path: "/sorting/shell",     badge: "O(n log² n)", stable: false, online: false },
      { name: "Counting Sort",  path: "/sorting/counting",  badge: "O(n+k)",      stable: true,  online: false },
      { name: "Radix Sort",     path: "/sorting/radix",     badge: "O(nk)",       stable: true,  online: false },
      { name: "Bucket Sort",    path: "/sorting/bucket",    badge: "O(n+k)",      stable: true,  online: false },
      { name: "Tim Sort",       path: "/sorting/timsort",   badge: "O(n log n)",  stable: true,  online: false },
      { name: "Logos Sort",     path: "/sorting/logos",     badge: "O(n log n)",  stable: false, online: false },
      { name: "Benchmark",      path: "/sorting/benchmark", badge: "race" },
    ],
  },
  {
    group: "Data Structures",
    icon: <Layers size={14} />,
    items: [
      { name: "Stack",       path: "/ds/stack",       badge: "LIFO" },
      { name: "Queue",       path: "/ds/queue",       badge: "FIFO" },
      { name: "Deque",       path: "/ds/deque",       badge: "O(1)" },
      { name: "Linked List", path: "/ds/linked-list", badge: "O(n)" },
      { name: "Binary Heap", path: "/ds/binary-heap", badge: "O(log n)" },
      { name: "Hash Table",  path: "/ds/hash-table",  badge: "O(1) avg" },
      { name: "BST",         path: "/ds/bst",         badge: "O(log n)" },
      { name: "Graph",       path: "/ds/graph",       badge: "O(V+E)" },
    ],
  },
] as const;

type SortItem = typeof NAV_ITEMS[0]["items"][number] & { stable?: boolean; online?: boolean };

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
          {group.items.map((item) => {
            const active = pathname === item.path;
            const si = item as SortItem;
            const hasMeta = "stable" in si;
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
                {/* Row 1: name + complexity badge */}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm truncate">{item.name}</span>
                  <span
                    className="text-[10px] font-mono px-1.5 py-0.5 rounded shrink-0"
                    style={{
                      background: "var(--color-surface-3)",
                      color: "var(--color-muted)",
                    }}
                  >
                    {item.badge}
                  </span>
                </div>

                {/* Row 2: stable / online badges (sorting only) */}
                {hasMeta && (
                  <div className="flex gap-1 mt-1">
                    <span
                      className="text-[9px] px-1.5 py-px rounded leading-tight"
                      style={{
                        background: si.stable ? "rgba(78,124,82,0.15)" : "rgba(176,48,32,0.10)",
                        color: si.stable ? "#4e7c52" : "#b03020",
                      }}
                    >
                      {si.stable ? "stable" : "unstable"}
                    </span>
                    {si.online && (
                      <span
                        className="text-[9px] px-1.5 py-px rounded leading-tight"
                        style={{ background: "rgba(42,128,128,0.15)", color: "#2a8080" }}
                      >
                        online
                      </span>
                    )}
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      ))}
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

export default function Navigation() {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const close = () => setDrawerOpen(false);

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
          <NavItems pathname={pathname} />
        </nav>

        <div className="px-4 pb-4 pt-3" style={{ borderTop: "1px solid var(--color-border)" }}>
          <DonateLink />
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
              <NavItems pathname={pathname} onClick={close} />
            </nav>

            {/* Donate */}
            <div className="px-4 py-4" style={{ borderTop: "1px solid var(--color-border)" }}>
              <DonateLink onClick={close} />
            </div>
          </div>
        </>
      )}
    </>
  );
}
