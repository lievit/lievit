/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * input-otp (v-next, CLIENT-ENHANCER): tests for the re-forged partial + enhancer surface.
 *
 * The .jte render is pinned by the real-compiler jte-compile gate; this file pins the
 * enhancer's DOM behaviour against a DOM shaped exactly like the v-next partial output:
 * N native single-char inputs (data-otp-slot, role=spinbutton) + a hidden mirror
 * (data-otp-mirror), inside a [data-slot="input-otp"] root that declares data-otp-mode,
 * data-otp-length, data-otp-autosubmit. The enhancer is exercised on a REAL DOM (happy-dom)
 * with REAL dispatchEvent calls per the client-island-fidelity lesson.
 *
 * Tests are named to match the spec §7 acceptance-test identifiers where applicable.
 * The shared test files (jte-static-partials, tier4-components, etc.) are NOT touched.
 */

import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { enhanceInputOtp, enhanceAllInputOtp } from "../registry/jte/input-otp.enhancer.js";

// ---------------------------------------------------------------------------
// DOM helpers
// ---------------------------------------------------------------------------

/**
 * Build a DOM that matches the server-rendered v-next input-otp partial.
 *
 * Key attributes mirrored from the JTE:
 *   - root: data-slot="input-otp", data-otp-mode, data-otp-length, data-otp-autosubmit.
 *   - group: data-slot="input-otp-group", role="group".
 *   - each slot: data-otp-slot="{i}", role="spinbutton", tabindex per roving model.
 *   - mirror: data-otp-mirror, type="hidden".
 */
function buildOtp(opts: {
  length?: number;
  mode?: "numeric" | "alphanumeric" | "any";
  autoSubmit?: boolean;
  completeAction?: string;
  value?: string;
  groupLabel?: string;
  masked?: boolean;
}): HTMLElement {
  const {
    length = 6,
    mode = "numeric",
    autoSubmit = true,
    completeAction,
    value = "",
    groupLabel = "One-time code",
    masked = false,
  } = opts;

  const root = document.createElement("div");
  root.dataset.slot = "input-otp";
  root.dataset.otpMode = mode;
  root.dataset.otpLength = String(length);
  root.dataset.otpAutosubmit = autoSubmit ? "true" : "false";
  if (completeAction) root.dataset.otpComplete = completeAction;

  const group = document.createElement("div");
  group.setAttribute("role", "group");
  group.setAttribute("aria-label", groupLabel);
  group.dataset.slot = "input-otp-group";

  for (let i = 0; i < length; i++) {
    const slot = document.createElement("input");
    slot.type = masked ? "password" : "text";
    slot.setAttribute("role", "spinbutton");
    slot.setAttribute("data-otp-slot", String(i));
    slot.setAttribute("maxlength", "1");
    slot.setAttribute("aria-label", `Digit ${i + 1} of ${length}`);
    slot.setAttribute("aria-valuetext", "blank");
    slot.setAttribute("aria-required", "false");
    slot.tabIndex = i === 0 ? 0 : -1;
    // Pre-fill from value string if provided.
    const ch = i < value.length ? value[i] : "";
    if (ch) {
      slot.value = ch;
      if (mode === "numeric") slot.setAttribute("aria-valuenow", ch);
      slot.setAttribute("aria-valuetext", ch);
    }
    group.appendChild(slot);
  }

  root.appendChild(group);

  const mirror = document.createElement("input");
  mirror.type = "hidden";
  mirror.name = "otp";
  mirror.setAttribute("data-otp-mirror", "");
  mirror.value = value;
  mirror.tabIndex = -1;
  root.appendChild(mirror);

  // Error region (always present per spec).
  const errorRegion = document.createElement("div");
  errorRegion.setAttribute("role", "alert");
  errorRegion.dataset.slot = "input-otp-error";
  root.appendChild(errorRegion);

  document.body.appendChild(root);
  return root;
}

/** The ordered slot inputs of a root. */
function slots(root: Element): HTMLInputElement[] {
  return Array.from(root.querySelectorAll<HTMLInputElement>("[data-otp-slot]")).sort(
    (a, b) => Number(a.dataset.otpSlot) - Number(b.dataset.otpSlot),
  );
}

/** The hidden mirror of a root. */
function mirror(root: Element): HTMLInputElement {
  return root.querySelector<HTMLInputElement>("[data-otp-mirror]")!;
}

/**
 * Simulate typing one character into a slot:
 * 1. Set slot.value to the new char (native input overwrites).
 * 2. Fire a synthetic InputEvent (bubbles, so delegation reaches the root).
 */
function typeChar(slot: HTMLInputElement, ch: string): void {
  slot.value = ch;
  slot.dispatchEvent(new InputEvent("input", { bubbles: true, cancelable: true }));
}

/**
 * Simulate a KeyboardEvent on a slot.
 */
function keyDown(slot: HTMLInputElement, key: string): void {
  slot.dispatchEvent(
    new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }),
  );
}

/**
 * Simulate a paste event on an element with the given text.
 */
function simulatePaste(target: Element, text: string): void {
  const evt = new Event("paste", { bubbles: true, cancelable: true }) as ClipboardEvent;
  Object.defineProperty(evt, "clipboardData", {
    value: { getData: (_format: string) => text },
    configurable: true,
  });
  target.dispatchEvent(evt);
}

afterEach(() => {
  document.body.innerHTML = "";
});

// ---------------------------------------------------------------------------
// DOM shape (static, before enhance — verifies the partial output contract)
// ---------------------------------------------------------------------------

describe("input-otp partial DOM shape", () => {
  test("renders N slot inputs in a role=group", () => {
    const root = buildOtp({ length: 6 });
    const group = root.querySelector("[role=group]");
    expect(group).not.toBeNull();
    expect(slots(root)).toHaveLength(6);
  });

  test("each slot has role=spinbutton and maxlength=1", () => {
    const root = buildOtp({ length: 4 });
    for (const s of slots(root)) {
      expect(s.getAttribute("role")).toBe("spinbutton");
      expect(s.getAttribute("maxlength")).toBe("1");
    }
  });

  test("slot 0 has tabindex=0; all others have tabindex=-1 (initial render)", () => {
    const root = buildOtp({ length: 4 });
    const s = slots(root);
    expect(s[0].tabIndex).toBe(0);
    expect(s[1].tabIndex).toBe(-1);
    expect(s[3].tabIndex).toBe(-1);
  });

  test("slot aria-labels match the slotLabel template (Digit N of total)", () => {
    const root = buildOtp({ length: 4 });
    const s = slots(root);
    expect(s[0].getAttribute("aria-label")).toBe("Digit 1 of 4");
    expect(s[3].getAttribute("aria-label")).toBe("Digit 4 of 4");
  });

  test("role=alert error region is present even when empty", () => {
    const root = buildOtp({ length: 6 });
    const alert = root.querySelector("[role=alert]");
    expect(alert).not.toBeNull();
    expect(alert!.textContent).toBe("");
  });

  test("mirror has type=hidden and name attribute", () => {
    const root = buildOtp({ length: 6 });
    const m = mirror(root);
    expect(m.type).toBe("hidden");
    expect(m.name).toBe("otp");
  });

  test("data-otp-mode, data-otp-length, data-otp-autosubmit on root", () => {
    const root = buildOtp({ length: 4, mode: "alphanumeric", autoSubmit: false });
    expect((root as HTMLElement).dataset.otpMode).toBe("alphanumeric");
    expect((root as HTMLElement).dataset.otpLength).toBe("4");
    expect((root as HTMLElement).dataset.otpAutosubmit).toBe("false");
  });

  test("pre-filled value distributes chars across slots and sets mirror", () => {
    const root = buildOtp({ length: 4, value: "1234" });
    const s = slots(root);
    expect(s[0].value).toBe("1");
    expect(s[3].value).toBe("4");
    expect(mirror(root).value).toBe("1234");
  });

  test("masked=true renders slots as type=password", () => {
    const root = buildOtp({ length: 6, masked: true });
    for (const s of slots(root)) {
      expect(s.type).toBe("password");
    }
  });
});

// ---------------------------------------------------------------------------
// Enhancer — character input + mirror sync
// ---------------------------------------------------------------------------

describe("input-otp enhancer: character input", () => {
  let root: HTMLElement;
  beforeEach(() => {
    root = buildOtp({ length: 4 });
    enhanceInputOtp(root);
  });

  test("keyboard_digit_fills_slot_and_advances: typing a digit fills slot 0 and moves focus to slot 1", () => {
    const s = slots(root);
    typeChar(s[0], "3");
    expect(s[0].value).toBe("3");
    expect(document.activeElement).toBe(s[1]);
  });

  test("typing a valid char syncs the mirror", () => {
    const s = slots(root);
    typeChar(s[0], "1");
    typeChar(s[1], "2");
    expect(mirror(root).value).toBe("12");
  });

  test("keyboard_invalid_char_rejected_numeric_mode: non-digit char is cleared, no advance", () => {
    const s = slots(root);
    typeChar(s[0], "A");
    expect(s[0].value).toBe("");
    expect(mirror(root).value).toBe("");
    // Focus should still be on slot 0 (no advance).
    expect(document.activeElement).not.toBe(s[1]);
  });

  test("alphanumeric mode accepts letters (normalised to uppercase)", () => {
    // Build a fresh root with alphanumeric mode; the root captured above is numeric.
    const alphaRoot = buildOtp({ length: 4, mode: "alphanumeric" });
    enhanceInputOtp(alphaRoot);
    const s = slots(alphaRoot);
    typeChar(s[0], "a");
    expect(s[0].value).toBe("A");
    expect(document.activeElement).toBe(s[1]);
  });

  test("typing the last slot does NOT advance beyond bounds", () => {
    const s = slots(root);
    typeChar(s[0], "1");
    typeChar(s[1], "2");
    typeChar(s[2], "3");
    typeChar(s[3], "4");
    // After filling slot 3 (last), focus stays on slot 3.
    expect(document.activeElement).toBe(s[3]);
  });

  test("enhanceInputOtp is idempotent (re-enhancing does not double-bind)", () => {
    enhanceInputOtp(root); // second call; MOUNTED guard, no-op
    const s = slots(root);
    typeChar(s[0], "5");
    // A single input handler: mirror should be "5", not "55".
    expect(mirror(root).value).toBe("5");
  });
});

// ---------------------------------------------------------------------------
// Enhancer — backspace + delete
// ---------------------------------------------------------------------------

describe("input-otp enhancer: backspace and delete", () => {
  let root: HTMLElement;
  beforeEach(() => {
    root = buildOtp({ length: 4 });
    enhanceInputOtp(root);
  });

  test("keyboard_backspace_on_filled_slot_clears_stays: Backspace on a filled slot clears it, focus stays", () => {
    const s = slots(root);
    typeChar(s[0], "7");
    // Move focus to slot 0 explicitly.
    s[0].focus();
    keyDown(s[0], "Backspace");
    expect(s[0].value).toBe("");
    expect(document.activeElement).toBe(s[0]);
  });

  test("keyboard_backspace_on_empty_slot_retreats_and_clears_previous", () => {
    const s = slots(root);
    typeChar(s[0], "7");
    typeChar(s[1], "8");
    // Focus is now on s[2] (empty after auto-advance from s[1]).
    s[2].focus();
    keyDown(s[2], "Backspace");
    expect(s[1].value).toBe("");
    expect(mirror(root).value).toBe("7");
    expect(document.activeElement).toBe(s[1]);
  });

  test("Backspace on slot 0 (empty) is a no-op: stays on slot 0, nothing cleared", () => {
    const s = slots(root);
    s[0].focus();
    keyDown(s[0], "Backspace");
    // No retreat possible; slot 0 stays focused.
    expect(document.activeElement).toBe(s[0]);
  });

  test("Delete clears the slot value; focus stays on the same slot", () => {
    const s = slots(root);
    typeChar(s[0], "5");
    s[0].focus();
    keyDown(s[0], "Delete");
    expect(s[0].value).toBe("");
    expect(document.activeElement).toBe(s[0]);
  });
});

// ---------------------------------------------------------------------------
// Enhancer — arrow navigation + Home/End
// ---------------------------------------------------------------------------

describe("input-otp enhancer: arrow navigation", () => {
  let root: HTMLElement;
  beforeEach(() => {
    root = buildOtp({ length: 6 });
    enhanceInputOtp(root);
  });

  test("keyboard_arrow_left_moves_focus: ArrowLeft from slot 3 moves focus to slot 2", () => {
    const s = slots(root);
    s[3].focus();
    keyDown(s[3], "ArrowLeft");
    expect(document.activeElement).toBe(s[2]);
    expect(s[2].tabIndex).toBe(0);
    expect(s[3].tabIndex).toBe(-1);
  });

  test("keyboard_arrow_right_moves_focus: ArrowRight from slot 2 moves focus to slot 3", () => {
    const s = slots(root);
    s[2].focus();
    keyDown(s[2], "ArrowRight");
    expect(document.activeElement).toBe(s[3]);
  });

  test("keyboard_arrow_left_at_start_stays: ArrowLeft at slot 0 is a no-op", () => {
    const s = slots(root);
    s[0].focus();
    keyDown(s[0], "ArrowLeft");
    expect(document.activeElement).toBe(s[0]);
  });

  test("keyboard_arrow_right_at_end_stays: ArrowRight at last slot is a no-op", () => {
    const s = slots(root);
    const last = s[s.length - 1];
    last.focus();
    keyDown(last, "ArrowRight");
    expect(document.activeElement).toBe(last);
  });

  test("keyboard_home_moves_to_first_slot: Home from slot 4 moves to slot 0", () => {
    const s = slots(root);
    s[4].focus();
    keyDown(s[4], "Home");
    expect(document.activeElement).toBe(s[0]);
    expect(s[0].tabIndex).toBe(0);
  });

  test("keyboard_end_moves_to_last_slot: End from slot 1 moves to last slot", () => {
    const s = slots(root);
    s[1].focus();
    keyDown(s[1], "End");
    expect(document.activeElement).toBe(s[s.length - 1]);
  });
});

// ---------------------------------------------------------------------------
// Enhancer — auto-submit
// ---------------------------------------------------------------------------

describe("input-otp enhancer: auto-submit", () => {
  test("autosubmit_fires_complete_on_nth_char: filling all slots fires lievit:otp-complete", () => {
    const root = buildOtp({ length: 4, autoSubmit: true, completeAction: "event" });
    enhanceInputOtp(root);
    const s = slots(root);
    const events: string[] = [];
    root.addEventListener("lievit:otp-complete", (e) => {
      events.push((e as CustomEvent<string>).detail);
    });
    typeChar(s[0], "1");
    typeChar(s[1], "2");
    typeChar(s[2], "3");
    expect(events).toHaveLength(0); // not yet complete
    typeChar(s[3], "4");
    expect(events).toEqual(["1234"]);
  });

  test("autosubmit_false_does_not_fire_on_nth_char: filling all slots does NOT fire when autoSubmit=false", () => {
    const root = buildOtp({ length: 3, autoSubmit: false, completeAction: "event" });
    enhanceInputOtp(root);
    const s = slots(root);
    let fired = 0;
    root.addEventListener("lievit:otp-complete", () => { fired++; });
    typeChar(s[0], "1");
    typeChar(s[1], "2");
    typeChar(s[2], "3");
    expect(fired).toBe(0);
  });

  test("keyboard_enter_fires_complete_when_autosubmit_false_and_all_filled", () => {
    const root = buildOtp({ length: 3, autoSubmit: false, completeAction: "event" });
    enhanceInputOtp(root);
    const s = slots(root);
    const tokens: string[] = [];
    root.addEventListener("lievit:otp-complete", (e) => {
      tokens.push((e as CustomEvent<string>).detail);
    });
    typeChar(s[0], "7");
    typeChar(s[1], "8");
    typeChar(s[2], "9");
    // All slots filled; no fire yet.
    expect(tokens).toHaveLength(0);
    // Enter on any slot fires it.
    s[2].focus();
    keyDown(s[2], "Enter");
    expect(tokens).toEqual(["789"]);
  });

  test("keyboard_enter_noop_when_incomplete: Enter with incomplete code does not fire", () => {
    const root = buildOtp({ length: 4, autoSubmit: false, completeAction: "event" });
    enhanceInputOtp(root);
    const s = slots(root);
    let fired = 0;
    root.addEventListener("lievit:otp-complete", () => { fired++; });
    typeChar(s[0], "1");
    typeChar(s[1], "2");
    // Only 2 of 4 filled.
    s[2].focus();
    keyDown(s[2], "Enter");
    expect(fired).toBe(0);
  });

  test("completion fires lievit:otp-complete exactly once per filled state (latch)", () => {
    const root = buildOtp({ length: 2, autoSubmit: true, completeAction: "event" });
    enhanceInputOtp(root);
    const s = slots(root);
    let fires = 0;
    root.addEventListener("lievit:otp-complete", () => { fires++; });
    typeChar(s[0], "1");
    typeChar(s[1], "2");
    expect(fires).toBe(1);
    // Overtype the last slot while still full: latch prevents a second fire.
    typeChar(s[1], "5");
    expect(fires).toBe(1);
  });

  test("completion re-arms after the code drops below full", () => {
    const root = buildOtp({ length: 2, autoSubmit: true, completeAction: "event" });
    enhanceInputOtp(root);
    const s = slots(root);
    let fires = 0;
    root.addEventListener("lievit:otp-complete", () => { fires++; });
    typeChar(s[0], "1");
    typeChar(s[1], "2");
    expect(fires).toBe(1);
    // Clear a slot (drops below full -> re-arms).
    s[1].value = "";
    s[1].dispatchEvent(new InputEvent("input", { bubbles: true }));
    expect(fires).toBe(1);
    // Refill -> fires again.
    typeChar(s[1], "9");
    expect(fires).toBe(2);
  });

  test('completeAction="submit" requestSubmits the enclosing form', () => {
    const form = document.createElement("form");
    const root = buildOtp({ length: 2, autoSubmit: true, completeAction: "submit" });
    form.appendChild(root);
    document.body.appendChild(form);
    let submitted = 0;
    form.requestSubmit = () => { submitted++; };
    enhanceInputOtp(root);
    const s = slots(root);
    typeChar(s[0], "4");
    expect(submitted).toBe(0);
    typeChar(s[1], "2");
    expect(submitted).toBe(1);
  });

  test("no completeAction: lievit:otp-complete is never fired (plain form POST)", () => {
    const root = buildOtp({ length: 2 }); // no completeAction
    enhanceInputOtp(root);
    let fires = 0;
    root.addEventListener("lievit:otp-complete", () => { fires++; });
    const s = slots(root);
    typeChar(s[0], "1");
    typeChar(s[1], "2");
    expect(fires).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Enhancer — paste
// ---------------------------------------------------------------------------

describe("input-otp enhancer: paste", () => {
  test("paste_splits_across_slots: pasting 4 digits fills all slots and fires complete", () => {
    const root = buildOtp({ length: 4, completeAction: "event" });
    enhanceInputOtp(root);
    const tokens: string[] = [];
    root.addEventListener("lievit:otp-complete", (e) => {
      tokens.push((e as CustomEvent<string>).detail);
    });
    const group = root.querySelector("[data-slot='input-otp-group']")!;
    simulatePaste(group, "1234");
    const s = slots(root);
    expect(s[0].value).toBe("1");
    expect(s[1].value).toBe("2");
    expect(s[2].value).toBe("3");
    expect(s[3].value).toBe("4");
    expect(mirror(root).value).toBe("1234");
    expect(tokens).toEqual(["1234"]);
  });

  test("paste_partial_fills_from_slot_zero: pasting 3 chars into 6-slot group leaves 3-5 empty", () => {
    const root = buildOtp({ length: 6, completeAction: "event" });
    enhanceInputOtp(root);
    let fires = 0;
    root.addEventListener("lievit:otp-complete", () => { fires++; });
    const group = root.querySelector("[data-slot='input-otp-group']")!;
    simulatePaste(group, "123");
    const s = slots(root);
    expect(s[0].value).toBe("1");
    expect(s[1].value).toBe("2");
    expect(s[2].value).toBe("3");
    expect(s[3].value).toBe("");
    expect(fires).toBe(0);
    // Focus on the first unfilled slot (slot 3).
    expect(document.activeElement).toBe(s[3]);
  });

  test("paste_strips_non_conforming_chars_numeric_mode: letters are stripped in numeric mode", () => {
    const root = buildOtp({ length: 6 });
    enhanceInputOtp(root);
    const group = root.querySelector("[data-slot='input-otp-group']")!;
    simulatePaste(group, "1A3B56");
    const s = slots(root);
    // Only digits pass: "1", "3", "5", "6" distributed to slots 0-3; slots 4-5 empty.
    expect(s[0].value).toBe("1");
    expect(s[1].value).toBe("3");
    expect(s[2].value).toBe("5");
    expect(s[3].value).toBe("6");
    expect(s[4].value).toBe("");
    expect(s[5].value).toBe("");
  });

  test("paste_hostile_value_renders_inert: script-like content goes into slot values, not HTML", () => {
    const root = buildOtp({ length: 4, mode: "any" });
    enhanceInputOtp(root);
    const group = root.querySelector("[data-slot='input-otp-group']")!;
    // Paste a string starting with printable chars from the hostile payload.
    simulatePaste(group, "><sc");
    const s = slots(root);
    // Each char is written into slot.value (a DOM property), not innerHTML.
    expect(s[0].value).toBe(">");
    expect(s[1].value).toBe("<");
    expect(s[2].value).toBe("s");
    expect(s[3].value).toBe("c");
    // Sanity: the group's innerHTML does NOT contain a <script> element.
    expect(root.querySelector("script")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Enhancer — focus + roving tabindex
// ---------------------------------------------------------------------------

describe("input-otp enhancer: roving tabindex", () => {
  test("focus_roving_tabindex_on_click: clicking slot 4 makes it tabindex=0; others become -1", () => {
    const root = buildOtp({ length: 6 });
    enhanceInputOtp(root);
    const s = slots(root);
    // Simulate the user clicking slot 4 (focus event fires on the slot).
    s[4].focus();
    expect(s[4].tabIndex).toBe(0);
    expect(s[0].tabIndex).toBe(-1);
    expect(s[3].tabIndex).toBe(-1);
    expect(s[5].tabIndex).toBe(-1);
  });

  test("enhanceAllInputOtp wires every root on the page", () => {
    const second = buildOtp({ length: 3 });
    enhanceAllInputOtp();
    typeChar(slots(second)[0], "9");
    expect(mirror(second).value).toBe("9");
  });

  test("enhanceAllInputOtp with a scope argument only enhances roots within the scope", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const inner = buildOtp({ length: 2 });
    container.appendChild(inner);

    const outer = buildOtp({ length: 2 });
    document.body.appendChild(outer);

    enhanceAllInputOtp(container);

    // Inner root is enhanced: typing works.
    typeChar(slots(inner)[0], "1");
    expect(mirror(inner).value).toBe("1");

    // Outer root was NOT in scope: still unenhanced (mirror stays empty on type).
    slots(outer)[0].value = "7";
    slots(outer)[0].dispatchEvent(new InputEvent("input", { bubbles: true }));
    expect(mirror(outer).value).toBe("");
  });
});
