/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
import { describe, expect, it, vi } from "vitest";

import { send, wireEndpoint } from "../runtime/wire.js";

function okResponse(html: string, headers: Record<string, string>): Response {
  return new Response(html, { status: 200, headers });
}

describe("wire transport (wire-protocol §1/§4)", () => {
  it("builds the endpoint path for a component id", () => {
    expect(wireEndpoint("01ABC")).toBe("/lievit/01ABC/call");
  });

  it("POSTs the snapshot and omits empty _updates/_calls", async () => {
    const fetchImpl = vi.fn(async () => okResponse("<div></div>", { "Lievit-Snapshot": "s2" }));

    await send("cid", { snapshot: "s1", updates: {}, calls: [] }, { fetchImpl });

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/lievit/cid/call");
    expect(JSON.parse(init.body as string)).toEqual({ _snapshot: "s1" });
  });

  it("sends _updates and _calls when present and the CSRF header", async () => {
    const fetchImpl = vi.fn(async () => okResponse("<div></div>", { "Lievit-Snapshot": "s2" }));

    await send(
      "cid",
      { snapshot: "s1", updates: { name: "ada" }, calls: ["save"] },
      { fetchImpl, csrfToken: "tok" },
    );

    const init = (fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect(JSON.parse(init.body as string)).toEqual({
      _snapshot: "s1",
      _updates: { name: "ada" },
      _calls: ["save"],
    });
    expect((init.headers as Record<string, string>)["X-CSRF-TOKEN"]).toBe("tok");
  });

  it("passes an abort signal to fetch so an in-flight call can be cancelled (#95)", async () => {
    const fetchImpl = vi.fn(async () => okResponse("<div></div>", { "Lievit-Snapshot": "s2" }));
    const controller = new AbortController();

    await send("cid", { snapshot: "s1", updates: {}, calls: [] }, { fetchImpl, signal: controller.signal });

    const init = (fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect(init.signal).toBe(controller.signal);
  });

  it("encodes a large binary update as a base64 envelope, no overflow (#135)", async () => {
    const fetchImpl = vi.fn(async () => okResponse("<div></div>", { "Lievit-Snapshot": "s2" }));
    const blob = new Uint8Array(300 * 1024).fill(7);

    await expect(
      send("cid", { snapshot: "s1", updates: { blob }, calls: [] }, { fetchImpl }),
    ).resolves.toBeTruthy();

    const init = (fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1];
    const sent = JSON.parse(init.body as string) as { _updates: { blob: Record<string, string> } };
    // The byte array rode as a tagged base64 string, not a lossy {"0":..} object.
    expect(typeof sent._updates.blob.__lievit_b64).toBe("string");
    expect(sent._updates.blob.__lievit_b64.length).toBeGreaterThan(0);
  });

  it("decodes a 200 into html + snapshot + effects", async () => {
    const fetchImpl = vi.fn(async () =>
      okResponse("<div>1</div>", {
        "Lievit-Snapshot": "s2",
        "Lievit-Effects": '{"redirect":"/done"}',
      }),
    );

    const res = await send("cid", { snapshot: "s1", updates: {}, calls: ["go"] }, { fetchImpl });

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.html).toBe("<div>1</div>");
      expect(res.snapshot).toBe("s2");
      expect(res.effects?.redirect).toBe("/done");
    }
  });

  it("returns a fail-closed failure on a non-200, carrying status + reason + remount flag", async () => {
    const fetchImpl = vi.fn(
      async () => new Response("", { status: 409, headers: { "Lievit-Reason": "snapshot-expired" } }),
    );

    const res = await send("cid", { snapshot: "s1", updates: {}, calls: ["go"] }, { fetchImpl });

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.status).toBe(409);
      expect(res.reason).toBe("snapshot-expired");
      expect(res.remount).toBe(true); // 409/410 → re-mount
    }
  });

  it("does not flag remount for a non-409/410 failure", async () => {
    const fetchImpl = vi.fn(
      async () => new Response("", { status: 403, headers: { "Lievit-Reason": "locked-property" } }),
    );
    const res = await send("cid", { snapshot: "s1", updates: {}, calls: ["go"] }, { fetchImpl });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.remount).toBe(false);
    }
  });
});
