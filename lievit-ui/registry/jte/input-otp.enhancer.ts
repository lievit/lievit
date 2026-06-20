/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * input-otp enhancer (ADR-0012, server-first): the CSP-clean typed-TS that gives the server-rendered
 * `lievit/input-otp.jte` partial its focus choreography. The slots, the `name` mirror and the value
 * are all server-rendered HTML; this module ONLY nudges focus between slots and keeps the hidden
 * mirror in sync, so the OTP submits as one form field with zero inline script (the strict CSP
 * refuses inline `on*=` handlers; this attaches listeners in code instead).
 *
 * It is deliberately stateless server-side: an OTP needs no server decision between keystrokes, so
 * there is no wire round-trip per character (that would be chat for no gain). The value is bound at
 * POST via the mirror. Behaviour mirrors the WAI one-time-password-field (the dropped Lit island's
 * model):
 *   - auto-advance: a valid char moves focus to the next empty slot;
 *   - backspace: clears the current slot, or steps back when already empty;
 *   - arrows / Home / End: move between slots;
 *   - paste: distributes the filtered characters across the slots from the focused one;
 *   - filtering: characters outside the type's accept set are rejected;
 *   - onComplete: when the root declares `data-otp-complete`, a `lievit:otp-complete` CustomEvent
 *     (detail = the joined value) fires once every slot is filled; `data-otp-complete="submit"`
 *     also submits the enclosing <form>. The completion fires once per filled state (it re-arms
 *     when the value drops below full), so editing a complete code does not re-submit on every key.
 *
 * Idempotent: call {@link enhanceInputOtp} once (it marks each root) and again after a DOM swap;
 * already-enhanced roots are skipped. {@link enhanceAllInputOtp} wires every root on the page.
 */

type OtpType = "numeric" | "alphanumeric" | "alpha";

const ACCEPT: Record<OtpType, RegExp> = {
  numeric: /[0-9]/,
  alphanumeric: /[a-zA-Z0-9]/,
  alpha: /[a-zA-Z]/,
};

const ENHANCED = "data-otp-enhanced";

/** Resolve the accept regexp for a root's declared type (defaults to numeric). */
function acceptFor(root: HTMLElement): RegExp {
  const t = (root.getAttribute("data-otp-type") ?? "numeric") as OtpType;
  return ACCEPT[t] ?? ACCEPT.numeric;
}

/** The ordered slot inputs of a root. */
function slotsOf(root: HTMLElement): HTMLInputElement[] {
  return Array.from(root.querySelectorAll<HTMLInputElement>("[data-otp-slot]")).sort(
    (a, b) =>
      Number(a.getAttribute("data-otp-slot")) - Number(b.getAttribute("data-otp-slot")),
  );
}

/** The hidden `name` mirror of a root (the field that submits). */
function mirrorOf(root: HTMLElement): HTMLInputElement | null {
  return root.querySelector<HTMLInputElement>("[data-otp-mirror]");
}

/** Track whether a root has already fired its completion for the current filled state. */
const COMPLETED = new WeakSet<HTMLElement>();

/**
 * Fire the onComplete behaviour when every slot is filled, exactly once per filled state.
 * Declared by `data-otp-complete` on the root ("submit" also submits the enclosing form).
 * Re-arms (clears the latch) as soon as the value is no longer full, so editing a complete
 * code does not re-fire on every keystroke.
 */
function maybeComplete(root: HTMLElement, joined: string): void {
  const mode = root.getAttribute("data-otp-complete");
  const expected = Number(root.getAttribute("data-otp-length") ?? slotsOf(root).length);
  const full = joined.length === expected && expected > 0;
  if (!full) {
    COMPLETED.delete(root);
    return;
  }
  if (!mode || COMPLETED.has(root)) return;
  COMPLETED.add(root);
  root.dispatchEvent(
    new CustomEvent("lievit:otp-complete", { bubbles: true, detail: joined }),
  );
  if (mode === "submit") {
    mirrorOf(root)?.closest("form")?.requestSubmit();
  }
}

/** Recompute the mirror value from the slots and fire `input`/`change` on it for any wire/listener. */
function syncMirror(root: HTMLElement): void {
  const mirror = mirrorOf(root);
  if (!mirror) return;
  const joined = slotsOf(root)
    .map((s) => s.value)
    .join("");
  if (mirror.value !== joined) {
    mirror.value = joined;
    mirror.dispatchEvent(new Event("input", { bubbles: true }));
    mirror.dispatchEvent(new Event("change", { bubbles: true }));
  }
  maybeComplete(root, joined);
}

/** Focus a slot by index, clamped to range. */
function focusSlot(slots: HTMLInputElement[], index: number): void {
  const i = Math.max(0, Math.min(slots.length - 1, index));
  slots[i]?.focus();
  slots[i]?.select();
}

/** Enhance one OTP root. No-op if it has no slots or is already enhanced. */
export function enhanceInputOtp(root: HTMLElement): void {
  if (root.hasAttribute(ENHANCED)) return;
  const slots = slotsOf(root);
  if (slots.length === 0) return;
  root.setAttribute(ENHANCED, "");
  const accept = acceptFor(root);

  slots.forEach((slot, index) => {
    slot.addEventListener("input", () => {
      // Keep only the last accepted char (handles overtype on a filled slot).
      const ch = Array.from(slot.value)
        .reverse()
        .find((c) => accept.test(c));
      if (ch) {
        slot.value = ch;
        syncMirror(root);
        if (index < slots.length - 1) focusSlot(slots, index + 1);
      } else {
        slot.value = "";
        syncMirror(root);
      }
    });

    slot.addEventListener("keydown", (e: KeyboardEvent) => {
      switch (e.key) {
        case "Backspace":
          if (slot.value === "" && index > 0) {
            e.preventDefault();
            slots[index - 1].value = "";
            syncMirror(root);
            focusSlot(slots, index - 1);
          }
          break;
        case "ArrowLeft":
          e.preventDefault();
          focusSlot(slots, index - 1);
          break;
        case "ArrowRight":
          e.preventDefault();
          focusSlot(slots, index + 1);
          break;
        case "Home":
          e.preventDefault();
          focusSlot(slots, 0);
          break;
        case "End":
          e.preventDefault();
          focusSlot(slots, slots.length - 1);
          break;
        default:
          break;
      }
    });

    slot.addEventListener("paste", (e: ClipboardEvent) => {
      e.preventDefault();
      const pasted = e.clipboardData?.getData("text") ?? "";
      const filtered = Array.from(pasted).filter((c) => accept.test(c));
      if (filtered.length === 0) return;
      let cursor = index;
      for (const c of filtered) {
        if (cursor >= slots.length) break;
        slots[cursor].value = c;
        cursor++;
      }
      syncMirror(root);
      focusSlot(slots, Math.min(cursor, slots.length - 1));
    });
  });
}

/** Enhance every `[data-lievit-otp]` root on the page (call on load + after DOM swaps). */
export function enhanceAllInputOtp(scope: ParentNode = document): void {
  scope
    .querySelectorAll<HTMLElement>("[data-lievit-otp]")
    .forEach((root) => enhanceInputOtp(root));
}
