/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * The client half of the event system (#43 / #199, ADR-0030). The server ships the emitting half
 * (`dispatch` / `dispatchSelf` / `dispatchTo` produce the `dispatch` effect) AND the receiving half
 * (the `_events` payload re-runs a component's `@LievitOn` listeners). This module is the missing
 * router between them: it takes the {@link import("./effects.js").DispatchedEvent}s a wire response
 * carried and DELIVERS each one to its targets per the `self` / `to` routing the server stamped.
 *
 * Three delivery channels, all driven from one route:
 *
 * - **Other mounted components** — every component listening for the name is asked to react. The
 *   client cannot know a component's `@LievitOn` listeners (they are server-side), so it routes the
 *   event back to the server as a `_events` entry on a wire call for that component; the dispatcher
 *   runs the matching listener and re-renders. The {@link ComponentRegistry} tracks which roots are
 *   mounted and under which component name, so `dispatchTo("name")` and the global fan-out resolve
 *   without the runtime walking the DOM on every call.
 * - **`window`** — the event is also re-emitted as a DOM `CustomEvent` on `window`, the cross-app
 *   bus an app's own code (or a Lit island) listens on, matching Livewire's `window.addEventListener`.
 * - **JS listeners** — code that called `runtime.on(name, fn)` (the {@link ClientEventBus}) is
 *   invoked directly, so a page can react to a server event without touching the DOM.
 *
 * The originating component is identified so `dispatchSelf` routes to it alone and a global dispatch
 * does NOT echo back to the dispatcher as a redundant inbound event (Livewire parity: a component
 * does not receive its own global dispatch).
 *
 * Strict-CSP-safe: no eval, no inline handlers; events are real `CustomEvent`s and direct callbacks.
 */

import type { DispatchedEvent } from "./effects.js";

/** The attribute the server renders carrying a component root's component name (the FQN/short name). */
export const COMPONENT_NAME_ATTR = "data-lievit-component";

/**
 * Tracks the components mounted on the page, keyed by their component name, so a `dispatchTo(name)`
 * and the global fan-out resolve to the live roots without scanning the DOM per call. A root is
 * registered on mount (`onComponentInit`) and pruned lazily when it leaves the document (a morph
 * that removed it), so a stale root never receives an event.
 */
export class ComponentRegistry {
  /** name -> the set of live roots of that component name. */
  private readonly byName = new Map<string, Set<Element>>();
  /** A root -> its component name, for the reverse lookup the router needs. */
  private readonly nameOf = new WeakMap<Element, string>();

  /**
   * Registers a mounted component root under its name (idempotent; the runtime calls it on
   * `onComponentInit`). The name is read from the {@link COMPONENT_NAME_ATTR} the server stamped.
   *
   * @param root the component root element
   */
  register(root: Element): void {
    const name = root.getAttribute(COMPONENT_NAME_ATTR);
    if (name == null || name.length === 0) {
      return;
    }
    this.nameOf.set(root, name);
    let set = this.byName.get(name);
    if (set == null) {
      set = new Set();
      this.byName.set(name, set);
    }
    set.add(root);
  }

  /**
   * @param name the component name (`dispatchTo` target)
   * @returns the live, still-connected roots of that component name (stale ones pruned)
   */
  roots(name: string): Element[] {
    return this.live(this.byName.get(name));
  }

  /**
   * @returns every live component root currently mounted (the global-dispatch fan-out set)
   */
  all(): Element[] {
    const out: Element[] = [];
    for (const set of this.byName.values()) {
      out.push(...this.live(set));
    }
    return out;
  }

  /** Drops roots no longer in the document and returns the survivors. */
  private live(set: Set<Element> | undefined): Element[] {
    if (set == null) {
      return [];
    }
    const out: Element[] = [];
    for (const root of set) {
      if (root.isConnected) {
        out.push(root);
      } else {
        set.delete(root);
      }
    }
    return out;
  }
}

/** A JS event listener registered via `runtime.on(name, fn)`; receives the event detail. */
export type ClientEventListener = (detail: Record<string, unknown> | null) => void;

/**
 * The JS-side listener bus: code calls `runtime.on(name, fn)` to react to a server-dispatched event
 * without a DOM `addEventListener`. A fail-soft fan-out (a throwing listener is reported, the rest
 * still run) so one buggy handler cannot break interactivity.
 */
export class ClientEventBus {
  private readonly listeners = new Map<string, Set<ClientEventListener>>();
  private readonly onError: (error: unknown) => void;

  /**
   * @param onError reporter for a listener that throws (defaults to `console.error`)
   */
  constructor(onError?: (error: unknown) => void) {
    this.onError =
      onError ?? ((error) => console.error("[lievit] event listener threw", error));
  }

  /**
   * Registers a JS listener for a server event name.
   *
   * @param name the event name
   * @param listener the callback (receives the event detail, or `null` for a bare signal)
   * @returns an unsubscribe function
   */
  on(name: string, listener: ClientEventListener): () => void {
    let set = this.listeners.get(name);
    if (set == null) {
      set = new Set();
      this.listeners.set(name, set);
    }
    set.add(listener);
    return () => {
      this.listeners.get(name)?.delete(listener);
    };
  }

  /** Fires every JS listener for `name` (fail-soft). */
  emit(name: string, detail: Record<string, unknown> | null): void {
    for (const listener of this.listeners.get(name) ?? []) {
      try {
        listener(detail);
      } catch (error) {
        this.onError(error);
      }
    }
  }
}

/** Where the router decided one dispatched event should be delivered server-side (the inbound set). */
export interface EventRoute {
  /** The dispatched event (name + detail) to deliver as a `_events` entry. */
  readonly event: DispatchedEvent;
  /** The component roots that must re-run their `@LievitOn` listeners for it. */
  readonly targets: readonly Element[];
}

/**
 * Resolves which mounted component roots each dispatched event must be delivered to, per its routing
 * target (ADR-0030), and fires the `window` + JS-listener side effects along the way.
 *
 * - `dispatchSelf` (`self:true`): the originating component only.
 * - `dispatchTo` (`to:"name"`): every mounted component of that name.
 * - global `dispatch`: every OTHER mounted component (a component does not receive its own global
 *   dispatch, Livewire parity).
 *
 * The `window` re-emit and the JS-listener fan-out happen for every event regardless of target, so
 * an app's own code always sees the event (the routing only constrains the *component* delivery).
 *
 * @param events the dispatched events the wire response carried
 * @param origin the component root that produced them (for `self` routing + the global self-exclusion)
 * @param registry the mounted-component registry resolving names -> roots
 * @param bus the JS-listener bus to notify
 * @param target the DOM target to re-emit `CustomEvent`s on (defaults to `window`)
 * @returns the per-event inbound routes the runtime should deliver server-side (empty targets omitted)
 */
export function routeDispatchedEvents(
  events: readonly DispatchedEvent[] | undefined,
  origin: Element,
  registry: ComponentRegistry,
  bus: ClientEventBus,
  target: EventTarget = window,
): EventRoute[] {
  const routes: EventRoute[] = [];
  for (const event of events ?? []) {
    const detail = event.detail ?? null;
    // Always: the cross-app window bus + the JS listeners (Livewire's window.addEventListener).
    target.dispatchEvent(new CustomEvent(event.name, { detail }));
    bus.emit(event.name, detail);

    let targets: Element[];
    if (event.self === true) {
      targets = [origin];
    } else if (event.to != null && event.to.length > 0) {
      targets = registry.roots(event.to);
    } else {
      // Global: every OTHER mounted component (exclude the dispatcher itself).
      targets = registry.all().filter((root) => root !== origin);
    }
    if (targets.length > 0) {
      routes.push({ event, targets });
    }
  }
  return routes;
}
