/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LievitRuntime } from "../runtime/runtime.js";
import { installPreserveScroll } from "../runtime/features/preserve-scroll.js";

function okFetch(html: string): typeof fetch {
  return (async () =>
    new Response(html, { status: 200, headers: { "Lievit-Snapshot": "snap-2" } })) as never;
}

function mount(inner: string, fetchImpl: typeof fetch): { root: HTMLElement; rt: LievitRuntime } {
  document.body.innerHTML = `<div data-lievit-component="C" data-lievit-id="c1" data-lievit-snapshot="snap-1">${inner}</div>`;
  const rt = new LievitRuntime({ fetchImpl });
  return { root: document.body.firstElementChild as HTMLElement, rt };
}

describe("preserve-scroll (#117)", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("restores a preserved element's scrollTop after the morph re-renders it", async () => {
    // The list is preserved and keyed by id, so the morph re-renders it and we restore the offset.
    const fresh =
      '<div id="log" l:preserve-scroll style="overflow:auto"><p>new content</p></div>' +
      '<button l:click="load">load</button>';
    const fetchImpl = vi.fn(
      okFetch(`<div data-lievit-component="C" data-lievit-id="c1">${fresh}</div>`),
    );
    const { root, rt } = mount(
      '<div id="log" l:preserve-scroll style="overflow:auto"><p>old content</p></div>' +
        '<button l:click="load">load</button>',
      fetchImpl as unknown as typeof fetch,
    );
    installPreserveScroll(rt);
    rt.start();

    const log = root.querySelector("#log") as HTMLElement;
    log.scrollTop = 420;

    (root.querySelector("button") as HTMLElement).click();
    await vi.waitFor(() => expect(root.querySelector("#log p")!.textContent).toBe("new content"));

    expect((root.querySelector("#log") as HTMLElement).scrollTop).toBe(420);
  });

  it("preserves the window scroll for a directive carrying the .preserve-scroll modifier", async () => {
    const win = { scrollX: 0, scrollY: 0, scrollTo: vi.fn() };
    const fetchImpl = vi.fn(okFetch('<div data-lievit-component="C" data-lievit-id="c1"></div>'));
    const { root, rt } = mount(
      '<button l:click.preserve-scroll="save">save</button>',
      fetchImpl as unknown as typeof fetch,
    );
    installPreserveScroll(rt, win);
    rt.start();
    win.scrollY = 800;

    (root.querySelector("button") as HTMLElement).click();
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalled());
    await vi.waitFor(() => expect(win.scrollTo).toHaveBeenCalledWith(0, 800));
  });

  it("does not touch the window when the trigger has no preserve-scroll modifier", async () => {
    const win = { scrollX: 0, scrollY: 0, scrollTo: vi.fn() };
    const fetchImpl = vi.fn(okFetch('<div data-lievit-component="C" data-lievit-id="c1"></div>'));
    const { root, rt } = mount(
      '<button l:click="save">save</button>',
      fetchImpl as unknown as typeof fetch,
    );
    installPreserveScroll(rt, win);
    rt.start();

    (root.querySelector("button") as HTMLElement).click();
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalled());
    await Promise.resolve();
    expect(win.scrollTo).not.toHaveBeenCalled();
  });
});
