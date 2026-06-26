/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * combobox.enhancer.ts (v-next) -- progressive-enhancement upgrade for the server-rendered
 * lievit/combobox.jte partial (ADR-0012, architecture-contract §2.b PARTIAL + colocated enhancer).
 *
 * JS-OFF baseline: the server renders a real <input type="text" role="combobox"> (the text field),
 * a <ul role="listbox"> with <li role="option" data-lievit-item> (always in the DOM, hidden via
 * native popover for aria-controls resolution), and a <input type="hidden"> (the committed value
 * carried in a form POST). Fully accessible and form-functional without any JavaScript.
 *
 * JS-ON this enhancer activates each [data-lievit-combobox] root and wires:
 *   (a) TEXT FILTER: input events debounce-filter the visible options by toggling [hidden] on each
 *       <li> (the collection-nav read of [data-lievit-item] skips hidden items automatically so no
 *       special registration is needed).
 *   (b) OPEN / CLOSE: the listbox <ul> is a native popover; this enhancer shows/hides it by calling
 *       showPopover() / hidePopover() and syncs aria-expanded on the input.
 *   (c) SELECTION WRITE-BACK: on commit, the hidden <input type="hidden"> value is updated so the
 *       form always POSTs the correct committed value.
 *   (d) BLUR COMMITS: on blur from the combobox (focus leaving the root entirely), free-type mode
 *       commits the typed text; select-only mode reverts to the last committed label.
 *   (e) KEYBOARD DISPATCH: keydown on the <input> is inspected; arrow/home/end/escape/enter events
 *       that concern the open listbox are re-dispatched to the <ul> so collection-nav.enhancer.ts
 *       (the shared owner of aria-activedescendant + roving navigation) handles them. This is the
 *       single-source-a11y pattern: we do NOT re-implement what collection-nav already owns.
 *
 * collection-nav.enhancer.ts is the shared owner of:
 *   - Arrow Up/Down navigation in the listbox (aria-activedescendant + [data-active] attribute).
 *   - Home/End jump to first/last item.
 *   - Enter to commit the active item (via data-lievit-collection-select-action on the <ul>).
 *   - Escape to close (via data-lievit-collection-escape-action on the <ul>).
 *   - Typeahead (printable chars while an option is active).
 * This enhancer NEVER re-derives any of the above; it bridges the <input> keydown to the <ul>.
 *
 * The pure filter logic ({@link filterOptions}) is exported and DOM-free so it can be unit-tested.
 *
 * Idempotent: call {@link enhanceCombobox} once (marks the root with data-combobox-enhanced);
 * already-enhanced roots are skipped. {@link enhanceAllComboboxes} wires every root in scope.
 */

const ENHANCED = "data-combobox-enhanced";
const ITEM_ATTR = "data-lievit-item";

/** A flat option entry for the pure filter function. */
export interface ComboboxOption {
  value: string;
  label: string;
  disabled: boolean;
}

// ---------------------------------------------------------------------------
// Pure filter (DOM-free, exportable for unit tests)
// ---------------------------------------------------------------------------

/**
 * Filter a flat option list by a query, case- and accent-insensitively, matching anywhere in the
 * label (substring), preserving order. An empty/blank query returns every option unchanged.
 */
export function filterOptions(options: ComboboxOption[], query: string): ComboboxOption[] {
  const q = normalize(query);
  if (q === "") return options.slice();
  return options.filter((o) => normalize(o.label).includes(q));
}

/** Lowercase + strip diacritics so "Citta" matches "città". */
function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

// ---------------------------------------------------------------------------
// Main enhance function
// ---------------------------------------------------------------------------

/**
 * Enhance one combobox root. No-op if already enhanced or missing the required DOM structure.
 */
export function enhanceCombobox(root: HTMLElement): void {
  if (root.hasAttribute(ENHANCED)) return;

  // Migration guard (Stimulus conversion): a root converted to the `lv-combobox` Stimulus controller
  // owns its own behaviour. This legacy enhancer must NOT also wire it, or the input/listbox would be
  // double-handled. Converted templates carry data-controller="lv-combobox".
  if (root.matches('[data-controller~="lv-combobox"]')) {
    root.setAttribute(ENHANCED, "");
    return;
  }

  const listboxQuery = root.querySelector<HTMLElement>(`[data-slot="combobox-listbox"]`);
  const inputQuery = root.querySelector<HTMLInputElement>(`[data-slot="combobox-input"]`);
  const hiddenInput = root.querySelector<HTMLInputElement>(`[data-slot="combobox-hidden"]`);
  const toggleBtn = root.querySelector<HTMLButtonElement>(`[data-slot="combobox-toggle"]`);

  if (!listboxQuery || !inputQuery) return;
  // Narrow to non-null locals used throughout the closure.
  const listbox: HTMLElement = listboxQuery;
  const input: HTMLInputElement = inputQuery;
  root.setAttribute(ENHANCED, "");

  const mode = root.getAttribute("data-combobox-mode") ?? "select-only";
  const clearableAttr = root.getAttribute("data-combobox-clearable") === "true";

  // JS-OFF / JS-ON ownership handoff (parity with the lv-combobox controller): the server renders the
  // hidden carrier(s) `disabled` + the native <select> under the real `name`, so a no-JS submit posts
  // via the native control. Now that JS owns the value, disable the native one and enable the hidden
  // carrier(s) so exactly one control submits under `name` (no double-submit). A disabled combobox
  // keeps its hidden carrier disabled, mirroring native disabled-select semantics.
  const nativeSelect = root.querySelector<HTMLSelectElement>("[data-combobox-native]");
  if (nativeSelect) nativeSelect.disabled = true;
  if (!input.disabled) {
    for (const h of Array.from(
      root.querySelectorAll<HTMLInputElement>(`input[data-slot="combobox-hidden"]`),
    )) {
      h.disabled = false;
    }
  }

  // Committed value: the hidden input carries it. Label = the matching option's text.
  let committedValue = hiddenInput?.value ?? "";
  let committedLabel = (() => {
    const match = Array.from(
      listbox.querySelectorAll<HTMLElement>(`li[role="option"]`),
    ).find((li) => li.getAttribute("data-combobox-option") === committedValue);
    return match?.textContent?.trim() ?? committedValue;
  })();

  // ---------------------------------------------------------------------------
  // Popover open / close
  // ---------------------------------------------------------------------------

  // The open state is tracked by data-popover-open (our canonical attribute) which the enhancer
  // always sets/removes. The native :popover-open pseudo-class is authoritative in a real browser
  // but is not supported in jsdom; we rely on our own attribute which the popover toggle event
  // also keeps in sync (see toggle listener below).
  function isOpen(): boolean {
    return listbox.hasAttribute("data-popover-open");
  }

  function openListbox(): void {
    if (!isOpen()) {
      try {
        (listbox as HTMLElement & { showPopover?: () => void }).showPopover?.();
      } catch { /* popover API not available; data-popover-open is sufficient */ }
      listbox.setAttribute("data-popover-open", "");
      input.setAttribute("aria-expanded", "true");
    }
  }

  function closeListbox(): void {
    try {
      (listbox as HTMLElement & { hidePopover?: () => void }).hidePopover?.();
    } catch { /* popover API not available */ }
    listbox.removeAttribute("data-popover-open");
    input.setAttribute("aria-expanded", "false");
    input.setAttribute("aria-activedescendant", "");
    for (const el of Array.from(listbox.querySelectorAll<HTMLElement>("[data-active]"))) {
      el.removeAttribute("data-active");
    }
  }

  // ---------------------------------------------------------------------------
  // Filter
  // ---------------------------------------------------------------------------

  function applyFilter(query: string): void {
    const q = normalize(query);
    for (const li of Array.from(
      listbox.querySelectorAll<HTMLElement>(`li[role="option"]`),
    )) {
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
    updateEmptyState();
  }

  function updateEmptyState(): void {
    const emptyText = root.getAttribute("data-combobox-empty-text") ?? "No results";
    let emptyEl = listbox.querySelector<HTMLElement>(`[data-slot="combobox-empty"]`);
    const visibleOptions = Array.from(
      listbox.querySelectorAll<HTMLElement>(`li[role="option"]:not([hidden])`),
    ).filter((li) => li.getAttribute("data-slot") !== "combobox-empty");

    if (visibleOptions.length === 0) {
      if (!emptyEl) {
        emptyEl = document.createElement("li");
        emptyEl.setAttribute("role", "option");
        emptyEl.setAttribute("aria-disabled", "true");
        emptyEl.setAttribute("data-slot", "combobox-empty");
        emptyEl.className =
          "cursor-default select-none py-[var(--lv-space-3)] px-[var(--lv-space-2)] text-center text-sm text-[var(--lv-color-muted)]";
        listbox.appendChild(emptyEl);
      }
      emptyEl.textContent = emptyText;
      emptyEl.removeAttribute("hidden");
    } else {
      if (emptyEl) emptyEl.setAttribute("hidden", "");
    }
  }

  // ---------------------------------------------------------------------------
  // Commit
  // ---------------------------------------------------------------------------

  function commitValue(value: string, label: string): void {
    committedValue = value;
    committedLabel = label;
    input.value = label;
    if (hiddenInput) hiddenInput.value = value;
    for (const li of Array.from(listbox.querySelectorAll<HTMLElement>(`li[role="option"]`))) {
      const isSelected = li.getAttribute("data-combobox-option") === value;
      li.setAttribute("aria-selected", isSelected ? "true" : "false");
    }
    closeListbox();
  }

  function commitFreeText(): void {
    const text = input.value.trim();
    if (mode === "free-type") {
      const match = Array.from(listbox.querySelectorAll<HTMLElement>(`li[role="option"]`)).find(
        (li) => normalize(li.textContent?.trim() ?? "") === normalize(text),
      );
      if (match) {
        commitValue(
          match.getAttribute("data-combobox-option") ?? text,
          match.textContent?.trim() ?? text,
        );
      } else {
        committedValue = text;
        committedLabel = text;
        if (hiddenInput) hiddenInput.value = text;
        closeListbox();
      }
    } else {
      // select-only: revert to last committed label.
      input.value = committedLabel;
      closeListbox();
    }
  }

  function clearValue(): void {
    committedValue = "";
    committedLabel = "";
    input.value = "";
    if (hiddenInput) hiddenInput.value = "";
    for (const li of Array.from(listbox.querySelectorAll<HTMLElement>(`li[role="option"]`))) {
      li.setAttribute("aria-selected", "false");
    }
    updateClearButton();
    applyFilter("");
    openListbox();
    input.focus();
  }

  // ---------------------------------------------------------------------------
  // Clear button (dynamically managed since the server only renders it when text is present)
  // ---------------------------------------------------------------------------

  function updateClearButton(): void {
    if (!clearableAttr) return;
    const hasText = input.value.trim().length > 0;
    let clearBtn = root.querySelector<HTMLButtonElement>(`[data-slot="combobox-clear"]`);
    if (hasText && !clearBtn) {
      clearBtn = document.createElement("button");
      clearBtn.type = "button";
      clearBtn.setAttribute("data-slot", "combobox-clear");
      clearBtn.setAttribute("aria-label", "Clear");
      clearBtn.className =
        "flex shrink-0 items-center justify-center px-[var(--lv-space-1)] text-[var(--lv-color-muted)] hover:text-[var(--lv-color-fg)] focus-visible:outline-none focus-visible:shadow-[var(--lv-ring)] rounded-[var(--lv-radius-sm)]";
      clearBtn.innerHTML = `<svg aria-hidden="true" width="0.875rem" height="0.875rem" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
      clearBtn.addEventListener("click", (e) => {
        e.preventDefault();
        clearValue();
      });
      const control = root.querySelector(`[data-slot="combobox-control"]`);
      if (control && toggleBtn) {
        control.insertBefore(clearBtn, toggleBtn);
      }
    } else if (!hasText && clearBtn) {
      clearBtn.remove();
    }
  }

  // ---------------------------------------------------------------------------
  // Keyboard bridging: <input> keydown → <ul> (collection-nav owns listbox navigation)
  // ---------------------------------------------------------------------------

  function dispatchToListbox(e: KeyboardEvent): void {
    if (!isOpen()) return;
    const synthetic = new KeyboardEvent(e.type, {
      key: e.key,
      altKey: e.altKey,
      ctrlKey: e.ctrlKey,
      shiftKey: e.shiftKey,
      metaKey: e.metaKey,
      bubbles: false,
      cancelable: true,
    });
    listbox.dispatchEvent(synthetic);
  }

  // ---------------------------------------------------------------------------
  // collection-nav action attributes — set so collection-nav fires on Enter/Escape.
  // In a real Wire context collection-nav would call runtime.callAction; in the
  // PARTIAL/uncontrolled context we intercept Enter on the input BEFORE re-dispatch
  // (see keydown handler below). The attributes are still set for correctness.
  // ---------------------------------------------------------------------------

  listbox.setAttribute("data-lievit-collection-select-action", "_lv-combobox-commit");
  listbox.setAttribute("data-lievit-collection-escape-action", "_lv-combobox-close");

  // ---------------------------------------------------------------------------
  // Input events
  // ---------------------------------------------------------------------------

  let filterTimer: ReturnType<typeof setTimeout> | null = null;

  input.addEventListener("input", () => {
    if (filterTimer != null) clearTimeout(filterTimer);
    filterTimer = setTimeout(() => {
      applyFilter(input.value);
      updateClearButton();
      openListbox();
      filterTimer = null;
    }, 150);
  });

  input.addEventListener("focus", () => {
    applyFilter(input.value);
    openListbox();
  });

  input.addEventListener("keydown", (e: KeyboardEvent) => {
    const key = e.key;
    const open = isOpen();

    if (key === "Enter") {
      if (open) {
        const activeId = input.getAttribute("aria-activedescendant");
        if (activeId && activeId.length > 0) {
          const activeEl = listbox.querySelector<HTMLElement>(`#${CSS.escape(activeId)}`);
          if (activeEl && activeEl.getAttribute("aria-disabled") !== "true") {
            const val =
              activeEl.getAttribute("data-combobox-option") ?? activeEl.textContent?.trim() ?? "";
            const lbl = activeEl.textContent?.trim() ?? val;
            e.preventDefault();
            commitValue(val, lbl);
            return;
          }
        }
        if (mode === "free-type") {
          e.preventDefault();
          commitFreeText();
        }
        // select-only + no active option: no-op (do not prevent Enter).
      }
      return;
    }

    if (key === "Escape") {
      e.preventDefault();
      if (open) {
        closeListbox();
      } else {
        clearValue();
      }
      return;
    }

    if (key === "ArrowDown" && e.altKey) {
      e.preventDefault();
      openListbox();
      return;
    }

    if (key === "ArrowUp" && e.altKey) {
      e.preventDefault();
      closeListbox();
      return;
    }

    if (key === "ArrowDown" || key === "ArrowUp") {
      e.preventDefault();
      if (!open) openListbox();
      dispatchToListbox(e);
      return;
    }

    if ((key === "Home" || key === "End") && open) {
      // Clear active option (editing context returns to input); platform moves cursor.
      input.setAttribute("aria-activedescendant", "");
      for (const el of Array.from(listbox.querySelectorAll<HTMLElement>("[data-active]"))) {
        el.removeAttribute("data-active");
      }
      // Do NOT preventDefault: platform cursor movement is desired.
      return;
    }

    if ((key === "ArrowLeft" || key === "ArrowRight") && open) {
      const activeId = input.getAttribute("aria-activedescendant");
      if (activeId && activeId.length > 0) {
        input.setAttribute("aria-activedescendant", "");
        for (const el of Array.from(listbox.querySelectorAll<HTMLElement>("[data-active]"))) {
          el.removeAttribute("data-active");
        }
      }
      // Do NOT preventDefault: platform cursor movement is desired.
      return;
    }
  });

  // ---------------------------------------------------------------------------
  // Toggle button click
  // ---------------------------------------------------------------------------

  if (toggleBtn) {
    toggleBtn.addEventListener("click", () => {
      if (isOpen()) {
        closeListbox();
      } else {
        applyFilter(input.value);
        openListbox();
        input.focus();
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Clear button (server-rendered, if present at init time)
  // ---------------------------------------------------------------------------

  const initClearBtn = root.querySelector<HTMLButtonElement>(`[data-slot="combobox-clear"]`);
  if (initClearBtn) {
    initClearBtn.addEventListener("click", (e) => {
      e.preventDefault();
      clearValue();
    });
  }

  // ---------------------------------------------------------------------------
  // Option click
  // ---------------------------------------------------------------------------

  listbox.addEventListener("mousedown", (e) => {
    e.preventDefault(); // keep focus on the input during click
  });

  listbox.addEventListener("click", (e) => {
    const li = (e.target as Element).closest<HTMLElement>(`li[role="option"]`);
    if (!li || li.getAttribute("aria-disabled") === "true") return;
    if (li.getAttribute("data-slot") === "combobox-empty") return;
    const val = li.getAttribute("data-combobox-option") ?? li.textContent?.trim() ?? "";
    const lbl = li.textContent?.trim() ?? val;
    commitValue(val, lbl);
    input.focus();
  });

  // ---------------------------------------------------------------------------
  // Blur: commit or revert when focus leaves the whole combobox root
  // ---------------------------------------------------------------------------

  root.addEventListener("focusout", (e: FocusEvent) => {
    const next = e.relatedTarget as Node | null;
    if (next && root.contains(next)) return;
    commitFreeText();
  });

  // ---------------------------------------------------------------------------
  // Popover toggle sync: native popover fires a toggle event on light-dismiss.
  // Sync aria-expanded when the browser closes the panel (e.g. click-outside).
  // ---------------------------------------------------------------------------

  listbox.addEventListener("toggle", (rawEvent: Event) => {
    const event = rawEvent as ToggleEvent;
    const newState: string | undefined =
      (event as unknown as { newState?: string }).newState ?? event.newState;
    if (newState === "closed") {
      listbox.removeAttribute("data-popover-open");
      input.setAttribute("aria-expanded", "false");
      input.setAttribute("aria-activedescendant", "");
    } else if (newState === "open") {
      listbox.setAttribute("data-popover-open", "");
      input.setAttribute("aria-expanded", "true");
    }
  });

  // ---------------------------------------------------------------------------
  // MutationObserver: re-apply filter after async HTMX swaps of the listbox body.
  // ---------------------------------------------------------------------------

  const observer = new MutationObserver(() => {
    applyFilter(input.value);
    updateEmptyState();
  });
  observer.observe(listbox, { childList: true, subtree: false });

  // Seed: ensure the clear button reflects the initial server-rendered value.
  updateClearButton();
}

/**
 * Enhance every [data-lievit-combobox] root in scope. Call on DOMContentLoaded + after DOM swaps.
 */
export function enhanceAllComboboxes(scope: ParentNode = document): void {
  scope
    .querySelectorAll<HTMLElement>("[data-lievit-combobox]")
    .forEach((root) => enhanceCombobox(root));
}
