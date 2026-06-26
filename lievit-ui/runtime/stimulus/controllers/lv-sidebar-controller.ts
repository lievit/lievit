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
 * - external topbar opener `[data-lv-sidebar-open]`: lives OUTSIDE the controller's element scope (in
 *   the page chrome), where the off-canvas nav is translated off-screen on mobile, so it stays the
 *   only reachable OPEN affordance. Stimulus `data-action` cannot reach it (out of scope), so
 *   `connect()` binds it explicitly (matched to THIS root by its `aria-controls` = the nav id) and
 *   `disconnect()` tears it down. Its `aria-expanded` mirrors the open/closed state. This is what
 *   lets a consumer delete its forked sidebar enhancer and rely solely on this controller.
 * - Cmd/Ctrl+B (shadcn shortcut): a DOCUMENT-level keydown listener bound in `connect()` and removed
 *   in `disconnect()` (the documented Stimulus pattern for global shortcuts; element `data-action`
 *   cannot express a document-scoped key chord). Morph-safe: disconnect tears it down.
 * - off-canvas open (mobile): a shared {@link FocusTrap} (the 1.2.0 a11y foundation) gives the panel
 *   Tab cycling + body scroll-lock + return-focus-to-opener, with Escape closing via its `onEscape`.
 *
 * Morph-safety: Stimulus binds `connect()` once and the declared `data-action`s survive the wire
 * morph automatically (its action observer re-binds re-rendered descendants). No
 * `data-sidebar-enhanced` marker, no stacked document listeners -- the round-2 listener-stacking
 * bug class is structurally impossible because Stimulus owns connect/disconnect.
 */

import { DismissableController } from "../base/dismissable-controller.js";
import { FocusTrap } from "../base/focus-trap.js";

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
/* Collapsed (desktop) FULLY hides the rail (Francesco): width 0, not a 3.25rem icon rail. The only
   reachable re-open affordance is then the external topbar opener, shown on desktop while collapsed. */
.lv-sidebar-root[data-state="collapsed"] .lv-sidebar { width: 0; overflow: hidden; border: 0; }
.lv-sidebar-root[data-state="collapsed"] .lv-sidebar-collapsible { display: none; }
.lv-sidebar-root[data-state="collapsed"] .lv-sidebar-item { justify-content: center; }
.lv-sidebar-root[data-state="collapsed"] .lv-sidebar-sub { display: none; }
/* The external topbar opener: shown at/below the mobile breakpoint (the only affordance to open the
   off-canvas drawer) AND on desktop while the rail is fully collapsed-hidden (the doc-level flag the
   controller toggles), where the in-sidebar trigger has ridden to width 0. */
.lv-sidebar-mobile-open-trigger { display: none; }
:root[data-lv-sidebar-collapsed] .lv-sidebar-mobile-open-trigger { display: inline-flex; }
@media (max-width: ${MOBILE_MAX}px) {
  .lv-sidebar-mobile-open-trigger { display: inline-flex; }
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

  /** The active off-canvas focus trap (Tab cycling + scroll-lock + return-focus); null when closed. */
  private trap: FocusTrap | null = null;

  /** External topbar openers bound in connect(), tracked so disconnect() can tear them down. */
  private boundOpeners: { el: HTMLElement; handler: () => void }[] = [];

  connect(): void {
    this.ensureStyles();
    // Hydrate the persisted desktop choice over the SSR data-state.
    const saved = this.persisted();
    if (saved != null) {
      this.setDesktopState(saved);
    }
    document.addEventListener("keydown", this.keyHandler);
    this.bindOpeners();
  }

  disconnect(): void {
    document.removeEventListener("keydown", this.keyHandler);
    for (const { el, handler } of this.boundOpeners) {
      el.removeEventListener("click", handler);
    }
    this.boundOpeners = [];
    // Release the body scroll-lock if the root is torn down (e.g. a morph) while still open.
    this.trap?.deactivate();
    this.trap = null;
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

  /**
   * Open the mobile off-canvas overlay. The shared {@link FocusTrap} over the nav panel does the
   * a11y heavy lifting (the 1.2.0 foundation): it captures the opener as the return target, locks
   * body scroll, traps Tab within the panel, and closes on Escape. Initial focus is moved to the
   * first nav entry (so the trap does not steal it onto the collapse trigger).
   */
  openMobile(): void {
    if (this.element.hasAttribute("data-mobile-open")) {
      return;
    }
    this.element.setAttribute("data-mobile-open", "");
    this.syncOpeners(true);
    const panel = this.panel();
    if (panel != null) {
      this.trap = new FocusTrap(panel, {
        trap: true,
        moveInitialFocus: false,
        onEscape: () => this.closeMobile(),
      });
      this.trap.activate();
    }
    this.element
      .querySelector<HTMLElement>('[data-slot="sidebar-menu-button"]')
      ?.focus();
  }

  /** Close the mobile off-canvas overlay; the trap releases scroll-lock + returns focus to the opener. */
  closeMobile(): void {
    if (!this.element.hasAttribute("data-mobile-open")) {
      return;
    }
    this.element.removeAttribute("data-mobile-open");
    this.syncOpeners(false);
    this.trap?.deactivate();
    this.trap = null;
    if (document.activeElement === document.body && this.hasTriggerTarget) {
      this.triggerTarget.focus();
    }
  }

  /**
   * The document-level keyboard handler bound in {@link connect}: Cmd/Ctrl+B toggles the sidebar
   * (shadcn SIDEBAR_KEYBOARD_SHORTCUT = "b"). Escape-to-close while the off-canvas is open is owned
   * by the active {@link FocusTrap} (its `onEscape`), so it is not duplicated here.
   */
  private onKeydown(e: KeyboardEvent): void {
    if ((e.key === "b" || e.key === "B") && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      this.toggle();
    }
  }

  // --- external topbar opener ([data-lv-sidebar-open]) -----------------------------------------

  /** The off-canvas panel (the `<nav data-slot="sidebar">` landmark): the focus-trap container. */
  private panel(): HTMLElement | null {
    return this.element.querySelector<HTMLElement>('[data-slot="sidebar"]');
  }

  /** The nav id this root's external openers reference via `aria-controls`. */
  private get navId(): string | null {
    const id = this.panel()?.id;
    return id != null && id.length > 0 ? id : null;
  }

  /**
   * External `[data-lv-sidebar-open]` openers that target THIS root. An opener points at the root via
   * `aria-controls` (the nav id); with none, it targets the page's lone sidebar (a panel shell has
   * exactly one). Scoped to the owner document so a test's fragment is seen.
   */
  private openersFor(): HTMLButtonElement[] {
    const doc = this.element.ownerDocument;
    const all = Array.from(doc.querySelectorAll<HTMLButtonElement>("[data-lv-sidebar-open]"));
    const navId = this.navId;
    return all.filter((b) => {
      const controls = b.getAttribute("aria-controls");
      if (controls != null && controls.length > 0) {
        return controls === navId;
      }
      return doc.querySelectorAll('[data-sidebar="root"]').length === 1;
    });
  }

  /** Bind each external opener's click to the shared toggle (tracked for disconnect). */
  private bindOpeners(): void {
    for (const opener of this.openersFor()) {
      // Mobile: open/close the off-canvas drawer. Desktop: the opener is the ONLY re-open affordance
      // for the fully-hidden collapsed rail (width 0), so it toggles collapsed<->expanded. toggle()
      // already branches on isMobile(), so the one lever serves both.
      const handler = (): void => this.toggle();
      opener.addEventListener("click", handler);
      this.boundOpeners.push({ el: opener, handler });
    }
  }

  /** Mirror the open/closed state onto every external opener's `aria-expanded`. */
  private syncOpeners(open: boolean): void {
    const v = open ? "true" : "false";
    for (const opener of this.openersFor()) {
      opener.setAttribute("aria-expanded", v);
    }
  }

  // --- internals -----------------------------------------------------------------------------

  private setDesktopState(state: DesktopState): void {
    this.element.setAttribute("data-state", state);
    // Doc-level flag so the external topbar opener (outside this root's scope) can reveal itself on
    // desktop while the rail is fully collapsed-hidden, the only way back to expanded.
    document.documentElement.toggleAttribute("data-lv-sidebar-collapsed", state === "collapsed");
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
