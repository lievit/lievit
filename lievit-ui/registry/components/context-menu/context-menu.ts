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
 * A single entry in a `<lv-context-menu>`.
 *
 * The `type` discriminates the rendered role:
 * - `item` (default): a `role="menuitem"` that emits `lv-select` on activation.
 * - `checkbox`: a `role="menuitemcheckbox"` whose `checked` toggles on activation.
 * - `radio`: a `role="menuitemradio"`; activating it selects within its `radioGroup`.
 * - `separator`: a `role="separator"` divider (no key needed).
 * - `submenu`: opens a nested menu of `children` to its side.
 */
export interface ContextMenuItem {
  /** Unique key emitted in the `lv-select` event (omit for separators). */
  key?: string;
  /** Display label. */
  label?: string;
  /** Lucide icon name rendered as an inline svg (optional). */
  icon?: string;
  /** Keyboard shortcut hint shown right-aligned (display only). */
  shortcut?: string;
  /** Prevents activation and dims the item. */
  disabled?: boolean;
  /** Entry kind; defaults to "item". */
  type?: "item" | "checkbox" | "radio" | "separator" | "submenu";
  /** Checked state for checkbox/radio entries. */
  checked?: boolean;
  /** Radio group name (radio entries with the same name are mutually exclusive). */
  radioGroup?: string;
  /** Child entries for a submenu. */
  children?: ContextMenuItem[];
}

/**
 * `<lv-context-menu>`: a right-click (context) menu opened at the pointer.
 *
 * Implements the WAI-ARIA APG menu pattern matched to Radix `ContextMenu`:
 * - The menu opens on `contextmenu` over the trigger slot (preventDefault) at the
 *   pointer coordinates; on keyboard `ContextMenu`/`Shift+F10` it opens at the trigger.
 * - Panel: `role="menu"`. Items: `role="menuitem|menuitemcheckbox|menuitemradio"`,
 *   `aria-disabled`, `aria-checked` (for checkbox/radio), `aria-haspopup`/`aria-expanded`
 *   (for submenus).
 * - Keyboard once open: ArrowUp/Down navigate (skipping disabled/separators),
 *   Home/End jump, ArrowRight/Enter/Space open a submenu or activate, ArrowLeft closes a
 *   submenu, a printable key does typeahead, Escape closes (focus returns to the trigger).
 *
 * Positioned by `@floating-ui/dom` (flip + shift so it stays in-viewport); the root menu
 * anchors to a virtual element at the pointer, submenus anchor to their parent item.
 * Data down, events up: emits `lv-select` with the activated item's key, and
 * `lv-checked-change` ({ key, checked }) when a checkbox/radio toggles.
 *
 * Owned source, copied in by `lievit add context-menu`. Light-DOM rendered.
 */
@customElement("lv-context-menu")
export class LvContextMenu extends LitElement {
  /** The menu entries to render. */
  @property({ type: Array }) items: ContextMenuItem[] = [];

  @state() private open = false;
  /** Index path into the open submenu chain (e.g. [2] -> item 2's submenu is open). */
  @state() private openPath: number[] = [];
  /** Active (focused) index path; last element is the focused item in its menu. */
  @state() private activePath: number[] = [];

  private pointer = { x: 0, y: 0 };
  private typeahead = "";
  private typeaheadTimer = 0;

  private static seq = 0;
  private readonly baseId = `lv-context-menu-${LvContextMenu.seq++}`;

  createRenderRoot(): this {
    adoptLightStyles("lv-context-menu", LvContextMenu.css);
    return this;
  }

  static readonly css = `
    .lv-context-menu { display: contents; }
    .lv-context-menu__panel {
      position: fixed;
      z-index: 9300;
      min-width: 12rem;
      background: var(--lv-color-bg);
      border: 1px solid var(--lv-color-border);
      border-radius: var(--lv-radius-md);
      box-shadow: var(--lv-shadow-md);
      padding: var(--lv-space-1) 0;
      font-family: var(--lv-font-sans);
      font-size: var(--lv-text-sm);
    }
    .lv-context-menu__item {
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
    .lv-context-menu__item:hover,
    .lv-context-menu__item--active { background: var(--lv-color-surface); }
    .lv-context-menu__item[aria-disabled="true"] {
      opacity: 0.5; cursor: not-allowed; pointer-events: none;
    }
    .lv-context-menu__icon { flex-shrink: 0; display: inline-flex; }
    .lv-context-menu__icon svg { width: 1rem; height: 1rem; }
    .lv-context-menu__label { flex: 1 1 auto; }
    .lv-context-menu__indicator {
      flex-shrink: 0; width: 1rem; display: inline-flex; justify-content: center;
    }
    .lv-context-menu__indicator svg { width: 0.875rem; height: 0.875rem; }
    .lv-context-menu__shortcut {
      flex-shrink: 0; margin-left: auto; padding-left: var(--lv-space-3);
      color: var(--lv-color-muted-fg, var(--lv-color-fg)); opacity: 0.6;
      font-size: var(--lv-text-xs, 0.75rem); letter-spacing: 0.05em;
    }
    .lv-context-menu__chevron { flex-shrink: 0; margin-left: auto; display: inline-flex; }
    .lv-context-menu__chevron svg { width: 1rem; height: 1rem; }
    .lv-context-menu__separator {
      height: 1px; background: var(--lv-color-border); margin: var(--lv-space-1) 0;
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    document.addEventListener("mousedown", this.handleOutsideClick, true);
    document.addEventListener("contextmenu", this.handleOutsideContext, true);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener("mousedown", this.handleOutsideClick, true);
    document.removeEventListener("contextmenu", this.handleOutsideContext, true);
    window.clearTimeout(this.typeaheadTimer);
  }

  /** Resolve the list of items at a given (parent) path. [] -> root items. */
  private itemsAt(path: number[]): ContextMenuItem[] {
    let list = this.items;
    for (const i of path) {
      list = list[i]?.children ?? [];
    }
    return list;
  }

  private handleOutsideClick = (e: MouseEvent) => {
    if (this.open && !this.contains(e.target as Node)) this.closeAll();
  };

  /** A right-click outside our trigger closes us rather than re-targeting. */
  private handleOutsideContext = (e: MouseEvent) => {
    if (this.open && !this.contains(e.target as Node)) this.closeAll();
  };

  private onTriggerContextMenu = (e: MouseEvent) => {
    e.preventDefault();
    this.pointer = { x: e.clientX, y: e.clientY };
    this.openRoot();
  };

  private onTriggerKeyDown = (e: KeyboardEvent) => {
    // Keyboard menu key (or Shift+F10) opens the menu at the trigger.
    if (e.key === "ContextMenu" || (e.shiftKey && e.key === "F10")) {
      e.preventDefault();
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      this.pointer = { x: rect.left, y: rect.bottom };
      this.openRoot();
    }
  };

  private openRoot() {
    this.open = true;
    this.openPath = [];
    const first = this.firstEnabled([]);
    this.activePath = first >= 0 ? [first] : [];
    this.updateComplete.then(() => {
      this.positionRoot();
      this.focusActive();
    });
  }

  private closeAll() {
    this.open = false;
    this.openPath = [];
    this.activePath = [];
  }

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

  private async positionRoot() {
    const panel = this.querySelector(`#${this.baseId}-0`) as HTMLElement | null;
    if (!panel) return;
    const virtual = {
      getBoundingClientRect: () => ({
        width: 0,
        height: 0,
        x: this.pointer.x,
        y: this.pointer.y,
        top: this.pointer.y,
        left: this.pointer.x,
        right: this.pointer.x,
        bottom: this.pointer.y,
      }),
    };
    const { x, y } = await computePosition(virtual, panel, {
      placement: "right-start",
      middleware: [offset({ mainAxis: 0, alignmentAxis: 0 }), flip(), shift({ padding: 4 })],
    });
    panel.style.left = `${x}px`;
    panel.style.top = `${y}px`;
  }

  private async positionSubmenu(depth: number, parentIndex: number) {
    const item = this.querySelector(
      `#${this.baseId}-${depth - 1}-item-${parentIndex}`
    ) as HTMLElement | null;
    const panel = this.querySelector(`#${this.baseId}-${depth}`) as HTMLElement | null;
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
    const el = this.querySelector<HTMLElement>(`#${this.baseId}-${depth}-item-${idx}`);
    el?.focus();
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

  private activate(item: ContextMenuItem, path: number[]) {
    if (item.disabled || item.type === "separator") return;
    if (item.type === "submenu") {
      this.openSubmenu(path);
      return;
    }
    if (item.type === "checkbox" || item.type === "radio") {
      const next = item.type === "radio" ? true : !item.checked;
      this.dispatchEvent(
        new CustomEvent("lv-checked-change", {
          detail: { key: item.key, checked: next },
          bubbles: true,
          composed: true,
        })
      );
    }
    this.dispatchEvent(
      new CustomEvent("lv-select", { detail: item.key, bubbles: true, composed: true })
    );
    this.closeAll();
    this.focusTrigger();
  }

  private focusTrigger() {
    (this.querySelector(".lv-context-menu__trigger") as HTMLElement | null)?.focus();
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
        if (current?.type === "submenu" && !current.disabled) {
          e.preventDefault();
          this.openSubmenu([...path, idx]);
        }
        break;
      case "ArrowLeft":
        if (path.length > 0) {
          e.preventDefault();
          this.closeSubmenu();
        }
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        if (current) this.activate(current, [...path, idx]);
        break;
      case "Escape":
        e.preventDefault();
        if (path.length > 0) {
          this.closeSubmenu();
        } else {
          this.closeAll();
          this.focusTrigger();
        }
        break;
      case "Tab":
        e.preventDefault();
        this.closeAll();
        this.focusTrigger();
        break;
      default:
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
          e.preventDefault();
          this.doTypeahead(e.key);
        }
    }
  }

  private renderIndicator(item: ContextMenuItem) {
    if (item.type !== "checkbox" && item.type !== "radio") return nothing;
    const icon = item.type === "radio" ? "circle-check" : "check";
    return html`<span class="lv-context-menu__indicator" aria-hidden="true">
      ${item.checked ? unsafeSVG(this.svg(icon)) : nothing}
    </span>`;
  }

  private svg(name: string): string {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
      stroke-linecap="round" stroke-linejoin="round">${iconBody(name)}</svg>`;
  }

  private roleFor(item: ContextMenuItem): string {
    switch (item.type) {
      case "checkbox":
        return "menuitemcheckbox";
      case "radio":
        return "menuitemradio";
      default:
        return "menuitem";
    }
  }

  private renderMenu(list: ContextMenuItem[], path: number[]): TemplateResult {
    const depth = path.length;
    return html`
      <div
        class="lv-context-menu__panel"
        id=${`${this.baseId}-${depth}`}
        role="menu"
        @keydown=${(e: KeyboardEvent) => this.onMenuKeyDown(e, path)}
      >
        ${list.map((item, i) => {
          if (item.type === "separator") {
            return html`<div class="lv-context-menu__separator" role="separator"></div>`;
          }
          const isActive =
            this.activePath.length === depth + 1 &&
            this.activePath.slice(0, depth).every((p, k) => p === path[k]) &&
            this.activePath[depth] === i;
          const isSubmenu = item.type === "submenu";
          const subOpen = isSubmenu && this.openPath.length === depth + 1 &&
            this.openPath.every((p, k) => (k < depth ? p === path[k] : p === i));
          return html`
            <button
              class="lv-context-menu__item ${isActive ? "lv-context-menu__item--active" : ""}"
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
                ? html`<span class="lv-context-menu__icon" aria-hidden="true"
                    >${unsafeSVG(this.svg(item.icon))}</span
                  >`
                : nothing}
              <span class="lv-context-menu__label">${item.label}</span>
              ${item.shortcut
                ? html`<span class="lv-context-menu__shortcut">${item.shortcut}</span>`
                : nothing}
              ${isSubmenu
                ? html`<span class="lv-context-menu__chevron" aria-hidden="true"
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
      <div class="lv-context-menu">
        <div
          class="lv-context-menu__trigger"
          tabindex="0"
          @contextmenu=${this.onTriggerContextMenu}
          @keydown=${this.onTriggerKeyDown}
        >
          <slot></slot>
        </div>
        ${this.open ? this.renderMenu(this.items, []) : nothing}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "lv-context-menu": LvContextMenu;
  }
}
