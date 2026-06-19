/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
import { LitElement, html, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { unsafeSVG } from "lit/directives/unsafe-svg.js";
import { adoptLightStyles } from "../light-dom/light-dom.js";
import { iconBodies } from "../../icons/icon-bodies.js";

/**
 * `<lv-toggle>`: a two-state pressed button (Radix Toggle / shadcn toggle).
 *
 * A native `<button>` carrying `aria-pressed="true|false"` is the WAI-ARIA toggle-button
 * pattern (Radix is the a11y source): the button role + Enter/Space activation come for
 * free from the native element, and `aria-pressed` announces the on/off state to screen
 * readers. No manual key handler is needed.
 *
 * Variants + sizes mirror the shadcn toggle (`default`/`outline`, `sm`/`default`/`lg`),
 * styled by the `--lv-*` tokens; the focus ring is `--lv-ring`. An optional Lucide icon
 * (from the vendored `iconBodies` map) renders before the slotted label; never Font Awesome.
 *
 * Data down, events up: `pressed` is the controlled state; emits a bubbling `lv-change`
 * with the new `pressed` boolean on each toggle. Inside an `<lv-toggle-group>` the group
 * owns `pressed` and listens for the same event (data down, events up).
 *
 * Owned source, copied in by `lievit add toggle`. Light-DOM rendered.
 */
@customElement("lv-toggle")
export class LvToggle extends LitElement {
  /** Whether the toggle is pressed (on). */
  @property({ type: Boolean, reflect: true }) pressed = false;

  /** Disables the control: blocks activation and dims it. */
  @property({ type: Boolean }) disabled = false;

  /** Visual style. `default` is a ghost button; `outline` adds a border. */
  @property() variant: "default" | "outline" = "default";

  /** Control size. */
  @property() size: "sm" | "default" | "lg" = "default";

  /** Optional Lucide icon name (from the vendored sprite) rendered before the label. */
  @property() icon = "";

  /** Accessible label when the toggle has only an icon (no text). */
  @property({ attribute: "aria-label" }) ariaLabel: string | null = null;

  /**
   * Value identifying this toggle inside an `<lv-toggle-group>`. Optional standalone.
   */
  @property() value = "";

  createRenderRoot(): this {
    adoptLightStyles("lv-toggle", LvToggle.css);
    return this;
  }

  static readonly css = `
    lv-toggle { display: inline-flex; }
    .lv-toggle {
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
    .lv-toggle--sm { height: 2rem; min-width: 2rem; padding: 0 var(--lv-space-2); }
    .lv-toggle--default { height: 2.25rem; min-width: 2.25rem; padding: 0 var(--lv-space-3); }
    .lv-toggle--lg { height: 2.5rem; min-width: 2.5rem; padding: 0 var(--lv-space-4); }
    .lv-toggle--outline { border-color: var(--lv-color-border); }
    .lv-toggle:hover { background: var(--lv-color-surface); color: var(--lv-color-fg); }
    .lv-toggle:focus-visible { outline: none; box-shadow: var(--lv-ring); }
    .lv-toggle[aria-pressed="true"] {
      background: var(--lv-color-muted-bg);
      color: var(--lv-color-fg);
    }
    .lv-toggle[disabled] { opacity: 0.5; cursor: not-allowed; pointer-events: none; }
    .lv-toggle__icon { display: inline-flex; flex-shrink: 0; }
    .lv-toggle__icon svg { width: 1rem; height: 1rem; }
  `;

  private toggle() {
    if (this.disabled) return;
    this.pressed = !this.pressed;
    this.dispatchEvent(
      new CustomEvent("lv-change", {
        detail: { pressed: this.pressed, value: this.value },
        bubbles: true,
        composed: true,
      })
    );
  }

  render() {
    const body = this.icon ? iconBodies[this.icon] : undefined;
    return html`
      <button
        class="lv-toggle lv-toggle--${this.variant} lv-toggle--${this.size}"
        type="button"
        aria-pressed=${this.pressed ? "true" : "false"}
        aria-label=${this.ariaLabel ?? nothing}
        ?disabled=${this.disabled}
        @click=${this.toggle}
      >
        ${body
          ? html`<span class="lv-toggle__icon" aria-hidden="true"
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
        <slot></slot>
      </button>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "lv-toggle": LvToggle;
  }
}
