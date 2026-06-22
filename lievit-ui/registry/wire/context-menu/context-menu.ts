/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
import type { LievitRuntime } from "../../../runtime/index.js";

/**
 * The CSP-clean typed-TS enhancer for the server-first context-menu WIRE component (ADR-0012,
 * Wave 2). It is the one irreducible client bit: a right-click is a native `contextmenu` event the
 * server cannot see, so this module captures it, prevents the browser menu, writes the pointer
 * coordinates into the component's `x` / `y` wire fields and fires the `openAt` action. The server
 * re-renders the menu open at those coordinates; the client morphs it in. Escape / an outside click
 * fire the `close` action. There is NO Lit, NO @floating-ui/dom, NO inline `<script>` (the strict
 * CSP refuses inline handlers, the bug the pivot exists to kill): it is `addEventListener` only.
 *
 * Why a TS module and not a wire directive: a `contextmenu` listener with `preventDefault` + the
 * pointer coordinates has no server-side equivalent (the menu items, open-state, and selection all
 * live server-side; only the trigger gesture is client). This mirrors the blueprint's "escape-hatch
 * = a typed-TS micro-enhancement, not a shipped Lit island".
 *
 * Usage (the adopter calls this once from main.ts after starting the runtime):
 * ```ts
 * import { startLievit } from "lievit";
 * import { enhanceContextMenus } from "./components/ui/context-menu.js";
 * const runtime = startLievit();
 * enhanceContextMenus(runtime);
 * ```
 */

/** The subset of the runtime the enhancer needs: resolve a component's `$lievit` object. */
type RuntimeLike = Pick<LievitRuntime, "$lievit">;

/** Marks a trigger so the per-element listeners are wired exactly once per element. */
const WIRED = "data-context-menu-wired";

/**
 * Module-level singletons for the DOCUMENT-level Escape / outside-click listeners. These are global
 * (one keydown + one mousedown on `document`), so they must be installed AT MOST ONCE regardless of
 * how many times `enhanceContextMenus` runs: an adopter that re-scans after a morph (re-enhance)
 * without first calling the previous teardown used to STACK a fresh pair on `document` every call,
 * leaking listeners (and firing `close` N times). We now install the pair once, refcount the live
 * enhancements, and only uninstall when the last teardown runs. `documentRoot` records which root the
 * close logic scans (the last enhance wins; the common case is the single `document` root).
 */
let documentListeners: { keydown: (e: KeyboardEvent) => void; pointerdown: (e: MouseEvent) => void } | null = null;
let enhanceRefcount = 0;
let documentRoot: ParentNode = document;
let documentRuntime: RuntimeLike | null = null;

/**
 * Wires every `[data-context-menu-trigger]` on the page so a right-click opens its menu at the
 * pointer. Idempotent: a trigger already wired is skipped, so calling this after a morph that
 * re-rendered the trigger is safe.
 *
 * @param runtime the started lievit runtime (used to resolve each trigger's `$lievit` object)
 * @param root the DOM subtree to scan (defaults to `document`)
 * @returns a teardown that removes the document-level Escape / outside-click listeners
 */
export function enhanceContextMenus(
  runtime: RuntimeLike,
  root: ParentNode = document,
): () => void {
  const triggers = Array.from(
    root.querySelectorAll<HTMLElement>("[data-context-menu-trigger]"),
  );

  for (const trigger of triggers) {
    if (trigger.getAttribute(WIRED) === "true") {
      continue;
    }
    trigger.setAttribute(WIRED, "true");

    trigger.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      openAt(runtime, trigger, event.clientX, event.clientY);
    });

    // Keyboard parity: the ContextMenu key / Shift+F10 opens the menu at the trigger's box.
    trigger.addEventListener("keydown", (event) => {
      if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) {
        event.preventDefault();
        const rect = trigger.getBoundingClientRect();
        openAt(runtime, trigger, Math.round(rect.left), Math.round(rect.bottom));
      }
    });
  }

  // Escape (anywhere) and a click outside the open panel close the menu server-side. The pair is
  // installed on `document` AT MOST ONCE (idempotent): re-enhancing after a morph reuses the same
  // listeners instead of stacking a fresh pair, and bumps a refcount so the listeners survive until
  // the LAST teardown runs. The handlers close over the latest `runtime` + scan `documentRoot`.
  documentRoot = root;
  documentRuntime = runtime;
  if (documentListeners === null) {
    const onKeydown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }
      for (const trigger of openTriggers(documentRoot)) {
        documentRuntime?.$lievit(trigger)?.$call("close");
      }
    };
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      for (const trigger of openTriggers(documentRoot)) {
        const panel = panelOf(trigger);
        if (panel && target && !panel.contains(target)) {
          documentRuntime?.$lievit(trigger)?.$call("close");
        }
      }
    };
    document.addEventListener("keydown", onKeydown, true);
    document.addEventListener("mousedown", onPointerDown, true);
    documentListeners = { keydown: onKeydown, pointerdown: onPointerDown };
  }
  enhanceRefcount += 1;

  let torndown = false;
  return () => {
    if (torndown) {
      return;
    }
    torndown = true;
    enhanceRefcount -= 1;
    if (enhanceRefcount <= 0 && documentListeners !== null) {
      document.removeEventListener("keydown", documentListeners.keydown, true);
      document.removeEventListener("mousedown", documentListeners.pointerdown, true);
      documentListeners = null;
      documentRuntime = null;
      enhanceRefcount = 0;
    }
  };
}

/** Writes the pointer coordinates into the component's wire fields and opens it server-side. */
function openAt(
  runtime: RuntimeLike,
  trigger: Element,
  x: number,
  y: number,
): void {
  const component = runtime.$lievit(trigger);
  if (!component) {
    return;
  }
  component.$set("x", x);
  component.$set("y", y);
  component.$call("openAt");
}

/** The component roots whose context-menu panel is currently open in the DOM. */
function openTriggers(root: ParentNode): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>("[data-context-menu-panel]")).flatMap(
    (panel) => {
      const trigger = panel.parentElement?.querySelector<HTMLElement>(
        "[data-context-menu-trigger]",
      );
      return trigger ? [trigger] : [];
    },
  );
}

/** The open menu panel inside the component root that owns `trigger`, or null. */
function panelOf(trigger: Element): HTMLElement | null {
  return trigger.parentElement?.querySelector<HTMLElement>("[data-context-menu-panel]") ?? null;
}
