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
} from "lucide-react";
import { BENCHMARK, SORTING_ALGORITHMS, DATA_STRUCTURES } from "@/lib/catalog";
import AlgoBadge from "@/components/AlgoBadge";

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
];

type NavItem = { name: string; path: string; badge: string; time?: string; space?: string; stable?: boolean; online?: boolean };

function NavItems({
  pathname,
  onClick,
}: {
  pathname: string;
  onClick?: () => void;
}) {
  const benchmarkActive = pathname === BENCHMARK.path;
  return (
    <>
      {/* Standalone Benchmark link */}
      <div className="mb-4">
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
      </div>

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
          {group.items.map((item: NavItem) => {
            const active = pathname === item.path;
            const hasMeta = "stable" in item;
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
                {/* Row 1: name + badge (non-sorting items only) */}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm truncate">{item.name}</span>
                  {!hasMeta && (
                    <span
                      className="text-[10px] font-mono px-1.5 py-0.5 rounded shrink-0"
                      style={{ background: "var(--color-surface-3)", color: "var(--color-muted)" }}
                    >
                      {item.badge}
                    </span>
                  )}
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
