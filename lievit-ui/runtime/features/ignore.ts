/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * `l:ignore` (issue #157): exclude an element and its subtree from morphing, so third-party-managed
 * DOM (maps, editors, charts) survives a re-render untouched. Modifiers:
 * - `l:ignore` — freeze the element and its whole subtree (`skip`),
 * - `l:ignore.self` — freeze only the element itself; its children still morph (`children`),
 * - `l:ignore.children` — morph the element, freeze its children (`self`).
 *
 * Implemented purely through the {@link LievitRuntime.morphWith} morph-hook seam (ADR-0019): the
 * provider maps the live element's `l:ignore[.modifier]` attribute to a {@link MorphMode}; the morph
 * algorithm is not edited. Server-side: none (issue #157 acceptance).
 *
 * Note the deliberate inversion between the directive modifier and the morph mode: `l:ignore.self`
 * means "ignore the element itself" → morph mode `"children"` (morph the children only); and
 * `l:ignore.children` means "ignore the children" → mode `"self"` (morph the element only).
 */

import type { MorphMode } from "../morph.js";
import type { LievitRuntime } from "../runtime.js";

/** Reads the morph mode an element's `l:ignore` attribute requests, or undefined if none. */
function ignoreMode(el: Element): MorphMode | undefined {
  if (el.hasAttribute("l:ignore.self")) {
    return "children"; // ignore the element itself → keep morphing its children
  }
  if (el.hasAttribute("l:ignore.children")) {
    return "self"; // ignore the children → still morph the element itself
  }
  if (el.hasAttribute("l:ignore")) {
    return "skip"; // freeze the whole subtree
  }
  return undefined;
}

/**
 * Installs `l:ignore` on a runtime by registering a morph-hook provider.
 *
 * @param runtime the started runtime to extend
 * @returns an unsubscribe function that removes the provider
 */
export function installIgnore(runtime: LievitRuntime): () => void {
  return runtime.morphWith(() => ({
    // The live element carries the directive; the new (server) element does not need to (the server
    // re-renders the placeholder, but the user's third-party DOM is what must be preserved).
    elementMode: (oldEl) => ignoreMode(oldEl),
  }));
}
