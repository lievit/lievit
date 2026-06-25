/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * textarea-autosize enhancer (v-next, spec §6): the CSP-clean typed-TS that gives the
 * server-rendered `lievit/textarea.jte` partial its grow-to-content and live character count.
 *
 * The native textarea IS the textbox; this enhancer touches height and count ONLY, never the
 * editing model, keyboard, or focus. It is the exemplar of "an enhancer is the irreducible
 * client bit, not a framework" (architecture contract §1).
 *
 * Mount condition: `data-lv-autosize` attribute on a `<textarea>` (autosize behaviour) and/or
 * `data-lv-count-for="<id>"` on a `<textarea>` (count behaviour). Both are independent: a
 * textarea may have count without autosize or vice versa.
 *
 * Attribute protocol on the textarea element (emitted by `textarea.jte`):
 *   data-lv-autosize              present when autosize=true
 *   data-lv-min-rows="<n>"        autosize floor (rows count)
 *   data-lv-max-rows="<n>"        autosize ceiling (0 / absent = unbounded)
 *   data-lv-count-for="<id>"      id of the textarea; the enhancer locates the count output
 *                                  via document.getElementById(id + "-count")
 *   data-lv-textarea-enhanced     idempotency guard; set after first enhancement
 *   data-lv-user-resized          set when the user manually drags the resize handle;
 *                                 the morph clears this (when the server re-renders with a
 *                                 different rows, the morph resets the attribute)
 *
 * Idempotent: `enhanceTextareaAutosize` marks each enhanced element with
 * `data-lv-textarea-enhanced`. `enhanceAllTextareaAutosize(scope)` is safe to call after
 * every morph (it skips already-enhanced elements). This is the same contract as
 * `input-otp.enhancer.ts`.
 *
 * CSP-clean: no eval, no inline handlers, no dynamic <script>. All listeners attached in code.
 *
 * The enhancer fires NO wire action. It does NOT intercept, swallow, or preventDefault any
 * keystrokes. It does NOT move the caret or steal focus.
 */

const ENHANCED_ATTR = "data-lv-textarea-enhanced";
const USER_RESIZED_ATTR = "data-lv-user-resized";
const AUTOSIZE_ATTR = "data-lv-autosize";
const MIN_ROWS_ATTR = "data-lv-min-rows";
const MAX_ROWS_ATTR = "data-lv-max-rows";
const COUNT_FOR_ATTR = "data-lv-count-for";

/** CSS class applied to the count output when the value is at or over maxLength. */
const COUNT_OVER_LIMIT_CLASS = "lv-textarea-count--over-limit";

/**
 * Announce a message via the lievit shared announcer if available, or fall back to a temporary
 * aria-live region. Fires at most once per over-limit crossing (idempotent guard on the WeakSet).
 */
const announced = new WeakSet<HTMLTextAreaElement>();

function announceOverLimit(textarea: HTMLTextAreaElement): void {
  if (announced.has(textarea)) return;
  announced.add(textarea);
  // Use the shared lievit announcer when present; fall back to a transient live region.
  const runtime = (window as { $lievit?: { announce?: (msg: string, politeness?: string) => void } }).$lievit;
  if (runtime?.announce) {
    runtime.announce("Character limit reached", "assertive");
    return;
  }
  // Fallback: a transient aria-live="assertive" element.
  const el = document.createElement("div");
  el.setAttribute("aria-live", "assertive");
  el.setAttribute("aria-atomic", "true");
  el.style.cssText = "position:absolute;width:1px;height:1px;padding:0;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0;";
  document.body.appendChild(el);
  // Brief timeout so the insertion itself is not the announcement trigger.
  setTimeout(() => {
    el.textContent = "Character limit reached";
    setTimeout(() => el.remove(), 3000);
  }, 50);
}

/** Compute one row's pixel height from computed style (line-height + padding). */
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

/** Clamp a pixel height to [minHeight, maxHeight]. */
function clampHeight(h: number, minH: number, maxH: number): number {
  return Math.max(minH, maxH > 0 ? Math.min(h, maxH) : h);
}

/** Resize the textarea to fit its content, respecting min/max rows. */
function resizeToContent(textarea: HTMLTextAreaElement): void {
  if (!textarea.hasAttribute(AUTOSIZE_ATTR)) return;
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
    // Restore explicit overflow-y only when we manage it; avoids fighting with
    // the CSS resize-y default.
    if (prevHeight === "" || prevHeight === "auto") {
      textarea.style.overflowY = "";
    }
  }
}

/** Update the count output linked to this textarea. */
function updateCount(textarea: HTMLTextAreaElement): void {
  const countForId = textarea.getAttribute(COUNT_FOR_ATTR);
  if (!countForId) return;
  const output = document.getElementById(countForId + "-count") as HTMLOutputElement | null;
  if (!output) return;

  const len = textarea.value.length;
  const maxLen = parseInt(textarea.getAttribute("maxlength") ?? "0", 10) || 0;
  output.textContent = maxLen > 0 ? `${len} / ${maxLen}` : `${len}`;

  if (maxLen > 0 && len >= maxLen) {
    output.classList.add(COUNT_OVER_LIMIT_CLASS);
    output.style.color = "var(--lv-color-destructive)";
    announceOverLimit(textarea);
  } else {
    output.classList.remove(COUNT_OVER_LIMIT_CLASS);
    output.style.color = "";
    // Re-arm the announcer when the user drops below the limit.
    announced.delete(textarea);
  }
}

/**
 * Enhance a single textarea element. No-op if it has no autosize/count attributes or is
 * already enhanced.
 */
export function enhanceTextareaAutosize(textarea: HTMLTextAreaElement): void {
  if (textarea.hasAttribute(ENHANCED_ATTR)) return;
  // Migration guard (Stimulus conversion): a textarea converted to the `lv-textarea` Stimulus
  // controller owns its own grow-to-content + count. This enhancer must NOT also wire it, or the
  // height + count would be computed twice. Converted templates carry data-controller="lv-textarea".
  if (textarea.matches('[data-controller~="lv-textarea"]')) {
    textarea.setAttribute(ENHANCED_ATTR, "");
    return;
  }
  const hasAutosize = textarea.hasAttribute(AUTOSIZE_ATTR);
  const hasCount = textarea.hasAttribute(COUNT_FOR_ATTR);
  if (!hasAutosize && !hasCount) return;

  textarea.setAttribute(ENHANCED_ATTR, "");

  // Initial state: fit height + populate count before any user interaction.
  if (hasAutosize) resizeToContent(textarea);
  if (hasCount) updateCount(textarea);

  // Input event: resize + count on every keystroke.
  textarea.addEventListener("input", () => {
    if (hasAutosize) resizeToContent(textarea);
    if (hasCount) updateCount(textarea);
  });

  // Morph resync: a lievit:morphed event fires after a wire round-trip re-renders the value.
  // Element identity is preserved by the morph, so the enhancer is NOT unmounted.
  textarea.addEventListener("lievit:morphed", () => {
    // After morph, the server may have changed `rows`; reset user-resized guard.
    textarea.removeAttribute(USER_RESIZED_ATTR);
    if (hasAutosize) resizeToContent(textarea);
    if (hasCount) updateCount(textarea);
  });

  // User-drag detection: if the user manually drags the resize handle, stop auto-growing.
  // We detect a drag by observing a mouseup after the height changed without an input event.
  if (hasAutosize) {
    let heightBeforeMousedown = "";
    textarea.addEventListener("mousedown", () => {
      heightBeforeMousedown = textarea.style.height;
    });
    textarea.addEventListener("mouseup", () => {
      if (textarea.style.height !== heightBeforeMousedown && heightBeforeMousedown !== "") {
        textarea.setAttribute(USER_RESIZED_ATTR, "");
      }
    });
  }
}

/**
 * Enhance every textarea in `scope` that carries the autosize or count attributes.
 * Safe to call after every morph (already-enhanced elements are skipped via the
 * `data-lv-textarea-enhanced` guard).
 */
export function enhanceAllTextareaAutosize(scope: Element | Document = document): void {
  // Query both activation conditions in one pass.
  const candidates = scope.querySelectorAll<HTMLTextAreaElement>(
    `textarea[${AUTOSIZE_ATTR}], textarea[${COUNT_FOR_ATTR}]`,
  );
  candidates.forEach(enhanceTextareaAutosize);
}

/**
 * Install the textarea-autosize enhancer on a LievitRuntime. Registers an `onComponentInit`
 * hook (initial scan of each component root) and an `afterCall` hook (re-scan after morph)
 * so newly-rendered textareas are enhanced without a full document scan.
 *
 * Called in the app's main.ts (or via installAllFeatures once the coordinator wires it in
 * index.ts). The coordinator must also add this to installAllFeatures.
 *
 * @param runtime the started runtime to extend
 * @returns an unsubscribe function
 */
export function installTextareaAutosize(
  runtime: import("../runtime.js").LievitRuntime,
): () => void {
  // Enhance any textarea already in the document at install time.
  enhanceAllTextareaAutosize(document.body);
  return runtime.use({
    onComponentInit(ctx) {
      enhanceAllTextareaAutosize(ctx.root);
    },
    afterCall(outcome) {
      // Re-scan the component root after a morph; the idempotency guard skips
      // already-enhanced elements, so this is safe to call on every round-trip.
      enhanceAllTextareaAutosize(outcome.root);
    },
  });
}
