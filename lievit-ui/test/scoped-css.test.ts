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
});
