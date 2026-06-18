/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * Pagination, client half (issue #149): a `l:page="action"` directive on pagination link buttons
 * drives the server's page accessors (`nextPage`/`previousPage`/`gotoPage`) through an ordinary
 * action call, optionally carrying a page argument from `l:page.arg` (e.g. a `gotoPage(3)` link).
 * After a page change the runtime scrolls the component (or the page) to the top, matching Livewire.
 *
 * URL sync (page ↔ query string, back-button restore) rides the existing `@LievitUrl` `url` effect
 * (wire-protocol.md §5b, already consumed by `effects.ts`): the server reflects the page param, the
 * client writes it via the History API. Duplicate link sets (top + bottom of a list) stay consistent
 * because the morph reconciles both. So the only client-specific code is the link directive + the
 * scroll-to-top, below.
 *
 * Server-side: the paginators map + URL sync are the server feature (issue #149 server bullet); this
 * module adds no new wire marker — a page click is a normal action.
 */

import type { LievitRuntime } from "../runtime.js";

const NAME = "page";

/** Whether a scroll-to-top should run after a page change (off for `l:page.no-scroll`). */
function shouldScroll(el: Element): boolean {
  return el.getAttribute("l:page.no-scroll") == null && !hasModifier(el, "no-scroll");
}

function hasModifier(el: Element, modifier: string): boolean {
  for (const attr of Array.from(el.attributes)) {
    if (attr.name.startsWith("l:page") && attr.name.includes(modifier)) {
      return true;
    }
  }
  return false;
}

/** A scroll function, injectable for tests (defaults to scrolling the component root into view). */
export type ScrollToTop = (root: Element) => void;

const DEFAULT_SCROLL: ScrollToTop = (root) => {
  if (typeof root.scrollIntoView === "function") {
    root.scrollIntoView({ block: "start" });
  }
};

/**
 * Installs pagination link handling on a runtime.
 *
 * @param runtime the started runtime to extend
 * @param scrollToTop the scroll behavior after a page change (injectable for tests)
 */
export function installPagination(runtime: LievitRuntime, scrollToTop: ScrollToTop = DEFAULT_SCROLL): void {
  runtime.directives.register({
    name: NAME,
    bind(element, _attribute, value, rt) {
      const marker = "data-lievit-page-bound";
      if (element.hasAttribute(marker)) {
        return;
      }
      element.setAttribute(marker, "");
      element.addEventListener("click", (event) => {
        event.preventDefault();
        // An explicit page argument (`l:page.arg="3"`) becomes the action's argument form
        // "action(3)"; the server's action allowlist (ADR-0013) still gates the call.
        const arg = element.getAttribute("l:page.arg");
        const action = arg != null && arg.length > 0 ? `${value}(${JSON.stringify(Number(arg))})` : value;
        const root = element.closest("[data-lievit-component]");
        void rt.callAction(element, action, { trigger: element, page: true });
        if (root != null && shouldScroll(element)) {
          scrollToTop(root);
        }
      });
    },
  });
}
