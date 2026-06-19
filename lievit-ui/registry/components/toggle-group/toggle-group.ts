/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
import { LitElement, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { unsafeSVG } from "lit/directives/unsafe-svg.js";
import { adoptLightStyles } from "../light-dom/light-dom.js";
import { iconBodies } from "../../icons/icon-bodies.js";

/**
 * Item definition for `<lv-toggle-group>`.
 */
export interface ToggleGroupItem {
  /** Unique value identifying this item; the group's `value` is one (or many) of these. */
  value: string;
  /** Visible label text. Optional when an icon-only item carries `label` as its a11y name. */
  label?: string;
  /** Optional Lucide icon name (from the vendored sprite). */
  icon?: string;
  /** Disables this single item. */
  disabled?: boolean;
}

/**
 * `<lv-toggle-group>`: a set of toggles with single- or multiple-selection.
 *
 * Accessibility follows Radix ToggleGroup (the a11y source):
 * - `type="single"`: the group is `role="radiogroup"`; each item is `role="radio"` with
 *   `aria-checked`; exactly one (or zero) selected. This is the correct screen-reader model
 *   for single-select, NOT a row of pressed buttons.
 * - `type="multiple"`: the group is `role="group"`; each item is a toggle button with
 *   `aria-pressed`; any number selected.
 * - Roving tabindex: exactly one item is `tabindex="0"` (the selected one, else the first
 *   enabled), all others `-1`. Arrow keys move focus (Left/Up = prev, Right/Down = next),
 *   looping; Home/End jump to first/last. Disabled items are skipped. Focus moving via arrows
 *   does NOT toggle (Space/Enter / click toggles), matching Radix roving-focus.
 *
 * Data down, events up: the group OWNS each child's pressed state via `aria-checked`/
 * `aria-pressed`; `value` is the controlled selection (a string for single, string[] for
 * multiple). Emits a bubbling `lv-change` with the new value on each change.
 *
 * Variant + size cascade to every item (shadcn passes them via context; here via props).
 * Icons come from the vendored Lucide map, never Font Awesome.
 *
 * Owned source, copied in by `lievit add toggle-group`. Light-DOM rendered.
 */
@customElement("lv-toggle-group")
export class LvToggleGroup extends LitElement {
  /** Item definitions. */
  @property({ type: Array }) items: ToggleGroupItem[] = [];

  /** `"single"` selects at most one; `"multiple"` selects any number. */
  @property() type: "single" | "multiple" = "single";

  /**
   * Controlled selection. For `type="single"` a single value (string); for `type="multiple"`
   * an array of values.
   */
  @property({ attribute: false }) value: string | string[] = "";

  /** Disables the whole group. */
  @property({ type: Boolean }) disabled = false;

  /** Visual style applied to every item. */
  @property() variant: "default" | "outline" = "default";

  /** Size applied to every item. */
  @property() size: "sm" | "default" | "lg" = "default";

  /** Accessible label for the group (required for a labelless group of icons). */
  @property({ attribute: "aria-label" }) ariaLabel: string | null = null;

  @state() private _selected: Set<string> = new Set();

  private _initialized = false;

  createRenderRoot(): this {
    adoptLightStyles("lv-toggle-group", LvToggleGroup.css);
    return this;
  }

  static readonly css = `
    .lv-toggle-group { display: inline-flex; align-items: center; gap: var(--lv-space-1); }
    .lv-toggle-group__item {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: var(--lv-space-2);
      border-radius: var(--lv-radius-md);
      border: 1px solid transparent;
      background: transparent;
      color: var(--lv-color-fg);
      font-family: var(--lv-font-sans);
      font-size: var(--lv-text-sm);
      font-weight: 500;
      line-height: var(--lv-leading);
      cursor: pointer;
      transition: background 0.15s, color 0.15s, border-color 0.15s;
    }
    .lv-toggle-group__item--sm { height: 2rem; min-width: 2rem; padding: 0 var(--lv-space-2); }
    .lv-toggle-group__item--default { height: 2.25rem; min-width: 2.25rem; padding: 0 var(--lv-space-3); }
    .lv-toggle-group__item--lg { height: 2.5rem; min-width: 2.5rem; padding: 0 var(--lv-space-4); }
    .lv-toggle-group__item--outline { border-color: var(--lv-color-border); }
    .lv-toggle-group__item:hover { background: var(--lv-color-surface); }
    .lv-toggle-group__item:focus-visible { outline: none; box-shadow: var(--lv-ring); z-index: 1; }
    .lv-toggle-group__item[aria-pressed="true"],
    .lv-toggle-group__item[aria-checked="true"] {
      background: var(--lv-color-muted-bg);
      color: var(--lv-color-fg);
    }
    .lv-toggle-group__item[disabled] { opacity: 0.5; cursor: not-allowed; pointer-events: none; }
    .lv-toggle-group__icon { display: inline-flex; flex-shrink: 0; }
    .lv-toggle-group__icon svg { width: 1rem; height: 1rem; }
  `;

  willUpdate(changed: Map<string, unknown>) {
    if (!this._initialized || changed.has("value")) {
      this._initialized = true;
      const ids = Array.isArray(this.value)
        ? this.value
        : this.value
          ? [this.value]
          : [];
      this._selected = new Set(this.type === "single" ? ids.slice(0, 1) : ids);
    }
  }

  private isSelected(value: string): boolean {
    return this._selected.has(value);
  }

  private get enabledValues(): string[] {
    return this.items.filter((i) => !i.disabled).map((i) => i.value);
  }

  /** The item that should be in the tab order (selected, else first enabled). */
  private get rovingValue(): string {
    const enabled = this.enabledValues;
    const selected = enabled.find((v) => this._selected.has(v));
    return selected ?? enabled[0] ?? "";
  }

  private toggle(value: string) {
    const item = this.items.find((i) => i.value === value);
    if (this.disabled || !item || item.disabled) return;

    const next = new Set(this._selected);
    if (this.type === "single") {
      if (next.has(value)) {
        next.clear(); // single allows deselect to empty (Radix behaviour)
      } else {
        next.clear();
        next.add(value);
      }
    } else if (next.has(value)) {
      next.delete(value);
    } else {
      next.add(value);
    }
    this._selected = next;

    const detail =
      this.type === "single" ? (next.values().next().value ?? "") : Array.from(next);
    this.value = detail;
    this.dispatchEvent(
      new CustomEvent("lv-change", { detail, bubbles: true, composed: true })
    );
  }

  private onKeyDown(e: KeyboardEvent, currentValue: string) {
    const enabled = this.enabledValues;
    if (enabled.length === 0) return;
    const currentIndex = enabled.indexOf(currentValue);

    let targetValue: string | undefined;
    switch (e.key) {
      case "ArrowRight":
      case "ArrowDown":
        e.preventDefault();
        targetValue = enabled[(currentIndex + 1) % enabled.length];
        break;
      case "ArrowLeft":
      case "ArrowUp":
        e.preventDefault();
        targetValue = enabled[(currentIndex - 1 + enabled.length) % enabled.length];
        break;
      case "Home":
        e.preventDefault();
        targetValue = enabled[0];
        break;
      case "End":
        e.preventDefault();
        targetValue = enabled[enabled.length - 1];
        break;
      default:
        return;
    }
    if (targetValue !== undefined) {
      (
        this.querySelector(`[data-value="${targetValue}"]`) as HTMLElement | null
      )?.focus();
    }
  }

  render() {
    const single = this.type === "single";
    const roving = this.rovingValue;
    return html`
      <div
        class="lv-toggle-group"
        role=${single ? "radiogroup" : "group"}
        aria-label=${this.ariaLabel ?? nothing}
      >
        ${this.items.map((item) => {
          const selected = this.isSelected(item.value);
          const itemDisabled = this.disabled || (item.disabled ?? false);
          const body = item.icon ? iconBodies[item.icon] : undefined;
          return html`
            <button
              class="lv-toggle-group__item lv-toggle-group__item--${this.variant} lv-toggle-group__item--${this.size}"
              type="button"
              data-value=${item.value}
              role=${single ? "radio" : nothing}
              aria-checked=${single ? (selected ? "true" : "false") : nothing}
              aria-pressed=${single ? nothing : selected ? "true" : "false"}
              aria-label=${item.label ? nothing : item.value}
              tabindex=${item.value === roving && !itemDisabled ? "0" : "-1"}
              ?disabled=${itemDisabled}
              @click=${() => this.toggle(item.value)}
              @keydown=${(e: KeyboardEvent) => this.onKeyDown(e, item.value)}
            >
              ${body
                ? html`<span class="lv-toggle-group__icon" aria-hidden="true"
                    ><svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      ${unsafeSVG(body)}
                    </svg></span
                  >`
                : nothing}
              ${item.label ? html`<span>${item.label}</span>` : nothing}
            </button>
          `;
        })}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "lv-toggle-group": LvToggleGroup;
  }
}
