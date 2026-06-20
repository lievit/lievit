/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * overlay enhancer (ADR-0012, server-first): the ONE CSP-clean typed-TS module that gives the whole
 * server-first modal-overlay family -- `dialog`, `sheet`, `drawer`, `alert-dialog` -- the three
 * client behaviours a modal owes by WAI-ARIA APG that the server cannot do (they are pure
 * focus-mechanics, not state): focus-trap, Escape-to-close, and return-focus.
 *
 * The open/closed STATE stays server-owned (the wire `@Wire boolean open`): the overlay root carries
 * the boolean `hidden` attribute, the server flips it on `open`/`close`, the client morphs it. This
 * module never decides open-state and never round-trips the wire to set it. It only:
 *
 *   - **traps Tab** inside `[data-lv-<kind>-panel]` while the overlay is shown (Tab past the last
 *     focusable wraps to the first, Shift+Tab past the first wraps to the last), so keyboard focus
 *     cannot leak to the page behind the modal (APG "Keyboard Interaction" for a modal dialog);
 *   - **routes Escape to the server close path** by clicking the overlay's own dismiss button -- the
 *     real `l:click="close"` / `l:click="cancel"` button the template already renders. Escape thus
 *     takes the SAME path as the button: the runtime's `l:click` directive fires the wire action and
 *     the server re-renders `hidden`. This keeps the enhancer fully decoupled from the wire codec
 *     (it touches no snapshot, no dispatcher) and CSP-clean (it attaches listeners in code; the
 *     strict CSP refuses inline `on*=` handlers). A non-dismissible dialog (no dismiss button)
 *     simply has no Escape target, matching the locked server `dismissible=false`;
 *   - **moves focus in on open and restores it on close**, observing the `hidden` attribute via a
 *     MutationObserver (the server is the only writer of `hidden`, so observing it is how the client
 *     learns the state changed). On open it remembers `document.activeElement` (the trigger) and
 *     focuses the panel's initial element; on close it returns focus to that remembered opener.
 *
 * Initial-focus rule (APG): focus the element marked `[data-lv-autofocus]` if present, else the
 * first focusable in the panel. An alert-dialog is interruptive, so its template marks the CANCEL
 * button `[data-lv-autofocus]` (focus-on-cancel default, the safe choice for a destructive prompt);
 * a plain dialog focuses its first focusable, falling back to the panel itself (`tabindex=-1`).
 *
 * Idempotent: call {@link enhanceOverlay} once per root (it marks each root) and again after a DOM
 * swap; already-enhanced roots are skipped. {@link enhanceAllOverlays} wires every overlay on the
 * page. One module, the whole family: dialog/sheet/drawer/alert-dialog all share these mechanics.
 */

/** The four server-first modal overlays this module enhances (their root data-* hooks). */
const OVERLAY_KINDS = ["dialog", "sheet", "drawer", "alert-dialog"] as const;
type OverlayKind = (typeof OVERLAY_KINDS)[number];

const ENHANCED = "data-lv-overlay-enhanced";
const RETURN_FOCUS = "_lvOverlayReturnFocus";

/** The CSS selector that matches every modal-overlay root (the union of the four kinds). */
const ROOT_SELECTOR = OVERLAY_KINDS.map((k) => `[data-lv-${k}]`).join(",");

/** Elements that can hold keyboard focus inside a panel (the standard focus-trap set). */
const FOCUSABLE =
  'a[href],area[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),' +
  'textarea:not([disabled]),[tabindex]:not([tabindex="-1"]),[contenteditable="true"]';

/** A root augmented with the opener it must return focus to on close. */
type OverlayRoot = HTMLElement & { [RETURN_FOCUS]?: Element | null };

/** The overlay kind of a root (which `data-lv-<kind>` it carries), or null if it is not an overlay. */
function kindOf(root: HTMLElement): OverlayKind | null {
  return OVERLAY_KINDS.find((k) => root.hasAttribute(`data-lv-${k}`)) ?? null;
}

/** The role=dialog|alertdialog panel of an overlay root. */
function panelOf(root: HTMLElement, kind: OverlayKind): HTMLElement | null {
  return root.querySelector<HTMLElement>(`[data-lv-${kind}-panel]`);
}

/**
 * The button whose click runs the server close/cancel path. Prefer an explicit dismiss button
 * (`-close` for dialog/sheet/drawer); an alert-dialog has no `-close`, its Escape routes to
 * `-cancel`. Returns null for a non-dismissible dialog (no dismiss affordance is rendered).
 */
function dismissButtonOf(root: HTMLElement, kind: OverlayKind): HTMLButtonElement | null {
  return (
    root.querySelector<HTMLButtonElement>(`[data-lv-${kind}-close]`) ??
    root.querySelector<HTMLButtonElement>(`[data-lv-${kind}-cancel]`)
  );
}

/** True when the overlay is shown (the server did not set the boolean `hidden`). */
function isOpen(root: HTMLElement): boolean {
  return !root.hasAttribute("hidden");
}

/** The visible, focusable elements inside a panel, in DOM order. */
function focusablesIn(panel: HTMLElement): HTMLElement[] {
  return Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => el.offsetParent !== null || el === document.activeElement
  );
}

/** Move focus to the panel's initial element (its `[data-lv-autofocus]`, else first focusable, else the panel). */
function focusInitial(panel: HTMLElement): void {
  const marked = panel.querySelector<HTMLElement>("[data-lv-autofocus]");
  const target = marked ?? focusablesIn(panel)[0];
  if (target) {
    target.focus();
    return;
  }
  // No focusable child: make the panel itself focusable and focus it (APG fallback).
  if (!panel.hasAttribute("tabindex")) {
    panel.setAttribute("tabindex", "-1");
  }
  panel.focus();
}

/** Return focus to the element that had it when the overlay opened (the trigger). */
function restoreFocus(root: OverlayRoot): void {
  const opener = root[RETURN_FOCUS];
  if (opener instanceof HTMLElement && opener.isConnected) {
    opener.focus();
  }
  root[RETURN_FOCUS] = null;
}

/** Keep Tab within the panel: wrap from last->first (Tab) and first->last (Shift+Tab). */
function trapTab(event: KeyboardEvent, panel: HTMLElement): void {
  const focusables = focusablesIn(panel);
  if (focusables.length === 0) {
    // Nothing focusable: keep focus on the panel, never leak to the page behind.
    event.preventDefault();
    panel.focus();
    return;
  }
  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  const active = document.activeElement;
  if (event.shiftKey && (active === first || !panel.contains(active))) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus();
  }
}

/**
 * Enhance one overlay root: trap Tab + route Escape to the server close path + drive focus on the
 * open<->close transition. No-op if it is already enhanced or not a modal overlay root.
 *
 * @param root a `[data-lv-dialog|sheet|drawer|alert-dialog]` overlay root
 */
export function enhanceOverlay(root: HTMLElement): void {
  if (root.hasAttribute(ENHANCED)) {
    return;
  }
  const kind = kindOf(root);
  if (kind === null) {
    return;
  }
  root.setAttribute(ENHANCED, "");

  const panel = panelOf(root, kind);
  if (panel === null) {
    return;
  }

  // Tab-trap + Escape: a single keydown listener on the root (the panel lives inside it).
  root.addEventListener("keydown", (event: KeyboardEvent) => {
    if (!isOpen(root)) {
      return;
    }
    if (event.key === "Tab") {
      trapTab(event, panel);
      return;
    }
    if (event.key === "Escape") {
      const dismiss = dismissButtonOf(root, kind);
      if (dismiss) {
        // Route Escape through the SAME server path as the button (its l:click action).
        event.preventDefault();
        dismiss.click();
      }
    }
  });

  // Focus management across the server-owned open<->close transition: the server writes `hidden`,
  // we observe it. On open: remember the opener + focus the initial element. On close: restore.
  const holder = root as OverlayRoot;
  const observer = new MutationObserver(() => {
    if (isOpen(root)) {
      if (!holder[RETURN_FOCUS]) {
        holder[RETURN_FOCUS] = document.activeElement;
      }
      focusInitial(panel);
    } else if (holder[RETURN_FOCUS]) {
      restoreFocus(holder);
    }
  });
  observer.observe(root, { attributes: true, attributeFilter: ["hidden"] });

  // If the root mounted already-open (SSR open=true), focus it now without waiting for a mutation.
  if (isOpen(root)) {
    holder[RETURN_FOCUS] = document.activeElement;
    focusInitial(panel);
  }
}

/** Enhance every modal overlay on the page (call on load + after DOM swaps). Idempotent. */
export function enhanceAllOverlays(scope: ParentNode = document): void {
  scope
    .querySelectorAll<HTMLElement>(ROOT_SELECTOR)
    .forEach((root) => enhanceOverlay(root));
}
