import fs from "fs";

const path = "components/BenchmarkVisualizer.tsx";
const lines = fs.readFileSync(path, "utf8").split(/\r?\n/);

/** Delete 1-based inclusive line ranges (applied bottom-up). */
function deleteRanges(ranges) {
  const sorted = [...ranges].sort((a, b) => b[0] - a[0]);
  for (const [start, end] of sorted) {
    lines.splice(start - 1, end - start + 1);
  }
}

deleteRanges([
  [1659, 1659], // Chart3DPoint type
  [1662, 1671], // parseHex, blendHex, hexAlpha
  [2032, 3073], // Chart3D + kbdStyle block + Chart3DHistory
  [4939, 6159], // CurveChart
]);

fs.writeFileSync(path, lines.join("\n"));
console.log("Removed inline chart blocks. Lines now:", lines.length);
