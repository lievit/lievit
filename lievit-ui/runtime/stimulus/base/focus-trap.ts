/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * WAI-ARIA APG Dialog Modal focus management, as ONE reusable util (the convergence lever for the
 * v-next a11y delta). Before this, the trap + return-focus logic was re-implemented per overlay
 * (dialog, drawer, sheet, alert-dialog, sidebar) -- the bug surface the architecture contract
 * §2.b calls out. A controller composes it: `new FocusTrap(el, opts).activate()` in `connect`,
 * `.deactivate()` in `disconnect`. It is framework-agnostic (no Stimulus import) so a plain
 * enhancer or a test can use it too.
 *
 * Two independent capabilities, opt in to either:
 * - **trap** (`trap: true`, default): Tab / Shift+Tab cycle within the container; Escape invokes
 *   `onEscape`; `document.body` is scroll-locked while active.
 * - **return-focus** (always): the element focused when {@link FocusTrap.activate} ran is restored
 *   on {@link FocusTrap.deactivate} -- the lightest use (sidebar off-canvas) wants only this.
 *
 * Initial-focus priority (APG): `[data-initial-focus]` > `[autofocus]` > first focusable > the
 * container itself (made programmatically focusable with `tabindex="-1"`).
 *
 * APG source: https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/
 */

/** Options for a {@link FocusTrap}. */
export interface FocusTrapOptions {
  /** Trap Tab cycling + scroll-lock the body while active. Default true. */
  readonly trap?: boolean;
  /** Invoked when Escape is pressed inside an active trap (e.g. fire the close action). */
  readonly onEscape?: () => void;
  /** Move initial focus into the container on activate. Default true. */
  readonly moveInitialFocus?: boolean;
}

/** The highest-priority initial-focus target (alert-dialog cancel button etc.). */
const INITIAL_FOCUS_ATTR = "data-initial-focus";

/**
 * The established lievit marker on the element to focus once a surface is shown: the panel content
 * after a popover opens, the error summary after a form's failed submit. The server stamps it; the
 * client only honours it.
 */
export const AUTOFOCUS_ATTR = "data-lv-autofocus";

/**
 * Moves focus to the first `[data-lv-autofocus]` descendant of `container`, or no-op when there is
 * none. The ONE home of the "focus the server-marked element" behaviour, shared by every surface
 * that opts in (popover panel, form error-summary) so the lookup + the marker name live once.
 *
 * The whole lookup is deferred to a microtask, not just the `focus()` call, because the form's
 * failed-submit path dispatches `lievit:validation-errors` (the focus trigger) BEFORE the morph that
 * adds the marker (#93 effects-then-morph order): a synchronous query would miss it. A microtask runs
 * after the synchronous effects+morph commit, so the marker is in the DOM by then. The popover's open
 * path already has the marker present; deferring is harmless there (focus still lands next microtask).
 *
 * @param container the element whose subtree carries the optional autofocus target
 */
export function focusAutofocusTarget(container: Element): void {
  queueMicrotask(() => {
    container.querySelector<HTMLElement>(`[${AUTOFOCUS_ATTR}]`)?.focus();
  });
}

/**
 * Elements that can receive keyboard focus (DOM spec + ARIA supplement). Layout-based visibility
 * (offsetWidth / getClientRects) is deliberately omitted: happy-dom / jsdom have no layout engine,
 * so a layout check would always report invisible in tests.
 */
const FOCUSABLE_SELECTOR = [
  "a[href]",
  "area[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "button:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
  "[contenteditable]",
].join(", ");

function focusableWithin(container: Element): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
}

/**
 * One focus trap over one container. Idempotent: a second {@link activate} while already active is
 * a no-op; {@link deactivate} after deactivate is a no-op. Reusable across overlays.
 */
export class FocusTrap {
  private active = false;
  private returnTarget: HTMLElement | null = null;
  private savedBodyOverflow = "";
  private readonly keyHandler: (e: KeyboardEvent) => void;
  private readonly trap: boolean;
  private readonly moveInitialFocus: boolean;
  private readonly onEscape?: () => void;

  constructor(
    private readonly container: HTMLElement,
    options: FocusTrapOptions = {},
  ) {
    this.trap = options.trap ?? true;
    this.moveInitialFocus = options.moveInitialFocus ?? true;
    this.onEscape = options.onEscape;
    this.keyHandler = (e) => this.onKeydown(e);
  }

  /** True while the trap is live. */
  get isActive(): boolean {
    return this.active;
  }

  /**
   * Activates the trap: records the return target, moves initial focus in, locks scrolling, and
   * starts listening for Tab / Escape. No-op if already active.
   */
  activate(): void {
    if (this.active) {
      return;
    }
    this.active = true;
    this.returnTarget =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    if (this.moveInitialFocus) {
      this.applyInitialFocus();
    }

    if (this.trap) {
      this.savedBodyOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      document.body.setAttribute("data-lievit-trap-scroll-lock", "");
      document.addEventListener("keydown", this.keyHandler);
    } else if (this.onEscape != null) {
      // return-focus-only mode still wants Escape handling if asked.
      document.addEventListener("keydown", this.keyHandler);
    }
  }

  /**
   * Deactivates the trap: stops listening, restores scrolling, and returns focus to the element
   * that held it when {@link activate} ran. No-op if not active.
   */
  deactivate(): void {
    if (!this.active) {
      return;
    }
    this.active = false;
    document.removeEventListener("keydown", this.keyHandler);

    if (this.trap) {
      document.body.style.overflow = this.savedBodyOverflow;
      document.body.removeAttribute("data-lievit-trap-scroll-lock");
    }

    const target = this.returnTarget;
    this.returnTarget = null;
    if (target != null && typeof target.focus === "function") {
      target.focus();
    }
  }

  private applyInitialFocus(): void {
    const container = this.container;
    const explicit = container.querySelector<HTMLElement>(`[${INITIAL_FOCUS_ATTR}]`);
    if (explicit != null) {
      explicit.focus();
      return;
    }
    const autofocused = container.querySelector<HTMLElement>("[autofocus]");
    if (autofocused != null) {
      autofocused.focus();
      return;
    }
    const first = focusableWithin(container)[0];
    if (first != null) {
      first.focus();
      return;
    }
    if (!container.hasAttribute("tabindex")) {
      container.setAttribute("tabindex", "-1");
    }
    container.focus();
  }

  private onKeydown(e: KeyboardEvent): void {
    if (!this.active) {
      return;
    }
    if (e.key === "Escape") {
      if (this.onEscape != null) {
        e.preventDefault();
        this.onEscape();
      }
      return;
    }
    if (!this.trap || e.key !== "Tab") {
      return;
    }
    const focusable = focusableWithin(this.container);
    if (focusable.length === 0) {
      e.preventDefault();
      return;
    }
    const first = focusable[0]!;
    const last = focusable[focusable.length - 1]!;
    const activeOutside = !this.container.contains(document.activeElement);
    if (e.shiftKey) {
      if (document.activeElement === first || activeOutside) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last || activeOutside) {
        e.preventDefault();
        first.focus();
      }
    }
  }
}
