/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
import { LitElement, html } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { adoptLightStyles } from "../light-dom/light-dom.js";

/** Character set a slot accepts; drives `inputmode` + the accept regexp. */
export type OtpType = "numeric" | "alphanumeric" | "alpha";

const VALIDATION: Record<OtpType, { accept: RegExp; inputMode: string }> = {
  // One char per pattern; used to filter typed/pasted characters per Radix one-time-password-field.
  numeric: { accept: /[0-9]/, inputMode: "numeric" },
  alphanumeric: { accept: /[a-zA-Z0-9]/, inputMode: "text" },
  alpha: { accept: /[a-zA-Z]/, inputMode: "text" },
};

/**
 * `<lv-input-otp>`: a segmented one-time-code input (issue 447).
 *
 * Renders `length` real `<input>` slots inside a `role="group"`, mirroring the WAI model
 * of Radix's one-time-password-field: each slot is `aria-label="Character N of M"`, carries
 * the per-type `inputmode` + `pattern`, and the first slot advertises `autocomplete="one-time-code"`
 * so the platform SMS-autofill fills the whole code at once. Behaviour:
 * - auto-advance: typing a valid char moves focus to the next empty slot;
 * - backspace nav: Backspace clears the current slot, or steps back when already empty;
 * - arrow nav: ArrowLeft/Right move between slots, Home/End jump to the ends;
 * - paste-fill: pasting distributes the (filtered) characters across the slots from the focused one;
 * - filtering: characters outside the type's accept set are rejected.
 *
 * Form-associated (`static formAssociated`): submits the joined `value` under `name` inside a plain
 * `<form method=post>`. It reports the value through ElementInternals (`setFormValue`) where the
 * platform supports it and ALSO mirrors it into a hidden `<input name>` (the portable fallback for
 * environments without ElementInternals, e.g. the happy-dom test runtime), so `new FormData(form)`
 * sees the field either way. `formResetCallback` returns it to its initial value;
 * `formDisabledCallback` follows a disabled fieldset. `value` is the controlled prop.
 *
 * Data down, events up:
 * - `lv-input`: fired on every change, detail = the current (possibly partial) value string;
 * - `lv-complete`: fired once when all slots are filled, detail = the full value string.
 * On every change it also dispatches a native bubbling `input` event (and a native `change` once the
 * code is complete) so the wire's `l:model` binds with zero config.
 *
 * Light-DOM rendered; token-styled; `--lv-ring` focus on the active slot. Dependency-free (only lit).
 */
@customElement("lv-input-otp")
export class LvInputOtp extends LitElement {
  /** Marks the element form-associated so it participates in form submission and reset. */
  static readonly formAssociated = true;

  /** Number of code slots. */
  @property({ type: Number }) length = 6;

  /** Controlled value; truncated to `length`. */
  @property() value = "";

  /** Accepted character set. */
  @property() type: OtpType = "numeric";

  /** Form field name for the mirrored hidden input. */
  @property() name = "";

  /** Mask the characters (renders slots as password fields). */
  @property({ type: Boolean }) mask = false;

  /** Disables every slot. */
  @property({ type: Boolean }) disabled = false;

  /** Marks the field invalid (red ring + aria-invalid). */
  @property({ type: Boolean }) invalid = false;

  /** Accessible label for the slot group. */
  @property() label = "One-time code";

  @state() private activeIndex = 0;

  /** ElementInternals where supported (real browsers); undefined in environments without it. */
  private readonly internals: ElementInternals | null = (() => {
    try {
      return (this as { attachInternals?: () => ElementInternals }).attachInternals?.() ?? null;
    } catch {
      return null;
    }
  })();

  /** The value the control resets to on form reset (captured at first connect). */
  private initialValue = "";

  connectedCallback() {
    super.connectedCallback();
    this.initialValue = this.value;
    this.syncFormValue();
  }

  /** Reports the current value to the form (ElementInternals; the hidden mirror covers the rest). */
  private syncFormValue() {
    this.internals?.setFormValue(this.value);
  }

  /** Reset to the initial value (form-associated lifecycle). */
  formResetCallback() {
    this.value = this.initialValue;
    this.syncFormValue();
    this.requestUpdate();
  }

  /** Follow a disabled ancestor fieldset (form-associated lifecycle). */
  formDisabledCallback(disabled: boolean) {
    this.disabled = disabled;
  }

  createRenderRoot(): this {
    adoptLightStyles("lv-input-otp", LvInputOtp.css);
    return this;
  }

  static readonly css = `
    .lv-otp { display: inline-flex; align-items: center; gap: var(--lv-space-2); }
    .lv-otp__group { display: inline-flex; align-items: center; gap: var(--lv-space-2); }
    .lv-otp__slot {
      width: 2.5rem;
      height: 2.75rem;
      text-align: center;
      font-family: var(--lv-font-mono, var(--lv-font-sans));
      font-size: var(--lv-text-lg, var(--lv-text-base));
      color: var(--lv-color-fg);
      background: var(--lv-color-bg);
      border: 1px solid var(--lv-color-border);
      border-radius: var(--lv-radius-sm);
      box-sizing: border-box;
      caret-color: var(--lv-color-primary);
      transition: border-color 120ms ease, box-shadow 120ms ease;
    }
    .lv-otp__slot:focus-visible,
    .lv-otp__slot--active { outline: none; border-color: var(--lv-color-primary); box-shadow: var(--lv-ring); z-index: 1; }
    .lv-otp__slot--invalid { border-color: var(--lv-color-danger); }
    .lv-otp__slot[disabled] { opacity: 0.5; cursor: not-allowed; }
    .lv-otp__hidden { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); border: 0; }
  `;

  private get accept(): RegExp {
    return (VALIDATION[this.type] ?? VALIDATION.numeric).accept;
  }

  private get chars(): string[] {
    const v = (this.value ?? "").slice(0, this.length);
    return Array.from({ length: this.length }, (_, i) => v[i] ?? "");
  }

  private slotInputs(): HTMLInputElement[] {
    return Array.from(this.querySelectorAll<HTMLInputElement>(".lv-otp__slot"));
  }

  private focusSlot(index: number) {
    const i = Math.max(0, Math.min(this.length - 1, index));
    this.activeIndex = i;
    this.updateComplete.then(() => this.slotInputs()[i]?.focus());
  }

  /** Set the joined value, emit lv-input, and lv-complete when full. */
  private commit(next: string) {
    const clean = Array.from(next)
      .filter((c) => this.accept.test(c))
      .join("")
      .slice(0, this.length);
    this.value = clean;
    this.syncFormValue();
    // Back-compat CustomEvent plus a native `input` so `l:model` (native event listener) binds.
    this.dispatchEvent(
      new CustomEvent("lv-input", { detail: clean, bubbles: true, composed: true })
    );
    this.dispatchEvent(new Event("input", { bubbles: true }));
    if (clean.length === this.length) {
      this.dispatchEvent(
        new CustomEvent("lv-complete", { detail: clean, bubbles: true, composed: true })
      );
      // A native `change` on commit (the code is complete) for `l:model.lazy`/`.change` bindings.
      this.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }

  private onSlotInput(index: number, e: InputEvent) {
    const input = e.target as HTMLInputElement;
    const typed = input.value;
    // Take the last typed char that passes the filter (handles overtype on a filled slot).
    const ch = Array.from(typed)
      .reverse()
      .find((c) => this.accept.test(c));
    const chars = this.chars;
    if (ch) {
      chars[index] = ch;
      this.commit(chars.join(""));
      if (index < this.length - 1) {
        this.focusSlot(index + 1);
      } else {
        this.requestUpdate();
      }
    } else {
      // Rejected character: restore the slot's prior value.
      input.value = chars[index];
    }
  }

  private onSlotKeyDown(index: number, e: KeyboardEvent) {
    const chars = this.chars;
    switch (e.key) {
      case "Backspace":
        e.preventDefault();
        if (chars[index]) {
          chars[index] = "";
          this.commit(chars.join(""));
          this.requestUpdate();
        } else if (index > 0) {
          chars[index - 1] = "";
          this.commit(chars.join(""));
          this.focusSlot(index - 1);
        }
        break;
      case "Delete":
        e.preventDefault();
        if (chars[index]) {
          chars[index] = "";
          this.commit(chars.join(""));
          this.requestUpdate();
        }
        break;
      case "ArrowLeft":
        e.preventDefault();
        this.focusSlot(index - 1);
        break;
      case "ArrowRight":
        e.preventDefault();
        this.focusSlot(index + 1);
        break;
      case "Home":
        e.preventDefault();
        this.focusSlot(0);
        break;
      case "End":
        e.preventDefault();
        this.focusSlot(this.length - 1);
        break;
    }
  }

  private onPaste(index: number, e: ClipboardEvent) {
    e.preventDefault();
    const pasted = e.clipboardData?.getData("text") ?? "";
    const filtered = Array.from(pasted).filter((c) => this.accept.test(c));
    if (filtered.length === 0) return;
    const chars = this.chars;
    let cursor = index;
    for (const c of filtered) {
      if (cursor >= this.length) break;
      chars[cursor] = c;
      cursor++;
    }
    this.commit(chars.join(""));
    this.focusSlot(Math.min(cursor, this.length - 1));
  }

  private onFocus(index: number) {
    this.activeIndex = index;
  }

  render() {
    const chars = this.chars;
    return html`
      <div class="lv-otp">
        <div
          class="lv-otp__group"
          role="group"
          aria-label=${this.label}
          aria-invalid=${this.invalid ? "true" : "false"}
        >
          ${chars.map((c, i) => html`
            <input
              class="lv-otp__slot
                ${i === this.activeIndex ? "lv-otp__slot--active" : ""}
                ${this.invalid ? "lv-otp__slot--invalid" : ""}"
              type=${this.mask ? "password" : "text"}
              inputmode=${(VALIDATION[this.type] ?? VALIDATION.numeric).inputMode}
              autocomplete=${i === 0 ? "one-time-code" : "off"}
              maxlength="1"
              aria-label=${`Character ${i + 1} of ${this.length}`}
              aria-invalid=${this.invalid ? "true" : "false"}
              ?disabled=${this.disabled}
              .value=${c}
              @input=${(e: InputEvent) => this.onSlotInput(i, e)}
              @keydown=${(e: KeyboardEvent) => this.onSlotKeyDown(i, e)}
              @paste=${(e: ClipboardEvent) => this.onPaste(i, e)}
              @focus=${() => this.onFocus(i)}
            />
          `)}
        </div>
        ${this.internals
          ? null
          : html`<input
              class="lv-otp__hidden"
              type="hidden"
              name=${this.name || ""}
              .value=${this.value}
              tabindex="-1"
              aria-hidden="true"
            />`}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "lv-input-otp": LvInputOtp;
  }
}
