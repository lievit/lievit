/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { adoptLightStyles } from "../light-dom/light-dom.js";

/**
 * Radio option definition for `<lv-radio-group>`.
 */
export interface RadioOption {
  /** The value emitted when this option is selected. */
  value: string;
  /** Visible label. */
  label: string;
  /** Disables this specific option. */
  disabled?: boolean;
}

/**
 * `<lv-radio-group>`: an accessible radio button group.
 *
 * Follows WAI-ARIA APG radio group pattern (research 4.3):
 * - `role="radiogroup"` on the container; `role="radio"` on each option button
 *   with `aria-checked` and `aria-disabled`.
 * - Roving `tabindex`: the selected option (or first if none) is `tabindex="0"`,
 *   all others are `-1`.
 * - Arrow Left/Up and Right/Down move focus and select the next/previous enabled
 *   option, wrapping around.
 * - Space selects the focused option; Tab leaves the group entirely.
 *
 * Native `<input type="radio">` buttons inside a `<fieldset>` would give this for
 * free, but they have significant custom-styling limitations. This implementation
 * uses the ARIA role pattern with styled `<button>` elements (WAI-ARIA authoring
 * practices, radio group example).
 *
 * Data down, events up: emits `lv-change` with the selected value string.
 * `value` prop is the currently selected option value (empty string = nothing).
 *
 * Owned source, copied in by `lievit add radio-group`. Light-DOM rendered.
 */
@customElement("lv-radio-group")
export class LvRadioGroup extends LitElement {
  /** Radio options. */
  @property({ type: Array }) options: RadioOption[] = [];

  /** Currently selected value. */
  @property() value = "";

  /** Group label (rendered as a visible legend-like label). */
  @property() label = "";

  /** Disables the entire group. */
  @property({ type: Boolean }) disabled = false;

  /** Orientation of the radio options. */
  @property() orientation: "vertical" | "horizontal" = "vertical";

  createRenderRoot(): this {
    adoptLightStyles("lv-radio-group", LvRadioGroup.css);
    return this;
  }

  static readonly css = `
    .lv-radio-group { display: block; font-family: var(--lv-font-sans); }
    .lv-radio-group__label {
      font-size: var(--lv-text-sm);
      font-weight: 500;
      color: var(--lv-color-fg);
      margin-bottom: var(--lv-space-2);
      display: block;
    }
    .lv-radio-group__options {
      display: flex;
      flex-direction: column;
      gap: var(--lv-space-2);
    }
    .lv-radio-group__options--horizontal {
      flex-direction: row;
      flex-wrap: wrap;
    }
    .lv-radio-option {
      display: inline-flex;
      align-items: center;
      gap: var(--lv-space-2);
      background: transparent;
      border: 0;
      padding: 0;
      cursor: pointer;
      font-family: var(--lv-font-sans);
      font-size: var(--lv-text-sm);
      color: var(--lv-color-fg);
      text-align: left;
    }
    .lv-radio-option:focus-visible { outline: none; }
    .lv-radio-option:focus-visible .lv-radio-indicator { box-shadow: var(--lv-ring); }
    .lv-radio-option[disabled] { opacity: 0.5; cursor: not-allowed; }
    .lv-radio-indicator {
      width: 1rem;
      height: 1rem;
      border-radius: 50%;
      border: 2px solid var(--lv-color-border);
      background: var(--lv-color-bg);
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: border-color 0.15s;
    }
    .lv-radio-indicator--checked {
      border-color: var(--lv-color-primary);
    }
    .lv-radio-indicator__dot {
      width: 0.5rem;
      height: 0.5rem;
      border-radius: 50%;
      background: var(--lv-color-primary);
    }
  `;

  private getEnabled(): RadioOption[] {
    return this.options.filter((o) => !o.disabled && !this.disabled);
  }

  private select(value: string) {
    const opt = this.options.find((o) => o.value === value);
    if (!opt || opt.disabled || this.disabled) return;
    this.value = value;
    this.dispatchEvent(
      new CustomEvent("lv-change", { detail: value, bubbles: true, composed: true })
    );
  }

  private onKeyDown(e: KeyboardEvent, optValue: string) {
    const enabled = this.getEnabled();
    const idx = enabled.findIndex((o) => o.value === optValue);
    let targetValue: string | undefined;

    switch (e.key) {
      case "ArrowDown":
      case "ArrowRight":
        e.preventDefault();
        targetValue = enabled[(idx + 1) % enabled.length]?.value;
        break;
      case "ArrowUp":
      case "ArrowLeft":
        e.preventDefault();
        targetValue = enabled[(idx - 1 + enabled.length) % enabled.length]?.value;
        break;
      case " ":
        e.preventDefault();
        targetValue = optValue;
        break;
      default:
        return;
    }

    if (targetValue !== undefined) {
      this.select(targetValue);
      this.updateComplete.then(() => {
        (this.querySelector(`[data-radio-value="${targetValue}"]`) as HTMLElement | null)?.focus();
      });
    }
  }

  render() {
    // The roving tabindex seed: the selected option, or the first enabled one.
    const rovingTarget =
      this.value ||
      this.options.find((o) => !o.disabled && !this.disabled)?.value ||
      "";

    return html`
      <div
        class="lv-radio-group"
        role="radiogroup"
        aria-label=${this.label}
        aria-disabled=${this.disabled ? "true" : "false"}
      >
        ${this.label
          ? html`<span class="lv-radio-group__label" aria-hidden="true">${this.label}</span>`
          : null}
        <div class="lv-radio-group__options ${this.orientation === "horizontal" ? "lv-radio-group__options--horizontal" : ""}">
          ${this.options.map((opt) => {
            const isChecked = opt.value === this.value;
            const isDisabled = opt.disabled || this.disabled;
            const isTabTarget = opt.value === rovingTarget;
            return html`
              <button
                class="lv-radio-option"
                role="radio"
                type="button"
                data-radio-value=${opt.value}
                aria-checked=${isChecked ? "true" : "false"}
                aria-disabled=${isDisabled ? "true" : "false"}
                tabindex=${isTabTarget ? "0" : "-1"}
                ?disabled=${isDisabled}
                @click=${() => this.select(opt.value)}
                @keydown=${(e: KeyboardEvent) => this.onKeyDown(e, opt.value)}
              >
                <span class="lv-radio-indicator ${isChecked ? "lv-radio-indicator--checked" : ""}">
                  ${isChecked ? html`<span class="lv-radio-indicator__dot"></span>` : null}
                </span>
                <span>${opt.label}</span>
              </button>
            `;
          })}
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "lv-radio-group": LvRadioGroup;
  }
}
