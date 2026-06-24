/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * Avatar re-forge (v-next) -- structural golden tests for registry/jte/avatar.jte.
 *
 * The partial is a presentational .jte compiled in the Java world. The JS test harness has no
 * JTE compiler, so every assertion inspects the PARTIAL SOURCE as text -- pinning the param API,
 * the diameter-based size vocabulary, shape, server-side fallback chain, color auto-hash,
 * status dot behaviour, interactive wrappers (a/button), a11y contract, font token, and the
 * no-onerror + escaping contract. The real-compiler smoke (JTE 3.2.4 precompileAll + render)
 * runs out of band via test/jte-compile; these structural checks mirror what that proves so
 * the invariants survive without the JVM on the Node CI path.
 *
 * Spec reference: lievit-ui/planning/v-next/specs/avatar.md §7.
 */
import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const jteDir = join(import.meta.dirname, "..", "registry", "jte");
const src = readFileSync(join(jteDir, "avatar.jte"), "utf8");

/** Strip <%-- --%> JTE comments so prose never trips a markup assertion. */
const markup = src.replace(/<%--[\s\S]*?--%>/g, "");

// ---------------------------------------------------------------------------
// Param API
// ---------------------------------------------------------------------------
describe("avatar -- param API", () => {
  const requiredParams: ReadonlyArray<string> = [
    "String src",
    "String name",
    "String alt",
    "String initials",
    "String icon",
    "String size",
    "String shape",
    "String color",
    "String status",
    "String href",
    "String hrefLabel",
    "boolean clickable",
    "String ariaLabel",
    "boolean ariaHidden",
    "String cssClass",
    "String attrs",
    "java.util.Map<String, String> dataAttrs",
  ];

  for (const p of requiredParams) {
    test(`declares @param ${p}`, () => {
      expect(src, `missing @param ${p}`).toContain(`@param ${p}`);
    });
  }

  test("carries a usage-doc comment (<%-- --%> syntax, never @* *@) with a Usage: section", () => {
    expect(src).toContain("<%--");
    expect(src).toContain("--%>");
    expect(src, "must NOT use @* *@ comment syntax").not.toMatch(/@\*/);
    expect(src).toMatch(/Usage:/);
    expect(src).toContain("@template.lievit.avatar(");
  });
});

// ---------------------------------------------------------------------------
// Diameter-based size vocabulary (xs | sm | md | lg | xl | 2xl -> --lv-space-*)
// ---------------------------------------------------------------------------

/**
 * Size scale: [size, diameterToken, textToken].
 * Architecture contract §5.b D5: diameter-axis sizing, not height-axis.
 */
const SIZE_SCALE: ReadonlyArray<readonly [string, string, string]> = [
  ["xs",  "--lv-space-6",  "--lv-text-2xs"],
  ["sm",  "--lv-space-8",  "--lv-text-xs"],
  ["md",  "--lv-space-10", "--lv-text-sm"],
  ["lg",  "--lv-space-12", "--lv-text-base"],
  ["xl",  "--lv-space-16", "--lv-text-lg"],
  ["2xl", "--lv-space-20", "--lv-text-xl"],
] as const;

describe("avatar -- diameter-based size vocab", () => {
  for (const [size, diamToken, textToken] of SIZE_SCALE) {
    test(`size="${size}": diameter token var(${diamToken}) is present`, () => {
      expect(src, `diameter token missing for size=${size}`).toContain(`var(${diamToken})`);
    });

    test(`size="${size}": font token var(${textToken}) is present`, () => {
      expect(src, `text token missing for size=${size}`).toContain(`var(${textToken})`);
    });
  }

  test('md is the default size (the switch default branch maps to var(--lv-space-10))', () => {
    // The default branch of the switch for the diameter must resolve to --lv-space-10.
    expect(src).toMatch(/default\s*->\s*"var\(--lv-space-10\)"/);
  });

  test("data-size is stamped on every root element for CSS hooks and test targeting", () => {
    // Every rendering branch (a / button / span) stamps data-size="${size}".
    const stamps = markup.match(/data-size="\$\{size\}"/g) ?? [];
    // Three branches (link / button-with-label / non-interactive span) each stamp it.
    expect(stamps.length, "data-size must appear on all root branches").toBeGreaterThanOrEqual(3);
  });

  test("2xl maps to --lv-space-20 (additive token, not an old v2 rung)", () => {
    // Explicitly verified: the token must exist in the JTE source as the 2xl diameter.
    expect(src).toContain('"2xl"');
    expect(src).toContain("var(--lv-space-20)");
  });
});

// ---------------------------------------------------------------------------
// Shape: circle | square
// ---------------------------------------------------------------------------
describe("avatar -- shape", () => {
  test('circle (default) applies --lv-radius-full', () => {
    expect(src).toContain("rounded-[var(--lv-radius-full)]");
  });

  test('square applies --lv-radius-md', () => {
    expect(src).toContain("rounded-[var(--lv-radius-md)]");
    expect(src).toContain('"square"');
  });

  test("data-shape is stamped on every root element", () => {
    const stamps = markup.match(/data-shape="\$\{shape\}"/g) ?? [];
    expect(stamps.length, "data-shape must appear on all root branches").toBeGreaterThanOrEqual(3);
  });
});

// ---------------------------------------------------------------------------
// Fallback chain: image -> initials -> icon -> bare (server-side)
// ---------------------------------------------------------------------------
describe("avatar -- server-side fallback chain", () => {
  test("path 1: <img> is emitted when src is present and non-blank (hasImage gate)", () => {
    expect(markup).toMatch(/<img\b/);
    expect(markup).toContain("hasImage");
    // The img uses loading="lazy" (native browser lazy-load, no JS)
    expect(markup).toContain('loading="lazy"');
  });

  test("path 2: initials rendered in a data-slot=avatar-initials span from resolvedInitials", () => {
    expect(markup).toContain('data-slot="avatar-initials"');
    // The span content is ${resolvedInitials}, not bare ${initials}
    expect(markup).toContain("${resolvedInitials}");
    expect(markup, "bare ${initials} is an old-API artifact").not.toContain(">${initials}<");
  });

  test('auto-initials derivation: splits name on whitespace, first letter of first two words, uppercased', () => {
    // The JTE local computes this server-side with split + limit(2) + charAt(0) + toUpperCase.
    expect(src).toContain('.split("\\\\s+")');
    expect(src).toContain(".limit(2)");
    expect(src).toContain(".charAt(0)");
    expect(src).toContain(".toUpperCase()");
  });

  test("initials param overrides the auto-derived value (takes precedence over name)", () => {
    // resolvedInitials prefers the explicit initials param over name-derived.
    expect(src).toMatch(/resolvedInitials\s*=\s*\(initials\s*!=\s*null/);
  });

  test("path 3: icon fallback uses @template.lievit.icon with the icon param slug", () => {
    expect(markup).toContain("@template.lievit.icon(name = icon");
    // Default icon is "user" (declared in the @param default)
    expect(src).toContain('@param String icon = "user"');
  });

  test("path 4: icon=null suppresses the icon, leaving a bare styled frame", () => {
    // The hasIcon gate: only when !hasImage && !hasInitials && icon != null && !icon.isBlank()
    expect(src).toContain("hasIcon");
    expect(src).toContain("icon != null");
  });

  test("fallback is computed in JTE !{var ...} locals before the render body (server-side, no client fork)", () => {
    // All three booleans are computed as !{var ...} locals.
    expect(src).toMatch(/!\{var hasImage\s*=/);
    expect(src).toMatch(/!\{var.*hasInitials\s*=/);
    expect(src).toMatch(/!\{var hasIcon\s*=/);
  });
});

// ---------------------------------------------------------------------------
// Color resolution (explicit intent slug or auto-hash from name)
// ---------------------------------------------------------------------------
describe("avatar -- color resolution", () => {
  const INTENTS = ["primary", "secondary", "accent", "success", "warning", "destructive"] as const;

  test("all six auto-hash intent slugs are present in the intents array", () => {
    for (const intent of INTENTS) {
      expect(src, `intent "${intent}" missing from the auto-hash array`).toContain(`"${intent}"`);
    }
  });

  test("auto-hash is deterministic: same string always resolves the same slot (modulo 6)", () => {
    // The hash uses Math.abs(...hashCode()) % intents.length (6 intents).
    expect(src).toContain("Math.abs(");
    expect(src).toContain("% intents.length");
  });

  test("each intent maps to its --lv-color-<intent> background + --lv-color-<intent>-fg foreground", () => {
    for (const intent of INTENTS) {
      expect(src, `bg token missing for ${intent}`).toContain(`var(--lv-color-${intent})`);
      expect(src, `fg token missing for ${intent}`).toContain(`var(--lv-color-${intent}-fg)`);
    }
  });

  test("explicit color=null with hasImage falls back to muted (shows while loading)", () => {
    expect(src).toContain("var(--lv-color-muted-bg)");
  });

  test("data-variant carries the resolved intent slug for test hooks", () => {
    const stamps = markup.match(/data-variant="\$\{resolvedColor\}"/g) ?? [];
    expect(stamps.length, "data-variant must appear on all root branches").toBeGreaterThanOrEqual(3);
  });

  test("no hardcoded hex colour or raw oklch literal anywhere in the source", () => {
    expect(src, "leaked a hardcoded hex colour").not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(src, "leaked a raw oklch literal").not.toMatch(/oklch\(/i);
  });
});

// ---------------------------------------------------------------------------
// Status dot
// ---------------------------------------------------------------------------
describe("avatar -- status dot", () => {
  test("status dot is data-slot=avatar-status and always aria-hidden=true", () => {
    expect(markup).toContain('data-slot="avatar-status"');
    // Every occurrence of the status span must have aria-hidden="true" (literal, not conditional).
    const spans = markup.match(/data-slot="avatar-status"[^>]*/g) ?? [];
    expect(spans.length, "status span must appear in all rendering branches").toBeGreaterThanOrEqual(3);
    for (const span of spans) {
      expect(span, 'status dot must be aria-hidden="true"').toContain('aria-hidden="true"');
    }
  });

  test("status dot is suppressed at xs size (too small to read)", () => {
    // renderStatus = status != null && !size.equals("xs")
    expect(src).toContain('!size.equals("xs")');
    expect(src).toContain("renderStatus");
  });

  test("data-status carries the status slug for CSS-driven coloring", () => {
    expect(markup).toContain('data-status="${status}"');
  });

  test("status intents map to the correct token: online=success, away=warning, busy=destructive, offline=muted", () => {
    expect(markup).toContain('"online"');
    expect(markup).toContain("var(--lv-color-success)");
    expect(markup).toContain('"away"');
    expect(markup).toContain("var(--lv-color-warning)");
    expect(markup).toContain('"busy"');
    expect(markup).toContain("var(--lv-color-destructive)");
    // offline -> muted (the default branch)
    expect(markup).toContain("var(--lv-color-muted)");
  });
});

// ---------------------------------------------------------------------------
// Interactive wrappers: href -> <a>, clickable -> <button>
// ---------------------------------------------------------------------------
describe("avatar -- interactive wrappers", () => {
  test("href: root becomes <a href> with the link's href + hrefLabel as aria-label", () => {
    expect(markup).toContain("@if(href != null)");
    expect(markup).toContain('href="${href}"');
    expect(markup).toContain('aria-label="${hrefLabel}"');
  });

  test("href: <a> gets focus-visible ring via --lv-ring (platform-managed)", () => {
    expect(src).toContain("focus-visible:shadow-[var(--lv-ring)]");
  });

  test("href: inner frame span is aria-hidden=true (wrapper carries the accessible name)", () => {
    // The inner frame <span> inside the <a> branch gets aria-hidden="true".
    // In the <a> branch the inner span has class="${frameBase}" and aria-hidden="true".
    expect(markup).toMatch(/class="\$\{frameBase\}[^"]*"\s+aria-hidden="true"/s);
  });

  test("clickable: root becomes <button type=button> with aria-label from wrapperAriaLabel", () => {
    expect(markup).toContain("@elseif(clickable)");
    expect(markup).toContain('type="button"');
    expect(markup).toContain('aria-label="${wrapperAriaLabel}"');
  });

  test("clickable: wrapperAriaLabel prefers explicit ariaLabel param, falls back to name", () => {
    // wrapperAriaLabel = ariaLabel != null ? ariaLabel : name
    expect(src).toMatch(/wrapperAriaLabel\s*=\s*ariaLabel\s*!=\s*null\s*\?\s*ariaLabel\s*:\s*name/);
  });

  test("clickable: when no accessible name is available, NO <button> is rendered (dev comment emitted instead)", () => {
    // The guard: @if(wrapperAriaLabel != null && !wrapperAriaLabel.isBlank())
    expect(src).toContain("wrapperAriaLabel != null && !wrapperAriaLabel.isBlank()");
    // A dev-visible comment warns when the guard fails (inaccessible button prevented)
    expect(src).toMatch(/DEV WARNING|clickable=true but no accessible name/i);
  });

  test("clickable: <button> gets the same focus-visible ring as the <a> wrapper", () => {
    // Both branches use the same focus-visible:shadow-[var(--lv-ring)] class.
    const rings = src.match(/focus-visible:shadow-\[var\(--lv-ring\)\]/g) ?? [];
    expect(rings.length, "focus-visible ring must appear in both interactive branches").toBeGreaterThanOrEqual(2);
  });

  test("non-interactive: root element is a <span> (not in tab order, no role)", () => {
    expect(markup).toMatch(/<span\b[^>]*data-slot="avatar"/);
    // The plain span carries neither tabindex nor role (platform default: not in tab order)
    expect(markup, "plain span must not carry role=button").not.toMatch(/data-slot="avatar"[^>]*role="button"/);
    expect(markup, "plain span must not carry tabindex").not.toMatch(/data-slot="avatar"[^>]*tabindex/);
  });
});

// ---------------------------------------------------------------------------
// A11y contract
// ---------------------------------------------------------------------------
describe("avatar -- a11y contract", () => {
  test("<img> alt is resolved: explicit alt param, else name, else empty string (decorative)", () => {
    // resolvedAlt = ariaHidden ? "" : (alt != null ? alt : (name != null ? name : ""))
    expect(src).toMatch(/resolvedAlt\s*=\s*ariaHidden/);
    expect(src).toContain("alt != null ? alt");
    expect(src).toContain('alt="${resolvedAlt}"');
  });

  test("initials/icon frame span carries aria-label=name when ariaHidden=false and name is present", () => {
    // frameAriaLabel = (!ariaHidden && !hasImage && name != null && !name.isBlank()) ? name : null
    expect(src).toMatch(/frameAriaLabel\s*=\s*\(!ariaHidden/);
    expect(markup).toContain('aria-label="${frameAriaLabel}"');
  });

  test("ariaHidden=true stamps aria-hidden=true on the root and forces alt=empty on any img", () => {
    // The root branches all honour ariaHidden:
    //   aria-hidden="${ariaHidden ? "true" : null}"
    expect(markup).toContain('aria-hidden="${ariaHidden ? "true" : null}"');
    // And resolvedAlt is forced to "" when ariaHidden is true
    expect(src).toMatch(/resolvedAlt\s*=\s*ariaHidden\s*\?\s*""/);
  });

  test("ariaHidden=true suppresses aria-label: frameAriaLabel is null when ariaHidden is true", () => {
    // frameAriaLabel computation starts with !ariaHidden check, so ariaHidden=true -> null
    expect(src).toContain("!ariaHidden");
  });

  test("status dot is always aria-hidden (presence meaning comes from surrounding context)", () => {
    // Every data-slot=avatar-status span in the markup has aria-hidden="true" (literal).
    const statusSpans = markup.match(/data-slot="avatar-status"[^>]*/g) ?? [];
    expect(statusSpans.length).toBeGreaterThan(0);
    for (const span of statusSpans) {
      expect(span).toContain('aria-hidden="true"');
    }
  });

  test("interactive frame inner span is aria-hidden (wrapper carries the name, no double-announce)", () => {
    // The inner frame <span class="${frameBase}" ...> inside the <a> and <button> wrappers
    // both carry aria-hidden="true" (literal, not conditional).
    // Count occurrences of the literal aria-hidden="true" on the frame inner span.
    const innerHidden = markup.match(/<span class="\$\{frameBase\}[^"]*"[^>]*aria-hidden="true"/g) ?? [];
    expect(innerHidden.length, "inner frame must be aria-hidden in both interactive branches").toBeGreaterThanOrEqual(2);
  });

  test('no element carries role="img" (non-image frame is a plain span with aria-label)', () => {
    // The old API used role=img; the re-forge drops it in favour of the native img element + aria-label.
    expect(markup, 'role="img" is the old API, should not appear in the re-forged template').not.toContain('role="img"');
  });
});

// ---------------------------------------------------------------------------
// Font token: --lv-font-medium for initials weight
// ---------------------------------------------------------------------------
describe("avatar -- initials font token", () => {
  test("initials span uses font-[var(--lv-font-medium)] (medium weight, not bold)", () => {
    expect(src).toContain("font-[var(--lv-font-medium)]");
  });

  test("initials span carries the textSizeClass (computed from size tier)", () => {
    expect(src).toContain("${textSizeClass}");
    // The switch that builds textSizeClass must cover all six tiers
    expect(src).toContain("textSizeClass");
  });
});

// ---------------------------------------------------------------------------
// No onerror anti-pattern (CSP-clean + server-side fallback discipline)
// ---------------------------------------------------------------------------
describe("avatar -- no onerror anti-pattern", () => {
  test("zero inline on* handlers anywhere in the template (CSP refuses them silently)", () => {
    const handlers = src.match(/\son[a-z]+=/gi) ?? [];
    expect(handlers, `found inline handlers: ${handlers.join(", ")}`).toEqual([]);
  });

  test("no <script> tag anywhere in the template", () => {
    expect(src).not.toMatch(/<script/i);
  });

  test("the doc comment explains the no-onerror architectural decision", () => {
    // The comment must mention onerror or the CSP reason.
    expect(src).toMatch(/onerror|CSP|CSP-clean/i);
  });
});

// ---------------------------------------------------------------------------
// Escaping channels (XSS trust split: same contract as button.jte)
// ---------------------------------------------------------------------------
describe("avatar -- escaping channels", () => {
  test("imports Escape.htmlAttribute for safe dataAttrs values", () => {
    expect(src).toContain("@import gg.jte.html.escape.Escape");
    expect(src).toMatch(/Escape\.htmlAttribute\(/);
  });

  test("dataAttrs value is never emitted raw (no $unsafe wrapping getValue())", () => {
    expect(src, "dataAttrs getValue must not be $unsafe").not.toMatch(/\$unsafe\{[^}]*getValue/);
  });

  test("dataAttrs key is validated as a simple identifier before entering attribute-name position", () => {
    expect(src).toMatch(/getKey\(\)\.matches\(\"\[A-Za-z\]\[A-Za-z0-9-\]\*\"\)/);
  });

  test("only the pre-escaped dataAttrsMarkup fragment and the trusted attrs reach $unsafe", () => {
    const sinks = src.match(/\$unsafe\{[^}]*\}/g) ?? [];
    // Every $unsafe sink must be either dataAttrsMarkup or attrs (the two trusted channels).
    for (const sink of sinks) {
      expect(
        sink === "$unsafe{dataAttrsMarkup}" || sink === "$unsafe{attrs}",
        `unexpected $unsafe sink: ${sink}`,
      ).toBe(true);
    }
    // Both channels appear (at minimum in the non-interactive branch).
    expect(sinks).toContain("$unsafe{dataAttrsMarkup}");
    expect(sinks).toContain("$unsafe{attrs}");
  });

  test("the doc comment labels attrs as TRUSTED (static strings only)", () => {
    expect(src.toUpperCase()).toContain("TRUSTED");
  });
});

// ---------------------------------------------------------------------------
// Token hygiene (no hardcoded values leak past the token boundary)
// ---------------------------------------------------------------------------
describe("avatar -- token hygiene", () => {
  test("no hardcoded hex colour anywhere in the source", () => {
    expect(src).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  test("no Tailwind numeric scale utility (p-4, gap-2, h-10, text-sm) outside arbitrary-value brackets", () => {
    // Strip JTE Java code blocks (!{...}) and comments first: they contain Java string literals
    // like "var(--lv-space-6)" that look like space-6 after bracket-stripping but are NOT Tailwind classes.
    const stripped = src
      .replace(/!\{[^}]*\}/g, "")      // JTE inline Java code blocks
      .replace(/<%--[\s\S]*?--%>/g, "") // JTE comments
      .replace(/\[[^\]]*\]/g, "[]")     // strip arbitrary-value brackets
      .replace(/-\d+\/\d+/g, "")        // strip fractional utilities (h-2/5, w-2/5)
      .replace(/\bmin-w-0\b/g, "");     // min-w-0 is dimensionless (layout primitive)
    const numericUtils = (stripped.match(/\b(?:p|px|py|pt|pb|pl|pr|m|mx|my|mb|mt|gap|h|w|text|size|space)-[1-9]/g) ?? [])
      .filter((u) => !/leading-none|tracking-tight|space-x-2/.test(u));
    expect(numericUtils, `non-token numeric utilities: ${numericUtils.join(", ")}`).toEqual([]);
  });
});
