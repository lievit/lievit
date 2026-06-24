/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * tags-input enhancer (ADR-0012, server-first + progressive enhancement): the CSP-clean typed-TS
 * that UPGRADES the server-rendered `lievit/tags-input.jte` partial. Each committed tag is a chip
 * carrying a hidden <input name=...>, so the set POSTs as a repeated `name` with zero JS; JS-OFF
 * an explicit Add submit button round-trips to the server to append a tag. This module makes the
 * editing in-place: it intercepts Enter / delimiter key / the Add button to append a chip + its
 * hidden input WITHOUT a round-trip, removes a chip by deleting its hidden input (cancelling the
 * submit), wires the suggestion buttons as a quick-pick, supports paste splitting on the delimiter,
 * chip keyboard navigation (ArrowLeft/Right/Home/End) via roving tabindex, clear-all, and live
 * region announcements. The hidden inputs stay the form source of truth.
 *
 * No inline script (the strict CSP refuses inline on* handlers; this attaches listeners in code).
 *
 * Chip keyboard model (BUILT against APG Keyboard Interface + raw WAI-ARIA):
 *   ArrowLeft (chip focused)     -> previous chip; wraps to entry input at first chip
 *   ArrowRight (chip focused)    -> next chip; wraps to entry input at last chip
 *   ArrowLeft (entry, pos 0)     -> last chip (if any)
 *   Backspace (entry, empty)     -> removes last chip; focus stays on entry input
 *   Delete / Backspace (chip)    -> removes focused chip; focus moves to next, prev, or entry
 *   Enter (chip)                 -> activates remove (same as Delete)
 *   Space (chip)                 -> activates remove (same as Delete)
 *   Enter / delimiter (entry)    -> commits in-progress text as new tag
 *   Escape (entry)               -> clears the entry input value
 *   Home (chip or entry)         -> first chip
 *   End (chip or entry)          -> last chip, or entry input if no chips
 *   paste (entry)                -> splits on delimiter, adds each segment
 *
 * The pure helper {@link normalizeTag} is exported so the trim/empty rule is unit-testable without
 * a DOM. Idempotent: {@link enhanceTagsInput} marks each root and skips an already-enhanced one;
 * {@link enhanceAllTagsInputs} wires every root on the page (call on load + after a DOM swap).
 */

const ENHANCED = "data-tags-input-enhanced";

/** Trim a raw tag; an empty / whitespace-only tag normalizes to "" (rejected by the caller). */
export function normalizeTag(raw: string): string {
  return raw.trim();
}

/** Enhance one tags-input root. No-op if it has no add-field or is already enhanced. */
export function enhanceTagsInput(root: HTMLElement): void {
  if (root.hasAttribute(ENHANCED)) return;
  const field = root.querySelector<HTMLInputElement>("[data-tags-input-field]");
  if (!field) return;
  root.setAttribute(ENHANCED, "");

  const name = root.getAttribute("data-name") ?? field.name ?? "tags";
  const delimiter = root.getAttribute("data-delimiter") ?? ",";
  const chipsHost = root.querySelector<HTMLElement>("[data-tags-input-chips]");
  const addButton = root.querySelector<HTMLButtonElement>("[data-tags-input-add]");
  const live = root.querySelector<HTMLElement>("[data-tags-input-live]");
  const clearAllButton = root.querySelector<HTMLButtonElement>("[data-tags-input-clear-all]");
  const suggestions = Array.from(
    root.querySelectorAll<HTMLButtonElement>("[data-tags-input-suggestion]"),
  );

  // JS-on: the Add submit becomes redundant (Enter adds in place); hide it.
  if (addButton) addButton.hidden = true;

  const announce = (msg: string): void => {
    if (live) live.textContent = msg;
  };

  const currentTags = (): string[] =>
    Array.from(root.querySelectorAll<HTMLInputElement>("[data-tags-input-value]")).map(
      (i) => i.value,
    );

  const chips = (): HTMLElement[] =>
    Array.from(root.querySelectorAll<HTMLElement>("[data-tags-input-chip]"));

  /** Maintain exactly one chip with tabindex="0"; all others get -1. */
  const syncRovingTabindex = (activeChip?: HTMLElement): void => {
    const all = chips();
    if (all.length === 0) return;
    const target = activeChip ?? all[0];
    for (const c of all) {
      c.setAttribute("tabindex", c === target ? "0" : "-1");
    }
  };

  // Initialise roving tabindex on existing chips.
  syncRovingTabindex();

  const buildChip = (tag: string): HTMLElement => {
    const chip = document.createElement("span");
    chip.setAttribute("data-slot", "tags-input-chip");
    chip.setAttribute("data-tags-input-chip", tag);
    chip.setAttribute("role", "option");
    chip.setAttribute("aria-selected", "true");
    chip.setAttribute("tabindex", "-1");
    chip.setAttribute("aria-label", `${tag}, press Delete or Backspace to remove`);
    chip.className =
      "inline-flex items-center gap-[var(--lv-space-1)] rounded-full border border-transparent bg-[var(--lv-color-secondary)] px-[var(--lv-space-2)] py-[2px] text-[length:var(--lv-text-sm)] font-[var(--lv-font-medium)] leading-none text-[var(--lv-color-secondary-fg)] outline-none transition-colors cursor-default select-none";

    const hidden = document.createElement("input");
    hidden.type = "hidden";
    hidden.setAttribute("data-slot", "tags-input-value");
    hidden.setAttribute("data-tags-input-value", "");
    hidden.name = name;
    hidden.value = tag;

    const labelEl = document.createElement("span");
    labelEl.setAttribute("data-slot", "tags-input-chip-label");
    labelEl.setAttribute("aria-hidden", "true");
    labelEl.textContent = tag;

    const remove = document.createElement("button");
    remove.type = "button"; // JS-on: plain button, not a submit
    remove.setAttribute("data-slot", "tags-input-remove");
    remove.setAttribute("data-tags-input-remove", tag);
    remove.setAttribute("aria-label", `Remove ${tag}`);
    remove.setAttribute("tabindex", "-1");
    remove.className =
      "-mr-[2px] inline-flex shrink-0 items-center rounded-full p-[2px] opacity-70 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:shadow-[var(--lv-ring)]";
    remove.innerHTML =
      '<svg aria-hidden="true" focusable="false" width="0.75rem" height="0.75rem" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>';

    chip.append(hidden, labelEl, remove);
    return chip;
  };

  const addTag = (raw: string): boolean => {
    const tag = normalizeTag(raw);
    if (tag === "" || !chipsHost) return false;
    if (currentTags().includes(tag)) {
      announce(`Tag already added`);
      return false;
    }
    const newChip = buildChip(tag);
    chipsHost.appendChild(newChip);
    syncRovingTabindex();
    announce(`Tag added: ${tag}`);
    return true;
  };

  const removeChip = (chip: HTMLElement, moveFocusTo?: "next" | "prev" | "entry"): void => {
    const tag = chip.getAttribute("data-tags-input-chip") ?? "";
    const all = chips();
    const idx = all.indexOf(chip);

    let focusTarget: HTMLElement | null = null;
    if (moveFocusTo === "next") {
      focusTarget = all[idx + 1] ?? all[idx - 1] ?? field;
    } else if (moveFocusTo === "prev") {
      focusTarget = all[idx - 1] ?? field;
    } else if (moveFocusTo === "entry") {
      focusTarget = field;
    }

    chip.remove();
    syncRovingTabindex(focusTarget instanceof HTMLElement && focusTarget !== field ? focusTarget : undefined);
    announce(`Tag removed: ${tag}`);

    if (focusTarget) {
      focusTarget.focus();
    }
  };

  // Keyboard on entry field.
  field.addEventListener("keydown", (e: KeyboardEvent) => {
    const key = e.key;

    if (key === "Enter" || key === delimiter) {
      e.preventDefault();
      if (addTag(field.value)) field.value = "";
      return;
    }

    if (key === "Escape") {
      e.preventDefault();
      field.value = "";
      return;
    }

    if (key === "Backspace" && field.value === "") {
      e.preventDefault();
      const all = chips();
      const last = all[all.length - 1];
      if (last) {
        const tag = last.getAttribute("data-tags-input-chip") ?? "";
        last.remove();
        syncRovingTabindex();
        announce(`Tag removed: ${tag}`);
        field.focus();
      }
      return;
    }

    if (key === "ArrowLeft" && field.selectionStart === 0 && field.selectionEnd === 0) {
      const all = chips();
      const last = all[all.length - 1];
      if (last) {
        e.preventDefault();
        syncRovingTabindex(last);
        last.focus();
      }
      return;
    }

    if (key === "Home") {
      const all = chips();
      if (all.length > 0) {
        e.preventDefault();
        syncRovingTabindex(all[0]);
        all[0].focus();
      }
      return;
    }

    if (key === "End") {
      const all = chips();
      if (all.length > 0) {
        e.preventDefault();
        const last = all[all.length - 1];
        syncRovingTabindex(last);
        last.focus();
      }
      return;
    }
  });

  // Keyboard on chips (delegated at root).
  root.addEventListener("keydown", (e: KeyboardEvent) => {
    const chip = (e.target as HTMLElement).closest<HTMLElement>("[data-tags-input-chip]");
    if (!chip) return;

    const key = e.key;
    const all = chips();
    const idx = all.indexOf(chip);

    if (key === "ArrowLeft") {
      e.preventDefault();
      if (idx > 0) {
        const prev = all[idx - 1];
        syncRovingTabindex(prev);
        prev.focus();
      } else {
        // First chip: wrap to entry input
        field.focus();
      }
      return;
    }

    if (key === "ArrowRight") {
      e.preventDefault();
      if (idx < all.length - 1) {
        const next = all[idx + 1];
        syncRovingTabindex(next);
        next.focus();
      } else {
        // Last chip: wrap to entry input
        field.focus();
      }
      return;
    }

    if (key === "Home") {
      e.preventDefault();
      if (all.length > 0) {
        syncRovingTabindex(all[0]);
        all[0].focus();
      }
      return;
    }

    if (key === "End") {
      e.preventDefault();
      field.focus();
      return;
    }

    if (key === "Delete" || key === "Backspace" || key === "Enter" || key === " ") {
      e.preventDefault();
      // Determine where focus should move after removal.
      if (all.length === 1) {
        // Only chip: go to entry input.
        removeChip(chip, "entry");
      } else if (idx < all.length - 1) {
        // Has next chip.
        removeChip(chip, "next");
      } else {
        // Last chip, go to previous.
        removeChip(chip, "prev");
      }
      return;
    }
  });

  // Paste: split on delimiter, add each non-empty trimmed segment.
  field.addEventListener("paste", (e: ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData?.getData("text") ?? "";
    const segments = text.split(delimiter).map((s) => s.trim()).filter((s) => s.length > 0);
    for (const seg of segments) {
      addTag(seg);
    }
    field.value = "";
  });

  // JS-off Add button: intercept to add in place instead of submitting.
  if (addButton) {
    addButton.addEventListener("click", (e) => {
      e.preventDefault();
      if (addTag(field.value)) field.value = "";
      field.focus();
    });
  }

  // Remove via chip x button (delegated; cancel native submit).
  root.addEventListener("click", (e) => {
    const target = (e.target as HTMLElement).closest<HTMLElement>("[data-tags-input-remove]");
    if (!target) return;
    e.preventDefault();
    const chip = target.closest<HTMLElement>("[data-tags-input-chip]");
    if (!chip) return;
    const all = chips();
    const idx = all.indexOf(chip);
    if (all.length === 1) {
      removeChip(chip, "entry");
    } else if (idx < all.length - 1) {
      removeChip(chip, "next");
    } else {
      removeChip(chip, "prev");
    }
  });

  // Clear-all button.
  if (clearAllButton) {
    clearAllButton.addEventListener("click", (e) => {
      e.preventDefault();
      if (!chipsHost) return;
      const all = chips();
      for (const c of all) {
        c.remove();
      }
      announce("All tags cleared");
      field.focus();
    });
  }

  // Suggestion quick-pick.
  for (const suggestion of suggestions) {
    suggestion.addEventListener("click", (e) => {
      e.preventDefault();
      const tag = suggestion.getAttribute("data-tags-input-suggestion") ?? "";
      if (addTag(tag)) field.focus();
    });
  }
}

/** Enhance every `[data-lievit-tags-input]` root in scope. */
export function enhanceAllTagsInputs(scope: ParentNode = document): void {
  scope
    .querySelectorAll<HTMLElement>("[data-lievit-tags-input]")
    .forEach((root) => enhanceTagsInput(root));
}
