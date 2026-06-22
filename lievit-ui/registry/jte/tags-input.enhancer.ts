/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * tags-input enhancer (ADR-0012, server-first + progressive enhancement): the CSP-clean typed-TS
 * that UPGRADES the server-rendered `lievit/tags-input.jte` partial. Each committed tag is a chip
 * carrying a hidden <input name=...>, so the set POSTs as a repeated `name` with zero JS; JS-OFF an
 * explicit Add submit button round-trips to the server to append a tag. This module makes the
 * editing in-place: it intercepts Enter / comma / the Add button to append a chip + its hidden
 * input WITHOUT a round-trip, removes a chip by deleting its hidden input (cancelling the submit),
 * and wires the suggestion buttons as a quick-pick. The hidden inputs stay the form source of
 * truth, so the field POSTs identically whether or not JS ran.
 *
 * No inline script (the strict CSP refuses inline on* handlers; this attaches listeners in code).
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
  const chipsHost = root.querySelector<HTMLElement>("[data-tags-input-chips]");
  const addButton = root.querySelector<HTMLButtonElement>("[data-tags-input-add]");
  const live = root.querySelector<HTMLElement>("[data-tags-input-live]");
  const suggestions = Array.from(
    root.querySelectorAll<HTMLButtonElement>("[data-tags-input-suggestion]"),
  );

  // JS-on the Add submit becomes redundant (Enter adds in place); hide it so there is no dead control.
  if (addButton) addButton.hidden = true;

  const announce = (msg: string): void => {
    if (live) live.textContent = msg;
  };

  const currentTags = (): string[] =>
    Array.from(root.querySelectorAll<HTMLInputElement>("[data-tags-input-value]")).map(
      (i) => i.value,
    );

  const addTag = (raw: string): boolean => {
    const tag = normalizeTag(raw);
    if (tag === "" || !chipsHost) return false;
    if (currentTags().includes(tag)) {
      announce(`${tag} already added`);
      return false;
    }
    chipsHost.appendChild(buildChip(tag));
    announce(`${tag} added`);
    return true;
  };

  const buildChip = (tag: string): HTMLElement => {
    const chip = document.createElement("span");
    chip.setAttribute("data-slot", "tags-input-chip");
    chip.setAttribute("data-tags-input-chip", tag);
    chip.className =
      "inline-flex items-center gap-[var(--lv-space-1)] rounded-full border border-transparent bg-[var(--lv-color-secondary)] px-[var(--lv-space-2)] py-[2px] text-[length:var(--lv-text-sm)] font-[var(--lv-font-medium)] leading-none text-[var(--lv-color-secondary-fg)]";

    const hidden = document.createElement("input");
    hidden.type = "hidden";
    hidden.setAttribute("data-slot", "tags-input-value");
    hidden.setAttribute("data-tags-input-value", "");
    hidden.name = name;
    hidden.value = tag;

    const labelEl = document.createElement("span");
    labelEl.setAttribute("data-slot", "tags-input-chip-label");
    labelEl.textContent = tag;

    const remove = document.createElement("button");
    remove.type = "button"; // JS-on: a plain button, never a submit
    remove.setAttribute("data-slot", "tags-input-remove");
    remove.setAttribute("data-tags-input-remove", tag);
    remove.setAttribute("aria-label", `Remove ${tag}`);
    remove.className =
      "-mr-[2px] inline-flex shrink-0 items-center rounded-full p-[2px] opacity-70 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:shadow-[var(--lv-ring)]";
    remove.innerHTML =
      '<svg aria-hidden="true" focusable="false" width="0.875rem" height="0.875rem" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>';

    chip.append(hidden, labelEl, remove);
    return chip;
  };

  const removeChip = (chip: HTMLElement): void => {
    const tag = chip.getAttribute("data-tags-input-chip") ?? "";
    chip.remove();
    announce(`${tag} removed`);
  };

  // add on Enter / comma
  field.addEventListener("keydown", (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault(); // never submit the form on Enter while typing a tag
      if (addTag(field.value)) field.value = "";
    } else if (e.key === "Backspace" && field.value === "") {
      const chips = Array.from(root.querySelectorAll<HTMLElement>("[data-tags-input-chip]"));
      const last = chips[chips.length - 1];
      if (last) removeChip(last);
    }
  });

  // the JS-off Add button, if reached, adds in place instead of submitting
  if (addButton) {
    addButton.addEventListener("click", (e) => {
      e.preventDefault();
      if (addTag(field.value)) field.value = "";
      field.focus();
    });
  }

  // remove via the chip's x (delegated; cancel its native submit)
  root.addEventListener("click", (e) => {
    const target = (e.target as HTMLElement).closest<HTMLElement>("[data-tags-input-remove]");
    if (!target) return;
    e.preventDefault();
    const chip = target.closest<HTMLElement>("[data-tags-input-chip]");
    if (chip) removeChip(chip);
  });

  // suggestions quick-pick
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
