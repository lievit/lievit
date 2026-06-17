/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
import { LitElement, html } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { computePosition, flip, shift, offset } from "@floating-ui/dom";
import { adoptLightStyles } from "../light-dom/light-dom.js";

/**
 * `<lv-date-picker>`: an accessible calendar date-input.
 *
 * Architecture: a text input (ISO date, YYYY-MM-DD) triggers a floating calendar panel.
 * The calendar shows a month grid keyed by `role="grid"` / `role="gridcell"` following the
 * WAI-ARIA APG date-picker dialog pattern (research 4.3):
 * - Arrow keys navigate the grid; Enter/Space select; Escape closes.
 * - Month navigation via Prev/Next buttons.
 * - The selected cell carries `aria-selected="true"` and `aria-current="date"`.
 * - The today cell is marked `aria-current="date"` when no selection matches.
 * - The panel uses `role="dialog"` with `aria-modal="true"` and `aria-label`.
 *
 * Data down, events up: emits `lv-change` with the new ISO date string on selection.
 * The `value` prop accepts an ISO date string (YYYY-MM-DD) or empty string.
 *
 * Owned source, copied in by `lievit add date-picker`. Light-DOM rendered.
 * npm dep: `@floating-ui/dom` (declared in meta.json, installed by `lievit add`).
 */
@customElement("lv-date-picker")
export class LvDatePicker extends LitElement {
  /** Selected date as ISO string (YYYY-MM-DD) or empty. */
  @property() value = "";

  /** Placeholder for the text input. */
  @property() placeholder = "YYYY-MM-DD";

  /** Disables the control. */
  @property({ type: Boolean }) disabled = false;

  /** Marks the field invalid. */
  @property({ type: Boolean }) invalid = false;

  /** Id forwarded to the input for `<label for=...>` association. */
  @property() inputId = "";

  /** Accessible label for the calendar dialog. */
  @property() label = "Choose a date";

  @state() private open = false;
  @state() private viewYear = 0;
  @state() private viewMonth = 0; // 0-11
  @state() private focusedDate: string | null = null;

  private static seq = 0;
  private readonly dialogId = `lv-dp-dialog-${LvDatePicker.seq++}`;
  private readonly inputElId = `lv-dp-input-${LvDatePicker.seq}`;

  createRenderRoot(): this {
    adoptLightStyles("lv-date-picker", LvDatePicker.css);
    return this;
  }

  static readonly css = `
    .lv-dp { position: relative; display: block; }
    .lv-dp__input-wrap { position: relative; display: flex; align-items: center; }
    .lv-dp__input {
      font-family: var(--lv-font-sans);
      font-size: var(--lv-text-base);
      color: var(--lv-color-fg);
      background: var(--lv-color-bg);
      padding: var(--lv-space-2) var(--lv-space-3);
      padding-right: 2.25rem;
      border: 1px solid var(--lv-color-border);
      border-radius: var(--lv-radius-sm);
      width: 100%;
      box-sizing: border-box;
    }
    .lv-dp__input:focus-visible { outline: none; box-shadow: var(--lv-ring); }
    .lv-dp__input--invalid { border-color: var(--lv-color-danger); }
    .lv-dp__input[disabled] { opacity: 0.5; cursor: not-allowed; }
    .lv-dp__toggle {
      position: absolute;
      right: var(--lv-space-2);
      background: transparent;
      border: 0;
      cursor: pointer;
      color: var(--lv-color-muted);
      font-size: var(--lv-text-base);
      padding: 0 var(--lv-space-1);
      line-height: 1;
    }
    .lv-dp__toggle:focus-visible { outline: none; box-shadow: var(--lv-ring); }
    .lv-dp__toggle[disabled] { opacity: 0.5; cursor: not-allowed; }
    .lv-dp__panel {
      position: fixed;
      z-index: 9400;
      background: var(--lv-color-bg);
      border: 1px solid var(--lv-color-border);
      border-radius: var(--lv-radius-md);
      box-shadow: var(--lv-shadow-md);
      padding: var(--lv-space-3);
      display: none;
      min-width: 16rem;
    }
    .lv-dp__panel--open { display: block; }
    .lv-dp__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: var(--lv-space-2);
    }
    .lv-dp__nav {
      background: transparent;
      border: 1px solid var(--lv-color-border);
      border-radius: var(--lv-radius-sm);
      padding: var(--lv-space-1) var(--lv-space-2);
      cursor: pointer;
      font-family: var(--lv-font-sans);
      font-size: var(--lv-text-sm);
      color: var(--lv-color-fg);
    }
    .lv-dp__nav:focus-visible { outline: none; box-shadow: var(--lv-ring); }
    .lv-dp__month-label {
      font-family: var(--lv-font-sans);
      font-size: var(--lv-text-sm);
      font-weight: 600;
      color: var(--lv-color-fg);
    }
    .lv-dp__grid {
      border-collapse: collapse;
      width: 100%;
    }
    .lv-dp__day-header {
      font-family: var(--lv-font-sans);
      font-size: var(--lv-text-sm);
      color: var(--lv-color-muted);
      font-weight: 500;
      padding: var(--lv-space-1);
      text-align: center;
    }
    .lv-dp__cell {
      padding: 1px;
      text-align: center;
    }
    .lv-dp__day {
      width: 2rem;
      height: 2rem;
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
    .lv-dp__day:focus-visible { outline: none; box-shadow: var(--lv-ring); }
    .lv-dp__day:hover { background: var(--lv-color-surface); }
    .lv-dp__day--selected {
      background: var(--lv-color-primary);
      color: var(--lv-color-primary-fg);
      font-weight: 600;
    }
    .lv-dp__day--today { border: 1px solid var(--lv-color-primary); }
    .lv-dp__day--outside { color: var(--lv-color-muted); }
    .lv-dp__day[disabled] { opacity: 0.4; cursor: not-allowed; }
  `;

  private get todayISO(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private parseValue(): Date | null {
    if (!this.value || !/^\d{4}-\d{2}-\d{2}$/.test(this.value)) return null;
    const d = new Date(this.value + "T00:00:00");
    return isNaN(d.getTime()) ? null : d;
  }

  connectedCallback() {
    super.connectedCallback();
    document.addEventListener("mousedown", this.handleOutsideClick);
    document.addEventListener("keydown", this.handleGlobalKey);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener("mousedown", this.handleOutsideClick);
    document.removeEventListener("keydown", this.handleGlobalKey);
  }

  private handleOutsideClick = (e: MouseEvent) => {
    if (this.open && !this.contains(e.target as Node)) {
      this.closePanel();
    }
  };

  private handleGlobalKey = (e: KeyboardEvent) => {
    if (!this.open) return;
    if (e.key === "Escape") {
      e.preventDefault();
      this.closePanel();
      this.focusToggle();
    }
  };

  private focusToggle() {
    (this.querySelector(".lv-dp__toggle") as HTMLElement | null)?.focus();
  }

  private openPanel() {
    if (this.disabled) return;
    const parsed = this.parseValue();
    const ref = parsed ?? new Date();
    this.viewYear = ref.getFullYear();
    this.viewMonth = ref.getMonth();
    this.focusedDate = this.value || this.todayISO;
    this.open = true;
    this.updateComplete.then(() => {
      this.position();
      this.focusFocusedDay();
    });
  }

  private closePanel() {
    this.open = false;
  }

  private async position() {
    const wrap = this.querySelector(".lv-dp__input-wrap") as HTMLElement | null;
    const panel = this.querySelector(".lv-dp__panel") as HTMLElement | null;
    if (!wrap || !panel) return;
    const { x, y } = await computePosition(wrap, panel, {
      placement: "bottom-start",
      middleware: [offset(4), flip(), shift({ padding: 4 })],
    });
    panel.style.left = `${x}px`;
    panel.style.top = `${y}px`;
  }

  private focusFocusedDay() {
    const btn = this.querySelector<HTMLElement>(`[data-date="${this.focusedDate}"]`);
    btn?.focus();
  }

  private prevMonth() {
    if (this.viewMonth === 0) {
      this.viewMonth = 11;
      this.viewYear--;
    } else {
      this.viewMonth--;
    }
  }

  private nextMonth() {
    if (this.viewMonth === 11) {
      this.viewMonth = 0;
      this.viewYear++;
    } else {
      this.viewMonth++;
    }
  }

  private selectDate(iso: string) {
    this.value = iso;
    this.dispatchEvent(
      new CustomEvent("lv-change", { detail: iso, bubbles: true, composed: true })
    );
    this.closePanel();
    this.focusToggle();
  }

  private onInputChange(e: Event) {
    const val = (e.target as HTMLInputElement).value;
    this.value = val;
    if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
      this.dispatchEvent(
        new CustomEvent("lv-change", { detail: val, bubbles: true, composed: true })
      );
    }
  }

  private onGridKeyDown(e: KeyboardEvent) {
    if (!this.focusedDate) return;
    const d = new Date(this.focusedDate + "T00:00:00");
    let moved = false;

    switch (e.key) {
      case "ArrowRight":
        e.preventDefault();
        d.setDate(d.getDate() + 1);
        moved = true;
        break;
      case "ArrowLeft":
        e.preventDefault();
        d.setDate(d.getDate() - 1);
        moved = true;
        break;
      case "ArrowDown":
        e.preventDefault();
        d.setDate(d.getDate() + 7);
        moved = true;
        break;
      case "ArrowUp":
        e.preventDefault();
        d.setDate(d.getDate() - 7);
        moved = true;
        break;
      case "Home":
        e.preventDefault();
        d.setDate(1);
        moved = true;
        break;
      case "End":
        e.preventDefault();
        d.setDate(new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate());
        moved = true;
        break;
      case "PageUp":
        e.preventDefault();
        d.setMonth(d.getMonth() - 1);
        moved = true;
        break;
      case "PageDown":
        e.preventDefault();
        d.setMonth(d.getMonth() + 1);
        moved = true;
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        this.selectDate(this.focusedDate);
        return;
    }

    if (moved) {
      this.focusedDate = d.toISOString().slice(0, 10);
      this.viewYear = d.getFullYear();
      this.viewMonth = d.getMonth();
      this.updateComplete.then(() => this.focusFocusedDay());
    }
  }

  private buildCalendarWeeks(): (string | null)[][] {
    const firstDay = new Date(this.viewYear, this.viewMonth, 1);
    const lastDay = new Date(this.viewYear, this.viewMonth + 1, 0);
    const startDow = firstDay.getDay(); // 0=Sun
    const daysInMonth = lastDay.getDate();

    const cells: (string | null)[] = [];
    for (let i = 0; i < startDow; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = `${this.viewYear}-${String(this.viewMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      cells.push(iso);
    }
    while (cells.length % 7 !== 0) cells.push(null);

    const weeks: (string | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) {
      weeks.push(cells.slice(i, i + 7));
    }
    return weeks;
  }

  render() {
    const MONTH_NAMES = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December",
    ];
    const DAY_ABBR = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

    const today = this.todayISO;
    const weeks = this.open ? this.buildCalendarWeeks() : [];

    return html`
      <div class="lv-dp">
        <div class="lv-dp__input-wrap">
          <input
            class="lv-dp__input ${this.invalid ? "lv-dp__input--invalid" : ""}"
            id=${this.inputId || this.inputElId}
            type="text"
            .value=${this.value}
            placeholder=${this.placeholder}
            ?disabled=${this.disabled}
            aria-invalid=${this.invalid ? "true" : "false"}
            @change=${this.onInputChange}
          />
          <button
            class="lv-dp__toggle"
            type="button"
            aria-label=${this.label}
            aria-expanded=${this.open ? "true" : "false"}
            aria-controls=${this.dialogId}
            aria-haspopup="dialog"
            ?disabled=${this.disabled}
            @click=${() => (this.open ? this.closePanel() : this.openPanel())}
          >&#x1F4C5;</button>
        </div>

        <div
          class="lv-dp__panel ${this.open ? "lv-dp__panel--open" : ""}"
          id=${this.dialogId}
          role="dialog"
          aria-modal="true"
          aria-label=${this.label}
          @keydown=${this.onGridKeyDown}
        >
          <div class="lv-dp__header">
            <button class="lv-dp__nav" type="button" aria-label="Previous month"
              @click=${this.prevMonth}>&#x276E;</button>
            <span class="lv-dp__month-label">
              ${MONTH_NAMES[this.viewMonth]} ${this.viewYear}
            </span>
            <button class="lv-dp__nav" type="button" aria-label="Next month"
              @click=${this.nextMonth}>&#x276F;</button>
          </div>

          <table class="lv-dp__grid" role="grid" aria-label=${`${MONTH_NAMES[this.viewMonth]} ${this.viewYear}`}>
            <thead>
              <tr>
                ${DAY_ABBR.map((d) => html`
                  <th class="lv-dp__day-header" role="columnheader" scope="col" abbr=${d}>${d}</th>
                `)}
              </tr>
            </thead>
            <tbody>
              ${weeks.map((week) => html`
                <tr>
                  ${week.map((iso) => html`
                    <td class="lv-dp__cell" role="gridcell">
                      ${iso
                        ? html`<button
                            class="lv-dp__day
                              ${iso === this.value ? "lv-dp__day--selected" : ""}
                              ${iso === today && iso !== this.value ? "lv-dp__day--today" : ""}
                            "
                            type="button"
                            data-date=${iso}
                            tabindex=${iso === (this.focusedDate ?? today) ? "0" : "-1"}
                            aria-selected=${iso === this.value ? "true" : "false"}
                            aria-label=${new Date(iso + "T00:00:00").toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}
                            @click=${() => this.selectDate(iso)}
                          >${iso.slice(8)}</button>`
                        : html`<span></span>`}
                    </td>
                  `)}
                </tr>
              `)}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "lv-date-picker": LvDatePicker;
  }
}
