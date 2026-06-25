/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * `lv-input-otp` -- the fixed-length one-time-password / PIN field, as a Stimulus controller (the
 * conversion of `registry/jte/input-otp.enhancer.ts`). Mounted on the component ROOT via
 * `data-controller="lv-input-otp"`. The server renders N native single-character inputs
 * (`data-otp-slot`, `role="spinbutton"`), a hidden `name` mirror (`data-otp-mirror`) and the root
 * `data-otp-mode` / `data-otp-length` / `data-otp-autosubmit` / `data-otp-complete` contract; this
 * controller adds ONLY the irreducible intra-slot focus choreography that a server round-trip would
 * make unusable. The assembled value POSTs with the enclosing form via the mirror -- ZERO wire
 * round-trips mid-entry, so this controller never touches the lievit wire (no DismissableController,
 * no `callWire`): it is a purely client-side input behaviour.
 *
 * Behaviour (assertion-for-assertion with the old enhancer):
 * 1. Roving tabindex: only the active slot is `tabindex="0"`; all others `-1` (APG composite-widget
 *    practice). Tab exits the group; Arrow/Home/End navigate within it.
 * 2. Character input: validate against the declared mode (numeric/alphanumeric/any), normalise
 *    (alphanumeric -> uppercase), write, advance focus to the next slot, sync the mirror.
 * 3. Backspace: clear a filled slot (stay), or retreat-and-clear the previous when already empty.
 * 4. Delete: clear the current slot, stay.
 * 5. Arrow / Home / End: move focus between slots; suppress native caret motion.
 * 6. Paste (delegated on the group): strip non-conforming chars, distribute left-to-right from
 *    slot 0, focus the first empty slot, announce "Code filled" on full fill.
 * 7. Mirror sync: keep `data-otp-mirror` joined-value in sync (a native `input` event so an l:model
 *    binding picks it up) so FormData sees the code at submit time with zero JS at POST.
 * 8. Completion: when all N slots are filled, fire a `lievit:otp-complete` CustomEvent (detail =
 *    token) exactly once per filled state (the latch re-arms when the code drops below full); when
 *    `data-otp-complete="submit"` also `requestSubmit()` the enclosing form; when
 *    `data-otp-autosubmit="false"` completion fires on Enter only.
 *
 * Wiring (CSP-clean, declared in input-otp.jte, NOT inline handlers):
 * - each slot: `data-action="input->lv-input-otp#onInput keydown->lv-input-otp#onKeydown
 *   focus->lv-input-otp#onFocus"` + `data-lv-input-otp-target="slot"`.
 * - the group: `data-action="paste->lv-input-otp#onPaste"`.
 * - the mirror: `data-lv-input-otp-target="mirror"`.
 * All element events ride `data-action`, so Stimulus re-binds them automatically when the wire morph
 * re-renders a slot -- no document/window-global listeners, hence no `connect()`-bound teardown.
 *
 * Morph-safety: Stimulus connects this controller once per element+identifier and disconnects it
 * when the morph drops the root; the declared `data-action`s survive an in-place morph (its action
 * observer re-binds re-rendered descendants). NO `data-otp-enhanced` marker, no `WeakSet`-of-roots,
 * no stacked listeners -- Stimulus owns the lifecycle. The completion latch is a per-instance field,
 * so it persists across an in-place morph (idiomorph keeps the node) and resets when the root is
 * replaced, matching the old WeakSet-keyed-by-root semantics.
 *
 * WAI-ARIA APG sources:
 *   Spinbutton: https://www.w3.org/WAI/ARIA/apg/patterns/spinbutton/
 *   Roving tabindex: https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/
 *   Date Picker Spin Buttons (role="group" + multiple spinbuttons):
 *     https://www.w3.org/WAI/ARIA/apg/patterns/spinbutton/examples/datepicker-spinbuttons/
 */

import { Controller } from "@hotwired/stimulus";

/** The character classes the field accepts, per declared mode. */
type OtpMode = "numeric" | "alphanumeric" | "any";

/** Accept regexp per mode: a single character that is valid in that mode. */
const ACCEPT: Record<OtpMode, RegExp> = {
  numeric: /^[0-9]$/,
  alphanumeric: /^[A-Za-z0-9]$/,
  any: /^[\x20-\x7E]$/,
};

/** Normalise a character per mode: alphanumeric -> uppercase; others pass through. */
function normalise(ch: string, mode: OtpMode): string {
  return mode === "alphanumeric" ? ch.toUpperCase() : ch;
}

/**
 * Announce a short polite status message for screen reader users. Uses the shared lievit announcer
 * when available (`$lievit.announce`); falls back to a transient `role="status"` live region
 * appended to the body (auto-removed after 3s). This is an a11y announcement, not a wire call, so it
 * is exempt from the wire-bridge rule (it never reaches the server).
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

export default class LvInputOtpController extends Controller<HTMLElement> {
  static targets = ["slot", "mirror"];

  declare readonly slotTargets: HTMLInputElement[];
  declare readonly hasMirrorTarget: boolean;
  declare readonly mirrorTarget: HTMLInputElement;

  /**
   * Completion latch: `lievit:otp-complete` fires exactly once per filled state. Cleared the moment
   * the token drops below full, so editing a complete code after an error re-arms completion. A
   * per-instance field replaces the old module-level WeakSet-keyed-by-root.
   */
  private completed = false;

  /**
   * Initialise roving tabindex on mount: slot 0 gets `tabindex="0"`, all others `-1`. Subsequent
   * roving is driven by `focus` (click) + Arrow/Home/End. No listeners are bound here -- every
   * element event is a `data-action`, so there is nothing to tear down in a `disconnect()`.
   */
  connect(): void {
    const slots = this.slotTargets;
    if (slots.length > 0) {
      this.rove(slots[0]);
    }
  }

  // ---------------------------------------------------------------------------
  // Root contract (read from the server-rendered data-* attributes)
  // ---------------------------------------------------------------------------

  /** Declared mode (defaults to "numeric"). */
  private get mode(): OtpMode {
    const m = this.element.dataset.otpMode as OtpMode | undefined;
    return m ?? "numeric";
  }

  /** Accept regexp for the declared mode. */
  private get accept(): RegExp {
    return ACCEPT[this.mode] ?? ACCEPT.numeric;
  }

  /** Whether autoSubmit is enabled (default true unless explicitly "false"). */
  private get autoSubmit(): boolean {
    return this.element.dataset.otpAutosubmit !== "false";
  }

  /** The declared slot count N (falls back to counting the slot targets). */
  private get length(): number {
    const n = Number(this.element.dataset.otpLength);
    return Number.isFinite(n) && n > 0 ? n : this.slotTargets.length;
  }

  /** The hidden mirror input, or null when not present. */
  private get mirror(): HTMLInputElement | null {
    return this.hasMirrorTarget ? this.mirrorTarget : null;
  }

  // ---------------------------------------------------------------------------
  // Actions (data-action; see input-otp.jte)
  // ---------------------------------------------------------------------------

  /** Validate + write the typed char, advance focus, sync the mirror, maybe fire completion. */
  onInput(event: Event): void {
    const slot = event.currentTarget as HTMLInputElement;
    const slots = this.slotTargets;
    const idx = slots.indexOf(slot);
    if (idx < 0) {
      return;
    }
    const mode = this.mode;
    // Keep only the last accepted char (overtype on a pre-filled slot leaves a 2-char string; scan
    // in reverse so the NEW char wins over the stale one).
    const raw = Array.from(slot.value)
      .reverse()
      .find((c) => this.accept.test(c));
    if (raw) {
      slot.value = normalise(raw, mode);
      if (mode === "numeric") {
        slot.setAttribute("aria-valuenow", slot.value);
      }
      slot.setAttribute("aria-valuetext", slot.value);
      // Advance to the next slot (focus + roving tabindex).
      if (idx < slots.length - 1) {
        const next = slots[idx + 1];
        this.rove(next);
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
    const token = this.assembleToken(slots);
    this.syncMirror(token);
    if (this.autoSubmit) {
      this.maybeFireComplete(token);
    }
  }

  /** Backspace / Delete / Arrow / Home / End / Enter navigation + editing. */
  onKeydown(event: KeyboardEvent): void {
    const slot = event.currentTarget as HTMLInputElement;
    const slots = this.slotTargets;
    const idx = slots.indexOf(slot);
    if (idx < 0) {
      return;
    }
    const mode = this.mode;
    switch (event.key) {
      case "Backspace":
        if (slot.value !== "") {
          // Filled slot: clear the value, stay on this slot.
          slot.value = "";
          if (mode === "numeric") slot.removeAttribute("aria-valuenow");
          slot.setAttribute("aria-valuetext", "blank");
          this.syncMirror(this.assembleToken(slots));
          event.preventDefault();
        } else if (idx > 0) {
          // Empty slot: retreat to the previous slot and clear it.
          event.preventDefault();
          const prev = slots[idx - 1];
          prev.value = "";
          if (mode === "numeric") prev.removeAttribute("aria-valuenow");
          prev.setAttribute("aria-valuetext", "blank");
          this.syncMirror(this.assembleToken(slots));
          this.rove(prev);
          prev.focus();
        }
        break;
      case "Delete":
        slot.value = "";
        if (mode === "numeric") slot.removeAttribute("aria-valuenow");
        slot.setAttribute("aria-valuetext", "blank");
        this.syncMirror(this.assembleToken(slots));
        event.preventDefault();
        break;
      case "ArrowLeft":
        event.preventDefault();
        if (idx > 0) {
          this.rove(slots[idx - 1]);
          slots[idx - 1].focus();
        }
        break;
      case "ArrowRight":
        event.preventDefault();
        if (idx < slots.length - 1) {
          this.rove(slots[idx + 1]);
          slots[idx + 1].focus();
        }
        break;
      case "Home":
        event.preventDefault();
        this.rove(slots[0]);
        slots[0].focus();
        break;
      case "End": {
        event.preventDefault();
        const last = slots[slots.length - 1];
        this.rove(last);
        last.focus();
        break;
      }
      case "Enter":
        // autoSubmit=false: fire completion on Enter when all slots are filled.
        if (!this.autoSubmit) {
          const token = this.assembleToken(slots);
          if (token.length === this.length && token.length > 0) {
            event.preventDefault();
            this.maybeFireComplete(token);
          }
        }
        break;
      default:
        break;
    }
  }

  /** Sync the roving tabindex when the user focuses a slot directly (e.g. a click). */
  onFocus(event: Event): void {
    this.rove(event.currentTarget as HTMLInputElement);
  }

  /**
   * Paste handler (delegated on the group, per spec §6). Strips non-conforming chars, distributes
   * left-to-right from slot 0, focuses the first empty slot, and announces + maybe completes when
   * the paste fills the field.
   */
  onPaste(event: ClipboardEvent): void {
    event.preventDefault();
    const mode = this.mode;
    const accept = this.accept;
    const raw = event.clipboardData?.getData("text") ?? "";
    const chars = Array.from(raw)
      .filter((c) => accept.test(c))
      .map((c) => normalise(c, mode));
    if (chars.length === 0) {
      return;
    }

    const slots = this.slotTargets;
    let cursor = 0;
    for (const ch of chars) {
      if (cursor >= slots.length) break;
      slots[cursor].value = ch;
      if (mode === "numeric") {
        slots[cursor].setAttribute("aria-valuenow", ch);
      }
      slots[cursor].setAttribute("aria-valuetext", ch);
      cursor++;
    }
    const token = this.assembleToken(slots);
    this.syncMirror(token);

    // Move focus to the first unfilled slot (or the last slot if all are filled).
    const firstEmpty = slots.findIndex((s) => s.value === "");
    const focusTarget = firstEmpty >= 0 ? slots[firstEmpty] : slots[slots.length - 1];
    this.rove(focusTarget);
    focusTarget.focus();

    if (token.length === this.length && token.length > 0) {
      announce("Code filled");
      if (this.autoSubmit) {
        this.maybeFireComplete(token);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /**
   * Set `tabindex="0"` on `active` and `-1` on all other slots (APG roving-tabindex: only one
   * composite-widget element is in the tab sequence at a time).
   */
  private rove(active: HTMLInputElement): void {
    for (const s of this.slotTargets) {
      s.tabIndex = s === active ? 0 : -1;
    }
  }

  /** Concatenate all slot values in slot order. */
  private assembleToken(slots: HTMLInputElement[]): string {
    return slots.map((s) => s.value).join("");
  }

  /**
   * Sync the hidden mirror with the assembled token. Fires a native `input` event on the mirror so
   * an l:model binding on it picks up the update via the runtime's directive registry.
   */
  private syncMirror(token: string): void {
    const mirror = this.mirror;
    if (!mirror || mirror.value === token) {
      return;
    }
    mirror.value = token;
    mirror.dispatchEvent(new Event("input", { bubbles: true }));
  }

  /**
   * Fire the completion behaviour when all N slots are filled, exactly once per filled state.
   * - Re-arms (clears the latch) as soon as the token drops below N chars.
   * - Fires `lievit:otp-complete` (detail = token) ONLY when `data-otp-complete` is set.
   * - When `data-otp-complete="submit"` also `requestSubmit()`-s the enclosing form.
   */
  private maybeFireComplete(token: string): void {
    const expected = this.length;
    const full = token.length === expected && expected > 0;
    if (!full) {
      this.completed = false;
      return;
    }
    if (this.completed) {
      return;
    }
    this.completed = true;

    const completeMode = this.element.dataset.otpComplete;
    if (!completeMode) {
      return; // no data-otp-complete: plain form POST only, no event.
    }

    this.element.dispatchEvent(
      new CustomEvent("lievit:otp-complete", { bubbles: true, detail: token }),
    );
    if (completeMode === "submit") {
      this.mirror?.closest("form")?.requestSubmit();
    }
  }
}
