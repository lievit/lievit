/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import { RELEASE_ATTR, clientRelease, disableBfcache, releaseMismatch } from "../runtime/release-token.js";

afterEach(() => {
  document.documentElement.removeAttribute(RELEASE_ATTR);
});

describe("release tokens + bfcache (ADR-0024 #105)", () => {
  it("reads the client release token from <html>", () => {
    document.documentElement.setAttribute(RELEASE_ATTR, "build-7");
    expect(clientRelease()).toBe("build-7");
  });

  it("detects a mismatch when the server release differs from the client's", () => {
    expect(releaseMismatch("build-8", "build-7")).toBe(true);
    expect(releaseMismatch("build-7", "build-7")).toBe(false);
  });

  it("is opt-in: a null on either side is not a mismatch", () => {
    expect(releaseMismatch(null, "build-7")).toBe(false);
    expect(releaseMismatch("build-8", null)).toBe(false);
  });

  it("reloads only when the page is restored from the bfcache (persisted pageshow)", () => {
    const target = new EventTarget();
    const reload = vi.fn();
    disableBfcache(target, reload);

    target.dispatchEvent(Object.assign(new Event("pageshow"), { persisted: false }));
    expect(reload).not.toHaveBeenCalled();

    target.dispatchEvent(Object.assign(new Event("pageshow"), { persisted: true }));
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("unsubscribe detaches the pageshow listener", () => {
    const target = new EventTarget();
    const reload = vi.fn();
    const off = disableBfcache(target, reload);
    off();
    target.dispatchEvent(Object.assign(new Event("pageshow"), { persisted: true }));
    expect(reload).not.toHaveBeenCalled();
  });
});
