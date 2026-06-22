/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * command-palette enhancer (ADR-0012, server-first + progressive enhancement): the CSP-clean
 * typed-TS that UPGRADES the server-rendered `lievit/command.jte` partial. The WHOLE command catalog
 * is already on the page as real <a>/<button> items; this module reads their labels, filters them by
 * the search query (hiding non-matches, no re-render, no server round-trip) and wires APG keyboard
 * navigation (ArrowUp/Down move an active item, Enter activates it, Escape clears the query). JS-off
 * the partial is a plain navigable list; this is purely additive. No inline script (the strict CSP
 * refuses inline on* handlers; this attaches listeners in code).
 *
 * It is deliberately stateless server-side: there is nothing for the server to decide between
 * keystrokes once the small/preloaded catalog is on the page, which is exactly the line between this
 * and the WIRE command (registry/wire/command, which re-queries the server per keystroke for a
 * large/lazy/server-owned catalog).
 *
 * The pure filter logic ({@link commandFilter}) is exported so it can be unit-tested without a DOM.
 *
 * Idempotent: call {@link enhanceCommand} once (it marks each root) and again after a DOM swap;
 * already-enhanced roots are skipped. {@link enhanceAllCommands} wires every root on the page.
 */

const ENHANCED = "data-command-enhanced";

/**
 * Decide, for each item label, whether it matches a query. Case- and accent-insensitive substring
 * match anywhere in the label, preserving order. An empty/blank query matches every item. The pure
 * core of the searchable behaviour; DOM-free so it is unit-testable.
 *
 * @returns a boolean array index-aligned with `labels`: true == the item is shown.
 */
export function commandFilter(labels: string[], query: string): boolean[] {
  const q = normalize(query);
  if (q === "") return labels.map(() => true);
  return labels.map((label) => normalize(label).includes(q));
}

/** Lowercase + strip diacritics so "Citta" matches "città" and case never blocks a match. */
function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

/**
 * Enhance one command-palette root. No-op if it lacks a search box / list or is already enhanced.
 * Wires live filtering (hide non-matching items + their now-empty group headings, toggle the empty
 * state) and ArrowUp/Down/Enter/Escape keyboard navigation over the VISIBLE items.
 */
export function enhanceCommand(root: HTMLElement): void {
  if (root.hasAttribute(ENHANCED)) return;
  const search = root.querySelector<HTMLInputElement>("[data-command-search]");
  const list = root.querySelector<HTMLElement>("[data-command-list]");
  if (!search || !list) return;
  root.setAttribute(ENHANCED, "");

  const items = Array.from(root.querySelectorAll<HTMLElement>("[data-command-item]"));
  const headings = Array.from(root.querySelectorAll<HTMLElement>("[data-command-group]"));
  const empty = root.querySelector<HTMLElement>("[data-command-empty]");
  const labels = items.map((el) => el.getAttribute("data-command-label") ?? "");

  let activeIndex = -1;

  /** The currently-visible (un-hidden) items, in DOM order. */
  const visibleItems = (): HTMLElement[] => items.filter((el) => !el.hidden);

  const setActive = (next: number): void => {
    const vis = visibleItems();
    if (vis.length === 0) {
      activeIndex = -1;
      search.removeAttribute("aria-activedescendant");
      items.forEach((el) => el.removeAttribute("data-command-active"));
      return;
    }
    activeIndex = ((next % vis.length) + vis.length) % vis.length;
    const active = vis[activeIndex];
    items.forEach((el) => el.removeAttribute("data-command-active"));
    active.setAttribute("data-command-active", "true");
    if (active.id) search.setAttribute("aria-activedescendant", active.id);
    active.scrollIntoView({ block: "nearest" });
  };

  const applyFilter = (query: string): void => {
    const shown = commandFilter(labels, query);
    items.forEach((el, i) => {
      el.hidden = !shown[i];
    });
    // a group heading is shown only if at least one item under it (up to the next heading) is shown.
    for (const heading of headings) {
      let visible = false;
      let node: Element | null = heading.nextElementSibling;
      while (node && !node.hasAttribute("data-command-group")) {
        if (node.hasAttribute("data-command-item") && !(node as HTMLElement).hidden) {
          visible = true;
          break;
        }
        node = node.nextElementSibling;
      }
      heading.hidden = !visible;
    }
    if (empty) empty.hidden = visibleItems().length > 0;
    activeIndex = -1;
    items.forEach((el) => el.removeAttribute("data-command-active"));
    search.removeAttribute("aria-activedescendant");
  };

  search.addEventListener("input", () => applyFilter(search.value));

  search.addEventListener("keydown", (e: KeyboardEvent) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        // from no-selection (-1) the first ArrowDown lands on the first visible item.
        setActive(activeIndex < 0 ? 0 : activeIndex + 1);
        break;
      case "ArrowUp":
        e.preventDefault();
        // from no-selection (-1) the first ArrowUp wraps to the LAST visible item.
        setActive(activeIndex < 0 ? -1 : activeIndex - 1);
        break;
      case "Enter": {
        const vis = visibleItems();
        if (activeIndex >= 0 && activeIndex < vis.length) {
          e.preventDefault();
          vis[activeIndex].querySelector<HTMLElement>("[data-command-action]")?.click();
        }
        break;
      }
      case "Escape":
        if (search.value !== "") {
          e.preventDefault();
          search.value = "";
          applyFilter("");
        }
        break;
      default:
        break;
    }
  });

  // seed: everything visible, no active item.
  applyFilter("");
}

/** Enhance every `[data-lievit-command]` root in scope (call on load + after DOM swaps). */
export function enhanceAllCommands(scope: ParentNode = document): void {
  scope
    .querySelectorAll<HTMLElement>("[data-lievit-command]")
    .forEach((root) => enhanceCommand(root));
}
