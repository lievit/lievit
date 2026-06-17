/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
import { LitElement, html } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { computePosition, flip, shift, offset } from "@floating-ui/dom";
import { adoptLightStyles } from "../light-dom/light-dom.js";

/**
 * A single item in a `<lv-dropdown-menu>`.
 */
export interface DropdownItem {
  /** Unique key emitted in the `lv-select` event. */
  key: string;
  /** Display label. */
  label: string;
  /** Icon text or HTML entity prepended to the label (optional). */
  icon?: string;
  /** Prevents selection and dims the item. */
  disabled?: boolean;
  /** Renders a separator above this item. */
  separator?: boolean;
}

/**
 * `<lv-dropdown-menu>`: a keyboard-navigable floating action menu.
 *
 * Implements the WAI-ARIA APG menu-button pattern (research 4.3):
 * - Trigger: `aria-haspopup="menu"`, `aria-expanded`, `aria-controls`.
 * - Panel: `role="menu"`.
 * - Items: `role="menuitem"`, `aria-disabled`.
 * - Keyboard: ArrowUp/Down navigate; Enter/Space activate; Escape/Tab close;
 *   Home/End jump to first/last.
 *
 * Positioned by `@floating-ui/dom` (flip + shift so it stays in-viewport).
 * Data down, events up: emits `lv-select` with the item's key on activation.
 *
 * Owned source, copied in by `lievit add dropdown-menu`. Light-DOM rendered.
 * npm dep: `@floating-ui/dom` (declared in meta.json, installed by `lievit add`).
 */
@customElement("lv-dropdown-menu")
export class LvDropdownMenu extends LitElement {
  /** The menu items to render. */
  @property({ type: Array }) items: DropdownItem[] = [];

  /** Label text for the trigger button. */
  @property() label = "Options";

  /** Preferred panel placement (flips automatically when space is tight). */
  @property() placement: "bottom-start" | "bottom-end" | "top-start" | "top-end" =
    "bottom-start";

  /** Disables the trigger. */
  @property({ type: Boolean }) disabled = false;

  @state() private open = false;
  @state() private activeIndex = -1;

  private static seq = 0;
  private readonly menuId = `lv-dropdown-menu-${LvDropdownMenu.seq++}`;

  createRenderRoot(): this {
    adoptLightStyles("lv-dropdown-menu", LvDropdownMenu.css);
    return this;
  }

  static readonly css = `
    .lv-dropdown { position: relative; display: inline-block; }
    .lv-dropdown__trigger {
      display: inline-flex;
      align-items: center;
      gap: var(--lv-space-1);
      font-family: var(--lv-font-sans);
      font-size: var(--lv-text-sm);
      color: var(--lv-color-fg);
      background: var(--lv-color-bg);
      padding: var(--lv-space-2) var(--lv-space-3);
      border: 1px solid var(--lv-color-border);
      border-radius: var(--lv-radius-md);
      cursor: pointer;
    }
    .lv-dropdown__trigger:focus-visible { outline: none; box-shadow: var(--lv-ring); }
    .lv-dropdown__trigger[disabled] { opacity: 0.5; cursor: not-allowed; }
    .lv-dropdown__chevron {
      font-size: 0.6em;
      transition: transform 150ms ease;
    }
    .lv-dropdown__chevron--open { transform: rotate(180deg); }
    .lv-dropdown__panel {
      position: fixed;
      z-index: 9300;
      min-width: 10rem;
      background: var(--lv-color-bg);
      border: 1px solid var(--lv-color-border);
      border-radius: var(--lv-radius-md);
      box-shadow: var(--lv-shadow-md);
      padding: var(--lv-space-1) 0;
      display: none;
    }
    .lv-dropdown__panel--open { display: block; }
    .lv-dropdown__item {
      display: flex;
      align-items: center;
      gap: var(--lv-space-2);
      width: 100%;
      font-family: var(--lv-font-sans);
      font-size: var(--lv-text-sm);
      color: var(--lv-color-fg);
      background: transparent;
      border: 0;
      padding: var(--lv-space-2) var(--lv-space-3);
      cursor: pointer;
      text-align: left;
      box-sizing: border-box;
    }
    .lv-dropdown__item:hover,
    .lv-dropdown__item--active { background: var(--lv-color-surface); }
    .lv-dropdown__item[aria-disabled="true"] { opacity: 0.5; cursor: not-allowed; pointer-events: none; }
    .lv-dropdown__item-icon { flex-shrink: 0; }
    .lv-dropdown__separator {
      height: 1px;
      background: var(--lv-color-border);
      margin: var(--lv-space-1) 0;
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
      this.closeMenu();
    }
  };

  private handleGlobalKey = (e: KeyboardEvent) => {
    if (!this.open) return;
    if (e.key === "Escape" || e.key === "Tab") {
      e.preventDefault();
      this.closeMenu();
      this.focusTrigger();
    }
  };

  private openMenu() {
    if (this.disabled) return;
    this.activeIndex = this.firstEnabledIndex();
    this.open = true;
    this.updateComplete.then(() => {
      this.position();
      this.focusItem(this.activeIndex);
    });
  }

  private closeMenu() {
    this.open = false;
    this.activeIndex = -1;
  }

  private focusTrigger() {
    (this.querySelector(".lv-dropdown__trigger") as HTMLElement | null)?.focus();
  }

  private focusItem(index: number) {
    const items = this.querySelectorAll<HTMLElement>('[role="menuitem"]');
    items[index]?.focus();
  }

  private firstEnabledIndex(): number {
    return this.items.findIndex((it) => !it.disabled);
  }

  private async position() {
    const trigger = this.querySelector(".lv-dropdown__trigger") as HTMLElement | null;
    const panel = this.querySelector(".lv-dropdown__panel") as HTMLElement | null;
    if (!trigger || !panel) return;

    const { x, y } = await computePosition(trigger, panel, {
      placement: this.placement,
      middleware: [offset(4), flip(), shift({ padding: 4 })],
    });
    panel.style.left = `${x}px`;
    panel.style.top = `${y}px`;
  }

  private activateItem(item: DropdownItem) {
    if (item.disabled) return;
    this.dispatchEvent(
      new CustomEvent("lv-select", { detail: item.key, bubbles: true, composed: true })
    );
    this.closeMenu();
    this.focusTrigger();
  }

  private onTriggerKeyDown(e: KeyboardEvent) {
    if (this.disabled) return;
    switch (e.key) {
      case "ArrowDown":
      case "Enter":
      case " ":
        e.preventDefault();
        this.openMenu();
        break;
      case "ArrowUp":
        e.preventDefault();
        this.openMenu();
        break;
    }
  }

  private onMenuKeyDown(e: KeyboardEvent) {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        this.moveActive(1);
        this.focusItem(this.activeIndex);
        break;
      case "ArrowUp":
        e.preventDefault();
        this.moveActive(-1);
        this.focusItem(this.activeIndex);
        break;
      case "Home":
        e.preventDefault();
        this.activeIndex = this.firstEnabledIndex();
        this.focusItem(this.activeIndex);
        break;
      case "End":
        e.preventDefault();
        this.activeIndex = this.lastEnabledIndex();
        this.focusItem(this.activeIndex);
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        if (this.activeIndex >= 0) this.activateItem(this.items[this.activeIndex]);
        break;
    }
  }

  private lastEnabledIndex(): number {
    for (let i = this.items.length - 1; i >= 0; i--) {
      if (!this.items[i].disabled) return i;
    }
    return -1;
  }

  private moveActive(delta: number) {
    const len = this.items.length;
    if (len === 0) return;
    let idx = this.activeIndex + delta;
    while (idx >= 0 && idx < len && this.items[idx].disabled) {
      idx += delta;
    }
    if (idx >= 0 && idx < len) {
      this.activeIndex = idx;
    }
  }

  render() {
    return html`
      <div class="lv-dropdown">
        <button
          class="lv-dropdown__trigger"
          type="button"
          aria-haspopup="menu"
          aria-expanded=${this.open ? "true" : "false"}
          aria-controls=${this.menuId}
          ?disabled=${this.disabled}
          @click=${() => (this.open ? this.closeMenu() : this.openMenu())}
          @keydown=${this.onTriggerKeyDown}
        >
          ${this.label}
          <span class="lv-dropdown__chevron ${this.open ? "lv-dropdown__chevron--open" : ""}"
            aria-hidden="true">▼</span>
        </button>

        <div
          class="lv-dropdown__panel ${this.open ? "lv-dropdown__panel--open" : ""}"
          id=${this.menuId}
          role="menu"
          @keydown=${this.onMenuKeyDown}
        >
          ${this.items.map((item, i) => html`
            ${item.separator ? html`<div class="lv-dropdown__separator" role="separator"></div>` : null}
            <button
              class="lv-dropdown__item ${i === this.activeIndex ? "lv-dropdown__item--active" : ""}"
              role="menuitem"
              type="button"
              aria-disabled=${item.disabled ? "true" : "false"}
              tabindex=${this.open ? "0" : "-1"}
              @click=${() => this.activateItem(item)}
              @mouseenter=${() => { if (!item.disabled) this.activeIndex = i; }}
            >
              ${item.icon ? html`<span class="lv-dropdown__item-icon" aria-hidden="true">${item.icon}</span>` : null}
              ${item.label}
            </button>
          `)}
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "lv-dropdown-menu": LvDropdownMenu;
  }
}
