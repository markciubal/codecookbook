"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { GripVertical } from "lucide-react";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export default function PanelModal(props: Props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted || !props.isOpen) return null;
  return createPortal(<ModalBody {...props} />, document.body);
}

function ModalBody({ onClose, title, children }: Props) {
  const [pos, setPos] = useState({ x: 80, y: 80 });

  useEffect(() => {
    setPos({
      x: Math.max(20, Math.min(window.innerWidth - 380, window.innerWidth - 400)),
      y: 80,
    });
  }, []);

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
      x: Math.max(0, Math.min(window.innerWidth  - 360, e.clientX - dragOffset.current.x)),
      y: Math.max(0, Math.min(window.innerHeight - 80,  e.clientY - dragOffset.current.y)),
    });
  }, []);

  const onPointerUp = useCallback(() => { dragging.current = false; }, []);

  return (
    <div
      style={{
        position: "fixed",
        top: pos.y,
        left: pos.x,
        zIndex: 9998,
        width: 360,
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
      {/* Drag handle header */}
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
          <GripVertical size={14} strokeWidth={1.5} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} />{title}
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

      {/* Content */}
      <div style={{ overflowY: "auto", flex: 1, padding: "16px" }}>
        {children}
      </div>
    </div>
  );
}
