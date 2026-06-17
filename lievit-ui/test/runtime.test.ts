/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LievitRuntime } from "../runtime/runtime.js";

/** A LievitRuntime whose re-mount is observable instead of reloading the page. */
class TestRuntime extends LievitRuntime {
  remounted = false;
  protected override remount(): void {
    this.remounted = true;
  }
}

function mountCounter(snapshot = "s1"): HTMLElement {
  document.body.innerHTML =
    `<div data-lievit-component="com.example.Counter" data-lievit-id="cid" data-lievit-snapshot="${snapshot}">` +
    `<span data-count>0</span><button l:click="increment">+</button></div>`;
  return document.body.firstElementChild as HTMLElement;
}

function response(html: string, headers: Record<string, string>): Response {
  return new Response(html, { status: 200, headers });
}

describe("LievitRuntime loop (wire-protocol §1 phases 3-4)", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("turns an l:click into a wire call, morphs the DOM, and rotates the snapshot", async () => {
    const root = mountCounter("s1");
    const fetchImpl = vi.fn(async () =>
      response(
        '<div data-lievit-component="com.example.Counter" data-lievit-id="cid"><span data-count>1</span><button l:click="increment">+</button></div>',
        { "Lievit-Snapshot": "s2" },
      ),
    );
    const runtime = new TestRuntime({ fetchImpl });
    runtime.start();

    (root.querySelector("button") as HTMLElement).click();
    // Wait for the full async loop (fetch → morph) to land in the DOM, not just the fetch call.
    await vi.waitFor(() => expect(root.querySelector("[data-count]")!.textContent).toBe("1"));

    // The wire call carried the initial snapshot and the increment action.
    const init = (fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect(JSON.parse(init.body as string)).toEqual({ _snapshot: "s1", _calls: ["increment"] });

    // The snapshot rotated onto the root attribute.
    expect(root.getAttribute("data-lievit-snapshot")).toBe("s2");
  });

  it("sends deferred l:model updates with the next action, then clears them", async () => {
    document.body.innerHTML =
      '<form data-lievit-component="C" data-lievit-id="cid" data-lievit-snapshot="s1">' +
      '<input l:model="name" /><button l:click="save">save</button></form>';
    const root = document.body.firstElementChild as HTMLElement;
    const fetchImpl = vi.fn(async () =>
      response('<form data-lievit-component="C" data-lievit-id="cid"></form>', {
        "Lievit-Snapshot": "s2",
      }),
    );
    const runtime = new TestRuntime({ fetchImpl });
    runtime.start();

    const input = root.querySelector("input")!;
    input.value = "ada";
    input.dispatchEvent(new Event("input")); // deferred: stored, not sent
    expect(fetchImpl).not.toHaveBeenCalled();

    (root.querySelector("button") as HTMLElement).click(); // action drains the pending update
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalled());

    const init = (fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect(JSON.parse(init.body as string)).toEqual({
      _snapshot: "s1",
      _updates: { name: "ada" },
      _calls: ["save"],
    });
  });

  it("applies a redirect effect from the response", async () => {
    const root = mountCounter();
    const fetchImpl = vi.fn(async () =>
      response('<div data-lievit-component="com.example.Counter" data-lievit-id="cid"></div>', {
        "Lievit-Snapshot": "s2",
        "Lievit-Effects": '{"redirect":"/done"}',
      }),
    );
    // window.location.assign is the navigate default; spy on it via the effects path.
    const assign = vi.spyOn(window.location, "assign").mockImplementation(() => {});
    const runtime = new TestRuntime({ fetchImpl });
    runtime.start();

    (root.querySelector("button") as HTMLElement).click();
    await vi.waitFor(() => expect(assign).toHaveBeenCalledWith("/done"));
    assign.mockRestore();
  });

  it("re-mounts on a 409 (stale snapshot)", async () => {
    const root = mountCounter();
    const fetchImpl = vi.fn(
      async () => new Response("", { status: 409, headers: { "Lievit-Reason": "snapshot-expired" } }),
    );
    const runtime = new TestRuntime({ fetchImpl });
    runtime.start();

    (root.querySelector("button") as HTMLElement).click();
    await vi.waitFor(() => expect(runtime.remounted).toBe(true));
  });

  it("fires lifecycle hooks around a call (extension point)", async () => {
    const root = mountCounter();
    const fetchImpl = vi.fn(async () =>
      response('<div data-lievit-component="com.example.Counter" data-lievit-id="cid"></div>', {
        "Lievit-Snapshot": "s2",
      }),
    );
    const phases: string[] = [];
    const runtime = new TestRuntime({ fetchImpl });
    runtime.use({
      onComponentInit: () => phases.push("init"),
      beforeCall: () => phases.push("before"),
      afterCall: () => phases.push("after"),
    });
    runtime.start();

    (root.querySelector("button") as HTMLElement).click();
    await vi.waitFor(() => expect(phases).toContain("after"));
    expect(phases).toEqual(["init", "before", "after"]);
  });

  it("surfaces a non-remount failure via onError without throwing", async () => {
    const root = mountCounter();
    const fetchImpl = vi.fn(
      async () => new Response("", { status: 403, headers: { "Lievit-Reason": "locked-property" } }),
    );
    const onError = vi.fn();
    const runtime = new TestRuntime({ fetchImpl, onError });
    const errors: string[] = [];
    runtime.use({ onError: (o) => errors.push(o.reason ?? "") });
    runtime.start();

    (root.querySelector("button") as HTMLElement).click();
    await vi.waitFor(() => expect(errors).toContain("locked-property"));
    expect(runtime.remounted).toBe(false);
    expect(onError).toHaveBeenCalled();
  });
});
