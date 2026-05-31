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
