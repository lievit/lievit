/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * `lv-form` -- the server-first form's ONE client behaviour: after a failed submit, move focus to
 * the validation-error summary so keyboard / screen-reader users land on the error list immediately
 * (form.jte's documented `focusOnError` contract). Mounted on the `<form>` ROOT via
 * `data-controller="lv-form"`.
 *
 * Everything else the form does is server-rendered or runtime-generic: validation runs server-side,
 * the error summary's visibility is gated by the `hidden` attribute the server stamps, and submit
 * rides the lievit wire (or a native POST when JS is off). This controller adds NO state, NO wire
 * round-trip, and NO markup -- it only honours the `data-lv-autofocus` marker the server places on
 * the summary when `focusOnError && hasError`.
 *
 * Controlled / uncontrolled doctrine: a form is NOT a dismissable overlay, so it has no close action
 * and never touches the wire bridge -- it cannot fire a spurious round-trip by construction (so it
 * extends the plain Stimulus `Controller`, not `DismissableController`). The shadcn `data-slot`
 * namespace on the form/summary is untouched; only the established `data-lv-autofocus` lievit marker
 * (shared with the popover) drives the focus.
 *
 * Two focus triggers, both morph-safe (bound in `connect`, torn down in `disconnect`):
 * 1. `connect()` -- the initial render, a full-page reload after a native POST, or a wire morph that
 *    REPLACED the `<form>` element: the server-rendered summary already carries `data-lv-autofocus`.
 * 2. the `lievit:validation-errors` window event -- a wire submit that returns errors morphs a
 *    PRESERVED `<form>` (idiomorph keeps it by id), so `connect()` does NOT re-fire. The runtime
 *    dispatches this event on `window` for every errors effect; re-running the focus check then
 *    covers that path. {@link focusAutofocusTarget} defers the lookup to a microtask, so it sees the
 *    marker the morph adds right after the event (#93 effects-then-morph order).
 *
 * Morph-safety is Stimulus's, not ours: no `data-*-enhanced` marker, no `WeakSet`, no `afterCall`
 * sweep -- `disconnect()` removes the one window listener when the form leaves the DOM.
 */

import { Controller } from "@hotwired/stimulus";
import { focusAutofocusTarget } from "../base/focus-trap.js";
import { VALIDATION_EFFECT_EVENT } from "../../effects.js";

export default class LvFormController extends Controller<HTMLElement> {
  /** Object-identity handler stored once so `disconnect()` removes exactly what `connect()` added. */
  private readonly onValidationErrors = (): void => focusAutofocusTarget(this.element);

  connect(): void {
    // Initial render / native-POST reload / a morph that replaced the form: marker already present.
    focusAutofocusTarget(this.element);
    // A wire submit that re-renders a PRESERVED form fires this on window after the morph adds the
    // marker; re-check then. Removed in disconnect() => no leaked listener across morphs.
    window.addEventListener(VALIDATION_EFFECT_EVENT, this.onValidationErrors);
  }

  disconnect(): void {
    window.removeEventListener(VALIDATION_EFFECT_EVENT, this.onValidationErrors);
  }
}
