/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  applyStreamEnvelope,
  consumeStream,
  openStreamCall,
  parseSseFrames,
  parseStreamEnvelope,
  type StreamSource,
} from "../runtime/features/stream.js";
import {
  evaluateShowExpression,
  parseShowExpression,
  ShowExpressionError,
} from "../runtime/features/show-expression.js";

beforeEach(() => {
  document.body.innerHTML = "";
});

describe("l:show expression grammar (#79, CSP-safe, no eval)", () => {
  it("parses and evaluates truthiness, negation, and comparison", () => {
    expect(evaluateShowExpression(parseShowExpression("open"), { open: true })).toBe(true);
    expect(evaluateShowExpression(parseShowExpression("!open"), { open: true })).toBe(false);
    expect(evaluateShowExpression(parseShowExpression("tab == 'a'"), { tab: "a" })).toBe(true);
    expect(evaluateShowExpression(parseShowExpression("tab != 'a'"), { tab: "b" })).toBe(true);
    expect(evaluateShowExpression(parseShowExpression("count == 3"), { count: "3" })).toBe(true);
  });

  it("coerces form-string falsy values", () => {
    expect(evaluateShowExpression(parseShowExpression("v"), { v: "false" })).toBe(false);
    expect(evaluateShowExpression(parseShowExpression("v"), { v: "" })).toBe(false);
    expect(evaluateShowExpression(parseShowExpression("v"), { v: "x" })).toBe(true);
  });

  it("rejects anything outside the grammar (no member access / calls)", () => {
    expect(() => parseShowExpression("a.b")).toThrow(ShowExpressionError);
    expect(() => parseShowExpression("alert(1)")).toThrow(ShowExpressionError);
    expect(() => parseShowExpression("")).toThrow(ShowExpressionError);
  });
});

describe("streaming (#153)", () => {
  it("parses valid envelopes and rejects non-envelopes", () => {
    expect(parseStreamEnvelope('{"target":"out","content":"hi","replace":true}')).toEqual({
      target: "out",
      content: "hi",
      replace: true,
    });
    expect(parseStreamEnvelope("not json")).toBeNull();
    expect(parseStreamEnvelope('{"target":1}')).toBeNull();
  });

  it("appends by default and replaces on demand, streaming falsy content", () => {
    document.body.innerHTML = '<div><span l:stream="out">a</span></div>';
    const root = document.body;
    applyStreamEnvelope(root, { target: "out", content: "b" });
    expect(document.querySelector("span")!.textContent).toBe("ab");
    applyStreamEnvelope(root, { target: "out", content: "" }); // falsy, still applied (append)
    expect(document.querySelector("span")!.textContent).toBe("ab");
    applyStreamEnvelope(root, { target: "out", content: "c", replace: true });
    expect(document.querySelector("span")!.textContent).toBe("c");
  });

  it("consumeStream writes a sequence incrementally", () => {
    document.body.innerHTML = '<div><span l:stream="out"></span></div>';
    let handler: ((data: string) => void) | undefined;
    const source: StreamSource = {
      onMessage: (h) => {
        handler = h;
        return () => {};
      },
    };
    consumeStream(document.body, source);
    handler?.('{"target":"out","content":"He"}');
    handler?.('{"target":"out","content":"llo"}');
    expect(document.querySelector("span")!.textContent).toBe("Hello");
  });

  it("parseSseFrames extracts complete data: payloads and keeps a partial tail", () => {
    const first = parseSseFrames('data:{"a":1}\n\ndata:{"b":2}\n\ndata:{"c":3}');
    expect(first.payloads).toEqual(['{"a":1}', '{"b":2}']);
    expect(first.rest).toBe('data:{"c":3}'); // partial frame, not yet terminated

    const second = parseSseFrames(first.rest + "\n\n");
    expect(second.payloads).toEqual(['{"c":3}']);
    expect(second.rest).toBe("");
  });

  it("openStreamCall POSTs the snapshot and writes the streamed SSE body into l:stream (#153)", async () => {
    document.body.innerHTML =
      '<div><span l:stream="out"></span><span l:stream="status"></span></div>';
    const sse =
      'data:{"target":"out","content":"Hello "}\n\n' +
      'data:{"target":"out","content":"world"}\n\n' +
      'data:{"target":"status","content":"done","replace":true}\n\n';
    const fetchImpl = vi.fn(async () => new Response(sse, {
      status: 200,
      headers: { "Content-Type": "text/event-stream" },
    }));

    await openStreamCall(document.body, "cid", { snapshot: "s1", calls: ["generate"], fetchImpl });

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/lievit/cid/stream");
    expect((init.headers as Record<string, string>)["X-Lievit"]).toBe("1");
    expect(JSON.parse(init.body as string)).toEqual({ _snapshot: "s1", _calls: ["generate"] });
    expect(document.querySelector('[l\\:stream="out"]')!.textContent).toBe("Hello world");
    expect(document.querySelector('[l\\:stream="status"]')!.textContent).toBe("done");
  });
});

// l:navigate moved to Turbo Drive (ADR-0085): the SPA-navigation tests now live in
// `navigate-turbo.test.ts` (the wire-rebind glue + the Turbo→lievit event bridge). The old
// hand-rolled fetch/morph/history tests were deleted with `navigate.ts`'s implementation.
