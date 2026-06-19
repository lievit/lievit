/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { unsafeSVG } from "lit/directives/unsafe-svg.js";
import { adoptLightStyles } from "../light-dom/light-dom.js";
import { iconBodies } from "../../icons/icon-bodies.js";

/**
 * `<lv-sheet>`: a modal side panel that slides in from any of the four viewport edges.
 *
 * Relationship to `<lv-drawer>`: drawer is the original edge-anchored panel (right/left/
 * bottom/top, dialog ARIA + focus trap + Escape). `lv-sheet` is the shadcn-shaped
 * generalisation of the same idea: identical four-`side` behaviour, but with shadcn's
 * structured content model (header / footer / title / description slots + a built-in close
 * button) and token-driven z-index/overlay. Drawer stays as-is for adopters who want the
 * minimal heading+body shape; sheet is the richer composition. Both share the WAI-ARIA APG
 * dialog pattern; neither supersedes the other (the v2 plan lists "sheet (drawer variant)").
 *
 * A11y (Radix Dialog is the source of truth):
 * - `role="dialog"` + `aria-modal="true"` on the panel.
 * - `aria-labelledby` -> the title id when `heading` is set (or the projected title slot),
 *   `aria-describedby` -> the description id when `description` is set.
 * - Focus trap (Tab / Shift+Tab cycle within the panel), Escape closes, focus returns to the
 *   opener on close. Backdrop click closes when `dismissible` (default true).
 *
 * Data down, events up: `open` is parent-controlled; emits a bubbling `lv-close` on any close
 * path (Escape, backdrop, close button). The close glyph is the vendored Lucide `x`.
 *
 * Owned source, copied in by `lievit add sheet`. Light-DOM rendered, token-styled.
 */
@customElement("lv-sheet")
export class LvSheet extends LitElement {
  /** Controls visibility. */
  @property({ type: Boolean }) open = false;

  /** Which edge the sheet slides in from. */
  @property() side: "right" | "left" | "top" | "bottom" = "right";

  /** Panel title; wired to `aria-labelledby`. Omit to project a `title` slot instead. */
  @property() heading = "";

  /** Panel description; wired to `aria-describedby`. */
  @property() description = "";

  /** Clicking the backdrop closes the sheet. Default true. */
  @property({ type: Boolean }) dismissible = true;

  /** Render the top-right close button. Default true. */
  @property({ type: Boolean, attribute: "show-close" }) showClose = true;

  private static _seq = 0;
  private readonly _id = `lv-sheet-${(LvSheet._seq += 1)}`;
  private readonly headingId = `${this._id}-title`;
  private readonly descId = `${this._id}-desc`;

  private _returnFocus: Element | null = null;

  createRenderRoot(): this {
    adoptLightStyles("lv-sheet", LvSheet.css);
    return this;
  }

  static readonly css = `
    .lv-sheet-backdrop {
      display: none;
      position: fixed;
      inset: 0;
      z-index: var(--lv-z-overlay);
      background: var(--lv-color-overlay);
    }
    .lv-sheet-backdrop--open { display: block; }
    .lv-sheet {
      position: fixed;
      z-index: var(--lv-z-modal);
      display: flex;
      flex-direction: column;
      gap: var(--lv-space-4);
      background: var(--lv-color-bg);
      color: var(--lv-color-fg);
      box-shadow: var(--lv-shadow-lg);
      transition: transform 0.3s ease-in-out;
      font-family: var(--lv-font-sans);
    }
    .lv-sheet--right { inset: 0 0 0 auto; width: min(90vw, 24rem); border-left: 1px solid var(--lv-color-border); transform: translateX(100%); }
    .lv-sheet--right.lv-sheet--open { transform: translateX(0); }
    .lv-sheet--left { inset: 0 auto 0 0; width: min(90vw, 24rem); border-right: 1px solid var(--lv-color-border); transform: translateX(-100%); }
    .lv-sheet--left.lv-sheet--open { transform: translateX(0); }
    .lv-sheet--top { inset: 0 0 auto 0; max-height: 85vh; border-bottom: 1px solid var(--lv-color-border); transform: translateY(-100%); }
    .lv-sheet--top.lv-sheet--open { transform: translateY(0); }
    .lv-sheet--bottom { inset: auto 0 0 0; max-height: 85vh; border-top: 1px solid var(--lv-color-border); transform: translateY(100%); }
    .lv-sheet--bottom.lv-sheet--open { transform: translateY(0); }

    .lv-sheet__header {
      display: flex;
      flex-direction: column;
      gap: var(--lv-space-1);
      padding: var(--lv-space-4);
    }
    .lv-sheet__title {
      margin: 0;
      font-size: var(--lv-text-lg);
      font-weight: 600;
      color: var(--lv-color-fg);
    }
    .lv-sheet__description {
      margin: 0;
      font-size: var(--lv-text-sm);
      color: var(--lv-color-muted);
      line-height: var(--lv-leading);
    }
    .lv-sheet__body {
      flex: 1;
      overflow-y: auto;
      padding: 0 var(--lv-space-4);
      font-size: var(--lv-text-base);
      color: var(--lv-color-fg);
      line-height: var(--lv-leading);
    }
    .lv-sheet__footer {
      margin-top: auto;
      display: flex;
      flex-direction: column;
      gap: var(--lv-space-2);
      padding: var(--lv-space-4);
    }
    .lv-sheet__close {
      position: absolute;
      top: var(--lv-space-4);
      right: var(--lv-space-4);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: transparent;
      border: 0;
      cursor: pointer;
      color: var(--lv-color-muted);
      border-radius: var(--lv-radius-sm);
      padding: var(--lv-space-1);
      opacity: 0.7;
    }
    .lv-sheet__close:hover { opacity: 1; }
    .lv-sheet__close:focus-visible { outline: none; box-shadow: var(--lv-ring); opacity: 1; }
    .lv-sheet__close svg { width: 1rem; height: 1rem; }
  `;

  private getFocusable(): HTMLElement[] {
    const panel = this.querySelector(".lv-sheet");
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
    if (focusable.length === 0) {
      e.preventDefault();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else if (document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  private handleEscape = (e: KeyboardEvent) => {
    if (this.open && e.key === "Escape") {
      e.preventDefault();
      this.close();
    }
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
    const hasDesc = this.description.length > 0;
    const closeBody = iconBodies["x"] ?? "";
    return html`
      <div
        class="lv-sheet-backdrop ${this.open ? "lv-sheet-backdrop--open" : ""}"
        @click=${this.onBackdropClick}
        aria-hidden="true"
      ></div>
      <div
        class="lv-sheet lv-sheet--${this.side} ${this.open ? "lv-sheet--open" : ""}"
        id=${this._id}
        role="dialog"
        aria-modal="true"
        aria-labelledby=${hasHeading ? this.headingId : ""}
        aria-describedby=${hasDesc ? this.descId : ""}
        aria-label=${!hasHeading ? "Sheet" : ""}
      >
        ${this.showClose
          ? html`<button
              class="lv-sheet__close"
              type="button"
              aria-label="Close"
              @click=${() => this.close()}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                ${unsafeSVG(closeBody)}
              </svg>
            </button>`
          : null}
        <div class="lv-sheet__header">
          ${hasHeading
            ? html`<h2 class="lv-sheet__title" id=${this.headingId}>${this.heading}</h2>`
            : html`<slot name="title"></slot>`}
          ${hasDesc
            ? html`<p class="lv-sheet__description" id=${this.descId}>${this.description}</p>`
            : html`<slot name="description"></slot>`}
        </div>
        <div class="lv-sheet__body"><slot></slot></div>
        <div class="lv-sheet__footer"><slot name="footer"></slot></div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "lv-sheet": LvSheet;
  }
}
