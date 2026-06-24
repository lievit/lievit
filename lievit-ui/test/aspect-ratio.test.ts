/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * aspect-ratio.jte -- structural + a11y contract (spec planning/v-next/specs/aspect-ratio.md §7).
 *
 * The aspect-ratio is a static JTE partial compiled in the Java world. This harness asserts on the
 * PARTIAL SOURCE as text, pinning the param API, the two-element structure (outer data-slot +
 * inner data-slot), the ratio CSS custom property mechanism (--lv-ar-ratio set as inline style on
 * the outer, aspect-ratio: var(--lv-ar-ratio) on the inner), the data-ratio convenience attribute,
 * the overflow / rounded / border / cssClass / innerClass pass-through params, the content slot
 * projection, the a11y contract (no role or aria-* on the wrapper), the escaping channel (attrs
 * trusted raw), and CSP hygiene.
 *
 * Spec: planning/v-next/specs/aspect-ratio.md
 */
import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const jteDir = join(import.meta.dirname, "..", "registry", "jte");
const src = readFileSync(join(jteDir, "aspect-ratio.jte"), "utf8");

/** Strip <%-- --%> JTE comments so prose never trips a markup assertion. */
const markup = src.replace(/<%--[\s\S]*?--%>/g, "");

// ---------------------------------------------------------------------------
// Param API (spec §2)
// ---------------------------------------------------------------------------
describe("aspect-ratio -- param API", () => {
  test("declares ratioX as int defaulting to 16", () => {
    expect(src).toContain("@param int ratioX = 16");
  });

  test("declares ratioY as int defaulting to 9", () => {
    expect(src).toContain("@param int ratioY = 9");
  });

  test('declares overflow defaulting to "hidden"', () => {
    expect(src).toContain('@param String overflow = "hidden"');
  });

  test('declares rounded defaulting to ""', () => {
    expect(src).toContain('@param String rounded = ""');
  });

  test("declares border as boolean defaulting to false", () => {
    expect(src).toContain("@param boolean border = false");
  });

  test('declares cssClass defaulting to ""', () => {
    expect(src).toContain('@param String cssClass = ""');
  });

  test('declares innerClass defaulting to ""', () => {
    expect(src).toContain('@param String innerClass = ""');
  });

  test('declares attrs defaulting to "" (trusted raw channel)', () => {
    expect(src).toContain('@param String attrs = ""');
  });

  test("declares content as gg.jte.Content (required, no default)", () => {
    expect(src).toContain("@param gg.jte.Content content");
    // Required: no default assignment
    expect(src).not.toMatch(/@param gg\.jte\.Content content\s*=/);
  });

  test("does NOT declare a ratio String param (spec anti-pattern: typed ints instead)", () => {
    expect(src).not.toMatch(/@param String ratio/);
  });

  test("does NOT declare dataAttrs (no per-row DB data flows through this component)", () => {
    expect(src).not.toMatch(/@param.*dataAttrs/);
  });

  test("usage doc carries the @@template.lievit.aspect-ratio call syntax", () => {
    expect(src).toContain("@@template.lievit.aspect-ratio(");
  });
});

// ---------------------------------------------------------------------------
// No io.lievit imports (hard rule from REFORGE-AGENT-BRIEF.md)
// ---------------------------------------------------------------------------
describe("aspect-ratio -- no io.lievit imports", () => {
  test("never imports io.lievit.* (JTE classpath has only JDK + jte + icons)", () => {
    expect(src).not.toMatch(/import io\.lievit/);
  });
});

// ---------------------------------------------------------------------------
// Two-element structure: outer + inner (spec §6)
// ---------------------------------------------------------------------------
describe("aspect-ratio -- two-element structure", () => {
  test("outer element has data-slot='aspect-ratio'", () => {
    expect(markup).toContain('data-slot="aspect-ratio"');
  });

  test("inner element has data-slot='aspect-ratio-inner'", () => {
    expect(markup).toContain('data-slot="aspect-ratio-inner"');
  });

  test("both elements are plain div (no semantic role added)", () => {
    // The wrappers must be divs, not article/section/figure
    expect(markup).toMatch(/<div[\s\S]*?data-slot="aspect-ratio"/);
    expect(markup).toMatch(/<div[\s\S]*?data-slot="aspect-ratio-inner"/);
  });

  test("outer element carries the w-full class by default", () => {
    expect(markup).toContain("w-full");
  });

  test("outer element is NOT a flex or grid container (layout is the content's concern)", () => {
    const outerMatch = markup.match(/<div[^>]*data-slot="aspect-ratio"[^>]*>/);
    const outerTag = outerMatch ? outerMatch[0] : "";
    expect(outerTag).not.toMatch(/flex|grid/);
  });
});

// ---------------------------------------------------------------------------
// Ratio CSS custom property mechanism (spec §6, §5)
// ---------------------------------------------------------------------------
describe("aspect-ratio -- ratio CSS custom property", () => {
  test("computes _ratio as ratioX + ' / ' + ratioY in a !{var} block", () => {
    expect(src).toMatch(/_ratio\s*=\s*ratioX\s*\+\s*" \/ "\s*\+\s*ratioY/);
  });

  test("emits --lv-ar-ratio: <ratio> as an inline style on the outer element", () => {
    expect(markup).toContain("--lv-ar-ratio:");
    // The value comes from the _ratio variable via ${...} or concatenation
    expect(markup).toContain("${_outerStyle}");
  });

  test("inner element uses aspect-ratio: var(--lv-ar-ratio) (reads the custom property)", () => {
    expect(markup).toContain("aspect-ratio:var(--lv-ar-ratio)");
  });

  test("inner element is size-full (100% width + height fills the constrained outer box)", () => {
    // The inner element fills the box: width:100% + height:100% defined in _innerStyle
    // The style is emitted via ${_innerStyle} (a Java variable); assert the variable definition
    expect(src).toContain("_innerStyle");
    expect(src).toMatch(/_innerStyle\s*=\s*"[^"]*width:100%/);
    expect(src).toMatch(/_innerStyle\s*=\s*"[^"]*height:100%/);
  });

  test("data-ratio attribute carries ratioX:ratioY for debugging + CSS selectors", () => {
    expect(markup).toContain('data-ratio="${_dataRatio}"');
    expect(src).toMatch(/_dataRatio\s*=\s*ratioX\s*\+\s*":"\s*\+\s*ratioY/);
  });

  test("does NOT use the legacy padding-top hack (spec anti-pattern)", () => {
    expect(markup).not.toMatch(/padding-top:\s*\d+(\.\d+)?%/);
    expect(markup).not.toContain("padding-top");
  });
});

// ---------------------------------------------------------------------------
// Overflow (spec §2, §3)
// ---------------------------------------------------------------------------
describe("aspect-ratio -- overflow param", () => {
  test("overflow value is injected into the outer element's inline style", () => {
    expect(markup).toContain("overflow:");
    // The _overflowStyle variable is built from the overflow param
    expect(src).toContain("_overflowStyle");
  });

  test("overflow variable is built with 'overflow:' + overflow param string concatenation", () => {
    expect(src).toMatch(/_overflowStyle\s*=\s*"overflow:"\s*\+\s*overflow/);
  });

  test("default overflow is 'hidden' (clips content to the ratio box)", () => {
    expect(src).toContain('@param String overflow = "hidden"');
  });
});

// ---------------------------------------------------------------------------
// Rounded corners (spec §2, §5)
// ---------------------------------------------------------------------------
describe("aspect-ratio -- rounded param", () => {
  test("rounded 'sm' maps to --lv-radius-sm token", () => {
    expect(src).toContain('"border-radius:var(--lv-radius-sm);"');
  });

  test("rounded 'md' maps to --lv-radius-md token", () => {
    expect(src).toContain('"border-radius:var(--lv-radius-md);"');
  });

  test("rounded 'lg' maps to --lv-radius-lg token", () => {
    expect(src).toContain('"border-radius:var(--lv-radius-lg);"');
  });

  test("rounded 'xl' maps to --lv-radius-xl token", () => {
    expect(src).toContain('"border-radius:var(--lv-radius-xl);"');
  });

  test("rounded 'full' maps to --lv-radius-full token", () => {
    expect(src).toContain('"border-radius:var(--lv-radius-full);"');
  });

  test("rounded '' (default) emits no border-radius style (empty string in switch)", () => {
    // The default case of the switch must be empty string
    expect(src).toMatch(/default\s*->\s*"";/);
  });
});

// ---------------------------------------------------------------------------
// Border param (spec §2, §5)
// ---------------------------------------------------------------------------
describe("aspect-ratio -- border param", () => {
  test("border=true emits border style using --lv-color-border token", () => {
    expect(src).toContain('"border:1px solid var(--lv-color-border);"');
  });

  test("border=false emits empty string (no border added)", () => {
    expect(src).toMatch(/border\s*\?\s*"border:1px solid var\(--lv-color-border\);"\s*:\s*""/);
  });
});

// ---------------------------------------------------------------------------
// cssClass and innerClass pass-through (spec §2)
// ---------------------------------------------------------------------------
describe("aspect-ratio -- cssClass and innerClass pass-through", () => {
  test("cssClass is appended to the outer element's class", () => {
    expect(markup).toContain("${cssClass}");
    // cssClass appears in the outer element context (before the inner div)
    const outerArea = markup.slice(0, markup.indexOf('data-slot="aspect-ratio-inner"'));
    expect(outerArea).toContain("${cssClass}");
  });

  test("innerClass is appended to the inner element's class", () => {
    expect(markup).toContain("${innerClass}");
    const innerArea = markup.slice(markup.indexOf('data-slot="aspect-ratio-inner"'));
    expect(innerArea.slice(0, innerArea.indexOf("${content}"))).toContain("${innerClass}");
  });
});

// ---------------------------------------------------------------------------
// Content slot projection (spec §7)
// ---------------------------------------------------------------------------
describe("aspect-ratio -- content slot projection", () => {
  test("content is projected inside the inner element (between data-slot-inner and /div)", () => {
    const innerArea = markup.slice(markup.indexOf('data-slot="aspect-ratio-inner"'));
    expect(innerArea.slice(0, innerArea.indexOf("</div>") + 10)).toContain("${content}");
  });

  test("content slot is declared as gg.jte.Content (not a String)", () => {
    expect(src).toContain("@param gg.jte.Content content");
  });
});

// ---------------------------------------------------------------------------
// attrs pass-through (trusted raw channel)
// ---------------------------------------------------------------------------
describe("aspect-ratio -- attrs trusted raw channel", () => {
  test("attrs emitted with $unsafe on the outer element", () => {
    expect(markup).toContain("$unsafe{attrs}");
    // attrs should be on the outer element
    const outerArea = markup.slice(0, markup.indexOf('data-slot="aspect-ratio-inner"'));
    expect(outerArea).toContain("$unsafe{attrs}");
  });
});

// ---------------------------------------------------------------------------
// A11y contract: semantically transparent wrapper (spec §4)
// ---------------------------------------------------------------------------
describe("aspect-ratio -- a11y: no role or aria-* on wrapper", () => {
  test("outer div carries no role attribute (semantically transparent)", () => {
    const outerTag = markup.match(/<div[^>]*data-slot="aspect-ratio"[^>]*/)?.[0] ?? "";
    expect(outerTag).not.toMatch(/\brole=/);
  });

  test("inner div carries no role attribute", () => {
    const innerTag = markup.match(/<div[^>]*data-slot="aspect-ratio-inner"[^>]*/)?.[0] ?? "";
    expect(innerTag).not.toMatch(/\brole=/);
  });

  test("outer div carries no aria-* attribute", () => {
    const outerTag = markup.match(/<div[^>]*data-slot="aspect-ratio"[^>]*/)?.[0] ?? "";
    expect(outerTag).not.toMatch(/\baria-/);
  });

  test("inner div carries no aria-* attribute", () => {
    const innerTag = markup.match(/<div[^>]*data-slot="aspect-ratio-inner"[^>]*/)?.[0] ?? "";
    expect(innerTag).not.toMatch(/\baria-/);
  });

  test("neither wrapper element has tabindex (not focusable)", () => {
    expect(markup).not.toMatch(/<div[^>]*data-slot="aspect-ratio(?:-inner)?"[^>]*tabindex/);
  });
});

// ---------------------------------------------------------------------------
// Security / CSP hygiene
// ---------------------------------------------------------------------------
describe("aspect-ratio -- security and CSP hygiene", () => {
  test("no inline <script> tag", () => {
    expect(src).not.toMatch(/<script/i);
  });

  test("no inline on* event handler attributes", () => {
    const inlineHandlers = markup.match(/\son[a-z]+=/gi) ?? [];
    expect(inlineHandlers, `unexpected inline handlers: ${inlineHandlers.join(", ")}`).toEqual([]);
  });

  test("no bare hex colour leaks into the markup", () => {
    expect(markup, "leaked a hardcoded hex colour").not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  test("uses JTE comment syntax <%-- --%>, not @* *@", () => {
    expect(src).not.toMatch(/@\*/);
  });

  test("no em-dash (house rule)", () => {
    expect(src).not.toContain("—"); // U+2014 EM DASH
  });

  test("no io.lievit import (JTE classpath is JDK + jte + icons only)", () => {
    expect(src).not.toMatch(/import io\.lievit/);
  });
});
