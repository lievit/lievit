/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LievitRuntime } from "../runtime/runtime.js";
import { lievitObject } from "../runtime/lievit-object.js";

describe("$lievit object unit (ADR-0030 magic actions, client half)", () => {
  it("delegates $get/$set/$call/$refresh/$watch to the deps and exposes $parent", () => {
    const root = document.createElement("div");
    const calls: string[] = [];
    const parentObj = { $get: () => "p" } as never;
    const obj = lievitObject(root, {
      get: (_el, field) => `value-of-${field}`,
      set: (_el, field, value) => calls.push(`set:${field}=${String(value)}`),
      call: (_el, action, args) => calls.push(`call:${action}(${args.join(",")})`),
      refresh: () => calls.push("refresh"),
      parent: () => parentObj,
      watch: (_r, field) => {
        calls.push(`watch:${field}`);
        return () => calls.push(`unwatch:${field}`);
      },
    });

    expect(obj.$get("count")).toBe("value-of-count");
    obj.$set("count", 5);
    obj.$call("increment", 2);
    obj.$refresh();
    const off = obj.$watch("count", () => {});
    off();
    expect(obj.$parent).toBe(parentObj);

    expect(calls).toEqual([
      "set:count=5",
      "call:increment(2)",
      "refresh",
      "watch:count",
      "unwatch:count",
    ]);
  });
});

function mountCounter(snapshot: string): HTMLElement {
  document.body.innerHTML =
    `<div data-lievit-component="com.example.Counter" data-lievit-id="cid" data-lievit-snapshot="${snapshot}">` +
    '<input l:model="name" /><button l:click="increment">+</button></div>';
  return document.body.firstElementChild as HTMLElement;
}

/** A snapshot whose middle base64url segment carries `{ wire: { count: 1, name: "ada" } }`. */
function snapshotWith(wire: Record<string, unknown>): string {
  const payload = { wire };
  const b64 = btoa(JSON.stringify(payload)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `header.${b64}.sig`;
}

describe("$lievit object integration on the runtime", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("$get reads the ephemeral value seeded from the snapshot", () => {
    const root = mountCounter(snapshotWith({ count: 3, name: "ada" }));
    const runtime = new LievitRuntime();
    runtime.start();

    const $c = runtime.$lievit(root)!;
    expect($c.$get("count")).toBe(3);
    expect($c.$get("name")).toBe("ada");
  });

  it("$set commits a model update and a $watch observes it", async () => {
    const root = mountCounter(snapshotWith({ name: "" }));
    const fetchImpl = vi.fn(async () =>
      new Response('<div data-lievit-component="com.example.Counter" data-lievit-id="cid"></div>', {
        status: 200,
        headers: { "Lievit-Snapshot": snapshotWith({ name: "bob" }) },
      }),
    );
    const runtime = new LievitRuntime({ fetchImpl });
    runtime.start();

    const $c = runtime.$lievit(root)!;
    const seen: unknown[] = [];
    $c.$watch("name", (v) => seen.push(v));
    $c.$set("name", "bob");

    // $set fired the watcher synchronously and queued a commit.
    expect(seen).toEqual(["bob"]);
    expect($c.$get("name")).toBe("bob");
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalled());
    const init = (fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect(JSON.parse(init.body as string)._updates).toEqual({ name: "bob" });
  });

  it("$parent resolves the enclosing component, null at the top", () => {
    document.body.innerHTML =
      '<div data-lievit-component="Parent" data-lievit-id="p" data-lievit-snapshot="sp">' +
      '<div data-lievit-component="Child" data-lievit-id="c" data-lievit-snapshot="sc">' +
      "<span>child</span></div></div>";
    const parent = document.body.firstElementChild as HTMLElement;
    const child = parent.firstElementChild as HTMLElement;
    const runtime = new LievitRuntime();
    runtime.start();

    expect(runtime.$lievit(child)!.$parent).not.toBeNull();
    expect(runtime.$lievit(parent)!.$parent).toBeNull();
  });

  it("returns null for an element outside any component", () => {
    const orphan = document.createElement("div");
    document.body.appendChild(orphan);
    const runtime = new LievitRuntime();
    runtime.start();

    expect(runtime.$lievit(orphan)).toBeNull();
  });
});
