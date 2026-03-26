export const LEVELS = ["basic", "intermediate", "advanced", "research"] as const;
export type Level = typeof LEVELS[number];

export const LEVEL_KEY = "cc-level";
export const DEFAULT_LEVEL: Level = "intermediate";

export const LEVEL_LABELS: Record<Level, string> = {
  basic:        "Basic",
  intermediate: "Intermediate",
  advanced:     "Advanced",
  research:     "Research",
};

export const LEVEL_DESCRIPTIONS: Record<Level, string> = {
  basic:        "Core visualizations, clean UI",
  intermediate: "Settings, code view, mnemonics",
  advanced:     "Benchmark modes, parameter tuning",
  research:     "3D charts, math proofs, full history",
};

export function meetsLevel(userLevel: Level, required: Level): boolean {
  return LEVELS.indexOf(userLevel) >= LEVELS.indexOf(required);
}
