/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * `l:poll` (issue #151): periodically refresh a component (live dashboards/queues without manual
 * timers). Modifiers set the interval: `l:poll.2s`, `l:poll.500ms`, or a named preset
 * (`l:poll.keep-alive` etc.); the default is 2s (Livewire parity). An optional value names an action
 * to call instead of a bare `$refresh` (`l:poll="refreshQueue"`).
 *
 * Behavior (Livewire v4 parity, simplified to one page-level scheduler):
 * - Poll ticks call through the runtime with `meta.poll = true`, so loading features skip them and
 *   they never stamp `data-loading`.
 * - A single page-level scheduler coalesces ticks: components sharing an interval fire on the same
 *   timer (the cross-component batching intent; each still issues its own snapshot call — lievit has
 *   no multi-component batch endpoint in v0.1, so "batched" means "one shared timer", not one
 *   request).
 * - Polling halts for a component after a `409`/`410` (snapshot expired / class gone): once the
 *   component re-mounts, a fresh scan re-arms it.
 *
 * Implemented as a directive (schedules) + an `onError` hook (halts on expiry); the core is
 * untouched (ADR-0019). Server-side: a poll is an ordinary refresh, no new marker.
 */

import type { LievitRuntime } from "../runtime.js";

const NAME = "poll";
/** Marks an element already armed, so a re-scan after a morph does not double-schedule. */
const ARMED_ATTR = "data-lievit-rt-poll-armed";
const DEFAULT_INTERVAL_MS = 2000;
/** Named interval presets (ms). */
const PRESETS: Record<string, number> = { "keep-alive": 5000, visible: 2000 };

/** Parses the interval from the `l:poll` modifiers (`.2s` / `.500ms` / a preset), default 2s. */
export function pollIntervalMs(modifiers: string[]): number {
  for (const m of modifiers) {
    if (m in PRESETS) {
      return PRESETS[m];
    }
    const sec = /^(\d+)s$/.exec(m);
    if (sec) {
      return Number(sec[1]) * 1000;
    }
    const ms = /^(\d+)ms$/.exec(m);
    if (ms) {
      return Number(ms[1]);
    }
  }
  return DEFAULT_INTERVAL_MS;
}

/** A scheduler abstraction so tests drive ticks deterministically without real timers. */
export interface PollScheduler {
  readonly every: (ms: number, tick: () => void) => () => void;
}

const REAL_SCHEDULER: PollScheduler = {
  every: (ms, tick) => {
    const id = setInterval(tick, ms);
    return () => clearInterval(id);
  },
};

/**
 * Installs `l:poll` on a runtime.
 *
 * @param runtime the started runtime to extend
 * @param scheduler the interval scheduler (defaults to `setInterval`; injectable for tests)
 * @returns an unsubscribe that cancels every timer and removes the hook
 */
export function installPoll(runtime: LievitRuntime, scheduler: PollScheduler = REAL_SCHEDULER): () => void {
  // One shared timer per interval (the cross-component batching: same interval ⇒ same tick).
  const timers = new Map<number, { cancel: () => void; entries: Set<{ el: Element; action: string | null }> }>();
  // Halted component roots (a 409/410 stops their polling until re-mount re-arms them).
  const halted = new WeakSet<Element>();

  function arm(el: Element, action: string | null, intervalMs: number): void {
    let bucket = timers.get(intervalMs);
    if (bucket == null) {
      const entries = new Set<{ el: Element; action: string | null }>();
      const cancel = scheduler.every(intervalMs, () => {
        for (const entry of entries) {
          const root = entry.el.closest("[data-lievit-component]");
          if (root != null && halted.has(root)) {
            continue;
          }
          if (entry.action != null) {
            void runtime.callAction(entry.el, entry.action, { poll: true });
          } else {
            void runtime.refresh(entry.el, { poll: true });
          }
        }
      });
      bucket = { cancel, entries };
      timers.set(intervalMs, bucket);
    }
    bucket.entries.add({ el, action });
  }

  runtime.directives.register({
    name: NAME,
    bind(element, attribute, value, _rt) {
      if (element.hasAttribute(ARMED_ATTR)) {
        return;
      }
      element.setAttribute(ARMED_ATTR, "");
      const modifiers = attribute.slice(`l:${NAME}`.length).split(".").filter((m) => m.length > 0);
      arm(element, value.length > 0 ? value : null, pollIntervalMs(modifiers));
    },
  });

  const off = runtime.use({
    onError: (ctx) => {
      if (ctx.status === 409 || ctx.status === 410) {
        halted.add(ctx.root);
      }
    },
  });

  return () => {
    for (const bucket of timers.values()) {
      bucket.cancel();
    }
    timers.clear();
    off();
  };
}
