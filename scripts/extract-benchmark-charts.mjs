import fs from "fs";

const path = "components/BenchmarkVisualizer.tsx";
const lines = fs.readFileSync(path, "utf8").split(/\r?\n/);

function slice(start, end) {
  return lines.slice(start - 1, end).join("\n");
}

function replaceAlgo(body) {
  return body
    .replace(/\bALGO_COLORS\b/g, "algoColors")
    .replace(/\bALGO_NAMES\b/g, "algoNames");
}

const chart3dLive = slice(2032, 2564);
const chart3dHist = slice(2594, 3073).replace(
  /^function Chart3DHistory\(/,
  "function Chart3DHistoryView(",
);

const chart3dHeader = `"use client";

import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import type { GhostRuns } from "@/lib/benchmark-store";
import { GHOST_MAX } from "@/lib/benchmark-store";
import { fmtN, fmtTime, fmtBytes } from "./formatters";
import { blendHex, hexAlpha, kbdStyle, project3D } from "./chart3d-utils";

type Chart3DPoint = { id: string; n: number; t: number; s: number; x: number; y: number; z: number; work?: number };

type Curve3DData = Record<string, { n: number; timeMs: number; spaceBytes?: number; timedOut?: boolean }[]>;

export type Chart3DProps =
  | {
      variant?: "live";
      data: Curve3DData;
      algos: string[];
      highlight: string | null;
      algoNames: Record<string, string>;
      algoColors: Record<string, string>;
    }
  | {
      variant: "history";
      current: Curve3DData;
      ghostRuns: GhostRuns;
      algos: string[];
      algoNames: Record<string, string>;
      algoColors: Record<string, string>;
    };

export default function Chart3D(props: Chart3DProps) {
  if (props.variant === "history") {
    return <Chart3DHistoryView {...props} />;
  }
  return <Chart3DLive {...props} />;
}

`;

const liveRenamed = replaceAlgo(
  chart3dLive
    .replace(/^function Chart3D\(/, "function Chart3DLive(")
    .replace(
      /highlight: string \| null;\n\}\) \{/,
      "highlight: string | null;\n  algoNames: Record<string, string>;\n  algoColors: Record<string, string>;\n}) {",
    ),
);
const histRenamed = replaceAlgo(
  chart3dHist.replace(
    /algos: string\[\];\n\}\) \{/,
    "algos: string[];\n  algoNames: Record<string, string>;\n  algoColors: Record<string, string>;\n}) {",
  ).replace(
    /ghostRuns: Record<string, \{ ts: number; points: \{ n: number; timeMs: number; meanMs\?: number; spaceBytes\?: number \}\[\] \}\[\];/,
    "ghostRuns: GhostRuns;",
  ),
);

fs.writeFileSync(
  "components/benchmark/Chart3D.tsx",
  chart3dHeader + liveRenamed + "\n\n" + histRenamed + "\n",
);

const curveBody = slice(4939, 6159);
const curveHeader = `"use client";

import React, { useState, useRef, useEffect } from "react";
import type { CurveData, CurvePoint, GhostRuns } from "@/lib/benchmark-store";
import { noiseLabel } from "@/lib/benchmark-stats";
import { fmtN, fmtTime, fmtBytes, fmtPredicted } from "./formatters";
import { fitLogLog, BIG_O_REFS, SPACE_BIG_O_REFS, type FitResult } from "./fit-log-log";

`;

let curveRenamed = replaceAlgo(
  curveBody.replace(/^export function CurveChart\(/, "export default function CurveChart("),
);
curveRenamed = curveRenamed.replace(
  /algos: string\[\];\n  highlight\?:/,
  "algos: string[];\n  algoNames: Record<string, string>;\n  algoColors: Record<string, string>;\n  highlight?:",
);
curveRenamed = curveRenamed.replace(
  /ghostRuns\?: Record<string, \{ ts: number; points: \{ n: number; timeMs: number; meanMs\?: number; spaceBytes\?: number \}\[\] \}\[\];/,
  "ghostRuns?: GhostRuns;",
);

fs.writeFileSync("components/benchmark/CurveChart.tsx", curveHeader + curveRenamed + "\n");

console.log("Done");
