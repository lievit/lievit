/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
import { describe, expect, it } from "vitest";

import {
  deepEqual,
  mergeNewSnapshot,
  readPath,
  removeIndices,
  writePath,
  type WireState,
} from "../runtime/merge.js";

describe("surgical snapshot merge (ADR-0024 #87)", () => {
  it("preserves an in-flight client edit to a path the server did not change", () => {
    // base = the client's optimistic state at send time (it edited a, the request mutated b).
    const base: WireState = { a: "client-edit", b: 1 };
    const server: WireState = { a: "client-edit", b: 2 }; // server changed b, left a as sent
    const merged = mergeNewSnapshot(base, server, { pendingPaths: ["a"] });
    expect(merged.a).toBe("client-edit"); // the unsaved edit to a survives
    expect(merged.b).toBe(2); // the server's change to b is authoritative
  });

  it("lets a same-path server change win over a stale client edit", () => {
    const base: WireState = { a: "client-edit", b: 1 };
    const server: WireState = { a: "server-wins", b: 1 }; // server changed a from the baseline
    const merged = mergeNewSnapshot(base, server, { pendingPaths: ["a"] });
    expect(merged.a).toBe("server-wins"); // the server's intent overrides the local edit
  });

  it("reverse-indexes array removals so earlier removals do not shift later targets", () => {
    const array = ["a", "b", "c", "d", "e"];
    // Remove indices 1 and 3 → "b" and "d" go, leaving a, c, e.
    expect(removeIndices(array, [1, 3])).toEqual(["a", "c", "e"]);
    // Order of the indices must not matter (the reverse-index invariant).
    expect(removeIndices(array, [3, 1])).toEqual(["a", "c", "e"]);
  });

  it("applies a removal intent against a merged array path", () => {
    const base: WireState = { items: ["x", "y", "z"] };
    const server: WireState = { items: ["x", "y", "z"] };
    const merged = mergeNewSnapshot(base, server, { pendingPaths: [], removals: { items: [1] } });
    expect(merged.items).toEqual(["x", "z"]);
  });

  it("reads and writes nested dot-paths", () => {
    const state: WireState = { user: { name: "ada", roles: ["admin"] } };
    expect(readPath(state, "user.name")).toBe("ada");
    expect(readPath(state, "user.roles.0")).toBe("admin");
    writePath(state, "user.name", "grace");
    expect((state.user as WireState).name).toBe("grace");
  });

  it("keeps a large/sparse numeric key as a keyed object, not an N-element array", () => {
    const state: WireState = { byId: {} };
    writePath(state, "byId.1000", "x");
    const byId = state.byId as WireState;
    expect(Array.isArray(byId)).toBe(false); // not widened to a 1001-slot array
    expect(byId["1000"]).toBe("x");
  });

  it("preserves object key order (insertion order)", () => {
    const base: WireState = { z: 1, a: 2, m: 3 };
    const server: WireState = { z: 1, a: 2, m: 3 };
    const merged = mergeNewSnapshot(base, server, { pendingPaths: [] });
    expect(Object.keys(merged)).toEqual(["z", "a", "m"]);
  });

  it("deepEqual is order-insensitive for object keys and strict for arrays", () => {
    expect(deepEqual({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true);
    expect(deepEqual([1, 2], [2, 1])).toBe(false);
    expect(deepEqual({ a: [1, { x: 2 }] }, { a: [1, { x: 2 }] })).toBe(true);
  });

  it("does not mutate the server input (returns a fresh merged state)", () => {
    const server: WireState = { a: 1, items: ["x"] };
    const merged = mergeNewSnapshot({ a: 1, items: ["x"] }, server, {
      pendingPaths: [],
      removals: { items: [0] },
    });
    expect(server.items).toEqual(["x"]); // untouched
    expect(merged.items).toEqual([]);
  });
});

describe("prototype-pollution guard (security)", () => {
  // writePath sits on the wire deserialization path (pending field paths reconciled against the
  // server snapshot on every response), so a dot-keyed segment of __proto__ / constructor / prototype
  // must never reach the JS prototype chain.

  it("writePath does not pollute Object.prototype via a __proto__ path", () => {
    const state: WireState = {};
    expect(() => writePath(state, "__proto__.polluted", "yes")).not.toThrow();
    expect(({} as Record<string, unknown>).polluted).toBeUndefined(); // prototype untouched
    expect((state as Record<string, unknown>).polluted).toBeUndefined(); // not even on the target
  });

  it("writePath does not pollute via a constructor.prototype path", () => {
    const state: WireState = {};
    expect(() => writePath(state, "constructor.prototype.x", "boom")).not.toThrow();
    expect(({} as Record<string, unknown>).x).toBeUndefined();
  });

  it("writePath refuses a forbidden segment anywhere in the path, not just the head", () => {
    const state: WireState = {};
    expect(() => writePath(state, "user.__proto__.isAdmin", true)).not.toThrow();
    expect(({} as Record<string, unknown>).isAdmin).toBeUndefined();
  });

  it("readPath treats a __proto__ path as absent (never reads off the prototype chain)", () => {
    const state: WireState = { user: { name: "ada" } };
    expect(readPath(state, "__proto__")).toBeUndefined();
    expect(readPath(state, "user.__proto__.name")).toBeUndefined();
    expect(readPath(state, "constructor")).toBeUndefined();
  });

  it("mergeNewSnapshot ignores a pending __proto__ path without polluting or throwing", () => {
    const base: WireState = { a: "edit" };
    const server: WireState = { a: "edit" };
    const merged = mergeNewSnapshot(base, server, {
      pendingPaths: ["__proto__.polluted", "constructor.prototype.x", "a"],
    });
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(({} as Record<string, unknown>).x).toBeUndefined();
    expect(merged.a).toBe("edit"); // the legitimate pending path still merges
  });

  it("still merges legitimate paths normally with the guard in place", () => {
    const base: WireState = { user: { name: "client-edit" }, b: 1 };
    const server: WireState = { user: { name: "client-edit" }, b: 2 };
    const merged = mergeNewSnapshot(base, server, { pendingPaths: ["user.name"] });
    expect((merged.user as WireState).name).toBe("client-edit"); // in-flight edit preserved
    expect(merged.b).toBe(2); // server change authoritative
  });
});
