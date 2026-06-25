/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * input-otp client enhancer (v-next, ADR-0012 + ADR-0019):
 *
 * The server renders N native single-character inputs + a hidden `name` mirror. The assembled
 * value POSTs with the enclosing form with zero JS (the mirror already holds the joined chars).
 * This module adds the ONE irreducible client behaviour: the intra-slot focus choreography that
 * cannot be expressed as a server round-trip without a disqualifying UX cost.
 *
 * Responsibilities:
 *   1. Roving tabindex: only the active slot is tabindex="0"; all others are tabindex="-1".
 *      The group is a composite widget per APG; Tab exits the group; Arrow/Home/End navigate
 *      within it. This is the APG roving-tabindex keyboard-interface practice.
 *   2. Character input: validates the char against the declared mode (numeric/alphanumeric/any);
 *      writes it to the slot; advances DOM focus to the next slot.
 *   3. Backspace: clears the current slot (when filled) or retreats focus to the previous slot
 *      and clears it (when the current slot is already empty).
 *   4. Delete: clears the current slot; stays on it.
 *   5. Arrow / Home / End: navigate between slots; prevents browser caret motion.
 *   6. Paste: intercepts the paste event on the group container (delegated); strips non-conforming
 *      chars per mode; distributes left-to-right from slot 0; announces "Code filled" on success.
 *   7. Mirror sync: keeps the hidden mirror (data-otp-mirror) in sync so FormData sees the
 *      joined value without JS at submit time.
 *   8. Completion: when all N slots are filled, fires a `lievit:otp-complete` CustomEvent on the
 *      root (detail = the joined value). When data-otp-complete="submit" the enclosing form is
 *      also requestSubmit()-ed. When data-otp-autosubmit="false" completion fires on Enter only.
 *   9. Mask toggle: the mask toggle button (data-otp-mask-toggle) is handled by the CALLER via
 *      a server-rendered state change (re-render the template with masked=true/false); the enhancer
 *      never manages input type.
 *
 * Idempotent: call enhanceInputOtp on the root once; already-enhanced roots are skipped.
 * Call enhanceAllInputOtp after a DOM swap to wire any newly inserted roots.
 *
 * WAI-ARIA APG sources:
 *   Spinbutton: https://www.w3.org/WAI/ARIA/apg/patterns/spinbutton/
 *   Roving tabindex: https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/
 *   Date Picker Spin Buttons (the role="group" + multiple spinbuttons model):
 *     https://www.w3.org/WAI/ARIA/apg/patterns/spinbutton/examples/datepicker-spinbuttons/
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type OtpMode = "numeric" | "alphanumeric" | "any";

/** Accept regexp per mode: a single character that is valid in that mode. */
const ACCEPT: Record<OtpMode, RegExp> = {
  numeric: /^[0-9]$/,
  alphanumeric: /^[A-Za-z0-9]$/,
  any: /^[\x20-\x7E]$/,
};

// ---------------------------------------------------------------------------
// Root data attribute helpers
// ---------------------------------------------------------------------------

/** The ordered slot inputs of a root (sorted by data-otp-slot index). */
function slotsOf(root: Element): HTMLInputElement[] {
  return Array.from(root.querySelectorAll<HTMLInputElement>("[data-otp-slot]")).sort(
    (a, b) => Number(a.dataset.otpSlot) - Number(b.dataset.otpSlot),
  );
}

/** The hidden mirror input (data-otp-mirror) within the root. */
function mirrorOf(root: Element): HTMLInputElement | null {
  return root.querySelector<HTMLInputElement>("[data-otp-mirror]");
}

/** Accept regexp for the root's declared mode (defaults to numeric). */
function acceptFor(root: Element): RegExp {
  const m = (root as HTMLElement).dataset.otpMode as OtpMode | undefined;
  return ACCEPT[m ?? "numeric"] ?? ACCEPT.numeric;
}

/** Declared mode (defaults to "numeric"). */
function modeFor(root: Element): OtpMode {
  const m = (root as HTMLElement).dataset.otpMode as OtpMode | undefined;
  return m ?? "numeric";
}

/** Whether autoSubmit is enabled on this root (default true unless explicitly "false"). */
function autoSubmitFor(root: Element): boolean {
  return (root as HTMLElement).dataset.otpAutosubmit !== "false";
}

/** The declared slot count N from data-otp-length (falls back to counting the slot inputs). */
function lengthFor(root: Element): number {
  const n = Number((root as HTMLElement).dataset.otpLength);
  return Number.isFinite(n) && n > 0 ? n : slotsOf(root).length;
}

// ---------------------------------------------------------------------------
// Normalise a character per mode
// ---------------------------------------------------------------------------

/** Normalise a character per mode: alphanumeric -> uppercase; others pass through. */
function normalise(ch: string, mode: OtpMode): string {
  return mode === "alphanumeric" ? ch.toUpperCase() : ch;
}

// ---------------------------------------------------------------------------
// Roving tabindex
// ---------------------------------------------------------------------------

/**
 * Set tabindex="0" on the given slot and tabindex="-1" on all others.
 * APG roving-tabindex practice: only one composite-widget element is in the tab sequence
 * at a time; Arrow keys navigate within the widget without Tab leaving the group.
 */
function rove(slots: HTMLInputElement[], active: HTMLInputElement): void {
  for (const s of slots) {
    s.tabIndex = s === active ? 0 : -1;
  }
}

// ---------------------------------------------------------------------------
// Mirror sync and completion
// ---------------------------------------------------------------------------

/** Concatenate all slot values in slot-index order. */
function assembleToken(slots: HTMLInputElement[]): string {
  return slots.map((s) => s.value).join("");
}

/**
 * Sync the hidden mirror with the assembled token. Fires a native input event on the mirror
 * so any l:model binding on the mirror picks up the update via the runtime's directive registry.
 */
function syncMirror(root: Element, token: string): void {
  const mirror = mirrorOf(root);
  if (!mirror || mirror.value === token) return;
  mirror.value = token;
  mirror.dispatchEvent(new Event("input", { bubbles: true }));
}

/**
 * Track whether a root has already fired its completion for the CURRENT filled state.
 * The latch is stored per root in a WeakSet; it is cleared the moment the code drops
 * below full, so editing a complete code after an error re-arms the completion normally.
 */
const COMPLETED = new WeakSet<Element>();

/**
 * Fire the completion behaviour when all N slots are filled, exactly once per filled state.
 * - Fires a `lievit:otp-complete` CustomEvent (detail = token) on the root when complete.
 * - When data-otp-complete="submit" also requestSubmit()-s the enclosing form.
 * - Re-arms (clears the latch) as soon as the token drops below N chars.
 * - When data-otp-autosubmit="false" this function is NOT called from the input handler;
 *   it is called from the Enter keydown handler only.
 */
function maybeFireComplete(root: Element, token: string): void {
  const expected = lengthFor(root);
  const full = token.length === expected && expected > 0;
  if (!full) {
    COMPLETED.delete(root);
    return;
  }
  if (COMPLETED.has(root)) return;
  COMPLETED.add(root);

  const mode = (root as HTMLElement).dataset.otpComplete;
  if (!mode) return; // no data-otp-complete: do not fire the event (plain form POST only)

  root.dispatchEvent(
    new CustomEvent("lievit:otp-complete", { bubbles: true, detail: token }),
  );
  if (mode === "submit") {
    const mirror = mirrorOf(root);
    mirror?.closest("form")?.requestSubmit();
  }
}

// ---------------------------------------------------------------------------
// Announcement (paste success)
// ---------------------------------------------------------------------------

/**
 * Announce a short polite status message for screen reader users.
 * Uses the shared lievit announcer when available ($lievit.announce); falls back to a
 * transient role="status" element appended to the body (auto-removed after 3s).
 */
function announce(message: string): void {
  const lievit = (
    window as unknown as { $lievit?: { announce?: (msg: string, politeness?: string) => void } }
  ).$lievit;
  if (lievit?.announce) {
    lievit.announce(message, "polite");
    return;
  }
  const el = document.createElement("div");
  el.setAttribute("role", "status");
  el.setAttribute("aria-live", "polite");
  el.setAttribute("aria-atomic", "true");
  el.style.cssText =
    "position:absolute;width:1px;height:1px;padding:0;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0;";
  document.body.appendChild(el);
  // Defer the text so the element is in the DOM before the announcement fires.
  setTimeout(() => {
    el.textContent = message;
    setTimeout(() => el.remove(), 3000);
  }, 50);
}

// ---------------------------------------------------------------------------
// Mount: bind event listeners on one OTP root
// ---------------------------------------------------------------------------

const MOUNTED = "data-otp-enhanced";

/**
 * Bind event listeners on one OTP component root. Idempotent (MOUNTED guard prevents
 * double-binding when enhanceAllInputOtp is called after a DOM swap that leaves
 * already-enhanced roots in the tree).
 *
 * DEPRECATED: this enhancer is superseded by the `lv-input-otp` Stimulus controller (auto-loaded
 * via startStimulus). It is kept only so an adopter mid-migration who still calls
 * enhanceAllInputOtp does not break; it SKIPS any root the controller already owns
 * (`data-controller~="lv-input-otp"`) so the two never double-handle a slot. Remove this file once
 * no adopter imports it (a dedicated cleanup PR; drop the meta.json enhancer file too).
 */
export function enhanceInputOtp(root: HTMLElement): void {
  if (root.hasAttribute(MOUNTED)) return;
  // The Stimulus controller owns this root: do not double-bind (the §7 coexistence guard).
  const controllers = root.getAttribute("data-controller");
  if (controllers != null && controllers.split(/\s+/).includes("lv-input-otp")) return;
  const slots = slotsOf(root);
  if (slots.length === 0) return;
  root.setAttribute(MOUNTED, "");

  const mode = modeFor(root);
  const accept = acceptFor(root);

  // Roving tabindex: slot 0 gets tabindex="0", all others get "-1".
  // Subsequent roving is driven by focus events (user clicking a slot) and
  // explicit Arrow/Home/End key navigation.
  rove(slots, slots[0]);

  // -------------------------------------------------------------------------
  // Per-slot event listeners
  // -------------------------------------------------------------------------
  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    const idx = i;

    // input: validate, normalise, write the char, advance focus, sync mirror, maybe complete.
    slot.addEventListener("input", () => {
      // Keep only the last accepted char (handles overtype on a pre-filled slot: the browser
      // appends the new char to the existing single-char value, giving a 2-char string; we
      // scan in reverse for the first accepted char so the NEW char wins over the stale one).
      const raw = Array.from(slot.value)
        .reverse()
        .find((c) => accept.test(c));
      if (raw) {
        slot.value = normalise(raw, mode);
        // Update aria-valuenow so screen readers know the digit changed.
        if (mode === "numeric") {
          slot.setAttribute("aria-valuenow", slot.value);
          slot.setAttribute("aria-valuetext", slot.value);
        } else {
          slot.setAttribute("aria-valuetext", slot.value);
        }
        // Advance to the next slot (focus + roving tabindex update).
        if (idx < slots.length - 1) {
          const next = slots[idx + 1];
          rove(slots, next);
          next.focus();
          next.select();
        }
      } else {
        // Rejected char: clear the slot (do not write invalid content).
        slot.value = "";
        if (mode === "numeric") {
          slot.removeAttribute("aria-valuenow");
        }
        slot.setAttribute("aria-valuetext", "blank");
      }
      // Sync mirror first, then check completion.
      const token = assembleToken(slots);
      syncMirror(root, token);
      if (autoSubmitFor(root)) {
        maybeFireComplete(root, token);
      }
    });

    // keydown: navigation, backspace, delete, enter.
    slot.addEventListener("keydown", (e: KeyboardEvent) => {
      switch (e.key) {
        case "Backspace":
          if (slot.value !== "") {
            // Filled slot: clear the value, stay on this slot.
            slot.value = "";
            if (mode === "numeric") slot.removeAttribute("aria-valuenow");
            slot.setAttribute("aria-valuetext", "blank");
            syncMirror(root, assembleToken(slots));
            e.preventDefault();
          } else if (idx > 0) {
            // Empty slot: retreat to the previous slot and clear it.
            e.preventDefault();
            const prev = slots[idx - 1];
            prev.value = "";
            if (mode === "numeric") prev.removeAttribute("aria-valuenow");
            prev.setAttribute("aria-valuetext", "blank");
            syncMirror(root, assembleToken(slots));
            rove(slots, prev);
            prev.focus();
          }
          break;
        case "Delete":
          slot.value = "";
          if (mode === "numeric") slot.removeAttribute("aria-valuenow");
          slot.setAttribute("aria-valuetext", "blank");
          syncMirror(root, assembleToken(slots));
          e.preventDefault();
          break;
        case "ArrowLeft":
          e.preventDefault();
          if (idx > 0) {
            rove(slots, slots[idx - 1]);
            slots[idx - 1].focus();
          }
          break;
        case "ArrowRight":
          e.preventDefault();
          if (idx < slots.length - 1) {
            rove(slots, slots[idx + 1]);
            slots[idx + 1].focus();
          }
          break;
        case "Home":
          e.preventDefault();
          rove(slots, slots[0]);
          slots[0].focus();
          break;
        case "End": {
          e.preventDefault();
          const last = slots[slots.length - 1];
          rove(slots, last);
          last.focus();
          break;
        }
        case "Enter":
          // autoSubmit=false: fire completion on Enter if all slots are filled.
          if (!autoSubmitFor(root)) {
            const token = assembleToken(slots);
            if (token.length === lengthFor(root) && token.length > 0) {
              e.preventDefault();
              maybeFireComplete(root, token);
            }
          }
          break;
        default:
          break;
      }
    });

    // focus: sync roving tabindex when the user clicks directly on a slot.
    slot.addEventListener("focus", () => {
      rove(slots, slot);
    });
  }

  // -------------------------------------------------------------------------
  // Paste: delegated on the group container (not per-slot, per spec §6).
  // Strips non-conforming chars, distributes left-to-right from slot 0.
  // -------------------------------------------------------------------------
  const group = root.querySelector("[data-slot=\"input-otp-group\"]") ?? root;
  group.addEventListener("paste", (rawEvt: Event) => {
    const e = rawEvt as ClipboardEvent;
    e.preventDefault();
    const raw = e.clipboardData?.getData("text") ?? "";
    const chars = Array.from(raw)
      .filter((c) => accept.test(c))
      .map((c) => normalise(c, mode));
    if (chars.length === 0) return;

    // Distribute from slot 0 (not from the currently focused slot, per spec).
    const currentSlots = slotsOf(root);
    let cursor = 0;
    for (const ch of chars) {
      if (cursor >= currentSlots.length) break;
      currentSlots[cursor].value = ch;
      if (mode === "numeric") {
        currentSlots[cursor].setAttribute("aria-valuenow", ch);
        currentSlots[cursor].setAttribute("aria-valuetext", ch);
      } else {
        currentSlots[cursor].setAttribute("aria-valuetext", ch);
      }
      cursor++;
    }
    const token = assembleToken(currentSlots);
    syncMirror(root, token);

    // Move focus to the first unfilled slot (or the last slot if all are filled).
    const firstEmpty = currentSlots.findIndex((s) => s.value === "");
    const focusTarget =
      firstEmpty >= 0 ? currentSlots[firstEmpty] : currentSlots[currentSlots.length - 1];
    rove(currentSlots, focusTarget);
    focusTarget.focus();

    if (token.length === lengthFor(root) && token.length > 0) {
      announce("Code filled");
      if (autoSubmitFor(root)) {
        maybeFireComplete(root, token);
      }
    }
  });
}

// ---------------------------------------------------------------------------
// Batch entry points
// ---------------------------------------------------------------------------

/**
 * Enhance every `[data-slot="input-otp"]` root on the page (or within `scope`).
 * Call on initial page load and again after any DOM swap that may have introduced new roots.
 * Already-enhanced roots are skipped (idempotent).
 */
export function enhanceAllInputOtp(scope: ParentNode = document): void {
  scope
    .querySelectorAll<HTMLElement>("[data-slot=\"input-otp\"]")
    .forEach((root) => enhanceInputOtp(root));
}
