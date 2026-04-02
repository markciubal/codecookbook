export type Point = { x: number; y: number };
export type GeoState = "default" | "candidate" | "hull" | "rejected" | "current";

export type GeoStep = {
  points: Point[];
  states: GeoState[];
  hull: number[];
  currentLine?: [number, number];
  description: string;
};

export type GeoAlgorithm = "graham-scan" | "jarvis-march";

function cross(O: Point, A: Point, B: Point): number {
  return (A.x - O.x) * (B.y - O.y) - (A.y - O.y) * (B.x - O.x);
}

function polarAngle(pivot: Point, p: Point): number {
  return Math.atan2(p.y - pivot.y, p.x - pivot.x);
}

function dist2(a: Point, b: Point): number {
  return (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
}

// ── Graham Scan ───────────────────────────────────────────────────────────────

export function getGrahamScanSteps(points: Point[]): GeoStep[] {
  const n = points.length;
  const steps: GeoStep[] = [];
  if (n < 3) return steps;

  const indices = Array.from({ length: n }, (_, i) => i);
  const states: GeoState[] = new Array(n).fill("default");

  // Phase 1: find lowest (then leftmost) point
  let pivotIdx = 0;
  for (let i = 1; i < n; i++) {
    if (
      points[i].y < points[pivotIdx].y ||
      (points[i].y === points[pivotIdx].y && points[i].x < points[pivotIdx].x)
    ) {
      pivotIdx = i;
    }
  }

  const newStates1 = [...states];
  newStates1[pivotIdx] = "current";
  steps.push({
    points,
    states: newStates1,
    hull: [],
    description: `Phase 1: Found lowest point P${pivotIdx} at (${Math.round(points[pivotIdx].x)}, ${Math.round(points[pivotIdx].y)}) — this is the pivot`,
  });

  // Phase 2: sort by polar angle relative to pivot
  const pivot = points[pivotIdx];
  const sorted = indices
    .filter((i) => i !== pivotIdx)
    .sort((a, b) => {
      const angA = polarAngle(pivot, points[a]);
      const angB = polarAngle(pivot, points[b]);
      if (angA !== angB) return angA - angB;
      return dist2(pivot, points[a]) - dist2(pivot, points[b]);
    });

  const sortedAll = [pivotIdx, ...sorted];
  const newStates2 = [...states];
  newStates2[pivotIdx] = "hull";
  sortedAll.slice(1).forEach((i, idx) => {
    newStates2[i] = idx < 3 ? "candidate" : "default";
  });

  steps.push({
    points,
    states: newStates2,
    hull: [],
    description: `Phase 2: Sorted ${n - 1} points by polar angle from pivot P${pivotIdx}`,
  });

  // Phase 3: stack-based hull construction
  const stack: number[] = [pivotIdx, sorted[0]];

  const initStates = new Array(n).fill("default") as GeoState[];
  initStates[pivotIdx] = "hull";
  initStates[sorted[0]] = "hull";
  steps.push({
    points,
    states: initStates,
    hull: [...stack],
    description: `Phase 3: Initialize stack with P${pivotIdx} and P${sorted[0]}`,
  });

  for (let i = 1; i < sorted.length; i++) {
    const c = sorted[i];

    while (
      stack.length >= 2 &&
      cross(points[stack[stack.length - 2]], points[stack[stack.length - 1]], points[c]) <= 0
    ) {
      const popped = stack[stack.length - 1];
      const cp = cross(
        points[stack[stack.length - 2]],
        points[stack[stack.length - 1]],
        points[c]
      );
      stack.pop();

      const popStates = new Array(n).fill("default") as GeoState[];
      stack.forEach((idx) => (popStates[idx] = "hull"));
      popStates[c] = "current";
      popStates[popped] = "rejected";

      steps.push({
        points,
        states: popStates,
        hull: [...stack],
        currentLine: [stack[stack.length - 1], c],
        description: `Cross product of (P${stack[stack.length - 1]}-P${popped})×(P${c}-P${popped}) = ${cp.toFixed(1)} ≤ 0: right turn or collinear, pop P${popped}`,
      });
    }

    stack.push(c);
    const pushStates = new Array(n).fill("default") as GeoState[];
    stack.forEach((idx) => (pushStates[idx] = "hull"));
    pushStates[c] = "current";

    steps.push({
      points,
      states: pushStates,
      hull: [...stack],
      currentLine: stack.length >= 2 ? [stack[stack.length - 2], c] : undefined,
      description: `Push P${c} onto stack (left turn confirmed). Stack size: ${stack.length}`,
    });
  }

  // Final step
  const finalStates = new Array(n).fill("rejected") as GeoState[];
  stack.forEach((idx) => (finalStates[idx] = "hull"));
  steps.push({
    points,
    states: finalStates,
    hull: [...stack],
    description: `Convex hull complete! ${stack.length} points: [${stack.join(", ")}]`,
  });

  return steps;
}

// ── Jarvis March ──────────────────────────────────────────────────────────────

export function getJarvisMarchSteps(points: Point[]): GeoStep[] {
  const n = points.length;
  const steps: GeoStep[] = [];
  if (n < 3) return steps;

  // Find leftmost point
  let startIdx = 0;
  for (let i = 1; i < n; i++) {
    if (points[i].x < points[startIdx].x) startIdx = i;
  }

  const initStates = new Array(n).fill("default") as GeoState[];
  initStates[startIdx] = "current";
  steps.push({
    points,
    states: initStates,
    hull: [],
    description: `Start: found leftmost point P${startIdx} at (${Math.round(points[startIdx].x)}, ${Math.round(points[startIdx].y)})`,
  });

  const hull: number[] = [];
  let current = startIdx;

  do {
    hull.push(current);
    let next = (current + 1) % n;

    for (let i = 0; i < n; i++) {
      if (i === current) continue;

      const checkStates = new Array(n).fill("default") as GeoState[];
      hull.forEach((idx) => (checkStates[idx] = "hull"));
      checkStates[current] = "hull";
      checkStates[next] = "candidate";
      checkStates[i] = "current";

      const cp = cross(points[current], points[next], points[i]);

      steps.push({
        points,
        states: checkStates,
        hull: [...hull],
        currentLine: [current, i],
        description: `From P${current}: checking P${i} vs current best P${next}. Cross product = ${cp.toFixed(1)}${cp < 0 ? " → P" + i + " is more CCW, update best" : ""}`,
      });

      if (cp < 0) {
        next = i;
      }
    }

    // Show chosen next point
    const chosenStates = new Array(n).fill("default") as GeoState[];
    hull.forEach((idx) => (chosenStates[idx] = "hull"));
    chosenStates[current] = "hull";
    chosenStates[next] = "candidate";

    steps.push({
      points,
      states: chosenStates,
      hull: [...hull],
      currentLine: [current, next],
      description: `Chose P${next} as most counterclockwise from P${current}. Adding to hull.`,
    });

    current = next;
  } while (current !== startIdx && hull.length <= n);

  const finalStates = new Array(n).fill("rejected") as GeoState[];
  hull.forEach((idx) => (finalStates[idx] = "hull"));
  steps.push({
    points,
    states: finalStates,
    hull: [...hull],
    description: `Convex hull complete! ${hull.length} points: [${hull.join(", ")}]`,
  });

  return steps;
}

export function generateRandomPoints(count: number = 15): Point[] {
  return Array.from({ length: count }, () => ({
    x: 20 + Math.random() * 360,
    y: 20 + Math.random() * 260,
  }));
}

export function getGeoSteps(algorithm: GeoAlgorithm, points: Point[]): GeoStep[] {
  if (algorithm === "graham-scan") return getGrahamScanSteps(points);
  return getJarvisMarchSteps(points);
}
