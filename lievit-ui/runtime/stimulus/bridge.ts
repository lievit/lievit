/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * The Stimulus -> lievit-wire bridge. A Stimulus {@link Controller} cannot be constructor-injected
 * (the Stimulus {@link Application} instantiates controllers itself), so the started
 * {@link LievitRuntime} is published here as a module singleton by the bootstrap
 * ({@link startStimulus} calls {@link setStimulusRuntime}), and controllers reach it through the
 * single CSP-clean helper {@link callWire}. No global `window.$lievit`, no `eval`, no inline handler.
 *
 * This is the ONLY place a controller talks to the server. Keeping it one function means the
 * controlled/uncontrolled doctrine (DismissableController) and every converted component share one
 * wire seam, and a test can swap the runtime for a fetch stub by calling {@link setStimulusRuntime}.
 */

import type { LievitRuntime } from "../runtime.js";
import type { CallMeta } from "../lifecycle.js";

/** The component-root marker the runtime stamps; a wire call is addressed to the enclosing one. */
const COMPONENT_ATTR = "data-lievit-component";

let runtimeRef: LievitRuntime | null = null;

/**
 * Publishes the started runtime so controllers can reach it. Called once by {@link startStimulus};
 * a test calls it directly with a stub-backed runtime.
 *
 * @param runtime the started runtime, or `null` to clear it (test teardown)
 */
export function setStimulusRuntime(runtime: LievitRuntime | null): void {
  runtimeRef = runtime;
}

/** The runtime published by the bootstrap, or `null` before {@link startStimulus} ran. */
export function getStimulusRuntime(): LievitRuntime | null {
  return runtimeRef;
}

/**
 * Fires a wire action on the component that ENCLOSES `el`, the controlled-overlay close seam. A
 * no-op (returns false) when no runtime is published or `action` is blank, so an UNCONTROLLED
 * caller that passes an empty action never round-trips (the controlled/uncontrolled doctrine: the
 * spurious "close" on an uncontrolled overlay is exactly the wire-410 page-expired bug).
 *
 * @param el     an element inside the target component (the panel / trigger)
 * @param action the wire action name; blank/undefined => no call
 * @param meta   optional call meta (e.g. `{ trigger }`)
 * @returns true when a call was dispatched, false when it was a no-op
 */
export function callWire(el: Element, action: string | null | undefined, meta?: CallMeta): boolean {
  const runtime = runtimeRef;
  if (runtime == null || action == null || action.length === 0) {
    return false;
  }
  const root = el.closest(`[${COMPONENT_ATTR}]`) ?? el;
  void runtime.callAction(root, action, meta ?? { trigger: el });
  return true;
}
