/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { adoptLightStyles } from "../light-dom/light-dom.js";

/**
 * Breadcrumb item definition for `<lv-breadcrumb>`.
 */
export interface BreadcrumbItem {
  /** Visible label. */
  label: string;
  /** Navigation href. Omit for the current (last) item. */
  href?: string;
}

/**
 * `<lv-breadcrumb>`: an accessible breadcrumb navigation trail.
 *
 * Follows WAI-ARIA breadcrumb pattern (research 4.3):
 * - `<nav aria-label="Breadcrumb">` wraps the list.
 * - `<ol>` with `<li>` items: ordinal list communicates sequence to assistive tech.
 * - Each non-current item is an `<a>` link.
 * - The current (last) item carries `aria-current="page"` and is not a link.
 * - Separator characters between items are `aria-hidden="true"` so they are not
 *   read by screen readers.
 *
 * Data down: items are passed via the `items` property as an array of
 * `{ label, href? }`. The last item is treated as current regardless of whether
 * it has an href.
 *
 * The `separator` prop controls the glyph between items (default `"/"`).
 * The `label` prop sets the `aria-label` on the `<nav>` (default `"Breadcrumb"`).
 *
 * Owned source, copied in by `lievit add breadcrumb`. Light-DOM rendered.
 */
@customElement("lv-breadcrumb")
export class LvBreadcrumb extends LitElement {
  /** Breadcrumb items in order from root to current. */
  @property({ type: Array }) items: BreadcrumbItem[] = [];

  /** Visible separator between items. Screen-reader hidden. */
  @property() separator = "/";

  /** `aria-label` for the `<nav>` landmark. */
  @property() label = "Breadcrumb";

  createRenderRoot(): this {
    adoptLightStyles("lv-breadcrumb", LvBreadcrumb.css);
    return this;
  }

  static readonly css = `
    .lv-breadcrumb {
      display: block;
      font-family: var(--lv-font-sans);
      font-size: var(--lv-text-sm);
    }
    .lv-breadcrumb__list {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0;
      list-style: none;
      margin: 0;
      padding: 0;
    }
    .lv-breadcrumb__item {
      display: inline-flex;
      align-items: center;
    }
    .lv-breadcrumb__link {
      color: var(--lv-color-primary);
      text-decoration: none;
    }
    .lv-breadcrumb__link:hover { text-decoration: underline; }
    .lv-breadcrumb__link:focus-visible { outline: none; box-shadow: var(--lv-ring); border-radius: var(--lv-radius-sm); }
    .lv-breadcrumb__current {
      color: var(--lv-color-muted);
      font-weight: 500;
    }
    .lv-breadcrumb__separator {
      color: var(--lv-color-muted);
      padding: 0 var(--lv-space-2);
      user-select: none;
    }
  `;

  render() {
    return html`
      <nav class="lv-breadcrumb" aria-label=${this.label}>
        <ol class="lv-breadcrumb__list">
          ${this.items.map((item, i) => {
            const isCurrent = i === this.items.length - 1;
            const isFirst = i === 0;
            return html`
              <li class="lv-breadcrumb__item">
                ${!isFirst
                  ? html`<span class="lv-breadcrumb__separator" aria-hidden="true">${this.separator}</span>`
                  : null}
                ${isCurrent
                  ? html`<span class="lv-breadcrumb__current" aria-current="page">${item.label}</span>`
                  : html`<a class="lv-breadcrumb__link" href=${item.href ?? "#"}>${item.label}</a>`}
              </li>
            `;
          })}
        </ol>
      </nav>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "lv-breadcrumb": LvBreadcrumb;
  }
}
