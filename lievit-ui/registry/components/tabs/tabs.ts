/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
import { LitElement, html } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { adoptLightStyles } from "../light-dom/light-dom.js";

/**
 * Tab definition for `<lv-tabs>`.
 */
export interface TabItem {
  /** Unique identifier for this tab; used as the `value` of the active tab. */
  id: string;
  /** Visible tab label. */
  label: string;
  /** Disables the tab. */
  disabled?: boolean;
}

/**
 * `<lv-tabs>`: a keyboard-navigable tab bar with associated panels.
 *
 * Follows the WAI-ARIA APG tabs pattern (research 4.3):
 * - `role="tablist"` on the tab bar; `role="tab"` per tab with `aria-selected` and
 *   `aria-controls` pointing at the corresponding `role="tabpanel"`.
 * - Roving `tabindex`: the active tab is `tabindex="0"`, all others `-1`.
 * - Arrow keys (Left/Right in horizontal) move focus and activate the tab.
 * - Home/End jump to first/last tab.
 * - Disabled tabs are skipped by arrow-key navigation.
 *
 * Panels are projected via named slots: `<div slot="panel-{id}">...</div>`.
 * Only the active panel is visible (the slot node is always in the DOM; the
 * containing div is hidden via `hidden` attribute for assistive tech).
 *
 * Data down, events up: emits `lv-change` with the new active tab id on switch.
 * `value` prop sets the initial/controlled active tab (defaults to first tab id).
 *
 * Owned source, copied in by `lievit add tabs`. Light-DOM rendered.
 */
@customElement("lv-tabs")
export class LvTabs extends LitElement {
  /** Tab definitions. */
  @property({ type: Array }) tabs: TabItem[] = [];

  /** Active tab id; if empty, defaults to the first non-disabled tab. */
  @property() value = "";

  @state() private _active = "";

  createRenderRoot(): this {
    adoptLightStyles("lv-tabs", LvTabs.css);
    return this;
  }

  static readonly css = `
    .lv-tabs { display: block; font-family: var(--lv-font-sans); }
    .lv-tablist {
      display: flex;
      gap: 0;
      border-bottom: 2px solid var(--lv-color-border);
      overflow-x: auto;
    }
    .lv-tab {
      padding: var(--lv-space-2) var(--lv-space-4);
      font-family: var(--lv-font-sans);
      font-size: var(--lv-text-sm);
      font-weight: 500;
      color: var(--lv-color-muted);
      background: transparent;
      border: 0;
      border-bottom: 2px solid transparent;
      margin-bottom: -2px;
      cursor: pointer;
      white-space: nowrap;
      transition: color 0.15s, border-color 0.15s;
    }
    .lv-tab:focus-visible { outline: none; box-shadow: var(--lv-ring); }
    .lv-tab[aria-selected="true"] {
      color: var(--lv-color-primary);
      border-bottom-color: var(--lv-color-primary);
    }
    .lv-tab[disabled] { opacity: 0.45; cursor: not-allowed; }
    .lv-tab:not([disabled]):hover { color: var(--lv-color-fg); }
    .lv-tabpanel {
      padding: var(--lv-space-4) 0;
      font-size: var(--lv-text-base);
      color: var(--lv-color-fg);
      line-height: var(--lv-leading);
    }
    .lv-tabpanel[hidden] { display: none; }
  `;

  private get activeId(): string {
    if (this._active) return this._active;
    if (this.value) return this.value;
    return this.tabs.find((t) => !t.disabled)?.id ?? "";
  }

  private activate(id: string) {
    const tab = this.tabs.find((t) => t.id === id);
    if (!tab || tab.disabled) return;
    this._active = id;
    this.dispatchEvent(new CustomEvent("lv-change", { detail: id, bubbles: true, composed: true }));
  }

  private onKeyDown(e: KeyboardEvent, currentIndex: number) {
    const enabled = this.tabs.filter((t) => !t.disabled);
    const currentEnabledIndex = enabled.findIndex((t) => t.id === this.tabs[currentIndex]?.id);

    let targetId: string | undefined;

    switch (e.key) {
      case "ArrowRight":
      case "ArrowDown":
        e.preventDefault();
        targetId = enabled[(currentEnabledIndex + 1) % enabled.length]?.id;
        break;
      case "ArrowLeft":
      case "ArrowUp":
        e.preventDefault();
        targetId = enabled[(currentEnabledIndex - 1 + enabled.length) % enabled.length]?.id;
        break;
      case "Home":
        e.preventDefault();
        targetId = enabled[0]?.id;
        break;
      case "End":
        e.preventDefault();
        targetId = enabled[enabled.length - 1]?.id;
        break;
      default:
        return;
    }

    if (targetId) {
      this.activate(targetId);
      this.updateComplete.then(() => {
        (this.querySelector(`[data-tab-id="${targetId}"]`) as HTMLElement | null)?.focus();
      });
    }
  }

  render() {
    const active = this.activeId;
    return html`
      <div class="lv-tabs">
        <div class="lv-tablist" role="tablist">
          ${this.tabs.map((tab, i) => {
            const isSelected = tab.id === active;
            const panelId = `lv-tabpanel-${tab.id}`;
            const tabId = `lv-tab-${tab.id}`;
            return html`
              <button
                class="lv-tab"
                role="tab"
                id=${tabId}
                data-tab-id=${tab.id}
                aria-selected=${isSelected ? "true" : "false"}
                aria-controls=${panelId}
                tabindex=${isSelected ? "0" : "-1"}
                ?disabled=${tab.disabled ?? false}
                @click=${() => this.activate(tab.id)}
                @keydown=${(e: KeyboardEvent) => this.onKeyDown(e, i)}
              >${tab.label}</button>
            `;
          })}
        </div>

        ${this.tabs.map((tab) => {
          const isSelected = tab.id === active;
          const panelId = `lv-tabpanel-${tab.id}`;
          const tabId = `lv-tab-${tab.id}`;
          return html`
            <div
              class="lv-tabpanel"
              id=${panelId}
              role="tabpanel"
              aria-labelledby=${tabId}
              tabindex="0"
              ?hidden=${!isSelected}
            >
              <slot name=${"panel-" + tab.id}></slot>
            </div>
          `;
        })}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "lv-tabs": LvTabs;
  }
}
