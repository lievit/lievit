/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
import { describe, expect, it } from "vitest";

import { BASE64_TAG, encodeBytesBase64, toWireValue } from "../runtime/encode.js";

describe("large-payload encoding (#135)", () => {
  it("encodes a 300KB byte array to base64 without a call-stack overflow", () => {
    const bytes = new Uint8Array(300 * 1024);
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = i % 256;
    }

    // The classic bug is String.fromCharCode(...bytes): a 300KB spread throws
    // "Maximum call stack size exceeded". The chunked encoder must not.
    let base64 = "";
    expect(() => {
      base64 = encodeBytesBase64(bytes);
    }).not.toThrow();

    // Round-trips byte-for-byte through atob.
    const binary = atob(base64);
    const decoded = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    expect(decoded.length).toBe(bytes.length);
    expect(decoded[0]).toBe(0);
    expect(decoded[255]).toBe(255);
    expect(decoded[bytes.length - 1]).toBe(bytes[bytes.length - 1]);
  });

  it("toWireValue tags a Uint8Array as a base64 envelope, JSON-stringifiable", () => {
    const value = toWireValue(new Uint8Array([1, 2, 3])) as Record<string, string>;
    expect(value[BASE64_TAG]).toBe(btoa("\x01\x02\x03"));
    // The whole point: it survives JSON.stringify (a raw Uint8Array becomes a lossy {"0":..} object).
    expect(() => JSON.stringify(value)).not.toThrow();
  });

  it("toWireValue encodes an ArrayBuffer the same way", () => {
    const buf = new Uint8Array([9, 8, 7]).buffer;
    const value = toWireValue(buf) as Record<string, string>;
    expect(value[BASE64_TAG]).toBe(btoa("\x09\x08\x07"));
  });

  it("toWireValue passes plain JSON values through untouched and recurses into objects", () => {
    expect(toWireValue(5)).toBe(5);
    expect(toWireValue("ada")).toBe("ada");
    expect(toWireValue(null)).toBeNull();
    expect(toWireValue([1, "two", true])).toEqual([1, "two", true]);
    const nested = toWireValue({ name: "ada", blob: new Uint8Array([1]) }) as Record<string, unknown>;
    expect(nested.name).toBe("ada");
    expect((nested.blob as Record<string, string>)[BASE64_TAG]).toBe(btoa("\x01"));
  });
});
