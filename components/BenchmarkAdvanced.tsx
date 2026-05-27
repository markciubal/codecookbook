"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import type React from "react";

/*
 * Presentational primitives for the benchmark's Advanced panel. They hold no
 * benchmark state — the parent owns it and passes values/handlers — they just
 * give the panel consistent, grouped structure instead of one long flat list.
 */

/* A collapsible top-level group ("Input data", "Measurement", "Stress"). */
export function AdvGroup({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--color-border)" }}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-1.5 px-3 py-2"
        style={{ background: "var(--color-surface-1)", border: "none", cursor: "pointer" }}
      >
        <ChevronRight size={12} style={{ color: "var(--color-muted)", transform: open ? "rotate(90deg)" : "none", transition: "transform 0.15s ease" }} />
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-text)" }}>{title}</span>
      </button>
      {open && <div className="px-3 py-3 flex flex-col gap-4" style={{ borderTop: "1px solid var(--color-border)" }}>{children}</div>}
    </div>
  );
}

/* A labeled sub-section within a group. */
export function AdvSection({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--color-muted)" }}>
        {title}
        {hint && <span className="font-normal normal-case" style={{ color: "var(--color-muted)" }}> — {hint}</span>}
      </p>
      {children}
    </div>
  );
}

/* A checkbox toggle with a bold label and a description paragraph. Used for the
 * worker-isolation, timeout, duplicate-input, and integer-flag style options. */
export function AdvToggle({
  checked,
  onChange,
  label,
  children,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  children?: React.ReactNode;   // description / extra controls
  disabled?: boolean;
}) {
  return (
    <label className="flex items-start gap-2" style={{ cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1 }}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={e => onChange(e.target.checked)}
        style={{ marginTop: 2, accentColor: "var(--color-accent)" }}
      />
      <div style={{ flex: 1 }}>
        <span className="text-xs font-semibold" style={{ color: "var(--color-text)" }}>{label}</span>
        {children && <div className="text-xs mt-0.5" style={{ color: "var(--color-muted)" }}>{children}</div>}
      </div>
    </label>
  );
}
