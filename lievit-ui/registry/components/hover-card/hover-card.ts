/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
import { LitElement, html } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { computePosition, flip, shift, offset } from "@floating-ui/dom";
import { adoptLightStyles } from "../light-dom/light-dom.js";

/**
 * `<lv-hover-card>`: a hover-triggered floating card for preview content.
 *
 * Follows Radix's hover-card model (~/workspaces/ui-refs/radix-primitives hover-card):
 * - It is a PREVIEW affordance for sighted pointer/keyboard users, NOT an essential
 *   announced popup. So the trigger carries `data-state` only (no `aria-haspopup`),
 *   and the card has NO ARIA role and is `aria-hidden` to assistive tech (its content
 *   must also exist in the accessible flow). This mirrors Radix, which gives the
 *   content no role and makes its tabbables non-tabbable.
 * - Opens on pointer-enter and focus after `open-delay` (~300ms); closes on
 *   pointer-leave and blur after `close-delay`. Moving the pointer from trigger onto
 *   the card keeps it open (the card itself re-arms open on enter), so the gap is
 *   crossable. Escape closes immediately.
 * - NOT focus-trapping: it is hover/preview, never modal.
 *
 * Positioned by `@floating-ui/dom` (offset + flip + shift), stacks at `--lv-z-popover`.
 *
 * Usage:
 *   <lv-hover-card>
 *     <a slot="trigger" href="/u/ada">@ada</a>
 *     <div slot="content">Ada Lovelace — first programmer</div>
 *   </lv-hover-card>
 *
 * Owned source, copied in by `lievit add hover-card`. Light-DOM rendered.
 * npm dep: `@floating-ui/dom` (declared in meta.json, installed by `lievit add`).
 */
@customElement("lv-hover-card")
export class LvHoverCard extends LitElement {
  /** Preferred card placement (flips automatically when space is tight). */
  @property() placement:
    | "top"
    | "top-start"
    | "top-end"
    | "bottom"
    | "bottom-start"
    | "bottom-end"
    | "left"
    | "right" = "bottom";

  /** Delay in ms before opening on hover/focus (Radix-style, lighter default). */
  @property({ type: Number, attribute: "open-delay" }) openDelay = 300;

  /** Delay in ms before closing after the pointer/focus leaves. */
  @property({ type: Number, attribute: "close-delay" }) closeDelay = 300;

  @state() private open = false;

  private openTimer = 0;
  private closeTimer = 0;

  createRenderRoot(): this {
    adoptLightStyles("lv-hover-card", LvHoverCard.css);
    return this;
  }

  static readonly css = `
    .lv-hover-card { position: relative; display: inline-block; }
    .lv-hover-card__trigger { display: inline-block; }
    .lv-hover-card__panel {
      position: fixed;
      z-index: var(--lv-z-popover);
      width: 16rem;
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
    .lv-hover-card__panel--open { display: block; }
  `;

  connectedCallback() {
    super.connectedCallback();
    document.addEventListener("keydown", this.handleGlobalKey);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener("keydown", this.handleGlobalKey);
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

  private handleGlobalKey = (e: KeyboardEvent) => {
    if (this.open && e.key === "Escape") {
      this.clearTimers();
      this.open = false;
    }
  };

  private scheduleOpen = () => {
    if (this.closeTimer) {
      clearTimeout(this.closeTimer);
      this.closeTimer = 0;
    }
    if (this.open || this.openTimer) return;
    this.openTimer = window.setTimeout(() => {
      this.openTimer = 0;
      this.open = true;
      this.dispatchEvent(
        new CustomEvent("lv-open", { bubbles: true, composed: true })
      );
      this.updateComplete.then(() => this.position());
    }, this.openDelay);
  };

  private scheduleClose = () => {
    if (this.openTimer) {
      clearTimeout(this.openTimer);
      this.openTimer = 0;
    }
    if (!this.open || this.closeTimer) return;
    this.closeTimer = window.setTimeout(() => {
      this.closeTimer = 0;
      this.open = false;
      this.dispatchEvent(
        new CustomEvent("lv-close", { bubbles: true, composed: true })
      );
    }, this.closeDelay);
  };

  private async position() {
    const trigger = this.querySelector(
      ".lv-hover-card__trigger"
    ) as HTMLElement | null;
    const panel = this.querySelector(
      ".lv-hover-card__panel"
    ) as HTMLElement | null;
    if (!trigger || !panel) return;

    const { x, y } = await computePosition(trigger, panel, {
      placement: this.placement,
      middleware: [offset(8), flip(), shift({ padding: 4 })],
    });
    panel.style.left = `${x}px`;
    panel.style.top = `${y}px`;
  }

  render() {
    const state = this.open ? "open" : "closed";
    return html`
      <div class="lv-hover-card">
        <span
          class="lv-hover-card__trigger"
          data-state=${state}
          @pointerenter=${this.scheduleOpen}
          @pointerleave=${this.scheduleClose}
          @focusin=${this.scheduleOpen}
          @focusout=${this.scheduleClose}
        >
          <slot name="trigger"></slot>
        </span>

        <div
          class="lv-hover-card__panel ${this.open ? "lv-hover-card__panel--open" : ""}"
          data-state=${state}
          aria-hidden="true"
          @pointerenter=${this.scheduleOpen}
          @pointerleave=${this.scheduleClose}
        >
          <slot name="content"></slot>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "lv-hover-card": LvHoverCard;
  }
}
