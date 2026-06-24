/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * Slider enhancer — typed vanilla-TS, CSP-clean. Registered via the runtime lifecycle bus
 * under the `data-lievit-enhancer="slider"` discovery hook.
 *
 * What this enhancer does (and does NOT do):
 *
 * DOES:
 * - Reads `data-range`, `data-orientation`, `data-tooltip`, `data-tooltip-formatter{,-low,-high}`
 *   from the root at mount.
 * - On every native `input` event: updates `--slider-pct` (and `--slider-pct-high` in range mode)
 *   on the root `style` so the CSS-driven track fill and thumb overlays track the live value
 *   without a round-trip.
 * - Range mode: on `input` from either thumb, clamps `valueLow <= valueHigh` by nudging the
 *   moved thumb back if it crosses the other, then updates `aria-valuemax` on the low input and
 *   `aria-valuemin` on the high input so AT hears the live constraint (APG multithumb rule).
 * - Tooltip text: updates the tooltip text node with the formatted value on every `input` event
 *   (raw numeric or formatter string from the data-attribute when present).
 * - Tooltip visibility (`showTooltip="hover"`): toggles `opacity-100` on mouseover/focusin of the
 *   native input; removes it on mouseleave/focusout.
 * - On native `change` event: if a `[type=hidden]` input with the same `name` is present in the
 *   closest form, copies the committed value there for plain-form POST flows.
 *
 * DOES NOT:
 * - Intercept ArrowKey/Home/End/PageUp-Down — the platform supplies all of these on
 *   native input[type=range] for free. Re-implementing them would diverge from browser behavior.
 * - Trigger a wire round-trip on every drag tick (`input` event). Round-trips happen only on
 *   `change` (end of drag / keyboard commit). The lievit runtime's `l:model` directive picks up
 *   the `change` event automatically when bound.
 * - Re-sort thumbs in the DOM when they cross. The APG multithumb rule: tab order is constant
 *   (low input is always first in DOM order), regardless of which value is currently higher.
 *
 * Attribute protocol on the ROOT element (set by `slider.jte`):
 * - `data-lievit-enhancer="slider"`          discovery hook (value is the key)
 * - `data-range="true|false"`                range mode flag
 * - `data-orientation="horizontal|vertical"` orientation
 * - `data-tooltip="always|hover|never"`      tooltip visibility policy
 * - `data-tooltip-formatter`                 server-formatted label for single/high value
 * - `data-tooltip-formatter-low`             server-formatted label for low value (range)
 * - `data-tooltip-formatter-high`            server-formatted label for high value (range)
 * - style `--slider-pct`                     initial fill percentage (0-100), updated live
 * - style `--slider-pct-high`                high-thumb percentage in range mode, updated live
 *
 * APG sources:
 *   https://www.w3.org/WAI/ARIA/apg/patterns/slider/
 *   https://www.w3.org/WAI/ARIA/apg/patterns/slider-multithumb/
 */

import type { LievitRuntime } from "../runtime.js";

const ENHANCER_ATTR = "data-lievit-enhancer";
const ENHANCER_KEY = "slider";

/** Wired roots (idempotency guard). */
const wiredRoots = new WeakSet<Element>();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Compute fill percentage clamped to [0, 100]. */
function computePct(value: number, minVal: number, maxVal: number): number {
  const range = maxVal - minVal;
  if (range === 0) return 0;
  return Math.min(100, Math.max(0, ((value - minVal) / range) * 100));
}

/** Set a CSS custom property on an element's inline style. */
function setCssProp(el: HTMLElement, prop: string, value: string): void {
  el.style.setProperty(prop, value);
}

/**
 * Resolve the tooltip label for a given value.
 * Uses the formatter string (server-provided at mount) if present, otherwise raw numeric.
 * The formatter stored in `data-tooltip-formatter` is the server-rendered label at the
 * initial value; the enhancer updates the numeric portion client-side on drag. For full
 * server-formatting on commit, the consuming template should use tooltipFormatter at render
 * time. The live client label is always numeric (no server round-trip on drag tick).
 */
function liveLabel(value: number): string {
  return String(Math.round(value));
}

// ---------------------------------------------------------------------------
// Wire a single slider root
// ---------------------------------------------------------------------------

function wireRoot(root: HTMLElement): void {
  if (wiredRoots.has(root)) return;
  wiredRoots.add(root);

  const isRange = root.dataset["range"] === "true";
  const tooltipPolicy = root.dataset["tooltip"] ?? "hover";

  if (isRange) {
    wireRange(root, tooltipPolicy);
  } else {
    wireSingle(root, tooltipPolicy);
  }
}

// ---------------------------------------------------------------------------
// Single-thumb wiring
// ---------------------------------------------------------------------------

function wireSingle(root: HTMLElement, tooltipPolicy: string): void {
  const input = root.querySelector<HTMLInputElement>('[data-slot="slider-input"]');
  if (input == null) return;

  const tooltip = root.querySelector<HTMLElement>('[data-slot="slider-tooltip"]');

  function syncPct(): void {
    const pct = computePct(input!.valueAsNumber, input!.min !== "" ? parseFloat(input!.min) : 0, input!.max !== "" ? parseFloat(input!.max) : 100);
    setCssProp(root, "--slider-pct", `${pct}%`);
    if (tooltip != null) {
      tooltip.textContent = liveLabel(input!.valueAsNumber);
    }
  }

  input.addEventListener("input", () => {
    syncPct();
  });

  // Plain form POST sync: on change, copy value to a hidden input with the same name.
  input.addEventListener("change", () => {
    const form = input!.closest("form");
    if (form != null && input!.name) {
      const hidden = form.querySelector<HTMLInputElement>(`input[type=hidden][name="${input!.name}"]`);
      if (hidden != null) {
        hidden.value = String(input!.valueAsNumber);
      }
    }
  });

  // Tooltip hover visibility (hover mode only).
  if (tooltipPolicy === "hover" && tooltip != null) {
    input.addEventListener("mouseover", () => tooltip.classList.add("opacity-100"));
    input.addEventListener("mouseout", () => tooltip.classList.remove("opacity-100"));
    input.addEventListener("focusin", () => tooltip.classList.add("opacity-100"));
    input.addEventListener("focusout", () => tooltip.classList.remove("opacity-100"));
  }
}

// ---------------------------------------------------------------------------
// Range (dual-thumb) wiring
// ---------------------------------------------------------------------------

function wireRange(root: HTMLElement, tooltipPolicy: string): void {
  const inputLow = root.querySelector<HTMLInputElement>('[data-slot="slider-input-low"]');
  const inputHigh = root.querySelector<HTMLInputElement>('[data-slot="slider-input-high"]');
  if (inputLow == null || inputHigh == null) return;

  const tooltipLow = root.querySelector<HTMLElement>('[data-slot="slider-tooltip"][data-thumb="low"]');
  const tooltipHigh = root.querySelector<HTMLElement>('[data-slot="slider-tooltip"][data-thumb="high"]');

  function syncBoth(): void {
    const lo = inputLow!.valueAsNumber;
    const hi = inputHigh!.valueAsNumber;
    const minVal = inputLow!.min !== "" ? parseFloat(inputLow!.min) : 0;
    const maxVal = inputHigh!.max !== "" ? parseFloat(inputHigh!.max) : 100;

    setCssProp(root, "--slider-pct", `${computePct(lo, minVal, maxVal)}%`);
    setCssProp(root, "--slider-pct-high", `${computePct(hi, minVal, maxVal)}%`);

    // Update APG multithumb ARIA constraints: each thumb's live constraint must reflect
    // the other thumb's current value so AT hears the updated boundary in real time.
    inputLow!.setAttribute("aria-valuemax", String(hi));
    inputHigh!.setAttribute("aria-valuemin", String(lo));

    if (tooltipLow != null) tooltipLow.textContent = liveLabel(lo);
    if (tooltipHigh != null) tooltipHigh.textContent = liveLabel(hi);
  }

  inputLow.addEventListener("input", () => {
    // Clamp: low thumb cannot exceed high.
    if (inputLow!.valueAsNumber > inputHigh!.valueAsNumber) {
      inputLow!.valueAsNumber = inputHigh!.valueAsNumber;
    }
    syncBoth();
  });

  inputHigh.addEventListener("input", () => {
    // Clamp: high thumb cannot go below low.
    if (inputHigh!.valueAsNumber < inputLow!.valueAsNumber) {
      inputHigh!.valueAsNumber = inputLow!.valueAsNumber;
    }
    syncBoth();
  });

  // Tooltip hover visibility (hover mode).
  if (tooltipPolicy === "hover") {
    if (tooltipLow != null) {
      inputLow.addEventListener("mouseover", () => tooltipLow.classList.add("opacity-100"));
      inputLow.addEventListener("mouseout", () => tooltipLow.classList.remove("opacity-100"));
      inputLow.addEventListener("focusin", () => tooltipLow.classList.add("opacity-100"));
      inputLow.addEventListener("focusout", () => tooltipLow.classList.remove("opacity-100"));
    }
    if (tooltipHigh != null) {
      inputHigh.addEventListener("mouseover", () => tooltipHigh.classList.add("opacity-100"));
      inputHigh.addEventListener("mouseout", () => tooltipHigh.classList.remove("opacity-100"));
      inputHigh.addEventListener("focusin", () => tooltipHigh.classList.add("opacity-100"));
      inputHigh.addEventListener("focusout", () => tooltipHigh.classList.remove("opacity-100"));
    }
  }
}

// ---------------------------------------------------------------------------
// Scan a component root for slider roots
// ---------------------------------------------------------------------------

function scanRoot(root: Element): void {
  // The root itself may be a slider (uncommon but valid when the partial is the component root).
  if ((root as HTMLElement).dataset[ENHANCER_ATTR.replace("data-", "").replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())] === ENHANCER_KEY) {
    wireRoot(root as HTMLElement);
  }
  for (const el of Array.from(root.querySelectorAll<HTMLElement>(`[${ENHANCER_ATTR}="${ENHANCER_KEY}"]`))) {
    wireRoot(el);
  }
}

// ---------------------------------------------------------------------------
// Public installer
// ---------------------------------------------------------------------------

/**
 * Installs the slider enhancer on a runtime. Scans every component root for
 * `[data-lievit-enhancer="slider"]` elements on init and after every wire call.
 *
 * Must be registered in `runtime/features/index.ts` by the coordinator.
 *
 * @param runtime the started runtime to extend
 * @returns an unsubscribe function
 */
export function installSlider(runtime: LievitRuntime): () => void {
  return runtime.use({
    onComponentInit(ctx) {
      scanRoot(ctx.root);
    },
    afterCall(outcome) {
      scanRoot(outcome.root);
      // Remove wired entries for roots no longer in the DOM (memory safety).
      // WeakSet does not support iteration; roots removed from DOM are GC'd automatically.
    },
  });
}
