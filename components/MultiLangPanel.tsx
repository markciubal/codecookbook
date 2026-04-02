"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

export type LangCode = {
  language: "python" | "cpp" | "java" | "javascript";
  code: string;
};

type Props = {
  algorithm: string;
  implementations: LangCode[];
};

// ─── Language display metadata ────────────────────────────────────────────────

const LANG_META: Record<
  LangCode["language"],
  { label: string; commentChar: string }
> = {
  python:     { label: "Python",     commentChar: "#" },
  cpp:        { label: "C++",        commentChar: "//" },
  java:       { label: "Java",       commentChar: "//" },
  javascript: { label: "JavaScript", commentChar: "//" },
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function MultiLangPanel({ algorithm, implementations }: Props) {
  const [activeIdx, setActiveIdx] = useState(0);
  const [copied, setCopied]       = useState(false);

  if (!implementations || implementations.length === 0) return null;

  const active = implementations[activeIdx];
  const meta   = LANG_META[active.language];
  const lines  = active.code.split("\n");

  function copy() {
    navigator.clipboard.writeText(active.code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {/* Tab bar */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: 0,
          borderBottom: "1px solid var(--color-border)",
          paddingLeft: 4,
        }}
      >
        {implementations.map((impl, i) => {
          const isActive = i === activeIdx;
          const lm = LANG_META[impl.language];
          return (
            <button
              key={impl.language}
              onClick={() => setActiveIdx(i)}
              style={{
                padding: "8px 16px",
                fontSize: 12,
                fontWeight: isActive ? 700 : 400,
                border: "none",
                borderBottom: isActive
                  ? "2px solid var(--color-accent)"
                  : "2px solid transparent",
                background: "transparent",
                color: isActive ? "var(--color-accent)" : "var(--color-muted)",
                cursor: "pointer",
                transition: "color 0.15s, border-color 0.15s",
                letterSpacing: "0.01em",
                marginBottom: -1,
              }}
            >
              {lm.label}
            </button>
          );
        })}
      </div>

      {/* Code area */}
      <div
        style={{
          position: "relative",
          borderRadius: "0 0 10px 10px",
          border: "1px solid var(--color-border)",
          borderTop: "none",
          background: "var(--color-surface-3)",
          overflow: "hidden",
        }}
      >
        {/* Top bar: language label + algo name + copy button */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "6px 12px",
            borderBottom: "1px solid var(--color-border)",
            background: "var(--color-surface-2)",
          }}
        >
          <span
            style={{
              fontSize: 11,
              fontFamily: "var(--font-mono)",
              color: "var(--color-accent)",
              fontWeight: 600,
            }}
          >
            {meta.label}
            {algorithm && (
              <span style={{ color: "var(--color-muted)", fontWeight: 400 }}>
                {" "}
                · {algorithm}
              </span>
            )}
          </span>
          <span style={{ fontSize: 11, color: "var(--color-muted)" }}>
            {lines.length} lines
          </span>
        </div>

        {/* Copy button — absolute top right of code scroll area */}
        <button
          onClick={copy}
          title="Copy code"
          style={{
            position: "absolute",
            top: 42,
            right: 10,
            padding: "4px 10px",
            borderRadius: 6,
            fontSize: 11,
            fontWeight: 600,
            border: "1px solid var(--color-border)",
            background: "var(--color-surface-2)",
            color: copied ? "var(--color-state-sorted)" : "var(--color-muted)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 4,
            zIndex: 10,
            transition: "color 0.2s ease",
          }}
        >
          {copied ? <Check size={11} /> : <Copy size={11} />}
          {copied ? "Copied!" : "Copy"}
        </button>

        {/* Code with line numbers */}
        <div
          style={{
            overflowX: "auto",
            overflowY: "auto",
            maxHeight: 460,
            paddingBottom: 4,
          }}
        >
          <table
            style={{
              borderCollapse: "collapse",
              width: "100%",
              minWidth: "max-content",
              fontFamily: "var(--font-mono)",
              fontSize: 12,
            }}
          >
            <tbody>
              {lines.map((line, i) => {
                const trimmed = line.trimStart();
                const isComment =
                  trimmed.startsWith(meta.commentChar) ||
                  trimmed.startsWith("/*") ||
                  trimmed.startsWith("*") ||
                  trimmed.startsWith("#");
                const isBlank = line.trim() === "";
                const lineColor = isComment
                  ? "var(--color-muted)"
                  : isBlank
                  ? "transparent"
                  : "var(--color-text)";

                return (
                  <tr
                    key={i}
                    style={{ verticalAlign: "top" }}
                    onMouseEnter={(e) =>
                      ((e.currentTarget as HTMLElement).style.background =
                        "rgba(0,0,0,0.04)")
                    }
                    onMouseLeave={(e) =>
                      ((e.currentTarget as HTMLElement).style.background =
                        "transparent")
                    }
                  >
                    {/* Line number */}
                    <td
                      style={{
                        paddingLeft: 16,
                        paddingRight: 12,
                        paddingTop: 2,
                        paddingBottom: 2,
                        color: "var(--color-border)",
                        textAlign: "right",
                        userSelect: "none",
                        minWidth: 36,
                        fontSize: 11,
                      }}
                    >
                      {i + 1}
                    </td>
                    {/* Code line */}
                    <td
                      style={{
                        paddingRight: 48,
                        paddingLeft: 8,
                        paddingTop: 2,
                        paddingBottom: 2,
                        color: lineColor,
                        whiteSpace: "pre",
                        fontStyle: isComment ? "italic" : "normal",
                      }}
                    >
                      {line || "\u00A0"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
