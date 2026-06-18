/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * Wire-value encoding for large payloads (issue #135): the request serializer must handle large
 * binary arguments (300KB+) without a `"Maximum call stack size exceeded"` error. The classic bug is
 * `String.fromCharCode(...bytes)` (or `btoa(String.fromCharCode(...bytes))`): spreading a large typed
 * array into a function call overflows the argument-count / call-stack limit. This module encodes in
 * fixed-size chunks instead, so an arbitrarily large array is bounded by the chunk size, not the
 * stack.
 *
 * A `Uint8Array` / `ArrayBuffer` argument is also lossy under a plain `JSON.stringify` (it becomes
 * `{"0":1,...}`, an object, not the bytes). {@link toWireValue} normalizes such an argument to a
 * tagged base64 envelope (`{ __lievit_b64: "<base64>" }`) the server decodes back to a byte array,
 * so a large binary argument round-trips intact. Plain JSON values pass through untouched.
 *
 * Strict-CSP-safe: no eval, only `btoa` + chunked `String.fromCharCode` over small slices.
 */

/** The chunk size (bytes) for the base64 encoder: small enough that the spread never overflows. */
const CHUNK = 0x8000; // 32 KiB

/** The envelope key that tags a base64-encoded byte array on the wire (decoded server-side). */
export const BASE64_TAG = "__lievit_b64";

/**
 * Base64-encodes a byte array in fixed-size chunks (issue #135): never spreads the whole array into
 * `String.fromCharCode`, so a 300KB+ array encodes without a call-stack overflow.
 *
 * @param bytes the byte array to encode
 * @returns the standard base64 string
 */
export function encodeBytesBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += CHUNK) {
    const slice = bytes.subarray(i, i + CHUNK);
    // fromCharCode.apply over a bounded slice: the spread is at most CHUNK args, never the whole array.
    binary += String.fromCharCode.apply(null, slice as unknown as number[]);
  }
  return btoa(binary);
}

/**
 * Normalizes a single wire value for JSON serialization (issue #135): a `Uint8Array` / `ArrayBuffer`
 * becomes a tagged base64 envelope (encoded chunked, never via a giant spread); every other value is
 * returned as-is for a plain `JSON.stringify`. Recurses into arrays and plain objects so a byte array
 * nested inside an argument is also encoded.
 *
 * @param value the wire value (an `_updates` entry or a `_calls` argument)
 * @returns the JSON-safe value (tagged base64 for binary, the value itself otherwise)
 */
export function toWireValue(value: unknown): unknown {
  if (value instanceof Uint8Array) {
    return { [BASE64_TAG]: encodeBytesBase64(value) };
  }
  if (value instanceof ArrayBuffer) {
    return { [BASE64_TAG]: encodeBytesBase64(new Uint8Array(value)) };
  }
  if (Array.isArray(value)) {
    return value.map(toWireValue);
  }
  if (value != null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = toWireValue(v);
    }
    return out;
  }
  return value;
}
