/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * input-group.jte -- full structural acceptance suite (v-next re-forge).
 *
 * Covers every row in spec §7 (input-group.md) as source-text assertions.
 * The template is a static JTE partial compiled in the Java world; this
 * harness asserts on the PARTIAL SOURCE as text (the same pattern as
 * switch.test.ts, input.test.ts, alert.test.ts).
 *
 * Sections:
 *   §2  API -- param declarations
 *   §3  Variants/sizes/states/slots
 *   §4  Accessibility (ARIA attributes, role, aria-hidden contract)
 *   §5  Design tokens (no bare hex, --lv-* only)
 *   §6  Wire / slot structure (DOM order, slot presence/absence)
 *   §7  Escaping (attrs trusted, dataAttrs safe)
 *   §7  CSP hygiene (no inline script, no on* handlers)
 *   §7  JTE comment hygiene (no nested --%>, balanced @if/@endif)
 */
import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// ---------------------------------------------------------------------------
// Source text setup
// ---------------------------------------------------------------------------

const jteDir = join(import.meta.dirname, "..", "registry", "jte");
const src = readFileSync(join(jteDir, "input-group.jte"), "utf8");

/**
 * Markup source with all JTE block comments stripped so assertions never
 * accidentally match doc-comment prose. JTE directives, attribute text, and
 * HTML remain.
 */
const markup = src.replace(/<%--[\s\S]*?--%>/g, "");

// ---------------------------------------------------------------------------
// §2 API -- param declarations
// ---------------------------------------------------------------------------

describe("input-group.jte -- params & docs API", () => {
  test("declares every documented param with the correct type and default", () => {
    expect(src).toContain('@param String size = "md"');
    expect(src).toContain("@param boolean disabled = false");
    expect(src).toContain("@param String ariaLabel = null");
    expect(src).toContain("@param String ariaLabelledBy = null");
    expect(src).toContain("@param String ariaDescribedBy = null");
    expect(src).toContain("@param boolean invalid = false");
    expect(src).toContain('@param String cssClass = ""');
    expect(src).toContain('@param String attrs = ""');
    expect(src).toContain(
      "@param java.util.Map<String, String> dataAttrs = java.util.Map.of()"
    );
    expect(src).toContain("@param gg.jte.Content leadingElement = null");
    expect(src).toContain("@param gg.jte.Content leadingAddon = null");
    expect(src).toContain("@param gg.jte.Content content");
    expect(src).toContain("@param gg.jte.Content trailingAddon = null");
    expect(src).toContain("@param gg.jte.Content trailingElement = null");
  });

  test("does NOT declare name, id, type, value, placeholder, model params (old API -- removed)", () => {
    // v-next: the core control comes in via the `content` slot; the group does not own these.
    expect(src).not.toMatch(/@param String name\b/);
    expect(src).not.toMatch(/@param String id\b/);
    expect(src).not.toMatch(/@param String type\b/);
    expect(src).not.toMatch(/@param String value\b/);
    expect(src).not.toMatch(/@param String placeholder\b/);
    expect(src).not.toMatch(/@param String model\b/);
  });

  test("does NOT declare leadingAlign or trailingAlign (old block-alignment API -- removed)", () => {
    // v-next removes the block-start/block-end alignment concept; elements come via slots.
    expect(src).not.toMatch(/@param String leadingAlign/);
    expect(src).not.toMatch(/@param String trailingAlign/);
  });

  test("content param has no default (it is the required core-control slot)", () => {
    // A Content param without a default forces the adopter to supply it. JTE syntax:
    //   @param gg.jte.Content content     (no = null, no default)
    // The pattern below confirms content is NOT followed by = null.
    expect(src).toContain("@param gg.jte.Content content");
    // And the required param DOES NOT have a null default.
    expect(src).not.toMatch(/@param gg\.jte\.Content content\s*=\s*null/);
  });

  test("usage doc uses <%-- --%> comments and shows @@template.lievit.input-group call", () => {
    expect(src).toContain("<%--");
    expect(src).toContain("--%>");
    expect(src).toMatch(/@@template\.lievit\.input-group\(/);
  });

  test("doc comment cites the WAI-ARIA grouping / role=group source (the a11y authority)", () => {
    expect(src).toMatch(/WAI-ARIA.*group|role="group"|wai-aria.*group/i);
  });
});

// ---------------------------------------------------------------------------
// §3 Sizes -- height-based, toolbar-aligned
// ---------------------------------------------------------------------------

describe("input-group.jte -- size scale (sm/md/lg, height-based)", () => {
  const SIZE_CASES: ReadonlyArray<[string, string]> = [
    ["sm", "h-[var(--lv-space-8)]"],
    ["md", "h-[var(--lv-space-9)]"],
    ["lg", "h-[var(--lv-space-10)]"],
  ];

  for (const [size, heightClass] of SIZE_CASES) {
    test(`size="${size}": addon height class is ${heightClass}`, () => {
      expect(src, `size ${size} height class missing`).toContain(heightClass);
    });
  }

  test("md is the default (switch expression uses default branch for md)", () => {
    // The switch in the template has a `default` case that returns the md token.
    expect(src).toContain('default   -> "h-[var(--lv-space-9)]"');
  });

  test("data-size is emitted on the group root (test selector + Tailwind data-attr variants)", () => {
    expect(markup).toContain('data-size="${size}"');
  });

  test("data-slot='input-group' is always on the group root", () => {
    expect(markup).toContain('data-slot="input-group"');
  });
});

// ---------------------------------------------------------------------------
// §3 States -- disabled, invalid
// ---------------------------------------------------------------------------

describe("input-group.jte -- state data attributes (CSS hooks)", () => {
  test("disabled=true renders data-disabled='true' on the root (CSS hook; inner controls own their disabled)", () => {
    // Smart attribute: `data-disabled="${disabled ? "true" : null}"` emits when true, omits when false.
    expect(markup).toContain('data-disabled="${disabled ? "true" : null}"');
  });

  test("invalid=true renders aria-invalid='true' on the root [axe: aria-invalid]", () => {
    expect(markup).toContain('aria-invalid="${invalid ? "true" : null}"');
  });

  test("invalid=true renders data-invalid='true' on the root (CSS hook for destructive border + ring)", () => {
    expect(markup).toContain('data-invalid="${invalid ? "true" : null}"');
  });

  test("disabled state applies opacity via --lv-opacity-disabled token through data-[disabled=true]", () => {
    expect(src).toContain("data-[disabled=true]:opacity-[var(--lv-opacity-disabled)]");
  });

  test("invalid border uses --lv-color-destructive (the shared destructive token)", () => {
    expect(src).toContain("data-[invalid=true]:border-[var(--lv-color-destructive)]");
  });

  test("invalid focus ring uses --lv-ring-destructive (the paired destructive ring token)", () => {
    // The destructive ring is --lv-ring-destructive, not a hand-rolled color-mix.
    expect(src).toContain("data-[invalid=true]:focus-within:shadow-[var(--lv-ring-destructive)]");
  });
});

// ---------------------------------------------------------------------------
// §4 Accessibility -- role="group" conditional, ARIA attributes
// ---------------------------------------------------------------------------

describe("input-group.jte -- WAI-ARIA role=group (conditional, not gratuitous)", () => {
  test("role is driven by hasGroupLabel flag (not hardcoded role='group' for all instances)", () => {
    // The spec requires role="group" only when ariaLabel or ariaLabelledBy is set.
    // The template computes a local boolean and uses it in a ternary.
    expect(src).toContain('role="${hasGroupLabel ? "group" : null}"');
  });

  test("hasGroupLabel is true when ariaLabel is set", () => {
    // The local var expression checks ariaLabel for non-null and non-blank.
    expect(src).toMatch(/ariaLabel != null.*!.*isBlank\(\)|ariaLabel.*isBlank/);
  });

  test("hasGroupLabel is true when ariaLabelledBy is set", () => {
    // The local var expression also checks ariaLabelledBy.
    expect(src).toMatch(/ariaLabelledBy != null.*!.*isBlank\(\)|ariaLabelledBy.*isBlank/);
  });

  test("aria-label emitted via smart attribute (omitted when null)", () => {
    expect(markup).toContain('aria-label="${ariaLabel}"');
  });

  test("aria-labelledby emitted via smart attribute (omitted when null)", () => {
    expect(markup).toContain('aria-labelledby="${ariaLabelledBy}"');
  });

  test("aria-describedby emitted via smart attribute (omitted when null)", () => {
    expect(markup).toContain('aria-describedby="${ariaDescribedBy}"');
  });

  test("group root is a <div> (NOT a <fieldset> or <section>)", () => {
    // WAI-ARIA grouping rule: use a div with role=group, not fieldset (which imposes
    // its own semantics and affects legend/disabled behaviour differently).
    expect(markup).toMatch(/^<div\b/m);
    expect(markup).not.toMatch(/<fieldset/);
    expect(markup).not.toMatch(/<section/);
  });
});

// ---------------------------------------------------------------------------
// §6 Slot structure -- DOM order, conditional rendering
// ---------------------------------------------------------------------------

describe("input-group.jte -- slot topology and DOM order", () => {
  test("leadingElement slot: wrapped in @if(leadingElement != null) gate", () => {
    expect(markup).toContain("@if(leadingElement != null)");
    expect(markup).toContain('data-slot="leading-element"');
    expect(markup).toContain("${leadingElement}");
  });

  test("leadingAddon slot: wrapped in @if(leadingAddon != null) gate", () => {
    expect(markup).toContain("@if(leadingAddon != null)");
    expect(markup).toContain('data-slot="leading-addon"');
    expect(markup).toContain("${leadingAddon}");
  });

  test("content slot: always rendered (no @if gate), inside data-slot='content'", () => {
    expect(markup).toContain('data-slot="content"');
    expect(markup).toContain("${content}");
  });

  test("trailingAddon slot: wrapped in @if(trailingAddon != null) gate", () => {
    expect(markup).toContain("@if(trailingAddon != null)");
    expect(markup).toContain('data-slot="trailing-addon"');
    expect(markup).toContain("${trailingAddon}");
  });

  test("trailingElement slot: wrapped in @if(trailingElement != null) gate", () => {
    expect(markup).toContain("@if(trailingElement != null)");
    expect(markup).toContain('data-slot="trailing-element"');
    expect(markup).toContain("${trailingElement}");
  });

  test("DOM order is: leadingElement -> leadingAddon -> content -> trailingAddon -> trailingElement", () => {
    const leIdx  = markup.indexOf('data-slot="leading-element"');
    const laIdx  = markup.indexOf('data-slot="leading-addon"');
    const cIdx   = markup.indexOf('data-slot="content"');
    const taIdx  = markup.indexOf('data-slot="trailing-addon"');
    const teIdx  = markup.indexOf('data-slot="trailing-element"');
    // All slots are present in source text.
    expect(leIdx, "leading-element missing").toBeGreaterThan(-1);
    expect(laIdx, "leading-addon missing").toBeGreaterThan(-1);
    expect(cIdx,  "content missing").toBeGreaterThan(-1);
    expect(taIdx, "trailing-addon missing").toBeGreaterThan(-1);
    expect(teIdx, "trailing-element missing").toBeGreaterThan(-1);
    // Source order matches DOM spec order.
    expect(leIdx, "leading-element must come before leading-addon").toBeLessThan(laIdx);
    expect(laIdx, "leading-addon must come before content").toBeLessThan(cIdx);
    expect(cIdx,  "content must come before trailing-addon").toBeLessThan(taIdx);
    expect(taIdx, "trailing-addon must come before trailing-element").toBeLessThan(teIdx);
  });

  test("each optional slot has exactly one @if gate (no double-wrapping)", () => {
    const leGates = markup.match(/@if\(leadingElement != null\)/g) ?? [];
    const laGates = markup.match(/@if\(leadingAddon != null\)/g) ?? [];
    const taGates = markup.match(/@if\(trailingAddon != null\)/g) ?? [];
    const teGates = markup.match(/@if\(trailingElement != null\)/g) ?? [];
    expect(leGates.length, "leadingElement must have exactly one @if gate").toBe(1);
    expect(laGates.length, "leadingAddon must have exactly one @if gate").toBe(1);
    expect(taGates.length, "trailingAddon must have exactly one @if gate").toBe(1);
    expect(teGates.length, "trailingElement must have exactly one @if gate").toBe(1);
  });
});

// ---------------------------------------------------------------------------
// §6 Element vs addon CSS contract
// ---------------------------------------------------------------------------

describe("input-group.jte -- element vs addon CSS contract", () => {
  test("leadingElement slot container has border-r (internal right divider)", () => {
    expect(src).toContain("data-slot=\"leading-element\"");
    // The leading-element div must carry a border-r class (internal divider between element and core).
    const leIdx = markup.indexOf('data-slot="leading-element"');
    const leBlock = markup.slice(leIdx, leIdx + 400);
    expect(leBlock).toContain("border-r");
  });

  test("trailingElement slot container has border-l (internal left divider)", () => {
    expect(src).toContain("data-slot=\"trailing-element\"");
    const teIdx = markup.indexOf('data-slot="trailing-element"');
    const teBlock = markup.slice(teIdx, teIdx + 400);
    expect(teBlock).toContain("border-l");
  });

  test("leadingAddon slot container uses --lv-color-muted-bg (the muted addon background)", () => {
    const laIdx = markup.indexOf('data-slot="leading-addon"');
    const laBlock = markup.slice(laIdx, laIdx + 400);
    expect(laBlock).toContain("bg-[var(--lv-color-muted-bg)]");
  });

  test("trailingAddon slot container uses --lv-color-muted-bg (the muted addon background)", () => {
    const taIdx = markup.indexOf('data-slot="trailing-addon"');
    const taBlock = markup.slice(taIdx, taIdx + 400);
    expect(taBlock).toContain("bg-[var(--lv-color-muted-bg)]");
  });

  test("element slots use --lv-color-input bg (same as core control, full-peer look)", () => {
    const leIdx = markup.indexOf('data-slot="leading-element"');
    const leBlock = markup.slice(leIdx, leIdx + 400);
    expect(leBlock).toContain("bg-[var(--lv-color-input)]");
  });

  test("content slot is flex-1 to fill the remaining width (min-w-0 prevents overflow)", () => {
    const cIdx = markup.indexOf('data-slot="content"');
    const cBlock = markup.slice(cIdx, cIdx + 200);
    expect(cBlock).toContain("flex-1");
    expect(cBlock).toContain("min-w-0");
  });
});

// ---------------------------------------------------------------------------
// §4 Focus ring -- focus-within on group root
// ---------------------------------------------------------------------------

describe("input-group.jte -- focus ring (focus-within, single ring over the whole group)", () => {
  test("group root uses :focus-within to raise the ring (single ring, not per-control)", () => {
    expect(src).toContain("focus-within:shadow-[var(--lv-ring)]");
  });

  test("the normal ring uses --lv-ring (the shared focus token)", () => {
    expect(src).toContain("var(--lv-ring)");
  });

  test("the destructive ring uses --lv-ring-destructive (no inline color-mix -- uses the token)", () => {
    expect(src).toContain("var(--lv-ring-destructive)");
  });

  test("the group root also lifts the border on focus-within (visual border matches ring position)", () => {
    expect(src).toContain("focus-within:border-[var(--lv-color-ring)]");
  });

  test("group root uses overflow:hidden so inner borders are clipped by the group frame", () => {
    // The overflow:hidden clip is what makes inner controls appear borderless inside the group.
    expect(src).toContain("overflow-hidden");
  });
});

// ---------------------------------------------------------------------------
// §5 Design tokens -- no bare hex, all --lv-*
// ---------------------------------------------------------------------------

describe("input-group.jte -- token contract (no hardcoded colours)", () => {
  test("no bare hex colour in the template body [architecture-contract §4]", () => {
    // Strip doc comments (may contain hex in token documentation).
    const body = src.replace(/<%--[\s\S]*?--%>/g, "");
    expect(body, "leaked a hardcoded hex colour in template body").not.toMatch(
      /#[0-9a-fA-F]{3,8}\b/
    );
  });

  test("uses --lv-color-border for the group border", () => {
    expect(src).toContain("var(--lv-color-border)");
  });

  test("uses --lv-color-input for the group background and element slot backgrounds", () => {
    expect(src).toContain("var(--lv-color-input)");
  });

  test("uses --lv-color-muted-bg for addon slot backgrounds", () => {
    expect(src).toContain("var(--lv-color-muted-bg)");
  });

  test("uses --lv-color-muted-fg for addon text colour", () => {
    expect(src).toContain("var(--lv-color-muted-fg)");
  });

  test("uses --lv-color-border-hover for the hover border lift", () => {
    expect(src).toContain("var(--lv-color-border-hover)");
  });

  test("uses --lv-color-destructive for invalid border", () => {
    expect(src).toContain("var(--lv-color-destructive)");
  });

  test("uses --lv-radius-md for the outer border-radius", () => {
    expect(src).toContain("var(--lv-radius-md)");
  });

  test("uses --lv-shadow-xs for the subtle inset shadow", () => {
    expect(src).toContain("var(--lv-shadow-xs)");
  });

  test("uses --lv-opacity-disabled for the disabled dimming", () => {
    expect(src).toContain("var(--lv-opacity-disabled)");
  });

  test("uses --lv-font-sans for the font-family on the group root", () => {
    expect(src).toContain("var(--lv-font-sans)");
  });

  test("uses --lv-font-medium for addon text weight", () => {
    expect(src).toContain("var(--lv-font-medium)");
  });

  test("cssClass is interpolated on the group root", () => {
    expect(markup).toContain("${cssClass}");
  });
});

// ---------------------------------------------------------------------------
// §7 Escaping channels (XSS decision rule)
// ---------------------------------------------------------------------------

describe("input-group.jte -- escaping channels (XSS decision rule)", () => {
  test("attrs is emitted via $unsafe (trusted-raw channel for static author strings)", () => {
    expect(markup).toContain("$unsafe{attrs}");
  });

  test("dataAttrs VALUE is escaped via Escape.htmlAttribute (never raw) [XSS]", () => {
    expect(src).toContain("@import gg.jte.html.escape.Escape");
    expect(src).toMatch(/Escape\.htmlAttribute\(\s*e\.getValue\(\)/);
    expect(src, "dataAttrs value must not be $unsafe directly").not.toMatch(
      /\$unsafe\{[^}]*getValue/
    );
  });

  test("dataAttrs key is validated as [A-Za-z][A-Za-z0-9-]* (key injection prevention)", () => {
    expect(src).toMatch(/getKey\(\)\.matches\("\[A-Za-z\]\[A-Za-z0-9-\]\*"\)/);
  });

  test("StringOutput is imported and used for the pre-escaped dataAttrs fragment", () => {
    expect(src).toContain("@import gg.jte.output.StringOutput");
    expect(src).toContain("new StringOutput()");
  });

  test("the pre-escaped dataAttrs fragment is emitted with $unsafe{dataAttrsMarkup}", () => {
    expect(markup).toContain("$unsafe{dataAttrsMarkup}");
  });

  test("attrs doc states TRUSTED STATIC AUTHOR-TYPED STRINGS ONLY", () => {
    expect(src.toLowerCase()).toMatch(/trusted|static.*author|author.*only/i);
  });
});

// ---------------------------------------------------------------------------
// §7 CSP hygiene (no inline script, no on* handlers)
// ---------------------------------------------------------------------------

describe("input-group.jte -- CSP hygiene", () => {
  test("no inline <script> tag (strict CSP refuses them)", () => {
    expect(src).not.toMatch(/<script/i);
  });

  test("no inline on* event handler attributes (onclick, onchange, etc.)", () => {
    const body = src.replace(/<%--[\s\S]*?--%>/g, "");
    const inlineHandlers = body.match(/\son[a-z]+=/gi) ?? [];
    expect(
      inlineHandlers,
      `unexpected inline handlers: ${inlineHandlers.join(", ")}`
    ).toEqual([]);
  });

  test("no dev.lievit import (JTE-compile gate classpath is JDK + jte + icons only)", () => {
    expect(src).not.toMatch(/@import dev\.lievit/);
  });

  test("no dev.lievit or any lievit Java import in the @import lines", () => {
    const imports = src.match(/@import [^\n]+/g) ?? [];
    for (const imp of imports) {
      expect(imp, `forbidden import: ${imp}`).not.toMatch(/dev\.lievit/);
    }
  });

  test("no hardcoded <input> in the template (core control comes via content slot)", () => {
    // The v-next design passes the core control as a Content slot, not hardcoding <input>.
    const body = src.replace(/<%--[\s\S]*?--%>/g, "");
    expect(body, "hardcoded <input> found; use the content slot instead").not.toMatch(/<input\b/);
  });

  test("no data-lievit-component attribute in the markup (PARTIAL tier, no enhancer wiring)", () => {
    // Strip doc comments (they may mention the attribute by name as a negative example).
    expect(markup).not.toContain("data-lievit-component");
  });
});

// ---------------------------------------------------------------------------
// §7 JTE comment hygiene (no nested --%>, balanced @if/@endif)
// ---------------------------------------------------------------------------

describe("input-group.jte -- JTE comment hygiene", () => {
  test("no nested --%> that would close the outer doc-comment early (JTE parse hazard)", () => {
    // After stripping all properly-paired block comments, no stray --%> should remain.
    const stripped = src.replace(/<%--[\s\S]*?--%>/g, "");
    expect(stripped, "stray --%> found after stripping all block comments").not.toContain("--%>");
  });

  test("all @if / @endif are balanced (no unclosed conditional)", () => {
    const openIfs  = (src.match(/@if\(/g) ?? []).length;
    const closeIfs = (src.match(/@endif/g) ?? []).length;
    expect(closeIfs, `@if(${openIfs}) vs @endif(${closeIfs}) mismatch`).toBe(openIfs);
  });

  test("no @for / @endfor imbalance", () => {
    const openFors  = (src.match(/@for\(/g) ?? []).length;
    const closeFors = (src.match(/@endfor/g) ?? []).length;
    expect(closeFors, `@for(${openFors}) vs @endfor(${closeFors}) mismatch`).toBe(openFors);
  });

  test("no raw generic type notation in the doc comment (JTE parse hazard)", () => {
    // JTE can mis-parse raw Java generics inside comments as HTML tags.
    // The convention is to write "Map of String to String" not "Map<String,String>".
    // Strip the markup section (only the comments can have prose generics).
    const comments = src.match(/<%--[\s\S]*?--%>/g) ?? [];
    for (const c of comments) {
      expect(c, "raw generic <Type,Type> found in comment block").not.toMatch(/<[A-Z][A-Za-z]*,/);
    }
  });

  test("@if conditionals do not contain @if in attribute NAME position", () => {
    // JTE forbids @if inside an attribute name. Confirm pattern is absent.
    expect(src).not.toMatch(/\s@if\([^)]*\)[a-zA-Z-]+=\s*"/);
  });
});

// ---------------------------------------------------------------------------
// §3 No variant param (intent via invalid flag only)
// ---------------------------------------------------------------------------

describe("input-group.jte -- no variant param (spec §3)", () => {
  test("no @param String variant (input-group has no variant, only invalid flag)", () => {
    expect(src).not.toMatch(/@param String variant/);
  });

  test("no data-variant on the root (no variant system here, spec §3)", () => {
    expect(markup).not.toContain('data-variant=');
  });
});

// ---------------------------------------------------------------------------
// §4 No enhancer / no wire attributes
// ---------------------------------------------------------------------------

describe("input-group.jte -- PARTIAL tier (no enhancer, no wire)", () => {
  test("no @template.lievit.spinner or other sub-partial composed inside (self-contained)", () => {
    // input-group is self-contained; it does not compose other partials.
    const body = src.replace(/<%--[\s\S]*?--%>/g, "");
    expect(body).not.toContain("@template.lievit.");
  });

  test("no l:click, l:model, l:submit wire directives on the group root", () => {
    // Wire directives belong on the inner controls provided by the adopter, not the group shell.
    const rootBlock = markup.slice(
      markup.indexOf('data-slot="input-group"'),
      markup.indexOf('data-slot="input-group"') + 600
    );
    expect(rootBlock).not.toContain("l:click=");
    expect(rootBlock).not.toContain("l:model=");
    expect(rootBlock).not.toContain("l:submit");
  });
});
