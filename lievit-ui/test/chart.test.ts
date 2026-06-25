/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * chart.jte -- structural + a11y contract (spec §7, v-next re-forge).
 *
 * This harness asserts on the PARTIAL SOURCE as text (chart.jte is compiled in the
 * Java world; a real-render/golden lives in test/jte-compile). It pins:
 *
 * - param API (v-next clean-break: `title` not `label`)
 * - SVG void elements: every <rect> <circle> <path> <polyline> <polygon> <line>
 *   must be self-closed with />. An unclosed void in JTE 3 consumes the </svg>
 *   and yields "Unclosed tag <svg>" at compile time. This is the root fix.
 * - a11y: role="img" + aria-labelledby + <title> in SVG, sr-only table, aria-hidden
 *   on decorative groups, interactive marks carry role + tabindex.
 * - security: no inline <script>, no on* handlers, attrs channel is $unsafe-flagged,
 *   dataAttrs channel uses Escape.htmlAttribute.
 * - token-driven styling: no bare hex colours, no hardcoded px spacing in the SVG.
 * - chart types: bar / line / area / pie / donut / composed paths present.
 * - loading / empty states present.
 * - interactive / tooltip markup present when interactive.
 * - reference line path present.
 * - legend delegation to chart/legend.jte.
 */
import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const jteDir = join(import.meta.dirname, "..", "registry", "jte");
const src = readFileSync(join(jteDir, "chart.jte"), "utf8");

/** Strip JTE comments so assertions do not fire on doc-comment prose. */
const markup = src.replace(/<%--[\s\S]*?--%>/g, "");

// ---------------------------------------------------------------------------
// THE CRITICAL INVARIANT: SVG void elements must be self-closed with />
// ---------------------------------------------------------------------------
describe("chart -- SVG void elements must be self-closed />", () => {
  test("no </path> closing tag (path is SVG void in JTE 3)", () => {
    expect(markup).not.toContain("</path>");
  });

  test("no </polygon> closing tag", () => {
    expect(markup).not.toContain("</polygon>");
  });

  test("no </polyline> closing tag", () => {
    expect(markup).not.toContain("</polyline>");
  });

  test("no </rect> closing tag", () => {
    expect(markup).not.toContain("</rect>");
  });

  test("no </circle> closing tag", () => {
    expect(markup).not.toContain("</circle>");
  });

  test("no </line> closing tag (standalone line elements)", () => {
    // HTML tables have <line> too but this template has no HTML <line>; strip tables first.
    const noTable = markup.replace(/<table[\s\S]*?<\/table>/g, "");
    expect(noTable).not.toContain("</line>");
  });

  test("every <path in the markup is followed eventually by /> (self-closed)", () => {
    // This is a structural check: count opening <path vs closing /> (approximately).
    // We verify the negative: no ></path> pattern.
    expect(markup).not.toMatch(/>\s*<\/path>/);
  });

  test("every <rect in the markup is self-closed", () => {
    expect(markup).not.toMatch(/>\s*<\/rect>/);
  });

  test("every <circle in the markup is self-closed", () => {
    expect(markup).not.toMatch(/>\s*<\/circle>/);
  });

  test("every <polygon in the markup is self-closed", () => {
    expect(markup).not.toMatch(/>\s*<\/polygon>/);
  });

  test("every <polyline in the markup is self-closed", () => {
    expect(markup).not.toMatch(/>\s*<\/polyline>/);
  });
});

// ---------------------------------------------------------------------------
// Param API (v-next: title replaces label)
// ---------------------------------------------------------------------------
describe("chart -- param API (v-next clean-break)", () => {
  test("requires title param (not label)", () => {
    expect(src).toContain("@param String title");
    // CLEAN BREAK: label is gone as a param.
    expect(src).not.toMatch(/@param String label/);
  });

  test("optional params with documented defaults", () => {
    expect(src).toContain("@param boolean showTitle = false");
    expect(src).toContain("@param String description = null");
    expect(src).toContain('@param String type = "bar"');
    expect(src).toContain("@param int height = 300");
    expect(src).toContain("@param boolean showAxis = true");
    expect(src).toContain("@param boolean showLegend = false");
    expect(src).toContain("@param boolean showTable = true");
    expect(src).toContain("@param boolean interactive = false");
    expect(src).toContain("@param boolean loading = false");
    expect(src).toContain('@param String emptyText = "No data"');
    expect(src).toContain("@param boolean zoomable = false");
    expect(src).toContain('@param String cssClass = ""');
    expect(src).toContain('@param String attrs = ""');
    expect(src).toContain("@param String tableCaption = null");
  });

  test("multi-series param is List<Map<String, String>> series", () => {
    expect(src).toContain("@param java.util.List<java.util.Map<String, String>> series");
  });

  test("dataAttrs param is Map<String, String> with safe escaping", () => {
    expect(src).toContain("@param java.util.Map<String, String> dataAttrs = java.util.Map.of()");
    expect(src).toContain("Escape.htmlAttribute");
  });

  test("legacy bridge params present (categories + values)", () => {
    expect(src).toContain("@param String[] categories = new String[0]");
    expect(src).toContain("@param int[] values = new int[0]");
  });

  test("usage doc shows @@template.lievit.chart(title = ...) call syntax", () => {
    expect(src).toContain("@@template.lievit.chart(title =");
  });
});

// ---------------------------------------------------------------------------
// Accessibility contract
// ---------------------------------------------------------------------------
describe("chart -- accessibility", () => {
  test("SVG carries role=\"img\" + aria-labelledby", () => {
    expect(markup).toContain('role="img"');
    expect(markup).toContain("aria-labelledby=");
  });

  test("SVG <title> element is emitted with the _svgTitleId", () => {
    expect(markup).toContain("<title id=");
    expect(markup).toContain("${_svgTitleId}");
  });

  test("optional <desc> emitted when description param is set", () => {
    expect(markup).toContain("<desc id=");
    expect(markup).toContain("${_svgDescId}");
  });

  test("decorative chrome groups are aria-hidden", () => {
    // Grid/axes/legend groups carry aria-hidden="true".
    expect(markup).toContain('aria-hidden="true"');
  });

  test("figure has data-slot='chart' and data-chart-type", () => {
    expect(markup).toContain('data-slot="chart"');
    expect(markup).toContain("data-chart-type=");
  });

  test("accessible table emitted when showTable=true (the default)", () => {
    expect(markup).toContain("@if(showTable)");
    expect(markup).toContain('<table class="sr-only"');
    expect(markup).toContain('<th scope="col">');
    expect(markup).toContain('<th scope="row">');
    expect(markup).toContain("<caption>");
  });

  test("empty state emits role='status' span", () => {
    expect(markup).toContain('role="status"');
    expect(markup).toContain("${emptyText}");
  });

  test("loading state: shimmer placeholder", () => {
    expect(markup).toContain("@if(loading)");
    expect(markup).toContain("lv-chart__shimmer");
  });

  test("figure aria-busy when loading", () => {
    expect(markup).toContain('aria-busy="${loading ? "true" : null}"');
  });

  test("interactive marks get role and tabindex", () => {
    // Bars and circles conditionally carry role="img" + tabindex="0".
    expect(markup).toContain('role="${interactive ? "img" : null}"');
    expect(markup).toContain('tabindex="${interactive ? "0" : null}"');
  });

  test("showTitle renders a visible h3", () => {
    expect(markup).toContain("@if(showTitle)");
    expect(markup).toContain("<h3");
    expect(markup).toContain("</h3>");
  });
});

// ---------------------------------------------------------------------------
// Chart type paths
// ---------------------------------------------------------------------------
describe("chart -- chart type render paths", () => {
  test("bar chart: rect with lv-chart__bar class", () => {
    expect(markup).toContain('class="lv-chart__bar"');
  });

  test("line chart: polyline with lv-chart__line class", () => {
    expect(markup).toContain('class="lv-chart__line"');
  });

  test("area chart: polygon with lv-chart__area class", () => {
    expect(markup).toContain('class="lv-chart__area"');
  });

  test("pie/donut chart: path with lv-chart__sector class", () => {
    expect(markup).toContain('class="lv-chart__sector"');
  });

  test("line/area chart: circle data marks with lv-chart__point class", () => {
    expect(markup).toContain('class="lv-chart__point"');
  });

  test("pie/donut branch checks isPielike flag", () => {
    expect(src).toContain("isPielike");
    expect(src).toContain("isDonut");
  });

  test("donut inner radius computed", () => {
    expect(src).toContain("innerR");
    expect(src).toContain("isDonut ? pieR / 2 : 0");
  });
});

// ---------------------------------------------------------------------------
// data-point-* attributes for enhancer
// ---------------------------------------------------------------------------
describe("chart -- data-point-* attributes", () => {
  test("data-point-series on marks", () => {
    expect(markup).toContain("data-point-series=");
  });

  test("data-point-x on marks", () => {
    expect(markup).toContain("data-point-x=");
  });

  test("data-point-y on marks", () => {
    expect(markup).toContain("data-point-y=");
  });

  test("data-point-index on marks", () => {
    expect(markup).toContain("data-point-index=");
  });
});

// ---------------------------------------------------------------------------
// Interactive + tooltip
// ---------------------------------------------------------------------------
describe("chart -- interactive / tooltip", () => {
  test("data-lievit-enhancer='chart' emitted conditionally", () => {
    expect(markup).toContain('data-lievit-enhancer="${interactive ? "chart" : null}"');
  });

  test("data-tooltip-id emitted when interactive", () => {
    expect(markup).toContain('data-tooltip-id="${interactive ? _tooltipId : null}"');
  });

  test("tooltip div emitted inside @if(interactive)", () => {
    expect(markup).toContain("@if(interactive)");
    expect(markup).toContain('class="lv-chart__tooltip"');
    expect(markup).toContain('role="tooltip"');
    expect(markup).toContain('aria-live="off"');
  });

  test("zoomable flag forwarded to enhancer via data attribute", () => {
    expect(markup).toContain('data-chart-zoomable="${(interactive && zoomable) ? "true" : null}"');
  });
});

// ---------------------------------------------------------------------------
// Stimulus controller wiring (the conversion of chart.enhancer.ts)
// Behaviour is proven in test/lv-chart-controller.test.ts against the REAL controller + morph;
// this block pins the CSP-clean data-attribute CONTRACT the template must emit for it.
// ---------------------------------------------------------------------------
describe("chart -- lv-chart Stimulus controller wiring", () => {
  test("figure mounts data-controller='lv-chart' only when interactive", () => {
    expect(markup).toContain('data-controller="${interactive ? "lv-chart" : null}"');
  });

  test("the mark action descriptor is declared once and gated on interactive", () => {
    expect(markup).toContain("String _markAction = interactive");
    expect(markup).toContain("pointerenter->lv-chart#markActivate");
    expect(markup).toContain("focus->lv-chart#markActivate");
    expect(markup).toContain("pointerleave->lv-chart#markDeactivate");
    expect(markup).toContain("blur->lv-chart#markDeactivate");
    expect(markup).toContain("click->lv-chart#markClick");
    expect(markup).toContain("keydown->lv-chart#markKeydown");
  });

  test("every interactive mark carries data-action='${_markAction}'", () => {
    // Bars, points and pie/donut sectors are the three mark shapes; each must be wired.
    const markActionHits = markup.match(/data-action="\$\{_markAction\}"/g) ?? [];
    expect(markActionHits.length).toBe(3);
  });

  test("the SVG carries the brush action only when interactive && zoomable", () => {
    expect(markup).toContain("String _svgAction = (interactive && zoomable)");
    expect(markup).toContain("pointerdown->lv-chart#brushStart");
    expect(markup).toContain("pointermove->lv-chart#brushMove");
    expect(markup).toContain("pointerup->lv-chart#brushEnd");
    expect(markup).toContain('data-action="${_svgAction}"');
  });

  test("the tooltip is the lv-chart controller's target", () => {
    expect(markup).toContain('data-lv-chart-target="tooltip"');
  });

  test("data-action attributes are plain strings (CSP-clean, no inline handler)", () => {
    // The descriptors are declared in JTE locals and referenced by ${...}; never an on*= handler.
    expect(markup).not.toMatch(/\son[a-z]+=/i);
  });
});

// ---------------------------------------------------------------------------
// Reference lines
// ---------------------------------------------------------------------------
describe("chart -- reference lines", () => {
  test("reference line loop renders <line class='lv-chart__reference-line'", () => {
    expect(markup).toContain("lv-chart__reference-line");
  });

  test("reference lines are self-closed (void SVG element)", () => {
    // The reference line elements must be self-closed />
    const refLineSection = markup.split("referenceLines")[1] ?? "";
    expect(refLineSection).not.toContain("</line>");
  });
});

// ---------------------------------------------------------------------------
// Security
// ---------------------------------------------------------------------------
describe("chart -- security hygiene", () => {
  test("no inline <script> tag", () => {
    expect(src).not.toMatch(/<script/i);
  });

  test("no inline on* event handlers", () => {
    const handlers = src.match(/\son[a-z]+=/gi) ?? [];
    expect(handlers, `unexpected inline handlers: ${handlers.join(", ")}`).toEqual([]);
  });

  test("attrs channel is marked $unsafe (TRUSTED raw)", () => {
    expect(markup).toContain("$unsafe{attrs}");
  });

  test("dataAttrs channel uses Escape.htmlAttribute (SAFE escaped)", () => {
    expect(src).toContain("Escape.htmlAttribute");
  });

  test("no dev.lievit import (HARD rule: gate classpath does not include lievit types)", () => {
    expect(src).not.toMatch(/^@import dev\.lievit/m);
  });
});

// ---------------------------------------------------------------------------
// Token-driven styling
// ---------------------------------------------------------------------------
describe("chart -- token-driven styling", () => {
  test("palette references --lv-color-chart-N tokens, never bare hex", () => {
    expect(src).toContain("--lv-color-chart-");
    // Strip CSS comments and arbitrary-value brackets, then check for bare hex.
    const stripped = markup.replace(/\[[^\]]*\]/g, "[]");
    expect(stripped, "leaked a hardcoded hex colour").not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  test("grid/axis colour uses --lv-color-border / --lv-color-muted-fg tokens", () => {
    expect(markup).toContain("--lv-color-border");
    expect(markup).toContain("--lv-color-muted-fg");
  });

  test("no em-dashes (Francesco convention)", () => {
    expect(src).not.toMatch(/—/);
  });
});

// ---------------------------------------------------------------------------
// Legend delegation
// ---------------------------------------------------------------------------
describe("chart -- legend delegation", () => {
  test("delegates to @template.lievit.chart.legend when showLegend=true", () => {
    expect(markup).toContain("@template.lievit.chart.legend(");
  });

  test("pie/donut passes effectiveLabels as slice names", () => {
    expect(markup).toContain("names = effectiveLabels");
  });

  test("cartesian passes legendNames derived from series", () => {
    expect(markup).toContain("names = legendNames");
  });
});

// ---------------------------------------------------------------------------
// Enhancer source structure (chart.enhancer.ts)
// ---------------------------------------------------------------------------
describe("chart.enhancer.ts -- source structure", () => {
  const enhSrc = readFileSync(
    join(import.meta.dirname, "..", "registry", "jte", "chart.enhancer.ts"),
    "utf8",
  );

  test("exports installChart function", () => {
    expect(enhSrc).toContain("export function installChart(");
  });

  test("dispatches lv-chart-mark-click CustomEvent", () => {
    expect(enhSrc).toContain("lv-chart-mark-click");
    expect(enhSrc).toContain("CustomEvent");
  });

  test("shows tooltip on focus and pointerenter", () => {
    expect(enhSrc).toContain('"focus"');
    expect(enhSrc).toContain('"pointerenter"');
  });

  test("hides tooltip on blur and pointerleave", () => {
    expect(enhSrc).toContain('"blur"');
    expect(enhSrc).toContain('"pointerleave"');
  });

  test("keyboard navigation handles ArrowLeft / ArrowRight / Home / End", () => {
    expect(enhSrc).toContain('"ArrowLeft"');
    expect(enhSrc).toContain('"ArrowRight"');
    expect(enhSrc).toContain('"Home"');
    expect(enhSrc).toContain('"End"');
  });

  test("Escape key dismisses tooltip", () => {
    expect(enhSrc).toContain('"Escape"');
  });

  test("zoom/pan: setupZoom function + Reset zoom button", () => {
    expect(enhSrc).toContain("setupZoom");
    expect(enhSrc).toContain("Reset zoom");
  });

  test("no inline eval or on* handlers", () => {
    expect(enhSrc).not.toContain("eval(");
    expect(enhSrc).not.toMatch(/\bon[A-Z][a-z]+\s*=/);
  });

  test("does not import dev.lievit", () => {
    expect(enhSrc).not.toContain('from "dev.lievit');
  });
});

// ---------------------------------------------------------------------------
// CSS source structure (chart.css)
// ---------------------------------------------------------------------------
describe("chart.css -- source structure", () => {
  const cssSrc = readFileSync(
    join(import.meta.dirname, "..", "registry", "jte", "chart.css"),
    "utf8",
  );

  test("defines @keyframes lv-chart-shimmer", () => {
    expect(cssSrc).toContain("@keyframes lv-chart-shimmer");
  });

  test("defines .lv-chart__shimmer for loading state", () => {
    expect(cssSrc).toContain(".lv-chart__shimmer");
  });

  test("defines .lv-chart__tooltip[data-open] for display toggle", () => {
    expect(cssSrc).toContain(".lv-chart__tooltip[data-open]");
  });

  test("defines [data-dim] for dimmed marks", () => {
    expect(cssSrc).toContain("[data-dim]");
  });

  test("defines [data-highlighted] for highlighted marks", () => {
    expect(cssSrc).toContain("[data-highlighted]");
  });

  test("defines :focus-visible ring on interactive marks", () => {
    expect(cssSrc).toContain(":focus-visible");
  });

  test("no hardcoded hex colours in CSS", () => {
    expect(cssSrc).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  test("prefers-reduced-motion collapses shimmer animation", () => {
    expect(cssSrc).toContain("prefers-reduced-motion");
  });
});
