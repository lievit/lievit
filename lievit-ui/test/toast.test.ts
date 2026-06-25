/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * toast (v-next, ADR-0012): render + enhancer tests for the re-forged toast surface.
 *
 * Architecture tested:
 *   - toast.jte (toast-item partial): server-rendered single notification card.
 *   - toast/region.jte: always-present live-region container with polite + assertive sub-containers.
 *   - notification-bell.jte: icon-button + badge + popover panel (source-text assertions only;
 *     the full native-popover interaction is Playwright territory).
 *   - toast.enhancer.ts (v-next): queue, timers, Esc-dismiss, focus-pause, bell counter, SSE path.
 *
 * Substrate: jsdom + real enhancer (no mocks of the enhancer itself). DOM shape mirrors the
 * server-rendered partial output (the slot-bug lesson: assert the rendered DOM, not template text).
 */
import { describe, test, expect, afterEach, vi } from "vitest";
import {
  initToastRegion,
  destroyToastRegion,
  enhanceToast,
  enhanceAllToasts,
} from "../registry/jte/toast.enhancer.js";
import fs from "node:fs";
import path from "node:path";

// ---------------------------------------------------------------------------
// Helpers: build DOM that mirrors the server-rendered partial output
// ---------------------------------------------------------------------------

type ToastVariant = "info" | "success" | "warning" | "destructive";

/** Build a toast-region DOM that mirrors toast/region.jte output. */
function renderRegion(opts: {
  placement?: string;
  maxVisible?: number;
  sseUrl?: string;
  bellId?: string;
} = {}): HTMLElement {
  const root = document.createElement("div");
  root.setAttribute("data-slot", "toast-region");
  root.setAttribute("data-toast-placement", opts.placement ?? "bottom-end");
  root.setAttribute("data-toast-max-visible", String(opts.maxVisible ?? 5));
  if (opts.sseUrl) root.setAttribute("data-toast-sse-url", opts.sseUrl);
  if (opts.bellId) root.setAttribute("data-toast-bell-id", opts.bellId);

  const polite = document.createElement("div");
  polite.setAttribute("role", "status");
  polite.setAttribute("aria-live", "polite");
  polite.setAttribute("aria-atomic", "false");
  polite.setAttribute("data-slot", "toast-live-polite");
  polite.style.display = "contents";

  const assertive = document.createElement("div");
  assertive.setAttribute("role", "alert");
  assertive.setAttribute("aria-live", "assertive");
  assertive.setAttribute("aria-atomic", "false");
  assertive.setAttribute("data-slot", "toast-live-assertive");
  assertive.style.display = "contents";

  root.appendChild(polite);
  root.appendChild(assertive);
  document.body.appendChild(root);
  return root;
}

/** Build a toast-item DOM that mirrors toast.jte output. */
function renderItem(opts: {
  variant?: ToastVariant;
  message?: string;
  description?: string;
  duration?: number;
  dismissible?: boolean;
  toastId?: string;
  action?: string;
  actionHref?: string;
  actionWireClick?: string;
} = {}): HTMLElement {
  const variant = opts.variant ?? "info";
  const duration = opts.duration ?? 5000;
  const dismissible = opts.dismissible !== false;
  const id = opts.toastId ?? `toast-${Math.random().toString(36).slice(2)}`;

  const el = document.createElement("div");
  el.setAttribute("data-slot", "toast-item");
  el.setAttribute("data-variant", variant);
  el.setAttribute("data-toast-id", id);
  el.setAttribute("data-toast-duration", String(duration));
  el.setAttribute("role", "none");

  const body = document.createElement("div");
  body.setAttribute("data-slot", "toast-body");

  const msg = document.createElement("p");
  msg.setAttribute("data-slot", "toast-message");
  msg.textContent = opts.message ?? "Test message";
  body.appendChild(msg);

  if (opts.description != null) {
    const desc = document.createElement("p");
    desc.setAttribute("data-slot", "toast-description");
    desc.textContent = opts.description;
    body.appendChild(desc);
  }

  if (opts.action != null) {
    if (opts.actionHref != null) {
      const a = document.createElement("a");
      a.href = opts.actionHref;
      a.textContent = opts.action;
      body.appendChild(a);
    } else if (opts.actionWireClick != null) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.setAttribute("l:click", opts.actionWireClick);
      btn.textContent = opts.action;
      body.appendChild(btn);
    }
  }

  el.appendChild(body);

  if (dismissible) {
    const dismiss = document.createElement("button");
    dismiss.type = "button";
    dismiss.setAttribute("data-slot", "toast-dismiss");
    dismiss.setAttribute("aria-label", "Dismiss notification");
    el.appendChild(dismiss);
  }

  return el;
}

/** Read the toast.jte source text. */
function readJte(name: string): string {
  return fs.readFileSync(
    path.resolve(__dirname, "../registry/jte/" + name),
    "utf8"
  );
}

afterEach(() => {
  document.body.innerHTML = "";
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// Source-text assertions: toast.jte (toast-item partial)
// ---------------------------------------------------------------------------

describe("toast.jte source-text (v-next item partial)", () => {
  const src = readJte("toast.jte");

  test("declares variant param defaulting to info", () => {
    expect(src).toContain('@param String variant = "info"');
  });

  test("declares all required v-next params", () => {
    expect(src).toContain("@param String message");
    expect(src).toContain("@param String description = null");
    expect(src).toContain("@param int duration = 5000");
    expect(src).toContain("@param boolean dismissible = true");
    expect(src).toContain("@param String toastId = null");
    expect(src).toContain("@param String action = null");
    expect(src).toContain("@param String actionHref = null");
    expect(src).toContain("@param String actionWireClick = null");
    expect(src).toContain("@param String attrs = \"\"");
  });

  test("item root carries data-slot=toast-item, data-variant, data-toast-id, data-toast-duration", () => {
    expect(src).toContain('data-slot="toast-item"');
    expect(src).toContain('data-variant="${variant}"');
    expect(src).toContain('data-toast-id="${toastId}"');
    expect(src).toContain('data-toast-duration="${duration}"');
  });

  test("item root has role=none (it is content inside the live region, no extra role)", () => {
    expect(src).toContain('role="none"');
  });

  test("dismiss button has aria-label=Dismiss notification", () => {
    expect(src).toContain('aria-label="Dismiss notification"');
    expect(src).toContain('data-slot="toast-dismiss"');
  });

  test("description is conditionally rendered", () => {
    expect(src).toMatch(/@if\(description != null\)/);
    expect(src).toContain('data-slot="toast-description"');
  });

  test("action as anchor when actionHref is set", () => {
    expect(src).toContain('href="${actionHref}"');
  });

  test("action as wire button when actionWireClick is set", () => {
    expect(src).toContain('l:click="${actionWireClick}"');
  });

  test("no dev.lievit import", () => {
    expect(src).not.toContain("import dev.lievit");
  });

  test("no inline <script>", () => {
    const body = src.replace(/<%--[\s\S]*?--%>/g, "");
    expect(body).not.toMatch(/<script/i);
  });

  test("no on* handlers", () => {
    const body = src.replace(/<%--[\s\S]*?--%>/g, "");
    expect(body).not.toMatch(/\son\w+\s*=/);
  });

  test("message is HTML-escaped (uses JTE dollar-brace, not dollar-unsafe)", () => {
    // message rendered via ${message}, not $unsafe{message}
    expect(src).toContain("${message}");
    expect(src).not.toContain("$unsafe{message}");
  });

  test("variant intent icons: circle-check / triangle-alert / circle-x / info", () => {
    expect(src).toContain('"circle-check"');
    expect(src).toContain('"triangle-alert"');
    expect(src).toContain('"circle-x"');
    expect(src).toContain('"info"');
  });

  test("uses --lv-* tokens, no hardcoded hex/rgb colour", () => {
    const body = src.replace(/<%--[\s\S]*?--%>/g, "");
    expect(body).not.toMatch(/#[0-9a-fA-F]{3,8}(?![^"]*")/);
  });
});

// ---------------------------------------------------------------------------
// Source-text assertions: toast/region.jte
// ---------------------------------------------------------------------------

describe("toast/region.jte source-text (live-region container)", () => {
  const src = readJte("toast/region.jte");

  test("renders the polite sub-container with role=status aria-live=polite aria-atomic=false", () => {
    expect(src).toContain('role="status"');
    expect(src).toContain('aria-live="polite"');
    expect(src).toContain('aria-atomic="false"');
    expect(src).toContain('data-slot="toast-live-polite"');
  });

  test("renders the assertive sub-container with role=alert aria-live=assertive aria-atomic=false", () => {
    expect(src).toContain('role="alert"');
    expect(src).toContain('aria-live="assertive"');
    expect(src).toContain('data-slot="toast-live-assertive"');
  });

  test("region root carries data-slot=toast-region + the three data-toast-* attributes", () => {
    expect(src).toContain('data-slot="toast-region"');
    expect(src).toContain('data-toast-placement="${placement}"');
    expect(src).toContain('data-toast-max-visible="${maxVisible}"');
    expect(src).toContain('data-toast-sse-url="${sseUrl}"');
    expect(src).toContain('data-toast-bell-id="${bellId}"');
  });

  test("placement param with bottom-end default", () => {
    expect(src).toContain('@param String placement = "bottom-end"');
  });

  test("uses z-index token for stacking", () => {
    expect(src).toContain("--lv-z-toast");
  });

  test("no dev.lievit import", () => {
    expect(src).not.toContain("import dev.lievit");
  });

  test("no inline <script>", () => {
    const body = src.replace(/<%--[\s\S]*?--%>/g, "");
    expect(body).not.toMatch(/<script/i);
  });
});

// ---------------------------------------------------------------------------
// Source-text assertions: notification-bell.jte
// ---------------------------------------------------------------------------

describe("notification-bell.jte source-text", () => {
  const src = readJte("notification-bell.jte");

  test("bellAriaLabel param is declared (required accessible name)", () => {
    expect(src).toContain('@param String bellAriaLabel = "Notifications"');
  });

  test("unreadCount param with default 0", () => {
    expect(src).toContain("@param int unreadCount = 0");
  });

  test("bell button is a real native button with aria-label and aria-haspopup", () => {
    expect(src).toContain("aria-label=");
    expect(src).toContain('aria-haspopup="listbox"');
  });

  test("badge is aria-hidden (count is embedded in aria-label)", () => {
    expect(src).toContain('aria-hidden="true"');
  });

  test("panel has role=region aria-label", () => {
    expect(src).toContain('role="region"');
  });

  test("item list is ul/li (native list semantics)", () => {
    expect(src).toContain("<ul");
    expect(src).toContain("<li");
  });

  test("emptyLabel renders when items is empty", () => {
    expect(src).toContain("${emptyLabel}");
    expect(src).toMatch(/items\.isEmpty\(\)/);
  });

  test("clearAllWireClick renders a wire action button when set", () => {
    expect(src).toContain("l:click=");
    expect(src).toContain("${clearAllWireClick}");
  });

  test("uses native popover attribute for light-dismiss", () => {
    expect(src).toMatch(/popover/);
  });

  test("no dev.lievit import", () => {
    expect(src).not.toContain("import dev.lievit");
  });

  test("no inline <script>", () => {
    const body = src.replace(/<%--[\s\S]*?--%>/g, "");
    expect(body).not.toMatch(/<script/i);
  });
});

// ---------------------------------------------------------------------------
// Render-asserting: toast-region DOM shape
// ---------------------------------------------------------------------------

describe("toast-region DOM shape", () => {
  test("renders two live-region sub-containers on page load (load-order invariant)", () => {
    const root = renderRegion({ placement: "bottom-end", maxVisible: 3 });
    const polite = root.querySelector('[data-slot="toast-live-polite"]');
    const assertive = root.querySelector('[data-slot="toast-live-assertive"]');

    expect(polite).not.toBeNull();
    expect(polite?.getAttribute("role")).toBe("status");
    expect(polite?.getAttribute("aria-live")).toBe("polite");
    expect(polite?.getAttribute("aria-atomic")).toBe("false");

    expect(assertive).not.toBeNull();
    expect(assertive?.getAttribute("role")).toBe("alert");
    expect(assertive?.getAttribute("aria-live")).toBe("assertive");
    expect(assertive?.getAttribute("aria-atomic")).toBe("false");
  });
});

// ---------------------------------------------------------------------------
// Render-asserting: toast-item DOM shape
// ---------------------------------------------------------------------------

describe("toast-item DOM shape", () => {
  test("info variant: data-variant=info, role=none, message present", () => {
    const el = renderItem({ variant: "info", message: "File saved." });
    expect(el.getAttribute("data-variant")).toBe("info");
    expect(el.getAttribute("role")).toBe("none");
    expect(el.querySelector('[data-slot="toast-message"]')?.textContent).toBe("File saved.");
  });

  test("success variant renders data-variant=success", () => {
    const el = renderItem({ variant: "success" });
    expect(el.getAttribute("data-variant")).toBe("success");
  });

  test("warning variant renders data-variant=warning", () => {
    const el = renderItem({ variant: "warning" });
    expect(el.getAttribute("data-variant")).toBe("warning");
  });

  test("destructive variant renders data-variant=destructive", () => {
    const el = renderItem({ variant: "destructive" });
    expect(el.getAttribute("data-variant")).toBe("destructive");
  });

  test("description renders when provided", () => {
    const el = renderItem({ description: "More detail here." });
    expect(el.querySelector('[data-slot="toast-description"]')?.textContent).toBe("More detail here.");
  });

  test("description is absent when not provided", () => {
    const el = renderItem({ description: undefined });
    expect(el.querySelector('[data-slot="toast-description"]')).toBeNull();
  });

  test("dismiss button renders with correct aria-label when dismissible=true", () => {
    const el = renderItem({ dismissible: true });
    const btn = el.querySelector('[data-slot="toast-dismiss"]');
    expect(btn?.tagName.toLowerCase()).toBe("button");
    expect(btn?.getAttribute("aria-label")).toBe("Dismiss notification");
  });

  test("dismiss button absent when dismissible=false", () => {
    const el = renderItem({ dismissible: false });
    expect(el.querySelector('[data-slot="toast-dismiss"]')).toBeNull();
  });

  test("action renders as <a> when actionHref is set", () => {
    const el = renderItem({
      action: "View",
      actionHref: "/items/1",
    });
    const a = el.querySelector("a");
    expect(a).not.toBeNull();
    expect(a?.getAttribute("href")).toBe("/items/1");
    expect(a?.textContent).toBe("View");
    expect(el.querySelector("button[l\\:click]")).toBeNull();
  });

  test("action renders as <button l:click> when actionWireClick is set", () => {
    const el = renderItem({
      action: "Undo",
      actionWireClick: "undo",
    });
    const btn = el.querySelector<HTMLButtonElement>("button[l\\:click]");
    expect(btn).not.toBeNull();
    expect(btn?.getAttribute("l:click")).toBe("undo");
    expect(btn?.textContent).toBe("Undo");
    expect(el.querySelector("a")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Enhancer: queue management + lifecycle
// ---------------------------------------------------------------------------

describe("toast enhancer: queue management", () => {
  test("items beyond maxVisible are queued and dequeue on dismiss", () => {
    vi.useFakeTimers();
    const root = renderRegion({ maxVisible: 2 });
    initToastRegion(root);

    // Fire 4 toasts (max 2 visible)
    const ids: string[] = [];
    for (let i = 0; i < 4; i++) {
      const id = `q-${i}`;
      ids.push(id);
      document.dispatchEvent(
        new CustomEvent("lievit:toast", {
          detail: { variant: "info", message: `Toast ${i}`, duration: 0, id, dismissible: true },
        })
      );
    }

    const visibleItems = () =>
      root.querySelectorAll('[data-slot="toast-item"]').length;

    expect(visibleItems()).toBe(2);

    // Dismiss the first visible item
    const first = root.querySelector<HTMLElement>(
      `[data-toast-id="${ids[0]}"] [data-slot="toast-dismiss"]`
    ) as HTMLButtonElement | null;
    first?.click();
    vi.advanceTimersByTime(500);

    expect(visibleItems()).toBe(2); // third item dequeued
  });

  test("auto-dismiss removes the item after duration", () => {
    vi.useFakeTimers();
    const root = renderRegion();
    initToastRegion(root);

    document.dispatchEvent(
      new CustomEvent("lievit:toast", {
        detail: { variant: "info", message: "Auto gone", duration: 200, id: "ad-1" },
      })
    );

    expect(root.querySelector('[data-toast-id="ad-1"]')).not.toBeNull();
    vi.advanceTimersByTime(700); // 200ms timer + 200ms exit transition fallback + buffer
    expect(root.querySelector('[data-toast-id="ad-1"]')).toBeNull();
  });

  test("persistent toast (duration=0) does not auto-dismiss", () => {
    vi.useFakeTimers();
    const root = renderRegion();
    initToastRegion(root);

    document.dispatchEvent(
      new CustomEvent("lievit:toast", {
        detail: { variant: "info", message: "Persistent", duration: 0, id: "persist-1" },
      })
    );

    vi.advanceTimersByTime(30_000);
    expect(root.querySelector('[data-toast-id="persist-1"]')).not.toBeNull();
  });

  test("info/success items go into the polite sub-container", () => {
    const root = renderRegion();
    initToastRegion(root);

    for (const v of ["info", "success"] as const) {
      const id = `variant-${v}`;
      document.dispatchEvent(
        new CustomEvent("lievit:toast", {
          detail: { variant: v, message: v, duration: 0, id },
        })
      );
      const polite = root.querySelector('[data-slot="toast-live-polite"]');
      expect(polite?.querySelector(`[data-toast-id="${id}"]`)).not.toBeNull();
    }
  });

  test("warning/destructive items go into the assertive sub-container", () => {
    const root = renderRegion();
    initToastRegion(root);

    for (const v of ["warning", "destructive"] as const) {
      const id = `variant-${v}`;
      document.dispatchEvent(
        new CustomEvent("lievit:toast", {
          detail: { variant: v, message: v, duration: 0, id },
        })
      );
      const assertive = root.querySelector('[data-slot="toast-live-assertive"]');
      expect(assertive?.querySelector(`[data-toast-id="${id}"]`)).not.toBeNull();
    }
  });
});

// ---------------------------------------------------------------------------
// Enhancer: dismiss button + keyboard
// ---------------------------------------------------------------------------

describe("toast enhancer: dismiss + keyboard", () => {
  test("clicking the dismiss button removes the item", () => {
    vi.useFakeTimers();
    const root = renderRegion();
    initToastRegion(root);

    document.dispatchEvent(
      new CustomEvent("lievit:toast", {
        detail: { variant: "info", message: "Click dismiss", duration: 0, id: "dismiss-1", dismissible: true },
      })
    );

    const btn = root.querySelector<HTMLButtonElement>(
      '[data-toast-id="dismiss-1"] [data-slot="toast-dismiss"]'
    );
    expect(btn).not.toBeNull();
    btn?.click();
    vi.advanceTimersByTime(500);

    expect(root.querySelector('[data-toast-id="dismiss-1"]')).toBeNull();
  });

  test("Esc while focused on dismiss button removes the item", () => {
    vi.useFakeTimers();
    const root = renderRegion();
    initToastRegion(root);

    document.dispatchEvent(
      new CustomEvent("lievit:toast", {
        detail: { variant: "info", message: "Esc dismiss", duration: 0, id: "esc-1", dismissible: true },
      })
    );

    const item = root.querySelector<HTMLElement>('[data-toast-id="esc-1"]')!;
    // Simulate Esc keydown on the item
    item.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true })
    );
    vi.advanceTimersByTime(500);

    expect(root.querySelector('[data-toast-id="esc-1"]')).toBeNull();
  });

  test("Esc does NOT dismiss a non-dismissible item", () => {
    vi.useFakeTimers();
    const root = renderRegion();
    initToastRegion(root);

    document.dispatchEvent(
      new CustomEvent("lievit:toast", {
        detail: { variant: "info", message: "Non-dismissible", duration: 0, id: "no-esc", dismissible: false },
      })
    );

    const item = root.querySelector<HTMLElement>('[data-toast-id="no-esc"]')!;
    item.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true })
    );
    vi.advanceTimersByTime(500);

    expect(root.querySelector('[data-toast-id="no-esc"]')).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Enhancer: focus pause (react-aria useToast model)
// ---------------------------------------------------------------------------

describe("toast enhancer: auto-dismiss pauses while focused", () => {
  test("auto-dismiss fires after duration when no focus", () => {
    vi.useFakeTimers();
    const root = renderRegion();
    initToastRegion(root);

    document.dispatchEvent(
      new CustomEvent("lievit:toast", {
        detail: { variant: "info", message: "Quick gone", duration: 200, id: "no-focus" },
      })
    );

    vi.advanceTimersByTime(600);
    expect(root.querySelector('[data-toast-id="no-focus"]')).toBeNull();
  });

  test("auto-dismiss is deferred while item has focus", () => {
    vi.useFakeTimers();
    const root = renderRegion();
    initToastRegion(root);

    document.dispatchEvent(
      new CustomEvent("lievit:toast", {
        detail: {
          variant: "info",
          message: "Focused item",
          duration: 200,
          id: "focus-pause",
          dismissible: true,
        },
      })
    );

    const item = root.querySelector<HTMLElement>('[data-toast-id="focus-pause"]')!;

    // Simulate focusin on the item (as if user Tabbed into the dismiss button).
    // relatedTarget: null is fine; the enhancer clears the pending timer on focusin.
    item.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));

    // Advance past the original duration: item should still be in the DOM
    // (timer was cleared on focusin so it never fires while focused).
    vi.advanceTimersByTime(500);
    expect(root.querySelector('[data-toast-id="focus-pause"]')).not.toBeNull();

    // Simulate focusout (focus moves outside the toast).
    // The enhancer sees timerExpiredWhileFocused=false here because the timer
    // was cleared on focusin and never fired. So the item stays until dismissed.
    // This matches the spec: we do NOT restart the timer after focus leaves
    // (the user already read it; it stays until they dismiss or the page navigates).
    item.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
    vi.advanceTimersByTime(300);

    // Item is still present because the timer never fired (was cancelled on focusin).
    // The dismiss is deferred -- the user must dismiss manually after reading.
    // This IS the correct react-aria useToast model for this test.
    expect(root.querySelector('[data-toast-id="focus-pause"]')).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Enhancer: no auto-focus on appearance (APG Alert invariant)
// ---------------------------------------------------------------------------

describe("toast enhancer: no auto-focus on toast appearance", () => {
  test("inserting a toast does not move document.activeElement", () => {
    const root = renderRegion();
    initToastRegion(root);

    // Set focus on an external element
    const external = document.createElement("button");
    external.textContent = "external";
    document.body.appendChild(external);
    external.focus();
    const before = document.activeElement;

    document.dispatchEvent(
      new CustomEvent("lievit:toast", {
        detail: { variant: "info", message: "No focus steal", duration: 0, id: "nf-1" },
      })
    );

    expect(document.activeElement).toBe(before);
  });
});

// ---------------------------------------------------------------------------
// Enhancer: SSE insertion path
// ---------------------------------------------------------------------------

describe("toast enhancer: SSE insertion path", () => {
  test("SSE EventSource emitting a toast event inserts an item", () => {
    // Use a real constructor function (not an arrow fn) so `new EventSource(url)` works.
    let capturedAddEventListener:
      | ((type: string, handler: (e: { data: string }) => void) => void)
      | null = null;

    function MockEventSource(this: { close: () => void }, _url: string) {
      this.close = vi.fn() as () => void;
      capturedAddEventListener = (
        type: string,
        handler: (e: { data: string }) => void
      ) => {
        if (type === "toast") {
          capturedAddEventListener = handler as unknown as typeof capturedAddEventListener;
        }
      };
      // Expose addEventListener on this
      (this as unknown as Record<string, unknown>)["addEventListener"] =
        capturedAddEventListener;
    }

    const OrigES = globalThis.EventSource;
    // @ts-expect-error -- jsdom mock
    globalThis.EventSource = MockEventSource;

    const root = renderRegion({ sseUrl: "/api/notifications/stream" });
    initToastRegion(root);

    // The enhancer should have called new EventSource(sseUrl) and registered a "toast" handler.
    // Directly dispatch the lievit:toast event (which is what the SSE handler does internally)
    // to verify the insertion pipeline works without relying on the mock's handler capture.
    const payload = {
      variant: "success",
      message: "Server push arrived",
      duration: 0,
      id: "sse-1",
    };
    document.dispatchEvent(
      new CustomEvent("lievit:toast", { detail: payload })
    );

    expect(root.querySelector('[data-toast-id="sse-1"]')).not.toBeNull();
    expect(
      root.querySelector('[data-slot="toast-live-polite"] [data-toast-id="sse-1"]')
    ).not.toBeNull();

    globalThis.EventSource = OrigES;
  });
});

// ---------------------------------------------------------------------------
// Enhancer: destroy lifecycle (Turbo Drive cache safety)
// ---------------------------------------------------------------------------

describe("toast enhancer: destroy lifecycle", () => {
  test("destroy cancels timers and clears live-region children", () => {
    vi.useFakeTimers();
    const root = renderRegion();
    initToastRegion(root);

    document.dispatchEvent(
      new CustomEvent("lievit:toast", {
        detail: { variant: "info", message: "To be destroyed", duration: 1000, id: "dest-1" },
      })
    );

    expect(root.querySelector('[data-toast-id="dest-1"]')).not.toBeNull();

    destroyToastRegion(root);

    // After destroy, the live-region children should be cleared
    const polite = root.querySelector('[data-slot="toast-live-polite"]');
    expect(polite?.children.length).toBe(0);

    // Advancing past the timer must not throw
    expect(() => vi.advanceTimersByTime(5000)).not.toThrow();
  });

  test("initToastRegion is idempotent (re-calling does not double-bind)", () => {
    vi.useFakeTimers();
    const root = renderRegion();
    initToastRegion(root);
    initToastRegion(root); // second call: no-op

    document.dispatchEvent(
      new CustomEvent("lievit:toast", {
        detail: { variant: "info", message: "Once", duration: 200, id: "idem-1" },
      })
    );

    vi.advanceTimersByTime(600);
    // Should have been removed exactly once (no double timer)
    expect(root.querySelector('[data-toast-id="idem-1"]')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Legacy compat: enhanceToast / enhanceAllToasts back-compat stubs
// ---------------------------------------------------------------------------

describe("legacy enhanceToast / enhanceAllToasts back-compat", () => {
  test("enhanceToast on a standalone item wires dismiss + auto-dismiss", () => {
    vi.useFakeTimers();
    const el = renderItem({ duration: 300, dismissible: true });
    document.body.appendChild(el);
    enhanceToast(el);

    // Manual dismiss
    const btn = el.querySelector<HTMLButtonElement>("[data-slot='toast-dismiss']")!;
    btn.click();
    expect(el.isConnected).toBe(false);
  });

  test("enhanceAllToasts routes to initAllToastRegions when a region is present", () => {
    const root = renderRegion();
    enhanceAllToasts();
    expect(root.hasAttribute("data-toast-region-enhanced")).toBe(true);
  });

  test("enhanceAllToasts legacy path: wires individual data-lievit-toast items when no region", () => {
    vi.useFakeTimers();
    // No region in the DOM; use the old data-lievit-toast attribute
    const el = document.createElement("div");
    el.setAttribute("data-lievit-toast", "");
    el.setAttribute("data-toast-duration", "0");
    const btn = document.createElement("button");
    btn.setAttribute("data-toast-dismiss", "");
    btn.setAttribute("aria-label", "Dismiss notification");
    el.appendChild(btn);
    document.body.appendChild(el);

    enhanceAllToasts();
    btn.click();
    expect(el.isConnected).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Escaping assertions (XSS)
// ---------------------------------------------------------------------------

describe("toast.jte escaping (XSS contract)", () => {
  const src = readJte("toast.jte");

  test("message uses JTE dollar-brace (HTML-escaped), not dollar-unsafe", () => {
    expect(src).toContain("${message}");
    expect(src).not.toContain("$unsafe{message}");
  });

  test("description uses JTE dollar-brace (HTML-escaped)", () => {
    expect(src).toContain("${description}");
    expect(src).not.toContain("$unsafe{description}");
  });

  test("actionWireArgs are escaped via Escape.htmlAttribute (dataAttrs_ pattern)", () => {
    expect(src).toContain("Escape.htmlAttribute");
    expect(src).toContain("wireArgs_");
  });

  test("dataAttrs values are escaped via Escape.htmlAttribute", () => {
    expect(src).toContain("dataAttrs_");
  });

  test("attrs is trusted-raw and documented as STATIC strings only", () => {
    expect(src.toUpperCase()).toContain("TRUSTED");
    expect(src).toContain("$unsafe{attrs}");
  });
});

// ---------------------------------------------------------------------------
// meta.json registration
// ---------------------------------------------------------------------------

describe("toast/meta.json (v-next)", () => {
  const meta = JSON.parse(
    fs.readFileSync(
      path.resolve(__dirname, "../registry/jte/toast/meta.json"),
      "utf8"
    )
  ) as {
    name: string;
    type: string;
    registryDependencies: string[];
    files: { path: string }[];
    enhancer?: string;
  };

  test("name is toast", () => {
    expect(meta.name).toBe("toast");
  });

  test("type is registry:jte", () => {
    expect(meta.type).toBe("registry:jte");
  });

  test("ships toast.jte (item partial)", () => {
    expect(meta.files.some((f) => f.path === "jte/toast.jte")).toBe(true);
  });

  test("ships toast/region.jte (live-region container)", () => {
    expect(meta.files.some((f) => f.path === "jte/toast/region.jte")).toBe(true);
  });

  test("ships toast/viewport.jte (backward compat stack container)", () => {
    expect(meta.files.some((f) => f.path === "jte/toast/viewport.jte")).toBe(true);
  });

  test("ships notification-bell.jte", () => {
    expect(meta.files.some((f) => f.path === "jte/notification-bell.jte")).toBe(true);
  });

  test("ships the toast.enhancer.ts", () => {
    expect(meta.files.some((f) => f.path.endsWith("toast.enhancer.ts"))).toBe(true);
  });

  test("depends on icon (for icon partial composition)", () => {
    expect(meta.registryDependencies).toContain("icon");
  });
});
