/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * `lv-checkbox` -- the ONE irreducible client behaviour of the native checkbox primitive, as a
 * Stimulus controller (the conversion of `runtime/features/checkbox.enhancer.ts`). Mounted ON THE
 * `<input type="checkbox">` via `data-controller="lv-checkbox"`, which `checkbox.jte` stamps ONLY
 * when `indeterminate=true` -- so the controller's mere presence IS the tri-state signal (same
 * scope the enhancer's `input[type=checkbox][data-indeterminate=true]` selector had).
 *
 * The `indeterminate` DOM property is write-only from JavaScript: the HTML parser ignores an
 * `indeterminate` attribute, so the server cannot set it statically. The template renders
 * `data-indeterminate="true"` (the CSS `peer-data-[indeterminate=true]` hook for the dash glyph)
 * as the hydration signal; this controller mirrors it onto the live DOM property so the browser
 * reflects `aria-checked="mixed"`. There is no keyboard handling, no event wiring, no wire
 * round-trip: the native `<input>` supplies the entire APG Checkbox interaction model for free, so
 * this is NOT a {@link DismissableController} (nothing to dismiss, no focus to manage).
 *
 * Morph-safety (the whole point of the migration): Stimulus connects this controller exactly once
 * per input+identifier and disconnects it when the wire morph removes or replaces the input.
 *  - morph REPLACES the input node => old controller disconnects (clears the dying node, harmless),
 *    new node connects => indeterminate re-applied. (The enhancer needed an `afterCall` sweep for this.)
 *  - morph PRESERVES the input but drops `data-indeterminate` (now two-state) => the template no
 *    longer stamps `data-controller`, Stimulus disconnects => the property is cleared, so the DOM
 *    matches the new server state. (The enhancer only ever SET true and never cleared -- this is a
 *    strict improvement, not a regression.)
 * No `data-*-enhanced` marker, no `WeakSet`, no idempotency bookkeeping: Stimulus owns the lifecycle.
 *
 * APG source: https://www.w3.org/WAI/ARIA/apg/patterns/checkbox/examples/checkbox-mixed/
 */

import { Controller } from "@hotwired/stimulus";

export default class LvCheckboxController extends Controller<HTMLInputElement> {
  /** Mirror the server-declared tri-state onto the write-only DOM property (browser => aria-checked="mixed"). */
  connect(): void {
    this.element.indeterminate = true;
  }

  /** Clear the property when the input leaves (removed, or morphed back to a two-state checkbox). */
  disconnect(): void {
    this.element.indeterminate = false;
  }
}
