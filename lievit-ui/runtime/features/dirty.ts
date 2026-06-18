/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * `l:dirty` (issue #85): mark a component "dirty" — has client-side `l:model` changes not yet synced
 * to the server — and reflect it on `l:dirty` elements. Variants:
 * - `l:dirty` (default) — show via inline `display` while dirty (`.remove` hides while dirty).
 * - `l:dirty.class="cls"` — toggle the class(es) while dirty.
 * - `l:dirty.attr="name"` — set the boolean attribute while dirty.
 * - `l:target="field"` — only react to dirtiness of the named field(s); absent ⇒ any field.
 *
 * A field becomes dirty on `onModelChange`; the whole component clears on a successful `afterCall`
 * (the deferred updates rode the call and the server is now in sync). Pure lifecycle hooks; the core
 * is untouched (ADR-0019). Server-side: none.
 */

import type { ComponentContext } from "../lifecycle.js";
import type { LievitRuntime } from "../runtime.js";

/** Reads an `l:dirty` element's attribute (any modifier), or null. */
function dirtyAttrOf(el: Element): { value: string; modifiers: string[] } | null {
  for (const attr of Array.from(el.attributes)) {
    if (attr.name === "l:dirty" || attr.name.startsWith("l:dirty.")) {
      const modifiers = attr.name.slice("l:dirty".length).split(".").filter((m) => m.length > 0);
      return { value: attr.value, modifiers };
    }
  }
  return null;
}

function split(value: string): string[] {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** Whether an `l:dirty` element reacts to the given dirty field set (honoring `l:target`). */
function matches(el: Element, dirtyFields: Set<string>): boolean {
  const target = el.getAttribute("l:target");
  if (target == null) {
    return dirtyFields.size > 0;
  }
  const names = split(target);
  return names.some((n) => dirtyFields.has(n));
}

/** Applies the dirty visual to one element. */
function setDirty(el: HTMLElement, on: boolean, modifiers: string[], value: string): void {
  const remove = modifiers.includes("remove");
  if (modifiers.includes("class")) {
    const add = on !== remove;
    for (const c of split(value)) {
      el.classList.toggle(c, add);
    }
    return;
  }
  if (modifiers.includes("attr")) {
    const name = value || "data-dirty";
    if (on !== remove) {
      el.setAttribute(name, "");
    } else {
      el.removeAttribute(name);
    }
    return;
  }
  const show = on !== remove;
  if (show) {
    el.style.removeProperty("display");
  } else {
    el.style.setProperty("display", "none");
  }
}

/**
 * Installs dirty tracking on a runtime.
 *
 * @param runtime the started runtime to extend
 * @returns an unsubscribe function that removes the hooks
 */
export function installDirty(runtime: LievitRuntime): () => void {
  const dirtyByRoot = new WeakMap<Element, Set<string>>();

  function fields(root: Element): Set<string> {
    let set = dirtyByRoot.get(root);
    if (set == null) {
      set = new Set();
      dirtyByRoot.set(root, set);
    }
    return set;
  }

  function reflect(ctx: ComponentContext): void {
    const dirty = fields(ctx.root);
    for (const el of Array.from(ctx.root.querySelectorAll("*"))) {
      const spec = dirtyAttrOf(el);
      if (spec == null) {
        continue;
      }
      setDirty(el as HTMLElement, matches(el, dirty), spec.modifiers, spec.value);
    }
  }

  return runtime.use({
    onComponentInit: reflect,
    onModelChange: (ctx, field) => {
      fields(ctx.root).add(field);
      reflect(ctx);
    },
    afterCall: (ctx) => {
      // A successful call synced the deferred updates: the component is clean again.
      fields(ctx.root).clear();
      reflect(ctx);
    },
  });
}
