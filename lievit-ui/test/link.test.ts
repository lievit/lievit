/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * lievit-ui link partial (v-next) -- structural golden for the new surface.
 *
 * The partial compiles in the Java world; this Node harness asserts on the partial SOURCE
 * as text. It pins:
 *   - the @param API (v-next vocabulary: href, content, variant, size, external, disabled,
 *     download, ariaLabel, cssClass, attrs, dataAttrs)
 *   - that the partial always renders <a> (v-next: no <span> fallback for disabled)
 *   - smart attributes (href null-dropped when disabled; target/rel only when external;
 *     download/ariaLabel/aria-disabled omitted when null)
 *   - external link: sr-only text + inline Unicode glyph, NO icon partial call
 *   - variant/size CSS (token-driven)
 *   - disabled: opacity-50 + cursor-not-allowed
 *   - dataAttrs: Escape.htmlAttribute on each value (same XSS contract as button.jte)
 *   - a11y / CSP hygiene (focus ring, no inline script, no on* handlers)
 */
import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const jteDir = join(import.meta.dirname, "..", "registry", "jte");
const src = readFileSync(join(jteDir, "link.jte"), "utf8");

describe("link -- params & docs API (v-next)", () => {
  test("declares the v-next param API with defaults", () => {
    // required
    expect(src).toContain("@param gg.jte.Content content");
    expect(src).toContain("@param String href");
    // optional with defaults
    expect(src).toContain('@param String variant = "default"');
    expect(src).toContain('@param String size = "inherit"');
    expect(src).toContain("@param boolean external = false");
    expect(src).toContain("@param boolean disabled = false");
    expect(src).toContain("@param String download = null");
    expect(src).toContain("@param String ariaLabel = null");
    expect(src).toContain('@param String cssClass = ""');
    expect(src).toContain('@param String attrs = ""');
    expect(src).toContain("@param java.util.Map<String, String> dataAttrs");
  });

  test("v-next removed params are absent (label, icon, iconPosition, badge, badgeVariant, newTab)", () => {
    expect(src).not.toContain("@param String label");
    expect(src).not.toContain("@param String icon");
    expect(src).not.toContain("@param String iconPosition");
    expect(src).not.toContain("@param String badge");
    expect(src).not.toContain("@param String badgeVariant");
    expect(src).not.toContain("@param boolean newTab");
  });

  test("usage doc uses <%-- --%> (not @* *@) and shows the @template.lievit.link call", () => {
    expect(src).toContain("<%--");
    expect(src).toContain("--%>");
    expect(src, "must NOT use @* *@ comment syntax").not.toMatch(/@\*/);
    expect(src).toMatch(/Usage:/);
    expect(src).toContain("@@template.lievit.link(");
  });
});

describe("link -- structure (v-next: always <a>)", () => {
  test("always renders a real <a> element (no <span> fallback)", () => {
    expect(src).toMatch(/<a\b/);
    expect(src).toContain("</a>");
    // v-next: disabled drops href via smart attr, but still renders <a>
    expect(src).not.toMatch(/<span[^>]*data-slot="link"/);
  });

  test("carries the data-slot=link + data-variant + data-size contract", () => {
    expect(src).toContain('data-slot="link"');
    expect(src).toContain('data-variant="${variant}"');
    expect(src).toContain('data-size="${size}"');
  });

  test("content slot renders inside the anchor", () => {
    expect(src).toContain("${content}");
  });
});

describe("link -- smart attributes", () => {
  test("href is null-dropped when disabled (JTE smart attr)", () => {
    expect(src).toContain('href="${disabled ? null : href}"');
  });

  test("target is null-dropped when not external", () => {
    expect(src).toContain('target="${external ? "_blank" : null}"');
  });

  test("rel is null-dropped when not external", () => {
    expect(src).toContain('rel="${external ? "noopener noreferrer" : null}"');
  });

  test("download is null-dropped when null (JTE smart attr)", () => {
    expect(src).toContain('download="${download}"');
  });

  test("aria-label is null-dropped when null (JTE smart attr)", () => {
    expect(src).toContain('aria-label="${ariaLabel}"');
  });

  test("aria-disabled is set when disabled, omitted otherwise", () => {
    expect(src).toContain('aria-disabled="${disabled ? "true" : null}"');
  });
});

describe("link -- external link", () => {
  test("renders sr-only text when external", () => {
    expect(src).toContain('@if(external)');
    expect(src).toContain('<span class="sr-only">(opens in new tab)</span>');
  });

  test("renders inline Unicode glyph (not icon partial) when external", () => {
    expect(src).toContain('aria-hidden="true"');
    expect(src).toContain("↗");
    // must NOT call the icon partial for this (hard rule 5)
    expect(src).not.toContain("@template.lievit.icon(");
  });
});

describe("link -- disabled", () => {
  test("disabled adds opacity-50 and cursor-not-allowed classes", () => {
    expect(src).toContain("opacity-50");
    expect(src).toContain("cursor-not-allowed");
  });

  test("disabled class is conditional on the disabled param", () => {
    // The disabledClass local var is set conditionally
    expect(src).toContain("disabled ? ");
  });
});

describe("link -- variant CSS (token-driven)", () => {
  test("default variant: primary-coloured text with underline-on-hover + focus-visible", () => {
    expect(src).toContain("var(--lv-color-primary)");
    expect(src).toContain("hover:underline");
    expect(src).toContain("hover:underline-offset-4");
    expect(src).toContain("focus-visible:underline");
    expect(src).toContain("focus-visible:underline-offset-4");
  });

  test("muted variant: muted-fg text with underline-on-hover", () => {
    expect(src).toContain("var(--lv-color-muted-fg)");
  });

  test("destructive variant: destructive-coloured text with underline-on-hover", () => {
    expect(src).toContain("var(--lv-color-destructive)");
  });

  test("ghost variant: full fg text with underline-on-hover", () => {
    expect(src).toContain("var(--lv-color-fg)");
  });
});

describe("link -- size CSS", () => {
  test("sm: text-xs token", () => {
    expect(src).toContain("var(--lv-text-xs)");
  });

  test("md: text-sm token", () => {
    expect(src).toContain("var(--lv-text-sm)");
  });

  test("lg: text-base token", () => {
    expect(src).toContain("var(--lv-text-base)");
  });

  test("size=inherit emits no font-size class (inherits context)", () => {
    // The switch default branch should produce an empty string for inherit
    expect(src).toMatch(/default\s*->\s*""/);
  });
});

describe("link -- a11y & focus", () => {
  test("focus-visible ring is token-driven", () => {
    expect(src).toContain("focus-visible:shadow-[var(--lv-ring)]");
  });

  test("underline-offset-4 base class present (shadcn parity)", () => {
    expect(src).toContain("underline-offset-4");
  });
});

describe("link -- dataAttrs XSS contract", () => {
  test("dataAttrs values are escaped via Escape.htmlAttribute (same contract as button.jte)", () => {
    expect(src).toContain("@import gg.jte.html.escape.Escape");
    expect(src).toContain("@import gg.jte.output.StringOutput");
    expect(src).toMatch(/Escape\.htmlAttribute\(/);
    // safe pattern: build string, emit with $unsafe
    expect(src).toContain("$unsafe{dataAttrsMarkup}");
  });

  test("dataAttrs key validation: non-identifier keys are dropped", () => {
    expect(src).toContain('[A-Za-z][A-Za-z0-9-]*');
  });
});

describe("link -- hygiene (token-driven, CSP-clean)", () => {
  test("no inline <script> and ZERO inline on* handlers (strict CSP refuses them)", () => {
    expect(src).not.toMatch(/<script/i);
    const inlineHandlers = src.match(/\son[a-z]+=/gi) ?? [];
    expect(inlineHandlers, `unexpected inline handlers: ${inlineHandlers.join(", ")}`).toEqual([]);
  });

  test("never reaches for Font Awesome / wa-icon / Lit", () => {
    expect(src.toLowerCase()).not.toMatch(/font-?awesome|wa-icon|fa-/);
    expect(src.toLowerCase()).not.toMatch(/customelement|litelement|import .*\blit\b/);
  });

  test("no inline style= attributes with CSS custom property references (use Tailwind arbitrary classes)", () => {
    // style= attributes with var(--lv-...) are forbidden; use text-[var(--lv-...)] etc.
    const markup = src.replace(/<%--[\s\S]*?--%>/g, "");
    const styleAttrs = markup.match(/style="[^"]*var\(--lv-/g) ?? [];
    expect(styleAttrs, `inline style with token ref: ${styleAttrs.join(", ")}`).toEqual([]);
  });

  test("styling is token-driven (no bare hex colours, no raw px/numeric spacing utilities)", () => {
    expect(src, "leaked a hardcoded hex colour").not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    const stripped = src
      .replace(/!\{[^}]*\}/g, "")
      .replace(/<%--[\s\S]*?--%>/g, "")
      .replace(/\[[^\]]*\]/g, "[]")
      .replace(/-\d+\/\d+/g, "")
      .replace(/\bmin-w-0\b/g, "");
    const numericUtils = (stripped.match(/\b(?:p|px|py|pt|pb|pl|pr|m|mx|my|mb|mt|gap|h|w|text|size|space)-[1-9]/g) ?? []);
    expect(numericUtils, `non-token numeric utilities: ${numericUtils.join(", ")}`).toEqual([]);
  });

  test("no @import io.lievit.* (templates are presentational: data arrives via @param only)", () => {
    expect(src).not.toMatch(/@import io\.lievit\./);
  });
});
