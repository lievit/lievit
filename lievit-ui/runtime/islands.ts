/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * Islands (ADR-0024, #89): named server-rendered regions inside one component that re-render
 * independently of the rest of the DOM. The server wraps a named island's output in HTML-comment
 * markers:
 *
 * ```html
 *   <!--[lievit:island name]--> ...the island's markup... <!--[/lievit:island name]-->
 * ```
 *
 * The comments are inert to the browser and to the morph (ADR-0019), invisible to the user, and
 * parsed only here. When an action targets an island (`l:island="name"`), the server skips the
 * parent's render and returns only the island fragment(s); {@link morphIslands} morphs just those
 * marked slices in the live DOM, leaving everything else untouched. That is the flagship v4 feature:
 * granular updates without splitting into child components.
 *
 * Modes: `replace` (the default, swap the island's content), `append` / `prepend` (accumulate, for
 * feeds / infinite scroll). Multiple response fragments for the same island name render the island
 * once (deduped: the last fragment wins for `replace`).
 *
 * Strict-CSP-safe: comment parsing via the inert `<template>`, the morph reuses `morph.ts`, no
 * `eval`, no inline script.
 */

import { morph } from "./morph.js";

/** How an island fragment is applied to the live island region. */
export type IslandMode = "replace" | "append" | "prepend";

/** One island fragment parsed out of a response (its name + inner HTML). */
export interface IslandFragment {
  readonly name: string;
  /** The island's inner HTML (between the open and close markers, markers excluded). */
  readonly html: string;
}

const OPEN = /^\s*\[lievit:island\s+([\w-]+)\]\s*$/;
const CLOSE = /^\s*\[\/lievit:island\s+([\w-]+)\]\s*$/;

/** The comment text that opens an island region (for the server-side contract / tests). */
export function islandOpenMarker(name: string): string {
  return `[lievit:island ${name}]`;
}

/** The comment text that closes an island region. */
export function islandCloseMarker(name: string): string {
  return `[/lievit:island ${name}]`;
}

/**
 * Parses every island fragment out of an HTML string, reading the comment markers. A fragment is
 * the HTML between a matching open/close marker pair (markers excluded). Nested islands are not
 * supported in v0.1 (a flat set per response); the first close after an open ends the region.
 *
 * @param html the response HTML (or any markup) carrying island comment markers
 * @returns the island fragments, in document order; empty if none
 */
export function parseIslands(html: string): IslandFragment[] {
  const template = document.createElement("template");
  template.innerHTML = html;
  const fragments: IslandFragment[] = [];
  collectIslands(template.content, fragments);
  return fragments;
}

/** Walks a node's children, pairing `[lievit:island X]` / `[/lievit:island X]` comment markers. */
function collectIslands(parent: Node, out: IslandFragment[]): void {
  let openName: string | null = null;
  let buffer: Node[] = [];
  for (let n = parent.firstChild; n != null; n = n.nextSibling) {
    if (n.nodeType === Node.COMMENT_NODE) {
      const text = n.nodeValue ?? "";
      const open = OPEN.exec(text);
      const close = CLOSE.exec(text);
      if (open != null) {
        openName = open[1]!;
        buffer = [];
        continue;
      }
      if (close != null && openName === close[1]) {
        out.push({ name: openName, html: serialize(buffer) });
        openName = null;
        buffer = [];
        continue;
      }
    }
    if (openName != null) {
      buffer.push(n);
    } else if (n.nodeType === Node.ELEMENT_NODE) {
      // Islands can live deeper in the tree; recurse into non-island elements too.
      collectIslands(n, out);
    }
  }
}

/** Serializes a run of nodes back to an HTML string (the island's inner markup). */
function serialize(nodes: readonly Node[]): string {
  const holder = document.createElement("div");
  for (const n of nodes) {
    holder.appendChild(n.cloneNode(true));
  }
  return holder.innerHTML;
}

/**
 * Finds the live DOM region for an island by name: the run of nodes between its open and close
 * comment markers under `root`. Returns the marker comment nodes and the parent, so a caller can
 * splice content between them.
 */
function findIslandRegion(
  root: Element,
  name: string,
): { parent: Node; open: Comment; close: Comment } | null {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_COMMENT);
  let open: Comment | null = null;
  while (walker.nextNode()) {
    const c = walker.currentNode as Comment;
    const text = c.nodeValue ?? "";
    const o = OPEN.exec(text);
    const cl = CLOSE.exec(text);
    if (o != null && o[1] === name) {
      open = c;
    } else if (cl != null && cl[1] === name && open != null && open.parentNode === c.parentNode) {
      return { parent: c.parentNode!, open, close: c };
    }
  }
  return null;
}

/**
 * Morphs the live DOM's island regions toward the parsed fragments, touching only the named
 * islands. For `replace`, the region's content between the markers is morphed to the fragment; for
 * `append` / `prepend`, the fragment's nodes are added without disturbing the existing content.
 * Fragments naming an island not present in the live DOM are skipped (forward-compatible).
 *
 * @param root the component root that holds the island regions
 * @param fragments the island fragments parsed from the response
 * @param mode how to apply each fragment (defaults to `replace`)
 */
export function morphIslands(
  root: Element,
  fragments: readonly IslandFragment[],
  mode: IslandMode = "replace",
): void {
  // Dedupe by name keeping the last fragment (a server may emit the same island twice; render once).
  const byName = new Map<string, string>();
  for (const f of fragments) {
    byName.set(f.name, f.html);
  }

  for (const [name, html] of byName) {
    const region = findIslandRegion(root, name);
    if (region == null) {
      continue;
    }
    if (mode === "replace") {
      replaceRegion(region, html);
    } else {
      accumulateRegion(region, html, mode);
    }
  }
}

/** Replaces the content between the markers by morphing a wrapper toward the fragment. */
function replaceRegion(
  region: { parent: Node; open: Comment; close: Comment },
  html: string,
): void {
  // Move the current between-markers content into a detached wrapper, morph it, then splice it back.
  const wrapper = document.createElement("div");
  let n = region.open.nextSibling;
  while (n != null && n !== region.close) {
    const next = n.nextSibling;
    wrapper.appendChild(n);
    n = next;
  }
  morph(wrapper, html);
  while (wrapper.firstChild != null) {
    region.parent.insertBefore(wrapper.firstChild, region.close);
  }
}

/** Appends/prepends the fragment's nodes within the island region without touching existing ones. */
function accumulateRegion(
  region: { parent: Node; open: Comment; close: Comment },
  html: string,
  mode: "append" | "prepend",
): void {
  const template = document.createElement("template");
  template.innerHTML = html;
  const nodes = Array.from(template.content.childNodes);
  if (mode === "append") {
    for (const node of nodes) {
      region.parent.insertBefore(node, region.close);
    }
  } else {
    const anchor = region.open.nextSibling;
    for (const node of nodes) {
      region.parent.insertBefore(node, anchor);
    }
  }
}
