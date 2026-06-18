/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * `l:teleport` (#115, Livewire `@teleport` / Vue/Alpine `x-teleport` parity): relocate a fragment of
 * a component's rendered DOM to another place on the page (the common case `l:teleport="body"` for a
 * modal/tooltip/dropdown that must escape an `overflow`/`z-index` container) while the fragment stays
 * OWNED by its component: its `l:*` directives bind, it updates reactively across re-renders, and it
 * survives the morph.
 *
 * The mechanism is a placeholder-in-place relocation, designed around lievit's bespoke morph
 * (ADR-0019) and decided in ADR-0052:
 *
 * - The `l:teleport` element itself STAYS in the component subtree as an empty anchor, so the morph
 *   keeps reconciling it against the server markup every call (the server always re-renders the
 *   teleport element WITH its content in place). The morph never sees the relocated nodes, so it
 *   never tries to remove them or fights the relocation.
 * - Relocation happens ONLY on a single sync path (initial bind + after each wire call via the
 *   `afterCall` lifecycle seam, plus the post-morph re-scan via a tracked anchor): the feature
 *   removes the previously relocated nodes and moves the anchor's CURRENT children to the target.
 *   The runtime re-scans + binds the freshly-morphed anchor BEFORE `afterCall` fires (runtime.ts call
 *   order), so the relocated nodes carry live directive bindings; a DOM move preserves event
 *   listeners, so reactivity and events are intact at the target.
 * - Anchors are tracked by element identity (a `Set`), never by a DOM attribute: the morph strips an
 *   attribute the server did not re-render, so a marker attribute would make the re-scan re-bind the
 *   same anchor twice. Binding the same anchor element again is a no-op.
 * - Multiple `l:teleport` elements are independent (each tracks its own relocated set), so several
 *   teleports to the same target do not stomp each other.
 *
 * Fail-soft: a target selector that matches nothing leaves the content in place rather than dropping
 * it. Pure client directive: no wire call, no server hook, strict-CSP-safe (no inline handler, no
 * eval). The server treats `l:teleport` as an ordinary attribute and renders the element in place.
 */

import type { LievitRuntime } from "../runtime.js";

const NAME = "teleport";

/** One tracked teleport: its in-place anchor + the nodes currently relocated to the target. */
interface Teleport {
  readonly anchor: Element;
  readonly target: string;
  relocated: ChildNode[];
}

/**
 * Installs `l:teleport` on a runtime. Returns an unsubscribe that removes the lifecycle hook and
 * pulls every relocated fragment back to its anchor (so teardown leaves no orphaned DOM).
 *
 * @param runtime the started runtime to extend
 * @param doc the document to resolve target selectors against (injectable for tests)
 * @returns an unsubscribe function
 */
export function installTeleport(runtime: LievitRuntime, doc: Document = document): () => void {
  // Tracked by anchor element identity (a Map): the morph strips a marker attribute the server did
  // not re-render, so an attribute marker would make the post-morph re-scan double-bind the anchor.
  const teleports = new Map<Element, Teleport>();

  /** Moves a teleport's current anchor children to its target, after clearing any prior relocation. */
  function sync(t: Teleport): void {
    if (!t.anchor.isConnected) {
      // The anchor was removed (the component unmounted): drop the relocated nodes too.
      for (const node of t.relocated) {
        node.remove();
      }
      t.relocated = [];
      teleports.delete(t.anchor);
      return;
    }
    const target = doc.querySelector(t.target);
    if (target == null) {
      return; // fail-soft: no target, leave the content where the server rendered it.
    }
    // Remove the previously relocated nodes (they are stale: the morph re-rendered the anchor).
    for (const node of t.relocated) {
      node.remove();
    }
    // Move the anchor's current children to the target, recording them for the next sync.
    const moved: ChildNode[] = [];
    for (const child of Array.from(t.anchor.childNodes)) {
      target.appendChild(child);
      moved.push(child);
    }
    t.relocated = moved;
  }

  /** Re-syncs every tracked teleport (used after a morph, and on demand). */
  function syncAll(): void {
    for (const t of [...teleports.values()]) {
      sync(t);
    }
  }

  runtime.directives.register({
    name: NAME,
    bind(element, _attribute, value) {
      if (teleports.has(element)) {
        return; // idempotent: re-binding the same anchor (e.g. a post-morph re-scan) is a no-op.
      }
      const target = value.trim();
      if (target.length === 0) {
        return; // no target selector: nothing to teleport to.
      }
      const teleport: Teleport = { anchor: element, target, relocated: [] };
      teleports.set(element, teleport);
      sync(teleport);
    },
  });

  // After every successful wire call the morph has re-rendered (and the runtime re-scanned) the
  // anchors in place; re-relocate their fresh content to the target.
  const off = runtime.use({ afterCall: () => syncAll() });

  return () => {
    off();
    // Pull every relocated fragment back to its anchor so teardown leaves no orphaned DOM.
    for (const t of teleports.values()) {
      for (const node of t.relocated) {
        t.anchor.appendChild(node);
      }
      t.relocated = [];
    }
    teleports.clear();
  };
}
