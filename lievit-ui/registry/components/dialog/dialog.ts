/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { adoptLightStyles } from "../light-dom/light-dom.js";

/**
 * `<lv-dialog>`: an accessible modal dialog with focus trap.
 *
 * Architecture: a full-screen backdrop + centred panel rendered in light DOM.
 * Follows WAI-ARIA APG dialog pattern (research 4.3):
 * - `role="dialog"` + `aria-modal="true"` on the panel; `aria-labelledby` wired to the
 *   heading when `heading` is supplied so screen readers announce the dialog title on open.
 * - Focus trap: Tab / Shift+Tab cycle within focusable descendants only; the first focusable
 *   element receives focus on open.
 * - Escape closes the dialog and returns focus to the triggering element (via `returnFocus`).
 * - The backdrop click is optional (`dismissible`, default true).
 *
 * Data down, events up: emits `lv-close` (bubbling, composed) when the dialog closes.
 * The `open` prop controls visibility; the parent drives state.
 *
 * CSP-safe (no inline script). Owned source, copied in by `lievit add dialog`. Light-DOM.
 */
@customElement("lv-dialog")
export class LvDialog extends LitElement {
  /** Controls visibility. */
  @property({ type: Boolean }) open = false;

  /** Dialog title; wired to `aria-labelledby`. */
  @property() heading = "";

  /** Clicking the backdrop closes the dialog. Default true. */
  @property({ type: Boolean }) dismissible = true;

  /** Exposed id for `aria-controls` on the trigger element. */
  @property() dialogId = "";

  private static seq = 0;
  private readonly internalId = `lv-dialog-${LvDialog.seq++}`;
  private readonly headingId = `lv-dialog-heading-${LvDialog.seq}`;

  /** Holds the element that had focus before the dialog opened. */
  private _returnFocus: Element | null = null;

  createRenderRoot(): this {
    adoptLightStyles("lv-dialog", LvDialog.css);
    return this;
  }

  static readonly css = `
    .lv-dialog-backdrop {
      display: none;
      position: fixed;
      inset: 0;
      z-index: 9500;
      background: rgb(0 0 0 / 0.45);
      align-items: center;
      justify-content: center;
    }
    .lv-dialog-backdrop--open { display: flex; }
    .lv-dialog {
      position: relative;
      background: var(--lv-color-bg);
      border: 1px solid var(--lv-color-border);
      border-radius: var(--lv-radius-md);
      box-shadow: var(--lv-shadow-md);
      width: min(90vw, 32rem);
      max-height: 85vh;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
    }
    .lv-dialog__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--lv-space-3);
      padding: var(--lv-space-4);
      border-bottom: 1px solid var(--lv-color-border);
    }
    .lv-dialog__title {
      font-family: var(--lv-font-sans);
      font-size: var(--lv-text-lg);
      font-weight: 600;
      color: var(--lv-color-fg);
      margin: 0;
    }
    .lv-dialog__close {
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
    .lv-dialog__close:focus-visible { outline: none; box-shadow: var(--lv-ring); }
    .lv-dialog__body {
      font-family: var(--lv-font-sans);
      font-size: var(--lv-text-base);
      color: var(--lv-color-fg);
      line-height: var(--lv-leading);
      padding: var(--lv-space-4);
      flex: 1;
    }
    .lv-dialog__footer {
      display: flex;
      justify-content: flex-end;
      gap: var(--lv-space-2);
      padding: var(--lv-space-3) var(--lv-space-4);
      border-top: 1px solid var(--lv-color-border);
    }
  `;

  /** All focusable descendants inside the dialog panel. */
  private getFocusable(): HTMLElement[] {
    const panel = this.querySelector(".lv-dialog");
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
        // defer so the panel is painted
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

  private onBackdropClick(e: MouseEvent) {
    if (this.dismissible && e.target === e.currentTarget) this.close();
  }

  render() {
    const id = this.dialogId || this.internalId;
    const hasHeading = this.heading.length > 0;
    return html`
      <div
        class="lv-dialog-backdrop ${this.open ? "lv-dialog-backdrop--open" : ""}"
        @click=${this.onBackdropClick}
        aria-hidden=${!this.open ? "true" : "false"}
      >
        <div
          class="lv-dialog"
          id=${id}
          role="dialog"
          aria-modal="true"
          aria-labelledby=${hasHeading ? this.headingId : ""}
          aria-label=${!hasHeading ? "Dialog" : ""}
        >
          ${hasHeading
            ? html`
              <div class="lv-dialog__header">
                <h2 class="lv-dialog__title" id=${this.headingId}>${this.heading}</h2>
                <button
                  class="lv-dialog__close"
                  type="button"
                  aria-label="Close dialog"
                  @click=${() => this.close()}
                >&#x2715;</button>
              </div>
            `
            : null}
          <div class="lv-dialog__body"><slot></slot></div>
          <div class="lv-dialog__footer"><slot name="footer"></slot></div>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "lv-dialog": LvDialog;
  }
}
