/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
import { LitElement, html } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { unsafeSVG } from "lit/directives/unsafe-svg.js";
import { adoptLightStyles } from "../light-dom/light-dom.js";
import { iconBody } from "../../icons/icon-bodies.js";

/**
 * `<lv-calendar>`: a standalone, inline month-grid date picker primitive.
 *
 * This is the bare calendar surface (no input, no floating panel): the month grid the
 * date-picker conceptually contains, exposed on its own so it can be embedded anywhere
 * (popover, sidebar, dialog, scheduling UI). It follows the WAI-ARIA APG grid pattern for
 * a date picker:
 * - `role="grid"` on the table, `role="gridcell"` on each day cell, `role="columnheader"`
 *   on the weekday headers.
 * - The selected cell carries `aria-selected="true"`; the today cell carries
 *   `aria-current="date"`.
 * - Roving tabindex: exactly one day is in the tab order at a time; arrow keys move focus,
 *   Home/End jump to the week edges, PageUp/PageDown change month, Enter/Space select.
 * - Locale-aware first-day-of-week (`weekStart`, default Monday per ISO).
 *
 * Data down, events up: `value` is the selected ISO date (single mode) or the comma range
 * `"start,end"` (range mode). Emits `lv-change` with the new value on selection.
 * Disabled days (via `min`, `max`, or the `isDisabled` predicate) cannot be focused or
 * selected. Light-DOM rendered; the date-picker keeps its own internal grid, this is the
 * reusable primitive the rest of the library composes with.
 */
@customElement("lv-calendar")
export class LvCalendar extends LitElement {
  /**
   * Selected value. Single mode: an ISO date `YYYY-MM-DD` or empty. Range mode: `"start,end"`
   * (either side may be empty while the range is being built).
   */
  @property() value = "";

  /** `"single"` selects one date; `"range"` selects a start/end pair. */
  @property() mode: "single" | "range" = "single";

  /** Earliest selectable ISO date (inclusive), or empty for no lower bound. */
  @property() min = "";

  /** Latest selectable ISO date (inclusive), or empty for no upper bound. */
  @property() max = "";

  /** Disables the whole calendar. */
  @property({ type: Boolean }) disabled = false;

  /** First day of the week: 0 = Sunday, 1 = Monday (default, ISO). */
  @property({ type: Number }) weekStart = 1;

  /** BCP-47 locale for month + weekday names and day labels (default = host locale). */
  @property() locale = "";

  /**
   * Optional predicate that disables individual days. Set as a property (not an attribute):
   * `el.isDisabled = (iso) => isWeekend(iso)`.
   */
  @property({ attribute: false }) isDisabled: ((iso: string) => boolean) | null = null;

  @state() private viewYear = 0;
  @state() private viewMonth = 0; // 0-11
  @state() private focusedDate = "";

  private initialized = false;

  createRenderRoot(): this {
    adoptLightStyles("lv-calendar", LvCalendar.css);
    return this;
  }

  static readonly css = `
    .lv-calendar {
      display: inline-block;
      font-family: var(--lv-font-sans);
      color: var(--lv-color-fg);
      background: var(--lv-color-bg);
      padding: var(--lv-space-3);
      border-radius: var(--lv-radius-md);
    }
    .lv-calendar__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: var(--lv-space-2);
    }
    .lv-calendar__nav {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 2rem;
      height: 2rem;
      background: transparent;
      border: 1px solid var(--lv-color-border);
      border-radius: var(--lv-radius-sm);
      cursor: pointer;
      color: var(--lv-color-fg);
    }
    .lv-calendar__nav:hover:not([disabled]) { background: var(--lv-color-surface); }
    .lv-calendar__nav:focus-visible { outline: none; box-shadow: var(--lv-ring); }
    .lv-calendar__nav[disabled] { opacity: 0.4; cursor: not-allowed; }
    .lv-calendar__nav svg { width: 1rem; height: 1rem; }
    .lv-calendar__label {
      font-size: var(--lv-text-sm);
      font-weight: var(--lv-font-semibold);
      color: var(--lv-color-fg);
    }
    .lv-calendar__grid { border-collapse: collapse; }
    .lv-calendar__day-header {
      font-size: var(--lv-text-xs);
      color: var(--lv-color-muted-fg);
      font-weight: var(--lv-font-medium);
      padding: var(--lv-space-1);
      text-align: center;
      width: 2.25rem;
    }
    .lv-calendar__cell { padding: 1px; text-align: center; }
    .lv-calendar__day {
      width: 2.25rem;
      height: 2.25rem;
      border: 0;
      border-radius: var(--lv-radius-sm);
      background: transparent;
      font-family: var(--lv-font-sans);
      font-size: var(--lv-text-sm);
      color: var(--lv-color-fg);
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
    .lv-calendar__day:focus-visible { outline: none; box-shadow: var(--lv-ring); }
    .lv-calendar__day:hover:not([disabled]) { background: var(--lv-color-surface); }
    .lv-calendar__day--today {
      font-weight: var(--lv-font-semibold);
      border: 1px solid var(--lv-color-border);
    }
    .lv-calendar__day--selected {
      background: var(--lv-color-primary);
      color: var(--lv-color-primary-fg);
      font-weight: var(--lv-font-semibold);
    }
    .lv-calendar__day--selected:hover:not([disabled]) { background: var(--lv-color-primary); }
    .lv-calendar__day--in-range {
      background: var(--lv-color-accent);
      color: var(--lv-color-accent-fg);
      border-radius: 0;
    }
    .lv-calendar__day--range-start { border-top-right-radius: 0; border-bottom-right-radius: 0; }
    .lv-calendar__day--range-end { border-top-left-radius: 0; border-bottom-left-radius: 0; }
    .lv-calendar__day[disabled] { opacity: 0.4; cursor: not-allowed; }
  `;

  private get effectiveLocale(): string | undefined {
    return this.locale || undefined;
  }

  private get todayISO(): string {
    return LvCalendar.toISO(new Date());
  }

  private static toISO(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate()
    ).padStart(2, "0")}`;
  }

  private static parseISO(iso: string): Date | null {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
    const d = new Date(iso + "T00:00:00");
    return isNaN(d.getTime()) ? null : d;
  }

  /** The selected dates parsed from `value`: [] / [single] / [start, end] (end may be ""). */
  private get selection(): string[] {
    if (this.mode === "range") {
      return this.value
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }
    return this.value ? [this.value] : [];
  }

  willUpdate(changed: Map<string, unknown>) {
    if (!this.initialized) {
      this.initialized = true;
      const anchor = LvCalendar.parseISO(this.selection[0] ?? "") ?? new Date();
      this.viewYear = anchor.getFullYear();
      this.viewMonth = anchor.getMonth();
      this.focusedDate = this.selection[0] || this.todayISO;
    } else if (changed.has("value") && this.value) {
      // Keep the focused day in sync when the value is driven from outside.
      const first = this.selection[0];
      if (first) this.focusedDate = first;
    }
  }

  private isOutOfBounds(iso: string): boolean {
    if (this.min && iso < this.min) return true;
    if (this.max && iso > this.max) return true;
    return false;
  }

  private dayDisabled(iso: string): boolean {
    if (this.disabled) return true;
    if (this.isOutOfBounds(iso)) return true;
    return this.isDisabled ? this.isDisabled(iso) : false;
  }

  private prevMonth = () => {
    if (this.viewMonth === 0) {
      this.viewMonth = 11;
      this.viewYear--;
    } else {
      this.viewMonth--;
    }
  };

  private nextMonth = () => {
    if (this.viewMonth === 11) {
      this.viewMonth = 0;
      this.viewYear++;
    } else {
      this.viewMonth++;
    }
  };

  private select(iso: string) {
    if (this.dayDisabled(iso)) return;

    if (this.mode === "single") {
      this.value = iso;
    } else {
      const sel = this.selection;
      if (sel.length === 0 || sel.length === 2) {
        // Start a fresh range.
        this.value = iso;
      } else {
        // Close the range, ordering ascending.
        const [start] = sel;
        this.value = iso < start ? `${iso},${start}` : `${start},${iso}`;
      }
    }
    this.focusedDate = iso;
    this.dispatchEvent(
      new CustomEvent("lv-change", { detail: this.value, bubbles: true, composed: true })
    );
  }

  private focusDay() {
    this.querySelector<HTMLElement>(`[data-date="${this.focusedDate}"]`)?.focus();
  }

  private moveFocus(next: Date) {
    this.focusedDate = LvCalendar.toISO(next);
    this.viewYear = next.getFullYear();
    this.viewMonth = next.getMonth();
    this.updateComplete.then(() => this.focusDay());
  }

  private onGridKeyDown = (e: KeyboardEvent) => {
    const base = LvCalendar.parseISO(this.focusedDate);
    if (!base) return;
    const d = new Date(base);

    switch (e.key) {
      case "ArrowRight":
        e.preventDefault();
        d.setDate(d.getDate() + 1);
        this.moveFocus(d);
        break;
      case "ArrowLeft":
        e.preventDefault();
        d.setDate(d.getDate() - 1);
        this.moveFocus(d);
        break;
      case "ArrowDown":
        e.preventDefault();
        d.setDate(d.getDate() + 7);
        this.moveFocus(d);
        break;
      case "ArrowUp":
        e.preventDefault();
        d.setDate(d.getDate() - 7);
        this.moveFocus(d);
        break;
      case "Home":
        e.preventDefault();
        d.setDate(d.getDate() - this.dowFromMonday(d));
        this.moveFocus(d);
        break;
      case "End":
        e.preventDefault();
        d.setDate(d.getDate() + (6 - this.dowFromMonday(d)));
        this.moveFocus(d);
        break;
      case "PageUp":
        e.preventDefault();
        d.setMonth(d.getMonth() - 1);
        this.moveFocus(d);
        break;
      case "PageDown":
        e.preventDefault();
        d.setMonth(d.getMonth() + 1);
        this.moveFocus(d);
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        this.select(this.focusedDate);
        break;
    }
  };

  /** Offset of `d` from the configured week-start (0..6), so Home/End land on the visual row. */
  private dowFromMonday(d: Date): number {
    return (d.getDay() - this.weekStart + 7) % 7;
  }

  private weekdayHeaders(): { label: string; full: string }[] {
    const fmtShort = new Intl.DateTimeFormat(this.effectiveLocale, { weekday: "short" });
    const fmtLong = new Intl.DateTimeFormat(this.effectiveLocale, { weekday: "long" });
    // 2024-01-07 is a Sunday; build the 7 weekday labels starting at weekStart.
    const out: { label: string; full: string }[] = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(2024, 0, 7 + ((this.weekStart + i) % 7));
      out.push({ label: fmtShort.format(day), full: fmtLong.format(day) });
    }
    return out;
  }

  private buildWeeks(): (string | null)[][] {
    const first = new Date(this.viewYear, this.viewMonth, 1);
    const lastDay = new Date(this.viewYear, this.viewMonth + 1, 0).getDate();
    const lead = (first.getDay() - this.weekStart + 7) % 7;

    const cells: (string | null)[] = [];
    for (let i = 0; i < lead; i++) cells.push(null);
    for (let day = 1; day <= lastDay; day++) {
      cells.push(
        `${this.viewYear}-${String(this.viewMonth + 1).padStart(2, "0")}-${String(
          day
        ).padStart(2, "0")}`
      );
    }
    while (cells.length % 7 !== 0) cells.push(null);

    const weeks: (string | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
    return weeks;
  }

  private inRange(iso: string): boolean {
    if (this.mode !== "range") return false;
    const sel = this.selection;
    if (sel.length < 2) return false;
    return iso > sel[0] && iso < sel[1];
  }

  render() {
    const monthLabel = new Intl.DateTimeFormat(this.effectiveLocale, {
      month: "long",
      year: "numeric",
    }).format(new Date(this.viewYear, this.viewMonth, 1));
    const dayFmt = new Intl.DateTimeFormat(this.effectiveLocale, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const headers = this.weekdayHeaders();
    const weeks = this.buildWeeks();
    const today = this.todayISO;
    const sel = this.selection;
    const prevDisabled = this.disabled;
    const nextDisabled = this.disabled;

    return html`
      <div class="lv-calendar" role="group" aria-label=${monthLabel}>
        <div class="lv-calendar__header">
          <button
            class="lv-calendar__nav lv-calendar__nav--prev"
            type="button"
            aria-label="Previous month"
            ?disabled=${prevDisabled}
            @click=${this.prevMonth}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
              stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"
            >${unsafeSVG(iconBody("chevron-left"))}</svg>
          </button>
          <span class="lv-calendar__label" aria-live="polite">${monthLabel}</span>
          <button
            class="lv-calendar__nav lv-calendar__nav--next"
            type="button"
            aria-label="Next month"
            ?disabled=${nextDisabled}
            @click=${this.nextMonth}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
              stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"
            >${unsafeSVG(iconBody("chevron-right"))}</svg>
          </button>
        </div>

        <table class="lv-calendar__grid" role="grid" aria-label=${monthLabel}
          @keydown=${this.onGridKeyDown}>
          <thead>
            <tr>
              ${headers.map(
                (h) => html`<th
                  class="lv-calendar__day-header"
                  role="columnheader"
                  scope="col"
                  abbr=${h.full}
                >
                  <span aria-hidden="true">${h.label}</span>
                </th>`
              )}
            </tr>
          </thead>
          <tbody>
            ${weeks.map(
              (week) => html`<tr>
                ${week.map((iso) =>
                  iso
                    ? html`<td class="lv-calendar__cell" role="gridcell"
                        aria-selected=${sel.includes(iso) ? "true" : "false"}>
                        <button
                          class="lv-calendar__day
                            ${sel.includes(iso) ? "lv-calendar__day--selected" : ""}
                            ${iso === sel[0] && sel.length === 2
                              ? "lv-calendar__day--range-start"
                              : ""}
                            ${iso === sel[1] ? "lv-calendar__day--range-end" : ""}
                            ${this.inRange(iso) ? "lv-calendar__day--in-range" : ""}
                            ${iso === today && !sel.includes(iso)
                              ? "lv-calendar__day--today"
                              : ""}"
                          type="button"
                          data-date=${iso}
                          tabindex=${iso === this.focusedDate ? "0" : "-1"}
                          aria-current=${iso === today ? "date" : "false"}
                          aria-label=${dayFmt.format(LvCalendar.parseISO(iso)!)}
                          ?disabled=${this.dayDisabled(iso)}
                          @click=${() => this.select(iso)}
                        >${iso.slice(8).replace(/^0/, "")}</button>
                      </td>`
                    : html`<td class="lv-calendar__cell" role="gridcell"></td>`
                )}
              </tr>`
            )}
          </tbody>
        </table>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "lv-calendar": LvCalendar;
  }
}
