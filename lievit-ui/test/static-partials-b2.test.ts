/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * Static JTE partials, batch b2 (issues #438 pagination, #437 native-select,
 * #429 alert-dialog). These are presentational .jte partials compiled in the Java world,
 * so -- as with static-partials-b1 -- the harness asserts on the partial SOURCE as text:
 * it pins the token-driven styling (every colour/space/radius reads a --lv-* var, never a
 * hardcoded value), the accessibility contract (roles/aria), the slot/param API, that
 * icons go through the Lucide partial (never Font Awesome), and the correct comment syntax
 * (<%-- --%>, not @* *@). A render/golden in the Java runtime is out of scope for the JS
 * suite; this is the equivalent structural golden the planning DONE criteria asks for.
 */
import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const jteDir = join(import.meta.dirname, "..", "registry", "jte");
const read = (name: string) => readFileSync(join(jteDir, `${name}.jte`), "utf8");

const PARTIALS = ["pagination", "native-select", "alert-dialog"];

/** Tailwind utilities that legitimately carry a fractional / fixed geometry value. */
const HARDCODE_EXCEPTIONS = /tracking-tight|leading-snug|leading-none|space-x-2|max-w-lg|max-w-sm/;

describe("static partials b2 -- shared hygiene", () => {
  for (const name of PARTIALS) {
    const src = read(name);

    test(`${name}: ships and carries a usage-doc comment (<%-- --%> syntax) with the @param API + a call snippet`, () => {
      expect(src, "missing <%-- --%> jte comment block").toContain("<%--");
      expect(src, "comment block must close").toContain("--%>");
      expect(src, "must NOT use the @* *@ comment syntax").not.toMatch(/@\*/);
      expect(src, "missing Usage section").toMatch(/Usage:/);
      expect(src, "usage snippet must show the @@template call").toContain(`@@template.${name}(`);
      expect(src, "missing param declaration").toMatch(/@param /);
    });

    test(`${name}: never reaches for Font Awesome / wa-icon`, () => {
      expect(src.toLowerCase()).not.toMatch(/font-?awesome|wa-icon|fa-/);
    });

    test(`${name}: no inline <script> and no inline on* handlers`, () => {
      expect(src).not.toMatch(/<script/i);
      const inlineHandlers = src.match(/\son[a-z]+=/gi) ?? [];
      expect(inlineHandlers, `unexpected inline handlers: ${inlineHandlers.join(", ")}`).toEqual([]);
    });

    test(`${name}: any icon goes through the Lucide partial`, () => {
      // no raw inline <svg ...> markup; icons must be @template.icon(...) calls.
      const rawSvg = src.match(/<svg\b/gi) ?? [];
      expect(rawSvg, "raw <svg> found; route icons through @template.icon").toEqual([]);
    });

    test(`${name}: styling is token-driven (no bare hex colours, no raw px spacing)`, () => {
      expect(src, "leaked a hardcoded hex colour").not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      // Strip arbitrary-value brackets first so their inner --lv-* token names + fractions
      // are not mistaken for bare scale utilities. What remains must contain NO Tailwind
      // numeric scale utility: every dimension reads a --lv-* var. Allow documented exceptions.
      const stripped = src
        .replace(/\[[^\]]*\]/g, "[]")
        .replace(/-\d+\/\d+/g, "")
        .replace(/\bmin-w-0\b/g, ""); // min-w-0 == min-width:0, a dimensionless layout primitive
      const numericUtils = (stripped.match(/\b(?:p|px|py|pt|pb|pl|pr|m|mx|my|mb|mt|gap|h|w|text|size|space)-[1-9]/g) ?? [])
        .filter((u) => !HARDCODE_EXCEPTIONS.test(u));
      expect(numericUtils, `non-token numeric utilities: ${numericUtils.join(", ")}`).toEqual([]);
    });
  }
});

describe("pagination (#438)", () => {
  const src = read("pagination");
  test("declares the documented param API", () => {
    for (const p of ["int current", "int total", "String hrefPattern", "int siblings", "String ariaLabel"]) {
      expect(src).toContain(`@param ${p}`);
    }
  });
  test("a11y: a labelled nav landmark, active page is aria-current, ellipsis is hidden", () => {
    expect(src).toContain('role="navigation"');
    expect(src).toContain('aria-label="${ariaLabel}"');
    expect(src).toContain('aria-current="page"');
    expect(src).toMatch(/aria-hidden="true"/);
    expect(src).toContain('class="sr-only"');
  });
  test("derives the page window from params (no hardcoded list) and links are real <a href>", () => {
    expect(src).toMatch(/@for\s*\(int p/);
    expect(src).toContain("hrefPattern.formatted(");
    expect(src).toMatch(/<a\b/);
  });
  test("prev/next use Lucide chevrons; disabled at the boundary", () => {
    expect(src).toContain('@template.icon(name = "chevron-left"');
    expect(src).toContain('@template.icon(name = "chevron-right"');
    expect(src).toContain('@template.icon(name = "ellipsis"');
    expect(src).toContain('aria-disabled="true"');
  });
  test("focus ring + active page styled via tokens", () => {
    expect(src).toContain("focus-visible:shadow-[var(--lv-ring)]");
    expect(src).toContain("bg-[var(--lv-color-accent)]");
  });
});

describe("native-select (#437)", () => {
  const src = read("native-select");
  test("declares the documented param API", () => {
    for (const p of ["String name", "java.util.List<String> options", "gg.jte.Content content", "String value", "String placeholder"]) {
      expect(src).toContain(`@param ${p}`);
    }
    expect(src).toContain("@param boolean disabled");
    expect(src).toContain("@param String label");
  });
  test("wraps the REAL native <select> with native <option>s (not a Lit listbox)", () => {
    expect(src).toMatch(/<select\b/);
    expect(src).toMatch(/<option\b/);
    // no Lit custom-element listbox is rendered (those are the separate interactive components).
    expect(src).not.toMatch(/<lv-select|<rich-select|<lv-combobox/);
  });
  test("options come from the list param OR a content slot; not hardcoded", () => {
    expect(src).toMatch(/@for\s*\(String opt : options\)/);
    expect(src).toContain("${content}");
  });
  test("a11y: select owns id/name for a <label for>, focus-within ring on the wrapper", () => {
    expect(src).toContain('id="${selectId}"');
    expect(src).toContain('name="${name}"');
    expect(src).toContain("focus-within:border-[var(--lv-color-ring)]");
    expect(src).toContain("focus-within:shadow-[var(--lv-ring)]");
  });
  test("Lucide chevron-down indicator, native arrow suppressed (appearance-none)", () => {
    expect(src).toContain('@template.icon(name = "chevron-down"');
    expect(src).toContain("appearance-none");
  });
});

describe("alert-dialog (#429)", () => {
  const src = read("alert-dialog");
  test("declares the documented param API", () => {
    for (const p of ["String name", "String title", "String description", "String cancelLabel", "String actionLabel", "boolean destructive"]) {
      expect(src).toContain(`@param ${p}`);
    }
    expect(src).toContain("@param String actionAttrs");
    expect(src).toContain("@param String cancelAttrs");
  });
  test("documents its composition with the existing interactive dialog island", () => {
    expect(src).toMatch(/lv-dialog/);
    expect(src.toLowerCase()).toMatch(/dialog island/);
  });
  test("a11y: role=alertdialog labelled + described by generated ids", () => {
    expect(src).toContain('role="alertdialog"');
    expect(src).toContain('aria-labelledby="${titleId}"');
    expect(src).toContain('aria-describedby="${hasDescription ? descId : null}"');
  });
  test("cancel + action buttons; destructive variant uses the destructive token", () => {
    expect(src).toContain('data-slot="alert-dialog-cancel"');
    expect(src).toContain('data-slot="alert-dialog-action"');
    expect(src).toContain("bg-[var(--lv-color-destructive)]");
    expect(src).toContain("bg-[var(--lv-color-primary)]");
    expect(src).toContain('@template.icon(name = "triangle-alert"');
  });
  test("focus ring via tokens on both buttons", () => {
    const rings = src.match(/focus-visible:shadow-\[var\(--lv-ring\)\]/g) ?? [];
    expect(rings.length).toBeGreaterThanOrEqual(2);
  });
});
