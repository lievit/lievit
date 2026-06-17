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
 */


/**
 * Morphs the children of `root` to match `newHtml`. The root element itself is kept; only its
 * subtree is reconciled.
 *
 * @param root the live element whose subtree is patched (the component root)
 * @param newHtml the freshly rendered HTML for that subtree (the wire 200 body)
 */
export function morph(root: Element, newHtml: string): void {
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
    morphElement(root, parsedRoot);
  } else {
    morphChildren(root, template.content);
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
function morphChildren(oldParent: Node, newParent: Node): void {
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
      morphNode(match, newChild);
      newChild = nextNew;
      continue;
    }

    // Positional match: same node kind and (for elements) same tag → morph in place.
    if (oldChild != null && keyOf(oldChild) == null && compatible(oldChild, newChild)) {
      const nextOld = oldChild.nextSibling;
      morphNode(oldChild, newChild);
      oldChild = nextOld;
      newChild = nextNew;
      continue;
    }

    // No match: import the new node and insert it before the current old cursor.
    oldParent.insertBefore(document.importNode(newChild, true), oldChild);
    newChild = nextNew;
  }

  // Remove any old children the new markup did not account for.
  while (oldChild != null) {
    const next = oldChild.nextSibling;
    // A keyed node still in the index was not re-referenced → it is gone from the new markup.
    oldParent.removeChild(oldChild);
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
function morphNode(oldNode: Node, newNode: Node): void {
  if (oldNode.nodeType === Node.TEXT_NODE && newNode.nodeType === Node.TEXT_NODE) {
    if (oldNode.nodeValue !== newNode.nodeValue) {
      oldNode.nodeValue = newNode.nodeValue;
    }
    return;
  }
  if (oldNode.nodeType === Node.ELEMENT_NODE && newNode.nodeType === Node.ELEMENT_NODE) {
    morphElement(oldNode as Element, newNode as Element);
    return;
  }
  // Mismatched kinds (e.g. text vs comment): replace wholesale.
  oldNode.parentNode?.replaceChild(document.importNode(newNode, true), oldNode);
}

/** Reconciles an element's attributes and recurses into its children. */
function morphElement(oldEl: Element, newEl: Element): void {
  // Snapshot uncontrolled form state before attribute reconciliation, restore it after unless the
  // server re-asserted it: a re-render the user's typing did not address must not wipe that typing.
  const liveValue = uncontrolledValue(oldEl);

  reconcileAttributes(oldEl, newEl);

  if (liveValue != null && !serverAsserts(newEl, liveValue.kind)) {
    restoreUncontrolledValue(oldEl, liveValue);
  }

  morphChildren(oldEl, newEl);
}

/** The live, user-edited value of an input/textarea/checkbox, or `null` for other elements. */
type LiveValue =
  | { readonly kind: "value"; readonly value: string }
  | { readonly kind: "checked"; readonly value: boolean };

function uncontrolledValue(el: Element): LiveValue | null {
  if (el instanceof HTMLInputElement && (el.type === "checkbox" || el.type === "radio")) {
    return { kind: "checked", value: el.checked };
  }
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    return { kind: "value", value: el.value };
  }
  return null;
}

/** Whether the server's new markup explicitly sets the control's value/checked attribute. */
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
  }
}

/** Adds/updates/removes attributes so `oldEl`'s attributes match `newEl`'s. */
function reconcileAttributes(oldEl: Element, newEl: Element): void {
  // Set or update everything the new markup declares.
  for (const attr of Array.from(newEl.attributes)) {
    if (oldEl.getAttribute(attr.name) !== attr.value) {
      oldEl.setAttribute(attr.name, attr.value);
    }
  }
  // Remove anything the new markup dropped.
  for (const attr of Array.from(oldEl.attributes)) {
    if (!newEl.hasAttribute(attr.name)) {
      oldEl.removeAttribute(attr.name);
    }
  }
}
