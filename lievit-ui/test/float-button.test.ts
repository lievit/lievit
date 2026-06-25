/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * float-button.jte + float-button/group.jte -- structural + a11y + CSP contract (source-text
 * asserts; real-compiler smoke in test/jte-compile). Pins the href polymorphism (<a> vs <button>),
 * the icon reuse, the REQUIRED accessible name, the fixed-corner positioning, the group stacking,
 * and CSP hygiene.
 */
import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const dir = join(import.meta.dirname, "..", "registry", "jte", "float-button");
const btn = readFileSync(join(dir, "..", "float-button.jte"), "utf8");
const group = readFileSync(join(dir, "group.jte"), "utf8");
const bMarkup = btn.replace(/<%--[\s\S]*?--%>/g, "");
const gMarkup = group.replace(/<%--[\s\S]*?--%>/g, "");

describe("float-button -- param API", () => {
  test("declares icon/label/href/type/shape/position/floating + badge slot", () => {
    expect(btn).toContain("@param String icon = null");
    expect(btn).toContain("@param String label = null");
    expect(btn).toContain("@param String href = null");
    expect(btn).toContain('@param String type = "default"');
    expect(btn).toContain('@param String shape = "circle"');
    expect(btn).toContain('@param String position = "bottom-right"');
    expect(btn).toContain("@param boolean floating = true");
    expect(btn).toContain("@param gg.jte.Content badge = null");
  });
});

describe("float-button -- href polymorphism + a11y", () => {
  test("renders <a href> when href is non-blank, else a <button type=button>", () => {
    expect(btn).toContain("href != null && !href.isBlank()");
    expect(bMarkup).toContain("@if(isLink)");
    expect(bMarkup).toContain("<a");
    expect(bMarkup).toContain('<button\n  type="button"');
  });
  test("label becomes the accessible name (aria-label) for the icon-only FAB", () => {
    expect(bMarkup).toContain('aria-label="${label}"');
  });
  test("reuses the lievit icon primitive for the glyph", () => {
    expect(bMarkup).toContain("@template.lievit.icon(name = icon");
  });
  test("floating pins a fixed corner; nested-in-group buttons are static", () => {
    expect(btn).toContain("!floating ? \"\"");
    expect(btn).toContain("position:fixed");
  });
});

describe("float-button.group -- stacked FABs", () => {
  test("is a role=group with an accessible name and a stacking direction", () => {
    expect(gMarkup).toContain('role="group"');
    expect(gMarkup).toContain('aria-label="${ariaLabel}"');
    expect(group).toContain('@param String direction = "vertical"');
  });
  test("the group owns the fixed-position inset", () => {
    expect(gMarkup).toContain("position:fixed");
  });
});

describe("float-button -- token + CSP hygiene", () => {
  test("no hardcoded hex and no inline script/handler in either file", () => {
    for (const m of [bMarkup, gMarkup]) {
      expect(m).not.toMatch(/#[0-9a-fA-F]{3,6}/);
      expect(m).not.toMatch(/\son[a-z]+=/i);
    }
    expect(btn).not.toMatch(/<script/i);
    expect(group).not.toMatch(/<script/i);
  });
});
