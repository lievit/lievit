@import gg.jte.Content
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui input-number partial -- a numeric stepper input (Ant Design InputNumber parity).

  TIER: PARTIAL + client controller. The VALUE is a native <input> (server-rendered, form-submitted,
  l:model-bindable); the +/- affordances, bound clamping, ArrowUp/Down stepping, and at-bounds
  button disabling are added by the `lv-input-number` Stimulus controller. Progressive enhancement:
  with JS off the input is still editable + submittable; the controller only enriches it. CSP-clean
  (behaviour in the controller module, not inline; data-action/data-*-value are plain strings).

  STRUCTURE (scientific decision rule):
    Ant's InputNumber is a text input flanked by step controls with min/max/step/precision. The
    native <input inputmode="numeric"> carries the value (so mobile shows the numeric keypad and
    the field submits with no JS); the controller adds the stepper UX. min/max are OPTIONAL -- when
    a bound is omitted the side is unbounded (the controller reads hasMinValue/hasMaxValue, no
    sentinel). The stepper buttons reuse the lievit icon primitive (minus / plus). The control
    height follows the form-control scale (sm|md|lg) for toolbar alignment.
    Inventory reference: Ant Design InputNumber. Original generation over --lv-* tokens; no Ant code copied.

  A11y: a real <input> with type=text + inputmode=numeric (a free numeric field; type=number is
    avoided because its spinner duplicates ours and its locale handling is inconsistent). The step
    buttons are real <button type=button> with aria-label (minus/plus) and aria-hidden glyphs; they
    are disabled at the bounds. aria-valuenow is unnecessary (the input's own value is the AT truth).

  Params:
    String name                         the submitted field name.
    String value     = null             the initial value (server-rendered).
    Double min       = null             optional lower bound (null = unbounded below).
    Double max       = null             optional upper bound (null = unbounded above).
    double step      = 1                 step size for the buttons + arrow keys.
    Integer precision= null             decimal places to round to (null = no rounding).
    String size      = "md"             sm|md|lg (control height).
    boolean disabled = false            disable the whole control.
    String placeholder = null           input placeholder.
    String ariaLabel = null             accessible name when there is no associated <label>.
    String cssClass  = ""               extra utility classes on the wrapper.
    String attrs     = ""               TRUSTED raw ($unsafe) -- STATIC author-typed strings only
                                        (e.g. a lievit l:model directive on the input via inputAttrs).
    String inputAttrs = ""              TRUSTED raw ($unsafe) placed on the <input> (l:model, etc).

  Usage:
    @@template.lievit.input-number(name = "qty", value = "1", min = 0.0, max = 99.0)
    @@template.lievit.input-number(name = "price", value = "9.90", step = 0.10, precision = 2)
--%>
@param String name
@param String value = null
@param Double min = null
@param Double max = null
@param double step = 1
@param Integer precision = null
@param String size = "md"
@param boolean disabled = false
@param String placeholder = null
@param String ariaLabel = null
@param String cssClass = ""
@param String attrs = ""
@param String inputAttrs = ""

!{var heightClass = switch (size) {
    case "sm" -> "h-[var(--lv-space-8)] text-[length:var(--lv-text-xs)]";
    case "lg" -> "h-[var(--lv-space-10)] text-[length:var(--lv-text-base)]";
    default   -> "h-[var(--lv-space-9)] text-[length:var(--lv-text-sm)]";
  };}
!{var btnClass = "inline-flex aspect-square h-full flex-none items-center justify-center text-[var(--lv-color-muted-fg)] transition-colors hover:bg-[var(--lv-color-muted)] hover:text-[var(--lv-color-fg)] focus-visible:outline-none focus-visible:shadow-[var(--lv-ring)] disabled:cursor-not-allowed disabled:opacity-50";}

<div
  data-slot="input-number"
  data-controller="lv-input-number"
  data-lv-input-number-step-value="${step}"
  data-lv-input-number-min-value="${min == null ? null : min.toString()}"
  data-lv-input-number-max-value="${max == null ? null : max.toString()}"
  data-lv-input-number-precision-value="${precision == null ? null : precision.toString()}"
  data-size="${size}"
  data-disabled="${disabled ? "true" : null}"
  class="inline-flex items-stretch overflow-hidden rounded-[var(--lv-radius-md)] border border-[var(--lv-color-input)] bg-[var(--lv-color-bg)] focus-within:border-[var(--lv-color-ring)] focus-within:shadow-[var(--lv-ring)] ${heightClass} ${cssClass}"
  style="font-family:var(--lv-font-sans);"
  $unsafe{attrs}
>
  <button
    type="button"
    data-slot="input-number-decrement"
    data-lv-input-number-target="decrement"
    data-action="click->lv-input-number#decrement"
    aria-label="Decrease"
    disabled="${disabled}"
    class="${btnClass}"
  >
    <span aria-hidden="true">@template.lievit.icon(name = "minus", size = "1rem")</span>
  </button>
  <input
    type="text"
    inputmode="numeric"
    data-slot="input-number-control"
    data-lv-input-number-target="input"
    data-action="input->lv-input-number#onInput keydown->lv-input-number#onKeydown"
    name="${name}"
    value="${value}"
    placeholder="${placeholder}"
    aria-label="${ariaLabel}"
    disabled="${disabled}"
    class="min-w-0 flex-1 border-0 bg-transparent px-[var(--lv-space-2)] text-center text-[var(--lv-color-fg)] outline-none disabled:cursor-not-allowed disabled:opacity-50"
    $unsafe{inputAttrs}
  >
  <button
    type="button"
    data-slot="input-number-increment"
    data-lv-input-number-target="increment"
    data-action="click->lv-input-number#increment"
    aria-label="Increase"
    disabled="${disabled}"
    class="${btnClass}"
  >
    <span aria-hidden="true">@template.lievit.icon(name = "plus", size = "1rem")</span>
  </button>
</div>
