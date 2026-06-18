/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
import { beforeEach, describe, expect, it } from "vitest";

import { LievitRuntime } from "../runtime/runtime.js";

/** A snapshot whose middle base64url segment carries `{ wire }` (the memo lives under `@memo`). */
function snapshotWith(wire: Record<string, unknown>): string {
  const payload = { wire };
  const b64 = btoa(JSON.stringify(payload)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `header.${b64}.sig`;
}

function mount(snapshot: string): HTMLElement {
  document.body.innerHTML =
    `<div data-lievit-component="Widget" data-lievit-id="cid" data-lievit-snapshot="${snapshot}">` +
    "<span>x</span></div>";
  return document.body.firstElementChild as HTMLElement;
}

describe("@LievitIsolate flag read off the snapshot memo (#61, ADR-0075)", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("reads isolate:true from the snapshot memo", () => {
    const root = mount(snapshotWith({ count: 0, "@memo": { isolate: true } }));
    const runtime = new LievitRuntime();
    runtime.start();

    expect(runtime.isIsolated(root)).toBe(true);
  });

  it("is false for a plain component with no isolate memo", () => {
    const root = mount(snapshotWith({ count: 0 }));
    const runtime = new LievitRuntime();
    runtime.start();

    expect(runtime.isIsolated(root)).toBe(false);
  });

  it("is false for an element outside any component", () => {
    const orphan = document.createElement("div");
    document.body.appendChild(orphan);
    const runtime = new LievitRuntime();
    runtime.start();

    expect(runtime.isIsolated(orphan)).toBe(false);
  });
});
