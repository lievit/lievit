/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LievitRuntime } from "../runtime/runtime.js";

/**
 * The `$lievit.$call(action, ...args)` inline-args contract. A REGULAR `@LievitAction` is invoked
 * server-side with no parameters (`WireDispatcher.invokeAction` -> `method.invoke(instance)`), so
 * inline args cannot reach a `show(String id)` parameter; only the framework magic actions parse
 * inline args. The real bug: `$lievit(root).$call('show', id)` reached the server as a bare `show`
 * with `id=null`, silently. The fix makes the foot-gun LOUD (a runtime warning) while keeping the
 * bare call working, so arg-less `$call('save')` is unchanged and the wire authorization allowlist
 * (ADR-0013) still gates the bare name.
 */

function snapshotAttr(snapshot: string): string {
  return `data-lievit-snapshot="${snapshot}"`;
}

function mount(snapshot = "s1"): HTMLElement {
  document.body.innerHTML =
    `<div data-lievit-component="C" data-lievit-id="cid" ${snapshotAttr(snapshot)}>` +
    `<button>x</button></div>`;
  return document.body.firstElementChild as HTMLElement;
}

function ok(html: string, headers: Record<string, string>): Response {
  return new Response(html, { status: 200, headers });
}

describe("$lievit.$call inline-args foot-gun", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("warns AND sends only the bare name when args are passed to a regular action", async () => {
    const root = mount("s1");
    const fetchImpl = vi.fn(async () =>
      ok(`<div data-lievit-component="C" data-lievit-id="cid"></div>`, { "Lievit-Snapshot": "s2" }),
    );
    const onError = vi.fn();
    const runtime = new LievitRuntime({ fetchImpl, onError });
    runtime.start();

    // The exact shape of the real bug: a regular action invoked with a positional arg.
    runtime.$lievit(root)!.$call("show", "abc");
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalled());

    // The dropped-arg foot-gun is now LOUD: the reporter fired and the message names the action.
    expect(onError).toHaveBeenCalled();
    expect((onError.mock.calls[0] as unknown as [string, unknown])[0]).toContain("show");

    // The arg never reached the server: the call carried only the bare name, no `_updates`.
    const init = (fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1];
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body._calls).toEqual(["show"]);
    expect(body._updates).toBeUndefined();
    // The arg "abc" appears nowhere in the wire payload (it was dropped, loudly).
    expect(init.body as string).not.toContain("abc");
  });

  it("does NOT warn and sends the bare name for an arg-less call (backward compatible)", async () => {
    const root = mount("s1");
    const fetchImpl = vi.fn(async () =>
      ok(`<div data-lievit-component="C" data-lievit-id="cid"></div>`, { "Lievit-Snapshot": "s2" }),
    );
    const onError = vi.fn();
    const runtime = new LievitRuntime({ fetchImpl, onError });
    runtime.start();

    runtime.$lievit(root)!.$call("save");
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalled());

    expect(onError).not.toHaveBeenCalled();
    const init = (fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect(JSON.parse(init.body as string)._calls).toEqual(["save"]);
  });

  it("does NOT warn when args ride a MAGIC action via $call (the server parses those)", async () => {
    const root = mount("s1");
    const fetchImpl = vi.fn(async () =>
      ok(`<div data-lievit-component="C" data-lievit-id="cid"></div>`, { "Lievit-Snapshot": "s2" }),
    );
    const onError = vi.fn();
    const runtime = new LievitRuntime({ fetchImpl, onError });
    runtime.start();

    // A magic call name carries its args inside the call string; the server parses them, so this is
    // legitimate and must not warn.
    runtime.$lievit(root)!.$call("$toggle('open')");
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalled());

    expect(onError).not.toHaveBeenCalled();
    const init = (fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect(JSON.parse(init.body as string)._calls).toEqual(["$toggle('open')"]);
  });
});
