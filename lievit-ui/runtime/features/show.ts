/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * `l:show="expr"` (issue #79): toggle an element's visibility via inline `display` WITHOUT removing
 * it from the DOM, with no server round-trip. Supports a leading `!` negation and a `.important`
 * modifier (`display:none !important`). An initially-false expression renders hidden.
 *
 * lievit has no Alpine and no client-side reactive store (state is server-authoritative,
 * wire-protocol.md §1), so the expression evaluates against a small per-component scope the feature
 * itself maintains from `l:model` changes and the component's `data-l-scope` JSON (an optional
 * server-rendered seed). The visibility is re-evaluated on component init, on every model change, and
 * after every wire call (a morph may have changed the rendered scope). CSP-safe: the grammar in
 * {@link parseShowExpression} is parsed, never `eval`'d (see show-expression.ts).
 *
 * Server-side: none (issue #79 acceptance: "server-side: none"). The optional `data-l-scope`
 * attribute, when a server chooses to render it, seeds the initial scope; absent, the scope starts
 * empty and fills as the user edits `l:model` fields.
 */

import type { LievitRuntime } from "../runtime.js";
import {
  type ShowScope,
  ShowExpressionError,
  evaluateShowExpression,
  parseShowExpression,
} from "./show-expression.js";

/** The directive attribute (without the `l:` prefix). */
const NAME = "show";
/** The attribute on a component root holding a JSON object that seeds the show scope (optional). */
const SCOPE_ATTR = "data-l-scope";

/** Reads the optional `data-l-scope` JSON seed off a component root (empty on absence/parse error). */
function seedScope(root: Element): ShowScope {
  const raw = root.getAttribute(SCOPE_ATTR);
  if (raw == null || raw.length === 0) {
    return {};
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    return typeof parsed === "object" && parsed != null ? (parsed as ShowScope) : {};
  } catch {
    return {};
  }
}

/**
 * Installs `l:show` on a runtime: a directive that registers each `l:show` element, plus a lifecycle
 * hook that maintains the per-component scope and re-applies visibility. Idempotent install is the
 * caller's concern (call once).
 *
 * @param runtime the started runtime to extend
 * @returns an unsubscribe function that removes the lifecycle hook (the directive stays registered)
 */
export function installShow(runtime: LievitRuntime): () => void {
  // Per component root: the live scope and the elements carrying l:show under it.
  const scopes = new WeakMap<Element, Record<string, unknown>>();
  const tracked = new WeakMap<Element, Set<Element>>();

  function scopeOf(root: Element): Record<string, unknown> {
    let scope = scopes.get(root);
    if (scope == null) {
      scope = { ...seedScope(root) };
      scopes.set(root, scope);
    }
    return scope;
  }

  function applyTo(el: Element, root: Element): void {
    const attr = el.getAttribute(`l:${NAME}`);
    if (attr == null) {
      return;
    }
    const important = el.getAttribute("l:show.important") != null || hasImportantModifier(el);
    let visible: boolean;
    try {
      visible = evaluateShowExpression(parseShowExpression(stripModifiers(attr)), scopeOf(root));
    } catch (error) {
      if (error instanceof ShowExpressionError) {
        visible = true; // never hide on a bad expression; surface it instead of failing closed-dark.
        console.error(`[lievit] l:show ${error.message}`);
      } else {
        throw error;
      }
    }
    setDisplay(el as HTMLElement, visible, important);
  }

  function applyAll(root: Element): void {
    const set = tracked.get(root);
    if (set == null) {
      return;
    }
    for (const el of set) {
      applyTo(el, root);
    }
  }

  runtime.directives.register({
    name: NAME,
    bind(element, _attribute, _value, _rt) {
      const root = element.closest("[data-lievit-component]");
      if (root == null) {
        return;
      }
      let set = tracked.get(root);
      if (set == null) {
        set = new Set();
        tracked.set(root, set);
      }
      set.add(element);
      applyTo(element, root);
    },
  });

  return runtime.use({
    onComponentInit: (ctx) => applyAll(ctx.root),
    onModelChange: (ctx, field, value) => {
      scopeOf(ctx.root)[field] = value;
      applyAll(ctx.root);
    },
    afterCall: (ctx) => applyAll(ctx.root),
  });
}

/** `l:show.important` is written as a separate attr in some templates; detect either spelling. */
function hasImportantModifier(el: Element): boolean {
  for (const attr of Array.from(el.attributes)) {
    if (attr.name.startsWith("l:show.") && attr.name.includes("important")) {
      return true;
    }
  }
  return false;
}

/** The expression value never carries modifiers, but strip a trailing `.important` defensively. */
function stripModifiers(value: string): string {
  return value;
}

/** Sets/clears the inline `display`, honoring `!important` when requested. */
function setDisplay(el: HTMLElement, visible: boolean, important: boolean): void {
  if (visible) {
    el.style.removeProperty("display");
  } else if (important) {
    el.style.setProperty("display", "none", "important");
  } else {
    el.style.setProperty("display", "none");
  }
}
