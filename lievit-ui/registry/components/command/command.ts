/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
import { LitElement, html } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { unsafeSVG } from "lit/directives/unsafe-svg.js";
import { adoptLightStyles } from "../light-dom/light-dom.js";
import { iconBody } from "../../icons/icon-bodies.js";

/** A selectable command-palette item. */
export interface CommandItem {
  value: string;
  label: string;
  /** Optional group heading; items with the same group render under one heading. */
  group?: string;
  /** Lucide icon name (vendored) rendered before the label. */
  icon?: string;
  /** Right-aligned hint (e.g. a shortcut). */
  shortcut?: string;
  /** Extra searchable text (synonyms) appended to the filter haystack. */
  keywords?: string;
  disabled?: boolean;
}

/**
 * `<lv-command>`: a searchable command palette / list (issue 444).
 *
 * The light-DOM Lit equivalent of shadcn's `cmdk`-based command. Owns its own
 * filter-as-you-type, keyboard navigation, grouping and empty state, following the
 * WAI-ARIA combobox-with-listbox model:
 * - the search box is `role="combobox"`, `aria-expanded`, `aria-controls` the list,
 *   `aria-activedescendant` the highlighted option;
 * - the list is `role="listbox"`, group headings are `role="presentation"` wrappers
 *   over `role="group"` with `aria-label`;
 * - items are `role="option"` with `aria-selected` on the active one.
 * Keyboard: ArrowUp/Down move (skipping disabled + wrapping), Home/End jump, Enter selects,
 * Escape emits `lv-escape` (so a host dialog can close). Typing filters instantly and resets
 * the active option to the first match.
 *
 * Data down, events up: `lv-select` fires with the chosen item's `value`. The search icon
 * comes from the vendored Lucide map (`iconBody`), never Font Awesome.
 *
 * Often opened inside a dialog (command-dialog): wrap `<lv-command>` in `<lv-dialog open>`
 * and listen for `lv-escape`/`lv-select` to close it (see meta.json docs). Light-DOM rendered.
 */
@customElement("lv-command")
export class LvCommand extends LitElement {
  /** Available items. */
  @property({ type: Array }) items: CommandItem[] = [];

  /** Controlled search query. */
  @property() query = "";

  /** Placeholder for the search box. */
  @property() placeholder = "Type a command or search…";

  /** Text shown when nothing matches. */
  @property() emptyText = "No results found.";

  /** Accessible label for the palette. */
  @property() label = "Command palette";

  @state() private activeIndex = 0;

  private static seq = 0;
  private readonly listId = `lv-command-list-${LvCommand.seq++}`;

  createRenderRoot(): this {
    adoptLightStyles("lv-command", LvCommand.css);
    return this;
  }

  static readonly css = `
    .lv-command {
      display: flex;
      flex-direction: column;
      width: 100%;
      background: var(--lv-color-bg);
      color: var(--lv-color-fg);
      border: 1px solid var(--lv-color-border);
      border-radius: var(--lv-radius-md);
      box-shadow: var(--lv-shadow-md);
      overflow: hidden;
    }
    .lv-command__search-wrap {
      display: flex;
      align-items: center;
      gap: var(--lv-space-2);
      padding: var(--lv-space-3);
      border-bottom: 1px solid var(--lv-color-border);
    }
    .lv-command__search-icon {
      flex-shrink: 0;
      width: 1rem;
      height: 1rem;
      color: var(--lv-color-muted);
    }
    .lv-command__search {
      flex: 1;
      min-width: 0;
      font-family: var(--lv-font-sans);
      font-size: var(--lv-text-base);
      color: var(--lv-color-fg);
      background: transparent;
      border: 0;
      outline: none;
      padding: 0;
    }
    .lv-command__search::placeholder { color: var(--lv-color-muted); }
    .lv-command__list {
      overflow-y: auto;
      max-height: 20rem;
      padding: var(--lv-space-1);
      margin: 0;
      list-style: none;
    }
    .lv-command__group-label {
      font-family: var(--lv-font-sans);
      font-size: var(--lv-text-sm);
      font-weight: 600;
      color: var(--lv-color-muted);
      padding: var(--lv-space-2) var(--lv-space-2) var(--lv-space-1);
    }
    .lv-command__item {
      display: flex;
      align-items: center;
      gap: var(--lv-space-2);
      font-family: var(--lv-font-sans);
      font-size: var(--lv-text-sm);
      color: var(--lv-color-fg);
      padding: var(--lv-space-2) var(--lv-space-2);
      border-radius: var(--lv-radius-sm);
      cursor: pointer;
    }
    .lv-command__item--active { background: color-mix(in srgb, var(--lv-color-primary) 12%, var(--lv-color-bg)); }
    .lv-command__item--disabled { opacity: 0.5; cursor: not-allowed; pointer-events: none; }
    .lv-command__item-icon { flex-shrink: 0; width: 1rem; height: 1rem; color: var(--lv-color-muted); display: inline-flex; }
    .lv-command__item-label { flex: 1; min-width: 0; }
    .lv-command__item-shortcut {
      flex-shrink: 0;
      font-size: var(--lv-text-sm);
      color: var(--lv-color-muted);
      letter-spacing: 0.08em;
    }
    .lv-command__empty {
      font-family: var(--lv-font-sans);
      font-size: var(--lv-text-sm);
      color: var(--lv-color-muted);
      padding: var(--lv-space-4) var(--lv-space-3);
      text-align: center;
    }
  `;

  private get filtered(): CommandItem[] {
    const q = this.query.trim().toLowerCase();
    if (!q) return this.items;
    return this.items.filter((it) =>
      `${it.label} ${it.keywords ?? ""} ${it.group ?? ""}`.toLowerCase().includes(q)
    );
  }

  /** Filtered items grouped in first-seen group order, ungrouped first. */
  private get groups(): Array<{ name: string | undefined; items: CommandItem[] }> {
    const order: (string | undefined)[] = [];
    const map = new Map<string | undefined, CommandItem[]>();
    for (const it of this.filtered) {
      const g = it.group;
      if (!map.has(g)) {
        map.set(g, []);
        order.push(g);
      }
      map.get(g)!.push(it);
    }
    return order.map((name) => ({ name, items: map.get(name)! }));
  }

  /** A flat, render-order id for each filtered item, used by aria-activedescendant. */
  private optionId(index: number): string {
    return `${this.listId}-opt-${index}`;
  }

  private onInput(e: Event) {
    this.query = (e.target as HTMLInputElement).value;
    this.activeIndex = this.firstEnabledIndex();
  }

  private firstEnabledIndex(): number {
    const f = this.filtered;
    const i = f.findIndex((it) => !it.disabled);
    return i === -1 ? 0 : i;
  }

  private move(delta: number) {
    const f = this.filtered;
    const len = f.length;
    if (len === 0) return;
    let idx = this.activeIndex;
    for (let step = 0; step < len; step++) {
      idx = (idx + delta + len) % len;
      if (!f[idx]?.disabled) {
        this.activeIndex = idx;
        return;
      }
    }
  }

  private onKeyDown(e: KeyboardEvent) {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        this.move(1);
        break;
      case "ArrowUp":
        e.preventDefault();
        this.move(-1);
        break;
      case "Home":
        e.preventDefault();
        this.activeIndex = this.firstEnabledIndex();
        break;
      case "End": {
        e.preventDefault();
        const f = this.filtered;
        for (let i = f.length - 1; i >= 0; i--) {
          if (!f[i].disabled) {
            this.activeIndex = i;
            break;
          }
        }
        break;
      }
      case "Enter": {
        e.preventDefault();
        const item = this.filtered[this.activeIndex];
        if (item) this.select(item);
        break;
      }
      case "Escape":
        e.preventDefault();
        this.dispatchEvent(
          new CustomEvent("lv-escape", { bubbles: true, composed: true })
        );
        break;
    }
    this.scrollActiveIntoView();
  }

  private scrollActiveIntoView() {
    this.updateComplete.then(() => {
      this.querySelector(".lv-command__item--active")?.scrollIntoView({ block: "nearest" });
    });
  }

  private select(item: CommandItem) {
    if (item.disabled) return;
    this.dispatchEvent(
      new CustomEvent("lv-select", { detail: item.value, bubbles: true, composed: true })
    );
  }

  render() {
    const f = this.filtered;
    const groups = this.groups;
    let flatIndex = -1;

    return html`
      <div class="lv-command" role="combobox" aria-label=${this.label}
        aria-expanded="true" aria-haspopup="listbox" aria-owns=${this.listId}>
        <div class="lv-command__search-wrap">
          <span class="lv-command__search-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
              stroke-linecap="round" stroke-linejoin="round" width="16" height="16">
              ${unsafeSVG(iconBody("search"))}
            </svg>
          </span>
          <input
            class="lv-command__search"
            type="text"
            role="combobox"
            placeholder=${this.placeholder}
            aria-label=${this.label}
            aria-autocomplete="list"
            aria-expanded="true"
            aria-controls=${this.listId}
            aria-activedescendant=${f.length > 0 ? this.optionId(this.activeIndex) : ""}
            .value=${this.query}
            @input=${this.onInput}
            @keydown=${this.onKeyDown}
          />
        </div>

        <ul class="lv-command__list" id=${this.listId} role="listbox" aria-label=${this.label}>
          ${f.length === 0
            ? html`<li class="lv-command__empty" role="presentation">${this.emptyText}</li>`
            : groups.map((g) => html`
              <li role="presentation">
                <div role="group" aria-label=${g.name || this.label}>
                  ${g.name
                    ? html`<div class="lv-command__group-label" role="presentation">${g.name}</div>`
                    : null}
                  <ul role="presentation" style="list-style:none;margin:0;padding:0;">
                    ${g.items.map((it) => {
                      flatIndex++;
                      const idx = flatIndex;
                      return html`
                        <li
                          id=${this.optionId(idx)}
                          class="lv-command__item
                            ${idx === this.activeIndex ? "lv-command__item--active" : ""}
                            ${it.disabled ? "lv-command__item--disabled" : ""}"
                          role="option"
                          aria-selected=${idx === this.activeIndex ? "true" : "false"}
                          aria-disabled=${it.disabled ? "true" : "false"}
                          @click=${() => this.select(it)}
                          @mousemove=${() => { if (!it.disabled) this.activeIndex = idx; }}
                        >
                          ${it.icon
                            ? html`<span class="lv-command__item-icon" aria-hidden="true">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                  stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
                                  width="16" height="16">${unsafeSVG(iconBody(it.icon))}</svg>
                              </span>`
                            : null}
                          <span class="lv-command__item-label">${it.label}</span>
                          ${it.shortcut
                            ? html`<span class="lv-command__item-shortcut">${it.shortcut}</span>`
                            : null}
                        </li>
                      `;
                    })}
                  </ul>
                </div>
              </li>
            `)}
        </ul>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "lv-command": LvCommand;
  }
}
