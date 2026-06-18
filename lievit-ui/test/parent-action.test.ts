/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LievitRuntime } from "../runtime/runtime.js";

/** A snapshot whose middle base64url segment carries `{ wire }`. */
function snapshotWith(wire: Record<string, unknown>): string {
  const payload = { wire };
  const b64 = btoa(JSON.stringify(payload)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `header.${b64}.sig`;
}

/** A parent component with a child button that drives the parent via `$parent.increment()`. */
function mountParentChild(): { parent: HTMLElement; child: HTMLElement } {
  document.body.innerHTML =
    `<div data-lievit-component="Parent" data-lievit-id="parent-cid" data-lievit-snapshot="${snapshotWith(
      { count: 0 },
    )}">` +
    `<div data-lievit-component="Child" data-lievit-id="child-cid" data-lievit-snapshot="${snapshotWith(
      {},
    )}">` +
    '<button l:click="$parent.increment()">+ parent</button>' +
    "</div></div>";
  const parent = document.body.firstElementChild as HTMLElement;
  const child = parent.firstElementChild as HTMLElement;
  return { parent, child };
}

describe("$parent action routing from a child (#67, ADR-0016 client half)", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("routes l:click=\"$parent.increment()\" to the parent's wire call", async () => {
    const { parent, child } = mountParentChild();
    const fetchImpl = vi.fn(async () =>
      new Response('<div data-lievit-component="Parent" data-lievit-id="parent-cid"></div>', {
        status: 200,
        headers: { "Lievit-Snapshot": snapshotWith({ count: 1 }) },
      }),
    );
    const runtime = new LievitRuntime({ fetchImpl });
    runtime.start();

    const button = child.querySelector("button")!;
    button.dispatchEvent(new Event("click", { bubbles: true }));

    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalled());
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    // The call hit the PARENT's endpoint, not the child's.
    expect(url).toContain("parent-cid");
    expect(url).not.toContain("child-cid");
    // and it invoked the parent's `increment` action.
    expect(JSON.parse(init.body as string)._calls).toEqual(["increment"]);
  });

  it("is a no-op when the component has no parent (undefined at the root)", async () => {
    document.body.innerHTML =
      `<div data-lievit-component="Root" data-lievit-id="root-cid" data-lievit-snapshot="${snapshotWith(
        {},
      )}">` +
      '<button l:click="$parent.increment()">+ parent</button></div>';
    const root = document.body.firstElementChild as HTMLElement;
    const fetchImpl = vi.fn(async () => new Response("", { status: 200 }));
    const runtime = new LievitRuntime({ fetchImpl });
    runtime.start();

    root.querySelector("button")!.dispatchEvent(new Event("click", { bubbles: true }));

    // No enclosing component to drive: nothing is sent.
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("ignores a bare $parent.prop read in an action position (no phantom call)", async () => {
    const { child } = (() => {
      document.body.innerHTML =
        `<div data-lievit-component="Parent" data-lievit-id="parent-cid" data-lievit-snapshot="${snapshotWith(
          { count: 0 },
        )}">` +
        `<div data-lievit-component="Child" data-lievit-id="child-cid" data-lievit-snapshot="${snapshotWith(
          {},
        )}">` +
        '<button l:click="$parent.count">read</button>' +
        "</div></div>";
      const parent = document.body.firstElementChild as HTMLElement;
      return { child: parent.firstElementChild as HTMLElement };
    })();
    const fetchImpl = vi.fn(async () => new Response("", { status: 200 }));
    const runtime = new LievitRuntime({ fetchImpl });
    runtime.start();

    child.querySelector("button")!.dispatchEvent(new Event("click", { bubbles: true }));

    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
