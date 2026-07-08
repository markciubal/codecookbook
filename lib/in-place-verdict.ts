/**
 * In-place classification for benchmark aux-memory badges.
 * Measurement alone misses native sorts (timsort), spread copies, and engine-internal buffers.
 * Catalog flags backstop those false "in-place ✓" readings.
 */

/** Authoritative in-place catalog — keep in sync with ALGO_INFO.inPlace in BenchmarkVisualizer. */
export const ALGO_CATALOG_IN_PLACE: Record<string, boolean> = {
  logos: false,
  adaptive: false,
  pdqsort: true,
  introsort: true,
  timsort: false,
  "timsort-js": false,
  powersort: false,
  merge: false,
  quick: true,
  heap: true,
  shell: true,
  counting: false,
  radix: false,
  bucket: false,
  insertion: true,
  selection: true,
  bubble: true,
  cocktail: true,
  comb: true,
  gnome: true,
  pancake: false,
  cycle: true,
  oddeven: true,
  bitonic: false,
};

const AUX_SPACE: Record<string, string> = {
  logos: "O(log n) / O(n)",
  adaptive: "O(log n) / O(span)",
  pdqsort: "O(log n)",
  introsort: "O(log n)",
  timsort: "O(n)",
  "timsort-js": "O(n)",
  powersort: "O(n)",
  merge: "O(n)",
  quick: "O(log n) avg / O(n) worst",
  heap: "O(1)",
  shell: "O(1)",
  counting: "O(k)",
  radix: "O(n+k)",
  bucket: "O(n)",
  insertion: "O(1)",
  selection: "O(1)",
  bubble: "O(1)",
  cocktail: "O(1)",
  comb: "O(1)",
  gnome: "O(1)",
  pancake: "O(n)",
  cycle: "O(1)",
  oddeven: "O(1)",
  bitonic: "O(n)",
};

export function catalogInPlace(algoId: string): boolean | null {
  return algoId in ALGO_CATALOG_IN_PLACE ? ALGO_CATALOG_IN_PLACE[algoId] : null;
}

/** Worst-case auxiliary bytes from Big-O space class (matches BenchmarkVisualizer). */
export function theoreticalAuxBytes(id: string, n: number): number {
  const space = AUX_SPACE[id] ?? "";
  const segments = space.split("/").map(s => s.trim());
  const worst = segments.reduce<string>((acc, seg) => {
    const rank = (s: string) => {
      if (s.startsWith("O(n")) return 3;
      if (s.startsWith("O(k")) return 2;
      if (s.includes("log")) return 1;
      return 0;
    };
    return rank(seg) >= rank(acc) ? seg : acc;
  }, segments[0] ?? "");
  if (worst === "O(1)") return 200;
  if (worst.includes("log")) return Math.ceil(Math.log2(Math.max(n, 2))) * 64;
  if (worst.startsWith("O(k")) return Math.min(n, 1_000_000) * 4;
  return n * 8;
}

/** Aux bytes stored in session / winners logs — never treat catalog O(n) sorts as 0 aux. */
export function effectiveAuxBytes(
  algoId: string,
  allocBytes: number | null | undefined,
  fallbackSpace: number,
  n: number,
): number {
  if (allocBytes != null && allocBytes > 0) return allocBytes;
  if (catalogInPlace(algoId) === false && n > 0) return theoreticalAuxBytes(algoId, n);
  if (allocBytes != null) return allocBytes;
  return fallbackSpace;
}

export type InPlaceVerdict = { label: string; color: string; bg: string; title: string };

export function inPlaceVerdict(
  allocBytes: number | null | undefined,
  heapDeltaBytes: number | null | undefined,
  n: number,
  algoId?: string,
): InPlaceVerdict | null {
  if (n <= 0) return null;
  const catalog = algoId != null ? catalogInPlace(algoId) : null;
  const a = allocBytes ?? null;
  const h = heapDeltaBytes ?? null;
  if (a == null && h == null && catalog == null) return null;
  const aPer = a != null ? a / n : 0;
  const hPer = h != null ? h / n : 0;
  const spaceLabel = AUX_SPACE[algoId ?? ""] ?? "O(n)";

  if (a != null && aPer >= 1) {
    return {
      label: "O(n) aux ✗",
      color: "#ef5350",
      bg: "rgba(239,83,80,0.15)",
      title: `${aPer.toFixed(2)} aux bytes/element · instrumented allocators caught O(n) growth`,
    };
  }
  if (h != null && hPer >= 4) {
    return {
      label: "O(n) aux ✗?",
      color: "#ef5350",
      bg: "rgba(239,83,80,0.15)",
      title: `${hPer.toFixed(2)} aux bytes/element · instrumentation missed it; heap delta caught O(n) growth (noisy source)`,
    };
  }

  if (catalog === false) {
    return {
      label: "+aux",
      color: "#d4831f",
      bg: "rgba(212,131,31,0.15)",
      title: `Not in-place (${spaceLabel} auxiliary) — measurement may read ~0 when native code or spread copies hide allocations`,
    };
  }

  if (a != null) {
    return {
      label: "in-place ✓",
      color: "#22c55e",
      bg: "rgba(34,197,94,0.15)",
      title: `${aPer.toFixed(3)} aux bytes/element instrumented · O(1)/O(log n) auxiliary memory`,
    };
  }
  if (h != null) {
    return {
      label: "in-place ✓?",
      color: "#22c55e",
      bg: "rgba(34,197,94,0.15)",
      title: `${hPer.toFixed(3)} aux bytes/element from heap delta · likely in-place but no instrumented data`,
    };
  }
  return null;
}

/** Whether a (algo, n) bucket counts as in-place for leaderboard / detail lines. */
export function bucketIsInPlace(algoId: string, meanSpaceBytes: number, n: number): boolean {
  if (n <= 0) return false;
  if (catalogInPlace(algoId) === false) return false;
  return meanSpaceBytes / n < 1;
}
