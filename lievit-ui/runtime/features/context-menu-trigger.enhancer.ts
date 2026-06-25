/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * Context-menu trigger enhancer (context-menu partial, registry:jte).
 *
 * This is a COMPONENT-SPECIFIC enhancer, NOT a general-purpose shared enhancer. It knows the
 * context-menu partial's DOM contract (data-slot="context-menu-trigger", data-slot="context-menu-panel",
 * data-panel-id, data-menu-x / data-menu-y) and manages the lifecycle that is irreducible to
 * server markup:
 *
 *   1. RIGHT-CLICK INTERCEPTION: intercepts the native `contextmenu` DOM event on every
 *      [data-slot="context-menu-trigger"] element, calls preventDefault() (suppresses the
 *      browser's native context menu), records the pointer coordinates and the active element
 *      (for focus restore on close), then opens the panel.
 *
 *   2. PANEL POSITIONING (CSP-clean): sets data-menu-x + data-menu-y integer attributes on the
 *      panel. The context-menu.css rule reads them via CSS attr() and translates the panel to
 *      the pointer position. No inline style attribute is written (strict CSP compliance).
 *
 *   3. KEYBOARD-INVOKED OPEN (APG: Apps / Shift+F10 / ContextMenu key): when the contextmenu
 *      event has detail === 0 (keyboard-generated) or is dispatched via the ContextMenu key /
 *      Shift+F10, positions the panel adjacent to the trigger element's bounding rect (top-left
 *      corner) rather than at pointer coordinates.
 *
 *   4. LIGHT-DISMISS: while any panel is open, a mousedown outside the panel fires close().
 *
 *   5. ESCAPE: while any panel is open, an Escape keydown fires close().
 *
 *   6. FOCUS RESTORE: records the focused element at contextmenu time; restores it when the
 *      panel is removed from the DOM (on close). The panel presence is detected via MutationObserver
 *      OR, in the uncontrolled case, by an in-module flag.
 *
 *   7. INITIAL FOCUS: after opening, moves DOM focus to the panel element (tabindex=-1). The
 *      collection-nav.enhancer.ts then sets aria-activedescendant to the first non-disabled item.
 *
 * IDEMPOTENCY: triggers are stamped with data-lv-ctx-wired so re-scanning an already-wired
 * trigger (after a DOM morph) is a no-op and does not stack listeners.
 *
 * DOCUMENT LISTENER LIFECYCLE (refcounted): the document-level keydown (Escape) and mousedown
 * (outside-click) listeners are installed once globally and removed only when the refcount drops
 * to zero (all open menus are closed and all instances are torn down). This mirrors the pattern
 * in the legacy context-menu.ts enhancer that the teardown tests pin.
 *
 * UNCONTROLLED mode (default): the enhancer manages the panel entirely client-side. On open it
 * shows the panel by setting a CSS display property (no server round-trip). Callers that need
 * the panel to survive a wire round-trip pass open=true from their own @Wire field (controlled
 * mode); the enhancer still owns positioning and keyboard/dismiss.
 *
 * COLLECTION-NAV HANDOFF: after opening, the collection-nav.enhancer.ts scans for
 * [data-lievit-collection] inside the component root (the panel carries that attribute) and
 * activates arrow roving + typeahead. The trigger enhancer does not duplicate that logic.
 *
 * DOM CONTRACT:
 *   component root:  [data-slot="context-menu"]
 *                    [data-panel-id="<panelId>"]
 *                    [data-trigger-selector="[data-slot='context-menu-trigger']"]
 *   trigger region:  [data-slot="context-menu-trigger"]
 *                    [data-context-menu-for="<panelId>"]
 *   panel element:   [data-slot="context-menu-panel"]
 *                    id="<panelId>"
 *                    tabindex="-1"
 *                    (only present in DOM when open=true in controlled mode, or when the
 *                     enhancer has shown it in uncontrolled mode)
 *   position attrs:  data-menu-x="<integer>" data-menu-y="<integer>" (set by this enhancer;
 *                    read by context-menu.css to position via CSS translate)
 *
 * APG source: https://www.w3.org/WAI/ARIA/apg/patterns/menu/ (verified 2026-06-24).
 */

/** Attribute stamped on wired triggers (idempotency guard). */
const WIRED_ATTR = "data-lv-ctx-wired";

/** Attribute on the trigger element pointing at its panel id. */
const FOR_ATTR = "data-context-menu-for";

/** Attribute on the panel carrying the pointer X coordinate (integer pixels). */
const MENU_X_ATTR = "data-menu-x";

/** Attribute on the panel carrying the pointer Y coordinate (integer pixels). */
const MENU_Y_ATTR = "data-menu-y";

/** data-slot value for the trigger wrapper. */
const TRIGGER_SLOT = "context-menu-trigger";


// ---------------------------------------------------------------------------
// Global document listener (refcounted, installed once across all instances)
// ---------------------------------------------------------------------------

/** How many open context menus are tracked globally. Determines document listener lifecycle. */
let docListenerRefCount = 0;

/**
 * Finds the panel element for a given panel id, searching inside the trigger's nearest
 * [data-slot="context-menu"] root (the sibling of the trigger wrapper).
 */
function findPanel(panelId: string): HTMLElement | null {
  return document.getElementById(panelId) as HTMLElement | null;
}

/** Returns true if the element or any ancestor is the given panel. */
function isInsidePanel(target: EventTarget | null, panelEl: HTMLElement): boolean {
  if (target == null || !(target instanceof Element)) {
    return false;
  }
  return panelEl.contains(target);
}

/** All currently active panel-close callbacks, keyed by panel id. */
const activeCloseCallbacks = new Map<string, () => void>();

function onDocKeydown(e: KeyboardEvent): void {
  if (e.key !== "Escape") {
    return;
  }
  // Close all open menus on Escape.
  for (const cb of Array.from(activeCloseCallbacks.values())) {
    cb();
  }
}

function onDocMousedown(e: MouseEvent): void {
  for (const [panelId, cb] of Array.from(activeCloseCallbacks.entries())) {
    const panelEl = findPanel(panelId);
    if (panelEl == null || !isInsidePanel(e.target, panelEl)) {
      cb();
    }
  }
}

function installDocListeners(): void {
  if (docListenerRefCount === 0) {
    document.addEventListener("keydown", onDocKeydown);
    document.addEventListener("mousedown", onDocMousedown);
  }
  docListenerRefCount += 1;
}

function removeDocListeners(): void {
  docListenerRefCount = Math.max(0, docListenerRefCount - 1);
  if (docListenerRefCount === 0) {
    document.removeEventListener("keydown", onDocKeydown);
    document.removeEventListener("mousedown", onDocMousedown);
  }
}

// ---------------------------------------------------------------------------
// Per-trigger wiring
// ---------------------------------------------------------------------------

/**
 * Wires a single trigger element. Idempotent: if the trigger is already wired (WIRED_ATTR
 * present), this is a no-op and returns a no-op teardown.
 */
function wireTrigger(trigger: HTMLElement): () => void {
  if (trigger.hasAttribute(WIRED_ATTR)) {
    return () => {};
  }
  // Migration guard (Stimulus conversion): a context-menu converted to the `lv-context-menu`
  // controller owns its own contextmenu / keyboard / dismiss handling (the controller is on the
  // [data-slot="context-menu"] root). This legacy enhancer must NOT also wire the trigger, or a
  // right-click would open + position the menu twice. Converted templates carry the data-controller.
  if (trigger.closest('[data-controller~="lv-context-menu"]') != null) {
    trigger.setAttribute(WIRED_ATTR, "");
    return () => {};
  }
  trigger.setAttribute(WIRED_ATTR, "");

  /** The element that held focus when contextmenu fired; restored on close. */
  let savedFocusEl: HTMLElement | null = null;

  /** Panel id this trigger controls. */
  const panelId = trigger.getAttribute(FOR_ATTR) ?? "";

  function openMenu(x: number, y: number): void {
    const panelEl = findPanel(panelId);
    if (panelEl == null) {
      return;
    }
    // Set coordinate attributes (read by context-menu.css).
    panelEl.setAttribute(MENU_X_ATTR, String(Math.round(x)));
    panelEl.setAttribute(MENU_Y_ATTR, String(Math.round(y)));
    // Register the close callback so global listeners can reach it.
    if (!activeCloseCallbacks.has(panelId)) {
      installDocListeners();
      activeCloseCallbacks.set(panelId, closeMenu);
    }
    // Move focus to the panel (collection-nav takes over from here).
    panelEl.focus();
  }

  function closeMenu(): void {
    const wasOpen = activeCloseCallbacks.has(panelId);
    activeCloseCallbacks.delete(panelId);
    if (wasOpen) {
      removeDocListeners();
    }
    // Clear coordinate attributes.
    const panelEl = findPanel(panelId);
    if (panelEl != null) {
      panelEl.removeAttribute(MENU_X_ATTR);
      panelEl.removeAttribute(MENU_Y_ATTR);
    }
    // Restore focus.
    if (savedFocusEl != null) {
      savedFocusEl.focus();
      savedFocusEl = null;
    }
  }

  function handleContextMenu(e: Event): void {
    const me = e as MouseEvent;
    e.preventDefault();
    // Save the currently focused element for restoration.
    savedFocusEl = (document.activeElement instanceof HTMLElement) ? document.activeElement : null;
    // Always use pointer coordinates from the contextmenu event. The keyboard-invoked case
    // (ContextMenu key / Shift+F10) is handled by handleKeydown below and positions the panel
    // at the trigger's bounding rect. The contextmenu DOM event's detail is always 0 per spec
    // (regardless of whether it was triggered by a mouse or keyboard), so detail === 0 is NOT
    // a reliable keyboard-invocation signal; we use the pointer coordinates as-is.
    openMenu(me.clientX, me.clientY);
  }

  function handleKeydown(e: KeyboardEvent): void {
    // APG keyboard affordances for context-menu open.
    if (e.key === "ContextMenu" || (e.key === "F10" && e.shiftKey)) {
      e.preventDefault();
      savedFocusEl = (document.activeElement instanceof HTMLElement) ? document.activeElement : null;
      const rect = trigger.getBoundingClientRect();
      openMenu(rect.left, rect.bottom);
    }
  }

  trigger.addEventListener("contextmenu", handleContextMenu);
  trigger.addEventListener("keydown", handleKeydown);

  return function teardown(): void {
    trigger.removeAttribute(WIRED_ATTR);
    trigger.removeEventListener("contextmenu", handleContextMenu);
    trigger.removeEventListener("keydown", handleKeydown);
    closeMenu();
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Scans a root element for [data-slot="context-menu-trigger"] elements and wires each one.
 * Idempotent per trigger; safe to call again after a DOM morph (already-wired triggers are
 * skipped; newly-added triggers are wired).
 *
 * Returns a teardown function that unwires ALL triggers found in this scan and decrements the
 * document-listener refcount. Multiple calls from separate scans maintain independent teardowns.
 *
 * @param root  the element to scan; defaults to document.body if omitted.
 * @returns     a teardown function.
 */
export function installContextMenuTrigger(root: Element = document.body): () => void {
  const triggers = Array.from(
    root.querySelectorAll<HTMLElement>(`[data-slot="${TRIGGER_SLOT}"]`),
  );
  // Also check if the root itself is a trigger (rare but possible).
  if (root instanceof HTMLElement && root.getAttribute("data-slot") === TRIGGER_SLOT) {
    triggers.unshift(root);
  }

  const teardowns = triggers.map(wireTrigger);
  let torn = false;

  return function teardown(): void {
    if (torn) {
      return;
    }
    torn = true;
    for (const t of teardowns) {
      t();
    }
  };
}
