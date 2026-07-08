"use client";

import { useEffect, useState } from "react";
import BenchmarkVisualizer from "./BenchmarkVisualizer";

/** Defer benchmark UI until after mount so SSR HTML never includes form/button nodes extensions mutate. */
export default function BenchmarkClientShell() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <div className="p-6 text-sm" style={{ color: "var(--color-muted)" }}>
        Loading benchmark…
      </div>
    );
  }

  return <BenchmarkVisualizer />;
}
