/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * color-picker enhancer (ADR-0012, server-first + progressive enhancement): the CSP-clean typed-TS
 * that UPGRADES the server-rendered `lievit/color-picker.jte` partial. The native <input
 * type="color"> is the form-bound source of truth and works with zero JS; this module only ADDS
 * two conveniences: clicking a preset swatch writes its colour into the native input (firing native
 * input/change so l:model + forms see it), and the hex readout stays in sync as the colour changes.
 * It never owns the value -- the native input POSTs identically whether or not JS ran.
 *
 * No inline script (the strict CSP refuses inline on* handlers; this attaches listeners in code).
 *
 * Idempotent: {@link enhanceColorPicker} marks each root and skips an already-enhanced one;
 * {@link enhanceAllColorPickers} wires every root on the page (call on load + after a DOM swap).
 */

const ENHANCED = "data-color-picker-enhanced";

/** Enhance one color-picker root. No-op if it has no native input or is already enhanced. */
export function enhanceColorPicker(root: HTMLElement): void {
  if (root.hasAttribute(ENHANCED)) return;
  const input = root.querySelector<HTMLInputElement>("[data-color-picker-input]");
  if (!input) return;
  root.setAttribute(ENHANCED, "");

  const readout = root.querySelector<HTMLElement>("[data-color-picker-value]");
  const presets = Array.from(
    root.querySelectorAll<HTMLButtonElement>("[data-color-picker-preset]"),
  );

  const syncReadout = (): void => {
    if (readout) readout.textContent = input.value;
  };

  for (const preset of presets) {
    preset.addEventListener("click", () => {
      const color = preset.getAttribute("data-color-picker-preset");
      if (!color || input.disabled) return;
      input.value = color;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      syncReadout();
    });
  }

  input.addEventListener("input", syncReadout);
  syncReadout();
}

/** Enhance every `[data-lievit-color-picker]` root in scope. */
export function enhanceAllColorPickers(scope: ParentNode = document): void {
  scope
    .querySelectorAll<HTMLElement>("[data-lievit-color-picker]")
    .forEach((root) => enhanceColorPicker(root));
}
