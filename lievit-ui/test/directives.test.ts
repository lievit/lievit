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

function registry(): DirectiveRegistry {
  const reg = new DirectiveRegistry();
  for (const d of builtinDirectives()) {
    reg.register(d);
  }
  return reg;
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
