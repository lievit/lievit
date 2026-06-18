/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * Client consumer of the page-level `assets` effect (issue #171/#119/#129): a wire update's
 * `Lievit-Effects` bag carries an `assets` block when a rendered component brings JS/CSS the page has
 * not loaded yet (the lievit analogue of Livewire's `getAssets()` on every update). This feature
 * applies that block, once per page, under the strict CSP (ADR-0019): no inline script, no eval, no
 * inline style, only external `<script src>` / `<link href>` / verbatim head tags.
 *
 * Three asset kinds, each deduped so a late-arriving component (or two instances of it) loads its
 * assets exactly once:
 *
 * - **scripts** — the per-component `run($wire,$js)` module URLs: appended once as
 *   `<script type=module src=...>` (deduped by `src`). Module evaluation is naturally idempotent in
 *   the browser, but we still de-dup the tag so the network fetch happens once.
 * - **headTags** — the `@assets` shared head tags (a CDN stylesheet, a charting lib): injected once
 *   into `<head>` (deduped by the verbatim tag text). They are author-provided markup served verbatim,
 *   the same trust model as a hand-written head tag.
 * - **styleModules** — the scoped-CSS routes (issue #129): injected as `<link rel=stylesheet>` once
 *   per component, with the content hash in the `href` for cache-busting. A changed stylesheet ships a
 *   new hash, so the `<link>` is replaced and the browser re-fetches; an unchanged one is left alone.
 *
 * This module is **self-contained** (no edit to the shared effects/runtime core): an app applies the
 * block by passing the parsed `assets` to {@link applyAssets} (e.g. from an `afterCall`/effects hook),
 * and a CSP nonce is threaded through when the page runs a nonce-based policy. Wiring it into the
 * global effect-apply loop is a one-line call the client owns.
 */

/** One scoped-CSS style module (issue #129): the component, the CSS route href, and its content hash. */
export interface StyleModuleAsset {
  readonly component: string;
  readonly href: string;
  readonly hash: string;
}

/** The page-level assets a wire update carries (the `assets` key of the effects bag). */
export interface AssetsBlock {
  /** Per-component `run($wire,$js)` module URLs to load once. */
  readonly scripts?: readonly string[];
  /** `@assets` head tags to inject once per page (verbatim). */
  readonly headTags?: readonly string[];
  /** Scoped-CSS style modules to inject as cache-busted `<link>`s. */
  readonly styleModules?: readonly StyleModuleAsset[];
}

const SCRIPT_MARKER = "data-lievit-asset-script";
const HEADTAG_MARKER = "data-lievit-asset-tag";
const STYLE_MARKER = "data-lievit-style-module";

/**
 * Applies a page-level assets block to the document, once per asset (idempotent under repeated
 * updates). Strict-CSP-safe: external `src`/`href` only, plus verbatim author head tags.
 *
 * @param assets the parsed `assets` block from the effects bag, or `null`/`undefined` (a no-op)
 * @param doc the document to inject into (defaults to `document`; injectable for tests)
 * @param nonce the CSP nonce to stamp on injected `<script>`/`<link>` (omitted when no nonce policy)
 */
export function applyAssets(
  assets: AssetsBlock | null | undefined,
  doc: Document = document,
  nonce?: string,
): void {
  if (assets == null) {
    return;
  }
  for (const src of assets.scripts ?? []) {
    injectScript(src, doc, nonce);
  }
  for (const tag of assets.headTags ?? []) {
    injectHeadTag(tag, doc, nonce);
  }
  for (const module of assets.styleModules ?? []) {
    injectStyleModule(module, doc, nonce);
  }
}

/** Appends a `<script type=module src>` once (deduped by src). */
function injectScript(src: string, doc: Document, nonce?: string): void {
  if (doc.querySelector(`script[${SCRIPT_MARKER}="${cssEscape(src)}"]`) != null) {
    return;
  }
  const script = doc.createElement("script");
  script.type = "module";
  script.src = src;
  script.setAttribute(SCRIPT_MARKER, src);
  if (nonce != null && nonce.length > 0) {
    script.setAttribute("nonce", nonce);
  }
  (doc.head ?? doc.documentElement).appendChild(script);
}

/**
 * Injects a verbatim `@assets` head tag once (deduped by tag text). The tag is parsed into a real
 * element (not `innerHTML` into a live node) so a `<script>`'s src actually loads; an inline-script
 * tag is refused (no `src`) to keep the strict-CSP posture.
 */
function injectHeadTag(tag: string, doc: Document, nonce?: string): void {
  const key = hashString(tag);
  if (doc.querySelector(`[${HEADTAG_MARKER}="${key}"]`) != null) {
    return;
  }
  const template = doc.createElement("template");
  template.innerHTML = tag.trim();
  const node = template.content.firstElementChild;
  if (node == null) {
    return;
  }
  // A bare inline <script> (no src) would violate the strict CSP and never run: refuse it.
  if (node.tagName === "SCRIPT" && !node.getAttribute("src")) {
    return;
  }
  node.setAttribute(HEADTAG_MARKER, key);
  if (nonce != null && nonce.length > 0 && (node.tagName === "SCRIPT" || node.tagName === "LINK")) {
    node.setAttribute("nonce", nonce);
  }
  (doc.head ?? doc.documentElement).appendChild(node);
}

/**
 * Injects a scoped-CSS `<link>` once per component, cache-busted by the content hash: a new hash
 * replaces the prior `<link>` (re-fetch), an unchanged one is left untouched.
 */
function injectStyleModule(module: StyleModuleAsset, doc: Document, nonce?: string): void {
  const selector = `link[${STYLE_MARKER}="${cssEscape(module.component)}"]`;
  const existing = doc.querySelector(selector);
  if (existing != null) {
    if (existing.getAttribute("data-lievit-style-hash") === module.hash) {
      return; // unchanged: keep the cached stylesheet
    }
    existing.remove(); // changed: drop the stale link so the new hash re-fetches
  }
  const link = doc.createElement("link");
  link.rel = "stylesheet";
  link.href = module.href;
  link.setAttribute(STYLE_MARKER, module.component);
  link.setAttribute("data-lievit-style-hash", module.hash);
  if (nonce != null && nonce.length > 0) {
    link.setAttribute("nonce", nonce);
  }
  (doc.head ?? doc.documentElement).appendChild(link);
}

/** A short stable key for a verbatim tag (dedup only, not security). */
function hashString(value: string): string {
  let h = 0;
  for (let i = 0; i < value.length; i++) {
    h = (h * 31 + value.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(16);
}

/** Escapes a value for a CSS attribute selector (the dedup lookups). */
function cssEscape(value: string): string {
  return value.replace(/["\\]/g, "\\$&");
}
