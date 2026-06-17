/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
import { describe, expect, it, vi } from "vitest";

import {
  InterceptorChain,
  actionScope,
  rootScope,
  type InterceptorOutcome,
} from "../runtime/interceptors.js";

function outcome(root: Element): InterceptorOutcome {
  return { componentId: "c1", root, status: 200, ok: true, reason: null };
}

describe("client interceptors (ADR-0024 #93)", () => {
  it("fires phases in the pinned Livewire order", () => {
    const chain = new InterceptorChain();
    const order: string[] = [];
    chain.register({
      onInit: () => order.push("onInit"),
      onSend: () => order.push("onSend"),
      onSuccess: () => order.push("onSuccess"),
      onSync: () => order.push("onSync"),
      onEffect: () => order.push("onEffect"),
      onMorph: () => order.push("onMorph"),
      onFinish: () => order.push("onFinish"),
      onRender: () => order.push("onRender"),
    });
    const root = document.createElement("div");
    const { request } = chain.buildRequest("c1", root, ["save"], {});
    chain.init(request);
    chain.send(request);
    const out = outcome(root);
    chain.success(out);
    chain.sync(out);
    chain.effect(out);
    chain.morphed(out);
    chain.finish(out);
    chain.render(out);
    expect(order).toEqual([
      "onInit",
      "onSend",
      "onSuccess",
      "onSync",
      "onEffect",
      "onMorph",
      "onFinish",
      "onRender",
    ]);
  });

  it("cancel() flips the cancelled flag so the runtime can abort", () => {
    const chain = new InterceptorChain();
    chain.register({ onInit: (req) => req.cancel() });
    const root = document.createElement("div");
    const { request, cancelled } = chain.buildRequest("c1", root, [], {});
    chain.init(request);
    expect(cancelled()).toBe(true);
  });

  it("lets an interceptor mutate outgoing headers and updates", () => {
    const chain = new InterceptorChain();
    chain.register({
      onSend: (req) => {
        req.headers["X-Trace"] = "abc";
        req.updates.injected = true;
      },
    });
    const root = document.createElement("div");
    const { request } = chain.buildRequest("c1", root, ["go"], {});
    chain.send(request);
    expect(request.headers["X-Trace"]).toBe("abc");
    expect(request.updates.injected).toBe(true);
  });

  it("blocks a server redirect when an interceptor calls preventDefault", () => {
    const chain = new InterceptorChain();
    chain.register({ onRedirect: (control) => control.preventDefault() });
    const root = document.createElement("div");
    expect(chain.redirect("/elsewhere", outcome(root))).toBe(true); // prevented
  });

  it("allows a server redirect when no interceptor blocks it", () => {
    const chain = new InterceptorChain();
    chain.register({ onRedirect: () => {} });
    const root = document.createElement("div");
    expect(chain.redirect("/elsewhere", outcome(root))).toBe(false);
  });

  it("scopes a per-action interceptor to calls invoking that action", () => {
    const chain = new InterceptorChain();
    const hit = vi.fn();
    chain.register({ onSend: hit }, actionScope("save"));
    const root = document.createElement("div");
    chain.send(chain.buildRequest("c1", root, ["other"], {}).request);
    expect(hit).not.toHaveBeenCalled();
    chain.send(chain.buildRequest("c1", root, ["save"], {}).request);
    expect(hit).toHaveBeenCalledTimes(1);
  });

  it("scopes a per-component interceptor to its root", () => {
    const chain = new InterceptorChain();
    const a = document.createElement("div");
    const b = document.createElement("div");
    const hit = vi.fn();
    chain.register({ onSend: hit }, rootScope(a));
    chain.send(chain.buildRequest("c1", b, [], {}).request);
    expect(hit).not.toHaveBeenCalled();
    chain.send(chain.buildRequest("c1", a, [], {}).request);
    expect(hit).toHaveBeenCalledTimes(1);
  });

  it("isolates a throwing interceptor (logs, the chain proceeds)", () => {
    const onError = vi.fn();
    const chain = new InterceptorChain(onError);
    const second = vi.fn();
    chain.register({
      onSend: () => {
        throw new Error("boom");
      },
    });
    chain.register({ onSend: second });
    const root = document.createElement("div");
    chain.send(chain.buildRequest("c1", root, [], {}).request);
    expect(onError).toHaveBeenCalledWith("onSend", expect.any(Error));
    expect(second).toHaveBeenCalled(); // the next interceptor still ran
  });

  it("unsubscribe removes the interceptor", () => {
    const chain = new InterceptorChain();
    const hit = vi.fn();
    const off = chain.register({ onSend: hit });
    off();
    const root = document.createElement("div");
    chain.send(chain.buildRequest("c1", root, [], {}).request);
    expect(hit).not.toHaveBeenCalled();
  });
});
