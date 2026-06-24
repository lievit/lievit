/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * input-count enhancer (v-next spec §6): the CSP-clean typed-TS that drives the two optional
 * behaviours of the `lievit/input.jte` partial:
 *
 *   1. **Character count badge** (`showCount=true`): writes the current length — formatted as
 *      "x / max" when `data-lv-count-max` is set, or bare "x" otherwise — into the sibling
 *      `[data-lv-count]` span on every `input` event.
 *
 *   2. **Clearable button** (`clearable=true`): shows/hides the `[data-lv-clear]` button as
 *      the field acquires or loses a value; fires a composed `lv:clear` CustomEvent on the
 *      `<input>` element when the button is clicked, then resets the field to "".
 *
 * Both behaviours are purely additive: a field with neither `[data-lv-count]` nor `[data-lv-clear]`
 * is untouched. CSP-clean: no `eval`, no `Function`, no `innerHTML`, no inline event handlers.
 *
 * Lifecycle:
 *   - Call `enhanceInput(container)` once per `[data-slot="input"]` container after render.
 *   - Call `enhanceAllInputs(scope?)` on `DOMContentLoaded` and after every WIRE morph
 *     (`onComponentInit` lifecycle hook on the parent WIRE component) to re-bind dynamically
 *     rendered inputs. Already-enhanced containers are skipped (idempotent).
 */

/** Sentinel attribute to skip already-enhanced containers. */
const ENHANCED = "data-lv-input-enhanced";

/**
 * Update the count badge text and the clearable button state for a given container + input.
 */
function syncCount(
  container: HTMLElement,
  input: HTMLInputElement,
): void {
  const countEl = container.querySelector<HTMLElement>("[data-lv-count]");
  if (countEl) {
    const len = input.value.length;
    const maxAttr = input.getAttribute("data-lv-count-max");
    countEl.textContent = maxAttr ? `${len} / ${maxAttr}` : String(len);
  }
}

/**
 * Update the visibility and tab-reachability of the clear button.
 * Shown (tabindex="0", no hidden attr) when the field has a value; hidden otherwise.
 */
function syncClear(
  container: HTMLElement,
  input: HTMLInputElement,
): void {
  const clearBtn = container.querySelector<HTMLButtonElement>("[data-lv-clear]");
  if (!clearBtn) return;
  const hasValue = input.value.length > 0;
  if (hasValue) {
    clearBtn.removeAttribute("hidden");
    clearBtn.setAttribute("tabindex", "0");
  } else {
    clearBtn.setAttribute("hidden", "");
    clearBtn.setAttribute("tabindex", "-1");
  }
}

/**
 * Enhance one `[data-slot="input"]` container. No-op if already enhanced or no native `<input>`.
 */
export function enhanceInput(container: HTMLElement): void {
  if (container.hasAttribute(ENHANCED)) return;
  const input = container.querySelector<HTMLInputElement>("[data-slot=\"input-field\"]");
  if (!input) return;
  container.setAttribute(ENHANCED, "");

  // Initial state sync on mount.
  syncCount(container, input);
  syncClear(container, input);

  // Live updates on every keystroke/paste/cut.
  input.addEventListener("input", () => {
    syncCount(container, input);
    syncClear(container, input);
  });

  // Clear button click: wipe the value, dispatch the lv:clear event, re-sync.
  const clearBtn = container.querySelector<HTMLButtonElement>("[data-lv-clear]");
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      input.value = "";
      // Dispatch a composed CustomEvent so the consuming template or WIRE runtime can intercept
      // it on any ancestor. The l:model binding will naturally see the cleared value when
      // its own `input` listener fires after this synthetic clear.
      input.dispatchEvent(
        new CustomEvent("lv:clear", { bubbles: true, composed: true }),
      );
      // Also fire a synthetic input event so that l:model and any other input listeners
      // (including the count/clear sync above) react to the now-empty value.
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.focus();
    });
  }
}

/**
 * Enhance every `[data-slot="input"]` container within `scope` (defaults to `document`).
 * Call on `DOMContentLoaded` and after WIRE morphs (`onComponentInit`).
 */
export function enhanceAllInputs(scope: ParentNode = document): void {
  scope
    .querySelectorAll<HTMLElement>("[data-slot=\"input\"]")
    .forEach((container) => enhanceInput(container));
}
