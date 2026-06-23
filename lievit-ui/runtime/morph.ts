/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * The lievit DOM morph (wire-protocol.md §5). It walks the live DOM toward freshly rendered markup,
 * preserving node identity where structure matches so focus, selection, scroll, in-flight transitions
 * and uncontrolled input state survive the patch.
 *
 * ## Idiomorph, vendored (ADR-0084)
 *
 * The morphing ALGORITHM is **Idiomorph** (the htmx-ecosystem morph, vendored at
 * {@link ./vendor/idiomorph.js}, 0BSD, eval-free). lievit previously shipped a bespoke ~390-line
 * morph; ADR-0084 ("renounce in-house where a proven implementation exists") retired it: DOM morphing
 * is a hard algorithm (its #12 unkeyed-sibling mis-pair was the standing evidence), and a single
 * battle-tested file vendored-with-provenance keeps the bundle dependency-free while fixing that whole
 * class of bug (Idiomorph's id-set matching pairs reordered/shifted siblings correctly).
 *
 * This file is the THIN lievit wiring around Idiomorph. It maps every behavior the wire relies on onto
 * Idiomorph's callbacks WITHOUT editing the vendored file:
 *
 * - **client-owned markers** (`data-lievit-rt-*`): the server never authors them, so a plain
 *   "remove what the new markup dropped" reconcile would strip them on every morph and the post-morph
 *   re-scan would re-bind directives and stack duplicate listeners. {@link CLIENT_MARKER_PREFIX} +
 *   `beforeAttributeUpdated` keep them (Idiomorph never removes them).
 * - **native input value / checked (#13)**: the server is the source of truth ONLY for what it
 *   renders. A re-render that ASSERTS a control's value (a reflected `value`/`checked` attribute)
 *   pushes that onto the live property (clear or change, defeating the dirty-property detach); a
 *   re-render that does NOT assert it preserves the user's in-progress typing. This is the inverse of
 *   Idiomorph's native `syncInputValue` (which clears a value-less input), so we run lievit's
 *   value reconcile in `afterNodeMorphed`, overwriting Idiomorph's native sync. Extends to custom-
 *   element controls (`<wa-input>`/`<wa-checkbox>`) through {@link defaultWriteControlValue}.
 * - **focus + selection across a morph**: Idiomorph's `restoreFocus` (on by default).
 * - **the morph hooks (ADR-0019 seam)**: {@link MorphHooks.elementMode} (`l:ignore`) and
 *   {@link MorphHooks.beforeRemove} (`l:transition`) map onto `beforeNodeMorphed` /
 *   `beforeAttributeUpdated` / `beforeNodeRemoved`.
 *
 * Scope: it morphs the *children* of a root element toward a new HTML string, or the root element
 * itself when the markup re-renders a single same-tag root (so the root's own attributes reconcile).
 * That is exactly the lievit wire contract (the 200 body is the component's rendered markup).
 */

import { defaultWriteControlValue } from "./controls.js";
import { Idiomorph } from "./vendor/idiomorph.js";

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

/** No-op hooks: the default when a caller passes none. */
const NO_HOOKS: MorphHooks = {};

/**
 * Morphs the children of `root` to match `newHtml`. The root element itself is kept; only its
 * subtree is reconciled, UNLESS `newHtml` re-renders a single root element of the same tag, in which
 * case the root's own attributes reconcile too (the component-root re-render case).
 *
 * @param root the live element whose subtree is patched (the component root)
 * @param newHtml the freshly rendered HTML for that subtree (the wire 200 body)
 * @param hooks optional morph hooks (ADR-0019 seam for `l:ignore` / `l:transition`); omitted = the
 *     plain morph
 */
export function morph(root: Element, newHtml: string, hooks: MorphHooks = NO_HOOKS): void {
  // The wire body is the component root's own markup. If it re-renders a SINGLE root element of the
  // same tag, the live root is kept and its own attributes reconcile too (the component-root
  // re-render case); we always morph its CHILDREN with `morphStyle: "innerHTML"`.
  //
  // Why not Idiomorph's `outerHTML` mode for the root? Its soft-match requires id-compatibility: a
  // live root carrying an `id` (or a `data-lievit-id`-style distinguisher) the server markup omits
  // fails the match, so Idiomorph would ADD the new root as a sibling instead of morphing into the
  // live one (the teleport anchor would then never re-render). The bespoke morph matched the root by
  // TAG only and reconciled its attributes; we keep that contract by reconciling the root's own
  // attributes here (markers preserved), then morphing children id-independently with innerHTML.
  const template = document.createElement("template");
  template.innerHTML = newHtml;
  const parsedRoot = template.content.firstElementChild;
  const singleSameTagRoot =
    template.content.childElementCount === 1 &&
    parsedRoot != null &&
    parsedRoot.tagName === root.tagName;
  if (singleSameTagRoot) {
    // Reconcile the root element's own attributes (the children morph below). The root is never a
    // form control and is not subject to `l:ignore` (the hooks apply to its descendants), so a plain
    // marker-aware attribute reconcile is exactly the bespoke contract for it.
    reconcileRootAttributes(root, parsedRoot!);
  }
  const childrenHtml = singleSameTagRoot ? parsedRoot!.innerHTML : newHtml;

  // Per-morph mode tracking for the `l:ignore.self` / `l:ignore.children` partial-freeze cases,
  // which Idiomorph has no single flag for: we resolve the mode once per element (in
  // `beforeNodeMorphed`) and consult it in `beforeAttributeUpdated` (freeze own attrs) and to gate
  // the value reconcile / children recursion.
  const modeOf = new WeakMap<Node, MorphMode>();
  // Elements whose CHILDREN are frozen (`"self"` mode = `l:ignore.children`). Idiomorph has no
  // single "morph attrs but not children" flag, so we freeze each child individually: a child whose
  // live parent is in this set is skipped (`beforeNodeMorphed` returns false), leaving the subtree
  // exactly as the user/third party left it while the element's own attributes still reconcile.
  const childrenFrozen = new WeakSet<Node>();

  Idiomorph.morph(root, childrenHtml, {
    morphStyle: "innerHTML",
    restoreFocus: true,
    callbacks: {
      beforeNodeMorphed: (oldNode, newNode) => {
        if (!isElement(oldNode) || !isElement(newNode)) {
          return true;
        }
        // A child of a "self"-frozen element: leave it (and its subtree) untouched.
        if (oldNode.parentNode != null && childrenFrozen.has(oldNode.parentNode)) {
          return false;
        }
        const mode = hooks.elementMode?.(oldNode, newNode) ?? "morph";
        modeOf.set(oldNode, mode);
        if (mode === "skip") {
          // Freeze the element and its whole subtree: Idiomorph touches neither.
          return false;
        }
        if (mode === "self") {
          // Reconcile this element's own attributes (handled below) but freeze its children.
          childrenFrozen.add(oldNode);
        }
        // Snapshot the live (possibly user-edited) control value BEFORE Idiomorph reconciles
        // attributes, so the `afterNodeMorphed` reconcile can restore in-progress typing or apply a
        // server-asserted value (#13). Skipped for "children" mode (the element itself is frozen).
        if (mode !== "children") {
          const live = uncontrolledValue(oldNode);
          if (live != null) {
            liveValues.set(oldNode, live);
          }
        }
        return true;
      },
      afterNodeMorphed: (oldNode, newNode) => {
        if (!isElement(oldNode) || !isElement(newNode)) {
          return;
        }
        const mode = modeOf.get(oldNode) ?? "morph";
        if (mode === "children") {
          // "children" mode froze the element itself: no value reconcile for it.
          return;
        }
        const live = liveValues.get(oldNode);
        if (live == null) {
          return;
        }
        liveValues.delete(oldNode);
        // The server is the source of truth ONLY for a control it re-asserts. Idiomorph's native
        // `syncInputValue` already ran during attribute reconciliation; lievit's contract (#13)
        // overwrites it here: an asserted value lands on the live property (clear/change), an
        // un-asserted re-render keeps the user's in-progress typing.
        if (serverAsserts(newNode, live.kind)) {
          applyServerAssertedValue(oldNode, newNode, live.kind);
        } else {
          restoreUncontrolledValue(oldNode, live);
        }
      },
      beforeAttributeUpdated: (attributeName, node, mutationType) => {
        // Client-runtime markers are owned by the client, never the server snapshot: keep them so a
        // re-scan does not re-bind directives and stack duplicate listeners.
        if (mutationType === "remove" && isClientOwnedMarker(attributeName)) {
          return false;
        }
        // "self" mode (`l:ignore.children`) reconciles the element's own attributes, "children" mode
        // (`l:ignore.self`) freezes them. The mode was resolved in `beforeNodeMorphed`.
        if (modeOf.get(node) === "children") {
          return false; // freeze this element's own attributes
        }
        return true;
      },
      beforeNodeRemoved: (node) => {
        // A leftover live node the new markup dropped. A feature (l:transition) may claim its removal
        // to animate it out and remove it itself later; if claimed, Idiomorph leaves it in place.
        if (hooks.beforeRemove?.(node) === true) {
          return false;
        }
        return true;
      },
    },
  });
}

/**
 * Per-morph snapshot of a control's live value, keyed by node. Set in `beforeNodeMorphed`, consumed
 * (and cleared) in `afterNodeMorphed`. A module-level WeakMap rather than a closure variable so a
 * nested morph (Idiomorph recurses through the same callbacks) never clobbers an outer snapshot.
 */
const liveValues = new WeakMap<Node, LiveValue>();

function isElement(node: Node): node is Element {
  return node.nodeType === Node.ELEMENT_NODE;
}

/** The live, user-edited value of an input/textarea/checkbox, or `null` for other elements. */
type LiveValue =
  | { readonly kind: "value"; readonly value: string }
  | { readonly kind: "checked"; readonly value: boolean };

/**
 * Whether `el` is a custom element (a hyphenated tag, the platform rule). Native controls keep their
 * dedicated branch; only a custom element falls through to the property convention so a Web Awesome
 * `<wa-input>` / `<wa-select>` / `<wa-checkbox>` survives a re-render the same way a native control
 * does.
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

/**
 * Pushes the server's ASSERTED value/checked (read from `newEl`'s reflected attribute) onto `oldEl`'s
 * live property (#13). Needed because a native `<input>`/`<textarea>` detaches its `.value` (and a
 * checkbox its `.checked`) from the corresponding attribute the moment the user types/toggles; after
 * that, a server clear or change is invisible unless written to the property directly. An ABSENT
 * attribute on the asserted kind (e.g. `checked` removed) asserts the empty / unchecked state.
 */
function applyServerAssertedValue(oldEl: Element, newEl: Element, kind: LiveValue["kind"]): void {
  if (kind === "checked") {
    const checked = newEl.hasAttribute("checked");
    if (oldEl instanceof HTMLInputElement) {
      oldEl.checked = checked;
    } else if (isCustomElement(oldEl) && "checked" in oldEl) {
      (oldEl as unknown as { checked: boolean }).checked = checked;
    }
    return;
  }
  const value = newEl.getAttribute("value") ?? "";
  if (oldEl instanceof HTMLInputElement || oldEl instanceof HTMLTextAreaElement) {
    oldEl.value = value;
  } else if (isCustomElement(oldEl)) {
    defaultWriteControlValue(oldEl, value);
  }
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
 * The single reserved attribute prefix for EVERY client-runtime morph marker (#13/render-rec). The
 * runtime stamps these to record "this element is already wired by feature X" (the `bound-*` per
 * directive, `init-fired`, the poll/lazy/current/page/upload/loading markers). The server NEVER
 * authors anything under this prefix, so {@link isClientOwnedMarker} is a one-line `startsWith`:
 * adding the NEXT marker only requires choosing a name under this prefix.
 *
 * It is deliberately NOT `data-lievit-` (that namespace is shared with the SERVER-authored attributes
 * `-component`, `-id`, `-snapshot`, `-island`, `-key`, `-sort-key`, `-scope`, `-style-*`, `-release`,
 * `-error-for`, ...): a `startsWith("data-lievit-")` would wrongly preserve those too. The `-rt-`
 * segment (runtime) fences the client-owned subset off from the server-authored one.
 */
export const CLIENT_MARKER_PREFIX = "data-lievit-rt-";

/**
 * Whether an attribute is a CLIENT-runtime bind/state marker the server never authors. Such markers
 * are absent from every server render, so a plain "remove what the new markup dropped" reconcile
 * would strip them on EVERY morph; the post-morph re-scan would then re-bind the directive and STACK
 * a second listener (one click -> N wire calls; an `l:init` would re-fire in a loop). The morph must
 * preserve them: they are owned by the client, not the server snapshot. Every client marker lives
 * under {@link CLIENT_MARKER_PREFIX}, so this is a single prefix test (no per-name allowlist to grow).
 */
function isClientOwnedMarker(name: string): boolean {
  return name.startsWith(CLIENT_MARKER_PREFIX);
}

/**
 * Reconciles the root element's own attributes toward `newEl`'s, preserving the client-runtime
 * markers the server never authors (same rule Idiomorph's `beforeAttributeUpdated` enforces for the
 * descendants). Used for the single-same-tag-root re-render: the live root is kept by identity (so
 * selectors / focus / the teleport anchor survive) and only its attributes move, while its children
 * morph through Idiomorph in `innerHTML` mode.
 */
function reconcileRootAttributes(oldEl: Element, newEl: Element): void {
  for (const attr of Array.from(newEl.attributes)) {
    if (oldEl.getAttribute(attr.name) !== attr.value) {
      oldEl.setAttribute(attr.name, attr.value);
    }
  }
  for (const attr of Array.from(oldEl.attributes)) {
    if (!newEl.hasAttribute(attr.name) && !isClientOwnedMarker(attr.name)) {
      oldEl.removeAttribute(attr.name);
    }
  }
}
