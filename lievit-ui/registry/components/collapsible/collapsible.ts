/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
import { LitElement, html } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { unsafeSVG } from "lit/directives/unsafe-svg.js";
import { adoptLightStyles } from "../light-dom/light-dom.js";
import { iconBodies } from "../../icons/icon-bodies.js";

/**
 * `<lv-collapsible>`: a single trigger that expands/collapses one content region.
 *
 * Follows the WAI-ARIA APG disclosure pattern (Radix Collapsible is the a11y source):
 * - The trigger is a `<button>` carrying `aria-expanded="true|false"` and `aria-controls`
 *   pointing at the content region's `id`.
 * - The content region has the matching `id` and is removed from the tab order + a11y tree
 *   (the `hidden` attribute) when collapsed, so collapsed content is not reachable.
 * - Enter / Space activate the trigger; native `<button>` carries this for free, so no
 *   manual key handler is needed (least-surprise, matches Radix which keeps the trigger a button).
 *
 * The height animation is CSS grid-rows 0fr -> 1fr driven by the motion tokens; this animates
 * an auto height without measuring the DOM (the Radix CSS-var approach without JS measurement).
 *
 * Data down, events up: `open` is the controlled state; emits a bubbling `lv-change` with
 * the new `open` boolean on each toggle. The chevron icon comes from the vendored Lucide
 * map (`iconBodies`), never Font Awesome.
 *
 * Trigger label is the `label` prop; the panel body is projected via the default slot.
 * Owned source, copied in by `lievit add collapsible`. Light-DOM rendered.
 */
@customElement("lv-collapsible")
export class LvCollapsible extends LitElement {
  /** Trigger label text. */
  @property() label = "";

  /** Controlled open state. */
  @property({ type: Boolean }) open = false;

  /** Disables the trigger: blocks toggle and dims it. */
  @property({ type: Boolean }) disabled = false;

  /** Hides the default chevron icon when `true` (e.g. a custom trigger via the `trigger` slot). */
  @property({ type: Boolean, attribute: "no-icon" }) noIcon = false;

  @state() private _id = `lv-collapsible-${(LvCollapsible._seq += 1)}`;

  private static _seq = 0;

  createRenderRoot(): this {
    adoptLightStyles("lv-collapsible", LvCollapsible.css);
    return this;
  }

  static readonly css = `
    .lv-collapsible { display: block; font-family: var(--lv-font-sans); }
    .lv-collapsible__trigger {
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 100%;
      gap: var(--lv-space-3);
      padding: var(--lv-space-2) var(--lv-space-3);
      background: var(--lv-color-bg);
      border: 1px solid var(--lv-color-border);
      border-radius: var(--lv-radius-md);
      cursor: pointer;
      font-family: var(--lv-font-sans);
      font-size: var(--lv-text-sm);
      font-weight: 500;
      color: var(--lv-color-fg);
      text-align: left;
    }
    .lv-collapsible__trigger:hover { background: var(--lv-color-surface); }
    .lv-collapsible__trigger:focus-visible { outline: none; box-shadow: var(--lv-ring); }
    .lv-collapsible__trigger[disabled] { opacity: 0.5; cursor: not-allowed; }
    .lv-collapsible__icon {
      color: var(--lv-color-muted);
      flex-shrink: 0;
      display: inline-flex;
      transition: transform 0.2s ease;
    }
    .lv-collapsible__icon svg { width: 1rem; height: 1rem; }
    .lv-collapsible__icon--open { transform: rotate(180deg); }
    .lv-collapsible__region {
      display: grid;
      grid-template-rows: 0fr;
      transition: grid-template-rows 0.2s ease;
    }
    .lv-collapsible__region--open { grid-template-rows: 1fr; }
    .lv-collapsible__panel { overflow: hidden; }
    .lv-collapsible__panel-inner {
      padding: var(--lv-space-3);
      font-size: var(--lv-text-base);
      color: var(--lv-color-fg);
      line-height: var(--lv-leading);
    }
  `;

  private toggle() {
    if (this.disabled) return;
    this.open = !this.open;
    this.dispatchEvent(
      new CustomEvent("lv-change", { detail: this.open, bubbles: true, composed: true })
    );
  }

  render() {
    const triggerId = `${this._id}-trigger`;
    const panelId = `${this._id}-panel`;
    const chevron = iconBodies["chevron-down"] ?? "";
    return html`
      <div class="lv-collapsible">
        <button
          class="lv-collapsible__trigger"
          id=${triggerId}
          type="button"
          aria-expanded=${this.open ? "true" : "false"}
          aria-controls=${panelId}
          ?disabled=${this.disabled}
          @click=${this.toggle}
        >
          <span><slot name="trigger">${this.label}</slot></span>
          ${this.noIcon
            ? null
            : html`<span
                class="lv-collapsible__icon ${this.open ? "lv-collapsible__icon--open" : ""}"
                aria-hidden="true"
                ><svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  ${unsafeSVG(chevron)}
                </svg></span
              >`}
        </button>
        <div class="lv-collapsible__region ${this.open ? "lv-collapsible__region--open" : ""}">
          <div
            class="lv-collapsible__panel"
            id=${panelId}
            role="region"
            aria-labelledby=${triggerId}
            ?hidden=${!this.open}
          >
            <div class="lv-collapsible__panel-inner"><slot></slot></div>
          </div>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "lv-collapsible": LvCollapsible;
  }
}
