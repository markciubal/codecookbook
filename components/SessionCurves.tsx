"use client";

import { useMemo, useState } from "react";
import { LineChart } from "lucide-react";
import { CurveChart, type CurveData, type CurvePoint } from "./BenchmarkVisualizer";

/*
 * Session-wide aggregate curves: a literal clone of the per-run performance /
 * memory chart, fed with data accumulated across every benchmark in the
 * session. Same expand-to-fullscreen, brush, zoom, log-scale, Big-O fit, and
 * hover crosshair you get on the live chart — just sourced from the persistent
 * SessionLog instead of the current-run CurveData.
 *
 * Layout: two segmented tab bars sit above the chart — one picks the data type
 * (Integer / Float / String, only types with data appear), the other picks the
 * mode (Time / Memory). The CurveChart underneath then renders the chosen
 * (dataType, mode) slice with full interactivity.
 */
export type SessionPoint = { meanTimeMs: number; meanSpaceBytes: number; runs: number };
// dataType → algoId → n(as string) → point
export type SessionLog = Record<string, Record<string, Record<string, SessionPoint>>>;

const DT_META: { id: string; label: string }[] = [
  { id: "integer", label: "Integer" },
  { id: "float",   label: "Float" },
  { id: "string",  label: "String" },
];

interface Props {
  log: SessionLog;
  algoNames: Record<string, string>;
  algoColors: Record<string, string>;
  onClear: () => void;
}

export default function SessionCurves({ log, onClear }: Props) {
  const [mode, setMode] = useState<"time" | "space">("time");

  // Which data types actually have data? Drives the tab list (and default).
  const availableDts = useMemo(
    () => DT_META.filter(d => Object.keys(log[d.id] ?? {}).length > 0),
    [log],
  );
  const [dt, setDt] = useState<string | null>(null);
  // Auto-select first available type when data first appears.
  const effectiveDt = dt && availableDts.some(d => d.id === dt) ? dt : (availableDts[0]?.id ?? null);

  // Convert the session log for the selected data type into the same CurveData
  // shape the per-run chart consumes. timeMs / meanMs come from meanTimeMs;
  // allocBytes / spaceBytes both come from meanSpaceBytes (we don't know which
  // source the heap byte came from after aggregation, so we mirror it into
  // both — the chart's space mode reads either).
  const { data, sizes, algos } = useMemo(() => {
    if (!effectiveDt) return { data: {} as CurveData, sizes: [] as number[], algos: [] as string[] };
    const algoMap = log[effectiveDt] ?? {};
    const out: CurveData = {};
    const sizeSet = new Set<number>();
    const algoList: string[] = [];
    for (const id of Object.keys(algoMap)) {
      const byN = algoMap[id];
      const pts: CurvePoint[] = Object.entries(byN)
        .map(([k, v]) => ({
          n: Number(k),
          timeMs: v.meanTimeMs,
          meanMs: v.meanTimeMs,
          spaceBytes: v.meanSpaceBytes,
          allocBytes: v.meanSpaceBytes,
        }))
        .filter(p => p.n > 0)
        .sort((a, b) => a.n - b.n);
      if (pts.length === 0) continue;
      out[id] = pts;
      algoList.push(id);
      for (const p of pts) sizeSet.add(p.n);
    }
    return { data: out, sizes: [...sizeSet].sort((a, b) => a - b), algos: algoList };
  }, [log, effectiveDt]);

  if (availableDts.length === 0) return null;

  return (
    <div
      className="mt-4 rounded-xl overflow-hidden"
      style={{ border: "1px solid var(--color-border)", background: "var(--color-surface-1)" }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2" style={{ borderBottom: "1px solid var(--color-border)", background: "var(--color-surface-2)" }}>
        <LineChart size={13} style={{ color: "var(--color-accent)" }} />
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-text)" }}>Session curves</span>
        <span className="text-[10px]" style={{ color: "var(--color-muted)", fontFamily: "monospace" }}>
          aggregated across every run · cloned from the live performance / memory chart
        </span>
        <button
          onClick={onClear}
          className="ml-auto text-[10px]"
          title="Clear the session curves (does not affect saved runs or settings)"
          style={{ background: "transparent", border: "1px solid var(--color-border)", borderRadius: 4, padding: "2px 7px", color: "var(--color-muted)", cursor: "pointer", fontFamily: "monospace" }}
        >
          Reset
        </button>
      </div>

      {/* Tabs row: data type | mode */}
      <div className="flex flex-wrap items-center gap-3 px-3 py-2" style={{ borderBottom: "1px solid var(--color-border)" }}>
        <SegTabs
          options={availableDts.map(d => ({ id: d.id, label: d.label, count: Object.keys(log[d.id] ?? {}).length }))}
          value={effectiveDt}
          onChange={setDt}
        />
        <span className="text-[9px] uppercase tracking-wider" style={{ color: "var(--color-muted)" }}>· mode</span>
        <SegTabs
          options={[
            { id: "time",  label: "Speed (time)" },
            { id: "space", label: "Memory (aux)" },
          ]}
          value={mode}
          onChange={(v) => setMode(v as "time" | "space")}
        />
      </div>

      {/* The chart — the same component the per-run UI uses. */}
      <div className="px-3 py-3">
        {algos.length === 0 ? (
          <p className="text-xs" style={{ color: "var(--color-muted)", fontFamily: "monospace", fontStyle: "italic" }}>
            No data for {DT_META.find(d => d.id === effectiveDt)?.label ?? effectiveDt} yet — run a benchmark with this data type to populate.
          </p>
        ) : (
          <CurveChart
            data={data}
            sizes={sizes}
            algos={algos}
            mode={mode}
            advanced={true}
          />
        )}
      </div>
    </div>
  );
}

/* Small segmented tab bar — matches the look used elsewhere in the benchmark. */
function SegTabs({
  options, value, onChange,
}: {
  options: { id: string; label: string; count?: number }[];
  value: string | null;
  onChange: (id: string) => void;
}) {
  return (
    <div style={{ display: "inline-flex", borderRadius: 5, border: "1px solid var(--color-border)", overflow: "hidden" }}>
      {options.map((o, i) => {
        const active = value === o.id;
        return (
          <button
            key={o.id}
            onClick={() => onChange(o.id)}
            style={{
              padding: "3px 10px", fontSize: 10, fontFamily: "monospace",
              cursor: "pointer", border: "none",
              borderLeft: i > 0 ? "1px solid var(--color-border)" : "none",
              background: active ? "var(--color-accent)" : "transparent",
              color: active ? "#fff" : "var(--color-muted)",
              fontWeight: active ? 600 : 400,
              display: "inline-flex", alignItems: "center", gap: 5,
            }}
          >
            <span>{o.label}</span>
            {o.count != null && (
              <span style={{ fontSize: 8, opacity: 0.7 }}>· {o.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
