/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
import { beforeEach, describe, expect, it } from "vitest";

import { applyAssets, type AssetsBlock } from "../runtime/features/assets.js";

describe("applyAssets (#171/#119/#129)", () => {
  beforeEach(() => {
    document.head.innerHTML = "";
    document.body.innerHTML = "";
  });

  it("loads a per-component module once as an external script[type=module]", () => {
    const assets: AssetsBlock = { scripts: ["/lievit/module/Foo.lievit.ts"] };

    applyAssets(assets);
    applyAssets(assets); // a later update re-sends the same asset; it must not double-load

    const scripts = document.head.querySelectorAll('script[src="/lievit/module/Foo.lievit.ts"]');
    expect(scripts).toHaveLength(1);
    expect(scripts[0].getAttribute("type")).toBe("module");
  });

  it("injects an @assets head tag once, verbatim", () => {
    const tag = '<script src="https://cdn.example.com/chart.js"></script>';
    const assets: AssetsBlock = { headTags: [tag] };

    applyAssets(assets);
    applyAssets(assets);

    const cdnScripts = document.head.querySelectorAll(
      'script[src="https://cdn.example.com/chart.js"]',
    );
    expect(cdnScripts).toHaveLength(1);
  });

  it("refuses an inline <script> head tag (strict CSP: no inline script)", () => {
    applyAssets({ headTags: ["<script>alert(1)</script>"] });

    expect(document.head.querySelector("script")).toBeNull();
  });

  it("injects a scoped-CSS <link> with the cache-busting href, once per component", () => {
    const assets: AssetsBlock = {
      styleModules: [{ component: "com.acme.Widget", href: "/lievit/css/com.acme.Widget?v=abc", hash: "abc" }],
    };

    applyAssets(assets);
    applyAssets(assets);

    const links = document.head.querySelectorAll('link[rel="stylesheet"]');
    expect(links).toHaveLength(1);
    expect(links[0].getAttribute("href")).toBe("/lievit/css/com.acme.Widget?v=abc");
  });

  it("re-fetches the stylesheet when the content hash changes (cache-busting)", () => {
    applyAssets({
      styleModules: [{ component: "Widget", href: "/lievit/css/Widget?v=old", hash: "old" }],
    });
    applyAssets({
      styleModules: [{ component: "Widget", href: "/lievit/css/Widget?v=new", hash: "new" }],
    });

    const links = document.head.querySelectorAll('link[rel="stylesheet"]');
    expect(links).toHaveLength(1);
    expect(links[0].getAttribute("href")).toBe("/lievit/css/Widget?v=new");
  });

  it("stamps a CSP nonce on the injected script and link when supplied", () => {
    applyAssets(
      {
        scripts: ["/lievit/module/Foo.lievit.ts"],
        styleModules: [{ component: "Foo", href: "/lievit/css/Foo?v=1", hash: "1" }],
      },
      document,
      "n0nce",
    );

    expect(document.head.querySelector("script")?.getAttribute("nonce")).toBe("n0nce");
    expect(document.head.querySelector("link")?.getAttribute("nonce")).toBe("n0nce");
  });

  it("is a no-op for a missing block", () => {
    applyAssets(null);
    applyAssets(undefined);
    expect(document.head.children).toHaveLength(0);
  });
});
