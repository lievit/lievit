/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
import { describe, expect, it } from "vitest";

import { ExpressionError, evaluate, parseExpression, truthy } from "../runtime/expression.js";

describe("CSP-safe expression evaluation (#127)", () => {
  describe("the legacy l:show grammar (superset, must keep passing)", () => {
    it("truthiness of a bare identifier (via truthy, the l:show coercion)", () => {
      expect(truthy(evaluate("open", { open: true }))).toBe(true);
      expect(truthy(evaluate("open", { open: "" }))).toBe(false);
    });
    it("negation", () => {
      expect(evaluate("!open", { open: false })).toBe(true);
    });
    it("equality to a string literal", () => {
      expect(evaluate("tab == 'details'", { tab: "details" })).toBe(true);
      expect(evaluate("tab != 'details'", { tab: "summary" })).toBe(true);
    });
    it("number-vs-string coercion", () => {
      expect(evaluate("count == 5", { count: "5" })).toBe(true);
    });
  });

  describe("the richer mode (#127): relational + boolean logic + parens", () => {
    it("relational operators coerce strings to numbers", () => {
      expect(evaluate("count > 3", { count: "5" })).toBe(true);
      expect(evaluate("count <= 3", { count: "3" })).toBe(true);
      expect(evaluate("count < 3", { count: 5 })).toBe(false);
    });
    it("&& and || with precedence", () => {
      expect(evaluate("a && b", { a: true, b: true })).toBe(true);
      expect(evaluate("a && b", { a: true, b: false })).toBe(false);
      expect(evaluate("a || b", { a: false, b: true })).toBe(true);
    });
    it("parentheses override precedence", () => {
      expect(evaluate("(a || b) && c", { a: true, b: false, c: false })).toBe(false);
      expect(evaluate("(a || b) && c", { a: true, b: false, c: true })).toBe(true);
    });
    it("dotted paths read nested scope values", () => {
      expect(evaluate("user.role == 'admin'", { user: { role: "admin" } })).toBe(true);
    });
    it("boolean literal comparison coerces a string field", () => {
      expect(evaluate("agreed == true", { agreed: "true" })).toBe(true);
    });
  });

  describe("CSP safety: anything outside the grammar throws, never executes", () => {
    it("rejects a function call", () => {
      expect(() => parseExpression("alert(1)")).toThrow(ExpressionError);
    });
    it("rejects bracket indexing", () => {
      expect(() => parseExpression("window['x']")).toThrow(ExpressionError);
    });
    it("rejects arithmetic", () => {
      expect(() => parseExpression("a + b")).toThrow(ExpressionError);
    });
    it("rejects an empty expression", () => {
      expect(() => parseExpression("   ")).toThrow(ExpressionError);
    });
    it("rejects an unterminated string", () => {
      expect(() => parseExpression("x == 'oops")).toThrow(ExpressionError);
    });
    it("rejects an arrow function (the canonical inline-JS attack, #127)", () => {
      expect(() => parseExpression("() => fetch('/x')")).toThrow(ExpressionError);
      expect(() => parseExpression("x => x.evil")).toThrow(ExpressionError);
    });
    it("rejects an IIFE (#127)", () => {
      expect(() => parseExpression("(function(){return 1})()")).toThrow(ExpressionError);
    });
    it("rejects member access into a global (no escape to window/document, #127)", () => {
      expect(() => parseExpression("document.cookie")).not.toThrow();
      // a dotted path is a *scope* read, never a global: it resolves against the flat scope only.
      expect(evaluate("document.cookie", {})).toBeUndefined();
    });
    it("rejects assignment / sequence operators (#127)", () => {
      expect(() => parseExpression("x = 1")).toThrow(ExpressionError);
      expect(() => parseExpression("a, b")).toThrow(ExpressionError);
    });
  });
});
