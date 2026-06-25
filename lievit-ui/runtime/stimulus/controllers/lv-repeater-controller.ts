/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * `lv-repeater` -- the Filament-style repeater (a list of NESTED-SCHEMA item cards that POST as an
 * indexed form-array `<name>[<i>][...]`), as a Stimulus controller (the conversion of
 * `registry/jte/repeater.enhancer.ts`). Mounted on the repeater ROOT (`<fieldset>`) via
 * `data-controller="lv-repeater"`. The cards, the recursive item bodies, the hidden `<template>`
 * card and the a11y scaffolding are all server-rendered HTML; this controller ONLY upgrades the
 * add / remove editing to happen IN PLACE, then re-indexes the surviving cards so the POSTed
 * indices stay contiguous (0..n-1) and the server rebuilds the ordered list without gaps.
 *
 * Controlled / uncontrolled doctrine (the progressive-enhancement contract, NOT a wire round-trip):
 * the native inputs are the form source of truth, so the cards POST identically whether or not JS
 * ran. JS-OFF the add (`name=<name>__add`) and per-item remove (`name=<name>__remove`, value=index)
 * are real submits that round-trip to the server, which re-renders with one more / fewer card. This
 * controller is UNCONTROLLED: editing your own list is pure client cosmetic, so on `add` / `remove`
 * it calls `preventDefault()` (keeping the no-JS submit inert when JS is on) and mutates the DOM in
 * place with ZERO `/lievit/<id>/call`. It never extends DismissableController and never touches the
 * wire (same reasoning as the sidebar collapse + input-otp).
 *
 * Reorder is a deliberate follow-up: the grip handle + `data-repeater-reorder` exist so it can be
 * wired later without re-templating; this controller does not move cards.
 *
 * Morph-safety: the add / remove wiring is declared in the template as `data-action`, so Stimulus's
 * action observer re-binds it after the wire morph (and on every freshly cloned card) automatically.
 * `connect()` re-indexes once so a morph that replaced the subtree still lands on a contiguous
 * array. No `data-repeater-enhanced` marker, no `WeakSet`, no `afterCall` sweep -- Stimulus owns
 * connect/disconnect, so the listener-stacking bug class is structurally impossible.
 *
 * a11y: the partial keeps the labelled <fieldset>/<legend>, the per-card region (`aria-label
 * "Item N"`), the real <button> controls and the `aria-live` region; this controller re-numbers the
 * card + control labels on every re-index and announces add / remove into the live region.
 */

import { Controller } from "@hotwired/stimulus";

/**
 * Rewrite a nested field name's FIRST index segment to `index`, keeping the prefix + the rest:
 * `reindexFieldName("telefoni[3][numero]", "telefoni", 1)` -> `"telefoni[1][numero]"`.
 * The old segment may be a number or the `__i__` template token; anything else is left unchanged.
 * Exported as a pure function so the `prefix[*][rest]` -> `prefix[i][rest]` rewrite is unit-testable
 * without a DOM.
 *
 * @param name  the nested field name to rewrite
 * @param prefix the repeater's `data-name` prefix (regex-escaped here)
 * @param index the new contiguous index
 * @returns the rewritten name, or the input unchanged when the prefix does not match
 */
export function reindexFieldName(name: string, prefix: string, index: number): string {
  const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`^(${escaped})\\[[^\\]]*\\]`);
  return name.replace(re, `$1[${index}]`);
}

export default class LvRepeaterController extends Controller<HTMLElement> {
  static targets = ["items", "template", "live"];

  declare readonly hasItemsTarget: boolean;
  declare readonly itemsTarget: HTMLElement;
  declare readonly hasTemplateTarget: boolean;
  declare readonly templateTarget: HTMLTemplateElement;
  declare readonly hasLiveTarget: boolean;
  declare readonly liveTarget: HTMLElement;

  connect(): void {
    // Normalize indices once: the SSR already stamps 0..n-1, but a wire morph may have replaced the
    // subtree, so re-indexing on connect keeps the contiguous-array POST contract after every morph.
    if (this.hasItemsTarget) {
      this.reindex();
    }
  }

  /**
   * The Add action (`data-action="click->lv-repeater#add"`): clone the hidden `<template>` card,
   * append it, re-index every card so its nested field names stay contiguous, focus the new card's
   * first field, and announce. `preventDefault()` keeps the no-JS Add submit inert when JS is on.
   */
  add(event: Event): void {
    event.preventDefault();
    if (!this.hasItemsTarget || !this.hasTemplateTarget) {
      return;
    }
    const fragment = this.templateTarget.content.cloneNode(true) as DocumentFragment;
    const card = fragment.querySelector<HTMLElement>("[data-repeater-item]");
    if (card == null) {
      return;
    }
    this.itemsTarget.appendChild(card);
    this.reindex();
    card.querySelector<HTMLElement>("input, select, textarea")?.focus();
    this.announce("Item added");
  }

  /**
   * The per-item Remove action (`data-action="click->lv-repeater#remove"` on each card's remove
   * button): drop the closest card, re-index the survivors so indices stay 0..n-1 and order is
   * kept, and announce. `preventDefault()` keeps the no-JS remove submit inert when JS is on.
   */
  remove(event: Event): void {
    event.preventDefault();
    const card = (event.target as Element).closest<HTMLElement>("[data-repeater-item]");
    if (card == null) {
      return;
    }
    card.remove();
    this.reindex();
    this.announce("Item removed");
  }

  // --- internals -------------------------------------------------------------------------------

  /** The field-name prefix the cards POST under, from the root's `data-name`. */
  private get prefix(): string {
    return this.element.getAttribute("data-name") ?? "items";
  }

  /** The live item cards, in document order. */
  private cards(): HTMLElement[] {
    return Array.from(this.itemsTarget.querySelectorAll<HTMLElement>("[data-repeater-item]"));
  }

  /** Rewrite each card's index: `data-index`, its aria-label row number, and every nested field name. */
  private reindex(): void {
    const prefix = this.prefix;
    this.cards().forEach((card, i) => {
      card.setAttribute("data-index", String(i));
      card.setAttribute("aria-label", relabel(card.getAttribute("aria-label"), i));

      for (const field of Array.from(
        card.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("[name]"),
      )) {
        const next = reindexFieldName(field.name, prefix, i);
        if (next !== field.name) {
          field.name = next;
        }
      }

      const remove = card.querySelector<HTMLElement>("[data-repeater-remove]");
      if (remove != null) {
        remove.setAttribute("aria-label", relabelControl(remove.getAttribute("aria-label"), i));
      }
      const reorder = card.querySelector<HTMLElement>("[data-repeater-reorder]");
      if (reorder != null) {
        reorder.setAttribute("aria-label", relabelControl(reorder.getAttribute("aria-label"), i));
      }
    });
  }

  /** Announce add / remove into the polite live region, if one is present. */
  private announce(message: string): void {
    if (this.hasLiveTarget) {
      this.liveTarget.textContent = message;
    }
  }
}

/** Replace the trailing number (or the `__label__` template token) in a card's "Item N" label. */
function relabel(current: string | null, i: number): string {
  const stem = (current ?? "Item").replace(/\s*(?:\d+|__label__)\s*$/i, "").trim();
  return `${stem} ${i + 1}`;
}

/** Same for a control label like "Remove Item N" / "Reorder Item N". */
function relabelControl(current: string | null, i: number): string {
  const stem = (current ?? "").replace(/\s*(?:\d+|__label__)\s*$/i, "").trim();
  return stem === "" ? `${i + 1}` : `${stem} ${i + 1}`;
}
