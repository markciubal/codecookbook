import type React from "react";

export function chartBtn(
  variant: "primary" | "secondary" | "danger" | "ghost",
  extra?: React.CSSProperties,
): React.CSSProperties {
  const base: React.CSSProperties = {
    display: "inline-flex", alignItems: "center", gap: 4,
    padding: "3px 8px", fontSize: 11, fontFamily: "monospace", fontWeight: 500,
    borderRadius: 5, cursor: "pointer", border: "none", userSelect: "none",
    lineHeight: 1.4,
  };
  const variants: Record<string, React.CSSProperties> = {
    primary:   { background: "var(--color-accent)", color: "#fff" },
    danger:    { background: "var(--color-state-swap)", color: "#fff" },
    secondary: { background: "var(--color-surface-1)", border: "1px solid var(--color-border)", color: "var(--color-muted)" },
    ghost:     { background: "none", color: "var(--color-muted)" },
  };
  return { ...base, ...variants[variant], ...extra };
}

/** Quadratic sorts — shaded as slow zone on time charts above SLOW_THRESHOLD. */
export const CHART_SLOW_IDS = new Set([
  "insertion", "selection", "bubble", "cocktail", "comb", "gnome", "pancake", "cycle", "oddeven",
]);
export const CHART_SLOW_THRESHOLD = 5_000;
