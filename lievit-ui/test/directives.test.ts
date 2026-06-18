/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  DirectiveRegistry,
  type DirectiveRuntime,
  builtinDirectives,
  parseDirective,
} from "../runtime/directives.js";
import { ControlRegistry } from "../runtime/controls.js";

function registry(controls?: ControlRegistry): DirectiveRegistry {
  const reg = new DirectiveRegistry();
  for (const d of builtinDirectives(controls)) {
    reg.register(d);
  }
  return reg;
}

/**
 * A fake value-bearing custom element (a Web Awesome `<wa-input>` / `<wa-select>` stand-in): it
 * exposes `.value` as a property, NOT via the native control interface, and emits the native
 * `input` / `change` / `blur` like Web Awesome does.
 */
class FakeValueControl extends HTMLElement {
  value = "";
}

/** A fake checkbox-like custom element (a `<wa-checkbox>` stand-in): boolean `.checked` + role. */
class FakeCheckControl extends HTMLElement {
  checked = false;
  constructor() {
    super();
    this.setAttribute("role", "checkbox");
  }
}

if (!customElements.get("fake-value")) {
  customElements.define("fake-value", FakeValueControl);
}
if (!customElements.get("fake-check")) {
  customElements.define("fake-check", FakeCheckControl);
}

function fakeRuntime(): DirectiveRuntime & {
  actions: Array<[Element, string]>;
  models: Array<[string, unknown, boolean]>;
} {
  const actions: Array<[Element, string]> = [];
  const models: Array<[string, unknown, boolean]> = [];
  return {
    actions,
    models,
    callAction: (el, a) => actions.push([el, a]),
    setModel: (_el, f, v, s) => models.push([f, v, s]),
  };
}

describe("directive registry (extension point, wire-protocol §5)", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("parses an l: directive name and its modifiers", () => {
    expect(parseDirective("l:keydown.enter")).toEqual({ name: "keydown", modifiers: ["enter"] });
    expect(parseDirective("l:model")).toEqual({ name: "model", modifiers: [] });
    expect(parseDirective("class")).toBeNull();
  });

  it("binds l:click to call the named action", () => {
    document.body.innerHTML = '<button l:click="increment">+</button>';
    const button = document.querySelector("button")!;
    const rt = fakeRuntime();

    registry().scan(document.body, rt);
    button.click();

    expect(rt.actions).toEqual([[button, "increment"]]);
  });

  it("binds at most once per element (idempotent scan)", () => {
    document.body.innerHTML = '<button l:click="go">go</button>';
    const button = document.querySelector("button")!;
    const rt = fakeRuntime();
    const reg = registry();

    reg.scan(document.body, rt);
    reg.scan(document.body, rt); // a re-scan after a morph must not double-bind
    button.click();

    expect(rt.actions).toHaveLength(1);
  });

  it("l:submit prevents the native submit then calls the action", () => {
    document.body.innerHTML = '<form l:submit="save"></form>';
    const form = document.querySelector("form")!;
    const rt = fakeRuntime();
    registry().scan(document.body, rt);

    const event = new Event("submit", { cancelable: true });
    form.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(rt.actions).toEqual([[form, "save"]]);
  });

  it("l:keydown.enter fires only on Enter", () => {
    document.body.innerHTML = '<input l:keydown.enter="submit" />';
    const input = document.querySelector("input")!;
    const rt = fakeRuntime();
    registry().scan(document.body, rt);

    input.dispatchEvent(new KeyboardEvent("keydown", { key: "a" }));
    expect(rt.actions).toHaveLength(0);
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    expect(rt.actions).toEqual([[input, "submit"]]);
  });

  it("l:model (deferred default) stores the value without sending", () => {
    document.body.innerHTML = '<input l:model="name" />';
    const input = document.querySelector("input")!;
    const rt = fakeRuntime();
    registry().scan(document.body, rt);

    input.value = "ada";
    input.dispatchEvent(new Event("input"));

    expect(rt.models).toEqual([["name", "ada", false]]); // stored, send=false (rides next action)
  });

  it("l:model.lazy sends on change", () => {
    document.body.innerHTML = '<input l:model.lazy="name" />';
    const input = document.querySelector("input")!;
    const rt = fakeRuntime();
    registry().scan(document.body, rt);

    input.value = "grace";
    input.dispatchEvent(new Event("change"));

    expect(rt.models).toEqual([["name", "grace", true]]); // send=true
  });

  it("l:model.live debounces and sends (fake timers)", () => {
    vi.useFakeTimers();
    document.body.innerHTML = '<input l:model.live="q" />';
    const input = document.querySelector("input")!;
    const rt = fakeRuntime();
    registry().scan(document.body, rt);

    input.value = "a";
    input.dispatchEvent(new Event("input"));
    input.value = "ab";
    input.dispatchEvent(new Event("input"));
    expect(rt.models).toHaveLength(0); // debounced, nothing sent yet

    vi.advanceTimersByTime(200);
    expect(rt.models).toEqual([["q", "ab", true]]); // one send with the latest value
    vi.useRealTimers();
  });

  it("l:model reads .value from a custom element (Web Awesome wa-input convention)", () => {
    document.body.innerHTML = '<fake-value l:model="name"></fake-value>';
    const el = document.querySelector("fake-value") as FakeValueControl;
    const rt = fakeRuntime();
    registry().scan(document.body, rt);

    el.value = "ada"; // property, the way wa-input exposes it (no textContent fallback)
    el.dispatchEvent(new Event("input"));

    expect(rt.models).toEqual([["name", "ada", false]]);
  });

  it("l:model reads .checked from a checkbox-like custom element (wa-checkbox)", () => {
    document.body.innerHTML = '<fake-check l:model.lazy="agree"></fake-check>';
    const el = document.querySelector("fake-check") as FakeCheckControl;
    const rt = fakeRuntime();
    registry().scan(document.body, rt);

    el.checked = true;
    el.dispatchEvent(new Event("change"));

    expect(rt.models).toEqual([["agree", true, true]]); // boolean, not the string value
  });

  it("l:model.live debounces a custom element on its input event", () => {
    vi.useFakeTimers();
    document.body.innerHTML = '<fake-value l:model.live="q"></fake-value>';
    const el = document.querySelector("fake-value") as FakeValueControl;
    const rt = fakeRuntime();
    registry().scan(document.body, rt);

    el.value = "a";
    el.dispatchEvent(new Event("input"));
    el.value = "ab";
    el.dispatchEvent(new Event("input"));
    expect(rt.models).toHaveLength(0);

    vi.advanceTimersByTime(200);
    expect(rt.models).toEqual([["q", "ab", true]]);
    vi.useRealTimers();
  });

  it("l:model.blur reads a custom element on blur", () => {
    document.body.innerHTML = '<fake-value l:model.blur="name"></fake-value>';
    const el = document.querySelector("fake-value") as FakeValueControl;
    const rt = fakeRuntime();
    registry().scan(document.body, rt);

    el.value = "grace";
    el.dispatchEvent(new Event("blur"));

    expect(rt.models).toEqual([["name", "grace", true]]);
  });

  it("a registered control adapter overrides the default read + change event for its tag", () => {
    const controls = new ControlRegistry();
    controls.register("fake-value", {
      read: (e) => `wrapped:${(e as FakeValueControl).value}`,
      write: (e, v) => {
        (e as FakeValueControl).value = String(v);
      },
      lazyEvent: "wa-change", // exotic control fires a non-standard change event
    });
    document.body.innerHTML = '<fake-value l:model.lazy="name"></fake-value>';
    const el = document.querySelector("fake-value") as FakeValueControl;
    const rt = fakeRuntime();
    registry(controls).scan(document.body, rt);

    el.value = "ada";
    el.dispatchEvent(new Event("change")); // the default event is NOT listened to
    expect(rt.models).toHaveLength(0);

    el.dispatchEvent(new Event("wa-change")); // the adapter's declared event drives the bind
    expect(rt.models).toEqual([["name", "wrapped:ada", true]]);
  });

  it("ignores an unknown l:* directive (forward compatible)", () => {
    document.body.innerHTML = '<div l:future="x"></div>';
    const rt = fakeRuntime();
    expect(() => registry().scan(document.body, rt)).not.toThrow();
    expect(rt.actions).toHaveLength(0);
  });

  it("lets a feature register a new directive (the extension point)", () => {
    const reg = registry();
    const seen: string[] = [];
    reg.register({
      name: "navigate",
      bind: (el, _attr, value) => el.addEventListener("click", () => seen.push(value)),
    });
    document.body.innerHTML = '<a l:navigate="/next">go</a>';
    reg.scan(document.body, fakeRuntime());

    (document.querySelector("a") as HTMLElement).click();
    expect(seen).toEqual(["/next"]);
  });
});
