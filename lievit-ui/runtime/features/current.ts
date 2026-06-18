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
 *
 * Modifiers (#81): `l:current.exact` requires the full path to be equal (no section-parent match);
 * `l:current.strict` makes a trailing-slash difference significant (`/about/` is not `/about`), the
 * opposite of the default trailing-slash-insensitive comparison.
 *
 * An active link also carries the bare `data-current` attribute (a presence flag, Livewire
 * `wire:current` parity) so a stylesheet or sibling feature can target it without depending on the
 * configurable class list.
 */

import type { LievitRuntime } from "../runtime.js";

const NAME = "current";
const DEFAULT_CLASS = "active";
const BOUND_ATTR = "data-lievit-current-bound";
const CURRENT_ATTR = "data-current";

/** Normalizes a path for comparison: strips a trailing slash (except root) unless `strict` keeps it. */
function normalize(path: string, strict: boolean): string {
  if (!strict && path.length > 1 && path.endsWith("/")) {
    return path.slice(0, -1);
  }
  return path;
}

/**
 * True when `linkPath` is current relative to `here`.
 *
 * @param linkPath the link's pathname
 * @param here the current page pathname
 * @param exact require full path equality (no section-parent prefix match)
 * @param strict treat a trailing-slash difference as significant (default: insensitive)
 */
export function isCurrentPath(
  linkPath: string,
  here: string,
  exact: boolean,
  strict = false,
): boolean {
  const a = normalize(linkPath, strict);
  const b = normalize(here, strict);
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
  const links = new Set<{
    el: HTMLAnchorElement;
    classes: string[];
    exact: boolean;
    strict: boolean;
  }>();

  function evaluate(): void {
    const here = win.location.pathname;
    for (const link of links) {
      if (!link.el.isConnected) {
        links.delete(link);
        continue;
      }
      const url = new URL(link.el.href, win.location.href);
      const active =
        url.origin === win.location.origin &&
        isCurrentPath(url.pathname, here, link.exact, link.strict);
      for (const cls of link.classes) {
        link.el.classList.toggle(cls, active);
      }
      if (active) {
        link.el.setAttribute("aria-current", "page");
        link.el.setAttribute(CURRENT_ATTR, "");
      } else {
        link.el.removeAttribute("aria-current");
        link.el.removeAttribute(CURRENT_ATTR);
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
      const modifiers = attribute.split(".");
      const exact = modifiers.includes("exact");
      const strict = modifiers.includes("strict");
      links.add({ el: element, classes, exact, strict });
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
