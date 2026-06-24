/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * Checkbox enhancer: sets the `indeterminate` DOM property on native
 * `<input type="checkbox">` elements that carry `data-indeterminate="true"`.
 *
 * The `indeterminate` DOM property is write-only from JavaScript -- the HTML parser ignores
 * an `indeterminate` attribute, so the server cannot set it statically. The template stamps
 * `data-indeterminate="true"` on the `<input>` as a hydration signal; this enhancer reads
 * that attribute after mount (and after each morph) and sets `el.indeterminate = true` so
 * the browser reflects `aria-checked="mixed"` correctly.
 *
 * This is the ONE irreducible client behavior for the checkbox partial (spec §6). No custom
 * keyboard handling, no state management, no event listeners beyond what the platform supplies
 * natively. The APG Checkbox interaction model is fully covered by the native `<input>`.
 *
 * APG source: https://www.w3.org/WAI/ARIA/apg/patterns/checkbox/examples/checkbox-mixed/
 *
 * Lifecycle integration (mirrors focus-trap.enhancer.ts):
 * - `onComponentInit`: fires when the runtime first binds a component root (initial page scan
 *   and when a morph introduces a NEW component root). Covers page load.
 * - `afterCall`: fires after every successful wire call (after the morph patches the DOM).
 *   Covers re-applying indeterminate on EXISTING component roots whose DOM was morphed.
 *
 * The coordinator wires `installCheckbox` into `runtime/features/index.ts` so the app's
 * `installAllFeatures` call picks it up.
 *
 * Idempotency: setting `el.indeterminate = true` twice is harmless. The querySelectorAll
 * returns an empty NodeList when no indeterminate checkboxes are present (no-op for both hooks).
 */

import type { LievitRuntime } from "../runtime.js";

/** The CSS selector for inputs that need the indeterminate DOM property set. */
const SELECTOR = 'input[type="checkbox"][data-indeterminate="true"]';

/**
 * Scans `root` for checkbox inputs with `data-indeterminate="true"` and sets the
 * `indeterminate` DOM property on each. Idempotent and scoped to the component root.
 */
function applyIndeterminate(root: Element): void {
  root.querySelectorAll<HTMLInputElement>(SELECTOR).forEach((el) => {
    el.indeterminate = true;
  });
}

/**
 * Installs the checkbox indeterminate enhancer on a started {@link LievitRuntime}.
 *
 * Call this from your `main.ts` alongside `installAllFeatures`, or include it in a
 * custom `installAllFeatures` wrapper. The enhancer is a no-op when no checkbox with
 * `data-indeterminate="true"` is present in the component tree.
 *
 * @param runtime the started runtime to extend
 * @returns an unsubscribe function (removes the lifecycle hook)
 */
export function installCheckbox(runtime: LievitRuntime): () => void {
  return runtime.use({
    // Fires on initial page scan and when a morph introduces a new component root.
    onComponentInit({ root }): void {
      applyIndeterminate(root);
    },
    // Fires after every successful wire call, after the morph patches the existing DOM.
    // Re-applies indeterminate on existing component roots whose inputs were replaced by the morph.
    afterCall({ root }): void {
      applyIndeterminate(root);
    },
  });
}
