/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  ClientEventBus,
  ComponentRegistry,
  routeDispatchedEvents,
} from "../runtime/events.js";

function componentRoot(name: string): HTMLElement {
  const el = document.createElement("div");
  el.setAttribute("data-lievit-component", name);
  document.body.appendChild(el);
  return el;
}

describe("client event system (ADR-0030, #43/#199)", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  describe("ComponentRegistry", () => {
    it("resolves dispatchTo to every mounted component of that name", () => {
      const registry = new ComponentRegistry();
      const a1 = componentRoot("counter");
      const a2 = componentRoot("counter");
      const b = componentRoot("list");
      registry.register(a1);
      registry.register(a2);
      registry.register(b);

      expect(registry.roots("counter")).toEqual([a1, a2]);
      expect(registry.roots("list")).toEqual([b]);
      expect(registry.roots("missing")).toEqual([]);
    });

    it("prunes a root once it leaves the document (no event to a stale root)", () => {
      const registry = new ComponentRegistry();
      const root = componentRoot("counter");
      registry.register(root);
      root.remove();

      expect(registry.roots("counter")).toEqual([]);
      expect(registry.all()).toEqual([]);
    });

    it("ignores a root with no component name", () => {
      const registry = new ComponentRegistry();
      const root = document.createElement("div");
      document.body.appendChild(root);
      registry.register(root);

      expect(registry.all()).toEqual([]);
    });
  });

  describe("ClientEventBus", () => {
    it("invokes a registered JS listener with the event detail", () => {
      const bus = new ClientEventBus();
      const seen: unknown[] = [];
      bus.on("saved", (detail) => seen.push(detail));

      bus.emit("saved", { id: 7 });

      expect(seen).toEqual([{ id: 7 }]);
    });

    it("stops calling a listener after unsubscribe", () => {
      const bus = new ClientEventBus();
      const fn = vi.fn();
      const off = bus.on("saved", fn);
      off();

      bus.emit("saved", null);

      expect(fn).not.toHaveBeenCalled();
    });

    it("is fail-soft: a throwing listener does not stop the others", () => {
      const onError = vi.fn();
      const bus = new ClientEventBus(onError);
      const second = vi.fn();
      bus.on("x", () => {
        throw new Error("boom");
      });
      bus.on("x", second);

      bus.emit("x", null);

      expect(onError).toHaveBeenCalledOnce();
      expect(second).toHaveBeenCalledOnce();
    });
  });

  describe("routeDispatchedEvents", () => {
    it("routes a global dispatch to every OTHER mounted component (not the dispatcher)", () => {
      const registry = new ComponentRegistry();
      const origin = componentRoot("counter");
      const other = componentRoot("list");
      registry.register(origin);
      registry.register(other);
      const bus = new ClientEventBus();

      const routes = routeDispatchedEvents(
        [{ name: "saved", detail: { id: 1 } }],
        origin,
        registry,
        bus,
        new EventTarget(),
      );

      expect(routes).toHaveLength(1);
      expect(routes[0].targets).toEqual([other]);
    });

    it("routes dispatchSelf to the originating component only", () => {
      const registry = new ComponentRegistry();
      const origin = componentRoot("counter");
      const other = componentRoot("counter");
      registry.register(origin);
      registry.register(other);
      const bus = new ClientEventBus();

      const routes = routeDispatchedEvents(
        [{ name: "tick", self: true }],
        origin,
        registry,
        bus,
        new EventTarget(),
      );

      expect(routes[0].targets).toEqual([origin]);
    });

    it("routes dispatchTo to the named component type, including the dispatcher", () => {
      const registry = new ComponentRegistry();
      const origin = componentRoot("counter");
      const target = componentRoot("list");
      registry.register(origin);
      registry.register(target);
      const bus = new ClientEventBus();

      const routes = routeDispatchedEvents(
        [{ name: "refresh", to: "list" }],
        origin,
        registry,
        bus,
        new EventTarget(),
      );

      expect(routes[0].targets).toEqual([target]);
    });

    it("always re-emits on window and the JS bus regardless of target", () => {
      const registry = new ComponentRegistry();
      const origin = componentRoot("counter");
      registry.register(origin);
      const bus = new ClientEventBus();
      const jsSeen: unknown[] = [];
      bus.on("saved", (d) => jsSeen.push(d));
      const winTarget = new EventTarget();
      const winSeen: CustomEvent[] = [];
      winTarget.addEventListener("saved", (e) => winSeen.push(e as CustomEvent));

      routeDispatchedEvents(
        [{ name: "saved", detail: { id: 9 } }],
        origin,
        registry,
        bus,
        winTarget,
      );

      expect(jsSeen).toEqual([{ id: 9 }]);
      expect(winSeen).toHaveLength(1);
      expect(winSeen[0].detail).toEqual({ id: 9 });
    });

    it("omits an event with no component targets from the inbound routes", () => {
      const registry = new ComponentRegistry();
      const origin = componentRoot("counter");
      registry.register(origin);
      const bus = new ClientEventBus();

      // global dispatch with only the dispatcher mounted -> no other component to receive it.
      const routes = routeDispatchedEvents(
        [{ name: "saved" }],
        origin,
        registry,
        bus,
        new EventTarget(),
      );

      expect(routes).toEqual([]);
    });
  });
});
