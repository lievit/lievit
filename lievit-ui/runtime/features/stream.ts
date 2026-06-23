/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * Streaming (issue #153): `stream(content, replace, name)` on the server pushes content chunks to
 * the browser mid-request over a Server-Sent-Events response, into an `l:stream="name"` target. Each
 * chunk is a JSON envelope `{ target, content, replace }`; `replace:true` swaps the target's content,
 * the default appends. Falsy content (`""`, `0`, `false`) streams correctly (only `null`/`undefined`
 * envelopes are skipped). Relevant for the gestionale's AI integration: progressive output without a
 * full re-render.
 *
 * This module is the client consumer: given an SSE-style chunk source, it parses envelopes and writes
 * them into the matching `l:stream` element under a root. The transport (opening the EventSource) is
 * the caller's concern so the parser stays testable; {@link openStream} wires a real `EventSource`.
 *
 * Server-side: an SSE response that writes a flushed JSON envelope per `stream()` call. Kept as an
 * additive endpoint so it does not touch the unary wire dispatcher (ADR-0019; no dispatcher rewrite).
 */

import { openReconnectingSource, type ReconnectOptions } from "./reconnecting-source.js";

/** One streamed chunk: which target to write, the content, and whether to replace or append. */
export interface StreamEnvelope {
  /** The `l:stream` target name. */
  readonly target: string;
  /** The content to write (a string; falsy strings are valid and streamed). */
  readonly content: string;
  /** True to replace the target's text, false/absent to append (the default). */
  readonly replace?: boolean;
}

/** Parses a raw SSE `data:` payload into an envelope, or null when it is not a valid envelope. */
export function parseStreamEnvelope(raw: string): StreamEnvelope | null {
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
  if (typeof obj.target !== "string" || typeof obj.content !== "string") {
    return null;
  }
  return { target: obj.target, content: obj.content, replace: obj.replace === true };
}

/**
 * Writes one envelope into its `l:stream` target under `root`. Appends by default, replaces when the
 * envelope asks. A missing target is a no-op (the stream outran a morph that removed it).
 *
 * @param root the component root (or document) to find the `l:stream` target under
 * @param envelope the chunk to write
 */
export function applyStreamEnvelope(root: ParentNode, envelope: StreamEnvelope): void {
  const target = root.querySelector(`[l\\:stream="${cssEscape(envelope.target)}"]`);
  if (target == null) {
    return;
  }
  if (envelope.replace === true) {
    target.textContent = envelope.content;
  } else {
    target.textContent = (target.textContent ?? "") + envelope.content;
  }
}

/** Minimal CSS attribute-value escape (CSP-safe, no eval); good enough for stream names. */
function cssEscape(value: string): string {
  return value.replace(/["\\]/g, "\\$&");
}

/** An SSE source abstraction so tests feed chunks without a real network EventSource. */
export interface StreamSource {
  /** Register a per-message handler; returns an unsubscribe that closes the source. */
  readonly onMessage: (handler: (data: string) => void) => () => void;
}

/**
 * Consumes a stream source, writing every parsed envelope into its target under `root`.
 *
 * @param root the component root the stream writes into
 * @param source the SSE source (real or fake)
 * @returns an unsubscribe that stops consuming and closes the source
 */
export function consumeStream(root: ParentNode, source: StreamSource): () => void {
  return source.onMessage((data) => {
    const envelope = parseStreamEnvelope(data);
    if (envelope != null) {
      applyStreamEnvelope(root, envelope);
    }
  });
}

/**
 * Opens a real SSE `EventSource` at `url` and consumes it into `root` (the browser entry point),
 * self-healing across connection drops (ADR-0086): capped jittered exponential backoff on reconnect,
 * resuming from the last seen event id (`Last-Event-ID` gap-recovery; the server must emit `id:` per
 * event for replay). For an AI token stream, this means a dropped connection resumes from the last
 * delivered token instead of either stalling or re-streaming the whole answer.
 *
 * @param root the component root the stream writes into
 * @param url the SSE endpoint URL
 * @param reconnect optional backoff/jitter tuning (defaults are htmx-sse-like)
 * @returns an unsubscribe that closes the EventSource and cancels any pending reconnect
 */
export function openStream(root: ParentNode, url: string, reconnect: ReconnectOptions = {}): () => void {
  const source: StreamSource = {
    onMessage: (handler) =>
      openReconnectingSource(
        url,
        (target) => new EventSource(target, { withCredentials: true }),
        (message) => handler(message.data),
        reconnect,
      ),
  };
  return consumeStream(root, source);
}

/** Options for {@link openStreamCall}: the snapshot to POST, the CSRF token/header, an injectable fetch. */
export interface StreamCallOptions {
  /** The signed snapshot to carry into the streaming call (the `_snapshot`). */
  readonly snapshot: string;
  /** The action names to invoke (the `_calls`; the streaming action). */
  readonly calls: readonly string[];
  /** The CSRF token value, sent as a header. */
  readonly csrfToken?: string;
  /** The CSRF header name (defaults to `X-CSRF-TOKEN`). */
  readonly csrfHeader?: string;
  /** Injectable fetch (defaults to the global `fetch`); used in tests. */
  readonly fetchImpl?: typeof fetch;
}

/**
 * Parses a raw SSE text buffer into complete `data:` payloads, returning the payloads plus the
 * unconsumed tail (a partial frame at the buffer's end). Frames are separated by a blank line; each
 * frame's `data:` lines are joined. This is the wire-format reader the POST stream uses, exposed so
 * tests can drive it without a real connection.
 *
 * @param buffer the accumulated SSE text
 * @returns the complete `data:` payloads and the leftover tail to keep buffering
 */
export function parseSseFrames(buffer: string): { payloads: string[]; rest: string } {
  const payloads: string[] = [];
  let rest = buffer;
  let sep = rest.indexOf("\n\n");
  while (sep >= 0) {
    const frame = rest.slice(0, sep);
    rest = rest.slice(sep + 2);
    const data = frame
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).replace(/^ /, ""))
      .join("\n");
    if (data.length > 0) {
      payloads.push(data);
    }
    sep = rest.indexOf("\n\n");
  }
  return { payloads, rest };
}

/**
 * Opens a streaming wire call: POSTs the snapshot + action to `POST /lievit/{id}/stream` and consumes
 * the SSE `text/event-stream` response body, writing each envelope into its `l:stream` target under
 * `root` (issue #153). Unlike {@link openStream} (an `EventSource`, GET-only), this carries the signed
 * snapshot in a POST body, so it matches the server's wire-guarded streaming endpoint and stamps the
 * `X-Lievit` header. Returns a promise that resolves when the stream completes.
 *
 * @param root the component root the stream writes into
 * @param componentId the component instance id (the `{id}` path segment)
 * @param options the snapshot + calls + CSRF + injectable fetch
 * @returns a promise resolving when the server closes the stream
 */
export async function openStreamCall(
  root: ParentNode,
  componentId: string,
  options: StreamCallOptions,
): Promise<void> {
  const doFetch = options.fetchImpl ?? fetch;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "text/event-stream",
    "X-Lievit": "1",
  };
  if (options.csrfToken != null) {
    headers[options.csrfHeader ?? "X-CSRF-TOKEN"] = options.csrfToken;
  }
  const response = await doFetch(`/lievit/${encodeURIComponent(componentId)}/stream`, {
    method: "POST",
    headers,
    body: JSON.stringify({ _snapshot: options.snapshot, _calls: options.calls }),
    credentials: "same-origin",
  });
  if (!response.ok || response.body == null) {
    return;
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    buffer += decoder.decode(value, { stream: true });
    const { payloads, rest } = parseSseFrames(buffer);
    buffer = rest;
    for (const payload of payloads) {
      const envelope = parseStreamEnvelope(payload);
      if (envelope != null) {
        applyStreamEnvelope(root, envelope);
      }
    }
  }
}
