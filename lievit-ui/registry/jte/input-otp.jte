@import gg.jte.output.StringOutput
@import gg.jte.html.escape.Escape
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui input-otp partial -- a fixed-length one-time-password / PIN entry field:
  a horizontal row of N individual digit slots (each a real single-character input) enclosed in
  a role="group" container. The assembled value lives in a hidden mirror input (name="...") so
  the code POSTs with a plain HTML form, zero round-trips mid-entry. The one irreducible client
  behaviour (auto-advance, paste-fill, backspace-retreat, roving tabindex) lives in the colocated
  input-otp.enhancer.ts; the server renders the truth every time.

  TIER: PARTIAL (+ enhancer). The OTP value is NOT server state mid-entry: there is nothing for
  the server to decide between keystrokes, so no wire round-trip per character. The hidden mirror
  submits the joined value with the enclosing form (zero JS at POST time). The enhancer runs only
  for the focus choreography and optional completion callback.

  STRUCTURE (scientific decision rule): WAI-ARIA APG Spinbutton pattern applied to a group of
  per-slot spinbuttons, following the "Date Picker Spin Buttons" example
  (https://www.w3.org/WAI/ARIA/apg/patterns/spinbutton/examples/datepicker-spinbuttons/) as the
  canonical model for multiple role="spinbutton" elements in a role="group". APG has no dedicated
  OTP pattern so this is a BUILT implementation. The enhancer owns roving tabindex (only the active
  slot is tabindex="0"); Tab exits freely (non-modal). Each slot receives real DOM focus -- NOT
  aria-activedescendant. collection-nav is NOT composed (OTP focus model differs from listbox/menu).

  A11y (APG Spinbutton + group):
    - group container: role="group" aria-label from groupLabel; aria-describedby points to the
      error region when errorMessage is set; aria-disabled when disabled.
    - each slot input: role="spinbutton", aria-valuenow (numeric mode, the digit or omitted when
      empty), aria-valuemin="0" aria-valuemax="9" (numeric only), aria-valuetext (the char or
      "blank"), aria-label per slotLabel template ({n}/{total} substituted), aria-invalid when error.
    - roving tabindex: slot 0 has tabindex="0" on first render (enhancer manages subsequent roving).
    - error region: role="alert" id=errorId, always present (empty when no error) so screen readers
      track it; the assertive live region announces automatically when errorMessage is set.
    - separators: span[aria-hidden=true] between slots -- decorative, no semantic weight.
    - autocomplete="one-time-code" on slot 0 enables platform SMS autofill.
    - mask toggle (optional): button[type=button] with aria-label toggled by masked state.
    - no focus trap; no collection-nav; Tab exits freely.

  Slot list param (slots): each element is a Map of String to String with keys:
    index          0-based slot position (numeric string)
    position       1-based (for aria-label substitution)
    slotId         stable HTML id: "{name}-slot-{index}" (or caller-supplied id prefix)
    value          single char or empty string (pre-filled from the value param)
    inputType      "text" or "password" when masked
    inputmode      "numeric" (mode=numeric) or "text" (mode=alphanumeric/any)
    tabIndex       "0" for slot 0, "-1" for all others (enhancer takes over after mount)
    ariaValueNow   numeric value 0-9 in numeric mode when filled, else empty
    ariaValueMin   "0" in numeric mode, else empty
    ariaValueMax   "9" in numeric mode, else empty
    ariaValueText  the char value if filled, "blank" if empty
    ariaLabel      substituted slot label e.g. "Digit 1 of 6"

  Params:
    String name                       submit field name; the joined value POSTs under it via mirror.
    java.util.List<java.util.Map<String,String>> slots  per-slot data (see Slot list above).
    java.util.List<Integer> separatorAfter  0-based slot indices AFTER which a separator is shown.
    String groupLabel                 accessible label for the role="group" container; REQUIRED.
    String errorId                    stable id for the role="alert" error region.
    String errorMessage               non-blank = error state; null/blank = no error.
    boolean hasError                  true when errorMessage is non-blank.
    boolean disabled                  all slots inert.
    boolean masked                    slots rendered as type="password".
    String mode                       "numeric" | "alphanumeric" | "any" -- drives data-otp-mode.
    int length                        number of slots -- drives data-otp-length.
    boolean autoSubmit                fire completeAction on N-th char (true) vs wait for Enter.
    String value                      pre-filled assembled value (distributed across slots).
    String size                       "sm" | "md" | "lg" (default "md").
    String completeAction             optional: "submit" submits the enclosing form; any non-blank
                                      value fires a lievit:otp-complete CustomEvent on the root.
    boolean showMaskToggle            when true, renders a mask toggle button after the group.

  Usage:
    The slots list is typically built server-side from the length + value + mode + masked params.
    See the companion InputOtpModel helper or build manually.
    @@template.lievit.input-otp(name = "otp", slots = slots, groupLabel = "One-time code",
        errorId = "otp-error", length = 6, mode = "numeric")
    @@template.lievit.input-otp(name = "pin", slots = slots, groupLabel = "PIN",
        errorId = "pin-error", length = 4, size = "lg", completeAction = "submit")
    Import the enhancer once from your entry module:
    import { enhanceAllInputOtp } from "lievit/input-otp.enhancer";
--%>
@param String name
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
@param String completeAction = null
@param boolean showMaskToggle = false

<%-- Slot dimension class: data-[size=N] attr selectors drive width + height + font.
     All strings are COMPLETE and static so Tailwind's scanner picks them up. --%>
!{var slotDimClass = "data-[size=sm]:w-[var(--lv-space-8)] data-[size=sm]:h-[var(--lv-space-8)] data-[size=sm]:text-[length:var(--lv-text-sm)] data-[size=md]:w-[var(--lv-space-9)] data-[size=md]:h-[var(--lv-space-9)] data-[size=md]:text-[length:var(--lv-text-base)] data-[size=lg]:w-[var(--lv-space-10)] data-[size=lg]:h-[var(--lv-space-10)] data-[size=lg]:text-[length:var(--lv-text-lg)]";}

<%-- Slot border + ring: destructive ring on error, muted border on disabled, default otherwise.
     focus-visible uses the standard --lv-ring token (all interactive controls share it). --%>
!{var slotBorderClass = hasError
    ? "border-[var(--lv-color-destructive)] focus-visible:shadow-[var(--lv-ring-destructive)]"
    : disabled
        ? "border-[var(--lv-color-muted)]"
        : "border-[var(--lv-color-border)] focus-visible:border-[var(--lv-color-primary)] focus-visible:shadow-[var(--lv-ring)]";}

<%-- aria-describedby: only point to the error region when in error state. Smart attr: null omits. --%>
!{var groupDescribedBy = hasError ? errorId : null;}

<%-- SAFE-escaped root data-* fragment. Builds one string, emits $unsafe (safe: all values escaped).
     JTE forbids @for in an attribute NAME position, so we pre-build the fragment in a !{} block.
     data-otp-mode value is user-typed but locked (only 3 values); still escape for belt-and-braces. --%>
!{var rootDataAttrs_ = new StringOutput();}
!{var escapedMode_ = new StringOutput();}
!{Escape.htmlAttribute(mode, escapedMode_);}
!{rootDataAttrs_.writeContent(" data-otp-mode=\"" + escapedMode_ + "\"");}
!{rootDataAttrs_.writeContent(" data-otp-length=\"" + length + "\"");}
!{rootDataAttrs_.writeContent(" data-otp-autosubmit=\"" + (autoSubmit ? "true" : "false") + "\"");}
!{var hasCompleteAction = completeAction != null && !completeAction.isBlank();}
!{if (hasCompleteAction) {
    var escapedComplete_ = new StringOutput();
    Escape.htmlAttribute(completeAction, escapedComplete_);
    rootDataAttrs_.writeContent(" data-otp-complete=\"" + escapedComplete_ + "\"");
  }}
!{var rootDataAttrsMarkup = rootDataAttrs_.toString();}

<%-- Component root: data-slot + data-size for test selectors and styling hooks. --%>
<div
  data-slot="input-otp"
  data-size="${size}"
  class="inline-flex flex-col gap-[var(--lv-space-1)] font-[var(--lv-font-sans)]"
  $unsafe{rootDataAttrsMarkup}
>
  <%-- OTP group row: role="group" + the sequence of slot inputs with optional separators.
       aria-disabled is a smart attribute: emits the attribute when disabled, omitted when false.
       (Native disabled on each <input> removes slots from the tab order; the group aria-disabled
       informs AT of the group-level semantics without overriding the native per-slot attribute.) --%>
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
      <%-- Decorative separator BEFORE this slot when separatorAfter contains the previous index.
           aria-hidden: separators are purely visual; the slot labels carry positional meaning. --%>
      @if(separatorAfter.contains(slotIndex - 1))
        <span
          aria-hidden="true"
          data-slot="input-otp-separator"
          class="text-[var(--lv-color-muted-fg)] select-none px-[var(--lv-space-1)]"
        >&#8211;</span>
      @endif

      <%-- Per-slot spinbutton input.
           Smart attributes: JTE omits the attribute when the value is null (the canonical way to
           conditionally emit an attribute -- never split an element across @if/@else for this).
           aria-valuenow / aria-valuemin / aria-valuemax: non-blank in numeric mode only.
           disabled: boolean smart attr emits the bare attribute when true, omits when false.
           tabindex: string from the slot map ("0" for slot 0, "-1" for all others). --%>
      !{var ariaValueNow_ = slot.get("ariaValueNow");}
      !{var ariaValueMin_ = slot.get("ariaValueMin");}
      !{var ariaValueMax_ = slot.get("ariaValueMax");}
      !{var ariaValueNowAttr = (ariaValueNow_ != null && !ariaValueNow_.isBlank()) ? ariaValueNow_ : null;}
      !{var ariaValueMinAttr = (ariaValueMin_ != null && !ariaValueMin_.isBlank()) ? ariaValueMin_ : null;}
      !{var ariaValueMaxAttr = (ariaValueMax_ != null && !ariaValueMax_.isBlank()) ? ariaValueMax_ : null;}
      <input
        id="${slot.get("slotId")}"
        type="${slot.get("inputType")}"
        inputmode="${slot.get("inputmode")}"
        role="spinbutton"
        maxlength="1"
        autocomplete="${slotIndex == 0 ? "one-time-code" : "off"}"
        value="${slot.get("value")}"
        aria-label="${slot.get("ariaLabel")}"
        aria-valuenow="${ariaValueNowAttr}"
        aria-valuemin="${ariaValueMinAttr}"
        aria-valuemax="${ariaValueMaxAttr}"
        aria-valuetext="${slot.get("ariaValueText")}"
        aria-invalid="${hasError ? "true" : null}"
        aria-required="false"
        disabled="${disabled}"
        tabindex="${slot.get("tabIndex")}"
        data-slot="input-otp-slot"
        data-otp-slot="${slot.get("index")}"
        class="inline-flex shrink-0 items-center justify-center text-center rounded-[var(--lv-radius-md)] border bg-[var(--lv-color-input)] text-[var(--lv-color-fg)] font-[var(--lv-font-mono)] caret-[var(--lv-color-primary)] outline-none transition-[box-shadow,border-color] duration-[var(--lv-duration-fast)] placeholder:text-[var(--lv-color-muted-fg)] disabled:cursor-not-allowed disabled:opacity-[var(--lv-opacity-disabled)] ${slotDimClass} ${slotBorderClass}"
      />
    @endfor
  </div>

  <%-- Mask toggle button (optional): only rendered when showMaskToggle=true.
       Icon-only button: aria-label is mandatory (no visible text); toggled by masked state.
       type="button" prevents form submission. The masked state is driven by the caller -- the
       caller re-renders the template (e.g. via htmx swap or a server round-trip) with the new
       masked value, not by the enhancer (the enhancer never manages input type). --%>
  @if(showMaskToggle)
    <button
      type="button"
      aria-label="${masked ? "Show code" : "Hide code"}"
      data-slot="input-otp-mask-toggle"
      data-otp-mask-toggle
      class="inline-flex items-center justify-center rounded-[var(--lv-radius-md)] text-[var(--lv-color-muted-fg)] hover:text-[var(--lv-color-fg)] focus-visible:outline-none focus-visible:shadow-[var(--lv-ring)] transition-[color] duration-[var(--lv-duration-fast)] disabled:cursor-not-allowed disabled:opacity-[var(--lv-opacity-disabled)]"
    >
      <%-- Eye / eye-off icon: inlined SVG (self-contained, no sub-partial dependency). --%>
      @if(masked)
        <%-- "Show" icon: eye --%>
        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/>
          <circle cx="12" cy="12" r="3"/>
        </svg>
      @else
        <%-- "Hide" icon: eye-off --%>
        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
          <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
          <line x1="1" y1="1" x2="23" y2="23"/>
        </svg>
      @endif
    </button>
  @endif

  <%-- Error region: role="alert" always present (empty when no error).
       role="alert" implies aria-live="assertive" + aria-atomic="true" per ARIA spec.
       The node must pre-exist in the DOM so AT tracks it from page load; populating it
       dynamically (via a server swap) fires the assertive announcement without navigation. --%>
  <div
    id="${errorId}"
    role="alert"
    data-slot="input-otp-error"
    class="text-[length:var(--lv-text-sm)] text-[var(--lv-color-destructive)] empty:hidden"
  >${hasError ? errorMessage : ""}</div>

  <%-- Hidden value mirror: submits the assembled value with the enclosing form under `name`.
       The enhancer keeps this in sync on every keystroke / paste so FormData sees the joined
       value at submit time. aria-hidden + tabindex="-1" keep it out of the a11y tree + tab order. --%>
  <input
    type="hidden"
    name="${name}"
    value="${value}"
    data-otp-mirror
    tabindex="-1"
    aria-hidden="true"
  />
</div>
