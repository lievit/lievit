/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * `lv-hover-card` -- the WAI-ARIA APG Tooltip hover-card, as a Stimulus controller (the conversion
 * of `runtime/features/hover-card.enhancer.ts`). Mounted on the trigger WRAPPER via
 * `data-controller="lv-hover-card"`; the wrapper already carries the established lievit contract the
 * controller reads as plain server-rendered data (no Stimulus values to keep the template + golden
 * tests speaking the same attributes the enhancer did):
 *
 * - `data-card-id="<panelId>"`        -- the matching `[popover="manual"][role="tooltip"]` panel.
 * - `data-delay="<ms>"`               -- hover open-delay (default 300).
 * - `data-close-delay="<ms>"`         -- hover/grace close-delay (default 150).
 * - `data-open-on-focus="true|false"` -- whether keyboard focus also opens the card.
 *
 * The three irreducible client concerns the enhancer owned, carried through unchanged:
 *  1. **Show/hide timing with grace delay** -- `pointerenter`/`pointerleave` on the wrapper run the
 *     open/close timers; `pointerenter` on the PANEL cancels the close timer (cursor travelling from
 *     trigger to card keeps it open); `pointerleave` on the panel restarts it.
 *  2. **Focus-open path** -- `focusin` shows immediately (APG keyboard immediacy), `focusout` starts
 *     the close timer; suppressed entirely when `data-open-on-focus="false"`.
 *  3. **Esc dismiss** -- a document capture-phase keydown listener (active only while open) hides the
 *     panel and `stopPropagation()`s so Esc does not bubble to a surrounding dialog/drawer. Focus
 *     stays on the trigger (non-modal); focus NEVER enters the card (APG Tooltip).
 *
 * Controlled/uncontrolled doctrine: a hover-card is the degenerate UNCONTROLLED case -- its open
 * state is pure ephemeral client state, it round-trips the wire ZERO times by design (the card body
 * is fully server-rendered at page load). This controller therefore extends plain {@link Controller}
 * and never imports the wire bridge: zero `/lievit/<id>/call` is guaranteed by construction, which
 * is exactly what the doctrine requires of an uncontrolled surface. It also takes no focus into the
 * card, so it needs neither {@link FocusTrap} nor the return-focus helpers.
 *
 * Morph-safety: every listener is bound in `connect()` (object-identity handlers stored as fields)
 * and mirrored in `disconnect()`, where the pending timers are cleared and an open panel is hidden.
 * Stimulus connects this controller once per element+identifier and disconnects it when a wire morph
 * drops the wrapper, so the `WeakSet`-of-wired-wrappers + `afterCall` teardown sweep the enhancer
 * carried are gone -- Stimulus owns the lifecycle.
 *
 * The `aria-describedby` relationship and the panel's static `role="tooltip"` are emitted
 * unconditionally by the server templates and are NOT touched here (SR users get the description
 * without JS). `data-open` on the panel is the observable open-state proxy (the `:popover-open`
 * pseudo-class is un-queryable in jsdom/happy-dom).
 *
 * a11y source: WAI-ARIA APG Tooltip -- https://www.w3.org/WAI/ARIA/apg/patterns/tooltip/
 */

import { Controller } from "@hotwired/stimulus";

const CARD_ID_ATTR = "data-card-id";
const DELAY_ATTR = "data-delay";
const CLOSE_DELAY_ATTR = "data-close-delay";
const OPEN_ON_FOCUS_ATTR = "data-open-on-focus";
const DATA_OPEN_ATTR = "data-open";

/** Default show delay (ms) when the attribute is absent or not a finite number. */
const DEFAULT_DELAY_MS = 300;

/** Default close/grace delay (ms) when the attribute is absent or not a finite number. */
const DEFAULT_CLOSE_DELAY_MS = 150;

/** Parse an integer data-attribute, returning `fallback` on absence or NaN. */
function intAttr(el: Element, name: string, fallback: number): number {
  const raw = el.getAttribute(name);
  if (raw == null) {
    return fallback;
  }
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : fallback;
}

export default class LvHoverCardController extends Controller<HTMLElement> {
  /** The card panel resolved from `data-card-id`, or null when no matching element exists. */
  private panel: HTMLElement | null = null;
  private delay = DEFAULT_DELAY_MS;
  private closeDelay = DEFAULT_CLOSE_DELAY_MS;
  private openOnFocus = true;

  private open = false;
  private showTimer: ReturnType<typeof setTimeout> | null = null;
  private closeTimer: ReturnType<typeof setTimeout> | null = null;

  // Object-identity handlers stored once so disconnect() can remove the exact references.
  private readonly onTriggerEnter = (): void => this.handleTriggerEnter();
  private readonly onTriggerLeave = (): void => this.handleTriggerLeave();
  private readonly onFocusIn = (): void => this.handleFocusIn();
  private readonly onFocusOut = (): void => this.handleFocusOut();
  private readonly onPanelEnter = (): void => this.cancelClose();
  private readonly onPanelLeave = (): void => this.handlePanelLeave();
  private readonly onDocKeydown = (e: KeyboardEvent): void => this.handleEscape(e);

  connect(): void {
    this.delay = intAttr(this.element, DELAY_ATTR, DEFAULT_DELAY_MS);
    this.closeDelay = intAttr(this.element, CLOSE_DELAY_ATTR, DEFAULT_CLOSE_DELAY_MS);
    this.openOnFocus = this.element.getAttribute(OPEN_ON_FOCUS_ATTR) !== "false";

    const cardId = this.element.getAttribute(CARD_ID_ATTR);
    this.panel =
      cardId != null && cardId.length > 0
        ? document.getElementById(cardId)
        : null;

    // Trigger wrapper events are the controller element's OWN native events -> bind in connect().
    this.element.addEventListener("pointerenter", this.onTriggerEnter);
    this.element.addEventListener("pointerleave", this.onTriggerLeave);
    this.element.addEventListener("focusin", this.onFocusIn);
    this.element.addEventListener("focusout", this.onFocusOut);

    // Panel hover-grace: the panel is a SEPARATE element (referenced by id, not a descendant of the
    // controller root), so its events cannot ride a template data-action -> bind them here.
    if (this.panel != null) {
      this.panel.addEventListener("pointerenter", this.onPanelEnter);
      this.panel.addEventListener("pointerleave", this.onPanelLeave);
    }

    // Esc is a document-global capture listener (the enhancer used capture + stopPropagation so Esc
    // does not bubble to a parent dialog); guarded by `open` so a closed card lets Esc pass through.
    document.addEventListener("keydown", this.onDocKeydown, true);
  }

  disconnect(): void {
    this.element.removeEventListener("pointerenter", this.onTriggerEnter);
    this.element.removeEventListener("pointerleave", this.onTriggerLeave);
    this.element.removeEventListener("focusin", this.onFocusIn);
    this.element.removeEventListener("focusout", this.onFocusOut);
    if (this.panel != null) {
      this.panel.removeEventListener("pointerenter", this.onPanelEnter);
      this.panel.removeEventListener("pointerleave", this.onPanelLeave);
    }
    document.removeEventListener("keydown", this.onDocKeydown, true);

    this.cancelShow();
    this.cancelClose();
    // Best-effort: hide a still-open panel so a morph that drops the wrapper leaves no orphan card.
    if (this.open) {
      this.hidePanel();
    }
    this.panel = null;
  }

  // --- show / hide ----------------------------------------------------------------------------

  private showPanel(): void {
    this.cancelClose();
    if (this.open || this.panel == null) {
      return;
    }
    this.open = true;
    this.panel.showPopover();
    this.panel.setAttribute(DATA_OPEN_ATTR, "");
  }

  private hidePanel(): void {
    this.cancelShow();
    if (!this.open || this.panel == null) {
      return;
    }
    this.open = false;
    this.panel.hidePopover();
    this.panel.removeAttribute(DATA_OPEN_ATTR);
  }

  private cancelShow(): void {
    if (this.showTimer != null) {
      clearTimeout(this.showTimer);
      this.showTimer = null;
    }
  }

  private cancelClose(): void {
    if (this.closeTimer != null) {
      clearTimeout(this.closeTimer);
      this.closeTimer = null;
    }
  }

  private scheduleClose(): void {
    this.cancelShow();
    if (this.open) {
      this.closeTimer = setTimeout(() => {
        this.closeTimer = null;
        this.hidePanel();
      }, this.closeDelay);
    }
  }

  // --- trigger wrapper ------------------------------------------------------------------------

  private handleTriggerEnter(): void {
    this.cancelClose();
    if (!this.open) {
      this.showTimer = setTimeout(() => {
        this.showTimer = null;
        this.showPanel();
      }, this.delay);
    }
  }

  private handleTriggerLeave(): void {
    this.scheduleClose();
  }

  private handleFocusIn(): void {
    if (!this.openOnFocus) {
      return;
    }
    this.cancelClose();
    this.showPanel(); // immediate on focus (APG keyboard convention)
  }

  private handleFocusOut(): void {
    if (!this.openOnFocus) {
      return;
    }
    this.scheduleClose();
  }

  // --- panel hover-grace ----------------------------------------------------------------------

  private handlePanelLeave(): void {
    this.scheduleClose();
  }

  // --- Esc dismiss ----------------------------------------------------------------------------

  private handleEscape(e: KeyboardEvent): void {
    if (!this.open || e.key !== "Escape") {
      return;
    }
    e.stopPropagation(); // non-modal: do not let Esc reach a surrounding dialog/drawer
    this.hidePanel();
  }
}
