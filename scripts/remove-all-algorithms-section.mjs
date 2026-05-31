import fs from "node:fs";

const p = "components/BenchmarkVisualizer.tsx";
let s = fs.readFileSync(p, "utf8");

s = s.replace(
  /\n      \{\/\* ── All Algorithms section ──[\s\S]*?\n      \)\}\n        <\/div>/,
  "\n        </div>",
);

s = s.replace(
  /\n  const \[miniCardSort, setMiniCardSort\] = useState<"time" \| "space" \| "both">\("time"\);/,
  "",
);

const lines = s.split(/\r?\n/);
let start = -1;
let end = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].startsWith("// ── Algorithm mini-card ──") && lines[i + 1]?.includes("Compact per-algorithm")) {
    start = i;
  }
  if (start >= 0 && end < 0 && i > start && lines[i].startsWith("// ── Playback strip ──")) {
    end = i;
    break;
  }
}
if (start < 0 || end < 0) {
  console.error("AlgoMiniCard block not found", start, end);
  process.exit(1);
}
lines.splice(start, end - start);
s = lines.join("\n");

if (!s.includes("Volume2")) {
  s = s.replace(/, Volume2/, "");
}

fs.writeFileSync(p, s);
console.log(`Removed All Algorithms section, miniCardSort, and AlgoMiniCard (${start + 1}-${end})`);
