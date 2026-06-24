/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * toast enhancer (v-next, ADR-0012 server-first).
 *
 * Owns all ephemeral client-side toast behaviour:
 *   - Queue management (maxVisible cap, FIFO dequeue on dismiss).
 *   - Three insertion paths: (1) lievit:toast DOM event (wire morph hook),
 *     (2) EventSource SSE (data-toast-sse-url), (3) window.lievit.toast() JS API.
 *   - Countdown timers; PAUSE while the item has keyboard focus (react-aria useToast model).
 *   - Esc-dismiss with focus restore to the element that was focused before Tab entered the toast.
 *   - Exit transition: adds [data-dismissing] so CSS can fade/slide out, then removes after
 *     --lv-motion-exit duration (falls back to 200ms).
 *   - Notification-bell counter: when data-toast-bell-id is set on the region root, the enhancer
 *     increments data-unread-count + refreshes aria-label on the bell button.
 *   - Lifecycle: init() activates on [data-slot="toast-region"]; destroy() cancels all timers +
 *     clears live-region children (Turbo Drive cache-restoration safety).
 *
 * CSP-clean: no eval, no inline script. Registers via the lievit lifecycle registry.
 * Dependency-free typed-TS vanilla module.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ToastPayload {
  variant?: string;
  message: string;
  description?: string;
  duration?: number;
  dismissible?: boolean;
  id?: string;
  icon?: string;
  action?: string;
  actionHref?: string;
  actionWireClick?: string;
}

interface ManagedItem {
  element: HTMLElement;
  timerId?: ReturnType<typeof setTimeout>;
  /** The element that had focus before the user tabbed into this toast. */
  preFocusTarget: Element | null;
  /** Whether focus is currently inside this toast item. */
  focused: boolean;
  /** Whether the timer fired while focus was inside (dismissal was deferred). */
  timerExpiredWhileFocused: boolean;
  duration: number;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const ENHANCED_ATTR = "data-toast-region-enhanced";

/** Variants that use the assertive (interrupt) live region. */
function isAssertive(variant: string): boolean {
  return variant === "warning" || variant === "destructive" || variant === "danger";
}

/** Read the --lv-motion-exit duration from the document root (ms). Fallback 200ms. */
function exitDuration(): number {
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue("--lv-motion-exit")
    .trim();
  if (!raw) return 200;
  if (raw.endsWith("ms")) return parseFloat(raw) || 200;
  if (raw.endsWith("s")) return (parseFloat(raw) || 0.2) * 1000;
  return 200;
}

// ---------------------------------------------------------------------------
// RegionEnhancer — per-region controller
// ---------------------------------------------------------------------------

class RegionEnhancer {
  private readonly root: HTMLElement;
  private readonly politeContainer: HTMLElement | null;
  private readonly assertiveContainer: HTMLElement | null;
  private readonly maxVisible: number;
  private readonly bellButton: HTMLButtonElement | null;

  private readonly queue: ToastPayload[] = [];
  private readonly active = new Map<string, ManagedItem>();
  private sse: EventSource | null = null;
  private destroyed = false;

  /** Count active (visible) items. */
  private get visibleCount(): number {
    return this.active.size;
  }

  constructor(root: HTMLElement) {
    this.root = root;
    this.politeContainer =
      root.querySelector<HTMLElement>('[data-slot="toast-live-polite"]');
    this.assertiveContainer =
      root.querySelector<HTMLElement>('[data-slot="toast-live-assertive"]');
    this.maxVisible = parseInt(root.dataset["toastMaxVisible"] ?? "5", 10) || 5;

    const bellId = root.dataset["toastBellId"];
    this.bellButton = bellId
      ? document.querySelector<HTMLButtonElement>(
          `#${CSS.escape(bellId)} [data-slot="bell-button"], [data-slot="notification-bell"][id="${CSS.escape(bellId)}"] [data-slot="bell-button"]`
        )
      : null;

    this.bindEventListener();
    this.bindSse();
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /** Insert a toast payload (all three insertion paths converge here). */
  enqueue(payload: ToastPayload): void {
    if (this.destroyed) return;
    if (this.visibleCount < this.maxVisible) {
      this.show(payload);
    } else {
      this.queue.push(payload);
    }
    this.incrementBell();
  }

  /** Cancel all timers, remove all items, close SSE. Safe to call multiple times. */
  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.sse?.close();
    this.sse = null;
    for (const item of this.active.values()) {
      clearTimeout(item.timerId);
      item.element.remove();
    }
    this.active.clear();
    this.queue.length = 0;
    if (this.politeContainer) this.politeContainer.innerHTML = "";
    if (this.assertiveContainer) this.assertiveContainer.innerHTML = "";
  }

  // -------------------------------------------------------------------------
  // Insertion
  // -------------------------------------------------------------------------

  private show(payload: ToastPayload): void {
    const variant = payload.variant ?? "info";
    const duration = payload.duration ?? 5000;
    const dismissible = payload.dismissible !== false;
    const id = payload.id ?? crypto.randomUUID();

    const el = this.buildItemElement(payload, id);
    const container = isAssertive(variant)
      ? this.assertiveContainer
      : this.politeContainer;
    container?.appendChild(el);

    const managed: ManagedItem = {
      element: el,
      timerId: undefined,
      preFocusTarget: null,
      focused: false,
      timerExpiredWhileFocused: false,
      duration,
    };

    this.active.set(id, managed);
    this.wireDismissButton(el, id, managed);
    this.wireKeydown(el, id, managed, dismissible);
    this.wireFocusTracking(el, managed);
    this.startTimer(id, managed, duration);
  }

  private buildItemElement(payload: ToastPayload, id: string): HTMLElement {
    const variant = payload.variant ?? "info";
    const duration = payload.duration ?? 5000;
    const dismissible = payload.dismissible !== false;

    const accentColor = accentFor(variant);
    const iconColor = accentColor;
    const resolvedIcon = iconSlugFor(payload.icon ?? "", variant);

    const el = document.createElement("div");
    el.setAttribute("data-slot", "toast-item");
    el.setAttribute("data-variant", variant);
    el.setAttribute("data-toast-id", id);
    el.setAttribute("data-toast-duration", String(duration));
    el.setAttribute("role", "none");
    el.style.cssText = [
      "pointer-events:auto",
      "display:flex",
      "align-items:flex-start",
      `gap:var(--lv-space-3)`,
      "border-radius:var(--lv-radius-lg)",
      "background:var(--lv-color-bg)",
      "border:1px solid var(--lv-color-border)",
      "border-left:4px solid " + accentColor,
      "box-shadow:var(--lv-shadow-md)",
      "padding:var(--lv-space-4)",
      "min-width:var(--lv-space-72,18rem)",
      "max-width:var(--lv-space-96,24rem)",
      "font-family:var(--lv-font-sans)",
    ].join(";");

    // Icon
    const iconWrap = document.createElement("span");
    iconWrap.setAttribute("aria-hidden", "true");
    iconWrap.style.cssText = `flex-shrink:0;width:var(--lv-space-5,1.25rem);height:var(--lv-space-5,1.25rem);color:${iconColor};display:flex;align-items:center;justify-content:center;`;
    iconWrap.innerHTML = inlineSvgFor(resolvedIcon);
    el.appendChild(iconWrap);

    // Body
    const body = document.createElement("div");
    body.setAttribute("data-slot", "toast-body");
    body.style.cssText = "flex:1;min-width:0;display:flex;flex-direction:column;gap:var(--lv-space-1);";

    const msg = document.createElement("p");
    msg.setAttribute("data-slot", "toast-message");
    msg.style.cssText = "margin:0;font-size:var(--lv-text-sm);font-weight:var(--lv-font-medium);line-height:var(--lv-leading-tight);color:var(--lv-color-fg);";
    msg.textContent = payload.message;
    body.appendChild(msg);

    if (payload.description) {
      const desc = document.createElement("p");
      desc.setAttribute("data-slot", "toast-description");
      desc.style.cssText = "margin:0;font-size:var(--lv-text-xs);line-height:var(--lv-leading);color:var(--lv-color-muted);";
      desc.textContent = payload.description;
      body.appendChild(desc);
    }

    if (payload.action) {
      if (payload.actionHref) {
        const a = document.createElement("a");
        a.href = payload.actionHref;
        a.style.cssText = "display:inline-block;margin-top:var(--lv-space-1);font-size:var(--lv-text-xs);font-weight:var(--lv-font-medium);text-decoration:underline;color:var(--lv-color-primary);outline:none;";
        a.textContent = payload.action;
        body.appendChild(a);
      } else if (payload.actionWireClick) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.setAttribute("l:click", payload.actionWireClick);
        btn.style.cssText = "display:inline-block;margin-top:var(--lv-space-1);font-size:var(--lv-text-xs);font-weight:var(--lv-font-medium);text-decoration:underline;color:var(--lv-color-primary);background:none;border:0;padding:0;cursor:pointer;outline:none;";
        btn.textContent = payload.action;
        body.appendChild(btn);
      }
    }

    el.appendChild(body);

    // Dismiss button
    if (dismissible) {
      const dismiss = document.createElement("button");
      dismiss.type = "button";
      dismiss.setAttribute("data-slot", "toast-dismiss");
      dismiss.setAttribute("aria-label", "Dismiss notification");
      dismiss.style.cssText = "flex-shrink:0;background:none;border:0;padding:var(--lv-space-1);cursor:pointer;color:var(--lv-color-muted);display:flex;align-items:center;justify-content:center;border-radius:var(--lv-radius-sm);margin:calc(-1 * var(--lv-space-1));outline:none;";
      dismiss.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
      el.appendChild(dismiss);
    }

    return el;
  }

  // -------------------------------------------------------------------------
  // Timer + focus management
  // -------------------------------------------------------------------------

  private startTimer(id: string, managed: ManagedItem, duration: number): void {
    if (duration <= 0) return;
    managed.timerId = setTimeout(() => {
      if (managed.focused) {
        // Defer: the user is reading the toast. Dismiss on focusout.
        managed.timerExpiredWhileFocused = true;
      } else {
        this.dismiss(id, managed);
      }
    }, duration);
  }

  private wireFocusTracking(el: HTMLElement, managed: ManagedItem): void {
    el.addEventListener("focusin", () => {
      if (!managed.focused) {
        managed.preFocusTarget = document.activeElement;
      }
      managed.focused = true;
      // Pause: clear the existing timer so it won't fire while focused.
      clearTimeout(managed.timerId);
      managed.timerId = undefined;
    });

    el.addEventListener("focusout", (e) => {
      // Check if focus moved outside the toast item.
      if (el.contains(e.relatedTarget as Node | null)) return;
      managed.focused = false;
      if (managed.timerExpiredWhileFocused) {
        // Timer had elapsed while focused; dismiss now.
        const id = el.dataset["toastId"] ?? "";
        this.dismiss(id, managed);
      }
      // Note: we do NOT restart the timer after focus leaves to avoid confusing
      // the user -- if focus left via Tab without Esc, the toast was already seen.
    });
  }

  // -------------------------------------------------------------------------
  // Dismiss + keyboard
  // -------------------------------------------------------------------------

  private wireDismissButton(
    el: HTMLElement,
    id: string,
    managed: ManagedItem
  ): void {
    const btn = el.querySelector<HTMLButtonElement>('[data-slot="toast-dismiss"]');
    btn?.addEventListener("click", () => this.dismiss(id, managed));
  }

  private wireKeydown(
    el: HTMLElement,
    id: string,
    managed: ManagedItem,
    dismissible: boolean
  ): void {
    el.addEventListener("keydown", (e: KeyboardEvent) => {
      if (e.key === "Escape" && dismissible) {
        e.stopPropagation();
        this.dismiss(id, managed);
      }
    });
  }

  private dismiss(id: string, managed: ManagedItem): void {
    if (!this.active.has(id)) return;
    clearTimeout(managed.timerId);
    managed.timerId = undefined;
    this.active.delete(id);

    const el = managed.element;
    el.setAttribute("data-dismissing", "");

    setTimeout(() => {
      el.remove();
      // Restore focus if the user had tabbed into this toast.
      if (managed.preFocusTarget instanceof HTMLElement) {
        managed.preFocusTarget.focus();
      }
      // Dequeue next pending item.
      this.dequeue();
    }, exitDuration());
  }

  private dequeue(): void {
    if (this.queue.length > 0 && this.visibleCount < this.maxVisible) {
      const next = this.queue.shift();
      if (next) this.show(next);
    }
  }

  // -------------------------------------------------------------------------
  // Insertion paths
  // -------------------------------------------------------------------------

  private bindEventListener(): void {
    document.addEventListener("lievit:toast", (e: Event) => {
      const payload = (e as CustomEvent<ToastPayload>).detail;
      if (payload) this.enqueue(payload);
    });
  }

  private bindSse(): void {
    const sseUrl = this.root.dataset["toastSseUrl"];
    if (!sseUrl) return;
    const source = new EventSource(sseUrl);
    this.sse = source;
    source.addEventListener("toast", (e: MessageEvent) => {
      try {
        const payload = JSON.parse(e.data) as ToastPayload;
        this.enqueue(payload);
      } catch {
        // Malformed SSE event; ignore.
      }
    });
  }

  // -------------------------------------------------------------------------
  // Notification bell counter
  // -------------------------------------------------------------------------

  private incrementBell(): void {
    if (!this.bellButton) return;
    const current = parseInt(
      this.bellButton.dataset["unreadCount"] ?? "0",
      10
    );
    const next = current + 1;
    this.bellButton.dataset["unreadCount"] = String(next);

    // Update aria-label to embed the count.
    const base = this.bellButton.getAttribute("aria-label") ?? "Notifications";
    // Strip an existing count suffix like ", 2 unread".
    const stripped = base.replace(/,\s*\d+\+?\s*unread$/i, "");
    this.bellButton.setAttribute("aria-label", `${stripped}, ${next} unread`);

    // Show/update the badge span.
    let badge = this.bellButton.querySelector<HTMLElement>('[data-slot="badge"]');
    if (!badge) {
      badge = document.createElement("span");
      badge.setAttribute("data-slot", "badge");
      badge.setAttribute("aria-hidden", "true");
      badge.style.cssText =
        "position:absolute;top:0.125rem;right:0.125rem;min-width:1rem;height:1rem;padding:0 0.25rem;border-radius:9999px;background:var(--lv-color-destructive);color:var(--lv-color-destructive-fg);font-size:var(--lv-text-xs);font-weight:var(--lv-font-semibold);line-height:1rem;text-align:center;display:flex;align-items:center;justify-content:center;";
      this.bellButton.appendChild(badge);
    }
    badge.textContent = next > 99 ? "99+" : String(next);
  }
}

// ---------------------------------------------------------------------------
// SVG helpers (CSP-clean inline markup for icon glyphs)
// ---------------------------------------------------------------------------

function accentFor(variant: string): string {
  switch (variant) {
    case "success":     return "var(--lv-color-success)";
    case "warning":     return "var(--lv-color-warning)";
    case "destructive":
    case "danger":      return "var(--lv-color-destructive)";
    default:            return "var(--lv-color-info)";
  }
}

function iconSlugFor(override: string, variant: string): string {
  if (override) return override;
  switch (variant) {
    case "success":     return "circle-check";
    case "warning":     return "triangle-alert";
    case "destructive":
    case "danger":      return "circle-x";
    default:            return "info";
  }
}

/** Minimal inline SVG for the four Lucide icons used by toast items. CSP-clean. */
function inlineSvgFor(slug: string): string {
  const base = 'xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"';
  switch (slug) {
    case "circle-check":
      return `<svg ${base}><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>`;
    case "triangle-alert":
      return `<svg ${base}><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 3 22h18a2 2 0 0 0 .73-4"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>`;
    case "circle-x":
      return `<svg ${base}><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>`;
    default: // "info"
      return `<svg ${base}><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>`;
  }
}

// ---------------------------------------------------------------------------
// Registry map + public init/destroy API
// ---------------------------------------------------------------------------

const regionMap = new WeakMap<HTMLElement, RegionEnhancer>();

/**
 * Initialise the toast region on a given root element.
 * Idempotent: re-calling on an already-enhanced root is a no-op.
 */
export function initToastRegion(root: HTMLElement): void {
  if (root.hasAttribute(ENHANCED_ATTR)) return;
  root.setAttribute(ENHANCED_ATTR, "");
  regionMap.set(root, new RegionEnhancer(root));
}

/**
 * Destroy the toast region on a given root element (cancels timers, clears DOM).
 * Safe to call on an unenhanced root.
 */
export function destroyToastRegion(root: HTMLElement): void {
  regionMap.get(root)?.destroy();
  regionMap.delete(root);
  root.removeAttribute(ENHANCED_ATTR);
}

/**
 * Init all toast regions on the page (call on load + after DOM swaps).
 * The enhancer also listens for the global `lievit:toast` event so wire morph
 * hooks and the `window.lievit.toast()` path work without re-calling this.
 */
export function initAllToastRegions(scope: ParentNode = document): void {
  scope
    .querySelectorAll<HTMLElement>('[data-slot="toast-region"]')
    .forEach((root) => initToastRegion(root));
}

/**
 * Destroy all toast regions found in scope.
 * The lievit lifecycle registry calls this in the `destroy` hook (Turbo Drive cache safety).
 */
export function destroyAllToastRegions(scope: ParentNode = document): void {
  scope
    .querySelectorAll<HTMLElement>('[data-slot="toast-region"]')
    .forEach((root) => destroyToastRegion(root));
}

// ---------------------------------------------------------------------------
// Legacy surface: enhanceToast / enhanceAllToasts kept for back-compat
// (the old enhancer operated on individual [data-lievit-toast] items;
// the v-next enhancer operates on the region. These stubs let existing
// call-sites compile without changes -- they route to initAllToastRegions.)
// ---------------------------------------------------------------------------

/** @deprecated Use initToastRegion / initAllToastRegions. */
export function enhanceToast(root: HTMLElement): void {
  // v-next: if this root is a toast item inside a region, the region enhancer
  // already owns it. If it is a standalone item (legacy usage), wire dismiss + timer.
  if (root.hasAttribute("data-toast-region-enhanced")) return;
  if (root.hasAttribute("data-toast-enhanced")) return;
  root.setAttribute("data-toast-enhanced", "");

  const duration = Number(root.getAttribute("data-toast-duration") ?? "0");
  let timer: ReturnType<typeof setTimeout> | undefined;
  if (Number.isFinite(duration) && duration > 0) {
    timer = setTimeout(() => root.remove(), duration);
  }
  const dismiss = root.querySelector<HTMLButtonElement>(
    "[data-slot='toast-dismiss'],[data-toast-dismiss]"
  );
  dismiss?.addEventListener("click", () => {
    clearTimeout(timer);
    root.remove();
  });
}

/** @deprecated Use initAllToastRegions. */
export function enhanceAllToasts(scope: ParentNode = document): void {
  // If a toast-region is present, use the v-next path.
  const regions = scope.querySelectorAll<HTMLElement>('[data-slot="toast-region"]');
  if (regions.length > 0) {
    regions.forEach((r) => initToastRegion(r));
    return;
  }
  // Legacy fallback: wire individual items.
  scope
    .querySelectorAll<HTMLElement>("[data-lievit-toast]")
    .forEach((root) => enhanceToast(root));
}
