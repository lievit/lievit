/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * The CSP-safe expression evaluation mode (#127): a small, deterministic expression grammar that
 * directives (`l:show`, conditional `l:bind`, `l:text` guards) evaluate against the values the
 * client already holds (the component's ephemeral `@Wire` mirror), with NO `eval`, NO `new Function`,
 * and NO inline handler. It is explicitly NOT Alpine and NOT a general JS subset: lievit keeps domain
 * state on the server (wire-protocol.md §1), so the client only needs enough grammar to derive view
 * state (visibility, a boolean attribute, a class toggle) from a handful of fields.
 *
 * Supported grammar (recursive-descent, precedence low→high):
 *
 * ```
 *   expr     := or
 *   or       := and ("||" and)*
 *   and      := compare ("&&" compare)*
 *   compare  := unary (("==" | "!=" | ">=" | "<=" | ">" | "<") unary)?
 *   unary    := "!" unary | primary
 *   primary  := "(" expr ")" | identifier | literal
 *   literal  := quoted-string | number | "true" | "false" | "null"
 * ```
 *
 * There is deliberately no member access, no function call, no arithmetic, no indexing, no string
 * concatenation: each would be the door to an injection surface this grammar exists to keep shut.
 * Anything outside the grammar throws {@link ExpressionError}; a directive treats a parse error as a
 * safe default (e.g. `l:show` stays visible) and reports it, never executing arbitrary code.
 *
 * Identifiers resolve against a flat {@link ExprScope} (the field → value map a feature maintains).
 * Coercion is form-friendly: a `@Wire` value arrives as a string, so a comparison to a number or a
 * boolean literal coerces the string side (`"5" > 3` is true, `"true" == true` is true).
 */

/** Thrown when an expression is outside the supported CSP-safe grammar (never executed as code). */
export class ExpressionError extends Error {}

/** A flat value scope: the identifiers an expression may reference and their current values. */
export type ExprScope = Readonly<Record<string, unknown>>;

type Node =
  | { kind: "lit"; value: unknown }
  | { kind: "id"; name: string }
  | { kind: "not"; inner: Node }
  | { kind: "bin"; op: BinaryOp; left: Node; right: Node };

type BinaryOp = "||" | "&&" | "==" | "!=" | ">=" | "<=" | ">" | "<";

const IDENTIFIER = /^[A-Za-z_$][\w$.]*$/;

/* ---------------------------------------------------------------------------------------------- */
/* Tokenizer                                                                                       */
/* ---------------------------------------------------------------------------------------------- */

type Token = { type: "op"; value: string } | { type: "paren"; value: "(" | ")" } | { type: "atom"; value: string };

const OPERATORS = ["||", "&&", "==", "!=", ">=", "<=", ">", "<", "!"];

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < input.length) {
    const c = input[i]!;
    if (c === " " || c === "\t" || c === "\n") {
      i++;
      continue;
    }
    if (c === "(" || c === ")") {
      tokens.push({ type: "paren", value: c });
      i++;
      continue;
    }
    if (c === "'" || c === '"') {
      const end = input.indexOf(c, i + 1);
      if (end < 0) {
        throw new ExpressionError(`unterminated string literal in: ${JSON.stringify(input)}`);
      }
      tokens.push({ type: "atom", value: input.slice(i, end + 1) });
      i = end + 1;
      continue;
    }
    const op = OPERATORS.find((o) => input.startsWith(o, i));
    if (op != null) {
      tokens.push({ type: "op", value: op });
      i += op.length;
      continue;
    }
    // An atom: an identifier or a numeric/keyword literal — read up to the next operator/paren/space.
    let j = i;
    while (j < input.length) {
      const ch = input[j]!;
      if (ch === " " || ch === "(" || ch === ")" || ch === "'" || ch === '"') {
        break;
      }
      if (OPERATORS.some((o) => input.startsWith(o, j))) {
        break;
      }
      j++;
    }
    tokens.push({ type: "atom", value: input.slice(i, j) });
    i = j;
  }
  return tokens;
}

/* ---------------------------------------------------------------------------------------------- */
/* Parser (recursive descent)                                                                      */
/* ---------------------------------------------------------------------------------------------- */

/** A parsed, evaluable expression (opaque: pass it to {@link evaluateExpression}). */
export interface ParsedExpression {
  readonly node: Node;
}

/**
 * Parses an expression string into an evaluable tree (cache it per element).
 *
 * @param raw the expression source
 * @returns the parsed expression
 * @throws ExpressionError when the string is outside the grammar
 */
export function parseExpression(raw: string): ParsedExpression {
  const tokens = tokenize(raw);
  if (tokens.length === 0) {
    throw new ExpressionError("empty expression");
  }
  let pos = 0;

  const peek = (): Token | undefined => tokens[pos];
  const next = (): Token | undefined => tokens[pos++];

  function parseOr(): Node {
    let left = parseAnd();
    while (peek()?.type === "op" && peek()!.value === "||") {
      next();
      left = { kind: "bin", op: "||", left, right: parseAnd() };
    }
    return left;
  }
  function parseAnd(): Node {
    let left = parseCompare();
    while (peek()?.type === "op" && peek()!.value === "&&") {
      next();
      left = { kind: "bin", op: "&&", left, right: parseCompare() };
    }
    return left;
  }
  function parseCompare(): Node {
    const left = parseUnary();
    const t = peek();
    if (t?.type === "op" && ["==", "!=", ">=", "<=", ">", "<"].includes(t.value)) {
      next();
      return { kind: "bin", op: t.value as BinaryOp, left, right: parseUnary() };
    }
    return left;
  }
  function parseUnary(): Node {
    const t = peek();
    if (t?.type === "op" && t.value === "!") {
      next();
      return { kind: "not", inner: parseUnary() };
    }
    return parsePrimary();
  }
  function parsePrimary(): Node {
    const t = next();
    if (t == null) {
      throw new ExpressionError("unexpected end of expression");
    }
    if (t.type === "paren" && t.value === "(") {
      const inner = parseOr();
      const closing = next();
      if (closing == null || closing.type !== "paren" || closing.value !== ")") {
        throw new ExpressionError("missing closing parenthesis");
      }
      return inner;
    }
    if (t.type === "atom") {
      return atomNode(t.value);
    }
    throw new ExpressionError(`unexpected token: ${JSON.stringify(t.value)}`);
  }

  const node = parseOr();
  if (pos !== tokens.length) {
    throw new ExpressionError(`trailing tokens after expression: ${JSON.stringify(raw)}`);
  }
  return { node };
}

/** Classifies a bare atom as a literal or an identifier. */
function atomNode(atom: string): Node {
  const lit = literalOf(atom);
  if (lit !== NOT_A_LITERAL) {
    return { kind: "lit", value: lit };
  }
  if (!IDENTIFIER.test(atom)) {
    throw new ExpressionError(`invalid identifier or literal: ${JSON.stringify(atom)}`);
  }
  return { kind: "id", name: atom };
}

const NOT_A_LITERAL = Symbol("not-a-literal");

function literalOf(token: string): unknown {
  if ((token.startsWith("'") && token.endsWith("'")) || (token.startsWith('"') && token.endsWith('"'))) {
    return token.slice(1, -1);
  }
  if (token === "true") return true;
  if (token === "false") return false;
  if (token === "null") return null;
  if (/^-?\d+(\.\d+)?$/.test(token)) {
    return Number(token);
  }
  return NOT_A_LITERAL;
}

/* ---------------------------------------------------------------------------------------------- */
/* Evaluator                                                                                       */
/* ---------------------------------------------------------------------------------------------- */

/**
 * Evaluates a parsed expression against a scope.
 *
 * @param expr the parsed expression
 * @param scope the identifier → value map
 * @returns the expression's value (a boolean for logical/comparison expressions)
 */
export function evaluateExpression(expr: ParsedExpression, scope: ExprScope): unknown {
  return evalNode(expr.node, scope);
}

function evalNode(node: Node, scope: ExprScope): unknown {
  switch (node.kind) {
    case "lit":
      return node.value;
    case "id":
      return readPath(scope, node.name);
    case "not":
      return !truthy(evalNode(node.inner, scope));
    case "bin":
      return evalBinary(node, scope);
  }
}

function evalBinary(node: { op: BinaryOp; left: Node; right: Node }, scope: ExprScope): unknown {
  if (node.op === "&&") {
    return truthy(evalNode(node.left, scope)) && truthy(evalNode(node.right, scope));
  }
  if (node.op === "||") {
    return truthy(evalNode(node.left, scope)) || truthy(evalNode(node.right, scope));
  }
  const left = evalNode(node.left, scope);
  const right = evalNode(node.right, scope);
  switch (node.op) {
    case "==":
      return looseEquals(left, right);
    case "!=":
      return !looseEquals(left, right);
    case ">":
      return toNumber(left) > toNumber(right);
    case "<":
      return toNumber(left) < toNumber(right);
    case ">=":
      return toNumber(left) >= toNumber(right);
    case "<=":
      return toNumber(left) <= toNumber(right);
  }
}

/** Reads a (possibly dotted) path off the scope; a missing segment yields undefined. */
function readPath(scope: ExprScope, path: string): unknown {
  if (!path.includes(".")) {
    return scope[path];
  }
  let current: unknown = scope;
  for (const segment of path.split(".")) {
    if (current == null || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

/** Form-friendly truthiness: the strings "false"/"0"/"" are falsy (like a checkbox / select value). */
export function truthy(value: unknown): boolean {
  if (typeof value === "string") {
    return value !== "" && value !== "false" && value !== "0";
  }
  return Boolean(value);
}

/** Loose equality that coerces a string scope value to the literal's type (wire values are strings). */
function looseEquals(a: unknown, b: unknown): boolean {
  if (typeof a === "number" && typeof b === "string") return Number(b) === a;
  if (typeof b === "number" && typeof a === "string") return Number(a) === b;
  if (typeof a === "boolean" && typeof b === "string") return (b === "true") === a;
  if (typeof b === "boolean" && typeof a === "string") return (a === "true") === b;
  return a === b;
}

/** Coerces a value to a number for a relational comparison (a non-numeric string yields NaN). */
function toNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "string" && value.trim() !== "") return Number(value);
  return Number.NaN;
}

/**
 * One-shot parse + evaluate convenience (a feature that does not cache the parse uses it).
 *
 * @param raw the expression source
 * @param scope the identifier → value map
 * @returns the expression's value
 * @throws ExpressionError on a malformed expression
 */
export function evaluate(raw: string, scope: ExprScope): unknown {
  return evaluateExpression(parseExpression(raw), scope);
}
