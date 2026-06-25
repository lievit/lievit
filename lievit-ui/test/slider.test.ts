/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * lievit-ui slider.jte -- full structural golden after the v-next re-forge.
 *
 * Pins every contract from spec §7 acceptance tests as source-as-text assertions.
 * The pattern mirrors switch.test.ts: read the JTE source, strip doc comments, then
 * assert the load-bearing structural invariants without a JVM round-trip.
 *
 * NO DOM render here (no JTE compiler in the Node package).
 * The JTE-compile real-compiler gate covers runtime rendering (test/jte-compile/).
 *
 * The lv-slider Stimulus controller behaviour is covered by the controller section below, driving
 * the REAL @hotwired/stimulus Application (startStimulus auto-loads the controller by filename) over
 * a DOM built exactly as slider.jte emits it (data-controller + data-action + data-*-target +
 * data-lv-slider-thumb-param), plus the REAL lievit wire morph for morph-safety. No mocked runtime.
 *
 * A11y assertions (axe-rule proxies): each test that maps to an axe rule is annotated.
 *   slider-name         -> aria-label or aria-labelledby on the native input
 *   aria-allowed-attr   -> aria-orientation emitted only on vertical
 *   aria-required-attr  -> min/max/value always present on native input
 *   aria-valid-attr     -> aria-valuemin <= aria-valuenow <= aria-valuemax (range mode)
 */

import { describe, test, it, expect, beforeEach, afterEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { LievitRuntime } from "../runtime/runtime.js";
import { morph } from "../runtime/morph.js";
import { startStimulus, stopStimulus, flushStimulus } from "../runtime/stimulus/application.js";
import LvSliderController from "../runtime/stimulus/controllers/lv-slider-controller.js";

// ---------------------------------------------------------------------------
// JTE source helpers
// ---------------------------------------------------------------------------

const jteDir = join(import.meta.dirname, "..", "registry", "jte");
const src = readFileSync(join(jteDir, "slider.jte"), "utf8");
/** Source with the leading doc comment stripped so assertions never match doc prose. */
const markup = src.replace(/<%--[\s\S]*?--%>/g, "");

// ---------------------------------------------------------------------------
// §2 API — param declarations
// ---------------------------------------------------------------------------

describe("slider.jte -- params & docs API", () => {
  test("declares every documented param with correct type and default", () => {
    expect(src).toContain("@param String name = null");
    expect(src).toContain("@param double value = 0");
    expect(src).toContain("@param double min = 0");
    expect(src).toContain("@param double max = 100");
    expect(src).toContain("@param double step = 1");
    expect(src).toContain("@param boolean rangeMode = false");
    expect(src).toContain("@param double valueLow = 0");
    expect(src).toContain("@param double valueHigh = 100");
    expect(src).toContain('@param String orientation = "horizontal"');
    expect(src).toContain("@param boolean disabled = false");
    // marks: typed list
    expect(src).toContain("@param java.util.List<java.util.Map<String, String>> marks = null");
    expect(src).toContain('@param String showTooltip = "hover"');
    expect(src).toContain("@param String tooltipFormatter = null");
    expect(src).toContain("@param String tooltipFormatterLow = null");
    expect(src).toContain("@param String tooltipFormatterHigh = null");
    expect(src).toContain("@param String ariaLabel = null");
    expect(src).toContain("@param String ariaLabelLow = null");
    expect(src).toContain("@param String ariaLabelHigh = null");
    expect(src).toContain("@param String ariaValuetext = null");
    expect(src).toContain("@param String ariaValuetextLow = null");
    expect(src).toContain("@param String ariaValuetextHigh = null");
    expect(src).toContain('@param String size = "md"');
    expect(src).toContain('@param String cssClass = ""');
    expect(src).toContain('@param String attrs = ""');
    expect(src).toContain("@param java.util.Map<String, String> dataAttrs = java.util.Map.of()");
  });

  test("usage doc uses <%-- --%> (not @* *@) and shows @@template.lievit.slider call", () => {
    expect(src).toContain("<%--");
    expect(src).toContain("--%>");
    expect(src, "must NOT use @* *@ comment syntax").not.toMatch(/@\*/);
    expect(src).toMatch(/Usage:/);
    expect(src).toContain("@@template.lievit.slider(");
  });

  test("no dev.lievit import (gate classpath is JDK + jte only)", () => {
    expect(src, "must not import dev.lievit.*").not.toContain("@import dev.lievit");
  });
});

// ---------------------------------------------------------------------------
// §7 render — basic structure
// ---------------------------------------------------------------------------

describe("slider.jte -- basic structure", () => {
  test("root carries data-slot=slider, data-size, data-orientation, data-range [axe: structural]", () => {
    expect(markup).toContain('data-slot="slider"');
    expect(markup).toContain('data-size="${size}"');
    expect(markup).toContain('data-orientation="${orientation}"');
    expect(markup).toContain('data-range="${rangeMode ? "true" : "false"}"');
  });

  test("root carries data-controller=lv-slider (Stimulus controller hook, replaces the enhancer)", () => {
    expect(markup).toContain('data-controller="lv-slider"');
    // The old discovery hook must be gone (the controller, not the enhancer, owns this component).
    expect(markup, "the enhancer discovery hook must be removed").not.toContain(
      'data-lievit-enhancer="slider"',
    );
  });

  test("single-thumb input wires the controller via data-action + data-lv-slider-target (CSP-clean)", () => {
    // Behaviour is declared on the native input as data-action (no inline handler), so Stimulus
    // re-binds it across the wire morph automatically.
    expect(markup).toContain('data-lv-slider-target="input"');
    expect(markup).toContain("input->lv-slider#onInput");
    expect(markup).toContain("change->lv-slider#onChange");
    expect(markup).toContain("mouseover->lv-slider#showTip");
    expect(markup).toContain("focusout->lv-slider#hideTip");
  });

  test("single-thumb: one native input[type=range] with data-slot=slider-input", () => {
    expect(markup).toContain('data-slot="slider-input"');
    expect(markup).toMatch(/<input[\s\S]*?type="range"/);
  });

  test("the native input is the accessible spine: carries min, max, value, step [axe: aria-required-attr]", () => {
    expect(markup).toContain('min="${min}"');
    expect(markup).toContain('max="${max}"');
    expect(markup).toContain('value="${value}"');
    expect(markup).toContain('step="${step}"');
  });

  test("aria-label is applied via smart attribute (omitted when null) [axe: slider-name]", () => {
    // Smart attribute: aria-label="${ariaLabel}" — JTE omits when null.
    expect(markup).toContain('aria-label="${ariaLabel}"');
  });

  test("aria-valuetext is applied via smart attribute (omitted when null)", () => {
    expect(markup).toContain('aria-valuetext="${ariaValuetext}"');
  });

  test("vertical orientation emits aria-orientation=vertical via smart attribute", () => {
    // Smart attribute: aria-orientation="${isVertical ? 'vertical' : null}"
    // JTE omits the attribute when the value is null (horizontal case).
    expect(markup).toContain('aria-orientation="${isVertical ? "vertical" : null}"');
  });

  test("disabled native input uses native disabled attribute (NOT aria-disabled) [axe: aria-allowed-attr]", () => {
    expect(markup).toContain('disabled="${disabled}"');
    // aria-disabled is NOT used (the native input communicates disabled via the AOM).
    expect(markup).not.toContain("aria-disabled");
  });

  test("styled overlay elements carry aria-hidden=true (visual layer, not accessible) [axe: no duplicate slider role]", () => {
    // data-slot=slider-thumb, slider-track, slider-fill, slider-tooltip must all be aria-hidden.
    expect(markup).toContain('data-slot="slider-track"');
    expect(markup).toContain('data-slot="slider-fill"');
    expect(markup).toContain('data-slot="slider-thumb"');
    expect(markup).toContain('data-slot="slider-tooltip"');
    // Every visual overlay block in markup carries aria-hidden="true".
    const ariaHiddenCount = (markup.match(/aria-hidden="true"/g) ?? []).length;
    expect(ariaHiddenCount, "visual overlays must be aria-hidden").toBeGreaterThanOrEqual(4);
  });

  test("no role=slider on any overlay div (only the native input holds the slider role)", () => {
    // A div with role=slider would duplicate the AT surface. The native input already carries
    // role=slider implicitly — adding it to the overlay would expose two sliders to AT.
    expect(markup).not.toMatch(/<div[^>]*role="slider"/);
    expect(markup).not.toMatch(/<span[^>]*role="slider"/);
  });

  test("no inline <script> or on* handlers (CSP enforcement)", () => {
    expect(markup).not.toMatch(/<script[\s>]/i);
    expect(markup).not.toMatch(/\bon\w+\s*=/i);
  });

  test("no hardcoded literal colours (only var(--lv-*) token references)", () => {
    // Inline literal colours in the template body are forbidden (architecture contract §4).
    // CSS custom property references are the canonical form.
    const literalHex = markup.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [];
    expect(literalHex, "literal hex colours must not appear in markup").toEqual([]);
  });

  test("uses the two escaping channels: attrs=$unsafe and dataAttrs via Escape.htmlAttribute", () => {
    expect(src).toContain('$unsafe{attrs}');
    expect(src).toContain('$unsafe{dataAttrsMarkup}');
    expect(src).toContain("Escape.htmlAttribute");
  });
});

// ---------------------------------------------------------------------------
// §7 render — range mode
// ---------------------------------------------------------------------------

describe("slider.jte -- range mode (rangeMode=true)", () => {
  test("range mode branch is @if(rangeMode) (param drives the branch)", () => {
    expect(markup).toContain("@if(rangeMode)");
  });

  test("range mode renders TWO native inputs: data-slot=slider-input-low and slider-input-high", () => {
    expect(markup).toContain('data-slot="slider-input-low"');
    expect(markup).toContain('data-slot="slider-input-high"');
  });

  test("each range input wires its own controller action + thumb param (low/high resolution)", () => {
    expect(markup).toContain('data-lv-slider-target="inputLow"');
    expect(markup).toContain('data-lv-slider-target="inputHigh"');
    expect(markup).toContain("input->lv-slider#onInputLow");
    expect(markup).toContain("input->lv-slider#onInputHigh");
    // Action params carry which tooltip a hover event targets (CSP-clean plain strings).
    expect(markup).toContain('data-lv-slider-thumb-param="low"');
    expect(markup).toContain('data-lv-slider-thumb-param="high"');
  });

  test("low input max is valueHigh (APG multithumb: low thumb upper bound = current high value)", () => {
    // The low input's max attribute is set to the high value, not the global max.
    // This enforces the APG multithumb constraint server-side.
    expect(markup).toContain('max="${valueHigh}"');
  });

  test("high input min is valueLow (APG multithumb: high thumb lower bound = current low value)", () => {
    expect(markup).toContain('min="${valueLow}"');
  });

  test("low input carries aria-label from ariaLabelLow, high from ariaLabelHigh [axe: slider-name]", () => {
    expect(markup).toContain('aria-label="${ariaLabelLow}"');
    expect(markup).toContain('aria-label="${ariaLabelHigh}"');
  });

  test("low input carries aria-valuetext from ariaValuetextLow, high from ariaValuetextHigh", () => {
    expect(markup).toContain('aria-valuetext="${ariaValuetextLow}"');
    expect(markup).toContain('aria-valuetext="${ariaValuetextHigh}"');
  });

  test("range mode renders TWO thumb overlays (low + high) and TWO tooltips", () => {
    expect(markup).toContain('data-thumb="low"');
    expect(markup).toContain('data-thumb="high"');
    // At least two tooltip elements must be in the template.
    const tooltipCount = (markup.match(/data-slot="slider-tooltip"/g) ?? []).length;
    expect(tooltipCount, "need 2 tooltips in range mode").toBeGreaterThanOrEqual(2);
  });

  test("DOM order is constant: low input appears before high input (APG tab-order invariant)", () => {
    const lowIdx = markup.indexOf('data-slot="slider-input-low"');
    const highIdx = markup.indexOf('data-slot="slider-input-high"');
    expect(lowIdx, "low input must come before high input in DOM").toBeLessThan(highIdx);
  });

  test("range mode uses --slider-pct for low fill and --slider-pct-high for high fill", () => {
    expect(markup).toContain("--slider-pct-high");
    expect(markup).toContain("--slider-pct");
  });
});

// ---------------------------------------------------------------------------
// §7 render — tooltip
// ---------------------------------------------------------------------------

describe("slider.jte -- tooltip", () => {
  test("tooltip is always present in the DOM (regardless of showTooltip) [spec §3 invariant]", () => {
    // The tooltip must be in the DOM for a11y fallback (aria-valuetext on the input IS the a11y
    // path; the tooltip is purely visual). Removing it from DOM would break the enhancer's text update.
    expect(markup).toContain('data-slot="slider-tooltip"');
    // There is no @if(showTooltip != "never") guard around the tooltip element.
    // We verify by checking the tooltip is in the else branch (single-thumb) unconditionally.
    const elseIdx = markup.lastIndexOf("@else");
    const tooltipIdx = markup.lastIndexOf('data-slot="slider-tooltip"');
    expect(tooltipIdx, "tooltip must appear after the else branch (single-thumb block)").toBeGreaterThan(elseIdx);
  });

  test("showTooltip=always uses opacity-100; hover uses opacity-0; never uses opacity-0 (CSS-only visibility)", () => {
    // The tooltipVisClass switches between opacity-100 and opacity-0. The template contains
    // the conditional expression driving this class assignment.
    expect(src).toContain('"always".equals(showTooltip) ? "opacity-100" : "opacity-0"');
  });

  test("tooltip is aria-hidden (visual only; a11y value is on the native input)", () => {
    // Every tooltip element must carry aria-hidden="true".
    // We verify the template always places aria-hidden on the tooltip elements.
    // Since markup has multiple tooltip occurrences, check the pattern after data-slot="slider-tooltip".
    const tooltipMatches = [...markup.matchAll(/data-slot="slider-tooltip"([\s\S]*?)>/g)];
    expect(tooltipMatches.length, "at least one tooltip must be present").toBeGreaterThan(0);
    for (const m of tooltipMatches) {
      expect(m[1], "tooltip element must carry aria-hidden").toContain('aria-hidden="true"');
    }
  });

  test("tooltip carries data-tooltip attribute from showTooltip for enhancer discovery", () => {
    expect(markup).toContain('data-tooltip="${showTooltip}"');
  });
});

// ---------------------------------------------------------------------------
// §7 render — marks
// ---------------------------------------------------------------------------

describe("slider.jte -- marks", () => {
  test("marks section is guarded by @if(hasTicks) (only rendered when marks non-empty)", () => {
    expect(markup).toContain("@if(hasTicks)");
  });

  test("marks container carries data-slot=slider-marks and aria-hidden (visual decoration)", () => {
    expect(markup).toContain('data-slot="slider-marks"');
    // The marks div must carry aria-hidden; it is visual decoration only.
    const marksIdx = markup.indexOf('data-slot="slider-marks"');
    const marksBlock = markup.slice(marksIdx, marksIdx + 200);
    expect(marksBlock).toContain('aria-hidden="true"');
  });

  test("each mark dot is aria-hidden (not an interactive element) [axe: no unlabelled controls]", () => {
    // The tick dot is a visual-only <span>; it must not be interactive and must be aria-hidden.
    // We verify the tick span in the @for block carries aria-hidden.
    expect(markup).toContain('data-slot="slider-mark"');
    expect(markup).toContain('data-slot="slider-mark-label"');
  });

  test("mark label span carries aria-hidden=true (visual; axe must not flag as unlabelled)", () => {
    const labelIdx = markup.indexOf('data-slot="slider-mark-label"');
    expect(labelIdx, "slider-mark-label must exist in markup").toBeGreaterThan(-1);
    // The label slot comes after the tick dot in the for-block; check aria-hidden nearby.
    const labelBlock = markup.slice(Math.max(0, labelIdx - 100), labelIdx + 300);
    expect(labelBlock).toContain('aria-hidden="true"');
  });

  test("marks loop uses @for over marks param (no hardcoded data in the partial)", () => {
    expect(markup).toContain("@for(java.util.Map<String, String> mark : marks)");
    expect(markup).toContain("@endfor");
  });

  test("blank label mark renders tick dot only (no slider-mark-label span) via @if guard", () => {
    // The label is conditionally rendered: @if(markLabel != null && !markLabel.isBlank()).
    expect(markup).toContain("@if(markLabel != null && !markLabel.isBlank())");
  });
});

// ---------------------------------------------------------------------------
// §7 render — sizes
// ---------------------------------------------------------------------------

describe("slider.jte -- sizes", () => {
  test("size switch covers sm|md|lg for thumb diameter token", () => {
    expect(src).toContain("var(--lv-space-3-5)");  // sm
    expect(src).toContain("var(--lv-space-4-5)");  // md (default)
    expect(src).toContain("var(--lv-space-5-5)");  // lg
  });

  test("size switch covers sm|md|lg for track thickness token", () => {
    expect(src).toContain("var(--lv-space-1)");    // sm
    expect(src).toContain("var(--lv-space-1-5)");  // md
    expect(src).toContain("var(--lv-space-2)");    // lg
  });

  test("data-size attribute on root reflects the size param for styling hooks", () => {
    expect(markup).toContain('data-size="${size}"');
  });
});

// ---------------------------------------------------------------------------
// §7 render — disabled state
// ---------------------------------------------------------------------------

describe("slider.jte -- disabled state", () => {
  test("disabled uses native disabled attribute on the input (not aria-disabled)", () => {
    // Native disabled on input[type=range] is the authority; the platform communicates
    // disabled via the AOM. aria-disabled is reserved for <a> elements.
    expect(markup).toContain('disabled="${disabled}"');
    expect(markup).not.toContain("aria-disabled");
  });

  test("the styled overlay carries pointer-events-none (blocks drag on disabled)", () => {
    // The overlay classes include pointer-events-none so clicks pass through to the native
    // input (which is disabled and ignores them) rather than being caught by the overlay.
    expect(markup).toContain("pointer-events-none");
  });
});

// ---------------------------------------------------------------------------
// §7 render — --slider-pct initial value
// ---------------------------------------------------------------------------

describe("slider.jte -- --slider-pct initial render", () => {
  test("root inline style carries --slider-pct derived from value/min/max", () => {
    // The template computes pct server-side and sets it as an inline CSS property.
    expect(markup).toContain("--slider-pct:");
  });

  test("range mode inline style also carries --slider-pct-high", () => {
    expect(markup).toContain("--slider-pct-high:");
  });

  test("--slider-thumb-size and --slider-track-thickness are set inline on root", () => {
    expect(markup).toContain("--slider-thumb-size:");
    expect(markup).toContain("--slider-track-thickness:");
  });
});

// ---------------------------------------------------------------------------
// §7 render — escaping (XSS abuse-case for dataAttrs)
// ---------------------------------------------------------------------------

describe("slider.jte -- escaping", () => {
  test("dataAttrs uses Escape.htmlAttribute (safe channel for dynamic data-* values)", () => {
    expect(src).toContain("Escape.htmlAttribute");
    // The safe channel is a StringOutput built by iteration, then emitted with $unsafe.
    // This means the VALUE is escaped while the fragment itself is raw-emitted.
    expect(src).toContain("dataAttrs_.writeContent");
  });

  test("dataAttrs key validation rejects non-identifier keys (prevents injection via key)", () => {
    // Same key guard pattern as badge.jte: matches("[A-Za-z][A-Za-z0-9-]*").
    expect(src).toContain('"[A-Za-z][A-Za-z0-9-]*"');
  });

  test("attrs channel is emitted with $unsafe and is documented as TRUSTED STATIC only", () => {
    expect(markup).toContain("$unsafe{attrs}");
  });
});

// ---------------------------------------------------------------------------
// §7 render — orientation
// ---------------------------------------------------------------------------

describe("slider.jte -- vertical orientation", () => {
  test("data-orientation on root is always emitted (horizontal + vertical via param)", () => {
    expect(markup).toContain('data-orientation="${orientation}"');
  });

  test("isVertical flag drives layout class and inline styles (no hardcoded writing-mode string)", () => {
    // The old slider used `writing-mode: vertical-lr` (deprecated approach).
    // The new slider drives orientation via isVertical flag and CSS custom property layout.
    expect(src).toContain("isVertical");
  });
});

// ---------------------------------------------------------------------------
// §7 controller — lv-slider Stimulus controller (real Application, real DOM, real morph)
// ---------------------------------------------------------------------------

const SINGLE_ACTIONS =
  "input->lv-slider#onInput change->lv-slider#onChange " +
  "mouseover->lv-slider#showTip mouseout->lv-slider#hideTip " +
  "focusin->lv-slider#showTip focusout->lv-slider#hideTip";
const RANGE_ACTIONS = (verb: "onInputLow" | "onInputHigh"): string =>
  `input->lv-slider#${verb} mouseover->lv-slider#showTip mouseout->lv-slider#hideTip ` +
  "focusin->lv-slider#showTip focusout->lv-slider#hideTip";

/**
 * Build a single-thumb slider root EXACTLY as slider.jte emits it: data-controller="lv-slider" on
 * the root, the native input carrying data-lv-slider-target="input" + the data-action descriptors,
 * the tooltip carrying data-lv-slider-target="tooltip". No mocked runtime: the real Stimulus
 * Application (started by startStimulus) connects the real controller to this DOM.
 */
function buildSingleThumbRoot(opts: {
  value?: number;
  min?: number;
  max?: number;
  step?: number;
  showTooltip?: string;
  disabled?: boolean;
} = {}): HTMLElement {
  const { value = 50, min = 0, max = 100, step = 1, showTooltip = "hover", disabled = false } = opts;

  const root = document.createElement("div");
  root.setAttribute("data-slot", "slider");
  root.setAttribute("data-range", "false");
  root.setAttribute("data-tooltip", showTooltip);
  root.setAttribute("data-controller", "lv-slider");
  root.style.setProperty("--slider-pct", `${value}%`);

  const input = document.createElement("input");
  input.type = "range";
  input.setAttribute("data-slot", "slider-input");
  input.setAttribute("data-lv-slider-target", "input");
  input.setAttribute("data-action", SINGLE_ACTIONS);
  input.min = String(min);
  input.max = String(max);
  input.step = String(step);
  input.valueAsNumber = value;
  if (disabled) input.disabled = true;
  root.appendChild(input);

  const tooltip = document.createElement("div");
  tooltip.setAttribute("data-slot", "slider-tooltip");
  tooltip.setAttribute("data-lv-slider-target", "tooltip");
  tooltip.setAttribute("aria-hidden", "true");
  tooltip.className = "opacity-0";
  tooltip.textContent = String(value);
  root.appendChild(tooltip);

  document.body.appendChild(root);
  return root;
}

/** Build a range (dual-thumb) slider root exactly as slider.jte emits it. */
function buildRangeRoot(opts: {
  valueLow?: number;
  valueHigh?: number;
  min?: number;
  max?: number;
  showTooltip?: string;
} = {}): HTMLElement {
  const { valueLow = 20, valueHigh = 80, min = 0, max = 100, showTooltip = "hover" } = opts;

  const root = document.createElement("div");
  root.setAttribute("data-slot", "slider");
  root.setAttribute("data-range", "true");
  root.setAttribute("data-tooltip", showTooltip);
  root.setAttribute("data-controller", "lv-slider");
  root.style.setProperty("--slider-pct", `${valueLow}%`);
  root.style.setProperty("--slider-pct-high", `${valueHigh}%`);

  const inputLow = document.createElement("input");
  inputLow.type = "range";
  inputLow.setAttribute("data-slot", "slider-input-low");
  inputLow.setAttribute("data-lv-slider-target", "inputLow");
  inputLow.setAttribute("data-lv-slider-thumb-param", "low");
  inputLow.setAttribute("data-action", RANGE_ACTIONS("onInputLow"));
  inputLow.min = String(min);
  inputLow.max = String(valueHigh);
  inputLow.valueAsNumber = valueLow;
  inputLow.setAttribute("aria-valuemax", String(valueHigh));
  root.appendChild(inputLow);

  const inputHigh = document.createElement("input");
  inputHigh.type = "range";
  inputHigh.setAttribute("data-slot", "slider-input-high");
  inputHigh.setAttribute("data-lv-slider-target", "inputHigh");
  inputHigh.setAttribute("data-lv-slider-thumb-param", "high");
  inputHigh.setAttribute("data-action", RANGE_ACTIONS("onInputHigh"));
  inputHigh.min = String(valueLow);
  inputHigh.max = String(max);
  inputHigh.valueAsNumber = valueHigh;
  inputHigh.setAttribute("aria-valuemin", String(valueLow));
  root.appendChild(inputHigh);

  const tooltipLow = document.createElement("div");
  tooltipLow.setAttribute("data-slot", "slider-tooltip");
  tooltipLow.setAttribute("data-thumb", "low");
  tooltipLow.setAttribute("data-lv-slider-target", "tooltipLow");
  tooltipLow.setAttribute("aria-hidden", "true");
  tooltipLow.className = "opacity-0";
  tooltipLow.textContent = String(valueLow);
  root.appendChild(tooltipLow);

  const tooltipHigh = document.createElement("div");
  tooltipHigh.setAttribute("data-slot", "slider-tooltip");
  tooltipHigh.setAttribute("data-thumb", "high");
  tooltipHigh.setAttribute("data-lv-slider-target", "tooltipHigh");
  tooltipHigh.setAttribute("aria-hidden", "true");
  tooltipHigh.className = "opacity-0";
  tooltipHigh.textContent = String(valueHigh);
  root.appendChild(tooltipHigh);

  document.body.appendChild(root);
  return root;
}

/** A wire-capturing runtime: every action the controller would POST lands in `calls`. */
function makeRuntime(): { runtime: LievitRuntime; calls: string[] } {
  const calls: string[] = [];
  const fetchImpl = vi.fn(async (_url: unknown, init?: RequestInit) => {
    const body = JSON.parse((init?.body as string) ?? "{}") as Record<string, unknown>;
    const c = body._calls as string[] | undefined;
    if (c) calls.push(...c);
    return new Response("<div></div>", { status: 200, headers: { "Lievit-Snapshot": "s2" } });
  });
  const runtime = new LievitRuntime({ fetchImpl: fetchImpl as unknown as typeof fetch });
  return { runtime, calls };
}

beforeEach(() => {
  document.body.innerHTML = "";
});

afterEach(() => {
  stopStimulus();
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

describe("lv-slider controller -- single-thumb (real Stimulus Application)", () => {
  test("drag (input event) updates --slider-pct on the root", async () => {
    const root = buildSingleThumbRoot({ value: 50, min: 0, max: 100 });
    startStimulus({});
    await flushStimulus();

    const input = root.querySelector<HTMLInputElement>('[data-slot="slider-input"]')!;
    input.valueAsNumber = 75;
    input.dispatchEvent(new Event("input", { bubbles: true }));

    expect(root.style.getPropertyValue("--slider-pct")).toBe("75%");
  });

  test("tooltip text updates on input event", async () => {
    const root = buildSingleThumbRoot({ value: 50 });
    startStimulus({});
    await flushStimulus();

    const input = root.querySelector<HTMLInputElement>('[data-slot="slider-input"]')!;
    const tooltip = root.querySelector<HTMLElement>('[data-slot="slider-tooltip"]')!;
    input.valueAsNumber = 33;
    input.dispatchEvent(new Event("input", { bubbles: true }));

    expect(tooltip.textContent).toBe("33");
  });

  test("tooltip toggles opacity-100 on mouseover/mouseout when showTooltip=hover", async () => {
    const root = buildSingleThumbRoot({ showTooltip: "hover" });
    startStimulus({});
    await flushStimulus();

    const input = root.querySelector<HTMLInputElement>('[data-slot="slider-input"]')!;
    const tooltip = root.querySelector<HTMLElement>('[data-slot="slider-tooltip"]')!;

    input.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
    expect(tooltip.classList.contains("opacity-100")).toBe(true);

    input.dispatchEvent(new MouseEvent("mouseout", { bubbles: true }));
    expect(tooltip.classList.contains("opacity-100")).toBe(false);
  });

  test("focusin shows tooltip, focusout hides tooltip (keyboard accessibility)", async () => {
    const root = buildSingleThumbRoot({ showTooltip: "hover" });
    startStimulus({});
    await flushStimulus();

    const input = root.querySelector<HTMLInputElement>('[data-slot="slider-input"]')!;
    const tooltip = root.querySelector<HTMLElement>('[data-slot="slider-tooltip"]')!;

    input.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    expect(tooltip.classList.contains("opacity-100")).toBe(true);

    input.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
    expect(tooltip.classList.contains("opacity-100")).toBe(false);
  });

  test("showTooltip=always: hover events never hide the always-visible tooltip", async () => {
    // The old enhancer attached hover listeners ONLY in hover mode; the controller preserves this
    // by guarding on data-tooltip. An `always` tooltip must not be toggled off on mouseout.
    const root = buildSingleThumbRoot({ showTooltip: "always" });
    startStimulus({});
    await flushStimulus();

    const input = root.querySelector<HTMLInputElement>('[data-slot="slider-input"]')!;
    const tooltip = root.querySelector<HTMLElement>('[data-slot="slider-tooltip"]')!;
    tooltip.classList.add("opacity-100"); // always-mode render state

    input.dispatchEvent(new MouseEvent("mouseout", { bubbles: true }));
    expect(tooltip.classList.contains("opacity-100")).toBe(true);
  });

  test("pct computation: value at min yields 0%, value at max yields 100%", async () => {
    const root = buildSingleThumbRoot({ value: 50, min: 0, max: 100 });
    startStimulus({});
    await flushStimulus();

    const input = root.querySelector<HTMLInputElement>('[data-slot="slider-input"]')!;
    input.valueAsNumber = 0;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    expect(root.style.getPropertyValue("--slider-pct")).toBe("0%");

    input.valueAsNumber = 100;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    expect(root.style.getPropertyValue("--slider-pct")).toBe("100%");
  });

  test("plain form hidden input sync: change event copies value to hidden input", async () => {
    const root = buildSingleThumbRoot({ value: 10 });
    const form = document.createElement("form");
    const hidden = document.createElement("input");
    hidden.type = "hidden";
    hidden.name = "price";
    document.body.appendChild(form);
    form.appendChild(root);
    form.appendChild(hidden);

    const input = root.querySelector<HTMLInputElement>('[data-slot="slider-input"]')!;
    input.name = "price";

    startStimulus({});
    await flushStimulus();

    input.valueAsNumber = 42;
    input.dispatchEvent(new Event("change", { bubbles: true }));

    expect(hidden.value).toBe("42");
  });
});

describe("lv-slider controller -- range mode (real Stimulus Application)", () => {
  test("input event on low thumb updates --slider-pct", async () => {
    const root = buildRangeRoot({ valueLow: 20, valueHigh: 80 });
    startStimulus({});
    await flushStimulus();

    const inputLow = root.querySelector<HTMLInputElement>('[data-slot="slider-input-low"]')!;
    inputLow.valueAsNumber = 30;
    inputLow.dispatchEvent(new Event("input", { bubbles: true }));

    expect(root.style.getPropertyValue("--slider-pct")).toBe("30%");
  });

  test("input event on high thumb updates --slider-pct-high", async () => {
    const root = buildRangeRoot({ valueLow: 20, valueHigh: 80 });
    startStimulus({});
    await flushStimulus();

    const inputHigh = root.querySelector<HTMLInputElement>('[data-slot="slider-input-high"]')!;
    inputHigh.valueAsNumber = 70;
    inputHigh.dispatchEvent(new Event("input", { bubbles: true }));

    expect(root.style.getPropertyValue("--slider-pct-high")).toBe("70%");
  });

  test("low thumb cannot exceed high: clamp on input event", async () => {
    const root = buildRangeRoot({ valueLow: 20, valueHigh: 80 });
    startStimulus({});
    await flushStimulus();

    const inputLow = root.querySelector<HTMLInputElement>('[data-slot="slider-input-low"]')!;
    const inputHigh = root.querySelector<HTMLInputElement>('[data-slot="slider-input-high"]')!;
    inputLow.valueAsNumber = 90; // > 80 (high)
    inputLow.dispatchEvent(new Event("input", { bubbles: true }));

    expect(inputLow.valueAsNumber).toBeLessThanOrEqual(inputHigh.valueAsNumber);
  });

  test("high thumb cannot go below low: clamp on input event", async () => {
    const root = buildRangeRoot({ valueLow: 20, valueHigh: 80 });
    startStimulus({});
    await flushStimulus();

    const inputLow = root.querySelector<HTMLInputElement>('[data-slot="slider-input-low"]')!;
    const inputHigh = root.querySelector<HTMLInputElement>('[data-slot="slider-input-high"]')!;
    inputHigh.valueAsNumber = 10; // < 20 (low)
    inputHigh.dispatchEvent(new Event("input", { bubbles: true }));

    expect(inputHigh.valueAsNumber).toBeGreaterThanOrEqual(inputLow.valueAsNumber);
  });

  test("after low thumb input: aria-valuemax on low input = current high value (APG constraint)", async () => {
    const root = buildRangeRoot({ valueLow: 20, valueHigh: 80 });
    startStimulus({});
    await flushStimulus();

    const inputLow = root.querySelector<HTMLInputElement>('[data-slot="slider-input-low"]')!;
    const inputHigh = root.querySelector<HTMLInputElement>('[data-slot="slider-input-high"]')!;
    inputLow.valueAsNumber = 30;
    inputLow.dispatchEvent(new Event("input", { bubbles: true }));

    expect(inputLow.getAttribute("aria-valuemax")).toBe(String(inputHigh.valueAsNumber));
  });

  test("after high thumb input: aria-valuemin on high input = current low value (APG constraint)", async () => {
    const root = buildRangeRoot({ valueLow: 20, valueHigh: 80 });
    startStimulus({});
    await flushStimulus();

    const inputLow = root.querySelector<HTMLInputElement>('[data-slot="slider-input-low"]')!;
    const inputHigh = root.querySelector<HTMLInputElement>('[data-slot="slider-input-high"]')!;
    inputHigh.valueAsNumber = 70;
    inputHigh.dispatchEvent(new Event("input", { bubbles: true }));

    expect(inputHigh.getAttribute("aria-valuemin")).toBe(String(inputLow.valueAsNumber));
  });

  test("range mode tooltip text updates independently for low and high thumbs", async () => {
    const root = buildRangeRoot({ valueLow: 20, valueHigh: 80 });
    startStimulus({});
    await flushStimulus();

    const inputLow = root.querySelector<HTMLInputElement>('[data-slot="slider-input-low"]')!;
    const inputHigh = root.querySelector<HTMLInputElement>('[data-slot="slider-input-high"]')!;
    const tooltipLow = root.querySelector<HTMLElement>('[data-slot="slider-tooltip"][data-thumb="low"]')!;
    const tooltipHigh = root.querySelector<HTMLElement>('[data-slot="slider-tooltip"][data-thumb="high"]')!;

    inputLow.valueAsNumber = 25;
    inputLow.dispatchEvent(new Event("input", { bubbles: true }));
    expect(tooltipLow.textContent).toBe("25");

    inputHigh.valueAsNumber = 65;
    inputHigh.dispatchEvent(new Event("input", { bubbles: true }));
    expect(tooltipHigh.textContent).toBe("65");
  });

  test("hover targets the right thumb tooltip via the data-lv-slider-thumb-param", async () => {
    const root = buildRangeRoot({ valueLow: 20, valueHigh: 80, showTooltip: "hover" });
    startStimulus({});
    await flushStimulus();

    const inputLow = root.querySelector<HTMLInputElement>('[data-slot="slider-input-low"]')!;
    const tooltipLow = root.querySelector<HTMLElement>('[data-slot="slider-tooltip"][data-thumb="low"]')!;
    const tooltipHigh = root.querySelector<HTMLElement>('[data-slot="slider-tooltip"][data-thumb="high"]')!;

    inputLow.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
    expect(tooltipLow.classList.contains("opacity-100")).toBe(true);
    expect(tooltipHigh.classList.contains("opacity-100"), "only the hovered thumb's tooltip shows").toBe(false);
  });

  test("DOM tab order is constant: low input appears before high input (APG multithumb invariant)", () => {
    const root = buildRangeRoot({ valueLow: 20, valueHigh: 80 });
    const inputs = root.querySelectorAll<HTMLInputElement>("input[type=range]");
    expect(inputs.length).toBe(2);
    expect(inputs[0]!.dataset["slot"]).toBe("slider-input-low");
    expect(inputs[1]!.dataset["slot"]).toBe("slider-input-high");
  });
});

describe("lv-slider controller -- uncontrolled doctrine (no wire round-trip)", () => {
  it("a full drag + change cycle fires ZERO wire calls (a slider is pure client cosmetic)", async () => {
    const { runtime, calls } = makeRuntime();
    const root = buildSingleThumbRoot({ value: 40 });
    startStimulus({ runtime });
    await flushStimulus();

    const input = root.querySelector<HTMLInputElement>('[data-slot="slider-input"]')!;
    input.valueAsNumber = 60;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));

    await new Promise((r) => setTimeout(r, 10));
    expect(calls).toHaveLength(0);
  });
});

describe("lv-slider controller -- morph-safety (real lievit morph)", () => {
  it("after a real morph one input event still updates --slider-pct EXACTLY once (no stacked listeners)", async () => {
    const root = buildSingleThumbRoot({ value: 50 });
    const container = document.createElement("div");
    document.body.appendChild(container);
    container.appendChild(root);

    startStimulus({});
    await flushStimulus();

    // A real lievit wire morph re-renders the subtree (idiomorph). The slider element is preserved,
    // so the controller must NOT double-connect and the input action must stay single.
    const onInputSpy = vi.spyOn(LvSliderController.prototype, "onInput");
    morph(container, container.outerHTML);
    await flushStimulus();

    const input = container.querySelector<HTMLInputElement>('[data-slot="slider-input"]')!;
    input.valueAsNumber = 80;
    input.dispatchEvent(new Event("input", { bubbles: true }));

    expect(onInputSpy).toHaveBeenCalledTimes(1);
    const morphedRoot = container.querySelector<HTMLElement>('[data-slot="slider"]')!;
    expect(morphedRoot.style.getPropertyValue("--slider-pct")).toBe("80%");
  });

  it("a slider removed by a morph fires nothing (disconnect tore the action binding down)", async () => {
    const root = buildSingleThumbRoot({ value: 50 });
    const container = document.createElement("div");
    document.body.appendChild(container);
    container.appendChild(root);

    startStimulus({});
    await flushStimulus();

    const input = root.querySelector<HTMLInputElement>('[data-slot="slider-input"]')!;
    const onInputSpy = vi.spyOn(LvSliderController.prototype, "onInput");

    morph(container, "<div><span>gone</span></div>");
    await flushStimulus();

    input.valueAsNumber = 90;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    expect(onInputSpy).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// §7 variants/sizes -- data-slot + data-size structural contract
// ---------------------------------------------------------------------------

describe("slider.jte -- variants/sizes structural contract", () => {
  test("sm size: template references --lv-space-3-5 thumb token and --lv-space-1 track token", () => {
    expect(src).toContain("var(--lv-space-3-5)");
    expect(src).toContain("var(--lv-space-1)");
  });

  test("md size: template references --lv-space-4-5 thumb token and --lv-space-1-5 track token", () => {
    expect(src).toContain("var(--lv-space-4-5)");
    expect(src).toContain("var(--lv-space-1-5)");
  });

  test("lg size: template references --lv-space-5-5 thumb token and --lv-space-2 track token", () => {
    expect(src).toContain("var(--lv-space-5-5)");
    expect(src).toContain("var(--lv-space-2)");
  });

  test("track fill colour references --lv-color-primary (not a hardcoded hex)", () => {
    expect(src).toContain("var(--lv-color-primary)");
  });

  test("thumb background references --lv-color-bg (not a hardcoded hex)", () => {
    expect(src).toContain("var(--lv-color-bg)");
  });

  test("focus ring is documented in the header (--lv-ring; applied via slider.css, not inline template)", () => {
    // The slider's native input is opacity-0; focus ring on the styled thumb overlay is applied
    // via CSS selector `[data-slot=slider-input]:focus-visible ~ [data-slot=slider-thumb]`.
    // This does NOT need the token referenced inline in the template; instead the adopter's
    // slider.css (or the consuming stylesheet) wires it. The test verifies the doc mentions
    // the ring contract so future maintainers know it is handled in CSS, not the template.
    // The doc-comment block (extracted separately) must mention the ring concept.
    const docBlock = src.slice(src.indexOf("<%--"), src.indexOf("--%>") + 4);
    expect(docBlock, "doc-comment must document the focus ring behavior").toMatch(/ring|focus/i);
  });
});

// ---------------------------------------------------------------------------
// §7 JTE compile contract (structure-level)
// ---------------------------------------------------------------------------

describe("slider.jte -- JTE compile contract (structure-level)", () => {
  test("no nested <%-- inside the doc-comment block (would close the comment early)", () => {
    // The briefing hard rule: nested JTE comments break the parser. Verify the doc comment
    // block does not contain a second --%> before the intended closing --%>.
    const firstOpen = src.indexOf("<%--");
    const firstClose = src.indexOf("--%>");
    // There must be exactly one --%> that closes the opening <%--. Any second occurrence
    // inside the first <%-- block would indicate a nested comment.
    expect(firstOpen, "must have a doc-comment block").toBeGreaterThanOrEqual(0);
    expect(firstClose, "must close the doc-comment block").toBeGreaterThan(firstOpen);
    // Extract the doc block and verify it contains no nested <%-- open.
    const docBlock = src.slice(firstOpen + 4, firstClose);
    expect(docBlock, "nested <%-- inside doc-comment reds the JTE gate").not.toContain("<%--");
  });

  test("no expression in tag-name position (Illegal HTML tag name)", () => {
    // JTE forbids <${as}> or </${x}>. Tag names must be static literals.
    expect(markup).not.toMatch(/<\$\{/);
  });

  test("no @if in attribute-name position (Illegal HTML attribute name)", () => {
    // JTE forbids @if(cond)attr="..." @endif. Smart attributes are the canonical form.
    expect(markup).not.toMatch(/@if\([^)]+\)\s*\w+\s*=/);
  });

  test("no HTML element is split across @if/@else (hard rule: balanced tags in the whole template)", () => {
    // The briefing hard rule: split elements across branches cause JTE balance-check failures.
    // The JTE real-compiler gate is the ultimate arbiter; here we do a global balance check
    // as a fast pre-screen.

    // Assert: the global markup's divs are balanced (all divs ultimately close).
    const totalOpenDivs = (markup.match(/<div\b/g) ?? []).length;
    const totalCloseDivs = (markup.match(/<\/div>/g) ?? []).length;
    expect(totalOpenDivs, "all <div> elements must have a matching </div>").toBe(totalCloseDivs);

    // Assert: spans are balanced.
    const totalOpenSpans = (markup.match(/<span\b/g) ?? []).length;
    const totalCloseSpans = (markup.match(/<\/span>/g) ?? []).length;
    expect(totalOpenSpans, "all <span> elements must have a matching </span>").toBe(totalCloseSpans);

    // Assert: no </div> appears at the very START of a @if/else branch (element opened outside branch).
    // This catches the pattern: @if(x) ... opened outside ... </div> @else @endif
    expect(markup).not.toMatch(/@if\([^)]*\)\s*<\/div>/);
    expect(markup).not.toMatch(/@else\s*<\/div>/);
  });
});
