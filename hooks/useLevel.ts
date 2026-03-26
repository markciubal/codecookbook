"use client";

import { useState, useEffect, useCallback } from "react";
import { Level, LEVEL_KEY, DEFAULT_LEVEL, LEVELS, meetsLevel } from "@/lib/level";

const LEVEL_CHANGE_EVENT = "cc-level-change";

export function useLevel() {
  const [level, setLevelState] = useState<Level>(() => {
    if (typeof window === "undefined") return DEFAULT_LEVEL;
    try {
      const stored = localStorage.getItem(LEVEL_KEY) as Level | null;
      if (stored && LEVELS.includes(stored)) return stored;
    } catch {}
    return DEFAULT_LEVEL;
  });

  // Keep in sync when another component calls setLevel
  useEffect(() => {
    const handler = (e: Event) => {
      const next = (e as CustomEvent<Level>).detail;
      if (LEVELS.includes(next)) setLevelState(next);
    };
    window.addEventListener(LEVEL_CHANGE_EVENT, handler);
    return () => window.removeEventListener(LEVEL_CHANGE_EVENT, handler);
  }, []);

  const setLevel = useCallback((next: Level) => {
    setLevelState(next);
    try { localStorage.setItem(LEVEL_KEY, next); } catch {}
    window.dispatchEvent(new CustomEvent(LEVEL_CHANGE_EVENT, { detail: next }));
  }, []);

  const has = useCallback((required: Level) => meetsLevel(level, required), [level]);

  return { level, setLevel, has };
}
