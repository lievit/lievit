/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * typography/{title,text,paragraph}.jte -- structural + a11y + CSP contract (source-text asserts;
 * real-compiler smoke in test/jte-compile). Pins that each emphasis maps to the correct SEMANTIC
 * element (heading level, strong/em/del/u/mark/code/kbd), the colour intents are token-driven,
 * and there is no hardcoded hex or inline handler.
 */
import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const dir = join(import.meta.dirname, "..", "registry", "jte", "typography");
const title = readFileSync(join(dir, "title.jte"), "utf8");
const text = readFileSync(join(dir, "text.jte"), "utf8");
const paragraph = readFileSync(join(dir, "paragraph.jte"), "utf8");
const strip = (s: string) => s.replace(/<%--[\s\S]*?--%>/g, "");

describe("typography.title -- semantic heading by level", () => {
  test("declares level int param + colour type", () => {
    expect(title).toContain("@param int level = 1");
    expect(title).toContain('@param String type = "default"');
  });
  test("clamps level to 1..5 and renders a real <h1>..<h5> per level (no dynamic tag)", () => {
    expect(title).toContain("Math.max(1, Math.min(5, level))");
    const m = strip(title);
    for (const tag of ["<h1", "<h2", "<h3", "<h4", "<h5"]) {
      expect(m).toContain(tag);
    }
    expect(m).not.toMatch(/<\$\{/);
  });
});

describe("typography.text -- emphasis maps to a semantic element", () => {
  test("declares the emphasis flags", () => {
    for (const p of ["strong", "italic", "underline", "delete", "mark", "code", "keyboard"]) {
      expect(text).toContain(`@param boolean ${p} = false`);
    }
  });
  test("each emphasis renders its correct semantic element", () => {
    const m = strip(text);
    for (const tag of ["<strong", "<em", "<del", "<u ", "<mark", "<code", "<kbd"]) {
      expect(m).toContain(tag);
    }
  });
});

describe("typography.paragraph -- body block with line-clamp", () => {
  test("declares clamp int param and maps 1..6 to a static line-clamp utility", () => {
    expect(paragraph).toContain("@param int clamp = 0");
    expect(paragraph).toContain("line-clamp-2");
    expect(paragraph).toContain("line-clamp-6");
  });
  test("renders a real <p data-slot=paragraph>", () => {
    expect(strip(paragraph)).toContain('<p');
    expect(strip(paragraph)).toContain('data-slot="paragraph"');
  });
});

describe("typography -- token + CSP hygiene", () => {
  test("no hardcoded hex, no inline script/handler in any file", () => {
    for (const s of [title, text, paragraph]) {
      expect(strip(s)).not.toMatch(/#[0-9a-fA-F]{3,6}/);
      expect(s).not.toMatch(/<script/i);
      expect(strip(s)).not.toMatch(/\son[a-z]+=/i);
    }
  });
  test("colour intents are token-driven (muted-fg / success / warning / danger)", () => {
    expect(title).toContain("var(--lv-color-muted-fg)");
    expect(text).toContain("var(--lv-color-danger)");
  });
});
