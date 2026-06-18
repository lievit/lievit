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
  /**
   * The target component NAME for `dispatchTo` (ADR-0030): the client routes the event only to
   * mounted components of this name. Absent for a global `dispatch` or a `dispatchSelf`.
   */
  readonly to?: string;
  /**
   * `true` for `dispatchSelf` (ADR-0030): the client routes the event only to the component that
   * produced it. Absent (or `false`) for a global `dispatch` or a `dispatchTo`.
   */
  readonly self?: boolean;
}

/**
 * The `url` effect (`@LievitUrl` query-string binding, wire-protocol.md §5b): the query string to
 * reflect into the address bar and whether to push or replace a history entry. Server-authored, never
 * a navigation target (only the query string, merged onto the current `pathname`).
 */
export interface UrlEffect {
  /** The query string (no leading `?`), already URL-encoded; `""` clears all parameters. */
  readonly query: string;
  /** `PUSH` adds a back-stack entry; `REPLACE` rewrites the current one. */
  readonly history: "PUSH" | "REPLACE";
}

/** One `js` effect call: a named CSP-safe `$js` handler to invoke (ADR-0024, #131). */
export interface JsEffectCall {
  readonly name: string;
  readonly args?: readonly unknown[];
}

/**
 * The `transition` effect (`@LievitTransition`, #113, server half): an action can ask the client to
 * animate THIS update's morph rather than declaring it statically on the markup. `skip:true` means
 * "no transition for this update" (a server-driven opt-out, e.g. a poll tick). `duration` overrides
 * the per-element default; `name` selects a named transition the client transition feature knows.
 */
export interface TransitionEffect {
  /** True to suppress any transition for this update (a server-driven skip). */
  readonly skip?: boolean;
  /** Override duration in ms for this update's animations. */
  readonly duration?: number;
  /** A named transition the client transition feature recognises (e.g. `"fade"`). */
  readonly name?: string;
}

/** The decoded effects bag (the `Lievit-Effects` header JSON). Every key is optional. */
export interface Effects {
  readonly redirect?: string;
  readonly dispatch?: readonly DispatchedEvent[];
  readonly returns?: unknown;
  /** Per-field validation errors (`{field: [message, ...]}`) when real-time validation failed. */
  readonly errors?: Readonly<Record<string, readonly string[]>>;
  /** The `@LievitUrl` query-string reflection (history push/replace), wire-protocol.md §5b. */
  readonly url?: UrlEffect;
  /** The island names a targeted call re-rendered (ADR-0024, #89): morph only these fragments. */
  readonly islands?: readonly string[];
  /** The server's active build release token (ADR-0024, #105): compare to the client's. */
  readonly release?: string;
  /** Named CSP-safe `$js` handlers to invoke (ADR-0024, #131). */
  readonly js?: readonly JsEffectCall[];
  /** The server-driven transition control for this update (`@LievitTransition`, #113). */
  readonly transition?: TransitionEffect;
  /** A file the action returned for the browser to download (`$this.download`, #161). */
  readonly download?: DownloadEffect;
}

/**
 * The `download` effect (`$this.download`, #161): a file the action returned for the browser to
 * save. The client decodes `content` (base64) into a Blob stamped with `type` and triggers a
 * download named `name`; the HTML body still morphs (the download is additive, not a redirect).
 */
export interface DownloadEffect {
  /** The file name the browser saves it as (may be a UTF-8 name). */
  readonly name: string;
  /** The file content, base64-encoded. */
  readonly content: string;
  /** The MIME content type stamped on the Blob. */
  readonly type: string;
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

/** The DOM event the `url` effect is surfaced as, so the navigate feature can react to it too. */
export const URL_EFFECT_EVENT = "lievit:url";
/** The DOM event the `errors` effect is surfaced as, for a validation-rendering feature to consume. */
export const VALIDATION_EFFECT_EVENT = "lievit:validation-errors";

/**
 * Writes the `url` effect to the browser address bar via the History API (wire-protocol.md §5b). The
 * server emits only the query string; the client merges it onto the current `location.pathname` and
 * never onto a host/scheme, so the effect can never be a navigation target or an open redirect.
 *
 * @param url the decoded url effect (query + push/replace mode)
 * @param history the History to write to (defaults to `window.history`); injectable for tests
 * @param location the location whose pathname to merge onto (defaults to `window.location`)
 */
export function applyUrlEffect(
  url: UrlEffect,
  history: History = window.history,
  location: Location = window.location,
): void {
  const next = location.pathname + (url.query.length > 0 ? `?${url.query}` : "");
  if (url.history === "REPLACE") {
    history.replaceState({}, "", next);
  } else {
    history.pushState({}, "", next);
  }
}

/** Triggers a browser download of a file (the `download` effect side-effect). Injectable for tests. */
export type DownloadTrigger = (download: DownloadEffect) => void;

/** Decodes a base64 string into bytes (browser `atob` is byte-per-char; map to a Uint8Array). */
function base64ToBytes(base64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(base64);
  const buffer = new ArrayBuffer(binary.length);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * The default download trigger (`$this.download`, #161): decode the base64 content into a Blob
 * stamped with the content type, then click a transient `<a download>` pointing at an object URL.
 * Strict-CSP-safe (no inline script, a real anchor click). The object URL is revoked after the click.
 *
 * @param download the decoded download effect (name + base64 content + type)
 */
export const defaultDownloadTrigger: DownloadTrigger = (download) => {
  const blob = new Blob([base64ToBytes(download.content)], { type: download.type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = download.name;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};

/**
 * Applies a decoded effects bag to the browser:
 * - `dispatch` events are re-emitted as DOM `CustomEvent`s on `window` (the cross-component bus);
 * - `errors` is surfaced as a `lievit:validation-errors` event (a validation feature renders them);
 * - `url` updates the address bar via the History API (no navigation), and is surfaced as a
 *   `lievit:url` event so the navigate feature can sync;
 * - `download` triggers a browser download (the HTML body still morphs), before any redirect;
 * - `redirect` navigates last (it ends the page), applied after the dispatches so listeners react
 *   before navigation.
 *
 * `returns` carries no DOM effect by itself; it is exposed to a caller via {@link parseEffects}.
 *
 * @param effects the decoded bag, or `null` (a no-effects call: this is a no-op)
 * @param target the event target to dispatch on (defaults to `window`); injectable for tests
 * @param navigate the navigation function (defaults to `window.location.assign`); injectable
 * @param triggerDownload the download trigger (defaults to {@link defaultDownloadTrigger}); injectable
 */
export function applyEffects(
  effects: Effects | null,
  target: EventTarget = window,
  navigate: (url: string) => void = (url) => window.location.assign(url),
  triggerDownload: DownloadTrigger = defaultDownloadTrigger,
): void {
  if (effects == null) {
    return;
  }
  for (const event of effects.dispatch ?? []) {
    target.dispatchEvent(new CustomEvent(event.name, { detail: event.detail ?? null }));
  }
  if (effects.errors != null) {
    target.dispatchEvent(new CustomEvent(VALIDATION_EFFECT_EVENT, { detail: effects.errors }));
  }
  if (effects.url != null) {
    applyUrlEffect(effects.url);
    target.dispatchEvent(new CustomEvent(URL_EFFECT_EVENT, { detail: effects.url }));
  }
  if (effects.download != null) {
    triggerDownload(effects.download);
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
