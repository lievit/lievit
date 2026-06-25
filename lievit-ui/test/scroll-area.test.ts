/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * lievit-ui scroll-area.jte -- structural golden on the JTE SOURCE TEXT (after the Stimulus
 * conversion: the overlay behaviour moved from scroll-area.enhancer.ts to the lv-scroll-area
 * Stimulus controller).
 *
 * This suite covers:
 *   §1  Source-text: @param API, doc-comment structure, hard-rule compliance.
 *   §2  Source-text: data-slot anatomy, orientation + overlay branches, ARIA attributes, and the
 *       CSP-clean controller wiring (data-controller / data-action / data-*-target).
 *   §3  Source-text: CSP constraints (no inline script, no on* handler, no <style> block,
 *       no hardcoded hex, no dev.lievit import).
 *   §4  Source-text: JTE compile contract (no nested comments, no tag-name expression,
 *       no @if in attr-name position, balanced tags).
 *
 * The runtime BEHAVIOUR (thumb sizing, scroll sync, drag, pointer-over, morph-safety) is proven by
 * test/lv-scroll-area-controller.test.ts against the REAL Stimulus Application + REAL wire morph.
 *
 * Pattern mirrors slider.test.ts: read the JTE source, strip doc comments, then assert the
 * load-bearing structural invariants.
 *
 * NO DOM render via JTE compiler (no JVM in Node package). The JTE-compile real-compiler gate
 * covers runtime rendering (test/jte-compile/).
 */

import { describe, test, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

// ---------------------------------------------------------------------------
// JTE source helpers
// ---------------------------------------------------------------------------

const jteDir = join(import.meta.dirname, "..", "registry", "jte");
const src = readFileSync(join(jteDir, "scroll-area.jte"), "utf8");
/** Source with the leading doc-comment block stripped so assertions never match doc prose. */
const markup = src.replace(/<%--[\s\S]*?--%>/g, "");

// ---------------------------------------------------------------------------
// §1 API — param declarations + doc-comment
// ---------------------------------------------------------------------------

describe("scroll-area.jte -- params & docs API", () => {
  test("ships + registers: meta.json + <%-- --%> doc-comment + @@template usage snippet", () => {
    expect(existsSync(join(jteDir, "scroll-area", "meta.json")), "meta.json must exist").toBe(true);
    expect(src, "must have a <%-- doc-comment block").toContain("<%--");
    expect(src, "doc-comment must close with --%>").toContain("--%>");
    expect(src, "must NOT use @* *@ comment syntax").not.toMatch(/@\*/);
    expect(src, "doc-comment must contain Usage: section").toMatch(/Usage:/);
    expect(src, "usage snippet must show @@template.lievit.scroll-area(").toContain("@@template.lievit.scroll-area(");
  });

  test("declares every documented @param with correct type and default", () => {
    expect(src).toContain("@param gg.jte.Content content");
    expect(src).toContain("@param String height = null");
    expect(src).toContain("@param String width = null");
    expect(src).toContain('@param String orientation = "vertical"');
    expect(src).toContain("@param boolean overlay = false");
    expect(src).toContain("@param int hideDelay = 1000");
    expect(src).toContain('@param String type = "hover"');
    expect(src).toContain("@param String ariaLabel = null");
    expect(src).toContain("@param String ariaLabelledBy = null");
    expect(src).toContain('@param String cssClass = ""');
    expect(src).toContain('@param String viewportCssClass = ""');
    expect(src).toContain('@param String attrs = ""');
    expect(src).toContain("@param java.util.Map<String, String> dataAttrs = java.util.Map.of()");
  });

  test("no dev.lievit import (gate classpath is JDK + jte only)", () => {
    expect(src, "must not import dev.lievit.*").not.toContain("@import dev.lievit");
  });

  test("imports the three JTE utility types (Content, StringOutput, Escape)", () => {
    expect(src).toContain("@import gg.jte.Content");
    expect(src).toContain("@import gg.jte.output.StringOutput");
    expect(src).toContain("@import gg.jte.html.escape.Escape");
  });
});

// ---------------------------------------------------------------------------
// §2 Structural anatomy (data-slots, attributes, orientation, overlay)
// ---------------------------------------------------------------------------

describe("scroll-area.jte -- root element structure", () => {
  test("root carries data-slot=scroll-area and data-orientation", () => {
    expect(markup).toContain('data-slot="scroll-area"');
    expect(markup).toContain('data-orientation="${orientation}"');
  });

  test("data-type is a smart attribute: null (and thus dropped) when overlay=false", () => {
    // When overlay=false: data-type="${overlay ? type : null}" => null => attribute dropped by JTE.
    expect(markup).toContain('data-type="${overlay ? type : null}"');
  });

  test("data-hide-delay is a smart attribute: null when overlay=false", () => {
    expect(markup).toContain('data-hide-delay="${overlay ? String.valueOf(hideDelay) : null}"');
  });

  test("data-controller=lv-scroll-area is a smart attribute: present when overlay=true, dropped when false", () => {
    // The overlay behaviour is a Stimulus controller; the root mounts it ONLY when overlay=true
    // (overlay=false is a static native-scrollbar partial with zero JS). JTE drops the attr on null.
    expect(markup).toContain('data-controller="${overlay ? "lv-scroll-area" : null}"');
    // The old enhancer discovery attribute is gone (replaced by data-controller).
    expect(markup).not.toContain("data-lievit-scroll-area");
  });

  test("the template wires the controller CSP-clean via data-action / data-*-target (no inline handlers)", () => {
    // Viewport: the scroll sync is a data-action descriptor + the controller reaches it via a target.
    expect(markup).toContain('data-action="${overlay ? "scroll->lv-scroll-area#scrolled" : null}"');
    expect(markup).toContain('data-lv-scroll-area-target="${overlay ? "viewport" : null}"');
    // Rails + thumbs expose targets; thumbs declare the pointer-drag actions.
    expect(markup).toContain('data-lv-scroll-area-target="verticalRail"');
    expect(markup).toContain('data-lv-scroll-area-target="verticalThumb"');
    expect(markup).toContain('data-lv-scroll-area-target="horizontalRail"');
    expect(markup).toContain('data-lv-scroll-area-target="horizontalThumb"');
    expect(markup).toContain("pointerdown->lv-scroll-area#dragStartVertical");
    expect(markup).toContain("pointerdown->lv-scroll-area#dragStartHorizontal");
  });

  test("root uses attrs (TRUSTED $unsafe) and dataAttrs (SAFE Escape.htmlAttribute)", () => {
    expect(src).toContain('$unsafe{attrs}');
    expect(src).toContain('$unsafe{dataAttrsMarkup}');
    expect(src).toContain("Escape.htmlAttribute");
    expect(src).toContain('"[A-Za-z][A-Za-z0-9-]*"');
  });
});

describe("scroll-area.jte -- viewport element structure", () => {
  test("viewport carries data-slot=scroll-area-viewport", () => {
    expect(markup).toContain('data-slot="scroll-area-viewport"');
  });

  test("viewport carries a generated id (viewportId) for aria-controls linkage", () => {
    expect(src).toContain('var viewportId = "lv-sa-" + Integer.toHexString(System.identityHashCode(content));');
    expect(markup).toContain('id="${viewportId}"');
  });

  test("viewport carries tabindex=0 (keyboard-scrollable)", () => {
    expect(markup).toContain('tabindex="0"');
  });

  test("role=region is a smart attribute: set only when hasLabel=true", () => {
    // Smart attribute: role="${hasLabel ? "region" : null}" -- JTE drops the attr when null.
    expect(markup).toContain('role="${hasLabel ? "region" : null}"');
  });

  test("aria-label is a smart attribute on the viewport (dropped when null)", () => {
    expect(markup).toContain('aria-label="${ariaLabel}"');
  });

  test("aria-labelledby is a smart attribute on the viewport (dropped when null)", () => {
    expect(markup).toContain('aria-labelledby="${ariaLabelledBy}"');
  });

  test("hasLabel flag is true when either ariaLabel or ariaLabelledBy is provided", () => {
    expect(src).toContain("var hasLabel = (ariaLabel != null && !ariaLabel.isBlank()) || (ariaLabelledBy != null && !ariaLabelledBy.isBlank());");
  });

  test("viewport has overflow class derived from orientation", () => {
    // The computed overflowClass covers vertical / horizontal / both cases.
    expect(src).toContain('var overflowClass = isBoth ? "overflow-auto"');
    expect(src).toContain('"overflow-x-auto overflow-y-hidden"');
    expect(src).toContain('"overflow-y-auto overflow-x-hidden"');
  });
});

describe("scroll-area.jte -- height/width CSS custom property pattern", () => {
  test("root inline style carries --lv-sa-max-h and/or --lv-sa-max-w when height/width are set", () => {
    expect(src).toContain('"--lv-sa-max-h:"');
    expect(src).toContain('"--lv-sa-max-w:"');
  });

  test("rootStyle is null when both height and width are null (drops style attribute)", () => {
    // The pattern: rootStyle = rootStyleParts.isEmpty() ? null : rootStyleParts
    // JTE drops the style attribute when rootStyle is null.
    expect(src).toContain("var rootStyle = rootStyleParts.isEmpty() ? null : rootStyleParts;");
  });

  test("viewport references the CSS custom properties via max-h-[var(--lv-sa-max-h)] pattern", () => {
    expect(markup).toContain("var(--lv-sa-max-h)");
    expect(markup).toContain("var(--lv-sa-max-w)");
  });
});

describe("scroll-area.jte -- overlay=false: no rail elements", () => {
  test("when overlay=false no scroll-area-bar elements are emitted (guarded by @if(showVerticalRail) etc.)", () => {
    // The guard vars are derived from overlay flag:
    // showVerticalRail = overlay && (isVertical || isBoth)
    // showHorizontalRail = overlay && (isHorizontal || isBoth)
    // showCorner = overlay && isBoth
    expect(src).toContain("var showVerticalRail = overlay && (isVertical || isBoth);");
    expect(src).toContain("var showHorizontalRail = overlay && (isHorizontal || isBoth);");
    expect(src).toContain("var showCorner = overlay && isBoth;");
    // The rails are guarded by @if:
    expect(markup).toContain("@if(showVerticalRail)");
    expect(markup).toContain("@if(showHorizontalRail)");
    expect(markup).toContain("@if(showCorner)");
  });
});

describe("scroll-area.jte -- overlay=true rail anatomy", () => {
  test("vertical rail carries role=scrollbar and data-slot=scroll-area-bar", () => {
    expect(markup).toContain('data-slot="scroll-area-bar"');
    expect(markup).toContain('role="scrollbar"');
  });

  test("rails carry aria-controls referencing the viewport id", () => {
    expect(markup).toContain('aria-controls="${viewportId}"');
  });

  test("vertical rail carries aria-orientation=vertical", () => {
    expect(markup).toContain('aria-orientation="vertical"');
  });

  test("horizontal rail carries aria-orientation=horizontal", () => {
    expect(markup).toContain('aria-orientation="horizontal"');
  });

  test("rails carry aria-valuenow=0, aria-valuemin=0, aria-valuemax=100 (initial static values)", () => {
    expect(markup).toContain('aria-valuenow="0"');
    expect(markup).toContain('aria-valuemin="0"');
    expect(markup).toContain('aria-valuemax="100"');
  });

  test("rails carry tabindex=-1 (focusable for AT, not in tab order)", () => {
    expect(markup).toContain('tabindex="-1"');
  });

  test("rails carry accessible aria-label (vertical/horizontal scrollbar)", () => {
    expect(markup).toContain('aria-label="Vertical scrollbar"');
    expect(markup).toContain('aria-label="Horizontal scrollbar"');
  });

  test("each rail contains a data-slot=scroll-area-thumb child", () => {
    const thumbCount = (markup.match(/data-slot="scroll-area-thumb"/g) ?? []).length;
    expect(thumbCount, "need at least 2 thumb elements (one per rail branch)").toBeGreaterThanOrEqual(2);
  });

  test("corner div carries data-slot=scroll-area-corner and aria-hidden=true", () => {
    expect(markup).toContain('data-slot="scroll-area-corner"');
    expect(markup).toContain('aria-hidden="true"');
  });

  test("viewport carries lv-scrollbar-hide class via scrollbarHideClass computed var", () => {
    // The class is appended only when overlay=true via the scrollbarHideClass var.
    expect(src).toContain('var scrollbarHideClass = overlay ? " lv-scrollbar-hide" : "";');
    expect(markup).toContain("lv-scrollbar-hide");
  });
});

// ---------------------------------------------------------------------------
// §3 CSP compliance + kit consistency
// ---------------------------------------------------------------------------

describe("scroll-area.jte -- CSP compliance + kit consistency", () => {
  test("no inline <script> block", () => {
    expect(markup).not.toMatch(/<script[\s>]/i);
  });

  test("no inline on* event handler (CSP refuses them)", () => {
    expect(markup).not.toMatch(/\son[a-z]+\s*=/i);
  });

  test("no <style> block (kept consistent with the rest of the kit)", () => {
    expect(markup).not.toMatch(/<style[\s>]/i);
  });

  test("no hardcoded hex colour literals (only var(--lv-*) references or transparent/inherit)", () => {
    const hexMatches = markup.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [];
    expect(hexMatches, "literal hex colours must not appear in markup").toEqual([]);
  });

  test("no LitElement / CustomElement import (no Lit island)", () => {
    expect(src.toLowerCase()).not.toMatch(/customelement|litelement|adoptlightstyles|import .*\blit\b/);
  });
});

// ---------------------------------------------------------------------------
// §4 JTE compile contract
// ---------------------------------------------------------------------------

describe("scroll-area.jte -- JTE compile contract", () => {
  test("no nested <%-- inside the doc-comment block (would close the comment early)", () => {
    const firstOpen = src.indexOf("<%--");
    const firstClose = src.indexOf("--%>");
    expect(firstOpen, "must have a doc-comment block").toBeGreaterThanOrEqual(0);
    expect(firstClose, "must close the doc-comment block").toBeGreaterThan(firstOpen);
    const docBlock = src.slice(firstOpen + 4, firstClose);
    expect(docBlock, "nested <%-- inside doc-comment breaks the JTE gate").not.toContain("<%--");
  });

  test("no expression in HTML tag-name position (Illegal HTML tag name)", () => {
    expect(markup).not.toMatch(/<\$\{/);
  });

  test("no @if in attribute-name position (Illegal HTML attribute name)", () => {
    expect(markup).not.toMatch(/@if\([^)]+\)\s*\w[\w-]*\s*=/);
  });

  test("all <div> elements are balanced (no element split across @if/@else branches)", () => {
    const totalOpenDivs = (markup.match(/<div\b/g) ?? []).length;
    const totalCloseDivs = (markup.match(/<\/div>/g) ?? []).length;
    expect(totalOpenDivs, "all <div> elements must have a matching </div>").toBe(totalCloseDivs);
  });

  test("no </div> at the start of a @if or @else branch (element opened outside the branch)", () => {
    expect(markup).not.toMatch(/@if\([^)]*\)\s*<\/div>/);
    expect(markup).not.toMatch(/@else\s*<\/div>/);
  });
});
