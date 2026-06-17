/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
import { LitElement, html } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { computePosition, flip, shift, offset } from "@floating-ui/dom";
import { adoptLightStyles } from "../light-dom/light-dom.js";

/**
 * `<lv-tooltip>`: a floating contextual label.
 *
 * Follows the WAI-ARIA APG tooltip pattern (research 4.3):
 * - The trigger receives `aria-describedby` pointing at the tooltip content.
 * - The tooltip panel has `role="tooltip"`.
 * - Opens on pointer-enter and focus; closes on pointer-leave, blur, and Escape.
 * - Positioned by `@floating-ui/dom` (flip + shift so it stays in-viewport).
 *
 * Usage: wrap any trigger in the default slot and set the `content` prop.
 *   `<lv-tooltip content="Save document"><lv-button>Save</lv-button></lv-tooltip>`
 *
 * Owned source, copied in by `lievit add tooltip`. Light-DOM rendered.
 * npm dep: `@floating-ui/dom` (declared in meta.json, installed by `lievit add`).
 */
@customElement("lv-tooltip")
export class LvTooltip extends LitElement {
  /** The tooltip text to display. */
  @property() content = "";

  /** Preferred placement (passed to Floating UI; flips automatically). */
  @property() placement: "top" | "bottom" | "left" | "right" = "top";

  @state() private visible = false;

  private static seq = 0;
  private readonly tipId = `lv-tooltip-${LvTooltip.seq++}`;

  createRenderRoot(): this {
    adoptLightStyles("lv-tooltip", LvTooltip.css);
    return this;
  }

  static readonly css = `
    .lv-tooltip-wrap {
      display: inline-block;
      position: relative;
    }
    .lv-tooltip-panel {
      position: absolute;
      z-index: 9100;
      background: var(--lv-color-fg);
      color: var(--lv-color-bg);
      font-family: var(--lv-font-sans);
      font-size: var(--lv-text-sm);
      line-height: var(--lv-leading);
      padding: var(--lv-space-1) var(--lv-space-2);
      border-radius: var(--lv-radius-sm);
      box-shadow: var(--lv-shadow-md);
      white-space: nowrap;
      pointer-events: none;
      visibility: hidden;
      opacity: 0;
      transition: opacity 100ms ease;
    }
    .lv-tooltip-panel--visible {
      visibility: visible;
      opacity: 1;
    }
  `;

  private async position() {
    const trigger = this.querySelector(".lv-tooltip-trigger") as HTMLElement | null;
    const panel = this.querySelector(".lv-tooltip-panel") as HTMLElement | null;
    if (!trigger || !panel) return;

    const { x, y } = await computePosition(trigger, panel, {
      placement: this.placement,
      middleware: [offset(6), flip(), shift({ padding: 4 })],
    });
    panel.style.left = `${x}px`;
    panel.style.top = `${y}px`;
  }

  private show() {
    this.visible = true;
    this.updateComplete.then(() => this.position());
  }

  private hide() {
    this.visible = false;
  }

  private onKeyDown(e: KeyboardEvent) {
    if (e.key === "Escape") this.hide();
  }

  render() {
    return html`
      <span class="lv-tooltip-wrap">
        <span
          class="lv-tooltip-trigger"
          aria-describedby=${this.content ? this.tipId : ""}
          @mouseenter=${this.show}
          @mouseleave=${this.hide}
          @focusin=${this.show}
          @focusout=${this.hide}
          @keydown=${this.onKeyDown}
        >
          <slot></slot>
        </span>
        <span
          class="lv-tooltip-panel ${this.visible ? "lv-tooltip-panel--visible" : ""}"
          id=${this.tipId}
          role="tooltip"
        >${this.content}</span>
      </span>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "lv-tooltip": LvTooltip;
  }
}
