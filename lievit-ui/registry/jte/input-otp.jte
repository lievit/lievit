<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui input-otp partial -- a segmented one-time-code input rendered SERVER-SIDE (ADR-0012).
  N native single-character <input>s + a hidden `name` mirror; the small auto-advance / paste /
  backspace-nav behaviour is a CSP-clean typed-TS enhancer (input-otp.enhancer.ts), NOT inline
  script. Pairs with registry/jte/input-otp.enhancer.ts.

  TIER: PARTIAL (+ enhancer). The OTP value is NOT server state mid-entry: there is nothing for the
  server to decide between keystrokes, so round-tripping each keystroke over the wire would be pure
  chat for no gain. The slots are server-rendered native inputs; the value is form-submitted (the
  server binds it at POST via the hidden mirror under `name`), so it is server-bound at the moment
  that matters. The only client bit is the focus choreography (auto-advance, paste-fill, backspace
  step-back), which is a tiny typed-TS module the strict CSP accepts (no inline on* handlers).

  STRUCTURE (scientific decision rule): WAI one-time-password-field (Radix), the model the dropped
  Lit island cited: a role="group" of real <input> slots, each aria-label="Character N of M", the
  per-type inputmode, autocomplete="one-time-code" on the first slot so the platform SMS-autofill
  fills the whole code, and a visually-hidden mirror <input name> so `new FormData(form)` sees the
  joined value with zero JS. Native inputs beat a custom widget: the platform owns focus, IME, paste
  and autofill; the enhancer only nudges focus between slots.

  SEPARATOR + GROUPS: `groupSize` splits the slots into explicit visual groups (shadcn's
  InputOTPGroup), with an InputOTPSeparator (a Lucide dash) rendered between groups. `groupSize=3`
  on a length-6 code gives `***-***`. The separator is decorative (aria-hidden); the slots stay one
  continuous keyboard + value sequence (the enhancer indexes by data-otp-slot, not by group).

  onComplete: when set, the enhancer fires a `lievit:otp-complete` CustomEvent (detail = the joined
  value) on the root once every slot is filled, and -- if `onComplete="submit"` -- submits the
  enclosing <form>. Wire it to a wire action via the data-otp-complete attribute (the consuming
  wire template reads it), or listen for the event. Server-first: still no per-keystroke round-trip.

  A11y (WAI one-time-password-field): div[role=group][aria-label] wrapping N inputs each
  aria-label="Character N of M"; aria-invalid mirrored on the group + slots. Separators are
  aria-hidden decorations between visual groups.

  Params:
    name      String   submit field name; the joined value POSTs under it via the hidden mirror
    length    int       number of code slots (default 6)
    value     String   prefilled value (default empty); chars distributed across the slots
    type      String   "numeric" | "alphanumeric" | "alpha" (default "numeric"); drives inputmode + pattern
    mask      boolean   render slots as password fields (default false)
    disabled  boolean   disable every slot (default false)
    invalid   boolean   error ring + aria-invalid (default false)
    groupSize int       split slots into groups of this size with a separator between (0 = no grouping)
    onComplete String   "submit" submits the form when filled; any non-blank value enables the complete event
    label     String   accessible label for the slot group (default "One-time code")

  Usage:
    @template.lievit.input-otp(name = "otp", length = 6, type = "numeric")
    @template.lievit.input-otp(name = "otp", length = 6, groupSize = 3, onComplete = "submit")
    import the enhancer once from your entry module: import "./lievit/input-otp.enhancer";
--%>
@param String name
@param int length = 6
@param String value = ""
@param String type = "numeric"
@param boolean mask = false
@param boolean disabled = false
@param boolean invalid = false
@param int groupSize = 0
@param String onComplete = null
@param String label = "One-time code"
!{var inputMode = type.equals("numeric") ? "numeric" : "text";}
!{var pattern = type.equals("numeric") ? "[0-9]*" : (type.equals("alpha") ? "[a-zA-Z]*" : "[a-zA-Z0-9]*");}
!{var slotType = mask ? "password" : "text";}
!{var grouped = groupSize > 0;}
!{var hasComplete = onComplete != null && !onComplete.isBlank();}
<div data-lievit-otp data-otp-type="${type}" data-otp-length="${length}" data-otp-complete="${hasComplete ? onComplete : null}" style="display: inline-flex; align-items: center; gap: var(--lv-space-2); font-family: var(--lv-font-sans);">
    <div
        role="group"
        aria-label="${label}"
        aria-invalid="${invalid ? "true" : "false"}"
        data-otp-group
        style="display: inline-flex; align-items: center; gap: var(--lv-space-2);"
    >
        @for(int i = 0; i < length; i++)
            @if(grouped && i > 0 && i % groupSize == 0)
                <span data-otp-separator aria-hidden="true" style="display: inline-flex; align-items: center; color: var(--lv-color-muted-fg);">
                    @template.lievit.icon(name = "minus", size = "1rem")
                </span>
            @endif
            !{var ch = i < value.length() ? String.valueOf(value.charAt(i)) : "";}
            <input
                type="${slotType}"
                inputmode="${inputMode}"
                pattern="${pattern}"
                autocomplete="${i == 0 ? "one-time-code" : "off"}"
                maxlength="1"
                aria-label="Character ${i + 1} of ${length}"
                aria-invalid="${invalid ? "true" : "false"}"
                disabled="${disabled}"
                value="${ch}"
                data-otp-slot="${i}"
                style="width: 2.5rem; height: 2.75rem; text-align: center; font-family: var(--lv-font-mono, var(--lv-font-sans)); font-size: var(--lv-text-lg, var(--lv-text-base)); color: var(--lv-color-fg); background: var(--lv-color-bg); border: 1px solid ${invalid ? "var(--lv-color-danger)" : "var(--lv-color-border)"}; border-radius: var(--lv-radius-sm); box-sizing: border-box; caret-color: var(--lv-color-primary);"
            />
        @endfor
    </div>
    <input
        type="hidden"
        name="${name}"
        value="${value}"
        data-otp-mirror
        tabindex="-1"
        aria-hidden="true"
    />
</div>
