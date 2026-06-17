/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LievitRuntime } from "../runtime/runtime.js";
import { installNavigate } from "../runtime/features/navigate.js";
import {
  applyStreamEnvelope,
  consumeStream,
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
});

describe("l:navigate (#155)", () => {
  it("intercepts an internal left-click, swaps the body, updates history, fires events", async () => {
    document.body.innerHTML = '<a href="/next" l:navigate>next</a><div id="here">A</div>';
    const nextHtml = "<html><body><a href=\"/\" l:navigate>home</a><div id=\"here\">B</div></body></html>";
    const fetchImpl = vi.fn(async () => new Response(nextHtml, { status: 200 })) as unknown as typeof fetch;
    const events: string[] = [];
    for (const e of ["lievit:navigate", "lievit:navigating", "lievit:navigated"]) {
      window.addEventListener(e, () => events.push(e));
    }
    const pushState = vi.spyOn(window.history, "pushState").mockImplementation(() => {});

    const rt = new LievitRuntime();
    installNavigate(rt, { fetchImpl });

    document.querySelector("a")!.dispatchEvent(new MouseEvent("click", { button: 0, bubbles: true, cancelable: true }));
    await new Promise((r) => setTimeout(r, 0));

    expect(fetchImpl).toHaveBeenCalled();
    expect(document.getElementById("here")!.textContent).toBe("B"); // body morphed
    expect(pushState).toHaveBeenCalled();
    expect(events).toContain("lievit:navigate");
    expect(events).toContain("lievit:navigated");
  });

  it("does not intercept a modified click (ctrl/meta) — lets the browser handle it", async () => {
    document.body.innerHTML = '<a href="/next" l:navigate>next</a>';
    const fetchImpl = vi.fn(async () => new Response("", { status: 200 })) as unknown as typeof fetch;
    const rt = new LievitRuntime();
    installNavigate(rt, { fetchImpl });

    document.querySelector("a")!.dispatchEvent(
      new MouseEvent("click", { button: 0, metaKey: true, bubbles: true, cancelable: true }),
    );
    await new Promise((r) => setTimeout(r, 0));

    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
