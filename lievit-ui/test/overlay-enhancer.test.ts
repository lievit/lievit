/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * overlay enhancer (ADR-0012, server-first): the ONE CSP-clean typed-TS module that gives the whole
 * modal-overlay family (dialog / sheet / drawer / alert-dialog) the three focus-mechanics a modal
 * owes by WAI-ARIA APG that the server cannot do: focus-trap, Escape-to-close, return-focus. The
 * open/closed STATE stays server-owned (the boolean `hidden` on the overlay root); this module never
 * sets it, it only reacts to it. The .jte render is pinned by the lievit-kit *IT through the real
 * runtime; THIS file pins the rendered DOM shape + the enhancer's focus behaviour against a DOM
 * shaped exactly like each overlay's template output (a render-asserting test on real DOM, the
 * slot-bug lesson: assert the rendered DOM + the actual states, not a template string).
 */
import { describe, test, expect, afterEach, vi } from "vitest";
import { enhanceOverlay, enhanceAllOverlays } from "../registry/wire/dialog/overlay.enhancer.js";

type Kind = "dialog" | "sheet" | "drawer" | "alert-dialog";

/**
 * Build a DOM that matches a server-rendered modal-overlay root: the `[data-lv-<kind>]` root with
 * the boolean `hidden` set per `open`, its role=dialog|alertdialog panel, the dismiss button the
 * template renders (`-close` for dialog/sheet/drawer, `-cancel` for alert-dialog), and two extra
 * focusable buttons in the body so the Tab-trap has something to wrap around. Mirrors the .jte
 * output (registry/wire/<kind>/<kind>.jte).
 */
function renderOverlay(
  kind: Kind,
  opts: { open?: boolean; dismissible?: boolean } = {}
): { root: HTMLElement; panel: HTMLElement } {
  const open = opts.open ?? false;
  const dismissible = opts.dismissible ?? true;
  const isAlert = kind === "alert-dialog";

  const root = document.createElement("div");
  root.setAttribute(`data-lv-${kind}`, "");
  if (!open) {
    root.setAttribute("hidden", "");
  }

  const panel = document.createElement("div");
  panel.setAttribute(`data-lv-${kind}-panel`, "");
  panel.setAttribute("role", isAlert ? "alertdialog" : "dialog");
  panel.setAttribute("aria-modal", "true");

  // A dismiss affordance: alert-dialog cancel (also the initial-focus element), else a close button.
  if (isAlert) {
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.setAttribute(`data-lv-${kind}-cancel`, "");
    cancel.setAttribute("data-lv-autofocus", "");
    cancel.textContent = "Cancel";
    panel.appendChild(cancel);
    const action = document.createElement("button");
    action.type = "button";
    action.setAttribute(`data-lv-${kind}-action`, "");
    action.textContent = "Confirm";
    panel.appendChild(action);
  } else {
    if (dismissible) {
      const backdrop = document.createElement("button");
      backdrop.type = "button";
      backdrop.setAttribute(`data-lv-${kind}-backdrop`, "");
      root.appendChild(backdrop);
    }
    const close = document.createElement("button");
    close.type = "button";
    close.setAttribute(`data-lv-${kind}-close`, "");
    close.textContent = "Close";
    panel.appendChild(close);
    const a = document.createElement("button");
    a.type = "button";
    a.textContent = "Action A";
    panel.appendChild(a);
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = "Action B";
    panel.appendChild(b);
  }

  root.appendChild(panel);
  document.body.appendChild(root);
  return { root, panel };
}

/** A real button outside any overlay: the opener focus is returned to it on close. */
function renderTrigger(): HTMLButtonElement {
  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.textContent = "Open";
  document.body.appendChild(trigger);
  return trigger;
}

/** Flush the MutationObserver (happy-dom delivers attribute mutations on a macrotask). */
async function flush(): Promise<void> {
  await Promise.resolve();
  await new Promise((r) => setTimeout(r, 0));
}

afterEach(() => {
  document.body.innerHTML = "";
  vi.useRealTimers();
});

const KINDS: Kind[] = ["dialog", "sheet", "drawer", "alert-dialog"];

describe("overlay DOM shape (render-asserting, the whole family)", () => {
  for (const kind of KINDS) {
    test(`${kind}: closed root is [hidden] yet the role=dialog|alertdialog panel projects`, () => {
      const { root, panel } = renderOverlay(kind, { open: false });
      expect(root.hasAttribute(`data-lv-${kind}`)).toBe(true);
      expect(root.hasAttribute("hidden")).toBe(true);
      expect(panel.getAttribute("role")).toBe(kind === "alert-dialog" ? "alertdialog" : "dialog");
      expect(panel.getAttribute("aria-modal")).toBe("true");
    });
  }

  test("alert-dialog marks the cancel button as the initial-focus element (focus-on-cancel)", () => {
    const { panel } = renderOverlay("alert-dialog", { open: true });
    const marked = panel.querySelector("[data-lv-autofocus]");
    expect(marked).not.toBeNull();
    expect(marked?.getAttribute("data-lv-alert-dialog-cancel")).toBe("");
  });
});

describe("focus-trap (Tab wraps within the panel, never leaks to the page)", () => {
  test("Tab past the last focusable wraps to the first", () => {
    const { root, panel } = renderOverlay("dialog", { open: true });
    enhanceOverlay(root);
    const focusables = panel.querySelectorAll<HTMLButtonElement>("button");
    const last = focusables[focusables.length - 1];
    last.focus();
    expect(document.activeElement).toBe(last);
    root.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true }));
    expect(document.activeElement).toBe(focusables[0]);
  });

  test("Shift+Tab past the first focusable wraps to the last", () => {
    const { root, panel } = renderOverlay("sheet", { open: true });
    enhanceOverlay(root);
    const focusables = panel.querySelectorAll<HTMLButtonElement>("button");
    const first = focusables[0];
    first.focus();
    root.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", shiftKey: true, bubbles: true }));
    expect(document.activeElement).toBe(focusables[focusables.length - 1]);
  });

  test("a Tab inside the panel (not at an edge) is NOT intercepted (native tab order stands)", () => {
    const { root, panel } = renderOverlay("drawer", { open: true });
    enhanceOverlay(root);
    const focusables = panel.querySelectorAll<HTMLButtonElement>("button");
    focusables[0].focus();
    const ev = new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true });
    root.dispatchEvent(ev);
    // not at the last element: the enhancer leaves the browser to advance, so it does not preventDefault.
    expect(ev.defaultPrevented).toBe(false);
  });

  test("a closed overlay does not trap Tab (the handler is inert while hidden)", () => {
    const { root } = renderOverlay("dialog", { open: false });
    enhanceOverlay(root);
    const ev = new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true });
    root.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(false);
  });
});

describe("Escape routes to the server close/cancel path (clicks the rendered l:click button)", () => {
  for (const kind of KINDS) {
    test(`${kind}: Escape clicks the dismiss button (Escape and the button share the wire path)`, () => {
      const { root, panel } = renderOverlay(kind, { open: true });
      enhanceOverlay(root);
      const dismissSel =
        kind === "alert-dialog" ? `[data-lv-${kind}-cancel]` : `[data-lv-${kind}-close]`;
      const dismiss = panel.querySelector<HTMLButtonElement>(dismissSel)!;
      const clicked = vi.fn();
      dismiss.addEventListener("click", clicked);
      root.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      expect(clicked).toHaveBeenCalledTimes(1);
    });
  }

  test("a non-dismissible dialog (no close button) has no Escape target (no throw, no close)", () => {
    const { root } = renderOverlay("dialog", { open: true, dismissible: false });
    // remove the close button to model a fully non-dismissible dialog.
    root.querySelector("[data-lv-dialog-close]")?.remove();
    enhanceOverlay(root);
    expect(() =>
      root.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))
    ).not.toThrow();
    expect(root.hasAttribute("hidden")).toBe(false); // the enhancer never sets state itself
  });

  test("Escape on a CLOSED overlay is inert (does not click the dismiss button)", () => {
    const { root, panel } = renderOverlay("dialog", { open: false });
    enhanceOverlay(root);
    const clicked = vi.fn();
    panel.querySelector("[data-lv-dialog-close]")!.addEventListener("click", clicked);
    root.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(clicked).not.toHaveBeenCalled();
  });
});

describe("focus management across the server-owned open<->close transition", () => {
  test("opening (server drops [hidden]) moves focus into the panel", async () => {
    const trigger = renderTrigger();
    const { root, panel } = renderOverlay("dialog", { open: false });
    enhanceOverlay(root);
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    root.removeAttribute("hidden"); // the server re-render that opens it
    await flush();

    expect(panel.contains(document.activeElement)).toBe(true);
  });

  test("alert-dialog opens with focus on its cancel button (focus-on-cancel default)", async () => {
    renderTrigger();
    const { root, panel } = renderOverlay("alert-dialog", { open: false });
    enhanceOverlay(root);

    root.removeAttribute("hidden");
    await flush();

    expect(document.activeElement).toBe(panel.querySelector("[data-lv-alert-dialog-cancel]"));
  });

  test("closing (server re-adds [hidden]) returns focus to the trigger", async () => {
    const trigger = renderTrigger();
    const { root } = renderOverlay("dialog", { open: false });
    enhanceOverlay(root);
    trigger.focus();

    root.removeAttribute("hidden"); // open
    await flush();
    expect(document.activeElement).not.toBe(trigger);

    root.setAttribute("hidden", ""); // server close
    await flush();
    expect(document.activeElement).toBe(trigger);
  });

  test("an overlay that mounts already-open focuses its panel without waiting for a mutation", () => {
    renderTrigger();
    const { root, panel } = renderOverlay("dialog", { open: true });
    enhanceOverlay(root);
    expect(panel.contains(document.activeElement)).toBe(true);
  });
});

describe("idempotency + scope", () => {
  test("enhanceOverlay is idempotent (re-enhancing does not double-bind Escape)", () => {
    const { root, panel } = renderOverlay("dialog", { open: true });
    enhanceOverlay(root);
    enhanceOverlay(root); // second call: marked, no-op
    const clicked = vi.fn();
    panel.querySelector("[data-lv-dialog-close]")!.addEventListener("click", clicked);
    root.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(clicked).toHaveBeenCalledTimes(1); // not 2: the keydown listener was bound once
  });

  test("enhanceOverlay ignores a non-overlay element (no data-lv-<kind>)", () => {
    const div = document.createElement("div");
    document.body.appendChild(div);
    expect(() => enhanceOverlay(div)).not.toThrow();
    expect(div.hasAttribute("data-lv-overlay-enhanced")).toBe(false);
  });

  test("enhanceAllOverlays wires every overlay kind on the page", () => {
    const made = KINDS.map((k) => renderOverlay(k, { open: true }));
    enhanceAllOverlays();
    for (const { root, panel } of made) {
      const kind = KINDS.find((k) => root.hasAttribute(`data-lv-${k}`))!;
      const dismissSel =
        kind === "alert-dialog" ? `[data-lv-${kind}-cancel]` : `[data-lv-${kind}-close]`;
      const dismiss = panel.querySelector<HTMLButtonElement>(dismissSel)!;
      const clicked = vi.fn();
      dismiss.addEventListener("click", clicked);
      root.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      expect(clicked).toHaveBeenCalledTimes(1);
    }
  });
});
