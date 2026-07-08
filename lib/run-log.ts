/** Console probe before each timed sort — aids debugging OOM / hangs at large n. */
export function logRunProbe(phase: string, details: Record<string, unknown>): void {
  if (typeof console === "undefined") return;
  console.log(`[codecookbook] ${phase}`, { ts: performance.now(), ...details });
}

export function approxInputBytes(n: number, dataType: string): number {
  const perEl = dataType === "string" ? 32 : 8;
  return n * perEl;
}
