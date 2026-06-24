/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * Acceptance tests for the v-next pagination partial (specs/pagination.md).
 *
 * Strategy: source-text assertions on the compiled JTE template source.
 * The real JTE-compile + render gate lives in test/jte-compile; this suite pins
 * the API surface, a11y contract, escaping channels, and structural invariants
 * as a fast structural golden that runs without a JVM.
 *
 * Spec sections covered:
 *   - render: API params, structural elements (nav/ol/li/a/button)
 *   - a11y: aria-current, aria-label, aria-disabled, aria-live, role
 *   - wire mode vs URL mode
 *   - sliding window + ellipsis + first/last buttons
 *   - disabled whole control
 *   - simple mode
 *   - optional compound elements (showTotal, showSizeSwitcher, showJumper)
 *   - zero/single page guard
 *   - escaping channels (trusted raw vs safe escaped)
 *   - size variants
 *   - icon wiring (prev/next/ellipsis through @template.lievit.icon)
 *   - no inline script, no on* handlers, no hardcoded hex, no raw px
 *   - CSP: no <script>, no on*= handlers
 */
import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const src = readFileSync(
  join(import.meta.dirname, "..", "registry", "jte", "pagination.jte"),
  "utf8"
);

// ---------------------------------------------------------------------------
// Shared hygiene (mirrors static-partials-b2 shared suite)
// ---------------------------------------------------------------------------

describe("pagination -- shared hygiene", () => {
  test("ships with a <%-- --%> header doc-comment, Usage section, and @param declarations", () => {
    expect(src, "missing JTE comment block").toContain("<%--");
    expect(src, "comment block must close").toContain("--%>");
    expect(src, "must NOT use @* *@ comment syntax").not.toMatch(/@\*/);
    expect(src, "missing Usage section").toMatch(/Usage:/);
    expect(src, "usage must show the @@template call").toContain(
      "@@template.lievit.pagination("
    );
    expect(src, "missing @param declarations").toMatch(/@param /);
  });

  test("no Font Awesome / wa-icon references", () => {
    expect(src.toLowerCase()).not.toMatch(/font-?awesome|wa-icon|fa-/);
  });

  test("no inline <script> and no inline on* handlers", () => {
    expect(src).not.toMatch(/<script/i);
    const inlineHandlers = src.match(/\son[a-z]+=/gi) ?? [];
    expect(
      inlineHandlers,
      `unexpected inline handlers: ${inlineHandlers.join(", ")}`
    ).toEqual([]);
  });

  test("every icon goes through @template.lievit.icon, no raw <svg>", () => {
    const rawSvg = src.match(/<svg\b/gi) ?? [];
    expect(rawSvg, "raw <svg> found; route icons through @template.icon").toEqual([]);
  });

  test("styling is token-driven: no bare hex colours, no raw px spacing utilities", () => {
    expect(src, "leaked a hardcoded hex colour").not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    const stripped = src
      .replace(/\[[^\]]*\]/g, "[]")
      .replace(/-\d+\/\d+/g, "")
      .replace(/\bmin-w-0\b/g, "");
    const numericUtils = (
      stripped.match(
        /\b(?:p|px|py|pt|pb|pl|pr|m|mx|my|mb|mt|gap|h|w|text|size|space)-[1-9]/g
      ) ?? []
    ).filter(
      (u) => !/tracking-tight|leading-snug|leading-none|space-x-2|max-w-lg|max-w-sm/.test(u)
    );
    expect(
      numericUtils,
      `non-token numeric utilities: ${numericUtils.join(", ")}`
    ).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// API surface (@param declarations)
// ---------------------------------------------------------------------------

describe("pagination -- @param API surface", () => {
  test("declares required params: currentPage and totalPages as int", () => {
    expect(src).toContain("@param int currentPage");
    expect(src).toContain("@param int totalPages");
  });

  test("declares baseUrl with null default", () => {
    expect(src).toContain("@param String baseUrl = null");
  });

  test("declares windowSize with default 5", () => {
    expect(src).toContain("@param int windowSize = 5");
  });

  test("declares boolean toggle params with correct defaults", () => {
    expect(src).toContain("@param boolean showFirstLast = true");
    expect(src).toContain("@param boolean showPrevNext = true");
    expect(src).toContain("@param boolean showTotal = false");
    expect(src).toContain("@param boolean showSizeSwitcher = false");
    expect(src).toContain("@param boolean showJumper = false");
    expect(src).toContain("@param boolean simple = false");
    expect(src).toContain("@param boolean disabled = false");
  });

  test("declares totalItems as long with default 0", () => {
    expect(src).toContain("@param long totalItems = 0");
  });

  test("declares size param with md default", () => {
    expect(src).toContain('@param String size = "md"');
  });

  test("declares ariaLabel with 'Pagination' default", () => {
    expect(src).toContain('@param String ariaLabel = "Pagination"');
  });

  test("declares cssClass (not klass) with empty default", () => {
    expect(src).toContain('@param String cssClass = ""');
    expect(src).not.toContain("@param String klass");
  });

  test("declares trusted-raw channels: attrs and pageAttrs", () => {
    expect(src).toContain('@param String attrs = ""');
    expect(src).toContain('@param String pageAttrs = ""');
  });

  test("declares safe-escaped channels: dataAttrs and pageDataAttrs as Map", () => {
    expect(src).toContain(
      "@param java.util.Map<String,String> dataAttrs = java.util.Map.of()"
    );
    expect(src).toContain(
      "@param java.util.Map<String,String> pageDataAttrs = java.util.Map.of()"
    );
  });

  test("declares Content slots for custom prev/next/ellipsis", () => {
    expect(src).toContain("@param gg.jte.Content ellipsisContent = null");
    expect(src).toContain("@param gg.jte.Content prevContent = null");
    expect(src).toContain("@param gg.jte.Content nextContent = null");
  });

  test("declares pageSizes as List<Integer> with null default", () => {
    expect(src).toContain("@param java.util.List<Integer> pageSizes = null");
  });

  test("declares currentPageSize and pageSizeBaseUrl", () => {
    expect(src).toContain("@param int currentPageSize = 10");
    expect(src).toContain("@param String pageSizeBaseUrl = null");
  });

  test("does NOT declare the old API params (hrefPattern, siblings, klass, linkAttrs, inline, current, total)", () => {
    expect(src).not.toContain("@param String hrefPattern");
    expect(src).not.toContain("@param int siblings");
    expect(src).not.toContain("@param String klass");
    expect(src).not.toContain("@param String linkAttrs");
    expect(src).not.toContain("@param boolean inline");
    expect(src).not.toContain("@param int current ");
    expect(src).not.toContain("@param int total ");
  });
});

// ---------------------------------------------------------------------------
// A11y contract
// ---------------------------------------------------------------------------

describe("pagination -- a11y contract (APG Navigation + Breadcrumb aria-current)", () => {
  test("wraps everything in a <nav> landmark with aria-label bound to the param", () => {
    expect(src).toContain("<nav");
    expect(src).toContain('aria-label="${ariaLabel}"');
    expect(src).not.toContain('role="navigation"');
  });

  test("uses <ol> as the page list (ordered, semantically meaningful)", () => {
    expect(src).toContain("<ol");
    expect(src).toContain("</ol>");
  });

  test("uses <li> wrappers for each page item", () => {
    expect(src).toContain("<li");
  });

  test("aria-current='page' only on the active page: emitted via conditional, never 'true' or 'false'", () => {
    expect(src).toContain('aria-current="${p == cp ? "page" : null}"');
    // The template BODY must never emit a literal aria-current="true" or aria-current="false".
    // Strip the doc-comment block first so the assertion does not fire on prose like
    // "Never aria-current='true'" written in the header comment.
    const body = src.slice(src.lastIndexOf("--%>") + 4);
    expect(body).not.toContain('aria-current="true"');
    expect(body).not.toContain('aria-current="false"');
  });

  test("prev and next have explicit aria-label for icon-only accessible name", () => {
    expect(src).toContain('aria-label="Previous page"');
    expect(src).toContain('aria-label="Next page"');
  });

  test("disabled <a> elements carry aria-disabled='true' and tabindex='-1' (not the disabled attr)", () => {
    expect(src).toContain('aria-disabled="true"');
    expect(src).toContain('tabindex="-1"');
  });

  test("disabled <button> elements carry the native disabled attribute", () => {
    expect(src).toContain("<button");
    expect(src).toContain("disabled");
  });

  test("ellipsis span carries aria-hidden='true' and is never a button or link", () => {
    const ellipsisBlock = (() => {
      const start = src.indexOf('data-slot="pagination-ellipsis"');
      return start >= 0 ? src.slice(start, start + 300) : "";
    })();
    expect(ellipsisBlock).not.toEqual("");
    expect(ellipsisBlock).toContain('aria-hidden="true"');
    expect(ellipsisBlock).not.toMatch(/<button|<a\b/);
  });

  test("total summary has role='status' aria-live='polite' aria-atomic='true'", () => {
    expect(src).toContain('role="status"');
    expect(src).toContain('aria-live="polite"');
    expect(src).toContain('aria-atomic="true"');
  });

  test("simple mode fraction is in an aria-live='polite' region", () => {
    expect(src).toContain('aria-live="polite"');
  });

  test("data-slot='pagination' and data-size are on the root wrapper", () => {
    expect(src).toContain('data-slot="pagination"');
    expect(src).toContain('data-size="${size}"');
  });

  test("data-disabled is emitted on root when disabled (null-drop pattern)", () => {
    expect(src).toContain('data-disabled="${disabled ? "true" : null}"');
  });

  test("no role='navigation' on the <ol> (would create nested navigation landmark)", () => {
    const olBlock = (() => {
      const start = src.indexOf("<ol");
      return start >= 0 ? src.slice(start, start + 80) : "";
    })();
    expect(olBlock).not.toContain('role="navigation"');
  });
});

// ---------------------------------------------------------------------------
// Wire mode vs URL mode
// ---------------------------------------------------------------------------

describe("pagination -- wire mode vs URL mode", () => {
  test("URL mode: uses baseUrl + ?page= + n pattern for hrefs", () => {
    expect(src).toContain('href="${baseUrl}?page=${p}"');
  });

  test("wire mode: emits <button type='button'> elements (not <a href>)", () => {
    expect(src).toContain('type="button"');
  });

  test("wire mode: data-page on page elements holds the page number (safe integer)", () => {
    expect(src).toContain('data-page="${p}"');
  });

  test("wire mode prev/next: data-page carries the adjacent page number", () => {
    expect(src).toContain('data-page="${cp - 1}"');
    expect(src).toContain('data-page="${cp + 1}"');
  });

  test("urlMode local var is computed from baseUrl null check", () => {
    expect(src).toContain("var urlMode = baseUrl != null");
  });
});

// ---------------------------------------------------------------------------
// Sliding window + ellipsis + first/last
// ---------------------------------------------------------------------------

describe("pagination -- sliding window algorithm", () => {
  test("implements the spec window formula: wStart, wEnd, half via integer division", () => {
    expect(src).toContain("var W = Math.max(3, windowSize | 1)");
    expect(src).toContain("var half = W / 2");
    expect(src).toContain("var wStart = Math.max(1, Math.min(cp - half, totalPages - W + 1))");
    expect(src).toContain("var wEnd = Math.min(totalPages, wStart + W - 1)");
  });

  test("renders the window loop from wStart to wEnd", () => {
    expect(src).toContain("@for(int p = wStart; p <= wEnd; p++)");
    expect(src).toContain("@endfor");
  });

  test("shows page-1 button when showFirstLast and wStart > 1", () => {
    expect(src).toContain("showFirstLast && wStart > 1");
  });

  test("shows leading ellipsis when wStart > 2", () => {
    expect(src).toContain("wStart > 2");
  });

  test("shows trailing ellipsis when wEnd < totalPages - 1", () => {
    expect(src).toContain("wEnd < totalPages - 1");
  });

  test("shows page-T button when showFirstLast and wEnd < totalPages", () => {
    expect(src).toContain("showFirstLast && wEnd < totalPages");
    expect(src).toContain('data-page="${totalPages}"');
  });

  test("ellipsis uses @template.lievit.icon(name = 'ellipsis', ...) for the default glyph", () => {
    expect(src).toContain('@template.lievit.icon(name = "ellipsis"');
  });
});

// ---------------------------------------------------------------------------
// Prev/Next controls
// ---------------------------------------------------------------------------

describe("pagination -- prev/next controls", () => {
  test("prev uses chevron-left icon, next uses chevron-right icon", () => {
    expect(src).toContain('@template.lievit.icon(name = "chevron-left"');
    expect(src).toContain('@template.lievit.icon(name = "chevron-right"');
  });

  test("prev/next are guarded by showPrevNext", () => {
    expect(src).toContain("@if(showPrevNext)");
  });

  test("prev is disabled when cp <= 1 (prevDisabled local)", () => {
    expect(src).toContain("var prevDisabled = disabled || cp <= 1");
  });

  test("next is disabled when cp >= totalPages (nextDisabled local)", () => {
    expect(src).toContain("var nextDisabled = disabled || cp >= totalPages");
  });

  test("custom prevContent and nextContent slots are composed when non-null", () => {
    expect(src).toContain("prevContent != null");
    expect(src).toContain("nextContent != null");
    expect(src).toContain("${prevContent}");
    expect(src).toContain("${nextContent}");
  });
});

// ---------------------------------------------------------------------------
// Optional compound elements
// ---------------------------------------------------------------------------

describe("pagination -- optional compound elements", () => {
  test("showTotal gate wraps the summary span", () => {
    expect(src).toContain("@if(showTotal)");
    expect(src).toContain('data-slot="pagination-total"');
    expect(src).toContain("${totalItems}");
  });

  test("showSizeSwitcher composes native-select partial (not a hand-rolled <select>)", () => {
    expect(src).toContain("@if(showSizeSwitcher)");
    expect(src).toContain("@template.lievit.native-select(");
    expect(src).not.toMatch(/<select\b/);
  });

  test("showJumper renders a <form> with <input type='number'> and <button type='submit'>", () => {
    expect(src).toContain("@if(showJumper)");
    expect(src).toContain("<form");
    expect(src).toContain('type="number"');
    expect(src).toContain('type="submit"');
    expect(src).toContain('min="1"');
    expect(src).toContain('max="${totalPages}"');
  });

  test("simple mode renders a fraction region instead of the numbered list", () => {
    expect(src).toContain("@if(simple)");
    expect(src).toContain("Page ${cp} / ${totalPages}");
    expect(src).toContain('data-slot="pagination-simple-label"');
  });
});

// ---------------------------------------------------------------------------
// Zero / single page guard
// ---------------------------------------------------------------------------

describe("pagination -- zero/single page guard", () => {
  test("entire output is gated by totalPages > 1", () => {
    expect(src).toContain("@if(totalPages > 1)");
    expect(src).toContain("@endif");
    const ifIdx = src.indexOf("@if(totalPages > 1)");
    const endIdx = src.lastIndexOf("@endif");
    expect(ifIdx).toBeGreaterThanOrEqual(0);
    expect(endIdx).toBeGreaterThan(ifIdx);
  });
});

// ---------------------------------------------------------------------------
// Disabled whole control
// ---------------------------------------------------------------------------

describe("pagination -- disabled whole control", () => {
  test("disabled prop is composed into prevDisabled and nextDisabled", () => {
    expect(src).toContain("var prevDisabled = disabled || cp <= 1");
    expect(src).toContain("var nextDisabled = disabled || cp >= totalPages");
  });

  test("disabled state branches exist in the window loop (disabled on button, aria-disabled on a)", () => {
    expect(src).toContain("!disabled");
    expect(src).toContain("!urlMode && !disabled");
    expect(src).toContain("urlMode && !disabled");
  });
});

// ---------------------------------------------------------------------------
// Size variants
// ---------------------------------------------------------------------------

describe("pagination -- size variants", () => {
  test("sm maps to --lv-space-8 height token", () => {
    expect(src).toContain('"sm" -> "h-[var(--lv-space-8)]');
    expect(src).toContain("--lv-space-8");
  });

  test("md (default) maps to --lv-space-9 height token", () => {
    expect(src).toContain("--lv-space-9");
  });

  test("lg maps to --lv-space-10 height token", () => {
    expect(src).toContain('"lg" -> "h-[var(--lv-space-10)]');
    expect(src).toContain("--lv-space-10");
  });

  test("text size tokens match size: xs for sm, sm for md, base for lg", () => {
    expect(src).toContain("--lv-text-xs");
    expect(src).toContain("--lv-text-sm");
    expect(src).toContain("--lv-text-base");
  });
});

// ---------------------------------------------------------------------------
// Token usage
// ---------------------------------------------------------------------------

describe("pagination -- token usage (spec §5)", () => {
  test("active page uses --lv-color-primary and --lv-color-primary-fg", () => {
    expect(src).toContain("--lv-color-primary");
    expect(src).toContain("--lv-color-primary-fg");
  });

  test("hover state uses --lv-color-accent and --lv-color-accent-fg", () => {
    expect(src).toContain("--lv-color-accent");
    expect(src).toContain("--lv-color-accent-fg");
  });

  test("muted colour is used for ellipsis / disabled", () => {
    expect(src).toContain("--lv-color-muted");
  });

  test("focus-visible ring uses --lv-ring shared token", () => {
    expect(src).toContain("focus-visible:shadow-[var(--lv-ring)]");
  });

  test("border radius uses --lv-radius-md", () => {
    expect(src).toContain("--lv-radius-md");
  });

  test("font family uses --lv-font-sans on root; --lv-font-mono on jumper input", () => {
    expect(src).toContain("--lv-font-sans");
    expect(src).toContain("--lv-font-mono");
  });

  test("gap between buttons uses --lv-space-1", () => {
    expect(src).toContain("--lv-space-1");
  });
});

// ---------------------------------------------------------------------------
// Escaping channels
// ---------------------------------------------------------------------------

describe("pagination -- escaping channels (XSS trust split)", () => {
  test("attrs is emitted with $unsafe on the wrapper root", () => {
    expect(src).toContain("$unsafe{attrs}");
  });

  test("pageAttrs is emitted with $unsafe on each interactive page element", () => {
    const pageAttrsUsages = (src.match(/\$unsafe\{pageAttrs\}/g) ?? []).length;
    expect(pageAttrsUsages, "pageAttrs should appear on multiple interactive elements").toBeGreaterThan(2);
  });

  test("dataAttrs is built via Escape.htmlAttribute (safe channel)", () => {
    expect(src).toContain("Escape.htmlAttribute");
    expect(src).toContain("wrapperData");
  });

  test("pageDataAttrs is built via Escape.htmlAttribute (safe channel)", () => {
    expect(src).toContain("pageDataMarkup");
  });

  test("$unsafe is ONLY used for attrs and pageAttrs (the two trusted-raw channels)", () => {
    const unsafeUsages = (src.match(/\$unsafe\{[^}]+\}/g) ?? []);
    const nonChannel = unsafeUsages.filter(
      (u) =>
        !u.includes("attrs}") &&
        !u.includes("pageAttrs}") &&
        !u.includes("wrapperData") &&
        !u.includes("pageDataMarkup")
    );
    expect(
      nonChannel,
      `unexpected $unsafe usages beyond the two trusted channels + escaped fragments: ${nonChannel.join(", ")}`
    ).toEqual([]);
  });

  test("no io.lievit imports (gate would fail: template is presentational only)", () => {
    expect(src).not.toMatch(/@import\s+io\.lievit/);
  });

  test("JTE comment syntax does not nest (no --%> inside the outer comment block)", () => {
    const commentBlock = src.slice(src.indexOf("<%--"), src.indexOf("--%>") + 4);
    const innerClose = commentBlock.indexOf("--%>", 4);
    expect(innerClose, "inner --%> closes the outer comment early -- nested comment detected").toBe(
      commentBlock.length - 4
    );
  });

  test("no @if(...) in attribute name position (smart attribute pattern enforced)", () => {
    expect(src).not.toMatch(/\s@if\([^)]+\)\s*[a-z-]+="|@endif\s*"/);
  });
});

// ---------------------------------------------------------------------------
// data-slot attributes (structural hooks for styling + Playwright selectors)
// ---------------------------------------------------------------------------

describe("pagination -- data-slot structural hooks", () => {
  const EXPECTED_SLOTS = [
    "pagination",
    "pagination-nav",
    "pagination-list",
    "pagination-item",
    "pagination-prev",
    "pagination-next",
    "pagination-page",
    "pagination-ellipsis",
    "pagination-total",
    "pagination-size-switcher",
    "pagination-jumper",
    "pagination-simple-label",
  ];

  for (const slot of EXPECTED_SLOTS) {
    test(`data-slot="${slot}" is present in the template`, () => {
      expect(src).toContain(`data-slot="${slot}"`);
    });
  }
});

// ---------------------------------------------------------------------------
// Instance-id for accessible (label for) pairing
// ---------------------------------------------------------------------------

describe("pagination -- instanceId for label/input pairing", () => {
  test("generates a stable instanceId local variable for label/input id pairing", () => {
    expect(src).toContain("var instanceId =");
  });

  test("uses instanceId in the jumper input id", () => {
    expect(src).toContain('id="${instanceId}-jump"');
    expect(src).toContain('for="${instanceId}-jump"');
  });

  test("uses instanceId in the size-switcher select id", () => {
    expect(src).toContain('instanceId + "-size"');
  });
});
