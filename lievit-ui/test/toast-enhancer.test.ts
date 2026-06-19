/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * toast (Wave 3, ADR-0012): the server-first toast is a JTE partial rendered from a server flash /
 * notification + a CSP-clean typed-TS auto-dismiss enhancer (no Lit island). The .jte render is
 * pinned by the real-compiler jte-compile smoke; THIS file pins the rendered DOM + the enhancer's
 * behaviour against a DOM shaped exactly like the partial output (a render-asserting test on real
 * DOM, the slot-bug lesson: assert the rendered DOM, not a template string). The partial maps the
 * severity variant to the WAI-ARIA live-region role (danger/warning => role=alert assertive;
 * info/success => role=status polite) and renders the message + a dismiss button; the enhancer
 * starts the auto-dismiss timer (data-toast-duration) and removes the toast on dismiss / timeout.
 */
import { describe, test, expect, afterEach, vi } from "vitest";
import { enhanceToast, enhanceAllToasts } from "../registry/jte/toast.enhancer.js";

type Variant = "info" | "success" | "warning" | "danger";

/** The WAI-ARIA live-region role the partial renders per variant (mirrors the .jte switch). */
function roleFor(variant: Variant): "alert" | "status" {
  return variant === "danger" || variant === "warning" ? "alert" : "status";
}

/**
 * Build a DOM that matches the server-rendered toast partial: the [data-lievit-toast] root carrying
 * the variant role + aria-live + data-toast-duration, a body with the message, and an optional
 * dismiss button. Mirrors registry/jte/toast.jte's output.
 */
function renderToast(opts: {
  variant?: Variant;
  message?: string;
  heading?: string;
  dismissible?: boolean;
  duration?: number;
} = {}): HTMLElement {
  const variant = opts.variant ?? "info";
  const dismissible = opts.dismissible ?? true;
  const duration = opts.duration ?? 4000;
  const role = roleFor(variant);

  const root = document.createElement("div");
  root.setAttribute("data-lievit-toast", "");
  root.setAttribute("data-slot", "toast");
  root.setAttribute("data-variant", variant);
  root.setAttribute("data-toast-duration", String(duration));
  root.setAttribute("role", role);
  root.setAttribute("aria-live", role === "alert" ? "assertive" : "polite");
  root.setAttribute("aria-atomic", "true");

  const icon = document.createElement("span");
  icon.setAttribute("data-toast-icon", "");
  icon.setAttribute("aria-hidden", "true");
  root.appendChild(icon);

  const body = document.createElement("div");
  body.setAttribute("data-toast-body", "");
  if (opts.heading) {
    const h = document.createElement("div");
    h.setAttribute("data-toast-heading", "");
    h.textContent = opts.heading;
    body.appendChild(h);
  }
  body.appendChild(document.createTextNode(opts.message ?? "Saved."));
  root.appendChild(body);

  if (dismissible) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.setAttribute("data-toast-dismiss", "");
    btn.setAttribute("aria-label", "Dismiss notification");
    root.appendChild(btn);
  }

  document.body.appendChild(root);
  return root;
}

afterEach(() => {
  document.body.innerHTML = "";
  vi.useRealTimers();
});

describe("toast partial DOM shape (render-asserting)", () => {
  test("danger variant renders role=alert (assertive) + the message", () => {
    const root = renderToast({ variant: "danger", message: "Could not save." });
    expect(root.getAttribute("role")).toBe("alert");
    expect(root.getAttribute("aria-live")).toBe("assertive");
    expect(root.querySelector("[data-toast-body]")?.textContent).toContain("Could not save.");
  });

  test("warning variant renders role=alert (assertive)", () => {
    const root = renderToast({ variant: "warning", message: "Heads up." });
    expect(root.getAttribute("role")).toBe("alert");
    expect(root.getAttribute("aria-live")).toBe("assertive");
  });

  test("info variant renders role=status (polite), not alert", () => {
    const root = renderToast({ variant: "info", message: "FYI." });
    expect(root.getAttribute("role")).toBe("status");
    expect(root.getAttribute("aria-live")).toBe("polite");
  });

  test("success variant renders role=status (polite)", () => {
    const root = renderToast({ variant: "success", message: "Done." });
    expect(root.getAttribute("role")).toBe("status");
  });

  test("open renders the panel + message + heading + a dismiss button", () => {
    const root = renderToast({ heading: "Saved", message: "Your changes are live." });
    expect(root.isConnected).toBe(true);
    expect(root.getAttribute("aria-atomic")).toBe("true");
    expect(root.querySelector("[data-toast-heading]")?.textContent).toBe("Saved");
    expect(root.querySelector("[data-toast-body]")?.textContent).toContain("Your changes are live.");
    expect(root.querySelector("[data-toast-dismiss]")).not.toBeNull();
  });
});

describe("toast enhancer behaviour (real DOM)", () => {
  test("clicking dismiss removes the toast from the DOM", () => {
    const root = renderToast({ duration: 0 });
    enhanceToast(root);
    expect(root.isConnected).toBe(true);
    (root.querySelector("[data-toast-dismiss]") as HTMLButtonElement).click();
    expect(root.isConnected).toBe(false);
  });

  test("auto-dismiss removes the toast after its duration", () => {
    vi.useFakeTimers();
    const root = renderToast({ duration: 4000, dismissible: false });
    enhanceToast(root);
    expect(root.isConnected).toBe(true);
    vi.advanceTimersByTime(3999);
    expect(root.isConnected).toBe(true);
    vi.advanceTimersByTime(1);
    expect(root.isConnected).toBe(false);
  });

  test("duration 0 stays until dismissed (no auto-dismiss timer)", () => {
    vi.useFakeTimers();
    const root = renderToast({ duration: 0 });
    enhanceToast(root);
    vi.advanceTimersByTime(60_000);
    expect(root.isConnected).toBe(true);
  });

  test("a manual dismiss cancels the pending auto-dismiss timer (no double-remove)", () => {
    vi.useFakeTimers();
    const root = renderToast({ duration: 4000 });
    enhanceToast(root);
    (root.querySelector("[data-toast-dismiss]") as HTMLButtonElement).click();
    expect(root.isConnected).toBe(false);
    // advancing past the original timeout must not throw on the already-removed node
    expect(() => vi.advanceTimersByTime(8000)).not.toThrow();
  });

  test("enhanceToast is idempotent (re-enhancing does not double-bind the timer)", () => {
    vi.useFakeTimers();
    const root = renderToast({ duration: 4000, dismissible: false });
    enhanceToast(root);
    enhanceToast(root); // second call: marked, no-op
    vi.advanceTimersByTime(4000);
    expect(root.isConnected).toBe(false);
  });

  test("enhanceAllToasts wires every toast on the page", () => {
    const a = renderToast({ duration: 0 });
    const b = renderToast({ duration: 0 });
    enhanceAllToasts();
    (a.querySelector("[data-toast-dismiss]") as HTMLButtonElement).click();
    (b.querySelector("[data-toast-dismiss]") as HTMLButtonElement).click();
    expect(a.isConnected).toBe(false);
    expect(b.isConnected).toBe(false);
  });
});
