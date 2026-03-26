"use client";

import { LEVELS, LEVEL_LABELS, LEVEL_DESCRIPTIONS, Level } from "@/lib/level";
import { useLevel } from "@/hooks/useLevel";
import { useState, useRef } from "react";
import { ChevronDown, FlaskConical, Microscope, Zap, BookOpen } from "lucide-react";

const ICONS: Record<Level, React.ReactNode> = {
  basic:        <BookOpen    size={12} strokeWidth={1.75} />,
  intermediate: <Zap         size={12} strokeWidth={1.75} />,
  advanced:     <FlaskConical size={12} strokeWidth={1.75} />,
  research:     <Microscope  size={12} strokeWidth={1.75} />,
};

const LEVEL_COLORS: Record<Level, string> = {
  basic:        "#6b7280",
  intermediate: "var(--color-accent)",
  advanced:     "#8b5cf6",
  research:     "#ef4444",
};

export default function LevelSelector() {
  const { level, setLevel } = useLevel();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const color = LEVEL_COLORS[level];

  return (
    <div ref={ref} className="relative w-full" style={{ fontFamily: "var(--font-sans)" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
        style={{
          background: "var(--color-surface-2)",
          border: `1px solid ${color}`,
          borderLeft: `3px solid ${color}`,
          color: "var(--color-text)",
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span style={{ color, flexShrink: 0 }}>{ICONS[level]}</span>
        <span className="flex-1 text-left text-xs font-semibold">{LEVEL_LABELS[level]}</span>
        <ChevronDown
          size={12}
          strokeWidth={2}
          style={{
            color: "var(--color-muted)",
            transform: open ? "rotate(180deg)" : "none",
            transition: "transform 0.15s",
            flexShrink: 0,
          }}
        />
      </button>

      {open && (
        <>
          {/* backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="absolute left-0 right-0 z-50 rounded-xl overflow-hidden shadow-xl"
            style={{
              top: "calc(100% + 6px)",
              background: "var(--color-surface-1)",
              border: "1px solid var(--color-border)",
            }}
            role="listbox"
          >
            {LEVELS.map((l) => {
              const c = LEVEL_COLORS[l];
              const active = l === level;
              return (
                <button
                  key={l}
                  role="option"
                  aria-selected={active}
                  onClick={() => { setLevel(l); setOpen(false); }}
                  className="w-full flex items-start gap-2.5 px-3 py-2.5 text-left transition-colors hover:brightness-110"
                  style={{
                    background: active ? `color-mix(in srgb, ${c} 12%, var(--color-surface-1))` : "transparent",
                    borderLeft: `3px solid ${active ? c : "transparent"}`,
                  }}
                >
                  <span style={{ color: c, marginTop: 2, flexShrink: 0 }}>{ICONS[l]}</span>
                  <div>
                    <div className="text-xs font-semibold" style={{ color: active ? c : "var(--color-text)" }}>
                      {LEVEL_LABELS[l]}
                    </div>
                    <div className="text-[10px] leading-tight mt-0.5" style={{ color: "var(--color-muted)" }}>
                      {LEVEL_DESCRIPTIONS[l]}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
