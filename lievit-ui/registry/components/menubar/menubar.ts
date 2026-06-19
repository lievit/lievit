/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
import { LitElement, html, nothing, type TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { unsafeSVG } from "lit/directives/unsafe-svg.js";
import { computePosition, flip, shift, offset } from "@floating-ui/dom";
import { adoptLightStyles } from "../light-dom/light-dom.js";
import { iconBody } from "../../icons/icon-bodies.js";

/**
 * An entry inside one menubar menu (or a submenu within it).
 *
 * `type` discriminates the role, mirroring `<lv-context-menu>`:
 * - `item` (default): `role="menuitem"`, emits `lv-select` on activation.
 * - `checkbox` / `radio`: `role="menuitemcheckbox|menuitemradio"`, toggles `checked`.
 * - `separator`: a divider.
 * - `submenu`: opens a nested menu of `children` to its side.
 */
export interface MenubarItem {
  key?: string;
  label?: string;
  icon?: string;
  shortcut?: string;
  disabled?: boolean;
  type?: "item" | "checkbox" | "radio" | "separator" | "submenu";
  checked?: boolean;
  radioGroup?: string;
  children?: MenubarItem[];
}

/** One top-level menu of the menubar (File, Edit, View, ...). */
export interface MenubarMenu {
  /** Unique key for the menu (used in events / open tracking). */
  key: string;
  /** The trigger label shown in the bar. */
  label: string;
  /** Disables the whole menu trigger. */
  disabled?: boolean;
  /** The entries shown when the menu opens. */
  items: MenubarItem[];
}

/**
 * `<lv-menubar>`: a horizontal application menubar (File / Edit / View / ...).
 *
 * Implements the WAI-ARIA APG menubar pattern matched to Radix `Menubar`:
 * - Bar: `role="menubar"`. Triggers: `role="menuitem"`, `aria-haspopup="menu"`,
 *   `aria-expanded`, roving tabindex (exactly one trigger is tabbable).
 * - ArrowLeft/ArrowRight move between triggers (wrapping); ArrowDown (or Enter/Space)
 *   opens the focused menu on its first item; Home/End jump to first/last trigger.
 * - Only one menu is open at a time. Once a menu is open, moving Left/Right closes it and
 *   opens the adjacent menu (the classic menubar "slide"). ArrowDown/Up navigate items,
 *   ArrowRight/Enter opens a submenu, ArrowLeft closes a submenu (or moves to the previous
 *   bar menu at top level), Escape closes back to the trigger, printable keys do typeahead.
 *
 * Each open menu is positioned by `@floating-ui/dom` (flip + shift). Data down, events up:
 * emits `lv-select` ({ menu, key }) and `lv-checked-change` ({ menu, key, checked }).
 *
 * Owned source, copied in by `lievit add menubar`. Light-DOM rendered.
 */
@customElement("lv-menubar")
export class LvMenubar extends LitElement {
  /** The top-level menus shown in the bar. */
  @property({ type: Array }) menus: MenubarMenu[] = [];

  /** Index of the trigger that is roving-tabbable / focused. */
  @state() private focusedMenu = 0;
  /** Index of the currently open menu, or -1 when the bar is idle. */
  @state() private openMenu = -1;
  /** Open submenu path within the open menu (indices into items/children). */
  @state() private openPath: number[] = [];
  /** Active item path within the open menu (last element is focused). */
  @state() private activePath: number[] = [];

  private typeahead = "";
  private typeaheadTimer = 0;

  private static seq = 0;
  private readonly baseId = `lv-menubar-${LvMenubar.seq++}`;

  createRenderRoot(): this {
    adoptLightStyles("lv-menubar", LvMenubar.css);
    return this;
  }

  static readonly css = `
    .lv-menubar {
      display: inline-flex;
      align-items: center;
      gap: var(--lv-space-1);
      background: var(--lv-color-bg);
      border: 1px solid var(--lv-color-border);
      border-radius: var(--lv-radius-md);
      padding: var(--lv-space-1);
      font-family: var(--lv-font-sans);
      font-size: var(--lv-text-sm);
    }
    .lv-menubar__trigger {
      display: inline-flex;
      align-items: center;
      color: var(--lv-color-fg);
      background: transparent;
      border: 0;
      border-radius: var(--lv-radius-sm, var(--lv-radius-md));
      padding: var(--lv-space-1) var(--lv-space-3);
      cursor: pointer;
      font: inherit;
    }
    .lv-menubar__trigger:hover,
    .lv-menubar__trigger[aria-expanded="true"] { background: var(--lv-color-surface); }
    .lv-menubar__trigger:focus-visible { outline: none; box-shadow: var(--lv-ring); }
    .lv-menubar__trigger[aria-disabled="true"] { opacity: 0.5; cursor: not-allowed; }
    .lv-menubar__panel {
      position: fixed;
      z-index: 9300;
      min-width: 12rem;
      background: var(--lv-color-bg);
      border: 1px solid var(--lv-color-border);
      border-radius: var(--lv-radius-md);
      box-shadow: var(--lv-shadow-md);
      padding: var(--lv-space-1) 0;
    }
    .lv-menubar__item {
      display: flex;
      align-items: center;
      gap: var(--lv-space-2);
      width: 100%;
      color: var(--lv-color-fg);
      background: transparent;
      border: 0;
      padding: var(--lv-space-2) var(--lv-space-3);
      cursor: pointer;
      text-align: left;
      box-sizing: border-box;
      font: inherit;
    }
    .lv-menubar__item:hover,
    .lv-menubar__item--active { background: var(--lv-color-surface); }
    .lv-menubar__item[aria-disabled="true"] { opacity: 0.5; cursor: not-allowed; pointer-events: none; }
    .lv-menubar__icon { flex-shrink: 0; display: inline-flex; }
    .lv-menubar__icon svg { width: 1rem; height: 1rem; }
    .lv-menubar__label { flex: 1 1 auto; }
    .lv-menubar__indicator { flex-shrink: 0; width: 1rem; display: inline-flex; justify-content: center; }
    .lv-menubar__indicator svg { width: 0.875rem; height: 0.875rem; }
    .lv-menubar__shortcut {
      flex-shrink: 0; margin-left: auto; padding-left: var(--lv-space-3);
      opacity: 0.6; font-size: var(--lv-text-xs, 0.75rem); letter-spacing: 0.05em;
    }
    .lv-menubar__chevron { flex-shrink: 0; margin-left: auto; display: inline-flex; }
    .lv-menubar__chevron svg { width: 1rem; height: 1rem; }
    .lv-menubar__separator { height: 1px; background: var(--lv-color-border); margin: var(--lv-space-1) 0; }
  `;

  connectedCallback() {
    super.connectedCallback();
    document.addEventListener("mousedown", this.handleOutsideClick, true);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener("mousedown", this.handleOutsideClick, true);
    window.clearTimeout(this.typeaheadTimer);
  }

  private handleOutsideClick = (e: MouseEvent) => {
    if (this.openMenu >= 0 && !this.contains(e.target as Node)) this.closeMenu();
  };

  private currentItems(): MenubarItem[] {
    return this.menus[this.openMenu]?.items ?? [];
  }

  /** Items at a submenu path within the open menu. [] -> the menu's own items. */
  private itemsAt(path: number[]): MenubarItem[] {
    let list = this.currentItems();
    for (const i of path) list = list[i]?.children ?? [];
    return list;
  }

  private svg(name: string): string {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
      stroke-linecap="round" stroke-linejoin="round">${iconBody(name)}</svg>`;
  }

  // --- bar-level navigation ---------------------------------------------------

  private focusTrigger(index: number) {
    const el = this.querySelector<HTMLElement>(`#${this.baseId}-trigger-${index}`);
    el?.focus();
  }

  private moveTrigger(delta: number) {
    const len = this.menus.length;
    if (len === 0) return;
    let idx = this.focusedMenu;
    for (let n = 0; n < len; n++) {
      idx = (idx + delta + len) % len;
      if (!this.menus[idx].disabled) break;
    }
    this.focusedMenu = idx;
    if (this.openMenu >= 0) {
      this.openMenuAt(idx);
    } else {
      this.updateComplete.then(() => this.focusTrigger(idx));
    }
  }

  private onTriggerKeyDown(e: KeyboardEvent, index: number) {
    switch (e.key) {
      case "ArrowRight":
        e.preventDefault();
        this.moveTrigger(1);
        break;
      case "ArrowLeft":
        e.preventDefault();
        this.moveTrigger(-1);
        break;
      case "ArrowDown":
      case "Enter":
      case " ":
        e.preventDefault();
        this.openMenuAt(index);
        break;
      case "ArrowUp":
        e.preventDefault();
        this.openMenuAt(index, "last");
        break;
      case "Home":
        e.preventDefault();
        this.focusedMenu = this.menus.findIndex((m) => !m.disabled);
        this.focusTrigger(this.focusedMenu);
        break;
      case "End":
        e.preventDefault();
        for (let i = this.menus.length - 1; i >= 0; i--) {
          if (!this.menus[i].disabled) {
            this.focusedMenu = i;
            break;
          }
        }
        this.focusTrigger(this.focusedMenu);
        break;
      case "Escape":
        if (this.openMenu >= 0) {
          e.preventDefault();
          this.closeMenu();
        }
        break;
    }
  }

  private openMenuAt(index: number, which: "first" | "last" = "first") {
    if (this.menus[index]?.disabled) return;
    this.focusedMenu = index;
    this.openMenu = index;
    this.openPath = [];
    const first = which === "first" ? this.firstEnabled([]) : this.lastEnabled([]);
    this.activePath = first >= 0 ? [first] : [];
    this.updateComplete.then(() => {
      this.positionMenu();
      this.focusActive();
    });
  }

  private closeMenu() {
    const idx = this.focusedMenu;
    this.openMenu = -1;
    this.openPath = [];
    this.activePath = [];
    this.updateComplete.then(() => this.focusTrigger(idx));
  }

  // --- item-level navigation --------------------------------------------------

  private firstEnabled(path: number[]): number {
    const list = this.itemsAt(path);
    return list.findIndex((it) => !it.disabled && it.type !== "separator");
  }

  private lastEnabled(path: number[]): number {
    const list = this.itemsAt(path);
    for (let i = list.length - 1; i >= 0; i--) {
      if (!list[i].disabled && list[i].type !== "separator") return i;
    }
    return -1;
  }

  private async positionMenu() {
    const trigger = this.querySelector<HTMLElement>(`#${this.baseId}-trigger-${this.openMenu}`);
    const panel = this.querySelector<HTMLElement>(`#${this.baseId}-panel-0`);
    if (!trigger || !panel) return;
    const { x, y } = await computePosition(trigger, panel, {
      placement: "bottom-start",
      middleware: [offset(4), flip(), shift({ padding: 4 })],
    });
    panel.style.left = `${x}px`;
    panel.style.top = `${y}px`;
  }

  private async positionSubmenu(depth: number, parentIndex: number) {
    const item = this.querySelector<HTMLElement>(
      `#${this.baseId}-${depth - 1}-item-${parentIndex}`
    );
    const panel = this.querySelector<HTMLElement>(`#${this.baseId}-panel-${depth}`);
    if (!item || !panel) return;
    const { x, y } = await computePosition(item, panel, {
      placement: "right-start",
      middleware: [offset({ mainAxis: 0, alignmentAxis: -4 }), flip(), shift({ padding: 4 })],
    });
    panel.style.left = `${x}px`;
    panel.style.top = `${y}px`;
  }

  private focusActive() {
    if (this.activePath.length === 0) return;
    const depth = this.activePath.length - 1;
    const idx = this.activePath[depth];
    this.querySelector<HTMLElement>(`#${this.baseId}-${depth}-item-${idx}`)?.focus();
  }

  private move(delta: number) {
    if (this.activePath.length === 0) return;
    const depth = this.activePath.length - 1;
    const parentPath = this.activePath.slice(0, depth);
    const list = this.itemsAt(parentPath);
    const len = list.length;
    let idx = this.activePath[depth] + delta;
    while (idx >= 0 && idx < len && (list[idx].disabled || list[idx].type === "separator")) {
      idx += delta;
    }
    if (idx >= 0 && idx < len) {
      this.activePath = [...parentPath, idx];
      this.updateComplete.then(() => this.focusActive());
    }
  }

  private jump(which: "first" | "last") {
    if (this.activePath.length === 0) return;
    const depth = this.activePath.length - 1;
    const parentPath = this.activePath.slice(0, depth);
    const idx = which === "first" ? this.firstEnabled(parentPath) : this.lastEnabled(parentPath);
    if (idx >= 0) {
      this.activePath = [...parentPath, idx];
      this.updateComplete.then(() => this.focusActive());
    }
  }

  private openSubmenu(path: number[]) {
    this.openPath = path;
    const first = this.firstEnabled(path);
    this.activePath = first >= 0 ? [...path, first] : [...path];
    const depth = path.length;
    this.updateComplete.then(() => {
      this.positionSubmenu(depth, path[depth - 1]);
      this.focusActive();
    });
  }

  private closeSubmenu() {
    if (this.activePath.length <= 1) return;
    const parentPath = this.activePath.slice(0, -1);
    this.openPath = parentPath.slice(0, -1);
    this.activePath = parentPath;
    this.updateComplete.then(() => this.focusActive());
  }

  private activate(item: MenubarItem, path: number[]) {
    if (item.disabled || item.type === "separator") return;
    if (item.type === "submenu") {
      this.openSubmenu(path);
      return;
    }
    const menuKey = this.menus[this.openMenu]?.key;
    if (item.type === "checkbox" || item.type === "radio") {
      const next = item.type === "radio" ? true : !item.checked;
      this.dispatchEvent(
        new CustomEvent("lv-checked-change", {
          detail: { menu: menuKey, key: item.key, checked: next },
          bubbles: true,
          composed: true,
        })
      );
    }
    this.dispatchEvent(
      new CustomEvent("lv-select", {
        detail: { menu: menuKey, key: item.key },
        bubbles: true,
        composed: true,
      })
    );
    this.closeMenu();
  }

  private doTypeahead(key: string) {
    window.clearTimeout(this.typeaheadTimer);
    this.typeahead += key.toLowerCase();
    this.typeaheadTimer = window.setTimeout(() => (this.typeahead = ""), 500);
    const depth = this.activePath.length ? this.activePath.length - 1 : 0;
    const parentPath = this.activePath.slice(0, depth);
    const list = this.itemsAt(parentPath);
    const start = (this.activePath[depth] ?? -1) + 1;
    for (let n = 0; n < list.length; n++) {
      const i = (start + n) % list.length;
      const it = list[i];
      if (it.disabled || it.type === "separator") continue;
      if ((it.label ?? "").toLowerCase().startsWith(this.typeahead)) {
        this.activePath = [...parentPath, i];
        this.updateComplete.then(() => this.focusActive());
        return;
      }
    }
  }

  private onMenuKeyDown(e: KeyboardEvent, path: number[]) {
    const depth = this.activePath.length - 1;
    const idx = this.activePath[depth];
    const list = this.itemsAt(path);
    const current = idx >= 0 ? list[idx] : undefined;
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        this.move(1);
        break;
      case "ArrowUp":
        e.preventDefault();
        this.move(-1);
        break;
      case "Home":
        e.preventDefault();
        this.jump("first");
        break;
      case "End":
        e.preventDefault();
        this.jump("last");
        break;
      case "ArrowRight":
        e.preventDefault();
        if (current?.type === "submenu" && !current.disabled) {
          this.openSubmenu([...path, idx]);
        } else if (path.length === 0) {
          // top level: slide to the next bar menu
          this.moveTrigger(1);
        }
        break;
      case "ArrowLeft":
        e.preventDefault();
        if (path.length > 0) {
          this.closeSubmenu();
        } else {
          this.moveTrigger(-1);
        }
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        if (current) this.activate(current, [...path, idx]);
        break;
      case "Escape":
        e.preventDefault();
        if (path.length > 0) this.closeSubmenu();
        else this.closeMenu();
        break;
      case "Tab":
        e.preventDefault();
        this.closeMenu();
        break;
      default:
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
          e.preventDefault();
          this.doTypeahead(e.key);
        }
    }
  }

  private renderIndicator(item: MenubarItem) {
    if (item.type !== "checkbox" && item.type !== "radio") return nothing;
    const icon = item.type === "radio" ? "circle-check" : "check";
    return html`<span class="lv-menubar__indicator" aria-hidden="true">
      ${item.checked ? unsafeSVG(this.svg(icon)) : nothing}
    </span>`;
  }

  private roleFor(item: MenubarItem): string {
    switch (item.type) {
      case "checkbox":
        return "menuitemcheckbox";
      case "radio":
        return "menuitemradio";
      default:
        return "menuitem";
    }
  }

  private renderMenu(list: MenubarItem[], path: number[]): TemplateResult {
    const depth = path.length;
    return html`
      <div
        class="lv-menubar__panel"
        id=${`${this.baseId}-panel-${depth}`}
        role="menu"
        @keydown=${(e: KeyboardEvent) => this.onMenuKeyDown(e, path)}
      >
        ${list.map((item, i) => {
          if (item.type === "separator") {
            return html`<div class="lv-menubar__separator" role="separator"></div>`;
          }
          const isActive =
            this.activePath.length === depth + 1 &&
            this.activePath.slice(0, depth).every((p, k) => p === path[k]) &&
            this.activePath[depth] === i;
          const isSubmenu = item.type === "submenu";
          const subOpen =
            isSubmenu &&
            this.openPath.length === depth + 1 &&
            this.openPath.every((p, k) => (k < depth ? p === path[k] : p === i));
          return html`
            <button
              class="lv-menubar__item ${isActive ? "lv-menubar__item--active" : ""}"
              id=${`${this.baseId}-${depth}-item-${i}`}
              role=${this.roleFor(item)}
              type="button"
              tabindex=${isActive ? "0" : "-1"}
              aria-disabled=${item.disabled ? "true" : "false"}
              aria-checked=${item.type === "checkbox" || item.type === "radio"
                ? item.checked
                  ? "true"
                  : "false"
                : nothing}
              aria-haspopup=${isSubmenu ? "menu" : nothing}
              aria-expanded=${isSubmenu ? (subOpen ? "true" : "false") : nothing}
              @click=${(e: MouseEvent) => {
                e.stopPropagation();
                this.activate(item, [...path, i]);
              }}
              @mouseenter=${() => {
                if (!item.disabled) {
                  this.activePath = [...path, i];
                  if (isSubmenu) this.openSubmenu([...path, i]);
                  else if (this.openPath.length > depth) this.openPath = path;
                }
              }}
            >
              ${this.renderIndicator(item)}
              ${item.icon
                ? html`<span class="lv-menubar__icon" aria-hidden="true"
                    >${unsafeSVG(this.svg(item.icon))}</span
                  >`
                : nothing}
              <span class="lv-menubar__label">${item.label}</span>
              ${item.shortcut
                ? html`<span class="lv-menubar__shortcut">${item.shortcut}</span>`
                : nothing}
              ${isSubmenu
                ? html`<span class="lv-menubar__chevron" aria-hidden="true"
                    >${unsafeSVG(this.svg("chevron-right"))}</span
                  >`
                : nothing}
            </button>
            ${subOpen ? this.renderMenu(item.children ?? [], [...path, i]) : nothing}
          `;
        })}
      </div>
    `;
  }

  render() {
    return html`
      <div class="lv-menubar" role="menubar" aria-orientation="horizontal">
        ${this.menus.map((menu, i) => {
          const isOpen = this.openMenu === i;
          return html`
            <button
              class="lv-menubar__trigger"
              id=${`${this.baseId}-trigger-${i}`}
              role="menuitem"
              type="button"
              aria-haspopup="menu"
              aria-expanded=${isOpen ? "true" : "false"}
              aria-disabled=${menu.disabled ? "true" : "false"}
              tabindex=${i === this.focusedMenu ? "0" : "-1"}
              @click=${() => (isOpen ? this.closeMenu() : this.openMenuAt(i))}
              @keydown=${(e: KeyboardEvent) => this.onTriggerKeyDown(e, i)}
              @mouseenter=${() => {
                if (this.openMenu >= 0 && !menu.disabled) this.openMenuAt(i);
              }}
            >
              ${menu.label}
            </button>
            ${isOpen ? this.renderMenu(menu.items, []) : nothing}
          `;
        })}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "lv-menubar": LvMenubar;
  }
}
