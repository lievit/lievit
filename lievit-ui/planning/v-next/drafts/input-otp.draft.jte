@import gg.jte.output.StringOutput
@import gg.jte.html.escape.Escape
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui input-otp wire component -- a fixed-length one-time-password / PIN entry field:
  a horizontal row of N individual digit slots, each a real single-character native input,
  enclosed in a role="group" container. The assembled value is a server fact: the server holds
  the composed token, validates it, and re-renders the group with an error state when invalid.

  TIER: WIRE + ENH. The server owns the assembled token, error state, masked state, and mode.
  The client owns ONLY intra-slot navigation (auto-advance, backspace retreat, paste distribution)
  via the colocated input-otp.enhancer.ts, which fires ONE wire action (complete) when all N
  slots are filled -- never per-keystroke round-trips. Server-first: no state client-side until
  the N-th character is entered.

  STRUCTURE (scientific decision rule): WAI-ARIA APG Spinbutton pattern applied to a group of
  per-slot spinbuttons. Closest APG precedent: "Date Picker Spin Buttons" example
  (https://www.w3.org/WAI/ARIA/apg/patterns/spinbutton/examples/datepicker-spinbuttons/),
  which wraps multiple role="spinbutton" elements in a role="group" with a shared label. OTP
  slots are a BUILT implementation (APG has no dedicated OTP pattern). The enhancer manages
  roving tabindex within the group (only the active slot is tabindex="0"); Tab exits freely
  (non-modal). Each slot input receives DOM focus directly -- NOT aria-activedescendant.
  collection-nav is NOT composed here (OTP focus model differs from listbox/menu).

  A11y (APG Spinbutton + group):
    - root div: role="group" aria-label from groupLabel; aria-describedby on the error region
      when in error state; aria-disabled when disabled.
    - each slot input: role="spinbutton", aria-valuenow (numeric mode only, 0-9),
      aria-valuemin="0" aria-valuemax="9" (numeric only), aria-valuetext (the char or "blank"),
      aria-label per slotLabel template ({n} / {total} substituted server-side), aria-invalid
      when in error state.
    - roving tabindex: slot at index 0 has tabindex="0" on first render (enhancer manages
      subsequent roving); all others have tabindex="-1".
    - error region: role="alert" always present (empty when no error) -- assertive live
      announcement fires automatically when errorMessage changes on a wire round-trip.
    - separators: span[aria-hidden=true] -- decorative, carry no semantic weight.
    - no focus trap; no collection-nav; Tab exits freely (non-modal OTP).

  Slot list (slots): each element is a Map of String to String with keys:
    index       0-based slot position (numeric string)
    position    1-based (for labels)
    slotId      stable HTML id = cid-slot-N
    value       single char or empty string
    inputType   "text" or "password" when masked
    inputmode   "numeric" or "text"
    tabIndex    "0" for the active slot, "-1" for all others
    ariaValueNow  numeric value for spinbutton in numeric mode, or empty
    ariaValueMin  "0" in numeric mode, or empty
    ariaValueMax  "9" in numeric mode, or empty
    ariaValueText  the char value if filled, "blank" if empty
    ariaLabel   the substituted slot label, e.g. "Digit 1 of 6"

  Wire mount attrs: lievitComponent (FQN), lievitId (cid), lievitSnapshot (signed snapshot).

  Params:
    String lievitComponent                 WIRE FQN for data-lievit-component.
    String lievitId                        WIRE cid for data-lievit-id.
    String lievitSnapshot                  signed snapshot for data-lievit-snapshot.
    java.util.List<java.util.Map<String,String>> slots  per-slot data (see Slot list above).
    java.util.List<Integer> separatorAfter positions AFTER which a separator is rendered (0-based slot index).
    String groupLabel                      accessible label for the role="group" container.
    String errorId                         stable id for the error role="alert" region (cid-error).
    String errorMessage                    non-blank = error state; null/blank = no error.
    boolean hasError                       true when errorMessage is non-blank.
    boolean disabled                       all slots inert.
    boolean masked                         slots rendered as type="password".
    String mode                            "numeric" | "alphanumeric" | "any" -- for data-otp-mode.
    int length                             number of slots -- for data-otp-length.
    boolean autoSubmit                     fire complete on N-th char vs. wait for Enter.
    String value                           assembled token (mirrors the @Wire value field).
    String size                            "sm" | "md" | "lg" (default "md").

  Usage:
    Rendered by InputOtpComponent.java via the lievit WIRE template adapter; not called
    directly from a consuming JTE template. The Java component maps its @Wire fields and
    derived view data to these params before rendering.
--%>
@param String lievitComponent
@param String lievitId
@param String lievitSnapshot
@param java.util.List<java.util.Map<String, String>> slots
@param java.util.List<Integer> separatorAfter = java.util.List.of()
@param String groupLabel
@param String errorId
@param String errorMessage = null
@param boolean hasError = false
@param boolean disabled = false
@param boolean masked = false
@param String mode = "numeric"
@param int length = 6
@param boolean autoSubmit = true
@param String value = ""
@param String size = "md"

<%-- Size class variants: data-[size=N] selectors. All complete static strings for Tailwind. --%>
!{var sizeClass = "data-[size=sm]:w-[var(--lv-space-8)] data-[size=sm]:h-[var(--lv-space-8)] data-[size=sm]:text-[length:var(--lv-text-sm)] data-[size=md]:w-[var(--lv-space-9)] data-[size=md]:h-[var(--lv-space-9)] data-[size=md]:text-[length:var(--lv-text-base)] data-[size=lg]:w-[var(--lv-space-10)] data-[size=lg]:h-[var(--lv-space-10)] data-[size=lg]:text-[length:var(--lv-text-lg)]";}

<%-- Border + ring: destructive ring on error, muted border on disabled, default otherwise. --%>
!{var slotBorderClass = hasError
    ? "border-[var(--lv-color-destructive)] focus-visible:shadow-[var(--lv-ring-destructive)]"
    : disabled
        ? "border-[var(--lv-color-muted)]"
        : "border-[var(--lv-color-border)] focus-visible:border-[var(--lv-color-primary)] focus-visible:shadow-[var(--lv-ring)]";}

<%-- aria-describedby: only set when in error state (points to the alert region). --%>
!{var groupDescribedBy = hasError ? errorId : null;}

<%-- SAFE escaped root data-* fragment (mode + length + autosubmit). Build once, emit $unsafe. --%>
!{var rootAttrs_ = new StringOutput();}
!{var escapedMode = new StringOutput();}
!{Escape.htmlAttribute(mode, escapedMode);}
!{rootAttrs_.writeContent(" data-otp-mode=\"" + escapedMode + "\"");}
!{rootAttrs_.writeContent(" data-otp-length=\"" + length + "\"");}
!{rootAttrs_.writeContent(" data-otp-autosubmit=\"" + (autoSubmit ? "true" : "false") + "\"");}
!{var rootAttrsMarkup = rootAttrs_.toString();}

<%-- Component root: standard WIRE mount attributes (ADR-0019). --%>
<div
  data-slot="input-otp"
  data-lievit-component="${lievitComponent}"
  data-lievit-id="${lievitId}"
  data-lievit-snapshot="${lievitSnapshot}"
  data-size="${size}"
  class="inline-flex flex-col gap-[var(--lv-space-1)] font-[var(--lv-font-sans)]"
  $unsafe{rootAttrsMarkup}
>
  <%-- OTP group row: the sequence of slot inputs with optional decorative separators. --%>
  <div
    role="group"
    aria-label="${groupLabel}"
    aria-describedby="${groupDescribedBy}"
    aria-disabled="${disabled ? "true" : null}"
    data-slot="input-otp-group"
    class="inline-flex items-center gap-[var(--lv-space-2)]"
  >
    @for(var slot : slots)
      !{var slotIndex = Integer.parseInt(slot.get("index"));}
      <%-- Separator BEFORE this slot when separatorAfter contains the previous slot index. --%>
      @if(separatorAfter.contains(slotIndex - 1))
        <span
          aria-hidden="true"
          data-slot="input-otp-separator"
          class="text-[var(--lv-color-muted-fg)] px-[var(--lv-space-1)] select-none"
        >&#8211;</span>
      @endif
      <%-- Per-slot spinbutton input. Smart attributes omit null values automatically. --%>
      !{var slotAriaValueNow = slot.get("ariaValueNow");}
      !{var slotAriaValueMin = slot.get("ariaValueMin");}
      !{var slotAriaValueMax = slot.get("ariaValueMax");}
      !{var slotAriaValueNowAttr = (slotAriaValueNow != null && !slotAriaValueNow.isBlank()) ? slotAriaValueNow : null;}
      !{var slotAriaValueMinAttr = (slotAriaValueMin != null && !slotAriaValueMin.isBlank()) ? slotAriaValueMin : null;}
      !{var slotAriaValueMaxAttr = (slotAriaValueMax != null && !slotAriaValueMax.isBlank()) ? slotAriaValueMax : null;}
      <input
        id="${slot.get("slotId")}"
        type="${slot.get("inputType")}"
        inputmode="${slot.get("inputmode")}"
        role="spinbutton"
        maxlength="1"
        autocomplete="${slotIndex == 0 ? "one-time-code" : "off"}"
        value="${slot.get("value")}"
        aria-label="${slot.get("ariaLabel")}"
        aria-valuenow="${slotAriaValueNowAttr}"
        aria-valuemin="${slotAriaValueMinAttr}"
        aria-valuemax="${slotAriaValueMaxAttr}"
        aria-valuetext="${slot.get("ariaValueText")}"
        aria-invalid="${hasError ? "true" : null}"
        aria-required="false"
        disabled="${disabled}"
        tabindex="${slot.get("tabIndex")}"
        data-slot="input-otp-slot"
        data-otp-slot="${slot.get("index")}"
        class="inline-flex shrink-0 items-center justify-center text-center rounded-[var(--lv-radius-md)] border bg-[var(--lv-color-input)] text-[var(--lv-color-fg)] font-[var(--lv-font-mono)] caret-[var(--lv-color-primary)] outline-none transition-[box-shadow,border-color] duration-[var(--lv-duration-fast)] placeholder:text-[var(--lv-color-muted-fg)] disabled:cursor-not-allowed disabled:opacity-[var(--lv-opacity-disabled)] ${sizeClass} ${slotBorderClass}"
      />
    @endfor
  </div>

  <%-- Error region: role="alert" always present; empty when no error. The assertive live
       region announces automatically when errorMessage changes on a wire round-trip.
       (role="alert" implies aria-live="assertive" + aria-atomic="true" per ARIA spec.) --%>
  <div
    id="${errorId}"
    role="alert"
    data-slot="input-otp-error"
    class="text-[length:var(--lv-text-sm)] text-[var(--lv-color-destructive)]"
  >${hasError ? errorMessage : ""}</div>

  <%-- Hidden value mirror: l:model="value" lets the enhancer write the assembled token via
       the model update channel before calling the complete wire action. The runtime drains
       pending l:model updates before firing an action, so the server receives the full token.
       tabindex="-1" + aria-hidden keep it out of the a11y tree and the tab order. --%>
  <input
    type="hidden"
    l:model="value"
    data-otp-value
    tabindex="-1"
    aria-hidden="true"
    value="${value}"
  />
</div>
