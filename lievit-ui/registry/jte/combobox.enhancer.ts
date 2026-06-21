/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * combobox enhancer (ADR-0012, server-first + progressive enhancement): the CSP-clean typed-TS that
 * UPGRADES the server-rendered `lievit/combobox.jte` partial from its JS-off native <select> into a
 * searchable WAI-ARIA combobox. The catalog, the selected value(s) and the form-bound <select> are
 * all server-rendered HTML; this module reads the rendered <option>s, builds a filterable listbox on
 * top, and writes every selection BACK to the native <select> (dispatching native input/change so
 * `l:model` and a plain form both see it). The native <select> stays in the DOM as the source of
 * truth, so the field is form-associated and POSTs the same `name` whether or not JS ran -- the
 * combobox is purely additive. No inline script (the strict CSP refuses inline on* handlers; this
 * attaches listeners in code instead).
 *
 * It is deliberately stateless server-side for the small/preloaded catalog: there is nothing for the
 * server to decide between keystrokes once the options are on the page, so there is no per-keystroke
 * wire round-trip (the lazy/server-search case is the separate WIRE rich-select). The value is bound
 * at POST via the native <select>.
 *
 * The pure filter logic ({@link filterOptions}) is exported so it can be unit-tested without a DOM.
 *
 * Idempotent: call {@link enhanceCombobox} once (it marks each root) and again after a DOM swap;
 * already-enhanced roots are skipped. {@link enhanceAllComboboxes} wires every root on the page.
 */

const ENHANCED = "data-combobox-enhanced";

/** A flat option read off the native <select>: its value, visible label, group and disabled state. */
export interface ComboboxOption {
  value: string;
  label: string;
  group: string | null;
  disabled: boolean;
}

/**
 * Filter a flat option list by a query, case- and accent-insensitively, matching anywhere in the
 * label (substring), preserving order. The pure core of the searchable behaviour; DOM-free so it is
 * unit-testable. An empty/blank query returns every option unchanged.
 */
export function filterOptions(options: ComboboxOption[], query: string): ComboboxOption[] {
  const q = normalize(query);
  if (q === "") return options.slice();
  return options.filter((o) => normalize(o.label).includes(q));
}

/** Lowercase + strip diacritics so "Citta" matches "città" and case never blocks a match. */
function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

/** Read the flat option list off a native <select> (skips the placeholder option, value===""). */
function readOptions(select: HTMLSelectElement): ComboboxOption[] {
  const out: ComboboxOption[] = [];
  for (const opt of Array.from(select.options)) {
    if (opt.value === "" && opt.disabled) continue; // the placeholder pseudo-option
    const parent = opt.parentElement;
    const group =
      parent instanceof HTMLOptGroupElement ? parent.label : null;
    out.push({
      value: opt.value,
      label: opt.textContent?.trim() ?? "",
      group,
      disabled: opt.disabled,
    });
  }
  return out;
}

/** The current selection of a (possibly multiple) native <select>, as a value set. */
function selectedValues(select: HTMLSelectElement): Set<string> {
  return new Set(
    Array.from(select.selectedOptions)
      .map((o) => o.value)
      .filter((v) => v !== ""),
  );
}

/** Push a selection back onto the native <select> and fire native input/change (for l:model + forms). */
function writeSelection(select: HTMLSelectElement, values: Set<string>): void {
  // Single select: assign `value` (the canonical, environment-robust path that swaps the one
  // selection). Multiple: set `selected` per option. In both cases mirror the `selected` content
  // attribute so a re-serialized / morphed DOM keeps the right POST state.
  if (!select.multiple) {
    select.value = values.size > 0 ? Array.from(values)[0] : "";
  }
  for (const opt of Array.from(select.options)) {
    const on = values.has(opt.value);
    if (select.multiple) opt.selected = on;
    if (on) opt.setAttribute("selected", "");
    else opt.removeAttribute("selected");
  }
  select.dispatchEvent(new Event("input", { bubbles: true }));
  select.dispatchEvent(new Event("change", { bubbles: true }));
}

/**
 * Enhance one combobox root. No-op if it has no native <select> or is already enhanced.
 * Builds the search input + listbox, hides the native <select> from sight + AT (kept for the form),
 * and wires filter + APG keyboard navigation + selection write-back.
 */
export function enhanceCombobox(root: HTMLElement): void {
  if (root.hasAttribute(ENHANCED)) return;
  const select = root.querySelector<HTMLSelectElement>("[data-combobox-native]");
  if (!select) return;
  root.setAttribute(ENHANCED, "");

  const multiple = root.getAttribute("data-multiple") === "true";
  const disabled = root.getAttribute("data-disabled") === "true";
  const invalid = root.getAttribute("data-invalid") === "true";
  const listboxId = root.getAttribute("data-listbox-id") ?? `${select.id}-listbox`;
  const searchId = root.getAttribute("data-search-id") ?? `${select.id}-search`;
  const searchPlaceholder = root.getAttribute("data-search-placeholder") ?? "Search...";
  const emptyText = root.getAttribute("data-empty-text") ?? "No results";
  const placeholder = root.getAttribute("data-placeholder") ?? "";

  const options = readOptions(select);
  const selected = selectedValues(select);

  // Hide the native control from sight + AT, but keep it in the DOM as the form-bound source.
  const nativeWrapper = root.querySelector<HTMLElement>("[data-slot='combobox-native-wrapper']");
  if (nativeWrapper) nativeWrapper.style.display = "none";
  select.setAttribute("aria-hidden", "true");
  select.tabIndex = -1;

  // --- build the combobox surface ---
  const surface = document.createElement("div");
  surface.setAttribute("data-slot", "combobox-surface");

  // chips (multiple only)
  const chips = document.createElement("div");
  chips.setAttribute("data-slot", "combobox-chips");
  chips.setAttribute("data-combobox-chips", "");
  if (multiple) surface.appendChild(chips);

  const search = document.createElement("input");
  search.type = "text";
  search.id = searchId;
  search.setAttribute("data-slot", "combobox-input");
  search.setAttribute("data-combobox-search", "");
  search.setAttribute("role", "combobox");
  search.setAttribute("aria-expanded", "false");
  search.setAttribute("aria-controls", listboxId);
  search.setAttribute("aria-autocomplete", "list");
  search.setAttribute("autocomplete", "off");
  if (invalid) search.setAttribute("aria-invalid", "true");
  if (disabled) search.disabled = true;
  search.placeholder = placeholder !== "" && selected.size === 0 ? placeholder : searchPlaceholder;
  surface.appendChild(search);

  const listbox = document.createElement("ul");
  listbox.id = listboxId;
  listbox.setAttribute("role", "listbox");
  listbox.setAttribute("data-slot", "combobox-content");
  listbox.setAttribute("data-combobox-listbox", "");
  if (multiple) listbox.setAttribute("aria-multiselectable", "true");
  listbox.hidden = true;
  surface.appendChild(listbox);

  root.appendChild(surface);

  let activeIndex = -1;
  let visible: ComboboxOption[] = options.slice();

  const renderChips = (): void => {
    if (!multiple) return;
    chips.replaceChildren();
    for (const value of selected) {
      const opt = options.find((o) => o.value === value);
      const chip = document.createElement("button");
      chip.type = "button";
      chip.setAttribute("data-slot", "combobox-chip");
      chip.setAttribute("data-combobox-chip", value);
      chip.setAttribute("aria-label", `Remove ${opt?.label ?? value}`);
      chip.textContent = opt?.label ?? value;
      chip.addEventListener("click", () => {
        selected.delete(value);
        writeSelection(select, selected);
        renderChips();
        renderList();
      });
      chips.appendChild(chip);
    }
  };

  const renderList = (): void => {
    listbox.replaceChildren();
    if (visible.length === 0) {
      const empty = document.createElement("li");
      empty.setAttribute("data-slot", "combobox-empty");
      empty.setAttribute("data-combobox-empty", "");
      empty.setAttribute("role", "presentation");
      empty.textContent = emptyText;
      listbox.appendChild(empty);
      return;
    }
    visible.forEach((opt, index) => {
      const li = document.createElement("li");
      li.setAttribute("role", "option");
      li.setAttribute("data-slot", "combobox-item");
      li.setAttribute("data-combobox-option", opt.value);
      const isSelected = selected.has(opt.value);
      li.setAttribute("aria-selected", String(isSelected));
      if (index === activeIndex) li.setAttribute("data-combobox-active", "true");
      if (opt.disabled) li.setAttribute("aria-disabled", "true");
      li.textContent = opt.label;
      li.addEventListener("mousedown", (e) => e.preventDefault()); // keep focus on the input
      li.addEventListener("click", () => {
        if (opt.disabled) return;
        choose(opt.value);
      });
      listbox.appendChild(li);
    });
  };

  const setActive = (index: number): void => {
    activeIndex = visible.length === 0 ? -1 : (index + visible.length) % visible.length;
    Array.from(listbox.querySelectorAll<HTMLElement>("[data-combobox-option]")).forEach((el, i) => {
      if (i === activeIndex) el.setAttribute("data-combobox-active", "true");
      else el.removeAttribute("data-combobox-active");
    });
  };

  const open = (): void => {
    if (disabled) return;
    listbox.hidden = false;
    search.setAttribute("aria-expanded", "true");
  };
  const close = (): void => {
    listbox.hidden = true;
    search.setAttribute("aria-expanded", "false");
    activeIndex = -1;
  };

  const choose = (value: string): void => {
    if (multiple) {
      if (selected.has(value)) selected.delete(value);
      else selected.add(value);
      writeSelection(select, selected);
      renderChips();
      search.value = "";
      applyFilter("");
      renderList();
      search.focus();
    } else {
      selected.clear();
      selected.add(value);
      writeSelection(select, selected);
      const opt = options.find((o) => o.value === value);
      search.value = opt?.label ?? value;
      close();
    }
  };

  const applyFilter = (query: string): void => {
    visible = filterOptions(options, query);
    activeIndex = -1;
  };

  search.addEventListener("input", () => {
    applyFilter(search.value);
    open();
    renderList();
  });
  search.addEventListener("focus", () => {
    // Focus opens the FULL list (a combobox shows every option on open); the first keystroke filters.
    // The input keeps displaying the selected label, but it is not used as a filter until typed into.
    applyFilter("");
    open();
    renderList();
    if (!multiple) search.select(); // select-all so the first keystroke replaces the shown label
  });
  search.addEventListener("keydown", (e: KeyboardEvent) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        if (listbox.hidden) open();
        setActive(activeIndex + 1);
        break;
      case "ArrowUp":
        e.preventDefault();
        if (listbox.hidden) open();
        setActive(activeIndex - 1);
        break;
      case "Enter":
        if (!listbox.hidden && activeIndex >= 0 && activeIndex < visible.length) {
          e.preventDefault();
          const opt = visible[activeIndex];
          if (!opt.disabled) choose(opt.value);
        }
        break;
      case "Escape":
        if (!listbox.hidden) {
          e.preventDefault();
          close();
        }
        break;
      default:
        break;
    }
  });

  // outside-click dismiss (no library, no inline handler).
  document.addEventListener("click", (e) => {
    if (!root.contains(e.target as Node)) close();
  });

  // seed: single-mode shows the current label in the input; multiple shows chips.
  if (!multiple) {
    const current = Array.from(selected)[0];
    if (current) {
      const opt = options.find((o) => o.value === current);
      search.value = opt?.label ?? current;
    }
  } else {
    renderChips();
  }
  renderList();
}

/** Enhance every `[data-lievit-combobox]` root in scope (call on load + after DOM swaps). */
export function enhanceAllComboboxes(scope: ParentNode = document): void {
  scope
    .querySelectorAll<HTMLElement>("[data-lievit-combobox]")
    .forEach((root) => enhanceCombobox(root));
}
