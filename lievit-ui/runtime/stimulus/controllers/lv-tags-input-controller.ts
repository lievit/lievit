/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * `lv-tags-input` -- the Filament-style TAGS field (chips + add-input + optional suggestions), as a
 * Stimulus controller (the conversion of `registry/jte/tags-input.enhancer.ts`). Mounted on the
 * component ROOT via `data-controller="lv-tags-input"`.
 *
 * TIER: CLIENT-ENHANCER (form-native, NOT WIRE). Every committed tag is a chip carrying a hidden
 * `<input name=...>`, so the set POSTs as a REPEATED `name` with zero JS; the hidden inputs stay the
 * form source of truth. This controller makes the editing in-place: Enter / the delimiter key / the
 * Add button append a chip + its hidden input, the chip x removes it, Backspace-on-empty pops the
 * last, paste splits on the delimiter, suggestions quick-pick, and chip keyboard navigation
 * (ArrowLeft/Right/Home/End, Delete/Backspace/Enter/Space) uses roving tabindex; an aria-live region
 * announces add/remove/dedup.
 *
 * Controlled / uncontrolled doctrine: a form-native field is, by construction, UNCONTROLLED -- every
 * edit is purely client-side and fires ZERO `/lievit/<id>/call`. There is no overlay open-state for
 * the server to own, so the controller never reaches the wire (no `DismissableController`, no
 * `data-lv-wire-close`). The wire-410 "page expired" regression is structurally impossible here.
 *
 * shadcn DOM namespace: every hook is a `data-slot` / `data-tags-input-*` attribute (the established,
 * golden-pinned contract); the controller reads the DOM the server rendered and never invents data.
 *
 * Wiring (CSP-clean, NEVER inline handlers): element events are declared as `data-action` in the
 * template (`keydown`/`paste` on the entry field; `click` on the Add / clear-all / suggestion
 * buttons; `keydown` on each chip; `click` on each chip's remove button). Stimulus's action observer
 * binds them on connect AND re-binds them automatically for the chips this controller appends at
 * runtime -- and for any node a morph re-renders. So there is NO `data-*-enhanced` marker, no
 * `WeakSet` of wired roots, no teardown sweep: Stimulus owns connect/disconnect, which makes the
 * idempotency and the morph-safety free.
 *
 * a11y source: WAI-ARIA BUILT model (no APG pattern for token entry) -- roving tabindex from the APG
 * Keyboard Interface practices + raw group/option semantics.
 */

import { Controller } from "@hotwired/stimulus";

const CHIP = "[data-tags-input-chip]";
const VALUE = "[data-tags-input-value]";

/** Trim a raw tag; an empty / whitespace-only tag normalizes to "" (rejected by the caller). */
export function normalizeTag(raw: string): string {
  return raw.trim();
}

/** Where focus should land after a chip is removed by a gesture that has a "current" position. */
type FocusAfterRemove = "next" | "prev" | "entry";

export default class LvTagsInputController extends Controller<HTMLElement> {
  /**
   * JS-on: the explicit Add submit becomes redundant (Enter / the delimiter add in place) so hide
   * it, and establish the single roving-tabindex chip. Bind NOTHING here -- every listener is a
   * declared `data-action`, so Stimulus owns binding + teardown across morphs.
   */
  connect(): void {
    const add = this.addButton;
    if (add != null) {
      add.hidden = true;
    }
    this.syncRovingTabindex();
  }

  // --- entry field (data-action on `[data-tags-input-field]`) --------------------------------

  /** Enter / delimiter commit; Escape clears; Backspace-on-empty pops; ArrowLeft/Home/End enter the chips. */
  onFieldKeydown(event: KeyboardEvent): void {
    const field = event.currentTarget as HTMLInputElement;
    const key = event.key;

    if (key === "Enter" || key === this.delimiter) {
      event.preventDefault();
      if (this.addTag(field.value)) {
        field.value = "";
      }
      return;
    }

    if (key === "Escape") {
      event.preventDefault();
      field.value = "";
      return;
    }

    if (key === "Backspace" && field.value === "") {
      event.preventDefault();
      const all = this.chips();
      const last = all[all.length - 1];
      if (last != null) {
        this.popChip(last);
        field.focus();
      }
      return;
    }

    if (key === "ArrowLeft" && field.selectionStart === 0 && field.selectionEnd === 0) {
      const all = this.chips();
      const last = all[all.length - 1];
      if (last != null) {
        event.preventDefault();
        this.focusChip(last);
      }
      return;
    }

    if (key === "Home") {
      const all = this.chips();
      if (all.length > 0) {
        event.preventDefault();
        this.focusChip(all[0]);
      }
      return;
    }

    if (key === "End") {
      const all = this.chips();
      if (all.length > 0) {
        event.preventDefault();
        this.focusChip(all[all.length - 1]);
      }
    }
  }

  /** Paste: split on the delimiter, add each non-empty trimmed segment, then clear the field. */
  onFieldPaste(event: ClipboardEvent): void {
    event.preventDefault();
    const field = event.currentTarget as HTMLInputElement;
    const text = event.clipboardData?.getData("text") ?? "";
    const segments = text
      .split(this.delimiter)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    for (const segment of segments) {
      this.addTag(segment);
    }
    field.value = "";
  }

  // --- chips (data-action on each chip + its remove button) ----------------------------------

  /** Chip roving navigation + removal (Delete/Backspace/Enter/Space). */
  onChipKeydown(event: KeyboardEvent): void {
    const chip = event.currentTarget as HTMLElement;
    const key = event.key;
    const all = this.chips();
    const idx = all.indexOf(chip);

    if (key === "ArrowLeft") {
      event.preventDefault();
      if (idx > 0) {
        this.focusChip(all[idx - 1]);
      } else {
        this.field?.focus(); // first chip wraps to the entry input
      }
      return;
    }

    if (key === "ArrowRight") {
      event.preventDefault();
      if (idx < all.length - 1) {
        this.focusChip(all[idx + 1]);
      } else {
        this.field?.focus(); // last chip wraps to the entry input
      }
      return;
    }

    if (key === "Home") {
      event.preventDefault();
      if (all.length > 0) {
        this.focusChip(all[0]);
      }
      return;
    }

    if (key === "End") {
      event.preventDefault();
      this.field?.focus();
      return;
    }

    if (key === "Delete" || key === "Backspace" || key === "Enter" || key === " ") {
      event.preventDefault();
      this.removeChip(chip, this.focusAfterRemoving(all, idx));
    }
  }

  /** Click on a chip's x: remove it (and cancel the JS-off submit). */
  onRemoveClick(event: Event): void {
    event.preventDefault();
    const chip = (event.currentTarget as HTMLElement).closest<HTMLElement>(CHIP);
    if (chip == null) {
      return;
    }
    const all = this.chips();
    this.removeChip(chip, this.focusAfterRemoving(all, all.indexOf(chip)));
  }

  // --- well controls (data-action) -----------------------------------------------------------

  /** JS-off Add submit, intercepted: add in place instead of round-tripping. */
  onAddClick(event: Event): void {
    event.preventDefault();
    const field = this.field;
    if (field != null && this.addTag(field.value)) {
      field.value = "";
    }
    field?.focus();
  }

  /** Clear-all: drop every chip (and its hidden input), announce, return focus to the field. */
  onClearAll(event: Event): void {
    event.preventDefault();
    for (const chip of this.chips()) {
      chip.remove();
    }
    this.announce("All tags cleared");
    this.field?.focus();
  }

  /** A suggestion quick-pick: add that tag, keep focus on the field for the next entry. */
  onSuggestionClick(event: Event): void {
    event.preventDefault();
    const tag = (event.currentTarget as HTMLElement).getAttribute("data-tags-input-suggestion") ?? "";
    if (this.addTag(tag)) {
      this.field?.focus();
    }
  }

  // --- internals -----------------------------------------------------------------------------

  private get field(): HTMLInputElement | null {
    return this.element.querySelector<HTMLInputElement>("[data-tags-input-field]");
  }

  private get chipsHost(): HTMLElement | null {
    return this.element.querySelector<HTMLElement>("[data-tags-input-chips]");
  }

  private get liveRegion(): HTMLElement | null {
    return this.element.querySelector<HTMLElement>("[data-tags-input-live]");
  }

  private get addButton(): HTMLButtonElement | null {
    return this.element.querySelector<HTMLButtonElement>("[data-tags-input-add]");
  }

  /** The repeated POST name every hidden input carries (server-rendered into `data-name`). */
  private get name(): string {
    return this.element.getAttribute("data-name") ?? this.field?.name ?? "tags";
  }

  /** The paste-split + keydown-commit delimiter (server-rendered into `data-delimiter`). */
  private get delimiter(): string {
    return this.element.getAttribute("data-delimiter") ?? ",";
  }

  private chips(): HTMLElement[] {
    return Array.from(this.element.querySelectorAll<HTMLElement>(CHIP));
  }

  private currentTags(): string[] {
    return Array.from(this.element.querySelectorAll<HTMLInputElement>(VALUE)).map((i) => i.value);
  }

  private announce(message: string): void {
    const live = this.liveRegion;
    if (live != null) {
      live.textContent = message;
    }
  }

  /** Keep exactly one chip with `tabindex="0"` (roving); everything else gets `-1`. */
  private syncRovingTabindex(active?: HTMLElement): void {
    const all = this.chips();
    if (all.length === 0) {
      return;
    }
    const target = active ?? all[0];
    for (const chip of all) {
      chip.setAttribute("tabindex", chip === target ? "0" : "-1");
    }
  }

  private focusChip(chip: HTMLElement): void {
    this.syncRovingTabindex(chip);
    chip.focus();
  }

  /** Decide where focus lands after removing the chip at `idx`: next sibling, else previous, else field. */
  private focusAfterRemoving(all: HTMLElement[], idx: number): FocusAfterRemove {
    if (all.length === 1) {
      return "entry";
    }
    return idx < all.length - 1 ? "next" : "prev";
  }

  private addTag(raw: string): boolean {
    const tag = normalizeTag(raw);
    const host = this.chipsHost;
    if (tag === "" || host == null) {
      return false;
    }
    if (this.currentTags().includes(tag)) {
      this.announce("Tag already added");
      return false;
    }
    host.appendChild(this.buildChip(tag));
    this.syncRovingTabindex();
    this.announce(`Tag added: ${tag}`);
    return true;
  }

  /** Pop a chip without relocating focus (Backspace-on-empty leaves focus on the entry field). */
  private popChip(chip: HTMLElement): void {
    const tag = chip.getAttribute("data-tags-input-chip") ?? "";
    chip.remove();
    this.syncRovingTabindex();
    this.announce(`Tag removed: ${tag}`);
  }

  private removeChip(chip: HTMLElement, moveFocusTo: FocusAfterRemove): void {
    const tag = chip.getAttribute("data-tags-input-chip") ?? "";
    const all = this.chips();
    const idx = all.indexOf(chip);
    const field = this.field;

    let focusTarget: HTMLElement | null;
    if (moveFocusTo === "next") {
      focusTarget = all[idx + 1] ?? all[idx - 1] ?? field;
    } else if (moveFocusTo === "prev") {
      focusTarget = all[idx - 1] ?? field;
    } else {
      focusTarget = field;
    }

    chip.remove();
    // A surviving chip becomes the roving target; falling back to the field leaves the host empty.
    this.syncRovingTabindex(
      focusTarget != null && focusTarget !== field ? focusTarget : undefined,
    );
    this.announce(`Tag removed: ${tag}`);
    focusTarget?.focus();
  }

  /** Build a chip + its hidden POST input, carrying the same `data-action` hooks as the template. */
  private buildChip(tag: string): HTMLElement {
    const chip = document.createElement("span");
    chip.setAttribute("data-slot", "tags-input-chip");
    chip.setAttribute("data-tags-input-chip", tag);
    chip.setAttribute("role", "option");
    chip.setAttribute("aria-selected", "true");
    chip.setAttribute("tabindex", "-1");
    chip.setAttribute("aria-label", `${tag}, press Delete or Backspace to remove`);
    // Stimulus binds this on insertion (the action observer), so the new chip is keyboard-navigable.
    chip.setAttribute("data-action", "keydown->lv-tags-input#onChipKeydown");
    chip.className =
      "inline-flex items-center gap-[var(--lv-space-1)] rounded-full border border-transparent bg-[var(--lv-color-secondary)] px-[var(--lv-space-2)] py-[2px] text-[length:var(--lv-text-sm)] font-[var(--lv-font-medium)] leading-none text-[var(--lv-color-secondary-fg)] outline-none transition-colors cursor-default select-none";

    const hidden = document.createElement("input");
    hidden.type = "hidden";
    hidden.setAttribute("data-slot", "tags-input-value");
    hidden.setAttribute("data-tags-input-value", "");
    hidden.name = this.name;
    hidden.value = tag;

    const labelEl = document.createElement("span");
    labelEl.setAttribute("data-slot", "tags-input-chip-label");
    labelEl.setAttribute("aria-hidden", "true");
    labelEl.textContent = tag;

    const remove = document.createElement("button");
    remove.type = "button"; // JS-on: a plain button, never a submit
    remove.setAttribute("data-slot", "tags-input-remove");
    remove.setAttribute("data-tags-input-remove", tag);
    remove.setAttribute("aria-label", `Remove ${tag}`);
    remove.setAttribute("tabindex", "-1");
    remove.setAttribute("data-action", "click->lv-tags-input#onRemoveClick");
    remove.className =
      "-mr-[2px] inline-flex shrink-0 items-center rounded-full p-[2px] opacity-70 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:shadow-[var(--lv-ring)]";
    remove.innerHTML =
      '<svg aria-hidden="true" focusable="false" width="0.75rem" height="0.75rem" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>';

    chip.append(hidden, labelEl, remove);
    return chip;
  }
}
