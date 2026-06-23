/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * Minimal ambient types for the vendored Turbo Drive ESM build
 * ({@link ./turbo.es2017-esm.js}). lievit consumes Turbo as a side-effect import (it auto-`start()`s
 * Drive on load) plus, occasionally, the `visit` programmatic API. We declare only what lievit uses,
 * not Turbo's whole surface: the dist is the source of truth, this shim just lets `tsc` accept the
 * `.js` import under `moduleResolution: Bundler` + `verbatimModuleSyntax`.
 *
 * Do NOT grow this into a full Turbo type definition. If a new Turbo API is needed, add only that
 * symbol here. Upstream ships no `.d.ts` for the dist build, hence this hand-written shim.
 */
declare module "./turbo.es2017-esm.js" {
  /**
   * Performs a programmatic Turbo Drive visit (the JS equivalent of clicking a Drive link). Imported
   * only where lievit must navigate without a user click; the common path is the side-effect import.
   */
  export function visit(
    location: string | URL,
    options?: { action?: "advance" | "replace"; frame?: string },
  ): void;

  /** Starts Turbo (idempotent). The dist already calls this on import; exported for completeness. */
  export function start(): void;
}
