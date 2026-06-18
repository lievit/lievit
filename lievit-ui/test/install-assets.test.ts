/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
import { beforeEach, describe, expect, it } from "vitest";

import { LievitRuntime } from "../runtime/runtime.js";
import { installAssets } from "../runtime/features/assets.js";
import type { InterceptorOutcome } from "../runtime/interceptors.js";
import type { AssetsBlock } from "../runtime/features/assets.js";

/** A success outcome carrying an assets block, the shape the runtime hands its post-morph phase. */
function outcomeWith(assets: AssetsBlock | null, nonce?: string): InterceptorOutcome {
  const root = document.createElement("div");
  return { componentId: "c1", root, status: 200, ok: true, reason: null, assets, nonce };
}

describe("installAssets (#423: auto-wire applyAssets into the effect loop)", () => {
  beforeEach(() => {
    document.head.innerHTML = "";
    document.body.innerHTML = "";
  });

  it("applies a wire update's assets block once on the post-morph (afterCall) phase", () => {
    const rt = new LievitRuntime();
    installAssets(rt);

    const assets: AssetsBlock = {
      scripts: ["/lievit/module/Foo.lievit.ts"],
      headTags: ['<script src="https://cdn.example.com/chart.js"></script>'],
      styleModules: [{ component: "Widget", href: "/lievit/css/Widget?v=abc", hash: "abc" }],
    };
    rt.interceptors.morphed(outcomeWith(assets));

    expect(
      document.head.querySelectorAll('script[src="/lievit/module/Foo.lievit.ts"]'),
    ).toHaveLength(1);
    expect(
      document.head.querySelectorAll('script[src="https://cdn.example.com/chart.js"]'),
    ).toHaveLength(1);
    expect(document.head.querySelectorAll('link[rel="stylesheet"]')).toHaveLength(1);
  });

  it("dedups across repeated updates: the same asset loads exactly once", () => {
    const rt = new LievitRuntime();
    installAssets(rt);

    const assets: AssetsBlock = {
      scripts: ["/lievit/module/Foo.lievit.ts"],
      styleModules: [{ component: "Widget", href: "/lievit/css/Widget?v=abc", hash: "abc" }],
    };
    rt.interceptors.morphed(outcomeWith(assets));
    rt.interceptors.morphed(outcomeWith(assets)); // a later update re-sends the same block
    rt.interceptors.morphed(outcomeWith(assets));

    expect(
      document.head.querySelectorAll('script[src="/lievit/module/Foo.lievit.ts"]'),
    ).toHaveLength(1);
    expect(document.head.querySelectorAll('link[rel="stylesheet"]')).toHaveLength(1);
  });

  it("stamps the page CSP nonce on the injected script and link when present", () => {
    const rt = new LievitRuntime();
    installAssets(rt);

    const assets: AssetsBlock = {
      scripts: ["/lievit/module/Foo.lievit.ts"],
      styleModules: [{ component: "Foo", href: "/lievit/css/Foo?v=1", hash: "1" }],
    };
    rt.interceptors.morphed(outcomeWith(assets, "n0nce"));

    expect(document.head.querySelector("script")?.getAttribute("nonce")).toBe("n0nce");
    expect(document.head.querySelector("link")?.getAttribute("nonce")).toBe("n0nce");
  });

  it("is a no-op when the update carries no assets block", () => {
    const rt = new LievitRuntime();
    installAssets(rt);

    rt.interceptors.morphed(outcomeWith(null));

    expect(document.head.children).toHaveLength(0);
  });
});
