/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * checkbox-list enhancer (ADR-0012, server-first + progressive enhancement): the CSP-clean
 * typed-TS that UPGRADES the server-rendered `lievit/checkbox-list.jte` partial. The options, the
 * checked state and the form-bound native checkboxes are all server-rendered HTML; JS-OFF the user
 * simply ticks the native boxes and they POST the repeated `name`. This module only ADDS the two
 * tools the partial keeps hidden until JS runs: a client-side filter over the visible options, and
 * a select-all / clear bulk toggle. It never owns the value -- the native checkboxes stay the form
 * source of truth, so the field POSTs identically whether or not JS ran.
 *
 * No inline script (the strict CSP refuses inline on* handlers; this attaches listeners in code).
 *
 * The pure filter predicate ({@link matchesQuery}) is exported so it can be unit-tested without a
 * DOM. Idempotent: {@link enhanceCheckboxList} marks each root and skips an already-enhanced one;
 * {@link enhanceAllCheckboxLists} wires every root on the page (call on load + after a DOM swap).
 */

const ENHANCED = "data-checkbox-list-enhanced";

/** Case- and accent-insensitive substring match of a query against an option label. */
export function matchesQuery(label: string, query: string): boolean {
  const q = normalize(query);
  if (q === "") return true;
  return normalize(label).includes(q);
}

/** Lowercase + strip diacritics so "citta" matches "città" and case never blocks a match. */
function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

/** Reveal the tools row the partial rendered hidden (so JS-off shows no dead controls). */
function revealTools(root: HTMLElement): void {
  const tools = root.querySelector<HTMLElement>("[data-checkbox-list-tools]");
  if (tools) tools.hidden = false;
}

/** The enabled, currently-visible (not display:none) checkboxes -- what the bulk toggle acts on. */
function visibleBoxes(root: HTMLElement): HTMLInputElement[] {
  return Array.from(
    root.querySelectorAll<HTMLInputElement>("[data-slot='checkbox-control']"),
  ).filter((box) => {
    if (box.disabled) return false;
    const option = box.closest<HTMLElement>("[data-checkbox-list-option]");
    return !option || option.style.display !== "none";
  });
}

/** Enhance one checkbox-list root. No-op if already enhanced. */
export function enhanceCheckboxList(root: HTMLElement): void {
  if (root.hasAttribute(ENHANCED)) return;
  root.setAttribute(ENHANCED, "");
  revealTools(root);

  const options = Array.from(
    root.querySelectorAll<HTMLElement>("[data-checkbox-list-option]"),
  );
  const search = root.querySelector<HTMLInputElement>("[data-checkbox-list-search]");
  const toggleAll = root.querySelector<HTMLButtonElement>("[data-checkbox-list-toggle-all]");

  const applyFilter = (query: string): void => {
    for (const option of options) {
      const label = option.getAttribute("data-label") ?? option.textContent ?? "";
      option.style.display = matchesQuery(label, query) ? "" : "none";
    }
    syncToggleState();
  };

  const syncToggleState = (): void => {
    if (!toggleAll) return;
    const boxes = visibleBoxes(root);
    const allChecked = boxes.length > 0 && boxes.every((b) => b.checked);
    toggleAll.setAttribute("aria-pressed", String(allChecked));
  };

  if (search) {
    search.addEventListener("input", () => applyFilter(search.value));
  }

  if (toggleAll) {
    toggleAll.addEventListener("click", () => {
      const boxes = visibleBoxes(root);
      const allChecked = boxes.length > 0 && boxes.every((b) => b.checked);
      const next = !allChecked;
      for (const box of boxes) {
        if (box.checked === next) continue;
        box.checked = next;
        box.dispatchEvent(new Event("input", { bubbles: true }));
        box.dispatchEvent(new Event("change", { bubbles: true }));
      }
      syncToggleState();
    });
  }

  // keep the toggle's aria-pressed honest when the user ticks boxes by hand
  root.addEventListener("change", (e) => {
    const target = e.target as HTMLElement;
    if (target.matches("[data-slot='checkbox-control']")) syncToggleState();
  });

  syncToggleState();
}

/** Enhance every `[data-lievit-checkbox-list]` root in scope. */
export function enhanceAllCheckboxLists(scope: ParentNode = document): void {
  scope
    .querySelectorAll<HTMLElement>("[data-lievit-checkbox-list]")
    .forEach((root) => enhanceCheckboxList(root));
}
