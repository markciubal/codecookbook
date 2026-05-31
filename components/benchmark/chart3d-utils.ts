import type React from "react";

export function parseHex(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace("#", "");
  return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
}

export function blendHex(hexA: string, hexB: string, t: number, alpha: number): string {
  const a = parseHex(hexA), b = parseHex(hexB);
  const r = Math.round(a.r + (b.r - a.r) * t);
  const g = Math.round(a.g + (b.g - a.g) * t);
  const bl = Math.round(a.b + (b.b - a.b) * t);
  return `rgba(${r},${g},${bl},${alpha})`;
}

export function hexAlpha(hex: string, alpha: number): string {
  const { r, g, b } = parseHex(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

export const kbdStyle: React.CSSProperties = {
  display: "inline-block", padding: "0 4px", fontFamily: "monospace", fontSize: 8,
  border: "1px solid var(--color-border)", borderRadius: 3,
  background: "var(--color-surface-1)", color: "var(--color-text)",
  margin: "0 1px", lineHeight: "12px",
};

/** Shared 3D → 2D orthographic projection. */
export function project3D(
  x: number, y: number, z: number,
  W: number, H: number,
  rotX: number, rotY: number, zoom: number,
): [number, number] {
  const ryR = rotY * Math.PI / 180, rxR = rotX * Math.PI / 180;
  const px = x - 0.5, py = y - 0.5, pz = z - 0.5;
  const rx1 = px * Math.cos(ryR) + pz * Math.sin(ryR);
  const rz1 = -px * Math.sin(ryR) + pz * Math.cos(ryR);
  const ry2 = py * Math.cos(rxR) - rz1 * Math.sin(rxR);
  const sc = Math.min(W, H) * 0.44 * zoom;
  return [W / 2 + rx1 * sc, H / 2 - ry2 * sc];
}
