/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LievitRuntime } from "../runtime/runtime.js";
import { installUploads, type TempFileRef, type UploadTransport } from "../runtime/features/uploads.js";

/**
 * Re-entrancy regression for file uploads (#9). A second file pick before the first upload settles
 * must (a) ABORT the first run's controller (else it is orphaned + uncancellable), and (b) DROP the
 * first run's `setModel` if it resolves late (an out-of-order write would clobber `@Wire` with stale
 * refs). Driven against the real `installUploads` directive + the real runtime in happy-dom.
 */

/** Encodes a `wire` object into a JWT-like snapshot the runtime's `decodeWire` can read. */
function snapshotWith(wire: Record<string, unknown>): string {
  const payload = btoa(JSON.stringify({ cid: "cid", cls: "C", wire }))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return `h.${payload}.sig`;
}

/** A transport whose successive uploads are resolved by hand, recording each run's abort signal. */
function controllableTransport() {
  const runs: Array<{ signal: AbortSignal; resolve: (refs: TempFileRef[]) => void }> = [];
  const transport: UploadTransport = {
    upload: (_files, _onProgress, signal) =>
      new Promise<TempFileRef[]>((resolve) => {
        runs.push({ signal, resolve });
      }),
  };
  return { transport, runs };
}

function setFiles(input: HTMLInputElement, name: string): void {
  Object.defineProperty(input, "files", {
    value: [new File(["x"], name, { type: "image/png" })],
    configurable: true,
  });
}

describe("file upload re-entrancy (#9)", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("a second pick aborts the first run's controller (the first is not orphaned)", async () => {
    document.body.innerHTML =
      `<div data-lievit-component="C" data-lievit-id="cid" data-lievit-snapshot="${snapshotWith({ photo: null })}">` +
      `<input type="file" l:upload="photo"></div>`;
    const rt = new LievitRuntime({ fetchImpl: vi.fn() });
    const { transport, runs } = controllableTransport();
    installUploads(rt, { transport });
    rt.start();

    const input = document.querySelector("input") as HTMLInputElement;
    setFiles(input, "first.png");
    input.dispatchEvent(new Event("change"));
    await vi.waitFor(() => expect(runs.length).toBe(1));
    expect(runs[0].signal.aborted).toBe(false);

    // A second pick before the first resolves: the first run's controller MUST be aborted.
    setFiles(input, "second.png");
    input.dispatchEvent(new Event("change"));
    await vi.waitFor(() => expect(runs.length).toBe(2));

    expect(runs[0].signal.aborted, "the first upload was aborted by the second pick").toBe(true);
    expect(runs[1].signal.aborted, "the second (current) upload is live").toBe(false);
  });

  it("a slow first run resolving AFTER a second pick does not clobber @Wire with its stale ref", async () => {
    document.body.innerHTML =
      `<div data-lievit-component="C" data-lievit-id="cid" data-lievit-snapshot="${snapshotWith({ photo: null })}">` +
      `<input type="file" l:upload="photo"></div>`;
    const rt = new LievitRuntime({ fetchImpl: vi.fn() });
    const { transport, runs } = controllableTransport();
    installUploads(rt, { transport });
    rt.start();

    const input = document.querySelector("input") as HTMLInputElement;
    const root = document.body.firstElementChild as HTMLElement;

    setFiles(input, "first.png");
    input.dispatchEvent(new Event("change"));
    await vi.waitFor(() => expect(runs.length).toBe(1));

    setFiles(input, "second.png");
    input.dispatchEvent(new Event("change"));
    await vi.waitFor(() => expect(runs.length).toBe(2));

    // The SECOND run resolves first and writes its ref.
    runs[1].resolve([{ path: "tmp/second", name: "second.png", size: 2, mime: "image/png" }]);
    await vi.waitFor(() =>
      expect((rt.$lievit(root)!.$get("photo") as TempFileRef | null)?.path).toBe("tmp/second"),
    );

    // Now the SLOW first run resolves LATE. Its stale ref must be dropped (it was superseded), so the
    // @Wire value stays the second run's ref, not an out-of-order overwrite.
    runs[0].resolve([{ path: "tmp/first", name: "first.png", size: 1, mime: "image/png" }]);
    await Promise.resolve();
    await Promise.resolve();

    expect((rt.$lievit(root)!.$get("photo") as TempFileRef | null)?.path).toBe("tmp/second");
  });
});
