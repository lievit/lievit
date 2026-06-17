/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
import { beforeEach, describe, expect, it } from "vitest";

import { DirectiveRegistry, type DirectiveRuntime } from "../runtime/directives.js";
import type { LifecycleHook } from "../runtime/lifecycle.js";
import { RefRegistry, registerV4Directives } from "../runtime/v4-directives.js";

/** A test harness: a registry + the lifecycle hooks the cluster registered, fired manually. */
function harness(opts: {
  ephemeral?: Record<string, unknown>;
  errors?: Record<string, readonly string[]>;
} = {}) {
  const registry = new DirectiveRegistry();
  const hooks: LifecycleHook[] = [];
  const refs = new RefRegistry();
  const ephemeral = opts.ephemeral ?? {};
  registerV4Directives({
    registerDirective: (d) => registry.register(d),
    use: (h) => {
      hooks.push(h);
      return () => {};
    },
    ephemeral: (_el, field) => ephemeral[field],
    refs,
    errorsFor: () => opts.errors ?? {},
  });

  const models: Array<[string, unknown, boolean]> = [];
  const runtime: DirectiveRuntime = {
    callAction: () => {},
    setModel: (_el, f, v, s) => models.push([f, v, s]),
  };

  const root = document.createElement("div");
  root.setAttribute("data-lievit-component", "Demo");
  document.body.appendChild(root);

  const fire = (phase: keyof LifecycleHook, ...args: unknown[]) => {
    for (const h of hooks) {
      (h[phase] as ((...a: unknown[]) => void) | undefined)?.(...args);
    }
  };

  return { registry, runtime, root, refs, models, fire };
}

describe("v4 directive cluster (ADR-0024)", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("l:bind reflects an ephemeral field onto a boolean attribute (#75)", () => {
    const h = harness({ ephemeral: { saving: true } });
    h.root.innerHTML = `<button l:bind.disabled="saving">Save</button>`;
    h.registry.scan(h.root, h.runtime);
    const btn = h.root.querySelector("button")!;
    expect(btn.hasAttribute("disabled")).toBe(true);
  });

  it("l:text binds an element's textContent to an ephemeral field (#77)", () => {
    const h = harness({ ephemeral: { name: "Ada" } });
    h.root.innerHTML = `<span l:text="name"></span>`;
    h.registry.scan(h.root, h.runtime);
    expect(h.root.querySelector("span")!.textContent).toBe("Ada");
  });

  it("l:dirty shows the indicator while the component has uncommitted edits, hides on commit (#85)", () => {
    const h = harness();
    h.root.innerHTML = `<em l:dirty>unsaved</em>`;
    h.registry.scan(h.root, h.runtime);
    const indicator = h.root.querySelector("em")! as HTMLElement;
    expect(indicator.hidden).toBe(true); // clean by default

    h.fire("onModelChange", { root: h.root, componentId: "c1" }, "x", "1");
    expect(indicator.hidden).toBe(false); // dirty
    expect(h.root.hasAttribute("data-lievit-dirty")).toBe(true);

    h.fire("afterCall", { root: h.root, componentId: "c1", status: 200, ok: true, reason: null });
    expect(indicator.hidden).toBe(true); // committed → clean
    expect(h.root.hasAttribute("data-lievit-dirty")).toBe(false);
  });

  it("l:error renders a field's first validation message from the errors effect (#101)", () => {
    const h = harness({ errors: { email: ["must be an email", "too short"] } });
    h.root.innerHTML = `<small l:error="email"></small>`;
    h.registry.scan(h.root, h.runtime);
    const el = h.root.querySelector("small")! as HTMLElement;
    expect(el.hidden).toBe(true); // hidden before any call

    h.fire("afterCall", { root: h.root, componentId: "c1", status: 200, ok: true, reason: null });
    expect(el.hidden).toBe(false);
    expect(el.textContent).toBe("must be an email");
  });

  it("l:ref registers a named element ref scoped to its component (#109)", () => {
    const h = harness();
    h.root.innerHTML = `<input l:ref="search">`;
    h.registry.scan(h.root, h.runtime);
    expect(h.refs.get(h.root, "search")).toBe(h.root.querySelector("input"));
  });

  it("l:sort commits the reordered keys as a model update (#111)", () => {
    const h = harness();
    h.root.innerHTML = `
      <ul l:sort="order">
        <li data-lievit-sort-key="a">A</li>
        <li data-lievit-sort-key="b">B</li>
      </ul>`;
    h.registry.scan(h.root, h.runtime);
    const ul = h.root.querySelector("ul")!;
    const [a, b] = Array.from(ul.querySelectorAll("li"));
    // Simulate dragging A onto B.
    a!.dispatchEvent(new Event("dragstart", { bubbles: true }));
    b!.dispatchEvent(new Event("drop", { bubbles: true, cancelable: true }));
    expect(h.models.length).toBeGreaterThan(0);
    const [field, value, send] = h.models.at(-1)!;
    expect(field).toBe("order");
    expect(value).toEqual(["b", "a"]);
    expect(send).toBe(true);
  });

  it("disable-during-request disables a button while a call is in flight (#125)", () => {
    const h = harness();
    h.root.innerHTML = `<button l:loading>Save</button>`;
    h.registry.scan(h.root, h.runtime);
    const btn = h.root.querySelector("button")! as HTMLButtonElement;

    h.fire("beforeCall", { root: h.root, componentId: "c1", calls: ["save"], updates: {} });
    expect(btn.disabled).toBe(true);

    h.fire("afterCall", { root: h.root, componentId: "c1", status: 200, ok: true, reason: null });
    expect(btn.disabled).toBe(false);
  });
});
