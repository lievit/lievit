/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * A tiny, CSP-safe expression grammar for `l:show` (issue #79) — explicitly NOT Alpine and NOT
 * `eval`. lievit keeps domain state on the server (wire-protocol.md §1), so a client-side `l:show`
 * needs only enough grammar to toggle visibility from values the client already holds: the
 * component's live `l:model` values and an optional comparison to a literal.
 *
 * Supported grammar (deliberately small — "the dumbest thing that works"):
 *
 * ```
 *   expr      := "!" expr                       // negation
 *              | term ("==" | "!=") literal      // comparison
 *              | term                            // truthiness
 *   term      := identifier                      // a model field / scope key
 *   literal   := "'" chars "'" | '"' chars '"'   // quoted string
 *              | number | "true" | "false" | "null"
 * ```
 *
 * Anything outside this grammar throws {@link ShowExpressionError}; the directive treats a parse
 * error as "always visible" and reports it, never executing arbitrary code. There is no member
 * access, no function call, no arithmetic: those would be the door to an injection surface this
 * grammar is built to keep shut.
 */

/** Thrown when an `l:show` expression is outside the supported grammar (never executed as code). */
export class ShowExpressionError extends Error {}

/** A value scope: the identifiers an expression may reference (the component's live model values). */
export type ShowScope = Readonly<Record<string, unknown>>;

type Comparison = { readonly kind: "cmp"; readonly id: string; readonly op: "==" | "!="; readonly literal: unknown };
type Truthy = { readonly kind: "truthy"; readonly id: string };
type Negate = { readonly kind: "not"; readonly inner: ShowExpr };
type ShowExpr = Comparison | Truthy | Negate;

const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;

/**
 * Parses an `l:show` expression string into an evaluable tree (cached by the caller per element).
 *
 * @param raw the attribute value (e.g. `"!open"`, `"tab == 'details'"`, `"count"`)
 * @returns the parsed expression
 * @throws ShowExpressionError when the string is outside the grammar
 */
export function parseShowExpression(raw: string): ShowExpr {
  const text = raw.trim();
  if (text.length === 0) {
    throw new ShowExpressionError("empty l:show expression");
  }
  if (text.startsWith("!")) {
    return { kind: "not", inner: parseShowExpression(text.slice(1)) };
  }
  for (const op of ["==", "!="] as const) {
    const i = text.indexOf(op);
    if (i > 0) {
      const id = text.slice(0, i).trim();
      const lit = text.slice(i + op.length).trim();
      assertIdentifier(id);
      return { kind: "cmp", id, op, literal: parseLiteral(lit) };
    }
  }
  assertIdentifier(text);
  return { kind: "truthy", id: text };
}

/**
 * Evaluates a parsed `l:show` expression against a scope.
 *
 * @param expr the parsed expression
 * @param scope the identifier → value map (the component's live model values)
 * @returns whether the element should be shown
 */
export function evaluateShowExpression(expr: ShowExpr, scope: ShowScope): boolean {
  switch (expr.kind) {
    case "not":
      return !evaluateShowExpression(expr.inner, scope);
    case "truthy":
      return isTruthy(scope[expr.id]);
    case "cmp": {
      const eq = looseEquals(scope[expr.id], expr.literal);
      return expr.op === "==" ? eq : !eq;
    }
  }
}

function assertIdentifier(id: string): void {
  if (!IDENTIFIER.test(id)) {
    throw new ShowExpressionError(`l:show identifier must be a bare name, got: ${JSON.stringify(id)}`);
  }
}

function parseLiteral(raw: string): unknown {
  if (
    (raw.startsWith("'") && raw.endsWith("'")) ||
    (raw.startsWith('"') && raw.endsWith('"'))
  ) {
    return raw.slice(1, -1);
  }
  if (raw === "true") return true;
  if (raw === "false") return false;
  if (raw === "null") return null;
  if (/^-?\d+(\.\d+)?$/.test(raw)) {
    return Number(raw);
  }
  throw new ShowExpressionError(`unsupported l:show literal: ${JSON.stringify(raw)}`);
}

/** Truthiness with form-friendly coercion: the strings "false"/"0"/"" are falsy, like checkbox state. */
function isTruthy(value: unknown): boolean {
  if (typeof value === "string") {
    return value !== "" && value !== "false" && value !== "0";
  }
  return Boolean(value);
}

/** Loose equality that coerces a string scope value to the literal's type (model values are strings). */
function looseEquals(value: unknown, literal: unknown): boolean {
  if (typeof literal === "number" && typeof value === "string") {
    return Number(value) === literal;
  }
  if (typeof literal === "boolean" && typeof value === "string") {
    return (value === "true") === literal;
  }
  return value === literal;
}
