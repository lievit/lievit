/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * Scoped CSS modules per component (#129, Livewire v4 scoped styles): a component ships a
 * `<style l:scope>` block whose rules apply ONLY to that component, never leaking to the rest of the
 * page. lievit keeps the component identity server-side; the client scopes the stylesheet by
 * rewriting each selector to require a per-component-name data attribute (`[data-lievit-scope="..."]`)
 * that the feature stamps on every root of that component.
 *
 * The scope is keyed by component NAME (the `data-lievit-component` value), so the rules are hoisted
 * to `<head>` exactly once per component type rather than re-injected per instance or per morph
 * (idempotent, no stylesheet pile-up). The original inline `<style>` is removed from the component
 * body after hoisting (its rules now live in the scoped head sheet).
 *
 * The selector rewrite is a small, deterministic transform (no full CSS parser, no eval): each
 * top-level selector in a rule gets the scope attribute prepended (`.title` ->
 * `[data-lievit-scope="x"] .title`), and a bare `:scope` / `&` refers to the root itself. `@media`
 * and other at-rules pass through with their inner selectors scoped. This is the CSP-safe analogue
 * of Vue's `scoped` attribute, built from data the client already holds.
 */

import type { LievitRuntime } from "../runtime.js";

const SCOPE_ATTR = "data-lievit-scope";
const STYLE_HOISTED_ATTR = "data-lievit-scoped-style";

/** A scope id derived from a component name (a stable, attribute-safe token). */
export function scopeId(componentName: string): string {
  return componentName.replace(/[^A-Za-z0-9_-]/g, "-");
}

/**
 * Rewrites a stylesheet's selectors so every rule is constrained to a scope attribute. A small
 * tokenizer splits rules on top-level `{`/`}` (respecting nesting for at-rules) and prepends the
 * scope to each selector in a selector list; `:scope` / `&` map to the root element itself.
 *
 * @param css the raw stylesheet text
 * @param scope the scope id (the `[data-lievit-scope="<scope>"]` value)
 * @returns the scoped stylesheet text
 */
export function scopeCss(css: string, scope: string): string {
  const prefix = `[${SCOPE_ATTR}="${scope}"]`;
  return rewriteBlock(css, prefix);
}

/** Rewrites one block of rules (top level or inside an at-rule body). */
function rewriteBlock(css: string, prefix: string): string {
  let out = "";
  let i = 0;
  while (i < css.length) {
    const open = css.indexOf("{", i);
    if (open < 0) {
      out += css.slice(i);
      break;
    }
    const head = css.slice(i, open).trim();
    const close = matchingBrace(css, open);
    const body = css.slice(open + 1, close);
    if (head.startsWith("@")) {
      // An at-rule: keep the head, scope its inner rules (e.g. @media { .x { } }).
      const nested = /^@(media|supports|container|layer)/i.test(head)
        ? rewriteBlock(body, prefix)
        : body;
      out += `${head} {${nested}}`;
    } else if (head.length > 0) {
      out += `${scopeSelectorList(head, prefix)} {${body}}`;
    } else {
      out += `{${body}}`;
    }
    i = close + 1;
  }
  return out;
}

/** Scopes a comma-separated selector list. */
function scopeSelectorList(selectorList: string, prefix: string): string {
  return selectorList
    .split(",")
    .map((selector) => scopeSelector(selector.trim(), prefix))
    .join(", ");
}

/** Scopes one selector: `:scope`/`&` map to the root; everything else is a descendant of it. */
function scopeSelector(selector: string, prefix: string): string {
  if (selector === ":scope" || selector === "&") {
    return prefix;
  }
  if (selector.startsWith(":scope")) {
    return prefix + selector.slice(":scope".length);
  }
  if (selector.startsWith("&")) {
    return prefix + selector.slice(1);
  }
  return `${prefix} ${selector}`;
}

/** Finds the index of the `}` matching the `{` at `open`, honouring nesting. */
function matchingBrace(css: string, open: number): number {
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === "{") {
      depth++;
    } else if (css[i] === "}") {
      depth--;
      if (depth === 0) {
        return i;
      }
    }
  }
  return css.length - 1;
}

/**
 * Installs scoped-CSS handling on a runtime. On every component init it hoists any `<style l:scope>`
 * in the component body into a single scoped `<head>` stylesheet (once per component name) and
 * stamps the scope attribute on the root.
 *
 * @param runtime the started runtime to extend
 * @param doc the document to hoist styles into (injectable for tests)
 * @returns an unsubscribe function removing the lifecycle hook
 */
export function installScopedCss(runtime: LievitRuntime, doc: Document = document): () => void {
  const hoisted = new Set<string>();

  function process(root: Element): void {
    const name = root.getAttribute("data-lievit-component");
    if (name == null || name.length === 0) {
      return;
    }
    const scope = scopeId(name);
    // Stamp every root of this component so the scoped rules apply to it (idempotent).
    root.setAttribute(SCOPE_ATTR, scope);

    const styles = Array.from(root.querySelectorAll("style[l\\:scope], style[data-lievit-scope-source]"));
    if (styles.length === 0) {
      return;
    }
    if (!hoisted.has(scope)) {
      const css = styles.map((s) => s.textContent ?? "").join("\n");
      const sheet = doc.createElement("style");
      sheet.setAttribute(STYLE_HOISTED_ATTR, scope);
      sheet.textContent = scopeCss(css, scope);
      doc.head.appendChild(sheet);
      hoisted.add(scope);
    }
    // Remove the inline source styles from the body (their rules now live in the head sheet).
    for (const s of styles) {
      s.remove();
    }
  }

  return runtime.use({
    onComponentInit(ctx) {
      process(ctx.root);
    },
    afterCall(outcome) {
      // A morph may have re-stamped the root or re-introduced the inline style; re-process it.
      process(outcome.root);
    },
  });
}
