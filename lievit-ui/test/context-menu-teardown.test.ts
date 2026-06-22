/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * Pins the context-menu enhancer's DOCUMENT-listener hygiene (the leak fix): the global Escape /
 * outside-click listeners on `document` must be installed AT MOST ONCE across repeated
 * enhanceContextMenus() calls (a re-scan after a morph), never STACKED, so a re-enhance does not
 * fire `close` N times nor leak listeners. The render + state transitions are JVM-asserted in
 * lievit-kit; this is the client-only listener-lifecycle contract.
 *
 * The enhancer keeps the document-listener pair in MODULE state (refcounted), so each test fully
 * drains the teardowns it created in afterEach to keep tests independent.
 */
import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import { enhanceContextMenus } from "../registry/wire/context-menu/context-menu.js";

/** A right-clickable trigger + an OPEN panel, matching the server-rendered context-menu wire. */
function renderOpenMenu(): HTMLElement {
  const root = document.createElement("div");
  const trigger = document.createElement("div");
  trigger.setAttribute("data-context-menu-trigger", "");
  const panel = document.createElement("div");
  panel.setAttribute("data-context-menu-panel", "");
  root.appendChild(trigger);
  root.appendChild(panel);
  document.body.appendChild(root);
  return root;
}

type Runtime = Parameters<typeof enhanceContextMenus>[0];

/** A runtime stub whose $lievit returns an object recording every $call. */
function stubRuntime(): { runtime: Runtime; closeCalls: string[] } {
  const closeCalls: string[] = [];
  const runtime = {
    $lievit: () => ({
      $call: (action: string) => closeCalls.push(action),
      $set: () => {},
    }),
  };
  return { runtime: runtime as unknown as Runtime, closeCalls };
}

describe("context-menu enhancer document-listener hygiene", () => {
  let addSpy: ReturnType<typeof vi.spyOn>;
  let removeSpy: ReturnType<typeof vi.spyOn>;
  /** Every teardown produced in a test; drained in afterEach so module state resets between tests. */
  let teardowns: Array<() => void>;

  beforeEach(() => {
    teardowns = [];
    addSpy = vi.spyOn(document, "addEventListener");
    removeSpy = vi.spyOn(document, "removeEventListener");
  });

  afterEach(() => {
    for (const t of teardowns) t();
    vi.restoreAllMocks();
    document.body.innerHTML = "";
  });

  /** enhance + remember the teardown so afterEach drains the module refcount back to zero. */
  const enhance = (runtime: Runtime): void => {
    teardowns.push(enhanceContextMenus(runtime));
  };

  const docAdds = () =>
    addSpy.mock.calls.filter((c: unknown[]) => c[0] === "keydown" || c[0] === "mousedown").length;

  test("the FIRST enhance installs exactly one keydown + one mousedown on document", () => {
    renderOpenMenu();
    const { runtime } = stubRuntime();
    enhance(runtime);
    expect(docAdds()).toBe(2);
  });

  test("re-enhancing WITHOUT teardown does NOT stack more document listeners", () => {
    renderOpenMenu();
    const { runtime } = stubRuntime();
    enhance(runtime); // first: installs the pair
    enhance(runtime); // re-scan: must reuse, not stack
    enhance(runtime);
    // still exactly one pair on document, no leak across re-enhance.
    expect(docAdds()).toBe(2);
  });

  test("Escape fires `close` exactly ONCE per open menu even after several re-enhances", () => {
    renderOpenMenu();
    const { runtime, closeCalls } = stubRuntime();
    enhance(runtime);
    enhance(runtime);
    enhance(runtime);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    // a single (un-stacked) listener => one close, not three.
    expect(closeCalls).toEqual(["close"]);
  });

  test("the listeners survive until the LAST teardown, then are removed", () => {
    renderOpenMenu();
    const { runtime } = stubRuntime();
    const t1 = enhanceContextMenus(runtime);
    const t2 = enhanceContextMenus(runtime);
    const docRemoves = () =>
      removeSpy.mock.calls.filter((c: unknown[]) => c[0] === "keydown" || c[0] === "mousedown").length;
    t1(); // refcount still > 0: listeners stay
    expect(docRemoves()).toBe(0);
    t2(); // last teardown: now they go
    expect(docRemoves()).toBe(2);
  });

  test("a teardown is idempotent: calling it twice does not over-remove", () => {
    renderOpenMenu();
    const { runtime } = stubRuntime();
    const teardown = enhanceContextMenus(runtime);
    teardown();
    expect(() => teardown()).not.toThrow(); // second call is a no-op
    // a fresh enhance after a full teardown re-installs the pair cleanly (2 from first + 2 now).
    enhance(runtime);
    expect(docAdds()).toBe(4);
  });

  test("per-element triggers are still wired exactly once (no double-add on re-enhance)", () => {
    const root = renderOpenMenu();
    const trigger = root.querySelector<HTMLElement>("[data-context-menu-trigger]")!;
    const triggerAdd = vi.spyOn(trigger, "addEventListener");
    const { runtime } = stubRuntime();
    enhance(runtime);
    enhance(runtime); // re-scan: the already-wired trigger is skipped
    // contextmenu + keydown wired once each, not twice.
    expect(triggerAdd.mock.calls.filter((c) => c[0] === "contextmenu")).toHaveLength(1);
    expect(triggerAdd.mock.calls.filter((c) => c[0] === "keydown")).toHaveLength(1);
  });
});
