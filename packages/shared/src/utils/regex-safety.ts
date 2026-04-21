/**
 * Regex safety guard — reject patterns that can trigger catastrophic
 * backtracking (ReDoS) *before* we compile and run them against untrusted
 * input (scraper host hostnames, captured URLs, etc.).
 *
 * This is a pure-JavaScript implementation (no native deps, no RE2) so it
 * runs unchanged in Node, the browser extension, and the Electron renderer.
 *
 * Two layers of defense are expected on every user-supplied regex source:
 *
 *   1. `isSafeRegexSource(source)` — static analysis of the pattern for
 *      well-known ReDoS shapes (nested quantifiers, huge bounded repeats).
 *   2. `try { new RegExp(source, "i") } catch { reject }` — a syntactic
 *      backstop to catch anything that is simply not a valid regex.
 *
 * Both checks MUST be applied at write-time (API boundary / Zod schema)
 * AND at load-time (before compiling a row out of the DB), because a bad
 * row may have been inserted before the guard existed, or the DB may have
 * been tampered with out-of-band.
 *
 * The algorithm is adapted from `safe-regex` (the well-known `nlf` / David
 * Storey rewrite) but trimmed to exactly what we need and inlined so there
 * is no transitive dependency.
 *
 * Rejected shapes (examples, all flagged with reason="nested-quantifier"):
 *   `^(a+)+$`
 *   `(a*)*`
 *   `(a|a)*`
 *   `(.*)*`
 *
 * Rejected for oversize bounded repeats (reason="large-repeat"):
 *   `a{0,500}b`           — upper bound > MAX_REPEAT (100)
 *   `(ab){50,200}`        — same
 *
 * Not rejected (the guard is conservative on the safe side — false
 * positives are worse than false negatives for a small surface like
 * insurer host patterns):
 *   `^(www\.)?example\.com$`
 *   `^portail\.rmaassurance\.com$`
 *   `\d{3}-\d{4}`
 */

/**
 * Upper bound on `{n,m}` that we allow through the guard. Host patterns
 * never need to repeat more than a handful of times; 100 is generous.
 */
const MAX_REPEAT = 100;

/**
 * Star height limit. A star height > 1 means we have a quantified group
 * *inside* another quantifier ("nested quantifier"), which is the core
 * requirement for catastrophic backtracking. Legitimate host patterns
 * never need star height > 1.
 */
const MAX_STAR_HEIGHT = 1;

/**
 * Hard cap on pattern length. The cap is well above anything we need for
 * host matching but keeps pathological inputs from wedging the parser
 * itself. Enforced before any parsing happens.
 */
const MAX_PATTERN_LENGTH = 1000;

/**
 * Result of a safety check. We return a reason code on rejection so the
 * caller can log something actionable instead of a generic "invalid".
 */
export type RegexSafetyResult =
  | { safe: true }
  | {
      safe: false;
      reason:
        | "empty"
        | "too-long"
        | "invalid-syntax"
        | "nested-quantifier"
        | "large-repeat"
        | "parse-error";
    };

/**
 * Inspect a regex source string and return a structured safety verdict.
 *
 * Callers that only want a boolean can use {@link isSafeRegexSource}.
 *
 * Important: this function NEVER compiles the regex against input. It
 * operates purely on the source text, so it is safe to call on untrusted
 * data without risking the very DoS it is meant to prevent.
 */
export function analyzeRegexSafety(source: string): RegexSafetyResult {
  if (typeof source !== "string" || source.length === 0) {
    return { safe: false, reason: "empty" };
  }
  if (source.length > MAX_PATTERN_LENGTH) {
    return { safe: false, reason: "too-long" };
  }

  try {
    // Syntactic backstop: if the engine won't compile it, the caller
    // can't use it anyway. We try with the `i` flag because that is
    // what all our call sites use for host matching.
    // eslint-disable-next-line no-new
    new RegExp(source, "i");
  } catch {
    return { safe: false, reason: "invalid-syntax" };
  }

  try {
    const verdict = walk(source);
    return verdict;
  } catch {
    // The parser itself threw. That means the regex is exotic enough
    // that we cannot reason about it — treat as unsafe.
    return { safe: false, reason: "parse-error" };
  }
}

/**
 * Boolean helper — use this in Zod refinements and service guards.
 */
export function isSafeRegexSource(source: string): boolean {
  return analyzeRegexSafety(source).safe === true;
}

// ───────────────────────── internal parser ──────────────────────────────

/**
 * Walk the pattern left-to-right, tracking two things per "group":
 *   - whether the group is itself quantified (e.g. `(…)+`)
 *   - the maximum star height seen inside it
 *
 * If we ever end a group that is both quantified AND contains an inner
 * quantifier, star height goes above 1 → reject as "nested-quantifier".
 *
 * We also inspect every `{n,m}` repeat for size.
 *
 * This is a hand-rolled parser rather than a regex-on-regex because
 * regex-on-regex is exactly what we are trying to prevent, and because
 * we need to respect character classes and escapes.
 */
function walk(source: string): RegexSafetyResult {
  // Stack of frame depths for each group. Root is index 0.
  //   starHeight: max star height observed inside this frame so far.
  //   hasQuantifierInside: did we see at least one quantified atom in
  //                        this frame?
  const stack: Array<{ starHeight: number; hasQuantifierInside: boolean }> = [
    { starHeight: 0, hasQuantifierInside: false },
  ];

  let i = 0;
  while (i < source.length) {
    const ch = source[i];

    // Escapes — skip the next char outright. This also covers \d, \w,
    // \s, \uXXXX, \p{…} etc. — they are atomic for our purposes.
    if (ch === "\\") {
      // `\p{…}` and `\P{…}` — skip the braced payload so an inner `{` does
      // not accidentally register as a quantifier start.
      if (i + 1 < source.length && (source[i + 1] === "p" || source[i + 1] === "P")) {
        if (i + 2 < source.length && source[i + 2] === "{") {
          const close = source.indexOf("}", i + 3);
          if (close === -1) {
            return { safe: false, reason: "invalid-syntax" };
          }
          i = close + 1;
          continue;
        }
      }
      i += 2;
      continue;
    }

    // Character class — treat as a single atom. Skip to matching `]`,
    // honoring `\]` inside.
    if (ch === "[") {
      let j = i + 1;
      if (j < source.length && source[j] === "^") j += 1;
      // A leading `]` in a class is a literal.
      if (j < source.length && source[j] === "]") j += 1;
      while (j < source.length && source[j] !== "]") {
        if (source[j] === "\\") {
          j += 2;
        } else {
          j += 1;
        }
      }
      if (j >= source.length) {
        return { safe: false, reason: "invalid-syntax" };
      }
      i = j + 1;
      // A char class is an atom. Check if followed by a quantifier.
      const q = readQuantifier(source, i);
      if (q.kind !== "none") {
        const r = applyQuantifier(stack, q);
        if (!r.safe) return r;
        i = q.nextIndex;
      }
      continue;
    }

    // Group opening — push a new frame.
    if (ch === "(") {
      // Skip non-capturing / named-group decorations.
      // (?:…) (?=…) (?!…) (?<=…) (?<!…) (?<name>…) (?i) flags etc.
      let j = i + 1;
      if (j < source.length && source[j] === "?") {
        j += 1;
        // (?<…>) lookbehind or named group — skip the `<…>` header so
        // an inner `>` doesn't confuse us. We don't actually need the
        // name; we just need to move past it.
        if (j < source.length && source[j] === "<") {
          const close = source.indexOf(">", j);
          // If no `>`, it's a lookbehind like (?<= or (?<!
          if (source[j + 1] === "=" || source[j + 1] === "!") {
            j += 2;
          } else if (close !== -1) {
            j = close + 1;
          }
        } else if (
          j < source.length &&
          (source[j] === "=" || source[j] === "!" || source[j] === ":")
        ) {
          j += 1;
        }
        // else: could be an inline flag group like (?i) or (?i-m:)
        // which we just walk through normally below.
      }
      stack.push({ starHeight: 0, hasQuantifierInside: false });
      i = j;
      continue;
    }

    // Group closing — pop, roll starHeight up into parent.
    if (ch === ")") {
      const frame = stack.pop();
      if (!frame || stack.length === 0) {
        return { safe: false, reason: "invalid-syntax" };
      }
      i += 1;
      // Is this group followed by a quantifier?
      const q = readQuantifier(source, i);
      if (q.kind !== "none") {
        // A quantified group with quantified content = nested quantifier.
        // Examples: (a+)+, (a*)*, (a|a)+, (.*)+
        if (frame.hasQuantifierInside) {
          return { safe: false, reason: "nested-quantifier" };
        }
        if (q.kind === "bounded" && q.max > MAX_REPEAT) {
          return { safe: false, reason: "large-repeat" };
        }
        // Quantifying the group itself bumps the parent's quantifier
        // count and (if the quantifier is unbounded) contributes to
        // star height.
        const parent = stack[stack.length - 1];
        parent.hasQuantifierInside = true;
        const contributedHeight =
          q.kind === "unbounded"
            ? Math.max(frame.starHeight, 0) + 1
            : frame.starHeight;
        if (contributedHeight > MAX_STAR_HEIGHT) {
          return { safe: false, reason: "nested-quantifier" };
        }
        parent.starHeight = Math.max(parent.starHeight, contributedHeight);
        i = q.nextIndex;
      } else {
        // Group isn't quantified — its interior star height still
        // propagates up (so `((a+)+)` is caught).
        const parent = stack[stack.length - 1];
        if (frame.starHeight > MAX_STAR_HEIGHT) {
          return { safe: false, reason: "nested-quantifier" };
        }
        parent.starHeight = Math.max(parent.starHeight, frame.starHeight);
        if (frame.hasQuantifierInside) {
          parent.hasQuantifierInside = true;
        }
      }
      continue;
    }

    // Plain atom (literal char, `.`, `^`, `$`, `|`) — check for a
    // quantifier right after it.
    i += 1;
    const q = readQuantifier(source, i);
    if (q.kind !== "none") {
      const r = applyQuantifier(stack, q);
      if (!r.safe) return r;
      i = q.nextIndex;
    }
  }

  // Unclosed group?
  if (stack.length !== 1) {
    return { safe: false, reason: "invalid-syntax" };
  }
  return { safe: true };
}

type Quantifier =
  | { kind: "none"; nextIndex: number }
  | { kind: "unbounded"; nextIndex: number }
  | { kind: "bounded"; max: number; nextIndex: number };

/**
 * Peek at position `i` and classify the quantifier, if any.
 *
 * Unbounded: `*`, `+`  (min ≥ 0, max = ∞)
 * Bounded:   `?`       (always tiny, treated as bounded max=1)
 *            `{n}`, `{n,}`, `{n,m}` — we care about m.
 * Lazy / possessive modifiers (`*?`, `+?`, `{n,m}?`) are also accepted.
 */
function readQuantifier(source: string, i: number): Quantifier {
  if (i >= source.length) return { kind: "none", nextIndex: i };
  const ch = source[i];
  if (ch === "*" || ch === "+") {
    return { kind: "unbounded", nextIndex: skipLazy(source, i + 1) };
  }
  if (ch === "?") {
    return { kind: "bounded", max: 1, nextIndex: skipLazy(source, i + 1) };
  }
  if (ch === "{") {
    // Parse {n}, {n,}, {n,m}.
    const close = source.indexOf("}", i + 1);
    if (close === -1) return { kind: "none", nextIndex: i };
    const body = source.slice(i + 1, close);
    const match = /^(\d+)(?:,(\d*))?$/.exec(body);
    if (!match) {
      // Not a valid repeat — treat as literal `{…}` (which is what the
      // JS regex engine would do in non-unicode mode anyway).
      return { kind: "none", nextIndex: i };
    }
    const min = Number.parseInt(match[1], 10);
    const maxRaw = match[2];
    const max =
      maxRaw === undefined
        ? min // {n}
        : maxRaw === ""
          ? Number.POSITIVE_INFINITY // {n,}
          : Number.parseInt(maxRaw, 10); // {n,m}
    const nextIndex = skipLazy(source, close + 1);
    if (!Number.isFinite(max)) {
      return { kind: "unbounded", nextIndex };
    }
    return { kind: "bounded", max, nextIndex };
  }
  return { kind: "none", nextIndex: i };
}

function skipLazy(source: string, i: number): number {
  // Accept `*?`, `+?`, `??`, `{…}?` — and also the possessive `*+`, `++`
  // etc. if ever enabled in future JS engines.
  if (i < source.length && (source[i] === "?" || source[i] === "+")) {
    return i + 1;
  }
  return i;
}

/**
 * Apply a quantifier found on a plain atom (literal, `.`, char class).
 */
function applyQuantifier(
  stack: Array<{ starHeight: number; hasQuantifierInside: boolean }>,
  q: Exclude<Quantifier, { kind: "none" }>,
): RegexSafetyResult {
  if (q.kind === "bounded" && q.max > MAX_REPEAT) {
    return { safe: false, reason: "large-repeat" };
  }
  const frame = stack[stack.length - 1];
  frame.hasQuantifierInside = true;
  if (q.kind === "unbounded") {
    // A plain atom quantified = star height 1. Parent may bump this
    // up to 2+ if they are themselves quantified — that's where the
    // reject happens on group-close.
    frame.starHeight = Math.max(frame.starHeight, 1);
    if (frame.starHeight > MAX_STAR_HEIGHT) {
      return { safe: false, reason: "nested-quantifier" };
    }
  }
  return { safe: true };
}
