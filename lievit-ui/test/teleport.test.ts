/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
import { beforeEach, describe, expect, it } from "vitest";

import { LievitRuntime } from "../runtime/runtime.js";
import { installTeleport } from "../runtime/features/teleport.js";

/** A fetch that always replies 200 with the given body + a rotated snapshot header. */
function okFetch(html: string): typeof fetch {
  return (async () =>
    new Response(html, { status: 200, headers: { "Lievit-Snapshot": "snap-2" } })) as unknown as typeof fetch;
}

/** Mounts a single component root with the given inner HTML and returns it + a runtime. */
function mount(inner: string, fetchImpl?: typeof fetch): { root: HTMLElement; rt: LievitRuntime } {
  document.body.innerHTML =
    '<div id="app" data-lievit-component="Modal" data-lievit-id="m" data-lievit-snapshot="snap-1">' +
    inner +
    "</div>";
  const rt = new LievitRuntime(fetchImpl != null ? { fetchImpl } : {});
  return { root: document.getElementById("app") as HTMLElement, rt };
}

describe("l:teleport directive (#115)", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("relocates the directive element's content to the target selector", () => {
    const { rt, root } = mount('<div l:teleport="body"><p class="content">hi</p></div>');
    installTeleport(rt);
    rt.start();

    // The teleported content now lives directly under <body>, not inside the component root.
    expect(root.querySelector(".content")).toBeNull();
    const relocated = document.body.querySelector(".content");
    expect(relocated).not.toBeNull();
    expect(relocated!.parentElement).toBe(document.body);
    expect(relocated!.textContent).toBe("hi");
  });

  it("leaves an in-place anchor in the component subtree (so morph keeps owning it)", () => {
    const { rt, root } = mount('<div l:teleport="body"><p class="content">hi</p></div>');
    installTeleport(rt);
    rt.start();

    // The anchor element is still in the root (now emptied of its relocated children).
    const anchor = root.querySelector("[l\\:teleport]");
    expect(anchor).not.toBeNull();
    expect(anchor!.querySelector(".content")).toBeNull();
  });

  it("supports multiple teleports to the same target", () => {
    document.body.innerHTML =
      '<div id="modals"></div>' +
      '<div id="app" data-lievit-component="Modal" data-lievit-id="m" data-lievit-snapshot="s">' +
      '<div l:teleport="#modals"><p class="a">A</p></div>' +
      '<div l:teleport="#modals"><p class="b">B</p></div>' +
      "</div>";
    const rt = new LievitRuntime();
    installTeleport(rt);
    rt.start();

    const modals = document.getElementById("modals")!;
    expect(modals.querySelector(".a")).not.toBeNull();
    expect(modals.querySelector(".b")).not.toBeNull();
  });

  it("re-relocates fresh content after a wire call morphs the anchor (reactivity)", async () => {
    // The server re-renders the root with the teleport anchor re-populated (the anchor lives in the
    // component markup); the feature must re-sync on afterCall so the relocated content is fresh.
    const fetchImpl = okFetch(
      '<div data-lievit-component="Modal"><div l:teleport="body"><p class="content">new</p></div>' +
        '<button l:click="go">go</button></div>',
    );
    const { rt, root } = mount(
      '<div l:teleport="body"><p class="content">old</p></div><button l:click="go">go</button>',
      fetchImpl,
    );
    installTeleport(rt);
    rt.start();

    expect(document.body.querySelector(".content")!.textContent).toBe("old");

    root.querySelector("button")!.click();
    await new Promise((r) => setTimeout(r, 0));

    const relocated = document.body.querySelectorAll(".content");
    // Exactly one relocated node (the stale one was cleaned up), carrying the fresh text.
    expect(relocated).toHaveLength(1);
    expect(relocated[0]!.textContent).toBe("new");
  });

  it("survives multiple morph cycles without piling up stale copies", async () => {
    let n = 1;
    // The fetch body reflects an externally-stepped version so the assertion does not depend on how
    // many internal fetches a click triggers; what matters is no pile-up and the latest content wins.
    const fetchImpl = (async () =>
      new Response(
        `<div data-lievit-component="Modal"><div l:teleport="body"><p class="content">v${n}</p></div>` +
          '<button l:click="go">go</button></div>',
        { status: 200, headers: { "Lievit-Snapshot": "snap" } },
      )) as unknown as typeof fetch;
    const { rt, root } = mount(
      '<div l:teleport="body"><p class="content">v1</p></div><button l:click="go">go</button>',
      fetchImpl,
    );
    installTeleport(rt);
    rt.start();

    for (const v of [2, 3, 4]) {
      n = v;
      root.querySelector("button")!.click();
      await new Promise((r) => setTimeout(r, 0));
    }
    const relocated = document.body.querySelectorAll(".content");
    expect(relocated).toHaveLength(1);
    expect(relocated[0]!.textContent).toBe("v4");
  });

  it("does nothing when the target selector matches no element (fail-soft, content stays put)", () => {
    const { rt, root } = mount('<div l:teleport="#nope"><p class="content">hi</p></div>');
    installTeleport(rt);
    rt.start();

    // No target: the content is left in place rather than dropped.
    expect(root.querySelector(".content")).not.toBeNull();
  });
});
