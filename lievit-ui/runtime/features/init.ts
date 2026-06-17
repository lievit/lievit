/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * `l:init="action"`: fire an `@LievitAction` once, as soon as the element is bound (the Livewire
 * `wire:init` parity). Useful to kick off a deferred load right after mount without a user gesture
 * (often paired with `l:show`/lazy placeholders). Idempotent: it fires at most once per element
 * (guarded by the directive registry's bind-once marker plus a fired marker).
 *
 * Server-side: none — `l:init` invokes an ordinary action through the existing wire pipeline; the
 * server sees a normal call. Implemented as a directive on the public registry (ADR-0019).
 */

import type { LievitRuntime } from "../runtime.js";

const NAME = "init";
/** Marks an element whose init action already fired, so a re-scan after a morph does not re-fire. */
const FIRED_ATTR = "data-lievit-init-fired";

/**
 * Installs `l:init` on a runtime.
 *
 * @param runtime the started runtime to extend
 */
export function installInit(runtime: LievitRuntime): void {
  runtime.directives.register({
    name: NAME,
    bind(element, _attribute, value, rt) {
      if (element.hasAttribute(FIRED_ATTR)) {
        return;
      }
      element.setAttribute(FIRED_ATTR, "");
      // Defer to a microtask so the whole component subtree is bound before the action fires
      // (the action's re-render then sees a fully wired component).
      queueMicrotask(() => rt.callAction(element, value, { trigger: element, init: true }));
    },
  });
}
