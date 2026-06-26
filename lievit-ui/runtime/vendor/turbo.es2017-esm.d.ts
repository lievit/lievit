/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * Minimal sibling types for the vendored Turbo Drive ESM build
 * ({@link ./turbo.es2017-esm.js}). lievit consumes Turbo through a LAZY dynamic import (the
 * `l:navigate` opt-in mounts it on first use, then flips `session.drive = false`) plus, occasionally,
 * the `visit` programmatic API. We declare only what lievit uses, not Turbo's whole surface: the dist
 * is the source of truth, this shim just lets `tsc` type the `import("./turbo.es2017-esm.js")` under
 * `moduleResolution: Bundler` + `verbatimModuleSyntax`.
 *
 * This file is a real module (top-level `export`s), so a dynamic `import()` of the sibling `.js`
 * resolves these types. Do NOT grow it into a full Turbo type definition: add only the symbol a new
 * use needs. Upstream ships no `.d.ts` for the dist build, hence this hand-written shim.
 */

/**
 * Performs a programmatic Turbo Drive visit (the JS equivalent of clicking a Drive link). Imported
 * only where lievit must navigate without a user click.
 */
export function visit(
  location: string | URL,
  options?: { action?: "advance" | "replace"; frame?: string },
): void;

/** Starts Turbo (idempotent). The dist already calls this on import; exported for completeness. */
export function start(): void;

/**
 * The Drive session. lievit sets `session.drive = false` right after the lazy import so Drive is
 * OPT-IN (it hijacks nothing globally); a link/form opts in with `data-turbo="true"` (set by the
 * `l:navigate` directive). The documented Turbo API (handbook/drive: "Opt-in Drive").
 */
export const session: { drive: boolean };
