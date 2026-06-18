/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LievitRuntime } from "../runtime/runtime.js";

/** A snapshot whose middle base64url segment carries `{ wire }` (mirrors the parent-action test). */
function snapshotWith(wire: Record<string, unknown>): string {
  const payload = { wire };
  const b64 = btoa(JSON.stringify(payload))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return `header.${b64}.sig`;
}

function urlOf(call: unknown): string {
  return (call as [string])[0];
}

function bodyOf(call: unknown): Record<string, unknown> {
  const init = (call as [string, RequestInit])[1];
  return JSON.parse(init.body as string) as Record<string, unknown>;
}

/**
 * Mounts a parent component with a child whose root declares `lievit:on:<event>="<parentAction>"`
 * (the #69 marker the server stamps, ADR-0076). The child has a button that dispatches the event
 * server-side, the parent declares the listener.
 */
function mountParentWithListeningChild(listenerEvent: string, parentAction: string): {
  parent: HTMLElement;
  child: HTMLElement;
} {
  document.body.innerHTML =
    `<div data-lievit-component="Parent" data-lievit-id="parent-cid" data-lievit-snapshot="${snapshotWith(
      { rows: 0 },
    )}">` +
    `<div data-lievit-component="Child" data-lievit-id="child-cid" lievit:on:${listenerEvent}="${parentAction}" data-lievit-snapshot="${snapshotWith(
      {},
    )}">` +
    '<button l:click="save">save</button>' +
    "</div></div>";
  const parent = document.body.firstElementChild as HTMLElement;
  const child = parent.firstElementChild as HTMLElement;
  return { parent, child };
}

describe("nested-component event listener client glue (#69, ADR-0076)", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("routes a child-dispatched event to the parent's declared listener action", async () => {
    const { child } = mountParentWithListeningChild("saved", "addRow");
    const fetchImpl = vi.fn(async (input: URL | RequestInfo) => {
      const url = String(input);
      // The child's `save` action dispatches a global `saved` event.
      if (url.includes("child-cid")) {
        return new Response('<div data-lievit-component="Child" data-lievit-id="child-cid"></div>', {
          status: 200,
          headers: { "Lievit-Effects": '{"dispatch":[{"name":"saved","detail":{"id":7}}]}' },
        });
      }
      // The parent's `addRow` re-render.
      return new Response('<div data-lievit-component="Parent" data-lievit-id="parent-cid"></div>', {
        status: 200,
        headers: { "Lievit-Snapshot": snapshotWith({ rows: 1 }) },
      });
    });
    const runtime = new LievitRuntime({ fetchImpl });
    runtime.start();

    (child.querySelector("button") as HTMLElement).click();

    // The parent's listener action must be invoked as a wire call against the PARENT endpoint.
    await vi.waitFor(() => {
      const parentCall = fetchImpl.mock.calls.find(
        (c) => urlOf(c).includes("parent-cid") && (bodyOf(c)._calls as unknown[])?.length > 0,
      );
      expect(parentCall).toBeDefined();
    });
    const parentCall = fetchImpl.mock.calls.find(
      (c) => urlOf(c).includes("parent-cid") && (bodyOf(c)._calls as unknown[])?.length > 0,
    )!;
    expect(bodyOf(parentCall)._calls).toEqual(["addRow"]);
  });

  it("does not route when the dispatched event name does not match the listener", async () => {
    const { child } = mountParentWithListeningChild("saved", "addRow");
    const fetchImpl = vi.fn(async (input: URL | RequestInfo) => {
      const url = String(input);
      if (url.includes("child-cid")) {
        return new Response('<div data-lievit-component="Child" data-lievit-id="child-cid"></div>', {
          status: 200,
          headers: { "Lievit-Effects": '{"dispatch":[{"name":"deleted","detail":{}}]}' },
        });
      }
      return new Response('<div data-lievit-component="Parent" data-lievit-id="parent-cid"></div>', {
        status: 200,
      });
    });
    const runtime = new LievitRuntime({ fetchImpl });
    runtime.start();

    (child.querySelector("button") as HTMLElement).click();

    await new Promise((resolve) => setTimeout(resolve, 20));
    const parentActionCall = fetchImpl.mock.calls.find(
      (c) => urlOf(c).includes("parent-cid") && (bodyOf(c)._calls as unknown[])?.length > 0,
    );
    expect(parentActionCall).toBeUndefined();
  });

  it("is a no-op when a child without a listener marker dispatches the event", async () => {
    document.body.innerHTML =
      `<div data-lievit-component="Parent" data-lievit-id="parent-cid" data-lievit-snapshot="${snapshotWith(
        {},
      )}">` +
      `<div data-lievit-component="Child" data-lievit-id="child-cid" data-lievit-snapshot="${snapshotWith(
        {},
      )}">` +
      '<button l:click="save">save</button></div></div>';
    const child = (document.body.firstElementChild as HTMLElement)
      .firstElementChild as HTMLElement;
    const fetchImpl = vi.fn(async (input: URL | RequestInfo) => {
      if (String(input).includes("child-cid")) {
        return new Response('<div data-lievit-component="Child" data-lievit-id="child-cid"></div>', {
          status: 200,
          headers: { "Lievit-Effects": '{"dispatch":[{"name":"saved","detail":{}}]}' },
        });
      }
      return new Response('<div data-lievit-component="Parent" data-lievit-id="parent-cid"></div>', {
        status: 200,
      });
    });
    const runtime = new LievitRuntime({ fetchImpl });
    runtime.start();

    (child.querySelector("button") as HTMLElement).click();

    await new Promise((resolve) => setTimeout(resolve, 20));
    const parentActionCall = fetchImpl.mock.calls.find(
      (c) => urlOf(c).includes("parent-cid") && (bodyOf(c)._calls as unknown[])?.length > 0,
    );
    expect(parentActionCall).toBeUndefined();
  });
});
