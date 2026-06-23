/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * SSE reconnection hardening (the live/delivery layer's one evidence-driven improvement, ADR-0086).
 *
 * lievit's two real-time channels — {@link import("./broadcast.js").openBroadcastSource} (the per-user
 * push of #304/#45) and {@link import("./stream.js").openStream} (the AI text-token sink of #153) — both
 * open a same-origin `EventSource`. The browser's native `EventSource` DOES reconnect on its own, but its
 * recovery is the weakest link of the three delivery engines compared in ADR-0086: a fixed retry interval
 * (or whatever the server's last `retry:` said), no jitter (so a fleet that dropped together reconnects in
 * a thundering herd), and gap-recovery only if the server set `id:` AND the *same* `EventSource` instance
 * survives. This module replaces the native reconnect with a managed one, modeled on htmx's `ws`/`sse`
 * extensions (the only one of the three engines with real reconnection hardening) — original
 * implementation, not copied code.
 *
 * What it adds over the native `EventSource`:
 * - **Exponential backoff with full jitter**, capped, **reset on a successful message** — so a brief blip
 *   recovers fast and a long outage backs off without hammering the server, and the herd is spread out.
 * - **`Last-Event-ID` gap-recovery**. The browser's native `EventSource` sends the `Last-Event-ID` request
 *   header automatically *as long as the same instance reconnects and the server set `id:` on its events*.
 *   We tear the native instance down on every error (to take over the backoff), so its internal
 *   last-event-id is lost across our re-open. We therefore track the last seen event id ourselves and pass
 *   it back to the re-opened connection (default: as a query parameter the server reads — the EventSource
 *   constructor cannot set a request header). **Server contract:** the SSE endpoint MUST emit an `id:` line
 *   per event for replay to work; if it does not, the client still reconnects (backoff) but cannot recover
 *   the gap. Documented in ADR-0086 + the SSE guide so an adopter enables replay on their endpoint.
 *
 * CSP-clean: a same-origin `EventSource`, no `eval`, no `new Function`, no inline script. It rides the
 * page's existing `connect-src 'self'`.
 *
 * The `EventSource` factory is injectable so tests drive the reconnect schedule with a fake clock and a
 * fake source, never a real network connection — the same seam the broadcast/stream features already use.
 */

/** A minimal `EventSource`-shaped handle: what this module needs from a real or fake source. */
export interface EventSourceLike {
  /** Register a listener for a named SSE event type (`"message"`, `"error"`, ...). */
  readonly addEventListener: (type: string, listener: (event: MessageEvent) => void) => void;
  /** Close the underlying connection; no further events fire. */
  readonly close: () => void;
}

/** Creates an `EventSourceLike` for a (possibly resume-augmented) URL. Injectable for tests. */
export type EventSourceFactory = (url: string) => EventSourceLike;

/**
 * Backoff + gap-recovery tuning. All times are milliseconds. The defaults are htmx-sse-like: a short base
 * that grows geometrically to a capped ceiling, with full jitter.
 */
export interface ReconnectOptions {
  /** First-retry base delay (ms). Default 1000. The nth retry targets `base * 2^(n-1)`, jittered + capped. */
  readonly baseDelayMs?: number;
  /** Maximum delay between retries (ms). Default 30000. The geometric growth is clamped to this. */
  readonly maxDelayMs?: number;
  /**
   * Jitter applied to each computed delay, in `[0,1]`. Default 1 (full jitter: the actual wait is a
   * uniform random in `[0, target]`). 0 disables jitter (deterministic backoff). Modeled on AWS
   * "full jitter".
   */
  readonly jitter?: number;
  /** The query parameter used to carry `Last-Event-ID` on a managed re-open. Default `lastEventId`. */
  readonly lastEventIdParam?: string;
  /** Injected `setTimeout` (tests pass a fake clock). Default the global `setTimeout`. */
  readonly setTimeoutImpl?: (handler: () => void, timeoutMs: number) => unknown;
  /** Injected `clearTimeout` paired with {@link setTimeoutImpl}. Default the global `clearTimeout`. */
  readonly clearTimeoutImpl?: (handle: unknown) => void;
  /** Injected `Math.random` source in `[0,1)` (tests pin jitter). Default `Math.random`. */
  readonly randomImpl?: () => number;
}

/**
 * Computes the backoff delay for retry attempt `attempt` (1-based: the first reconnect is `attempt = 1`).
 * The target is `min(maxDelay, baseDelay * 2^(attempt-1))`; full jitter then draws a uniform value in
 * `[target * (1 - jitter), target]`. Exposed for the schedule test.
 *
 * @param attempt the 1-based retry number
 * @param opts the resolved base/max/jitter and the random source
 * @returns the delay (ms) to wait before this reconnect
 */
export function backoffDelay(
  attempt: number,
  opts: {
    baseDelayMs: number;
    maxDelayMs: number;
    jitter: number;
    randomImpl: () => number;
  },
): number {
  const exponent = Math.max(0, attempt - 1);
  const uncapped = opts.baseDelayMs * 2 ** exponent;
  const target = Math.min(opts.maxDelayMs, uncapped);
  if (opts.jitter <= 0) {
    return target;
  }
  const spread = target * Math.min(1, opts.jitter);
  // Full-jitter draw in [target - spread, target]: random()*spread is the amount removed from target.
  return target - opts.randomImpl() * spread;
}

/**
 * Appends `Last-Event-ID` to a URL as a query parameter, so a managed re-open resumes after the last
 * delivered event (the constructor cannot set the request header on a fresh `EventSource`). A blank id is
 * a no-op (nothing delivered yet, or the server emits no `id:`). Same-origin URLs only; the base is a
 * throwaway used solely to parse relative URLs.
 *
 * @param url the SSE endpoint (absolute or relative)
 * @param lastEventId the last received event id (`""` when none)
 * @param param the query parameter name
 * @returns the url, with the resume parameter appended when an id is present
 */
export function withLastEventId(url: string, lastEventId: string, param: string): string {
  if (lastEventId.length === 0) {
    return url;
  }
  const base = typeof location !== "undefined" ? location.origin : "http://localhost";
  const parsed = new URL(url, base);
  parsed.searchParams.set(param, lastEventId);
  // Keep a relative URL relative (the broadcast/stream endpoints are `/lievit/*`).
  const isAbsolute = /^[a-z][a-z0-9+.-]*:\/\//i.test(url);
  return isAbsolute ? parsed.toString() : parsed.pathname + parsed.search + parsed.hash;
}

/** A message delivered by a {@link ReconnectingSource}: the `data:` payload, the optional event `id:`. */
export interface ReconnectMessage {
  /** The SSE `data:` payload. */
  readonly data: string;
  /** The SSE `id:` of the event, if the server set one (`""` when absent). */
  readonly lastEventId: string;
}

/**
 * Opens a self-healing SSE source over a {@link EventSourceFactory}: it owns the `EventSource`, hands each
 * message to `onMessage`, and on a connection error reconnects with capped jittered exponential backoff,
 * resuming from the last seen event id. Returns a `close()` that tears down the current connection and
 * cancels any pending retry; after `close()` no further reconnect is scheduled.
 *
 * @param url the SSE endpoint URL
 * @param factory creates a (real or fake) `EventSource` for a URL
 * @param onMessage receives every delivered message (data + its event id)
 * @param options backoff/jitter/clock tuning
 * @returns a `close()` that stops consuming and reconnecting
 */
export function openReconnectingSource(
  url: string,
  factory: EventSourceFactory,
  onMessage: (message: ReconnectMessage) => void,
  options: ReconnectOptions = {},
): () => void {
  const baseDelayMs = options.baseDelayMs ?? 1000;
  const maxDelayMs = options.maxDelayMs ?? 30000;
  const jitter = options.jitter ?? 1;
  const lastEventIdParam = options.lastEventIdParam ?? "lastEventId";
  const setTimeoutImpl =
    options.setTimeoutImpl ?? ((handler, timeoutMs) => setTimeout(handler, timeoutMs));
  const clearTimeoutImpl =
    options.clearTimeoutImpl ?? ((handle) => clearTimeout(handle as ReturnType<typeof setTimeout>));
  const randomImpl = options.randomImpl ?? Math.random;

  let current: EventSourceLike | undefined;
  let retryHandle: unknown;
  let attempt = 0;
  let lastEventId = "";
  let closed = false;

  const connect = (): void => {
    if (closed) {
      return;
    }
    const target = withLastEventId(url, lastEventId, lastEventIdParam);
    const es = factory(target);
    current = es;
    es.addEventListener("message", (event: MessageEvent) => {
      // A delivered message means the connection is healthy: reset the backoff so the NEXT drop
      // recovers fast. Track the event id (when the server set one) for the next resume.
      attempt = 0;
      if (typeof event.lastEventId === "string" && event.lastEventId.length > 0) {
        lastEventId = event.lastEventId;
      }
      onMessage({ data: event.data as string, lastEventId });
    });
    es.addEventListener("error", () => {
      // The native EventSource would reconnect on its own here; we take over so the backoff is ours.
      // Close it (suppresses its uncontrolled reconnect) and schedule a managed, jittered re-open.
      if (closed) {
        return;
      }
      es.close();
      if (current === es) {
        current = undefined;
      }
      attempt += 1;
      const delay = backoffDelay(attempt, { baseDelayMs, maxDelayMs, jitter, randomImpl });
      retryHandle = setTimeoutImpl(connect, delay);
    });
  };

  connect();

  return () => {
    if (closed) {
      return;
    }
    closed = true;
    if (retryHandle !== undefined) {
      clearTimeoutImpl(retryHandle);
      retryHandle = undefined;
    }
    current?.close();
    current = undefined;
  };
}
