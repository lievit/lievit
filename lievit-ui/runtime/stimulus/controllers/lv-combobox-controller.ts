/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * `lv-combobox` -- the WAI-ARIA APG Combobox-with-listbox-popup behaviour, as a Stimulus controller
 * (the conversion of the colocated `registry/jte/combobox.enhancer.ts`). Mounted on the combobox
 * ROOT via `data-controller="lv-combobox"`. JS-OFF the partial is already a real
 * `<input role="combobox">` + `<ul role="listbox">` + `<input type="hidden">` (form-bound, fully
 * accessible); this controller is the progressive-enhancement upgrade that activates filtering,
 * open/close, selection write-back, and blur commits over the SAME server-rendered option set.
 *
 * Doctrine carried through the conversion (unchanged):
 *
 * - **Controlled / uncontrolled (wire-410 fix)**: the combobox dropdown is an UNCONTROLLED overlay
 *   -- its open state is pure client cosmetic (a filter list), never server-owned. So on
 *   light-dismiss it fires NO wire round-trip. The doctrine lives ONCE in
 *   {@link DismissableController.dismissViaWire}; here {@link wireCloseAction} is overridden to read
 *   `data-lv-wire-close` from the LISTBOX (the popover) rather than the root, and the template
 *   deliberately does NOT stamp it -> `dismissViaWire` is a no-op (uncontrolled-silent by
 *   construction, not by a hardcoded skip). A server-controlled combobox would only need to stamp
 *   the attribute; nothing else changes.
 * - **single-source keyboard a11y**: ArrowUp/Down/Home/End navigation inside the listbox stays owned
 *   by the shared `collection-nav.enhancer.ts` (the listbox keeps `data-lievit-collection` +
 *   `aria-activedescendant` target = the input). This controller intercepts keydown on the `<input>`
 *   and re-dispatches the navigation keys to the `<ul>` so collection-nav owns roving + typeahead;
 *   it NEVER re-derives that logic.
 * - **DOM focus never leaves the input** (APG combobox vs menu distinction): the active option is
 *   virtual (`aria-activedescendant`); the listbox items never receive real focus.
 * - **shadcn DOM namespace**: every hook is a `data-slot` attribute (`combobox-input`,
 *   `combobox-listbox`, `combobox-toggle`, `combobox-clear`, `combobox-hidden`, `combobox-option`).
 *
 * Morph-safety: every event is wired via `data-action` in the template (so Stimulus re-binds it
 * automatically when the wire morph re-renders the element), except the listbox `MutationObserver`
 * (re-apply the filter after an async swap of the listbox body), which is bound in `connect()` and
 * torn down in `disconnect()`. No `data-combobox-enhanced` marker, no `WeakSet`, no `afterCall`
 * sweep -- Stimulus owns connect/disconnect, so the idempotency and the listener teardown are free.
 *
 * a11y source: WAI-ARIA APG Combobox with listbox popup
 *   https://www.w3.org/WAI/ARIA/apg/patterns/combobox/examples/combobox-autocomplete-list/
 */

import { DismissableController } from "../base/dismissable-controller.js";

const ITEM_ATTR = "data-lievit-item";
const WIRE_CLOSE_ATTR = "data-lv-wire-close";
const POPOVER_OPEN_ATTR = "data-popover-open";

/** Debounce for the text filter, in ms (matches the legacy enhancer). */
const FILTER_DEBOUNCE_MS = 150;

/** Lowercase + strip diacritics so "Citta" matches "città". */
function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

export default class LvComboboxController extends DismissableController<HTMLElement> {
  static targets = ["input", "listbox", "hidden", "toggle", "control"];

  declare readonly inputTarget: HTMLInputElement;
  declare readonly listboxTarget: HTMLElement;
  declare readonly hasHiddenTarget: boolean;
  declare readonly hiddenTarget: HTMLInputElement;
  declare readonly hasToggleTarget: boolean;
  declare readonly toggleTarget: HTMLButtonElement;
  declare readonly hasControlTarget: boolean;
  declare readonly controlTarget: HTMLElement;

  /** The committed selection value (mirrors the hidden form input). */
  private committedValue = "";
  /** The label for the committed value (what the visible input reverts to in select-only mode). */
  private committedLabel = "";
  private filterTimer: ReturnType<typeof setTimeout> | null = null;
  private observer: MutationObserver | null = null;

  /**
   * The overlay-dismiss doctrine reads the close action from the LISTBOX (the popover), not the
   * controller root. The combobox is uncontrolled, so the template does not stamp it -> null ->
   * {@link DismissableController.dismissViaWire} is a no-op (uncontrolled-silent).
   */
  override get wireCloseAction(): string | null {
    const v = this.listboxTarget.getAttribute(WIRE_CLOSE_ATTR);
    return v != null && v.length > 0 ? v : null;
  }

  connect(): void {
    // Seed committed value/label from the server-rendered hidden input + matching option (re-read on
    // every (re)connect, so a wire morph that re-renders a new committed value is picked up cleanly).
    this.committedValue = this.hasHiddenTarget ? this.hiddenTarget.value : "";
    const match = this.options().find(
      (li) => li.getAttribute("data-combobox-option") === this.committedValue,
    );
    this.committedLabel = match?.textContent?.trim() ?? this.committedValue;

    // collection-nav action attributes (parity with the legacy enhancer). In the PARTIAL/uncontrolled
    // context Enter is intercepted on the input before re-dispatch; these are set for correctness.
    this.listboxTarget.setAttribute("data-lievit-collection-select-action", "_lv-combobox-commit");
    this.listboxTarget.setAttribute("data-lievit-collection-escape-action", "_lv-combobox-close");

    // Re-apply the filter after an async (HTMX) swap of the listbox body.
    this.observer = new MutationObserver(() => {
      this.applyFilter(this.inputTarget.value);
      this.updateEmptyState();
    });
    this.observer.observe(this.listboxTarget, { childList: true, subtree: false });

    // Reflect the initial server-rendered value in the (dynamically managed) clear button.
    this.updateClearButton();
  }

  disconnect(): void {
    if (this.filterTimer != null) {
      clearTimeout(this.filterTimer);
      this.filterTimer = null;
    }
    this.observer?.disconnect();
    this.observer = null;
  }

  // --- config (read from the server-rendered data-combobox-* contract) -------------------------

  private get mode(): string {
    return this.element.getAttribute("data-combobox-mode") ?? "select-only";
  }

  private get clearable(): boolean {
    return this.element.getAttribute("data-combobox-clearable") === "true";
  }

  private get emptyText(): string {
    return this.element.getAttribute("data-combobox-empty-text") ?? "No results";
  }

  private options(): HTMLElement[] {
    return Array.from(this.listboxTarget.querySelectorAll<HTMLElement>(`li[role="option"]`));
  }

  // --- open / close (native popover seam) ------------------------------------------------------

  /**
   * Open state is tracked by our own `data-popover-open` attribute (the native `:popover-open`
   * pseudo-class is authoritative in a real browser but absent in the test substrate); the listbox
   * `toggle` event keeps it in sync on light-dismiss.
   */
  private isOpen(): boolean {
    return this.listboxTarget.hasAttribute(POPOVER_OPEN_ATTR);
  }

  private openListbox(): void {
    if (this.isOpen()) {
      return;
    }
    try {
      (this.listboxTarget as HTMLElement & { showPopover?: () => void }).showPopover?.();
    } catch {
      /* popover API unavailable; data-popover-open is sufficient */
    }
    this.listboxTarget.setAttribute(POPOVER_OPEN_ATTR, "");
    this.inputTarget.setAttribute("aria-expanded", "true");
  }

  private closeListbox(): void {
    try {
      (this.listboxTarget as HTMLElement & { hidePopover?: () => void }).hidePopover?.();
    } catch {
      /* popover API unavailable */
    }
    this.listboxTarget.removeAttribute(POPOVER_OPEN_ATTR);
    this.inputTarget.setAttribute("aria-expanded", "false");
    this.inputTarget.setAttribute("aria-activedescendant", "");
    this.clearActiveMarkers();
  }

  private clearActiveMarkers(): void {
    for (const el of Array.from(this.listboxTarget.querySelectorAll<HTMLElement>("[data-active]"))) {
      el.removeAttribute("data-active");
    }
  }

  // --- filter ----------------------------------------------------------------------------------

  private applyFilter(query: string): void {
    const q = normalize(query);
    for (const li of this.options()) {
      const label = li.textContent?.trim() ?? "";
      const matches = q === "" || normalize(label).includes(q);
      if (matches) {
        li.removeAttribute("hidden");
        li.setAttribute(ITEM_ATTR, ""); // ensure collection-nav can navigate it
      } else {
        li.setAttribute("hidden", "");
        li.removeAttribute(ITEM_ATTR); // excluded from collection-nav traversal
      }
    }
    this.updateEmptyState();
  }

  private updateEmptyState(): void {
    let emptyEl = this.listboxTarget.querySelector<HTMLElement>(`[data-slot="combobox-empty"]`);
    const visibleOptions = Array.from(
      this.listboxTarget.querySelectorAll<HTMLElement>(`li[role="option"]:not([hidden])`),
    ).filter((li) => li.getAttribute("data-slot") !== "combobox-empty");

    if (visibleOptions.length === 0) {
      if (!emptyEl) {
        emptyEl = document.createElement("li");
        emptyEl.setAttribute("role", "option");
        emptyEl.setAttribute("aria-disabled", "true");
        emptyEl.setAttribute("data-slot", "combobox-empty");
        emptyEl.className =
          "cursor-default select-none py-[var(--lv-space-3)] px-[var(--lv-space-2)] text-center text-sm text-[var(--lv-color-muted)]";
        this.listboxTarget.appendChild(emptyEl);
      }
      emptyEl.textContent = this.emptyText;
      emptyEl.removeAttribute("hidden");
    } else if (emptyEl) {
      emptyEl.setAttribute("hidden", "");
    }
  }

  // --- commit / clear --------------------------------------------------------------------------

  private commitValue(value: string, label: string): void {
    this.committedValue = value;
    this.committedLabel = label;
    this.inputTarget.value = label;
    if (this.hasHiddenTarget) {
      this.hiddenTarget.value = value;
    }
    for (const li of this.options()) {
      const isSelected = li.getAttribute("data-combobox-option") === value;
      li.setAttribute("aria-selected", isSelected ? "true" : "false");
    }
    this.closeListbox();
  }

  private commitFreeText(): void {
    const text = this.inputTarget.value.trim();
    if (this.mode === "free-type") {
      const match = this.options().find(
        (li) => normalize(li.textContent?.trim() ?? "") === normalize(text),
      );
      if (match) {
        this.commitValue(
          match.getAttribute("data-combobox-option") ?? text,
          match.textContent?.trim() ?? text,
        );
      } else {
        this.committedValue = text;
        this.committedLabel = text;
        if (this.hasHiddenTarget) {
          this.hiddenTarget.value = text;
        }
        this.closeListbox();
      }
    } else {
      // select-only: revert to last committed label.
      this.inputTarget.value = this.committedLabel;
      this.closeListbox();
    }
  }

  private clearValue(): void {
    this.committedValue = "";
    this.committedLabel = "";
    this.inputTarget.value = "";
    if (this.hasHiddenTarget) {
      this.hiddenTarget.value = "";
    }
    for (const li of this.options()) {
      li.setAttribute("aria-selected", "false");
    }
    this.updateClearButton();
    this.applyFilter("");
    this.openListbox();
    this.inputTarget.focus();
  }

  /**
   * The clear button is server-rendered only when `clearable && inputText` is non-empty, so the
   * controller creates/removes it as the text changes. The created button carries the SAME
   * `data-action` the server-rendered one does, so Stimulus binds its click automatically (CSP-clean,
   * morph-safe; no per-element `addEventListener` to leak).
   */
  private updateClearButton(): void {
    if (!this.clearable) {
      return;
    }
    const hasText = this.inputTarget.value.trim().length > 0;
    let clearBtn = this.element.querySelector<HTMLButtonElement>(`[data-slot="combobox-clear"]`);
    if (hasText && !clearBtn) {
      clearBtn = document.createElement("button");
      clearBtn.type = "button";
      clearBtn.setAttribute("data-slot", "combobox-clear");
      clearBtn.setAttribute("aria-label", "Clear");
      clearBtn.setAttribute("data-action", "click->lv-combobox#clear");
      clearBtn.className =
        "flex shrink-0 items-center justify-center px-[var(--lv-space-1)] text-[var(--lv-color-muted)] hover:text-[var(--lv-color-fg)] focus-visible:outline-none focus-visible:shadow-[var(--lv-ring)] rounded-[var(--lv-radius-sm)]";
      clearBtn.innerHTML = `<svg aria-hidden="true" width="0.875rem" height="0.875rem" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
      if (this.hasControlTarget && this.hasToggleTarget) {
        this.controlTarget.insertBefore(clearBtn, this.toggleTarget);
      }
    } else if (!hasText && clearBtn) {
      clearBtn.remove();
    }
  }

  // --- keyboard bridge: <input> keydown -> <ul> (collection-nav owns listbox navigation) -------

  private dispatchToListbox(e: KeyboardEvent): void {
    if (!this.isOpen()) {
      return;
    }
    const synthetic = new KeyboardEvent(e.type, {
      key: e.key,
      altKey: e.altKey,
      ctrlKey: e.ctrlKey,
      shiftKey: e.shiftKey,
      metaKey: e.metaKey,
      bubbles: false,
      cancelable: true,
    });
    this.listboxTarget.dispatchEvent(synthetic);
  }

  // --- actions (wired via data-action in the template) -----------------------------------------

  /** Debounced text filter on every input event; opens the listbox while typing. */
  onInput(): void {
    if (this.filterTimer != null) {
      clearTimeout(this.filterTimer);
    }
    this.filterTimer = setTimeout(() => {
      this.applyFilter(this.inputTarget.value);
      this.updateClearButton();
      this.openListbox();
      this.filterTimer = null;
    }, FILTER_DEBOUNCE_MS);
  }

  /** Focusing the input filters against the current text and opens the listbox. */
  onFocus(): void {
    this.applyFilter(this.inputTarget.value);
    this.openListbox();
  }

  onKeydown(e: KeyboardEvent): void {
    const key = e.key;
    const open = this.isOpen();

    if (key === "Enter") {
      if (open) {
        const activeId = this.inputTarget.getAttribute("aria-activedescendant");
        if (activeId && activeId.length > 0) {
          const activeEl = this.listboxTarget.querySelector<HTMLElement>(`#${CSS.escape(activeId)}`);
          if (activeEl && activeEl.getAttribute("aria-disabled") !== "true") {
            const val =
              activeEl.getAttribute("data-combobox-option") ?? activeEl.textContent?.trim() ?? "";
            const lbl = activeEl.textContent?.trim() ?? val;
            e.preventDefault();
            this.commitValue(val, lbl);
            return;
          }
        }
        if (this.mode === "free-type") {
          e.preventDefault();
          this.commitFreeText();
        }
        // select-only + no active option: no-op (do not prevent Enter).
      }
      return;
    }

    if (key === "Escape") {
      e.preventDefault();
      if (open) {
        this.closeListbox();
      } else {
        this.clearValue();
      }
      return;
    }

    if (key === "ArrowDown" && e.altKey) {
      e.preventDefault();
      this.openListbox();
      return;
    }

    if (key === "ArrowUp" && e.altKey) {
      e.preventDefault();
      this.closeListbox();
      return;
    }

    if (key === "ArrowDown" || key === "ArrowUp") {
      e.preventDefault();
      if (!open) {
        this.openListbox();
      }
      this.dispatchToListbox(e);
      return;
    }

    if ((key === "Home" || key === "End") && open) {
      // Clear active option (editing context returns to input); platform moves the cursor.
      this.inputTarget.setAttribute("aria-activedescendant", "");
      this.clearActiveMarkers();
      // Do NOT preventDefault: platform cursor movement is desired.
      return;
    }

    if ((key === "ArrowLeft" || key === "ArrowRight") && open) {
      const activeId = this.inputTarget.getAttribute("aria-activedescendant");
      if (activeId && activeId.length > 0) {
        this.inputTarget.setAttribute("aria-activedescendant", "");
        this.clearActiveMarkers();
      }
      // Do NOT preventDefault: platform cursor movement is desired.
      return;
    }
  }

  /** The visual toggle affordance (pointer/touch): open+filter+focus the input, or close. */
  onToggleClick(): void {
    if (this.isOpen()) {
      this.closeListbox();
    } else {
      this.applyFilter(this.inputTarget.value);
      this.openListbox();
      this.inputTarget.focus();
    }
  }

  /** Clear button (server-rendered or controller-created): empty the value, reopen, keep focus. */
  clear(e: Event): void {
    e.preventDefault();
    this.clearValue();
  }

  /** Keep DOM focus on the input while clicking an option (APG: focus never enters the listbox). */
  onListboxMousedown(e: Event): void {
    e.preventDefault();
  }

  /** Commit the clicked option. */
  onOptionClick(e: Event): void {
    const li = (e.target as Element).closest<HTMLElement>(`li[role="option"]`);
    if (!li || li.getAttribute("aria-disabled") === "true") {
      return;
    }
    if (li.getAttribute("data-slot") === "combobox-empty") {
      return;
    }
    const val = li.getAttribute("data-combobox-option") ?? li.textContent?.trim() ?? "";
    const lbl = li.textContent?.trim() ?? val;
    this.commitValue(val, lbl);
    this.inputTarget.focus();
  }

  /** Blur commit: when focus leaves the whole combobox, commit (free-type) or revert (select-only). */
  onFocusout(e: FocusEvent): void {
    const next = e.relatedTarget as Node | null;
    if (next && this.element.contains(next)) {
      return;
    }
    this.commitFreeText();
  }

  /**
   * The native popover `toggle` event (light-dismiss / click-outside). Sync our open-state mirror,
   * then run the dismiss doctrine: uncontrolled => no wire call (the combobox never stamps
   * `data-lv-wire-close`); a controlled variant would round-trip via the base.
   */
  onListboxToggle(rawEvent: Event): void {
    const newState =
      (rawEvent as unknown as { newState?: string }).newState ?? (rawEvent as ToggleEvent).newState;
    if (newState === "closed") {
      this.listboxTarget.removeAttribute(POPOVER_OPEN_ATTR);
      this.inputTarget.setAttribute("aria-expanded", "false");
      this.inputTarget.setAttribute("aria-activedescendant", "");
      // Controlled/uncontrolled doctrine (no-op for the uncontrolled combobox).
      this.dismissViaWire(this.listboxTarget, { trigger: this.listboxTarget });
    } else if (newState === "open") {
      this.listboxTarget.setAttribute(POPOVER_OPEN_ATTR, "");
      this.inputTarget.setAttribute("aria-expanded", "true");
    }
  }
}
