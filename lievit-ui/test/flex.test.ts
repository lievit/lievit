/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * flex.jte -- structural + a11y + CSP contract. The flex partial is a static JTE partial
 * compiled in the Java world (the real-compiler smoke lives in test/jte-compile). This suite
 * asserts on the PARTIAL SOURCE as text: the param API, the flexbox utility mapping, the
 * token-driven gap scale, the data-slot topology, and CSP hygiene.
 */
import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const src = readFileSync(join(import.meta.dirname, "..", "registry", "jte", "flex.jte"), "utf8");
const markup = src.replace(/<%--[\s\S]*?--%>/g, "");

describe("flex -- param API", () => {
  test("declares the layout params with Ant-parity defaults", () => {
    expect(src).toContain("@param gg.jte.Content content");
    expect(src).toContain("@param boolean vertical = false");
    expect(src).toContain('@param String justify = "start"');
    expect(src).toContain('@param String align = "stretch"');
    expect(src).toContain('@param String gap = "middle"');
    expect(src).toContain("@param boolean wrap = false");
    expect(src).toContain("@param boolean inline = false");
  });
});

describe("flex -- render contract", () => {
  test("renders a single <div data-slot=flex> (no dynamic tag name)", () => {
    expect(markup).toContain('data-slot="flex"');
    expect(markup).not.toMatch(/<\$\{/);
  });
  test("maps justify/align keywords onto flex utilities", () => {
    expect(markup).toContain("justify-between");
    expect(markup).toContain("items-center");
    expect(markup).toContain("flex-col");
  });
  test("gap keyword maps onto the --lv-space-* token scale", () => {
    expect(src).toContain("var(--lv-space-2)");
    expect(src).toContain("var(--lv-space-4)");
    expect(src).toContain("var(--lv-space-6)");
  });
  test("a non-keyword gap falls through to a raw length (verbatim)", () => {
    expect(src).toContain("gapToken != null ? gapToken : gap");
  });
});

describe("flex -- token + CSP hygiene", () => {
  test("no hardcoded hex colour", () => {
    expect(markup).not.toMatch(/#[0-9a-fA-F]{3,6}/);
  });
  test("no inline <script> and no inline on*= handler (CSP)", () => {
    expect(src).not.toMatch(/<script/i);
    expect(markup).not.toMatch(/\son[a-z]+=/i);
  });
});
