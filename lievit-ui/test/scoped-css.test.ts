/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
import { beforeEach, describe, expect, it } from "vitest";

import { LievitRuntime } from "../runtime/runtime.js";
import { installScopedCss, scopeCss, scopeId } from "../runtime/features/scoped-css.js";

describe("scopeCss (#129)", () => {
  it("prefixes each selector with the scope attribute", () => {
    const out = scopeCss(".title { color: red; }", "Card");
    expect(out).toBe('[data-lievit-scope="Card"] .title { color: red; }');
  });

  it("maps :scope and & to the root element", () => {
    expect(scopeCss(":scope { display: block; }", "Card")).toBe(
      '[data-lievit-scope="Card"] { display: block; }',
    );
    expect(scopeCss("&.open { color: blue; }", "Card")).toBe(
      '[data-lievit-scope="Card"].open { color: blue; }',
    );
  });

  it("scopes each selector in a comma list", () => {
    const out = scopeCss(".a, .b { margin: 0; }", "X");
    expect(out).toBe('[data-lievit-scope="X"] .a, [data-lievit-scope="X"] .b { margin: 0; }');
  });

  it("scopes inner rules of an @media block, keeping the at-rule head", () => {
    const out = scopeCss("@media (min-width: 600px) { .grid { display: grid; } }", "X");
    expect(out).toContain("@media (min-width: 600px) {");
    expect(out).toContain('[data-lievit-scope="X"] .grid { display: grid; }');
  });

  it("derives an attribute-safe scope id from a component FQN", () => {
    expect(scopeId("com.example.Card")).toBe("com-example-Card");
  });
});

describe("scopeCss robustness footguns (ADR-0084 watch list, runtime selector-rewrite)", () => {
  it("does not split the comma inside a :not() functional pseudo-class", () => {
    // The naive split(",") shredded :not(.b, .c) into ".a:not(.b" and ".c)", each scoped wrongly.
    // The whole :not(...) is ONE compound; only the top-level selector gets the scope prefix.
    expect(scopeCss(".a:not(.b, .c) { color: red; }", "X")).toBe(
      '[data-lievit-scope="X"] .a:not(.b, .c) { color: red; }',
    );
  });

  it("does not split a comma inside :is()/:has() and scopes the descendant once", () => {
    expect(scopeCss(":is(.a, .b) .c { color: red; }", "X")).toBe(
      '[data-lievit-scope="X"] :is(.a, .b) .c { color: red; }',
    );
    expect(scopeCss(".card:has(> img, > svg) { color: red; }", "X")).toBe(
      '[data-lievit-scope="X"] .card:has(> img, > svg) { color: red; }',
    );
  });

  it("does not split a comma inside an attribute selector value", () => {
    // [data-x="a,b"] is one selector: the comma is data, not a selector-list separator.
    expect(scopeCss('[data-x="a,b"] { color: red; }', "X")).toBe(
      '[data-lievit-scope="X"] [data-x="a,b"] { color: red; }',
    );
  });

  it("does not treat a brace inside an attribute value as a block boundary", () => {
    // The `{` and `}` inside [data-x="a{b}c"] must not open/close a rule block.
    expect(scopeCss('[data-x="a{b}c"] { color: red; }', "X")).toBe(
      '[data-lievit-scope="X"] [data-x="a{b}c"] { color: red; }',
    );
  });

  it("does not treat a brace inside a comment as a block boundary, and drops a leading comment", () => {
    // `/* a } b { */` carries unbalanced braces that previously corrupted block matching, and the
    // comment text leaked into the scoped selector. The rule resolves to a single scoped selector.
    expect(scopeCss("/* a } b { */ .x { color: red; }", "X")).toBe(
      '[data-lievit-scope="X"] .x { color: red; }',
    );
  });

  it("does not treat a brace/comma inside a declaration string value as structure", () => {
    expect(scopeCss(".x::before { content: '}'; }", "X")).toBe(
      '[data-lievit-scope="X"] .x::before { content: \'}\'; }',
    );
    expect(scopeCss(".x::before { content: 'a,b'; }", "X")).toBe(
      '[data-lievit-scope="X"] .x::before { content: \'a,b\'; }',
    );
  });

  it("does not split on an escaped comma in a class name", () => {
    // `.foo\,bar` is one class whose name contains a comma; the `\,` is not a list separator.
    expect(scopeCss(".foo\\,bar { color: red; }", "X")).toBe(
      '[data-lievit-scope="X"] .foo\\,bar { color: red; }',
    );
  });

  it("never rewrites @keyframes step selectors (from/to/percent) as element selectors", () => {
    // The keyframe body (`from`, `to`, `50%`) is NOT a list of style rules; it must pass through
    // verbatim. Only the trailing real rule is scoped.
    const out = scopeCss(
      "@keyframes spin { from { opacity: 0; } to { opacity: 1; } } .x { color: red; }",
      "X",
    );
    expect(out).toContain("@keyframes spin { from { opacity: 0; } to { opacity: 1; } }");
    expect(out).not.toContain('[data-lievit-scope="X"] from');
    expect(out).not.toContain('[data-lievit-scope="X"] to');
    expect(out).toContain('[data-lievit-scope="X"] .x { color: red; }');
  });

  it("never rewrites @font-face descriptors as selectors", () => {
    const out = scopeCss("@font-face { font-family: 'X'; src: url(x.woff2); } .y { color: red }", "X");
    expect(out).toContain("@font-face { font-family: 'X'; src: url(x.woff2); }");
    expect(out).not.toContain('[data-lievit-scope="X"] font-family');
    expect(out).toContain('[data-lievit-scope="X"] .y { color: red }');
  });

  it("scopes inner rules of a @media block but keeps the media condition verbatim", () => {
    // The media condition `(min-width: 600px)` must never be rewritten as a selector.
    const out = scopeCss("@media (min-width: 600px) { .a, .b { display: grid; } }", "X");
    expect(out).toContain("@media (min-width: 600px) {");
    expect(out).not.toContain('[data-lievit-scope="X"] (min-width');
    expect(out).toContain(
      '[data-lievit-scope="X"] .a, [data-lievit-scope="X"] .b { display: grid; }',
    );
  });

  it("scopes a @media block that itself contains a @keyframes without scoping the steps", () => {
    const out = scopeCss(
      "@media screen { @keyframes k { from { opacity: 0; } } .y { color: red; } }",
      "X",
    );
    expect(out).toContain("@keyframes k { from { opacity: 0; } }");
    expect(out).not.toContain('[data-lievit-scope="X"] from');
    expect(out).toContain('[data-lievit-scope="X"] .y { color: red; }');
  });

  it("scopes every part of a comma selector list (each part independently prefixed)", () => {
    expect(scopeCss(".a, .b > .c { margin: 0; }", "X")).toBe(
      '[data-lievit-scope="X"] .a, [data-lievit-scope="X"] .b > .c { margin: 0; }',
    );
  });

  it("preserves ::before/::after pseudo-elements on the scoped selector", () => {
    expect(scopeCss(".x::after { content: ''; }", "X")).toBe(
      '[data-lievit-scope="X"] .x::after { content: \'\'; }',
    );
  });

  it("scopes a complex nested-functional selector list as a unit", () => {
    expect(scopeCss(".x:not(:is(.a, .b)), .y { color: red }", "X")).toBe(
      '[data-lievit-scope="X"] .x:not(:is(.a, .b)), [data-lievit-scope="X"] .y { color: red }',
    );
  });

  it("is idempotent enough: scoping a comma list does not double-prefix on re-read of its parts", () => {
    // A single pass scopes each part exactly once (no leftover unscoped fragment, no double prefix).
    const out = scopeCss(".a, .b, .c { color: red; }", "X");
    const prefixCount = (out.match(/\[data-lievit-scope="X"\]/g) ?? []).length;
    expect(prefixCount).toBe(3); // one per selector-list part, no more
  });
});

describe("installScopedCss integration (#129)", () => {
  beforeEach(() => {
    document.head.innerHTML = "";
    document.body.innerHTML = "";
  });

  it("hoists a scoped style into head once and stamps the root", () => {
    document.body.innerHTML =
      '<div data-lievit-component="com.example.Card" data-lievit-id="c" data-lievit-snapshot="s">' +
      "<style l:scope>.title { color: red; }</style><h1 class=\"title\">Hi</h1></div>";
    const root = document.body.firstElementChild as HTMLElement;
    const rt = new LievitRuntime();
    installScopedCss(rt);
    rt.start();

    // The root carries the scope attribute and the inline style was removed.
    expect(root.getAttribute("data-lievit-scope")).toBe("com-example-Card");
    expect(root.querySelector("style")).toBeNull();
    // A scoped sheet landed in head.
    const sheet = document.head.querySelector("style[data-lievit-scoped-style]");
    expect(sheet?.textContent).toBe('[data-lievit-scope="com-example-Card"] .title { color: red; }');
  });

  it("does not duplicate the head sheet for a second instance of the same component", () => {
    document.body.innerHTML =
      '<div data-lievit-component="Card" data-lievit-id="a" data-lievit-snapshot="s">' +
      "<style l:scope>.x{color:red}</style></div>" +
      '<div data-lievit-component="Card" data-lievit-id="b" data-lievit-snapshot="s">' +
      "<style l:scope>.x{color:red}</style></div>";
    const rt = new LievitRuntime();
    installScopedCss(rt);
    rt.start();

    expect(document.head.querySelectorAll("style[data-lievit-scoped-style]")).toHaveLength(1);
    // Both instances are stamped.
    expect(
      Array.from(document.querySelectorAll("[data-lievit-scope]")).map((e) => e.getAttribute("data-lievit-id")),
    ).toEqual(["a", "b"]);
  });

  it("applies a scoped functional-pseudo rule to the owner and NOT to a foreign component (real CSSOM)", () => {
    // End-to-end proof the rewritten selector is one the browser engine actually matches: a
    // :not()-bearing rule (previously shredded by the comma-split bug) styles the owning component's
    // element red and leaves an identically-classed foreign element unstyled. happy-dom does real
    // selector matching via getComputedStyle, so this exercises the rewrite past string assertions.
    document.body.innerHTML =
      '<div data-lievit-component="Card" data-lievit-id="c" data-lievit-snapshot="s">' +
      "<style l:scope>.box:not(.muted) { color: rgb(255, 0, 0); }</style>" +
      '<div class="box" id="owned">x</div></div>' +
      '<div data-lievit-component="Other" data-lievit-id="o" data-lievit-snapshot="s">' +
      '<div class="box" id="foreign">y</div></div>';
    const rt = new LievitRuntime();
    installScopedCss(rt);
    rt.start();

    const owned = document.getElementById("owned")!;
    const foreign = document.getElementById("foreign")!;
    expect(getComputedStyle(owned).color).toBe("rgb(255, 0, 0)");
    // The foreign element carries the same class but is NOT under the Card scope, so the rule
    // (which requires the comma INSIDE :not(...) to stay intact) does not reach it.
    expect(getComputedStyle(foreign).color).not.toBe("rgb(255, 0, 0)");
  });

  it("scopes a deeply-namespaced component so its rule cannot leak to a sibling component", () => {
    // The issue's core AC: scoped style applies ONLY to the component subtree; a namespaced name
    // resolves. A foreign component carrying the same class must NOT pick up the scoped selector.
    document.body.innerHTML =
      '<div data-lievit-component="com.acme.ui.deep.Modal" data-lievit-id="m" data-lievit-snapshot="s">' +
      "<style l:scope>.box { color: red; }</style><div class=\"box\">owned</div></div>" +
      '<div data-lievit-component="Other" data-lievit-id="o" data-lievit-snapshot="s">' +
      '<div class="box">foreign</div></div>';
    const rt = new LievitRuntime();
    installScopedCss(rt);
    rt.start();

    const sheet = document.head.querySelector("style[data-lievit-scoped-style]")!;
    // The selector is namespaced-name-scoped and only the Modal root is stamped with it.
    expect(sheet.textContent).toBe('[data-lievit-scope="com-acme-ui-deep-Modal"] .box { color: red; }');
    const modal = document.querySelector('[data-lievit-component="com.acme.ui.deep.Modal"]')!;
    const other = document.querySelector('[data-lievit-component="Other"]')!;
    expect(modal.getAttribute("data-lievit-scope")).toBe("com-acme-ui-deep-Modal");
    // The foreign component carries its OWN scope, never the Modal's, so the scoped `.box` rule
    // (which requires `[data-lievit-scope="com-acme-ui-deep-Modal"]`) cannot match it.
    expect(other.getAttribute("data-lievit-scope")).toBe("Other");
    expect(other.getAttribute("data-lievit-scope")).not.toBe("com-acme-ui-deep-Modal");
  });
});
