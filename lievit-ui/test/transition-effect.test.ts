/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LievitRuntime } from "../runtime/runtime.js";
import { installTransition } from "../runtime/features/transition.js";

function okFetch(html: string, effects?: string): typeof fetch {
  return (async () =>
    new Response(html, {
      status: 200,
      headers: {
        "Lievit-Snapshot": "snap-2",
        ...(effects != null ? { "Lievit-Effects": effects } : {}),
      },
    })) as never;
}

function mount(inner: string, fetchImpl: typeof fetch): { root: HTMLElement; rt: LievitRuntime } {
  document.body.innerHTML = `<div data-lievit-component="C" data-lievit-id="c1" data-lievit-snapshot="snap-1">${inner}</div>`;
  const rt = new LievitRuntime({ fetchImpl });
  return { root: document.body.firstElementChild as HTMLElement, rt };
}

describe("transition server effect (#113, @LievitTransition)", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("records the transition effect for the update so the feature can read it", async () => {
    const fetchImpl = vi.fn(
      okFetch('<div data-lievit-component="C" data-lievit-id="c1"></div>', '{"transition":{"skip":true}}'),
    );
    const { root, rt } = mount('<button l:click="go">go</button>', fetchImpl as unknown as typeof fetch);
    installTransition(rt);
    rt.start();

    (root.querySelector("button") as HTMLElement).click();
    await vi.waitFor(() => expect(rt.transitionFor(root)?.skip).toBe(true));
  });

  it("clears the transition control on a plain call (no transition effect)", async () => {
    let first = true;
    const html = '<div data-lievit-component="C" data-lievit-id="c1"><button l:click="go">go</button></div>';
    const fetchImpl = vi.fn(async () => {
      const headers: Record<string, string> = { "Lievit-Snapshot": "snap-2" };
      if (first) {
        headers["Lievit-Effects"] = '{"transition":{"skip":true}}';
      }
      first = false;
      return new Response(html, { status: 200, headers });
    });
    const { root, rt } = mount('<button l:click="go">go</button>', fetchImpl as unknown as typeof fetch);
    installTransition(rt);
    rt.start();

    (root.querySelector("button") as HTMLElement).click();
    await vi.waitFor(() => expect(rt.transitionFor(root)?.skip).toBe(true));
    (root.querySelector("button") as HTMLElement).click();
    await vi.waitFor(() => expect(rt.transitionFor(root)).toBeNull());
  });

  it("skips the enter animation when the server asks to skip", async () => {
    // The new markup adds an l:transition element; a skip effect must mark it entered without animating.
    const fresh =
      '<div data-lievit-component="C" data-lievit-id="c1">' +
      '<p l:transition.fade>new</p><button l:click="go">go</button></div>';
    const fetchImpl = vi.fn(okFetch(fresh, '{"transition":{"skip":true}}'));
    const { root, rt } = mount('<button l:click="go">go</button>', fetchImpl as unknown as typeof fetch);
    installTransition(rt);
    rt.start();

    (root.querySelector("button") as HTMLElement).click();
    await vi.waitFor(() => expect(root.querySelector("p")).not.toBeNull());
    // Marked entered (no fade-in) because the server skipped the transition for this update.
    expect(root.querySelector("p")!.hasAttribute("data-l-entered")).toBe(true);
  });

  it("records a server-driven duration override", async () => {
    const fetchImpl = vi.fn(
      okFetch('<div data-lievit-component="C" data-lievit-id="c1"></div>', '{"transition":{"duration":300}}'),
    );
    const { root, rt } = mount('<button l:click="go">go</button>', fetchImpl as unknown as typeof fetch);
    installTransition(rt);
    rt.start();

    (root.querySelector("button") as HTMLElement).click();
    await vi.waitFor(() => expect(rt.transitionFor(root)?.duration).toBe(300));
  });
});
