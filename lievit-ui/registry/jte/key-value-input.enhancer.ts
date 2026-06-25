/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * key-value-input enhancer (ADR-0012, server-first + progressive enhancement): the CSP-clean
 * typed-TS that UPGRADES the server-rendered `lievit/key-value-input.jte` partial. Each row is two
 * native inputs named `<name>[<i>][key]` / `<name>[<i>][value]`, so the rows POST as an indexed
 * form-array with zero JS; JS-OFF an Add submit / per-row remove submit round-trips to the server.
 * This module makes the editing in-place: it clones the hidden <template> row to add and drops a row
 * to remove, then RE-INDEXES the surviving rows so the POSTed indices stay contiguous (0..n-1) and a
 * server binder rebuilds the ordered map without gaps. The native inputs stay the form source of
 * truth, so the field POSTs identically whether or not JS ran.
 *
 * No inline script (the strict CSP refuses inline on* handlers; this attaches listeners in code).
 *
 * The pure {@link indexedName} builder is exported so the `prefix[i][field]` convention is
 * unit-testable without a DOM. Idempotent: {@link enhanceKeyValueInput} marks each root and skips an
 * already-enhanced one; {@link enhanceAllKeyValueInputs} wires every root on the page.
 */

const ENHANCED = "data-key-value-input-enhanced";

/** Build the canonical indexed form-array field name: indexedName("meta", 2, "key") -> "meta[2][key]". */
export function indexedName(prefix: string, index: number, field: "key" | "value"): string {
  return `${prefix}[${index}][${field}]`;
}

/** Enhance one key-value-input root. No-op if it has no rows host or is already enhanced. */
export function enhanceKeyValueInput(root: HTMLElement): void {
  if (root.hasAttribute(ENHANCED)) return;
  // Migration guard (Stimulus conversion): a root converted to the `lv-key-value-input` Stimulus
  // controller owns its own add/remove handling. This enhancer must NOT also wire it, or each Add /
  // remove would fire twice. Converted templates carry data-controller="lv-key-value-input".
  if (root.matches('[data-controller~="lv-key-value-input"]')) {
    root.setAttribute(ENHANCED, "");
    return;
  }
  const rowsHost = root.querySelector<HTMLElement>("[data-key-value-input-rows]");
  const template = root.querySelector<HTMLTemplateElement>("[data-key-value-input-template]");
  if (!rowsHost || !template) return;
  root.setAttribute(ENHANCED, "");

  const prefix = root.getAttribute("data-name") ?? "kv";
  const addButton = root.querySelector<HTMLButtonElement>("[data-key-value-input-add]");
  const live = root.querySelector<HTMLElement>("[data-key-value-input-live]");

  const announce = (msg: string): void => {
    if (live) live.textContent = msg;
  };

  const rows = (): HTMLElement[] =>
    Array.from(rowsHost.querySelectorAll<HTMLElement>("[data-key-value-input-row]"));

  /** Rewrite every row's index (data-index, the two input names, the three aria-labels). */
  const reindex = (): void => {
    rows().forEach((row, i) => {
      row.setAttribute("data-index", String(i));
      const keyInput = row.querySelector<HTMLInputElement>("[data-key-value-input-key]");
      const valueInput = row.querySelector<HTMLInputElement>("[data-key-value-input-value]");
      if (keyInput) {
        keyInput.name = indexedName(prefix, i, "key");
        keyInput.setAttribute("aria-label", relabel(keyInput, i));
      }
      if (valueInput) {
        valueInput.name = indexedName(prefix, i, "value");
        valueInput.setAttribute("aria-label", relabel(valueInput, i));
      }
      const remove = row.querySelector<HTMLButtonElement>("[data-key-value-input-remove]");
      if (remove) remove.setAttribute("aria-label", `Remove row ${i + 1}`);
    });
  };

  /** Replace the trailing "row N" in an aria-label with the new 1-based row number. */
  const relabel = (el: HTMLElement, i: number): string => {
    const current = el.getAttribute("aria-label") ?? "";
    const stem = current.replace(/,?\s*row\b.*$/i, "");
    return `${stem}, row ${i + 1}`;
  };

  const addRow = (): void => {
    const fragment = template.content.cloneNode(true) as DocumentFragment;
    const row = fragment.querySelector<HTMLElement>("[data-key-value-input-row]");
    if (!row) return;
    rowsHost.appendChild(row);
    reindex();
    const firstInput = row.querySelector<HTMLInputElement>("[data-key-value-input-key]");
    firstInput?.focus();
    announce("Row added");
  };

  const removeRow = (row: HTMLElement): void => {
    row.remove();
    reindex();
    announce("Row removed");
  };

  if (addButton) {
    addButton.addEventListener("click", (e) => {
      e.preventDefault();
      addRow();
    });
  }

  // remove via the row's trash button (delegated; cancel its native submit)
  root.addEventListener("click", (e) => {
    const target = (e.target as HTMLElement).closest<HTMLElement>("[data-key-value-input-remove]");
    if (!target) return;
    e.preventDefault();
    const row = target.closest<HTMLElement>("[data-key-value-input-row]");
    if (row) removeRow(row);
  });

  reindex();
}

/** Enhance every `[data-lievit-key-value-input]` root in scope. */
export function enhanceAllKeyValueInputs(scope: ParentNode = document): void {
  scope
    .querySelectorAll<HTMLElement>("[data-lievit-key-value-input]")
    .forEach((root) => enhanceKeyValueInput(root));
}
