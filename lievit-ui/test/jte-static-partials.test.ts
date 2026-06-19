/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * Golden / structural checks for the static JTE partials (registry/jte/*.jte).
 *
 * The partials are plain JTE source the adopter copies in; this Node package has no JTE
 * compiler, so the load-bearing contract is pinned two ways:
 *   1. Structurally here (semantic element, tokens, no inline <script>, declared @param,
 *      correct JTE comment syntax) so a regression in the source is caught in CI.
 *   2. By an out-of-band real-compiler smoke (jte 3.2.4 precompileAll + render asserts)
 *      run during authoring; see the commit log. These structural checks mirror what that
 *      smoke proved so the invariants survive without the JVM on the Node CI path.
 */
import { describe, test, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const jteRoot = join(import.meta.dirname, "..", "registry", "jte");
const read = (rel: string) => readFileSync(join(jteRoot, rel), "utf8");

const ALL = [
  "skeleton.jte",
  "aspect-ratio.jte",
  "kbd.jte",
  "table.jte",
  "table/header.jte",
  "table/body.jte",
  "table/footer.jte",
  "table/row.jte",
  "table/head.jte",
  "table/cell.jte",
  "table/caption.jte",
] as const;

describe("static JTE partials: house rules", () => {
  test.each(ALL)("%s exists", (f) => {
    expect(existsSync(join(jteRoot, f)), `${f} must exist`).toBe(true);
  });

  test.each(ALL)("%s never ships an inline <script> (CSP)", (f) => {
    expect(read(f)).not.toMatch(/<script/i);
  });

  test.each(ALL)("%s uses JTE comment syntax <%-- --%>, not @* *@", (f) => {
    // @* *@ is NOT a JTE comment; it compiles as content and breaks the build.
    expect(read(f)).not.toMatch(/@\*/);
  });

  test.each(ALL)("%s has no em-dash (house rule)", (f) => {
    expect(read(f)).not.toContain("—"); // U+2014 EM DASH
  });

  test.each(ALL)("%s carries a usage doc comment at the top", (f) => {
    expect(read(f)).toMatch(/<%--[\s\S]*?--%>/);
  });
});

describe("skeleton.jte", () => {
  const src = read("skeleton.jte");
  test("declares its params", () => {
    for (const p of ["shape", "width", "height", "klass", "label"]) {
      expect(src).toMatch(new RegExp(`@param String ${p}`));
    }
  });
  test("is an aria-live status with a pulse animation", () => {
    expect(src).toContain('role="status"');
    expect(src).toContain('aria-busy="true"');
    expect(src).toContain("animate-pulse");
  });
  test("draws its fill from the muted token, not a hardcoded colour", () => {
    expect(src).toContain("var(--lv-color-muted)");
    expect(src).not.toMatch(/#[0-9a-fA-F]{3,6}/);
  });
});

describe("aspect-ratio.jte", () => {
  const src = read("aspect-ratio.jte");
  test("takes a ratio param and a Content child", () => {
    expect(src).toMatch(/@param String ratio/);
    expect(src).toMatch(/@param gg\.jte\.Content content/);
  });
  test("uses the native CSS aspect-ratio property (not the padding-bottom hack)", () => {
    expect(src).toContain("aspect-ratio:${ratio}");
    // check the MARKUP only (the doc comment mentions the legacy hack on purpose)
    const markup = src.replace(/<%--[\s\S]*?--%>/g, "");
    expect(markup).not.toContain("padding-bottom");
  });
  test("renders the slotted content", () => {
    expect(src).toContain("${content}");
  });
});

describe("kbd.jte", () => {
  const src = read("kbd.jte");
  test("renders the semantic <kbd> element", () => {
    expect(src).toMatch(/<kbd[\s>]/);
    expect(src).toContain("</kbd>");
  });
  test("content takes precedence over the key string", () => {
    expect(src).toContain("@if(content != null)${content}@else${key}@endif");
  });
  test("is non-selectable and token-styled", () => {
    expect(src).toContain("select-none");
    expect(src).toContain("var(--lv-color-surface)");
    expect(src).toContain("var(--lv-color-border)");
  });
});

describe("table.jte (composable set)", () => {
  test("the entry wraps a real <table> in a horizontal-scroll container", () => {
    const src = read("table.jte");
    expect(src).toContain("overflow-x-auto");
    expect(src).toMatch(/<table[\s\n]/);
    expect(src).toContain("${content}");
  });
  test("ships the full shadcn part set", () => {
    for (const part of ["header", "body", "footer", "row", "head", "cell", "caption"]) {
      expect(existsSync(join(jteRoot, "table", `${part}.jte`)), `table/${part}.jte`).toBe(true);
    }
  });
  test("uses the correct semantic element per part", () => {
    expect(read("table/header.jte")).toMatch(/<thead[\s>]/);
    expect(read("table/body.jte")).toMatch(/<tbody[\s>]/);
    expect(read("table/footer.jte")).toMatch(/<tfoot[\s>]/);
    expect(read("table/row.jte")).toMatch(/<tr[\s\n]/);
    expect(read("table/head.jte")).toMatch(/<th[\s\n]/);
    expect(read("table/cell.jte")).toMatch(/<td[\s>]/);
    expect(read("table/caption.jte")).toMatch(/<caption[\s>]/);
  });
  test("head cell carries a scope (accessible header association)", () => {
    const head = read("table/head.jte");
    expect(head).toMatch(/@param String scope/);
    expect(head).toContain('scope="${scope}"');
  });
  test("row selection uses a smart attribute (null = attribute dropped), not @if in name position", () => {
    const row = read("table/row.jte");
    expect(row).toContain('data-state="${state.isEmpty() ? null : state}"');
    expect(row).not.toMatch(/@if\([^)]*\)data-state/);
  });
});
