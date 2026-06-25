/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * `lv-toast-region` -- the transient toast live-region manager, as a Stimulus controller (the
 * conversion of `registry/jte/toast.enhancer.ts`'s `RegionEnhancer`). Mounted on the
 * server-rendered region root via `data-controller="lv-toast-region"`; the region carries the two
 * always-present live-region sub-containers (`data-slot="toast-live-polite"` / `...-assertive`)
 * plus the `data-toast-*` configuration (max-visible, sse-url, bell-id).
 *
 * It owns ALL the ephemeral toast behaviour the server cannot: a maxVisible queue, per-item
 * countdown timers PAUSED while the item is focused (react-aria useToast model), Esc-dismiss with
 * focus restore, the three insertion paths (the global `lievit:toast` DOM event from the wire morph
 * hook / `window.lievit.toast()`, the `data-toast-sse-url` EventSource, both converging on
 * {@link enqueue}), and the notification-bell unread counter.
 *
 * NOT a {@link DismissableController}: a toast NEVER round-trips the wire on close (no
 * `data-lv-wire-close`); dismissal is purely client-side ephemeral state, so the
 * controlled/uncontrolled doctrine simply does not apply (it would always be uncontrolled). And per
 * the WAI-ARIA APG Alert pattern a toast MUST NOT steal focus, so there is no {@link FocusTrap}
 * either; the only focus concern is restoring focus to wherever the user tabbed FROM when they
 * dismiss an item they had tabbed INTO (handled per-item in {@link wireFocusTracking}).
 *
 * Morph-safety (the whole point of the migration): the global `lievit:toast` listener + the
 * EventSource are bound in {@link connect} and torn down in {@link disconnect}, so the wire morph /
 * Turbo Drive cache restoration cannot stack a second listener (which would double every toast) and
 * a navigated-away region cancels its timers + closes its stream for free. The old enhancer leaked
 * that document listener (an un-removed anonymous handler guarded only by a `destroyed` flag) and
 * tracked enhanced-ness with a `data-toast-region-enhanced` marker + a WeakMap; Stimulus replaces
 * both -- it connects this controller exactly once per element and disconnects it on removal.
 *
 * Per-item listeners (dismiss click, focusin/out, Esc keydown) stay as direct `addEventListener`
 * rather than template `data-action`, because the toast items are NOT server-rendered: this
 * controller BUILDS them in {@link buildItemElement} and `.remove()`s them itself (and removes any
 * survivors in {@link disconnect}). They are never morphed, so the leaked-listener-across-morph
 * concern that motivates `data-action` does not exist for them; binding synchronously at build time
 * is the correct way to wire DOM a component fully owns.
 *
 * a11y source: WAI-ARIA APG Alert (live-region role + no focus-steal); react-aria useToast as the
 * interaction reference for pause-on-focus + Esc-dismiss + focus restore.
 */

import { Controller } from "@hotwired/stimulus";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A toast payload as it arrives on any of the three insertion paths. */
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

/** Per-visible-item ephemeral state the controller tracks while the item lives. */
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
// Pure helpers (variant -> token / icon / live-region routing)
// ---------------------------------------------------------------------------

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

function accentFor(variant: string): string {
  switch (variant) {
    case "success":
      return "var(--lv-color-success)";
    case "warning":
      return "var(--lv-color-warning)";
    case "destructive":
    case "danger":
      return "var(--lv-color-destructive)";
    default:
      return "var(--lv-color-info)";
  }
}

function iconSlugFor(override: string, variant: string): string {
  if (override) return override;
  switch (variant) {
    case "success":
      return "circle-check";
    case "warning":
      return "triangle-alert";
    case "destructive":
    case "danger":
      return "circle-x";
    default:
      return "info";
  }
}

/** Minimal inline SVG for the four Lucide icons used by toast items. CSP-clean. */
function inlineSvgFor(slug: string): string {
  const base =
    'xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"';
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
// Controller
// ---------------------------------------------------------------------------

export default class LvToastRegionController extends Controller<HTMLElement> {
  private politeContainer: HTMLElement | null = null;
  private assertiveContainer: HTMLElement | null = null;
  private maxVisible = 5;
  private bellButton: HTMLButtonElement | null = null;

  private readonly queue: ToastPayload[] = [];
  private readonly active = new Map<string, ManagedItem>();
  private sse: EventSource | null = null;

  /** Object-identity handler so {@link disconnect} can remove exactly what {@link connect} bound. */
  private readonly onToastEvent = (e: Event): void => {
    const payload = (e as CustomEvent<ToastPayload>).detail;
    if (payload) this.enqueue(payload);
  };

  /** Count active (visible) items. */
  private get visibleCount(): number {
    return this.active.size;
  }

  connect(): void {
    this.politeContainer = this.element.querySelector<HTMLElement>(
      '[data-slot="toast-live-polite"]',
    );
    this.assertiveContainer = this.element.querySelector<HTMLElement>(
      '[data-slot="toast-live-assertive"]',
    );
    this.maxVisible = parseInt(this.element.dataset["toastMaxVisible"] ?? "5", 10) || 5;

    const bellId = this.element.dataset["toastBellId"];
    this.bellButton = bellId
      ? document.querySelector<HTMLButtonElement>(
          `#${CSS.escape(bellId)} [data-slot="bell-button"], [data-slot="notification-bell"][id="${CSS.escape(bellId)}"] [data-slot="bell-button"]`,
        )
      : null;

    document.addEventListener("lievit:toast", this.onToastEvent);
    this.bindSse();
  }

  disconnect(): void {
    document.removeEventListener("lievit:toast", this.onToastEvent);
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
  // Insertion (all three paths converge here)
  // -------------------------------------------------------------------------

  /** Insert a toast payload (event / SSE / JS API all converge here). */
  enqueue(payload: ToastPayload): void {
    if (this.visibleCount < this.maxVisible) {
      this.show(payload);
    } else {
      this.queue.push(payload);
    }
    this.incrementBell();
  }

  private show(payload: ToastPayload): void {
    const variant = payload.variant ?? "info";
    const duration = payload.duration ?? 5000;
    const dismissible = payload.dismissible !== false;
    const id = payload.id ?? crypto.randomUUID();

    const el = this.buildItemElement(payload, id);
    const container = isAssertive(variant) ? this.assertiveContainer : this.politeContainer;
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
    body.style.cssText =
      "flex:1;min-width:0;display:flex;flex-direction:column;gap:var(--lv-space-1);";

    const msg = document.createElement("p");
    msg.setAttribute("data-slot", "toast-message");
    msg.style.cssText =
      "margin:0;font-size:var(--lv-text-sm);font-weight:var(--lv-font-medium);line-height:var(--lv-leading-tight);color:var(--lv-color-fg);";
    msg.textContent = payload.message;
    body.appendChild(msg);

    if (payload.description) {
      const desc = document.createElement("p");
      desc.setAttribute("data-slot", "toast-description");
      desc.style.cssText =
        "margin:0;font-size:var(--lv-text-xs);line-height:var(--lv-leading);color:var(--lv-color-muted);";
      desc.textContent = payload.description;
      body.appendChild(desc);
    }

    if (payload.action) {
      if (payload.actionHref) {
        const a = document.createElement("a");
        a.href = payload.actionHref;
        a.style.cssText =
          "display:inline-block;margin-top:var(--lv-space-1);font-size:var(--lv-text-xs);font-weight:var(--lv-font-medium);text-decoration:underline;color:var(--lv-color-primary);outline:none;";
        a.textContent = payload.action;
        body.appendChild(a);
      } else if (payload.actionWireClick) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.setAttribute("l:click", payload.actionWireClick);
        btn.style.cssText =
          "display:inline-block;margin-top:var(--lv-space-1);font-size:var(--lv-text-xs);font-weight:var(--lv-font-medium);text-decoration:underline;color:var(--lv-color-primary);background:none;border:0;padding:0;cursor:pointer;outline:none;";
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
      dismiss.style.cssText =
        "flex-shrink:0;background:none;border:0;padding:var(--lv-space-1);cursor:pointer;color:var(--lv-color-muted);display:flex;align-items:center;justify-content:center;border-radius:var(--lv-radius-sm);margin:calc(-1 * var(--lv-space-1));outline:none;";
      dismiss.innerHTML =
        '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
      el.appendChild(dismiss);
    }

    return el;
  }

  // -------------------------------------------------------------------------
  // Timer + focus management (react-aria useToast: pause-on-focus)
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

  private wireDismissButton(el: HTMLElement, id: string, managed: ManagedItem): void {
    const btn = el.querySelector<HTMLButtonElement>('[data-slot="toast-dismiss"]');
    btn?.addEventListener("click", () => this.dismiss(id, managed));
  }

  private wireKeydown(
    el: HTMLElement,
    id: string,
    managed: ManagedItem,
    dismissible: boolean,
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
  // SSE insertion path
  // -------------------------------------------------------------------------

  private bindSse(): void {
    const sseUrl = this.element.dataset["toastSseUrl"];
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
    const current = parseInt(this.bellButton.dataset["unreadCount"] ?? "0", 10);
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
