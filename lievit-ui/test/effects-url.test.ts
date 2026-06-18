/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
import { describe, expect, it, vi } from "vitest";

import {
  URL_EFFECT_EVENT,
  VALIDATION_EFFECT_EVENT,
  applyEffects,
  applyUrlEffect,
  parseEffects,
} from "../runtime/effects.js";

describe("effects: url + errors (wire-protocol §5b, server already emits these)", () => {
  it("parses a url effect from the header bag", () => {
    const bag = parseEffects('{"url":{"query":"search=spring&tab=details","history":"PUSH"}}');
    expect(bag?.url).toEqual({ query: "search=spring&tab=details", history: "PUSH" });
  });

  it("applyUrlEffect pushes the query onto the current pathname (never a host)", () => {
    const history = { pushState: vi.fn(), replaceState: vi.fn() } as unknown as History;
    const location = { pathname: "/listings" } as Location;

    applyUrlEffect({ query: "page=2", history: "PUSH" }, history, location);

    expect(history.pushState).toHaveBeenCalledWith({}, "", "/listings?page=2");
    expect(history.replaceState).not.toHaveBeenCalled();
  });

  it("an empty query clears the parameters (just the pathname)", () => {
    const history = { pushState: vi.fn(), replaceState: vi.fn() } as unknown as History;
    const location = { pathname: "/listings" } as Location;

    applyUrlEffect({ query: "", history: "REPLACE" }, history, location);

    expect(history.replaceState).toHaveBeenCalledWith({}, "", "/listings");
  });

  it("applyEffects surfaces validation errors as a DOM event", () => {
    const target = new EventTarget();
    const seen: unknown[] = [];
    target.addEventListener(VALIDATION_EFFECT_EVENT, (e) => seen.push((e as CustomEvent).detail));

    applyEffects({ errors: { email: ["must be an email"] } }, target, () => {});

    expect(seen).toEqual([{ email: ["must be an email"] }]);
  });

  it("applyEffects emits a url event and applies dispatches before a redirect", () => {
    const target = new EventTarget();
    const order: string[] = [];
    target.addEventListener("saved", () => order.push("dispatch"));
    target.addEventListener(URL_EFFECT_EVENT, () => order.push("url"));
    const navigate = (): void => void order.push("redirect");

    // Patch history so applyUrlEffect (called inside applyEffects) does not touch the real bar.
    const origPush = window.history.pushState;
    window.history.pushState = (): void => {};
    try {
      applyEffects(
        {
          dispatch: [{ name: "saved" }],
          url: { query: "x=1", history: "PUSH" },
          redirect: "/done",
        },
        target,
        navigate,
      );
    } finally {
      window.history.pushState = origPush;
    }

    expect(order).toEqual(["dispatch", "url", "redirect"]);
  });
});
