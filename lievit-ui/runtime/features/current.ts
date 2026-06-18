/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * `l:current` active-link marking (#81, Livewire `wire:current`): an anchor carrying `l:current`
 * gets an active CSS class when its `href` matches the current page URL, and `aria-current="page"`
 * for assistive tech. The class to apply is the directive value (`l:current="active font-bold"`),
 * defaulting to `active`. Matching is by pathname; `l:current.exact` requires the full path to be
 * equal, otherwise a prefix match marks a section parent active too (the common nav pattern).
 *
 * It re-evaluates on every SPA navigation (`lievit:navigated`, the `l:navigate` feature) and on
 * `popstate`, so a link stays correctly marked as the URL changes without a full reload. Pure
 * client directive: no wire call, no server hook, strict-CSP-safe (no inline handler, no eval).
 */

import type { LievitRuntime } from "../runtime.js";

const NAME = "current";
const DEFAULT_CLASS = "active";
const BOUND_ATTR = "data-lievit-current-bound";

/** Normalizes a path for comparison: strips a trailing slash (except root), lowercases nothing. */
function normalize(path: string): string {
  if (path.length > 1 && path.endsWith("/")) {
    return path.slice(0, -1);
  }
  return path;
}

/** True when `linkPath` is current relative to `here` (exact equality, or a prefix section match). */
export function isCurrentPath(linkPath: string, here: string, exact: boolean): boolean {
  const a = normalize(linkPath);
  const b = normalize(here);
  if (exact) {
    return a === b;
  }
  if (a === b) {
    return true;
  }
  // Section match: /posts marks active on /posts/3, but not on /posts-archive.
  return b.startsWith(`${a}/`);
}

/**
 * Installs `l:current` on a runtime. Returns an unsubscribe removing the navigation listeners.
 *
 * @param runtime the started runtime to extend
 * @param win the window whose location/events to read (injectable for tests)
 * @returns an unsubscribe function
 */
export function installCurrent(
  runtime: LievitRuntime,
  win: Window = window,
): () => void {
  // Every bound link, re-evaluated whenever the URL changes (the directive only records them).
  const links = new Set<{ el: HTMLAnchorElement; classes: string[]; exact: boolean }>();

  function evaluate(): void {
    const here = win.location.pathname;
    for (const link of links) {
      if (!link.el.isConnected) {
        links.delete(link);
        continue;
      }
      const url = new URL(link.el.href, win.location.href);
      const active = url.origin === win.location.origin && isCurrentPath(url.pathname, here, link.exact);
      for (const cls of link.classes) {
        link.el.classList.toggle(cls, active);
      }
      if (active) {
        link.el.setAttribute("aria-current", "page");
      } else {
        link.el.removeAttribute("aria-current");
      }
    }
  }

  runtime.directives.register({
    name: NAME,
    bind(element, attribute, value) {
      if (!(element instanceof HTMLAnchorElement) || element.hasAttribute(BOUND_ATTR)) {
        return;
      }
      element.setAttribute(BOUND_ATTR, "");
      const classes = (value.trim().length > 0 ? value.trim() : DEFAULT_CLASS).split(/\s+/);
      const exact = attribute.split(".").includes("exact");
      links.add({ el: element, classes, exact });
      evaluate();
    },
  });

  const onNavigated = (): void => evaluate();
  win.addEventListener("lievit:navigated", onNavigated);
  win.addEventListener("popstate", onNavigated);

  return () => {
    win.removeEventListener("lievit:navigated", onNavigated);
    win.removeEventListener("popstate", onNavigated);
  };
}
