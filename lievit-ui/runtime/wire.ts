/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * The wire-call transport: it serializes a {@link WireCall}, POSTs it to
 * `POST /lievit/{componentId}/call`, and decodes the response into a {@link WireResponse}
 * (the patched HTML body + the new `Lievit-Snapshot` + the optional `Lievit-Effects`), or a
 * {@link WireError} on any non-200 (wire-protocol.md §1/§4, ADR-0001).
 *
 * This module is pure transport: it knows the payload shape and the header names, nothing about
 * the DOM. `runtime.ts` wires it to morphing and effects. Strict-CSP-safe (no eval, fetch only).
 */

import { type Effects, parseEffects } from "./effects.js";
import { toWireValue } from "./encode.js";

/** One inbound event the client routed to this component's `@LievitOn` listeners (ADR-0030, #43). */
export interface InboundWireEvent {
  readonly name: string;
  readonly detail?: Record<string, unknown> | null;
}

/**
 * The endpoint payload `{ _snapshot, _updates, _calls, _events }` (the CSRF `_token` rides
 * separately). `_events` carries the events the client event router decided this component must
 * receive (ADR-0030): the server re-runs the matching `@LievitOn` listeners and re-renders.
 */
export interface WireCall {
  /** The signed snapshot the client carried back (the `_snapshot` field). */
  readonly snapshot: string;
  /** The changed bound `@Wire` fields (the `_updates` map); omitted on the wire when empty. */
  readonly updates: Readonly<Record<string, unknown>>;
  /** The action names to invoke in order (the `_calls` list); omitted on the wire when empty. */
  readonly calls: readonly string[];
  /** The inbound events to deliver to this component's listeners (`_events`); omitted when empty. */
  readonly events?: readonly InboundWireEvent[];
}

/** A successful (`200`) wire response: the patched HTML, the next snapshot, decoded effects. */
export interface WireResponse {
  readonly ok: true;
  /** The freshly rendered component HTML (the response body, morphed into the DOM). */
  readonly html: string;
  /** The next signed snapshot (the `Lievit-Snapshot` header) to carry into the next call. */
  readonly snapshot: string;
  /** The decoded effects bag (`Lievit-Effects` header), or `null` when the call had none. */
  readonly effects: Effects | null;
}

/**
 * A failed wire call. Fail-closed: the client learns the HTTP status and the coarse
 * `Lievit-Reason` (wire-protocol.md §4), never any server internals (the error body is always
 * empty by ADR-0014). `remount` flags the two states (`409`/`410`) whose recovery is a fresh page
 * load rather than a surfaced error.
 */
export interface WireFailure {
  readonly ok: false;
  /** The HTTP status code of the terminal error state. */
  readonly status: number;
  /** The `Lievit-Reason` header value, or `null` when the server sent none. */
  readonly reason: string | null;
  /** True for `409`/`410`: the snapshot no longer matches the server, so the host page reloads. */
  readonly remount: boolean;
}

/** The header names the wire protocol defines (wire-protocol.md §1/§5b). */
export const HEADER_SNAPSHOT = "Lievit-Snapshot";
export const HEADER_EFFECTS = "Lievit-Effects";
export const HEADER_REASON = "Lievit-Reason";

/** The endpoint path for a component id (wire-protocol.md §1). */
export function wireEndpoint(componentId: string): string {
  return `/lievit/${encodeURIComponent(componentId)}/call`;
}

/** The two statuses whose recovery is a re-mount (fresh load), not a surfaced error (§4). */
function isRemount(status: number): boolean {
  return status === 409 || status === 410;
}

/**
 * Builds the JSON request body from a {@link WireCall}, sending `_updates` / `_calls` only when
 * non-empty (a no-op key is omitted, matching the server's `updatesOrEmpty` / `callsOrEmpty`).
 */
function body(call: WireCall): string {
  const payload: Record<string, unknown> = { _snapshot: call.snapshot };
  if (Object.keys(call.updates).length > 0) {
    // Normalize each update value (issue #135): a large binary update (Uint8Array/ArrayBuffer) is
    // base64-encoded in chunks here, so a 300KB+ payload serializes without a call-stack overflow
    // and round-trips intact instead of becoming a lossy `{"0":..}` object under plain JSON.
    payload._updates = toWireValue(call.updates);
  }
  if (call.calls.length > 0) {
    payload._calls = call.calls;
  }
  if (call.events != null && call.events.length > 0) {
    payload._events = call.events;
  }
  return JSON.stringify(payload);
}

/**
 * Options for {@link send}: the CSRF token + its header name (the host page exposes them, usually
 * in `<meta>` tags), and an injectable `fetch` for tests.
 */
export interface SendOptions {
  /** The CSRF token value (the `_token`); sent as a header so Spring Security's filter sees it. */
  readonly csrfToken?: string;
  /** The CSRF header name (defaults to Spring Security's `X-CSRF-TOKEN`). */
  readonly csrfHeader?: string;
  /** Injectable fetch implementation (defaults to the global `fetch`); used in tests. */
  readonly fetchImpl?: typeof fetch;
  /** Extra request headers an interceptor set (ADR-0024 #93); merged onto the call's headers. */
  readonly extraHeaders?: Readonly<Record<string, string>>;
  /**
   * Abort signal for the fetch (#95, ADR-0051): when the per-scope concurrency engine supersedes an
   * in-flight call (a user action arriving over an in-flight poll, a newer poll over an older one),
   * it aborts the signal and the underlying fetch rejects with an `AbortError`. The caller treats
   * that rejection as a silent supersede, not a transport failure.
   */
  readonly signal?: AbortSignal;
}

/**
 * Performs one wire call: POST the snapshot + updates + calls to the component's endpoint, then
 * decode the response. Returns a {@link WireResponse} on 200 or a {@link WireFailure} on any other
 * status. Never throws on an HTTP error (fail-closed: the failure is a value the caller surfaces);
 * a network/transport error rejects the promise so the caller can treat it as a generic failure.
 *
 * @param componentId the component instance id (the `{componentId}` path segment)
 * @param call the snapshot + updates + calls to send
 * @param options CSRF token/header and an injectable fetch
 */
export async function send(
  componentId: string,
  call: WireCall,
  options: SendOptions = {},
): Promise<WireResponse | WireFailure> {
  const doFetch = options.fetchImpl ?? fetch;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (options.csrfToken != null) {
    headers[options.csrfHeader ?? "X-CSRF-TOKEN"] = options.csrfToken;
  }
  // Interceptor-set headers (ADR-0024 #93) are merged last (the Content-Type stays unless overridden).
  for (const [name, value] of Object.entries(options.extraHeaders ?? {})) {
    headers[name] = value;
  }

  const response = await doFetch(wireEndpoint(componentId), {
    method: "POST",
    headers,
    body: body(call),
    // The endpoint inherits the page's auth context (wire-protocol.md §7); send credentials so
    // the session cookie rides with the call.
    credentials: "same-origin",
    // The concurrency engine (#95) aborts this signal to drop a superseded in-flight call.
    signal: options.signal,
  });

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      reason: response.headers.get(HEADER_REASON),
      remount: isRemount(response.status),
    };
  }

  return {
    ok: true,
    html: await response.text(),
    // A 200 always carries a fresh snapshot; an empty string is treated as "no rotation".
    snapshot: response.headers.get(HEADER_SNAPSHOT) ?? "",
    effects: parseEffects(response.headers.get(HEADER_EFFECTS)),
  };
}
