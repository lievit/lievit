/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
/**
 * Robustness/golden tests for the navigate.ts hard edges (ADR-0084: navigate.ts is KEPT but is the
 * #1 place to find robustness bugs before 1.0, so the de-risking is durable). Each test pins a real
 * bug found + fixed during the harden pass: the in-flight race, popState superseding a forward nav,
 * popState scroll-after-reload, prefetch-failure poisoning, title sync, focus management, and the
 * cache-invalidation event.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LievitRuntime } from "../runtime/runtime.js";
import { installNavigate, type NavigateOptions } from "../runtime/features/navigate.js";

const teardowns: Array<() => void> = [];

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
  vi.restoreAllMocks();
});

function fullPage(head: string, body: string): string {
  return `<html><head>${head}</head><body>${body}</body></html>`;
}

/** A controllable fetch: each call parks until the test resolves it by URL, so races are scriptable. */
function deferredFetch(): {
  impl: typeof fetch;
  resolve: (url: string, html: string) => void;
  calls: () => string[];
} {
  const pending = new Map<string, (r: Response) => void>();
  const order: string[] = [];
  const impl = vi.fn((input: RequestInfo | URL) => {
    const url = String(input);
    order.push(url);
    return new Promise<Response>((r) => pending.set(url, r));
  }) as unknown as typeof fetch;
  return {
    impl,
    resolve: (url, html) => {
      // Match by suffix so callers can pass "/a" while the runtime fetched an absolute URL.
      const key = order.find((u) => u === url || u.endsWith(url));
      pending.get(key ?? url)?.(new Response(html, { status: 200 }));
    },
    calls: () => order,
  };
}

function anchor(href: string, extraAttr = ""): string {
  return `<a href="${href}" l:navigate ${extraAttr}>go</a>`;
}

function clickFirstAnchor(): void {
  document
    .querySelector("a")!
    .dispatchEvent(new MouseEvent("click", { button: 0, bubbles: true, cancelable: true }));
}

describe("navigate in-flight race (ADR-0084: double-navigation guard)", () => {
  it("a second click before the first fetch resolves: the LATER navigation wins, no desync", async () => {
    document.body.innerHTML = anchor("/a") + anchor("/b") + '<div id="m">HOME</div>';
    const f = deferredFetch();
    const win = Object.create(window, {
      scrollTo: { value: vi.fn() },
    }) as unknown as Window;
    const pushState = vi.spyOn(window.history, "pushState").mockImplementation(() => {});
    const rt = new LievitRuntime();
    install(rt, { fetchImpl: f.impl, win });

    // Click /a, then /b, both fetches in flight.
    document.querySelectorAll("a")[0]!.dispatchEvent(
      new MouseEvent("click", { button: 0, bubbles: true, cancelable: true }),
    );
    document.querySelectorAll("a")[1]!.dispatchEvent(
      new MouseEvent("click", { button: 0, bubbles: true, cancelable: true }),
    );

    // Resolve /b FIRST (the navigation the user last intended), then /a (the superseded one) LATE.
    f.resolve("/b", fullPage("", anchor("/") + '<div id="m">PAGE_B</div>'));
    await vi.waitFor(() => expect(document.getElementById("m")!.textContent).toBe("PAGE_B"));
    f.resolve("/a", fullPage("", anchor("/") + '<div id="m">PAGE_A</div>'));
    await new Promise((r) => setTimeout(r, 5));

    // The superseded /a must NOT overwrite the body it lost the race for.
    expect(document.getElementById("m")!.textContent).toBe("PAGE_B");
    // pushState fired for /b, but not a second time for the aborted /a.
    const pushed = pushState.mock.calls.map((c) => String(c[2]));
    expect(pushed.some((u) => u.endsWith("/b"))).toBe(true);
    expect(pushed.some((u) => u.endsWith("/a"))).toBe(false);
  });

  it("a forward navigation in flight is superseded by a Back: the slow fetch does not overwrite", async () => {
    // Seed a cache entry for "/" so popState replays it instead of fetching.
    document.body.innerHTML = anchor("/slow") + '<div id="m">HOME</div>';
    const f = deferredFetch();
    const scrollTo = vi.fn();
    const win = Object.create(window, { scrollTo: { value: scrollTo } }) as unknown as Window;
    vi.spyOn(window.history, "pushState").mockImplementation(() => {});
    const rt = new LievitRuntime();
    install(rt, { fetchImpl: f.impl, win });

    clickFirstAnchor(); // forward to /slow, fetch parked
    // User hits Back before /slow resolves. The cache holds "/" (snapshotted at go() time).
    window.dispatchEvent(new PopStateEvent("popstate"));
    await vi.waitFor(() => expect(document.getElementById("m")!.textContent).toBe("HOME"));

    // Now the slow /slow fetch resolves LATE: it must abort, leaving HOME (the Back target) intact.
    f.resolve("/slow", fullPage("", '<div id="m">SLOW</div>'));
    await new Promise((r) => setTimeout(r, 5));
    expect(document.getElementById("m")!.textContent).toBe("HOME");
  });
});

describe("navigate progress bar leak (ADR-0084)", () => {
  it("a superseded navigation does not leak its progress bar (the successor clears it)", async () => {
    document.body.innerHTML = anchor("/a") + anchor("/b") + '<div id="m">HOME</div>';
    const f = deferredFetch();
    const rt = new LievitRuntime();
    install(rt, { fetchImpl: f.impl });

    document.querySelectorAll("a")[0]!.dispatchEvent(
      new MouseEvent("click", { button: 0, bubbles: true, cancelable: true }),
    );
    await vi.waitFor(() => expect(document.querySelector("[data-lievit-progress]")).not.toBeNull());
    // Second click supersedes; its own go() hides the bar the first one showed.
    document.querySelectorAll("a")[1]!.dispatchEvent(
      new MouseEvent("click", { button: 0, bubbles: true, cancelable: true }),
    );
    f.resolve("/b", fullPage("", '<div id="m">PAGE_B</div>'));
    await vi.waitFor(() => expect(document.getElementById("m")!.textContent).toBe("PAGE_B"));

    // No leaked bar from the superseded /a, even when /a resolves afterwards.
    f.resolve("/a", fullPage("", '<div id="m">PAGE_A</div>'));
    await new Promise((r) => setTimeout(r, 5));
    expect(document.querySelector("[data-lievit-progress]")).toBeNull();
  });
});

describe("navigate scroll restoration on popState (ADR-0084)", () => {
  it("restores the exact saved offset of the page being returned to", async () => {
    document.body.innerHTML = anchor("/next") + '<div id="m">HOME</div>';
    const scrollTo = vi.fn();
    // Drive scrollY: HOME is at offset 250 when we navigate away.
    let y = 250;
    const win = Object.create(window, {
      scrollTo: { value: scrollTo },
      scrollY: { get: () => y },
    }) as unknown as Window;
    const f = deferredFetch();
    vi.spyOn(window.history, "pushState").mockImplementation(() => {});
    const rt = new LievitRuntime();
    install(rt, { fetchImpl: f.impl, win });

    clickFirstAnchor();
    f.resolve("/next", fullPage("", '<div id="m">NEXT</div>'));
    await vi.waitFor(() => expect(document.getElementById("m")!.textContent).toBe("NEXT"));
    y = 0; // forward nav reset us to the top of NEXT

    // Back to HOME: scroll must be restored to 250, not left at 0.
    window.dispatchEvent(new PopStateEvent("popstate"));
    await vi.waitFor(() => expect(document.getElementById("m")!.textContent).toBe("HOME"));
    expect(scrollTo).toHaveBeenCalledWith(0, 250);
  });

  it("does NOT scroll on popState when the cached back-target forces a full reload (changed bundle)", async () => {
    // baseAssets (captured at install) tracks runtime.v1. The cache snapshot of HOME is body-only
    // HTML (no <head>), so on Back its trackedAssets() is EMPTY != baseAssets → swap forces a full
    // reload via location.assign, and scrollTo must NOT fire on a page about to be replaced.
    document.head.innerHTML = '<script src="/runtime.v1.js" data-navigate-track></script>';
    document.body.innerHTML = anchor("/next") + '<div id="m">HOME</div>';
    const assign = vi.fn();
    const scrollTo = vi.fn();
    // Real history for the URL move, but intercept location.assign + scrollTo.
    const win = Object.create(window, {
      scrollTo: { value: scrollTo },
    }) as unknown as Window;
    // Cannot redefine window.location.assign on the real window; spy instead.
    const assignSpy = vi.spyOn(window.location, "assign").mockImplementation(assign);
    const f = deferredFetch();
    const rt = new LievitRuntime();
    install(rt, { fetchImpl: f.impl, win });

    clickFirstAnchor();
    // /next carries the SAME tracked bundle, so the forward swap succeeds and caches HOME (body-only).
    f.resolve(
      "/next",
      fullPage('<script src="/runtime.v1.js" data-navigate-track></script>', '<div id="m">NEXT</div>'),
    );
    await vi.waitFor(() => expect(document.getElementById("m")!.textContent).toBe("NEXT"));
    scrollTo.mockClear();

    // Back to "/": the cached body-only snapshot's head has no tracked bundle → swap returns false →
    // full reload, NO scroll restoration.
    window.history.back();
    await vi.waitFor(() => expect(assign).toHaveBeenCalled());
    expect(scrollTo).not.toHaveBeenCalled();
    assignSpy.mockRestore();
  });
});

describe("navigate prefetch-on-hover (ADR-0084)", () => {
  it("a failed prefetch is retried on a later hover (the URL is not poisoned)", async () => {
    document.body.innerHTML = anchor("/p", "l:navigate.hover") + '<div id="m">HOME</div>';
    let nextResult: Response | null = null;
    const fetchImpl = vi.fn(async () => {
      if (nextResult == null) {
        throw new Error("network down");
      }
      return nextResult;
    }) as unknown as typeof fetch;
    const rt = new LievitRuntime();
    install(rt, { fetchImpl });

    const link = document.querySelector("a")!;
    // First hover: prefetch fails.
    link.dispatchEvent(new Event("pointerenter", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 0));
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    // Second hover after the failure: must retry (poisoned URLs would skip this).
    nextResult = new Response(fullPage("", '<div id="m">P</div>'), { status: 200 });
    link.dispatchEvent(new Event("pointerenter", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 0));
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("a successful prefetch is not re-fetched on a subsequent hover", async () => {
    document.body.innerHTML = anchor("/p", "l:navigate.hover") + '<div id="m">HOME</div>';
    const fetchImpl = vi.fn(
      async () => new Response(fullPage("", '<div id="m">P</div>'), { status: 200 }),
    ) as unknown as typeof fetch;
    const rt = new LievitRuntime();
    install(rt, { fetchImpl });

    const link = document.querySelector("a")!;
    link.dispatchEvent(new Event("pointerenter", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 0));
    link.dispatchEvent(new Event("pointerenter", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 0));
    expect(fetchImpl).toHaveBeenCalledTimes(1); // cached after the first, no second fetch
  });
});

describe("navigate title + focus (ADR-0084, a11y)", () => {
  it("syncs the document title to the incoming page", async () => {
    document.title = "Old Title";
    document.body.innerHTML = anchor("/next") + '<div id="m">HOME</div>';
    const f = deferredFetch();
    vi.spyOn(window.history, "pushState").mockImplementation(() => {});
    const win = Object.create(window, { scrollTo: { value: vi.fn() } }) as unknown as Window;
    const rt = new LievitRuntime();
    install(rt, { fetchImpl: f.impl, win });

    clickFirstAnchor();
    f.resolve("/next", fullPage("<title>New Title</title>", '<div id="m">NEXT</div>'));
    await vi.waitFor(() => expect(document.getElementById("m")!.textContent).toBe("NEXT"));
    expect(document.title).toBe("New Title");
  });

  it("moves focus to the new page's <main> when focus was on body (a11y)", async () => {
    document.body.innerHTML = anchor("/next") + '<div id="m">HOME</div>';
    const f = deferredFetch();
    vi.spyOn(window.history, "pushState").mockImplementation(() => {});
    const win = Object.create(window, { scrollTo: { value: vi.fn() } }) as unknown as Window;
    const rt = new LievitRuntime();
    install(rt, { fetchImpl: f.impl, win });

    clickFirstAnchor();
    f.resolve("/next", fullPage("", '<main id="main">NEXT</main>'));
    await vi.waitFor(() => expect(document.getElementById("main")).not.toBeNull());

    const main = document.getElementById("main")!;
    expect(document.activeElement).toBe(main);
    // Made programmatically focusable without joining the tab order.
    expect(main.getAttribute("tabindex")).toBe("-1");
  });

  it("honors an explicit [autofocus] over the heading", async () => {
    document.body.innerHTML = anchor("/next") + '<div id="m">HOME</div>';
    const f = deferredFetch();
    vi.spyOn(window.history, "pushState").mockImplementation(() => {});
    const win = Object.create(window, { scrollTo: { value: vi.fn() } }) as unknown as Window;
    const rt = new LievitRuntime();
    install(rt, { fetchImpl: f.impl, win });

    clickFirstAnchor();
    f.resolve("/next", fullPage("", '<h1>title</h1><input id="search" autofocus>'));
    await vi.waitFor(() => expect(document.getElementById("search")).not.toBeNull());
    expect(document.activeElement).toBe(document.getElementById("search"));
  });
});

describe("navigate cache invalidation (ADR-0084: wire mutation staleness)", () => {
  it("a lievit:navigate-invalidate {url} event drops that snapshot so Back re-fetches fresh", async () => {
    // Real history (no pushState mock) so location.href actually moves and Back replays from cache.
    document.body.innerHTML = anchor("/next") + '<div id="m">HOME_V1</div>';
    let homeBody = '<div id="m">HOME_V1</div>';
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/next")) {
        return new Response(fullPage("", anchor("/") + '<div id="m">NEXT</div>'), { status: 200 });
      }
      return new Response(fullPage("", anchor("/next") + homeBody), { status: 200 });
    }) as unknown as typeof fetch;
    const rt = new LievitRuntime();
    install(rt, { fetchImpl });

    // Forward to /next snapshots HOME_V1 into the cache, real pushState moves location to /next.
    clickFirstAnchor();
    await vi.waitFor(() => expect(document.getElementById("m")!.textContent).toBe("NEXT"));

    // Server state changed while away. Invalidate the "/" snapshot.
    homeBody = '<div id="m">HOME_V2</div>';
    window.dispatchEvent(
      new CustomEvent("lievit:navigate-invalidate", { detail: { url: "/" } }),
    );

    // Back to "/": the dropped snapshot forces a fetch, which now yields V2 (not the cached V1).
    window.history.back();
    await vi.waitFor(() => expect(document.getElementById("m")!.textContent).toBe("HOME_V2"));
  });

  it("a lievit:navigate-invalidate with no detail clears the whole cache", async () => {
    document.body.innerHTML = anchor("/next") + '<div id="m">HOME_V1</div>';
    let homeBody = '<div id="m">HOME_V1</div>';
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/next")) {
        return new Response(fullPage("", anchor("/") + '<div id="m">NEXT</div>'), { status: 200 });
      }
      return new Response(fullPage("", anchor("/next") + homeBody), { status: 200 });
    }) as unknown as typeof fetch;
    const rt = new LievitRuntime();
    install(rt, { fetchImpl });

    clickFirstAnchor();
    await vi.waitFor(() => expect(document.getElementById("m")!.textContent).toBe("NEXT"));

    homeBody = '<div id="m">HOME_V2</div>';
    window.dispatchEvent(new CustomEvent("lievit:navigate-invalidate")); // no detail → clear all

    window.history.back();
    await vi.waitFor(() => expect(document.getElementById("m")!.textContent).toBe("HOME_V2"));
  });
});
