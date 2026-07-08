/** Log-log curve fitting and Big-O reference curves for performance charts. */

export interface FitResult {
  label: string;
  k: number;
  exp: number;
  fn: (n: number) => number;
  pctAt: (n: number, measured: number) => number;
}

function toSup(s: string): string {
  return s.replace(/./g, c =>
    ({ "0":"⁰","1":"¹","2":"²","3":"³","4":"⁴","5":"⁵","6":"⁶","7":"⁷","8":"⁸","9":"⁹","-":"⁻",".":"·" } as Record<string,string>)[c] ?? c
  );
}

export { toSup };

const EULER = Math.E;

/** Skip e^k ticks that sit on a base-10 grid line (already labeled). */
function nearPowerOf10(v: number): boolean {
  if (v <= 0) return true;
  const lg = Math.log10(v);
  return Math.abs(lg - Math.round(lg)) < 0.015;
}

export function formatEulerPowerTick(k: number): string {
  if (k === 0) return "1";
  if (k === 1) return "e";
  if (k === -1) return "e⁻¹";
  return k > 0 ? `e${toSup(String(k))}` : `e${toSup(String(k))}`;
}

/** Powers of e (Euler's number) visible on a log-y performance chart. */
export function buildEulerLogYTicks(
  minV: number,
  maxV: number,
  yAt: (v: number) => number,
  plotTop: number,
  plotBottom: number,
): { v: number; y: number; label: string }[] {
  if (minV <= 0 || maxV <= 0) return [];
  const kMin = Math.floor(Math.log(minV) / Math.log(EULER));
  const kMax = Math.ceil(Math.log(maxV) / Math.log(EULER));
  const out: { v: number; y: number; label: string }[] = [];
  for (let k = kMin; k <= kMax; k++) {
    const v = Math.pow(EULER, k);
    if (v < minV * 0.85 || v > maxV * 1.15) continue;
    if (nearPowerOf10(v)) continue;
    const y = yAt(v);
    if (y < plotTop - 2 || y > plotBottom + 2) continue;
    out.push({ v, y, label: formatEulerPowerTick(k) });
  }
  return out;
}

export function fitLogLog(points: { n: number; val: number }[]): FitResult | null {
  const valid = points.filter(p => p.val > 0 && p.n > 1);
  if (valid.length < 2) return null;

  const xs = valid.map(p => Math.log(p.n));
  const ys = valid.map(p => Math.log(p.val));
  const m  = valid.length;
  const sx  = xs.reduce((s, x) => s + x, 0);
  const sy  = ys.reduce((s, y) => s + y, 0);
  const sxx = xs.reduce((s, x) => s + x * x, 0);
  const sxy = xs.reduce((s, x, i) => s + x * ys[i], 0);

  const denom = m * sxx - sx * sx;
  if (denom === 0) return null;

  const b    = (m * sxy - sx * sy) / denom;
  const a    = Math.exp((sy - b * sx) / m);
  const fn   = (n: number) => Math.pow(n, b);
  const label = `n${toSup(b.toFixed(2))}`;

  return { label, k: a, exp: b, fn, pctAt: (n, measured) => { const p = a * fn(n); return p === 0 ? 0 : ((measured - p) / p) * 100; } };
}

export const BIG_O_REFS = [
  { id: "logn",   label: "O(log n)",   fn: (n: number) => Math.log2(Math.max(n, 2)),                          color: "#4db6ac" },
  { id: "n",      label: "O(n)",       fn: (n: number) => n,                                                  color: "#64b5f6" },
  { id: "nlogn",  label: "O(n log n)", fn: (n: number) => n * Math.log2(Math.max(n, 2)),                      color: "#ffb74d" },
  { id: "nlog2n", label: "O(n log²n)", fn: (n: number) => n * Math.log2(Math.max(n, 2)) ** 2,                color: "#ce93d8" },
  { id: "n2",     label: "O(n²)",      fn: (n: number) => n * n,                                              color: "#ef9a9a" },
] as const;

export const SPACE_BIG_O_REFS = [
  { id: "1",    label: "O(1)",     fn: (_: number) => 1,                            color: "#4db6ac" },
  { id: "logn", label: "O(log n)", fn: (n: number) => Math.log2(Math.max(n, 2)),   color: "#64b5f6" },
  { id: "n",    label: "O(n)",     fn: (n: number) => n,                           color: "#ffb74d" },
] as const;
