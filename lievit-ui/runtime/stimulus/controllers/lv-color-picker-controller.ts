/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * `lv-color-picker` -- the composite color-selection control, as a Stimulus controller (the
 * conversion of `registry/jte/color-picker.enhancer.ts`). Mounted on the ROOT via
 * `data-controller="lv-color-picker"`. The whole widget (trigger, hidden native input, popover,
 * hex/RGB/HSL spinbuttons, alpha slider, swatch grid, eyedropper, confirm/cancel) is server-
 * rendered HTML; this controller owns ONLY the irreducible client responsibilities the spec §1
 * lists:
 *
 *   (a) CHANNEL SYNC: keep the hex input, R/G/B + H/S/L spinbuttons, alpha slider and the
 *       color-preview square in sync as the user edits any one of them (pure-client derived state,
 *       sub-keystroke latency -- a server round-trip per keystroke would break the UX).
 *   (b) POPOVER OPEN/CLOSE + FOCUS: open the native-popover panel on trigger click, move focus to
 *       the first visible input, return focus to the trigger on close (Esc / focusout / confirm /
 *       cancel). Focus capture/restore is delegated to the shared {@link DismissableController}.
 *   (c) SWATCH SELECTION: apply a preset color to the channels (NOT confirm) + live-region
 *       announce. The swatch roving-tabindex (ArrowLeft/Right/Home/End) is owned by the shared
 *       collection-nav enhancer via the swatch grid's `data-lievit-collection*` attributes; this
 *       controller does not touch it.
 *   (d) SPINBUTTON Home/End/PageUp/PageDown (APG Spinbutton keys browsers do not implement).
 *   (e) FORMAT TOGGLE: cycle hex -> rgb -> hsl visibility + labels.
 *   (f) EYEDROPPER: at connect, disable the button when the EyeDropper API is absent; otherwise
 *       open it on click.
 *
 * Controlled/uncontrolled doctrine: a color picker is ALWAYS uncontrolled -- its committed value
 * rides the hidden native `<input>` + the enclosing form, never a wire round-trip. The template
 * never stamps `data-lv-wire-close`, so the single close seam {@link DismissableController#dismissViaWire}
 * is a no-op (ZERO `/lievit/<id>/call`). Never hardcode a `"close"` fallback.
 *
 * Morph-safety: every element event is a `data-action` in the template (Stimulus re-binds them when
 * the wire morph re-renders the subtree) and the eyedropper-availability mutation runs in
 * `connect()`; there is NO manually-bound document listener and NO `data-lv-cp-enhanced` marker.
 * Stimulus connects this controller once per root and disconnects it on removal, so the old
 * WeakMap-of-roots + idempotency guard are gone.
 *
 * CSP-clean: no eval, no innerHTML, no inline handler -- DOM writes are `.value` / `.setAttribute`
 * / `.textContent` / `.style.backgroundColor`.
 */

import { DismissableController } from "../base/dismissable-controller.js";

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
// Channel + format wiring tables
// ---------------------------------------------------------------------------

/** Maps a format name to its format-group data-slot (visibility toggled per the active format). */
const FORMAT_GROUPS: Record<string, string> = { hex: "hex-group", rgb: "rgb-group", hsl: "hsl-group" };

/** APG Spinbutton supplemental-key config per channel (Home/End/PageUp/PageDown bounds + large step). */
interface SpinConfig {
  min: number;
  max: number;
  largeStep: number;
}

const SPIN_CONFIGS: Record<string, SpinConfig> = {
  "channel-r": { min: 0, max: 255, largeStep: 10 },
  "channel-g": { min: 0, max: 255, largeStep: 10 },
  "channel-b": { min: 0, max: 255, largeStep: 10 },
  "channel-h": { min: 0, max: 360, largeStep: 10 },
  "channel-s": { min: 0, max: 100, largeStep: 10 },
  "channel-l": { min: 0, max: 100, largeStep: 10 },
};

const FORMAT_ORDER = ["hex", "rgb", "hsl"] as const;
const FORMAT_LABELS: Record<string, string> = { hex: "Hex", rgb: "RGB", hsl: "HSL" };

export default class LvColorPickerController extends DismissableController<HTMLElement> {
  /** The last confirmed hex value (restored on cancel). */
  private confirmedHex = "#000000";
  /** The last confirmed alpha value (restored on cancel). */
  private confirmedAlpha = 100;
  /** Current live hex during editing (may differ from confirmedHex until confirm). */
  private liveHex = "#000000";
  /** Current display format: hex | rgb | hsl. */
  private format = "hex";

  connect(): void {
    this.liveHex = (this.slot<HTMLInputElement>("native-input")?.value ?? "#000000").toLowerCase();
    this.confirmedHex = this.liveHex;
    this.format = this.element.getAttribute("data-lv-cp-format") ?? "hex";

    // Seed all channels from the server-rendered value + reflect the initial format visibility.
    this.syncAll(this.liveHex, this.confirmedAlpha);
    this.applyFormatVisibility(this.format);
    this.setupEyedropper();
  }

  // --- popover open / close -------------------------------------------------------------------

  /** Trigger click: open the popover (no-op when the whole control is disabled). */
  open(): void {
    if (this.element.getAttribute("aria-disabled") === "true") {
      return;
    }
    const panel = this.slot<HTMLElement>("popover");
    if (panel == null) {
      return;
    }
    this.captureReturnFocus();
    this.slot<HTMLButtonElement>("trigger")?.setAttribute("aria-expanded", "true");

    const showPopover = (panel as HTMLElement & { showPopover?: () => void }).showPopover;
    if (typeof showPopover === "function") {
      showPopover.call(panel);
    } else {
      panel.removeAttribute("hidden");
      panel.style.display = "";
    }

    this.firstFormatInput()?.focus();
  }

  /** Esc inside the panel cancels (revert + close); other keys pass through. */
  onPanelKeydown(e: KeyboardEvent): void {
    if (e.key === "Escape") {
      e.preventDefault();
      this.cancel();
    }
  }

  /** Close when focus leaves the panel entirely (light-dismiss for the non-modal popover). */
  onPanelFocusout(e: FocusEvent): void {
    const panel = this.slot<HTMLElement>("popover");
    const related = e.relatedTarget as Node | null;
    if (panel != null && (related == null || !panel.contains(related))) {
      this.closePopover();
    }
  }

  /** The single close seam: hide the panel + restore focus to the trigger. NEVER wires (uncontrolled). */
  private closePopover(): void {
    const panel = this.slot<HTMLElement>("popover");
    this.slot<HTMLButtonElement>("trigger")?.setAttribute("aria-expanded", "false");

    if (panel != null) {
      const hidePopover = (panel as HTMLElement & { hidePopover?: () => void }).hidePopover;
      if (typeof hidePopover === "function") {
        try {
          hidePopover.call(panel);
        } catch {
          // hidePopover throws if already closed; ignore.
        }
      } else {
        panel.style.display = "none";
      }
    }

    // Controlled/uncontrolled doctrine lives in the base: a color picker carries no
    // data-lv-wire-close, so this is a no-op (ZERO round-trip). Never hardcode a "close" fallback.
    this.dismissViaWire();

    this.restoreReturnFocus();
    if (document.activeElement === document.body) {
      this.slot<HTMLButtonElement>("trigger")?.focus();
    }
  }

  // --- confirm / cancel -----------------------------------------------------------------------

  /** Confirm: write the live hex to the native input (form sync), update the trigger, close. */
  confirm(): void {
    const hex = this.liveHex;
    const alpha = parseInt(this.slot<HTMLInputElement>("alpha-input")?.value ?? "100", 10);
    this.confirmedHex = hex;
    this.confirmedAlpha = isNaN(alpha) ? 100 : alpha;

    const native = this.slot<HTMLInputElement>("native-input");
    if (native != null) {
      native.value = hex;
      native.dispatchEvent(new Event("input", { bubbles: true }));
      native.dispatchEvent(new Event("change", { bubbles: true }));
    }

    const trigger = this.slot<HTMLButtonElement>("trigger");
    if (trigger != null) {
      trigger.setAttribute("aria-label", `Pick color: ${hex}`);
      const textSpan = trigger.querySelector<HTMLElement>("[class*='font-mono']");
      if (textSpan != null) textSpan.textContent = hex;
      const swatchSpan = trigger.querySelector<HTMLElement>("[aria-hidden='true']");
      if (swatchSpan != null) swatchSpan.style.backgroundColor = hex;
    }

    this.closePopover();
  }

  /** Cancel: revert all channels to the last confirmed value, close without touching the form. */
  cancel(): void {
    this.syncAll(this.confirmedHex, this.confirmedAlpha);
    this.liveHex = this.confirmedHex;
    this.closePopover();
  }

  // --- channel editing ------------------------------------------------------------------------

  /** Hex text input: derive + sync every other representation. */
  onHexInput(): void {
    const hex = this.deriveHexFrom("hex-input");
    if (hex != null) {
      this.syncAll(hex, this.currentAlpha(), "hex-input");
    }
  }

  /** R/G/B/H/S/L spinbutton input: clamp, derive hex, sync. The edited channel is read from the event. */
  onChannelInput(e: Event): void {
    const inp = e.currentTarget as HTMLInputElement;
    const slotName = inp.getAttribute("data-slot") ?? "";
    const cfg = SPIN_CONFIGS[slotName];
    const raw = parseInt(inp.value, 10);
    if (cfg != null && !isNaN(raw)) {
      const clamped = clamp(raw, cfg.min, cfg.max);
      if (clamped !== raw) inp.value = String(clamped);
    }
    const hex = this.deriveHexFrom(slotName);
    if (hex != null) {
      this.syncAll(hex, this.currentAlpha(), slotName);
    }
  }

  /** APG Spinbutton supplemental keys (Home / End / PageUp / PageDown) on a channel input. */
  onChannelKeydown(e: KeyboardEvent): void {
    const inp = e.currentTarget as HTMLInputElement;
    const slotName = inp.getAttribute("data-slot") ?? "";
    const cfg = SPIN_CONFIGS[slotName];
    if (cfg == null) return;

    let current = parseInt(inp.value, 10);
    if (isNaN(current)) current = 0;

    let next: number | null = null;
    if (e.key === "Home")          next = cfg.min;
    else if (e.key === "End")      next = cfg.max;
    else if (e.key === "PageUp")   next = clamp(current + cfg.largeStep, cfg.min, cfg.max);
    else if (e.key === "PageDown") next = clamp(current - cfg.largeStep, cfg.min, cfg.max);

    if (next != null) {
      e.preventDefault();
      inp.value = String(next);
      inp.setAttribute("aria-valuenow", String(next));
      inp.dispatchEvent(new Event("input", { bubbles: true }));
    }
  }

  /** Alpha slider input: reflect aria-valuenow + aria-valuetext (the value already lives in .value). */
  onAlphaInput(e: Event): void {
    const inp = e.currentTarget as HTMLInputElement;
    const val = clamp(parseInt(inp.value, 10), 0, 100);
    inp.setAttribute("aria-valuenow", String(val));
    inp.setAttribute("aria-valuetext", `${val}%`);
  }

  // --- format toggle --------------------------------------------------------------------------

  /** Format-toggle click: cycle hex -> rgb -> hsl, swap visibility + label, move focus. */
  cycleFormat(): void {
    const next = FORMAT_ORDER[(FORMAT_ORDER.indexOf(this.format as (typeof FORMAT_ORDER)[number]) + 1) % FORMAT_ORDER.length];
    if (next == null) return;
    this.format = next;
    this.element.setAttribute("data-lv-cp-format", next);
    this.applyFormatVisibility(next);

    const btn = this.slot<HTMLButtonElement>("format-toggle");
    if (btn != null) {
      const label = FORMAT_LABELS[next] ?? "Hex";
      btn.setAttribute("aria-label", `Format: ${label}`);
      btn.textContent = label;
    }
    this.firstFormatInput()?.focus();
  }

  // --- swatch selection -----------------------------------------------------------------------

  /** Swatch click: apply the preset color to the channels (NOT confirm) + announce it. */
  onSwatchClick(e: Event): void {
    const color = (e.currentTarget as HTMLElement).getAttribute("data-color");
    if (color == null) return;
    this.syncAll(color, this.currentAlpha());
    const liveRegion = this.slot("live-region");
    if (liveRegion != null) liveRegion.textContent = `Color set to ${color}`;
  }

  // --- eyedropper -----------------------------------------------------------------------------

  /** Eyedropper click: open the EyeDropper API (no-op when unavailable / disabled). */
  onEyedropper(e: Event): void {
    const btn = e.currentTarget as HTMLButtonElement;
    if (btn.getAttribute("aria-disabled") === "true") return;
    const winAny = window as unknown as Record<string, unknown>;
    const Ctor = winAny["EyeDropper"];
    if (typeof Ctor !== "function") return;
    const EyeDropper = Ctor as new () => { open(): Promise<{ sRGBHex: string }> };
    void new EyeDropper().open().then((result) => {
      this.syncAll(result.sRGBHex, this.currentAlpha());
    });
  }

  // --- internals ------------------------------------------------------------------------------

  /** At connect, disable the eyedropper button when the platform has no EyeDropper API. */
  private setupEyedropper(): void {
    const btn = this.slot<HTMLButtonElement>("eyedropper-btn");
    if (btn == null) return;
    const hasApi = typeof (window as unknown as Record<string, unknown>)["EyeDropper"] === "function";
    if (!hasApi) {
      btn.setAttribute("aria-disabled", "true");
      btn.setAttribute("title", "Not supported in this browser");
    }
  }

  /** The first focusable input of the active format group (focus target on open + format change). */
  private firstFormatInput(): HTMLElement | null {
    if (this.format === "hex") return this.slot<HTMLElement>("hex-input");
    if (this.format === "rgb") return this.slot<HTMLElement>("channel-r");
    return this.slot<HTMLElement>("channel-h");
  }

  /** The current alpha value (defaults to 100 when there is no alpha slider). */
  private currentAlpha(): number {
    const alpha = parseInt(this.slot<HTMLInputElement>("alpha-input")?.value ?? "100", 10);
    return isNaN(alpha) ? 100 : alpha;
  }

  /** Show the active format group, hide (and aria-hide) the others. */
  private applyFormatVisibility(fmt: string): void {
    for (const [f, slotName] of Object.entries(FORMAT_GROUPS)) {
      const group = this.slot(slotName);
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

  /**
   * Derive the canonical hex from whichever channel the user edited. `null` for an invalid hex
   * (so the last valid state is kept rather than overwritten with garbage).
   */
  private deriveHexFrom(activeSlot: string): string | null {
    if (activeSlot === "hex-input") {
      const raw = this.slot<HTMLInputElement>("hex-input")?.value.trim() ?? "";
      const candidate = raw.startsWith("#") ? raw : `#${raw}`;
      return hexToRgb(candidate) != null ? candidate : null;
    }
    if (activeSlot === "channel-r" || activeSlot === "channel-g" || activeSlot === "channel-b") {
      const r = clamp(parseInt(this.slot<HTMLInputElement>("channel-r")?.value ?? "0", 10), 0, 255);
      const g = clamp(parseInt(this.slot<HTMLInputElement>("channel-g")?.value ?? "0", 10), 0, 255);
      const b = clamp(parseInt(this.slot<HTMLInputElement>("channel-b")?.value ?? "0", 10), 0, 255);
      return rgbToHex(r, g, b);
    }
    if (activeSlot === "channel-h" || activeSlot === "channel-s" || activeSlot === "channel-l") {
      const h = clamp(parseInt(this.slot<HTMLInputElement>("channel-h")?.value ?? "0", 10), 0, 360);
      const s = clamp(parseInt(this.slot<HTMLInputElement>("channel-s")?.value ?? "0", 10), 0, 100);
      const l = clamp(parseInt(this.slot<HTMLInputElement>("channel-l")?.value ?? "0", 10), 0, 100);
      const { r, g, b } = hslToRgb(h, s, l);
      return rgbToHex(r, g, b);
    }
    return null;
  }

  /**
   * Write every derived representation from a source hex: hex input, R/G/B + H/S/L spinbuttons
   * (value + aria), alpha aria, the color-preview square, and swatch aria-pressed. The input being
   * actively edited (`skipSlot`) keeps its in-progress text.
   */
  private syncAll(hex: string, alpha: number, skipSlot?: string): void {
    this.liveHex = hex;
    const rgb = hexToRgb(hex);
    if (rgb == null) return; // invalid hex: keep last valid state

    const { r, g, b } = rgb;
    const hsl = rgbToHsl(r, g, b);

    const hexInput = this.slot<HTMLInputElement>("hex-input");
    if (hexInput != null && skipSlot !== "hex-input") hexInput.value = hex;

    const setChannel = (slotName: string, val: number, text?: string): void => {
      const inp = this.slot<HTMLInputElement>(slotName);
      if (inp == null) return;
      if (skipSlot !== slotName) inp.value = String(val);
      inp.setAttribute("aria-valuenow", String(val));
      if (text != null) inp.setAttribute("aria-valuetext", text);
    };
    setChannel("channel-r", r);
    setChannel("channel-g", g);
    setChannel("channel-b", b);
    setChannel("channel-h", hsl.h, `Hue: ${hsl.h} degrees`);
    setChannel("channel-s", hsl.s, `Saturation: ${hsl.s}%`);
    setChannel("channel-l", hsl.l, `Lightness: ${hsl.l}%`);

    const alphaInput = this.slot<HTMLInputElement>("alpha-input");
    if (alphaInput != null) {
      if (alphaInput !== document.activeElement) alphaInput.value = String(alpha);
      alphaInput.setAttribute("aria-valuenow", String(alpha));
      alphaInput.setAttribute("aria-valuetext", `${alpha}%`);
    }

    const preview = this.slot<HTMLElement>("color-preview");
    if (preview != null) preview.style.backgroundColor = hex;

    for (const sw of Array.from(this.slotAll("swatch"))) {
      const swColor = sw.getAttribute("data-color") ?? "";
      sw.setAttribute("aria-pressed", swColor.toLowerCase() === hex.toLowerCase() ? "true" : "false");
    }
  }

  /** First descendant carrying `data-slot="<name>"` within this controller's root. */
  private slot<T extends HTMLElement = HTMLElement>(name: string): T | null {
    return this.element.querySelector<T>(`[data-slot="${name}"]`);
  }

  /** Every descendant carrying `data-slot="<name>"` within this controller's root. */
  private slotAll<T extends HTMLElement = HTMLElement>(name: string): NodeListOf<T> {
    return this.element.querySelectorAll<T>(`[data-slot="${name}"]`);
  }
}
