/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
import { LitElement, html } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { adoptLightStyles } from "../light-dom/light-dom.js";

/**
 * Column definition for `<lv-data-table>`.
 */
export interface DataTableColumn {
  /** Unique column key matching a property on the row objects. */
  key: string;
  /** Column header label. */
  label: string;
  /** Allows the column to be sorted. Default `true`. */
  sortable?: boolean;
  /** Alignment of cell content. Default `"left"`. */
  align?: "left" | "center" | "right";
}

/**
 * `<lv-data-table>`: a sortable, paginated data table.
 *
 * Accessibility (WAI-ARIA, research 4.3):
 * - `role="grid"` on the table, `role="columnheader"` on sortable headers,
 *   `aria-sort="ascending|descending|none"` on the active sort column.
 * - Caption via `aria-label` / `aria-labelledby`.
 * - Keyboard: click or Enter/Space on a header toggles sort; pagination buttons
 *   are native `<button>` elements.
 *
 * Data down, events up: all data is passed via `columns` and `rows` properties.
 * Emits `lv-sort` when sort changes (`{ key, direction }`) and `lv-page` when page
 * changes (`{ page }`). The component renders the current page of rows; sorting and
 * pagination are fully client-side unless the adopter drives them from outside.
 *
 * Owned source, copied in by `lievit add data-table`. Light-DOM rendered.
 */
@customElement("lv-data-table")
export class LvDataTable extends LitElement {
  /** Column definitions. */
  @property({ type: Array }) columns: DataTableColumn[] = [];

  /** Row data (array of plain objects). */
  @property({ type: Array }) rows: Record<string, unknown>[] = [];

  /** Rows per page (0 = show all). */
  @property({ type: Number }) pageSize = 10;

  /** Accessible label for the table. */
  @property() label = "";

  @state() private sortKey = "";
  @state() private sortDir: "asc" | "desc" = "asc";
  @state() private page = 1;

  createRenderRoot(): this {
    adoptLightStyles("lv-data-table", LvDataTable.css);
    return this;
  }

  static readonly css = `
    .lv-table-wrap {
      display: block;
      overflow-x: auto;
      font-family: var(--lv-font-sans);
      font-size: var(--lv-text-sm);
      color: var(--lv-color-fg);
    }
    .lv-table {
      width: 100%;
      border-collapse: collapse;
    }
    .lv-table thead { background: var(--lv-color-surface); }
    .lv-table th {
      font-weight: 600;
      font-size: var(--lv-text-sm);
      color: var(--lv-color-fg);
      padding: var(--lv-space-3) var(--lv-space-3);
      text-align: left;
      border-bottom: 2px solid var(--lv-color-border);
      white-space: nowrap;
    }
    .lv-table th[aria-sort] { cursor: pointer; user-select: none; }
    .lv-table th[aria-sort]:hover { background: color-mix(in srgb, var(--lv-color-primary) 8%, var(--lv-color-surface)); }
    .lv-table th:focus-visible { outline: none; box-shadow: var(--lv-ring); }
    .lv-table__sort-icon { margin-left: var(--lv-space-1); font-size: 0.75em; color: var(--lv-color-muted); }
    .lv-table__sort-icon--active { color: var(--lv-color-primary); }
    .lv-table td {
      padding: var(--lv-space-3) var(--lv-space-3);
      border-bottom: 1px solid var(--lv-color-border);
      vertical-align: middle;
    }
    .lv-table tbody tr:last-child td { border-bottom: 0; }
    .lv-table tbody tr:hover { background: var(--lv-color-surface); }
    .lv-table .lv-table--align-center { text-align: center; }
    .lv-table .lv-table--align-right { text-align: right; }
    .lv-table-pagination {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--lv-space-2);
      padding: var(--lv-space-3) 0 0;
      font-family: var(--lv-font-sans);
      font-size: var(--lv-text-sm);
      color: var(--lv-color-muted);
    }
    .lv-table-pagination__btns { display: flex; gap: var(--lv-space-1); }
    .lv-table-pagination__btn {
      padding: var(--lv-space-1) var(--lv-space-2);
      border: 1px solid var(--lv-color-border);
      border-radius: var(--lv-radius-sm);
      background: var(--lv-color-bg);
      color: var(--lv-color-fg);
      font-family: var(--lv-font-sans);
      font-size: var(--lv-text-sm);
      cursor: pointer;
    }
    .lv-table-pagination__btn:focus-visible { outline: none; box-shadow: var(--lv-ring); }
    .lv-table-pagination__btn[disabled] { opacity: 0.4; cursor: not-allowed; }
    .lv-table-pagination__btn--active {
      background: var(--lv-color-primary);
      color: var(--lv-color-primary-fg);
      border-color: var(--lv-color-primary);
    }
    .lv-table-empty {
      text-align: center;
      color: var(--lv-color-muted);
      padding: var(--lv-space-5);
    }
  `;

  private get sortedRows(): Record<string, unknown>[] {
    if (!this.sortKey) return this.rows;
    return [...this.rows].sort((a, b) => {
      const av = a[this.sortKey];
      const bv = b[this.sortKey];
      let cmp = 0;
      if (typeof av === "number" && typeof bv === "number") {
        cmp = av - bv;
      } else {
        cmp = String(av ?? "").localeCompare(String(bv ?? ""));
      }
      return this.sortDir === "asc" ? cmp : -cmp;
    });
  }

  private get totalPages(): number {
    if (!this.pageSize || this.pageSize <= 0) return 1;
    return Math.max(1, Math.ceil(this.rows.length / this.pageSize));
  }

  private get visibleRows(): Record<string, unknown>[] {
    const sorted = this.sortedRows;
    if (!this.pageSize || this.pageSize <= 0) return sorted;
    const start = (this.page - 1) * this.pageSize;
    return sorted.slice(start, start + this.pageSize);
  }

  private toggleSort(col: DataTableColumn) {
    if (col.sortable === false) return;
    if (this.sortKey === col.key) {
      this.sortDir = this.sortDir === "asc" ? "desc" : "asc";
    } else {
      this.sortKey = col.key;
      this.sortDir = "asc";
    }
    this.page = 1;
    this.dispatchEvent(
      new CustomEvent("lv-sort", {
        detail: { key: this.sortKey, direction: this.sortDir },
        bubbles: true,
        composed: true,
      })
    );
  }

  private goToPage(p: number) {
    this.page = Math.min(Math.max(1, p), this.totalPages);
    this.dispatchEvent(
      new CustomEvent("lv-page", { detail: { page: this.page }, bubbles: true, composed: true })
    );
  }

  private onHeaderKeyDown(e: KeyboardEvent, col: DataTableColumn) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      this.toggleSort(col);
    }
  }

  private sortIcon(col: DataTableColumn): string {
    if (this.sortKey !== col.key) return "↕";
    return this.sortDir === "asc" ? "↑" : "↓";
  }

  private ariaSortAttr(col: DataTableColumn): string {
    if (this.sortKey !== col.key) return "none";
    return this.sortDir === "asc" ? "ascending" : "descending";
  }

  render() {
    const visible = this.visibleRows;
    const total = this.totalPages;
    const showPager = this.pageSize > 0 && total > 1;

    return html`
      <div class="lv-table-wrap">
        <table
          class="lv-table"
          role="grid"
          aria-label=${this.label || ""}
          aria-rowcount=${this.rows.length}
        >
          <thead>
            <tr>
              ${this.columns.map((col) => {
                const sortable = col.sortable !== false;
                const isActive = this.sortKey === col.key;
                const align = col.align ?? "left";
                return html`<th
                  class="lv-table--align-${align}"
                  role="columnheader"
                  aria-sort=${sortable ? this.ariaSortAttr(col) : ""}
                  tabindex=${sortable ? "0" : ""}
                  @click=${sortable ? () => this.toggleSort(col) : null}
                  @keydown=${sortable ? (e: KeyboardEvent) => this.onHeaderKeyDown(e, col) : null}
                >
                  ${col.label}
                  ${sortable
                    ? html`<span
                        class="lv-table__sort-icon ${isActive ? "lv-table__sort-icon--active" : ""}"
                        aria-hidden="true">${this.sortIcon(col)}</span>`
                    : null}
                </th>`;
              })}
            </tr>
          </thead>
          <tbody>
            ${visible.length === 0
              ? html`<tr><td class="lv-table-empty" colspan=${this.columns.length}>No data</td></tr>`
              : visible.map((row) => html`
                  <tr>
                    ${this.columns.map((col) => html`
                      <td class="lv-table--align-${col.align ?? "left"}">
                        ${String(row[col.key] ?? "")}
                      </td>
                    `)}
                  </tr>
                `)}
          </tbody>
        </table>

        ${showPager
          ? html`
            <div class="lv-table-pagination" role="navigation" aria-label="Table pagination">
              <span>
                Page ${this.page} of ${total} (${this.rows.length} rows)
              </span>
              <div class="lv-table-pagination__btns">
                <button
                  class="lv-table-pagination__btn"
                  type="button"
                  aria-label="Previous page"
                  ?disabled=${this.page <= 1}
                  @click=${() => this.goToPage(this.page - 1)}
                >&#x2039;</button>
                ${Array.from({ length: total }, (_, i) => i + 1).map((p) => html`
                  <button
                    class="lv-table-pagination__btn ${p === this.page ? "lv-table-pagination__btn--active" : ""}"
                    type="button"
                    aria-label=${`Page ${p}`}
                    aria-current=${p === this.page ? "page" : ""}
                    @click=${() => this.goToPage(p)}
                  >${p}</button>
                `)}
                <button
                  class="lv-table-pagination__btn"
                  type="button"
                  aria-label="Next page"
                  ?disabled=${this.page >= total}
                  @click=${() => this.goToPage(this.page + 1)}
                >&#x203A;</button>
              </div>
            </div>
          `
          : null}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "lv-data-table": LvDataTable;
  }
}
