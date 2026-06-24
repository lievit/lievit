/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * WAI-ARIA APG Listbox + Menu keyboard navigation via `aria-activedescendant` (#34 v-next shared
 * enhancers). A container that carries `data-lievit-collection` becomes a keyboard-navigable
 * collection: Arrow keys move the active item (virtual focus, `aria-activedescendant` on the
 * target), Home/End jump to the ends, typeahead finds the next matching item by text content, and
 * Enter fires a configurable wire action.
 *
 * Attribute protocol on the COLLECTION ROOT:
 * - `data-lievit-collection` — activates the enhancer (no value needed)
 * - `data-lievit-collection-orientation` — `"vertical"` (default) | `"horizontal"` | `"both"`
 * - `data-lievit-collection-wrap` — `"true"` to wrap at the ends (default `"false"`)
 * - `data-lievit-collection-select-action` — wire action to call on Enter on the active item
 * - `data-lievit-collection-escape-action` — wire action to call on Escape on the root
 * - `data-lievit-collection-activedescendant-target` — CSS selector (relative to root) of the
 *   element to receive `aria-activedescendant`; defaults to the root itself
 *
 * Attribute protocol on each ITEM element inside the collection:
 * - `data-lievit-item` — marks an element as a collection item
 * - `id` — required for `aria-activedescendant` to name the item
 * - `aria-disabled="true"` or `disabled` attribute — skips the item during navigation
 *
 * Idempotency: `data-lievit-rt-collection-active` is stamped on the root; re-scanning the same
 * root is a no-op.
 *
 * APG sources:
 *   https://www.w3.org/WAI/ARIA/apg/patterns/listbox/
 *   https://www.w3.org/WAI/ARIA/apg/patterns/menu/
 */

import type { LievitRuntime } from "../runtime.js";

const COLLECTION_ATTR = "data-lievit-collection";
const ACTIVE_ATTR = "data-lievit-rt-collection-active";
const ITEM_ATTR = "data-lievit-item";
const ORIENTATION_ATTR = "data-lievit-collection-orientation";
const WRAP_ATTR = "data-lievit-collection-wrap";
const SELECT_ACTION_ATTR = "data-lievit-collection-select-action";
const ESCAPE_ACTION_ATTR = "data-lievit-collection-escape-action";
const AD_TARGET_ATTR = "data-lievit-collection-activedescendant-target";

/** Typeahead reset delay in ms. */
const TYPEAHEAD_DELAY_MS = 500;

function getItems(root: Element): Element[] {
  return Array.from(root.querySelectorAll<Element>(`[${ITEM_ATTR}]`));
}

function isDisabled(item: Element): boolean {
  return (
    item.getAttribute("aria-disabled") === "true" ||
    item.hasAttribute("disabled")
  );
}

function getActiveDescendantTarget(root: Element): Element {
  const selector = root.getAttribute(AD_TARGET_ATTR);
  if (selector != null && selector.length > 0) {
    const target = root.querySelector<Element>(selector);
    if (target != null) {
      return target;
    }
  }
  return root;
}

function setActive(root: Element, item: Element | null): void {
  const target = getActiveDescendantTarget(root);
  if (item == null) {
    target.removeAttribute("aria-activedescendant");
    return;
  }
  if (!item.id) {
    // Assign a synthetic id if none exists so aria-activedescendant has something to reference.
    item.id = `lv-item-${Math.random().toString(36).slice(2)}`;
  }
  target.setAttribute("aria-activedescendant", item.id);
}

function getActive(root: Element): Element | null {
  const target = getActiveDescendantTarget(root);
  const activeId = target.getAttribute("aria-activedescendant");
  if (activeId == null || activeId.length === 0) {
    return null;
  }
  return root.querySelector<Element>(`#${CSS.escape(activeId)}`);
}

function nextItem(
  items: Element[],
  current: Element | null,
  delta: 1 | -1,
  wrap: boolean,
): Element | null {
  const enabled = items.filter((i) => !isDisabled(i));
  if (enabled.length === 0) {
    return null;
  }
  if (current == null) {
    return delta > 0 ? enabled[0] : enabled[enabled.length - 1];
  }
  const idx = enabled.indexOf(current);
  if (idx < 0) {
    return delta > 0 ? enabled[0] : enabled[enabled.length - 1];
  }
  const next = idx + delta;
  if (next < 0) {
    return wrap ? enabled[enabled.length - 1] : enabled[0];
  }
  if (next >= enabled.length) {
    return wrap ? enabled[0] : enabled[enabled.length - 1];
  }
  return enabled[next];
}

interface CollectionState {
  readonly keyHandler: EventListener;
  typeaheadBuffer: string;
  typeaheadTimer: ReturnType<typeof setTimeout> | null;
}

/** Active collections keyed by root. Map (not WeakMap) so we can iterate on afterCall. */
const activeCollections = new Map<Element, CollectionState>();

function activateCollection(root: Element, runtime: LievitRuntime): void {
  if (activeCollections.has(root)) {
    return;
  }
  root.setAttribute(ACTIVE_ATTR, "");

  // The state object is mutated once below to inject the keyHandler after closure capture.
  const state: CollectionState = {
    keyHandler: null as unknown as EventListener, // patched below
    typeaheadBuffer: "",
    typeaheadTimer: null,
  };

  function handleTypeahead(char: string): void {
    if (state.typeaheadTimer != null) {
      clearTimeout(state.typeaheadTimer);
    }

    const lc = char.toLowerCase();
    // If the buffer is already all the same character as the one being typed, do not accumulate
    // (the user is cycling through items starting with that char). This matches the common APG
    // implementation: repeated pressing of the same key cycles rather than building "aaa".
    const repeated = state.typeaheadBuffer.length > 0 && state.typeaheadBuffer.split("").every((c) => c === lc);
    if (repeated) {
      // Keep the buffer as the single char so the search logic below cycles correctly.
      state.typeaheadBuffer = lc;
    } else {
      state.typeaheadBuffer += lc;
    }
    const buffer = state.typeaheadBuffer;

    const items = getItems(root).filter((i) => !isDisabled(i));
    const active = getActive(root);
    const startIdx = active != null ? items.indexOf(active) : -1;
    // Search from the item AFTER the current active (wrap around the list).
    const reordered = [...items.slice(startIdx + 1), ...items.slice(0, startIdx + 1)];
    const match = reordered.find((i) =>
      (i.textContent ?? "").trim().toLowerCase().startsWith(buffer),
    );
    if (match != null) {
      setActive(root, match);
    }
    state.typeaheadTimer = setTimeout(() => {
      state.typeaheadBuffer = "";
      state.typeaheadTimer = null;
    }, TYPEAHEAD_DELAY_MS);
  }

  const keyHandler: EventListener = (rawEvent: Event): void => {
    const e = rawEvent as KeyboardEvent;
    const orientation = root.getAttribute(ORIENTATION_ATTR) ?? "vertical";
    const wrap = root.getAttribute(WRAP_ATTR) === "true";
    const selectAction = root.getAttribute(SELECT_ACTION_ATTR);
    const escapeAction = root.getAttribute(ESCAPE_ACTION_ATTR);

    const items = getItems(root);
    const active = getActive(root);

    const isVertical = orientation === "vertical" || orientation === "both";
    const isHorizontal = orientation === "horizontal" || orientation === "both";

    let handled = false;

    if ((e.key === "ArrowDown" && isVertical) || (e.key === "ArrowRight" && isHorizontal)) {
      setActive(root, nextItem(items, active, 1, wrap));
      handled = true;
    } else if ((e.key === "ArrowUp" && isVertical) || (e.key === "ArrowLeft" && isHorizontal)) {
      setActive(root, nextItem(items, active, -1, wrap));
      handled = true;
    } else if (e.key === "Home") {
      const enabled = items.filter((i) => !isDisabled(i));
      if (enabled.length > 0) {
        setActive(root, enabled[0]);
      }
      handled = true;
    } else if (e.key === "End") {
      const enabled = items.filter((i) => !isDisabled(i));
      if (enabled.length > 0) {
        setActive(root, enabled[enabled.length - 1]);
      }
      handled = true;
    } else if (e.key === "Enter") {
      if (active != null && selectAction != null && selectAction.length > 0) {
        void runtime.callAction(active, selectAction, { trigger: active });
      }
      handled = true;
    } else if (e.key === "Escape") {
      if (escapeAction != null && escapeAction.length > 0) {
        void runtime.callAction(root, escapeAction, { trigger: root });
      }
      handled = true;
    } else if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
      handleTypeahead(e.key);
      handled = true;
    }

    if (handled) {
      e.preventDefault();
    }
  };

  (state as { keyHandler: EventListener }).keyHandler = keyHandler;
  root.addEventListener("keydown", keyHandler);
  activeCollections.set(root, state);
}

function deactivateCollection(root: Element): void {
  const state = activeCollections.get(root);
  if (state == null) {
    return;
  }
  activeCollections.delete(root);
  root.removeAttribute(ACTIVE_ATTR);
  root.removeEventListener("keydown", state.keyHandler);
  if (state.typeaheadTimer != null) {
    clearTimeout(state.typeaheadTimer);
  }
}

/**
 * Installs the collection-nav enhancer on a runtime. Registers an `onComponentInit` lifecycle
 * hook that scans every component root for `[data-lievit-collection]` elements, plus an
 * `afterCall` hook that deactivates stale collection roots after every morph.
 *
 * @param runtime the started runtime to extend
 * @returns an unsubscribe function
 */
export function installCollectionNav(runtime: LievitRuntime): () => void {
  function scanRoot(root: Element): void {
    if (root.hasAttribute(COLLECTION_ATTR)) {
      activateCollection(root, runtime);
    }
    for (const el of Array.from(root.querySelectorAll<Element>(`[${COLLECTION_ATTR}]`))) {
      activateCollection(el, runtime);
    }
  }

  return runtime.use({
    onComponentInit(ctx) {
      scanRoot(ctx.root);
    },
    afterCall(outcome) {
      // Re-scan after morph (new collection roots may appear; stale ones may have been removed).
      scanRoot(outcome.root);
      for (const [root] of activeCollections) {
        if (!document.body.contains(root)) {
          deactivateCollection(root);
        }
      }
    },
  });
}
