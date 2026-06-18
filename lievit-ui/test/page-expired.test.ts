/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LievitRuntime } from "../runtime/runtime.js";
import { installPageExpired, isExpiredStatus } from "../runtime/features/page-expired.js";

/** A LievitRuntime whose re-mount is observable instead of reloading the page. */
class TestRuntime extends LievitRuntime {
  remounted = 0;
  protected override remount(): void {
    this.remounted += 1;
  }
}

function failResponse(status: number, reason: string): Response {
  return new Response("", { status, headers: { "Lievit-Reason": reason } });
}

function mount(id = "cid", snapshot = "s1"): HTMLElement {
  const el = document.createElement("div");
  el.setAttribute("data-lievit-component", "com.example.C");
  el.setAttribute("data-lievit-id", id);
  el.setAttribute("data-lievit-snapshot", snapshot);
  el.innerHTML = `<button l:click="act">go</button>`;
  document.body.appendChild(el);
  return el;
}

describe("error responses UX: page-expired dialog (#103)", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("recognizes 409 (snapshot/session expired) and 403 (CSRF) as expired, others not", () => {
    expect(isExpiredStatus(409)).toBe(true);
    expect(isExpiredStatus(403)).toBe(true);
    expect(isExpiredStatus(500)).toBe(false);
    expect(isExpiredStatus(200)).toBe(false);
  });

  it("shows the page-expired confirm dialog on an expired response and reloads on accept", async () => {
    const confirm = vi.fn(() => true);
    const reload = vi.fn();
    const fetchImpl = vi.fn(async () => failResponse(409, "snapshot-expired"));
    const root = mount();
    const runtime = new TestRuntime({ fetchImpl });
    runtime.start();
    installPageExpired(runtime, { confirm, reload });

    await runtime.callAction(root, "act");

    expect(confirm).toHaveBeenCalledTimes(1);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("does not reload when the user dismisses the dialog", async () => {
    const confirm = vi.fn(() => false);
    const reload = vi.fn();
    const fetchImpl = vi.fn(async () => failResponse(409, "snapshot-expired"));
    const root = mount();
    const runtime = new TestRuntime({ fetchImpl });
    runtime.start();
    installPageExpired(runtime, { confirm, reload });

    await runtime.callAction(root, "act");

    expect(confirm).toHaveBeenCalledTimes(1);
    expect(reload).not.toHaveBeenCalled();
  });

  it("dedups the dialog across concurrent expired failures (shows once)", async () => {
    const confirm = vi.fn(() => false);
    const reload = vi.fn();
    const fetchImpl = vi.fn(async () => failResponse(409, "snapshot-expired"));
    const rootA = mount("cidA");
    const rootB = mount("cidB");
    const runtime = new TestRuntime({ fetchImpl });
    runtime.start();
    installPageExpired(runtime, { confirm, reload });

    await Promise.all([runtime.callAction(rootA, "act"), runtime.callAction(rootB, "act")]);

    expect(confirm).toHaveBeenCalledTimes(1);
  });

  it("suppresses the default remount when it takes over the expired recovery", async () => {
    const confirm = vi.fn(() => false);
    const reload = vi.fn();
    const fetchImpl = vi.fn(async () => failResponse(409, "snapshot-expired"));
    const root = mount();
    const runtime = new TestRuntime({ fetchImpl });
    runtime.start();
    installPageExpired(runtime, { confirm, reload });

    await runtime.callAction(root, "act");

    // the feature owns the recovery (the dialog), so the hard remount must NOT also fire.
    expect(runtime.remounted).toBe(0);
  });

  it("an app interceptor can preventDefault the dialog (the fail hook override)", async () => {
    const confirm = vi.fn(() => true);
    const reload = vi.fn();
    const fetchImpl = vi.fn(async () => failResponse(409, "snapshot-expired"));
    const root = mount();
    const runtime = new TestRuntime({ fetchImpl });
    runtime.start();
    // App registers its own expired handler FIRST and prevents the default dialog.
    runtime.intercept({
      onExpired: (control) => control.preventDefault(),
    });
    installPageExpired(runtime, { confirm, reload });

    await runtime.callAction(root, "act");

    expect(confirm).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
  });
});
