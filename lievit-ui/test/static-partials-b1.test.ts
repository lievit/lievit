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
      // utilities. Also strip JTE !{var ...} Java code blocks: they contain Java string literals such
      // as "var(--lv-space-6)" used to build CSS values at runtime -- those are NOT Tailwind classes.
      // What remains must contain NO Tailwind numeric scale utility (p-4, gap-2, h-10, text-sm...):
      // every dimension reads a --lv-* var. Allow the documented geometry exceptions.
      const stripped = src
        .replace(/!\{[^}]*\}/g, "")    // JTE inline Java code blocks (Java string literals, not classes)
        .replace(/<%--[\s\S]*?--%>/g, "") // JTE doc/inline comments
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

// avatar (#431) -- re-forged v-next: diameter-based size vocab, circle/square shape, server-side
// fallback chain, status dot, interactive wrappers, no onerror anti-pattern.
// Full spec coverage lives in test/avatar.test.ts; this block is the shared-hygiene smoke only.
describe("avatar (#431)", () => {
  const src = read("avatar");
  test("declares the full v-next param API (size, shape, color, status, href, clickable, ariaHidden, dataAttrs)", () => {
    for (const p of [
      "String name", "String src", "String initials", "String size", "String shape",
      "String color", "String status", "String href", "String hrefLabel",
      "boolean clickable", "String ariaLabel", "boolean ariaHidden",
      "String cssClass", "String attrs",
      "java.util.Map<String, String> dataAttrs",
    ]) {
      expect(src, `missing @param ${p}`).toContain(`@param ${p}`);
    }
  });
  test("diameter-based size vocab: six tiers xs..2xl each mapped to a --lv-space-* token", () => {
    expect(src).toContain("var(--lv-space-6)");  // xs
    expect(src).toContain("var(--lv-space-8)");  // sm
    expect(src).toContain("var(--lv-space-10)"); // md default
    expect(src).toContain("var(--lv-space-12)"); // lg
    expect(src).toContain("var(--lv-space-16)"); // xl
    expect(src).toContain("var(--lv-space-20)"); // 2xl
  });
  test("shape: circle -> --lv-radius-full; square -> --lv-radius-md", () => {
    expect(src).toContain("rounded-[var(--lv-radius-full)]");
    expect(src).toContain("rounded-[var(--lv-radius-md)]");
  });
  test("server-side fallback chain: image -> initials -> Lucide icon -> bare", () => {
    expect(src).toContain("hasImage");
    expect(src).toContain("hasInitials");
    expect(src).toContain('@template.lievit.icon(name = icon');
    // initials rendered via resolvedInitials, not bare ${initials}
    expect(src).toContain("${resolvedInitials}");
  });
  test("initials use --lv-font-medium weight token (not bold)", () => {
    expect(src).toContain("font-[var(--lv-font-medium)]");
  });
  test("status dot is aria-hidden and suppressed at xs size", () => {
    expect(src).toContain('data-slot="avatar-status"');
    // The dot span is always aria-hidden="true" (literal in every branch)
    expect(src).toMatch(/data-slot="avatar-status"[^>]*aria-hidden="true"/s);
    expect(src).toContain('!size.equals("xs")');
  });
  test("interactive link: root becomes <a href> with focus-visible ring", () => {
    expect(src).toContain("@if(href != null)");
    expect(src).toContain('href="${href}"');
    expect(src).toContain("focus-visible:shadow-[var(--lv-ring)]");
    // inner frame is aria-hidden inside the wrapper
    expect(src).toMatch(/class="\$\{frameBase\}[^"]*"\s+aria-hidden="true"/s);
  });
  test("interactive button: root becomes <button type=button> with aria-label", () => {
    expect(src).toContain("@elseif(clickable)");
    expect(src).toContain('type="button"');
    expect(src).toContain('aria-label="${wrapperAriaLabel}"');
  });
  test("no onerror anti-pattern: NO inline on* handler anywhere in the template", () => {
    const handlers = src.match(/\son[a-z]+=/gi) ?? [];
    expect(handlers, `onerror/on* handlers found: ${handlers.join(", ")}`).toEqual([]);
  });
  test("dataAttrs values are escaped via Escape.htmlAttribute (same XSS contract as button.jte)", () => {
    expect(src).toContain("@import gg.jte.html.escape.Escape");
    expect(src).toMatch(/Escape\.htmlAttribute\(/);
    expect(src, "dataAttrs value must not be emitted raw").not.toMatch(/\$unsafe\{[^}]*getValue/);
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

describe("item (#435, v-next)", () => {
  const src = read("item");
  test("exposes leading / content / trailing slots + variant + size (v-next params)", () => {
    expect(src).toContain("@param gg.jte.Content content");
    expect(src).toContain("@param gg.jte.Content leading = null");
    expect(src).toContain("@param gg.jte.Content trailing = null");
    expect(src).toContain("@param String variant");
    expect(src).toContain("@param String size");
    // v-next new params
    expect(src).toContain("@param String element");
    expect(src).toContain("@param boolean disabled");
    expect(src).toContain("@param String attrs");
    expect(src).toContain("@param java.util.Map<String, String> dataAttrs");
    // v-next removed: role param gone (element replaces it)
    expect(src).not.toContain("@param String role");
  });
  test("v-next variant vocabulary: default|active|danger|muted (outline removed)", () => {
    // active and danger are new; outline is gone
    expect(src).toContain('"active"');
    expect(src).toContain('"danger"');
    expect(src).not.toContain('"outline"');
  });
  test("v-next size vocabulary: sm|md|lg (replaces default|sm)", () => {
    expect(src).toContain('"sm"');
    expect(src).toContain('"md"');
    expect(src).toContain('"lg"');
    // old `size.equals("sm")` singular branch is gone
    expect(src).not.toContain("size.equals(\"default\")");
  });
  test("slots render only when provided (null-guarded), with correct data-slots", () => {
    expect(src).toContain("@if(leading != null)");
    expect(src).toContain("@if(trailing != null)");
    expect(src).toContain('data-slot="item-leading"');
    expect(src).toContain('data-slot="item-content"');
    expect(src).toContain('data-slot="item-trailing"');
    expect(src).toContain("${content}");
  });
  test("root carries data-slot=item + data-variant + data-size", () => {
    expect(src).toContain('data-slot="item"');
    expect(src).toContain('data-variant="${variant}"');
    expect(src).toContain('data-size="${size}"');
  });
  test("disabled: opacity-50 + pointer-events-none (no aria-disabled on a non-interactive element)", () => {
    expect(src).toContain("opacity-50");
    expect(src).toContain("pointer-events-none");
    // no aria-disabled attribute in the markup (strip comments first -- the doc mentions it)
    const itemMarkup = src.replace(/<%--[\s\S]*?--%>/g, "");
    expect(itemMarkup).not.toContain("aria-disabled");
  });
  test("variant classes reference correct token pairs", () => {
    // default: accent hover
    expect(src).toContain("var(--lv-color-accent)");
    expect(src).toContain("var(--lv-color-accent-fg)");
    // danger: destructive
    expect(src).toContain("var(--lv-color-destructive)");
    expect(src).toContain("var(--lv-color-destructive-fg)");
    // muted
    expect(src).toContain("var(--lv-color-muted-fg)");
  });
  test("size classes reference correct space tokens (min-h based)", () => {
    expect(src).toContain("var(--lv-space-8)");
    expect(src).toContain("var(--lv-space-9)");
    expect(src).toContain("var(--lv-space-10)");
    expect(src).toContain("var(--lv-space-3)");
    expect(src).toContain("var(--lv-space-2)");
  });
  test("a11y: focus-visible ring via tokens", () => {
    expect(src).toContain("focus-visible:shadow-[var(--lv-ring)]");
  });
  test("dataAttrs values are escaped via Escape.htmlAttribute (XSS contract)", () => {
    expect(src).toContain("@import gg.jte.html.escape.Escape");
    expect(src).toMatch(/Escape\.htmlAttribute\(/);
    expect(src).toContain("$unsafe{dataAttrsMarkup}");
  });
  test("no inline style= attributes with CSS custom property references", () => {
    const markup = src.replace(/<%--[\s\S]*?--%>/g, "");
    const styleAttrs = markup.match(/style="[^"]*var\(--lv-/g) ?? [];
    expect(styleAttrs, `inline style with token ref: ${styleAttrs.join(", ")}`).toEqual([]);
  });
});

describe("empty (#433)", () => {
  const src = read("empty");
  test("title (null-optional) + description + variant-driven icon + action slot params", () => {
    // v-next: title is null by default (controller provides copy, partial never bakes in defaults);
    // icon is variant-driven via _defaultIcon switch (no explicit icon param); imageUrl/image slot added
    expect(src).toContain("@param String title = null");
    expect(src).toContain("@param String description = null");
    expect(src).toContain("@param gg.jte.Content action = null");
    expect(src).toContain("@param String variant = \"default\"");
  });
  test("renders its icon through the Lucide partial; no dashed border (presentational region, not a panel)", () => {
    // v-next: icon is emitted via @template.lievit.icon using the variant-driven _defaultIcon;
    // the root <div> is a plain flex container with rounded corners and padding (no border-dashed)
    expect(src).toContain("@template.lievit.icon(name = _defaultIcon");
    expect(src).toContain("rounded-[var(--lv-radius-lg)]");
    // no dashed border on the root (that was the old anti-pattern — blank-slate is not a dropzone)
    expect(src).not.toContain("border-dashed");
  });
  test("a11y: NOT a live region (surrounding controller owns announcements; assert absence + why)", () => {
    // v-next: empty dropped role=status / aria-live. A blank-slate state is STATIC presentational;
    // the surrounding controller (e.g. an htmx fragment, a wire action) owns the DOM swap and any
    // AT announcement. Baking role=status into the empty partial would cause double-announcement
    // when the controller already manages a nearby live region — and would fire even when the
    // empty state is part of the initial render (not an async update).
    expect(src).not.toContain('role="status"');
    expect(src).not.toContain("aria-live");
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
