/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * radio-group.enhancer.ts
 *
 * Roving-tabindex keyboard navigation for the lievit-ui radio-group custom variant
 * (role="radiogroup" + role="radio"). Mounts on elements with
 * `data-lievit-enhancer="radio-group"`. NOT used for the native variant
 * (`nativeInputs=true`) — the platform supplies identical behavior for real
 * <input type="radio"> elements sharing a `name`.
 *
 * A11y source: WAI-ARIA APG Radio Group, https://www.w3.org/WAI/ARIA/apg/patterns/radio/
 * Keyboard map (verbatim APG):
 *   ArrowDown / ArrowRight  -> next non-disabled option (wrap); check it; uncheck prev.
 *   ArrowUp   / ArrowLeft   -> prev non-disabled option (wrap); check it; uncheck prev.
 *   Space                   -> check focused option if unchecked; no-op if already checked.
 *   Enter                   -> no action (APG: only Space activates; Enter is not bound).
 *   Tab / Shift+Tab         -> platform exits/enters the group (roving: one tabindex=0 at a time).
 *
 * NOT the collection-nav enhancer (which uses aria-activedescendant for listbox/menu).
 * Radio groups use DIRECT focus movement: the focused element IS the active option.
 *
 * Responsibilities (§6 of the spec):
 *   1. Roving-tabindex maintenance on mount and after morph.
 *   2. Arrow-key navigation (next/prev, wrap, skip disabled, update aria-checked).
 *   3. Space-key activation (check if unchecked; no-op if already checked).
 *   4. lievit:radio-change CustomEvent dispatch on the root after every state change.
 *   5. Post-morph reconciliation (onComponentUpdate lifecycle).
 */

import type { LievitRuntime } from "../../runtime/runtime.js";

const ENHANCER_ATTR = "data-lievit-enhancer";
const ENHANCER_VALUE = "radio-group";
const ACTIVE_ATTR = "data-lievit-rt-rg-active";

/** Returns all role="radio" option elements in a radiogroup root. */
function getOptions(root: Element): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>('[role="radio"]'));
}

/** Returns whether an option is disabled (aria-disabled="true"). */
function isDisabled(option: HTMLElement): boolean {
  return option.getAttribute("aria-disabled") === "true";
}

/**
 * Returns the option that is currently checked (aria-checked="true"), or null.
 */
function getChecked(options: HTMLElement[]): HTMLElement | null {
  return options.find((o) => o.getAttribute("aria-checked") === "true") ?? null;
}

/**
 * Returns the first non-disabled option, or the first option if all are disabled
 * (preserves structural reachability per spec §4 Focus management).
 */
function getFirstTabStop(options: HTMLElement[]): HTMLElement | null {
  if (options.length === 0) {
    return null;
  }
  return options.find((o) => !isDisabled(o)) ?? options[0];
}

/**
 * Updates roving tabindex: exactly one option gets tabindex=0, all others -1.
 * The tabindex=0 option is: the checked one if any; otherwise the first non-disabled.
 */
function syncTabindex(options: HTMLElement[]): void {
  const checked = getChecked(options);
  const tabStop = checked ?? getFirstTabStop(options);
  for (const opt of options) {
    opt.tabIndex = opt === tabStop ? 0 : -1;
  }
}

/**
 * Moves to the next (delta=1) or previous (delta=-1) non-disabled option, wrapping.
 * Returns the new target, or null if there are no non-disabled options.
 */
function nextOption(
  options: HTMLElement[],
  current: HTMLElement | null,
  delta: 1 | -1,
): HTMLElement | null {
  const enabled = options.filter((o) => !isDisabled(o));
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
  const next = (idx + delta + enabled.length) % enabled.length;
  return enabled[next];
}

/**
 * Checks `target` and unchecks all others. Updates tabindex. Moves DOM focus to target.
 * Dispatches both a synthetic DOM `change` event and a `lievit:radio-change` CustomEvent.
 */
function selectOption(root: Element, options: HTMLElement[], target: HTMLElement): void {
  const name = root.getAttribute("id")?.replace(/^rg-/, "") ?? "";
  const optionValue = target.getAttribute("data-value") ?? "";

  for (const opt of options) {
    opt.setAttribute("aria-checked", opt === target ? "true" : "false");
    opt.tabIndex = opt === target ? 0 : -1;
  }

  target.focus();

  // Standard DOM change event (for plain <form> submissions and generic listeners).
  root.dispatchEvent(new Event("change", { bubbles: true, cancelable: false }));

  // lievit:radio-change CustomEvent (for l:change bindings on the consuming template).
  root.dispatchEvent(
    new CustomEvent("lievit:radio-change", {
      bubbles: true,
      cancelable: false,
      detail: { name, value: optionValue },
    }),
  );
}

interface RadioGroupState {
  readonly keyHandler: EventListener;
}

/** Active radio groups keyed by root element. */
const activeGroups = new Map<Element, RadioGroupState>();

function activateGroup(root: Element): void {
  if (activeGroups.has(root)) {
    // Already active: re-sync tabindex in case a morph changed checked state.
    syncTabindex(getOptions(root));
    return;
  }
  root.setAttribute(ACTIVE_ATTR, "");

  const keyHandler: EventListener = (rawEvent: Event): void => {
    const e = rawEvent as KeyboardEvent;
    const options = getOptions(root);

    // Find the currently focused option (the one with tabindex=0 or document.activeElement).
    const focused = options.find((o) => o === document.activeElement) ?? null;

    let handled = false;

    if (e.key === "ArrowDown" || e.key === "ArrowRight") {
      const target = nextOption(options, focused, 1);
      if (target != null) {
        selectOption(root, options, target);
      }
      handled = true;
    } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
      const target = nextOption(options, focused, -1);
      if (target != null) {
        selectOption(root, options, target);
      }
      handled = true;
    } else if (e.key === " ") {
      // Space: check the focused option if not already checked (APG).
      if (focused != null && !isDisabled(focused)) {
        if (focused.getAttribute("aria-checked") !== "true") {
          selectOption(root, options, focused);
        }
      }
      handled = true;
    }
    // Enter: no-op (APG Radio Group does not bind Enter).

    if (handled) {
      e.preventDefault();
    }
  };

  root.addEventListener("keydown", keyHandler);
  syncTabindex(getOptions(root));
  activeGroups.set(root, { keyHandler });
}

function deactivateGroup(root: Element): void {
  const state = activeGroups.get(root);
  if (state == null) {
    return;
  }
  activeGroups.delete(root);
  root.removeAttribute(ACTIVE_ATTR);
  root.removeEventListener("keydown", state.keyHandler);
}

function scanRoot(root: Element): void {
  if (
    root.getAttribute(ENHANCER_ATTR) === ENHANCER_VALUE &&
    root.getAttribute("role") === "radiogroup"
  ) {
    activateGroup(root);
  }
  for (const el of Array.from(
    root.querySelectorAll<Element>(
      `[${ENHANCER_ATTR}="${ENHANCER_VALUE}"][role="radiogroup"]`,
    ),
  )) {
    activateGroup(el);
  }
}

/**
 * Installs the radio-group enhancer on a runtime.
 *
 * Registers `onComponentInit` (mount + post-morph) and `afterCall` (cleanup stale roots)
 * lifecycle hooks via the public runtime extension API (ADR-0019: registry IS the API).
 *
 * @param runtime the started LievitRuntime to extend
 * @returns an unsubscribe function
 */
export function installRadioGroup(runtime: LievitRuntime): () => void {
  return runtime.use({
    onComponentInit(ctx): void {
      scanRoot(ctx.root);
    },
    afterCall(outcome): void {
      // Re-scan after every wire morph: new group roots may appear; checked state may change.
      scanRoot(outcome.root);
      // Remove stale roots that were unmounted by the morph.
      for (const [groupRoot] of activeGroups) {
        if (!document.body.contains(groupRoot)) {
          deactivateGroup(groupRoot);
        }
      }
    },
  });
}
