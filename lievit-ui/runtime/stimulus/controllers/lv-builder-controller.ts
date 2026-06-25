/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * `lv-builder` -- the Filament-style heterogeneous typed-block list, as a Stimulus controller (the
 * conversion of `registry/jte/builder.enhancer.ts`). Mounted on the `<fieldset>` ROOT via
 * `data-controller="lv-builder"`. Unlike the repeater (one schema repeated), a builder mixes
 * DIFFERENT block types in one ordered list; each block card carries a hidden
 * `<name>[<i>][__type]` plus its type-specific fields, so the list POSTs as a typed indexed
 * form-array with ZERO JavaScript. This controller makes the editing IN-PLACE: an add-menu click
 * clones the matching per-type `<template>` (a complete blank block card) and a remove drops a card,
 * then RE-INDEXES every field name (the `__type` included) + the aria-labels across the surviving
 * blocks so the POSTed indices stay contiguous. The native inputs stay the form source of truth, so
 * it POSTs identically whether or not JS ran (JS-OFF the add menu + per-block remove are server
 * submits; this is pure progressive enhancement).
 *
 * UNCONTROLLED by construction (the controlled/uncontrolled doctrine): the builder is a local form
 * editor whose state lives entirely in the native inputs it rewrites; it NEVER round-trips the
 * lievit wire (no `/lievit/<id>/call`, no `data-lv-wire-close`). So it extends the plain Stimulus
 * `Controller`, not `DismissableController` -- there is no overlay to dismiss and no close action to
 * fire. The only focus move is the cosmetic `firstField.focus()` after an add; it is neither a Tab
 * trap nor a return-focus, so nothing collapses into the shared base.
 *
 * Wiring (CSP-clean, NOT inline handlers): the add buttons carry
 * `data-action="click->lv-builder#add"`, the per-block remove buttons (rendered by
 * `builder/block.jte`, also the bodies of the per-type `<template>`s) carry
 * `data-action="click->lv-builder#remove"`. Stimulus's action observer re-binds those descriptors
 * automatically when a clone is appended or a wire morph re-renders the subtree.
 *
 * Morph-safety: there is NO `data-builder-enhanced` marker and no delegated root listener. Stimulus
 * connects this controller once per element+identifier and disconnects it when a morph removes the
 * root; the declared `data-action`s survive the morph (the action observer re-binds re-rendered
 * descendants). That replaces the enhancer's `data-*-enhanced` idempotency bookkeeping.
 */

import { Controller } from "@hotwired/stimulus";

/**
 * Rewrite a nested field name's FIRST index segment to `index`, keeping the prefix + the rest:
 * `reindexFieldName("blocchi[3][testo]", "blocchi", 1)` -> `"blocchi[1][testo]"`. The old segment may
 * be a number or the `__i__` template token; a name with a different prefix is left unchanged. Pure +
 * DOM-free so it unit-tests in isolation (the same rewrite the repeater uses).
 */
export function reindexFieldName(name: string, prefix: string, index: number): string {
  const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`^(${escaped})\\[[^\\]]*\\]`);
  return name.replace(re, `$1[${index}]`);
}

export default class LvBuilderController extends Controller<HTMLElement> {
  static targets = ["blocks", "templates", "live"];

  declare readonly hasBlocksTarget: boolean;
  declare readonly blocksTarget: HTMLElement;
  declare readonly hasTemplatesTarget: boolean;
  declare readonly templatesTarget: HTMLElement;
  declare readonly hasLiveTarget: boolean;
  declare readonly liveTarget: HTMLElement;

  connect(): void {
    // Normalize the server-rendered indices to 0..n-1 once (the adopter loops its real records, which
    // may be non-contiguous). Idempotent: re-running on a contiguous list changes nothing, so a wire
    // morph that re-connects the controller is safe.
    if (this.hasBlocksTarget) {
      this.reindex();
    }
  }

  /** Add-menu click: clone THIS button's type template as the next contiguous block. */
  add(event: Event): void {
    event.preventDefault();
    const button = event.currentTarget as HTMLElement;
    this.addBlock(button.getAttribute("data-builder-add") ?? "");
  }

  /** Per-block remove click: drop the enclosing card, then re-index the survivors. */
  remove(event: Event): void {
    event.preventDefault();
    const card = (event.currentTarget as HTMLElement).closest<HTMLElement>("[data-builder-block]");
    if (card != null) {
      this.removeBlock(card);
    }
  }

  // --- internals -------------------------------------------------------------------------------

  /** The field prefix the block names share (`<name>[<i>][...]`); `"blocks"` if the root omits it. */
  private get prefix(): string {
    return this.element.getAttribute("data-name") ?? "blocks";
  }

  private blocks(): HTMLElement[] {
    return this.hasBlocksTarget
      ? Array.from(this.blocksTarget.querySelectorAll<HTMLElement>("[data-builder-block]"))
      : [];
  }

  /** The per-type `<template>` the adopter authored, by type key (null when no such type exists). */
  private templateFor(type: string): HTMLTemplateElement | null {
    if (!this.hasTemplatesTarget) {
      return null;
    }
    return this.templatesTarget.querySelector<HTMLTemplateElement>(
      `template[data-builder-template="${CSS.escape(type)}"]`,
    );
  }

  private announce(message: string): void {
    if (this.hasLiveTarget) {
      this.liveTarget.textContent = message;
    }
  }

  private addBlock(type: string): void {
    const template = this.templateFor(type);
    if (template == null || !this.hasBlocksTarget) {
      return;
    }
    const fragment = template.content.cloneNode(true) as DocumentFragment;
    const card = fragment.querySelector<HTMLElement>("[data-builder-block]");
    if (card == null) {
      return;
    }
    this.blocksTarget.appendChild(card);
    this.reindex();
    const firstField = card.querySelector<HTMLElement>(
      "input:not([type=hidden]), select, textarea",
    );
    firstField?.focus();
    this.announce("Block added");
  }

  private removeBlock(card: HTMLElement): void {
    card.remove();
    this.reindex();
    this.announce("Block removed");
  }

  /** Rewrite each block's index: data-index, aria-label number, control labels + every field name. */
  private reindex(): void {
    this.blocks().forEach((card, i) => {
      card.setAttribute("data-index", String(i));
      card.setAttribute("aria-label", this.relabel(card.getAttribute("aria-label"), i));

      for (const field of Array.from(
        card.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("[name]"),
      )) {
        const next = reindexFieldName(field.name, this.prefix, i);
        if (next !== field.name) {
          field.name = next;
        }
      }

      const remove = card.querySelector<HTMLElement>("[data-builder-remove]");
      if (remove != null) {
        remove.setAttribute("aria-label", this.relabel(remove.getAttribute("aria-label"), i));
      }
    });
  }

  /** Replace the trailing number / `__label__` token in an aria-label with the new 1-based number. */
  private relabel(current: string | null, i: number): string {
    const stem = (current ?? "").replace(/\s*(?:\d+|__label__)\s*$/i, "").trim();
    return stem === "" ? `${i + 1}` : `${stem} ${i + 1}`;
  }
}
