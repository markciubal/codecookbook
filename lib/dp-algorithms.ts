// ── DP Algorithm Types & Step Generators ─────────────────────────────────────

export type DPStep = {
  table: number[][];
  highlight: [number, number][];
  activeI: number;
  activeJ: number;
  description: string;
  isBacktrack?: boolean;
  backtrackPath?: [number, number][];
  choice?: "match" | "insert" | "delete" | "replace" | "take" | "skip" | "coin";
};

export type DPAlgorithm = "lcs" | "knapsack" | "edit-distance" | "coin-change";

// ── Helpers ───────────────────────────────────────────────────────────────────

function cloneTable(t: number[][]): number[][] {
  return t.map((row) => [...row]);
}

// ── LCS ───────────────────────────────────────────────────────────────────────

export function getLCSSteps(s1: string, s2: string): DPStep[] {
  const m = s1.length;
  const n = s2.length;
  const steps: DPStep[] = [];

  // Initialize table with zeros
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  // Initial state
  steps.push({
    table: cloneTable(dp),
    highlight: [],
    activeI: 0,
    activeJ: 0,
    description: "Initialize DP table with zeros. dp[i][j] = length of LCS of s1[0..i-1] and s2[0..j-1].",
  });

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const c1 = s1[i - 1];
      const c2 = s2[j - 1];

      if (c1 === c2) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
        steps.push({
          table: cloneTable(dp),
          highlight: [[i, j]],
          activeI: i,
          activeJ: j,
          description: `dp[${i}][${j}] = dp[${i - 1}][${j - 1}] + 1 = ${dp[i][j]} because s1[${i - 1}]='${c1}' == s2[${j - 1}]='${c2}'`,
          choice: "match",
        });
      } else {
        const best = Math.max(dp[i - 1][j], dp[i][j - 1]);
        dp[i][j] = best;
        const fromAbove = dp[i - 1][j] >= dp[i][j - 1];
        steps.push({
          table: cloneTable(dp),
          highlight: [[i, j]],
          activeI: i,
          activeJ: j,
          description: `dp[${i}][${j}] = max(dp[${i - 1}][${j}]=${dp[i - 1][j]}, dp[${i}][${j - 1}]=${dp[i][j - 1]}) = ${dp[i][j]}  (s1[${i - 1}]='${c1}' ≠ s2[${j - 1}]='${c2}', take ${fromAbove ? "above" : "left"})`,
        });
      }
    }
  }

  // Backtracking phase
  const path: [number, number][] = [];
  let bi = m, bj = n;
  while (bi > 0 && bj > 0) {
    path.push([bi, bj]);
    if (s1[bi - 1] === s2[bj - 1]) {
      bi--;
      bj--;
    } else if (dp[bi - 1][bj] >= dp[bi][bj - 1]) {
      bi--;
    } else {
      bj--;
    }
  }
  path.push([bi, bj]);

  // Reconstruct LCS string
  const lcsChars: string[] = [];
  for (const [r, c] of path) {
    if (r > 0 && c > 0 && s1[r - 1] === s2[c - 1]) {
      lcsChars.unshift(s1[r - 1]);
    }
  }

  for (let k = 0; k < path.length; k++) {
    const [r, c] = path[k];
    steps.push({
      table: cloneTable(dp),
      highlight: [[r, c]],
      activeI: r,
      activeJ: c,
      isBacktrack: true,
      backtrackPath: path.slice(0, k + 1),
      description: `Backtracking: at dp[${r}][${c}]=${dp[r][c]}. ${k === path.length - 1 ? `LCS = "${lcsChars.join("")}" (length ${dp[m][n]})` : r > 0 && c > 0 && s1[r - 1] === s2[c - 1] ? `s1[${r - 1}]='${s1[r - 1]}' matches → diagonal` : `no match → move ${r > 0 && (c === 0 || dp[r - 1][c] >= dp[r][c - 1]) ? "up" : "left"}`}`,
    });
  }

  return steps;
}

// ── Edit Distance ─────────────────────────────────────────────────────────────

export function getEditDistanceSteps(s1: string, s2: string): DPStep[] {
  const m = s1.length;
  const n = s2.length;
  const steps: DPStep[] = [];

  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  // Initialize base cases
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  steps.push({
    table: cloneTable(dp),
    highlight: [],
    activeI: 0,
    activeJ: 0,
    description: `Initialize: dp[i][0]=i (delete i chars), dp[0][j]=j (insert j chars). Transforming "${s1}" → "${s2}".`,
  });

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const c1 = s1[i - 1];
      const c2 = s2[j - 1];

      if (c1 === c2) {
        dp[i][j] = dp[i - 1][j - 1];
        steps.push({
          table: cloneTable(dp),
          highlight: [[i, j]],
          activeI: i,
          activeJ: j,
          description: `dp[${i}][${j}]: s1[${i - 1}]='${c1}' == s2[${j - 1}]='${c2}' → no op needed, dp[${i}][${j}] = dp[${i - 1}][${j - 1}] = ${dp[i][j]}`,
          choice: "match",
        });
      } else {
        const ins = dp[i][j - 1] + 1;
        const del = dp[i - 1][j] + 1;
        const rep = dp[i - 1][j - 1] + 1;
        const best = Math.min(ins, del, rep);
        dp[i][j] = best;
        const op = best === rep ? "replace" : best === ins ? "insert" : "delete";
        const opDesc = op === "replace"
          ? `replace '${c1}' with '${c2}' (dp[${i - 1}][${j - 1}]+1=${rep})`
          : op === "insert"
          ? `insert '${c2}' (dp[${i}][${j - 1}]+1=${ins})`
          : `delete '${c1}' (dp[${i - 1}][${j}]+1=${del})`;
        steps.push({
          table: cloneTable(dp),
          highlight: [[i, j]],
          activeI: i,
          activeJ: j,
          description: `dp[${i}][${j}]: s1[${i - 1}]='${c1}' ≠ s2[${j - 1}]='${c2}' → min(ins=${ins}, del=${del}, rep=${rep})=${best} → ${opDesc}`,
          choice: op,
        });
      }
    }
  }

  // Backtracking
  const path: [number, number][] = [];
  let bi = m, bj = n;
  while (bi > 0 || bj > 0) {
    path.push([bi, bj]);
    if (bi === 0) { bj--; }
    else if (bj === 0) { bi--; }
    else if (s1[bi - 1] === s2[bj - 1]) { bi--; bj--; }
    else {
      const ins = dp[bi][bj - 1];
      const del = dp[bi - 1][bj];
      const rep = dp[bi - 1][bj - 1];
      const best = Math.min(ins, del, rep);
      if (rep === best) { bi--; bj--; }
      else if (del === best) { bi--; }
      else { bj--; }
    }
  }
  path.push([0, 0]);

  for (let k = 0; k < path.length; k++) {
    const [r, c] = path[k];
    steps.push({
      table: cloneTable(dp),
      highlight: [[r, c]],
      activeI: r,
      activeJ: c,
      isBacktrack: true,
      backtrackPath: path.slice(0, k + 1),
      description: `Backtracking at dp[${r}][${c}]=${dp[r][c]}. ${k === path.length - 1 ? `Total edit distance = ${dp[m][n]}` : r > 0 && c > 0 && s1[r - 1] === s2[c - 1] ? "Characters match → diagonal (no op)" : r > 0 && c > 0 ? `Operation needed at this cell` : r === 0 ? "Insert remaining chars" : "Delete remaining chars"}`,
    });
  }

  return steps;
}

// ── 0/1 Knapsack ──────────────────────────────────────────────────────────────

export function getKnapsackSteps(
  weights: number[],
  values: number[],
  capacity: number
): DPStep[] {
  const n = weights.length;
  const steps: DPStep[] = [];

  const dp: number[][] = Array.from({ length: n + 1 }, () =>
    new Array(capacity + 1).fill(0)
  );

  steps.push({
    table: cloneTable(dp),
    highlight: [],
    activeI: 0,
    activeJ: 0,
    description: `Initialize ${n + 1}×${capacity + 1} table. dp[i][w] = max value using first i items with capacity w.`,
  });

  for (let i = 1; i <= n; i++) {
    const w = weights[i - 1];
    const v = values[i - 1];
    for (let c = 0; c <= capacity; c++) {
      if (w > c) {
        dp[i][c] = dp[i - 1][c];
        steps.push({
          table: cloneTable(dp),
          highlight: [[i, c]],
          activeI: i,
          activeJ: c,
          description: `Item ${i} (w=${w}, v=${v}): weight ${w} > capacity ${c} → skip. dp[${i}][${c}] = dp[${i - 1}][${c}] = ${dp[i][c]}`,
          choice: "skip",
        });
      } else {
        const withItem = dp[i - 1][c - w] + v;
        const withoutItem = dp[i - 1][c];
        const take = withItem > withoutItem;
        dp[i][c] = Math.max(withItem, withoutItem);
        steps.push({
          table: cloneTable(dp),
          highlight: [[i, c]],
          activeI: i,
          activeJ: c,
          description: `Item ${i} (w=${w}, v=${v}) at cap ${c}: take(${dp[i - 1][c - w]}+${v}=${withItem}) vs skip(${withoutItem}) → ${take ? "TAKE" : "SKIP"} → ${dp[i][c]}`,
          choice: take ? "take" : "skip",
        });
      }
    }
  }

  // Backtracking
  const path: [number, number][] = [];
  const takenItems: number[] = [];
  let bi = n, bj = capacity;
  while (bi > 0 && bj >= 0) {
    path.push([bi, bj]);
    if (dp[bi][bj] !== dp[bi - 1][bj]) {
      takenItems.push(bi);
      bj -= weights[bi - 1];
    }
    bi--;
  }
  path.push([bi, bj < 0 ? 0 : bj]);

  for (let k = 0; k < path.length; k++) {
    const [r, c] = path[k];
    const tookHere = k > 0 && takenItems.includes(path[k - 1][0]);
    steps.push({
      table: cloneTable(dp),
      highlight: [[r, c]],
      activeI: r,
      activeJ: c,
      isBacktrack: true,
      backtrackPath: path.slice(0, k + 1),
      description: `Backtrack at dp[${r}][${c}]=${dp[r] ? dp[r][c] : 0}. ${k === 0 ? `Max value = ${dp[n][capacity]}` : tookHere ? `Took item ${path[k - 1][0]} (w=${weights[path[k - 1][0] - 1]}, v=${values[path[k - 1][0] - 1]})` : `Did not take item ${r + 1}`}. Items taken: [${takenItems.slice().reverse().join(", ")}]`,
    });
  }

  return steps;
}

// ── Coin Change ───────────────────────────────────────────────────────────────

export function getCoinChangeSteps(coins: number[], amount: number): DPStep[] {
  const steps: DPStep[] = [];
  const INF = amount + 1;
  const dp: number[] = new Array(amount + 1).fill(INF);
  dp[0] = 0;
  const coinUsed: number[] = new Array(amount + 1).fill(-1);

  steps.push({
    table: [dp.map((v) => (v === INF ? -1 : v))],
    highlight: [[0, 0]],
    activeI: 0,
    activeJ: 0,
    description: `Initialize: dp[0]=0 (0 coins to make $0), dp[1..${amount}]=∞. Coins: [${coins.join(", ")}]`,
  });

  for (let a = 1; a <= amount; a++) {
    for (const coin of coins) {
      if (coin <= a && dp[a - coin] + 1 < dp[a]) {
        dp[a] = dp[a - coin] + 1;
        coinUsed[a] = coin;
      }
    }
    steps.push({
      table: [dp.map((v) => (v === INF ? -1 : v))],
      highlight: [[0, a]],
      activeI: 0,
      activeJ: a,
      description: dp[a] === INF
        ? `dp[${a}]: cannot make ${a} with coins [${coins.join(", ")}] → ∞`
        : `dp[${a}] = ${dp[a]} (use coin ${coinUsed[a]}: dp[${a - coinUsed[a]}]+1=${dp[a]})`,
      choice: "coin",
    });
  }

  // Backtracking
  const path: [number, number][] = [];
  const coinsPath: number[] = [];
  if (dp[amount] !== INF) {
    let rem = amount;
    while (rem > 0 && coinUsed[rem] !== -1) {
      path.push([0, rem]);
      coinsPath.push(coinUsed[rem]);
      rem -= coinUsed[rem];
    }
    path.push([0, rem]);
  }

  if (path.length > 0) {
    for (let k = 0; k < path.length; k++) {
      const [, c] = path[k];
      steps.push({
        table: [dp.map((v) => (v === INF ? -1 : v))],
        highlight: [[0, c]],
        activeI: 0,
        activeJ: c,
        isBacktrack: true,
        backtrackPath: path.slice(0, k + 1),
        description: k === path.length - 1
          ? `Done! Coins used: [${coinsPath.join(", ")}] = ${dp[amount]} coins total`
          : `Backtrack at ${c}: used coin ${coinsPath[k]} → go to ${c - coinsPath[k]}`,
      });
    }
  } else {
    steps.push({
      table: [dp.map((v) => (v === INF ? -1 : v))],
      highlight: [[0, amount]],
      activeI: 0,
      activeJ: amount,
      description: `Amount ${amount} cannot be made with coins [${coins.join(", ")}].`,
    });
  }

  return steps;
}

// ── Dispatcher ────────────────────────────────────────────────────────────────

export function getDPSteps(algorithm: DPAlgorithm, ...args: unknown[]): DPStep[] {
  switch (algorithm) {
    case "lcs":
      return getLCSSteps(
        (args[0] as string | undefined) ?? "ABCBDAB",
        (args[1] as string | undefined) ?? "BDCABA"
      );
    case "edit-distance":
      return getEditDistanceSteps(
        (args[0] as string | undefined) ?? "kitten",
        (args[1] as string | undefined) ?? "sitting"
      );
    case "knapsack":
      return getKnapsackSteps(
        (args[0] as number[] | undefined) ?? [2, 3, 4, 5],
        (args[1] as number[] | undefined) ?? [3, 4, 5, 6],
        (args[2] as number | undefined) ?? 8
      );
    case "coin-change":
      return getCoinChangeSteps(
        (args[0] as number[] | undefined) ?? [1, 5, 10, 25],
        (args[1] as number | undefined) ?? 41
      );
  }
}
