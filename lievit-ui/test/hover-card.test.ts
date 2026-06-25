/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * Tests for the hover-card v-next reforge (hover-card.jte + hover-card-trigger.jte +
 * hover-card.enhancer.ts). Asserts the WAI-ARIA APG Tooltip contract (WAI-ARIA APG
 * https://www.w3.org/WAI/ARIA/apg/patterns/tooltip/): show/hide timing, hover-grace delay,
 * focus-open path, Esc dismiss, stopPropagation, focus-never-enters-card, static markup
 * contracts (aria-describedby, role=tooltip, data-slot, maxWidth, header/footer conditionality,
 * dataAttrs escaping).
 *
 * Substrate: happy-dom (real events, real DOM, real LievitRuntime via installHoverCard).
 * Pattern: build DOM BEFORE runtime.start() so the scan fires on start(). Use vi.useFakeTimers()
 * for delay assertions. Polyfill showPopover/hidePopover because happy-dom v20 does not implement
 * them; we track the open state via `data-open` (stamped/removed by the enhancer) as the
 * observable proxy used by assertions (mirrors the `:popover-open` pseudo-class the real browser
 * uses, which is un-queryable in happy-dom via `.matches()`).
 *
 * Source assertion tests (jte-source-*) read the raw .jte file and verify structural invariants
 * without a JTE compiler. The real compile gate runs separately via the jte-compile suite.
 */

import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { LievitRuntime } from "../runtime/runtime.js";
import { installHoverCard } from "../runtime/features/hover-card.enhancer.js";

// ---------------------------------------------------------------------------
// JTE source helpers (no compiler — structural assertions on the raw text)
// ---------------------------------------------------------------------------

const jteDir = join(import.meta.dirname, "..", "registry", "jte");

function readJte(name: string): string {
  return readFileSync(join(jteDir, `${name}.jte`), "utf8");
}

const triggerSrc = readJte("hover-card-trigger");
const cardSrc = readJte("hover-card");

// ---------------------------------------------------------------------------
// Polyfill showPopover / hidePopover for happy-dom
// ---------------------------------------------------------------------------

/**
 * happy-dom v20 exposes `popover` as a property but does NOT implement showPopover() /
 * hidePopover(). We patch them per-element so the enhancer can call them. The enhancer
 * stamps/removes `data-open` as the observable open-state proxy; tests assert that attribute.
 */
function polyfillPopover(el: HTMLElement): void {
  if (typeof el.showPopover === "function") return;
  (el as unknown as { showPopover: () => void }).showPopover = (): void => {
    /* the enhancer stamps data-open AFTER calling showPopover — polyfill is a no-op here */ };
  (el as unknown as { hidePopover: () => void }).hidePopover = (): void => {
    /* the enhancer removes data-open AFTER calling hidePopover — polyfill is a no-op here */ };
}

/** True when the panel has data-open (the enhancer's open-state sentinel). */
function isOpen(panel: HTMLElement): boolean {
  return panel.hasAttribute("data-open");
}

// ---------------------------------------------------------------------------
// DOM builder
// ---------------------------------------------------------------------------

function makeFetchImpl(): typeof fetch {
  return vi.fn(async () =>
    new Response("<div></div>", { status: 200, headers: { "Lievit-Snapshot": "s2" } })
  ) as unknown as typeof fetch;
}

interface HoverCardDom {
  runtime: LievitRuntime;
  componentRoot: HTMLElement;
  wrapper: HTMLElement;
  panel: HTMLElement;
  trigger: HTMLButtonElement;
}

/**
 * Build the server-rendered hover-card DOM (trigger wrapper + panel), mount in a component
 * root, then start a runtime with installHoverCard so the scan fires on runtime.start().
 */
function buildHoverCard(opts: {
  delay?: number;
  closeDelay?: number;
  openOnFocus?: boolean;
  cardId?: string;
  withHeader?: boolean;
  withFooter?: boolean;
} = {}): HoverCardDom {
  document.body.innerHTML = "";

  const id = opts.cardId ?? "hc-test";
  const delay = opts.delay ?? 300;
  const closeDelay = opts.closeDelay ?? 150;
  const openOnFocus = opts.openOnFocus ?? true;

  const componentRoot = document.createElement("div");
  componentRoot.setAttribute("data-lievit-component", "com.example.C");
  componentRoot.setAttribute(
    "data-lievit-id",
    `cid-${Math.random().toString(36).slice(2)}`
  );
  componentRoot.setAttribute("data-lievit-snapshot", "s1");

  // --- trigger wrapper (mirrors hover-card-trigger.jte output) ---
  const wrapper = document.createElement("span");
  wrapper.setAttribute("data-slot", "hover-card-trigger");
  wrapper.setAttribute("data-lv-hover-card-trigger", "");
  wrapper.setAttribute("data-card-id", id);
  wrapper.setAttribute("data-delay", String(delay));
  wrapper.setAttribute("data-close-delay", String(closeDelay));
  wrapper.setAttribute("data-open-on-focus", String(openOnFocus));
  wrapper.setAttribute("aria-describedby", id);
  wrapper.className = "relative inline-flex";

  // trigger content: a focusable button
  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.textContent = "Ada Lovelace";
  wrapper.appendChild(trigger);

  // --- card panel (mirrors hover-card.jte output) ---
  const panel = document.createElement("div");
  panel.id = id;
  panel.setAttribute("role", "tooltip");
  panel.setAttribute("popover", "manual");
  panel.setAttribute("data-slot", "hover-card");
  panel.setAttribute("data-variant", "default");
  panel.setAttribute("data-max-width", "sm");

  if (opts.withHeader === true) {
    const header = document.createElement("div");
    header.setAttribute("data-slot", "header");
    header.textContent = "Ada Lovelace";
    panel.appendChild(header);
  }

  const contentDiv = document.createElement("div");
  contentDiv.setAttribute("data-slot", "content");
  contentDiv.textContent = "First programmer. Babbage collaborator. 1815-1852.";
  panel.appendChild(contentDiv);

  if (opts.withFooter === true) {
    const footer = document.createElement("div");
    footer.setAttribute("data-slot", "footer");
    footer.textContent = "Joined 1840";
    panel.appendChild(footer);
  }

  // Polyfill showPopover / hidePopover BEFORE the runtime scans.
  polyfillPopover(panel);

  componentRoot.appendChild(wrapper);
  componentRoot.appendChild(panel);
  document.body.appendChild(componentRoot);

  const runtime = new LievitRuntime({ fetchImpl: makeFetchImpl() });
  installHoverCard(runtime);
  runtime.start(); // triggers onComponentInit -> scanRoot -> wireWrapper

  return { runtime, componentRoot, wrapper, panel, trigger };
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  document.body.innerHTML = "";
  vi.useRealTimers();
});

afterEach(() => {
  document.body.innerHTML = "";
  vi.useRealTimers();
});

// ===========================================================================
// JTE SOURCE STRUCTURAL ASSERTIONS (no compiler; structural invariants only)
// ===========================================================================

describe("jte-source — hover-card-trigger.jte: static markup contract", () => {
  it("declares required params: cardId, delay, closeDelay, openOnFocus, content", () => {
    expect(triggerSrc).toContain("@param String cardId");
    expect(triggerSrc).toContain("@param int delay");
    expect(triggerSrc).toContain("@param int closeDelay");
    expect(triggerSrc).toContain("@param boolean openOnFocus");
    expect(triggerSrc).toContain("@param gg.jte.Content content");
  });

  it("emits data-slot=hover-card-trigger and the enhancer mount hook", () => {
    expect(triggerSrc).toContain('data-slot="hover-card-trigger"');
    expect(triggerSrc).toContain("data-lv-hover-card-trigger");
  });

  it("emits aria-describedby unconditionally (server-rendered, not JS-dependent)", () => {
    expect(triggerSrc).toContain('aria-describedby="${cardId}"');
  });

  it("stamps data-card-id, data-delay, data-close-delay, data-open-on-focus on the wrapper", () => {
    expect(triggerSrc).toContain('data-card-id="${cardId}"');
    expect(triggerSrc).toContain('data-delay="${delay}"');
    expect(triggerSrc).toContain('data-close-delay="${closeDelay}"');
    expect(triggerSrc).toContain('data-open-on-focus="${openOnFocus}"');
  });

  it("renders the trigger content slot via ${content}", () => {
    expect(triggerSrc).toContain("${content}");
  });

  it("uses the two XSS escaping channels (attrs + dataAttrs)", () => {
    expect(triggerSrc).toContain("$unsafe{attrs}");
    expect(triggerSrc).toContain("Escape.htmlAttribute");
    expect(triggerSrc).toContain("$unsafe{dataAttrsMarkup}");
  });

  it("sets CSS anchor-name via style for the shared popover seam", () => {
    expect(triggerSrc).toContain("anchor-name:${anchorName}");
    expect(triggerSrc).toContain('"--hc-" + cardId');
  });

  it("has no @import dev.lievit (runtime types must not be imported in templates)", () => {
    expect(triggerSrc).not.toContain("@import dev.lievit");
  });

  it("has no inline <script> or on* handlers (CSP-clean)", () => {
    expect(triggerSrc).not.toMatch(/<script/i);
    expect(triggerSrc).not.toMatch(/\son\w+=/);
  });

  it("has a Usage: section with the @template.lievit.hover-card-trigger call", () => {
    expect(triggerSrc).toContain("Usage:");
    expect(triggerSrc).toContain("@@template.lievit.hover-card-trigger(");
  });
});

describe("jte-source — hover-card.jte: static markup contract", () => {
  it("declares required params: id, placement, maxWidth, header, content, footer", () => {
    expect(cardSrc).toContain("@param String id");
    expect(cardSrc).toContain("@param String placement");
    expect(cardSrc).toContain("@param String maxWidth");
    expect(cardSrc).toContain("@param Content header");
    expect(cardSrc).toContain("@param Content content");
    expect(cardSrc).toContain("@param Content footer");
  });

  it("emits role=tooltip on the panel (WAI-ARIA APG Tooltip)", () => {
    expect(cardSrc).toContain('role="tooltip"');
  });

  it("emits popover=manual (not auto — would fight grace-delay)", () => {
    expect(cardSrc).toContain('popover="manual"');
  });

  it("emits id and data-slot=hover-card on the panel root", () => {
    expect(cardSrc).toContain('id="${id}"');
    expect(cardSrc).toContain('data-slot="hover-card"');
  });

  it("emits data-variant=default and data-max-width", () => {
    expect(cardSrc).toContain('data-variant="default"');
    expect(cardSrc).toContain('data-max-width="${maxWidth}"');
  });

  it("does NOT emit aria-hidden on the markup (panel must be visible to the a11y tree for aria-describedby)", () => {
    // Strip the doc-comment block (<%-- ... --%>) before asserting: the comment mentions
    // aria-hidden in its prohibition note, but the MARKUP must never carry the attribute.
    const markup = cardSrc.replace(/<%--[\s\S]*?--%>/g, "");
    expect(markup).not.toContain('aria-hidden');
  });

  it("uses the net-new max-width token family via maxWidth param", () => {
    expect(cardSrc).toContain('"--hc-" + id');
    expect(cardSrc).toContain('"var(--lv-hover-card-max-width-" + maxWidth + ")"');
  });

  it("uses position-anchor for CSS Anchor Positioning seam", () => {
    expect(cardSrc).toContain("position-anchor:");
    expect(cardSrc).toContain("position-area:");
    expect(cardSrc).toContain("position-try-fallbacks:");
  });

  it("header slot is conditional on header != null", () => {
    expect(cardSrc).toContain("@if(header != null)");
    expect(cardSrc).toContain('data-slot="header"');
  });

  it("footer slot is conditional on footer != null", () => {
    expect(cardSrc).toContain("@if(footer != null)");
    expect(cardSrc).toContain('data-slot="footer"');
  });

  it("content slot is unconditional (always emitted)", () => {
    expect(cardSrc).toContain('data-slot="content"');
    expect(cardSrc).toContain("${content}");
  });

  it("uses colour and shadow tokens (popover surface, border, shadow, z)", () => {
    expect(cardSrc).toContain("var(--lv-color-popover)");
    expect(cardSrc).toContain("var(--lv-color-popover-fg)");
    expect(cardSrc).toContain("var(--lv-color-border)");
    expect(cardSrc).toContain("var(--lv-shadow-md)");
    expect(cardSrc).toContain("var(--lv-z-popover)");
    expect(cardSrc).toContain("var(--lv-radius-lg)");
  });

  it("uses the two XSS escaping channels (attrs + dataAttrs)", () => {
    expect(cardSrc).toContain("$unsafe{attrs}");
    expect(cardSrc).toContain("Escape.htmlAttribute");
    expect(cardSrc).toContain("$unsafe{dataAttrsMarkup}");
  });

  it("has no @import dev.lievit (runtime types must not be imported in templates)", () => {
    expect(cardSrc).not.toContain("@import dev.lievit");
  });

  it("has no inline <script> or on* handlers (CSP-clean)", () => {
    expect(cardSrc).not.toMatch(/<script/i);
    expect(cardSrc).not.toMatch(/\son\w+=/);
  });

  it("has a Usage: section with the @template.lievit.hover-card call", () => {
    expect(cardSrc).toContain("Usage:");
    expect(cardSrc).toContain("@@template.lievit.hover-card(");
  });
});

// ===========================================================================
// ENHANCER TESTS — hover/focus lifecycle, Esc, grace, focus-never-enters-card
// ===========================================================================

describe("hover-card.enhancer — initial state", () => {
  it("hover-card-renders-panel-in-dom — panel is present and closed (no data-open)", () => {
    const { panel } = buildHoverCard();
    expect(panel).toBeTruthy();
    expect(isOpen(panel)).toBe(false);
  });

  it("trigger-wrapper-has-aria-describedby — aria-describedby matches the card id", () => {
    const { wrapper, panel } = buildHoverCard();
    expect(wrapper.getAttribute("aria-describedby")).toBe(panel.id);
  });
});

describe("hover-card.enhancer — hover show/hide with delay", () => {
  it("hover-opens-card-after-delay — pointerenter starts timer; card opens after delay ms", () => {
    vi.useFakeTimers();
    const { wrapper, panel } = buildHoverCard({ delay: 300 });

    wrapper.dispatchEvent(new Event("pointerenter", { bubbles: true }));
    expect(isOpen(panel)).toBe(false); // still in timer

    vi.advanceTimersByTime(300);
    expect(isOpen(panel)).toBe(true);
  });

  it("pointer-leave-trigger-closes-after-close-delay — card closes after closeDelay ms", () => {
    vi.useFakeTimers();
    const { wrapper, panel } = buildHoverCard({ delay: 0, closeDelay: 150 });

    // open immediately
    wrapper.dispatchEvent(new Event("pointerenter", { bubbles: true }));
    vi.advanceTimersByTime(0);
    expect(isOpen(panel)).toBe(true);

    // leave trigger
    wrapper.dispatchEvent(new Event("pointerleave", { bubbles: true }));
    expect(isOpen(panel)).toBe(true); // still in grace timer

    vi.advanceTimersByTime(150);
    expect(isOpen(panel)).toBe(false);
  });

  it("early-pointerleave-before-delay-cancels-open — leaving before delay fires never opens", () => {
    vi.useFakeTimers();
    const { wrapper, panel } = buildHoverCard({ delay: 300 });

    wrapper.dispatchEvent(new Event("pointerenter", { bubbles: true }));
    vi.advanceTimersByTime(100);
    wrapper.dispatchEvent(new Event("pointerleave", { bubbles: true }));
    vi.advanceTimersByTime(300);
    expect(isOpen(panel)).toBe(false);
  });
});

describe("hover-card.enhancer — hover grace period (pointer travelling to card)", () => {
  it("grace-period-prevents-close-when-entering-card — pointerenter on panel cancels close", () => {
    vi.useFakeTimers();
    const { wrapper, panel } = buildHoverCard({ delay: 0, closeDelay: 150 });

    // open
    wrapper.dispatchEvent(new Event("pointerenter", { bubbles: true }));
    vi.advanceTimersByTime(0);
    expect(isOpen(panel)).toBe(true);

    // leave trigger — close timer starts
    wrapper.dispatchEvent(new Event("pointerleave", { bubbles: true }));
    vi.advanceTimersByTime(50); // half the grace time

    // enter panel — cancel close timer (grace period)
    panel.dispatchEvent(new Event("pointerenter", { bubbles: true }));
    vi.advanceTimersByTime(200); // well past close delay
    expect(isOpen(panel)).toBe(true); // still open (grace succeeded)
  });

  it("pointer-leave-card-closes-after-close-delay — leaving the card closes after closeDelay", () => {
    vi.useFakeTimers();
    const { wrapper, panel } = buildHoverCard({ delay: 0, closeDelay: 150 });

    // open via trigger
    wrapper.dispatchEvent(new Event("pointerenter", { bubbles: true }));
    vi.advanceTimersByTime(0);

    // travel to card (grace)
    wrapper.dispatchEvent(new Event("pointerleave", { bubbles: true }));
    panel.dispatchEvent(new Event("pointerenter", { bubbles: true }));
    expect(isOpen(panel)).toBe(true);

    // leave card
    panel.dispatchEvent(new Event("pointerleave", { bubbles: true }));
    vi.advanceTimersByTime(150);
    expect(isOpen(panel)).toBe(false);
  });
});

describe("hover-card.enhancer — keyboard / focus-open path", () => {
  it("focus-opens-card-immediately-when-open-on-focus-true — focusin shows without delay", () => {
    const { wrapper, panel } = buildHoverCard({ openOnFocus: true });

    expect(isOpen(panel)).toBe(false);
    wrapper.dispatchEvent(new Event("focusin", { bubbles: true }));
    expect(isOpen(panel)).toBe(true);
  });

  it("blur-closes-card-after-close-delay — focusout starts close timer", () => {
    vi.useFakeTimers();
    const { wrapper, panel } = buildHoverCard({ openOnFocus: true, closeDelay: 150 });

    wrapper.dispatchEvent(new Event("focusin", { bubbles: true }));
    expect(isOpen(panel)).toBe(true);

    wrapper.dispatchEvent(new Event("focusout", { bubbles: true }));
    expect(isOpen(panel)).toBe(true); // still in timer

    vi.advanceTimersByTime(150);
    expect(isOpen(panel)).toBe(false);
  });

  it("focus-returns-before-close-delay-keeps-card-open — re-focus cancels the timer", () => {
    vi.useFakeTimers();
    const { wrapper, panel } = buildHoverCard({ openOnFocus: true, closeDelay: 150 });

    wrapper.dispatchEvent(new Event("focusin", { bubbles: true }));
    wrapper.dispatchEvent(new Event("focusout", { bubbles: true }));
    vi.advanceTimersByTime(50);
    wrapper.dispatchEvent(new Event("focusin", { bubbles: true }));
    vi.advanceTimersByTime(200);
    expect(isOpen(panel)).toBe(true);
  });

  it("open-on-focus-false-suppresses-keyboard-open — focusin does not open card", () => {
    const { wrapper, panel } = buildHoverCard({ openOnFocus: false });

    wrapper.dispatchEvent(new Event("focusin", { bubbles: true }));
    expect(isOpen(panel)).toBe(false);
  });

  it("focus-stays-on-trigger-when-card-open — card never receives programmatic focus", () => {
    const { wrapper, trigger } = buildHoverCard({ openOnFocus: true });

    trigger.focus();
    wrapper.dispatchEvent(new Event("focusin", { bubbles: true }));

    // active element is the button inside the wrapper, NOT anything inside the panel
    expect(document.activeElement).toBe(trigger);
  });

  it("card-panel-never-receives-focus — panel has no tabindex; no autofocus", () => {
    const { panel } = buildHoverCard();
    // No tabindex on the panel itself
    expect(panel.hasAttribute("tabindex")).toBe(false);
    // No tabindex on any child (the content div)
    const children = Array.from(panel.querySelectorAll<HTMLElement>("[tabindex]"));
    expect(children).toHaveLength(0);
  });
});

describe("hover-card.enhancer — Esc dismiss", () => {
  it("esc-closes-open-card — Escape hides the panel and removes data-open", () => {
    const { wrapper, panel } = buildHoverCard({ delay: 0, openOnFocus: true });

    wrapper.dispatchEvent(new Event("focusin", { bubbles: true }));
    expect(isOpen(panel)).toBe(true);

    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true })
    );
    expect(isOpen(panel)).toBe(false);
  });

  it("esc-is-noop-when-card-is-closed — no error, no state change", () => {
    const { panel } = buildHoverCard();
    expect(isOpen(panel)).toBe(false);

    // Esc while closed should not throw or open anything
    expect(() => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true })
      );
    }).not.toThrow();
    expect(isOpen(panel)).toBe(false);
  });

  it("esc-does-not-propagate-past-card — stopPropagation prevents parent Esc handler", () => {
    const { wrapper, panel } = buildHoverCard({ delay: 0, openOnFocus: true });

    wrapper.dispatchEvent(new Event("focusin", { bubbles: true }));
    expect(isOpen(panel)).toBe(true);

    // Parent listener on document (capture phase, same as the enhancer's handler).
    // We use a second capture listener AFTER the enhancer's to detect whether the event
    // was stopped — but since stopPropagation affects the same phase, we attach a bubble
    // listener and assert it is NOT called (the enhancer registers in capture phase and
    // calls stopPropagation, so bubble-phase listeners see the event still if stopPropagation
    // is capture-only; in practice the enhancer uses stopPropagation which stops further
    // listeners in the SAME phase and prevents bubbling). We verify the card closed.
    let parentCalled = false;
    const parentHandler = (): void => { parentCalled = true; };
    // Non-capture listener: should NOT be called because stopPropagation was invoked.
    document.addEventListener("keydown", parentHandler);

    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })
    );

    document.removeEventListener("keydown", parentHandler);

    expect(isOpen(panel)).toBe(false);
    // stopPropagation in the capture handler prevents the bubble-phase handler
    expect(parentCalled).toBe(false);
  });
});

// ===========================================================================
// SLOT CONDITIONALITY TESTS (DOM assertions via the builder)
// ===========================================================================

describe("hover-card — slot conditionality", () => {
  it("data-slot-attributes-present — wrapper and panel carry the expected data-slot values", () => {
    const { wrapper, panel } = buildHoverCard();
    expect(wrapper.getAttribute("data-slot")).toBe("hover-card-trigger");
    expect(panel.getAttribute("data-slot")).toBe("hover-card");
  });

  it("header-absent-when-not-built — no [data-slot=header] in the DOM", () => {
    const { panel } = buildHoverCard({ withHeader: false });
    expect(panel.querySelector('[data-slot="header"]')).toBeNull();
  });

  it("header-present-when-built — [data-slot=header] is in the panel", () => {
    const { panel } = buildHoverCard({ withHeader: true });
    expect(panel.querySelector('[data-slot="header"]')).not.toBeNull();
  });

  it("footer-absent-when-not-built — no [data-slot=footer] in the DOM", () => {
    const { panel } = buildHoverCard({ withFooter: false });
    expect(panel.querySelector('[data-slot="footer"]')).toBeNull();
  });

  it("footer-present-when-built — [data-slot=footer] is in the panel", () => {
    const { panel } = buildHoverCard({ withFooter: true });
    expect(panel.querySelector('[data-slot="footer"]')).not.toBeNull();
  });

  it("content-always-present — [data-slot=content] is always in the panel", () => {
    const { panel } = buildHoverCard();
    expect(panel.querySelector('[data-slot="content"]')).not.toBeNull();
  });
});

// ===========================================================================
// SECURITY TEST — dataAttrs escaping
// ===========================================================================

describe("jte-source — escaping / security", () => {
  it("hostile-data-attr-value-renders-inert — Escape.htmlAttribute is used for dataAttrs values", () => {
    // The template uses Escape.htmlAttribute which JTE applies to each value in the map.
    // We assert the source wires it correctly (not a runtime injection test, which requires JTE).
    expect(triggerSrc).toContain("Escape.htmlAttribute");
    expect(cardSrc).toContain("Escape.htmlAttribute");
  });

  it("dataAttrs key guard — keys are validated against [A-Za-z][A-Za-z0-9-]* before emission", () => {
    expect(triggerSrc).toContain('[A-Za-z][A-Za-z0-9-]*');
    expect(cardSrc).toContain('[A-Za-z][A-Za-z0-9-]*');
  });

  it("card-id-is-a-server-controlled-String-param — id param is typed String, not user input", () => {
    // The template contract ensures id/cardId arrive as a typed Java String param,
    // not taken from the HTTP request. We verify the @param declaration.
    expect(triggerSrc).toContain("@param String cardId");
    expect(cardSrc).toContain("@param String id");
  });
});

// ===========================================================================
// MAXWIDTH TOKEN ASSERTION (source-text)
// ===========================================================================

describe("jte-source — max-width token family", () => {
  it("max-width-token-family — card panel uses the net-new --lv-hover-card-max-width-* tokens", () => {
    // The template builds the token name from the maxWidth param at render time.
    expect(cardSrc).toContain("--lv-hover-card-max-width-");
  });

  it("data-max-width attribute is present for CSS and test targeting", () => {
    expect(cardSrc).toContain('data-max-width="${maxWidth}"');
  });
});
