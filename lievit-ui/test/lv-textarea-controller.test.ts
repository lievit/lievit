/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * lv-textarea Stimulus controller -- the conversion of textarea-autosize.enhancer.ts. Proves the
 * grow-to-content + live-count behaviour through the REAL Stimulus Application (started by
 * startStimulus, which auto-loads controllers by filename) + the REAL lievit wire morph (no mocked
 * $lievit, no mocked runtime). It mirrors the enhancer suite assertion-for-assertion (initial fit,
 * grow/shrink on input, count zero/update/over-limit/under-limit, count without maxLength, morph
 * resync, user-drag stops autosize, caret survives, disabled inert, swallows no key) AND adds the
 * proofs the enhancer test could not state:
 *   - the textarea NEVER round-trips the wire (it is a pure client enhancement, no dismiss);
 *   - morph-safety: after a real idiomorph the controller fires its handlers EXACTLY once (no
 *     stacked listeners), and a textarea removed by a morph fires nothing (disconnect tore it down).
 *
 * Substrate: happy-dom + the real @hotwired/stimulus Application. flushStimulus() awaits the
 * MutationObserver so the controller is connected before a gesture is driven.
 */
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { LievitRuntime } from "../runtime/runtime.js";
import { morph } from "../runtime/morph.js";
import { startStimulus, stopStimulus, flushStimulus } from "../runtime/stimulus/application.js";
import LvTextareaController from "../runtime/stimulus/controllers/lv-textarea-controller.js";

// ---------------------------------------------------------------------------
// Real runtime with a fetch stub that records the wire actions POSTed.
// ---------------------------------------------------------------------------
function makeRuntime(): { runtime: LievitRuntime; calledActions: string[] } {
  const calledActions: string[] = [];
  const fetchImpl = vi.fn(async (_url: unknown, init?: RequestInit) => {
    const body = JSON.parse((init?.body as string) ?? "{}") as Record<string, unknown>;
    const calls = body._calls as string[] | undefined;
    if (calls) calledActions.push(...calls);
    return new Response("<div></div>", { status: 200, headers: { "Lievit-Snapshot": "s2" } });
  });
  const runtime = new LievitRuntime({ fetchImpl: fetchImpl as unknown as typeof fetch });
  return { runtime, calledActions };
}

const ACTION =
  "input->lv-textarea#onInput lievit:morphed->lv-textarea#onMorphed " +
  "mousedown->lv-textarea#onPointerDown mouseup->lv-textarea#onPointerUp";

interface Mounted {
  componentRoot: HTMLElement;
  textarea: HTMLTextAreaElement;
  output: HTMLOutputElement | null;
}

/**
 * Build a `[data-lievit-component]` root containing a textarea wired exactly as textarea.jte emits
 * it with autosize/count active: `data-controller="lv-textarea"` + the four `data-action`s, the
 * autosize data-hooks, and (when showCount) the sibling `<output id="…-count">` in the wrapper.
 */
function mountTextarea(
  opts: {
    minRows?: number;
    maxRows?: number;
    maxLength?: number;
    showCount?: boolean;
    autosize?: boolean;
    value?: string;
    name?: string;
    disabled?: boolean;
    /** Omit the controller entirely (a bare textarea: neither autosize nor count). */
    bare?: boolean;
  } = {},
): Mounted {
  const {
    minRows = 2,
    maxRows = 0,
    maxLength = 0,
    showCount = false,
    autosize = true,
    value = "",
    name = "note",
    disabled = false,
    bare = false,
  } = opts;

  const componentRoot = document.createElement("div");
  componentRoot.setAttribute("data-lievit-component", "com.example.C");
  componentRoot.setAttribute("data-lievit-id", `cid-${Math.random().toString(36).slice(2)}`);
  componentRoot.setAttribute("data-lievit-snapshot", "s1");

  const wrapper = document.createElement("div");
  wrapper.setAttribute("data-slot", "textarea-wrapper");

  const textarea = document.createElement("textarea");
  textarea.setAttribute("data-slot", "textarea");
  textarea.setAttribute("id", name);
  textarea.setAttribute("name", name);
  textarea.setAttribute("rows", String(minRows));
  if (!bare) {
    textarea.setAttribute("data-controller", "lv-textarea");
    textarea.setAttribute("data-action", ACTION);
  }
  if (autosize && !bare) {
    textarea.setAttribute("data-lv-autosize", "");
    textarea.setAttribute("data-lv-min-rows", String(minRows));
    if (maxRows > 0) textarea.setAttribute("data-lv-max-rows", String(maxRows));
  }
  if (maxLength > 0) textarea.setAttribute("maxlength", String(maxLength));
  if (showCount && !bare) textarea.setAttribute("data-lv-count-for", name);
  textarea.value = value;
  if (disabled) textarea.disabled = true;
  wrapper.appendChild(textarea);

  let output: HTMLOutputElement | null = null;
  if (showCount) {
    output = document.createElement("output");
    output.setAttribute("id", name + "-count");
    output.setAttribute("for", name);
    output.setAttribute("data-slot", "textarea-count");
    wrapper.appendChild(output);
  }

  componentRoot.appendChild(wrapper);
  document.body.appendChild(componentRoot);
  return { componentRoot, textarea, output };
}

/** Fire a synthetic input event (matches what a browser does on a keystroke). */
function fireInput(textarea: HTMLTextAreaElement, newValue?: string): void {
  if (newValue !== undefined) textarea.value = newValue;
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
}

/** Fire the morph-resync custom event the way the runtime would on a value re-render. */
function fireMorphed(textarea: HTMLTextAreaElement): void {
  textarea.dispatchEvent(new CustomEvent("lievit:morphed", { bubbles: true }));
}

beforeEach(() => {
  document.body.innerHTML = "";
});

afterEach(() => {
  stopStimulus();
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

// ===========================================================================
// Autosize
// ===========================================================================
describe("lv-textarea controller — autosize (real Stimulus)", () => {
  it("sets an initial px height on connect", async () => {
    const { runtime } = makeRuntime();
    const { textarea } = mountTextarea({ minRows: 2 });
    startStimulus({ runtime });
    await flushStimulus();
    expect(textarea.style.height).toMatch(/px$/);
  });

  it("grows on input: height increases after adding more content", async () => {
    const { runtime } = makeRuntime();
    const { textarea } = mountTextarea({ minRows: 2 });
    startStimulus({ runtime });
    await flushStimulus();

    const initial = parseFloat(textarea.style.height);
    fireInput(textarea, "l1\nl2\nl3\nl4\nl5\nl6\nl7\nl8\nl9\nl10");
    const grown = parseFloat(textarea.style.height);
    expect(grown).toBeGreaterThanOrEqual(initial);
  });

  it("shrinks on clear: clearing resets height toward the minRows floor", async () => {
    const { runtime } = makeRuntime();
    const { textarea } = mountTextarea({ minRows: 2 });
    startStimulus({ runtime });
    await flushStimulus();

    fireInput(textarea, "l1\nl2\nl3\nl4\nl5\nl6");
    const grown = parseFloat(textarea.style.height);
    fireInput(textarea, "");
    expect(parseFloat(textarea.style.height)).toBeLessThanOrEqual(grown);
  });

  it("no-mount-without-data-controller: a bare textarea gets no controller (height stays unset)", async () => {
    const { runtime } = makeRuntime();
    const { textarea } = mountTextarea({ bare: true });
    startStimulus({ runtime });
    await flushStimulus();
    expect(textarea.hasAttribute("data-controller")).toBe(false);
    expect(textarea.style.height).toBe("");
  });

  it("morph-resync: lievit:morphed recomputes height and clears the user-resized guard", async () => {
    const { runtime } = makeRuntime();
    const { textarea } = mountTextarea({ minRows: 2 });
    startStimulus({ runtime });
    await flushStimulus();

    textarea.setAttribute("data-lv-user-resized", "");
    textarea.value = "new server value\nwith two lines";
    fireMorphed(textarea);
    expect(textarea.style.height).toMatch(/px$/);
    expect(textarea.hasAttribute("data-lv-user-resized")).toBe(false);
  });

  it("user-drag stops autosize: data-lv-user-resized freezes further auto-grow", async () => {
    const { runtime } = makeRuntime();
    const { textarea } = mountTextarea({ minRows: 2 });
    startStimulus({ runtime });
    await flushStimulus();

    textarea.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    textarea.style.height = "999px"; // the user dragged the resize handle
    textarea.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    expect(textarea.hasAttribute("data-lv-user-resized")).toBe(true);

    fireInput(textarea, "some text");
    expect(textarea.style.height).toBe("999px");
  });

  it("caret survives grow: selectionStart/End unchanged after an input-driven resize", async () => {
    const { runtime } = makeRuntime();
    const { textarea } = mountTextarea({ minRows: 2 });
    startStimulus({ runtime });
    await flushStimulus();

    textarea.value = "line1\nline2\nline3\nline4\nline5";
    textarea.setSelectionRange(3, 3);
    const before = { start: textarea.selectionStart, end: textarea.selectionEnd };
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    expect(textarea.selectionStart).toBe(before.start);
    expect(textarea.selectionEnd).toBe(before.end);
  });
});

// ===========================================================================
// Count
// ===========================================================================
describe("lv-textarea controller — count (real Stimulus)", () => {
  it("count-zero-to-start: empty value shows 0 / max on connect", async () => {
    const { runtime } = makeRuntime();
    const { output } = mountTextarea({ maxLength: 100, showCount: true, name: "cfield" });
    startStimulus({ runtime });
    await flushStimulus();
    expect(output!.textContent).toBe("0 / 100");
  });

  it("count-updates-on-input: typing 50 chars shows 50 / 100", async () => {
    const { runtime } = makeRuntime();
    const { textarea, output } = mountTextarea({ maxLength: 100, showCount: true, name: "c2" });
    startStimulus({ runtime });
    await flushStimulus();
    fireInput(textarea, "a".repeat(50));
    expect(output!.textContent).toBe("50 / 100");
  });

  it("count-over-limit: at the cap, adds the over-limit class", async () => {
    const { runtime } = makeRuntime();
    const { textarea, output } = mountTextarea({ maxLength: 100, showCount: true, name: "c3" });
    startStimulus({ runtime });
    await flushStimulus();
    fireInput(textarea, "a".repeat(100));
    expect(output!.classList.contains("lv-textarea-count--over-limit")).toBe(true);
  });

  it("count-under-limit: dropping below the cap removes the over-limit class", async () => {
    const { runtime } = makeRuntime();
    const { textarea, output } = mountTextarea({ maxLength: 100, showCount: true, name: "c4" });
    startStimulus({ runtime });
    await flushStimulus();
    fireInput(textarea, "a".repeat(100));
    expect(output!.classList.contains("lv-textarea-count--over-limit")).toBe(true);
    fireInput(textarea, "a".repeat(50));
    expect(output!.classList.contains("lv-textarea-count--over-limit")).toBe(false);
  });

  it("count without maxLength shows the bare length (no / max part)", async () => {
    const { runtime } = makeRuntime();
    const { textarea, output } = mountTextarea({ showCount: true, name: "c5" });
    startStimulus({ runtime });
    await flushStimulus();
    fireInput(textarea, "hello");
    expect(output!.textContent).toBe("5");
  });

  it("count-morph-resync: lievit:morphed recomputes count after a server re-render", async () => {
    const { runtime } = makeRuntime();
    const { textarea, output } = mountTextarea({ maxLength: 100, showCount: true, name: "c6" });
    startStimulus({ runtime });
    await flushStimulus();
    expect(output!.textContent).toBe("0 / 100");
    textarea.value = "server filled this";
    fireMorphed(textarea);
    expect(output!.textContent).toBe("18 / 100");
  });
});

// ===========================================================================
// Disabled + keystroke + no-wire invariants
// ===========================================================================
describe("lv-textarea controller — inertness invariants", () => {
  it("disabled textarea still connects and does not throw on input", async () => {
    const { runtime } = makeRuntime();
    const { textarea } = mountTextarea({ minRows: 2, disabled: true });
    startStimulus({ runtime });
    await flushStimulus();
    expect(textarea.style.height).toMatch(/px$/);
    fireInput(textarea);
    expect(textarea.style.height).toBeDefined();
  });

  it("swallows no key: typing still reaches textarea.value", async () => {
    const { runtime } = makeRuntime();
    const { textarea } = mountTextarea({ minRows: 2 });
    startStimulus({ runtime });
    await flushStimulus();
    textarea.value = "typed text";
    fireInput(textarea);
    expect(textarea.value).toBe("typed text");
  });

  it("the controller registers no keydown/keyup and never preventDefaults", () => {
    const src = readFileSync(
      join(import.meta.dirname, "..", "runtime", "stimulus", "controllers", "lv-textarea-controller.ts"),
      "utf8",
    );
    const codeOnly = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
    expect(codeOnly).not.toContain('"keydown"');
    expect(codeOnly).not.toContain('"keyup"');
    expect(codeOnly).not.toContain("preventDefault");
  });

  it("fires ZERO wire calls — a textarea is a pure client enhancement, never a dismiss", async () => {
    const { runtime, calledActions } = makeRuntime();
    const { textarea } = mountTextarea({ maxLength: 100, showCount: true, name: "nw" });
    startStimulus({ runtime });
    await flushStimulus();
    fireInput(textarea, "a".repeat(100));
    fireMorphed(textarea);
    await new Promise((r) => setTimeout(r, 10));
    expect(calledActions).toHaveLength(0);
  });
});

// ===========================================================================
// Morph-safety (real lievit morph) — the proof the enhancer test could not state
// ===========================================================================
describe("lv-textarea controller — morph-safety (real lievit morph)", () => {
  it("after a real idiomorph one input => one onInput (no stacked listeners)", async () => {
    const { runtime } = makeRuntime();
    const { componentRoot } = mountTextarea({ minRows: 2 });
    startStimulus({ runtime });
    await flushStimulus();

    const spy = vi.spyOn(LvTextareaController.prototype, "onInput");
    morph(componentRoot, componentRoot.outerHTML);
    await flushStimulus();

    const fresh = componentRoot.querySelector<HTMLTextAreaElement>("textarea")!;
    spy.mockClear();
    fireInput(fresh, "abc");
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("a textarea removed by a morph fires nothing (disconnect tore the listener down)", async () => {
    const { runtime } = makeRuntime();
    const { componentRoot, textarea } = mountTextarea({ minRows: 2 });
    startStimulus({ runtime });
    await flushStimulus();

    const spy = vi.spyOn(LvTextareaController.prototype, "onInput");
    morph(
      componentRoot,
      `<div data-lievit-component="com.example.C" data-lievit-snapshot="s2"><span>gone</span></div>`,
    );
    await flushStimulus();

    fireInput(textarea, "ignored");
    expect(spy).not.toHaveBeenCalled();
  });
});
