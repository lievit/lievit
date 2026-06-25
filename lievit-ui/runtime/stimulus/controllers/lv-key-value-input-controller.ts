/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * `lv-key-value-input` -- the editable repeatable key/value FORM control (Filament's KeyValue), as a
 * Stimulus controller (the conversion of `registry/jte/key-value-input.enhancer.ts`). Mounted on the
 * component ROOT via `data-controller="lv-key-value-input"`.
 *
 * The value plumbing stays SERVER-FIRST: each row is two native inputs named `<name>[<i>][key]` /
 * `<name>[<i>][value]`, so the rows POST as a contiguous indexed form-array with ZERO JavaScript
 * (a Spring binder rebuilds the ordered Map). JS-OFF, Add is an explicit submit (`<name>__add`) and
 * remove is a per-row submit (`<name>__remove`, value=index) that round-trip to the server. This
 * controller makes the editing in-place: it clones the hidden `<template>` row to ADD and drops a
 * row to REMOVE, then RE-INDEXES the survivors so the POSTed indices stay contiguous (0..n-1) and a
 * server binder rebuilds the ordered map without gaps. The native inputs remain the form source of
 * truth, so the field POSTs identically whether or not JS ran.
 *
 * UNCONTROLLED by nature: add/remove are pure client-side ergonomics on top of the native form, so
 * this controller NEVER round-trips the lievit wire (no `data-lv-wire-close`, never extends
 * DismissableController). It therefore extends the plain Stimulus {@link Controller} -- the
 * controlled/uncontrolled doctrine collapses to its silent branch here.
 *
 * CSP-clean wiring (NOT inline handlers): Add/remove clicks arrive via `data-action`; rows / the
 * `<template>` / the aria-live region are reached via Stimulus targets; descendants of a row are
 * read off the canonical shadcn `data-slot` namespace (`key-value-input-row|key|value|remove`).
 *
 * Morph-safety: there is NO `data-*-enhanced` marker and NO manually-bound listener -- every click
 * is a declared `data-action` Stimulus re-binds automatically after the wire morph + idiomorph, and
 * Stimulus connects/disconnects this controller exactly once per element. The round-2
 * listener-stacking and the WeakSet/`afterCall` bookkeeping are structurally impossible.
 *
 * a11y (WAI-ARIA): each input keeps an aria-label naming its role + 1-based row; the per-row remove
 * keeps "Remove row N"; an aria-live region announces add/remove. Reindex rewrites all three so the
 * labels track the visible row order.
 */

import { Controller } from "@hotwired/stimulus";

/** The default field prefix when the root omits `data-name` (kept identical to the enhancer). */
const DEFAULT_PREFIX = "kv";

const ROW_SLOT = '[data-slot="key-value-input-row"]';
const KEY_SLOT = '[data-slot="key-value-input-key"]';
const VALUE_SLOT = '[data-slot="key-value-input-value"]';
const REMOVE_SLOT = '[data-slot="key-value-input-remove"]';

/** Build the canonical indexed form-array field name: `indexedName("meta", 2, "key")` -> `"meta[2][key]"`. */
function indexedName(prefix: string, index: number, field: "key" | "value"): string {
  return `${prefix}[${index}][${field}]`;
}

export default class LvKeyValueInputController extends Controller<HTMLElement> {
  static targets = ["rows", "template", "live"];

  declare readonly rowsTarget: HTMLElement;
  declare readonly templateTarget: HTMLTemplateElement;
  declare readonly hasLiveTarget: boolean;
  declare readonly liveTarget: HTMLElement;

  /** Normalize indices over the SSR rows once (a no-op when the server rendered them 0..n-1). */
  connect(): void {
    this.reindex();
  }

  /** Add row: clone the hidden `<template>` row, append it, reindex, focus its key input, announce. */
  add(event: Event): void {
    event.preventDefault();
    const fragment = this.templateTarget.content.cloneNode(true) as DocumentFragment;
    const row = fragment.querySelector<HTMLElement>(ROW_SLOT);
    if (row == null) {
      return;
    }
    this.rowsTarget.appendChild(row);
    this.reindex();
    row.querySelector<HTMLInputElement>(KEY_SLOT)?.focus();
    this.announce("Row added");
  }

  /** Remove row: drop the row enclosing the clicked trash button, reindex the survivors, announce. */
  remove(event: Event): void {
    event.preventDefault();
    const button = event.currentTarget as HTMLElement;
    const row = button.closest<HTMLElement>(ROW_SLOT);
    if (row == null) {
      return;
    }
    row.remove();
    this.reindex();
    this.announce("Row removed");
  }

  /** The field prefix the rows POST under (`<prefix>[<i>][key|value]`), read off the root. */
  private get prefix(): string {
    return this.element.getAttribute("data-name") ?? DEFAULT_PREFIX;
  }

  /** Rewrite every row's `data-index`, the two input names, and the three aria-labels to its position. */
  private reindex(): void {
    const rows = Array.from(this.rowsTarget.querySelectorAll<HTMLElement>(ROW_SLOT));
    rows.forEach((row, i) => {
      row.setAttribute("data-index", String(i));
      const keyInput = row.querySelector<HTMLInputElement>(KEY_SLOT);
      const valueInput = row.querySelector<HTMLInputElement>(VALUE_SLOT);
      if (keyInput != null) {
        keyInput.name = indexedName(this.prefix, i, "key");
        keyInput.setAttribute("aria-label", relabel(keyInput, i));
      }
      if (valueInput != null) {
        valueInput.name = indexedName(this.prefix, i, "value");
        valueInput.setAttribute("aria-label", relabel(valueInput, i));
      }
      row.querySelector<HTMLElement>(REMOVE_SLOT)?.setAttribute("aria-label", `Remove row ${i + 1}`);
    });
  }

  /** Announce an add/remove to the polite aria-live region (no-op if absent). */
  private announce(message: string): void {
    if (this.hasLiveTarget) {
      this.liveTarget.textContent = message;
    }
  }
}

/** Replace the trailing "row N" in an aria-label with the new 1-based row number, keeping its stem. */
function relabel(el: HTMLElement, i: number): string {
  const current = el.getAttribute("aria-label") ?? "";
  const stem = current.replace(/,?\s*row\b.*$/i, "");
  return `${stem}, row ${i + 1}`;
}
