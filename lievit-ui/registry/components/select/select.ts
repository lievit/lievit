/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
import { LitElement, html } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { computePosition, flip, size, offset } from "@floating-ui/dom";
import { adoptLightStyles } from "../light-dom/light-dom.js";

/**
 * Option shape passed to `<lv-select>`.
 */
export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

/**
 * `<lv-select>`: a custom select with a floating listbox.
 *
 * Implements the WAI-ARIA APG listbox pattern (research 4.3):
 * - Trigger: `role="combobox"`, `aria-expanded`, `aria-controls`, `aria-haspopup="listbox"`.
 * - Listbox: `role="listbox"`, `aria-label`.
 * - Options: `role="option"`, `aria-selected`, `aria-disabled`.
 * - Keyboard: ArrowUp/Down navigate options; Enter/Space selects; Escape closes;
 *   Home/End jump to first/last; Tab closes.
 *
 * Positioned by `@floating-ui/dom` (flip + size-to-match-trigger-width so it stays
 * in-viewport and is never wider than needed).
 *
 * Form-associated (`static formAssociated`): submits the selected `value` under `name` inside a
 * plain `<form method=post>`, via ElementInternals (`setFormValue`) where supported and a hidden
 * `<input name>` mirror as the portable fallback (e.g. the happy-dom test runtime), so
 * `new FormData(form)` sees the field either way. `formResetCallback` returns it to its initial
 * value; `formDisabledCallback` follows a disabled fieldset. Data down, events up: on selection it
 * emits the back-compat `lv-change` CustomEvent AND native bubbling `input` + `change` events so the
 * wire's `l:model` binds with zero config.
 *
 * Owned source, copied in by `lievit add select`. Light-DOM rendered.
 * npm dep: `@floating-ui/dom` (declared in meta.json, installed by `lievit add`).
 */
@customElement("lv-select")
export class LvSelect extends LitElement {
  /** Marks the element form-associated so it participates in form submission and reset. */
  static readonly formAssociated = true;

  /** The available options. */
  @property({ type: Array }) options: SelectOption[] = [];

  /** Currently selected value. */
  @property() value = "";

  /** Form field name; the control submits its selected value under this name. */
  @property() name = "";

  /** Placeholder shown when nothing is selected. */
  @property() placeholder = "Select…";

  /** Disables the control. */
  @property({ type: Boolean }) disabled = false;

  /** Marks the field invalid. */
  @property({ type: Boolean }) invalid = false;

  /** Accessible label for the listbox. */
  @property() label = "";

  /** Id forwarded to the trigger for external label association. */
  @property() inputId = "";

  @state() private open = false;
  @state() private activeIndex = -1;

  private static seq = 0;
  private readonly listboxId = `lv-select-lb-${LvSelect.seq++}`;

  /** ElementInternals where supported (real browsers); undefined in environments without it. */
  private readonly internals: ElementInternals | null = (() => {
    try {
      return (this as { attachInternals?: () => ElementInternals }).attachInternals?.() ?? null;
    } catch {
      return null;
    }
  })();

  /** The value the control resets to on form reset (captured at first connect). */
  private initialValue = "";

  /** Reports the current value to the form (ElementInternals; the hidden mirror covers the rest). */
  private syncFormValue() {
    this.internals?.setFormValue(this.value);
  }

  /** Reset to the initial value (form-associated lifecycle). */
  formResetCallback() {
    this.value = this.initialValue;
    this.syncFormValue();
    this.requestUpdate();
  }

  /** Follow a disabled ancestor fieldset (form-associated lifecycle). */
  formDisabledCallback(disabled: boolean) {
    this.disabled = disabled;
  }

  createRenderRoot(): this {
    adoptLightStyles("lv-select", LvSelect.css);
    return this;
  }

  static readonly css = `
    .lv-select { position: relative; display: block; }
    .lv-select__trigger {
      display: flex;
      align-items: center;
      justify-content: space-between;
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
    }
    .lv-select__trigger:focus-visible { outline: none; box-shadow: var(--lv-ring); }
    .lv-select__trigger--invalid { border-color: var(--lv-color-danger); }
    .lv-select__trigger[disabled] { opacity: 0.5; cursor: not-allowed; }
    .lv-select__value { flex: 1; min-width: 0; }
    .lv-select__placeholder { color: var(--lv-color-muted); }
    .lv-select__chevron {
      flex-shrink: 0;
      margin-left: var(--lv-space-2);
      font-size: 0.6em;
      transition: transform 150ms ease;
    }
    .lv-select__chevron--open { transform: rotate(180deg); }
    .lv-select__listbox {
      position: fixed;
      z-index: 9200;
      background: var(--lv-color-bg);
      border: 1px solid var(--lv-color-border);
      border-radius: var(--lv-radius-md);
      box-shadow: var(--lv-shadow-md);
      padding: var(--lv-space-1) 0;
      overflow-y: auto;
      max-height: 16rem;
      display: none;
    }
    .lv-select__listbox--open { display: block; }
    .lv-select__option {
      font-family: var(--lv-font-sans);
      font-size: var(--lv-text-sm);
      padding: var(--lv-space-2) var(--lv-space-3);
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: var(--lv-space-2);
    }
    .lv-select__option:hover { background: var(--lv-color-surface); }
    .lv-select__option--active { background: color-mix(in srgb, var(--lv-color-primary) 10%, var(--lv-color-bg)); }
    .lv-select__option--selected { font-weight: 600; }
    .lv-select__option--disabled { opacity: 0.5; cursor: not-allowed; pointer-events: none; }
    .lv-select__option-check { visibility: hidden; font-size: 0.75em; }
    .lv-select__option--selected .lv-select__option-check { visibility: visible; }
  `;

  connectedCallback() {
    super.connectedCallback();
    this.initialValue = this.value;
    this.syncFormValue();
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
      this.closeList();
    }
  };

  private handleGlobalKey = (e: KeyboardEvent) => {
    if (!this.open) return;
    if (e.key === "Escape" || e.key === "Tab") {
      e.preventDefault();
      this.closeList();
    }
  };

  private openList() {
    if (this.disabled) return;
    const currentIdx = this.options.findIndex((o) => o.value === this.value);
    this.activeIndex = currentIdx >= 0 ? currentIdx : 0;
    this.open = true;
    this.updateComplete.then(() => this.position());
  }

  private closeList() {
    this.open = false;
  }

  private async position() {
    const trigger = this.querySelector(".lv-select__trigger") as HTMLElement | null;
    const listbox = this.querySelector(".lv-select__listbox") as HTMLElement | null;
    if (!trigger || !listbox) return;

    const { x, y } = await computePosition(trigger, listbox, {
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
    listbox.style.left = `${x}px`;
    listbox.style.top = `${y}px`;
  }

  private selectOption(opt: SelectOption) {
    if (opt.disabled) return;
    this.value = opt.value;
    this.syncFormValue();
    // Back-compat CustomEvent plus native input + change so `l:model` (native event listener) binds.
    this.dispatchEvent(
      new CustomEvent("lv-change", { detail: opt.value, bubbles: true, composed: true })
    );
    this.dispatchEvent(new Event("input", { bubbles: true }));
    this.dispatchEvent(new Event("change", { bubbles: true }));
    this.closeList();
    const trigger = this.querySelector(".lv-select__trigger") as HTMLElement | null;
    trigger?.focus();
  }

  private onTriggerKeyDown(e: KeyboardEvent) {
    if (this.disabled) return;
    switch (e.key) {
      case "ArrowDown":
      case " ":
      case "Enter":
        e.preventDefault();
        if (!this.open) {
          this.openList();
        } else {
          const opt = this.options[this.activeIndex];
          if (opt) this.selectOption(opt);
        }
        break;
      case "ArrowUp":
        e.preventDefault();
        if (!this.open) {
          this.openList();
        } else {
          this.moveActive(-1);
        }
        break;
      case "Home":
        if (this.open) {
          e.preventDefault();
          this.activeIndex = 0;
        }
        break;
      case "End":
        if (this.open) {
          e.preventDefault();
          this.activeIndex = this.options.length - 1;
        }
        break;
    }
  }

  private onListKeyDown(e: KeyboardEvent) {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        this.moveActive(1);
        break;
      case "ArrowUp":
        e.preventDefault();
        this.moveActive(-1);
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        if (this.activeIndex >= 0) this.selectOption(this.options[this.activeIndex]);
        break;
      case "Home":
        e.preventDefault();
        this.activeIndex = 0;
        break;
      case "End":
        e.preventDefault();
        this.activeIndex = this.options.length - 1;
        break;
    }
  }

  private moveActive(delta: number) {
    const len = this.options.length;
    if (len === 0) return;
    let idx = this.activeIndex + delta;
    // skip disabled
    while (idx >= 0 && idx < len && this.options[idx].disabled) {
      idx += delta;
    }
    if (idx >= 0 && idx < len) {
      this.activeIndex = idx;
    }
  }

  private selectedLabel(): string {
    return this.options.find((o) => o.value === this.value)?.label ?? "";
  }

  render() {
    const selected = this.selectedLabel();
    return html`
      <div class="lv-select">
        <button
          class="lv-select__trigger ${this.invalid ? "lv-select__trigger--invalid" : ""}"
          id=${this.inputId || ""}
          type="button"
          role="combobox"
          aria-expanded=${this.open ? "true" : "false"}
          aria-controls=${this.listboxId}
          aria-haspopup="listbox"
          aria-invalid=${this.invalid ? "true" : "false"}
          aria-label=${this.label || ""}
          ?disabled=${this.disabled}
          @click=${() => (this.open ? this.closeList() : this.openList())}
          @keydown=${this.onTriggerKeyDown}
        >
          <span class="lv-select__value">
            ${selected
              ? html`${selected}`
              : html`<span class="lv-select__placeholder">${this.placeholder}</span>`}
          </span>
          <span class="lv-select__chevron ${this.open ? "lv-select__chevron--open" : ""}">▼</span>
        </button>

        <ul
          class="lv-select__listbox ${this.open ? "lv-select__listbox--open" : ""}"
          id=${this.listboxId}
          role="listbox"
          aria-label=${this.label || this.placeholder}
          @keydown=${this.onListKeyDown}
          tabindex="-1"
        >
          ${this.options.map((opt, i) => html`
            <li
              class="lv-select__option
                ${opt.value === this.value ? "lv-select__option--selected" : ""}
                ${i === this.activeIndex ? "lv-select__option--active" : ""}
                ${opt.disabled ? "lv-select__option--disabled" : ""}"
              role="option"
              aria-selected=${opt.value === this.value ? "true" : "false"}
              aria-disabled=${opt.disabled ? "true" : "false"}
              @click=${() => this.selectOption(opt)}
              @mouseenter=${() => { if (!opt.disabled) this.activeIndex = i; }}
            >
              <span class="lv-select__option-check" aria-hidden="true">✓</span>
              ${opt.label}
            </li>
          `)}
        </ul>
        ${this.internals
          ? null
          : html`<input type="hidden" name=${this.name || ""} .value=${this.value} />`}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "lv-select": LvSelect;
  }
}
