/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * Light-DOM styling helper shared by every lievit-ui primitive.
 *
 * lievit-ui components render into the light DOM (`createRenderRoot() { return this; }`)
 * so adopter CSS and the `--lv-*` tokens cascade in freely and there is no shadow root to
 * pierce (docs/lievit-ui.md, ADR-0005/0009). The catch: Lit's `static styles` only applies
 * inside a shadow root, so a light-DOM component cannot use it. Instead each component
 * registers its base stylesheet once per document via `adoptLightStyles`; the rules are
 * authored against `.lv-*` class names and the tokens, never hardcoded values.
 *
 * This is copy-in source the adopter owns: the very first `lievit add <component>` brings
 * it in alongside the component, and it is referenced by registryDependencies so it is
 * never an orphan.
 */

const adopted = new Set<string>();

/**
 * Adopt a component's base stylesheet into the document exactly once, keyed by `id`.
 *
 * Uses Constructable Stylesheets (`document.adoptedStyleSheets`) where available and falls
 * back to a `<style>` element otherwise. Idempotent: a second call with the same `id` is a
 * no-op, so connecting many instances of the same component injects one stylesheet.
 *
 * @param id  a stable key for the component's stylesheet (e.g. "lv-button")
 * @param css the CSS text, authored against `.lv-*` classes and `--lv-*` tokens
 */
export function adoptLightStyles(id: string, css: string): void {
  if (adopted.has(id)) {
    return;
  }
  adopted.add(id);

  const root = document;
  const supportsConstructable =
    "adoptedStyleSheets" in Document.prototype &&
    typeof CSSStyleSheet !== "undefined" &&
    // a constructable sheet supports replaceSync; some test DOMs expose neither
    typeof (CSSStyleSheet.prototype as { replaceSync?: unknown }).replaceSync ===
      "function";

  if (supportsConstructable) {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(css);
    root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet];
    return;
  }

  const style = root.createElement("style");
  style.setAttribute("data-lievit-ui", id);
  style.textContent = css;
  root.head.appendChild(style);
}

/**
 * Reset the adoption registry. Test-only: lets a suite assert first-adoption behaviour
 * deterministically across cases. Not part of the runtime contract.
 */
export function resetAdoptedStylesForTest(): void {
  adopted.clear();
}
