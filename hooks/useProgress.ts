"use client";

import { useState, useEffect, useCallback } from "react";

const PROGRESS_KEY = "cc-visited-v1";

function load(): Set<string> {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function save(visited: Set<string>) {
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify([...visited]));
  } catch {}
}

export function useProgress() {
  const [visited, setVisited] = useState<Set<string>>(new Set());

  useEffect(() => {
    setVisited(load());
  }, []);

  const markVisited = useCallback((path: string) => {
    setVisited((prev) => {
      if (prev.has(path)) return prev;
      const next = new Set(prev);
      next.add(path);
      save(next);
      return next;
    });
  }, []);

  return { visited, markVisited };
}
