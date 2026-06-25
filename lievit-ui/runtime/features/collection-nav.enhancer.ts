/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * WAI-ARIA APG keyboard navigation for Listbox / Menu (aria-activedescendant model), Tabs
 * (roving-tabindex model), and Disclosure Navigation (nav mode). All three models are
 * parameterised on the same collection root via `data-lievit-collection`. The models are NOT
 * interchangeable:
 *
 *   aria-activedescendant (default, Listbox / Menu):
 *     DOM focus stays on the composite widget root; `aria-activedescendant` on the root (or a
 *     designated target) names the visually-active item. The active item never gets real focus.
 *
 *   roving-tabindex (Tabs, APG https://www.w3.org/WAI/ARIA/apg/patterns/tabs/):
 *     DOM focus MOVES to the target item on Arrow keys. The focused item gets `tabindex="0"`;
 *     all others get `tabindex="-1"`. `data-manual-activation="true"` separates focus-movement
 *     (Arrow keys) from activation (Enter / Space); without it Arrow keys both move focus AND
 *     call the select action immediately (automatic-activation, APG default).
 *
 *   nav mode (APG Disclosure Navigation, additive — guarded by `data-lievit-collection-mode="nav"`):
 *     DOM focus MOVES to the target item on Arrow keys (like roving-tabindex), BUT all items
 *     keep `tabindex="0"` at all times — the enhancer never sets `tabindex="-1"` on any item.
 *     This implements the APG Disclosure Navigation supplemental keyboard pattern where Tab is
 *     the primary navigation and arrow keys are a supplemental aid. In this mode:
 *       - Arrow keys call `element.focus()` on the target item.
 *       - No `tabindex` attribute is ever written (all items remain `tabindex="0"`).
 *       - typeahead, Home/End, disabled-skip all work the same as roving-tabindex.
 *       - `data-manual-activation` and select actions are NOT supported (nav links navigate
 *         via their natural `href`; the action model is for widget items, not links).
 *     Guard: `data-lievit-collection-mode="nav"` on the root activates this mode.
 *     The existing roving-tabindex (`data-lievit-collection-roving-tabindex="true"`) and
 *     activedescendant (default) modes are completely unaffected.
 *
 * Attribute protocol on the COLLECTION ROOT:
 * - `data-lievit-collection` — activates the enhancer (no value needed)
 * - `data-lievit-collection-orientation` — `"vertical"` (default) | `"horizontal"` | `"both"`
 * - `data-lievit-collection-wrap` — `"true"` to wrap at the ends (default `"false"`)
 * - `data-lievit-collection-select-action` — wire action to call on Enter / Space (roving) or
 *   Enter (activedescendant) on the active item
 * - `data-lievit-collection-escape-action` — wire action to call on Escape on the root
 * - `data-lievit-collection-activedescendant-target` — CSS selector (relative to root) of the
 *   element to receive `aria-activedescendant`; defaults to the root itself
 *   (activedescendant mode only; ignored in roving-tabindex mode)
 * - `data-lievit-collection-roving-tabindex` — `"true"` switches to the roving-tabindex model
 * - `data-lievit-collection-mode` — `"nav"` switches to APG Disclosure Navigation mode (additive;
 *   takes precedence over `data-lievit-collection-roving-tabindex` when both are set)
 * - `data-manual-activation` — `"true"` (roving-tabindex mode only): Arrow keys move focus but
 *   do NOT call the select action; Enter / Space call it on the focused item
 *
 * ADDITIVE features (guarded; existing behavior unchanged when absent):
 *
 * Roving-tabindex typeahead (additive):
 *   Printable-character keystrokes in roving-tabindex mode now perform type-to-focus: the buffer
 *   is matched against item text (same logic as activedescendant mode). No new attribute needed;
 *   the existing 500 ms reset and repeated-char cycling apply identically.
 *
 * Submenu open / close (additive, roving-tabindex mode):
 *   ArrowRight on an item that carries `aria-haspopup="menu"` dispatches a DOM CustomEvent
 *   `lv:collection-submenu-open` on that item (bubbles=true, cancelable=true). The submenu-owning
 *   component can listen to this event and open its panel. ArrowLeft (or Escape) inside a nested
 *   submenu collection fires the root's `data-lievit-collection-escape-action`, which the consuming
 *   component interprets as "close submenu and return focus to parent item". In the parent
 *   collection, ArrowLeft on an item with `aria-haspopup="menu"` and `aria-expanded="true"` is a
 *   no-op (the submenu close + focus return is owned by the submenu's own Escape/ArrowLeft).
 *   Detection: `aria-haspopup="menu"` + `aria-controls="<id>"` on the item (standard ARIA; already
 *   emitted by context-menu/item.jte for type="submenu"). No custom attribute is invented.
 *   Event name: `lv:collection-submenu-open` (CustomEvent, bubbles+cancelable). The coordinator /
 *   adopting component listens for this event on the menu container to open the child panel.
 *
 * Horizontal-bar ArrowDown opens submenu (additive, roving-tabindex + horizontal orientation):
 *   In HORIZONTAL roving mode, ArrowDown on a top-level item that has `aria-haspopup="menu"`
 *   dispatches the same `lv:collection-submenu-open` CustomEvent that vertical ArrowRight dispatches.
 *   Guard: only fires in roving mode with orientation="horizontal" AND the focused item has
 *   `aria-haspopup="menu"`. Without the guard, ArrowDown falls through unhandled (existing behavior).
 *   This implements the APG Menubar "Down Arrow opens the submenu" keyboard interaction.
 *
 * Attribute protocol on each ITEM element inside the collection:
 * - `data-lievit-item` — marks an element as a collection item
 * - `id` — required for `aria-activedescendant` to name the item (activedescendant mode only)
 * - `aria-disabled="true"` or `disabled` attribute — skips the item during navigation.
 *   NOTE: in roving-tabindex / Tabs mode the APG mandates `aria-disabled` ONLY (NOT native
 *   `disabled`) because a disabled tab must remain focusable in the roving order; native
 *   `disabled` removes the element from the tab order and breaks the pattern.
 *
 * Idempotency: `data-lievit-rt-collection-active` is stamped on the root; re-scanning the same
 * root is a no-op.
 *
 * APG sources:
 *   https://www.w3.org/WAI/ARIA/apg/patterns/listbox/
 *   https://www.w3.org/WAI/ARIA/apg/patterns/menu/
 *   https://www.w3.org/WAI/ARIA/apg/patterns/tabs/
 *   https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/examples/disclosure-navigation/
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
const ROVING_TABINDEX_ATTR = "data-lievit-collection-roving-tabindex";
const MANUAL_ACTIVATION_ATTR = "data-manual-activation";
/**
 * Additive: APG Disclosure Navigation mode. When set to "nav" on the collection root, arrow keys
 * call element.focus() but do NOT touch tabindex (all items remain tabindex="0"). This is the
 * third mode alongside aria-activedescendant (default) and roving-tabindex. Takes precedence over
 * data-lievit-collection-roving-tabindex when both are present.
 */
const MODE_ATTR = "data-lievit-collection-mode";

/** Typeahead reset delay in ms. */
const TYPEAHEAD_DELAY_MS = 500;

/**
 * CustomEvent name dispatched on a submenu-parent item when ArrowRight is pressed on it.
 * Additive; only fired when item carries aria-haspopup="menu".
 */
const SUBMENU_OPEN_EVENT = "lv:collection-submenu-open";

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

// ---------------------------------------------------------------------------
// Roving-tabindex helpers (APG Tabs model)
// ---------------------------------------------------------------------------

/**
 * Returns whether a root is in nav mode (APG Disclosure Navigation, additive).
 * Nav mode: arrow keys call element.focus() but never mutate tabindex.
 * Takes precedence over roving-tabindex when both attributes are present.
 */
function isNavMode(root: Element): boolean {
  return root.getAttribute(MODE_ATTR) === "nav";
}

/**
 * Returns whether a root is in roving-tabindex mode (APG Tabs).
 * false = aria-activedescendant mode (APG Listbox / Menu, the default).
 * NOTE: when isNavMode returns true, isRovingMode should NOT be consulted; nav mode takes
 * precedence. Always check isNavMode first.
 */
function isRovingMode(root: Element): boolean {
  return root.getAttribute(ROVING_TABINDEX_ATTR) === "true";
}

/**
 * Updates tabindex attributes across all items: focused item gets 0, all others get -1.
 * The focused item is determined by the element that currently has DOM focus (if it is
 * one of the items) or by the explicitly supplied `focused` argument.
 *
 * Must be called after DOM focus moves so that the correct item is identified.
 */
function rovingSetTabindex(items: Element[], focused: Element): void {
  for (const item of items) {
    (item as HTMLElement).tabIndex = item === focused ? 0 : -1;
  }
}

/**
 * Returns the item that currently has `tabindex="0"`, or null if none (e.g. initial state
 * where the server has already stamped one but no Arrow key has been pressed yet).
 */
function rovingGetFocused(items: Element[]): Element | null {
  return items.find((i) => (i as HTMLElement).tabIndex === 0) ?? null;
}

/**
 * Moves DOM focus to `target` and updates all tabindex attributes (roving model).
 * No-op if target is null.
 */
function rovingMoveFocus(items: Element[], target: Element | null): void {
  if (target == null) {
    return;
  }
  rovingSetTabindex(items, target);
  (target as HTMLElement).focus();
}

// ---------------------------------------------------------------------------
// Shared state shape
// ---------------------------------------------------------------------------

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
  // Migration guard (Stimulus conversion): a collection root converted to a Stimulus controller
  // owns its own keydown handling. This enhancer must NOT also wire it, or the navigation keys
  // (Arrow / Home / End / typeahead) would be double-handled (focus jumping two items per press).
  // Converted templates carry data-controller="lv-menubar" (the first converted collection root).
  if (root.matches('[data-controller~="lv-menubar"]')) {
    return;
  }
  root.setAttribute(ACTIVE_ATTR, "");

  // The state object is mutated once below to inject the keyHandler after closure capture.
  const state: CollectionState = {
    keyHandler: null as unknown as EventListener, // patched below
    typeaheadBuffer: "",
    typeaheadTimer: null,
  };

  /**
   * Shared typeahead handler. `currentItem` is the currently active/focused item (the search
   * starts from the item AFTER it). In activedescendant mode this is the aria-activedescendant
   * element; in roving-tabindex mode this is the DOM-focused item.
   * `onMatch` is called with the matched item so each mode can apply its own selection logic
   * (setActive for activedescendant; rovingMoveFocus for roving).
   */
  function handleTypeahead(char: string, currentItem: Element | null, onMatch: (item: Element) => void): void {
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
    const startIdx = currentItem != null ? items.indexOf(currentItem) : -1;
    // Search from the item AFTER the current active (wrap around the list).
    const reordered = [...items.slice(startIdx + 1), ...items.slice(0, startIdx + 1)];
    const match = reordered.find((i) =>
      (i.textContent ?? "").trim().toLowerCase().startsWith(buffer),
    );
    if (match != null) {
      onMatch(match);
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
    // Nav mode takes precedence over roving-tabindex when both attributes are present.
    const nav = isNavMode(root);
    const roving = !nav && isRovingMode(root);

    const items = getItems(root);

    const isVertical = orientation === "vertical" || orientation === "both";
    const isHorizontal = orientation === "horizontal" || orientation === "both";

    let handled = false;

    if (nav) {
      // -----------------------------------------------------------------------
      // Nav mode (APG Disclosure Navigation — additive, guarded by data-lievit-collection-mode="nav")
      // -----------------------------------------------------------------------
      // Arrow keys call element.focus() on the target item, but tabindex is NEVER mutated:
      // all items remain at their server-rendered tabindex="0". This implements the APG
      // Disclosure Navigation supplemental keyboard pattern where Tab is the primary navigation
      // and arrow keys are a supplemental aid that does NOT lock users into a roving sequence.
      //
      // The focused item is the current document.activeElement (if it is one of the items),
      // or null if no item has focus. Because tabindex is never touched, rovingGetFocused()
      // (which reads tabindex=0) cannot be used here; instead we find the item that is currently
      // the document's activeElement.
      const currentFocused = items.find((i) => i === document.activeElement) ?? null;

      const isNextKey = (e.key === "ArrowDown" && isVertical) || (e.key === "ArrowRight" && isHorizontal);
      const isPrevKey = (e.key === "ArrowUp" && isVertical) || (e.key === "ArrowLeft" && isHorizontal);

      if (isNextKey || isPrevKey) {
        const target = nextItem(items, currentFocused, isNextKey ? 1 : -1, wrap);
        if (target != null) {
          // Move real DOM focus without touching tabindex.
          (target as HTMLElement).focus();
        }
        handled = true;
      } else if (e.key === "Home") {
        const enabled = items.filter((i) => !isDisabled(i));
        if (enabled.length > 0) {
          (enabled[0] as HTMLElement).focus();
        }
        handled = true;
      } else if (e.key === "End") {
        const enabled = items.filter((i) => !isDisabled(i));
        if (enabled.length > 0) {
          (enabled[enabled.length - 1] as HTMLElement).focus();
        }
        handled = true;
      } else if (e.key === "Escape") {
        if (escapeAction != null && escapeAction.length > 0) {
          void runtime.callAction(root, escapeAction, { trigger: root });
        }
        handled = true;
      } else if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        // Typeahead: same logic as the other modes, but onMatch calls .focus() without
        // touching tabindex (consistent with the nav mode contract).
        handleTypeahead(e.key, currentFocused, (match) => (match as HTMLElement).focus());
        handled = true;
      }
    } else if (roving) {
      // -----------------------------------------------------------------------
      // Roving-tabindex model (APG Tabs)
      // -----------------------------------------------------------------------
      // In roving mode the event is listened on the tablist root but the focused
      // element is one of the tab buttons (they have tabindex=0 / -1).  We read
      // the current item by finding which item currently has tabindex=0, not by
      // inspecting aria-activedescendant.
      const manualActivation = root.getAttribute(MANUAL_ACTIVATION_ATTR) === "true";
      const focused = rovingGetFocused(items);

      const isNextKey = (e.key === "ArrowDown" && isVertical) || (e.key === "ArrowRight" && isHorizontal);
      const isPrevKey = (e.key === "ArrowUp" && isVertical) || (e.key === "ArrowLeft" && isHorizontal);

      if (isNextKey || isPrevKey) {
        const target = nextItem(items, focused, isNextKey ? 1 : -1, wrap);
        rovingMoveFocus(items, target);
        // Automatic activation: Arrow key both moves focus AND fires the action immediately.
        if (!manualActivation && target != null && selectAction != null && selectAction.length > 0) {
          void runtime.callAction(target, selectAction, { trigger: target });
        }
        handled = true;
      } else if (e.key === "Home") {
        const enabled = items.filter((i) => !isDisabled(i));
        if (enabled.length > 0) {
          rovingMoveFocus(items, enabled[0]);
          if (!manualActivation && selectAction != null && selectAction.length > 0) {
            void runtime.callAction(enabled[0], selectAction, { trigger: enabled[0] });
          }
        }
        handled = true;
      } else if (e.key === "End") {
        const enabled = items.filter((i) => !isDisabled(i));
        if (enabled.length > 0) {
          const last = enabled[enabled.length - 1];
          rovingMoveFocus(items, last);
          if (!manualActivation && selectAction != null && selectAction.length > 0) {
            void runtime.callAction(last, selectAction, { trigger: last });
          }
        }
        handled = true;
      } else if (e.key === "Enter" || e.key === " ") {
        // Manual activation: Enter / Space activates the currently focused tab.
        // In automatic-activation mode Enter / Space are also handled here as a
        // no-op path (the action already fired on arrow key focus); we still
        // preventDefault so Space doesn't scroll the page.
        if (manualActivation && focused != null && !isDisabled(focused) && selectAction != null && selectAction.length > 0) {
          void runtime.callAction(focused, selectAction, { trigger: focused });
        }
        handled = true;
      } else if (e.key === "Escape") {
        if (escapeAction != null && escapeAction.length > 0) {
          void runtime.callAction(root, escapeAction, { trigger: root });
        }
        handled = true;
      } else if (e.key === "ArrowDown" && isHorizontal) {
        // Additive: horizontal-bar ArrowDown opens submenu (APG Menubar pattern).
        // In HORIZONTAL roving mode, ArrowDown on a top-level item that has aria-haspopup="menu"
        // dispatches the same lv:collection-submenu-open event that vertical ArrowRight dispatches.
        // Guard: only when orientation is horizontal (in vertical menus ArrowDown is the navigation
        // key, already consumed by the isNextKey block above; this branch is only reached when
        // isHorizontal=true AND the key is ArrowDown, which is NOT in isNextKey for horizontal).
        // When the focused item does NOT have aria-haspopup="menu", the key is not consumed (noop).
        if (focused != null && focused.getAttribute("aria-haspopup") === "menu") {
          focused.dispatchEvent(new CustomEvent(SUBMENU_OPEN_EVENT, { bubbles: true, cancelable: true }));
          handled = true;
        }
      } else if (e.key === "ArrowRight" && !isHorizontal) {
        // Additive: submenu open. ArrowRight on a vertical menu item that is a submenu parent
        // (aria-haspopup="menu") dispatches lv:collection-submenu-open on that item. The adopting
        // component listens for this event to open the child panel. Guard: only when orientation
        // is NOT horizontal (in horizontal menus ArrowRight is already the navigation key, handled
        // in the isNextKey block above; this branch is therefore never reached for horizontal menus).
        // When the focused item is NOT a submenu parent, this is a no-op (key not consumed).
        if (focused != null && focused.getAttribute("aria-haspopup") === "menu") {
          focused.dispatchEvent(new CustomEvent(SUBMENU_OPEN_EVENT, { bubbles: true, cancelable: true }));
          handled = true;
        }
      } else if (e.key === "ArrowLeft" && !isHorizontal) {
        // Additive: submenu close via ArrowLeft in a vertical menu. Fires the escape action so the
        // consuming component can close the submenu and return focus to the parent item. In menus
        // without a submenu context, the escape action closes the whole menu, which matches the
        // APG recommendation that ArrowLeft in a submenu closes it and returns to the parent menu.
        // Guard: only when orientation is NOT horizontal (horizontal menus use ArrowLeft as the
        // prev-navigation key, already consumed by the isPrevKey block above).
        if (escapeAction != null && escapeAction.length > 0) {
          void runtime.callAction(root, escapeAction, { trigger: root });
          handled = true;
        }
      } else if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        // Additive: typeahead in roving-tabindex mode. Mirrors the activedescendant branch.
        // The current focused item is the one with tabindex=0; onMatch moves DOM focus to it.
        const focusedForTypeahead = rovingGetFocused(items);
        handleTypeahead(e.key, focusedForTypeahead, (match) => rovingMoveFocus(items, match));
        handled = true;
      }
    } else {
      // -----------------------------------------------------------------------
      // aria-activedescendant model (APG Listbox / Menu, default)
      // -----------------------------------------------------------------------
      const active = getActive(root);

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
        handleTypeahead(e.key, getActive(root), (match) => setActive(root, match));
        handled = true;
      }
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
