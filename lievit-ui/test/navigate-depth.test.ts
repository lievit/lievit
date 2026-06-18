/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LievitRuntime } from "../runtime/runtime.js";
import { installNavigate, type NavigateOptions } from "../runtime/features/navigate.js";

const teardowns: Array<() => void> = [];

/** Installs navigate and registers its document listeners for teardown (test isolation). */
function install(rt: LievitRuntime, options: NavigateOptions): void {
  teardowns.push(installNavigate(rt, options));
}

beforeEach(() => {
  document.head.innerHTML = "";
  document.body.innerHTML = "";
  window.history.replaceState(null, "", "/");
});

afterEach(() => {
  while (teardowns.length > 0) {
    teardowns.pop()!();
  }
});

/** A fetch stub returning the given body with status 200. */
function htmlFetch(html: string): typeof fetch {
  return vi.fn(async () => new Response(html, { status: 200 })) as unknown as typeof fetch;
}

/** Dispatches an internal left-click on the first anchor. */
function clickAnchor(): void {
  document
    .querySelector("a")!
    .dispatchEvent(new MouseEvent("click", { button: 0, bubbles: true, cancelable: true }));
}

function fullPage(head: string, body: string): string {
  return `<html><head>${head}</head><body>${body}</body></html>`;
}

describe("navigate head merge (#193)", () => {
  it("appends a new <head> stylesheet from the incoming page (no full reload)", async () => {
    document.head.innerHTML = '<link rel="stylesheet" href="/app.css">';
    document.body.innerHTML = '<a href="/next" l:navigate>next</a>';
    const next = fullPage(
      '<link rel="stylesheet" href="/app.css"><link rel="stylesheet" href="/page.css">',
      '<a href="/" l:navigate>home</a><div id="m">B</div>',
    );
    const rt = new LievitRuntime();
    install(rt, { fetchImpl: htmlFetch(next) });

    clickAnchor();
    await vi.waitFor(() => expect(document.getElementById("m")!.textContent).toBe("B"));

    // The page.css the new head declared was merged into the live head.
    expect(document.head.querySelector('link[href="/page.css"]')).not.toBeNull();
    // The already-present app.css was not duplicated.
    expect(document.head.querySelectorAll('link[href="/app.css"]').length).toBe(1);
  });

  it("forces a full reload when a tracked script bundle changed", async () => {
    document.head.innerHTML = '<script src="/runtime.v1.js" data-navigate-track></script>';
    document.body.innerHTML = '<a href="/next" l:navigate>next</a><div id="m">A</div>';
    const next = fullPage(
      '<script src="/runtime.v2.js" data-navigate-track></script>',
      '<div id="m">B</div>',
    );
    const assign = vi.fn();
    const win = Object.create(window, {
      location: { value: { href: window.location.href, origin: window.location.origin, assign } },
    }) as unknown as Window;
    const rt = new LievitRuntime();
    install(rt, { fetchImpl: htmlFetch(next), win });

    clickAnchor();
    await vi.waitFor(() => expect(assign).toHaveBeenCalledWith("http://localhost:3000/next"));
    // The body was NOT morphed: the full reload takes over.
    expect(document.getElementById("m")!.textContent).toBe("A");
  });
});

describe("navigate progress bar (#195)", () => {
  it("shows a progress bar during the fetch and removes it after the swap", async () => {
    document.body.innerHTML = '<a href="/next" l:navigate>next</a><div id="m">A</div>';
    let resolve!: (r: Response) => void;
    const fetchImpl = vi.fn(
      () => new Promise<Response>((r) => (resolve = r)),
    ) as unknown as typeof fetch;
    const rt = new LievitRuntime();
    install(rt, { fetchImpl });

    clickAnchor();
    await vi.waitFor(() => expect(document.querySelector("[data-lievit-progress]")).not.toBeNull());

    resolve(new Response(fullPage("", '<a href="/" l:navigate>home</a><div id="m">B</div>'), { status: 200 }));
    await vi.waitFor(() => expect(document.getElementById("m")!.textContent).toBe("B"));
    expect(document.querySelector("[data-lievit-progress]")).toBeNull();
  });

  it("suppresses the bar when the link carries data-no-progress-bar", async () => {
    document.body.innerHTML = '<a href="/next" l:navigate data-no-progress-bar>next</a><div id="m">A</div>';
    let resolve!: (r: Response) => void;
    const fetchImpl = vi.fn(
      () => new Promise<Response>((r) => (resolve = r)),
    ) as unknown as typeof fetch;
    const rt = new LievitRuntime();
    install(rt, { fetchImpl });

    clickAnchor();
    await new Promise((r) => setTimeout(r, 0));
    expect(document.querySelector("[data-lievit-progress]")).toBeNull();

    resolve(new Response(fullPage("", '<div id="m">B</div>'), { status: 200 }));
    await vi.waitFor(() => expect(document.getElementById("m")!.textContent).toBe("B"));
  });
});

describe("navigate scroll preservation (#195)", () => {
  it("resets scroll to top on a plain forward navigation", async () => {
    document.body.innerHTML = '<a href="/next" l:navigate>next</a><div id="m">A</div>';
    const scrollTo = vi.fn();
    const win = Object.create(window, { scrollTo: { value: scrollTo } }) as unknown as Window;
    const rt = new LievitRuntime();
    install(rt, { fetchImpl: htmlFetch(fullPage("", '<div id="m">B</div>')), win });

    clickAnchor();
    await vi.waitFor(() => expect(document.getElementById("m")!.textContent).toBe("B"));
    expect(scrollTo).toHaveBeenCalledWith(0, 0);
  });

  it("preserves the scroll offset when the link opts in with .preserve-scroll", async () => {
    document.body.innerHTML = '<a href="/next" l:navigate.preserve-scroll>next</a><div id="m">A</div>';
    const scrollTo = vi.fn();
    const win = Object.create(window, { scrollTo: { value: scrollTo } }) as unknown as Window;
    const rt = new LievitRuntime();
    install(rt, { fetchImpl: htmlFetch(fullPage("", '<div id="m">B</div>')), win });

    clickAnchor();
    await vi.waitFor(() => expect(document.getElementById("m")!.textContent).toBe("B"));
    // The forward reset-to-top was not performed.
    expect(scrollTo).not.toHaveBeenCalledWith(0, 0);
  });
});

describe("navigate @persist (#195)", () => {
  it("carries a persisted element's live DOM node across a navigation (identity survives)", async () => {
    document.body.innerHTML =
      '<a href="/next" l:navigate>next</a>' +
      '<div l:persist="player"><audio id="au"></audio></div>' +
      '<div id="m">A</div>';
    const persisted = document.getElementById("au");
    const next = fullPage(
      "",
      '<a href="/" l:navigate>home</a>' +
        '<div l:persist="player"><audio id="au"></audio></div>' +
        '<div id="m">B</div>',
    );
    const rt = new LievitRuntime();
    install(rt, { fetchImpl: htmlFetch(next) });

    clickAnchor();
    await vi.waitFor(() => expect(document.getElementById("m")!.textContent).toBe("B"));

    // Same physical node object, not a re-created one.
    expect(document.getElementById("au")).toBe(persisted);
  });
});
