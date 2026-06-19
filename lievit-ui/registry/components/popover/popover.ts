/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
import { LitElement, html } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { computePosition, flip, shift, offset } from "@floating-ui/dom";
import { adoptLightStyles } from "../light-dom/light-dom.js";

/**
 * `<lv-popover>`: a click-triggered floating panel anchored to a trigger.
 *
 * Follows the WAI-ARIA dialog-popover pattern as Radix implements it
 * (~/workspaces/ui-refs/radix-primitives popover):
 * - Trigger: `aria-haspopup="dialog"`, `aria-expanded`, `aria-controls` (set only
 *   while open, like Radix), `data-state` (open|closed).
 * - Panel: `role="dialog"`, `aria-modal="false"` (a non-modal popover), `data-state`.
 * - Click trigger toggles; Escape closes and returns focus to the trigger;
 *   click/focus outside dismisses (Radix DismissableLayer).
 * - Focus: on open, focus moves into the panel (first focusable, else the panel);
 *   on close, focus returns to the trigger. Optional focus trap (`trap-focus`):
 *   Tab/Shift+Tab cycle within the panel (Radix FocusScope `trapped`).
 *
 * Positioned by `@floating-ui/dom` (offset + flip + shift so it stays in-viewport),
 * exactly like the existing `<lv-dropdown-menu>`. Stacks at `--lv-z-popover`.
 *
 * Usage (slot the trigger in the default slot, the content in slot="content"):
 *   <lv-popover>
 *     <lv-button slot="trigger">Open</lv-button>
 *     <div slot="content">Panel body</div>
 *   </lv-popover>
 *
 * Owned source, copied in by `lievit add popover`. Light-DOM rendered.
 * npm dep: `@floating-ui/dom` (declared in meta.json, installed by `lievit add`).
 */
@customElement("lv-popover")
export class LvPopover extends LitElement {
  /** Preferred panel placement (flips automatically when space is tight). */
  @property() placement:
    | "top"
    | "top-start"
    | "top-end"
    | "bottom"
    | "bottom-start"
    | "bottom-end"
    | "left"
    | "right" = "bottom";

  /** Disables the trigger so the popover cannot open. */
  @property({ type: Boolean }) disabled = false;

  /**
   * Trap focus inside the panel while open (Tab/Shift+Tab cycle within it).
   * Off by default: a popover is non-modal, so trapping is opt-in (Radix default
   * traps, but the lighter default suits a gestionale's inline popovers).
   */
  @property({ type: Boolean, attribute: "trap-focus" }) trapFocus = false;

  @state() private open = false;

  private static seq = 0;
  private readonly panelId = `lv-popover-${LvPopover.seq++}`;

  createRenderRoot(): this {
    adoptLightStyles("lv-popover", LvPopover.css);
    return this;
  }

  static readonly css = `
    .lv-popover { position: relative; display: inline-block; }
    .lv-popover__panel {
      position: fixed;
      z-index: var(--lv-z-popover);
      min-width: 12rem;
      box-sizing: border-box;
      background: var(--lv-color-popover);
      color: var(--lv-color-popover-fg);
      font-family: var(--lv-font-sans);
      font-size: var(--lv-text-sm);
      line-height: var(--lv-leading);
      border: 1px solid var(--lv-color-border);
      border-radius: var(--lv-radius-md);
      box-shadow: var(--lv-shadow-md);
      padding: var(--lv-space-4);
      display: none;
    }
    .lv-popover__panel--open { display: block; }
    .lv-popover__panel:focus-visible { outline: none; box-shadow: var(--lv-ring); }
  `;

  connectedCallback() {
    super.connectedCallback();
    document.addEventListener("mousedown", this.handleOutsideClick);
    document.addEventListener("focusin", this.handleOutsideFocus);
    document.addEventListener("keydown", this.handleGlobalKey);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener("mousedown", this.handleOutsideClick);
    document.removeEventListener("focusin", this.handleOutsideFocus);
    document.removeEventListener("keydown", this.handleGlobalKey);
  }

  private handleOutsideClick = (e: MouseEvent) => {
    if (this.open && !this.contains(e.target as Node)) {
      this.closePopover();
    }
  };

  private handleOutsideFocus = (e: FocusEvent) => {
    // focus leaving the whole component dismisses, matching Radix's onFocusOutside.
    if (this.open && !this.contains(e.target as Node)) {
      this.closePopover();
    }
  };

  private handleGlobalKey = (e: KeyboardEvent) => {
    if (!this.open) return;
    if (e.key === "Escape") {
      e.preventDefault();
      this.closePopover();
      this.focusTrigger();
    }
  };

  private openPopover() {
    if (this.disabled || this.open) return;
    this.open = true;
    this.dispatchEvent(
      new CustomEvent("lv-open", { bubbles: true, composed: true })
    );
    this.updateComplete.then(() => {
      this.position();
      this.focusPanel();
    });
  }

  private closePopover() {
    if (!this.open) return;
    this.open = false;
    this.dispatchEvent(
      new CustomEvent("lv-close", { bubbles: true, composed: true })
    );
  }

  private trigger(): HTMLElement | null {
    return this.querySelector(".lv-popover__trigger") as HTMLElement | null;
  }

  private panel(): HTMLElement | null {
    return this.querySelector(".lv-popover__panel") as HTMLElement | null;
  }

  private focusTrigger() {
    // the focusable trigger is whatever the adopter slotted; fall back to the wrapper.
    const slotted = this.trigger()?.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    (slotted ?? this.trigger())?.focus();
  }

  private focusables(): HTMLElement[] {
    const panel = this.panel();
    if (!panel) return [];
    return Array.from(
      panel.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
    ).filter((el) => !el.hasAttribute("disabled"));
  }

  private focusPanel() {
    const first = this.focusables()[0];
    (first ?? this.panel())?.focus();
  }

  private onPanelKeyDown(e: KeyboardEvent) {
    if (!this.trapFocus || e.key !== "Tab") return;
    const items = this.focusables();
    if (items.length === 0) {
      // nothing tabbable: keep focus on the panel.
      e.preventDefault();
      this.panel()?.focus();
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement as HTMLElement | null;
    if (e.shiftKey && (active === first || active === this.panel())) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  }

  private async position() {
    const trigger = this.trigger();
    const panel = this.panel();
    if (!trigger || !panel) return;

    const { x, y } = await computePosition(trigger, panel, {
      placement: this.placement,
      middleware: [offset(4), flip(), shift({ padding: 4 })],
    });
    panel.style.left = `${x}px`;
    panel.style.top = `${y}px`;
  }

  render() {
    const state = this.open ? "open" : "closed";
    return html`
      <div class="lv-popover">
        <span
          class="lv-popover__trigger"
          aria-haspopup="dialog"
          aria-expanded=${this.open ? "true" : "false"}
          aria-controls=${this.open ? this.panelId : ""}
          data-state=${state}
          @click=${() => (this.open ? this.closePopover() : this.openPopover())}
        >
          <slot name="trigger"></slot>
        </span>

        <div
          class="lv-popover__panel ${this.open ? "lv-popover__panel--open" : ""}"
          id=${this.panelId}
          role="dialog"
          aria-modal="false"
          data-state=${state}
          tabindex="-1"
          @keydown=${this.onPanelKeyDown}
        >
          <slot name="content"></slot>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "lv-popover": LvPopover;
  }
}
