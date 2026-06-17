/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
import { beforeEach, describe, expect, it } from "vitest";

import { morph } from "../runtime/morph.js";

function root(html: string): HTMLElement {
  const el = document.createElement("div");
  el.innerHTML = html;
  return el.firstElementChild as HTMLElement;
}

describe("morph (bespoke DOM patch, wire-protocol §5)", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("updates a changed text node in place, preserving the node identity", () => {
    const el = root('<div data-lievit-component="X"><span>0</span></div>');
    const span = el.querySelector("span")!;

    morph(el, '<div data-lievit-component="X"><span>1</span></div>');

    expect(el.querySelector("span")).toBe(span); // same node, morphed
    expect(span.textContent).toBe("1");
  });

  it("reconciles attributes: adds, updates, and removes", () => {
    const el = root('<div data-lievit-component="X" class="a" data-stale="y"></div>');

    morph(el, '<div data-lievit-component="X" class="b" data-fresh="z"></div>');

    expect(el.getAttribute("class")).toBe("b");
    expect(el.getAttribute("data-fresh")).toBe("z");
    expect(el.hasAttribute("data-stale")).toBe(false);
  });

  it("preserves what the user typed when the server re-render does not address the field", () => {
    document.body.innerHTML =
      '<div data-lievit-component="X"><input name="q" /><span>0</span></div>';
    const el = document.body.firstElementChild as HTMLElement;
    const input = el.querySelector("input")!;
    input.value = "hello"; // the user typed; the server never set a value attribute

    morph(el, '<div data-lievit-component="X"><input name="q" /><span>1</span></div>');

    expect(el.querySelector("input")).toBe(input); // same node
    expect(input.value).toBe("hello"); // typing survived the re-render
    expect(el.querySelector("span")!.textContent).toBe("1");
  });

  it("reuses a keyed node when it moves rather than rebuilding it", () => {
    const el = root(
      '<ul data-lievit-component="X"><li id="a">A</li><li id="b">B</li></ul>',
    );
    const liA = el.querySelector("#a")!;
    const liB = el.querySelector("#b")!;

    // Server reorders: b before a.
    morph(el, '<ul data-lievit-component="X"><li id="b">B</li><li id="a">A</li></ul>');

    const items = Array.from(el.querySelectorAll("li"));
    expect(items[0]).toBe(liB); // same DOM nodes, reordered
    expect(items[1]).toBe(liA);
  });

  it("inserts new nodes and removes dropped ones", () => {
    const el = root('<div data-lievit-component="X"><span>keep</span><span>drop</span></div>');

    morph(el, '<div data-lievit-component="X"><span>keep</span><b>new</b></div>');

    expect(el.children.length).toBe(2);
    expect(el.children[0].tagName).toBe("SPAN");
    expect(el.children[1].tagName).toBe("B");
    expect(el.textContent).toBe("keepnew");
  });
});
