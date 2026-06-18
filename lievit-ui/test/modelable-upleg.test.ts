/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LievitRuntime } from "../runtime/runtime.js";

/** A snapshot whose middle base64url segment carries `{ wire }`. */
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
 * Mounts a parent component binding `title` to a modelable child field `value`. The server stamps
 * `lievit:modelable="value:title"` on the child root (ADR-0016): childField:parentProp. The child
 * has a model input bound to its `value` field, plus a button that commits the parent.
 */
function mountModelablePair(): { parent: HTMLElement; child: HTMLElement } {
  document.body.innerHTML =
    `<div data-lievit-component="Parent" data-lievit-id="parent-cid" data-lievit-snapshot="${snapshotWith(
      { title: "" },
    )}">` +
    `<div data-lievit-component="Child" data-lievit-id="child-cid" lievit:modelable="value:title" data-lievit-snapshot="${snapshotWith(
      { value: "" },
    )}">` +
    '<input l:model="value">' +
    '<button l:click="$parent.save()">save parent</button>' +
    "</div></div>";
  const parent = document.body.firstElementChild as HTMLElement;
  const child = parent.firstElementChild as HTMLElement;
  return { parent, child };
}

describe("modelable child -> parent up-leg client glue (#69 / ADR-0016)", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("propagates the child's modelable field edit to the parent's bound prop on the parent's next call", async () => {
    const { parent, child } = mountModelablePair();
    const fetchImpl = vi.fn(async () =>
      new Response('<div data-lievit-component="Parent" data-lievit-id="parent-cid"></div>', {
        status: 200,
        headers: { "Lievit-Snapshot": snapshotWith({ title: "hello" }) },
      }),
    );
    const runtime = new LievitRuntime({ fetchImpl });
    runtime.start();

    // The user edits the child's modelable field.
    const input = child.querySelector("input") as HTMLInputElement;
    input.value = "hello";
    input.dispatchEvent(new Event("input", { bubbles: true }));

    // Then commits the parent (the next parent call must carry the propagated value).
    (parent.querySelector("button") as HTMLElement).click();

    await vi.waitFor(() => {
      const parentCall = fetchImpl.mock.calls.find((c) => urlOf(c).includes("parent-cid"));
      expect(parentCall).toBeDefined();
    });
    const parentCall = fetchImpl.mock.calls.find((c) => urlOf(c).includes("parent-cid"))!;
    expect((bodyOf(parentCall)._updates as Record<string, unknown>).title).toBe("hello");
  });

  it("does not propagate when the edited field is not the modelable field", async () => {
    document.body.innerHTML =
      `<div data-lievit-component="Parent" data-lievit-id="parent-cid" data-lievit-snapshot="${snapshotWith(
        { title: "" },
      )}">` +
      `<div data-lievit-component="Child" data-lievit-id="child-cid" lievit:modelable="value:title" data-lievit-snapshot="${snapshotWith(
        { value: "", other: "" },
      )}">` +
      '<input l:model="other">' +
      '<button l:click="$parent.save()">save parent</button>' +
      "</div></div>";
    const parent = document.body.firstElementChild as HTMLElement;
    const child = parent.firstElementChild as HTMLElement;
    const fetchImpl = vi.fn(async () =>
      new Response('<div data-lievit-component="Parent" data-lievit-id="parent-cid"></div>', {
        status: 200,
      }),
    );
    const runtime = new LievitRuntime({ fetchImpl });
    runtime.start();

    const input = child.querySelector("input") as HTMLInputElement;
    input.value = "x";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    (parent.querySelector("button") as HTMLElement).click();

    await vi.waitFor(() => {
      const parentCall = fetchImpl.mock.calls.find((c) => urlOf(c).includes("parent-cid"));
      expect(parentCall).toBeDefined();
    });
    const parentCall = fetchImpl.mock.calls.find((c) => urlOf(c).includes("parent-cid"))!;
    const updates = (bodyOf(parentCall)._updates ?? {}) as Record<string, unknown>;
    expect(updates.title).toBeUndefined();
  });
});
