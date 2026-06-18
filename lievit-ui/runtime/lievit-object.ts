/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * The `$lievit` component object (Livewire's `$wire`, ADR-0030 magic actions, the client half): a
 * thin, per-component handle a page's JS (or a Lit island) uses to read/write the component's
 * ephemeral `@Wire` state and drive wire calls, without touching the runtime internals.
 *
 * ```ts
 * const $c = runtime.$lievit(rootEl);
 * $c.$get("count");            // read the ephemeral value
 * $c.$set("count", 5);         // queue a model update (and commit it)
 * $c.$call("increment", 2);    // invoke an @LievitAction
 * $c.$refresh();               // re-render with the pending updates
 * $c.$watch("count", (v) => …) // observe a field's client-side changes
 * const parent = $c.$parent;   // the nearest enclosing component's object, or null
 * ```
 *
 * lievit keeps domain state on the server (wire-protocol.md §1), so `$get` reads the *ephemeral*
 * client mirror (seeded from the signed snapshot, updated on every `l:model` input) — it is the
 * last value the client knows, eventually consistent with the server, never authoritative. `$set`
 * goes through the same settable allowlist a client `_updates` entry obeys server-side (a locked or
 * non-`@Wire` field is dropped), so it can never widen what the wire already permits.
 *
 * Strict-CSP-safe: it is a plain object of methods, never an `eval` of an expression string.
 */

/** A subscriber to a field's client-side value changes (the `$watch` callback). */
export type WatchListener = (value: unknown, field: string) => void;

/** The runtime services a `$lievit` object composes onto (a narrow seam, not the whole runtime). */
export interface LievitObjectDeps {
  /** Reads a field's current ephemeral value for the component owning `element`. */
  readonly get: (element: Element, field: string) => unknown;
  /** Queues a model update for `field` and commits it (the `$set` path). */
  readonly set: (element: Element, field: string, value: unknown) => void;
  /** Invokes a named `@LievitAction` for the component owning `element` (the `$call` path). */
  readonly call: (element: Element, action: string, args: readonly unknown[]) => void;
  /** Re-renders the component owning `element` with its pending updates (the `$refresh` path). */
  readonly refresh: (element: Element) => void;
  /** Resolves the `$lievit` object of the nearest ENCLOSING component, or null at the top. */
  readonly parent: (root: Element) => LievitObject | null;
  /** Registers a `$watch` listener for a field; returns an unsubscribe. */
  readonly watch: (root: Element, field: string, listener: WatchListener) => () => void;
}

/** The `$lievit` component object handed to page JS for one component root. */
export interface LievitObject {
  /** Reads a field's current ephemeral value (eventually-consistent client mirror). */
  $get(field: string): unknown;
  /** Queues a model update and commits it (drops a locked / non-`@Wire` field server-side). */
  $set(field: string, value: unknown): void;
  /** Invokes an `@LievitAction` by name with optional scalar args. */
  $call(action: string, ...args: unknown[]): void;
  /** Re-renders the component with its pending updates (no action). */
  $refresh(): void;
  /** Observes a field's client-side value changes; returns an unsubscribe. */
  $watch(field: string, listener: WatchListener): () => void;
  /** The nearest enclosing component's object, or null when this is a top-level component. */
  readonly $parent: LievitObject | null;
}

/**
 * Builds the `$lievit` object for a component root.
 *
 * @param root the component root element the object handles
 * @param deps the runtime seam (get / set / call / refresh / parent / watch)
 * @returns the per-component `$lievit` object
 */
export function lievitObject(root: Element, deps: LievitObjectDeps): LievitObject {
  return {
    $get(field) {
      return deps.get(root, field);
    },
    $set(field, value) {
      deps.set(root, field, value);
    },
    $call(action, ...args) {
      deps.call(root, action, args);
    },
    $refresh() {
      deps.refresh(root);
    },
    $watch(field, listener) {
      return deps.watch(root, field, listener);
    },
    get $parent() {
      return deps.parent(root);
    },
  };
}
