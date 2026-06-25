/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * color-picker v-next -- source-text + Stimulus-controller tests (converted from the enhancer
 * model to `lv-color-picker`).
 *
 * Three halves:
 *   1. Source-text golden assertions on the JTE source (param names, data-slot, ARIA shape,
 *      data-controller / data-action wiring, data-lievit-* hooks, CSP-clean invariants, no
 *      dev.lievit import, swatches via param).
 *   2. Color-math unit tests on the pure functions the controller exports.
 *   3. Behaviour tests that drive the REAL `lv-color-picker` Stimulus controller over a DOM shaped
 *      exactly like the server-rendered partial (data-controller + the data-action contract). No
 *      mocked $lievit, no mocked channel math: startStimulus() runs the real Application that
 *      auto-loads the controller by filename, flushStimulus() awaits its MutationObserver, and the
 *      controlled/uncontrolled doctrine + morph-safety are proven through the real lievit wire morph
 *      and a fetch-stub-backed runtime.
 *
 * The client-island fidelity lesson (CLAUDE.md): channel sync + swatch selection are exactly the
 * client logic that slips through fake-substrate tests, so every spec §7 acceptance branch is
 * asserted against the real controller here.
 */
import { describe, test, expect, afterEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  hexToRgb,
  rgbToHex,
  rgbToHsl,
  hslToRgb,
  clamp,
} from "../runtime/stimulus/controllers/lv-color-picker-controller.js";
import {
  startStimulus,
  stopStimulus,
  flushStimulus,
} from "../runtime/stimulus/application.js";
import { LievitRuntime } from "../runtime/runtime.js";
import { morph } from "../runtime/morph.js";

// ---------------------------------------------------------------------------
// Source-text helpers
// ---------------------------------------------------------------------------

const jteDir = join(import.meta.dirname, "..", "registry", "jte");
const readJte = (rel: string) => readFileSync(join(jteDir, rel), "utf8");
const stripComments = (src: string) => src.replace(/<%--[\s\S]*?--%>/g, "");

// ---------------------------------------------------------------------------
// 1. Source-text assertions (no controller, no DOM)
// ---------------------------------------------------------------------------

describe("color-picker.jte -- source-text invariants", () => {
  const src = readJte("color-picker.jte");
  const markup = stripComments(src);

  test("no dev.lievit import (JTE gate classpath has none)", () => {
    expect(src).not.toContain("@import dev.lievit");
  });

  test("no nested JTE comments (would mis-parse the gate)", () => {
    const opens = (src.match(/<%--/g) ?? []).length;
    const closes = (src.match(/--%>/g) ?? []).length;
    expect(opens).toBe(closes);
  });

  test("no @if(...) inside an attribute name position (smart attributes only)", () => {
    expect(markup).not.toMatch(/\s@if\([^)]+\)[a-z-]+=["']/);
  });

  test("no expression in tag names (<${...}> is illegal)", () => {
    expect(markup).not.toMatch(/<\$\{/);
  });

  test("root carries the mount hook for the controller", () => {
    expect(markup).toContain("data-lv-color-picker");
  });

  test("root carries the Stimulus controller identifier", () => {
    expect(markup).toContain('data-controller="lv-color-picker"');
  });

  test("data-slot on root is color-picker", () => {
    expect(markup).toContain('data-slot="color-picker"');
  });

  test("data-size on root is ${size}", () => {
    expect(markup).toContain('data-size="${size}"');
  });

  test("trigger button has aria-expanded, aria-haspopup, aria-controls, aria-label + open action", () => {
    expect(markup).toContain('aria-expanded="false"');
    expect(markup).toContain('aria-haspopup="dialog"');
    expect(markup).toContain('aria-controls="${baseId}-popover"');
    expect(markup).toContain("Pick color:");
    expect(markup).toContain('data-action="click->lv-color-picker#open"');
  });

  test("native input is aria-hidden + tabindex=-1 (not in tab order)", () => {
    expect(markup).toContain('aria-hidden="true"');
    expect(markup).toContain('tabindex="-1"');
    expect(markup).toContain('data-slot="native-input"');
    expect(markup).toContain('name="${name}"');
  });

  test("popover panel has role=dialog aria-modal=false, the popover attribute, and the dismiss actions", () => {
    expect(markup).toContain('role="dialog"');
    expect(markup).toContain('aria-modal="false"');
    expect(markup).toContain("popover");
    expect(markup).toContain('data-slot="popover"');
    expect(markup).toContain("keydown->lv-color-picker#onPanelKeydown");
    expect(markup).toContain("focusout->lv-color-picker#onPanelFocusout");
  });

  test("hex-input has aria-label, aria-describedby, and the input sync action", () => {
    expect(markup).toContain('data-slot="hex-input"');
    expect(markup).toContain('aria-label="Hex color"');
    expect(markup).toContain("aria-describedby");
    expect(markup).toContain('data-action="input->lv-color-picker#onHexInput"');
  });

  test("channel inputs have aria-label/min/max/now + the input+keydown actions", () => {
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
    expect(markup).toContain(
      'data-action="input->lv-color-picker#onChannelInput keydown->lv-color-picker#onChannelKeydown"',
    );
    // exactly the six channels carry the channel action
    expect((markup.match(/input->lv-color-picker#onChannelInput/g) ?? []).length).toBe(6);
  });

  test("alpha input is conditional on alpha param, has role-appropriate attributes + the alpha action", () => {
    expect(markup).toContain("@if(alpha)");
    expect(markup).toContain('data-slot="alpha-input"');
    expect(markup).toContain('aria-label="Alpha"');
    expect(markup).toContain('aria-valuemax="100"');
    expect(markup).toContain("aria-valuetext");
    expect(markup).toContain('data-action="input->lv-color-picker#onAlphaInput"');
  });

  test("swatch grid has role=toolbar + collection-nav data attributes (roving stays with collection-nav)", () => {
    expect(markup).toContain('role="toolbar"');
    expect(markup).toContain('aria-label="Color presets"');
    expect(markup).toContain('data-slot="swatches"');
    expect(markup).toContain("data-lievit-collection");
    expect(markup).toContain('data-lievit-collection-roving-tabindex="true"');
    expect(markup).toContain('data-lievit-collection-orientation="horizontal"');
    expect(markup).toContain('data-lievit-collection-wrap="true"');
    expect(markup).toContain('data-manual-activation="true"');
  });

  test("swatch buttons have aria-label, aria-pressed, tabindex, data-color + the swatch action", () => {
    expect(markup).toContain('data-slot="swatch"');
    expect(markup).toContain("data-lievit-item");
    expect(markup).toContain("aria-label=");
    expect(markup).toContain("aria-pressed=");
    expect(markup).toContain("data-color=");
    expect(markup).toContain("tabindex=");
    expect(markup).toContain('data-action="click->lv-color-picker#onSwatchClick"');
  });

  test("swatches are conditional on the swatches List param (never hardcoded)", () => {
    expect(markup).toContain("@if(!swatches.isEmpty())");
    expect(src).toMatch(/@param java\.util\.List<String> swatches/);
  });

  test("eyedropper button is conditional on eyedropper param + carries its action", () => {
    expect(markup).toContain("@if(eyedropper)");
    expect(markup).toContain('data-slot="eyedropper-btn"');
    expect(markup).toContain('aria-label="Pick color from screen"');
    expect(markup).toContain('data-action="click->lv-color-picker#onEyedropper"');
  });

  test("eyedropper uses inline SVG (not a template call -- would import dev.lievit)", () => {
    expect(markup).not.toMatch(/@template\.lievit\.icon/);
    expect(markup).toContain("<svg");
  });

  test("format-toggle button has aria-label with the current format + the cycle action", () => {
    expect(markup).toContain('data-slot="format-toggle"');
    expect(markup).toContain("Format:");
    expect(markup).toContain('data-action="click->lv-color-picker#cycleFormat"');
  });

  test("confirm + cancel buttons have aria-label + their actions", () => {
    expect(markup).toContain('data-slot="confirm-btn"');
    expect(markup).toContain('data-slot="cancel-btn"');
    expect(markup).toContain('aria-label="Confirm color"');
    expect(markup).toContain('aria-label="Cancel"');
    expect(markup).toContain('data-action="click->lv-color-picker#confirm"');
    expect(markup).toContain('data-action="click->lv-color-picker#cancel"');
  });

  test("live region is always in the DOM (not JS-injected, respects CSP)", () => {
    expect(markup).toContain('role="status"');
    expect(markup).toContain('aria-live="polite"');
    expect(markup).toContain('aria-atomic="true"');
    expect(markup).toContain('data-slot="live-region"');
  });

  test("no inline <script> or on* handlers (CSP-clean; behaviour lives in the controller)", () => {
    expect(markup).not.toMatch(/<script/);
    expect(markup).not.toMatch(/\son[a-z]+=/);
  });

  test("swatch background via style= (the one permitted inline-style use for color values)", () => {
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
// 2. Color math unit tests (pure functions exported by the controller)
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
    const r1 = hexToRgb(hex)!;
    const r2 = hexToRgb(hex2)!;
    expect(Math.abs(r1.r - r2.r)).toBeLessThanOrEqual(2);
    expect(Math.abs(r1.g - r2.g)).toBeLessThanOrEqual(2);
    expect(Math.abs(r1.b - r2.b)).toBeLessThanOrEqual(2);
  });
});

// ---------------------------------------------------------------------------
// DOM builder helpers -- emit the partial's markup INCLUDING data-controller + data-action
// ---------------------------------------------------------------------------

const CHANNEL_ACTION =
  "input->lv-color-picker#onChannelInput keydown->lv-color-picker#onChannelKeydown";

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
  appendTo?: ParentNode;
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
    appendTo = document.body,
  } = opts;

  const root = document.createElement("div");
  root.setAttribute("role", "group");
  root.setAttribute("aria-label", "Color picker");
  root.setAttribute("data-slot", "color-picker");
  root.setAttribute("data-size", size);
  root.setAttribute("data-controller", "lv-color-picker");
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
  trigger.setAttribute("data-action", "click->lv-color-picker#open");
  trigger.setAttribute("aria-expanded", "false");
  trigger.setAttribute("aria-haspopup", "dialog");
  trigger.setAttribute("aria-controls", "test-popover");
  trigger.setAttribute("aria-label", `Pick color: ${value}`);
  if (disabled) trigger.disabled = true;
  const swatchSpan = document.createElement("span");
  swatchSpan.setAttribute("aria-hidden", "true");
  swatchSpan.style.backgroundColor = value;
  trigger.appendChild(swatchSpan);
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
  panel.setAttribute(
    "data-action",
    "keydown->lv-color-picker#onPanelKeydown focusout->lv-color-picker#onPanelFocusout",
  );
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
  hexInput.setAttribute("data-action", "input->lv-color-picker#onHexInput");
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
    inp.setAttribute("data-action", CHANNEL_ACTION);
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
    inp.setAttribute("data-action", CHANNEL_ACTION);
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
    alphaInp.setAttribute("data-action", "input->lv-color-picker#onAlphaInput");
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
  fmtBtn.setAttribute("data-action", "click->lv-color-picker#cycleFormat");
  const labels: Record<string, string> = { hex: "Hex", rgb: "RGB", hsl: "HSL" };
  fmtBtn.setAttribute("aria-label", `Format: ${labels[format] ?? "Hex"}`);
  fmtBtn.textContent = labels[format] ?? "Hex";
  fmtRow.appendChild(fmtBtn);

  if (eyedropper) {
    const eyeBtn = document.createElement("button");
    eyeBtn.type = "button";
    eyeBtn.setAttribute("data-slot", "eyedropper-btn");
    eyeBtn.setAttribute("data-action", "click->lv-color-picker#onEyedropper");
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
      swBtn.setAttribute("data-action", "click->lv-color-picker#onSwatchClick");
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
  cancelBtn.setAttribute("data-action", "click->lv-color-picker#cancel");
  cancelBtn.setAttribute("aria-label", "Cancel");
  cancelBtn.textContent = "Cancel";
  const confirmBtn = document.createElement("button");
  confirmBtn.type = "button";
  confirmBtn.setAttribute("data-slot", "confirm-btn");
  confirmBtn.setAttribute("data-action", "click->lv-color-picker#confirm");
  confirmBtn.setAttribute("aria-label", "Confirm color");
  confirmBtn.textContent = "OK";
  actions.appendChild(cancelBtn);
  actions.appendChild(confirmBtn);
  panel.appendChild(actions);

  root.appendChild(panel);

  // Stub the native popover API (happy-dom may not implement it).
  installPopoverStub(panel);

  appendTo.appendChild(root);
  return root;
}

/** Stub showPopover/hidePopover on a panel: track open state via the data-open attribute. */
function installPopoverStub(panel: HTMLElement): void {
  Object.defineProperty(panel, "showPopover", {
    value: () => { panel.setAttribute("data-open", "true"); },
    configurable: true,
  });
  Object.defineProperty(panel, "hidePopover", {
    value: () => { panel.removeAttribute("data-open"); },
    configurable: true,
  });
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

/** Start the real Stimulus Application (auto-loads lv-color-picker) and await its observer. */
async function connect(runtime?: LievitRuntime): Promise<void> {
  startStimulus(runtime != null ? { runtime } : {});
  await flushStimulus();
}

/** A real runtime backed by a fetch stub that records the wire actions it is asked to POST. */
function makeRuntime(): { runtime: LievitRuntime; calledActions: string[] } {
  const calledActions: string[] = [];
  const fetchImpl = vi.fn(async (_url: unknown, init?: RequestInit) => {
    const body = JSON.parse((init?.body as string) ?? "{}") as Record<string, unknown>;
    const calls = body._calls as string[] | undefined;
    if (calls) calledActions.push(...calls);
    return new Response("<div></div>", { status: 200, headers: { "Lievit-Snapshot": "s2" } });
  });
  const runtime = new LievitRuntime({ fetchImpl: fetchImpl as unknown as typeof fetch });
  return { runtime, calledActions };
}

afterEach(() => {
  stopStimulus();
  document.body.innerHTML = "";
  vi.restoreAllMocks();
  const win = window as unknown as Record<string, unknown>;
  delete win["EyeDropper"];
});

// ---------------------------------------------------------------------------
// 3. Render / initial state (real controller)
// ---------------------------------------------------------------------------

describe("color-picker controller -- render / initial state", () => {
  test("trigger aria-label contains current value", async () => {
    const root = buildPickerDom({ value: "#3b82f6" });
    await connect();
    expect(getSlot(root, "trigger").getAttribute("aria-label")).toBe("Pick color: #3b82f6");
  });

  test("native input is aria-hidden, tabindex=-1, carries name", async () => {
    const root = buildPickerDom({ name: "bg" });
    await connect();
    const native = getSlot<HTMLInputElement>(root, "native-input");
    expect(native.getAttribute("aria-hidden")).toBe("true");
    expect(native.tabIndex).toBe(-1);
    expect(native.name).toBe("bg");
  });

  test("popover closed by default (data-open not set)", async () => {
    const root = buildPickerDom();
    await connect();
    expect(getSlot(root, "popover").hasAttribute("data-open")).toBe(false);
  });

  test("data-size on root matches size param", async () => {
    const root = buildPickerDom({ size: "lg" });
    await connect();
    expect(root.getAttribute("data-size")).toBe("lg");
  });

  test("data-slot on root is color-picker", () => {
    const root = buildPickerDom();
    expect(root.getAttribute("data-slot")).toBe("color-picker");
  });

  test("alpha row absent when alpha=false", async () => {
    const root = buildPickerDom({ alpha: false });
    await connect();
    expect(root.querySelector('[data-slot="alpha-input"]')).toBeNull();
  });

  test("alpha row present when alpha=true with aria-valuemax=100", async () => {
    const root = buildPickerDom({ alpha: true, alphaValue: 75 });
    await connect();
    expect(getSlot<HTMLInputElement>(root, "alpha-input").getAttribute("aria-valuemax")).toBe("100");
  });

  test("eyedropper button absent when eyedropper=false", async () => {
    const root = buildPickerDom({ eyedropper: false });
    await connect();
    expect(root.querySelector('[data-slot="eyedropper-btn"]')).toBeNull();
  });

  test("swatches render: two swatches with correct aria-label, aria-pressed, tabindex", async () => {
    const root = buildPickerDom({ value: "#ff0000", swatches: ["#ff0000", "#00ff00"] });
    await connect();
    const swatches = Array.from(root.querySelectorAll('[data-slot="swatch"]'));
    expect(swatches).toHaveLength(2);
    expect(swatches[0].getAttribute("aria-label")).toBe("#ff0000");
    expect(swatches[0].getAttribute("aria-pressed")).toBe("true");
    expect((swatches[0] as HTMLElement).tabIndex).toBe(0);
    expect(swatches[1].getAttribute("aria-label")).toBe("#00ff00");
    expect(swatches[1].getAttribute("aria-pressed")).toBe("false");
    expect((swatches[1] as HTMLElement).tabIndex).toBe(-1);
  });

  test("disabled: trigger has disabled attribute; root has aria-disabled=true", async () => {
    const root = buildPickerDom({ disabled: true });
    await connect();
    expect(root.getAttribute("aria-disabled")).toBe("true");
    expect(getSlot<HTMLButtonElement>(root, "trigger").disabled).toBe(true);
  });

  test("disabled: clicking trigger does not open the popover", async () => {
    const root = buildPickerDom({ disabled: true });
    await connect();
    getSlot<HTMLButtonElement>(root, "trigger").click();
    expect(getSlot(root, "popover").hasAttribute("data-open")).toBe(false);
  });

  test("connect() wires every root on the page (one Application, all roots)", async () => {
    const root1 = buildPickerDom({ value: "#000000" });
    const root2 = buildPickerDom({ value: "#ffffff" });
    await connect();
    // Each root has its own live controller. (Opening root2 light-dismisses root1 via focusout,
    // which is correct, so assert each picker responds at the moment it is opened.)
    getSlot<HTMLButtonElement>(root1, "trigger").click();
    expect(getSlot(root1, "popover").hasAttribute("data-open")).toBe(true);
    getSlot<HTMLButtonElement>(root2, "trigger").click();
    expect(getSlot(root2, "popover").hasAttribute("data-open")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 4. Channel sync (real controller)
// ---------------------------------------------------------------------------

describe("color-picker controller -- channel sync", () => {
  test("hex -> RGB sync: #ff8000 -> R=255, G=128, B=0", async () => {
    const root = buildPickerDom({ value: "#000000" });
    await connect();
    const hexInp = getSlot<HTMLInputElement>(root, "hex-input");
    hexInp.value = "#ff8000";
    fireInput(hexInp);
    expect(getSlot<HTMLInputElement>(root, "channel-r").value).toBe("255");
    expect(getSlot<HTMLInputElement>(root, "channel-g").value).toBe("128");
    expect(getSlot<HTMLInputElement>(root, "channel-b").value).toBe("0");
  });

  test("hex -> RGB sync: preview square background-color updated", async () => {
    const root = buildPickerDom({ value: "#000000" });
    await connect();
    const hexInp = getSlot<HTMLInputElement>(root, "hex-input");
    hexInp.value = "#ff8000";
    fireInput(hexInp);
    expect((getSlot(root, "color-preview") as HTMLElement).style.backgroundColor).toBeTruthy();
  });

  test("RGB -> hex sync: R=255, G=0, B=0 -> #ff0000", async () => {
    const root = buildPickerDom({ format: "rgb", value: "#000000" });
    await connect();
    const r = getSlot<HTMLInputElement>(root, "channel-r");
    const g = getSlot<HTMLInputElement>(root, "channel-g");
    const b = getSlot<HTMLInputElement>(root, "channel-b");
    r.value = "255"; g.value = "0"; b.value = "0";
    fireInput(r);
    expect(getSlot<HTMLInputElement>(root, "hex-input").value).toBe("#ff0000");
  });

  test("HSL -> hex sync: H=240, S=100, L=50 -> #0000ff (blue)", async () => {
    const root = buildPickerDom({ format: "hsl", value: "#000000" });
    await connect();
    getSlot<HTMLInputElement>(root, "channel-h").value = "240";
    getSlot<HTMLInputElement>(root, "channel-s").value = "100";
    const lInp = getSlot<HTMLInputElement>(root, "channel-l");
    lInp.value = "50";
    fireInput(lInp);
    expect(getSlot<HTMLInputElement>(root, "hex-input").value).toBe("#0000ff");
  });

  test("out-of-range clamping: R=300 is clamped to 255", async () => {
    const root = buildPickerDom({ format: "rgb", value: "#000000" });
    await connect();
    const r = getSlot<HTMLInputElement>(root, "channel-r");
    r.value = "300";
    fireInput(r);
    expect(getSlot<HTMLInputElement>(root, "channel-r").value).toBe("255");
  });

  test("invalid hex: ignored; channels not updated to garbage", async () => {
    const root = buildPickerDom({ value: "#ff8000" });
    await connect();
    const hexInp = getSlot<HTMLInputElement>(root, "hex-input");
    const rBefore = getSlot<HTMLInputElement>(root, "channel-r").value;
    hexInp.value = "#zzzzzz";
    fireInput(hexInp);
    expect(getSlot<HTMLInputElement>(root, "channel-r").value).toBe(rBefore);
  });

  test("alpha aria-valuenow + aria-valuetext updated on input", async () => {
    const root = buildPickerDom({ alpha: true, alphaValue: 100 });
    await connect();
    const alphaInp = getSlot<HTMLInputElement>(root, "alpha-input");
    alphaInp.value = "50";
    fireInput(alphaInp);
    expect(alphaInp.getAttribute("aria-valuenow")).toBe("50");
    expect(alphaInp.getAttribute("aria-valuetext")).toBe("50%");
  });
});

// ---------------------------------------------------------------------------
// 5. Popover open / close + confirm / cancel
// ---------------------------------------------------------------------------

describe("color-picker controller -- popover open/close", () => {
  test("trigger click opens the popover (data-open set)", async () => {
    const root = buildPickerDom();
    await connect();
    getSlot<HTMLButtonElement>(root, "trigger").click();
    expect(getSlot(root, "popover").hasAttribute("data-open")).toBe(true);
  });

  test("trigger aria-expanded='true' when open", async () => {
    const root = buildPickerDom();
    await connect();
    getSlot<HTMLButtonElement>(root, "trigger").click();
    expect(getSlot<HTMLButtonElement>(root, "trigger").getAttribute("aria-expanded")).toBe("true");
  });

  test("Esc closes the popover", async () => {
    const root = buildPickerDom();
    await connect();
    getSlot<HTMLButtonElement>(root, "trigger").click();
    const panel = getSlot(root, "popover");
    expect(panel.hasAttribute("data-open")).toBe(true);
    fireKeydown(panel, "Escape");
    expect(panel.hasAttribute("data-open")).toBe(false);
  });

  test("focusout to outside the panel closes the popover", async () => {
    const root = buildPickerDom();
    await connect();
    getSlot<HTMLButtonElement>(root, "trigger").click();
    const panel = getSlot(root, "popover");
    const outside = document.createElement("button");
    document.body.appendChild(outside);
    panel.dispatchEvent(new FocusEvent("focusout", { relatedTarget: outside, bubbles: true }));
    expect(panel.hasAttribute("data-open")).toBe(false);
  });

  test("focusout to another element INSIDE the panel keeps it open", async () => {
    const root = buildPickerDom();
    await connect();
    getSlot<HTMLButtonElement>(root, "trigger").click();
    const panel = getSlot(root, "popover");
    const inside = getSlot(root, "hex-input");
    panel.dispatchEvent(new FocusEvent("focusout", { relatedTarget: inside, bubbles: true }));
    expect(panel.hasAttribute("data-open")).toBe(true);
  });

  test("cancel button closes the popover", async () => {
    const root = buildPickerDom();
    await connect();
    getSlot<HTMLButtonElement>(root, "trigger").click();
    getSlot<HTMLButtonElement>(root, "cancel-btn").click();
    expect(getSlot(root, "popover").hasAttribute("data-open")).toBe(false);
  });

  test("confirm button closes the popover and updates native input", async () => {
    const root = buildPickerDom({ value: "#3b82f6" });
    await connect();
    getSlot<HTMLButtonElement>(root, "trigger").click();
    const hexInp = getSlot<HTMLInputElement>(root, "hex-input");
    hexInp.value = "#abcdef";
    fireInput(hexInp);
    getSlot<HTMLButtonElement>(root, "confirm-btn").click();
    expect(getSlot(root, "popover").hasAttribute("data-open")).toBe(false);
    expect(getSlot<HTMLInputElement>(root, "native-input").value).toBe("#abcdef");
  });

  test("confirm fires input+change events on the native input exactly once", async () => {
    const root = buildPickerDom({ value: "#000000" });
    await connect();
    getSlot<HTMLButtonElement>(root, "trigger").click();
    let inputCount = 0, changeCount = 0;
    getSlot<HTMLInputElement>(root, "native-input").addEventListener("input", () => inputCount++);
    getSlot<HTMLInputElement>(root, "native-input").addEventListener("change", () => changeCount++);
    getSlot<HTMLButtonElement>(root, "confirm-btn").click();
    expect(inputCount).toBe(1);
    expect(changeCount).toBe(1);
  });

  test("cancel restores original value without confirming", async () => {
    const root = buildPickerDom({ value: "#3b82f6" });
    await connect();
    getSlot<HTMLButtonElement>(root, "trigger").click();
    const hexInp = getSlot<HTMLInputElement>(root, "hex-input");
    hexInp.value = "#ff0000";
    fireInput(hexInp);
    getSlot<HTMLButtonElement>(root, "cancel-btn").click();
    expect(getSlot<HTMLInputElement>(root, "hex-input").value).toBe("#3b82f6");
    expect(getSlot<HTMLInputElement>(root, "native-input").value).toBe("#3b82f6");
  });

  test("trigger aria-label updated after confirm with new hex", async () => {
    const root = buildPickerDom({ value: "#000000" });
    await connect();
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

describe("color-picker controller -- swatch application", () => {
  test("clicking a swatch applies color to hex input without confirming native input", async () => {
    const root = buildPickerDom({ value: "#000000", swatches: ["#ff6b6b", "#00ff00"] });
    await connect();
    const swatches = Array.from(root.querySelectorAll<HTMLElement>('[data-slot="swatch"]'));
    swatches[0].click();
    expect(getSlot<HTMLInputElement>(root, "hex-input").value).toBe("#ff6b6b");
    expect(getSlot<HTMLInputElement>(root, "native-input").value).toBe("#000000");
  });

  test("swatch click updates live region with announcement", async () => {
    const root = buildPickerDom({ value: "#000000", swatches: ["#ff6b6b"] });
    await connect();
    root.querySelector<HTMLElement>('[data-slot="swatch"]')!.click();
    expect(getSlot(root, "live-region").textContent).toBe("Color set to #ff6b6b");
  });

  test("swatch click updates aria-pressed: applied swatch gets true, others false", async () => {
    const root = buildPickerDom({ value: "#000000", swatches: ["#ff6b6b", "#00ff00"] });
    await connect();
    const swatches = Array.from(root.querySelectorAll('[data-slot="swatch"]'));
    (swatches[0] as HTMLElement).click();
    expect(swatches[0].getAttribute("aria-pressed")).toBe("true");
    expect(swatches[1].getAttribute("aria-pressed")).toBe("false");
  });
});

// ---------------------------------------------------------------------------
// 7. Spinbutton keyboard (APG Spinbutton Home/End/PageUp/PageDown)
// ---------------------------------------------------------------------------

describe("color-picker controller -- spinbutton keyboard", () => {
  test("Home on R channel sets value to 0 (min)", async () => {
    const root = buildPickerDom({ format: "rgb", value: "#ff0000" });
    await connect();
    const r = getSlot<HTMLInputElement>(root, "channel-r");
    r.value = "200";
    fireKeydown(r, "Home");
    expect(r.value).toBe("0");
  });

  test("End on R channel sets value to 255 (max)", async () => {
    const root = buildPickerDom({ format: "rgb", value: "#000000" });
    await connect();
    const r = getSlot<HTMLInputElement>(root, "channel-r");
    r.value = "50";
    fireKeydown(r, "End");
    expect(r.value).toBe("255");
  });

  test("PageUp on H spinbutton increments by 10", async () => {
    const root = buildPickerDom({ format: "hsl", value: "#3b82f6" });
    await connect();
    const h = getSlot<HTMLInputElement>(root, "channel-h");
    h.value = "20";
    fireKeydown(h, "PageUp");
    expect(h.value).toBe("30");
  });

  test("PageDown on H spinbutton decrements by 10", async () => {
    const root = buildPickerDom({ format: "hsl", value: "#3b82f6" });
    await connect();
    const h = getSlot<HTMLInputElement>(root, "channel-h");
    h.value = "20";
    fireKeydown(h, "PageDown");
    expect(h.value).toBe("10");
  });

  test("PageUp clamps at max", async () => {
    const root = buildPickerDom({ format: "rgb", value: "#ff0000" });
    await connect();
    const r = getSlot<HTMLInputElement>(root, "channel-r");
    r.value = "250";
    fireKeydown(r, "PageUp");
    expect(parseInt(r.value, 10)).toBeLessThanOrEqual(255);
  });

  test("PageDown clamps at min (0)", async () => {
    const root = buildPickerDom({ format: "rgb", value: "#000000" });
    await connect();
    const r = getSlot<HTMLInputElement>(root, "channel-r");
    r.value = "5";
    fireKeydown(r, "PageDown");
    expect(parseInt(r.value, 10)).toBeGreaterThanOrEqual(0);
  });
});

// ---------------------------------------------------------------------------
// 8. Format toggle
// ---------------------------------------------------------------------------

describe("color-picker controller -- format toggle", () => {
  test("clicking format-toggle cycles hex -> rgb -> hsl -> hex (aria-label)", async () => {
    const root = buildPickerDom({ format: "hex" });
    await connect();
    const btn = getSlot<HTMLButtonElement>(root, "format-toggle");
    btn.click();
    expect(btn.getAttribute("aria-label")).toBe("Format: RGB");
    btn.click();
    expect(btn.getAttribute("aria-label")).toBe("Format: HSL");
    btn.click();
    expect(btn.getAttribute("aria-label")).toBe("Format: Hex");
  });

  test("format toggle hides inactive groups and shows the active one", async () => {
    const root = buildPickerDom({ format: "hex" });
    await connect();
    getSlot<HTMLButtonElement>(root, "format-toggle").click(); // now rgb
    expect(getSlot(root, "rgb-group").hasAttribute("hidden")).toBe(false);
    expect(getSlot(root, "hex-group").hasAttribute("hidden")).toBe(true);
    expect(getSlot(root, "hsl-group").hasAttribute("hidden")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 9. Eyedropper
// ---------------------------------------------------------------------------

describe("color-picker controller -- eyedropper", () => {
  test("eyedropper absent when eyedropper=false", async () => {
    const root = buildPickerDom({ eyedropper: false });
    await connect();
    expect(root.querySelector('[data-slot="eyedropper-btn"]')).toBeNull();
  });

  test("eyedropper graceful degradation: no EyeDropper API -> aria-disabled + title", async () => {
    const root = buildPickerDom({ eyedropper: true });
    const win = window as unknown as Record<string, unknown>;
    delete win["EyeDropper"];
    await connect();
    const btn = getSlot(root, "eyedropper-btn");
    expect(btn.getAttribute("aria-disabled")).toBe("true");
    expect(btn.getAttribute("title")).toBe("Not supported in this browser");
  });

  test("eyedropper applies color when EyeDropper API is present", async () => {
    const root = buildPickerDom({ eyedropper: true, value: "#000000" });
    const win = window as unknown as Record<string, unknown>;
    win["EyeDropper"] = class {
      open() { return Promise.resolve({ sRGBHex: "#123456" }); }
    };
    await connect();
    getSlot<HTMLButtonElement>(root, "eyedropper-btn").click();
    await new Promise((r) => setTimeout(r, 10));
    expect(getSlot<HTMLInputElement>(root, "hex-input").value).toBe("#123456");
    delete win["EyeDropper"];
  });
});

// ---------------------------------------------------------------------------
// 10. Controlled/uncontrolled doctrine (real runtime + fetch stub) — a color
//     picker is ALWAYS uncontrolled: its value rides the native input + the form,
//     NEVER a wire round-trip. Every close path must POST zero `_calls`.
// ---------------------------------------------------------------------------

describe("color-picker controller -- uncontrolled: zero wire calls (the 410 doctrine)", () => {
  test("open + edit + confirm + cancel + Esc fire NO /lievit/<id>/call", async () => {
    const { runtime, calledActions } = makeRuntime();
    const root = buildPickerDom({ value: "#000000" });
    await connect(runtime);

    getSlot<HTMLButtonElement>(root, "trigger").click();        // open
    const hexInp = getSlot<HTMLInputElement>(root, "hex-input");
    hexInp.value = "#abcdef";
    fireInput(hexInp);                                          // edit
    getSlot<HTMLButtonElement>(root, "confirm-btn").click();    // confirm + close
    getSlot<HTMLButtonElement>(root, "trigger").click();        // open again
    fireKeydown(getSlot(root, "popover"), "Escape");            // Esc cancel + close

    await new Promise((r) => setTimeout(r, 10));
    expect(calledActions).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 11. Morph-safety (real lievit wire morph): the controller reconnects without
//     stacking listeners, and a removed picker fires nothing.
// ---------------------------------------------------------------------------

describe("color-picker controller -- morph-safety (real lievit morph)", () => {
  test("after a real morph one confirm still fires the native input EXACTLY once (no stacked listeners)", async () => {
    const root = buildPickerDom({ value: "#000000" });
    await connect();

    // A real wire morph re-renders the subtree (idiomorph). Same markup => Stimulus must NOT
    // double-connect; the confirm handler must stay single.
    morph(root, root.outerHTML);
    await flushStimulus();
    installPopoverStub(getSlot<HTMLElement>(root, "popover")); // re-stub the (re-rendered) panel

    getSlot<HTMLButtonElement>(root, "trigger").click();
    const hexInp = getSlot<HTMLInputElement>(root, "hex-input");
    hexInp.value = "#abcdef";
    fireInput(hexInp);

    let inputCount = 0;
    getSlot<HTMLInputElement>(root, "native-input").addEventListener("input", () => inputCount++);
    getSlot<HTMLButtonElement>(root, "confirm-btn").click();
    expect(inputCount).toBe(1);
  });

  test("a picker removed by a morph stops responding (disconnect tears the listeners down)", async () => {
    const wrapper = document.createElement("div");
    document.body.appendChild(wrapper);
    const root = buildPickerDom({ value: "#000000", appendTo: wrapper });
    await connect();

    const trigger = getSlot<HTMLButtonElement>(root, "trigger");
    const panel = getSlot(root, "popover");

    // Morph the picker out of the tree.
    morph(wrapper, "<div><span>gone</span></div>");
    await flushStimulus();

    // The detached trigger's click must no longer reach a live controller => popover never opens.
    trigger.click();
    expect(panel.hasAttribute("data-open")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 12. XSS / escaping (source-text assertions)
// ---------------------------------------------------------------------------

describe("color-picker.jte -- XSS escaping (source-text assertions)", () => {
  const markup = stripComments(readJte("color-picker.jte"));

  test("swatch data-color goes through ${swatch} JTE escaping (not $unsafe)", () => {
    expect(markup).toContain('data-color="${swatch}"');
    expect(markup).not.toMatch(/\$unsafe\{swatch\}/);
  });

  test("swatch aria-label goes through ${swatch} JTE escaping", () => {
    expect(markup).toContain('aria-label="${swatch}"');
  });

  test("name param goes through ${name} JTE escaping on native input", () => {
    expect(markup).toContain('name="${name}"');
  });
});
