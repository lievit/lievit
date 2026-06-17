/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
import { LitElement, html } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { computePosition, flip, size, offset } from "@floating-ui/dom";
import { adoptLightStyles } from "../light-dom/light-dom.js";

/**
 * Option shape for `<lv-rich-select>`.
 */
export interface RichSelectOption {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
}

/**
 * `<lv-rich-select>`: a searchable single/multi select with floating listbox.
 *
 * Extends `<lv-select>` in capability: adds client-side search filtering and
 * optional multi-select (checkbox per option). Implements the WAI-ARIA APG
 * combobox / listbox pattern (research 4.3):
 * - Trigger + inline search input: `role="combobox"`, `aria-expanded`,
 *   `aria-controls`, `aria-haspopup="listbox"`, `aria-autocomplete="list"`.
 * - Listbox: `role="listbox"`, `aria-multiselectable` when multi.
 * - Options: `role="option"`, `aria-selected`, `aria-disabled`.
 * - Keyboard: ArrowUp/Down navigate; Enter/Space select; Escape/Tab close;
 *   Home/End jump to first/last; typing filters instantly.
 *
 * Data down, events up:
 * - Single: emits `lv-change` with the selected value string.
 * - Multi: emits `lv-change` with the selected string[] array.
 *
 * Positioned by `@floating-ui/dom` (flip + size-to-trigger-width).
 * Owned source, copied in by `lievit add rich-select`. Light-DOM rendered.
 * npm dep: `@floating-ui/dom` (declared in meta.json, installed by `lievit add`).
 */
@customElement("lv-rich-select")
export class LvRichSelect extends LitElement {
  /** Available options. */
  @property({ type: Array }) options: RichSelectOption[] = [];

  /** Currently selected value (single mode) or values (multi mode). */
  @property({ type: Object }) value: string | string[] = "";

  /** Allow multiple selection. */
  @property({ type: Boolean }) multiple = false;

  /** Placeholder shown when nothing is selected. */
  @property() placeholder = "Select…";

  /** Placeholder text inside the search input. */
  @property() searchPlaceholder = "Search…";

  /** Disables the control. */
  @property({ type: Boolean }) disabled = false;

  /** Marks the field invalid. */
  @property({ type: Boolean }) invalid = false;

  /** Accessible label for the listbox. */
  @property() label = "";

  /** Id forwarded to the trigger for external label association. */
  @property() inputId = "";

  @state() private open = false;
  @state() private query = "";
  @state() private activeIndex = -1;

  private static seq = 0;
  private readonly listboxId = `lv-rich-select-lb-${LvRichSelect.seq++}`;

  createRenderRoot(): this {
    adoptLightStyles("lv-rich-select", LvRichSelect.css);
    return this;
  }

  static readonly css = `
    .lv-rs { position: relative; display: block; }
    .lv-rs__trigger {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--lv-space-2);
      width: 100%;
      font-family: var(--lv-font-sans);
      font-size: var(--lv-text-base);
      color: var(--lv-color-fg);
      background: var(--lv-color-bg);
      padding: var(--lv-space-2) var(--lv-space-3);
      border: 1px solid var(--lv-color-border);
      border-radius: var(--lv-radius-sm);
      cursor: pointer;
      text-align: left;
      box-sizing: border-box;
      min-height: 2.5rem;
    }
    .lv-rs__trigger:focus-visible { outline: none; box-shadow: var(--lv-ring); }
    .lv-rs__trigger--invalid { border-color: var(--lv-color-danger); }
    .lv-rs__trigger[disabled] { opacity: 0.5; cursor: not-allowed; }
    .lv-rs__trigger--open { border-color: var(--lv-color-primary); }
    .lv-rs__value { flex: 1; min-width: 0; display: flex; flex-wrap: wrap; gap: var(--lv-space-1); align-items: center; }
    .lv-rs__placeholder { color: var(--lv-color-muted); }
    .lv-rs__tag {
      display: inline-flex;
      align-items: center;
      gap: var(--lv-space-1);
      background: color-mix(in srgb, var(--lv-color-primary) 12%, var(--lv-color-bg));
      color: var(--lv-color-fg);
      font-size: var(--lv-text-sm);
      padding: 1px var(--lv-space-2);
      border-radius: var(--lv-radius-sm);
    }
    .lv-rs__tag-remove {
      background: transparent;
      border: 0;
      cursor: pointer;
      color: var(--lv-color-muted);
      font-size: 0.75em;
      padding: 0;
      line-height: 1;
    }
    .lv-rs__tag-remove:hover { color: var(--lv-color-danger); }
    .lv-rs__chevron { flex-shrink: 0; font-size: 0.6em; transition: transform 150ms ease; }
    .lv-rs__chevron--open { transform: rotate(180deg); }
    .lv-rs__panel {
      position: fixed;
      z-index: 9200;
      background: var(--lv-color-bg);
      border: 1px solid var(--lv-color-border);
      border-radius: var(--lv-radius-md);
      box-shadow: var(--lv-shadow-md);
      display: none;
      overflow: hidden;
    }
    .lv-rs__panel--open { display: flex; flex-direction: column; }
    .lv-rs__search-wrap {
      padding: var(--lv-space-2) var(--lv-space-3);
      border-bottom: 1px solid var(--lv-color-border);
    }
    .lv-rs__search {
      width: 100%;
      font-family: var(--lv-font-sans);
      font-size: var(--lv-text-sm);
      color: var(--lv-color-fg);
      background: var(--lv-color-bg);
      border: 1px solid var(--lv-color-border);
      border-radius: var(--lv-radius-sm);
      padding: var(--lv-space-1) var(--lv-space-2);
      box-sizing: border-box;
    }
    .lv-rs__search:focus-visible { outline: none; box-shadow: var(--lv-ring); }
    .lv-rs__listbox {
      overflow-y: auto;
      max-height: 14rem;
      padding: var(--lv-space-1) 0;
    }
    .lv-rs__option {
      display: flex;
      align-items: flex-start;
      gap: var(--lv-space-2);
      font-family: var(--lv-font-sans);
      font-size: var(--lv-text-sm);
      color: var(--lv-color-fg);
      padding: var(--lv-space-2) var(--lv-space-3);
      cursor: pointer;
    }
    .lv-rs__option:hover { background: var(--lv-color-surface); }
    .lv-rs__option--active { background: color-mix(in srgb, var(--lv-color-primary) 10%, var(--lv-color-bg)); }
    .lv-rs__option--selected .lv-rs__option-label { font-weight: 600; }
    .lv-rs__option--disabled { opacity: 0.5; cursor: not-allowed; pointer-events: none; }
    .lv-rs__check { flex-shrink: 0; width: 1rem; text-align: center; font-size: 0.75em; visibility: hidden; }
    .lv-rs__option--selected .lv-rs__check { visibility: visible; color: var(--lv-color-primary); }
    .lv-rs__option-text { flex: 1; min-width: 0; }
    .lv-rs__option-label { display: block; }
    .lv-rs__option-desc { display: block; font-size: var(--lv-text-sm); color: var(--lv-color-muted); margin-top: 1px; }
    .lv-rs__empty {
      font-family: var(--lv-font-sans);
      font-size: var(--lv-text-sm);
      color: var(--lv-color-muted);
      padding: var(--lv-space-3);
      text-align: center;
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    document.addEventListener("mousedown", this.handleOutsideClick);
    document.addEventListener("keydown", this.handleGlobalKey);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener("mousedown", this.handleOutsideClick);
    document.removeEventListener("keydown", this.handleGlobalKey);
  }

  private handleOutsideClick = (e: MouseEvent) => {
    if (this.open && !this.contains(e.target as Node)) {
      this.closePanel();
    }
  };

  private handleGlobalKey = (e: KeyboardEvent) => {
    if (!this.open) return;
    if (e.key === "Escape" || e.key === "Tab") {
      e.preventDefault();
      this.closePanel();
      this.focusTrigger();
    }
  };

  private get filteredOptions(): RichSelectOption[] {
    const q = this.query.trim().toLowerCase();
    if (!q) return this.options;
    return this.options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        (o.description ?? "").toLowerCase().includes(q)
    );
  }

  private openPanel() {
    if (this.disabled) return;
    this.query = "";
    this.activeIndex = 0;
    this.open = true;
    this.updateComplete.then(() => {
      this.position();
      (this.querySelector(".lv-rs__search") as HTMLElement | null)?.focus();
    });
  }

  private closePanel() {
    this.open = false;
    this.query = "";
    this.activeIndex = -1;
  }

  private focusTrigger() {
    (this.querySelector(".lv-rs__trigger") as HTMLElement | null)?.focus();
  }

  private async position() {
    const trigger = this.querySelector(".lv-rs__trigger") as HTMLElement | null;
    const panel = this.querySelector(".lv-rs__panel") as HTMLElement | null;
    if (!trigger || !panel) return;

    const { x, y } = await computePosition(trigger, panel, {
      placement: "bottom-start",
      middleware: [
        offset(4),
        flip(),
        size({
          apply({ rects, elements }) {
            elements.floating.style.width = `${rects.reference.width}px`;
          },
        }),
      ],
    });
    panel.style.left = `${x}px`;
    panel.style.top = `${y}px`;
  }

  private isSelected(value: string): boolean {
    if (this.multiple) {
      return Array.isArray(this.value) && (this.value as string[]).includes(value);
    }
    return this.value === value;
  }

  private toggleOption(opt: RichSelectOption) {
    if (opt.disabled) return;
    if (this.multiple) {
      const current = Array.isArray(this.value) ? (this.value as string[]) : [];
      const next = current.includes(opt.value)
        ? current.filter((v) => v !== opt.value)
        : [...current, opt.value];
      this.value = next;
      this.dispatchEvent(
        new CustomEvent("lv-change", { detail: next, bubbles: true, composed: true })
      );
    } else {
      this.value = opt.value;
      this.dispatchEvent(
        new CustomEvent("lv-change", { detail: opt.value, bubbles: true, composed: true })
      );
      this.closePanel();
      this.focusTrigger();
    }
  }

  private removeTag(value: string, e: Event) {
    e.stopPropagation();
    if (this.multiple && Array.isArray(this.value)) {
      const next = (this.value as string[]).filter((v) => v !== value);
      this.value = next;
      this.dispatchEvent(
        new CustomEvent("lv-change", { detail: next, bubbles: true, composed: true })
      );
    }
  }

  private onSearchInput(e: Event) {
    this.query = (e.target as HTMLInputElement).value;
    this.activeIndex = 0;
  }

  private onSearchKeyDown(e: KeyboardEvent) {
    const filtered = this.filteredOptions;
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        this.moveActive(1, filtered);
        break;
      case "ArrowUp":
        e.preventDefault();
        this.moveActive(-1, filtered);
        break;
      case "Home":
        e.preventDefault();
        this.activeIndex = 0;
        break;
      case "End":
        e.preventDefault();
        this.activeIndex = filtered.length - 1;
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        if (this.activeIndex >= 0 && filtered[this.activeIndex]) {
          this.toggleOption(filtered[this.activeIndex]);
        }
        break;
    }
  }

  private moveActive(delta: number, filtered: RichSelectOption[]) {
    const len = filtered.length;
    if (len === 0) return;
    let idx = this.activeIndex + delta;
    while (idx >= 0 && idx < len && filtered[idx].disabled) {
      idx += delta;
    }
    if (idx >= 0 && idx < len) {
      this.activeIndex = idx;
    }
  }

  private renderTriggerValue() {
    if (this.multiple) {
      const selected = Array.isArray(this.value) ? (this.value as string[]) : [];
      if (selected.length === 0) {
        return html`<span class="lv-rs__placeholder">${this.placeholder}</span>`;
      }
      return selected.map((v) => {
        const opt = this.options.find((o) => o.value === v);
        if (!opt) return null;
        return html`
          <span class="lv-rs__tag">
            ${opt.label}
            <button
              class="lv-rs__tag-remove"
              type="button"
              aria-label="Remove ${opt.label}"
              @click=${(e: Event) => this.removeTag(v, e)}
            >&#x2715;</button>
          </span>
        `;
      });
    } else {
      const opt = this.options.find((o) => o.value === this.value);
      if (!opt) return html`<span class="lv-rs__placeholder">${this.placeholder}</span>`;
      return html`${opt.label}`;
    }
  }

  render() {
    const filtered = this.filteredOptions;

    return html`
      <div class="lv-rs">
        <button
          class="lv-rs__trigger
            ${this.invalid ? "lv-rs__trigger--invalid" : ""}
            ${this.open ? "lv-rs__trigger--open" : ""}"
          id=${this.inputId || ""}
          type="button"
          role="combobox"
          aria-expanded=${this.open ? "true" : "false"}
          aria-controls=${this.listboxId}
          aria-haspopup="listbox"
          aria-autocomplete="list"
          aria-invalid=${this.invalid ? "true" : "false"}
          aria-label=${this.label || ""}
          aria-multiselectable=${this.multiple ? "true" : "false"}
          ?disabled=${this.disabled}
          @click=${() => (this.open ? this.closePanel() : this.openPanel())}
        >
          <span class="lv-rs__value">${this.renderTriggerValue()}</span>
          <span class="lv-rs__chevron ${this.open ? "lv-rs__chevron--open" : ""}"
            aria-hidden="true">▼</span>
        </button>

        <div
          class="lv-rs__panel ${this.open ? "lv-rs__panel--open" : ""}"
          id=${this.listboxId}
        >
          <div class="lv-rs__search-wrap">
            <input
              class="lv-rs__search"
              type="text"
              placeholder=${this.searchPlaceholder}
              aria-label="Search options"
              aria-controls=${this.listboxId + "-list"}
              .value=${this.query}
              @input=${this.onSearchInput}
              @keydown=${this.onSearchKeyDown}
            />
          </div>

          <ul
            class="lv-rs__listbox"
            id=${this.listboxId + "-list"}
            role="listbox"
            aria-label=${this.label || this.placeholder}
            aria-multiselectable=${this.multiple ? "true" : "false"}
          >
            ${filtered.length === 0
              ? html`<li class="lv-rs__empty" role="option" aria-disabled="true">No options</li>`
              : filtered.map((opt, i) => html`
                <li
                  class="lv-rs__option
                    ${this.isSelected(opt.value) ? "lv-rs__option--selected" : ""}
                    ${i === this.activeIndex ? "lv-rs__option--active" : ""}
                    ${opt.disabled ? "lv-rs__option--disabled" : ""}"
                  role="option"
                  aria-selected=${this.isSelected(opt.value) ? "true" : "false"}
                  aria-disabled=${opt.disabled ? "true" : "false"}
                  @click=${() => this.toggleOption(opt)}
                  @mouseenter=${() => { if (!opt.disabled) this.activeIndex = i; }}
                >
                  <span class="lv-rs__check" aria-hidden="true">✓</span>
                  <span class="lv-rs__option-text">
                    <span class="lv-rs__option-label">${opt.label}</span>
                    ${opt.description
                      ? html`<span class="lv-rs__option-desc">${opt.description}</span>`
                      : null}
                  </span>
                </li>
              `)}
          </ul>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "lv-rich-select": LvRichSelect;
  }
}
