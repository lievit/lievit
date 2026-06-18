/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * Error-responses UX: the page-expired dialog (#103, ADR-0051). When a wire call fails because the
 * snapshot/session expired (`409 snapshot-expired`, `410` class-gone) or the CSRF token went stale
 * (`403`, excluding the `locked-property` tamper case), the runtime shows a native
 * "this page has expired, reload?" confirm and reloads on accept, instead of leaving a broken UI or
 * flashing an HTML error overlay. The dialog is deduped to once across concurrent failures (two
 * islands expiring at the same time prompt once, not twice).
 *
 * It composes the request-lifecycle seams (ADR-0019/0024), never the core loop:
 * - `onExpired` (#103 seam): the `409`/`410` reload-recovery path. The feature `preventDefault()`s
 *   the default hard re-mount and runs the dialog instead, so it OWNS the recovery.
 * - `onError`: the `403`-CSRF path (no remount happens for a 403; the feature surfaces the dialog).
 *
 * Apps override by registering their own interceptor BEFORE this one and calling
 * `control.preventDefault()` in `onExpired` (the fail hook): this feature then sees the recovery
 * already owned and stays silent.
 *
 * CSP-safe: it calls `window.confirm` and `location.reload`, never `eval`.
 */

import type { LievitRuntime } from "../runtime.js";

/** Dialog + reload functions, injectable for tests (default to the browser's). */
export interface PageExpiredOptions {
  /** Shows the confirm; returns true to reload (defaults to `window.confirm`). */
  readonly confirm?: (message: string) => boolean;
  /** Reloads the host page (defaults to `location.reload`). */
  readonly reload?: () => void;
  /** The dialog message (defaults to the Livewire-parity copy). */
  readonly message?: string;
}

const DEFAULT_MESSAGE = "This page has expired. Reload?";

/**
 * Whether an HTTP status means the session/snapshot expired (so the recovery is a reload, not an
 * error overlay): `409` (snapshot expired), `410` (component class gone across a deploy), `403`
 * (CSRF token invalid/missing). A `403` carrying the `locked-property` reason is a tamper guard, not
 * an expiry, so the feature excludes it by reason (this predicate stays coarse for the status test).
 */
export function isExpiredStatus(status: number): boolean {
  return status === 409 || status === 410 || status === 403;
}

/** A 403 that is the CSRF/session-stale case, NOT the locked-property tamper guard (same status). */
function isCsrfExpiry(status: number, reason: string | null): boolean {
  return status === 403 && reason !== "locked-property";
}

/**
 * Installs the page-expired dialog on a runtime.
 *
 * @param runtime the started runtime to extend
 * @param options the confirm/reload functions + message (injectable for tests)
 * @returns an unsubscribe that removes the interceptor
 */
export function installPageExpired(runtime: LievitRuntime, options: PageExpiredOptions = {}): () => void {
  const confirm = options.confirm ?? ((message: string) => window.confirm(message));
  const reload = options.reload ?? (() => window.location.reload());
  const message = options.message ?? DEFAULT_MESSAGE;

  // Dedup across concurrent failures: once a dialog is in flight (or resolved), no second prompt.
  let prompting = false;

  function promptOnce(): void {
    if (prompting) {
      return;
    }
    prompting = true;
    if (confirm(message)) {
      reload();
    }
  }

  return runtime.intercept({
    // The 409/410 reload-recovery path: own it (suppress the hard remount) and show the dialog,
    // UNLESS an app's fail hook already took over the recovery (its `preventDefault` ran first).
    onExpired: (control) => {
      if (control.defaultPrevented()) {
        return; // an app handler owns the recovery; stay silent.
      }
      control.preventDefault();
      promptOnce();
    },
    // The 403-CSRF path: no remount fires for a 403, so surface the dialog here (skip locked-property).
    onError: (outcome) => {
      if (isCsrfExpiry(outcome.status, outcome.reason)) {
        promptOnce();
      }
    },
  });
}
