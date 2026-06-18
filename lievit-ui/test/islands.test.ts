/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
import { beforeEach, describe, expect, it } from "vitest";

import {
  islandCloseMarker,
  islandOpenMarker,
  morphIslands,
  parseIslands,
} from "../runtime/islands.js";

/** Wraps inner HTML in the island comment markers (the server-side contract). */
function island(name: string, inner: string): string {
  return `<!--${islandOpenMarker(name)}-->${inner}<!--${islandCloseMarker(name)}-->`;
}

describe("islands (ADR-0024 #89)", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("parses each island fragment out of comment markers", () => {
    const html = `<div>${island("counter", "<span>1</span>")}${island("clock", "<time>now</time>")}</div>`;
    const fragments = parseIslands(html);
    expect(fragments.map((f) => f.name)).toEqual(["counter", "clock"]);
    expect(fragments[0]!.html).toContain("<span>1</span>");
    expect(fragments[1]!.html).toContain("<time>now</time>");
  });

  it("morphs only the named island, leaving siblings untouched", () => {
    const root = document.createElement("div");
    root.setAttribute("data-lievit-component", "Demo");
    root.innerHTML = `<p id="outside">keep</p>${island("counter", "<span>1</span>")}`;
    document.body.appendChild(root);
    const outsideBefore = root.querySelector("#outside")!;

    morphIslands(root, parseIslands(island("counter", "<span>2</span>")));

    expect(root.querySelector("span")!.textContent).toBe("2"); // island updated
    expect(root.querySelector("#outside")).toBe(outsideBefore); // sibling node identity preserved
    expect(root.querySelector("#outside")!.textContent).toBe("keep");
  });

  it("isolates sibling islands: a fragment for one does not touch the other", () => {
    const root = document.createElement("div");
    root.setAttribute("data-lievit-component", "Demo");
    root.innerHTML = `${island("a", "<i>a1</i>")}${island("b", "<i>b1</i>")}`;
    document.body.appendChild(root);

    morphIslands(root, parseIslands(island("a", "<i>a2</i>")));

    const items = root.querySelectorAll("i");
    expect(items[0]!.textContent).toBe("a2"); // island a re-rendered
    expect(items[1]!.textContent).toBe("b1"); // island b untouched
  });

  it("appends in append mode, prepends in prepend mode", () => {
    const root = document.createElement("div");
    root.setAttribute("data-lievit-component", "Feed");
    root.innerHTML = island("feed", "<li>1</li>");
    document.body.appendChild(root);

    morphIslands(root, parseIslands(island("feed", "<li>2</li>")), "append");
    expect(Array.from(root.querySelectorAll("li")).map((l) => l.textContent)).toEqual(["1", "2"]);

    morphIslands(root, parseIslands(island("feed", "<li>0</li>")), "prepend");
    expect(Array.from(root.querySelectorAll("li")).map((l) => l.textContent)).toEqual([
      "0",
      "1",
      "2",
    ]);
  });

  it("renders an island once when the response repeats it (dedup, last wins)", () => {
    const root = document.createElement("div");
    root.setAttribute("data-lievit-component", "Demo");
    root.innerHTML = island("x", "<b>old</b>");
    document.body.appendChild(root);

    const repeated = island("x", "<b>first</b>") + island("x", "<b>second</b>");
    morphIslands(root, parseIslands(repeated));

    expect(root.querySelectorAll("b").length).toBe(1);
    expect(root.querySelector("b")!.textContent).toBe("second");
  });

  it("ignores a fragment naming an island not present in the live DOM", () => {
    const root = document.createElement("div");
    root.setAttribute("data-lievit-component", "Demo");
    root.innerHTML = island("present", "<u>here</u>");
    document.body.appendChild(root);

    expect(() => morphIslands(root, parseIslands(island("absent", "<u>nope</u>")))).not.toThrow();
    expect(root.querySelector("u")!.textContent).toBe("here");
  });
});
