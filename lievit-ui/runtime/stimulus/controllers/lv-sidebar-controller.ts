/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * `lv-sidebar` -- the application sidebar collapse / off-canvas behaviour, as a Stimulus controller
 * (the conversion of `registry/jte/sidebar.enhancer.ts`). Mounted on the sidebar ROOT via
 * `data-controller="lv-sidebar"`. The <nav> landmark, the real <a href> items, groups, sub-items
 * and `aria-current` are all server-rendered HTML; this controller ONLY toggles the
 * collapsed/expanded rail on desktop and the off-canvas overlay on mobile.
 *
 * It is the SHADCN-DOM-NAMESPACE exemplar: every hook is a shadcn `data-slot` / `data-sidebar`
 * attribute (the hamburger namespace bug was a regression to `data-lv-*`; do not reintroduce it).
 *
 * It is the UNCONTROLLED exemplar: narrowing your own sidebar is pure client cosmetic, so it never
 * round-trips the wire ({@link DismissableController.dismissViaWire} is never called; there is no
 * `data-lv-wire-close`). The desktop collapsed/expanded choice persists to localStorage under the
 * root's `data-storage-key`; mobile open/close is transient.
 *
 * Wiring (CSP-clean, NOT inline handlers):
 * - trigger + rail: `data-action="click->lv-sidebar#toggle"` (element events -> data-action)
 * - backdrop: `data-action="click->lv-sidebar#closeMobile"`
 * - Cmd/Ctrl+B (shadcn shortcut) + Escape: a DOCUMENT-level keydown listener bound in `connect()`
 *   and removed in `disconnect()` (the documented Stimulus pattern for global shortcuts; element
 *   `data-action` cannot express a document-scoped key chord). Morph-safe: disconnect tears it down.
 *
 * Morph-safety: Stimulus binds `connect()` once and the declared `data-action`s survive the wire
 * morph automatically (its action observer re-binds re-rendered descendants). No
 * `data-sidebar-enhanced` marker, no stacked document listeners -- the round-2 listener-stacking
 * bug class is structurally impossible because Stimulus owns connect/disconnect.
 */

import { DismissableController } from "../base/dismissable-controller.js";

const STYLE_ID = "lv-sidebar-styles";
const MOBILE_MAX = 768;

/** The stateful rules inline styles cannot express (data-state / mobile selectors). */
const STYLES = `
.lv-sidebar-root { height: 100%; }
.lv-sidebar { position: relative; width: 16rem; transition: width 0.2s ease; }
.lv-sidebar-root[data-side="left"] .lv-sidebar { border-right: 1px solid var(--lv-color-sidebar-border); }
.lv-sidebar-root[data-side="right"] .lv-sidebar { border-left: 1px solid var(--lv-color-sidebar-border); }
.lv-sidebar-item:hover { background: var(--lv-color-sidebar-accent); color: var(--lv-color-sidebar-accent-fg); }
.lv-sidebar-item:focus-visible { outline: none; box-shadow: var(--lv-ring); }
.lv-sidebar-trigger:focus-visible { outline: none; box-shadow: var(--lv-ring); }
.lv-sidebar-trigger:hover { background: var(--lv-color-sidebar-accent); }
details[data-sidebar="disclosure"][open] > summary .lv-sidebar-chevron { transform: rotate(90deg); }
.lv-sidebar-menu-action:hover, .lv-sidebar-group-action:hover { background: var(--lv-color-sidebar-accent); color: var(--lv-color-sidebar-accent-fg); }
.lv-sidebar-menu-action:focus-visible, .lv-sidebar-group-action:focus-visible { outline: none; box-shadow: var(--lv-ring); }
.lv-sidebar-action-hover { opacity: 0; transition: opacity 0.15s ease; }
li[data-slot="sidebar-menu-item"]:hover .lv-sidebar-action-hover,
li[data-slot="sidebar-menu-item"]:focus-within .lv-sidebar-action-hover { opacity: 1; }
.lv-sidebar-rail { transition: background 0.15s ease; }
.lv-sidebar-root[data-side="left"] .lv-sidebar-rail { right: 0; }
.lv-sidebar-root[data-side="right"] .lv-sidebar-rail { left: 0; }
.lv-sidebar-rail:hover { background: var(--lv-color-sidebar-border); }
.lv-sidebar-root[data-variant="none"] .lv-sidebar { border: 0; }
.lv-sidebar-root[data-variant="floating"] .lv-sidebar,
.lv-sidebar-root[data-variant="inset"] .lv-sidebar {
  margin: var(--lv-space-2); height: calc(100% - (var(--lv-space-2) * 2));
  border: 1px solid var(--lv-color-sidebar-border); border-radius: var(--lv-radius-lg);
  box-shadow: var(--lv-shadow-sm);
}
.lv-sidebar-root[data-variant="inset"] ~ .lv-sidebar-inset,
.lv-sidebar-root[data-variant="inset"] + .lv-sidebar-inset {
  margin: var(--lv-space-2); border-radius: var(--lv-radius-lg); box-shadow: var(--lv-shadow-sm);
}
.lv-sidebar-root[data-state="collapsed"] .lv-sidebar { width: 3.25rem; }
.lv-sidebar-root[data-state="collapsed"] .lv-sidebar-collapsible { display: none; }
.lv-sidebar-root[data-state="collapsed"] .lv-sidebar-item { justify-content: center; }
.lv-sidebar-root[data-state="collapsed"] .lv-sidebar-sub { display: none; }
@media (max-width: ${MOBILE_MAX}px) {
  .lv-sidebar-root .lv-sidebar {
    position: fixed; top: 0; bottom: 0; z-index: calc(var(--lv-z-modal, 9500) + 1);
    width: min(85vw, 18rem); transform: translateX(-100%); transition: transform 0.2s ease;
    box-shadow: var(--lv-shadow-lg);
  }
  .lv-sidebar-root[data-side="right"] .lv-sidebar { left: auto; right: 0; transform: translateX(100%); }
  .lv-sidebar-root[data-side="left"] .lv-sidebar { left: 0; }
  .lv-sidebar-root[data-mobile-open] .lv-sidebar { transform: translateX(0); }
  .lv-sidebar-root[data-mobile-open] .lv-sidebar-backdrop { display: block !important; }
  .lv-sidebar-rail { display: none; }
  .lv-sidebar-root[data-variant="floating"] .lv-sidebar,
  .lv-sidebar-root[data-variant="inset"] .lv-sidebar { margin: 0; height: 100%; border-radius: 0; }
  .lv-sidebar-root[data-state="collapsed"] .lv-sidebar { width: min(85vw, 18rem); }
  .lv-sidebar-root[data-state="collapsed"] .lv-sidebar-collapsible { display: revert; }
}
`;

type DesktopState = "expanded" | "collapsed";

export default class LvSidebarController extends DismissableController<HTMLElement> {
  static targets = ["trigger"];

  declare readonly hasTriggerTarget: boolean;
  declare readonly triggerTarget: HTMLButtonElement;

  private readonly keyHandler = (e: KeyboardEvent): void => this.onKeydown(e);

  connect(): void {
    this.ensureStyles();
    // Hydrate the persisted desktop choice over the SSR data-state.
    const saved = this.persisted();
    if (saved != null) {
      this.setDesktopState(saved);
    }
    document.addEventListener("keydown", this.keyHandler);
  }

  disconnect(): void {
    document.removeEventListener("keydown", this.keyHandler);
  }

  /**
   * The single lever the trigger, the rail, and Cmd/Ctrl+B share (shadcn `toggleSidebar`):
   * off-canvas overlay on mobile, collapsed rail on desktop (persisting the desktop choice).
   */
  toggle(): void {
    if (this.isMobile()) {
      if (this.element.hasAttribute("data-mobile-open")) {
        this.closeMobile();
      } else {
        this.openMobile();
      }
      return;
    }
    const next: DesktopState =
      this.element.getAttribute("data-state") === "collapsed" ? "expanded" : "collapsed";
    this.setDesktopState(next);
    this.persist(next);
  }

  /** Open the mobile off-canvas overlay; remember the element to return focus to. */
  openMobile(): void {
    this.element.setAttribute("data-mobile-open", "");
    this.captureReturnFocus();
    this.element
      .querySelector<HTMLElement>('[data-slot="sidebar-menu-button"]')
      ?.focus();
  }

  /** Close the mobile off-canvas overlay; return focus to the opener (fallback: the trigger). */
  closeMobile(): void {
    if (!this.element.hasAttribute("data-mobile-open")) {
      return;
    }
    this.element.removeAttribute("data-mobile-open");
    this.restoreReturnFocus();
    if (document.activeElement === document.body && this.hasTriggerTarget) {
      this.triggerTarget.focus();
    }
  }

  /**
   * The document-level keyboard handler bound in {@link connect}: Cmd/Ctrl+B toggles the sidebar
   * (shadcn SIDEBAR_KEYBOARD_SHORTCUT = "b"); Escape closes the mobile overlay when it is open.
   */
  private onKeydown(e: KeyboardEvent): void {
    if ((e.key === "b" || e.key === "B") && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      this.toggle();
      return;
    }
    if (e.key === "Escape" && this.element.hasAttribute("data-mobile-open")) {
      e.preventDefault();
      this.closeMobile();
    }
  }

  // --- internals -----------------------------------------------------------------------------

  private setDesktopState(state: DesktopState): void {
    this.element.setAttribute("data-state", state);
    if (this.hasTriggerTarget) {
      this.triggerTarget.setAttribute("aria-expanded", state === "expanded" ? "true" : "false");
    }
  }

  private isMobile(): boolean {
    return globalThis.matchMedia?.(`(max-width: ${MOBILE_MAX}px)`).matches ?? false;
  }

  private get storageKey(): string | null {
    return this.element.getAttribute("data-storage-key");
  }

  private persisted(): DesktopState | null {
    const key = this.storageKey;
    if (key == null) {
      return null;
    }
    try {
      const v = globalThis.localStorage?.getItem(key);
      return v === "collapsed" || v === "expanded" ? v : null;
    } catch {
      return null; // storage unavailable (private mode / SSR)
    }
  }

  private persist(state: DesktopState): void {
    const key = this.storageKey;
    if (key == null) {
      return;
    }
    try {
      globalThis.localStorage?.setItem(key, state);
    } catch {
      /* storage unavailable: skip persistence */
    }
  }

  private ensureStyles(): void {
    if (document.getElementById(STYLE_ID) != null) {
      return;
    }
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = STYLES;
    document.head.appendChild(style);
  }
}
