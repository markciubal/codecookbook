/**
 * Visual tokens for the four algorithm properties (time, space, stable, online).
 * Import here to stay consistent across nav, cards, and info badges.
 */

import { Gauge, Database, ShieldCheck, ShieldX, Wifi, WifiOff } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type BadgeToken = {
  icon: LucideIcon;
  color: string;
  bg: string;
};

// ── Time complexity ── warm amber  (Gauge = speedometer / performance)
export const TIME_TOKEN: BadgeToken = {
  icon: Gauge,
  color: "#d97706",
  bg: "rgba(217,119,6,0.12)",
};

// ── Space complexity ── cool indigo  (Database = data / memory)
export const SPACE_TOKEN: BadgeToken = {
  icon: Database,
  color: "#818cf8",
  bg: "rgba(129,140,248,0.12)",
};

// ── Stability ── green / red  (ShieldCheck / ShieldX — same base shape)
export const STABLE_TOKEN: BadgeToken = {
  icon: ShieldCheck,
  color: "#4e7c52",
  bg: "rgba(78,124,82,0.12)",
};
export const UNSTABLE_TOKEN: BadgeToken = {
  icon: ShieldX,
  color: "#b03020",
  bg: "rgba(176,48,32,0.12)",
};

// ── Online / offline ── teal / muted gray  (Wifi / WifiOff — same base shape)
export const ONLINE_TOKEN: BadgeToken = {
  icon: Wifi,
  color: "#2a8080",
  bg: "rgba(42,128,128,0.15)",
};
export const OFFLINE_TOKEN: BadgeToken = {
  icon: WifiOff,
  color: "#7a7a7a",
  bg: "rgba(120,120,120,0.08)",
};

export function stableToken(v: boolean) { return v ? STABLE_TOKEN : UNSTABLE_TOKEN; }
export function onlineToken(v: boolean) { return v ? ONLINE_TOKEN  : OFFLINE_TOKEN;  }
