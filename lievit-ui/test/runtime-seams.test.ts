/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LievitRuntime } from "../runtime/runtime.js";

function okResponse(html = "<div></div>"): Response {
  return new Response(html, { status: 200, headers: { "Lievit-Snapshot": "s2" } });
}

function mount(): { rt: LievitRuntime; fetchImpl: ReturnType<typeof vi.fn> } {
  document.body.innerHTML =
    '<div data-lievit-component="C" data-lievit-id="c1" data-lievit-snapshot="s1"><button l:click="go">go</button></div>';
  const fetchImpl = vi.fn(async () => okResponse());
  const rt = new LievitRuntime({ fetchImpl: fetchImpl as unknown as typeof fetch });
  return { rt, fetchImpl };
}

beforeEach(() => {
  document.body.innerHTML = "";
});

describe("runtime extension seams (ADR-0019)", () => {
  it("an interceptor returning false aborts the call; unsubscribe restores it", async () => {
    const { rt, fetchImpl } = mount();
    const off = rt.intercept(() => false);
    rt.start();

    document.querySelector("button")!.click();
    await new Promise((r) => setTimeout(r, 0));
    expect(fetchImpl).not.toHaveBeenCalled();

    off();
    document.querySelector("button")!.click();
    await new Promise((r) => setTimeout(r, 0));
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("interceptors see the trigger element in meta", async () => {
    const { rt } = mount();
    const seen: Element[] = [];
    rt.intercept((ctx) => {
      if (ctx.meta?.trigger != null) {
        seen.push(ctx.meta.trigger);
      }
      return false;
    });
    rt.start();

    const button = document.querySelector("button")!;
    button.click();
    await new Promise((r) => setTimeout(r, 0));
    expect(seen).toEqual([button]);
  });

  it("a buggy interceptor is fail-soft (does not block the call)", async () => {
    const { rt, fetchImpl } = mount();
    rt.intercept(() => {
      throw new Error("boom");
    });
    rt.start();

    document.querySelector("button")!.click();
    await new Promise((r) => setTimeout(r, 0));
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("morphWith providers shape the morph; multiple compose (first non-morph mode wins)", async () => {
    document.body.innerHTML =
      '<div data-lievit-component="C" data-lievit-id="c1" data-lievit-snapshot="s1"><div id="keep">live</div><button l:click="go">go</button></div>';
    const fetchImpl = vi.fn(
      async () =>
        okResponse('<div data-lievit-component="C"><div id="keep">server</div><button l:click="go">go</button></div>'),
    );
    const rt = new LievitRuntime({ fetchImpl: fetchImpl as unknown as typeof fetch });
    rt.morphWith(() => ({ elementMode: (el) => (el.id === "keep" ? "skip" : undefined) }));
    rt.start();

    document.querySelector("button")!.click();
    await new Promise((r) => setTimeout(r, 0));

    expect(document.getElementById("keep")!.textContent).toBe("live");
  });

  it("callAction is public and threads meta to lifecycle beforeCall", async () => {
    const { rt } = mount();
    const metas: unknown[] = [];
    rt.use({ beforeCall: (ctx) => metas.push(ctx.meta) });
    rt.start();

    await rt.callAction(document.querySelector("button")!, "go", { poll: true });
    expect(metas).toEqual([{ poll: true }]);
  });
});
