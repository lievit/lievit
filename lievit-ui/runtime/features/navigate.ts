/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * SPA navigation (issues #155, #193, #195): `l:navigate` links perform client-side navigation:
 * fetch the target page, swap the `<body>`, merge the `<head>`, update history, preserving the
 * runtime and JS globals (no full reload), firing `lievit:navigate` / `lievit:navigating` /
 * `lievit:navigated` events. Back/forward replay from a small snapshot cache (~10 entries).
 *
 * Depth layered on the core (#195):
 * - **prefetch**: `l:navigate.hover` fetches the target on pointer-enter.
 * - **progress bar**: a top-of-page bar shown while the page fetch is in flight; suppressed per
 *   link with `data-no-progress-bar`; bar color configurable via {@link NavigateOptions.progressColor}.
 * - **scroll**: a forward navigation resets scroll to top; `l:navigate.preserve-scroll` keeps the
 *   current offset; back/forward restores the saved offset from the cache.
 * - **`@persist`**: an element marked `l:persist="key"` is carried across the swap as the SAME live
 *   DOM node (Livewire `@persist`): its node identity (and so an `<audio>`/`<video>` mid-playback)
 *   survives the navigation. Lievit-native: no Alpine `x-persist`, the live node is detached to a
 *   placeholder, the body is morphed, then the live node is re-inserted in the placeholder's place.
 *
 * A changed tracked head asset (`<script src>` / `<link data-navigate-track>` / `<script
 * data-navigate-track>`) forces a full reload (the client cannot hot-swap the bundle that runs it).
 * Unchanged head assets that are NEW in the incoming page (a page-specific stylesheet) are merged
 * into the live `<head>` additively so the swapped body is styled without a full reload.
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

/** The attribute marking a region carried across navigations un-swapped (Livewire `@persist`). */
const PERSIST_ATTR = "l:persist";

/** The link modifier that keeps the scroll offset on a forward navigation. */
const PRESERVE_SCROLL_MODIFIER = "preserve-scroll";

/** The attribute on a link that suppresses the progress bar for that navigation. */
const NO_PROGRESS_ATTR = "data-no-progress-bar";

/** The default progress-bar color (Livewire's `#2299dd`). */
const DEFAULT_PROGRESS_COLOR = "#2299dd";

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
  /** The progress-bar color (CSS color); defaults to Livewire's `#2299dd`. */
  readonly progressColor?: string;
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

/** A stable signature for a head asset node, so a merge can dedupe against the live head. */
function headAssetKey(el: Element): string {
  const src = el.getAttribute("src") ?? el.getAttribute("href") ?? "";
  if (src.length > 0) {
    return `${el.tagName}:${src}`;
  }
  // Inline <style>/<script> without a src: key on the text so identical inline blocks dedupe.
  return `${el.tagName}:inline:${el.textContent ?? ""}`;
}

/**
 * Merges the incoming page's `<head>` assets (stylesheets, inline styles, scripts) into the live
 * `<head>` additively: any asset NOT already present is appended as a real element node so the
 * browser fetches/executes it (a script created via `document.createElement` runs; one injected via
 * `innerHTML` does not). Already-present assets are left untouched, so nothing is duplicated and the
 * runtime bundle is never re-run. The bundle-changed case is handled upstream (full reload).
 */
function mergeHead(doc: Document, incomingHead: Element | null): void {
  if (incomingHead == null) {
    return;
  }
  const present = new Set(
    Array.from(doc.head.querySelectorAll("link, style, script")).map(headAssetKey),
  );
  for (const el of Array.from(incomingHead.querySelectorAll("link, style, script"))) {
    const key = headAssetKey(el);
    if (present.has(key)) {
      continue;
    }
    present.add(key);
    const fresh = doc.createElement(el.tagName);
    for (const attr of Array.from(el.attributes)) {
      fresh.setAttribute(attr.name, attr.value);
    }
    fresh.textContent = el.textContent;
    doc.head.appendChild(fresh);
  }
}

/**
 * Detaches every `l:persist` region from the LIVE body and returns the live nodes keyed by their
 * persist key, leaving a placeholder element in their place so the morph reconciles structure around
 * them. The detached live nodes are re-inserted after the morph by {@link restorePersisted}, so they
 * are reused rather than re-created: their DOM identity (and any in-flight `<audio>`/`<video>`)
 * survives the navigation. Lievit-native (no Alpine `x-persist`).
 */
function detachPersisted(liveBody: Element): Map<string, Element> {
  const live = new Map<string, Element>();
  for (const el of Array.from(liveBody.querySelectorAll(`[${cssAttr(PERSIST_ATTR)}]`))) {
    const key = el.getAttribute(PERSIST_ATTR);
    if (key == null || key.length === 0 || live.has(key)) {
      continue;
    }
    live.set(key, el);
    const placeholder = el.ownerDocument.createElement(el.tagName);
    placeholder.setAttribute(PERSIST_ATTR, key);
    el.replaceWith(placeholder); // morph will keep/position this lightweight placeholder.
  }
  return live;
}

/**
 * Re-inserts the live persisted nodes detached by {@link detachPersisted} into the morphed body,
 * replacing the matching placeholder. A persisted region present before but absent in the incoming
 * page (no placeholder survived the morph) is simply dropped, its live node discarded.
 */
function restorePersisted(liveBody: Element, live: Map<string, Element>): void {
  for (const placeholder of Array.from(liveBody.querySelectorAll(`[${cssAttr(PERSIST_ATTR)}]`))) {
    const key = placeholder.getAttribute(PERSIST_ATTR);
    const liveNode = key != null ? live.get(key) : undefined;
    if (liveNode != null) {
      placeholder.replaceWith(liveNode); // reuse the live node; identity (and media) survives.
      live.delete(key as string);
    }
  }
}

/** Escapes the `l:` colon for a CSS attribute selector. */
function cssAttr(name: string): string {
  return name.replace(/:/g, "\\:");
}

/** A top-of-page progress bar shown during a page fetch (Livewire parity). One per runtime. */
class ProgressBar {
  private el: HTMLElement | null = null;
  constructor(
    private readonly doc: Document,
    private readonly color: string,
  ) {}

  show(): void {
    if (this.el != null) {
      return;
    }
    const bar = this.doc.createElement("div");
    bar.setAttribute("data-lievit-progress", "");
    bar.style.cssText =
      `position:fixed;top:0;left:0;height:3px;width:100%;z-index:2147483647;` +
      `background:${this.color};transition:opacity .2s;pointer-events:none;`;
    this.doc.body.appendChild(bar);
    this.el = bar;
  }

  hide(): void {
    this.el?.remove();
    this.el = null;
  }
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
  const progress = new ProgressBar(doc, options.progressColor ?? DEFAULT_PROGRESS_COLOR);

  function emit(name: string, detail: Record<string, unknown>): void {
    win.dispatchEvent(new CustomEvent(name, { detail }));
  }

  function navLink(target: EventTarget | null): HTMLAnchorElement | null {
    if (!(target instanceof Element)) {
      return null;
    }
    // Match any anchor carrying an `l:navigate` attribute regardless of its modifier suffix
    // (`l:navigate`, `l:navigate.hover`, `l:navigate.preserve-scroll`, `l:navigate.hover.…`).
    const anchor = target.closest("a");
    if (!(anchor instanceof HTMLAnchorElement)) {
      return null;
    }
    const hasNavigate = Array.from(anchor.attributes).some((a) => a.name.startsWith("l:navigate"));
    return hasNavigate ? anchor : null;
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
    // Parse the incoming page into a detached document so we can read its <head> and <body> without
    // touching the live tree until the morph.
    const incomingDoc = doc.implementation.createHTMLDocument("");
    incomingDoc.documentElement.innerHTML = html;
    // Asset diff: a changed tracked bundle means the runtime cannot survive, force a full reload.
    if (!sameAssets(baseAssets, trackedAssets(incomingDoc))) {
      win.location.assign(url);
      return false;
    }
    emit("lievit:navigating", { url, cached: fromCache });
    // Merge head assets additively (a page-specific stylesheet) so the swapped body is styled.
    mergeHead(doc, incomingDoc.head);
    // `l:persist`: detach live regions to placeholders, morph, then re-insert the live nodes so
    // their identity (and any in-flight media) survives the swap.
    const persisted = detachPersisted(doc.body);
    morph(doc.body, incomingDoc.body.innerHTML);
    restorePersisted(doc.body, persisted);
    runtime.start(doc.body);
    emit("lievit:navigated", { url, cached: fromCache });
    return true;
  }

  async function go(url: string, push: boolean, preserveScroll: boolean, showBar: boolean): Promise<void> {
    emit("lievit:navigate", { url });
    cache.set(win.location.href, doc.body.innerHTML, win.scrollY);
    const cached = cache.get(url);
    let html = cached?.html ?? null;
    if (html == null) {
      if (showBar) {
        progress.show();
      }
      html = await fetchBody(url);
      progress.hide();
    }
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
    if (!preserveScroll) {
      win.scrollTo(0, 0); // forward navigation: top, unless the link opted to preserve scroll.
    }
  }

  function linkHasModifier(link: HTMLAnchorElement, modifier: string): boolean {
    for (const attr of Array.from(link.attributes)) {
      if (attr.name.startsWith("l:navigate") && attr.name.split(".").includes(modifier)) {
        return true;
      }
    }
    return false;
  }

  const onClick = (event: MouseEvent): void => {
    const link = navLink(event.target);
    if (link == null || !isInternalLeftClick(event, link)) {
      return;
    }
    event.preventDefault();
    const preserveScroll = linkHasModifier(link, PRESERVE_SCROLL_MODIFIER);
    const showBar = !link.hasAttribute(NO_PROGRESS_ATTR);
    void go(link.href, true, preserveScroll, showBar);
  };

  const prefetched = new Set<string>();
  const onPointerEnter = (event: Event): void => {
    const link = navLink(event.target);
    if (link == null || !linkHasModifier(link, "hover")) {
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
      void go(url, false, true, true); // unknown entry: do not reset scroll on a history move.
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
