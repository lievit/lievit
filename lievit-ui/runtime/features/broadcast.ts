/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * Broadcast / live-push notifications (issue #304) and the Echo-listener bridge (issue #45): a
 * server→client channel that pushes an event to a logged-in user's connected clients out-of-band of
 * any wire call. A toast lands live ("someone assigned you a task now") and the persistent-bell
 * refreshes without waiting for the poll.
 *
 * The transport is **Server-Sent Events** (`EventSource`), the lievit-canonical real-time channel:
 * ADR-0001 deferred WebSocket/SSE to v0.2 as an opt-in and rejected the persistent-WebSocket
 * server-held-state model (it forces sticky sessions); SSE keeps the stateless, scale-to-zero posture
 * and is the same `EventSource` shape the streaming feature (`stream.ts`) already uses. The server
 * channel (`GET /lievit/broadcast`) derives the user from the page's security `Principal`, so a client
 * only ever receives its own user's events (the per-user channel of #304's acceptance).
 *
 * Each SSE frame is a JSON envelope `{ name, detail?, to? }` — the same shape as a wire-call
 * {@link import("../effects.js").DispatchedEvent}. The feature parses it and hands it to
 * {@link LievitRuntime.receiveBroadcast}, which routes it exactly as a dispatched event: re-emit on
 * `window` (the admin toast listens there), fire the `runtime.on` JS listeners, and deliver it to the
 * matching mounted components' `@LievitOn` listeners (the echo bridge of #45). A `to` names a target
 * component (e.g. the bell), absent `to` is a global fan-out.
 *
 * Installed WITHOUT editing the core (ADR-0019): the feature owns the `EventSource`; the one core seam
 * it uses is `receiveBroadcast`, which reuses the wire-dispatch routing machinery. It unsubscribes on
 * `lievit:navigate` so a SPA navigation does not leak an open channel (Livewire parity: presence /
 * regular channels are left on navigate-away).
 *
 * Strict-CSP-safe: a same-origin `EventSource`, no inline script, no eval. The SSE endpoint is
 * same-origin, so it rides the page's existing `connect-src 'self'` with no CSP change.
 */

import type { DispatchedEvent } from "../effects.js";
import type { LievitRuntime } from "../runtime.js";
import { openReconnectingSource, type ReconnectOptions } from "./reconnecting-source.js";

/** The default SSE endpoint the server channel is mapped to. */
export const DEFAULT_BROADCAST_URL = "/lievit/broadcast";

/** The event the SPA-navigation feature fires when the page is about to navigate away. */
const NAVIGATE_EVENT = "lievit:navigate";

/**
 * Parses one raw SSE frame into a {@link DispatchedEvent}, or `null` when it is not a valid envelope
 * (not JSON, no string `name`, or an SSE comment/heartbeat). A `null` result is dropped, never thrown.
 *
 * @param raw the raw SSE `data:` payload
 * @returns the parsed broadcast event, or `null` to ignore the frame
 */
export function parseBroadcastEvent(raw: string): DispatchedEvent | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed == null) {
    return null;
  }
  const obj = parsed as Record<string, unknown>;
  if (typeof obj.name !== "string" || obj.name.length === 0) {
    return null;
  }
  const event: { name: string; detail?: Record<string, unknown>; to?: string } = {
    name: obj.name,
  };
  if (typeof obj.detail === "object" && obj.detail != null) {
    event.detail = obj.detail as Record<string, unknown>;
  }
  if (typeof obj.to === "string" && obj.to.length > 0) {
    event.to = obj.to;
  }
  return event;
}

/** An SSE source abstraction so tests feed frames without a real network `EventSource`. */
export interface BroadcastSource {
  /** Register a per-frame handler; returns an unsubscribe that closes the source. */
  readonly onMessage: (handler: (data: string) => void) => () => void;
}

/** Options for {@link installBroadcast}: a custom URL or an injected (test) source. */
export interface BroadcastOptions {
  /** The SSE endpoint URL (default {@link DEFAULT_BROADCAST_URL}). Ignored if `source` is given. */
  readonly url?: string;
  /** An injected source (tests pass a fake; production lets the feature open a real `EventSource`). */
  readonly source?: BroadcastSource;
}

/**
 * Opens a real same-origin SSE `EventSource` at `url` (the browser transport), self-healing across
 * connection drops (ADR-0086): capped jittered exponential backoff on reconnect, resuming from the last
 * seen event id (`Last-Event-ID` gap-recovery; the server must emit `id:` per event for replay).
 * `withCredentials` so the session cookie rides the request and the server resolves the `Principal`.
 *
 * @param url the SSE endpoint URL
 * @param reconnect optional backoff/jitter tuning (defaults are htmx-sse-like)
 * @returns a {@link BroadcastSource} over the live, reconnecting `EventSource`
 */
export function openBroadcastSource(url: string, reconnect: ReconnectOptions = {}): BroadcastSource {
  return {
    onMessage: (handler) =>
      openReconnectingSource(
        url,
        (target) => new EventSource(target, { withCredentials: true }),
        (message) => handler(message.data),
        reconnect,
      ),
  };
}

/**
 * Installs the broadcast feature on a started runtime: subscribes to the server channel and routes
 * each pushed event into the page via {@link LievitRuntime.receiveBroadcast}. Returns an unsubscribe
 * that closes the channel (also fired automatically on `lievit:navigate`).
 *
 * @param runtime the started runtime to extend
 * @param options the SSE URL or an injected source
 * @returns an unsubscribe that closes the channel and detaches the navigate listener
 */
export function installBroadcast(runtime: LievitRuntime, options: BroadcastOptions = {}): () => void {
  const source = options.source ?? openBroadcastSource(options.url ?? DEFAULT_BROADCAST_URL);
  const stop = source.onMessage((data) => {
    const event = parseBroadcastEvent(data);
    if (event != null) {
      runtime.receiveBroadcast(event);
    }
  });
  let closed = false;
  const close = (): void => {
    if (closed) {
      return;
    }
    closed = true;
    stop();
    window.removeEventListener(NAVIGATE_EVENT, close);
  };
  // A SPA navigation tears the page state down: close the channel so it does not leak (#45).
  window.addEventListener(NAVIGATE_EVENT, close);
  return close;
}
