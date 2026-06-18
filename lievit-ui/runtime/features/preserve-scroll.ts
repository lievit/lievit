/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * Preserve scroll across a wire request (#117, Livewire `wire:scroll` / `.preserve-scroll`). A morph
 * re-renders a component's subtree; an element the user had scrolled (a long list, a chat log, the
 * window itself) jumps back to the top unless its scroll offset is captured before the morph and
 * restored after. This feature does exactly that, scoped to the elements that opt in.
 *
 * Opt in two ways, both server-rendered markup (no inline script, strict-CSP-safe):
 *
 * - **`l:preserve-scroll`** on a scrollable element — its `scrollTop`/`scrollLeft` are captured
 *   before the call and restored after the morph, keyed by the element's identity within the
 *   component (its `id`, an explicit `l:preserve-scroll="key"` value, or its DOM position).
 * - **a directive modifier** (`l:click.preserve-scroll`, `l:submit.preserve-scroll`) — preserves the
 *   WINDOW scroll across that action, the common "submit a form without jumping to the top" case.
 *
 * Implemented purely through the lifecycle bus (`beforeCall` captures, `afterCall` restores): it
 * never edits the morph or the core loop (ADR-0019). Restoration runs after the morph has landed
 * (the `afterCall` phase fires post-morph in the runtime), so the offsets apply to the fresh DOM.
 */

import type { LievitRuntime } from "../runtime.js";

/** The directive/attribute name (without the `l:` prefix) and the modifier token. */
const ATTR = "l:preserve-scroll";
const MODIFIER = "preserve-scroll";

/** One captured scroll position: the element to restore and its offsets. */
interface ScrollSnapshot {
  readonly el: Element;
  readonly key: string;
  readonly top: number;
  readonly left: number;
}

/** Reads the stable key for a preserved element (explicit value > id > tag+index fallback). */
function keyOf(el: Element, root: Element): string {
  const explicit = el.getAttribute(ATTR);
  if (explicit != null && explicit.length > 0) {
    return explicit;
  }
  if (el.id.length > 0) {
    return `#${el.id}`;
  }
  const siblings = Array.from(root.querySelectorAll(`[${cssAttr(ATTR)}]`));
  return `idx:${siblings.indexOf(el)}`;
}

/** Escapes the `l:` colon for a CSS attribute selector. */
function cssAttr(name: string): string {
  return name.replace(/:/g, "\\:");
}

/** Captures the scroll offsets of every `l:preserve-scroll` element under a component root. */
function captureElements(root: Element): ScrollSnapshot[] {
  const out: ScrollSnapshot[] = [];
  for (const el of Array.from(root.querySelectorAll(`[${cssAttr(ATTR)}]`))) {
    out.push({ el, key: keyOf(el, root), top: el.scrollTop, left: el.scrollLeft });
  }
  return out;
}

/**
 * Installs preserve-scroll on a runtime. Returns an unsubscribe that removes the lifecycle hook.
 *
 * @param runtime the started runtime to extend
 * @param win the window whose scroll to preserve for the modifier form (injectable for tests)
 * @returns an unsubscribe function
 */
export function installPreserveScroll(
  runtime: LievitRuntime,
  win: { scrollX: number; scrollY: number; scrollTo: (x: number, y: number) => void } = window,
): () => void {
  // The pending capture per component root (one in-flight call's worth): the element offsets + an
  // optional window offset (when the triggering directive carried the `.preserve-scroll` modifier).
  const pending = new WeakMap<Element, { elements: ScrollSnapshot[]; window: { x: number; y: number } | null }>();

  return runtime.use({
    beforeCall(ctx) {
      const trigger = ctx.meta?.trigger ?? null;
      const wantsWindow = trigger != null && triggerHasModifier(trigger);
      pending.set(ctx.root, {
        elements: captureElements(ctx.root),
        window: wantsWindow ? { x: win.scrollX, y: win.scrollY } : null,
      });
    },
    afterCall(outcome) {
      const captured = pending.get(outcome.root);
      if (captured == null) {
        return;
      }
      pending.delete(outcome.root);
      // The morph re-rendered the subtree; match captured offsets by key onto the fresh elements.
      const fresh = captureElements(outcome.root);
      const byKey = new Map(captured.elements.map((s) => [s.key, s]));
      for (const f of fresh) {
        const prev = byKey.get(f.key);
        if (prev != null) {
          f.el.scrollTop = prev.top;
          f.el.scrollLeft = prev.left;
        }
      }
      if (captured.window != null) {
        win.scrollTo(captured.window.x, captured.window.y);
      }
    },
  });
}

/** True when the triggering element carries any `l:*.preserve-scroll` modifier (window preserve). */
function triggerHasModifier(trigger: Element): boolean {
  for (const attr of Array.from(trigger.attributes)) {
    if (attr.name.startsWith("l:") && attr.name.split(".").includes(MODIFIER)) {
      return true;
    }
  }
  return false;
}
