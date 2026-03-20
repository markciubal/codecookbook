"use client";

import { useState } from "react";
import { ExternalLink } from "lucide-react";
import { stableToken, onlineToken } from "@/lib/badge-tokens";

interface Props {
  kind: "stable" | "online";
  value: boolean;
  trueLabel: string;
  falseLabel: string;
  title: string;
  description: string;
  learnMoreUrl: string;
}

export default function InfoBadge({
  kind,
  value,
  trueLabel,
  falseLabel,
  title,
  description,
  learnMoreUrl,
}: Props) {
  const [open, setOpen] = useState(false);

  const token = kind === "stable" ? stableToken(value) : onlineToken(value);
  const Icon = token.icon;

  return (
    <span
      style={{ position: "relative", display: "inline-flex" }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {/* Badge */}
      <span
        className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full cursor-default select-none"
        style={{ background: token.bg, color: token.color }}
        tabIndex={0}
        aria-describedby={open ? "infobadge-popover" : undefined}
      >
        <Icon size={11} strokeWidth={2} />
        {value ? trueLabel : falseLabel}
      </span>

      {/* Popover */}
      {open && (
        <span
          id="infobadge-popover"
          role="tooltip"
          style={{
            position: "absolute",
            bottom: "calc(100% + 8px)",
            right: 0,
            zIndex: 50,
            width: 240,
            padding: "10px 12px",
            borderRadius: 10,
            background: "var(--color-surface-3)",
            border: "1px solid var(--color-border)",
            boxShadow: "0 8px 24px rgba(0,0,0,0.45)",
            pointerEvents: "none",
          }}
        >
          <span style={{ display: "block", fontSize: 12, fontWeight: 600, color: token.color, marginBottom: 4 }}>
            {title}
          </span>
          <span style={{ display: "block", fontSize: 11, lineHeight: 1.5, color: "var(--color-muted)", marginBottom: 8 }}>
            {description}
          </span>
          <a
            href={learnMoreUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              pointerEvents: "auto",
              display: "inline-flex",
              alignItems: "center",
              gap: 3,
              fontSize: 11,
              color: "var(--color-accent)",
              textDecoration: "none",
            }}
          >
            Learn more <ExternalLink size={9} strokeWidth={2} />
          </a>
        </span>
      )}
    </span>
  );
}
