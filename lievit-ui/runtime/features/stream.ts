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
 * Opens a real SSE `EventSource` at `url` and consumes it into `root` (the browser entry point).
 *
 * @param root the component root the stream writes into
 * @param url the SSE endpoint URL
 * @returns an unsubscribe that closes the EventSource
 */
export function openStream(root: ParentNode, url: string): () => void {
  const es = new EventSource(url, { withCredentials: true });
  const source: StreamSource = {
    onMessage: (handler) => {
      const listener = (event: MessageEvent): void => handler(event.data);
      es.addEventListener("message", listener);
      return () => {
        es.removeEventListener("message", listener);
        es.close();
      };
    },
  };
  return consumeStream(root, source);
}
