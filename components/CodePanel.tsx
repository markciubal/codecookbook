"use client";

import { useState } from "react";
import { ANNOTATED_CODE, LANGUAGE_META, LANGUAGES } from "@/lib/annotatedCode";
import type { Language } from "@/lib/annotatedCode";

interface Props {
  id: string; // key into ANNOTATED_CODE
}

export default function CodePanel({ id }: Props) {
  const [lang, setLang]     = useState<Language>("typescript");
  const [copied, setCopied] = useState(false);

  const entry = ANNOTATED_CODE[id];
  if (!entry) return null;

  const code  = entry[lang] ?? "";
  const meta  = LANGUAGE_META[lang];
  const lines = code.split("\n");

  const copy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Header row: label + language picker + copy */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p
          className="text-xs font-semibold uppercase tracking-widest"
          style={{ color: "var(--color-muted)" }}
        >
          Reference Implementation
        </p>
        <div className="flex items-center gap-2">
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value as Language)}
            className="text-xs rounded-md px-2 py-1 outline-none"
            style={{
              background: "var(--color-surface-3)",
              border: "1px solid var(--color-border)",
              color: "var(--color-text)",
              cursor: "pointer",
            }}
          >
            {LANGUAGES.map((l) => (
              <option key={l} value={l}>{LANGUAGE_META[l].label}</option>
            ))}
          </select>
          <button
            onClick={copy}
            className="text-xs px-2 py-1 rounded-md transition-colors"
            style={{
              background: "var(--color-surface-3)",
              border: "1px solid var(--color-border)",
              color: copied ? "var(--color-state-sorted)" : "var(--color-muted)",
              cursor: "pointer",
            }}
          >
            {copied ? "✓ Copied" : "Copy"}
          </button>
        </div>
      </div>

      <div
        className="rounded-xl overflow-hidden"
        style={{
          background: "var(--color-surface-2)",
          border: "1px solid var(--color-border)",
          fontSize: 12,
          fontFamily: "var(--font-mono, monospace)",
        }}
      >
        {/* Top bar: language + run command + line count */}
        <div
          className="px-4 py-2 flex items-center justify-between gap-4 flex-wrap"
          style={{
            background: "var(--color-surface-3)",
            borderBottom: "1px solid var(--color-border)",
          }}
        >
          <span className="text-xs font-mono" style={{ color: "var(--color-accent)" }}>
            {meta.label}
          </span>
          <span className="text-xs font-mono truncate" style={{ color: "var(--color-muted)", maxWidth: 200 }}>
            $ {meta.runCmd}
          </span>
          <span className="text-xs" style={{ color: "var(--color-muted)" }}>
            {lines.length} lines
          </span>
        </div>

        {/* Code with line numbers */}
        <div className="overflow-x-auto overflow-y-auto" style={{ maxHeight: 440 }}>
          <table style={{ borderCollapse: "collapse", width: "100%", minWidth: "max-content" }}>
            <tbody>
              {lines.map((line, i) => {
                const trimmed   = line.trimStart();
                const isComment = trimmed.startsWith(meta.commentChar) ||
                                  trimmed.startsWith("/*") ||
                                  trimmed.startsWith("*") ||
                                  trimmed.startsWith("#");
                const isBlank   = line.trim() === "";
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
                      ((e.currentTarget as HTMLElement).style.background = "var(--color-surface-3)")
                    }
                    onMouseLeave={(e) =>
                      ((e.currentTarget as HTMLElement).style.background = "transparent")
                    }
                  >
                    <td
                      className="select-none pr-4 pl-4 text-right"
                      style={{
                        color: "var(--color-border)",
                        userSelect: "none",
                        paddingTop: 2,
                        paddingBottom: 2,
                        minWidth: 36,
                      }}
                    >
                      {i + 1}
                    </td>
                    <td
                      className="pr-6 pl-2"
                      style={{
                        color: lineColor,
                        whiteSpace: "pre",
                        paddingTop: 2,
                        paddingBottom: 2,
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
