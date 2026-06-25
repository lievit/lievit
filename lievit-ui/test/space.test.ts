/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * space.jte -- structural + CSP contract (source-text asserts; real-compiler smoke in
 * test/jte-compile). Pins the param API, the direction/size mapping, the token gap scale,
 * and CSP hygiene.
 */
import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const src = readFileSync(join(import.meta.dirname, "..", "registry", "jte", "space.jte"), "utf8");
const markup = src.replace(/<%--[\s\S]*?--%>/g, "");

describe("space -- param API", () => {
  test("declares Ant-parity params", () => {
    expect(src).toContain("@param gg.jte.Content content");
    expect(src).toContain('@param String direction = "horizontal"');
    expect(src).toContain('@param String size = "small"');
    expect(src).toContain('@param String align = "center"');
    expect(src).toContain("@param boolean wrap = true");
  });
});

describe("space -- render contract", () => {
  test("renders a div data-slot=space with data-direction", () => {
    expect(markup).toContain('data-slot="space"');
    expect(markup).toContain('data-direction="${direction}"');
  });
  test("vertical stacks never wrap; horizontal honours wrap", () => {
    expect(src).toContain("(!vertical && wrap)");
  });
  test("size keyword maps onto the --lv-space-* token scale, raw length falls through", () => {
    expect(src).toContain("var(--lv-space-2)");
    expect(src).toContain("var(--lv-space-6)");
    expect(src).toContain("sizeToken != null ? sizeToken : size");
  });
});

describe("space -- token + CSP hygiene", () => {
  test("no hardcoded hex and no inline script/handler", () => {
    expect(markup).not.toMatch(/#[0-9a-fA-F]{3,6}/);
    expect(src).not.toMatch(/<script/i);
    expect(markup).not.toMatch(/\son[a-z]+=/i);
  });
});
