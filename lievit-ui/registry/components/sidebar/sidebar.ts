/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
import { LitElement, html, nothing, type TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { unsafeSVG } from "lit/directives/unsafe-svg.js";
import { adoptLightStyles } from "../light-dom/light-dom.js";
import { iconBody } from "../../icons/icon-bodies.js";

/** A single navigation entry inside a sidebar group. */
export interface SidebarMenuItem {
  /** Unique key emitted in `lv-navigate` and used for `aria-current` matching. */
  key: string;
  /** Display label. */
  label: string;
  /** Optional vendored Lucide icon name (rendered inline as SVG). */
  icon?: string;
  /** Link target; when set the item is an `<a href>`, otherwise a `<button>`. */
  href?: string;
  /** Optional short badge text (counts, "new", ...). */
  badge?: string;
  /** Disables the item. */
  disabled?: boolean;
  /** Nested sub-items; rendering becomes a collapsible sub-tree. */
  items?: SidebarMenuItem[];
}

/** A labelled group of menu items (a sidebar section). */
export interface SidebarGroup {
  /** Optional group heading (hidden when the rail is collapsed to icons). */
  label?: string;
  /** The items in this group. */
  items: SidebarMenuItem[];
}

/**
 * `<lv-sidebar>`: the application sidebar primitive (shadcn's `Sidebar` family folded
 * into one light-DOM island, research: shadcn sidebar.tsx anatomy + WAI-ARIA navigation).
 *
 * It is its OWN provider + trigger: there is no separate context component. State lives on
 * the element and is the single source of truth (data down, events up):
 * - `state` "expanded" | "collapsed": desktop shows the full panel or the icon rail.
 * - mobile (<= `mobileBreakpoint`): the panel becomes an off-canvas overlay reusing the
 *   sheet/drawer pattern (backdrop + slide-in + focus return), toggled by the same trigger.
 * - keyboard shortcut (default Ctrl/Cmd + B) toggles desktop collapse.
 * - the collapsed/expanded choice persists to `localStorage` under `storageKey`.
 *
 * Anatomy mirrors shadcn (header / content / footer; group -> menu -> menu-item -> menu-sub)
 * driven by the `header`/`footer` slots + the `groups` data property. The panel is a
 * `<nav aria-label>` landmark and the active item (matched by `active` against item `key`)
 * carries `aria-current="page"`.
 *
 * Emits `lv-navigate` (detail = item key) on activation and `lv-state-change`
 * (detail = "expanded" | "collapsed") when the desktop state flips.
 *
 * CSP-safe, dependency-free (only lit). Owned source, copied in by `lievit add sidebar`.
 * Light-DOM rendered so Tailwind + `--lv-*` tokens cascade in.
 */
@customElement("lv-sidebar")
export class LvSidebar extends LitElement {
  /** The navigation groups to render. */
  @property({ type: Array }) groups: SidebarGroup[] = [];

  /** Which edge the sidebar docks to. */
  @property() side: "left" | "right" = "left";

  /** Desktop collapse mode: "icon" keeps an icon rail, "offcanvas" hides it fully. */
  @property() collapsible: "icon" | "offcanvas" = "icon";

  /** The key of the currently active item; gets `aria-current="page"`. */
  @property() active = "";

  /** Accessible name for the `<nav>` landmark. */
  @property() label = "Main";

  /** Heading shown in the sidebar header (slot `header` overrides it). */
  @property() heading = "";

  /** Keyboard shortcut key (with Ctrl/Cmd) that toggles desktop collapse. */
  @property() shortcut = "b";

  /** localStorage key the expanded/collapsed choice persists under. */
  @property({ attribute: "storage-key" }) storageKey = "lv-sidebar-state";

  /** Viewport width (px) at or below which the sidebar becomes an off-canvas overlay. */
  @property({ type: Number, attribute: "mobile-breakpoint" }) mobileBreakpoint = 768;

  /** Desktop state. Bind to control; defaults from storage on first connect. */
  @property() state: "expanded" | "collapsed" = "expanded";

  /** Whether the mobile off-canvas overlay is open. */
  @state() private mobileOpen = false;
  @state() private isMobile = false;
  /** Expanded sub-tree keys (mobile + expanded desktop only). */
  @state() private openSubs = new Set<string>();

  private _returnFocus: Element | null = null;
  private _mql: MediaQueryList | null = null;

  createRenderRoot(): this {
    adoptLightStyles("lv-sidebar", LvSidebar.css);
    return this;
  }

  static readonly css = `
    .lv-sidebar {
      --lv-sidebar-w: 16rem;
      --lv-sidebar-w-icon: 3.25rem;
      display: flex;
      flex-direction: column;
      width: var(--lv-sidebar-w);
      height: 100%;
      background: var(--lv-color-sidebar);
      color: var(--lv-color-sidebar-fg);
      font-family: var(--lv-font-sans);
      font-size: var(--lv-text-sm);
      box-sizing: border-box;
      transition: width 0.2s ease;
    }
    .lv-sidebar--right { border-left: 1px solid var(--lv-color-sidebar-border); }
    .lv-sidebar:not(.lv-sidebar--right) { border-right: 1px solid var(--lv-color-sidebar-border); }
    /* desktop collapsed: icon rail or fully hidden */
    .lv-sidebar--collapsed.lv-sidebar--icon { width: var(--lv-sidebar-w-icon); }
    .lv-sidebar--collapsed.lv-sidebar--offcanvas { width: 0; border: 0; overflow: hidden; }
    .lv-sidebar--collapsed.lv-sidebar--icon .lv-sidebar__label,
    .lv-sidebar--collapsed.lv-sidebar--icon .lv-sidebar__group-label,
    .lv-sidebar--collapsed.lv-sidebar--icon .lv-sidebar__badge,
    .lv-sidebar--collapsed.lv-sidebar--icon .lv-sidebar__sub-toggle { display: none; }
    .lv-sidebar--collapsed.lv-sidebar--icon .lv-sidebar__item { justify-content: center; }
    .lv-sidebar--collapsed.lv-sidebar--icon .lv-sidebar__sub { display: none; }

    .lv-sidebar__header,
    .lv-sidebar__footer {
      display: flex;
      align-items: center;
      gap: var(--lv-space-2);
      padding: var(--lv-space-3);
      flex-shrink: 0;
    }
    .lv-sidebar__header { border-bottom: 1px solid var(--lv-color-sidebar-border); }
    .lv-sidebar__footer { border-top: 1px solid var(--lv-color-sidebar-border); margin-top: auto; }
    .lv-sidebar__heading { font-weight: 600; font-size: var(--lv-text-base); margin: 0; }
    .lv-sidebar__content {
      flex: 1;
      overflow-y: auto;
      padding: var(--lv-space-2);
      display: flex;
      flex-direction: column;
      gap: var(--lv-space-3);
    }
    .lv-sidebar__group { display: flex; flex-direction: column; gap: var(--lv-space-1); }
    .lv-sidebar__group-label {
      padding: var(--lv-space-1) var(--lv-space-2);
      font-size: var(--lv-text-xs);
      font-weight: 600;
      color: var(--lv-color-muted);
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }
    .lv-sidebar__menu { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px; }
    .lv-sidebar__item {
      display: flex;
      align-items: center;
      gap: var(--lv-space-2);
      width: 100%;
      box-sizing: border-box;
      padding: var(--lv-space-2);
      border: 0;
      border-radius: var(--lv-radius-md);
      background: transparent;
      color: inherit;
      font: inherit;
      text-align: left;
      text-decoration: none;
      cursor: pointer;
    }
    .lv-sidebar__item:hover { background: var(--lv-color-sidebar-accent); color: var(--lv-color-sidebar-accent-fg); }
    .lv-sidebar__item:focus-visible { outline: none; box-shadow: var(--lv-ring); }
    .lv-sidebar__item[aria-current="page"] {
      background: var(--lv-color-sidebar-accent);
      color: var(--lv-color-sidebar-accent-fg);
      font-weight: 500;
    }
    .lv-sidebar__item[aria-disabled="true"] { opacity: 0.5; pointer-events: none; }
    .lv-sidebar__icon { flex-shrink: 0; display: inline-flex; }
    .lv-sidebar__icon svg { width: 1rem; height: 1rem; }
    .lv-sidebar__label { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .lv-sidebar__badge {
      flex-shrink: 0;
      font-size: var(--lv-text-xs);
      padding: 0 var(--lv-space-2);
      border-radius: var(--lv-radius-full);
      background: var(--lv-color-sidebar-border);
      color: var(--lv-color-sidebar-fg);
    }
    .lv-sidebar__sub-toggle {
      flex-shrink: 0;
      background: transparent;
      border: 0;
      color: inherit;
      cursor: pointer;
      display: inline-flex;
      transition: transform 0.15s ease;
    }
    .lv-sidebar__sub-toggle svg { width: 0.9rem; height: 0.9rem; }
    .lv-sidebar__sub-toggle--open { transform: rotate(90deg); }
    .lv-sidebar__sub {
      list-style: none;
      margin: 2px 0 2px 0;
      padding-left: var(--lv-space-4);
      border-left: 1px solid var(--lv-color-sidebar-border);
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    /* trigger button (rendered by the host or via <lv-sidebar-trigger>) baseline */
    .lv-sidebar__trigger {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: var(--lv-space-2);
      border: 1px solid var(--lv-color-border);
      border-radius: var(--lv-radius-md);
      background: var(--lv-color-bg);
      color: var(--lv-color-fg);
      cursor: pointer;
    }
    .lv-sidebar__trigger:focus-visible { outline: none; box-shadow: var(--lv-ring); }
    .lv-sidebar__trigger svg { width: 1.1rem; height: 1.1rem; }

    /* mobile off-canvas */
    .lv-sidebar__backdrop {
      display: none;
      position: fixed;
      inset: 0;
      z-index: 9400;
      background: rgb(0 0 0 / 0.40);
    }
    .lv-sidebar--mobile .lv-sidebar__backdrop.lv-sidebar__backdrop--open { display: block; }
    .lv-sidebar--mobile .lv-sidebar {
      position: fixed;
      top: 0;
      bottom: 0;
      z-index: 9401;
      width: min(85vw, 18rem);
      transform: translateX(-100%);
      transition: transform 0.2s ease;
      box-shadow: var(--lv-shadow-lg);
    }
    .lv-sidebar--mobile.lv-sidebar--right .lv-sidebar { left: auto; right: 0; transform: translateX(100%); }
    .lv-sidebar--mobile:not(.lv-sidebar--right) .lv-sidebar { left: 0; }
    .lv-sidebar--mobile .lv-sidebar--open { transform: translateX(0); }
  `;

  connectedCallback() {
    super.connectedCallback();
    // hydrate from storage before first paint (controlled `state` wins if already set by attr)
    if (!this.hasAttribute("state")) {
      try {
        const saved = globalThis.localStorage?.getItem(this.storageKey);
        if (saved === "collapsed" || saved === "expanded") this.state = saved;
      } catch {
        /* storage unavailable (private mode / SSR): keep default */
      }
    }
    document.addEventListener("keydown", this.handleShortcut);
    this._mql = globalThis.matchMedia?.(`(max-width: ${this.mobileBreakpoint}px)`) ?? null;
    if (this._mql) {
      this.isMobile = this._mql.matches;
      this._mql.addEventListener("change", this.onMediaChange);
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener("keydown", this.handleShortcut);
    document.removeEventListener("keydown", this.handleEscape);
    this._mql?.removeEventListener("change", this.onMediaChange);
  }

  private onMediaChange = (e: MediaQueryListEvent) => {
    this.isMobile = e.matches;
    if (!this.isMobile) this.mobileOpen = false;
  };

  private handleShortcut = (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === this.shortcut.toLowerCase()) {
      e.preventDefault();
      this.toggle();
    }
  };

  private handleEscape = (e: KeyboardEvent) => {
    if (this.mobileOpen && e.key === "Escape") {
      e.preventDefault();
      this.closeMobile();
    }
  };

  /** Toggle the sidebar: collapse/expand on desktop, open/close the overlay on mobile. */
  toggle() {
    if (this.isMobile) {
      this.mobileOpen ? this.closeMobile() : this.openMobile();
      return;
    }
    this.state = this.state === "expanded" ? "collapsed" : "expanded";
    try {
      globalThis.localStorage?.setItem(this.storageKey, this.state);
    } catch {
      /* storage unavailable: skip persistence */
    }
    this.dispatchEvent(
      new CustomEvent("lv-state-change", { detail: this.state, bubbles: true, composed: true })
    );
  }

  private openMobile() {
    this._returnFocus = document.activeElement;
    this.mobileOpen = true;
    document.addEventListener("keydown", this.handleEscape);
    this.updateComplete.then(() => {
      this.querySelector<HTMLElement>(".lv-sidebar__item")?.focus();
    });
  }

  private closeMobile() {
    this.mobileOpen = false;
    document.removeEventListener("keydown", this.handleEscape);
    if (this._returnFocus && "focus" in this._returnFocus) {
      (this._returnFocus as HTMLElement).focus();
    }
    this._returnFocus = null;
  }

  private toggleSub(key: string) {
    const next = new Set(this.openSubs);
    next.has(key) ? next.delete(key) : next.add(key);
    this.openSubs = next;
  }

  private activate(item: SidebarMenuItem, e: Event) {
    if (item.disabled) {
      e.preventDefault();
      return;
    }
    if (item.items && item.items.length > 0) {
      e.preventDefault();
      this.toggleSub(item.key);
      return;
    }
    this.dispatchEvent(
      new CustomEvent("lv-navigate", { detail: item.key, bubbles: true, composed: true })
    );
    if (this.isMobile) this.closeMobile();
  }

  private renderIcon(name?: string) {
    if (!name) return nothing;
    const body = iconBody(name);
    if (!body) return nothing;
    return html`<span class="lv-sidebar__icon" aria-hidden="true"
      ><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
        stroke-linecap="round" stroke-linejoin="round">${unsafeSVG(body)}</svg
    ></span>`;
  }

  private renderItem(item: SidebarMenuItem, depth: number): TemplateResult {
    const isCurrent = item.key === this.active;
    const hasSub = !!item.items && item.items.length > 0;
    const subOpen = this.openSubs.has(item.key);
    const tag = item.href && !hasSub ? "a" : "button";
    const inner = html`
      ${this.renderIcon(item.icon)}
      <span class="lv-sidebar__label">${item.label}</span>
      ${item.badge ? html`<span class="lv-sidebar__badge">${item.badge}</span>` : nothing}
      ${hasSub
        ? html`<button
            class="lv-sidebar__sub-toggle ${subOpen ? "lv-sidebar__sub-toggle--open" : ""}"
            type="button"
            tabindex="-1"
            aria-hidden="true"
            @click=${(e: Event) => { e.stopPropagation(); this.toggleSub(item.key); }}
            ><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
              stroke-linecap="round" stroke-linejoin="round">${unsafeSVG(iconBody("chevron-right"))}</svg
          ></button>`
        : nothing}
    `;

    const commonAttrs = {
      class: "lv-sidebar__item",
      "aria-current": isCurrent ? "page" : nothing,
      "aria-disabled": item.disabled ? "true" : nothing,
      "aria-expanded": hasSub ? String(subOpen) : nothing,
    };

    const li = tag === "a"
      ? html`<a
          class=${commonAttrs.class}
          href=${item.href!}
          aria-current=${commonAttrs["aria-current"]}
          aria-disabled=${commonAttrs["aria-disabled"]}
          @click=${(e: Event) => this.activate(item, e)}
          >${inner}</a
        >`
      : html`<button
          class=${commonAttrs.class}
          type="button"
          ?disabled=${item.disabled}
          aria-current=${commonAttrs["aria-current"]}
          aria-disabled=${commonAttrs["aria-disabled"]}
          aria-expanded=${commonAttrs["aria-expanded"]}
          @click=${(e: Event) => this.activate(item, e)}
          >${inner}</button
        >`;

    return html`
      <li>
        ${li}
        ${hasSub && subOpen
          ? html`<ul class="lv-sidebar__sub">
              ${item.items!.map((sub) => this.renderItem(sub, depth + 1))}
            </ul>`
          : nothing}
      </li>
    `;
  }

  render() {
    const collapsed = this.state === "collapsed";
    const panel = html`
      <nav
        class="lv-sidebar lv-sidebar--${this.side} lv-sidebar--${this.collapsible}
          ${collapsed && !this.isMobile ? "lv-sidebar--collapsed" : ""}
          ${this.isMobile && this.mobileOpen ? "lv-sidebar--open" : ""}"
        aria-label=${this.label}
        data-state=${this.isMobile ? (this.mobileOpen ? "open" : "closed") : this.state}
      >
        ${this.heading || this.querySelector('[slot="header"]')
          ? html`<div class="lv-sidebar__header">
              <slot name="header">${this.heading ? html`<h2 class="lv-sidebar__heading lv-sidebar__label">${this.heading}</h2>` : nothing}</slot>
            </div>`
          : nothing}
        <div class="lv-sidebar__content">
          ${this.groups.map(
            (group) => html`
              <div class="lv-sidebar__group" role="group" aria-label=${group.label ?? nothing}>
                ${group.label ? html`<div class="lv-sidebar__group-label">${group.label}</div>` : nothing}
                <ul class="lv-sidebar__menu">
                  ${group.items.map((item) => this.renderItem(item, 0))}
                </ul>
              </div>
            `
          )}
        </div>
        ${this.querySelector('[slot="footer"]')
          ? html`<div class="lv-sidebar__footer"><slot name="footer"></slot></div>`
          : nothing}
      </nav>
    `;

    if (this.isMobile) {
      return html`
        <div class="lv-sidebar--mobile" style="display:contents">
          <div
            class="lv-sidebar__backdrop ${this.mobileOpen ? "lv-sidebar__backdrop--open" : ""}"
            aria-hidden="true"
            @click=${() => this.closeMobile()}
          ></div>
          ${panel}
        </div>
      `;
    }
    return panel;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "lv-sidebar": LvSidebar;
  }
}
