/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * Static JTE partials, batch b1 (issues #431 avatar, #432 button-group, #435 item,
 * #433 empty, #434 input-group). These are presentational .jte partials compiled in the
 * Java world, so -- as with icon.jte's suite -- the test harness asserts on the partial
 * SOURCE as text: it pins the token-driven styling (every colour/space/radius reads a
 * --lv-* var, never a hardcoded value), the accessibility contract (roles/aria), the
 * slot/param API, and that icons go through the Lucide partial (never Font Awesome).
 * A render/golden in the Java runtime is out of scope for the JS suite; this is the
 * equivalent structural golden the planning DONE criteria asks for.
 */
import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const jteDir = join(import.meta.dirname, "..", "registry", "jte");
const read = (name: string) => readFileSync(join(jteDir, `${name}.jte`), "utf8");

const PARTIALS = ["avatar", "button-group", "item", "empty", "input-group"];

/**
 * Partials reached as the vendored `@template.lievit.<name>` namespace (every partial's copy-in
 * target is `lievit/<name>.jte`). `input-group` is mid-migration (owned elsewhere) and still shows
 * the bare `@template.<name>` in its doc, so it is excluded here until that lands.
 */
const RESERVED_BARE = new Set<string>([]);
const callSnippet = (name: string) =>
  RESERVED_BARE.has(name) ? `@template.${name}(` : `@template.lievit.${name}(`;

/** Tailwind utilities that legitimately carry a fractional / fixed geometry value. */
const HARDCODE_EXCEPTIONS = /tracking-tight|leading-snug|leading-none|space-x-2/;

describe("static partials b1 -- shared hygiene", () => {
  for (const name of PARTIALS) {
    const src = read(name);

    test(`${name}: ships and carries a usage-doc comment (<%-- --%> syntax) with the @param API + a call snippet`, () => {
      expect(src, "missing <%-- --%> jte comment block").toContain("<%--");
      expect(src, "comment block must close").toContain("--%>");
      expect(src, "must NOT use the @* *@ comment syntax").not.toMatch(/@\*/);
      expect(src, "missing Usage section").toMatch(/Usage:/);
      expect(src, "usage snippet must show the @template call").toContain(callSnippet(name));
      expect(src, "missing param declaration").toMatch(/@param /);
    });

    test(`${name}: never reaches for Font Awesome / wa-icon`, () => {
      expect(src.toLowerCase()).not.toMatch(/font-?awesome|wa-icon|fa-/);
    });

    test(`${name}: no inline <script> and ZERO inline on* handlers (strict CSP refuses them)`, () => {
      expect(src).not.toMatch(/<script/i);
      // CSP-safe by default: no inline handler is allowed, not even avatar's old onerror swap
      // (#3 dogfood finding). A client-side image fallback is opt-in via data-lv-avatar-fallback,
      // wired from an adopter's own TS module -- never an inline attribute.
      const inlineHandlers = src.match(/\son[a-z]+=/gi) ?? [];
      expect(inlineHandlers, `unexpected inline handlers: ${inlineHandlers.join(", ")}`).toEqual([]);
    });

    test(`${name}: styling is token-driven (no bare hex colours, no raw px spacing)`, () => {
      expect(src, "leaked a hardcoded hex colour").not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      // Strip arbitrary-value brackets first (text-[length:var(--lv-text-sm)], h-[var(--lv-space-10)],
      // h-1/2, w-1/2) so their inner --lv-* token names + fractions are not mistaken for bare scale
      // utilities. What remains must contain NO Tailwind numeric scale utility (p-4, gap-2, h-10,
      // text-sm...): every dimension reads a --lv-* var. Allow the documented geometry exceptions.
      const stripped = src
        .replace(/\[[^\]]*\]/g, "[]")
        .replace(/-\d+\/\d+/g, "")
        .replace(/\bmin-w-0\b/g, ""); // min-w-0 == min-width:0, a dimensionless layout primitive
      // -0 is dimensionless (size:0), never a scale value, so require a non-zero digit.
      const numericUtils = (stripped.match(/\b(?:p|px|py|pt|pb|pl|pr|m|mx|my|mb|mt|gap|h|w|text|size|space)-[1-9]/g) ?? [])
        .filter((u) => !HARDCODE_EXCEPTIONS.test(u));
      expect(numericUtils, `non-token numeric utilities: ${numericUtils.join(", ")}`).toEqual([]);
    });
  }
});

describe("avatar (#431)", () => {
  const src = read("avatar");
  test("declares the documented param API", () => {
    for (const p of ["String name", "String src", "String initials", "String size", "String cssClass"]) {
      expect(src).toContain(`@param ${p}`);
    }
  });
  test("a11y: the wrapper is a labelled image (role=img + aria-label=name)", () => {
    expect(src).toContain('role="img"');
    expect(src).toContain('aria-label="${name}"');
  });
  test("fallback chain: initials else a Lucide user icon; the photo is decorative", () => {
    expect(src).toContain('@template.lievit.icon(name = "user"');
    expect(src).toContain("${initials}");
    expect(src).toMatch(/alt=""/);
  });
  test("rounded-full + sized via tokens, neutral muted surface", () => {
    expect(src).toContain("rounded-[var(--lv-radius-full)]");
    expect(src).toContain("bg-[var(--lv-color-muted-bg)]");
    expect(src).toMatch(/var\(--lv-text-sm\)/);
  });
});

describe("button-group (#432)", () => {
  const src = read("button-group");
  test("takes a Content slot for the buttons + an orientation param", () => {
    expect(src).toContain("@param gg.jte.Content content");
    expect(src).toContain("@param String orientation");
    expect(src).toContain("${content}");
  });
  test("a11y: role=group, labellable, orientation exposed", () => {
    expect(src).toContain('role="group"');
    expect(src).toContain('aria-label="${label}"');
    expect(src).toContain('data-orientation="${orientation}"');
  });
  test("segmented look: collapses inner rounding + shares borders, focus raised above neighbours", () => {
    expect(src).toMatch(/rounded-l-none|rounded-t-none/);
    expect(src).toMatch(/border-l-0|border-t-0/);
    expect(src).toContain("focus-visible]:z-10");
  });
});

describe("item (#435)", () => {
  const src = read("item");
  test("exposes leading / content / trailing slots + variant + size", () => {
    expect(src).toContain("@param gg.jte.Content content");
    expect(src).toContain("@param gg.jte.Content leading");
    expect(src).toContain("@param gg.jte.Content trailing");
    expect(src).toContain("@param String variant");
    expect(src).toContain("@param String size");
  });
  test("slots render only when provided (null-guarded)", () => {
    expect(src).toContain("@if(leading != null)");
    expect(src).toContain("@if(trailing != null)");
    expect(src).toContain("${content}");
  });
  test("a11y: focus-visible ring via tokens, optional list role pass-through", () => {
    expect(src).toContain("focus-visible:border-[var(--lv-color-ring)]");
    expect(src).toContain("focus-visible:shadow-[var(--lv-ring)]");
    expect(src).toContain('role="${role}"');
  });
});

describe("empty (#433)", () => {
  const src = read("empty");
  test("title + description + icon + action slot params", () => {
    expect(src).toContain("@param String title");
    expect(src).toContain("@param String description");
    expect(src).toContain("@param String icon");
    expect(src).toContain("@param gg.jte.Content action");
  });
  test("renders its icon through the Lucide partial, dashed bordered panel", () => {
    expect(src).toContain("@template.lievit.icon(name = icon");
    expect(src).toContain("border-dashed");
    expect(src).toContain("border-[var(--lv-color-border)]");
  });
  test("a11y: a live status region by default so async-empty is announced", () => {
    expect(src).toContain('role="${role}"');
    expect(src).toContain('@param String role = "status"');
    expect(src).toContain("aria-live");
  });
  test("cssClass passes through to the root (shadcn parity: every part merges className)", () => {
    expect(src).toContain("@param String cssClass");
    expect(src).toMatch(/text-center \$\{cssClass\}/);
  });
});

describe("input-group (#434)", () => {
  const src = read("input-group");
  test("real input + leading/trailing addon slots + the documented params", () => {
    expect(src).toContain("@param String name");
    expect(src).toContain("@param gg.jte.Content leading");
    expect(src).toContain("@param gg.jte.Content trailing");
    expect(src).toMatch(/<input/);
    expect(src).toContain('data-slot="input-group-control"');
  });
  test("a11y: role=group, the group owns the focus ring, inner input is ring/border-free", () => {
    expect(src).toContain('role="group"');
    expect(src).toContain("focus-within:border-[var(--lv-color-ring)]");
    expect(src).toContain("focus-within:shadow-[var(--lv-ring)]");
    expect(src).toMatch(/border-0/);
    expect(src).toContain("focus-visible:outline-none");
  });
  test("label binds to the real input via id (default = name)", () => {
    expect(src).toContain('id="${inputId}"');
    expect(src).toContain('name="${name}"');
  });
  test("md height baseline is the shadcn h-9 (--lv-space-9, 36px), sm/lg flank it at 32/40", () => {
    // shadcn fidelity (#463 ④): control baseline is h-9; md=space-9, sm=space-8, lg=space-10.
    expect(src).toMatch(/default\s*->\s*"h-\[var\(--lv-space-9\)\]"/);
    expect(src).toMatch(/case "sm" -> "h-\[var\(--lv-space-8\)\]"/);
    expect(src).toMatch(/case "lg" -> "h-\[var\(--lv-space-10\)\]"/);
    expect(src).not.toContain("--lv-space-12");
  });
});
