/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
import type { LievitRuntime } from "../../../runtime/index.js";

/**
 * The CSP-clean typed-TS enhancer for the server-first rich-select / Combobox WIRE component
 * (ADR-0012, roadmap L1). It is the one irreducible client bit: WAI-ARIA APG Combobox keyboard
 * navigation. The catalog, the filter, the selection, the chips and the create affordance all live
 * server-side (the JTE template re-renders on every wire round-trip); but ArrowUp/ArrowDown to move
 * the active option, Enter to activate it, and Home/End are a pure client gesture the server cannot
 * see, so this module captures them on the search input and drives the existing server-rendered
 * options (it clicks the active `[role=option]`, which fires its `l:click` $set arm). There is NO
 * Lit, NO inline `<script>` (the strict CSP refuses inline handlers, the bug the pivot exists to
 * kill): it is `addEventListener` only.
 *
 * Why a TS module and not a wire directive: roving `aria-activedescendant` over a server-rendered
 * listbox + key-to-activate has no server-side equivalent (the keystrokes never reach the wire). This
 * mirrors the blueprint's "escape-hatch = a typed-TS micro-enhancement, not a shipped Lit island",
 * the exact seam the calendar / context-menu enhancers use. Activation re-uses the option's own
 * server `l:click` (a synthetic click), so the selection / toggle / create logic stays 100% on the
 * server; the enhancer only moves focus intent.
 *
 * Usage (the adopter calls this once from main.ts after starting the runtime):
 * ```ts
 * import { startLievit } from "lievit";
 * import { enhanceRichSelects } from "./components/ui/rich-select.js";
 * const runtime = startLievit();
 * enhanceRichSelects(runtime);
 * ```
 */

/** The subset of the runtime the enhancer needs (kept narrow so the signature is stable). */
type RuntimeLike = Pick<LievitRuntime, "$lievit">;

/** Marks a rich-select root so the listeners are wired exactly once per element. */
const WIRED = "data-rich-select-wired";

/** Marks the currently active (keyboard-focused) option for aria-activedescendant. */
const ACTIVE = "data-rich-select-active";

/**
 * Wires every `[data-rich-select]` root under `root` so the search input drives the listbox by
 * keyboard. Idempotent: a root already wired is skipped, so calling this after a morph that
 * re-rendered the component is safe (the listeners live on the stable root, the morph re-uses it).
 *
 * @param runtime the started lievit runtime (unused today, kept for parity with the other enhancers
 *     and so a future Escape -> $set('query','') can reach the wire)
 * @param root the DOM subtree to scan (defaults to `document`)
 * @returns a teardown that removes the listeners this call added
 */
export function enhanceRichSelects(
  runtime: RuntimeLike,
  root: ParentNode = document,
): () => void {
  void runtime;
  const roots = Array.from(
    root.querySelectorAll<HTMLElement>("[data-rich-select]"),
  );
  if (
    root instanceof HTMLElement &&
    root.matches("[data-rich-select]") &&
    !roots.includes(root)
  ) {
    roots.unshift(root);
  }
  const teardowns: Array<() => void> = [];

  for (const el of roots) {
    if (el.getAttribute(WIRED) === "true") {
      continue;
    }
    // Migration guard (Stimulus conversion): a root converted to the `lv-rich-select` Stimulus
    // controller owns its own keyboard navigation. This legacy enhancer must NOT also wire it, or
    // the search input's keydown would be double-handled. Converted templates carry
    // data-controller="lv-rich-select"; mark it wired and skip.
    if (el.matches('[data-controller~="lv-rich-select"]')) {
      el.setAttribute(WIRED, "true");
      continue;
    }
    el.setAttribute(WIRED, "true");
    teardowns.push(wireRichSelect(el));
  }

  return () => {
    for (const teardown of teardowns) {
      teardown();
    }
  };
}

/** Wires one rich-select root's keydown handler; returns a teardown removing exactly it. */
function wireRichSelect(richSelect: HTMLElement): () => void {
  const search = richSelect.querySelector<HTMLElement>(
    "[data-rich-select-search]",
  );
  if (!search) {
    return () => {};
  }

  const onKeyDown = (event: KeyboardEvent): void => {
    const options = optionsOf(richSelect);
    if (options.length === 0) {
      return;
    }
    const current = options.findIndex(
      (o) => o.getAttribute(ACTIVE) === "true",
    );
    switch (event.key) {
      case "ArrowDown":
        // from no active option (-1) ArrowDown lands on the first; otherwise step + wrap.
        event.preventDefault();
        activate(options, clamp(current + 1, options.length));
        break;
      case "ArrowUp":
        // from no active option (-1) ArrowUp lands on the LAST (APG); otherwise step + wrap.
        event.preventDefault();
        activate(
          options,
          current < 0 ? options.length - 1 : clamp(current - 1, options.length),
        );
        break;
      case "Home":
        event.preventDefault();
        activate(options, 0);
        break;
      case "End":
        event.preventDefault();
        activate(options, options.length - 1);
        break;
      case "Enter":
        // activate the focused option by re-using its own server l:click (a synthetic click);
        // the selection / toggle / create logic stays entirely on the server.
        if (current >= 0) {
          event.preventDefault();
          options[current].click();
        }
        break;
      default:
        break;
    }
  };

  search.addEventListener("keydown", onKeyDown);
  return () => {
    search.removeEventListener("keydown", onKeyDown);
  };
}

/** The selectable (non-disabled) `[role=option]` rows of a rich-select, in DOM order. */
function optionsOf(richSelect: Element): HTMLElement[] {
  return Array.from(
    richSelect.querySelectorAll<HTMLElement>(
      "[data-rich-select-option], [data-rich-select-create]",
    ),
  ).filter((o) => o.getAttribute("aria-disabled") !== "true");
}

/** Marks index `i` active (aria-activedescendant) + scrolls it into view; clears the others. */
function activate(options: HTMLElement[], i: number): void {
  options.forEach((o, idx) => {
    if (idx === i) {
      o.setAttribute(ACTIVE, "true");
      o.scrollIntoView({ block: "nearest" });
    } else {
      o.removeAttribute(ACTIVE);
    }
  });
}

/** Wraps an index into `[0, length)` so ArrowUp/Down cycle the list. */
function clamp(i: number, length: number): number {
  return ((i % length) + length) % length;
}
