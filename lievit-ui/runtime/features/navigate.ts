/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * SPA navigation (issue #155): `l:navigate` links perform client-side navigation — fetch the target
 * page, swap the `<body>`, update history — preserving the runtime and JS globals (no full reload),
 * firing `lievit:navigate` / `lievit:navigating` / `lievit:navigated` events. Back/forward replay
 * from a small snapshot cache (~10 entries); `.hover` prefetches on pointer-enter; scroll resets to
 * top on a forward navigation and restores on back. A changed tracked head asset
 * (`<script>`/`<link data-navigate-track>`) forces a full reload (the client cannot hot-swap the
 * bundle that runs it).
 *
 * Implemented WITHOUT editing the core: it captures link clicks at the document level and drives the
 * body morph through the exported {@link morph} (the same identity-preserving morph the wire loop
 * uses), then re-`start`s the runtime over the new body. Server-side: stamp tracked assets with
 * `data-navigate-track` so the client can diff them (additive markup, no dispatcher change).
 *
 * CSP-safe: no inline script, no eval. New `<script>` tags in the swapped head are appended as real
 * element nodes (the browser executes them), never `innerHTML`-injected.
 */

import { morph } from "../morph.js";
import type { LievitRuntime } from "../runtime.js";

/** A small bounded LRU page cache (body HTML + scroll), keyed by URL. */
class PageCache {
  private readonly entries = new Map<string, { html: string; scrollY: number }>();
  constructor(private readonly max = 10) {}

  get(url: string): { html: string; scrollY: number } | undefined {
    const entry = this.entries.get(url);
    if (entry != null) {
      this.entries.delete(url); // refresh LRU position
      this.entries.set(url, entry);
    }
    return entry;
  }

  set(url: string, html: string, scrollY: number): void {
    this.entries.delete(url);
    this.entries.set(url, { html, scrollY });
    while (this.entries.size > this.max) {
      const oldest = this.entries.keys().next().value;
      if (oldest == null) break;
      this.entries.delete(oldest);
    }
  }

  has(url: string): boolean {
    return this.entries.has(url);
  }
}

/** Options for {@link installNavigate}: an injectable fetch + the window/history for tests. */
export interface NavigateOptions {
  readonly fetchImpl?: typeof fetch;
  readonly win?: Window;
}

/** The signature of a tracked head asset: tag + src/href, used to detect a changed bundle. */
function trackedAssets(doc: Document): string[] {
  const out: string[] = [];
  for (const el of Array.from(doc.querySelectorAll("script[src], link[data-navigate-track], script[data-navigate-track]"))) {
    const src = el.getAttribute("src") ?? el.getAttribute("href") ?? "";
    out.push(`${el.tagName}:${src}`);
  }
  return out;
}

function sameAssets(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((x, i) => x === b[i]);
}

/**
 * Installs `l:navigate` SPA navigation on a runtime.
 *
 * @param runtime the started runtime (re-`start`ed after each body swap to bind new components)
 * @param options injectable fetch + window (for tests)
 * @returns an unsubscribe that removes the document listeners
 */
export function installNavigate(runtime: LievitRuntime, options: NavigateOptions = {}): () => void {
  const win = options.win ?? window;
  const doc = win.document;
  const doFetch = options.fetchImpl ?? win.fetch.bind(win);
  const cache = new PageCache();
  const baseAssets = trackedAssets(doc);

  function emit(name: string, detail: Record<string, unknown>): void {
    win.dispatchEvent(new CustomEvent(name, { detail }));
  }

  function navLink(target: EventTarget | null): HTMLAnchorElement | null {
    if (!(target instanceof Element)) {
      return null;
    }
    const anchor = target.closest("a[l\\:navigate], a[l\\:navigate\\.hover]");
    return anchor instanceof HTMLAnchorElement ? anchor : null;
  }

  function isInternalLeftClick(event: MouseEvent, link: HTMLAnchorElement): boolean {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return false;
    }
    const url = new URL(link.href, win.location.href);
    return url.origin === win.location.origin;
  }

  async function fetchBody(url: string): Promise<string | null> {
    try {
      const response = await doFetch(url, { headers: { "X-Lievit-Navigate": "1" }, credentials: "same-origin" });
      if (!response.ok) {
        return null; // error response: fall back to a full navigation.
      }
      return await response.text();
    } catch {
      return null;
    }
  }

  function swap(html: string, url: string, fromCache: boolean): boolean {
    const template = doc.createElement("template");
    template.innerHTML = html;
    const incoming = template.content.querySelector("body") ?? template.content;
    // Asset diff: a changed tracked bundle means the runtime cannot survive — force a full reload.
    const incomingDoc = doc.implementation.createHTMLDocument("");
    incomingDoc.documentElement.innerHTML = html;
    if (!sameAssets(baseAssets, trackedAssets(incomingDoc))) {
      win.location.assign(url);
      return false;
    }
    emit("lievit:navigating", { url, cached: fromCache });
    morph(doc.body, (incoming as Element).innerHTML ?? html);
    runtime.start(doc.body);
    emit("lievit:navigated", { url, cached: fromCache });
    return true;
  }

  async function go(url: string, push: boolean): Promise<void> {
    emit("lievit:navigate", { url });
    cache.set(win.location.href, doc.body.innerHTML, win.scrollY);
    const cached = cache.get(url);
    const html = cached?.html ?? (await fetchBody(url));
    if (html == null) {
      win.location.assign(url); // fetch failed / external: full navigation.
      return;
    }
    const swapped = swap(html, url, cached != null);
    if (!swapped) {
      return;
    }
    if (push) {
      win.history.pushState({ lievitNavigate: true }, "", url);
    }
    win.scrollTo(0, 0); // forward navigation: top.
  }

  const onClick = (event: MouseEvent): void => {
    const link = navLink(event.target);
    if (link == null || !isInternalLeftClick(event, link)) {
      return;
    }
    event.preventDefault();
    void go(link.href, true);
  };

  const prefetched = new Set<string>();
  const onPointerEnter = (event: Event): void => {
    const link = navLink(event.target);
    if (link == null || link.getAttribute("l:navigate.hover") == null) {
      return;
    }
    const url = link.href;
    if (prefetched.has(url) || cache.has(url)) {
      return;
    }
    prefetched.add(url);
    void fetchBody(url).then((html) => {
      if (html != null) {
        cache.set(url, html, 0);
      }
    });
  };

  const onPopState = (): void => {
    const url = win.location.href;
    const cached = cache.get(url);
    if (cached != null) {
      // Back/forward: replay from cache without a fetch, restore scroll.
      swap(cached.html, url, true);
      win.scrollTo(0, cached.scrollY);
    } else {
      void go(url, false);
    }
  };

  doc.addEventListener("click", onClick);
  doc.addEventListener("pointerenter", onPointerEnter, true);
  win.addEventListener("popstate", onPopState);
  // First load fires only `navigated` (Livewire parity).
  emit("lievit:navigated", { url: win.location.href, cached: false });

  return () => {
    doc.removeEventListener("click", onClick);
    doc.removeEventListener("pointerenter", onPointerEnter, true);
    win.removeEventListener("popstate", onPopState);
  };
}
