// ── Types ─────────────────────────────────────────────────────────────────────

export type CharState =
  | "default"
  | "comparing"
  | "match"
  | "mismatch"
  | "skip"
  | "found";

export type StringStep = {
  textStates: CharState[];
  patternStates: CharState[];
  patternOffset: number;
  description: string;
  // KMP specific
  failureTable?: number[];
  failureHighlight?: number;
  // Rabin-Karp specific
  textHash?: number;
  patternHash?: number;
  windowStart?: number;
  windowEnd?: number;
  // Boyer-Moore specific
  badCharTable?: Record<string, number>;
  shift?: number;
};

export type StringAlgorithm = "kmp" | "rabin-karp" | "boyer-moore";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeTextStates(n: number, state: CharState = "default"): CharState[] {
  return Array(n).fill(state);
}

function makePatternStates(
  m: number,
  state: CharState = "default"
): CharState[] {
  return Array(m).fill(state);
}

// ── KMP ───────────────────────────────────────────────────────────────────────

export function getKMPSteps(text: string, pattern: string): StringStep[] {
  const steps: StringStep[] = [];
  const n = text.length;
  const m = pattern.length;

  if (m === 0 || n === 0) return steps;

  // ── Phase 1: Build failure (partial-match) table ──────────────────────────

  const failure: number[] = Array(m).fill(0);

  // Initial state
  steps.push({
    textStates: makeTextStates(n),
    patternStates: makePatternStates(m),
    patternOffset: 0,
    description: "Phase 1: Building the KMP failure function table.",
    failureTable: [...failure],
    failureHighlight: undefined,
  });

  let len = 0;
  let j2 = 1;

  while (j2 < m) {
    if (pattern[j2] === pattern[len]) {
      len++;
      failure[j2] = len;
      steps.push({
        textStates: makeTextStates(n),
        patternStates: makePatternStates(m),
        patternOffset: 0,
        description: `failure[${j2}] = ${len}: pattern[${j2}]='${pattern[j2]}' matches pattern[${len - 1}]='${pattern[len - 1]}', so prefix length extends to ${len}.`,
        failureTable: [...failure],
        failureHighlight: j2,
      });
      j2++;
    } else if (len !== 0) {
      len = failure[len - 1];
      steps.push({
        textStates: makeTextStates(n),
        patternStates: makePatternStates(m),
        patternOffset: 0,
        description: `Mismatch at j=${j2}, len=${len + 1}. Fall back: len = failure[${len}] = ${failure[len]}.`,
        failureTable: [...failure],
        failureHighlight: j2,
      });
    } else {
      failure[j2] = 0;
      steps.push({
        textStates: makeTextStates(n),
        patternStates: makePatternStates(m),
        patternOffset: 0,
        description: `failure[${j2}] = 0: No proper prefix of pattern[0..${j2}] is also a suffix.`,
        failureTable: [...failure],
        failureHighlight: j2,
      });
      j2++;
    }
  }

  // ── Phase 2: Slide pattern over text ─────────────────────────────────────

  let i = 0; // text index
  let j = 0; // pattern index

  steps.push({
    textStates: makeTextStates(n),
    patternStates: makePatternStates(m),
    patternOffset: 0,
    description:
      "Phase 2: Sliding the pattern over the text using the failure table.",
    failureTable: [...failure],
    failureHighlight: undefined,
  });

  while (i < n) {
    const offset = i - j;

    // Build state arrays for this comparison
    const tStates: CharState[] = makeTextStates(n, "skip");
    const pStates: CharState[] = makePatternStates(m, "default");

    // Mark the current window in text as default
    for (let k = offset; k < offset + m && k < n; k++) {
      tStates[k] = "default";
    }

    // Mark already-matched chars
    for (let k = 0; k < j; k++) {
      tStates[offset + k] = "match";
      pStates[k] = "match";
    }

    // Mark current comparison char
    if (i < n) {
      tStates[i] = "comparing";
    }
    if (j < m) {
      pStates[j] = "comparing";
    }

    if (text[i] === pattern[j]) {
      const matchTStates = [...tStates];
      const matchPStates = [...pStates];
      matchTStates[i] = "match";
      matchPStates[j] = "match";

      steps.push({
        textStates: matchTStates,
        patternStates: matchPStates,
        patternOffset: offset,
        description: `Comparing text[${i}]='${text[i]}' with pattern[${j}]='${pattern[j]}': match!`,
        failureTable: [...failure],
        failureHighlight: j,
      });

      j++;
      i++;

      if (j === m) {
        // Found a complete match
        const foundOffset = i - j;
        const foundTStates: CharState[] = makeTextStates(n, "skip");
        const foundPStates: CharState[] = makePatternStates(m, "found");
        for (let k = foundOffset; k < foundOffset + m; k++) {
          foundTStates[k] = "found";
        }

        steps.push({
          textStates: foundTStates,
          patternStates: foundPStates,
          patternOffset: foundOffset,
          description: `Found match at index ${foundOffset}! Pattern fully matches text[${foundOffset}..${foundOffset + m - 1}].`,
          failureTable: [...failure],
          failureHighlight: undefined,
        });

        j = failure[j - 1];
      }
    } else {
      const mismatchTStates = [...tStates];
      const mismatchPStates = [...pStates];
      mismatchTStates[i] = "mismatch";
      mismatchPStates[j] = "mismatch";

      const shiftTo = j > 0 ? failure[j - 1] : 0;
      steps.push({
        textStates: mismatchTStates,
        patternStates: mismatchPStates,
        patternOffset: offset,
        description:
          j > 0
            ? `Mismatch: text[${i}]='${text[i]}' ≠ pattern[${j}]='${pattern[j]}'. Use failure[${j - 1}]=${failure[j - 1]} to shift pattern. Resuming from pattern[${shiftTo}].`
            : `Mismatch: text[${i}]='${text[i]}' ≠ pattern[${j}]='${pattern[j]}'. No prefix to reuse — advance text pointer.`,
        failureTable: [...failure],
        failureHighlight: j > 0 ? j - 1 : undefined,
      });

      if (j !== 0) {
        j = failure[j - 1];
      } else {
        i++;
      }
    }
  }

  // Final state
  steps.push({
    textStates: makeTextStates(n),
    patternStates: makePatternStates(m),
    patternOffset: 0,
    description: "KMP search complete.",
    failureTable: [...failure],
    failureHighlight: undefined,
  });

  return steps;
}

// ── Rabin-Karp ────────────────────────────────────────────────────────────────

const RK_BASE = 31;
const RK_MOD = 1_000_000_007;

function charCode(c: string): number {
  return c.charCodeAt(0) - "A".charCodeAt(0) + 1;
}

function computeHash(str: string, len: number): number {
  let h = 0;
  let power = 1;
  for (let i = 0; i < len; i++) {
    h = (h + charCode(str[i]) * power) % RK_MOD;
    if (i < len - 1) power = (power * RK_BASE) % RK_MOD;
  }
  return h;
}

export function getRabinKarpSteps(text: string, pattern: string): StringStep[] {
  const steps: StringStep[] = [];
  const n = text.length;
  const m = pattern.length;

  if (m === 0 || n === 0 || m > n) return steps;

  // Compute pattern hash
  const patternHash = computeHash(pattern, m);

  // Compute initial window hash
  let windowHash = computeHash(text, m);

  // Initial step: show pattern hash computation
  steps.push({
    textStates: makeTextStates(n),
    patternStates: makePatternStates(m),
    patternOffset: 0,
    description: `Computing initial hashes. Pattern hash = ${patternHash}. First window hash = ${windowHash}.`,
    textHash: windowHash,
    patternHash,
    windowStart: 0,
    windowEnd: m - 1,
  });

  for (let i = 0; i <= n - m; i++) {
    const tStates: CharState[] = makeTextStates(n, "skip");
    const pStates: CharState[] = makePatternStates(m, "default");

    // Mark window
    for (let k = i; k < i + m; k++) {
      tStates[k] = "comparing";
    }

    const hashMatch = windowHash === patternHash;

    steps.push({
      textStates: [...tStates],
      patternStates: [...pStates],
      patternOffset: i,
      description: `Window [${i}..${i + m - 1}]: window hash = ${windowHash}, pattern hash = ${patternHash}. ${hashMatch ? "Hashes match! Verifying characters..." : "Hashes differ — skip window."}`,
      textHash: windowHash,
      patternHash,
      windowStart: i,
      windowEnd: i + m - 1,
    });

    if (hashMatch) {
      // Verify character by character
      let allMatch = true;
      const verifyTStates: CharState[] = makeTextStates(n, "skip");
      const verifyPStates: CharState[] = makePatternStates(m, "default");

      for (let k = i; k < i + m; k++) {
        verifyTStates[k] = "default";
      }

      for (let k = 0; k < m; k++) {
        const vTStates = [...verifyTStates];
        const vPStates = [...verifyPStates];

        if (text[i + k] === pattern[k]) {
          vTStates[i + k] = "match";
          vPStates[k] = "match";
          steps.push({
            textStates: vTStates,
            patternStates: vPStates,
            patternOffset: i,
            description: `Verifying: text[${i + k}]='${text[i + k]}' = pattern[${k}]='${pattern[k]}' — match.`,
            textHash: windowHash,
            patternHash,
            windowStart: i,
            windowEnd: i + m - 1,
          });
          verifyTStates[i + k] = "match";
          verifyPStates[k] = "match";
        } else {
          vTStates[i + k] = "mismatch";
          vPStates[k] = "mismatch";
          allMatch = false;
          steps.push({
            textStates: vTStates,
            patternStates: vPStates,
            patternOffset: i,
            description: `Spurious hit! text[${i + k}]='${text[i + k]}' ≠ pattern[${k}]='${pattern[k]}' despite matching hash. Continuing...`,
            textHash: windowHash,
            patternHash,
            windowStart: i,
            windowEnd: i + m - 1,
          });
          break;
        }
      }

      if (allMatch) {
        const foundTStates: CharState[] = makeTextStates(n, "skip");
        const foundPStates: CharState[] = makePatternStates(m, "found");
        for (let k = i; k < i + m; k++) {
          foundTStates[k] = "found";
        }
        steps.push({
          textStates: foundTStates,
          patternStates: foundPStates,
          patternOffset: i,
          description: `Found match at index ${i}! All characters verified.`,
          textHash: windowHash,
          patternHash,
          windowStart: i,
          windowEnd: i + m - 1,
        });
      }
    }

    // Roll hash to next window (recomputed directly for accuracy)
    if (i < n - m) {
      windowHash = computeHash(text.slice(i + 1, i + 1 + m), m);

      steps.push({
        textStates: makeTextStates(n, "skip"),
        patternStates: makePatternStates(m),
        patternOffset: i + 1,
        description: `Rolling hash: remove '${text[i]}', add '${text[i + m]}'. New window hash = ${windowHash}.`,
        textHash: windowHash,
        patternHash,
        windowStart: i + 1,
        windowEnd: i + m,
      });
    }
  }

  // Mark skipped chars
  steps.push({
    textStates: makeTextStates(n),
    patternStates: makePatternStates(m),
    patternOffset: 0,
    description: "Rabin-Karp search complete.",
    textHash: windowHash,
    patternHash,
  });

  return steps;
}

// ── Boyer-Moore (bad character heuristic) ─────────────────────────────────────

export function getBoyerMooreSteps(
  text: string,
  pattern: string
): StringStep[] {
  const steps: StringStep[] = [];
  const n = text.length;
  const m = pattern.length;

  if (m === 0 || n === 0) return steps;

  // ── Phase 1: Build bad character table ────────────────────────────────────

  const badChar: Record<string, number> = {};

  steps.push({
    textStates: makeTextStates(n),
    patternStates: makePatternStates(m),
    patternOffset: 0,
    description:
      "Phase 1: Building the bad character table (last occurrence of each character in pattern).",
    badCharTable: { ...badChar },
  });

  for (let k = 0; k < m; k++) {
    badChar[pattern[k]] = k;
    steps.push({
      textStates: makeTextStates(n),
      patternStates: makePatternStates(m),
      patternOffset: 0,
      description: `badChar['${pattern[k]}'] = ${k}: rightmost occurrence of '${pattern[k]}' in pattern is at index ${k}.`,
      badCharTable: { ...badChar },
    });
  }

  // ── Phase 2: Search ───────────────────────────────────────────────────────

  steps.push({
    textStates: makeTextStates(n),
    patternStates: makePatternStates(m),
    patternOffset: 0,
    description:
      "Phase 2: Sliding pattern right-to-left over text using bad character shifts.",
    badCharTable: { ...badChar },
  });

  let s = 0; // shift of pattern relative to text

  while (s <= n - m) {
    let j = m - 1;

    // Build state for current alignment
    const buildStates = (): [CharState[], CharState[]] => {
      const tS: CharState[] = makeTextStates(n, "skip");
      const pS: CharState[] = makePatternStates(m, "default");
      for (let k = s; k < s + m && k < n; k++) tS[k] = "default";
      return [tS, pS];
    };

    // Show current alignment
    const [alignT, alignP] = buildStates();
    steps.push({
      textStates: alignT,
      patternStates: alignP,
      patternOffset: s,
      description: `Aligning pattern at position s=${s}. Comparing right-to-left.`,
      badCharTable: { ...badChar },
    });

    // Compare right to left
    while (j >= 0 && pattern[j] === text[s + j]) {
      const [cT, cP] = buildStates();
      // Mark all chars to the right of j as matched
      for (let k = j + 1; k < m; k++) {
        cT[s + k] = "match";
        cP[k] = "match";
      }
      cT[s + j] = "comparing";
      cP[j] = "comparing";

      const matchT = [...cT];
      const matchP = [...cP];
      matchT[s + j] = "match";
      matchP[j] = "match";

      steps.push({
        textStates: matchT,
        patternStates: matchP,
        patternOffset: s,
        description: `text[${s + j}]='${text[s + j]}' = pattern[${j}]='${pattern[j]}' — match. Moving left.`,
        badCharTable: { ...badChar },
      });

      j--;
    }

    if (j < 0) {
      // Full match found
      const foundT: CharState[] = makeTextStates(n, "skip");
      const foundP: CharState[] = makePatternStates(m, "found");
      for (let k = s; k < s + m; k++) foundT[k] = "found";

      const matchBc = s + m < n ? (badChar[text[s + m]] ?? -1) : -1;
      const matchShift = Math.max(1, m - matchBc - 1);

      steps.push({
        textStates: foundT,
        patternStates: foundP,
        patternOffset: s,
        description: `Found match at index ${s}! Pattern fully matches text[${s}..${s + m - 1}]. Shifting by ${matchShift} to continue.`,
        badCharTable: { ...badChar },
        shift: matchShift,
      });

      s += matchShift;
    } else {
      // Mismatch
      const [misT, misP] = buildStates();
      // Mark matched chars (to the right of j)
      for (let k = j + 1; k < m; k++) {
        misT[s + k] = "match";
        misP[k] = "match";
      }
      misT[s + j] = "mismatch";
      misP[j] = "mismatch";

      const badCharShift = badChar[text[s + j]] ?? -1;
      const shift = Math.max(1, j - badCharShift);

      steps.push({
        textStates: misT,
        patternStates: misP,
        patternOffset: s,
        description: `Mismatch: text[${s + j}]='${text[s + j]}' ≠ pattern[${j}]='${pattern[j]}'. badChar['${text[s + j]}']=${badCharShift === -1 ? "−1 (not in pattern)" : badCharShift}. Shift = max(1, ${j} − ${badCharShift}) = ${shift}.`,
        badCharTable: { ...badChar },
        shift,
      });

      s += shift;
    }
  }

  steps.push({
    textStates: makeTextStates(n),
    patternStates: makePatternStates(m),
    patternOffset: 0,
    description: "Boyer-Moore search complete.",
    badCharTable: { ...badChar },
  });

  return steps;
}

// ── Dispatch ──────────────────────────────────────────────────────────────────

export function getStringSteps(
  algorithm: StringAlgorithm,
  text: string,
  pattern: string
): StringStep[] {
  switch (algorithm) {
    case "kmp":
      return getKMPSteps(text, pattern);
    case "rabin-karp":
      return getRabinKarpSteps(text, pattern);
    case "boyer-moore":
      return getBoyerMooreSteps(text, pattern);
  }
}
