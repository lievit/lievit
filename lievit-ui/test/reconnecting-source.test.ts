/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
import { describe, expect, it, vi } from "vitest";

import {
  backoffDelay,
  openReconnectingSource,
  withLastEventId,
  type EventSourceLike,
} from "../runtime/features/reconnecting-source.js";

/**
 * A fake `EventSource` the test drives by hand: it records its URL, lets the test fire `message`/`error`
 * to the registered listeners, and tracks `close()`. No real network, so the reconnect schedule is
 * fully deterministic under a fake clock.
 */
function fakeEventSource(): {
  factory: (url: string) => EventSourceLike;
  /** Every URL the factory was asked to open, in order (the resume param shows up here). */
  urls: string[];
  /** Fire a `message` on the most recently opened source. */
  message: (data: string, lastEventId?: string) => void;
  /** Fire an `error` on the most recently opened source. */
  error: () => void;
  /** How many sources are currently open (created minus closed). */
  openCount: () => number;
  /** Total sources created across all (re)connects. */
  created: () => number;
} {
  interface Live {
    listeners: Map<string, (event: MessageEvent) => void>;
    closed: boolean;
  }
  const lives: Live[] = [];
  const urls: string[] = [];
  const factory = (url: string): EventSourceLike => {
    urls.push(url);
    const live: Live = { listeners: new Map(), closed: false };
    lives.push(live);
    return {
      addEventListener: (type, listener) => live.listeners.set(type, listener),
      close: () => {
        live.closed = true;
      },
    };
  };
  const latest = (): Live => lives[lives.length - 1]!;
  return {
    factory,
    urls,
    message: (data, lastEventId = "") =>
      latest().listeners.get("message")?.({ data, lastEventId } as MessageEvent),
    error: () => latest().listeners.get("error")?.({} as MessageEvent),
    openCount: () => lives.filter((l) => !l.closed).length,
    created: () => lives.length,
  };
}

/** A fake clock: captures scheduled callbacks + delays so the test fires them deterministically. */
function fakeClock(): {
  setTimeoutImpl: (handler: () => void, ms: number) => unknown;
  clearTimeoutImpl: (handle: unknown) => void;
  /** The delays passed to setTimeout, in order. */
  delays: number[];
  /** Run the single pending timer (the reconnect). */
  tick: () => void;
  /** How many timers are pending (not yet run, not cleared). */
  pending: () => number;
} {
  const timers = new Map<number, () => void>();
  let nextId = 1;
  const delays: number[] = [];
  return {
    setTimeoutImpl: (handler, ms) => {
      delays.push(ms);
      const id = nextId++;
      timers.set(id, handler);
      return id;
    },
    clearTimeoutImpl: (handle) => {
      timers.delete(handle as number);
    },
    delays,
    tick: () => {
      const [id, handler] = [...timers.entries()][0] ?? [];
      if (id !== undefined && handler) {
        timers.delete(id);
        handler();
      }
    },
    pending: () => timers.size,
  };
}

describe("backoffDelay (capped exponential with full jitter)", () => {
  it("grows geometrically from the base across attempts (jitter off)", () => {
    const o = { baseDelayMs: 1000, maxDelayMs: 30000, jitter: 0, randomImpl: () => 0 };
    expect(backoffDelay(1, o)).toBe(1000); // base * 2^0
    expect(backoffDelay(2, o)).toBe(2000); // base * 2^1
    expect(backoffDelay(3, o)).toBe(4000); // base * 2^2
    expect(backoffDelay(4, o)).toBe(8000); // base * 2^3
  });

  it("caps the delay at maxDelayMs no matter how high the attempt (the cap)", () => {
    const o = { baseDelayMs: 1000, maxDelayMs: 30000, jitter: 0, randomImpl: () => 0 };
    expect(backoffDelay(6, o)).toBe(30000); // 1000*2^5 = 32000 > cap
    expect(backoffDelay(20, o)).toBe(30000); // still capped, no overflow
  });

  it("applies full jitter: the delay is a uniform draw in [target*(1-jitter), target]", () => {
    const target = 4000; // attempt 3 at base 1000
    // random()=0 → no subtraction → exactly target; random()→1 → target*(1-jitter).
    expect(backoffDelay(3, { baseDelayMs: 1000, maxDelayMs: 30000, jitter: 1, randomImpl: () => 0 })).toBe(
      target,
    );
    expect(
      backoffDelay(3, { baseDelayMs: 1000, maxDelayMs: 30000, jitter: 1, randomImpl: () => 0.5 }),
    ).toBe(target - 0.5 * target);
    // jitter 0.2 only removes up to 20% of target.
    expect(
      backoffDelay(3, { baseDelayMs: 1000, maxDelayMs: 30000, jitter: 0.2, randomImpl: () => 1 }),
    ).toBeCloseTo(target - 0.2 * target);
  });
});

describe("withLastEventId (Last-Event-ID gap-recovery via query param)", () => {
  it("appends the last event id as a query param so a re-open resumes after it", () => {
    expect(withLastEventId("/lievit/broadcast", "42", "lastEventId")).toBe(
      "/lievit/broadcast?lastEventId=42",
    );
  });

  it("is a no-op when no event has been delivered yet (blank id)", () => {
    expect(withLastEventId("/lievit/broadcast", "", "lastEventId")).toBe("/lievit/broadcast");
  });

  it("keeps a relative URL relative and uses the configured param name", () => {
    const out = withLastEventId("/lievit/stream?x=1", "abc", "leid");
    expect(out).toBe("/lievit/stream?x=1&leid=abc");
    expect(out.startsWith("/")).toBe(true);
  });
});

describe("openReconnectingSource (backoff + reset-on-message + resume)", () => {
  const tune = { baseDelayMs: 1000, maxDelayMs: 30000, jitter: 0, randomImpl: () => 0 };

  it("delivers messages and tracks the last event id for the next resume", () => {
    const es = fakeEventSource();
    const clock = fakeClock();
    const onMessage = vi.fn();
    openReconnectingSource("/lievit/broadcast", es.factory, onMessage, {
      ...tune,
      setTimeoutImpl: clock.setTimeoutImpl,
      clearTimeoutImpl: clock.clearTimeoutImpl,
    });

    es.message('{"name":"saved"}', "7");
    expect(onMessage).toHaveBeenCalledWith({ data: '{"name":"saved"}', lastEventId: "7" });

    // After a drop the re-open carries Last-Event-ID=7 as the resume param (the server replays the gap).
    es.error();
    clock.tick();
    expect(es.urls).toEqual(["/lievit/broadcast", "/lievit/broadcast?lastEventId=7"]);
  });

  it("backs off geometrically across successive drops without a message between them", () => {
    const es = fakeEventSource();
    const clock = fakeClock();
    openReconnectingSource("/sse", es.factory, vi.fn(), {
      ...tune,
      setTimeoutImpl: clock.setTimeoutImpl,
      clearTimeoutImpl: clock.clearTimeoutImpl,
    });

    es.error(); // attempt 1 → 1000
    clock.tick();
    es.error(); // attempt 2 → 2000
    clock.tick();
    es.error(); // attempt 3 → 4000
    expect(clock.delays).toEqual([1000, 2000, 4000]);
  });

  it("resets the backoff after a successful message (a healthy beat clears the streak)", () => {
    const es = fakeEventSource();
    const clock = fakeClock();
    openReconnectingSource("/sse", es.factory, vi.fn(), {
      ...tune,
      setTimeoutImpl: clock.setTimeoutImpl,
      clearTimeoutImpl: clock.clearTimeoutImpl,
    });

    es.error(); // attempt 1 → 1000
    clock.tick();
    es.error(); // attempt 2 → 2000
    clock.tick();
    es.message("ok"); // healthy beat → reset
    es.error(); // attempt back to 1 → 1000
    expect(clock.delays).toEqual([1000, 2000, 1000]);
  });

  it("closes the current source on a drop and opens exactly one replacement (no socket leak)", () => {
    const es = fakeEventSource();
    const clock = fakeClock();
    openReconnectingSource("/sse", es.factory, vi.fn(), {
      ...tune,
      setTimeoutImpl: clock.setTimeoutImpl,
      clearTimeoutImpl: clock.clearTimeoutImpl,
    });

    expect(es.openCount()).toBe(1);
    es.error(); // closes the dropped source immediately, schedules a re-open
    expect(es.openCount()).toBe(0);
    clock.tick();
    expect(es.openCount()).toBe(1);
    expect(es.created()).toBe(2);
  });

  it("close() cancels a pending reconnect and opens nothing further", () => {
    const es = fakeEventSource();
    const clock = fakeClock();
    const stop = openReconnectingSource("/sse", es.factory, vi.fn(), {
      ...tune,
      setTimeoutImpl: clock.setTimeoutImpl,
      clearTimeoutImpl: clock.clearTimeoutImpl,
    });

    es.error(); // schedules a reconnect
    expect(clock.pending()).toBe(1);
    stop(); // must cancel it
    expect(clock.pending()).toBe(0);
    clock.tick(); // even if a stray timer fired, no new source opens
    expect(es.created()).toBe(1);
  });
});
