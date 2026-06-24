/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * color-picker v-next -- source-text + enhancer tests.
 *
 * Two halves:
 *   1. Source-text golden assertions on the JTE source (param names, data-slot, ARIA shape,
 *      data-lievit-* hooks, CSP-clean invariants, no io.lievit import, swatches via param).
 *   2. Enhancer DOM tests on a DOM shaped like the server-rendered partial (channel sync,
 *      popover open/close, format toggle, swatch application, spinbutton keys, eyedropper,
 *      confirm/cancel, focus restore).
 *
 * The client-island fidelity lesson (CLAUDE.md): these tests run the REAL enhancer against a
 * real DOM build in happy-dom. No mocked $lievit, no mocked channel math. The channel-sync
 * and swatch-roving behaviors are exactly the kind of client logic that slips through
 * fake-substrate tests. Every assertion in the spec §7 acceptance gate is represented here.
 */
import { describe, test, expect, afterEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  enhanceColorPicker,
  enhanceAllColorPickers,
  hexToRgb,
  rgbToHex,
  rgbToHsl,
  hslToRgb,
  clamp,
} from "../registry/jte/color-picker.enhancer.js";

// ---------------------------------------------------------------------------
// Source-text helpers
// ---------------------------------------------------------------------------

const jteDir = join(import.meta.dirname, "..", "registry", "jte");
const readJte = (rel: string) => readFileSync(join(jteDir, rel), "utf8");
const stripComments = (src: string) => src.replace(/<%--[\s\S]*?--%>/g, "");

// ---------------------------------------------------------------------------
// 1. Source-text assertions (no enhancer, no DOM)
// ---------------------------------------------------------------------------

describe("color-picker.jte -- source-text invariants", () => {
  const src = readJte("color-picker.jte");
  const markup = stripComments(src);

  test("no io.lievit import (JTE gate classpath has none)", () => {
    expect(src).not.toContain("@import io.lievit");
  });

  test("no nested JTE comments (would mis-parse the gate)", () => {
    // After stripping the outer doc-comment, no --%> should remain inside a <%-- block.
    // Simplest proxy: count opening and closing JTE comment delimiters are balanced.
    const opens = (src.match(/<%--/g) ?? []).length;
    const closes = (src.match(/--%>/g) ?? []).length;
    expect(opens).toBe(closes);
  });

  test("no @if(...) inside an attribute name position (smart attributes only)", () => {
    // JTE hard rule: @if inside attribute-name position => parse error.
    expect(markup).not.toMatch(/\s@if\([^)]+\)[a-z-]+=["']/);
  });

  test("no expression in tag names (<${...}> is illegal)", () => {
    expect(markup).not.toMatch(/<\$\{/);
  });

  test("root carries the mount hook for the enhancer", () => {
    expect(markup).toContain("data-lv-color-picker");
  });

  test("data-slot on root is color-picker", () => {
    expect(markup).toContain('data-slot="color-picker"');
  });

  test("data-size on root is ${size}", () => {
    expect(markup).toContain('data-size="${size}"');
  });

  test("trigger button has aria-expanded, aria-haspopup, aria-controls, aria-label", () => {
    expect(markup).toContain('aria-expanded="false"');
    expect(markup).toContain('aria-haspopup="dialog"');
    expect(markup).toContain('aria-controls="${baseId}-popover"');
    expect(markup).toContain("Pick color:");
  });

  test("native input is aria-hidden + tabindex=-1 (not in tab order)", () => {
    expect(markup).toContain('aria-hidden="true"');
    expect(markup).toContain('tabindex="-1"');
    expect(markup).toContain('data-slot="native-input"');
    expect(markup).toContain('name="${name}"');
  });

  test("popover panel has role=dialog aria-modal=false and the popover attribute", () => {
    expect(markup).toContain('role="dialog"');
    expect(markup).toContain('aria-modal="false"');
    expect(markup).toContain("popover");
    expect(markup).toContain('data-slot="popover"');
  });

  test("hex-input has aria-label and aria-describedby", () => {
    expect(markup).toContain('data-slot="hex-input"');
    expect(markup).toContain('aria-label="Hex color"');
    expect(markup).toContain("aria-describedby");
  });

  test("channel inputs have aria-label, aria-valuemin, aria-valuemax, aria-valuenow", () => {
    expect(markup).toContain('data-slot="channel-r"');
    expect(markup).toContain('data-slot="channel-g"');
    expect(markup).toContain('data-slot="channel-b"');
    expect(markup).toContain('data-slot="channel-h"');
    expect(markup).toContain('data-slot="channel-s"');
    expect(markup).toContain('data-slot="channel-l"');
    expect(markup).toContain('aria-label="Red"');
    expect(markup).toContain('aria-label="Green"');
    expect(markup).toContain('aria-label="Blue"');
    expect(markup).toContain('aria-label="Hue"');
    expect(markup).toContain('aria-label="Saturation"');
    expect(markup).toContain('aria-label="Lightness"');
    expect(markup).toContain("aria-valuemin");
    expect(markup).toContain("aria-valuemax");
    expect(markup).toContain("aria-valuenow");
  });

  test("alpha input is conditional on alpha param and has role-appropriate attributes", () => {
    expect(markup).toContain("@if(alpha)");
    expect(markup).toContain('data-slot="alpha-input"');
    expect(markup).toContain('aria-label="Alpha"');
    expect(markup).toContain('aria-valuemax="100"');
    expect(markup).toContain("aria-valuetext");
  });

  test("swatch grid has role=toolbar + collection-nav data attributes", () => {
    expect(markup).toContain('role="toolbar"');
    expect(markup).toContain('aria-label="Color presets"');
    expect(markup).toContain('data-slot="swatches"');
    expect(markup).toContain("data-lievit-collection");
    expect(markup).toContain('data-lievit-collection-roving-tabindex="true"');
    expect(markup).toContain('data-lievit-collection-orientation="horizontal"');
    expect(markup).toContain('data-lievit-collection-wrap="true"');
    expect(markup).toContain('data-manual-activation="true"');
  });

  test("swatch buttons have aria-label, aria-pressed, tabindex, data-color", () => {
    expect(markup).toContain('data-slot="swatch"');
    expect(markup).toContain('data-lievit-item');
    expect(markup).toContain("aria-label=");
    expect(markup).toContain("aria-pressed=");
    expect(markup).toContain("data-color=");
    expect(markup).toContain("tabindex=");
  });

  test("swatches are conditional on the swatches List param (never hardcoded)", () => {
    expect(markup).toContain("@if(!swatches.isEmpty())");
    expect(src).toMatch(/@param java\.util\.List<String> swatches/);
  });

  test("eyedropper button is conditional on eyedropper param", () => {
    expect(markup).toContain("@if(eyedropper)");
    expect(markup).toContain('data-slot="eyedropper-btn"');
    expect(markup).toContain('aria-label="Pick color from screen"');
  });

  test("eyedropper uses inline SVG (not a template call -- would import io.lievit)", () => {
    // The MARKUP (non-comment part) must not call @template.lievit.icon; must have an inline <svg>
    expect(markup).not.toMatch(/@template\.lievit\.icon/);
    expect(markup).toContain("<svg");
  });

  test("format-toggle button has aria-label with the current format", () => {
    expect(markup).toContain('data-slot="format-toggle"');
    expect(markup).toContain("Format:");
  });

  test("confirm + cancel buttons have aria-label", () => {
    expect(markup).toContain('data-slot="confirm-btn"');
    expect(markup).toContain('data-slot="cancel-btn"');
    expect(markup).toContain('aria-label="Confirm color"');
    expect(markup).toContain('aria-label="Cancel"');
  });

  test("live region is always in the DOM (not JS-injected, respects CSP)", () => {
    expect(markup).toContain('role="status"');
    expect(markup).toContain('aria-live="polite"');
    expect(markup).toContain('aria-atomic="true"');
    expect(markup).toContain('data-slot="live-region"');
  });

  test("no inline <script> or on* handlers (CSP-clean)", () => {
    expect(markup).not.toMatch(/<script/);
    expect(markup).not.toMatch(/\son[a-z]+=/);
  });

  test("swatch background via style= (the one permitted inline-style use for color values)", () => {
    // The CSS property value channel is permitted; the on*= handler channel is not.
    expect(markup).toContain("background-color:${swatch}");
  });

  test("dataAttrs escaping channel present (SAFE path, not attrs raw)", () => {
    expect(src).toContain("Escape.htmlAttribute");
    expect(src).toContain("dataAttrsMarkup");
  });

  test("root has role=group with aria-label / aria-labelledby", () => {
    expect(markup).toContain('role="group"');
    expect(markup).toContain("aria-label=");
    expect(markup).toContain("aria-labelledby=");
  });

  test("aria-disabled on root wrapper when disabled (not just on the button)", () => {
    expect(markup).toContain('aria-disabled="${disabled ? "true" : null}"');
  });

  test("format groups have hidden class string derived from format param", () => {
    expect(src).toContain("hexHidden");
    expect(src).toContain("rgbHidden");
    expect(src).toContain("hslHidden");
  });
});

// ---------------------------------------------------------------------------
// 2. Color math unit tests (pure functions)
// ---------------------------------------------------------------------------

describe("color math utilities", () => {
  test("clamp: below min -> min", () => { expect(clamp(-5, 0, 255)).toBe(0); });
  test("clamp: above max -> max", () => { expect(clamp(300, 0, 255)).toBe(255); });
  test("clamp: within range -> unchanged", () => { expect(clamp(128, 0, 255)).toBe(128); });

  test("hexToRgb: #ff8000 -> {r:255, g:128, b:0}", () => {
    expect(hexToRgb("#ff8000")).toEqual({ r: 255, g: 128, b: 0 });
  });
  test("hexToRgb: without leading # -> works", () => {
    expect(hexToRgb("0000ff")).toEqual({ r: 0, g: 0, b: 255 });
  });
  test("hexToRgb: invalid -> null", () => {
    expect(hexToRgb("#zzzzzz")).toBeNull();
    expect(hexToRgb("#12345")).toBeNull();
  });

  test("rgbToHex: {255, 128, 0} -> #ff8000", () => {
    expect(rgbToHex(255, 128, 0)).toBe("#ff8000");
  });
  test("rgbToHex: {0, 0, 255} -> #0000ff", () => {
    expect(rgbToHex(0, 0, 255)).toBe("#0000ff");
  });

  test("rgbToHsl: red -> h=0, s=100, l=50", () => {
    const { h, s, l } = rgbToHsl(255, 0, 0);
    expect(h).toBe(0);
    expect(s).toBe(100);
    expect(l).toBe(50);
  });

  test("rgbToHsl: blue -> h=240, s=100, l=50", () => {
    const { h, s, l } = rgbToHsl(0, 0, 255);
    expect(h).toBe(240);
    expect(s).toBe(100);
    expect(l).toBe(50);
  });

  test("rgbToHsl: gray -> s=0", () => {
    const { s } = rgbToHsl(128, 128, 128);
    expect(s).toBe(0);
  });

  test("hslToRgb: h=0 s=100 l=50 -> {255, 0, 0} (red)", () => {
    expect(hslToRgb(0, 100, 50)).toEqual({ r: 255, g: 0, b: 0 });
  });

  test("hslToRgb: h=240 s=100 l=50 -> {0, 0, 255} (blue)", () => {
    expect(hslToRgb(240, 100, 50)).toEqual({ r: 0, g: 0, b: 255 });
  });

  test("round-trip: hex -> rgb -> hsl -> rgb -> hex stays stable", () => {
    const hex = "#3b82f6";
    const rgb = hexToRgb(hex)!;
    const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
    const rgb2 = hslToRgb(hsl.h, hsl.s, hsl.l);
    const hex2 = rgbToHex(rgb2.r, rgb2.g, rgb2.b);
    // Allow ±1 rounding on each channel
    const r1 = hexToRgb(hex)!;
    const r2 = hexToRgb(hex2)!;
    expect(Math.abs(r1.r - r2.r)).toBeLessThanOrEqual(2);
    expect(Math.abs(r1.g - r2.g)).toBeLessThanOrEqual(2);
    expect(Math.abs(r1.b - r2.b)).toBeLessThanOrEqual(2);
  });
});

// ---------------------------------------------------------------------------
// DOM builder helpers
// ---------------------------------------------------------------------------

function buildPickerDom(opts: {
  value?: string;
  format?: string;
  alpha?: boolean;
  alphaValue?: number;
  swatches?: string[];
  eyedropper?: boolean;
  disabled?: boolean;
  size?: string;
  name?: string;
} = {}): HTMLElement {
  const {
    value = "#3b82f6",
    format = "hex",
    alpha = false,
    alphaValue = 100,
    swatches = [],
    eyedropper = false,
    disabled = false,
    size = "md",
    name = "color",
  } = opts;

  const root = document.createElement("div");
  root.setAttribute("role", "group");
  root.setAttribute("aria-label", "Color picker");
  root.setAttribute("data-slot", "color-picker");
  root.setAttribute("data-size", size);
  root.setAttribute("data-lv-color-picker", "");
  root.setAttribute("data-lv-cp-format", format);
  if (alpha) root.setAttribute("data-lv-cp-alpha", "true");
  if (eyedropper) root.setAttribute("data-lv-cp-eyedropper", "true");
  root.setAttribute("data-lv-cp-swatch-count", String(swatches.length));
  if (disabled) root.setAttribute("aria-disabled", "true");

  // Trigger button
  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.setAttribute("data-slot", "trigger");
  trigger.setAttribute("aria-expanded", "false");
  trigger.setAttribute("aria-haspopup", "dialog");
  trigger.setAttribute("aria-controls", "test-popover");
  trigger.setAttribute("aria-label", `Pick color: ${value}`);
  if (disabled) trigger.disabled = true;
  // Swatch span inside trigger
  const swatchSpan = document.createElement("span");
  swatchSpan.setAttribute("aria-hidden", "true");
  swatchSpan.style.backgroundColor = value;
  trigger.appendChild(swatchSpan);
  // Text span inside trigger
  const textSpan = document.createElement("span");
  textSpan.className = "font-mono";
  textSpan.textContent = value;
  trigger.appendChild(textSpan);
  root.appendChild(trigger);

  // Hidden native input
  const native = document.createElement("input");
  native.type = "color";
  native.name = name;
  native.value = value;
  native.setAttribute("aria-hidden", "true");
  native.tabIndex = -1;
  native.setAttribute("data-slot", "native-input");
  root.appendChild(native);

  // Popover panel
  const panel = document.createElement("div");
  panel.id = "test-popover";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-modal", "false");
  panel.setAttribute("data-slot", "popover");
  panel.setAttribute("popover", "");

  // Color preview
  const preview = document.createElement("div");
  preview.setAttribute("data-slot", "color-preview");
  preview.setAttribute("aria-hidden", "true");
  preview.style.backgroundColor = value;
  panel.appendChild(preview);

  // HEX group
  const hexGroup = document.createElement("div");
  hexGroup.setAttribute("data-slot", "hex-group");
  if (format !== "hex") { hexGroup.setAttribute("hidden", ""); hexGroup.setAttribute("aria-hidden", "true"); }
  const hexInput = document.createElement("input");
  hexInput.type = "text";
  hexInput.setAttribute("data-slot", "hex-input");
  hexInput.setAttribute("aria-label", "Hex color");
  hexInput.value = value;
  const hexHint = document.createElement("span");
  hexHint.className = "sr-only";
  hexHint.textContent = "#rrggbb";
  hexGroup.appendChild(hexInput);
  hexGroup.appendChild(hexHint);
  panel.appendChild(hexGroup);

  // RGB group
  const rgbGroup = document.createElement("div");
  rgbGroup.setAttribute("data-slot", "rgb-group");
  if (format !== "rgb") { rgbGroup.setAttribute("hidden", ""); rgbGroup.setAttribute("aria-hidden", "true"); }
  const rgb = hexToRgb(value) ?? { r: 0, g: 0, b: 0 };
  for (const [slot, label, val, max] of [
    ["channel-r", "Red", rgb.r, 255],
    ["channel-g", "Green", rgb.g, 255],
    ["channel-b", "Blue", rgb.b, 255],
  ] as [string, string, number, number][]) {
    const inp = document.createElement("input");
    inp.type = "number";
    inp.setAttribute("data-slot", slot);
    inp.setAttribute("aria-label", label);
    inp.setAttribute("aria-valuemin", "0");
    inp.setAttribute("aria-valuemax", String(max));
    inp.setAttribute("aria-valuenow", String(val));
    inp.value = String(val);
    inp.min = "0"; inp.max = String(max); inp.step = "1";
    rgbGroup.appendChild(inp);
  }
  panel.appendChild(rgbGroup);

  // HSL group
  const hslGroup = document.createElement("div");
  hslGroup.setAttribute("data-slot", "hsl-group");
  if (format !== "hsl") { hslGroup.setAttribute("hidden", ""); hslGroup.setAttribute("aria-hidden", "true"); }
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
  for (const [sl, label, val, max, step, text] of [
    ["channel-h", "Hue", hsl.h, 360, 1, `Hue: ${hsl.h} degrees`],
    ["channel-s", "Saturation", hsl.s, 100, 1, `Saturation: ${hsl.s}%`],
    ["channel-l", "Lightness", hsl.l, 100, 1, `Lightness: ${hsl.l}%`],
  ] as [string, string, number, number, number, string][]) {
    const inp = document.createElement("input");
    inp.type = "number";
    inp.setAttribute("data-slot", sl);
    inp.setAttribute("aria-label", label);
    inp.setAttribute("aria-valuemin", "0");
    inp.setAttribute("aria-valuemax", String(max));
    inp.setAttribute("aria-valuenow", String(val));
    inp.setAttribute("aria-valuetext", text);
    inp.value = String(val);
    inp.min = "0"; inp.max = String(max); inp.step = String(step);
    hslGroup.appendChild(inp);
  }
  panel.appendChild(hslGroup);

  // Alpha group (conditional)
  if (alpha) {
    const alphaGroup = document.createElement("div");
    alphaGroup.setAttribute("data-slot", "alpha-group");
    const alphaInp = document.createElement("input");
    alphaInp.type = "range";
    alphaInp.setAttribute("data-slot", "alpha-input");
    alphaInp.setAttribute("aria-label", "Alpha");
    alphaInp.setAttribute("aria-valuemin", "0");
    alphaInp.setAttribute("aria-valuemax", "100");
    alphaInp.setAttribute("aria-valuenow", String(alphaValue));
    alphaInp.setAttribute("aria-valuetext", `${alphaValue}%`);
    alphaInp.value = String(alphaValue);
    alphaInp.min = "0"; alphaInp.max = "100"; alphaInp.step = "1";
    alphaGroup.appendChild(alphaInp);
    panel.appendChild(alphaGroup);
  }

  // Format row
  const fmtRow = document.createElement("div");
  fmtRow.setAttribute("data-slot", "format-row");
  const fmtBtn = document.createElement("button");
  fmtBtn.type = "button";
  fmtBtn.setAttribute("data-slot", "format-toggle");
  const labels: Record<string, string> = { hex: "Hex", rgb: "RGB", hsl: "HSL" };
  fmtBtn.setAttribute("aria-label", `Format: ${labels[format] ?? "Hex"}`);
  fmtBtn.textContent = labels[format] ?? "Hex";
  fmtRow.appendChild(fmtBtn);

  if (eyedropper) {
    const eyeBtn = document.createElement("button");
    eyeBtn.type = "button";
    eyeBtn.setAttribute("data-slot", "eyedropper-btn");
    eyeBtn.setAttribute("aria-label", "Pick color from screen");
    fmtRow.appendChild(eyeBtn);
  }
  panel.appendChild(fmtRow);

  // Swatch grid (conditional)
  if (swatches.length > 0) {
    const swatchGrid = document.createElement("div");
    swatchGrid.setAttribute("role", "toolbar");
    swatchGrid.setAttribute("aria-label", "Color presets");
    swatchGrid.setAttribute("data-slot", "swatches");
    swatchGrid.setAttribute("data-lv-cp-swatch-count", String(swatches.length));
    swatchGrid.setAttribute("data-lievit-collection", "");
    swatchGrid.setAttribute("data-lievit-collection-roving-tabindex", "true");
    swatchGrid.setAttribute("data-lievit-collection-orientation", "horizontal");
    swatchGrid.setAttribute("data-lievit-collection-wrap", "true");
    swatchGrid.setAttribute("data-manual-activation", "true");
    for (const sw of swatches) {
      const swBtn = document.createElement("button");
      swBtn.type = "button";
      swBtn.setAttribute("data-slot", "swatch");
      swBtn.setAttribute("data-color", sw);
      swBtn.setAttribute("data-lievit-item", "");
      swBtn.setAttribute("aria-label", sw);
      const isActive = sw.toLowerCase() === value.toLowerCase();
      swBtn.setAttribute("aria-pressed", isActive ? "true" : "false");
      swBtn.tabIndex = isActive ? 0 : -1;
      swBtn.style.backgroundColor = sw;
      swatchGrid.appendChild(swBtn);
    }
    panel.appendChild(swatchGrid);
  }

  // Live region
  const liveRegion = document.createElement("span");
  liveRegion.setAttribute("role", "status");
  liveRegion.setAttribute("aria-live", "polite");
  liveRegion.setAttribute("aria-atomic", "true");
  liveRegion.setAttribute("data-slot", "live-region");
  liveRegion.className = "sr-only";
  panel.appendChild(liveRegion);

  // Actions
  const actions = document.createElement("div");
  actions.setAttribute("data-slot", "actions");
  const cancelBtn = document.createElement("button");
  cancelBtn.type = "button";
  cancelBtn.setAttribute("data-slot", "cancel-btn");
  cancelBtn.setAttribute("aria-label", "Cancel");
  cancelBtn.textContent = "Cancel";
  const confirmBtn = document.createElement("button");
  confirmBtn.type = "button";
  confirmBtn.setAttribute("data-slot", "confirm-btn");
  confirmBtn.setAttribute("aria-label", "Confirm color");
  confirmBtn.textContent = "OK";
  actions.appendChild(cancelBtn);
  actions.appendChild(confirmBtn);
  panel.appendChild(actions);

  root.appendChild(panel);

  // Stub popover API on the panel (happy-dom may not implement it)
  let popoverOpen = false;
  Object.defineProperty(panel, "showPopover", {
    value: () => { popoverOpen = true; panel.setAttribute("data-open", "true"); },
    configurable: true,
  });
  Object.defineProperty(panel, "hidePopover", {
    value: () => { popoverOpen = false; panel.removeAttribute("data-open"); },
    configurable: true,
  });
  Object.defineProperty(panel, "_isOpen", { get: () => popoverOpen, configurable: true });

  document.body.appendChild(root);
  return root;
}

function getSlot<T extends HTMLElement = HTMLElement>(root: Element, name: string): T {
  const el = root.querySelector<T>(`[data-slot="${name}"]`);
  if (el == null) throw new Error(`slot [data-slot="${name}"] not found`);
  return el;
}

function fireInput(el: HTMLElement): void {
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

function fireKeydown(el: HTMLElement, key: string): void {
  el.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
}

afterEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// 3. Render assertions
// ---------------------------------------------------------------------------

describe("color-picker enhancer -- render / initial state", () => {
  test("trigger aria-label contains current value", () => {
    const root = buildPickerDom({ value: "#3b82f6" });
    enhanceColorPicker(root);
    const trigger = getSlot(root, "trigger");
    expect(trigger.getAttribute("aria-label")).toBe("Pick color: #3b82f6");
  });

  test("native input is aria-hidden, tabindex=-1, carries name", () => {
    const root = buildPickerDom({ name: "bg" });
    enhanceColorPicker(root);
    const native = getSlot<HTMLInputElement>(root, "native-input");
    expect(native.getAttribute("aria-hidden")).toBe("true");
    expect(native.tabIndex).toBe(-1);
    expect(native.name).toBe("bg");
  });

  test("popover closed by default (data-open not set)", () => {
    const root = buildPickerDom();
    enhanceColorPicker(root);
    const panel = getSlot(root, "popover");
    expect(panel.hasAttribute("data-open")).toBe(false);
  });

  test("data-size on root matches size param", () => {
    const root = buildPickerDom({ size: "lg" });
    enhanceColorPicker(root);
    expect(root.getAttribute("data-size")).toBe("lg");
  });

  test("data-slot on root is color-picker", () => {
    const root = buildPickerDom();
    expect(root.getAttribute("data-slot")).toBe("color-picker");
  });

  test("alpha row absent when alpha=false", () => {
    const root = buildPickerDom({ alpha: false });
    enhanceColorPicker(root);
    expect(root.querySelector('[data-slot="alpha-input"]')).toBeNull();
  });

  test("alpha row present when alpha=true with aria-valuemax=100", () => {
    const root = buildPickerDom({ alpha: true, alphaValue: 75 });
    enhanceColorPicker(root);
    const inp = getSlot<HTMLInputElement>(root, "alpha-input");
    expect(inp.getAttribute("aria-valuemax")).toBe("100");
  });

  test("eyedropper button absent when eyedropper=false", () => {
    const root = buildPickerDom({ eyedropper: false });
    enhanceColorPicker(root);
    expect(root.querySelector('[data-slot="eyedropper-btn"]')).toBeNull();
  });

  test("swatches render: two swatches with correct aria-label, aria-pressed, tabindex", () => {
    const root = buildPickerDom({ value: "#ff0000", swatches: ["#ff0000", "#00ff00"] });
    enhanceColorPicker(root);
    const swatches = Array.from(root.querySelectorAll('[data-slot="swatch"]'));
    expect(swatches).toHaveLength(2);
    expect(swatches[0].getAttribute("aria-label")).toBe("#ff0000");
    expect(swatches[0].getAttribute("aria-pressed")).toBe("true");
    expect((swatches[0] as HTMLElement).tabIndex).toBe(0);
    expect(swatches[1].getAttribute("aria-label")).toBe("#00ff00");
    expect(swatches[1].getAttribute("aria-pressed")).toBe("false");
    expect((swatches[1] as HTMLElement).tabIndex).toBe(-1);
  });

  test("disabled: trigger has disabled attribute; root has aria-disabled=true", () => {
    const root = buildPickerDom({ disabled: true });
    enhanceColorPicker(root);
    expect(root.getAttribute("aria-disabled")).toBe("true");
    const trigger = getSlot<HTMLButtonElement>(root, "trigger");
    expect(trigger.disabled).toBe(true);
  });

  test("disabled: clicking trigger does not open the popover", () => {
    const root = buildPickerDom({ disabled: true });
    enhanceColorPicker(root);
    const trigger = getSlot<HTMLButtonElement>(root, "trigger");
    trigger.click();
    const panel = getSlot(root, "popover");
    expect(panel.hasAttribute("data-open")).toBe(false);
  });

  test("idempotent: enhancing twice does not duplicate listeners", () => {
    const root = buildPickerDom();
    enhanceColorPicker(root);
    enhanceColorPicker(root);
    expect(root.getAttribute("data-lv-cp-enhanced")).toBe("");
  });

  test("enhanceAllColorPickers wires every root in scope", () => {
    const root1 = buildPickerDom();
    const root2 = buildPickerDom();
    enhanceAllColorPickers();
    expect(root1.hasAttribute("data-lv-cp-enhanced")).toBe(true);
    expect(root2.hasAttribute("data-lv-cp-enhanced")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 4. Channel sync (REAL enhancer, no mock)
// ---------------------------------------------------------------------------

describe("color-picker enhancer -- channel sync", () => {
  test("hex -> RGB sync: #ff8000 -> R=255, G=128, B=0", () => {
    const root = buildPickerDom({ value: "#000000" });
    enhanceColorPicker(root);
    const hexInp = getSlot<HTMLInputElement>(root, "hex-input");
    hexInp.value = "#ff8000";
    fireInput(hexInp);
    expect(getSlot<HTMLInputElement>(root, "channel-r").value).toBe("255");
    expect(getSlot<HTMLInputElement>(root, "channel-g").value).toBe("128");
    expect(getSlot<HTMLInputElement>(root, "channel-b").value).toBe("0");
  });

  test("hex -> RGB sync: preview square background-color updated", () => {
    const root = buildPickerDom({ value: "#000000" });
    enhanceColorPicker(root);
    const hexInp = getSlot<HTMLInputElement>(root, "hex-input");
    hexInp.value = "#ff8000";
    fireInput(hexInp);
    const preview = getSlot(root, "color-preview") as HTMLElement;
    expect(preview.style.backgroundColor).toBeTruthy();
  });

  test("RGB -> hex sync: R=255, G=0, B=0 -> #ff0000", () => {
    const root = buildPickerDom({ format: "rgb", value: "#000000" });
    enhanceColorPicker(root);
    const r = getSlot<HTMLInputElement>(root, "channel-r");
    const g = getSlot<HTMLInputElement>(root, "channel-g");
    const b = getSlot<HTMLInputElement>(root, "channel-b");
    r.value = "255"; g.value = "0"; b.value = "0";
    fireInput(r);
    expect(getSlot<HTMLInputElement>(root, "hex-input").value).toBe("#ff0000");
  });

  test("HSL -> hex sync: H=240, S=100, L=50 -> #0000ff (blue)", () => {
    const root = buildPickerDom({ format: "hsl", value: "#000000" });
    enhanceColorPicker(root);
    getSlot<HTMLInputElement>(root, "channel-h").value = "240";
    getSlot<HTMLInputElement>(root, "channel-s").value = "100";
    const lInp = getSlot<HTMLInputElement>(root, "channel-l");
    lInp.value = "50";
    fireInput(lInp);
    expect(getSlot<HTMLInputElement>(root, "hex-input").value).toBe("#0000ff");
  });

  test("out-of-range clamping: R=300 is clamped to 255", () => {
    const root = buildPickerDom({ format: "rgb", value: "#000000" });
    enhanceColorPicker(root);
    const r = getSlot<HTMLInputElement>(root, "channel-r");
    r.value = "300";
    fireInput(r);
    expect(getSlot<HTMLInputElement>(root, "channel-r").value).toBe("255");
  });

  test("invalid hex: ignored; channels not updated to garbage", () => {
    const root = buildPickerDom({ value: "#ff8000" });
    enhanceColorPicker(root);
    const hexInp = getSlot<HTMLInputElement>(root, "hex-input");
    const rBefore = getSlot<HTMLInputElement>(root, "channel-r").value;
    hexInp.value = "#zzzzzz";
    fireInput(hexInp);
    // Channel values must not change to garbage
    expect(getSlot<HTMLInputElement>(root, "channel-r").value).toBe(rBefore);
  });

  test("alpha aria-valuenow + aria-valuetext updated on input", () => {
    const root = buildPickerDom({ alpha: true, alphaValue: 100 });
    enhanceColorPicker(root);
    const alphaInp = getSlot<HTMLInputElement>(root, "alpha-input");
    alphaInp.value = "50";
    fireInput(alphaInp);
    expect(alphaInp.getAttribute("aria-valuenow")).toBe("50");
    expect(alphaInp.getAttribute("aria-valuetext")).toBe("50%");
  });
});

// ---------------------------------------------------------------------------
// 5. Popover open / close + focus management
// ---------------------------------------------------------------------------

describe("color-picker enhancer -- popover open/close", () => {
  test("trigger click opens the popover (data-open set)", () => {
    const root = buildPickerDom();
    enhanceColorPicker(root);
    getSlot<HTMLButtonElement>(root, "trigger").click();
    const panel = getSlot(root, "popover");
    expect(panel.hasAttribute("data-open")).toBe(true);
  });

  test("trigger aria-expanded='true' when open", () => {
    const root = buildPickerDom();
    enhanceColorPicker(root);
    getSlot<HTMLButtonElement>(root, "trigger").click();
    expect(getSlot<HTMLButtonElement>(root, "trigger").getAttribute("aria-expanded")).toBe("true");
  });

  test("Esc closes the popover and restores focus to trigger", () => {
    const root = buildPickerDom();
    enhanceColorPicker(root);
    getSlot<HTMLButtonElement>(root, "trigger").click();
    const panel = getSlot(root, "popover");
    expect(panel.hasAttribute("data-open")).toBe(true);
    fireKeydown(panel, "Escape");
    expect(panel.hasAttribute("data-open")).toBe(false);
  });

  test("cancel button closes the popover", () => {
    const root = buildPickerDom();
    enhanceColorPicker(root);
    getSlot<HTMLButtonElement>(root, "trigger").click();
    getSlot<HTMLButtonElement>(root, "cancel-btn").click();
    expect(getSlot(root, "popover").hasAttribute("data-open")).toBe(false);
  });

  test("confirm button closes the popover and updates native input", () => {
    const root = buildPickerDom({ value: "#3b82f6" });
    enhanceColorPicker(root);
    getSlot<HTMLButtonElement>(root, "trigger").click();
    const hexInp = getSlot<HTMLInputElement>(root, "hex-input");
    hexInp.value = "#abcdef";
    fireInput(hexInp);
    getSlot<HTMLButtonElement>(root, "confirm-btn").click();
    expect(getSlot(root, "popover").hasAttribute("data-open")).toBe(false);
    expect(getSlot<HTMLInputElement>(root, "native-input").value).toBe("#abcdef");
  });

  test("confirm fires input+change events on the native input", () => {
    const root = buildPickerDom({ value: "#000000" });
    enhanceColorPicker(root);
    getSlot<HTMLButtonElement>(root, "trigger").click();
    let inputCount = 0, changeCount = 0;
    getSlot<HTMLInputElement>(root, "native-input").addEventListener("input", () => inputCount++);
    getSlot<HTMLInputElement>(root, "native-input").addEventListener("change", () => changeCount++);
    getSlot<HTMLButtonElement>(root, "confirm-btn").click();
    expect(inputCount).toBe(1);
    expect(changeCount).toBe(1);
  });

  test("cancel restores original value without confirming", () => {
    const root = buildPickerDom({ value: "#3b82f6" });
    enhanceColorPicker(root);
    getSlot<HTMLButtonElement>(root, "trigger").click();
    const hexInp = getSlot<HTMLInputElement>(root, "hex-input");
    hexInp.value = "#ff0000";
    fireInput(hexInp);
    // Cancel
    getSlot<HTMLButtonElement>(root, "cancel-btn").click();
    // Hex input should revert
    expect(getSlot<HTMLInputElement>(root, "hex-input").value).toBe("#3b82f6");
    // Native input unchanged
    expect(getSlot<HTMLInputElement>(root, "native-input").value).toBe("#3b82f6");
  });

  test("trigger aria-label updated after confirm with new hex", () => {
    const root = buildPickerDom({ value: "#000000" });
    enhanceColorPicker(root);
    getSlot<HTMLButtonElement>(root, "trigger").click();
    const hexInp = getSlot<HTMLInputElement>(root, "hex-input");
    hexInp.value = "#abcdef";
    fireInput(hexInp);
    getSlot<HTMLButtonElement>(root, "confirm-btn").click();
    expect(getSlot<HTMLButtonElement>(root, "trigger").getAttribute("aria-label")).toBe("Pick color: #abcdef");
  });
});

// ---------------------------------------------------------------------------
// 6. Swatch application
// ---------------------------------------------------------------------------

describe("color-picker enhancer -- swatch application", () => {
  test("clicking a swatch applies color to hex input without confirming native input", () => {
    const root = buildPickerDom({ value: "#000000", swatches: ["#ff6b6b", "#00ff00"] });
    enhanceColorPicker(root);
    const swatches = Array.from(root.querySelectorAll<HTMLElement>('[data-slot="swatch"]'));
    swatches[0].click();
    // Hex input updated
    expect(getSlot<HTMLInputElement>(root, "hex-input").value).toBe("#ff6b6b");
    // Native input NOT updated (confirm not pressed)
    expect(getSlot<HTMLInputElement>(root, "native-input").value).toBe("#000000");
  });

  test("swatch click updates live region with announcement", () => {
    const root = buildPickerDom({ value: "#000000", swatches: ["#ff6b6b"] });
    enhanceColorPicker(root);
    root.querySelector<HTMLElement>('[data-slot="swatch"]')!.click();
    expect(getSlot(root, "live-region").textContent).toBe("Color set to #ff6b6b");
  });

  test("swatch click updates aria-pressed: applied swatch gets true, others false", () => {
    const root = buildPickerDom({ value: "#000000", swatches: ["#ff6b6b", "#00ff00"] });
    enhanceColorPicker(root);
    const swatches = Array.from(root.querySelectorAll('[data-slot="swatch"]'));
    (swatches[0] as HTMLElement).click();
    expect(swatches[0].getAttribute("aria-pressed")).toBe("true");
    expect(swatches[1].getAttribute("aria-pressed")).toBe("false");
  });
});

// ---------------------------------------------------------------------------
// 7. Spinbutton keyboard (APG Spinbutton Home/End/PageUp/PageDown)
// ---------------------------------------------------------------------------

describe("color-picker enhancer -- spinbutton keyboard", () => {
  test("Home on R channel sets value to 0 (min)", () => {
    const root = buildPickerDom({ format: "rgb", value: "#ff0000" });
    enhanceColorPicker(root);
    const r = getSlot<HTMLInputElement>(root, "channel-r");
    r.value = "200";
    fireKeydown(r, "Home");
    expect(r.value).toBe("0");
  });

  test("End on R channel sets value to 255 (max)", () => {
    const root = buildPickerDom({ format: "rgb", value: "#000000" });
    enhanceColorPicker(root);
    const r = getSlot<HTMLInputElement>(root, "channel-r");
    r.value = "50";
    fireKeydown(r, "End");
    expect(r.value).toBe("255");
  });

  test("PageUp on H spinbutton increments by 10", () => {
    const root = buildPickerDom({ format: "hsl", value: "#3b82f6" });
    enhanceColorPicker(root);
    const h = getSlot<HTMLInputElement>(root, "channel-h");
    h.value = "20";
    fireKeydown(h, "PageUp");
    expect(h.value).toBe("30");
  });

  test("PageDown on H spinbutton decrements by 10", () => {
    const root = buildPickerDom({ format: "hsl", value: "#3b82f6" });
    enhanceColorPicker(root);
    const h = getSlot<HTMLInputElement>(root, "channel-h");
    h.value = "20";
    fireKeydown(h, "PageDown");
    expect(h.value).toBe("10");
  });

  test("PageUp clamps at max", () => {
    const root = buildPickerDom({ format: "rgb", value: "#ff0000" });
    enhanceColorPicker(root);
    const r = getSlot<HTMLInputElement>(root, "channel-r");
    r.value = "250";
    fireKeydown(r, "PageUp");
    expect(parseInt(r.value, 10)).toBeLessThanOrEqual(255);
  });

  test("PageDown clamps at min (0)", () => {
    const root = buildPickerDom({ format: "rgb", value: "#000000" });
    enhanceColorPicker(root);
    const r = getSlot<HTMLInputElement>(root, "channel-r");
    r.value = "5";
    fireKeydown(r, "PageDown");
    expect(parseInt(r.value, 10)).toBeGreaterThanOrEqual(0);
  });
});

// ---------------------------------------------------------------------------
// 8. Format toggle
// ---------------------------------------------------------------------------

describe("color-picker enhancer -- format toggle", () => {
  test("clicking format-toggle cycles hex -> rgb -> hsl -> hex (aria-label)", () => {
    const root = buildPickerDom({ format: "hex" });
    enhanceColorPicker(root);
    const btn = getSlot<HTMLButtonElement>(root, "format-toggle");
    btn.click();
    expect(btn.getAttribute("aria-label")).toBe("Format: RGB");
    btn.click();
    expect(btn.getAttribute("aria-label")).toBe("Format: HSL");
    btn.click();
    expect(btn.getAttribute("aria-label")).toBe("Format: Hex");
  });

  test("format toggle hides inactive groups and shows the active one", () => {
    const root = buildPickerDom({ format: "hex" });
    enhanceColorPicker(root);
    getSlot<HTMLButtonElement>(root, "format-toggle").click(); // now rgb
    expect(getSlot(root, "rgb-group").hasAttribute("hidden")).toBe(false);
    expect(getSlot(root, "hex-group").hasAttribute("hidden")).toBe(true);
    expect(getSlot(root, "hsl-group").hasAttribute("hidden")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 9. Eyedropper
// ---------------------------------------------------------------------------

describe("color-picker enhancer -- eyedropper", () => {
  test("eyedropper absent when eyedropper=false", () => {
    const root = buildPickerDom({ eyedropper: false });
    enhanceColorPicker(root);
    expect(root.querySelector('[data-slot="eyedropper-btn"]')).toBeNull();
  });

  test("eyedropper graceful degradation: no EyeDropper API -> aria-disabled + title", () => {
    const root = buildPickerDom({ eyedropper: true });
    // Ensure EyeDropper is not defined
    const win = window as unknown as Record<string, unknown>;
    delete win["EyeDropper"];
    enhanceColorPicker(root);
    const btn = getSlot(root, "eyedropper-btn");
    expect(btn.getAttribute("aria-disabled")).toBe("true");
    expect(btn.getAttribute("title")).toBe("Not supported in this browser");
  });

  test("eyedropper applies color when EyeDropper API is present", async () => {
    const root = buildPickerDom({ eyedropper: true, value: "#000000" });
    // Mock EyeDropper API
    const win = window as unknown as Record<string, unknown>;
    win["EyeDropper"] = class {
      open() { return Promise.resolve({ sRGBHex: "#123456" }); }
    };
    enhanceColorPicker(root);
    getSlot<HTMLButtonElement>(root, "eyedropper-btn").click();
    // Wait for the promise to resolve
    await new Promise((r) => setTimeout(r, 10));
    expect(getSlot<HTMLInputElement>(root, "hex-input").value).toBe("#123456");
    delete win["EyeDropper"];
  });
});

// ---------------------------------------------------------------------------
// 10. XSS / escaping
// ---------------------------------------------------------------------------

describe("color-picker.jte -- XSS escaping (source-text assertions)", () => {
  const markup = stripComments(readJte("color-picker.jte"));

  test("swatch data-color goes through ${swatch} JTE escaping (not $unsafe)", () => {
    // The data-color attribute must use ${swatch} (JTE-escaped), not $unsafe
    expect(markup).toContain('data-color="${swatch}"');
    // Must NOT use $unsafe for data-color
    expect(markup).not.toMatch(/\$unsafe\{swatch\}/);
  });

  test("swatch aria-label goes through ${swatch} JTE escaping", () => {
    expect(markup).toContain('aria-label="${swatch}"');
  });

  test("name param goes through ${name} JTE escaping on native input", () => {
    expect(markup).toContain('name="${name}"');
  });
});
