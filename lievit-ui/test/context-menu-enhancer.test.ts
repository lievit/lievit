/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * context-menu enhancer (ADR-0012, Wave 2): the server-first context-menu WIRE component keeps its
 * state (open/x/y/items/selection) in typed Java rendered by JTE; the ONE irreducible client bit is
 * the native gesture, captured by the CSP-clean typed-TS enhancer (registry/wire/context-menu/
 * context-menu.ts). The render + state transitions are render-asserted on the JVM in lievit-kit;
 * the source-purity + registry shape are pinned by context-menu.test.ts. THIS file is the missing
 * INTERACTION layer: it mounts a DOM shaped exactly like the partial output, drives the enhancer's
 * gestures against a fake runtime ($lievit spy) and asserts the wire effects PLUS the round-2 bug
 * class -- no listener-stacking / no double-fire after the enhancer is re-run over a re-rendered
 * trigger (the morph re-scan path that let the calendar boot/morph bugs ship).
 */
import { afterEach, describe, expect, test, vi } from "vitest";

import { enhanceContextMenus } from "../registry/wire/context-menu/context-menu.js";

/** A spy stand-in for the runtime's `$lievit(el)` component handle. */
interface SpyHandle {
  $set: ReturnType<typeof vi.fn>;
  $call: ReturnType<typeof vi.fn>;
}

/**
 * Build a DOM matching the server-rendered context-menu output: a component root carrying a
 * `[data-context-menu-trigger]` right-clickable region, and (when `open`) a `[data-context-menu-panel]`
 * sibling holding a real role=menu with one item. Mirrors registry/wire/context-menu/context-menu.jte.
 */
function renderContextMenu(opts: { open?: boolean } = {}): {
  root: HTMLElement;
  trigger: HTMLElement;
  panel: HTMLElement | null;
} {
  const root = document.createElement("div");
  root.setAttribute("data-lievit-component", "io.lievit.wire.ContextMenuComponent");

  const trigger = document.createElement("div");
  trigger.setAttribute("data-context-menu-trigger", "");
  trigger.setAttribute("tabindex", "0");
  root.appendChild(trigger);

  let panel: HTMLElement | null = null;
  if (opts.open) {
    panel = document.createElement("div");
    panel.setAttribute("data-context-menu-panel", "");
    panel.setAttribute("role", "menu");
    const item = document.createElement("button");
    item.setAttribute("role", "menuitem");
    item.textContent = "Rename";
    panel.appendChild(item);
    root.appendChild(panel);
  }

  document.body.appendChild(root);
  return { root, trigger, panel };
}

/** Fire a `contextmenu` (right-click) at a target carrying client coordinates. */
function fireContextMenu(target: EventTarget, x: number, y: number): MouseEvent {
  const event = new MouseEvent("contextmenu", {
    bubbles: true,
    cancelable: true,
    clientX: x,
    clientY: y,
  });
  target.dispatchEvent(event);
  return event;
}

/** Dispatch a keydown of `key` (with optional modifiers) on a target. */
function pressKey(
  target: EventTarget,
  key: string,
  init: KeyboardEventInit = {},
): KeyboardEvent {
  const event = new KeyboardEvent("keydown", {
    key,
    bubbles: true,
    cancelable: true,
    ...init,
  });
  target.dispatchEvent(event);
  return event;
}

describe("context-menu enhancer (the one irreducible client gesture)", () => {
  let handle: SpyHandle;
  let runtime: { $lievit: (el: Element) => SpyHandle | null };
  let teardown: () => void;

  function makeRuntime(): void {
    handle = { $set: vi.fn(), $call: vi.fn() };
    runtime = { $lievit: () => handle };
  }

  afterEach(() => {
    teardown?.();
    document.body.innerHTML = "";
  });

  test("a right-click arms the pointer coordinates and fires openAt (preventing the browser menu)", () => {
    makeRuntime();
    const { root, trigger } = renderContextMenu();
    teardown = enhanceContextMenus(runtime as never, root);

    const event = fireContextMenu(trigger, 42, 99);

    expect(event.defaultPrevented, "the native browser menu must be suppressed").toBe(true);
    expect(handle.$set).toHaveBeenCalledWith("x", 42);
    expect(handle.$set).toHaveBeenCalledWith("y", 99);
    expect(handle.$call).toHaveBeenCalledWith("openAt");
  });

  test("the ContextMenu key opens the menu at the trigger box (keyboard parity)", () => {
    makeRuntime();
    const { root, trigger } = renderContextMenu();
    teardown = enhanceContextMenus(runtime as never, root);

    const event = pressKey(trigger, "ContextMenu");

    expect(event.defaultPrevented).toBe(true);
    expect(handle.$call).toHaveBeenCalledWith("openAt");
    // coordinates come from getBoundingClientRect (0,0 in jsdom) but x/y are still armed.
    expect(handle.$set).toHaveBeenCalledWith("x", expect.any(Number));
    expect(handle.$set).toHaveBeenCalledWith("y", expect.any(Number));
  });

  test("Shift+F10 opens the menu too (the other APG keyboard affordance)", () => {
    makeRuntime();
    const { root, trigger } = renderContextMenu();
    teardown = enhanceContextMenus(runtime as never, root);

    const event = pressKey(trigger, "F10", { shiftKey: true });

    expect(event.defaultPrevented).toBe(true);
    expect(handle.$call).toHaveBeenCalledWith("openAt");
  });

  test("Escape while a menu is open fires close on the server", () => {
    makeRuntime();
    const { root } = renderContextMenu({ open: true });
    teardown = enhanceContextMenus(runtime as never, root);

    pressKey(document, "Escape");

    expect(handle.$call).toHaveBeenCalledWith("close");
  });

  test("Escape with no open menu is a no-op (nothing to close)", () => {
    makeRuntime();
    const { root } = renderContextMenu({ open: false });
    teardown = enhanceContextMenus(runtime as never, root);

    pressKey(document, "Escape");

    expect(handle.$call).not.toHaveBeenCalled();
  });

  test("a mousedown outside the open panel closes the menu; one inside does not", () => {
    makeRuntime();
    const { root, panel } = renderContextMenu({ open: true });
    teardown = enhanceContextMenus(runtime as never, root);

    // a click inside the panel keeps it open.
    panel!.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    expect(handle.$call).not.toHaveBeenCalledWith("close");

    // a click on the body outside the panel closes it.
    document.body.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    expect(handle.$call).toHaveBeenCalledWith("close");
  });

  test("when no component resolves, the gesture is a safe no-op (defensive null guard)", () => {
    handle = { $set: vi.fn(), $call: vi.fn() };
    const nullRuntime = { $lievit: () => null };
    const { root, trigger } = renderContextMenu();
    teardown = enhanceContextMenus(nullRuntime as never, root);

    expect(() => fireContextMenu(trigger, 1, 2)).not.toThrow();
    expect(handle.$call).not.toHaveBeenCalled();
  });

  test("uses NO inline handler: the trigger carries no oncontextmenu attribute (CSP-clean)", () => {
    makeRuntime();
    const { root, trigger } = renderContextMenu();
    teardown = enhanceContextMenus(runtime as never, root);
    expect(trigger.getAttribute("oncontextmenu")).toBeNull();
  });

  test("the returned teardown removes the document Escape / outside-click listeners", () => {
    makeRuntime();
    const { root } = renderContextMenu({ open: true });
    const localTeardown = enhanceContextMenus(runtime as never, root);

    localTeardown();
    pressKey(document, "Escape");
    document.body.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));

    expect(handle.$call, "torn-down listeners must not fire close").not.toHaveBeenCalled();
    teardown = () => {};
  });
});

describe("context-menu enhancer: re-run idempotency (the round-2 bug class)", () => {
  let handle: SpyHandle;
  let runtime: { $lievit: (el: Element) => SpyHandle | null };
  let teardowns: Array<() => void>;

  afterEach(() => {
    for (const t of teardowns) t();
    document.body.innerHTML = "";
  });

  test("re-enhancing an already-wired trigger does NOT stack listeners (one right-click => one openAt)", () => {
    handle = { $set: vi.fn(), $call: vi.fn() };
    runtime = { $lievit: () => handle };
    const { root, trigger } = renderContextMenu();

    // First wire, then a second pass (the morph re-scan path the adopter runs after a re-render).
    teardowns = [
      enhanceContextMenus(runtime as never, root),
      enhanceContextMenus(runtime as never, root),
    ];

    fireContextMenu(trigger, 10, 20);

    // A stacked contextmenu listener would fire openAt twice; the WIRED guard must keep it at one.
    expect(handle.$call.mock.calls.filter((c) => c[0] === "openAt")).toHaveLength(1);
  });

  test("the keyboard parity listener also stays single after a re-run (no double openAt)", () => {
    handle = { $set: vi.fn(), $call: vi.fn() };
    runtime = { $lievit: () => handle };
    const { root, trigger } = renderContextMenu();

    teardowns = [
      enhanceContextMenus(runtime as never, root),
      enhanceContextMenus(runtime as never, root),
    ];

    pressKey(trigger, "ContextMenu");

    expect(handle.$call.mock.calls.filter((c) => c[0] === "openAt")).toHaveLength(1);
  });

  test("a freshly-rendered (un-wired) trigger added after the first pass still gets wired", () => {
    handle = { $set: vi.fn(), $call: vi.fn() };
    runtime = { $lievit: () => handle };
    const { root } = renderContextMenu();
    teardowns = [enhanceContextMenus(runtime as never, root)];

    // a morph swapped in a brand-new trigger (no WIRED marker): a second scan must wire it.
    const fresh = document.createElement("div");
    fresh.setAttribute("data-context-menu-trigger", "");
    root.appendChild(fresh);
    teardowns.push(enhanceContextMenus(runtime as never, root));

    fireContextMenu(fresh, 5, 6);
    expect(handle.$call).toHaveBeenCalledWith("openAt");
  });
});
