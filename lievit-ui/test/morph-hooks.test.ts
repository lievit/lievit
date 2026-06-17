/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
import { beforeEach, describe, expect, it } from "vitest";

import { type MorphHooks, morph } from "../runtime/morph.js";

describe("morph hooks (ADR-0019 seam for l:ignore / l:transition)", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("skip mode leaves an element and its subtree untouched", () => {
    document.body.innerHTML = '<div id="root"><div id="map">live-edited</div></div>';
    const root = document.getElementById("root")!;
    const hooks: MorphHooks = {
      elementMode: (oldEl) => (oldEl.id === "map" ? "skip" : undefined),
    };

    morph(root, '<div id="root"><div id="map">server-version</div></div>', hooks);

    expect(document.getElementById("map")!.textContent).toBe("live-edited");
  });

  it("self mode reconciles the element but freezes its children", () => {
    document.body.innerHTML = '<div id="root"><section data-x="1"><span>old</span></section></div>';
    const root = document.getElementById("root")!;
    const hooks: MorphHooks = {
      elementMode: (oldEl) => (oldEl.tagName === "SECTION" ? "self" : undefined),
    };

    morph(root, '<div id="root"><section data-x="2"><span>new</span></section></div>', hooks);

    const section = root.querySelector("section")!;
    expect(section.getAttribute("data-x")).toBe("2"); // own attributes morphed
    expect(section.querySelector("span")!.textContent).toBe("old"); // children frozen
  });

  it("children mode morphs the children but freezes the element's own attributes", () => {
    document.body.innerHTML = '<div id="root"><section data-x="1"><span>old</span></section></div>';
    const root = document.getElementById("root")!;
    const hooks: MorphHooks = {
      elementMode: (oldEl) => (oldEl.tagName === "SECTION" ? "children" : undefined),
    };

    morph(root, '<div id="root"><section data-x="2"><span>new</span></section></div>', hooks);

    const section = root.querySelector("section")!;
    expect(section.getAttribute("data-x")).toBe("1"); // own attributes frozen
    expect(section.querySelector("span")!.textContent).toBe("new"); // children morphed
  });

  it("beforeRemove can claim a leftover node so the morph leaves it in place", () => {
    document.body.innerHTML = '<div id="root"><p id="leaving">x</p></div>';
    const root = document.getElementById("root")!;
    const claimed: Node[] = [];
    const hooks: MorphHooks = {
      beforeRemove: (node) => {
        claimed.push(node);
        return true; // the feature will remove it itself later (e.g. after an out transition)
      },
    };

    morph(root, '<div id="root"></div>', hooks);

    expect(claimed).toHaveLength(1);
    expect(document.getElementById("leaving")).not.toBeNull(); // not removed by the morph
  });

  it("without hooks the plain morph removes leftover nodes (unchanged behavior)", () => {
    document.body.innerHTML = '<div id="root"><p id="gone">x</p></div>';
    const root = document.getElementById("root")!;

    morph(root, '<div id="root"></div>');

    expect(document.getElementById("gone")).toBeNull();
  });
});
