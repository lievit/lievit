/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * builder enhancer (ADR-0012, server-first + progressive enhancement): the CSP-clean typed-TS that
 * UPGRADES the server-rendered `lievit/builder.jte` partial. Unlike the repeater (one schema), a
 * builder mixes DIFFERENT block types; each block card holds a hidden `<name>[<i>][__type]` plus its
 * type-specific fields named `<name>[<i>][...]`, so the list POSTs as a typed indexed form-array with
 * zero JS; JS-OFF the add-block menu + per-block remove are server submits. This module makes the
 * editing in-place: an add-menu click clones the matching per-type <template> (a complete blank block
 * card) and a remove drops a card, then RE-INDEXES every field name (the `__type` included) + label
 * across the surviving blocks so the POSTed indices stay contiguous. The native inputs stay the form
 * source of truth, so it POSTs identically whether or not JS ran.
 *
 * No inline script (the strict CSP refuses inline on* handlers; this attaches listeners in code).
 *
 * The pure {@link reindexFieldName} (the same `prefix[*][rest]` rewrite the repeater uses) is
 * inlined + exported here so this enhancer is self-contained for the copy-in model (no cross-file
 * import to drag along) and the rewrite stays DOM-free for unit tests. Idempotent:
 * {@link enhanceBuilder} marks each root; {@link enhanceAllBuilders} wires every root on the page.
 */

const ENHANCED = "data-builder-enhanced";

/**
 * Rewrite a nested field name's FIRST index segment to `index`, keeping the prefix + the rest:
 * reindexFieldName("blocchi[3][testo]", "blocchi", 1) -> "blocchi[1][testo]". The old segment may be
 * a number or the `__i__` template token; anything else is left unchanged.
 */
export function reindexFieldName(name: string, prefix: string, index: number): string {
  const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`^(${escaped})\\[[^\\]]*\\]`);
  return name.replace(re, `$1[${index}]`);
}

/** Enhance one builder root. No-op if it has no blocks host or is already enhanced. */
export function enhanceBuilder(root: HTMLElement): void {
  if (root.hasAttribute(ENHANCED)) return;
  const blocksHost = root.querySelector<HTMLElement>("[data-builder-blocks]");
  const templatesHost = root.querySelector<HTMLElement>("[data-builder-templates]");
  if (!blocksHost) return;
  root.setAttribute(ENHANCED, "");

  const prefix = root.getAttribute("data-name") ?? "blocks";
  const live = root.querySelector<HTMLElement>("[data-builder-live]");

  const announce = (msg: string): void => {
    if (live) live.textContent = msg;
  };

  const blocks = (): HTMLElement[] =>
    Array.from(blocksHost.querySelectorAll<HTMLElement>("[data-builder-block]"));

  /** The per-type <template> the adopter authored, by type key. */
  const templateFor = (type: string): HTMLTemplateElement | null =>
    templatesHost?.querySelector<HTMLTemplateElement>(
      `template[data-builder-template="${CSS.escape(type)}"]`,
    ) ?? null;

  /** Rewrite each block's index: data-index, aria-label number, control labels, and every field name. */
  const reindex = (): void => {
    blocks().forEach((card, i) => {
      card.setAttribute("data-index", String(i));
      card.setAttribute("aria-label", relabel(card.getAttribute("aria-label"), i));

      for (const field of Array.from(
        card.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("[name]"),
      )) {
        const next = reindexFieldName(field.name, prefix, i);
        if (next !== field.name) field.name = next;
      }

      const remove = card.querySelector<HTMLElement>("[data-builder-remove]");
      if (remove) remove.setAttribute("aria-label", relabel(remove.getAttribute("aria-label"), i));
    });
  };

  /** Replace the trailing number / __label__ in an aria-label with the new 1-based number. */
  const relabel = (current: string | null, i: number): string => {
    const stem = (current ?? "").replace(/\s*(?:\d+|__label__)\s*$/i, "").trim();
    return stem === "" ? `${i + 1}` : `${stem} ${i + 1}`;
  };

  const addBlock = (type: string): void => {
    const template = templateFor(type);
    if (!template) return;
    const fragment = template.content.cloneNode(true) as DocumentFragment;
    const card = fragment.querySelector<HTMLElement>("[data-builder-block]");
    if (!card) return;
    blocksHost.appendChild(card);
    reindex();
    const firstField = card.querySelector<HTMLElement>("input:not([type=hidden]), select, textarea");
    (firstField as HTMLElement | null)?.focus();
    announce("Block added");
  };

  const removeBlock = (card: HTMLElement): void => {
    card.remove();
    reindex();
    announce("Block removed");
  };

  // add-menu: each button names the type it adds
  root.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    const add = target.closest<HTMLElement>("[data-builder-add]");
    if (add) {
      e.preventDefault();
      addBlock(add.getAttribute("data-builder-add") ?? "");
      return;
    }
    const remove = target.closest<HTMLElement>("[data-builder-remove]");
    if (remove) {
      e.preventDefault();
      const card = remove.closest<HTMLElement>("[data-builder-block]");
      if (card) removeBlock(card);
    }
  });

  reindex();
}

/** Enhance every `[data-lievit-builder]` root in scope. */
export function enhanceAllBuilders(scope: ParentNode = document): void {
  scope
    .querySelectorAll<HTMLElement>("[data-lievit-builder]")
    .forEach((root) => enhanceBuilder(root));
}
