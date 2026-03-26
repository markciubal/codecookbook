"use client";

import { useEffect } from "react";

export interface ShortcutGroup {
  group: string;
  items: { key: string; description: string }[];
}

interface KeyboardShortcutOverlayProps {
  shortcuts: ShortcutGroup[];
  isOpen: boolean;
  onClose: () => void;
}

export default function KeyboardShortcutOverlay({
  shortcuts,
  isOpen,
  onClose,
}: KeyboardShortcutOverlayProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "?") {
        onClose();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(0,0,0,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backdropFilter: "blur(2px)",
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 480,
          background: "var(--color-surface-1)",
          border: "1px solid var(--color-border)",
          borderRadius: 14,
          padding: "28px 32px",
          boxShadow: "0 24px 64px rgba(0,0,0,0.45)",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 24,
          }}
        >
          <h2
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: "var(--color-text)",
              margin: 0,
              letterSpacing: "-0.01em",
            }}
          >
            Keyboard Shortcuts
          </h2>
          <button
            onClick={onClose}
            style={{
              background: "var(--color-surface-3)",
              border: "1px solid var(--color-border)",
              borderRadius: 6,
              color: "var(--color-muted)",
              cursor: "pointer",
              fontSize: 12,
              lineHeight: 1,
              padding: "3px 8px",
            }}
          >
            esc
          </button>
        </div>

        {/* Groups */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {shortcuts.map((group) => (
            <div key={group.group}>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.1em",
                  color: "var(--color-muted)",
                  textTransform: "uppercase",
                  marginBottom: 10,
                }}
              >
                {group.group}
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <tbody>
                  {group.items.map((item) => (
                    <tr key={item.key}>
                      <td
                        style={{
                          paddingBottom: 8,
                          paddingRight: 16,
                          width: 140,
                          verticalAlign: "middle",
                        }}
                      >
                        <span
                          style={{
                            fontFamily: "monospace",
                            fontSize: 12,
                            color: "var(--color-accent)",
                            background: "rgba(124,106,247,0.1)",
                            border: "1px solid rgba(124,106,247,0.25)",
                            borderRadius: 5,
                            padding: "2px 8px",
                            display: "inline-block",
                          }}
                        >
                          {item.key}
                        </span>
                      </td>
                      <td
                        style={{
                          paddingBottom: 8,
                          fontSize: 13,
                          color: "var(--color-text)",
                          verticalAlign: "middle",
                        }}
                      >
                        {item.description}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
