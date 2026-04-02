export type MathStep = {
  grid?: boolean[];
  highlight?: number[];
  current?: number;
  values?: { label: string; value: number | string }[];
  description: string;
  phase?: string;
};

export type MathAlgorithm = "sieve" | "gcd" | "fast-exp";

// ── Sieve of Eratosthenes ──────────────────────────────────────────────────────

export function getSieveSteps(limit: number = 100): MathStep[] {
  const steps: MathStep[] = [];
  const isPrime = new Array(limit + 1).fill(true);
  isPrime[0] = false;
  if (limit >= 1) isPrime[1] = false;

  // Mark 0 and 1
  steps.push({
    grid: [...isPrime],
    highlight: [0, 1],
    description: "Mark 0 and 1 as not prime — by definition, primes must be > 1",
    phase: "sieve",
  });

  for (let p = 2; p * p <= limit; p++) {
    if (!isPrime[p]) continue;

    // Highlight current prime
    steps.push({
      grid: [...isPrime],
      highlight: [],
      current: p,
      description: `p = ${p} is prime. Now marking multiples starting from ${p}² = ${p * p}`,
      phase: "sieve",
    });

    for (let multiple = p * p; multiple <= limit; multiple += p) {
      isPrime[multiple] = false;

      steps.push({
        grid: [...isPrime],
        highlight: [multiple],
        current: p,
        description: `Cross off ${multiple} = ${p} × ${multiple / p} (composite)`,
        phase: "sieve",
      });
    }
  }

  const primes = isPrime.reduce<number[]>((acc, v, i) => (v ? [...acc, i] : acc), []);
  steps.push({
    grid: [...isPrime],
    highlight: primes,
    description: `Done! Found ${primes.length} primes up to ${limit}: ${primes.slice(0, 10).join(", ")}${primes.length > 10 ? "…" : ""}`,
    phase: "sieve",
  });

  return steps;
}

// ── GCD (Euclidean Algorithm) ──────────────────────────────────────────────────

export function getGCDSteps(a: number = 252, b: number = 105): MathStep[] {
  const steps: MathStep[] = [];
  let curA = a;
  let curB = b;

  steps.push({
    values: [
      { label: "a", value: curA },
      { label: "b", value: curB },
      { label: "a mod b", value: "—" },
    ],
    description: `Computing gcd(${a}, ${b}) using the Euclidean algorithm`,
    phase: "gcd",
  });

  while (curB > 0) {
    const remainder = curA % curB;
    const quotient = Math.floor(curA / curB);

    steps.push({
      values: [
        { label: "a", value: curA },
        { label: "b", value: curB },
        { label: "a mod b", value: remainder },
        { label: "quotient", value: quotient },
      ],
      description: `gcd(${curA}, ${curB}): ${curA} = ${quotient} × ${curB} + ${remainder}  →  next: gcd(${curB}, ${remainder})`,
      phase: "gcd",
    });

    curA = curB;
    curB = remainder;
  }

  steps.push({
    values: [
      { label: "a", value: curA },
      { label: "b", value: 0 },
      { label: "gcd", value: curA },
    ],
    description: `b = 0, so gcd(${a}, ${b}) = ${curA}`,
    phase: "gcd",
  });

  return steps;
}

// ── Fast Exponentiation (Square-and-Multiply) ─────────────────────────────────

export function getFastExpSteps(
  base: number = 2,
  exp: number = 10,
  mod: number = 1000
): MathStep[] {
  const steps: MathStep[] = [];
  const bits = exp.toString(2).split("").map(Number);

  steps.push({
    values: [
      { label: "base", value: base },
      { label: "exponent", value: exp },
      { label: "mod", value: mod },
      { label: "binary exp", value: bits.join("") },
    ],
    description: `Computing ${base}^${exp} mod ${mod}. Exponent in binary: ${bits.join("")} (${bits.length} bits)`,
    phase: "fastexp",
  });

  let result = 1;
  let curBase = base % mod;

  for (let i = bits.length - 1; i >= 0; i--) {
    const bit = bits[i];
    const bitPosition = bits.length - 1 - i;

    if (bit === 1) {
      const prevResult = result;
      result = (result * curBase) % mod;

      steps.push({
        values: [
          { label: "bit", value: bit },
          { label: "bit position", value: bitPosition },
          { label: "current base²", value: curBase },
          { label: "result", value: result },
        ],
        description: `bit=${bit} (position ${bitPosition}): result = result × base = ${prevResult} × ${curBase} mod ${mod} = ${result}`,
        phase: "fastexp",
        current: i,
      });
    } else {
      steps.push({
        values: [
          { label: "bit", value: bit },
          { label: "bit position", value: bitPosition },
          { label: "current base²", value: curBase },
          { label: "result", value: result },
        ],
        description: `bit=${bit} (position ${bitPosition}): bit is 0, skip multiply. result stays ${result}`,
        phase: "fastexp",
        current: i,
      });
    }

    const prevBase = curBase;
    curBase = (curBase * curBase) % mod;

    if (i > 0) {
      steps.push({
        values: [
          { label: "base", value: prevBase },
          { label: "base²", value: curBase },
          { label: "result so far", value: result },
        ],
        description: `Square base: ${prevBase}² mod ${mod} = ${curBase}`,
        phase: "fastexp",
        current: i,
      });
    }
  }

  steps.push({
    values: [
      { label: "base", value: base },
      { label: "exponent", value: exp },
      { label: "mod", value: mod },
      { label: "result", value: result },
    ],
    description: `Done! ${base}^${exp} mod ${mod} = ${result}`,
    phase: "fastexp",
  });

  return steps;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getMathSteps(algorithm: MathAlgorithm, ...args: any[]): MathStep[] {
  if (algorithm === "sieve") return getSieveSteps(args[0]);
  if (algorithm === "gcd") return getGCDSteps(args[0], args[1]);
  if (algorithm === "fast-exp") return getFastExpSteps(args[0], args[1], args[2]);
  return [];
}
