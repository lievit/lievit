/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
import { describe, expect, it } from "vitest";

import { ConcurrencyRegistry, scopeKey } from "../runtime/concurrency.js";

describe("per-scope request concurrency (#95, ADR-0051)", () => {
  it("derives a stable scope key from component id + island", () => {
    expect(scopeKey("c1", null)).toBe("c1::");
    expect(scopeKey("c1", "sidebar")).toBe("c1::sidebar");
    // component scope and island scope of the same component are distinct keys.
    expect(scopeKey("c1", null)).not.toBe(scopeKey("c1", "sidebar"));
  });

  it("a user action over an idle scope proceeds and is tracked as in-flight", () => {
    const reg = new ConcurrencyRegistry();
    const d = reg.begin("c1", null, "user");
    expect(d.proceed).toBe(true);
    expect(d.signal).toBeInstanceOf(AbortSignal);
    expect(d.signal.aborted).toBe(false);
  });

  it("a user action does NOT cancel an in-flight user action (it queues): no abort", () => {
    const reg = new ConcurrencyRegistry();
    const first = reg.begin("c1", null, "user");
    const second = reg.begin("c1", null, "user");
    expect(second.proceed).toBe(true);
    // the earlier user call's signal is untouched: the queue (inFlight chain) orders them.
    expect(first.signal.aborted).toBe(false);
  });

  it("a user action DOES cancel an in-flight poll for the same scope", () => {
    const reg = new ConcurrencyRegistry();
    const poll = reg.begin("c1", null, "poll");
    const user = reg.begin("c1", null, "user");
    expect(user.proceed).toBe(true);
    expect(poll.signal.aborted).toBe(true);
  });

  it("a poll never cancels an in-flight user action; the poll is dropped", () => {
    const reg = new ConcurrencyRegistry();
    const user = reg.begin("c1", null, "user");
    const poll = reg.begin("c1", null, "poll");
    expect(poll.proceed).toBe(false);
    expect(user.signal.aborted).toBe(false);
  });

  it("a later poll cancels an earlier in-flight poll for the same scope", () => {
    const reg = new ConcurrencyRegistry();
    const older = reg.begin("c1", null, "poll");
    const newer = reg.begin("c1", null, "poll");
    expect(newer.proceed).toBe(true);
    expect(older.signal.aborted).toBe(true);
  });

  it("different scopes (component vs island, island vs island) never cancel each other", () => {
    const reg = new ConcurrencyRegistry();
    const comp = reg.begin("c1", null, "poll");
    const islandA = reg.begin("c1", "a", "user");
    const islandB = reg.begin("c1", "b", "poll");
    const otherComp = reg.begin("c2", null, "user");
    expect(comp.signal.aborted).toBe(false);
    expect(islandA.signal.aborted).toBe(false);
    expect(islandB.signal.aborted).toBe(false);
    expect(otherComp.signal.aborted).toBe(false);
  });

  it("ending the in-flight call clears the scope so the next call sees an idle scope", () => {
    const reg = new ConcurrencyRegistry();
    const poll = reg.begin("c1", null, "poll");
    reg.end("c1", null, poll.token);
    // a poll over a now-idle scope proceeds (no in-flight user to defer to).
    const next = reg.begin("c1", null, "poll");
    expect(next.proceed).toBe(true);
  });

  it("end() is a no-op when a newer call already replaced the in-flight token (no clobber)", () => {
    const reg = new ConcurrencyRegistry();
    const older = reg.begin("c1", null, "poll");
    const newer = reg.begin("c1", null, "poll"); // replaces older, aborts it
    // the older call finishing (its abort settled) must not clear the newer call's slot.
    reg.end("c1", null, older.token);
    // a user action should still see the newer poll in-flight and cancel it.
    const user = reg.begin("c1", null, "user");
    expect(user.proceed).toBe(true);
    expect(newer.signal.aborted).toBe(true);
  });
});
