/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
import { LitElement, html } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { adoptLightStyles } from "../light-dom/light-dom.js";

/**
 * Accordion item definition for `<lv-accordion>`.
 */
export interface AccordionItem {
  /** Unique identifier. */
  id: string;
  /** Header / trigger label. */
  label: string;
  /** Whether this item starts expanded (only respected when `type` is `"single"` and no `value` is set). */
  defaultOpen?: boolean;
}

/**
 * `<lv-accordion>`: a collapsible disclosure group.
 *
 * Follows WAI-ARIA APG disclosure pattern applied to an accordion (research 4.3):
 * - Each header is a `<button>` with `aria-expanded="true|false"` and
 *   `aria-controls` pointing at the content region.
 * - The content region has an `id` matched by `aria-controls` and is removed from
 *   the tab order (hidden via `hidden` attribute) when collapsed.
 * - `type="single"` (default): only one item is open at a time.
 * - `type="multiple"`: any number of items can be open simultaneously.
 * - Arrow Up/Down move focus between the header buttons (WAI-ARIA APG accordion keyboard,
 *   research 4.3); Home/End jump to first/last.
 *
 * Data down, events up: emits `lv-change` with `{ id, open }` on each toggle.
 * `value` (string for single, string[] for multiple) sets the initial open set.
 *
 * Panel content is projected via named slots: `<div slot="content-{id}">...</div>`.
 *
 * Owned source, copied in by `lievit add accordion`. Light-DOM rendered.
 */
@customElement("lv-accordion")
export class LvAccordion extends LitElement {
  /** Accordion item definitions. */
  @property({ type: Array }) items: AccordionItem[] = [];

  /** `"single"` allows only one open at a time; `"multiple"` allows many. */
  @property() type: "single" | "multiple" = "single";

  /**
   * Controlled open set. For `type="single"` pass the open item id (string).
   * For `type="multiple"` pass an array of open ids.
   */
  @property({ attribute: false }) value: string | string[] = "";

  @state() private _open: Set<string> = new Set();

  private _initialized = false;

  createRenderRoot(): this {
    adoptLightStyles("lv-accordion", LvAccordion.css);
    return this;
  }

  static readonly css = `
    .lv-accordion { display: block; border: 1px solid var(--lv-color-border); border-radius: var(--lv-radius-md); overflow: hidden; }
    .lv-accordion__item { border-bottom: 1px solid var(--lv-color-border); }
    .lv-accordion__item:last-child { border-bottom: 0; }
    .lv-accordion__trigger {
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 100%;
      padding: var(--lv-space-4);
      background: var(--lv-color-bg);
      border: 0;
      cursor: pointer;
      font-family: var(--lv-font-sans);
      font-size: var(--lv-text-base);
      font-weight: 500;
      color: var(--lv-color-fg);
      text-align: left;
      gap: var(--lv-space-3);
    }
    .lv-accordion__trigger:hover { background: var(--lv-color-surface); }
    .lv-accordion__trigger:focus-visible { outline: none; box-shadow: var(--lv-ring); }
    .lv-accordion__icon {
      color: var(--lv-color-muted);
      font-size: var(--lv-text-sm);
      transition: transform 0.2s;
      flex-shrink: 0;
    }
    .lv-accordion__icon--open { transform: rotate(180deg); }
    .lv-accordion__panel {
      font-family: var(--lv-font-sans);
      font-size: var(--lv-text-base);
      color: var(--lv-color-fg);
      line-height: var(--lv-leading);
      padding: 0 var(--lv-space-4) var(--lv-space-4);
    }
    .lv-accordion__panel[hidden] { display: none; }
  `;

  willUpdate(changed: Map<string, unknown>) {
    if (!this._initialized) {
      this._initialized = true;
      // Seed from `value` prop if set, else from defaultOpen
      if (this.value && (typeof this.value === "string" ? this.value : this.value.length > 0)) {
        const ids = Array.isArray(this.value) ? this.value : [this.value];
        this._open = new Set(this.type === "single" ? [ids[0]] : ids);
      } else {
        const defaultIds = this.items.filter((i) => i.defaultOpen).map((i) => i.id);
        this._open = new Set(this.type === "single" ? defaultIds.slice(0, 1) : defaultIds);
      }
    } else if (changed.has("value")) {
      const ids = Array.isArray(this.value) ? this.value : (this.value ? [this.value] : []);
      this._open = new Set(this.type === "single" ? ids.slice(0, 1) : ids);
    }
  }

  private toggle(id: string) {
    const isOpen = this._open.has(id);
    const next = new Set(this._open);
    if (isOpen) {
      next.delete(id);
    } else {
      if (this.type === "single") next.clear();
      next.add(id);
    }
    this._open = next;
    this.dispatchEvent(
      new CustomEvent("lv-change", {
        detail: { id, open: !isOpen },
        bubbles: true,
        composed: true,
      })
    );
  }

  private onKeyDown(e: KeyboardEvent, index: number) {
    const buttons = Array.from(
      this.querySelectorAll<HTMLButtonElement>(".lv-accordion__trigger")
    );
    let target: HTMLButtonElement | undefined;
    if (e.key === "ArrowDown") { e.preventDefault(); target = buttons[(index + 1) % buttons.length]; }
    else if (e.key === "ArrowUp") { e.preventDefault(); target = buttons[(index - 1 + buttons.length) % buttons.length]; }
    else if (e.key === "Home") { e.preventDefault(); target = buttons[0]; }
    else if (e.key === "End") { e.preventDefault(); target = buttons[buttons.length - 1]; }
    target?.focus();
  }

  render() {
    return html`
      <div class="lv-accordion">
        ${this.items.map((item, i) => {
          const isOpen = this._open.has(item.id);
          const triggerId = `lv-acc-trigger-${item.id}`;
          const panelId = `lv-acc-panel-${item.id}`;
          return html`
            <div class="lv-accordion__item">
              <button
                class="lv-accordion__trigger"
                id=${triggerId}
                type="button"
                aria-expanded=${isOpen ? "true" : "false"}
                aria-controls=${panelId}
                @click=${() => this.toggle(item.id)}
                @keydown=${(e: KeyboardEvent) => this.onKeyDown(e, i)}
              >
                <span>${item.label}</span>
                <span class="lv-accordion__icon ${isOpen ? "lv-accordion__icon--open" : ""}" aria-hidden="true">&#x25BE;</span>
              </button>
              <div
                class="lv-accordion__panel"
                id=${panelId}
                role="region"
                aria-labelledby=${triggerId}
                ?hidden=${!isOpen}
              >
                <slot name=${"content-" + item.id}></slot>
              </div>
            </div>
          `;
        })}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "lv-accordion": LvAccordion;
  }
}
