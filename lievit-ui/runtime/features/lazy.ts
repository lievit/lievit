/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * Lazy loading: defer a component's real render until it scrolls into view, showing a placeholder
 * until then (Livewire `#[Lazy]` parity, the client half). An element carrying `l:lazy="action"`
 * (typically a placeholder skeleton) fires `action` once it intersects the viewport; the server's
 * action swaps the placeholder for the real content on the next morph.
 *
 * `l:lazy.eager` (or no IntersectionObserver support) loads immediately on bind. Implemented as a
 * directive that observes intersection then calls the action once (ADR-0019). The component renders
 * the placeholder server-side and the `l:lazy` action returns the heavy content; the client only
 * triggers the load at the right moment.
 *
 * Server-side hook: minimal — the action the component exposes to render the real body. No new wire
 * marker; a lazy load is an ordinary action call.
 */

import type { LievitRuntime } from "../runtime.js";

const NAME = "lazy";
const LOADED_ATTR = "data-lievit-lazy-loaded";

/** An observer factory, injectable for tests (defaults to the browser's IntersectionObserver). */
export interface IntersectionObserverFactory {
  readonly observe: (el: Element, onVisible: () => void) => () => void;
}

const REAL_OBSERVER: IntersectionObserverFactory = {
  observe: (el, onVisible) => {
    if (typeof IntersectionObserver === "undefined") {
      onVisible(); // no IO support: load eagerly.
      return () => {};
    }
    const io = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          onVisible();
        }
      }
    });
    io.observe(el);
    return () => io.disconnect();
  },
};

/**
 * Installs lazy loading on a runtime.
 *
 * @param runtime the started runtime to extend
 * @param observers the intersection-observer factory (injectable for tests)
 */
export function installLazy(
  runtime: LievitRuntime,
  observers: IntersectionObserverFactory = REAL_OBSERVER,
): void {
  runtime.directives.register({
    name: NAME,
    bind(element, attribute, value, rt) {
      if (element.hasAttribute(LOADED_ATTR)) {
        return;
      }
      const eager = attribute.includes(".eager");
      const load = (): void => {
        if (element.hasAttribute(LOADED_ATTR)) {
          return;
        }
        element.setAttribute(LOADED_ATTR, "");
        void rt.callAction(element, value, { trigger: element, lazy: true });
      };
      if (eager) {
        load();
        return;
      }
      let stop: (() => void) | undefined;
      stop = observers.observe(element, () => {
        load();
        stop?.();
      });
    },
  });
}
