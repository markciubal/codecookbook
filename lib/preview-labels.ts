import type { DataType, SortStep } from "@/lib/benchmark";
import { generateBenchmarkInput, generateFloatInput, generateStringInput } from "@/lib/benchmark";

/** Map a string to a stable positive numeric key for bar-height / sortSteps. */
export function stringSortKey(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return (h % 9999) + 1;
}

/** Short deterministic hash for compact display under narrow bars. */
export function hashShort(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return `#${h.toString(16).slice(0, 4)}`;
}

/** Fingerprint of the whole sample array (shown in the preview header). */
export function sampleFingerprint(parts: string[]): string {
  let h = 5381;
  for (const p of parts) {
    for (let i = 0; i < p.length; i++) h = ((h << 5) + h + p.charCodeAt(i)) >>> 0;
  }
  return h.toString(16).padStart(8, "0").slice(0, 8);
}

export function formatPreviewLabel(
  value: number | string,
  dataType: DataType,
  compact: boolean,
): string {
  if (dataType === "string") {
    const s = String(value);
    if (compact || s.length > 5) return hashShort(s);
    return s.length > 0 ? s : "∅";
  }
  const n = typeof value === "number" ? value : Number(value);
  if (dataType === "float") {
    const t = compact
      ? (Math.abs(n) >= 100 ? n.toFixed(0) : n.toFixed(1))
      : (Number.isInteger(n) ? String(n) : n.toFixed(2));
    return t;
  }
  const t = compact && Math.abs(n) >= 1000 ? `${Math.round(n / 100) / 10}k` : String(Math.round(n));
  return t;
}

/** Replay swap markers so string labels track element movement across steps. */
export function labelsAtStep(
  steps: SortStep[],
  initialLabels: string[],
  stepIdx: number,
  dataType: DataType,
  compact: boolean,
): string[] {
  const step = steps[stepIdx];
  if (!step) return initialLabels.map(l => formatPreviewLabel(l, dataType, compact));

  if (dataType !== "string") {
    return step.arr.map(v => formatPreviewLabel(v, dataType, compact));
  }

  let labels = [...initialLabels];
  for (let s = 0; s <= stepIdx; s++) {
    const sw = steps[s].swapping;
    for (let i = 0; i + 1 < sw.length; i += 2) {
      const a = sw[i], b = sw[i + 1];
      if (a >= 0 && b >= 0 && a < labels.length && b < labels.length) {
        [labels[a], labels[b]] = [labels[b], labels[a]];
      }
    }
  }
  return labels.map(l => formatPreviewLabel(l, dataType, compact));
}

export function buildPrerunSample(
  n: number,
  dataType: DataType,
): { numeric: number[]; labels: string[] } {
  if (dataType === "string") {
    const raw = generateStringInput(n, "random");
    return {
      numeric: raw.map(stringSortKey),
      labels: raw.map(s => s),
    };
  }
  if (dataType === "float") {
    const raw = generateFloatInput(n, "random");
    return {
      numeric: [...raw],
      labels: raw.map(v => String(v)),
    };
  }
  const raw = generateBenchmarkInput(n, "random");
  return {
    numeric: [...raw],
    labels: raw.map(v => String(v)),
  };
}
