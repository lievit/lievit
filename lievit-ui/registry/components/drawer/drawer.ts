/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { adoptLightStyles } from "../light-dom/light-dom.js";

/**
 * `<lv-drawer>`: a slide-in panel (sheet) anchored to an edge of the viewport.
 *
 * Follows WAI-ARIA APG dialog pattern (same role, research 4.3), presented as a
 * side sheet rather than a centred modal:
 * - `role="dialog"` + `aria-modal="true"` on the panel.
 * - `aria-labelledby` wired to the heading id when `heading` is supplied.
 * - Focus trap (Tab / Shift+Tab) and Escape-to-close identical to `<lv-dialog>`.
 * - Backdrop click closes when `dismissible` (default true).
 * - `side` prop: `"right"` (default) | `"left"` | `"bottom"` | `"top"`.
 *
 * Data down, events up: emits `lv-close` on close. `open` is parent-controlled.
 *
 * CSP-safe. Owned source, copied in by `lievit add drawer`. Light-DOM rendered.
 */
@customElement("lv-drawer")
export class LvDrawer extends LitElement {
  /** Controls visibility. */
  @property({ type: Boolean }) open = false;

  /** Which edge the drawer slides in from. */
  @property() side: "right" | "left" | "bottom" | "top" = "right";

  /** Panel title; wired to `aria-labelledby`. */
  @property() heading = "";

  /** Clicking the backdrop closes the drawer. Default true. */
  @property({ type: Boolean }) dismissible = true;

  private static seq = 0;
  private readonly internalId = `lv-drawer-${LvDrawer.seq++}`;
  private readonly headingId = `lv-drawer-heading-${LvDrawer.seq}`;

  private _returnFocus: Element | null = null;

  createRenderRoot(): this {
    adoptLightStyles("lv-drawer", LvDrawer.css);
    return this;
  }

  static readonly css = `
    .lv-drawer-backdrop {
      display: none;
      position: fixed;
      inset: 0;
      z-index: 9500;
      background: rgb(0 0 0 / 0.40);
    }
    .lv-drawer-backdrop--open { display: block; }
    .lv-drawer {
      position: fixed;
      z-index: 9501;
      background: var(--lv-color-bg);
      border: 1px solid var(--lv-color-border);
      box-shadow: var(--lv-shadow-md);
      display: flex;
      flex-direction: column;
      overflow-y: auto;
      transition: transform 0.25s ease;
    }
    /* right */
    .lv-drawer--right { top: 0; right: 0; bottom: 0; width: min(90vw, 24rem); transform: translateX(100%); }
    .lv-drawer--right.lv-drawer--open { transform: translateX(0); }
    /* left */
    .lv-drawer--left { top: 0; left: 0; bottom: 0; width: min(90vw, 24rem); transform: translateX(-100%); }
    .lv-drawer--left.lv-drawer--open { transform: translateX(0); }
    /* bottom */
    .lv-drawer--bottom { left: 0; right: 0; bottom: 0; max-height: 85vh; border-radius: var(--lv-radius-md) var(--lv-radius-md) 0 0; transform: translateY(100%); }
    .lv-drawer--bottom.lv-drawer--open { transform: translateY(0); }
    /* top */
    .lv-drawer--top { left: 0; right: 0; top: 0; max-height: 85vh; border-radius: 0 0 var(--lv-radius-md) var(--lv-radius-md); transform: translateY(-100%); }
    .lv-drawer--top.lv-drawer--open { transform: translateY(0); }

    .lv-drawer__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--lv-space-3);
      padding: var(--lv-space-4);
      border-bottom: 1px solid var(--lv-color-border);
      flex-shrink: 0;
    }
    .lv-drawer__title {
      font-family: var(--lv-font-sans);
      font-size: var(--lv-text-lg);
      font-weight: 600;
      color: var(--lv-color-fg);
      margin: 0;
    }
    .lv-drawer__close {
      background: transparent;
      border: 0;
      cursor: pointer;
      color: var(--lv-color-muted);
      font-size: var(--lv-text-lg);
      line-height: 1;
      padding: var(--lv-space-1);
      border-radius: var(--lv-radius-sm);
      flex-shrink: 0;
    }
    .lv-drawer__close:focus-visible { outline: none; box-shadow: var(--lv-ring); }
    .lv-drawer__body {
      font-family: var(--lv-font-sans);
      font-size: var(--lv-text-base);
      color: var(--lv-color-fg);
      line-height: var(--lv-leading);
      padding: var(--lv-space-4);
      flex: 1;
      overflow-y: auto;
    }
  `;

  private getFocusable(): HTMLElement[] {
    const panel = this.querySelector(".lv-drawer");
    if (!panel) return [];
    return Array.from(
      panel.querySelectorAll<HTMLElement>(
        'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),' +
          'select:not([disabled]),[tabindex]:not([tabindex="-1"])'
      )
    ).filter((el) => !el.closest("[hidden]"));
  }

  private trapFocus = (e: KeyboardEvent) => {
    if (!this.open || e.key !== "Tab") return;
    const focusable = this.getFocusable();
    if (focusable.length === 0) { e.preventDefault(); return; }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first) { e.preventDefault(); last.focus(); }
    } else {
      if (document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  };

  private handleEscape = (e: KeyboardEvent) => {
    if (this.open && e.key === "Escape") { e.preventDefault(); this.close(); }
  };

  private close() {
    this.dispatchEvent(new CustomEvent("lv-close", { bubbles: true, composed: true }));
  }

  updated(changed: Map<string, unknown>) {
    if (changed.has("open")) {
      if (this.open) {
        this._returnFocus = document.activeElement;
        document.addEventListener("keydown", this.trapFocus);
        document.addEventListener("keydown", this.handleEscape);
        this.updateComplete.then(() => {
          const focusable = this.getFocusable();
          if (focusable.length > 0) focusable[0].focus();
        });
      } else {
        document.removeEventListener("keydown", this.trapFocus);
        document.removeEventListener("keydown", this.handleEscape);
        if (this._returnFocus && "focus" in this._returnFocus) {
          (this._returnFocus as HTMLElement).focus();
        }
        this._returnFocus = null;
      }
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener("keydown", this.trapFocus);
    document.removeEventListener("keydown", this.handleEscape);
  }

  private onBackdropClick() {
    if (this.dismissible) this.close();
  }

  render() {
    const hasHeading = this.heading.length > 0;
    return html`
      <div
        class="lv-drawer-backdrop ${this.open ? "lv-drawer-backdrop--open" : ""}"
        @click=${this.onBackdropClick}
        aria-hidden="true"
      ></div>
      <div
        class="lv-drawer lv-drawer--${this.side} ${this.open ? "lv-drawer--open" : ""}"
        id=${this.internalId}
        role="dialog"
        aria-modal="true"
        aria-labelledby=${hasHeading ? this.headingId : ""}
        aria-label=${!hasHeading ? "Drawer" : ""}
      >
        ${hasHeading
          ? html`
            <div class="lv-drawer__header">
              <h2 class="lv-drawer__title" id=${this.headingId}>${this.heading}</h2>
              <button
                class="lv-drawer__close"
                type="button"
                aria-label="Close"
                @click=${() => this.close()}
              >&#x2715;</button>
            </div>
          `
          : null}
        <div class="lv-drawer__body"><slot></slot></div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "lv-drawer": LvDrawer;
  }
}
