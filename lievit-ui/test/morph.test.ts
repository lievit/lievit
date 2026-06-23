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

/** A value-bearing custom element (wa-input stand-in) that reflects `value` attribute -> property. */
class MorphValueControl extends HTMLElement {
  static get observedAttributes() {
    return ["value"];
  }
  value = "";
  attributeChangedCallback(_n: string, _o: string | null, next: string | null): void {
    this.value = next ?? "";
  }
}

/** A checkbox-like custom element (wa-checkbox stand-in) reflecting `checked` attribute -> property. */
class MorphCheckControl extends HTMLElement {
  static get observedAttributes() {
    return ["checked"];
  }
  checked = false;
  constructor() {
    super();
    this.setAttribute("role", "checkbox");
  }
  attributeChangedCallback(_n: string, _o: string | null, next: string | null): void {
    this.checked = next != null;
  }
}

if (!customElements.get("morph-value")) {
  customElements.define("morph-value", MorphValueControl);
}
if (!customElements.get("morph-check")) {
  customElements.define("morph-check", MorphCheckControl);
}

describe("morph (Idiomorph-backed DOM patch, wire-protocol §5)", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("preserves focus and caret selection across a re-render (Idiomorph restoreFocus)", () => {
    document.body.innerHTML =
      '<div data-lievit-component="X"><input id="q" name="q" value="hello"><span>0</span></div>';
    const el = document.body.firstElementChild as HTMLElement;
    const input = el.querySelector("input")!;
    input.focus();
    input.setSelectionRange(2, 4); // caret across "ll"

    // A re-render that re-asserts the same value must keep focus + the caret selection.
    morph(el, '<div data-lievit-component="X"><input id="q" name="q" value="hello"><span>1</span></div>');

    expect(el.querySelector("input")).toBe(input); // same node
    expect(document.activeElement).toBe(input); // focus survived
    expect([input.selectionStart, input.selectionEnd]).toEqual([2, 4]); // caret survived
    expect(el.querySelector("span")!.textContent).toBe("1");
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

  it("preserves a custom element's .value edit when the server does not re-assert it", () => {
    document.body.innerHTML =
      '<div data-lievit-component="X"><morph-value name="q"></morph-value><span>0</span></div>';
    const el = document.body.firstElementChild as HTMLElement;
    const control = el.querySelector("morph-value") as MorphValueControl;
    control.value = "typed"; // a wa-input edit lives as a property, not an attribute

    morph(el, '<div data-lievit-component="X"><morph-value name="q"></morph-value><span>1</span></div>');

    expect(el.querySelector("morph-value")).toBe(control); // same node
    expect(control.value).toBe("typed"); // the edit survived the re-render
    expect(el.querySelector("span")!.textContent).toBe("1");
  });

  it("lets the server re-assert a custom element's value via the reflected attribute", () => {
    document.body.innerHTML =
      '<div data-lievit-component="X"><morph-value name="q"></morph-value></div>';
    const el = document.body.firstElementChild as HTMLElement;
    const control = el.querySelector("morph-value") as MorphValueControl;
    control.value = "stale";

    // Server @Wire state re-renders with value="server": it must win over the stale local edit.
    morph(el, '<div data-lievit-component="X"><morph-value name="q" value="server"></morph-value></div>');

    expect(el.querySelector("morph-value")).toBe(control);
    expect(control.value).toBe("server");
  });

  it("preserves a checkbox-like custom element's .checked edit across a re-render", () => {
    document.body.innerHTML =
      '<div data-lievit-component="X"><morph-check name="agree"></morph-check><span>0</span></div>';
    const el = document.body.firstElementChild as HTMLElement;
    const control = el.querySelector("morph-check") as MorphCheckControl;
    control.checked = true; // the user ticked a wa-checkbox

    morph(el, '<div data-lievit-component="X"><morph-check name="agree"></morph-check><span>1</span></div>');

    expect(el.querySelector("morph-check")).toBe(control);
    expect(control.checked).toBe(true); // boolean state survived
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
