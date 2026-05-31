/** Shared axis / tooltip formatters for benchmark charts. */

export function fmtN(n: number): string {
  const fmt = (v: number) => {
    if (v % 1 === 0) return v.toFixed(0);
    const s = v.toPrecision(3);
    return s.includes(".") ? s.replace(/\.?0+$/, "") : s;
  };
  if (n >= 1_000_000_000) return `${fmt(n / 1_000_000_000)}B`;
  if (n >= 1_000_000)     return `${fmt(n / 1_000_000)}M`;
  if (n >= 1_000)         return `${fmt(n / 1_000)}k`;
  return String(n);
}

export function fmtTime(ms: number): string {
  if (ms < 0.1)   return `${(ms * 1_000).toFixed(0)} μs`;
  if (ms < 10)    return `${ms.toFixed(3)} ms`;
  if (ms < 1_000) return `${ms.toFixed(1)} ms`;
  return `${(ms / 1_000).toFixed(2)} s`;
}

export function fmtPredicted(ms: number): string {
  if (ms < 1)           return `${(ms * 1_000).toFixed(0)}μs`;
  if (ms < 1_000)       return `${ms.toFixed(1)}ms`;
  if (ms < 60_000)      return `${(ms / 1_000).toFixed(1)}s`;
  if (ms < 3_600_000)   return `${(ms / 60_000).toFixed(1)}min`;
  if (ms < 86_400_000)  return `${(ms / 3_600_000).toFixed(1)}hr`;
  return `${(ms / 86_400_000).toFixed(0)}d`;
}

export function fmtBytes(b: number): string {
  if (b <= 0)           return "0 B";
  if (b < 1_024)        return `${b.toFixed(0)} B`;
  if (b < 1_048_576)    return `${(b / 1_024).toFixed(1)} KB`;
  return `${(b / 1_048_576).toFixed(1)} MB`;
}
