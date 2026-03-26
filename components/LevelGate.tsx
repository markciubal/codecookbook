"use client";

import { ReactNode } from "react";
import { Level } from "@/lib/level";
import { useLevel } from "@/hooks/useLevel";

interface LevelGateProps {
  min: Level;
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * Renders children only when the user's level meets `min`.
 * Renders `fallback` (default: nothing) otherwise.
 */
export default function LevelGate({ min, children, fallback = null }: LevelGateProps) {
  const { has } = useLevel();
  return has(min) ? <>{children}</> : <>{fallback}</>;
}
