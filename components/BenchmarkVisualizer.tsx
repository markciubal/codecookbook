"use client";

import React, { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { Play, Square, RotateCcw, Trophy, LineChart, ChevronRight, Lock, Unlock, Volume2, Settings, Code, X, Copy, Check } from "lucide-react";
import { generateBenchmarkInput, SORT_FNS, makeQuickSort, makeShellSort, makeLogosSort, sortSteps, makeAdversarialInput, measureAllocBytes, DEFAULT_LOGOS_PARAMS, type LogosParams, type BenchmarkScenario, type CustomDistribution, type QuickPivot, type ShellGaps, type SortStep } from "@/lib/benchmark";
import { BENCHMARK_SOURCE } from "@/lib/benchmark-source";
import { getLogosSortSteps } from "@/lib/algorithms";
import { useLevel } from "@/hooks/useLevel";

// ── Static config ─────────────────────────────────────────────────────────────

const SLOW_IDS = new Set(["insertion", "selection", "bubble", "cocktail", "comb", "gnome", "pancake", "cycle", "oddeven"]);
const SLOW_THRESHOLD = 5_000;
// All O(n log n) algorithms are allowed above 5 M elements
const _UNLIMITED_BASE = new Set(["logos", "timsort", "timsort-js", "introsort", "merge", "quick", "heap"]);
const UNLIMITED_IDS = { has: (id: string) => _UNLIMITED_BASE.has(id) || /^logos-custom-\d+$/.test(id) };

// Palette for numbered Logos custom variants
const LC_COLORS = ["#555555", "#8B6000", "#2E4A7A", "#3D6B3D", "#6B3D6B", "#8B3333"];

// Makes a record return dynamic values for logos-custom-N keys
function withLogosVariants<T>(base: Record<string, T>, fallback: (n: number) => T): Record<string, T> {
  return new Proxy(base as Record<string, T>, {
    get(target, key) {
      const k = key as string;
      const stored = target[k];
      if (stored !== undefined) return stored;
      const m = k.match(/^logos-custom-(\d+)$/);
      if (m) return fallback(parseInt(m[1]));
      return undefined;
    },
  }) as Record<string, T>;
}
const LARGE_THRESHOLD = 5_000_000;

// Code snippets available for loading into the custom sort editor
const CUSTOM_PRESETS: { label: string; code: string }[] = [
  {
    label: "Merge",
    code: `(arr) => {
  const a = [...arr];
  function merge(lo, hi) {
    if (hi <= lo) return;
    const mid = (lo + hi) >> 1;
    merge(lo, mid); merge(mid + 1, hi);
    const left = a.slice(lo, mid + 1);
    let i = 0, j = mid + 1, k = lo;
    while (i < left.length && j <= hi)
      a[k++] = left[i] <= a[j] ? left[i++] : a[j++];
    while (i < left.length) a[k++] = left[i++];
  }
  merge(0, a.length - 1);
  return a;
}`,
  },
  {
    label: "Quick",
    code: `(arr) => {
  const a = [...arr];
  function qs(lo, hi) {
    if (lo >= hi) return;
    const mid = (lo + hi) >> 1;
    if (a[mid] < a[lo]) [a[lo], a[mid]] = [a[mid], a[lo]];
    if (a[hi]  < a[lo]) [a[lo], a[hi]]  = [a[hi],  a[lo]];
    if (a[hi]  < a[mid]) [a[mid], a[hi]] = [a[hi], a[mid]];
    const pivot = a[hi]; let p = lo - 1;
    for (let i = lo; i < hi; i++)
      if (a[i] <= pivot) { ++p; [a[p], a[i]] = [a[i], a[p]]; }
    [a[p + 1], a[hi]] = [a[hi], a[p + 1]];
    qs(lo, p); qs(p + 2, hi);
  }
  qs(0, a.length - 1);
  return a;
}`,
  },
  {
    label: "Heap",
    code: `(arr) => {
  const a = [...arr];
  const n = a.length;
  function sift(size, root) {
    let top = root;
    const l = 2 * root + 1, r = l + 1;
    if (l < size && a[l] > a[top]) top = l;
    if (r < size && a[r] > a[top]) top = r;
    if (top !== root) {
      [a[root], a[top]] = [a[top], a[root]];
      sift(size, top);
    }
  }
  for (let i = (n >> 1) - 1; i >= 0; i--) sift(n, i);
  for (let end = n - 1; end > 0; end--) {
    [a[0], a[end]] = [a[end], a[0]]; sift(end, 0);
  }
  return a;
}`,
  },
  {
    label: "Shell",
    code: `(arr) => {
  const a = [...arr];
  for (let gap = a.length >> 1; gap > 0; gap >>= 1) {
    for (let i = gap; i < a.length; i++) {
      const tmp = a[i]; let j = i;
      while (j >= gap && a[j - gap] > tmp) {
        a[j] = a[j - gap]; j -= gap;
      }
      a[j] = tmp;
    }
  }
  return a;
}`,
  },
  {
    label: "Insertion",
    code: `(arr) => {
  const a = [...arr];
  for (let i = 1; i < a.length; i++) {
    const key = a[i]; let j = i - 1;
    while (j >= 0 && a[j] > key) { a[j + 1] = a[j]; j--; }
    a[j + 1] = key;
  }
  return a;
}`,
  },
  {
    label: "Bubble",
    code: `(arr) => {
  const a = [...arr];
  for (let i = 0; i < a.length - 1; i++)
    for (let j = 0; j < a.length - 1 - i; j++)
      if (a[j] > a[j + 1]) [a[j], a[j + 1]] = [a[j + 1], a[j]];
  return a;
}`,
  },
  {
    label: "Counting",
    code: `(arr) => {
  if (!arr.length) return [];
  let min = arr[0], max = arr[0];
  for (const x of arr) { if (x < min) min = x; if (x > max) max = x; }
  const count = new Array(max - min + 1).fill(0);
  for (const x of arr) count[x - min]++;
  const out = [];
  count.forEach((c, i) => { for (let j = 0; j < c; j++) out.push(i + min); });
  return out;
}`,
  },
  {
    label: "Radix",
    code: `(arr) => {
  if (!arr.length) return [];
  let a = [...arr];
  const off = Math.min(...a);
  if (off < 0) a = a.map(x => x - off);
  const max = Math.max(...a);
  for (let exp = 1; Math.floor(max / exp) > 0; exp *= 10) {
    const b = Array.from({ length: 10 }, () => []);
    for (const x of a) b[Math.floor(x / exp) % 10].push(x);
    a = b.flat();
  }
  return off < 0 ? a.map(x => x + off) : a;
}`,
  },
  {
    label: "Bucket",
    code: `(arr) => {
  if (!arr.length) return [];
  const a = [...arr];
  const max = Math.max(...a) + 1;
  const nb = Math.max(Math.floor(Math.sqrt(a.length)), 1);
  const buckets = Array.from({ length: nb }, () => []);
  for (const x of a) buckets[Math.min(Math.floor((x / max) * nb), nb - 1)].push(x);
  return buckets.flatMap(b => b.sort((x, y) => x - y));
}`,
  },
  {
    label: "Introsort",
    code: `(arr) => {
  const a = [...arr];
  const n = a.length;
  const maxDepth = n <= 1 ? 0 : 2 * Math.floor(Math.log2(n));
  function ins(lo, hi) {
    for (let i = lo + 1; i <= hi; i++) {
      const k = a[i]; let j = i - 1;
      while (j >= lo && a[j] > k) { a[j + 1] = a[j]; j--; }
      a[j + 1] = k;
    }
  }
  function hpfy(end, root, base) {
    let lg = root;
    const l = 2 * root + 1, r = l + 1;
    if (l < end && a[base + l] > a[base + lg]) lg = l;
    if (r < end && a[base + r] > a[base + lg]) lg = r;
    if (lg !== root) { [a[base + root], a[base + lg]] = [a[base + lg], a[base + root]]; hpfy(end, lg, base); }
  }
  function hp(lo, hi) {
    const len = hi - lo + 1;
    for (let i = Math.floor(len / 2) - 1; i >= 0; i--) hpfy(len, i, lo);
    for (let i = len - 1; i > 0; i--) { [a[lo], a[lo + i]] = [a[lo + i], a[lo]]; hpfy(i, 0, lo); }
  }
  function med3(lo, mid, hi) {
    if (a[lo] > a[mid]) [a[lo], a[mid]] = [a[mid], a[lo]];
    if (a[lo] > a[hi])  [a[lo], a[hi]]  = [a[hi],  a[lo]];
    if (a[mid] > a[hi]) [a[mid], a[hi]] = [a[hi], a[mid]];
    return mid;
  }
  function sort(lo, hi, depth) {
    if (hi - lo < 1) return;
    if (hi - lo + 1 <= 16) { ins(lo, hi); return; }
    if (depth === 0) { hp(lo, hi); return; }
    const mid = (lo + hi) >> 1;
    const pi = med3(lo, mid, hi);
    const pv = a[pi];
    [a[pi], a[hi - 1]] = [a[hi - 1], a[pi]];
    let i = lo, j = hi - 2;
    while (true) {
      while (i <= hi - 1 && a[i] < pv) i++;
      while (j >= lo && a[j] > pv) j--;
      if (i >= j) break;
      [a[i], a[j]] = [a[j], a[i]]; i++; j--;
    }
    [a[i], a[hi - 1]] = [a[hi - 1], a[i]];
    sort(lo, i - 1, depth - 1);
    sort(i + 1, hi, depth - 1);
  }
  sort(0, n - 1, maxDepth);
  return a;
}`,
  },
  {
    label: "TimSort (JS)",
    code: `(arr) => {
  const a = [...arr];
  const n = a.length;
  if (n < 2) return a;
  function minRun(len) { let r = 0; while (len >= 64) { r |= len & 1; len >>= 1; } return len + r; }
  const MIN_RUN = minRun(n);
  function binsert(lo, hi, start) {
    for (let i = start; i <= hi; i++) {
      const pv = a[i]; let l = lo, r = i;
      while (l < r) { const m = (l + r) >>> 1; if (a[m] > pv) r = m; else l = m + 1; }
      for (let j = i; j > l; j--) a[j] = a[j - 1];
      a[l] = pv;
    }
  }
  function countRun(lo, hi) {
    let hi2 = lo + 1;
    if (hi2 === hi + 1) return hi2;
    if (a[hi2++] < a[lo]) {
      while (hi2 <= hi && a[hi2] < a[hi2 - 1]) hi2++;
      for (let l = lo, r = hi2 - 1; l < r; l++, r--) { const t = a[l]; a[l] = a[r]; a[r] = t; }
    } else { while (hi2 <= hi && a[hi2] >= a[hi2 - 1]) hi2++; }
    return hi2;
  }
  function merge(lo, mid, hi) {
    const llen = mid - lo + 1, rlen = hi - mid;
    if (llen <= rlen) {
      const tmp = a.slice(lo, mid + 1);
      let i = 0, j = mid + 1, k = lo;
      while (i < llen && j <= hi) a[k++] = tmp[i] <= a[j] ? tmp[i++] : a[j++];
      while (i < llen) a[k++] = tmp[i++];
    } else {
      const tmp = a.slice(mid + 1, hi + 1);
      let i = mid, j = rlen - 1, k = hi;
      while (i >= lo && j >= 0) a[k--] = a[i] > tmp[j] ? a[i--] : tmp[j--];
      while (j >= 0) a[k--] = tmp[j--];
    }
  }
  const rb = [], rl = [];
  function mergeAt(i) {
    const b2 = rb[i + 1], l2 = rl[i + 1];
    rl[i] += l2; rb.splice(i + 1, 1); rl.splice(i + 1, 1);
    merge(rb[i], b2 - 1, b2 + l2 - 1);
  }
  function collapse() {
    while (rb.length > 1) {
      const n2 = rb.length - 1;
      if (n2 > 1 && rl[n2 - 2] <= rl[n2 - 1] + rl[n2])
        mergeAt(rl[n2 - 2] < rl[n2] ? n2 - 2 : n2 - 1);
      else if (rl[n2 - 1] <= rl[n2]) mergeAt(n2 - 1);
      else break;
    }
  }
  let lo = 0, rem = n;
  while (rem > 0) {
    let rl2 = countRun(lo, lo + rem - 1) - lo;
    if (rl2 < MIN_RUN) { const f = Math.min(rem, MIN_RUN); binsert(lo, lo + f - 1, lo + rl2); rl2 = f; }
    rb.push(lo); rl.push(rl2); collapse();
    lo += rl2; rem -= rl2;
  }
  while (rb.length > 1) mergeAt(rb.length > 2 && rl[rb.length - 3] < rl[rb.length - 1] ? rb.length - 3 : rb.length - 2);
  return a;
}`,
  },
  {
    label: "Selection",
    code: `(arr) => {
  const a = [...arr];
  for (let i = 0; i < a.length - 1; i++) {
    let m = i;
    for (let j = i + 1; j < a.length; j++) if (a[j] < a[m]) m = j;
    if (m !== i) [a[i], a[m]] = [a[m], a[i]];
  }
  return a;
}`,
  },
  {
    label: "Cocktail",
    code: `(arr) => {
  const a = [...arr];
  let lo = 0, hi = a.length - 1;
  while (lo < hi) {
    for (let i = lo; i < hi; i++) if (a[i] > a[i + 1]) [a[i], a[i + 1]] = [a[i + 1], a[i]];
    hi--;
    for (let i = hi; i > lo; i--) if (a[i] < a[i - 1]) [a[i], a[i - 1]] = [a[i - 1], a[i]];
    lo++;
  }
  return a;
}`,
  },
  {
    label: "Comb",
    code: `(arr) => {
  const a = [...arr];
  let gap = a.length, sorted = false;
  while (!sorted) {
    gap = Math.max(1, Math.floor(gap / 1.3));
    sorted = gap === 1;
    for (let i = 0; i + gap < a.length; i++)
      if (a[i] > a[i + gap]) { [a[i], a[i + gap]] = [a[i + gap], a[i]]; sorted = false; }
  }
  return a;
}`,
  },
  {
    label: "Gnome",
    code: `(arr) => {
  const a = [...arr];
  let pos = 0;
  while (pos < a.length) {
    if (pos === 0 || a[pos] >= a[pos - 1]) pos++;
    else { [a[pos], a[pos - 1]] = [a[pos - 1], a[pos]]; pos--; }
  }
  return a;
}`,
  },
  {
    label: "Pancake",
    code: `(arr) => {
  const a = [...arr];
  for (let size = a.length; size > 1; size--) {
    let mx = 0;
    for (let i = 1; i < size; i++) if (a[i] > a[mx]) mx = i;
    if (mx !== size - 1) {
      a.splice(0, mx + 1, ...a.slice(0, mx + 1).reverse());
      a.splice(0, size, ...a.slice(0, size).reverse());
    }
  }
  return a;
}`,
  },
  {
    label: "Cycle",
    code: `(arr) => {
  const a = [...arr];
  for (let cs = 0; cs < a.length - 1; cs++) {
    let item = a[cs], pos = cs;
    for (let i = cs + 1; i < a.length; i++) if (a[i] < item) pos++;
    if (pos === cs) continue;
    while (item === a[pos]) pos++;
    [a[pos], item] = [item, a[pos]];
    while (pos !== cs) {
      pos = cs;
      for (let i = cs + 1; i < a.length; i++) if (a[i] < item) pos++;
      while (item === a[pos]) pos++;
      [a[pos], item] = [item, a[pos]];
    }
  }
  return a;
}`,
  },
  {
    label: "Odd-Even",
    code: `(arr) => {
  const a = [...arr];
  let sorted = false;
  while (!sorted) {
    sorted = true;
    for (let i = 1; i < a.length - 1; i += 2)
      if (a[i] > a[i + 1]) { [a[i], a[i + 1]] = [a[i + 1], a[i]]; sorted = false; }
    for (let i = 0; i < a.length - 1; i += 2)
      if (a[i] > a[i + 1]) { [a[i], a[i + 1]] = [a[i + 1], a[i]]; sorted = false; }
  }
  return a;
}`,
  },
  {
    label: "Logos",
    code: `(arr) => {
  // Logos Sort — dual-pivot introsort hybrid with adaptive shortcuts
  const PHI = 0.61803399, PHI2 = 0.38196601, BASE = 48;
  const a = [...arr];
  const n = a.length;
  if (n < 2) return a;
  // xoshiro128+ PRNG
  const s = new Uint32Array(4); crypto.getRandomValues(s);
  if (!s[0] && !s[1] && !s[2] && !s[3]) s[0] = 1;
  function xrand() {
    const r = (s[0] + s[3]) >>> 0, mb = s[1] << 9;
    s[2] ^= s[0]; s[3] ^= s[1]; s[1] ^= s[2]; s[0] ^= s[3];
    s[2] ^= mb; s[3] = (s[3] << 11) | (s[3] >>> 21);
    return (r >>> 1) / 0x80000000;
  }
  const depth0 = 2 * Math.floor(Math.log2(n)) + 4;
  function med3(x, y, z) {
    if (x > y) { const t = x; x = y; y = t; }
    if (y > z) { const t = y; y = z; z = t; }
    if (x > y) { const t = x; x = y; y = t; }
    return y;
  }
  function ninther(lo, hi, ci) {
    return med3(a[Math.max(lo, ci - 1)], a[ci], a[Math.min(hi, ci + 1)]);
  }
  function dualPart(lo, hi, p1, p2) {
    if (p1 > p2) { const t = p1; p1 = p2; p2 = t; }
    let lt = lo, gt = hi, i = lo;
    while (i <= gt) {
      if (a[i] < p1) { [a[lt], a[i]] = [a[i], a[lt]]; lt++; i++; }
      else if (a[i] > p2) { [a[i], a[gt]] = [a[gt], a[i]]; gt--; }
      else i++;
    }
    return [lt, gt];
  }
  function sort(lo, hi, d) {
    while (lo < hi) {
      const sz = hi - lo + 1;
      if (d <= 0) { const tmp = a.slice(lo, hi + 1).sort((x, y) => x - y); for (let i = lo; i <= hi; i++) a[i] = tmp[i - lo]; return; }
      if (sz <= BASE) {
        for (let i = lo + 1; i <= hi; i++) { const k = a[i]; let j = i - 1; while (j >= lo && a[j] > k) { a[j + 1] = a[j]; j--; } a[j + 1] = k; }
        return;
      }
      let mn = a[lo], mx = a[lo];
      for (let i = lo + 1; i <= hi; i++) { if (a[i] < mn) mn = a[i]; if (a[i] > mx) mx = a[i]; }
      const span = mx - mn;
      if (Number.isInteger(mn) && span < sz * 4) {
        const cnt = new Array(span + 1).fill(0);
        for (let i = lo; i <= hi; i++) cnt[a[i] - mn]++;
        let w = lo;
        for (let v = 0; v <= span; v++) { while (cnt[v]-- > 0) a[w++] = v + mn; }
        return;
      }
      if (a[lo] <= a[lo + 1] && a[lo + 1] <= a[lo + 2]) {
        let ok = true; for (let i = lo; i < hi; i++) if (a[i] > a[i + 1]) { ok = false; break; }
        if (ok) return;
        let rev = true; for (let i = lo; i < hi; i++) if (a[i] < a[i + 1]) { rev = false; break; }
        if (rev) { for (let l = lo, r = hi; l < r; l++, r--) { const t = a[l]; a[l] = a[r]; a[r] = t; } return; }
      }
      const jit = PHI * xrand() * (xrand() * 2 - 1);
      const ir = hi - lo;
      const li = lo + Math.max(0, Math.min(ir, Math.floor(ir * PHI2 * jit)));
      const ri = lo + Math.max(0, Math.min(ir, Math.floor(ir * PHI * jit)));
      const [le, re] = dualPart(lo, hi, ninther(lo, hi, li), ninther(lo, hi, ri));
      const regions = [[le - lo, lo, le - 1], [re - le + 1, le, re], [hi - re, re + 1, hi]];
      regions.sort((x, y) => x[0] - y[0]);
      if (regions[0][1] < regions[0][2]) sort(regions[0][1], regions[0][2], d - 1);
      if (regions[1][1] < regions[1][2]) sort(regions[1][1], regions[1][2], d - 1);
      lo = regions[2][1]; hi = regions[2][2]; d--;
    }
  }
  sort(0, n - 1, depth0);
  return a;
}`,
  },
];

// Algorithms with practical upper bounds above SLOW_THRESHOLD but below LARGE_THRESHOLD
const MEDIUM_LIMITS: Record<string, { threshold: number; reason: string }> = {
  shell:    { threshold: 2_000_000, reason: "Large gap strides cause cache thrashing above 2M — use Tim/Logos instead" },
  counting: { threshold: 1_000_000, reason: "Needs an O(k) count array; for random data k ≈ n, so memory explodes above 1M" },
  radix:    { threshold: 1_000_000, reason: "Multiple O(n) auxiliary arrays per digit pass — memory-heavy above 1M" },
  bucket:   { threshold: 500_000,   reason: "Worst-case O(n²) when buckets fill unevenly; unreliable above 500k on non-uniform data" },
};
const TIMEOUT_MS = 10_000;

const ALGO_GROUPS = [
  {
    label: "O(n log n)",
    items: [
      { id: "logos",     name: "Logos Sort",  href: "/sorting/logos" },
      { id: "introsort",   name: "Introsort",       href: "/sorting/introsort" },
      { id: "timsort",     name: "Tim Sort (V8)",   href: "/sorting/timsort" },
      { id: "timsort-js",  name: "Tim Sort (JS)" },
      { id: "merge",   name: "Merge Sort",      href: "/sorting/merge" },
      { id: "quick",   name: "Quick Sort",      href: "/sorting/quick" },
      { id: "heap",    name: "Heap Sort",       href: "/sorting/heap" },
    ],
  },
  {
    label: "Other",
    items: [
      { id: "shell",    name: "Shell Sort",    badge: "O(n log² n)" },
      { id: "counting", name: "Counting Sort", badge: "O(n+k)" },
      { id: "radix",    name: "Radix Sort",    badge: "O(nk)" },
      { id: "bucket",   name: "Bucket Sort",   badge: "O(n+k)" },
    ],
  },
  {
    label: "O(n²)",
    slow: true,
    items: [
      { id: "insertion", name: "Insertion Sort" },
      { id: "selection", name: "Selection Sort" },
      { id: "bubble",    name: "Bubble Sort" },
      { id: "cocktail",  name: "Cocktail Sort" },
      { id: "comb",      name: "Comb Sort" },
      { id: "gnome",     name: "Gnome Sort" },
      { id: "pancake",   name: "Pancake Sort" },
      { id: "cycle",     name: "Cycle Sort" },
      { id: "oddeven",   name: "Odd-Even Sort" },
    ],
  },
] as const;

const ALGO_NAMES: Record<string, string> = withLogosVariants({
  logos: "Logos Sort", "logos-custom-1": "Logos Sort - 1",
  introsort: "Introsort",
  timsort: "Tim Sort",   merge: "Merge Sort",
  quick: "Quick Sort", heap: "Heap Sort",      shell: "Shell Sort",
  counting: "Counting Sort", radix: "Radix Sort", bucket: "Bucket Sort",
  insertion: "Insertion Sort", selection: "Selection Sort", bubble: "Bubble Sort",
  cocktail: "Cocktail Sort", comb: "Comb Sort", gnome: "Gnome Sort",
  pancake: "Pancake Sort", cycle: "Cycle Sort", oddeven: "Odd-Even Sort",
  "timsort-js": "TimSort (JS)",
  custom: "Custom Sort",
}, n => `Logos Sort - ${n}`);


const ALGO_COLORS: Record<string, string> = withLogosVariants({
  logos:            "#000000",
  "logos-custom-1": "#555555",
  introsort:      "#e67e22",
  timsort:        "#5b9bd5",
  "timsort-js":   "#a8c9ed",  // lighter blue — same family, clearly related
  merge:     "#70ad47",
  quick:     "#ffc000",
  heap:      "#b263c8",
  shell:     "#00c4cc",
  counting:  "#ff6b9d",
  radix:     "#8bc34a",
  bucket:    "#ff8f00",
  insertion: "#ef5350",
  selection: "#7e57c2",
  bubble:    "#ec407a",
  cocktail:  "#f06292",
  comb:      "#4dd0e1",
  gnome:     "#aed581",
  pancake:   "#ffb300",
  cycle:     "#9575cd",
  oddeven:   "#4fc3f7",
  custom:    "#e040fb",
}, n => LC_COLORS[(n - 1) % LC_COLORS.length]);

const ALGO_SPACE: Record<string, string> = withLogosVariants({
  logos:            "O(log n) / O(n)",
  "logos-custom-1": "O(log n) / O(n)",
  introsort:      "O(log n)",
  timsort:        "O(n)",
  "timsort-js":   "O(n)",
  merge:     "O(n)",
  quick:     "O(log n) avg / O(n) worst",
  heap:      "O(1)",
  shell:     "O(1)",
  counting:  "O(k)",
  radix:     "O(n+k)",
  bucket:    "O(n)",
  insertion: "O(1)",
  selection: "O(1)",
  bubble:    "O(1)",
  cocktail:  "O(1)",
  comb:      "O(1)",
  gnome:     "O(1)",
  pancake:   "O(n)",
  cycle:     "O(1)",
  oddeven:   "O(1)",
}, () => "O(log n)");

const ALGO_TIME: Record<string, string> = withLogosVariants({
  logos:            "O(n log n)",
  "logos-custom-1": "O(n log n)",
  introsort:      "O(n log n)",
  timsort:        "O(n log n)",
  "timsort-js":   "O(n log n)",
  merge:     "O(n log n)",
  quick:     "O(n log n) avg",
  heap:      "O(n log n)",
  shell:     "O(n log² n)",
  counting:  "O(n+k)",
  radix:     "O(nk)",
  bucket:    "O(n+k)",
  insertion: "O(n²)",
  selection: "O(n²)",
  bubble:    "O(n²)",
  cocktail:  "O(n²)",
  comb:      "O(n²)",
  gnome:     "O(n²)",
  pancake:   "O(n²)",
  cycle:     "O(n²)",
  oddeven:   "O(n²)",
}, () => "O(n log n)");

// true = stable, false = unstable, null = not applicable
const ALGO_STABLE: Record<string, boolean> = withLogosVariants({
  logos:            false,
  "logos-custom-1": false,
  introsort:      false,
  timsort:        true,
  "timsort-js":   true,
  merge:     true,
  quick:     false,
  heap:      false,
  shell:     false,
  counting:  true,
  radix:     true,
  bucket:    true,
  insertion: true,
  selection: false,
  bubble:    true,
  cocktail:  true,
  comb:      false,
  gnome:     true,
  pancake:   false,
  cycle:     false,
  oddeven:   true,
}, () => false);

// true = can sort a stream, false = needs full input
const ALGO_ONLINE: Record<string, boolean> = withLogosVariants({
  logos:            false,
  "logos-custom-1": false,
  introsort:      false,
  timsort:        false,
  "timsort-js":   false,
  merge:     false,
  quick:     false,
  heap:      false,
  shell:     false,
  counting:  false,
  radix:     false,
  bucket:    false,
  insertion: true,
  selection: false,
  bubble:    false,
  cocktail:  false,
  comb:      false,
  gnome:     true,
  pancake:   false,
  cycle:     false,
  oddeven:   false,
}, () => false);

// Rank for sorting by complexity class (lower = better)
const BIG_O_RANK: Record<string, number> = {
  "O(1)":                       0,
  "O(log n)":                   1,
  "O(k)":                       2,
  "O(n+k)":                     3,
  "O(n)":                       4,
  "O(nk)":                      5,
  "O(n log n)":                 6,
  "O(n log n) avg":             6,
  "O(n log² n)":                7,
  "O(n²)":                      8,
  // compound labels — ranked by worst case
  "O(log n) / O(n)":            4,
  "O(log n) avg / O(n) worst":  4,
};

const BIG_O_REFS = [
  { id: "logn",   label: "O(log n)",   fn: (n: number) => Math.log2(Math.max(n, 2)),                          color: "#4db6ac" },
  { id: "n",      label: "O(n)",       fn: (n: number) => n,                                                  color: "#64b5f6" },
  { id: "nlogn",  label: "O(n log n)", fn: (n: number) => n * Math.log2(Math.max(n, 2)),                      color: "#ffb74d" },
  { id: "nlog2n", label: "O(n log²n)", fn: (n: number) => n * Math.log2(Math.max(n, 2)) ** 2,                color: "#ce93d8" },
  { id: "n2",     label: "O(n²)",      fn: (n: number) => n * n,                                              color: "#ef9a9a" },
] as const;

// Space complexity reference curves (calibrated separately — anchored to O(n))
const SPACE_BIG_O_REFS = [
  { id: "1",    label: "O(1)",     fn: (_: number) => 1,                            color: "#4db6ac" },
  { id: "logn", label: "O(log n)", fn: (n: number) => Math.log2(Math.max(n, 2)),   color: "#64b5f6" },
  { id: "n",    label: "O(n)",     fn: (n: number) => n,                           color: "#ffb74d" },
] as const;

// ── Big-O curve fitting ───────────────────────────────────────────────────────

interface FitResult {
  label: string;
  k: number;    // scale factor a  (y = a · nᵇ)
  exp: number;  // exponent b
  fn: (n: number) => number;
  pctAt: (n: number, measured: number) => number;
}

// Convert a numeric string to Unicode superscript, e.g. "1.08" → "¹·⁰⁸"
function toSup(s: string): string {
  return s.replace(/./g, c =>
    ({ "0":"⁰","1":"¹","2":"²","3":"³","4":"⁴","5":"⁵","6":"⁶","7":"⁷","8":"⁸","9":"⁹","-":"⁻",".":"·" } as Record<string,string>)[c] ?? c
  );
}

// Log-log OLS regression: fits y = a · nᵇ by linearising log(y) = log(a) + b·log(n).
// All data points contribute equally (no large-n bias) and no Big-O class is assumed —
// the exponent b is derived entirely from the measured data.
function fitLogLog(points: { n: number; val: number }[]): FitResult | null {
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

  const b    = (m * sxy - sx * sy) / denom;  // empirical exponent
  const a    = Math.exp((sy - b * sx) / m);  // scale factor
  const fn   = (n: number) => Math.pow(n, b);
  const label = `n${toSup(b.toFixed(2))}`;

  return { label, k: a, exp: b, fn, pctAt: (n, measured) => { const p = a * fn(n); return p === 0 ? 0 : ((measured - p) / p) * 100; } };
}

const SIZE_BUTTONS: { n: number; word: string }[] = [
  { n: 1,           word: "One" },
  { n: 10,          word: "Ten" },
  { n: 100,         word: "One Hundred" },
  { n: 1_000,       word: "One Thousand" },
  { n: 10_000,      word: "Ten Thousand" },
  { n: 100_000,     word: "One Hundred Thousand" },
  { n: 1_000_000,   word: "One Million" },
  { n: 10_000_000,  word: "Ten Million" },
  { n: 100_000_000, word: "One Hundred Million" },
];

const SCENARIO_OPTIONS: { id: BenchmarkScenario; label: string; desc: string; rare?: boolean }[] = [
  { id: "random",       label: "Random",          desc: "average case" },
  { id: "nearlySorted", label: "Nearly sorted",   desc: "Timsort's home turf" },
  { id: "reversed",     label: "Reversed",        desc: "worst case for naive quicksort" },
  { id: "duplicates",   label: "Many duplicates", desc: "stress-tests three-way partition" },
  { id: "sorted",       label: "Already sorted",  desc: "best case — rare in mix", rare: true },
];

// ── Per-algorithm variant descriptors ─────────────────────────────────────────

const QUICK_PIVOT_OPTS: { id: QuickPivot; label: string; desc: string }[] = [
  { id: "first",   label: "First",    desc: "arr[lo] — O(n²) on sorted or reversed input" },
  { id: "last",    label: "Last",     desc: "arr[hi] (Lomuto naive) — O(n²) on sorted input" },
  { id: "median3", label: "Median-3", desc: "Median of first/mid/last — eliminates O(n²) on sorted/reversed (default)" },
  { id: "random",  label: "Random",   desc: "Uniformly random pivot — probabilistically safe, expected O(n log n)" },
];

const SHELL_GAPS_OPTS: { id: ShellGaps; label: string; desc: string }[] = [
  { id: "shell",     label: "Shell",     desc: "Shell (1959): n/2, n/4, …, 1 — simple baseline, O(n²) worst case" },
  { id: "hibbard",   label: "Hibbard",   desc: "Hibbard (1963): 2^k−1 — O(n^(3/2)) worst case" },
  { id: "sedgewick", label: "Sedgewick", desc: "Sedgewick (1986): 1,5,19,41,… — O(n^(4/3)) worst case" },
  { id: "ciura",     label: "Ciura",     desc: "Ciura (2001): 1,4,10,23,… — empirically best, complexity unknown" },
];

// Returns the total space Big-O label (auxiliary + input).
// Input is always O(n), so total = O(n) unless aux already dominates with a
// larger term (e.g. counting sort's O(k) aux → O(n+k) total).
function totalSpaceLabel(id: string): string {
  const aux = ALGO_SPACE[id] ?? "";
  if (aux === "O(k)" || aux === "O(n+k)") return "O(n+k)";
  return "O(n)";
}

// ── Theoretical space estimation ──────────────────────────────────────────────
// Used when performance.memory is unavailable or returns 0 (its common lazy-
// update behavior means the before/after diff is often 0 for fast sorts).
// Values are in bytes and match the algorithm's known O() space class.
function theoreticalSpaceBytes(id: string, n: number): number {
  const space = ALGO_SPACE[id] ?? "";
  // For compound labels (e.g. "O(log n) avg / O(n) worst"), take the worst-case segment.
  // Split on "/" and parse the segment that represents the most space.
  const segments = space.split("/").map(s => s.trim());
  const worst = segments.reduce<string>((acc, seg) => {
    const rank = (s: string) => {
      if (s.startsWith("O(n")) return 3;
      if (s.startsWith("O(k")) return 2;
      if (s.includes("log"))   return 1;
      return 0; // O(1)
    };
    return rank(seg) >= rank(acc) ? seg : acc;
  }, segments[0]);
  if (worst === "O(1)")           return 200;
  if (worst.includes("log"))      return Math.ceil(Math.log2(Math.max(n, 2))) * 64;
  if (worst.startsWith("O(k"))    return Math.min(n, 1_000_000) * 4;
  return n * 8; // O(n), O(n+k), O(nk), etc.
}

const RANK_COLORS = ["#c9961a", "#888", "#b06830"];

function rankColor(rank: number, total: number): string {
  if (rank <= 3) return RANK_COLORS[rank - 1];
  if (rank === total) return "var(--color-state-swap)";
  return "var(--color-muted)";
}

// ── Algorithm info cards ───────────────────────────────────────────────────────

interface AlgoInfo {
  best: string; avg: string; worst: string;
  space: string;
  inPlace: boolean;
  useCase: string;
  intuition: string;
}

const ALGO_INFO: Record<string, AlgoInfo> = {
  logos:     { best: "O(n)",       avg: "O(n log n)", worst: "O(n log n)", space: "O(log n) / O(n)", inPlace: false, useCase: "General-purpose sort for any data; adaptive across all input patterns", intuition: "Dual-pivot introsort hybrid. Auxiliary space has three distinct paths: (1) pure recursion — O(log n) call stack via tail-call elimination on the largest partition; (2) counting sort shortcut — O(k) where k = value range, fires when valueRange < 4·n, often O(1) relative to n in practice; (3) introsort fallback — O(n) slice + TimSort merge buffer when depth 2·log₂n + 4 is exhausted (adversarial input only). Worst-case auxiliary is O(n)." },
  introsort: { best: "O(n log n)", avg: "O(n log n)", worst: "O(n log n)", space: "O(log n)", inPlace: true,  useCase: "Default sort in C++ std::sort; whenever stability isn't required", intuition: "Quicksort that switches to heapsort if recursion depth exceeds 2·log₂n — quicksort speed with worst-case guarantee" },
  timsort:      { best: "O(n)",       avg: "O(n log n)", worst: "O(n log n)", space: "O(n)",     inPlace: false, useCase: "Data that already has partial order: DB results, log files, nearly-sorted arrays", intuition: "Detects natural sorted runs in the input and merges them; exploits real-world order that pure quicksort ignores" },
  "timsort-js": { best: "O(n)",       avg: "O(n log n)", worst: "O(n log n)", space: "O(n)",     inPlace: false, useCase: "Same as Tim Sort — direct comparison of pure-JavaScript overhead vs V8's native C++ implementation", intuition: "Pure-JS implementation of the same TimSort algorithm: natural run detection, binary insertion sort, and merge with temporary buffer. The gap vs native .sort() reflects the JS⟷C++ comparator callback cost per comparison." },
  merge:     { best: "O(n log n)", avg: "O(n log n)", worst: "O(n log n)", space: "O(n)",     inPlace: false, useCase: "When stability is required and extra memory is available; external sort, linked lists", intuition: "Recursively splits the array in half, sorts each half, merges — guaranteed O(n log n) with no pivot pitfalls" },
  quick:     { best: "O(n log n)", avg: "O(n log n)", worst: "O(n²)",      space: "O(log n) avg / O(n) worst", inPlace: true,  useCase: "Fastest in practice on random data; avoid first/last pivot on sorted input", intuition: "Partitions around a pivot and recurses on both sides — cache-friendly but pivot choice determines whether you get n log n or n². Recursion stack is O(log n) average but O(n) on degenerate inputs without tail-call optimization." },
  heap:      { best: "O(n log n)", avg: "O(n log n)", worst: "O(n log n)", space: "O(1)",     inPlace: true,  useCase: "When both O(n log n) worst-case and O(1) extra space are required simultaneously", intuition: "Builds a max-heap then extracts elements one by one — theoretically optimal but cache-unfriendly; rarely beats quicksort in practice" },
  shell:     { best: "O(n log n)", avg: "O(n log² n)",worst: "O(n²)",      space: "O(1)",     inPlace: true,  useCase: "Memory-constrained environments; medium arrays where simplicity matters over peak speed", intuition: "Insertion sort with shrinking gap sequences — large gaps eliminate long-distance disorder early, making the final pass cheap" },
  counting:  { best: "O(n+k)",     avg: "O(n+k)",     worst: "O(n+k)",     space: "O(k)",     inPlace: false, useCase: "Small bounded integer keys: scores 0–100, ASCII characters, small enums", intuition: "Counts occurrences of each value, then reconstructs the array — zero comparisons, but requires a counting array of size k" },
  radix:     { best: "O(nk)",      avg: "O(nk)",       worst: "O(nk)",      space: "O(n+k)",   inPlace: false, useCase: "Large datasets of integers or fixed-length strings where k (digit count) is small", intuition: "Sorts by one digit at a time least-to-most significant, using a stable sub-sort each pass — avoids comparisons entirely" },
  bucket:    { best: "O(n+k)",     avg: "O(n+k)",     worst: "O(n²)",      space: "O(n+k)",   inPlace: false, useCase: "Uniformly distributed floating-point data; fast when values spread evenly across a known range", intuition: "Maps each value to a bucket by range, sorts each bucket independently, concatenates — collapses to O(n²) if distribution is skewed" },
  insertion: { best: "O(n)",       avg: "O(n²)",      worst: "O(n²)",      space: "O(1)",     inPlace: true,  useCase: "Arrays under ~20 elements, nearly-sorted input, or as the base case of hybrid sorts", intuition: "Inserts each element into its correct position among the already-sorted prefix — excellent on nearly-sorted data, terrible on reversed" },
  selection: { best: "O(n²)",      avg: "O(n²)",      worst: "O(n²)",      space: "O(1)",     inPlace: true,  useCase: "When write operations are expensive (e.g. flash memory) — makes only O(n) swaps regardless of input", intuition: "Finds the minimum of the unsorted suffix, swaps it to the front — simple and write-minimal, but always scans the whole array" },
  bubble:    { best: "O(n)",       avg: "O(n²)",      worst: "O(n²)",      space: "O(1)",     inPlace: true,  useCase: "Teaching only — the classic introductory example; not practical for production", intuition: "Repeatedly swaps adjacent out-of-order elements; the largest value 'bubbles' to its final position each pass" },
  cocktail:  { best: "O(n)",       avg: "O(n²)",      worst: "O(n²)",      space: "O(1)",     inPlace: true,  useCase: "Marginal improvement over bubble sort; still only useful as a teaching variant", intuition: "Bidirectional bubble sort — alternates left-to-right and right-to-left passes, pushing the max and min simultaneously" },
  comb:      { best: "O(n log n)", avg: "O(n²/2^p)",  worst: "O(n²)",      space: "O(1)",     inPlace: true,  useCase: "Simple improvement over bubble sort with meaningfully better random-data performance", intuition: "Compares elements at a shrinking gap rather than adjacent pairs — eliminates 'turtles' (small values near the end) that cripple bubble sort" },
  gnome:     { best: "O(n)",       avg: "O(n²)",      worst: "O(n²)",      space: "O(1)",     inPlace: true,  useCase: "Teaching; one of the simplest conceivable sort algorithms to implement from scratch", intuition: "Steps forward until it finds an out-of-order pair, swaps them, steps back one — like insertion sort but moves one step at a time" },
  pancake:   { best: "O(n)",       avg: "O(n²)",      worst: "O(n²)",      space: "O(n)",     inPlace: false, useCase: "Systems where the only primitive is a prefix reversal — robotics, parallel networks", intuition: "Flips prefixes to bring the largest unsorted element to the top, then flips it to its final position — repeat for each element. Each flip allocates a temporary reversed slice." },
  cycle:     { best: "O(n²)",      avg: "O(n²)",      worst: "O(n²)",      space: "O(1)",     inPlace: true,  useCase: "When minimizing writes is critical — each element is moved to its final position at most once", intuition: "Decomposes the permutation into disjoint cycles; rotates each cycle so every element lands exactly in its correct slot in one write" },
  oddeven:   { best: "O(n)",       avg: "O(n²)",      worst: "O(n²)",      space: "O(1)",     inPlace: true,  useCase: "Parallel architectures where odd and even index pairs can be compared simultaneously on separate processors", intuition: "Alternates between odd-indexed and even-indexed adjacent swaps — equivalent to bubble sort but designed to parallelise across processors" },
};

// ── AlgoTooltip wrapper ───────────────────────────────────────────────────────
// Wraps any inline element; shows a compact info card after a short hover delay.

function WithAlgoTooltip({ id, children }: { id: string; children: React.ReactNode }) {
  const info = ALGO_INFO[id] ?? (id === "timsort-js" ? ALGO_INFO["timsort"] : null);
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapRef = useRef<HTMLSpanElement>(null);

  if (!info) return <>{children}</>;

  const show = () => {
    timerRef.current = setTimeout(() => {
      if (!wrapRef.current) return;
      const r = wrapRef.current.getBoundingClientRect();
      const x = Math.min(r.left, (typeof window !== "undefined" ? window.innerWidth : 800) - 268);
      const y = r.bottom + 6;
      setPos({ x, y });
      setVisible(true);
    }, 280);
  };
  const hide = () => { if (timerRef.current) clearTimeout(timerRef.current); setVisible(false); };

  const color = ALGO_COLORS[id] ?? "#888";
  const stable = ALGO_STABLE[id];

  return (
    <span ref={wrapRef} onMouseEnter={show} onMouseLeave={hide} style={{ cursor: "default" }}>
      {children}
      {visible && (
        <span
          onMouseEnter={() => { if (timerRef.current) clearTimeout(timerRef.current); setVisible(true); }}
          onMouseLeave={hide}
          style={{
            position: "fixed", left: pos.x, top: pos.y, zIndex: 9999,
            width: 260, pointerEvents: "auto",
            background: "var(--color-surface-2)",
            border: `1px solid ${color}55`,
            borderRadius: 10, padding: "10px 12px",
            boxShadow: "0 4px 24px rgba(0,0,0,0.35)",
            fontFamily: "monospace",
          }}
        >
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--color-text)" }}>
              {ALGO_NAMES[id] ?? id}
            </span>
            <span style={{ marginLeft: "auto", fontSize: 8, padding: "1px 5px", borderRadius: 4,
              background: stable ? "rgba(78,160,90,0.15)" : "rgba(200,100,50,0.15)",
              color: stable ? "#7ec88a" : "#e0945a",
              border: `1px solid ${stable ? "rgba(78,160,90,0.3)" : "rgba(200,100,50,0.3)"}`,
            }}>
              {stable ? "stable" : "unstable"}
            </span>
            <span style={{ fontSize: 8, padding: "1px 5px", borderRadius: 4,
              background: info.inPlace ? "rgba(100,181,246,0.12)" : "rgba(180,100,200,0.12)",
              color: info.inPlace ? "#64b5f6" : "#ce93d8",
              border: `1px solid ${info.inPlace ? "rgba(100,181,246,0.25)" : "rgba(180,100,200,0.25)"}`,
            }}>
              {info.inPlace ? "in-place" : `${info.space} space`}
            </span>
          </div>

          {/* Time complexity grid */}
          <div style={{ fontSize: 8, color: "var(--color-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 3 }}>Time</div>
          <div style={{ display: "grid", gridTemplateColumns: "36px 1fr", gap: "2px 6px", marginBottom: 8, fontSize: 9 }}>
            {([["best", info.best], ["avg", info.avg], ["worst", info.worst]] as [string, string][]).map(([label, val]) => (
              <React.Fragment key={label}>
                <span style={{ color: "var(--color-muted)", textAlign: "right" }}>{label}</span>
                <span style={{ color: label === "worst" && info.worst.includes("n²") ? "#ef9a9a" : label === "best" && info.best === "O(n)" ? "#a5d6a7" : "var(--color-text)", fontWeight: 600 }}>{val}</span>
              </React.Fragment>
            ))}
          </div>

          {/* Space complexity grid */}
          <div style={{ fontSize: 8, color: "var(--color-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 3 }}>Space</div>
          <div style={{ display: "grid", gridTemplateColumns: "36px 1fr", gap: "2px 6px", marginBottom: 8, fontSize: 9 }}>
            <span style={{ color: "var(--color-muted)", textAlign: "right" }}>aux</span>
            <span style={{ color: info.space === "O(1)" ? "#a5d6a7" : info.space === "O(n)" || info.space === "O(n+k)" ? "#ef9a9a" : "var(--color-text)", fontWeight: 600 }}>{info.space}</span>
          </div>

          {/* Intuition */}
          <p style={{ fontSize: 9, color: "var(--color-text)", lineHeight: 1.5, marginBottom: 6, borderTop: "1px solid var(--color-border)", paddingTop: 6 }}>
            {info.intuition}
          </p>

          {/* Use case */}
          <p style={{ fontSize: 9, color: "var(--color-muted)", lineHeight: 1.4, fontStyle: "italic" }}>
            ✦ {info.useCase}
          </p>
        </span>
      )}
    </span>
  );
}

function fmtN(n: number): string {
  const fmt = (v: number) => {
    if (v % 1 === 0) return v.toFixed(0);                          // exact integer → no decimals
    const s = v.toPrecision(3);
    return s.includes(".") ? s.replace(/\.?0+$/, "") : s;         // strip trailing decimal zeros only
  };
  if (n >= 1_000_000_000) return `${fmt(n / 1_000_000_000)}B`;
  if (n >= 1_000_000)     return `${fmt(n / 1_000_000)}M`;
  if (n >= 1_000)         return `${fmt(n / 1_000)}k`;
  return String(n);
}

function fmtTime(ms: number): string {
  if (ms < 0.1)   return `${(ms * 1_000).toFixed(0)} μs`;
  if (ms < 10)    return `${ms.toFixed(3)} ms`;
  if (ms < 1_000) return `${ms.toFixed(1)} ms`;
  return `${(ms / 1_000).toFixed(2)} s`;
}

// Compact formatter for Big-O predicted values — handles huge O(n²) magnitudes
function fmtPredicted(ms: number): string {
  if (ms < 1)           return `${(ms * 1_000).toFixed(0)}μs`;
  if (ms < 1_000)       return `${ms.toFixed(1)}ms`;
  if (ms < 60_000)      return `${(ms / 1_000).toFixed(1)}s`;
  if (ms < 3_600_000)   return `${(ms / 60_000).toFixed(1)}min`;
  if (ms < 86_400_000)  return `${(ms / 3_600_000).toFixed(1)}hr`;
  return `${(ms / 86_400_000).toFixed(0)}d`;
}

function fmtBytes(b: number): string {
  if (b <= 0)           return "0 B";
  if (b < 1_024)        return `${b.toFixed(0)} B`;
  if (b < 1_048_576)    return `${(b / 1_024).toFixed(1)} KB`;
  return `${(b / 1_048_576).toFixed(1)} MB`;
}

// ── Spinner ───────────────────────────────────────────────────────────────────

function Spinner({ value, onChange, min, max, label }: {
  value: number; onChange: (v: number) => void; min: number; max: number; label: string;
}) {
  const dec = () => onChange(Math.max(min, value - 1));
  const inc = () => onChange(Math.min(max, value + 1));
  const btnStyle = (disabled: boolean): React.CSSProperties => ({
    width: 22, height: 24, display: "flex", alignItems: "center", justifyContent: "center",
    background: "none", border: "none", cursor: disabled ? "not-allowed" : "pointer",
    color: disabled ? "var(--color-border)" : "var(--color-muted)", fontSize: 11, lineHeight: 1,
    flexShrink: 0, userSelect: "none",
  });
  return (
    <div style={{
      display: "inline-flex", alignItems: "center",
      border: "1px solid var(--color-border)", borderRadius: 6,
      background: "var(--color-surface-1)", overflow: "hidden",
    }} aria-label={label}>
      <button onClick={dec} disabled={value <= min} style={btnStyle(value <= min)}>−</button>
      <span style={{ minWidth: 26, textAlign: "center", fontSize: 11, fontFamily: "monospace", color: "var(--color-text)", padding: "0 2px" }}>
        {value}
      </span>
      <button onClick={inc} disabled={value >= max} style={btnStyle(value >= max)}>+</button>
    </div>
  );
}

// ── Scenario presets ──────────────────────────────────────────────────────────
const SCENARIO_PRESETS = [
  { label: "Logos vs Tim Sort", desc: "Head-to-head · random · 10K → 1M", algos: ["logos","timsort"], scenarios: ["random"] as BenchmarkScenario[], sizes: [10_000,100_000,1_000_000], pivot: undefined, gaps: undefined },
  { label: "O(n log n) shootout", desc: "All fast sorts · random · up to 1 M", algos: ["logos","timsort","merge","quick","heap"], scenarios: ["random"] as BenchmarkScenario[], sizes: [1000,10000,100000,500000,1000000], pivot: undefined, gaps: undefined },
  { label: "QuickSort worst case", desc: "First-pivot on sorted input", algos: ["quick","merge","logos"], scenarios: ["nearlySorted"] as BenchmarkScenario[], sizes: [500,1000,5000,10000,50000], pivot: "first" as QuickPivot, gaps: undefined },
  { label: "TimSort advantage", desc: "Nearly-sorted · merge vs insertion vs logos", algos: ["logos","timsort","merge","quick","insertion"], scenarios: ["nearlySorted"] as BenchmarkScenario[], sizes: [1000,10000,100000,500000], pivot: undefined, gaps: undefined },
  { label: "Linear sorts", desc: "Counting / radix vs comparison sorts", algos: ["counting","radix","logos","merge","quick"], scenarios: ["random"] as BenchmarkScenario[], sizes: [10000,100000,500000,1000000], pivot: undefined, gaps: undefined },
  { label: "O(n²) gallery", desc: "Quadratic sorts on small n", algos: ["insertion","selection","bubble","shell"], scenarios: ["random"] as BenchmarkScenario[], sizes: [100,500,1000,2000,5000], pivot: undefined, gaps: undefined },
  { label: "Space hogs", desc: "Memory usage across all complexities", algos: ["merge","timsort","logos","heap","quick","counting"], scenarios: ["random"] as BenchmarkScenario[], sizes: [1000,10000,100000,1000000], pivot: undefined, gaps: undefined },
  { label: "Duplicates stress", desc: "High-duplicate data — TimSort & counting shine", algos: ["logos","timsort","merge","quick","counting","radix"], scenarios: ["duplicates"] as BenchmarkScenario[], sizes: [10000,100000,1000000], pivot: undefined, gaps: undefined },
] as const;


// ── 3-D scatter chart ─────────────────────────────────────────────────────────
// Orthographic projection with interactive orbit + zoom. Axes: X=log(n), Y=log(time), Z=log(space).

type Chart3DPoint = { id: string; n: number; t: number; s: number; x: number; y: number; z: number; work?: number };

// Parse a #rrggbb hex color into {r,g,b}
function parseHex(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace("#", "");
  return { r: parseInt(h.slice(0,2),16), g: parseInt(h.slice(2,4),16), b: parseInt(h.slice(4,6),16) };
}
// Linearly blend two hex colors by t∈[0,1], return rgba string with given alpha
function blendHex(hexA: string, hexB: string, t: number, alpha: number): string {
  const a = parseHex(hexA), b = parseHex(hexB);
  const r = Math.round(a.r + (b.r - a.r) * t);
  const g = Math.round(a.g + (b.g - a.g) * t);
  const bl = Math.round(a.b + (b.b - a.b) * t);
  return `rgba(${r},${g},${bl},${alpha})`;
}
// Add alpha to a #rrggbb hex color
function hexAlpha(hex: string, alpha: number): string {
  const { r, g, b } = parseHex(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ── Memory estimation ─────────────────────────────────────────────────────────

function estimateMemory(alg: string, n: number): { avg: number; peak: number } {
  const ELEMENT_SIZE = 8; // 8 bytes per number (Float64)
  // Handle all logos-custom-N variants like logos
  if (/^logos-custom-\d+$/.test(alg)) {
    return { avg: Math.log2(Math.max(n, 2)) * 64, peak: Math.log2(Math.max(n, 2)) * 128 };
  }
  switch (alg) {
    case "merge":
    case "timsort":
    case "timsort-js":
      return { avg: n * ELEMENT_SIZE, peak: n * ELEMENT_SIZE * 1.5 };
    case "radix":
      return { avg: n * ELEMENT_SIZE * 2, peak: n * ELEMENT_SIZE * 2 };
    case "bucket":
      return { avg: n * ELEMENT_SIZE, peak: n * ELEMENT_SIZE * 1.2 };
    case "quick":
    case "introsort":
    case "logos":
      return { avg: Math.log2(Math.max(n, 2)) * 64, peak: Math.log2(Math.max(n, 2)) * 128 };
    default:
      return { avg: 64, peak: 128 };
  }
}

function fmtMemory(b: number): string {
  if (b < 1_024)     return `${b.toFixed(0)} B`;
  if (b < 1_048_576) return `${(b / 1_024).toFixed(1)} KB`;
  return `${(b / 1_048_576).toFixed(2)} MB`;
}

// ── Memory Flamegraph ─────────────────────────────────────────────────────────
// SVG grouped bar chart: X = benchmark size n (log-scale positions), Y = spaceBytes.
// Each n has one bar group; bars within a group are one per algorithm, side-by-side.

function MemoryFlameGraph({ data, algos }: { data: CurveData; algos: string[] }) {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; algo: string; n: number; bytes: number } | null>(null);

  const VW = 600, VH = 260;
  const pL = 62, pR = 18, pT = 18, pB = 52;
  const iW = VW - pL - pR;
  const iH = VH - pT - pB;

  // Collect all n values that have at least one algo with spaceBytes
  const nSet = new Set<number>();
  for (const id of algos) {
    for (const p of data[id] ?? []) {
      if ((p.spaceBytes ?? 0) > 0) nSet.add(p.n);
    }
  }
  const ns = [...nSet].sort((a, b) => a - b);

  if (ns.length === 0) return (
    <div style={{ height: 200, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-muted)", fontSize: 11 }}>
      Run a benchmark to see space usage data.
    </div>
  );

  // Max spaceBytes across all data points for y-scale
  let maxBytes = 1;
  for (const id of algos) {
    for (const p of data[id] ?? []) {
      if ((p.spaceBytes ?? 0) > maxBytes) maxBytes = p.spaceBytes!;
    }
  }

  // X: log-scale positioning across ns
  const logNs = ns.map(n => Math.log10(Math.max(n, 1)));
  const logMin = logNs[0], logMax = logNs[logNs.length - 1];
  const xAtN = (n: number) => {
    if (ns.length === 1) return pL + iW / 2;
    const t = logMax > logMin ? (Math.log10(Math.max(n, 1)) - logMin) / (logMax - logMin) : 0.5;
    return pL + t * iW;
  };

  const yAt = (v: number) => pT + iH - (v / maxBytes) * iH;

  // Bar layout within each group
  const groupW = ns.length > 1
    ? Math.min(iW / ns.length, 60)
    : 60;
  const barW = Math.max(2, Math.min(groupW * 0.8 / Math.max(algos.length, 1), 16));
  const groupPad = barW * algos.length;

  const yTicks = [0.25, 0.5, 0.75, 1].map(f => ({ v: maxBytes * f, y: yAt(maxBytes * f) }));

  return (
    <div style={{ position: "relative", userSelect: "none" }}>
      <svg
        viewBox={`0 0 ${VW} ${VH}`}
        width="100%"
        style={{ display: "block", overflow: "visible" }}
        onMouseLeave={() => setTooltip(null)}
      >
        {/* Y grid + labels */}
        {yTicks.map(({ v, y }) => (
          <g key={v}>
            <line x1={pL} y1={y} x2={VW - pR} y2={y}
              stroke="rgba(128,128,128,0.12)" strokeWidth={0.8} />
            <text x={pL - 5} y={y + 3.5} textAnchor="end"
              style={{ fontSize: 8, fontFamily: "monospace", fill: "var(--color-muted)" }}>
              {fmtBytes(v)}
            </text>
          </g>
        ))}

        {/* Bars */}
        {ns.map(n => {
          const cx = xAtN(n);
          const totalW = barW * algos.length;
          return (
            <g key={n}>
              {algos.map((id, ai) => {
                const pt = (data[id] ?? []).find(p => p.n === n);
                const bytes = pt?.spaceBytes ?? 0;
                if (bytes <= 0) return null;
                const color = ALGO_COLORS[id] ?? "#888";
                const barH = Math.max((bytes / maxBytes) * iH, 2);
                const bx = cx - totalW / 2 + ai * barW;
                const by = yAt(bytes);
                return (
                  <rect
                    key={id}
                    x={bx} y={by} width={Math.max(barW - 1, 1)} height={barH}
                    fill={color} opacity={0.85} rx={1}
                    style={{ cursor: "pointer" }}
                    onMouseEnter={e => {
                      const svg = (e.target as SVGRectElement).ownerSVGElement!;
                      const rect = svg.getBoundingClientRect();
                      setTooltip({
                        x: (bx + barW / 2) * (rect.width / VW),
                        y: by * (rect.height / VH),
                        algo: ALGO_NAMES[id] ?? id,
                        n,
                        bytes,
                      });
                    }}
                  />
                );
              })}
              {/* X tick */}
              <text x={cx} y={VH - pB + 14} textAnchor="middle"
                style={{ fontSize: 8, fontFamily: "monospace", fill: "var(--color-muted)" }}>
                {fmtN(n)}
              </text>
            </g>
          );
        })}

        {/* Axes */}
        <line x1={pL} y1={pT + iH} x2={VW - pR} y2={pT + iH} stroke="var(--color-border)" strokeWidth={1} />
        <line x1={pL} y1={pT} x2={pL} y2={pT + iH} stroke="var(--color-border)" strokeWidth={1} />

        {/* X-axis label */}
        <text x={pL + iW / 2} y={VH - 3} textAnchor="middle"
          style={{ fontSize: 8, fontFamily: "monospace", fill: "var(--color-muted)", fontStyle: "italic" }}>
          input size (n) — log scale
        </text>

        {/* Y-axis label */}
        <text x={0} y={0} transform={`translate(10, ${pT + iH / 2}) rotate(-90)`}
          textAnchor="middle"
          style={{ fontSize: 8, fontFamily: "monospace", fill: "var(--color-muted)", fontStyle: "italic" }}>
          peak space (bytes)
        </text>

        {/* Legend */}
        {algos.map((id, i) => {
          const color = ALGO_COLORS[id] ?? "#888";
          const lx = pL + i * 90;
          if (lx + 85 > VW) return null;
          return (
            <g key={id}>
              <rect x={lx} y={VH - pB + 28} width={8} height={8} fill={color} opacity={0.85} rx={1} />
              <text x={lx + 11} y={VH - pB + 36}
                style={{ fontSize: 8, fontFamily: "monospace", fill: "var(--color-muted)" }}>
                {(ALGO_NAMES[id] ?? id).replace(" Sort", "").replace("Sort", "")}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Hover tooltip */}
      {tooltip && (
        <div style={{
          position: "absolute",
          left: tooltip.x,
          top: tooltip.y - 8,
          transform: "translate(-50%, -100%)",
          background: "var(--color-surface-1)",
          border: "1px solid var(--color-border)",
          borderRadius: 6,
          padding: "5px 9px",
          fontSize: 10,
          fontFamily: "monospace",
          color: "var(--color-text)",
          pointerEvents: "none",
          whiteSpace: "nowrap",
          zIndex: 10,
        }}>
          <div style={{ fontWeight: 700, marginBottom: 3 }}>{tooltip.algo}</div>
          <div>n = {fmtN(tooltip.n)}</div>
          <div>space = {fmtBytes(tooltip.bytes)}</div>
        </div>
      )}
    </div>
  );
}

// ── Memory bar chart ──────────────────────────────────────────────────────────

function MemoryChart({ algos, n }: { algos: string[]; n: number }) {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; label: string; avg: number; peak: number } | null>(null);

  const VW = 600, VH = 240;
  const pL = 60, pR = 20, pT = 20, pB = 50;
  const iW = VW - pL - pR;
  const iH = VH - pT - pB;

  const data = algos.map(id => ({ id, ...estimateMemory(id, n) }));
  const maxVal = Math.max(...data.map(d => d.peak), 1);

  // Y-axis: 5 gridlines
  const gridLines = 5;
  const yScale = (v: number) => pT + iH - (v / maxVal) * iH;

  const groupW = iW / Math.max(data.length, 1);
  const barW   = Math.min(groupW * 0.35, 28);
  const gap    = Math.min(groupW * 0.05, 4);

  return (
    <div style={{ position: "relative", userSelect: "none" }}>
      <svg
        viewBox={`0 0 ${VW} ${VH}`}
        width="100%"
        style={{ display: "block", overflow: "visible" }}
        onMouseLeave={() => setTooltip(null)}
      >
        {/* Gridlines + Y-axis labels */}
        {Array.from({ length: gridLines + 1 }, (_, i) => {
          const frac = i / gridLines;
          const val  = maxVal * frac;
          const y    = yScale(val);
          return (
            <g key={i}>
              <line x1={pL} y1={y} x2={VW - pR} y2={y}
                stroke="rgba(128,128,128,0.12)" strokeWidth={0.8} />
              <text x={pL - 5} y={y + 3.5} textAnchor="end"
                style={{ fontSize: 8, fontFamily: "monospace", fill: "var(--color-muted)" }}>
                {fmtMemory(val)}
              </text>
            </g>
          );
        })}

        {/* Bars */}
        {data.map((d, gi) => {
          const cx = pL + gi * groupW + groupW / 2;
          const avgX  = cx - barW - gap / 2;
          const peakX = cx + gap / 2;

          const avgH  = Math.max((d.avg  / maxVal) * iH, 1);
          const peakH = Math.max((d.peak / maxVal) * iH, 1);

          const color = ALGO_COLORS[d.id] ?? "#888";

          return (
            <g key={d.id}>
              {/* Average bar */}
              <rect
                x={avgX} y={yScale(d.avg)} width={barW} height={avgH}
                fill={color} opacity={0.85} rx={2}
                onMouseEnter={e => {
                  const svg = (e.target as SVGRectElement).ownerSVGElement!;
                  const rect = svg.getBoundingClientRect();
                  const svgW = rect.width;
                  const scaleX = svgW / VW;
                  setTooltip({ x: (avgX + barW / 2) * scaleX, y: yScale(d.avg) * (rect.height / VH), label: ALGO_NAMES[d.id] ?? d.id, avg: d.avg, peak: d.peak });
                }}
                style={{ cursor: "pointer" }}
              />
              {/* Peak bar */}
              <rect
                x={peakX} y={yScale(d.peak)} width={barW} height={peakH}
                fill={color} opacity={0.38} rx={2}
                onMouseEnter={e => {
                  const svg = (e.target as SVGRectElement).ownerSVGElement!;
                  const rect = svg.getBoundingClientRect();
                  const svgW = rect.width;
                  const scaleX = svgW / VW;
                  setTooltip({ x: (peakX + barW / 2) * scaleX, y: yScale(d.peak) * (rect.height / VH), label: ALGO_NAMES[d.id] ?? d.id, avg: d.avg, peak: d.peak });
                }}
                style={{ cursor: "pointer" }}
              />
              {/* X-axis label */}
              <text
                x={cx} y={VH - pB + 14} textAnchor="middle"
                style={{ fontSize: 8, fontFamily: "monospace", fill: "var(--color-muted)" }}
              >
                {(ALGO_NAMES[d.id] ?? d.id).replace(" Sort", "").replace("Sort", "")}
              </text>
            </g>
          );
        })}

        {/* X axis line */}
        <line x1={pL} y1={pT + iH} x2={VW - pR} y2={pT + iH}
          stroke="var(--color-border)" strokeWidth={1} />
        {/* Y axis line */}
        <line x1={pL} y1={pT} x2={pL} y2={pT + iH}
          stroke="var(--color-border)" strokeWidth={1} />

        {/* Legend */}
        <rect x={pL} y={VH - pB + 30} width={10} height={8} fill="var(--color-accent)" opacity={0.85} rx={1} />
        <text x={pL + 13} y={VH - pB + 38} style={{ fontSize: 8, fontFamily: "monospace", fill: "var(--color-muted)" }}>
          Average
        </text>
        <rect x={pL + 65} y={VH - pB + 30} width={10} height={8} fill="var(--color-accent)" opacity={0.38} rx={1} />
        <text x={pL + 78} y={VH - pB + 38} style={{ fontSize: 8, fontFamily: "monospace", fill: "var(--color-muted)" }}>
          Peak
        </text>
        <text x={VW - pR} y={VH - pB + 38} textAnchor="end"
          style={{ fontSize: 8, fontFamily: "monospace", fill: "var(--color-muted)", fontStyle: "italic" }}>
          n = {fmtN(n)} · theoretical
        </text>
      </svg>

      {/* Hover tooltip */}
      {tooltip && (
        <div style={{
          position: "absolute",
          left: tooltip.x,
          top: tooltip.y - 8,
          transform: "translate(-50%, -100%)",
          background: "var(--color-surface-1)",
          border: "1px solid var(--color-border)",
          borderRadius: 6,
          padding: "5px 9px",
          fontSize: 10,
          fontFamily: "monospace",
          color: "var(--color-text)",
          pointerEvents: "none",
          whiteSpace: "nowrap",
          zIndex: 10,
        }}>
          <div style={{ fontWeight: 700, marginBottom: 3 }}>{tooltip.label}</div>
          <div>avg:  {fmtMemory(tooltip.avg)}</div>
          <div>peak: {fmtMemory(tooltip.peak)}</div>
        </div>
      )}
    </div>
  );
}

function Chart3D({
  data, algos, highlight,
}: {
  data: Record<string, { n: number; timeMs: number; spaceBytes?: number; timedOut?: boolean }[]>;
  algos: string[];
  highlight: string | null;
}) {
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const [rotX, setRotX]         = useState(28);
  const [rotY, setRotY]         = useState(-40);
  const [zoom, setZoom]         = useState(1.0);
  const [tool, setTool]         = useState<"orbit" | "measure" | "shadows">("measure");
  const [showSurface, setShowSurface] = useState(false);
  const [hoverInfo, setHoverInfo] = useState<(Chart3DPoint & { sx: number; sy: number }) | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; startRx: number; startRy: number } | null>(null);
  const hitRef  = useRef<(Chart3DPoint & { sx: number; sy: number })[]>([]);

  const { pts3d, ranges, workLogMin, workLogMax } = useMemo(() => {
    const raw: { id: string; n: number; t: number; s: number }[] = [];
    for (const id of algos) {
      for (const p of data[id] ?? []) {
        if (!p.timedOut && p.timeMs > 0 && (p.spaceBytes ?? 0) > 0)
          raw.push({ id, n: p.n, t: p.timeMs, s: p.spaceBytes! });
      }
    }
    if (raw.length === 0) return { pts3d: [] as Chart3DPoint[], ranges: null, workLogMin: 0, workLogMax: 1 };

    // Deduplicate: for same (id, n), keep the last measurement
    const seen = new Map<string, typeof raw[number]>();
    for (const p of raw) seen.set(`${p.id}:${p.n}`, p);
    const deduped = [...seen.values()];

    const logNs = deduped.map(p => Math.log10(p.n));
    const logTs = deduped.map(p => Math.log10(p.t));
    const logSs = deduped.map(p => Math.log10(p.s));
    const ranges = {
      n: [Math.min(...logNs), Math.max(...logNs)] as [number, number],
      t: [Math.min(...logTs), Math.max(...logTs)] as [number, number],
      s: [Math.min(...logSs), Math.max(...logSs)] as [number, number],
    };
    const nr = (v: number, [lo, hi]: [number, number]) => hi > lo ? (v - lo) / (hi - lo) : 0.5;

    // Log-log fit per algorithm → cumulative work integral ∫₀ⁿ f(n) dn = a·nᵇ⁺¹/(b+1)
    const fitMap: Record<string, { a: number; b: number } | null> = {};
    for (const id of algos) {
      const pts = deduped.filter(p => p.id === id && p.t > 0 && p.n > 1);
      if (pts.length < 2) { fitMap[id] = null; continue; }
      const xs = pts.map(p => Math.log(p.n)), ys = pts.map(p => Math.log(p.t));
      const m = pts.length;
      const sx = xs.reduce((a, x) => a + x, 0), sy = ys.reduce((a, y) => a + y, 0);
      const sxx = xs.reduce((a, x) => a + x * x, 0), sxy = xs.reduce((a, x, i) => a + x * ys[i], 0);
      const den = m * sxx - sx * sx;
      if (den === 0) { fitMap[id] = null; continue; }
      const b = (m * sxy - sx * sy) / den;
      const a = Math.exp((sy - b * sx) / m);
      fitMap[id] = { a, b };
    }

    // Axis mapping: X(red)=time, Y(green/vertical)=n, Z(blue)=space
    const pts3d: Chart3DPoint[] = deduped.map(p => {
      const fit = fitMap[p.id];
      const work = (fit && fit.b > -1) ? fit.a * Math.pow(p.n, fit.b + 1) / (fit.b + 1) : undefined;
      return { ...p, x: nr(Math.log10(p.t), ranges.t), y: nr(Math.log10(p.n), ranges.n), z: nr(Math.log10(p.s), ranges.s), work };
    });

    const workVals = pts3d.map(p => p.work).filter((w): w is number => w != null && w > 0);
    const workLogMin = workVals.length > 0 ? Math.log10(Math.min(...workVals)) : 0;
    const workLogMax = workVals.length > 0 ? Math.log10(Math.max(...workVals)) : 1;
    return { pts3d, ranges, workLogMin, workLogMax };
  }, [data, algos]);

  const project = useCallback((x: number, y: number, z: number, W: number, H: number): [number, number] => {
    const ryR = rotY * Math.PI / 180, rxR = rotX * Math.PI / 180;
    const px = x - 0.5, py = y - 0.5, pz = z - 0.5;
    const rx1 = px * Math.cos(ryR) + pz * Math.sin(ryR);
    const rz1 = -px * Math.sin(ryR) + pz * Math.cos(ryR);
    const ry2 = py * Math.cos(rxR) - rz1 * Math.sin(rxR);
    const sc = Math.min(W, H) * 0.44 * zoom;
    return [W / 2 + rx1 * sc, H / 2 - ry2 * sc];
  }, [rotX, rotY, zoom]);

  // Compute view-space depth (positive = closer to viewer)
  const viewDepth = useCallback((x: number, y: number, z: number): number => {
    const ryR = rotY * Math.PI / 180, rxR = rotX * Math.PI / 180;
    const px = x - 0.5, py = y - 0.5, pz = z - 0.5;
    const rz1 = -px * Math.sin(ryR) + pz * Math.cos(ryR);
    return py * Math.sin(rxR) + rz1 * Math.cos(rxR);
  }, [rotX, rotY]);

  // Normalise a work value → [0, 1] for visual encoding
  const normWork = useCallback((w: number) =>
    workLogMax > workLogMin ? (Math.log10(w) - workLogMin) / (workLogMax - workLogMin) : 0.5,
  [workLogMin, workLogMax]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !ranges || pts3d.length === 0) return;
    const ctx = canvas.getContext("2d")!;
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    const pr = (x: number, y: number, z: number) => project(x, y, z, W, H);
    const newHits: typeof hitRef.current = [];

    // ── Box wireframe ──────────────────────────────────────────────────────────
    // Standard RGB axis convention: X=red, Y=green, Z=blue
    const AXIS_X = "#ef5350", AXIS_Y = "#66bb6a", AXIS_Z = "#64b5f6";
    const boxEdges: [number,number,number,number,number,number][] = [
      [1,0,0,1,1,0],[1,0,0,1,0,1],[0,1,0,1,1,0],
      [0,1,0,0,1,1],[1,1,0,1,1,1],[0,0,1,1,0,1],
      [0,0,1,0,1,1],[1,0,1,1,1,1],[0,1,1,1,1,1],
    ];
    ctx.strokeStyle = "rgba(128,128,128,0.15)"; ctx.lineWidth = 0.5;
    for (const [x0,y0,z0,x1,y1,z1] of boxEdges) {
      const [ax,ay] = pr(x0,y0,z0); const [bx,by] = pr(x1,y1,z1);
      ctx.beginPath(); ctx.moveTo(ax,ay); ctx.lineTo(bx,by); ctx.stroke();
    }
    // Origin axes — drawn thicker with standard RGB colours
    const originAxes: [string, number,number,number, number,number,number][] = [
      [AXIS_X, 0,0,0, 1,0,0],
      [AXIS_Y, 0,0,0, 0,1,0],
      [AXIS_Z, 0,0,0, 0,0,1],
    ];
    for (const [color, x0,y0,z0, x1,y1,z1] of originAxes) {
      const [ax,ay] = pr(x0,y0,z0); const [bx,by] = pr(x1,y1,z1);
      ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.7;
      ctx.beginPath(); ctx.moveTo(ax,ay); ctx.lineTo(bx,by); ctx.stroke();
      // Arrowhead
      const angle = Math.atan2(by - ay, bx - ax);
      const AL = 7, AW = 3;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(bx - AL * Math.cos(angle - AW / AL), by - AL * Math.sin(angle - AW / AL));
      ctx.lineTo(bx - AL * Math.cos(angle + AW / AL), by - AL * Math.sin(angle + AW / AL));
      ctx.closePath(); ctx.fill();
      ctx.globalAlpha = 1;
    }
    // Axis labels at tips  (X=time/red, Y=n/green vertical, Z=space/blue)
    ctx.font = "bold 12px monospace";
    ctx.globalAlpha = 0.9;
    { const [lx,ly] = pr(1,0,0); ctx.fillStyle = AXIS_X; ctx.fillText("time →", lx + 5, ly + 4); }
    { const [lx,ly] = pr(0,1,0); ctx.fillStyle = AXIS_Y; ctx.fillText("n ↑", lx + 4, ly - 5); }
    { const [lx,ly] = pr(0,0,1); ctx.fillStyle = AXIS_Z; ctx.fillText("space", lx + 4, ly + 4); }
    ctx.globalAlpha = 1; ctx.lineWidth = 0.5;

    // ── Base grid ─────────────────────────────────────────────────────────────
    ctx.strokeStyle = "rgba(128,128,128,0.08)"; ctx.lineWidth = 0.5;
    for (let i = 0; i <= 4; i++) {
      const t = i / 4;
      let [ax,ay] = pr(t,0,0); let [bx,by] = pr(t,0,1);
      ctx.beginPath(); ctx.moveTo(ax,ay); ctx.lineTo(bx,by); ctx.stroke();
      [ax,ay] = pr(0,0,t); [bx,by] = pr(1,0,t);
      ctx.beginPath(); ctx.moveTo(ax,ay); ctx.lineTo(bx,by); ctx.stroke();
    }

    // ── Surface curtains — per-algo vertical ribbons dropping to y=0 ──────────
    // For each algorithm, for each consecutive n-pair, draw a quad:
    //   top-left  : actual data point (x, y, z)
    //   bottom-left: floor projection (x, 0, z)
    //   bottom-right: next floor (x', 0, z')
    //   top-right : next data point (x', y', z')
    // Painter's algorithm across all quads from all algos.
    if (showSurface && pts3d.length > 0) {
      type CurtainQuad = { depth: number; pts: [number,number][]; color: string };
      const quads: CurtainQuad[] = [];

      for (const id of algos) {
        const color = ALGO_COLORS[id] ?? "#888";
        const sorted = pts3d.filter(p => p.id === id).sort((a, b) => a.n - b.n);
        for (let ni = 0; ni < sorted.length - 1; ni++) {
          const p0 = sorted[ni], p1 = sorted[ni + 1];
          // top-left, bottom-left, bottom-right, top-right
          const [xtl, ytl] = pr(p0.x, p0.y, p0.z);
          const [xbl, ybl] = pr(p0.x, 0,    p0.z);
          const [xbr, ybr] = pr(p1.x, 0,    p1.z);
          const [xtr, ytr] = pr(p1.x, p1.y, p1.z);
          const depth = (
            viewDepth(p0.x, p0.y, p0.z) + viewDepth(p0.x, 0, p0.z) +
            viewDepth(p1.x, 0,    p1.z) + viewDepth(p1.x, p1.y, p1.z)
          ) / 4;
          quads.push({ depth, pts: [[xtl,ytl],[xbl,ybl],[xbr,ybr],[xtr,ytr]], color });
        }
      }

      // Painter's algorithm: farthest first
      quads.sort((a, b) => a.depth - b.depth);

      const SURFACE_ALPHA = highlight ? 0.22 : 0.42;
      for (const q of quads) {
        const [[x0,y0],[x1,y1],[x2,y2],[x3,y3]] = q.pts;
        // Vertical gradient: brighter at top (data curve), dimmer at floor
        const gradLen = Math.hypot((x0+x3)/2 - (x1+x2)/2, (y0+y3)/2 - (y1+y2)/2);
        if (gradLen > 0.5) {
          const grad = ctx.createLinearGradient((x0+x3)/2, (y0+y3)/2, (x1+x2)/2, (y1+y2)/2);
          grad.addColorStop(0, hexAlpha(q.color, SURFACE_ALPHA));
          grad.addColorStop(1, hexAlpha(q.color, SURFACE_ALPHA * 0.3));
          ctx.fillStyle = grad;
        } else {
          ctx.fillStyle = hexAlpha(q.color, SURFACE_ALPHA);
        }
        ctx.beginPath();
        ctx.moveTo(x0, y0); ctx.lineTo(x1, y1);
        ctx.lineTo(x2, y2); ctx.lineTo(x3, y3);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = hexAlpha(q.color, 0.12); ctx.lineWidth = 0.3;
        ctx.stroke();
      }
    }

    // ── Axis tick labels (X=time/red, Y=n/green, Z=space/blue) ───────────────
    ctx.font = "9px monospace";
    const TICKS = 4;
    for (let i = 0; i <= TICKS; i++) {
      const t = i / TICKS;
      // X axis ticks (time)
      const [tx2,ty2] = pr(t,0,0);
      ctx.fillStyle = "#ff0000"; ctx.globalAlpha = 0.7;
      ctx.fillText(fmtTime(Math.pow(10, ranges.t[0] + t*(ranges.t[1]-ranges.t[0]))), tx2-16, ty2+12);
      // Y axis ticks (n)
      const [nx,ny] = pr(0,t,0);
      ctx.fillStyle = "#00cc44";
      ctx.fillText(fmtN(Math.pow(10, ranges.n[0] + t*(ranges.n[1]-ranges.n[0]))), nx-34, ny+4);
      // Z axis ticks (space)
      const [sx2,sy2] = pr(0,0,t);
      ctx.fillStyle = "#4488ff";
      ctx.fillText(fmtBytes(Math.pow(10, ranges.s[0] + t*(ranges.s[1]-ranges.s[0]))), sx2+5, sy2+3);
    }
    ctx.globalAlpha = 1;

    // ── Algorithm curves + dots (drawn over the surface) ──────────────────────
    for (const id of algos) {
      const isHl = !highlight || highlight === id;
      const color = ALGO_COLORS[id] ?? "#888";
      const sorted = pts3d.filter(p => p.id === id).sort((a, b) => a.n - b.n);
      if (sorted.length === 0) continue;

      // Shadow projection on base plane
      if (tool === "shadows") {
        ctx.strokeStyle = color; ctx.lineWidth = 0.8;
        ctx.globalAlpha = isHl ? 0.22 : 0.06; ctx.setLineDash([3,3]);
        ctx.beginPath();
        sorted.forEach((p, i) => { const [px,py] = pr(p.x,0,p.z); i===0?ctx.moveTo(px,py):ctx.lineTo(px,py); });
        ctx.stroke();
        ctx.setLineDash([]); ctx.globalAlpha = 1;
        ctx.strokeStyle = color; ctx.lineWidth = 0.4; ctx.globalAlpha = isHl ? 0.15 : 0.04;
        for (const p of sorted) {
          const [px,py] = pr(p.x,p.y,p.z); const [bx,by] = pr(p.x,0,p.z);
          ctx.beginPath(); ctx.moveTo(px,py); ctx.lineTo(bx,by); ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }

      // Vertical drop lines: each data point → floor (y=0), always shown
      ctx.globalAlpha = isHl ? 0.35 : 0.08;
      for (const p of sorted) {
        const [px, py] = pr(p.x, p.y, p.z);
        const [fx, fy] = pr(p.x, 0,    p.z);
        ctx.strokeStyle = color; ctx.lineWidth = 0.7;
        ctx.setLineDash([2, 3]);
        ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(fx, fy); ctx.stroke();
        // Floor dot
        ctx.fillStyle = color;
        ctx.beginPath(); ctx.arc(fx, fy, 1.5, 0, Math.PI * 2); ctx.fill();
      }
      ctx.setLineDash([]); ctx.globalAlpha = 1;

      // Cumulative-work rings on floor — circle radius ∝ ∫f dn at each n
      for (const p of sorted) {
        if (p.work == null) continue;
        const [fx, fy] = pr(p.x, 0, p.z);
        const ringR = 3 + normWork(p.work) * 9;
        ctx.globalAlpha = isHl ? 0.28 : 0.06;
        ctx.strokeStyle = color; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(fx, fy, ringR, 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha = 1;
      }

      // Curve line — brighter when surface is shown so it reads above the mesh
      ctx.strokeStyle = color;
      ctx.lineWidth = isHl ? (showSurface ? 2.2 : 1.8) : 0.8;
      ctx.globalAlpha = isHl ? 1 : 0.2;
      ctx.beginPath();
      sorted.forEach((p, i) => { const [px,py] = pr(p.x,p.y,p.z); i===0?ctx.moveTo(px,py):ctx.lineTo(px,py); });
      ctx.stroke(); ctx.globalAlpha = 1;

      // Dots — radius encodes cumulative work (larger = more work done up to that n)
      for (const p of sorted) {
        const [px,py] = pr(p.x,p.y,p.z);
        const baseR = isHl ? 2.5 : 1.5;
        const r = p.work != null ? baseR + normWork(p.work) * (isHl ? 5 : 2) : baseR;
        ctx.fillStyle = color; ctx.globalAlpha = isHl ? 1 : 0.25;
        ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI*2); ctx.fill();
        // White outline on dots so they pop over surface
        if (isHl && showSurface) {
          ctx.strokeStyle = "rgba(255,255,255,0.5)"; ctx.lineWidth = 0.8;
          ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI*2); ctx.stroke();
        }
        ctx.globalAlpha = 1;
        newHits.push({ ...p, sx: px, sy: py });
      }
    }

    // ── Measure tooltip ────────────────────────────────────────────────────────
    if (hoverInfo && tool === "measure") {
      const { sx, sy, id, n, t, s, work } = hoverInfo;
      ctx.strokeStyle = "#fff"; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(sx, sy, 7, 0, Math.PI*2); ctx.stroke();
      const fmtWork = (w: number) => w >= 1000 ? `${(w/1000).toFixed(2)}s·n` : `${w.toFixed(2)}ms·n`;
      const lines = [
        ALGO_NAMES[id] ?? id,
        `n = ${fmtN(n)}`,
        `t = ${fmtTime(t)}`,
        `s = ${fmtBytes(s)}`,
        ...(work != null ? [`∫ = ${fmtWork(work)}`] : []),
      ];
      const LINE_H = 16, PAD = 10;
      const bW = 160, bH = lines.length * LINE_H + PAD * 1.5;
      const bx = Math.min(sx + 14, W - bW - 4), by = Math.max(sy - bH - 10, 4);
      ctx.fillStyle = "rgba(10,10,10,0.94)";
      ctx.strokeStyle = "rgba(255,255,255,0.18)"; ctx.lineWidth = 0.7;
      ctx.beginPath(); ctx.roundRect?.(bx, by, bW, bH, 5) ?? ctx.rect(bx, by, bW, bH);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = ALGO_COLORS[id] ?? "#fff"; ctx.font = "bold 12px monospace";
      ctx.fillText(lines[0], bx + PAD, by + PAD + 8);
      ctx.fillStyle = "#ddd"; ctx.font = "11px monospace";
      lines.slice(1).forEach((line, i) => ctx.fillText(line, bx + PAD, by + PAD + 8 + (i + 1) * LINE_H));
    }

    hitRef.current = newHits;
  }, [pts3d, ranges, rotX, rotY, zoom, highlight, tool, hoverInfo, showSurface, project, viewDepth, normWork]);

  const onMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (tool === "orbit") {
      e.preventDefault(); // block text-selection and scroll while dragging
      dragRef.current = { startX: e.clientX, startY: e.clientY, startRx: rotX, startRy: rotY };
    }
  };
  const onMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (dragRef.current && tool === "orbit") {
      setRotY(dragRef.current.startRy + (e.clientX - dragRef.current.startX) * 0.5);
      setRotX(Math.max(-85, Math.min(85, dragRef.current.startRx - (e.clientY - dragRef.current.startY) * 0.5)));
      return;
    }
    if (tool === "measure") {
      const canvas = canvasRef.current!;
      const rect = canvas.getBoundingClientRect();
      const mx = (e.clientX - rect.left) * (canvas.width / rect.width);
      const my = (e.clientY - rect.top)  * (canvas.height / rect.height);
      let best = null as typeof hitRef.current[0] | null, bestD = Infinity;
      for (const h of hitRef.current) {
        const d = Math.hypot(h.sx - mx, h.sy - my);
        if (d < bestD) { bestD = d; best = h; }
      }
      setHoverInfo(bestD < 22 ? best : null);
    }
  };
  const onMouseUp = () => { dragRef.current = null; };

  // Native wheel listener — React's synthetic onWheel is passive by default so
  // e.preventDefault() is silently ignored and the page scrolls through the chart.
  // Attaching with { passive: false } lets us consume the event.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      setZoom(z => Math.max(0.3, Math.min(4, z * (1 - e.deltaY * 0.0008))));
    };
    canvas.addEventListener("wheel", handler, { passive: false });
    return () => canvas.removeEventListener("wheel", handler);
  }, []);

  // Pinch-to-zoom + single-finger orbit via touch events.
  // touchAction: "none" in CSS tells the browser not to scroll/zoom natively,
  // so e.preventDefault() is not required here, but we call it for safety.
  const pinchDistRef = useRef<number | null>(null);

  const onTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const ts = Array.from(e.touches);
    if (ts.length === 2) {
      // Start of a pinch gesture — record initial distance between fingers
      pinchDistRef.current = Math.hypot(ts[1].clientX - ts[0].clientX, ts[1].clientY - ts[0].clientY);
      dragRef.current = null;
    } else if (ts.length === 1) {
      // Single finger: treat as orbit drag regardless of selected tool
      dragRef.current = { startX: ts[0].clientX, startY: ts[0].clientY, startRx: rotX, startRy: rotY };
      pinchDistRef.current = null;
    }
  };

  const onTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const ts = Array.from(e.touches);
    if (ts.length === 2 && pinchDistRef.current !== null) {
      const dist = Math.hypot(ts[1].clientX - ts[0].clientX, ts[1].clientY - ts[0].clientY);
      const ratio = dist / pinchDistRef.current;
      setZoom(z => Math.max(0.3, Math.min(4, z * ratio)));
      pinchDistRef.current = dist;
    } else if (ts.length === 1 && dragRef.current) {
      const t = ts[0];
      setRotY(dragRef.current.startRy + (t.clientX - dragRef.current.startX) * 0.5);
      setRotX(Math.max(-85, Math.min(85, dragRef.current.startRx - (t.clientY - dragRef.current.startY) * 0.5)));
    }
  };

  const onTouchEnd = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length < 2) pinchDistRef.current = null;
    if (e.touches.length === 0) dragRef.current = null;
  };

  if (!ranges || pts3d.length === 0) return (
    <div style={{ height: 260, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-muted)", fontSize: 11 }}>
      Run a benchmark with time and space data to see the 3D chart.
    </div>
  );

  return (
    <div>
      <div style={{ display: "flex", gap: 5, marginBottom: 8, alignItems: "center", flexWrap: "wrap" }}>
        {([
          { id: "measure", label: "⊕ Measure",  title: "Hover over a point to inspect its n / time / space values" },
          { id: "orbit"  , label: "⟳ Orbit",   title: "Drag to orbit · scroll to zoom" },
          { id: "shadows", label: "⇓ Shadows",  title: "Show base-plane projections: each algorithm's curve projected onto the n–space floor" },
        ] as const).map(tb => (
          <button key={tb.id} onClick={() => setTool(tb.id)} title={tb.title} style={{
            padding: "2px 8px", fontSize: 9, borderRadius: 4, cursor: "pointer",
            background: tool === tb.id ? "var(--color-accent)" : "var(--color-surface-1)",
            border: `1px solid ${tool === tb.id ? "var(--color-accent)" : "var(--color-border)"}`,
            color: tool === tb.id ? "#fff" : "var(--color-muted)",
          }}>{tb.label}</button>
        ))}
        {/* Surface toggle */}
        <button
          onClick={() => setShowSurface(s => !s)}
          title="Toggle vertical curtains — each algorithm's curve drops a filled ribbon down to the time-axis floor"
          style={{
            padding: "2px 8px", fontSize: 9, borderRadius: 4, cursor: "pointer",
            background: showSurface ? "rgba(100,181,246,0.15)" : "var(--color-surface-1)",
            border: `1px solid ${showSurface ? "#64b5f6" : "var(--color-border)"}`,
            color: showSurface ? "#64b5f6" : "var(--color-muted)",
          }}
        >
          ⬡ Surface
        </button>
        <button onClick={() => { setRotX(28); setRotY(-40); setZoom(1); }} style={{
          padding: "2px 8px", fontSize: 9, borderRadius: 4, cursor: "pointer",
          background: "var(--color-surface-1)", border: "1px solid var(--color-border)", color: "var(--color-muted)",
        }}>⟲ Reset</button>
        <button onClick={() => {
          const c = canvasRef.current; if (!c) return;
          const a = document.createElement("a");
          a.href = c.toDataURL("image/png");
          a.download = "benchmark-3d.png";
          a.click();
        }} style={{
          padding: "2px 8px", fontSize: 9, borderRadius: 4, cursor: "pointer",
          background: "var(--color-surface-1)", border: "1px solid var(--color-border)", color: "var(--color-muted)",
        }}>↓ PNG</button>
        <span style={{ fontSize: 8, marginLeft: "auto", fontFamily: "monospace" }}>
          <span style={{ color: "#ef5350" }}>X=time</span>
          {" · "}
          <span style={{ color: "#66bb6a" }}>Y=n</span>
          {" · "}
          <span style={{ color: "#64b5f6" }}>Z=space</span>
          <span style={{ color: "var(--color-muted)" }}> (log₁₀) · dot size &amp; ring = ∫f dn cumulative work</span>
        </span>
      </div>
      <canvas
        ref={canvasRef} width={800} height={307}
        style={{ width: "100%", height: "auto", aspectRatio: "800 / 307", display: "block",
          touchAction: "none", userSelect: "none",
          cursor: tool === "orbit" ? (dragRef.current ? "grabbing" : "grab") : tool === "measure" ? (hoverInfo ? "pointer" : "crosshair") : "default" }}
        onMouseDown={onMouseDown} onMouseMove={onMouseMove}
        onMouseUp={onMouseUp} onMouseLeave={() => { dragRef.current = null; setHoverInfo(null); }}
        onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
        onDragStart={e => e.preventDefault()}
      />
      {/* Curtain hint */}
      {showSurface && (
        <p style={{ fontSize: 8, color: "var(--color-muted)", fontFamily: "monospace", marginTop: 4 }}>
          curtains drop to the n-axis floor · rings on the floor = ∫f dn (larger = more cumulative work) · use ⊕ Measure to inspect any point
        </p>
      )}
    </div>
  );
}

// ── Mathematical properties panel ──────────────────────────────────────────────
// Shows fitted equation, derivative (marginal cost), and cumulative work integral per algorithm.

function MathPanel({
  data, algos, mode,
}: {
  data: Record<string, { n: number; timeMs: number; spaceBytes?: number; timedOut?: boolean }[]>;
  algos: string[];
  mode: "time" | "space";
}) {
  const [openIds, setOpenIds] = useState<Set<string>>(new Set(algos));
  const toggle = (id: string) => setOpenIds(prev => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next;
  });

  const fmtVal  = mode === "time" ? fmtTime : fmtBytes;
  const fmtDeriv = (v: number) => mode === "time"
    ? `${(v * 1e6).toFixed(2)} ns/elem`
    : `${v.toFixed(2)} B/elem`;
  const fmtInteg = (v: number) => mode === "time"
    ? `${v.toFixed(3)} ms·n`
    : `${fmtBytes(v)}·n`;

  const analyses = algos.flatMap(id => {
    const pts = (data[id] ?? []).filter(p => !p.timedOut);
    const raw = mode === "time"
      ? pts.filter(p => p.timeMs > 0).map(p => ({ n: p.n, val: p.timeMs }))
      : pts.filter(p => (p.spaceBytes ?? 0) > 0).map(p => ({ n: p.n, val: p.spaceBytes! }));
    const fit = fitLogLog(raw);
    if (!fit) return [];
    // R² in log-log space
    const logPts = raw.map(p => ({ x: Math.log(p.n), y: Math.log(p.val) }));
    const meanY  = logPts.reduce((s, p) => s + p.y, 0) / logPts.length;
    const ssTot  = logPts.reduce((s, p) => s + (p.y - meanY) ** 2, 0);
    const logA   = Math.log(fit.k);
    const ssRes  = logPts.reduce((s, p) => s + (p.y - (logA + fit.exp * p.x)) ** 2, 0);
    const r2     = ssTot > 0 ? Math.max(0, 1 - ssRes / ssTot) : 1;
    return [{ id, fit, raw, r2 }];
  });

  if (analyses.length === 0) return null;

  return (
    <div style={{ marginTop: 14, paddingTop: 10, borderTop: "1px solid var(--color-border)" }}>
      <p style={{ fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--color-muted)", marginBottom: 8 }}>
        Mathematical analysis — {mode} complexity
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {analyses.map(({ id, fit, raw, r2 }) => {
          const { k: a, exp: b, fn } = fit;
          const deriv   = (n: number) => a * b * Math.pow(n, b - 1);        // f′(n)
          const integral = (n: number) => a * Math.pow(n, b + 1) / (b + 1); // ∫₀ⁿ f dx
          const dotColor = ALGO_COLORS[id] ?? "#888";
          const isOpen   = openIds.has(id);
          return (
            <div key={id} style={{ background: "var(--color-surface-1)", borderRadius: 6, border: "1px solid var(--color-border)", overflow: "hidden" }}>
              <button onClick={() => toggle(id)} style={{
                width: "100%", display: "flex", alignItems: "center", gap: 6,
                padding: "5px 8px", background: "none", border: "none", cursor: "pointer", textAlign: "left",
              }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: dotColor, flexShrink: 0 }} />
                <span style={{ fontSize: 10, fontWeight: 600, color: "var(--color-text)", flex: 1 }}>{ALGO_NAMES[id]}</span>
                <span style={{ fontSize: 9, fontFamily: "monospace", color: dotColor }}>{fit.label}</span>
                <span style={{ fontSize: 8, fontFamily: "monospace", color: "var(--color-muted)", marginLeft: 4 }}>R²={r2.toFixed(3)}</span>
                <ChevronRight size={10} style={{ transform: isOpen ? "rotate(90deg)" : "none", transition: "transform 0.15s", color: "var(--color-muted)", flexShrink: 0 }} />
              </button>
              {isOpen && (
                <div style={{ padding: "6px 10px 10px", borderTop: "1px solid var(--color-border)" }}>
                  {/* Equations */}
                  <div style={{ fontFamily: "monospace", fontSize: 9, color: "var(--color-muted)", marginBottom: 8, display: "flex", flexDirection: "column", gap: 3 }}>
                    <div>
                      <span style={{ color: dotColor }}>f(n)</span>
                      {" = "}{a.toExponential(3)} · n^{b.toFixed(4)} {mode === "time" ? "ms" : "bytes"}
                    </div>
                    <div>
                      <span style={{ color: dotColor }}>f′(n)</span>
                      {" = "}{(a * b).toExponential(3)} · n^{(b - 1).toFixed(4)}
                      <span style={{ opacity: 0.6 }}> ← marginal cost per element added</span>
                    </div>
                    <div>
                      <span style={{ color: dotColor }}>∫f dn</span>
                      {" = "}{a.toExponential(3)} · n^{(b + 1).toFixed(4)} / {(b + 1).toFixed(3)}
                      <span style={{ opacity: 0.6 }}> ← cumulative work</span>
                    </div>
                  </div>
                  {/* Data table */}
                  <table style={{ fontSize: 8, fontFamily: "monospace", borderCollapse: "collapse", width: "100%" }}>
                    <thead>
                      <tr style={{ color: "var(--color-muted)" }}>
                        {["n", "measured", "f(n) fit", "f′(n)", "∫f dn", "Δ fit"].map(h => (
                          <th key={h} style={{ textAlign: h === "n" ? "left" : "right", padding: "2px 5px", borderBottom: "1px solid var(--color-border)", fontWeight: 400 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {raw.map(p => {
                        const pred = a * fn(p.n);
                        const pct  = pred > 0 ? ((p.val - pred) / pred) * 100 : 0;
                        return (
                          <tr key={p.n}>
                            <td style={{ padding: "2px 5px", color: "var(--color-text)" }}>{fmtN(p.n)}</td>
                            <td style={{ padding: "2px 5px", textAlign: "right", color: dotColor }}>{fmtVal(p.val)}</td>
                            <td style={{ padding: "2px 5px", textAlign: "right", color: "var(--color-muted)" }}>{fmtVal(pred)}</td>
                            <td style={{ padding: "2px 5px", textAlign: "right", color: "var(--color-muted)" }}>{fmtDeriv(deriv(p.n))}</td>
                            <td style={{ padding: "2px 5px", textAlign: "right", color: "var(--color-muted)" }}>{fmtInteg(integral(p.n))}</td>
                            <td style={{ padding: "2px 5px", textAlign: "right", color: Math.abs(pct) > 15 ? "var(--color-state-swap)" : "var(--color-muted)" }}>
                              {pct >= 0 ? "+" : ""}{pct.toFixed(1)}%
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  {/* Extrapolation table */}
                  {(() => {
                    const EXTRAP_NS = [1_000_000, 10_000_000, 100_000_000, 1_000_000_000, 10_000_000_000];
                    const lastMeasN = raw[raw.length - 1]?.n ?? 0;
                    const rows = EXTRAP_NS.filter(en => en > lastMeasN);
                    if (rows.length === 0) return null;
                    return (
                      <div style={{ marginTop: 8, paddingTop: 6, borderTop: "1px dashed var(--color-border)" }}>
                        <p style={{ fontSize: 8, color: "var(--color-muted)", marginBottom: 4, fontFamily: "monospace" }}>
                          extrapolation (fitted curve — not measured)
                        </p>
                        <table style={{ fontSize: 8, fontFamily: "monospace", borderCollapse: "collapse", width: "100%" }}>
                          <thead>
                            <tr style={{ color: "var(--color-muted)" }}>
                              {["n", "f(n) est.", "f′(n)", "cumulative"].map(h => (
                                <th key={h} style={{ textAlign: h === "n" ? "left" : "right", padding: "2px 5px", fontWeight: 400 }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {rows.map(en => {
                              const pred = a * fn(en);
                              return (
                                <tr key={en} style={{ opacity: 0.7 }}>
                                  <td style={{ padding: "2px 5px", color: "var(--color-muted)" }}>{fmtN(en)}</td>
                                  <td style={{ padding: "2px 5px", textAlign: "right", color: dotColor }}>{fmtVal(pred)}</td>
                                  <td style={{ padding: "2px 5px", textAlign: "right", color: "var(--color-muted)" }}>{fmtDeriv(deriv(en))}</td>
                                  <td style={{ padding: "2px 5px", textAlign: "right", color: "var(--color-muted)" }}>{fmtInteg(integral(en))}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────

type Status = "idle" | "running" | "done";

// algoId → array of (n, time, space) measurements across different input sizes
type CurvePoint = {
  n: number;
  timeMs: number;       // best post-warmup round (used for ranking)
  meanMs?: number;      // mean of post-warmup rounds
  stdDev?: number;      // std dev of post-warmup rounds (for error bands)
  spaceBytes?: number;  // performance.memory heap delta (often 0 for fast sorts)
  allocBytes?: number;  // instrumented alloc count via measureAllocBytes
  timedOut?: boolean;
};
type CurveData = Record<string, CurvePoint[]>;

interface SummaryResult {
  id: string;
  timeMs: number;
  rank: number;
}

// ── Curve chart ───────────────────────────────────────────────────────────────

// ── Pair matrix ───────────────────────────────────────────────────────────────
// For each pair of algos, shows which is faster at the largest measured n and by
// how much. Rows/cols sorted fastest→slowest so the top-left is always the winner.

function PairMatrixTable({
  sorted,
  title,
  accent,
  getVal,
  fmtTitle,
}: {
  sorted: { id: string; timeMs: number }[];
  title: string;
  accent: string;
  getVal: (row: { id: string; timeMs: number }) => number;
  fmtTitle: (winner: string, loser: string, ratio: number) => string;
}) {
  return (
    <div style={{
      borderRadius: 8,
      border: "1px solid var(--color-border)",
      overflow: "hidden",
      background: "var(--color-surface-0, var(--color-surface-1))",
    }}>
      {/* Header bar */}
      <div style={{
        padding: "6px 10px",
        borderBottom: "1px solid var(--color-border)",
        display: "flex", alignItems: "center", gap: 7,
        background: "var(--color-surface-1)",
      }}>
        <span style={{
          width: 7, height: 7, borderRadius: "50%",
          background: accent, flexShrink: 0, opacity: 0.85,
        }} />
        <span style={{
          fontSize: 9, fontWeight: 700, letterSpacing: "0.06em",
          textTransform: "uppercase", color: "var(--color-text)",
        }}>
          {title}
        </span>
        <span style={{ marginLeft: "auto", fontSize: 8, color: "var(--color-text)", opacity: 0.5, fontFamily: "monospace" }}>
          n = largest · green wins · ratio
        </span>
      </div>

      {/* Scrollable table */}
      <div style={{ overflowX: "auto", padding: "8px 10px 10px" }}>
        <table style={{ borderCollapse: "separate", borderSpacing: 2, fontFamily: "monospace", fontSize: 9 }}>
          <thead>
            <tr>
              <th style={{ width: 88, padding: "0 6px 4px 0", textAlign: "right", color: "var(--color-muted)", fontWeight: 400 }} />
              {sorted.map(col => (
                <th key={col.id} style={{
                  padding: "0 6px 4px", textAlign: "center", minWidth: 52,
                  color: ALGO_COLORS[col.id] ?? "var(--color-muted)",
                  fontWeight: 700, fontSize: 8,
                }}>
                  {(ALGO_NAMES[col.id] ?? col.id).replace(" Sort", "")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => (
              <tr key={row.id}>
                <td style={{
                  padding: "0 8px 0 0", textAlign: "right",
                  color: ALGO_COLORS[row.id] ?? "var(--color-muted)",
                  fontWeight: 700, fontSize: 8, whiteSpace: "nowrap",
                }}>
                  {(ALGO_NAMES[row.id] ?? row.id).replace(" Sort", "")}
                </td>
                {sorted.map((col) => {
                  if (row.id === col.id) {
                    return (
                      <td key={col.id} style={{
                        padding: "3px 6px", textAlign: "center",
                        background: "var(--color-surface-1)",
                        borderRadius: 4,
                        color: "var(--color-border)",
                        fontSize: 10,
                      }}>◆</td>
                    );
                  }
                  const rv = getVal(row), cv = getVal(col);
                  const rowWins = rv < cv;
                  const ratio = rowWins ? cv / rv : rv / cv;
                  const intensity = Math.min(0.75, 0.35 + (ratio - 1) * 0.12);
                  const bg = rowWins
                    ? `rgba(78,160,90,${intensity})`
                    : `rgba(200,70,70,${intensity})`;
                  return (
                    <td key={col.id} style={{
                      padding: "3px 7px", textAlign: "center",
                      background: bg,
                      borderRadius: 4,
                      color: rowWins ? "#0d2e12" : "#2e0a0a",
                      fontWeight: 700,
                      letterSpacing: "0.02em",
                    }}
                      title={fmtTitle(
                        rowWins ? ALGO_NAMES[row.id] : ALGO_NAMES[col.id],
                        rowWins ? ALGO_NAMES[col.id] : ALGO_NAMES[row.id],
                        ratio,
                      )}
                    >
                      {rowWins ? `${ratio.toFixed(1)}×` : `÷${ratio.toFixed(1)}`}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PairMatrix({ results, spaceResults }: {
  results: { id: string; timeMs: number }[];
  spaceResults: { id: string; timeMs: number }[];
}) {
  if (results.length < 2) return null;

  const timeSorted  = [...results].sort((a, b) => a.timeMs - b.timeMs);
  const spaceSorted = spaceResults.length >= 2
    ? [...spaceResults].sort((a, b) => a.timeMs - b.timeMs)
    : null;

  return (
    <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
      <PairMatrixTable
        sorted={timeSorted}
        title="Time — head-to-head"
        accent="#ef5350"
        getVal={r => r.timeMs}
        fmtTitle={(w, l, ratio) => `${w} is ${ratio.toFixed(2)}× faster than ${l}`}
      />
      {spaceSorted && (
        <PairMatrixTable
          sorted={spaceSorted}
          title="Space — head-to-head"
          accent="#64b5f6"
          getVal={r => r.timeMs}
          fmtTitle={(w, l, ratio) => `${w} uses ${ratio.toFixed(2)}× less memory than ${l}`}
        />
      )}
    </div>
  );
}

// ── Live rank panel ──────────────────────────────────────────────────────────
// Shows a compact ranked list of algos at the current hover/pin N, updating live.

function LiveRankPanel({
  data,
  algos,
  n,
  mode,
}: {
  data: CurveData;
  algos: string[];
  n: number | null;
  mode: "time" | "space" | "ratio" | "space-ratio";
}) {
  if (!n) return null;

  const useSpace = mode === "space" || mode === "space-ratio";

  type RankEntry = { id: string; val: number; timedOut: boolean };
  const entries: RankEntry[] = algos.flatMap(id => {
    const pt = (data[id] ?? []).find(p => p.n === n);
    if (!pt) return [];
    const val = useSpace ? (pt.spaceBytes ?? 0) : (pt.meanMs ?? pt.timeMs ?? 0);
    return [{ id, val, timedOut: !!pt.timedOut }];
  });

  const valid = entries.filter(e => !e.timedOut && e.val > 0).sort((a, b) => a.val - b.val);
  const timedOut = entries.filter(e => e.timedOut);
  const fastest = valid[0]?.val ?? 0;

  if (valid.length === 0 && timedOut.length === 0) return null;

  return (
    <div style={{
      marginTop: 6,
      padding: "6px 8px",
      background: "var(--color-surface-1)",
      border: "1px solid var(--color-border)",
      borderRadius: 8,
      fontFamily: "monospace",
      fontSize: 10,
    }}>
      <div style={{ color: "var(--color-muted)", fontSize: 9, marginBottom: 4, letterSpacing: "0.04em" }}>
        RANK AT n={fmtN(n)} — {useSpace ? "space" : "time"}
      </div>
      {valid.map((e, i) => {
        const color = ALGO_COLORS[e.id] ?? "#888";
        const speedup = fastest > 0 && i > 0 ? e.val / fastest : 1;
        const barW = fastest > 0 ? Math.min(100, (e.val / (valid[valid.length - 1]?.val || e.val)) * 100) : 0;
        const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`;
        return (
          <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 2 }}>
            <span style={{ minWidth: 22, textAlign: "right", fontSize: 9, color: "var(--color-muted)" }}>{medal}</span>
            <span style={{ minWidth: 84, color, fontWeight: i < 3 ? 600 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {ALGO_NAMES[e.id] ?? e.id}
            </span>
            {/* bar */}
            <div style={{ flex: 1, height: 5, background: "var(--color-border)", borderRadius: 3, overflow: "hidden", minWidth: 40 }}>
              <div style={{ width: `${barW}%`, height: "100%", background: color, borderRadius: 3, opacity: 0.8 }} />
            </div>
            <span style={{ minWidth: 52, textAlign: "right", color: "var(--color-text)", fontSize: 10 }}>
              {useSpace ? fmtBytes(e.val) : fmtTime(e.val)}
            </span>
            {speedup > 1.005 && (
              <span style={{ minWidth: 40, textAlign: "right", color: "var(--color-muted)", fontSize: 9 }}>
                {speedup.toFixed(1)}×
              </span>
            )}
          </div>
        );
      })}
      {timedOut.map(e => (
        <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 2, opacity: 0.45 }}>
          <span style={{ minWidth: 22, textAlign: "right", fontSize: 9, color: "var(--color-muted)" }}>–</span>
          <span style={{ minWidth: 84, color: ALGO_COLORS[e.id] ?? "#888", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {ALGO_NAMES[e.id] ?? e.id}
          </span>
          <span style={{ color: "var(--color-muted)", fontSize: 9 }}>timed out</span>
        </div>
      ))}
    </div>
  );
}

function CurveChart({
  data,
  sizes,
  algos,
  highlight,
  activeN,
  onNChange,
  mode = "time",
  onExportReady,
}: {
  data: CurveData;
  sizes: number[];
  algos: string[];
  highlight?: string | null;
  activeN?: number | null;
  onNChange?: (n: number | null) => void;
  mode?: "time" | "space" | "ratio" | "space-ratio";
  onExportReady?: (fn: () => void) => void;
}) {
  const [locked, setLocked] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [interactMode, setInteractMode] = useState<"brush" | "zoom">("brush");
  const [yZoom, setYZoom] = useState(1.0);           // <1 = zoomed in on y (lower ceiling)
  const [xRange, setXRange] = useState<[number, number] | null>(null); // size indices
  const [dragStart,  setDragStart]  = useState<number | null>(null);
  const [dragCur,    setDragCur]    = useState<number | null>(null);
  const [dragStartY, setDragStartY] = useState<number | null>(null);
  const [dragCurY,   setDragCurY]   = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [pinnedN, setPinnedN] = useState<number | null>(null);
  const [yLogScale, setYLogScale] = useState(false);
  const [showBigORefs, setShowBigORefs] = useState(true);

  // Expose PNG export to parent
  useEffect(() => {
    if (!onExportReady) return;
    onExportReady(() => {
      const svg = svgRef.current;
      if (!svg) return;
      const computed = getComputedStyle(document.documentElement);
      let s = new XMLSerializer().serializeToString(svg);
      s = s.replace(/var\(--([^)]+)\)/g, (_, name) =>
        computed.getPropertyValue(`--${name.trim()}`).trim() || "#000"
      );
      if (!s) return;
      const scale = 2;
      const canvas = document.createElement("canvas");
      canvas.width = VW * scale;
      canvas.height = VH * scale;
      const ctx = canvas.getContext("2d")!;
      ctx.scale(scale, scale);
      const blob = new Blob([s], { type: "image/svg+xml" });
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, VW, VH);
        URL.revokeObjectURL(url);
        const a = document.createElement("a");
        a.href = canvas.toDataURL("image/png");
        a.download = `benchmark-${mode}.png`;
        a.click();
      };
      img.src = url;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onExportReady]);

  // Reset zoom state when locking
  useEffect(() => { if (locked) { setYZoom(1); setXRange(null); } }, [locked]);
  // Reset x-range when the available sizes change
  useEffect(() => { setXRange(null); }, [sizes]);

  // Non-passive wheel listener — always active, zooms X axis centered on cursor.
  // Ctrl+wheel zooms Y axis instead.
  // Constants VW=600, pL=60, iW=418 are inlined to avoid ordering issues.
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (sizes.length < 2) return;
      e.preventDefault();
      if (!e.ctrlKey) {
        setYZoom(prev => Math.max(0.05, Math.min(1, prev * (e.deltaY > 0 ? 1.18 : 1 / 1.18))));
        return;
      }
      const rect = el.getBoundingClientRect();
      const svgX = (e.clientX - rect.left) * (600 / rect.width);
      const curLo = xRange ? xRange[0] : 0;
      const curHi = xRange ? xRange[1] : sizes.length - 1;
      const curSpan = curHi - curLo;
      const frac = Math.max(0, Math.min(1, (svgX - 60) / 418));
      const factor = e.deltaY > 0 ? 1.35 : 1 / 1.35;
      const newSpan = Math.max(1, Math.min(sizes.length - 1, curSpan * factor));
      const center = curLo + frac * curSpan;
      let newLo = Math.round(center - frac * newSpan);
      let newHi = newLo + Math.round(newSpan);
      if (newLo < 0) { newLo = 0; newHi = Math.min(sizes.length - 1, Math.round(newSpan)); }
      if (newHi >= sizes.length) { newHi = sizes.length - 1; newLo = Math.max(0, newHi - Math.round(newSpan)); }
      if (newLo <= 0 && newHi >= sizes.length - 1) setXRange(null);
      else setXRange([newLo, newHi]);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [sizes, xRange]);

  const VW = 600;
  const VH = 230;
  const pL = 60, pR = 122, pT = 15, pB = 42;
  // Extrapolation zone: 36px (non-expanded) — collapses when expanded since projSizes fill iW
  const extraZoneW = expanded ? 0 : 36;
  const iW = VW - pL - pR;
  const iH = VH - pT - pB;

  const visSizes = xRange ? sizes.slice(xRange[0], xRange[1] + 1) : sizes;

  // Projected sizes: 10 steps from 10× to 100× the last measured n (shown when expanded)
  const _globalLastN = (() => {
    let mx = 0;
    for (const id of algos) {
      const pts = (data[id] ?? []).filter(p => visSizes.includes(p.n) && !p.timedOut);
      if (pts.length) mx = Math.max(mx, Math.max(...pts.map(p => p.n)));
    }
    return mx || (visSizes[visSizes.length - 1] ?? 1000);
  })();
  const projSizes = expanded
    ? Array.from({ length: 10 }, (_, i) => _globalLastN * (i + 1) * 10)
    : [];
  const displaySizes = expanded ? [...visSizes, ...projSizes] : visSizes;

  const xAt = (n: number): number => {
    const idx = displaySizes.indexOf(n);
    if (idx < 0) return pL;
    return displaySizes.length === 1 ? pL + iW / 2 : pL + (idx / (displaySizes.length - 1)) * iW;
  };

  const getValue = (p: CurvePoint) =>
    mode === "space"       ? (p.spaceBytes ?? 0) :
    mode === "ratio"       ? (p.n > 1 ? p.timeMs / (p.n * Math.log2(p.n)) : 0) :
    mode === "space-ratio" ? (p.n > 1 ? (p.spaceBytes ?? 0) / (p.n * Math.log2(p.n)) : 0) :
    p.timeMs;
  const fmtY =
    mode === "space" ? fmtBytes :
    mode === "ratio" ? (v: number) => {
      const ns = v * 1e6;
      if (ns >= 1000) return `${(ns / 1000).toFixed(1)}µs`;
      if (ns >= 0.1)  return `${ns.toFixed(ns >= 10 ? 0 : 1)}ns`;
      return `${(ns * 1000).toFixed(0)}ps`;
    } :
    mode === "space-ratio" ? (v: number) => {
      if (v >= 1)    return `${v.toFixed(1)}B`;
      if (v >= 0.01) return `${(v * 1000).toFixed(0)}mB`;
      return `${(v * 1e6).toFixed(0)}µB`;
    } :
    fmtTime;

  // Pre-compute one fit per algo — reused for y-scale extension and tail drawing.
  // Avoids calling fitLogLog twice per algo per render.
  const extraFits = new Map<string, FitResult | null>(
    algos.map(id => {
      const vp = (data[id] ?? [])
        .filter(p => visSizes.includes(p.n) && !p.timedOut && getValue(p) > 0)
        .sort((a, b) => a.n - b.n);
      const fit = vp.length >= 2
        ? fitLogLog(vp.map(p => ({ n: p.n, val: getValue(p) })))
        : null;
      return [id, fit] as [string, FitResult | null];
    })
  );

  // Include capped extrapolated endpoints so the y-axis actually accommodates the projections.
  // Cap at 4× measured max to prevent O(n²) tails from collapsing the rest of the chart.
  const measuredValues = algos.flatMap(id => (data[id] ?? []).filter(p => visSizes.includes(p.n)).map(getValue));
  const measuredMax    = Math.max(...measuredValues, mode === "space" ? 1 : 0.001);
  const extrapValues: number[] = [];
  for (const id of algos) {
    const fit = extraFits.get(id);
    if (!fit) continue;
    const vp = (data[id] ?? []).filter(p => visSizes.includes(p.n) && !p.timedOut && getValue(p) > 0).sort((a, b) => a.n - b.n);
    if (vp.length < 2) continue;
    if (expanded) {
      // Include all valid projected values — y-axis scales to fit them
      for (const pn of projSizes) {
        const ev = fit.k * fit.fn(pn);
        if (isFinite(ev) && ev > 0) extrapValues.push(ev);
      }
    } else {
      const lastN = vp[vp.length - 1].n;
      const ev    = fit.k * fit.fn(lastN * 4);
      if (isFinite(ev) && ev > 0 && ev <= measuredMax * 4) extrapValues.push(ev);
    }
  }

  const allValues = [...measuredValues, ...extrapValues];
  const rawMaxY   = Math.max(...allValues, mode === "space" ? 1 : 0.001);
  const maxY      = rawMaxY * yZoom;
  const minPosY   = Math.max(1e-9, Math.min(...allValues.filter(v => v > 0), rawMaxY));
  const logMinY   = Math.log10(minPosY * 0.5);
  const logMaxY   = Math.log10(maxY);
  const yAt = (v: number): number => {
    if (!yLogScale || v <= 0) return pT + iH - (v / maxY) * iH;
    const lv = Math.log10(Math.max(v, minPosY * 0.1));
    return pT + iH - ((lv - logMinY) / (logMaxY - logMinY)) * iH;
  };

  // Build y-axis ticks — log: decade ticks; linear: 4 evenly spaced
  const yTicks: { v: number; y: number }[] = yLogScale
    ? (() => {
        const ticks: { v: number; y: number }[] = [];
        for (let e = Math.floor(logMinY); e <= Math.ceil(logMaxY); e++) {
          const v = Math.pow(10, e);
          const y = yAt(v);
          if (y >= pT - 2 && y <= pT + iH + 2) ticks.push({ v, y });
        }
        return ticks;
      })()
    : [0.25, 0.5, 0.75, 1].map(f => ({ v: maxY * f, y: yAt(maxY * f) }));

  const getSvgX = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return ((e.clientX - rect.left) / rect.width) * VW;
  };

  const getSvgY = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return ((e.clientY - rect.top) / rect.height) * VH;
  };

  const snapToSize = (svgX: number) => {
    let best = displaySizes[0], bestDist = Infinity;
    displaySizes.forEach(n => { const d = Math.abs(xAt(n) - svgX); if (d < bestDist) { bestDist = d; best = n; } });
    return best;
  };

  // Effective active n: pinned overrides hover
  const effectiveN = pinnedN ?? activeN;

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const svgX = getSvgX(e);
    if (locked) {
      if (!pinnedN && onNChange && visSizes.length) onNChange(snapToSize(svgX));
      return;
    }
    if (dragStart !== null) {
      setDragCur(svgX);
      if (interactMode === "zoom") setDragCurY(getSvgY(e));
    }
  };

  const handleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!locked) return;
    const svgX = getSvgX(e);
    const n = snapToSize(svgX);
    if (pinnedN === n) {
      setPinnedN(null);
      if (onNChange && visSizes.length) onNChange(n);
    } else {
      setPinnedN(n);
    }
  };

  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if (locked) return;
    e.preventDefault();
    const x = getSvgX(e);
    setDragStart(x); setDragCur(x);
    if (interactMode === "zoom") {
      const y = getSvgY(e);
      setDragStartY(y); setDragCurY(y);
    }
  };

  const clearDrag = () => {
    setDragStart(null); setDragCur(null);
    setDragStartY(null); setDragCurY(null);
  };

  const applyXZoom = (x0: number, x1: number) => {
    if (x1 - x0 <= 8) return;
    const baseStart = xRange?.[0] ?? 0;
    const baseLen   = xRange ? xRange[1] - xRange[0] : sizes.length - 1;
    const f0 = Math.max(0, (x0 - pL) / iW);
    const f1 = Math.min(1, (x1 - pL) / iW);
    const i0 = baseStart + Math.round(f0 * baseLen);
    const i1 = baseStart + Math.round(f1 * baseLen);
    if (i1 > i0) setXRange([i0, Math.min(i1, sizes.length - 1)]);
  };

  const handleMouseUp = () => {
    if (locked || dragStart === null || dragCur === null) { clearDrag(); return; }
    const x0 = Math.min(dragStart, dragCur);
    const x1 = Math.max(dragStart, dragCur);
    if (interactMode === "brush") {
      applyXZoom(x0, x1);
    } else if (dragStartY !== null && dragCurY !== null) {
      // box zoom: zoom x-range + y-range to the selected rectangle
      applyXZoom(x0, x1);
      const y0 = Math.min(dragStartY, dragCurY);
      const y1 = Math.max(dragStartY, dragCurY);
      if (y1 - y0 > 8) {
        // y0 is visually higher = larger value; clamp to data area
        const topVal = Math.max(0, (pT + iH - y0) / iH * maxY);
        if (topVal > 0) setYZoom(prev => Math.max(0.05, (topVal / rawMaxY) * prev));
      }
    }
    clearDrag();
  };

  const selRect = dragStart !== null && dragCur !== null
    ? {
        x: Math.max(pL, Math.min(dragStart, dragCur)),
        w: Math.min(Math.abs(dragCur - dragStart), iW),
        y: interactMode === "zoom" && dragStartY !== null && dragCurY !== null
          ? Math.max(pT, Math.min(dragStartY, dragCurY)) : pT,
        h: interactMode === "zoom" && dragStartY !== null && dragCurY !== null
          ? Math.min(Math.abs(dragCurY - dragStartY), iH) : iH,
      }
    : null;

  const isZoomed = yZoom < 0.99 || xRange !== null;

  // Build sorted bubble data for effectiveN column
  const bubbles = effectiveN != null && visSizes.includes(effectiveN)
    ? algos
        .map(id => ({ id, pt: data[id]?.find(p => p.n === effectiveN) }))
        .filter((x): x is { id: string; pt: CurvePoint } => !!x.pt && !x.pt.timedOut)
        .sort((a, b) => getValue(a.pt) - getValue(b.pt))
    : [];

  // Estimated bubbles for projected sizes (expanded mode)
  const projBubbles = expanded && effectiveN != null && projSizes.includes(effectiveN)
    ? algos
        .flatMap(id => {
          const fit = extraFits.get(id);
          if (!fit) return [];
          const v = fit.k * fit.fn(effectiveN);
          if (!isFinite(v) || v <= 0) return [];
          return [{ id, v }];
        })
        .sort((a, b) => a.v - b.v)
    : [];

  const bigORefs = mode === "space" ? SPACE_BIG_O_REFS : BIG_O_REFS;

  // Per-reference calibration constants — each curve independently fitted to the geometric
  // mean of all measured data, so every complexity class is visible at the right scale.
  // c_i = exp( mean_over_all_pts( log(measured / f_i(n)) ) )
  const bigOCalibMap = (() => {
    const map = new Map<string, number>();
    const allPts: { n: number; v: number }[] = [];
    for (const id of algos) {
      for (const p of (data[id] ?? [])) {
        if (p.timedOut || !visSizes.includes(p.n)) continue;
        const v = mode === "space" ? (p.spaceBytes ?? 0) : p.timeMs;
        if (v > 0) allPts.push({ n: p.n, v });
      }
    }
    for (const ref of bigORefs) {
      if (!allPts.length) { map.set(ref.id, 0); continue; }
      let logSum = 0, count = 0;
      for (const { n, v } of allPts) {
        const fn = ref.fn(n);
        if (fn > 0) { logSum += Math.log(v / fn); count++; }
      }
      map.set(ref.id, count > 0 ? Math.exp(logSum / count) : 0);
    }
    return map;
  })();
  const bigOCalibC = [...bigOCalibMap.values()].find(v => v > 0) ?? 0; // kept for condition checks

  // Big-O tooltip bubbles shown at the hover crosshair (not in ratio mode — axis is already normalised)
  const bigOBubbles = showBigORefs && effectiveN != null && bigOCalibC > 0 && mode !== "ratio"
    ? [...bigORefs]
        .map(ref => ({ ref, v: (bigOCalibMap.get(ref.id) ?? 0) * ref.fn(effectiveN) }))
        .filter(x => isFinite(x.v) && x.v > 0)
        .sort((a, b) => a.v - b.v)
    : [];

  const overlayBtnBase: React.CSSProperties = btn("secondary", {
    fontSize: 9, padding: "2px 5px", borderRadius: 4, background: "var(--color-surface-2)",
  });

  return (
    <div style={{ position: "relative", userSelect: "none" }}>
      <div className="print:hidden" style={{ position: "absolute", top: 20, left: `calc(${(pL / VW * 100).toFixed(2)}% + 10px)`, zIndex: 2, display: "flex", flexDirection: "row", alignItems: "center", gap: 4 }}>
        {/* Lock toggle */}
        <button
          onClick={() => setLocked(l => !l)}
          style={{ ...overlayBtnBase, color: locked ? "var(--color-muted)" : "var(--color-accent)", border: `1px solid ${locked ? "var(--color-border)" : "var(--color-accent)"}` }}
          title={locked ? "Unlock to enable interactions" : "Lock chart"}
        >
          {locked ? <Lock size={8} /> : <Unlock size={8} />}
          {locked ? "locked" : "unlocked"}
        </button>
        {/* Expand toggle — shows 10 projected sizes at 10–100× last measured n */}
        <button
          onClick={() => setExpanded(e => !e)}
          style={{ ...overlayBtnBase, color: expanded ? "var(--color-accent)" : "var(--color-muted)", border: `1px solid ${expanded ? "var(--color-accent)" : "var(--color-border)"}` }}
          title={expanded ? "Collapse to measured range" : "Project 10–100× beyond last measured n"}
        >
          {expanded ? "collapse" : "expand"}
        </button>
        {/* Mode toggle + reset — to the right of lock button when unlocked */}
        {!locked && (
          <>
            <div style={{ display: "flex", borderRadius: 4, overflow: "hidden", border: "1px solid var(--color-border)" }}>
              {(["brush", "zoom"] as const).map(m => (
                <button
                  key={m}
                  onClick={() => setInteractMode(m)}
                  style={btn(interactMode === m ? "primary" : "ghost", {
                    fontSize: 9, padding: "2px 6px", borderRadius: 0,
                    background: interactMode === m ? "var(--color-accent)" : "var(--color-surface-2)",
                  })}
                  title={m === "brush" ? "Drag to select x-range and zoom in" : "Drag or scroll to zoom y-axis"}
                >
                  {m}
                </button>
              ))}
            </div>
            {isZoomed && (
              <button onClick={() => { setYZoom(1); setXRange(null); }} style={{ ...overlayBtnBase, color: "var(--color-muted)" }}>
                reset
              </button>
            )}
          </>
        )}
        {/* Big-O reference overlay toggle */}
        {mode !== "ratio" && mode !== "space-ratio" && (
          <button
            onClick={() => setShowBigORefs(v => !v)}
            style={{ ...overlayBtnBase, color: showBigORefs ? "var(--color-accent)" : "var(--color-muted)", border: `1px solid ${showBigORefs ? "var(--color-accent)" : "var(--color-border)"}` }}
            title={showBigORefs ? "Hide complexity reference curves" : "Show complexity reference curves (O(n), O(n log n), O(n log²n), O(n²))"}
          >
            O(·)
          </button>
        )}
        {/* Log/linear Y toggle */}
        <button
          onClick={() => setYLogScale(v => !v)}
          style={{ ...overlayBtnBase, color: yLogScale ? "var(--color-accent)" : "var(--color-muted)", border: `1px solid ${yLogScale ? "var(--color-accent)" : "var(--color-border)"}` }}
          title={yLogScale ? "Switch to linear Y scale" : "Switch to log Y scale"}
        >
          {yLogScale ? "log" : "lin"}
        </button>
        {/* Pinned crosshair indicator */}
        {pinnedN != null && (
          <button
            onClick={() => setPinnedN(null)}
            style={{ ...overlayBtnBase, color: "var(--color-accent)", border: "1px solid var(--color-accent)" }}
            title="Click to unpin crosshair"
          >
            📌 n={fmtN(pinnedN)}
          </button>
        )}
      </div>
    <svg
      ref={svgRef}
      viewBox={`0 0 ${VW} ${VH}`}
      style={{ width: "100%", height: "auto", aspectRatio: `${VW} / ${VH}`, display: "block", cursor: locked ? "crosshair" : "crosshair" }}
      aria-label={mode === "space" ? "Space usage vs input size per algorithm" : "Performance curve: time vs input size per algorithm"}
      onMouseMove={handleMouseMove}
      onClick={handleClick}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => { if (!pinnedN) onNChange?.(null); clearDrag(); }}
    >
      <defs>
        <clipPath id="inner-plot-clip">
          <rect x={pL} y={pT} width={iW} height={iH} />
        </clipPath>
      </defs>
      {/* horizontal grid + y labels */}
      {yTicks.map(({ v, y }) => (
        <g key={v}>
          <line x1={pL} y1={y} x2={VW - pR} y2={y}
            stroke="var(--color-border)" strokeWidth={0.6} strokeDasharray="3 3" />
          <text x={pL - 5} y={y + 4} textAnchor="end" fontSize={9}
            fill="var(--color-muted)">{fmtY(v)}</text>
        </g>
      ))}

      {/* ── Worst-case zone shading ── */}
      {mode === "time" && (() => {
        const slowAlgos = algos.filter(id => SLOW_IDS.has(id));
        if (slowAlgos.length === 0 || visSizes.length < 2) return null;
        // Find the x pixel at SLOW_THRESHOLD or the first visible n past it
        const threshN = visSizes.find(n => n >= SLOW_THRESHOLD) ?? visSizes[visSizes.length - 1];
        const x0 = xAt(threshN);
        const x1 = pL + iW;
        if (x1 - x0 < 4) return null;
        return (
          <g style={{ pointerEvents: "none" }}>
            <rect x={x0} y={pT} width={x1 - x0} height={iH}
              fill="rgba(239,68,68,0.06)" clipPath="url(#inner-plot-clip)" />
            <text x={Math.max(x0 + 2, (x0 + x1) / 2)} y={pT + 10} textAnchor="middle" fontSize={7.5}
              fontFamily="monospace" fill="rgba(239,68,68,0.5)" style={{ pointerEvents: "none" }}>
              O(n²) slow zone
            </text>
          </g>
        );
      })()}
      {/* Best-case zone: very small n where even O(n²) is fine */}
      {mode === "time" && visSizes.length >= 2 && (() => {
        const fastBound = visSizes.find(n => n >= 1000) ?? visSizes[visSizes.length - 1];
        const x1 = xAt(fastBound);
        if (x1 - pL < 4) return null;
        return (
          <g style={{ pointerEvents: "none" }}>
            <rect x={pL} y={pT} width={x1 - pL} height={iH}
              fill="rgba(78,124,82,0.05)" clipPath="url(#inner-plot-clip)" />
            <text x={pL + (x1 - pL) / 2} y={pT + 10} textAnchor="middle" fontSize={7.5}
              fontFamily="monospace" fill="rgba(78,124,82,0.4)" style={{ pointerEvents: "none" }}>
              all algos fast
            </text>
          </g>
        );
      })()}

      {/* axes */}
      <line x1={pL} y1={pT} x2={pL} y2={pT + iH} stroke="var(--color-border)" strokeWidth={0.8} />
      <line x1={pL} y1={pT + iH} x2={VW - pR} y2={pT + iH} stroke="var(--color-border)" strokeWidth={0.8} />

      {/* Big-O reference curves + algo right-edge labels — unified evenly-spaced right margin */}
      {showBigORefs && mode !== "ratio" && mode !== "space-ratio" && visSizes.length >= 1 && bigOCalibC > 0 && (() => {
        const maxN  = visSizes[visSizes.length - 1];
        const STEPS = 80;
        const lx    = pL + iW + extraZoneW + 5;

        const refY = (refId: string, fn: (n: number) => number, n: number) => {
          const c = bigOCalibMap.get(refId) ?? 0;
          return Math.max(pT, pT + iH - (c * fn(n) / maxY) * iH);
        };

        // Build a unified pool: Big-O reference curves + actual measured algo endpoints at maxN.
        // Sort the whole pool by value ascending (fastest = bottom, slowest = top), then assign
        // evenly-spaced Y slots across the full canvas so nothing overlaps.
        type LabelItem =
          | { kind: "ref"; ri: number; v: number }
          | { kind: "algo"; id: string; v: number; actualY: number };

        const pool: LabelItem[] = [
          ...bigORefs.map((ref, ri) => ({
            kind: "ref" as const,
            ri,
            v: (bigOCalibMap.get(ref.id) ?? 0) * ref.fn(maxN),
          })),
          ...algos.flatMap(id => {
            const pts = (data[id] ?? []).filter(p => !p.timedOut && visSizes.includes(p.n));
            const pt  = [...pts].sort((a, b) => b.n - a.n)[0];
            if (!pt) return [];
            const v = getValue(pt);
            if (v <= 0) return [];
            return [{ kind: "algo" as const, id, v, actualY: Math.max(pT, Math.min(pT + iH, yAt(v))) }];
          }),
        ].filter(item => isFinite(item.v) && item.v > 0);

        // Sort ascending by value (fastest first → bottom of canvas)
        pool.sort((a, b) => a.v - b.v);

        const labelTop    = pT + 7;
        const labelBottom = pT + iH - 23;
        const total       = pool.length;
        const step        = total > 1 ? (labelBottom - labelTop) / (total - 1) : 0;
        // Assign evenly-spaced Y: index 0 (fastest) → bottom, index n-1 (slowest) → top
        const assignedY   = pool.map((_, rank) => labelBottom - rank * step);

        // Draw ref curve polylines first (background layer)
        const refPolylines = bigORefs.map((ref, ri) => {
          const pts: string[] = [];
          for (let i = 0; i <= STEPS; i++) {
            const t = i / STEPS;
            const x = pL + t * iW;
            const fi = t * (visSizes.length - 1);
            const lo = Math.floor(fi), hi2 = Math.ceil(fi);
            const ft = fi - lo;
            const n  = lo === hi2 ? visSizes[lo] : visSizes[lo] * Math.pow(visSizes[hi2] / visSizes[lo], ft);
            pts.push(`${x.toFixed(1)},${refY(ref.id, ref.fn, n).toFixed(1)}`);
          }
          return (
            <polyline key={`refline-${ref.id}`}
              points={pts.join(" ")}
              fill="none"
              stroke={ref.color}
              strokeWidth={1.5}
              strokeDasharray="5 3"
              opacity={ref.id === "logn" || ref.id === "1" ? 0.9 : 0.65}
              clipPath="url(#inner-plot-clip)"
              style={{ pointerEvents: "none" }}
            />
          );
        });

        // Draw labels + connectors for the combined pool
        const labels = pool.map((item, rank) => {
          const labelY = assignedY[rank];

          if (item.kind === "ref") {
            const ref     = bigORefs[item.ri];
            const curveEndX = pL + iW + extraZoneW;
            const curveEndY = Math.max(pT, Math.min(pT + iH, refY(ref.id, ref.fn, maxN)));
            const predMs  = item.v;
            const clipped = predMs > maxY;
            return (
              <g key={`refl-${ref.id}`} style={{ pointerEvents: "none" }}>
                <line x1={curveEndX} y1={curveEndY} x2={lx - 2} y2={labelY + 8}
                  stroke={ref.color} strokeWidth={0.5} opacity={0.35} />
                <text x={lx} y={labelY} textAnchor="start" fontSize={7.5}
                  fontFamily="monospace" fill={ref.color} opacity={0.9}>
                  {ref.label}
                </text>
                <text x={lx} y={labelY + 9} textAnchor="start" fontSize={7}
                  fontFamily="monospace" fill={ref.color} opacity={0.7}>
                  n={fmtN(maxN)}
                </text>
                <text x={lx} y={labelY + 17} textAnchor="start" fontSize={7}
                  fontFamily="monospace" fill={ref.color} opacity={0.7}>
                  {clipped ? "↑ " : ""}{mode === "space" ? fmtBytes(predMs) : fmtPredicted(predMs)}
                </text>
              </g>
            );
          } else {
            // Algo label: connector from curve's actual right-edge Y to label slot
            const color    = ALGO_COLORS[item.id] ?? "#888";
            const isHl     = !highlight || highlight === item.id;
            const shortName = (ALGO_NAMES[item.id] ?? item.id).replace(" Sort", "");
            const fit      = extraFits.get(item.id);
            const units    = mode === "space" ? "bytes" : "ms";
            const fmtK     = (k: number) =>
              k >= 100 ? k.toFixed(1) :
              k >= 1   ? k.toPrecision(3) :
              k < 0.0001 ? k.toExponential(2) :
              k.toPrecision(3);
            const eqStr    = fit
              ? `T(n) ≈ ${fmtK(fit.k)} · n^${fit.exp.toFixed(3)} ${units}`
              : null;
            return (
              <g key={`algol-${item.id}`} style={{ pointerEvents: eqStr ? "all" : "none", cursor: eqStr ? "help" : "default" }} opacity={isHl ? 1 : 0.2}>
                {eqStr && <title>{eqStr}</title>}
                <line x1={pL + iW + extraZoneW} y1={item.actualY} x2={lx - 2} y2={labelY + 5}
                  stroke={color} strokeWidth={0.7} opacity={0.5} />
                <text x={lx} y={labelY} textAnchor="start" fontSize={7.5}
                  fontFamily="monospace" fill={color} fontWeight={600}>
                  {shortName}
                </text>
                <text x={lx} y={labelY + 9} textAnchor="start" fontSize={7}
                  fontFamily="monospace" fill={color} opacity={0.75}>
                  {mode === "space" ? fmtBytes(item.v) : fmtTime(item.v)}{eqStr ? " ≈" : ""}
                </text>
              </g>
            );
          }
        });

        return <>{refPolylines}{labels}</>;
      })()}

      {/* Separator — between measured data and projection zone */}
      {visSizes.length >= 2 && (() => {
        const sepX = expanded ? xAt(visSizes[visSizes.length - 1]) : pL + iW;
        return (
          <line
            x1={sepX} y1={pT} x2={sepX} y2={pT + iH}
            stroke="var(--color-border)" strokeWidth={0.8} strokeDasharray="3 3" opacity={0.6}
            style={{ pointerEvents: "none" }}
          />
        );
      })()}

      {/* vertical grid + x tick labels (measured) */}
      {(() => {
        const tickEvery = expanded ? 1 : Math.max(1, Math.ceil(visSizes.length / 5));
        return visSizes.map((n, i) => {
          const x = xAt(n);
          const showLabel = i % tickEvery === 0 || i === visSizes.length - 1;
          return (
            <g key={n}>
              <line x1={x} y1={pT} x2={x} y2={pT + iH}
                stroke="var(--color-border)" strokeWidth={0.4} strokeDasharray="2 5" opacity={0.5} />
              {showLabel && (
                <text x={x} y={VH - pB + 14} textAnchor="middle" fontSize={9}
                  fill="var(--color-muted)">{fmtN(n)}</text>
              )}
            </g>
          );
        });
      })()}
      {/* x label at end of extrapolation zone (non-expanded only) */}
      {!expanded && visSizes.length >= 1 && (() => {
        const lastN = visSizes[visSizes.length - 1];
        const x = pL + iW + extraZoneW;
        return (
          <text key="extrap-end" x={x} y={VH - pB + 14} textAnchor="middle" fontSize={8}
            fill="var(--color-muted)" opacity={0.5}>{fmtN(lastN * 4)}</text>
        );
      })()}
      {/* x tick labels for projected sizes (every other one to avoid clutter) */}
      {expanded && projSizes.map((n, i) => {
        if (i % 2 !== 0) return null; // show every other
        const x = xAt(n);
        return (
          <g key={`proj-${n}`}>
            <line x1={x} y1={pT} x2={x} y2={pT + iH}
              stroke="var(--color-border)" strokeWidth={0.3} strokeDasharray="2 6" opacity={0.3} />
            <text x={x} y={VH - pB + 14} textAnchor="middle" fontSize={7.5}
              fill="var(--color-muted)" opacity={0.6}>{fmtN(n)}</text>
          </g>
        );
      })}

      {/* x-axis label */}
      <text x={pL + iW / 2} y={VH - 3} textAnchor="middle" fontSize={9}
        fill="#ef5350" fontStyle="italic">input size (n)</text>

      {/* y-axis title — rotated */}
      <text
        x={0} y={0}
        transform={`translate(9, ${pT + iH / 2}) rotate(-90)`}
        textAnchor="middle" fontSize={8}
        fill={mode === "space" || mode === "space-ratio" ? "#64b5f6" : "#66bb6a"} fontStyle="italic" fontFamily="monospace"
      >
        {mode === "ratio" ? "t / (n · log₂n)" : mode === "space" ? "memory" : "time"}
      </text>

      {/* Crossover annotations — n where algo A's fitted curve overtakes algo B */}
      {mode !== "ratio" && mode !== "space-ratio" && (() => {
        const ids = algos.filter(id => extraFits.get(id) != null);
        if (ids.length < 2) return null;
        const annotations: { n: number; idA: string; idB: string }[] = [];
        for (let ai = 0; ai < ids.length; ai++) {
          for (let bi = ai + 1; bi < ids.length; bi++) {
            const idA = ids[ai], idB = ids[bi];
            const fA = extraFits.get(idA)!, fB = extraFits.get(idB)!;
            if (!fA || !fB) continue;
            // Crossover: a1·n^b1 = a2·n^b2  →  n = (a2/a1)^(1/(b1−b2))
            const db = fA.exp - fB.exp;
            if (Math.abs(db) < 0.01) continue; // parallel — no crossover
            const crossN = Math.pow(fB.k / fA.k, 1 / db);
            const minN = Math.min(...visSizes), maxN = Math.max(...displaySizes) * 2;
            if (!isFinite(crossN) || crossN <= minN || crossN > maxN) continue;
            // Verify actual ordering flips (handles coefficient direction)
            const preA = fA.k * fA.fn(crossN * 0.5), preB = fB.k * fB.fn(crossN * 0.5);
            const postA = fA.k * fA.fn(crossN * 2), postB = fB.k * fB.fn(crossN * 2);
            if (!((preA < preB && postA > postB) || (preA > preB && postA < postB))) continue;
            annotations.push({ n: crossN, idA, idB });
          }
        }
        return annotations.map(({ n, idA, idB }) => {
          const x = xAt(n);
          if (x < pL || x > pL + iW + extraZoneW) return null;
          const colA = ALGO_COLORS[idA] ?? "#888", colB = ALGO_COLORS[idB] ?? "#888";
          return (
            <g key={`cross-${idA}-${idB}`} style={{ pointerEvents: "none" }}>
              <line x1={x} y1={pT + 4} x2={x} y2={pT + iH}
                stroke="rgba(255,255,255,0.18)" strokeWidth={1} strokeDasharray="3 4" />
              {/* X marker */}
              <text x={x} y={pT + 2} textAnchor="middle" fontSize={7.5} fontFamily="monospace"
                fill="rgba(255,255,255,0.55)">✕</text>
              {/* Tooltip on the bottom axis */}
              <text x={x} y={pT + iH + 8} textAnchor="middle" fontSize={6.5} fontFamily="monospace"
                fill={colA} opacity={0.8}>{ALGO_NAMES[idA]?.split(" ")[0]}</text>
              <text x={x} y={pT + iH + 15} textAnchor="middle" fontSize={6.5} fontFamily="monospace"
                fill="rgba(255,255,255,0.3)">⇄</text>
              <text x={x} y={pT + iH + 22} textAnchor="middle" fontSize={6.5} fontFamily="monospace"
                fill={colB} opacity={0.8}>{ALGO_NAMES[idB]?.split(" ")[0]}</text>
            </g>
          );
        });
      })()}

      {/* hover / pinned crosshair */}
      {effectiveN != null && (() => {
        const x = xAt(effectiveN);
        return (
          <g style={{ pointerEvents: "none" }}>
            <line x1={x} y1={pT} x2={x} y2={pT + iH}
              stroke={pinnedN != null ? "var(--color-accent)" : "var(--color-text)"}
              strokeWidth={pinnedN != null ? 1.5 : 1} strokeDasharray="3 3"
              opacity={pinnedN != null ? 0.6 : 0.3} />
            {pinnedN != null && (
              <text x={x + 4} y={pT + 9} fontSize={7} fontFamily="monospace"
                fill="var(--color-accent)" opacity={0.8}>📌</text>
            )}
          </g>
        );
      })()}

      {/* variance error bands — rendered before curves so lines draw on top */}
      {algos.map(id => {
        const pts = [...(data[id] ?? [])].sort((a, b) => a.n - b.n).filter(p => !p.timedOut && p.meanMs != null && p.stdDev != null && p.stdDev > 0);
        if (pts.length < 2) return null;
        const color = ALGO_COLORS[id] ?? "#888";
        const isHl = !highlight || highlight === id;
        const upper = pts.map(p => `${xAt(p.n).toFixed(1)},${Math.max(pT, yAt(p.meanMs! - p.stdDev!)).toFixed(1)}`);
        const lower = [...pts].reverse().map(p => `${xAt(p.n).toFixed(1)},${Math.min(pT + iH, yAt(p.meanMs! + p.stdDev!)).toFixed(1)}`);
        return (
          <polygon key={`band-${id}`}
            points={[...upper, ...lower].join(" ")}
            fill={color} opacity={isHl ? 0.10 : 0.03}
            style={{ pointerEvents: "none", transition: "opacity 0.2s ease" }}
            clipPath="url(#inner-plot-clip)"
          />
        );
      })}

      {/* stdDev error bar whiskers — vertical lines with horizontal end caps */}
      {algos.map(id => {
        const pts = [...(data[id] ?? [])].sort((a, b) => a.n - b.n)
          .filter(p => !p.timedOut && p.stdDev != null && p.stdDev > 0 && p.meanMs != null);
        if (pts.length === 0) return null;
        const color = ALGO_COLORS[id] ?? "#888";
        const isHl = !highlight || highlight === id;
        return (
          <g key={`errbar-${id}`} opacity={isHl ? 0.55 : 0.1} clipPath="url(#inner-plot-clip)" style={{ pointerEvents: "none" }}>
            {pts.map(p => {
              const cx = xAt(p.n);
              const yTop = Math.max(pT, yAt(p.meanMs! - p.stdDev!));
              const yBot = Math.min(pT + iH, yAt(p.meanMs! + p.stdDev!));
              const capW = 3;
              return (
                <g key={p.n}>
                  <line x1={cx} y1={yTop} x2={cx} y2={yBot} stroke={color} strokeWidth={1.2} />
                  <line x1={cx - capW} y1={yTop} x2={cx + capW} y2={yTop} stroke={color} strokeWidth={1.2} />
                  <line x1={cx - capW} y1={yBot} x2={cx + capW} y2={yBot} stroke={color} strokeWidth={1.2} />
                </g>
              );
            })}
          </g>
        );
      })}

      {/* curves + dots */}
      {algos.map(id => {
        const pts = [...(data[id] ?? [])].sort((a, b) => a.n - b.n);
        if (!pts.length) return null;
        const color = ALGO_COLORS[id] ?? "#888";
        const isHl = !highlight || highlight === id;
        const sw = isHl && highlight ? 2.5 : 1.75;

        // ── Extrapolation tail / projected curve ────────────────────────────
        const validPts = pts.filter(p => !p.timedOut && getValue(p) > 0);
        let extraTail: React.ReactNode = null;

        if (validPts.length >= 2 && visSizes.length >= 2) {
          const fit = extraFits.get(id);
          if (fit) {
            // log rate: empirical power-law exponent from data; fitted: same from fit shape
            const firstPt = validPts[0];
            const lastPt  = validPts[validPts.length - 1];
            const lnRatio = Math.log(lastPt.n / firstPt.n);
            const actualLogRate = lnRatio > 0
              ? Math.log(getValue(lastPt) / getValue(firstPt)) / lnRatio
              : 0;
            const fittedLogRate = lnRatio > 0 && fit.fn(firstPt.n) > 0
              ? Math.log(fit.fn(lastPt.n) / fit.fn(firstPt.n)) / lnRatio
              : 0;
            const tailOp = Math.max(0, Math.min(1, actualLogRate > 0 ? 1 : 0));
            const tailLabel = `n${toSup(actualLogRate.toFixed(2))}`;

            if (expanded && projSizes.length > 0) {
              // ── Expanded mode: draw projected curve using actual projSizes x positions ──
              const lastValidPt = validPts[validPts.length - 1];
              const connX = xAt(lastValidPt.n);
              const connY = Math.max(pT, Math.min(pT + iH, yAt(getValue(lastValidPt))));

              const projPts = projSizes.map(pn => {
                const v = fit.k * fit.fn(pn);
                const y = isFinite(v) && v > 0
                  ? Math.max(pT, Math.min(pT + iH, yAt(v)))
                  : null;
                return { n: pn, v, x: xAt(pn), y };
              });
              const validProj = projPts.filter((p): p is typeof p & { y: number } => p.y !== null);

              // Build segment list starting from the last measured point
              const segPts = [{ x: connX, y: connY }, ...validProj];

              extraTail = (
                <g style={{ pointerEvents: "none" }}>
                  {segPts.slice(1).map((pt, i) => (
                    <line key={i}
                      x1={segPts[i].x} y1={segPts[i].y}
                      x2={pt.x}        y2={pt.y}
                      stroke={color} strokeWidth={1.1}
                      strokeDasharray="4 3"
                      opacity={tailOp}
                      strokeLinecap="round"
                    />
                  ))}
                  {validProj.map((pp, i) => {
                    const isActive = effectiveN === pp.n;
                    return (
                    <g key={i}>
                      <circle cx={pp.x} cy={pp.y} r={isActive ? 4.5 : 3}
                        fill="var(--color-surface-2)"
                        stroke={color} strokeWidth={isActive ? 1.8 : 1.2}
                        opacity={tailOp + 0.1}
                        style={{ transition: "r 0.1s ease" }}
                      />
                      {/* value label every other point */}
                      {i % 2 === 1 && (
                        <text x={pp.x} y={pp.y - 5} textAnchor="middle"
                          fontSize={6} fontFamily="monospace"
                          fill={color} opacity={Math.min(1, tailOp + 0.2)}
                        >
                          {fmtY(pp.v)}
                        </text>
                      )}
                    </g>
                  );
                  })}
                  {/* rate badge at last projected point */}
                  {validProj.length > 0 && (() => {
                    const last = validProj[validProj.length - 1];
                    return (
                      <text x={last.x} y={last.y - 7} textAnchor="middle"
                        fontSize={6.5} fontFamily="monospace"
                        fill={color} opacity={Math.min(1, tailOp + 0.2)}
                      >
                        {tailLabel}
                      </text>
                    );
                  })()}
                </g>
              );
            } else if (!expanded) {
              // ── Non-expanded mode: narrow 4× extrapolation zone tail ──
              const lastN   = validPts[validPts.length - 1].n;
              const lastVal = getValue(validPts[validPts.length - 1]);
              const x0      = pL + iW;
              const x1      = pL + iW + extraZoneW;
              const STEPS   = 16;
              const tpts: string[] = [`${x0.toFixed(1)},${yAt(lastVal).toFixed(1)}`];
              for (let s = 1; s <= STEPS; s++) {
                const t  = s / STEPS;
                const n  = lastN * Math.pow(4, t);
                const v  = fit.k * fit.fn(n);
                const ex = x0 + t * (x1 - x0);
                const ey = Math.max(pT, Math.min(pT + iH, yAt(v)));
                tpts.push(`${ex.toFixed(1)},${ey.toFixed(1)}`);
              }
              const endV = fit.k * fit.fn(lastN * 4);
              const endY = Math.max(pT + 4, Math.min(pT + iH - 4, yAt(endV)));
              extraTail = (
                <g style={{ pointerEvents: "none" }}>
                  <polyline points={tpts.join(" ")} fill="none"
                    stroke={color} strokeWidth={1.1} strokeDasharray="2 2" opacity={tailOp} />
                  <text x={x1 - 1} y={endY - 3} textAnchor="end"
                    fontSize={6.5} fontFamily="monospace"
                    fill={color} opacity={Math.min(1, tailOp + 0.15)}
                  >
                    {tailLabel}
                  </text>
                </g>
              );
            }
          }
        }

        return (
          <g key={id} opacity={isHl ? 1 : 0.12} style={{ transition: "opacity 0.2s ease" }}>
            <g clipPath="url(#inner-plot-clip)">
              {pts.slice(1).map((p, i) => {
                const prev = pts[i];
                const dashed = prev.timedOut || p.timedOut;
                return (
                  <line key={p.n}
                    x1={xAt(prev.n)} y1={yAt(getValue(prev))}
                    x2={xAt(p.n)}   y2={yAt(getValue(p))}
                    stroke={color} strokeWidth={sw}
                    strokeDasharray={dashed ? "5 3" : undefined}
                    strokeLinecap="round"
                  />
                );
              })}
              {pts.map(p => {
                const cx = xAt(p.n), cy = yAt(getValue(p));
                const isActive = effectiveN != null && p.n === effectiveN;
                if (p.timedOut) {
                  const r = 4;
                  return (
                    <g key={p.n}>
                      <circle cx={cx} cy={cy} r={r + 1.5}
                        fill="var(--color-surface-2)" stroke={color} strokeWidth={1.5} />
                      <line x1={cx - r + 1} y1={cy - r + 1} x2={cx + r - 1} y2={cy + r - 1}
                        stroke={color} strokeWidth={1.5} strokeLinecap="round" />
                      <line x1={cx + r - 1} y1={cy - r + 1} x2={cx - r + 1} y2={cy + r - 1}
                        stroke={color} strokeWidth={1.5} strokeLinecap="round" />
                    </g>
                  );
                }
                return (
                  <circle key={p.n} cx={cx} cy={cy}
                    r={isActive ? 5 : 3.5}
                    fill={color}
                    stroke="var(--color-surface-2)"
                    strokeWidth={isActive ? 2 : 1.5}
                    style={{ transition: "r 0.1s ease" }}
                  />
                );
              })}
            </g>
            {extraTail}
          </g>
        );
      })}

      {/* data bubbles — rendered last so they float above curves */}
      {bubbles.length > 0 && effectiveN != null && (() => {
        const cx = xAt(effectiveN);
        const PAD = 10;
        const n = bubbles.length;
        const sorted = [...bubbles].sort((a, b) => yAt(getValue(a.pt)) - yAt(getValue(b.pt)));
        const maxPerCol = Math.max(1, Math.floor(iH / 11));
        const useColumns = n > maxPerCol;

        if (useColumns) {
          // Horizontal column layout: actual measurements extend RIGHT from crosshair
          const BH = 10, fs = 7, COL_W = 105;
          const goRight = cx <= VW * 0.65;
          return (
            <g style={{ pointerEvents: "none" }}>
              {sorted.map(({ id, pt }, i) => {
                const col = Math.floor(i / maxPerCol);
                const posInCol = i % maxPerCol;
                const colSize = Math.min(maxPerCol, n - col * maxPerCol);
                const dotCy = yAt(getValue(pt));
                const labelCy = colSize <= 1 ? pT + iH / 2
                  : pT + 5 + (iH - 10) * posInCol / (colSize - 1);
                const color = ALGO_COLORS[id] ?? "#888";
                const label = `${ALGO_NAMES[id]}  ${mode === "space" ? fmtBytes(pt.spaceBytes ?? 0) : fmtTime(pt.timeMs)}`;
                const bw = label.length * (fs * 0.58) + PAD;
                const bx = goRight ? cx + 10 + col * COL_W : cx - 10 - (col + 1) * COL_W;
                const by = labelCy - BH / 2;
                return (
                  <g key={id}>
                    <line x1={cx} y1={dotCy} x2={goRight ? bx : bx + bw}
                      y2={labelCy} stroke={color} strokeWidth={0.7} opacity={0.35} />
                    <rect x={bx} y={by} width={bw} height={BH} rx={2} fill={color} opacity={0.93} />
                    <text x={bx + 3} y={by + BH - 2} fontSize={fs} fontWeight={700}
                      fill="#fff" style={{ letterSpacing: "0.01em" }}>
                      {label}
                    </text>
                    <circle cx={cx} cy={dotCy} r={4} fill={color}
                      stroke="var(--color-surface-2)" strokeWidth={1.5} />
                  </g>
                );
              })}
            </g>
          );
        }

        // Vertical spread
        const BH = Math.max(10, Math.min(16, n <= 1 ? 16 : Math.floor((iH - (n - 1)) / n)));
        const fs = BH >= 14 ? 9.5 : BH >= 12 ? 8.5 : 7;
        const flipRight = cx > VW * 0.6;
        const spreadCy = sorted.map((_, i) =>
          n === 1 ? pT + iH / 2 : pT + BH / 2 + (iH - BH) * i / (n - 1)
        );
        return (
          <g style={{ pointerEvents: "none" }}>
            {sorted.map(({ id, pt }, i) => {
              const dotCy = yAt(getValue(pt));
              const labelCy = spreadCy[i];
              const color = ALGO_COLORS[id] ?? "#888";
              const label = `${ALGO_NAMES[id]}  ${mode === "space" ? fmtBytes(pt.spaceBytes ?? 0) : fmtTime(pt.timeMs)}`;
              const bw = label.length * (fs * 0.58) + PAD;
              const bx = flipRight ? cx - bw - 10 : cx + 10;
              const by = labelCy - BH / 2;
              return (
                <g key={id}>
                  <line x1={cx} y1={dotCy} x2={flipRight ? bx + bw : bx}
                    y2={labelCy} stroke={color} strokeWidth={0.8} opacity={0.35} />
                  <rect x={bx} y={by} width={bw} height={BH} rx={3}
                    fill={color} opacity={0.93} />
                  <text x={bx + 4} y={by + BH - 3} fontSize={fs} fontWeight={700}
                    fill="#fff" style={{ letterSpacing: "0.01em" }}>
                    {label}
                  </text>
                  <circle cx={cx} cy={dotCy} r={4} fill={color}
                    stroke="var(--color-surface-2)" strokeWidth={1.5} />
                </g>
              );
            })}
          </g>
        );
      })()}
      {/* Estimated bubbles for projected sizes */}
      {projBubbles.length > 0 && effectiveN != null && (() => {
        const cx = xAt(effectiveN);
        const PAD = 10;
        const sorted = [...projBubbles].sort((a, b) => yAt(a.v) - yAt(b.v));
        const n = sorted.length;
        const maxPerCol = Math.max(1, Math.floor(iH / 11));
        const useColumns = n > maxPerCol;

        if (useColumns) {
          const BH = 10, fs = 7, COL_W = 105;
          const goRight = cx <= VW * 0.65;
          return (
            <g style={{ pointerEvents: "none" }}>
              {sorted.map(({ id, v }, i) => {
                const col = Math.floor(i / maxPerCol);
                const posInCol = i % maxPerCol;
                const colSize = Math.min(maxPerCol, n - col * maxPerCol);
                const dotCy = Math.max(pT + 8, Math.min(pT + iH - 8, yAt(v)));
                const labelCy = colSize <= 1 ? pT + iH / 2
                  : pT + 5 + (iH - 10) * posInCol / (colSize - 1);
                const color = ALGO_COLORS[id] ?? "#888";
                const label = `${ALGO_NAMES[id]}  ~est: ${fmtY(v)}`;
                const bw = label.length * (fs * 0.58) + PAD;
                const bx = goRight ? cx + 10 + col * COL_W : cx - 10 - (col + 1) * COL_W;
                const by = labelCy - BH / 2;
                return (
                  <g key={id}>
                    <line x1={cx} y1={dotCy} x2={goRight ? bx : bx + bw}
                      y2={labelCy} stroke={color} strokeWidth={0.7} opacity={0.4} />
                    <rect x={bx} y={by} width={bw} height={BH} rx={2}
                      fill={color} opacity={0.7} stroke={color} strokeWidth={1} strokeDasharray="3 2" />
                    <text x={bx + 3} y={by + BH - 2} fontSize={fs} fontWeight={700}
                      fill="#fff" style={{ letterSpacing: "0.01em" }}>
                      {label}
                    </text>
                    <circle cx={cx} cy={dotCy} r={4.5}
                      fill="var(--color-surface-2)" stroke={color} strokeWidth={2} />
                  </g>
                );
              })}
            </g>
          );
        }

        const BH = Math.max(10, Math.min(16, n <= 1 ? 16 : Math.floor((iH - (n - 1)) / n)));
        const fs = BH >= 14 ? 9.5 : BH >= 12 ? 8.5 : 7;
        const flipRight = cx > VW * 0.6;
        const spreadCy = sorted.map((_, i) =>
          n === 1 ? pT + iH / 2 : pT + BH / 2 + (iH - BH) * i / (n - 1)
        );
        return (
          <g style={{ pointerEvents: "none" }}>
            {sorted.map(({ id, v }, i) => {
              const dotCy = Math.max(pT + 8, Math.min(pT + iH - 8, yAt(v)));
              const labelCy = spreadCy[i];
              const color = ALGO_COLORS[id] ?? "#888";
              const label = `${ALGO_NAMES[id]}  ~est: ${fmtY(v)}`;
              const bw = label.length * (fs * 0.58) + PAD;
              const bx = flipRight ? cx - bw - 10 : cx + 10;
              const by = labelCy - BH / 2;
              return (
                <g key={id}>
                  <line x1={cx} y1={dotCy} x2={flipRight ? bx + bw : bx}
                    y2={labelCy} stroke={color} strokeWidth={0.8} opacity={0.4} />
                  <rect x={bx} y={by} width={bw} height={BH} rx={3}
                    fill={color} opacity={0.7}
                    stroke={color} strokeWidth={1} strokeDasharray="3 2" />
                  <text x={bx + 4} y={by + BH - 3} fontSize={fs} fontWeight={700}
                    fill="#fff" style={{ letterSpacing: "0.01em" }}>
                    {label}
                  </text>
                  <circle cx={cx} cy={dotCy} r={4.5}
                    fill="var(--color-surface-2)" stroke={color} strokeWidth={2} />
                </g>
              );
            })}
          </g>
        );
      })()}

      {/* Big-O reference curve tooltip bubbles at the hover crosshair */}
      {bigOBubbles.length > 0 && effectiveN != null && (() => {
        const cx = xAt(effectiveN);
        const SWATCH_W = 14, GAP = 3, PAD = 5;
        const nb = bigOBubbles.length;
        const naturalCy = bigOBubbles.map(({ v }) =>
          Math.max(pT + 8, Math.min(pT + iH - 8, yAt(v)))
        );
        const maxPerCol = Math.max(1, Math.floor(iH / 11));
        const useColumns = nb > maxPerCol;

        if (useColumns) {
          // Horizontal column layout: Big O labels extend LEFT from crosshair
          const BH = 10, fs = 7, COL_W = 110;
          const goLeft = cx >= VW * 0.35;
          return (
            <g style={{ pointerEvents: "none" }}>
              {bigOBubbles.map(({ ref, v }, i) => {
                const col = Math.floor(i / maxPerCol);
                const posInCol = i % maxPerCol;
                const colSize = Math.min(maxPerCol, nb - col * maxPerCol);
                const labelCy = colSize <= 1 ? pT + iH / 2
                  : pT + 5 + (iH - 10) * posInCol / (colSize - 1);
                const valueStr = mode === "space" ? fmtBytes(v) : fmtPredicted(v);
                const labelStr = `${ref.label}  ${valueStr}`;
                const bw = SWATCH_W + GAP + labelStr.length * (fs * 0.58) + PAD * 2;
                const bx = goLeft ? cx - 10 - (col + 1) * COL_W : cx + 10 + col * COL_W;
                const by = labelCy - BH / 2;
                return (
                  <g key={ref.id}>
                    <line x1={cx} y1={naturalCy[i]} x2={goLeft ? bx + bw : bx}
                      y2={labelCy} stroke={ref.color} strokeWidth={0.7} opacity={0.4} />
                    <rect x={bx} y={by} width={bw} height={BH} rx={2}
                      fill="var(--color-surface-2)" opacity={0.93}
                      stroke={ref.color} strokeWidth={1} strokeDasharray="4 2" />
                    <line x1={bx + PAD} y1={by + BH / 2} x2={bx + PAD + SWATCH_W} y2={by + BH / 2}
                      stroke={ref.color} strokeWidth={1.5} strokeDasharray="4 3" />
                    <text x={bx + PAD + SWATCH_W + GAP} y={by + BH - 2}
                      fontSize={fs} fontFamily="monospace" fontWeight={600} fill={ref.color}>
                      {labelStr}
                    </text>
                    <circle cx={cx} cy={naturalCy[i]} r={3}
                      fill="var(--color-surface-2)" stroke={ref.color} strokeWidth={1.5} />
                  </g>
                );
              })}
            </g>
          );
        }

        const BH = 15;
        const flipRight = cx > VW * 0.55;
        const spreadCy = bigOBubbles.map((_, i) =>
          nb === 1 ? pT + iH / 2 : pT + BH / 2 + (iH - BH) * i / (nb - 1)
        );

        return (
          <g style={{ pointerEvents: "none" }}>
            {bigOBubbles.map(({ ref, v }, i) => {
              const cy = spreadCy[i];
              const valueStr = mode === "space" ? fmtBytes(v) : fmtPredicted(v);
              const labelStr = `${ref.label}  ${valueStr}`;
              const bw = SWATCH_W + GAP + labelStr.length * 5.1 + PAD * 2;
              const bx = flipRight ? cx - bw - 10 : cx + 10;
              const by = cy - BH / 2;
              return (
                <g key={ref.id}>
                  {/* bubble */}
                  <rect x={bx} y={by} width={bw} height={BH} rx={3}
                    fill="var(--color-surface-2)" opacity={0.93}
                    stroke={ref.color} strokeWidth={1} strokeDasharray="4 2" />
                  {/* legend color swatch — dashed line matching the curve style */}
                  <line
                    x1={bx + PAD} y1={by + BH / 2}
                    x2={bx + PAD + SWATCH_W} y2={by + BH / 2}
                    stroke={ref.color} strokeWidth={1.5} strokeDasharray="4 3" />
                  {/* label text */}
                  <text
                    x={bx + PAD + SWATCH_W + GAP} y={by + BH - 4}
                    fontSize={8.5} fontFamily="monospace" fontWeight={600}
                    fill={ref.color}>
                    {labelStr}
                  </text>
                  {/* connector dot on the reference curve */}
                  <circle cx={cx} cy={naturalCy[i]} r={3}
                    fill="var(--color-surface-2)" stroke={ref.color} strokeWidth={1.5} />
                </g>
              );
            })}
          </g>
        );
      })()}

      {/* Selection rect (brush = full height, zoom = box) */}
      {selRect && (
        <rect x={selRect.x} y={selRect.y} width={selRect.w} height={selRect.h}
          fill="var(--color-accent)" opacity={0.12}
          stroke="var(--color-accent)" strokeWidth={1}
          style={{ pointerEvents: "none" }} />
      )}
    </svg>
    </div>
  );
}

// ── Legend ────────────────────────────────────────────────────────────────────

function Legend({ algos, data }: { algos: string[]; data: CurveData }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5">
      {algos.map(id => {
        const hasData = (data[id]?.length ?? 0) > 0;
        return (
          <div key={id} className="flex items-center gap-1.5" style={{ opacity: hasData ? 1 : 0.35 }}>
            <div style={{
              width: 18, height: 3,
              background: ALGO_COLORS[id] ?? "#888",
              borderRadius: 2,
            }} />
            <WithAlgoTooltip id={id}>
              <span className="text-xs" style={{ color: "var(--color-muted)" }}>
                {ALGO_NAMES[id]}
              </span>
            </WithAlgoTooltip>
          </div>
        );
      })}
    </div>
  );
}

// ── Proof slider ──────────────────────────────────────────────────────────────

function ProofSlider({
  proofs, algos, activeAlgo, onSelect, revealed, curveData,
}: {
  proofs: Record<string, { before: number[]; after: number[]; n: number }>;
  algos: string[];
  activeAlgo: string | null;
  onSelect: (id: string | null) => void;
  revealed: boolean;
  curveData: CurveData;
}) {
  const available = algos.filter(id => proofs[id]);
  if (!available.length) return null;

  // idx === -1 means "overview" slide (all algorithms)
  const idx = activeAlgo === null ? -1 : available.indexOf(activeAlgo);
  const currentId = idx >= 0 ? available[idx] : null;
  const proof = currentId ? proofs[currentId] : null;
  const color = currentId ? (ALGO_COLORS[currentId] ?? "#888") : "var(--color-muted)";
  const max = proof ? Math.max(...proof.before, ...proof.after, 1) : 1;
  const points = currentId ? (curveData[currentId] ?? []) : [];

  const nav = (delta: number) => {
    const newIdx = idx + delta;
    if (newIdx < 0) onSelect(null);
    else onSelect(available[Math.min(available.length - 1, newIdx)] ?? null);
  };

  const btnStyle = (disabled: boolean): React.CSSProperties => ({
    width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center",
    background: "none", border: "1px solid var(--color-border)", borderRadius: 4,
    cursor: disabled ? "not-allowed" : "pointer", fontSize: 12, lineHeight: 1,
    color: disabled ? "var(--color-border)" : "var(--color-muted)", flexShrink: 0,
  });

  const tokenStyle = (v: number, forceColor = false): React.CSSProperties => {
    const base: React.CSSProperties = {
      display: "inline-block", fontSize: 10, fontFamily: "monospace",
      padding: "2px 5px", borderRadius: 4,
      transition: "background-color 0.5s ease, color 0.35s ease, border-color 0.5s ease",
    };
    if (!forceColor && !revealed) {
      return { ...base, background: "var(--color-surface-3)", color: "var(--color-muted)", border: "1px solid var(--color-border)" };
    }
    const hue = Math.round(220 - (v / max) * 185);
    return { ...base, background: `hsl(${hue},72%,40%)`, color: "#fff", border: `1px solid hsl(${hue},72%,57%)` };
  };

  const dotRow = (
    <div className="flex gap-1 items-center">
      {available.map(id => (
        <button key={id} onClick={() => onSelect(id)}
          title={ALGO_NAMES[id]}
          style={{
            width: 8, height: 8, borderRadius: "50%", padding: 0, border: "none",
            background: ALGO_COLORS[id] ?? "#888",
            opacity: id === currentId ? 1 : 0.3,
            cursor: "pointer", transition: "opacity 0.15s",
          }} />
      ))}
    </div>
  );

  return (
    <div className="mt-3 pt-3" style={{ borderTop: "1px solid var(--color-border)" }}>
      {/* Header: nav + algo name / "All Algorithms" + dot indicators */}
      <div className="flex items-center gap-2 mb-2">
        <button onClick={() => nav(-1)} disabled={idx <= -1} style={btnStyle(idx <= -1)}>‹</button>
        <span style={{ fontSize: 12, fontWeight: 700, color }}>
          {currentId ? (ALGO_NAMES[currentId] ?? currentId) : "All Algorithms"}
        </span>
        {dotRow}
        <button onClick={() => nav(1)} disabled={idx >= available.length - 1} style={btnStyle(idx >= available.length - 1)}>›</button>
        <span className="ml-auto text-xs font-mono" style={{ color: "var(--color-muted)" }}>
          {proof ? `proof from n=${fmtN(proof.n)}` : `${available.length} algorithm${available.length !== 1 ? "s" : ""} measured`}
        </span>
      </div>

      {/* Overview slide: show all algo stats side by side */}
      {currentId === null && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {available.map(id => {
            const pts = curveData[id] ?? [];
            const best = pts.filter(p => !p.timedOut).sort((a, b) => a.timeMs - b.timeMs)[0];
            return (
              <button key={id} onClick={() => onSelect(id)}
                className="text-xs font-mono px-2 py-0.5 rounded text-left"
                style={{
                  background: "var(--color-surface-3)",
                  border: `1px solid ${ALGO_COLORS[id] ?? "var(--color-border)"}`,
                  color: ALGO_COLORS[id] ?? "var(--color-muted)",
                  cursor: "pointer",
                }}>
                {ALGO_NAMES[id]}{best ? ` · ${fmtTime(best.timeMs)} @ n=${fmtN(best.n)}` : ""}
              </button>
            );
          })}
        </div>
      )}

      {/* Properties: time complexity, space, stable, online */}
      {currentId !== null && (
        <div className="mb-1.5 flex flex-wrap gap-1">
          {ALGO_TIME[currentId] && (
            <span className="text-xs font-mono px-2 py-0.5 rounded"
              style={{ background: "var(--color-surface-3)", border: `1px solid ${color}`, color }}>
              time {ALGO_TIME[currentId]}
            </span>
          )}
          {ALGO_SPACE[currentId] && (
            <span className="text-xs font-mono px-2 py-0.5 rounded"
              style={{ background: "var(--color-surface-3)", border: "1px solid var(--color-border)", color: "var(--color-muted)" }}
              title="Auxiliary space: extra memory beyond the input array">
              aux {ALGO_SPACE[currentId]}
            </span>
          )}
          {ALGO_SPACE[currentId] && (
            <span className="text-xs font-mono px-2 py-0.5 rounded"
              style={{ background: "var(--color-surface-3)", border: "1px solid var(--color-border)", color: "var(--color-muted)", opacity: 0.65 }}
              title="Total space: input O(n) + auxiliary">
              total {totalSpaceLabel(currentId)}
            </span>
          )}
          {ALGO_STABLE[currentId] !== undefined && (
            <span className="text-xs font-mono px-2 py-0.5 rounded"
              style={{ background: "var(--color-surface-3)", border: "1px solid var(--color-border)", color: "var(--color-muted)" }}>
              {ALGO_STABLE[currentId] ? "stable" : "unstable"}
            </span>
          )}
          {ALGO_ONLINE[currentId] !== undefined && (
            <span className="text-xs font-mono px-2 py-0.5 rounded"
              style={{ background: "var(--color-surface-3)", border: "1px solid var(--color-border)", color: "var(--color-muted)" }}>
              {ALGO_ONLINE[currentId] ? "online" : "offline"}
            </span>
          )}
        </div>
      )}

      {/* Measurements: all (n, timeMs) pairs with Big-O breakdown + space download */}
      {currentId !== null && points.length > 0 && (
        <div className="mb-2.5 flex flex-wrap gap-1.5">
          {points.map(p => {
            const allocB       = p.allocBytes != null && p.allocBytes > 0 ? p.allocBytes : null;
            const heapDeltaB   = p.spaceBytes != null && p.spaceBytes > 0 ? p.spaceBytes : null;
            const theoreticalB = theoreticalSpaceBytes(currentId, p.n);
            const canDl        = theoreticalB < 1_048_576;
            const handleDl     = () => {
              const arr  = generateBenchmarkInput(p.n, "random");
              const blob = new Blob([JSON.stringify(Array.from(arr))], { type: "application/json" });
              const url  = URL.createObjectURL(blob);
              const a    = document.createElement("a");
              a.href = url; a.download = `${currentId}-n${p.n}.json`; a.click();
              URL.revokeObjectURL(url);
            };
            return (
              <div key={p.n} className="flex flex-col px-2 py-1.5 rounded"
                style={{ background: "var(--color-surface-3)", border: "1px solid var(--color-border)" }}>
                <span className="text-xs font-mono" style={{ color }}>
                  n={fmtN(p.n)} · {p.timedOut ? ">10 s" : fmtTime(p.timeMs)}
                </span>
                <span style={{ fontSize: 8, color: "var(--color-muted)", marginTop: 3, fontFamily: "monospace", display: "flex", alignItems: "center", gap: 4 }}>
                  <span title="Time complexity">{ALGO_TIME[currentId] ?? "—"}</span>
                  <span style={{ opacity: 0.4 }}>·</span>
                  <span title="Auxiliary alloc: bytes counted via patched Array methods (slice/concat/flat/new Array) — extra space beyond the input" style={{ color: allocB != null ? "#4db6ac" : "var(--color-muted)" }}>
                    {allocB != null ? fmtBytes(allocB) : "—"} aux
                  </span>
                  <span style={{ opacity: 0.4 }}>/</span>
                  <span title={`Total space: auxiliary alloc + input (n×8 B = ${fmtBytes(p.n * 8)})`} style={{ color: allocB != null ? "#80cbc4" : "var(--color-muted)", opacity: 0.8 }}>
                    {allocB != null ? fmtBytes(allocB + p.n * 8) : "—"} total
                  </span>
                  <span style={{ opacity: 0.4 }}>/</span>
                  <span title="V8 heap delta (performance.memory — unreliable for fast sorts)" style={{ color: heapDeltaB != null ? "#ffb74d" : "var(--color-muted)" }}>
                    {heapDeltaB != null ? fmtBytes(heapDeltaB) : "—"} heap Δ
                  </span>
                  <span style={{ opacity: 0.4 }}>/</span>
                  <span title="Theoretical auxiliary: worst-case estimate from Big-O class">
                    {fmtBytes(theoreticalB)} est. aux
                  </span>
                  {canDl && (
                    <button onClick={handleDl} title="Download input array as JSON"
                      style={{ color: "var(--color-accent)", background: "none", border: "none", cursor: "pointer", fontSize: 8, padding: 0, lineHeight: 1 }}>
                      ↓
                    </button>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Token rows */}
      {proof && (
        <>
          <div className="mb-2 flex items-start gap-2">
            <span className="text-xs font-mono shrink-0 mt-0.5" style={{ color: "var(--color-muted)", width: 54 }}>unsorted</span>
            <span className="inline-flex flex-wrap gap-1">
              {proof.before.map((v, i) => (
                <span key={i} style={{ ...tokenStyle(v), transitionDelay: `${i * 18}ms` }}>{v.toLocaleString()}</span>
              ))}
            </span>
          </div>
          {revealed && (
            <div className="flex items-start gap-2">
              <span className="text-xs font-mono shrink-0 mt-0.5" style={{ color: "var(--color-muted)", width: 54 }}>sorted</span>
              <span className="inline-flex flex-wrap gap-1">
                {proof.after.map((v, i) => (
                  <span key={i} style={tokenStyle(v, true)}>{v.toLocaleString()}</span>
                ))}
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Algorithm mini-card ────────────────────────────────────────────────────────
// Compact per-algorithm card shown below the performance curve.
// Shows properties + an animated 10-item bar-chart from the silent pre-run,
// or "No benchmark data." before any run has happened.

const MINI_BAR_COLORS = {
  swap:    "#ef5350",
  pivot:   "#64b5f6",
  compare: "#ffc000",
  sorted:  "#66bb6a",
};

const PLACE_EMOJI: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

/** Play 5 calm sine-wave beeps, each lasting exactly `timeMs` ms, then stop.
 *  Pitch maps sort speed: faster → higher frequency. */
function playBeep(timeMs: number) {
  try {
    const ctx = new AudioContext();
    // Log-scale map: 1 ms → ~2000 Hz, 100 ms → ~440 Hz, 10 000 ms → ~150 Hz
    const logMs = Math.log10(Math.max(1, timeMs));
    const t     = Math.max(0, Math.min(1, logMs / 4));
    const freq  = 2000 * Math.pow(150 / 2000, t);

    const dur     = Math.max(0.08, timeMs / 1000);  // seconds, floor 80 ms
    const gap     = 0.05;                            // 50 ms silence between beeps
    const attack  = Math.min(0.04, dur * 0.10);
    const release = Math.min(0.10, dur * 0.20);
    const hold    = Math.max(0, dur - attack - release);

    for (let i = 0; i < 5; i++) {
      const t0  = ctx.currentTime + i * (dur + gap);
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, t0);
      gain.gain.setValueAtTime(0, t0);
      gain.gain.linearRampToValueAtTime(0.18, t0 + attack);
      gain.gain.setValueAtTime(0.18, t0 + attack + hold);
      gain.gain.linearRampToValueAtTime(0, t0 + attack + hold + release);
      osc.start(t0);
      osc.stop(t0 + dur + 0.01);
      if (i === 4) osc.onended = () => ctx.close();
    }
  } catch { /* AudioContext not available */ }
}

function AlgoMiniCard({
  id, steps, benchData, isActive, rank, spaceRank, showBoth, loop, maxSpaceBytes, maxTotalSteps, onStop, pulseEnabled, onTogglePulse,
}: {
  id: string;
  steps: SortStep[] | null;
  benchData: { n: number; timeMs: number; spaceBytes?: number; timedOut?: boolean }[] | null;
  isActive: boolean;
  rank: number | null;
  spaceRank?: number | null;
  showBoth?: boolean;
  loop?: boolean;
  maxSpaceBytes?: number;
  maxTotalSteps?: number;
  onStop?: () => void;
  pulseEnabled?: boolean;
  onTogglePulse?: () => void;
}) {
  const [stepIdx, setStepIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const prevLoopRef = useRef(loop);

  useEffect(() => {
    if (!steps || steps.length === 0) return;
    setStepIdx(0);
    setPlaying(true);
  }, [steps]);

  // Restart loop while benchmark is running; snap to final frame when it finishes
  useEffect(() => {
    if (loop && steps && steps.length > 0) {
      setStepIdx(0);
      setPlaying(true);
    } else if (!loop && prevLoopRef.current && steps && steps.length > 0) {
      // Benchmark just finished — jump straight to the fully-sorted final frame
      setStepIdx(steps.length - 1);
      setPlaying(false);
    }
    prevLoopRef.current = loop;
  }, [loop, steps]);

  useEffect(() => {
    if (!playing || !steps || steps.length === 0) return;
    const timer = setInterval(() => {
      setStepIdx(prev => {
        if (prev >= steps.length - 1) {
          if (loop) return 0; // restart
          setPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, 90);
    return () => clearInterval(timer);
  }, [playing, steps, loop]);

  const color = ALGO_COLORS[id] ?? "#888";
  const step = steps?.[stepIdx] ?? steps?.[steps.length - 1] ?? null;
  const maxVal = step ? Math.max(...step.arr, 1) : 1;
  const N = step?.arr.length ?? 10;
  const BAR_W = 100 / N;

  const bestPoint = benchData?.filter(p => !p.timedOut).sort((a, b) => b.n - a.n)[0] ?? null;

  return (
    <div style={{
      background: "var(--color-surface-1)",
      border: `1px solid ${isActive ? color : "var(--color-border)"}`,
      borderRadius: 7,
      padding: "8px 10px",
      transition: "border-color 0.2s",
    }}>
      {/* Name row */}
      <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 5 }}>
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: color, display: "inline-block", flexShrink: 0 }} />
        <WithAlgoTooltip id={id}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--color-text)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {ALGO_NAMES[id] ?? id}
          </span>
        </WithAlgoTooltip>
        {rank !== null && rank <= 3 && (
          <span style={{ fontSize: 13, lineHeight: 1, flexShrink: 0 }} title={showBoth ? `Time #${rank}` : `#${rank}`}>
            {PLACE_EMOJI[rank]}
          </span>
        )}
        {showBoth && spaceRank != null && spaceRank <= 3 && (
          <span style={{ fontSize: 10, lineHeight: 1, flexShrink: 0, opacity: 0.75 }} title={`Space #${spaceRank}`}>
            {PLACE_EMOJI[spaceRank]}
          </span>
        )}
        {loop && onStop && (
          <button
            onClick={onStop}
            title="Stop this algorithm"
            style={{ background: "none", border: "none", cursor: "pointer", padding: "1px 3px", color: "var(--color-muted)", lineHeight: 1, flexShrink: 0, fontSize: 9, borderRadius: 3 }}
          >
            ✕
          </button>
        )}
        {bestPoint && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 3, flexShrink: 0 }}>
            <span style={{ fontSize: 8, fontFamily: "monospace", color, whiteSpace: "nowrap" }}>
              {fmtTime(bestPoint.timeMs)} @ n={fmtN(bestPoint.n)}
            </span>
            {(() => {
              const spaceBytes = bestPoint.spaceBytes ?? 0;
              const maxSB = maxSpaceBytes ?? spaceBytes;
              if (!spaceBytes || !maxSB) return null;
              const fillDiameter = Math.max(1, (spaceBytes / maxSB) * 20);
              const label = spaceBytes >= 1_048_576 ? `${(spaceBytes / 1_048_576).toFixed(1)} MB` : spaceBytes >= 1024 ? `${(spaceBytes / 1024).toFixed(1)} KB` : `${spaceBytes} B`;
              const pulseDuration = Math.max(150, Math.min(5000, bestPoint.timeMs));
              return (
                <>
                  <span
                    title={pulseEnabled ? "Click to pause pulse" : "Click to resume pulse"}
                    onClick={onTogglePulse}
                    style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 1, flexShrink: 0, cursor: "pointer" }}
                  >
                    <span style={{ position: "relative", width: 20, height: 20, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                      <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "var(--color-surface-3)", border: "1px solid var(--color-border)" }} />
                      <span style={{ position: "relative", width: fillDiameter, height: fillDiameter, borderRadius: "50%", background: color, display: "block", ...(pulseEnabled ? { animationName: "cc-pulse", animationDuration: `${pulseDuration}ms`, animationTimingFunction: "ease-in-out", animationIterationCount: "infinite" } : {}) }} />
                    </span>
                    <span style={{ fontSize: 7, fontFamily: "monospace", color: "var(--color-muted)", whiteSpace: "nowrap", lineHeight: 1 }}>{label}</span>
                  </span>
                  <button
                    title={`Hear sort speed (${fmtTime(bestPoint.timeMs)})`}
                    onClick={e => { e.stopPropagation(); playBeep(bestPoint.timeMs); }}
                    style={{ background: "none", border: "none", cursor: "pointer", padding: "0 1px", color: "var(--color-muted)", display: "inline-flex", alignItems: "center", flexShrink: 0, position: "relative", top: -3 }}
                  >
                    <Volume2 size={10} strokeWidth={1.5} />
                  </button>
                </>
              );
            })()}
          </span>
        )}
      </div>

      {/* Property badges */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 2, marginBottom: 6 }}>
        {ALGO_TIME[id] && (
          <span style={{ fontSize: 7, fontFamily: "monospace", padding: "1px 3px", borderRadius: 3,
            background: "var(--color-surface-3)", border: `1px solid ${color}55`, color }}>
            {ALGO_TIME[id]}
          </span>
        )}
        {ALGO_SPACE[id] && (
          <span style={{ fontSize: 7, fontFamily: "monospace", padding: "1px 3px", borderRadius: 3,
            background: "var(--color-surface-3)", border: "1px solid var(--color-border)", color: "var(--color-muted)" }}
            title="Auxiliary space: extra memory beyond the input array">
            aux {ALGO_SPACE[id]}
          </span>
        )}
        {ALGO_SPACE[id] && (
          <span style={{ fontSize: 7, fontFamily: "monospace", padding: "1px 3px", borderRadius: 3,
            background: "var(--color-surface-3)", border: "1px solid var(--color-border)", color: "var(--color-muted)", opacity: 0.65 }}
            title="Total space: input O(n) + auxiliary">
            total {totalSpaceLabel(id)}
          </span>
        )}
        {ALGO_STABLE[id] !== undefined && (
          <span style={{ fontSize: 7, fontFamily: "monospace", padding: "1px 3px", borderRadius: 3,
            background: "var(--color-surface-3)", border: "1px solid var(--color-border)", color: "var(--color-muted)" }}>
            {ALGO_STABLE[id] ? "stable" : "unstable"}
          </span>
        )}
        {ALGO_ONLINE[id] !== undefined && (
          <span style={{ fontSize: 7, fontFamily: "monospace", padding: "1px 3px", borderRadius: 3,
            background: "var(--color-surface-3)", border: "1px solid var(--color-border)", color: "var(--color-muted)" }}>
            {ALGO_ONLINE[id] ? "online" : "offline"}
          </span>
        )}
      </div>

      {/* Bar chart or placeholder */}
      {step ? (
        <div style={{ position: "relative", overflow: "hidden", borderRadius: 3 }}>
          <svg
            viewBox={`0 0 100 32`}
            preserveAspectRatio="none"
            style={{ width: "100%", height: 32, display: "block", borderRadius: 3, cursor: "pointer" }}
            onClick={() => {
              if (!steps) return;
              if (stepIdx >= steps.length - 1) { setStepIdx(0); setPlaying(true); }
              else setPlaying(p => !p);
            }}
          >
            {step.arr.map((val, i) => {
              const h = Math.max(2, (val / maxVal) * 30);
              const swpSet = new Set(step.swapping);
              const cmpSet = new Set(step.comparing);
              const sortedSet = new Set(step.sorted);
              const fill = swpSet.has(i) ? MINI_BAR_COLORS.swap
                : step.pivot === i ? MINI_BAR_COLORS.pivot
                : cmpSet.has(i) ? MINI_BAR_COLORS.compare
                : sortedSet.has(i) ? MINI_BAR_COLORS.sorted
                : color;
              return (
                <rect key={i}
                  x={i * BAR_W + 0.3} y={32 - h}
                  width={Math.max(0.5, BAR_W - 0.6)} height={h}
                  fill={fill}
                />
              );
            })}
          </svg>
          {/* Progress bar */}
          <div style={{ height: 2, background: "var(--color-surface-3)", marginTop: 3, borderRadius: 1, overflow: "hidden" }}>
            <div style={{
              height: "100%",
              width: `${steps && steps.length > 1 ? (stepIdx / (steps.length - 1)) * 100 : 0}%`,
              background: color,
              borderRadius: 1,
              transition: "width 0.08s linear",
            }} />
          </div>
          {/* Time remaining bar */}
          <div style={{ height: 2, background: "var(--color-surface-3)", marginTop: 1, borderRadius: 1, overflow: "hidden" }}>
            <div style={{
              height: "100%",
              width: `${steps && steps.length > 1 && maxTotalSteps ? ((steps.length - 1 - stepIdx) / maxTotalSteps) * 100 : 0}%`,
              background: color,
              opacity: 0.35,
              borderRadius: 1,
              transition: "width 0.08s linear",
            }} />
          </div>
        </div>
      ) : (
        <div style={{ fontSize: 9, color: "var(--color-muted)", fontStyle: "italic", fontFamily: "monospace" }}>
          No benchmark data.
        </div>
      )}
    </div>
  );
}

// ── Playback strip ─────────────────────────────────────────────────────────────

// ── Shared button style helper ────────────────────────────────────────────────

function btn(
  variant: "primary" | "secondary" | "danger" | "ghost",
  extra?: React.CSSProperties
): React.CSSProperties {
  const base: React.CSSProperties = {
    display: "inline-flex", alignItems: "center", gap: 4,
    padding: "3px 8px", fontSize: 11, fontFamily: "monospace", fontWeight: 500,
    borderRadius: 5, cursor: "pointer", border: "none", userSelect: "none",
    lineHeight: 1.4,
  };
  const variants: Record<string, React.CSSProperties> = {
    primary:   { background: "var(--color-accent)", color: "#fff" },
    danger:    { background: "var(--color-state-swap)", color: "#fff" },
    secondary: { background: "var(--color-surface-1)", border: "1px solid var(--color-border)", color: "var(--color-muted)" },
    ghost:     { background: "none", color: "var(--color-muted)" },
  };
  return { ...base, ...variants[variant], ...extra };
}

// ── Cache miss estimator ──────────────────────────────────────────────────────
// Rough working-set cache level for an array of n 64-bit floats (8 bytes each).
// Thresholds: L1=32 KB → 4096 elems, L2=256 KB → 32768, L3=8 MB → 1048576.
function cacheLevel(id: string, n: number): { label: string; color: string } {
  // Algorithms that access the whole array (merge, counting) use ~2× the data
  const factor = ["merge", "counting", "radix", "bucket", "timsort", "timsort-js"].includes(id) ? 2 : 1;
  const bytes = n * 8 * factor;
  if (bytes <= 32 * 1024)        return { label: "L1",  color: "#66bb6a" };
  if (bytes <= 256 * 1024)       return { label: "L2",  color: "#ffc107" };
  if (bytes <= 8 * 1024 * 1024)  return { label: "L3",  color: "#ff9800" };
  return { label: "RAM", color: "#ef5350" };
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function BenchmarkVisualizer() {
  const { has } = useLevel();
  const [pulseEnabled, setPulseEnabled] = useState<boolean>(() => {
    try { return localStorage.getItem("cc-pulse") !== "off"; } catch { return true; }
  });
  const [customLogosVariants, setCustomLogosVariants] = useState<LogosParams[]>([]);
  const [logosEditVariant, setLogosEditVariant] = useState<number | null>(null); // null=closed, 0-based index
  const [logosAddConfirm, setLogosAddConfirm] = useState(false); // show "create another?" prompt
  const [paramDrafts, setParamDrafts] = useState<Record<string, string>>({}); // keyed by `${variantIdx}.${paramKey}`
  const togglePulse = useCallback(() => {
    setPulseEnabled(prev => {
      const next = !prev;
      try { localStorage.setItem("cc-pulse", next ? "on" : "off"); } catch {}
      return next;
    });
  }, []);

  const [selectedSizes, setSelectedSizes] = useState<Set<number>>(
    new Set([10_000, 100_000, 1_000_000])
  );
  const [scenarios, setScenarios] = useState<Set<BenchmarkScenario>>(
    new Set(["random"] as BenchmarkScenario[])
  );
  const [rounds, setRounds] = useState(3);
  const [warmup, setWarmup] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(
    new Set(["logos", "timsort"])
  );

  const [status, setStatus] = useState<Status>("idle");
  const [curveData, setCurveData] = useState<CurveData>({});
  const [currentN, setCurrentN] = useState<number | null>(null);
  const [currentAlgo, setCurrentAlgo] = useState<string | null>(null);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [runConfig, setRunConfig] = useState<{
    sizes: number[]; scenarios: BenchmarkScenario[]; rounds: number; warmup: number; algos: string[];
  } | null>(null);
  const [sampleProofs, setSampleProofs] = useState<Record<string, { before: number[]; after: number[]; n: number }>>({});
  const [activeProofAlgo, setActiveProofAlgo] = useState<string | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [useWorkerIsolation, setUseWorkerIsolation] = useState(false);
  const [customSortCode, setCustomSortCode] = useState("");
  const [customSortName, setCustomSortName] = useState("");
  const [customSortNotes, setCustomSortNotes] = useState("");
  const [customSortEnabled, setCustomSortEnabled] = useState(false);
  const [customSortOpen, setCustomSortOpen] = useState(false);
  const [savedSorts, setSavedSorts] = useState<{ id: string; name: string; code: string; notes: string; savedAt: string }[]>(() => {
    try { return JSON.parse(localStorage.getItem("codecookbook.savedSorts") ?? "[]"); } catch { return []; }
  });
  const [codeAlgo, setCodeAlgo] = useState<string | null>(null);
  const [codeCopied, setCodeCopied] = useState(false);
  const [customSortError, setCustomSortError] = useState<string | null>(null);
  const [hoverN, setHoverN] = useState<number | null>(null);
  const [hoverBigO, setHoverBigO] = useState<{ id: string; type: "time" | "space" } | null>(null);
  type SortCol = "name" | "speed" | "time" | "tvsb" | "tbigo" | "fit" | "space" | "svsb" | "sbigo";
  const [sortCol, setSortCol] = useState<SortCol>("time");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [chartMode, setChartMode] = useState<"time" | "space" | "ratio" | "space-ratio" | "3d" | "memory" | "product">("time");
  const [adversarialEnabled, setAdversarialEnabled] = useState(false);
  const [miniCardSort, setMiniCardSort] = useState<"time" | "space" | "both">("time");
  const [customInput, setCustomInput] = useState("");
  const [pendingCustomN, setPendingCustomN] = useState<number | null>(null);
  const [customPreSorted, setCustomPreSorted] = useState(0);
  const [customDuplicates, setCustomDuplicates] = useState(0);
  const [quickPivot, setQuickPivot] = useState<QuickPivot>("median3");
  const [shellGaps, setShellGaps] = useState<ShellGaps>("ciura");
  const [shareState, setShareState] = useState<"idle" | "copied">("idle");
  const exportChartPNGRef = useRef<(() => void) | undefined>(undefined);
  const [mdCopied, setMdCopied] = useState(false);
  const resultsRef = useRef<HTMLDivElement>(null);
  const [prerunSteps, setPrerunSteps] = useState<Record<string, SortStep[]>>({});
  const [progressLocked, setProgressLocked] = useState(true);
  const [resultsMaximized, setResultsMaximized] = useState(false);
  const stopRef = useRef(false);
  const excludedRef = useRef<Set<string>>(new Set());
  const algoSleepResolveRef = useRef<(() => void) | null>(null);
  const algoSleepTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Lock chart cursor to the n currently being benchmarked
  useEffect(() => {
    if (progressLocked && status === "running" && currentN !== null) {
      setHoverN(currentN);
    }
  }, [currentN, progressLocked, status]);

  // Decode run config from URL on mount (for shared links)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const algosParam = params.get("algos");
    if (algosParam) {
      const ids = algosParam.split(",").filter(id => SORT_FNS[id] !== undefined);
      if (ids.length > 0) setSelected(new Set(ids));
    }
    const sizesParam = params.get("sizes");
    if (sizesParam) {
      const ns = sizesParam.split(",").map(Number).filter(n => n > 0 && Number.isFinite(n));
      if (ns.length > 0) setSelectedSizes(new Set(ns));
    }
    const scParam = params.get("sc");
    if (scParam) {
      const valid = scParam.split(",").filter(s => SCENARIO_OPTIONS.some(o => o.id === s)) as BenchmarkScenario[];
      if (valid.length > 0) setScenarios(new Set(valid));
    }
    const roundsVal = Number(params.get("rounds"));
    if (roundsVal >= 1 && roundsVal <= 50) setRounds(roundsVal);
    const warmupVal = Number(params.get("warmup"));
    if (warmupVal >= 0 && warmupVal <= 49) setWarmup(warmupVal);
    const pivotParam = params.get("pivot");
    if (pivotParam && (["first","last","median3","random"] as string[]).includes(pivotParam)) setQuickPivot(pivotParam as QuickPivot);
    const gapsParam = params.get("gaps");
    if (gapsParam && (["shell","hibbard","sedgewick","ciura"] as string[]).includes(gapsParam)) setShellGaps(gapsParam as ShellGaps);
    const preSortedVal = Number(params.get("preSorted"));
    if (preSortedVal >= 0 && preSortedVal <= 100) setCustomPreSorted(preSortedVal);
    const dupsVal = Number(params.get("dups"));
    if (dupsVal >= 0 && dupsVal <= 100) setCustomDuplicates(dupsVal);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Encode current config into URL so Share button copies a valid link
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams();
    if (selected.size) params.set("algos", [...selected].join(","));
    if (selectedSizes.size) params.set("sizes", [...selectedSizes].join(","));
    const sc = [...scenarios];
    if (sc.length && !(sc.length === 1 && sc[0] === "random")) params.set("sc", sc.join(","));
    if (rounds !== 3) params.set("rounds", String(rounds));
    if (warmup !== 1) params.set("warmup", String(warmup));
    if (quickPivot !== "median3") params.set("pivot", quickPivot);
    if (shellGaps !== "ciura") params.set("gaps", shellGaps);
    if (customPreSorted !== 0) params.set("preSorted", String(customPreSorted));
    if (customDuplicates !== 0) params.set("dups", String(customDuplicates));
    const q = params.toString();
    window.history.replaceState(null, "", q ? "?" + q : window.location.pathname);
  }, [selected, selectedSizes, scenarios, rounds, warmup, quickPivot, shellGaps, customPreSorted, customDuplicates]);

  // Auto-scroll results pane into view when run finishes
  useEffect(() => {
    if (status === "done" && resultsRef.current) {
      resultsRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [status]);

  // Slow algos are disabled if the largest selected size exceeds the threshold
  const maxSelectedSize = selectedSizes.size > 0 ? Math.max(...selectedSizes) : 0;
  const slowDisabled = (id: string) =>
    (SLOW_IDS.has(id) && maxSelectedSize > SLOW_THRESHOLD) ||
    (MEDIUM_LIMITS[id] !== undefined && maxSelectedSize > MEDIUM_LIMITS[id].threshold) ||
    (!UNLIMITED_IDS.has(id) && maxSelectedSize > LARGE_THRESHOLD);

  const toggleAlgo = (id: string) => {
    if (slowDisabled(id)) return;
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleGroup = (ids: readonly string[]) => {
    const active = ids.filter(id => !slowDisabled(id));
    if (!active.length) return;
    const allOn = active.every(id => selected.has(id));
    setSelected(prev => {
      const next = new Set(prev);
      allOn
        ? active.forEach(id => next.delete(id))
        : active.forEach(id => next.add(id));
      return next;
    });
  };

  const removeSize = (n: number) => {
    setSelectedSizes(prev => {
      const next = new Set(prev);
      next.delete(n);
      return next;
    });
  };

  const addSize = (n: number) => {
    setSelectedSizes(prev => new Set([...prev, n]));
  };

  const submitCustomN = (raw: string) => {
    const n = Math.floor(Number(raw.replace(/[^0-9]/g, "")));
    if (!n || n < 1) { setCustomInput(""); return; }
    if (n > 100_000_000) {
      setPendingCustomN(n);
    } else {
      addSize(n);
      setCustomInput("");
    }
  };

  const confirmCustomN = () => {
    if (pendingCustomN !== null) { addSize(pendingCustomN); setPendingCustomN(null); setCustomInput(""); }
  };

  const cancelCustomN = () => { setPendingCustomN(null); };


  const sortedSizes = [...selectedSizes].sort((a, b) => a - b);
  const activeAlgos = [...selected].filter(id => !slowDisabled(id));

  const exportCSV = () => {
    const rows: (string | number)[][] = [
      ["algo", "n", "timeMs_best", "timeMs_mean", "timeMs_stdDev", "spaceBytes", "timedOut", "scenarios"],
    ];
    for (const [id, pts] of Object.entries(curveDataExt)) {
      if (id === "timsort-js" && !curveData["timsort-js"]?.length) continue; // skip if not measured
      for (const p of pts) {
        rows.push([
          id, p.n,
          p.timeMs.toFixed(4),
          p.meanMs != null ? p.meanMs.toFixed(4) : "",
          p.stdDev != null ? p.stdDev.toFixed(4) : "",
          p.spaceBytes ?? "",
          p.timedOut ? 1 : 0,
          runConfig?.scenarios.join("|") ?? "",
        ]);
      }
    }
    const csv = rows.map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "benchmark.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const exportMarkdown = () => {
    const algos = Object.keys(curveDataExt);
    const sizes = [...selectedSizes].sort((a, b) => a - b);
    const header = ["Algorithm", ...sizes.map(n => `n=${fmtN(n)}`)].join(" | ");
    const sep = ["---", ...sizes.map(() => "---:")].join(" | ");
    const rows = algos.map(id => {
      const name = ALGO_NAMES[id] ?? id;
      const cells = sizes.map(n => {
        const pt = curveDataExt[id]?.find(p => p.n === n);
        if (!pt) return "—";
        if (pt.timedOut) return "timeout";
        return fmtTime(pt.timeMs);
      });
      return [name, ...cells].join(" | ");
    });
    const md = [`| ${header} |`, `| ${sep} |`, ...rows.map(r => `| ${r} |`)].join("\n");
    navigator.clipboard.writeText(md).then(() => {
      setMdCopied(true);
      setTimeout(() => setMdCopied(false), 1500);
    });
  };

  const canRun = activeAlgos.length > 0 && selectedSizes.size > 0 && scenarios.size > 0 && status !== "running";
  const canRunCustomOnly = customSortEnabled && !!customSortCode.trim() && !customSortError && selectedSizes.size > 0 && scenarios.size > 0 && status !== "running";

  const getLogosCustomParams = (id: string): LogosParams | null => {
    const m = id.match(/^logos-custom-(\d+)$/);
    if (!m) return null;
    return customLogosVariants[parseInt(m[1]) - 1] ?? DEFAULT_LOGOS_PARAMS;
  };

  const run = useCallback(async (algoOverride?: string[]) => {
    const maxSz = selectedSizes.size > 0 ? Math.max(...selectedSizes) : 0;
    // Mirror slowDisabled exactly so the run list matches the checked-off checkboxes.
    const algos = algoOverride ?? [...selected, ...(customSortEnabled && customSortCode.trim() ? ["custom"] : [])].filter(id =>
      id === "custom" || (
        !(SLOW_IDS.has(id) && maxSz > SLOW_THRESHOLD) &&
        !(MEDIUM_LIMITS[id] !== undefined && maxSz > MEDIUM_LIMITS[id].threshold) &&
        !(!UNLIMITED_IDS.has(id) && maxSz > LARGE_THRESHOLD)
      )
    );
    // Auto-inject logos-custom-N for each variant that differs from defaults
    if (algos.includes("logos")) {
      let insertIdx = algos.indexOf("logos") + 1;
      customLogosVariants.forEach((params, i) => {
        const id = `logos-custom-${i + 1}`;
        if (!algos.includes(id)) {
          algos.splice(insertIdx, 0, id);
          insertIdx++;
        }
      });
    }
    const scenarioList = [...scenarios] as BenchmarkScenario[];
    if (!algos.length || !selectedSizes.size || !scenarioList.length) return;

    const sizes = [...selectedSizes].sort((a, b) => a - b);
    const total = sizes.length * algos.length;

    stopRef.current = false;
    excludedRef.current = new Set();
    setStatus("running");
    setCurveData({});
    setSampleProofs({});
    setActiveProofAlgo(null);
    setHoverN(null);
    setProgress({ done: 0, total });
    setRunConfig({ sizes, scenarios: scenarioList, rounds, warmup, algos });

    // Encode run config into the URL for easy sharing
    if (typeof window !== "undefined") {
      const p = new URLSearchParams();
      p.set("algos", algos.join(","));
      p.set("sizes", sizes.join(","));
      p.set("sc", scenarioList.join(","));
      p.set("rounds", String(rounds));
      p.set("warmup", String(warmup));
      if (algos.includes("quick")) p.set("pivot", quickPivot);
      if (algos.includes("shell")) p.set("gaps", shellGaps);
      if (customPreSorted > 0) p.set("preSorted", String(customPreSorted));
      if (customDuplicates > 0) p.set("dups", String(customDuplicates));
      history.replaceState(null, "", `?${p.toString()}`);
    }

    let done = 0;
    const acc: CurveData = {};
    const timedOutAlgos = new Set<string>();
    const capturedAlgos = new Set<string>();

    // ── Silent 10-item pre-run: populate chart + mini-cards immediately ────────
    const PRERUN_N = 10;
    const prerunArr = generateBenchmarkInput(PRERUN_N, "random");
    const prerunStepsAcc: Record<string, SortStep[]> = {};
    for (const id of algos) {
      const fn = id === "custom"                       ? (() => { try { return new Function("return (" + customSortCode + ")")() as (arr: number[]) => void; } catch { return null; } })() :
                 id === "quick"                        ? makeQuickSort(quickPivot) :
                 id === "shell"                        ? makeShellSort(shellGaps) :
                 getLogosCustomParams(id) !== null     ? makeLogosSort(getLogosCustomParams(id)!) :
                 id === "logos"                        ? makeLogosSort(DEFAULT_LOGOS_PARAMS) :
                 SORT_FNS[id];
      if (!fn) continue;
      const stepsArr: SortStep[] = [];
      if (id === "logos" || /^logos-custom-\d+$/.test(id)) {
        const params = getLogosCustomParams(id) ?? DEFAULT_LOGOS_PARAMS;
        for (const s of getLogosSortSteps([...prerunArr], params)) {
          // Convert types.ts SortStep {array, states} → benchmark.ts SortStep {arr, comparing, swapping, sorted, pivot}
          const comparing: number[] = [], swapping: number[] = [], sorted: number[] = [];
          let pivot: number | undefined;
          s.states.forEach((st, i) => {
            if (st === "comparing" || st === "current") comparing.push(i);
            else if (st === "swapping") swapping.push(i);
            else if (st === "sorted") sorted.push(i);
            else if (st === "pivot") pivot = i;
          });
          stepsArr.push({ arr: s.array, comparing, swapping, sorted, pivot } as unknown as SortStep);
          if (stepsArr.length > 50_000) break;
        }
      } else if (id !== "custom") {
        for (const s of sortSteps(id, [...prerunArr])) { stepsArr.push(s); if (stepsArr.length > 50_000) break; }
      }
      prerunStepsAcc[id] = stepsArr;
      const pCopy = [...prerunArr];
      const pt0 = performance.now();
      fn(pCopy);
      const prerunMs = performance.now() - pt0;
      if (!acc[id]) acc[id] = [];
      acc[id].push({ n: PRERUN_N, timeMs: prerunMs, spaceBytes: theoreticalSpaceBytes(id, PRERUN_N) });
    }
    setPrerunSteps(prerunStepsAcc);
    setCurveData(Object.fromEntries(Object.entries(acc).map(([k, v]) => [k, [...v]])));
    await new Promise<void>(r => setTimeout(r, 0));
    // ─────────────────────────────────────────────────────────────────────────

    for (const sz of sizes) {
      if (stopRef.current) break;
      setCurrentN(sz);

      // Generate inputs once per size so every algorithm sorts the exact same data each round
      const customDist: CustomDistribution | undefined =
        customPreSorted > 0 || customDuplicates > 0
          ? { preSortedPct: customPreSorted, duplicatePct: customDuplicates }
          : undefined;
      // Build weighted pool: "sorted" appears once, all others three times — so it's rare in the mix.
      const weightedScenarios = scenarioList.flatMap(sc => sc === "sorted" ? [sc] : [sc, sc, sc]);
      const roundInputs = Array.from({ length: rounds }, () => {
        const sc = weightedScenarios[Math.floor(Math.random() * weightedScenarios.length)];
        return generateBenchmarkInput(sz, sc, customDist);
      });

      for (const id of algos) {
        if (stopRef.current) break;
        if (timedOutAlgos.has(id) || excludedRef.current.has(id)) { done++; setProgress({ done, total }); continue; }
        setCurrentAlgo(id);
        await new Promise<void>(resolve => {
          algoSleepResolveRef.current = resolve;
          algoSleepTimerRef.current = setTimeout(() => { resolve(); algoSleepResolveRef.current = null; algoSleepTimerRef.current = null; }, 0);
        });
        if (excludedRef.current.has(id)) { done++; setProgress({ done, total }); continue; }

        const fn = id === "custom"                      ? (() => { try { return new Function("return (" + customSortCode + ")")() as (arr: number[]) => void; } catch { return null; } })() :
                   id === "quick"                       ? makeQuickSort(quickPivot) :
                   id === "shell"                       ? makeShellSort(shellGaps) :
                   getLogosCustomParams(id) !== null    ? makeLogosSort(getLogosCustomParams(id)!) :
                   id === "logos"                       ? makeLogosSort(DEFAULT_LOGOS_PARAMS) :
                   SORT_FNS[id];
        if (!fn) { done++; setProgress({ done, total }); continue; }

        // Hoist adversarial round count so both worker and normal paths can use it
        const algoRoundInputs = adversarialEnabled
          ? [...roundInputs, makeAdversarialInput(id, sz, quickPivot)]
          : roundInputs;
        const algoRounds = adversarialEnabled ? rounds + 1 : rounds;

        // ── Worker isolation path ─────────────────────────────────────────────
        if (useWorkerIsolation) {
          const workerInputs = roundInputs.slice(0, algoRounds);
          const logosP = getLogosCustomParams(id) ?? (id === "logos" ? DEFAULT_LOGOS_PARAMS : undefined);
          const result = await new Promise<{ timeMs: number; meanMs: number; stdDev: number; timedOut: boolean }>((resolve) => {
            const w = new Worker(new URL("../lib/benchmarkWorker", import.meta.url));
            w.onmessage = (e: MessageEvent) => { w.terminate(); resolve(e.data); };
            w.onerror = () => { w.terminate(); resolve({ timeMs: 0, meanMs: 0, stdDev: 0, timedOut: false }); };
            w.postMessage({
              runId: Date.now().toString(),
              algoId: id,
              n: sz,
              inputs: workerInputs,
              warmup,
              quickPivot: id === "quick" ? quickPivot : undefined,
              shellGaps: id === "shell" ? shellGaps : undefined,
              logosParams: logosP,
              adversarialInput: adversarialEnabled ? makeAdversarialInput(id, sz, quickPivot) : undefined,
              customFnStr: id === "custom" ? customSortCode : undefined,
            });
          });
          if (!acc[id]) acc[id] = [];
          acc[id].push({
            n: sz, timeMs: result.timeMs, meanMs: result.meanMs, stdDev: result.stdDev,
            spaceBytes: theoreticalSpaceBytes(id, sz),
            timedOut: result.timedOut || undefined,
          });
          if (result.timedOut) timedOutAlgos.add(id);
          done++;
          setProgress({ done, total });
          setCurveData(Object.fromEntries(Object.entries(acc).map(([k, v]) => [k, [...v]])));
          if (progressLocked) setHoverN(sz);
          await new Promise<void>(r => setTimeout(r, 0));
          continue;
        }
        // ── End worker isolation path ─────────────────────────────────────────

        let best = Infinity;
        let didTimeout = false;
        let lastElapsed = 0;
        const postWarmupTimes: number[] = [];

        for (let r = 0; r < algoRounds && !didTimeout; r++) {
          const input = algoRoundInputs[r];

          // Capture per-algo proof on first encounter
          if (!capturedAlgos.has(id)) {
            const SAMPLE = 20;
            const step = Math.max(1, Math.floor(input.length / SAMPLE));
            const before = Array.from({ length: SAMPLE }, (_, i) => input[i * step]);
            const proofCopy = [...input];
            const sortedResult = fn(proofCopy);
            const sortedArr = sortedResult ?? proofCopy;
            const after = Array.from({ length: SAMPLE }, (_, i) => (sortedArr as number[])[i * step]);
            setSampleProofs(prev => prev[id] ? prev : { ...prev, [id]: { before, after, n: sz } });
            capturedAlgos.add(id);
          }

          const copy = [...input];
          const t0 = performance.now();
          fn(copy);
          lastElapsed = performance.now() - t0;

          if (lastElapsed >= TIMEOUT_MS) { didTimeout = true; best = lastElapsed; break; }
          if (r >= warmup) {
            best = Math.min(best, lastElapsed);
            postWarmupTimes.push(lastElapsed);
          }
        }

        // Edge case: all rounds were warmup — use the last timing
        if (best === Infinity && !didTimeout) { best = lastElapsed; postWarmupTimes.push(lastElapsed); }

        // Compute mean and std dev for error bands
        let meanMs: number | undefined;
        let stdDev: number | undefined;
        if (postWarmupTimes.length > 0) {
          meanMs = postWarmupTimes.reduce((s, v) => s + v, 0) / postWarmupTimes.length;
          if (postWarmupTimes.length > 1) {
            const variance = postWarmupTimes.reduce((s, v) => s + (v - meanMs!) ** 2, 0) / postWarmupTimes.length;
            stdDev = Math.sqrt(variance);
          }
        }

        // Space measurement — fresh input, separate pass so it doesn't skew timing.
        // 1. measureAllocBytes: monkey-patches Array methods to count bytes allocated.
        //    Reliable for all algorithms regardless of speed.
        // 2. performance.memory: V8-only heap delta — kept as secondary cross-check
        //    but unreliable for fast algorithms (GC snapshot updates lazily).
        let spaceBytes: number;
        let allocBytes: number | undefined;
        if (!didTimeout) {
          const spaceInput = generateBenchmarkInput(sz, scenarioList[0], customDist);
          allocBytes = measureAllocBytes(() => fn([...spaceInput]));

          const perfMem = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
          let heapDelta = 0;
          if (perfMem) {
            const spaceInput2 = generateBenchmarkInput(sz, scenarioList[0], customDist);
            const m0 = perfMem.usedJSHeapSize;
            fn(spaceInput2);
            const m1 = perfMem.usedJSHeapSize;
            heapDelta = Math.max(0, m1 - m0);
          }
          spaceBytes = heapDelta > 0 ? heapDelta : theoreticalSpaceBytes(id, sz);
        } else {
          spaceBytes = theoreticalSpaceBytes(id, sz);
        }

        if (!acc[id]) acc[id] = [];
        acc[id].push({ n: sz, timeMs: best, meanMs, stdDev, spaceBytes, allocBytes, timedOut: didTimeout || undefined });
        if (didTimeout) timedOutAlgos.add(id);

        done++;
        setCurveData(Object.fromEntries(Object.entries(acc).map(([k, v]) => [k, [...v]])));
        setProgress({ done, total });
        await new Promise<void>(r => setTimeout(r, 0));
      }
    }

    setCurrentN(null);
    setCurrentAlgo(null);
    setStatus("done");

  }, [selected, selectedSizes, scenarios, rounds, warmup, customPreSorted, customDuplicates, quickPivot, shellGaps, customLogosVariants, adversarialEnabled, useWorkerIsolation, customSortEnabled, customSortCode]); // eslint-disable-line react-hooks/exhaustive-deps

  const stop = () => { stopRef.current = true; };

  // Keyboard shortcut: R = run/stop, Escape = close maximize
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setResultsMaximized(false); return; }
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key !== "r" && e.key !== "R") return;
      if (status === "running") stop();
      else if (canRun) run();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, canRun]);

  const stopAlgo = (id: string) => {
    excludedRef.current.add(id);
    // If the run loop is currently sleeping before this algo, wake it immediately
    if (algoSleepTimerRef.current !== null) {
      clearTimeout(algoSleepTimerRef.current);
      algoSleepTimerRef.current = null;
      algoSleepResolveRef.current?.();
      algoSleepResolveRef.current = null;
    }
    setSelected(prev => { const next = new Set(prev); next.delete(id); return next; });
  };

  const reset = () => {
    stopRef.current = true;
    setStatus("idle");
    setCurveData({});
    setSampleProofs({});
    setPrerunSteps({});
    setActiveProofAlgo(null);
    setHoverN(null);
    setCurrentN(null);
    setCurrentAlgo(null);
    setRunConfig(null);
  };

  const chartAlgosBase = runConfig?.algos ?? activeAlgos;
  const chartAlgos = chartAlgosBase;
  const chartSizes = runConfig?.sizes ?? sortedSizes;

  // timsort-js is now a real measured algorithm — pass curveData through directly
  const curveDataExt: CurveData = curveData;

  // Summary table: rankings at the largest completed n
  const completedNs = new Set(
    Object.values(curveData).flatMap(pts => pts.map(p => p.n))
  );
  const largestDone = completedNs.size > 0 ? Math.max(...completedNs) : null;
  const summaryResults: SummaryResult[] = largestDone !== null
    ? chartAlgos
        .filter(id => curveDataExt[id]?.some(p => p.n === largestDone && !p.timedOut))
        .map(id => ({
          id,
          timeMs: curveDataExt[id]!.find(p => p.n === largestDone)!.timeMs,
        }))
        .sort((a, b) => a.timeMs - b.timeMs)
        .map((r, i) => ({ ...r, rank: i + 1 }))
    : [];

  const summarySpaceResults: SummaryResult[] = largestDone !== null
    ? chartAlgos
        .filter(id => curveDataExt[id]?.some(p => p.n === largestDone && !p.timedOut))
        .map(id => {
          const pt = curveDataExt[id]!.find(p => p.n === largestDone)!;
          return { id, timeMs: pt.spaceBytes ?? theoreticalSpaceBytes(id, largestDone) };
        })
        .sort((a, b) => a.timeMs - b.timeMs)
        .map((r, i) => ({ ...r, rank: i + 1 }))
    : [];

  const summaryFastest = summaryResults[0]?.timeMs ?? 1;
  const summarySlowest = summaryResults.at(-1)?.timeMs ?? 1;

  // Calibrate Big-O reference lines: anchor O(n log n) to fastest real time at smallest valid n
  const calibN = chartSizes.find(n => n >= 2);
  let calibC = 0;
  if (calibN !== undefined) {
    let fastest = Infinity;
    for (const id of chartAlgos) {
      const pt = curveData[id]?.find(p => p.n === calibN && !p.timedOut);
      if (pt && pt.timeMs < fastest) fastest = pt.timeMs;
    }
    if (fastest < Infinity) calibC = fastest / (calibN * Math.log2(calibN));
  }

  type RefRow = { kind: "ref"; label: string; color: string; timeMs: number };
  type AlgoRow = SummaryResult & { kind: "algo" };
  type TableRow = AlgoRow | RefRow;

  const refRows: RefRow[] = calibC > 0 && largestDone !== null
    ? BIG_O_REFS.map(ref => ({
        kind: "ref" as const,
        label: ref.label,
        color: ref.color,
        timeMs: calibC * ref.fn(largestDone),
      }))
    : [];

  const tableRows: TableRow[] = [
    ...summaryResults.map(r => ({ ...r, kind: "algo" as const })),
    ...refRows,
  ].sort((a, b) => a.timeMs - b.timeMs);
  const hasCurveData = Object.values(curveData).some(pts => pts.length > 0);

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ position: "relative" }}>
    <style>{`
      @media print {
        .print\\:hidden { display: none !important; }
        body { background: white !important; color: black !important; }
        [style*="--color-surface"] { background: white !important; }
        [style*="--color-text"] { color: black !important; }
        [style*="--color-muted"] { color: #555 !important; }
        [style*="--color-border"] { border-color: #ccc !important; }
        svg text { fill: #000 !important; }
        svg line, svg polyline, svg path { stroke: currentColor; }
      }
    `}</style>

      {/* Warning modal — n > 100,000,000 */}
      {pendingCustomN !== null && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 50,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "rgba(0,0,0,0.55)", backdropFilter: "blur(2px)",
        }}>
          <div style={{
            background: "var(--color-surface-2)", border: "1px solid var(--color-state-swap)",
            borderRadius: 12, padding: "24px 28px", maxWidth: 360, width: "90%",
            boxShadow: "0 8px 40px rgba(0,0,0,0.4)",
          }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: "var(--color-state-swap)", marginBottom: 8 }}>
              ⚠ Large input warning
            </p>
            <p style={{ fontSize: 11, color: "var(--color-text)", marginBottom: 6, lineHeight: 1.5 }}>
              n = <span style={{ fontFamily: "monospace", fontWeight: 700 }}>{pendingCustomN.toLocaleString()}</span> is above 100,000,000.
            </p>
            <p style={{ fontSize: 11, color: "var(--color-muted)", marginBottom: 20, lineHeight: 1.5 }}>
              Allocating and sorting an array this large may take a very long time or freeze the browser tab. Only Logos Sort and Tim Sort are allowed at this size.
            </p>
            <div className="flex gap-2 justify-end">
              <button onClick={cancelCustomN} style={btn("secondary", { padding: "4px 14px" })}>
                Cancel
              </button>
              <button onClick={confirmCustomN} style={btn("danger", { padding: "4px 14px" })}>
                Add anyway
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Header */}
      <div
        className="flex flex-col gap-0.5 px-5 pt-5 pb-3"
        style={{ borderBottom: "1px solid var(--color-border)" }}
      >
        <div className="flex items-center gap-2">
          <LineChart size={18} style={{ color: "var(--color-accent)" }} strokeWidth={1.75} />
          <h1 className="text-xl font-bold">Algorithm Benchmark</h1>
        </div>
        <p className="text-xs" style={{ color: "var(--color-muted)" }}>
          Plot algorithms on a performance curve across multiple input sizes. Each algorithm becomes a line; input size is the x-axis.
        </p>
      </div>

      {/* Body: single scroll on mobile, 50/50 split on desktop */}
      <div className="flex-1 overflow-y-auto lg:overflow-hidden flex flex-col lg:flex-row pb-20 lg:pb-0">

        {/* ── Left pane: config ── */}
        <div
          className="lg:w-1/2 lg:overflow-y-auto border-b lg:border-b-0 lg:border-r"
          style={{ borderColor: "var(--color-border)" }}
        >
          <div className="px-5 py-4">
            <div
              className="rounded-xl p-4"
              style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)" }}
            >
              {/* Input sizes */}
              <div className="mb-4">
                <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-muted)" }}>
                  Input sizes (n)
                  {sortedSizes.length > 0 && (
                    <span className="ml-1.5 font-normal normal-case" style={{ color: "var(--color-text)" }}>
                      · {sortedSizes.length} selected
                    </span>
                  )}
                </span>

                {/* Presets */}
                <div className="print:hidden flex gap-1.5 mt-2 mb-1.5 flex-wrap items-center">
                  {([
                    { label: "Small",  sizes: [100, 1_000, 10_000] },
                    { label: "Medium", sizes: [1_000, 10_000, 100_000] },
                    { label: "Large",  sizes: [100_000, 1_000_000, 10_000_000] },
                  ] as const).map(({ label, sizes }) => (
                    <button
                      key={label}
                      onClick={() => { setSelectedSizes(new Set(sizes)); }}
                      style={btn("secondary", { fontSize: 9, padding: "2px 8px" })}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <div className="print:hidden flex flex-wrap gap-1.5 mt-2">
                  {SIZE_BUTTONS.map(({ n }) => {
                    const on = selectedSizes.has(n);
                    const disabled = !UNLIMITED_IDS.has([...selected][0] ?? "") && n > LARGE_THRESHOLD && selected.size > 0 && [...selected].every(id => !UNLIMITED_IDS.has(id));
                    return (
                      <button
                        key={n}
                        onClick={() => on ? removeSize(n) : addSize(n)}
                        disabled={disabled}
                        style={btn(on ? "primary" : "secondary", {
                          flexDirection: "column", padding: "3px 7px",
                          background: on ? "rgba(139,58,42,0.12)" : "var(--color-surface-1)",
                          border: `1px solid ${on ? "var(--color-accent)" : "var(--color-border)"}`,
                          color: on ? "var(--color-accent)" : "var(--color-muted)",
                          cursor: disabled ? "not-allowed" : "pointer",
                          opacity: disabled ? 0.35 : 1, minWidth: 52,
                        })}
                      >
                        <span style={{ fontSize: 9, fontFamily: "monospace", fontWeight: on ? 700 : 500, lineHeight: 1.2 }}>
                          {n.toLocaleString()}
                        </span>
                      </button>
                    );
                  })}

                  {/* Remove all */}
                  <button
                    onClick={() => setSelectedSizes(new Set())}
                    disabled={selectedSizes.size === 0}
                    style={btn("secondary", {
                      flexDirection: "column", padding: "3px 10px",
                      cursor: selectedSizes.size === 0 ? "not-allowed" : "pointer",
                      opacity: selectedSizes.size === 0 ? 0.35 : 1, minWidth: 52,
                    })}
                  >
                    <span style={{ fontSize: 9, fontFamily: "monospace", fontWeight: 500, lineHeight: 1.2 }}>Clear</span>
                  </button>
                </div>

                {/* Custom n input */}
                <form
                  className="print:hidden flex items-center gap-1.5 mt-2"
                  onSubmit={e => { e.preventDefault(); submitCustomN(customInput); }}
                >
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="Custom"
                    value={customInput}
                    onChange={e => setCustomInput(e.target.value)}
                    style={{
                      flex: 1, minWidth: 0, padding: "4px 8px", fontSize: 11, fontFamily: "monospace",
                      borderRadius: 6, border: "1px solid var(--color-border)",
                      background: "var(--color-surface-1)", color: "var(--color-text)",
                      outline: "none",
                    }}
                  />
                  <button type="submit" style={btn("secondary")}>Add</button>
                </form>

                {/* Custom sizes (not in SIZE_BUTTONS) shown as removable chips */}
                {[...selectedSizes].filter(n => !SIZE_BUTTONS.some(b => b.n === n)).sort((a,b)=>a-b).map(n => (
                  <span key={n} className="inline-flex items-center gap-1 mt-1.5 mr-1.5 px-2 py-0.5 rounded text-xs font-mono"
                    style={{ background: "rgba(139,58,42,0.12)", border: "1px solid var(--color-accent)", color: "var(--color-accent)" }}>
                    {n.toLocaleString()}
                    <button onClick={() => removeSize(n)} style={{
                      background: "none", border: "none", cursor: "pointer",
                      color: "var(--color-accent)", fontSize: 11, lineHeight: 1, padding: 0, marginLeft: 2,
                    }}>×</button>
                  </span>
                ))}
              </div>

              {/* Scenario presets */}
              <div className="mb-4 print:hidden">
                <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--color-muted)" }}>Quick presets</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                  {SCENARIO_PRESETS.map(preset => (
                    <button
                      key={preset.label}
                      title={preset.desc}
                      onClick={() => {
                        setSelected(new Set(preset.algos as unknown as string[]));
                        setSelectedSizes(new Set(preset.sizes as unknown as number[]));
                        setScenarios(new Set(preset.scenarios));
                        if (preset.pivot) setQuickPivot(preset.pivot);
                      }}
                      style={{
                        padding: "2px 9px", fontSize: 9, borderRadius: 4, cursor: "pointer",
                        background: "var(--color-surface-1)", border: "1px solid var(--color-border)",
                        color: "var(--color-muted)", whiteSpace: "nowrap",
                      }}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Algorithm checkboxes */}
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2.5">
                  <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-muted)" }}>
                    Algorithms
                  </p>
                  <button
                    onClick={() => {
                      const allIds = ALGO_GROUPS.flatMap(g => g.items.map(i => i.id)).filter(id => !slowDisabled(id));
                      const allOn = allIds.every(id => selected.has(id));
                      setSelected(allOn ? new Set() : new Set(allIds));
                    }}
                    style={btn("ghost", { fontSize: 9, padding: "1px 6px", textDecoration: "underline", textDecorationStyle: "dotted",
                      color: ALGO_GROUPS.flatMap(g => g.items.map(i => i.id)).filter(id => !slowDisabled(id)).every(id => selected.has(id)) ? "var(--color-accent)" : "var(--color-muted)" })}
                  >
                    {ALGO_GROUPS.flatMap(g => g.items.map(i => i.id)).filter(id => !slowDisabled(id)).every(id => selected.has(id)) ? "Deselect all" : "Select all"}
                  </button>
                </div>
                <div className="flex flex-col gap-3">
                  {ALGO_GROUPS.map(group => {
                    const groupIds = group.items.map(i => i.id);
                    const activeIds = groupIds.filter(id => !slowDisabled(id));
                    const allOn = activeIds.length > 0 && activeIds.every(id => selected.has(id));
                    const someOn = activeIds.some(id => selected.has(id));

                    return (
                      <div key={group.label}>
                        <div className="flex items-center gap-2 mb-1.5">
                          <button
                            onClick={() => toggleGroup(groupIds)}
                            disabled={activeIds.length === 0}
                            style={{
                              color: someOn ? "var(--color-accent)" : "var(--color-muted)",
                              background: "none",
                              border: "none",
                              cursor: activeIds.length === 0 ? "default" : "pointer",
                              padding: 0,
                              fontSize: 11,
                              fontWeight: 600,
                              textDecoration: "underline",
                              textDecorationStyle: "dotted",
                              opacity: activeIds.length === 0 ? 0.4 : 1,
                            }}
                          >
                            {allOn ? "Deselect all" : "Select all"}
                          </button>
                          <span className="text-xs" style={{ color: "var(--color-muted)" }}>
                            — {group.label}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {group.items.map(item => {
                            const disabled = slowDisabled(item.id);
                            const checked = selected.has(item.id) && !disabled;
                            const dotColor = ALGO_COLORS[item.id];
                            return (
                              <React.Fragment key={item.id}>
                              <label
                                className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs select-none"
                                style={{
                                  background: checked ? "rgba(139,58,42,0.08)" : "var(--color-surface-1)",
                                  border: `1px solid ${checked ? "var(--color-accent)" : "var(--color-border)"}`,
                                  color: disabled ? "var(--color-muted)" : "var(--color-text)",
                                  opacity: disabled ? 0.4 : 1,
                                  cursor: disabled ? "not-allowed" : "pointer",
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  disabled={disabled}
                                  onChange={() => toggleAlgo(item.id)}
                                  style={{ accentColor: "var(--color-accent)", cursor: disabled ? "not-allowed" : "pointer" }}
                                />
                                <span style={{
                                  display: "inline-block",
                                  width: 7, height: 7,
                                  borderRadius: "50%",
                                  background: dotColor,
                                  flexShrink: 0,
                                  opacity: checked ? 1 : 0.4,
                                }} />
                                {item.name}
                                {/* View source button */}
                                {BENCHMARK_SOURCE[item.id] && (
                                  <button
                                    type="button"
                                    onClick={e => {
                                      e.preventDefault();
                                      setCodeAlgo(prev => prev === item.id ? null : item.id);
                                    }}
                                    title={`View ${item.name} source code`}
                                    style={{
                                      marginLeft: 3,
                                      background: codeAlgo === item.id ? "var(--color-accent-muted)" : "none",
                                      border: `1px solid ${codeAlgo === item.id ? "var(--color-accent)" : "var(--color-border)"}`,
                                      borderRadius: 4,
                                      cursor: "pointer",
                                      padding: "1px 4px",
                                      display: "inline-flex",
                                      alignItems: "center",
                                      color: codeAlgo === item.id ? "var(--color-accent)" : "var(--color-muted)",
                                      lineHeight: 1,
                                    }}
                                  >
                                    <Code size={9} strokeWidth={1.75} />
                                  </button>
                                )}
                                {item.id === "logos" && (() => {
                                  const hasVariants = customLogosVariants.length > 0;
                                  return (
                                    <button
                                      type="button"
                                      onClick={e => {
                                        e.preventDefault();
                                        // Always add a new variant and open its settings panel
                                        const newIdx = customLogosVariants.length;
                                        setCustomLogosVariants(prev => [...prev, { ...DEFAULT_LOGOS_PARAMS }]);
                                        setLogosEditVariant(newIdx);
                                      }}
                                      title="Add a custom Logos Sort variant"
                                      style={{
                                        marginLeft: 4,
                                        background: logosEditVariant !== null ? "var(--color-accent-muted)" : hasVariants ? "rgba(85,85,85,0.08)" : "none",
                                        border: `1px solid ${logosEditVariant !== null ? "var(--color-accent)" : hasVariants ? "#555555" : "var(--color-border)"}`,
                                        borderRadius: 4,
                                        cursor: "pointer",
                                        padding: "1px 4px",
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: 3,
                                        color: logosEditVariant !== null ? "var(--color-accent)" : hasVariants ? "#555555" : "var(--color-muted)",
                                        fontSize: 9,
                                        lineHeight: 1,
                                      }}
                                    >
                                      <Settings size={9} strokeWidth={1.75} />
                                      {hasVariants ? `custom ×${customLogosVariants.length} ●` : "custom"}
                                    </button>
                                  );
                                })()}
                              </label>
                              </React.Fragment>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Algorithm source code panel */}
                {codeAlgo && BENCHMARK_SOURCE[codeAlgo] && (() => {
                  const src   = BENCHMARK_SOURCE[codeAlgo];
                  const name  = ALGO_NAMES[codeAlgo] ?? codeAlgo;
                  const lines = src.split("\n");
                  return (
                    <div className="mt-3 pt-3" style={{ borderTop: "1px solid var(--color-border)" }}>
                      {/* Header */}
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <Code size={11} style={{ color: "var(--color-accent)", flexShrink: 0 }} />
                          <span style={{ fontSize: 10, fontWeight: 700, color: "var(--color-accent)", fontFamily: "var(--font-mono)" }}>{name}</span>
                          <span style={{ fontSize: 9, color: "var(--color-muted)", fontFamily: "var(--font-mono)" }}>TypeScript · {lines.length} lines</span>
                        </div>
                        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(src).then(() => {
                                setCodeCopied(true);
                                setTimeout(() => setCodeCopied(false), 1500);
                              });
                            }}
                            title="Copy source"
                            style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 9, padding: "2px 6px", borderRadius: 4, border: "1px solid var(--color-border)", background: "var(--color-surface-2)", color: codeCopied ? "var(--color-state-sorted)" : "var(--color-muted)", cursor: "pointer" }}
                          >
                            {codeCopied ? <Check size={9} /> : <Copy size={9} />}
                            {codeCopied ? "Copied!" : "Copy"}
                          </button>
                          <button
                            onClick={() => setCodeAlgo(null)}
                            title="Close"
                            style={{ display: "flex", alignItems: "center", padding: "2px 4px", borderRadius: 4, border: "1px solid var(--color-border)", background: "var(--color-surface-2)", color: "var(--color-muted)", cursor: "pointer" }}
                          >
                            <X size={9} />
                          </button>
                        </div>
                      </div>
                      {/* Code view */}
                      <div style={{ overflowX: "auto", overflowY: "auto", maxHeight: 340, borderRadius: 6, border: "1px solid var(--color-border)", background: "var(--color-surface-2)" }}>
                        <table style={{ borderCollapse: "collapse", width: "100%", minWidth: "max-content", fontFamily: "var(--font-mono)", fontSize: 10 }}>
                          <tbody>
                            {lines.map((line, i) => {
                              const trimmed = line.trimStart();
                              const isComment = trimmed.startsWith("//") || trimmed.startsWith("/*") || trimmed.startsWith("*");
                              return (
                                <tr key={i} style={{ verticalAlign: "top" }}>
                                  <td style={{ paddingLeft: 8, paddingRight: 10, paddingTop: 1, paddingBottom: 1, color: "var(--color-border)", textAlign: "right", userSelect: "none", minWidth: 28, fontSize: 9, borderRight: "1px solid var(--color-border)" }}>
                                    {i + 1}
                                  </td>
                                  <td style={{ paddingLeft: 8, paddingRight: 12, paddingTop: 1, paddingBottom: 1, whiteSpace: "pre", color: isComment ? "var(--color-muted)" : "var(--color-text)", fontStyle: isComment ? "italic" : "normal" }}>
                                    {line || "\u00A0"}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })()}

                {/* Custom sort function */}
                <div className="mt-3 pt-3" style={{ borderTop: "1px solid var(--color-border)" }}>
                  {/* Collapsible header */}
                  <button
                    type="button"
                    onClick={() => setCustomSortOpen(o => !o)}
                    className="flex items-center gap-1 w-full"
                    style={{ background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left" }}
                  >
                    <ChevronRight size={12} style={{
                      color: "var(--color-muted)",
                      transform: customSortOpen ? "rotate(90deg)" : "none",
                      transition: "transform 0.15s ease",
                      flexShrink: 0,
                    }} />
                    <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-muted)" }}>
                      Custom Sort
                    </span>
                    {customSortEnabled && (
                      <span style={{
                        marginLeft: 6, fontSize: 8, padding: "1px 5px", borderRadius: 8,
                        background: "rgba(var(--color-accent-rgb, 99,102,241), 0.15)",
                        color: "var(--color-accent)", border: "1px solid var(--color-accent)",
                        fontWeight: 700, letterSpacing: "0.04em",
                      }}>
                        active
                      </span>
                    )}
                  </button>

                  {customSortOpen && (
                    <div className="mt-2 flex flex-col gap-2">
                      {/* Load preset buttons — grouped by complexity class */}
                      {(() => {
                        const groups: { label: string; color: string; presets: string[] }[] = [
                          { label: "O(n log n)", color: "#66bb6a", presets: ["Logos", "TimSort (JS)", "Introsort", "Merge", "Quick", "Heap"] },
                          { label: "O(n log² n) / linear", color: "#ffb74d", presets: ["Shell", "Counting", "Radix", "Bucket"] },
                          { label: "O(n²)", color: "#ef9a9a", presets: ["Insertion", "Selection", "Bubble", "Cocktail", "Comb", "Gnome", "Pancake", "Cycle", "Odd-Even"] },
                        ];
                        const presetMap = Object.fromEntries(CUSTOM_PRESETS.map(p => [p.label, p]));
                        return (
                          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                            <p className="text-[10px]" style={{ color: "var(--color-muted)" }}>Load algorithm:</p>
                            {groups.map(g => (
                              <div key={g.label}>
                                <p style={{ fontSize: 8, color: g.color, fontFamily: "monospace", marginBottom: 3, letterSpacing: "0.04em" }}>{g.label}</p>
                                <div className="flex flex-wrap gap-1">
                                  {g.presets.map(name => {
                                    const preset = presetMap[name];
                                    if (!preset) return null;
                                    return (
                                      <button
                                        key={name}
                                        type="button"
                                        onClick={() => { setCustomSortCode(preset.code); setCustomSortError(null); }}
                                        title={`Load ${name} implementation`}
                                        style={{
                                          fontSize: 9, padding: "2px 7px", borderRadius: 4, cursor: "pointer",
                                          background: "var(--color-surface-2)",
                                          border: "1px solid var(--color-border)",
                                          color: "var(--color-text)",
                                          fontFamily: "monospace",
                                        }}
                                      >
                                        {name}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            ))}
                          </div>
                        );
                      })()}

                      {/* Include checkbox + Run custom only */}
                      <div className="flex items-center gap-3 flex-wrap">
                        <label className="flex items-center gap-1.5" style={{ cursor: "pointer" }}>
                          <input
                            type="checkbox"
                            checked={customSortEnabled}
                            onChange={e => setCustomSortEnabled(e.target.checked)}
                            style={{ accentColor: "var(--color-accent)" }}
                          />
                          <span className="text-xs" style={{ color: customSortEnabled ? "var(--color-accent)" : "var(--color-muted)" }}>
                            Include in benchmark
                          </span>
                        </label>
                        <button
                          type="button"
                          disabled={!canRunCustomOnly}
                          onClick={() => run(["custom"])}
                          style={{
                            ...btn("primary", { padding: "3px 10px", opacity: canRunCustomOnly ? 1 : 0.4, cursor: canRunCustomOnly ? "pointer" : "not-allowed" }),
                            fontSize: 10,
                          }}
                          title={canRunCustomOnly ? "Run only the custom sort against selected sizes & scenarios" : customSortError ? "Fix the syntax error first" : !customSortCode.trim() ? "Write or load a custom sort first" : !customSortEnabled ? "Enable custom sort first" : "Select sizes and scenarios first"}
                        >
                          <Play size={9} strokeWidth={2} />
                          Run custom only
                        </button>
                      </div>

                      {/* Code editor */}
                      <textarea
                        value={customSortCode}
                        onChange={e => {
                          setCustomSortCode(e.target.value);
                          setCustomSortError(null);
                          if (e.target.value.trim()) {
                            try { new Function("return (" + e.target.value + ")")(); }
                            catch (err) { setCustomSortError(String(err)); }
                          }
                        }}
                        placeholder={"// Sort arr in-place or return sorted copy\n(arr) => {\n  arr.sort((a, b) => a - b);\n}"}
                        spellCheck={false}
                        rows={8}
                        style={{
                          width: "100%", resize: "vertical", fontFamily: "monospace", fontSize: 10,
                          padding: "6px 8px", borderRadius: 6,
                          background: "var(--color-surface-1)",
                          border: `1px solid ${customSortError ? "#ef5350" : "var(--color-border)"}`,
                          color: "var(--color-text)", outline: "none",
                          boxSizing: "border-box",
                        }}
                      />
                      {customSortError && (
                        <p className="text-xs" style={{ color: "#ef5350", fontFamily: "monospace" }}>{customSortError}</p>
                      )}

                      {/* Name + notes + save */}
                      <div className="flex flex-col gap-1.5">
                        <div className="flex gap-1.5 items-center">
                          <input
                            type="text"
                            value={customSortName}
                            onChange={e => setCustomSortName(e.target.value)}
                            placeholder="Name (optional)"
                            style={{
                              flex: 1, fontSize: 10, fontFamily: "monospace", padding: "4px 7px", borderRadius: 5,
                              background: "var(--color-surface-1)", border: "1px solid var(--color-border)",
                              color: "var(--color-text)", outline: "none",
                            }}
                          />
                          <button
                            type="button"
                            disabled={!customSortCode.trim()}
                            onClick={() => {
                              const entry = {
                                id: crypto.randomUUID(),
                                name: customSortName.trim() || `Custom ${new Date().toLocaleTimeString()}`,
                                code: customSortCode,
                                notes: customSortNotes,
                                savedAt: new Date().toISOString(),
                              };
                              const next = [...savedSorts, entry];
                              setSavedSorts(next);
                              try { localStorage.setItem("codecookbook.savedSorts", JSON.stringify(next)); } catch { /* quota */ }
                            }}
                            style={{
                              ...btn("secondary", { padding: "3px 10px", opacity: customSortCode.trim() ? 1 : 0.4, cursor: customSortCode.trim() ? "pointer" : "not-allowed" }),
                              fontSize: 10, flexShrink: 0,
                            }}
                          >
                            Save
                          </button>
                        </div>
                        <textarea
                          value={customSortNotes}
                          onChange={e => setCustomSortNotes(e.target.value)}
                          placeholder="Notes (optional)"
                          rows={2}
                          style={{
                            width: "100%", resize: "vertical", fontFamily: "monospace", fontSize: 10,
                            padding: "5px 7px", borderRadius: 5, boxSizing: "border-box",
                            background: "var(--color-surface-1)", border: "1px solid var(--color-border)",
                            color: "var(--color-text)", outline: "none",
                          }}
                        />
                      </div>

                      {/* Saved sorts list */}
                      {savedSorts.length > 0 && (
                        <div className="flex flex-col gap-1" style={{ borderTop: "1px solid var(--color-border)", paddingTop: 8 }}>
                          <p className="text-[10px]" style={{ color: "var(--color-muted)" }}>Saved sorts</p>
                          {savedSorts.map(s => (
                            <div key={s.id} style={{ display: "flex", alignItems: "flex-start", gap: 6, padding: "5px 7px", borderRadius: 6, background: "var(--color-surface-1)", border: "1px solid var(--color-border)" }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <button
                                  type="button"
                                  onClick={() => { setCustomSortCode(s.code); setCustomSortName(s.name); setCustomSortNotes(s.notes); setCustomSortError(null); }}
                                  style={{ background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left", width: "100%" }}
                                >
                                  <span style={{ fontSize: 10, fontFamily: "monospace", color: "var(--color-accent)", fontWeight: 600 }}>{s.name}</span>
                                  <span style={{ fontSize: 9, color: "var(--color-muted)", marginLeft: 6 }}>{new Date(s.savedAt).toLocaleDateString()}</span>
                                </button>
                                {s.notes && (
                                  <p style={{ fontSize: 9, color: "var(--color-muted)", marginTop: 2, fontFamily: "monospace", whiteSpace: "pre-wrap" }}>{s.notes}</p>
                                )}
                              </div>
                              <button
                                type="button"
                                title="Delete"
                                onClick={() => {
                                  const next = savedSorts.filter(x => x.id !== s.id);
                                  setSavedSorts(next);
                                  try { localStorage.setItem("codecookbook.savedSorts", JSON.stringify(next)); } catch { /* quota */ }
                                }}
                                style={{ fontSize: 9, color: "var(--color-muted)", background: "none", border: "none", cursor: "pointer", flexShrink: 0, padding: "0 2px" }}
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {logosEditVariant !== null && has("advanced") && customLogosVariants.length > 0 && (() => {
                  const idx = Math.min(logosEditVariant, customLogosVariants.length - 1);
                  const params = customLogosVariants[idx];
                  const setParams = (updater: (prev: LogosParams) => LogosParams) => {
                    setCustomLogosVariants(prev => prev.map((p, i) => i === idx ? updater(p) : p));
                  };
                  const hasCustom = (Object.keys(DEFAULT_LOGOS_PARAMS) as (keyof LogosParams)[]).some(k => params[k] !== DEFAULT_LOGOS_PARAMS[k]);
                  return (
                    <div className="mt-3 rounded-lg p-3 flex flex-col gap-2.5" style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)" }}>
                      <div className="flex items-center justify-between gap-2">
                        {customLogosVariants.length > 1 && (
                          <div className="flex gap-1">
                            {customLogosVariants.map((_, i) => (
                              <button key={i} type="button" onClick={() => setLogosEditVariant(i)}
                                style={{
                                  padding: "1px 6px", fontSize: 9, borderRadius: 3, cursor: "pointer",
                                  background: i === idx ? "var(--color-accent)" : "var(--color-surface-3)",
                                  color: i === idx ? "#fff" : "var(--color-muted)",
                                  border: `1px solid ${i === idx ? "var(--color-accent)" : "var(--color-border)"}`,
                                }}>
                                {i + 1}
                              </button>
                            ))}
                          </div>
                        )}
                        <p className="text-xs font-semibold" style={{ color: "var(--color-text)" }}>
                          {customLogosVariants.length === 1 ? "Logos Sort — parameters" : `Logos Sort - ${idx + 1} — parameters`}
                        </p>
                        <div className="flex gap-2 ml-auto">
                          {customLogosVariants.length > 1 && (
                            <button type="button"
                              onClick={() => {
                                setCustomLogosVariants(prev => prev.filter((_, i) => i !== idx));
                                setLogosEditVariant(Math.max(0, idx - 1));
                              }}
                              style={{ fontSize: 9, padding: "1px 6px", color: "var(--color-state-swap)", background: "none", border: "1px solid var(--color-state-swap)", borderRadius: 3, cursor: "pointer" }}>
                              remove
                            </button>
                          )}
                          <button type="button"
                            onClick={() => setParams(() => ({ ...DEFAULT_LOGOS_PARAMS }))}
                            style={btn("ghost", { fontSize: 9, padding: "1px 6px", color: "var(--color-muted)", textDecoration: "underline", textDecorationStyle: "dotted" })}>
                            reset defaults
                          </button>
                        </div>
                      </div>
                      {hasCustom && (
                        <p className="text-[10px] px-2 py-1 rounded" style={{ background: "rgba(85,85,85,0.08)", color: "#555555", border: "1px solid rgba(192,57,43,0.25)" }}>
                          Params differ from defaults — both <strong>Logos Sort</strong> and <strong>Logos Sort - {idx + 1}</strong> will run automatically.
                        </p>
                      )}
                      {([
                        { key: "phi",          label: "φ (phi)",           min: 0.05, max: 1.0,  step: 0.001, desc: "Primary pivot offset — φ⁻¹ ≈ 0.618" },
                        { key: "phi2",         label: "φ² (phi2)",         min: 0.05, max: 1.0,  step: 0.001, desc: "Secondary pivot offset — φ⁻² ≈ 0.382" },
                        { key: "base",         label: "Base",              min: 2,    max: 256,  step: 1,     desc: "Insertion sort threshold (elements)" },
                        { key: "depthMult",    label: "Depth multiplier",  min: 1,    max: 6,    step: 0.5,   desc: "Depth limit = mult·⌊log₂n⌋ + add" },
                        { key: "depthAdd",     label: "Depth addend",      min: 0,    max: 16,   step: 1,     desc: "Constant added to depth limit" },
                        { key: "countingMult", label: "Counting trigger",  min: 1,    max: 32,   step: 1,     desc: "Counting sort when valueRange < n×this" },
                      ] as const).map(({ key, label, min, max, step, desc }) => {
                        const draftKey = `${idx}.${key}`;
                        const commitDraft = (raw: string) => {
                          const v = parseFloat(raw);
                          if (!isNaN(v)) {
                            const clamped = Math.max(min, Math.min(max, parseFloat(v.toPrecision(8))));
                            setParams(prev => ({ ...prev, [key]: clamped }));
                          }
                          setParamDrafts(prev => { const n = { ...prev }; delete n[draftKey]; return n; });
                        };
                        return (
                          <div key={key} className="flex flex-col gap-0.5">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs" style={{ color: "var(--color-text)" }}>{label}</span>
                              <input
                                type="text" inputMode="decimal"
                                value={draftKey in paramDrafts ? paramDrafts[draftKey] : String(params[key])}
                                onChange={e => setParamDrafts(prev => ({ ...prev, [draftKey]: e.target.value }))}
                                onBlur={e => commitDraft(e.target.value)}
                                onKeyDown={e => {
                                  if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                                  if (e.key === "Escape") setParamDrafts(prev => { const n = { ...prev }; delete n[draftKey]; return n; });
                                }}
                                style={{
                                  width: 88, textAlign: "right", fontSize: 11, fontFamily: "monospace",
                                  color: draftKey in paramDrafts ? "var(--color-text)" : "var(--color-accent)",
                                  background: "var(--color-surface-3)",
                                  border: `1px solid ${draftKey in paramDrafts ? "var(--color-accent)" : "var(--color-border)"}`,
                                  borderRadius: 3, padding: "1px 4px", outline: "none",
                                }}
                              />
                            </div>
                            <input type="range" min={min} max={max} step={step}
                              value={params[key]}
                              onChange={e => {
                                const v = parseFloat(e.target.value);
                                setParams(prev => ({ ...prev, [key]: v }));
                                setParamDrafts(prev => { const n = { ...prev }; delete n[draftKey]; return n; });
                              }}
                              style={{ accentColor: "var(--color-accent)", width: "100%" }}
                            />
                            <p className="text-[10px]" style={{ color: "var(--color-muted)" }}>{desc}</p>
                          </div>
                        );
                      })}
                      {/* Pivot jitter / fixed multiplier section */}
                      {(() => {
                        const isJitter = params.randomScaleMin !== params.randomScaleMax;
                        const scaleSlider = (
                          sliderKey: "randomScaleMin" | "randomScaleMax",
                          label: string,
                          desc: string,
                        ) => {
                          const draftKey = `${idx}.${sliderKey}`;
                          const commitDraft = (raw: string) => {
                            const v = parseFloat(raw);
                            if (!isNaN(v)) {
                              const clamped = Math.max(0, Math.min(3, parseFloat(v.toPrecision(8))));
                              setParams(prev => {
                                const next = { ...prev, [sliderKey]: clamped };
                                if (sliderKey === "randomScaleMin" && clamped > prev.randomScaleMax)
                                  next.randomScaleMax = clamped;
                                if (sliderKey === "randomScaleMax" && clamped < prev.randomScaleMin)
                                  next.randomScaleMin = clamped;
                                return next;
                              });
                            }
                            setParamDrafts(prev => { const n = { ...prev }; delete n[draftKey]; return n; });
                          };
                          return (
                            <div className="flex flex-col gap-0.5">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-xs" style={{ color: "var(--color-text)" }}>{label}</span>
                                <input
                                  type="text" inputMode="decimal"
                                  value={draftKey in paramDrafts ? paramDrafts[draftKey] : String(params[sliderKey])}
                                  onChange={e => setParamDrafts(prev => ({ ...prev, [draftKey]: e.target.value }))}
                                  onBlur={e => commitDraft(e.target.value)}
                                  onKeyDown={e => {
                                    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                                    if (e.key === "Escape") setParamDrafts(prev => { const n = { ...prev }; delete n[draftKey]; return n; });
                                  }}
                                  style={{
                                    width: 88, textAlign: "right", fontSize: 11, fontFamily: "monospace",
                                    color: draftKey in paramDrafts ? "var(--color-text)" : "var(--color-accent)",
                                    background: "var(--color-surface-3)",
                                    border: `1px solid ${draftKey in paramDrafts ? "var(--color-accent)" : "var(--color-border)"}`,
                                    borderRadius: 3, padding: "1px 4px", outline: "none",
                                  }}
                                />
                              </div>
                              <input type="range" min={0} max={3} step={0.01}
                                value={params[sliderKey]}
                                onChange={e => {
                                  const v = parseFloat(e.target.value);
                                  setParams(prev => {
                                    const next = { ...prev, [sliderKey]: v };
                                    if (sliderKey === "randomScaleMin" && v > prev.randomScaleMax)
                                      next.randomScaleMax = v;
                                    if (sliderKey === "randomScaleMax" && v < prev.randomScaleMin)
                                      next.randomScaleMin = v;
                                    return next;
                                  });
                                  setParamDrafts(prev => { const n = { ...prev }; delete n[`${idx}.${sliderKey}`]; return n; });
                                }}
                                style={{ accentColor: "var(--color-accent)", width: "100%" }}
                              />
                              <p className="text-[10px]" style={{ color: "var(--color-muted)" }}>{desc}</p>
                            </div>
                          );
                        };
                        return (
                          <div className="flex flex-col gap-2 pt-1" style={{ borderTop: "1px solid var(--color-border)" }}>
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-medium" style={{ color: "var(--color-text)" }}>Pivot jitter</span>
                              <label className="flex items-center gap-1.5" style={{ cursor: "pointer" }}>
                                <input type="checkbox" checked={isJitter}
                                  onChange={e => {
                                    if (e.target.checked) {
                                      // fixed → jitter: expand range from current multiplier
                                      setParams(prev => ({
                                        ...prev,
                                        randomScaleMin: Math.max(0, prev.randomScaleMin - 0.1),
                                        randomScaleMax: prev.randomScaleMax + 0.1,
                                      }));
                                    } else {
                                      // jitter → fixed: collapse to midpoint
                                      const mid = parseFloat(((params.randomScaleMin + params.randomScaleMax) / 2).toPrecision(6));
                                      setParams(prev => ({ ...prev, randomScaleMin: mid, randomScaleMax: mid }));
                                    }
                                  }}
                                  style={{ accentColor: "var(--color-accent)" }}
                                />
                                <span className="text-xs" style={{ color: isJitter ? "var(--color-accent)" : "var(--color-muted)" }}>
                                  Random jitter
                                </span>
                              </label>
                            </div>
                            {isJitter ? (
                              <>
                                {scaleSlider("randomScaleMin", "Min jitter", "Lower bound of per-call jitter scale")}
                                {scaleSlider("randomScaleMax", "Max jitter", "Upper bound of per-call jitter scale")}
                              </>
                            ) : (() => {
                              // Fixed mode: show one slider, both min and max track together
                              const draftKey = `${idx}.randomScaleMin`;
                              const commitFixed = (raw: string) => {
                                const v = parseFloat(raw);
                                if (!isNaN(v)) {
                                  const c = Math.max(0, Math.min(3, parseFloat(v.toPrecision(8))));
                                  setParams(prev => ({ ...prev, randomScaleMin: c, randomScaleMax: c }));
                                }
                                setParamDrafts(prev => { const n = { ...prev }; delete n[draftKey]; return n; });
                              };
                              return (
                                <div className="flex flex-col gap-0.5">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-xs" style={{ color: "var(--color-text)" }}>Multiplier</span>
                                    <input
                                      type="text" inputMode="decimal"
                                      value={draftKey in paramDrafts ? paramDrafts[draftKey] : String(params.randomScaleMin)}
                                      onChange={e => setParamDrafts(prev => ({ ...prev, [draftKey]: e.target.value }))}
                                      onBlur={e => commitFixed(e.target.value)}
                                      onKeyDown={e => {
                                        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                                        if (e.key === "Escape") setParamDrafts(prev => { const n = { ...prev }; delete n[draftKey]; return n; });
                                      }}
                                      style={{
                                        width: 88, textAlign: "right", fontSize: 11, fontFamily: "monospace",
                                        color: draftKey in paramDrafts ? "var(--color-text)" : "var(--color-accent)",
                                        background: "var(--color-surface-3)",
                                        border: `1px solid ${draftKey in paramDrafts ? "var(--color-accent)" : "var(--color-border)"}`,
                                        borderRadius: 3, padding: "1px 4px", outline: "none",
                                      }}
                                    />
                                  </div>
                                  <input type="range" min={0} max={3} step={0.01}
                                    value={params.randomScaleMin}
                                    onChange={e => {
                                      const v = parseFloat(e.target.value);
                                      setParams(prev => ({ ...prev, randomScaleMin: v, randomScaleMax: v }));
                                      setParamDrafts(prev => { const n = { ...prev }; delete n[draftKey]; return n; });
                                    }}
                                    style={{ accentColor: "var(--color-accent)", width: "100%" }}
                                  />
                                  <p className="text-[10px]" style={{ color: "var(--color-muted)" }}>
                                    Fixed scale applied to every pivot selection (0 = pure golden-section, 0.618 = default)
                                  </p>
                                </div>
                              );
                            })()}
                          </div>
                        );
                      })()}
                    </div>
                  );
                })()}

                {(maxSelectedSize > SLOW_THRESHOLD || Object.entries(MEDIUM_LIMITS).some(([id, { threshold }]) => selected.has(id) && maxSelectedSize > threshold)) && (
                  <div className="mt-2.5 flex flex-col gap-1">
                    {maxSelectedSize > SLOW_THRESHOLD && (
                      <p className="text-xs" style={{ color: "var(--color-state-swap)" }}>
                        ⚠ O(n²) sorts (Bubble, Insertion, Selection, Cocktail, Comb, Gnome, Pancake, Cycle, Odd-Even) disabled above n={SLOW_THRESHOLD.toLocaleString()}.
                      </p>
                    )}
                    {Object.entries(MEDIUM_LIMITS).filter(([id, { threshold }]) => selected.has(id) && maxSelectedSize > threshold).map(([id, { threshold, reason }]) => (
                      <p key={id} className="text-xs" style={{ color: "#ffb74d" }}>
                        ⚠ {ALGO_NAMES[id]} disabled above n={fmtN(threshold)}: {reason}.
                      </p>
                    ))}
                    {maxSelectedSize > LARGE_THRESHOLD && [...selected].some(id => !UNLIMITED_IDS.has(id)) && (
                      <p className="text-xs" style={{ color: "var(--color-state-swap)" }}>
                        ⚠ Only O(n log n) algorithms run above n={fmtN(LARGE_THRESHOLD)}.
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Advanced */}
              {has("advanced") && <div className="print:hidden mb-4">
                <button
                  onClick={() => setAdvancedOpen(o => !o)}
                  className="flex items-center gap-1"
                  style={btn("ghost", { padding: 0, fontSize: 9, fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase" })}
                >
                  <ChevronRight size={12} style={{ transform: advancedOpen ? "rotate(90deg)" : "none", transition: "transform 0.15s ease" }} />
                  Advanced
                </button>

                {advancedOpen && (
                  <div className="mt-3 flex flex-col gap-4">
                    {/* Scenario wheel */}
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--color-muted)" }}>
                        Scenarios <span className="font-normal normal-case" style={{ color: "var(--color-muted)" }}>— one drawn at random per round</span>
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {SCENARIO_OPTIONS.map(s => {
                          const on = scenarios.has(s.id);
                          return (
                            <label
                              key={s.id}
                              className="flex items-center gap-1.5 rounded text-xs select-none"
                              style={{
                                padding: "2px 8px",
                                background: on ? "rgba(139,58,42,0.08)" : "var(--color-surface-1)",
                                border: `1px solid ${on ? "var(--color-accent)" : "var(--color-border)"}`,
                                color: on ? "var(--color-text)" : "var(--color-muted)",
                                cursor: "pointer",
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={on}
                                onChange={() => setScenarios(prev => {
                                  const next = new Set(prev);
                                  on ? next.delete(s.id) : next.add(s.id);
                                  return next;
                                })}
                                style={{ accentColor: "var(--color-accent)" }}
                              />
                              {s.label}
                              {s.rare && <span style={{ fontSize: 9, padding: "0 4px", borderRadius: 3, background: "var(--color-surface-3)", color: "var(--color-muted)", fontStyle: "italic" }}>rare</span>}
                              <span style={{ color: "var(--color-muted)", fontSize: 10 }}>— {s.desc}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    {/* Rounds + Warmup */}
                    <div className="flex flex-wrap items-end gap-5">
                      <div className="flex flex-col gap-1">
                        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-muted)" }}>Rounds</span>
                        <Spinner value={rounds} onChange={setRounds} min={1} max={50} label="Rounds" />
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-muted)" }}>Warmup (discard first)</span>
                        <Spinner value={warmup} onChange={v => setWarmup(Math.min(v, rounds - 1))} min={0} max={Math.max(0, rounds - 1)} label="Warmup" />
                      </div>
                      <span className="text-xs pb-0.5" style={{ color: "var(--color-muted)" }}>
                        {Math.max(0, rounds - warmup)} rounds recorded · best kept
                      </span>
                    </div>

                    {/* Per-algorithm options */}
                    {(selected.has("quick") || selected.has("shell")) && (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--color-muted)" }}>
                          Algorithm options
                        </p>
                        <div className="flex flex-col gap-2">
                          {selected.has("quick") && (
                            <div className="flex items-start gap-3">
                              <span className="text-xs shrink-0 pt-0.5" style={{ color: "var(--color-muted)", width: 128 }}>
                                Quick Sort pivot
                              </span>
                              <div className="flex flex-wrap gap-1">
                                {QUICK_PIVOT_OPTS.map(opt => (
                                  <button
                                    key={opt.id}
                                    onClick={() => setQuickPivot(opt.id)}
                                    title={opt.desc}
                                    style={{
                                      padding: "2px 8px", fontSize: 10,
                                      background: quickPivot === opt.id ? "rgba(139,58,42,0.15)" : "var(--color-surface-1)",
                                      border: `1px solid ${quickPivot === opt.id ? "var(--color-accent)" : "var(--color-border)"}`,
                                      borderRadius: 4, cursor: "pointer",
                                      color: quickPivot === opt.id ? "var(--color-text)" : "var(--color-muted)",
                                    }}
                                  >
                                    {opt.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                          {selected.has("shell") && (
                            <div className="flex items-start gap-3">
                              <span className="text-xs shrink-0 pt-0.5" style={{ color: "var(--color-muted)", width: 128 }}>
                                Shell Sort gaps
                              </span>
                              <div className="flex flex-wrap gap-1">
                                {SHELL_GAPS_OPTS.map(opt => (
                                  <button
                                    key={opt.id}
                                    onClick={() => setShellGaps(opt.id)}
                                    title={opt.desc}
                                    style={{
                                      padding: "2px 8px", fontSize: 10,
                                      background: shellGaps === opt.id ? "rgba(139,58,42,0.15)" : "var(--color-surface-1)",
                                      border: `1px solid ${shellGaps === opt.id ? "var(--color-accent)" : "var(--color-border)"}`,
                                      borderRadius: 4, cursor: "pointer",
                                      color: shellGaps === opt.id ? "var(--color-text)" : "var(--color-muted)",
                                    }}
                                  >
                                    {opt.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Custom distribution sliders */}
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--color-muted)" }}>
                        Custom distribution <span className="font-normal normal-case">— layered on top of selected scenarios</span>
                      </p>
                      <div className="flex flex-col gap-2">
                        {([
                          { label: "% pre-sorted prefix", value: customPreSorted, set: setCustomPreSorted },
                          { label: "% duplicate injection", value: customDuplicates, set: setCustomDuplicates },
                        ] as const).map(({ label, value, set }) => (
                          <div key={label} className="flex items-center gap-3">
                            <span className="text-xs font-mono shrink-0" style={{ color: "var(--color-muted)", width: 150 }}>{label}</span>
                            <input
                              type="range" min={0} max={100} step={5} value={value}
                              onChange={e => set(Number(e.target.value))}
                              style={{ flex: 1, accentColor: "var(--color-accent)" }}
                            />
                            <span className="text-xs font-mono shrink-0" style={{ color: "var(--color-text)", width: 32, textAlign: "right" }}>
                              {value}%
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Adversarial input toggle */}
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--color-muted)" }}>
                        Adversarial input
                      </p>
                      <button
                        onClick={() => setAdversarialEnabled(v => !v)}
                        title="Generates worst-case input specifically designed to maximize comparisons for each algorithm (e.g., median-of-3 killer for Quicksort)"
                        style={{
                          display: "inline-flex", alignItems: "center", gap: 6,
                          padding: "3px 10px", fontSize: 10, borderRadius: 5, cursor: "pointer",
                          background: adversarialEnabled ? "rgba(239,83,80,0.12)" : "var(--color-surface-1)",
                          border: `1px solid ${adversarialEnabled ? "#ef5350" : "var(--color-border)"}`,
                          color: adversarialEnabled ? "#ef5350" : "var(--color-muted)",
                          fontFamily: "monospace",
                        }}
                      >
                        ⚡ Adversarial {adversarialEnabled ? "on" : "off"}
                      </button>
                      {adversarialEnabled && (
                        <p className="text-xs mt-1.5" style={{ color: "var(--color-muted)", fontFamily: "monospace" }}>
                          One extra worst-case input per algorithm per size is added to the timing pool. For Quicksort this is the median-of-3 killer pattern; reversed for insertion/selection/bubble; large-spread for counting/radix; all-same-bucket for bucket sort.
                        </p>
                      )}
                    </div>
                    {/* Worker isolation toggle */}
                    <div>
                      <label className="flex items-start gap-2" style={{ cursor: "pointer" }}>
                        <input
                          type="checkbox"
                          checked={useWorkerIsolation}
                          onChange={e => setUseWorkerIsolation(e.target.checked)}
                          style={{ marginTop: 2, accentColor: "var(--color-accent)" }}
                        />
                        <div>
                          <span className="text-xs font-semibold" style={{ color: "var(--color-text)" }}>
                            Web Worker isolation
                          </span>
                          <p className="text-xs mt-0.5" style={{ color: "var(--color-muted)" }}>
                            Each algorithm runs in its own Worker thread — JIT compilation and GC for one algo cannot pollute timing of another.
                            <span style={{ color: "#ffb74d" }}> Tradeoff: ~10–50 ms overhead per worker creation; space measurement falls back to theoretical.</span>
                          </p>
                        </div>
                      </label>
                    </div>
                  </div>
                )}
              </div>}

              {/* Buttons */}
              {status !== "running" && (
                <div className="text-xs mb-1.5 print:hidden flex flex-col gap-0.5" style={{ color: "var(--color-muted)", fontFamily: "monospace" }}>
                  <span>
                    {[...activeAlgos, ...(customSortEnabled && customSortCode.trim() && !customSortError ? ["custom"] : [])]
                      .map(id => ALGO_NAMES[id] ?? id)
                      .join(", ") || <span style={{ color: "#ef5350" }}>no algorithms selected</span>}
                  </span>
                  <span>
                    {[...scenarios].join(", ")} · n={sortedSizes.map(n => fmtN(n)).join(", ")} · {rounds} round{rounds !== 1 ? "s" : ""} · {warmup} warm-up
                  </span>
                </div>
              )}
              <div className="print:hidden flex gap-1.5">
                {status === "running" ? (
                  <>
                    <div style={{ flex: 1, fontSize: 10, fontFamily: "monospace", color: "var(--color-muted)", display: "flex", alignItems: "center", gap: 6, overflow: "hidden" }}>
                      <span style={{ color: "var(--color-accent)", flexShrink: 0 }}>{currentAlgo ? (ALGO_NAMES[currentAlgo] ?? currentAlgo) : "…"}</span>
                      <span style={{ flexShrink: 0 }}>n={currentN?.toLocaleString() ?? "…"}</span>
                      <span style={{ flexShrink: 0, color: "var(--color-muted)" }}>{progress.done}/{progress.total}</span>
                    </div>
                    <button onClick={stop} style={btn("danger", { padding: "4px 12px" })}>
                      <Square size={11} strokeWidth={2} fill="currentColor" /> Stop
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => run()}
                      disabled={!canRun}
                      style={btn("primary", { padding: "4px 12px", flex: 1, justifyContent: "center", opacity: canRun ? 1 : 0.5, cursor: canRun ? "pointer" : "not-allowed" })}
                    >
                      <Play size={11} strokeWidth={2} />
                      {status === "done" ? "Re-run" : "Run"}
                    </button>

                    {status === "done" && (
                      <button onClick={reset} style={btn("secondary", { padding: "4px 12px" })}>
                        <RotateCcw size={11} strokeWidth={1.75} /> Reset
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Right pane: results ── */}
        <div className="lg:w-1/2 lg:overflow-y-auto" ref={resultsRef}>
          <div className="px-5 py-4 flex flex-col gap-4">
            {(hasCurveData || status === "running") && (
              <div
                className="rounded-xl p-4"
                style={resultsMaximized ? {
                  position: "fixed", inset: 0, zIndex: 9000,
                  background: "var(--color-surface-1)",
                  border: "1px solid var(--color-border)",
                  display: "flex", flexDirection: "column",
                  overflow: "auto", padding: "20px 28px",
                } : {
                  background: "var(--color-surface-2)", border: "1px solid var(--color-border)", display: "flex", flexDirection: "column",
                }}
              >
                {/* Results header */}
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-semibold text-sm mb-0.5" style={{ color: "var(--color-text)" }}>
                      {chartMode === "time" ? "Performance curve" : chartMode === "space" ? "Space usage curve" : chartMode === "3d" ? "3D: time × space × n" : chartMode === "product" ? "Time × space product" : "Normalized curve (time / n·log₂n)"}
                    </p>
                    {runConfig && (
                      <div className="flex flex-wrap items-center gap-1.5 mt-1">
                        <span style={{ fontSize: 10, color: "var(--color-muted)", fontFamily: "monospace" }}>
                          {runConfig.algos.map(id => ALGO_NAMES[id] ?? id).join(", ")}
                        </span>
                        <span style={{ fontSize: 10, color: "var(--color-muted)", opacity: 0.5 }}>·</span>
                        <span style={{ fontSize: 10, color: "var(--color-muted)", fontFamily: "monospace" }}>
                          n={runConfig.sizes.map(n => fmtN(n)).join(", ")}
                        </span>
                        <span style={{ fontSize: 10, color: "var(--color-muted)", opacity: 0.5 }}>·</span>
                        {runConfig.scenarios.map(s => {
                          const opt = SCENARIO_OPTIONS.find(o => o.id === s);
                          return (
                            <span key={s} style={{
                              fontSize: 10, padding: "1px 7px", borderRadius: 10, fontWeight: 500,
                              background: "rgba(255,183,77,0.12)", color: "#ffb74d",
                              border: "1px solid rgba(255,183,77,0.25)",
                            }}>{opt?.label ?? s}</span>
                          );
                        })}
                        <span style={{ fontSize: 10, color: "var(--color-muted)", fontFamily: "monospace" }}>
                          · {runConfig.rounds} round{runConfig.rounds !== 1 ? "s" : ""}, {runConfig.warmup} discarded
                        </span>
                        {runConfig.algos.includes("quick") && quickPivot !== "median3" && (
                          <span style={{ fontSize: 10, padding: "1px 7px", borderRadius: 10, fontWeight: 500, background: "rgba(255,192,0,0.12)", color: "#ffc000", border: "1px solid rgba(255,192,0,0.25)" }}>
                            pivot: {quickPivot}
                          </span>
                        )}
                        {runConfig.algos.includes("shell") && shellGaps !== "ciura" && (
                          <span style={{ fontSize: 10, padding: "1px 7px", borderRadius: 10, fontWeight: 500, background: "rgba(0,196,204,0.12)", color: "#00c4cc", border: "1px solid rgba(0,196,204,0.25)" }}>
                            gaps: {shellGaps}
                          </span>
                        )}
                      </div>
                    )}
                    {status === "running" && (
                      <p className="text-xs mt-0.5" style={{ color: "var(--color-muted)" }}>
                        Timing {currentAlgo ? ALGO_NAMES[currentAlgo] : "…"} at n={currentN?.toLocaleString()}…
                        <span className="ml-2 font-mono">({progress.done}/{progress.total})</span>
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {status === "running" && (
                      <button
                        onClick={() => setProgressLocked(l => !l)}
                        title={progressLocked ? "Unlock chart cursor from benchmark progress" : "Lock chart cursor to benchmark progress"}
                        style={btn("secondary", { padding: "2px 7px", fontSize: 9, border: `1px solid ${progressLocked ? "var(--color-border)" : "var(--color-accent)"}`, color: progressLocked ? "var(--color-muted)" : "var(--color-accent)" })}
                      >
                        {progressLocked ? <><Lock size={8} /> locked</> : <><Unlock size={8} /> unlocked</>}
                      </button>
                    )}
                    {status === "done" && summaryResults[0] && largestDone && (
                      <div
                        className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold"
                        style={{ background: "rgba(201,150,26,0.15)", color: "#c9961a" }}
                      >
                        <Trophy size={11} /> {ALGO_NAMES[summaryResults[0].id]} wins
                      </div>
                    )}
                    {status === "done" && hasCurveData && (
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(window.location.href).then(() => {
                            setShareState("copied");
                            setTimeout(() => setShareState("idle"), 1500);
                          });
                        }}
                        title="Copy a shareable link to this benchmark run"
                        style={btn("secondary", { padding: "2px 8px", fontSize: 9 })}
                      >
                        {shareState === "copied" ? "✓ Copied" : "⎘ Share"}
                      </button>
                    )}
                    {status === "done" && hasCurveData && (
                      <button
                        onClick={exportMarkdown}
                        title="Copy results as markdown table"
                        style={btn("secondary", { padding: "2px 8px", fontSize: 9 })}
                      >
                        {mdCopied ? "✓ Copied" : "⎘ MD"}
                      </button>
                    )}
                    {status === "done" && hasCurveData && (
                      <button
                        onClick={exportCSV}
                        title="Download benchmark data as CSV"
                        style={btn("secondary", { padding: "2px 8px", fontSize: 9 })}
                      >
                        ↓ CSV
                      </button>
                    )}
                    {status === "done" && hasCurveData && (
                      <button
                        onClick={() => exportChartPNGRef.current?.()}
                        title="Download chart as PNG"
                        style={btn("secondary", { padding: "2px 8px", fontSize: 9 })}
                      >
                        ↓ PNG
                      </button>
                    )}
                    {hasCurveData && (
                      <button
                        onClick={() => setResultsMaximized(m => !m)}
                        title={resultsMaximized ? "Restore results panel (Esc)" : "Maximize results panel for easier reading"}
                        style={btn("secondary", { padding: "2px 8px", fontSize: 9, color: resultsMaximized ? "var(--color-accent)" : undefined })}
                      >
                        {resultsMaximized ? "⊡ restore" : "⊞ maximize"}
                      </button>
                    )}
                  </div>
                </div>

                <div>
                {/* Curve chart */}
                {hasCurveData && (
                  <>
                    {/* Time / Space toggle — centered above the chart */}
                    <div className="print:hidden" style={{ display: "flex", justifyContent: "center", marginBottom: 4, marginTop: 15 }}>
                    <div className="flex rounded overflow-hidden" style={{ border: "1px solid var(--color-border)" }}>
                      {([
                        { id: "time",         label: "time",        title: undefined,                                                              minLevel: "basic" },
                        { id: "space",        label: "space",       title: undefined,                                                              minLevel: "advanced" },
                        { id: "product",      label: "t × s",       title: "Time × Space product — combined cost curve; lower is a better overall tradeoff", minLevel: "advanced" },
                        { id: "ratio",        label: "t / n·log n", title: "Normalize time by n·log₂n — flat = O(n log n)",                       minLevel: "advanced" },
                        { id: "space-ratio",  label: "s / n·log n", title: "Normalize space by n·log₂n — flat = O(n log n) space",                minLevel: "advanced" },
                        { id: "3d",           label: "3D",          title: "Interactive 3D: time × space × n (drag to orbit, scroll to zoom)",    minLevel: "research" },
                        { id: "memory",       label: "Flamegraph",  title: "Space flamegraph: peak space usage per algorithm at each benchmark size n", minLevel: "advanced" },
                      ] as const).filter(m => has(m.minLevel as Parameters<typeof has>[0])).map(m => (
                        <button
                          key={m.id}
                          onClick={() => setChartMode(m.id)}
                          title={m.title}
                          style={btn(chartMode === m.id ? "primary" : "ghost", {
                            padding: "2px 8px", fontSize: 10, borderRadius: 0,
                            background: chartMode === m.id ? "var(--color-accent)" : "var(--color-surface-1)",
                          })}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>
                    </div>{/* end centering wrapper */}

                    {/* 3D chart, memory flamegraph, delta chart, or 2D curve chart */}
                    {chartMode === "memory" ? (
                      <MemoryFlameGraph
                        data={curveDataExt}
                        algos={chartAlgos}
                      />
                    ) : chartMode === "product" ? (() => {
                      // Build a synthetic CurveData where timeMs = timeMs * spaceBytes (product cost)
                      const productData: CurveData = {};
                      for (const id of chartAlgos) {
                        productData[id] = (curveDataExt[id] ?? [])
                          .filter(p => !p.timedOut && p.timeMs > 0 && (p.spaceBytes ?? 0) > 0)
                          .map(p => ({ ...p, timeMs: p.timeMs * p.spaceBytes! }));
                      }
                      return (
                        <>
                          <CurveChart
                            data={productData} sizes={chartSizes}
                            algos={chartAlgos}
                            highlight={activeProofAlgo}
                            activeN={hoverN}
                            onNChange={progressLocked && status === "running" ? undefined : setHoverN}
                            mode="time"
                            onExportReady={fn => { exportChartPNGRef.current = fn; }}
                          />
                          <p style={{ fontSize: 9, color: "var(--color-muted)", fontFamily: "monospace", paddingLeft: 60, marginTop: 4 }}>
                            time (ms) × space (bytes) per n — lower = better combined tradeoff · log scale
                          </p>
                        </>
                      );
                    })() : chartMode === "3d" ? (
                      <Chart3D
                        data={curveDataExt}
                        algos={chartAlgos}
                        highlight={activeProofAlgo}
                      />
                    ) : (
                      <>
                        <CurveChart
                          data={curveDataExt} sizes={chartSizes} algos={chartAlgos}
                          highlight={activeProofAlgo}
                          activeN={hoverN}
                          onNChange={progressLocked && status === "running" ? undefined : setHoverN}
                          mode={chartMode as "time" | "space" | "ratio" | "space-ratio"}
                          onExportReady={fn => { exportChartPNGRef.current = fn; }}
                        />
                        {/* Big-O reference legend — hidden in normalized modes */}
                        {chartMode !== "ratio" && chartMode !== "space-ratio" && (
                          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1" style={{ paddingLeft: 60 }}>
                            {(chartMode === "space" ? SPACE_BIG_O_REFS : BIG_O_REFS).map(ref => (
                              <div key={ref.id} className="flex items-center gap-1">
                                <svg width={16} height={5} style={{ display: "block" }}>
                                  <line x1={0} y1={2.5} x2={16} y2={2.5}
                                    stroke={ref.color} strokeWidth={1.5} strokeDasharray="4 3" />
                                </svg>
                                <span style={{ fontSize: 9, color: "var(--color-muted)", fontFamily: "monospace" }}>
                                  {ref.label}
                                </span>
                              </div>
                            ))}
                            {chartMode === "space" && (
                              <span style={{ fontSize: 9, color: "var(--color-muted)", fontStyle: "italic" }}>
                                measured when performance.memory available; theoretical otherwise
                              </span>
                            )}
                          </div>
                        )}
                        {(chartMode === "ratio" || chartMode === "space-ratio") && (
                          <p style={{ fontSize: 9, color: "var(--color-muted)", fontFamily: "monospace", paddingLeft: 60, marginTop: 4 }}>
                            flat = O(n log n) · rising = super-linear · falling = sub-linear
                            {chartMode === "ratio" ? " · units: ns per element·log₂n" : " · units: bytes per element·log₂n"}
                          </p>
                        )}

                        {/* Live rank panel — updates as you hover/pin */}
                        {hasCurveData && (chartMode === "time" || chartMode === "space") && (
                          <LiveRankPanel
                            data={curveDataExt}
                            algos={chartAlgos}
                            n={hoverN}
                            mode={chartMode as "time" | "space"}
                          />
                        )}

                      </>
                    )}
                  </>
                )}

                {/* Placeholder while first result loads */}
                {!hasCurveData && status === "running" && (
                  <div className="flex items-center justify-center"
                    style={{ height: 230, color: "var(--color-muted)", fontSize: 11 }}>
                    Waiting for first result…
                  </div>
                )}

                {/* Proof slider */}
                {has("research") && Object.keys(sampleProofs).length > 0 && (
                  <div className="print:hidden">
                    <ProofSlider
                      proofs={sampleProofs} algos={chartAlgos}
                      activeAlgo={activeProofAlgo}
                      onSelect={setActiveProofAlgo}
                      revealed={status === "done"}
                      curveData={curveDataExt}
                    />
                  </div>
                )}

                {/* Legend */}
                {hasCurveData && (
                  <div className="mt-2.5 flex flex-col gap-1.5">
                    <Legend algos={chartAlgos} data={curveDataExt} />
                    {Object.values(curveDataExt).some(pts => pts.some(p => p.timedOut)) && (
                      <p className="text-xs" style={{ color: "var(--color-muted)" }}>
                        <span style={{ borderBottom: "1.5px dashed currentColor" }}>– –</span>
                        {" "}dotted line / ✕ = timed out (&gt;10 s); subsequent sizes skipped
                      </p>
                    )}
                    {chartAlgos.includes("timsort-js") && chartAlgos.includes("timsort") && (
                      <p className="text-xs" style={{ color: "var(--color-muted)" }}>
                        <span style={{ color: ALGO_COLORS["timsort-js"] }}>TimSort (JS)</span>
                        {" "}— pure JavaScript implementation vs{" "}
                        <span style={{ color: ALGO_COLORS["timsort"] }}>Tim Sort (V8)</span>
                        {" "}native C++ .sort(). Gap reflects JS {"<=>"} C++ comparator callback overhead.
                      </p>
                    )}
                  </div>
                )}

                </div>{/* end order:1 chart section */}

                {/* Algorithm mini-cards — below performance curve */}
                {chartAlgosBase.length > 0 && (
                  <div
                    className="rounded-xl p-3 mt-2"
                    style={{ background: "var(--color-surface-1)", border: "1px solid var(--color-border)" }}
                  >
                    <div className="flex items-center justify-between mb-2.5">
                      <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-muted)" }}>
                        Algorithms
                      </p>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs" style={{ color: "var(--color-muted)" }}>Sort by:</span>
                        <div className="flex rounded overflow-hidden" style={{ border: "1px solid var(--color-border)" }}>
                          {(["time", "space", "both"] as const).map(mode => (
                            <button
                              key={mode}
                              onClick={() => setMiniCardSort(mode)}
                              className="text-xs px-2 py-0.5"
                              style={{
                                background: miniCardSort === mode ? "var(--color-accent)" : "var(--color-surface-1)",
                                color: miniCardSort === mode ? "#fff" : "var(--color-muted)",
                                border: "none", cursor: "pointer", fontWeight: miniCardSort === mode ? 600 : 400,
                              }}
                            >
                              {mode === "time" ? "Time" : mode === "space" ? "Space" : "Both"}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                    {(() => {
                      const sortedCards = [...chartAlgosBase].sort((a, b) => {
                        const rankOf = (id: string): number | null => {
                          const rt = summaryResults.find(r => r.id === id)?.rank ?? null;
                          const rs = summarySpaceResults.find(r => r.id === id)?.rank ?? null;
                          if (miniCardSort === "time")  return rt;
                          if (miniCardSort === "space") return rs;
                          if (rt != null && rs != null) return (rt + rs) / 2;
                          return rt ?? rs ?? null;
                        };
                        const ra = rankOf(a), rb = rankOf(b);
                        if (ra != null && rb != null) return ra - rb;
                        if (ra != null) return -1;
                        if (rb != null) return 1;
                        const bgoA = BIG_O_RANK[miniCardSort === "space" ? (ALGO_SPACE[a] ?? "") : (ALGO_TIME[a] ?? "")] ?? 99;
                        const bgoB = BIG_O_RANK[miniCardSort === "space" ? (ALGO_SPACE[b] ?? "") : (ALGO_TIME[b] ?? "")] ?? 99;
                        return bgoA - bgoB;
                      });
                      const maxSpaceBytes = Math.max(
                        ...chartAlgosBase.map(id => {
                          const pts = (curveDataExt[id] ?? []).filter(p => !p.timedOut);
                          return pts.sort((a, b) => b.n - a.n)[0]?.spaceBytes ?? 0;
                        }), 1
                      );
                      const maxTotalSteps = Math.max(
                        ...chartAlgosBase.map(id => prerunSteps[id]?.length ?? 0), 1
                      );
                      return (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-2">
                          {sortedCards.map(id => (
                            <AlgoMiniCard
                              key={id}
                              id={id}
                              steps={prerunSteps[id] ?? null}
                              benchData={curveDataExt[id] ?? null}
                              isActive={status === "running" && currentAlgo === id}
                              rank={summaryResults.find(r => r.id === id)?.rank ?? null}
                              spaceRank={miniCardSort !== "time" ? (summarySpaceResults.find(r => r.id === id)?.rank ?? null) : null}
                              showBoth={miniCardSort === "both"}
                              loop={status === "running"}
                              maxSpaceBytes={maxSpaceBytes}
                              maxTotalSteps={maxTotalSteps}
                              onStop={status === "running" ? () => stopAlgo(id) : undefined}
                              pulseEnabled={pulseEnabled}
                              onTogglePulse={togglePulse}
                            />
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* Mathematical analysis panel — below algorithms section */}
                {has("research") && (chartMode === "time" || chartMode === "space") && status === "done" && (
                  <MathPanel
                    data={curveDataExt}
                    algos={chartAlgos}
                    mode={chartMode}
                  />
                )}

                <div>
                {/* Rankings table at largest completed n */}
                {summaryResults.length > 0 && (() => {
                  const COL = { bl: "1px solid var(--color-border)", pl: 4 } as const;
                  const BAR_W = 40; // each bar column (speed + space) is 40px

                  // Measure name column: longest display name × ~5.5px + rank(14) + dot(5) + gaps(10)
                  const longestName = Math.max(...tableRows.map(r => {
                    if (r.kind === "ref") return r.label.length;
                    if (r.id === "timsort-js") return (ALGO_NAMES["timsort-js"] ?? "TimSort (JS)").length;
                    return ALGO_NAMES[r.id]?.length ?? 0;
                  }));
                  const NAME_W = Math.ceil(longestName * 5.5) + 29;

                  const getBestSpace = (id: string) => {
                    const p = curveDataExt[id]?.find(pt => pt.n === largestDone);
                    if (p?.allocBytes && p.allocBytes > 0) return p.allocBytes;
                    if (p?.spaceBytes && p.spaceBytes > 0) return p.spaceBytes;
                    return largestDone ? theoreticalSpaceBytes(id, largestDone) : 0;
                  };
                  const spaceFastest = Math.min(
                    ...summaryResults.map(r => getBestSpace(r.id)).filter(v => v > 0 && v < Infinity)
                  );
                  const spaceSlowest = Math.max(...summaryResults.map(r => getBestSpace(r.id)), 1);

                  // Shared cell style helpers — data cols share remaining space evenly via flex:1
                  // Fixed column widths — all data columns are the same width (CW px)
                  // except the space column which needs room for 3 stacked labels.
                  const CW  = 52;  // standard column width
                  const CSW = 72;  // space column (wider — shows alloc / heap Δ / est.)
                  const colW = (w: number, i: number): React.CSSProperties => ({
                    width: w, flexShrink: 0, textAlign: "center", fontFamily: "monospace",
                    borderLeft: i > 0 ? COL.bl : undefined, paddingLeft: i > 0 ? COL.pl : 0, overflow: "hidden",
                  });
                  const cellHd = (i: number, w = CW): React.CSSProperties => ({
                    ...colW(w, i), fontSize: 8, color: "var(--color-muted)",
                  });
                  const cell = (color: string, i: number, w = CW): React.CSSProperties => ({
                    ...colW(w, i), color,
                  });

                  const handleSort = (col: SortCol) => {
                    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
                    else { setSortCol(col); setSortDir("asc"); }
                  };
                  const sortIcon = (col: SortCol) => sortCol === col ? (sortDir === "asc" ? " ↑" : " ↓") : "";
                  const hdBtn = (col: SortCol, i: number, w = CW): React.CSSProperties => ({
                    ...cellHd(i, w),
                    cursor: "pointer", userSelect: "none", background: "none", border: "none", padding: 0,
                    color: sortCol === col ? "var(--color-text)" : "var(--color-muted)",
                  });

                  // Precompute per-algo sort keys (space/fit values)
                  const algoSortKeys = new Map(summaryResults.map(r => {
                    const sv = getBestSpace(r.id);
                    const sr = sv > 0 && spaceFastest > 0 && spaceFastest < Infinity ? sv / spaceFastest : 0;
                    const tp = (curveDataExt[r.id] ?? []).filter(p => p.timeMs > 0).map(p => ({ n: p.n, val: p.timeMs }));
                    const sp = (curveDataExt[r.id] ?? []).filter(p => (p.allocBytes ?? p.spaceBytes ?? 0) > 0).map(p => ({ n: p.n, val: p.allocBytes ?? p.spaceBytes! }));
                    const tf = fitLogLog(tp);
                    const sf = fitLogLog(sp);
                    return [r.id, {
                      spaceVal: sv, spaceRatio: sr,
                      tLabel: tf?.label ?? (ALGO_TIME[r.id]?.replace(/^O\(/, "").replace(/\)$/, "").replace(/ log n/g, "logn") ?? ""),
                      sLabel: sf?.label ?? (ALGO_SPACE[r.id]?.replace(/^O\(/, "").replace(/\)$/, "").replace(/ log n/g, "logn") ?? ""),
                      fitK: tf?.k,
                    }];
                  }));

                  const algoName = (id: string) => ALGO_NAMES[id] ?? id;
                  const sortedAlgoRows = [...summaryResults.map(r => ({ ...r, kind: "algo" as const }))].sort((a, b) => {
                    const ak = algoSortKeys.get(a.id)!;
                    const bk = algoSortKeys.get(b.id)!;
                    let cmp = 0;
                    switch (sortCol) {
                      case "name":  cmp = algoName(a.id).localeCompare(algoName(b.id)); break;
                      case "speed":
                      case "time":  cmp = a.timeMs - b.timeMs; break;
                      case "tvsb":  cmp = a.timeMs - b.timeMs; break;
                      case "tbigo": cmp = ak.tLabel.localeCompare(bk.tLabel); break;
                      case "fit":   cmp = (ak.fitK ?? 0) - (bk.fitK ?? 0); break;
                      case "space": cmp = ak.spaceVal - bk.spaceVal; break;
                      case "svsb":  cmp = ak.spaceRatio - bk.spaceRatio; break;
                      case "sbigo": cmp = ak.sLabel.localeCompare(bk.sLabel); break;
                    }
                    return sortDir === "asc" ? cmp : -cmp;
                  });
                  const sortedTableRows: TableRow[] = [
                    ...sortedAlgoRows,
                    ...refRows.sort((a, b) => a.timeMs - b.timeMs),
                  ];

                  return (
                    <div className="mt-4 pt-4" style={{ borderTop: "1px solid var(--color-border)", fontSize: 10 }}>
                      {/* Title */}
                      <p className="font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--color-muted)", fontSize: 9 }}>
                        Rankings
                        {largestDone != null && <> · n={largestDone.toLocaleString()}</>}
                        {chartSizes.length > 1 && <span style={{ fontWeight: 400, textTransform: "none" }}> (largest)</span>}
                      </p>

                      {/* Column headers */}
                      <div className="flex items-center mb-1.5">
                        <button onClick={() => handleSort("name")} style={{ width: NAME_W, flexShrink: 0, textAlign: "left", fontSize: 8, fontFamily: "monospace", cursor: "pointer", userSelect: "none", background: "none", border: "none", padding: "0 4px 0 18px", color: sortCol === "name" ? "var(--color-text)" : "var(--color-muted)" }}>
                          name{sortIcon("name")}
                        </button>
                        <button onClick={() => handleSort("speed")} style={{ width: BAR_W, flexShrink: 0, textAlign: "center", fontSize: 8, fontFamily: "monospace", cursor: "pointer", userSelect: "none", background: "none", border: "none", padding: 0, color: sortCol === "speed" ? "var(--color-text)" : "var(--color-muted)" }}>
                          speed{sortIcon("speed")}
                        </button>
                        <button onClick={() => handleSort("space")} style={{ width: BAR_W, flexShrink: 0, textAlign: "center", fontSize: 8, fontFamily: "monospace", cursor: "pointer", userSelect: "none", background: "none", border: "none", padding: 0, color: sortCol === "space" ? "var(--color-text)" : "var(--color-muted)" }}>
                          space{sortIcon("space")}
                        </button>
                        <div style={{ display: "flex", borderLeft: COL.bl }}>
                          <button style={hdBtn("time",  0)}      onClick={() => handleSort("time")}>time{sortIcon("time")}</button>
                          <button style={hdBtn("tvsb",  1)}      onClick={() => handleSort("tvsb")}>t vs best{sortIcon("tvsb")}</button>
                          <button style={hdBtn("tbigo", 1)}      onClick={() => handleSort("tbigo")}>t big O{sortIcon("tbigo")}</button>
                          <button style={hdBtn("fit",   1)}      onClick={() => handleSort("fit")} title="Empirically fitted exponent k (time ∝ nᵏ)">fit nᵏ{sortIcon("fit")}</button>
                          <div style={cellHd(1)}                 title="Working-set cache level at the largest measured n">cache</div>
                          <button style={hdBtn("space", 1, CSW)} onClick={() => handleSort("space")}>space{sortIcon("space")}</button>
                          <button style={hdBtn("svsb",  1)}      onClick={() => handleSort("svsb")}>s vs best{sortIcon("svsb")}</button>
                          <button style={hdBtn("sbigo", 1)}      onClick={() => handleSort("sbigo")}>s big O{sortIcon("sbigo")}</button>
                        </div>
                      </div>

                      {/* Rows */}
                      <div className="flex flex-col gap-1.5">
                        {/* Timed-out algorithms with fitted-curve estimate */}
                        {largestDone !== null && (() => {
                          const timedOutRows = (runConfig?.algos ?? []).filter(id =>
                            curveDataExt[id]?.some(p => p.n === largestDone && p.timedOut)
                          );
                          if (timedOutRows.length === 0) return null;
                          return timedOutRows.map(id => {
                            const safePts = (curveDataExt[id] ?? []).filter(p => !p.timedOut && p.timeMs > 0).map(p => ({ n: p.n, val: p.timeMs }));
                            const fit = fitLogLog(safePts);
                            const timedN = curveDataExt[id]?.find(p => p.n === largestDone && p.timedOut)?.n;
                            const estMs = fit ? fit.k * fit.fn(largestDone) : null;
                            const dotColor = ALGO_COLORS[id] ?? "#888";
                            return (
                              <div key={`timed-${id}`} className="flex items-center" style={{ opacity: 0.5 }}>
                                <div className="flex items-center gap-1.5" style={{ width: NAME_W, flexShrink: 0, paddingRight: 4 }}>
                                  <span className="font-mono" style={{ width: 14, textAlign: "right", flexShrink: 0, color: "var(--color-muted)" }}>—</span>
                                  <span style={{ width: 5, height: 5, borderRadius: "50%", background: dotColor, flexShrink: 0, display: "inline-block" }} />
                                  <span className="min-w-0 flex flex-col leading-tight">
                                    <span className="truncate" style={{ color: "var(--color-text)" }}>{ALGO_NAMES[id]}</span>
                                    <span style={{ fontSize: 8, color: "var(--color-state-swap)" }}>timed out at n={timedN != null ? fmtN(timedN) : "?"}</span>
                                  </span>
                                </div>
                                <div style={{ width: BAR_W, flexShrink: 0, padding: "0 5px", display: "flex", alignItems: "center" }}>
                                  <div style={{ flex: 1, borderRadius: 3, overflow: "hidden", background: "var(--color-surface-3)", height: 8 }}>
                                    <div style={{ width: "100%", height: "100%", borderRadius: 3, background: "var(--color-state-swap)", opacity: 0.4 }} />
                                  </div>
                                </div>
                                <div style={{ width: BAR_W, flexShrink: 0 }} />
                                <div style={{ display: "flex", borderLeft: COL.bl }}>
                                  <div style={cell("var(--color-state-swap)", 0)} title={estMs != null ? `Extrapolated from fit on non-timed-out points` : "Not enough data to estimate"}>
                                    {estMs != null ? `~${fmtPredicted(estMs)}` : ">10 s"}
                                  </div>
                                  <div style={cell("var(--color-muted)", 1)}>{estMs != null ? `${(estMs / summaryFastest).toFixed(0)}×` : "—"}</div>
                                  <div style={cell("var(--color-muted)", 1)}>{ALGO_TIME[id]?.replace(/^O\(/, "").replace(/\)$/, "").replace(/ log n/g, "logn") ?? "—"}</div>
                                  <div style={cell("var(--color-muted)", 1)}>{fit?.label ?? "—"}</div>
                                  <div style={cell("var(--color-muted)", 1)}>—</div>
                                  <div style={cell("var(--color-muted)", 1, CSW)}>—</div>
                                  <div style={cell("var(--color-muted)", 1)}>—</div>
                                  <div style={cell("var(--color-muted)", 1)}>—</div>
                                </div>
                              </div>
                            );
                          });
                        })()}

                        {sortedTableRows.map((row) => {
                          if (row.kind === "ref") {
                            const barPct    = Math.min(100, summarySlowest > 0 ? (row.timeMs / summarySlowest) * 100 : 0);
                            const overScale = row.timeMs > summarySlowest;
                            return (
                              <div key={`ref-${row.label}`} className="flex items-center" style={{ opacity: 0.6 }}>
                                <div className="flex items-center gap-1.5" style={{ width: NAME_W, flexShrink: 0, paddingRight: 4 }}>
                                  <span className="font-mono" style={{ width: 14, textAlign: "right", flexShrink: 0, color: "var(--color-muted)" }}>—</span>
                                  <span className="font-mono italic truncate" style={{ color: row.color }}>{row.label}</span>
                                </div>
                                <div style={{ width: BAR_W, flexShrink: 0, padding: "0 5px", display: "flex", alignItems: "center" }}>
                                  <div style={{ flex: 1, borderRadius: 3, overflow: "hidden", background: "var(--color-surface-3)", height: 8 }}>
                                    <div style={{
                                      width: `${overScale ? 100 : barPct}%`, height: "100%", borderRadius: 3, minWidth: 3,
                                      background: row.color, opacity: 0.4,
                                      backgroundImage: "repeating-linear-gradient(90deg, transparent, transparent 4px, rgba(0,0,0,0.25) 4px, rgba(0,0,0,0.25) 5px)",
                                    }} />
                                  </div>
                                </div>
                                <div style={{ width: BAR_W, flexShrink: 0, padding: "0 5px", display: "flex", alignItems: "center" }}>
                                  <div style={{ flex: 1, borderRadius: 3, background: "var(--color-surface-3)", height: 8 }} />
                                </div>
                                <div style={{ display: "flex", borderLeft: COL.bl }}>
                                  <div style={cell(row.color, 0)}>{overScale ? "↑" : ""}{fmtPredicted(row.timeMs)}</div>
                                  <div style={cell("var(--color-muted)", 1)}>{(row.timeMs / summaryFastest).toFixed(1)}×</div>
                                  <div style={cell("var(--color-muted)", 1)}>{row.label.replace(/^O\(/, "").replace(/\)$/, "").replace(/ log n/g, "logn")}</div>
                                  <div style={cell("var(--color-muted)", 1)}>—</div>
                                  <div style={cell("var(--color-muted)", 1)}>—</div>
                                  <div style={cell("var(--color-muted)", 1, CSW)}>—</div>
                                  <div style={cell("var(--color-muted)", 1)}>—</div>
                                  <div style={cell("var(--color-muted)", 1)}>—</div>
                                </div>
                              </div>
                            );
                          }

                          const barPct     = summarySlowest > 0 ? (row.timeMs / summarySlowest) * 100 : 0;
                          const rankClr    = rankColor(row.rank, summaryResults.length);
                          const dotColor   = ALGO_COLORS[row.id];
                          const pt             = curveDataExt[row.id]?.find(p => p.n === largestDone);
                          const spaceVal       = pt?.spaceBytes;    // heap delta (V8, often 0)
                          const allocVal       = pt?.allocBytes;    // instrumented alloc count
                          const spaceIsMeasured = spaceVal != null && spaceVal > 0;
                          const allocIsMeasured = allocVal != null && allocVal > 0;
                          const spaceTheo      = largestDone != null ? theoreticalSpaceBytes(row.id, largestDone) : null;
                          // Use best available for bar chart / ratio: alloc > heap > theoretical
                          const spaceForChart  = allocIsMeasured ? allocVal! : spaceIsMeasured ? spaceVal! : (spaceTheo ?? 0);
                          const spaceRatio = spaceForChart > 0 && spaceFastest > 0 && spaceFastest < Infinity ? spaceForChart / spaceFastest : null;
                          const timeStr    = fmtTime(row.timeMs);
                          const spaceStr   = allocIsMeasured
                            ? fmtBytes(allocVal!)
                            : spaceIsMeasured
                              ? fmtBytes(spaceVal!)
                              : (ALGO_SPACE[row.id]?.replace(/^O\(/, "").replace(/\)$/, "").replace("log n", "logn") ?? "—");
                          const spRatioStr = spaceRatio != null ? (spaceRatio < 1.05 ? "—" : `${spaceRatio.toFixed(1)}×`) : "—";
                          const timePts  = (curveDataExt[row.id] ?? []).filter(p => p.timeMs > 0).map(p => ({ n: p.n, val: p.timeMs }));
                          const spacePts = (curveDataExt[row.id] ?? []).filter(p => (p.allocBytes ?? p.spaceBytes ?? 0) > 0).map(p => ({ n: p.n, val: p.allocBytes ?? p.spaceBytes! }));
                          const timeFit  = fitLogLog(timePts);
                          const spaceFit = fitLogLog(spacePts);
                          const tBigOLabel = timeFit?.label ?? (ALGO_TIME[row.id]?.replace(/^O\(/, "").replace(/\)$/, "").replace(/ log n/g, "logn") ?? "—");
                          const sBigOLabel = spaceFit?.label ?? (ALGO_SPACE[row.id]?.replace(/^O\(/, "").replace(/\)$/, "").replace(/ log n/g, "logn") ?? "—");
                          const tPct = largestDone != null && timeFit ? timeFit.pctAt(largestDone, row.timeMs) : null;
                          const sPct = largestDone != null && spaceFit && spaceVal ? spaceFit.pctAt(largestDone, spaceVal) : null;
                          const isHoverT = hoverBigO?.id === row.id && hoverBigO.type === "time";
                          const isHoverS = hoverBigO?.id === row.id && hoverBigO.type === "space";
                          const fmtPct = (pct: number) => `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`;
                          const canDl    = largestDone != null;
                          const handleDl = () => {
                            if (!largestDone) return;
                            const n        = largestDone;
                            const spaceClz = ALGO_SPACE[row.id] ?? "unknown";

                            // Build space breakdown explanation specific to this n
                            let spaceBreakdown: Record<string, unknown>;
                            if (spaceClz === "O(1)") {
                              spaceBreakdown = {
                                class: "O(1) — constant",
                                explanation: "In-place sort. Uses only a fixed number of scalar variables regardless of n (loop counter, swap temp, pivot). No auxiliary arrays.",
                                constant_overhead_bytes: 200,
                              };
                            } else if (spaceClz === "O(log n)") {
                              const depth = Math.ceil(Math.log2(Math.max(n, 2)));
                              spaceBreakdown = {
                                class: "O(log n) — logarithmic",
                                explanation: `Recursive algorithm. Maximum call stack depth = ⌈log₂(${n})⌉ = ${depth} frames. Each frame holds a constant set of local variables (~64 bytes).`,
                                max_recursion_depth: depth,
                                bytes_per_frame: 64,
                                total_bytes: depth * 64,
                              };
                            } else if (spaceClz === "O(n)") {
                              spaceBreakdown = {
                                class: "O(n) — linear",
                                explanation: `Requires an auxiliary array of n elements for merge operations. ${n.toLocaleString()} elements × 8 bytes (Float64) = ${(n * 8).toLocaleString()} bytes.`,
                                auxiliary_elements: n,
                                bytes_per_element: 8,
                                total_bytes: n * 8,
                              };
                            } else {
                              spaceBreakdown = {
                                class: spaceClz,
                                explanation: "See algorithm documentation.",
                                theoretical_bytes: theoreticalSpaceBytes(row.id, n),
                              };
                            }

                            const sampleCount = Math.min(Math.ceil(n * 0.05), 25);
                            const inputSample = generateBenchmarkInput(sampleCount, "random");
                            const sortedSample = SORT_FNS[row.id]?.([...inputSample]) ?? [...inputSample].sort((a, b) => a - b);

                            const proof = {
                              proof_type: "space_complexity_verification",
                              algorithm: ALGO_NAMES[row.id],
                              n,
                              time_complexity: ALGO_TIME[row.id],
                              space_complexity: spaceClz,
                              space_breakdown: spaceBreakdown,
                              measured_heap_delta_bytes: (spaceVal != null && spaceVal > 0) ? spaceVal : null,
                              theoretical_bytes: theoreticalSpaceBytes(row.id, n),
                              input_sample: {
                                note: `${sampleCount} of ${n.toLocaleString()} elements (${sampleCount === 25 ? "capped at 25" : "5%"}). Same distribution as benchmark inputs: uniform integers in [0, 10 000).`,
                                count: sampleCount,
                                values: inputSample,
                                sorted: sortedSample,
                              },
                              generated_at: new Date().toISOString(),
                            };

                            const blob = new Blob([JSON.stringify(proof, null, 2)], { type: "application/json" });
                            const url  = URL.createObjectURL(blob);
                            const a    = document.createElement("a");
                            a.href = url; a.download = `space-proof-${row.id}-n${n}.json`; a.click();
                            URL.revokeObjectURL(url);
                          };

                          return (
                            <div key={row.id} className="flex items-center">
                              <div className="flex items-center gap-1.5" style={{ width: NAME_W, flexShrink: 0, paddingRight: 4 }}>
                                <span className="font-mono" style={{ width: 14, textAlign: "right", flexShrink: 0, color: rankClr }}>{row.rank}</span>
                                <span style={{ width: 5, height: 5, borderRadius: "50%", background: dotColor, flexShrink: 0, display: "inline-block" }} />
                                <span className="min-w-0 flex flex-col leading-tight">
                                  <WithAlgoTooltip id={row.id}>
                                    <span className="truncate" style={{ color: "var(--color-text)", fontWeight: row.rank === 1 ? 600 : 400 }}>{ALGO_NAMES[row.id]}</span>
                                  </WithAlgoTooltip>
                                  {/* Adversarial input shortcut */}
                                  {has("research") && largestDone != null && (
                                    <button
                                      title={`Load worst-case input for ${ALGO_NAMES[row.id]}`}
                                      onClick={() => {
                                        const arr = makeAdversarialInput(row.id, Math.min(largestDone, 100));
                                        alert(`Adversarial input for ${ALGO_NAMES[row.id]} (n=${Math.min(largestDone, 100)}):\n[${arr.slice(0,20).join(", ")}${arr.length > 20 ? "..." : ""}]`);
                                      }}
                                      style={{ fontSize: 7, padding: "0px 4px", borderRadius: 2, cursor: "pointer", background: "rgba(239,83,80,0.1)", border: "1px solid rgba(239,83,80,0.25)", color: "#ef5350", marginTop: 1 }}
                                    >⚠ worst</button>
                                  )}
                                </span>
                              </div>
                              <div style={{ width: BAR_W, flexShrink: 0, padding: "0 5px", display: "flex", alignItems: "center" }}>
                                <div style={{ flex: 1, borderRadius: 3, overflow: "hidden", background: "var(--color-surface-3)", height: 8 }}>
                                  <div style={{
                                    width: `${barPct}%`, height: "100%", borderRadius: 3, minWidth: barPct > 0 ? 3 : 0,
                                    background: dotColor, opacity: 0.85, transition: "width 0.35s ease",
                                  }} />
                                </div>
                              </div>
                              <div style={{ width: BAR_W, flexShrink: 0, padding: "0 5px", display: "flex", alignItems: "center" }}>
                                <div style={{ flex: 1, borderRadius: 3, overflow: "hidden", background: "var(--color-surface-3)", height: 8 }}>
                                  <div style={{
                                    width: `${spaceForChart > 0 ? Math.min(100, (spaceForChart / spaceSlowest) * 100) : 0}%`,
                                    height: "100%", borderRadius: 3, minWidth: spaceForChart > 0 ? 3 : 0,
                                    background: dotColor, opacity: 0.5, transition: "width 0.35s ease",
                                  }} />
                                </div>
                              </div>
                              <div style={{ display: "flex", borderLeft: COL.bl }}>
                                <div style={cell(rankClr, 0)}>{timeStr}</div>
                                <div style={cell("var(--color-muted)", 1)}>{row.rank === 1 ? "—" : `${(row.timeMs / summaryFastest).toFixed(1)}×`}</div>
                                <div
                                  style={{ ...cell("var(--color-text)", 1), opacity: 0.75, cursor: "default" }}
                                  title={ALGO_TIME[row.id]}
                                  onMouseEnter={() => setHoverBigO({ id: row.id, type: "time" })}
                                  onMouseLeave={() => setHoverBigO(null)}
                                >
                                  {isHoverT && tPct !== null ? fmtPct(tPct) : tBigOLabel}
                                </div>
                                <div
                                  style={{ ...cell("var(--color-muted)", 1), opacity: 0.8, cursor: "default" }}
                                  title={timeFit ? `Empirical fit: time ∝ n^${timeFit.k.toFixed(3)} (log-log regression on measured points)` : "Not enough data to fit"}
                                >
                                  {timeFit ? `n${toSup(timeFit.k.toFixed(2))}` : "—"}
                                </div>
                                {/* Cache level at largestDone */}
                                {(() => {
                                  if (!largestDone) return <div style={cell("var(--color-muted)", 1)}>—</div>;
                                  const cl = cacheLevel(row.id, largestDone);
                                  return (
                                    <div style={cell(cl.color, 1)} title={`Array of ${largestDone.toLocaleString()} × 8B = ${fmtBytes(largestDone * 8)} working set → ${cl.label}`}>
                                      {cl.label}
                                    </div>
                                  );
                                })()}
                                <div style={{ ...cell("var(--color-text)", 1, CSW), opacity: 0.75 }} title={`aux ${ALGO_SPACE[row.id] ?? "—"} · total ${totalSpaceLabel(row.id)}`}>
                                  <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 1 }}>
                                    <span style={{ color: allocIsMeasured ? "#4db6ac" : "var(--color-muted)", fontFamily: "monospace", fontSize: "inherit" }}
                                      title="Auxiliary alloc: bytes counted via patched Array methods — extra space beyond the input">
                                      {allocIsMeasured ? fmtBytes(allocVal!) : "—"} <span style={{ fontSize: 7 }}>aux</span>
                                    </span>
                                    {allocIsMeasured && largestDone != null && (
                                      <span style={{ fontSize: 7, fontFamily: "monospace", color: "#80cbc4", opacity: 0.85 }}
                                        title={`Total space: auxiliary (${fmtBytes(allocVal!)}) + input (${fmtBytes(largestDone * 8)})`}>
                                        {fmtBytes(allocVal! + largestDone * 8)} total
                                      </span>
                                    )}
                                    <span style={{ fontSize: 7, fontFamily: "monospace", color: spaceIsMeasured ? "#ffb74d" : "var(--color-muted)", opacity: 0.85 }}
                                      title="V8 heap delta (performance.memory — unreliable for fast sorts)">
                                      {spaceIsMeasured ? fmtBytes(spaceVal!) : "—"} heap Δ
                                    </span>
                                    <span style={{ fontSize: 7, fontFamily: "monospace", color: "var(--color-muted)", opacity: 0.7 }}
                                      title="Theoretical auxiliary: worst-case estimate from Big-O class">
                                      {spaceTheo != null ? fmtBytes(spaceTheo) : "—"} est. aux
                                      {canDl && has("research") && (
                                        <> · <a onClick={handleDl} style={{ color: "var(--color-accent)", cursor: "pointer", textDecoration: "underline" }} title="Download space proof JSON">proof</a></>
                                      )}
                                    </span>
                                  </span>
                                </div>
                                <div style={cell("var(--color-muted)", 1)}>{spRatioStr}</div>
                                <div
                                  style={{ ...cell("var(--color-text)", 1), opacity: 0.75, cursor: "default" }}
                                  title={ALGO_SPACE[row.id]}
                                  onMouseEnter={() => setHoverBigO({ id: row.id, type: "space" })}
                                  onMouseLeave={() => setHoverBigO(null)}
                                >
                                  {isHoverS && sPct !== null ? fmtPct(sPct) : sBigOLabel}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
                </div>{/* end order:1 rankings section */}
                {/* Head-to-head pair matrix */}
                {status === "done" && summaryResults.length >= 2 && (
                  <PairMatrix results={summaryResults} spaceResults={summarySpaceResults} />
                )}
              </div>
            )}

          </div>
        </div>


      </div>

      {/* ── Mobile sticky run/stop bar ── */}
      <div
        className="lg:hidden print:hidden fixed bottom-0 left-0 right-0 flex gap-2 px-4 py-3"
        style={{
          background: "var(--color-surface-1)",
          borderTop: "1px solid var(--color-border)",
          zIndex: 40,
          paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))",
        }}
      >
        {status === "running" ? (
          <button onClick={stop} style={btn("danger", { flex: 1, justifyContent: "center", padding: "6px 0" })}>
            <Square size={13} strokeWidth={2} fill="currentColor" /> Stop
          </button>
        ) : (
          <button
            onClick={() => run()}
            disabled={!canRun}
            style={btn("primary", { flex: 1, justifyContent: "center", padding: "6px 0", opacity: canRun ? 1 : 0.5, cursor: canRun ? "pointer" : "not-allowed" })}
          >
            <Play size={13} strokeWidth={2} />
            {status === "done" ? "Re-run" : "Run benchmark"}
          </button>
        )}
        {status === "done" && (
          <button onClick={reset} style={btn("secondary", { padding: "6px 14px" })}>
            <RotateCcw size={12} strokeWidth={1.75} />
          </button>
        )}
      </div>

    </div>
  );
}
