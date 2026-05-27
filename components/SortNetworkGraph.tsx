"use client";

import { useEffect, useMemo, useRef } from "react";
import { Network, Download } from "lucide-react";
import CytoscapeBase, { type CytoscapeBaseHandle } from "./CytoscapeBase";
import type { SessionLog } from "./SessionCurves";
import { cyLineStyle, DT_LABEL, DT_LEGEND_TEXT, type DataType } from "@/lib/dataTypeStyle";

/*
 * Network view of every (algorithm, data-type) measurement in the session.
 *
 * Each ALGORITHM is a node colored by its algo palette entry. Each DATA TYPE
 * (integer / float / string) is a HUB node sitting at the center of the graph.
 * Every (algo, dtype) measurement contributes one EDGE from the algo to the
 * matching dtype hub, with THREE encodings overlaid on the same edge:
 *
 *    color       speed of (algo, dtype), normalized within the algorithm's
 *                own dtype variants (green = fastest of its dtypes, red =
 *                slowest). One-dtype-only algos are drawn in neutral blue
 *                because there's nothing to compare against.
 *    width       memory usage at the largest measured n, log-scaled across
 *                ALL edges so the chart-level comparison is visible (a thick
 *                line = lots of aux memory anywhere in the run).
 *    line-style  the data-type symbolic convention from lib/dataTypeStyle.ts:
 *                string = solid, float = dashed, integer = dotted. The dtype
 *                hub node itself wears the same border style, reinforcing the
 *                rule visually.
 *
 * This is the "everything at once" view — for any single algo you can read its
 * three spokes and immediately see which dtype it's fastest on, which one
 * costs the most memory, and which is missing entirely (no spoke = no data).
 */

export interface SortNetworkGraphProps {
  log: SessionLog;
  algoNames: Record<string, string>;
  algoColors: Record<string, string>;
}

/** Stylesheet read by cytoscape. The data-driven mappings (`data(...)`) let
 *  per-element styling come from the elements' `data` payloads, so we don't
 *  need to write one selector per algo / per dtype. */
const STYLESHEET: object[] = [
  {
    selector: "node[kind = 'algo']",
    style: {
      "background-color": "data(color)",
      "border-color": "data(color)",
      "border-width": 1,
      "label": "data(label)",
      "color": "#fff",
      "text-outline-color": "data(color)",
      "text-outline-width": 2,
      "font-size": 9,
      "font-weight": 600,
      "font-family": "monospace",
      "width": 28,
      "height": 28,
      "text-valign": "center",
      "text-halign": "center",
    },
  },
  {
    selector: "node[kind = 'dt']",
    style: {
      "background-color": "#e8e4da",
      "border-color": "#3a3a3a",
      // Dtype hubs wear the symbolic line-style on their border — the same
      // convention used on their incoming edges. Reading the chart you see
      // the dotted/dashed/solid rule reinforced at both ends of every spoke.
      "border-style": "data(borderStyle)",
      "border-width": 3,
      "label": "data(label)",
      "color": "#0a0a0a",
      "font-size": 11,
      "font-weight": 700,
      "font-family": "monospace",
      "width": 56,
      "height": 56,
      "shape": "round-rectangle",
      "text-valign": "center",
      "text-halign": "center",
    },
  },
  {
    selector: "edge",
    style: {
      "line-color": "data(lineColor)",
      "width": "data(lineWidth)",
      "line-style": "data(lineStyle)",
      // bezier with control-point-step-size > 0 fans parallel edges (multiple
      // edges between the same source/target) out into a stack instead of
      // collapsing them on top of each other. Without this, the n-weighted
      // multi-edges between e.g. QuickSort → Integer would all sit at the
      // exact same path and visually look like a single edge.
      "curve-style": "bezier",
      // Wider fan-out — with widths up to 20px the parallel multi-edges
      // between (algo, dtype-hub) need more lateral separation or they'll
      // overlap into a single blurry stripe.
      "control-point-step-size": 32,
      "target-arrow-shape": "none",
      "source-arrow-shape": "none",
      "opacity": 0.7,
    },
  },
];

/** Linear-interpolate hue between two angles for the speed color. Saturation +
 *  lightness fixed so the gradient reads cleanly against the surface tone. */
function speedHsl(t: number): string {
  // t ∈ [0,1]; 0 = fast (green), 1 = slow (red).
  const hue = 120 * (1 - t);
  return `hsl(${hue.toFixed(0)}, 65%, 45%)`;
}

function fmtBytes(b: number): string {
  if (b <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0, v = b;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v < 10 ? 2 : v < 100 ? 1 : 0)} ${units[i]}`;
}

function fmtMs(ms: number): string {
  if (ms < 1)    return `${ms.toFixed(2)}ms`;
  if (ms < 1000) return `${ms.toFixed(1)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

/** Same compact-n formatter the rest of the app uses (1k / 1M / 1B). Inlined
 *  here because BenchmarkVisualizer's fmtN isn't exported and importing it
 *  would create a cycle. */
function fmtN(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1).replace(/\.0$/, "")}B`;
  if (n >= 1_000_000)     return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000)         return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
  return String(n);
}

// ── Export ─────────────────────────────────────────────────────────────────
// Three formats covering the common workflows:
//   GraphML — Gephi / yEd / NetworkX / Cytoscape Desktop import
//   CSV     — pandas / spreadsheet analysis (edge-list flavor; nodes are
//             trivially derivable from the source/target columns)
//   JSON    — cytoscape-elements format, round-trippable into any cy.js setup
// All three encode the same underlying (algo, dtype, n, timeMs, spaceBytes)
// per edge — the format choice is about destination tooling, not data.

interface ExportNode {
  id: string;
  label: string;
  kind: "algo" | "dt";
  color?: string;
  dtype?: string;
}

interface ExportEdge {
  id: string;
  source: string;
  target: string;
  algo: string;
  dtype: string;
  n: number;
  timeMs: number;
  spaceBytes: number;
  weight: number;       // mirrors edge width in the rendered graph
  lineStyle: string;    // solid / dashed / dotted — the dtype convention
}

function buildExportData(
  cells: Cell[],
  algoNames: Record<string, string>,
  algoColors: Record<string, string>,
  nToWidth: (n: number) => number,
): { nodes: ExportNode[]; edges: ExportEdge[] } {
  const algoIds = [...new Set(cells.map(c => c.algo))];
  const dtypes  = [...new Set(cells.map(c => c.dt))];
  const nodes: ExportNode[] = [
    ...algoIds.map(a => ({
      id: `algo:${a}`,
      label: algoNames[a] ?? a,
      kind: "algo" as const,
      color: algoColors[a] ?? "#888888",
    })),
    ...dtypes.map(dt => ({
      id: `dt:${dt}`,
      label: DT_LABEL[dt],
      kind: "dt" as const,
      dtype: dt,
    })),
  ];
  const edges: ExportEdge[] = cells.map(c => ({
    id: `e:${c.algo}:${c.dt}:${c.n}`,
    source: `algo:${c.algo}`,
    target: `dt:${c.dt}`,
    algo: c.algo,
    dtype: c.dt,
    n: c.n,
    timeMs: c.timeMs,
    spaceBytes: c.spaceBytes,
    weight: nToWidth(c.n),
    lineStyle: cyLineStyle(c.dt),
  }));
  return { nodes, edges };
}

function escapeXml(s: string): string {
  return s.replace(/[<>&"']/g, c => (
    c === "<"  ? "&lt;"
    : c === ">"  ? "&gt;"
    : c === "&"  ? "&amp;"
    : c === '"'  ? "&quot;"
    :              "&apos;"
  ));
}

/** Single-line CSV field escape — wrap in quotes when the field contains
 *  a comma, quote, or newline; double up internal quotes. Cheap and
 *  RFC 4180 compliant for the field types we emit (short ids + numbers). */
function escapeCsv(v: string | number): string {
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toGraphML(data: { nodes: ExportNode[]; edges: ExportEdge[] }): string {
  const { nodes, edges } = data;
  // <key> declarations come first — GraphML readers require the attribute
  // schema before any <data> tag that references it.
  const keys = [
    `  <key id="kind"       for="node" attr.name="kind"       attr.type="string"/>`,
    `  <key id="label"      for="node" attr.name="label"      attr.type="string"/>`,
    `  <key id="color"      for="node" attr.name="color"      attr.type="string"/>`,
    `  <key id="dtype"      for="node" attr.name="dtype"      attr.type="string"/>`,
    `  <key id="algo"       for="edge" attr.name="algo"       attr.type="string"/>`,
    `  <key id="edgeDtype"  for="edge" attr.name="dtype"      attr.type="string"/>`,
    `  <key id="n"          for="edge" attr.name="n"          attr.type="long"/>`,
    `  <key id="timeMs"     for="edge" attr.name="timeMs"     attr.type="double"/>`,
    `  <key id="spaceBytes" for="edge" attr.name="spaceBytes" attr.type="long"/>`,
    `  <key id="weight"     for="edge" attr.name="weight"     attr.type="double"/>`,
    `  <key id="lineStyle"  for="edge" attr.name="lineStyle"  attr.type="string"/>`,
  ].join("\n");
  const nodeXml = nodes.map(n => {
    const data = [
      `      <data key="kind">${escapeXml(n.kind)}</data>`,
      `      <data key="label">${escapeXml(n.label)}</data>`,
      ...(n.color  ? [`      <data key="color">${escapeXml(n.color)}</data>`]   : []),
      ...(n.dtype  ? [`      <data key="dtype">${escapeXml(n.dtype)}</data>`]   : []),
    ].join("\n");
    return `    <node id="${escapeXml(n.id)}">\n${data}\n    </node>`;
  }).join("\n");
  const edgeXml = edges.map(e =>
    `    <edge id="${escapeXml(e.id)}" source="${escapeXml(e.source)}" target="${escapeXml(e.target)}">\n` +
    `      <data key="algo">${escapeXml(e.algo)}</data>\n` +
    `      <data key="edgeDtype">${escapeXml(e.dtype)}</data>\n` +
    `      <data key="n">${e.n}</data>\n` +
    `      <data key="timeMs">${e.timeMs}</data>\n` +
    `      <data key="spaceBytes">${e.spaceBytes}</data>\n` +
    `      <data key="weight">${e.weight}</data>\n` +
    `      <data key="lineStyle">${escapeXml(e.lineStyle)}</data>\n` +
    `    </edge>`
  ).join("\n");
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<graphml xmlns="http://graphml.graphdrawing.org/xmlns"`,
    `         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"`,
    `         xsi:schemaLocation="http://graphml.graphdrawing.org/xmlns http://graphml.graphdrawing.org/xmlns/1.0/graphml.xsd">`,
    keys,
    `  <graph id="SortNetwork" edgedefault="undirected">`,
    nodeXml,
    edgeXml,
    `  </graph>`,
    `</graphml>`,
    ``,
  ].join("\n");
}

function toCSV(data: { edges: ExportEdge[] }): string {
  // Edge-list CSV — nodes are implicit from unique source/target values, so
  // we skip the nodes table to keep this a single-file download. Pandas /
  // NetworkX / Gephi all import this directly.
  const header = "source,target,algo,dtype,n,timeMs,spaceBytes,weight,lineStyle";
  const rows = data.edges.map(e => [
    escapeCsv(e.source),
    escapeCsv(e.target),
    escapeCsv(e.algo),
    escapeCsv(e.dtype),
    escapeCsv(e.n),
    escapeCsv(e.timeMs),
    escapeCsv(e.spaceBytes),
    escapeCsv(e.weight),
    escapeCsv(e.lineStyle),
  ].join(","));
  return [header, ...rows].join("\n") + "\n";
}

function toJSON(data: { nodes: ExportNode[]; edges: ExportEdge[] }): string {
  // Wrap in the cytoscape-elements shape so a consumer can hand the
  // `elements` array straight to `cytoscape({ elements })` and have it
  // render. Preserves all custom attributes under `data.*`.
  const elements = [
    ...data.nodes.map(n => ({ group: "nodes" as const, data: { ...n } })),
    ...data.edges.map(e => ({ group: "edges" as const, data: { ...e } })),
  ];
  return JSON.stringify({
    format: "cytoscape-elements",
    version: "1.0",
    generatedAt: new Date().toISOString(),
    elements,
  }, null, 2);
}

/** Build the n → edge-width function shared by both the live rendering and
 *  the export plumbing. Largest n in the dataset maps to MAX_WIDTH px;
 *  smallest to MIN_WIDTH. Log-scaled so n=10k and n=1M aren't
 *  indistinguishable on screen. */
function makeNToWidth(cells: Cell[]): (n: number) => number {
  const MAX_WIDTH = 20;
  const MIN_WIDTH = 1;
  if (cells.length === 0) return () => MAX_WIDTH;
  const allN = cells.map(c => c.n);
  const minLogN = Math.log10(Math.min(...allN));
  const maxLogN = Math.log10(Math.max(...allN));
  return (n: number): number => {
    if (maxLogN <= minLogN) return MAX_WIDTH;
    const t = (Math.log10(n) - minLogN) / (maxLogN - minLogN);
    return MIN_WIDTH + t * (MAX_WIDTH - MIN_WIDTH);
  };
}

function downloadText(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  // Some browsers require the anchor to be in the DOM for the click to
  // actually trigger the download (looking at you, Firefox).
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

interface Cell {
  algo: string;
  dt: DataType;
  n: number;
  timeMs: number;
  spaceBytes: number;
}

/** Reduce sessionLog → ONE cell per measurement (algo × dtype × n).
 *  Multiple cells per (algo, dtype) is the point — each one becomes its own
 *  graph edge so the viewer can see the algorithm's full sweep, not just a
 *  single representative point. */
function aggregate(log: SessionLog): Cell[] {
  const out: Cell[] = [];
  for (const [dtRaw, byAlgo] of Object.entries(log)) {
    const dt = dtRaw as DataType;
    if (dt !== "integer" && dt !== "float" && dt !== "string") continue;
    for (const [algo, byN] of Object.entries(byAlgo)) {
      for (const [kRaw, v] of Object.entries(byN)) {
        const n = Number(kRaw);
        if (!v || v.meanTimeMs <= 0 || !Number.isFinite(n) || n <= 0) continue;
        out.push({
          algo, dt, n,
          timeMs: v.meanTimeMs,
          spaceBytes: Math.max(0, v.meanSpaceBytes),
        });
      }
    }
  }
  return out;
}

interface CyElement {
  group: "nodes" | "edges";
  data: Record<string, string | number>;
}

function buildElements(
  log: SessionLog,
  algoNames: Record<string, string>,
  algoColors: Record<string, string>,
): { elements: CyElement[]; cells: Cell[] } {
  const cells = aggregate(log);
  if (cells.length === 0) return { elements: [], cells };

  // Bucket cells by (dtype, n) so each measurement's color is its rank
  // *within its size class* — at this n on this dtype, who's fastest? Picking
  // the bucket scope lets the chart answer "which algo wins at each size?"
  // directly. The alternative (per-algo normalization across sizes) would
  // collapse most edges to red because small-n measurements always look
  // fast relative to large-n on the same algo.
  const bucket = new Map<string, Cell[]>();
  for (const c of cells) {
    const k = `${c.dt}|${c.n}`;
    if (!bucket.has(k)) bucket.set(k, []);
    bucket.get(k)!.push(c);
  }
  const colorFor = (c: Cell): string => {
    const b = bucket.get(`${c.dt}|${c.n}`) ?? [];
    if (b.length < 2) return "#7aa3d8";
    const times = b.map(x => x.timeMs);
    const fast = Math.min(...times);
    const slow = Math.max(...times);
    if (slow === fast) return "#7aa3d8";
    // Log-space normalization keeps the gradient readable when times span
    // decades (counting sort: 1ms, bubble sort: 8s at the same n).
    const t = (Math.log10(c.timeMs) - Math.log10(fast)) / (Math.log10(slow) - Math.log10(fast));
    return speedHsl(t);
  };

  // Width encodes n directly — see `makeNToWidth` for the log-scaling rule.
  // Lifted to a module-level helper because the export plumbing (GraphML /
  // CSV / JSON) also needs to emit per-edge weights and we want one source
  // of truth for the mapping.
  const nToWidth = makeNToWidth(cells);

  const elements: CyElement[] = [];
  const algoSeen = new Set<string>();
  const dtSeen = new Set<DataType>();

  for (const c of cells) {
    if (!algoSeen.has(c.algo)) {
      algoSeen.add(c.algo);
      elements.push({
        group: "nodes",
        data: {
          id: `algo:${c.algo}`,
          kind: "algo",
          label: (algoNames[c.algo] ?? c.algo).replace(" Sort", ""),
          color: algoColors[c.algo] ?? "#888",
        },
      });
    }
    if (!dtSeen.has(c.dt)) {
      dtSeen.add(c.dt);
      elements.push({
        group: "nodes",
        data: {
          id: `dt:${c.dt}`,
          kind: "dt",
          label: DT_LABEL[c.dt],
          borderStyle: cyLineStyle(c.dt),
        },
      });
    }
    elements.push({
      group: "edges",
      data: {
        // n is in the edge id so cytoscape treats each measurement as its own
        // edge (parallel edges between the same source/target are allowed
        // and rendered as fanned-out beziers by the stylesheet below).
        id: `e:${c.algo}:${c.dt}:${c.n}`,
        source: `algo:${c.algo}`,
        target: `dt:${c.dt}`,
        lineColor: colorFor(c),
        lineWidth: nToWidth(c.n),
        lineStyle: cyLineStyle(c.dt),
      },
    });
  }

  return { elements, cells };
}

// ── Summary insights ────────────────────────────────────────────────────────
// Produces a small set of bullet-point sentences interpreting the data the
// graph encodes. Each insight answers a question the visual makes you ASK
// but doesn't directly ANSWER ("who scales best?", "where's the memory
// going?"). Computed once per render of the graph from the same cells the
// edges use, so the text is always consistent with what's on screen.
interface Insights {
  totalMeasurements: number;
  algoCount: number;
  dtypeCount: number;
  nMin: number;
  nMax: number;
  fastestCell: Cell | null;
  perDtypeChampion: Map<DataType, { algo: string; wins: number; total: number } | null>;
  bestScaler: { algo: string; ratio: number; nLo: number; nHi: number } | null;
  worstScaler: { algo: string; ratio: number; nLo: number; nHi: number } | null;
  memoryLeader: Cell | null;
}

function summarize(cells: Cell[]): Insights {
  const algos = new Set(cells.map(c => c.algo));
  const dtypes = new Set(cells.map(c => c.dt));
  const ns = cells.map(c => c.n);
  const fastestCell = cells.length === 0 ? null
    : cells.reduce((best, c) => (c.timeMs < best.timeMs ? c : best), cells[0]);
  const memoryLeader = cells.length === 0 ? null
    : cells.reduce((best, c) => (c.spaceBytes > best.spaceBytes ? c : best), cells[0]);

  // Per-dtype champion: for each (dtype, n) bucket, score 1 win to whichever
  // algo had the lowest time. Tally per algo per dtype; the algo with the
  // most wins is that dtype's champion. Beats a "fastest mean" metric
  // because it credits algos that win at MULTIPLE sizes, not just the size
  // that happens to be its sweet spot.
  const perDtypeChampion = new Map<DataType, { algo: string; wins: number; total: number } | null>();
  for (const dt of dtypes) {
    const dtCells = cells.filter(c => c.dt === dt);
    const byN = new Map<number, Cell[]>();
    for (const c of dtCells) {
      if (!byN.has(c.n)) byN.set(c.n, []);
      byN.get(c.n)!.push(c);
    }
    const wins = new Map<string, number>();
    for (const ns of byN.values()) {
      const winner = ns.reduce((b, c) => c.timeMs < b.timeMs ? c : b, ns[0]);
      wins.set(winner.algo, (wins.get(winner.algo) ?? 0) + 1);
    }
    if (wins.size === 0) { perDtypeChampion.set(dt, null); continue; }
    let bestAlgo = "", bestWins = -1;
    for (const [a, w] of wins) if (w > bestWins) { bestAlgo = a; bestWins = w; }
    perDtypeChampion.set(dt, { algo: bestAlgo, wins: bestWins, total: byN.size });
  }

  // Scaling: per algo, ratio of time at its largest measured n vs smallest.
  // Smaller ratio = scales better (closer to O(1) or O(log n)); bigger
  // ratio = degrades fast as n grows (closer to O(n²)). Skip algos with
  // only one measured n — no scaling info to extract.
  const scalings: { algo: string; ratio: number; nLo: number; nHi: number }[] = [];
  for (const algo of algos) {
    const algoCells = cells.filter(c => c.algo === algo);
    // Use the same dtype across both endpoints if possible so we're not
    // measuring "switched-dtype" overhead. Pick the dtype with the widest
    // n span for this algo.
    const dtSpans = new Map<DataType, { lo: Cell; hi: Cell }>();
    for (const dt of dtypes) {
      const same = algoCells.filter(c => c.dt === dt);
      if (same.length < 2) continue;
      const lo = same.reduce((b, c) => c.n < b.n ? c : b, same[0]);
      const hi = same.reduce((b, c) => c.n > b.n ? c : b, same[0]);
      if (lo.n !== hi.n) dtSpans.set(dt, { lo, hi });
    }
    let best: { lo: Cell; hi: Cell } | null = null;
    let bestSpan = 0;
    for (const { lo, hi } of dtSpans.values()) {
      const span = hi.n / lo.n;
      if (span > bestSpan) { bestSpan = span; best = { lo, hi }; }
    }
    if (best == null) continue;
    if (best.lo.timeMs <= 0 || best.hi.timeMs <= 0) continue;
    scalings.push({
      algo,
      ratio: best.hi.timeMs / best.lo.timeMs,
      nLo: best.lo.n,
      nHi: best.hi.n,
    });
  }
  scalings.sort((a, b) => a.ratio - b.ratio);
  const bestScaler  = scalings[0] ?? null;
  const worstScaler = scalings[scalings.length - 1] ?? null;

  return {
    totalMeasurements: cells.length,
    algoCount: algos.size,
    dtypeCount: dtypes.size,
    nMin: ns.length > 0 ? Math.min(...ns) : 0,
    nMax: ns.length > 0 ? Math.max(...ns) : 0,
    fastestCell,
    perDtypeChampion,
    bestScaler,
    worstScaler,
    memoryLeader,
  };
}

export default function SortNetworkGraph({ log, algoNames, algoColors }: SortNetworkGraphProps) {
  const cyRef = useRef<CytoscapeBaseHandle>(null);

  const { elements, cells } = useMemo(
    () => buildElements(log, algoNames, algoColors),
    [log, algoNames, algoColors],
  );

  // Sync the elements into cytoscape and re-run the layout whenever they
  // change. cose (force-directed) clusters each algo near the dtype hubs
  // it has data for, with edge weights pulling thicker/heavier edges shorter —
  // matches the "stronger memory connection = closer" intuition.
  useEffect(() => {
    const cy = cyRef.current?.cy();
    if (!cy) return;
    // CytoscapeBase locks down interactivity for the algorithm visualizers it
    // was built for. Re-enable it here — zooming + panning + dragging nodes
    // makes a dense network browseable.
    cy.userZoomingEnabled(true);
    cy.userPanningEnabled(true);
    cy.boxSelectionEnabled(false);
    cy.autoungrabify(false);

    cy.batch(() => {
      cy.elements().remove();
      for (const el of elements) cy.add(el as Parameters<typeof cy.add>[0]);
    });
    if (elements.length > 0) {
      cy.layout({
        name: "cose",
        padding: 40,
        animate: false,
        // Edges now scale up to 20px — give them lateral room so the fanned
        // multi-edges between an algo and a dtype hub stay legible. Higher
        // repulsion + longer ideal length keeps nodes from clumping under
        // the weight of many thick edges all pulling toward the hubs.
        idealEdgeLength: () => 140,
        nodeRepulsion: () => 24000,
        edgeElasticity: () => 40,
        fit: true,
      } as Parameters<typeof cy.layout>[0]).run();
    }
  }, [elements]);

  if (cells.length === 0) return null;

  const insights = summarize(cells);

  // ── Export handlers ──────────────────────────────────────────────────────
  // Build the export payload once on click — cheap (linear in cell count) and
  // we don't want to recompute on every render. Filename embeds a sortable
  // local-time stamp so multiple exports from one session don't clobber
  // each other.
  const stamp = () => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  };
  const exportGraphML = () => {
    const data = buildExportData(cells, algoNames, algoColors, makeNToWidth(cells));
    downloadText(toGraphML(data), `sort-network-${stamp()}.graphml`, "application/xml");
  };
  const exportCSV = () => {
    const data = buildExportData(cells, algoNames, algoColors, makeNToWidth(cells));
    downloadText(toCSV(data), `sort-network-${stamp()}.csv`, "text/csv");
  };
  const exportJSON = () => {
    const data = buildExportData(cells, algoNames, algoColors, makeNToWidth(cells));
    downloadText(toJSON(data), `sort-network-${stamp()}.json`, "application/json");
  };

  // Aggregate per-(algo, dtype) for the card grid. With one edge per
  // measurement the cell count explodes; the cards still want to read at a
  // glance, so each card collapses its algo/dtype's sweep into a min-max
  // range.
  type AggKey = string;
  const agg = new Map<AggKey, { algo: string; dt: DataType; nLo: number; nHi: number; tLo: number; tHi: number; memMax: number }>();
  for (const c of cells) {
    const key = `${c.algo}|${c.dt}`;
    const prev = agg.get(key);
    if (!prev) {
      agg.set(key, { algo: c.algo, dt: c.dt, nLo: c.n, nHi: c.n, tLo: c.timeMs, tHi: c.timeMs, memMax: c.spaceBytes });
    } else {
      prev.nLo = Math.min(prev.nLo, c.n);
      prev.nHi = Math.max(prev.nHi, c.n);
      prev.tLo = Math.min(prev.tLo, c.timeMs);
      prev.tHi = Math.max(prev.tHi, c.timeMs);
      prev.memMax = Math.max(prev.memMax, c.spaceBytes);
    }
  }
  const aggCards = [...agg.values()].sort((a, b) => {
    const an = (algoNames[a.algo] ?? a.algo).localeCompare(algoNames[b.algo] ?? b.algo);
    if (an !== 0) return an;
    return a.dt.localeCompare(b.dt);
  });

  return (
    <div className="mt-4 rounded-xl overflow-hidden" style={{ border: "1px solid var(--color-border)", background: "var(--color-surface-1)" }}>
      <div className="flex items-center gap-2 px-3 py-2 flex-wrap" style={{ borderBottom: "1px solid var(--color-border)", background: "var(--color-surface-2)" }}>
        <Network size={13} style={{ color: "var(--color-accent)" }} />
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-text)" }}>
          Sort Network · session
        </span>
        <span className="text-[10px]" style={{ color: "var(--color-muted)", fontFamily: "monospace" }}>
          one edge per (algorithm, data-type, n) — fans out by n
        </span>
        {/* Export button group — three formats that cover the common
            destinations: GraphML for Gephi/yEd/NetworkX, CSV for pandas/
            spreadsheets, JSON for round-tripping back into cytoscape.js. */}
        <div className="ml-auto flex items-center gap-1 print:hidden" title="Export the current graph (nodes + edges + per-edge measurements)">
          <Download size={11} style={{ color: "var(--color-muted)" }} />
          {([
            { label: "GraphML", onClick: exportGraphML, title: "GraphML (.graphml) — open in Gephi, yEd, Cytoscape Desktop, or load with networkx.read_graphml" },
            { label: "CSV",     onClick: exportCSV,     title: "CSV edge-list (.csv) — load with pandas.read_csv or import to Gephi as an edges table" },
            { label: "JSON",    onClick: exportJSON,    title: "JSON in cytoscape-elements format (.json) — pass the `elements` array straight to cytoscape({ elements })" },
          ] as const).map(b => (
            <button
              key={b.label}
              onClick={b.onClick}
              title={b.title}
              style={{
                fontSize: 9, fontFamily: "monospace", letterSpacing: "0.04em",
                padding: "2px 7px", borderRadius: 3, cursor: "pointer",
                background: "var(--color-surface-1)", border: "1px solid var(--color-border)",
                color: "var(--color-muted)",
              }}
            >
              {b.label}
            </button>
          ))}
        </div>
      </div>

      {/* Encoding legend — width now encodes n directly, color is "who's
          fastest at this size on this dtype", line-style is the dtype
          convention. */}
      <div className="px-3 py-2 flex flex-wrap items-center gap-x-4 gap-y-1" style={{ fontSize: 9, fontFamily: "monospace", color: "var(--color-muted)", borderBottom: "1px solid var(--color-border)" }}>
        <span><strong style={{ color: "var(--color-text)" }}>color</strong> = speed rank at this (dtype, n) — green wins the bucket, red loses</span>
        <span><strong style={{ color: "var(--color-text)" }}>width</strong> = log(n) — thicker edges are larger inputs</span>
        <span><strong style={{ color: "var(--color-text)" }}>line</strong> = {DT_LEGEND_TEXT}</span>
      </div>

      <CytoscapeBase ref={cyRef} stylesheet={STYLESHEET} style={{ height: 380, background: "var(--color-surface-2)" }} />

      {/* Summary panel — interpretive bullets derived from the same cells the
          edges show. Answers the questions the visual makes you ask but
          doesn't directly answer. */}
      <div className="px-3 py-2" style={{ fontSize: 10, fontFamily: "monospace", borderTop: "1px solid var(--color-border)", background: "var(--color-surface-2)" }}>
        <div className="text-[9px] uppercase tracking-wider mb-1" style={{ color: "var(--color-muted)", fontWeight: 600 }}>
          What the chart says
        </div>
        <ul style={{ display: "flex", flexDirection: "column", gap: 3, listStyle: "none", padding: 0, margin: 0, color: "var(--color-text)" }}>
          <li>
            <span style={{ color: "var(--color-muted)" }}>scope · </span>
            <strong>{insights.totalMeasurements}</strong> measurements across <strong>{insights.algoCount}</strong> algorithm{insights.algoCount !== 1 ? "s" : ""} and <strong>{insights.dtypeCount}</strong> data type{insights.dtypeCount !== 1 ? "s" : ""}
            {insights.nMin > 0 && <> · n ranges <strong>{fmtN(insights.nMin)}</strong> – <strong>{fmtN(insights.nMax)}</strong></>}
          </li>
          {insights.fastestCell && (
            <li>
              <span style={{ color: "var(--color-muted)" }}>fastest single probe · </span>
              <strong style={{ color: algoColors[insights.fastestCell.algo] ?? "#fff" }}>
                {(algoNames[insights.fastestCell.algo] ?? insights.fastestCell.algo).replace(" Sort", "")}
              </strong>
              {" "}@ <strong>{fmtMs(insights.fastestCell.timeMs)}</strong>
              <span style={{ color: "var(--color-muted)" }}> ({DT_LABEL[insights.fastestCell.dt]}, n={fmtN(insights.fastestCell.n)})</span>
            </li>
          )}
          {[...insights.perDtypeChampion.entries()].some(([, v]) => v != null) && (
            <li>
              <span style={{ color: "var(--color-muted)" }}>per-dtype champion · </span>
              {[...insights.perDtypeChampion.entries()].filter(([, v]) => v != null).map(([dt, v], i) => (
                <span key={dt}>
                  {i > 0 && <span style={{ color: "var(--color-muted)" }}> · </span>}
                  <span style={{
                    fontSize: 8, padding: "0 4px", borderRadius: 2, marginRight: 3,
                    border: `1px ${cyLineStyle(dt)} var(--color-muted)`,
                    color: "var(--color-muted)",
                  }}>{DT_LABEL[dt][0]}</span>
                  <strong style={{ color: algoColors[v!.algo] ?? "#fff" }}>
                    {(algoNames[v!.algo] ?? v!.algo).replace(" Sort", "")}
                  </strong>
                  <span style={{ color: "var(--color-muted)" }}> ({v!.wins}/{v!.total})</span>
                </span>
              ))}
            </li>
          )}
          {insights.bestScaler && (
            <li>
              <span style={{ color: "var(--color-muted)" }}>scales best · </span>
              <strong style={{ color: algoColors[insights.bestScaler.algo] ?? "#fff" }}>
                {(algoNames[insights.bestScaler.algo] ?? insights.bestScaler.algo).replace(" Sort", "")}
              </strong>
              {" "}— <strong>{insights.bestScaler.ratio.toFixed(1)}×</strong> slowdown from n={fmtN(insights.bestScaler.nLo)} → n={fmtN(insights.bestScaler.nHi)}
              <span style={{ color: "var(--color-muted)" }}> ({(insights.bestScaler.nHi / insights.bestScaler.nLo).toFixed(0)}× more data)</span>
            </li>
          )}
          {insights.worstScaler && insights.worstScaler !== insights.bestScaler && (
            <li>
              <span style={{ color: "var(--color-muted)" }}>scales worst · </span>
              <strong style={{ color: algoColors[insights.worstScaler.algo] ?? "#fff" }}>
                {(algoNames[insights.worstScaler.algo] ?? insights.worstScaler.algo).replace(" Sort", "")}
              </strong>
              {" "}— <strong style={{ color: "#dc2626" }}>{insights.worstScaler.ratio.toFixed(0)}×</strong> slowdown from n={fmtN(insights.worstScaler.nLo)} → n={fmtN(insights.worstScaler.nHi)}
            </li>
          )}
          {insights.memoryLeader && insights.memoryLeader.spaceBytes > 0 && (
            <li>
              <span style={{ color: "var(--color-muted)" }}>memory leader · </span>
              <strong style={{ color: algoColors[insights.memoryLeader.algo] ?? "#fff" }}>
                {(algoNames[insights.memoryLeader.algo] ?? insights.memoryLeader.algo).replace(" Sort", "")}
              </strong>
              {" "}— <strong>{fmtBytes(insights.memoryLeader.spaceBytes)}</strong> at n={fmtN(insights.memoryLeader.n)} ({DT_LABEL[insights.memoryLeader.dt]})
            </li>
          )}
        </ul>
      </div>

      <div className="px-3 py-2 grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-1" style={{ fontSize: 9, fontFamily: "monospace", borderTop: "1px solid var(--color-border)" }}>
        {aggCards.map(c => {
          const oneN = c.nLo === c.nHi;
          const oneT = Math.abs(c.tHi - c.tLo) < 1e-6;
          return (
            <div key={`${c.algo}:${c.dt}`} style={{ display: "flex", alignItems: "center", gap: 6, overflow: "hidden" }}>
              <span style={{
                width: 8, height: 8, borderRadius: "50%",
                background: algoColors[c.algo] ?? "#888", flexShrink: 0,
              }} />
              <span style={{ color: "var(--color-text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {(algoNames[c.algo] ?? c.algo).replace(" Sort", "")}
              </span>
              <span style={{
                fontSize: 8, padding: "0 4px", borderRadius: 2,
                border: `1px ${cyLineStyle(c.dt)} var(--color-muted)`,
                color: "var(--color-muted)", flexShrink: 0,
              }}>
                {DT_LABEL[c.dt][0]}
              </span>
              <span style={{ color: "var(--color-muted)", marginLeft: "auto", whiteSpace: "nowrap" }}>
                {oneN ? `n=${fmtN(c.nLo)}` : `n=${fmtN(c.nLo)}…${fmtN(c.nHi)}`}
                {" · "}
                {oneT ? fmtMs(c.tLo) : `${fmtMs(c.tLo)}…${fmtMs(c.tHi)}`}
                {c.memMax > 0 && <> · {fmtBytes(c.memMax)}</>}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
