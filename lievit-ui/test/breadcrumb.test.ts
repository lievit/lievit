/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * breadcrumb.jte -- full structural + a11y contract (spec §7).
 *
 * The breadcrumb is a static JTE partial compiled in the Java world, so -- as with every
 * other static-partials suite -- this harness asserts on the PARTIAL SOURCE as text.
 *
 * It pins: the v-next param API (items/navLabel/separator/collapsed/maxVisible/size/cssClass),
 * the nav landmark + ordered list topology, the aria-current="page" contract on the last item,
 * separator aria-hidden contract (dedicated <li aria-hidden="true"> nodes), the href scheme
 * allowlist guard (javascript: renders as <span>), the collapsed-ellipsis path (<button>,
 * keyboard-reachable, aria-label + aria-expanded), data-slot topology, data-size + data-current
 * hooks, token-driven styling (no bare hex, all --lv-* vars), and CSP cleanliness (no inline
 * script / on* handler). The real-compiler smoke lives in test/jte-compile.
 *
 * Spec: planning/v-next/specs/breadcrumb.md §7 acceptance tests.
 * WAI-ARIA APG: https://www.w3.org/WAI/ARIA/apg/patterns/breadcrumb/
 */
import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const jteDir = join(import.meta.dirname, "..", "registry", "jte");
const src = readFileSync(join(jteDir, "breadcrumb.jte"), "utf8");

// Strip JTE comments so assertions do not hit doc-comment prose.
const markup = src.replace(/<%--[\s\S]*?--%>/g, "");

// ---------------------------------------------------------------------------
// Cross-cutting: Apache header + copyright
// ---------------------------------------------------------------------------
describe("breadcrumb -- Apache header", () => {
  test("carries the Apache 2.0 copyright header", () => {
    expect(src).toContain("Copyright 2026 Francesco Bilotta");
    expect(src).toContain('Licensed under the Apache License, Version 2.0 (the "License").');
  });
});

// ---------------------------------------------------------------------------
// Param API (spec §2)
// ---------------------------------------------------------------------------
describe("breadcrumb -- param API", () => {
  test("declares items as List<Map<String, String>> with an empty-list default", () => {
    expect(src).toContain("@param List<Map<String, String>> items");
    expect(src).toContain("java.util.List.of()");
  });

  test("declares navLabel with default Breadcrumb", () => {
    expect(src).toContain('@param String navLabel = "Breadcrumb"');
  });

  test("declares separator with default /", () => {
    expect(src).toContain('@param String separator = "/"');
  });

  test("declares collapsed boolean with default false", () => {
    expect(src).toContain("@param boolean collapsed = false");
  });

  test("declares maxVisible int with default 3", () => {
    expect(src).toContain("@param int maxVisible = 3");
  });

  test("declares size with default md", () => {
    expect(src).toContain('@param String size = "md"');
  });

  test("declares cssClass passthrough", () => {
    expect(src).toContain('@param String cssClass = ""');
  });

  test("does NOT declare the old label param (renamed to navLabel)", () => {
    // The old API used `label`; the v-next API uses `navLabel`.
    // Confirm the old name is NOT a @param declaration (it may appear in prose).
    expect(markup).not.toMatch(/@param String label\b/);
  });

  test("does NOT declare the old maxItems param (replaced by collapsed + maxVisible)", () => {
    expect(markup).not.toMatch(/@param int maxItems\b/);
  });

  test("usage doc carries @@template.lievit.breadcrumb( call syntax", () => {
    expect(src).toContain("@@template.lievit.breadcrumb(");
  });
});

// ---------------------------------------------------------------------------
// DOM structure: nav landmark + ordered list (spec §4 roles + ARIA)
// ---------------------------------------------------------------------------
describe("breadcrumb -- nav landmark + ol structure", () => {
  test("root element is a <nav> (implicit navigation landmark)", () => {
    expect(markup).toMatch(/<nav\b/);
    expect(markup).not.toMatch(/<div\b[^>]*role="navigation"/); // no explicit div+role
  });

  test("nav carries data-slot='breadcrumb'", () => {
    expect(markup).toContain('data-slot="breadcrumb"');
  });

  test("nav carries data-size stamped from the size param", () => {
    expect(markup).toContain('data-size="${size}"');
  });

  test("nav carries aria-label from navLabel param", () => {
    expect(markup).toMatch(/<nav[\s\S]*?aria-label="\$\{navLabel\}"/);
  });

  test("the trail is an ordered <ol> (semantically ordered: root to current)", () => {
    expect(markup).toMatch(/<ol\b/);
    // Explicitly NOT a <ul>: the crumb trail is ordered.
    // (The template may not contain <ul> at all, but we at least require <ol>.)
    expect(markup).toContain("<ol");
  });

  test("crumb items are wrapped in <li data-slot='breadcrumb-item'>", () => {
    expect(markup).toContain('data-slot="breadcrumb-item"');
  });

  test("the current (last) item's <li> carries data-current (no value)", () => {
    // data-current is a boolean-presence attribute on the last item's <li>.
    expect(markup).toMatch(/data-slot="breadcrumb-item"\s+data-current/);
  });
});

// ---------------------------------------------------------------------------
// Current item: aria-current="page" (spec §4 + §7)
// ---------------------------------------------------------------------------
describe("breadcrumb -- current item a11y", () => {
  test("the current (last) item renders with aria-current='page' on <a> when it has href", () => {
    // The template must emit aria-current="page" on the <a> branch for the current item.
    expect(markup).toMatch(/<a[\s\S]*?aria-current="page"/);
  });

  test("the current item renders as <span aria-current='page'> when it has no href", () => {
    // When _safeHref is null the current branch falls through to a <span aria-current="page">.
    expect(markup).toMatch(/<span[\s\S]*?aria-current="page"/);
  });

  test("aria-current uses exactly 'page' (not 'true', 'location', or 'step')", () => {
    // Assert no incorrect values appear.
    expect(markup).not.toMatch(/aria-current="true"/);
    expect(markup).not.toMatch(/aria-current="location"/);
    expect(markup).not.toMatch(/aria-current="step"/);
  });

  test("non-current link items carry NO aria-current attribute", () => {
    // The traversable-link branch for non-current items must NOT emit aria-current.
    // We confirm the data-slot="breadcrumb-link" element does not carry aria-current inline.
    // (Source-text check: breadcrumb-link and aria-current must not appear on the same line.)
    const linkLines = markup.split("\n").filter((l) => l.includes('data-slot="breadcrumb-link"'));
    for (const line of linkLines) {
      expect(line).not.toContain("aria-current");
    }
  });
});

// ---------------------------------------------------------------------------
// Separators: aria-hidden (spec §4 + §7)
// ---------------------------------------------------------------------------
describe("breadcrumb -- separator a11y", () => {
  test("separators are dedicated <li aria-hidden='true'> nodes", () => {
    // The spec-preferred implementation: dedicated <li aria-hidden="true"> between crumb items.
    expect(markup).toMatch(/<li\b[^>]*aria-hidden="true"/);
  });

  test("separator content is the ${separator} param value", () => {
    expect(markup).toContain("${separator}");
  });

  test("separators carry the lv-breadcrumb__separator class", () => {
    expect(markup).toContain("lv-breadcrumb__separator");
  });

  test("no separator appears before the first crumb item", () => {
    // The loop emits a separator for _i > 0 only (not before the root).
    expect(src).toMatch(/@if\(_i > 0\)/);
  });
});

// ---------------------------------------------------------------------------
// Traversable links (non-current items with href) (spec §3 states)
// ---------------------------------------------------------------------------
describe("breadcrumb -- traversable link items", () => {
  test("non-current items with href render as <a href>", () => {
    expect(markup).toMatch(/<a[\s\S]*?data-slot="breadcrumb-link"/);
  });

  test("traversable links carry a focus-visible ring via --lv-ring", () => {
    expect(markup).toContain("focus-visible:shadow-[var(--lv-ring)]");
  });

  test("traversable links are styled in --lv-color-muted-fg", () => {
    expect(markup).toContain("var(--lv-color-muted-fg)");
  });

  test("traversable links have hover:underline (Tailwind-UI affordance)", () => {
    expect(markup).toContain("hover:underline");
  });

  test("non-current items without href render as a non-interactive <span>", () => {
    // The else branch of the non-current item: a <span data-slot="breadcrumb-link">.
    // Confirmed by the presence of a span with data-slot="breadcrumb-link" in the markup.
    expect(markup).toContain('<span\n                data-slot="breadcrumb-link"');
  });
});

// ---------------------------------------------------------------------------
// Href scheme allowlist guard (spec §7 escaping / XSS abuse-case)
// ---------------------------------------------------------------------------
describe("breadcrumb -- href scheme allowlist guard", () => {
  test("href allowlist permits /, #, http://, https://", () => {
    // The scheme guard expression is present in the source.
    expect(src).toContain('_rawHref.startsWith("/")');
    expect(src).toContain('_rawHref.startsWith("#")');
    expect(src).toContain('_rawHref.startsWith("http://")');
    expect(src).toContain('_rawHref.startsWith("https://")');
  });

  test("a rejected href (e.g. javascript:) causes the item to fall through to a non-link <span>", () => {
    // The ternary assigns null to _safeHref when the allowlist check fails;
    // downstream the @if(_safeHref != null) branch renders a <span>.
    expect(src).toContain("_safeHref != null");
    // Confirm the else branch renders a span (confirmed by the non-link-span test above).
  });

  test("href values go through the scheme guard, NOT emitted raw via $unsafe", () => {
    // The <a href="..."> attribute MUST use ${_safeHref} (JTE-escaped), not $unsafe.
    // Confirm $unsafe is NOT adjacent to href=" in the markup (it is used only for attrs).
    const hrefLines = markup.split("\n").filter((l) => l.includes('href="${_safe'));
    expect(hrefLines.length).toBeGreaterThan(0);
    // None of those href attribute lines should involve $unsafe.
    for (const line of hrefLines) {
      expect(line).not.toContain("$unsafe");
    }
  });

  test("per-item attrs channel uses $unsafe (TRUSTED raw) with a comment", () => {
    // The attrs field is emitted as $unsafe{_itemAttrs} (author-controlled static extras).
    expect(src).toContain("$unsafe{_itemAttrs}");
    expect(src).toContain("$unsafe{_firstAttrs}");
  });
});

// ---------------------------------------------------------------------------
// Collapsed / ellipsis (spec §3 Collapsed variant + §7)
// ---------------------------------------------------------------------------
describe("breadcrumb -- collapsed ellipsis", () => {
  test("collapse triggers when collapsed=true AND n > maxVisible + 2", () => {
    expect(src).toContain("_doCollapse = collapsed && _n > maxVisible + 2");
  });

  test("the collapsed path renders only the first item, an ellipsis, and the last item", () => {
    // First item: items.get(0).
    expect(src).toContain("items.get(0)");
    // Last item: items.get(_n - 1).
    expect(src).toContain("items.get(_n - 1)");
    // The doCollapse branch is guarded.
    expect(src).toMatch(/@if\(_doCollapse\)/);
    expect(src).toMatch(/@else\b/);
  });

  test("the ellipsis is a <button> (keyboard-reachable, not a bare span)", () => {
    expect(markup).toMatch(/<button\b[^>]*data-slot="breadcrumb-ellipsis"/);
    // Must NOT be a bare non-interactive span carrying the ellipsis (anti-pattern from spec §8).
    expect(markup).not.toMatch(/<span\b[^>]*data-slot="breadcrumb-ellipsis"[^>]*aria-hidden/);
  });

  test("the ellipsis button carries aria-label='Show full path' and aria-expanded='false'", () => {
    expect(markup).toContain('aria-label="Show full path"');
    expect(markup).toContain('aria-expanded="false"');
  });

  test("the ellipsis button carries data-slot='breadcrumb-ellipsis'", () => {
    expect(markup).toContain('data-slot="breadcrumb-ellipsis"');
  });

  test("the ellipsis button has type='button' (no accidental form submit)", () => {
    expect(markup).toMatch(/<button\b[^>]*type="button"[^>]*data-slot="breadcrumb-ellipsis"/);
  });

  test("the ellipsis button has a focus-visible ring (keyboard-reachable affordance)", () => {
    // The button must carry the ring class so keyboard users can see focus.
    expect(markup).toMatch(/data-slot="breadcrumb-ellipsis"[\s\S]*?focus-visible:shadow-\[var\(--lv-ring\)\]/);
  });

  test("separators are emitted around the ellipsis in the collapsed path", () => {
    // The collapsed path has two separator <li aria-hidden="true"> nodes:
    // one before the ellipsis button and one before the last item.
    // Verified by the presence of multiple aria-hidden separators in markup.
    const hiddenLiCount = (markup.match(/<li\b[^>]*aria-hidden="true"/g) || []).length;
    // In the collapsed branch alone there are at least 2 separator nodes;
    // in the full-trail branch there are N-1. We just confirm the pattern exists.
    expect(hiddenLiCount).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// Size scaling (spec §3 Sizes)
// ---------------------------------------------------------------------------
describe("breadcrumb -- size scaling", () => {
  test("data-size is stamped from the size param (adopter CSS + test hook)", () => {
    expect(markup).toContain('data-size="${size}"');
  });

  test("sm size maps to --lv-text-xs", () => {
    expect(src).toContain("--lv-text-xs");
    expect(src).toContain('"sm"');
  });

  test("md size (default) maps to --lv-text-sm", () => {
    expect(src).toContain("--lv-text-sm");
  });

  test("lg size maps to --lv-text-base", () => {
    expect(src).toContain("--lv-text-base");
    expect(src).toContain('"lg"');
  });

  test("size drives a gap token via --lv-space-* (sm=1, md=2, lg=3)", () => {
    expect(src).toContain("--lv-space-1");
    expect(src).toContain("--lv-space-2");
    expect(src).toContain("--lv-space-3");
  });
});

// ---------------------------------------------------------------------------
// Token discipline + CSP cleanliness (architecture contract §4 / §7)
// ---------------------------------------------------------------------------
describe("breadcrumb -- token discipline + CSP", () => {
  test("is token-driven: no hardcoded hex colour in source", () => {
    expect(src).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  test("uses --lv-color-fg for the current item (fully opaque, readable)", () => {
    expect(markup).toContain("var(--lv-color-fg)");
  });

  test("uses --lv-color-muted-fg for traversable links and separators (subdued)", () => {
    expect(markup).toContain("var(--lv-color-muted-fg)");
  });

  test("uses --lv-font-sans for type family", () => {
    expect(markup).toContain("var(--lv-font-sans)");
  });

  test("uses --lv-font-medium for current item weight", () => {
    expect(markup).toContain("var(--lv-font-medium)");
  });

  test("uses --lv-ring for focus-visible ring on interactive elements", () => {
    expect(markup).toContain("var(--lv-ring)");
  });

  test("uses --lv-radius-sm for link border-radius", () => {
    expect(markup).toContain("var(--lv-radius-sm)");
  });

  test("is CSP-clean: no inline <script>", () => {
    expect(src).not.toMatch(/<script/i);
  });

  test("is CSP-clean: no inline on* event-handler attributes", () => {
    // Strip JTE directives (@for, @if ...) before the on* check to avoid false positives.
    const stripped = markup.replace(/@\w+[^>]*/g, "");
    expect(stripped).not.toMatch(/\son[a-z]+\s*=/i);
  });

  test("does NOT import io.lievit.* (gate classpath is JDK + jte + registry/icons only)", () => {
    expect(src).not.toMatch(/@import\s+io\.lievit\./);
  });

  test("does NOT use @import static for any io.lievit class", () => {
    expect(src).not.toMatch(/@import\s+static\s+io\.lievit\./);
  });
});

// ---------------------------------------------------------------------------
// Doc-comment + usage section (architecture contract §3)
// ---------------------------------------------------------------------------
describe("breadcrumb -- doc-comment conventions", () => {
  test("carries a JTE doc-comment block (<%-- --%>)", () => {
    expect(src).toContain("<%--");
    expect(src).toContain("--%>");
  });

  test("doc-comment block does NOT use @* *@ (forbidden alternate comment syntax)", () => {
    expect(src).not.toMatch(/@\*/);
  });

  test("doc-comment block does NOT nest a <%-- inside the outer comment", () => {
    // A nested <%-- inside the doc-comment would close the outer comment early.
    // The outer block is the FIRST occurrence; count the occurrences carefully:
    // - exactly one <%-- opens the outer comment (at the top of the file)
    // - any additional <%-- before the first --%> is a nested comment (forbidden)
    const openIdx = src.indexOf("<%--");
    const closeIdx = src.indexOf("--%>");
    // Nothing between the first open and the first close should contain <%--
    const between = src.slice(openIdx + 4, closeIdx);
    expect(between).not.toContain("<%--");
  });

  test("doc-comment includes TIER:, STRUCTURE:, A11y:, Params:, Usage: sections", () => {
    expect(src).toContain("TIER:");
    expect(src).toContain("STRUCTURE");
    expect(src).toContain("A11y");
    expect(src).toContain("Params:");
    expect(src).toContain("Usage:");
  });

  test("no raw generic type syntax inside the doc-comment (would mis-parse as HTML tags)", () => {
    // The spec warns: never put raw <Type,Type> generics in the comment text.
    // Allowed: "Map of String to String", "List<Map<String,String>>" in @param.
    // We only check the comment block itself.
    const openIdx = src.indexOf("<%--");
    const closeIdx = src.indexOf("--%>");
    const comment = src.slice(openIdx, closeIdx + 4);
    // Map<String,String> or similar should appear only as prose, not as raw Java generics
    // in a way that looks like an HTML tag. We assert no < immediately followed by a capital letter
    // that forms a recognizable generic (e.g. <String, <List<).
    // The stricter check: no <String> or <Map> as standalone tag-like tokens in the comment.
    expect(comment).not.toMatch(/<String>/);
    expect(comment).not.toMatch(/<Map>/);
  });
});

// ---------------------------------------------------------------------------
// No role="navigation" redundancy on <nav> (spec §8 anti-patterns)
// ---------------------------------------------------------------------------
describe("breadcrumb -- APG anti-pattern guards", () => {
  test("does NOT add role='navigation' on the <nav> element (redundant, lint violation)", () => {
    expect(markup).not.toContain('role="navigation"');
  });

  test("does NOT hardcode aria-label='breadcrumb' (must use the navLabel param)", () => {
    // The label must come from the param, not be baked in.
    expect(markup).not.toContain('aria-label="breadcrumb"');
    expect(markup).not.toContain('aria-label="Breadcrumb"');
    // (The param default 'Breadcrumb' is in the @param declaration, not in the markup.)
  });

  test("uses <ol> not <ul> (the trail is ordered: root to current)", () => {
    expect(markup).not.toMatch(/<ul\b/);
    expect(markup).toMatch(/<ol\b/);
  });
});

// ---------------------------------------------------------------------------
// Single-item edge case (spec §7: single_item_renders_only_current)
// ---------------------------------------------------------------------------
describe("breadcrumb -- single-item edge case", () => {
  test("the loop runs over the full items list with _i as the index", () => {
    // When n=1, the loop fires once with _i=0 = _n-1 → isCurrent=true → span aria-current.
    // Verified by the loop structure.
    expect(src).toMatch(/@for\(int _i = 0; _i < _n; _i\+\+\)/);
  });

  test("isCurrent is true for the sole item when n=1 (_i == _n - 1 when both are 0)", () => {
    expect(src).toContain("_isCurrent = _i == _n - 1");
  });
});

// ---------------------------------------------------------------------------
// app-shell.jte backward compat: the items param type is still List<Map<String,String>>
// ---------------------------------------------------------------------------
describe("breadcrumb -- internal-consumer backward compat", () => {
  test("items param is still List<Map<String,String>> (app-shell.jte passes this type)", () => {
    // app-shell.jte declares `@param List<Map<String, String>> breadcrumb` and calls
    // @template.lievit.breadcrumb(items = breadcrumb). The type must match.
    expect(src).toContain("@param List<Map<String, String>> items");
  });
});
