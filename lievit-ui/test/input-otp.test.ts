/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * input-otp (v-next, STIMULUS CONTROLLER): tests for the re-forged partial + the lv-input-otp
 * controller. The .jte render is pinned by the real-compiler jte-compile gate; this file pins the
 * controller's DOM behaviour against a DOM shaped exactly like the v-next partial output:
 * N native single-char inputs (data-otp-slot, role=spinbutton, data-lv-input-otp-target="slot",
 * data-action) + a hidden mirror (data-otp-mirror, target="mirror"), inside a
 * [data-controller="lv-input-otp"] root that declares data-otp-mode / data-otp-length /
 * data-otp-autosubmit / data-otp-complete.
 *
 * Per the conversion convention §6 the controller is exercised through the REAL @hotwired/stimulus
 * Application (startStimulus auto-loads it by filename) and a REAL lievit wire morph -- never a
 * mocked $lievit, never a mocked runtime. A test that mocked the runtime would certify nothing.
 *
 * input-otp does NOT dismiss and NEVER round-trips the wire (the value POSTs with a plain form via
 * the mirror), so there is no controlled/uncontrolled branch; the whole-contract analog is the
 * no-wire invariant (see "never round-trips the wire"), asserted through a real fetch-stub runtime.
 */

import { describe, test, it, expect, beforeEach, afterEach, vi } from "vitest";

import { LievitRuntime } from "../runtime/runtime.js";
import { morph } from "../runtime/morph.js";
import { startStimulus, stopStimulus, flushStimulus } from "../runtime/stimulus/application.js";

// ---------------------------------------------------------------------------
// DOM helpers
// ---------------------------------------------------------------------------

/**
 * Build a DOM that matches the server-rendered v-next input-otp partial, INCLUDING the Stimulus
 * wiring the .jte now emits (data-controller, data-action, data-lv-input-otp-target). This is the
 * "build the DOM exactly as the .jte emits it" step of the convention test template.
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
  root.setAttribute("data-controller", "lv-input-otp");
  root.dataset.slot = "input-otp";
  root.dataset.otpMode = mode;
  root.dataset.otpLength = String(length);
  root.dataset.otpAutosubmit = autoSubmit ? "true" : "false";
  if (completeAction) root.dataset.otpComplete = completeAction;

  const group = document.createElement("div");
  group.setAttribute("role", "group");
  group.setAttribute("aria-label", groupLabel);
  group.dataset.slot = "input-otp-group";
  group.setAttribute("data-action", "paste->lv-input-otp#onPaste");

  for (let i = 0; i < length; i++) {
    const slot = document.createElement("input");
    slot.type = masked ? "password" : "text";
    slot.setAttribute("role", "spinbutton");
    slot.setAttribute("data-otp-slot", String(i));
    slot.setAttribute("data-lv-input-otp-target", "slot");
    slot.setAttribute(
      "data-action",
      "input->lv-input-otp#onInput keydown->lv-input-otp#onKeydown focus->lv-input-otp#onFocus",
    );
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
  mirror.setAttribute("data-lv-input-otp-target", "mirror");
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

/** Build the OTP, start Stimulus, and await the MutationObserver so the controller is connected. */
async function mountOtp(opts: Parameters<typeof buildOtp>[0]): Promise<HTMLElement> {
  const root = buildOtp(opts);
  startStimulus({});
  await flushStimulus();
  return root;
}

/** A real LievitRuntime backed by a fetch stub; counts the wire calls it dispatches. */
function makeRuntime(): {
  runtime: LievitRuntime;
  calledActions: string[];
  fetchImpl: ReturnType<typeof vi.fn>;
} {
  const calledActions: string[] = [];
  const fetchImpl = vi.fn(async (_url: unknown, init?: RequestInit) => {
    const body = JSON.parse((init?.body as string) ?? "{}") as Record<string, unknown>;
    const calls = body._calls as string[] | undefined;
    if (calls) calledActions.push(...calls);
    return new Response("<div></div>", { status: 200, headers: { "Lievit-Snapshot": "s2" } });
  });
  const runtime = new LievitRuntime({ fetchImpl: fetchImpl as unknown as typeof fetch });
  return { runtime, calledActions, fetchImpl };
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

/** Simulate typing one character into a slot: set value, then fire a bubbling InputEvent. */
function typeChar(slot: HTMLInputElement, ch: string): void {
  slot.value = ch;
  slot.dispatchEvent(new InputEvent("input", { bubbles: true, cancelable: true }));
}

/** Simulate a KeyboardEvent on a slot. */
function keyDown(slot: HTMLInputElement, key: string): void {
  slot.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
}

/** Simulate a paste event on an element with the given text. */
function simulatePaste(target: Element, text: string): void {
  const evt = new Event("paste", { bubbles: true, cancelable: true }) as ClipboardEvent;
  Object.defineProperty(evt, "clipboardData", {
    value: { getData: (_format: string) => text },
    configurable: true,
  });
  target.dispatchEvent(evt);
}

beforeEach(() => {
  document.body.innerHTML = "";
});

afterEach(() => {
  stopStimulus();
  document.body.innerHTML = "";
});

// ---------------------------------------------------------------------------
// DOM shape (static, before Stimulus — verifies the partial output contract)
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
// Controller — character input + mirror sync
// ---------------------------------------------------------------------------

describe("lv-input-otp controller: character input", () => {
  let root: HTMLElement;
  beforeEach(async () => {
    root = await mountOtp({ length: 4 });
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
    expect(document.activeElement).not.toBe(s[1]);
  });

  test("alphanumeric mode accepts letters (normalised to uppercase)", async () => {
    // A fresh page with alphanumeric mode; the beforeEach root is numeric.
    document.body.innerHTML = "";
    stopStimulus();
    const alphaRoot = await mountOtp({ length: 4, mode: "alphanumeric" });
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
    expect(document.activeElement).toBe(s[3]);
  });
});

// ---------------------------------------------------------------------------
// Controller — backspace + delete
// ---------------------------------------------------------------------------

describe("lv-input-otp controller: backspace and delete", () => {
  let root: HTMLElement;
  beforeEach(async () => {
    root = await mountOtp({ length: 4 });
  });

  test("keyboard_backspace_on_filled_slot_clears_stays: Backspace on a filled slot clears it, focus stays", () => {
    const s = slots(root);
    typeChar(s[0], "7");
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
// Controller — arrow navigation + Home/End
// ---------------------------------------------------------------------------

describe("lv-input-otp controller: arrow navigation", () => {
  let root: HTMLElement;
  beforeEach(async () => {
    root = await mountOtp({ length: 6 });
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
// Controller — auto-submit / completion
// ---------------------------------------------------------------------------

describe("lv-input-otp controller: auto-submit", () => {
  test("autosubmit_fires_complete_on_nth_char: filling all slots fires lievit:otp-complete", async () => {
    const root = await mountOtp({ length: 4, autoSubmit: true, completeAction: "event" });
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

  test("autosubmit_false_does_not_fire_on_nth_char: filling all slots does NOT fire when autoSubmit=false", async () => {
    const root = await mountOtp({ length: 3, autoSubmit: false, completeAction: "event" });
    const s = slots(root);
    let fired = 0;
    root.addEventListener("lievit:otp-complete", () => { fired++; });
    typeChar(s[0], "1");
    typeChar(s[1], "2");
    typeChar(s[2], "3");
    expect(fired).toBe(0);
  });

  test("keyboard_enter_fires_complete_when_autosubmit_false_and_all_filled", async () => {
    const root = await mountOtp({ length: 3, autoSubmit: false, completeAction: "event" });
    const s = slots(root);
    const tokens: string[] = [];
    root.addEventListener("lievit:otp-complete", (e) => {
      tokens.push((e as CustomEvent<string>).detail);
    });
    typeChar(s[0], "7");
    typeChar(s[1], "8");
    typeChar(s[2], "9");
    expect(tokens).toHaveLength(0);
    s[2].focus();
    keyDown(s[2], "Enter");
    expect(tokens).toEqual(["789"]);
  });

  test("keyboard_enter_noop_when_incomplete: Enter with incomplete code does not fire", async () => {
    const root = await mountOtp({ length: 4, autoSubmit: false, completeAction: "event" });
    const s = slots(root);
    let fired = 0;
    root.addEventListener("lievit:otp-complete", () => { fired++; });
    typeChar(s[0], "1");
    typeChar(s[1], "2");
    s[2].focus();
    keyDown(s[2], "Enter");
    expect(fired).toBe(0);
  });

  test("completion fires lievit:otp-complete exactly once per filled state (latch)", async () => {
    const root = await mountOtp({ length: 2, autoSubmit: true, completeAction: "event" });
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

  test("completion re-arms after the code drops below full", async () => {
    const root = await mountOtp({ length: 2, autoSubmit: true, completeAction: "event" });
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

  test('completeAction="submit" requestSubmits the enclosing form', async () => {
    const form = document.createElement("form");
    document.body.appendChild(form);
    const root = buildOtp({ length: 2, autoSubmit: true, completeAction: "submit" });
    form.appendChild(root); // move the root inside the form
    let submitted = 0;
    form.requestSubmit = () => { submitted++; };
    startStimulus({});
    await flushStimulus();
    const s = slots(root);
    typeChar(s[0], "4");
    expect(submitted).toBe(0);
    typeChar(s[1], "2");
    expect(submitted).toBe(1);
  });

  test("no completeAction: lievit:otp-complete is never fired (plain form POST)", async () => {
    const root = await mountOtp({ length: 2 }); // no completeAction
    let fires = 0;
    root.addEventListener("lievit:otp-complete", () => { fires++; });
    const s = slots(root);
    typeChar(s[0], "1");
    typeChar(s[1], "2");
    expect(fires).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Controller — paste
// ---------------------------------------------------------------------------

describe("lv-input-otp controller: paste", () => {
  test("paste_splits_across_slots: pasting 4 digits fills all slots and fires complete", async () => {
    const root = await mountOtp({ length: 4, completeAction: "event" });
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

  test("paste_partial_fills_from_slot_zero: pasting 3 chars into 6-slot group leaves 3-5 empty", async () => {
    const root = await mountOtp({ length: 6, completeAction: "event" });
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
    expect(document.activeElement).toBe(s[3]);
  });

  test("paste_strips_non_conforming_chars_numeric_mode: letters are stripped in numeric mode", async () => {
    const root = await mountOtp({ length: 6 });
    const group = root.querySelector("[data-slot='input-otp-group']")!;
    simulatePaste(group, "1A3B56");
    const s = slots(root);
    expect(s[0].value).toBe("1");
    expect(s[1].value).toBe("3");
    expect(s[2].value).toBe("5");
    expect(s[3].value).toBe("6");
    expect(s[4].value).toBe("");
    expect(s[5].value).toBe("");
  });

  test("paste_hostile_value_renders_inert: script-like content goes into slot values, not HTML", async () => {
    const root = await mountOtp({ length: 4, mode: "any" });
    const group = root.querySelector("[data-slot='input-otp-group']")!;
    simulatePaste(group, "><sc");
    const s = slots(root);
    expect(s[0].value).toBe(">");
    expect(s[1].value).toBe("<");
    expect(s[2].value).toBe("s");
    expect(s[3].value).toBe("c");
    expect(root.querySelector("script")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Controller — focus + roving tabindex + multi-root auto-wiring
// ---------------------------------------------------------------------------

describe("lv-input-otp controller: roving tabindex + auto-wiring", () => {
  test("focus_roving_tabindex_on_click: focusing slot 4 makes it tabindex=0; others become -1", async () => {
    const root = await mountOtp({ length: 6 });
    const s = slots(root);
    s[4].focus();
    expect(s[4].tabIndex).toBe(0);
    expect(s[0].tabIndex).toBe(-1);
    expect(s[3].tabIndex).toBe(-1);
    expect(s[5].tabIndex).toBe(-1);
  });

  test("startStimulus auto-wires EVERY input-otp root on the page (filename autoload)", async () => {
    const first = buildOtp({ length: 4 });
    const second = buildOtp({ length: 3 });
    startStimulus({});
    await flushStimulus();
    typeChar(slots(first)[0], "1");
    typeChar(slots(second)[0], "9");
    expect(mirror(first).value).toBe("1");
    expect(mirror(second).value).toBe("9");
  });

  test("a root inserted AFTER start is wired once the MutationObserver runs", async () => {
    startStimulus({});
    await flushStimulus();
    const late = buildOtp({ length: 2 });
    await flushStimulus(); // Stimulus connects the newly-inserted root
    typeChar(slots(late)[0], "5");
    expect(mirror(late).value).toBe("5");
  });
});

// ---------------------------------------------------------------------------
// Controller — the no-wire invariant (the OTP analog of "uncontrolled silent")
// ---------------------------------------------------------------------------

describe("lv-input-otp controller: never round-trips the wire", () => {
  it("filling + completing the code dispatches ZERO /lievit/<id>/call (plain form POST only)", async () => {
    const { runtime, calledActions, fetchImpl } = makeRuntime();
    // Wrap in a real lievit component so a stray wire call WOULD be addressable + observable.
    const componentRoot = document.createElement("div");
    componentRoot.setAttribute("data-lievit-component", "com.example.Otp");
    componentRoot.setAttribute("data-lievit-id", "cid-otp");
    componentRoot.setAttribute("data-lievit-snapshot", "s1");
    document.body.appendChild(componentRoot);

    const root = buildOtp({ length: 4, completeAction: "event" });
    componentRoot.appendChild(root);
    startStimulus({ runtime });
    await flushStimulus();

    const s = slots(root);
    typeChar(s[0], "1");
    typeChar(s[1], "2");
    typeChar(s[2], "3");
    typeChar(s[3], "4");
    simulatePaste(root.querySelector("[data-slot='input-otp-group']")!, "5678");

    await new Promise((r) => setTimeout(r, 10));
    expect(calledActions).toHaveLength(0);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Controller — morph-safety (real lievit wire morph; the whole point of the migration)
// ---------------------------------------------------------------------------

describe("lv-input-otp controller: morph-safety (real lievit morph)", () => {
  it("after an in-place morph the code still completes EXACTLY once (no stacked listeners)", async () => {
    const root = await mountOtp({ length: 2, autoSubmit: true, completeAction: "event" });
    const fires: string[] = [];
    const onComplete = (e: Event): void => {
      fires.push((e as CustomEvent<string>).detail);
    };
    document.addEventListener("lievit:otp-complete", onComplete);

    // A real lievit wire morph re-renders the subtree (idiomorph). The markup is identical, so the
    // controller must NOT be double-connected and the actions must stay single (no WeakSet, no
    // data-otp-enhanced bookkeeping -- Stimulus owns the lifecycle).
    morph(root, root.outerHTML);
    await flushStimulus();

    const s = slots(root);
    typeChar(s[0], "4");
    typeChar(s[1], "2");

    expect(fires).toEqual(["42"]); // exactly once -> reconnected + single handling
    document.removeEventListener("lievit:otp-complete", onComplete);
  });

  it("a root removed by a morph fires nothing (disconnect tears the actions down)", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = buildOtp({ length: 2, autoSubmit: true, completeAction: "event" });
    container.appendChild(root);
    startStimulus({});
    await flushStimulus();

    let fires = 0;
    const onComplete = (): void => { fires++; };
    document.addEventListener("lievit:otp-complete", onComplete);

    // Morph the OTP out of the tree.
    morph(container, "<div><span>gone</span></div>");
    await flushStimulus();

    // The detached slots no longer reach a live controller -> typing fires nothing.
    const s = slots(root);
    typeChar(s[0], "1");
    typeChar(s[1], "2");
    await flushStimulus();
    expect(fires).toBe(0);
    document.removeEventListener("lievit:otp-complete", onComplete);
  });
});
