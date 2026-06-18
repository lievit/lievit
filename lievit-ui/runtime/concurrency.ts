/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * Per-scope request concurrency (#95, ADR-0051): the cancel-vs-queue policy between simultaneous
 * wire calls, scoped independently per component AND per island. The matrix (Livewire v4 parity,
 * `SupportRequestInteractions`):
 *
 * ```
 *   incoming \ in-flight │ (idle)   user        poll
 *   ─────────────────────┼──────────────────────────────────
 *   user                 │ proceed  proceed[Q]  proceed +abort-poll
 *   poll                 │ proceed  DROP        proceed +abort-poll
 * ```
 *
 * - `user`: a user-driven action (click/submit/model-commit). A user action never cancels another
 *   user action: those QUEUE on the component's serialized commit chain (the runtime's `inFlight`
 *   promise, the existing request-bundling). It DOES cancel an in-flight poll for the same scope.
 * - `poll`: a poll tick. A poll never cancels a user action (it is DROPPED when one is in-flight).
 *   A later poll cancels an earlier poll (only the freshest tick matters).
 * - Different scopes (a component vs its island, island A vs island B, component vs component) are
 *   tracked under distinct keys and never abort each other.
 *
 * This module is the pure state machine: it hands out an {@link AbortSignal} per admitted call and
 * decides proceed-or-drop. The runtime aborts the underlying fetch via that signal (wire.ts threads
 * it). No DOM, no fetch here. Strict-CSP-safe (pure data + `AbortController`).
 */

/** The two request origins the concurrency matrix distinguishes. */
export type RequestKind = "user" | "poll";

/** The decision the registry returns when a call asks to begin. */
export interface BeginDecision {
  /** True when the call may go on the wire; false when it is dropped (a poll behind a user action). */
  readonly proceed: boolean;
  /** The abort signal to thread into the fetch (aborted later if a superseding call arrives). */
  readonly signal: AbortSignal;
  /** Opaque token identifying this call's slot; pass to {@link ConcurrencyRegistry.end}. */
  readonly token: number;
}

/** The live in-flight call recorded for one scope. */
interface InFlight {
  readonly kind: RequestKind;
  readonly controller: AbortController;
  readonly token: number;
}

/**
 * Builds the per-scope key. A component's own calls and each of its islands get independent keys, so
 * the concurrency policy applies per (component, island) pair, never across the whole component. The
 * space between the two parts keeps a component id that happens to equal `c1` + island `""` from
 * colliding with `c` + island `1`.
 *
 * @param componentId the component instance id
 * @param island the island name this call targets, or `null` for a whole-component call
 */
export function scopeKey(componentId: string, island: string | null): string {
  return `${componentId}::${island ?? ""}`;
}

/**
 * The per-scope concurrency engine. One instance lives on the runtime; every wire call begins here
 * (getting its abort signal + a proceed/drop verdict) and ends here (clearing its slot).
 */
export class ConcurrencyRegistry {
  private readonly scopes = new Map<string, InFlight>();
  private nextToken = 1;

  /**
   * Asks to begin a call in a scope. Applies the cancel-vs-queue matrix against any in-flight call
   * for the same scope, hands back an abort signal, and records this call as the scope's in-flight
   * one when it proceeds. A dropped poll still gets a (pre-aborted) signal so callers have a uniform
   * shape; its `proceed` is false.
   *
   * @param componentId the target component id
   * @param island the target island name, or `null` for a whole-component call
   * @param kind whether this is a user action or a poll tick
   */
  begin(componentId: string, island: string | null, kind: RequestKind): BeginDecision {
    const key = scopeKey(componentId, island);
    const current = this.scopes.get(key);

    if (current != null) {
      if (kind === "poll" && current.kind === "user") {
        // A poll never cancels a user action, and never queues behind one: it is dropped. The next
        // tick will try again once the user action has cleared.
        const dropped = new AbortController();
        dropped.abort();
        return { proceed: false, signal: dropped.signal, token: 0 };
      }
      if (current.kind === "poll") {
        // A user action OR a newer poll supersedes an in-flight poll: abort it and take the slot.
        current.controller.abort();
      }
      // A user action over an in-flight user action falls through WITHOUT aborting: the runtime's
      // serialized commit chain queues it, so we just record the new in-flight call.
    }

    const controller = new AbortController();
    const token = this.nextToken++;
    this.scopes.set(key, { kind, controller, token });
    return { proceed: true, signal: controller.signal, token };
  }

  /**
   * Marks a call finished, clearing the scope's in-flight slot IFF this call still owns it. A no-op
   * when a newer call already replaced the slot (so a superseded call settling late never clobbers
   * its successor's record).
   *
   * @param componentId the target component id
   * @param island the target island name, or `null`
   * @param token the token returned by {@link begin}
   */
  end(componentId: string, island: string | null, token: number): void {
    const key = scopeKey(componentId, island);
    const current = this.scopes.get(key);
    if (current != null && current.token === token) {
      this.scopes.delete(key);
    }
  }
}
