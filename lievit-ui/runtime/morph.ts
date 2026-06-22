/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * A small, bespoke DOM morph (wire-protocol.md §5; ADR-0001 chose Idiomorph as the *principle* —
 * "morph, do not replace innerHTML" — but lievit ships its own implementation rather than vendoring
 * a copy, keeping the bundle dependency-free and license-clean). It walks the live DOM toward the
 * freshly rendered markup, preserving node identity where structure matches so focus, selection,
 * scroll, in-flight transitions and uncontrolled input state survive the patch.
 *
 * The algorithm is deliberately the dumbest thing that works (no virtual DOM, no LCS diff):
 *
 * 1. Match children pairwise, preferring a stable key (`id`, then `name`) so a reordered keyed node
 *    is *moved*, not destroyed and recreated; otherwise match by position among same-tag nodes.
 * 2. For a matched element: reconcile attributes in place (add/update/remove) and recurse into
 *    children. Live form-control value/checked state is preserved unless the server explicitly sets
 *    it (the server is the source of truth only for what it renders; uncontrolled typing survives).
 * 3. For an unmatched new node: import and insert it. For a leftover old node: remove it.
 * 4. Text nodes update `nodeValue` in place rather than replacing, so the text node identity holds.
 *
 * Scope: it morphs the *children* of a root element toward a new HTML string, which is exactly the
 * lievit wire contract (the 200 body is the component's rendered markup). Strict-CSP-safe: it parses
 * via the inert template element, never `eval`/`innerHTML`-executes script.
 *
 * ## The morph hooks (ADR-0019 extension seam)
 *
 * ADR-0019 anticipated that `l:ignore` (skip a subtree from morphing) and `l:transition` (defer a
 * node's removal so it can animate out) would each need "a small morph hook". {@link MorphHooks} is
 * that seam: a feature passes callbacks to {@link morph} (the runtime forwards the hooks it has been
 * given) WITHOUT editing this file's algorithm. `elementMode` lets a feature freeze a live node (the
 * third-party-managed DOM case); `beforeRemove` lets a feature take over the removal of a leftover
 * node (the animate-out case) and report whether it has handled it.
 */

import { defaultWriteControlValue } from "./controls.js";

/** How an element is morphed (see {@link MorphHooks.elementMode}). */
export type MorphMode = "morph" | "skip" | "self" | "children";

/** Optional, fail-soft hooks a feature can pass to {@link morph} (ADR-0019 morph seam). */
export interface MorphHooks {
  /**
   * Decides how a live element is morphed. Return:
   * - `"skip"` to leave the element and its whole subtree untouched (`l:ignore`),
   * - `"self"` to reconcile the element's own attributes but NOT recurse into children
   *   (`l:ignore.children` — the element morphs, its children are frozen),
   * - `"children"` to skip the element's own attributes/value but still morph children
   *   (`l:ignore.self` — only the element itself is frozen),
   * - `"morph"`/`undefined` for the normal full morph.
   *
   * @param oldEl the live element about to be morphed
   * @param newEl the new element it is being morphed toward
   */
  readonly elementMode?: (oldEl: Element, newEl: Element) => MorphMode | undefined;
  /**
   * Called for a leftover live node the new markup dropped, just before removal. Return `true` to
   * claim the removal (the feature removes the node itself later, e.g. after an out transition); the
   * morph then leaves it in place. Return `false`/`undefined` to remove it now.
   *
   * @param node the live node the new markup no longer accounts for
   */
  readonly beforeRemove?: (node: Node) => boolean | undefined;
}

/** No-op hooks: the default when a caller passes none (preserves the plain bespoke algorithm). */
const NO_HOOKS: MorphHooks = {};

/**
 * Morphs the children of `root` to match `newHtml`. The root element itself is kept; only its
 * subtree is reconciled.
 *
 * @param root the live element whose subtree is patched (the component root)
 * @param newHtml the freshly rendered HTML for that subtree (the wire 200 body)
 * @param hooks optional morph hooks (ADR-0019 seam for `l:ignore` / `l:transition`); omitted = the
 *     plain bespoke morph
 */
export function morph(root: Element, newHtml: string, hooks: MorphHooks = NO_HOOKS): void {
  const template = document.createElement("template");
  template.innerHTML = newHtml;
  // The wire body is the component root's own markup; if it re-renders a single root element that
  // matches the live root's tag, morph into it (so the root's attributes reconcile too). Otherwise
  // morph the parsed fragment's children directly into the live root's children.
  const parsedRoot = template.content.firstElementChild;
  if (
    template.content.childElementCount === 1 &&
    parsedRoot != null &&
    parsedRoot.tagName === root.tagName
  ) {
    morphElement(root, parsedRoot, hooks);
  } else {
    morphChildren(root, template.content, hooks);
  }
}

/** A stable key for a node: its `id`, then its `name`; `null` means "match by position". */
function keyOf(node: Node): string | null {
  if (node.nodeType !== Node.ELEMENT_NODE) {
    return null;
  }
  const el = node as Element;
  const id = el.getAttribute("id");
  if (id != null && id.length > 0) {
    return `#${id}`;
  }
  const name = el.getAttribute("name");
  if (name != null && name.length > 0) {
    return `@${el.tagName}:${name}`;
  }
  return null;
}

/** Reconciles `oldParent`'s children toward `newParent`'s children. */
function morphChildren(oldParent: Node, newParent: Node, hooks: MorphHooks): void {
  // Index keyed old children so a reordered keyed node is reused rather than rebuilt.
  const keyed = new Map<string, Node>();
  for (let n = oldParent.firstChild; n != null; n = n.nextSibling) {
    const key = keyOf(n);
    if (key != null) {
      keyed.set(key, n);
    }
  }

  let oldChild = oldParent.firstChild;
  let newChild = newParent.firstChild;

  while (newChild != null) {
    const nextNew = newChild.nextSibling;
    const newKey = keyOf(newChild);

    // A keyed new node: reuse the matching old node wherever it currently sits (move it here).
    if (newKey != null && keyed.has(newKey)) {
      const match = keyed.get(newKey)!;
      keyed.delete(newKey);
      if (match !== oldChild) {
        oldParent.insertBefore(match, oldChild);
      } else {
        oldChild = oldChild.nextSibling;
      }
      morphNode(match, newChild, hooks);
      newChild = nextNew;
      continue;
    }

    // Positional match: same node kind and (for elements) same tag → morph in place.
    if (oldChild != null && keyOf(oldChild) == null && compatible(oldChild, newChild)) {
      const nextOld = oldChild.nextSibling;
      morphNode(oldChild, newChild, hooks);
      oldChild = nextOld;
      newChild = nextNew;
      continue;
    }

    // No match: import the new node and insert it before the current old cursor.
    oldParent.insertBefore(document.importNode(newChild, true), oldChild);
    newChild = nextNew;
  }

  // Remove any old children the new markup did not account for, unless a hook claims the removal
  // (e.g. an out-transition that animates the node away and removes it itself).
  while (oldChild != null) {
    const next = oldChild.nextSibling;
    const claimed = hooks.beforeRemove?.(oldChild) === true;
    if (!claimed) {
      oldParent.removeChild(oldChild);
    }
    oldChild = next;
  }
}

/** Two nodes are positionally compatible if same node type and, for elements, same tag. */
function compatible(a: Node, b: Node): boolean {
  if (a.nodeType !== b.nodeType) {
    return false;
  }
  if (a.nodeType === Node.ELEMENT_NODE) {
    return (a as Element).tagName === (b as Element).tagName;
  }
  return true;
}

/** Morphs one node (text → text in place, element → element, else replace). */
function morphNode(oldNode: Node, newNode: Node, hooks: MorphHooks): void {
  if (oldNode.nodeType === Node.TEXT_NODE && newNode.nodeType === Node.TEXT_NODE) {
    if (oldNode.nodeValue !== newNode.nodeValue) {
      oldNode.nodeValue = newNode.nodeValue;
    }
    return;
  }
  if (oldNode.nodeType === Node.ELEMENT_NODE && newNode.nodeType === Node.ELEMENT_NODE) {
    morphElement(oldNode as Element, newNode as Element, hooks);
    return;
  }
  // Mismatched kinds (e.g. text vs comment): replace wholesale.
  oldNode.parentNode?.replaceChild(document.importNode(newNode, true), oldNode);
}

/** Reconciles an element's attributes and recurses into its children. */
function morphElement(oldEl: Element, newEl: Element, hooks: MorphHooks): void {
  // The morph seam (ADR-0019): a feature may freeze this node or its subtree (`l:ignore`).
  const mode = hooks.elementMode?.(oldEl, newEl) ?? "morph";
  if (mode === "skip") {
    return; // the element and its whole subtree are left exactly as the user/third party left them.
  }

  // Snapshot uncontrolled form state before attribute reconciliation, restore it after unless the
  // server re-asserted it: a re-render the user's typing did not address must not wipe that typing.
  const liveValue = uncontrolledValue(oldEl);

  if (mode !== "children") {
    // "children" means "freeze the element itself" — skip its own attribute reconciliation.
    reconcileAttributes(oldEl, newEl);
    if (liveValue != null && !serverAsserts(newEl, liveValue.kind)) {
      restoreUncontrolledValue(oldEl, liveValue);
    }
  }

  if (mode !== "self") {
    // "self" means "freeze the children" — reconcile this element only, do not recurse.
    morphChildren(oldEl, newEl, hooks);
  }
}

/** The live, user-edited value of an input/textarea/checkbox, or `null` for other elements. */
type LiveValue =
  | { readonly kind: "value"; readonly value: string }
  | { readonly kind: "checked"; readonly value: boolean };

/**
 * Whether `el` is a custom element (a hyphenated tag, the platform rule). Native controls keep
 * their dedicated branch above; only a custom element falls through to the property convention so a
 * Web Awesome `<wa-input>` / `<wa-select>` / `<wa-checkbox>` survives a re-render the same way a
 * native control does.
 */
function isCustomElement(el: Element): boolean {
  return el.tagName.includes("-");
}

/** Whether a custom element carries its state as a boolean `.checked` (checkbox / switch / radio). */
function customElementIsChecked(el: Element): boolean {
  if (!("checked" in el)) {
    return false;
  }
  const role = el.getAttribute("role");
  if (role === "checkbox" || role === "radio" || role === "switch") {
    return true;
  }
  const type = (el as { type?: unknown }).type;
  if (type === "checkbox" || type === "radio" || type === "switch") {
    return true;
  }
  return typeof (el as { checked?: unknown }).checked === "boolean" && !("value" in el);
}

function uncontrolledValue(el: Element): LiveValue | null {
  if (el instanceof HTMLInputElement && (el.type === "checkbox" || el.type === "radio")) {
    return { kind: "checked", value: el.checked };
  }
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    return { kind: "value", value: el.value };
  }
  // Custom-element form controls expose value/checked as a property, symmetric with the read side
  // in directives.ts (the `l:model` value reader). Snapshot it so morph preserves user edits and
  // restores server `@Wire` state on a wa-* control too.
  if (isCustomElement(el)) {
    if (customElementIsChecked(el)) {
      return { kind: "checked", value: Boolean((el as unknown as { checked: unknown }).checked) };
    }
    if ("value" in el) {
      return { kind: "value", value: String((el as unknown as { value: unknown }).value ?? "") };
    }
  }
  return null;
}

/**
 * Whether the server's new markup explicitly sets the control's value/checked. Web Awesome reflects
 * `value` / `checked` as attributes, so the same attribute check serves custom elements; a control
 * that exposes the state only as a property still re-asserts via that attribute when server-set.
 */
function serverAsserts(newEl: Element, kind: LiveValue["kind"]): boolean {
  return kind === "checked" ? newEl.hasAttribute("checked") : newEl.hasAttribute("value");
}

function restoreUncontrolledValue(el: Element, live: LiveValue): void {
  if (live.kind === "checked" && el instanceof HTMLInputElement) {
    el.checked = live.value;
  } else if (
    live.kind === "value" &&
    (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)
  ) {
    el.value = live.value;
  } else if (isCustomElement(el)) {
    // The property convention (shared with the read side), so the restore stays symmetric.
    defaultWriteControlValue(el, live.value);
  }
}

/**
 * Whether an attribute is a CLIENT-runtime bind/state marker the server never authors. The runtime
 * stamps these to record "this element is already wired by feature X" (`data-lievit-bound-l-click`,
 * `data-lievit-init-fired`, the poll/lazy/current/dirty/upload/loading markers). They are absent from
 * every server render, so a plain "remove what the new markup dropped" reconcile would strip them on
 * EVERY morph; the post-morph re-scan would then re-bind the directive and STACK a second listener
 * (one click -> N wire calls; an `l:init` would re-fire in a loop). The morph must preserve them: they
 * are owned by the client, not the server snapshot.
 *
 * The server-authored `data-lievit-*` attributes (`-component`, `-id`, `-snapshot`, `-island`, `-key`,
 * `-sort-key`, `-scope`, `-style-*`, `-release`, `-error-for`, ...) are always present in the new
 * markup, so they reconcile normally and never reach this guard.
 */
function isClientOwnedMarker(name: string): boolean {
  return (
    name.startsWith("data-lievit-bound-") ||
    name === "data-lievit-init-fired" ||
    name === "data-lievit-current-bound" ||
    name === "data-lievit-page-bound" ||
    name === "data-lievit-poll-armed" ||
    name === "data-lievit-lazy-loaded" ||
    name === "data-lievit-upload-bound" ||
    name === "data-lievit-loading-active"
  );
}

/** Adds/updates/removes attributes so `oldEl`'s attributes match `newEl`'s. */
function reconcileAttributes(oldEl: Element, newEl: Element): void {
  // Set or update everything the new markup declares.
  for (const attr of Array.from(newEl.attributes)) {
    if (oldEl.getAttribute(attr.name) !== attr.value) {
      oldEl.setAttribute(attr.name, attr.value);
    }
  }
  // Remove anything the new markup dropped, EXCEPT the client-runtime bind markers (the server never
  // authors them; stripping them re-binds directives and stacks duplicate listeners on every morph).
  for (const attr of Array.from(oldEl.attributes)) {
    if (!newEl.hasAttribute(attr.name) && !isClientOwnedMarker(attr.name)) {
      oldEl.removeAttribute(attr.name);
    }
  }
}
