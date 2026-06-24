/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * stat-card.jte -- full structural + a11y contract (spec planning/v-next/specs/stat-card.md §7).
 *
 * The stat-card is a static JTE partial compiled in the Java world. This harness asserts on the
 * PARTIAL SOURCE as text, pinning the param API, the semantic root structure (figure / a wrapping),
 * the value row (prefix + value + suffix), the trend indicator (role=img + aria-label auto-generation),
 * the loading skeleton, slot topology (data-slot attributes), variant left-border accent, size
 * vocabulary, the escaping channels (attrs trusted-raw, dataAttrs Escape.htmlAttribute), and the
 * a11y contract (aria-labelledby on non-linked figure, aria-hidden on linked figure, aria-busy on
 * loading). The real-compiler gate (JTE 3.2.4 precompileAll + render) runs in test/jte-compile;
 * these structural checks mirror what that proves so the invariants survive without the JVM on the
 * Node CI path.
 *
 * Spec: planning/v-next/specs/stat-card.md
 */
import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const jteDir = join(import.meta.dirname, "..", "registry", "jte");
const src = readFileSync(join(jteDir, "stat-card.jte"), "utf8");

/** Strip <%-- --%> JTE comments so prose never trips a markup assertion. */
const markup = src.replace(/<%--[\s\S]*?--%>/g, "");

// ---------------------------------------------------------------------------
// Param API (spec §2)
// ---------------------------------------------------------------------------
describe("stat-card -- param API", () => {
  test("declares required params (title, value) with no default", () => {
    expect(src).toContain("@param String title");
    expect(src).toContain("@param String value");
    // Required params have no default assignment
    expect(src).not.toMatch(/@param String title\s*=/);
    expect(src).not.toMatch(/@param String value\s*=/);
  });

  test('declares prefix, suffix, description with empty-string defaults', () => {
    expect(src).toContain('@param String prefix = ""');
    expect(src).toContain('@param String suffix = ""');
    expect(src).toContain('@param String description = ""');
  });

  test('declares trend defaults to "none"', () => {
    expect(src).toContain('@param String trend = "none"');
  });

  test("declares trendValue and trendLabel with empty-string defaults", () => {
    expect(src).toContain('@param String trendValue = ""');
    expect(src).toContain('@param String trendLabel = ""');
  });

  test("declares loading as boolean defaulting to false", () => {
    expect(src).toContain("@param boolean loading = false");
  });

  test('declares size defaulting to "md"', () => {
    expect(src).toContain('@param String size = "md"');
  });

  test('declares variant defaulting to "default"', () => {
    expect(src).toContain('@param String variant = "default"');
  });

  test("declares href defaulting to null (optional link)", () => {
    expect(src).toContain("@param String href = null");
  });

  test("declares three gg.jte.Content slots: leading, trailing, footer", () => {
    expect(src).toContain("@param gg.jte.Content leading = null");
    expect(src).toContain("@param gg.jte.Content trailing = null");
    expect(src).toContain("@param gg.jte.Content footer = null");
  });

  test("declares cssClass, attrs, and dataAttrs channels", () => {
    expect(src).toContain('@param String cssClass = ""');
    expect(src).toContain('@param String attrs = ""');
    expect(src).toContain("@param java.util.Map<String, String> dataAttrs = java.util.Map.of()");
  });

  test("usage doc carries the @@template.lievit.stat-card call syntax", () => {
    expect(src).toContain("@@template.lievit.stat-card(");
  });
});

// ---------------------------------------------------------------------------
// No io.lievit imports (hard rule from REFORGE-AGENT-BRIEF.md)
// ---------------------------------------------------------------------------
describe("stat-card -- no io.lievit imports", () => {
  test("never imports io.lievit.* (JTE classpath has only JDK + jte + icons)", () => {
    expect(src).not.toMatch(/import io\.lievit/);
  });
});

// ---------------------------------------------------------------------------
// Root element structure: figure (non-linked) vs a > figure (linked)
// ---------------------------------------------------------------------------
describe("stat-card -- root element structure", () => {
  test("has data-slot='stat-card' on the figure element", () => {
    expect(markup).toContain('data-slot="stat-card"');
  });

  test("uses figure as the semantic root (not div)", () => {
    expect(markup).toMatch(/<figure[\s>]/);
  });

  test("non-linked figure carries aria-labelledby referencing the title id", () => {
    expect(markup).toContain("aria-labelledby=");
    expect(markup).toContain("_titleId");
  });

  test("link path: renders an a element with data-slot='stat-card-link'", () => {
    expect(markup).toContain('data-slot="stat-card-link"');
  });

  test("linked figure carries aria-hidden='true' (not double-announced)", () => {
    // The a carries aria-label; the inner figure is aria-hidden
    expect(markup).toContain('aria-hidden="true"');
  });

  test("the a element carries an aria-label composed from title + prefix + value + suffix", () => {
    // Verify the _linkLabel variable is built and used
    expect(src).toContain("_linkLabel");
    expect(markup).toContain('aria-label="${_linkLabel}"');
  });

  test("emits data-variant and data-size on the figure root", () => {
    expect(markup).toContain('data-variant="${variant}"');
    expect(markup).toContain('data-size="${size}"');
  });
});

// ---------------------------------------------------------------------------
// Title / figcaption (spec §4 a11y)
// ---------------------------------------------------------------------------
describe("stat-card -- title / figcaption", () => {
  test("uses figcaption element for the title (not span or p)", () => {
    expect(markup).toMatch(/<figcaption[\s>]/);
  });

  test("figcaption carries data-slot='stat-card-title'", () => {
    expect(markup).toContain('data-slot="stat-card-title"');
  });

  test("non-linked figcaption carries the id that aria-labelledby points to", () => {
    expect(markup).toContain('id="${_titleId}"');
  });

  test("title renders through JTE html-escaped ${} channel (not $unsafe)", () => {
    expect(markup).toContain("${title}");
    expect(src).not.toMatch(/\$unsafe\{title\}/);
  });
});

// ---------------------------------------------------------------------------
// Value row: prefix + value + suffix (spec §2, §4)
// ---------------------------------------------------------------------------
describe("stat-card -- value row", () => {
  test("has data-slot='stat-card-value-row'", () => {
    expect(markup).toContain('data-slot="stat-card-value-row"');
  });

  test("value is rendered in a p element with data-slot='stat-card-value'", () => {
    expect(markup).toContain('data-slot="stat-card-value"');
    expect(markup).toMatch(/<p[\s\S]*?data-slot="stat-card-value"/);
  });

  test("value p carries aria-atomic='true' for HTMX morph re-read", () => {
    expect(markup).toContain('aria-atomic="true"');
  });

  test("prefix rendered in span with aria-hidden='true' and data-slot='stat-card-prefix'", () => {
    expect(markup).toContain('data-slot="stat-card-prefix"');
    // The prefix span must be aria-hidden (decorative symbol)
    expect(markup).toMatch(/data-slot="stat-card-prefix"[\s\S]*?aria-hidden|aria-hidden[\s\S]*?data-slot="stat-card-prefix"/);
  });

  test("suffix rendered in span with aria-hidden='true' and data-slot='stat-card-suffix'", () => {
    expect(markup).toContain('data-slot="stat-card-suffix"');
    expect(markup).toMatch(/data-slot="stat-card-suffix"[\s\S]*?aria-hidden|aria-hidden[\s\S]*?data-slot="stat-card-suffix"/);
  });

  test("value font-size is derived from _sizeValue variable (size param controls prominence)", () => {
    expect(src).toContain("_sizeValue");
    expect(markup).toContain("${_sizeValue}");
  });

  test("value color uses --lv-color-fg (always full-contrast, not muted)", () => {
    expect(markup).toContain("var(--lv-color-fg)");
  });
});

// ---------------------------------------------------------------------------
// Trend indicator (spec §3 States, §4 a11y)
// ---------------------------------------------------------------------------
describe("stat-card -- trend indicator", () => {
  test("trend indicator has data-slot='stat-card-trend'", () => {
    expect(markup).toContain('data-slot="stat-card-trend"');
  });

  test("trend container emits data-trend attribute for CSS styling hooks", () => {
    expect(markup).toContain('data-trend="${trend}"');
  });

  test("trend span carries role='img' (not a decorative element)", () => {
    expect(markup).toContain('role="img"');
  });

  test("trend span aria-label uses the _effectiveTrendLabel variable", () => {
    expect(src).toContain("_effectiveTrendLabel");
    expect(markup).toContain('aria-label="${_effectiveTrendLabel}"');
  });

  test("auto trend label for 'up' includes Italian 'in aumento'", () => {
    expect(src).toContain('"Tendenza: in aumento"');
  });

  test("auto trend label for 'down' includes Italian 'in calo'", () => {
    expect(src).toContain('"Tendenza: in calo"');
  });

  test("auto trend label for 'neutral' includes Italian 'stabile'", () => {
    expect(src).toContain('"Tendenza: stabile"');
  });

  test("trend icon SVGs carry aria-hidden='true' (decorative; meaning is in role=img label)", () => {
    // The figure is NOT aria-hidden (the stretched-link a carries aria-label, not aria-hidden on figure).
    // The SVGs inside the trend block must be individually aria-hidden (decorative; meaning is the role=img label).
    expect(markup).toMatch(/aria-hidden="true"><polyline|aria-hidden="true"><line/);
  });

  test("uses inline SVG for trend arrows (no @template.lievit.icon call inside trend block)", () => {
    // The brief mandates inlining trivial bits to avoid cross-partial dependency
    const afterTrend = markup.slice(markup.indexOf('data-slot="stat-card-trend"'));
    expect(afterTrend).toContain("<svg ");
    // No @template call inside the trend section
    expect(afterTrend.slice(0, afterTrend.indexOf("</div>") + 10)).not.toContain("@template.lievit.icon");
  });

  test("trend is guarded: only rendered when trend != 'none'", () => {
    // The _hasTrend variable gates the trend block via @if(_hasTrend)
    expect(src).toContain("_hasTrend");
    expect(src).toContain("@if(_hasTrend)");
  });

  test("trendValue span inside the role=img span is aria-hidden (aria-label carries the full label)", () => {
    expect(markup).toContain("${trendValue}");
    // The trendValue span must be aria-hidden since the label already includes the value text
    expect(markup).toMatch(/aria-hidden="true">\${trendValue}<\/span>/);
  });
});

// ---------------------------------------------------------------------------
// Description (spec §3 States)
// ---------------------------------------------------------------------------
describe("stat-card -- description", () => {
  test("description has data-slot='stat-card-description'", () => {
    expect(markup).toContain('data-slot="stat-card-description"');
  });

  test("description is rendered in a p element", () => {
    expect(markup).toMatch(/<p[\s\S]*?data-slot="stat-card-description"/);
  });

  test("description is guarded by _hasDescription (empty string omits it)", () => {
    expect(src).toContain("_hasDescription");
    expect(src).toContain("@if(_hasDescription)");
  });

  test("description text uses --lv-color-muted-fg (subdued vs the value)", () => {
    // The description p should read the muted-fg token
    expect(markup).toContain("var(--lv-color-muted-fg)");
  });
});

// ---------------------------------------------------------------------------
// Loading skeleton (spec §3 States, §4 a11y)
// ---------------------------------------------------------------------------
describe("stat-card -- loading skeleton", () => {
  test("skeleton container has data-slot='stat-card-skeleton'", () => {
    expect(markup).toContain('data-slot="stat-card-skeleton"');
  });

  test("skeleton container is aria-hidden='true' (visual only)", () => {
    expect(markup).toMatch(/data-slot="stat-card-skeleton"[\s\S]{0,50}aria-hidden="true"|aria-hidden="true"[\s\S]{0,50}data-slot="stat-card-skeleton"/);
  });

  test("loading=true emits aria-busy on the root figure (smart attribute)", () => {
    // Smart attribute: aria-busy="${loading ? "true" : null}" -- JTE omits when null
    expect(src).toContain('aria-busy="${loading ? "true" : null}"');
  });

  test("loading state is guarded by the loading param", () => {
    // In JTE, boolean params gate with @if(loading), not ${loading}
    expect(src).toContain("@if(loading)");
  });

  test("skeleton bars use --lv-color-muted-bg for background (no hardcoded colour)", () => {
    const skeletonArea = markup.slice(markup.indexOf('data-slot="stat-card-skeleton"'));
    expect(skeletonArea.slice(0, skeletonArea.indexOf("</div>") + 50)).toContain("var(--lv-color-muted-bg)");
  });
});

// ---------------------------------------------------------------------------
// Slots: leading, trailing, footer (spec §3 Slots)
// ---------------------------------------------------------------------------
describe("stat-card -- slots", () => {
  test("leading slot renders inside div[data-slot='stat-card-leading']", () => {
    expect(markup).toContain('data-slot="stat-card-leading"');
  });

  test("leading slot div carries aria-hidden='true' (layout decoration)", () => {
    const leadingArea = markup.slice(markup.indexOf('data-slot="stat-card-leading"'));
    expect(leadingArea.slice(0, 200)).toMatch(/aria-hidden="true"/);
  });

  test("trailing slot renders inside div[data-slot='stat-card-trailing']", () => {
    expect(markup).toContain('data-slot="stat-card-trailing"');
  });

  test("trailing slot div has no aria-hidden (adopter may place interactive elements)", () => {
    const trailingArea = markup.slice(markup.indexOf('data-slot="stat-card-trailing"'));
    // The trailing wrapper itself should not be aria-hidden
    expect(trailingArea.slice(0, 100)).not.toMatch(/aria-hidden="true"/);
  });

  test("footer slot renders inside div[data-slot='stat-card-footer']", () => {
    expect(markup).toContain('data-slot="stat-card-footer"');
  });

  test("footer is preceded by an hr[role='separator'][aria-hidden='true']", () => {
    expect(markup).toMatch(/role="separator"[\s\S]{0,100}aria-hidden="true"|aria-hidden="true"[\s\S]{0,100}role="separator"/);
    expect(markup).toContain('role="separator"');
  });
});

// ---------------------------------------------------------------------------
// Variant: left-border accent (spec §3 Variants)
// ---------------------------------------------------------------------------
describe("stat-card -- variant left-border accent", () => {
  test("maps variant 'info' to --lv-color-info token", () => {
    expect(src).toContain('"var(--lv-color-info)"');
  });

  test("maps variant 'success' to --lv-color-success token", () => {
    expect(src).toContain('"var(--lv-color-success)"');
  });

  test("maps variant 'warning' to --lv-color-warning token", () => {
    expect(src).toContain('"var(--lv-color-warning)"');
  });

  test("maps variant 'destructive' to --lv-color-destructive token", () => {
    expect(src).toContain('"var(--lv-color-destructive)"');
  });

  test("default variant maps to transparent (no accent border)", () => {
    expect(src).toContain('"transparent"');
  });

  test("_accentColor is injected into the card inline style string via Java concatenation", () => {
    // _accentColor is built by the switch and concatenated into _cardStyle in the !{var} block
    expect(src).toContain("_accentColor");
    // The _cardStyle concatenation embeds _accentColor as a Java string + operator
    expect(src).toContain("border-left-color:\" + _accentColor");
    // _cardStyle is then emitted in the HTML via ${}
    expect(markup).toContain("${_cardStyle}");
  });
});

// ---------------------------------------------------------------------------
// Size: value font scale (spec §3 Sizes)
// ---------------------------------------------------------------------------
describe("stat-card -- size vocabulary", () => {
  test("size 'sm' maps to --lv-text-2xl for the value", () => {
    expect(src).toContain('"var(--lv-text-2xl)"');
  });

  test("size 'md' (default) maps to --lv-text-3xl for the value", () => {
    expect(src).toContain('"var(--lv-text-3xl)"');
  });

  test("size 'lg' maps to --lv-text-4xl for the value (flagged as TOKENS_NEEDED)", () => {
    // The spec mandates --lv-text-4xl even though it does not yet exist in lievit-tokens.css
    expect(src).toContain('"var(--lv-text-4xl)"');
  });

  test("size 'sm' maps padding to --lv-space-4", () => {
    expect(src).toContain('"var(--lv-space-4)"');
  });

  test("size 'md' maps padding to --lv-space-5", () => {
    expect(src).toContain('"var(--lv-space-5)"');
  });

  test("size 'lg' maps padding to --lv-space-6", () => {
    expect(src).toContain('"var(--lv-space-6)"');
  });
});

// ---------------------------------------------------------------------------
// Token-driven styling: no bare hex (spec §5)
// ---------------------------------------------------------------------------
describe("stat-card -- token-driven styling, no bare hex", () => {
  test("card background uses --lv-color-card token", () => {
    expect(markup).toContain("var(--lv-color-card)");
  });

  test("card border uses --lv-color-border token", () => {
    expect(markup).toContain("var(--lv-color-border)");
  });

  test("card corner radius uses --lv-radius-lg token", () => {
    expect(markup).toContain("var(--lv-radius-lg)");
  });

  test("card elevation uses --lv-shadow-sm token", () => {
    expect(markup).toContain("var(--lv-shadow-sm)");
  });

  test("title uses --lv-font-medium for weight", () => {
    expect(markup).toContain("var(--lv-font-medium)");
  });

  test("value uses --lv-font-semibold for weight (numeric prominence)", () => {
    expect(markup).toContain("var(--lv-font-semibold)");
  });

  test("no bare hex colour leaks into the markup", () => {
    expect(markup, "leaked a hardcoded hex colour").not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
});

// ---------------------------------------------------------------------------
// Escaping channels: attrs (trusted raw) + dataAttrs (safe escaped)
// ---------------------------------------------------------------------------
describe("stat-card -- escaping channels", () => {
  test("imports StringOutput and Escape for the dataAttrs safe channel", () => {
    expect(src).toContain("@import gg.jte.output.StringOutput");
    expect(src).toContain("@import gg.jte.html.escape.Escape");
  });

  test("dataAttrs values routed through Escape.htmlAttribute (never $unsafe)", () => {
    expect(src).toMatch(/Escape\.htmlAttribute\(\s*_e\.getValue\(\)/);
    expect(src, "dataAttrs value must not be emitted raw").not.toMatch(/\$unsafe\{[^}]*getValue/);
  });

  test("dataAttrs key allowlisted to simple identifiers", () => {
    expect(src).toMatch(/getKey\(\)\.matches\("\[A-Za-z\]\[A-Za-z0-9-\]\*"\)/);
  });

  test("attrs param emitted with $unsafe (trusted raw channel)", () => {
    expect(markup).toContain("$unsafe{attrs}");
  });

  test("pre-escaped dataAttrs fragment emitted with $unsafe (fragment is already safe)", () => {
    expect(markup).toContain("$unsafe{_dataAttrsMarkup}");
  });

  test("title rendered through JTE default html-escaping ${}  (not $unsafe)", () => {
    expect(markup).toContain("${title}");
    expect(src).not.toMatch(/\$unsafe\{title\}/);
  });

  test("value rendered through JTE default html-escaping (not $unsafe)", () => {
    expect(markup).toContain("${value}");
    expect(src).not.toMatch(/\$unsafe\{value\}/);
  });
});

// ---------------------------------------------------------------------------
// Security / CSP hygiene
// ---------------------------------------------------------------------------
describe("stat-card -- security and CSP hygiene", () => {
  test("no inline <script> tag", () => {
    expect(src).not.toMatch(/<script/i);
  });

  test("no inline on* event handler attributes", () => {
    const inlineHandlers = markup.match(/\son[a-z]+=/gi) ?? [];
    expect(inlineHandlers, `unexpected inline handlers: ${inlineHandlers.join(", ")}`).toEqual([]);
  });

  test("uses JTE comment syntax <%-- --%>, not @* *@", () => {
    expect(src).not.toMatch(/@\*/);
  });

  test("no em-dash (house rule)", () => {
    expect(src).not.toContain("—"); // U+2014 EM DASH
  });
});
