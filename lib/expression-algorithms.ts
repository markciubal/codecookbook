/*
 * Expression-evaluation algorithms — step generators for visualization.
 *
 * Two paired algorithms:
 *   1. shuntingYardSteps  — infix → postfix (Edsger Dijkstra, 1961)
 *   2. postfixEvalSteps   — postfix → numeric result (a.k.a. FPE, the
 *                            Functional Postfix Evaluator; classic stack-based
 *                            RPN evaluation)
 *
 * Both take a single expression string, return a sequence of snapshot steps
 * the visualizer can play through. Token semantics are kept narrow on purpose:
 *   • numbers (integers and decimals)
 *   • operators: + - * / ^ (right-associative for ^)
 *   • parentheses: ( )
 *   • whitespace is the only separator
 */

export type Token = {
  /** The raw string of this token (e.g. "3.14", "+", "(") */
  value: string;
  /** Classification for rendering and dispatch */
  kind: "number" | "operator" | "lparen" | "rparen" | "error";
  /** 0-based position in the original token list — used by the visualizer to highlight which input piece is being processed */
  idx: number;
};

export type ShuntingStep = {
  tokens: Token[];
  /** Which token (by idx) is being processed; -1 before/after the loop */
  currentIdx: number;
  operatorStack: string[];
  outputQueue: string[];
  /** Plain-language explanation of what just happened on this step */
  description: string;
  /** UI hint: an operator just popped from the stack to the output */
  poppedToOutput?: string;
  /** UI hint: an operator just pushed onto the stack */
  pushedToStack?: string;
  /** UI hint: a token just went directly to the output */
  pushedToOutput?: string;
  /** Final-state flag (renderer can show a 🏁) */
  done?: boolean;
};

export type PostfixEvalStep = {
  tokens: Token[];
  currentIdx: number;
  valueStack: number[];
  description: string;
  /** UI hint: which operator just consumed top two values */
  appliedOperator?: string;
  /** UI hint: a number just got pushed */
  pushedValue?: number;
  /** Final result, only on the last step */
  result?: number;
  done?: boolean;
};

// ──────────────────────────────────────────────────────────────────────────────
// Tokenizer
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Convert a raw expression string into a flat list of tokens.
 *
 * Recognises decimal numbers (including a leading minus when it can only mean
 * "negative literal" — i.e. at the start or directly after an open-paren or
 * operator). Operators are single-character. Everything else becomes an
 * "error" token so the visualizer can highlight invalid input clearly.
 */
export function tokenize(expr: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  let idx = 0;
  while (i < expr.length) {
    const c = expr[i];
    if (c === " " || c === "\t" || c === "\n") { i++; continue; }
    if (c === "(") { out.push({ value: "(", kind: "lparen", idx: idx++ }); i++; continue; }
    if (c === ")") { out.push({ value: ")", kind: "rparen", idx: idx++ }); i++; continue; }
    if ("+-*/^".includes(c)) {
      // Unary minus heuristic: treat `-` as the sign of a numeric literal when
      // it can only mean that (start of expr, after operator, after lparen).
      if (c === "-") {
        const prev = out[out.length - 1];
        if (!prev || prev.kind === "operator" || prev.kind === "lparen") {
          // Pull the following number
          let j = i + 1;
          while (j < expr.length && expr[j] === " ") j++;
          if (j < expr.length && (expr[j] === "." || (expr[j] >= "0" && expr[j] <= "9"))) {
            let k = j;
            while (k < expr.length && (expr[k] === "." || (expr[k] >= "0" && expr[k] <= "9"))) k++;
            out.push({ value: "-" + expr.slice(j, k), kind: "number", idx: idx++ });
            i = k;
            continue;
          }
        }
      }
      out.push({ value: c, kind: "operator", idx: idx++ });
      i++;
      continue;
    }
    if (c === "." || (c >= "0" && c <= "9")) {
      let k = i;
      while (k < expr.length && (expr[k] === "." || (expr[k] >= "0" && expr[k] <= "9"))) k++;
      out.push({ value: expr.slice(i, k), kind: "number", idx: idx++ });
      i = k;
      continue;
    }
    out.push({ value: c, kind: "error", idx: idx++ });
    i++;
  }
  return out;
}

// ──────────────────────────────────────────────────────────────────────────────
// Operator metadata
// ──────────────────────────────────────────────────────────────────────────────

/** Precedence levels — higher binds tighter. */
const PRECEDENCE: Record<string, number> = {
  "+": 1,
  "-": 1,
  "*": 2,
  "/": 2,
  "^": 3,
};
/** Right-associativity flag — only `^` is right-associative here. */
const RIGHT_ASSOC: Record<string, boolean> = {
  "^": true,
};

export function operatorInfo(op: string): { prec: number; rightAssoc: boolean } | null {
  if (!(op in PRECEDENCE)) return null;
  return { prec: PRECEDENCE[op], rightAssoc: !!RIGHT_ASSOC[op] };
}

// ──────────────────────────────────────────────────────────────────────────────
// Shunting Yard (infix → postfix)
// ──────────────────────────────────────────────────────────────────────────────

export function shuntingYardSteps(expr: string): ShuntingStep[] {
  const tokens = tokenize(expr);
  const steps: ShuntingStep[] = [];
  const opStack: string[] = [];
  const output: string[] = [];

  steps.push({
    tokens, currentIdx: -1,
    operatorStack: [], outputQueue: [],
    description: `Begin. Read tokens left to right. Numbers go straight to output; operators are buffered on a stack ordered by precedence.`,
  });

  for (const tok of tokens) {
    if (tok.kind === "number") {
      output.push(tok.value);
      steps.push({
        tokens, currentIdx: tok.idx,
        operatorStack: [...opStack], outputQueue: [...output],
        pushedToOutput: tok.value,
        description: `Number "${tok.value}" → straight to output queue.`,
      });
    } else if (tok.kind === "operator") {
      const info = operatorInfo(tok.value)!;
      // Pop while the top of the operator stack has higher precedence
      // (or equal precedence and the current operator is left-associative).
      while (opStack.length > 0) {
        const top = opStack[opStack.length - 1];
        if (top === "(") break;
        const topInfo = operatorInfo(top);
        if (!topInfo) break;
        const shouldPop =
          topInfo.prec > info.prec ||
          (topInfo.prec === info.prec && !info.rightAssoc);
        if (!shouldPop) break;
        opStack.pop();
        output.push(top);
        steps.push({
          tokens, currentIdx: tok.idx,
          operatorStack: [...opStack], outputQueue: [...output],
          poppedToOutput: top,
          description: `Operator "${tok.value}" (prec ${info.prec}) arriving. "${top}" on stack has prec ${topInfo.prec} ${topInfo.prec === info.prec ? "(same prec, left-assoc)" : "(higher)"} → pop "${top}" to output first.`,
        });
      }
      opStack.push(tok.value);
      steps.push({
        tokens, currentIdx: tok.idx,
        operatorStack: [...opStack], outputQueue: [...output],
        pushedToStack: tok.value,
        description: `Push operator "${tok.value}" onto the operator stack.`,
      });
    } else if (tok.kind === "lparen") {
      opStack.push("(");
      steps.push({
        tokens, currentIdx: tok.idx,
        operatorStack: [...opStack], outputQueue: [...output],
        pushedToStack: "(",
        description: `Open parenthesis → push "(" as a barrier on the stack. Operators above it stay there until ")" arrives.`,
      });
    } else if (tok.kind === "rparen") {
      let foundMatch = false;
      while (opStack.length > 0) {
        const top = opStack.pop()!;
        if (top === "(") { foundMatch = true; break; }
        output.push(top);
        steps.push({
          tokens, currentIdx: tok.idx,
          operatorStack: [...opStack], outputQueue: [...output],
          poppedToOutput: top,
          description: `")" reached → pop "${top}" from stack to output (drain to the matching "(").`,
        });
      }
      if (!foundMatch) {
        steps.push({
          tokens, currentIdx: tok.idx,
          operatorStack: [...opStack], outputQueue: [...output],
          description: `❌ Mismatched ")" — no matching "(" found on the stack. Stop.`,
          done: true,
        });
        return steps;
      }
      steps.push({
        tokens, currentIdx: tok.idx,
        operatorStack: [...opStack], outputQueue: [...output],
        description: `Matching "(" popped and discarded. Continue.`,
      });
    } else {
      steps.push({
        tokens, currentIdx: tok.idx,
        operatorStack: [...opStack], outputQueue: [...output],
        description: `❌ Unknown token "${tok.value}". Stop.`,
        done: true,
      });
      return steps;
    }
  }

  // Drain the operator stack into the output.
  while (opStack.length > 0) {
    const top = opStack.pop()!;
    if (top === "(") {
      steps.push({
        tokens, currentIdx: -1,
        operatorStack: [...opStack], outputQueue: [...output],
        description: `❌ Mismatched "(" left on stack at end. Stop.`,
        done: true,
      });
      return steps;
    }
    output.push(top);
    steps.push({
      tokens, currentIdx: -1,
      operatorStack: [...opStack], outputQueue: [...output],
      poppedToOutput: top,
      description: `Input exhausted. Drain "${top}" from operator stack to output.`,
    });
  }

  steps.push({
    tokens, currentIdx: -1,
    operatorStack: [], outputQueue: [...output],
    description: `🏁 Done. Postfix expression: ${output.join(" ")}`,
    done: true,
  });
  return steps;
}

/** Convenience: just return the postfix string for an infix input. */
export function infixToPostfix(expr: string): string {
  const steps = shuntingYardSteps(expr);
  const last = steps[steps.length - 1];
  return last.outputQueue.join(" ");
}

// ──────────────────────────────────────────────────────────────────────────────
// Random expression generation — for the visualizer's "🎲 new example" button
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Internal AST node for random expression generation. We build a tree, then
 * render it to infix or postfix. This keeps the random output always
 * well-formed and lets us paren intelligently when going to infix.
 */
type ExprNode =
  | { kind: "num"; value: number }
  | { kind: "op";  op: string; lhs: ExprNode; rhs: ExprNode };

const SAFE_OPS = ["+", "-", "*"];           // for top-level / common ops
const ALL_OPS  = ["+", "-", "*", "/", "^"]; // include / and ^ at higher depth

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Build a random expression tree. Depth biases toward smaller trees with a
 * leaf-bias growing each level (we still occasionally make deeper trees so
 * shunting yard gets meaty inputs to walk through).
 */
function randomTree(depth: number, allowDivPow: boolean): ExprNode {
  const leafBias = 0.18 + (4 - depth) * 0.18; // shallower = more likely to be a leaf
  if (depth <= 0 || Math.random() < leafBias) {
    // Numbers 1..15 — small enough that postfix arithmetic stays human-readable
    // when the visualizer evaluates the result.
    return { kind: "num", value: Math.floor(Math.random() * 15) + 1 };
  }
  const op = pick(allowDivPow ? ALL_OPS : SAFE_OPS);
  let rhs = randomTree(depth - 1, allowDivPow);
  // For division, avoid having a zero on the rhs (prevents the FPE evaluator
  // from immediately tripping its divide-by-zero guard on random examples).
  if (op === "/" && rhs.kind === "num" && rhs.value === 0) rhs = { kind: "num", value: 1 };
  return {
    kind: "op",
    op,
    lhs: randomTree(depth - 1, allowDivPow),
    rhs,
  };
}

/** Operator precedence — shared with `operatorInfo` but kept local-numeric here. */
function prec(op: string): number { return op === "^" ? 3 : (op === "*" || op === "/") ? 2 : 1; }
function isRightAssoc(op: string): boolean { return op === "^"; }

/**
 * Render an AST node as infix using only the parentheses precedence/assoc
 * actually requires. This produces natural-looking expressions like
 * `3 + 4 * 5 - 2 / 7^2` rather than the parenthesis-soup `((3+4)*5)…`.
 */
function toInfix(node: ExprNode, parentPrec = 0, isRightChild = false): string {
  if (node.kind === "num") return String(node.value);
  const myPrec = prec(node.op);
  // Parens needed when our op binds looser than the parent's, OR when same
  // precedence and we're the right child of a left-associative op
  // (e.g. `1 - (2 - 3) ≠ 1 - 2 - 3`).
  const needParen =
    myPrec < parentPrec ||
    (myPrec === parentPrec && isRightChild && !isRightAssoc(node.op));
  const inner = `${toInfix(node.lhs, myPrec, false)} ${node.op} ${toInfix(node.rhs, myPrec, true)}`;
  return needParen ? `(${inner})` : inner;
}

/** Render an AST node as postfix (RPN). Always unambiguous; no parens needed. */
function toPostfix(node: ExprNode): string {
  if (node.kind === "num") return String(node.value);
  return `${toPostfix(node.lhs)} ${toPostfix(node.rhs)} ${node.op}`;
}

/**
 * Generate a fresh random infix expression suitable for the Shunting Yard
 * visualizer. The size knob roughly controls how many operators appear.
 * Depth 3 → ~3–7 operators · Depth 4 → ~5–13 operators.
 */
export function randomInfix(opts: { depth?: number; allowDivPow?: boolean } = {}): string {
  const depth = opts.depth ?? 3;
  const allowDivPow = opts.allowDivPow ?? true;
  return toInfix(randomTree(depth, allowDivPow));
}

/**
 * Generate a fresh random postfix expression for the FPE visualizer.
 * Always well-formed (built from a tree) — the value stack will always have
 * exactly one element at the end.
 */
export function randomPostfix(opts: { depth?: number; allowDivPow?: boolean } = {}): string {
  const depth = opts.depth ?? 3;
  const allowDivPow = opts.allowDivPow ?? true;
  return toPostfix(randomTree(depth, allowDivPow));
}

// ──────────────────────────────────────────────────────────────────────────────
// Postfix evaluation (FPE — Functional Postfix Evaluator)
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Step generator for evaluating a postfix (Reverse Polish Notation) expression.
 *
 * Token by token:
 *   • Number → push onto the value stack.
 *   • Binary operator → pop the top two values (right then left), apply the
 *     op, push the result. Note the pop order: the second pop is the LHS,
 *     the first pop is the RHS.
 *   • End of input → the lone remaining stack value is the result.
 *
 * `^` is treated as exponentiation. Division by zero produces an error step
 * rather than yielding Infinity, so the visualization clearly flags the issue.
 */
export function postfixEvalSteps(expr: string): PostfixEvalStep[] {
  const tokens = tokenize(expr);
  const steps: PostfixEvalStep[] = [];
  const stack: number[] = [];

  steps.push({
    tokens, currentIdx: -1,
    valueStack: [],
    description: `Begin. Read tokens left to right. Numbers go on a value stack; an operator pops the top two and pushes the result.`,
  });

  for (const tok of tokens) {
    if (tok.kind === "number") {
      const n = Number(tok.value);
      if (!Number.isFinite(n)) {
        steps.push({
          tokens, currentIdx: tok.idx,
          valueStack: [...stack],
          description: `❌ Could not parse "${tok.value}" as a number. Stop.`,
          done: true,
        });
        return steps;
      }
      stack.push(n);
      steps.push({
        tokens, currentIdx: tok.idx,
        valueStack: [...stack],
        pushedValue: n,
        description: `Number "${tok.value}" → push onto stack.`,
      });
    } else if (tok.kind === "operator") {
      if (stack.length < 2) {
        steps.push({
          tokens, currentIdx: tok.idx,
          valueStack: [...stack],
          description: `❌ Operator "${tok.value}" needs two operands but stack only has ${stack.length}. Stop.`,
          done: true,
        });
        return steps;
      }
      // First pop is the RHS, second pop is the LHS — order matters for - / ^.
      const rhs = stack.pop()!;
      const lhs = stack.pop()!;
      let result: number;
      switch (tok.value) {
        case "+": result = lhs + rhs; break;
        case "-": result = lhs - rhs; break;
        case "*": result = lhs * rhs; break;
        case "/":
          if (rhs === 0) {
            steps.push({
              tokens, currentIdx: tok.idx,
              valueStack: [...stack],
              appliedOperator: tok.value,
              description: `❌ Division by zero: ${lhs} / ${rhs}. Stop.`,
              done: true,
            });
            return steps;
          }
          result = lhs / rhs;
          break;
        case "^": result = Math.pow(lhs, rhs); break;
        default:
          steps.push({
            tokens, currentIdx: tok.idx,
            valueStack: [...stack],
            description: `❌ Unknown operator "${tok.value}". Stop.`,
            done: true,
          });
          return steps;
      }
      stack.push(result);
      steps.push({
        tokens, currentIdx: tok.idx,
        valueStack: [...stack],
        appliedOperator: tok.value,
        pushedValue: result,
        description: `Operator "${tok.value}": pop ${rhs} (rhs), pop ${lhs} (lhs), push ${lhs} ${tok.value} ${rhs} = ${result}.`,
      });
    } else if (tok.kind === "lparen" || tok.kind === "rparen") {
      steps.push({
        tokens, currentIdx: tok.idx,
        valueStack: [...stack],
        description: `❌ Postfix input should have no parentheses. Found "${tok.value}". Stop.`,
        done: true,
      });
      return steps;
    } else {
      steps.push({
        tokens, currentIdx: tok.idx,
        valueStack: [...stack],
        description: `❌ Unknown token "${tok.value}". Stop.`,
        done: true,
      });
      return steps;
    }
  }

  if (stack.length === 1) {
    steps.push({
      tokens, currentIdx: -1,
      valueStack: [...stack],
      result: stack[0],
      description: `🏁 Done. Result: ${stack[0]}.`,
      done: true,
    });
  } else if (stack.length === 0) {
    steps.push({
      tokens, currentIdx: -1,
      valueStack: [],
      description: `❌ Empty input — no result.`,
      done: true,
    });
  } else {
    steps.push({
      tokens, currentIdx: -1,
      valueStack: [...stack],
      description: `❌ Malformed input — ${stack.length} values left on the stack at end (expected exactly 1).`,
      done: true,
    });
  }
  return steps;
}
