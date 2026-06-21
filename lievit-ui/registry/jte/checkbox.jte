<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui checkbox partial -- a token-styled native <input type="checkbox">.

  TIER: STATIC presentational -> JTE partial. The native checkbox carries role=checkbox, Space
  activation and the checked/disabled semantics for free; there is no client state. The native
  element submits its `value` (default "on") ONLY when checked and is absent from FormData when
  unchecked -- native checkbox semantics the Lit island had to reimplement. `l:model` binds the
  native change event on the element.

  STRUCTURE (scientific decision rule): shadcn's Checkbox is a Radix button reimplementing the
  checkbox role in JS (it breaks JS-off form submit). For a server-first stack the native
  <input type=checkbox> wins outright on a11y, bundle and no-JS POST, so we style the native
  control with `appearance-none` + a token-coloured box and an inline SVG check via the icon
  partial (a `peer` + `peer-checked` reveal), shadcn's exact visual without its JS.

  A11y (WAI-ARIA APG checkbox): a real <input type=checkbox> with its own id/name. An external
  <label for> (or the optional inline `label`) names it; `ariaLabel` provides an accessible name
  when neither is present. The check glyph is decorative (aria-hidden, icon partial). `invalid`
  toggles aria-invalid="true" + a danger box border so assistive tech is told about the validation
  state. `indeterminate` renders aria-checked="mixed" + a dash glyph (the tri-state checkbox used
  for "some children selected"); the native `.indeterminate` DOM property is set by the optional
  enhancer / wire runtime from data-indeterminate, since it has no HTML attribute.

  Params:
    String name                 the checkbox's name (POSTs `value` under this name when checked).
    String id          = name   the checkbox's id (for a <label for>); defaults to name.
    String value       = "on"   submitted value when checked (native default "on").
    boolean checked    = false  initial checked state.
    boolean indeterminate = false  tri-state "mixed": dash glyph + aria-checked="mixed" + data-indeterminate.
    boolean disabled   = false  disables + dims the control.
    boolean required   = false  marks the control required.
    boolean invalid    = false  danger border + aria-invalid="true".
    String label       = null   optional inline label rendered after the box (wraps in a <label>).
    String ariaLabel   = null   aria-label when there is no visible label.
    String describedBy = null   id of an external hint/error element (aria-describedby).
    String model       = null   l:model expression to bind this checkbox to a wire field.
    String cssClass    = ""      extra utility classes on the wrapper.

  Usage:
    @@template.lievit.checkbox(name = "attivo", label = "Attivo", checked = contatto.attivo())
    @@template.lievit.checkbox(name = "consenso", ariaLabel = "Consenso", model = "consenso")
    @@template.lievit.checkbox(name = "all", label = "Select all", indeterminate = someSelected)
--%>
@param String name
@param String id = null
@param String value = "on"
@param boolean checked = false
@param boolean indeterminate = false
@param boolean disabled = false
@param boolean required = false
@param boolean invalid = false
@param String label = null
@param String ariaLabel = null
@param String describedBy = null
@param String model = null
@param String cssClass = ""

!{var boxId = (id != null && !id.isBlank()) ? id : name;}
!{var hasLabel = label != null && !label.isBlank();}

<label
  for="${boxId}"
  data-slot="checkbox"
  data-disabled="${disabled}"
  data-invalid="${invalid ? "true" : null}"
  class="inline-flex items-center gap-[var(--lv-space-2)] text-[length:var(--lv-text-sm)] text-[var(--lv-color-fg)] select-none data-[disabled=true]:cursor-not-allowed data-[disabled=true]:opacity-50 ${cssClass}"
  style="font-family:var(--lv-font-sans);"
>
  <span class="relative inline-flex size-[var(--lv-space-4)] shrink-0 items-center justify-center">
    <input
      data-slot="checkbox-control"
      type="checkbox"
      id="${boxId}"
      name="${name}"
      value="${value}"
      checked="${checked}"
      disabled="${disabled}"
      required="${required}"
      aria-label="${ariaLabel}"
      aria-describedby="${describedBy}"
      aria-invalid="${invalid ? "true" : null}"
      aria-checked="${indeterminate ? "mixed" : null}"
      data-indeterminate="${indeterminate ? "true" : null}"
      l:model="${model}"
      class="peer size-full cursor-pointer appearance-none rounded-[var(--lv-radius-sm)] border-2 border-[var(--lv-color-input)] bg-[var(--lv-color-bg)] outline-none transition-shadow checked:border-[var(--lv-color-primary)] checked:bg-[var(--lv-color-primary)] focus-visible:shadow-[var(--lv-ring)] disabled:cursor-not-allowed aria-[invalid=true]:border-[var(--lv-color-danger)] data-[indeterminate=true]:border-[var(--lv-color-primary)] data-[indeterminate=true]:bg-[var(--lv-color-primary)]"
    >
    <span aria-hidden="true" class="pointer-events-none absolute hidden text-[var(--lv-color-primary-fg)] peer-checked:flex peer-data-[indeterminate=true]:hidden">
      @template.lievit.icon(name = "check", size = "0.75rem")
    </span>
    <span aria-hidden="true" class="pointer-events-none absolute hidden text-[var(--lv-color-primary-fg)] peer-data-[indeterminate=true]:flex">
      @template.lievit.icon(name = "minus", size = "0.75rem")
    </span>
  </span>
  @if(hasLabel)
    <span data-slot="checkbox-label">${label}</span>
  @endif
</label>
