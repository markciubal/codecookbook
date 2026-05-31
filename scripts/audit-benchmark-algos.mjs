/**
 * Cross-check benchmark algorithm metadata vs SORT_FNS keys.
 * Run: node scripts/audit-benchmark-algos.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function extractObjectKeys(source, constName) {
  const re = new RegExp(`const ${constName}[^=]*=\\s*\\{([\\s\\S]*?)\\n\\};`, "m");
  const m = source.match(re);
  if (!m) return null;
  const keys = [...m[1].matchAll(/^\s*(?:"([^"]+)"|(\w+))\s*:/gm)].map((x) => x[1] ?? x[2]);
  return keys;
}

function extractSet(source, constName) {
  const re = new RegExp(`const ${constName}[^=]*=\\s*new Set\\(\\[([^\\]]*)\\]\\)`, "s");
  const m = source.match(re);
  if (!m) return [];
  return [...m[1].matchAll(/"([^"]+)"|(\w+)/g)].map((x) => x[1] ?? x[2]).filter(Boolean);
}

function extractGroupIds(source) {
  const ids = [];
  for (const m of source.matchAll(/\{\s*id:\s*"([^"]+)"/g)) ids.push(m[1]);
  return ids;
}

function extractDefaultSelected(source) {
  const m = source.match(/new Set\(\["logos", "adaptive", "timsort"\]\)/);
  return m ? ["logos", "adaptive", "timsort"] : [];
}

const benchmarkTs = fs.readFileSync(path.join(root, "lib/benchmark.ts"), "utf8");
const vizTs = fs.readFileSync(path.join(root, "components/BenchmarkVisualizer.tsx"), "utf8");
const sourceTs = fs.readFileSync(path.join(root, "lib/benchmark-source.ts"), "utf8");

const sortFnMatch = benchmarkTs.match(/export const SORT_FNS[^=]*=\s*\{([\s\S]*?)\n\};/);
const sortKeys = sortFnMatch
  ? [...sortFnMatch[1].matchAll(/^\s*(?:"([^"]+)"|(\w+))\s*:/gm)].map((x) => x[1] ?? x[2])
  : [];

const tables = [
  "ALGO_NAMES",
  "ALGO_COLORS",
  "ALGO_SPACE",
  "ALGO_TIME",
  "ALGO_STABLE",
  "ALGO_ONLINE",
  "ALGO_INFO",
];

const tableKeys = Object.fromEntries(
  tables.map((t) => [t, extractObjectKeys(vizTs, t) ?? []]),
);

const groupIds = extractGroupIds(vizTs);
const polySafe = extractSet(vizTs, "POLY_SAFE");
const unlimited = extractSet(vizTs, "UNLIMITED_IDS");
const slowIds = extractSet(vizTs, "SLOW_IDS");
const defaultSelected = extractDefaultSelected(vizTs);

const sourceKeys = extractObjectKeys(sourceTs, "BENCHMARK_SOURCE") ?? [];
const sourceLabelKeys = extractObjectKeys(sourceTs, "BENCHMARK_SOURCE_LABEL") ?? [];

const incompatMatch = benchmarkTs.match(/export const ALGO_INCOMPATIBLE[^=]*=\s*\{([\s\S]*?)\n\};/);
const incompatKeys = incompatMatch
  ? [...incompatMatch[1].matchAll(/^\s*(\w+)\s*:/gm)].map((x) => x[1])
  : [];

function diff(a, b) {
  const bs = new Set(b);
  return a.filter((x) => !bs.has(x));
}

console.log("=== SORT_FNS keys ===");
console.log(sortKeys.join(", "));
console.log(`(${sortKeys.length} total)\n`);

console.log("=== Default preloaded ===");
console.log(defaultSelected.join(", "));
console.log("Sizes: 10_000, 100_000, 1_000_000 | scenario: random\n");

for (const id of defaultSelected) {
  console.log(`--- ${id} ---`);
  for (const t of tables) {
    const has = tableKeys[t]?.includes(id);
    console.log(`  ${t}: ${has ? "OK" : "MISSING"}`);
  }
  console.log(`  SORT_FNS: ${sortKeys.includes(id) ? "OK" : "MISSING"}`);
  console.log(`  ALGO_GROUPS: ${groupIds.includes(id) ? "OK" : "MISSING"}`);
  console.log(`  BENCHMARK_SOURCE: ${sourceKeys.includes(id) ? "OK" : "MISSING"}`);
  console.log(`  UNLIMITED_IDS: ${unlimited.includes(id) ? "yes" : "no"}`);
  console.log(`  POLY_SAFE: ${polySafe.includes(id) ? "yes" : "no"}`);
  console.log(`  SLOW_IDS: ${slowIds.includes(id) ? "yes" : "no"}`);
  if (tableKeys.ALGO_INFO.includes(id)) {
    const infoRe = new RegExp(`\\s${id.replace("-", "\\-")}:\\s*\\{[^}]*inPlace:\\s*(true|false)`, "s");
    const infoM = vizTs.match(infoRe);
    if (infoM) console.log(`  ALGO_INFO.inPlace: ${infoM[1]}`);
  }
  console.log("");
}

console.log("=== Missing from metadata tables (vs SORT_FNS) ===");
for (const t of tables) {
  const missing = diff(sortKeys, tableKeys[t]);
  const extra = diff(tableKeys[t], sortKeys).filter((k) => k !== "custom");
  if (missing.length) console.log(`${t} missing: ${missing.join(", ")}`);
  if (extra.length) console.log(`${t} extra (not in SORT_FNS): ${extra.join(", ")}`);
}

console.log("\n=== ALGO_GROUPS vs SORT_FNS ===");
console.log("groups not in SORT_FNS:", diff(groupIds, sortKeys).join(", ") || "(none)");
console.log("SORT_FNS not in groups:", diff(sortKeys, groupIds).join(", ") || "(none)");

console.log("\n=== BENCHMARK_SOURCE gaps ===");
console.log("SORT_FNS missing source:", diff(sortKeys.filter((k) => k !== "bitonic"), sourceKeys).join(", ") || "(none)");
console.log("labels missing:", diff(sortKeys.filter((k) => k !== "bitonic"), sourceLabelKeys).join(", ") || "(none)");

console.log("\n=== Name consistency (group vs ALGO_NAMES) ===");
const nameRe = /\{\s*id:\s*"([^"]+)"[^}]*name:\s*"([^"]+)"/g;
for (const m of vizTs.matchAll(nameRe)) {
  const [, id, groupName] = m;
  const algoNames = tableKeys.ALGO_NAMES;
  const idx = algoNames.indexOf(id);
  // find in ALGO_NAMES object manually
}
for (const m of vizTs.matchAll(/\{\s*id:\s*"([^"]+)"[^}]*name:\s*"([^"]+)"/g)) {
  const id = m[1];
  const groupName = m[2];
  const namesBlock = vizTs.match(/const ALGO_NAMES[^=]*=\s*\{([\s\S]*?)\n\};/);
  if (!namesBlock) continue;
  const entry = namesBlock[1].match(new RegExp(`"${id.replace("-", "\\-")}"\\s*:\\s*"([^"]+)"|\\b${id.replace("-", "\\-")}\\s*:\\s*"([^"]+)"`));
  const algoName = entry ? (entry[1] ?? entry[2]) : null;
  if (algoName && algoName !== groupName) {
    console.log(`  ${id}: group="${groupName}" vs ALGO_NAMES="${algoName}"`);
  }
}
