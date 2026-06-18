/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * `l:transition` (issue #113): animate DOM segments across an update. An element carrying
 * `l:transition` that the new markup DROPS is animated OUT before removal (via the morph
 * `beforeRemove` seam, ADR-0019); an element the markup ADDS animates IN on its next frame.
 * Modifiers: `.fade` (opacity), `.duration.Nms` (default 150ms). Uses the View Transitions API when
 * available for the whole-component morph and falls back to per-element opacity keyframes (the fade
 * fallback issue #113 names).
 *
 * Pure client feature: a morph-hook provider for the leave animation + an `afterCall` that animates
 * freshly added `l:transition` elements in. Server-side transition-type/skip (the effect channel)
 * is left to the sibling server work; this client reads an optional `l:transition` attribute only.
 */

import type { LievitRuntime } from "../runtime.js";

const DEFAULT_DURATION_MS = 150;

/** Reads the `l:transition` duration (ms) from an element's modifiers. */
function durationOf(el: Element): number {
  for (const attr of Array.from(el.attributes)) {
    if (attr.name === "l:transition" || attr.name.startsWith("l:transition.")) {
      const mods = attr.name.split(".");
      const i = mods.indexOf("duration");
      if (i >= 0 && mods[i + 1] != null) {
        const ms = Number.parseInt(mods[i + 1].replace(/ms$/, ""), 10);
        if (Number.isFinite(ms)) {
          return ms;
        }
      }
      return DEFAULT_DURATION_MS;
    }
  }
  return DEFAULT_DURATION_MS;
}

function hasTransition(el: Element): boolean {
  for (const attr of Array.from(el.attributes)) {
    if (attr.name === "l:transition" || attr.name.startsWith("l:transition.")) {
      return true;
    }
  }
  return false;
}

/** Animates an element's opacity from `from` to `to`, then runs `done`. CSP-safe (Web Animations). */
function fade(el: HTMLElement, from: number, to: number, ms: number, done?: () => void): void {
  if (typeof el.animate !== "function") {
    // happy-dom / no WAAPI: skip straight to the end state.
    el.style.opacity = String(to);
    done?.();
    return;
  }
  const animation = el.animate([{ opacity: from }, { opacity: to }], { duration: ms, easing: "ease" });
  animation.addEventListener("finish", () => {
    el.style.opacity = String(to);
    done?.();
  });
}

/**
 * Installs `l:transition` on a runtime.
 *
 * @param runtime the started runtime to extend
 * @returns an unsubscribe function that removes the morph provider + hook
 */
export function installTransition(runtime: LievitRuntime): () => void {
  // Elements already animating out (so a re-scan does not re-claim them).
  const leaving = new WeakSet<Node>();

  // The server transition effect (#113, @LievitTransition) the runtime recorded for this update:
  // skip suppresses the transition; a duration overrides the per-element default. Read across the
  // morph from the runtime (a DOM stamp would be reconciled away by the morph).
  const serverSkip = (root: Element): boolean => runtime.transitionFor(root)?.skip === true;
  const serverDuration = (root: Element): number | null =>
    runtime.transitionFor(root)?.duration ?? null;

  const offMorph = runtime.morphWith((root) => {
    if (serverSkip(root)) {
      return null; // server opted this update out of transitions.
    }
    const override = serverDuration(root);
    return {
      beforeRemove: (node) => {
        if (node.nodeType !== Node.ELEMENT_NODE) {
          return false;
        }
        const el = node as Element;
        if (!hasTransition(el) || leaving.has(el)) {
          return false;
        }
        leaving.add(el);
        const htmlEl = el as HTMLElement;
        fade(htmlEl, 1, 0, override ?? durationOf(el), () => htmlEl.remove());
        return true; // claimed: the morph leaves the node in place; we remove it after the fade.
      },
    };
  });

  const offHook = runtime.use({
    afterCall: (ctx) => {
      if (serverSkip(ctx.root)) {
        // Mark fresh elements entered without animating, so the skip holds for this update.
        for (const el of Array.from(ctx.root.querySelectorAll("*"))) {
          if (hasTransition(el)) {
            el.setAttribute("data-l-entered", "");
          }
        }
        return;
      }
      const override = serverDuration(ctx.root);
      // Animate IN any l:transition element that has no recorded opacity (freshly inserted).
      for (const el of Array.from(ctx.root.querySelectorAll("*"))) {
        if (hasTransition(el) && !el.hasAttribute("data-l-entered")) {
          el.setAttribute("data-l-entered", "");
          fade(el as HTMLElement, 0, 1, override ?? durationOf(el));
        }
      }
    },
  });

  return () => {
    offMorph();
    offHook();
  };
}
