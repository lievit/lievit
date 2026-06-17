/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LievitRuntime } from "../runtime/runtime.js";
import { islandCloseMarker, islandOpenMarker } from "../runtime/islands.js";

/** Encodes a `wire` object into a JWT-like snapshot the runtime's `decodeWire` can read. */
function snapshotWith(wire: Record<string, unknown>): string {
  const payload = btoa(JSON.stringify({ cid: "cid", cls: "C", wire }))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return `h.${payload}.sig`;
}

function ok(html: string, headers: Record<string, string>): Response {
  return new Response(html, { status: 200, headers });
}

describe("LievitRuntime v4 convergence (ADR-0024)", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("seeds the ephemeral mirror from the snapshot and updates it on l:model input (#87)", () => {
    const snap = snapshotWith({ name: "ada" });
    document.body.innerHTML =
      `<div data-lievit-component="C" data-lievit-id="cid" data-lievit-snapshot="${snap}">` +
      `<input l:model="name"><span l:text="name"></span></div>`;
    const root = document.body.firstElementChild as HTMLElement;
    const runtime = new LievitRuntime();
    runtime.start();

    // l:text reflected the seeded ephemeral value on bind.
    expect(root.querySelector("span")!.textContent).toBe("ada");

    // Typing updates the ephemeral mirror immediately (before any network call) → l:text re-reflects.
    const input = root.querySelector("input")!;
    input.value = "grace";
    input.dispatchEvent(new Event("input"));
    expect(root.querySelector("span")!.textContent).toBe("grace");
  });

  it("rebuilds the ephemeral mirror from the merged server state after a call (#87)", async () => {
    const snap = snapshotWith({ a: "x", b: 1 });
    document.body.innerHTML =
      `<form data-lievit-component="C" data-lievit-id="cid" data-lievit-snapshot="${snap}">` +
      `<input name="bi" l:model="b">` +
      `<button l:click="bump">bump</button>` +
      `<span id="pa" l:text="a"></span><span id="pb" l:text="b"></span></form>`;
    const root = document.body.firstElementChild as HTMLElement;
    // The server response is authoritative: a stays "x", b becomes 2.
    const fetchImpl = vi.fn(async () =>
      ok(
        `<form data-lievit-component="C" data-lievit-id="cid">` +
          `<input name="bi" l:model="b"><button l:click="bump">bump</button>` +
          `<span id="pa" l:text="a"></span><span id="pb" l:text="b"></span></form>`,
        { "Lievit-Snapshot": snapshotWith({ a: "x", b: 2 }) },
      ),
    );
    const runtime = new LievitRuntime({ fetchImpl });
    runtime.start();
    expect(root.querySelector("#pb")!.textContent).toBe("1"); // seeded from the initial snapshot

    (root.querySelector("button") as HTMLElement).click();
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalled());
    // The ephemeral mirror is rebuilt from the merged server state and l:text re-reflects it.
    await vi.waitFor(() => expect(root.querySelector("#pb")!.textContent).toBe("2"));
    expect(root.querySelector("#pa")!.textContent).toBe("x"); // authoritative server value
  });

  it("routes an l:island action and morphs only that island fragment (#89)", async () => {
    const snap = snapshotWith({ n: 0 });
    const islandHtml = `<!--${islandOpenMarker("counter")}--><b>1</b><!--${islandCloseMarker("counter")}-->`;
    document.body.innerHTML =
      `<div data-lievit-component="C" data-lievit-id="cid" data-lievit-snapshot="${snap}">` +
      `<p id="outside">stay</p>` +
      `<!--${islandOpenMarker("counter")}--><b>0</b><!--${islandCloseMarker("counter")}-->` +
      `<button data-lievit-island="counter" l:island="inc">+</button></div>`;
    const root = document.body.firstElementChild as HTMLElement;
    const fetchImpl = vi.fn(async () =>
      ok(islandHtml, { "Lievit-Snapshot": snap, "Lievit-Effects": JSON.stringify({ islands: ["counter"] }) }),
    );
    const runtime = new LievitRuntime({ fetchImpl });
    runtime.start();
    const outsideBefore = root.querySelector("#outside")!;

    (root.querySelector("button") as HTMLElement).click();
    await vi.waitFor(() => expect(root.querySelector("b")!.textContent).toBe("1"));

    // The island re-rendered; the sibling node identity outside the island is preserved.
    expect(root.querySelector("#outside")).toBe(outsideBefore);
    // The wire call carried the island name in the reserved _island update key.
    const init = (fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect(JSON.parse(init.body as string)._updates._island).toBe("counter");
  });

  it("fires interceptor phases around a call and lets cancel() abort it (#93)", async () => {
    const snap = snapshotWith({});
    document.body.innerHTML =
      `<div data-lievit-component="C" data-lievit-id="cid" data-lievit-snapshot="${snap}">` +
      `<button l:click="go">go</button></div>`;
    const root = document.body.firstElementChild as HTMLElement;
    const sameBody = `<div data-lievit-component="C" data-lievit-id="cid"><button l:click="go">go</button></div>`;
    const fetchImpl = vi.fn(async () => ok(sameBody, { "Lievit-Snapshot": snap }));
    const runtime = new LievitRuntime({ fetchImpl });
    runtime.start();

    const phases: string[] = [];
    runtime.intercept({
      onInit: () => phases.push("init"),
      onSend: () => phases.push("send"),
      onMorph: () => phases.push("morph"),
      onFinish: () => phases.push("finish"),
    });
    (root.querySelector("button") as HTMLElement).click();
    await vi.waitFor(() => expect(phases).toContain("finish"));
    expect(phases).toEqual(["init", "send", "morph", "finish"]);

    // A cancelling interceptor aborts the call: no further fetch.
    const callsBefore = fetchImpl.mock.calls.length;
    runtime.intercept({ onInit: (req) => req.cancel() });
    (root.querySelector("button") as HTMLElement).click();
    await Promise.resolve();
    await Promise.resolve();
    expect(fetchImpl.mock.calls.length).toBe(callsBefore); // cancelled before send
  });

  it("invokes a registered $js handler from the js effect, never an eval (#131)", async () => {
    const snap = snapshotWith({});
    document.body.innerHTML =
      `<div data-lievit-component="C" data-lievit-id="cid" data-lievit-snapshot="${snap}">` +
      `<button l:click="go">go</button></div>`;
    const root = document.body.firstElementChild as HTMLElement;
    const fetchImpl = vi.fn(async () =>
      ok(`<div data-lievit-component="C" data-lievit-id="cid"></div>`, {
        "Lievit-Snapshot": snap,
        "Lievit-Effects": JSON.stringify({ js: [{ name: "flash", args: ["saved"] }] }),
      }),
    );
    const runtime = new LievitRuntime({ fetchImpl });
    const handler = vi.fn();
    runtime.js.register("flash", handler);
    runtime.start();

    (root.querySelector("button") as HTMLElement).click();
    await vi.waitFor(() => expect(handler).toHaveBeenCalled());
    expect(handler).toHaveBeenCalledWith(["saved"], { root });
  });

  it("blocks a server redirect when an interceptor prevents it (#93)", async () => {
    const snap = snapshotWith({});
    document.body.innerHTML =
      `<div data-lievit-component="C" data-lievit-id="cid" data-lievit-snapshot="${snap}">` +
      `<button l:click="go">go</button></div>`;
    const root = document.body.firstElementChild as HTMLElement;
    const fetchImpl = vi.fn(async () =>
      ok(`<div data-lievit-component="C" data-lievit-id="cid"></div>`, {
        "Lievit-Snapshot": snap,
        "Lievit-Effects": JSON.stringify({ redirect: "/elsewhere" }),
      }),
    );
    const navigate = vi.fn();
    // Stub window.location.assign so a non-blocked redirect would be observable.
    vi.stubGlobal("location", { ...window.location, assign: navigate, reload: () => {} });
    const runtime = new LievitRuntime({ fetchImpl });
    runtime.intercept({ onRedirect: (control) => control.preventDefault() });
    runtime.start();

    (root.querySelector("button") as HTMLElement).click();
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalled());
    await Promise.resolve();
    expect(navigate).not.toHaveBeenCalled(); // the interceptor blocked it
    vi.unstubAllGlobals();
  });
});
