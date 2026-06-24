/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * color-picker enhancer (ADR-0012 server-first, ADR-0019 lifecycle registry).
 *
 * Mounts on every `[data-lv-color-picker]` root rendered by `lievit/color-picker.jte`.
 * Owns exactly the two irreducible client responsibilities described in the spec §1:
 *
 *   (a) CHANNEL SYNC: keeps hex input, R/G/B spinbuttons, H/S/L spinbuttons, alpha slider,
 *       and the color-preview square in sync as the user edits any one of them. Each
 *       `input` event on any channel re-derives all representations and writes the derived
 *       values. This is a pure-client derived-state calculation (sub-keystroke latency;
 *       a server round-trip per keystroke would be UX-breaking).
 *
 *   (b) POPOVER OPEN/CLOSE + FOCUS MANAGEMENT: opens the native popover API panel on
 *       trigger click, moves focus to the first visible input, records the trigger for
 *       focus-restore. Closes on Esc, focusout-outside, confirm, and cancel. Updates the
 *       trigger aria-label after confirm so AT reads the new value.
 *
 *   (c) SWATCH ROVING: swatch `role="toolbar"` already carries the `data-lievit-collection`
 *       attributes that the shared collection-nav enhancer reads at runtime. The enhancer here
 *       only handles the semantic consequences of swatch selection (apply color + live region).
 *
 *   (d) SPINBUTTON HOME/END/PAGEUP/PAGEDOWN: supplements <input type="number"> for the APG
 *       Spinbutton keys that browsers do not implement consistently.
 *
 *   (e) FORMAT TOGGLE: cycles the visible format group (hex/rgb/hsl) when the format-toggle
 *       button is clicked, updating aria-labels and hidden states.
 *
 *   (f) EYEDROPPER: checks window.EyeDropper at mount; if absent, marks the button
 *       aria-disabled + adds a title. If present, invokes it on click.
 *
 * NO framework dependency. No Alpine, no Lit. The channel math is a typed pure-function
 * module exported from this file so it is unit-testable in isolation.
 *
 * The enhancer does NOT touch any element outside its root.
 * It does NOT fire server round-trips during editing.
 * It fires exactly one external event: input + change on the native input after confirm.
 *
 * The `data-slot` selectors are stable; the enhancer is immune to markup structure changes
 * as long as the slot names in the JTE template are preserved.
 *
 * CSP-clean: no eval, no innerHTML, no dynamically-created script. All event listeners
 * are attached in code; all DOM writes use `.value`, `.setAttribute`, `.textContent`.
 *
 * Idempotent: `data-lv-cp-enhanced` is stamped on the root; re-scanning the same root
 * is a no-op.
 */

// ---------------------------------------------------------------------------
// Color math utilities (pure functions -- unit-testable in isolation)
// ---------------------------------------------------------------------------

/** Clamps a number to [min, max]. */
export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

/** Converts a 6-digit hex string (with or without leading #) to {r, g, b} (0-255 each). */
export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const clean = hex.startsWith("#") ? hex.slice(1) : hex;
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) {
    return null;
  }
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
  };
}

/** Converts {r, g, b} (0-255 each) to a lowercase 7-char hex string (#rrggbb). */
export function rgbToHex(r: number, g: number, b: number): string {
  return "#" + [r, g, b].map((c) => clamp(Math.round(c), 0, 255).toString(16).padStart(2, "0")).join("");
}

/**
 * Converts {r, g, b} (0-255 each) to {h (0-360), s (0-100), l (0-100)}.
 * Uses the standard HSL conversion algorithm.
 */
export function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  const fR = r / 255, fG = g / 255, fB = b / 255;
  const max = Math.max(fR, fG, fB), min = Math.min(fR, fG, fB);
  const delta = max - min;
  const l = (max + min) / 2;
  const s = delta < 1e-5 ? 0 : delta / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (delta > 1e-5) {
    if (max === fR)      h = 60 * (((fG - fB) / delta) % 6);
    else if (max === fG) h = 60 * (((fB - fR) / delta) + 2);
    else                 h = 60 * (((fR - fG) / delta) + 4);
  }
  if (h < 0) h += 360;
  return { h: clamp(Math.round(h), 0, 360), s: clamp(Math.round(s * 100), 0, 100), l: clamp(Math.round(l * 100), 0, 100) };
}

/**
 * Converts {h (0-360), s (0-100), l (0-100)} to {r, g, b} (0-255 each).
 * Standard HSL-to-RGB conversion.
 */
export function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  const sn = s / 100, ln = l / 100;
  const c = (1 - Math.abs(2 * ln - 1)) * sn;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = ln - c / 2;
  let r = 0, g = 0, b = 0;
  if      (h < 60)  { r = c; g = x; b = 0; }
  else if (h < 120) { r = x; g = c; b = 0; }
  else if (h < 180) { r = 0; g = c; b = x; }
  else if (h < 240) { r = 0; g = x; b = c; }
  else if (h < 300) { r = x; g = 0; b = c; }
  else              { r = c; g = 0; b = x; }
  return {
    r: clamp(Math.round((r + m) * 255), 0, 255),
    g: clamp(Math.round((g + m) * 255), 0, 255),
    b: clamp(Math.round((b + m) * 255), 0, 255),
  };
}

// ---------------------------------------------------------------------------
// Slot selectors
// ---------------------------------------------------------------------------

function slot<T extends Element = HTMLElement>(root: Element, name: string): T | null {
  return root.querySelector<T>(`[data-slot="${name}"]`);
}

function slotAll<T extends Element = HTMLElement>(root: Element, name: string): NodeListOf<T> {
  return root.querySelectorAll<T>(`[data-slot="${name}"]`);
}

// ---------------------------------------------------------------------------
// State persisted per-root
// ---------------------------------------------------------------------------

interface CpState {
  /** The last confirmed hex value (restored on cancel). */
  confirmedHex: string;
  /** The last confirmed alpha value (restored on cancel). */
  confirmedAlpha: number;
  /** Current live hex during editing (may differ from confirmedHex). */
  liveHex: string;
  /** Current format: hex | rgb | hsl. */
  format: string;
  /** Set to the slot name of the input currently being edited (for syncAll skip-self logic). */
  editingSlot: string | null;
  /** Keydown handler attached to the popover panel (for removal on cleanup). */
  popoverKeyHandler: EventListener;
  /** Focusout handler attached to the popover panel (for removal on cleanup). */
  popoverFocusoutHandler: EventListener;
}

const states = new WeakMap<Element, CpState>();

// ---------------------------------------------------------------------------
// Format group visibility management
// ---------------------------------------------------------------------------

const FORMAT_GROUPS: Record<string, string> = { hex: "hex-group", rgb: "rgb-group", hsl: "hsl-group" };

function applyFormatVisibility(root: Element, fmt: string): void {
  for (const [f, slotName] of Object.entries(FORMAT_GROUPS)) {
    const group = slot(root, slotName);
    if (group == null) continue;
    if (f === fmt) {
      group.removeAttribute("hidden");
      group.removeAttribute("aria-hidden");
    } else {
      group.setAttribute("hidden", "");
      group.setAttribute("aria-hidden", "true");
    }
  }
}

// ---------------------------------------------------------------------------
// Channel sync: write all derived representations from a source hex
// ---------------------------------------------------------------------------

function syncAll(root: Element, hex: string, alpha: number): void {
  const state = states.get(root);
  if (state == null) return;
  state.liveHex = hex;

  const rgb = hexToRgb(hex);
  if (rgb == null) return; // invalid hex; maintain last valid state

  const { r, g, b } = rgb;
  const hsl = rgbToHsl(r, g, b);

  // Skip writing back to the input that is currently being edited (to avoid overwriting
  // the user's in-progress input). We track this via state.editingSlot (set by each
  // input's own `input` event handler before calling syncAll, cleared after).
  const skip = state.editingSlot;

  // Update hex input
  const hexInput = slot<HTMLInputElement>(root, "hex-input");
  if (hexInput != null && skip !== "hex-input") hexInput.value = hex;

  // Update RGB channel inputs
  const setChannel = (slotName: string, val: number, text?: string): void => {
    const inp = slot<HTMLInputElement>(root, slotName);
    if (inp == null) return;
    if (skip !== slotName) inp.value = String(val);
    inp.setAttribute("aria-valuenow", String(val));
    if (text != null) inp.setAttribute("aria-valuetext", text);
  };

  setChannel("channel-r", r);
  setChannel("channel-g", g);
  setChannel("channel-b", b);
  setChannel("channel-h", hsl.h, `Hue: ${hsl.h} degrees`);
  setChannel("channel-s", hsl.s, `Saturation: ${hsl.s}%`);
  setChannel("channel-l", hsl.l, `Lightness: ${hsl.l}%`);

  // Update alpha aria-valuenow (value written by caller for sliders)
  const alphaInput = slot<HTMLInputElement>(root, "alpha-input");
  if (alphaInput != null) {
    if (alphaInput !== document.activeElement) alphaInput.value = String(alpha);
    alphaInput.setAttribute("aria-valuenow", String(alpha));
    alphaInput.setAttribute("aria-valuetext", `${alpha}%`);
  }

  // Update color-preview square background
  const preview = slot(root, "color-preview");
  if (preview != null) (preview as HTMLElement).style.backgroundColor = hex;

  // Update swatch aria-pressed
  for (const sw of Array.from(slotAll(root, "swatch"))) {
    const swColor = sw.getAttribute("data-color") ?? "";
    sw.setAttribute("aria-pressed", swColor.toLowerCase() === hex.toLowerCase() ? "true" : "false");
  }
}

// ---------------------------------------------------------------------------
// Derive hex from whichever channel was edited
// ---------------------------------------------------------------------------

function deriveHexFromActiveChannel(root: Element, activeSlot: string): string | null {
  const state = states.get(root);
  if (state == null) return null;

  if (activeSlot === "hex-input") {
    const inp = slot<HTMLInputElement>(root, "hex-input");
    const raw = inp?.value.trim() ?? "";
    const candidate = raw.startsWith("#") ? raw : `#${raw}`;
    return hexToRgb(candidate) != null ? candidate : null;
  }

  if (activeSlot === "channel-r" || activeSlot === "channel-g" || activeSlot === "channel-b") {
    const r = clamp(parseInt(slot<HTMLInputElement>(root, "channel-r")?.value ?? "0", 10), 0, 255);
    const g = clamp(parseInt(slot<HTMLInputElement>(root, "channel-g")?.value ?? "0", 10), 0, 255);
    const b = clamp(parseInt(slot<HTMLInputElement>(root, "channel-b")?.value ?? "0", 10), 0, 255);
    return rgbToHex(r, g, b);
  }

  if (activeSlot === "channel-h" || activeSlot === "channel-s" || activeSlot === "channel-l") {
    const h = clamp(parseInt(slot<HTMLInputElement>(root, "channel-h")?.value ?? "0", 10), 0, 360);
    const s = clamp(parseInt(slot<HTMLInputElement>(root, "channel-s")?.value ?? "0", 10), 0, 100);
    const l = clamp(parseInt(slot<HTMLInputElement>(root, "channel-l")?.value ?? "0", 10), 0, 100);
    const { r, g, b } = hslToRgb(h, s, l);
    return rgbToHex(r, g, b);
  }

  return null;
}

// ---------------------------------------------------------------------------
// Popover open / close
// ---------------------------------------------------------------------------

function openPopover(root: Element): void {
  const state = states.get(root);
  if (state == null) return;

  const panel = slot<HTMLElement>(root, "popover");
  if (panel == null) return;

  const trigger = slot<HTMLButtonElement>(root, "trigger");
  if (trigger != null) trigger.setAttribute("aria-expanded", "true");

  // Show the native popover
  if (typeof (panel as HTMLElement & { showPopover?: () => void }).showPopover === "function") {
    (panel as HTMLElement & { showPopover: () => void }).showPopover();
  } else {
    panel.removeAttribute("hidden");
    (panel as HTMLElement).style.display = "";
  }

  // Move focus to the first visible input
  const fmt = state.format;
  let firstInput: HTMLElement | null = null;
  if (fmt === "hex") {
    firstInput = slot<HTMLElement>(root, "hex-input");
  } else if (fmt === "rgb") {
    firstInput = slot<HTMLElement>(root, "channel-r");
  } else {
    firstInput = slot<HTMLElement>(root, "channel-h");
  }
  if (firstInput != null) firstInput.focus();
}

function closePopover(root: Element, restoreFocus = true): void {
  const panel = slot<HTMLElement>(root, "popover");
  if (panel == null) return;

  const trigger = slot<HTMLButtonElement>(root, "trigger");
  if (trigger != null) trigger.setAttribute("aria-expanded", "false");

  if (typeof (panel as HTMLElement & { hidePopover?: () => void }).hidePopover === "function") {
    try {
      (panel as HTMLElement & { hidePopover: () => void }).hidePopover();
    } catch {
      // hidePopover throws if the popover is already closed; ignore
    }
  } else {
    (panel as HTMLElement).style.display = "none";
  }

  if (restoreFocus && trigger != null) trigger.focus();
}

// ---------------------------------------------------------------------------
// Confirm / cancel
// ---------------------------------------------------------------------------

function confirmColor(root: Element): void {
  const state = states.get(root);
  if (state == null) return;

  const hex = state.liveHex;
  const alpha = parseInt(slot<HTMLInputElement>(root, "alpha-input")?.value ?? "100", 10);
  state.confirmedHex = hex;
  state.confirmedAlpha = isNaN(alpha) ? 100 : alpha;

  // Write to native input + fire change events (the form sees the new value)
  const native = slot<HTMLInputElement>(root, "native-input");
  if (native != null) {
    native.value = hex;
    native.dispatchEvent(new Event("input", { bubbles: true }));
    native.dispatchEvent(new Event("change", { bubbles: true }));
  }

  // Update the trigger label so AT reads the new value on next focus
  const trigger = slot<HTMLButtonElement>(root, "trigger");
  if (trigger != null) {
    trigger.setAttribute("aria-label", `Pick color: ${hex}`);
    // Also update the visible text label in the trigger
    const textSpan = trigger.querySelector<HTMLElement>("[class*='font-mono']");
    if (textSpan != null) textSpan.textContent = hex;
    // And the preview swatch
    const swatchSpan = trigger.querySelector<HTMLElement>("[aria-hidden='true']");
    if (swatchSpan != null) swatchSpan.style.backgroundColor = hex;
  }

  closePopover(root, true);
}

function cancelColor(root: Element): void {
  const state = states.get(root);
  if (state == null) return;

  // Restore all channel inputs to the last confirmed value
  syncAll(root, state.confirmedHex, state.confirmedAlpha);
  state.liveHex = state.confirmedHex;

  closePopover(root, true);
}

// ---------------------------------------------------------------------------
// Swatch application (apply color to channels WITHOUT confirming)
// ---------------------------------------------------------------------------

function applySwatchColor(root: Element, hex: string): void {
  const state = states.get(root);
  if (state == null) return;

  const alpha = parseInt(slot<HTMLInputElement>(root, "alpha-input")?.value ?? "100", 10);
  syncAll(root, hex, isNaN(alpha) ? 100 : alpha);

  // Announce via live region
  const liveRegion = slot(root, "live-region");
  if (liveRegion != null) liveRegion.textContent = `Color set to ${hex}`;
}

// ---------------------------------------------------------------------------
// Spinbutton Home / End / PageUp / PageDown (APG Spinbutton supplemental keys)
// ---------------------------------------------------------------------------

interface SpinConfig {
  min: number;
  max: number;
  largeStep: number;
  slotName: string;
}

const SPIN_CONFIGS: Record<string, SpinConfig> = {
  "channel-r": { min: 0, max: 255, largeStep: 10, slotName: "channel-r" },
  "channel-g": { min: 0, max: 255, largeStep: 10, slotName: "channel-g" },
  "channel-b": { min: 0, max: 255, largeStep: 10, slotName: "channel-b" },
  "channel-h": { min: 0, max: 360, largeStep: 10, slotName: "channel-h" },
  "channel-s": { min: 0, max: 100, largeStep: 10, slotName: "channel-s" },
  "channel-l": { min: 0, max: 100, largeStep: 10, slotName: "channel-l" },
};

function handleSpinbuttonKey(root: Element, e: KeyboardEvent, slotName: string): void {
  const cfg = SPIN_CONFIGS[slotName];
  if (cfg == null) return;

  const inp = slot<HTMLInputElement>(root, slotName);
  if (inp == null) return;

  let current = parseInt(inp.value, 10);
  if (isNaN(current)) current = 0;

  let next: number | null = null;
  if (e.key === "Home")   next = cfg.min;
  else if (e.key === "End")    next = cfg.max;
  else if (e.key === "PageUp")   next = clamp(current + cfg.largeStep, cfg.min, cfg.max);
  else if (e.key === "PageDown") next = clamp(current - cfg.largeStep, cfg.min, cfg.max);

  if (next != null) {
    e.preventDefault();
    inp.value = String(next);
    inp.setAttribute("aria-valuenow", String(next));
    inp.dispatchEvent(new Event("input", { bubbles: true }));
  }
}

// ---------------------------------------------------------------------------
// Eyedropper
// ---------------------------------------------------------------------------

function setupEyedropper(root: Element): void {
  const btn = slot<HTMLButtonElement>(root, "eyedropper-btn");
  if (btn == null) return;

  const winAny = window as unknown as Record<string, unknown>;
  const hasApi = typeof winAny["EyeDropper"] === "function";
  if (!hasApi) {
    btn.setAttribute("aria-disabled", "true");
    btn.setAttribute("title", "Not supported in this browser");
    return;
  }

  btn.addEventListener("click", () => {
    const EyeDropper = winAny["EyeDropper"] as new () => {
      open(): Promise<{ sRGBHex: string }>;
    };
    void new EyeDropper().open().then((result) => {
      const state = states.get(root);
      if (state == null) return;
      const hex = result.sRGBHex;
      const alpha = parseInt(slot<HTMLInputElement>(root, "alpha-input")?.value ?? "100", 10);
      syncAll(root, hex, isNaN(alpha) ? 100 : alpha);
    });
  });
}

// ---------------------------------------------------------------------------
// Main mount function
// ---------------------------------------------------------------------------

const ENHANCED = "data-lv-cp-enhanced";

/** Enhance one color-picker root. No-op if already enhanced. */
export function enhanceColorPicker(root: HTMLElement): void {
  if (root.hasAttribute(ENHANCED)) return;
  root.setAttribute(ENHANCED, "");

  const initialHex = (slot<HTMLInputElement>(root, "native-input")?.value ?? "#000000").toLowerCase();
  const initialFormat = root.getAttribute("data-lv-cp-format") ?? "hex";
  const alphaEnabled = root.getAttribute("data-lv-cp-alpha") === "true";

  const state: CpState = {
    confirmedHex: initialHex,
    confirmedAlpha: 100,
    liveHex: initialHex,
    format: initialFormat,
    editingSlot: null,
    popoverKeyHandler: null as unknown as EventListener,
    popoverFocusoutHandler: null as unknown as EventListener,
  };
  states.set(root, state);

  // Run initial sync to populate all channels from the server-rendered value
  syncAll(root, initialHex, 100);

  // Apply initial format visibility
  applyFormatVisibility(root, initialFormat);

  // Trigger click: open popover
  const trigger = slot<HTMLButtonElement>(root, "trigger");
  if (trigger != null) {
    trigger.addEventListener("click", () => {
      if (root.getAttribute("aria-disabled") === "true") return;
      openPopover(root);
    });
  }

  // Popover: Esc + focusout
  const panel = slot<HTMLElement>(root, "popover");
  if (panel != null) {
    const keyHandler: EventListener = (rawEvent: Event): void => {
      const e = rawEvent as KeyboardEvent;
      if (e.key === "Escape") {
        e.preventDefault();
        cancelColor(root);
      }
    };
    const focusoutHandler: EventListener = (rawEvent: Event): void => {
      const e = rawEvent as FocusEvent;
      // Close when focus leaves the popover entirely
      const related = e.relatedTarget as Node | null;
      if (related == null || !panel.contains(related)) {
        closePopover(root, true);
      }
    };
    (state as CpState).popoverKeyHandler = keyHandler;
    (state as CpState).popoverFocusoutHandler = focusoutHandler;
    panel.addEventListener("keydown", keyHandler);
    panel.addEventListener("focusout", focusoutHandler);
  }

  // Confirm / cancel buttons
  slot<HTMLButtonElement>(root, "confirm-btn")?.addEventListener("click", () => confirmColor(root));
  slot<HTMLButtonElement>(root, "cancel-btn")?.addEventListener("click", () => cancelColor(root));

  // Hex input: sync on input event
  slot<HTMLInputElement>(root, "hex-input")?.addEventListener("input", () => {
    const s = states.get(root);
    if (s != null) s.editingSlot = "hex-input";
    const hex = deriveHexFromActiveChannel(root, "hex-input");
    if (hex != null) {
      const alpha = parseInt(slot<HTMLInputElement>(root, "alpha-input")?.value ?? "100", 10);
      syncAll(root, hex, isNaN(alpha) ? 100 : alpha);
    }
    if (s != null) s.editingSlot = null;
  });

  // Channel inputs: sync on input
  const channelSlots = ["channel-r", "channel-g", "channel-b", "channel-h", "channel-s", "channel-l"];
  for (const slotName of channelSlots) {
    const inp = slot<HTMLInputElement>(root, slotName);
    inp?.addEventListener("input", () => {
      const s = states.get(root);
      if (s != null) s.editingSlot = slotName;
      // Clamp on input
      const raw = parseInt(inp.value, 10);
      const cfg = SPIN_CONFIGS[slotName];
      if (cfg != null && !isNaN(raw)) {
        const clamped = clamp(raw, cfg.min, cfg.max);
        if (clamped !== raw) inp.value = String(clamped);
      }
      const hex = deriveHexFromActiveChannel(root, slotName);
      if (hex != null) {
        const alpha = parseInt(slot<HTMLInputElement>(root, "alpha-input")?.value ?? "100", 10);
        syncAll(root, hex, isNaN(alpha) ? 100 : alpha);
      }
      if (s != null) s.editingSlot = null;
    });
    // APG Spinbutton supplemental keys
    inp?.addEventListener("keydown", (rawEvent: Event) => {
      handleSpinbuttonKey(root, rawEvent as KeyboardEvent, slotName);
    });
  }

  // Alpha input: sync aria-valuenow + aria-valuetext on input
  if (alphaEnabled) {
    slot<HTMLInputElement>(root, "alpha-input")?.addEventListener("input", (rawEvent: Event) => {
      const inp = rawEvent.target as HTMLInputElement;
      const val = clamp(parseInt(inp.value, 10), 0, 100);
      inp.setAttribute("aria-valuenow", String(val));
      inp.setAttribute("aria-valuetext", `${val}%`);
    });
  }

  // Format toggle button
  slot<HTMLButtonElement>(root, "format-toggle")?.addEventListener("click", () => {
    const s = states.get(root);
    if (s == null) return;
    const order = ["hex", "rgb", "hsl"];
    const next = order[(order.indexOf(s.format) + 1) % order.length];
    if (next == null) return;
    s.format = next;
    root.setAttribute("data-lv-cp-format", next);
    applyFormatVisibility(root, next);
    // Update format-toggle button label
    const labels: Record<string, string> = { hex: "Hex", rgb: "RGB", hsl: "HSL" };
    const btn = slot<HTMLButtonElement>(root, "format-toggle");
    if (btn != null) {
      const label = labels[next] ?? "Hex";
      btn.setAttribute("aria-label", `Format: ${label}`);
      btn.textContent = label;
    }
    // Move focus to the first input of the new format
    if (next === "hex") slot<HTMLElement>(root, "hex-input")?.focus();
    else if (next === "rgb") slot<HTMLElement>(root, "channel-r")?.focus();
    else slot<HTMLElement>(root, "channel-h")?.focus();
  });

  // Swatch buttons: apply color on click/Enter/Space (not confirm)
  for (const sw of Array.from(slotAll<HTMLButtonElement>(root, "swatch"))) {
    sw.addEventListener("click", () => {
      const color = sw.getAttribute("data-color");
      if (color != null) applySwatchColor(root, color);
    });
  }

  // Eyedropper
  setupEyedropper(root);
}

/** Enhance every `[data-lv-color-picker]` root in scope. */
export function enhanceAllColorPickers(scope: ParentNode = document): void {
  scope
    .querySelectorAll<HTMLElement>("[data-lv-color-picker]")
    .forEach((root) => enhanceColorPicker(root));
}
