/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * `l:confirm="message"` (issue #83): show a native confirmation dialog before a destructive action
 * runs; on cancel the action is aborted. `l:confirm.prompt="message|requiredText"` requires the user
 * to type a matching string (a stricter guard for irreversible deletes). Works on `l:click` actions
 * and `l:submit` forms because it gates the runtime's action pipeline via the
 * {@link LievitRuntime.intercept} seam (ADR-0019), not by re-binding the element.
 *
 * Server-side: none (issue #83 acceptance). The whole feature is the interceptor below: it reads the
 * trigger element's `l:confirm` attribute and returns `false` to abort the wire call on cancel /
 * prompt-mismatch, which the core loop honors WITHOUT any network traffic or lifecycle phases.
 *
 * CSP-safe: it calls `window.confirm` / `window.prompt`, never `eval`.
 */

import type { LievitRuntime } from "../runtime.js";

/** Dialog functions, injectable for tests (defaults to the browser's `confirm`/`prompt`). */
export interface ConfirmDialogs {
  readonly confirm: (message: string) => boolean;
  readonly prompt: (message: string) => string | null;
}

const DEFAULT_DIALOGS: ConfirmDialogs = {
  confirm: (message) => window.confirm(message),
  prompt: (message) => window.prompt(message),
};

/** Finds the `l:confirm[.prompt]` attribute on the trigger element or its closest ancestor. */
function confirmAttr(trigger: Element): { value: string; prompt: boolean } | null {
  const el = trigger.closest("[l\\:confirm], [l\\:confirm\\.prompt]");
  if (el == null) {
    return null;
  }
  const prompt = el.getAttribute("l:confirm.prompt");
  if (prompt != null) {
    return { value: prompt, prompt: true };
  }
  const plain = el.getAttribute("l:confirm");
  return plain != null ? { value: plain, prompt: false } : null;
}

/**
 * Installs `l:confirm` on a runtime: registers a single action interceptor.
 *
 * @param runtime the started runtime to extend
 * @param dialogs the confirm/prompt functions (defaults to the browser's; injectable for tests)
 * @returns an unsubscribe function that removes the interceptor
 */
export function installConfirm(
  runtime: LievitRuntime,
  dialogs: ConfirmDialogs = DEFAULT_DIALOGS,
): () => void {
  return runtime.intercept((ctx) => {
    const trigger = ctx.meta?.trigger;
    if (trigger == null) {
      return true; // no triggering element to read the directive from: let it through.
    }
    const spec = confirmAttr(trigger);
    if (spec == null) {
      return true;
    }
    if (spec.prompt) {
      // "message|requiredText": the user must type requiredText to proceed.
      const sep = spec.value.lastIndexOf("|");
      const message = sep >= 0 ? spec.value.slice(0, sep) : spec.value;
      const required = sep >= 0 ? spec.value.slice(sep + 1) : "";
      const typed = dialogs.prompt(message);
      return typed === required;
    }
    return dialogs.confirm(spec.value);
  });
}
