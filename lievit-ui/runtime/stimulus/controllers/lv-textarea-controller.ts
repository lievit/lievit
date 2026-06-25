/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * `lv-textarea` -- grow-to-content + live character count for the server-rendered
 * `lievit/textarea.jte` partial, as a Stimulus controller (the conversion of
 * `runtime/features/textarea-autosize.enhancer.ts`). Mounted ON THE `<textarea>` via
 * `data-controller="lv-textarea"` (stamped only when `autosize` OR `showCount` is active -- a bare
 * textarea needs no controller, mirroring the enhancer's old mount condition).
 *
 * The native textarea IS the textbox; this controller touches HEIGHT and the COUNT output only,
 * never the editing model, keyboard, caret, or focus. It is the "irreducible client bit", not a
 * framework: with `autosize=false` and `showCount=false` no `data-controller` is emitted at all.
 *
 * NOT a {@link DismissableController}: a textarea has no overlay and no dismiss, so it fires ZERO
 * wire round-trips -- the controlled/uncontrolled doctrine does not apply (there is nothing to
 * close). It extends plain {@link Controller} and never imports the wire bridge. There is likewise
 * no focus/dismiss logic to collapse into the base (the partial explicitly never steals focus).
 *
 * Wiring (CSP-clean, declared as `data-action` on the textarea in `textarea.jte`, NOT inline
 * handlers): `input->lv-textarea#onInput`, `lievit:morphed->lv-textarea#onMorphed`,
 * `mousedown->lv-textarea#onPointerDown`, `mouseup->lv-textarea#onPointerUp`. Stimulus re-binds
 * every declared `data-action` automatically after the lievit wire morph + idiomorph + Turbo Drive,
 * so there is NO `data-lv-textarea-enhanced` marker and NO `WeakSet` of wired nodes: Stimulus owns
 * connect/disconnect, which is the whole point of the migration. A morph that REPLACES the element
 * reconnects the controller -> {@link connect} recomputes; a morph that PRESERVES it keeps the one
 * live controller.
 *
 * Attribute protocol read off the element (emitted by `textarea.jte`, unchanged from the enhancer):
 *   data-lv-autosize              present => autosize behaviour
 *   data-lv-min-rows="<n>"        autosize floor (rows)
 *   data-lv-max-rows="<n>"        autosize ceiling (0 / absent => unbounded)
 *   data-lv-count-for="<id>"      present => count behaviour; the output is `getElementById(id + "-count")`
 *   maxlength="<n>"               native cap; drives the "n / max" count + over-limit styling
 *   data-lv-user-resized          set when the user drags the resize handle; a morph clears it
 *
 * The controller intercepts NO keystrokes, calls no `preventDefault`, and never moves the caret.
 */

import { Controller } from "@hotwired/stimulus";

const USER_RESIZED_ATTR = "data-lv-user-resized";
const AUTOSIZE_ATTR = "data-lv-autosize";
const MIN_ROWS_ATTR = "data-lv-min-rows";
const MAX_ROWS_ATTR = "data-lv-max-rows";
const COUNT_FOR_ATTR = "data-lv-count-for";

/** CSS class applied to the count output when the value is at or over maxLength. */
const COUNT_OVER_LIMIT_CLASS = "lv-textarea-count--over-limit";

export default class LvTextareaController extends Controller<HTMLTextAreaElement> {
  /** Cached mount conditions (read once on connect; the partial does not toggle them live). */
  private autosize = false;
  private count = false;
  /** Fires the over-limit announcement at most once per crossing; re-armed when dropping below. */
  private announced = false;
  /** The height observed at mousedown, to detect a manual resize-handle drag on mouseup. */
  private heightBeforeMousedown = "";

  connect(): void {
    this.autosize = this.element.hasAttribute(AUTOSIZE_ATTR);
    this.count = this.element.hasAttribute(COUNT_FOR_ATTR);
    // Initial state: fit height + populate count before any user interaction. On a REPLACE-morph
    // Stimulus reconnects here, so this is the free morph-resync for re-rendered elements.
    if (this.autosize) this.resizeToContent();
    if (this.count) this.updateCount();
  }

  /** `input->lv-textarea#onInput`: resize + count on every keystroke (swallows no key). */
  onInput(): void {
    if (this.autosize) this.resizeToContent();
    if (this.count) this.updateCount();
  }

  /**
   * `lievit:morphed->lv-textarea#onMorphed`: resync after a wire round-trip re-rendered the value
   * in place (idiomorph preserves the element). The server may have changed `rows`, so the
   * user-resized guard is cleared first.
   */
  onMorphed(): void {
    this.element.removeAttribute(USER_RESIZED_ATTR);
    if (this.autosize) this.resizeToContent();
    if (this.count) this.updateCount();
  }

  /** `mousedown->lv-textarea#onPointerDown`: snapshot height to detect a manual resize drag. */
  onPointerDown(): void {
    this.heightBeforeMousedown = this.element.style.height;
  }

  /**
   * `mouseup->lv-textarea#onPointerUp`: if the height changed without an input event the user
   * dragged the resize handle -> stop auto-growing (only meaningful when autosize is on).
   */
  onPointerUp(): void {
    if (!this.autosize) return;
    if (
      this.element.style.height !== this.heightBeforeMousedown &&
      this.heightBeforeMousedown !== ""
    ) {
      this.element.setAttribute(USER_RESIZED_ATTR, "");
    }
  }

  // --- autosize ------------------------------------------------------------------------------

  /** Resize the textarea to fit its content, respecting min/max rows; inert once user-resized. */
  private resizeToContent(): void {
    const textarea = this.element;
    if (textarea.hasAttribute(USER_RESIZED_ATTR)) return;
    const style = getComputedStyle(textarea);
    const rowH = rowHeightPx(style);
    const padV = paddingVerticalPx(style);
    const bordV = borderVerticalPx(style);
    const minRows = Math.max(1, parseInt(textarea.getAttribute(MIN_ROWS_ATTR) ?? "1", 10) || 1);
    const maxRows = parseInt(textarea.getAttribute(MAX_ROWS_ATTR) ?? "0", 10) || 0;
    const minH = minRows * rowH + padV + bordV;
    const maxH = maxRows > 0 ? maxRows * rowH + padV + bordV : 0;

    // Temporarily force height to auto to get the natural scroll height.
    const prevHeight = textarea.style.height;
    textarea.style.height = "auto";
    const scrollH = textarea.scrollHeight;
    const finalH = clampHeight(scrollH, minH, maxH);
    textarea.style.height = finalH + "px";

    // When capped at maxHeight, allow internal scroll; otherwise hide it.
    if (maxH > 0 && scrollH > maxH) {
      textarea.style.overflowY = "auto";
    } else {
      textarea.style.overflowY = "hidden";
      // Restore default overflow only when we own height, to avoid fighting the CSS resize-y default.
      if (prevHeight === "" || prevHeight === "auto") {
        textarea.style.overflowY = "";
      }
    }
  }

  // --- count ---------------------------------------------------------------------------------

  /** Update the `<output>` count linked to this textarea (`id + "-count"`). */
  private updateCount(): void {
    const countForId = this.element.getAttribute(COUNT_FOR_ATTR);
    if (!countForId) return;
    const output = document.getElementById(countForId + "-count") as HTMLOutputElement | null;
    if (!output) return;

    const len = this.element.value.length;
    const maxLen = parseInt(this.element.getAttribute("maxlength") ?? "0", 10) || 0;
    output.textContent = maxLen > 0 ? `${len} / ${maxLen}` : `${len}`;

    if (maxLen > 0 && len >= maxLen) {
      output.classList.add(COUNT_OVER_LIMIT_CLASS);
      output.style.color = "var(--lv-color-destructive)";
      this.announceOverLimit();
    } else {
      output.classList.remove(COUNT_OVER_LIMIT_CLASS);
      output.style.color = "";
      // Re-arm the announcer when the user drops below the limit.
      this.announced = false;
    }
  }

  /**
   * Announce the over-limit crossing once via a transient `aria-live="assertive"` region. There is
   * no shared runtime announcer to reach (the wire bridge carries close actions only), so this is
   * self-contained -- and CSP-clean (DOM nodes, no inline handler).
   */
  private announceOverLimit(): void {
    if (this.announced) return;
    this.announced = true;
    const el = document.createElement("div");
    el.setAttribute("aria-live", "assertive");
    el.setAttribute("aria-atomic", "true");
    el.style.cssText =
      "position:absolute;width:1px;height:1px;padding:0;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0;";
    document.body.appendChild(el);
    // Brief timeout so the insertion itself is not the announcement trigger.
    setTimeout(() => {
      el.textContent = "Character limit reached";
      setTimeout(() => el.remove(), 3000);
    }, 50);
  }
}

// --- pure geometry helpers (ported verbatim from the enhancer) --------------------------------

/** Compute one row's pixel height from computed style (line-height, with a font-size fallback). */
function rowHeightPx(style: CSSStyleDeclaration): number {
  const lineHeight = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.5;
  return lineHeight;
}

function paddingVerticalPx(style: CSSStyleDeclaration): number {
  return (parseFloat(style.paddingTop) || 0) + (parseFloat(style.paddingBottom) || 0);
}

function borderVerticalPx(style: CSSStyleDeclaration): number {
  return (parseFloat(style.borderTopWidth) || 0) + (parseFloat(style.borderBottomWidth) || 0);
}

/** Clamp a pixel height to [minHeight, maxHeight] (maxHeight 0 = unbounded). */
function clampHeight(h: number, minH: number, maxH: number): number {
  return Math.max(minH, maxH > 0 ? Math.min(h, maxH) : h);
}
