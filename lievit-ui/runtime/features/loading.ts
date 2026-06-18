/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * Loading states (issue #145): `l:loading` elements are shown while a wire call for their component
 * is in flight and hidden when it settles. Scoping + variants (Livewire parity):
 *
 * - `l:target="a,b"` — only react when the in-flight call's actions/updates intersect the target
 *   list (action names and `@Wire` field names); absent ⇒ react to any call for the component.
 * - `l:target.except="x"` — react to any call EXCEPT one scoped to `x`.
 * - `l:loading` (default) — toggle visibility via inline `display` (`.remove` inverts: hide while
 *   loading).
 * - `l:loading.class="cls"` — add the class(es) while loading (`.remove` removes them instead).
 * - `l:loading.attr="disabled"` — set the boolean attribute while loading.
 * - `l:loading.delay[.short|.long|.Nms]` — wait before showing (debounces flicker on fast calls);
 *   a settle before the delay elapses shows nothing.
 *
 * Per-element `data-loading="true"` is stamped while in flight, and removed when settled — but NOT
 * for poll calls (`meta.poll`), matching Livewire. The whole feature is two lifecycle hooks
 * (`beforeCall` / `afterCall` / `onError`); the runtime core is untouched (ADR-0019).
 *
 * Server-side: none required for the v0.1 component-scoped behavior (issue #145's island-scoped
 * independence is deferred with the islands work).
 */

import type { CallContext, CallOutcome } from "../lifecycle.js";
import type { LievitRuntime } from "../runtime.js";

/** Default delay presets (ms) for `l:loading.delay.short|.long` (Livewire-compatible). */
const DELAY_PRESETS: Record<string, number> = {
  shortest: 50,
  shorter: 100,
  short: 150,
  default: 200,
  long: 300,
  longer: 500,
  longest: 1000,
};

/** Parses a `delay` modifier list into ms, or null if no delay requested. */
function delayMs(modifiers: string[]): number | null {
  if (!modifiers.includes("delay")) {
    return null;
  }
  const i = modifiers.indexOf("delay");
  const next = modifiers[i + 1];
  if (next == null) {
    return DELAY_PRESETS.default;
  }
  if (next in DELAY_PRESETS) {
    return DELAY_PRESETS[next];
  }
  const explicit = Number.parseInt(next.replace(/ms$/, ""), 10);
  return Number.isFinite(explicit) ? explicit : DELAY_PRESETS.default;
}

/** The set of scope tokens a call touches: its action names and the updated field names. */
function callScope(ctx: CallContext): Set<string> {
  return new Set<string>([...ctx.calls, ...Object.keys(ctx.updates)]);
}

/** Reads an element's `l:target` list (comma-separated), and whether it is an `.except` target. */
function targetSpec(el: Element): { names: string[]; except: boolean } | null {
  const except = el.getAttribute("l:target.except");
  if (except != null) {
    return { names: split(except), except: true };
  }
  const target = el.getAttribute("l:target");
  if (target != null) {
    return { names: split(target), except: false };
  }
  return null;
}

function split(value: string): string[] {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** Whether an `l:loading` element should react to a call with the given scope. */
function matchesTarget(el: Element, scope: Set<string>): boolean {
  const spec = targetSpec(el);
  if (spec == null) {
    return true; // untargeted: react to any call for the component.
  }
  const hit = spec.names.some((n) => scope.has(n));
  return spec.except ? !hit : hit;
}

/** The `l:loading` attribute name written on an element (any modifier), or null. */
function loadingAttrOf(el: Element): { value: string; modifiers: string[] } | null {
  for (const attr of Array.from(el.attributes)) {
    if (attr.name === "l:loading" || attr.name.startsWith("l:loading.")) {
      const modifiers = attr.name.slice("l:loading".length).split(".").filter((m) => m.length > 0);
      return { value: attr.value, modifiers };
    }
  }
  return null;
}

/** Applies (or clears) the loading visual for one element. */
function setLoading(el: HTMLElement, on: boolean, modifiers: string[], value: string): void {
  const remove = modifiers.includes("remove");
  if (modifiers.includes("class")) {
    const classes = split(value);
    const add = on !== remove; // .remove inverts
    for (const c of classes) {
      el.classList.toggle(c, add);
    }
    return;
  }
  if (modifiers.includes("attr")) {
    const name = value || "disabled";
    if (on !== remove) {
      el.setAttribute(name, "");
    } else {
      el.removeAttribute(name);
    }
    return;
  }
  // Default + `.block`: visibility via inline display. `.remove` hides while loading instead.
  const shouldShow = on !== remove;
  const display = modifiers.includes("block") ? "block" : "";
  if (shouldShow) {
    if (display) {
      el.style.setProperty("display", display);
    } else {
      el.style.removeProperty("display");
    }
  } else {
    el.style.setProperty("display", "none");
  }
}

/**
 * Installs loading states on a runtime: a `beforeCall` that turns on matching `l:loading` elements
 * (honoring `l:target`, delay, and the poll exclusion) and an `afterCall`/`onError` that turns them
 * off. Tracks in-flight elements + delay timers per call so concurrent calls do not clobber.
 *
 * @param runtime the started runtime to extend
 * @returns an unsubscribe function that removes the hooks
 */
export function installLoading(runtime: LievitRuntime): () => void {
  // Active loading elements + their pending delay timers, so afterCall can clear precisely.
  const active = new Map<Element, { el: HTMLElement; modifiers: string[]; value: string; timer?: ReturnType<typeof setTimeout> }>();

  function start(ctx: CallContext): void {
    const isPoll = ctx.meta?.poll === true;
    const scope = callScope(ctx);
    for (const el of Array.from(ctx.root.querySelectorAll("*"))) {
      const spec = loadingAttrOf(el);
      if (spec == null || !matchesTarget(el, scope)) {
        continue;
      }
      const htmlEl = el as HTMLElement;
      // data-loading stamping: never on polls (issue #145).
      if (!isPoll) {
        htmlEl.setAttribute("data-loading", "true");
      }
      const delay = delayMs(spec.modifiers);
      const entry = { el: htmlEl, modifiers: spec.modifiers, value: spec.value };
      if (delay != null) {
        const timer = setTimeout(() => setLoading(htmlEl, true, spec.modifiers, spec.value), delay);
        active.set(el, { ...entry, timer });
      } else {
        setLoading(htmlEl, true, spec.modifiers, spec.value);
        active.set(el, entry);
      }
    }
  }

  function stop(ctx: CallOutcome): void {
    for (const el of Array.from(ctx.root.querySelectorAll("*"))) {
      const entry = active.get(el);
      if (entry == null) {
        continue;
      }
      if (entry.timer != null) {
        clearTimeout(entry.timer); // settled before the delay elapsed: nothing was ever shown.
      }
      el.removeAttribute("data-loading");
      setLoading(entry.el, false, entry.modifiers, entry.value);
      active.delete(el);
    }
  }

  return runtime.use({
    beforeCall: start,
    afterCall: stop,
    onError: stop,
  });
}
