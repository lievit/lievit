/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * timeline.jte + timeline/item.jte -- structural + a11y + CSP contract (source-text asserts;
 * real-compiler smoke in test/jte-compile). Pins the ordered-list semantics, the dot colour
 * intents, the connector-suppression on the last item, the decorative rail, and CSP hygiene.
 */
import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const dir = join(import.meta.dirname, "..", "registry", "jte", "timeline");
const wrapper = readFileSync(join(dir, "..", "timeline.jte"), "utf8");
const item = readFileSync(join(dir, "item.jte"), "utf8");
const wMarkup = wrapper.replace(/<%--[\s\S]*?--%>/g, "");
const iMarkup = item.replace(/<%--[\s\S]*?--%>/g, "");

describe("timeline wrapper -- ordered list semantics", () => {
  test("renders a native <ol data-slot=timeline> (ordered sequence)", () => {
    expect(wMarkup).toContain("<ol");
    expect(wMarkup).toContain('data-slot="timeline"');
  });
  test("reverse uses column-reverse (visual only, source order preserved for AT)", () => {
    expect(wrapper).toContain("@param boolean reverse = false");
    expect(wMarkup).toContain("flex-col-reverse");
  });
});

describe("timeline.item -- node + content", () => {
  test("declares color/label/dot/last params", () => {
    expect(item).toContain('@param String color = "primary"');
    expect(item).toContain("@param String label = null");
    expect(item).toContain("@param gg.jte.Content dot = null");
    expect(item).toContain("@param boolean last = false");
  });
  test("renders an <li> with semantic dot colour intents (raw colour falls through)", () => {
    expect(iMarkup).toContain("<li");
    expect(item).toContain("var(--lv-color-success)");
    expect(item).toContain("var(--lv-color-primary)");
    expect(item).toMatch(/default\s+->\s+color/);
  });
  test("the connector is suppressed on the last item", () => {
    expect(iMarkup).toContain("@if(!last)");
    expect(iMarkup).toContain('data-slot="timeline-connector"');
  });
  test("the rail (dot + connector) is aria-hidden decoration", () => {
    expect(iMarkup).toMatch(/data-slot="timeline-rail"[\s\S]*?aria-hidden="true"/);
  });
});

describe("timeline -- token + CSP hygiene", () => {
  test("no hardcoded hex and no inline script/handler", () => {
    for (const m of [wMarkup, iMarkup]) {
      expect(m).not.toMatch(/#[0-9a-fA-F]{3,6}/);
      expect(m).not.toMatch(/\son[a-z]+=/i);
    }
    expect(wrapper).not.toMatch(/<script/i);
    expect(item).not.toMatch(/<script/i);
  });
});
