/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * repeater enhancer (ADR-0012, server-first + progressive enhancement): the CSP-clean typed-TS that
 * UPGRADES the server-rendered `lievit/repeater.jte` partial. Each item card holds nested fields
 * named `<name>[<i>][...]`, so the cards POST as an indexed form-array with zero JS; JS-OFF an Add
 * submit / per-item remove submit round-trips to the server. This module makes the editing in-place:
 * it clones the hidden <template> card to add and drops a card to remove, then RE-INDEXES every
 * nested field name + the card label inside the surviving cards so the POSTed indices stay
 * contiguous (0..n-1) and the server rebuilds the ordered list without gaps. The native inputs stay
 * the form source of truth, so it POSTs identically whether or not JS ran.
 *
 * Reorder is a deliberate follow-up: the grip handle + data-slot exist so it can be wired later
 * without re-templating, but this enhancer does not move cards.
 *
 * No inline script (the strict CSP refuses inline on* handlers; this attaches listeners in code).
 *
 * The pure {@link reindexFieldName} is exported so the `prefix[*][rest]` -> `prefix[i][rest]`
 * rewrite is unit-testable without a DOM. Idempotent: {@link enhanceRepeater} marks each root;
 * {@link enhanceAllRepeaters} wires every root on the page.
 */

const ENHANCED = "data-repeater-enhanced";

/**
 * Rewrite a nested field name's FIRST index segment to `index`, keeping the prefix + the rest:
 * reindexFieldName("telefoni[3][numero]", "telefoni", 1) -> "telefoni[1][numero]".
 * The old segment may be a number or the `__i__` template token; anything else is left unchanged.
 */
export function reindexFieldName(name: string, prefix: string, index: number): string {
  // escape the prefix for the regex, then swap the first [....] group after it
  const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`^(${escaped})\\[[^\\]]*\\]`);
  return name.replace(re, `$1[${index}]`);
}

/** Enhance one repeater root. No-op if it has no items host / template or is already enhanced. */
export function enhanceRepeater(root: HTMLElement): void {
  if (root.hasAttribute(ENHANCED)) return;
  const itemsHost = root.querySelector<HTMLElement>("[data-repeater-items]");
  const template = root.querySelector<HTMLTemplateElement>("[data-repeater-template]");
  if (!itemsHost || !template) return;
  root.setAttribute(ENHANCED, "");

  const prefix = root.getAttribute("data-name") ?? "items";
  const addButton = root.querySelector<HTMLButtonElement>("[data-repeater-add]");
  const live = root.querySelector<HTMLElement>("[data-repeater-live]");

  const announce = (msg: string): void => {
    if (live) live.textContent = msg;
  };

  const items = (): HTMLElement[] =>
    Array.from(itemsHost.querySelectorAll<HTMLElement>("[data-repeater-item]"));

  /** Rewrite each card's index: data-index, its aria-label row number, and every nested field name. */
  const reindex = (): void => {
    items().forEach((card, i) => {
      card.setAttribute("data-index", String(i));
      card.setAttribute("aria-label", relabel(card.getAttribute("aria-label"), i));

      for (const field of Array.from(
        card.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
          "[name]",
        ),
      )) {
        const next = reindexFieldName(field.name, prefix, i);
        if (next !== field.name) field.name = next;
      }

      const remove = card.querySelector<HTMLElement>("[data-repeater-remove]");
      if (remove) remove.setAttribute("aria-label", relabelControl(remove.getAttribute("aria-label"), i));
      const reorder = card.querySelector<HTMLElement>("[data-repeater-reorder]");
      if (reorder) reorder.setAttribute("aria-label", relabelControl(reorder.getAttribute("aria-label"), i));
    });
  };

  /** Replace the trailing number in a card's "Item N" aria-label with the new 1-based number. */
  const relabel = (current: string | null, i: number): string => {
    const stem = (current ?? "Item").replace(/\s*(?:\d+|__label__)\s*$/i, "").trim();
    return `${stem} ${i + 1}`;
  };
  /** Same for a control label like "Remove Item N" / "Reorder Item N". */
  const relabelControl = (current: string | null, i: number): string => {
    const stem = (current ?? "").replace(/\s*(?:\d+|__label__)\s*$/i, "").trim();
    return stem === "" ? `${i + 1}` : `${stem} ${i + 1}`;
  };

  const addItem = (): void => {
    const fragment = template.content.cloneNode(true) as DocumentFragment;
    const card = fragment.querySelector<HTMLElement>("[data-repeater-item]");
    if (!card) return;
    itemsHost.appendChild(card);
    reindex();
    const firstField = card.querySelector<HTMLElement>("input, select, textarea");
    (firstField as HTMLElement | null)?.focus();
    announce("Item added");
  };

  const removeItem = (card: HTMLElement): void => {
    card.remove();
    reindex();
    announce("Item removed");
  };

  if (addButton) {
    addButton.addEventListener("click", (e) => {
      e.preventDefault();
      addItem();
    });
  }

  root.addEventListener("click", (e) => {
    const target = (e.target as HTMLElement).closest<HTMLElement>("[data-repeater-remove]");
    if (!target) return;
    e.preventDefault();
    const card = target.closest<HTMLElement>("[data-repeater-item]");
    if (card) removeItem(card);
  });

  reindex();
}

/** Enhance every `[data-lievit-repeater]` root in scope. */
export function enhanceAllRepeaters(scope: ParentNode = document): void {
  scope
    .querySelectorAll<HTMLElement>("[data-lievit-repeater]")
    .forEach((root) => enhanceRepeater(root));
}
