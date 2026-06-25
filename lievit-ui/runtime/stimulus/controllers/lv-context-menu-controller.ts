/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * `lv-context-menu` -- the right-click floating `role="menu"` panel, as a Stimulus controller (the
 * conversion of `runtime/features/context-menu-trigger.enhancer.ts`). Mounted on the component ROOT
 * via `data-controller="lv-context-menu"` (the `data-slot="context-menu"` wrapper that holds both
 * the trigger region and the conditionally-present panel), so one controller owns the whole open /
 * position / dismiss lifecycle.
 *
 * The irreducible client bits the server cannot express:
 * 1. **right-click interception**: the native `contextmenu` event on the trigger is `preventDefault`-ed
 *    (suppresses the browser's own menu), the pointer coordinates are stamped on the panel as
 *    integer `data-menu-x` / `data-menu-y` (read by `context-menu.css` via `attr()`, CSP-clean: no
 *    inline style), and focus moves to the panel (collection-nav then takes over arrow roving).
 * 2. **keyboard-invoked open** (APG: ContextMenu key / Shift+F10): positions the panel at the
 *    trigger's bounding-rect corner instead of pointer coordinates.
 * 3. **light-dismiss**: a `mousedown` outside the open panel, or Escape, closes it.
 * 4. **focus restore**: the element focused when the menu opened is restored on close (the base's
 *    capture/restore pair -- the shared return-focus seam, not a re-rolled trap; arrow roving inside
 *    the open menu is owned by collection-nav, so this is a LIGHT surface, never a Tab trap).
 *
 * Controlled / uncontrolled doctrine (carried through unchanged, lives in the base): the menu fires
 * a wire round-trip on close ONLY when it is wire-CONTROLLED -- the template stamps
 * `data-lv-wire-close` on the root ONLY when the open state is server-owned (the caller bound `open`
 * to its own `@Wire` field). The default UNCONTROLLED menu closes purely client-side with ZERO
 * `/lievit/<id>/call` (the wire-410 page-expired fix). {@link DismissableController.dismissViaWire}
 * decides; this controller never hardcodes a `"close"` fallback.
 *
 * Morph-safety: the trigger's `contextmenu` / `keydown` are declared as `data-action` in the
 * template, so Stimulus re-binds them automatically when the wire morph re-renders the trigger. The
 * document-global Escape / outside-mousedown listeners are bound in `connect()` and torn down in
 * `disconnect()` -- Stimulus owns connect/disconnect across the morph + idiomorph + Turbo Drive, so
 * the hand-rolled `data-lv-ctx-wired` markers and the refcounted document-listener bookkeeping are
 * gone (no `WeakSet`, no stacked listeners, no double-fire).
 *
 * shadcn DOM namespace: every hook is `data-slot` (`context-menu` / `context-menu-trigger` /
 * `context-menu-panel`); never regress to `data-lv-*` for those.
 *
 * APG source: https://www.w3.org/WAI/ARIA/apg/patterns/menu/ (verified 2026-06-24).
 */

import { DismissableController } from "../base/dismissable-controller.js";

export default class LvContextMenuController extends DismissableController<HTMLElement> {
  static targets = ["panel"];

  declare readonly hasPanelTarget: boolean;
  declare readonly panelTarget: HTMLElement;

  /** True while this menu's panel is showing (gates Escape / outside-click so a closed menu is inert). */
  private menuOpen = false;

  private readonly onDocKeydown = (e: KeyboardEvent): void => this.handleDocKeydown(e);
  private readonly onDocMousedown = (e: MouseEvent): void => this.handleDocMousedown(e);

  connect(): void {
    // Document-global dismiss listeners: element `data-action` cannot express a document-scoped
    // shortcut, so they are bound here and removed in disconnect() (the documented Stimulus pattern).
    document.addEventListener("keydown", this.onDocKeydown);
    document.addEventListener("mousedown", this.onDocMousedown);
  }

  disconnect(): void {
    document.removeEventListener("keydown", this.onDocKeydown);
    document.removeEventListener("mousedown", this.onDocMousedown);
    this.menuOpen = false;
  }

  /**
   * Right-click on the trigger: suppress the native browser menu, then open the panel at the pointer.
   * Bound via `data-action="contextmenu->lv-context-menu#openFromPointer"` on the trigger region.
   */
  openFromPointer(event: MouseEvent): void {
    event.preventDefault();
    this.captureReturnFocus();
    this.openAt(event.clientX, event.clientY);
  }

  /**
   * APG keyboard affordances (ContextMenu key / Shift+F10): open the panel at the trigger's box.
   * Bound via `data-action="keydown->lv-context-menu#openFromKeyboard"` on the trigger region.
   */
  openFromKeyboard(event: KeyboardEvent): void {
    if (event.key !== "ContextMenu" && !(event.key === "F10" && event.shiftKey)) {
      return;
    }
    event.preventDefault();
    this.captureReturnFocus();
    const trigger = event.currentTarget as HTMLElement;
    const rect = trigger.getBoundingClientRect();
    this.openAt(rect.left, rect.bottom);
  }

  /** Stamp pointer coordinates on the panel (read by context-menu.css) and move focus into it. */
  private openAt(x: number, y: number): void {
    if (!this.hasPanelTarget) {
      return;
    }
    const panel = this.panelTarget;
    panel.setAttribute("data-menu-x", String(Math.round(x)));
    panel.setAttribute("data-menu-y", String(Math.round(y)));
    this.menuOpen = true;
    // collection-nav sets aria-activedescendant to the first item once the panel has focus.
    panel.focus();
  }

  /** Close: clear the coordinate attributes, restore focus, and apply the controlled/uncontrolled doctrine. */
  private close(): void {
    if (!this.menuOpen) {
      return;
    }
    this.menuOpen = false;
    if (this.hasPanelTarget) {
      this.panelTarget.removeAttribute("data-menu-x");
      this.panelTarget.removeAttribute("data-menu-y");
    }
    this.restoreReturnFocus();
    // Doctrine in the base: fires the close action only when data-lv-wire-close is present (controlled);
    // an uncontrolled menu closes client-side with zero wire round-trip.
    this.dismissViaWire(this.element, { trigger: this.element });
  }

  private handleDocKeydown(e: KeyboardEvent): void {
    if (e.key === "Escape") {
      this.close();
    }
  }

  private handleDocMousedown(e: MouseEvent): void {
    if (!this.menuOpen || !this.hasPanelTarget) {
      return;
    }
    const target = e.target;
    if (target instanceof Node && this.panelTarget.contains(target)) {
      return; // a press inside the panel keeps it open
    }
    this.close();
  }
}
