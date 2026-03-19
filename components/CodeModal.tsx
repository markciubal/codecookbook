"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { GripVertical, Mic, MicOff } from "lucide-react";
import { ANNOTATED_CODE, LANGUAGE_META, LANGUAGES } from "@/lib/annotatedCode";
import type { Language } from "@/lib/annotatedCode";
import { getSortHighlightLines, getMethodLineRange } from "@/lib/codeUtils";
import { VOICE_NARRATION } from "@/lib/voiceNarration";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  algorithmId: string;
  /** Pseudocode lines array — when provided, shows a Pseudocode tab */
  pseudocode?: string[];
  /** Current highlighted pseudocode line (-1 or undefined = no highlight) */
  activePseudocodeLine?: number;
  /** DS visualizers: name of the method currently executing */
  activeMethod?: string | null;
}

export default function CodeModal(props: Props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted || !props.isOpen) return null;
  return createPortal(<ModalBody {...props} />, document.body);
}

// ── Modal body ────────────────────────────────────────────────────────────────

function ModalBody({
  onClose,
  algorithmId,
  pseudocode,
  activePseudocodeLine,
  activeMethod,
}: Props) {
  const hasPseudo = Boolean(pseudocode && pseudocode.length > 0);
  const [tab, setTab]        = useState<"pseudocode" | "code">(hasPseudo ? "pseudocode" : "code");
  const [lang, setLang]      = useState<Language>("typescript");
  const [pos, setPos]        = useState({ x: 80, y: 80 });
  const [copied, setCopied]  = useState(false);
  const [voiceOn, setVoiceOn]               = useState(false);
  const [voices, setVoices]                 = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState<string>("");

  // Load browser voices (async on Chrome/Edge)
  useEffect(() => {
    const load = () => {
      const v = window.speechSynthesis.getVoices();
      if (!v.length) return;
      setVoices(v);
      setSelectedVoiceURI((prev) => {
        if (prev) return prev;
        const female = v.find((x) =>
          /female|woman|zira|samantha|victoria|karen|tessa|moira|fiona/i.test(x.name)
        ) ?? v[0];
        return female.voiceURI;
      });
    };
    load();
    window.speechSynthesis.addEventListener("voiceschanged", load);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", load);
  }, []);

  // Center on first mount
  useEffect(() => {
    setPos({
      x: Math.max(20, Math.min(window.innerWidth  - 540, window.innerWidth  / 2 - 260)),
      y: Math.max(20, Math.min(window.innerHeight - 400, 80)),
    });
  }, []);

  // ── Voice narration ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!voiceOn || tab !== "pseudocode") return;
    if (activePseudocodeLine === undefined || activePseudocodeLine < 0) return;
    const narration = VOICE_NARRATION[algorithmId]?.[activePseudocodeLine]
      ?? pseudocode?.[activePseudocodeLine]?.trim();
    if (!narration) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(narration);
    utter.rate = 0.95;
    const voice = voices.find((v) => v.voiceURI === selectedVoiceURI);
    if (voice) utter.voice = voice;
    window.speechSynthesis.speak(utter);
  }, [activePseudocodeLine, voiceOn, tab, pseudocode, voices, selectedVoiceURI]);

  // Cancel speech when voice is turned off or modal unmounts
  useEffect(() => {
    if (!voiceOn) window.speechSynthesis.cancel();
  }, [voiceOn]);
  useEffect(() => () => { window.speechSynthesis.cancel(); }, []);

  // ── Dragging ────────────────────────────────────────────────────────────────
  const dragging   = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragging.current = true;
    dragOffset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
  }, [pos]);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    setPos({
      x: Math.max(0, Math.min(window.innerWidth  - 520, e.clientX - dragOffset.current.x)),
      y: Math.max(0, Math.min(window.innerHeight - 80,  e.clientY - dragOffset.current.y)),
    });
  }, []);

  const onPointerUp = useCallback(() => { dragging.current = false; }, []);

  // ── Code content ─────────────────────────────────────────────────────────────
  const codeEntry = ANNOTATED_CODE[algorithmId];
  const code      = codeEntry?.[lang] ?? "";
  const meta      = LANGUAGE_META[lang];
  const codeLines = code.split("\n");

  // Compute highlight set for code tab
  const highlightedCodeLines: Set<number> = (() => {
    if (tab !== "code") return new Set();
    if (hasPseudo) {
      // Sorting: map pseudocode step → code lines
      return getSortHighlightLines(algorithmId, activePseudocodeLine, code);
    }
    if (activeMethod) {
      // DS: highlight the active method body
      const range = getMethodLineRange(code, activeMethod, lang);
      if (!range) return new Set();
      const s = new Set<number>();
      for (let i = range.start; i <= range.end; i++) s.add(i);
      return s;
    }
    return new Set();
  })();

  // ── Pseudo scroll ─────────────────────────────────────────────────────────────
  const activeLineRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    activeLineRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activePseudocodeLine]);

  // ── Code scroll ───────────────────────────────────────────────────────────────
  const firstHighlightRef = useRef<HTMLTableRowElement>(null);
  useEffect(() => {
    firstHighlightRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [highlightedCodeLines.size, activeMethod]);

  const isFirstHighlight: Set<number> = (() => {
    const first = Math.min(...Array.from(highlightedCodeLines));
    return isFinite(first) ? new Set([first]) : new Set();
  })();

  return (
    <div
      style={{
        position: "fixed",
        top: pos.y,
        left: pos.x,
        zIndex: 9999,
        width: 520,
        maxHeight: "82vh",
        display: "flex",
        flexDirection: "column",
        background: "var(--color-surface-1)",
        border: "1px solid var(--color-border)",
        borderRadius: 12,
        boxShadow: "0 16px 48px rgba(0,0,0,0.55)",
        overflow: "hidden",
      }}
    >
      {/* ── Drag handle header ──────────────────────────────────────────────── */}
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 14px",
          background: "var(--color-surface-3)",
          borderBottom: "1px solid var(--color-border)",
          cursor: dragging.current ? "grabbing" : "grab",
          userSelect: "none",
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 12, fontFamily: "monospace", color: "var(--color-muted)" }}>
          <GripVertical size={14} strokeWidth={1.5} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} />View Code
        </span>
        <button
          onClick={onClose}
          onPointerDown={(e) => e.stopPropagation()}
          style={{
            background: "transparent",
            border: "none",
            color: "var(--color-muted)",
            fontSize: 16,
            cursor: "pointer",
            lineHeight: 1,
            padding: "0 2px",
          }}
          aria-label="Close"
        >
          ×
        </button>
      </div>

      {/* ── Tab bar ─────────────────────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          padding: "8px 12px",
          borderBottom: "1px solid var(--color-border)",
          flexShrink: 0,
          background: "var(--color-surface-2)",
        }}
      >
        {hasPseudo && (
          <TabBtn active={tab === "pseudocode"} onClick={() => setTab("pseudocode")}>
            Pseudocode
          </TabBtn>
        )}
        <TabBtn active={tab === "code"} onClick={() => setTab("code")}>
          Code
        </TabBtn>

        {tab === "pseudocode" && hasPseudo && (
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
            {voices.length > 0 && (
              <select
                value={selectedVoiceURI}
                onChange={(e) => setSelectedVoiceURI(e.target.value)}
                title="Select voice"
                style={{
                  fontSize: 11,
                  padding: "3px 6px",
                  borderRadius: 6,
                  background: "var(--color-surface-3)",
                  border: "1px solid var(--color-border)",
                  color: "var(--color-text)",
                  cursor: "pointer",
                  outline: "none",
                  maxWidth: 140,
                }}
              >
                {voices.map((v) => (
                  <option key={v.voiceURI} value={v.voiceURI}>
                    {v.name}
                  </option>
                ))}
              </select>
            )}
            <button
              onClick={() => setVoiceOn((p) => !p)}
              title={voiceOn ? "Turn voice off" : "Turn voice on"}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                padding: "3px 8px",
                borderRadius: 6,
                fontSize: 11,
                background: voiceOn ? "var(--color-accent-muted)" : "var(--color-surface-3)",
                border: `1px solid ${voiceOn ? "var(--color-accent)" : "var(--color-border)"}`,
                color: voiceOn ? "var(--color-accent)" : "var(--color-muted)",
                cursor: "pointer",
              }}
            >
              {voiceOn ? <Mic size={11} strokeWidth={2} /> : <MicOff size={11} strokeWidth={2} />}
              {voiceOn ? "Voice on" : "Voice off"}
            </button>
          </div>
        )}

        {tab === "code" && (
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
            <select
              value={lang}
              onChange={(e) => { setLang(e.target.value as Language); setCopied(false); }}
              style={{
                fontSize: 11,
                padding: "3px 6px",
                borderRadius: 6,
                background: "var(--color-surface-3)",
                border: "1px solid var(--color-border)",
                color: "var(--color-text)",
                cursor: "pointer",
                outline: "none",
              }}
            >
              {LANGUAGES.map((l) => (
                <option key={l} value={l}>{LANGUAGE_META[l].label}</option>
              ))}
            </select>
            <button
              onClick={() => {
                navigator.clipboard.writeText(code).then(() => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                });
              }}
              style={{
                fontSize: 11,
                padding: "3px 8px",
                borderRadius: 6,
                background: "var(--color-surface-3)",
                border: "1px solid var(--color-border)",
                color: copied ? "var(--color-state-sorted)" : "var(--color-muted)",
                cursor: "pointer",
              }}
            >
              {copied ? "✓ Copied" : "Copy"}
            </button>
          </div>
        )}
      </div>

      {/* ── Content ─────────────────────────────────────────────────────────── */}
      <div style={{ overflow: "hidden", flex: 1, display: "flex", flexDirection: "column" }}>

        {/* Pseudocode tab */}
        {tab === "pseudocode" && pseudocode && (
          <div style={{ overflowY: "auto", flex: 1, padding: "12px 16px" }}>
            <div
              style={{
                fontFamily: "monospace",
                fontSize: 13,
                lineHeight: "1.7",
                padding: "12px",
                borderRadius: 8,
                background: "var(--color-surface-2)",
                border: "1px solid var(--color-border)",
              }}
            >
              {pseudocode.map((line, i) => {
                const isActive = activePseudocodeLine !== undefined && activePseudocodeLine >= 0 && i === activePseudocodeLine;
                return (
                  <div
                    key={i}
                    ref={isActive ? activeLineRef : undefined}
                    style={{
                      padding: "2px 8px",
                      borderRadius: 4,
                      background: isActive ? "var(--color-accent-muted)" : "transparent",
                      color: isActive ? "var(--color-text)" : "var(--color-muted)",
                      borderLeft: isActive ? "2px solid var(--color-accent)" : "2px solid transparent",
                      transition: "background 0.15s, color 0.15s",
                      whiteSpace: "pre",
                    }}
                  >
                    {line}
                  </div>
                );
              })}
            </div>

            <p style={{ fontSize: 11, color: "var(--color-muted)", marginTop: 10, lineHeight: 1.5 }}>
              The highlighted line shows the current operation in the simulation.
              Switch to the <strong style={{ color: "var(--color-accent)" }}>Code</strong> tab to see the full implementation.
            </p>
          </div>
        )}

        {/* Code tab */}
        {tab === "code" && (
          <div style={{ overflowY: "auto", flex: 1 }}>
            {/* Top bar */}
            <div
              style={{
                padding: "6px 14px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
                background: "var(--color-surface-3)",
                borderBottom: "1px solid var(--color-border)",
                fontSize: 11,
                fontFamily: "monospace",
                flexShrink: 0,
              }}
            >
              <span style={{ color: "var(--color-accent)" }}>{meta.label}</span>
              <span style={{ color: "var(--color-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                $ {meta.runCmd}
              </span>
            </div>

            {/* Lines */}
            <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12, fontFamily: "monospace" }}>
              <tbody>
                {codeLines.map((line, i) => {
                  const trimmed    = line.trimStart();
                  const isComment  = trimmed.startsWith(meta.commentChar) || trimmed.startsWith("/*") || trimmed.startsWith("*") || trimmed.startsWith("#");
                  const isBlank    = line.trim() === "";
                  const isHighlighted = highlightedCodeLines.has(i);
                  const isFirst    = isFirstHighlight.has(i);

                  return (
                    <tr
                      key={i}
                      ref={isFirst ? firstHighlightRef : undefined}
                      style={{
                        background: isHighlighted ? "var(--color-accent-muted)" : "transparent",
                        borderLeft: isHighlighted ? "2px solid var(--color-accent)" : "2px solid transparent",
                        verticalAlign: "top",
                      }}
                      onMouseEnter={(e) => {
                        if (!isHighlighted)
                          (e.currentTarget as HTMLElement).style.background = "var(--color-surface-3)";
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.background = isHighlighted
                          ? "var(--color-accent-muted)"
                          : "transparent";
                      }}
                    >
                      <td
                        style={{
                          color: "var(--color-border)",
                          userSelect: "none",
                          paddingTop: 2,
                          paddingBottom: 2,
                          paddingLeft: 10,
                          paddingRight: 12,
                          textAlign: "right",
                          minWidth: 32,
                          fontSize: 11,
                        }}
                      >
                        {i + 1}
                      </td>
                      <td
                        style={{
                          whiteSpace: "pre",
                          paddingTop: 2,
                          paddingBottom: 2,
                          paddingRight: 20,
                          paddingLeft: 4,
                          color: isComment
                            ? "var(--color-muted)"
                            : isBlank
                            ? "transparent"
                            : "var(--color-text)",
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
        )}
      </div>
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "4px 12px",
        borderRadius: 6,
        fontSize: 11,
        fontWeight: 600,
        background: active ? "var(--color-surface-1)" : "transparent",
        color: active ? "var(--color-text)" : "var(--color-muted)",
        border: active ? "1px solid var(--color-border)" : "1px solid transparent",
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}
