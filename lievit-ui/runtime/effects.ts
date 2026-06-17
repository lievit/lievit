/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * The client half of the effects channel (ADR-0012): it reads the `Lievit-Effects` response header
 * a wire call returned and applies each effect in the browser. This is the consumer side of the bag
 * the server authors in `LievitEffects` / `WireEffects`.
 *
 * The wire response is HTML body + `Lievit-Snapshot` header (morphed elsewhere) + this optional
 * `Lievit-Effects` header. A no-effects call sends no header, so `applyEffects(null)` is a no-op:
 * the channel is purely additive and backward compatible.
 */

/** One queued browser event, the unit of the `dispatch` effect. */
export interface DispatchedEvent {
  readonly name: string;
  readonly detail?: Record<string, unknown>;
}

/** The decoded effects bag (the `Lievit-Effects` header JSON). Every key is optional. */
export interface Effects {
  readonly redirect?: string;
  readonly dispatch?: readonly DispatchedEvent[];
  readonly returns?: unknown;
}

/**
 * Parses the raw `Lievit-Effects` header value into an {@link Effects} bag.
 *
 * @param header the header value, or `null` when the call produced no effects
 * @returns the decoded effects, or `null` when there is no header (a no-effects call)
 */
export function parseEffects(header: string | null | undefined): Effects | null {
  if (header == null || header.length === 0) {
    return null;
  }
  return JSON.parse(header) as Effects;
}

/**
 * Applies a decoded effects bag to the browser:
 * - `dispatch` events are re-emitted as DOM `CustomEvent`s on `window` (the cross-component bus);
 * - `redirect` navigates (last, since it ends the page); a redirect short-circuits nothing else but
 *   is applied after the dispatches so listeners can react before navigation.
 *
 * `returns` carries no DOM effect by itself; it is exposed to a caller via {@link parseEffects}.
 *
 * @param effects the decoded bag, or `null` (a no-effects call: this is a no-op)
 * @param target the event target to dispatch on (defaults to `window`); injectable for tests
 * @param navigate the navigation function (defaults to `window.location.assign`); injectable
 */
export function applyEffects(
  effects: Effects | null,
  target: EventTarget = window,
  navigate: (url: string) => void = (url) => window.location.assign(url),
): void {
  if (effects == null) {
    return;
  }
  for (const event of effects.dispatch ?? []) {
    target.dispatchEvent(new CustomEvent(event.name, { detail: event.detail ?? null }));
  }
  if (effects.redirect != null) {
    navigate(effects.redirect);
  }
}

/**
 * Convenience: parse a raw header and apply it in one call (the shape a wire-call handler uses).
 *
 * @param header the raw `Lievit-Effects` header value (or `null`)
 * @param target the event target (defaults to `window`)
 * @param navigate the navigation function (defaults to `window.location.assign`)
 * @returns the decoded effects (so a caller can read `returns`), or `null`
 */
export function consumeEffectsHeader(
  header: string | null | undefined,
  target: EventTarget = window,
  navigate: (url: string) => void = (url) => window.location.assign(url),
): Effects | null {
  const effects = parseEffects(header);
  applyEffects(effects, target, navigate);
  return effects;
}
