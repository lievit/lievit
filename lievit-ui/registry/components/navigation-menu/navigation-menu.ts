/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
import { LitElement, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { unsafeSVG } from "lit/directives/unsafe-svg.js";
import { computePosition, flip, shift, offset } from "@floating-ui/dom";
import { adoptLightStyles } from "../light-dom/light-dom.js";
import { iconBody } from "../../icons/icon-bodies.js";

/** A link rendered inside a navigation-menu content panel. */
export interface NavLink {
  /** Visible label. */
  label: string;
  /** The destination href (a real anchor, not a JS handler). */
  href: string;
  /** Short description shown under the label (optional). */
  description?: string;
  /** Lucide icon name rendered as an inline svg (optional). */
  icon?: string;
}

/**
 * One top-level entry of the navigation menu.
 *
 * An entry is either a plain link (no `links`/`content`) rendered as a bare `<a>`, or a
 * trigger that opens a content panel holding `links`.
 */
export interface NavItem {
  /** Unique key (used in `data-*` ids). */
  key: string;
  /** The trigger / link label. */
  label: string;
  /** For a plain link entry: its href. Ignored when `links` is present. */
  href?: string;
  /** The grouped links shown in the dropdown panel; presence makes this a trigger. */
  links?: NavLink[];
}

/**
 * `<lv-navigation-menu>`: a site navigation bar with rich dropdown panels.
 *
 * This is NOT a menu (no `role="menu"`); it is a navigation landmark, matched to Radix
 * `NavigationMenu`:
 * - Root: `<nav aria-label>` wrapping a `<ul>` list of items.
 * - A trigger is a `<button aria-expanded aria-controls>`; activating/hovering it opens a
 *   content panel of real `<a>` links (so middle-click / open-in-new-tab work).
 * - Hover opens after a short intent delay and pointer-leave closes after a delay (so a
 *   diagonal sweep from trigger to panel does not dismiss it). Keyboard opens explicitly
 *   (ArrowDown/Enter/Space), never on bare refocus, so Escape can return focus without
 *   re-opening; Escape closes and returns focus to the trigger, ArrowLeft/ArrowRight move
 *   between triggers.
 * - Only one panel is open at a time; the open panel is positioned by `@floating-ui/dom`.
 *
 * Data down, events up: emits `lv-open` / `lv-close` ({ key }) as panels toggle. The links
 * are ordinary anchors, so navigation is the browser's, not a custom event.
 *
 * Owned source, copied in by `lievit add navigation-menu`. Light-DOM rendered.
 */
@customElement("lv-navigation-menu")
export class LvNavigationMenu extends LitElement {
  /** The top-level navigation items. */
  @property({ type: Array }) items: NavItem[] = [];

  /** Accessible label for the nav landmark. */
  @property() label = "Main";

  /** Delay (ms) before a hovered trigger opens its panel. */
  @property({ type: Number, attribute: "open-delay" }) openDelay = 150;

  /** Delay (ms) before a pointer-leave closes the open panel. */
  @property({ type: Number, attribute: "close-delay" }) closeDelay = 200;

  /** Key of the open item, or "" when closed. */
  @state() private openKey = "";

  private openTimer = 0;
  private closeTimer = 0;

  private static seq = 0;
  private readonly baseId = `lv-navigation-menu-${LvNavigationMenu.seq++}`;

  createRenderRoot(): this {
    adoptLightStyles("lv-navigation-menu", LvNavigationMenu.css);
    return this;
  }

  static readonly css = `
    .lv-nav { font-family: var(--lv-font-sans); font-size: var(--lv-text-sm); }
    .lv-nav__list {
      display: flex; align-items: center; gap: var(--lv-space-1);
      list-style: none; margin: 0; padding: 0;
    }
    .lv-nav__trigger, .lv-nav__link {
      display: inline-flex; align-items: center; gap: var(--lv-space-1);
      color: var(--lv-color-fg); background: transparent; border: 0;
      border-radius: var(--lv-radius-sm, var(--lv-radius-md));
      padding: var(--lv-space-2) var(--lv-space-3);
      cursor: pointer; font: inherit; text-decoration: none;
    }
    .lv-nav__trigger:hover, .lv-nav__link:hover,
    .lv-nav__trigger[aria-expanded="true"] { background: var(--lv-color-surface); }
    .lv-nav__trigger:focus-visible, .lv-nav__link:focus-visible {
      outline: none; box-shadow: var(--lv-ring);
    }
    .lv-nav__chevron { display: inline-flex; transition: transform 150ms ease; }
    .lv-nav__chevron svg { width: 1rem; height: 1rem; }
    .lv-nav__chevron--open { transform: rotate(180deg); }
    .lv-nav__panel {
      position: fixed; z-index: 9300; min-width: 16rem;
      background: var(--lv-color-bg); border: 1px solid var(--lv-color-border);
      border-radius: var(--lv-radius-md); box-shadow: var(--lv-shadow-md);
      padding: var(--lv-space-2); display: none;
    }
    .lv-nav__panel--open { display: block; }
    .lv-nav__panel-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 2px; }
    .lv-nav__item-link {
      display: flex; align-items: flex-start; gap: var(--lv-space-2);
      padding: var(--lv-space-2) var(--lv-space-3);
      border-radius: var(--lv-radius-sm, var(--lv-radius-md));
      color: var(--lv-color-fg); text-decoration: none;
    }
    .lv-nav__item-link:hover, .lv-nav__item-link:focus-visible {
      background: var(--lv-color-surface); outline: none;
    }
    .lv-nav__item-link:focus-visible { box-shadow: var(--lv-ring); }
    .lv-nav__item-icon { flex-shrink: 0; display: inline-flex; margin-top: 2px; }
    .lv-nav__item-icon svg { width: 1rem; height: 1rem; }
    .lv-nav__item-text { display: flex; flex-direction: column; gap: 2px; }
    .lv-nav__item-label { font-weight: 500; }
    .lv-nav__item-desc {
      color: var(--lv-color-muted-fg, var(--lv-color-fg)); opacity: 0.7;
      font-size: var(--lv-text-xs, 0.75rem); line-height: 1.3;
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    document.addEventListener("mousedown", this.handleOutsideClick, true);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener("mousedown", this.handleOutsideClick, true);
    this.clearTimers();
  }

  private clearTimers() {
    if (this.openTimer) {
      clearTimeout(this.openTimer);
      this.openTimer = 0;
    }
    if (this.closeTimer) {
      clearTimeout(this.closeTimer);
      this.closeTimer = 0;
    }
  }

  private handleOutsideClick = (e: MouseEvent) => {
    if (this.openKey && !this.contains(e.target as Node)) this.close();
  };

  private svg(name: string): string {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
      stroke-linecap="round" stroke-linejoin="round">${iconBody(name)}</svg>`;
  }

  private triggers(): HTMLElement[] {
    return Array.from(this.querySelectorAll<HTMLElement>(".lv-nav__trigger, .lv-nav__link"));
  }

  private open(key: string) {
    this.clearTimers();
    this.openKey = key;
    this.dispatchEvent(
      new CustomEvent("lv-open", { detail: { key }, bubbles: true, composed: true })
    );
    this.updateComplete.then(() => this.position(key));
  }

  private close() {
    this.clearTimers();
    if (!this.openKey) return;
    const key = this.openKey;
    this.openKey = "";
    this.dispatchEvent(
      new CustomEvent("lv-close", { detail: { key }, bubbles: true, composed: true })
    );
  }

  private scheduleOpen(key: string) {
    if (this.closeTimer) {
      clearTimeout(this.closeTimer);
      this.closeTimer = 0;
    }
    if (this.openKey === key) return;
    // If a panel is already open, swap immediately (classic nav behaviour); otherwise delay.
    if (this.openKey) {
      this.open(key);
      return;
    }
    if (this.openTimer) clearTimeout(this.openTimer);
    this.openTimer = window.setTimeout(() => {
      this.openTimer = 0;
      this.open(key);
    }, this.openDelay);
  }

  private scheduleClose() {
    if (this.openTimer) {
      clearTimeout(this.openTimer);
      this.openTimer = 0;
    }
    if (!this.openKey || this.closeTimer) return;
    this.closeTimer = window.setTimeout(() => {
      this.closeTimer = 0;
      this.close();
    }, this.closeDelay);
  }

  private async position(key: string) {
    const trigger = this.querySelector<HTMLElement>(`#${this.baseId}-trigger-${key}`);
    const panel = this.querySelector<HTMLElement>(`#${this.baseId}-panel-${key}`);
    if (!trigger || !panel) return;
    const { x, y } = await computePosition(trigger, panel, {
      placement: "bottom-start",
      middleware: [offset(8), flip(), shift({ padding: 8 })],
    });
    panel.style.left = `${x}px`;
    panel.style.top = `${y}px`;
  }

  private focusTrigger(index: number) {
    this.triggers()[index]?.focus();
  }

  private moveTrigger(from: number, delta: number) {
    const triggers = this.triggers();
    const len = triggers.length;
    if (len === 0) return;
    const idx = (from + delta + len) % len;
    triggers[idx]?.focus();
  }

  private onTriggerKeyDown(e: KeyboardEvent, item: NavItem, index: number) {
    switch (e.key) {
      case "ArrowRight":
        e.preventDefault();
        this.moveTrigger(index, 1);
        break;
      case "ArrowLeft":
        e.preventDefault();
        this.moveTrigger(index, -1);
        break;
      case "ArrowDown":
      case "Enter":
      case " ":
        if (item.links?.length) {
          e.preventDefault();
          this.open(item.key);
          this.updateComplete.then(() => {
            this.querySelector<HTMLElement>(`#${this.baseId}-panel-${item.key} a`)?.focus();
          });
        }
        break;
      case "Escape":
        if (this.openKey) {
          e.preventDefault();
          this.close();
          this.focusTrigger(index);
        }
        break;
    }
  }

  private onPanelKeyDown(e: KeyboardEvent, triggerIndex: number) {
    if (e.key === "Escape") {
      e.preventDefault();
      this.close();
      this.focusTrigger(triggerIndex);
    }
  }

  render() {
    return html`
      <nav class="lv-nav" aria-label=${this.label}>
        <ul class="lv-nav__list">
          ${this.items.map((item, index) => {
            const isTrigger = !!item.links?.length;
            const isOpen = this.openKey === item.key;
            if (!isTrigger) {
              return html`<li>
                <a
                  class="lv-nav__link"
                  href=${item.href ?? "#"}
                  @keydown=${(e: KeyboardEvent) => this.onTriggerKeyDown(e, item, index)}
                  @pointerenter=${() => this.scheduleClose()}
                  >${item.label}</a
                >
              </li>`;
            }
            return html`<li
              @pointerenter=${() => this.scheduleOpen(item.key)}
              @pointerleave=${() => this.scheduleClose()}
            >
              <button
                class="lv-nav__trigger"
                id=${`${this.baseId}-trigger-${item.key}`}
                type="button"
                aria-expanded=${isOpen ? "true" : "false"}
                aria-controls=${`${this.baseId}-panel-${item.key}`}
                @click=${() => (isOpen ? this.close() : this.open(item.key))}
                @keydown=${(e: KeyboardEvent) => this.onTriggerKeyDown(e, item, index)}
              >
                ${item.label}
                <span class="lv-nav__chevron ${isOpen ? "lv-nav__chevron--open" : ""}"
                  aria-hidden="true"
                  >${unsafeSVG(this.svg("chevron-down"))}</span
                >
              </button>
              <div
                class="lv-nav__panel ${isOpen ? "lv-nav__panel--open" : ""}"
                id=${`${this.baseId}-panel-${item.key}`}
                role="region"
                aria-label=${item.label}
                @pointerenter=${() => this.scheduleOpen(item.key)}
                @pointerleave=${() => this.scheduleClose()}
                @keydown=${(e: KeyboardEvent) => this.onPanelKeyDown(e, index)}
              >
                <ul class="lv-nav__panel-list">
                  ${(item.links ?? []).map(
                    (link) => html`<li>
                      <a class="lv-nav__item-link" href=${link.href}>
                        ${link.icon
                          ? html`<span class="lv-nav__item-icon" aria-hidden="true"
                              >${unsafeSVG(this.svg(link.icon))}</span
                            >`
                          : nothing}
                        <span class="lv-nav__item-text">
                          <span class="lv-nav__item-label">${link.label}</span>
                          ${link.description
                            ? html`<span class="lv-nav__item-desc">${link.description}</span>`
                            : nothing}
                        </span>
                      </a>
                    </li>`
                  )}
                </ul>
              </div>
            </li>`;
          })}
        </ul>
      </nav>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "lv-navigation-menu": LvNavigationMenu;
  }
}
