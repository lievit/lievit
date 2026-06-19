/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
import { LitElement, html } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { computePosition, flip, shift, offset } from "@floating-ui/dom";
import { adoptLightStyles } from "../light-dom/light-dom.js";

/**
 * A single item in the array-driven (action) mode of `<lv-dropdown-menu>`.
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
 * `<lv-dropdown-menu>`: a keyboard-navigable floating menu with two modes.
 *
 * Implements the WAI-ARIA APG menu-button pattern (trigger `aria-haspopup="menu"`,
 * `aria-expanded`, `aria-controls`; panel `role="menu"`; items `role="menuitem"`;
 * ArrowUp/Down navigate, Enter/Space activate, Escape/Tab close, Home/End jump).
 * Positioned by `@floating-ui/dom` (offset + flip + shift). Light-DOM rendered.
 *
 * TWO MODES, chosen at runtime by what the adopter provides:
 *
 * 1. ACTION mode (array-driven, back-compat): pass `items` (and optionally `label`).
 *    The menu renders `<button role="menuitem">` per item and emits `lv-select` with the
 *    item's `key` on activation. Use for in-place action menus (Edit / Copy / Delete).
 *
 *    <lv-dropdown-menu label="Actions" .items=${[{key:'edit',label:'Edit'}]}></lv-dropdown-menu>
 *
 * 2. SLOTTED-NAV mode (composable, Radix-like): provide the panel content as light-DOM
 *    children, the menu projects them. This is how you build an app nav / user menu with
 *    REAL `<a href>` links (navigable JS-off, middle-click / open-in-new-tab work) plus
 *    dividers, headers and a logout `<form>`. Optionally provide the trigger via
 *    `slot="trigger"`; otherwise `label` renders the default trigger button. When any
 *    non-trigger child is present, slotted-nav mode wins over `items`.
 *
 *    <lv-dropdown-menu label="Ada">
 *      <span slot="trigger">Ada <avatar/></span>
 *      <a href="/profile">Profile</a>
 *      <a href="/settings">Settings</a>
 *      <hr />
 *      <form method="post" action="/logout"><button type="submit">Log out</button></form>
 *    </lv-dropdown-menu>
 *
 *    The projected children become the menuitems: every focusable child (`<a href>`, a
 *    `<button>`, a form's submit button) gets `role="menuitem"` + roving tabindex and is
 *    reachable by ArrowUp/Down/Home/End; Enter/Space activates it (an `<a>` navigates, a
 *    `<button>`/submit clicks). `<hr>` / `[role="separator"]` render as dividers.
 *
 * Why slotted (not a `links` array): rendering real anchors the adopter wrote keeps the
 * links progressive-enhancement-friendly and lets arbitrary content (a logout form, a
 * header) live in the panel, which a fixed data shape cannot express. This mirrors Radix
 * `DropdownMenu.Item asChild` / shadcn `DropdownMenuItem asChild <Link>` and Web Awesome's
 * slotted menu: compose real links, do not re-render them from data. (research: that is the
 * only approach that yields real links AND stays accessible.)
 *
 * Light-DOM slotting: in light DOM a `<slot>` never projects (no shadow root), so the
 * island ADOPTS the adopter's children into the rendered trigger / panel in `firstUpdated`
 * and keeps them in sync with a `MutationObserver`, exactly like `<lv-carousel>`.
 *
 * Owned source, copied in by `lievit add dropdown-menu`. Light-DOM rendered.
 * npm dep: `@floating-ui/dom` (declared in meta.json, installed by `lievit add`).
 */
@customElement("lv-dropdown-menu")
export class LvDropdownMenu extends LitElement {
  /** The menu items to render in ACTION mode. Ignored when content is slotted. */
  @property({ type: Array }) items: DropdownItem[] = [];

  /** Label text for the default trigger button (used unless a `slot="trigger"` is given). */
  @property() label = "Options";

  /** Preferred panel placement (flips automatically when space is tight). */
  @property() placement: "bottom-start" | "bottom-end" | "top-start" | "top-end" =
    "bottom-start";

  /** Disables the trigger. */
  @property({ type: Boolean }) disabled = false;

  @state() private open = false;
  @state() private activeIndex = -1;
  /** True once adopted children carry projectable panel content (slotted-nav mode). */
  @state() private slotted = false;

  private observer: MutationObserver | null = null;

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
    .lv-dropdown__item,
    .lv-dropdown__panel [role="menuitem"] {
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
      text-decoration: none;
    }
    .lv-dropdown__item:hover,
    .lv-dropdown__item--active,
    .lv-dropdown__panel [role="menuitem"]:hover,
    .lv-dropdown__panel [role="menuitem"]:focus-visible,
    .lv-dropdown__panel [role="menuitem"].lv-dropdown__item--active {
      background: var(--lv-color-surface);
      outline: none;
    }
    .lv-dropdown__panel [role="menuitem"]:focus-visible { box-shadow: var(--lv-ring); }
    .lv-dropdown__item[aria-disabled="true"],
    .lv-dropdown__panel [role="menuitem"][aria-disabled="true"] {
      opacity: 0.5; cursor: not-allowed; pointer-events: none;
    }
    .lv-dropdown__item-icon { flex-shrink: 0; }
    .lv-dropdown__separator,
    .lv-dropdown__panel hr {
      height: 1px;
      border: 0;
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
    this.observer?.disconnect();
  }

  firstUpdated() {
    this.adoptSlotted();
    // Keep the projected trigger/panel in sync if the adopter swaps children later.
    this.observer = new MutationObserver(() => this.adoptSlotted());
    this.observer.observe(this, { childList: true });
  }

  /**
   * Move the adopter's light-DOM children into the rendered chrome (light-DOM slotting,
   * the `<lv-carousel>` pattern: a real `<slot>` never projects without a shadow root).
   * A `[slot="trigger"]` child fills the trigger; all other host children become the panel
   * content. Idempotent: children already inside the chrome are left in place. Presence of
   * any non-trigger child flips the component into slotted-nav mode.
   */
  private adoptSlotted() {
    const chrome = this.querySelector(".lv-dropdown");
    const triggerHost = this.querySelector(".lv-dropdown__trigger");
    const chevron = this.querySelector(".lv-dropdown__chevron");
    const panel = this.querySelector(".lv-dropdown__panel");
    if (!chrome || !panel) return;

    // Only the host's own stray children (those not inside the rendered chrome) are the
    // adopter's slotted content. Panel content Lit renders in action mode is NOT slotted.
    const stray = Array.from(this.children).filter(
      (c) => c !== chrome
    ) as HTMLElement[];

    for (const el of stray) {
      el.setAttribute("data-lv-slotted", "");
      if (el.getAttribute("slot") === "trigger") {
        // Land before the chevron span so the adopter's trigger sits left of the caret.
        if (triggerHost && chevron) triggerHost.insertBefore(el, chevron);
        else triggerHost?.appendChild(el);
      } else {
        panel.appendChild(el);
      }
    }

    // Slotted-nav mode is on whenever the panel holds any adopted (non-trigger) child.
    const hasContent = panel.querySelector(":scope > [data-lv-slotted]") != null;
    if (hasContent !== this.slotted) {
      this.slotted = hasContent;
    }
    if (this.slotted) this.tagSlottedItems();
  }

  /** The projected, activatable menu items in slotted-nav mode (real `<a>` / `<button>`). */
  private slottedItems(): HTMLElement[] {
    const panel = this.querySelector(".lv-dropdown__panel");
    if (!panel) return [];
    return Array.from(
      panel.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [role="menuitem"]:not([aria-disabled="true"])'
      )
    );
  }

  /** Apply menu ARIA + roving tabindex to the projected items. */
  private tagSlottedItems() {
    const items = this.slottedItems();
    items.forEach((el, i) => {
      if (!el.hasAttribute("role")) el.setAttribute("role", "menuitem");
      el.tabIndex = this.open && i === this.activeIndex ? 0 : -1;
      el.classList.toggle("lv-dropdown__item--active", this.open && i === this.activeIndex);
    });
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
      if (this.slotted) {
        this.tagSlottedItems();
        this.focusSlottedItem(this.activeIndex);
      } else {
        this.focusItem(this.activeIndex);
      }
    });
  }

  private closeMenu() {
    this.open = false;
    this.activeIndex = -1;
    if (this.slotted) this.tagSlottedItems();
  }

  private focusTrigger() {
    const wrapper = this.querySelector(".lv-dropdown__trigger") as HTMLElement | null;
    if (this.slotted) {
      const slotted = wrapper?.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      (slotted ?? wrapper)?.focus();
      return;
    }
    wrapper?.focus();
  }

  private focusItem(index: number) {
    const items = this.querySelectorAll<HTMLElement>('.lv-dropdown__panel > [role="menuitem"]');
    items[index]?.focus();
  }

  private focusSlottedItem(index: number) {
    this.slottedItems()[index]?.focus();
  }

  private firstEnabledIndex(): number {
    if (this.slotted) return this.slottedItems().length ? 0 : -1;
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

  /** Activate a projected slotted item: an `<a>` navigates, anything else clicks. */
  private activateSlottedItem(index: number) {
    const el = this.slottedItems()[index];
    if (!el) return;
    this.closeMenu();
    el.click();
  }

  private onTriggerKeyDown(e: KeyboardEvent) {
    if (this.disabled) return;
    switch (e.key) {
      case "ArrowDown":
      case "Enter":
      case " ":
      case "ArrowUp":
        e.preventDefault();
        this.openMenu();
        break;
    }
  }

  private onMenuKeyDown(e: KeyboardEvent) {
    const len = this.slotted ? this.slottedItems().length : this.items.length;
    const refocus = () => {
      if (this.slotted) {
        this.tagSlottedItems();
        this.focusSlottedItem(this.activeIndex);
      } else {
        this.focusItem(this.activeIndex);
      }
    };
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        this.moveActive(1);
        refocus();
        break;
      case "ArrowUp":
        e.preventDefault();
        this.moveActive(-1);
        refocus();
        break;
      case "Home":
        e.preventDefault();
        this.activeIndex = this.firstEnabledIndex();
        refocus();
        break;
      case "End":
        e.preventDefault();
        this.activeIndex = this.lastEnabledIndex();
        refocus();
        break;
      case "Enter":
      case " ":
        if (this.slotted) {
          // Let a real anchor handle Enter natively where it is focused; we click it so
          // both <a> (navigate) and <button> (submit) work uniformly, then close.
          e.preventDefault();
          if (this.activeIndex >= 0) this.activateSlottedItem(this.activeIndex);
        } else {
          e.preventDefault();
          if (this.activeIndex >= 0) this.activateItem(this.items[this.activeIndex]);
        }
        break;
      case "Escape":
        e.preventDefault();
        this.closeMenu();
        this.focusTrigger();
        break;
    }
    if (len === 0) return;
  }

  private lastEnabledIndex(): number {
    if (this.slotted) {
      const items = this.slottedItems();
      return items.length - 1;
    }
    for (let i = this.items.length - 1; i >= 0; i--) {
      if (!this.items[i].disabled) return i;
    }
    return -1;
  }

  private moveActive(delta: number) {
    if (this.slotted) {
      const len = this.slottedItems().length;
      if (len === 0) return;
      let idx = this.activeIndex + delta;
      if (idx < 0) idx = 0;
      if (idx > len - 1) idx = len - 1;
      this.activeIndex = idx;
      return;
    }
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
          <span class="lv-dropdown__trigger-slot">${this.slotted ? "" : this.label}</span>
          <span class="lv-dropdown__chevron ${this.open ? "lv-dropdown__chevron--open" : ""}"
            aria-hidden="true">▼</span>
        </button>

        <div
          class="lv-dropdown__panel ${this.open ? "lv-dropdown__panel--open" : ""}"
          id=${this.menuId}
          role="menu"
          @keydown=${this.onMenuKeyDown}
        >
          ${this.slotted
            ? null
            : this.items.map((item, i) => html`
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
