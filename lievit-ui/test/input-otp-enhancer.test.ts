/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * input-otp (Wave 2, ADR-0012): the server-first OTP is a JTE partial + a CSP-clean typed-TS
 * enhancer (no Lit island). The .jte render is pinned by the real-compiler jte-compile smoke; this
 * pins the enhancer's DOM behaviour against a DOM shaped exactly like the partial output: N native
 * single-char inputs (data-otp-slot) + a hidden `name` mirror (data-otp-mirror), inside the
 * [data-lievit-otp] root. The enhancer ONLY nudges focus + keeps the mirror in sync; the value is
 * form-submitted via the mirror (server-bound at POST).
 */
import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { enhanceInputOtp, enhanceAllInputOtp } from "../registry/jte/input-otp.enhancer.js";

/** Build a DOM that matches the server-rendered input-otp partial (numeric, length slots). */
function renderOtp(
  length = 6,
  type: "numeric" | "alphanumeric" | "alpha" = "numeric",
  complete?: string,
): HTMLElement {
  const root = document.createElement("div");
  root.setAttribute("data-lievit-otp", "");
  root.setAttribute("data-otp-type", type);
  root.setAttribute("data-otp-length", String(length));
  if (complete) root.setAttribute("data-otp-complete", complete);
  const group = document.createElement("div");
  group.setAttribute("role", "group");
  for (let i = 0; i < length; i++) {
    const slot = document.createElement("input");
    slot.setAttribute("data-otp-slot", String(i));
    slot.setAttribute("maxlength", "1");
    slot.setAttribute("aria-label", `Character ${i + 1} of ${length}`);
    group.appendChild(slot);
  }
  root.appendChild(group);
  const mirror = document.createElement("input");
  mirror.type = "hidden";
  mirror.name = "otp";
  mirror.setAttribute("data-otp-mirror", "");
  root.appendChild(mirror);
  document.body.appendChild(root);
  return root;
}

function slots(root: HTMLElement): HTMLInputElement[] {
  return Array.from(root.querySelectorAll<HTMLInputElement>("[data-otp-slot]"));
}

function mirror(root: HTMLElement): HTMLInputElement {
  return root.querySelector<HTMLInputElement>("[data-otp-mirror]")!;
}

/** Simulate a user typing one char into a slot (the native value + the input event). */
function type(slot: HTMLInputElement, ch: string): void {
  slot.value = ch;
  slot.dispatchEvent(new Event("input", { bubbles: true }));
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("input-otp partial DOM shape", () => {
  let root: HTMLElement;
  beforeEach(() => {
    root = renderOtp(6);
  });

  test("renders N native single-char slots + a hidden name mirror", () => {
    expect(slots(root)).toHaveLength(6);
    slots(root).forEach((s) => expect(s.getAttribute("maxlength")).toBe("1"));
    expect(mirror(root).name).toBe("otp");
    expect(mirror(root).type).toBe("hidden");
  });

  test("each slot is labelled Character N of M (WAI one-time-password-field)", () => {
    const labels = slots(root).map((s) => s.getAttribute("aria-label"));
    expect(labels[0]).toBe("Character 1 of 6");
    expect(labels[5]).toBe("Character 6 of 6");
  });
});

describe("input-otp enhancer behaviour", () => {
  let root: HTMLElement;
  beforeEach(() => {
    root = renderOtp(4);
    enhanceInputOtp(root);
  });

  test("typing a valid char auto-advances and syncs the mirror", () => {
    const s = slots(root);
    type(s[0], "1");
    type(s[1], "2");
    expect(mirror(root).value).toBe("12");
    expect(document.activeElement).toBe(s[2]);
  });

  test("a rejected char (non-numeric) is cleared and the mirror is unaffected", () => {
    const s = slots(root);
    type(s[0], "x");
    expect(s[0].value).toBe("");
    expect(mirror(root).value).toBe("");
  });

  test("paste distributes the filtered characters across the slots", () => {
    const s = slots(root);
    const evt = new Event("paste", { bubbles: true }) as ClipboardEvent;
    Object.defineProperty(evt, "clipboardData", {
      value: { getData: () => "12ab34" },
      configurable: true,
    });
    s[0].dispatchEvent(evt);
    // numeric accept keeps 1,2,3,4
    expect(slots(root).map((x) => x.value).join("")).toBe("1234");
    expect(mirror(root).value).toBe("1234");
  });

  test("backspace on an empty slot steps back and clears the previous slot", () => {
    const s = slots(root);
    type(s[0], "1");
    type(s[1], "2");
    // focus is now on s[2] (empty); backspace steps back to s[1] and clears it
    s[2].dispatchEvent(new KeyboardEvent("keydown", { key: "Backspace", bubbles: true }));
    expect(s[1].value).toBe("");
    expect(mirror(root).value).toBe("1");
    expect(document.activeElement).toBe(s[1]);
  });

  test("enhanceInputOtp is idempotent (re-enhancing does not double-bind)", () => {
    enhanceInputOtp(root); // second call: marked, no-op
    const s = slots(root);
    type(s[0], "5");
    expect(mirror(root).value).toBe("5"); // a single input handler, not two
  });

  test("enhanceAllInputOtp wires every root on the page", () => {
    const second = renderOtp(3);
    enhanceAllInputOtp();
    type(slots(second)[0], "9");
    expect(mirror(second).value).toBe("9");
  });
});

describe("input-otp onComplete", () => {
  test("fires lievit:otp-complete (with the joined value) once every slot is filled", () => {
    const root = renderOtp(3, "numeric", "event");
    enhanceInputOtp(root);
    const events: string[] = [];
    root.addEventListener("lievit:otp-complete", (e) =>
      events.push((e as CustomEvent<string>).detail),
    );
    const s = slots(root);
    type(s[0], "1");
    type(s[1], "2");
    expect(events).toHaveLength(0); // not yet full
    type(s[2], "3");
    expect(events).toEqual(["123"]);
  });

  test("does NOT re-fire on every keystroke once complete; re-arms only after dropping below full", () => {
    const root = renderOtp(2, "numeric", "event");
    enhanceInputOtp(root);
    let fires = 0;
    root.addEventListener("lievit:otp-complete", () => {
      fires += 1;
    });
    const s = slots(root);
    type(s[0], "1");
    type(s[1], "2");
    expect(fires).toBe(1);
    // overtype the last slot while still full -> no second fire
    type(s[1], "5");
    expect(fires).toBe(1);
    // clear a slot (drop below full) then refill -> re-arms, fires again
    s[1].value = "";
    s[1].dispatchEvent(new Event("input", { bubbles: true }));
    type(s[1], "9");
    expect(fires).toBe(2);
  });

  test('onComplete="submit" requestSubmits the enclosing form when filled', () => {
    const form = document.createElement("form");
    const root = renderOtp(2, "numeric", "submit");
    form.appendChild(root);
    document.body.appendChild(form);
    let submitted = 0;
    // jsdom/happy-dom: requestSubmit dispatches a submit event we can observe
    form.requestSubmit = () => {
      submitted += 1;
    };
    enhanceInputOtp(root);
    const s = slots(root);
    type(s[0], "4");
    expect(submitted).toBe(0);
    type(s[1], "2");
    expect(submitted).toBe(1);
  });

  test("a root with no data-otp-complete never fires the event", () => {
    const root = renderOtp(2); // no complete attribute
    enhanceInputOtp(root);
    let fires = 0;
    root.addEventListener("lievit:otp-complete", () => {
      fires += 1;
    });
    const s = slots(root);
    type(s[0], "1");
    type(s[1], "2");
    expect(fires).toBe(0);
  });
});
